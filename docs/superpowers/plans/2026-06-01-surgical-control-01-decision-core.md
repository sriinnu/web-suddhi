# Surgical Control — Plan 1: Decision Core

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure decision layer that decides, for any frame, whether to allow / block / flag it — driven by the user's site & frame rules, the aggressiveness dial, and a category/heaviness classifier. No DOM, no browser-blocking APIs yet.

**Architecture:** Three browser-agnostic modules in the existing `self.WebSuddhi.*` IIFE style. `classifier` maps a frame's domain + dimensions to a category and protected/known-ad flags using JSON lists. `ruleModel` holds the persisted site-state + frame-rule store (plus in-memory session rules) and a single **pure** `resolveFrameDecision()` truth-table that every later subsystem calls. Everything here is unit-tested with vitest/jsdom; later plans (frame engine, network blocker, popup) consume these functions.

**Tech Stack:** Vanilla JS (ES IIFE modules, no bundler for these files), vitest + jsdom, `chrome.storage.local` via `self.WebSuddhi.utils.getStorage/setStorage`.

---

## File Structure

| File | Responsibility |
|---|---|
| `rules/protected.json` | Domain → category map for never-auto-blocked frames (payment / captcha / auth / core embeds). |
| `rules/categories.json` | Domain → category map for known ad / analytics / session-replay / embed / social. |
| `background/classifier.js` (new) | Pure `categorize(frameInfo, lists)` + `estimateHeaviness(metrics, budget)`; list loader/cache. |
| `shared/rule-model.js` (new) | Site-state + frame-rule persistence, in-memory session rules, pure `resolveFrameDecision(input)`. |
| `tests/classifier.test.js` (new) | Unit tests for categorize + heaviness. |
| `tests/rule-model.test.js` (new) | Unit tests for the decision truth-table + persistence. |

**Decision contract (the interface every later plan depends on — lock these names):**

```
resolveFrameDecision({
  siteState:        'protected' | 'default' | 'paused',   // default 'default'
  category:         string,                                // 'ad' | 'analytics' | 'session-replay' | 'payment' | 'captcha' | 'auth' | 'embed' | 'social' | 'other'
  isProtected:      boolean,
  isHeavy:          boolean,
  isKnownAdTracker: boolean,
  aggressiveness:   'conservative' | 'balanced' | 'aggressive',  // default 'balanced'
  persistentRule:   'allowed' | 'blocked' | null,
  sessionRule:      'allowed' | 'blocked' | null
}) => { action: 'allow' | 'block' | 'flag', reason: string }

categorize({ domain, url, width, height }, { protected, categories })
  => { category: string, isProtected: boolean, isKnownAdTracker: boolean }

estimateHeaviness({ bytes, longTaskMs }, { bytes, ms }) => boolean
```

---

## Task 1: Seed the categorized rule lists

**Files:**
- Create: `rules/protected.json`
- Create: `rules/categories.json`
- Test: `tests/classifier.test.js` (created here, expanded in Task 2)

- [ ] **Step 1: Write `rules/protected.json`**

```json
{
  "stripe.com": "payment",
  "js.stripe.com": "payment",
  "paypal.com": "payment",
  "paypalobjects.com": "payment",
  "braintreegateway.com": "payment",
  "adyen.com": "payment",
  "applepay.cdn-apple.com": "payment",
  "checkout.com": "payment",
  "google.com/recaptcha": "captcha",
  "recaptcha.net": "captcha",
  "gstatic.com/recaptcha": "captcha",
  "hcaptcha.com": "captcha",
  "challenges.cloudflare.com": "captcha",
  "accounts.google.com": "auth",
  "login.microsoftonline.com": "auth",
  "appleid.apple.com": "auth",
  "youtube.com": "embed",
  "youtube-nocookie.com": "embed",
  "player.vimeo.com": "embed",
  "google.com/maps": "embed",
  "maps.googleapis.com": "embed"
}
```

