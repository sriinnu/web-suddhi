/**
 * @module content/zap
 * @description Zap Mode — quick click-to-hide with persistence.
 *
 * Lets the user click any element to instantly hide it.
 * Unlike the original version, blocked elements now PERSIST across
 * page refreshes by saving a CSS selector rule to storage.
 *
 * @version 2.1.0
 */
'use strict';

import { state, saveSelectors } from './state.js';
import { getUniqueSelector } from './selector-gen.js';
import { hideElement } from './element-hider.js';
import { blockSelector } from './cosmetic-filter.js';
import { showToast, removeToast, clearHighlights } from './ui.js';
import { sendMessage } from './messaging.js';

// ============================================
// ZAP MODE LIFECYCLE
// ============================================

/**
 * Start Zap Mode: enable hover highlighting and click-to-hide.
 * Only runs in the top frame to avoid iframe conflicts.
 */
export function startZapMode() {
  // Only top frame
  if (window !== window.top) return;
  if (!document.body) return;

  // Stop pick mode if active
  if (state.pickMode) {
    import('./picker.js').then((m) => m.stopPickMode());
  }

  state.zapMode = true;
  document.body.classList.add('websuddhi-zap-mode');

  window.focus();
  if (document.body) document.body.focus();

  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('mouseout', handleMouseOut, true);
  document.addEventListener('click', handleZapClick, true);
  document.addEventListener('keydown', handleZapEscape, true);

  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';

  showToast('Zap mode: click elements to hide them instantly. Press Esc to exit.');
}

/**
 * Stop Zap Mode and clean up all listeners.
 */
export function stopZapMode() {
  state.zapMode = false;
  document.body.classList.remove('websuddhi-zap-mode');

  document.removeEventListener('mouseover', handleMouseOver, true);
  document.removeEventListener('mouseout', handleMouseOut, true);
  document.removeEventListener('click', handleZapClick, true);
  document.removeEventListener('keydown', handleZapEscape, true);

  document.body.style.userSelect = '';
  document.body.style.webkitUserSelect = '';

  clearHighlights();
  removeToast();
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Highlight element on hover.
 * @param {MouseEvent} e
 * @private
 */
function handleMouseOver(e) {
  if (!state.zapMode) return;
  e.stopPropagation();

  if (isOurUI(e.target) || e.target === document.body || e.target === document.documentElement) return;

  clearHighlights();
  state.hoveredElement = e.target;
  state.hoveredElement.classList.add('websuddhi-pick-highlight');
}

/**
 * Remove highlight on mouse out.
 * @param {MouseEvent} e
 * @private
 */
function handleMouseOut(e) {
  if (!state.zapMode) return;
  if (e.target === state.hoveredElement) {
    e.target.classList.remove('websuddhi-pick-highlight');
    state.hoveredElement = null;
  }
}

/**
 * Zap (hide + persist) clicked element.
 *
 * Generates a unique CSS selector, hides the element, saves the rule
 * to storage, and notifies the background of the new selector.
 *
 * @param {MouseEvent} e
 * @private
 */
function handleZapClick(e) {
  if (!state.zapMode) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  const el = e.target;
  if (isOurUI(el)) return;

  const selector = getUniqueSelector(el);
  hideElement(el, selector);

  if (!selector) {
    showToast('Element hidden (could not generate selector)');
    return;
  }

  // Persist the rule asynchronously
  (async () => {
    try {
      if (state.blockedSelectors.size >= 500) {
        showToast('Element hidden — rule limit reached (500). Remove old rules first.');
        return;
      }

      state.blockedSelectors.set(selector, {
        url: window.location.hostname,
        date: Date.now(),
        source: 'zap',
      });

      blockSelector(selector);

      // Persist via background (single writer) to avoid cross-tab race
      try {
        await sendMessage({ type: 'ADD_SELECTOR', selector });
      } catch (_) {
        // Fallback: save directly if background unreachable
        await saveSelectors();
      }

      showToast('Element zapped and rule saved');
    } catch (err) {
      console.error('[WebSuddhi] Zap save failed:', err);
      showToast('Element hidden (save failed)');
    }
  })();
}

/**
 * Exit Zap Mode on Escape key.
 * @param {KeyboardEvent} e
 * @private
 */
function handleZapEscape(e) {
  if (e.key === 'Escape' && state.zapMode) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    stopZapMode();
  }
}

// ============================================
// HELPERS
// ============================================

// saveSelectors imported from state.js

/**
 * Check if an element is part of our extension's UI.
 * @param {HTMLElement} el
 * @returns {boolean}
 * @private
 */
function isOurUI(el) {
  if (!el) return false;
  return (
    el.classList.contains('websuddhi-pick-preview') ||
    el.closest('.websuddhi-pick-preview') ||
    el.classList.contains('websuddhi-preview-panel') ||
    el.closest('.websuddhi-preview-panel') ||
    el.classList.contains('websuddhi-toast')
  );
}
