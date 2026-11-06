// WebSuddhi - phishing warning overlay.
//
// Not a manifest content script. When CHECK_PHISHING flags the current site,
// the background injects this file into the top frame before it replies, so
// the warning costs no extra round trip. Sites that aren't flagged (nearly all)
// never parse it. Helpers come from self.__wsCore (isolated world only).

(function () {
  'use strict';

  if (self.__wsPhishingUI) return;
  const core = self.__wsCore;
  if (!core) return;

  const { normalizeWarningDomain, sendMessageEarly } = core;

  const phishingWarningState = {
    overlay: null,
    observer: null,
    domain: null
  };

  // Show full-page phishing warning overlay
  function showPhishingWarning(data) {
    const originalDomain = normalizeWarningDomain(data?.originalDomain || window.location.hostname);
    if (!originalDomain) return;

    // Remove stale overlay before creating a fresh one.
    dismissPhishingWarning(null, null, null, { persistDismissal: false });

    // Check if user already dismissed warning for this domain in this session
    try {
      if (sessionStorage.getItem('websuddhi_phishing_dismissed_' + originalDomain) === 'true') {
        return; // Don't show warning again
      }
    } catch (e) {
      // Session storage might not be available
    }

    // Normalize data fields (phishing detector uses matchedDomain, we want realDomain for display)
    const realDomain = data.realDomain || data.matchedDomain || 'unknown';
    const matchedBrand = data.matchedBrand || 'Unknown';
    const displayDomain = data.originalDomain || window.location.hostname;
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
    strong.textContent = displayDomain;
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
    fakeValue.textContent = displayDomain;
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
    const proceedBaseText = 'Proceed to ' + displayDomain;
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
      confirmLabel.textContent = 'Type "' + displayDomain + '" to confirm you want to continue:';
      details.appendChild(confirmLabel);

      domainConfirmInput = document.createElement('input');
      domainConfirmInput.type = 'text';
      domainConfirmInput.autocomplete = 'off';
      domainConfirmInput.spellcheck = false;
      domainConfirmInput.placeholder = displayDomain;
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
    const rootNode = document.documentElement || document;
    if (rootNode && rootNode.insertBefore) {
      try {
        rootNode.insertBefore(overlay, rootNode.firstChild);
      } catch (e) {
        rootNode.appendChild(overlay);
      }
    } else {
      return;
    }
    phishingWarningState.overlay = overlay;
    phishingWarningState.observer = null;
    phishingWarningState.domain = originalDomain;

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
    const observerTarget = document.documentElement || document.body || document;
    bodyObserver.observe(observerTarget, { childList: true, subtree: true });
    phishingWarningState.observer = bodyObserver;

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
  function dismissPhishingWarning(overlay, observer, domain, options = {}) {
    const targetOverlay = overlay || phishingWarningState.overlay;
    const targetObserver = observer || phishingWarningState.observer;
    const targetDomain = normalizeWarningDomain(domain || phishingWarningState.domain);
    const persistDismissal = options.persistDismissal !== false;

    // Stop the observer
    if (targetObserver) {
      targetObserver.disconnect();
    }

    // Remove the overlay
    if (targetOverlay && targetOverlay.parentNode) {
      targetOverlay.parentNode.removeChild(targetOverlay);
    }
    if (phishingWarningState.overlay === targetOverlay) {
      phishingWarningState.overlay = null;
      phishingWarningState.observer = null;
      phishingWarningState.domain = null;
    }

    // Restore body display
    if (document.body) {
      document.body.style.removeProperty('display');
      document.body.removeAttribute('data-websuddhi-phishing-hidden');
    }

    // Store in session that user dismissed for this domain
    try {
      if (targetDomain && persistDismissal) {
        sessionStorage.setItem('websuddhi_phishing_dismissed_' + targetDomain, 'true');
      } else if (targetDomain) {
        sessionStorage.removeItem('websuddhi_phishing_dismissed_' + targetDomain);
      }
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

  self.__wsPhishingUI = { show: showPhishingWarning, dismiss: dismissPhishingWarning };
})();
