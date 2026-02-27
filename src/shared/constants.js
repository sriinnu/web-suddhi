/**
 * @module constants
 * @description Central constants for the WebSuddhi browser extension.
 * All storage keys, default settings, rule ID ranges, rate limit values,
 * and size limits used across background, content, popup, and options scripts.
 * @version 2.1.0
 */
'use strict';

// ============================================
// STORAGE KEYS
// ============================================

/**
 * Keys used in chrome.storage.local / browser.storage.local.
 * @enum {string}
 */
export const STORAGE_KEYS = {
  /** Master extension enabled/disabled toggle */
  enabled: 'enabled',
  /** List of whitelisted site hostnames */
  whitelistedSites: 'whitelistedSites',
  /** List of user-blocked domains */
  blockedDomains: 'blockedDomains',
  /** List of user-allowed (exempted) domains */
  allowedDomains: 'allowedDomains',
  /** List of user-created CSS selectors for element hiding */
  blockedSelectors: 'blockedSelectors',
  /** Aggregated blocking statistics */
  stats: 'stats',
  /** Filter list subscription metadata */
  filterSubscriptions: 'filterSubscriptions',
  /** Network request log entries */
  requestLog: 'requestLog',
  /** Paywall bypass enabled flag */
  paywallEnabled: 'paywallEnabled',
  /** Social widget blocking enabled flag */
  socialBlockingEnabled: 'socialBlockingEnabled',
  /** Network-level request blocking enabled flag */
  networkBlockingEnabled: 'networkBlockingEnabled',
  /** URL tracking-parameter cleaning enabled flag */
  urlCleaningEnabled: 'urlCleaningEnabled',
  /** Cookie consent auto-dismiss enabled flag */
  cookieConsentEnabled: 'cookieConsentEnabled',
  /** Annoyance element blocking enabled flag */
  annoyanceBlockingEnabled: 'annoyanceBlockingEnabled',
  /** Phishing/malware protection enabled flag */
  phishingProtectionEnabled: 'phishingProtectionEnabled',
  /** Hyperlink auditing (ping) protection enabled flag */
  pingProtectionEnabled: 'pingProtectionEnabled',
  /** HTTP referrer stripping enabled flag */
  referrerStrippingEnabled: 'referrerStrippingEnabled',
  /** WebRTC IP-leak prevention enabled flag */
  webrtcProtectionEnabled: 'webrtcProtectionEnabled',
  /** Telemetry/analytics domain blocking enabled flag */
  telemetryBlockingEnabled: 'telemetryBlockingEnabled',
  /** Third-party cookie blocking enabled flag */
  thirdPartyCookieBlockingEnabled: 'thirdPartyCookieBlockingEnabled',
  /** Request logging enabled flag */
  loggingEnabled: 'loggingEnabled',
  /** Cross-device sync enabled flag */
  syncEnabled: 'syncEnabled',
  /** Toast notification display duration (seconds) */
  toastDuration: 'toastDuration',
  /** Debug mode enabled flag */
  debugEnabled: 'debugEnabled'
};

// ============================================
// DEFAULT SETTINGS
// ============================================

/**
 * Default values for all extension settings.
 * Used as fallback when storage has no persisted value.
 * @type {Object}
 */
export const DEFAULT_SETTINGS = {
  [STORAGE_KEYS.enabled]: true,
  [STORAGE_KEYS.paywallEnabled]: true,
  [STORAGE_KEYS.socialBlockingEnabled]: false,
  [STORAGE_KEYS.networkBlockingEnabled]: true,
  [STORAGE_KEYS.urlCleaningEnabled]: true,
  [STORAGE_KEYS.cookieConsentEnabled]: true,
  [STORAGE_KEYS.annoyanceBlockingEnabled]: true,
  [STORAGE_KEYS.phishingProtectionEnabled]: true,
  [STORAGE_KEYS.pingProtectionEnabled]: true,
  [STORAGE_KEYS.referrerStrippingEnabled]: false,
  [STORAGE_KEYS.webrtcProtectionEnabled]: false,
  [STORAGE_KEYS.telemetryBlockingEnabled]: false,
  [STORAGE_KEYS.thirdPartyCookieBlockingEnabled]: false,
  [STORAGE_KEYS.syncEnabled]: false,
  [STORAGE_KEYS.loggingEnabled]: true,
  [STORAGE_KEYS.toastDuration]: 3,
  [STORAGE_KEYS.debugEnabled]: false,
  performanceStats: {
    totalBlocked: 0,
    byCategory: { ads: 0, trackers: 0, annoyances: 0, paywall: 0 },
    today: { blocked: 0, topDomains: {}, perSite: {} },
    history: []
  },
  maxBlockedCount: 10000,
  maxLogEntries: 1000,
  maxWhitelistSize: 1000,
  maxBlockedDomains: 1000,
  maxBlockedSelectors: 1000
};

// ============================================
// RULE ID RANGES
// ============================================

/**
 * Dynamic rule ID range for network-blocker module.
 * @type {number}
 */
export const NETWORK_RULE_ID_START = 20001;

/**
 * End of the dynamic rule ID range for network-blocker module (inclusive).
 * @type {number}
 */
export const NETWORK_RULE_ID_END = 29999;

/**
 * Dynamic rule ID range start for privacy module.
 * @type {number}
 */
