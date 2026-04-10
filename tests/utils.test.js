// WebSuddhi - Critical Path Tests
// Tests for shared utilities: storage, selector validation, domain matching, tracker categorization

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chrome API for storage tests
const mockStorage = {};
const chromeMock = {
  storage: {
    local: {
      get: vi.fn((keys) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        const result = {};
        for (const k of keyList) {
          if (mockStorage[k] !== undefined) result[k] = mockStorage[k];
        }
        return Promise.resolve(result);
      }),
      set: vi.fn((data) => {
        Object.assign(mockStorage, data);
        return Promise.resolve();
      })
    }
  },
  runtime: { lastError: null }
};

globalThis.chrome = chromeMock;

// Load utils module
let utils;

beforeEach(async () => {
  vi.clearAllMocks();
  // Reset mock storage
  for (const key of Object.keys(mockStorage)) delete mockStorage[key];

  // Re-import utils for fresh state
  const module = await import('../shared/utils.js');
  utils = globalThis.WebSuddhi?.utils || module?.utils;
});

// ============================================
// CSS SELECTOR Validation
// ============================================
describe('isValidCSSSelector', () => {
  it('accepts simple tag selectors', () => {
    expect(utils.isValidCSSSelector('div')).toBe(true);
    expect(utils.isValidCSSSelector('span')).toBe(true);
    expect(utils.isValidCSSSelector('a')).toBe(true);
  });

  it('accepts class selectors', () => {
    expect(utils.isValidCSSSelector('.ad-banner')).toBe(true);
    expect(utils.isValidCSSSelector('.modal-overlay')).toBe(true);
    expect(utils.isValidCSSSelector('div.container')).toBe(true);
  });

  it('accepts ID selectors', () => {
    expect(utils.isValidCSSSelector('#main')).toBe(true);
    expect(utils.isValidCSSSelector('div#content')).toBe(true);
  });

  it('accepts compound selectors', () => {
    expect(utils.isValidCSSSelector('div.ad-banner > span.close')).toBe(true);
    expect(utils.isValidCSSSelector('.container .row .col')).toBe(true);
  });

  it('accepts pseudo-classes', () => {
    expect(utils.isValidCSSSelector('li:first-child')).toBe(true);
    expect(utils.isValidCSSSelector('tr:nth-child(2n)')).toBe(true);
    expect(utils.isValidCSSSelector('a:hover')).toBe(true);
  });

  it('accepts attribute selectors with safe attributes', () => {
    expect(utils.isValidCSSSelector('[class="ad"]')).toBe(true);
    expect(utils.isValidCSSSelector('[data-testid]')).toBe(true);
    expect(utils.isValidCSSSelector('[role="button"]')).toBe(true);
    expect(utils.isValidCSSSelector('input[type="hidden"]')).toBe(true);
  });

  it('rejects empty/null/undefined', () => {
    expect(utils.isValidCSSSelector('')).toBe(false);
    expect(utils.isValidCSSSelector(null)).toBe(false);
    expect(utils.isValidCSSSelector(undefined)).toBe(false);
  });

  it('rejects overly long selectors', () => {
    expect(utils.isValidCSSSelector('.'.repeat(501))).toBe(false);
  });

  it('rejects script injection', () => {
    expect(utils.isValidCSSSelector('<script>alert(1)</script>')).toBe(false);
    expect(utils.isValidCSSSelector('javascript:alert(1)')).toBe(false);
  });

  it('rejects CSS url() injection', () => {
    expect(utils.isValidCSSSelector('div { background: url(evil) }')).toBe(false);
  });

  it('rejects CSS expression injection', () => {
    expect(utils.isValidCSSSelector('expression(alert(1))')).toBe(false);
  });

  it('rejects @import injection', () => {
    expect(utils.isValidCSSSelector('@import url(evil)')).toBe(false);
  });

  it('rejects CSS rule braces', () => {
    expect(utils.isValidCSSSelector('div { color: red }')).toBe(false);
  });

  it('rejects event handler attribute selectors', () => {
    expect(utils.isValidCSSSelector('[onclick="alert(1)"]')).toBe(false);
    expect(utils.isValidCSSSelector('[onerror="x"]')).toBe(false);
    expect(utils.isValidCSSSelector('[onload="x"]')).toBe(false);
  });

  it('rejects unicode escape sequences', () => {
    expect(utils.isValidCSSSelector('\\003cscript\\003e')).toBe(false);
  });

  it('rejects null bytes and control characters', () => {
    expect(utils.isValidCSSSelector('div\x00.ad')).toBe(false);
    expect(utils.isValidCSSSelector('div\x01.ad')).toBe(false);
  });

  it('accepts comma-separated selectors', () => {
    expect(utils.isValidCSSSelector('.ad, .banner, .sponsor')).toBe(true);
  });
});

