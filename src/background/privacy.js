/**
 * @module privacy
 * @description Privacy features for the WebSuddhi background service worker:
 * referrer stripping, WebRTC leak prevention, ping protection, telemetry
 * blocking, and third-party cookie blocking.
 *
 * Fix issue #18: Removed the `facebook.com/tr` path entry from
 * TELEMETRY_DOMAINS (it over-blocks /translate, /trending). Replaced with
 * specific pixel-tracking patterns.
 *
 * Fix issue #32: Converted TELEMETRY_DOMAINS to a `Set` for O(1) lookup.
 *
 * Fix issue #33: Added MV2 fallback for ping protection using
 * `webRequest.onBeforeRequest`.
 *
 * @version 2.1.0
 */
'use strict';

import {
  REFERRER_RULE_ID,
  PING_BLOCK_RULE_ID,
  TELEMETRY_RULE_ID_START,
  THIRD_PARTY_COOKIE_RULE_ID
} from '../shared/constants.js';
import { getStorage, setStorage } from '../shared/storage.js';

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
// TELEMETRY DOMAINS (fix #32 — Set for O(1); fix #18 — no facebook.com/tr)
// ============================================

/**
 * Known telemetry / analytics domains to block.
 * Fix #18: removed `facebook.com/tr` (over-blocks /translate, /trending).
 * Added specific Facebook pixel-tracking patterns instead.
 * Fix #32: stored as a Set for O(1) lookup.
 * @type {Set<string>}
 */
const TELEMETRY_DOMAINS = new Set([
  'google-analytics.com', 'googletagmanager.com', 'googletagservices.com',
  'analytics.google.com', 'ssl.google-analytics.com',
  'segment.io', 'segment.com', 'cdn.segment.com',
  'mixpanel.com', 'api.mixpanel.com', 'cdn.mxpnl.com',
  'amplitude.com', 'api.amplitude.com',
  'hotjar.com', 'static.hotjar.com', 'script.hotjar.com',
  'fullstory.com', 'rs.fullstory.com',
  'heap.io', 'heapanalytics.com',
  'mouseflow.com', 'cdn.mouseflow.com',
  'crazyegg.com', 'script.crazyegg.com',
  'luckyorange.com', 'cdn.luckyorange.net',
  'clarity.ms', 'www.clarity.ms',
  'plausible.io', 'umami.is',
  'matomo.cloud', 'piwik.pro',
  'newrelic.com', 'js-agent.newrelic.com', 'bam.nr-data.net',
  'sentry.io', 'browser.sentry-cdn.com',
  'bugsnag.com', 'd2wy8f7a9ursnm.cloudfront.net',
  'raygun.com', 'raygun.io',
  'logrocket.com', 'cdn.logrocket.io',
  'smartlook.com', 'rec.smartlook.com',
  'inspectlet.com', 'cdn.inspectlet.com',
  'quantserve.com', 'pixel.quantserve.com',
  'scorecardresearch.com', 'sb.scorecardresearch.com',
  'comscore.com', 'b.scorecardresearch.com',
  // Fix #18: specific Facebook pixel domains (NOT facebook.com/tr)
  'pixel.facebook.com', 'tr.facebook.com',
  'connect.facebook.net',
  'bat.bing.com',
  'analytics.tiktok.com', 'analytics.twitter.com',
  'snap.licdn.com', 'px.ads.linkedin.com',
  'ct.pinterest.com', 'analytics.pinterest.com'
]);

/** @type {ReadonlyArray<string>} Flat array for MV3 rule generation. */
const TELEMETRY_DOMAINS_ARRAY = [...TELEMETRY_DOMAINS];

// ============================================
// LISTENERS STATE
// ============================================

/** @type {Function|null} MV2 referrer-stripping listener. */
let _referrerListener = null;

/** @type {Function|null} MV2 telemetry-blocking listener. */
let _telemetryListener = null;

/** @type {Function|null} MV2 ping-blocking listener (fix #33). */
let _pingListener = null;

// ============================================
// INITIALISATION
// ============================================

/**
 * Initialise all privacy features from stored settings.
 *
 * @returns {Promise<void>}
 */
export async function initPrivacy() {
  const storage = await getStorage([
    'referrerStrippingEnabled', 'webrtcProtectionEnabled',
    'pingProtectionEnabled', 'telemetryBlockingEnabled',
    'thirdPartyCookieBlockingEnabled'
  ]);

  if (storage.referrerStrippingEnabled === true) await enableReferrerStripping();
  if (storage.webrtcProtectionEnabled === true) await enableWebRTCProtection();
  if (storage.pingProtectionEnabled !== false) await enablePingProtection();
  if (storage.telemetryBlockingEnabled === true) await enableTelemetryBlocking();
  if (storage.thirdPartyCookieBlockingEnabled === true) await enableThirdPartyCookieBlocking();
}

// ============================================
// REFERRER STRIPPING
// ============================================

