// EasyList site-specific element hiding, from the built table to the page.
// The background answers GET_COSMETIC_FILTERS from rules/cosmetic-filters.json;
// these tests feed it a small table instead of the generated one.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { boot, flush, read } from './helpers/background-harness.js';

const TABLE = {
  version: 1,
  selectors: ['.promo', '.side-ad', '#sponsored'],
  hide: { 'news.example': [0, 1], 'shop.example': [2], 'quiet.example': [0, 2] },
  unhide: { 'sport.news.example': [1] },
  disabled: ['quiet.example']
};

describe('GET_COSMETIC_FILTERS', () => {
  let env;
  beforeEach(async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => structuredClone(TABLE) }));
    env = boot({});
    await flush();
  });
  afterEach(() => { delete globalThis.fetch; });

  const ask = (url) => env.send({ type: 'GET_COSMETIC_FILTERS', hostname: 'ignored.example' }, { url, tab: { id: 1 } });

  it('returns the rules for the site and its parent domains', async () => {
    expect((await ask('https://www.news.example/a')).selectors.sort()).toEqual(['.promo', '.side-ad']);
  });

  it('subtracts exceptions for a subdomain', async () => {
    expect((await ask('https://sport.news.example/')).selectors).toEqual(['.promo']);
  });

  it('returns nothing where a list switches element hiding off', async () => {
    expect((await ask('https://cdn.quiet.example/')).selectors).toEqual([]);
  });

  it('answers for the frame that asked, not the tab', async () => {
    expect((await ask('https://shop.example/widget')).selectors).toEqual(['#sponsored']);
  });

  it('falls back to the reported hostname for about:blank frames', async () => {
    const resp = await env.send({ type: 'GET_COSMETIC_FILTERS', hostname: 'shop.example' }, { url: 'about:blank' });
    expect(resp.selectors).toEqual(['#sponsored']);
  });

  it('loads the table once', async () => {
    await ask('https://news.example/');
    await ask('https://shop.example/');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('degrades to nothing when the table is missing', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false }));
    env = boot({});
    await flush();
    expect((await ask('https://news.example/')).selectors).toEqual([]);
  });
});

describe('content script wiring', () => {
  const core = read('content/ad-blocker.js');

  it('asks for list cosmetics when enabled and drops them when paused', () => {
    expect(core).toContain("type: 'GET_COSMETIC_FILTERS'");
    const refresh = core.slice(core.indexOf('async function refreshLocalSettings'));
    const enabledBranch = refresh.slice(0, refresh.indexOf('} else {'));
    const disabledBranch = refresh.slice(refresh.indexOf('} else {'), refresh.indexOf('return { whitelisted }'));
    expect(enabledBranch).toContain('applyListCosmetics()');
    expect(disabledBranch).toContain('removeListCosmetics()');
  });

  it('honours per-site "unblock just this" selectors', () => {
    const fn = core.slice(core.indexOf('function applyListCosmetics'), core.indexOf('function removeListCosmetics'));
    expect(fn).toContain('getAllowedSelectorSet()');
  });
});

describe('shipped cosmetic table', () => {
  it('only carries selectors that cannot escape their CSS rule', () => {
    const table = JSON.parse(read('rules/cosmetic-filters.json'));
    const bad = table.selectors.filter((sel) => /[{}]|\/\*/.test(sel));
    expect(bad).toEqual([]);
    for (const map of [table.hide, table.unhide]) {
      for (const list of Object.values(map)) {
        for (const index of list) expect(index).toBeLessThan(table.selectors.length);
      }
    }
  });
});
