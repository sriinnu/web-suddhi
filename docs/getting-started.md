# Getting Started

## Installation

### Chrome / Edge / Brave / Opera / Vivaldi

```bash
git clone https://github.com/sriinnu/web-suddhi.git
```

1. Open `chrome://extensions` (or your browser's extension page)
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** > select the `web-suddhi` folder
4. The WebSuddhi icon appears in your toolbar — you're protected

### Firefox

1. Navigate to `about:debugging`
2. Click **This Firefox** > **Load Temporary Add-on**
3. Select `manifest-mv2.json`

> **Note:** Temporary add-ons are removed when Firefox closes. A signed XPI for permanent installation is coming soon.

### Safari (macOS)

```bash
xcrun safari-web-extension-converter safari/
# Opens in Xcode — click "Run" to install
```

### Safari (iOS)

1. Open the Xcode project in `safari-iOS/`
2. Connect your device, select it in Xcode, click **Run**
3. On device: **Settings > Safari > Extensions > enable WebSuddhi**

---

## Quick Tour

### Automatic Protection (Zero Config)

WebSuddhi starts protecting immediately after installation. No setup needed.

| What happens | When |
|---|---|
| Ad & tracker requests blocked | Every page load |
| Tracking params stripped from URLs | Every navigation |
| Cookie banners auto-dismissed | Within seconds of page load |
| Paywalls removed | Within 1-3 seconds |
| Chat widgets & popups hidden | On page load |

### Popup Controls

Click the WebSuddhi toolbar icon to open the popup:

- **Protection toggle** — Master on/off switch
- **Site info** — Shows current domain, security status (HTTPS, certificate details)
- **Tracker summary** — Detected tracker categories on the current page
- **Stats** — Network blocked, cosmetic hidden, rules count, data saved
- **Feature toggles** — Enable/disable individual features per-session
- **Quick actions** — Pick Element, Zap Element, Whitelist, Settings

### Blocking Elements Manually

**Pick Mode** — Permanently block an element:
1. Click the WebSuddhi icon > **Pick Element to Block** (or press `Alt+P`)
2. Hover over the element — it highlights in red
3. Click to select > confirm with **Block**
4. The rule is saved for all future visits to that site

**Zap Mode** — Temporarily hide an element:
1. Click the WebSuddhi icon > **Zap Element**
2. Click any element to instantly hide it
3. Hidden until page refresh (no rule saved)

### Whitelisting Sites

To disable WebSuddhi on a specific site:
- Click the toolbar icon > **Whitelist** button
- Or press `Alt+W` as a keyboard shortcut

To remove a site from the whitelist:
- Open **Settings > Rules > Whitelisted Sites** and click the X

### Settings Page

Open settings by:
- Clicking the gear icon in the popup
- Pressing `Alt+S`
- Right-clicking the toolbar icon > **Options**

Sections:
| Section | What you can configure |
|---------|----------------------|
| **General** | Protection, paywall removal, network blocking, URL cleaning, cookie dismiss, annoyance blocking, sync, notification duration |
| **Privacy** | Phishing protection, ping blocking, referrer stripping, WebRTC protection, telemetry blocking, third-party cookie blocking |
| **Rules** | Custom blocked elements, whitelisted sites, import/export |
| **Filter Lists** | Language-specific filters, custom filter subscriptions |
| **Statistics** | Block counts, category breakdown, trend charts, top domains/sites |
| **Activity Log** | Live log of blocked requests with type, URL, and timestamp |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+P` | Toggle element picker mode |
| `Alt+W` | Toggle whitelist for current site |
| `Alt+S` | Open settings |

Customize shortcuts in `chrome://extensions/shortcuts` or the Settings page.

---

## Import / Export

Export your rules and settings for backup or to sync across devices:

1. Open **Settings > Rules**
2. Click **Export** to download a JSON file
3. On another device, click **Import** and select the file

The export includes: blocked selectors, blocked domains, allowed domains, and whitelisted sites.

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

## Troubleshooting

See [Troubleshooting Guide](troubleshooting.md) for common issues.

Can't find your answer? [Open an issue](https://github.com/sriinnu/web-suddhi/issues).
