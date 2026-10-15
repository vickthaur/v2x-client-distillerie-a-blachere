// Forme stockée et forme rendue des éléments d'une démo.
//
// Le document ne répète pas ce qui se recalcule (docs/crm-espace-pro.md, § 4, « stockage compact ») :
// - ligne stockée : { slug, varianteId, qte, prixUnitaireTTC } (particulier) ou
//   { slug, varianteId, qte, prixUnitaireHT, colisage } (pro) ; nom, volume, alcool, TVA, autres prix
//   et totaux de ligne viennent du catalogue et des règles ;
// - totaux : recalculés par les règles du § 5 depuis les lignes, la remise (promo) et le port
//   (livraison.prixTTC, ou livraison.prixHT pour un pro) ;
// - contact et adresse de livraison absents → ceux du client (ou du compte et de son adresse
//   adresseId) ; libellé de livraison, action par défaut de l'historique, notes vides : déduits.
// - valeurs par défaut omises : prix unitaire TTC égal au prix officiel du catalogue, colisage par
//   défaut, échéance de facture égale à sa date, date de paiement égale à la création, updatedAt égal
//   à la dernière étape de l'historique, auteur d'une étape donné par son seul identifiant (absent :
//   « Système »), date de la première étape égale à la création ;
// - séance : capacité, langue et statut par défaut omis ; abonné « inscrit », client sans étiquette
//   ni note, réservation sans mineur ni newsletter : champs omis.
// L'API rend toujours les éléments complets du modèle (commandeComplete, seanceComplete…).
import { produit as produitDe } from './catalogue.js';
import { colisageParDefaut, LIBELLES_LIVRAISON, LIBELLES_STATUTS, ligneParticulier, lignePro, totauxParticulier, totauxPro } from './regles.js';

const ACTIONS = {
  nouvelle: 'Commande passée',
  'en-preparation': 'Préparation commencée',
  prete: 'Prête au retrait',
  expediee: 'Expédiée',
  livree: 'Livrée',
  retiree: 'Retirée',
  annulee: 'Annulée',
  remboursee: 'Remboursée',
};
export const actionParDefaut = (statut) => ACTIONS[statut] || LIBELLES_STATUTS[statut] || '';

// Index d'un document (à construire une fois par requête).
export function index(doc) {
  return {
    clients: new Map(doc.clients.map((c) => [c.id, c])),
    comptes: new Map(doc.comptes.map((c) => [c.id, c])),
    utilisateurs: new Map(doc.utilisateurs.map((u) => [u.id, u])),
  };
}

// Ligne complète (modèle Ligne du § 4).
export function ligneComplete(l, canal) {
  const p = produitDe(l.slug);
  const v = p?.variantes.find((x) => x.id === l.varianteId);
  const base = { slug: l.slug, varianteId: l.varianteId, nom: p?.nom ?? l.nom ?? l.slug, volume: v?.volume ?? l.volume ?? '', alcool: p?.alcool ?? !!l.alcool, qte: l.qte };
  if (canal === 'pro') return lignePro({ ...base, prixHT: l.prixUnitaireHT, colisage: l.colisage ?? (v ? colisageParDefaut(v, p) : 1) });
  return ligneParticulier({ ...base, prixTTC: l.prixUnitaireTTC ?? v?.prixTTC ?? 0 });
}

// Totaux d'une commande (stockée) d'après ses lignes complètes.
export function totauxCommande(c, lignes = c.lignes.map((l) => ligneComplete(l, c.canal))) {
  if (c.canal === 'pro') return totauxPro(lignes, { livraisonHT: c.livraison?.prixHT || 0 });
  const remiseTTC = c.promo && !c.promo.livraisonOfferte ? c.promo.remiseTTC : 0;
  return totauxParticulier(lignes, { remiseTTC, livraisonTTC: c.livraison?.prixTTC || 0 });
}

