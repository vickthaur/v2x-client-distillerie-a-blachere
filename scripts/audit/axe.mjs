#!/usr/bin/env node
// axe-core (WCAG 2.0/2.1/2.2 A et AA, plus les bonnes pratiques) sur chaque page, à 390 px et à
// 1440 px, avec l'âge vérifié ; la porte d'âge (première visite), le panier latéral, la recherche,
// le menu plein écran, un méga-menu et le panneau de filtres sont ouverts puis analysés à part.
//   AUDIT_TOOLS=<node_modules avec @axe-core/playwright> node scripts/audit/axe.mjs [--pages …]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, OUT, PAGES, launch, context, tool, sleep, MOBILE, DESKTOP } from './lib.mjs';

const { AxeBuilder } = tool('@axe-core/playwright');
const args = process.argv.slice(2);
const only = args.includes('--pages') ? args[args.indexOf('--pages') + 1].split(',') : null;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

// WebGL coupé : la 3D (canvas aria-hidden) ne change rien à l'analyse et SwiftShader la ralentit.
const browser = await launch({ webgl: false });
const results = [];

async function analyse(page, label, extra = {}) {
  const builder = new AxeBuilder({ page }).withTags(TAGS);
  if (extra.include) builder.include(extra.include);
  const r = await builder.analyze();
  const violations = r.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    tags: v.tags.filter((t) => /wcag|best/.test(t)),
    aide: v.help,
    n: v.nodes.length,
    noeuds: v.nodes.slice(0, 12).map((n) => ({ cible: n.target.join(' '), html: n.html.slice(0, 220), resume: (n.failureSummary || '').slice(0, 300), donnees: n.any?.[0]?.data ?? null })),
  }));
  const incomplete = r.incomplete.filter((v) => v.id === 'color-contrast').map((v) => ({ id: v.id, n: v.nodes.length, noeuds: v.nodes.slice(0, 15).map((n) => ({ cible: n.target.join(' '), raison: n.any?.[0]?.message?.slice(0, 160) })) }));
  results.push({ cas: label, violations, incomplets: incomplete });
  console.log(`${label} : ${violations.map((v) => `${v.id}(${v.n})`).join(', ') || 'aucune violation'}`);
}

async function open(device, path, { age = 'majeur', panier = false } = {}) {
  const ctx = await context(browser, { device, age, panier });
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await sleep(2500);
  return { ctx, page };
}

for (const [name, path] of PAGES.filter(([n]) => !only || only.includes(n))) {
  for (const [dev, device] of [
    ['390', MOBILE],
    ['1440', DESKTOP],
  ]) {
    const { ctx, page } = await open(device, path, { panier: name === 'panier' });
    // tout le contenu révélé au défilement est rendu visible avant l'analyse
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      scrollTo(0, 0);
      document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
    });
    await sleep(800);
    await analyse(page, `${name} · ${dev}`);
    await ctx.close();
  }
}

if (!only) {
  // Porte d'âge à la première visite (accueil, téléphone et bureau)
  for (const [dev, device] of [
    ['390', MOBILE],
    ['1440', DESKTOP],
  ]) {
    const { ctx, page } = await open(device, '/', { age: null });
    await page.waitForSelector('#gate[open]', { timeout: 5000 }).catch(() => {});
    await sleep(700);
    await analyse(page, `porte d'âge · ${dev}`, { include: '#gate' });
    await ctx.close();
  }
  // Spiritueux sans âge vérifié (porte fermée par « sirops seulement »)
  for (const [dev, device] of [
    ['390', MOBILE],
    ['1440', DESKTOP],
  ]) {
    const { ctx, page } = await open(device, '/spiritueux', { age: 'sirops' });
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(500);
    await analyse(page, `spiritueux sans âge · ${dev}`);
    await ctx.close();
  }
  // Panier latéral, recherche, méga-menu (bureau) ; menu plein écran, filtres (téléphone)
  {
    const { ctx, page } = await open(DESKTOP, '/', { panier: true });
    await page.click('#cart-open');
    await sleep(800);
    await analyse(page, 'panier latéral · 1440', { include: '#cart' });
    await page.keyboard.press('Escape');
    await page.click('#search-open');
    await page.fill('#search-q', 'menthe');
    await sleep(1200);
    await analyse(page, 'recherche · 1440', { include: '#search' });
    await page.keyboard.press('Escape');
    await page.click('[data-mega="marques"]');
    await sleep(1500);
    await analyse(page, 'méga-menu Nos marques · 1440', { include: '#site-header' });
    await page.click('[data-mega="spiritueux"]');
    await sleep(1500);
    await analyse(page, 'méga-menu Spiritueux · 1440', { include: '#site-header' });
    await ctx.close();
  }
  {
    const { ctx, page } = await open(MOBILE, '/');
    await page.click('#menu-open');
    await sleep(1200);
    await analyse(page, 'menu plein écran · 390', { include: '#menu' });
    await ctx.close();
  }
  {
    const { ctx, page } = await open(MOBILE, '/boutique');
    await page.click('#filters-open');
    await sleep(900);
    await analyse(page, 'filtres (panneau) · 390', { include: '#filter-sheet' });
    await ctx.close();
  }
  {
    const { ctx, page } = await open(DESKTOP, '/musee');
    await page.click('.mus-wall .piece__frame');
    await sleep(800);
    await analyse(page, 'pièce en grand · 1440', { include: '#mus-dialog' });
    await ctx.close();
  }
  // Étapes de la commande
  for (const step of ['coordonnees']) {
    const { ctx, page } = await open(DESKTOP, `/panier?etape=${step}`, { panier: true });
    await analyse(page, `commande ${step} · 1440`);
    await ctx.close();
  }
}

await browser.close();
writeFileSync(join(OUT, `axe${only ? `-${only.join('-')}` : ''}.json`), JSON.stringify(results, null, 1));
