#!/usr/bin/env node
// Exploration de tous les liens internes à partir des pages construites, rendues par Chromium
// (âge vérifié, méga-menus et menu ouverts pour que leurs liens générés existent) : statut HTTP de
// chaque adresse, fiches produit inconnues (la réécriture /boutique/:slug répond 200 à tout),
// ancres (#id) absentes de la page d'arrivée une fois rendue, liens externes recensés.
//   node scripts/audit/liens.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, OUT, PAGES, ROOT, launch, context, sleep, DESKTOP } from './lib.mjs';

const catalogue = JSON.parse(readFileSync(join(ROOT, 'src/data/catalogue.json'), 'utf8')).produits;
const slugs = new Set(catalogue.map((p) => p.slug));
const browser = await launch({ webgl: false });
const ctx = await context(browser, { device: DESKTOP, panier: true });
const page = await ctx.newPage();

const rendered = new Map(); // chemin → { ids, links, status, title }
async function render(path) {
  if (rendered.has(path)) return rendered.get(path);
  let status = null;
  try {
    const resp = await page.goto(BASE + path, { waitUntil: 'load', timeout: 45000 });
    status = resp?.status() ?? null;
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  } catch (e) {
    status = `erreur ${e.message.slice(0, 80)}`;
  }
  await sleep(900);
  // ouvrir les méga-menus pour que leurs liens générés (rayons des spiritueux) existent
  for (const m of ['marques', 'spiritueux', 'maison']) {
    await page.click(`[data-mega="${m}"]`, { timeout: 1500 }).catch(() => {});
    await sleep(150);
  }
  await page.keyboard.press('Escape').catch(() => {});
  const info = await page.evaluate(() => ({
    title: document.title,
    ids: [...document.querySelectorAll('[id]')].map((e) => e.id),
    names: [...document.querySelectorAll('a[name]')].map((e) => e.name),
    links: [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.href, raw: a.getAttribute('href'), text: (a.getAttribute('aria-label') || a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50) })),
    introuvable: /introuvable/i.test(document.title),
  }));
  const r = { status, ...info };
  rendered.set(path, r);
  return r;
}

const queue = PAGES.map(([, p]) => p);
const seen = new Set(queue);
const internal = new Map(); // url sans hash → Set(pages sources)
const anchors = []; // { source, cible, id }
const external = new Map();
while (queue.length) {
  const path = queue.shift();
  const r = await render(path);
  for (const l of r.links) {
    let u;
    try {
      u = new URL(l.href);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol)) continue;
    if (u.origin !== new URL(BASE).origin) {
      external.set(u.hostname, (external.get(u.hostname) || 0) + 1);
      continue;
    }
    const target = u.pathname + u.search;
    if (!internal.has(target)) internal.set(target, new Set());
    internal.get(target).add(path);
    if (u.hash.length > 1) anchors.push({ source: path, cible: u.pathname, id: decodeURIComponent(u.hash.slice(1)), texte: l.text });
    // exploration : pages sans paramètre (les filtres de la boutique sont testés à part)
    if (!seen.has(u.pathname)) {
      seen.add(u.pathname);
      queue.push(u.pathname);
    }
  }
  process.stdout.write(`\r${rendered.size} pages rendues, ${queue.length} en attente   `);
}
console.log('');

// Statuts des adresses avec paramètres (filtres de la boutique…) : requête HTTP simple
const statuts = [];
for (const [target, sources] of internal) {
  const pathOnly = target.split('?')[0];
  const r = rendered.get(pathOnly);
  let status = r?.status ?? null;
  if (status === null) {
    const res = await fetch(BASE + target, { headers: { accept: 'text/html' } }).catch(() => null);
    status = res?.status ?? 'erreur';
  }
  const m = pathOnly.match(/^\/boutique\/([^/]+)$/);
  const ficheInconnue = m && !slugs.has(m[1]);
  if (status >= 400 || ficheInconnue || r?.introuvable || typeof status === 'string') statuts.push({ cible: target, status, ficheInconnue: !!ficheInconnue, sources: [...sources].slice(0, 8) });
}

// Ancres : l'id doit exister dans la page d'arrivée rendue (même page ou autre page)
const ancresManquantes = [];
const vu = new Set();
for (const a of anchors) {
  const key = `${a.cible}#${a.id}`;
  if (vu.has(key)) continue;
  vu.add(key);
  const r = rendered.get(a.cible) || (await render(a.cible));
  if (!r.ids.includes(a.id) && !r.names.includes(a.id)) ancresManquantes.push({ lien: key, depuis: [...new Set(anchors.filter((x) => `${x.cible}#${x.id}` === key).map((x) => x.source))].slice(0, 8), texte: a.texte });
}

await browser.close();
const out = {
  pagesRendues: [...rendered.keys()].length,
  adressesInternes: internal.size,
  liensCassés: statuts,
  ancresManquantes,
  domainesExternes: Object.fromEntries([...external].sort((a, b) => b[1] - a[1])),
  titres: Object.fromEntries([...rendered].map(([p, r]) => [p, r.title])),
};
writeFileSync(join(OUT, 'liens.json'), JSON.stringify(out, null, 1));
console.log(`${out.pagesRendues} pages, ${out.adressesInternes} adresses internes, ${statuts.length} liens en erreur, ${ancresManquantes.length} ancres manquantes`);
for (const s of statuts) console.log('  ✗', s.status, s.cible, s.ficheInconnue ? '(fiche inconnue)' : '', '←', s.sources.join(', '));
for (const a of ancresManquantes) console.log('  # ', a.lien, '←', a.depuis.join(', '));
