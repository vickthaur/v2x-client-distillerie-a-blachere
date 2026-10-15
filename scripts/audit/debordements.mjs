#!/usr/bin/env node
// Débordements à 320, 360, 390, 768, 1024, 1280, 1440, 1920 et 2560 px de large, sur toutes les
// pages (âge vérifié, panier rempli) : défilement horizontal de la page, éléments qui sortent de
// l'écran (hors carrousels prévus pour défiler), textes coupés par un parent « overflow: hidden ».
// Une capture est prise pour chaque cas, centrée sur le premier élément fautif (cadre rouge).
//   node scripts/audit/debordements.mjs [--pages …] [--largeurs 320,360]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, OUT, PAGES, WIDTHS, launch, context, sleep } from './lib.mjs';

const args = process.argv.slice(2);
const only = args.includes('--pages') ? args[args.indexOf('--pages') + 1].split(',') : null;
const widths = args.includes('--largeurs') ? args[args.indexOf('--largeurs') + 1].split(',').map(Number) : WIDTHS;
// --sans-webgl : photos à la place de la 3D (plus rapide) ; les pages 3D sont à revoir avec WebGL.
const SANS_WEBGL = args.includes('--sans-webgl');
const dir = join(OUT, 'debordements');
mkdirSync(dir, { recursive: true });

const browser = await launch({ webgl: !SANS_WEBGL });
const results = [];
for (const w of widths) {
  const h = w < 768 ? 800 : w < 1280 ? 1000 : w >= 2560 ? 1440 : 900;
  const mobile = w < 768;
  const ctx = await context(browser, { device: { viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile }, panier: true });
  const page = await ctx.newPage();
  for (const [name, path] of PAGES.filter(([n]) => !only || only.includes(n))) {
    await page.goto(BASE + path, { waitUntil: 'load' }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await sleep(1800);
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.85) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 40));
      }
      scrollTo(0, 0);
      document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
    });
    await sleep(600);
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const describe = (el) => {
        const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
        return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls ? `.${cls}` : ''}`;
      };
      const scroller = (el) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const s = getComputedStyle(p);
          if (/(auto|scroll)/.test(s.overflowX)) return p;
        }
        return null;
      };
      const clipper = (el) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const s = getComputedStyle(p);
          if (/(hidden|clip)/.test(s.overflowX)) return p;
        }
        return null;
      };
      const hiddenUp = (el) => {
        for (let p = el; p; p = p.parentElement) {
          const s = getComputedStyle(p);
          if (s.visibility === 'hidden' || s.display === 'none' || p.hidden || s.opacity === '0') return true;
          if (p.matches?.('dialog:not([open]), .menu:not(.is-open), .mega[hidden], .v2x, .skip')) return true;
        }
        return false;
      };
      const out = [];
      const clipped = [];
      for (const el of document.querySelectorAll('body *')) {
        if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        if (rect.right > vw + 1 || rect.left < -1) {
          if (scroller(el) || hiddenUp(el)) continue;
          const c = clipper(el);
          const cr = c?.getBoundingClientRect();
          const visibleOut = !c || cr.right > vw + 1 || cr.left < -1;
          if (visibleOut) out.push({ el: describe(el), left: Math.round(rect.left), right: Math.round(rect.right), texte: (el.textContent || '').trim().slice(0, 50) });
        }
        // texte coupé : contenu plus large que la boîte, overflow caché, sans points de suspension
        const s = getComputedStyle(el);
        if (/(hidden|clip)/.test(s.overflowX) && s.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 2 && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !hiddenUp(el) && !el.matches('.sr-only, .sr-only *')) {
          clipped.push({ el: describe(el), largeur: el.clientWidth, contenu: el.scrollWidth, texte: (el.textContent || '').trim().slice(0, 60) });
        }
      }
      // garder seulement les éléments les plus hauts dans l'arbre (un parent qui déborde suffit)
      const top = out.filter((o, i) => i === out.findIndex((x) => x.el === o.el));
      return { vw, scrollWidth: document.documentElement.scrollWidth, bodyScroll: document.body.scrollWidth, debordants: top.slice(0, 15), nDebordants: top.length, coupes: clipped.slice(0, 15), nCoupes: clipped.length };
    });
    const pb = r.scrollWidth > r.vw + 1 || r.nDebordants || r.nCoupes;
    let capture = null;
    if (pb) {
      capture = join(dir, `${name}-${w}${SANS_WEBGL ? '-sans-webgl' : ''}.png`);
      // cadre rouge sur les éléments fautifs, capture centrée sur le premier
      await page.evaluate((items) => {
        let first = null;
        for (const it of items) {
          const [tag, ...rest] = it.el.split(/(?=[#.])/);
          const sel = tag + rest.join('');
          const el = [...document.querySelectorAll(sel)].find((e) => {
            const b = e.getBoundingClientRect();
            return b.right > document.documentElement.clientWidth + 1 || b.left < -1 || e.scrollWidth > e.clientWidth + 2;
          });
          if (el) {
            el.style.outline = '3px solid red';
            el.style.outlineOffset = '-3px';
            first ||= el;
          }
        }
        first?.scrollIntoView({ block: 'center' });
      }, [...r.debordants, ...r.coupes]);
      await sleep(300);
      await page.screenshot({ path: capture }).catch(() => {});
    }
    results.push({ page: name, largeur: w, webgl: !SANS_WEBGL, ...r, capture });
    console.log(`${name} @${w} : scroll ${r.scrollWidth}/${r.vw}${r.nDebordants ? ` · ${r.nDebordants} hors écran (${r.debordants.slice(0, 3).map((x) => x.el).join(', ')})` : ''}${r.nCoupes ? ` · ${r.nCoupes} textes coupés (${r.coupes.slice(0, 3).map((x) => x.el).join(', ')})` : ''}`);
  }
  await ctx.close();
}
await browser.close();
writeFileSync(join(OUT, `debordements${only ? `-${only.join('-')}` : ''}${SANS_WEBGL ? '-sans-webgl' : ''}.json`), JSON.stringify(results, null, 1));
