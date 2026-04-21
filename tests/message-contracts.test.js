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
