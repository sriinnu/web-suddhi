/**
 * @file scripts/build-dist.js
 * @description Post-rollup build script that assembles the complete
 * distributable extension under dist/.
 *
 * Steps:
 *   1. Copies static assets (HTML, CSS, icons, rules, _metadata) into dist/.
 *   2. Copies the manifest (with JS paths updated to dist bundle paths).
 *   3. Rollup bundles are already written to dist/ by rollup.config.js.
 *
 * Usage:
 *   node scripts/build-dist.js            # Chrome MV3 (default)
 *   node scripts/build-dist.js --mv2      # Firefox MV2
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');

const isMV2 = process.argv.includes('--mv2');

// ============================================
// 1. Copy static assets
// ============================================

/** Copy a file/dir into dist, creating parent dirs. */
function copy(src, dest) {
  const from = resolve(ROOT, src);
  const to = resolve(DIST, dest || src);
  if (!existsSync(from)) {
    console.warn('  [skip] ' + src + ' (not found)');
    return;
  }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

console.log(`Building dist/ for ${isMV2 ? 'MV2 (Firefox)' : 'MV3 (Chrome)'}...\n`);

// Popup & Options HTML/CSS
copy('popup/popup.html');
copy('popup/popup.css');
copy('options/options.html');
copy('options/options.css');
copy('options/shortcuts.html');
copy('options/shortcuts.js');

// Content CSS
copy('content/ad-blocker.css');

// Icons
copy('icons/icon16.png');
copy('icons/icon32.png');
copy('icons/icon48.png');
copy('icons/icon128.png');
copy('icons/icon16-alert.png');
copy('icons/icon32-alert.png');
copy('icons/icon48-alert.png');
copy('icons/icon128-alert.png');

// DNR rule files
copy('rules');

// _metadata
copy('_metadata');

// Phishing detector (standalone IIFE, loaded via importScripts in background)
copy('background/phishing-detector.js');

// ============================================
// 2. Patch HTML files to reference bundled JS
// ============================================

function patchHtml(htmlPath, jsPath) {
  const file = resolve(DIST, htmlPath);
  if (!existsSync(file)) return;
  let html = readFileSync(file, 'utf8');

  // Replace old script src references with the new bundle path
  // For popup: popup.js → popup/index.js  (relative from popup/ → just index.js)
  // For options: options.js → options/index.js
  const oldJsName = htmlPath.replace('.html', '.js');
  const newJsName = 'index.js';

  html = html.replace(
    new RegExp(`src=["']${oldJsName.split('/').pop()}["']`, 'g'),
    `src="${newJsName}"`
  );
  writeFileSync(file, html, 'utf8');
}

patchHtml('popup/popup.html', 'popup/index.js');
patchHtml('options/options.html', 'options/index.js');

// ============================================
// 3. Write manifest
// ============================================

const manifestSrc = isMV2 ? 'manifest-mv2.json' : 'manifest.json';
const manifest = JSON.parse(readFileSync(resolve(ROOT, manifestSrc), 'utf8'));

if (isMV2) {
  // MV2: background.scripts → single bundle
  manifest.background = {
    scripts: ['background/index.js'],
    persistent: true,
  };
  // Content scripts → bundled
  manifest.content_scripts = [
    {
      matches: ['<all_urls>'],
      js: ['content/index.js'],
      css: ['content/ad-blocker.css'],
      run_at: 'document_start',
      all_frames: true,
    },
  ];
} else {
  // MV3: service_worker → bundle
  manifest.background = {
    service_worker: 'background/index.js',
  };
  manifest.content_scripts = [
    {
      matches: ['<all_urls>'],
      js: ['content/index.js'],
      css: ['content/ad-blocker.css'],
      run_at: 'document_start',
      all_frames: true,
    },
  ];
}

writeFileSync(resolve(DIST, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log('\nDone! Extension ready in dist/');
