# Surgical Control — Plan 2: Frame Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the content-script frame engine — every frame announces itself and measures its own weight; the background assembles a per-tab frame census, classifies + decides each frame via the Plan 1 decision core, and produces accurate per-page counts (network + cosmetic + frames) that supersede the dev-only `getMatchedRules` polling.

**Architecture:** `frame-agent.js` runs in `all_frames` at `document_start`: it builds a frame-info record (url/domain/parent/dimensions), measures its own transferred bytes (`performance` resource entries) and long-task time (`PerformanceObserver`), reports both to the background, and tears down child iframes on command (the parent owns the iframe node, so teardown is parent-side). `frame-registry.js` (background) keeps `Map<tabId, {frames, counts, cosmetic}>`, runs `classifier` + `ruleModel` to decide allow/block/flag per frame, aggregates per-tab counts, and resets on top-frame navigation. `list-loader.js` fetches + caches the JSON rule lists. Everything browser-agnostic; no `declarativeNetRequestFeedback` dependency.

**Tech Stack:** Vanilla JS IIFE modules (`self.WebSuddhi.*`), `chrome.runtime` messaging, `chrome.webNavigation`, `performance` API, vitest + jsdom.

---

## Dependencies from Plan 1 (already built & tested)

- `self.WebSuddhi.classifier.categorize(frameInfo, lists)` → `{ category, isProtected, isKnownAdTracker }`
- `self.WebSuddhi.classifier.estimateHeaviness({ bytes, longTaskMs }, budget)` → boolean
- `self.WebSuddhi.ruleModel.resolveFrameDecision({ siteState, category, isProtected, isHeavy, isKnownAdTracker, aggressiveness, persistentRule, sessionRule })` → `{ action: 'allow'|'block'|'flag', reason }`
- `self.WebSuddhi.ruleModel.getSiteState/getSessionFrameRule/getPersistentFrameRule`
- `rules/protected.json`, `rules/categories.json`

## Message Contract (lock these — Plan 3/5 depend on them)

| Direction | type | payload | notes |
|---|---|---|---|
| agent → bg | `FRAME_ANNOUNCE` | `{ frameInfo }` | `sender.tab.id` + `sender.frameId` identify the frame |
| agent → bg | `FRAME_METRICS` | `{ bytes, longTaskMs }` | periodic; identified by `sender.frameId` |
| agent → bg | `FRAME_CHILDREN` | `{ children: [{ src }] }` | parent lists its `<iframe>` srcs (sandbox fallback) |
| bg → agent | `TEARDOWN_FRAME` | `{ matchUrl }` | sent to the **parent** frameId; removes matching child iframes |
| any → bg | `GET_TAB_CENSUS` | `{ tabId }` | returns `{ frames: [...], counts }` |
| agent → bg | `REPORT_COSMETIC` | `{ count }` | per-tab cosmetic hide tally |

**`frameInfo` shape:** `{ url, domain, parentDomain, width, height }`
**`counts` shape:** `{ frames, heavy, blocked, flagged, cosmetic }`

## File Structure

| File | Responsibility |
|---|---|
| `background/list-loader.js` (new) | Fetch + cache `rules/protected.json` + `rules/categories.json`. |
| `background/frame-registry.js` (new) | Per-tab census, `classifyAndDecide`, per-tab counts, navigation reset. |
| `content/frame-agent.js` (new) | Frame-info builder, self-measurement, announce/metrics send, teardown handler. |
| `background/background.js` (modify) | New message cases; init registry; webNavigation reset; tab-removed cleanup. |
| `manifest.json` + `manifest-mv2.json` (modify) | Register `frame-agent.js` as an `all_frames` `document_start` content script; load registry/list-loader in background. |
| `tests/list-loader.test.js` (new) | Loader fetch + cache. |
| `tests/frame-registry.test.js` (new) | Census, decide, counts, reset. |
| `tests/frame-agent.test.js` (new) | Frame-info builder, measurement, teardown DOM. |

---

## Task 1: List loader (fetch + cache)

**Files:**
- Create: `background/list-loader.js`
- Test: `tests/list-loader.test.js`

