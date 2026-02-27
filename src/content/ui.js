/**
 * @module content/ui
 * @description Toast notifications and element preview UI.
 *
 * Provides lightweight UI overlays injected into the host page.
 * All user-facing text is sanitised with the shared escapeHtml helper
 * (FIX #1 / #2).
 *
 * @version 2.1.0
 */
'use strict';

import { state } from './state.js';
import { getUniqueSelector } from './selector-gen.js';

// ============================================
// TOAST NOTIFICATIONS
// ============================================

/**
 * Remove the current toast notification, if any.
 */
export function removeToast() {
  const toast = document.querySelector('.websuddhi-toast');
  if (toast) toast.remove();
}

/**
 * Show a temporary toast at the bottom of the viewport.
 * Auto-closes after the user-configured duration (default 3 s).
 *
 * @param {string} message - Plain-text message to display.
 */
export function showToast(message) {
  removeToast();

  const toast = document.createElement('div');
  toast.className = 'websuddhi-toast';
  toast.textContent = message; // textContent — safe by default
  toast.style.cssText =
    'position:fixed!important;bottom:20px!important;left:50%!important;' +
    'transform:translateX(-50%)!important;' +
    'background:linear-gradient(135deg,#0ea5e9,#0284c7)!important;' +
    'color:white!important;padding:12px 24px!important;border-radius:8px!important;' +
    'font-family:-apple-system,BlinkMacSystemFont,sans-serif!important;' +
    'font-size:14px!important;z-index:2147483647!important;' +
    'box-shadow:0 4px 16px rgba(0,0,0,0.3)!important;' +
    'animation:websuddhi-fade-in 0.3s ease!important;';

  document.body.appendChild(toast);

  ensureAnimationStyles();

  const duration = (state.toastDuration || 3) * 1000;
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'websuddhi-fade-out 0.3s ease';
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
    }
  }, duration);
}

// ============================================
// ELEMENT PREVIEW (Pick Mode tooltip)
// ============================================

/**
 * Show a small tooltip near a hovered element in Pick Mode.
 * Uses textContent / escapeHtml for safe rendering (FIX #1).
 *
 * @param {HTMLElement} element - The element to preview.
 */
export function showPreview(element) {
  let preview = document.querySelector('.websuddhi-pick-preview');
  if (!preview) {
    preview = document.createElement('div');
    preview.className = 'websuddhi-pick-preview';
    document.body.appendChild(preview);
  }

  const rect = element.getBoundingClientRect();
  const selector = getUniqueSelector(element);
  const tagName = element.tagName.toLowerCase();
  const dims = Math.round(rect.width) + 'x' + Math.round(rect.height);

  // Build preview using safe DOM methods instead of innerHTML (FIX #1)
  preview.textContent = '';

  const infoDiv = document.createElement('div');
  infoDiv.className = 'websuddhi-pick-info';

  const clickLabel = document.createElement('span');
  clickLabel.textContent = 'Click to block';
  infoDiv.appendChild(clickLabel);

  const codeEl = document.createElement('code');
  const truncated = selector.length > 80
    ? selector.substring(0, 80) + '...'
    : selector;
  codeEl.textContent = truncated;
  infoDiv.appendChild(codeEl);

  const hintSpan = document.createElement('span');
  hintSpan.className = 'websuddhi-pick-hint';
  hintSpan.textContent = '<' + tagName + '> ' + dims + ' | Esc to cancel';
  infoDiv.appendChild(hintSpan);

  preview.appendChild(infoDiv);

  // Position
  const padding = 10;
  let top = rect.bottom + padding;
  let left = rect.left;
  if (left + 300 > window.innerWidth) left = window.innerWidth - 320;
  if (left < 10) left = 10;
  if (top + 100 > window.innerHeight) top = rect.top - 110;
  if (top < 0) top = 10;

  preview.style.cssText =
    'position:fixed!important;z-index:2147483647!important;' +
    'top:' + top + 'px!important;left:' + left + 'px!important;';
}

// ============================================
// HIGHLIGHTS
// ============================================

/**
 * Remove all pick/zap highlight outlines.
 */
export function clearHighlights() {
  document.querySelectorAll('.websuddhi-pick-highlight').forEach((el) => {
    el.classList.remove('websuddhi-pick-highlight');
  });
}

// ============================================
// INTERNAL HELPERS
// ============================================

/**
 * Inject keyframe animations for toast if not already present.
 * @private
 */
function ensureAnimationStyles() {
  if (document.querySelector('#websuddhi-styles')) return;

  const style = document.createElement('style');
  style.id = 'websuddhi-styles';
  style.textContent =
    '@keyframes websuddhi-fade-in{from{opacity:0;transform:translate(-50%,20px)}' +
    'to{opacity:1;transform:translate(-50%,0)}}' +
    '@keyframes websuddhi-fade-out{from{opacity:1}to{opacity:0}}';
  document.head.appendChild(style);
}
