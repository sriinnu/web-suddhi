# Architecture

```mermaid
flowchart TB
    subgraph UI["UI Layer"]
        popup["Popup"]
        options["Options Page"]
    end

    subgraph BG["Background — Service Worker (MV3) / Background Page (MV2)"]
        router["background.js — Message Router"]
        nb["network-blocker.js — DNR / webRequest"]
        uc["url-cleaner.js — Param Stripping"]
        sm["stats-manager.js — Stats + Flush"]
        pr["privacy.js — Referrer / WebRTC / Ping"]
        fl["filter-lists.js — ABP Parser"]
        pd["phishing-detector.js — Brand Impersonation"]
    end

    subgraph CS["Content Scripts — Injected per page"]
        ab["ad-blocker.js — Cosmetic Hiding / Pick / Zap"]
        cc["cookie-consent.js — CMP Auto-Dismiss"]
        ann["annoyance-blocker.js — Widgets / Popups"]
    end

    subgraph Rules["Static DNR Rulesets"]
        ad["ad-domains.json — 120 rules"]
        tr["tracking-domains.json — 103 rules"]
        tp["tracking-params.json — URL params"]
    end

    utils["shared/utils.js — Storage / DOM / Validation"]

    popup & options <-->|"runtime.sendMessage"| router
    router -->|"importScripts (MV3)"| nb & uc & sm & pr & fl & pd
    router <-->|"runtime.sendMessage"| ab & cc & ann
    nb ---|"reads"| Rules
    utils -.->|"used by"| router
    utils -.->|"used by"| ab
```

All background modules share a single namespace via `self.WebSuddhi = {}` and are loaded by `importScripts()` in MV3. In MV2 (Firefox), they load as separate scripts in the background page. Content scripts communicate with the background exclusively through `runtime.sendMessage`.

Safari iOS maintains standalone copies of background, content, and popup scripts under `safari-iOS/` that use the `browser.*` API directly.

## DNR Rule ID Ranges

| Range | Purpose |
|-------|---------|
| 1 — 4999 | Ad domain blocking rules |
| 5001 — 9999 | Tracking domain rules |
| 10001 — 19999 | URL parameter stripping |
| 20001 — 29999 | Dynamic rules (user-added domains) |
| 30001 — 39999 | Privacy rules (referrer, ping) |
| 40001 — 69999 | Filter list subscription rules |
