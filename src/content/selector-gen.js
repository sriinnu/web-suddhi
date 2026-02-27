/**
 * @module content/selector-gen
 * @description CSS selector generation for element picking.
 *
 * Generates unique, minimal CSS selectors for a given DOM element.
 * Used by Pick Mode and Zap Mode to create user-defined blocking rules.
 *
 * FIX #40: Prefers stable attributes (id, data-*, role, aria-label) over
 * fragile positional pseudo-classes (:nth-of-type, :nth-child) to produce
 * selectors that survive page re-renders and sibling changes.
 *
 * @version 2.1.0
 */
'use strict';

/**
 * Generate a unique, minimal CSS selector for an element.
 *
 * Strategy (in priority order):
 * 1. `#id` if unique in the document
 * 2. Unique class combination (`.classA.classB`)
 * 3. Stable data attributes (`tag[data-x="y"]`)
 * 4. ARIA / role attributes (`tag[role="x"]`)
 * 5. DOM path with `:nth-of-type()` (last resort)
 *
 * @param {HTMLElement} element - Target element.
 * @returns {string} CSS selector string.
 */
export function getUniqueSelector(element) {
  if (!element || element === document.body) return 'body';
  if (element === document.documentElement) return 'html';

  // 1. ID — fastest, most unique
  if (element.id && document.getElementById(element.id) === element) {
    return '#' + CSS.escape(element.id);
  }

  // 2. Unique class combination
  const classSelector = tryClassSelector(element);
  if (classSelector) return classSelector;

  // 3. Stable data attributes (FIX #40)
  const dataSelector = tryDataAttributeSelector(element);
  if (dataSelector) return dataSelector;

  // 4. ARIA / role attributes (FIX #40)
  const ariaSelector = tryAriaSelector(element);
  if (ariaSelector) return ariaSelector;

  // 5. DOM path with :nth-of-type (fallback)
  return buildPathSelector(element);
}

/**
 * Generate a more specific (deeper) CSS selector using :nth-child.
 * Used when the user holds Ctrl during Pick Mode.
 *
 * @param {HTMLElement} element - Target element.
 * @returns {string} CSS selector string.
 */
export function getSpecificSelector(element) {
  if (!element || element === document.body) return 'body';

  const path = [];
  let el = element;
  let depth = 0;

  while (el && el !== document.documentElement && depth < 4) {
    let selector = el.tagName.toLowerCase();

    // Add ID if present — immediately anchors the selector
    if (el.id) {
      selector += '#' + CSS.escape(el.id);
      path.unshift(selector);
      break;
    }

    // Add classes (limit to 2 for readability)
    if (el.className && typeof el.className === 'string') {
      const classes = el.className
        .trim()
        .split(/\s+/)
        .filter((c) => c && !c.startsWith('websuddhi'))
        .slice(0, 2);
      if (classes.length > 0) {
        selector += '.' + classes.map((c) => CSS.escape(c)).join('.');
      }
    }

    // nth-child for maximum specificity
    const parent = el.parentElement;
    if (parent) {
      const index = Array.from(parent.children).indexOf(el) + 1;
      selector += ':nth-child(' + index + ')';
    }

    path.unshift(selector);
    el = el.parentElement;
    depth++;
  }

  return path.join(' > ');
}

// ============================================
// INTERNAL HELPERS
// ============================================

/**
 * Attempt to build a unique selector from the element's class names.
 *
 * @param {HTMLElement} el
 * @returns {string|null} Selector string, or null if not unique.
 * @private
 */
function tryClassSelector(el) {
  if (!el.className || typeof el.className !== 'string') return null;

  const classes = el.className
    .trim()
    .split(/\s+/)
    .filter((c) => c && !c.startsWith('websuddhi'));

  if (classes.length === 0) return null;

  const selector = '.' + classes.map((c) => CSS.escape(c)).join('.');
  try {
    if (document.querySelectorAll(selector).length === 1) {
      return selector;
    }
  } catch { /* invalid selector */ }

  return null;
}

/**
 * Attempt to build a unique selector from data-* attributes.
 * Prefers short, stable values that are likely authored (not framework hashes).
 *
 * @param {HTMLElement} el
 * @returns {string|null} Selector string, or null if not unique.
 * @private
 */
function tryDataAttributeSelector(el) {
  const tag = el.tagName.toLowerCase();
  const parts = [];

  for (const attr of el.attributes) {
    if (
      attr.name.startsWith('data-') &&
      !attr.name.startsWith('data-websuddhi') &&
      attr.value &&
      attr.value.length < 60 // skip very long / hashed values
    ) {
      parts.push('[' + attr.name + '="' + CSS.escape(attr.value) + '"]');
      if (parts.length >= 2) break;
    }
  }

  if (parts.length === 0) return null;

  const selector = tag + parts.join('');
  try {
    if (document.querySelectorAll(selector).length === 1) {
      return selector;
    }
  } catch { /* invalid selector */ }

  return null;
}

/**
 * Attempt to build a unique selector from role / aria-label attributes.
 *
 * @param {HTMLElement} el
 * @returns {string|null} Selector string, or null if not unique.
 * @private
 */
function tryAriaSelector(el) {
  const tag = el.tagName.toLowerCase();

  const role = el.getAttribute('role');
  const ariaLabel = el.getAttribute('aria-label');

  if (role) {
    const selector = tag + '[role="' + CSS.escape(role) + '"]';
    try {
      if (document.querySelectorAll(selector).length === 1) return selector;
    } catch { /* */ }
  }

  if (ariaLabel && ariaLabel.length < 80) {
    const selector = tag + '[aria-label="' + CSS.escape(ariaLabel) + '"]';
    try {
      if (document.querySelectorAll(selector).length === 1) return selector;
    } catch { /* */ }
  }

  return null;
}

/**
 * Build a DOM-path selector using `:nth-of-type()` as a last resort.
 *
 * @param {HTMLElement} element
 * @returns {string} CSS selector path.
 * @private
 */
function buildPathSelector(element) {
  const path = [];
  let el = element;

  while (el && el !== document.documentElement && path.length < 5) {
    let selector = el.tagName.toLowerCase();

    if (el.id) {
      selector += '#' + CSS.escape(el.id);
      path.unshift(selector);
      break;
    }

    // Count same-tag siblings to determine nth-of-type index
    let sibling = el.previousElementSibling;
    let nth = 1;
    while (sibling) {
      if (sibling.tagName === el.tagName) nth++;
      sibling = sibling.previousElementSibling;
    }
    selector += ':nth-of-type(' + nth + ')';

    path.unshift(selector);
    el = el.parentElement;
  }

  return path.join(' > ');
}
