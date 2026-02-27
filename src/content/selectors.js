/**
 * @module content/selectors
 * @description CSS selector constants for cosmetic ad-blocking, anti-adblock detection,
 * social widget blocking, and paywall removal.
 *
 * FIX #43: Replaced overly broad `[class*="ad-"]` / `[id*="ad-"]` with
 * specific selectors that avoid false-positives on words like "address",
 * "add-item", "badge-", "breadcrumb-addon", "load-more", "pad-top", etc.
 *
 * @version 2.1.0
 */
'use strict';

/**
 * Ad-related CSS selectors grouped by category.
 * @type {Object<string, string[]>}
 */
export const AD_SELECTORS = {
  common: [
    // FIX #43: Use word-boundary-aware attribute selectors instead of
    // the previous `[class*="ad-"]` / `[id*="ad-"]` which matched
    // "address", "add-item", "badge", "breadcrumb-addon", etc.
    '[class^="ad-"]', '[class*=" ad-"]', '[class$="-ad"]', '[class*="-ad "]',
    '[class^="ads-"]', '[class*=" ads-"]',
    '[class*="advert"]',
    '[id^="ad-"]', '[id^="ads-"]', '[id*="advert"]',
    '[data-ad]', '[data-ads]', '[data-advertisement]',
    '[data-ad-width]', '[data-ad-height]',
    '[data-google-query-id]', '[data-slot]',
    '[data-adsbygoogle]', '[data-ad-client]',
    '.ad', '.ads', '.ad-container', '.ads-container',
    '.ad-wrapper', '.ads-wrapper', '.ad-unit', '.ads-unit',
    '.ad-box', '.ads-box', '.ad-slot', '.ads-slot',
    '.ad-placement', '.ads-placement', '.ad-banner', '.ads-banner',
    '.advertisement', '.advertisements', '.advertising',
    '[class*="advertisement"]', '[class*="advertising"]',
    '.leaderboard', '.skyscraper', '.rectangle', '.billboard',
    '.medrect', '.mpu', '.halfpage', '.sponsor'
  ],

  networks: [
    '.adsbygoogle', '.google-ad', '.googleAds',
    '[id*="google_ads"]', '[class*="google_ads"]',
    '#google_ads', '.dfp-ad', '.dfp-slot',
    '.criteo', '[class*="criteo"]',
    '.taboola', '[class*="taboola"]',
    '.outbrain', '[class*="outbrain"]',
    '.mgid', '[class*="mgid"]',
    '.adroll', '[class*="adroll"]',
    '.zemanta', '[class*="zemanta"]',
    '.revcontent', '[class*="revcontent"]',
    '.amazon-ads', '.amazon-ad',
    '.doubleclick', '[class*="doubleclick"]',
    '.googlesyndication', '[class*="googlesyndication"]',
    '.adform', '[class*="adform"]',
    '.pubmatic', '[class*="pubmatic"]',
    '.openx', '[class*="openx"]',
    '.rubicon', '[class*="rubicon"]',
    '.indexww', '[class*="indexww"]',
    '.casale', '[class*="casale"]',
    '.adtech', '[class*="adtech"]',
    '.bidswitch', '[class*="bidswitch"]',
    '.mediavine', '[class*="mediavine"]',
    '.adthrive', '[class*="adthrive"]',
    '.ezoic', '[class*="ezoic"]',
    '.monetizer101', '[class*="monetizer101"]',
    '.adsterra', '[class*="adsterra"]',
    '.exoclick', '[class*="exoclick"]',
    '.propellerads', '[class*="propellerads"]',
    '.popads', '[class*="popads"]',
    '.adspynetwork', '[class*="adspynetwork"]',
    '.trafficshop', '[class*="trafficshop"]',
    '.trafficjunky', '[class*="trafficjunky"]',
    '[class*="popunder"]', '[class*="popup-ad"]',
    '[class*="modal-ad"]', '[class*="interstitial"]'
  ],

  banners: [
    '.top-ad', '.bottom-ad', '.sidebar-ad', '.header-ad', '.footer-ad',
    '[class*="top-ad"]', '[class*="bottom-ad"]', '[class*="sidebar-ad"]',
    '[class*="header-ad"]', '[class*="footer-ad"]', '[class*="leaderboard-ad"]',
    '#top-banner-ad', '#bottom-banner-ad', '#sidebar-banner-ad',
    '.banner-ad', '.banner_ads', '.banners-ad',
    '[class*="banner-ad"]', '[class*="banner_ads"]',
    '[class*="sticky-ad"]', '[class*="sticky-ads"]',
    '[class*="fixed-ad"]', '[class*="fixed-ads"]',
    '[class*="floating-ad"]', '[class*="floating-ads"]'
  ],

  video: [
    '.video-ad', '.video-ads', '.preroll-ad', '.preroll-ads',
    '.midroll-ad', '.midroll-ads', '.postroll-ad', '.postroll-ads',
    '[class*="video-ad"]', '[class*="preroll"]', '[class*="midroll"]',
    '[class*="postroll"]', '[class*="video-ads"]',
    '.ima-ad-container', '.ad-container-video',
    '.ytp-ad-image', '.ytp-ad-text', '.ytp-ad-overlay',
    '.ytd-ad-slot-renderer', '.ytd-promoted-sparkles-web-renderer',
    'ytd-display-ad-renderer', 'ytd-promoted-video-renderer',
    '.ytp-ad-module', '.ytp-ad-player-overlay'
  ],

  social: [
    '.promoted', '.promoted-content', '.sponsored', '.sponsored-content',
    '[class*="sponsored"]', '[class*="promoted"]', '[class*="promoted-content"]',
    '.social-ad', '.social-ads', '[class*="social-ad"]',
    '.facebook-ad', '[class*="facebook-ad"]',
    '.native-ad', '.native-ads', '[class*="native-ad"]',
    '.in-feed-ad', '[class*="in-feed"]'
  ],

  notices: [
    '.cookie-notice', '.cookie-banner', '.cookie-consent',
    '.cookie-popup', '.cookie-modal', '.cookie-dialog',
    '.gdpr-banner', '.gdpr-notice', '.gdpr-modal',
    '.cc-banner', '.cc-dialog', '.cc-window',
    '[class*="cookie-"][class*="banner"]',
    '[class*="cookie-"][class*="notice"]',
    '[class*="cookie-"][class*="consent"]',
    '[class*="gdpr-"]', '[class*="cookiebanner"]',
    '[id*="cookiebanner"]', '[id*="gdpr"]',
    '.privacy-banner', '.privacy-notice', '[class*="privacy-banner"]',
    '#cookie-consent', '#cookie-banner', '#gdpr-banner',
    '.newsletter-popup', '.email-popup', '.subscribe-popup',
    '[class*="newsletter-popup"]', '[class*="email-popup"]',
    '[class*="subscribe-popup"]', '[class*="optin-popup"]',
    '.exit-intent', '[class*="exit-intent"]',
    '.subscription-popup', '[class*="subscription-popup"]'
  ],

  mobile: [
    '[class*="mobile-ad"]', '[class*="mobile-banner"]',
    '.mobile-ad-container', '.m-ad-container',
    '[class*="app-install"]', '[class*="install-app"]',
    '[class*="get-app"]', '[class*="download-app"]',
    '.smartbanner', '[class*="smart-banner"]'
  ],

  paywall: [
    '[class*="paywall"]', '[id*="paywall"]',
    '[class*="subscribe-wall"]', '[id*="subscribe-wall"]',
    '[class*="subscription-wall"]', '[id*="subscription-wall"]',
    '[class*="metered"]', '[id*="metered"]',
    '[class*="content-gate"]', '[id*="content-gate"]',
    '[class*="article-gate"]', '[id*="article-gate"]',
    '[class*="locked-content"]', '[id*="locked-content"]',
    '[class*="premium-wall"]', '[id*="premium-wall"]',
    '.piano-offer', '[class*="piano-offer"]',
    '.tp-modal', '.tp-backdrop', '.tp-iframe-wrapper',
    '.poool-widget', '[class*="poool"]',
    '.tinypass', '[class*="tinypass"]',
    '[class*="membership-gate"]', '[class*="member-wall"]',
    '.overlay-paywall', '.overlay-subscribe',
    '[class*="paywall-overlay"]', '[class*="subscribe-overlay"]',
    '[class*="blur-content"]', '[class*="blurred-content"]',
    '[class*="signin-overlay"]', '[class*="login-overlay"]',
    '[class*="registration-overlay"]', '[class*="register-overlay"]'
  ]
};

