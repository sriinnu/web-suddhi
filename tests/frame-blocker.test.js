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
    expect(sendMessage.mock.calls.map((c) => c[1].matchUrl)).toEqual(['https://doubleclick.net/a', 'https://taboola.com/b']);
  });
});

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
