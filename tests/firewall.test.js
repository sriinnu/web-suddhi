import { describe, it, expect, beforeEach, vi } from 'vitest';

let fw;
let stored;
beforeEach(async () => {
  globalThis.self = globalThis;
  delete globalThis.WebSuddhi;
  delete globalThis.chrome;
  await import('../background/firewall.js?t=' + Math.random());
  fw = globalThis.WebSuddhi.firewall;
  stored = {};
  fw._setStore({ get: async () => stored, set: async (v) => { stored = v; } });
  fw._setCache({});
});

function fakeApi() {
  let rules = [{ id: 80001, priority: 800 }, { id: 20001 }];
  return {
    rules: () => rules,
    declarativeNetRequest: {
      getDynamicRules: async () => rules,
      updateDynamicRules: vi.fn(async ({ removeRuleIds = [], addRules = [] }) => {
        rules = rules.filter((r) => !removeRuleIds.includes(r.id)).concat(addRules);
      })
    }
  };
}

describe('validation', () => {
  it('rejects unknown types, actions and hosts', () => {
    expect(fw.validateRule('a.com', 'x.com', 'bogus', 'block').ok).toBe(false);
    expect(fw.validateRule('a.com', 'x.com', 'script', 'deny').ok).toBe(false);
    expect(fw.validateRule('a.com', 'bad host!', 'script', 'block').ok).toBe(false);
    expect(fw.validateRule('', 'x.com', 'script', 'block').ok).toBe(false);
  });
  it('accepts valid cells, null action and star host; strips www on site', () => {
    expect(fw.validateRule('www.a.com', 'x.com', 'script', 'block')).toMatchObject({ ok: true, site: 'a.com' });
    expect(fw.validateRule('a.com', '*', '*', 'allow').ok).toBe(true);
    expect(fw.validateRule('a.com', 'x.com', 'css', null).ok).toBe(true);
  });
  it('caps total rules at 2000', () => {
    let all = {};
    for (let i = 0; i < 2000; i++) {
      all = fw.applyChange(all, 'a.com', 'h' + i + '.com', 'script', 'block').rules;
    }
    expect(fw.countRules(all)).toBe(2000);
    expect(fw.applyChange(all, 'a.com', 'extra.com', 'script', 'block').ok).toBe(false);
    expect(fw.applyChange(all, 'a.com', 'h1.com', 'script', 'allow').ok).toBe(true);
  });
  it('sanitize drops invalid entries', () => {
    const out = fw.sanitize({ 'a.com': { 'x.com': { script: 'block', nope: 'block', css: 'maybe' }, 'bad host': { script: 'block' } } });
    expect(out).toEqual({ 'a.com': { 'x.com': { script: 'block' } } });
  });
});

describe('DNR compilation', () => {
  it('compiles host rules at 810+ and star rules at 800+ within the id range', () => {
    const rules = fw.compileDnrRules({
      'a.com': { 'x.com': { script: 'block' }, '*': { xhr: 'block', '*': 'allow' } }
    });
    expect(rules).toHaveLength(3);
    for (const r of rules) {
      expect(r.id).toBeGreaterThanOrEqual(80001);
      expect(r.id).toBeLessThanOrEqual(89999);
    }
    const host = rules.find((r) => r.condition.requestDomains);
    expect(host.priority).toBe(811);
    expect(host.condition).toEqual({ initiatorDomains: ['a.com'], requestDomains: ['x.com'], resourceTypes: ['script'] });
    expect(host.action).toEqual({ type: 'block' });
    const star = rules.filter((r) => !r.condition.requestDomains);
    expect(star.find((r) => r.action.type === 'block').priority).toBe(801);
    expect(star.find((r) => r.action.type === 'allow').priority).toBe(800);
    expect(star.every((r) => r.condition.excludedRequestDomains[0] === 'a.com')).toBe(true);
    const xhr = star.find((r) => r.action.type === 'block');
    expect(xhr.condition.resourceTypes).toEqual(['xmlhttprequest', 'websocket']);
    const allow = star.find((r) => r.action.type === 'allow');
    expect(allow.condition.resourceTypes).toContain('sub_frame');
    expect(allow.condition.resourceTypes).toContain('stylesheet');
  });
  it('maps frame to sub_frame', () => {
    const [r] = fw.compileDnrRules({ 'a.com': { 'x.com': { frame: 'block' } } });
    expect(r.condition.resourceTypes).toEqual(['sub_frame']);
  });
});

