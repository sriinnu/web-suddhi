/**
 * @module popup/stats
 * @description Stats panel, blocked-items list, tracker-category summary,
 * and unblock actions for the popup UI.
 *
 * @version 2.1.0
 */
'use strict';

import { elements, escapeHtml, extractDomain, showToast } from './dom.js';
import {
  sendToBackground, sendToBackgroundWithFallback, extractRequestLog,
} from './api.js';

// ============================================
// STATE
// ============================================

let showingNetworkStats  = false;
let showingCosmeticStats = false;

// ============================================
// NETWORK STATS PANEL
// ============================================

/**
 * Open the blocked-items panel showing network request log entries.
 */
export async function showNetworkStats() {
  if (!elements.blockedPanel || !elements.blockedList || !elements.blockedTitle) return;

  showingNetworkStats  = true;
  showingCosmeticStats = false;
  elements.blockedTitle.textContent = 'Network Requests';

  try {
    const response   = await sendToBackgroundWithFallback(['GET_REQUEST_LOG', 'REQUEST_LOG']);
    const requestLog = extractRequestLog(response).filter((e) => e?.type === 'network');

    if (requestLog.length > 0) {
      renderBlockedItems(requestLog, 'network');
    } else {
      elements.blockedList.innerHTML = '<div class="blocked-empty">No network requests blocked yet</div>';
    }
    elements.blockedPanel.style.display = 'block';
  } catch (_) {
    elements.blockedList.innerHTML = '<div class="blocked-empty">Error loading stats</div>';
    elements.blockedPanel.style.display = 'block';
  }
}

// ============================================
// COSMETIC STATS PANEL
// ============================================

/**
 * Open the blocked-items panel showing cosmetic (element) selectors.
 */
export async function showCosmeticStats() {
  if (!elements.blockedPanel || !elements.blockedList || !elements.blockedTitle) return;

  showingCosmeticStats = true;
  showingNetworkStats  = false;
  elements.blockedTitle.textContent = 'Blocked Elements';

  try {
    const response = await sendToBackground({ type: 'GET_SELECTORS' });

    if (response?.success && response.selectors?.length > 0) {
      renderBlockedItems(response.selectors, 'cosmetic');
    } else {
      elements.blockedList.innerHTML = '<div class="blocked-empty">No elements blocked yet</div>';
    }
    elements.blockedPanel.style.display = 'block';
  } catch (_) {
    elements.blockedList.innerHTML = '<div class="blocked-empty">Error loading stats</div>';
    elements.blockedPanel.style.display = 'block';
  }
}

/**
 * Close the blocked-items panel.
 */
export function hideBlockedPanel() {
  if (elements.blockedPanel) {
    elements.blockedPanel.style.display = 'none';
    showingNetworkStats  = false;
    showingCosmeticStats = false;
  }
}

// ============================================
// RENDERING
// ============================================

/**
 * Render the most recent blocked items into the panel list.
 * Uses DOM-safe `escapeHtml` for any user-generated text (FIX #1).
 *
 * @param {Array} items
 * @param {'network'|'cosmetic'} type
 */
function renderBlockedItems(items, type) {
  if (!elements.blockedList) return;

  // Build HTML for last 20 items (newest first)
  const html = items.slice(-20).reverse().map((item) => {
    if (type === 'network') {
      const url      = item.url || 'Unknown';
      const shortUrl = url.length > 50 ? url.substring(0, 50) + '...' : url;
      const domain   = extractDomain(item.site || 'Unknown');
      const category = item.category || 'Unknown';

      return `
        <div class="blocked-item" title="${escapeHtml(url)}">
          <div class="blocked-item-info">
            <div class="blocked-item-url">${escapeHtml(shortUrl)}</div>
            <div class="blocked-item-type ${type}">${escapeHtml(domain)} &bull; ${escapeHtml(category)}</div>
          </div>
          <button class="blocked-unblock" data-url="${escapeHtml(url)}">Unblock</button>
        </div>`;
    }

    // Cosmetic
    const selector = item.selector || 'Unknown';
    const site     = item.hostname || 'Unknown';
    const date     = item.date ? new Date(item.date).toLocaleDateString() : '';

    return `
      <div class="blocked-item" title="${escapeHtml(selector)}">
        <div class="blocked-item-info">
          <div class="blocked-item-url">${escapeHtml(selector.length > 40 ? selector.substring(0, 40) + '...' : selector)}</div>
          <div class="blocked-item-type ${type}">${escapeHtml(site)}${date ? ' &bull; ' + date : ''}</div>
        </div>
        <button class="blocked-unblock" data-selector="${escapeHtml(selector)}">Unblock</button>
      </div>`;
  }).join('');

  elements.blockedList.innerHTML = html;

  // Attach unblock handlers
  elements.blockedList.querySelectorAll('.blocked-unblock').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (btn.dataset.url) await unblockRequest(btn.dataset.url);
      else if (btn.dataset.selector) await unblockSelector(btn.dataset.selector);
    });
  });
}

// ============================================
// UNBLOCK ACTIONS
// ============================================

/**
 * Unblock a previously blocked network request.
 * @param {string} url
 */
async function unblockRequest(url) {
  try {
    await sendToBackground({ type: 'UNBLOCK_REQUEST', url });
    showToast('Request unblocked');
    if (showingNetworkStats) showNetworkStats();
  } catch (_) {
    showToast('Failed to unblock');
  }
}

/**
 * Unblock a previously blocked element selector.
 * @param {string} selector
 */
async function unblockSelector(selector) {
  try {
    await sendToBackground({ type: 'REMOVE_SELECTOR', selector });
    showToast('Element unblocked');
    if (showingCosmeticStats) showCosmeticStats();
  } catch (_) {
    showToast('Failed to unblock');
  }
}

// ============================================
// TRACKER SUMMARY
// ============================================

/**
 * Load tracker category breakdown from the request log and render badges.
 */
export async function loadTrackerSummary() {
  if (!elements.trackerSummary || !elements.trackerCategories) return;

  try {
    const response   = await sendToBackgroundWithFallback(['GET_REQUEST_LOG', 'REQUEST_LOG']);
    const requestLog = extractRequestLog(response);

    if (requestLog.length === 0) {
      elements.trackerSummary.style.display = 'none';
      return;
    }

    const counts   = {};
    const severity = {};
    for (const entry of requestLog) {
      if (entry.type === 'network' && entry.category && entry.category !== 'Unknown') {
        counts[entry.category]   = (counts[entry.category] || 0) + 1;
        severity[entry.category] = entry.severity || 'low';
      }
    }

    const entries = Object.entries(counts);
    if (entries.length === 0) {
      elements.trackerSummary.style.display = 'none';
      return;
    }

    entries.sort((a, b) => b[1] - a[1]);

    // Clear existing badges
    while (elements.trackerCategories.firstChild) {
      elements.trackerCategories.removeChild(elements.trackerCategories.firstChild);
    }

    // Render top 5
    for (const [category, count] of entries.slice(0, 5)) {
      const badge = document.createElement('span');
      badge.className = 'tracker-badge ' + (severity[category] || 'low');

      const countSpan = document.createElement('span');
      countSpan.className = 'tracker-count';
      countSpan.textContent = count;
      badge.appendChild(countSpan);
      badge.appendChild(document.createTextNode(' ' + category));

      elements.trackerCategories.appendChild(badge);
    }

    elements.trackerSummary.style.display = 'block';
  } catch (_) {
    elements.trackerSummary.style.display = 'none';
  }
}
