# WebSuddhi real-browser e2e

Loads the built MV3 extension (`dist/browser/chromium`) into Playwright's bundled Chromium
(new headless, `channel: 'chromium'`) and measures real blocking behaviour. Excluded from
`vitest run` (vitest only matches `tests/**/*.test.js`; these are `*.spec.mjs`).

## Run

```
npm install
npx playwright install chromium   # once
npm run test:e2e                  # builds targets, runs deterministic fixture suite
npm run test:e2e:report           # open HTML report
npm run test:e2e:live             # opt-in live-site survey (needs network)
```

Set `E2E_HEADED=1` for a headed run (needs a display, e.g. `xvfb-run`).

## Deterministic suite (`fixtures.spec.mjs`)

A local node server serves a first-party page. `--host-resolver-rules` maps the fixture hosts
and real ad hosts (doubleclick, googlesyndication, googletagmanager, google-analytics) to it, so
DNR rules match on genuine hostnames. Asserts: ad requests fail with `ERR_BLOCKED_BY_CLIENT`
and never reach the server, ad containers are hidden, and all 7 first-party images (same-origin
and CDN subdomain, including names like `ad-free-photo.png`, `/images/banner.png`,
`sponsor-thanks.png`) load with naturalWidth > 0 and are visible. Works offline.

## Live survey (`live.spec.mjs`)

`E2E_LIVE=1` only; never run in CI. Edit `sites.config.mjs` (`SITES`: `{ name, category, url }`)
to add or remove sites. Output: console table plus `test-results/live-survey.json` with
blocked ad/tracker requests (and top blocked hosts), blocked first-party requests, first-party
images failed (loaded but naturalWidth 0) or hidden, and total requests. It is a report, not
pass/fail; sites change, so compare runs rather than reading single numbers.
