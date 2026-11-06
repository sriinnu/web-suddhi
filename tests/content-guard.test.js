// Paywall removal and ad hiding must take the clutter away and leave the
// article readable.
//
// Regression (axios.com, Nov 2026): Tailwind puts child-styling rules in the
// class attribute, e.g. `[&_#paywall-fallback-container]:relative`. Matching
// "paywall" anywhere in the class string hid the whole article body.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadContentScript, createContentApi } from './helpers/content-harness.js';

const PARAS = Array.from({ length: 4 }, (_, i) =>
  `<p>Paragraph ${i + 1} of the story, long enough to read as real article text and not as a short label in a dialog.</p>`
).join('');

const removed = (el) => el.hasAttribute('data-websuddhi-removed');
const waitForPaywallPass = () => new Promise((r) => setTimeout(r, 1300));

describe('paywall removal', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps an article whose utility classes mention paywall elements', async () => {
    const { api } = createContentApi();
    loadContentScript(api, `<!doctype html><html><body>
      <div id="story" class="col-1-13 [&_p]:my-4 [&_#piano-wall:has(#piano-container[data-piano-active])~.gated-content]:hidden [&_#paywall-fallback-container]:relative">${PARAS}</div>
    </body></html>`);
    await waitForPaywallPass();

    const story = document.getElementById('story');
    expect(removed(story)).toBe(false);
    expect(story.style.display).not.toBe('none');
  });

  it('reads class names, not child-styling tokens, even without article text', async () => {
    const { api } = createContentApi();
    loadContentScript(api, `<!doctype html><html><body>
      <div id="byline" class="flex [&_.paywall-note]:hidden [&_#piano-wall]:relative">By A. Reporter</div>
    </body></html>`);
    await waitForPaywallPass();

    expect(removed(document.getElementById('byline'))).toBe(false);
  });

  it('still removes a real paywall overlay', async () => {
    const { api } = createContentApi();
    loadContentScript(api, `<!doctype html><html><body>
      <article>${PARAS}</article>
      <div id="wall" class="paywall-overlay">Subscribe to continue reading</div>
    </body></html>`);
    await waitForPaywallPass();

    expect(removed(document.getElementById('wall'))).toBe(true);
  });

  it('never hides a paywall-classed wrapper that holds the article text', async () => {
    const { api } = createContentApi();
    loadContentScript(api, `<!doctype html><html><body>
      <div id="wrap" class="article-paywall">${PARAS}</div>
    </body></html>`);
    await waitForPaywallPass();

    expect(removed(document.getElementById('wrap'))).toBe(false);
  });

  it('reveals the article a soft paywall hid with CSS', async () => {
    const { api } = createContentApi();
    loadContentScript(api, `<!doctype html><html><head>
      <style>.gated-content { display: none; }</style>
    </head><body>
      <div id="piano-wall"><div class="tp-modal">Subscribe to keep reading</div></div>
      <div id="gated" class="gated-content">${PARAS}</div>
    </body></html>`);
    await waitForPaywallPass();

    expect(window.getComputedStyle(document.getElementById('gated')).display).not.toBe('none');
  });
});

describe('ad hiding', () => {
  const blocked = (el) => el.hasAttribute('data-websuddhi-blocked');

  it('keeps an article whose utility classes style an ad slot inside it', async () => {
    const { api } = createContentApi();
    loadContentScript(api, `<!doctype html><html><body>
      <div id="story" class="col-1-13 [&_.advertisement]:my-6 [&_.ad-slot]:min-h-[250px]">${PARAS}</div>
      <div id="ad" class="advertisement">Advertisement</div>
    </body></html>`, {
      // jsdom has no layout; treat everything as on screen.
      beforeCore: (win) => { win.WebSuddhi.utils.isVisible = () => true; }
    });
    await waitForPaywallPass();

    expect(blocked(document.getElementById('ad'))).toBe(true);
    expect(blocked(document.getElementById('story'))).toBe(false);
  });
});
