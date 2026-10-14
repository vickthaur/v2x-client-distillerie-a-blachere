// Panier (maquette) : gardé dans le navigateur (localStorage), synchronisé entre onglets.
// Une ligne = un produit dans une contenance. Les prix sont relus dans le catalogue à chaque
// affichage (jamais stockés) : seuls les prix officiels connus comptent dans le total.
import { bySlug } from '../data/products.js';
import { readJSON, writeJSON } from './store.js';

const KEY = 'blachere-panier';
const VERSION = 2;
const listeners = new Set();

function load() {
  const saved = readJSON(KEY, null);
  if (!saved || saved.v !== VERSION || !Array.isArray(saved.items)) return [];
  return saved.items.filter((i) => bySlug[i.slug] && Number.isInteger(i.qty) && i.qty > 0 && i.qty < 100);
}

let items = load();

function save() {
  writeJSON(KEY, { v: VERSION, items });
  listeners.forEach((fn) => fn(items));
}

addEventListener('storage', (e) => {
  if (e.key !== KEY) return;
  items = load();
  listeners.forEach((fn) => fn(items));
});

const same = (a, slug, ml) => a.slug === slug && (a.ml ?? null) === (ml ?? null);

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
  add(slug, ml = null, qty = 1) {
    const line = items.find((i) => same(i, slug, ml));
    if (line) line.qty = Math.min(99, line.qty + qty);
    else items = [...items, { slug, ml, qty: Math.min(99, qty) }];
    save();
  },
  set(slug, ml, qty) {
    if (qty <= 0) items = items.filter((i) => !same(i, slug, ml));
    else items = items.map((i) => (same(i, slug, ml) ? { ...i, qty: Math.min(99, qty) } : i));
    save();
  },
  clear() {
    items = [];
    save();
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
        const contenance = product.contenances.find((c) => c.ml === i.ml) || null;
        const prix = contenance?.prix ?? null;
        return { ...i, product, contenance, prix, total: prix !== null ? prix * i.qty : null };
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
