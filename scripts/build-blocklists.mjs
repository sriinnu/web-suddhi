#!/usr/bin/env node
/**
 * WebSuddhi Blocklist Compiler
 *
 * Downloads upstream filter lists (HaGeZi, AdGuard, PhishTank etc.),
 * parses ABP syntax, deduplicates against hand-curated rules, and
 * outputs MV3 declarativeNetRequest static ruleset JSON files.
 *
 * Usage: node scripts/build-blocklists.mjs [--no-cache] [--dry-run] [--verbose]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RULES_DIR = join(ROOT, 'rules');
const CACHE_DIR = join(RULES_DIR, '.cache');

const args = process.argv.slice(2);
const NO_CACHE = args.includes('--no-cache');
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

// ============================================
// Stage 1: Load config
// ============================================
const config = JSON.parse(readFileSync(join(RULES_DIR, 'sources.json'), 'utf8'));
const { sources, categories, settings } = config;

// Printed from main() so importing this module for tests stays quiet.
function printBanner() {
  console.log('\n  WebSuddhi Blocklist Compiler v1.0');
  console.log('  ─────────────────────────────────');
  console.log(`  Sources: ${sources.filter(s => s.enabled).length}`);
  console.log(`  Budget: ${settings.totalBudget.toLocaleString()} rules\n`);
}

// ============================================
// Stage 2: Fetch upstream lists
// ============================================
mkdirSync(CACHE_DIR, { recursive: true });

async function fetchSource(source) {
  const cachePath = join(CACHE_DIR, source.id + '.txt');

  if (!NO_CACHE && existsSync(cachePath)) {
    const stat = readFileSync(cachePath, 'utf8');
    if (stat.length > 100) {
      if (VERBOSE) console.log(`  [cache] ${source.id}`);
      return stat;
    }
  }

  console.log(`  [fetch] ${source.name}...`);
  try {
    const resp = await fetch(source.url, {
      headers: { 'Accept': 'text/plain, */*', 'User-Agent': 'WebSuddhi-BlocklistCompiler/1.0' }
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    writeFileSync(cachePath, text, 'utf8');
    console.log(`  [ok]    ${source.id} — ${(text.length / 1024).toFixed(0)} KB`);
    return text;
  } catch (e) {
    console.error(`  [fail]  ${source.id}: ${e.message}`);
    // Fall back to cache
    if (existsSync(cachePath)) {
      console.log(`  [cache] Using stale cache for ${source.id}`);
      return readFileSync(cachePath, 'utf8');
    }
    return '';
  }
}

// ============================================
// Stage 3: Parse ABP syntax
// ============================================
// ABP modifiers we can express in declarativeNetRequest.
const ABP_RESOURCE_TYPES = {
  script: 'script',
  image: 'image',
  stylesheet: 'stylesheet',
  font: 'font',
  media: 'media',
  websocket: 'websocket',
  ping: 'ping',
  xmlhttprequest: 'xmlhttprequest',
  subdocument: 'sub_frame',
  object: 'object',
  document: 'main_frame',
  other: 'other'
};

// Modifiers with no DNR equivalent. A rule carrying one is DROPPED, never
// broadened — turning `$popup` into a global block is worse than no rule.
const UNSUPPORTED_MODIFIERS = new Set([
  'popup', 'csp', 'redirect', 'redirect-rule', 'removeparam', 'rewrite',
  'elemhide', 'generichide', 'specifichide', 'inline-script', 'inline-font',
  'all', 'genericblock', 'strict1p', 'strict3p', 'denyallow', 'method'
]);

function splitRuleOptions(line) {
  // The options block starts at the last '$' that is outside a /regex/ literal.
  let inRegex = false;
  let splitAt = -1;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '/' && line[i - 1] !== '\\') inRegex = !inRegex;
    if (char === '$' && !inRegex) splitAt = i;
  }
  if (splitAt === -1) return { pattern: line, options: [] };

  return {
    pattern: line.slice(0, splitAt),
    options: line.slice(splitAt + 1).split(',').map((option) => option.trim()).filter(Boolean)
  };
}