// ============================================
// Tracker Categorization
// ============================================
describe('getTrackerInfo', () => {
  it('returns info for known domains', () => {
    const info = utils.getTrackerInfo('doubleclick.net');
    expect(info).not.toBeNull();
    expect(info.category).toBe('Advertising');
    expect(info.severity).toBe('medium');
  });

  it('matches subdomains', () => {
    const info = utils.getTrackerInfo('ads.example.doubleclick.net');
    expect(info).not.toBeNull();
    expect(info.category).toBe('Advertising');
  });

  it('returns Unknown for unrecognized domains', () => {
    const info = utils.getTrackerInfo('totally-innocent-site.com');
    expect(info).not.toBeNull();
    expect(info.category).toBe('Unknown');
    expect(info.severity).toBe('low');
  });

  it('handles null/undefined input', () => {
    expect(utils.getTrackerInfo(null)).toBeNull();
    expect(utils.getTrackerInfo(undefined)).toBeNull();
    expect(utils.getTrackerInfo('')).toBeNull();
  });

  it('is case-insensitive', () => {
    const info1 = utils.getTrackerInfo('DOUBLECLICK.NET');
    const info2 = utils.getTrackerInfo('doubleclick.net');
    expect(info1.category).toBe(info2.category);
  });
});

// ============================================
// Domain Extraction
// ============================================
describe('extractDomain', () => {
  it('extracts domain from full URLs', () => {
    expect(utils.extractDomain('https://www.example.com/path')).toBe('www.example.com');
    expect(utils.extractDomain('http://sub.example.com:8080/path?q=1')).toBe('sub.example.com');
  });

  it('handles bare domains', () => {
    expect(utils.extractDomain('example.com')).toBe('example.com');
  });

  it('returns null for invalid input', () => {
    expect(utils.extractDomain(null)).toBeNull();
    expect(utils.extractDomain(undefined)).toBeNull();
    expect(utils.extractDomain('')).toBeNull();
  });
});

// ============================================
// Hostname Normalization
// ============================================
describe('normalizeHostname', () => {
  it('strips www prefix', () => {
    expect(utils.normalizeHostname('www.example.com')).toBe('example.com');
  });

  it('lowercases hostnames', () => {
    expect(utils.normalizeHostname('EXAMPLE.COM')).toBe('example.com');
  });

  it('handles empty input', () => {
    expect(utils.normalizeHostname('')).toBe('');
    expect(utils.normalizeHostname(null)).toBe('');
  });
});

// ============================================
// Storage Helpers
// ============================================
describe('storage helpers', () => {
  it('getStorage returns stored values', async () => {
    mockStorage.enabled = false;
    const result = await utils.getStorage(['enabled']);
    expect(result.enabled).toBe(false);
  });

  it('setStorage writes values', async () => {
    await utils.setStorage({ enabled: true });
    expect(mockStorage.enabled).toBe(true);
  });

  it('getStorage returns empty for missing keys', async () => {
    const result = await utils.getStorage(['nonexistent']);
    expect(result.nonexistent).toBeUndefined();
  });
});

// ============================================
// Number Formatting
// ============================================
describe('formatNumber', () => {
  it('formats millions', () => {
    expect(utils.formatNumber(1500000)).toBe('1.5M');
  });

  it('formats thousands', () => {
    expect(utils.formatNumber(1500)).toBe('1.5K');
  });

  it('leaves small numbers as-is', () => {
    expect(utils.formatNumber(500)).toBe('500');
  });
});

// ============================================
// Relative Time
// ============================================
describe('getRelativeTime', () => {
  it('returns "just now" for very recent timestamps', () => {
    expect(utils.getRelativeTime(Date.now())).toBe('just now');
  });

  it('returns seconds ago', () => {
    expect(utils.getRelativeTime(Date.now() - 30000)).toBe('30s ago');
  });

  it('returns minutes ago', () => {
    expect(utils.getRelativeTime(Date.now() - 120000)).toBe('2m ago');
  });

  it('returns empty for null', () => {
    expect(utils.getRelativeTime(null)).toBe('');
    expect(utils.getRelativeTime(undefined)).toBe('');
  });
});

// ============================================
// Filter List URL Validation
// ============================================
describe('isValidFilterListURL', () => {
  it('accepts HTTPS URLs', () => {
    expect(utils.isValidFilterListURL('https://example.com/filters.txt')).toBe(true);
  });

  it('rejects HTTP URLs (non-localhost)', () => {
    expect(utils.isValidFilterListURL('http://example.com/filters.txt')).toBe(false);
  });

  it('accepts HTTP localhost for development', () => {
    expect(utils.isValidFilterListURL('http://localhost:3000/filters.txt')).toBe(true);
    expect(utils.isValidFilterListURL('http://127.0.0.1/filters.txt')).toBe(true);
  });

  it('rejects invalid URLs', () => {
    expect(utils.isValidFilterListURL('')).toBe(false);
    expect(utils.isValidFilterListURL(null)).toBe(false);
    expect(utils.isValidFilterListURL('not-a-url')).toBe(false);
  });
});
