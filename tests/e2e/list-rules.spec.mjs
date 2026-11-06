import { test, expect } from '@playwright/test';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchWithExtension, PNG } from './fixtures.mjs';

// Real rules from the built EasyList/EasyPrivacy output, so this proves the
// compiled tables work in a browser, not just that they parse.
const RULES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../rules');
const load = (f) => JSON.parse(readFileSync(path.join(RULES, f), 'utf8'));

function pickCosmetic() {
  const table = load('cosmetic-filters.json');
  for (const [host, list] of Object.entries(table.hide)) {
    if (!/^[a-z0-9-]+\.[a-z]{2,}$/.test(host) || table.disabled.includes(host)) continue;
    const unhide = new Set(table.unhide[host] || []);
    const sel = list.map((i) => table.selectors[i]).find((s, k) => /^\.[a-z][\w-]{3,}$/i.test(s) && !unhide.has(list[k]));
    if (sel) return { host, selector: sel };
  }
  throw new Error('no simple site-specific selector in cosmetic-filters.json');
}

function pickPathRule() {
  const rules = Object.keys(load('ruleset-counts.json'))
    .filter((id) => id.startsWith('generated_ads_'))
    .flatMap((id) => load(id.replace(/_/g, '-') + '.json'));
  const rule = rules.find((r) => {
    const c = r.condition;
    return r.action.type === 'block' && /^\/[a-z0-9_/-]{6,}$/.test(c.urlFilter) &&
      !c.domainType && !c.initiatorDomains && !c.excludedInitiatorDomains &&
      (c.resourceTypes ? c.resourceTypes.includes('image') : !(c.excludedResourceTypes || []).includes('image'));
  });
  if (!rule) throw new Error('no plain first-party path rule in generated ads rulesets');
  return rule.condition.urlFilter;
}

test.describe('compiled list rules on a page (offline)', () => {
  const cosmetic = pickCosmetic();
  const pathFilter = pickPathRule();
  const adPath = pathFilter + 'x.png';
  let ctx, server, port, page;
  const blocked = [];

  test.beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(`<!doctype html><title>t</title>
<div id="list-target" class="${cosmetic.selector.slice(1)}" style="width:300px;height:100px">promo</div>
<div id="control" style="width:300px;height:100px">article text</div>
<img id="fp-ad" src="${adPath}" width="20" height="20">
<img id="fp-ok" src="/img/photo.png" width="20" height="20">`);
      }
      res.writeHead(200, { 'content-type': 'image/png' });
      res.end(PNG);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
    ctx = await launchWithExtension([`--host-resolver-rules=MAP ${cosmetic.host} 127.0.0.1:${port}`]);
    page = await ctx.context.newPage();
    page.on('requestfailed', (r) => {
      if ((r.failure()?.errorText || '').includes('ERR_BLOCKED_BY_CLIENT')) blocked.push(new URL(r.url()).pathname);
    });
    await page.goto(`http://${cosmetic.host}:${port}/`, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
  });

  test.afterAll(async () => {
    await ctx?.context.close();
    await new Promise((r) => server?.close(r));
  });

  test('a site-specific EasyList selector hides its element', async () => {
    const display = await page.$eval('#list-target', (e) => getComputedStyle(e).display); // omit-allow: Playwright $eval runs a function in the page, not a string
    expect(display, `${cosmetic.host}##${cosmetic.selector}`).toBe('none');
    expect(await page.$eval('#control', (e) => getComputedStyle(e).display)).not.toBe('none'); // omit-allow: Playwright $eval runs a function in the page, not a string
  });

  test('a first-party ad path is blocked; an ordinary image is not', async () => {
    expect(blocked, `rule ${pathFilter}`).toContain(adPath);
    expect(blocked).not.toContain('/img/photo.png');
  });
});
