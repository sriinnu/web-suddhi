// One site state, backed by the stores every blocking layer honours.
//
// The popup's Protected / Default / Paused used to write ws_siteStates, which
// only frame decisions read. "Paused" left ads, DNR rules and cosmetic hiding
// running. These tests drive background.js through its message handler with a
// working in-memory storage and check what actually lands in storage.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT_DIR, p), 'utf8');

function slot() {
  return { listeners: [], addListener: vi.fn(function (fn) { this.listeners.push(fn); }) };
}

function createApi(initial = {}) {
  const store = { ...initial };
  const pick = (keys) => {
    if (keys == null) return { ...store };
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

function boot(initial) {
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
  const send = (message) => new Promise((done) => listener(message, { id: 'test' }, done));
  return { api, store, send };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('site state is one effective answer', () => {
  let env;
  beforeEach(async () => {
    env = boot({});
    await flush();
  });

  it('Paused really pauses: the site lands in the whitelist every layer honours', async () => {
    const resp = await env.send({ type: 'SET_SITE_STATE', hostname: 'www.news.example', state: 'paused' });
    expect(resp).toMatchObject({ success: true, state: 'paused', pausedUntil: null });
    expect(env.store.whitelistedSites).toContain('news.example');
    expect((env.store.ws_siteStates || {})['news.example']).toBeUndefined();

    const isPaused = await env.send({ type: 'IS_PAUSED', hostname: 'news.example' });
    expect(isPaused).toMatchObject({ paused: true, indefinite: true });
  });

  it('a timed pause is reported by GET_SITE_STATE with its expiry', async () => {
    await env.send({ type: 'PAUSE_SITE', hostname: 'news.example', durationMs: 60_000 });
    const resp = await env.send({ type: 'GET_SITE_STATE', hostname: 'news.example' });
    expect(resp.state).toBe('paused');
    expect(resp.pausedUntil).toBeGreaterThan(Date.now());
  });

  it('a whitelisted site reads as Paused', async () => {
    await env.send({ type: 'WHITELIST_SITE', hostname: 'news.example' });
    const resp = await env.send({ type: 'GET_SITE_STATE', hostname: 'news.example' });
    expect(resp.state).toBe('paused');
  });

  it('Default lifts both kinds of pause', async () => {
    await env.send({ type: 'SET_SITE_STATE', hostname: 'news.example', state: 'paused' });
    await env.send({ type: 'PAUSE_SITE', hostname: 'news.example', durationMs: 60_000 });
    const resp = await env.send({ type: 'SET_SITE_STATE', hostname: 'news.example', state: 'default' });
    expect(resp.state).toBe('default');
    expect(env.store.whitelistedSites).not.toContain('news.example');
    expect(env.store.pausedSites || {}).not.toHaveProperty('news.example');
  });

  it('Protected survives a pause and comes back on resume', async () => {
    await env.send({ type: 'SET_SITE_STATE', hostname: 'news.example', state: 'protected' });
    await env.send({ type: 'PAUSE_SITE', hostname: 'news.example', durationMs: 60_000 });
    expect((await env.send({ type: 'GET_SITE_STATE', hostname: 'news.example' })).state).toBe('paused');

    const resp = await env.send({ type: 'RESUME_SITE', hostname: 'news.example' });
    expect(resp).toMatchObject({ success: true, state: 'protected' });
  });
});

describe('legacy "paused" in ws_siteStates', () => {
  it('is migrated into the whitelist on startup', async () => {
    const env = boot({ ws_siteStates: { 'old.example': 'paused', 'keep.example': 'protected' } });
    for (let i = 0; i < 20 && !(env.store.whitelistedSites || []).includes('old.example'); i++) await flush();
    expect(env.store.whitelistedSites).toContain('old.example');
    expect(env.store.ws_siteStates).toEqual({ 'keep.example': 'protected' });
  });
});

describe('frame decisions', () => {
  it('Protected forces the aggressive tier for heavy unknown frames', () => {
    globalThis.self = globalThis;
    globalThis.WebSuddhi = undefined;
    // eslint-disable-next-line no-new-func
    new Function(read('shared/rule-model.js'))();
    const decide = globalThis.WebSuddhi.ruleModel.resolveFrameDecision;
    expect(decide({ siteState: 'default', aggressiveness: 'conservative', isHeavy: true }).action).toBe('allow');
    expect(decide({ siteState: 'protected', aggressiveness: 'conservative', isHeavy: true }).action).toBe('block');
  });
});
