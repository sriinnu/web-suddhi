// YouTube video-ad pruning: the page-world scriptlet and its registration.

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT_DIR, p), 'utf8');
const runInPage = (code) => (0, eval)(code); // omit-allow: loads the repo's own scriptlet into the test page

const PLAYER = {
  playabilityStatus: { status: 'OK' },
  videoDetails: { videoId: 'abc', title: 'A video' },
  streamingData: { formats: [] },
  adPlacements: [{ adPlacementRenderer: {} }],
  adSlots: [{ adSlotRenderer: {} }],
  playerAds: [{ playerLegacyDesktopWatchAdsRenderer: {} }],
  adBreakHeartbeatParams: 'x'
};
const AD_KEYS = ['adPlacements', 'adSlots', 'playerAds', 'adBreakHeartbeatParams'];
const hasAds = (obj) => AD_KEYS.some((key) => key in obj);

describe('youtube-prune scriptlet', () => {
  const originalParse = JSON.parse;
  const originalJson = Response.prototype.json;

  beforeAll(() => {
    vi.useFakeTimers();
    runInPage(read('content/scriptlets/youtube-prune.js'));
  });
  afterAll(() => {
    JSON.parse = originalParse;
    Response.prototype.json = originalJson;
    vi.useRealTimers();
  });

  it('strips ad data from a player response parsed as JSON', () => {
    const parsed = JSON.parse(JSON.stringify(PLAYER));
    expect(hasAds(parsed)).toBe(false);
    expect(parsed.videoDetails.videoId).toBe('abc');
  });

  it('strips ad data nested as playerResponse, also inside arrays', () => {
    const next = JSON.parse(JSON.stringify([{ playerResponse: PLAYER }, { response: {} }]));
    expect(hasAds(next[0].playerResponse)).toBe(false);
  });

  it('leaves JSON that is not a player response alone', () => {
    const other = JSON.parse('{"adPlacements":[1],"comments":[]}');
    expect(other.adPlacements).toEqual([1]);
  });

  it('strips ad data from fetch responses read with .json()', async () => {
    const body = await new Response(JSON.stringify(PLAYER)).json();
    expect(hasAds(body)).toBe(false);
  });

  it('strips ad data from the inline ytInitialPlayerResponse', () => {
    runInPage('var ytInitialPlayerResponse = ' + JSON.stringify(PLAYER) + ';');
    expect(hasAds(window.ytInitialPlayerResponse)).toBe(false);
    expect(window.ytInitialPlayerResponse.videoDetails.videoId).toBe('abc');
  });

  it('keeps hooked functions looking native', () => {
    expect(Function.prototype.toString.call(JSON.parse)).toContain('[native code]');
  });

  it('mutes, speeds and skips an ad that still plays, then restores', () => {
    document.body.innerHTML = '<div id="movie_player" class="html5-video-player ad-showing"><video></video>' + // omit-allow: static test fixture markup
      '<button class="ytp-skip-ad-button">Skip</button></div>';
    const player = document.getElementById('movie_player');
    const video = player.querySelector('video');
    const skip = vi.fn();
    player.querySelector('button').addEventListener('click', skip);
    video.playbackRate = 1.5;

    vi.advanceTimersByTime(350);
    expect(video.muted).toBe(true);
    expect(video.playbackRate).toBe(16);
    expect(skip).toHaveBeenCalled();

    player.classList.remove('ad-showing');
    vi.advanceTimersByTime(350);
    expect(video.muted).toBe(false);
    expect(video.playbackRate).toBe(1.5);
  });
});

describe('scriptlet registration', () => {
  function loadModule(scripting, stored = {}) {
    const listeners = () => ({ addListener: vi.fn() });
    globalThis.browser = undefined;
    globalThis.chrome = {
      runtime: { onInstalled: listeners(), onStartup: listeners() },
      storage: { local: { get: (keys, cb) => cb({ ...stored }) }, onChanged: listeners() },
      scripting
    };
    globalThis.self = globalThis;
    delete globalThis.WebSuddhi;
    runInPage(read('background/scriptlets.js'));
    return globalThis.WebSuddhi.scriptlets;
  }

  const ID = 'websuddhi-youtube-prune';
  const later = () => Date.now() + 60_000;

  it('runs on YouTube in the page world at document_start', () => {
    const { planRegistrations } = loadModule(undefined);
    const [plan] = planRegistrations({});
    expect(plan.register).toBe(true);
    expect(plan.options).toMatchObject({ world: 'MAIN', runAt: 'document_start', allFrames: true });
    expect(plan.options.matches).toContain('*://*.youtube.com/*');
    expect(plan.options.excludeMatches).toBeUndefined();
  });

  it('stays off when blocking is off, the site is allowed, or paused', () => {
    const { planRegistrations } = loadModule(undefined);
    expect(planRegistrations({ enabled: false })[0].register).toBe(false);
    expect(planRegistrations({ scriptletsEnabled: false })[0].register).toBe(false);
    expect(planRegistrations({ whitelistedSites: ['www.youtube.com'] })[0].register).toBe(false);
    expect(planRegistrations({ pausedSites: { 'youtube.com': later() } })[0].register).toBe(false);
  });

  it('comes back when a pause has expired', () => {
    const { planRegistrations } = loadModule(undefined);
    expect(planRegistrations({ pausedSites: { 'youtube.com': Date.now() - 1 } })[0].register).toBe(true);
  });

  it('excludes just a subdomain the user allowed', () => {
    const { planRegistrations } = loadModule(undefined);
    const [plan] = planRegistrations({ whitelistedSites: ['music.youtube.com'], pausedSites: {} });
    expect(plan.register).toBe(true);
    expect(plan.options.excludeMatches).toEqual(['*://music.youtube.com/*', '*://*.music.youtube.com/*']);
  });

  it('ignores allowed sites that are not YouTube', () => {
    const { planRegistrations } = loadModule(undefined);
    const [plan] = planRegistrations({ whitelistedSites: ['example.com', 'notyoutube.com'] });
    expect(plan.register).toBe(true);
    expect(plan.options.excludeMatches).toBeUndefined();
  });

  it('re-registers through the scripting API and unregisters when paused', async () => {
    const registered = new Map();
    const scripting = {
      getRegisteredContentScripts: vi.fn(async ({ ids }) => ids.filter((id) => registered.has(id)).map((id) => ({ id }))),
      registerContentScripts: vi.fn(async (list) => list.forEach((s) => {
        if (registered.has(s.id)) throw new Error('Duplicate script ID');
        registered.set(s.id, s);
      })),
      unregisterContentScripts: vi.fn(async ({ ids }) => ids.forEach((id) => registered.delete(id)))
    };

    const stored = {};
    const { syncScriptlets } = loadModule(scripting, stored);
    await syncScriptlets();
    expect(registered.has(ID)).toBe(true);

    await syncScriptlets(); // a second sync must not hit "Duplicate script ID"
    expect(registered.get(ID).world).toBe('MAIN');

    globalThis.chrome.storage.local.get = (keys, cb) => cb({ pausedSites: { 'youtube.com': later() } });
    await syncScriptlets();
    expect(registered.has(ID)).toBe(false);
  });
});