export const PRIVACY_RULE_ID_START = 30001;

/**
 * End of the dynamic rule ID range for privacy module (inclusive).
 * @type {number}
 */
export const PRIVACY_RULE_ID_END = 39999;

/**
 * Referrer-stripping rule ID (within privacy range).
 * @type {number}
 */
export const REFERRER_RULE_ID = 30001;

/**
 * Ping/hyperlink-auditing block rule ID (within privacy range).
 * @type {number}
 */
export const PING_BLOCK_RULE_ID = 30002;

/**
 * Third-party cookie blocking rule ID (within privacy range).
 * @type {number}
 */
export const THIRD_PARTY_COOKIE_RULE_ID = 30003;

/**
 * Start of telemetry blocking rule IDs (within privacy range).
 * @type {number}
 */
export const TELEMETRY_RULE_ID_START = 30100;

/**
 * Dynamic rule ID range start for filter-lists module.
 * @type {number}
 */
export const FILTER_RULE_ID_START = 40001;

/**
 * End of the dynamic rule ID range for filter-lists module (inclusive).
 * @type {number}
 */
export const FILTER_RULE_ID_END = 70000;

/**
 * Maximum number of dynamic rules available for filter lists.
 * Derived from FILTER_RULE_ID_END - FILTER_RULE_ID_START + 1.
 * @type {number}
 */
export const MAX_FILTER_RULES = FILTER_RULE_ID_END - FILTER_RULE_ID_START + 1;

// ============================================
// RATE LIMITING
// ============================================

/**
 * Maximum number of messages per tab per rate-limit window.
 * @type {number}
 */
export const RATE_LIMIT_PER_TAB = 10;

/**
 * Maximum global messages per rate-limit window.
 * @type {number}
 */
export const RATE_LIMIT_GLOBAL = 100;

/**
 * Rate-limit window duration in milliseconds.
 * @type {number}
 */
export const RATE_LIMIT_WINDOW = 1000;

/**
 * Message types that are exempt from rate limiting.
 * @type {ReadonlySet<string>}
 */
export const RATE_LIMIT_EXEMPT_TYPES = Object.freeze(new Set([
  'GET_ALL_SETTINGS',
  'GET_STATS',
  'GET_ENHANCED_STATS',
  'GET_PERIOD_STATS',
  'GET_STATS_FOR_PERIOD'
]));

// ============================================
// LOG & SIZE LIMITS
// ============================================

/**
 * Maximum number of request log entries to retain.
 * @type {number}
 */
export const MAX_LOG_ENTRIES = 1000;

/**
 * Maximum number of CSS selectors that can be stored.
 * @type {number}
 */
export const MAX_BLOCKED_SELECTORS = 1000;

/**
 * Maximum number of blocked domains that can be stored.
 * @type {number}
 */
export const MAX_BLOCKED_DOMAINS = 1000;

/**
 * Maximum number of whitelisted sites that can be stored.
 * @type {number}
 */
export const MAX_WHITELIST_SIZE = 1000;

/**
 * Maximum number of blocked items before auto-truncation.
 * @type {number}
 */
export const MAX_BLOCKED_COUNT = 10000;

// ============================================
// IMPORT LIMITS
// ============================================

/**
 * Maximum number of CSS selectors allowed in a single import.
 * @type {number}
 */
export const MAX_IMPORT_SELECTORS = 500;

/**
 * Maximum number of domains allowed in a single import.
 * @type {number}
 */
export const MAX_IMPORT_DOMAINS = 1000;

/**
 * Maximum number of filter subscriptions allowed in a single import.
 * @type {number}
 */
export const MAX_IMPORT_SUBSCRIPTIONS = 50;

// ============================================
// FILTER LIST CACHE
// ============================================

/**
 * TTL for filter list cache entries in milliseconds (1 hour).
 * @type {number}
 */
export const FILTER_CACHE_TTL = 60 * 60 * 1000;

/**
 * Minimum cooldown between filter subscription updates in milliseconds.
 * @type {number}
 */
export const UPDATE_COOLDOWN = 5000;

// ============================================
// EXTENSION METADATA
// ============================================

/**
 * Current extension version string.
 * @type {string}
 */
export const EXTENSION_VERSION = '2.1.0';

/**
 * Keys that are exported/imported during settings backup.
 * @type {ReadonlyArray<string>}
 */
export const EXPORT_KEYS = Object.freeze([
  'enabled',
  'paywallEnabled',
  'socialBlockingEnabled',
  'networkBlockingEnabled',
  'urlCleaningEnabled',
  'cookieConsentEnabled',
  'annoyanceBlockingEnabled',
  'phishingProtectionEnabled',
  'pingProtectionEnabled',
  'referrerStrippingEnabled',
  'webrtcProtectionEnabled',
  'telemetryBlockingEnabled',
  'thirdPartyCookieBlockingEnabled',
  'loggingEnabled',
  'syncEnabled',
  'toastDuration',
  'whitelistedSites',
  'blockedDomains',
  'allowedDomains',
  'blockedSelectors',
  'filterSubscriptions',
  'maxBlockedCount',
  'maxLogEntries',
  'maxWhitelistSize',
  'maxBlockedDomains',
  'maxBlockedSelectors'
]);
