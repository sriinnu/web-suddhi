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

describe('classifier.categorize', () => {
  let classifier;
  const lists = {
    protected: { 'js.stripe.com': 'payment', 'youtube.com': 'embed' },
    categories: { 'doubleclick.net': 'ad', 'scorecardresearch.com': 'session-replay', 'google-analytics.com': 'analytics' }
  };

  beforeAll(async () => {
    globalThis.self = globalThis;
    await import('../background/classifier.js');
    classifier = globalThis.WebSuddhi.classifier;
  });

  it('flags protected domains and never marks them ad/tracker', () => {
    const r = classifier.categorize({ domain: 'js.stripe.com' }, lists);
    expect(r).toEqual({ category: 'payment', isProtected: true, isKnownAdTracker: false });
  });

  it('matches subdomains to their parent list entry', () => {
    const r = classifier.categorize({ domain: 'ads.g.doubleclick.net' }, lists);
    expect(r.category).toBe('ad');
    expect(r.isKnownAdTracker).toBe(true);
  });

  it('marks analytics/session-replay as known ad/tracker', () => {
    expect(classifier.categorize({ domain: 'scorecardresearch.com' }, lists).isKnownAdTracker).toBe(true);
    expect(classifier.categorize({ domain: 'google-analytics.com' }, lists).isKnownAdTracker).toBe(true);
  });

  it('treats a 1x1 unknown frame as an analytics pixel (not known-tracker)', () => {
    const r = classifier.categorize({ domain: 'unknown-x.com', width: 1, height: 1 }, lists);
    expect(r).toEqual({ category: 'analytics', isProtected: false, isKnownAdTracker: false });
  });

  it('uses URL heuristics for unknown ad frames (not known-tracker)', () => {
    const r = classifier.categorize({ domain: 'cdn-x.com', url: 'https://cdn-x.com/ads/banner.html', width: 300, height: 250 }, lists);
    expect(r.category).toBe('ad');
    expect(r.isKnownAdTracker).toBe(false);
  });

  it('falls back to "other" for unknown plain frames', () => {
    expect(classifier.categorize({ domain: 'random-site.com', width: 800, height: 600 }, lists).category).toBe('other');
  });
});

describe('classifier.estimateHeaviness', () => {
  let classifier;
  beforeAll(() => { classifier = globalThis.WebSuddhi.classifier; });

  it('is heavy when bytes exceed budget', () => {
    expect(classifier.estimateHeaviness({ bytes: 600 * 1024, longTaskMs: 0 }, { bytes: 500 * 1024, ms: 150 })).toBe(true);
  });
  it('is heavy when long-task time exceeds budget', () => {
    expect(classifier.estimateHeaviness({ bytes: 0, longTaskMs: 200 }, { bytes: 500 * 1024, ms: 150 })).toBe(true);
  });
  it('is not heavy under both budgets', () => {
    expect(classifier.estimateHeaviness({ bytes: 1024, longTaskMs: 10 }, { bytes: 500 * 1024, ms: 150 })).toBe(false);
  });
});
