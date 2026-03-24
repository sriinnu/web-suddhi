# Permissions Explained

| Permission | Required | Why |
|------------|----------|-----|
| `storage` | Yes | Store your rules, settings, and statistics locally |
| `activeTab` | Yes | Communicate with the current page for element picking |
| `tabs` | Yes | Get current tab URL for whitelisting and badge updates |
| `scripting` | Yes | Inject content scripts for cosmetic blocking (MV3) |
| `declarativeNetRequest` | Yes | Block ad/tracking network requests (MV3) |
| `alarms` | Yes | Schedule filter list auto-updates (every 24h) |
| `webNavigation` | Yes | Reset badge counts when navigating to a new page |
| `<all_urls>` | Yes | Access all websites to apply blocking |
| `privacy` | Optional | WebRTC IP leak prevention (only if you enable it) |
| `declarativeNetRequestFeedback` | Optional | Debug blocked request details (dev mode only) |

**MV2 equivalents:** `webRequest` + `webRequestBlocking` replace `declarativeNetRequest`.
