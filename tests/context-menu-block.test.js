// "Block this element" (right-click) and pick-mode blocking, end to end in jsdom.
//
// Three bugs these guard against:
// 1. MV3 drops events that wake the service worker unless their listeners are
//    registered synchronously on the first turn. contextMenus.onClicked,
//    commands.onCommand and alarms.onAlarm used to be added after an `await`.
// 2. The menu item only started pick mode; it never touched the element the
//    user actually right-clicked (and wasn't routed to the clicked frame).
// 3. User-picked elements went through the auto-filter safety guard, so a pick
//    on anything "content-looking" silently did nothing while the toast said
//    "Element blocked and rule saved".

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT_DIR, p), 'utf8');

function listenerSlot() {
  return { listeners: [], addListener: vi.fn(function (fn) { this.listeners.push(fn); }) };
}

function createBackgroundApi() {
  const never = () => new Promise(() => {}); // a just-woken worker: storage not back yet
  const area = { get: vi.fn(never), set: vi.fn(never), remove: vi.fn(never) };
  return {
    runtime: {
      id: 'test',
      onMessage: listenerSlot(),
      onInstalled: listenerSlot(),
      onStartup: listenerSlot(),
      onUpdateCheckStatus: listenerSlot(),
      getURL: (p) => 'chrome-extension://test/' + p,
      lastError: null
    },
    storage: { local: area, sync: area, onChanged: listenerSlot() },
    tabs: {
      onRemoved: listenerSlot(), onUpdated: listenerSlot(), onActivated: listenerSlot(),
      query: vi.fn(), sendMessage: vi.fn(), get: vi.fn(), create: vi.fn()
    },
    webNavigation: { onCommitted: listenerSlot() },
    contextMenus: { removeAll: vi.fn((cb) => cb && cb()), create: vi.fn(), onClicked: listenerSlot() },
    commands: { onCommand: listenerSlot() },
    alarms: { onAlarm: listenerSlot(), create: vi.fn(), clear: vi.fn() },
    action: { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn(), setIcon: vi.fn() },
    declarativeNetRequest: {
      updateDynamicRules: vi.fn(never), getDynamicRules: vi.fn(never),
      updateEnabledRulesets: vi.fn(never), getEnabledRulesets: vi.fn(never),
      updateSessionRules: vi.fn(never), getSessionRules: vi.fn(never)
    }
  };
}

function loadContentScript(api, html) {
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
  delete window.__wsPicker; // a fresh core needs a fresh picker
  window.eval(read('content/ad-blocker.js')); // omit-allow: loads the repo's own content script into jsdom
}

function createContentApi() {
  const stored = { enabled: true, blockedSelectors: [] };
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

async function dispatchToContent(api, message) {
  const [listener] = api.runtime.onMessage.listeners;
  return new Promise((done) => {
    const ret = listener(message, { id: 'test' }, done);
    if (ret !== true) done(undefined);
  });
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('background: wake-up listeners', () => {
  it('registers contextMenus/commands/alarms listeners synchronously', () => {
    const api = createBackgroundApi();
    globalThis.self = globalThis;
    globalThis.chrome = api;
    globalThis.browser = undefined;
    globalThis.importScripts = undefined;
    // eslint-disable-next-line no-new-func
    new Function(read('background/background.js'))();

    expect(api.contextMenus.onClicked.addListener).toHaveBeenCalled();
    expect(api.commands.onCommand.addListener).toHaveBeenCalled();
    expect(api.alarms.onAlarm.addListener).toHaveBeenCalled();
  });

  it('routes "Block this element" to the clicked frame with BLOCK_CONTEXT_TARGET', () => {
    const api = createBackgroundApi();
    globalThis.chrome = api;
    // eslint-disable-next-line no-new-func
    new Function(read('background/background.js'))();

    const [onClick] = api.contextMenus.onClicked.listeners;
    onClick({ menuItemId: 'websuddhi-block', frameId: 7 }, { id: 42 });

    expect(api.tabs.sendMessage).toHaveBeenCalledWith(
      42,
      { type: 'BLOCK_CONTEXT_TARGET' },
      { frameId: 7 },
      expect.any(Function)
    );
  });
});

describe('content: right-click block + user picks', () => {
  let api;
  let stored;

  beforeEach(async () => {
    ({ api, stored } = createContentApi());
    loadContentScript(api, `<!doctype html><html><body>
      <div id="sidebar-thing" class="promo-box"><p>Buy stuff</p></div>
      <article id="story"><h1>Real story</h1><p>text</p></article>
    </body></html>`);
    await flush();
  });

  it('hides exactly the right-clicked element and saves a rule for this site', async () => {
    const target = document.querySelector('#sidebar-thing p');
    target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    const resp = await dispatchToContent(api, { type: 'BLOCK_CONTEXT_TARGET' });
    await flush();

    expect(resp).toMatchObject({ success: true, saved: true });
    const hidden = document.querySelector('[data-websuddhi-blocked]');
    expect(hidden).not.toBeNull();
    expect(hidden.contains(target) || hidden === target).toBe(true);
    expect(document.querySelector('#story').hasAttribute('data-websuddhi-blocked')).toBe(false);
    expect(stored.blockedSelectors.length).toBe(1);
  });

  it('falls back to pick mode when no element was right-clicked in this frame', async () => {
    const resp = await dispatchToContent(api, { type: 'BLOCK_CONTEXT_TARGET' });
    expect(resp && resp.pickMode).toBe(true);
    expect(document.body.classList.contains('websuddhi-pick-mode')).toBe(true);
    // jsdom keeps document listeners across document.open(); leave pick mode
    // so its capture-phase handler cannot swallow the next test's right-click.
    await dispatchToContent(api, { type: 'TOGGLE_PICK_MODE' });
    expect(document.body.classList.contains('websuddhi-pick-mode')).toBe(false);
  });

  it('honours a user pick even on an element the auto-filter guard calls content', async () => {
    const story = document.querySelector('#story');
    story.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    const resp = await dispatchToContent(api, { type: 'BLOCK_CONTEXT_TARGET' });
    await flush();

    expect(resp).toMatchObject({ success: true });
    expect(story.hasAttribute('data-websuddhi-blocked')).toBe(true);
  });
});
