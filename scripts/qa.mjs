#!/usr/bin/env node
// Recette de la maquette v3 : lance « vite preview » sur le build (dist/), parcourt toutes les pages
// et leurs états avec Chromium (Playwright), prend les captures et vérifie :
//   - aucune erreur dans la console ni dans la page ;
//   - aucun défilement horizontal, et en-tête, navigation, campagne, cartes de prix et cartes dans
//     la largeur de l'écran, aux dix tailles d'écran de la recette (1920 × 1080, 1920 × 950,
//     2560 × 1440, 3440 × 1440, 1440 × 900, 1366 × 768, 1280 × 720, 1024 × 768, 768 × 1024,
//     390 × 844) ; les bouteilles 3D entières dans leur cadre et sous l'en-tête ;
//   - les compteurs des filtres (calculés depuis le catalogue officiel), l'adresse synchronisée,
//     la remise à zéro, les variantes et leurs prix ;
//   - les totaux du panier, la case « 18 ans », l'acceptation des CGV, le parcours de commande ;
//   - qu'une personne mineure ne voit aucun alcool (texte, libellés, liens, recettes) ;
//   - le message sanitaire une fois par section qui montre des cartes d'alcool, jamais sous chaque
//     carte, et la bande collante du rayon Spiritueux de la boutique ;
//   - les logotypes PAC et Fun Blue dans les titres, la police de marque dans le texte ;
//   - la page 404 (statut 404), noindex, robots.txt ;
//   - deuxième vague : pas de double marge sous l'en-tête, barre d'achat des fiches, 3D sobre des
//     fiches, mode revue, méga-menus au clavier et fenêtres modales, focus du panier, prix au litre,
//     frais de port, erreurs par champ, balises, cache des images, feuille de la pastille, pause des
//     animations, impression.
//
//   npm run build && node scripts/qa.mjs [--sortie <dossier>] [--port 4173] [--rapide]
//
// Playwright n'est pas une dépendance du projet : le script utilise l'installation globale
// (PLAYWRIGHT_MODULE, par défaut /opt/node22/lib/node_modules/playwright) et le Chromium
// préinstallé (PLAYWRIGHT_CHROMIUM, par défaut /opt/pw-browsers/chromium), avec SwiftShader
// pour WebGL. Ne lance jamais « playwright install ».
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const RAPIDE = args.includes('--rapide');
const OUT = resolve(opt('sortie', join(root, '.cache/qa')));
const PORT = Number(opt('port', 4173));
const BASE = `http://localhost:${PORT}`;
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const sharp = require('sharp');

