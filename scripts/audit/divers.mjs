#!/usr/bin/env node
// Contrôles ponctuels : impression (feuille print, logotypes en image de fond), mouvement réduit
// (la 3D continue-t-elle de dessiner ?), vignettes chargées hors écran, renvoi du focus dans le
// panier, réponse HTTP des fiches inconnues, mise en cache des index de photos.
//   node scripts/audit/divers.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, OUT, launch, context, sleep, DESKTOP, MOBILE } from './lib.mjs';

const res = {};
const dir = join(OUT, 'divers');
mkdirSync(dir, { recursive: true });

// 1. Impression : fiche produit et recettes en PDF (sans fonds, comme par défaut dans les navigateurs)
{
  const browser = await launch({ webgl: false });
  for (const [name, path] of [
    ['fiche-pac', '/boutique/pac-citron'],
    ['recettes', '/recettes'],
    ['visiter', '/visiter'],
  ]) {
    const ctx = await context(browser, { device: DESKTOP });
    const page = await ctx.newPage();
    await page.goto(BASE + path, { waitUntil: 'load' });
    await sleep(1500);
    await page.emulateMedia({ media: 'print' });
    const info = await page.evaluate(() => {
      const vis = (sel) => [...document.querySelectorAll(sel)].some((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
      const h1 = document.querySelector('h1');
      return {
        reglesPrint: [...document.styleSheets].reduce((n, s) => {
          try {
            return n + [...s.cssRules].filter((r) => r.media && /print/.test(r.media.mediaText)).length;
          } catch {
            return n;
          }
        }, 0),
        enTeteImprime: vis('#site-header'),
        piedImprime: vis('footer'),
        pastilleV2X: vis('.v2x'),
        lettreInfo: vis('.ft__news'),
        h1Texte: h1?.innerText,
        logotypesEnFond: document.querySelectorAll('h1 .wm, h2 .wm, h3 .wm').length,
      };
    });
    const pdf = join(dir, `impression-${name}.pdf`);
    await page.pdf({ path: pdf, format: 'A4', printBackground: false });
    const { length } = await import('node:fs').then((fs) => fs.readFileSync(pdf));
    res[`impression ${name}`] = { ...info, pdf, octets: length };
    await ctx.close();
  }
  await browser.close();
}

// 2. Mouvement réduit : nombre d'images WebGL dessinées en 2 s sur l'accueil (la scène est figée)
{
  const browser = await launch({ webgl: true });
  for (const motion of ['reduce', 'no-preference']) {
    const ctx = await context(browser, { device: DESKTOP, reducedMotion: motion });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__draws = 0;
      for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext])
        if (C) {
          const d = C.prototype.drawElements;
          C.prototype.drawElements = function (...a) {
            window.__draws += 1;
            return d.apply(this, a);
          };
        }
    });
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#hero')?.classList.contains('is-live'), null, { timeout: 120000 }).catch(() => {});
    await sleep(3000);
    const a = await page.evaluate(() => window.__draws);
    await sleep(5000);
    const b = await page.evaluate(() => window.__draws);
    const reveal = await page.evaluate(() => [...document.querySelectorAll('[data-reveal]')].filter((e) => getComputedStyle(e).opacity !== '1').length);
    res[`mouvement ${motion}`] = { appelsDessinEn5s: b - a, elementsRevealInvisibles: reveal };
    await ctx.close();
  }
  await browser.close();
}

// 3. Vignettes : chargées avant d'être à l'écran ? (boutique au téléphone, sans défiler)
{
  const browser = await launch({ webgl: false });
  const ctx = await context(browser, { device: MOBILE });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/boutique`, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await sleep(1500);
  res.vignettesBoutique = await page.evaluate(() => {
    const vign = performance.getEntriesByType('resource').filter((e) => /vignette\.webp/.test(e.name));
    const imgs = [...document.querySelectorAll('img')].filter((i) => /vignette/.test(i.src));
    const below = imgs.filter((i) => i.getBoundingClientRect().top > innerHeight * 2);
    return { telechargees: vign.length, octets: vign.reduce((s, e) => s + (e.decodedBodySize || 0), 0), imagesDansLaPage: imgs.length, sansLazy: imgs.filter((i) => i.loading !== 'lazy').length, aPlusDeDeuxEcrans: below.length };
  });
  await ctx.close();
  await browser.close();
}

// 4. Panier latéral : le focus reste-t-il sur le bouton « + » après un clic au clavier ?
{
  const browser = await launch({ webgl: false });
  const ctx = await context(browser, { device: DESKTOP, panier: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await sleep(1000);
  await page.click('#cart-open');
  await sleep(500);
  await page.focus('#cart .line [data-q="1"]');
  await page.keyboard.press('Enter');
  await sleep(400);
  res.panierFocusApresPlus = await page.evaluate(() => {
    const el = document.activeElement;
    return el === document.body ? 'body (focus perdu)' : `${el.tagName.toLowerCase()} ${el.getAttribute('aria-label') || el.textContent.trim().slice(0, 30)}`;
  });
  await page.goto(`${BASE}/panier`, { waitUntil: 'load' });
  await sleep(1000);
  await page.focus('.co-line [data-q="1"]');
  await page.keyboard.press('Enter');
  await sleep(400);
  res.pagePanierFocusApresPlus = await page.evaluate(() => {
    const el = document.activeElement;
    return el === document.body ? 'body (focus perdu)' : `${el.tagName.toLowerCase()} ${el.getAttribute('aria-label') || el.textContent.trim().slice(0, 30)}`;
  });
  await ctx.close();
  await browser.close();
}

// 5. Fiches inconnues et 404 : statut HTTP
for (const path of ['/boutique/produit-inexistant', '/page-evaporee', '/la-distillerie', '/boutique/', '/recettes/blue-mojito']) {
  const r = await fetch(BASE + path, { redirect: 'manual', headers: { accept: 'text/html' } });
  res[`statut ${path}`] = r.status;
}

writeFileSync(join(OUT, 'divers.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
