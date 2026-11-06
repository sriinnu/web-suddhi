// Boots background/background.js against an in-memory extension API so tests
// can drive it through its real message handler.

import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const read = (p) => readFileSync(resolve(ROOT_DIR, p), 'utf8');

function slot() {
  return { listeners: [], addListener: vi.fn(function (fn) { this.listeners.push(fn); }) };
}

export function createApi(initial = {}) {
  const store = { ...initial };
  const pick = (keys) => {
    if (keys === null || keys === undefined) return { ...store };
    const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
    const out = {};
    for (const k of list) if (k in store) out[k] = structuredClone(store[k]);
    return out;
  };
  const area = {
    get: vi.fn((keys, cb) => { const r = pick(keys); if (cb) cb(r); return Promise.resolve(r); }),
    set: vi.fn((data, cb) => { Object.assign(store, structuredClone(data)); if (cb) cb(); return Promise.resolve(); }),
    remove: vi.fn((keys, cb) => { for (const k of [].concat(keys)) delete store[k]; if (cb) cb(); return Promise.resolve(); })
  };
  const resolved = (v) => vi.fn((...args) => {
    const cb = args.find((a) => typeof a === 'function');
    if (cb) cb(v);
    return Promise.resolve(v);
  });
  const api = {
    runtime: {
      id: 'test', lastError: null,
      onMessage: slot(), onInstalled: slot(), onStartup: slot(), onUpdateCheckStatus: slot(),
      getURL: (p) => 'chrome-extension://test/' + p,
      sendMessage: resolved(undefined)
    },
    storage: { local: area, sync: area, onChanged: slot() },
    tabs: {
      onRemoved: slot(), onUpdated: slot(), onActivated: slot(),
      query: resolved([]), sendMessage: resolved(undefined), get: resolved(undefined), create: vi.fn()
    },
    webNavigation: { onCommitted: slot() },
    contextMenus: { removeAll: vi.fn((cb) => cb && cb()), create: vi.fn(), onClicked: slot() },
    commands: { onCommand: slot() },
    alarms: { onAlarm: slot(), create: vi.fn(), clear: vi.fn() },
    action: { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn(), setIcon: vi.fn() },
    declarativeNetRequest: {
      updateDynamicRules: resolved(undefined), getDynamicRules: resolved([]),
      updateEnabledRulesets: resolved(undefined), getEnabledRulesets: resolved([]),
      updateSessionRules: resolved(undefined), getSessionRules: resolved([])
    }
  };
  return { api, store };
}

export function boot(initial) {
  const { api, store } = createApi(initial);
  globalThis.self = globalThis;
  globalThis.chrome = api;
  globalThis.browser = undefined;
  globalThis.importScripts = undefined;
  globalThis.WebSuddhi = undefined;
  // The modules background.js would importScripts().
  // eslint-disable-next-line no-new-func
  new Function(read('shared/utils.js'))();
  // eslint-disable-next-line no-new-func
  new Function(read('shared/rule-model.js'))();
  // eslint-disable-next-line no-new-func
  new Function(read('background/background.js'))();
  const [listener] = api.runtime.onMessage.listeners;
  const send = (message, sender = {}) => new Promise((done) => listener(message, { id: 'test', ...sender }, done));
  return { api, store, send };
}

export const flush = () => new Promise((r) => setTimeout(r, 0));
