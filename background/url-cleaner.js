// WebSuddhi - URL Tracking Parameter Stripping
// Phase 2: Remove tracking parameters from URLs
// MV3: Static rules handle everything; toggle via updateEnabledRulesets
// MV2: webRequest.onBeforeRequest redirect

(function() {
  'use strict';

  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

  if (!self.WebSuddhi) self.WebSuddhi = {};

  // Logging helpers
  const logError = (...args) => {
    if (self.WebSuddhi.utils && self.WebSuddhi.utils.error) {
      self.WebSuddhi.utils.error(...args);
    }
  };

  // Tracking parameters to strip
  const TRACKING_PARAMS = new Set([
    // Google
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'utm_id', 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic',
    'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid',
    // Facebook
    'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_source', 'fb_ref',
    // Microsoft
    'msclkid',
    // Twitter
    'twclid',
    // Mailchimp
    'mc_cid', 'mc_eid',
    // Yandex
    'yclid', '_openstat',
    // HubSpot
    '_hsenc', '_hsmi', 'hsa_cam', 'hsa_grp', 'hsa_mt', 'hsa_src',
    'hsa_ad', 'hsa_acc', 'hsa_net', 'hsa_ver', 'hsa_la', 'hsa_ol', 'hsa_kw',
    // Google Analytics
    '_ga', '_gl', '_gac',
    // Social
    'igshid', 'si',
    // Alibaba
    'spm', 'scm',
    // LinkedIn
    'trk', 'trkInfo', 'li_fat_id',
    // Adobe
    's_kwcid', 'ef_id',
    // Pinterest
    'epik',
    // Generic
    'pp', 'cp', 'wickedid',
    'oly_enc_id', 'oly_anon_id',
    'vero_id', 'vero_conv',
    'nr_email_referer',
    'sscid', 'gdfms', 'gdftrk', 'gdffi',
    '_ke',
    // Matomo
    'mtm_source', 'mtm_medium', 'mtm_campaign', 'mtm_keyword', 'mtm_cid', 'mtm_content',
    'pk_source', 'pk_medium', 'pk_campaign', 'pk_keyword', 'pk_cid', 'pk_content'
  ]);

  // ============================================
  // INITIALIZATION
  // ============================================
  async function initUrlCleaner() {
    const storage = await getStorage(['urlCleaningEnabled']);
    const enabled = storage.urlCleaningEnabled !== false;

    if (!enabled) return;

    if (api.declarativeNetRequest) {
      // MV3: Static rules from tracking-params.json handle this
      // Nothing extra needed - rules auto-loaded
    } else if (api.webRequest && api.webRequest.onBeforeRequest) {
      // MV2: webRequest redirect
      setupWebRequestCleaner();
    }
  }

  // ============================================
  // MV2: WEBREQUEST URL CLEANING
  // ============================================
  function setupWebRequestCleaner() {
    api.webRequest.onBeforeRequest.addListener(
      (details) => {
        if (details.type !== 'main_frame' && details.type !== 'sub_frame') return {};

        try {
          const url = new URL(details.url);
          let modified = false;

          for (const param of Array.from(url.searchParams.keys())) {
            if (TRACKING_PARAMS.has(param)) {
              url.searchParams.delete(param);
              modified = true;
            }
          }

          if (modified) {
            return { redirectUrl: url.toString() };
          }
        } catch (e) {}

        return {};
      },
      { urls: ['<all_urls>'] },
      ['blocking']
    );
  }

  // ============================================
  // TOGGLE
  // ============================================
  async function toggleUrlCleaning(enabled) {
    await setStorage({ urlCleaningEnabled: enabled });

    if (api.declarativeNetRequest) {
      try {
        await api.declarativeNetRequest.updateEnabledRulesets({
          enableRulesetIds: enabled ? ['tracking_params'] : [],
          disableRulesetIds: enabled ? [] : ['tracking_params']
        });
      } catch (e) {
        logError('Failed to toggle URL cleaning ruleset:', e);
      }
    }

    return { success: true, enabled };
  }

  // Shared storage (utils.js is loaded via importScripts before this file)
  const getStorage = self.WebSuddhi.utils.getStorage;
  const setStorage = self.WebSuddhi.utils.setStorage;

  // ============================================
  // EXPOSE API
  // ============================================
  self.WebSuddhi.urlCleaner = {
    init: initUrlCleaner,
    toggleUrlCleaning
  };

  // Auto-init
  initUrlCleaner().catch(err => {
    logError('URL cleaner init error:', err);
  });
})();