/** All ad selector categories to flatten. */
const AD_CATEGORY_KEYS = ['common', 'networks', 'banners', 'video', 'social', 'notices', 'mobile'];

/**
 * Flattened array of all ad CSS selectors (excluding paywall).
 * @type {string[]}
 */
export const ALL_AD_SELECTORS = AD_CATEGORY_KEYS.flatMap(
  (key) => AD_SELECTORS[key] || []
);

/**
 * Tag + attribute combos for attribute-based ad detection.
 * @type {Array<{tag: string, attrs: string[]}>}
 */
export const AD_TAGS = [
  { tag: 'ins', attrs: ['adsbygoogle', 'data-ad-client', 'data-ad-slot', 'data-ad-channel'] },
  { tag: 'iframe', attrs: ['ads', 'ad', 'doubleclick', 'googlesyndication', 'banner', 'slot'] },
  { tag: 'script', attrs: ['adsbygoogle', 'doubleclick', 'googletag', 'adservice', 'adroll'] },
  { tag: 'amp-ad', attrs: [] },
  { tag: 'amp-embed', attrs: [] },
  { tag: 'm-ad', attrs: [] },
  { tag: 'amp-auto-ads', attrs: [] }
];

/**
 * CSS selectors for anti-adblock detection overlays.
 * @type {string[]}
 */
