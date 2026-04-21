import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT_DIR = resolve(SCRIPT_DIR, '..');
const SOURCE_ENTRIES = [
  'background',
  'content',
  'fonts',
  'icons',
  'options',
  'popup',
  'rules',
  'shared'
];
const STATIC_FILES = ['LICENSE'];
const SAFARI_UNSUPPORTED_PERMISSIONS = new Set(['contextMenus']);
const SAFARI_UNSUPPORTED_OPTIONAL_PERMISSIONS = new Set([
  'contentSettings',
  'privacy',
  'declarativeNetRequestFeedback'
]);

/**
 * I read and parse a JSON file from disk.
 * @param {string} filePath
 * @returns {Record<string, unknown>}
 */
function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

/**
 * I clone JSON-compatible data so target manifests can diverge safely.
 * @template T
 * @param {T} value
 * @returns {T}
 */
function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * I reset a directory before generating a fresh browser bundle.
 * @param {string} dirPath
 */
function resetDirectory(dirPath) {
  rmSync(dirPath, { recursive: true, force: true });
  mkdirSync(dirPath, { recursive: true });
}

/**
 * I create the Safari manifest from the shared MV3 manifest.
 * Safari can share the same source tree, but I strip permissions
 * that are either unsupported on iOS or optional in shared code.
 *
 * @param {Record<string, unknown>} manifest
 * @returns {Record<string, unknown>}
 */
export function createSafariManifest(manifest) {
  const nextManifest = cloneJson(manifest);
  nextManifest.permissions = (nextManifest.permissions || []).filter(
    (permission) => !SAFARI_UNSUPPORTED_PERMISSIONS.has(permission)
  );

  if (Array.isArray(nextManifest.optional_permissions)) {
    const optionalPermissions = nextManifest.optional_permissions.filter(
      (permission) => !SAFARI_UNSUPPORTED_OPTIONAL_PERMISSIONS.has(permission)
    );

    if (optionalPermissions.length > 0) {
      nextManifest.optional_permissions = optionalPermissions;
    } else {
      delete nextManifest.optional_permissions;
    }
  }

  return nextManifest;
}

/**
 * I describe the browser targets generated from the shared source bundle.
 * @param {string} rootDir
 * @returns {Record<string, {label: string, manifest: Record<string, unknown>, outDir: string}>}
 */
export function getBrowserTargets(rootDir = DEFAULT_ROOT_DIR) {
  const mv3Manifest = readJson(join(rootDir, 'manifest.json'));
  const mv2Manifest = readJson(join(rootDir, 'manifest-mv2.json'));

  return {
    chromium: {
      label: 'Chromium',
      manifest: mv3Manifest,
      outDir: join(rootDir, 'dist', 'browser', 'chromium')
    },
    firefox: {
      label: 'Firefox',
      manifest: mv2Manifest,
      outDir: join(rootDir, 'dist', 'browser', 'firefox')
    },
    safari: {
      label: 'Safari',
      manifest: createSafariManifest(mv3Manifest),
      outDir: join(rootDir, 'dist', 'browser', 'safari')
    }
  };
}

/**
 * I generate standalone browser bundles from the shared extension source.
 * @param {{ rootDir?: string, targets?: Record<string, {label: string, manifest: Record<string, unknown>, outDir: string}> }} [options]
 * @returns {Array<{name: string, label: string, outDir: string, manifestVersion: number}>}
 */
export function buildBrowserTargets(options = {}) {
  const rootDir = options.rootDir || DEFAULT_ROOT_DIR;
  const targets = options.targets || getBrowserTargets(rootDir);
  const results = [];

  for (const [name, target] of Object.entries(targets)) {
    resetDirectory(target.outDir);

    for (const entry of SOURCE_ENTRIES) {
      cpSync(join(rootDir, entry), join(target.outDir, entry), { recursive: true });
    }

    for (const fileName of STATIC_FILES) {
      const sourcePath = join(rootDir, fileName);
      if (existsSync(sourcePath)) {
        cpSync(sourcePath, join(target.outDir, fileName));
      }
    }

    writeFileSync(
      join(target.outDir, 'manifest.json'),
      `${JSON.stringify(target.manifest, null, 2)}\n`
    );

    results.push({
      name,
      label: target.label,
      outDir: target.outDir,
      manifestVersion: Number(target.manifest.manifest_version || 0)
    });
  }

  return results;
}

/**
 * I format the CLI summary after target generation.
 * @param {Array<{label: string, outDir: string, manifestVersion: number}>} results
 * @returns {string}
 */
function formatSummary(results) {
  const lines = ['Generated browser bundles:'];

  for (const result of results) {
    lines.push(
      `- ${result.label}: ${result.outDir} (manifest v${result.manifestVersion})`
    );
  }

  lines.push('');
  lines.push(
    'Safari packaging: xcrun safari-web-extension-converter dist/browser/safari --project-location /tmp/websuddhi-safari --no-open --copy-resources'
  );

  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const results = buildBrowserTargets();
  console.log(formatSummary(results));
}