describe('set / remove / reset', () => {
  it('sets a cell, returns the site rules and recompiles only the firewall range', async () => {
    const api = fakeApi();
    const res = await fw.setRule('www.a.com', 'x.com', 'script', 'block', api);
    expect(res).toEqual({ success: true, rules: { 'x.com': { script: 'block' } } });
    expect(stored['a.com']['x.com'].script).toBe('block');
    const ids = api.rules().map((r) => r.id);
    expect(ids).toContain(20001);
    expect(ids.filter((i) => i >= 80001)).toHaveLength(1);
  });
  it('null removes the cell and empty containers', async () => {
    await fw.setRule('a.com', 'x.com', 'script', 'block');
    const res = await fw.setRule('a.com', 'x.com', 'script', null);
    expect(res).toEqual({ success: true, rules: {} });
    expect(stored).toEqual({});
  });
  it('rejects invalid input with success false', async () => {
    expect((await fw.setRule('a.com', 'x.com', 'zzz', 'block')).success).toBe(false);
  });
  it('get returns empty object when none, reset clears a site only', async () => {
    expect(await fw.getSiteRules('a.com')).toEqual({});
    await fw.setRule('a.com', 'x.com', 'script', 'block');
    await fw.setRule('b.com', 'y.com', 'image', 'allow');
    expect((await fw.resetSite('a.com')).success).toBe(true);
    expect(await fw.getSiteRules('a.com')).toEqual({});
    expect(await fw.getSiteRules('b.com')).toEqual({ 'y.com': { image: 'allow' } });
  });
});

describe('MV2 decision', () => {
  const all = {
    'a.com': {
      'x.com': { script: 'allow' },
      '*': { script: 'block', image: 'block' },
      'cdn.y.com': { image: 'block' }
    }
  };
  it('host-specific beats star', () => {
    expect(fw.decide(all, 'a.com', 'x.com', 'script')).toBe('allow');
    expect(fw.decide(all, 'a.com', 'sub.x.com', 'script')).toBe('allow');
  });
  it('a single type beats the same host\'s all-types cell, in MV2 and DNR', () => {
    const mixed = { 'a.com': { 't.com': { '*': 'allow', script: 'block' } } };
    expect(fw.decide(mixed, 'a.com', 't.com', 'script')).toBe('block');
    expect(fw.decide(mixed, 'a.com', 't.com', 'image')).toBe('allow');
    const compiled = fw.compileDnrRules(mixed);
    const script = compiled.find((r) => r.action.type === 'block');
    const allTypes = compiled.find((r) => r.action.type === 'allow');
    expect(script.priority).toBeGreaterThan(allTypes.priority);
  });
  it('star blocks third parties but not first party', () => {
    expect(fw.decide(all, 'a.com', 'other.com', 'script')).toBe('block');
    expect(fw.decide(all, 'a.com', 'static.a.com', 'script')).toBe(null);
  });
  it('returns null for unmatched types and sites', () => {
    expect(fw.decide(all, 'a.com', 'other.com', 'font')).toBe(null);
    expect(fw.decide(all, 'z.com', 'other.com', 'script')).toBe(null);
  });
  it('maps webRequest details and skips main_frame', () => {
    const d = { type: 'script', url: 'https://other.com/a.js', documentUrl: 'https://www.a.com/p' };
    expect(fw.decideRequest(all, d)).toBe('block');
    expect(fw.decideRequest(all, { ...d, type: 'main_frame' })).toBe(null);
    expect(fw.decideRequest(all, { ...d, type: 'ping' })).toBe(null);
    expect(fw.decideRequest(all, { ...d, type: 'xmlhttprequest', url: 'https://x.com/q' })).toBe(null);
  });
  it('listener cancels only on block', () => {
    fw._setCache(all);
    expect(fw._mv2Listener({ type: 'script', url: 'https://other.com/a.js', originUrl: 'https://a.com/' })).toEqual({ cancel: true });
    expect(fw._mv2Listener({ type: 'script', url: 'https://x.com/a.js', originUrl: 'https://a.com/' })).toEqual({});
    expect(fw.decideCached({ type: 'script', url: 'https://x.com/a.js', originUrl: 'https://a.com/' })).toBe('allow');
  });
});
