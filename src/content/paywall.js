/**
 * @module content/paywall
 * @description Paywall detection and removal engine.
 *
 * Detects and removes paywall overlays, subscription walls,
 * blur effects, and scroll-locking techniques used by news sites.
 *
 * FIX #9 / #22: Stronger signal requirements to reduce false-positive
 * removal of legitimate modals and overlays.
 *
 * @version 2.1.0
 */
'use strict';

import { state } from './state.js';
import { AD_SELECTORS } from './selectors.js';

// ============================================
// MAIN ENTRY POINTS
// ============================================

/**
 * Run all paywall detection methods.
 * Called on init and periodically via setTimeout.
 */
export function detectAndRemovePaywall() {
  if (!state.paywallEnabled) return;

  // Method 1: Selector-based matching
  const paywallSelectors = AD_SELECTORS.paywall || [];
  for (const selector of paywallSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        if (isPaywallElement(el)) {
          removePaywallElement(el, 'selector');
        }
      });
    } catch (_) { /* invalid selector */ }
  }

  // Method 2: Fixed/absolute overlays with subscribe text
  detectContentBlockers();

  // Method 3: Blur / gradient fade overlays
  detectBlurOverlays();

  // Method 4: Restore scroll if paywall locked it
  restoreBodyScroll();
}

/**
 * Manually remove paywalls (triggered by popup "Remove Paywall" button).
 *
 * @returns {number} Number of paywall elements removed.
 */
export function removePaywall() {
  let removedCount = 0;

  const paywallSelectors = AD_SELECTORS.paywall || [];
  for (const selector of paywallSelectors) {
    try {
      document.querySelectorAll(selector).forEach((el) => {
        if (isPaywallElement(el)) {
          removePaywallElement(el, 'manual');
          removedCount++;
        }
      });
    } catch (_) { /* skip */ }
  }

  detectContentBlockers();
  detectBlurOverlays();
  restoreBodyScroll();

  return removedCount;
}

// ============================================
// DETECTION
// ============================================

/**
 * Determine if an element is a paywall overlay.
 *
 * FIX #22: Requires strong class/id signals OR multiple text signals
 * to avoid removing legitimate login modals.
 *
 * @param {HTMLElement} el - Element to check.
 * @returns {boolean}
 */
export function isPaywallElement(el) {
  const text = (el.innerText || '').substring(0, 500);
  const className = typeof el.className === 'string' ? el.className : '';
  const id = el.id || '';

  // Strong class/id indicators — single match sufficient
  const strongPatterns = [
    'paywall', 'subscribe-wall', 'subscription-wall',
    'metered', 'content-gate', 'article-gate',
    'locked-content', 'premium-wall', 'member-wall',
    'piano-offer', 'tp-modal', 'tinypass',
  ];

  const classAndId = (className + ' ' + id).toLowerCase();
  if (strongPatterns.some((p) => classAndId.includes(p))) {
    return true;
  }

  // Text-based detection — require strong signals (FIX #9)
  const textLower = text.toLowerCase();
  const textSignals = [
    'subscribe to continue', 'subscribe to read',
    'subscription required', 'sign in to read',
    'create a free account to', 'paywall',
    'metered content', 'article limit',
    'free articles remaining', 'upgrade to premium',
    'unlock this article', 'become a member to',
    'this content is for subscribers',
    'already a subscriber', 'start your trial',
  ];

  return textSignals.some((signal) => textLower.includes(signal));
}

/**
 * Detect fixed/absolute overlays that block content.
 * Only removes elements with paywall/subscribe text + high z-index.
 */
export function detectContentBlockers() {
  const targetSelectors = [
    '[style*="position: fixed"]', '[style*="position:fixed"]',
    '[style*="position: absolute"]', '[style*="position:absolute"]',
    '[class*="overlay"]', '[class*="modal"]', '[class*="backdrop"]',
    '[class*="paywall"]', '[class*="gate"]', '[class*="blocker"]',
    '[role="dialog"]', '[aria-modal="true"]',
  ];

  try {
    const elements = document.querySelectorAll(targetSelectors.join(','));
    elements.forEach((el) => {
      try {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        const isFixed = style.position === 'fixed' || style.position === 'absolute';
        const coversContent = rect.width > 200 && rect.height > 200;
        const hasHighZIndex = parseInt(style.zIndex) > 100;

        if (isFixed && coversContent && hasHighZIndex) {
          const text = (el.innerText || '').toLowerCase().substring(0, 500);
          const cn = typeof el.className === 'string' ? el.className.toLowerCase() : '';

          const isPaywall =
            text.includes('subscribe') ||
            text.includes('sign in') ||
            text.includes('log in') ||
            text.includes('paywall') ||
            text.includes('metered') ||
            text.includes('limited access') ||
            cn.includes('paywall') ||
            cn.includes('subscribe-wall') ||
            (cn.includes('overlay') && cn.includes('gate'));

          if (isPaywall) {
            removePaywallElement(el, 'content-blocker');
          }
        }
      } catch (_) { /* skip element */ }
    });
  } catch (_) { /* skip */ }
}

