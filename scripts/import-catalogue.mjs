#!/usr/bin/env node
// Importe le catalogue de la recherche (blachere_catalogue.json) dans src/data/catalogue.json,
// le fichier de données de la boutique. À relancer quand la recherche est mise à jour :
//   npm run catalogue -- "/chemin/vers/blachere_catalogue.json" ["/chemin/vers/blachere_catalogue_complement.json"]
//
// Le complément (blachere_catalogue_complement.json, même dossier par défaut) est appliqué ensuite,
// correction par correction (liste COMPLEMENT ci-dessous) : seules les valeurs prouvées par le site
// officiel ou la presse changent la boutique ; les formats vus seulement en grande surface ou chez des
// revendeurs ne sont jamais vendus en ligne (champ formatsAilleurs, mentionné sur la fiche).
//
// Règles appliquées (voir README) :
// - les fiches de certitude « élevée » ou « moyenne » sont vendues en ligne ;
// - les fiches de certitude « faible » (produit attesté par la page Histoire, la boutique, la presse
//   ou les offices de tourisme, mais sans fiche ni prix officiels) sont gardées comme « disponibles
//   à la boutique de la distillerie », sans prix ni contenance, et signalées « à confirmer » ;
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
const EN_LIGNE = new Set(['élevée', 'moyenne']);
// Prix officiels vus une seule fois pendant la collecte (à revérifier avant la mise en ligne).
const PRIX_A_VERIFIER = new Set(['sirop-couleur-provence-figue', 'sirop-couleur-provence-violette', 'sirop-couleur-provence-kiwi', 'sirop-citron', 'sirop-fraise-barbe-a-papa']);

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

// ---------------------------------------------------------------- Complément (14 octobre 2026)
const complementPath = process.argv[3] ? resolve(process.argv[3]) : resolve(dirname(input), 'blachere_catalogue_complement.json');
let complement = null;
try {
  complement = JSON.parse(readFileSync(complementPath, 'utf8'));
} catch {
  console.warn(`Complément introuvable (${complementPath}) : catalogue importé sans corrections.`);
}
const applied = [];
const correction = (slug) => complement?.corrections?.find((c) => c.slug === slug)?.valeur_proposee || null;
const bySlugIn = Object.fromEntries(data.produits.map((p) => [p.slug, p]));
// Formats vus seulement en grande surface ou chez des revendeurs : jamais vendus en ligne.
const AILLEURS = {
  'pac-citron': [{ volume: '70 cl', ou: 'en grande surface' }],
  'fun-blue': [{ volume: '70 cl', ou: 'en grande surface' }],
  'sirop-couleur-provence-orgeat': [{ volume: '70 cl', ou: 'en grande surface' }],
  'pastis-le-camarguais': [{ volume: '1 L', ou: 'chez un revendeur' }],
  'la-camarguaise': [{ volume: '50 cl', ou: 'chez des cavistes' }],
  'elixir-du-mont-ventoux': [{ volume: '70 cl', ou: 'chez des cavistes' }, { volume: '50 cl', ou: 'chez des cavistes' }],
  'aperitif-lou-gardian': [{ volume: '75 cl', ou: 'chez des cavistes' }],
};
if (complement) {
  // Verveine Auguste vieilli : fiche officielle /fr/boutique/132/ (degré et description officiels).
  const verveine = complement.produits.find((x) => x.slug === 'verveine-auguste-vieilli');
  const cible = bySlugIn['verveine-auguste-vieilli'];
  if (verveine && cible) {
    Object.assign(cible, {
      nom: verveine.nom,
      url: verveine.url,
      degre: verveine.degre,
      degre_source: verveine.degre_source,
      description: verveine.description,
      contenances: verveine.contenances,
      presence_site_officiel: verveine.presence_site_officiel,
      // ingrédients traduits d'un résumé anglais : pas de citation tant que le libellé n'est pas relevé
      ingredients: null,
    });
    applied.push('verveine-auguste-vieilli : fiche officielle, 43 % vol., « Cuvée prestige… »');
  }
  // Sirop fraise barbe à papa : 5,60 € TTC / 70 cl, fiche officielle.
  const fraise = correction('sirop-fraise-barbe-a-papa');
  if (fraise && bySlugIn['sirop-fraise-barbe-a-papa']) {
    bySlugIn['sirop-fraise-barbe-a-papa'].contenances = fraise.contenances;
    applied.push('sirop-fraise-barbe-a-papa : 5,60 € TTC / 70 cl (fiche officielle, vu une fois)');
  }
  // La Magistrale : eau-de-vie de plantes (eau d'arquebuse), pas une liqueur.
  if (correction('la-magistrale') && bySlugIn['la-magistrale']) {
    Object.assign(bySlugIn['la-magistrale'], {
      categorie: 'Eaux-de-vie de plantes',
      gamme: 'Les Crèmes et Eaux de Vie',
      degre: correction('la-magistrale').degre,
      degre_source: correction('la-magistrale').degre_source,
    });
    applied.push('la-magistrale : eau-de-vie de plantes (degré de revendeur, non affiché)');
  }
  // Rubrique officielle « Les Crèmes et Eaux de Vie » (crème de châtaigne, eaux-de-vie).
  if (complement.corrections_categories?.some((c) => c.valeur_proposee?.nom_fr === 'Les Crèmes et Eaux de Vie')) {
    for (const p of data.produits) if (p.categorie === 'Crèmes' || p.categorie === 'Eaux-de-vie de fruits') p.gamme = 'Les Crèmes et Eaux de Vie';
    applied.push('rubrique « Les Crèmes et Eaux de Vie »');
  }
  // Degrés relevés chez des revendeurs : gardés pour le rapport, jamais affichés.
  for (const slug of ['elixir-du-mont-ventoux', 'vieux-marc-de-provence-gros-calan', 'aperitif-lou-gardian']) {
    const c = correction(slug);
    if (c?.degre && bySlugIn[slug]) Object.assign(bySlugIn[slug], { degre: c.degre, degre_source: c.degre_source });
  }
  // Descriptions de cavistes (une seule source marchande) : affichées comme telles, à confirmer.
  const cav = {
    'la-comtadine': 'liqueur créée en 1850, obtenue par distillation, macération et infusion de plus de 40 plantes et épices',
    'origan-du-comtat': '« la liqueur historique du Vaucluse »',
  };
  for (const [slug, texte] of Object.entries(cav)) {
    if (correction(slug) && bySlugIn[slug]) {
      bySlugIn[slug].citation_caviste = texte;
      applied.push(`${slug} : description d'un caviste`);
    }
  }
  for (const slug of Object.keys(AILLEURS)) if (correction(slug)) applied.push(`${slug} : ${AILLEURS[slug].map((f) => `${f.volume} ${f.ou}`).join(', ')} (hors boutique en ligne)`);
}

