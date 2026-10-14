// Filtres de la boutique : état ⇄ adresse (query string), filtrage, facettes, tri.
// Fonctions pures (pas de DOM), testées par scripts/qa.mjs à travers la page.
import { FAMILLES, GAMMES, minPrice } from '../data/products.js';
import { fold } from './dom.js';

export const SORTS = ['ventes', 'prix-asc', 'prix-desc', 'nom'];
// Variantes (contenances et coffrets) : id de la variante officielle ⇄ jeton d'adresse.
const VOL_TOKEN = { 500: '50cl', 700: '70cl', 750: '75cl', 1000: '1l', 1500: '1-5l', 1750: '1-75l', coffrets: 'coffret' };
const TOKEN_VOL = Object.fromEntries(Object.entries(VOL_TOKEN).map(([id, t]) => [t, id]));
const VOL_ORDER = ['500', '700', '750', '1000', '1500', '1750', 'coffrets'];

export const emptyState = () => ({
  q: '',
  univers: 'tous',
  gammes: new Set(),
  familles: new Set(),
  volumes: new Set(),
  prix: null,
  degre: null,
  best: false,
  tri: 'ventes',
});

const list = (v) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);
const range = (v) => {
  const m = /^(\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)$/.exec(v || '');
  if (!m) return null;
  const a = parseFloat(m[1].replace(',', '.'));
  const b = parseFloat(m[2].replace(',', '.'));
  return a <= b ? [a, b] : [b, a];
};
const num = (n) => (Math.round(n * 100) / 100).toString();

export function parseState(search) {
  const qs = new URLSearchParams(search);
  const s = emptyState();
  s.q = (qs.get('q') || '').slice(0, 80);
  const u = qs.get('univers');
  if (u === 'sirops' || u === 'spiritueux') s.univers = u;
  list(qs.get('gamme')).forEach((g) => GAMMES.some((x) => x.id === g) && s.gammes.add(g));
  list(qs.get('arome')).forEach((f) => FAMILLES.some((x) => x.id === f) && s.familles.add(f));
  list(qs.get('contenance')).forEach((t) => TOKEN_VOL[t] && s.volumes.add(TOKEN_VOL[t]));
  s.prix = range(qs.get('prix'));
  s.degre = range(qs.get('degre'));
  s.best = qs.get('meilleures') === '1';
  const t = qs.get('tri');
  if (SORTS.includes(t)) s.tri = t;
  return s;
}

export function serializeState(s) {
  const qs = new URLSearchParams();
  if (s.q.trim()) qs.set('q', s.q.trim());
  if (s.univers !== 'tous') qs.set('univers', s.univers);
  if (s.gammes.size) qs.set('gamme', [...s.gammes].join(','));
  if (s.familles.size) qs.set('arome', [...s.familles].join(','));
  if (s.volumes.size) qs.set('contenance', [...s.volumes].sort((a, b) => VOL_ORDER.indexOf(a) - VOL_ORDER.indexOf(b)).map((v) => VOL_TOKEN[v]).join(','));
  if (s.prix) qs.set('prix', `${num(s.prix[0])}-${num(s.prix[1])}`);
  if (s.degre) qs.set('degre', `${num(s.degre[0])}-${num(s.degre[1])}`);
  if (s.best) qs.set('meilleures', '1');
  if (s.tri !== 'ventes') qs.set('tri', s.tri);
  const str = qs.toString().replace(/%2C/g, ',');
  return str ? `?${str}` : '';
}

const famName = Object.fromEntries(FAMILLES.map((f) => [f.id, f.nom]));
function haystack(p) {
  return fold([p.nom, p.nomOfficiel, p.gammeNom, p.type, p.arome, famName[p.famille], p.phraseAlcool ? '' : p.phrase, p.univers === 'sirops' ? 'sirop sans alcool' : 'spiritueux alcool'].join(' '));
}
const hay = new Map();

