/**
 * @module popup/security
 * @description Security information display, certificate details, and
 * third-party frame management for the popup UI.
 *
 * @version 2.1.0
 */
'use strict';

import { elements, showToast } from './dom.js';
import {
  sendToBackground, sendToBackgroundWithFallback, sendToContentScript,
  normalizeFrameList, extractCertificate,
} from './api.js';

// ============================================
// SECURITY INFO
// ============================================

/**
 * Update the security section UI based on the current tab URL.
 *
 * @param {URL|null} url - Parsed URL of the active tab.
 */
export function updateSecurityInfo(url) {
  if (!elements.siteInfoSection) return;

  const iconSecure   = elements.siteIcon?.querySelector('.icon-secure');
  const iconInsecure = elements.siteIcon?.querySelector('.icon-insecure');
  const mascotHappy  = elements.siteMascot?.querySelector('.mascot-happy');
  const mascotWorried = elements.siteMascot?.querySelector('.mascot-worried');

  if (!url) {
    setSecurityState('insecure', 'Unknown', '???', 'Not Available');
    return;
  }

  const isSecure    = url.protocol === 'https:';
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const isExtension = url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:';
  const isFile      = url.protocol === 'file:';

  if (isSecure || isExtension) {
    setSecurityState('secure', 'Secure Connection', 'HTTPS', 'TLS Encrypted');
  } else if (isLocalhost) {
    setSecurityState('secure', 'Local Development', 'localhost', 'Trusted Local');
  } else if (isFile) {
    setSecurityState('secure', 'Local File', 'file://', 'Local Access');
  } else {
    setSecurityState('insecure', 'Not Secure', 'HTTP', 'Unencrypted');
  }

  /**
   * Apply visual security state to all relevant DOM elements.
   * @param {'secure'|'insecure'} state
   * @param {string} text
   * @param {string} protocol
   * @param {string} certTypeLabel
   */
  function setSecurityState(state, text, protocol, certTypeLabel) {
    const isInsecure = state === 'insecure';
    elements.siteInfoSection.classList.toggle('insecure', isInsecure);

    if (iconSecure)    iconSecure.style.display   = isInsecure ? 'none' : 'block';
    if (iconInsecure)  iconInsecure.style.display  = isInsecure ? 'block' : 'none';
    if (mascotHappy)   mascotHappy.style.display   = isInsecure ? 'none' : 'block';
    if (mascotWorried) mascotWorried.style.display = isInsecure ? 'block' : 'none';

    if (elements.securityBadge) elements.securityBadge.className = 'security-badge ' + state;
    if (elements.securityText)  elements.securityText.textContent  = text;
    if (elements.certProtocol)  elements.certProtocol.textContent  = protocol;
    if (elements.certType)      elements.certType.textContent      = certTypeLabel;
  }
}

// ============================================
// CERTIFICATE OWNER & FRAMES
// ============================================

/**
 * Load certificate owner info and third-party frames from the background,
 * falling back to the content script if needed.
 *
 * @param {chrome.tabs.Tab} currentTab
 */