/** @returns {Promise<void>} @private */
async function enableReferrerStripping() {
  const api = getApi();
  if (api.declarativeNetRequest) {
    try {
      await api.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [REFERRER_RULE_ID],
        addRules: [{
          id: REFERRER_RULE_ID, priority: 1,
          action: { type: 'modifyHeaders', requestHeaders: [{ header: 'Referer', operation: 'remove' }] },
          condition: { domainType: 'thirdParty', resourceTypes: ['script', 'image', 'xmlhttprequest', 'sub_frame', 'stylesheet', 'font', 'media', 'websocket', 'ping', 'other'] }
        }]
      });
    } catch (e) { console.error('[WebSuddhi] enableReferrerStripping:', e); }
  } else if (api.webRequest?.onBeforeSendHeaders && !_referrerListener) {
    _referrerListener = (details) => {
      try {
        const reqHost = new URL(details.url).hostname;
        const initiator = details.initiator || details.documentUrl || '';
        if (initiator) {
          const initHost = new URL(initiator).hostname;
          if (reqHost === initHost) return {};
        }
      } catch (_e) { /* ignore */ }
      return { requestHeaders: details.requestHeaders.filter((h) => h.name.toLowerCase() !== 'referer') };
    };
    api.webRequest.onBeforeSendHeaders.addListener(_referrerListener, { urls: ['<all_urls>'] }, ['blocking', 'requestHeaders']);
  }
}

/** @returns {Promise<void>} @private */
async function disableReferrerStripping() {
  const api = getApi();
  if (api.declarativeNetRequest) {
    try { await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [REFERRER_RULE_ID] }); } catch (_e) { /* ignore */ }
  } else if (api.webRequest && _referrerListener) {
    api.webRequest.onBeforeSendHeaders.removeListener(_referrerListener);
    _referrerListener = null;
  }
}

/**
 * Toggle referrer stripping on/off.
 *
 * @param {boolean} enabled
 * @returns {Promise<{ success: boolean, enabled: boolean }>}
 */
export async function toggleReferrerStripping(enabled) {
  await setStorage({ referrerStrippingEnabled: enabled });
  enabled ? await enableReferrerStripping() : await disableReferrerStripping();
  return { success: true, enabled };
}

// ============================================
// WEBRTC PROTECTION
// ============================================

/** @returns {Promise<void>} @private */
async function enableWebRTCProtection() {
  const api = getApi();
  try {
    if (api.privacy?.network?.webRTCIPHandlingPolicy) {
      await new Promise((res, rej) => {
        api.privacy.network.webRTCIPHandlingPolicy.set({ value: 'disable_non_proxied_udp' }, () => {
          api.runtime.lastError ? rej(api.runtime.lastError) : res();
        });
      });
    }
  } catch (e) { console.error('[WebSuddhi] enableWebRTCProtection:', e); }
}

/** @returns {Promise<void>} @private */
async function disableWebRTCProtection() {
  const api = getApi();
  try {
    if (api.privacy?.network?.webRTCIPHandlingPolicy) {
      await new Promise((res, rej) => {
        api.privacy.network.webRTCIPHandlingPolicy.set({ value: 'default' }, () => {
          api.runtime.lastError ? rej(api.runtime.lastError) : res();
        });
      });
    }
  } catch (_e) { /* ignore */ }
}

/**
 * Toggle WebRTC leak protection.
 *
 * @param {boolean} enabled
 * @returns {Promise<{ success: boolean, enabled: boolean }>}
 */
export async function toggleWebRTCProtection(enabled) {
  await setStorage({ webrtcProtectionEnabled: enabled });
  enabled ? await enableWebRTCProtection() : await disableWebRTCProtection();
  return { success: true, enabled };
}

// ============================================
// PING PROTECTION (fix #33 — MV2 fallback)
// ============================================

/** @returns {Promise<void>} @private */
async function enablePingProtection() {
  const api = getApi();
  if (api.declarativeNetRequest) {
    try {
      await api.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [PING_BLOCK_RULE_ID],
        addRules: [{ id: PING_BLOCK_RULE_ID, priority: 1, action: { type: 'block' }, condition: { resourceTypes: ['ping'] } }]
      });
    } catch (e) { console.error('[WebSuddhi] enablePingProtection:', e); }
  } else if (api.webRequest?.onBeforeRequest && !_pingListener) {
    // Fix #33: MV2 fallback using webRequest
    _pingListener = (details) => {
      if (details.type === 'ping') return { cancel: true };
      return {};
    };
    api.webRequest.onBeforeRequest.addListener(_pingListener, { urls: ['<all_urls>'] }, ['blocking']);
  }
}

/** @returns {Promise<void>} @private */
async function disablePingProtection() {
  const api = getApi();
  if (api.declarativeNetRequest) {
    try { await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [PING_BLOCK_RULE_ID] }); } catch (_e) { /* ignore */ }
  } else if (api.webRequest && _pingListener) {
    api.webRequest.onBeforeRequest.removeListener(_pingListener);
    _pingListener = null;
  }
}

/**
 * Toggle ping (hyperlink auditing) protection.
 *
 * @param {boolean} enabled
 * @returns {Promise<{ success: boolean, enabled: boolean }>}
 */
