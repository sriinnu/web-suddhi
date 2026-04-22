// WebSuddhi v2.3.0 - iOS Safari Content Script
// Ad blocking, paywall removal, cookie consent, annoyance blocking
(function() {
  'use strict';

  const AD_SELECTORS = {
    common: [
      '[class*="ad-"]', '[class*="ads-"]', '[id*="ad-"]', '[id*="ads-"]',
      '[data-ad]', '[data-ads]', '.ad', '.ads', '.ad-container', '.ad-wrapper',
      '[class*="advert"]', '[id*="advert"]', '.advertisement',
      '.adsbygoogle', '.google-ad', '#google_ads',
      '[data-google-query-id]', '[data-slot]', '[data-adsbygoogle]',
      '.ad-unit', '.ad-slot', '.ad-placement', '.ad-banner',
      '.leaderboard', '.skyscraper', '.rectangle', '.billboard'
    ],
    networks: [
      '.criteo', '[class*="criteo"]', '.taboola', '[class*="taboola"]',
      '.outbrain', '[class*="outbrain"]', '.mgid', '[class*="mgid"]',
      '.revcontent', '[class*="revcontent"]', '.mediavine', '[class*="mediavine"]',
      '.adthrive', '[class*="adthrive"]', '.ezoic', '[class*="ezoic"]',
      '[class*="sponsored"]', '[class*="promoted"]', '.native-ad', '[class*="native-ad"]'
    ],
    paywall: [
      '[class*="paywall"]', '[id*="paywall"]',
      '[class*="subscribe-wall"]', '[class*="subscription-wall"]',
      '[class*="metered"]', '[id*="metered"]',
      '[class*="content-gate"]', '[class*="article-gate"]',
      '[class*="locked-content"]', '[class*="premium-wall"]',
      '.piano-offer', '[class*="piano-offer"]',
      '.tp-modal', '.tp-backdrop', '.tinypass', '[class*="tinypass"]',
      '[class*="membership-gate"]', '[class*="member-wall"]'
    ],
    notices: [
      '.cookie-notice', '.cookie-banner', '.cookie-consent',
      '.cookie-popup', '.cookie-modal', '.gdpr-banner', '.gdpr-notice',
      '.cc-banner', '.cc-dialog', '.cc-window',
      '[class*="cookie-"][class*="banner"]', '[class*="cookie-"][class*="notice"]',
      '[class*="gdpr-"]', '[id*="cookiebanner"]', '[id*="gdpr"]',
      '.newsletter-popup', '.email-popup', '.subscribe-popup',
      '[class*="newsletter-popup"]', '[class*="exit-intent"]'
    ]
  };

  // Annoyance selectors (Phase 4)
  const ANNOYANCE_SELECTORS = [
    '#intercom-container', '#intercom-frame', '.intercom-lightweight-app',
    '#drift-widget', '#drift-frame', '#tawkchat-container', '.tawk-min-container',
    '#crisp-chatbox', '.crisp-client',
    '#hubspot-messages-iframe-container',
    '#launcher', '#webWidget', 'iframe#webWidget',
    '#fc_frame', '#tidio-chat', '#kommunicate-widget-iframe',
    '[class*="chat-widget"]', '[class*="chat-bubble"]', '[class*="chat-launcher"]',
    '#onesignal-slidedown-container', '#onesignal-bell-container',
    '[class*="push-notification-prompt"]', '[class*="push-prompt"]',
    '.smart-banner', '.smartbanner', '[class*="app-banner"]', '[class*="app-install"]',
    '#PopupSignupForm_0', '.mc-modal', '.klaviyo-form',
    '#sumo-app', '#om-holder', '.privy-popup',
    '[class*="newsletter-popup"]', '[class*="newsletter-modal"]',
    '[class*="email-popup"]', '[class*="subscribe-popup"]', '[class*="optin-popup"]'
  ];

  // Cookie consent framework selectors (Phase 3)
  const COOKIE_CONSENT_SELECTORS = {
    onetrust: { reject: '#onetrust-reject-all-handler', container: '#onetrust-consent-sdk' },
    cookiebot: { reject: '#CybotCookiebotDialogBodyButtonDecline', container: '#CybotCookiebotDialog' },
    trustarc: { reject: '#truste-consent-required' },
    didomi: { reject: '#didomi-notice-disagree-button', container: '#didomi-host' },
    cookieyes: { reject: '.cky-btn-reject' },
    complianz: { reject: '.cmplz-deny' },
    osano: { reject: '.osano-cm-deny' }
  };

  const ALL_AD_SELECTORS = Object.values(AD_SELECTORS).flat();

  let state = {
    enabled: true,
    paywallEnabled: true,
    cookieConsentEnabled: true,
    annoyanceBlockingEnabled: true,
    whitelistedSites: [],
    blockedSelectors: new Map(),
    pausedSites: {},
    perSiteAllowedSelectors: {},
    blockedCount: 0
  };

  function getCurrentHostname() {
    try { return window.location.hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  function isSiteWhitelisted() {
    const hostname = getCurrentHostname();
    if (!hostname) return false;
    return state.whitelistedSites.some(site => {
      const normalized = site.replace(/^www\./, '');
      return hostname === normalized || hostname.endsWith('.' + normalized);
    });
  }

  async function init() {
    try {
      const storage = await browser.storage.local.get([
        'enabled', 'paywallEnabled', 'cookieConsentEnabled', 'annoyanceBlockingEnabled',
        'whitelistedSites', 'blockedSelectors', 'pausedSites', 'perSiteAllowedSelectors'
      ]);
      state.enabled = storage.enabled !== false;
      state.paywallEnabled = storage.paywallEnabled !== false;
      state.cookieConsentEnabled = storage.cookieConsentEnabled !== false;
      state.annoyanceBlockingEnabled = storage.annoyanceBlockingEnabled !== false;
      state.whitelistedSites = storage.whitelistedSites || [];
      state.pausedSites = (storage.pausedSites && typeof storage.pausedSites === 'object') ? storage.pausedSites : {};
      state.perSiteAllowedSelectors = (storage.perSiteAllowedSelectors && typeof storage.perSiteAllowedSelectors === 'object') ? storage.perSiteAllowedSelectors : {};

      for (const entry of (storage.blockedSelectors || [])) {
        if (entry && entry.selector) {
          state.blockedSelectors.set(entry.selector, { url: entry.hostname, date: entry.date });
        }
      }

      if (isSiteWhitelisted() || isSitePaused()) { state.enabled = false; }

      if (state.enabled) {
        applyAdBlocking();
        removePingAttributes();
        if (state.annoyanceBlockingEnabled) applyAnnoyanceBlocking();
      }

      if (state.paywallEnabled && !isSiteWhitelisted()) {
        setTimeout(detectAndRemovePaywall, 1000);
        setTimeout(detectAndRemovePaywall, 3000);
      }

      if (state.cookieConsentEnabled && !isSiteWhitelisted()) {
        setTimeout(dismissCookieConsent, 500);
        setTimeout(dismissCookieConsent, 1500);
        setTimeout(dismissCookieConsent, 3000);
        setTimeout(dismissCookieConsent, 5000);
      }
    } catch (err) {}
  }

  // ============================================
  // AD BLOCKING
  // ============================================
  function applyAdBlocking() {
    if (!state.enabled || isSiteWhitelisted() || isSitePaused()) return;

    const allowed = getAllowedSelectorSet();
    for (const selector of state.blockedSelectors.keys()) {
      if (allowed.has(selector)) continue;
      blockSelector(selector);
    }
    for (const selector of ALL_AD_SELECTORS) {
      if (allowed.has(selector)) continue;
      blockSelector(selector);
    }
  }

  function blockSelector(selector) {
    try {
      document.querySelectorAll(selector).forEach(el => {
        if (!el.hasAttribute('data-websuddhi-blocked')) hideElement(el);
      });
    } catch (e) {}
  }

  function isSitePaused() {
    const host = getCurrentHostname();
    if (!host) return false;
    const expiry = (state.pausedSites || {})[host];
    return typeof expiry === 'number' && expiry > Date.now();
  }

  function getAllowedSelectorSet() {
    const host = getCurrentHostname();
    if (!host) return new Set();
    const list = (state.perSiteAllowedSelectors || {})[host] || [];
    return new Set(list);
  }

  function hideElement(el) {
    el.classList.add('websuddhi-hidden');
    el.setAttribute('data-websuddhi-blocked', 'true');
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    state.blockedCount++;
  }

  // ============================================
  // PAYWALL REMOVAL
  // ============================================
  function detectAndRemovePaywall() {
    if (!state.paywallEnabled || isSiteWhitelisted()) return;

    for (const selector of AD_SELECTORS.paywall) {
      try {
        document.querySelectorAll(selector).forEach(el => {
          if (isPaywallElement(el)) {
            el.style.setProperty('display', 'none', 'important');
            el.setAttribute('data-websuddhi-removed', 'paywall');
            state.blockedCount++;
          }
        });
      } catch (e) {}
    }

    // Restore body scroll if paywall locked it
    const removed = document.querySelectorAll('[data-websuddhi-removed]');
    if (removed.length > 0) {
      document.body.style.overflow = '';
      document.body.style.overflowY = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.overflowY = '';
    }
  }

  function isPaywallElement(el) {
    const text = (el.innerText || '').substring(0, 500).toLowerCase();
    const className = (typeof el.className === 'string') ? el.className.toLowerCase() : '';
    const id = (el.id || '').toLowerCase();
    const combined = className + ' ' + id;

    if (['paywall', 'subscribe-wall', 'subscription-wall', 'metered', 'content-gate',
         'article-gate', 'locked-content', 'premium-wall', 'piano-offer', 'tinypass'
    ].some(p => combined.includes(p))) return true;

    return ['subscribe to continue', 'subscribe to read', 'subscription required',
            'sign in to read', 'article limit', 'free articles remaining',
            'unlock this article', 'become a member', 'start your trial'
    ].some(signal => text.includes(signal));
  }

  // ============================================
  // COOKIE CONSENT (Phase 3)
  // ============================================
  function dismissCookieConsent() {
    if (!state.cookieConsentEnabled || isSiteWhitelisted()) return;

    // Try framework-specific buttons
    for (const [, selectors] of Object.entries(COOKIE_CONSENT_SELECTORS)) {
      if (selectors.reject) {
        const btn = document.querySelector(selectors.reject);
        if (btn && isVisible(btn)) { btn.click(); return; }
      }
    }

    // Try CMP API calls
    if (document.querySelector('#onetrust-consent-sdk')) {
      injectScript('if(window.OneTrust&&OneTrust.RejectAll)OneTrust.RejectAll();');
      return;
    }
    if (document.querySelector('#CybotCookiebotDialog')) {
      injectScript('if(window.Cookiebot&&Cookiebot.decline)Cookiebot.decline();');
      return;
    }
    if (document.querySelector('#didomi-host')) {
      injectScript('if(window.Didomi&&Didomi.setUserDisagreeToAll)Didomi.setUserDisagreeToAll();');
      return;
    }

    // Generic text-based fallback
    const rejectPatterns = [
      /^reject\s*(all)?$/i, /^decline\s*(all)?$/i, /^refuse\s*(all)?$/i,
      /^deny\s*(all)?$/i, /^necessary\s*only$/i, /^no\s*thanks?$/i,
      /^alle?\s*ablehnen$/i, /^tout\s*refuser$/i, /^rechazar\s*(todo)?$/i
    ];

    const consentContainers = document.querySelectorAll(
      '[class*="cookie-consent"],[class*="cookie-banner"],[class*="cookie-notice"],' +
      '[class*="gdpr"],[id*="cookie"],[id*="gdpr"],[class*="cc-banner"],.cc-window'
    );

    for (const container of consentContainers) {
      if (!isVisible(container)) continue;
      const buttons = container.querySelectorAll('button, a[role="button"], [class*="btn"]');
      for (const btn of buttons) {
        const text = (btn.textContent || '').trim();
        if (text.length > 50) continue;
        for (const pattern of rejectPatterns) {
          if (pattern.test(text) && isVisible(btn)) { btn.click(); return; }
        }
      }
    }
  }

  function injectScript(code) {
    try {
      const s = document.createElement('script');
      s.textContent = code;
      (document.head || document.documentElement).appendChild(s);
      s.remove();
    } catch (e) {}
  }

  // ============================================
  // ANNOYANCE BLOCKING (Phase 4)
  // ============================================
  function applyAnnoyanceBlocking() {
    if (!state.annoyanceBlockingEnabled || isSiteWhitelisted() || isSitePaused()) return;
    const allowed = getAllowedSelectorSet();
    let blocked = 0;
    let lastSelector = '';
    for (const selector of ANNOYANCE_SELECTORS) {
      if (allowed.has(selector)) continue;
      try {
        document.querySelectorAll(selector).forEach(el => {
          if (!el.hasAttribute('data-websuddhi-annoyance-blocked') && isVisible(el)) {
            el.style.setProperty('display', 'none', 'important');
            el.setAttribute('data-websuddhi-annoyance-blocked', 'true');
            blocked++;
            lastSelector = selector;
          }
        });
      } catch (e) {}
    }
    if (blocked > 0) {
      try {
        browser.runtime.sendMessage({
          type: 'INCREMENT_COSMETIC_STATS',
          hostname: getCurrentHostname(),
          count: blocked,
          selector: lastSelector,
          category: 'annoyance'
        });
      } catch (e) {}
    }
  }

  // ============================================
  // PING REMOVAL (Phase 6)
  // ============================================
  function removePingAttributes() {
    try {
      document.querySelectorAll('a[ping]').forEach(el => el.removeAttribute('ping'));
    } catch (e) {}
  }

  // ============================================
  // UTILITIES
  // ============================================
  function isVisible(el) {
    if (!el) return false;
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    } catch (e) { return true; }
  }

  // ============================================
  // DEBOUNCED STATS REPORTING
  // ============================================
  let pendingCount = 0;
  let reportTimer = null;

  function reportStats() {
    pendingCount++;
    clearTimeout(reportTimer);
    reportTimer = setTimeout(() => {
      const count = pendingCount;
      pendingCount = 0;
      try {
        browser.runtime.sendMessage({
          type: 'INCREMENT_COSMETIC_STATS',
          hostname: getCurrentHostname(),
          count
        }).catch(() => {});
      } catch (e) {}
    }, 2000);
  }

  // ============================================
  // MESSAGE LISTENER
  // ============================================
  browser.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'TOGGLE') {
      state.enabled = msg.enabled;
      if (msg.enabled) { applyAdBlocking(); }
      else {
        document.querySelectorAll('.websuddhi-hidden,[data-websuddhi-blocked],[data-websuddhi-removed]').forEach(el => {
          el.classList.remove('websuddhi-hidden');
          el.removeAttribute('data-websuddhi-blocked');
          el.removeAttribute('data-websuddhi-removed');
          el.style.display = '';
          el.style.visibility = '';
        });
        state.blockedCount = 0;
      }
    }
    if (msg.type === 'TOGGLE_PAYWALL') {
      state.paywallEnabled = msg.enabled;
      if (msg.enabled) detectAndRemovePaywall();
    }
    if (msg.type === 'TOGGLE_COOKIE_CONSENT') {
      state.cookieConsentEnabled = msg.enabled;
    }
    if (msg.type === 'TOGGLE_ANNOYANCE_BLOCKING') {
      state.annoyanceBlockingEnabled = msg.enabled;
      if (msg.enabled) applyAnnoyanceBlocking();
    }
    if (msg.type === 'REMOVE_PAYWALL') { detectAndRemovePaywall(); }
    if (msg.type === 'DISMISS_COOKIES_NOW') { dismissCookieConsent(); }
    if (msg.type === 'GET_STATUS') {
      return Promise.resolve({
        success: true,
        enabled: state.enabled,
        paywallEnabled: state.paywallEnabled,
        blockedCount: state.blockedCount
      });
    }
    if (msg.type === 'WHITELIST_SITE') {
      const hostname = msg.hostname || getCurrentHostname();
      if (hostname && !state.whitelistedSites.includes(hostname)) {
        state.whitelistedSites.push(hostname);
        browser.storage.local.set({ whitelistedSites: state.whitelistedSites });
        document.querySelectorAll('.websuddhi-hidden').forEach(el => {
          el.classList.remove('websuddhi-hidden');
          el.style.display = '';
          el.style.visibility = '';
        });
      }
    }
    if (msg.type === 'UNWHITELIST_SITE') {
      const hostname = msg.hostname || getCurrentHostname();
      state.whitelistedSites = state.whitelistedSites.filter(s => s !== hostname);
      browser.storage.local.set({ whitelistedSites: state.whitelistedSites });
    }
  });

  // ============================================
  // MUTATION OBSERVER
  // ============================================
  if (document.body) {
    setupObserver();
  } else {
    document.addEventListener('DOMContentLoaded', setupObserver);
  }

  function setupObserver() {
    if (!document.body) return;
    let timeout = null;
    const observer = new MutationObserver((mutations) => {
      if (!state.enabled && !state.cookieConsentEnabled) return;
      let hasNew = false;
      for (const m of mutations) { if (m.addedNodes.length > 0) { hasNew = true; break; } }
      if (!hasNew) return;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (state.enabled) {
          applyAdBlocking();
          removePingAttributes();
          if (state.annoyanceBlockingEnabled) applyAnnoyanceBlocking();
        }
        if (state.paywallEnabled) detectAndRemovePaywall();
        if (state.cookieConsentEnabled) dismissCookieConsent();
      }, 200);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  init();
})();
