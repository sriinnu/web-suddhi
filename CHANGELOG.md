# Changelog

All notable changes to WebSuddhi are documented here.

## v3.0.0 (Current)

### Blocking that actually blocks
- **Blocklists ship and apply.** The network layer now loads the generated DNR rulesets (capped under Chrome's 30,000-rule guarantee) and applies them.
- **ABP semantics kept.** Filter conversion keeps exceptions, domain options and other ABP rules instead of stripping them.
- **Cosmetic filtering stops eating content.** Selectors match on class and id token boundaries (`ad-` no longer matches `thread-` or `download-`), and the auto-hider has a guard for real page content.

### Surgical control
- **Frame engine.** Per-tab frame census, classification and per-site frame rules (allow or block this frame, persisted as sub_frame DNR rules).
- **Popup redesign.** Dense dashboard with a pinned action bar, live frame census, relax ("looks broken?") and a site state of Protected, Default or Paused.
- **Aggressiveness dial** in Options: conservative, balanced or aggressive.
- **Picker rebuilt.** An overlay hit-shield stops clicks leaking into iframes, with element and frame modes.

### Fixes
- **Right-click "Block this element" works.** It targets the element you right-clicked in the frame you clicked, and survives the service worker waking up. User picks are no longer overridden by the auto-filter guard.
- **One site state.** Protected / Default / Paused, the timed pause and the whitelist are one model. Paused (indefinite or timed) now switches off every layer, network rules and cosmetic hiding included, not just frame decisions. Protected forces full blocking on that site, and survives a pause and resume. Old "paused" site states are migrated to the whitelist on startup.
- The popup stays clickable while the background worker is asleep.

### Performance
- The element picker and the phishing warning overlay load on demand into the frame that needs them. The always-on content script is down from 3,349 to 2,350 lines.

### Development
- Real-browser Playwright e2e suite (`npm run test:e2e`) with a deterministic local fixture site and an opt-in live-site survey.
- Dependabot bumps folded in, and all workflow actions pinned to commit SHAs.

## v2.3.0

### Granular Site Control
- **Pause per site** — temporarily pause protection for 15 min / 1 hour / 1 day without permanent whitelisting; auto-resumes when timer expires
- **Per-site selector allowlist** — allow a single cosmetic rule on one site without disabling the whole list
- **Site Detail Drawer** — click any site in Top Sites to see what's blocked there, preview an unblock, or clear that site's stats
- **Report Broken Site** — one-click from the popup pauses the current site for an hour and logs a report so you can keep browsing and fix the rule later
- Full cross-browser parity: new message handlers (PAUSE_SITE, UNPAUSE_SITE, IS_PAUSED, GET_PAUSED_SITES, ALLOW_SELECTOR_ON_SITE, REMOVE_ALLOWED_SELECTOR, GET_ALLOWED_SELECTORS) wired across Chrome/Firefox/Safari macOS/Safari iOS

### Popup Badge Counter
- **Fixed zero-count bug** — popup showed 0 even when cosmetic rules were actively hiding elements
- New per-tab cosmetic-blocks map; total (network + cosmetic) is what the popup and toolbar badge reflect
- Live updates while popup is open — throttled `BLOCKED_COUNT_UPDATED` broadcast keeps the count current without polling
- Navigation and tab-close reset both the network and cosmetic counters

### New Themes (Pixar-polish pack)
- **Aurora** — modern pastel glass, pairs with Geist
- **Mocha** — Pantone 2024 warm neutrals, pairs with Plus Jakarta Sans
- **Sunset '79** — 1970s Wes-Anderson warmth, pairs with Outfit
- **Vaporwave** — 1980s synthwave neon, pairs with Space Grotesk
- Each theme declares a `recommendedFont`; the font picker still overrides

### User-Extensible Themes
- `shared/themes.json` is the single source of truth — add or delete entries, no build step, no JS edits
- Runtime loader (`shared/custom-themes-loader.js`) injects `[data-theme="<id>"]` rules on popup/options load
- Popup dropdown and options grid both pick up new entries automatically
- Schema: `{ id, name, description, recommendedFont, swatches, tokens }` where tokens map directly to the CSS custom properties in `shared/themes.css`

### Fonts
- Added @font-face for Geist, Plus Jakarta Sans, Outfit, Sora (Regular + Bold) so the popup renders custom-theme fonts correctly without relying on the options-page FontFace API

### Housekeeping
- Version bumped to 2.3.0 across manifests, HTML, JS, shared modules, and Safari targets
- Extended message-contract test coverage for the new granular control handlers

## v2.2.0

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
