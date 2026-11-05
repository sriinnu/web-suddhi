// WebSuddhi v2.3.0 - iOS Safari Background Script

const DEFAULT_SETTINGS = {
  enabled: true,
  paywallEnabled: true,
  cookieConsentEnabled: true,
  annoyanceBlockingEnabled: true,
  blockedSelectors: [],
  whitelistedSites: [],
  pausedSites: {},
  perSiteAllowedSelectors: {},
  stats: {
    totalBlocked: 0,
    totalCosmeticBlocked: 0,
    perSite: {}
  }
};

function normalizeHost(input) {
  if (!input || typeof input !== 'string') return '';
  try {
    if (/^https?:/i.test(input)) return new URL(input).hostname.replace(/^www\./, '');
  } catch (e) {}
  return input.replace(/^www\./, '').toLowerCase();
}

browser.runtime.onInstalled.addListener(async () => {
  const storage = await browser.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const toSet = {};
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (storage[key] === undefined) toSet[key] = value;
  }
  if (Object.keys(toSet).length > 0) {
    await browser.storage.local.set(toSet);
  }
});

browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse).catch(err => {
    sendResponse({ success: false, error: err.message });
  });
  return true;
});

async function handleMessage(msg, sender) {
  switch (msg.type) {
    case 'ADD_SELECTOR': {
      const storage = await browser.storage.local.get(['blockedSelectors']);
      const selectors = storage.blockedSelectors || [];
      if (!selectors.find(s => s.selector === msg.selector) && selectors.length < 500) {
        selectors.push({
          selector: msg.selector,
          hostname: sender.tab?.url ? new URL(sender.tab.url).hostname : 'unknown',
          date: Date.now()
        });
        await browser.storage.local.set({ blockedSelectors: selectors });
      }
      return { success: true };
    }

    case 'REMOVE_SELECTOR': {
      const storage = await browser.storage.local.get(['blockedSelectors']);
      const filtered = (storage.blockedSelectors || []).filter(s => s.selector !== msg.selector);
      await browser.storage.local.set({ blockedSelectors: filtered });
      return { success: true };
    }

    case 'GET_ALL_SELECTORS': {
      const storage = await browser.storage.local.get(['blockedSelectors']);
      return { success: true, selectors: storage.blockedSelectors || [] };
    }

    case 'GET_STATS': {
      const storage = await browser.storage.local.get(['stats']);
      return { success: true, stats: storage.stats || DEFAULT_SETTINGS.stats };
    }

    case 'RESET_STATS': {
      await browser.storage.local.set({ stats: DEFAULT_SETTINGS.stats });
      return { success: true };
    }

    case 'INCREMENT_COSMETIC_STATS': {
      const storage = await browser.storage.local.get(['stats']);
      const stats = storage.stats || { totalBlocked: 0, totalCosmeticBlocked: 0, perSite: {} };
      const count = msg.count || 1;
      stats.totalBlocked += count;
      stats.totalCosmeticBlocked += count;
      if (msg.hostname) {
        stats.perSite[msg.hostname] = (stats.perSite[msg.hostname] || 0) + count;
      }
      await browser.storage.local.set({ stats });
      return { success: true };
    }

    case 'WHITELIST_SITE': {
      const storage = await browser.storage.local.get(['whitelistedSites']);
      const sites = storage.whitelistedSites || [];
      const hostname = msg.hostname;
      if (hostname && !sites.includes(hostname)) {
        sites.push(hostname);
        await browser.storage.local.set({ whitelistedSites: sites });
      }
      return { success: true };
    }

    case 'UNWHITELIST_SITE': {
      const storage = await browser.storage.local.get(['whitelistedSites']);
      const sites = (storage.whitelistedSites || []).filter(s => s !== msg.hostname);
      await browser.storage.local.set({ whitelistedSites: sites });
      return { success: true };
    }

    case 'TOGGLE_COOKIE_CONSENT':
      await browser.storage.local.set({ cookieConsentEnabled: msg.enabled });
      return { success: true };

    case 'TOGGLE_ANNOYANCE_BLOCKING':
      await browser.storage.local.set({ annoyanceBlockingEnabled: msg.enabled });
      return { success: true };

    case 'EXPORT_RULES': {
      const storage = await browser.storage.local.get(['blockedSelectors', 'whitelistedSites', 'enabled', 'paywallEnabled']);
      return {
        success: true,
        data: {
          version: '2.3.0',
          exportDate: new Date().toISOString(),
          blockedSelectors: storage.blockedSelectors || [],
          whitelistedSites: storage.whitelistedSites || [],
          enabled: storage.enabled !== false,
          paywallEnabled: storage.paywallEnabled !== false
        }
      };
    }

    case 'IMPORT_RULES': {
      if (!msg.data || !msg.data.blockedSelectors) {
        return { success: false, error: 'Invalid import data' };
      }
      const storage = await browser.storage.local.get(['blockedSelectors']);
      const existing = storage.blockedSelectors || [];
      const selectorSet = new Set(existing.map(s => s.selector));
      for (const entry of msg.data.blockedSelectors) {
        if (entry.selector && !selectorSet.has(entry.selector)) {
          existing.push(entry);
          selectorSet.add(entry.selector);
        }
      }
      const limited = existing.slice(0, 500);
      await browser.storage.local.set({ blockedSelectors: limited });
      return { success: true, totalRules: limited.length };
    }

    case 'GET_STATUS':
      return { success: true, enabled: true, paywallEnabled: true };

    case 'PAUSE_SITE': {
      const host = normalizeHost(msg.hostname);
      if (!host) return { success: false, error: 'Invalid hostname' };
      const duration = Math.max(60_000, Number(msg.durationMs) || 3_600_000);
      const storage = await browser.storage.local.get(['pausedSites']);
      const paused = storage.pausedSites || {};
      paused[host] = { expiresAt: Date.now() + duration };
      await browser.storage.local.set({ pausedSites: paused });
      return { success: true, expiresAt: paused[host].expiresAt };
    }

    case 'UNPAUSE_SITE': {
      const host = normalizeHost(msg.hostname);
      if (!host) return { success: false, error: 'Invalid hostname' };
      const storage = await browser.storage.local.get(['pausedSites']);
      const paused = storage.pausedSites || {};
      delete paused[host];
      await browser.storage.local.set({ pausedSites: paused });
      return { success: true };
    }

    case 'IS_PAUSED': {
      const host = normalizeHost(msg.hostname);
      const storage = await browser.storage.local.get(['pausedSites']);
      const paused = storage.pausedSites || {};
      const entry = paused[host];
      if (entry && entry.expiresAt > Date.now()) {
        return { success: true, paused: true, expiresAt: entry.expiresAt };
      }
      return { success: true, paused: false };
    }

    case 'GET_PAUSED_SITES': {
      const storage = await browser.storage.local.get(['pausedSites']);
      const paused = storage.pausedSites || {};
      const now = Date.now();
      const active = {};
      let changed = false;
      for (const [host, entry] of Object.entries(paused)) {
        if (entry && entry.expiresAt > now) {
          active[host] = entry;
        } else {
          changed = true;
        }
      }
      if (changed) await browser.storage.local.set({ pausedSites: active });
      return { success: true, pausedSites: active };
    }

    case 'ALLOW_SELECTOR_ON_SITE': {
      const host = normalizeHost(msg.hostname);
      if (!host || !msg.selector) return { success: false, error: 'Invalid input' };
      const storage = await browser.storage.local.get(['perSiteAllowedSelectors']);
      const allowed = storage.perSiteAllowedSelectors || {};
      const list = allowed[host] || [];
      if (!list.includes(msg.selector) && list.length < 200) {
        list.push(msg.selector);
        allowed[host] = list;
        await browser.storage.local.set({ perSiteAllowedSelectors: allowed });
      }
      return { success: true };
    }

    case 'REMOVE_ALLOWED_SELECTOR': {
      const host = normalizeHost(msg.hostname);
      if (!host || !msg.selector) return { success: false, error: 'Invalid input' };
      const storage = await browser.storage.local.get(['perSiteAllowedSelectors']);
      const allowed = storage.perSiteAllowedSelectors || {};
      const list = (allowed[host] || []).filter(s => s !== msg.selector);
      if (list.length === 0) {
        delete allowed[host];
      } else {
        allowed[host] = list;
      }
      await browser.storage.local.set({ perSiteAllowedSelectors: allowed });
      return { success: true };
    }

    case 'GET_ALLOWED_SELECTORS': {
      const host = normalizeHost(msg.hostname);
      const storage = await browser.storage.local.get(['perSiteAllowedSelectors']);
      const allowed = storage.perSiteAllowedSelectors || {};
      return { success: true, selectors: host ? (allowed[host] || []) : allowed };
    }

    default:
      return { success: false, error: 'Unknown message type' };
  }
}