- [ ] **Step 1: Write failing test `tests/list-loader.test.js`**

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('listLoader', () => {
  let loader;
  beforeEach(async () => {
    globalThis.self = globalThis;
    delete globalThis.WebSuddhi;
    globalThis.chrome = {
      runtime: { getURL: (p) => 'chrome-extension://x/' + p }
    };
    globalThis.fetch = vi.fn(async (url) => ({
      json: async () => (url.endsWith('protected.json')
        ? { 'js.stripe.com': 'payment' }
        : { 'doubleclick.net': 'ad' })
    }));
    await import('../background/list-loader.js?t=' + Math.random());
    loader = globalThis.WebSuddhi.listLoader;
  });

  it('loads and merges both lists', async () => {
    const lists = await loader.loadLists();
    expect(lists.protected['js.stripe.com']).toBe('payment');
    expect(lists.categories['doubleclick.net']).toBe('ad');
  });

  it('caches after first load (fetch not called again)', async () => {
    await loader.loadLists();
    await loader.loadLists();
    expect(globalThis.fetch).toHaveBeenCalledTimes(2); // 2 files, once total
  });

  it('getLists returns empty maps before load', () => {
    expect(loader.getLists()).toEqual({ protected: {}, categories: {} });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/list-loader.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'loadLists')`.

- [ ] **Step 3: Write `background/list-loader.js`**

```javascript
// WebSuddhi - Rule List Loader
// Fetches + caches the categorized + protected JSON lists for the classifier.
(function () {
  'use strict';
  if (!self.WebSuddhi) self.WebSuddhi = {};
  if (!self.WebSuddhi.listLoader) self.WebSuddhi.listLoader = {};
  const loader = self.WebSuddhi.listLoader;
  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

  let cache = null; // { protected, categories }
  let inflight = null;

  async function fetchJson(path) {
    try {
      const res = await fetch(api.runtime.getURL(path));
      return await res.json();
    } catch (e) {
      return {};
    }
  }

  loader.loadLists = function () {
    if (cache) return Promise.resolve(cache);
    if (inflight) return inflight;
    inflight = Promise.all([
      fetchJson('rules/protected.json'),
      fetchJson('rules/categories.json')
    ]).then(([protectedList, categories]) => {
      cache = { protected: protectedList || {}, categories: categories || {} };
      inflight = null;
      return cache;
    });
    return inflight;
  };

  loader.getLists = function () {
    return cache || { protected: {}, categories: {} };
  };

  loader._reset = function () { cache = null; inflight = null; }; // test hook
})();
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/list-loader.test.js`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add background/list-loader.js tests/list-loader.test.js
TMPDIR=/tmp git commit -S -m "feat(list-loader): fetch + cache categorized rule lists"
```

---

## Task 2: frame-registry — census ingest + classifyAndDecide

**Files:**
- Create: `background/frame-registry.js`
- Test: `tests/frame-registry.test.js`

- [ ] **Step 1: Write failing test `tests/frame-registry.test.js`**

```javascript
import { describe, it, expect, beforeEach } from 'vitest';

let reg;
const LISTS = {
  protected: { 'js.stripe.com': 'payment' },
  categories: { 'doubleclick.net': 'ad' }
};
const ctx = (over = {}) => ({
  lists: LISTS, budget: { bytes: 500 * 1024, ms: 150 },
  siteState: 'default', aggressiveness: 'balanced',
  persistentRule: null, sessionRule: null, ...over
});

beforeEach(async () => {
  globalThis.self = globalThis;
  delete globalThis.WebSuddhi;
  await import('../background/classifier.js?t=' + Math.random());
  await import('../shared/rule-model.js?t=' + Math.random());
  await import('../background/frame-registry.js?t=' + Math.random());
  reg = globalThis.WebSuddhi.frameRegistry;
  reg.clearAll();
});

describe('classifyAndDecide', () => {
  it('blocks a known ad frame', () => {
    const r = reg.classifyAndDecide({ domain: 'doubleclick.net' }, ctx());
    expect(r.category).toBe('ad');
    expect(r.isKnownAdTracker).toBe(true);
    expect(r.action).toBe('block');
  });
  it('allows a protected payment frame even when heavy+aggressive', () => {
    const r = reg.classifyAndDecide(
      { domain: 'js.stripe.com' },
      ctx({ aggressiveness: 'aggressive', metrics: { bytes: 999 * 1024, longTaskMs: 0 } })
    );
    expect(r.isProtected).toBe(true);
    expect(r.action).toBe('allow');
  });
  it('flags a heavy unknown frame at balanced', () => {
    const r = reg.classifyAndDecide(
      { domain: 'unknown.com', width: 300, height: 250 },
      ctx({ metrics: { bytes: 600 * 1024, longTaskMs: 0 } })
    );
    expect(r.isHeavy).toBe(true);
    expect(r.action).toBe('flag');
  });
});

describe('census ingest', () => {
  it('registers a frame under its tab and returns it in the census', () => {
    reg.registerFrame(7, 2, 0, { domain: 'doubleclick.net', url: 'https://doubleclick.net/a' });
    reg.recompute(7, ctx());
    const census = reg.getCensus(7);
    expect(census.frames).toHaveLength(1);
    expect(census.frames[0].domain).toBe('doubleclick.net');
    expect(census.frames[0].action).toBe('block');
  });
  it('keeps separate censuses per tab (no bleed)', () => {
    reg.registerFrame(1, 2, 0, { domain: 'doubleclick.net' });
    reg.registerFrame(2, 2, 0, { domain: 'js.stripe.com' });
    reg.recompute(1, ctx()); reg.recompute(2, ctx());
    expect(reg.getCensus(1).frames[0].domain).toBe('doubleclick.net');
    expect(reg.getCensus(2).frames[0].domain).toBe('js.stripe.com');
  });
  it('updateMetrics changes heaviness on recompute', () => {
    reg.registerFrame(7, 2, 0, { domain: 'unknown.com', width: 300, height: 250 });
    reg.updateMetrics(7, 2, { bytes: 600 * 1024, longTaskMs: 0 });
    reg.recompute(7, ctx());
    expect(reg.getCensus(7).frames[0].isHeavy).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/frame-registry.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'classifyAndDecide')`.

- [ ] **Step 3: Write `background/frame-registry.js`** (census + decide; counts added in Task 3)

```javascript
// WebSuddhi - Frame Registry
// Per-tab frame census + classify/decide via the Plan 1 decision core.
(function () {
  'use strict';
  if (!self.WebSuddhi) self.WebSuddhi = {};
  if (!self.WebSuddhi.frameRegistry) self.WebSuddhi.frameRegistry = {};
  const reg = self.WebSuddhi.frameRegistry;

  const tabs = new Map(); // tabId -> { frames: Map<frameId, record>, cosmetic: number }

  function getTab(tabId) {
    let t = tabs.get(tabId);
    if (!t) { t = { frames: new Map(), cosmetic: 0 }; tabs.set(tabId, t); }
    return t;
  }

  // Pure-ish: needs classifier + ruleModel modules loaded on self.WebSuddhi.
  reg.classifyAndDecide = function (frameInfo, ctx) {
    const classifier = self.WebSuddhi.classifier;
    const ruleModel = self.WebSuddhi.ruleModel;
    const c = classifier.categorize(frameInfo, ctx.lists);
    const isHeavy = classifier.estimateHeaviness(ctx.metrics || {}, ctx.budget);
    const decision = ruleModel.resolveFrameDecision({
      siteState: ctx.siteState,
      category: c.category,
      isProtected: c.isProtected,
      isHeavy,
      isKnownAdTracker: c.isKnownAdTracker,
      aggressiveness: ctx.aggressiveness,
      persistentRule: ctx.persistentRule,
      sessionRule: ctx.sessionRule
    });
    return {
      category: c.category, isProtected: c.isProtected, isKnownAdTracker: c.isKnownAdTracker,
      isHeavy, action: decision.action, reason: decision.reason
    };
  };

  reg.registerFrame = function (tabId, frameId, parentFrameId, frameInfo) {
    const t = getTab(tabId);
    const existing = t.frames.get(frameId) || {};
    t.frames.set(frameId, {
      frameId, parentFrameId,
      url: frameInfo.url || existing.url || '',
      domain: frameInfo.domain || existing.domain || '',
      parentDomain: frameInfo.parentDomain || existing.parentDomain || null,
      width: frameInfo.width || existing.width || 0,
      height: frameInfo.height || existing.height || 0,
      bytes: existing.bytes || 0,
      longTaskMs: existing.longTaskMs || 0
    });
  };

  reg.updateMetrics = function (tabId, frameId, metrics) {
    const t = tabs.get(tabId);
    if (!t) return;
    const rec = t.frames.get(frameId);
    if (!rec) return;
    rec.bytes = Math.max(rec.bytes || 0, Number(metrics.bytes) || 0);
    rec.longTaskMs = Math.max(rec.longTaskMs || 0, Number(metrics.longTaskMs) || 0);
  };

  // Re-run classify/decide for every frame in the tab using current metrics + ctx.
  reg.recompute = function (tabId, ctxBase) {
    const t = tabs.get(tabId);
    if (!t) return;
    for (const rec of t.frames.values()) {
      const ctx = Object.assign({}, ctxBase, { metrics: { bytes: rec.bytes, longTaskMs: rec.longTaskMs } });
      const d = reg.classifyAndDecide({ url: rec.url, domain: rec.domain, width: rec.width, height: rec.height }, ctx);
      Object.assign(rec, d);
    }
  };

  reg.getCensus = function (tabId) {
    const t = tabs.get(tabId);
    if (!t) return { frames: [], counts: { frames: 0, heavy: 0, blocked: 0, flagged: 0, cosmetic: 0 } };
    return { frames: Array.from(t.frames.values()), counts: reg.getCounts(tabId) };
  };

  reg.clearAll = function () { tabs.clear(); }; // test hook
  reg._tabs = tabs; // test/inspection hook
})();
```

- [ ] **Step 4: Run to verify it passes** (the `census ingest` "counts" field uses `getCounts` from Task 3 — add a temporary stub so this task is green on its own)

Add this stub at the end of the IIFE in `background/frame-registry.js` (replaced for real in Task 3):
```javascript
  if (!reg.getCounts) reg.getCounts = function () { return { frames: 0, heavy: 0, blocked: 0, flagged: 0, cosmetic: 0 }; };
```

Run: `npx vitest run tests/frame-registry.test.js`
Expected: `classifyAndDecide` (3) + `census ingest` (3) PASS.

- [ ] **Step 5: Commit**

```bash
git add background/frame-registry.js tests/frame-registry.test.js
TMPDIR=/tmp git commit -S -m "feat(frame-registry): per-tab census + classify/decide"
```

---

## Task 3: Per-tab counts (the per-page count requirement)

**Files:**
- Modify: `background/frame-registry.js` (replace the `getCounts` stub)
- Test: `tests/frame-registry.test.js` (append)

- [ ] **Step 1: Append failing tests to `tests/frame-registry.test.js`**

```javascript
describe('per-tab counts', () => {
  it('counts frames, heavy, blocked, flagged independently per tab', () => {
    reg.registerFrame(9, 2, 0, { domain: 'doubleclick.net' });               // blocked
    reg.registerFrame(9, 3, 0, { domain: 'unknown.com', width: 300, height: 250 });
    reg.updateMetrics(9, 3, { bytes: 600 * 1024 });                          // heavy -> flagged
    reg.registerFrame(9, 4, 0, { domain: 'js.stripe.com' });                 // allowed
    reg.recompute(9, ctx());
    const c = reg.getCounts(9);
    expect(c.frames).toBe(3);
    expect(c.blocked).toBe(1);
    expect(c.flagged).toBe(1);
    expect(c.heavy).toBe(1);
  });
  it('tracks cosmetic hides via addCosmeticCount', () => {
    reg.registerFrame(9, 2, 0, { domain: 'a.com' });
    reg.addCosmeticCount(9, 4);
    reg.addCosmeticCount(9, 3);
    expect(reg.getCounts(9).cosmetic).toBe(7);
  });
  it('returns zeroed counts for an unknown tab', () => {
    expect(reg.getCounts(999)).toEqual({ frames: 0, heavy: 0, blocked: 0, flagged: 0, cosmetic: 0 });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/frame-registry.test.js`
Expected: FAIL — `reg.addCosmeticCount is not a function` (and count assertions fail against the stub).

- [ ] **Step 3: Replace the `getCounts` stub in `background/frame-registry.js`** with the real implementation + `addCosmeticCount` (delete the stub line from Task 4-step-4, insert before `reg.clearAll`):

```javascript
  reg.getCounts = function (tabId) {
    const t = tabs.get(tabId);
    const counts = { frames: 0, heavy: 0, blocked: 0, flagged: 0, cosmetic: t ? t.cosmetic : 0 };
    if (!t) return counts;
    for (const rec of t.frames.values()) {
      counts.frames += 1;
      if (rec.isHeavy) counts.heavy += 1;
      if (rec.action === 'block') counts.blocked += 1;
      if (rec.action === 'flag') counts.flagged += 1;
    }
    return counts;
  };

  reg.addCosmeticCount = function (tabId, n) {
    const t = getTab(tabId);
    t.cosmetic += Number(n) || 0;
  };
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/frame-registry.test.js`
Expected: all `per-tab counts` (3) PASS + earlier tests still green.

- [ ] **Step 5: Commit**

```bash
git add background/frame-registry.js tests/frame-registry.test.js
TMPDIR=/tmp git commit -S -m "feat(frame-registry): per-tab counts (frames/heavy/blocked/flagged/cosmetic)"
```

---

## Task 4: Navigation reset + tab cleanup

**Files:**
- Modify: `background/frame-registry.js` (append)
- Test: `tests/frame-registry.test.js` (append)

- [ ] **Step 1: Append failing tests**

```javascript
describe('reset + cleanup', () => {
  it('resetTab clears frames + cosmetic for that tab only', () => {
    reg.registerFrame(5, 2, 0, { domain: 'doubleclick.net' });
    reg.addCosmeticCount(5, 3);
    reg.registerFrame(6, 2, 0, { domain: 'doubleclick.net' });
    reg.resetTab(5);
    expect(reg.getCounts(5)).toEqual({ frames: 0, heavy: 0, blocked: 0, flagged: 0, cosmetic: 0 });
    expect(reg.getCounts(6).frames).toBe(1);
  });
  it('removeTab drops the tab entirely', () => {
    reg.registerFrame(5, 2, 0, { domain: 'a.com' });
    reg.removeTab(5);
    expect(reg._tabs.has(5)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/frame-registry.test.js`
Expected: FAIL — `reg.resetTab is not a function`.

- [ ] **Step 3: Append to `background/frame-registry.js`** (before `reg.clearAll`)

```javascript
  reg.resetTab = function (tabId) {
    const t = tabs.get(tabId);
    if (t) { t.frames.clear(); t.cosmetic = 0; }
  };

  reg.removeTab = function (tabId) { tabs.delete(tabId); };
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/frame-registry.test.js`
Expected: all `reset + cleanup` (2) PASS.

- [ ] **Step 5: Commit**

```bash
git add background/frame-registry.js tests/frame-registry.test.js
TMPDIR=/tmp git commit -S -m "feat(frame-registry): navigation reset + tab cleanup"
```

---

## Task 5: frame-agent — frame-info builder

**Files:**
- Create: `content/frame-agent.js`
- Test: `tests/frame-agent.test.js`

- [ ] **Step 1: Write failing test `tests/frame-agent.test.js`**

```javascript
import { describe, it, expect, beforeEach } from 'vitest';

let agent;
beforeEach(async () => {
  globalThis.self = globalThis;
  delete globalThis.WebSuddhi;
  await import('../content/frame-agent.js?t=' + Math.random());
  agent = globalThis.WebSuddhi.frameAgent;
});

describe('buildFrameInfo', () => {
  it('extracts domain from a location-like object', () => {
    const info = agent.buildFrameInfo({
      location: { href: 'https://ads.doubleclick.net/x?y=1', hostname: 'ads.doubleclick.net' },
      innerWidth: 300, innerHeight: 250, ancestorOrigins: ['https://nytimes.com'], referrer: ''
    });
    expect(info.domain).toBe('ads.doubleclick.net');
    expect(info.url).toBe('https://ads.doubleclick.net/x?y=1');
    expect(info.width).toBe(300);
    expect(info.height).toBe(250);
    expect(info.parentDomain).toBe('nytimes.com');
  });

  it('falls back to referrer host when ancestorOrigins is missing', () => {
    const info = agent.buildFrameInfo({
      location: { href: 'https://x.com/', hostname: 'x.com' },
      innerWidth: 0, innerHeight: 0, ancestorOrigins: undefined, referrer: 'https://blog.example.com/post'
    });
    expect(info.parentDomain).toBe('blog.example.com');
  });

  it('parentDomain is null for the top frame (no ancestors, no referrer)', () => {
    const info = agent.buildFrameInfo({
      location: { href: 'https://top.com/', hostname: 'top.com' },
      innerWidth: 1000, innerHeight: 800, ancestorOrigins: [], referrer: ''
    });
    expect(info.parentDomain).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/frame-agent.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'buildFrameInfo')`.

- [ ] **Step 3: Write `content/frame-agent.js`** (info builder first; measurement + send + teardown in Tasks 6-7)

```javascript
// WebSuddhi - Frame Agent
// Runs in every frame: identity announce, self-measurement, teardown of child iframes.
(function () {
  'use strict';
  if (!self.WebSuddhi) self.WebSuddhi = {};
  if (!self.WebSuddhi.frameAgent) self.WebSuddhi.frameAgent = {};
  const agent = self.WebSuddhi.frameAgent;

  function hostFromUrl(u) {
    try { return new URL(u).hostname.toLowerCase(); } catch (e) { return null; }
  }

  // win: a window-like object (real `window` in production, a stub in tests).
  agent.buildFrameInfo = function (win) {
    const loc = win.location || {};
    let parentDomain = null;
    const ancestors = win.ancestorOrigins;
    if (ancestors && ancestors.length > 0) {
      parentDomain = hostFromUrl(ancestors[0]) || (ancestors.length ? hostFromUrl(ancestors[ancestors.length - 1]) : null);
    } else if (win.referrer) {
      parentDomain = hostFromUrl(win.referrer);
    }
    return {
      url: loc.href || '',
      domain: (loc.hostname || '').toLowerCase(),
      parentDomain: parentDomain || null,
      width: Number(win.innerWidth) || 0,
      height: Number(win.innerHeight) || 0
    };
  };
})();
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/frame-agent.test.js`
Expected: `buildFrameInfo` (3) PASS.

- [ ] **Step 5: Commit**

```bash
git add content/frame-agent.js tests/frame-agent.test.js
TMPDIR=/tmp git commit -S -m "feat(frame-agent): frame-info builder"
```

---

## Task 6: frame-agent — self-measurement

**Files:**
- Modify: `content/frame-agent.js` (append)
- Test: `tests/frame-agent.test.js` (append)

- [ ] **Step 1: Append failing tests**

```javascript
describe('measureBytes', () => {
  it('sums transferSize across resource entries', () => {
    const perf = { getEntriesByType: (t) => t === 'resource'
      ? [{ transferSize: 1000 }, { transferSize: 2500 }, { transferSize: 0 }] : [] };
    expect(agent.measureBytes(perf)).toBe(3500);
  });
  it('returns 0 when performance is unavailable', () => {
    expect(agent.measureBytes(null)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/frame-agent.test.js`
Expected: FAIL — `agent.measureBytes is not a function`.

- [ ] **Step 3: Append to `content/frame-agent.js`** (before closing `})();`)

```javascript
  // Sum transferred bytes from the Resource Timing entries (read from inside the
  // frame, so cross-origin Timing-Allow-Origin restrictions are sidestepped).
  agent.measureBytes = function (perf) {
    if (!perf || typeof perf.getEntriesByType !== 'function') return 0;
    let total = 0;
    for (const e of perf.getEntriesByType('resource')) total += Number(e.transferSize) || 0;
    return total;
  };

  // Long-task accumulator wired by startMeasuring(); held here so reports can read it.
  let longTaskMs = 0;
  agent.getLongTaskMs = function () { return longTaskMs; };
  agent._addLongTask = function (ms) { longTaskMs += Number(ms) || 0; }; // used by observer + tests

  agent.startMeasuring = function (win) {
    const w = win || self;
    if (typeof w.PerformanceObserver !== 'function') return null;
    try {
      const obs = new w.PerformanceObserver((list) => {
        for (const entry of list.getEntries()) agent._addLongTask(entry.duration);
      });
      obs.observe({ entryTypes: ['longtask'] });
      return obs;
    } catch (e) {
      return null;
    }
  };
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/frame-agent.test.js`
Expected: `measureBytes` (2) PASS.

- [ ] **Step 5: Commit**

```bash
git add content/frame-agent.js tests/frame-agent.test.js
TMPDIR=/tmp git commit -S -m "feat(frame-agent): byte + long-task self-measurement"
```

---

## Task 7: frame-agent — child-iframe teardown

**Files:**
- Modify: `content/frame-agent.js` (append)
- Test: `tests/frame-agent.test.js` (append)

- [ ] **Step 1: Append failing tests** (jsdom provides `document`)

```javascript
describe('teardownChildFrames', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('removes iframes whose src matches and returns the count removed', () => {
    document.body.innerHTML =
      '<iframe src="https://doubleclick.net/ad1"></iframe>' +
      '<iframe src="https://doubleclick.net/ad2"></iframe>' +
      '<iframe src="https://youtube.com/embed/x"></iframe>';
    const removed = agent.teardownChildFrames(document, 'doubleclick.net');
    expect(removed).toBe(2);
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    expect(document.querySelector('iframe').src).toContain('youtube.com');
  });

  it('returns 0 when nothing matches', () => {
    document.body.innerHTML = '<iframe src="https://safe.com/x"></iframe>';
    expect(agent.teardownChildFrames(document, 'doubleclick.net')).toBe(0);
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/frame-agent.test.js`
Expected: FAIL — `agent.teardownChildFrames is not a function`.

- [ ] **Step 3: Append to `content/frame-agent.js`** (before closing `})();`)

```javascript
  // Remove child <iframe> nodes whose src contains matchUrl. Runs in the PARENT
  // frame (it owns the iframe element); tearing down the node kills the frame's
  // process, reclaiming RAM/CPU. Returns the number removed.
  agent.teardownChildFrames = function (doc, matchUrl) {
    if (!doc || !matchUrl) return 0;
    let removed = 0;
    const frames = doc.querySelectorAll('iframe');
    for (const f of frames) {
      const src = f.getAttribute('src') || f.src || '';
      if (src.indexOf(matchUrl) !== -1) { f.remove(); removed += 1; }
    }
    return removed;
  };
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/frame-agent.test.js`
Expected: `teardownChildFrames` (2) PASS.

- [ ] **Step 5: Commit**

```bash
git add content/frame-agent.js tests/frame-agent.test.js
TMPDIR=/tmp git commit -S -m "feat(frame-agent): child-iframe teardown"
```

---

## Task 8: Wire-up — runtime glue (manifest + background + agent runtime)

This task connects the tested units to the live extension. The pure logic is already covered; here we add the thin runtime layer and a message-contract test.

**Files:**
- Modify: `content/frame-agent.js` (append runtime bootstrap)
- Modify: `background/background.js` (message cases + init + nav reset + tab cleanup)
- Modify: `manifest.json`, `manifest-mv2.json`
- Test: `tests/message-contracts.test.js` (append)

- [ ] **Step 1: Append runtime bootstrap to `content/frame-agent.js`** (before closing `})();`)

```javascript
  // ---- Runtime bootstrap (skipped in tests where there's no chrome.runtime) ----
  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser
            : (typeof chrome !== 'undefined' && chrome.runtime) ? chrome : null;

  function send(msg) {
    if (!api) return;
    try { api.runtime.sendMessage(msg, () => void (api.runtime.lastError)); } catch (e) { /* frame torn down */ }
  }

  agent.start = function () {
    if (!api || typeof window === 'undefined') return;
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return;

    send({ type: 'FRAME_ANNOUNCE', frameInfo: agent.buildFrameInfo(window) });

    // Parent enumerates its child iframes for the sandbox/no-script fallback.
    if (document && document.querySelectorAll) {
      const children = Array.from(document.querySelectorAll('iframe'))
        .map((f) => ({ src: f.getAttribute('src') || f.src || '' }))
        .filter((c) => c.src);
      if (children.length) send({ type: 'FRAME_CHILDREN', children });
    }

    agent.startMeasuring(window);
    // Report metrics at settle points rather than polling continuously.
    const report = () => send({ type: 'FRAME_METRICS', bytes: agent.measureBytes(window.performance), longTaskMs: agent.getLongTaskMs() });
    setTimeout(report, 1500);
    setTimeout(report, 5000);

    api.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === 'TEARDOWN_FRAME') agent.teardownChildFrames(document, msg.matchUrl);
    });
  };

  if (api && typeof window !== 'undefined' && !self.__WS_FRAME_AGENT_TEST__) {
    agent.start();
  }
})();
```

- [ ] **Step 2: Add message cases to `background/background.js`** inside the `handleMessage` switch (after the `GET_BLOCKED_COUNT` case)

```javascript
        // Frame engine (Plan 2)
        case 'FRAME_ANNOUNCE':
          if (self.WebSuddhi.frameRegistry && sender.tab) {
            self.WebSuddhi.frameRegistry.registerFrame(
              sender.tab.id, sender.frameId, sender.frameId === 0 ? -1 : 0, message.frameInfo || {}
            );
            await recomputeTab(sender.tab.id);
          }
          return { success: true };

        case 'FRAME_METRICS':
          if (self.WebSuddhi.frameRegistry && sender.tab) {
            self.WebSuddhi.frameRegistry.updateMetrics(sender.tab.id, sender.frameId, message);
            await recomputeTab(sender.tab.id);
          }
          return { success: true };

        case 'FRAME_CHILDREN':
          return { success: true }; // recorded opportunistically; full sandbox-fallback in a later plan

        case 'REPORT_COSMETIC':
          if (self.WebSuddhi.frameRegistry && sender.tab) {
            self.WebSuddhi.frameRegistry.addCosmeticCount(sender.tab.id, message.count || 0);
          }
          return { success: true };

        case 'GET_TAB_CENSUS':
          if (self.WebSuddhi.frameRegistry) {
            return { success: true, census: self.WebSuddhi.frameRegistry.getCensus(message.tabId) };
          }
          return { success: true, census: { frames: [], counts: { frames: 0, heavy: 0, blocked: 0, flagged: 0, cosmetic: 0 } } };
```

- [ ] **Step 3: Add the `recomputeTab` helper to `background/background.js`** (near `incrementStats`, top-level inside the IIFE)

```javascript
  async function recomputeTab(tabId) {
    const reg = self.WebSuddhi.frameRegistry;
    const ruleModel = self.WebSuddhi.ruleModel;
    const loader = self.WebSuddhi.listLoader;
    if (!reg || !ruleModel || !loader) return;
    let hostname = '';
    try { const tab = await api.tabs.get(tabId); hostname = new URL(tab.url).hostname; } catch (e) { /* tab gone */ }
    const settings = await getStorage(['aggressiveness']);
    const ctx = {
      lists: await loader.loadLists(),
      budget: { bytes: 500 * 1024, ms: 150 },
      siteState: hostname ? await ruleModel.getSiteState(hostname) : 'default',
      aggressiveness: settings.aggressiveness || 'balanced',
      persistentRule: null,
      sessionRule: null
    };
    reg.recompute(tabId, ctx);
  }
```

- [ ] **Step 4: Add navigation reset + tab cleanup + init to `background/background.js`** (in the init/listener setup region)

```javascript
  // Reset the per-tab census on top-frame navigation (per-page counts).
  if (api.webNavigation && api.webNavigation.onCommitted) {
    api.webNavigation.onCommitted.addListener((details) => {
      if (details.frameId === 0 && self.WebSuddhi.frameRegistry) {
        self.WebSuddhi.frameRegistry.resetTab(details.tabId);
      }
    });
  }
  if (api.tabs && api.tabs.onRemoved) {
    api.tabs.onRemoved.addListener((tabId) => {
      if (self.WebSuddhi.frameRegistry) self.WebSuddhi.frameRegistry.removeTab(tabId);
    });
  }
  // Warm the list cache so the first FRAME_ANNOUNCE classifies correctly.
  if (self.WebSuddhi.listLoader) self.WebSuddhi.listLoader.loadLists();
```

- [ ] **Step 5: Register scripts in `manifest.json`** — add `frame-agent.js` to the existing `all_frames` content-script entry's `js` array (after `content/ad-blocker.js`), and load the new background modules.

In the `content_scripts` entry with `"all_frames": true`:
```json
      "js": ["shared/utils.js", "content/ad-blocker.js", "content/frame-agent.js"],
```

MV3 loads background modules via `importScripts` in `background/background.js` (confirmed: bare filenames for same-dir `background/` modules, `'../shared/...'` for shared; no bundler — `rollup.config.js` only builds `src/content/index.js`). Edit the existing `importScripts(` block (currently lists `'../shared/utils.js'`, `'network-blocker.js'`, … `'phishing-detector.js'`) to add the four new modules **in dependency order** (classifier + rule-model before frame-registry):

```javascript
    importScripts(
      '../shared/utils.js',
      '../shared/rule-model.js',
      'classifier.js',
      'list-loader.js',
      'network-blocker.js',
      'url-cleaner.js',
      'stats-manager.js',
      'privacy.js',
      'filter-lists.js',
      'phishing-detector.js',
      'frame-registry.js'
    );
```

- [ ] **Step 6: Register scripts in `manifest-mv2.json`** — mirror Step 5 for the MV2 manifest: add `content/frame-agent.js` to the `all_frames` content script `js` array, and add the new background scripts to the MV2 `background.scripts` array (`classifier.js`, `list-loader.js`, `frame-registry.js`, `shared/rule-model.js`) in dependency order (classifier + rule-model before frame-registry).

- [ ] **Step 7: Append a message-contract test to `tests/message-contracts.test.js`**

Read the top of `tests/message-contracts.test.js` first to match its existing harness (it loads `background/background.js` source and inspects handled message types). Append a test asserting the new message types are handled:

```javascript
describe('frame-engine message contracts', () => {
  it('background source handles the new frame-engine message types', () => {
    const src = readFixture('background/background.js'); // use the file's existing fixture reader
    for (const type of ['FRAME_ANNOUNCE', 'FRAME_METRICS', 'FRAME_CHILDREN', 'REPORT_COSMETIC', 'GET_TAB_CENSUS']) {
      expect(src).toContain("'" + type + "'");
    }
  });
});
```
(If `message-contracts.test.js` uses a different fixture-reading helper or assertion style, match it — the assertion is simply "these `case` labels exist in the background source".)

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: all new suites pass; `message-contracts` passes; the 3 pre-existing `utils.test.js` storage timeouts remain (tracked separately, not introduced here).

- [ ] **Step 9: Lint**

Run: `npx eslint background/list-loader.js background/frame-registry.js content/frame-agent.js`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add content/frame-agent.js background/background.js background/frame-registry.js manifest.json manifest-mv2.json tests/message-contracts.test.js
TMPDIR=/tmp git commit -S -m "feat(frame-engine): wire agent + registry into background + manifests"
```

---

## Self-Review

**Spec coverage (Plan 2 scope):**
- Content-script engine (announce + in-frame measurement) → Tasks 5, 6, 8. ✓
- Per-tab frame census + classify/decide via decision core → Tasks 2, 3. ✓
- DOM teardown of child frames → Task 7 (+ TEARDOWN_FRAME handler in Task 8). ✓
- Per-page counts replacing getMatchedRules polling + lighting up cosmetic → Task 3 (`getCounts`, `addCosmeticCount`) + Task 8 (`REPORT_COSMETIC`, `GET_TAB_CENSUS`, nav reset). ✓
- Cross-browser via in-frame measurement → frame-agent reads `window.performance` from inside each frame (Task 6); manifests cover MV3 + MV2 (Tasks 5-6 of wire-up). ✓
- Sandbox/no-script fallback → `FRAME_CHILDREN` enumeration plumbed (Task 8); full coarse-estimate scoring deferred (noted below). 

**Deferred (NOT in Plan 2, by design):**
- Actually applying network rules / DOM teardown commands from a *user* action (Plan 3 — blocking + cross-browser; this plan only computes decisions + can tear down on command).
- Persisted/session frame rules feeding `recomputeTab` per-frame (wired as `null` placeholders in Task 8 `ctx`; Plan 3 threads real per-frame rules in once the block-action UI exists).
- Coarse parent-side heaviness estimate for non-announcing sandboxed frames (FRAME_CHILDREN is plumbed; scoring lands in Plan 3).
- Popup rendering of census/counts (Plan 5).

**Placeholder scan:** the only intentional placeholders are `persistentRule: null, sessionRule: null` in Task 8's `ctx` — explicitly called out above as Plan 3 work, not a gap. Task 5/6 of wire-up reference reading the existing `importScripts`/fixture style before editing — that's a real instruction, not a vague placeholder.

**Type consistency:** `frameInfo` `{url, domain, parentDomain, width, height}`, `counts` `{frames, heavy, blocked, flagged, cosmetic}`, and registry method names (`registerFrame`, `updateMetrics`, `recompute`, `getCensus`, `getCounts`, `addCosmeticCount`, `resetTab`, `removeTab`, `clearAll`) are used identically across Tasks 2-8 and match the Message Contract table. `classifyAndDecide` consumes the exact Plan 1 `classifier`/`ruleModel` signatures.

**Resolved (was a risk):** `background.js` loads modules via `importScripts` with bare same-dir filenames + `'../shared/...'` (verified; no bundler involved — `rollup.config.js` only builds `src/content/index.js`). Task 8 Step 5 now gives the exact edited `importScripts` block. The only step that still requires reading-before-editing is the message-contracts test (Step 7) — match its existing fixture-reader/assertion style.
