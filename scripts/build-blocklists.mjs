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

console.log('\n  WebSuddhi Blocklist Compiler v1.0');
console.log('  ─────────────────────────────────');
console.log(`  Sources: ${sources.filter(s => s.enabled).length}`);
console.log(`  Budget: ${settings.totalBudget.toLocaleString()} rules\n`);

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
function parseABP(text) {
  const domains = [];
  const re = /^\|\|([a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)+)\^?(\$.*)?$/i;

  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('!') || t.startsWith('[') || t.startsWith('@@')) continue;
    if (t.includes('##') || t.includes('#@#') || t.includes('#?#')) continue;
    if (t.startsWith('/') && t.endsWith('/')) continue;

    const m = t.match(re);
    if (m) {
      const opts = m[5];
      if (opts) {
        const o = opts.substring(1);
        if (o.includes('redirect') || o.includes('csp') || o.includes('rewrite')) continue;
      }
      domains.push(m[1].toLowerCase());
    }
  }

  return [...new Set(domains)];
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
function buildRule(id, domain, resourceTypes) {
  return {
    id,
    priority: 1,
    action: { type: 'block' },
    condition: {
      urlFilter: '||' + domain + '^',
      resourceTypes
    }
  };
}

async function main() {
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

  // Parse and collect domains by category
  const existing = loadExistingDomains();
  const globalSeen = new Set(existing); // Start with existing to dedup
  const categoryDomains = {};

  for (let i = 0; i < enabledSources.length; i++) {
    const source = enabledSources[i];
    const text = rawTexts[i];
    if (!text) continue;

    const allDomains = parseABP(text);
    const maxDomains = source.maxDomains || Infinity;

    let added = 0;
    const cat = source.category || 'ads';
    if (!categoryDomains[cat]) categoryDomains[cat] = [];

    for (const domain of allDomains) {
      if (globalSeen.has(domain)) continue;
      if (added >= maxDomains) break;
      globalSeen.add(domain);
      categoryDomains[cat].push(domain);
      added++;
    }

    console.log(`  ${source.id.padEnd(20)} ${allDomains.length.toString().padStart(7)} parsed → ${added.toString().padStart(6)} new (cap: ${maxDomains === Infinity ? 'none' : maxDomains})`);
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

      const rules = chunk.map((domain, idx) =>
        buildRule(startId + idx, domain, resourceTypes)
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
    for (const d of domains) provenance[d] = cat;
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
    JSON.stringify(Object.values(categoryDomains).flat()),
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

main().catch(e => {
  console.error('Build failed:', e);
  process.exit(1);
});
