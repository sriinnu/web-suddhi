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
  <a href="#installation"><img src="https://img.shields.io/badge/version-2.3.0-blue?style=flat-square" alt="Version"></a>
  <a href="#supported-browsers"><img src="https://img.shields.io/badge/Chrome-MV3-4285F4?style=flat-square&logo=google-chrome&logoColor=white" alt="Chrome"></a>
  <a href="#supported-browsers"><img src="https://img.shields.io/badge/Firefox-MV2-FF7139?style=flat-square&logo=firefox-browser&logoColor=white" alt="Firefox"></a>
  <a href="#supported-browsers"><img src="https://img.shields.io/badge/Safari-macOS%20%7C%20iOS-000?style=flat-square&logo=safari&logoColor=white" alt="Safari"></a>
  <a href="#supported-browsers"><img src="https://img.shields.io/badge/Edge-MV3-0078D7?style=flat-square&logo=microsoft-edge&logoColor=white" alt="Edge"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"></a>
</p>

<p align="center">
  <a href="#installation">Install</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#comparison">Compare</a> &bull;
  <a href="CHANGELOG.md">Changelog</a> &bull;
  <a href="docs/architecture.md">Architecture</a>
</p>

---

## The Modern Web Is Broken

You open an article. Before you read the first sentence, your browser has quietly contacted dozens of ad networks, analytics platforms, and data brokers. A cookie banner demands your consent. A chat widget pulses in the corner. A newsletter popup covers the text. The URL contains invisible tags that follow you to the next site, and the one after that.

This is not accidental. It is the architecture.

**WebSuddhi dismantles it — silently, completely, before it reaches you.**

One extension. 40,000+ blocking rules. Zero data collection. Every browser.

---

## Features

### Core Protection

| | Feature | What You Get |
|---|---------|-------------|
| 1 | **Network Blocking** | Pages load faster. 40,000+ rules block ads and trackers before they execute. |
| 2 | **Cosmetic Blocking** | Visual ads that slip past network blocking are silently removed before you see them. |
| 3 | **URL Cleaning** | Tracking tags (utm, fbclid, gclid) are stripped from every URL. You browse clean. |
| 4 | **Cookie Auto-Dismiss** | Cookie banners vanish automatically. You never click "Accept All" again. |
| 5 | **Paywall Removal** | Articles load in full. Overlays, gates, and subscribe walls are removed. |
| 6 | **Annoyance Blocker** | Chat widgets, newsletter popups, push prompts, app banners — gone. |

### Privacy & Control

| | Feature | What You Get |
|---|---------|-------------|
| 7 | **Phishing Protection** | Lookalike domains are detected using homograph analysis across 200+ brands. |
| 8 | **Referrer Stripping** | Sites cannot see where you came from. |
| 9 | **WebRTC Protection** | Your real IP stays private, even behind a VPN. |
| 10 | **Filter Lists** | Subscribe to custom blocklists or use our curated HaGeZi/AdGuard/PhishTank compilation. |
| 11 | **Element Picker** | Point-and-click to permanently block any element on any page. |
| 12 | **Statistics** | Track blocks over time with per-site breakdown, category charts, and trend graphs. |
| 13 | **Site Detail Drawer** | Click any site in Top Sites to see what's blocked there, unblock a single selector, preview it first, or clear the site's stats. |
| 14 | **Pause per Site** | Pause protection on a site for 15 min / 1 hour / 1 day without adding it to your permanent whitelist. Auto-resumes when the timer runs out. |
| 15 | **Report Broken Site** | One click from the popup pauses the current site for an hour and logs a report, so you can keep browsing and fix the rule later. |

---

## Comparison

| Feature | WebSuddhi | uBlock Origin | AdBlock Plus | Ghostery |
|---------|:---------:|:-------------:|:------------:|:--------:|
| Network-level blocking | Yes | Yes | Yes | Yes |
| Cosmetic element hiding | Yes | Yes | Yes | Limited |
| Cookie banner auto-dismiss | Yes | No | No | No |
| Paywall removal | Yes | No | No | No |
| URL tracking param stripping | Yes | No | No | No |
| Annoyance blocking (chat, popups) | Yes | Partial | No | No |
| Phishing detection | Yes | No | No | No |
| WebRTC leak protection | Yes | No | No | No |
| Custom filter subscriptions | Yes | Yes | Yes | No |
| Safari iOS support | Yes | No | No | Yes |
| Data collection | None | None | Acceptable Ads* | Analytics* |

<sub>* AdBlock Plus includes "Acceptable Ads" by default. Ghostery collects anonymized analytics.</sub>

---

## Supported Browsers

| Browser | Manifest | Status |
|---------|----------|--------|
| Chrome / Edge / Brave / Opera / Vivaldi / Arc | MV3 | Fully supported |
| Firefox | MV2 | Fully supported |
| Safari macOS | MV3 | Fully supported |
| Safari iOS / iPadOS | MV3 | Fully supported |

---

## Installation

### Chrome / Edge / Brave (60 seconds)

