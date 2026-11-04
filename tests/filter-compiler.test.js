// Tests for the ABP -> declarativeNetRequest compiler.
// These assert semantics, not just "the file parsed": dropping a modifier or
// broadening a rule is the exact failure mode this compiler had.

import { describe, it, expect } from 'vitest';
import { parseABP, buildRule } from '../scripts/build-blocklists.mjs';

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
