import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { launchWithExtension, launchBaseline } from './fixtures.mjs';
import { SITES, NAV_TIMEOUT, SETTLE_MS } from './sites.config.mjs';

// Opt-in survey: E2E_LIVE=1. A report, not pass/fail.
//
// Each site loads twice: in a clean browser (baseline) and with WebSuddhi.
// The report answers three questions:
//   1. Did we hide first-party images the site itself shows? (hidden ON vs OFF,
//      plus the rule that hid each one, via data-websuddhi-rule)
//   2. Did we block first-party requests?
//   3. Which ad/tracker-looking hosts still load with the extension on? (misses)
test.skip(process.env.E2E_LIVE !== '1', 'live survey is opt-in (E2E_LIVE=1)');

// Crude registrable-domain: last two labels (three for common 2-level TLDs like co.uk).
function site(host) {
  const p = host.split('.');
  const n = /^(co|com|org|net|gov|ac)$/.test(p[p.length - 2] || '') && p[p.length - 1].length === 2 ? 3 : 2;
  return p.slice(-n).join('.');
}

// A hint, not an oracle: well-known ad/tracker networks. Used only to flag
// hosts that still load with the extension on as likely misses.
const AD_HOST_HINT = new RegExp('(^|\\.)(' + [
  'doubleclick\\.net', 'googlesyndication\\.com', 'googleadservices\\.com', 'adservice\\.google\\.[a-z.]+',
  'googletagservices\\.com', 'amazon-adsystem\\.com', 'adnxs\\.com', 'pubmatic\\.com', 'rubiconproject\\.com',
  'openx\\.net', 'criteo\\.(com|net)', 'taboola\\.com', 'outbrain\\.com', 'casalemedia\\.com', 'teads\\.tv',
  'smartadserver\\.com', 'adform\\.net', 'moatads\\.com', 'scorecardresearch\\.com', 'quantserve\\.com',
  'chartbeat\\.(com|net)', 'hotjar\\.com', 'adsrvr\\.org', 'bidswitch\\.net', 'sharethrough\\.com',
  'media\\.net', 'yieldmo\\.com', '33across\\.com', 'indexww\\.com', '3lift\\.com', 'gumgum\\.com',
  'lijit\\.com', 'krxd\\.net', 'bluekai\\.com', 'demdex\\.net', 'omtrdc\\.net', 'everesttech\\.net',
  'agkn\\.com', 'rlcdn\\.com', 'tapad\\.com', 'mathtag\\.com', 'crwdcntrl\\.net', 'permutive\\.(com|app)',
  'liadm\\.com', 'id5-sync\\.com', 'bounceexchange\\.com', 'connect\\.facebook\\.net', 'ads-twitter\\.com',
  'adsafeprotected\\.com', 'doubleverify\\.com', 'google-analytics\\.com', 'googletagmanager\\.com',
].join('|') + ')$');

