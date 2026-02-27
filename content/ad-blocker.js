// WebSuddhi - Main Ad Blocker Content Script
// Universal: Chrome, Edge, Firefox, Safari
// Cross-platform: Windows, macOS, Linux, iOS

(function() {
  'use strict';

  // Debug log
  const log = (...args) => console.log('[WebSuddhi]', ...args);

  // Logging helpers (use utils if available, fallback to console)
  const logError = (...args) => {
    if (self.WebSuddhi && self.WebSuddhi.utils && self.WebSuddhi.utils.error) {
      self.WebSuddhi.utils.error(...args);
    } else {
      console.error('[WebSuddhi]', ...args);
    }
  };

  function isTopFrame() {
    try {
      return window.top === window;
    } catch (e) {
      return false;
    }
  }

  function isHttpOrHttpsPage() {
    const protocol = window.location.protocol;
    return protocol === 'http:' || protocol === 'https:';
  }

  function pageContainsPasswordField() {
    try {
      return Boolean(document.querySelector('input[type="password"]'));
    } catch (e) {
      return false;
    }
  }

  function shouldRunAggressiveAntiAdblock(storage) {
    if (storage?.aggressiveAntiAdblockEnabled !== true) return false;
    if (!isTopFrame() || !isHttpOrHttpsPage()) return false;

    const hostname = (window.location.hostname || '').toLowerCase();
    const pathname = (window.location.pathname || '').toLowerCase();
    const sensitivePattern = /(bank|pay|secure|login|account)/i;
    if (sensitivePattern.test(hostname) || sensitivePattern.test(pathname)) {
      return false;
    }

    return !pageContainsPasswordField();
  }

  // ============================================
  // PHISHING PROTECTION - Check early before page renders
  // ============================================

  // Check for phishing immediately on script load
  (async function checkForPhishing() {
    if (!isTopFrame() || !isHttpOrHttpsPage()) return;

    const hostname = window.location.hostname;
    if (!hostname) return;

    try {
      const response = await sendMessageEarly({ type: 'CHECK_PHISHING', domain: hostname });

      if (response?.isSuspicious) {
        showPhishingWarning(response);
      }
    } catch (e) {
      // Silently fail - phishing check is non-critical
    }
  })();

  // Early message sending function (before full init)
  function sendMessageEarly(message) {
    return new Promise((resolve, reject) => {
      if (typeof browser !== 'undefined' && browser.runtime) {
        browser.runtime.sendMessage(message).then(resolve).catch(reject);
      } else if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve(response);
        });
      } else {
        reject(new Error('No messaging API available'));
      }
    });
  }

  // Escape HTML to prevent XSS
  function escapeHtmlPhishing(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.textContent;  // Return textContent, not innerHTML
  }

  // Highlight suspicious characters (homoglyphs) in domain
  function highlightSuspiciousChars(domain) {
    if (!domain) return '';

    // Common homoglyph mappings (suspicious char -> normal char it mimics)
    const homoglyphs = {
      '0': 'o', 'О': 'O', 'о': 'o', // Cyrillic O
      '1': 'l', 'І': 'I', 'і': 'i', // Cyrillic I
      'а': 'a', 'А': 'A', // Cyrillic A
      'е': 'e', 'Е': 'E', // Cyrillic E
      'р': 'p', 'Р': 'P', // Cyrillic P
      'с': 'c', 'С': 'C', // Cyrillic C
      'у': 'y', 'У': 'Y', // Cyrillic Y
      'х': 'x', 'Х': 'X', // Cyrillic X
      'ѕ': 's', 'Ѕ': 'S', // Cyrillic S
      'ј': 'j', 'Ј': 'J', // Cyrillic J
      'ԁ': 'd', // Cyrillic D
      'ɡ': 'g', // Latin small letter script G
      'ո': 'n', // Armenian N
      'ɑ': 'a', // Latin alpha
      'ß': 'ss', // German eszett
      'ı': 'i', // Dotless I
      'ｇ': 'g', 'ｏ': 'o', 'ｌ': 'l', 'ｅ': 'e', // Fullwidth chars
      'ⅰ': 'i', 'ⅼ': 'l', // Roman numerals
      'ɴ': 'n', 'ᴍ': 'm', 'ᴀ': 'a', // Small caps
      'ⓐ': 'a', 'ⓑ': 'b', 'ⓒ': 'c', 'ⓓ': 'd', 'ⓔ': 'e', // Circled letters
      'ⓕ': 'f', 'ⓖ': 'g', 'ⓗ': 'h', 'ⓘ': 'i', 'ⓙ': 'j',
      'ⓚ': 'k', 'ⓛ': 'l', 'ⓜ': 'm', 'ⓝ': 'n', 'ⓞ': 'o',
      'ⓟ': 'p', 'ⓠ': 'q', 'ⓡ': 'r', 'ⓢ': 's', 'ⓣ': 't',
      'ⓤ': 'u', 'ⓥ': 'v', 'ⓦ': 'w', 'ⓧ': 'x', 'ⓨ': 'y', 'ⓩ': 'z',
      'rn': 'm' // Common trick: rn looks like m
    };

    let result = '';
    for (let i = 0; i < domain.length; i++) {
      const char = domain[i];
      if (homoglyphs[char]) {
        result += '<span class="websuddhi-suspicious-char">' + escapeHtmlPhishing(char) + '</span>';
      } else if (char.charCodeAt(0) > 127) {
        // Non-ASCII character - potentially suspicious
        result += '<span class="websuddhi-suspicious-char">' + escapeHtmlPhishing(char) + '</span>';
      } else {
        result += escapeHtmlPhishing(char);
      }
    }
    return result;
  }

  // Show full-page phishing warning overlay
  function showPhishingWarning(data) {
    // Check if user already dismissed warning for this domain in this session
    try {
      if (sessionStorage.getItem('websuddhi_phishing_dismissed_' + data.originalDomain) === 'true') {
        return; // Don't show warning again
      }
    } catch (e) {
      // Session storage might not be available
    }

    // Normalize data fields (phishing detector uses matchedDomain, we want realDomain for display)
    const realDomain = data.realDomain || data.matchedDomain || 'unknown';
    const matchedBrand = data.matchedBrand || 'Unknown';
    const originalDomain = data.originalDomain || window.location.hostname;
    const riskLevel = (data.riskLevel || '').toString().toLowerCase();
    const isHighRisk = riskLevel === 'high';
    const proceedCooldownSeconds = isHighRisk ? 10 : 5;

    // Create full-page overlay
    const overlay = document.createElement('div');
    overlay.className = 'websuddhi-phishing-overlay';
    overlay.id = 'websuddhi-phishing-overlay';

    // Build overlay using safe DOM methods (no innerHTML with user data)
    const modal = document.createElement('div');
    modal.className = 'websuddhi-phishing-modal';

    // Icon
    const iconDiv = document.createElement('div');
    iconDiv.className = 'websuddhi-phishing-icon';
    const warnSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    warnSvg.setAttribute('viewBox', '0 0 24 24');
    warnSvg.setAttribute('fill', 'currentColor');
    const warnPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    warnPath.setAttribute('d', 'M12 2L1 21h22L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z');
    warnSvg.appendChild(warnPath);
    iconDiv.appendChild(warnSvg);
    modal.appendChild(iconDiv);

    // Title
    const title = document.createElement('h1');
    title.className = 'websuddhi-phishing-title';
    title.textContent = 'Warning: Suspicious Website';
    modal.appendChild(title);

    // Alert section
    const alertDiv = document.createElement('div');
    alertDiv.className = 'websuddhi-phishing-alert';
    const alertP = document.createElement('p');
    alertP.appendChild(document.createTextNode('This website '));
    const strong = document.createElement('strong');
    strong.textContent = originalDomain;
    alertP.appendChild(strong);
    alertP.appendChild(document.createTextNode(" looks like it's trying to impersonate:"));
    alertDiv.appendChild(alertP);
    const brandDiv = document.createElement('div');
    brandDiv.className = 'websuddhi-phishing-brand';
    brandDiv.textContent = matchedBrand;
    alertDiv.appendChild(brandDiv);
    modal.appendChild(alertDiv);

    // Comparison section
    const compDiv = document.createElement('div');
    compDiv.className = 'websuddhi-phishing-comparison';

    const fakeDiv = document.createElement('div');
    fakeDiv.className = 'websuddhi-domain-fake';
    const fakeLabel = document.createElement('span');
    fakeLabel.className = 'websuddhi-domain-label';
    fakeLabel.textContent = "You're visiting:";
    fakeDiv.appendChild(fakeLabel);
    const fakeValue = document.createElement('span');
    fakeValue.className = 'websuddhi-domain-value';
    fakeValue.textContent = originalDomain;
    fakeDiv.appendChild(fakeValue);
    compDiv.appendChild(fakeDiv);

    const realDiv = document.createElement('div');
    realDiv.className = 'websuddhi-domain-real';
    const realLabel = document.createElement('span');
    realLabel.className = 'websuddhi-domain-label';
    realLabel.textContent = 'Real website:';
    realDiv.appendChild(realLabel);
    const realValue = document.createElement('span');
    realValue.className = 'websuddhi-domain-value';
    realValue.textContent = realDomain;
    realDiv.appendChild(realValue);
    compDiv.appendChild(realDiv);
    modal.appendChild(compDiv);

    // Info section
    const infoDiv = document.createElement('div');
    infoDiv.className = 'websuddhi-phishing-info';
    const infoP = document.createElement('p');
    infoP.textContent = 'This could be a phishing attempt to steal your:';
    infoDiv.appendChild(infoP);
    const infoUl = document.createElement('ul');
    ['Passwords and login credentials', 'Credit card information', 'Personal data'].forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      infoUl.appendChild(li);
    });
    infoDiv.appendChild(infoUl);
    modal.appendChild(infoDiv);

    // Action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'websuddhi-phishing-actions';

    const goBackBtn = document.createElement('button');
    goBackBtn.className = 'websuddhi-btn-safe';
    goBackBtn.id = 'websuddhiGoBack';
    const goBackSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    goBackSvg.setAttribute('width', '16');
    goBackSvg.setAttribute('height', '16');
    goBackSvg.setAttribute('viewBox', '0 0 24 24');
    goBackSvg.setAttribute('fill', 'none');
    goBackSvg.setAttribute('stroke', 'currentColor');
    goBackSvg.setAttribute('stroke-width', '2');
    const goBackPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    goBackPath.setAttribute('d', 'M19 12H5M12 19l-7-7 7-7');
    goBackSvg.appendChild(goBackPath);
    goBackBtn.appendChild(goBackSvg);
    goBackBtn.appendChild(document.createTextNode(' Go Back to Safety'));
    actionsDiv.appendChild(goBackBtn);

    const reportBtn = document.createElement('button');
    reportBtn.className = 'websuddhi-btn-report';
    reportBtn.id = 'websuddhiReport';
    const reportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    reportSvg.setAttribute('width', '16');
    reportSvg.setAttribute('height', '16');
    reportSvg.setAttribute('viewBox', '0 0 24 24');
    reportSvg.setAttribute('fill', 'none');
    reportSvg.setAttribute('stroke', 'currentColor');
    reportSvg.setAttribute('stroke-width', '2');
    const reportPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    reportPath.setAttribute('d', 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z');
    reportSvg.appendChild(reportPath);
    const reportLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    reportLine.setAttribute('x1', '4'); reportLine.setAttribute('y1', '22');
    reportLine.setAttribute('x2', '4'); reportLine.setAttribute('y2', '15');
    reportSvg.appendChild(reportLine);
    reportBtn.appendChild(reportSvg);
    reportBtn.appendChild(document.createTextNode(' Report This Site'));
    actionsDiv.appendChild(reportBtn);
    modal.appendChild(actionsDiv);

    // Advanced - proceed anyway
    const details = document.createElement('details');
    details.className = 'websuddhi-phishing-advanced';
    const summary = document.createElement('summary');
    summary.textContent = 'I understand the risk, proceed anyway';
    details.appendChild(summary);
    const advWarning = document.createElement('p');
    advWarning.className = 'websuddhi-phishing-advanced-warning';
    advWarning.textContent = 'Only proceed if you are absolutely certain this is safe. This site may attempt to steal your personal information.';
    details.appendChild(advWarning);
    const proceedBtn = document.createElement('button');
    proceedBtn.className = 'websuddhi-btn-danger';
    proceedBtn.id = 'websuddhiProceed';
    const proceedBaseText = 'Proceed to ' + originalDomain;
    proceedBtn.textContent = proceedBaseText;
    proceedBtn.disabled = true;
    proceedBtn.setAttribute('aria-disabled', 'true');
    proceedBtn.style.opacity = '0.6';
    details.appendChild(proceedBtn);

    const proceedHint = document.createElement('p');
    proceedHint.className = 'websuddhi-phishing-advanced-warning';
    proceedHint.textContent = isHighRisk
      ? 'High risk: wait 10 seconds, then type the full domain to proceed.'
      : 'Please wait 5 seconds before proceeding.';
    details.appendChild(proceedHint);

    let domainConfirmInput = null;
    let domainConfirmed = !isHighRisk;

    if (isHighRisk) {
      const confirmLabel = document.createElement('label');
      confirmLabel.className = 'websuddhi-phishing-advanced-warning';
      confirmLabel.textContent = 'Type "' + originalDomain + '" to confirm you want to continue:';
      details.appendChild(confirmLabel);

      domainConfirmInput = document.createElement('input');
      domainConfirmInput.type = 'text';
      domainConfirmInput.autocomplete = 'off';
      domainConfirmInput.spellcheck = false;
      domainConfirmInput.placeholder = originalDomain;
      domainConfirmInput.setAttribute('aria-label', 'Type domain to confirm proceeding');
      details.appendChild(domainConfirmInput);
    }
    modal.appendChild(details);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'websuddhi-phishing-footer';
    const footerSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    footerSvg.setAttribute('width', '14');
    footerSvg.setAttribute('height', '14');
    footerSvg.setAttribute('viewBox', '0 0 24 24');
    footerSvg.setAttribute('fill', 'currentColor');
    const footerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    footerPath.setAttribute('d', 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v5.7c0 4.83-3.4 9.36-7 10.36-3.6-1-7-5.53-7-10.36V6.3l7-3.12zM11 7v6h2V7h-2zm0 8v2h2v-2h-2z');
    footerSvg.appendChild(footerPath);
    footer.appendChild(footerSvg);
    footer.appendChild(document.createTextNode(' Protected by WebSuddhi'));
    modal.appendChild(footer);

    overlay.appendChild(modal);

    // Insert at very beginning of document
    if (document.documentElement) {
      document.documentElement.insertBefore(overlay, document.documentElement.firstChild);
    } else {
      document.appendChild(overlay);
    }

    // Hide original page content
    if (document.body) {
      document.body.style.setProperty('display', 'none', 'important');
    }

    // Also hide content if body loads later
    const bodyObserver = new MutationObserver(() => {
      if (document.body && !document.body.hasAttribute('data-websuddhi-phishing-hidden')) {
        document.body.setAttribute('data-websuddhi-phishing-hidden', 'true');
        document.body.style.setProperty('display', 'none', 'important');
      }
    });
    bodyObserver.observe(document.documentElement, { childList: true, subtree: true });

    let cooldownRemaining = proceedCooldownSeconds;
    const updateProceedButtonState = () => {
      const cooldownDone = cooldownRemaining <= 0;
      const canProceed = cooldownDone && domainConfirmed;
      proceedBtn.disabled = !canProceed;
      proceedBtn.style.opacity = canProceed ? '1' : '0.6';
      proceedBtn.setAttribute('aria-disabled', canProceed ? 'false' : 'true');
      proceedBtn.textContent = cooldownDone
        ? proceedBaseText
        : (proceedBaseText + ' (' + cooldownRemaining + 's)');
    };
    updateProceedButtonState();

    const cooldownTimer = setInterval(() => {
      cooldownRemaining -= 1;
      updateProceedButtonState();
      if (cooldownRemaining <= 0) {
        clearInterval(cooldownTimer);
      }
    }, 1000);

    if (domainConfirmInput) {
      const expectedDomain = originalDomain.trim().toLowerCase();
      domainConfirmInput.addEventListener('input', () => {
        domainConfirmed = domainConfirmInput.value.trim().toLowerCase() === expectedDomain;
        updateProceedButtonState();
      });
    }

    // Event handlers
    goBackBtn.onclick = () => {
      clearInterval(cooldownTimer);
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'about:blank';
      }
    };

    reportBtn.onclick = () => {
      reportPhishing(data);
      reportBtn.textContent = 'Thank you for reporting!';
      reportBtn.disabled = true;
      reportBtn.style.opacity = '0.7';
    };

    proceedBtn.onclick = () => {
      if (proceedBtn.disabled) return;
      clearInterval(cooldownTimer);
      dismissPhishingWarning(overlay, bodyObserver, originalDomain);
    };
  }

  // Dismiss the phishing warning and show the page
  function dismissPhishingWarning(overlay, observer, domain) {
    // Stop the observer
    if (observer) {
      observer.disconnect();
    }

    // Remove the overlay
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }

    // Restore body display
    if (document.body) {
      document.body.style.removeProperty('display');
      document.body.removeAttribute('data-websuddhi-phishing-hidden');
    }

    // Store in session that user dismissed for this domain
    try {
      sessionStorage.setItem('websuddhi_phishing_dismissed_' + domain, 'true');
    } catch (e) {
      // Session storage might not be available
    }

    // Stop icon blinking in background
    try {
      sendMessageEarly({ type: 'STOP_PHISHING_ALERT' }).catch(() => {});
    } catch (e) {
      // Silently fail
    }
  }

  // Report phishing site to background
  function reportPhishing(data) {
    try {
      sendMessageEarly({
        type: 'REPORT_PHISHING',
        domain: data.originalDomain,
        matchedBrand: data.matchedBrand,
        realDomain: data.realDomain,
        timestamp: Date.now()
      }).catch(() => {
        // Silently fail
      });
    } catch (e) {
      // Silently fail
    }
  }

  // ============================================
  // CONFIGURATION - All Common Ad Patterns
  // ============================================
  const AD_SELECTORS = {
    // Generic ad containers
    common: [
      '[class*="ad-"]', '[class*="ads-"]', '[class*="advert"]',
      '[id*="ad-"]', '[id*="ads-"]', '[id*="advert"]',
      '[data-ad]', '[data-ads]', '[data-advertisement]',
      '[data-ad-width]', '[data-ad-height]',
      '[data-google-query-id]', '[data-slot]',
      '[data-adsbygoogle]', '[data-ad-client]',
      '.ad', '.ads', '.ad-container', '.ads-container',
      '.ad-wrapper', '.ads-wrapper', '.ad-unit', '.ads-unit',
      '.ad-box', '.ads-box', '.ad-slot', '.ads-slot',
      '.ad-placement', '.ads-placement', '.ad-banner', '.ads-banner',
      '.advertisement', '.advertisements', '.advertising',
      '[class*="advertisement"]', '[class*="advertising"]',
      // IAB standard ad sizes containers
      '.leaderboard', '.skyscraper', '.rectangle', '.billboard',
      '.medrect', '.mpu', '.halfpage', '.sponsor'
    ],

    // Ad networks
    networks: [
      '.adsbygoogle', '.google-ad', '.googleAds',
      '[id*="google_ads"]', '[class*="google_ads"]',
      '#google_ads', '.dfp-ad', '.dfp-slot',
      '.criteo', '[class*="criteo"]',
      '.taboola', '[class*="taboola"]',
      '.outbrain', '[class*="outbrain"]',
      '.mgid', '[class*="mgid"]',
      '.adroll', '[class*="adroll"]',
      '.zemanta', '[class*="zemanta"]',
      '.revcontent', '[class*="revcontent"]',
      '.amazon-ads', '.amazon-ad',
      '.doubleclick', '[class*="doubleclick"]',
      '.googlesyndication', '[class*="googlesyndication"]',
      '.adform', '[class*="adform"]',
      '.pubmatic', '[class*="pubmatic"]',
      '.openx', '[class*="openx"]',
      '.rubicon', '[class*="rubicon"]',
      '.indexww', '[class*="indexww"]',
      '.casale', '[class*="casale"]',
      '.adtech', '[class*="adtech"]',
      '.bidswitch', '[class*="bidswitch"]',
      '.mediavine', '[class*="mediavine"]',
      '.adthrive', '[class*="adthrive"]',
      '.ezoic', '[class*="ezoic"]',
      '.monetizer101', '[class*="monetizer101"]',
      '.adsterra', '[class*="adsterra"]',
      '.exoclick', '[class*="exoclick"]',
      '.propellerads', '[class*="propellerads"]',
      '.popads', '[class*="popads"]',
      '.adspynetwork', '[class*="adspynetwork"]',
      '.trafficshop', '[class*="trafficshop"]',
      '.trafficjunky', '[class*="trafficjunky"]',
      // Pop under networks
      '[class*="popunder"]', '[class*="popup-ad"]',
      '[class*="modal-ad"]', '[class*="interstitial"]'
    ],

    // Banner positions
    banners: [
      '.top-ad', '.bottom-ad', '.sidebar-ad', '.header-ad', '.footer-ad',
      '[class*="top-ad"]', '[class*="bottom-ad"]', '[class*="sidebar-ad"]',
      '[class*="header-ad"]', '[class*="footer-ad"]', '[class*="leaderboard-ad"]',
      '#top-banner-ad', '#bottom-banner-ad', '#sidebar-banner-ad',
      '.banner-ad', '.banner_ads', '.banners-ad',
      '[class*="banner-ad"]', '[class*="banner_ads"]',
      // Sticky ads
      '[class*="sticky-ad"]', '[class*="sticky-ads"]',
      '[class*="fixed-ad"]', '[class*="fixed-ads"]',
      '[class*="floating-ad"]', '[class*="floating-ads"]'
    ],

    // Video ads
    video: [
      '.video-ad', '.video-ads', '.preroll-ad', '.preroll-ads',
      '.midroll-ad', '.midroll-ads', '.postroll-ad', '.postroll-ads',
      '[class*="video-ad"]', '[class*="preroll"]', '[class*="midroll"]',
      '[class*="postroll"]', '[class*="video-ads"]',
      '.ima-ad-container', '.ad-container-video',
      // YouTube specific
      '.ytp-ad-image', '.ytp-ad-text', '.ytp-ad-overlay',
      '.ytd-ad-slot-renderer', '.ytd-promoted-sparkles-web-renderer',
      'ytd-display-ad-renderer', 'ytd-promoted-video-renderer',
      '.ytp-ad-module', '.ytp-ad-player-overlay'
    ],

    // Social / Promoted
    social: [
      '.promoted', '.promoted-content', '.sponsored', '.sponsored-content',
      '[class*="sponsored"]', '[class*="promoted"]', '[class*="promoted-content"]',
      '.social-ad', '.social-ads', '[class*="social-ad"]',
      '.facebook-ad', '[class*="facebook-ad"]',
      // Native ads
      '.native-ad', '.native-ads', '[class*="native-ad"]',
      '.in-feed-ad', '[class*="in-feed"]'
    ],

    // Cookie notices (often annoying)
    notices: [
      '.cookie-notice', '.cookie-banner', '.cookie-consent',
      '.cookie-popup', '.cookie-modal', '.cookie-dialog',
      '.gdpr-banner', '.gdpr-notice', '.gdpr-modal',
      '.cc-banner', '.cc-dialog', '.cc-window',
      '[class*="cookie-"][class*="banner"]',
      '[class*="cookie-"][class*="notice"]',
      '[class*="cookie-"][class*="consent"]',
      '[class*="gdpr-"]', '[class*="cookiebanner"]',
      '[id*="cookiebanner"]', '[id*="gdpr"]',
      '.privacy-banner', '.privacy-notice', '[class*="privacy-banner"]',
      '#cookie-consent', '#cookie-banner', '#gdpr-banner',
      // Newsletter popups
      '.newsletter-popup', '.email-popup', '.subscribe-popup',
      '[class*="newsletter-popup"]', '[class*="email-popup"]',
      '[class*="subscribe-popup"]', '[class*="optin-popup"]',
      // Other annoying overlays
      '.exit-intent', '[class*="exit-intent"]',
      '.subscription-popup', '[class*="subscription-popup"]'
    ],

    // Mobile specific
    mobile: [
      '[class*="mobile-ad"]', '[class*="mobile-banner"]',
      '.mobile-ad-container', '.m-ad-container',
      // App install ads
      '[class*="app-install"]', '[class*="install-app"]',
      '[class*="get-app"]', '[class*="download-app"]',
      // Smart banners
      '.smartbanner', '[class*="smart-banner"]'
    ],

    // Paywall / Subscribe overlays
    paywall: [
      // Generic paywall selectors
      '[class*="paywall"]', '[id*="paywall"]',
      '[class*="subscribe-wall"]', '[id*="subscribe-wall"]',
      '[class*="subscription-wall"]', '[id*="subscription-wall"]',
      '[class*="metered"]', '[id*="metered"]',
      '[class*="content-gate"]', '[id*="content-gate"]',
      '[class*="article-gate"]', '[id*="article-gate"]',
      '[class*="locked-content"]', '[id*="locked-content"]',
      '[class*="premium-wall"]', '[id*="premium-wall"]',
      // Common paywall services
      '.piano-offer', '[class*="piano-offer"]',
      '.tp-modal', '.tp-backdrop', '.tp-iframe-wrapper',
      '.poool-widget', '[class*="poool"]',
      '.tinypass', '[class*="tinypass"]',
      '[class*="membership-gate"]', '[class*="member-wall"]',
      // Specific sites
      '.nytimes-paywall', '.wsj-paywall',
      '.washingtonpost-paywall', '.ft-paywall',
      '.economist-paywall', '.hbr-paywall',
      '.bloomberg-paywall', '.medium-paywall',
      // Generic overlay containers
      '.overlay-paywall', '.overlay-subscribe',
      '[class*="paywall-overlay"]', '[class*="subscribe-overlay"]',
      // Blur / Content cutoff
      '[class*="blur-content"]', '[class*="blurred-content"]',
      // Sign in / Register overlays
      '[class*="signin-overlay"]', '[class*="login-overlay"]',
      '[class*="registration-overlay"]', '[class*="register-overlay"]'
    ]
  };

  // Flatten all selectors
  const AD_ONLY_KEYS = ['common', 'networks', 'banners', 'video', 'social', 'notices', 'mobile'];
  const ALL_SELECTORS = AD_ONLY_KEYS.flatMap(key => AD_SELECTORS[key] || []);

  // Elements with ad attributes
  const AD_TAGS = [
    { tag: 'ins', attrs: ['adsbygoogle', 'data-ad-client', 'data-ad-slot', 'data-ad-channel'] },
    { tag: 'iframe', attrs: ['ads', 'ad', 'doubleclick', 'googlesyndication', 'banner', 'slot'] },
    { tag: 'script', attrs: ['adsbygoogle', 'doubleclick', 'googletag', 'adservice', 'adroll'] },
    { tag: 'amp-ad', attrs: [] },
    { tag: 'amp-embed', attrs: [] },
    { tag: 'm-ad', attrs: [] },
    { tag: 'amp-auto-ads', attrs: [] }
  ];

  // Anti-adblock detection selectors
  const ANTI_ADBLOCK_SELECTORS = [
    '[class*="anti-adblock"]', '[id*="anti-adblock"]',
    '[class*="adblock-detect"]', '[id*="adblock-detect"]',
    '[class*="ad-blocker-detected"]', '[id*="ad-blocker-detected"]',
    '[class*="disable-adblock"]', '[id*="disable-adblock"]',
    '[class*="adb-detected"]', '[id*="adb-detected"]',
    '[class*="adblock-notice"]', '[id*="adblock-notice"]',
    '[class*="adblock-warning"]', '[id*="adblock-warning"]',
    '[class*="blocker-detected"]', '[id*="blocker-detected"]',
    // Additional anti-adblock overlays
    '.adblock-modal', '#adblock-modal',
    '.adblock-overlay', '#adblock-overlay',
    '.adb-modal', '#adb-modal',
    '.adb-overlay', '#adb-overlay',
    '[class*="adblock-message"]', '[id*="adblock-message"]',
    '[class*="adblocker-warning"]', '[id*="adblocker-warning"]',
    '[class*="adblock-popup"]', '[id*="adblock-popup"]',
    // BlockAdBlock / FuckAdBlock specific
    '.blockadblock', '#blockadblock',
    '.fuckadblock', '#fuckadblock',
    '[class*="blockadblock"]', '[id*="blockadblock"]',
    '[class*="fuckadblock"]', '[id*="fuckadblock"]',
    // Admiral specific
    '[class*="admiral"]', '[id*="admiral"]',
    '.admiral-adblock', '#admiral-adblock',
    // Generic detection overlays
    '.ad-block-notice', '#ad-block-notice',
    '.ad-blocker-modal', '#ad-blocker-modal',
    '.please-disable-adblock', '#please-disable-adblock',
    '[class*="turn-off-adblock"]', '[id*="turn-off-adblock"]',
    '[class*="whitelist-us"]', '[id*="whitelist-us"]'
  ];

  // Social media widget selectors
  const SOCIAL_WIDGET_SELECTORS = [
    // Facebook
    'iframe[src*="facebook.com/plugins"]',
    'iframe[src*="facebook.com/v"]',
    '.fb-like', '.fb-share-button', '.fb-share', '.fb-comments',
    '.fb-page', '.fb-video', '.fb-post', '.fb-follow',
    '[data-href*="facebook.com"]',
    '[class*="facebook-share"]', '[class*="fb-share"]',
    // Twitter/X
    'iframe[src*="platform.twitter.com"]',
    'iframe[src*="twitter.com/widgets"]',
    '.twitter-tweet', '.twitter-share-button', '.twitter-follow-button',
    '.twitter-timeline', '.twitter-mention-button',
    '[class*="twitter-share"]', '[class*="tweet-button"]',
    'blockquote.twitter-tweet',
    // LinkedIn
    'iframe[src*="linkedin.com"]',
    '.linkedin-share', '.IN-widget',
    '[class*="linkedin-share"]', '[class*="linkedin-button"]',
    '[data-href*="linkedin.com"]',
    // Pinterest
    'iframe[src*="pinterest.com"]',
    '.pin-it-button', '.pinterest-button',
    '[class*="pinterest-share"]', '[class*="pin-it"]',
    '[data-pin-do]',
    // Instagram
    'iframe[src*="instagram.com/embed"]',
    'iframe[src*="instagram.com/p/"]',
    '.instagram-media', '[class*="instagram-embed"]',
    'blockquote.instagram-media',
    // TikTok
    'iframe[src*="tiktok.com/embed"]',
    'iframe[src*="tiktok.com/"]',
    '.tiktok-embed', '[class*="tiktok-embed"]',
    'blockquote.tiktok-embed',
    // Reddit
    'iframe[src*="reddit.com/"]',
    'iframe[src*="redditmedia.com"]',
    '.reddit-embed', '.reddit-card',
    '[class*="reddit-share"]',
    // YouTube embeds (social sharing aspect)
    '[class*="youtube-subscribe"]',
    // General social share patterns
    '[class*="social-share"]', '[class*="share-buttons"]',
    '[class*="social-buttons"]', '[class*="share-icons"]',
    '[class*="social-icons"]', '[class*="share-widget"]',
    '[class*="social-widget"]', '[class*="sharing-buttons"]',
    '[id*="social-share"]', '[id*="share-buttons"]',
    '[id*="social-buttons"]', '[id*="share-icons"]',
    // AddThis, ShareThis, etc.
    '.addthis_toolbox', '.addthis_sharing_toolbox',
    '[class*="addthis"]', '.sharethis-inline-share-buttons',
    '[class*="sharethis"]', '.st-btn',
    // Social login buttons
    '[class*="social-login"]', '[class*="social-signin"]'
  ];

  // ============================================
  // STATE
  // ============================================
  let state = {
    enabled: true,
    paywallEnabled: true,
    socialBlockingEnabled: false,
    cookieConsentEnabled: false,
    annoyancesEnabled: false,
    whitelistedSites: [],
    blockedSelectors: new Map(),
    pickMode: false,
    pickModeShiftHeld: false,
    pickModeCtrlHeld: false,
    pickDialogOpen: false,
    zapMode: false,
    hoveredElement: null,
    observer: null,
    observerTimeout: null,
    blockedCount: 0,
    bodyOverflowOriginal: null,
    toastDuration: 3
  };

  // Get current hostname
  function getCurrentHostname() {
    try {
      return window.location.hostname.replace(/^www\./, '');
    } catch (e) {
      return '';
    }
  }

  // Check if current site is whitelisted
  function isSiteWhitelisted() {
    const hostname = getCurrentHostname();
    if (!hostname) return false;

    return state.whitelistedSites.some(site => {
      const normalized = site.replace(/^www\./, '');
      return hostname === normalized || hostname.endsWith('.' + normalized);
    });
  }

  // ============================================
  // INITIALIZATION
  // ============================================
  async function init() {
    try {
      // Load settings
      const storage = await getStorage();
      state.enabled = storage.enabled !== false;
      state.paywallEnabled = storage.paywallEnabled !== false;
      state.socialBlockingEnabled = storage.socialBlockingEnabled === true;
      state.cookieConsentEnabled = storage.cookieConsentEnabled === true;
      state.annoyancesEnabled = storage.annoyancesEnabled === true;
      state.whitelistedSites = storage.whitelistedSites || [];
      state.toastDuration = storage.toastDuration || 3;
      state.blockedSelectors = new Map();
      for (const entry of (storage.blockedSelectors || [])) {
        if (Array.isArray(entry)) {
          state.blockedSelectors.set(entry[0], entry[1]);
        } else if (entry && entry.selector) {
          state.blockedSelectors.set(entry.selector, { url: entry.hostname, date: entry.date });
        }
      }

      // Skip blocking if site is whitelisted
      if (isSiteWhitelisted()) {
        state.enabled = false;
      }

      // Setup anti-anti-adblock EARLY (only when explicitly enabled and safe to run)
      if (state.enabled && shouldRunAggressiveAntiAdblock(storage)) {
        setupAntiAntiAdblock();
      }

      if (state.enabled) {
        applyBlocking();
        removePingAttributes();
      }

      // Apply social widget blocking if enabled
      if (state.socialBlockingEnabled && !isSiteWhitelisted()) {
        applySocialBlocking();
      }

      // Auto-detect and remove paywalls (only if not whitelisted)
      if (state.paywallEnabled && !isSiteWhitelisted()) {
        setTimeout(() => detectAndRemovePaywall(), 1000);
        setTimeout(() => detectAndRemovePaywall(), 3000);
      }

      // Anti-adblock detection (additional passes)
      if (state.enabled) {
        setTimeout(() => handleAntiAdblock(), 1500);
        setTimeout(() => handleAntiAdblock(), 4000);
        // Additional anti-anti-adblock passes
        setTimeout(() => removeAntiAdblockOverlays(), 2000);
        setTimeout(() => removeAntiAdblockOverlays(), 5000);
      }

      // Setup listeners
      setupMessageListener();

      // Re-apply blocking when page becomes visible (e.g., user switches back to tab)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && state.enabled && !isSiteWhitelisted()) {
          applyBlocking();
        }
      });

      // Apply blocking both immediately and after DOM is ready
      // This ensures selectors persist even if DOM isn't ready on first load
      const applyBlockingWhenReady = () => {
        if (state.enabled && !isSiteWhitelisted()) {
          applyBlocking();
        }
        // Also setup observer after DOM is ready
        setupMutationObserver();
        setTimeout(reportFramesToBackground, 2000);
      };

      // Only start observer when body exists
      if (document.body) {
        // Apply blocking immediately AND after a short delay to ensure persistence
        setTimeout(applyBlockingWhenReady, 100);
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          // Apply blocking after DOM is ready
          setTimeout(applyBlockingWhenReady, 100);
        });
      }

    } catch (err) {
      logError('init error:', err);
    }
  }

  // Cross-browser storage API - use shared utils
  const STORAGE_KEYS = ['enabled', 'paywallEnabled', 'socialBlockingEnabled', 'blockedSelectors', 'whitelistedSites', 'toastDuration', 'aggressiveAntiAdblockEnabled'];

  function getStorage() {
    return self.WebSuddhi.utils.getStorage(STORAGE_KEYS);
  }

  function setStorage(data) {
    return new Promise((resolve, reject) => {
      if (typeof browser !== 'undefined' && browser.storage) {
        browser.storage.local.set(data).then(resolve).catch(reject);
        return;
      }
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set(data, () => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve();
        });
        return;
      }
      try {
        if (data.blockedSelectors) {
          localStorage.setItem('websuddhi_selectors', JSON.stringify(data.blockedSelectors));
        }
        if (data.enabled !== undefined) {
          localStorage.setItem('websuddhi_enabled', data.enabled);
        }
        if (data.paywallEnabled !== undefined) {
          localStorage.setItem('websuddhi_paywall', data.paywallEnabled);
        }
        if (data.socialBlockingEnabled !== undefined) {
          localStorage.setItem('websuddhi_social', data.socialBlockingEnabled);
        }
        if (data.whitelistedSites) {
          localStorage.setItem('websuddhi_whitelist', JSON.stringify(data.whitelistedSites));
        }
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ============================================
  // MESSAGE HANDLING
  // ============================================
  function setupMessageListener() {
    log('Setting up message listener');
    const handler = (message, sender, sendResponse) => {
      handleMessage(message, sender)
        .then(sendResponse)
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    };

    if (typeof browser !== 'undefined' && browser.runtime) {
      browser.runtime.onMessage.addListener(handler);
    } else if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener(handler);
    }
    log('Message listener set up');
  }

  async function handleMessage(message, sender) {
    log('Received message:', message.type);
    switch (message.type) {
      case 'TOGGLE':
        state.enabled = message.enabled;
        if (state.enabled) {
          applyBlocking();
        } else {
          unblockAll();
        }
        await setStorage({ enabled: state.enabled });
        return { success: true, enabled: state.enabled };

      case 'TOGGLE_PAYWALL':
        state.paywallEnabled = message.enabled;
        await setStorage({ paywallEnabled: state.paywallEnabled });
        if (state.paywallEnabled) {
          detectAndRemovePaywall();
        }
        return { success: true, paywallEnabled: state.paywallEnabled };

      case 'TOGGLE_SOCIAL_BLOCKING':
        state.socialBlockingEnabled = message.enabled;
        await setStorage({ socialBlockingEnabled: state.socialBlockingEnabled });
        if (state.socialBlockingEnabled) {
          applySocialBlocking();
        } else {
          // Unblock social widgets
          unblockSocialWidgets();
        }
        return { success: true, socialBlockingEnabled: state.socialBlockingEnabled };

      case 'WHITELIST_SITE': {
        const hostname = message.hostname || getCurrentHostname();
        if (hostname && !state.whitelistedSites.includes(hostname)) {
          state.whitelistedSites.push(hostname);
          await setStorage({ whitelistedSites: state.whitelistedSites });
          unblockAll();
          state.enabled = false;
        }
        return { success: true, whitelisted: true };
      }

      case 'UNWHITELIST_SITE': {
        const unlistHostname = message.hostname || getCurrentHostname();
        state.whitelistedSites = state.whitelistedSites.filter(s => s !== unlistHostname);
        await setStorage({ whitelistedSites: state.whitelistedSites });
        return { success: true, whitelisted: false };
      }

      case 'GET_WHITELIST':
        return { success: true, sites: state.whitelistedSites };

      case 'START_PICK_MODE':
        startPickMode();
        return { success: true };

      case 'STOP_PICK_MODE':
        stopPickMode();
        return { success: true };

      case 'START_ZAP_MODE':
        startZapMode();
        return { success: true };

      case 'STOP_ZAP_MODE':
        stopZapMode();
        return { success: true };

      case 'TOGGLE_PICK_MODE':
        if (state.pickMode) {
          stopPickMode();
        } else {
          startPickMode();
        }
        return { success: true, pickMode: state.pickMode };

      case 'TOGGLE_ZAP_MODE':
        if (state.zapMode) {
          stopZapMode();
        } else {
          startZapMode();
        }
        return { success: true, zapMode: state.zapMode };

      case 'TOGGLE_COOKIE_CONSENT':
        state.cookieConsentEnabled = message.enabled;
        await setStorage({ cookieConsentEnabled: state.cookieConsentEnabled });
        if (state.cookieConsentEnabled) {
          applyBlocking();
        }
        return { success: true, cookieConsentEnabled: state.cookieConsentEnabled };

      case 'TOGGLE_ANNOYANCE_BLOCKING':
        state.annoyancesEnabled = message.enabled;
        await setStorage({ annoyancesEnabled: state.annoyancesEnabled });
        if (state.annoyancesEnabled) {
          applyBlocking();
        }
        return { success: true, annoyancesEnabled: state.annoyancesEnabled };

      case 'REMOVE_PAYWALL':
        const removed = removePaywall();
        return { success: true, removed };

      case 'ADD_SELECTOR':
        state.blockedSelectors.set(message.selector, {
          url: window.location.hostname,
          date: Date.now()
        });
        await saveSelectors();
        applyBlocking();
        return { success: true };

      case 'REMOVE_SELECTOR':
        state.blockedSelectors.delete(message.selector);
        await saveSelectors();
        unblockSelector(message.selector);
        return { success: true };

      case 'GET_STATUS':
        return {
          success: true,
          enabled: state.enabled,
          paywallEnabled: state.paywallEnabled,
          blockedCount: state.blockedCount,
          url: window.location.href
        };

      case 'GET_SELECTORS':
        return {
          success: true,
          selectors: Array.from(state.blockedSelectors.entries())
        };

      case 'RELOAD_RULES': {
        const reloadStorage = await getStorage();
        state.blockedSelectors = new Map();
        for (const entry of (reloadStorage.blockedSelectors || [])) {
          if (Array.isArray(entry)) {
            state.blockedSelectors.set(entry[0], entry[1]);
          } else if (entry && entry.selector) {
            state.blockedSelectors.set(entry.selector, { url: entry.hostname, date: entry.date });
          }
        }
        state.whitelistedSites = reloadStorage.whitelistedSites || [];
        state.enabled = reloadStorage.enabled !== false;
        if (isSiteWhitelisted()) state.enabled = false;
        if (state.enabled) {
          applyBlocking();
        } else {
          unblockAll();
        }
        return { success: true };
      }

      case 'GET_FRAMES':
        return {
          success: true,
          frames: detectThirdPartyFrames()
        };

      case 'ALLOW_FRAME':
        if (message.frameHost) {
          unblockFrame(message.frameHost);
        }
        return { success: true };

      default:
        return { success: false, error: 'Unknown message type' };
    }
  }

  // ============================================
  // IFRAME DETECTION
  // ============================================
  function detectThirdPartyFrames() {
    const currentHost = window.location.hostname.replace(/^www\./, '');
    const frames = [];

    // Find all iframes
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const src = iframe.src || iframe.getAttribute('data-src') || '';
        if (!src || src.startsWith('about:') || /^\s*javascript\s*:/i.test(src)) continue;

        const url = new URL(src, window.location.href);
        const frameHost = url.hostname.replace(/^www\./, '');

        // Check if third-party
        if (frameHost && frameHost !== currentHost && !currentHost.endsWith('.' + frameHost) && !frameHost.endsWith('.' + currentHost)) {
          const isBlocked = iframe.style.display === 'none' ||
                           iframe.hasAttribute('data-websuddhi-blocked') ||
                           !iframe.offsetParent;

          frames.push({
            host: frameHost,
            src: src,
            blocked: isBlocked,
            type: 'iframe'
          });
        }
      } catch (e) {
        // Invalid URL, skip
      }
    }

    // Also check for object/embed elements
    const embeds = document.querySelectorAll('object[data], embed[src]');
    for (const embed of embeds) {
      try {
        const src = embed.getAttribute('data') || embed.getAttribute('src') || '';
        if (!src) continue;

        const url = new URL(src, window.location.href);
        const embedHost = url.hostname.replace(/^www\./, '');

        if (embedHost && embedHost !== currentHost) {
          frames.push({
            host: embedHost,
            src: src,
            blocked: false,
            type: 'embed'
          });
        }
      } catch (e) {}
    }

    // Deduplicate by host
    const seen = new Set();
    return frames.filter(f => {
      if (seen.has(f.host)) return false;
      seen.add(f.host);
      return true;
    });
  }

  // Unblock a previously blocked frame
  function unblockFrame(frameHost) {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const src = iframe.src || iframe.getAttribute('data-src') || '';
        if (!src) continue;

        const url = new URL(src, window.location.href);
        const host = url.hostname.replace(/^www\./, '');

        if (host === frameHost) {
          iframe.style.display = '';
          iframe.removeAttribute('data-websuddhi-blocked');

          // If src was removed, restore it from data-src
          if (!iframe.src && iframe.getAttribute('data-websuddhi-src')) {
            iframe.src = iframe.getAttribute('data-websuddhi-src');
          }
        }
      } catch (e) {}
    }
  }

  // Report detected third-party frames to popup/background
  function reportFramesToBackground() {
    const frames = detectThirdPartyFrames();
    if (frames.length === 0) return;

    // Popup listens for this aggregated message
    sendMessage({
      type: 'FRAMES_DETECTED',
      frames
    }).catch(() => {});

    // Keep per-frame reporting for background compatibility
    for (const frame of frames) {
      sendMessage({
        type: 'REPORT_FRAME',
        frameHost: frame.host,
        frameUrl: frame.src,
        blocked: frame.blocked
      }).catch(() => {});
    }
  }

  // ============================================
  // PAYWALL DETECTION & REMOVAL
  // ============================================
  function detectAndRemovePaywall() {
    if (!state.paywallEnabled) return;

    // Method 1: Check for common paywall class names
    const paywallSelectors = AD_SELECTORS.paywall;
    for (const selector of paywallSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (isPaywallElement(el)) {
            removePaywallElement(el, 'selector');
          }
        });
      } catch (err) {}
    }

    // Method 2: Detect elements that block content (optimized)
    detectContentBlockers();

    // Method 3: Detect blur overlays (optimized)
    detectBlurOverlays();

    // Method 4: Restore body scroll if locked by paywall
    restoreBodyScroll();
  }

  function isPaywallElement(el) {
    const text = (el.innerText || '').substring(0, 500);
    const className = (typeof el.className === 'string') ? el.className : '';
    const id = el.id || '';

    // Check class/id for strong paywall indicators
    const strongClassPatterns = [
      'paywall', 'subscribe-wall', 'subscription-wall',
      'metered', 'content-gate', 'article-gate',
      'locked-content', 'premium-wall', 'member-wall',
      'piano-offer', 'tp-modal', 'tinypass'
    ];

    const classAndId = (className + ' ' + id).toLowerCase();
    if (strongClassPatterns.some(p => classAndId.includes(p))) {
      return true;
    }

    // For text-based detection, require multiple strong signals
    const textLower = text.toLowerCase();
    const textSignals = [
      'subscribe to continue', 'subscribe to read',
      'subscription required', 'sign in to read',
      'create a free account to', 'paywall',
      'metered content', 'article limit',
      'free articles remaining', 'upgrade to premium',
      'unlock this article', 'become a member to',
      'this content is for subscribers',
      'already a subscriber', 'start your trial'
    ];

    return textSignals.some(signal => textLower.includes(signal));
  }

  function detectContentBlockers() {
    // Optimized: Only check fixed/absolute positioned elements with targeted selectors
    const targetSelectors = [
      '[style*="position: fixed"]', '[style*="position:fixed"]',
      '[style*="position: absolute"]', '[style*="position:absolute"]',
      '[class*="overlay"]', '[class*="modal"]', '[class*="backdrop"]',
      '[class*="paywall"]', '[class*="gate"]', '[class*="blocker"]',
      '[role="dialog"]', '[aria-modal="true"]'
    ];

    const combinedSelector = targetSelectors.join(',');

    try {
      const elements = document.querySelectorAll(combinedSelector);
      elements.forEach(el => {
        try {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();

          const isFixed = style.position === 'fixed' || style.position === 'absolute';
          const coversContent = rect.width > 200 && rect.height > 200;
          const hasHighZIndex = parseInt(style.zIndex) > 100;

          if (isFixed && coversContent && hasHighZIndex) {
            const text = (el.innerText || '').toLowerCase().substring(0, 500);
            const className = (typeof el.className === 'string') ? el.className.toLowerCase() : '';

            if (text.includes('subscribe') ||
                text.includes('sign in') ||
                text.includes('log in') ||
                text.includes('paywall') ||
                text.includes('metered') ||
                text.includes('limited access') ||
                className.includes('paywall') ||
                className.includes('subscribe-wall') ||
                className.includes('overlay') && className.includes('gate')) {

              removePaywallElement(el, 'content-blocker');
            }
          }
        } catch (err) {}
      });
    } catch (err) {}
  }

  function detectBlurOverlays() {
    // Optimized: Only check elements with blur-related styles or classes
    const blurSelectors = [
      '[style*="blur"]', '[style*="backdrop-filter"]',
      '[class*="blur"]', '[class*="blurred"]',
      '[data-blur]',
      '[class*="fade"]', '[class*="gradient"]',
      '[class*="truncat"]', '[class*="clamp"]'
    ];

    const combinedSelector = blurSelectors.join(',');

    try {
      const elements = document.querySelectorAll(combinedSelector);
      elements.forEach(el => {
        try {
          const style = window.getComputedStyle(el);

          const hasBlur = style.backdropFilter?.includes('blur') ||
                         style.filter?.includes('blur') ||
                         el.hasAttribute('data-blur');

          const text = (el.innerText || '').substring(0, 300);
          const hasReadMore = text.includes('Read more') ||
                             text.includes('Continue reading') ||
                             text.includes('Subscribe to read');

          if (hasBlur && (hasReadMore || isPaywallElement(el))) {
            removePaywallElement(el, 'blur-overlay');
          }

          // Check for gradient fade at bottom of articles
          const elClassName = (typeof el.className === 'string') ? el.className : '';
          const elId = el.id || '';
          if (style.background?.includes('gradient') &&
              (elClassName.includes('fade') ||
               elClassName.includes('gradient') ||
               elId.includes('fade') ||
               elId.includes('gradient'))) {
            const parent = el.parentElement;
            if (parent) {
              const parentClass = (typeof parent.className === 'string') ? parent.className : '';
              const parentId = parent.id || '';
              if (parentClass.includes('article') ||
                  parentId.includes('article') ||
                  parentClass.includes('content') ||
                  parentId.includes('content') ||
                  parentClass.includes('story') ||
                  parentId.includes('story')) {
                removePaywallElement(el, 'gradient-fade');
              }
            }
          }
        } catch (err) {}
      });
    } catch (err) {}
  }

  function restoreBodyScroll() {
    if (!document.body) return;
    const bodyStyle = window.getComputedStyle(document.body);
    const htmlStyle = window.getComputedStyle(document.documentElement);

    // Detect if body scroll is locked (common paywall technique)
    if (bodyStyle.overflow === 'hidden' || htmlStyle.overflow === 'hidden') {
      // Only restore if we detected paywall removal
      const removedElements = document.querySelectorAll('[data-websuddhi-removed]');
      if (removedElements.length > 0) {
        document.body.style.overflow = '';
        document.body.style.overflowY = '';
        document.documentElement.style.overflow = '';
        document.documentElement.style.overflowY = '';
        document.body.style.position = '';
        document.body.style.height = '';
        document.documentElement.style.position = '';
        document.documentElement.style.height = '';
      }
    }
  }

  function removePaywall() {
    let removedCount = 0;

    const paywallSelectors = AD_SELECTORS.paywall;
    for (const selector of paywallSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (isPaywallElement(el)) {
            removePaywallElement(el, 'manual');
            removedCount++;
          }
        });
      } catch (err) {}
    }

    detectContentBlockers();
    detectBlurOverlays();
    restoreBodyScroll();

    return removedCount;
  }

  function removePaywallElement(el, reason) {
    // Don't remove main content areas
    const tag = el.tagName?.toLowerCase();
    if (tag === 'body' || tag === 'html' || tag === 'main' || tag === 'article') return;
    if (el.id === 'content' || el.id === 'main-content' || el.id === 'article-body') return;

    // Already removed
    if (el.hasAttribute('data-websuddhi-removed')) return;

    el.setAttribute('data-websuddhi-removed', reason);
    el.classList.add('websuddhi-removed');

    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.style.setProperty('position', 'absolute', 'important');
    el.style.setProperty('z-index', '-9999', 'important');

    // Check immediate parent only (not 5 levels deep to avoid removing layout)
    const parent = el.parentElement;
    if (parent && parent !== document.body && parent.tagName?.toLowerCase() !== 'main') {
      const pStyle = window.getComputedStyle(parent);
      const pClass = (typeof parent.className === 'string') ? parent.className.toLowerCase() : '';
      if ((pStyle.position === 'fixed' || pStyle.position === 'absolute') &&
          (pClass.includes('paywall') || pClass.includes('overlay') || pClass.includes('modal'))) {
        if (!parent.hasAttribute('data-websuddhi-removed')) {
          parent.style.setProperty('display', 'none', 'important');
          parent.setAttribute('data-websuddhi-removed', 'parent-' + reason);
        }
      }
    }

    state.blockedCount++;
  }

  // ============================================
  // ANTI-ADBLOCK DETECTION
  // ============================================
  function handleAntiAdblock() {
    if (!state.enabled) return;

    // Remove anti-adblock overlays
    const combinedSelector = ANTI_ADBLOCK_SELECTORS.join(',');
    try {
      document.querySelectorAll(combinedSelector).forEach(el => {
        el.style.setProperty('display', 'none', 'important');
        el.setAttribute('data-websuddhi-removed', 'anti-adblock');
        state.blockedCount++;
      });
    } catch (err) {}

    // Restore body scroll if anti-adblock locked it
    restoreBodyScroll();
  }

  // ============================================
  // ANTI-ANTI-ADBLOCK BYPASS
  // ============================================
  function setupAntiAntiAdblock() {
    if (!state.enabled) return;

    try {
      // Override common adblock detection variables
      const adblockDetectionVars = [
        'adblock', 'adBlock', 'AdBlock',
        'adblockDetected', 'adBlockDetected',
        'isAdblockEnabled', 'hasAdblock',
        'adblockEnabled', 'adBlockEnabled',
        'blockAdBlock', 'fuckAdBlock',
        'noAdBlock', 'adsBlocked',
        'adBlocker', 'adblocker'
      ];

      // Set detection variables to false/undefined
      adblockDetectionVars.forEach(varName => {
        try {
          if (window[varName] !== undefined) {
            window[varName] = false;
          }
        } catch (e) {}
      });

      // Set "ads can run" variables to true
      const canRunAdsVars = [
        'canRunAds', 'adsCanRun', 'adsbygoogle',
        'adsLoaded', 'adLoaded', 'googleads',
        'showAds', 'displayAds'
      ];

      canRunAdsVars.forEach(varName => {
        try {
          window[varName] = true;
        } catch (e) {}
      });

      // Create Object.defineProperty traps for common detection properties
      const protectedProperties = [
        'adblock', 'adBlock', 'adblockDetected', 'adBlockDetected',
        'blockAdBlock', 'fuckAdBlock', 'isAdblockEnabled',
        'canRunAds', 'adsBlocked'
      ];

      protectedProperties.forEach(prop => {
        try {
          Object.defineProperty(window, prop, {
            get: function() {
              // Return values that indicate no adblocker
              if (prop.toLowerCase().includes('canrun') || prop.toLowerCase().includes('loaded')) {
                return true;
              }
              return false;
            },
            set: function() {
              // Silently ignore attempts to set detection flags
              return true;
            },
            configurable: true
          });
        } catch (e) {}
      });

      // Create fake ad element that detection scripts look for
      createFakeAdElements();

      // Intercept fetch/XHR to known anti-adblock endpoints
      interceptAntiAdblockRequests();

      // Neutralize common detection script patterns
      neutralizeDetectionScripts();

      // Remove anti-adblock overlay elements periodically
      removeAntiAdblockOverlays();

    } catch (err) {
      // Silently fail - anti-adblock bypass is best-effort
    }
  }

  function createFakeAdElements() {
    try {
      // Create a hidden fake ad element that detection scripts check for
      const fakeAdClasses = ['ad', 'ads', 'adsbox', 'ad-banner', 'ad-placeholder'];

      fakeAdClasses.forEach(className => {
        // Check if element already exists
        if (!document.querySelector('.' + className + '[data-websuddhi-fake-ad]')) {
          const fakeAd = document.createElement('div');
          fakeAd.className = className;
          fakeAd.setAttribute('data-websuddhi-fake-ad', 'true');
          fakeAd.style.cssText = 'position:absolute!important;left:-9999px!important;top:-9999px!important;' +
            'width:1px!important;height:1px!important;opacity:0.01!important;pointer-events:none!important;' +
            'visibility:visible!important;display:block!important;';
          fakeAd.innerHTML = '&nbsp;';

          if (document.body) {
            document.body.appendChild(fakeAd);
          }
        }
      });

      // Create fake doubleclick/googlesyndication iframe
      if (!document.querySelector('iframe[data-websuddhi-fake-ad]')) {
        const fakeIframe = document.createElement('iframe');
        fakeIframe.setAttribute('data-websuddhi-fake-ad', 'true');
        fakeIframe.style.cssText = 'position:absolute!important;left:-9999px!important;top:-9999px!important;' +
          'width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;';
        fakeIframe.src = 'about:blank';

        if (document.body) {
          document.body.appendChild(fakeIframe);
        }
      }
    } catch (e) {}
  }

  function interceptAntiAdblockRequests() {
    // List of known anti-adblock detection endpoints
    const antiAdblockEndpoints = [
      'pagead2.googlesyndication.com',
      'pagead.googlesyndication.com',
      'doubleclick.net',
      'adservice.google',
      'blockadblock',
      'fuckadblock',
      'admiral',
      'adblock-detect',
      'adb-detect',
      'adblock.js',
      'ads.js',
      'advertisement.js',
      'detect-adblock',
      'anti-adblock',
      'antiblock'
    ];

    // Intercept fetch API
    const originalFetch = window.fetch;
    if (originalFetch && !window._websuddhi_fetch_intercepted) {
      window._websuddhi_fetch_intercepted = true;
      window.fetch = function(url, options) {
        try {
          const urlStr = typeof url === 'string' ? url : (url.url || url.href || '');
          const urlLower = urlStr.toLowerCase();

          // Check if this is an anti-adblock detection request
          const isAntiAdblock = antiAdblockEndpoints.some(endpoint =>
            urlLower.includes(endpoint.toLowerCase())
          );

          if (isAntiAdblock) {
            // Return a fake successful response for ad scripts
            return Promise.resolve(new Response('var canRunAds=true;', {
              status: 200,
              headers: { 'Content-Type': 'application/javascript' }
            }));
          }
        } catch (e) {}

        return originalFetch.apply(this, arguments);
      };
    }

    // Intercept XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    if (originalXHROpen && !window._websuddhi_xhr_intercepted) {
      window._websuddhi_xhr_intercepted = true;
      XMLHttpRequest.prototype.open = function(method, url) {
        try {
          const urlStr = typeof url === 'string' ? url : (url.href || '');
          const urlLower = urlStr.toLowerCase();

          const isAntiAdblock = antiAdblockEndpoints.some(endpoint =>
            urlLower.includes(endpoint.toLowerCase())
          );

          if (isAntiAdblock) {
            // Mark this request for interception
            this._websuddhi_intercept = true;
          }
        } catch (e) {}

        return originalXHROpen.apply(this, arguments);
      };

      const originalXHRSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function() {
        if (this._websuddhi_intercept) {
          // Fake a successful response
          Object.defineProperty(this, 'readyState', { value: 4 });
          Object.defineProperty(this, 'status', { value: 200 });
          Object.defineProperty(this, 'responseText', { value: 'var canRunAds=true;' });
          Object.defineProperty(this, 'response', { value: 'var canRunAds=true;' });

          setTimeout(() => {
            if (typeof this.onreadystatechange === 'function') {
              this.onreadystatechange();
            }
            if (typeof this.onload === 'function') {
              this.onload();
            }
          }, 10);
          return;
        }

        return originalXHRSend.apply(this, arguments);
      };
    }
  }

  function neutralizeDetectionScripts() {
    try {
      // Neutralize BlockAdBlock
      if (typeof window.BlockAdBlock === 'function') {
        window.BlockAdBlock = function() {
          this.check = function() { return false; };
          this.on = function() { return this; };
          this.onDetected = function() { return this; };
          this.onNotDetected = function(fn) { if (typeof fn === 'function') fn(); return this; };
        };
      }

      // Neutralize FuckAdBlock
      if (typeof window.FuckAdBlock === 'function') {
        window.FuckAdBlock = function() {
          this.check = function() { return false; };
          this.on = function() { return this; };
          this.onDetected = function() { return this; };
          this.onNotDetected = function(fn) { if (typeof fn === 'function') fn(); return this; };
        };
      }

      // Set common detection objects to neutralized versions
      window.blockAdBlock = {
        check: function() { return false; },
        on: function() { return this; },
        onDetected: function() { return this; },
        onNotDetected: function(fn) { if (typeof fn === 'function') fn(); return this; }
      };

      window.fuckAdBlock = window.blockAdBlock;
      window.sniffAdBlock = window.blockAdBlock;

      // Neutralize common callback patterns
      window.adBlockDetected = function() {};
      window.adBlockNotDetected = function() {};
      window.onAdBlockDetected = function() {};

    } catch (e) {}
  }

  function removeAntiAdblockOverlays() {
    const overlaySelectors = ANTI_ADBLOCK_SELECTORS.join(',');

    try {
      document.querySelectorAll(overlaySelectors).forEach(el => {
        if (!el.hasAttribute('data-websuddhi-removed')) {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('opacity', '0', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
          el.style.setProperty('position', 'absolute', 'important');
          el.style.setProperty('z-index', '-9999', 'important');
          el.setAttribute('data-websuddhi-removed', 'anti-adblock-overlay');
          state.blockedCount++;
        }
      });
    } catch (e) {}

    // Also look for elements with adblock-related text content
    try {
      const textPatterns = [
        'adblock detected', 'ad blocker detected', 'adblocker detected',
        'disable your ad blocker', 'disable adblock', 'turn off adblock',
        'whitelist this site', 'whitelist us', 'disable your adblocker',
        'please disable', 'ad-blocker', 'adblocker'
      ];

      // Check fixed/absolute positioned elements with high z-index
      document.querySelectorAll('[style*="position: fixed"], [style*="position:fixed"], ' +
        '[style*="position: absolute"], [style*="position:absolute"]').forEach(el => {
        if (el.hasAttribute('data-websuddhi-removed')) return;

        const text = (el.innerText || '').toLowerCase().substring(0, 500);
        const style = window.getComputedStyle(el);
        const zIndex = parseInt(style.zIndex) || 0;

        if (zIndex > 100 && textPatterns.some(pattern => text.includes(pattern))) {
          el.style.setProperty('display', 'none', 'important');
          el.setAttribute('data-websuddhi-removed', 'anti-adblock-text');
          state.blockedCount++;

          // Also restore body scroll
          restoreBodyScroll();
        }
      });
    } catch (e) {}
  }

  // ============================================
  // SOCIAL WIDGET BLOCKING
  // ============================================
  function applySocialBlocking() {
    if (!state.socialBlockingEnabled || isSiteWhitelisted()) return;

    for (const selector of SOCIAL_WIDGET_SELECTORS) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (self.WebSuddhi.utils.isVisible(el) && !el.hasAttribute('data-websuddhi-blocked')) {
            hideSocialElement(el);
          }
        });
      } catch (err) {}
    }
  }

  function hideSocialElement(el) {
    el.classList.add('websuddhi-hidden', 'websuddhi-social-blocked');
    el.setAttribute('data-websuddhi-blocked', 'social');
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('position', 'absolute', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.style.setProperty('z-index', '-9999', 'important');
    state.blockedCount++;

    // Report cosmetic block to stats manager (debounced)
    reportCosmeticBlockDebounced();
  }

  // ============================================
  // AD BLOCKING
  // ============================================
  function applyBlocking() {
    if (!state.enabled || isSiteWhitelisted()) return;

    for (const selector of state.blockedSelectors.keys()) {
      blockSelector(selector);
    }

    for (const selector of ALL_SELECTORS) {
      blockSelector(selector);
    }

    blockByAttributes();
    handleDynamicContent();

    // Also apply social blocking if enabled
    if (state.socialBlockingEnabled) {
      applySocialBlocking();
    }
  }

  function blockSelector(selector) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (self.WebSuddhi.utils.isVisible(el) && !el.hasAttribute('data-websuddhi-blocked')) {
          hideElement(el, selector);
        }
      });
    } catch (err) {}
  }

  function unblockSelector(selector) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        el.classList.remove('websuddhi-hidden');
        el.removeAttribute('data-websuddhi-blocked');
        el.style.display = '';
        el.style.visibility = '';
        el.style.opacity = '';
        el.style.position = '';
        el.style.pointerEvents = '';
      });
    } catch (err) {}
  }

  function unblockAll() {
    document.querySelectorAll('.websuddhi-hidden, [data-websuddhi-blocked], [data-websuddhi-removed]').forEach(el => {
      el.classList.remove('websuddhi-hidden', 'websuddhi-removed', 'websuddhi-social-blocked');
      el.removeAttribute('data-websuddhi-blocked');
      el.removeAttribute('data-websuddhi-removed');
      el.style.display = '';
      el.style.visibility = '';
      el.style.opacity = '';
      el.style.position = '';
      el.style.pointerEvents = '';
      el.style.zIndex = '';
    });
    state.blockedCount = 0;
  }

  function unblockSocialWidgets() {
    document.querySelectorAll('.websuddhi-social-blocked, [data-websuddhi-blocked="social"]').forEach(el => {
      el.classList.remove('websuddhi-hidden', 'websuddhi-social-blocked');
      el.removeAttribute('data-websuddhi-blocked');
      el.style.display = '';
      el.style.visibility = '';
      el.style.opacity = '';
      el.style.position = '';
      el.style.pointerEvents = '';
      el.style.zIndex = '';
    });
  }

  function blockByAttributes() {
    AD_TAGS.forEach(({ tag, attrs }) => {
      try {
        document.querySelectorAll(tag).forEach(el => {
          if (el.hasAttribute('data-websuddhi-blocked')) return;
          const attrNames = Array.from(el.attributes).map(a => a.name.toLowerCase());
          const attrValues = Array.from(el.attributes).map(a => (a.name + '=' + a.value).toLowerCase());
          const combined = attrNames.concat(attrValues).join(' ');
          const hasAdAttr = attrs.some(adAttr => combined.includes(adAttr.toLowerCase()));
          if (hasAdAttr && self.WebSuddhi.utils.isVisible(el)) {
            hideElement(el);
          }
        });
      } catch (err) {}
    });

    try {
      document.querySelectorAll('[data-ad], [data-ads], [data-advertisement]').forEach(el => {
        if (self.WebSuddhi.utils.isVisible(el) && !el.hasAttribute('data-websuddhi-blocked')) hideElement(el);
      });
    } catch (err) {}
  }

  function hideElement(el, matchedSelector) {
    el.classList.add('websuddhi-hidden');
    el.setAttribute('data-websuddhi-blocked', 'true');
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('position', 'absolute', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.style.setProperty('z-index', '-9999', 'important');
    state.blockedCount++;

    // Report cosmetic block to stats manager (debounced)
    // Try to get a meaningful selector for logging
    const selectorForLog = matchedSelector || getElementDescriptor(el);
    reportCosmeticBlockDebounced(selectorForLog);
  }

  function getElementDescriptor(el) {
    // Generate a short descriptor for the element for logging purposes
    const tag = el.tagName?.toLowerCase() || 'element';
    const id = el.id ? '#' + el.id : '';
    const className = (typeof el.className === 'string' && el.className.trim())
      ? '.' + el.className.trim().split(/\s+/).filter(c => !c.startsWith('websuddhi')).slice(0, 2).join('.')
      : '';
    return tag + id + className || tag;
  }

  // Debounced cosmetic block reporting
  let cosmeticReportTimeout = null;
  let pendingCosmeticCount = 0;
  let lastBlockedSelector = '';

  function isUnknownMessageTypeResponse(response) {
    return Boolean(
      response &&
      response.success === false &&
      typeof response.error === 'string' &&
      response.error.toLowerCase().includes('unknown message type')
    );
  }

  function sendCosmeticStats(payload) {
    sendMessage({
      type: 'INCREMENT_STATS',
      ...payload
    })
      .then((response) => {
        if (isUnknownMessageTypeResponse(response)) {
          return sendMessage({
            type: 'INCREMENT_COSMETIC_STATS',
            ...payload
          });
        }
        return response;
      })
      .catch(() => {
        sendMessage({
          type: 'INCREMENT_COSMETIC_STATS',
          ...payload
        }).catch(() => {});
      });
  }

  function reportCosmeticBlockDebounced(selector) {
    pendingCosmeticCount++;
    if (selector) lastBlockedSelector = selector;
    clearTimeout(cosmeticReportTimeout);
    cosmeticReportTimeout = setTimeout(() => {
      const count = pendingCosmeticCount;
      const selectorToReport = lastBlockedSelector;
      pendingCosmeticCount = 0;
      lastBlockedSelector = '';
      try {
        sendCosmeticStats({
          hostname: getCurrentHostname(),
          count,
          selector: selectorToReport
        });
      } catch (e) {}
    }, 2000);
  }

  // ============================================
  // VISIBILITY CHECK - use shared utils
  // ============================================

  // ============================================
  // SHADOW DOM SUPPORT
  // ============================================
  function handleShadowDOM(container) {
    container = container || document.body;
    if (!container) return;

    const findInShadow = (root) => {
      if (!root) return;

      for (const selector of ALL_SELECTORS) {
        try {
          root.querySelectorAll(selector).forEach(el => {
            if (self.WebSuddhi.utils.isVisible(el) && !el.hasAttribute('data-websuddhi-blocked')) {
              hideElement(el);
            }
          });
        } catch (err) {}
      }

      try {
        root.querySelectorAll('*').forEach(el => {
          if (el.shadowRoot) {
            findInShadow(el.shadowRoot);
          }
        });
      } catch (err) {}
    };

    if (container.shadowRoot) {
      findInShadow(container.shadowRoot);
    }
    findInShadow(container);
  }

  // ============================================
  // DYNAMIC CONTENT
  // ============================================
  function setupMutationObserver() {
    if (!document.body) return;
    if (state.observer) return;

    state.observer = new MutationObserver((mutations) => {
      if (!state.enabled) return;

      // Only process if relevant nodes were added
      let hasRelevantChanges = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0 || mutation.type === 'attributes') {
          hasRelevantChanges = true;
          break;
        }
      }
      if (!hasRelevantChanges) return;

      clearTimeout(state.observerTimeout);
      state.observerTimeout = setTimeout(() => {
        applyBlocking();
        handleShadowDOM();
        removePingAttributes();
        if (state.paywallEnabled) {
          detectAndRemovePaywall();
        }
        handleAntiAdblock();
      }, 150);
    });

    state.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'display']
    });
  }

  function handleDynamicContent() {
    setTimeout(() => applyBlocking(), 500);
    setTimeout(() => applyBlocking(), 1500);
    setTimeout(() => applyBlocking(), 3000);
  }

  // ============================================
  // PING ATTRIBUTE REMOVAL (Phase 6)
  // ============================================
  function removePingAttributes() {
    try {
      document.querySelectorAll('a[ping]').forEach(el => {
        el.removeAttribute('ping');
      });
    } catch (e) {}
  }

  // ============================================
  // PICK MODE - Select & Save Elements
  // ============================================
  function startPickMode() {
    log('startPickMode called');

    if (state.zapMode) stopZapMode();
    state.pickMode = true;
    state.pickModeShiftHeld = false;
    state.pickModeCtrlHeld = false;
    state.pickDialogOpen = false;
    document.body.classList.add('websuddhi-pick-mode');

    // Ensure document has focus for keyboard events
    window.focus();
    if (document.body) {
      document.body.focus();
    }

    addPickListeners();

    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    // Create the preview panel
    createPreviewPanel();

    showToast('Pick mode: click an element to block it. Press Esc to cancel.');
  }

  function stopPickMode() {
    state.pickMode = false;
    state.pickModeShiftHeld = false;
    state.pickModeCtrlHeld = false;
    state.pickDialogOpen = false;
    document.body.classList.remove('websuddhi-pick-mode');

    removePickListeners();

    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';

    clearHighlights();
    removePreviewPanel();
    removeToast();

    // Clean up any leftover dialog
    const dialog = document.querySelector('.websuddhi-pick-dialog');
    if (dialog) dialog.remove();

    const preview = document.querySelector('.websuddhi-pick-preview');
    if (preview) preview.remove();
  }

  // ============================================
  // ELEMENT PREVIEW PANEL
  // ============================================
  function createPreviewPanel() {
    // Remove existing panel if any
    removePreviewPanel();

    const panel = document.createElement('div');
    panel.className = 'websuddhi-preview-panel';
    panel.innerHTML = `
      <div class="websuddhi-preview-header">Element Preview</div>
      <div class="websuddhi-preview-selector"></div>
      <div class="websuddhi-preview-info">
        <span class="websuddhi-preview-tag"></span>
        <span class="websuddhi-preview-matches"></span>
        <span class="websuddhi-preview-dimensions"></span>
      </div>
      <div class="websuddhi-preview-details">
        <span class="websuddhi-preview-id"></span>
        <span class="websuddhi-preview-classes"></span>
      </div>
      <div class="websuddhi-preview-warning" style="display: none;"></div>
      <div class="websuddhi-preview-hint">
        Click to block <kbd>Esc</kbd> cancel <kbd>Shift</kbd> parent <kbd>Ctrl</kbd> specific
      </div>
    `;
    panel.style.display = 'none';
    document.body.appendChild(panel);
    return panel;
  }

  function removePreviewPanel() {
    const panel = document.querySelector('.websuddhi-preview-panel');
    if (panel) panel.remove();
  }

  function updatePreviewPanel(element) {
    const panel = document.querySelector('.websuddhi-preview-panel');
    if (!panel || !element) {
      if (panel) panel.style.display = 'none';
      return;
    }

    // Get the actual target element based on modifiers
    let targetElement = element;
    if (state.pickModeShiftHeld && element.parentElement && element.parentElement !== document.body) {
      targetElement = element.parentElement;
      // Update highlight to show parent instead
      clearHighlights();
      targetElement.classList.add('websuddhi-pick-highlight');
    }

    // Generate selector based on modifiers
    const selector = state.pickModeCtrlHeld
      ? getSpecificSelector(targetElement)
      : getUniqueSelector(targetElement);

    // Count matching elements
    let matchCount = 0;
    try {
      matchCount = document.querySelectorAll(selector).length;
    } catch (e) {
      matchCount = 1;
    }

    // Get element info
    const tagName = targetElement.tagName.toLowerCase();
    const rect = targetElement.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    const id = targetElement.id || '';
    const classes = (typeof targetElement.className === 'string')
      ? targetElement.className.trim().split(/\s+/).filter(c => c && !c.startsWith('websuddhi')).slice(0, 5)
      : [];

    // Update panel content
    const selectorEl = panel.querySelector('.websuddhi-preview-selector');
    const tagEl = panel.querySelector('.websuddhi-preview-tag');
    const matchesEl = panel.querySelector('.websuddhi-preview-matches');
    const dimensionsEl = panel.querySelector('.websuddhi-preview-dimensions');
    const idEl = panel.querySelector('.websuddhi-preview-id');
    const classesEl = panel.querySelector('.websuddhi-preview-classes');
    const warningEl = panel.querySelector('.websuddhi-preview-warning');

    if (selectorEl) {
      // Truncate long selectors for display
      const displaySelector = selector.length > 100 ? selector.substring(0, 100) + '...' : selector;
      selectorEl.textContent = displaySelector;
      selectorEl.title = selector;
    }

    if (tagEl) {
      tagEl.textContent = tagName;
    }

    if (matchesEl) {
      matchesEl.textContent = matchCount + ' match' + (matchCount !== 1 ? 'es' : '');
      matchesEl.className = 'websuddhi-preview-matches';
      if (matchCount > 10) {
        matchesEl.classList.add('danger');
      } else if (matchCount > 5) {
        matchesEl.classList.add('warning');
      }
    }

    if (dimensionsEl) {
      dimensionsEl.textContent = width + ' x ' + height + 'px';
    }

    if (idEl) {
      idEl.textContent = id ? '#' + id : '';
      idEl.style.display = id ? 'inline' : 'none';
    }

    if (classesEl) {
      if (classes.length > 0) {
        classesEl.textContent = '.' + classes.join(' .');
        classesEl.style.display = 'inline';
      } else {
        classesEl.style.display = 'none';
      }
    }

    // Show warning if many elements match
    if (warningEl) {
      if (matchCount > 5) {
        warningEl.textContent = 'Warning: This will block ' + matchCount + ' element' + (matchCount !== 1 ? 's' : '');
        warningEl.style.display = 'flex';
      } else {
        warningEl.style.display = 'none';
      }
    }

    // Position panel to avoid overlapping with hovered element
    positionPreviewPanel(panel, rect);

    panel.style.display = 'block';
  }

  function positionPreviewPanel(panel, elementRect) {
    // Reset position classes
    panel.classList.remove('position-top');

    const panelHeight = panel.offsetHeight || 150;
    const viewportHeight = window.innerHeight;
    const bottomSpace = viewportHeight - elementRect.bottom;

    // If element is in the bottom half of the screen, show panel at top
    if (elementRect.bottom > viewportHeight / 2 && bottomSpace < panelHeight + 40) {
      panel.classList.add('position-top');
    }
  }

  function getSpecificSelector(element) {
    // Generate a more specific selector including nth-child
    if (!element || element === document.body) return 'body';

    const path = [];
    let el = element;
    let depth = 0;

    while (el && el !== document.documentElement && depth < 4) {
      let selector = el.tagName.toLowerCase();

      // Add ID if present
      if (el.id) {
        selector += '#' + CSS.escape(el.id);
        path.unshift(selector);
        break;
      }

      // Add classes (limit to 2)
      if (el.className && typeof el.className === 'string') {
        const classes = el.className.trim().split(/\s+/)
          .filter(c => c && !c.startsWith('websuddhi'))
          .slice(0, 2);
        if (classes.length > 0) {
          selector += '.' + classes.map(c => CSS.escape(c)).join('.');
        }
      }

      // Add nth-child for specificity
      const parent = el.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(el) + 1;
        selector += ':nth-child(' + index + ')';
      }

      path.unshift(selector);
      el = el.parentElement;
      depth++;
    }

    return path.join(' > ');
  }

  // Keyboard handlers for pick mode modifiers
  function handlePickKeyDown(e) {
    if (!state.pickMode) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      stopPickMode();
      return;
    }

    // Track modifier keys
    if (e.key === 'Shift' && !state.pickModeShiftHeld) {
      state.pickModeShiftHeld = true;
      // Update preview if we have a hovered element
      if (state.hoveredElement) {
        updatePreviewPanel(state.hoveredElement);
      }
    }

    if ((e.key === 'Control' || e.key === 'Meta') && !state.pickModeCtrlHeld) {
      state.pickModeCtrlHeld = true;
      // Update preview if we have a hovered element
      if (state.hoveredElement) {
        updatePreviewPanel(state.hoveredElement);
      }
    }
  }

  function handlePickKeyUp(e) {
    if (!state.pickMode) return;

    if (e.key === 'Shift') {
      state.pickModeShiftHeld = false;
      // Update preview and restore highlight to original element
      if (state.hoveredElement) {
        clearHighlights();
        state.hoveredElement.classList.add('websuddhi-pick-highlight');
        updatePreviewPanel(state.hoveredElement);
      }
    }

    if (e.key === 'Control' || e.key === 'Meta') {
      state.pickModeCtrlHeld = false;
      // Update preview
      if (state.hoveredElement) {
        updatePreviewPanel(state.hoveredElement);
      }
    }
  }

  // ============================================
  // ZAP MODE - Quick Hide Without Saving
  // ============================================
  function startZapMode() {
    // Only run zap mode in the top/main frame to avoid conflicts with iframes
    if (window !== window.top) {
      return;
    }

    if (state.pickMode) stopPickMode();
    state.zapMode = true;
    document.body.classList.add('websuddhi-zap-mode');

    // Ensure document has focus for keyboard events
    window.focus();
    if (document.body) {
      document.body.focus();
    }

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleZapClick, true);
    document.addEventListener('keydown', handleZapEscape, true);

    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    showToast('Zap mode: click elements to hide them instantly. Press Esc to exit.');
  }

  function stopZapMode() {
    state.zapMode = false;
    document.body.classList.remove('websuddhi-zap-mode');

    document.removeEventListener('mouseover', handleMouseOver, true);
    document.removeEventListener('mouseout', handleMouseOut, true);
    document.removeEventListener('click', handleZapClick, true);
    document.removeEventListener('keydown', handleZapEscape, true);

    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';

    clearHighlights();
    removeToast();
  }

  function handleZapClick(e) {
    if (!state.zapMode) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const el = e.target;
    if (el.classList.contains('websuddhi-pick-preview') || el.closest('.websuddhi-pick-preview')) return;

    // Generate a unique selector so the block persists across page loads
    const selector = getUniqueSelector(el);
    hideElement(el, selector);

    if (!selector) {
      showToast('Element hidden (could not generate selector)');
      return;
    }

    // Persist the rule — same flow as Pick Mode but without the confirm dialog
    (async () => {
      try {
        if (state.blockedSelectors.size >= 500) {
          showToast('Element hidden — rule limit reached (500). Remove old rules first.');
          return;
        }
        state.blockedSelectors.set(selector, {
          url: window.location.hostname,
          date: Date.now(),
          source: 'zap'
        });
        await saveSelectors();
        blockSelector(selector);
        try { await sendMessage({ type: 'ADD_SELECTOR', selector }); } catch (_) {}
        showToast('Element zapped and rule saved');
      } catch (err) {
        logError('Zap mode: failed to save selector:', err);
        showToast('Element hidden (save failed)');
      }
    })();
  }

  function handleZapEscape(e) {
    if (e.key === 'Escape' && state.zapMode) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      stopZapMode();
    }
  }

  // ============================================
  // SHARED PICK/ZAP HANDLERS
  // ============================================
  function handleMouseOver(e) {
    if (!state.pickMode && !state.zapMode) return;
    e.stopPropagation();

    // Don't highlight our own UI
    if (e.target.classList.contains('websuddhi-pick-preview') ||
        e.target.closest('.websuddhi-pick-preview') ||
        e.target.classList.contains('websuddhi-preview-panel') ||
        e.target.closest('.websuddhi-preview-panel') ||
        e.target.classList.contains('websuddhi-pick-dialog') ||
        e.target.closest('.websuddhi-pick-dialog') ||
        e.target.classList.contains('websuddhi-toast') ||
        e.target === document.body ||
        e.target === document.documentElement) return;

    clearHighlights();
    state.hoveredElement = e.target;
    state.hoveredElement.classList.add('websuddhi-pick-highlight');

    if (state.pickMode) {
      // Use the new enhanced preview panel
      updatePreviewPanel(e.target);
    }
  }

  function handleMouseOut(e) {
    if (!state.pickMode && !state.zapMode) return;
    if (e.target === state.hoveredElement) {
      e.target.classList.remove('websuddhi-pick-highlight');
      state.hoveredElement = null;
    }
  }

  function clearHighlights() {
    document.querySelectorAll('.websuddhi-pick-highlight').forEach(el => {
      el.classList.remove('websuddhi-pick-highlight');
    });
  }

  function handlePickClick(e) {
    if (!state.pickMode) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // Determine target element based on modifiers
    let targetElement = e.target;
    if (state.pickModeShiftHeld && e.target.parentElement && e.target.parentElement !== document.body) {
      targetElement = e.target.parentElement;
    }

    // Generate selector based on modifiers
    const selector = state.pickModeCtrlHeld
      ? getSpecificSelector(targetElement)
      : getUniqueSelector(targetElement);

    showConfirmDialog(selector, targetElement);
  }

  // ============================================
  // SELECTOR GENERATION
  // ============================================
  function getUniqueSelector(element) {
    if (!element || element === document.body) return 'body';

    // Try ID
    if (element.id && document.getElementById(element.id) === element) {
      return '#' + CSS.escape(element.id);
    }

    // Try unique class combination
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/)
        .filter(c => c && !c.startsWith('websuddhi'));
      if (classes.length > 0) {
        const classSelector = '.' + classes.map(c => CSS.escape(c)).join('.');
        try {
          if (document.querySelectorAll(classSelector).length === 1) {
            return classSelector;
          }
        } catch (err) {}
      }
    }

    // Try data attributes
    const dataAttrs = [];
    for (const attr of element.attributes) {
      if (attr.name.startsWith('data-') && attr.value && !attr.name.startsWith('data-websuddhi')) {
        dataAttrs.push('[' + attr.name + '="' + CSS.escape(attr.value) + '"]');
        if (dataAttrs.length >= 2) break;
      }
    }
    if (dataAttrs.length > 0) {
      const selector = element.tagName.toLowerCase() + dataAttrs.join('');
      try {
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      } catch (err) {}
    }

    // Build DOM path
    const path = [];
    let el = element;

    while (el && el !== document.documentElement && path.length < 5) {
      let selector = el.tagName.toLowerCase();

      if (el.id) {
        selector += '#' + CSS.escape(el.id);
        path.unshift(selector);
        break;
      }

      let sibling = el.previousElementSibling;
      let nth = 1;
      while (sibling) {
        if (sibling.tagName === el.tagName) nth++;
        sibling = sibling.previousElementSibling;
      }
      selector += ':nth-of-type(' + nth + ')';

      path.unshift(selector);
      el = el.parentElement;
    }

    return path.join(' > ');
  }

  // ============================================
  // UI DIALOGS
  // ============================================
  function showPreview(element) {
    let preview = document.querySelector('.websuddhi-pick-preview');
    if (!preview) {
      preview = document.createElement('div');
      preview.className = 'websuddhi-pick-preview';
      document.body.appendChild(preview);
    }

    const rect = element.getBoundingClientRect();
    const selector = getUniqueSelector(element);
    const tagName = element.tagName.toLowerCase();
    const dims = Math.round(rect.width) + 'x' + Math.round(rect.height);

    preview.innerHTML =
      '<div class="websuddhi-pick-info">' +
        '<span>Click to block</span>' +
        '<code>' + escapeHtml(selector.substring(0, 80)) + (selector.length > 80 ? '...' : '') + '</code>' +
        '<span class="websuddhi-pick-hint">&lt;' + tagName + '&gt; ' + dims + ' | Esc to cancel</span>' +
      '</div>';

    const padding = 10;
    let top = rect.bottom + padding;
    let left = rect.left;

    if (left + 300 > window.innerWidth) {
      left = window.innerWidth - 320;
    }
    if (left < 10) left = 10;
    if (top + 100 > window.innerHeight) {
      top = rect.top - 110;
    }
    if (top < 0) top = 10;

    preview.style.cssText =
      'position:fixed!important;z-index:2147483647!important;' +
      'top:' + top + 'px!important;left:' + left + 'px!important;';
  }

  function removePickListeners() {
    document.removeEventListener('mouseover', handleMouseOver, true);
    document.removeEventListener('mouseout', handleMouseOut, true);
    document.removeEventListener('click', handlePickClick, true);
    document.removeEventListener('contextmenu', handlePickClick, true);
    document.removeEventListener('keydown', handlePickKeyDown, true);
    document.removeEventListener('keyup', handlePickKeyUp, true);
  }

  function addPickListeners() {
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handlePickClick, true);
    document.addEventListener('contextmenu', handlePickClick, true);
    document.addEventListener('keydown', handlePickKeyDown, true);
    document.addEventListener('keyup', handlePickKeyUp, true);
  }

  function showConfirmDialog(selector, element) {
    // Remove existing dialog
    const existingDialog = document.querySelector('.websuddhi-pick-dialog');
    if (existingDialog) existingDialog.remove();

    // Fully remove all capture-phase listeners so nothing intercepts dialog clicks
    removePickListeners();
    document.body.classList.remove('websuddhi-pick-mode');
    clearHighlights();
    removePreviewPanel();

    const dialog = document.createElement('div');
    dialog.className = 'websuddhi-pick-dialog';
    dialog.style.cssText = 'position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;z-index:2147483647!important;display:flex!important;align-items:center!important;justify-content:center!important;pointer-events:auto!important;cursor:default!important;';

    const content = document.createElement('div');
    content.className = 'websuddhi-pick-content';
    content.style.cssText = 'pointer-events:auto!important;';

    const titleEl = document.createElement('div');
    titleEl.className = 'websuddhi-pick-title';
    titleEl.textContent = 'Block this element?';
    content.appendChild(titleEl);

    const selectorEl = document.createElement('code');
    selectorEl.className = 'websuddhi-pick-selector';
    selectorEl.textContent = selector;
    content.appendChild(selectorEl);

    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'websuddhi-pick-buttons';
    buttonsDiv.style.cssText = 'pointer-events:auto!important;';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'websuddhi-btn confirm';
    confirmBtn.textContent = 'Block';
    confirmBtn.style.cssText = 'pointer-events:auto!important;cursor:pointer!important;';
    buttonsDiv.appendChild(confirmBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'websuddhi-btn cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'pointer-events:auto!important;cursor:pointer!important;';
    buttonsDiv.appendChild(cancelBtn);

    content.appendChild(buttonsDiv);
    dialog.appendChild(content);
    document.body.appendChild(dialog);

    // Focus the confirm button so keyboard works immediately
    confirmBtn.focus();

    function closeDialog() {
      if (dialog.parentNode) dialog.remove();
    }

    // Escape key closes dialog (simple, no capture needed)
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDialog();
        document.removeEventListener('keydown', onKeyDown);
        resumePickMode();
      }
    }
    document.addEventListener('keydown', onKeyDown);

    function resumePickMode() {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.add('websuddhi-pick-mode');
      addPickListeners();
      createPreviewPanel();
    }

    confirmBtn.addEventListener('click', async () => {
      try {
        if (state.blockedSelectors.size >= 500) {
          showToast('Rule limit reached (500). Remove old rules first.');
          closeDialog();
          stopPickMode();
          return;
        }
        state.blockedSelectors.set(selector, {
          url: window.location.hostname,
          date: Date.now(),
          source: 'pick'
        });
        await saveSelectors();
        blockSelector(selector);
        try { await sendMessage({ type: 'ADD_SELECTOR', selector }); } catch (e) {}
        closeDialog();
        document.removeEventListener('keydown', onKeyDown);
        stopPickMode();
        showToast('Element blocked and rule saved');
      } catch (err) {
        logError('Failed to add selector:', err);
      }
    });

    cancelBtn.addEventListener('click', () => {
      closeDialog();
      resumePickMode();
    });

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        closeDialog();
        resumePickMode();
      }
    });
  }

  function removeToast() {
    const toast = document.querySelector('.websuddhi-toast');
    if (toast) toast.remove();
  }

  function showToast(message) {
    // Remove existing toast
    const existing = document.querySelector('.websuddhi-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'websuddhi-toast';
    toast.textContent = message;
    toast.style.cssText =
      'position:fixed!important;bottom:20px!important;left:50%!important;' +
      'transform:translateX(-50%)!important;' +
      'background:linear-gradient(135deg,#0ea5e9,#0284c7)!important;' +
      'color:white!important;padding:12px 24px!important;border-radius:8px!important;' +
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif!important;' +
      'font-size:14px!important;z-index:2147483647!important;' +
      'box-shadow:0 4px 16px rgba(0,0,0,0.3)!important;' +
      'animation:websuddhi-fade-in 0.3s ease!important;';
    document.body.appendChild(toast);

    if (!document.querySelector('#websuddhi-styles')) {
      const style = document.createElement('style');
      style.id = 'websuddhi-styles';
      style.textContent =
        '@keyframes websuddhi-fade-in{from{opacity:0;transform:translate(-50%,20px)}to{opacity:1;transform:translate(-50%,0)}}' +
        '@keyframes websuddhi-fade-out{from{opacity:1}to{opacity:0}}';
      document.head.appendChild(style);
    }

    // Auto-close after configurable duration (default 3 seconds)
    const duration = (state.toastDuration || 3) * 1000;
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'websuddhi-fade-out 0.3s ease';
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
      }
    }, duration);
  }

  // ============================================
  // UTILITIES
  // ============================================
  async function saveSelectors() {
    const data = Array.from(state.blockedSelectors.entries()).map(([selector, info]) => ({
      selector,
      hostname: info.url || info.hostname,
      date: info.date
    }));
    await setStorage({ blockedSelectors: data });
  }

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      if (typeof browser !== 'undefined' && browser.runtime) {
        browser.runtime.sendMessage(message).then(resolve).catch(reject);
      } else if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve(response);
        });
      } else {
        reject(new Error('No messaging API available'));
      }
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.textContent;
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