// Contact d'une commande : le sien, sinon celui du client ou du compte.
export function contactDe(c, idx) {
  if (c.contact) return c.contact;
  if (c.clientId) {
    const k = idx.clients.get(c.clientId);
    if (k) {
      const out = { nom: `${k.prenom} ${k.nom}`, email: k.email };
      if (k.telephone) out.telephone = k.telephone;
      return out;
    }
  }
  if (c.compteId) {
    const k = idx.comptes.get(c.compteId);
    if (k) {
      const out = { nom: k.enseigne, email: k.email };
      if (k.telephone) out.telephone = k.telephone;
      return out;
    }
  }
  return { nom: 'Client', email: '' };
}

export function livraisonDe(c, idx, totaux) {
  const l = { ...c.livraison };
  l.libelle = l.libelle || LIBELLES_LIVRAISON[l.mode] || l.mode;
  if (c.canal === 'pro') l.prixTTC = totaux.livraisonTTC;
  if (!l.adresse && l.mode !== 'retrait' && !c.anonymise) {
    if (c.canal === 'pro' && c.compteId) {
      const k = idx.comptes.get(c.compteId);
      const a = k?.adressesLivraison.find((x) => x.id === l.adresseId) || k?.adressesLivraison[0];
      if (a) l.adresse = { ...a };
    } else if (c.clientId) {
      const k = idx.clients.get(c.clientId);
      if (k?.adresse) l.adresse = { nom: `${k.prenom} ${k.nom}`, ...k.adresse };
    }
  }
  return l;
}

// Auteur d'une étape : { id, nom } (le nom se déduit de l'identifiant s'il manque).
export function parComplet(par, idx) {
  if (!par) return { nom: 'Système' };
  if (par.nom) return par;
  const u = idx.utilisateurs.get(par.id);
  return { id: par.id, nom: u ? `${u.prenom} ${u.nom}` : 'Utilisateur' };
}

// Action par défaut de la création : selon le canal et l'auteur.
function actionCreation(c, par, idx) {
  if (c.canal === 'en-ligne' && !par.id) return 'Commande passée sur le site';
  const u = par.id ? idx.utilisateurs.get(par.id) : null;
  if (c.canal === 'pro' && u?.role === 'pro') return 'Commande passée dans l’espace pro';
  if (u) return `Commande saisie par ${u.prenom} ${u.nom}`;
  return actionParDefaut('nouvelle');
}

// Commande complète (modèle Commande du § 4).
export function commandeComplete(c, idx) {
  const lignes = c.lignes.map((l) => ligneComplete(l, c.canal));
  const totaux = totauxCommande(c, lignes);
  const historique = c.historique.map((h, i) => {
    const par = parComplet(h.par, idx);
    const action = h.action || (i === 0 && h.statut === 'nouvelle' ? actionCreation(c, par, idx) : actionParDefaut(h.statut));
    return { ...h, date: h.date || c.createdAt, action, par };
  });
  const out = {
    ...c,
    contact: contactDe(c, idx),
    lignes,
    totaux,
    livraison: livraisonDe(c, idx, totaux),
    paiement: { ...c.paiement },
    historique,
    notes: (c.notes || []).map((n) => ({ ...n, par: parComplet(n.par, idx) })),
    updatedAt: c.updatedAt || historique[historique.length - 1]?.date || c.createdAt,
  };
  if (!out.paiement.date && (out.paiement.statut === 'paye' || out.paiement.statut === 'rembourse') && c.canal !== 'pro') out.paiement.date = c.createdAt;
  if (c.facture) out.facture = { ...c.facture, echeance: c.facture.echeance || c.facture.date };
  return out;
}

// Toutes les commandes complètes d'un document (une fois par requête).
export function commandesCompletes(doc, idx = index(doc)) {
  return doc.commandes.map((c) => commandeComplete(c, idx));
}

// ---------- Autres éléments ----------

