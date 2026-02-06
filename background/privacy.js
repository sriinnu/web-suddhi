// WebSuddhi - Privacy Features
// Phase 6: Referrer stripping, WebRTC leak prevention, ping protection

(function() {
  'use strict';

  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

  if (!self.WebSuddhi) self.WebSuddhi = {};

  // Logging helpers
  const logError = (...args) => {
    if (self.WebSuddhi.utils && self.WebSuddhi.utils.error) {
      self.WebSuddhi.utils.error(...args);
    } else {
      console.error('[WebSuddhi]', ...args);
    }
  };

  // Dynamic rule IDs for privacy features
  const REFERRER_RULE_ID = 30001;
  const PING_BLOCK_RULE_ID = 30002;
  const TELEMETRY_RULE_ID_START = 30100;
  const THIRD_PARTY_COOKIE_RULE_ID = 30003;

  // Known telemetry/analytics domains to block
  const TELEMETRY_DOMAINS = [
    'google-analytics.com', 'googletagmanager.com', 'googletagservices.com',
    'analytics.google.com', 'ssl.google-analytics.com',
    'segment.io', 'segment.com', 'cdn.segment.com',
    'mixpanel.com', 'api.mixpanel.com', 'cdn.mxpnl.com',
    'amplitude.com', 'api.amplitude.com',
    'hotjar.com', 'static.hotjar.com', 'script.hotjar.com',
    'fullstory.com', 'rs.fullstory.com',
    'heap.io', 'heapanalytics.com',
    'mouseflow.com', 'cdn.mouseflow.com',
    'crazyegg.com', 'script.crazyegg.com',
    'luckyorange.com', 'cdn.luckyorange.net',
    'clarity.ms', 'www.clarity.ms',
    'plausible.io', 'umami.is',
    'matomo.cloud', 'piwik.pro',
    'newrelic.com', 'js-agent.newrelic.com', 'bam.nr-data.net',
    'sentry.io', 'browser.sentry-cdn.com',
    'bugsnag.com', 'd2wy8f7a9ursnm.cloudfront.net',
    'raygun.com', 'raygun.io',
    'logrocket.com', 'cdn.logrocket.io',
    'smartlook.com', 'rec.smartlook.com',
    'inspectlet.com', 'cdn.inspectlet.com',
    'quantserve.com', 'pixel.quantserve.com',
    'scorecardresearch.com', 'sb.scorecardresearch.com',
    'comscore.com', 'b.scorecardresearch.com',
    'facebook.com/tr', 'connect.facebook.net',
    'bat.bing.com', 'clarity.ms',
    'analytics.tiktok.com', 'analytics.twitter.com',
    'snap.licdn.com', 'px.ads.linkedin.com',
    'ct.pinterest.com', 'analytics.pinterest.com'
  ];

  // ============================================
  // INITIALIZATION
  // ============================================
  async function initPrivacy() {
    const storage = await getStorage([
      'referrerStrippingEnabled',
      'webrtcProtectionEnabled',
      'pingProtectionEnabled',
      'telemetryBlockingEnabled',
      'thirdPartyCookieBlockingEnabled'
    ]);

    // Apply settings (respecting defaults)
    if (storage.referrerStrippingEnabled === true) {
      await enableReferrerStripping();
    }

    if (storage.webrtcProtectionEnabled === true) {
      await enableWebRTCProtection();
    }

    // Ping protection is ON by default
    if (storage.pingProtectionEnabled !== false) {
      await enablePingProtection();
    }

    // Telemetry blocking (OFF by default)
    if (storage.telemetryBlockingEnabled === true) {
      await enableTelemetryBlocking();
    }

    // Third-party cookie blocking (OFF by default)
    if (storage.thirdPartyCookieBlockingEnabled === true) {
      await enableThirdPartyCookieBlocking();
    }
  }

  // ============================================
  // REFERRER STRIPPING
  // ============================================
  async function enableReferrerStripping() {
    if (api.declarativeNetRequest) {
      // MV3: Add dynamic modifyHeaders rule
      try {
        await api.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: [REFERRER_RULE_ID],
          addRules: [{
            id: REFERRER_RULE_ID,
            priority: 1,
            action: {
              type: 'modifyHeaders',
              requestHeaders: [{
                header: 'Referer',
                operation: 'remove'
              }]
            },
            condition: {
              domainType: 'thirdParty',
              resourceTypes: [
                'script', 'image', 'xmlhttprequest', 'sub_frame',
                'stylesheet', 'font', 'media', 'websocket', 'ping', 'other'
              ]
            }
          }]
        });
      } catch (e) {
        logError('Failed to enable referrer stripping:', e);
      }
    } else if (api.webRequest && api.webRequest.onBeforeSendHeaders) {
      // MV2: webRequest header modification
      if (!self._webSuddhiReferrerListener) {
        self._webSuddhiReferrerListener = (details) => {
          // Only strip on third-party requests
          try {
            const requestUrl = new URL(details.url);
            const initiator = details.initiator || details.documentUrl || '';
            if (initiator) {
              const initiatorHost = new URL(initiator).hostname;
              if (requestUrl.hostname === initiatorHost) return {};
            }
          } catch (e) {}

          const headers = details.requestHeaders.filter(
            h => h.name.toLowerCase() !== 'referer'
          );
          return { requestHeaders: headers };
        };

        api.webRequest.onBeforeSendHeaders.addListener(
          self._webSuddhiReferrerListener,
          { urls: ['<all_urls>'] },
          ['blocking', 'requestHeaders']
        );
      }
    }
  }

  async function disableReferrerStripping() {
    if (api.declarativeNetRequest) {
      try {
        await api.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: [REFERRER_RULE_ID]
        });
      } catch (e) {}
    } else if (api.webRequest && self._webSuddhiReferrerListener) {
      api.webRequest.onBeforeSendHeaders.removeListener(self._webSuddhiReferrerListener);
      self._webSuddhiReferrerListener = null;
    }
  }

  async function toggleReferrerStripping(enabled) {
    await setStorage({ referrerStrippingEnabled: enabled });
    if (enabled) {
      await enableReferrerStripping();
    } else {
      await disableReferrerStripping();
    }
    return { success: true, enabled };
  }

  // ============================================
  // WEBRTC IP LEAK PREVENTION
  // ============================================
  async function enableWebRTCProtection() {
    try {
      if (api.privacy && api.privacy.network && api.privacy.network.webRTCIPHandlingPolicy) {
        await new Promise((resolve, reject) => {
          api.privacy.network.webRTCIPHandlingPolicy.set(
            { value: 'disable_non_proxied_udp' },
            () => {
              if (api.runtime.lastError) reject(api.runtime.lastError);
              else resolve();
            }
          );
        });
      }
    } catch (e) {
      logError('Failed to set WebRTC policy:', e);
    }
  }

  async function disableWebRTCProtection() {
    try {
      if (api.privacy && api.privacy.network && api.privacy.network.webRTCIPHandlingPolicy) {
        await new Promise((resolve, reject) => {
          api.privacy.network.webRTCIPHandlingPolicy.set(
            { value: 'default' },
            () => {
              if (api.runtime.lastError) reject(api.runtime.lastError);
              else resolve();
            }
          );
        });
      }
    } catch (e) {
      logError('Failed to reset WebRTC policy:', e);
    }
  }

  async function toggleWebRTCProtection(enabled) {
    await setStorage({ webrtcProtectionEnabled: enabled });
    if (enabled) {
      await enableWebRTCProtection();
    } else {
      await disableWebRTCProtection();
    }
    return { success: true, enabled };
  }

  // ============================================
  // PING (HYPERLINK AUDITING) PROTECTION
  // ============================================
  async function enablePingProtection() {
    if (api.declarativeNetRequest) {
      // MV3: Block ping resource type
      try {
        await api.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: [PING_BLOCK_RULE_ID],
          addRules: [{
            id: PING_BLOCK_RULE_ID,
            priority: 1,
            action: { type: 'block' },
            condition: {
              resourceTypes: ['ping']
            }
          }]
        });
      } catch (e) {
        logError('Failed to enable ping blocking:', e);
      }
    }
    // Content script side handles removing ping attributes from <a> elements
  }

  async function disablePingProtection() {
    if (api.declarativeNetRequest) {
      try {
        await api.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: [PING_BLOCK_RULE_ID]
        });
      } catch (e) {}
    }
  }

  async function togglePingProtection(enabled) {
    await setStorage({ pingProtectionEnabled: enabled });
    if (enabled) {
      await enablePingProtection();
    } else {
      await disablePingProtection();
    }
    return { success: true, enabled };
  }

  // ============================================
  // TELEMETRY BLOCKING
  // ============================================
  async function enableTelemetryBlocking() {
    if (api.declarativeNetRequest) {
      // MV3: Add dynamic rules for telemetry domains
      try {
        const rules = TELEMETRY_DOMAINS.map((domain, index) => ({
          id: TELEMETRY_RULE_ID_START + index,
          priority: 2,
          action: { type: 'block' },
          condition: {
            urlFilter: '||' + domain,
            resourceTypes: [
              'script', 'image', 'xmlhttprequest', 'sub_frame',
              'ping', 'other', 'websocket'
            ]
          }
        }));

        // Remove existing rules first
        const existingIds = TELEMETRY_DOMAINS.map((_, i) => TELEMETRY_RULE_ID_START + i);
        await api.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: existingIds,
          addRules: rules
        });
      } catch (e) {
        logError('Failed to enable telemetry blocking:', e);
      }
    } else if (api.webRequest && api.webRequest.onBeforeRequest) {
      // MV2: webRequest blocking
      if (!self._webSuddhiTelemetryListener) {
        self._webSuddhiTelemetryListener = (details) => {
          try {
            const url = new URL(details.url);
            for (const domain of TELEMETRY_DOMAINS) {
              if (url.hostname === domain || url.hostname.endsWith('.' + domain)) {
                return { cancel: true };
              }
            }
          } catch (e) {}
          return {};
        };

        api.webRequest.onBeforeRequest.addListener(
          self._webSuddhiTelemetryListener,
          { urls: ['<all_urls>'] },
          ['blocking']
        );
      }
    }
  }

  async function disableTelemetryBlocking() {
    if (api.declarativeNetRequest) {
      try {
        const existingIds = TELEMETRY_DOMAINS.map((_, i) => TELEMETRY_RULE_ID_START + i);
        await api.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: existingIds
        });
      } catch (e) {}
    } else if (api.webRequest && self._webSuddhiTelemetryListener) {
      api.webRequest.onBeforeRequest.removeListener(self._webSuddhiTelemetryListener);
      self._webSuddhiTelemetryListener = null;
    }
  }

  async function toggleTelemetryBlocking(enabled) {
    await setStorage({ telemetryBlockingEnabled: enabled });
    if (enabled) {
      await enableTelemetryBlocking();
    } else {
      await disableTelemetryBlocking();
    }
    return { success: true, enabled };
  }

  // ============================================
  // THIRD-PARTY COOKIE BLOCKING
  // ============================================
  async function enableThirdPartyCookieBlocking() {
    try {
      if (api.privacy && api.privacy.websites && api.privacy.websites.thirdPartyCookiesAllowed) {
        await new Promise((resolve, reject) => {
          api.privacy.websites.thirdPartyCookiesAllowed.set(
            { value: false },
            () => {
              if (api.runtime.lastError) reject(api.runtime.lastError);
              else resolve();
            }
          );
        });
      } else if (api.declarativeNetRequest) {
        // MV3 fallback: Remove Set-Cookie headers from third-party responses
        try {
          await api.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [THIRD_PARTY_COOKIE_RULE_ID],
            addRules: [{
              id: THIRD_PARTY_COOKIE_RULE_ID,
              priority: 1,
              action: {
                type: 'modifyHeaders',
                responseHeaders: [{
                  header: 'Set-Cookie',
                  operation: 'remove'
                }]
              },
              condition: {
                domainType: 'thirdParty',
                resourceTypes: [
                  'script', 'image', 'xmlhttprequest', 'sub_frame',
                  'stylesheet', 'font', 'media', 'websocket', 'other'
                ]
              }
            }]
          });
        } catch (e) {
          logError('Failed to add cookie blocking rule:', e);
        }
      }
    } catch (e) {
      logError('Failed to enable third-party cookie blocking:', e);
    }
  }

  async function disableThirdPartyCookieBlocking() {
    try {
      if (api.privacy && api.privacy.websites && api.privacy.websites.thirdPartyCookiesAllowed) {
        await new Promise((resolve, reject) => {
          api.privacy.websites.thirdPartyCookiesAllowed.set(
            { value: true },
            () => {
              if (api.runtime.lastError) reject(api.runtime.lastError);
              else resolve();
            }
          );
        });
      } else if (api.declarativeNetRequest) {
        try {
          await api.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [THIRD_PARTY_COOKIE_RULE_ID]
          });
        } catch (e) {}
      }
    } catch (e) {
      logError('Failed to reset third-party cookie setting:', e);
    }
  }

  async function toggleThirdPartyCookieBlocking(enabled) {
    await setStorage({ thirdPartyCookieBlockingEnabled: enabled });
    if (enabled) {
      await enableThirdPartyCookieBlocking();
    } else {
      await disableThirdPartyCookieBlocking();
    }
    return { success: true, enabled };
  }

  // Use shared storage helpers from utils.js
  const getStorage = self.WebSuddhi?.utils?.getStorage || function(keys) {
    return new Promise((resolve) => resolve({}));
  };
  const setStorage = self.WebSuddhi?.utils?.setStorage || function() {
    return Promise.resolve();
  };

  // ============================================
  // EXPOSE API
  // ============================================
  self.WebSuddhi.privacy = {
    init: initPrivacy,
    toggleReferrerStripping,
    toggleWebRTCProtection,
    togglePingProtection,
    toggleTelemetryBlocking,
    toggleThirdPartyCookieBlocking
  };

  // Auto-init
  initPrivacy().catch(err => {
    logError('privacy init error:', err);
  });
})();