- [ ] **Step 2: Write `rules/categories.json`**

```json
{
  "doubleclick.net": "ad",
  "googlesyndication.com": "ad",
  "googleadservices.com": "ad",
  "amazon-adsystem.com": "ad",
  "adnxs.com": "ad",
  "criteo.com": "ad",
  "taboola.com": "ad",
  "outbrain.com": "ad",
  "pubmatic.com": "ad",
  "rubiconproject.com": "ad",
  "google-analytics.com": "analytics",
  "googletagmanager.com": "analytics",
  "scorecardresearch.com": "session-replay",
  "hotjar.com": "session-replay",
  "fullstory.com": "session-replay",
  "clarity.ms": "session-replay",
  "mouseflow.com": "session-replay",
  "platform.twitter.com": "social",
  "connect.facebook.net": "social",
  "platform.instagram.com": "social",
  "disqus.com": "social"
}
```

- [ ] **Step 3: Write the list-shape test in `tests/classifier.test.js`**

```javascript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));

describe('rule lists', () => {
  it('protected.json maps known payment/captcha/auth/embed domains', () => {
    const list = readJson('rules/protected.json');
    expect(list['js.stripe.com']).toBe('payment');
    expect(list['hcaptcha.com']).toBe('captcha');
    expect(list['accounts.google.com']).toBe('auth');
    expect(list['youtube.com']).toBe('embed');
  });

  it('categories.json maps known ad/analytics/replay/social domains', () => {
    const list = readJson('rules/categories.json');
    expect(list['doubleclick.net']).toBe('ad');
    expect(list['scorecardresearch.com']).toBe('session-replay');
    expect(list['google-analytics.com']).toBe('analytics');
    expect(list['disqus.com']).toBe('social');
  });

  it('lists do not overlap (a domain is protected XOR categorized)', () => {
    const prot = Object.keys(readJson('rules/protected.json'));
    const cats = readJson('rules/categories.json');
    for (const d of prot) expect(cats[d]).toBeUndefined();
  });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/classifier.test.js`
Expected: 3 passing (`rule lists`).

- [ ] **Step 5: Commit**

```bash
git add rules/protected.json rules/categories.json tests/classifier.test.js
TMPDIR=/tmp git commit -S -m "feat(rules): seed categorized + protected frame lists"
```

---

## Task 2: classifier.categorize + estimateHeaviness

**Files:**
- Create: `background/classifier.js`
- Test: `tests/classifier.test.js` (append)

- [ ] **Step 1: Append failing tests to `tests/classifier.test.js`**

