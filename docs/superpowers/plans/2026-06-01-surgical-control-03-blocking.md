# Surgical Control — Plan 3: Blocking & Cross-Browser Application

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the census *act* — tear down frames decided `block`, prevent them reloading via network rules, and thread per-site persisted/session frame rules into every recompute so an "allow" survives navigation (the "allow outlook.office.com once" requirement).

**Architecture:** A new `frame-blocker.js` applies census decisions: it broadcasts `TEARDOWN_FRAME` to the tab (every browser, instant kill via DOM removal) and, for persisted blocks, manages DNR dynamic rules in a fresh id range (Chrome/Edge). `recomputeTab` now pre-fetches the site's frame rules (persisted + session) and passes them per-frame, so decisions honour the user's allow/block. A `SET_FRAME_RULE` message (which Plan 5's popup buttons call) writes the rule **scoped to the current top-site, persisted by default**, then recomputes + applies. Protected frames are never torn down (seatbelt enforced at apply time).

**Tech Stack:** Vanilla JS IIFE modules (`self.WebSuddhi.*`), `chrome.declarativeNetRequest` dynamic rules (MV3), `chrome.webRequest` (MV2), `chrome.tabs.sendMessage` broadcast, vitest + jsdom.

---

## Dependencies from Plans 1-2 (built & tested)

- `ruleModel.resolveFrameDecision`, `getSiteState`, `getPersistentFrameRule(site, frame)`, `getSessionFrameRule(site, frame)`, `setFrameRule(site, frame, rule, {persist})`, `STORAGE_KEYS.FRAME_RULES`
- `frameRegistry.registerFrame/updateMetrics/recompute/getCensus/getCounts/resetTab`, `classifyAndDecide(frameInfo, ctx)` where ctx already reads `persistentRule`/`sessionRule`
- `frameAgent.teardownChildFrames(doc, matchUrl)` + the runtime `TEARDOWN_FRAME` listener (already shipped)
- `background.js`: `recomputeTab(tabId)` (ctx currently hardcodes `persistentRule: null, sessionRule: null`), message switch, `importScripts`
- `network-blocker.js`: DNR dynamic rules id range **20001-29999**; filter-lists uses **40001-69999**

## Decisions locked

- **Allow/block scope:** **this top-site, persisted** by default. Rule key = `(normalizeHostname(topHost, stripWww=true), frameDomain)`.
- **Frame-block DNR id range:** **70001-79999** (distinct from 20001-29999 network and 40001-69999 filter).
- **Cross-browser:** DOM teardown = universal instant kill. Network prevention: MV3 dynamic rules (Chrome/Edge); MV2 webRequest via existing `blockedDomains` path (Firefox); Safari/iOS degrade to teardown-now + (persisted) static-recompile-next-load — documented, not coded here.

## Message Contract (Plan 5 popup will call these)

| type | payload | effect |
|---|---|---|
| `SET_FRAME_RULE` | `{ tabId, frameDomain, rule: 'blocked'\|'allowed'\|null, persist?: boolean }` | write rule scoped to tab's top-site, recompute + apply, return `{ census }` |

## File Structure

| File | Responsibility |
|---|---|
| `background/frame-blocker.js` (new) | Apply census decisions: which frames to tear down, broadcast teardown, build/add/remove frame DNR rules. |
| `shared/rule-model.js` (modify) | Add `getFrameRulesForSite(site)` + `getSessionFrameRulesForSite(site)`. |
| `background/frame-registry.js` (modify) | `recompute` threads per-frame rules from `ctx.frameRules`. |
| `background/background.js` (modify) | `recomputeTab` pre-fetches frame rules + applies; `SET_FRAME_RULE` handler; resolve top-site; importScripts. |
| `manifest.json` / `manifest-mv2.json` (modify) | Register `frame-blocker.js` in the background. |
| `tests/frame-blocker.test.js` (new) | Pure decision-application + rule builder. |
| `tests/rule-model.test.js` / `tests/frame-registry.test.js` / `tests/message-contracts.test.js` (append) | New behaviour. |

---

## Task 1: ruleModel — read all frame rules for a site

**Files:**
- Modify: `shared/rule-model.js` (append)
- Test: `tests/rule-model.test.js` (append)

- [ ] **Step 1: Append failing tests to `tests/rule-model.test.js`**

```javascript
describe('frame rules for a site (bulk read)', () => {
  beforeEach(() => {
    const store = {};
    globalThis.WebSuddhi.utils = {
      getStorage: async (keys) => {
        const ks = Array.isArray(keys) ? keys : [keys];
        return Object.fromEntries(ks.map((k) => [k, store[k]]).filter(([, v]) => v !== undefined));
      },
      setStorage: async (data) => { Object.assign(store, data); }
    };
    rm.clearSessionFrameRules();
  });

  it('getFrameRulesForSite returns the persisted map for that site only', async () => {
    await rm.setFrameRule('office.com', 'outlook.office.com', 'allowed', { persist: true });
    await rm.setFrameRule('office.com', 'doubleclick.net', 'blocked', { persist: true });
    await rm.setFrameRule('other.com', 'x.com', 'blocked', { persist: true });
    const map = await rm.getFrameRulesForSite('office.com');
    expect(map).toEqual({ 'outlook.office.com': 'allowed', 'doubleclick.net': 'blocked' });
    expect(await rm.getFrameRulesForSite('nope.com')).toEqual({});
  });

  it('getSessionFrameRulesForSite returns only that site\'s session rules', async () => {
    await rm.setFrameRule('office.com', 'a.com', 'allowed', { persist: false });
    await rm.setFrameRule('office.com', 'b.com', 'blocked', { persist: false });
    await rm.setFrameRule('other.com', 'c.com', 'blocked', { persist: false });
    expect(rm.getSessionFrameRulesForSite('office.com')).toEqual({ 'a.com': 'allowed', 'b.com': 'blocked' });
    expect(rm.getSessionFrameRulesForSite('zzz.com')).toEqual({});
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/rule-model.test.js`
Expected: FAIL — `rm.getFrameRulesForSite is not a function`.

- [ ] **Step 3: Append to `shared/rule-model.js`** (before the closing `})();`)

```javascript
  rm.getFrameRulesForSite = async function (site) {
    const u = utils();
    if (!u) return {};
    const data = await u.getStorage([STORAGE_KEYS.FRAME_RULES]);
    const map = (data && data[STORAGE_KEYS.FRAME_RULES]) || {};
    return Object.assign({}, map[site] || {});
  };

  rm.getSessionFrameRulesForSite = function (site) {
    const out = {};
    const prefix = site + '|';
    for (const [key, rule] of sessionFrameRules.entries()) {
      if (key.indexOf(prefix) === 0) out[key.slice(prefix.length)] = rule;
    }
    return out;
  };
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/rule-model.test.js`
Expected: both new tests PASS, all earlier green.

- [ ] **Step 5: Commit**

```bash
git add shared/rule-model.js tests/rule-model.test.js
TMPDIR=/tmp git commit -S -m "feat(rule-model): bulk read frame rules for a site"
```

---

## Task 2: frameRegistry.recompute threads per-frame rules

**Files:**
- Modify: `background/frame-registry.js` (the `recompute` function)
- Test: `tests/frame-registry.test.js` (append)

- [ ] **Step 1: Append failing tests to `tests/frame-registry.test.js`**

```javascript
describe('recompute honours per-frame rules', () => {
  it('a persisted "allowed" rule keeps a known ad frame allowed (survives recompute)', () => {
    reg.registerFrame(11, 2, 0, { domain: 'doubleclick.net' });
    reg.recompute(11, ctx({ frameRules: { 'doubleclick.net': { persistentRule: 'allowed' } } }));
    expect(reg.getCensus(11).frames[0].action).toBe('allow');
  });
  it('a session "blocked" rule blocks an otherwise-allowed frame', () => {
    reg.registerFrame(11, 2, 0, { domain: 'random-unknown.com', width: 300, height: 250 });
    reg.recompute(11, ctx({ frameRules: { 'random-unknown.com': { sessionRule: 'blocked' } } }));
    expect(reg.getCensus(11).frames[0].action).toBe('block');
  });
  it('frames with no rule fall through to the default decision', () => {
    reg.registerFrame(11, 2, 0, { domain: 'doubleclick.net' });
    reg.recompute(11, ctx({ frameRules: {} }));
    expect(reg.getCensus(11).frames[0].action).toBe('block'); // known ad
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/frame-registry.test.js`
Expected: FAIL — the persisted-allowed frame is still `block` (rules not threaded yet).

- [ ] **Step 3: Edit `reg.recompute` in `background/frame-registry.js`** — replace the existing function body with the rule-threaded version:

```javascript
  // Re-run classify/decide for every frame in the tab using current metrics + ctx.
  // ctxBase.frameRules (optional): { [frameDomain]: { persistentRule, sessionRule } }
  reg.recompute = function (tabId, ctxBase) {
    const t = tabs.get(tabId);
    if (!t) return;
    const frameRules = (ctxBase && ctxBase.frameRules) || {};
    for (const rec of t.frames.values()) {
      const fr = frameRules[rec.domain] || {};
      const ctx = Object.assign({}, ctxBase, {
        metrics: { bytes: rec.bytes, longTaskMs: rec.longTaskMs },
        persistentRule: fr.persistentRule || null,
        sessionRule: fr.sessionRule || null
      });
      const d = reg.classifyAndDecide({ url: rec.url, domain: rec.domain, width: rec.width, height: rec.height }, ctx);
      Object.assign(rec, d);
    }
  };
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/frame-registry.test.js`
Expected: all 3 new tests PASS; existing registry tests still green (they pass no `frameRules`, so behaviour is unchanged).

- [ ] **Step 5: Commit**

```bash
git add background/frame-registry.js tests/frame-registry.test.js
TMPDIR=/tmp git commit -S -m "feat(frame-registry): thread per-frame persisted/session rules into recompute"
```

---

## Task 3: frame-blocker — which frames to tear down + DNR rule builder

**Files:**
- Create: `background/frame-blocker.js`
- Test: `tests/frame-blocker.test.js`

- [ ] **Step 1: Write failing test `tests/frame-blocker.test.js`**

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';

let fb;
beforeEach(async () => {
  globalThis.self = globalThis;
  delete globalThis.WebSuddhi;
  globalThis.chrome = { runtime: {} };
  await import('../background/frame-blocker.js?t=' + Math.random());
  fb = globalThis.WebSuddhi.frameBlocker;
});

const census = (frames) => ({ frames, counts: {} });

describe('framesToTearDown', () => {
  it('returns frames decided block, excluding protected ones (seatbelt)', () => {
    const out = fb.framesToTearDown(census([
      { domain: 'doubleclick.net', url: 'https://doubleclick.net/a', action: 'block', isProtected: false },
      { domain: 'js.stripe.com', url: 'https://js.stripe.com/x', action: 'block', isProtected: true },  // seatbelt
      { domain: 'youtube.com', url: 'https://youtube.com/e', action: 'allow', isProtected: false }
    ]));
    expect(out.map((f) => f.domain)).toEqual(['doubleclick.net']);
  });
  it('returns [] for an empty census', () => {
    expect(fb.framesToTearDown(census([]))).toEqual([]);
  });
});

describe('buildFrameBlockRule', () => {
  it('builds a sub_frame block rule for a domain in the frame id range', () => {
    const rule = fb.buildFrameBlockRule(70001, 'doubleclick.net');
    expect(rule).toEqual({
      id: 70001,
      priority: 1,
      action: { type: 'block' },
      condition: { urlFilter: '||doubleclick.net', resourceTypes: ['sub_frame'] }
    });
  });
  it('exposes a frame id range distinct from network (20001-29999) and filter (40001-69999)', () => {
    expect(fb.FRAME_RULE_ID_START).toBe(70001);
    expect(fb.FRAME_RULE_ID_END).toBe(79999);
  });
});

describe('tearDown', () => {
  it('broadcasts TEARDOWN_FRAME to the whole tab (no frameId)', () => {
    const sendMessage = vi.fn();
    const api = { tabs: { sendMessage } };
    fb.tearDown(api, 42, 'doubleclick.net');
    expect(sendMessage).toHaveBeenCalledWith(42, { type: 'TEARDOWN_FRAME', matchUrl: 'doubleclick.net' }, expect.any(Function));
  });
});

describe('applyTab', () => {
  it('tears down every block-decided non-protected frame', () => {
    const sendMessage = vi.fn();
    const api = { tabs: { sendMessage } };
    fb.applyTab(api, 42, census([
      { domain: 'doubleclick.net', url: 'https://doubleclick.net/a', action: 'block', isProtected: false },
      { domain: 'taboola.com', url: 'https://taboola.com/b', action: 'block', isProtected: false },
      { domain: 'js.stripe.com', url: 'https://js.stripe.com/x', action: 'block', isProtected: true }
    ]));
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage.mock.calls.map((c) => c[1].matchUrl)).toEqual(['doubleclick.net', 'taboola.com']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/frame-blocker.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'framesToTearDown')`.

- [ ] **Step 3: Write `background/frame-blocker.js`**

```javascript
// WebSuddhi - Frame Blocker
// Applies census decisions: tear down blocked frames + manage frame network rules.
(function () {
  'use strict';
  if (!self.WebSuddhi) self.WebSuddhi = {};
  if (!self.WebSuddhi.frameBlocker) self.WebSuddhi.frameBlocker = {};
  const fb = self.WebSuddhi.frameBlocker;

  // Distinct from network-blocker (20001-29999) and filter-lists (40001-69999).
  fb.FRAME_RULE_ID_START = 70001;
  fb.FRAME_RULE_ID_END = 79999;

  // Pure: frames the census decided to block, minus protected (seatbelt).
  fb.framesToTearDown = function (census) {
    if (!census || !Array.isArray(census.frames)) return [];
    return census.frames.filter((f) => f.action === 'block' && !f.isProtected);
  };

  // Pure: a declarativeNetRequest sub_frame block rule for a domain.
  fb.buildFrameBlockRule = function (id, domain) {
    return {
      id,
      priority: 1,
      action: { type: 'block' },
      condition: { urlFilter: '||' + domain, resourceTypes: ['sub_frame'] }
    };
  };

  // Broadcast a teardown command to every frame in the tab; the parent frame
  // that owns the matching <iframe> removes it (instant kill, every browser).
  fb.tearDown = function (api, tabId, matchUrl) {
    if (!api || !api.tabs || !api.tabs.sendMessage) return;
    try {
      api.tabs.sendMessage(tabId, { type: 'TEARDOWN_FRAME', matchUrl }, () => void (api.runtime && api.runtime.lastError));
    } catch (e) { /* tab gone */ }
  };

  // Tear down every block-decided non-protected frame in a census.
  fb.applyTab = function (api, tabId, census) {
    const targets = fb.framesToTearDown(census);
    for (const f of targets) fb.tearDown(api, tabId, f.url || f.domain);
    return targets.length;
  };
})();
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/frame-blocker.test.js`
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add background/frame-blocker.js tests/frame-blocker.test.js
TMPDIR=/tmp git commit -S -m "feat(frame-blocker): teardown application + sub_frame DNR rule builder"
```

---

## Task 4: frame-blocker — persisted network rules (MV3 dynamic)

**Files:**
- Modify: `background/frame-blocker.js` (append)
- Test: `tests/frame-blocker.test.js` (append)

- [ ] **Step 1: Append failing tests**

```javascript
describe('network block rules (MV3 dynamic)', () => {
  function dnrMock() {
    let rules = [];
    return {
      getDynamicRules: vi.fn(async () => rules),
      updateDynamicRules: vi.fn(async ({ removeRuleIds = [], addRules = [] }) => {
        rules = rules.filter((r) => !removeRuleIds.includes(r.id)).concat(addRules);
      }),
      _rules: () => rules
    };
  }

  it('addNetworkBlock adds a sub_frame rule for the domain in the frame id range', async () => {
    const dnr = dnrMock();
    const api = { declarativeNetRequest: dnr };
    await fb.addNetworkBlock(api, 'doubleclick.net');
    const added = dnr._rules();
    expect(added).toHaveLength(1);
    expect(added[0].id).toBeGreaterThanOrEqual(fb.FRAME_RULE_ID_START);
    expect(added[0].condition.urlFilter).toBe('||doubleclick.net');
    expect(added[0].condition.resourceTypes).toEqual(['sub_frame']);
  });

  it('addNetworkBlock is idempotent (no duplicate rule for same domain)', async () => {
    const dnr = dnrMock();
    const api = { declarativeNetRequest: dnr };
    await fb.addNetworkBlock(api, 'doubleclick.net');
    await fb.addNetworkBlock(api, 'doubleclick.net');
    expect(dnr._rules()).toHaveLength(1);
  });

  it('removeNetworkBlock drops the rule for that domain only', async () => {
    const dnr = dnrMock();
    const api = { declarativeNetRequest: dnr };
    await fb.addNetworkBlock(api, 'doubleclick.net');
    await fb.addNetworkBlock(api, 'taboola.com');
    await fb.removeNetworkBlock(api, 'doubleclick.net');
    const left = dnr._rules();
    expect(left).toHaveLength(1);
    expect(left[0].condition.urlFilter).toBe('||taboola.com');
  });

  it('addNetworkBlock is a no-op when declarativeNetRequest is absent (MV2/Safari)', async () => {
    await expect(fb.addNetworkBlock({}, 'x.com')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/frame-blocker.test.js`
Expected: FAIL — `fb.addNetworkBlock is not a function`.

- [ ] **Step 3: Append to `background/frame-blocker.js`** (before closing `})();`)

```javascript
  function isFrameRuleId(id) {
    return Number.isInteger(id) && id >= fb.FRAME_RULE_ID_START && id <= fb.FRAME_RULE_ID_END;
  }

  async function frameRules(api) {
    const all = await api.declarativeNetRequest.getDynamicRules();
    return all.filter((r) => isFrameRuleId(r.id));
  }

  function ruleMatchesDomain(rule, domain) {
    return rule.condition && rule.condition.urlFilter === '||' + domain;
  }

  fb.addNetworkBlock = async function (api, domain) {
    if (!api || !api.declarativeNetRequest) return; // MV2 / Safari: teardown handles it
    const existing = await frameRules(api);
    if (existing.some((r) => ruleMatchesDomain(r, domain))) return; // idempotent
    const usedIds = new Set(existing.map((r) => r.id));
    let id = fb.FRAME_RULE_ID_START;
    while (usedIds.has(id) && id <= fb.FRAME_RULE_ID_END) id += 1;
    if (id > fb.FRAME_RULE_ID_END) return;
    await api.declarativeNetRequest.updateDynamicRules({ addRules: [fb.buildFrameBlockRule(id, domain)] });
  };

  fb.removeNetworkBlock = async function (api, domain) {
    if (!api || !api.declarativeNetRequest) return;
    const existing = await frameRules(api);
    const removeRuleIds = existing.filter((r) => ruleMatchesDomain(r, domain)).map((r) => r.id);
    if (removeRuleIds.length === 0) return;
    await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
  };
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/frame-blocker.test.js`
Expected: all `network block rules` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add background/frame-blocker.js tests/frame-blocker.test.js
TMPDIR=/tmp git commit -S -m "feat(frame-blocker): persisted sub_frame DNR rules (MV3), no-op on MV2/Safari"
```

---

## Task 5: Wire-up — recomputeTab threads rules + applies; SET_FRAME_RULE handler

**Files:**
- Modify: `background/background.js`
- Modify: `manifest.json`, `manifest-mv2.json`
- Test: `tests/message-contracts.test.js` (append)

- [ ] **Step 1: Replace `recomputeTab` in `background/background.js`** with the rule-threaded + apply version:

```javascript
  // Recompute the per-tab frame census (honouring site + per-frame rules) and
  // apply the resulting decisions (tear down blocked frames).
  async function recomputeTab(tabId) {
    const reg = self.WebSuddhi.frameRegistry;
    const ruleModel = self.WebSuddhi.ruleModel;
    const loader = self.WebSuddhi.listLoader;
    const blocker = self.WebSuddhi.frameBlocker;
    if (!reg || !ruleModel || !loader) return;
    let hostname = '';
    try {
      const tab = await api.tabs.get(tabId);
      hostname = normalizeHostname(new URL(tab.url).hostname, true);
    } catch (e) { /* tab gone or non-http */ }
    const settings = await getStorage(['aggressiveness']);

    // Merge persisted + session frame rules for this top-site (session wins).
    let frameRules = {};
    if (hostname) {
      const persisted = await ruleModel.getFrameRulesForSite(hostname);
      const session = ruleModel.getSessionFrameRulesForSite(hostname);
      for (const d of Object.keys(persisted)) frameRules[d] = { persistentRule: persisted[d] };
      for (const d of Object.keys(session)) frameRules[d] = Object.assign(frameRules[d] || {}, { sessionRule: session[d] });
    }

    const ctx = {
      lists: await loader.loadLists(),
      budget: { bytes: 500 * 1024, ms: 150 },
      siteState: hostname ? await ruleModel.getSiteState(hostname) : 'default',
      aggressiveness: settings.aggressiveness || 'balanced',
      frameRules
    };
    reg.recompute(tabId, ctx);
    if (blocker) blocker.applyTab(api, tabId, reg.getCensus(tabId));
  }
```

- [ ] **Step 2: Add the `SET_FRAME_RULE` case to the `handleMessage` switch** (after the `GET_TAB_CENSUS` case added in Plan 2):

```javascript
        case 'SET_FRAME_RULE': {
          const reg = self.WebSuddhi.frameRegistry;
          const ruleModel = self.WebSuddhi.ruleModel;
          const blocker = self.WebSuddhi.frameBlocker;
          if (!reg || !ruleModel) return { success: false, error: 'Frame engine unavailable' };
          const tabId = Number.isInteger(message.tabId) ? message.tabId : sender.tab?.id;
          let site = '';
          try {
            const tab = await api.tabs.get(tabId);
            site = normalizeHostname(new URL(tab.url).hostname, true);
          } catch (e) { return { success: false, error: 'No tab URL' }; }
          if (!site || !message.frameDomain) return { success: false, error: 'Missing site or frameDomain' };

          await ruleModel.setFrameRule(site, message.frameDomain, message.rule || null, { persist: message.persist !== false });
          // Persisted block also gets a network rule so it does not reload.
          if (blocker) {
            if (message.rule === 'blocked' && message.persist !== false) await blocker.addNetworkBlock(api, message.frameDomain);
            else await blocker.removeNetworkBlock(api, message.frameDomain);
          }
          await recomputeTab(tabId);
          return { success: true, census: reg.getCensus(tabId) };
        }
```

- [ ] **Step 3: Register `frame-blocker.js` in `background/background.js` importScripts** — add `'frame-blocker.js'` after `'frame-registry.js'`:

```javascript
      'filter-lists.js',
      'phishing-detector.js',
      'frame-registry.js',
      'frame-blocker.js'
```

- [ ] **Step 4: Register `frame-blocker.js` in `manifest-mv2.json`** `background.scripts` — add `"background/frame-blocker.js"` after `"background/frame-registry.js"`. (MV3 `manifest.json` uses the service worker `importScripts` from Step 3, so no `manifest.json` change is needed for the background module.)

- [ ] **Step 5: Append a message-contract test to `tests/message-contracts.test.js`**

```javascript
it('wires the SET_FRAME_RULE blocking contract', () => {
  const backgroundSource = readSource('background/background.js');
  expect(backgroundSource).toContain("case 'SET_FRAME_RULE'");
  expect(backgroundSource).toContain('addNetworkBlock');
  expect(backgroundSource).toContain('applyTab');
});
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all new + existing suites pass (except the 3 pre-existing `utils.test.js` storage timeouts, tracked separately).

- [ ] **Step 7: Lint**

Run: `npx eslint background/frame-blocker.js background/frame-registry.js shared/rule-model.js`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add background/background.js background/frame-blocker.js manifest.json manifest-mv2.json tests/message-contracts.test.js
TMPDIR=/tmp git commit -S -m "feat(frame-engine): apply decisions + SET_FRAME_RULE (this-site, persisted)"
```

- [ ] **Step 9: Build & hand off for manual test**

```bash
npm run build:targets
```
Reload `dist/browser/chromium`. The popup can't drive `SET_FRAME_RULE` until Plan 5, but verify in the service-worker console that allow persists across navigation:
```js
// allow a frame on the current site, then navigate a subpage and re-check the census
chrome.tabs.query({active:true,currentWindow:true}, ([t]) =>
  chrome.runtime.sendMessage({ type:'SET_FRAME_RULE', tabId:t.id, frameDomain:'outlook.office.com', rule:'allowed', persist:true },
    (r) => console.log('rule set; census:', r.census)));
// navigate to another subpage, then:
chrome.tabs.query({active:true,currentWindow:true}, ([t]) =>
  chrome.runtime.sendMessage({ type:'GET_TAB_CENSUS', tabId:t.id }, (r) =>
    console.log('outlook frame action after nav:', r.census.frames.find((f)=>f.domain==='outlook.office.com')?.action)));
// expected: 'allow' — no re-allow needed
```

---

## Self-Review

**Spec coverage (Plan 3 scope):**
- Act on decisions / DOM teardown → Task 3 (`framesToTearDown`, `tearDown`, `applyTab`). ✓
- Network prevention so frames don't reload (MV3) → Task 4 (`addNetworkBlock`/`removeNetworkBlock`, range 70001-79999); MV2/Safari no-op documented. ✓
- `SET_FRAME_RULE` handler (Plan 5 calls it) → Task 5. ✓
- Thread persisted/session rules into recompute (fixes "allow once survives navigation") → Tasks 1-2 + Task 5 `recomputeTab`. ✓
- Protected-list seatbelt at apply time → Task 3 (`framesToTearDown` excludes `isProtected`). ✓
- This-site, persisted scope → Task 5 (`site = normalizeHostname(host, true)`, `persist !== false` default). ✓

**Deferred (NOT in Plan 3):**
- Popup buttons that call `SET_FRAME_RULE` and reflect allowed/blocked state (Plan 5) — also fixes the "Allow button re-appears after nav" UI symptom.
- Safari/iOS static-ruleset recompile on persist (Plan 6 cross-browser QA); teardown already works there.
- MV2/Firefox webRequest integration of frame blocks beyond teardown — teardown covers the kill; persisted network prevention on MV2 can reuse the existing `blockedDomains` path in Plan 6 if needed.

**Placeholder scan:** none. Every code/test step is concrete. Step 4 of Task 5 explicitly states why `manifest.json` needs no change (service worker importScripts).

**Type consistency:** `frameRules` shape `{ [domain]: { persistentRule, sessionRule } }` matches between `recomputeTab` (Task 5), `reg.recompute` (Task 2), and `classifyAndDecide`'s existing `ctx.persistentRule/sessionRule` reads. `SET_FRAME_RULE` payload matches the Message Contract table. `framesToTearDown`/`buildFrameBlockRule`/`tearDown`/`applyTab`/`addNetworkBlock`/`removeNetworkBlock` names are consistent across Tasks 3-5. Site keying (`normalizeHostname(host, true)`) matches the existing whitelist normalization so it composes with current behaviour.

**Risk note:** `normalizeHostname` is a `background.js`-scope helper — `recomputeTab` and the `SET_FRAME_RULE` handler both live in `background.js`, so it's in scope. Confirmed available (used by `whitelistSite`/`isSiteWhitelisted`).
