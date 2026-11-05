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

it('loads the picker on demand instead of in every frame', () => {
  const manifest = JSON.parse(readSource('manifest.json'));
  const mv2 = JSON.parse(readSource('manifest-mv2.json'));
  for (const m of [manifest, mv2]) {
    for (const cs of m.content_scripts) expect(cs.js).not.toContain('content/picker.js');
  }
  expect(readSource('content/ad-blocker.js')).not.toContain('function startPickMode');
  expect(readSource('content/ad-blocker.js')).toContain("'LOAD_PICKER'");
  const bg = readSource('background/background.js');
  expect(bg).toContain("case 'LOAD_PICKER'");
  expect(bg).toContain('content/picker.js');
});

it('loads the phishing overlay on demand', () => {
  const manifest = JSON.parse(readSource('manifest.json'));
  const mv2 = JSON.parse(readSource('manifest-mv2.json'));
  for (const m of [manifest, mv2]) {
    for (const cs of m.content_scripts) expect(cs.js).not.toContain('content/phishing-warning.js');
  }
  const core = readSource('content/ad-blocker.js');
  expect(core).not.toContain('function showPhishingWarning');
  expect(core).toContain("'LOAD_PHISHING_UI'");
  const bg = readSource('background/background.js');
  expect(bg).toContain("case 'LOAD_PHISHING_UI'");
  expect(bg).toContain('content/phishing-warning.js');
  expect(readSource('content/phishing-warning.js')).toContain('__wsPhishingUI');
});

it('wires the frame-engine message types end to end', () => {
  const backgroundSource = readSource('background/background.js');
  const agentSource = readSource('content/frame-agent.js');

  for (const type of ['FRAME_ANNOUNCE', 'FRAME_METRICS', 'FRAME_CHILDREN', 'REPORT_COSMETIC', 'GET_TAB_CENSUS']) {
    expect(backgroundSource).toContain("case '" + type + "'");
  }
  expect(agentSource).toContain("type: 'FRAME_ANNOUNCE'");
  expect(agentSource).toContain("type: 'FRAME_METRICS'");
  // The agent listens for teardown commands (background issues them in a later plan).
  expect(agentSource).toContain("'TEARDOWN_FRAME'");
});

it('wires the SET_FRAME_RULE blocking contract', () => {
  const backgroundSource = readSource('background/background.js');
  expect(backgroundSource).toContain("case 'SET_FRAME_RULE'");
  expect(backgroundSource).toContain('addNetworkBlock');
  expect(backgroundSource).toContain('applyTab');
});

it('wires the site-state model end to end (popup <-> background)', () => {
  const backgroundSource = readSource('background/background.js');
  const popupSource = readSource('popup/popup.js');
  expect(backgroundSource).toContain("case 'GET_SITE_STATE'");
  expect(backgroundSource).toContain("case 'SET_SITE_STATE'");
  expect(popupSource).toContain("type: 'GET_SITE_STATE'");
  expect(popupSource).toContain("type: 'SET_SITE_STATE'");
  // Popup drives per-frame blocking + the live census.
  expect(popupSource).toContain("type: 'SET_FRAME_RULE'");
  expect(popupSource).toContain("type: 'GET_TAB_CENSUS'");
});

it('picker captures every pointer event + uses an overlay (no click leak to iframes)', () => {
  const src = readSource('content/picker.js');
  // All pointer events intercepted in the capture phase.
  for (const ev of ['pointerdown', 'mousedown', 'mouseup', 'click', 'auxclick', 'contextmenu']) {
    expect(src).toContain(`'${ev}'`);
  }
  // The hit-shield overlay + elementFromPoint resolution is the iframe fix.
  expect(src).toContain('websuddhi-pick-overlay');
  expect(src).toContain('elementFromPoint');
  // Frame-aware modes + Alt flip + zap-as-modifier.
  expect(src).toContain('resolvePickTarget');
  expect(src).toContain('pickAltHeld');
  expect(src).toContain('pickZapDefault');
});

it('handles granular site-control messages in background', () => {
  const backgroundSource = readSource('background/background.js');

  expect(backgroundSource).toContain("'GET_SITE_DETAIL'");
  expect(backgroundSource).toContain("'PAUSE_SITE'");
  expect(backgroundSource).toContain("'UNPAUSE_SITE'");
  expect(backgroundSource).toContain("'RESUME_SITE'");
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

  // The pause ribbon reads the unified site state, not IS_PAUSED.
  expect(popupSource).toContain("type: 'GET_SITE_STATE'");
  expect(popupSource).toContain("'RESUME_SITE'");
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