```javascript
describe('classifier.categorize', () => {
  let classifier;
  const lists = {
    protected: { 'js.stripe.com': 'payment', 'youtube.com': 'embed' },
    categories: { 'doubleclick.net': 'ad', 'scorecardresearch.com': 'session-replay', 'google-analytics.com': 'analytics' }
  };

  beforeAll(async () => {
    globalThis.self = globalThis;
    await import('../background/classifier.js');
    classifier = globalThis.WebSuddhi.classifier;
  });

  it('flags protected domains and never marks them ad/tracker', () => {
    const r = classifier.categorize({ domain: 'js.stripe.com' }, lists);
    expect(r).toEqual({ category: 'payment', isProtected: true, isKnownAdTracker: false });
  });

  it('matches subdomains to their parent list entry', () => {
    const r = classifier.categorize({ domain: 'ads.g.doubleclick.net' }, lists);
    expect(r.category).toBe('ad');
    expect(r.isKnownAdTracker).toBe(true);
  });

  it('marks analytics/session-replay as known ad/tracker', () => {
    expect(classifier.categorize({ domain: 'scorecardresearch.com' }, lists).isKnownAdTracker).toBe(true);
    expect(classifier.categorize({ domain: 'google-analytics.com' }, lists).isKnownAdTracker).toBe(true);
  });

  it('treats a 1x1 unknown frame as an analytics pixel (not known-tracker)', () => {
    const r = classifier.categorize({ domain: 'unknown-x.com', width: 1, height: 1 }, lists);
    expect(r).toEqual({ category: 'analytics', isProtected: false, isKnownAdTracker: false });
  });

  it('uses URL heuristics for unknown ad frames (not known-tracker)', () => {
    const r = classifier.categorize({ domain: 'cdn-x.com', url: 'https://cdn-x.com/ads/banner.html', width: 300, height: 250 }, lists);
    expect(r.category).toBe('ad');
    expect(r.isKnownAdTracker).toBe(false);
  });

  it('falls back to "other" for unknown plain frames', () => {
    expect(classifier.categorize({ domain: 'random-site.com', width: 800, height: 600 }, lists).category).toBe('other');
  });
});

describe('classifier.estimateHeaviness', () => {
  let classifier;
  beforeAll(() => { classifier = globalThis.WebSuddhi.classifier; });

  it('is heavy when bytes exceed budget', () => {
    expect(classifier.estimateHeaviness({ bytes: 600 * 1024, longTaskMs: 0 }, { bytes: 500 * 1024, ms: 150 })).toBe(true);
  });
  it('is heavy when long-task time exceeds budget', () => {
    expect(classifier.estimateHeaviness({ bytes: 0, longTaskMs: 200 }, { bytes: 500 * 1024, ms: 150 })).toBe(true);
  });
  it('is not heavy under both budgets', () => {
    expect(classifier.estimateHeaviness({ bytes: 1024, longTaskMs: 10 }, { bytes: 500 * 1024, ms: 150 })).toBe(false);
  });
});
```

Add `beforeAll` to the import line at the top of the file:
```javascript
import { describe, it, expect, beforeAll } from 'vitest';
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/classifier.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'categorize')` (module not written yet).

- [ ] **Step 3: Write `background/classifier.js`**

```javascript
// WebSuddhi - Frame Classifier
// Pure category + heaviness classification. No browser APIs in the hot path.
(function () {
  'use strict';
  if (!self.WebSuddhi) self.WebSuddhi = {};
  if (!self.WebSuddhi.classifier) self.WebSuddhi.classifier = {};
  const c = self.WebSuddhi.classifier;

  const KNOWN_TRACKER_CATEGORIES = new Set(['ad', 'analytics', 'session-replay']);

  // Match a host against a { domain: category } map, exact or any parent suffix.
  function matchList(host, list) {
    if (!host || !list) return null;
    const parts = host.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
      const d = parts.slice(i).join('.');
      if (Object.prototype.hasOwnProperty.call(list, d)) return list[d];
    }
    return Object.prototype.hasOwnProperty.call(list, host) ? list[host] : null;
  }

  c.categorize = function (frameInfo, lists) {
    const info = frameInfo || {};
    const host = (info.domain || '').toLowerCase();
    const protectedList = (lists && lists.protected) || {};
    const categories = (lists && lists.categories) || {};

    const protCat = matchList(host, protectedList);
    if (protCat) return { category: protCat, isProtected: true, isKnownAdTracker: false };

    const knownCat = matchList(host, categories);
    if (knownCat) {
      return { category: knownCat, isProtected: false, isKnownAdTracker: KNOWN_TRACKER_CATEGORIES.has(knownCat) };
    }

    // Heuristics for unknown frames — never marked known-ad-tracker (so they only
    // get auto-blocked at "aggressive", flagged at "balanced"; protects #2).
    const w = Number(info.width) || 0;
    const h = Number(info.height) || 0;
    if (w > 0 && h > 0 && w <= 2 && h <= 2) {
      return { category: 'analytics', isProtected: false, isKnownAdTracker: false };
    }
    const url = (info.url || '').toLowerCase();
    if (/(\/ads?\/|\/pixel|adframe|\/embed\/ad)/.test(url)) {
      return { category: 'ad', isProtected: false, isKnownAdTracker: false };
    }

    return { category: 'other', isProtected: false, isKnownAdTracker: false };
  };

  c.estimateHeaviness = function (metrics, budget) {
    const m = metrics || {};
    const b = budget || { bytes: 500 * 1024, ms: 150 };
    return (Number(m.bytes) || 0) > b.bytes || (Number(m.longTaskMs) || 0) > b.ms;
  };

  c.KNOWN_TRACKER_CATEGORIES = KNOWN_TRACKER_CATEGORIES;
})();
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/classifier.test.js`
Expected: all `classifier.categorize` + `classifier.estimateHeaviness` + `rule lists` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add background/classifier.js tests/classifier.test.js
TMPDIR=/tmp git commit -S -m "feat(classifier): pure category + heaviness classification"
```

---

## Task 3: ruleModel.resolveFrameDecision (the truth table)

**Files:**
- Create: `shared/rule-model.js`
- Test: `tests/rule-model.test.js`

- [ ] **Step 1: Write failing tests in `tests/rule-model.test.js`**

```javascript
import { describe, it, expect, beforeAll } from 'vitest';