// « 1 L » → 1000, « 70 cl » → 700, « 50 cl » → 500 (millilitres).
function millilitres(volume) {
  const m = String(volume).toLowerCase().replace(',', '.').match(/([\d.]+)\s*(ml|cl|l)\b/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Math.round(m[2] === 'l' ? n * 1000 : m[2] === 'cl' ? n * 10 : n);
}

const isEnglish = (text) => /\b(my|the|it's|as for|used in|i drew)\b/i.test(text || '');

const kept = [];
const report = { boutique: [], prixAVerifier: [], degresRevendeurs: [], volumesRevendeurs: [], sansPrix: [], sansContenance: [] };

for (const p of data.produits) {
  const enLigne = EN_LIGNE.has(p.certitude);
  if (!enLigne) report.boutique.push(`${p.slug} (${p.certitude})`);
  const contenances = (enLigne ? p.contenances || [] : [])
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
  if (enLigne && !contenances.length) report.sansContenance.push(p.slug);
  else if (enLigne && contenances.every((c) => c.prix === null)) report.sansPrix.push(p.slug);

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
    citation: enLigne ? p.description || null : null,
    citationLangue: enLigne && p.description ? (isEnglish(p.description) ? 'en' : 'fr') : null,
    ingredients: p.ingredients || null,
    bestSeller: p.best_seller === true,
    url: p.url && OFFICIEL.test(p.url) ? p.url : null,
    // formats vus seulement en grande surface ou chez des revendeurs (complément) : pas en vente en ligne
    formatsAilleurs: complement ? AILLEURS[p.slug] || [] : [],
    citationCaviste: p.citation_caviste || null,
    presence: p.presence_site_officiel,
    certitude: p.certitude,
    // « en-ligne » : vendu sur le site ; « boutique » : disponible à la boutique de la distillerie
    // (existence sourcée, présence actuelle à confirmer), jamais ajouté au panier.
    disponibilite: enLigne ? 'en-ligne' : 'boutique',
  });
}

const out = {
  _source: `Recherche V2X Studio, blachere_catalogue.json${complement ? ' et blachere_catalogue_complement.json' : ''} (collecte du ${data._meta?.date_collecte || '?'}). Généré par scripts/import-catalogue.mjs : ne pas modifier à la main.`,
  produits: kept,
};
writeFileSync(output, `${JSON.stringify(out, null, 2)}\n`);

const n = (k) => kept.filter(k).length;
console.log(`Catalogue : ${kept.length} produits gardés sur ${data.produits.length} (${n((p) => p.categorie === 'Sirops')} sirops, ${n((p) => p.categorie !== 'Sirops')} alcools).`);
console.log(`Prix officiels : ${n((p) => p.contenances.some((c) => c.prix !== null))} produits.`);
console.log(`Disponibles à la boutique, à confirmer (certitude faible) : ${report.boutique.join(', ') || 'aucun'}`);
console.log(`Prix à vérifier : ${report.prixAVerifier.join(' ; ') || 'aucun'}`);
console.log(`Degrés de source revendeur (non affichés) : ${report.degresRevendeurs.join(' ; ') || 'aucun'}`);
console.log(`Contenances de source revendeur (affichées « à confirmer ») : ${report.volumesRevendeurs.join(' ; ') || 'aucune'}`);
console.log(`Sans prix officiel : ${report.sansPrix.join(', ') || 'aucun'}`);
console.log(`Sans contenance connue : ${report.sansContenance.join(', ') || 'aucun'}`);
console.log(`Complément appliqué : ${applied.join(' ; ') || 'rien'}`);
console.log(`→ ${output}`);
