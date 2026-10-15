// Opérations du moment (Octobre Rose : 1 € reversé à l'Institut du Cancer Avignon-Provence par
// bouteille de PAC Citron vendue du 1er au 31 octobre 2026). Le module partagé
// src/data/operation.js (sans dépendance au navigateur) fait foi pour la période, les produits
// concernés et le montant ; le serveur s'en sert pour les commandes en ligne et le tableau de bord.
// « Offre valable uniquement sur le site web et en boutique d'usine » : les commandes pro et par
// téléphone ne sont pas concernées.
import { OPERATIONS, donPour, operationEnCours } from '../src/data/operation.js';
import { ajouterJours, jourParis } from './temps.js';
import { euros } from './typo.js';

export { OPERATIONS };

// Délai pendant lequel le tableau de bord montre une opération terminée (virement du don).
export const SUIVI_APRES_FIN_JOURS = 30;

// Don d'une commande en ligne passée à cette date : { id, nom, beneficiaire, bouteilles, montant } ou null.
export function operationPourCommande({ canal, lignes, date }) {
  if (canal !== 'en-ligne') return null;
  const op = operationEnCours(new Date(date));
  if (!op) return null;
  const { bouteilles, montant } = donPour(op, lignes);
  if (bouteilles <= 0) return null;
  return { id: op.id, nom: op.nom, beneficiaire: op.beneficiaire, bouteilles, montant };
}

// Montant en toutes lettres pour le courriel : « 3 € », « 2,50 € ».
const montantCourt = (m) => (Number.isInteger(m) ? `${m} €` : euros(m));

// Paragraphe du courriel de confirmation.
export function phraseDon(operation) {
  const op = OPERATIONS.find((o) => o.id === operation.id);
  const a = op?.beneficiaireAvecArticle || `à ${operation.beneficiaire}`;
  const verbe = operation.montant < 2 ? 'sera reversé' : 'seront reversés';
  const de = /^[aeiouyhâàéèêëîïôûüœ]/i.test(operation.nom) ? 'd’' : 'de ';
  return `Grâce à votre commande, ${montantCourt(operation.montant)} ${verbe} ${a} dans le cadre ${de}${operation.nom}.`;
}

// Bilan pour le tableau de bord : l'opération en cours, ou terminée depuis 30 jours au plus.
// Calculé sur les commandes en ligne non annulées ni remboursées dont le jour (Paris) est dans la
// période ; null sinon.
export function bilanOperation(commandes, instant) {
  const aujourdhui = jourParis(instant);
  const op = OPERATIONS.find((o) => o.debut <= aujourdhui && aujourdhui <= ajouterJours(o.fin, SUIVI_APRES_FIN_JOURS));
  if (!op) return null;
  let bouteilles = 0;
  let nb = 0;
  for (const c of commandes) {
    if (c.canal !== 'en-ligne' || c.statut === 'annulee' || c.statut === 'remboursee') continue;
    const j = jourParis(c.createdAt);
    if (j < op.debut || j > op.fin) continue;
    const d = donPour(op, c.lignes);
    if (d.bouteilles > 0) {
      bouteilles += d.bouteilles;
      nb += 1;
    }
  }
  return {
    id: op.id,
    nom: op.nom,
    beneficiaire: op.beneficiaire,
    debut: op.debut,
    fin: op.fin,
    enCours: aujourdhui <= op.fin,
    bouteilles,
    montant: Math.round(bouteilles * op.montant * 100) / 100,
    commandes: nb,
  };
}