export async function loadSecurityDetails(currentTab) {
  if (!currentTab?.id) return;

  try {
    const securityInfo = await sendToBackgroundWithFallback(
      ['GET_SECURITY_INFO', 'GET_TAB_SECURITY_INFO', 'GET_TAB_SECURITY'],
      { tabId: currentTab.id },
    ) || {};

    // --- Certificate owner ---
    if (elements.certOwnerSection) {
      const cert = extractCertificate(securityInfo);
      const org  = cert?.organization || cert?.org || securityInfo?.organization || '';

      if (org) {
        elements.certOwnerName.textContent = org;
        const details = [];
        const issuer = cert?.issuer || cert?.issuedBy || securityInfo?.issuer;
        if (issuer && issuer !== org) details.push('Issuer: ' + issuer);
        if (cert?.validFrom || cert?.notBefore) details.push('From: ' + (cert.validFrom || cert.notBefore));
        if (cert?.validTo || cert?.notAfter)     details.push('Until: ' + (cert.validTo || cert.notAfter));
        elements.certOwnerDetails.textContent = details.join(' | ');
        elements.certOwnerSection.style.display = 'block';
      } else {
        elements.certOwnerSection.style.display = 'none';
      }
    }

    // --- Third-party frames ---
    let allowedFrames = normalizeFrameList(
      securityInfo?.thirdPartyDomains || securityInfo?.allowedFrames ||
      securityInfo?.frames?.allowed   || securityInfo?.frameInfo?.allowed,
      false,
    );
    let blockedFrames = normalizeFrameList(
      securityInfo?.blockedFrames || securityInfo?.frames?.blocked ||
      securityInfo?.frameInfo?.blocked,
      true,
    );

    // Fallback: ask content script
    if (allowedFrames.length === 0 && blockedFrames.length === 0) {
      try {
        const res = await sendToContentScript({ type: 'GET_FRAMES' }, currentTab);
        const frames = Array.isArray(res?.frames) ? res.frames : [];
        allowedFrames = normalizeFrameList(frames.filter((f) => f?.blocked !== true), false);
        blockedFrames = normalizeFrameList(frames.filter((f) => f?.blocked === true), true);
      } catch (_) { /* content script may not be available */ }
    }

    if (elements.framesSection) {
      if (allowedFrames.length > 0 || blockedFrames.length > 0) {
        renderFramesList(allowedFrames, blockedFrames, currentTab);
        elements.framesSection.style.display = 'block';
      } else {
        elements.framesSection.style.display = 'none';
      }
    }
  } catch (_) {
    // Security info is non-critical – fail silently
  }
}

// ============================================
// FRAMES LIST RENDERING
// ============================================

/**
 * Render allowed and blocked frames in the popup frames section.
 *
 * @param {Array} allowed
 * @param {Array} blocked
 * @param {chrome.tabs.Tab} currentTab
 */
function renderFramesList(allowed, blocked, currentTab) {
  if (!elements.framesList) return;

  while (elements.framesList.firstChild) {
    elements.framesList.removeChild(elements.framesList.firstChild);
  }

  // Blocked frames first (with allow button)
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
    allowBtn.addEventListener('click', () => handleAllowFrame(frame.host, frame.url, currentTab));
    item.appendChild(allowBtn);

    elements.framesList.appendChild(item);
  }

  // Allowed frames
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

  if (elements.framesCount) {
    elements.framesCount.textContent = allowed.length + blocked.length;
  }
}

/**
 * Handle the "Allow" button click for a blocked frame.
 *
 * @param {string} host
 * @param {string} url
 * @param {chrome.tabs.Tab} currentTab
 */
async function handleAllowFrame(host, url, currentTab) {
  try {
    await sendToBackgroundWithFallback(
      ['ALLOW_FRAME', 'ALLOW_THIRD_PARTY_FRAME', 'UNBLOCK_FRAME'],
      { tabId: currentTab.id, frameHost: host, frameUrl: url, host, url },
    );
    await sendToContentScript({ type: 'ALLOW_FRAME', frameHost: host }, currentTab);
    showToast('Allowed: ' + host);
    await loadSecurityDetails(currentTab);
  } catch (_) {
    showToast('Failed to allow frame');
  }
}

/**
 * Update the frames list when the content script reports new frames.
 *
 * @param {Array} frames
 */
export function updateFramesFromContent(frames) {
  if (!elements.framesList || !frames.length) return;

  const existingHosts = new Set();
  elements.framesList.querySelectorAll('.frame-host').forEach((el) => {
    existingHosts.add(el.textContent);
  });

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
      // Note: currentTab is not available in this context, so allow may require a page refresh
      allowBtn.addEventListener('click', async () => {
        try {
          await sendToBackground({ type: 'ALLOW_FRAME', frameHost: frame.host, frameUrl: frame.src });
          showToast('Allowed: ' + frame.host);
        } catch (_) {
          showToast('Failed to allow frame');
        }
      });
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

  if (elements.framesCount) {
    elements.framesCount.textContent = existingHosts.size;
  }
  if (existingHosts.size > 0 && elements.framesSection) {
    elements.framesSection.style.display = 'block';
  }
}
