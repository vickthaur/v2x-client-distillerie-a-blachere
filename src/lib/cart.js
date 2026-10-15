// Panier : gardé dans le navigateur (localStorage), synchronisé entre onglets.
// Une ligne = un produit dans une variante (contenance ou coffret, id de la variante officielle). Les prix sont relus dans le catalogue à chaque
// affichage (jamais stockés) : seuls les prix officiels connus comptent dans le total. Quand une démo
// existe (src/lib/demo.js), ses prix et ses états de stock (rupture…) remplacent ceux du catalogue,
// comme côté serveur, qui recalcule toujours les totaux de la commande.
import { bySlug } from '../data/products.js';
import { readJSON, writeJSON } from './store.js';

const KEY = 'blachere-panier';
const VERSION = 3;
const listeners = new Set();

function load() {
  const saved = readJSON(KEY, null);
  if (!saved || saved.v !== VERSION || !Array.isArray(saved.items)) return [];
  return saved.items.filter((i) => bySlug[i.slug]?.enLigne && Number.isInteger(i.qty) && i.qty > 0 && i.qty < 100);
}

let items = load();
// Catalogue de la démo : { [slug]: { actif, variantes: { [id]: { prixTTC, etat } } } } ou null.
let demo = null;

function save() {
  writeJSON(KEY, { v: VERSION, items });
  listeners.forEach((fn) => fn(items));
}

addEventListener('storage', (e) => {
  if (e.key !== KEY) return;
  items = load();
  listeners.forEach((fn) => fn(items));
});

const same = (a, slug, v) => a.slug === slug && (a.v ?? null) === (v ?? null);

export const cart = {
  get items() {
    return items;
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  count() {
    return items.reduce((s, i) => s + i.qty, 0);
  },
  add(slug, v = null, qty = 1) {
    // Produits « disponibles à la boutique de la distillerie » : jamais dans le panier en ligne.
    if (!bySlug[slug]?.enLigne) return false;
    const line = items.find((i) => same(i, slug, v));
    if (line) line.qty = Math.min(99, line.qty + qty);
    else items = [...items, { slug, v, qty: Math.min(99, qty) }];
    save();
    return true;
  },
  set(slug, v, qty) {
    if (qty <= 0) items = items.filter((i) => !same(i, slug, v));
    else items = items.map((i) => (same(i, slug, v) ? { ...i, qty: Math.min(99, qty) } : i));
    save();
  },
  clear() {
    items = [];
    save();
  },
  // Prix et stocks de la démo (null : prix officiels du catalogue).
  setDemo(produits) {
    demo = produits || null;
    listeners.forEach((fn) => fn(items));
  },
  // Retire les alcools (âge non vérifié ou mineur).
  purgeAlcohol() {
    const before = items.length;
    items = items.filter((i) => !bySlug[i.slug]?.alcool);
    if (items.length !== before) save();
    return before - items.length;
  },
  // Lignes détaillées : produit, contenance, prix unitaire (ou null), total de ligne (ou null).
  lines() {
    return items
      .map((i) => {
        const product = bySlug[i.slug];
        if (!product) return null;
        const contenance = product.contenances.find((c) => c.id === i.v) || null;
        const d = demo?.[i.slug];
        const dv = d?.variantes?.[i.v];
        const prix = dv?.prixTTC ?? contenance?.prix ?? null;
        // état de la démo : 'disponible' | 'stock-bas' | 'rupture' | 'inactif' (null sans démo)
        const etat = d ? (d.actif === false ? 'inactif' : dv?.etat || 'disponible') : null;
        return { ...i, product, contenance, prix, etat, total: prix !== null ? Math.round(prix * i.qty * 100) / 100 : null };
      })
      .filter(Boolean);
  },
  totals() {
    const lines = this.lines();
    const priced = lines.filter((l) => l.prix !== null);
    return {
      lines,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotal: Math.round(priced.reduce((s, l) => s + l.total, 0) * 100) / 100,
      unpriced: lines.filter((l) => l.prix === null).reduce((s, l) => s + l.qty, 0),
      alcohol: lines.some((l) => l.product.alcool),
    };
  },
};