1. **Download** this repository (or `git clone https://github.com/sriinnu/web-suddhi.git`)
2. **Open** `chrome://extensions` in your browser
3. **Enable** Developer mode (toggle in the top-right corner)
4. **Click** "Load unpacked" and select the `web-suddhi` folder
5. Done. The shield icon appears in your toolbar.

### Firefox

1. Open `about:debugging` > "This Firefox"
2. Click "Load Temporary Add-on"
3. Select `manifest-mv2.json`

### Safari

Safari installation requires Xcode. See [Getting Started](docs/getting-started.md) for detailed instructions including iOS.

---

## How It Works

Two layers of defense:

1. **Network layer** — 40,000+ declarativeNetRequest rules block ad/tracker requests before they load. Zero bandwidth wasted.
2. **Content layer** — Hides elements that slip through, dismisses cookie banners, removes paywalls, cleans annoyances.

> For the full architecture, message flow, and DNR rule ranges: [Architecture deep-dive](docs/architecture.md)

---

## Privacy

| | |
|---|---|
| **No servers** | Zero network requests to any WebSuddhi server. Ever. |
| **No analytics** | No usage tracking, no telemetry, no crash reporting. |
| **No accounts** | No sign-up, no login, no email. |
| **Local only** | All data stored in `browser.storage.local`. |
| **Open source** | Every line auditable. No obfuscation. |
| **No dependencies** | Pure vanilla JavaScript. No supply chain risk. |

---

## Blocking Sources

WebSuddhi compiles 40,000+ rules from these trusted upstream sources at build time:

| Source | Category | Rules |
|--------|----------|-------|
| [HaGeZi Pro](https://github.com/hagezi/dns-blocklists) | Ads & Trackers | 15,000 |
| [HaGeZi Threat Intelligence](https://github.com/hagezi/dns-blocklists) | Malware & Phishing | 10,000 |
| [AdGuard DNS Filter](https://github.com/AdguardTeam/AdGuardSDNSFilter) | Ads & Trackers | 10,000 |
| [HaGeZi Fake/Scam](https://github.com/hagezi/dns-blocklists) | Fraud & Scams | 5,000 |
| [Phishing URL Blocklist](https://malware-filter.gitlab.io/malware-filter/) | Phishing | 5,000 |
| [HaGeZi Pop-Up Ads](https://github.com/hagezi/dns-blocklists) | Pop-ups | 5,000 |
| [HaGeZi DynDNS](https://github.com/hagezi/dns-blocklists) | DynDNS Abuse | 1,500 |
| + Hand-curated | All categories | 223 |

Rebuild anytime: `node scripts/build-blocklists.mjs`

> Full list of blocked domains and cookie frameworks: [What Gets Blocked](docs/what-gets-blocked.md)

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+P` | Toggle element picker |
| `Alt+W` | Toggle whitelist for current site |
| `Alt+S` | Open settings |
| Popup → "Site broken?" | Pause current site for 1 hour and log a report |

---

## Custom Themes

The palette picker ships with 10+ built-in themes. To add your own, edit `shared/themes.json` — each entry becomes a card in Settings → Appearance. No rebuild, no JS edits.

```json
{
  "id": "my-theme",
  "name": "My Theme",
  "recommendedFont": "Geist",
  "swatches": ["#F4EFE6", "#7C5CFF", "#2AA6A0", "#1A1A2E"],
  "tokens": {
    "--bg-primary": "#F4EFE6",
    "--text-primary": "#1A1A2E",
    "--accent": "#7C5CFF",
    "--font-family": "'Geist', -apple-system, sans-serif"
  }
}
```

`tokens` maps to the same CSS custom properties used by every built-in theme (full list in `shared/themes.css`). `recommendedFont` sets the theme's default type; the user can still override it from the Font Family picker. Delete an entry and it disappears from the UI on next reload.

---

## Contributing

Contributions welcome. Fork, create a feature branch, test on 2+ browsers, submit a PR.

> Guidelines, testing checklist, adding domains: [Developer Guide](docs/developer.md)

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | System design, message flow, DNR rule ranges |
| [What Gets Blocked](docs/what-gets-blocked.md) | Full domain lists, cookie frameworks, annoyances |
| [Permissions](docs/permissions.md) | Why each permission is required |
| [Troubleshooting](docs/troubleshooting.md) | Common issues and solutions |
| [Developer Guide](docs/developer.md) | Contributing, testing, building |
| [Changelog](CHANGELOG.md) | Version history |

---

## License

[MIT License](LICENSE) — Free to use, modify, and distribute.

---

<p align="center">
  <strong>The web was designed to be open. WebSuddhi keeps it that way.</strong>
</p>

<p align="center">
  Built in vanilla JavaScript. No frameworks. No dependencies. No tracking. No compromises.
</p>

<p align="center">
  <a href="#installation">Install in 60 seconds</a> &bull;
  <a href="https://github.com/sriinnu/web-suddhi/stargazers">Star on GitHub</a> &bull;
  <a href="https://buymeacoffee.com/sriinnu">Buy Me a Coffee</a>
</p>
