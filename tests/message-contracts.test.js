import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(TEST_DIR, '..');

function readSource(relativePath) {
  return readFileSync(resolve(ROOT_DIR, relativePath), 'utf8');
}

it('keeps the keyboard shortcut pick-mode contract wired end to end', () => {
  const backgroundSource = readSource('background/background.js');
  const contentSource = readSource('content/ad-blocker.js');

  expect(backgroundSource).toContain("type: 'TOGGLE_PICK_MODE'");
  expect(contentSource).toContain("case 'TOGGLE_PICK_MODE'");
});

it('handles granular site-control messages in background', () => {
  const backgroundSource = readSource('background/background.js');

  expect(backgroundSource).toContain("'GET_SITE_DETAIL'");
  expect(backgroundSource).toContain("'PAUSE_SITE'");
  expect(backgroundSource).toContain("'UNPAUSE_SITE'");
  expect(backgroundSource).toContain("'IS_PAUSED'");
  expect(backgroundSource).toContain("'ALLOW_SELECTOR_ON_SITE'");
  expect(backgroundSource).toContain("'REMOVE_ALLOWED_SELECTOR'");
  expect(backgroundSource).toContain("'CLEAR_SITE_STATS'");
  expect(backgroundSource).toContain("'REPORT_BROKEN_SITE'");
  expect(backgroundSource).toContain("'PREVIEW_SELECTOR'");
});

it('options UI and popup wire granular control messages', () => {
  const optionsSource = readSource('options/options.js');
  const popupSource = readSource('popup/popup.js');

  expect(optionsSource).toContain("'GET_SITE_DETAIL'");
  expect(optionsSource).toContain("'PAUSE_SITE'");
  expect(optionsSource).toContain("'ALLOW_SELECTOR_ON_SITE'");
  expect(optionsSource).toContain("'REMOVE_ALLOWED_SELECTOR'");
  expect(optionsSource).toContain("'CLEAR_SITE_STATS'");
  expect(optionsSource).toContain("'PREVIEW_SELECTOR'");

  expect(popupSource).toContain("'IS_PAUSED'");
  expect(popupSource).toContain("'UNPAUSE_SITE'");
  expect(popupSource).toContain("'REPORT_BROKEN_SITE'");
});

it('content script reacts to pause + allowlist state', () => {
  const contentSource = readSource('content/ad-blocker.js');
  const annoyanceSource = readSource('content/annoyance-blocker.js');

  expect(contentSource).toContain('pausedSites');
  expect(contentSource).toContain('perSiteAllowedSelectors');
  expect(contentSource).toContain("'PREVIEW_SELECTOR_IN_PAGE'");
  expect(annoyanceSource).toContain('category');
});

it('iOS Safari background mirrors granular control handlers', () => {
  const iosBackground = readSource('safari-iOS/WebSuddhi/iOS/WebSuddhi Extension/background.js');

  expect(iosBackground).toContain("'PAUSE_SITE'");
  expect(iosBackground).toContain("'UNPAUSE_SITE'");
  expect(iosBackground).toContain("'IS_PAUSED'");
  expect(iosBackground).toContain("'ALLOW_SELECTOR_ON_SITE'");
  expect(iosBackground).toContain("'REMOVE_ALLOWED_SELECTOR'");
  expect(iosBackground).toContain("'GET_ALLOWED_SELECTORS'");
});
