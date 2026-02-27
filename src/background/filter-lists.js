/**
 * @module filter-lists
 * @description Filter list subscription management with ABP syntax parsing
 * for the WebSuddhi background service worker.
 *
 * Fix issue #6: Checks `Content-Length` header before reading body; uses
 * streaming with a byte counter to abort downloads that exceed 2 MB.
 *
 * Fix issue #7: Moves parsing to an async-chunk pattern with `setTimeout(0)`
 * yields to avoid blocking the event loop for large lists.
 *
 * @version 2.1.0
 */
'use strict';

import {
  FILTER_RULE_ID_START,
  MAX_FILTER_RULES,
  FILTER_CACHE_TTL,
  UPDATE_COOLDOWN
} from '../shared/constants.js';
import { getStorage, setStorage } from '../shared/storage.js';
import { isValidFilterListURL } from '../shared/css-validator.js';

// ============================================
// CROSS-BROWSER API
// ============================================

/** @returns {object} @private */
function getApi() {
  if (typeof browser !== 'undefined' && browser?.runtime) return browser;
  if (typeof chrome !== 'undefined' && chrome?.runtime) return chrome;
  return /** @type {*} */ ({});
}

// ============================================
// CONSTANTS
// ============================================

const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_LINES = 50000;
const MAX_DOMAINS = 10000;
const PARSE_CHUNK_SIZE = 2000; // lines per async chunk (fix #7)

// ============================================
// STATE
// ============================================

/** @type {Map<string, { data: string[], timestamp: number }>} */
const filterCache = new Map();

/** @type {number} */
let lastUpdateTime = 0;

/** @type {Set<string>} MV2 in-memory blocked domains from subscriptions. */
let mv2SubscriptionDomains = new Set();

const BUILTIN_LISTS = [
  { id: 'websuddhi-ads', name: 'WebSuddhi Ad Domains', url: null, enabled: true, builtin: true, ruleCount: 0 },
  { id: 'websuddhi-tracking', name: 'WebSuddhi Tracking Domains', url: null, enabled: true, builtin: true, ruleCount: 0 }
];

// ============================================
// INITIALISATION
// ============================================

/**
 * Initialise filter list subscriptions.
 *
 * @returns {Promise<void>}
 */
export async function initFilterLists() {
  const storage = await getStorage(['filterSubscriptions']);
  let subs = storage.filterSubscriptions;

  if (!Array.isArray(subs)) {
    subs = BUILTIN_LISTS.map((l) => ({ ...l, lastUpdated: null }));
    await setStorage({ filterSubscriptions: subs });
  }

  const api = getApi();
  if (!api.declarativeNetRequest) await loadMV2SubscriptionRules(subs);

  setupAutoUpdate();
}

// ============================================
// ABP FILTER PARSER (async chunked — fix #7)
// ============================================

/**
 * Parse an ABP-format filter list into a deduplicated domain array.
 * Uses async chunking to avoid blocking the event loop (fix #7).
 *
 * @param {string} text - Raw filter list text.
 * @returns {Promise<string[]>} Unique blocked domains.
 */
