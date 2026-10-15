// Commande en cours de l'espace pro : gardée dans le navigateur (localStorage), par utilisateur
// (clé blachere-pro-commande-<id>), synchronisée entre onglets. Le navigateur ne garde que des
// quantités ; prix, totaux, franco et stocks sont toujours recalculés par le serveur (devis).
// Une ligne : { slug, varianteId, qte } — qte en bouteilles (ou coffrets), par multiples du colisage.
import { useEffect, useState } from 'preact/hooks';
import { readJSON, writeJSON } from '../lib/store.js';

const VERSION = 1;
const MAX = 999; // bouteilles par produit, comme le serveur
let uid = null;
let state = vide();
const listeners = new Set();

function vide() {
  return { lignes: [], adresseId: null, dateSouhaitee: '', referenceClient: '', commentaire: '' };
}
const key = () => `blachere-pro-commande-${uid}`;

function load() {
  const saved = uid ? readJSON(key(), null) : null;
  if (!saved || saved.v !== VERSION || !saved.state || !Array.isArray(saved.state.lignes)) return vide();
  const lignes = saved.state.lignes.filter((l) => l && typeof l.slug === 'string' && l.varianteId != null && Number.isInteger(l.qte) && l.qte > 0 && l.qte <= MAX);
  return { ...vide(), ...saved.state, lignes };
}

function emit() {
  listeners.forEach((fn) => fn(state));
}

function save() {
  if (uid) writeJSON(key(), { v: VERSION, state });
  emit();
}

addEventListener('storage', (e) => {
  if (!uid || e.key !== key()) return;
  state = load();
  emit();
});

const same = (l, slug, varianteId) => l.slug === slug && String(l.varianteId) === String(varianteId);

export const panier = {
  // Ouvre la commande en cours de l'utilisateur connecté.
  ouvrir(id) {
    if (uid === id) return;
    uid = id;
    state = load();
    emit();
  },
  get state() {
    return state;
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  qte(slug, varianteId) {
    return state.lignes.find((l) => same(l, slug, varianteId))?.qte || 0;
  },
  // Quantité d'une ligne (0 : la ligne est retirée).
  set(slug, varianteId, qte) {
    const q = Math.max(0, Math.min(MAX, Math.round(Number(qte) || 0)));
    const has = state.lignes.some((l) => same(l, slug, varianteId));
    let lignes;
    if (!q) lignes = state.lignes.filter((l) => !same(l, slug, varianteId));
    else if (has) lignes = state.lignes.map((l) => (same(l, slug, varianteId) ? { ...l, qte: q } : l));
    else lignes = [...state.lignes, { slug, varianteId: String(varianteId), qte: q }];
    state = { ...state, lignes };
    save();
  },
  // Ajoute des lignes (recommander) : les quantités s'additionnent aux lignes existantes.
  ajouter(lignes) {
    let next = [...state.lignes];
    for (const l of lignes) {
      const i = next.findIndex((x) => same(x, l.slug, l.varianteId));
      if (i >= 0) next[i] = { ...next[i], qte: Math.min(MAX, next[i].qte + l.qte) };
      else next.push({ slug: l.slug, varianteId: String(l.varianteId), qte: l.qte });
    }
    next = next.filter((l) => l.qte > 0);
    state = { ...state, lignes: next };
    save();
  },
  // Adresse, date souhaitée, référence, commentaire.
  meta(patch) {
    state = { ...state, ...patch };
    save();
  },
  vider() {
    state = vide();
    save();
  },
};

export function usePanier() {
  const [s, set] = useState(panier.state);
  useEffect(() => {
    set(panier.state);
    return panier.subscribe(set);
  }, []);
  return s;
}
