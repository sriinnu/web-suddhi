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
