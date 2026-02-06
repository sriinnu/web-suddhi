# WebSuddhi - Technical Notes

## Storage Architecture

### Where is data stored?

Browser extensions use `chrome.storage.local` (or `browser.storage.local` in Firefox) - **NOT** JSON files or SQLite in the extension directory.

**Chrome/Edge Storage Location:**
```
~/.config/google-chrome/Default/Local Extension Settings/<extension-id>/
```
Uses LevelDB format internally.

**Firefox Storage Location:**
```
~/.mozilla/firefox/<profile>/storage/default/moz-extension+++<extension-id>/
```
Uses IndexedDB internally.

### Why not JSON/SQLite files?

1. **Extension directories are read-only** after installation (browser security model)
2. Extensions cannot access the file system without special permissions
3. Browser-managed storage provides sync, backup, and security features

### What's stored?

| Key | Description |
|-----|-------------|
| `enabled` | Main protection toggle |
| `blockedSelectors` | Custom CSS selector blocking rules |
| `whitelistedSites` | Sites where protection is disabled |
| `filterSubscriptions` | External filter list subscriptions |
| `stats` | Blocking statistics (per day, per site) |
| `performanceStats` | Data saved, time saved estimates |
| `requestLog` | Recent blocked requests (max 100) |
| `jsDisabledSites` | Sites with JavaScript disabled |
| `blockedDomains` | Custom domain blocks |
| `theme` | UI theme preference |

### Export/Import

The Options page provides Export/Import functionality:
- **Export**: Downloads a JSON file with all rules and settings
- **Import**: Restores from a previously exported JSON file

### Alternative Storage Options (Not Implemented)

For true local file storage, these approaches could be used:
1. **File System Access API** - Chrome only, requires user permission each session
2. **Native Messaging** - Requires a separate native app installation
3. **WebDAV/Cloud Sync** - Requires external service

---

## Certificate Information

### Browser API Limitations

**Firefox** - Full certificate access via `browser.webRequest.getSecurityInfo()`:
- Certificate chain
- Issuer and subject details
- Validity dates
- Fingerprints

**Chrome/Edge** - Limited access:
- Can only detect HTTPS vs HTTP
- No direct certificate details API
- Must rely on domain heuristics for organization info

### What We Show

- Protocol (HTTPS/HTTP)
- Encryption status (TLS Encrypted / Unencrypted)
- Organization name (from cert in Firefox, domain heuristics in Chrome)
- Security status with visual indicators

---

## Third-Party Frame Detection

### How it works

1. Content script scans for `<iframe>`, `<object>`, `<embed>` elements
2. Extracts source URLs and compares hostnames
3. Reports third-party frames to background script
4. Popup displays list with allow/block controls

### Limitations

- Cannot inspect iframe contents (cross-origin security)
- Some iframes load dynamically after initial scan
- Blocked frames may still make initial connection

---

## Phishing Detection

### Detection Methods

1. **Homograph detection** - Cyrillic/Greek characters that look like Latin
2. **Brand impersonation** - Domains similar to protected brands
3. **Subdomain tricks** - e.g., `amazon.com.evil.com`
4. **Levenshtein distance** - Similarity scoring against known brands

### Protected Brands

Over 100 brands protected including:
- Tech: Google, Microsoft, Apple, Amazon, Meta, etc.
- Banks: Chase, Bank of America, Wells Fargo, etc.
- Payment: PayPal, Stripe, Venmo, etc.
- Streaming: Netflix, Spotify, Disney+, etc.

### False Positives

Some legitimate sites may trigger warnings if their domain is similar to a protected brand. Users can:
1. Dismiss the warning and proceed
2. Report false positives for review

---

## Filter Lists

### Supported Formats

- **ABP (Adblock Plus) syntax** - `||domain.com^` format
- Domain blocking rules only (cosmetic filters parsed but not fully supported)

### Built-in Lists

- WebSuddhi Ad Domains (bundled)
- WebSuddhi Tracking Domains (bundled)

### External Subscriptions

- Must use HTTPS (security requirement)
- Auto-update every 24 hours
- Max 10,000 rules per subscription
- Max 2MB file size

---

## Performance Considerations

### Rate Limiting

- 10 messages per tab per second
- 100 global messages per second
- Prevents malicious pages from DOSing the extension

### Caching

- Phishing detection results cached for 5 minutes
- LRU cache with max 1000 entries

### Stats Flushing

- In-memory stats flushed to storage every 30 seconds
- Emergency flush on browser suspend/close

---

## Browser Compatibility

| Feature | Chrome | Firefox | Edge | Safari |
|---------|--------|---------|------|--------|
| MV3 Support | ✅ | ❌ | ✅ | ✅ |
| MV2 Support | ❌ | ✅ | ❌ | ❌ |
| declarativeNetRequest | ✅ | ❌ | ✅ | ✅ |
| webRequest blocking | Limited | ✅ | Limited | ❌ |
| Certificate Info | ❌ | ✅ | ❌ | ❌ |
| Privacy API | ✅ | ✅ | ✅ | ❌ |

---

## Development Notes

### Debug Mode

Enable debug logging in browser console:
```javascript
chrome.storage.local.set({ debugEnabled: true });
```

### Testing Phishing Detection

Test domains (do not actually visit):
- `arnazon.com` (amazon typo)
- `g00gle.com` (number substitution)
- `paypa1.com` (letter substitution)

### Manual Filter List Update

```javascript
chrome.runtime.sendMessage({ type: 'UPDATE_ALL_FILTER_SUBSCRIPTIONS' });
```
