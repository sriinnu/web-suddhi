import { describe, it, expect, beforeEach } from 'vitest';

let agent;
beforeEach(async () => {
  globalThis.self = globalThis;
  globalThis.__WS_FRAME_AGENT_TEST__ = true;
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
