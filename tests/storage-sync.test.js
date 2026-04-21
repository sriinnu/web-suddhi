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

function createStorageApiMock(options = {}) {
  const localData = { ...(options.storageData || {}) };
  const syncData = {};

  function createArea(backingStore) {
    return {
      get: vi.fn((keys, callback) => {
        const result = pickStorageValues(backingStore, keys);
        if (typeof callback === 'function') {
          callback(result);
          return undefined;
        }
        return Promise.resolve(result);
      }),
      set: vi.fn((data, callback) => {
        Object.assign(backingStore, data);
        if (typeof callback === 'function') {
          callback();
          return undefined;
        }
        return Promise.resolve();
      })
    };
  }

  const api = {
    storage: {
      local: createArea(localData),
      onChanged: { addListener: vi.fn() }
    },
    runtime: {
      lastError: null
    },
    alarms: {
      create: vi.fn(),
      onAlarm: { addListener: vi.fn() }
    }
  };

  if (options.supportSync) {
    api.storage.sync = createArea(syncData);
  }

  return { api, localData, syncData };
}

function installGlobals(api) {
  delete globalThis.WebSuddhi;
  globalThis.self = globalThis;
  globalThis.chrome = api;
  globalThis.browser = undefined;
}

async function flushAsyncWork() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.restoreAllMocks();
  delete globalThis.WebSuddhi;
  delete globalThis.chrome;
  delete globalThis.browser;
  delete globalThis.fetch;
  globalThis.self = globalThis;
});

afterEach(() => {
  delete globalThis.WebSuddhi;
  delete globalThis.chrome;
  delete globalThis.browser;
  delete globalThis.fetch;
});

it('mirrors only syncable settings into storage.sync', async () => {
  const { api, localData, syncData } = createStorageApiMock({ supportSync: true });
  installGlobals(api);

  globalThis.eval(readFixture('shared/utils.js'));

  await globalThis.WebSuddhi.utils.setStorage({ syncEnabled: true });
  await globalThis.WebSuddhi.utils.setStorage({
    theme: 'coastal',
    blockedDomains: ['ads.example'],
    requestLog: [{ url: 'https://ads.example/script.js' }],
    filterSubscriptionDomains: { 'sub-1': ['ads.example'] }
  });

  expect(localData.syncEnabled).toBe(true);
  expect(localData.requestLog).toHaveLength(1);
  expect(localData.filterSubscriptionDomains).toEqual({ 'sub-1': ['ads.example'] });

  expect(syncData.theme).toBe('coastal');
  expect(syncData.blockedDomains).toEqual(['ads.example']);
  expect(syncData.syncEnabled).toBeUndefined();
  expect(syncData.requestLog).toBeUndefined();
  expect(syncData.filterSubscriptionDomains).toBeUndefined();
});

it('persists fetched MV2 subscription domains and reuses cached .well-known lists', async () => {
  const { api, localData } = createStorageApiMock();
  installGlobals(api);

  globalThis.fetch = vi.fn(() => Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve('||ads.example.com^\n||cdn.example.com^\n')
  }));

  globalThis.eval(readFixture('shared/utils.js'));
  globalThis.eval(readFixture('background/filter-lists.js'));
  await flushAsyncWork();

  const result = await globalThis.WebSuddhi.filterLists.addSubscription(
    'Well Known',
    'https://example.com/.well-known/websuddhi.txt'
  );

  expect(result.success).toBe(true);

  const subscriptionId = result.subscription.id;
  expect(localData.filterSubscriptionDomains[subscriptionId]).toEqual([
    'ads.example.com',
    'cdn.example.com'
  ]);
  expect([...globalThis.WebSuddhi.filterLists.getMV2SubscriptionDomains()].sort()).toEqual([
    'ads.example.com',
    'cdn.example.com'
  ]);
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  expect(globalThis.fetch.mock.calls[0][0]).toBe('https://example.com/.well-known/websuddhi.txt');
  expect(globalThis.fetch.mock.calls[0][1].headers.Accept).toContain('text/plain');

  const disabled = await globalThis.WebSuddhi.filterLists.toggleSubscription(subscriptionId, false);
  expect(disabled.success).toBe(true);
  expect([...globalThis.WebSuddhi.filterLists.getMV2SubscriptionDomains()]).toEqual([]);
  expect(localData.filterSubscriptionDomains[subscriptionId]).toEqual([
    'ads.example.com',
    'cdn.example.com'
  ]);

  const reenabled = await globalThis.WebSuddhi.filterLists.toggleSubscription(subscriptionId, true);
  expect(reenabled.success).toBe(true);
  expect([...globalThis.WebSuddhi.filterLists.getMV2SubscriptionDomains()].sort()).toEqual([
    'ads.example.com',
    'cdn.example.com'
  ]);
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
});

it('includes theme and synced preferences in full backup import/export', async () => {
  const { api, localData, syncData } = createStorageApiMock({
    supportSync: true,
    storageData: {
      syncEnabled: true,
      theme: 'forest-dark',
      enabledLanguageFilters: ['german'],
      filterSubscriptions: [{ id: 'sub-1', name: 'German', url: 'https://example.com/german.txt', enabled: true }]
    }
  });
  installGlobals(api);

  globalThis.eval(readFixture('shared/utils.js'));
  globalThis.eval(readFixture('shared/import-export.js'));

  const exported = await globalThis.WebSuddhi.importExport.exportSettings();
  expect(exported.settings.theme).toBe('forest-dark');
  expect(exported.settings.enabledLanguageFilters).toEqual(['german']);

  const result = await globalThis.WebSuddhi.importExport.importSettings({
    version: '2.1.0',
    exportedAt: new Date().toISOString(),
    settings: {
      syncEnabled: true,
      theme: 'coastal',
      enabledLanguageFilters: ['french', 'spanish'],
      shortcuts: {
        'toggle-pick-mode': { key: 'Alt+Shift+P' }
      }
    }
  });

  expect(result.success).toBe(true);
  expect(localData.theme).toBe('coastal');
  expect(localData.enabledLanguageFilters).toEqual(['french', 'spanish']);
  expect(localData.shortcuts).toEqual({
    'toggle-pick-mode': { key: 'Alt+Shift+P' }
  });
  expect(syncData.theme).toBe('coastal');
  expect(syncData.enabledLanguageFilters).toEqual(['french', 'spanish']);
  expect(syncData.shortcuts).toEqual({
    'toggle-pick-mode': { key: 'Alt+Shift+P' }
  });
});
