import { chromium } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const EXT_PATH = path.resolve(here, '../../dist/browser/chromium');

// 1x1 red PNG
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * Launch Chromium with the unpacked extension loaded.
 * Uses Playwright's bundled chromium in new-headless mode (channel 'chromium'
 * supports extensions). Set E2E_HEADED=1 to run headed (needs display / xvfb).
 */
export async function launchWithExtension(extraArgs = []) {
  if (!fs.existsSync(path.join(EXT_PATH, 'manifest.json'))) {
    throw new Error(`Extension not built at ${EXT_PATH}. Run: npm run build:targets`);
  }
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-e2e-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: process.env.E2E_HEADED !== '1',
    ignoreHTTPSErrors: true,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      '--ignore-certificate-errors',
      ...extraArgs,
    ],
  });
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15000 });
  // Let the service worker register defaults / rulesets.
  await new Promise((r) => setTimeout(r, 1500));
  return { context, userDataDir, sw };
}
