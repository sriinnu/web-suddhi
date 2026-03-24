# What Gets Blocked

## Network Requests (223 Rules)

### Ad Networks (120 rules)

| Category | Domains |
|----------|---------|
| Google | doubleclick.net, googlesyndication.com, googleadservices.com, adservice.google.com |
| Analytics | google-analytics.com, googletagmanager.com |
| Major Networks | criteo.com, taboola.com, outbrain.com, amazon-adsystem.com |
| Programmatic | adnxs.com, pubmatic.com, openx.net, rubiconproject.com, casalemedia.com |
| Social | connect.facebook.net, pixel.facebook.com, ads.twitter.com, ads.linkedin.com |
| Video | jwpltx.com, connatix.com, spotxchange.com |
| Native | revcontent.com, mgid.com, nativo.com, bidtellect.com |
| Behavioral | mixpanel.com, segment.com, hotjar.com, clarity.ms, fullstory.com |
| And 80+ more... | |

### Tracking & Fingerprinting (103 rules)

| Category | Domains |
|----------|---------|
| Fingerprinting | fingerprintjs.com, fpjs.io, perimeterx.com, datadome.co |
| Session Recording | logrocket.com, smartlook.com, sessionstack.com, contentsquare.com |
| Product Analytics | amplitude.com, posthog.com, pendo.io, walkme.com |
| Marketing | clearbit.com, zoominfo.com, apollo.io, pardot.com, marketo.com |
| Social Pixels | scorecardresearch.com, imrworldwide.com |
| Data Brokers | bluekai.com, bombora.com, lotame.com, eyeota.com |
| And 60+ more... | |

### Tracking Parameters (60+ stripped)

| Source | Parameters |
|--------|-----------|
| Google | `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid`, `gclsrc`, `dclid`, `gbraid`, `wbraid` |
| Facebook | `fbclid`, `fb_action_ids`, `fb_action_types`, `fb_source`, `fb_ref` |
| Microsoft | `msclkid` |
| Twitter | `twclid` |
| HubSpot | `_hsenc`, `_hsmi`, `__hstc`, `__hsfp`, `hsCtaTracking` |
| Mailchimp | `mc_cid`, `mc_eid` |
| Adobe | `s_cid`, `icid` |
| Yandex | `yclid`, `_openstat`, `ymclid` |
| Generic | `_ga`, `_gl`, `igshid`, `si`, `ref`, `ref_src` |
| And 20+ more... | |

## Cookie Consent Frameworks

| Framework | Detection | Dismiss Method |
|-----------|-----------|---------------|
| OneTrust | `#onetrust-consent-sdk` | `OneTrust.RejectAll()` API + button fallback |
| Cookiebot | `#CybotCookiebotDialog` | `Cookiebot.decline()` API + button fallback |
| TrustArc | `#truste-consent-required` | Button click |
| Quantcast | `.qc-cmp2-summary-buttons` | Button click |
| Didomi | `#didomi-host` | `Didomi.setUserDisagreeToAll()` API + button fallback |
| CookieYes | `.cky-btn-reject` | Button click |
| Complianz | `.cmplz-deny` | Button click |
| Osano | `.osano-cm-deny` | Button click |
| CookieNotice | `.cookie-notice-container` | Button click |
| **Generic** | Container detection | Text-based search in EN, DE, FR, ES, IT, PT |

## Annoyances Blocked

| Category | Examples |
|----------|---------|
| Chat Widgets | Intercom, Drift, Tawk.to, Crisp, HubSpot, Zendesk, Freshchat, Tidio, Kommunicate |
| Newsletter Popups | Mailchimp modals, Klaviyo, Sumo, OptinMonster, Privy |
| Push Prompts | OneSignal, PushCrew, WebPushr, PushEngage |
| App Install Banners | Smart banners, Branch banners |
| Social Login Walls | "Sign in with Google/Facebook" overlays |
