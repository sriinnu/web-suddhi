# Developer Guide

## Quick Start

```bash
git clone git@github.com:sriinnu/web-suddhi.git
cd web-suddhi

# Load in Chrome:
# 1. Open chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked" > select this folder

# Load in Firefox:
# 1. Open about:debugging > "This Firefox"
# 2. Click "Load Temporary Add-on"
# 3. Select manifest-mv2.json
```

## SSH Setup for GitHub

```bash
# Generate a new SSH key for GitHub
ssh-keygen -t ed25519 -C "your-email@github" -f ~/.ssh/id_ed25519_github -N ""

# Configure SSH to use this key for GitHub
cat >> ~/.ssh/config << 'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_github
  IdentitiesOnly yes
EOF

chmod 600 ~/.ssh/config

# Copy public key to clipboard, then add at https://github.com/settings/ssh/new
cat ~/.ssh/id_ed25519_github.pub | pbcopy

# Add a passphrase later for security (recommended)
ssh-keygen -p -f ~/.ssh/id_ed25519_github
```

## Testing Checklist

| # | Test | Sites |
|---|------|-------|
| 1 | Network blocking (badge shows count) | cnn.com, forbes.com, nytimes.com |
| 2 | Cosmetic ad hiding | Any news site |
| 3 | URL param stripping | Click Google search results, Facebook links |
| 4 | Cookie banner auto-dismiss | bbc.co.uk, lemonde.fr, stackoverflow.com |
| 5 | Annoyance blocking | SaaS sites with Intercom/Drift |
| 6 | Paywall removal | Medium articles, news sites |
| 7 | Pick element mode | Any page |
| 8 | Zap element mode | Any page |
| 9 | Per-site whitelist | Toggle on/off, verify behavior |
| 10 | Statistics accuracy | Check popup & options page after browsing |
| 11 | WebRTC protection | browserleaks.com/webrtc |
| 12 | Export/import rules | Options page |

## Adding a New Ad Domain

1. Add to `rules/ad-domains.json` (use next available ID)
2. Add to `background/network-blocker.js` `MV2_AD_DOMAINS` Set
3. Test: verify requests are blocked in Network tab

## Adding a New Cookie Consent Framework

1. Add selectors to `content/cookie-consent.js` `COOKIE_CONSENT_SELECTORS`
2. Add API call handler if the framework has a JS API
3. For Safari iOS, also update `safari-iOS/.../content.js`

## Contributing

Contributions are welcome! Here's how:

1. **Fork** this repository
2. **Create** a feature branch: `git checkout -b feature/my-feature`
3. **Make** your changes
4. **Test** across at least Chrome and Firefox
5. **Commit** with a descriptive message
6. **Push** and open a **Pull Request**

### Guidelines

- Keep it vanilla JS — no frameworks, no build tools, no npm
- Test on at least 2 browsers before submitting
- Follow existing code patterns and naming conventions
- Update Safari iOS files separately (they maintain independent copies)
