#!/usr/bin/env node
// Recette de la maquette : lance « vite preview » sur le build (dist/), parcourt toutes les pages
// et leurs états avec Chromium (Playwright), prend les captures (bureau 1440 × 900, téléphone
// 390 × 844) et vérifie :
//   - aucune erreur dans la console ni dans la page ;
//   - aucun défilement horizontal à 390 px ;
//   - les compteurs des filtres, la synchronisation de l'adresse, la remise à zéro ;
//   - les totaux du panier, la case « 18 ans » obligatoire, le parcours de commande ;
//   - qu'une personne mineure ne voit aucun alcool (texte, libellés, liens) ;
//   - la page 404 (statut 404) et la balise noindex.
//
//   npm run build && node scripts/qa.mjs [--sortie <dossier>] [--port 4173]
//
// Playwright n'est pas une dépendance du projet : le script utilise l'installation globale
// (PLAYWRIGHT_MODULE, par défaut /opt/node22/lib/node_modules/playwright) et le Chromium
// préinstallé (PLAYWRIGHT_CHROMIUM, par défaut /opt/pw-browsers/chromium), avec SwiftShader
// pour WebGL. Ne lance jamais « playwright install ».
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const OUT = resolve(opt('sortie', join(root, '.cache/qa')));
const PORT = Number(opt('port', 4173));
const BASE = `http://localhost:${PORT}`;
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');

if (!existsSync(join(root, 'dist/index.html'))) {
  console.error('Lancez d’abord « npm run build ».');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` · ${detail}` : ''}`);
};
const consoleErrors = [];

// ---------- Serveur ----------
// Vite lancé directement (et non par npx) pour que l'arrêt en fin de recette arrête bien le serveur.
const server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
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
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
};

// Contexte avec une réponse d'âge déjà donnée ('majeur' → localStorage, sinon sessionStorage).
async function context(vp, age = 'sirops') {
  const { width, height, ...rest } = VIEWPORTS[vp];
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: rest.deviceScaleFactor || 1, isMobile: !!rest.isMobile, hasTouch: !!rest.hasTouch, locale: 'fr-FR' });
  await ctx.addInitScript((a) => {
    try {
      if (a === 'majeur') localStorage.setItem('blachere-age', 'majeur');
      else if (a) sessionStorage.setItem('blachere-age', a);
    } catch {}
  }, age);
  return ctx;
}

async function open(ctx, path, { wait = 2500, label = path } = {}) {
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(`${label} : ${m.text()}`));
  page.on('pageerror', (e) => consoleErrors.push(`${label} : ${e.message}`));
  const sep = path.includes('?') ? '&' : '?';
  const [p, hash] = path.split('#');
  const res = await page.goto(`${BASE}${p}${p.includes('?') ? sep : '?'}test${hash ? `#${hash}` : ''}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(wait);
  return { page, res };
}

const shot = (page, name, full = true) => page.screenshot({ path: join(OUT, `${name}.png`), fullPage: full, timeout: 120000 });

// ---------- 1. Toutes les pages, bureau et téléphone ----------
const PAGES = [
  ['01-accueil', '/', false],
  ['02-pac-citron', '/pac-citron'],
  ['03-fun-blue', '/fun-blue'],
  ['04-couleur-provence', '/couleur-provence'],
  ['05-recettes', '/recettes'],
  ['06-spiritueux', '/spiritueux', true, 'majeur'],
  ['07-la-maison', '/la-maison'],
  ['08-musee', '/musee', true, 'majeur'],
  ['09-visiter', '/visiter'],
  ['10-boutique', '/boutique', true, 'majeur'],
  ['11-fiche-pac-citron', '/boutique/pac-citron'],
  ['12-fiche-fun-blue', '/boutique/fun-blue'],
  ['13-fiche-pastis-marra', '/boutique/pastis-marra', true, 'majeur'],
  ['14-ou-trouver', '/ou-trouver'],
  ['15-actualites', '/actualites'],
  ['16-espace-pro', '/espace-pro'],
  ['17-mentions-legales', '/mentions-legales'],
  ['18-panier-vide', '/panier'],
];

