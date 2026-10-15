#!/usr/bin/env node
// Catalogue pour le serveur (api/, server/) : généré depuis src/data/products.js, la source du site.
//
//   node scripts/server-catalogue.mjs            écrit server/generated/catalogue.js
//   node scripts/server-catalogue.mjs --verifier  échoue si le fichier versionné n'est plus à jour
//
// Les fonctions Vercel ne peuvent pas importer src/data/products.js tel quel (import de JSON sans
// attribut, code du navigateur) : esbuild l'empaquette en mémoire (JSON intégré, ESM, plateforme
// node), on en extrait ce dont le serveur a besoin (noms d'affichage, gammes, univers, alcool, degré,
// photos utilisées par le site, variantes et prix TTC officiels) et on écrit un module de données
// simple, versionné. Lancé avant `vite dev` et `vite build` (npm « predev » et « prebuild ») ; un
// test (test/catalogue.test.js) échoue si le fichier versionné n'est plus à jour.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CIBLE = join(root, 'server/generated/catalogue.js');

// TVA : sirops et produits sans alcool 5,5 % ; boissons alcoolisées 20 % (docs/crm-espace-pro.md, § 5).
const tvaDe = (alcool) => (alcool ? 20 : 5.5);

// Produit tel que le serveur le connaît. Les photos sont celles du site : public/bouteilles/<slug>/,
// produites par scripts/photos.mjs depuis photos/produits/<slug>.webp (vignette des cartes, et photo
// à plat pour les flacons en étui).
function versServeur(p) {
  const aPhoto = existsSync(join(root, 'photos/produits', `${p.slug}.webp`));
  return {
    slug: p.slug,
    nom: p.nom,
    nomOfficiel: p.nomOfficiel,
    type: p.type,
    gamme: p.gamme,
    gammeNom: p.gammeNom,
    univers: p.univers,
    alcool: p.alcool,
    degre: p.degre ?? null,
    tva: tvaDe(p.alcool),
    plat: p.plat,
    enLigne: p.enLigne,
    bestSeller: !!p.bestSeller,
    reference: p.reference || null,
    photo: aPhoto ? `/bouteilles/${p.slug}/vignette.webp` : null,
    photoGrande: aPhoto && p.plat ? `/bouteilles/${p.slug}/photo.webp` : null,
    phrase: p.phrase || null,
    ingredients: p.ingredients || null,
    nutrition: p.nutrition || null,
    variantes: p.contenances.map((c) => ({
      id: c.id,
      volume: c.volume,
      ml: c.ml ?? null,
      prixTTC: c.prix,
      coffret: !!c.coffret,
    })),
  };
}

// Empaquette src/data/products.js en mémoire et l'importe.
async function chargerProduits() {
  const res = await build({
    entryPoints: [join(root, 'src/data/products.js')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    loader: { '.json': 'json' },
    logLevel: 'silent',
  });
  const code = res.outputFiles[0].text;
  const mod = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  return { products: mod.products, gammes: mod.GAMMES };
}

export async function genererCatalogueServeur() {
  const { products, gammes } = await chargerProduits();
  const produits = products.map(versServeur);
  const lignes = produits.map((p) => `  ${JSON.stringify(p)},`).join('\n');
  const g = gammes.map((x) => `  ${JSON.stringify({ id: x.id, nom: x.nom, univers: x.univers })},`).join('\n');
  const variantes = produits.reduce((s, p) => s + p.variantes.length, 0);
  return `// Généré par scripts/server-catalogue.mjs depuis src/data/products.js (catalogue officiel du site) :
// ne pas modifier à la main. ${produits.length} produits, ${variantes} variantes ; prix TTC officiels.
export const gammes = [
${g}
];

export const produits = [
${lignes}
];
`;
}

// Lancement direct : écrit (ou vérifie) le fichier.
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const texte = await genererCatalogueServeur();
  const actuel = existsSync(CIBLE) ? readFileSync(CIBLE, 'utf8') : null;
  if (process.argv.includes('--verifier')) {
    if (actuel !== texte) {
      console.error('[catalogue serveur] server/generated/catalogue.js n’est plus à jour : lancez node scripts/server-catalogue.mjs');
      process.exit(1);
    }
    console.log('[catalogue serveur] à jour.');
  } else if (actuel !== texte) {
    mkdirSync(dirname(CIBLE), { recursive: true });
    writeFileSync(CIBLE, texte);
    console.log('[catalogue serveur] server/generated/catalogue.js écrit.');
  }
}
