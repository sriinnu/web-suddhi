// WebSuddhi - Cookie Consent Auto-Dismiss
// Phase 3: Detect and dismiss cookie consent banners
// Strategy: framework-first, button-text fallback, CSS-hide last resort

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

  // Check if we should run
  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

  let enabled = true;
  let attempts = 0;
  const MAX_ATTEMPTS = 6;
  const RETRY_DELAYS = [500, 1500, 3000, 5000, 8000, 12000]; // ~30 seconds total coverage for slow CMPs

  // ============================================
  // INITIALIZATION
  // ============================================
  async function init() {
    try {
      const storage = await getStorage(['cookieConsentEnabled', 'whitelistedSites']);
      enabled = storage.cookieConsentEnabled !== false;

      if (!enabled) return;

      // Check whitelist
      const hostname = window.location.hostname.replace(/^www\./, '');
      const whitelisted = (storage.whitelistedSites || []).some(site => {
        const normalized = site.replace(/^www\./, '');
        return hostname === normalized || hostname.endsWith('.' + normalized);
      });
      if (whitelisted) return;

      // Start dismissal attempts with retries
      attemptDismiss();
    } catch (err) {
      logError('cookie consent init error:', err);
    }
  }

  function attemptDismiss() {
    attempts++;
    if (attempts > MAX_ATTEMPTS) return;

    const dismissed = tryDismiss();

    if (!dismissed && attempts < MAX_ATTEMPTS) {
      const delay = RETRY_DELAYS[attempts - 1] || 5000;
      setTimeout(attemptDismiss, delay);
    }
  }

  // ============================================
  // MAIN DISMISS LOGIC
  // ============================================
  function tryDismiss() {
    // Try framework-specific handlers first
    if (tryOneTrust()) return true;
    if (tryCookiebot()) return true;
    if (tryTrustArc()) return true;
    if (tryQuantcast()) return true;
    if (tryDidomi()) return true;
    if (tryCookieYes()) return true;
    if (tryComplianz()) return true;
    if (tryOsano()) return true;
    if (tryCookieNotice()) return true;

    // Generic button text fallback
    if (tryGenericButtonDismiss()) return true;

    // CSS-hide last resort (only on later attempts)
    if (attempts >= 2 && tryCSSHide()) return true;

    return false;
  }

  // ============================================
  // FRAMEWORK-SPECIFIC HANDLERS
  // ============================================

  // OneTrust
  function tryOneTrust() {
    // Try reject button
    const rejectBtn = document.querySelector('#onetrust-reject-all-handler');
    if (rejectBtn && self.WebSuddhi.utils.isVisible(rejectBtn)) {
      rejectBtn.click();
      return true;
    }

    // Try API call via page world injection
    if (document.querySelector('#onetrust-consent-sdk')) {
      injectPageScript('if(window.OneTrust&&OneTrust.RejectAll)OneTrust.RejectAll();');
      return true;
    }

    return false;
  }

  // Cookiebot
  function tryCookiebot() {
    const declineBtn = document.querySelector('#CybotCookiebotDialogBodyButtonDecline');
    if (declineBtn && self.WebSuddhi.utils.isVisible(declineBtn)) {
      declineBtn.click();
      return true;
    }

    // Alternative selectors
    const altBtn = document.querySelector('[data-cookiebanner="reject_all"]') ||
                   document.querySelector('.CybotCookiebotDialogBodyButton[id*="Decline"]');
    if (altBtn && self.WebSuddhi.utils.isVisible(altBtn)) {
      altBtn.click();
      return true;
    }

    if (document.querySelector('#CybotCookiebotDialog')) {
      injectPageScript('if(window.Cookiebot&&Cookiebot.decline)Cookiebot.decline();');
      return true;
    }

    return false;
  }

  // TrustArc
  function tryTrustArc() {
    const requiredBtn = document.querySelector('#truste-consent-required') ||
                        document.querySelector('.truste-consent-required');
    if (requiredBtn && self.WebSuddhi.utils.isVisible(requiredBtn)) {
      requiredBtn.click();
      return true;
    }

    return false;
  }

  // Quantcast
  function tryQuantcast() {
    // Reject button is typically the last button in the summary
    const container = document.querySelector('.qc-cmp2-summary-buttons');
    if (container) {
      const buttons = container.querySelectorAll('button');
      const rejectBtn = buttons[buttons.length - 1];
      if (rejectBtn && self.WebSuddhi.utils.isVisible(rejectBtn)) {
        rejectBtn.click();
        return true;
      }
    }

    // Alternative: look for disagree button
    const disagreeBtn = document.querySelector('[class*="qc-cmp2"][class*="disagree"]') ||
                        document.querySelector('.qc-cmp-button[mode="secondary"]');
    if (disagreeBtn && self.WebSuddhi.utils.isVisible(disagreeBtn)) {
      disagreeBtn.click();
      return true;
    }

    return false;
  }

  // Didomi
  function tryDidomi() {
    const disagreeBtn = document.querySelector('#didomi-notice-disagree-button');
    if (disagreeBtn && self.WebSuddhi.utils.isVisible(disagreeBtn)) {
      disagreeBtn.click();
      return true;
    }

    if (document.querySelector('#didomi-host')) {
      injectPageScript('if(window.Didomi&&Didomi.setUserDisagreeToAll)Didomi.setUserDisagreeToAll();');
      return true;
    }

    return false;
  }

  // CookieYes
  function tryCookieYes() {
    const rejectBtn = document.querySelector('.cky-btn-reject');
    if (rejectBtn && self.WebSuddhi.utils.isVisible(rejectBtn)) {
      rejectBtn.click();
      return true;
    }

    return false;
  }

  // Complianz
  function tryComplianz() {
    const denyBtn = document.querySelector('.cmplz-deny');
    if (denyBtn && self.WebSuddhi.utils.isVisible(denyBtn)) {
      denyBtn.click();
      return true;
    }

    return false;
  }

  // Osano
  function tryOsano() {
    const denyBtn = document.querySelector('.osano-cm-deny');
    if (denyBtn && self.WebSuddhi.utils.isVisible(denyBtn)) {
      denyBtn.click();
      return true;
    }

    return false;
  }

  // Cookie Notice plugin
  function tryCookieNotice() {
    const rejectBtn = document.querySelector('#cookie-notice .cn-decline') ||
                      document.querySelector('.cookie-notice-container .cn-decline');
    if (rejectBtn && self.WebSuddhi.utils.isVisible(rejectBtn)) {
      rejectBtn.click();
      return true;
    }

    return false;
  }

  // ============================================
  // GENERIC BUTTON TEXT FALLBACK
  // ============================================
  function tryGenericButtonDismiss() {
    // Multi-language reject/decline patterns
    const rejectPatterns = [
      // English
      /^reject\s*(all)?$/i, /^decline\s*(all)?$/i, /^refuse\s*(all)?$/i,
      /^deny\s*(all)?$/i, /^necessary\s*only$/i, /^essentials?\s*only$/i,
      /^only\s*(necessary|essential|required)$/i, /^no\s*thanks?$/i,
      /^accept\s*necessary$/i, /^manage\s*preferences$/i,
      // German
      /^alle?\s*ablehnen$/i, /^ablehnen$/i, /^nur\s*notwendige$/i,
      /^nur\s*erforderliche$/i,
      // French
      /^tout\s*refuser$/i, /^refuser$/i, /^continuer\s*sans\s*accepter$/i,
      /^n[eé]cessaires?\s*uniquement$/i,
      // Spanish
      /^rechazar\s*(todo)?$/i, /^solo\s*necesarias$/i, /^denegar$/i,
      // Italian
      /^rifiuta\s*(tutto|tutti)?$/i, /^solo\s*necessari$/i,
      // Portuguese
      /^rejeitar\s*(tudo)?$/i, /^recusar$/i, /^apenas\s*necess[aá]rios$/i
    ];

    // Search buttons and links within cookie-related containers
    const containers = findConsentContainers();

    for (const container of containers) {
      const clickables = container.querySelectorAll('button, a[role="button"], [class*="btn"], input[type="button"]');

      for (const btn of clickables) {
        const text = (btn.textContent || btn.value || '').trim();
        if (!text || text.length > 50) continue;

        for (const pattern of rejectPatterns) {
          if (pattern.test(text)) {
            if (self.WebSuddhi.utils.isVisible(btn)) {
              btn.click();
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  function findConsentContainers() {
    const selectors = [
      '#onetrust-consent-sdk', '#CybotCookiebotDialog',
      '#didomi-host', '.qc-cmp-ui-container',
      '[class*="cookie-consent"]', '[class*="cookie-banner"]',
      '[class*="cookie-notice"]', '[class*="cookie-dialog"]',
      '[class*="cookie-popup"]', '[class*="cookie-modal"]',
      '[id*="cookie-consent"]', '[id*="cookie-banner"]',
      '[id*="cookie-notice"]', '[id*="cookiebanner"]',
      '[class*="gdpr"]', '[id*="gdpr"]',
      '[class*="consent-banner"]', '[class*="consent-dialog"]',
      '[class*="consent-modal"]', '[id*="consent-banner"]',
      '[class*="cc-banner"]', '[class*="cc-dialog"]',
      '.cc-window', '.cc-banner',
      '[role="dialog"][aria-label*="cookie" i]',
      '[role="dialog"][aria-label*="consent" i]',
      '[role="dialog"][aria-label*="privacy" i]'
    ];

    const containers = [];
    for (const sel of selectors) {
      try {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          if (self.WebSuddhi.utils.isVisible(el)) containers.push(el);
        }
      } catch (e) {}
    }

    return containers;
  }

  // ============================================
  // CSS HIDE LAST RESORT
  // ============================================
  function tryCSSHide() {
    const containers = findConsentContainers();
    let hidden = false;

    for (const container of containers) {
      if (container.offsetHeight > 50) {
        container.style.setProperty('display', 'none', 'important');
        container.setAttribute('data-websuddhi-cookie-hidden', 'true');
        hidden = true;
      }
    }

    // Restore body scroll if we hid something
    if (hidden) {
      document.body.style.overflow = '';
      document.body.style.overflowY = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.overflowY = '';
    }

    return hidden;
  }

  // ============================================
  // UTILITIES
  // ============================================

  function injectPageScript(code) {
    try {
      const script = document.createElement('script');
      script.textContent = code;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (e) {}
  }

  function getStorage(keys) {
    return self.WebSuddhi.utils.getStorage(keys);
  }

  // ============================================
  // MESSAGE LISTENER
  // ============================================
  function setupMessageListener() {
    const handler = (message, sender, sendResponse) => {
      if (message.type === 'TOGGLE_COOKIE_CONSENT') {
        enabled = message.enabled;
        sendResponse({ success: true });
      } else if (message.type === 'DISMISS_COOKIES_NOW') {
        attempts = 0;
        const dismissed = tryDismiss();
        sendResponse({ success: true, dismissed });
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

  if (document.readyState === 'loading' || document.readyState === 'interactive') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 100));
  } else {
    setTimeout(init, 100);
  }
})();
