import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(TEST_DIR, '..');

function readFixture(relativePath) {
  return readFileSync(resolve(ROOT_DIR, relativePath), 'utf8');
}

function pickStorageValues(source, keys) {
  if (keys === null || keys === undefined) return { ...source };
  if (Array.isArray(keys)) {
    return Object.fromEntries(keys.map((key) => [key, source[key]]));
  }
  if (typeof keys === 'string') {
    return { [keys]: source[keys] };
  }
  return { ...source };
}

function createExtensionApiMock(options = {}) {
  const storageData = { ...(options.storageData || {}) };
  const tabResults = options.tabs || [{ id: 1, url: 'https://example.com/article' }];
  const runtimeHandlers = options.runtimeHandlers || {};
  const tabHandlers = options.tabHandlers || {};
  const syncData = {};

  const localStorageArea = {
    get: vi.fn((keys, callback) => {
      const result = pickStorageValues(storageData, keys);
      if (typeof callback === 'function') {
        callback(result);
        return undefined;
      }
      return Promise.resolve(result);
    }),
    set: vi.fn((data, callback) => {
      Object.assign(storageData, data);
      if (typeof callback === 'function') {
        callback();
        return undefined;
      }
      return Promise.resolve();
    })
  };

  const api = {
    storage: {
      local: localStorageArea,
      onChanged: { addListener: vi.fn() }
    },
    runtime: {
      lastError: null,
      onMessage: { addListener: vi.fn() },
      sendMessage: vi.fn((message, callback) => {
        const handler = runtimeHandlers[message.type] || (() => ({ success: true }));
        const response = handler(message);
        if (typeof callback === 'function') {
          Promise.resolve(response).then(callback);
          return undefined;
        }
        return Promise.resolve(response);
      }),
      openOptionsPage: vi.fn(() => Promise.resolve()),
      getURL: vi.fn((path) => `chrome-extension://test/${path}`)
    },
    tabs: {
      query: vi.fn((queryInfo, callback) => {
        if (typeof callback === 'function') {
          callback(tabResults);
          return undefined;
        }
        return Promise.resolve(tabResults);
      }),
      create: vi.fn(),
      sendMessage: vi.fn((tabId, message, callback) => {
        const handler = tabHandlers[message.type] || (() => ({ success: true }));
        const response = handler(message, tabId);
        if (typeof callback === 'function') {
          Promise.resolve(response).then(callback);
          return undefined;
        }
        return Promise.resolve(response);
      })
    },
    commands: {
      onCommand: { addListener: vi.fn() }
    }
  };

  if (options.supportSync) {
    api.storage.sync = {
      get: vi.fn((keys, callback) => {
        const result = pickStorageValues(syncData, keys);
        if (typeof callback === 'function') {
          callback(result);
          return undefined;
        }
        return Promise.resolve(result);
      }),
      set: vi.fn((data, callback) => {
        Object.assign(syncData, data);
        if (typeof callback === 'function') {
          callback();
          return undefined;
        }
        return Promise.resolve();
      })
    };
  }

  return { api, storageData, syncData };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function mountExtensionPage(htmlPath, scriptPath, api, options = {}) {
  const mode = options.mode || 'chrome';
  const extraScripts = options.extraScripts || [];

  document.open();
  document.write(readFixture(htmlPath));
  document.close();

  globalThis.chrome = mode === 'browser' ? undefined : api;
  globalThis.browser = mode === 'browser' ? api : undefined;
  globalThis.self = window;
  window.chrome = mode === 'browser' ? undefined : api;
  window.browser = mode === 'browser' ? api : undefined;
  window.self = window;
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
  globalThis.matchMedia = window.matchMedia;
  window.IntersectionObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  };
  globalThis.IntersectionObserver = window.IntersectionObserver;

  window.eval(readFixture('shared/utils.js'));
  for (const extraScript of extraScripts) {
    window.eval(readFixture(extraScript));
  }
  window.eval(readFixture(scriptPath));
  await flushAsyncWork();
}

beforeEach(() => {
  document.documentElement.innerHTML = '<head></head><body></body>';
  delete globalThis.chrome;
  delete globalThis.browser;
  delete globalThis.WebSuddhi;
  vi.restoreAllMocks();
});

afterEach(() => {
  document.documentElement.innerHTML = '<head></head><body></body>';
  delete globalThis.WebSuddhi;
  delete globalThis.chrome;
  delete globalThis.browser;
});

