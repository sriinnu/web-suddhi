<p align="center">
  <img src="icons/icon-source.svg" alt="WebSuddhi" width="128" height="128">
</p>

<h1 align="center">WebSuddhi</h1>

<p align="center">
  <strong>Block ads. Strip trackers. Dismiss cookies. Remove paywalls. Reclaim your web.</strong>
</p>

<p align="center">
  <em>"Suddhi" (शुद्धि) — Sanskrit for purification</em>
</p>

<p align="center">
  <a href="https://img.shields.io/badge/version-2.1.0-105666?style=flat-square"><img src="https://img.shields.io/badge/version-2.1.0-105666?style=flat-square" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-0A3323?style=flat-square" alt="License"></a>
  <a href="https://github.com/sriinnu/web-suddhi/issues"><img src="https://img.shields.io/badge/support-GitHub%20Issues-839958?style=flat-square" alt="Support"></a>
</p>

<p align="center">
  <a href="docs/getting-started.md">Get Started</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#how-it-works">How It Works</a> &bull;
  <a href="docs/comparison.md">Compare</a> &bull;
  <a href="docs/getting-started.md#installation">Install</a>
</p>

---

## Why WebSuddhi?

The modern web is hostile by default. Ads track you across sites, cookie banners waste your time, paywalls lock information away, and tracking parameters follow you everywhere.

WebSuddhi fixes all of this — **one extension, zero data collection, zero config needed**.

### What makes it different?

| | WebSuddhi |
|---|---|
| **Privacy** | Zero network calls to any server. No analytics, no accounts, no telemetry. All data stays in `browser.storage.local`. |
| **Performance** | Pure vanilla JS. No frameworks, no dependencies. Service worker architecture with in-memory stats and periodic flush. |
| **Comprehensive** | 6 protection features + 6 privacy features. Network-level and content-level blocking. 223 declarative rules + 200+ cosmetic selectors. |
| **Open source** | Every line auditable. MIT licensed. |

---

## Features

### Core Protection

| # | Feature | What It Does |
|---|---------|-------------|
| 1 | **Network Blocking** | Blocks ad & tracking requests using 223 declarativeNetRequest rules before they load |
| 2 | **Cosmetic Blocking** | Hides ad elements with 200+ CSS selectors (also handles Shadow DOM) |
| 3 | **URL Cleaning** | Strips 60+ tracking parameters (`utm_*`, `fbclid`, `gclid`, etc.) from URLs |
| 4 | **Cookie Auto-Dismiss** | Automatically clicks "Reject All" on 9 CMP frameworks + generic fallback for 6 languages |
| 5 | **Paywall Removal** | Detects and removes paywall overlays, blurred content, and scroll blockers |
| 6 | **Annoyance Blocker** | Hides chat widgets (Intercom, Drift, Tawk.to, etc.), newsletter popups, push prompts, app banners |

### Privacy & Control

| # | Feature | What It Does |
|---|---------|-------------|
| 7 | **Phishing Protection** | Detects lookalike domains using homograph detection across 200+ protected brands |
| 8 | **Referrer Stripping** | Removes Referer header on third-party requests |
| 9 | **WebRTC Protection** | Prevents WebRTC IP address leaks |
| 10 | **Ping Prevention** | Blocks `<a ping>` hyperlink auditing |
| 11 | **Filter Lists** | Subscribe to ABP-syntax blocklists (12 language filters included) |
| 12 | **Element Picker** | Point-and-click to permanently block any element on any page |
| 13 | **Statistics Dashboard** | Track blocks over time with per-site breakdown, category charts, and trend graphs |

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
2. **Content layer** — Hides elements, dismisses cookie banners, removes paywalls via injected content scripts

---

## Quick Install

```bash
git clone https://github.com/sriinnu/web-suddhi.git
```

Then load it in your browser:

| Browser | Steps |
|---------|-------|
| **Chrome / Edge / Brave** | `chrome://extensions` > Developer mode > Load unpacked > select folder |
| **Firefox** | `about:debugging` > This Firefox > Load Temporary Add-on > `manifest-mv2.json` |
| **Safari macOS** | `xcrun safari-web-extension-converter safari/` then Run in Xcode |
| **Safari iOS** | Open `safari-iOS/` in Xcode > connect device > Run |

See the full [Getting Started Guide](docs/getting-started.md) for detailed instructions, usage tips, and keyboard shortcuts.

---

## Privacy

| | |
|---|---|
| **No servers** | Zero network requests to any WebSuddhi server |
| **No analytics** | No usage tracking, no telemetry |
| **No accounts** | No sign-up, no login |
| **Local only** | All settings stored in `browser.storage.local` |
| **Open source** | Every line of code is auditable |
| **Zero dependencies** | Pure vanilla JavaScript |

---

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/getting-started.md) | Installation, usage guide, keyboard shortcuts |
| [Architecture](docs/architecture.md) | System design, message flow, DNR rule ranges |
| [What Gets Blocked](docs/what-gets-blocked.md) | Ad networks, tracking domains, cookie frameworks |
| [Paywall Removal](docs/paywall-removal.md) | How paywall detection and removal works |
| [Comparison](docs/comparison.md) | WebSuddhi vs uBlock Origin, AdGuard, Brave Shields |
| [Permissions](docs/permissions.md) | Why each permission is required |
| [Troubleshooting](docs/troubleshooting.md) | Common issues and solutions |
| [Developer Guide](docs/developer.md) | Contributing, testing, building |
| [Changelog](CHANGELOG.md) | Version history |

---

## License

[MIT License](LICENSE) — Free to use, modify, and distribute.

<p align="center">
  Built by <a href="https://github.com/sriinnu/web-suddhi"><strong>Srinivas Pendela</strong></a> with vanilla JavaScript.<br>
  No frameworks. No dependencies. No tracking.
</p>
