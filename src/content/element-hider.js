/**
 * @module content/element-hider
 * @description DOM element hiding / unhiding utilities for WebSuddhi.
 *
 * FIX #16: Stores original inline styles before hiding so `unblockAll()`
 *          can restore the element's prior layout.
 * FIX #52: Uses `display:none!important` as the primary hiding mechanism
 *          rather than a 6-property combo that anti-adblockers fingerprint.
 * FIX #56: Single shared implementation used by ad-blocker, annoyance-blocker,
 *          and social-blocker modules.
 *
 * @version 2.1.0
 */
'use strict';

import { state } from './state.js';

/**
 * Data attribute used to mark WebSuddhi-blocked elements.
 * @constant {string}
 */
const BLOCKED_ATTR = 'data-websuddhi-blocked';

/**
 * Data attribute that stores the element's original inline `style` string
 * so it can be restored on unblock.
 * @constant {string}
 */
const ORIGINAL_STYLE_ATTR = 'data-websuddhi-original-style';

/**
 * Data attribute for paywall-removed elements.
 * @constant {string}
 */
const REMOVED_ATTR = 'data-websuddhi-removed';

/**
 * Data attribute for annoyance-blocked elements.
 * @constant {string}
 */
const ANNOYANCE_ATTR = 'data-websuddhi-annoyance-blocked';

// ============================================
// HIDING
// ============================================

/**
 * Hide an element and increment the global blocked count.
 *
 * @param {HTMLElement} el - Element to hide.
 * @param {string}      [matchedSelector] - The CSS selector that matched (for stats logging).
 * @param {string}      [reason='true'] - Value stored in `data-websuddhi-blocked`.
 */
export function hideElement(el, matchedSelector, reason = 'true') {
  if (!el || el.hasAttribute(BLOCKED_ATTR)) return;

  // FIX #16: Preserve original inline style so we can restore it later
  const existingStyle = el.getAttribute('style');
  if (existingStyle) {
    el.setAttribute(ORIGINAL_STYLE_ATTR, existingStyle);
  }

  el.classList.add('websuddhi-hidden');
  el.setAttribute(BLOCKED_ATTR, reason);

  // FIX #52: Minimal hiding — `display:none` is sufficient and harder to fingerprint
  el.style.setProperty('display', 'none', 'important');

  state.blockedCount++;
}

/**
 * Hide a social-widget element.
 *
 * @param {HTMLElement} el - Element to hide.
 */
export function hideSocialElement(el) {
  if (!el || el.hasAttribute(BLOCKED_ATTR)) return;

  const existingStyle = el.getAttribute('style');
  if (existingStyle) {
    el.setAttribute(ORIGINAL_STYLE_ATTR, existingStyle);
  }

  el.classList.add('websuddhi-hidden', 'websuddhi-social-blocked');
  el.setAttribute(BLOCKED_ATTR, 'social');
  el.style.setProperty('display', 'none', 'important');

  state.blockedCount++;
}

/**
 * Hide an annoyance element (chat widget, newsletter popup, etc.).
 *
 * @param {HTMLElement} el - Element to hide.
 */
export function hideAnnoyanceElement(el) {
  if (!el || el.hasAttribute(ANNOYANCE_ATTR)) return;

  const existingStyle = el.getAttribute('style');
  if (existingStyle) {
    el.setAttribute(ORIGINAL_STYLE_ATTR, existingStyle);
  }

  el.style.setProperty('display', 'none', 'important');
  el.setAttribute(ANNOYANCE_ATTR, 'true');
}

/**
 * Mark a paywall element as removed.
 *
 * @param {HTMLElement} el - Element to hide.
 * @param {string}      reason - Why it was removed (e.g. 'selector', 'content-blocker').
 */
export function removePaywallElement(el, reason) {
  if (!el) return;

  // Don't remove structural elements
  const tag = el.tagName?.toLowerCase();
  if (tag === 'body' || tag === 'html' || tag === 'main' || tag === 'article') return;
  if (el.id === 'content' || el.id === 'main-content' || el.id === 'article-body') return;
  if (el.hasAttribute(REMOVED_ATTR)) return;

  const existingStyle = el.getAttribute('style');
  if (existingStyle) {
    el.setAttribute(ORIGINAL_STYLE_ATTR, existingStyle);
  }

  el.setAttribute(REMOVED_ATTR, reason);
  el.classList.add('websuddhi-removed');
  el.style.setProperty('display', 'none', 'important');

  state.blockedCount++;
}

// ============================================
// UNHIDING  (FIX #16 — restore original styles)
// ============================================

/**
 * Restore an element's original inline styles and remove WebSuddhi markers.
 *
 * @param {HTMLElement} el - Element to restore.
 * @private
 */
function restoreElement(el) {
  el.classList.remove('websuddhi-hidden', 'websuddhi-removed', 'websuddhi-social-blocked');
  el.removeAttribute(BLOCKED_ATTR);
  el.removeAttribute(REMOVED_ATTR);
  el.removeAttribute(ANNOYANCE_ATTR);

  // FIX #16: Restore original inline style instead of blanking properties
  const originalStyle = el.getAttribute(ORIGINAL_STYLE_ATTR);
  if (originalStyle) {
    el.setAttribute('style', originalStyle);
  } else {
    // No original style — just clear what we set
    el.style.removeProperty('display');
  }
  el.removeAttribute(ORIGINAL_STYLE_ATTR);
}

/**
 * Unblock elements matching a specific CSS selector.
 *
 * @param {string} selector - CSS selector whose matched elements should be unblocked.
 */
export function unblockSelector(selector) {
  try {
    const elements = document.querySelectorAll(selector);
    elements.forEach(restoreElement);
  } catch { /* invalid selector */ }
}

/**
 * Unblock ALL WebSuddhi-hidden elements and reset the blocked count.
 */
export function unblockAll() {
  document.querySelectorAll(
    '.websuddhi-hidden, [data-websuddhi-blocked], [data-websuddhi-removed], [data-websuddhi-annoyance-blocked]'
  ).forEach(restoreElement);
  state.blockedCount = 0;
}

/**
 * Unblock only social-widget-blocked elements.
 */
export function unblockSocialWidgets() {
  document.querySelectorAll(
    '.websuddhi-social-blocked, [data-websuddhi-blocked="social"]'
  ).forEach(restoreElement);
}

// ============================================
// ELEMENT DESCRIPTOR (for logging)
// ============================================

/**
 * Generate a short human-readable descriptor for an element (for logging/stats).
 *
 * @param {HTMLElement} el
 * @returns {string} e.g. "div#sidebar.widget"
 */
export function getElementDescriptor(el) {
  const tag = el.tagName?.toLowerCase() || 'element';
  const id = el.id ? '#' + el.id : '';
  const className =
    typeof el.className === 'string' && el.className.trim()
      ? '.' +
        el.className
          .trim()
          .split(/\s+/)
          .filter((c) => !c.startsWith('websuddhi'))
          .slice(0, 2)
          .join('.')
      : '';
  return (tag + id + className) || tag;
}
