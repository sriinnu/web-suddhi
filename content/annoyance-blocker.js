// WebSuddhi - Annoyance Blocker
// Phase 4: Block chat widgets, newsletter popups, push prompts, app banners

(function() {
  'use strict';

  // Logging helpers (use utils if available, fallback to console)
  const logError = (...args) => {
    if (self.WebSuddhi && self.WebSuddhi.utils && self.WebSuddhi.utils.error) {
      self.WebSuddhi.utils.error(...args);
    } else {
      console.error('[WebSuddhi]', ...args);
    }
  };

  let enabled = true;
  let observer = null;

  // ============================================
  // ANNOYANCE SELECTORS
  // ============================================

  // Chat widgets
  const CHAT_WIDGET_SELECTORS = [
    // Intercom
    '#intercom-container', '#intercom-frame', '.intercom-lightweight-app',
    '[class*="intercom-"]', 'iframe[name="intercom-frame"]',
    // Drift
    '#drift-widget', '#drift-frame', '#drift-frame-controller',
    '#drift-frame-chat', '[class*="drift-"]',
    // Tawk.to
    '#tawkchat-container', '#tawkchat-chat', '.tawk-min-container',
    '[class*="tawk-"]', 'iframe[title*="tawk"]',
    // Crisp
    '#crisp-chatbox', '.crisp-client', '[class*="crisp-"]',
    // HubSpot Chat
    '#hubspot-conversations-inline-parent', '#hubspot-messages-iframe-container',
    '#hs-eu-cookie-confirmation', '[class*="hs-chat"]',
    // Zendesk
    '#launcher', '#webWidget', 'iframe#webWidget',
    '[class*="zEWidget"]', '[class*="zendesk"]',
    // Freshchat / Freshdesk
    '#fc_frame', '#fc_push_frame', '[id^="fc_"]',
    '[class*="freshchat"]', '[class*="freshdesk"]',
    // Olark
    '#olark-wrapper', '#habla_beta_container_do_not_rely_on_div_id',
    '[class*="olark"]',
    // LiveChat
    '#chat-widget', '#chat-widget-container',
    '[class*="livechat"]', 'iframe[title*="LiveChat"]',
    // Tidio
    '#tidio-chat', '#tidio-chat-iframe',
    '[class*="tidio"]',
    // Kommunicate
    '#kommunicate-widget-iframe', '[class*="kommunicate"]',
    // Chatwoot
    '.chatwoot-widget-holder', '#chatwoot-widget-holder', '[class*="chatwoot"]',
    // Customerly
    '#customerly-container', '[class*="customerly"]',
    // Help Scout
    '#beacon-container', '.BeaconContainer',
    // LiveAgent
    '#la_x_module', '[class*="liveagent"]',
    // Generic chat patterns
    '[class*="chat-widget"]', '[class*="chatwidget"]',
    '[class*="chat-bubble"]', '[class*="chat-launcher"]',
    '[id*="chat-widget"]', '[id*="chatwidget"]'
  ];

  // Newsletter / email popups
  const NEWSLETTER_SELECTORS = [
    // Mailchimp
    '#PopupSignupForm_0', '.mc-modal', '[class*="mc-closeModal"]',
    '.mc-banner', '.mc-layout',
    // Klaviyo
    '.klaviyo-form', '[class*="klaviyo"]', '[data-testid*="klaviyo"]',
    // Sumo
    '#sumo-app', '.sumome-react-wysiwyg-popup',
    '.sumome-smartbar-popup', '[class*="sumo-"]',
    // OptinMonster
    '#om-holder', '.om-holder', '[class*="optinmonster"]',
    '[id*="om-"]', '.monsido-bar',
    // Privy
    '.privy-popup', '[class*="privy-"]',
    // Sleeknote
    '#sleeknote-overlay', '.sleeknote-widget',
    // WisePops
    '.wisepops-popup', '[class*="wisepops"]',
    // ConvertFlow
    '.cf-popup', '[class*="convertflow"]',
    // Generic newsletter patterns
    '[class*="newsletter-popup"]', '[class*="newsletter-modal"]',
    '[class*="email-popup"]', '[class*="email-capture"]',
    '[class*="subscribe-popup"]', '[class*="subscribe-modal"]',
    '[class*="optin-popup"]', '[class*="optin-modal"]',
    '[class*="signup-popup"]', '[class*="signup-modal"]',
    '[class*="lead-capture"]', '[class*="email-collection"]'
  ];

  // Push notification prompts
  const PUSH_NOTIFICATION_SELECTORS = [
    // OneSignal
    '#onesignal-slidedown-container', '#onesignal-bell-container',
    '.onesignal-customlink-container', '[class*="onesignal"]',
    // PushCrew / VWO Engage
    '#pushcrew-chrome-notify-prompt', '[class*="pushcrew"]',
    // PushOwl
    '.pushowl-notification-prompt', '[class*="pushowl"]',
    // WebPushr
    '#webpushr-prompt-wrapper', '[class*="webpushr"]',
    // PushEngage
    '#pushengage-subscription-dialog', '[class*="pushengage"]',
    // CleverTap
    '#wzrk_wrapper', '[class*="cleverpush"]',
    // Generic push patterns
    '[class*="push-notification-prompt"]', '[class*="push-prompt"]',
    '[class*="browser-notification"]', '[class*="web-push"]',
    '[id*="push-prompt"]', '[id*="notification-prompt"]'
  ];

  // App install banners
  const APP_INSTALL_SELECTORS = [
    // Smart App Banner (iOS)
    'meta[name="apple-itunes-app"]',
    // Generic
    '.smart-banner', '.smartbanner', '[class*="smart-banner"]',
    '[class*="smartbanner"]', '[class*="app-banner"]',
    '[class*="app-install"]', '[class*="install-app"]',
    '[class*="download-app"]', '[class*="get-app"]',
    // Branch
    '#branch-banner-iframe', '.branch-banner-is-active',
    '[class*="branch-banner"]'
  ];

  // Social login walls
  const SOCIAL_LOGIN_SELECTORS = [
    '[class*="social-login-wall"]', '[class*="social-gate"]',
    '[class*="login-wall"]', '[class*="signup-wall"]'
  ];

  // Combine all selectors
  const ALL_ANNOYANCE_SELECTORS = [
    ...CHAT_WIDGET_SELECTORS,
    ...NEWSLETTER_SELECTORS,
    ...PUSH_NOTIFICATION_SELECTORS,
    ...APP_INSTALL_SELECTORS,
    ...SOCIAL_LOGIN_SELECTORS
  ];

  // ============================================
  // INITIALIZATION
  // ============================================
  async function init() {
    try {
      const storage = await getStorage(['annoyanceBlockingEnabled', 'whitelistedSites']);
      enabled = storage.annoyanceBlockingEnabled !== false;

      if (!enabled) return;

      // Check whitelist
      const hostname = window.location.hostname.replace(/^www\./, '');
      const whitelisted = (storage.whitelistedSites || []).some(site => {
        const normalized = site.replace(/^www\./, '');
        return hostname === normalized || hostname.endsWith('.' + normalized);
      });
      if (whitelisted) return;

      // Apply blocking
      applyBlocking();

      // Setup MutationObserver for dynamic content
      setupObserver();

      // Retry for late-loading widgets
      setTimeout(applyBlocking, 1000);
      setTimeout(applyBlocking, 3000);
      setTimeout(applyBlocking, 6000);
    } catch (err) {
      logError('annoyance blocker init error:', err);
    }
  }

  // ============================================
  // BLOCKING
  // ============================================
  function applyBlocking() {
    if (!enabled) return;

    for (const selector of ALL_ANNOYANCE_SELECTORS) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (!el.hasAttribute('data-websuddhi-annoyance-blocked') && isVisible(el)) {
            hideElement(el);
          }
        }
      } catch (e) {}
    }
  }

  function hideElement(el) {
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.style.setProperty('position', 'absolute', 'important');
    el.style.setProperty('z-index', '-9999', 'important');
    el.setAttribute('data-websuddhi-annoyance-blocked', 'true');
  }

  function isVisible(el) {
    if (!el) return false;
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    } catch (e) {
      return true; // Default to visible for safety
    }
  }

  // ============================================
  // MUTATION OBSERVER
  // ============================================
  function setupObserver() {
    if (!document.body || observer) return;

    let timeout = null;
    observer = new MutationObserver((mutations) => {
      if (!enabled) return;

      let hasNewNodes = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          hasNewNodes = true;
          break;
        }
      }
      if (!hasNewNodes) return;

      clearTimeout(timeout);
      timeout = setTimeout(applyBlocking, 200);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // ============================================
  // STORAGE
  // ============================================
  function getStorage(keys) {
    return new Promise((resolve, reject) => {
      if (typeof browser !== 'undefined' && browser.storage) {
        browser.storage.local.get(keys).then(resolve).catch(reject);
        return;
      }
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(keys, (result) => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve(result);
        });
        return;
      }
      resolve({});
    });
  }

  // ============================================
  // MESSAGE LISTENER
  // ============================================
  function setupMessageListener() {
    const handler = (message, sender, sendResponse) => {
      if (message.type === 'TOGGLE_ANNOYANCE_BLOCKING') {
        enabled = message.enabled;
        if (enabled) {
          applyBlocking();
        }
        sendResponse({ success: true });
      }
      return false;
    };

    if (typeof browser !== 'undefined' && browser.runtime) {
      browser.runtime.onMessage.addListener(handler);
    } else if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener(handler);
    }
  }

  // ============================================
  // START
  // ============================================
  setupMessageListener();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
