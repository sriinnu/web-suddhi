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
