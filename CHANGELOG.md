# Changelog

All notable changes to WebSuddhi are documented here.

## v2.2.0 (Current)

### Blocking Engine
- **40,000 curated blocking rules** compiled from HaGeZi, AdGuard, and PhishTank
- Sources: HaGeZi Pro (15K), Threat Intelligence (10K), Fake/Scam (5K), DynDNS (1.5K), Pop-Up Ads (5K), AdGuard DNS (10K), Phishing URLs (5K), Spam TLDs
- Build script (`scripts/build-blocklists.mjs`) compiles upstream lists into MV3 static rulesets
- Filter subscription limits raised: 100K domains, 200K lines, 10MB, 30s parse timeout
- MV3 dynamic rule budget management (4,400 rule cap with fair-share allocation)

### Theme System
- 6 color themes: Light, Dark, Ocean, Midnight, Sunset, Forest (+ Coastal variants)
- Theme loader prevents flash of unstyled content on both popup and options pages
- Font family selector with 4 bundled fonts (JetBrains Mono, Inter, Fira Code, Space Grotesk)
- Font size slider (12-18px) and border radius slider (0-24px)
- Configurable via drop-in: add .woff2 files to `fonts/` and update `fonts.json`

### UI/UX
- Protection Level presets (Light / Standard / Aggressive)
- Recommended Lists section with toggle switches
- Support section with Buy Me a Coffee, GitHub Sponsors, Star, Issues
- Popup footer: author credit with repo link and coffee icon
- Popup width increased to 370px
- Thin 4px scrollbar
- Monospace font on stat numbers, domains, and code elements

### Bug Fixes
- **Fixed ALL async message handling** — `return true` was missing from `onMessage.addListener`, causing every async response to be silently dropped (settings, filters, stats, everything)
- **Fixed subscription system** — `addSubscription` now returns immediately; fetch/parse/apply runs in background with polling for completion
- Added missing `TOGGLE_COOKIE_CONSENT` and `TOGGLE_ANNOYANCE_BLOCKING` background handlers
- `setupEventListeners()` runs before data loading (prevents dead UI on init failure)
- All `addEventListener` calls use optional chaining to prevent cascading failures
- `logError` now actually calls `console.error` (was silently swallowing errors)
- Filter list delete now refreshes language filters and recommended lists
- Chart trend lines/areas now use correct CSS variable (`--accent` not `--accent-color`)

### Housekeeping
- Version bumped to 2.2.0 across all manifests, HTML, JS, and Safari targets
- `.mcp.json` removed from tracking, added to `.gitignore`
- Cross-browser support, sync storage, backup/restore (from PR #22)

## v2.1.0

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

## v1.0.0

- Initial release
- Cosmetic ad blocking with 200+ CSS selectors
- Element picker (point-and-click blocking)
- Quick zap (temporary element hiding)
- Per-site whitelist
- Basic popup with toggle and stats
