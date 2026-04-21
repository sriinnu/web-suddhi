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

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
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
  // Fetch all sources
  const enabledSources = sources.filter(s => s.enabled);
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

  if (totalRules > settings.totalBudget) {
    console.log(`\n  [trim] ${totalRules} rules exceeds budget of ${settings.totalBudget}`);
    const ratio = settings.totalBudget / totalRules;
    for (const cat of Object.keys(categoryDomains)) {
      const before = categoryDomains[cat].length;
      categoryDomains[cat] = categoryDomains[cat].slice(0, Math.floor(before * ratio));
      if (VERBOSE) console.log(`    ${cat}: ${before} → ${categoryDomains[cat].length}`);
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

  console.log('\n  Done. Update manifest.json with the entries from generated-manifest-snippet.json');
  console.log(`  Total: ${totalRules.toLocaleString()} rules across ${manifestEntries.length} rulesets\n`);
}

main().catch(e => {
  console.error('Build failed:', e);
  process.exit(1);
});
