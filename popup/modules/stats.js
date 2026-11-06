// WebSuddhi popup: Blocked-item lists and toasts.
// Classic script; the popup scripts share one global scope (see popup.html for the order).
'use strict';
/* global elements, escapeHtml, extractDomain, extractRequestLog, sendToBackground,
   sendToBackgroundWithFallback */
/* exported hideBlockedPanel, showCosmeticStats, showNetworkStats, showToast */

// ============================================
// STATS & BLOCKED ITEMS
// ============================================
let showingNetworkStats = false;
let showingCosmeticStats = false;

async function showNetworkStats() {
  if (!elements.blockedPanel || !elements.blockedList || !elements.blockedTitle) return;

  showingNetworkStats = true;
  showingCosmeticStats = false;
  elements.blockedTitle.textContent = 'Network Requests';

  try {
    const response = await sendToBackgroundWithFallback(['GET_REQUEST_LOG', 'REQUEST_LOG']);
    const requestLog = extractRequestLog(response).filter(entry => entry?.type === 'network');

    if (requestLog.length > 0) {
      renderBlockedItems(requestLog, 'network');
    } else {
      elements.blockedList.innerHTML = '<div class="blocked-empty">No network requests blocked yet</div>'; // omit-allow: static markup, no interpolation
    }

    elements.blockedPanel.style.display = 'block';
  } catch (e) {
    elements.blockedList.innerHTML = '<div class="blocked-empty">Error loading stats</div>'; // omit-allow: static markup, no interpolation
    elements.blockedPanel.style.display = 'block';
  }
}

async function showCosmeticStats() {
  if (!elements.blockedPanel || !elements.blockedList || !elements.blockedTitle) return;

  showingCosmeticStats = true;
  showingNetworkStats = false;
  elements.blockedTitle.textContent = 'Blocked Elements';

  try {
    const response = await sendToBackground({ type: 'GET_SELECTORS' });

    if (response && response.success && response.selectors && response.selectors.length > 0) {
      renderBlockedItems(response.selectors, 'cosmetic');
    } else {
      elements.blockedList.innerHTML = '<div class="blocked-empty">No elements blocked yet</div>'; // omit-allow: static markup, no interpolation
    }

    elements.blockedPanel.style.display = 'block';
  } catch (e) {
    elements.blockedList.innerHTML = '<div class="blocked-empty">Error loading stats</div>'; // omit-allow: static markup, no interpolation
    elements.blockedPanel.style.display = 'block';
  }
}

function hideBlockedPanel() {
  if (elements.blockedPanel) {
    elements.blockedPanel.style.display = 'none';
    showingNetworkStats = false;
    showingCosmeticStats = false;
  }
}

async function renderBlockedItems(items, type) {
  if (!elements.blockedList) return;

  const html = items.slice(-20).reverse().map(item => {
    if (type === 'network') {
      const url = item.url || 'Unknown';
      const shortUrl = url.length > 50 ? url.substring(0, 50) + '...' : url;
      const site = item.site || 'Unknown';
      const domain = extractDomain(site);
      const category = item.category || 'Unknown';
      const severity = item.severity || 'low';

      return `
        <div class="blocked-item" title="${escapeHtml(url)}">
          <div class="blocked-item-info">
            <div class="blocked-item-url">${escapeHtml(shortUrl)}</div>
            <div class="blocked-item-type ${escapeHtml(type)}">${escapeHtml(domain)} • ${escapeHtml(category)}</div>
          </div>
          <button class="blocked-unblock" data-url="${escapeHtml(url)}">Unblock</button>
        </div>
      `;
    } else {
      const selector = item.selector || 'Unknown';
      const site = item.hostname || 'Unknown';
      const date = item.date ? new Date(item.date).toLocaleDateString() : '';

      return `
        <div class="blocked-item" title="${escapeHtml(selector)}">
          <div class="blocked-item-info">
            <div class="blocked-item-url">${escapeHtml(selector.length > 40 ? selector.substring(0, 40) + '...' : selector)}</div>
            <div class="blocked-item-type ${escapeHtml(type)}">${escapeHtml(site)} ${date ? '• ' + date : ''}</div>
          </div>
          <button class="blocked-unblock" data-selector="${escapeHtml(selector)}">Unblock</button>
        </div>
      `;
    }
  }).join('');

  elements.blockedList.innerHTML = html; // omit-allow: every interpolated value goes through escapeHtml

  // Add event listeners to unblock buttons
  elements.blockedList.querySelectorAll('.blocked-unblock').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const url = btn.dataset.url;
      const selector = btn.dataset.selector;

      if (url) {
        await unblockRequest(url);
      } else if (selector) {
        await unblockSelector(selector);
      }
    });
  });
}

async function unblockRequest(url) {
  try {
    await sendToBackground({ type: 'UNBLOCK_REQUEST', url });
    showToast('Request unblocked');

    // Refresh the list
    if (showingNetworkStats) {
      showNetworkStats();
    }
  } catch (e) {
    showToast('Failed to unblock');
  }
}

async function unblockSelector(selector) {
  try {
    await sendToBackground({ type: 'REMOVE_SELECTOR', selector });
    showToast('Element unblocked');

    // Refresh the list
    if (showingCosmeticStats) {
      showCosmeticStats();
    }
  } catch (e) {
    showToast('Failed to unblock');
  }
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}
