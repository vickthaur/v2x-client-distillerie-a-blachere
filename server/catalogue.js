// Catalogue officiel côté serveur (server/generated/catalogue.js, généré depuis src/data/products.js
// par scripts/server-catalogue.mjs) : 63 produits, 76 variantes, prix TTC officiels.
import { gammes, produits } from './generated/catalogue.js';

export const GAMMES = gammes;
export const PRODUITS = produits;
export const PAR_SLUG = Object.fromEntries(produits.map((p) => [p.slug, p]));
export const NOMS_GAMMES = Object.fromEntries(gammes.map((g) => [g.id, g.nom]));

export const produit = (slug) => (typeof slug === 'string' && Object.hasOwn(PAR_SLUG, slug) ? PAR_SLUG[slug] : null);
export const variante = (slug, id) => produit(slug)?.variantes.find((v) => v.id === id) || null;

// « PAC Citron® 1 L », « Pastis « MARRA® » Coffret ».
export const nomComplet = (p, v) => `${p.nom} ${v.volume}`;
