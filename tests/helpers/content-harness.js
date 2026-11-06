// Loads the real content scripts into jsdom with a stub extension API.
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(ROOT_DIR, p), 'utf8');

export function listenerSlot() {
  return { listeners: [], addListener: vi.fn(function (fn) { this.listeners.push(fn); }) };
}

// opts.beforeCore runs after shared/utils.js and before the content script,
// e.g. to stub utils that need real layout (jsdom has none).
export function loadContentScript(api, html, opts = {}) {
  document.open();
  document.write(html);
  document.close();
  globalThis.chrome = api;
  window.chrome = api;
  globalThis.browser = undefined;
  window.browser = undefined;
  globalThis.self = window;
  window.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} };
  // jsdom lacks CSS.escape (every real browser has it).
  if (!window.CSS) window.CSS = {};
  if (!window.CSS.escape) window.CSS.escape = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, (ch) => "\\" + ch);
  globalThis.CSS = window.CSS;
  window.eval(read('shared/utils.js')); // omit-allow: loads the repo's own content script into jsdom
  if (opts.beforeCore) opts.beforeCore(window);
  delete window.__wsPicker; // a fresh core needs a fresh picker
  window.eval(read('content/ad-blocker.js')); // omit-allow: loads the repo's own content script into jsdom
}

export function createContentApi(initial = {}) {
  const stored = { enabled: true, blockedSelectors: [], ...initial };
  const api = {
    runtime: {
      id: 'test',
      lastError: null,
      onMessage: listenerSlot(),
      // LOAD_PICKER: stand in for the background injecting content/picker.js.
      sendMessage: vi.fn((msg, cb) => {
        if (msg && msg.type === 'LOAD_PICKER') window.eval(read('content/picker.js')); // omit-allow: loads the repo's own content script into jsdom
        if (typeof cb === 'function') cb({ success: true });
        return undefined;
      }),
      getURL: (p) => 'chrome-extension://test/' + p
    },
    storage: {
      local: {
        get: vi.fn((keys, cb) => { cb({ ...stored }); }),
        set: vi.fn((data, cb) => { Object.assign(stored, data); if (cb) cb(); })
      },
      onChanged: listenerSlot()
    }
  };
  return { api, stored };
}