async function parseABPFilterList(text) {
  const lines = text.split('\n');
  if (lines.length > MAX_LINES) {
    throw new Error('Filter list has too many lines (max 50,000)');
  }

  const domains = [];
  const domainRe = /^\|\|([a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+)\^?(\$.*)?$/i;

  for (let offset = 0; offset < lines.length; offset += PARSE_CHUNK_SIZE) {
    const end = Math.min(offset + PARSE_CHUNK_SIZE, lines.length);
    for (let i = offset; i < end; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('[')) continue;
      if (trimmed.includes('##') || trimmed.includes('#@#') || trimmed.includes('#?#')) continue;
      if (trimmed.startsWith('/') && trimmed.endsWith('/')) continue;
      if (trimmed.startsWith('@@')) continue;

      const m = trimmed.match(domainRe);
      if (m) {
        const opts = m[5];
        if (opts) {
          const o = opts.substring(1);
          if (o.includes('redirect') || o.includes('csp') || o.includes('rewrite')) continue;
        }
        domains.push(m[1].toLowerCase());
      }
    }

    // Fix #7: yield to event loop between chunks
    if (end < lines.length) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  return [...new Set(domains)];
}

// ============================================
// SUBSCRIPTION CRUD
// ============================================

/**
 * Add a new filter subscription.
 *
 * @param {string} name - Display name.
 * @param {string} url - HTTPS URL of the filter list.
 * @returns {Promise<{ success: boolean, subscription?: Object, error?: string }>}
 */
export async function addSubscription(name, url) {
  if (!isValidFilterListURL(url)) {
    return { success: false, error: 'Invalid URL. Filter lists must use HTTPS for security.' };
  }

  const storage = await getStorage(['filterSubscriptions']);
  const subs = storage.filterSubscriptions || [];

  if (subs.find((s) => s.url === url)) {
    return { success: false, error: 'Subscription already exists' };
  }

  const sub = {
    id: 'custom-' + Date.now(),
    name: name || url,
    url, enabled: true, builtin: false, ruleCount: 0, lastUpdated: null
  };
  subs.push(sub);
  await setStorage({ filterSubscriptions: subs });
  await updateSubscription(sub.id);

  return { success: true, subscription: sub };
}

/**
 * Remove a custom filter subscription.
 *
 * @param {string} subscriptionId
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function removeSubscription(subscriptionId) {
  const storage = await getStorage(['filterSubscriptions']);
  const subs = storage.filterSubscriptions || [];
  const sub = subs.find((s) => s.id === subscriptionId);

  if (!sub) return { success: false, error: 'Subscription not found' };
  if (sub.builtin) return { success: false, error: 'Cannot remove built-in list' };

  await setStorage({ filterSubscriptions: subs.filter((s) => s.id !== subscriptionId) });
  await removeSubscriptionRules(subscriptionId);
  return { success: true };
}

/**
 * Toggle a subscription on/off.
 *
 * @param {string} subscriptionId
 * @param {boolean} enabled
 * @returns {Promise<{ success: boolean, enabled?: boolean, error?: string }>}
 */
export async function toggleSubscription(subscriptionId, enabled) {
  const api = getApi();
  const storage = await getStorage(['filterSubscriptions']);
  const subs = storage.filterSubscriptions || [];
  const sub = subs.find((s) => s.id === subscriptionId);
  if (!sub) return { success: false, error: 'Subscription not found' };

  sub.enabled = enabled;
  await setStorage({ filterSubscriptions: subs });

  if (sub.builtin && api.declarativeNetRequest) {
    const rid = sub.id === 'websuddhi-ads' ? 'ad_domains' : 'tracking_domains';
    try {
      await api.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: enabled ? [rid] : [],
        disableRulesetIds: enabled ? [] : [rid]
      });
    } catch (_e) { /* ignore */ }
  } else if (!sub.builtin) {
    enabled ? await updateSubscription(subscriptionId) : await removeSubscriptionRules(subscriptionId);
  }

  return { success: true, enabled };
}

/**
 * Fetch and apply rules for a single subscription.
 *
 * Fix #6: Checks `Content-Length` header and streams with byte counter.
 *
 * @param {string} subscriptionId
 * @returns {Promise<{ success: boolean, ruleCount?: number, cached?: boolean, error?: string }>}
 */
export async function updateSubscription(subscriptionId) {
  const storage = await getStorage(['filterSubscriptions']);
  const subs = storage.filterSubscriptions || [];
  const sub = subs.find((s) => s.id === subscriptionId);
  if (!sub || !sub.url || sub.builtin) return { success: false, error: 'Invalid subscription' };

  const now = Date.now();
  if (sub.lastUpdated && (now - new Date(sub.lastUpdated).getTime()) < UPDATE_COOLDOWN) {
    return { success: false, error: 'Subscription updated recently, please wait' };
  }

  // Cache check
  const cached = filterCache.get(sub.url);
  if (cached && (now - cached.timestamp) < FILTER_CACHE_TTL) {
    sub.ruleCount = cached.data.length;
    sub.lastUpdated = new Date(cached.timestamp).toISOString();
    await setStorage({ filterSubscriptions: subs });
    return { success: true, cached: true, ruleCount: cached.data.length };
  }

  if (!isValidFilterListURL(sub.url)) {
    return { success: false, error: 'Invalid URL protocol. HTTPS required.' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const response = await fetch(sub.url, { signal: controller.signal, headers: { Accept: 'text/plain, */*' } });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error('HTTP ' + response.status);

    // Fix #6: check Content-Length before reading body
    const cl = response.headers.get('Content-Length');
    if (cl && parseInt(cl, 10) > MAX_BODY_BYTES) {
      throw new Error('Filter list too large (max 2 MB)');
    }

    // Fix #6: stream with byte counter
    const reader = response.body?.getReader();
    const chunks = [];
    let totalBytes = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > MAX_BODY_BYTES) throw new Error('Filter list too large (max 2 MB)');
        chunks.push(value);
      }
    }

    const text = new TextDecoder().decode(
      chunks.length === 1 ? chunks[0] : _concatUint8Arrays(chunks)
    );

    const domains = await parseABPFilterList(text);
    if (domains.length > MAX_DOMAINS) throw new Error('Filter list has too many rules (max 10,000)');

    sub.ruleCount = domains.length;
    sub.lastUpdated = new Date().toISOString();
    await setStorage({ filterSubscriptions: subs });
    filterCache.set(sub.url, { data: domains, timestamp: Date.now() });

    if (sub.enabled) await applySubscriptionRules(subscriptionId, domains);
    return { success: true, ruleCount: domains.length };
  } catch (err) {
    return { success: false, error: err.name === 'AbortError' ? 'Request timed out' : err.message };
  }
}

