// Lectures communes aux vues de l'espace pro (montants, dates, échéances) et actions partagées
// (recommander une commande).
import { pro } from './donnees.js';
import { panier } from './panier.js';
import { pluriel } from './format.js';

export const totalHT = (c) => c?.totaux?.totalHT ?? c?.totalHT ?? null;
export const totalTTC = (c) => c?.totaux?.totalTTC ?? c?.totalTTC ?? null;
export const dateDe = (c) => c?.date || c?.createdAt || null;

// Échéance dépassée et facture non payée (calculé, jamais stocké : docs § 5).
export function enRetard(f) {
  if (!f || f.statut === 'payee' || !f.echeance) return Boolean(f?.enRetard);
  if (typeof f.enRetard === 'boolean') return f.enRetard;
  const today = new Date();
  const j = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return String(f.echeance).slice(0, 10) < j;
}
export function joursRetard(f) {
  if (Number.isFinite(f?.joursRetard)) return f.joursRetard;
  const e = new Date(`${String(f?.echeance).slice(0, 10)}T12:00:00`);
  return Math.max(0, Math.floor((Date.now() - e.getTime()) / 86400000));
}

// Lignes envoyées au serveur : uniquement des quantités (docs § 5).
export const devisLignes = (lignes) => lignes.map((l) => ({ slug: l.slug, varianteId: String(l.varianteId), qte: l.qte }));

// Recommander : lignes encore disponibles de la commande, ajoutées à la commande en cours.
export async function recommander(id) {
  const r = await pro('recommander', { query: { id } });
  const lignes = (Array.isArray(r) ? r : r?.lignes || []).filter((l) => l && l.slug && l.varianteId != null && l.qte > 0);
  const absents = Array.isArray(r?.indisponibles) ? r.indisponibles : Array.isArray(r?.retirees) ? r.retirees : [];
  if (!lignes.length) {
    const e = new Error('Aucun article de cette commande n’est disponible aujourd’hui.');
    throw e;
  }
  panier.ajouter(lignes.map((l) => ({ slug: l.slug, varianteId: l.varianteId, qte: l.qte })));
  const message = absents.length
    ? `${pluriel(lignes.length, 'ligne ajoutée', 'lignes ajoutées')} à la commande · ${pluriel(absents.length, 'article indisponible', 'articles indisponibles')}`
    : `${pluriel(lignes.length, 'ligne ajoutée', 'lignes ajoutées')} à la commande en cours`;
  return { lignes, absents, message };
}
