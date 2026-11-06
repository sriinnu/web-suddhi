// WebSuddhi - Frame Registry
// Per-tab frame census + classify/decide via the Plan 1 decision core.
(function () {
  'use strict';
  if (!self.WebSuddhi) self.WebSuddhi = {};
  if (!self.WebSuddhi.frameRegistry) self.WebSuddhi.frameRegistry = {};
  const reg = self.WebSuddhi.frameRegistry;

  const tabs = new Map(); // tabId -> { frames: Map<frameId, record>, cosmetic: number }

  function getTab(tabId) {
    let t = tabs.get(tabId);
    if (!t) { t = { frames: new Map(), cosmetic: 0 }; tabs.set(tabId, t); }
    return t;
  }

  // Needs classifier + ruleModel modules loaded on self.WebSuddhi.
  reg.classifyAndDecide = function (frameInfo, ctx) {
    const classifier = self.WebSuddhi.classifier;
    const ruleModel = self.WebSuddhi.ruleModel;
    const c = classifier.categorize(frameInfo, ctx.lists);
    const isHeavy = classifier.estimateHeaviness(ctx.metrics || {}, ctx.budget);
    const decision = ruleModel.resolveFrameDecision({
      siteState: ctx.siteState,
      category: c.category,
      isProtected: c.isProtected,
      isHeavy,
      isKnownAdTracker: c.isKnownAdTracker,
      aggressiveness: ctx.aggressiveness,
      persistentRule: ctx.persistentRule,
      sessionRule: ctx.sessionRule
    });
    return {
      category: c.category, isProtected: c.isProtected, isKnownAdTracker: c.isKnownAdTracker,
      isHeavy, action: decision.action, reason: decision.reason
    };
  };

  reg.registerFrame = function (tabId, frameId, parentFrameId, frameInfo) {
    const t = getTab(tabId);
    const existing = t.frames.get(frameId) || {};
    t.frames.set(frameId, {
      frameId, parentFrameId,
      url: frameInfo.url || existing.url || '',
      domain: frameInfo.domain || existing.domain || '',
      parentDomain: frameInfo.parentDomain || existing.parentDomain || null,
      width: frameInfo.width || existing.width || 0,
      height: frameInfo.height || existing.height || 0,
      bytes: existing.bytes || 0,
      longTaskMs: existing.longTaskMs || 0
    });
  };

  reg.updateMetrics = function (tabId, frameId, metrics) {
    const t = tabs.get(tabId);
    if (!t) return;
    const rec = t.frames.get(frameId);
    if (!rec) return;
    rec.bytes = Math.max(rec.bytes || 0, Number(metrics.bytes) || 0);
    rec.longTaskMs = Math.max(rec.longTaskMs || 0, Number(metrics.longTaskMs) || 0);
  };

  // Re-run classify/decide for every frame in the tab using current metrics + ctx.
  // ctxBase.frameRules (optional): { [frameDomain]: { persistentRule, sessionRule } }
  reg.recompute = function (tabId, ctxBase) {
    const t = tabs.get(tabId);
    if (!t) return;
    const frameRules = (ctxBase && ctxBase.frameRules) || {};
    for (const rec of t.frames.values()) {
      const fr = frameRules[rec.domain] || {};
      const ctx = Object.assign({}, ctxBase, {
        metrics: { bytes: rec.bytes, longTaskMs: rec.longTaskMs },
        persistentRule: fr.persistentRule || null,
        sessionRule: fr.sessionRule || null
      });
      const d = reg.classifyAndDecide({ url: rec.url, domain: rec.domain, width: rec.width, height: rec.height }, ctx);
      Object.assign(rec, d);
    }
  };

  reg.getCounts = function (tabId) {
    const t = tabs.get(tabId);
    const counts = { frames: 0, heavy: 0, blocked: 0, flagged: 0, cosmetic: t ? t.cosmetic : 0 };
    if (!t) return counts;
    for (const rec of t.frames.values()) {
      counts.frames += 1;
      if (rec.isHeavy) counts.heavy += 1;
      if (rec.action === 'block') counts.blocked += 1;
      if (rec.action === 'flag') counts.flagged += 1;
    }
    return counts;
  };

  reg.addCosmeticCount = function (tabId, n) {
    const t = getTab(tabId);
    t.cosmetic += Number(n) || 0;
  };

  reg.getCensus = function (tabId) {
    const t = tabs.get(tabId);
    if (!t) return { frames: [], counts: { frames: 0, heavy: 0, blocked: 0, flagged: 0, cosmetic: 0 } };
    return { frames: Array.from(t.frames.values()), counts: reg.getCounts(tabId) };
  };

  reg.resetTab = function (tabId) {
    const t = tabs.get(tabId);
    if (t) { t.frames.clear(); t.cosmetic = 0; }
  };

  reg.removeTab = function (tabId) { tabs.delete(tabId); };

  reg.clearAll = function () { tabs.clear(); }; // test hook
  reg._tabs = tabs; // test/inspection hook
})();
