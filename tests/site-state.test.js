// One site state, backed by the stores every blocking layer honours.
//
// The popup's Protected / Default / Paused used to write ws_siteStates, which
// only frame decisions read. "Paused" left ads, DNR rules and cosmetic hiding
// running. These tests drive background.js through its message handler with a
// working in-memory storage and check what actually lands in storage.

import { describe, it, expect, beforeEach } from 'vitest';
import { boot, flush, read } from './helpers/background-harness.js';

describe('site state is one effective answer', () => {
  let env;
  beforeEach(async () => {
    env = boot({});
    await flush();
  });

  it('Paused really pauses: the site lands in the whitelist every layer honours', async () => {
    const resp = await env.send({ type: 'SET_SITE_STATE', hostname: 'www.news.example', state: 'paused' });
    expect(resp).toMatchObject({ success: true, state: 'paused', pausedUntil: null });
    expect(env.store.whitelistedSites).toContain('news.example');
    expect((env.store.ws_siteStates || {})['news.example']).toBeUndefined();

    const isPaused = await env.send({ type: 'IS_PAUSED', hostname: 'news.example' });
    expect(isPaused).toMatchObject({ paused: true, indefinite: true });
  });

  it('a timed pause is reported by GET_SITE_STATE with its expiry', async () => {
    await env.send({ type: 'PAUSE_SITE', hostname: 'news.example', durationMs: 60_000 });
    const resp = await env.send({ type: 'GET_SITE_STATE', hostname: 'news.example' });
    expect(resp.state).toBe('paused');
    expect(resp.pausedUntil).toBeGreaterThan(Date.now());
  });

  it('a whitelisted site reads as Paused', async () => {
    await env.send({ type: 'WHITELIST_SITE', hostname: 'news.example' });
    const resp = await env.send({ type: 'GET_SITE_STATE', hostname: 'news.example' });
    expect(resp.state).toBe('paused');
  });

  it('Default lifts both kinds of pause', async () => {
    await env.send({ type: 'SET_SITE_STATE', hostname: 'news.example', state: 'paused' });
    await env.send({ type: 'PAUSE_SITE', hostname: 'news.example', durationMs: 60_000 });
    const resp = await env.send({ type: 'SET_SITE_STATE', hostname: 'news.example', state: 'default' });
    expect(resp.state).toBe('default');
    expect(env.store.whitelistedSites).not.toContain('news.example');
    expect(env.store.pausedSites || {}).not.toHaveProperty('news.example');
  });

  it('Protected survives a pause and comes back on resume', async () => {
    await env.send({ type: 'SET_SITE_STATE', hostname: 'news.example', state: 'protected' });
    await env.send({ type: 'PAUSE_SITE', hostname: 'news.example', durationMs: 60_000 });
    expect((await env.send({ type: 'GET_SITE_STATE', hostname: 'news.example' })).state).toBe('paused');

    const resp = await env.send({ type: 'RESUME_SITE', hostname: 'news.example' });
    expect(resp).toMatchObject({ success: true, state: 'protected' });
  });
});

describe('legacy "paused" in ws_siteStates', () => {
  it('is migrated into the whitelist on startup', async () => {
    const env = boot({ ws_siteStates: { 'old.example': 'paused', 'keep.example': 'protected' } });
    for (let i = 0; i < 20 && !(env.store.whitelistedSites || []).includes('old.example'); i++) await flush();
    expect(env.store.whitelistedSites).toContain('old.example');
    expect(env.store.ws_siteStates).toEqual({ 'keep.example': 'protected' });
  });
});

describe('frame decisions', () => {
  it('Protected forces the aggressive tier for heavy unknown frames', () => {
    globalThis.self = globalThis;
    globalThis.WebSuddhi = undefined;
    // eslint-disable-next-line no-new-func
    new Function(read('shared/rule-model.js'))();
    const decide = globalThis.WebSuddhi.ruleModel.resolveFrameDecision;
    expect(decide({ siteState: 'default', aggressiveness: 'conservative', isHeavy: true }).action).toBe('allow');
    expect(decide({ siteState: 'protected', aggressiveness: 'conservative', isHeavy: true }).action).toBe('block');
  });
});
