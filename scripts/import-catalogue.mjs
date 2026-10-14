#!/usr/bin/env node
// Importe le catalogue de la recherche (blachere_catalogue.json) dans src/data/catalogue.json,
// le fichier de données de la boutique. À relancer quand la recherche est mise à jour :
//   npm run catalogue -- "/chemin/vers/blachere_catalogue.json"
//
// Règles appliquées (voir README) :
// - seules les fiches de certitude « élevée » ou « moyenne » sont gardées ;
// - les prix revendeurs (prix_revendeurs) ne sont JAMAIS repris ;
// - un prix n'est gardé que si sa source est le site officiel (distillerieablachere.com) ;
// - un degré n'est gardé que si sa source est le site officiel (les degrés relevés chez des
//   revendeurs sont listés dans le rapport, à faire valider par la distillerie) ;
// - les prix vus dans une seule requête sont marqués « aVerifier ».
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT = resolve(root, '../V2X-Studio/research_notes/Sites web datés entreprises Vaucluse/blachere_catalogue.json');
const input = process.argv[2] ? resolve(process.argv[2]) : DEFAULT;
const output = resolve(root, 'src/data/catalogue.json');

const OFFICIEL = /distillerieablachere\.com/i;
const GARDER = new Set(['élevée', 'moyenne']);
// Prix officiels vus une seule fois pendant la collecte (à revérifier avant la mise en ligne).
const PRIX_A_VERIFIER = new Set(['sirop-couleur-provence-figue', 'sirop-couleur-provence-violette', 'sirop-couleur-provence-kiwi', 'sirop-citron']);

// Corrections issues de l'étude d'identité (reports/Identité visuelle Distillerie Blachère.md,
// « Sept écarts à corriger ») : le nom de revendeur est remplacé par le titre de la fiche officielle.
const CORRECTIONS = {
  'verveine-blachere': {
    slug: 'verveine-auguste-vieilli',
    nom: 'VERVEINE AUGUSTE VIEILLI',
    url: 'https://www.distillerieablachere.com/fr/boutique/132/verveine-auguste-vieilli-',
    presence_site_officiel: 'fiche',
  },
};

const data = JSON.parse(readFileSync(input, 'utf8'));
data.produits = data.produits.map((p) => (CORRECTIONS[p.slug] ? { ...p, ...CORRECTIONS[p.slug] } : p));

// « 1 L » → 1000, « 70 cl » → 700, « 50 cl » → 500 (millilitres).
function millilitres(volume) {
  const m = String(volume).toLowerCase().replace(',', '.').match(/([\d.]+)\s*(ml|cl|l)\b/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Math.round(m[2] === 'l' ? n * 1000 : m[2] === 'cl' ? n * 10 : n);
}

const isEnglish = (text) => /\b(my|the|it's|as for|used in|i drew)\b/i.test(text || '');

const kept = [];
const report = { exclus: [], prixAVerifier: [], degresRevendeurs: [], volumesRevendeurs: [], sansPrix: [], sansContenance: [] };

for (const p of data.produits) {
  if (!GARDER.has(p.certitude)) {
    report.exclus.push(`${p.slug} (${p.certitude})`);
    continue;
  }
  const contenances = (p.contenances || [])
    .map((c) => {
      const officiel = typeof c.prix_ttc === 'number' && OFFICIEL.test(c.source || '');
      const entry = { volume: c.volume.replace(/\bCL\b/, 'cl'), ml: millilitres(c.volume), prix: officiel ? c.prix_ttc : null };
      // Contenance connue seulement par des revendeurs : affichée, mais signalée « à confirmer ».
      if (!OFFICIEL.test(c.source || '') && /revendeur/i.test(c.source || '')) {
        entry.volumeRevendeur = true;
        report.volumesRevendeurs.push(`${p.slug} : ${c.volume}`);
      }
      if (entry.prix !== null && PRIX_A_VERIFIER.has(p.slug)) {
        entry.aVerifier = true;
        report.prixAVerifier.push(`${p.slug} : ${c.prix_ttc.toFixed(2)} € / ${c.volume}`);
      }
      return entry;
    })
    .filter((c) => c.ml);
  if (!contenances.length) report.sansContenance.push(p.slug);
  else if (contenances.every((c) => c.prix === null)) report.sansPrix.push(p.slug);

  const degreOfficiel = typeof p.degre === 'number' && OFFICIEL.test(p.degre_source || '') && !/revendeur/i.test(p.degre_source || '');
  if (typeof p.degre === 'number' && !degreOfficiel) report.degresRevendeurs.push(`${p.slug} : ${p.degre} % (${p.degre_source})`);

  kept.push({
    slug: p.slug,
    nomOfficiel: p.nom,
    categorie: p.categorie,
    gamme: p.gamme,
    arome: p.arome,
    contenances,
    degre: degreOfficiel ? p.degre : null,
    citation: p.description || null,
    citationLangue: p.description ? (isEnglish(p.description) ? 'en' : 'fr') : null,
    ingredients: p.ingredients || null,
    bestSeller: p.best_seller === true,
    url: p.url && OFFICIEL.test(p.url) ? p.url : null,
    presence: p.presence_site_officiel,
    certitude: p.certitude,
  });
}

const out = {
  _source: `Recherche V2X Studio, blachere_catalogue.json (collecte du ${data._meta?.date_collecte || '?'}). Généré par scripts/import-catalogue.mjs : ne pas modifier à la main.`,
  produits: kept,
};
writeFileSync(output, `${JSON.stringify(out, null, 2)}\n`);

const n = (k) => kept.filter(k).length;
console.log(`Catalogue : ${kept.length} produits gardés sur ${data.produits.length} (${n((p) => p.categorie === 'Sirops')} sirops, ${n((p) => p.categorie !== 'Sirops')} alcools).`);
console.log(`Prix officiels : ${n((p) => p.contenances.some((c) => c.prix !== null))} produits.`);
console.log(`Exclus (certitude faible) : ${report.exclus.join(', ') || 'aucun'}`);
console.log(`Prix à vérifier : ${report.prixAVerifier.join(' ; ') || 'aucun'}`);
console.log(`Degrés de source revendeur (non affichés) : ${report.degresRevendeurs.join(' ; ') || 'aucun'}`);
console.log(`Contenances de source revendeur (affichées « à confirmer ») : ${report.volumesRevendeurs.join(' ; ') || 'aucune'}`);
console.log(`Sans prix officiel : ${report.sansPrix.join(', ') || 'aucun'}`);
console.log(`Sans contenance connue : ${report.sansContenance.join(', ') || 'aucun'}`);
console.log(`→ ${output}`);
