import http from 'node:http';
import { PNG } from './fixtures.mjs';

export const FIRST_PARTY = 'www.fixture-news.test';
export const FIRST_PARTY_CDN = 'img.fixture-news.test';
// Confirmed present in rules/ad-domains.json:
// ||doubleclick.net, ||googlesyndication.com, ||googletagmanager.com, ||google-analytics.com
export const AD_HOSTS = [
  'securepubads.g.doubleclick.net',
  'pagead2.googlesyndication.com',
  'www.googletagmanager.com',
  'www.google-analytics.com',
];

export const AD_SELECTORS = [
  'ins.adsbygoogle',
  'div[id^="div-gpt-ad"]',
  '.google-ad',
  '.ad-banner',
  '#ad-container',
];

export const FP_IMAGE_COUNT = 7;
const FP_IMAGES = [
  '/img/hero.png',
  '/img/inline-1.png',
  '/img/ad-free-photo.png',
  '/images/banner.png',
  '/img/sponsor-thanks.png',
  `http://${FIRST_PARTY_CDN}/cdn/photo-1.png`,
  `http://${FIRST_PARTY_CDN}/cdn/photo-2.png`,
];

function pageHtml(port) {
  const ad = (h, p) => `http://${h}:${port}${p}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Fixture News</title></head><body>
<h1>Fixture News</h1>
<article>
${FP_IMAGES.map((s, i) => `<img id="fp-${i}" class="fp-img" src="${s}" width="120" height="80" alt="photo ${i}">`).join('\n')}
<p>${'Lorem ipsum dolor sit amet. '.repeat(30)}</p>
</article>
<ins class="adsbygoogle" style="display:block;width:300px;height:250px" data-ad-client="ca-pub-1" data-ad-slot="1"></ins>
<div id="div-gpt-ad-123-0" style="width:300px;height:250px">ad slot</div>
<div class="google-ad" style="width:300px;height:100px">ad</div>
<div class="ad-banner" style="width:728px;height:90px">ad</div>
<div id="ad-container" style="width:300px;height:100px">ad</div>
<img id="ad-img-1" src="${ad('securepubads.g.doubleclick.net', '/pixel.png')}" width="50" height="50">
<img id="ad-img-2" src="${ad('pagead2.googlesyndication.com', '/banner.png')}" width="50" height="50">
<script src="${ad('www.googletagmanager.com', '/gtm.js')}"></script>
<script src="${ad('pagead2.googlesyndication.com', '/pagead/js/adsbygoogle.js')}"></script>
<script>fetch(${JSON.stringify(ad('www.google-analytics.com', '/collect'))}, {mode:'no-cors'}).catch(()=>{});</script>
</body></html>`;
}

export function startFixtureServer() {
  const hits = [];
  const server = http.createServer((req, res) => {
    const host = (req.headers.host || '').split(':')[0];
    hits.push(`${host}${req.url}`);
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(pageHtml(server.address().port));
    }
    if (req.url.endsWith('.png')) {
      res.writeHead(200, { 'content-type': 'image/png', 'access-control-allow-origin': '*' });
      return res.end(PNG);
    }
    res.writeHead(200, { 'content-type': 'application/javascript', 'access-control-allow-origin': '*' });
    res.end('/* stub */');
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, port: server.address().port, hits, close: () => new Promise((r) => server.close(r)) })
    )
  );
}
