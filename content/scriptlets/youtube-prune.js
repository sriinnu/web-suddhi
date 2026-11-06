// WebSuddhi - YouTube video-ad pruning (page world).
//
// YouTube ships video ads as data inside its player responses: the
// `adPlacements`, `adSlots` and `playerAds` keys tell the player when and what
// to play. Network rules cannot touch that data (it arrives with the video
// metadata from youtube.com itself) and CSS cannot either, so this script runs
// in the page's own JavaScript world and removes those keys before the player
// reads them. Same technique as uBlock Origin's json-prune scriptlets.
//
// It is registered by background/scriptlets.js with world: "MAIN" at
// document_start, only on YouTube, and only while blocking is on and the user
// has not paused or allowed the site. It cannot use extension APIs.
(function () {
  'use strict';

  // Keys that carry ad schedules and ad renderers.
  const AD_KEYS = ['adPlacements', 'adSlots', 'playerAds', 'adBreakHeartbeatParams'];

  // Only prune objects shaped like a player response, so unrelated JSON on the
  // page (comments, settings, a video *about* adPlacements) is never touched.
  function looksLikePlayerResponse(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) &&
      ('playabilityStatus' in value || 'streamingData' in value || 'videoDetails' in value);
  }

  function pruneOne(target) {
    if (!looksLikePlayerResponse(target)) return;
    for (const key of AD_KEYS) {
      if (key in target) delete target[key];
    }
  }

  // A player response arrives bare (/youtubei/v1/player, ytInitialPlayerResponse)
  // or wrapped as `.playerResponse` (watch-next and Shorts responses, which can
  // also come as an array of parts).
  function prune(value) {
    try {
      if (value === null || typeof value !== 'object') return value;
      const parts = Array.isArray(value) ? value : [value];
      for (const part of parts) {
        if (part === null || typeof part !== 'object') continue;
        pruneOne(part);
        pruneOne(part.playerResponse);
      }
    } catch (e) {}
    return value;
  }

  // Proxies keep the hooked functions' name, length and native-looking
  // toString, which pages use to detect tampering.
  try {
    JSON.parse = new Proxy(JSON.parse, {
      apply(target, thisArg, args) {
        return prune(Reflect.apply(target, thisArg, args));
      }
    });
  } catch (e) {}

  try {
    if (typeof Response === 'function' && Response.prototype && Response.prototype.json) {
      Response.prototype.json = new Proxy(Response.prototype.json, {
        apply(target, thisArg, args) {
          return Reflect.apply(target, thisArg, args).then(prune);
        }
      });
    }
  } catch (e) {}

  // The first video of a page load comes inline as
  // `var ytInitialPlayerResponse = {...}`. A global `var` that finds an existing
  // accessor keeps it and assigns through the setter, so this sees the object
  // before the player does.
  try {
    let initial;
    Object.defineProperty(window, 'ytInitialPlayerResponse', {
      configurable: true,
      enumerable: true,
      get() { return initial; },
      set(value) { initial = prune(value); }
    });
  } catch (e) {}

  // Fallback for ads that still play: some are stitched into the video stream
  // server-side and carry no separate ad data to remove. While the player marks
  // itself as showing an ad, mute it, run it at top speed and press Skip as soon
  // as it appears. Restores the user's volume state and speed afterwards.
  const SKIP_BUTTONS = '.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern';
  const AD_SPEED = 16;
  let saved = null;

  function tickAdFallback() {
    try {
      const player = document.querySelector('#movie_player, .html5-video-player');
      const video = player && player.querySelector('video');
      if (!video) return;

      if (player.classList.contains('ad-showing')) {
        if (!saved) saved = { muted: video.muted, rate: video.playbackRate || 1 };
        video.muted = true;
        if (video.playbackRate !== AD_SPEED) video.playbackRate = AD_SPEED;
        const skip = player.querySelector(SKIP_BUTTONS);
        if (skip) skip.click();
      } else if (saved) {
        video.muted = saved.muted;
        video.playbackRate = saved.rate;
        saved = null;
      }
    } catch (e) {}
  }

  setInterval(tickAdFallback, 300);
})();