// Un produit passe-t-il les filtres (en ignorant éventuellement un groupe, pour les facettes) ?
export function matches(p, s, ignore = null) {
  if (ignore !== 'univers' && s.univers !== 'tous' && p.univers !== s.univers) return false;
  if (ignore !== 'gammes' && s.gammes.size && !s.gammes.has(p.gamme)) return false;
  if (ignore !== 'familles' && s.familles.size && !s.familles.has(p.famille)) return false;
  if (ignore !== 'volumes' && s.volumes.size && !p.contenances.some((c) => s.volumes.has(c.id))) return false;
  if (ignore !== 'prix' && s.prix) {
    const ok = p.contenances.some((c) => c.prix !== null && c.prix >= s.prix[0] - 1e-9 && c.prix <= s.prix[1] + 1e-9);
    if (!ok) return false;
  }
  if (ignore !== 'degre' && s.degre && !(p.degre !== null && p.degre >= s.degre[0] && p.degre <= s.degre[1])) return false;
  if (ignore !== 'best' && s.best && !p.bestSeller) return false;
  if (ignore !== 'q' && s.q.trim()) {
    if (!hay.has(p.slug)) hay.set(p.slug, haystack(p));
    const words = fold(s.q).split(/\s+/).filter(Boolean);
    if (!words.every((w) => hay.get(p.slug).includes(w))) return false;
  }
  return true;
}

export function sortProducts(items, tri) {
  const byName = (a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' });
  const price = (p) => minPrice(p);
  const out = [...items];
  if (tri === 'nom') return out.sort(byName);
  if (tri === 'prix-asc' || tri === 'prix-desc') {
    const dir = tri === 'prix-asc' ? 1 : -1;
    return out.sort((a, b) => {
      const pa = price(a);
      const pb = price(b);
      if (pa === null && pb === null) return byName(a, b);
      if (pa === null) return 1; // sans prix en ligne : toujours à la fin
      if (pb === null) return -1;
      return (pa - pb) * dir || byName(a, b);
    });
  }
  // Meilleures ventes d'abord (seul classement connu : le bloc « Best sellers » du site officiel),
  // puis l'ordre des gammes de la boutique officielle, puis le nom.
  const g = Object.fromEntries(GAMMES.map((x, i) => [x.id, i]));
  return out.sort((a, b) => Number(b.bestSeller) - Number(a.bestSeller) || g[a.gamme] - g[b.gamme] || byName(a, b));
}

export function applyFilters(base, s) {
  return sortProducts(
    base.filter((p) => matches(p, s)),
    s.tri,
  );
}

// Facettes : options présentes dans les produits visibles, avec le nombre de résultats que
// donnerait chaque option (les autres filtres restant actifs).
export function facets(base, s) {
  const count = (group, test) => base.filter((p) => matches(p, s, group) && test(p)).length;
  const vols = [...new Set(base.flatMap((p) => p.contenances.map((c) => c.id)))].filter((id) => VOL_TOKEN[id]).sort((a, b) => VOL_ORDER.indexOf(a) - VOL_ORDER.indexOf(b));
  const prices = base.flatMap((p) => p.contenances.map((c) => c.prix)).filter((x) => x !== null);
  const degrees = [...new Set(base.map((p) => p.degre).filter((d) => d !== null))].sort((a, b) => a - b);
  return {
    univers: ['sirops', 'spiritueux'].filter((u) => base.some((p) => p.univers === u)).map((u) => ({ id: u, n: count('univers', (p) => p.univers === u) })),
    gammes: GAMMES.filter((g) => base.some((p) => p.gamme === g.id)).map((g) => ({ ...g, n: count('gammes', (p) => p.gamme === g.id) })),
    familles: FAMILLES.filter((f) => base.some((p) => p.famille === f.id)).map((f) => ({ ...f, n: count('familles', (p) => p.famille === f.id) })),
    volumes: vols.map((id) => ({ ml: id, label: volumeLabel(id), n: count('volumes', (p) => p.contenances.some((c) => c.id === id)) })),
    prix: prices.length >= 2 ? [Math.min(...prices), Math.max(...prices)] : null,
    degre: degrees.length >= 2 ? [degrees[0], degrees[degrees.length - 1]] : null,
    best: base.some((p) => p.bestSeller) ? count('best', (p) => p.bestSeller) : 0,
  };
}

export function activeCount(s) {
  return (s.q.trim() ? 1 : 0) + (s.univers !== 'tous' ? 1 : 0) + s.gammes.size + s.familles.size + s.volumes.size + (s.prix ? 1 : 0) + (s.degre ? 1 : 0) + (s.best ? 1 : 0);
}

export const volumeLabel = (id) => (id === 'coffrets' ? 'Coffret' : Number(id) >= 1000 ? `${String(Number(id) / 1000).replace('.', ',')} L` : `${Number(id) / 10} cl`);