it('loads the popup with the saved theme and persists quick theme changes', async () => {
  const { api, storageData } = createExtensionApiMock({
    storageData: {
      theme: 'forest-dark',
      enabled: true,
      networkBlockingEnabled: true,
      urlCleaningEnabled: true,
      cookieConsentEnabled: true,
      annoyanceBlockingEnabled: true,
      paywallEnabled: true,
      socialBlockingEnabled: false
    },
    runtimeHandlers: {
      GET_ALL_SETTINGS: () => ({
        success: true,
        settings: {
          enabled: true,
          networkBlockingEnabled: true,
          urlCleaningEnabled: true,
          cookieConsentEnabled: true,
          annoyanceBlockingEnabled: true,
          paywallEnabled: true,
          socialBlockingEnabled: false,
          blockedDomains: [],
          blockedSelectors: []
        }
      }),
      IS_WHITELISTED: () => ({ success: true, whitelisted: false }),
      GET_BLOCKED_COUNT: () => ({ success: true, count: 4 }),
      GET_SECURITY_INFO: () => ({
        success: true,
        connection: {
          protocol: 'https:',
          host: 'example.com',
          normalizedHost: 'example.com'
        },
        phishing: {
          isSuspicious: false,
          protectionEnabled: true,
          reason: 'No phishing patterns detected.'
        }
      }),
      GET_REQUEST_LOG: () => ({ success: true, log: [] }),
      GET_SELECTORS: () => ({ success: true, selectors: [] }),
      ADD_DOMAIN_BLOCK: () => ({ success: true }),
      REPORT_PHISHING: () => ({ success: true })
    },
    tabHandlers: {
      GET_FRAMES: () => ({ success: true, frames: [] }),
      REMOVE_PAYWALL: () => ({ success: true, removed: true })
    }
  });

  await mountExtensionPage('popup/popup.html', 'popup/popup.js', api);

  expect(document.documentElement.getAttribute('data-theme')).toBe('forest-dark');
  expect(document.getElementById('currentSite').textContent).toBe('example.com');
  expect(document.getElementById('themeSelect').value).toBe('forest-dark');

  const themeSelect = document.getElementById('themeSelect');
  themeSelect.value = 'coastal';
  themeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  await flushAsyncWork();

  expect(storageData.theme).toBe('coastal');
  expect(document.documentElement.getAttribute('data-theme')).toBe('coastal');
});

it('renders the frame census panel and blocks a frame via SET_FRAME_RULE', async () => {
  const census = {
    frames: [
      { domain: 'doubleclick.net', url: 'https://doubleclick.net/a', category: 'ad', action: 'block', isProtected: false, isHeavy: true, bytes: 1572864 },
      { domain: 'youtube.com', url: 'https://youtube.com/embed/x', category: 'embed', action: 'allow', isProtected: false, isHeavy: false, bytes: 51200 }
    ],
    counts: { frames: 2, heavy: 1, blocked: 1, flagged: 0, cosmetic: 0 }
  };
  const setFrameRuleCalls = [];
  const { api } = createExtensionApiMock({
    storageData: { theme: 'system', enabled: true, networkBlockingEnabled: true },
    runtimeHandlers: {
      GET_ALL_SETTINGS: () => ({ success: true, settings: { enabled: true, networkBlockingEnabled: true } }),
      IS_WHITELISTED: () => ({ success: true, whitelisted: false }),
      GET_SITE_STATE: () => ({ success: true, state: 'default' }),
      GET_SECURITY_INFO: () => ({ success: true, connection: { protocol: 'https:', host: 'example.com' }, phishing: { isSuspicious: false } }),
      GET_TAB_CENSUS: () => ({ success: true, census }),
      SET_FRAME_RULE: (message) => { setFrameRuleCalls.push(message); return { success: true, census }; }
    }
  });

  await mountExtensionPage('popup/popup.html', 'popup/popup.js', api);

  const framesSection = document.getElementById('framesSection');
  expect(framesSection.style.display).toBe('block');
  expect(document.getElementById('framesCount').textContent).toBe('2');
  // The heavy ad frame appears in the pinned resource-hogs section.
  expect(document.getElementById('framesHogs').style.display).toBe('block');
  expect(document.getElementById('framesHogsCount').textContent).toBe('1');

  // Click the first "Block" toggle (on the allowed youtube embed row).
  const blockBtn = Array.from(document.querySelectorAll('.frame-toggle')).find((b) => b.textContent === 'Block');
  expect(blockBtn).toBeTruthy();
  blockBtn.click();
  await flushAsyncWork();

  const call = setFrameRuleCalls.find((c) => c.rule === 'blocked');
  expect(call).toBeTruthy();
  expect(call.persist).toBe(true);
  expect(typeof call.frameDomain).toBe('string');
});