for (const vp of ['bureau', 'mobile']) {
  for (const [name, path, full = true, age = 'sirops'] of PAGES) {
    const ctx = await context(vp, age);
    const { page } = await open(ctx, path, { wait: path === '/' ? 6000 : 3500, label: `${vp} ${path}` });
    const m = await page.evaluate(() => ({
      over: document.documentElement.scrollWidth - innerWidth,
      title: document.title,
      robots: document.querySelector('meta[name="robots"]')?.content || '',
    }));
    if (vp === 'mobile') check(`${path} : pas de défilement horizontal à 390 px`, m.over <= 0, m.over > 0 ? `${m.over} px de trop` : '');
    if (vp === 'bureau') check(`${path} : titre et noindex`, m.title && /noindex/.test(m.robots), m.title);
    await shot(page, `${vp}-${name}`, full);
    if (path === '/') {
      // Gros plan et sections de l'accueil, écran par écran.
      const H = await page.evaluate(() => document.querySelector('#gros-plan').offsetTop);
      const L = await page.evaluate(() => document.querySelector('#gros-plan').offsetHeight - innerHeight);
      for (const [k, y] of [['a-pac', H + L * 0.08], ['b-rituel', H + L * 0.25], ['c-fun-blue', H + L * 0.6], ['d-blue-mojito', H + L * 0.95]]) {
        await page.evaluate((t) => scrollTo(0, t), y);
        await page.waitForTimeout(2500);
        await shot(page, `${vp}-01-accueil-${k}`, false);
      }
      await page.evaluate(() => scrollTo(0, document.querySelector('.tshirt').offsetTop));
      await page.waitForTimeout(800);
      const rest = await page.evaluate(() => [...document.querySelectorAll('main > section:not(.hero):not(.story)')].map((s) => s.id || s.className.split(' ')[0]));
      for (const [i, id] of rest.entries()) {
        await page.evaluate((k) => [...document.querySelectorAll('main > section:not(.hero):not(.story)')][k].scrollIntoView(), i);
        await page.waitForTimeout(700);
        await shot(page, `${vp}-01-accueil-e${i + 1}-${id}`, false);
      }
    }
    await ctx.close();
  }
}

// ---------- 2. Porte d'âge ----------
{
  const ctx = await context('bureau', null);
  const { page } = await open(ctx, '/', { wait: 3000, label: 'porte d’âge' });
  const open1 = await page.evaluate(() => document.querySelector('#gate')?.open);
  check('Première visite : la date de naissance est demandée', open1);
  await shot(page, 'bureau-19-porte-age', false);
  await page.fill('[name="jour"]', '12');
  await page.fill('[name="mois"]', '05');
  await page.fill('[name="annee"]', String(new Date().getFullYear() - 15));
  await page.click('.gate__go');
  await page.waitForTimeout(500);
  const no = await page.evaluate(() => ({ visible: !document.querySelector('#gate-no').hidden, age: document.documentElement.dataset.age }));
  check('Moins de 18 ans : message et état « mineur »', no.visible && no.age === 'mineur');
  await shot(page, 'bureau-20-porte-age-mineur', false);
  await ctx.close();
  const ctx2 = await context('mobile', null);
  const { page: p2 } = await open(ctx2, '/boutique', { wait: 2500, label: 'porte d’âge mobile' });
  await shot(p2, 'mobile-19-porte-age', false);
  await p2.click('#gate-skip');
  await p2.waitForTimeout(400);
  const skip = await p2.evaluate(() => ({ open: document.querySelector('#gate').open, alcohol: document.querySelectorAll('.card:not(.card--locked) .card__evin').length }));
  check('« Continuer avec les sirops seulement » : aucun spiritueux affiché', !skip.open && skip.alcohol === 0);
  await ctx2.close();
}

