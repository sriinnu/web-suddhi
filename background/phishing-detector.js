// WebSuddhi - Phishing/Homograph Detection System
// Detects suspicious domains that attempt to impersonate legitimate brands
// v1.0.0

(function() {
  'use strict';

  // Shared namespace
  if (!self.WebSuddhi) self.WebSuddhi = {};

  // Logging helpers
  const log = (...args) => {
    if (self.WebSuddhi.utils && self.WebSuddhi.utils.log) {
      self.WebSuddhi.utils.log(...args);
    }
  };

  // ============================================
  // PHISHING DETECTION CACHE
  // ============================================
  const phishingCache = new Map();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const MAX_CACHE_SIZE = 1000;

  function getCachedResult(domain) {
    const cached = phishingCache.get(domain);
    if (!cached) return null;

    if ((Date.now() - cached.timestamp) >= CACHE_TTL) {
      phishingCache.delete(domain);
      return null;
    }

    // Move to end (most recently used) for LRU ordering - O(1) with Map
    phishingCache.delete(domain);
    phishingCache.set(domain, cached);
    return cached.result;
  }

  function setCachedResult(domain, result) {
    // If key already exists, delete first so it moves to the end
    if (phishingCache.has(domain)) {
      phishingCache.delete(domain);
    }

    // Evict oldest (first) entries if at capacity - O(1) per eviction
    while (phishingCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = phishingCache.keys().next().value;
      phishingCache.delete(oldestKey);
    }

    phishingCache.set(domain, { result, timestamp: Date.now() });
  }

  function clearPhishingCache() {
    phishingCache.clear();
  }

  // ============================================
  // HOMOGRAPH CHARACTER SUBSTITUTION MAP
  // ============================================
  const HOMOGRAPH_MAP = {
    // Numbers to letters
    '0': ['o', 'O'],
    '1': ['l', 'i', 'I', 'L'],
    '2': ['z', 'Z'],
    '3': ['e', 'E'],
    '4': ['a', 'A'],
    '5': ['s', 'S'],
    '7': ['t', 'T'],

    // Special characters to letters
    '@': ['a'],
    '$': ['s'],
    '!': ['i', 'l'],

    // Cyrillic lookalikes (very common in phishing)
    'а': ['a'], // Cyrillic а (U+0430)
    'е': ['e'], // Cyrillic е (U+0435)
    'о': ['o'], // Cyrillic о (U+043E)
    'р': ['p'], // Cyrillic р (U+0440)
    'с': ['c'], // Cyrillic с (U+0441)
    'у': ['y'], // Cyrillic у (U+0443)
    'х': ['x'], // Cyrillic х (U+0445)
    'і': ['i'], // Cyrillic і (U+0456)
    'ј': ['j'], // Cyrillic ј (U+0458)
    'ѕ': ['s'], // Cyrillic ѕ (U+0455)
    'ԁ': ['d'], // Cyrillic ԁ (U+0501)
    'ԛ': ['q'], // Cyrillic ԛ (U+051B)
    'ɡ': ['g'], // Latin small letter script g (U+0261)
    'Ь': ['b'], // Cyrillic Ь (U+042C)
    'В': ['B'], // Cyrillic В (U+0412)
    'Н': ['H'], // Cyrillic Н (U+041D)
    'К': ['K'], // Cyrillic К (U+041A)
    'М': ['M'], // Cyrillic М (U+041C)
    'Т': ['T'], // Cyrillic Т (U+0422)
    'А': ['A'], // Cyrillic А (U+0410)
    'Е': ['E'], // Cyrillic Е (U+0415)
    'О': ['O'], // Cyrillic О (U+041E)
    'Р': ['P'], // Cyrillic Р (U+0420)
    'С': ['C'], // Cyrillic С (U+0421)
    'Х': ['X'], // Cyrillic Х (U+0425)

    // Greek lookalikes
    'α': ['a'], // Greek alpha
    'ο': ['o'], // Greek omicron
    'ρ': ['p'], // Greek rho
    'τ': ['t'], // Greek tau
    'ν': ['v'], // Greek nu
    'υ': ['u', 'v'], // Greek upsilon
    'ω': ['w'], // Greek omega
    'κ': ['k'], // Greek kappa
    'η': ['n'], // Greek eta
    'ι': ['i'], // Greek iota
    'γ': ['y'], // Greek gamma

    // Latin Extended lookalikes
    'ɑ': ['a'], // Latin alpha
    'ḃ': ['b'], // Latin b with dot above
    'ċ': ['c'], // Latin c with dot above
    'ḋ': ['d'], // Latin d with dot above
    'ė': ['e'], // Latin e with dot above
    'ḟ': ['f'], // Latin f with dot above
    'ġ': ['g'], // Latin g with dot above
    'ḣ': ['h'], // Latin h with dot above
    'ṁ': ['m'], // Latin m with dot above
    'ṅ': ['n'], // Latin n with dot above
    'ȯ': ['o'], // Latin o with dot above
    'ṗ': ['p'], // Latin p with dot above
    'ṙ': ['r'], // Latin r with dot above
    'ṡ': ['s'], // Latin s with dot above
    'ṫ': ['t'], // Latin t with dot above
    'ẇ': ['w'], // Latin w with dot above
    'ẋ': ['x'], // Latin x with dot above
    'ẏ': ['y'], // Latin y with dot above
    'ż': ['z'], // Latin z with dot above

    // More lookalikes
    'ℓ': ['l'], // Script small l
    'ⅰ': ['i'], // Roman numeral one
    'ⅱ': ['ii'], // Roman numeral two
    'ﬁ': ['fi'], // fi ligature
    'ﬂ': ['fl'], // fl ligature
    'œ': ['oe'], // oe ligature
    'æ': ['ae'], // ae ligature
    'ß': ['ss'], // German eszett
    'ñ': ['n'], // Spanish n with tilde
    'ü': ['u'], // u with umlaut
    'ö': ['o'], // o with umlaut
    'ä': ['a'], // a with umlaut
    'é': ['e'], // e with acute
    'è': ['e'], // e with grave
    'ê': ['e'], // e with circumflex
    'ë': ['e'], // e with diaeresis
    'à': ['a'], // a with grave
    'â': ['a'], // a with circumflex
    'î': ['i'], // i with circumflex
    'ï': ['i'], // i with diaeresis
    'ô': ['o'], // o with circumflex
    'û': ['u'], // u with circumflex
    'ù': ['u'], // u with grave
    'ç': ['c'], // c with cedilla

    // Fullwidth characters
    'ａ': ['a'], 'ｂ': ['b'], 'ｃ': ['c'], 'ｄ': ['d'], 'ｅ': ['e'],
    'ｆ': ['f'], 'ｇ': ['g'], 'ｈ': ['h'], 'ｉ': ['i'], 'ｊ': ['j'],
    'ｋ': ['k'], 'ｌ': ['l'], 'ｍ': ['m'], 'ｎ': ['n'], 'ｏ': ['o'],
    'ｐ': ['p'], 'ｑ': ['q'], 'ｒ': ['r'], 'ｓ': ['s'], 'ｔ': ['t'],
    'ｕ': ['u'], 'ｖ': ['v'], 'ｗ': ['w'], 'ｘ': ['x'], 'ｙ': ['y'],
    'ｚ': ['z'],

    // Mathematical/special characters
    '∂': ['d'], // Partial differential
    '∩': ['n'], // Intersection
    '∪': ['u'], // Union
  };

  // Multi-character substitutions (common typo tricks)
  const MULTI_CHAR_MAP = {
    'rn': ['m'],
    'vv': ['w'],
    'cl': ['d'],
    'nn': ['m'],
    'iii': ['m'],
    'lll': ['m'],
    'ii': ['u', 'n'],
    'll': ['u', 'n'],
    'ij': ['y'],
    'lj': ['y'],
    'cj': ['g'],
    'ci': ['a'],
    'ri': ['n'],
    'in': ['m'],
    'ni': ['m'],
  };

  // ============================================
  // PROTECTED BRANDS LIST
  // ============================================
  const PROTECTED_BRANDS = [
    // Tech Giants
    { name: 'Amazon', domains: ['amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.in', 'amazon.fr', 'amazon.es', 'amazon.it', 'amazon.ca', 'amazon.com.au', 'amazon.co.jp', 'amazon.com.br', 'aws.amazon.com', 'prime.amazon.com'] },
    { name: 'Microsoft', domains: ['microsoft.com', 'live.com', 'outlook.com', 'office.com', 'xbox.com', 'azure.com', 'microsoftonline.com', 'windows.com', 'skype.com', 'bing.com', 'msn.com', 'onedrive.com', 'sharepoint.com', 'teams.microsoft.com'] },
    { name: 'Google', domains: ['google.com', 'gmail.com', 'youtube.com', 'googleapis.com', 'googledrive.com', 'google.co.uk', 'google.de', 'google.fr', 'google.es', 'google.it', 'google.ca', 'google.com.au', 'google.co.jp', 'google.co.in', 'google.com.br', 'googlemail.com', 'gstatic.com', 'chromium.org'] },
    { name: 'Apple', domains: ['apple.com', 'icloud.com', 'itunes.com', 'me.com', 'mac.com', 'apple.co.uk', 'apple.de', 'apple.fr'] },
    { name: 'Meta/Facebook', domains: ['facebook.com', 'fb.com', 'instagram.com', 'whatsapp.com', 'messenger.com', 'meta.com', 'oculus.com', 'threads.net'] },
    { name: 'Twitter/X', domains: ['twitter.com', 'x.com', 't.co', 'twimg.com'] },
    { name: 'LinkedIn', domains: ['linkedin.com', 'licdn.com'] },

    // Payment/Financial
    { name: 'PayPal', domains: ['paypal.com', 'paypal.me', 'paypalobjects.com'] },
    { name: 'Stripe', domains: ['stripe.com', 'stripe.network'] },
    { name: 'Square', domains: ['squareup.com', 'square.com', 'cash.app'] },
    { name: 'Venmo', domains: ['venmo.com'] },
    { name: 'Zelle', domains: ['zellepay.com'] },
    { name: 'Wise', domains: ['wise.com', 'transferwise.com'] },

    // Major Banks
    { name: 'Bank of America', domains: ['bankofamerica.com', 'bofa.com', 'mbna.com'] },
    { name: 'Chase', domains: ['chase.com', 'jpmorganchase.com', 'jpmorgan.com'] },
    { name: 'Wells Fargo', domains: ['wellsfargo.com', 'wf.com'] },
    { name: 'Citibank', domains: ['citi.com', 'citibank.com', 'citicards.com', 'citigroup.com'] },
    { name: 'American Express', domains: ['americanexpress.com', 'amex.com'] },
    { name: 'Capital One', domains: ['capitalone.com', 'capitalone360.com'] },
    { name: 'US Bank', domains: ['usbank.com'] },
    { name: 'PNC', domains: ['pnc.com'] },
    { name: 'TD Bank', domains: ['td.com', 'tdbank.com'] },
    { name: 'HSBC', domains: ['hsbc.com', 'hsbc.co.uk'] },
    { name: 'Barclays', domains: ['barclays.com', 'barclays.co.uk'] },
    { name: 'Lloyds', domains: ['lloydsbank.com', 'lloydstsb.com'] },
    { name: 'Santander', domains: ['santander.com', 'santander.co.uk'] },
    { name: 'NatWest', domains: ['natwest.com'] },
    { name: 'RBS', domains: ['rbs.com', 'rbs.co.uk'] },
    { name: 'Deutsche Bank', domains: ['db.com', 'deutsche-bank.de'] },
    { name: 'BNP Paribas', domains: ['bnpparibas.com'] },
    { name: 'Credit Suisse', domains: ['credit-suisse.com'] },
    { name: 'UBS', domains: ['ubs.com'] },
    { name: 'ING', domains: ['ing.com'] },
    { name: 'Commonwealth Bank', domains: ['commbank.com.au'] },
    { name: 'ANZ', domains: ['anz.com', 'anz.com.au'] },
    { name: 'Westpac', domains: ['westpac.com.au'] },
    { name: 'NAB', domains: ['nab.com.au'] },
    { name: 'ICICI Bank', domains: ['icicibank.com'] },
    { name: 'HDFC Bank', domains: ['hdfcbank.com'] },
    { name: 'State Bank of India', domains: ['sbi.co.in', 'onlinesbi.com'] },

    // Credit Cards
    { name: 'Visa', domains: ['visa.com'] },
    { name: 'Mastercard', domains: ['mastercard.com', 'mastercard.us'] },
    { name: 'Discover', domains: ['discover.com', 'discovercard.com'] },

    // Streaming Services
    { name: 'Netflix', domains: ['netflix.com'] },
    { name: 'Disney+', domains: ['disneyplus.com', 'disney.com', 'go.com'] },
    { name: 'Hulu', domains: ['hulu.com'] },
    { name: 'HBO', domains: ['hbo.com', 'hbomax.com', 'max.com'] },
    { name: 'Spotify', domains: ['spotify.com'] },
    { name: 'Twitch', domains: ['twitch.tv'] },
    { name: 'Tiktok', domains: ['tiktok.com'] },
    { name: 'Snapchat', domains: ['snapchat.com', 'snap.com'] },
    { name: 'Pinterest', domains: ['pinterest.com'] },
    { name: 'Reddit', domains: ['reddit.com', 'redd.it'] },

    // Cloud/Storage
    { name: 'Dropbox', domains: ['dropbox.com', 'dropboxusercontent.com'] },
    { name: 'Box', domains: ['box.com', 'box.net'] },
    { name: 'Adobe', domains: ['adobe.com', 'adobelogin.com', 'behance.net', 'typekit.com'] },
    { name: 'Salesforce', domains: ['salesforce.com', 'force.com'] },
    { name: 'Slack', domains: ['slack.com'] },
    { name: 'Zoom', domains: ['zoom.us', 'zoom.com'] },
    { name: 'DocuSign', domains: ['docusign.com', 'docusign.net'] },

    // E-commerce
    { name: 'eBay', domains: ['ebay.com', 'ebay.co.uk', 'ebay.de'] },
    { name: 'Walmart', domains: ['walmart.com'] },
    { name: 'Target', domains: ['target.com'] },
    { name: 'Best Buy', domains: ['bestbuy.com'] },
    { name: 'Costco', domains: ['costco.com'] },
    { name: 'Etsy', domains: ['etsy.com'] },
    { name: 'Shopify', domains: ['shopify.com', 'myshopify.com'] },
    { name: 'Alibaba', domains: ['alibaba.com', 'aliexpress.com', 'alipay.com'] },
    { name: 'Rakuten', domains: ['rakuten.com', 'rakuten.co.jp'] },

    // Ride-sharing/Delivery
    { name: 'Uber', domains: ['uber.com', 'ubereats.com'] },
    { name: 'Lyft', domains: ['lyft.com'] },
    { name: 'DoorDash', domains: ['doordash.com'] },
    { name: 'Grubhub', domains: ['grubhub.com'] },
    { name: 'Instacart', domains: ['instacart.com'] },

    // Travel
    { name: 'Airbnb', domains: ['airbnb.com'] },
    { name: 'Booking.com', domains: ['booking.com'] },
    { name: 'Expedia', domains: ['expedia.com'] },
    { name: 'Hotels.com', domains: ['hotels.com'] },
    { name: 'Tripadvisor', domains: ['tripadvisor.com'] },
    { name: 'Kayak', domains: ['kayak.com'] },
    { name: 'Priceline', domains: ['priceline.com'] },

    // Shipping/Logistics
    { name: 'DHL', domains: ['dhl.com', 'dhl.de'] },
    { name: 'FedEx', domains: ['fedex.com'] },
    { name: 'UPS', domains: ['ups.com'] },
    { name: 'USPS', domains: ['usps.com'] },
    { name: 'Royal Mail', domains: ['royalmail.com'] },

    // Crypto
    { name: 'Coinbase', domains: ['coinbase.com'] },
    { name: 'Binance', domains: ['binance.com', 'binance.us'] },
    { name: 'Kraken', domains: ['kraken.com'] },
    { name: 'Crypto.com', domains: ['crypto.com'] },

    // Gaming
    { name: 'Steam', domains: ['steampowered.com', 'steamcommunity.com'] },
    { name: 'Epic Games', domains: ['epicgames.com', 'fortnite.com'] },
    { name: 'PlayStation', domains: ['playstation.com', 'sonyentertainmentnetwork.com'] },
    { name: 'Nintendo', domains: ['nintendo.com', 'nintendo.co.jp'] },
    { name: 'Roblox', domains: ['roblox.com'] },
    { name: 'Blizzard', domains: ['blizzard.com', 'battle.net'] },
    { name: 'EA', domains: ['ea.com', 'origin.com'] },

    // Developer/Tech
    { name: 'GitHub', domains: ['github.com', 'githubusercontent.com'] },
    { name: 'GitLab', domains: ['gitlab.com'] },
    { name: 'Bitbucket', domains: ['bitbucket.org'] },
    { name: 'Stack Overflow', domains: ['stackoverflow.com', 'stackexchange.com'] },
    { name: 'npm', domains: ['npmjs.com', 'npmjs.org'] },
    { name: 'PyPI', domains: ['pypi.org', 'pypi.python.org'] },
    { name: 'Docker', domains: ['docker.com', 'docker.io'] },
    { name: 'DigitalOcean', domains: ['digitalocean.com'] },
    { name: 'Cloudflare', domains: ['cloudflare.com'] },
    { name: 'Heroku', domains: ['heroku.com', 'herokuapp.com'] },
    { name: 'Vercel', domains: ['vercel.com', 'vercel.app'] },
    { name: 'Netlify', domains: ['netlify.com', 'netlify.app'] },

    // Government
    { name: 'IRS', domains: ['irs.gov'] },
    { name: 'SSA', domains: ['ssa.gov'] },
    { name: 'HMRC', domains: ['gov.uk'] },
    { name: 'CRA', domains: ['canada.ca'] },
    { name: 'ATO', domains: ['ato.gov.au'] },
  ];

  // Build reverse lookup map for faster domain checking
  const DOMAIN_TO_BRAND = new Map();
  for (const brand of PROTECTED_BRANDS) {
    for (const domain of brand.domains) {
      DOMAIN_TO_BRAND.set(domain.toLowerCase(), brand.name);
    }
  }

  // Whitelist of legitimate domains that should never trigger phishing alerts
  // These are popular developer/tech sites that might have names similar to brands
  const LEGITIMATE_DOMAINS = new Set([
    'codesandbox.io',
    'codepen.io',
    'jsfiddle.net',
    'replit.com',
    'stackblitz.com',
    'glitch.com',
    'codespace.com',
    'gitpod.io',
    'sandbox.google.com',
    'developers.google.com',
    'developer.mozilla.org',
    'developer.apple.com',
    'developer.android.com',
    'dev.to',
    'hashnode.dev',
    'medium.com',
    'substack.com',
    'notion.so',
    'figma.com',
    'canva.com',
    'airtable.com',
    'webflow.io',
    'vercel.app',
    'netlify.app',
    'herokuapp.com',
    'pages.dev',
    'workers.dev',
    'firebaseapp.com',
    'web.app',
    'appspot.com',
    'azurewebsites.net',
    'cloudfront.net',
    'amazonaws.com'
  ]);

  // Build brand name to domains map
  const BRAND_DOMAINS = new Map();
  for (const brand of PROTECTED_BRANDS) {
    BRAND_DOMAINS.set(brand.name, brand.domains.map(d => d.toLowerCase()));
  }

  // Known private suffixes where tenant boundary is one label before the suffix.
  const PRIVATE_SUFFIXES = new Set([
    'herokuapp.com',
    'cloudfront.net',
    'pages.dev',
    'workers.dev',
    'vercel.app',
    'netlify.app',
    'appspot.com',
    'firebaseapp.com',
    'web.app',
    'azurewebsites.net',
    'amazonaws.com',
    'github.io'
  ]);

  // Common SLD labels used under ccTLDs (heuristic PSL-style handling).
  const COMMON_CCTLD_SLD = new Set([
    'ac', 'co', 'com', 'edu', 'gov', 'mil', 'net', 'org', 'nom',
    'or', 'ne', 'go', 'gr', 'gen', 'gob', 'id', 'asn', 'sch'
  ]);

  const ASCII_LABEL_RE = /^[a-z0-9-]+$/;
  const UNICODE_LABEL_RE = /^[\p{L}\p{N}-]+$/u;

  // ============================================
  // NORMALIZATION FUNCTIONS
  // ============================================

  /**
   * Normalize a domain by replacing homoglyphs with standard ASCII characters
   * @param {string} domain - The domain to normalize
   * @returns {string} Normalized domain
   */
  function normalizeDomain(domain) {
    if (!domain || typeof domain !== 'string') return '';

    let normalized = domain.toLowerCase();

    // First pass: replace multi-character sequences
    for (const [pattern, replacements] of Object.entries(MULTI_CHAR_MAP)) {
      if (normalized.includes(pattern)) {
        // Use the first replacement as the canonical form
        normalized = normalized.split(pattern).join(replacements[0]);
      }
    }

    // Second pass: replace single characters
    let result = '';
    for (const char of normalized) {
      if (HOMOGRAPH_MAP[char]) {
        // Use the first replacement as the canonical form
        result += HOMOGRAPH_MAP[char][0].toLowerCase();
      } else {
        result += char;
      }
    }

    // Remove hyphens for comparison (amaz-on → amazon)
    const withoutHyphens = result.replace(/-/g, '');

    return withoutHyphens;
  }

  /**
   * Normalize and validate hostname input.
   * Accepts plain hostnames, URL-like strings, and host:port forms.
   * @param {string} input - User/domain input
   * @returns {string} Normalized hostname or empty string if invalid
   */
  function sanitizeHostname(input) {
    if (!input || typeof input !== 'string') return '';

    let value = input.trim();
    if (!value) return '';

    // Normalize alternate Unicode dot forms to ASCII dot.
    value = value.replace(/[\u3002\uFF0E\uFF61]/g, '.');

    if (value.includes('://')) {
      try {
        value = new URL(value).hostname || '';
      } catch (error) {
        return '';
      }
    } else {
      value = value.split(/[/?#]/, 1)[0];
      const atIndex = value.lastIndexOf('@');
      if (atIndex !== -1) {
        value = value.slice(atIndex + 1);
      }
    }

    value = value.toLowerCase().replace(/\.+$/, '');
    if (!value) return '';

    const colonCount = (value.match(/:/g) || []).length;
    if (colonCount > 1) {
      // IPv6 literals / malformed host: not a registrable hostname.
      return '';
    }

    if (colonCount === 1) {
      const portSeparator = value.lastIndexOf(':');
      const portPart = value.slice(portSeparator + 1);
      if (!/^\d+$/.test(portPart)) return '';
      value = value.slice(0, portSeparator);
    }

    value = value
      .replace(/^\.+/, '')
      .replace(/\.+$/, '')
      .replace(/\.{2,}/g, '.');

    if (!value) return '';
    if (value.length > 253) return '';
    if (value.includes('[') || value.includes(']')) return '';

    const labels = value.split('.');
    for (const label of labels) {
      if (!label || label.length > 63) return '';
      if (label.startsWith('-') || label.endsWith('-')) return '';

      if (ASCII_LABEL_RE.test(label)) continue;
      if (!UNICODE_LABEL_RE.test(label)) return '';
    }

    return value;
  }

  function isIPv4Address(hostname) {
    if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return false;

    const octets = hostname.split('.').map(Number);
    return octets.length === 4 && octets.every((octet) => octet >= 0 && octet <= 255);
  }

  function isPrivateOrLocalIPv4(hostname) {
    if (!isIPv4Address(hostname)) return false;

    const [a, b] = hostname.split('.').map(Number);

    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true; // Link-local
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // Carrier-grade NAT

    return false;
  }

  function hasSuffix(parts, suffixParts) {
    if (parts.length < suffixParts.length) return false;

    for (let i = 0; i < suffixParts.length; i++) {
      if (parts[parts.length - suffixParts.length + i] !== suffixParts[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Extract the registrable domain (eTLD+1) from a full domain
   * Heuristic PSL-aware extraction with private suffix support.
   * @param {string} domain - Full domain name
   * @returns {string} Registrable domain
   */
  function getRegistrableDomain(domain) {
    const hostname = sanitizeHostname(domain);
    if (!hostname) return '';

    const parts = hostname.split('.');
    if (parts.length < 2) return hostname;

    // Known private suffix handling (tenant.example.private-suffix)
    for (const privateSuffix of PRIVATE_SUFFIXES) {
      const suffixParts = privateSuffix.split('.');
      if (hasSuffix(parts, suffixParts)) {
        if (parts.length > suffixParts.length) {
          return parts.slice(-(suffixParts.length + 1)).join('.');
        }
        return hostname;
      }
    }

    // Generic ccTLD 2-level public suffix heuristic (e.g., *.co.uk).
    const tld = parts[parts.length - 1];
    const sld = parts[parts.length - 2];
    const likelyTwoLevelCcTld = tld.length === 2 && COMMON_CCTLD_SLD.has(sld) && parts.length >= 3;

    if (likelyTwoLevelCcTld) {
      return parts.slice(-3).join('.');
    }

    return parts.slice(-2).join('.');
  }

  // ============================================
  // SIMILARITY CALCULATION
  // ============================================

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1
   * @param {string} str2
   * @returns {number} Edit distance
   */
  function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;

    // Create distance matrix
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    // Initialize first row and column
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    // Fill in the rest
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(
            dp[i - 1][j],     // deletion
            dp[i][j - 1],     // insertion
            dp[i - 1][j - 1]  // substitution
          );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Calculate similarity score between two strings (0-1)
   * @param {string} str1
   * @param {string} str2
   * @returns {number} Similarity score (1 = exact match, 0 = completely different)
   */
  function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    const distance = levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);

    if (maxLength === 0) return 1;

    return 1 - (distance / maxLength);
  }

  /**
   * Check if string contains a brand name (fuzzy matching)
   * @param {string} str - String to check
   * @param {string} brandName - Brand name to look for
   * @returns {boolean}
   */
  function containsBrandName(str, brandName) {
    const normalizedStr = normalizeDomain(str);
    const normalizedBrand = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Check for exact brand name inclusion
    if (normalizedStr.includes(normalizedBrand)) {
      return true;
    }

    // Check for partial match with high similarity
    // Useful for catching "amaz0n" → "amazon"
    const similarity = calculateSimilarity(normalizedStr, normalizedBrand);
    return similarity > 0.85;
  }

  // ============================================
  // PHISHING DETECTION
  // ============================================

  /**
   * Check if a domain is suspicious (potential phishing)
   * @param {string} domain - Domain to check
   * @returns {Object} Detection result
   */
  function checkDomain(domain) {
    if (!domain || typeof domain !== 'string') {
      return {
        isSuspicious: false,
        reason: 'Invalid domain'
      };
    }

    const lowerDomain = sanitizeHostname(domain);
    if (!lowerDomain) {
      return {
        isSuspicious: false,
        reason: 'Invalid domain'
      };
    }

    // Check cache first
    const cachedResult = getCachedResult(lowerDomain);
    if (cachedResult) {
      return cachedResult;
    }

    // Perform actual check
    const result = _checkDomainImpl(domain, lowerDomain);

    // Cache the result
    setCachedResult(lowerDomain, result);

    return result;
  }

  // Implementation of domain checking (without caching)
  function _checkDomainImpl(domain, lowerDomain) {
    if (isIPv4Address(lowerDomain)) {
      if (isPrivateOrLocalIPv4(lowerDomain)) {
        return {
          isSuspicious: false,
          reason: 'Local network address'
        };
      }

      return {
        isSuspicious: true,
        originalDomain: lowerDomain,
        reason: 'Public IP address used directly instead of a domain',
        riskLevel: 'medium'
      };
    }

    const registrableDomain = getRegistrableDomain(lowerDomain);
    if (!registrableDomain) {
      return {
        isSuspicious: false,
        reason: 'Invalid domain'
      };
    }

    const unicodeInfo = decodeDomainFromPunycode(lowerDomain);
    const unicodeRegistrableDomain = unicodeInfo.hasDecodeError
      ? registrableDomain
      : (getRegistrableDomain(unicodeInfo.unicodeDomain) || registrableDomain);

    // 0. Check if this is a whitelisted legitimate domain (developer sites, etc.)
    if (LEGITIMATE_DOMAINS.has(lowerDomain) || LEGITIMATE_DOMAINS.has(registrableDomain)) {
      return {
        isSuspicious: false,
        isLegitimate: true,
        reason: 'Known legitimate domain'
      };
    }

    // Also check if it's a subdomain of a legitimate domain
    for (const legitDomain of LEGITIMATE_DOMAINS) {
      if (lowerDomain.endsWith('.' + legitDomain)) {
        return {
          isSuspicious: false,
          isLegitimate: true,
          reason: 'Subdomain of known legitimate domain'
        };
      }
    }

    // 1. Check if this is an actual protected domain (exact match)
    if (DOMAIN_TO_BRAND.has(lowerDomain) || DOMAIN_TO_BRAND.has(registrableDomain)) {
      return {
        isSuspicious: false,
        isProtected: true,
        brand: DOMAIN_TO_BRAND.get(lowerDomain) || DOMAIN_TO_BRAND.get(registrableDomain),
        reason: 'Legitimate protected domain'
      };
    }

    // 2. Check for subdomain tricks (e.g., amazon.com.evil.com)
    const subdomainTrickResult = checkSubdomainTrick(lowerDomain);
    if (subdomainTrickResult.isSuspicious) {
      return subdomainTrickResult;
    }

    // 3. Normalize the domain and check against protected brands
    const domainWithoutTLD = unicodeRegistrableDomain.split('.')[0];
    const normalizedDomainWithoutTLD = normalizeDomain(domainWithoutTLD);

    let highestSimilarity = 0;
    let matchedBrand = null;
    let matchedDomain = null;

    for (const brand of PROTECTED_BRANDS) {
      for (const protectedDomain of brand.domains) {
        const protectedBase = protectedDomain.split('.')[0];
        const normalizedProtected = normalizeDomain(protectedBase);

        // Calculate similarity ONCE
        const similarity = calculateSimilarity(normalizedDomainWithoutTLD, normalizedProtected);

        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          matchedBrand = brand.name;
          matchedDomain = protectedDomain;
        }

        // Very high similarity (>95%) is definite phishing
        if (similarity > 0.95) {
          return {
            isSuspicious: true,
            matchedBrand: brand.name,
            matchedDomain: protectedDomain,
            similarity,
            originalDomain: domain,
            normalizedDomain: normalizedDomainWithoutTLD,
            reason: `Domain is very similar to ${brand.name} (${Math.round(similarity * 100)}% match)`,
            riskLevel: 'high'
          };
        }

        // Check if brand name appears in domain (e.g., amazon-support.com)
        // Only flag if similarity is in the 60-95% range (not exact match)
        if (similarity > 0.6 && similarity < 1 && containsBrandName(domainWithoutTLD, protectedBase)) {
          return {
            isSuspicious: true,
            matchedBrand: brand.name,
            matchedDomain: protectedDomain,
            similarity,
            originalDomain: domain,
            normalizedDomain: normalizedDomainWithoutTLD,
            reason: `Domain contains "${brand.name}" but is not official`,
            riskLevel: similarity > 0.8 ? 'high' : 'medium'
          };
        }
      }
    }

    // 4. If similarity is high but not exact match, flag as suspicious
    if (highestSimilarity > 0.75 && highestSimilarity < 1) {
      return {
        isSuspicious: true,
        matchedBrand,
        matchedDomain,
        similarity: highestSimilarity,
        originalDomain: domain,
        normalizedDomain: normalizedDomainWithoutTLD,
        reason: `Domain is similar to ${matchedBrand} (${Math.round(highestSimilarity * 100)}% match)`,
        riskLevel: highestSimilarity > 0.9 ? 'high' : (highestSimilarity > 0.8 ? 'medium' : 'low')
      };
    }

    // 5. Check for IDN homograph attack (mixed scripts)
    const idnResult = checkIDNHomograph(lowerDomain);
    if (idnResult.isSuspicious) {
      return idnResult;
    }

    return {
      isSuspicious: false,
      originalDomain: domain,
      normalizedDomain: normalizedDomainWithoutTLD,
      reason: 'Domain appears legitimate'
    };
  }

  /**
   * Check for subdomain tricks (e.g., amazon.com.evil.com)
   * @param {string} domain - Full domain to check
   * @returns {Object} Detection result
   */
  function checkSubdomainTrick(domain) {
    const normalizedDomain = sanitizeHostname(domain);
    if (!normalizedDomain) {
      return { isSuspicious: false };
    }

    // Check if any protected domain appears as a subdomain
    for (const brand of PROTECTED_BRANDS) {
      for (const protectedDomain of brand.domains) {
        // Check for patterns like: amazon.com.evil.com or amazon-com.evil.com
        const escapedDomain = protectedDomain.replace(/\./g, '[\\.\\-]');
        const pattern = new RegExp(`(^|\\.)${escapedDomain}[\\.\\-]`, 'i');

        if (pattern.test(normalizedDomain) && !normalizedDomain.endsWith(protectedDomain)) {
          return {
            isSuspicious: true,
            matchedBrand: brand.name,
            matchedDomain: protectedDomain,
            similarity: 0.95,
            originalDomain: normalizedDomain,
            reason: `Subdomain trick: "${protectedDomain}" appears as subdomain`,
            riskLevel: 'high'
          };
        }

        // Also check for: secure-amazon.evil.com
        const brandBase = protectedDomain.split('.')[0];
        if (normalizedDomain.includes(brandBase) && !normalizedDomain.endsWith(protectedDomain)) {
          const registrable = getRegistrableDomain(normalizedDomain);
          if (!brand.domains.some(d => d === registrable)) {
            // Brand name appears in subdomain but registrable domain is different
            const parts = normalizedDomain.split('.');
            const subdomainPart = parts.slice(0, -2).join('.');

            if (subdomainPart.includes(brandBase)) {
              return {
                isSuspicious: true,
                matchedBrand: brand.name,
                matchedDomain: protectedDomain,
                similarity: 0.85,
                originalDomain: normalizedDomain,
                reason: `"${brand.name}" appears in subdomain of unrelated domain`,
                riskLevel: 'high'
              };
            }
          }
        }
      }
    }

    return { isSuspicious: false };
  }

  // Minimal per-label RFC3492 decoder for xn-- labels.
  const PUNYCODE_BASE = 36;
  const PUNYCODE_TMIN = 1;
  const PUNYCODE_TMAX = 26;
  const PUNYCODE_SKEW = 38;
  const PUNYCODE_DAMP = 700;
  const PUNYCODE_INITIAL_BIAS = 72;
  const PUNYCODE_INITIAL_N = 128;

  function punycodeDigit(codePoint) {
    if (codePoint >= 0x30 && codePoint <= 0x39) return codePoint - 22; // 0-9 => 26-35
    if (codePoint >= 0x41 && codePoint <= 0x5A) return codePoint - 0x41; // A-Z => 0-25
    if (codePoint >= 0x61 && codePoint <= 0x7A) return codePoint - 0x61; // a-z => 0-25
    return PUNYCODE_BASE;
  }

  function punycodeAdapt(delta, numPoints, firstTime) {
    delta = firstTime ? Math.floor(delta / PUNYCODE_DAMP) : Math.floor(delta / 2);
    delta += Math.floor(delta / numPoints);

    let k = 0;
    const threshold = Math.floor(((PUNYCODE_BASE - PUNYCODE_TMIN) * PUNYCODE_TMAX) / 2);
    while (delta > threshold) {
      delta = Math.floor(delta / (PUNYCODE_BASE - PUNYCODE_TMIN));
      k += PUNYCODE_BASE;
    }

    return k + Math.floor(((PUNYCODE_BASE - PUNYCODE_TMIN + 1) * delta) / (delta + PUNYCODE_SKEW));
  }

  function decodePunycodeLabel(label) {
    if (!label.startsWith('xn--')) return label;

    const input = label.slice(4).toLowerCase();
    if (!input) return null;

    const output = [];
    let n = PUNYCODE_INITIAL_N;
    let i = 0;
    let bias = PUNYCODE_INITIAL_BIAS;

    const delimiter = input.lastIndexOf('-');
    if (delimiter > -1) {
      for (let j = 0; j < delimiter; j++) {
        const codePoint = input.charCodeAt(j);
        if (codePoint > 0x7F) return null;
        output.push(input[j]);
      }
    }

    let inputIndex = delimiter > -1 ? delimiter + 1 : 0;

    while (inputIndex < input.length) {
      const oldI = i;
      let w = 1;

      for (let k = PUNYCODE_BASE; ; k += PUNYCODE_BASE) {
        if (inputIndex >= input.length) return null;

        const digit = punycodeDigit(input.charCodeAt(inputIndex++));
        if (digit >= PUNYCODE_BASE) return null;

        i += digit * w;
        const t = k <= bias
          ? PUNYCODE_TMIN
          : (k >= bias + PUNYCODE_TMAX ? PUNYCODE_TMAX : k - bias);

        if (digit < t) break;

        w *= (PUNYCODE_BASE - t);
        if (!Number.isFinite(w) || w > Number.MAX_SAFE_INTEGER) return null;
      }

      const outputLength = output.length + 1;
      bias = punycodeAdapt(i - oldI, outputLength, oldI === 0);
      n += Math.floor(i / outputLength);
      i %= outputLength;

      if (n > 0x10FFFF) return null;

      let nextChar;
      try {
        nextChar = String.fromCodePoint(n);
      } catch (error) {
        return null;
      }

      output.splice(i, 0, nextChar);
      i++;
    }

    return output.join('');
  }

  function decodeDomainFromPunycode(domain) {
    const normalizedDomain = sanitizeHostname(domain);
    if (!normalizedDomain) {
      return {
        unicodeDomain: '',
        hasPunycode: false,
        hasDecodeError: false
      };
    }

    const labels = normalizedDomain.split('.');
    let hasPunycode = false;
    let hasDecodeError = false;

    const decodedLabels = labels.map(label => {
      if (!label.startsWith('xn--')) return label;

      hasPunycode = true;
      const decoded = decodePunycodeLabel(label);
      if (decoded === null) {
        hasDecodeError = true;
        return label;
      }
      return decoded.toLowerCase();
    });

    return {
      unicodeDomain: decodedLabels.join('.'),
      hasPunycode,
      hasDecodeError
    };
  }

  function getScriptBucket(char) {
    if (!char || char === '.' || char === '-' || !/\p{L}/u.test(char)) {
      return '';
    }

    if (/\p{Script=Latin}/u.test(char)) return 'latin';
    if (/\p{Script=Cyrillic}/u.test(char)) return 'cyrillic';
    if (/\p{Script=Greek}/u.test(char)) return 'greek';
    return 'other';
  }

  /**
   * Check for IDN homograph attacks (mixed Unicode scripts)
   * @param {string} domain - Domain to check
   * @returns {Object} Detection result
   */
  function checkIDNHomograph(domain) {
    const normalizedDomain = sanitizeHostname(domain);
    if (!normalizedDomain) {
      return { isSuspicious: false };
    }

    const punycodeInfo = decodeDomainFromPunycode(normalizedDomain);
    if (punycodeInfo.hasDecodeError) {
      return {
        isSuspicious: true,
        originalDomain: normalizedDomain,
        reason: 'Domain uses unreadable Punycode',
        riskLevel: 'high'
      };
    }

    const unicodeDomain = punycodeInfo.unicodeDomain || normalizedDomain;
    const hasUnicodeChars = /[^\x00-\x7F]/.test(unicodeDomain);
    const isIDN = punycodeInfo.hasPunycode || hasUnicodeChars;

    const unicodeRegistrable = getRegistrableDomain(unicodeDomain) || unicodeDomain;
    const unicodeBase = unicodeRegistrable.split('.')[0] || '';
    const normalizedUnicodeBase = normalizeDomain(unicodeBase);

    // Brand similarity checks should run against decoded Unicode labels, not raw xn--.
    if (isIDN && normalizedUnicodeBase) {
      for (const brand of PROTECTED_BRANDS) {
        for (const protectedDomain of brand.domains) {
          const protectedBase = protectedDomain.split('.')[0];
          const similarity = calculateSimilarity(normalizedUnicodeBase, normalizeDomain(protectedBase));

          if (similarity > 0.7) {
            return {
              isSuspicious: true,
              originalDomain: normalizedDomain,
              normalizedDomain: normalizedUnicodeBase,
              reason: `Internationalized domain imitates ${brand.name}`,
              riskLevel: 'high'
            };
          }
        }
      }
    }

    const homoglyphChars = [];
    const seenHomoglyphChars = new Set();
    const scriptBuckets = new Set();

    for (const char of unicodeDomain) {
      const script = getScriptBucket(char);
      if (script) {
        scriptBuckets.add(script);
      }

      const codePoint = char.codePointAt(0);
      if (codePoint > 0x7F && HOMOGRAPH_MAP[char] && !seenHomoglyphChars.has(char)) {
        seenHomoglyphChars.add(char);
        homoglyphChars.push(char);
      }
    }

    if (homoglyphChars.length > 0) {
      return {
        isSuspicious: true,
        originalDomain: normalizedDomain,
        normalizedDomain: normalizeDomain(unicodeDomain),
        reason: `Domain contains lookalike characters (${homoglyphChars.join(', ')})`,
        riskLevel: 'high'
      };
    }

    const hasMixedScripts = scriptBuckets.has('latin') &&
      (scriptBuckets.has('cyrillic') || scriptBuckets.has('greek') || scriptBuckets.has('other'));

    if (hasMixedScripts) {
      return {
        isSuspicious: true,
        originalDomain: normalizedDomain,
        reason: 'Domain mixes different character scripts (potential homograph attack)',
        riskLevel: 'high'
      };
    }

    return { isSuspicious: false };
  }

  /**
   * Get all protected brands
   * @returns {Array} List of protected brands
   */
  function getProtectedBrands() {
    return PROTECTED_BRANDS.map(brand => ({
      name: brand.name,
      domains: [...brand.domains]
    }));
  }

  /**
   * Add a custom brand to protect
   * @param {string} name - Brand name
   * @param {Array<string>} domains - List of legitimate domains
   * @returns {boolean} Success
   */
  function addProtectedBrand(name, domains) {
    if (!name || !domains || !Array.isArray(domains) || domains.length === 0) {
      return false;
    }

    // Check if brand already exists
    const existingIndex = PROTECTED_BRANDS.findIndex(b => b.name.toLowerCase() === name.toLowerCase());

    if (existingIndex >= 0) {
      // Merge domains
      const existing = PROTECTED_BRANDS[existingIndex];
      const newDomains = domains.filter(d => !existing.domains.includes(d.toLowerCase()));
      existing.domains.push(...newDomains.map(d => d.toLowerCase()));

      // Update lookup maps
      for (const domain of newDomains) {
        DOMAIN_TO_BRAND.set(domain.toLowerCase(), existing.name);
      }
      BRAND_DOMAINS.set(existing.name, existing.domains);
    } else {
      // Add new brand
      const brand = {
        name,
        domains: domains.map(d => d.toLowerCase())
      };
      PROTECTED_BRANDS.push(brand);

      // Update lookup maps
      for (const domain of brand.domains) {
        DOMAIN_TO_BRAND.set(domain, brand.name);
      }
      BRAND_DOMAINS.set(brand.name, brand.domains);
    }

    return true;
  }

  /**
   * Remove a brand from protection
   * @param {string} name - Brand name to remove
   * @returns {boolean} Success
   */
  function removeProtectedBrand(name) {
    const index = PROTECTED_BRANDS.findIndex(b => b.name.toLowerCase() === name.toLowerCase());
    if (index === -1) return false;

    const brand = PROTECTED_BRANDS[index];

    // Remove from lookup maps
    for (const domain of brand.domains) {
      DOMAIN_TO_BRAND.delete(domain.toLowerCase());
    }
    BRAND_DOMAINS.delete(brand.name);

    // Remove from array
    PROTECTED_BRANDS.splice(index, 1);

    return true;
  }

  // ============================================
  // PHISHING STATS
  // ============================================
  let phishingStats = {
    totalDetected: 0,
    detections: [], // Last 100 detections
    byBrand: {} // Count per brand
  };

  /**
   * Record a phishing detection
   * @param {Object} detection - Detection result from checkDomain
   */
  function recordDetection(detection) {
    if (!detection || !detection.isSuspicious) return;

    phishingStats.totalDetected++;

    // Track by brand
    if (detection.matchedBrand) {
      phishingStats.byBrand[detection.matchedBrand] = (phishingStats.byBrand[detection.matchedBrand] || 0) + 1;
    }

    // Keep last 100 detections
    phishingStats.detections.push({
      domain: detection.originalDomain,
      matchedBrand: detection.matchedBrand,
      similarity: detection.similarity,
      reason: detection.reason,
      riskLevel: detection.riskLevel,
      timestamp: Date.now()
    });

    if (phishingStats.detections.length > 100) {
      phishingStats.detections.shift();
    }
  }

  /**
   * Get phishing statistics
   * @returns {Object} Phishing stats
   */
  function getPhishingStats() {
    return {
      totalDetected: phishingStats.totalDetected,
      recentDetections: phishingStats.detections.slice(-10),
      topTargetedBrands: Object.entries(phishingStats.byBrand)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([brand, count]) => ({ brand, count }))
    };
  }

  /**
   * Reset phishing statistics
   */
  function resetPhishingStats() {
    phishingStats = {
      totalDetected: 0,
      detections: [],
      byBrand: {}
    };
  }

  // ============================================
  // EXPOSE API
  // ============================================
  self.WebSuddhi.phishingDetector = {
    // Main detection function
    checkDomain,

    // Normalization
    normalizeDomain,

    // Similarity calculation
    calculateSimilarity,

    // Subdomain trick detection
    checkSubdomainTrick,

    // IDN homograph detection
    checkIDNHomograph,

    // Brand management
    PROTECTED_BRANDS,
    getProtectedBrands,
    addProtectedBrand,
    removeProtectedBrand,

    // Statistics
    recordDetection,
    getPhishingStats,
    resetPhishingStats,

    // Cache management
    clearPhishingCache,

    // Utilities
    getRegistrableDomain,
    levenshteinDistance
  };

  log('Phishing detector loaded with', PROTECTED_BRANDS.length, 'protected brands');
})();
