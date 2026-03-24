<p align="center">
  <img src="icons/icon128.png" alt="WebSuddhi" width="128" height="128">
</p>

<h1 align="center">WebSuddhi</h1>

<p align="center">
  <strong>Block ads. Strip trackers. Dismiss cookies. Remove paywalls. Reclaim your web.</strong>
</p>

<p align="center">
  <em>"Suddhi" (शुद्धि) — Sanskrit for purification</em>
</p>

<p align="center">
  <a href="https://img.shields.io/badge/version-2.1.0-blue?style=flat-square"><img src="https://img.shields.io/badge/version-2.1.0-blue?style=flat-square" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"></a>
</p>

<p align="center">
  <a href="#installation">Install</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#how-it-works">How It Works</a> &bull;
  <a href="docs/comparison.md">Compare</a> &bull;
  <a href="docs/developer.md">Contribute</a>
</p>

---

## The Problem

Every website today bombards you with:
- **Ads** that slow pages and track you across the web
- **Cookie banners** on every single site
- **Paywalls** locking information behind subscriptions
- **Tracking parameters** (utm_source, fbclid, gclid) following you everywhere

WebSuddhi solves all of this. One extension. Zero data collection.

---

## Features

### Core Protection

| # | Feature | What It Does |
|---|---------|-------------|
| 1 | Network Blocking | Blocks ad & tracking requests before they load |
| 2 | Cosmetic Blocking | Hides ad elements using 200+ CSS selectors |
| 3 | URL Cleaning | Strips 60+ tracking parameters from URLs |
| 4 | Cookie Auto-Dismiss | Automatically clicks "Reject All" on cookie banners |
| 5 | Paywall Removal | Removes paywalls and subscribe overlays |
| 6 | Annoyance Blocker | Hides chat widgets, popups, push prompts |

### Privacy & Control

| # | Feature | What It Does |
|---|---------|-------------|
| 7 | Referrer Stripping | Prevents sites from knowing where you came from |
| 8 | WebRTC Protection | Prevents IP address leaks |
| 9 | Ping Prevention | Blocks `<a ping>` click tracking |
| 10 | Filter Lists | Subscribe to custom blocklists with ABP syntax |
| 11 | Pick Element | Point-and-click to permanently block any element |
| 12 | Statistics Dashboard | Track blocks over time with per-site breakdown |

---

## How It Works

```
 Request Lifecycle                Content Lifecycle
 ═══════════════════              ═══════════════════

 Browser makes request            Page DOM loads
        │                                │
        ▼                                ▼
 ┌─────────────────┐             ┌─────────────────┐
 │ Network Blocker  │             │ Cosmetic Blocker │
 │ (223 DNR rules)  │             │ (200+ selectors) │
 └────────┬─────────┘             └────────┬─────────┘
          │                                │
          ▼                                ▼
 ┌─────────────────┐             ┌─────────────────┐
 │  URL Cleaner     │             │ Cookie Consent   │
 │ Strip tracking   │             │ Auto-dismiss     │
 │ params from URLs │             │ cookie banners   │
 └─────────────────┘             └─────────────────┘
```

Two layers of defense:
1. **Network layer** — Blocks requests using Chrome's `declarativeNetRequest` (MV3) or `webRequest` (MV2)
2. **Content layer** — Hides elements, dismisses cookie banners, removes paywalls

---

## Installation

### Chrome / Edge / Brave / Opera / Vivaldi

```bash
git clone https://github.com/sriinnu/web-suddhi.git
```

1. Open `chrome://extensions` (or your browser's extension page)
2. Enable **Developer mode**
3. Click **Load unpacked** > select the `web-suddhi` folder

### Firefox

1. Navigate to `about:debugging`
2. Click "This Firefox" > "Load Temporary Add-on"
3. Select `manifest-mv2.json`

For permanent installation, download from [Firefox Add-ons](https://addons.mozilla.org/) (coming soon).

### Safari (macOS)

```bash
xcrun safari-web-extension-converter safari/
# Opens in Xcode — click "Run" to install
```

### Safari (iOS)

1. Open the Xcode project in `safari-iOS/`
2. Connect your device, select it in Xcode, click **Run**
3. On device: Settings > Safari > Extensions > enable WebSuddhi

---

## How to Use

### Automatic Protection (Zero Config)

Once installed, WebSuddhi works immediately:

| What happens | When |
|---|---|
| Ad & tracker requests blocked | Every page load |
| Tracking params stripped from URLs | Every navigation |
| Cookie banners dismissed | Within seconds |
| Paywalls removed | Within 1-3 seconds |
| Chat widgets & popups hidden | On page load |

### Manual Element Blocking

**Pick Mode** — Permanently block an element:
1. Click the WebSuddhi icon > **Pick Element to Block**
2. Hover over the element (highlighted in red)
3. Click to select > confirm with **Block**
4. Rule is saved for all future visits

**Zap Mode** — Temporarily hide an element:
1. Click the WebSuddhi icon > **Zap Element**
2. Click any element to instantly hide it
3. Hidden until page refresh

### Per-Site Whitelist

Click the WebSuddhi icon > Toggle **"Disable on this site"**

---

## Supported Browsers

| Browser | Version | Manifest |
|---------|---------|----------|
| Google Chrome | 112+ | MV3 |
| Microsoft Edge | 112+ | MV3 |
| Firefox | 109+ | MV2 |
| Safari macOS / iOS | 15+ | MV3 |
| Brave, Opera, Vivaldi | Latest | MV3 |
| Any Chromium fork | — | MV3 |

---

## Privacy

WebSuddhi is built with a strict privacy-first approach:

| | |
|---|---|
| **No servers** | Zero network requests to any WebSuddhi server |
| **No analytics** | No usage tracking, no telemetry |
| **No accounts** | No sign-up, no login |
| **Local storage only** | All settings stored in `browser.storage.local` |
| **Open source** | Every line of code is auditable |
| **Zero dependencies** | Pure vanilla JavaScript |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+P` | Toggle element picker mode |
| `Alt+W` | Toggle whitelist for current site |
| `Alt+S` | Open settings |

Customize in Options page under Keyboard Shortcuts.

---

## Documentation

- [Architecture](docs/architecture.md) — System design and DNR rule ranges
- [What Gets Blocked](docs/what-gets-blocked.md) — Ad networks, tracking domains, cookie frameworks
- [Paywall Removal](docs/paywall-removal.md) — How paywall detection works
- [Comparison](docs/comparison.md) — WebSuddhi vs other ad blockers
- [Permissions](docs/permissions.md) — Why each permission is required
- [Troubleshooting](docs/troubleshooting.md) — Common issues and solutions
- [Developer Guide](docs/developer.md) — Contributing, testing, SSH setup
- [Changelog](CHANGELOG.md) — Version history

---

## License

[MIT License](LICENSE) — Free to use, modify, and distribute.

<p align="center">
  <strong>Built with vanilla JavaScript. No frameworks. No dependencies. No tracking.</strong>
</p>
