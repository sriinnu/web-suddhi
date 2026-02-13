// WebSuddhi - Content Scripts Entry Point
// Consolidates all content scripts into a single entry point
// This file is bundled and loaded as a single script

// Import shared utilities (already loaded via manifest, this ensures access)
import '../shared/utils.js';

// Import content modules
import './ad-blocker.js';
import './cookie-consent.js';
import './annoyance-blocker.js';

console.log('[WebSuddhi] Content scripts loaded');
