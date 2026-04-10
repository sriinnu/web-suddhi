// WebSuddhi - Shared Utilities Module
// Used by: background scripts, content scripts, popup, options
// v2.1.0

(function() {
  'use strict';

  // Initialize shared namespace
  if (!self.WebSuddhi) self.WebSuddhi = {};
  if (!self.WebSuddhi.utils) self.WebSuddhi.utils = {};

  const utils = self.WebSuddhi.utils;

  // ============================================
  // DEBUG LOGGING SYSTEM
  // ============================================
  let debugEnabled = false;

  // Check debug setting on load
  (async function checkDebugSetting() {
    try {
      const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;
      if (api && api.storage) {
        const result = await new Promise((resolve) => {
          const promise = api.storage.local.get(['debugEnabled']);
          if (promise && typeof promise.then === 'function') {
            promise.then(resolve).catch(() => resolve({}));
          } else {
            api.storage.local.get(['debugEnabled'], (data) => resolve(data || {}));
          }
        });
        debugEnabled = result.debugEnabled === true;
      }
    } catch (e) {
      debugEnabled = false;
    }
  })();

  utils.log = function(...args) {
    if (debugEnabled) {
      console.log('[WebSuddhi]', ...args);
    }
  };

  utils.warn = function(...args) {
    if (debugEnabled) {
      console.warn('[WebSuddhi]', ...args);
    }
  };

  utils.error = function(...args) {
    if (debugEnabled) {
      console.error('[WebSuddhi]', ...args);
    }
  };

  utils.setDebug = function(enabled) {
    debugEnabled = enabled;
  };

  utils.isDebugEnabled = function() {
    return debugEnabled;
  };

  // ============================================
  // DOM HELPERS
  // ============================================

  // Safely clear all children from an element
  utils.clearElement = function(element) {
    if (!element) return;
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  };

  // Create SVG icon element
  utils.createSVGIcon = function(pathData, size = 18) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', 'currentColor');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    svg.appendChild(path);

    return svg;
  };

  // Common SVG paths
  utils.SVG_PATHS = {
    pick: 'M7 2l12 11.5-5.5 1.2 3.3 6.8-2.2 1-3.2-7L7 20V2z',
    cancel: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
    delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
    warning: 'M12 2L1 21h22L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z'
  };

  // Create button with SVG icon and text
  utils.createIconButton = function(pathData, text, size = 18) {
    const fragment = document.createDocumentFragment();
    const svg = utils.createSVGIcon(pathData, size);
    fragment.appendChild(svg);
    fragment.appendChild(document.createTextNode(' ' + text));
    return fragment;
  };

  // Safely set element content (no HTML parsing)
  utils.setTextContent = function(element, text) {
    if (!element) return;
    element.textContent = text;
  };

  // Create element with attributes and text
  utils.createElement = function(tag, attrs = {}, textContent = null) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'className') {
        el.className = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(el.style, value);
      } else {
        el.setAttribute(key, value);
      }
    }
    if (textContent !== null) {
      el.textContent = textContent;
    }
    return el;
  };

  // ============================================
  // VALIDATION UTILITIES
  // ============================================

  // Validate CSS selector (works in both DOM and service worker contexts)
  // Uses strict whitelist approach to prevent CSS selector injection attacks
  utils.isValidCSSSelector = function(selector) {
    if (!selector || typeof selector !== 'string') return false;
    if (selector.length > 500) return false; // Reasonable length limit
    if (selector.trim().length === 0) return false;

    // ============================================
    // DANGEROUS PATTERN BLOCKLIST (reject first)
    // ============================================

    // Block any selector containing dangerous CSS injection patterns
    const dangerousPatterns = [
      // Script/JS injection
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /data:/i,

      // CSS injection vectors
      /url\s*\(/i,
      /expression\s*\(/i,
      /@import/i,
      /@charset/i,
      /@font-face/i,
      /-moz-binding/i,
      /behavior\s*:/i,

      // HTML injection (< > outside of child combinator context)
      /<[^>]*>/,  // HTML tags
      /<!--/,     // HTML comments
      /-->/,

      // Event handler attributes (even in attribute selectors)
      /\[\s*on[a-z]+/i,  // [onclick], [onerror], [onload], etc.

      // Dangerous href/src patterns in attribute selectors
      /\[\s*href\s*[\^$*|~]?=\s*["']?\s*javascript/i,
      /\[\s*src\s*[\^$*|~]?=\s*["']?\s*javascript/i,
      /\[\s*href\s*[\^$*|~]?=\s*["']?\s*data:/i,
      /\[\s*src\s*[\^$*|~]?=\s*["']?\s*data:/i,

      // CSS rule injection
      /[{}]/,     // CSS rule braces
      /;\s*[a-z-]+\s*:/i,  // Property injection (;color:red)

      // Unicode escapes that could bypass filters
      /\\[0-9a-f]{1,6}/i,

      // Null bytes and control characters
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(selector)) {
        return false;
      }
    }

    // ============================================
    // WHITELIST VALIDATION (strict allowed patterns)
    // ============================================

    // Allowed safe pseudo-classes
    const safePseudoClasses = [
      'first-child', 'last-child', 'only-child',
      'first-of-type', 'last-of-type', 'only-of-type',
      'empty', 'root', 'target',
      'enabled', 'disabled', 'checked', 'indeterminate',
      'required', 'optional', 'valid', 'invalid',
      'in-range', 'out-of-range', 'read-only', 'read-write',
      'focus', 'hover', 'active', 'visited', 'link',
      'not', 'is', 'where', 'has',
      'nth-child', 'nth-last-child', 'nth-of-type', 'nth-last-of-type'
    ];

    // Allowed safe pseudo-elements
    const safePseudoElements = [
      'before', 'after', 'first-line', 'first-letter',
      'placeholder', 'selection', 'marker', 'backdrop'
    ];

    // Build whitelist regex pattern
    // Allowed: tag names, classes, IDs, basic attribute selectors (safe), pseudo-classes/elements, combinators

    // Tag name: letters and hyphens (custom elements)
    const tagPattern = '[a-zA-Z][a-zA-Z0-9-]*';

    // Class selector: .classname (alphanumeric, hyphens, underscores)
    const classPattern = '\\.[a-zA-Z_][a-zA-Z0-9_-]*';

    // ID selector: #idname
    const idPattern = '#[a-zA-Z_][a-zA-Z0-9_-]*';

    // Universal selector
    const universalPattern = '\\*';

    // Safe attribute selectors: [attr], [attr=value], [attr^=value], etc.
    // Only allow safe attribute names (no event handlers)
    const safeAttrNames = 'class|id|type|name|value|placeholder|title|alt|role|aria-[a-z]+|data-[a-z0-9-]+|lang|dir|tabindex|disabled|readonly|href|src';
    const attrPattern = '\\[\\s*(?:' + safeAttrNames + ')(?:\\s*[~|^$*]?=\\s*(?:"[^"<>]*"|\'[^\'<>]*\'|[^\\]"\'<>\\s]+))?\\s*\\]';

    // Pseudo-class pattern (only safe ones)
    const pseudoClassList = safePseudoClasses.join('|');
    const pseudoClassPattern = ':(?:' + pseudoClassList + ')(?:\\([^()]*\\))?';

    // Pseudo-element pattern (only safe ones)
    const pseudoElementList = safePseudoElements.join('|');
    const pseudoElementPattern = '::?(?:' + pseudoElementList + ')';

    // Combinator: space, >, +, ~
    const combinatorPattern = '\\s*[>+~]?\\s*';

    // Single simple selector (one element in the selector chain)
    const simpleSelectorPart = '(?:' + [
      tagPattern,
      classPattern,
      idPattern,
      universalPattern,
      attrPattern,
      pseudoClassPattern,
      pseudoElementPattern
    ].join('|') + ')';

    // A simple selector can have multiple parts (e.g., div.class#id:hover)
    const simpleSelector = simpleSelectorPart + '(?:' + simpleSelectorPart + ')*';

    // Full selector: simple selectors joined by combinators
    // Also allow comma-separated selector lists
    const fullSelector = '^\\s*' + simpleSelector + '(?:' + combinatorPattern + simpleSelector + ')*' + '(?:\\s*,\\s*' + simpleSelector + '(?:' + combinatorPattern + simpleSelector + ')*)*\\s*$';

    // Compile the whitelist regex
    let whitelistRegex;
    try {
      whitelistRegex = new RegExp(fullSelector, 'i');
    } catch (e) {
      // If regex compilation fails, reject the selector
      return false;
    }

    // Test against whitelist
    if (!whitelistRegex.test(selector)) {
      return false;
    }

    // ============================================
    // DOM VALIDATION (if available, as final check)
    // ============================================

    // If we have DOM access, also validate with native parser
    // This catches any edge cases the regex might miss
    if (typeof document !== 'undefined' && document.querySelector) {
      try {
        document.querySelector(selector);
      } catch (e) {
        return false;
      }
    }

    return true;
  };

  // Validate filter list URL (HTTPS required)
  utils.isValidFilterListURL = function(url) {
    if (!url || typeof url !== 'string') return false;

    try {
      const parsed = new URL(url);

      // Only allow HTTPS (and localhost for development)
      if (parsed.protocol === 'https:') {
        return true;
      }

      // Allow HTTP only for localhost/127.0.0.1
      if (parsed.protocol === 'http:') {
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
          return true;
        }
      }

      return false;
    } catch (e) {
      return false;
    }
  };

  // ============================================
  // TRACKER CATEGORIZATION
  // ============================================

  // Tracker database with categories and severity
  const TRACKER_DATABASE = {
    // Fingerprinting (High severity)
    'fingerprintjs.com': { category: 'Fingerprinting', severity: 'high', desc: 'Browser fingerprinting' },
    'fpjs.io': { category: 'Fingerprinting', severity: 'high', desc: 'FingerprintJS CDN' },
    'fraudlogicx.com': { category: 'Fingerprinting', severity: 'high', desc: 'Fraud detection fingerprinting' },
    'iovation.com': { category: 'Fingerprinting', severity: 'high', desc: 'Device fingerprinting' },
    'threatmetrix.com': { category: 'Fingerprinting', severity: 'high', desc: 'Device fingerprinting' },
    'perimeterx.com': { category: 'Fingerprinting', severity: 'high', desc: 'Bot detection fingerprinting' },
    'datadome.co': { category: 'Fingerprinting', severity: 'high', desc: 'Bot detection fingerprinting' },
    'kasada.io': { category: 'Fingerprinting', severity: 'high', desc: 'Bot detection' },
    'distil.it': { category: 'Fingerprinting', severity: 'high', desc: 'Bot detection' },

    // Session Recording (High severity)
    'hotjar.com': { category: 'Session Recording', severity: 'high', desc: 'Session recording & heatmaps' },
    'clarity.ms': { category: 'Session Recording', severity: 'high', desc: 'Microsoft Clarity recording' },
    'fullstory.com': { category: 'Session Recording', severity: 'high', desc: 'Session recording' },
    'logrocket.com': { category: 'Session Recording', severity: 'high', desc: 'Session recording' },
    'mouseflow.com': { category: 'Session Recording', severity: 'high', desc: 'Session recording' },
    'smartlook.com': { category: 'Session Recording', severity: 'high', desc: 'Session recording' },
    'sessionstack.com': { category: 'Session Recording', severity: 'high', desc: 'Session recording' },
    'contentsquare.com': { category: 'Session Recording', severity: 'high', desc: 'Session analytics' },

    // Analytics (Medium severity)
    'google-analytics.com': { category: 'Analytics', severity: 'medium', desc: 'Google Analytics' },
    'googletagmanager.com': { category: 'Analytics', severity: 'medium', desc: 'Google Tag Manager' },
    'analytics.google.com': { category: 'Analytics', severity: 'medium', desc: 'Google Analytics' },
    'mixpanel.com': { category: 'Analytics', severity: 'medium', desc: 'Product analytics' },
    'segment.com': { category: 'Analytics', severity: 'medium', desc: 'Customer data platform' },
    'amplitude.com': { category: 'Analytics', severity: 'medium', desc: 'Product analytics' },
    'posthog.com': { category: 'Analytics', severity: 'medium', desc: 'Product analytics' },
    'pendo.io': { category: 'Analytics', severity: 'medium', desc: 'Product analytics' },
    'heap.io': { category: 'Analytics', severity: 'medium', desc: 'Digital analytics' },
    'newrelic.com': { category: 'Analytics', severity: 'medium', desc: 'APM & monitoring' },
    'dynatrace.com': { category: 'Analytics', severity: 'medium', desc: 'APM & monitoring' },
    'scorecardresearch.com': { category: 'Analytics', severity: 'medium', desc: 'Audience measurement' },
    'imrworldwide.com': { category: 'Analytics', severity: 'medium', desc: 'Nielsen measurement' },

    // Advertising (Medium severity)
    'doubleclick.net': { category: 'Advertising', severity: 'medium', desc: 'Google Ads' },
    'googlesyndication.com': { category: 'Advertising', severity: 'medium', desc: 'Google AdSense' },
    'googleadservices.com': { category: 'Advertising', severity: 'medium', desc: 'Google Ads' },
    'adservice.google.com': { category: 'Advertising', severity: 'medium', desc: 'Google Ads' },
    'criteo.com': { category: 'Advertising', severity: 'medium', desc: 'Retargeting ads' },
    'taboola.com': { category: 'Advertising', severity: 'medium', desc: 'Content recommendation ads' },
    'outbrain.com': { category: 'Advertising', severity: 'medium', desc: 'Content recommendation ads' },
    'amazon-adsystem.com': { category: 'Advertising', severity: 'medium', desc: 'Amazon Ads' },
    'adnxs.com': { category: 'Advertising', severity: 'medium', desc: 'AppNexus/Xandr' },
    'pubmatic.com': { category: 'Advertising', severity: 'medium', desc: 'Programmatic ads' },
    'rubiconproject.com': { category: 'Advertising', severity: 'medium', desc: 'Programmatic ads' },
    'openx.net': { category: 'Advertising', severity: 'medium', desc: 'Programmatic ads' },
    'advertising.com': { category: 'Advertising', severity: 'medium', desc: 'AOL Advertising' },
    'media.net': { category: 'Advertising', severity: 'medium', desc: 'Contextual ads' },
    'adsrvr.org': { category: 'Advertising', severity: 'medium', desc: 'The Trade Desk' },
    'thetradedesk.com': { category: 'Advertising', severity: 'medium', desc: 'The Trade Desk' },
    'adroll.com': { category: 'Advertising', severity: 'medium', desc: 'Retargeting' },

    // Social Tracking (Medium severity)
    'connect.facebook.net': { category: 'Social Tracking', severity: 'medium', desc: 'Facebook SDK' },
    'facebook.com': { category: 'Social Tracking', severity: 'medium', desc: 'Facebook tracking' },
    'facebook.net': { category: 'Social Tracking', severity: 'medium', desc: 'Facebook tracking' },
    'pixel.facebook.com': { category: 'Social Tracking', severity: 'medium', desc: 'Facebook Pixel' },
    'ads.twitter.com': { category: 'Social Tracking', severity: 'medium', desc: 'Twitter Ads' },
    'analytics.twitter.com': { category: 'Social Tracking', severity: 'medium', desc: 'Twitter Analytics' },
    'ads.linkedin.com': { category: 'Social Tracking', severity: 'medium', desc: 'LinkedIn Ads' },
    'snap.licdn.com': { category: 'Social Tracking', severity: 'medium', desc: 'LinkedIn tracking' },
    'tr.snapchat.com': { category: 'Social Tracking', severity: 'medium', desc: 'Snapchat tracking' },
    'ads.pinterest.com': { category: 'Social Tracking', severity: 'medium', desc: 'Pinterest Ads' },
    'analytics.tiktok.com': { category: 'Social Tracking', severity: 'medium', desc: 'TikTok Analytics' },

    // Data Enrichment (Medium-High severity)
    'clearbit.com': { category: 'Data Enrichment', severity: 'medium', desc: 'B2B data enrichment' },
    'zoominfo.com': { category: 'Data Enrichment', severity: 'medium', desc: 'B2B data enrichment' },
    'apollo.io': { category: 'Data Enrichment', severity: 'medium', desc: 'Sales intelligence' },
    'lusha.com': { category: 'Data Enrichment', severity: 'medium', desc: 'Contact data' },
    'leadiq.com': { category: 'Data Enrichment', severity: 'medium', desc: 'Lead data' },
    'bluekai.com': { category: 'Data Enrichment', severity: 'medium', desc: 'Oracle data cloud' },
    'bombora.com': { category: 'Data Enrichment', severity: 'medium', desc: 'Intent data' },
    'demdex.net': { category: 'Data Enrichment', severity: 'medium', desc: 'Adobe Audience Manager' },
    'krxd.net': { category: 'Data Enrichment', severity: 'medium', desc: 'Salesforce DMP' },
    'lotame.com': { category: 'Data Enrichment', severity: 'medium', desc: 'Data management' },

    // Marketing Automation (Medium severity)
    'pardot.com': { category: 'Marketing', severity: 'medium', desc: 'Salesforce Pardot' },
    'marketo.com': { category: 'Marketing', severity: 'medium', desc: 'Adobe Marketo' },
    'eloqua.com': { category: 'Marketing', severity: 'medium', desc: 'Oracle Eloqua' },
    'hubspot.com': { category: 'Marketing', severity: 'medium', desc: 'HubSpot tracking' },
    'hs-analytics.net': { category: 'Marketing', severity: 'medium', desc: 'HubSpot Analytics' },
    'mktoresp.com': { category: 'Marketing', severity: 'medium', desc: 'Marketo' },

    // Error Tracking (Low severity)
    'bugsnag.com': { category: 'Error Tracking', severity: 'low', desc: 'Error monitoring' },
    'rollbar.com': { category: 'Error Tracking', severity: 'low', desc: 'Error monitoring' },
    'trackjs.com': { category: 'Error Tracking', severity: 'low', desc: 'JavaScript error tracking' },
    'sentry.io': { category: 'Error Tracking', severity: 'low', desc: 'Error monitoring' }
  };

  // Expose the tracker database for other modules to use
  utils.getTrackerDatabase = function() {
    return TRACKER_DATABASE;
  };

  // Get tracker info by domain (supports subdomain matching)
  utils.getTrackerInfo = function(domain) {
    if (!domain || typeof domain !== 'string') {
      return null;
    }

    const lowerDomain = domain.toLowerCase();

    // Direct match
    if (TRACKER_DATABASE[lowerDomain]) {
      return { ...TRACKER_DATABASE[lowerDomain], matchedDomain: lowerDomain };
    }

    // Try removing subdomains progressively
    const parts = lowerDomain.split('.');
    for (let i = 1; i < parts.length - 1; i++) {
      const parentDomain = parts.slice(i).join('.');
      if (TRACKER_DATABASE[parentDomain]) {
        return {
          ...TRACKER_DATABASE[parentDomain],
          matchedDomain: parentDomain,
          subdomain: parts.slice(0, i).join('.')
        };
      }
    }

    // No match found - return generic info
    return {
      category: 'Unknown',
      severity: 'low',
      desc: 'Blocked domain',
      matchedDomain: lowerDomain
    };
  };

  // Get category color by severity
  utils.getSeverityColor = function(severity) {
    switch (severity) {
      case 'high': return '#ef4444';   // Red
      case 'medium': return '#f59e0b'; // Amber
      case 'low': return '#22c55e';    // Green
      default: return '#6b7280';       // Gray
    }
  };

  // Get all available categories
  utils.getTrackerCategories = function() {
    return [
      'Fingerprinting',
      'Session Recording',
      'Analytics',
      'Advertising',
      'Social Tracking',
      'Data Enrichment',
      'Marketing',
      'Error Tracking',
      'Unknown'
    ];
  };

  // ============================================
  // STRING UTILITIES
  // ============================================

  // Escape HTML (safe for textContent, returns escaped string)
  utils.escapeHtml = function(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  // Format large numbers with K/M suffix
  utils.formatNumber = function(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return String(num);
  };

  // Format bytes to human readable
  utils.formatBytes = function(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Get relative time string
  utils.getRelativeTime = function(timestamp) {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 1000) return 'just now';
    if (diff < 60000) return Math.floor(diff / 1000) + 's ago';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return new Date(timestamp).toLocaleDateString();
  };

  // ============================================
  // DOMAIN UTILITIES
  // ============================================

  // Extract domain from URL
  utils.extractDomain = function(url) {
    if (!url || typeof url !== 'string') return null;

    try {
      // Handle URLs without protocol
      if (!url.includes('://')) {
        url = 'https://' + url;
      }
      const parsed = new URL(url);
      return parsed.hostname;
    } catch (e) {
      // Try regex fallback
      const match = url.match(/^(?:https?:\/\/)?([^\/\?#]+)/i);
      return match ? match[1] : null;
    }
  };

  // Normalize hostname (remove www.)
  utils.normalizeHostname = function(hostname) {
    if (!hostname) return '';
    return hostname.toLowerCase().replace(/^www\./, '');
  };

  // ============================================
  // CROSS-BROWSER STORAGE HELPERS
  // ============================================
  // Shared get/set storage to avoid duplication across background modules

  const storageApi = (typeof browser !== 'undefined' && browser.runtime) ? browser : (typeof chrome !== 'undefined' ? chrome : null);

  utils.getStorage = function(keys) {
    return new Promise((resolve, reject) => {
      if (storageApi && storageApi.storage) {
        const result = storageApi.storage.local.get(keys);
        if (result && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
        } else {
          storageApi.storage.local.get(keys, (data) => {
            if (storageApi.runtime.lastError) reject(storageApi.runtime.lastError);
            else resolve(data);
          });
        }
        return;
      }
      resolve({});
    });
  };

  utils.setStorage = function(data) {
    return new Promise((resolve, reject) => {
      if (storageApi && storageApi.storage) {
        const result = storageApi.storage.local.set(data);
        if (result && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
        } else {
          storageApi.storage.local.set(data, () => {
            if (storageApi.runtime.lastError) reject(storageApi.runtime.lastError);
            else resolve();
          });
        }
        return;
      }
      resolve();
    });
  };

  // Get storage with sync support (for settings that can sync across devices)
  utils.getSyncStorage = function(keys) {
    return new Promise((resolve, reject) => {
      if (storageApi && storageApi.storage && storageApi.storage.sync) {
        const result = storageApi.storage.sync.get(keys);
        if (result && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
        } else {
          storageApi.storage.sync.get(keys, (data) => {
            if (storageApi.runtime.lastError) reject(storageApi.runtime.lastError);
            else resolve(data);
          });
        }
        return;
      }
      resolve({});
    });
  };

  // Set storage with sync support
  utils.setSyncStorage = function(data) {
    return new Promise((resolve, reject) => {
      if (storageApi && storageApi.storage && storageApi.storage.sync) {
        const result = storageApi.storage.sync.set(data);
        if (result && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
        } else {
          storageApi.storage.sync.set(data, () => {
            if (storageApi.runtime.lastError) reject(storageApi.runtime.lastError);
            else resolve();
          });
        }
        return;
      }
      resolve();
    });
  };

  // ============================================
  // DOM UTILITIES (for content scripts)
  // ============================================

  // Check if element is visible (works in DOM context)
  utils.isVisible = function(el) {
    if (!el || !el.parentElement) return false;

    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none') return false;
      if (style.visibility === 'hidden') return false;
      if (style.opacity === '0') return false;
      if (style.position === 'fixed' && style.left === '-9999px') return false;

      // Check if element has layout
      if (el.offsetParent === null && style.position !== 'fixed') return false;

      const rect = el.getBoundingClientRect();
      if (rect.width < 1 && rect.height < 1) return false;

      let parent = el.parentElement;
      let depth = 0;
      const maxDepth = 50; // Prevent infinite loops

      while (parent && depth < maxDepth) {
        try {
          const parentStyle = window.getComputedStyle(parent);
          if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden' || parentStyle.opacity === '0') {
            return false;
          }
        } catch (e) {
          // Cross-origin iframe - assume visible
        }
        parent = parent.parentElement;
        depth++;
      }

      return true;
    } catch (e) {
      return true; // Default to visible for safety
    }
  };

})();
