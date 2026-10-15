#!/usr/bin/env node
// Texte rendu de chaque page (âge vérifié, puis âge inconnu) pour la relecture : coquilles, noms
// incohérents, mentions « maquette », « à confirmer », sources citées dans le texte public.
// Écrit OUT/textes/<page>[-sans-age].txt et un relevé des tournures à revoir (textes.json).
// Le HTML rendu de chaque page est aussi gardé (OUT/rendu/<page>.html) pour html-validate.
//   node scripts/audit/textes.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, OUT, PAGES, launch, context, sleep, DESKTOP } from './lib.mjs';

const dir = join(OUT, 'textes');
const rendu = join(OUT, 'rendu');
mkdirSync(dir, { recursive: true });
mkdirSync(rendu, { recursive: true });
const MOTIFS = [
  ['maquette', /maquette/i],
  ['à confirmer / à préciser', /à (confirmer|préciser|trancher|fixer|annoncer|venir)/i],
  ['site (de la distillerie / officiel / actuel)', /site (de la distillerie|officiel|actuel)|fiche officielle|page Histoire/i],
  ['sources citées', /\b(selon|d’après|d'après) (les sources|la fiche|l’office|Pop Tourisme|Provence Guide)|Pop Tourisme|Provence Guide|relevée? (en ligne )?le|relevé d’octobre/i],
  ['placeholder', /lorem|todo|xxx|placeholder|à remplir|photo à faire|à photographier/i],
  ['V2X', /V2X/],
];

const browser = await launch({ webgl: false });
const releve = [];
for (const age of ['majeur', null]) {
  const ctx = await context(browser, { device: DESKTOP, age, panier: true });
  const page = await ctx.newPage();
  for (const [name, path] of PAGES) {
    await page.goto(BASE + path, { waitUntil: 'load' }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await sleep(1000);
    if (!age) await page.keyboard.press('Escape').catch(() => {});
    const { text, html } = await page.evaluate(() => {
      document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
      const main = document.querySelector('main')?.innerText || '';
      const foot = document.querySelector('footer')?.innerText || '';
      return { text: `${document.title}\n\n${main}\n\n--- pied de page ---\n${foot}`, html: document.documentElement.outerHTML };
    });
    const suffix = age ? '' : '-sans-age';
    writeFileSync(join(dir, `${name}${suffix}.txt`), text);
    if (age) writeFileSync(join(rendu, `${name}.html`), `<!doctype html>\n${html}`);
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const [motif, rx] of MOTIFS) for (const l of lines) if (rx.test(l)) releve.push({ page: name, age: age || 'inconnu', motif, ligne: l.slice(0, 220) });
  }
  await ctx.close();
}
await browser.close();
// dédoublonner (pied de page commun, mêmes lignes à deux âges)
const seen = new Set();
const uniques = releve.filter((r) => {
  const k = `${r.motif}|${r.ligne}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});
writeFileSync(join(OUT, 'textes.json'), JSON.stringify(uniques, null, 1));
for (const [motif] of MOTIFS) console.log(`${motif} : ${uniques.filter((r) => r.motif === motif).length}`);