if (!existsSync(join(root, 'dist/index.html'))) {
  console.error('Lancez d’abord « npm run build ».');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

// ---------- Données attendues, depuis le catalogue officiel ----------
const catalogue = JSON.parse(readFileSync(join(root, 'src/data/catalogue.json'), 'utf8')).produits;
const recettes = JSON.parse(readFileSync(join(root, 'src/data/site/recettes.json'), 'utf8')).recettes;
const ALCOOLS = catalogue.filter((p) => p.categorie === 'Alcools');
const N = {
  tous: catalogue.length,
  sirops: catalogue.filter((p) => p.categorie !== 'Alcools').length,
  spiritueux: ALCOOLS.length,
  cp: catalogue.filter((p) => p.gamme === 'couleur-provence').length,
  best: catalogue.filter((p) => p.bestSeller).length,
  cl50: catalogue.filter((p) => p.contenances.some((c) => c.id === '500')).length,
};
const prix = (slug, id) => catalogue.find((p) => p.slug === slug).contenances.find((c) => c.id === id).prix;
const euroQA = (n) => `${n.toFixed(2).replace('.', ',')} €`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` · ${detail}` : ''}`);
};
const consoleErrors = [];

// ---------- Serveur ----------
// Vite lancé directement (et non par npx) pour que l'arrêt en fin de recette arrête bien le serveur.
const server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
// même si la recette s'interrompt (erreur, délai dépassé), le serveur ne reste pas en place : sinon
// la recette suivante ne pourrait plus prendre le port
process.on('exit', () => server.kill());
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(130));
await new Promise((ok, ko) => {
  const t = setTimeout(() => ko(new Error('vite preview ne démarre pas')), 30000);
  server.stdout.on('data', (d) => {
    if (String(d).includes(String(PORT))) {
      clearTimeout(t);
      ok();
    }
  });
  server.on('exit', (c) => ko(new Error(`vite preview s’est arrêté (${c})`)));
});

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});

const VIEWPORTS = {
  bureau: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true },
};
// Les tailles d'écran de la recette (écrans larges, ultra-larges, portables, tablette, téléphone).
const ECRANS = [
  [1920, 1080],
  [1920, 950],
  [2560, 1440],
  [3440, 1440],
  [1440, 900],
  [1366, 768],
  [1280, 720],
  [1024, 768],
  [768, 1024],
  [390, 844],
];

// Contexte avec une réponse d'âge déjà donnée ('majeur' → localStorage, sinon sessionStorage).
async function context(vp, age = 'sirops') {
  const v = typeof vp === 'string' ? VIEWPORTS[vp] : vp;
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: 1, isMobile: !!v.isMobile, hasTouch: !!v.hasTouch, locale: 'fr-FR' });
  await ctx.addInitScript((a) => {
    try {
      if (a === 'majeur') localStorage.setItem('blachere-age', 'majeur');
      else if (a) sessionStorage.setItem('blachere-age', a);
    } catch {}
  }, age);
  return ctx;
}

async function open(ctx, path, { wait = 2500, label = path, hero = false } = {}) {
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(`${label} : ${m.text()}`));
  page.on('pageerror', (e) => consoleErrors.push(`${label} : ${e.message}`));
  const [p, hash] = path.split('#');
  const res = await page.goto(`${BASE}${p}${p.includes('?') ? '&' : '?'}test${hash ? `#${hash}` : ''}`, { waitUntil: 'networkidle' });
  if (hero) await page.waitForFunction(() => window.__heroReady === true, null, { timeout: 150000 }).catch(() => consoleErrors.push(`${label} : campagne 3D non prête`));
  await page.waitForTimeout(wait);
  return { page, res };
}

// Capture pleine page : images décodées d'abord (sinon Chromium peut les laisser blanches). Au-delà
// de 8 192 px de haut, le rendu logiciel (SwiftShader) recopie le haut de la page en bas de
// l'image : les pages longues sont donc prises par tranches de 6 000 px, puis assemblées.
const TRANCHE = 6000;
async function shot(page, name, full = true) {
  const file = join(OUT, `${name}.png`);
  if (full) {
    const H = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < H; y += 800) {
      await page.evaluate((v) => scrollTo(0, v), y);
      await page.waitForTimeout(120);
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => Promise.all([...document.images].map((i) => ((i.loading = 'eager'), i.decode().catch(() => {})))));
  if (!full) return page.screenshot({ path: file, timeout: 180000 });
  const { W, H } = await page.evaluate(() => ({ W: document.documentElement.clientWidth, H: document.documentElement.scrollHeight }));
  if (H <= TRANCHE) return page.screenshot({ path: file, fullPage: true, timeout: 180000 });
  const parts = [];
  for (let y = 0; y < H; y += TRANCHE) {
    const input = await page.screenshot({ fullPage: true, clip: { x: 0, y, width: W, height: Math.min(TRANCHE, H - y) }, timeout: 180000 });
    parts.push({ input, left: 0, top: y });
  }
  await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' }, limitInputPixels: false }).composite(parts).png().toFile(file);
}

// Éléments qui sortent de l'écran (hors conteneurs à défilement horizontal voulu).
// Largeur de référence : la fenêtre de mise en page (clientWidth). innerWidth ne convient pas : sur
// téléphone, Chromium l'élargit au contenu quand quelque chose dépasse (et masquerait le défaut).
const overflowProbe = () => {
  const W = document.documentElement.clientWidth;
  const sel = '.hd, .hd__util, .hd__main, .nav, .hd__tools, .hero__copy, .hero__tags, .hero__tag, .bhero__copy, .bprice, .brand, .card, .mega-brand, .pp__info, .pp__stage, .shop__layout, .ft, h1, h2';
  const scrollers = (el) => {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (/(auto|scroll)/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 1) return true;
      if (s.display === 'none' || s.visibility === 'hidden') return true;
    }
    return false;
  };
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || scrollers(el) || el.closest('[hidden], .mega:not(.is-open), .menu:not(.is-open), dialog:not([open])')) continue;
    if (r.left < -1 || r.right > W + 1) out.push(`${el.className || el.tagName} (${Math.round(r.left)} → ${Math.round(r.right)})`);
  }
  return { over: document.documentElement.scrollWidth - W, out: out.slice(0, 6) };
};

// ---------- 1. Toutes les pages, bureau et téléphone ----------
const PAGES = [
  ['01-accueil', '/', 'sirops', true],
  ['02-pac-citron', '/pac-citron', 'sirops', true],
  ['03-fun-blue', '/fun-blue', 'sirops', true],
  ['04-couleur-provence', '/couleur-provence', 'sirops', true],
  ['05-recettes', '/recettes'],
  ['06-spiritueux', '/spiritueux', 'majeur'],
  ['07-la-maison', '/la-maison', 'majeur'],
  ['08-archives', '/musee', 'majeur'],
  ['09-visiter', '/visiter', 'majeur'],
  ['10-boutique', '/boutique', 'majeur'],
  ['11-fiche-pac-citron', '/boutique/pac-citron'],
  ['12-fiche-fun-blue', '/boutique/fun-blue'],
  ['13-fiche-grenadine', '/boutique/sirop-couleur-provence-grenadine'],
  ['14-fiche-pastis-marra', '/boutique/pastis-marra', 'majeur'],
  ['15-fiche-elixir-1958', '/boutique/marc-elixir-millesime-1958', 'majeur'],
  ['16-ou-trouver', '/ou-trouver'],
  ['17-actualites', '/actualites'],
  ['18-espace-pro', '/espace-pro'],
  ['19-mentions-legales', '/mentions-legales'],
  ['20-conditions-de-vente', '/conditions-de-vente'],
  ['21-panier-vide', '/panier'],
];
for (const vp of ['bureau', 'mobile']) {
  for (const [name, path, age = 'sirops', hero = false] of PAGES) {
    const ctx = await context(vp, age);
    const { page } = await open(ctx, path, { wait: hero ? 1500 : 2500, label: `${vp} ${path}`, hero });
    const m = await page.evaluate(() => ({ title: document.title, robots: document.querySelector('meta[name="robots"]')?.content || '' }));
    const o = await page.evaluate(overflowProbe);
    check(`${vp} ${path} : rien ne dépasse de l’écran`, o.over <= 0 && !o.out.length, [o.over > 0 ? `${o.over} px de trop` : '', ...o.out].filter(Boolean).join(' ; '));
    if (vp === 'bureau') check(`${path} : titre et noindex`, m.title && /noindex/.test(m.robots), m.title);
    await shot(page, `${vp}-${name}`, true);
    if (path === '/') {
      // Accueil : chaque section, écran par écran.
      const n = await page.evaluate(() => document.querySelectorAll('main > section').length);
      for (let i = 0; i < n; i++) {
        const id = await page.evaluate((k) => {
          const s = document.querySelectorAll('main > section')[k];
          s.scrollIntoView();
          return s.id || s.className.split(' ')[0];
        }, i);
        await page.waitForTimeout(700);
        await shot(page, `${vp}-01-accueil-s${String(i + 1).padStart(2, '0')}-${id}`, false);
      }
    }
    await ctx.close();
  }
}

// ---------- 1 bis. Sous l'en-tête : pas de double marge ; fiches et boutique (QUAL-6, UX-1, UX-2) ----------
// body porte la marge de l'en-tête fixe : le premier texte de la page (titre, surtitre, fil
// d'Ariane) commence juste dessous, sans seconde marge de la hauteur de l'en-tête.
{
  const premierTexte = () => {
    const hd = document.querySelector('.hd__main')?.getBoundingClientRect();
    const main = document.querySelector('main');
    const first = [...(main?.querySelectorAll('h1, .crumbs, .kicker') || [])].find((e) => e.getBoundingClientRect().height > 0);
    const h1 = main?.querySelector('h1')?.getBoundingClientRect();
    return { header: Math.round(hd?.bottom || 0), premier: first ? Math.round(first.getBoundingClientRect().top) : null, h1: h1 ? Math.round(h1.top) : null };
  };
  const pages = PAGES.filter(([name, path, , hero]) => !hero && !['/'].includes(path));
  for (const vp of ['bureau', 'mobile']) {
    const ctx = await context(vp, 'majeur');
    const max = vp === 'bureau' ? 160 : 110;
    const ecarts = [];
    for (const [, path] of pages) {
      const { page } = await open(ctx, path, { wait: 1200, label: `${vp} ${path} marge` });
      const m = await page.evaluate(premierTexte);
      ecarts.push({ path, ...m, ecart: m.premier === null ? null : m.premier - m.header });
      await page.close();
    }
    const trop = ecarts.filter((e) => e.ecart === null || e.ecart > max);
    check(`${vp} : sous l’en-tête, pas de double marge (premier texte à ${max} px au plus de l’en-tête, ${ecarts.length} pages)`, !trop.length, (trop.length ? trop : ecarts.slice(0, 4)).map((e) => `${e.path} ${e.ecart} px (h1 à ${e.h1})`).join(' ; '));
    await ctx.close();
  }
  // Fiche au téléphone : plateau à 56 % de l'écran au plus, nom et prix remontés ; au bureau, h1 haut.
  const ctxm = await context('mobile', 'sirops');
  const { page: fm } = await open(ctxm, '/boutique/pac-citron', { wait: 2500, label: 'fiche téléphone' });
  const f = await fm.evaluate(() => ({ h1: Math.round(document.querySelector('.pp__name').getBoundingClientRect().top), stage: Math.round(document.querySelector('.pp__stage').getBoundingClientRect().height), vh: innerHeight, prix: Math.round(document.querySelector('.pp__price').getBoundingClientRect().top) }));
  check('Fiche au téléphone : plateau à 56 svh au plus, nom du produit à 620 px au plus', f.stage <= Math.ceil(f.vh * 0.56) + 1 && f.h1 <= 620, `plateau ${f.stage} px pour ${f.vh} px, h1 à ${f.h1} px, prix à ${f.prix} px`);
  // Barre d'achat collante : absente tant que le bouton est à l'écran, présente quand il est passé
  // sous l'en-tête, effacée au pied de page ; son bouton ajoute au panier (tiroir ouvert).
  const etatBarre = () => fm.evaluate(() => {
    const b = document.querySelector('#pp-bar');
    const r = b?.getBoundingClientRect();
    return { on: !!b?.classList.contains('is-on'), inert: !!b?.inert, visible: !!r && r.top < innerHeight - 10 && getComputedStyle(b).visibility === 'visible' };
  });
  const avant = await etatBarre();
  await fm.evaluate(() => {
    const row = document.querySelector('#buy .pp__row').getBoundingClientRect();
    scrollTo(0, scrollY + row.bottom + 60);
  });
  // la barre suit le défilement à l'image près (requestAnimationFrame), puis glisse en place
  // (0,4 s) : on attend qu'elle soit à l'écran, jusqu'à 8 s sous charge
  await fm.waitForFunction(() => {
    const b = document.querySelector('#pp-bar');
    return !!b?.classList.contains('is-on') && b.getBoundingClientRect().top < innerHeight - 10;
  }, null, { timeout: 8000 }).catch(() => {});
  await fm.waitForTimeout(300);
  const pendant = await etatBarre();
  await shot(fm, 'mobile-46-fiche-barre-achat', false);
  await fm.click('#pp-bar-add');
  await fm.waitForTimeout(800);
  const ajout = await fm.evaluate(() => ({ tiroir: document.querySelector('#cart').open, lignes: [...document.querySelectorAll('#cart-list .line')].map((l) => l.dataset.slug) }));
  // tiroir refermé à la souris : le bouton de la barre reprend le focus, sans contour (au clavier,
  // la barre resterait tant que le focus y est)
  await fm.click('#cart-close');
  await fm.waitForTimeout(500);
  await fm.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await fm.waitForFunction(() => !document.querySelector('#pp-bar')?.classList.contains('is-on'), null, { timeout: 8000 }).catch(() => {});
  await fm.waitForTimeout(300);
  const pied = await etatBarre();
  check('Fiche : barre d’achat collante quand le bouton sort de l’écran, effacée au pied de page', !avant.on && avant.inert && pendant.on && pendant.visible && !pendant.inert && !pied.on, JSON.stringify({ avant, pendant, pied }));
  check('Barre d’achat : son bouton ajoute le produit au panier', ajout.tiroir && ajout.lignes.includes('pac-citron'), JSON.stringify(ajout));
  await ctxm.close();
  const ctxb = await context('bureau', 'majeur');
  const { page: fb } = await open(ctxb, '/boutique/pac-citron', { wait: 2000, label: 'fiche bureau' });
  const fbm = await fb.evaluate(() => Math.round(document.querySelector('.pp__name').getBoundingClientRect().top));
  check('Fiche au bureau : nom du produit à 260 px au plus', fbm <= 260, `h1 à ${fbm} px`);
  await fb.close();
  const { page: bo } = await open(ctxb, '/boutique', { wait: 2000, label: 'boutique bureau' });
  const bom = await bo.evaluate(() => ({ h1: Math.round(document.querySelector('h1').getBoundingClientRect().top), carte: Math.round(document.querySelector('#shop-grid .card')?.getBoundingClientRect().top ?? -1), barre: Math.round(document.querySelector('.shop__bar').getBoundingClientRect().height) }));
  check('Boutique au bureau : en-tête compact, premiers produits à 420 px au plus', bom.carte > 0 && bom.carte <= 420, `h1 à ${bom.h1} px, première carte à ${bom.carte} px, rangée rayons-recherche-tri de ${bom.barre} px`);
  await ctxb.close();
}

// ---------- 1 ter. 3D sobre sur les fiches (PERF-2, PERF-4) ----------
// Mouvement réduit : l'affiche seule (ni three.js ni index des photos). Sinon la visionneuse, sans
// le dos de l'étiquette tant qu'on n'a pas cliqué sur « Dos ».
{
  const fiche = '/boutique/sirop-couleur-provence-grenadine';
  const suivre = (page) => {
    const urls = [];
    page.on('request', (r) => urls.push(r.url()));
    return urls;
  };
  const ctxr = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', locale: 'fr-FR' });
  await ctxr.addInitScript(() => sessionStorage.setItem('blachere-age', 'sirops'));
  const pr = await ctxr.newPage();
  pr.on('pageerror', (e) => consoleErrors.push(`mouvement réduit ${fiche} : ${e.message}`));
  const ur = suivre(pr);
  await pr.goto(`${BASE}${fiche}?test`, { waitUntil: 'networkidle' });
  await pr.waitForTimeout(2500);
  const sr = await pr.evaluate(() => ({ statique: document.querySelector('#stage').classList.contains('is-static'), alt: document.querySelector('#poster img')?.alt || '', canvas: document.querySelector('#viewer')?.hidden }));
  const lourds = ur.filter((u) => /\/assets\/(three|viewer|stage)-|\/bouteilles\/index\.json|etiquette/.test(u)).map((u) => u.replace(BASE, ''));
  check('Fiche en mouvement réduit : l’affiche seule (ni three.js, ni index des photos, ni étiquettes)', sr.statique && sr.alt.length > 3 && sr.canvas && !lourds.length, `${JSON.stringify(sr)} ${lourds.join(', ')}`);
  await ctxr.close();
  const ctxw = await context('bureau', 'sirops');
  const pw = await ctxw.newPage();
  pw.on('pageerror', (e) => consoleErrors.push(`3D ${fiche} : ${e.message}`));
  const uw = suivre(pw);
  await pw.goto(`${BASE}${fiche}?test`, { waitUntil: 'networkidle' });
  const live = await pw.waitForFunction(() => document.querySelector('#stage')?.classList.contains('is-live'), null, { timeout: 120000 }).then(() => true, () => false);
  await pw.waitForTimeout(800);
  const dosAvant = uw.filter((u) => /etiquette-dos/.test(u)).length;
  const bouton = await pw.evaluate(() => !document.querySelector('.pp__sides')?.hidden);
  if (bouton) await pw.click('.pp__sides [data-side="1"]');
  await pw.waitForTimeout(2500);
  const dosApres = uw.filter((u) => /etiquette-dos/.test(u)).length;
  check('Fiche avec WebGL : visionneuse 3D, dos de l’étiquette chargé seulement au clic sur « Dos »', live && bouton && dosAvant === 0 && dosApres === 1, `3D ${live}, bouton ${bouton}, dos avant ${dosAvant}, après ${dosApres}`);
  await shot(pw, 'bureau-47-fiche-dos', false);
  await ctxw.close();
}

// ---------- 1 quater. Pause de l'animation (A11Y-7) ----------
// Campagnes et bouteille des fiches de sirop : bouton « Mettre l'animation en pause » (bascule à nom
// fixe, état dans aria-pressed) ; en pause, l'image ne bouge plus ; le choix suit le visiteur d'une
// page à l'autre ; aucun bouton sur les fiches de spiritueux (pas de rotation automatique).
{
  const ctx = await context('bureau', 'majeur');
  // en temps réel (sans ?test) : deux images de la campagne prises à 1,5 s d'écart
  const page = await ctx.newPage();
  page.on('pageerror', (e) => consoleErrors.push(`pause /pac-citron : ${e.message}`));
  await page.goto(`${BASE}/pac-citron`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.bhero .anim-pause', { timeout: 150000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const zone = await page.evaluate(() => {
    const r = document.querySelector('#bhero-stage').getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
  });
  const image = () => page.screenshot({ clip: zone, timeout: 120000 });
  const b0 = await page.evaluate(() => {
    const b = document.querySelector('.bhero .anim-pause');
    return b ? { nom: b.textContent.trim(), pressed: b.getAttribute('aria-pressed') } : null;
  });
  const i1 = await image();
  await page.waitForTimeout(1500);
  const bouge = !i1.equals(await image());
  if (b0) await page.click('.bhero .anim-pause');
  // la scène se fige après les dernières images en cours (lentes sous charge, jusqu'à 10 s) : deux
  // images identiques de suite, puis la même encore 1,5 s plus tard
  let i3 = await image();
  let stable = false;
  for (let k = 0; k < 10 && !stable; k++) {
    await page.waitForTimeout(1000);
    const suivante = await image();
    stable = suivante.equals(i3);
    i3 = suivante;
  }
  await page.waitForTimeout(1500);
  const fige = stable && i3.equals(await image());
  const etat = await page.evaluate(() => ({ pressed: document.querySelector('.bhero .anim-pause')?.getAttribute('aria-pressed'), paused: window.__hero?.paused, garde: localStorage.getItem('blachere-animation') }));
  check('Campagne : bouton « Mettre l’animation en pause » ; l’image bouge, puis se fige', b0?.nom === 'Mettre l’animation en pause' && b0.pressed === 'false' && bouge && fige && etat.pressed === 'true' && etat.paused === true && etat.garde === 'pause', JSON.stringify({ b0, bouge, fige, etat }));
  await shot(page, 'bureau-49-campagne-en-pause', false);
  await page.close();
  const { page: acc } = await open(ctx, '/', { wait: 800, label: 'pause accueil', hero: true });
  const a = await acc.evaluate(() => ({ pressed: document.querySelector('.hero .anim-pause')?.getAttribute('aria-pressed'), paused: window.__hero?.paused }));
  if (a.pressed) await acc.click('.hero .anim-pause');
  await acc.waitForTimeout(300);
  const r = await acc.evaluate(() => ({ pressed: document.querySelector('.hero .anim-pause')?.getAttribute('aria-pressed'), paused: window.__hero?.paused, garde: localStorage.getItem('blachere-animation') }));
  await acc.close();
  check('Pause gardée d’une page à l’autre ; second appui : l’animation reprend', a.pressed === 'true' && a.paused === true && r.pressed === 'false' && r.paused === false && r.garde === null, JSON.stringify({ a, r }));
  const vue = async (path) => {
    const { page: f } = await open(ctx, path, { wait: 800, label: `pause ${path}` });
    await f.waitForFunction(() => document.querySelector('#stage')?.classList.contains('is-live'), null, { timeout: 120000 }).catch(() => {});
    await f.waitForTimeout(500);
    const v = await f.evaluate(() => ({ live: document.querySelector('#stage').classList.contains('is-live'), bouton: !!document.querySelector('#stage .anim-pause') }));
    await f.close();
    return v;
  };
  const sirop = await vue('/boutique/pac-citron');
  const spiritueux = await vue('/boutique/pastis-marra');
  check('Fiches : bouton de pause sur la bouteille qui tourne (sirop), aucun sur les spiritueux (pas de rotation)', sirop.live && sirop.bouton && spiritueux.live && !spiritueux.bouton, JSON.stringify({ sirop, spiritueux }));
  await ctx.close();
}

// ---------- 2. Dix tailles d'écran : largeur, campagne 3D, bouteilles entières ----------
{
  const pages = [
    ['accueil', '/', true],
    ['pac-citron', '/pac-citron', true],
    ['fun-blue', '/fun-blue', true],
    ['couleur-provence', '/couleur-provence', true],
    ['boutique', '/boutique', false],
    ['fiche-pac-citron', '/boutique/pac-citron', false],
  ];
  const ecrans = RAPIDE ? ECRANS.filter(([w]) => [1920, 3440, 390].includes(w)) : ECRANS;
  for (const [w, h] of ecrans) {
    const ctx = await context({ width: w, height: h, isMobile: w < 500, hasTouch: w < 500 }, 'majeur');
    for (const [name, path, hero] of pages) {
      const { page } = await open(ctx, path, { wait: hero ? 1200 : 2200, label: `${w}×${h} ${path}`, hero });
      const o = await page.evaluate(overflowProbe);
      check(`${w}×${h} ${path} : rien ne dépasse de l’écran`, o.over <= 0 && !o.out.length, [o.over > 0 ? `${o.over} px de trop` : '', ...o.out].filter(Boolean).join(' ; '));
      if (hero) {
        const b = await page.evaluate(() => {
          const hd = document.querySelector('.hd__main')?.getBoundingClientRect();
          return { bounds: window.__hero?.bounds?.() || [], header: hd ? hd.bottom : 0 };
        });
        const bad = b.bounds.filter((x) => x.left < 0 || x.top < 0 || x.right > x.width || x.bottom > x.height);
        check(`${w}×${h} ${path} : bouteilles 3D entières dans le cadre`, b.bounds.length > 0 && !bad.length, bad.map((x) => `${x.slug} ${Math.round(x.left)},${Math.round(x.top)} → ${Math.round(x.right)},${Math.round(x.bottom)} / ${x.width}×${x.height}`).join(' ; '));
        const under = b.bounds.filter((x) => x.top < b.header - 2);
        check(`${w}×${h} ${path} : bouteilles sous l’en-tête`, !under.length, under.map((x) => `${x.slug} haut ${Math.round(x.top)} < ${Math.round(b.header)}`).join(' ; '));
      }
      await shot(page, `ecran-${w}x${h}-${name}`, false);
      await page.close();
    }
    await ctx.close();
  }
}

// ---------- 3. Porte d'âge ----------
{
  const ctx = await context('bureau', null);
  const { page } = await open(ctx, '/', { wait: 3000, label: 'porte d’âge' });
  check('Première visite : la date de naissance est demandée', await page.evaluate(() => document.querySelector('#gate')?.open));
  await shot(page, 'bureau-30-porte-age', false);
  await page.fill('[name="jour"]', '12');
  await page.fill('[name="mois"]', '05');
  await page.fill('[name="annee"]', String(new Date().getFullYear() - 15));
  await page.click('.gate__go');
  await page.waitForTimeout(500);
  const no = await page.evaluate(() => ({ visible: !document.querySelector('#gate-no').hidden, age: document.documentElement.dataset.age }));
  check('Moins de 18 ans : message et état « mineur »', no.visible && no.age === 'mineur');
  await shot(page, 'bureau-31-porte-age-mineur', false);
  await ctx.close();
  const ctx2 = await context('mobile', null);
  const { page: p2 } = await open(ctx2, '/boutique', { wait: 2500, label: 'porte d’âge mobile' });
  await shot(p2, 'mobile-30-porte-age', false);
  await p2.click('#gate-skip');
  await p2.waitForTimeout(400);
  const skip = await p2.evaluate(() => ({ open: document.querySelector('#gate').open, alcohol: document.querySelectorAll('.card[data-alcool]').length }));
  check('« Continuer avec les sirops seulement » : aucun spiritueux affiché', !skip.open && skip.alcohol === 0);
  await ctx2.close();
}

// ---------- 3 bis. Mode revue (QUAL-8) ----------
// Sans ?revue, aucune note de maquette dans le texte public (la ligne « Maquette non officielle » du
// pied de page et les mentions légales restent, par choix) ; avec ?revue, les notes apparaissent.
{
  // \b : « la visite de la distillerie » n'est pas une note de maquette
  const NOTES = /à confirmer|à préciser|à annoncer|à fournir|maquette|\bsite (de la distillerie|officiel|actuel)|page Histoire|selon les sources/i;
  const ctx = await context('bureau', 'majeur');
  await ctx.addInitScript(() => localStorage.setItem('blachere-panier', JSON.stringify({ v: 3, items: [{ slug: 'pac-citron', v: '1000', qty: 1 }] })));
  const pages = ['/boutique', '/boutique/pac-citron', '/boutique/la-camarguaise', '/panier', '/visiter', '/espace-pro', '/'];
  const vues = [];
  for (const path of pages) {
    const { page } = await open(ctx, path, { wait: 1500, label: `revue ${path}` });
    const lignes = await page.evaluate((re) => {
      const rx = new RegExp(re, 'i');
      // la ligne « Maquette non officielle réalisée par V2X Studio… » du pied de page reste
      const legal = document.querySelector('.ft__legal')?.innerText || '';
      const parts = ['#site-header', 'main', 'footer'].map((s) => document.querySelector(s)?.innerText || '');
      parts[2] = parts[2].replace(legal, '');
      return parts.join('\n').split('\n').map((l) => l.trim()).filter((l) => l && rx.test(l));
    }, NOTES.source);
    vues.push(...lignes.map((l) => `${path} : ${l.slice(0, 90)}`));
    await page.close();
  }
  check(`Sans ?revue : aucune note de maquette visible (${pages.length} pages, en-tête et pied de page compris)`, !vues.length, vues.slice(0, 6).join(' | '));
  const { page: rv } = await open(ctx, '/boutique/pac-citron?revue', { wait: 2500, label: 'revue fiche' });
  const r = await rv.evaluate(() => ({ classe: document.documentElement.classList.contains('revue'), notes: [...document.querySelectorAll('.pp__notes [data-revue]')].filter((e) => e.getClientRects().length).length, langues: !!document.querySelector('.hd__lang')?.getClientRects().length }));
  check('Avec ?revue : notes sourcées de la fiche et langues de l’en-tête affichées', r.classe && r.notes > 0 && r.langues, JSON.stringify(r));
  await shot(rv, 'bureau-48-fiche-revue', false);
  await ctx.close();
}

// ---------- 4. En-tête : méga-menus, recherche, menu mobile, panier latéral ----------
{
  const ctx = await context('bureau', 'majeur');
  const { page } = await open(ctx, '/boutique', { wait: 2500, label: 'en-tête' });
  for (const k of ['marques', 'spiritueux', 'maison']) {
    await page.hover(`[data-mega="${k}"]`);
    await page.waitForTimeout(900);
    check(`Méga-menu « ${k} » ouvert au survol`, await page.evaluate((x) => document.querySelector(`#mega-${x}`)?.classList.contains('is-open'), k));
    await shot(page, `bureau-32-mega-${k}`, false);
  }
  await page.mouse.move(700, 700);
  await page.waitForTimeout(600);
  const wm = await page.evaluate(() => ({ n: document.querySelectorAll('#mega-marques .wm--pac, #mega-marques .wm--fb').length, sr: document.querySelector('#mega-marques .wm--pac .sr-only')?.textContent }));
  check('Méga-menu : logotypes PAC et Fun Blue, avec le nom en texte pour les lecteurs d’écran', wm.n >= 2 && wm.sr === 'PAC', JSON.stringify(wm));
  await page.click('#search-open');
  await page.fill('#search-q', 'menthe');
  await page.waitForTimeout(600);
  check('Recherche : des résultats pour « menthe »', await page.evaluate(() => document.querySelectorAll('#search-results a').length > 0));
  await shot(page, 'bureau-33-recherche', false);
  await page.keyboard.press('Escape');
  await ctx.close();
  const ctxm = await context('mobile', 'sirops');
  const { page: mm } = await open(ctxm, '/', { wait: 3000, label: 'menu mobile' });
  await mm.click('#menu-open');
  await mm.waitForTimeout(700);
  check('Téléphone : le menu plein écran s’ouvre', await mm.evaluate(() => document.querySelector('#menu').classList.contains('is-open')));
  await shot(mm, 'mobile-31-menu', false);
  await ctxm.close();
}

