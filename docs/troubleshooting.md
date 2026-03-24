# Troubleshooting

## "Extension cannot be loaded"

Make sure you're loading the correct manifest:
- **Chrome/Edge/Brave**: Select the project root folder (uses `manifest.json`)
- **Firefox**: Select `manifest-mv2.json` specifically
- **Safari**: Use the `safari/` folder or Xcode converter

## Ads still appearing after install

1. Check the badge count — if > 0, network blocking is working
2. Some ads use first-party domains that aren't in the blocklist
3. Use **Pick Element** to manually block specific elements
4. Check if the site is whitelisted (popup > "Disable on this site")
5. Hard refresh: `Cmd+Shift+R` / `Ctrl+Shift+R`

## Cookie banners not being dismissed

1. Verify "Cookie Auto-Dismiss" is enabled in the popup
2. Click **"Dismiss Cookies Now"** for immediate action
3. Some sites use custom (non-standard) cookie implementations
4. File an issue with the site URL and we'll add support

## A website is broken

1. Toggle **"Disable on this site"** in the popup to whitelist it
2. Try disabling individual features (network blocking, annoyance blocker)
3. The site may depend on a blocked third-party resource
4. File an issue with details and we'll investigate

## Extension not working on Safari iOS

1. Go to Settings > Safari > Extensions
2. Make sure WebSuddhi is enabled
3. Tap WebSuddhi > grant "All Websites" permission
4. Restart Safari