async function surveyOne(context, entry) {
  const page = await context.newPage();
  const firstParty = site(new URL(entry.url).hostname);
  const row = {
    totalRequests: 0, blockedAdTracker: 0, blockedFirstParty: 0, blockedFirstPartyImages: 0,
    fpImagesTotal: 0, fpImagesFailed: 0, fpImagesHidden: 0, fpImagesHiddenByUs: 0,
    blockedHosts: {}, loadedThirdParty: {}, hiddenByUs: [], blockedFirstPartyUrls: [], error: null,
  };
  page.on('request', () => row.totalRequests++);
  page.on('requestfinished', (r) => {
    const h = new URL(r.url()).hostname;
    if (site(h) !== firstParty) row.loadedThirdParty[h] = (row.loadedThirdParty[h] || 0) + 1;
  });
  page.on('requestfailed', (r) => {
    if (!(r.failure()?.errorText || '').includes('ERR_BLOCKED_BY_CLIENT')) return;
    const h = new URL(r.url()).hostname;
    if (site(h) === firstParty) {
      row.blockedFirstParty++;
      if (r.resourceType() === 'image') row.blockedFirstPartyImages++;
      if (row.blockedFirstPartyUrls.length < 10) row.blockedFirstPartyUrls.push(r.url());
    } else {
      row.blockedAdTracker++;
      row.blockedHosts[h] = (row.blockedHosts[h] || 0) + 1;
    }
  });
  try {
    await page.goto(entry.url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    for (let i = 0; i < 6; i++) { // scroll to trigger lazy images
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(SETTLE_MS / 6);
    }
    const imgs = await page.evaluate((fp) => {
      const site = (host) => {
        const p = host.split('.');
        const n = /^(co|com|org|net|gov|ac)$/.test(p[p.length - 2] || '') && p[p.length - 1].length === 2 ? 3 : 2;
        return p.slice(-n).join('.');
      };
      const describe = (el) => el.tagName.toLowerCase()
        + (el.id ? '#' + el.id : '')
        + (typeof el.className === 'string' && el.className.trim()
          ? '.' + el.className.trim().split(/\s+/).filter((c) => !c.startsWith('websuddhi')).slice(0, 3).join('.') : '');
      const out = { total: 0, failed: 0, hidden: 0, hiddenByUs: [] };
      for (const i of document.images) {
        const src = i.currentSrc || i.src;
        if (!src || src.startsWith('data:')) continue;
        let host;
        try { host = new URL(src).hostname; } catch { continue; }
        if (site(host) !== fp) continue;
        out.total++;
        if (i.complete && i.naturalWidth === 0) { out.failed++; continue; }
        const cs = getComputedStyle(i);
        const r = i.getBoundingClientRect();
        const nonTrivial = i.naturalWidth > 50 && i.naturalHeight > 50;
        if (!(nonTrivial && (cs.display === 'none' || cs.visibility === 'hidden' || (r.width === 0 && r.height === 0)))) continue;
        out.hidden++;
        const marker = i.closest('[data-websuddhi-blocked], [data-websuddhi-removed], .websuddhi-hidden');
        if (marker) {
          out.hiddenByUs.push({
            src: src.slice(0, 160),
            rule: marker.getAttribute('data-websuddhi-rule') || marker.getAttribute('data-websuddhi-blocked') || '(no rule recorded)',
            element: describe(marker),
          });
        }
      }
      return out;
    }, firstParty);
    row.fpImagesTotal = imgs.total;
    row.fpImagesFailed = imgs.failed;
    row.fpImagesHidden = imgs.hidden;
    row.fpImagesHiddenByUs = imgs.hiddenByUs.length;
    row.hiddenByUs = imgs.hiddenByUs.slice(0, 20);
  } catch (e) {
    row.error = String(e.message || e).split('\n')[0];
  } finally {
    await page.close().catch(() => {});
  }
  return row;
}

function topEntries(obj, n) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
}

test('live-site survey', async () => {
  test.setTimeout(SITES.length * 2 * (NAV_TIMEOUT + SETTLE_MS + 10000));
  const base = await launchBaseline();
  const ext = await launchWithExtension();
  const rows = [];
  for (const entry of SITES) {
    const off = await surveyOne(base.context, entry);
    const on = await surveyOne(ext.context, entry);
    const missed = topEntries(on.loadedThirdParty, 1000).filter(([h]) => AD_HOST_HINT.test(h));
    const ruleCounts = {};
    for (const h of on.hiddenByUs) ruleCounts[h.rule] = (ruleCounts[h.rule] || 0) + 1;
    rows.push({
      name: entry.name, category: entry.category, url: entry.url,
      off, on,
      missedAdHosts: missed.map(([h, c]) => ({ host: h, requests: c })),
      hiddenByUsRules: topEntries(ruleCounts, 10).map(([rule, count]) => ({ rule, count })),
    });
    const err = on.error || off.error;
    console.log(`done ${entry.name}${err ? ' (error: ' + err + ')' : ''}`);
  }
  await base.context.close();
  await ext.context.close();

  const dir = path.resolve('test-results');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'live-survey.json'), JSON.stringify({ date: new Date().toISOString(), rows }, null, 2));

  console.log('\nLive survey: baseline (OFF) vs WebSuddhi (ON)');
  console.table(rows.map((r) => ({
    site: r.name,
    'reqs off→on': `${r.off.totalRequests}→${r.on.totalRequests}`,
    'blocked 3p': r.on.blockedAdTracker,
    'blocked 1p': r.on.blockedFirstParty,
    '1p imgs off→on': `${r.off.fpImagesTotal}→${r.on.fpImagesTotal}`,
    'hidden off→on': `${r.off.fpImagesHidden}→${r.on.fpImagesHidden}`,
    'hidden by us': r.on.fpImagesHiddenByUs,
    'ad hosts still loading': r.missedAdHosts.length,
    err: (r.on.error || r.off.error || '').slice(0, 30),
  })));
  for (const r of rows) {
    if (r.hiddenByUsRules.length) {
      console.log(`\n${r.name}: first-party images hidden by these rules`);
      for (const x of r.hiddenByUsRules) console.log(`  ${x.count}x  ${x.rule}`);
    }
    if (r.missedAdHosts.length) {
      console.log(`${r.name}: ad/tracker hosts still loading: ` + r.missedAdHosts.slice(0, 8).map((m) => `${m.host}(${m.requests})`).join(', '));
    }
  }
  console.log('\nJSON written to test-results/live-survey.json');
});