// ---------- 4 bis. Clavier : méga-menus dans l'ordre du focus, fenêtres modales (A11Y-3, A11Y-4) ----------
{
  const actif = (page) => page.evaluate(() => {
    const a = document.activeElement;
    return { id: a?.id || '', mega: a?.closest('.mega')?.id || null, dialog: a?.closest('dialog')?.id || null, tag: a?.tagName.toLowerCase() };
  });
  const ctx = await context('bureau', 'majeur');
  const { page } = await open(ctx, '/boutique', { wait: 2000, label: 'clavier en-tête' });
  // attentes sur l'état plutôt qu'à durée fixe : la recette tourne parfois sur une machine chargée
  await page.focus('[data-mega="marques"]');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('#mega-marques').hidden, null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(200);
  await page.keyboard.press('Tab');
  const premier = await actif(page);
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await page.waitForFunction(() => document.querySelector('#mega-marques').hidden, null, { timeout: 5000 }).catch(() => {});
  const ferme = await page.evaluate(() => document.querySelector('#mega-marques').hidden);
  check('Méga-menu ouvert au clavier : la tabulation suivante entre dans le panneau, qui se ferme quand le focus le quitte', premier.mega === 'mega-marques' && ferme, JSON.stringify({ premier, ferme }));
  await page.click('#search-open');
  await page.waitForFunction(() => document.querySelector('#search').open && document.activeElement?.id === 'search-q', null, { timeout: 5000 }).catch(() => {});
  const modale = await page.evaluate(() => ({ open: document.querySelector('#search').open, modal: document.querySelector('#search').matches(':modal'), focus: document.activeElement?.id }));
  await page.keyboard.type('menthe');
  await page.waitForTimeout(400);
  const sorties = [];
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    const a = await actif(page);
    if (a.dialog !== 'search' && a.tag !== 'body') sorties.push(a.id || a.tag);
  }
  // un seul Échap, champ rempli : la recherche se ferme (le champ ne se vide pas d'abord)
  await page.focus('#search-q');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#search').open, null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(200);
  const retour = await page.evaluate(() => ({ open: document.querySelector('#search').open, focus: document.activeElement?.id }));
  check('Recherche : fenêtre modale, le focus y reste (14 tabulations), un Échap la ferme et rend le focus au bouton', modale.open && modale.modal && modale.focus === 'search-q' && !sorties.length && !retour.open && retour.focus === 'search-open', JSON.stringify({ modale, sorties, retour }));
  await ctx.close();
  const ctxm = await context('mobile', 'sirops');
  const { page: mm } = await open(ctxm, '/', { wait: 2500, label: 'menu modal' });
  await mm.click('#menu-open');
  await mm.waitForFunction(() => document.querySelector('#menu').open && document.activeElement?.id === 'menu-close', null, { timeout: 5000 }).catch(() => {});
  const m = await mm.evaluate(() => ({ open: document.querySelector('#menu').open, modal: document.querySelector('#menu').matches(':modal'), focus: document.activeElement?.id }));
  const hors = [];
  for (let i = 0; i < 40; i++) {
    await mm.keyboard.press('Tab');
    const a = await actif(mm);
    if (a.dialog !== 'menu' && a.tag !== 'body') hors.push(a.id || a.tag);
  }
  await mm.keyboard.press('Escape');
  await mm.waitForFunction(() => !document.querySelector('#menu').open && document.activeElement?.id === 'menu-open', null, { timeout: 5000 }).catch(() => {});
  const fin = await mm.evaluate(() => ({ open: document.querySelector('#menu').open, focus: document.activeElement?.id }));
  check('Menu du téléphone : fenêtre modale, le focus y reste (40 tabulations), Échap rend le focus au bouton', m.open && m.modal && m.focus === 'menu-close' && !hors.length && !fin.open && fin.focus === 'menu-open', JSON.stringify({ m, hors: hors.slice(0, 5), fin }));
  await ctxm.close();
  // Panier latéral : après « + », le focus reste sur le bouton et la quantité change ; après « − »
  // qui retire une ligne, il passe à la ligne voisine (A11Y-6).
  const ctxp = await context('bureau', 'sirops');
  await ctxp.addInitScript(() => localStorage.setItem('blachere-panier', JSON.stringify({ v: 3, items: [{ slug: 'pac-citron', v: '1000', qty: 2 }, { slug: 'fun-blue', v: '1000', qty: 1 }] })));
  const { page: pp } = await open(ctxp, '/boutique', { wait: 1500, label: 'focus panier latéral' });
  await pp.click('#cart-open');
  await pp.waitForTimeout(600);
  await pp.focus('#cart-list .line[data-slug="pac-citron"] [data-q="1"]');
  await pp.keyboard.press('Enter');
  await pp.waitForFunction(() => document.querySelector('#cart-list .line[data-slug="pac-citron"] output')?.textContent === '3', null, { timeout: 5000 }).catch(() => {});
  const plus = await pp.evaluate(() => ({ q: document.activeElement?.dataset.q, ligne: document.activeElement?.closest('.line')?.dataset.slug, qte: document.querySelector('#cart-list .line[data-slug="pac-citron"] output')?.textContent }));
  await pp.focus('#cart-list .line[data-slug="fun-blue"] [data-q="-1"]');
  await pp.keyboard.press('Enter');
  await pp.waitForFunction(() => document.querySelectorAll('#cart-list .line').length === 1, null, { timeout: 5000 }).catch(() => {});
  const moins = await pp.evaluate(() => ({ q: document.activeElement?.dataset.q, ligne: document.activeElement?.closest('.line')?.dataset.slug, lignes: document.querySelectorAll('#cart-list .line').length, livraison: document.querySelector('#cart-foot [data-livraison]')?.textContent || '' }));
  check('Panier latéral : le focus reste sur « + », passe à la ligne voisine quand une ligne disparaît', plus.q === '1' && plus.ligne === 'pac-citron' && plus.qte === '3' && moins.ligne === 'pac-citron' && moins.q === '-1' && moins.lignes === 1, JSON.stringify({ plus, moins }));
  check('Panier latéral : retrait gratuit et frais de livraison annoncés (franco)', /Retrait gratuit/.test(moins.livraison) && /offerte dès 120,00\s€/.test(moins.livraison), moins.livraison);
  await shot(pp, 'bureau-49-panier-lateral-focus', false);
  await ctxp.close();
}