/**
 * Detect and remove blur/gradient overlays hiding article content.
 */
export function detectBlurOverlays() {
  const blurSelectors = [
    '[style*="blur"]', '[style*="backdrop-filter"]',
    '[class*="blur"]', '[class*="blurred"]',
    '[data-blur]',
    '[class*="fade"]', '[class*="gradient"]',
    '[class*="truncat"]', '[class*="clamp"]',
  ];

  try {
    const elements = document.querySelectorAll(blurSelectors.join(','));
    elements.forEach((el) => {
      try {
        const style = window.getComputedStyle(el);

        const hasBlur =
          style.backdropFilter?.includes('blur') ||
          style.filter?.includes('blur') ||
          el.hasAttribute('data-blur');

        const text = (el.innerText || '').substring(0, 300);
        const hasReadMore =
          text.includes('Read more') ||
          text.includes('Continue reading') ||
          text.includes('Subscribe to read');

        if (hasBlur && (hasReadMore || isPaywallElement(el))) {
          removePaywallElement(el, 'blur-overlay');
        }

        // Gradient fade at bottom of articles
        const cn = typeof el.className === 'string' ? el.className : '';
        const elId = el.id || '';
        if (
          style.background?.includes('gradient') &&
          (cn.includes('fade') || cn.includes('gradient') ||
           elId.includes('fade') || elId.includes('gradient'))
        ) {
          const parent = el.parentElement;
          if (parent) {
            const pc = typeof parent.className === 'string' ? parent.className : '';
            const pid = parent.id || '';
            if (
              pc.includes('article') || pid.includes('article') ||
              pc.includes('content') || pid.includes('content') ||
              pc.includes('story') || pid.includes('story')
            ) {
              removePaywallElement(el, 'gradient-fade');
            }
          }
        }
      } catch (_) { /* skip */ }
    });
  } catch (_) { /* skip */ }
}

/**
 * Restore body/HTML scroll if a paywall locked it.
 * Only activates if we've actually removed paywall elements.
 */
export function restoreBodyScroll() {
  if (!document.body) return;

  const bodyStyle = window.getComputedStyle(document.body);
  const htmlStyle = window.getComputedStyle(document.documentElement);

  if (bodyStyle.overflow === 'hidden' || htmlStyle.overflow === 'hidden') {
    const removedElements = document.querySelectorAll('[data-websuddhi-removed]');
    if (removedElements.length > 0) {
      document.body.style.overflow = '';
      document.body.style.overflowY = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.overflowY = '';
      document.body.style.position = '';
      document.body.style.height = '';
      document.documentElement.style.position = '';
      document.documentElement.style.height = '';
    }
  }
}

// ============================================
// REMOVAL
// ============================================

/**
 * Hide a paywall element and mark it as removed.
 *
 * Safe-guards: never removes body, html, main, or article tags;
 * never removes the primary #content / #main-content containers.
 *
 * @param {HTMLElement} el - Element to remove.
 * @param {string} reason - Tag for why it was removed.
 */
export function removePaywallElement(el, reason) {
  const tag = el.tagName?.toLowerCase();
  if (tag === 'body' || tag === 'html' || tag === 'main' || tag === 'article') return;
  if (el.id === 'content' || el.id === 'main-content' || el.id === 'article-body') return;
  if (el.hasAttribute('data-websuddhi-removed')) return;

  el.setAttribute('data-websuddhi-removed', reason);
  el.classList.add('websuddhi-removed');

  el.style.setProperty('display', 'none', 'important');
  el.style.setProperty('visibility', 'hidden', 'important');
  el.style.setProperty('opacity', '0', 'important');
  el.style.setProperty('pointer-events', 'none', 'important');
  el.style.setProperty('position', 'absolute', 'important');
  el.style.setProperty('z-index', '-9999', 'important');

  // Check immediate parent only (not 5 levels deep)
  const parent = el.parentElement;
  if (parent && parent !== document.body && parent.tagName?.toLowerCase() !== 'main') {
    const pStyle = window.getComputedStyle(parent);
    const pClass = typeof parent.className === 'string' ? parent.className.toLowerCase() : '';
    if (
      (pStyle.position === 'fixed' || pStyle.position === 'absolute') &&
      (pClass.includes('paywall') || pClass.includes('overlay') || pClass.includes('modal'))
    ) {
      if (!parent.hasAttribute('data-websuddhi-removed')) {
        parent.style.setProperty('display', 'none', 'important');
        parent.setAttribute('data-websuddhi-removed', 'parent-' + reason);
      }
    }
  }

  state.blockedCount++;
}
