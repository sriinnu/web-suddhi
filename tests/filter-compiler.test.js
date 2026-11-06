// Tests for the ABP -> declarativeNetRequest compiler.
// These assert semantics, not just "the file parsed": dropping a modifier or
// broadening a rule is the exact failure mode this compiler had.

import { describe, it, expect } from 'vitest';
import {
  parseABP, buildRule, isExpressibleUrlFilter, isSafeSelector, parseCosmetic, buildCosmeticTable
} from '../scripts/build-blocklists.mjs';

const DEFAULTS = ['script', 'image', 'xmlhttprequest', 'sub_frame'];

describe('parseABP', () => {
  it('keeps a bare host rule with its anchor', () => {
    const { rules } = parseABP('||doubleclick.net^\n');
    expect(rules).toHaveLength(1);
    expect(rules[0].urlFilter).toBe('||doubleclick.net^');
    expect(rules[0].exception).toBe(false);
  });

  it('maps $third-party onto domainType instead of dropping it', () => {
    const { rules } = parseABP('||ads.example^$third-party\n');
    expect(rules[0].domainType).toBe('thirdParty');
  });

  it('maps resource type modifiers onto resourceTypes', () => {
    const { rules } = parseABP('||ads.example^$script,image\n');
    expect(rules[0].resourceTypes.sort()).toEqual(['image', 'script']);
  });

  it('maps $domain= onto initiatorDomains with exclusions', () => {
    const { rules } = parseABP('||ads.example^$domain=news.example|~sport.news.example\n');
    expect(rules[0].initiatorDomains).toEqual(['news.example']);
    expect(rules[0].excludedInitiatorDomains).toEqual(['sport.news.example']);
  });

  it('keeps @@ exceptions as allow rules rather than discarding them', () => {
    const { rules } = parseABP('@@||news.example^$document\n');
    expect(rules).toHaveLength(1);
    expect(rules[0].exception).toBe(true);
  });

  it('drops rules whose modifiers DNR cannot express', () => {
    const { rules, stats } = parseABP(
      '||popup.example^$popup\n||csp.example^$csp\n||redir.example^$redirect=noop.js\n'
    );
    expect(rules).toHaveLength(0);
    expect(stats.unsupported).toBe(3);
  });

  it('never broadens $popup into a global block', () => {
    const { rules } = parseABP('||tracker.example^$popup\n');
    expect(rules.find((rule) => rule.urlFilter === '||tracker.example^')).toBeUndefined();
  });

  it('collects $badfilter for cancellation', () => {
    const { badfilters } = parseABP('||bad.example^$badfilter\n');
    expect([...badfilters]).toContain('||bad.example^');
  });

  it('skips cosmetic rules and counts them', () => {
    const { rules, stats } = parseABP('example.com##.ad\n#@#.ad\n||ok.example^\n');
    expect(rules).toHaveLength(1);
    expect(stats.cosmetic).toBe(2);
  });

  it('keeps TLD-shaped spam rules', () => {
    const { rules } = parseABP('||zip^\n');
    expect(rules[0].urlFilter).toBe('||zip^');
  });
});

describe('buildRule', () => {
  const base = {
    urlFilter: '||ads.example^',
    exception: false,
    important: false,
    domainType: null,
    resourceTypes: [],
    initiatorDomains: [],
    excludedInitiatorDomains: [],
    caseSensitive: false
  };

  it('blocks at priority 1 with the default resource types', () => {
    const rule = buildRule(7, base, DEFAULTS);
    expect(rule).toMatchObject({
      id: 7,
      priority: 1,
      action: { type: 'block' },
      condition: { urlFilter: '||ads.example^', resourceTypes: DEFAULTS }
    });
  });

  it('emits allow rules above block rules', () => {
    const allow = buildRule(1, { ...base, exception: true }, DEFAULTS);
    const block = buildRule(2, base, DEFAULTS);
    expect(allow.action.type).toBe('allow');
    expect(allow.priority).toBeGreaterThan(block.priority);
  });

  it('carries domain scoping and case sensitivity into the condition', () => {
    const rule = buildRule(1, {
      ...base,
      domainType: 'thirdParty',
      initiatorDomains: ['news.example'],
      excludedInitiatorDomains: ['sport.news.example'],
      caseSensitive: true
    }, DEFAULTS);

    expect(rule.condition.domainType).toBe('thirdParty');
    expect(rule.condition.initiatorDomains).toEqual(['news.example']);
    expect(rule.condition.excludedInitiatorDomains).toEqual(['sport.news.example']);
    expect(rule.condition.isUrlFilterCaseSensitive).toBe(true);
  });

  it('lets a user rule outrank a list exception', () => {
    // Feed exceptions compile to priority 100; the background's user rules use
    // 500/600/1000 so a deliberate user choice is never overridden by a list.
    const listException = buildRule(1, { ...base, exception: true }, DEFAULTS);
    expect(listException.priority).toBeLessThan(500);
  });
});

describe('isExpressibleUrlFilter', () => {
  it('accepts host, path and anchored patterns DNR can take as-is', () => {
    expect(isExpressibleUrlFilter('||ads.example^')).toBe(true);
    expect(isExpressibleUrlFilter('/banner/ads/')).toBe(true);
    expect(isExpressibleUrlFilter('|https://cdn.example/ad.js|')).toBe(true);
    expect(isExpressibleUrlFilter('&ad_unit=*^')).toBe(true);
  });

  it('rejects what DNR refuses or what would match far too much', () => {
    expect(isExpressibleUrlFilter('||*.example^')).toBe(false); // leading ||*
    expect(isExpressibleUrlFilter('||müller.example^')).toBe(false); // non-ASCII
    expect(isExpressibleUrlFilter('-ad')).toBe(false); // too short
    expect(isExpressibleUrlFilter('a|b/ads/')).toBe(false); // '|' mid-pattern
    expect(isExpressibleUrlFilter('||-bad.example^')).toBe(false);
  });
});