/**
 * Parse ABP text into rule objects that keep their semantics.
 * Returns { rules, badfilters, stats }.
 */
export function parseABP(text) {
  const rules = [];
  const badfilters = new Set();
  const stats = { lines: 0, kept: 0, cosmetic: 0, regex: 0, unsupported: 0, malformed: 0 };

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('!') || line.startsWith('[')) continue;
    stats.lines += 1;

    if (line.includes('##') || line.includes('#@#') || line.includes('#?#')) {
      stats.cosmetic += 1;
      continue;
    }
    if (line.startsWith('/') && line.endsWith('/')) {
      // Regex rules have a hard 1,000-per-type cap and are easy to get wrong.
      stats.regex += 1;
      continue;
    }

    const exception = line.startsWith('@@');
    const body = exception ? line.slice(2) : line;
    const { pattern, options } = splitRuleOptions(body);

    // Only `||host` / `||host^` / `||host/path` shapes are accepted.
    if (!/^\|\|[a-z0-9]/i.test(pattern)) {
      stats.malformed += 1;
      continue;
    }

    const rule = {
      urlFilter: pattern.toLowerCase(),
      exception,
      important: false,
      domainType: null,
      resourceTypes: [],
      initiatorDomains: [],
      excludedInitiatorDomains: [],
      caseSensitive: false
    };

    let unsupported = false;

    for (const option of options) {
      const lower = option.toLowerCase();

      if (lower === 'badfilter') {
        badfilters.add(rule.urlFilter);
        unsupported = true;
        break;
      }
      if (lower === 'third-party') { rule.domainType = 'thirdParty'; continue; }
      if (lower === '~third-party') { rule.domainType = 'firstParty'; continue; }
      if (lower === 'first-party') { rule.domainType = 'firstParty'; continue; }
      if (lower === 'important') { rule.important = true; continue; }
      if (lower === 'match-case') { rule.caseSensitive = true; continue; }

      if (lower.startsWith('domain=')) {
        for (const entry of lower.slice('domain='.length).split('|')) {
          if (!entry) continue;
          if (entry.startsWith('~')) rule.excludedInitiatorDomains.push(entry.slice(1));
          else rule.initiatorDomains.push(entry);
        }
        continue;
      }

      if (lower.startsWith('~')) { unsupported = true; break; } // negated type — cannot express
      if (ABP_RESOURCE_TYPES[lower]) { rule.resourceTypes.push(ABP_RESOURCE_TYPES[lower]); continue; }
      if (UNSUPPORTED_MODIFIERS.has(lower)) { unsupported = true; break; }

      // Unknown modifier: keep the rule only if it is a bare host block.
      unsupported = true;
      break;
    }

    if (unsupported) {
      stats.unsupported += 1;
      continue;
    }

    rule.resourceTypes = [...new Set(rule.resourceTypes)];
    rules.push(rule);
    stats.kept += 1;
  }

  return { rules, badfilters, stats };
}

// ============================================
// Stage 4: Load existing hand-curated domains
// ============================================
function loadExistingDomains() {
  const existing = new Set();

  for (const file of ['ad-domains.json', 'tracking-domains.json']) {
    const path = join(RULES_DIR, file);
    if (!existsSync(path)) continue;

    try {
      const rules = JSON.parse(readFileSync(path, 'utf8'));
      for (const rule of rules) {
        const filter = rule.condition?.urlFilter || '';
        const domain = filter.replace(/^\|\|/, '').replace(/\^$/, '').toLowerCase();
        if (domain && domain.includes('.')) {
          existing.add(domain);
        }
      }
    } catch (e) {
      console.warn(`  [warn] Could not parse ${file}: ${e.message}`);
    }
  }

  console.log(`  [info] ${existing.size} existing hand-curated domains\n`);
  return existing;
}

