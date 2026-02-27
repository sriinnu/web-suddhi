/**
 * @module popup/dom
 * @description DOM element references and SVG icon path constants.
 * Centralises all `getElementById` calls so other modules can import `elements`.
 *
 * @version 2.1.0
 */
'use strict';

/**
 * SVG `d` path strings used by action buttons.
 * @readonly
 */
export const SVG_PATHS = {
  pick: 'M7 2l12 11.5-5.5 1.2 3.3 6.8-2.2 1-3.2-7L7 20V2z',
  cancel: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19z',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  check: 'M9 12l2 2 4-4',
  settings: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z',
};

/**
 * Cached DOM element references used across the popup.
 * @type {object}
 */
export const elements = {
  // --- Protection ---
  enableToggle: document.getElementById('enableToggle'),
  currentSite: document.getElementById('currentSite'),
  statusBadge: document.getElementById('statusBadge'),

  // --- Feature toggles ---
  paywallToggle: document.getElementById('paywallToggle'),
  socialBlockingToggle: document.getElementById('socialBlockingToggle'),
  networkBlockingToggle: document.getElementById('networkBlockingToggle'),
  urlCleaningToggle: document.getElementById('urlCleaningToggle'),
  cookieConsentToggle: document.getElementById('cookieConsentToggle'),
  annoyanceToggle: document.getElementById('annoyanceToggle'),

  // --- Stat counters ---
  networkBlockedCount: document.getElementById('networkBlockedCount'),
  cosmeticBlockedCount: document.getElementById('cosmeticBlockedCount'),
  rulesCount: document.getElementById('rulesCount'),
  dataSaved: document.getElementById('dataSaved'),

  // --- Action buttons ---
  removePaywallBtn: document.getElementById('removePaywallBtn'),
  pickModeBtn: document.getElementById('pickModeBtn'),
  zapModeBtn: document.getElementById('zapModeBtn'),
  openOptionsBtn: document.getElementById('openOptionsBtn'),
  reportIssue: document.getElementById('reportIssue'),
  whitelistBtn: document.getElementById('whitelistBtn'),
  blacklistBtn: document.getElementById('blacklistBtn'),
  whitelistToggleBtn: document.getElementById('whitelistToggleBtn'),

  // --- Tracker summary ---
  trackerSummary: document.getElementById('trackerSummary'),
  trackerCategories: document.getElementById('trackerCategories'),

  // --- Security ---
  siteInfoSection: document.getElementById('siteInfoSection'),
  siteIcon: document.getElementById('siteIcon'),
  siteMascot: document.getElementById('siteMascot'),
  securityBadge: document.getElementById('securityBadge'),
  securityText: document.getElementById('securityText'),
  certProtocol: document.getElementById('certProtocol'),
  certType: document.getElementById('certType'),
  certOwnerSection: document.getElementById('certOwnerSection'),
  certOwnerName: document.getElementById('certOwnerName'),
  certOwnerDetails: document.getElementById('certOwnerDetails'),

  // --- Frames ---
  framesSection: document.getElementById('framesSection'),
  framesCount: document.getElementById('framesCount'),
  framesList: document.getElementById('framesList'),

  // --- Blocked items panel ---
  networkStatBtn: document.getElementById('networkStatBtn'),
  cosmeticStatBtn: document.getElementById('cosmeticStatBtn'),
  blockedPanel: document.getElementById('blockedPanel'),
  blockedTitle: document.getElementById('blockedTitle'),
  blockedClose: document.getElementById('blockedClose'),
  blockedList: document.getElementById('blockedList'),
  viewAllBlocked: document.getElementById('viewAllBlocked'),
};

// ============================================
// DOM HELPERS
// ============================================

/**
 * Replace a button's children with an SVG icon and text label.
 * @param {HTMLButtonElement} btn
 * @param {string} svgPath - SVG `d` attribute path.
 * @param {string} text    - Label text.
 */
export function setButtonContent(btn, svgPath, text) {
  while (btn.firstChild) btn.removeChild(btn.firstChild);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', svgPath);
  svg.appendChild(path);

  btn.appendChild(svg);
  btn.appendChild(document.createTextNode(' ' + text));
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Escape text for safe insertion into HTML, including attribute contexts.
 *
 * FIX #1: The original returned `div.textContent` (unescaped).
 * Now returns `div.innerHTML` which is the browser-escaped version,
 * plus explicit quote escaping for safe use inside `title=""` and
 * `data-*=""` attributes (prevents attribute-breakout XSS).
 *
 * @param {string} text
 * @returns {string} HTML-safe string.
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Extract hostname from a URL string.
 * @param {string} url
 * @returns {string}
 */
export function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (_) {
    return url;
  }
}

/**
 * Format a byte count as a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatDataSize(bytes) {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

/**
 * Show a short-lived toast notification in the popup.
 * @param {string} message
 */
export function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}
