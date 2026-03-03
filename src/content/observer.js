/**
 * @module content/observer
 * @description MutationObserver management for dynamic content.
 *
 * Watches for DOM mutations (new nodes, attribute changes) and
 * re-applies blocking rules when relevant changes occur.
 *
 * FIX #37: Disconnects existing observer before creating a new one
 * to prevent memory leaks from stacked observers.
 *
 * FIX #54: Throttles the observer callback to 150 ms to avoid
 * redundant blocking passes on rapid DOM changes.
 *
 * @version 2.1.0
 */
'use strict';

import { state } from './state.js';
import { applyBlocking } from './cosmetic-filter.js';
import { detectAndRemovePaywall } from './paywall.js';
import { handleAntiAdblock } from './anti-adblock.js';

// ============================================
// MUTATION OBSERVER
// ============================================

/**
 * Set up a MutationObserver on document.body.
 *
 * If an observer already exists it is disconnected first (FIX #37).
 * The callback is throttled to 150 ms (FIX #54).
 */
export function setupMutationObserver() {
  if (!document.body) return;

  // FIX #37: Tear down old observer to prevent stacking
  if (state.observer) {
    state.observer.disconnect();
    state.observer = null;
  }

  state.observer = new MutationObserver((mutations) => {
    if (!state.enabled) return;

    // Only process if relevant nodes were added or classes changed
    let hasRelevantChanges = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0 || mutation.type === 'attributes') {
        hasRelevantChanges = true;
        break;
      }
    }
    if (!hasRelevantChanges) return;

    // Throttle re-application (FIX #54)
    clearTimeout(state.observerTimeout);
    state.observerTimeout = setTimeout(() => {
      applyBlocking();
      removePingAttributes();

      if (state.paywallEnabled) {
        detectAndRemovePaywall();
      }

      handleAntiAdblock();
    }, 150);
  });

  state.observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'display'],
  });
}

// ============================================
// PING ATTRIBUTE REMOVAL
// ============================================

/**
 * Remove `ping` attributes from all anchor elements.
 * Prevents click-tracking beacons.
 */
export function removePingAttributes() {
  try {
    document.querySelectorAll('a[ping]').forEach((el) => {
      el.removeAttribute('ping');
    });
  } catch (_) { /* skip */ }
}
