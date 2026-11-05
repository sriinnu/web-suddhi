import { test, expect } from '@playwright/test';
import { launchWithExtension } from './fixtures.mjs';
import {
  startFixtureServer, FIRST_PARTY, FIRST_PARTY_CDN, AD_HOSTS, AD_SELECTORS, FP_IMAGE_COUNT,
} from './fixture-site.mjs';

test.describe('local fixture site (offline, deterministic)', () => {
  let ctx, srv, page;
  const blocked = [];

  test.beforeAll(async () => {
    srv = await startFixtureServer();
    const rules = [FIRST_PARTY, FIRST_PARTY_CDN, ...AD_HOSTS]
      .map((h) => `MAP ${h} 127.0.0.1:${srv.port}`)
      .join(', ');
    ctx = await launchWithExtension([`--host-resolver-rules=${rules}`]);
    page = await ctx.context.newPage();
    page.on('requestfailed', (r) => {
      if ((r.failure()?.errorText || '').includes('ERR_BLOCKED_BY_CLIENT')) blocked.push(r.url());
    });
    await page.goto(`http://${FIRST_PARTY}:${srv.port}/`, { waitUntil: 'load' });
    await page.waitForTimeout(3000); // let content scripts / observers settle
  });

  test.afterAll(async () => {
    await ctx?.context.close();
    await srv?.close();
  });

  test('extension service worker is running', async () => {
    expect(ctx.sw.url()).toContain('chrome-extension://');
  });

  for (const host of AD_HOSTS) {
    test(`ad/tracker request blocked: ${host}`, async () => {
      expect(blocked.some((u) => new URL(u).hostname === host), `blocked: ${JSON.stringify(blocked)}`).toBe(true);
      expect(srv.hits.filter((h) => h.startsWith(host + '/')), 'ad host reached the server').toEqual([]);
    });
  }

  for (const sel of AD_SELECTORS) {
    test(`ad container hidden: ${sel}`, async () => {
      const visible = await page.$$eval(sel, (els) =>
        els.filter((e) => {
          const r = e.getBoundingClientRect();
          const cs = getComputedStyle(e);
          return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
        }).length
      );
      expect(visible).toBe(0);
    });
  }

  test('ALL first-party images load and are visible', async () => {
    const report = await page.$$eval('img.fp-img', (imgs) =>
      imgs.map((i) => {
        const r = i.getBoundingClientRect();
        const cs = getComputedStyle(i);
        return { id: i.id, src: i.currentSrc, nw: i.naturalWidth, w: r.width, h: r.height, display: cs.display, vis: cs.visibility, op: cs.opacity };
      })
    );
    expect(report.length).toBe(FP_IMAGE_COUNT);
    const bad = report.filter((x) => !(x.nw > 0 && x.w > 0 && x.h > 0 && x.display !== 'none' && x.vis !== 'hidden' && x.op !== '0'));
    expect(bad, `bad first-party images: ${JSON.stringify(bad, null, 1)}`).toEqual([]);
  });

  test('no first-party request was blocked', async () => {
    const fp = blocked.filter((u) => [FIRST_PARTY, FIRST_PARTY_CDN].includes(new URL(u).hostname));
    expect(fp).toEqual([]);
  });

  // The picker is injected on demand (LOAD_PICKER -> scripting.executeScript),
  // so this proves the real injection path, not just the jsdom stand-in.
  test('element picker loads on demand and starts/stops', async () => {
    const send = (type) => ctx.sw.evaluate(async ({ type, host }) => {
      const [tab] = await chrome.tabs.query({ url: `http://${host}/*` });
      return chrome.tabs.sendMessage(tab.id, { type }, { frameId: 0 });
    }, { type, host: FIRST_PARTY });

    expect(await page.locator('.websuddhi-pick-overlay').count()).toBe(0);
    expect(await send('START_PICK_MODE')).toMatchObject({ success: true });
    await expect(page.locator('.websuddhi-pick-overlay')).toHaveCount(1);
    expect(await send('TOGGLE_PICK_MODE')).toMatchObject({ success: true, pickMode: false });
    await expect(page.locator('.websuddhi-pick-overlay')).toHaveCount(0);
  });
});
