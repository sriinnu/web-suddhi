import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { buildBrowserTargets, getBrowserTargets } from '../scripts/build-browser-targets.mjs';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(TEST_DIR, '..');

it('generates Chromium, Firefox, and Safari bundles from the shared source tree', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'websuddhi-targets-'));
  const targets = getBrowserTargets(ROOT_DIR);

  try {
    for (const target of Object.values(targets)) {
      target.outDir = join(tempDir, target.label.toLowerCase());
    }

    const results = buildBrowserTargets({ rootDir: ROOT_DIR, targets });
    expect(results).toHaveLength(3);

    const safariManifestPath = join(targets.safari.outDir, 'manifest.json');
    const firefoxManifestPath = join(targets.firefox.outDir, 'manifest.json');
    const chromiumManifestPath = join(targets.chromium.outDir, 'manifest.json');

    expect(existsSync(safariManifestPath)).toBe(true);
    expect(existsSync(firefoxManifestPath)).toBe(true);
    expect(existsSync(chromiumManifestPath)).toBe(true);
    expect(existsSync(join(targets.safari.outDir, 'fonts', 'fonts.css'))).toBe(true);

    const safariManifest = JSON.parse(readFileSync(safariManifestPath, 'utf8'));
    const firefoxManifest = JSON.parse(readFileSync(firefoxManifestPath, 'utf8'));
    const chromiumManifest = JSON.parse(readFileSync(chromiumManifestPath, 'utf8'));

    expect(chromiumManifest.manifest_version).toBe(3);
    expect(firefoxManifest.manifest_version).toBe(2);
    expect(safariManifest.manifest_version).toBe(3);
    expect(safariManifest.permissions).not.toContain('contextMenus');
    expect(safariManifest.optional_permissions || []).not.toContain('contentSettings');
    expect(safariManifest.optional_permissions || []).not.toContain('privacy');
    expect(safariManifest.optional_permissions || []).not.toContain('declarativeNetRequestFeedback');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
