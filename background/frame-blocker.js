// WebSuddhi - Frame Blocker
// Applies census decisions: tear down blocked frames + manage frame network rules.
(function () {
  'use strict';
  if (!self.WebSuddhi) self.WebSuddhi = {};
  if (!self.WebSuddhi.frameBlocker) self.WebSuddhi.frameBlocker = {};
  const fb = self.WebSuddhi.frameBlocker;

  // Distinct from network-blocker (20001-29999) and filter-lists (40001-69999).
  fb.FRAME_RULE_ID_START = 70001;
  fb.FRAME_RULE_ID_END = 79999;

  // Pure: frames the census decided to block, minus protected (seatbelt).
  fb.framesToTearDown = function (census) {
    if (!census || !Array.isArray(census.frames)) return [];
    return census.frames.filter((f) => f.action === 'block' && !f.isProtected);
  };

  // Pure: a declarativeNetRequest sub_frame block rule for a domain.
  fb.buildFrameBlockRule = function (id, domain) {
    return {
      id,
      priority: 1,
      action: { type: 'block' },
      condition: { urlFilter: '||' + domain, resourceTypes: ['sub_frame'] }
    };
  };

  // Broadcast a teardown command to every frame in the tab; the parent frame
  // that owns the matching <iframe> removes it (instant kill, every browser).
  fb.tearDown = function (api, tabId, matchUrl) {
    if (!api || !api.tabs || !api.tabs.sendMessage) return;
    try {
      api.tabs.sendMessage(tabId, { type: 'TEARDOWN_FRAME', matchUrl }, () => void (api.runtime && api.runtime.lastError));
    } catch (e) { /* tab gone */ }
  };

  // Tear down every block-decided non-protected frame in a census.
  fb.applyTab = function (api, tabId, census) {
    const targets = fb.framesToTearDown(census);
    for (const f of targets) fb.tearDown(api, tabId, f.url || f.domain);
    return targets.length;
  };

  // ============================================
  // PERSISTED NETWORK RULES (MV3 dynamic)
  // ============================================
  function isFrameRuleId(id) {
    return Number.isInteger(id) && id >= fb.FRAME_RULE_ID_START && id <= fb.FRAME_RULE_ID_END;
  }

  async function frameRules(api) {
    const all = await api.declarativeNetRequest.getDynamicRules();
    return all.filter((r) => isFrameRuleId(r.id));
  }

  function ruleMatchesDomain(rule, domain) {
    return rule.condition && rule.condition.urlFilter === '||' + domain;
  }

  fb.addNetworkBlock = async function (api, domain) {
    if (!api || !api.declarativeNetRequest) return; // MV2 / Safari: teardown handles it
    const existing = await frameRules(api);
    if (existing.some((r) => ruleMatchesDomain(r, domain))) return; // idempotent
    const usedIds = new Set(existing.map((r) => r.id));
    let id = fb.FRAME_RULE_ID_START;
    while (usedIds.has(id) && id <= fb.FRAME_RULE_ID_END) id += 1;
    if (id > fb.FRAME_RULE_ID_END) return;
    await api.declarativeNetRequest.updateDynamicRules({ addRules: [fb.buildFrameBlockRule(id, domain)] });
  };

  fb.removeNetworkBlock = async function (api, domain) {
    if (!api || !api.declarativeNetRequest) return;
    const existing = await frameRules(api);
    const removeRuleIds = existing.filter((r) => ruleMatchesDomain(r, domain)).map((r) => r.id);
    if (removeRuleIds.length === 0) return;
    await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
  };
})();
