// WebSuddhi - Popup Script
// Universal: Chrome, Edge, Firefox, Safari

(function() {
  'use strict';

  // Logging helpers
  const logError = (...args) => {
    if (self.WebSuddhi && self.WebSuddhi.utils && self.WebSuddhi.utils.error) {
      self.WebSuddhi.utils.error(...args);
    } else {
      console.error('[WebSuddhi]', ...args);
    }
  };

  // DOM helpers
  const setButtonContent = (btn, svgPath, text) => {
    while (btn.firstChild) btn.removeChild(btn.firstChild);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('fill', 'currentColor');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', svgPath);
    svg.appendChild(path);
    btn.appendChild(svg);
    btn.appendChild(document.createTextNode(' ' + text));
  };

  const SVG_PATHS = {
    pick: 'M7 2l12 11.5-5.5 1.2 3.3 6.8-2.2 1-3.2-7L7 20V2z',
    cancel: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z'
  };

  const elements = {
    enableToggle: document.getElementById('enableToggle'),
    whitelistToggle: document.getElementById('whitelistToggle'),
    currentSite: document.getElementById('currentSite'),
    paywallToggle: document.getElementById('paywallToggle'),
    jsToggle: document.getElementById('jsToggle'),
    jsHint: document.getElementById('jsHint'),
    networkBlockedCount: document.getElementById('networkBlockedCount'),
    cosmeticBlockedCount: document.getElementById('cosmeticBlockedCount'),
    rulesCount: document.getElementById('rulesCount'),
    dataSaved: document.getElementById('dataSaved'),
    networkBlockingToggle: document.getElementById('networkBlockingToggle'),
    urlCleaningToggle: document.getElementById('urlCleaningToggle'),
    cookieConsentToggle: document.getElementById('cookieConsentToggle'),
    annoyanceToggle: document.getElementById('annoyanceToggle'),
    removePaywallBtn: document.getElementById('removePaywallBtn'),
    pickModeBtn: document.getElementById('pickModeBtn'),
    zapModeBtn: document.getElementById('zapModeBtn'),
    openOptionsBtn: document.getElementById('openOptionsBtn'),
    reportIssue: document.getElementById('reportIssue'),
    trackerSummary: document.getElementById('trackerSummary'),
    trackerCategories: document.getElementById('trackerCategories'),
    // Security info elements
    siteInfoSection: document.getElementById('siteInfoSection'),
    siteIcon: document.getElementById('siteIcon'),
    siteMascot: document.getElementById('siteMascot'),
    securityBadge: document.getElementById('securityBadge'),
    securityText: document.getElementById('securityText'),
    certProtocol: document.getElementById('certProtocol'),
    certType: document.getElementById('certType'),
    // Certificate owner elements
    certOwnerSection: document.getElementById('certOwnerSection'),
    certOwnerName: document.getElementById('certOwnerName'),
    certOwnerDetails: document.getElementById('certOwnerDetails'),
    // Frames elements
    framesSection: document.getElementById('framesSection'),
    framesCount: document.getElementById('framesCount'),
    framesList: document.getElementById('framesList'),
    // Blocked panel elements
    networkStatBtn: document.getElementById('networkStatBtn'),
    cosmeticStatBtn: document.getElementById('cosmeticStatBtn'),
    blockedPanel: document.getElementById('blockedPanel'),
    blockedTitle: document.getElementById('blockedTitle'),
    blockedClose: document.getElementById('blockedClose'),
    blockedList: document.getElementById('blockedList'),
    viewAllBlocked: document.getElementById('viewAllBlocked')
  };

  // Cross-browser API
  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

  let currentTab = null;
  let isPickMode = false;
  let isZapMode = false;

  // ============================================
  // CROSS-BROWSER API
  // ============================================
  function getStorage(keys) {
    return new Promise((resolve, reject) => {
      if (api.storage) {
        const result = api.storage.local.get(keys);
        if (result && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
        } else {
          api.storage.local.get(keys, (data) => {
            if (api.runtime.lastError) reject(api.runtime.lastError);
            else resolve(data);
          });
        }
        return;
      }
      reject(new Error('No storage API'));
    });
  }

  function setStorage(data) {
    return new Promise((resolve, reject) => {
      if (api.storage) {
        const result = api.storage.local.set(data);
        if (result && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
        } else {
          api.storage.local.set(data, () => {
            if (api.runtime.lastError) reject(api.runtime.lastError);
            else resolve();
          });
        }
        return;
      }
      reject(new Error('No storage API'));
    });
  }

  function sendToBackground(message) {
    return new Promise((resolve, reject) => {
      const result = api.runtime.sendMessage(message);
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(reject);
      } else {
        api.runtime.sendMessage(message, (response) => {
          if (api.runtime.lastError) reject(api.runtime.lastError);
          else resolve(response);
        });
      }
    });
  }

  function sendToContentScript(message) {
    return new Promise((resolve, reject) => {
      if (!currentTab || !currentTab.id) {
        reject(new Error('No active tab'));
        return;
      }
      if (api.tabs) {
        const result = api.tabs.sendMessage(currentTab.id, message);
        if (result && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
        } else {
          api.tabs.sendMessage(currentTab.id, message, (response) => {
            if (api.runtime.lastError) reject(api.runtime.lastError);
            else resolve(response);
          });
        }
        return;
      }
      reject(new Error('No tabs API'));
    });
  }

  function getCurrentTab() {
    return new Promise((resolve, reject) => {
      if (api.tabs) {
        const result = api.tabs.query({ active: true, currentWindow: true });
        if (result && typeof result.then === 'function') {
          result.then(tabs => resolve(tabs[0] || null)).catch(reject);
        } else {
          api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            resolve(tabs[0] || null);
          });
        }
        return;
      }
      reject(new Error('No tabs API'));
    });
  }

  function openOptionsPage(hash) {
    const url = 'options/options.html' + (hash || '');
    if (api.tabs) {
      api.tabs.create({ url });
    } else if (api.runtime && api.runtime.openOptionsPage) {
      api.runtime.openOptionsPage();
    }
  }

  // ============================================
  // INITIALIZATION
  // ============================================
  async function init() {
    try {
      currentTab = await getCurrentTab();

      const storage = await getStorage([
        'enabled', 'paywallEnabled', 'blockedSelectors', 'whitelistedSites',
        'networkBlockingEnabled', 'urlCleaningEnabled', 'cookieConsentEnabled', 'annoyanceBlockingEnabled'
      ]);
      const enabled = storage.enabled !== false;
      const paywallEnabled = storage.paywallEnabled !== false;
      const rulesCount = storage.blockedSelectors?.length || 0;
      const whitelistedSites = storage.whitelistedSites || [];

      elements.enableToggle.checked = enabled;
      elements.paywallToggle.checked = paywallEnabled;
      elements.rulesCount.textContent = rulesCount;

      // Set feature toggles
      elements.networkBlockingToggle.checked = storage.networkBlockingEnabled !== false;
      elements.urlCleaningToggle.checked = storage.urlCleaningEnabled !== false;
      elements.cookieConsentToggle.checked = storage.cookieConsentEnabled !== false;
      elements.annoyanceToggle.checked = storage.annoyanceBlockingEnabled !== false;

      // Set current site and check whitelist status
      if (currentTab && currentTab.url) {
        try {
          const url = new URL(currentTab.url);
          const hostname = url.hostname.replace(/^www\./, '');
          elements.currentSite.textContent = hostname;

          // Update security info based on protocol
          updateSecurityInfo(url);

          const isWhitelisted = whitelistedSites.some(site => {
            const normalized = site.replace(/^www\./, '');
            return hostname === normalized || hostname.endsWith('.' + normalized);
          });
          elements.whitelistToggle.checked = isWhitelisted;

          // Check JS status
          try {
            const jsStatus = await sendToBackground({ type: 'GET_JS_STATUS', url: currentTab.url });
            if (jsStatus && jsStatus.success) {
              elements.jsToggle.checked = (jsStatus.setting === 'block');
              if (jsStatus.setting === 'block') {
                elements.jsHint.textContent = 'Reload page to apply';
              }
            }
          } catch (e) {
            elements.jsToggle.checked = false;
          }
        } catch (e) {
          elements.currentSite.textContent = 'Unknown site';
          updateSecurityInfo(null);
        }
      } else {
        elements.currentSite.textContent = 'N/A';
        updateSecurityInfo(null);
      }

      // Get blocked counts
      if (currentTab && currentTab.id) {
        // Network blocked count from background
        try {
          const netResponse = await sendToBackground({ type: 'GET_NETWORK_BLOCKED_COUNT', tabId: currentTab.id });
          if (netResponse && netResponse.success) {
            animateStatUpdate(elements.networkBlockedCount, String(netResponse.count || 0));
          }
        } catch (err) {
          animateStatUpdate(elements.networkBlockedCount, '0');
        }

        // Cosmetic blocked count from content script
        try {
          const response = await sendToContentScript({ type: 'GET_STATUS' });
          if (response && response.success) {
            animateStatUpdate(elements.cosmeticBlockedCount, String(response.blockedCount || 0));
          }
        } catch (err) {
          animateStatUpdate(elements.cosmeticBlockedCount, '0');
        }
      }

      // Load performance stats (data saved)
      try {
        const perfResponse = await sendToBackground({ type: 'GET_PERFORMANCE_STATS' });
        if (perfResponse && perfResponse.success && perfResponse.performanceStats) {
          if (elements.dataSaved) {
            animateStatUpdate(elements.dataSaved, formatDataSize(perfResponse.performanceStats.estimatedDataSaved || 0));
          }
        }
      } catch (err) {
        if (elements.dataSaved) animateStatUpdate(elements.dataSaved, '0 MB');
      }

      // Load tracker category breakdown
      await loadTrackerSummary();

      // Load certificate and frame info
      await loadSecurityDetails();

      setupEventListeners();

      // Initialize micro-interactions
      ensureRippleStyles();
      [elements.removePaywallBtn, elements.pickModeBtn, elements.zapModeBtn, elements.openOptionsBtn].forEach(addRippleEffect);

    } catch (err) {
      logError('Popup init error:', err);
    }
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================
  function setupEventListeners() {
    // Toggle protection
    elements.enableToggle.addEventListener('change', async () => {
      const enabled = elements.enableToggle.checked;
      await setStorage({ enabled });

      try {
        await sendToContentScript({ type: 'TOGGLE', enabled });
      } catch (err) {}
    });

    // Toggle site whitelist
    elements.whitelistToggle.addEventListener('change', async () => {
      const whitelist = elements.whitelistToggle.checked;
      const hostname = elements.currentSite.textContent;

      if (hostname && hostname !== 'loading...' && hostname !== 'Unknown site' && hostname !== 'N/A') {
        // Save to background FIRST (this persists the setting)
        try {
          await sendToBackground({
            type: whitelist ? 'WHITELIST_SITE' : 'UNWHITELIST_SITE',
            hostname: hostname
          });
        } catch (e) {
          // Fallback: save directly to storage
          const storage = await getStorage(['whitelistedSites']);
          let whitelisted = storage.whitelistedSites || [];
          if (whitelist) {
            if (!whitelisted.includes(hostname)) {
              whitelisted.push(hostname);
            }
          } else {
            whitelisted = whitelisted.filter(s => s !== hostname);
          }
          await setStorage({ whitelistedSites: whitelisted });
        }

        // Then notify content script (optional, may fail on some pages)
        try {
          await sendToContentScript({
            type: whitelist ? 'WHITELIST_SITE' : 'UNWHITELIST_SITE',
            hostname: hostname
          });
        } catch (err) {}

        showToast(whitelist ? 'Protection disabled on ' + hostname : 'Protection enabled on ' + hostname);
      }
    });

    // Toggle paywall removal
    elements.paywallToggle.addEventListener('change', async () => {
      const enabled = elements.paywallToggle.checked;
      await setStorage({ paywallEnabled: enabled });

      try {
        await sendToContentScript({ type: 'TOGGLE_PAYWALL', enabled });
      } catch (err) {}
    });

    // Toggle JavaScript for this site
    elements.jsToggle.addEventListener('change', async () => {
      const block = elements.jsToggle.checked;
      const hostname = elements.currentSite.textContent;

      if (hostname && hostname !== 'loading...' && hostname !== 'Unknown site' && hostname !== 'N/A') {
        try {
          const response = await sendToBackground({
            type: 'TOGGLE_JS',
            hostname: hostname,
            block: block
          });
          if (response && response.success) {
            elements.jsHint.textContent = 'Reload page to apply';
            showToast(block ? 'JavaScript disabled on ' + hostname : 'JavaScript enabled on ' + hostname);
          } else {
            elements.jsToggle.checked = !block;
            showToast('JS control not available in this browser');
          }
        } catch (err) {
          elements.jsToggle.checked = !block;
          showToast('JS control not available in this browser');
        }
      }
    });

    // Network blocking toggle
    elements.networkBlockingToggle.addEventListener('change', async () => {
      try {
        await sendToBackground({ type: 'TOGGLE_NETWORK_BLOCKING', enabled: elements.networkBlockingToggle.checked });
      } catch (err) {}
    });

    // URL cleaning toggle
    elements.urlCleaningToggle.addEventListener('change', async () => {
      try {
        await sendToBackground({ type: 'TOGGLE_URL_CLEANING', enabled: elements.urlCleaningToggle.checked });
      } catch (err) {}
    });

    // Cookie consent toggle
    elements.cookieConsentToggle.addEventListener('change', async () => {
      const enabled = elements.cookieConsentToggle.checked;
      try {
        await sendToBackground({ type: 'TOGGLE_COOKIE_CONSENT', enabled });
        await sendToContentScript({ type: 'TOGGLE_COOKIE_CONSENT', enabled });
      } catch (err) {}
    });

    // Annoyance blocker toggle
    elements.annoyanceToggle.addEventListener('change', async () => {
      const enabled = elements.annoyanceToggle.checked;
      try {
        await sendToBackground({ type: 'TOGGLE_ANNOYANCE_BLOCKING', enabled });
        await sendToContentScript({ type: 'TOGGLE_ANNOYANCE_BLOCKING', enabled });
      } catch (err) {}
    });

    // Remove paywall button
    elements.removePaywallBtn.addEventListener('click', async () => {
      try {
        const response = await sendToContentScript({ type: 'REMOVE_PAYWALL' });
        if (response && response.success) {
          showToast('Paywall removal triggered');
        }
      } catch (err) {}
    });

    // Pick mode button
    elements.pickModeBtn.addEventListener('click', async () => {
      if (isZapMode) {
        try { await sendToContentScript({ type: 'STOP_ZAP_MODE' }); } catch (e) {}
        isZapMode = false;
        updateZapModeButton(false);
      }

      if (isPickMode) {
        try {
          await sendToContentScript({ type: 'STOP_PICK_MODE' });
        } catch (err) {}
        isPickMode = false;
        updatePickModeButton(false);
      } else {
        try {
          await sendToContentScript({ type: 'START_PICK_MODE' });
          isPickMode = true;
          updatePickModeButton(true);
          window.close();
        } catch (err) {}
      }
    });

    // Zap mode button
    elements.zapModeBtn.addEventListener('click', async () => {
      if (isPickMode) {
        try { await sendToContentScript({ type: 'STOP_PICK_MODE' }); } catch (e) {}
        isPickMode = false;
        updatePickModeButton(false);
      }

      if (isZapMode) {
        try {
          await sendToContentScript({ type: 'STOP_ZAP_MODE' });
        } catch (err) {}
        isZapMode = false;
        updateZapModeButton(false);
      } else {
        try {
          await sendToContentScript({ type: 'START_ZAP_MODE' });
          isZapMode = true;
          updateZapModeButton(true);
          window.close();
        } catch (err) {}
      }
    });

    // Open options
    elements.openOptionsBtn.addEventListener('click', () => {
      openOptionsPage();
    });

    // Report issue
    elements.reportIssue.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('Visit GitHub to report issues');
    });

    // Blocked panel - Network stats click
    if (elements.networkStatBtn) {
      elements.networkStatBtn.addEventListener('click', () => {
        showBlockedPanel('network');
      });
    }

    // Blocked panel - Cosmetic stats click
    if (elements.cosmeticStatBtn) {
      elements.cosmeticStatBtn.addEventListener('click', () => {
        showBlockedPanel('cosmetic');
      });
    }

    // Blocked panel - Close button
    if (elements.blockedClose) {
      elements.blockedClose.addEventListener('click', () => {
        hideBlockedPanel();
      });
    }

    // Blocked panel - View All button
    if (elements.viewAllBlocked) {
      elements.viewAllBlocked.addEventListener('click', () => {
        openOptionsPage('#activity');
      });
    }
  }

  function updatePickModeButton(active) {
    if (active) {
      setButtonContent(elements.pickModeBtn, SVG_PATHS.cancel, 'Cancel Selection');
      elements.pickModeBtn.classList.add('active');
    } else {
      setButtonContent(elements.pickModeBtn, SVG_PATHS.pick, 'Pick Element to Block');
      elements.pickModeBtn.classList.remove('active');
    }
  }

  function updateZapModeButton(active) {
    if (active) {
      setButtonContent(elements.zapModeBtn, SVG_PATHS.cancel, 'Exit Zap Mode');
      elements.zapModeBtn.classList.add('active');
    } else {
      setButtonContent(elements.zapModeBtn, SVG_PATHS.zap, 'Zap Element (Quick Hide)');
      elements.zapModeBtn.classList.remove('active');
    }
  }

  // ============================================
  // BLOCKED PANEL - View/Manage Blocked Items
  // ============================================
  async function showBlockedPanel(type) {
    if (!elements.blockedPanel) return;

    elements.blockedPanel.style.display = 'block';
    elements.blockedTitle.textContent = type === 'network' ? 'Blocked Requests' : 'Blocked Elements';

    // Load blocked items
    try {
      const response = await sendToBackground({ type: 'GET_REQUEST_LOG' });
      const items = response?.log || [];

      // Filter by type and get recent items (limit to 10)
      const filtered = items
        .filter(item => item.type === type)
        .slice(0, 10);

      renderBlockedItems(filtered, type);
    } catch (err) {
      elements.blockedList.innerHTML = '<div class="blocked-empty">Could not load blocked items</div>';
    }
  }

  function hideBlockedPanel() {
    if (elements.blockedPanel) {
      elements.blockedPanel.style.display = 'none';
    }
  }

  function renderBlockedItems(items, type) {
    if (!elements.blockedList) return;

    if (!items || items.length === 0) {
      elements.blockedList.innerHTML = '<div class="blocked-empty">No ' + type + ' items blocked yet on this page</div>';
      return;
    }

    let html = '';
    for (const item of items) {
      const displayUrl = item.url || item.selector || 'Unknown';
      const shortUrl = displayUrl.length > 35 ? displayUrl.substring(0, 35) + '...' : displayUrl;
      const site = item.site || '';

      html += `
        <div class="blocked-item" data-url="${escapeHtml(displayUrl)}" data-type="${type}">
          <div class="blocked-item-info">
            <div class="blocked-item-url" title="${escapeHtml(displayUrl)}">${escapeHtml(shortUrl)}</div>
            <div class="blocked-item-type ${type}">${type}${site ? ' • ' + site : ''}</div>
          </div>
        </div>
      `;
    }

    elements.blockedList.innerHTML = html;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showToast(message) {
    const existing = document.querySelector('.websuddhi-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'websuddhi-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // Animate stat value updates with a subtle pulse effect
  function animateStatUpdate(element, newValue) {
    if (!element) return;
    const currentValue = element.textContent;
    if (currentValue !== newValue) {
      element.style.transform = 'scale(1.15)';
      element.style.transition = 'transform 0.15s ease-out';
      element.textContent = newValue;
      setTimeout(() => {
        element.style.transform = 'scale(1)';
      }, 150);
    }
  }

  // Add ripple effect to buttons
  function addRippleEffect(button) {
    if (!button) return;
    button.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple-effect 0.6s ease-out;
        pointer-events: none;
      `;

      button.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  }

  // Add ripple keyframes to document if not present
  function ensureRippleStyles() {
    if (!document.getElementById('websuddhi-ripple-styles')) {
      const style = document.createElement('style');
      style.id = 'websuddhi-ripple-styles';
      style.textContent = `
        @keyframes ripple-effect {
          to {
            transform: scale(2.5);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  function formatDataSize(bytes) {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
  }

  // Update security info display based on URL
  function updateSecurityInfo(url) {
    if (!elements.siteInfoSection) return;

    const iconSecure = elements.siteIcon?.querySelector('.icon-secure');
    const iconInsecure = elements.siteIcon?.querySelector('.icon-insecure');
    const mascotHappy = elements.siteMascot?.querySelector('.mascot-happy');
    const mascotWorried = elements.siteMascot?.querySelector('.mascot-worried');

    if (!url) {
      // Unknown or invalid URL
      elements.siteInfoSection.classList.add('insecure');
      if (iconSecure) iconSecure.style.display = 'none';
      if (iconInsecure) iconInsecure.style.display = 'block';
      if (mascotHappy) mascotHappy.style.display = 'none';
      if (mascotWorried) mascotWorried.style.display = 'block';
      if (elements.securityBadge) elements.securityBadge.className = 'security-badge insecure';
      if (elements.securityText) elements.securityText.textContent = 'Unknown';
      if (elements.certProtocol) elements.certProtocol.textContent = '???';
      if (elements.certType) elements.certType.textContent = 'Not Available';
      return;
    }

    const isSecure = url.protocol === 'https:';
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const isExtension = url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:';
    const isFile = url.protocol === 'file:';

    // Update visual state
    if (isSecure || isExtension) {
      // Secure connection
      elements.siteInfoSection.classList.remove('insecure');
      if (iconSecure) iconSecure.style.display = 'block';
      if (iconInsecure) iconInsecure.style.display = 'none';
      if (mascotHappy) mascotHappy.style.display = 'block';
      if (mascotWorried) mascotWorried.style.display = 'none';
      if (elements.securityBadge) elements.securityBadge.className = 'security-badge secure';
      if (elements.securityText) elements.securityText.textContent = 'Secure Connection';
      if (elements.certProtocol) elements.certProtocol.textContent = 'HTTPS';
      if (elements.certType) elements.certType.textContent = 'TLS Encrypted';
    } else if (isLocalhost) {
      // Localhost - technically not encrypted but safe
      elements.siteInfoSection.classList.remove('insecure');
      if (iconSecure) iconSecure.style.display = 'block';
      if (iconInsecure) iconInsecure.style.display = 'none';
      if (mascotHappy) mascotHappy.style.display = 'block';
      if (mascotWorried) mascotWorried.style.display = 'none';
      if (elements.securityBadge) elements.securityBadge.className = 'security-badge secure';
      if (elements.securityText) elements.securityText.textContent = 'Local Development';
      if (elements.certProtocol) elements.certProtocol.textContent = 'localhost';
      if (elements.certType) elements.certType.textContent = 'Trusted Local';
    } else if (isFile) {
      // File protocol
      elements.siteInfoSection.classList.remove('insecure');
      if (iconSecure) iconSecure.style.display = 'block';
      if (iconInsecure) iconInsecure.style.display = 'none';
      if (mascotHappy) mascotHappy.style.display = 'block';
      if (mascotWorried) mascotWorried.style.display = 'none';
      if (elements.securityBadge) elements.securityBadge.className = 'security-badge secure';
      if (elements.securityText) elements.securityText.textContent = 'Local File';
      if (elements.certProtocol) elements.certProtocol.textContent = 'file://';
      if (elements.certType) elements.certType.textContent = 'Local Access';
    } else {
      // Insecure connection (HTTP)
      elements.siteInfoSection.classList.add('insecure');
      if (iconSecure) iconSecure.style.display = 'none';
      if (iconInsecure) iconInsecure.style.display = 'block';
      if (mascotHappy) mascotHappy.style.display = 'none';
      if (mascotWorried) mascotWorried.style.display = 'block';
      if (elements.securityBadge) elements.securityBadge.className = 'security-badge insecure';
      if (elements.securityText) elements.securityText.textContent = 'Not Secure';
      if (elements.certProtocol) elements.certProtocol.textContent = 'HTTP';
      if (elements.certType) elements.certType.textContent = 'Unencrypted';
    }
  }

  // Load tracker category breakdown from request log
  async function loadTrackerSummary() {
    if (!elements.trackerSummary || !elements.trackerCategories) return;

    try {
      const response = await sendToBackground({ type: 'GET_REQUEST_LOG' });
      if (!response || !response.success || !response.log) return;

      // Count by category and severity
      const categoryCounts = {};
      const categorySeverity = {};

      for (const entry of response.log) {
        if (entry.type === 'network' && entry.category && entry.category !== 'Unknown') {
          categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
          categorySeverity[entry.category] = entry.severity || 'low';
        }
      }

      // If no tracker data, hide the section
      const entries = Object.entries(categoryCounts);
      if (entries.length === 0) {
        elements.trackerSummary.style.display = 'none';
        return;
      }

      // Sort by count descending
      entries.sort((a, b) => b[1] - a[1]);

      // Clear and populate tracker categories
      while (elements.trackerCategories.firstChild) {
        elements.trackerCategories.removeChild(elements.trackerCategories.firstChild);
      }

      // Show top 5 categories
      const topEntries = entries.slice(0, 5);
      for (const [category, count] of topEntries) {
        const badge = document.createElement('span');
        badge.className = 'tracker-badge ' + (categorySeverity[category] || 'low');

        const countSpan = document.createElement('span');
        countSpan.className = 'tracker-count';
        countSpan.textContent = count;
        badge.appendChild(countSpan);
        badge.appendChild(document.createTextNode(' ' + category));

        elements.trackerCategories.appendChild(badge);
      }

      elements.trackerSummary.style.display = 'block';
    } catch (err) {
      elements.trackerSummary.style.display = 'none';
    }
  }

  // Load certificate owner info and third-party frames
  async function loadSecurityDetails() {
    if (!currentTab || !currentTab.id) return;

    try {
      // Get security info from background
      const response = await sendToBackground({
        type: 'GET_SECURITY_INFO',
        tabId: currentTab.id,
        url: currentTab.url
      });

      if (response && response.success && response.securityInfo) {
        const secInfo = response.securityInfo;

        // Show certificate owner if available
        if (secInfo.certificate && elements.certOwnerSection) {
          const cert = secInfo.certificate;
          elements.certOwnerSection.style.display = 'block';

          if (elements.certOwnerName) {
            elements.certOwnerName.textContent = cert.organization || cert.subject || 'Unknown Organization';
          }

          if (elements.certOwnerDetails) {
            const details = [];
            if (cert.issuer) details.push('Issued by: ' + extractIssuerName(cert.issuer));
            if (cert.validTo) details.push('Valid until: ' + cert.validTo);
            elements.certOwnerDetails.textContent = details.join(' • ') || '';
          }
        } else if (elements.certOwnerSection) {
          // No cert details available (Chrome limitation) - show domain-based info
          if (currentTab.url) {
            try {
              const url = new URL(currentTab.url);
              if (url.protocol === 'https:') {
                elements.certOwnerSection.style.display = 'block';
                if (elements.certOwnerName) {
                  elements.certOwnerName.textContent = getOrganizationHint(url.hostname);
                }
                if (elements.certOwnerDetails) {
                  elements.certOwnerDetails.textContent = 'Certificate details require Firefox';
                }
              }
            } catch (e) {}
          }
        }
      }

      // Get frame info
      const frameResponse = await sendToBackground({
        type: 'GET_FRAME_INFO',
        tabId: currentTab.id
      });

      if (frameResponse && frameResponse.success) {
        const allFrames = [
          ...(frameResponse.thirdPartyDomains || []),
          ...(frameResponse.blockedFrames || [])
        ];

        if (allFrames.length > 0 && elements.framesSection) {
          elements.framesSection.style.display = 'block';
          if (elements.framesCount) {
            elements.framesCount.textContent = allFrames.length;
          }
          renderFramesList(frameResponse.thirdPartyDomains || [], frameResponse.blockedFrames || []);
        }
      }

      // Also ask content script for detected frames
      try {
        const contentFrames = await sendToContentScript({ type: 'GET_FRAMES' });
        if (contentFrames && contentFrames.frames && contentFrames.frames.length > 0) {
          if (elements.framesSection) {
            elements.framesSection.style.display = 'block';
          }
          // Merge with existing frames
          updateFramesFromContent(contentFrames.frames);
        }
      } catch (e) {
        // Content script may not be available
      }

    } catch (err) {
      // Silently fail - security details are nice-to-have
    }
  }

  // Extract issuer name from certificate issuer string
  function extractIssuerName(issuer) {
    if (!issuer) return 'Unknown';
    // Try to extract O= (Organization) or CN= (Common Name)
    const orgMatch = issuer.match(/O=([^,]+)/);
    if (orgMatch) return orgMatch[1];
    const cnMatch = issuer.match(/CN=([^,]+)/);
    if (cnMatch) return cnMatch[1];
    return issuer.substring(0, 30);
  }

  // Get organization hint from domain for common sites
  function getOrganizationHint(hostname) {
    const knownOrgs = {
      'google.com': 'Google LLC',
      'youtube.com': 'Google LLC',
      'facebook.com': 'Meta Platforms, Inc.',
      'instagram.com': 'Meta Platforms, Inc.',
      'twitter.com': 'X Corp.',
      'x.com': 'X Corp.',
      'amazon.com': 'Amazon.com, Inc.',
      'microsoft.com': 'Microsoft Corporation',
      'apple.com': 'Apple Inc.',
      'github.com': 'GitHub, Inc.',
      'netflix.com': 'Netflix, Inc.',
      'linkedin.com': 'LinkedIn Corporation',
      'reddit.com': 'Reddit, Inc.',
      'wikipedia.org': 'Wikimedia Foundation',
      'cloudflare.com': 'Cloudflare, Inc.'
    };

    // Check exact match
    const normalized = hostname.replace(/^www\./, '');
    if (knownOrgs[normalized]) return knownOrgs[normalized];

    // Check if subdomain of known domain
    for (const [domain, org] of Object.entries(knownOrgs)) {
      if (normalized.endsWith('.' + domain)) return org;
    }

    // Return domain as fallback
    return normalized;
  }

  // Render frames list
  function renderFramesList(allowed, blocked) {
    if (!elements.framesList) return;

    while (elements.framesList.firstChild) {
      elements.framesList.removeChild(elements.framesList.firstChild);
    }

    // Show blocked frames first
    for (const frame of blocked) {
      const item = document.createElement('div');
      item.className = 'frame-item blocked';

      const host = document.createElement('span');
      host.className = 'frame-host';
      host.textContent = frame.host;
      host.title = frame.url || frame.host;
      item.appendChild(host);

      const allowBtn = document.createElement('button');
      allowBtn.className = 'frame-allow-btn';
      allowBtn.textContent = 'Allow';
      allowBtn.addEventListener('click', () => allowFrame(frame.host, frame.url));
      item.appendChild(allowBtn);

      elements.framesList.appendChild(item);
    }

    // Show allowed frames
    for (const frame of allowed) {
      const item = document.createElement('div');
      item.className = 'frame-item';

      const host = document.createElement('span');
      host.className = 'frame-host';
      host.textContent = frame.host;
      host.title = frame.url || frame.host;
      item.appendChild(host);

      const status = document.createElement('span');
      status.className = 'frame-status allowed';
      status.textContent = 'loaded';
      item.appendChild(status);

      elements.framesList.appendChild(item);
    }

    // Update count
    if (elements.framesCount) {
      elements.framesCount.textContent = allowed.length + blocked.length;
    }
  }

  // Update frames from content script detection
  function updateFramesFromContent(frames) {
    if (!elements.framesList || !frames.length) return;

    // Get existing hosts
    const existingHosts = new Set();
    elements.framesList.querySelectorAll('.frame-host').forEach(el => {
      existingHosts.add(el.textContent);
    });

    // Add new frames
    for (const frame of frames) {
      if (existingHosts.has(frame.host)) continue;

      const item = document.createElement('div');
      item.className = 'frame-item' + (frame.blocked ? ' blocked' : '');

      const host = document.createElement('span');
      host.className = 'frame-host';
      host.textContent = frame.host;
      host.title = frame.src || frame.host;
      item.appendChild(host);

      if (frame.blocked) {
        const allowBtn = document.createElement('button');
        allowBtn.className = 'frame-allow-btn';
        allowBtn.textContent = 'Allow';
        allowBtn.addEventListener('click', () => allowFrame(frame.host, frame.src));
        item.appendChild(allowBtn);
      } else {
        const status = document.createElement('span');
        status.className = 'frame-status allowed';
        status.textContent = 'loaded';
        item.appendChild(status);
      }

      elements.framesList.appendChild(item);
      existingHosts.add(frame.host);
    }

    // Update count
    if (elements.framesCount) {
      elements.framesCount.textContent = existingHosts.size;
    }

    // Show section if we have frames
    if (existingHosts.size > 0 && elements.framesSection) {
      elements.framesSection.style.display = 'block';
    }
  }

  // Allow a blocked frame
  async function allowFrame(host, url) {
    try {
      await sendToBackground({
        type: 'ALLOW_FRAME',
        tabId: currentTab.id,
        frameHost: host,
        frameUrl: url
      });

      // Notify content script to unblock
      await sendToContentScript({
        type: 'ALLOW_FRAME',
        frameHost: host
      });

      showToast('Allowed: ' + host);

      // Refresh the list
      await loadSecurityDetails();
    } catch (e) {
      showToast('Failed to allow frame');
    }
  }

  // ============================================
  // START
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
