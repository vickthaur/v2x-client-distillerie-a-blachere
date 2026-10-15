#!/usr/bin/env node
// Collecte par page et par appareil (téléphone 390 px, bureau 1440 px) : poids par type de
// ressource (avant et après défilement), moment où three.js est demandé, LCP et son élément,
// décalages de mise en page (CLS) et leurs sources, tâches longues, console, balises SEO,
// données structurées, titres, images sans alt, liens et ancres présents dans le DOM rendu.
//   node scripts/audit/collecte.mjs [--pages accueil,boutique] [--age majeur|aucun] [--test] [--sans-webgl]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';
import { BASE, OUT, PAGES, MOBILE, DESKTOP, ROOT, PERF_INIT, launch, context, scrollThrough, sleep } from './lib.mjs';

const args = process.argv.slice(2);
const only = (args[args.indexOf('--pages') + 1] || '').split(',').filter((x) => args.includes('--pages') && x);
const ageArg = args.includes('--age') ? args[args.indexOf('--age') + 1] : 'majeur';
const AGE = ageArg === 'aucun' ? null : ageArg;
// --test : adresse en « ?test » (mode recette du site : la boucle 3D s'arrête après 20 images
// stables, les apparitions sont immédiates). Avec SwiftShader, sans cela, le rendu continu occupe
// le fil principal pendant des minutes ; les octets et les requêtes sont les mêmes.
const TEST = args.includes('--test');
// --sans-webgl : photos à la place de la 3D (pages sans 3D : mêmes ressources, mesure plus rapide).
const SANS_WEBGL = args.includes('--sans-webgl');
const SUFFIX = `${AGE ? '' : '-sans-age'}${only.length ? `-${only.join('-')}` : ''}${SANS_WEBGL ? '-sans-webgl' : ''}`;
const pages = PAGES.filter(([n]) => !only.length || only.includes(n));

// Taille compressée estimée (Vercel sert en brotli) pour les fichiers texte du build.
const zcache = new Map();
function compressed(url) {
  const path = new URL(url).pathname;
  if (zcache.has(path)) return zcache.get(path);
  let r = null;
  const file = join(ROOT, 'dist', decodeURIComponent(path));
  if (/\.(js|css|svg|json|html)$/.test(path) && existsSync(file)) {
    const buf = readFileSync(file);
    r = { gzip: gzipSync(buf, { level: 9 }).length, br: brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length };
  }
  zcache.set(path, r);
  return r;
}

const kind = (e) => {
  const u = e.name;
  if (/\.(woff2?|ttf|otf)(\?|$)/.test(u)) return 'police';
  if (/\.(js|mjs)(\?|$)/.test(u)) return 'js';
  if (/\.css(\?|$)/.test(u)) return 'css';
  if (/\.(webp|png|jpe?g|gif|avif|svg)(\?|$)/.test(u)) return 'image';
  if (/\.json(\?|$)/.test(u)) return 'json';
  return 'autre';
};

function weigh(entries) {
  const by = {};
  for (const e of entries) {
    const k = kind(e);
    const z = compressed(e.name);
    const raw = e.decodedBodySize || e.encodedBodySize || 0;
    by[k] ||= { n: 0, brut: 0, br: 0 };
    by[k].n += 1;
    by[k].brut += raw;
    by[k].br += z ? z.br : raw;
  }
  const total = Object.values(by).reduce((s, x) => ({ n: s.n + x.n, brut: s.brut + x.brut, br: s.br + x.br }), { n: 0, brut: 0, br: 0 });
  return { parType: by, total };
}

async function extract(page) {
  return page.evaluate(() => {
    const meta = (sel) => document.querySelector(sel)?.getAttribute('content') ?? null;
    const og = {};
    document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach((m) => (og[m.getAttribute('property') || m.getAttribute('name')] = m.getAttribute('content')));
    const jsonld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => {
      try {
        return JSON.parse(s.textContent);
      } catch (e) {
        return { erreur: String(e) };
      }
    });
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      .filter((h) => h.getClientRects().length && !h.closest('[hidden],dialog:not([open]),.mega[hidden]'))
      .map((h) => `${h.tagName.toLowerCase()} ${h.textContent.trim().replace(/\s+/g, ' ').slice(0, 70)}`);
    const visible = (el) => !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
    const imgs = [...document.images].map((i) => ({
      src: i.currentSrc || i.src,
      alt: i.getAttribute('alt'),
      w: i.naturalWidth,
      h: i.naturalHeight,
      rw: Math.round(i.getBoundingClientRect().width),
      rh: Math.round(i.getBoundingClientRect().height),
      lazy: i.loading,
      srcset: !!i.getAttribute('srcset'),
      sizesAttr: i.getAttribute('sizes'),
      wAttr: i.getAttribute('width'),
      hAttr: i.getAttribute('height'),
      visible: visible(i),
      decorative: i.getAttribute('alt') === '' || !!i.closest('[aria-hidden="true"]'),
      inLink: !!i.closest('a'),
    }));
    const links = [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.href, raw: a.getAttribute('href'), text: (a.getAttribute('aria-label') || a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60), target: a.target || '', rel: a.rel || '' }));
    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
    const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
    const main = document.querySelector('main');
    const words = (main?.innerText || '').split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
    const hreflang = [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => [l.hreflang, l.href]);
    return {
      url: location.href,
      lang: document.documentElement.lang,
      title: document.title,
      description: meta('meta[name="description"]'),
      robots: meta('meta[name="robots"]'),
      canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
      themeColor: meta('meta[name="theme-color"]'),
      og,
      jsonld,
      hreflang,
      h1: [...document.querySelectorAll('h1')].filter((h) => h.getClientRects().length).map((h) => h.textContent.trim().replace(/\s+/g, ' ')),
      headings,
      imgs,
      links,
      ids: [...new Set(ids)],
      dupIds: [...new Set(dupIds)],
      words,
      docHeight: document.documentElement.scrollHeight,
      gate: !!document.querySelector('#gate')?.open,
    };
  });
}

