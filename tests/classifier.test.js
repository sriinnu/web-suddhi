import { describe, it, expect, beforeAll } from 'vitest';
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
