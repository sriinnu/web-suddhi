import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

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

describe('site-state persistence', () => {
  beforeEach(() => {
    const store = {};
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
    expect(raw.ws_siteStates && raw.ws_siteStates['a.com']).toBeUndefined();
  });
});

describe('frame-rule persistence + session rules', () => {
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