describe('parseABP with adblock-syntax sources (urlRules)', () => {
  it('keeps path rules only when urlRules is on', () => {
    expect(parseABP('/ads/banner-\n').rules).toHaveLength(0);
    const { rules } = parseABP('/ads/banner-\n', { urlRules: true });
    expect(rules[0].urlFilter).toBe('/ads/banner-');
  });

  it('splits options off a path that starts with a slash', () => {
    // A leading '/' was once read as an open regex, so '$domain=' shipped as
    // part of the URL: a dead rule with its scoping silently lost.
    const { rules } = parseABP('/adframe.$domain=news.example\n', { urlRules: true });
    expect(rules[0].urlFilter).toBe('/adframe.');
    expect(rules[0].initiatorDomains).toEqual(['news.example']);
  });

  it('skips /regex/ rules that carry options', () => {
    const { rules, stats } = parseABP('/^https?:\\/\\/ad[0-9]+\\./$script\n', { urlRules: true });
    expect(rules).toHaveLength(0);
    expect(stats.regex).toBe(1);
  });

  it('maps negated types onto excludedResourceTypes', () => {
    const { rules } = parseABP('/adframe.$~script,~image\n', { urlRules: true });
    expect(rules[0].resourceTypes).toEqual([]);
    expect(rules[0].excludedResourceTypes.sort()).toEqual(['image', 'script']);
  });

  it('lets positive types win over negations', () => {
    const { rules } = parseABP('/adframe.$script,~image\n', { urlRules: true });
    expect(rules[0].resourceTypes).toEqual(['script']);
    expect(rules[0].excludedResourceTypes).toEqual([]);
  });

  it('understands uBO aliases for types and party', () => {
    const { rules } = parseABP('||ads.example^$xhr,frame,3p\n||own.example^$1p\n');
    expect(rules[0].resourceTypes.sort()).toEqual(['sub_frame', 'xmlhttprequest']);
    expect(rules[0].domainType).toBe('thirdParty');
    expect(rules[1].domainType).toBe('firstParty');
  });

  it('drops a rule scoped to an entity domain rather than broadening it', () => {
    const { rules, stats } = parseABP('||ads.example^$domain=google.*|news.example\n');
    expect(rules).toHaveLength(0);
    expect(stats.unsupported).toBe(1);
  });

  it('turns an $elemhide exception into a cosmetic-off host, not a network allow', () => {
    const { rules, cosmeticDisabledHosts } = parseABP('@@||shop.example^$elemhide\n@@||blog.example^$specifichide\n');
    expect(rules).toHaveLength(0);
    expect([...cosmeticDisabledHosts].sort()).toEqual(['blog.example', 'shop.example']);
  });
});

describe('buildRule with excluded types', () => {
  it('excludes main_frame explicitly, since excludedResourceTypes replaces the default', () => {
    const rule = buildRule(1, {
      urlFilter: '/adframe.', exception: false, important: false, domainType: null,
      resourceTypes: [], excludedResourceTypes: ['script'],
      initiatorDomains: [], excludedInitiatorDomains: [], caseSensitive: false
    }, DEFAULTS);
    expect(rule.condition.resourceTypes).toBeUndefined();
    expect(rule.condition.excludedResourceTypes.sort()).toEqual(['main_frame', 'script']);
  });
});

describe('site-specific element hiding', () => {
  it('rejects selectors that could escape their CSS rule or need a script', () => {
    expect(isSafeSelector('.ad-slot > div')).toBe(true);
    expect(isSafeSelector('div:has(> .sponsored)')).toBe(true);
    expect(isSafeSelector('.x{} body{display:none')).toBe(false);
    expect(isSafeSelector('.a /* */')).toBe(false);
    expect(isSafeSelector('+js(set, ads, true)')).toBe(false);
    expect(isSafeSelector('div:has-text(Sponsored)')).toBe(false);
    expect(isSafeSelector('div:-abp-has(.ad)')).toBe(false);
  });

  it('keeps site-specific rules and leaves generic ones out', () => {
    const parsed = parseCosmetic('news.example,blog.example##.promo\n##.ad-banner\n');
    expect([...parsed.hide.get('news.example')]).toEqual(['.promo']);
    expect([...parsed.hide.get('blog.example')]).toEqual(['.promo']);
    expect(parsed.hide.size).toBe(2);
    expect(parsed.stats.generic).toBe(1);
  });

  it('turns ~domain and #@# into unhide entries', () => {
    const parsed = parseCosmetic('example.com,~shop.example.com##.promo\nnews.example#@#.promo\n');
    expect([...parsed.unhide.get('shop.example.com')]).toEqual(['.promo']);
    expect([...parsed.unhide.get('news.example')]).toEqual(['.promo']);
  });

  it('skips extended, scriptlet and entity-domain rules', () => {
    const parsed = parseCosmetic('google.*##.ad\nnews.example#?#div:has-text(Ad)\nnews.example##+js(noeval)\n');
    expect(parsed.hide.size).toBe(0);
    expect(parsed.stats.unsupported).toBe(3);
  });

  it('builds one table with each selector stored once', () => {
    const a = parseCosmetic('one.example##.promo\n');
    const b = parseCosmetic('two.example##.promo\ntwo.example##.side-ad\n');
    const table = buildCosmeticTable([a, b], new Set(['shop.example']));
    expect(table.selectors).toEqual(['.promo', '.side-ad']);
    expect(table.hide['one.example']).toEqual([0]);
    expect(table.hide['two.example']).toEqual([0, 1]);
    expect(table.disabled).toEqual(['shop.example']);
  });
});
