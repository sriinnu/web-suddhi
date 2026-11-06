#!/usr/bin/env node
/**
 * Bumps the build number before every browser build, so each load in the
 * browser shows a new version.
 *
 *   version       3.0.12        what the browser compares (no leading zeros allowed)
 *   version_name  3.00.0012     what people see: major.mm.bbbb
 *
 * Writes manifest.json, manifest-mv2.json and package.json. Firefox does not
 * read version_name, so the MV2 manifest only gets the plain version.
 *
 * Usage: node scripts/bump-version.mjs [--print]
 *   --print  show the current version without bumping.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function displayVersion(version) {
  const [major = 0, minor = 0, build = 0] = String(version).split('.').map(Number);
  return `${major}.${String(minor).padStart(2, '0')}.${String(build).padStart(4, '0')}`;
}

export function nextVersion(version) {
  const [major = 0, minor = 0, build = 0] = String(version).split('.').map(Number);
  return `${major}.${minor}.${build + 1}`;
}

function rewrite(file, update) {
  const path = join(ROOT, file);
  const json = JSON.parse(readFileSync(path, 'utf8'));
  update(json);
  // Keep version_name right under version.
  const ordered = {};
  for (const [key, value] of Object.entries(json)) {
    if (key === 'version_name') continue;
    ordered[key] = value;
    if (key === 'version' && 'version_name' in json) ordered.version_name = json.version_name;
  }
  writeFileSync(path, JSON.stringify(ordered, null, 2) + '\n');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const current = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')).version;
  if (process.argv.includes('--print')) {
    console.log(displayVersion(current));
  } else {
    const version = nextVersion(current);
    const name = displayVersion(version);
    rewrite('manifest.json', (m) => { m.version = version; m.version_name = name; });
    rewrite('manifest-mv2.json', (m) => { m.version = version; });
    rewrite('package.json', (p) => { p.version = version; });
    console.log(`Version ${name} (${version})`);
  }
}