// ---------- 3. Boutique : compteurs, adresse, remise à zéro ----------
{
  const ctx = await context('bureau', 'majeur');
  const count = async (page) => page.evaluate(() => Number(document.querySelector('#shop-count strong')?.textContent.match(/\d+/)?.[0] || -1));
  const cards = async (page) => page.evaluate(() => document.querySelectorAll('#shop-grid .card:not(.card--locked)').length);
  const cases = [
    ['/boutique', 35],
    ['/boutique?univers=sirops', 28],
    ['/boutique?univers=spiritueux', 7],
    ['/boutique?gamme=couleur-provence', 26],
    ['/boutique?meilleures=1', 2],
    ['/boutique?contenance=50cl', 1],
    ['/boutique?q=chataigne', 1],
  ];
  for (const [path, n] of cases) {
    const { page } = await open(ctx, path, { wait: 1500, label: path });
    const [c, k] = [await count(page), await cards(page)];
    check(`Filtre ${path.replace('/boutique', '') || '(aucun)'} : ${n} produits`, c === n && k === n, `compteur ${c}, cartes ${k}`);
    await page.close();
  }
  // Recherche sans accents ni majuscules : « REGLISSE » trouve le sirop de réglisse (et la famille
  // « Anis & réglisse »).
  {
    const { page } = await open(ctx, '/boutique?q=REGLISSE&univers=sirops', { wait: 1500, label: 'recherche réglisse' });
    const slugs = await page.evaluate(() => [...document.querySelectorAll('#shop-grid .card[data-slug]')].map((e) => e.dataset.slug));
    check('Recherche sans accents : « REGLISSE » trouve le sirop de réglisse', slugs.includes('sirop-couleur-provence-reglisse'), slugs.join(', '));
    await page.close();
  }
  // Compteur d'une option = résultat obtenu en la cochant ; adresse synchronisée ; rechargement.
  const { page } = await open(ctx, '/boutique', { wait: 1500, label: 'boutique filtres' });
  const facet = await page.evaluate(() => Number(document.querySelector('[data-n="gamme:couleur-provence"]')?.textContent));
  await page.check('#filters input[name="gamme"][value="couleur-provence"]');
  await page.waitForTimeout(400);
  const after = await count(page);
  check('Le compteur d’une gamme annonce le bon nombre de résultats', facet === after && after === 26, `annoncé ${facet}, obtenu ${after}`);
  await page.check('#filters input[name="arome"][value="agrumes"]');
  await page.waitForTimeout(400);
  const url = page.url();
  check('Adresse synchronisée avec les filtres', /gamme=couleur-provence/.test(url) && /arome=agrumes/.test(url), url.replace(BASE, ''));
  const n1 = await count(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const restored = await page.evaluate(() => document.querySelector('#filters input[name="arome"][value="agrumes"]').checked);
  check('Rechargement : mêmes filtres, même compteur', restored && (await count(page)) === n1, `${n1} produits`);
  await shot(page, 'bureau-21-boutique-filtres-actifs', false);
  await page.click('#shop-chips [data-reset]');
  await page.waitForTimeout(400);
  check('« Tout effacer » vide les filtres et l’adresse', (await count(page)) === 35 && !/gamme=|arome=/.test(page.url()));
  await page.fill('#shop-q', 'zzzz');
  await page.waitForTimeout(600);
  check('Recherche sans résultat : état vide affiché', await page.evaluate(() => !document.querySelector('#shop-empty').hidden));
  await shot(page, 'bureau-22-boutique-vide', false);
  await ctx.close();
  // Panneau de filtres sur téléphone
  const ctxm = await context('mobile', 'sirops');
  const { page: pm } = await open(ctxm, '/boutique', { wait: 1500, label: 'boutique mobile' });
  await pm.click('#filters-open');
  await pm.waitForTimeout(600);
  check('Téléphone : le panneau de filtres s’ouvre', await pm.evaluate(() => document.querySelector('#filter-sheet').open));
  await shot(pm, 'mobile-21-boutique-panneau-filtres', false);
  await ctxm.close();
}

// ---------- 4. Panier : totaux, case 18 ans, commande ----------
{
  const ctx = await context('bureau', 'majeur');
  const { page } = await open(ctx, '/boutique/pac-citron', { wait: 3000, label: 'fiche PAC' });
  await page.click('[data-step="1"]');
  await page.click('.pp__add');
  await page.waitForTimeout(600);
  await shot(page, 'bureau-23-panier-lateral', false);
  await page.goto(`${BASE}/boutique/fun-blue?test`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.click('.pp__add');
  await page.waitForTimeout(500);
  await page.goto(`${BASE}/boutique/pastis-marra?test`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.click('.pp__add');
  await page.waitForTimeout(500);
  const t = await page.evaluate(() => JSON.parse(localStorage.getItem('blachere-panier') || 'null'));
  const lines = t?.items || t?.lignes || t;
  check('Panier gardé dans le navigateur (3 lignes)', Array.isArray(lines) && lines.length === 3, JSON.stringify(lines));
  await page.goto(`${BASE}/panier?test`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // Les montants s'affichent avec une espace insécable avant « € ».
  const sub = await page.evaluate(() => document.querySelector('[data-subtotal]')?.textContent.replace(/\s+/g, ' ').trim());
  check('Sous-total : 2 × 6,70 € + 6,70 € = 20,10 € (+ un article au prix de la boutique)', sub === '20,10 €', sub);
  const unpriced = await page.evaluate(() => /au prix de la boutique/.test(document.querySelector('.totals')?.textContent || ''));
  check('Article sans prix en ligne : signalé « au prix de la boutique »', unpriced);
  await shot(page, 'bureau-24-panier', true);
  // Coordonnées : la case 18 ans est obligatoire avec de l'alcool.
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
  await shot(page, 'bureau-25-commande-case-18-ans', false);
  await page.check('[name="majeur"]');
  await page.click('#co-form button[type="submit"]');
  await page.waitForTimeout(500);
  await page.check('input[name="mode"][value="retrait"]');
  await page.waitForTimeout(200);
  await shot(page, 'bureau-26-commande-retrait', false);
  await page.click('#co-form button[type="submit"]');
  await page.waitForTimeout(500);
  check('Retrait à la distillerie : récapitulatif atteint', /etape=recapitulatif/.test(page.url()));
  await shot(page, 'bureau-27-commande-recapitulatif', true);
  await page.click('[data-next]');
  await page.waitForTimeout(500);
  const banner = await page.evaluate(() => /Vente interdite aux mineurs/i.test(document.querySelector('.co-mineurs')?.textContent || ''));
  check('Paiement : bandeau « vente interdite aux mineurs »', banner);
  await shot(page, 'bureau-28-commande-paiement', false);
  await page.click('#pay');
  await page.waitForTimeout(800);
  const done = await page.evaluate(() => !!document.querySelector('.co-done'));
  check('Paiement simulé : confirmation affichée', done);
  await shot(page, 'bureau-29-commande-confirmation', false);
  await ctx.close();
  // Mineur : l'alcool est retiré du panier.
  const ctx2 = await context('bureau', 'mineur');
  await ctx2.addInitScript(() => localStorage.setItem('blachere-panier', JSON.stringify({ v: 2, items: [{ slug: 'pastis-marra', ml: 700, qty: 1 }, { slug: 'pac-citron', ml: 1000, qty: 1 }] })));
  const { page: p2 } = await open(ctx2, '/panier', { wait: 1500, label: 'panier mineur' });
  const left = await p2.evaluate(() => [...document.querySelectorAll('[data-slug]')].map((e) => e.dataset.slug));
  check('Mineur : les spiritueux sont retirés du panier', !left.includes('pastis-marra'), left.join(', '));
  await ctx2.close();
}

// ---------- 5. Formulaires en mode maquette ----------
{
  const ctx = await context('bureau', 'sirops');
  const { page } = await open(ctx, '/visiter', { wait: 1500, label: 'visiter' });
  await page.click('#booking button[type="submit"]');
  await page.waitForTimeout(300);
  check('Réservation : erreurs affichées si le formulaire est vide', await page.evaluate(() => document.querySelector('#booking-err').textContent.length > 10));
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
  await shot(page, 'bureau-30-visite-confirmation', false);
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
  check('Espace pro : SIRET invalide refusé', await pro.evaluate(() => /14 chiffres/.test(document.querySelector('#pro-msg').textContent)));
  await pro.fill('#pro-form [name="siret"]', '');
  await pro.click('#pro-form button[type="submit"]');
  await pro.waitForTimeout(300);
  check('Espace pro : demande confirmée, rien n’est envoyé', await pro.evaluate(() => !!document.querySelector('#pro-done')));
  await shot(pro, 'bureau-31-espace-pro-confirmation', false);
  const { page: mu } = await open(ctx, '/musee#pac-roue', { wait: 1500, label: 'musée fiche' });
  check('Musée : la fiche d’une pièce s’ouvre depuis son adresse', await mu.evaluate(() => /psychédélique/.test(document.querySelector('#fiche-title')?.textContent || '')));
  await shot(mu, 'bureau-32-musee-fiche', false);
  await mu.click('[data-vue="frise"]');
  await mu.waitForTimeout(400);
  await shot(mu, 'bureau-33-musee-frise', true);
  const { page: ot } = await open(ctx, '/ou-trouver', { wait: 1200, label: 'où trouver' });
  await ot.fill('#ot-q', 'paris');
  await ot.waitForTimeout(500);
  const otn = await ot.evaluate(() => [...document.querySelectorAll('.pdv__nom')].map((e) => e.textContent));
  check('Où trouver : recherche par ville (Paris → Les Caves du Roy)', otn.length === 1 && /Caves du Roy/.test(otn[0]), otn.join(', '));
  await ctx.close();
  const ctxm = await context('mobile', 'sirops');
  const { page: mm } = await open(ctxm, '/', { wait: 3000, label: 'menu mobile' });
  await mm.click('#menu-open');
  await mm.waitForTimeout(600);
  check('Téléphone : le menu s’ouvre', await mm.evaluate(() => document.querySelector('#menu').classList.contains('is-open')));
  await shot(mm, 'mobile-22-menu', false);
  await ctxm.close();
}

// ---------- 6. Une personne mineure ne voit aucun alcool ----------
{
  const FORBIDDEN = /Marra|Camarguais|Camarguaise|Lou Gardian|Verveine Auguste|Flirt|Légats|Legats|Origan|pastis|liqueur|eaux?-de-vie|vieux marc|Mauresque|Tequila|Pink Lady milkshake|Colarotte|Gambas/i;
  const ALCOHOL_SLUGS = ['pastis-marra', 'pastis-le-camarguais', 'aperitif-lou-gardian', 'la-camarguaise', 'verveine-auguste-vieilli', 'eau-de-vie-poire-williams-flirt', 'marc-chateauneuf-du-pape-reserve-des-legats'];
  const paths = ['/', '/pac-citron', '/fun-blue', '/couleur-provence', '/recettes', '/spiritueux', '/la-maison', '/musee', '/musee?vue=frise', '/visiter', '/boutique', '/boutique?univers=spiritueux', '/boutique/pastis-marra', '/boutique/sirop-anis', '/boutique/sirop-couleur-provence-orgeat', '/ou-trouver', '/actualites', '/panier'];
  const ctx = await context('bureau', 'mineur');
  let all = true;
  for (const path of paths) {
    const { page } = await open(ctx, path, { wait: 1500, label: `mineur ${path}` });
    const found = await page.evaluate(
      ({ re, slugs }) => {
        const rx = new RegExp(re, 'i');
        const texts = [document.body.innerText, ...[...document.querySelectorAll('[aria-label],[alt],[title]')].map((e) => `${e.getAttribute('aria-label') || ''} ${e.getAttribute('alt') || ''} ${e.getAttribute('title') || ''}`)];
        const hits = texts.join('\n').match(rx);
        const links = [...document.querySelectorAll('a[href], [data-slug], [data-add]')].map((e) => e.getAttribute('href') || e.dataset.slug || e.dataset.add).filter((h) => slugs.some((s) => h.includes(s)));
        return { text: hits ? hits[0] : null, links };
      },
      { re: FORBIDDEN.source, slugs: ALCOHOL_SLUGS },
    );
    const ok = !found.text && !found.links.length;
    all &&= ok;
    if (!ok) check(`Mineur, ${path} : aucun alcool visible`, false, `${found.text || ''} ${found.links.join(' ')}`);
    if (['/', '/spiritueux', '/boutique', '/musee'].includes(path)) await shot(page, `mineur-${path.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'accueil'}`, false);
    await page.close();
  }
  check(`Mineur : aucun nom, lien ou visuel d’alcool sur ${paths.length} pages`, all);
  await ctx.close();
}

// ---------- 7. 404, robots.txt ----------
{
  const ctx = await context('bureau', 'sirops');
  const page = await ctx.newPage();
  const res = await page.goto(`${BASE}/cette-page-n-existe-pas`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  check('Adresse inconnue : page 404 (statut 404)', res.status() === 404 && /introuvable/i.test(await page.title()), `statut ${res.status()}`);
  await shot(page, 'bureau-34-404', false);
  const robots = await (await page.goto(`${BASE}/robots.txt`)).text();
  check('robots.txt : Disallow: /', /Disallow:\s*\//.test(robots));
  const old = await page.goto(`${BASE}/la-distillerie`, { waitUntil: 'networkidle' });
  check('Ancienne adresse /la-distillerie servie par la page La maison', old.status() === 200 && /La maison/.test(await page.title()));
  await ctx.close();
}

check('Aucune erreur dans la console', consoleErrors.length === 0, consoleErrors.slice(0, 8).join(' | '));

await browser.close();
server.kill();
const failed = results.filter((r) => !r.ok);
writeFileSync(join(OUT, 'recette.json'), `${JSON.stringify({ date: new Date().toISOString(), ok: !failed.length, results, consoleErrors }, null, 2)}\n`);
console.log(`\n${results.length - failed.length}/${results.length} vérifications réussies · captures dans ${OUT}`);
process.exit(failed.length ? 1 : 0);
