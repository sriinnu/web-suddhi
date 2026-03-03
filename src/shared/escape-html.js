/**
 * @module escape-html
 * @description HTML entity escaping utility for the WebSuddhi extension.
 * Converts special HTML characters to their entity equivalents to prevent
 * XSS when inserting user-supplied text into HTML contexts.
 *
 * CRITICAL FIX: The original implementation returned `div.textContent` after
 * setting `div.textContent = text`, which simply returns the original unescaped
 * string. The fix returns `div.innerHTML` instead, which contains the
 * browser-escaped entity representation.
 *
 * @version 2.1.0
 */
'use strict';

/**
 * Escape special HTML characters in a string to prevent XSS injection.
 *
 * Uses the browser's native DOM text-node encoding: sets the input as
 * `textContent` on a detached `<div>`, then reads back the `innerHTML`
 * which contains the entity-escaped representation.
 *
 * Falls back to a manual replacement map when the DOM is unavailable
 * (e.g. in a service-worker or Node.js context).
 *
 * @param {string} text - The raw string to escape.
 * @returns {string} The HTML-safe escaped string. Returns empty string for falsy input.
 *
 * @example
 * escapeHtml('<script>alert("xss")</script>');
 * // => '&lt;script&gt;alert("xss")&lt;/script&gt;'
 *
 * @example
 * escapeHtml('Tom & Jerry');
 * // => 'Tom &amp; Jerry'
 *
 * @example
 * escapeHtml('');
 * // => ''
 */
export function escapeHtml(text) {
  if (!text) return '';

  // Prefer native DOM escaping when document is available
  if (typeof document !== 'undefined' && document.createElement) {
    const div = document.createElement('div');
    div.textContent = text;
    // FIX: Return innerHTML (escaped) instead of textContent (unescaped)
    return div.innerHTML;
  }

  // Fallback for service-worker / non-DOM environments
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  return String(text).replace(/[&<>"']/g, (ch) => escapeMap[ch]);
}