export function seanceComplete(s, parametres) {
  return { ...s, capacite: s.capacite ?? parametres.visites.capacite, langue: s.langue || 'fr', statut: s.statut || 'ouverte' };
}
export const reservationComplete = (r) => ({ ...r, mineurs: r.mineurs || 0, newsletter: !!r.newsletter });
export const abonneComplet = (a) => ({ ...a, statut: a.statut || 'inscrit' });
export const clientComplet = (k) => ({ ...k, tags: k.tags || [], notes: k.notes || '', newsletter: !!k.newsletter });

// ---------- Personnes ----------

// Utilisateur public (§ 7) : jamais de haché, de jeton ni de compteur d'échecs.
export function utilisateurPublic(u, { droits } = {}) {
  const out = { id: u.id, prenom: u.prenom, nom: u.nom, email: u.email, role: u.role };
  if (u.compteId) out.compteId = u.compteId;
  if (u.telephone) out.telephone = u.telephone;
  if (u.poste) out.poste = u.poste;
  if (u.derniereConnexion) out.derniereConnexion = u.derniereConnexion;
  if (droits) out.droits = droits;
  return out;
}

export const compteResume = (k) => ({ id: k.id, raisonSociale: k.raisonSociale, enseigne: k.enseigne });

// ---------- Compactage (jeu de démonstration) ----------
// Retire d'un élément stocké ce que la forme complète redonne à l'identique : la forme complète
// d'un élément compacté est égale à celle de l'élément d'origine (vérifié par les tests).

export function compacterCommande(c, idx) {
  const complete = commandeComplete(c, idx);
  for (const l of c.lignes) {
    const p = produitDe(l.slug);
    const v = p?.variantes.find((x) => x.id === l.varianteId);
    if (!v) continue;
    if (c.canal !== 'pro' && l.prixUnitaireTTC === v.prixTTC) delete l.prixUnitaireTTC;
    if (c.canal === 'pro' && l.colisage === colisageParDefaut(v, p)) delete l.colisage;
  }
  c.historique.forEach((h, i) => {
    const u = h.par?.id ? idx.utilisateurs.get(h.par.id) : null;
    if (u && h.par.nom === `${u.prenom} ${u.nom}`) h.par = { id: h.par.id };
    if (h.par && !h.par.id && h.par.nom === 'Système') delete h.par;
    if (i === 0 && h.date === c.createdAt) delete h.date;
    const defaut = i === 0 && h.statut === 'nouvelle' ? actionCreation(c, parComplet(h.par, idx), idx) : actionParDefaut(h.statut);
    if (h.action && h.action === defaut && h.statut) delete h.action;
  });
  if (c.canal !== 'pro' && c.paiement?.date === c.createdAt && (c.paiement.statut === 'paye' || c.paiement.statut === 'rembourse')) delete c.paiement.date;
  if (c.facture && c.facture.echeance === c.facture.date) delete c.facture.echeance;
  if (c.notes && !c.notes.length) delete c.notes;
  if (c.livraison?.libelle && c.livraison.libelle === LIBELLES_LIVRAISON[c.livraison.mode]) delete c.livraison.libelle;
  const avant = c.updatedAt;
  delete c.updatedAt;
  if (commandeComplete(c, idx).updatedAt !== avant) c.updatedAt = avant;
  return complete;
}

export function compacterSeance(s, parametres) {
  if (s.capacite === parametres.visites.capacite) delete s.capacite;
  if (s.langue === 'fr') delete s.langue;
  if (s.statut === 'ouverte') delete s.statut;
  return s;
}
export function compacterReservation(r) {
  if (!r.mineurs) delete r.mineurs;
  if (r.newsletter === false) delete r.newsletter;
  return r;
}
export function compacterAbonne(a) {
  if (a.statut === 'inscrit') delete a.statut;
  return a;
}
export function compacterClient(k) {
  if (Array.isArray(k.tags) && !k.tags.length) delete k.tags;
  if (k.notes === '') delete k.notes;
  return k;
}
