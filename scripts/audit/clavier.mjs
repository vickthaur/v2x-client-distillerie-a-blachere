#!/usr/bin/env node
// Parcours au clavier : ordre de tabulation de l'en-tête et des méga-menus, visibilité du focus
// (contraste du contour avec le fond, sur les aplats de marque et les fonds sombres), focus caché
// sous l'en-tête collant ou la pastille V2X (WCAG 2.4.11), pièges et retours de focus dans les
// fenêtres (porte d'âge, panier, recherche, menu plein écran, filtres, pièce d'archive), carrousel.
//   node scripts/audit/clavier.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, OUT, launch, context, sleep, MOBILE, DESKTOP } from './lib.mjs';

const browser = await launch({ webgl: false });
const res = {};

const active = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { el: 'body' };
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    // contour visible ? (outline ou box-shadow) et couleur du fond réel derrière l'élément
    const bgOf = (n) => {
      for (let p = n; p; p = p.parentElement) {
        const c = getComputedStyle(p).backgroundColor;
        if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c;
      }
      return 'rgb(255, 255, 255)';
    };
    const hd = document.querySelector('#site-header')?.getBoundingClientRect();
    const v2x = document.querySelector('.v2x-pastille')?.getBoundingClientRect();
    const overlap = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const covered = (() => {
      // élément au centre du focus : est-ce lui (ou un de ses enfants) ?
      const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2));
      const y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
      const top = document.elementFromPoint(x, y);
      return top && !el.contains(top) && !top.contains(el) ? (top.closest('#site-header') ? 'en-tête' : top.closest('.v2x') ? 'pastille V2X' : top.tagName.toLowerCase()) : null;
    })();
    return {
      el: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls ? `.${cls}` : ''}`,
      texte: (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 40),
      outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 ? `${s.outlineWidth} ${s.outlineColor}` : null,
      shadow: s.boxShadow !== 'none' ? s.boxShadow.slice(0, 60) : null,
      fond: bgOf(el.parentElement || el),
      dansDialog: el.closest('dialog,[role="dialog"],#menu')?.id || null,
      visibleALecran: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth,
      sousEnTete: hd && !el.closest('#site-header,#menu,dialog,#search') ? overlap(r, hd) : false,
      sousPastille: v2x ? overlap(r, v2x) && !el.closest('.v2x') : false,
      masquePar: covered,
    };
  });

async function tabs(page, n, { shift = false } = {}) {
  const seq = [];
  for (let i = 0; i < n; i++) {
    await page.keyboard.press(shift ? 'Shift+Tab' : 'Tab');
    await sleep(60);
    seq.push(await active(page));
  }
  return seq;
}

async function open(device, path, opts = {}) {
  const ctx = await context(browser, { device, ...opts });
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await sleep(1200);
  return { ctx, page };
}

// 1. En-tête au bureau : ordre de tabulation, méga-menu ouvert au clavier
{
  const { ctx, page } = await open(DESKTOP, '/');
  res.enTete = await tabs(page, 16);
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await sleep(800);
  await page.focus('[data-mega="marques"]');
  await page.keyboard.press('Enter');
  await sleep(400);
  const ouvert = await page.evaluate(() => !document.querySelector('#mega-marques').hidden);
  const apres = await tabs(page, 9);
  res.megaMenu = {
    ouvertParEntree: ouvert,
    tabulationsAvantLePanneau: apres.findIndex((x) => /mega-brand|mega__aside|mega/.test(x.el) || x.dansDialog === 'mega-marques'),
    sequence: apres.map((x) => `${x.el} « ${x.texte} »`),
    panneauToujoursOuvertQuandLeFocusPart: await page.evaluate(() => !document.querySelector('#mega-marques').hidden),
  };
  await page.keyboard.press('Escape');
  res.megaMenu.echapFerme = await page.evaluate(() => document.querySelector('#mega-marques').hidden);
  // Recherche : le focus reste-t-il dans la fenêtre ?
  await page.click('#search-open');
  await sleep(500);
  const focusRecherche = await active(page);
  const rech = await tabs(page, 14);
  res.recherche = { focusInitial: focusRecherche, sortDeLaFenetre: rech.filter((x) => !x.dansDialog).map((x) => x.el).slice(0, 6), nSorties: rech.filter((x) => !x.dansDialog).length };
  await page.keyboard.press('Escape');
  await sleep(300);
  res.recherche.retourFocus = (await active(page)).el;
  // Panier latéral (dialog natif)
  await page.click('#cart-open');
  await sleep(600);
  const pan = await tabs(page, 8);
  res.panier = { focusDansLeDialog: pan.every((x) => x.dansDialog === 'cart'), sequence: pan.map((x) => x.el) };
  await page.keyboard.press('Escape');
  await sleep(300);
  res.panier.retourFocus = (await active(page)).el;
  await ctx.close();
}

// 2. Visibilité du focus page par page (contour et fond), focus masqué
const pagesFocus = ['/', '/pac-citron', '/fun-blue', '/la-maison', '/boutique', '/boutique/pac-citron', '/visiter', '/spiritueux', '/musee'];
res.focus = {};
for (const path of pagesFocus) {
  const { ctx, page } = await open(DESKTOP, path);
  const seq = await tabs(page, 140);
  const sans = seq.filter((x) => x.el !== 'body' && !x.outline && !x.shadow);
  const masques = seq.filter((x) => x.masquePar || x.sousEnTete || x.sousPastille);
  res.focus[path] = {
    n: seq.length,
    sansContour: [...new Map(sans.map((x) => [x.el, x])).values()].slice(0, 12),
    masques: [...new Map(masques.map((x) => [`${x.el}|${x.texte}`, x])).values()].slice(0, 12),
    contours: [...new Map(seq.filter((x) => x.outline).map((x) => [`${x.outline}|${x.fond}`, { outline: x.outline, fond: x.fond, el: x.el }])).values()],
  };
  await ctx.close();
}

// 3. Téléphone : menu plein écran (piège du focus, Échap, retour)
{
  const { ctx, page } = await open(MOBILE, '/');
  await page.click('#menu-open');
  await sleep(700);
  const focusMenu = await active(page);
  const m = await tabs(page, 40);
  res.menuMobile = { focusInitial: focusMenu, sorties: m.filter((x) => x.dansDialog !== 'menu').map((x) => x.el).slice(0, 8), nSorties: m.filter((x) => x.dansDialog !== 'menu').length };
  await page.keyboard.press('Escape');
  await sleep(500);
  res.menuMobile.retourFocus = (await active(page)).el;
  res.menuMobile.ariaModal = await page.evaluate(() => ({ role: document.querySelector('#menu').getAttribute('role'), modal: document.querySelector('#menu').getAttribute('aria-modal'), autresInertes: document.querySelector('main').inert }));
  await ctx.close();
}

// 4. Porte d'âge (première visite)
{
  const { ctx, page } = await open(DESKTOP, '/', { age: null });
  await page.waitForSelector('#gate[open]', { timeout: 5000 }).catch(() => {});
  await sleep(400);
  res.porte = { focusInitial: await active(page) };
  const g = await tabs(page, 8);
  res.porte.sequence = g.map((x) => `${x.el} « ${x.texte} »`);
  res.porte.piege = g.every((x) => x.dansDialog === 'gate');
  // saisie automatique jour → mois → année
  await page.focus('#gate [name="jour"]');
  await page.keyboard.type('0712');
  res.porte.sautAuto = (await active(page)).el;
  await page.keyboard.press('Escape');
  await sleep(300);
  res.porte.apresEchap = await page.evaluate(() => ({ ouverte: document.querySelector('#gate').open, age: sessionStorage.getItem('blachere-age') }));
  await ctx.close();
}

// 5. Archives : la pièce en grand s'ouvre-t-elle au clavier ?
{
  const { ctx, page } = await open(DESKTOP, '/musee');
  res.musee = await page.evaluate(() => {
    const wall = document.querySelector('.mus-wall');
    const focusables = wall ? wall.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])').length : 0;
    return { pieces: document.querySelectorAll('.mus-wall .piece').length, elementsFocusablesDansLeMur: focusables };
  });
  await ctx.close();
}

// 6. Boutique au téléphone : panneau de filtres (dialog natif)
{
  const { ctx, page } = await open(MOBILE, '/boutique');
  await page.click('#filters-open');
  await sleep(600);
  const f = await tabs(page, 12);
  res.filtres = { focusDansLePanneau: f.every((x) => x.dansDialog === 'filter-sheet'), premier: f[0] };
  await page.keyboard.press('Escape');
  await sleep(300);
  res.filtres.retourFocus = (await active(page)).el;
  await ctx.close();
}

// 7. Carrousel de l'accueil : boutons, zone défilable au clavier, cartes atteignables
{
  const { ctx, page } = await open(DESKTOP, '/');
  res.carrousel = await page.evaluate(() => {
    const vp = document.querySelector('#shelf');
    return { tabindex: vp?.getAttribute('tabindex'), role: vp?.getAttribute('role'), label: vp?.getAttribute('aria-label'), cartes: vp?.querySelectorAll('.card').length, liensParCarte: vp?.querySelector('.card') ? vp.querySelector('.card').querySelectorAll('a[href]:not([tabindex="-1"]), button').length : 0 };
  });
  await page.focus('#shelf');
  const x0 = await page.evaluate(() => document.querySelector('#shelf').scrollLeft);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await sleep(500);
  res.carrousel.defileAuxFleches = (await page.evaluate(() => document.querySelector('#shelf').scrollLeft)) > x0;
  await ctx.close();
}

await browser.close();
writeFileSync(join(OUT, 'clavier.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1).slice(0, 6000));
