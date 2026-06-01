# Surgical Control — Design Spec

**Date:** 2026-06-01
**Status:** Approved design, pre-implementation
**Branch:** `feat/surgical-control`

## Summary

A frame-and-element control layer for WebSuddhi, plus a popup redesign that surfaces
it. The guiding principle, in the user's words: **one glance = maximum transparency
plus the power to block, right there.**

It resolves four reported problems:

1. **Resource-hog subframes aren't blocked.** Ad/telemetry iframes eat RAM/CPU and
   slip past the current domain-blocklist + cosmetic-hide approach (hiding ≠ stopping a
   frame that already loaded).
2. **Over-blocking.** The blocker sometimes nukes content the user wanted, forcing a
   full disable to read the page.
3. **Broken element picker.** Right-click "block element" leaks the click through to the
   ad (cross-origin iframe boundary + incomplete pointer-event capture).
4. **No clean allow/disallow for frames.** The current Allow / Whitelist / Block controls
   overlap and confuse.

The unifying insight: these are one theme — **precision and reversibility.** Block hard,
but make every block visible, attributable, and one-tap undoable at the frame/element level.

## Core architectural decision: the engine lives in content scripts

Rather than depend on background-privileged APIs that diverge across browsers
(`webNavigation`, dynamic `declarativeNetRequest`), the engine runs inside the existing
`all_frames` content script. Every frame — including cross-origin ad frames — runs our
agent, which:

- **Announces itself** (frame id, URL, parent) → background assembles a live per-tab
  **frame census**. No `webNavigation` dependency.
- **Measures its own weight** via `performance.getEntriesByType('resource')` (transferSize
  bytes) and a `PerformanceObserver` for `longtask` (CPU proxy). Measuring *from inside*
  the frame sidesteps the cross-origin `Timing-Allow-Origin` wall that zeroes out
  parent-side measurement.
- **Tears frames down** by removing the iframe node from the DOM — pure DOM, works on
  every engine including iOS.

This makes the engine uniform across all four browsers. Only network *prevention* stays
platform-specific.

### Cross-browser capability matrix

Full parity on the **core** (see frames, kill frames, estimate weight); graceful
degradation on **network prevention**.

| Layer | Mechanism | Chrome/Edge | Firefox | Safari macOS | Safari iOS |
|---|---|---|---|---|---|
| Frame census | content-script self-report | ✅ | ✅ | ✅ | ✅ |
| Heaviness estimate | in-frame `performance` API | ✅ | ✅ | ✅ | ✅\* |
| Block **now** (on demand) | DOM teardown | ✅ | ✅ | ✅ | ✅ |
| Block **permanently** | persist → network rule | DNR dynamic rule | webRequest | DNR (limited) | DNR static, applies next load |

\* iOS edge: a frame sandboxed **without** `allow-scripts` won't run our agent. Fallback:
coarse parent-side estimate or "unknown weight." Teardown from the parent still works.

### On-demand block flow (makes "persist + session" work everywhere)

1. User taps **block** on a frame.
2. **DOM teardown** kills it instantly (every browser).
3. If **persist** chosen, the frame domain is written to the user's frame-rule list.
   - Chrome/Firefox: a live network rule is also added immediately.
   - Safari iOS: recompiles into the static ruleset, so it's network-blocked **next visit**
     (instant kill is already handled by teardown).

Instant-via-DOM, permanent-via-list. No browser left behind.

## Classification

Each frame gets two **orthogonal** axes: a **category** and a **heaviness** flag.

**Category** sources:
1. **Categorized domain lists** — existing ad/tracking lists relabeled by type, plus two
   new lists:
   - **Protected allowlist** (payments: stripe/paypal/adyen/braintree/applepay · captcha:
     recaptcha/hcaptcha/turnstile · auth: accounts.google/login.microsoft · core embeds:
     youtube/vimeo/maps).
   - **Embed/social list.**
2. **Heuristics for unknowns** — frame dimensions (1×1 = tracking pixel; banner aspect =
   ad slot), URL patterns (`/ads/`, `/embed/`, `/pixel`), sandbox flags. Falls back to
   `other`.

Categories: `ad`, `analytics`, `session-replay`, `payment`, `captcha`, `auth`, `embed`,
`social`, `other`.

**Heaviness (⚡)** is independent: did the frame cross a resource budget (bytes +
long-task time)? A heavy payment frame is still ⚡ but **protected**, so never auto-killed.