// ============================================
// Stage 5: Build and write rulesets
// ============================================
// Priority ladder. DNR evaluates higher priority first; on a tie, allow wins.
const PRIORITY = {
  block: 1,
  allow: 100,
  importantBlock: 200,
  importantAllow: 300
};

export function buildRule(id, rule, defaultResourceTypes) {
  const condition = {
    urlFilter: rule.urlFilter,
    resourceTypes: rule.resourceTypes.length ? rule.resourceTypes : defaultResourceTypes
  };

  if (rule.domainType) condition.domainType = rule.domainType;
  if (rule.initiatorDomains.length) condition.initiatorDomains = rule.initiatorDomains;
  if (rule.excludedInitiatorDomains.length) {
    condition.excludedInitiatorDomains = rule.excludedInitiatorDomains;
  }
  if (rule.caseSensitive) condition.isUrlFilterCaseSensitive = true;

  const priority = rule.exception
    ? (rule.important ? PRIORITY.importantAllow : PRIORITY.allow)
    : (rule.important ? PRIORITY.importantBlock : PRIORITY.block);

  return {
    id,
    priority,
    action: { type: rule.exception ? 'allow' : 'block' },
    condition
  };
}

async function main() {
  printBanner();

  // Process in category-priority order. Dedup is first-wins, so an ads source
  // running first would claim domains that security feeds also list, and the
  // ads trim would then throw them away entirely.
  const priorityOrder = settings.categoryPriority || [];
  const enabledSources = sources
    .filter(s => s.enabled)
    .slice()
    .sort((a, b) => {
      const rank = (source) => {
        const index = priorityOrder.indexOf(source.category || 'ads');
        return index === -1 ? priorityOrder.length : index;
      };
      return rank(a) - rank(b);
    });
  const rawTexts = await Promise.all(enabledSources.map(s => fetchSource(s)));

  // Parse every source first so `$badfilter` can cancel rules from any feed.
  const parsedSources = rawTexts.map((text) => (
    text ? parseABP(text) : { rules: [], badfilters: new Set(), stats: {} }
  ));
  const allBadfilters = new Set();
  for (const parsed of parsedSources) {
    for (const filter of parsed.badfilters) allBadfilters.add(filter);
  }

  const existing = loadExistingDomains();
  const globalSeen = new Set(existing); // curated bare domains already covered
  const globalRuleKeys = new Set();
  const categoryDomains = {};

  const ruleKey = (rule) => [
    rule.urlFilter,
    rule.domainType || '',
    rule.resourceTypes.slice().sort().join(','),
    rule.initiatorDomains.join(','),
    rule.excludedInitiatorDomains.join(','),
    rule.exception ? 'allow' : 'block'
  ].join('|');

  for (let i = 0; i < enabledSources.length; i++) {
    const source = enabledSources[i];
    const { rules, stats } = parsedSources[i];
    if (!rules || rules.length === 0) continue;

    const maxDomains = source.maxDomains || Infinity;
    let added = 0;
    const cat = source.category || 'ads';
    if (!categoryDomains[cat]) categoryDomains[cat] = [];

    for (const rule of rules) {
      if (allBadfilters.has(rule.urlFilter)) continue;

      const key = ruleKey(rule);
      if (globalRuleKeys.has(key)) continue;

      // A bare block is redundant if the hand-curated lists already cover it.
      const isBareBlock = !rule.exception && !rule.domainType &&
        rule.resourceTypes.length === 0 && rule.initiatorDomains.length === 0;
      if (isBareBlock) {
        const bare = rule.urlFilter.replace(/^\|\|/, '').replace(/\^$/, '');
        if (globalSeen.has(bare)) continue;
      }

      if (added >= maxDomains) break;
      globalRuleKeys.add(key);
      if (isBareBlock) globalSeen.add(rule.urlFilter.replace(/^\|\|/, '').replace(/\^$/, ''));
      categoryDomains[cat].push(rule);
      added++;
    }

    console.log(
      `  ${source.id.padEnd(20)} ${String(stats.lines).padStart(7)} lines → ${String(added).padStart(6)} new` +
      ` (kept ${stats.kept}, cosmetic ${stats.cosmetic} skipped, ${stats.unsupported} unsupported, ${stats.regex} regex)`
    );
  }

  // Enforce total budget
  let totalRules = 0;
  for (const cat of Object.keys(categoryDomains)) {
    totalRules += categoryDomains[cat].length;
  }

  // Chrome only guarantees 30,000 static rules — and the curated rulesets count
  // toward it too, so the generated pass has to leave room for them.
  const CURATED_FILES = ['ad-domains.json', 'tracking-domains.json', 'tracking-params.json'];
  const curatedRuleCount = CURATED_FILES.reduce((sum, file) => {
    try {
      return sum + JSON.parse(readFileSync(join(RULES_DIR, file), 'utf8')).length;
    } catch (e) {
      return sum;
    }
  }, 0);
  const guaranteedStaticRules = 30000;
  const budget = Math.min(settings.totalBudget, guaranteedStaticRules - curatedRuleCount);

  if (totalRules > budget) {
    console.log(`\n  [trim] ${totalRules} rules exceeds budget of ${budget}`);
    // Trim by priority, not proportionally. A proportional cut silently drops
    // malware/phishing entries at the same rate as ad entries.
    const priority = settings.categoryPriority || Object.keys(categoryDomains);
    let remaining = Math.max(0, budget);

    for (const cat of priority) {
      if (!categoryDomains[cat]) continue;
      const before = categoryDomains[cat].length;
      categoryDomains[cat] = categoryDomains[cat].slice(0, Math.max(0, remaining));
      remaining -= categoryDomains[cat].length;
      if (VERBOSE || before !== categoryDomains[cat].length) {
        console.log(`    ${cat}: ${before} → ${categoryDomains[cat].length}`);
      }
    }

    for (const cat of Object.keys(categoryDomains)) {
      if (!priority.includes(cat)) categoryDomains[cat] = [];
    }

    totalRules = Object.values(categoryDomains).reduce((s, d) => s + d.length, 0);
  }

  console.log(`\n  Total new rules: ${totalRules.toLocaleString()}`);

  if (DRY_RUN) {
    console.log('  [dry-run] No files written.\n');
    return;
  }

  // Write ruleset files
  const manifestEntries = [];
  const resourceTypes = settings.resourceTypes;

  for (const [cat, domains] of Object.entries(categoryDomains)) {
    const catConfig = categories[cat];
    if (!catConfig) {
      console.warn(`  [warn] No category config for '${cat}', skipping`);
      continue;
    }

    const chunks = [];
    for (let i = 0; i < domains.length; i += settings.maxRulesPerFile) {
      chunks.push(domains.slice(i, i + settings.maxRulesPerFile));
    }

    for (let c = 0; c < chunks.length; c++) {
      const chunk = chunks[c];
      const fileNum = c + 1;
      const fileName = `generated-${cat}-${fileNum}.json`;
      const startId = catConfig.idStart + (c * settings.maxRulesPerFile);

      const rules = chunk.map((entry, idx) =>
        buildRule(startId + idx, entry, resourceTypes)
      );

      const filePath = join(RULES_DIR, fileName);
      writeFileSync(filePath, JSON.stringify(rules, null, 0), 'utf8');

      const sizeKB = (JSON.stringify(rules).length / 1024).toFixed(0);
      console.log(`  [write] ${fileName} — ${rules.length} rules (${sizeKB} KB)`);

      manifestEntries.push({
        id: `generated_${cat}_${fileNum}`,
        enabled: true,
        path: `rules/${fileName}`
      });
    }
  }

  // Write manifest snippet
  const snippetPath = join(RULES_DIR, 'generated-manifest-snippet.json');
  writeFileSync(snippetPath, JSON.stringify(manifestEntries, null, 2), 'utf8');
  console.log(`\n  [write] generated-manifest-snippet.json (${manifestEntries.length} rulesets)`);

  // Write provenance
  const provenance = {};
  for (const [cat, domains] of Object.entries(categoryDomains)) {
    for (const rule of domains) provenance[rule.urlFilter] = cat;
  }
  const provPath = join(RULES_DIR, 'provenance.json');
  writeFileSync(provPath, JSON.stringify(provenance, null, 0), 'utf8');

  // Keep the manifest in step with what we actually wrote. Hand-maintaining the
  // ruleset list meant half the generated chunks were never loaded, and entries
  // pointed at files that no longer existed.
  const manifestPath = join(ROOT, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const dnr = manifest.declarative_net_request || {};
  const handCurated = (dnr.rule_resources || []).filter(
    (resource) => resource && !String(resource.id).startsWith('generated_')
  );

  dnr.rule_resources = [...handCurated, ...manifestEntries];
  manifest.declarative_net_request = dnr;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`  [write] manifest.json — ${handCurated.length} curated + ${manifestEntries.length} generated rulesets`);

  // MV2/Firefox has no declarativeNetRequest — hand it the same domains as a
  // flat array so the webRequest listener can use the full blocklist.
  // Rule counts per ruleset, so the UI can show real numbers without parsing
  // ~9 MB of JSON on every service-worker start.
  const rulesetCounts = {};
  for (const entry of handCurated) {
    try {
      rulesetCounts[entry.id] = JSON.parse(readFileSync(join(ROOT, entry.path), 'utf8')).length;
    } catch (e) {
      rulesetCounts[entry.id] = 0;
    }
  }
  for (const entry of manifestEntries) {
    rulesetCounts[entry.id] = JSON.parse(readFileSync(join(ROOT, entry.path), 'utf8')).length;
  }
  writeFileSync(join(RULES_DIR, 'ruleset-counts.json'), `${JSON.stringify(rulesetCounts, null, 2)}\n`, 'utf8');
  console.log('  [write] ruleset-counts.json');

  const mv2DomainsFile = 'generated-mv2-domains.json';
  writeFileSync(
    join(RULES_DIR, mv2DomainsFile),
    JSON.stringify([...new Set(
      Object.values(categoryDomains)
        .flat()
        .filter((rule) => !rule.exception)
        .map((rule) => rule.urlFilter.replace(/^\|\|/, '').replace(/\^$/, ''))
    )]),
    'utf8'
  );
  console.log(`  [write] ${mv2DomainsFile} — ${totalRules.toLocaleString()} domains for MV2`);

  const installedTotal = curatedRuleCount + totalRules;
  if (installedTotal > guaranteedStaticRules) {
    console.error(
      `  [fail] ${installedTotal} installed static rules exceeds Chrome's ${guaranteedStaticRules} guarantee`
    );
    process.exit(1);
  }
  console.log(`  [check] ${installedTotal} installed static rules (limit ${guaranteedStaticRules.toLocaleString()})`);

  // Remove generated files from earlier runs that we no longer produce.
  const written = new Set(manifestEntries.map((entry) => entry.path.split('/').pop()));
  written.add(mv2DomainsFile);
  for (const file of readdirSync(RULES_DIR)) {
    if (file.startsWith('generated-') && file.endsWith('.json') &&
        file !== 'generated-manifest-snippet.json' && !written.has(file)) {
      rmSync(join(RULES_DIR, file));
      console.log(`  [clean] ${file}`);
    }
  }

  console.log('\n  Done.');
  console.log(`  Total: ${totalRules.toLocaleString()} rules across ${manifestEntries.length} rulesets\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(e => {
    console.error('Build failed:', e);
    process.exit(1);
  });
}