export const ANTI_ADBLOCK_SELECTORS = [
  '[class*="anti-adblock"]', '[id*="anti-adblock"]',
  '[class*="adblock-detect"]', '[id*="adblock-detect"]',
  '[class*="ad-blocker-detected"]', '[id*="ad-blocker-detected"]',
  '[class*="disable-adblock"]', '[id*="disable-adblock"]',
  '[class*="adb-detected"]', '[id*="adb-detected"]',
  '[class*="adblock-notice"]', '[id*="adblock-notice"]',
  '[class*="adblock-warning"]', '[id*="adblock-warning"]',
  '[class*="blocker-detected"]', '[id*="blocker-detected"]',
  '.adblock-modal', '#adblock-modal',
  '.adblock-overlay', '#adblock-overlay',
  '.adb-modal', '#adb-modal',
  '.adb-overlay', '#adb-overlay',
  '[class*="adblock-message"]', '[id*="adblock-message"]',
  '[class*="adblocker-warning"]', '[id*="adblocker-warning"]',
  '[class*="adblock-popup"]', '[id*="adblock-popup"]',
  '.blockadblock', '#blockadblock',
  '.fuckadblock', '#fuckadblock',
  '[class*="blockadblock"]', '[id*="blockadblock"]',
  '[class*="fuckadblock"]', '[id*="fuckadblock"]',
  '[class*="admiral"]', '[id*="admiral"]',
  '.admiral-adblock', '#admiral-adblock',
  '.ad-block-notice', '#ad-block-notice',
  '.ad-blocker-modal', '#ad-blocker-modal',
  '.please-disable-adblock', '#please-disable-adblock',
  '[class*="turn-off-adblock"]', '[id*="turn-off-adblock"]',
  '[class*="whitelist-us"]', '[id*="whitelist-us"]'
];

/**
 * CSS selectors for social media embeds and share widgets.
 * @type {string[]}
 */
export const SOCIAL_WIDGET_SELECTORS = [
  // Facebook
  'iframe[src*="facebook.com/plugins"]',
  'iframe[src*="facebook.com/v"]',
  '.fb-like', '.fb-share-button', '.fb-share', '.fb-comments',
  '.fb-page', '.fb-video', '.fb-post', '.fb-follow',
  '[data-href*="facebook.com"]',
  '[class*="facebook-share"]', '[class*="fb-share"]',
  // Twitter/X
  'iframe[src*="platform.twitter.com"]',
  'iframe[src*="twitter.com/widgets"]',
  '.twitter-tweet', '.twitter-share-button', '.twitter-follow-button',
  '.twitter-timeline', '.twitter-mention-button',
  '[class*="twitter-share"]', '[class*="tweet-button"]',
  'blockquote.twitter-tweet',
  // LinkedIn
  'iframe[src*="linkedin.com"]',
  '.linkedin-share', '.IN-widget',
  '[class*="linkedin-share"]', '[class*="linkedin-button"]',
  // Pinterest
  'iframe[src*="pinterest.com"]',
  '.pin-it-button', '.pinterest-button',
  '[class*="pinterest-share"]', '[class*="pin-it"]',
  '[data-pin-do]',
  // Instagram
  'iframe[src*="instagram.com/embed"]',
  'blockquote.instagram-media',
  // TikTok
  'iframe[src*="tiktok.com/embed"]',
  '.tiktok-embed', 'blockquote.tiktok-embed',
  // Reddit
  'iframe[src*="reddit.com/"]',
  'iframe[src*="redditmedia.com"]',
  '.reddit-embed', '.reddit-card',
  // General social share patterns
  '[class*="social-share"]', '[class*="share-buttons"]',
  '[class*="social-buttons"]', '[class*="share-icons"]',
  '[class*="social-icons"]', '[class*="share-widget"]',
  '[class*="social-widget"]', '[class*="sharing-buttons"]',
  '.addthis_toolbox', '.addthis_sharing_toolbox',
  '[class*="addthis"]', '.sharethis-inline-share-buttons',
  '[class*="sharethis"]', '.st-btn',
  '[class*="social-login"]', '[class*="social-signin"]'
];
