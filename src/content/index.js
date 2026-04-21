// WebSuddhi - Content Scripts Entry Point
// Consolidates all content scripts into a single entry point
// This file is bundled and loaded as a single script

// Import production content scripts from project root.
import '../../shared/utils.js';

// Import content modules
import '../../content/ad-blocker.js';
import '../../content/cookie-consent.js';
import '../../content/annoyance-blocker.js';

console.log('[WebSuddhi] Content scripts loaded');
