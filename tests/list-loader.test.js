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