**Anti-breakage guardrail (fixes #2):** protected categories are default-allowed, marked
safe, and **never auto-blocked at any aggressiveness level.**

## Aggressiveness dial

Global default, **overridable per-site** (pin a heavy dashboard you use daily to
Conservative).

- **Conservative** — only known ad/tracker domains blocked (today's behavior). Unknowns
  shown, never flagged loudly, never auto-killed.
- **Balanced (default)** — known ad/tracker auto-blocked + unknown ⚡-heavy frames
  *flagged for manual kill*. Never auto-kills unknowns.
- **Aggressive** — auto-blocks known *and* unknown ⚡-heavy non-protected frames. Labeled
  with an honest "may break some sites" warning.

#1 (block more) lives at the top of the dial; #2 (break less) is the floor; the protected
list is the seatbelt across all three.

## UI: popup redesign

**Information architecture — dense accordion dashboard** (chosen layout "C"):

- Header: extension name · current site · master on/off.
- **Pinned action bar:** Allow · Block · Pick · **⚠ Looks broken?**
  (Zap is removed as a standalone — folded into Pick, see below.)
- Collapsible sections: **Trackers**, **Frames**, **Stats**, feature toggles.

**Frames panel (the hero) — pinned hogs + grouped list** (merged layouts "A"+"B"):

- **Pinned "⚡ Resource hogs"** section at top: flat list of heavy frames regardless of
  category, with a one-tap **kill all**.
- **Grouped list** below: categories sorted by total weight, each group header showing
  aggregate cost + **block all**; rich rows (domain · category tag · heaviness meter · MB
  estimate · block/allow switch); light groups collapse.
- **Decision:** hogs appear in **both** the pinned shortcut and their real category
  (duplication kept) so group counts stay honest. Toggling in either place flips
  everywhere.
- Per-frame heaviness shown as an **estimated** meter + MB. Estimates are labeled honestly
  (browsers don't expose exact per-frame CPU).

**"Looks broken?" relax control (fixes #2):** in the pinned bar; one tap relaxes the
*cosmetic* layers (cosmetic hide / paywall removal / annoyance blocker) while **network
blocking stays on**, plus a report-this-site link.

## UI: the picker (fixes #3)

**Bug cause:** clicks leak to ads inside cross-origin iframes — the top-frame capture
listener can't see events inside a child frame, and `mousedown`/`pointerdown`/`auxclick`
weren't all intercepted.

**Fix:**

- Capture **all** pointer events (`pointerdown`, `mousedown`, `mouseup`, `click`,
  `auxclick`, `contextmenu`) in the capture phase with
  `preventDefault`/`stopImmediatePropagation`.
- **Frame-aware modes:**
  - **Element mode** (default for normal content) — select & hide an element.
  - **Frame mode** (auto when the hover target is an iframe) — you can't pick *inside* a
    cross-origin frame, so select & collapse the whole frame.
  - **Auto-switch by default; hold Alt to flip** to the other mode (escape hatch for e.g.
    selecting an iframe's parent container).
- **Zap merged into Pick:** "Zap" becomes a quick-kill modifier on the picker (skips the
  confirm dialog), not a separate button. Frees a slot in the pinned bar for "Looks
  broken?".

## Allow / block model (fixes #4)

Kills the overlapping Allow / Whitelist / Block trio. Two clear axes:

| Scope | States | Meaning |
|---|---|---|
| **This site** | Protected / Default / Paused | Protected = full blocking; Default = normal; **Paused = blocking off here** (replaces "whitelist"). |
| **This frame** | Allowed / Blocked | Per-frame override in the panel; persist or session-only, chosen per action. |

## Components

| Component | Type | Responsibility |
|---|---|---|
| `content/frame-agent.js` | new | Runs in all frames: announce identity, measure heaviness, perform DOM teardown, receive block commands. |
| `background/frame-registry.js` | new | Per-tab frame census, classification, heaviness aggregation, block decisions, persistence. |
| `background/classifier.js` | new | Category + heaviness scoring from lists + heuristics. |
| `background/network-blocker.js` | extend | On-demand per-frame network rules (dynamic/session); iOS static recompile on persist. New rule-id range, distinct from 20001–29999 (network) and 40001–69999 (filter). |
| `shared/rule-model.js` | new | Site-state + frame-rule data model and persistence. |
| `content/ad-blocker.js` | refactor | Picker: full pointer capture, frame/element modes, Alt override, Zap-as-modifier. |
| `popup/*` | rebuild | Accordion-dashboard IA, frames panel, relax control, new allow/block controls. |
| `rules/*` | extend | Categorized lists + protected allowlist + embed/social list. |

## Data flow

```
[frame-agent in each frame] --announce/heaviness--> [frame-registry (bg)]
                                                          |
                                              classify (classifier)
                                                          |
                                              apply aggressiveness + site/frame rules
                                                          |
                  +---------------------------------------+----------------------+
                  |                                                               |
        [popup] <--census/state--                                  --block cmd--> [frame-agent: DOM teardown]
                                                                                 + [network-blocker: persist rule]
```

## Error handling & edge cases

- **Sandboxed frames (no `allow-scripts`):** no agent → coarse parent estimate or "unknown
  weight"; teardown still works from parent.
- **Protected frames:** never auto-blocked, regardless of dial.
- **Cross-origin measurement:** done inside the frame to avoid `Timing-Allow-Origin`.
- **Non-persistent service worker (iOS/MV3):** state in storage; census rebuilds on demand.
- **SPA / dynamic frames:** census updates on agent announce / frame removal.
- **Sensitive pages:** keep existing guard — no aggressive behavior on bank/login/password
  pages.

## Testing

- Unit: classifier (category + heaviness), rule-model (site/frame state, persist vs
  session), census aggregation.
- Message contracts: frame-agent ↔ background.
- UI smoke: popup accordion render, frames panel, relax control.
- Manual cross-browser matrix: Chrome, Edge, Firefox, Safari macOS, Safari iOS — verify the
  capability matrix degrades as documented.

## Out of scope (YAGNI)

- New themes / theme-system changes.
- Site Security / certificate / AI-scam-risk rework — relocate in the popup as needed, do
  not redesign here.
- Full options-page redesign — add only the aggressiveness setting + per-site overrides UI.