it('disables sync on browsers without storage.sync and keeps custom themes toggleable', async () => {
  const { api, storageData } = createExtensionApiMock({
    storageData: {
      theme: 'forest-dark',
      enabled: true,
      paywallEnabled: true,
      networkBlockingEnabled: true,
      urlCleaningEnabled: true,
      cookieConsentEnabled: true,
      annoyanceBlockingEnabled: true,
      socialBlockingEnabled: true,
      pingProtectionEnabled: true,
      referrerStrippingEnabled: false,
      webrtcProtectionEnabled: false,
      phishingProtectionEnabled: true,
      telemetryBlockingEnabled: false,
      thirdPartyCookieBlockingEnabled: false,
      syncEnabled: true,
      loggingEnabled: true,
      toastDuration: 3
    },
    runtimeHandlers: {
      GET_FILTER_SUBSCRIPTIONS: () => ({ success: true, subscriptions: [] }),
      GET_STATS: () => ({
        success: true,
        stats: {
          totalNetworkBlocked: 8,
          totalCosmeticBlocked: 2,
          totalBlocked: 10,
          today: {
            networkBlocked: 3,
            cosmeticBlocked: 1,
            topDomains: {},
            perSite: {},
            byCategory: {}
          },
          history: []
        }
      }),
      GET_REQUEST_LOG: () => ({ success: true, log: [] }),
      GET_PERFORMANCE_STATS: () => ({
        success: true,
        performanceStats: {
          estimatedDataSaved: 1024,
          estimatedTimeSaved: 1000
        }
      })
    }
  });

  await mountExtensionPage('options/options.html', 'options/options.js', api);

  expect(document.documentElement.getAttribute('data-theme')).toBe('forest-dark');
  expect(document.querySelector('.theme-btn[data-theme="forest-dark"]').classList.contains('active')).toBe(true);
  expect(document.getElementById('enableSync').disabled).toBe(true);
  expect(document.getElementById('syncDescription').textContent).toContain('settings stay local');

  document.getElementById('themeToggle').click();
  await flushAsyncWork();

  expect(storageData.theme).toBe('forest');
  expect(document.documentElement.getAttribute('data-theme')).toBe('forest');
});

it('uses the promise-based browser API path and keeps stats deep-links working', async () => {
  const { api, storageData } = createExtensionApiMock({
    storageData: {
      theme: 'coastal-dark',
      enabled: true,
      networkBlockingEnabled: true,
      urlCleaningEnabled: true,
      cookieConsentEnabled: true,
      annoyanceBlockingEnabled: true,
      paywallEnabled: true,
      socialBlockingEnabled: false
    },
    runtimeHandlers: {
      GET_ALL_SETTINGS: () => ({
        success: true,
        settings: {
          enabled: true,
          networkBlockingEnabled: true,
          urlCleaningEnabled: true,
          cookieConsentEnabled: true,
          annoyanceBlockingEnabled: true,
          paywallEnabled: true,
          socialBlockingEnabled: false,
          blockedDomains: [],
          blockedSelectors: []
        }
      }),
      IS_WHITELISTED: () => ({ success: true, whitelisted: false }),
      GET_BLOCKED_COUNT: () => ({ success: true, count: 12 }),
      GET_SECURITY_INFO: () => ({
        success: true,
        connection: {
          protocol: 'https:',
          host: 'example.com',
          normalizedHost: 'example.com'
        },
        phishing: {
          isSuspicious: false,
          protectionEnabled: true,
          reason: 'No phishing patterns detected.'
        }
      }),
      GET_REQUEST_LOG: () => ({ success: true, log: [] }),
      GET_SELECTORS: () => ({ success: true, selectors: [] }),
      ADD_DOMAIN_BLOCK: () => ({ success: true }),
      REPORT_PHISHING: () => ({ success: true })
    },
    tabHandlers: {
      GET_FRAMES: () => ({ success: true, frames: [] }),
      REMOVE_PAYWALL: () => ({ success: true, removed: true })
    }
  });

  await mountExtensionPage('popup/popup.html', 'popup/popup.js', api, { mode: 'browser' });

  expect(document.documentElement.getAttribute('data-theme')).toBe('coastal-dark');

  document.getElementById('viewAllBlocked').click();
  await flushAsyncWork();

  expect(api.tabs.create).toHaveBeenCalledWith({
    url: 'chrome-extension://test/options/options.html#stats'
  });

  const themeSelect = document.getElementById('themeSelect');
  themeSelect.value = 'forest';
  themeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  await flushAsyncWork();

  expect(storageData.theme).toBe('forest');
  expect(document.documentElement.getAttribute('data-theme')).toBe('forest');
});