/**
 * @param {Uint8Array[]} arrays
 * @returns {Uint8Array}
 * @private
 */
function _concatUint8Arrays(arrays) {
  const total = arrays.reduce((s, a) => s + a.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { result.set(a, offset); offset += a.byteLength; }
  return result;
}

/**
 * Update all custom (non-builtin, enabled) subscriptions.
 *
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function updateAllSubscriptions() {
  const now = Date.now();
  if (now - lastUpdateTime < UPDATE_COOLDOWN) {
    return { success: false, error: 'Update in progress, please wait' };
  }
  lastUpdateTime = now;

  const storage = await getStorage(['filterSubscriptions']);
  for (const sub of storage.filterSubscriptions || []) {
    if (!sub.builtin && sub.enabled && sub.url) {
      await updateSubscription(sub.id);
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return { success: true };
}

// ============================================
// RULE APPLICATION
// ============================================

/**
 * @param {string} subscriptionId
 * @param {string[]} domains
 * @returns {Promise<void>}
 * @private
 */
async function applySubscriptionRules(subscriptionId, domains) {
  const api = getApi();
  if (api.declarativeNetRequest) {
    await removeSubscriptionRules(subscriptionId);

    const mapping = (await getStorage(['filterRuleMapping'])).filterRuleMapping || {};
    const existing = await api.declarativeNetRequest.getDynamicRules();
    const usedIds = new Set(existing.map((r) => r.id));
    let nextId = FILTER_RULE_ID_START;
    const rules = [];

    for (const domain of domains) {
      while (usedIds.has(nextId) && nextId < FILTER_RULE_ID_START + MAX_FILTER_RULES) nextId++;
      if (nextId >= FILTER_RULE_ID_START + MAX_FILTER_RULES) break;
      rules.push({
        id: nextId, priority: 1, action: { type: 'block' },
        condition: { urlFilter: '||' + domain, resourceTypes: ['script', 'image', 'xmlhttprequest', 'sub_frame', 'stylesheet', 'font', 'media', 'websocket', 'ping', 'other'] }
      });
      mapping[nextId] = subscriptionId;
      usedIds.add(nextId);
      nextId++;
    }

    if (rules.length) {
      try {
        await api.declarativeNetRequest.updateDynamicRules({ addRules: rules });
        await setStorage({ filterRuleMapping: mapping });
      } catch (e) { console.error('[WebSuddhi] applySubscriptionRules:', e); }
    }
  } else {
    for (const d of domains) mv2SubscriptionDomains.add(d);
  }
}

/**
 * @param {string} subscriptionId
 * @returns {Promise<void>}
 * @private
 */
async function removeSubscriptionRules(subscriptionId) {
  const api = getApi();
  if (!api.declarativeNetRequest) return;

  const mapping = (await getStorage(['filterRuleMapping'])).filterRuleMapping || {};
  const removeIds = [];
  for (const [id, sid] of Object.entries(mapping)) {
    if (sid === subscriptionId) { removeIds.push(parseInt(id)); delete mapping[id]; }
  }
  if (removeIds.length) {
    try {
      await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds });
      await setStorage({ filterRuleMapping: mapping });
    } catch (e) { console.error('[WebSuddhi] removeSubscriptionRules:', e); }
  }
}

/**
 * @param {Array} subs
 * @returns {Promise<void>}
 * @private
 */
async function loadMV2SubscriptionRules(subs) {
  const stored = (await getStorage(['filterSubscriptionDomains'])).filterSubscriptionDomains || {};
  mv2SubscriptionDomains = new Set();
  for (const sub of subs) {
    if (sub.enabled && !sub.builtin && stored[sub.id]) {
      for (const d of stored[sub.id]) mv2SubscriptionDomains.add(d);
    }
  }
}

/** @private */
function setupAutoUpdate() {
  const api = getApi();
  if (!api.alarms) return;
  api.alarms.create('websuddhi-filter-update', { periodInMinutes: 24 * 60 });
  api.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'websuddhi-filter-update') {
      updateAllSubscriptions().catch((e) => console.error('[WebSuddhi] Auto-update failed:', e));
    }
  });
}

// ============================================
// QUERIES
// ============================================

/**
 * Get the list of all subscriptions.
 *
 * @returns {Promise<Array>}
 */
export async function getSubscriptions() {
  const storage = await getStorage(['filterSubscriptions']);
  return storage.filterSubscriptions || [];
}

/**
 * Get MV2 subscription domains set.
 *
 * @returns {Set<string>}
 */
export function getMV2SubscriptionDomains() {
  return mv2SubscriptionDomains;
}
