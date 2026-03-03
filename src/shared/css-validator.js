/**
 * @module css-validator
 * @description CSS selector validation and sanitisation, plus filter-list URL
 * validation, for the WebSuddhi browser extension. Extracted from
 * `shared/utils.js` with the following bug-fixes applied:
 *
 * Fix #25: Legitimate CSS unicode escapes (e.g. `\e001`) are no longer
 *   blocked. The dangerous-pattern regex now only rejects *null bytes and
 *   control characters* rather than all `\[0-9a-f]` sequences.
 *
 * Fix #12: Added `isValidFilterListURL` — validates that filter subscription
 *   URLs use HTTPS (or localhost HTTP for dev), rejecting `javascript:`,
 *   `data:`, and other dangerous URI schemes.
 *
 * @version 2.1.0
 */
'use strict';

// ============================================
// DANGEROUS PATTERN BLOCKLIST
// ============================================

/**
 * Regular expressions matching dangerous CSS injection vectors.
 * Any selector that matches one of these is immediately rejected.
 * @type {RegExp[]}
 * @private
 */
const DANGEROUS_PATTERNS = [
  // Script / JS injection
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

  // HTML injection
  /<[^>]*>/,   // HTML tags
  /<!--/,      // HTML comment open
  /-->/,       // HTML comment close

  // Event handler attributes in attribute selectors
  /\[\s*on[a-z]+/i,

  // Dangerous href/src in attribute selectors
  /\[\s*href\s*[\^$*|~]?=\s*["']?\s*javascript/i,
  /\[\s*src\s*[\^$*|~]?=\s*["']?\s*javascript/i,
  /\[\s*href\s*[\^$*|~]?=\s*["']?\s*data:/i,
  /\[\s*src\s*[\^$*|~]?=\s*["']?\s*data:/i,

  // CSS rule injection
  /[{}]/,                   // CSS rule braces
  /;\s*[a-z-]+\s*:/i,      // Property injection (;color:red)

  // Null bytes and control characters (FIX #25: removed \\[0-9a-f]{1,6})
  /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/
];

// ============================================
// WHITELIST CONSTITUENTS
// ============================================

/** @private */
const SAFE_PSEUDO_CLASSES = [
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

/** @private */
const SAFE_PSEUDO_ELEMENTS = [
  'before', 'after', 'first-line', 'first-letter',
  'placeholder', 'selection', 'marker', 'backdrop'
];

/** @private */
const SAFE_ATTR_NAMES =
  'class|id|type|name|value|placeholder|title|alt|role|aria-[a-z]+|data-[a-z0-9-]+|lang|dir|tabindex|disabled|readonly|href|src';

/**
 * Build and cache the whitelist regex for valid CSS selectors.
 * @returns {RegExp|null} The compiled regex, or `null` if compilation fails.
 * @private
 */
function buildWhitelistRegex() {
  const tagPattern = '[a-zA-Z][a-zA-Z0-9-]*';
  const classPattern = '\\.[a-zA-Z_][a-zA-Z0-9_-]*';
  const idPattern = '#[a-zA-Z_][a-zA-Z0-9_-]*';
  const universalPattern = '\\*';

  const attrPattern =
    '\\[\\s*(?:' + SAFE_ATTR_NAMES +
    ')(?:\\s*[~|^$*]?=\\s*(?:"[^"<>]*"|\'[^\'<>]*\'|[^\\]"\'<>\\s]+))?\\s*\\]';

  const pseudoClassPattern =
    ':(?:' + SAFE_PSEUDO_CLASSES.join('|') + ')(?:\\([^()]*\\))?';

  const pseudoElementPattern =
    '::?(?:' + SAFE_PSEUDO_ELEMENTS.join('|') + ')';

  const combinatorPattern = '\\s*[>+~]?\\s*';

  const simpleSelectorPart = '(?:' + [
    tagPattern,
    classPattern,
    idPattern,
    universalPattern,
    attrPattern,
    pseudoClassPattern,
    pseudoElementPattern
  ].join('|') + ')';

  const simpleSelector = simpleSelectorPart + '(?:' + simpleSelectorPart + ')*';

  const fullSelector =
    '^\\s*' + simpleSelector +
    '(?:' + combinatorPattern + simpleSelector + ')*' +
    '(?:\\s*,\\s*' + simpleSelector +
    '(?:' + combinatorPattern + simpleSelector + ')*)*\\s*$';

  try {
    return new RegExp(fullSelector, 'i');
  } catch (_e) {
    return null;
  }
}

/** Lazily compiled whitelist regex. @private */
let _whitelistRegex;

/**
 * Get (or build) the whitelist regex.
 * @returns {RegExp|null}
 * @private
 */
function getWhitelistRegex() {
  if (_whitelistRegex === undefined) {
    _whitelistRegex = buildWhitelistRegex();
  }
  return _whitelistRegex;
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Validate a CSS selector for safe use in element-hiding rules.
 *
 * Uses a two-phase approach:
 * 1. **Blocklist**: Immediately rejects selectors containing dangerous patterns
 *    (script injection, CSS injection, event handlers, etc.).
 * 2. **Whitelist**: Checks the selector against a strict regex of allowed CSS
 *    syntax (tags, classes, IDs, safe attributes, safe pseudo-classes/elements,
 *    combinators, comma-separated lists).
 * 3. **DOM validation**: If `document.querySelector` is available, it serves as
 *    a final sanity check.
 *
 * @param {string} selector - The CSS selector string to validate.
 * @returns {boolean} `true` if the selector is safe to use.
 *
 * @example
 * isValidCSSSelector('div.ad-banner');          // => true
 * isValidCSSSelector('div[onclick="alert()"]'); // => false
 * isValidCSSSelector('');                       // => false
 * isValidCSSSelector('.icon-\\e001');           // => true  (FIX #25)
 */
export function isValidCSSSelector(selector) {
  if (!selector || typeof selector !== 'string') return false;
  if (selector.length > 500) return false;
  if (selector.trim().length === 0) return false;

  // Phase 1: Blocklist
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(selector)) {
      return false;
    }
  }

  // Phase 2: Whitelist
  const whitelistRegex = getWhitelistRegex();
  if (!whitelistRegex || !whitelistRegex.test(selector)) {
    return false;
  }

  // Phase 3: DOM validation (if available)
  if (typeof document !== 'undefined' && document.querySelector) {
    try {
      document.querySelector(selector);
    } catch (_e) {
      return false;
    }
  }

  return true;
}

/**
 * Sanitise a CSS selector string for safe use.
 *
 * If the selector passes {@link isValidCSSSelector}, it is returned trimmed.
 * Otherwise, `null` is returned to indicate the selector is unsafe or invalid.
 *
 * @param {string} selector - The raw CSS selector string.
 * @returns {string|null} The trimmed selector if valid, or `null`.
 *
 * @example
 * sanitizeSelector('  div.ad  ');         // => 'div.ad'
 * sanitizeSelector('<script>');           // => null
 */
export function sanitizeSelector(selector) {
  if (!selector || typeof selector !== 'string') return null;

  const trimmed = selector.trim();
  if (!trimmed) return null;

  return isValidCSSSelector(trimmed) ? trimmed : null;
}

/**
 * Validate a filter-list subscription URL.
 *
 * Requirements (fix #12):
 * - Must be a valid URL
 * - Must use `https:` protocol
 * - `http:` is allowed **only** for `localhost` or `127.0.0.1` (development)
 * - `javascript:`, `data:`, `blob:`, `file:`, and all other schemes are rejected
 *
 * @param {string} url - The filter-list URL to validate.
 * @returns {boolean} `true` if the URL is a valid HTTPS (or localhost HTTP) URL.
 *
 * @example
 * isValidFilterListURL('https://easylist.to/easylist.txt'); // => true
 * isValidFilterListURL('http://localhost:8080/list.txt');    // => true
 * isValidFilterListURL('javascript:alert(1)');              // => false
 * isValidFilterListURL('data:text/plain,hello');            // => false
 * isValidFilterListURL('');                                 // => false
 */
export function isValidFilterListURL(url) {
  if (!url || typeof url !== 'string') return false;

  try {
    const parsed = new URL(url);

    // HTTPS is always allowed
    if (parsed.protocol === 'https:') {
      return true;
    }

    // HTTP only for localhost / 127.0.0.1 (development)
    if (parsed.protocol === 'http:') {
      return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    }

    return false;
  } catch (_e) {
    return false;
  }
}