// ---------- 5. Boutique : compteurs, adresse, variantes ----------
{
  const ctx = await context('bureau', 'majeur');
  const count = async (page) => page.evaluate(() => Number(document.querySelector('#shop-count strong')?.textContent.match(/\d+/)?.[0] || -1));
  const cards = async (page) => page.evaluate(() => document.querySelectorAll('#shop-grid .card:not(.card--locked)').length);
  const cases = [
    ['/boutique', N.tous],
    ['/boutique?univers=sirops', N.sirops],
    ['/boutique?univers=spiritueux', N.spiritueux],
    ['/boutique?gamme=couleur-provence', N.cp],
    ['/boutique?meilleures=1', N.best],
    ['/boutique?contenance=50cl', N.cl50],
  ];
  for (const [path, n] of cases) {
    const { page } = await open(ctx, path, { wait: 1500, label: path });
    const [c, k] = [await count(page), await cards(page)];
    check(`Filtre ${path.replace('/boutique', '') || '(aucun)'} : ${n} produits`, c === n && k === n, `compteur ${c}, cartes ${k}`);
    await page.close();
  }
  {
    const { page } = await open(ctx, '/boutique?q=CHATAIGNE', { wait: 1500, label: 'recherche châtaigne' });
    const slugs = await page.evaluate(() => [...document.querySelectorAll('#shop-grid .card[data-slug]')].map((e) => e.dataset.slug));
    check('Recherche sans accents : « CHATAIGNE » trouve le sirop et la crème de châtaigne', slugs.includes('sirop-chataigne') && slugs.includes('creme-de-chataigne'), slugs.join(', '));
    await page.close();
  }
  const { page } = await open(ctx, '/boutique', { wait: 1500, label: 'boutique filtres' });
  const facet = await page.evaluate(() => Number(document.querySelector('[data-n="gamme:couleur-provence"]')?.textContent));
  await page.check('#filters input[name="gamme"][value="couleur-provence"]');
  await page.waitForTimeout(400);
  const after = await count(page);
  check('Le compteur d’une gamme annonce le bon nombre de résultats', facet === after && after === N.cp, `annoncé ${facet}, obtenu ${after}`);
  await page.check('#filters input[name="arome"][value="agrumes"]');
  await page.waitForTimeout(400);
  const url = page.url();
  check('Adresse synchronisée avec les filtres', /gamme=couleur-provence/.test(url) && /arome=agrumes/.test(url), url.replace(BASE, ''));
  const n1 = await count(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const restored = await page.evaluate(() => document.querySelector('#filters input[name="arome"][value="agrumes"]').checked);
  check('Rechargement : mêmes filtres, même compteur', restored && (await count(page)) === n1, `${n1} produits`);
  await shot(page, 'bureau-34-boutique-filtres-actifs', false);
  await page.click('#shop-chips [data-reset]');
  await page.waitForTimeout(400);
  check('« Tout effacer » vide les filtres et l’adresse', (await count(page)) === N.tous && !/gamme=|arome=/.test(page.url()));
  await page.fill('#shop-q', 'zzzz');
  await page.waitForTimeout(600);
  check('Recherche sans résultat : état vide affiché', await page.evaluate(() => !document.querySelector('#shop-empty').hidden));
  await page.close();
  // Variantes : chaque contenance a son prix (La Camarguaise : 70 cl, 1,5 L, coffret)
  const { page: pv } = await open(ctx, '/boutique/la-camarguaise', { wait: 2500, label: 'variantes' });
  const p0 = await pv.evaluate(() => document.querySelector('.pp__price strong')?.textContent.replace(/\s+/g, ' ').trim());
  await pv.click('.vol:nth-child(2) .vol__in');
  await pv.waitForTimeout(300);
  const p1 = await pv.evaluate(() => document.querySelector('.pp__price strong')?.textContent.replace(/\s+/g, ' ').trim());
  check('Variantes : le prix suit la contenance choisie', p0 === euroQA(prix('la-camarguaise', '700')) && p1 === euroQA(prix('la-camarguaise', '1500')), `${p0} → ${p1}`);
  // Prix au litre (UX-5) : à côté du prix de la fiche et de chaque contenance, sauf en 1 L
  const litre = (slug, id, ml) => euroQA(Math.round(((prix(slug, id) * 1000) / ml) * 100) / 100);
  const u = await pv.evaluate(() => ({ prix: document.querySelector('.pp__unit')?.textContent.replace(/\s+/g, ' ').trim(), vols: [...document.querySelectorAll('.vol__unit')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()) }));
  check('Fiche : prix au litre de la contenance choisie et de chaque contenance', u.prix === `soit ${litre('la-camarguaise', '1500', 1500)} le litre` && u.vols.includes(`${litre('la-camarguaise', '700', 700)}/L le litre`), JSON.stringify(u));
  // Frais de port dès la fiche (UX-4) : barème de démonstration (1 bouteille : 7,90 € en point relais, 9,90 € à domicile)
  await pv.click('.vol:nth-child(1) .vol__in');
  await pv.waitForTimeout(900);
  const port1 = await pv.evaluate(() => document.querySelector('#pp-ship')?.textContent.replace(/\s+/g, ' ').trim() || '');
  await pv.click('[data-step="1"]');
  await pv.click('[data-step="1"]');
  await pv.waitForTimeout(900);
  const port3 = await pv.evaluate(() => document.querySelector('#pp-ship')?.textContent.replace(/\s+/g, ' ').trim() || '');
  check('Fiche : frais de livraison visibles, suivant la quantité (barème de démonstration)', /7,90 € en point relais, 9,90 € à domicile/.test(port1) && /Retrait gratuit/.test(port1) && /3 bouteilles : 12,90 € en point relais, 14,90 € à domicile/.test(port3), `${port1} | ${port3}`);
  await shot(pv, 'bureau-35-fiche-variantes', false);
  // Cartes : prix au litre sous le prix (La Camarguaise, 70 cl), aucun pour un litre (PAC Citron)
  {
    const { page: pc } = await open(ctx, '/boutique', { wait: 1800, label: 'prix au litre cartes' });
    const c = await pc.evaluate(() => ({
      camarguaise: document.querySelector('.card[data-slug="la-camarguaise"] .card__unit')?.textContent.replace(/\s+/g, ' ').trim(),
      pac: document.querySelector('.card[data-slug="pac-citron"] .card__unit')?.textContent || null,
      n: document.querySelectorAll('.card__unit').length,
    }));
    const attendu = `${euroQA(Math.round(((prix('la-camarguaise', '700') * 1000) / 700) * 100) / 100)}/L le litre`;
    check('Cartes : prix au litre sous le prix (sauf en 1 L)', c.camarguaise === attendu && c.pac === null && c.n > 20, JSON.stringify(c));
    await pc.close();
  }
  await ctx.close();
  const ctxm = await context('mobile', 'sirops');
  const { page: pm } = await open(ctxm, '/boutique', { wait: 1500, label: 'boutique mobile' });
  await pm.click('#filters-open');
  await pm.waitForTimeout(600);
  check('Téléphone : le panneau de filtres s’ouvre', await pm.evaluate(() => document.querySelector('#filter-sheet').open));
  await shot(pm, 'mobile-32-boutique-panneau-filtres', false);
  await ctxm.close();
}

// ---------- 6. Panier : totaux, case 18 ans, CGV, commande ----------
{
  const ctx = await context('bureau', 'majeur');
  const { page } = await open(ctx, '/boutique/pac-citron', { wait: 3000, label: 'fiche PAC' });
  await page.click('[data-step="1"]');
  await page.click('.pp__add');
  await page.waitForTimeout(700);
  await shot(page, 'bureau-36-panier-lateral', false);
  for (const s of ['fun-blue', 'pastis-marra']) {
    await page.goto(`${BASE}/boutique/${s}?test`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.click('.pp__add');
    await page.waitForTimeout(500);
  }
  const t = await page.evaluate(() => JSON.parse(localStorage.getItem('blachere-panier') || 'null'));
  check('Panier gardé dans le navigateur (3 lignes, avec la variante)', t?.items?.length === 3 && t.items.every((i) => i.v), JSON.stringify(t?.items));
  await page.goto(`${BASE}/panier?test`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const expected = 2 * prix('pac-citron', '1000') + prix('fun-blue', '1000') + prix('pastis-marra', catalogue.find((p) => p.slug === 'pastis-marra').contenances[0].id);
  const sub = await page.evaluate(() => document.querySelector('[data-subtotal]')?.textContent.replace(/\s+/g, ' ').trim());
  check(`Sous-total : ${euroQA(expected)}`, sub === euroQA(expected), sub);
  await shot(page, 'bureau-37-panier', true);
  await page.click('[data-next]');
  await page.waitForTimeout(500);
  await page.fill('[name="prenom"]', 'Camille');
  await page.fill('[name="nom"]', 'Martin');
  await page.fill('[name="email"]', 'camille.martin@example.com');
  await page.fill('[name="tel"]', '06 12 34 56 78');
  await page.click('#co-form button[type="submit"]');
  await page.waitForTimeout(500);
  const blocked = await page.evaluate(() => /etape=coordonnees/.test(location.search) && (document.querySelector('[data-err="majeur"]')?.textContent || '').length > 5);
  check('Sans la case « J’ai 18 ans ou plus », la commande ne passe pas', blocked);
  await page.check('[name="majeur"]');
  await page.click('#co-form button[type="submit"]');
  await page.waitForTimeout(500);
  await page.check('input[name="mode"][value="livraison"]');
  await page.fill('[name="adresse"]', '1 rue des Lices');
  await page.fill('[name="cp"]', '84000');
  await page.fill('[name="ville"]', 'Avignon');
  await shot(page, 'bureau-38-commande-livraison', false);
  await page.click('#co-form button[type="submit"]');
  await page.waitForTimeout(500);
  check('Livraison : récapitulatif atteint', /etape=recapitulatif/.test(page.url()));
  const cgvNote = await page.evaluate(() => /quatorze jours/.test(document.querySelector('.co-recap')?.textContent || ''));
  check('Récapitulatif : rétractation et casse selon les CGV officielles', cgvNote);
  await shot(page, 'bureau-39-commande-recapitulatif', true);
  await page.click('[data-next]');
  await page.waitForTimeout(500);
  check('Paiement : bandeau « vente interdite aux mineurs »', await page.evaluate(() => /Vente interdite aux mineurs/i.test(document.querySelector('.co-mineurs')?.textContent || '')));
  check('Paiement : carte, PayPal et virement (CGV officielles)', await page.evaluate(() => ['carte', 'paypal', 'virement'].every((v) => document.querySelector(`input[name="paiement"][value="${v}"]`))));
  await page.click('#pay');
  await page.waitForTimeout(500);
  check('Sans accepter les CGV, le paiement ne passe pas', await page.evaluate(() => !document.querySelector('.co-done') && /conditions générales/.test(document.querySelector('#co-msg')?.textContent || '')));
  await page.check('[name="cgv"]');
  await shot(page, 'bureau-40-commande-paiement', false);
  await page.click('#pay');
  await page.waitForTimeout(800);
  check('Paiement simulé : confirmation affichée', await page.evaluate(() => !!document.querySelector('.co-done')));
  await shot(page, 'bureau-41-commande-confirmation', false);
  await ctx.close();
  const ctx2 = await context('bureau', 'mineur');
  await ctx2.addInitScript(() => localStorage.setItem('blachere-panier', JSON.stringify({ v: 3, items: [{ slug: 'pastis-marra', v: '700', qty: 1 }, { slug: 'pac-citron', v: '1000', qty: 1 }] })));
  const { page: p2 } = await open(ctx2, '/panier', { wait: 1500, label: 'panier mineur' });
  const left = await p2.evaluate(() => [...document.querySelectorAll('[data-slug]')].map((e) => e.dataset.slug));
  check('Mineur : les spiritueux sont retirés du panier', !left.includes('pastis-marra') && left.includes('pac-citron'), left.join(', '));
  await ctx2.close();
}

// ---------- 7. Formulaires, archives, recettes ----------
{
  const ctx = await context('bureau', 'sirops');
  const { page } = await open(ctx, '/visiter', { wait: 1500, label: 'visiter' });
  await page.click('#booking button[type="submit"]');
  await page.waitForTimeout(300);
  check('Réservation : une erreur sous chaque champ à corriger, reliée au champ, et un résumé', await page.evaluate(() => {
    const inv = [...document.querySelectorAll('#booking [aria-invalid="true"]')];
    const relies = inv.filter((el) => (el.getAttribute('aria-describedby') || '').split(/\s+/).some((id) => (document.getElementById(id)?.textContent || '').trim().length > 3));
    return document.querySelector('#booking-err').textContent.length > 10 && inv.length >= 3 && relies.length === inv.length;
  }));
  const day = await page.evaluate(() => {
    const d = new Date(document.querySelector('[name="date"]').min);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  await page.fill('[name="date"]', day);
  await page.fill('[name="nom"]', 'Camille Martin');
  await page.fill('[name="email"]', 'camille.martin@example.com');
  await page.fill('[name="mineurs"]', '1');
  await page.check('[name="rgpd"]');
  await page.click('#booking button[type="submit"]');
  await page.waitForTimeout(500);
  check('Réservation : confirmation, rien n’est envoyé', await page.evaluate(() => /rien n’a été envoyé/.test(document.querySelector('#booking-card').textContent)));
  await page.locator('#reserver').scrollIntoViewIfNeeded();
  await shot(page, 'bureau-42-visite-confirmation', false);
  const { page: pro } = await open(ctx, '/espace-pro', { wait: 1200, label: 'pro' });
  await pro.fill('#pro-form [name="societe"]', 'Café des Platanes');
  await pro.selectOption('#pro-form [name="activite"]', { index: 1 });
  await pro.fill('#pro-form [name="nom"]', 'Camille Martin');
  await pro.fill('#pro-form [name="ville"]', 'Avignon');
  await pro.fill('#pro-form [name="email"]', 'contact@example.com');
  await pro.fill('#pro-form [name="siret"]', '123');
  await pro.check('#pro-form [name="rgpd"]');
  await pro.click('#pro-form button[type="submit"]');
  await pro.waitForTimeout(300);
  check('Espace pro : SIRET invalide refusé, erreur sous le champ (aria-invalid, aria-describedby)', await pro.evaluate(() => {
    const champ = document.querySelector('#pro-form [name="siret"]');
    const err = document.getElementById('err-pro-siret');
    return /14\s+chiffres/.test(err?.textContent || '') && champ.getAttribute('aria-invalid') === 'true' && (champ.getAttribute('aria-describedby') || '').split(' ').includes('err-pro-siret') && document.querySelector('#pro-msg').textContent.length > 5;
  }));
  await pro.fill('#pro-form [name="siret"]', '');
  await pro.click('#pro-form button[type="submit"]');
  await pro.waitForTimeout(300);
  check('Espace pro : demande confirmée, rien n’est envoyé', await pro.evaluate(() => !!document.querySelector('#pro-done')));
  await shot(pro, 'bureau-43-espace-pro-confirmation', false);
  const { page: mu } = await open(ctx, '/musee#pac-1962', { wait: 2000, label: 'archives pièce' });
  check('Archives : la pièce de l’adresse est désignée', await mu.evaluate(() => document.getElementById('pac-1962')?.classList.contains('is-target')));
  await mu.click('#pac-1962 .piece__frame');
  await mu.waitForTimeout(600);
  check('Archives : la pièce s’ouvre en grand avec son cartel', await mu.evaluate(() => document.querySelector('#mus-dialog').open && /Tampon/.test(document.querySelector('#mus-dialog-cartel').textContent)));
  await shot(mu, 'bureau-44-archives-piece', false);
  const { page: rc } = await open(ctx, '/recettes', { wait: 1500, label: 'recettes' });
  const nr = await rc.evaluate(() => document.querySelectorAll('#rec-grid .rcard').length);
  check(`Recettes : ${recettes.filter((r) => !r.alcool).length} recettes sans alcool par défaut`, nr === recettes.filter((r) => !r.alcool).length, `${nr}`);
  const { page: ot } = await open(ctx, '/ou-trouver', { wait: 1200, label: 'où trouver' });
  await ot.fill('#ot-q', 'paris');
  await ot.waitForTimeout(500);
  const otn = await ot.evaluate(() => [...document.querySelectorAll('.pdv__nom')].map((e) => e.textContent));
  check('Où trouver : recherche par ville (Paris → Les Caves du Roy)', otn.length === 1 && /Caves du Roy/.test(otn[0]), otn.join(', '));
  await ctx.close();
}

// ---------- 8. Marques : logotypes dans les titres, police de marque dans le texte ----------
{
  const ctx = await context('bureau', 'sirops');
  const { page } = await open(ctx, '/pac-citron', { wait: 2500, label: 'marques' });
  const r = await page.evaluate(() => ({
    h1: !!document.querySelector('h1 .wm--pac'),
    texte: document.querySelectorAll('p .marque--pac').length,
    font: getComputedStyle(document.querySelector('p .marque--pac') || document.body).fontFamily,
    couleur: getComputedStyle(document.querySelector('p .marque--pac') || document.body).color,
  }));
  check('PAC Citron : logotype dans le titre, Lobster Two en couleur dans le texte', r.h1 && r.texte > 2 && /Lobster/.test(r.font), JSON.stringify(r));
  const { page: b } = await open(ctx, '/boutique', { wait: 2000, label: 'marques boutique' });
  const c = await b.evaluate(() => ({ cards: document.querySelectorAll('.card__name .wm').length, chips: document.querySelectorAll('.cat .marque').length }));
  check('Boutique : logotypes dans les noms de produits, police de marque dans les rayons', c.cards >= 2 && c.chips >= 2, JSON.stringify(c));
  await ctx.close();
}

// ---------- 9. Une personne mineure ne voit aucun alcool ----------
{
  const FORBIDDEN = /Marra|Camarguais|Camarguaise|Lou Gardian|Verveine « Auguste|Ardéchoise|Flirt|Légats|Legats|Gros Calan|Origan|Comtadine|Magistrale|Bronzini|Elixir|Élixir|pastis|liqueur|eaux?-de-vie|vieux marc|Mauresque|Tequila|bière|arquebuse|millésime/i;
  const SLUGS = ALCOOLS.map((p) => p.slug);
  const RECIPES = recettes.filter((r) => r.alcool).map((r) => `#${r.id}`);
  const paths = ['/', '/pac-citron', '/fun-blue', '/couleur-provence', '/recettes', '/spiritueux', '/la-maison', '/musee', '/visiter', '/boutique', '/boutique?univers=spiritueux', '/boutique/pastis-marra', '/boutique/sirop-anis', '/boutique/sirop-couleur-provence-grenadine', '/boutique/pac-citron', '/ou-trouver', '/actualites', '/panier'];
  const ctx = await context('bureau', 'mineur');
  let all = true;
  for (const path of paths) {
    const { page } = await open(ctx, path, { wait: 1800, label: `mineur ${path}` });
    const found = await page.evaluate(
      ({ re, slugs, recipes }) => {
        const rx = new RegExp(re, 'i');
        const texts = [document.body.innerText, ...[...document.querySelectorAll('[aria-label],[alt],[title]')].filter((e) => e.offsetParent || e.getClientRects().length).map((e) => `${e.getAttribute('aria-label') || ''} ${e.getAttribute('alt') || ''} ${e.getAttribute('title') || ''}`)];
        const hits = texts.join('\n').match(rx);
        const links = [...document.querySelectorAll('a[href], [data-slug], [data-add]')]
          .filter((e) => e.getClientRects().length)
          .map((e) => e.getAttribute('href') || e.dataset.slug || e.dataset.add)
          .filter((h) => slugs.some((s) => h === s || h.endsWith(`/${s}`) || h.includes(`/${s}?`)) || recipes.some((r) => h.endsWith(r)));
        return { text: hits ? hits[0] : null, links };
      },
      { re: FORBIDDEN.source, slugs: SLUGS, recipes: RECIPES },
    );
    const ok = !found.text && !found.links.length;
    all &&= ok;
    if (!ok) check(`Mineur, ${path} : aucun alcool visible`, false, `${found.text || ''} ${found.links.join(' ')}`);
    if (['/', '/spiritueux', '/boutique', '/musee', '/la-maison', '/recettes'].includes(path)) await shot(page, `mineur-${path.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'accueil'}`, false);
    await page.close();
  }
  check(`Mineur : aucun nom, lien ou visuel d’alcool sur ${paths.length} pages`, all);
  await ctx.close();
}

// ---------- 9 bis. Message sanitaire : une fois par ensemble de cartes (README, règle 4) ----------
// Plus de mention sous chaque carte : toute section qui montre des cartes d'alcool (data-alcool)
// porte le message sanitaire (bande du rayon Spiritueux de la boutique, ligne sous le carrousel de
// l'accueil et sous chaque rayon de la page Spiritueux). Dans la boutique, la bande reste collée
// sous l'en-tête tant que des spiritueux sont à l'écran, et n'apparaît pas devant les sirops.
{
  const EVIN = 'L’abus d’alcool est dangereux pour la santé, à consommer avec modération.';
  const ctx = await context('mobile', 'majeur');
  const attendu = { '/': true, '/boutique': true, '/boutique?univers=spiritueux': true, '/boutique?q=marc': true, '/spiritueux': true, '/boutique/pastis-marra': true, '/couleur-provence': false, '/boutique/pac-citron': false };
  const vues = [];
  for (const path of Object.keys(attendu)) {
    const { page } = await open(ctx, path, { wait: 1500, label: `message sanitaire ${path}` });
    const v = await page.evaluate((evin) => {
      const cartes = [...document.querySelectorAll('.card[data-alcool]')];
      const sections = [...new Set(cartes.map((c) => c.closest('section')))];
      const porte = (s) => !!s && [...s.querySelectorAll('p, span, div')].some((e) => !e.closest('.card') && e.getClientRects().length > 0 && e.textContent.includes(evin));
      return { cartes: cartes.length, sections: sections.length, sans: sections.filter((s) => !porte(s)).map((s) => s?.id || s?.className || 'hors section'), parCarte: document.querySelectorAll('.card .evin, .card__evin').length };
    }, EVIN);
    vues.push({ path, ...v });
    await page.close();
  }
  await ctx.close();
  const fautes = vues.filter((v) => v.sans.length || v.parCarte || !v.cartes !== !attendu[v.path]);
  check(
    `Message sanitaire une fois par section qui montre un alcool, aucun sous les cartes (${vues.length} pages)`,
    !fautes.length,
    (fautes.length ? fautes : vues).map((v) => `${v.path} : ${v.cartes} cartes d’alcool, ${v.sections} section(s)${v.sans.length ? `, sans message : ${v.sans.join(', ')}` : ''}${v.parCarte ? `, ${v.parCarte} sous les cartes` : ''}`).join(' ; '),
  );
  for (const vp of ['mobile', 'bureau']) {
    const c = await context(vp, 'majeur');
    const { page } = await open(c, '/boutique', { wait: 1500, label: `bande sanitaire ${vp}` });
    // la bande, une fois la carte voulue au milieu de l'écran (l'en-tête réduit suit le défilement)
    const bandeDevant = (sel) =>
      page.evaluate(async (s) => {
        document.querySelector(s)?.scrollIntoView({ block: 'center' });
        await new Promise((r) => setTimeout(r, 500));
        const b = document.querySelector('.shop-evin')?.getBoundingClientRect();
        const hd = document.querySelector('.hd__main').getBoundingClientRect();
        return b ? { haut: Math.round(b.top), entete: Math.round(hd.bottom), ecran: innerHeight } : null;
      }, sel);
    const milieu = await bandeDevant('.shop-group--spiritueux .card:nth-child(13)');
    if (vp === 'mobile') await shot(page, 'mobile-50-boutique-bande-sanitaire', false);
    const sirops = await bandeDevant('.shop-group--sirops .card');
    check(`${vp} : bande du message sanitaire collée sous l’en-tête au milieu des spiritueux, absente de l’écran devant les sirops`, !!milieu && Math.abs(milieu.haut - milieu.entete) <= 2 && !!sirops && sirops.haut >= sirops.ecran, JSON.stringify({ milieu, sirops }));
    await c.close();
  }
}

// ---------- 10. 404, robots.txt ----------
{
  const ctx = await context('bureau', 'sirops');
  const page = await ctx.newPage();
  const res = await page.goto(`${BASE}/cette-page-n-existe-pas`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  check('Adresse inconnue : page 404 (statut 404)', res.status() === 404 && /introuvable/i.test(await page.title()), `statut ${res.status()}`);
  await shot(page, 'bureau-45-404', false);
  const robots = await (await page.goto(`${BASE}/robots.txt`)).text();
  check('robots.txt : Disallow: /', /Disallow:\s*\//.test(robots));
  const old = await page.goto(`${BASE}/la-distillerie`, { waitUntil: 'networkidle' });
  check('Ancienne adresse /la-distillerie servie par la page La maison', old.status() === 200 && /La maison/.test(await page.title()));
  await ctx.close();
}

// ---------- 10 bis. Balises, cache des images, feuille de la pastille (SEO-3, PERF-5, PERF-8, PERF-9) ----------
{
  const ctx = await context('bureau', 'sirops');
  const vues = {};
  for (const path of ['/boutique', '/boutique/pac-citron', '/panier']) {
    const { page } = await open(ctx, path, { wait: 1500, label: `balises ${path}` });
    vues[path] = await page.evaluate(() => {
      const css = performance.getEntriesByType('resource').find((e) => /proposition\.css/.test(e.name));
      return {
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
        ogUrl: document.querySelector('meta[property="og:url"]')?.content || '',
        ogDescription: (document.querySelector('meta[property="og:description"]')?.content || '').length,
        robots: document.querySelector('meta[name="robots"]')?.content || '',
        archivo: !!document.querySelector('link[rel="preload"][as="font"]'),
        feuille: css?.renderBlockingStatus || 'inconnu',
        media: document.querySelector('link[href*="/v2x/proposition.css"]')?.media || '',
        pastille: !!document.querySelector('.v2x .v2x-pastille'),
      };
    });
    await page.close();
  }
  const attendu = { '/boutique': '/boutique', '/boutique/pac-citron': '/boutique/pac-citron', '/panier': '/panier' };
  const mauvaises = Object.entries(vues).filter(([path, v]) => !v.canonical.endsWith(attendu[path]) || !v.ogUrl.endsWith(attendu[path]) || v.ogDescription < 40 || !/noindex/.test(v.robots) || !v.archivo);
  check('Boutique, fiche et panier : canonical, og:url, og:description, noindex gardé, Archivo préchargée', !mauvaises.length, JSON.stringify(mauvaises.length ? mauvaises : vues['/boutique/pac-citron']));
  const pastilles = Object.entries(vues).filter(([, v]) => v.feuille !== 'non-blocking' || v.media !== 'all' || !v.pastille);
  check('Feuille de la pastille V2X sans blocage du rendu, pastille insérée une fois la feuille chargée', !pastilles.length, JSON.stringify(pastilles.length ? pastilles : vues['/boutique']));
  await ctx.close();
  const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  const regle = (vercel.headers || []).find((h) => /bouteilles/.test(h.source));
  const dossiers = ['bouteilles', 'archives', 'archives-tailles', 'rendus', 'recettes', 'lieux', 'logos', 'marques'];
  const valeur = regle?.headers.find((x) => x.key === 'Cache-Control')?.value;
  check('vercel.json : images statiques en cache un jour (revalidées en arrière-plan une semaine)', !!regle && dossiers.every((d) => new RegExp(`^${regle.source.replace(/\(\.\*\)/g, '.*')}$`).test(`/${d}/x.webp`)) && valeur === 'public, max-age=86400, stale-while-revalidate=604800', `${regle?.source} → ${valeur}`);
}

// ---------- 10 ter. Impression (QUAL-7) ----------
// Fiche imprimée : l'en-tête une fois, ni outils ni lettre d'information ni bouton d'achat, la photo
// de la bouteille, les accordéons ouverts (refermés après), aucun texte blanc, la pastille et la
// ligne « Maquette non officielle » à la fin ; 5 pages A4 au lieu de 6 incomplètes ; recettes en
// 13 pages au lieu de 45.
{
  const ctx = await context('bureau', 'sirops');
  const imprimer = async (path) => {
    const { page } = await open(ctx, path, { wait: 2000, label: `impression ${path}` });
    await page.evaluate(() => Promise.all([...document.images].map((i) => ((i.loading = 'eager'), i.decode().catch(() => {})))));
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => dispatchEvent(new Event('beforeprint')));
    const v = await page.evaluate(() => {
      const vu = (s) => [...document.querySelectorAll(s)].some((e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden');
      return {
        entete: getComputedStyle(document.querySelector('.hd')).position,
        outils: vu('.hd__tools'),
        lettre: vu('.ft__news'),
        achat: vu('.pp__row'),
        photo: !!document.querySelector('.pp__poster') && getComputedStyle(document.querySelector('.pp__poster')).opacity === '1' && vu('.pp__poster img'),
        fermes: document.querySelectorAll('main details:not([open])').length,
        pastille: document.querySelector('.v2x') ? getComputedStyle(document.querySelector('.v2x')).position : 'absente',
        legal: vu('.ft__legal'),
        blanc: [...document.querySelectorAll('body *')].filter((e) => e.getClientRects().length && getComputedStyle(e).color === 'rgb(255, 255, 255)' && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).length,
      };
    });
    const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true });
    v.pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    await page.evaluate(() => dispatchEvent(new Event('afterprint')));
    await page.emulateMedia({ media: 'screen' });
    v.refermes = await page.evaluate(() => document.querySelectorAll('main details:not([open])').length);
    await page.close();
    return v;
  };
  const f = await imprimer('/boutique/pac-citron');
  check('Impression de la fiche : en-tête une fois, ni outils ni lettre ni achat, photo, accordéons ouverts, pastille et mentions à la fin, 6 pages au plus', f.entete === 'static' && !f.outils && !f.lettre && !f.achat && f.photo && f.fermes === 0 && f.refermes > 0 && f.pastille === 'static' && f.legal && f.blanc === 0 && f.pages <= 6, JSON.stringify(f));
  const rec = await imprimer('/recettes');
  check('Impression des recettes : 16 pages au plus (45 auparavant), aucun texte blanc', rec.pages <= 16 && rec.blanc === 0 && rec.legal, JSON.stringify(rec));
  await ctx.close();
}

check('Aucune erreur dans la console', consoleErrors.length === 0, consoleErrors.slice(0, 8).join(' | '));

await browser.close();
server.kill();
const failed = results.filter((r) => !r.ok);
writeFileSync(join(OUT, 'recette.json'), `${JSON.stringify({ date: new Date().toISOString(), ok: !failed.length, results, consoleErrors }, null, 2)}\n`);
console.log(`\n${results.length - failed.length}/${results.length} vérifications réussies · captures dans ${OUT}`);
process.exit(failed.length ? 1 : 0);