let rm;
beforeAll(async () => {
  globalThis.self = globalThis;
  await import('../shared/rule-model.js');
  rm = globalThis.WebSuddhi.ruleModel;
});

const base = {
  siteState: 'default', category: 'other', isProtected: false,
  isHeavy: false, isKnownAdTracker: false, aggressiveness: 'balanced',
  persistentRule: null, sessionRule: null
};
const decide = (over) => rm.resolveFrameDecision({ ...base, ...over });

describe('resolveFrameDecision', () => {
  it('paused site allows everything, even known trackers', () => {
    expect(decide({ siteState: 'paused', isKnownAdTracker: true }).action).toBe('allow');
  });
  it('explicit session rule beats persistent rule', () => {
    expect(decide({ sessionRule: 'allowed', persistentRule: 'blocked', isKnownAdTracker: true }).action).toBe('allow');
  });
  it('explicit persistent block wins over default-allow', () => {
    expect(decide({ persistentRule: 'blocked' }).action).toBe('block');
  });
  it('protected frames are never auto-blocked', () => {
    expect(decide({ isProtected: true, isHeavy: true, aggressiveness: 'aggressive' }).action).toBe('allow');
  });
  it('known ad/tracker is blocked at every tier', () => {
    for (const a of ['conservative', 'balanced', 'aggressive'])
      expect(decide({ isKnownAdTracker: true, aggressiveness: a }).action).toBe('block');
  });
  it('unknown heavy frame: conservative allows', () => {
    expect(decide({ isHeavy: true, aggressiveness: 'conservative' }).action).toBe('allow');
  });
  it('unknown heavy frame: balanced flags', () => {
    expect(decide({ isHeavy: true, aggressiveness: 'balanced' }).action).toBe('flag');
  });
  it('unknown heavy frame: aggressive blocks', () => {
    expect(decide({ isHeavy: true, aggressiveness: 'aggressive' }).action).toBe('block');
  });
  it('unknown light frame is allowed', () => {
    expect(decide({ isHeavy: false }).action).toBe('allow');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/rule-model.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'resolveFrameDecision')`.

- [ ] **Step 3: Write the decision core in `shared/rule-model.js`**

```javascript
// WebSuddhi - Rule Model
// Site-state + frame-rule store and the single pure frame-decision function.
(function () {
  'use strict';
  if (!self.WebSuddhi) self.WebSuddhi = {};
  if (!self.WebSuddhi.ruleModel) self.WebSuddhi.ruleModel = {};
  const rm = self.WebSuddhi.ruleModel;

  rm.SITE_STATES = Object.freeze({ PROTECTED: 'protected', DEFAULT: 'default', PAUSED: 'paused' });
  rm.FRAME_RULES = Object.freeze({ ALLOWED: 'allowed', BLOCKED: 'blocked' });
  rm.AGGRESSIVENESS = Object.freeze({ CONSERVATIVE: 'conservative', BALANCED: 'balanced', AGGRESSIVE: 'aggressive' });

  // Pure: given everything known about a frame, decide allow / block / flag.
  rm.resolveFrameDecision = function (input) {
    const i = input || {};
    const siteState = i.siteState || 'default';
    const aggressiveness = i.aggressiveness || 'balanced';

    // 1. Site paused → blocking entirely off here.
    if (siteState === 'paused') return { action: 'allow', reason: 'site-paused' };

    // 2. Explicit per-frame rule wins; session overrides persistent.
    const explicit = i.sessionRule || i.persistentRule || null;
    if (explicit === 'blocked') return { action: 'block', reason: 'frame-rule' };
    if (explicit === 'allowed') return { action: 'allow', reason: 'frame-rule' };

    // 3. Protected categories are never auto-blocked.
    if (i.isProtected) return { action: 'allow', reason: 'protected' };

    // 4. Known ad/tracker domains block at every tier.
    if (i.isKnownAdTracker) return { action: 'block', reason: 'known-ad-tracker' };

    // 5. Unknown heavy frames depend on the aggressiveness dial.
    if (i.isHeavy) {
      if (aggressiveness === 'aggressive') return { action: 'block', reason: 'heavy-aggressive' };
      if (aggressiveness === 'conservative') return { action: 'allow', reason: 'heavy-conservative' };
      return { action: 'flag', reason: 'heavy-flagged' }; // balanced
    }

    // 6. Everything else is allowed.
    return { action: 'allow', reason: 'default-allow' };
  };
})();
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/rule-model.test.js`
Expected: all 9 `resolveFrameDecision` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/rule-model.js tests/rule-model.test.js
TMPDIR=/tmp git commit -S -m "feat(rule-model): pure frame-decision truth table"
```

---

## Task 4: Site-state persistence

**Files:**
- Modify: `shared/rule-model.js` (append persistence API)
- Test: `tests/rule-model.test.js` (append)

- [ ] **Step 1: Append failing tests to `tests/rule-model.test.js`**

```javascript
describe('site-state persistence', () => {
  let store;
  beforeEach(() => {
    store = {};
    globalThis.WebSuddhi.utils = {
      getStorage: async (keys) => {
        const ks = Array.isArray(keys) ? keys : [keys];
        return Object.fromEntries(ks.map((k) => [k, store[k]]).filter(([, v]) => v !== undefined));
      },
      setStorage: async (data) => { Object.assign(store, data); }
    };
  });

  it('defaults to "default" when nothing is stored', async () => {
    expect(await rm.getSiteState('nytimes.com')).toBe('default');
  });
  it('persists protected / paused and round-trips', async () => {
    await rm.setSiteState('nytimes.com', 'paused');
    expect(await rm.getSiteState('nytimes.com')).toBe('paused');
  });
  it('setting "default" removes the stored entry', async () => {
    await rm.setSiteState('a.com', 'protected');
    await rm.setSiteState('a.com', 'default');
    expect(await rm.getSiteState('a.com')).toBe('default');
    const raw = await globalThis.WebSuddhi.utils.getStorage(['ws_siteStates']);
    expect(raw.ws_siteStates['a.com']).toBeUndefined();
  });
});
```

Add `beforeEach` to the top import:
```javascript
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/rule-model.test.js`
Expected: FAIL — `rm.getSiteState is not a function`.

- [ ] **Step 3: Append persistence API to `shared/rule-model.js`** (inside the IIFE, before the closing `})();`)

```javascript
  const STORAGE_KEYS = Object.freeze({ SITE_STATES: 'ws_siteStates', FRAME_RULES: 'ws_frameRules' });
  rm.STORAGE_KEYS = STORAGE_KEYS;

  function utils() { return self.WebSuddhi && self.WebSuddhi.utils; }

  rm.getSiteState = async function (domain) {
    const u = utils();
    if (!u) return 'default';
    const data = await u.getStorage([STORAGE_KEYS.SITE_STATES]);
    const map = (data && data[STORAGE_KEYS.SITE_STATES]) || {};
    return map[domain] || 'default';
  };

  rm.setSiteState = async function (domain, state) {
    const u = utils();
    if (!u) return;
    const data = await u.getStorage([STORAGE_KEYS.SITE_STATES]);
    const map = (data && data[STORAGE_KEYS.SITE_STATES]) || {};
    if (state === 'default' || !state) delete map[domain];
    else map[domain] = state;
    await u.setStorage({ [STORAGE_KEYS.SITE_STATES]: map });
  };
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/rule-model.test.js`
Expected: all `site-state persistence` tests PASS (plus the earlier 9 still green).

- [ ] **Step 5: Commit**

```bash
git add shared/rule-model.js tests/rule-model.test.js
TMPDIR=/tmp git commit -S -m "feat(rule-model): persist site states"
```

---

## Task 5: Frame-rule persistence + in-memory session rules

**Files:**
- Modify: `shared/rule-model.js` (append)
- Test: `tests/rule-model.test.js` (append)

- [ ] **Step 1: Append failing tests to `tests/rule-model.test.js`**

```javascript
describe('frame-rule persistence + session rules', () => {
  beforeEach(() => {
    let store = {};
    globalThis.WebSuddhi.utils = {
      getStorage: async (keys) => {
        const ks = Array.isArray(keys) ? keys : [keys];
        return Object.fromEntries(ks.map((k) => [k, store[k]]).filter(([, v]) => v !== undefined));
      },
      setStorage: async (data) => { Object.assign(store, data); }
    };
    rm.clearSessionFrameRules();
  });

  it('persists a frame rule scoped to its site and round-trips', async () => {
    await rm.setFrameRule('nytimes.com', 'doubleclick.net', 'blocked', { persist: true });
    expect(await rm.getPersistentFrameRule('nytimes.com', 'doubleclick.net')).toBe('blocked');
    expect(await rm.getPersistentFrameRule('othersite.com', 'doubleclick.net')).toBeNull();
  });

  it('persist:false keeps the rule in memory only, not in storage', async () => {
    await rm.setFrameRule('nytimes.com', 'taboola.com', 'blocked', { persist: false });
    expect(rm.getSessionFrameRule('nytimes.com', 'taboola.com')).toBe('blocked');
    expect(await rm.getPersistentFrameRule('nytimes.com', 'taboola.com')).toBeNull();
  });

  it('clearSessionFrameRules wipes session, leaves persistent intact', async () => {
    await rm.setFrameRule('a.com', 'x.com', 'blocked', { persist: true });
    await rm.setFrameRule('a.com', 'y.com', 'blocked', { persist: false });
    rm.clearSessionFrameRules();
    expect(rm.getSessionFrameRule('a.com', 'y.com')).toBeNull();
    expect(await rm.getPersistentFrameRule('a.com', 'x.com')).toBe('blocked');
  });

  it('passing null clears a persistent rule', async () => {
    await rm.setFrameRule('a.com', 'x.com', 'blocked', { persist: true });
    await rm.setFrameRule('a.com', 'x.com', null, { persist: true });
    expect(await rm.getPersistentFrameRule('a.com', 'x.com')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/rule-model.test.js`
Expected: FAIL — `rm.setFrameRule is not a function`.

- [ ] **Step 3: Append frame-rule API to `shared/rule-model.js`** (inside the IIFE, before closing `})();`)

```javascript
  const sessionFrameRules = new Map(); // `${site}|${frame}` -> 'allowed' | 'blocked'
  const sessionKey = (site, frame) => site + '|' + frame;

  rm.getSessionFrameRule = function (site, frame) {
    return sessionFrameRules.get(sessionKey(site, frame)) || null;
  };

  rm.clearSessionFrameRules = function () {
    sessionFrameRules.clear();
  };

  rm.getPersistentFrameRule = async function (site, frame) {
    const u = utils();
    if (!u) return null;
    const data = await u.getStorage([STORAGE_KEYS.FRAME_RULES]);
    const map = (data && data[STORAGE_KEYS.FRAME_RULES]) || {};
    return (map[site] && map[site][frame]) || null;
  };

  // rule: 'allowed' | 'blocked' | null (null clears). options.persist defaults true.
  rm.setFrameRule = async function (site, frame, rule, options) {
    const persist = !options || options.persist !== false;
    if (!persist) {
      if (rule === null) sessionFrameRules.delete(sessionKey(site, frame));
      else sessionFrameRules.set(sessionKey(site, frame), rule);
      return;
    }
    const u = utils();
    if (!u) return;
    const data = await u.getStorage([STORAGE_KEYS.FRAME_RULES]);
    const map = (data && data[STORAGE_KEYS.FRAME_RULES]) || {};
    if (rule === null) {
      if (map[site]) {
        delete map[site][frame];
        if (Object.keys(map[site]).length === 0) delete map[site];
      }
    } else {
      if (!map[site]) map[site] = {};
      map[site][frame] = rule;
    }
    await u.setStorage({ [STORAGE_KEYS.FRAME_RULES]: map });
  };
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/rule-model.test.js`
Expected: all `frame-rule persistence + session rules` tests PASS (everything earlier still green).

- [ ] **Step 5: Commit**

```bash
git add shared/rule-model.js tests/rule-model.test.js
TMPDIR=/tmp git commit -S -m "feat(rule-model): persisted + session frame rules"
```

---

## Task 6: Full suite green + lint

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all existing suites + `classifier.test.js` + `rule-model.test.js` PASS.

- [ ] **Step 2: Lint the new files**

Run: `npx eslint background/classifier.js shared/rule-model.js`
Expected: no errors. (Fix any style issues — match the IIFE/`'use strict'` style of `background/network-blocker.js`.)

- [ ] **Step 3: Commit any lint fixes**

```bash
git add -A
TMPDIR=/tmp git commit -S -m "chore: lint decision-core modules" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage (Plan 1 scope only):**
- Classification (category + heaviness, protected vs known-ad) → Tasks 1-2. ✓
- Aggressiveness dial behavior (conservative/balanced/aggressive) → Task 3 truth table. ✓
- Allow/block model: site state Protected/Default/Paused + frame Allowed/Blocked → Tasks 3-5. ✓
- Persist + session toggle → Task 5 (`persist` option + session map). ✓
- Protected-never-auto-blocked guardrail → Task 3 + Task 2 (`isProtected`, heuristics never set known-tracker). ✓

**Deferred to later plans (intentionally NOT in Plan 1):** in-frame measurement & census (Plan 2), DOM teardown + network rules (Plan 3), picker (Plan 4), popup (Plan 5), manifest/list-loader fetch wiring + per-site aggressiveness override storage (Plan 3/5 — the global aggressiveness getter/setter lands when the options UI needs it).

**Placeholder scan:** none — every code/test step is complete.

**Type consistency:** `resolveFrameDecision` input keys, `categorize` return shape (`{category, isProtected, isKnownAdTracker}`), and storage keys (`ws_siteStates`, `ws_frameRules`) are used identically across tasks and match the Decision Contract above.

**Note for Plan 3:** the list loader (`fetch(runtime.getURL('rules/protected.json'))` + cache) was deferred here because nothing consumes it until the registry runs; add it as the first task of the frame-engine/blocking plan so `categorize` gets fed real lists.
