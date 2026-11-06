import { describe, it, expect, beforeEach } from 'vitest';

let cl;
beforeEach(async () => {
  globalThis.self = globalThis;
  delete globalThis.WebSuddhi;
  delete globalThis.chrome;
  await import('../background/connection-log.js?t=' + Math.random());
  cl = globalThis.WebSuddhi.connectionLog;
  cl.clearAll();
});

const main = (extra = {}) => ({
  tabId: 1, type: 'main_frame', url: 'https://www.site.com/', ip: '1.1.1.1',
  responseHeaders: [{ name: 'Server', value: 'nginx' }, { name: 'strict-transport-security', value: 'max-age=1' }],
  ...extra
});
const res = (url, type, extra = {}) => ({ tabId: 1, type, url, ...extra });

describe('type mapping', () => {
  it('maps resource types', () => {
    const m = cl.mapType;
    expect([m('script'), m('sub_frame'), m('xmlhttprequest'), m('fetch'), m('websocket')])
      .toEqual(['script', 'frame', 'xhr', 'xhr', 'xhr']);
    expect([m('image'), m('imageset'), m('stylesheet'), m('media'), m('font'), m('ping')])
      .toEqual(['image', 'image', 'css', 'media', 'font', 'other']);
  });
});

describe('recording', () => {
  it('captures main frame ip, server and hsts', () => {
    cl.onBeforeRequest(main());
    cl.onResponse(main());
    const c = cl.getConnections(1);
    expect(c).toMatchObject({ mainHost: 'www.site.com', mainIp: '1.1.1.1', server: 'nginx', hsts: true, cert: null });
  });
  it('hsts false and server null without headers', () => {
    cl.onBeforeRequest(main());
    cl.onResponse(main({ responseHeaders: [] }));
    expect(cl.getConnections(1)).toMatchObject({ server: null, hsts: false });
  });
  it('flags first party by site, counts types, caps ips at 3, sorts by count', () => {
    cl.onBeforeRequest(main());
    cl.onResponse(main());
    cl.onResponse(res('https://static.site.com/a.js', 'script', { ip: '2.2.2.2' }));
    for (let i = 0; i < 4; i++) cl.onResponse(res('https://cdn.other.net/i' + i, 'image', { ip: '9.9.9.' + i }));
    const hosts = cl.getConnections(1).hosts;
    expect(hosts[0].host).toBe('cdn.other.net');
    expect(hosts[0]).toMatchObject({ firstParty: false, count: 4 });
    expect(hosts[0].types.image).toBe(4);
    expect(hosts[0].ips).toHaveLength(3);
    const st = hosts.find((h) => h.host === 'static.site.com');
    expect(st.firstParty).toBe(true);
    expect(st.types.script).toBe(1);
  });
  it('treats co.uk style suffixes as one site', () => {
    expect(cl.siteOf('a.b.example.co.uk')).toBe('example.co.uk');
    expect(cl.siteOf('x.example.com')).toBe('example.com');
  });
  it('counts blocked requests from errors', () => {
    cl.onBeforeRequest(main());
    cl.onError(res('https://ads.net/x.js', 'script', { error: 'net::ERR_BLOCKED_BY_CLIENT' }));
    cl.onError(res('https://ads.net/y.js', 'script', { error: 'net::ERR_CONNECTION_RESET' }));
    const h = cl.getConnections(1).hosts[0];
    expect(h).toMatchObject({ host: 'ads.net', count: 2, blocked: 1 });
  });
  it('resets on a new main_frame request and ignores tabId -1', () => {
    cl.onBeforeRequest(main());
    cl.onResponse(res('https://a.com/x', 'image'));
    cl.onResponse(res('https://a.com/x', 'image', { tabId: -1 }));
    expect(cl.getConnections(1).hosts).toHaveLength(1);
    cl.onBeforeRequest(main({ url: 'https://other.org/' }));
    const c = cl.getConnections(1);
    expect(c.hosts).toEqual([]);
    expect(c.mainHost).toBe('other.org');
  });
  it('caps hosts per tab at 300', () => {
    cl.onBeforeRequest(main());
    for (let i = 0; i < 350; i++) cl.onResponse(res('https://h' + i + '.com/', 'image'));
    expect(cl.getConnections(1).hosts).toHaveLength(300);
  });
  it('removeTab and missing tab give empty hosts', () => {
    cl.onBeforeRequest(main());
    cl.removeTab(1);
    expect(cl.getConnections(1).hosts).toEqual([]);
    expect(cl.getConnections(99)).toEqual({ mainHost: '', mainIp: null, server: null, hsts: false, cert: null, hosts: [] });
  });
});

describe('firefox cert', () => {
  it('reads security info and never throws', async () => {
    const wr = {
      getSecurityInfo: async () => ({
        state: 'secure', protocolVersion: 'TLSv1.3', cipherSuite: 'TLS_AES_128',
        certificates: [{ subject: 'CN=site.com', issuer: 'CN=CA', validity: { start: 1, end: 2 } }]
      })
    };
    expect(await cl.readCert({ requestId: '1' }, wr)).toEqual({
      subject: 'CN=site.com', issuer: 'CN=CA', validFrom: 1, validTo: 2,
      protocolVersion: 'TLSv1.3', cipherSuite: 'TLS_AES_128', state: 'secure'
    });
    expect(await cl.readCert({}, { getSecurityInfo: async () => { throw new Error('x'); } })).toBe(null);
    expect(await cl.readCert({}, {})).toBe(null);
    cl.setCert(1, { subject: 's' });
    expect(cl.getConnections(1).cert).toEqual({ subject: 's' });
  });
});
