/**
 * @module content/iframe-detector
 * @description Third-party iframe detection and management.
 *
 * Scans for iframes and embeds from third-party domains,
 * reports them to the background/popup, and allows the user
 * to selectively unblock specific frames.
 *
 * @version 2.1.0
 */
'use strict';

import { sendMessage } from './messaging.js';

// ============================================
// DETECTION
// ============================================

/**
 * Scan the page for third-party iframes and embed/object elements.
 *
 * @returns {Array<{host: string, src: string, blocked: boolean, type: string}>}
 *   De-duplicated list of third-party frames.
 */
export function detectThirdPartyFrames() {
  const currentHost = window.location.hostname.replace(/^www\./, '');
  const frames = [];

  // Iframes
  document.querySelectorAll('iframe').forEach((iframe) => {
    try {
      const src = iframe.src || iframe.getAttribute('data-src') || '';
      if (!src || src.startsWith('about:') || /^\s*javascript\s*:/i.test(src)) return;

      const url = new URL(src, window.location.href);
      const frameHost = url.hostname.replace(/^www\./, '');

      if (
        frameHost &&
        frameHost !== currentHost &&
        !currentHost.endsWith('.' + frameHost) &&
        !frameHost.endsWith('.' + currentHost)
      ) {
        const isBlocked =
          iframe.style.display === 'none' ||
          iframe.hasAttribute('data-websuddhi-blocked') ||
          !iframe.offsetParent;

        frames.push({ host: frameHost, src, blocked: isBlocked, type: 'iframe' });
      }
    } catch (_) { /* invalid URL */ }
  });

  // Object / Embed elements
  document.querySelectorAll('object[data], embed[src]').forEach((el) => {
    try {
      const src = el.getAttribute('data') || el.getAttribute('src') || '';
      if (!src) return;

      const url = new URL(src, window.location.href);
      const embedHost = url.hostname.replace(/^www\./, '');

      if (embedHost && embedHost !== currentHost) {
        frames.push({ host: embedHost, src, blocked: false, type: 'embed' });
      }
    } catch (_) { /* skip */ }
  });

  // De-duplicate by host
  const seen = new Set();
  return frames.filter((f) => {
    if (seen.has(f.host)) return false;
    seen.add(f.host);
    return true;
  });
}

// ============================================
// UNBLOCK
// ============================================

/**
 * Restore a previously blocked iframe by host.
 *
 * @param {string} frameHost - Hostname to unblock.
 */
export function unblockFrame(frameHost) {
  document.querySelectorAll('iframe').forEach((iframe) => {
    try {
      const src = iframe.src || iframe.getAttribute('data-src') || '';
      if (!src) return;

      const url = new URL(src, window.location.href);
      const host = url.hostname.replace(/^www\./, '');

      if (host === frameHost) {
        iframe.style.display = '';
        iframe.removeAttribute('data-websuddhi-blocked');

        if (!iframe.src && iframe.getAttribute('data-websuddhi-src')) {
          iframe.src = iframe.getAttribute('data-websuddhi-src');
        }
      }
    } catch (_) { /* skip */ }
  });
}

// ============================================
// REPORTING
// ============================================

/**
 * Report detected third-party frames to the background / popup.
 */
export function reportFramesToBackground() {
  const frames = detectThirdPartyFrames();
  if (frames.length === 0) return;

  sendMessage({ type: 'FRAMES_DETECTED', frames }).catch(() => {});

  for (const frame of frames) {
    sendMessage({
      type: 'REPORT_FRAME',
      frameHost: frame.host,
      frameUrl: frame.src,
      blocked: frame.blocked,
    }).catch(() => {});
  }
}
