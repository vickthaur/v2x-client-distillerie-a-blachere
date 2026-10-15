// Journal d'activité et boîte d'envoi d'une démo (plafonnés à 500 entrées chacun, voir demo.js).
import { idAleatoire } from './aleatoire.js';
import { iso } from './temps.js';
import { typo } from './typo.js';

export const PAR_SITE = Object.freeze({ nom: 'Site' });
export const PAR_SYSTEME = Object.freeze({ nom: 'Système' });

export const nomComplet = (u) => `${u.prenom} ${u.nom}`.trim();
// Auteur d'une action : { id, nom, role } pour une personne.
export const auteur = (u) => (u ? { id: u.id, nom: nomComplet(u), role: u.role } : PAR_SYSTEME);
// Forme courte (historique des commandes, notes) : { id, nom }.
export const auteurCourt = (u) => (u ? { id: u.id, nom: nomComplet(u) } : PAR_SYSTEME);

// Entrée du journal : action en code (« commande.statut »), cible { type, id, libelle }, détails en
// français.
export function journaliser(doc, date, { par = PAR_SYSTEME, action, cible, details, id }) {
  const e = { id: id || idAleatoire('jrn'), date: iso(date), par: { ...par }, action };
  if (cible) e.cible = { type: cible.type, id: cible.id, libelle: typo(cible.libelle) };
  if (details) e.details = typo(details);
  doc.journal.push(e);
  return e;
}

// Dépose un courriel (gabarit de courriels.js) dans la boîte d'envoi.
export function deposerCourriel(doc, date, courriel, id) {
  const c = { id: id || idAleatoire('crl'), date: iso(date), ...courriel };
  doc.courriels.push(c);
  return c;
}
