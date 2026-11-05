import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { launchWithExtension } from './fixtures.mjs';
import { SITES, NAV_TIMEOUT, SETTLE_MS } from './sites.config.mjs';

// Opt-in survey: E2E_LIVE=1. A report, not pass/fail.
test.skip(process.env.E2E_LIVE !== '1', 'live survey is opt-in (E2E_LIVE=1)');

// Crude registrable-domain: last two labels (three for common 2-level TLDs like co.uk).
function site(host) {
  const p = host.split('.');
  const n = /^(co|com|org|net|gov|ac)$/.test(p[p.length - 2] || '') && p[p.length - 1].length === 2 ? 3 : 2;
  return p.slice(-n).join('.');
}

async function surveyOne(context, entry) {
  const page = await context.newPage();
  const firstParty = site(new URL(entry.url).hostname);
  const row = {
    name: entry.name, category: entry.category, url: entry.url,
    totalRequests: 0, blockedAdTracker: 0, blockedFirstParty: 0,
    blockedFirstPartyImages: 0, fpImagesTotal: 0, fpImagesFailed: 0, fpImagesHidden: 0,
    blockedHosts: {}, error: null,
  };
  page.on('request', () => row.totalRequests++);
  page.on('requestfailed', (r) => {
    if (!(r.failure()?.errorText || '').includes('ERR_BLOCKED_BY_CLIENT')) return;
    const h = new URL(r.url()).hostname;
    if (site(h) === firstParty) {
      row.blockedFirstParty++;
      if (r.resourceType() === 'image') row.blockedFirstPartyImages++;
    } else {
      row.blockedAdTracker++;
      row.blockedHosts[h] = (row.blockedHosts[h] || 0) + 1;
    }
  });
  try {
    await page.goto(entry.url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    // scroll to trigger lazy images
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(SETTLE_MS / 6);
    }
    const imgs = await page.evaluate((fp) => {
      const site = (host) => {
        const p = host.split('.');
        const n = /^(co|com|org|net|gov|ac)$/.test(p[p.length - 2] || '') && p[p.length - 1].length === 2 ? 3 : 2;
        return p.slice(-n).join('.');
      };
      const out = { total: 0, failed: 0, hidden: 0, hiddenSamples: [], failedSamples: [] };
      for (const i of document.images) {
        let src = i.currentSrc || i.src;
        if (!src || src.startsWith('data:')) continue;
        let host;
        try { host = new URL(src).hostname; } catch { continue; }
        if (site(host) !== fp) continue;
        out.total++;
        if (i.complete && i.naturalWidth === 0) { out.failed++; if (out.failedSamples.length < 5) out.failedSamples.push(src); continue; }
        // only count "hidden" if the image loaded but it or an ancestor is collapsed
        const cs = getComputedStyle(i);
        const r = i.getBoundingClientRect();
        const nonTrivial = i.naturalWidth > 50 && i.naturalHeight > 50;
        if (nonTrivial && (cs.display === 'none' || cs.visibility === 'hidden' || (r.width === 0 && r.height === 0))) {
          out.hidden++;
          if (out.hiddenSamples.length < 5) out.hiddenSamples.push(src);
        }
      }
      return out;
    }, firstParty);
    row.fpImagesTotal = imgs.total;
    row.fpImagesFailed = imgs.failed;
    row.fpImagesHidden = imgs.hidden;
    row.samples = { failed: imgs.failedSamples, hidden: imgs.hiddenSamples };
  } catch (e) {
    row.error = String(e.message || e).split('\n')[0];
  } finally {
    await page.close().catch(() => {});
  }
  return row;
}

test('live-site survey', async () => {
  test.setTimeout(SITES.length * (NAV_TIMEOUT + SETTLE_MS + 10000));
  const { context } = await launchWithExtension();
  const rows = [];
  for (const entry of SITES) {
    const row = await surveyOne(context, entry);
    rows.push(row);
    console.log(`done ${entry.name}${row.error ? ' (error: ' + row.error + ')' : ''}`);
  }
  await context.close();

  const dir = path.resolve('test-results');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'live-survey.json'), JSON.stringify({ date: new Date().toISOString(), rows }, null, 2));
  console.log('\nLive survey (extension ON)');
  console.table(rows.map((r) => ({
    site: r.name, total: r.totalRequests, 'blocked ad/trk': r.blockedAdTracker,
    'blocked 1p': r.blockedFirstParty, 'blocked 1p img': r.blockedFirstPartyImages,
    '1p imgs': r.fpImagesTotal, 'img failed': r.fpImagesFailed, 'img hidden': r.fpImagesHidden,
    err: r.error ? r.error.slice(0, 40) : '',
  })));
  console.log('JSON written to test-results/live-survey.json');
});
