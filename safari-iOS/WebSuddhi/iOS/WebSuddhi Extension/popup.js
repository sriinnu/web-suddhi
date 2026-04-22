// WebSuddhi v2.3.0 - iOS Safari Popup Script
(function() {
  'use strict';

  const enableToggle = document.getElementById('enableToggle');
  const whitelistToggle = document.getElementById('whitelistToggle');
  const currentSite = document.getElementById('currentSite');
  const paywallToggle = document.getElementById('paywallToggle');
  const cookieConsentToggle = document.getElementById('cookieConsentToggle');
  const annoyanceToggle = document.getElementById('annoyanceToggle');
  const blockedCountEl = document.getElementById('blockedCount');
  const rulesCountEl = document.getElementById('rulesCount');
  const removePaywallBtn = document.getElementById('removePaywall');
  const dismissCookiesBtn = document.getElementById('dismissCookies');
  const pickElementBtn = document.getElementById('pickElement');
  const openOptionsBtn = document.getElementById('openOptions');

  // Initialize
  async function init() {
    try {
      const storage = await browser.storage.local.get([
        'enabled', 'paywallEnabled', 'cookieConsentEnabled', 'annoyanceBlockingEnabled',
        'whitelistedSites', 'blockedSelectors'
      ]);
      enableToggle.checked = storage.enabled !== false;
      paywallToggle.checked = storage.paywallEnabled !== false;
      cookieConsentToggle.checked = storage.cookieConsentEnabled !== false;
      annoyanceToggle.checked = storage.annoyanceBlockingEnabled !== false;

      const whitelistedSites = storage.whitelistedSites || [];
      rulesCountEl.textContent = (storage.blockedSelectors || []).length;

      // Get current site hostname from active tab
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.url) {
          const url = new URL(tabs[0].url);
          const hostname = url.hostname.replace(/^www\./, '');
          currentSite.textContent = hostname;

          const isWhitelisted = whitelistedSites.some(site => {
            const normalized = site.replace(/^www\./, '');
            return hostname === normalized || hostname.endsWith('.' + normalized);
          });
          whitelistToggle.checked = isWhitelisted;

          // Get blocked count from content script
          try {
            const response = await browser.tabs.sendMessage(tabs[0].id, { type: 'GET_STATUS' });
            if (response && response.success) {
              blockedCountEl.textContent = response.blockedCount || 0;
            }
          } catch (e) {}
        } else {
          currentSite.textContent = 'N/A';
        }
      } catch (e) {
        currentSite.textContent = 'Unknown';
      }
    } catch (err) {}
  }

  // Toggle ad blocking
  enableToggle?.addEventListener('change', async () => {
    try {
      await browser.storage.local.set({ enabled: enableToggle.checked });
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        browser.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE', enabled: enableToggle.checked }).catch(() => {});
      }
    } catch (err) {}
  });

  // Toggle whitelist
  whitelistToggle?.addEventListener('change', async () => {
    try {
      const hostname = currentSite.textContent;
      if (hostname && hostname !== 'loading...' && hostname !== 'N/A' && hostname !== 'Unknown') {
        if (whitelistToggle.checked) {
          const storage = await browser.storage.local.get(['whitelistedSites']);
          const sites = storage.whitelistedSites || [];
          if (!sites.includes(hostname)) {
            sites.push(hostname);
            await browser.storage.local.set({ whitelistedSites: sites });
          }
          const tabs = await browser.tabs.query({ active: true, currentWindow: true });
          if (tabs[0]?.id) {
            browser.tabs.sendMessage(tabs[0].id, { type: 'WHITELIST_SITE', hostname }).catch(() => {});
          }
          enableToggle.checked = false;
          await browser.storage.local.set({ enabled: false });
        } else {
          const storage = await browser.storage.local.get(['whitelistedSites']);
          const sites = (storage.whitelistedSites || []).filter(s => s !== hostname);
          await browser.storage.local.set({ whitelistedSites: sites });
          const tabs = await browser.tabs.query({ active: true, currentWindow: true });
          if (tabs[0]?.id) {
            browser.tabs.sendMessage(tabs[0].id, { type: 'UNWHITELIST_SITE', hostname }).catch(() => {});
          }
          enableToggle.checked = true;
          await browser.storage.local.set({ enabled: true });
        }
      }
    } catch (err) {}
  });

  // Toggle paywall removal
  paywallToggle?.addEventListener('change', async () => {
    try {
      await browser.storage.local.set({ paywallEnabled: paywallToggle.checked });
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        browser.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_PAYWALL', enabled: paywallToggle.checked }).catch(() => {});
      }
    } catch (err) {}
  });

  // Toggle cookie consent auto-dismiss
  cookieConsentToggle?.addEventListener('change', async () => {
    try {
      await browser.storage.local.set({ cookieConsentEnabled: cookieConsentToggle.checked });
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        browser.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_COOKIE_CONSENT', enabled: cookieConsentToggle.checked }).catch(() => {});
      }
    } catch (err) {}
  });

  // Toggle annoyance blocker
  annoyanceToggle?.addEventListener('change', async () => {
    try {
      await browser.storage.local.set({ annoyanceBlockingEnabled: annoyanceToggle.checked });
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        browser.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_ANNOYANCE_BLOCKING', enabled: annoyanceToggle.checked }).catch(() => {});
      }
    } catch (err) {}
  });

  // Remove paywall now
  removePaywallBtn?.addEventListener('click', async () => {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        browser.tabs.sendMessage(tabs[0].id, { type: 'REMOVE_PAYWALL' }).catch(() => {});
      }
    } catch (err) {}
  });

  // Dismiss cookies now
  dismissCookiesBtn?.addEventListener('click', async () => {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        browser.tabs.sendMessage(tabs[0].id, { type: 'DISMISS_COOKIES_NOW' }).catch(() => {});
      }
    } catch (err) {}
  });

  // Pick element
  pickElementBtn?.addEventListener('click', async () => {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        browser.tabs.sendMessage(tabs[0].id, { type: 'START_PICK_MODE' }).catch(() => {});
      }
      window.close();
    } catch (err) {}
  });

  // Open options/manage rules
  openOptionsBtn?.addEventListener('click', () => {
    browser.runtime.openOptionsPage();
  });

  init();
})();
