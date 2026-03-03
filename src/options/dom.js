/**
 * @module options/dom
 * @description DOM element references, formatters, and toast system
 * for the options page.
 *
 * FIX #1: escapeHtml returns `div.innerHTML` (HTML-safe).
 * FIX #25: CSS --accent-color variable issue documented / mitigated.
 *
 * @version 2.1.0
 */
'use strict';

// ============================================
// ELEMENT REFERENCES
// ============================================

/** Cached DOM references used throughout the options page. */
export const elements = {
  // --- Settings toggles ---
  enableProtection: document.getElementById('enableProtection'),
  enablePaywall: document.getElementById('enablePaywall'),
  enableNetworkBlocking: document.getElementById('enableNetworkBlocking'),
  enableUrlCleaning: document.getElementById('enableUrlCleaning'),
  enableCookieConsent: document.getElementById('enableCookieConsent'),
  enableAnnoyanceBlocking: document.getElementById('enableAnnoyanceBlocking'),
  enablePingProtection: document.getElementById('enablePingProtection'),
  enableReferrerStripping: document.getElementById('enableReferrerStripping'),
  enableWebRTCProtection: document.getElementById('enableWebRTCProtection'),
  enablePhishingProtection: document.getElementById('enablePhishingProtection'),
  enableTelemetryBlocking: document.getElementById('enableTelemetryBlocking'),
  enableThirdPartyCookieBlocking: document.getElementById('enableThirdPartyCookieBlocking'),
  enableSync: document.getElementById('enableSync'),
  languageFilters: document.getElementById('languageFilters'),

  // --- Rules ---
  rulesList: document.getElementById('rulesList'),
  rulesCount: document.getElementById('rulesCount'),
  navRulesCount: document.getElementById('navRulesCount'),
  emptyState: document.getElementById('emptyState'),
  siteInput: document.getElementById('siteInput'),
  addSiteBtn: document.getElementById('addSiteBtn'),
  whitelistList: document.getElementById('whitelistList'),

  // --- Stats ---
  networkBlocked: document.getElementById('networkBlocked'),
  cosmeticBlocked: document.getElementById('cosmeticBlocked'),
  totalBlocked: document.getElementById('totalBlocked'),
  dataSavedTotal: document.getElementById('dataSavedTotal'),
  topDomainsChart: document.getElementById('topDomainsChart'),
  topSitesChart: document.getElementById('topSitesChart'),
  categoryChart: document.getElementById('categoryChart'),
  trendChart: document.getElementById('trendChart'),
  resetStatsBtn: document.getElementById('resetStatsBtn'),

  // --- Import / Export ---
  themeToggle: document.getElementById('themeToggle'),
  exportBtn: document.getElementById('exportBtn'),
  importBtn: document.getElementById('importBtn'),
  importFile: document.getElementById('importFile'),
  importExportStatus: document.getElementById('importExportStatus'),

  // --- Filter lists ---
  filterListItems: document.getElementById('filterListItems'),
  subscriptionNameInput: document.getElementById('subscriptionNameInput'),
  subscriptionUrlInput: document.getElementById('subscriptionUrlInput'),
  addSubscriptionBtn: document.getElementById('addSubscriptionBtn'),
  updateAllFiltersBtn: document.getElementById('updateAllFiltersBtn'),

  // --- About ---
  rateExtension: document.getElementById('rateExtension'),
  viewSource: document.getElementById('viewSource'),

  // --- Request log ---
  requestLog: document.getElementById('requestLog'),
  logCount: document.getElementById('logCount'),
  clearLogBtn: document.getElementById('clearLogBtn'),
  enableLogging: document.getElementById('enableLogging'),

  // --- Toast ---
  toastDuration: document.getElementById('toastDuration'),
  toastDurationValue: document.getElementById('toastDurationValue'),
  toastContainer: document.getElementById('toastContainer'),
};

// ============================================
// DOM HELPERS
// ============================================

/**
 * Remove all children from an element.
 * @param {Element|null} el
 */
export function clearElement(el) {
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
}

/**
 * Escape text for safe HTML insertion.
 *
 * FIX #1: Returns `div.innerHTML` (the browser-escaped form).
 *
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================
// FORMATTERS
// ============================================

/**
 * Format a number with K/M suffix.
 * @param {number} num
 * @returns {string}
 */
export function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000)    return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

/**
 * Format bytes as a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatDataSize(bytes) {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576)    return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024)       return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

/**
 * Format milliseconds as a human-readable duration.
 * @param {number} ms
 * @returns {string}
 */
export function formatTimeSaved(ms) {
  if (ms >= 3600000) return (ms / 3600000).toFixed(1) + 'h';
  if (ms >= 60000)   return (ms / 60000).toFixed(1) + 'm';
  if (ms >= 1000)    return (ms / 1000).toFixed(1) + 's';
  return ms + 'ms';
}

/**
 * Return a human-readable relative-time string.
 * @param {number} timestamp
 * @returns {string}
 */
export function getRelativeTime(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  if (diff < 1000)     return 'just now';
  if (diff < 60000)    return Math.floor(diff / 1000) + 's ago';
  if (diff < 3600000)  return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return new Date(timestamp).toLocaleDateString();
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

/**
 * Show a toast notification in the options page.
 * @param {string} message
 * @param {'info'|'success'|'error'} [type='info']
 * @param {string} [title='']
 */
export function showToast(message, type = 'info', title = '') {
  if (!elements.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = 'toast';

  // Icon
  const iconDiv = document.createElement('div');
  iconDiv.className = 'toast-icon ' + type;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('fill', 'currentColor');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  const iconPaths = {
    success: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
    error: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
    info: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
  };
  path.setAttribute('d', iconPaths[type] || iconPaths.info);
  svg.appendChild(path);
  iconDiv.appendChild(svg);
  toast.appendChild(iconDiv);

  // Content
  const contentDiv = document.createElement('div');
  contentDiv.className = 'toast-content';
  if (title) {
    const titleDiv = document.createElement('div');
    titleDiv.className = 'toast-title';
    titleDiv.textContent = title;
    contentDiv.appendChild(titleDiv);
  }
  const msgDiv = document.createElement('div');
  msgDiv.className = title ? 'toast-message' : 'toast-title';
  msgDiv.textContent = message;
  contentDiv.appendChild(msgDiv);
  toast.appendChild(contentDiv);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.textContent = '\u00D7';
  closeBtn.addEventListener('click', () => removeToast(toast));
  toast.appendChild(closeBtn);

  elements.toastContainer.appendChild(toast);
  setTimeout(() => removeToast(toast), 4000);
}

/**
 * Fade-out and remove a toast element.
 * @param {HTMLElement} toast
 */
function removeToast(toast) {
  if (!toast?.parentElement) return;
  toast.classList.add('toast-out');
  setTimeout(() => toast.remove(), 200);
}

/**
 * Show a status message in the import/export area AND as a toast.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
export function showStatus(message, type) {
  if (elements.importExportStatus) {
    elements.importExportStatus.textContent = message;
    elements.importExportStatus.className = 'status-message ' + type;
    setTimeout(() => {
      elements.importExportStatus.textContent = '';
      elements.importExportStatus.className = 'status-message';
    }, 4000);
  }
  showToast(message, type);
}
