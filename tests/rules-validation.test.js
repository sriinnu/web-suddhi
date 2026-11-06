// Validates the shipped declarativeNetRequest rulesets.
// Nothing else in this repo touches rules/*.json, so a malformed filter, a
// duplicate id, or an over-budget build used to ship silently.

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(ROOT_DIR, 'manifest.json'), 'utf8'));
const resources = manifest.declarative_net_request.rule_resources;

const VALID_RESOURCE_TYPES = new Set([
  'main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font',
  'object', 'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket',
  'webtransport', 'webbundle', 'other'
]);

// Chrome guarantees 30,000 enabled static rules per extension.
const STATIC_RULE_GUARANTEE = 30000;

function loadRules(path) {
  return JSON.parse(readFileSync(join(ROOT_DIR, path), 'utf8'));
}

describe('declarativeNetRequest rulesets', () => {
  it('declares rulesets whose files all exist and parse', () => {
    expect(resources.length).toBeGreaterThan(0);

    for (const resource of resources) {
      const path = join(ROOT_DIR, resource.path);
      expect(existsSync(path), `missing ${resource.path}`).toBe(true);
      expect(Array.isArray(loadRules(resource.path)), `${resource.path} is not an array`).toBe(true);
    }
  });

  it('uses unique, positive rule ids within each ruleset', () => {
    for (const resource of resources) {
      const ids = loadRules(resource.path).map((rule) => rule.id);
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

      expect(duplicates, `${resource.id} duplicate ids`).toEqual([]);
      expect(ids.every((id) => Number.isInteger(id) && id > 0), `${resource.id} bad id`).toBe(true);
    }
  });

  it('gives every rule a valid action, priority and condition', () => {
    // One expect over a list of problems instead of ~5 expects x ~30k rules:
    // the per-rule expects made this the slowest test (and flaky at 5s), and a
    // failure now names every bad rule at once.
    const ACTIONS = new Set(['block', 'allow', 'redirect', 'modifyHeaders']);
    const problems = [];
    for (const resource of resources) {
      for (const rule of loadRules(resource.path)) {
        const where = resource.path + '#' + rule.id;
        if (!ACTIONS.has(rule.action?.type)) problems.push(where + ': action ' + rule.action?.type);
        if (!(Number.isInteger(rule.priority) && rule.priority >= 1)) problems.push(where + ': priority ' + rule.priority);

        const condition = rule.condition || {};
        if (!(condition.urlFilter || condition.regexFilter)) problems.push(where + ': no urlFilter/regexFilter');

        const types = condition.resourceTypes;
        if (types !== undefined) {
          if (!(Array.isArray(types) && types.length > 0)) problems.push(where + ': empty resourceTypes');
          else for (const type of types) if (!VALID_RESOURCE_TYPES.has(type)) problems.push(where + ': bad type ' + type);
        }
      }
    }
    expect(problems.slice(0, 50)).toEqual([]);
  });

  it('anchors host filters so they cannot match a lookalike domain', () => {
    // `||doubleclick.net` also matches doubleclick.network; every curated and
    // generated host filter must carry the '^' separator.
    for (const resource of resources) {
      for (const rule of loadRules(resource.path)) {
        const filter = rule.condition?.urlFilter || '';
        if (!filter.startsWith('||')) continue;
        // `||host*path=` is a list author's deliberate wildcard, not a bare host.
        const hasSeparator = filter.includes('^') || filter.includes('/') || filter.includes('*');
        expect(hasSeparator, `${resource.id}: ${filter} has no '^' anchor`).toBe(true);
      }
    }
  });

  it('stays inside the static rule budget', () => {
    const total = resources.reduce((sum, resource) => sum + loadRules(resource.path).length, 0);
    expect(total).toBeLessThanOrEqual(STATIC_RULE_GUARANTEE);
  });

  it('keeps ruleset-counts.json in step with the actual files', () => {
    const counts = JSON.parse(readFileSync(join(ROOT_DIR, 'rules', 'ruleset-counts.json'), 'utf8'));

    for (const resource of resources) {
      expect(counts[resource.id], `no count for ${resource.id}`).toBe(loadRules(resource.path).length);
    }
  });

  it('does not block top-level navigations with ad rules', () => {
    // Ad/tracking rules must never cancel a main_frame load; that is how you
    // turn a blocked banner into an unrecoverable blank page.
    const adRulesets = resources.filter((resource) => !resource.id.includes('security'));

    for (const resource of adRulesets) {
      for (const rule of loadRules(resource.path)) {
        if (rule.action.type !== 'block') continue;
        expect(rule.condition.resourceTypes || []).not.toContain('main_frame');
      }
    }
  });
});