export async function togglePingProtection(enabled) {
  await setStorage({ pingProtectionEnabled: enabled });
  enabled ? await enablePingProtection() : await disablePingProtection();
  return { success: true, enabled };
}

// ============================================
// TELEMETRY BLOCKING
// ============================================

/** @returns {Promise<void>} @private */
async function enableTelemetryBlocking() {
  const api = getApi();
  if (api.declarativeNetRequest) {
    try {
      const rules = TELEMETRY_DOMAINS_ARRAY.map((domain, i) => ({
        id: TELEMETRY_RULE_ID_START + i, priority: 2, action: { type: 'block' },
        condition: { urlFilter: '||' + domain, resourceTypes: ['script', 'image', 'xmlhttprequest', 'sub_frame', 'ping', 'other', 'websocket'] }
      }));
      const removeIds = TELEMETRY_DOMAINS_ARRAY.map((_, i) => TELEMETRY_RULE_ID_START + i);
      await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds, addRules: rules });
    } catch (e) { console.error('[WebSuddhi] enableTelemetryBlocking:', e); }
  } else if (api.webRequest?.onBeforeRequest && !_telemetryListener) {
    _telemetryListener = (details) => {
      try {
        const hostname = new URL(details.url).hostname;
        // Fix #32: O(1) lookup via Set
        if (TELEMETRY_DOMAINS.has(hostname)) return { cancel: true };
        for (const d of TELEMETRY_DOMAINS) {
          if (hostname.endsWith('.' + d)) return { cancel: true };
        }
      } catch (_e) { /* ignore */ }
      return {};
    };
    api.webRequest.onBeforeRequest.addListener(_telemetryListener, { urls: ['<all_urls>'] }, ['blocking']);
  }
}

/** @returns {Promise<void>} @private */
async function disableTelemetryBlocking() {
  const api = getApi();
  if (api.declarativeNetRequest) {
    try {
      const removeIds = TELEMETRY_DOMAINS_ARRAY.map((_, i) => TELEMETRY_RULE_ID_START + i);
      await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds });
    } catch (_e) { /* ignore */ }
  } else if (api.webRequest && _telemetryListener) {
    api.webRequest.onBeforeRequest.removeListener(_telemetryListener);
    _telemetryListener = null;
  }
}

/**
 * Toggle telemetry/analytics blocking.
 *
 * @param {boolean} enabled
 * @returns {Promise<{ success: boolean, enabled: boolean }>}
 */
export async function toggleTelemetryBlocking(enabled) {
  await setStorage({ telemetryBlockingEnabled: enabled });
  enabled ? await enableTelemetryBlocking() : await disableTelemetryBlocking();
  return { success: true, enabled };
}

// ============================================
// THIRD-PARTY COOKIE BLOCKING
// ============================================

/** @returns {Promise<void>} @private */
async function enableThirdPartyCookieBlocking() {
  const api = getApi();
  try {
    if (api.privacy?.websites?.thirdPartyCookiesAllowed) {
      await new Promise((res, rej) => {
        api.privacy.websites.thirdPartyCookiesAllowed.set({ value: false }, () => {
          api.runtime.lastError ? rej(api.runtime.lastError) : res();
        });
      });
    } else if (api.declarativeNetRequest) {
      await api.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [THIRD_PARTY_COOKIE_RULE_ID],
        addRules: [{
          id: THIRD_PARTY_COOKIE_RULE_ID, priority: 1,
          action: { type: 'modifyHeaders', responseHeaders: [{ header: 'Set-Cookie', operation: 'remove' }] },
          condition: { domainType: 'thirdParty', resourceTypes: ['script', 'image', 'xmlhttprequest', 'sub_frame', 'stylesheet', 'font', 'media', 'websocket', 'other'] }
        }]
      });
    }
  } catch (e) { console.error('[WebSuddhi] enableThirdPartyCookieBlocking:', e); }
}

/** @returns {Promise<void>} @private */
async function disableThirdPartyCookieBlocking() {
  const api = getApi();
  try {
    if (api.privacy?.websites?.thirdPartyCookiesAllowed) {
      await new Promise((res, rej) => {
        api.privacy.websites.thirdPartyCookiesAllowed.set({ value: true }, () => {
          api.runtime.lastError ? rej(api.runtime.lastError) : res();
        });
      });
    } else if (api.declarativeNetRequest) {
      await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [THIRD_PARTY_COOKIE_RULE_ID] });
    }
  } catch (_e) { /* ignore */ }
}

/**
 * Toggle third-party cookie blocking.
 *
 * @param {boolean} enabled
 * @returns {Promise<{ success: boolean, enabled: boolean }>}
 */
export async function toggleThirdPartyCookieBlocking(enabled) {
  await setStorage({ thirdPartyCookieBlockingEnabled: enabled });
  enabled ? await enableThirdPartyCookieBlocking() : await disableThirdPartyCookieBlocking();
  return { success: true, enabled };
}