const browser = await launch({ webgl: !SANS_WEBGL });
const results = [];
for (const [name, path] of pages) {
  for (const [dev, device] of [
    ['mobile', MOBILE],
    ['bureau', DESKTOP],
  ]) {
    const ctx = await context(browser, { device, age: AGE, panier: name === 'panier' });
    const page = await ctx.newPage();
    await page.addInitScript(PERF_INIT);
    const consoleMsgs = [];
    const failed = [];
    page.on('console', (m) => ['error', 'warning'].includes(m.type()) && consoleMsgs.push(`${m.type()}: ${m.text().slice(0, 300)}`));
    page.on('pageerror', (e) => consoleMsgs.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText} ${r.url()}`));
    page.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
    const t0 = Date.now();
    let status = null;
    try {
      const resp = await page.goto(BASE + path + (TEST ? '?test' : ''), { waitUntil: 'load', timeout: 60000 });
      status = resp?.status() ?? null;
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    } catch (e) {
      consoleMsgs.push(`goto: ${e.message}`);
    }
    await sleep(4000);
    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const paints = Object.fromEntries(performance.getEntriesByType('paint').map((p) => [p.name, Math.round(p.startTime)]));
      const res = performance.getEntriesByType('resource').map((e) => ({ name: e.name, type: e.initiatorType, start: Math.round(e.startTime), end: Math.round(e.responseEnd), encodedBodySize: e.encodedBodySize, decodedBodySize: e.decodedBodySize }));
      return { ttfb: Math.round(nav?.responseStart || 0), dcl: Math.round(nav?.domContentLoadedEventEnd || 0), load: Math.round(nav?.loadEventEnd || 0), html: nav?.decodedBodySize || 0, fcp: paints['first-contentful-paint'] ?? null, res, audit: window.__audit };
    });
    const seo = await extract(page);
    const shot = join(OUT, 'captures', `${name}-${dev}${SANS_WEBGL ? '-sans-webgl' : ''}.png`);
    await page.screenshot({ path: shot }).catch(() => {});
    // Après défilement : images et rendus 3D chargés au fil de la page
    await scrollThrough(page).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await sleep(1500);
    const after = await page.evaluate(() => ({
      res: performance.getEntriesByType('resource').map((e) => ({ name: e.name, type: e.initiatorType, start: Math.round(e.startTime), end: Math.round(e.responseEnd), encodedBodySize: e.encodedBodySize, decodedBodySize: e.decodedBodySize })),
      audit: window.__audit,
      webgl: document.querySelectorAll('canvas').length,
      snapsSession: Object.keys(sessionStorage).filter((k) => k.startsWith('blachere-rendus')).map((k) => [k, sessionStorage.getItem(k).length]),
    }));
    const local = (e) => e.name.startsWith(BASE);
    const initial = timing.res.filter(local);
    const all = after.res.filter(local);
    const three = all.find((e) => /\/assets\/three-/.test(e.name));
    const stage = all.find((e) => /\/assets\/stage-/.test(e.name));
    const lcp = timing.audit.lcp.at(-1) || null;
    const cls = after.audit.cls.reduce((s, x) => s + x.v, 0);
    const clsInitial = timing.audit.cls.reduce((s, x) => s + x.v, 0);
    results.push({
      page: name,
      path,
      appareil: dev,
      webgl: !SANS_WEBGL,
      test: TEST,
      status,
      duree: Date.now() - t0,
      ttfb: timing.ttfb,
      fcp: timing.fcp,
      dcl: timing.dcl,
      load: timing.load,
      htmlOctets: timing.html,
      lcp,
      lcpCandidats: timing.audit.lcp,
      clsInitial: Number(clsInitial.toFixed(4)),
      cls: Number(cls.toFixed(4)),
      clsSources: after.audit.cls.filter((x) => x.v >= 0.001),
      longTasks: { n: after.audit.longtasks.length, total: after.audit.longtasks.reduce((s, x) => s + x.d, 0), max: Math.max(0, ...after.audit.longtasks.map((x) => x.d)), premieres: timing.audit.longtasks.slice(0, 12) },
      poidsInitial: weigh(initial),
      poidsComplet: weigh(all),
      three: three ? { debut: three.start, fin: three.end } : null,
      stage: stage ? { debut: stage.start, fin: stage.end } : null,
      canvas: after.webgl,
      rendusSession: after.snapsSession,
      ressources: all.map((e) => ({ url: e.name.replace(BASE, ''), type: kind(e), debut: e.start, fin: e.end, octets: e.decodedBodySize || e.encodedBodySize })),
      console: consoleMsgs,
      echecs: [...new Set(failed)],
      seo,
      capture: shot,
    });
    console.log(`${name} ${dev} : ${status} · LCP ${lcp?.t ?? '?'} ms (${lcp?.el ?? lcp?.url ?? '?'}) · CLS ${cls.toFixed(3)} · ${Math.round(weigh(all).total.br / 1024)} Kio br · three ${three ? `${three.start} ms` : 'non'} · console ${consoleMsgs.length}`);
    await ctx.close();
  }
}
await browser.close();
const file = join(OUT, `collecte${SUFFIX}.json`);
writeFileSync(file, JSON.stringify(results, null, 1));
console.log(`→ ${file}`);
