/**
 * @module domain-utils
 * @description Domain parsing, normalisation, matching, and validation utilities
 * for the WebSuddhi browser extension. Extracted and consolidated from
 * `shared/utils.js` and `background/background.js`.
 *
 * Fix #47: `isValidDomain` now accepts internationalised domain names (IDN)
 * by using Unicode property escapes instead of ASCII-only character classes.
 *
 * @version 2.1.0
 */
'use strict';

/**
 * Parse and normalise a hostname string.
 *
 * Handles raw hostnames, full URLs, and edge-cases such as leading dots,
 * trailing dots, port numbers, query strings, and fragments. Optionally
 * strips the `www.` prefix.
 *
 * @param {string} value - A hostname or URL to normalise.
 * @param {boolean} [stripWww=false] - Whether to remove a leading `www.` prefix.
 * @returns {string|null} The normalised lowercase hostname, or `null` if the
 *   input is empty / unparseable.
 *
 * @example
 * normalizeHostname('HTTPS://Www.Example.COM/path?q=1', true);
 * // => 'example.com'
 *
 * @example
 * normalizeHostname('example.com');
 * // => 'example.com'
 *
 * @example
 * normalizeHostname('');
 * // => null
 */
export function normalizeHostname(value, stripWww = false) {
  if (!value || typeof value !== 'string') return null;

  let host = value.trim().toLowerCase();
  if (!host) return null;

  try {
    const parsed = new URL(host.includes('://') ? host : ('https://' + host));
    host = parsed.hostname.toLowerCase();
  } catch (_e) {
    // Fallback: strip path / query / hash / port manually
    host = host.split('/')[0].split('?')[0].split('#')[0];
    host = host.split(':')[0];
  }

  // Remove leading/trailing dots
  host = host.replace(/^\.+/, '').replace(/\.+$/, '');

  if (stripWww) {
    host = host.replace(/^www\./, '');
  }

  // Reject hostnames with spaces or empty results
  if (!host || host.includes(' ')) return null;

  return host;
}

/**
 * Deduplicate and normalise an array of domain strings.
 *
 * Each entry is passed through {@link normalizeHostname}. Duplicates (after
 * normalisation) are silently dropped. An optional `maxItems` cap truncates
 * the result.
 *
 * @param {string[]} domains - Raw domain / URL strings.
 * @param {boolean} [stripWww=false] - Forward to `normalizeHostname`.
 * @param {number} [maxItems=Infinity] - Maximum entries to return.
 * @returns {string[]} Array of unique, normalised hostnames.
 *
 * @example
 * normalizeDomainList(['Example.com', 'https://example.com', 'other.org']);
 * // => ['example.com', 'other.org']
 */
export function normalizeDomainList(domains, stripWww = false, maxItems = Infinity) {
  const normalized = [];
  const seen = new Set();

  for (const domain of domains || []) {
    const host = normalizeHostname(domain, stripWww);
    if (!host || seen.has(host)) continue;
    seen.add(host);
    normalized.push(host);
    if (normalized.length >= maxItems) break;
  }

  return normalized;
}

/**
 * Check whether `host` matches `candidate` exactly or is a subdomain of it.
 *
 * @param {string} host - The full hostname to test (e.g. `sub.example.com`).
 * @param {string} candidate - The candidate domain (e.g. `example.com`).
 * @returns {boolean} `true` if `host` equals `candidate` or ends with `.candidate`.
 *
 * @example
 * domainMatches('tracker.ads.example.com', 'example.com'); // => true
 * domainMatches('example.com', 'example.com');              // => true
 * domainMatches('notexample.com', 'example.com');           // => false
 */
export function domainMatches(host, candidate) {
  if (!host || !candidate) return false;
  return host === candidate || host.endsWith('.' + candidate);
}

/**
 * Extract the hostname from a URL string.
 *
 * If the URL lacks a protocol, `https://` is prepended before parsing.
 * Falls back to a regex extraction when `new URL()` throws.
 *
 * @param {string} url - A full or partial URL.
 * @returns {string|null} The extracted hostname, or `null` on failure.
 *
 * @example
 * extractDomain('https://www.example.com/path?q=1');
 * // => 'www.example.com'
 *
 * @example
 * extractDomain('not a url');
 * // => null (or best-effort match)
 */
export function extractDomain(url) {
  if (!url || typeof url !== 'string') return null;

  try {
    // Handle URLs without protocol
    const normalised = url.includes('://') ? url : 'https://' + url;
    const parsed = new URL(normalised);
    return parsed.hostname;
  } catch (_e) {
    // Regex fallback
    const match = url.match(/^(?:https?:\/\/)?([^/\?#]+)/i);
    return match ? match[1] : null;
  }
}

/**
 * Validate whether a string is a valid domain name.
 *
 * Supports both ASCII domains and internationalised domain names (IDN) that
 * use Unicode letters (fix for issue #47). The validation checks:
 * - Each label is 1–63 characters
 * - Total length does not exceed 253 characters
 * - Labels contain only alphanumeric characters, hyphens, underscores, or
 *   Unicode letters/marks/digits
 * - Labels do not start or end with a hyphen
 * - At least two labels (TLD required)
 *
 * @param {string} domain - The domain string to validate.
 * @returns {boolean} `true` if the domain is syntactically valid.
 *
 * @example
 * isValidDomain('example.com');        // => true
 * isValidDomain('münchen.de');         // => true  (IDN — fix #47)
 * isValidDomain('例え.jp');             // => true  (IDN — fix #47)
 * isValidDomain('-bad.com');           // => false
 * isValidDomain('a'.repeat(64) + '.com'); // => false (label too long)
 * isValidDomain('');                   // => false
 */
export function isValidDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;

  const trimmed = domain.trim().toLowerCase();
  if (!trimmed) return false;

  // Total length check (max 253 chars per RFC 1035)
  if (trimmed.length > 253) return false;

  const labels = trimmed.split('.');

  // Must have at least two labels (e.g. "example.com")
  if (labels.length < 2) return false;

  // Unicode-aware label pattern:
  //   - Starts with a letter, digit, or Unicode letter/digit
  //   - Middle may contain hyphens, underscores, letters, digits, Unicode marks
  //   - Ends with a letter, digit, or Unicode letter/digit
  //   - Single-character labels are also valid
  // Using Unicode property escapes (\p{L}, \p{N}, \p{M}) for IDN support.
  const labelRegex = /^[\p{L}\p{N}](?:[\p{L}\p{N}\p{M}_-]*[\p{L}\p{N}\p{M}])?$/u;

  for (const label of labels) {
    // Each label must be 1–63 characters
    if (label.length === 0 || label.length > 63) return false;
    if (!labelRegex.test(label)) return false;
  }

  return true;
}
