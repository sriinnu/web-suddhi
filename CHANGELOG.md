# Changelog

All notable changes to WebSuddhi are documented here.

## v2.1.0 (Current)

- Fixed XSS vulnerability in phishing warning overlay (safe DOM construction)
- Added Content Security Policy to both MV3 and MV2 manifests
- Fixed LRU cache eviction (O(1) using Map delete+re-insert)
- Fixed pick-element "Block" button not clickable (pointer-events)
- Fixed punycode false positives in phishing detector
- Added message validation to background message handler
- Safe tab messaging (graceful handling of closed/navigated tabs)
- Configurable toast notification duration
- Deduplicated storage helpers into shared/utils.js
- Added ARIA labels to popup UI
- Network-blocker polling now stops when window is unfocused

## v2.0.0

- Network-level request blocking (223 declarativeNetRequest rules)
- URL tracking parameter stripping (60+ params)
- Cookie consent auto-dismiss (9 CMP frameworks + generic fallback)
- Annoyance blocking (chat widgets, popups, push prompts, app banners)
- Enhanced statistics with per-site breakdown and charts
- Privacy features (referrer stripping, WebRTC protection, ping blocking)
- Filter list subscriptions with ABP syntax parser
- Safari iOS full v2 support
- Redesigned popup and options page

## v1.1.0

- Initial cosmetic ad blocking
- Element picker (pick mode)
- Per-site whitelist
- Basic statistics
- Cross-browser support (Chrome, Firefox, Safari)
