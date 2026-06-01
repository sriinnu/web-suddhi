// WebSuddhi - Rule Model
// Site-state + frame-rule store and the single pure frame-decision function.
(function () {
  'use strict';
  if (!self.WebSuddhi) self.WebSuddhi = {};
  if (!self.WebSuddhi.ruleModel) self.WebSuddhi.ruleModel = {};
  const rm = self.WebSuddhi.ruleModel;

  rm.SITE_STATES = Object.freeze({ PROTECTED: 'protected', DEFAULT: 'default', PAUSED: 'paused' });
  rm.FRAME_RULES = Object.freeze({ ALLOWED: 'allowed', BLOCKED: 'blocked' });
  rm.AGGRESSIVENESS = Object.freeze({ CONSERVATIVE: 'conservative', BALANCED: 'balanced', AGGRESSIVE: 'aggressive' });

  // Pure: given everything known about a frame, decide allow / block / flag.
  rm.resolveFrameDecision = function (input) {
    const i = input || {};
    const siteState = i.siteState || 'default';
    const aggressiveness = i.aggressiveness || 'balanced';

    // 1. Site paused -> blocking entirely off here.
    if (siteState === 'paused') return { action: 'allow', reason: 'site-paused' };

    // 2. Explicit per-frame rule wins; session overrides persistent.
    const explicit = i.sessionRule || i.persistentRule || null;
    if (explicit === 'blocked') return { action: 'block', reason: 'frame-rule' };
    if (explicit === 'allowed') return { action: 'allow', reason: 'frame-rule' };

    // 3. Protected categories are never auto-blocked.
    if (i.isProtected) return { action: 'allow', reason: 'protected' };

    // 4. Known ad/tracker domains block at every tier.
    if (i.isKnownAdTracker) return { action: 'block', reason: 'known-ad-tracker' };

    // 5. Unknown heavy frames depend on the aggressiveness dial.
    if (i.isHeavy) {
      if (aggressiveness === 'aggressive') return { action: 'block', reason: 'heavy-aggressive' };
      if (aggressiveness === 'conservative') return { action: 'allow', reason: 'heavy-conservative' };
      return { action: 'flag', reason: 'heavy-flagged' }; // balanced
    }

    // 6. Everything else is allowed.
    return { action: 'allow', reason: 'default-allow' };
  };

  // ============================================
  // PERSISTENCE
  // ============================================
  const STORAGE_KEYS = Object.freeze({ SITE_STATES: 'ws_siteStates', FRAME_RULES: 'ws_frameRules' });
  rm.STORAGE_KEYS = STORAGE_KEYS;

  function utils() { return self.WebSuddhi && self.WebSuddhi.utils; }

  rm.getSiteState = async function (domain) {
    const u = utils();
    if (!u) return 'default';
    const data = await u.getStorage([STORAGE_KEYS.SITE_STATES]);
    const map = (data && data[STORAGE_KEYS.SITE_STATES]) || {};
    return map[domain] || 'default';
  };

  rm.setSiteState = async function (domain, state) {
    const u = utils();
    if (!u) return;
    const data = await u.getStorage([STORAGE_KEYS.SITE_STATES]);
    const map = (data && data[STORAGE_KEYS.SITE_STATES]) || {};
    if (state === 'default' || !state) delete map[domain];
    else map[domain] = state;
    await u.setStorage({ [STORAGE_KEYS.SITE_STATES]: map });
  };

  // ============================================
  // FRAME RULES (persisted + in-memory session)
  // ============================================
  const sessionFrameRules = new Map(); // `${site}|${frame}` -> 'allowed' | 'blocked'
  const sessionKey = (site, frame) => site + '|' + frame;

  rm.getSessionFrameRule = function (site, frame) {
    return sessionFrameRules.get(sessionKey(site, frame)) || null;
  };

  rm.clearSessionFrameRules = function () {
    sessionFrameRules.clear();
  };

  rm.getPersistentFrameRule = async function (site, frame) {
    const u = utils();
    if (!u) return null;
    const data = await u.getStorage([STORAGE_KEYS.FRAME_RULES]);
    const map = (data && data[STORAGE_KEYS.FRAME_RULES]) || {};
    return (map[site] && map[site][frame]) || null;
  };

  // rule: 'allowed' | 'blocked' | null (null clears). options.persist defaults true.
  rm.setFrameRule = async function (site, frame, rule, options) {
    const persist = !options || options.persist !== false;
    if (!persist) {
      if (rule === null) sessionFrameRules.delete(sessionKey(site, frame));
      else sessionFrameRules.set(sessionKey(site, frame), rule);
      return;
    }
    const u = utils();
    if (!u) return;
    const data = await u.getStorage([STORAGE_KEYS.FRAME_RULES]);
    const map = (data && data[STORAGE_KEYS.FRAME_RULES]) || {};
    if (rule === null) {
      if (map[site]) {
        delete map[site][frame];
        if (Object.keys(map[site]).length === 0) delete map[site];
      }
    } else {
      if (!map[site]) map[site] = {};
      map[site][frame] = rule;
    }
    await u.setStorage({ [STORAGE_KEYS.FRAME_RULES]: map });
  };
})();
