// Edit freely. Used only by live.spec.mjs (E2E_LIVE=1).
export const SITES = [
  { name: 'BBC News', category: 'news', url: 'https://www.bbc.com/news' },
  { name: 'The Guardian', category: 'news', url: 'https://www.theguardian.com/international' },
  { name: 'CNN', category: 'news', url: 'https://edition.cnn.com/' },
  { name: 'Forbes', category: 'news', url: 'https://www.forbes.com/' },
  { name: 'AllRecipes', category: 'recipe', url: 'https://www.allrecipes.com/' },
  { name: 'Serious Eats', category: 'recipe', url: 'https://www.seriouseats.com/' },
  { name: 'YouTube', category: 'video', url: 'https://www.youtube.com/' },
  { name: 'Medium', category: 'blog', url: 'https://medium.com/' },
  { name: 'Dev.to', category: 'blog', url: 'https://dev.to/' },
  { name: 'Wikipedia', category: 'baseline', url: 'https://en.wikipedia.org/wiki/Main_Page' },
  { name: 'Amazon', category: 'shop', url: 'https://www.amazon.com/' },
  { name: 'eBay', category: 'shop', url: 'https://www.ebay.com/' },
];

// Per-site navigation budget (ms) and post-load settle time (ms, includes a scroll to trigger lazy images).
export const NAV_TIMEOUT = 30000;
export const SETTLE_MS = 5000;
