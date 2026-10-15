// Opérations métier sur le document d'une démo, partagées par les routes (site, CRM, espace pro) :
// commandes (création, transitions et leurs effets : stock, facture, courriels, journal), clients et
// abonnés, encours des comptes pro, disponibilités des visites. Toutes s'exécutent dans une mutation
// (demo.js) : fonctions synchrones du document, rejouables.
import { idAleatoire } from './aleatoire.js';
import { produit as produitDe } from './catalogue.js';
import * as C from './courriels.js';
import { auteurCourt, deposerCourriel, journaliser, nomComplet, PAR_SITE } from './evenements.js';
import { erreur } from './http.js';
import { commandeComplete, index, ligneComplete, seanceComplete, totauxCommande } from './modele.js';
import { operationPourCommande } from './operation.js';
import {
  appliquerPromo,
  controlerTransition,
  echeance,
  enRetard,
  etatStock,
  fraisLivraison,
  fraisPortPro,
  jourDeVisite,
  LIBELLES_LIVRAISON,
  LIBELLES_STATUTS,
  libelleSeance,
  licenceAlcool,
  MOMENTS,
  placesRestantes,
  prixCompteHT,
  prochainNumero,
  versCentimes,
  versEuros,
} from './regles.js';
import { ajouterJours, instantParis, iso, jourParis } from './temps.js';
import { euros, jourEtMois, joursSemaine, typo } from './typo.js';

// Adresses du CRM vers un élément (boutons « Voir dans le CRM »).
export const LIENS_CRM = {
  commande: (id) => `/crm/commandes/${id}`,
  client: (id) => `/crm/clients/${id}`,
  compte: (id) => `/crm/comptes/${id}`,
  demande: (id) => `/crm/demandes/${id}`,
  reservation: (id) => `/crm/visites/${id}`,
  message: (id) => `/crm/messages/${id}`,
  abonne: (id) => `/crm/newsletter/${id}`,
  campagne: (id) => `/crm/newsletter/campagnes/${id}`,
  produit: (slug) => `/crm/produits/${slug}`,
};

// ---------- Produits demandés ----------

// Résout des lignes { slug, varianteId, qte } : produit du catalogue, en vente dans la démo.
// pourCompte : compte pro (licence contrôlée).
export function resoudreLignes(doc, lignes, { pourCompte = null } = {}) {
  return lignes.map((l) => {
    const p = produitDe(l.slug);
    const pd = p ? doc.produits[l.slug] : null;
    const v = p?.variantes.find((x) => x.id === l.varianteId);
    const d = pd?.variantes[l.varianteId];
    if (!p || !v || !d || !pd.actif || !p.enLigne) {
      throw erreur(400, `Produit indisponible : ${p ? `${p.nom}${v ? ` ${v.volume}` : ''}` : l.slug} n’est pas en vente.`, { champ: 'lignes', code: 'produit', slug: l.slug, varianteId: l.varianteId });
    }
    if (pourCompte && p.alcool && !licenceAlcool(pourCompte.licence)) {
      throw erreur(403, `${p.nom} : la vente de boissons alcoolisées demande une licence adaptée, qui n’est pas enregistrée pour ce compte.`, { champ: 'lignes', code: 'licence', slug: l.slug });
    }
    return { ...l, p, v, d };
  });
}

// Stock insuffisant → 409 { code: 'stock', details: [{ slug, varianteId, nom, demande, disponible }] }.
export function controlerStock(items) {
  const manques = items.filter((x) => x.qte > x.d.stock).map((x) => ({ slug: x.slug, varianteId: x.varianteId, nom: `${x.p.nom} ${x.v.volume}`, demande: x.qte, disponible: Math.max(0, x.d.stock) }));
  if (manques.length) {
    const texte = manques.map((x) => (x.disponible ? `${x.nom} (${x.disponible} disponible${x.disponible > 1 ? 's' : ''})` : `${x.nom} (en rupture)`)).join(', ');
    throw erreur(409, `Stock insuffisant : ${texte}.`, { champ: 'lignes', code: 'stock', details: manques });
  }
}

function mouvement(doc, date, { slug, varianteId, delta, motif, par, commandeId, note }) {
  const mv = { id: idAleatoire('mvt'), date: iso(date), slug, varianteId, delta, motif, par };
  if (commandeId) mv.commandeId = commandeId;
  if (note) mv.note = note;
  doc.mouvements.push(mv);
  return mv;
}

export function sortirStock(doc, date, commande, par) {
  for (const l of commande.lignes) {
    doc.produits[l.slug].variantes[l.varianteId].stock -= l.qte;
    mouvement(doc, date, { slug: l.slug, varianteId: l.varianteId, delta: -l.qte, motif: 'vente', par, commandeId: commande.id });
  }
}

export function rentrerStock(doc, date, commande, par) {
  for (const l of commande.lignes) {
    const v = doc.produits[l.slug]?.variantes[l.varianteId];
    if (!v) continue;
    v.stock += l.qte;
    mouvement(doc, date, { slug: l.slug, varianteId: l.varianteId, delta: l.qte, motif: 'annulation', par, commandeId: commande.id });
  }
}

export function ajusterStock(doc, date, { slug, varianteId, delta, motif, par, note }) {
  const v = doc.produits[slug]?.variantes[varianteId];
  if (!v) throw erreur(404, 'Produit introuvable.');
  if (v.stock + delta < 0) throw erreur(409, `Le stock ne peut pas devenir négatif (stock actuel : ${v.stock}).`, { champ: 'delta', code: 'stock' });
  v.stock += delta;
  return mouvement(doc, date, { slug, varianteId, delta, motif, par, note });
}

export { etatStock };

// ---------- Clients et abonnés ----------

export function trouverClient(doc, email) {
  return doc.clients.find((c) => c.email === email) || null;
}

export function inscrireAbonne(doc, date, { email, prenom, source }) {
  const a = doc.abonnes.find((x) => x.email === email);
  if (a && (a.statut || 'inscrit') === 'inscrit') return { abonne: a, deja: true };
  if (a) {
    a.statut = 'inscrit';
    a.inscritLe = iso(date);
    delete a.desinscritLe;
    if (prenom && !a.prenom) a.prenom = prenom;
    return { abonne: a, deja: false, reinscrit: true };
  }
  const nouveau = { id: idAleatoire('abo'), email, source, statut: 'inscrit', inscritLe: iso(date) };
  if (prenom) nouveau.prenom = prenom;
  doc.abonnes.push(nouveau);
  const client = trouverClient(doc, email);
  if (client) client.newsletter = true;
  return { abonne: nouveau, deja: false };
}

// Client d'une commande en ligne ou par téléphone : retrouvé par e-mail, sinon créé.
export function clientPourCommande(doc, date, { prenom, nom, email, telephone, adresse }, { origine }) {
  let c = trouverClient(doc, email);
  if (!c) {
    c = { id: idAleatoire('cli'), prenom, nom, email, newsletter: false, tags: [], notes: '', origine, createdAt: iso(date) };
    if (telephone) c.telephone = telephone;
    if (adresse) c.adresse = { ...adresse };
    delete c.adresse?.nom;
    doc.clients.push(c);
    return { client: c, nouveau: true };
  }
  if (telephone && !c.telephone) c.telephone = telephone;
  if (adresse && !c.adresse) {
    c.adresse = { ...adresse };
    delete c.adresse.nom;
  }
  return { client: c, nouveau: false };
}

// ---------- Factures et encours ----------

export function emettreFacture(doc, commande, date, { conditions = 'comptant', payee = false } = {}) {
  const jour = jourParis(date);
  const f = { numero: prochainNumero(doc, 'facture', date), date: jour, echeance: echeance(jour, conditions), statut: payee ? 'payee' : 'a-regler' };
  if (payee) f.payeeLe = jour;
  commande.facture = f;
  return f;
}

// Encours d'un compte : factures non réglées (TTC) de ses commandes non annulées.
export function encoursCompte(doc, compteId, idx = index(doc)) {
  let c = 0;
  for (const cmd of doc.commandes) {
    if (cmd.compteId !== compteId || cmd.statut === 'annulee' || cmd.facture?.statut !== 'a-regler') continue;
    c += versCentimes(totauxCommande(cmd).totalTTC);
  }
  return versEuros(c);
}

export const facturesEnRetard = (doc, aujourdhui) => doc.commandes.filter((c) => c.statut !== 'annulee' && enRetard(c.facture && { ...c.facture, echeance: c.facture.echeance || c.facture.date }, aujourdhui));

// ---------- Création des commandes ----------

// Commande d'un particulier (site : canal « en-ligne » ; CRM : « telephone »). donnees validées :
// { client: { prenom, nom, email, telephone }, livraison: { mode, adresse?, jourRetrait? },
//   paiement: { mode, statut? }, lignes, code?, ageConfirme, newsletter }.
export function creerCommandeParticulier(doc, m, donnees, { canal, par, auteurId, note }) {
  const date = m.maintenant;
  const items = resoudreLignes(doc, donnees.lignes);
  const alcool = items.some((x) => x.p.alcool);
  if (alcool && donnees.ageConfirme !== true) {
    throw erreur(400, 'La vente d’alcool est réservée aux personnes majeures : confirmez avoir 18 ans ou plus.', { champ: 'ageConfirme', code: 'age' });
  }
  controlerStock(items);
  const lignes = items.map((x) => ({ slug: x.slug, varianteId: x.varianteId, qte: x.qte, prixUnitaireTTC: x.d.prixTTC }));
  const completes = lignes.map((l) => ligneComplete(l, canal));
  const articlesTTC = versEuros(completes.reduce((s, l) => s + versCentimes(l.totalTTC), 0));
  const bouteilles = lignes.reduce((s, l) => s + l.qte, 0);
  const mode = donnees.livraison.mode;
  let livraisonTTC = fraisLivraison(mode, { bouteilles, articlesTTC, parametres: doc.parametres });
  let promo = null;
  let promoDoc = null;
  if (donnees.code) {
    promoDoc = doc.promos.find((p) => p.code === donnees.code);
    const r = appliquerPromo(promoDoc, { articlesTTC, aujourdhui: jourParis(date) });
    if (r.livraisonOfferte) {
      promo = { code: promoDoc.code, remiseTTC: livraisonTTC, livraisonOfferte: true };
      livraisonTTC = 0;
    } else promo = { code: promoDoc.code, remiseTTC: r.remiseTTC };
  }
  const { client } = clientPourCommande(doc, date, { ...donnees.client, adresse: donnees.livraison.adresse }, { origine: canal === 'telephone' ? 'boutique' : 'boutique-en-ligne' });
  const livraison = { mode, libelle: LIBELLES_LIVRAISON[mode], prixTTC: livraisonTTC };
  if (mode === 'retrait') livraison.jourRetrait = donnees.livraison.jourRetrait;
  else {
    livraison.adresse = { nom: `${donnees.client.prenom} ${donnees.client.nom}`, ...donnees.livraison.adresse };
    if (mode === 'relais') {
      livraison.relais = { nom: 'Point relais de démonstration', adresse: { ligne1: 'Commerce partenaire le plus proche', cp: donnees.livraison.adresse.cp, ville: donnees.livraison.adresse.ville, pays: 'France' } };
    }
  }
  // payé d'office : carte et PayPal ; virement, à réception, comptant : en attente (sauf mention contraire)
  const paye = donnees.paiement.statut ? donnees.paiement.statut === 'paye' : ['carte', 'paypal'].includes(donnees.paiement.mode);
  const paiement = { mode: donnees.paiement.mode, statut: paye ? 'paye' : 'en-attente' };
  if (paye) paiement.date = iso(date);
  if (donnees.paiement.mode === 'virement') paiement.reference = `VIR-${idAleatoire('', 6).toUpperCase()}`;
  else if (paye) paiement.reference = `DEMO-${idAleatoire('', 8).toUpperCase()}`;
  const contact = { nom: `${donnees.client.prenom} ${donnees.client.nom}`, email: donnees.client.email };
  if (donnees.client.telephone) contact.telephone = donnees.client.telephone;
  const c = {
    id: idAleatoire('cmd'),
    numero: prochainNumero(doc, 'web', date),
    canal,
    clientId: client.id,
    contact,
    lignes,
    livraison,
    paiement,
    statut: 'nouvelle',
    historique: [{ date: iso(date), statut: 'nouvelle', action: canal === 'telephone' ? `Commande saisie par ${par.nom} (téléphone)` : 'Commande passée sur le site', par: { ...par } }],
    notes: [],
    createdAt: iso(date),
    updatedAt: iso(date),
  };
  if (auteurId) c.auteurId = auteurId;
  if (promo) c.promo = promo;
  if (alcool) c.ageConfirme = true;
  if (note) c.notes.push({ date: iso(date), par: { ...par }, texte: note });
  const operation = operationPourCommande({ canal, lignes, date });
  if (operation) c.operation = operation;
  // facture à la création (payée, ou à régler sous 7 jours pour un virement)
  const f = emettreFacture(doc, c, date, { payee: paye });
  if (!paye) f.echeance = ajouterJours(f.date, 7);
  sortirStock(doc, date, c, canal === 'telephone' ? { ...par } : { ...PAR_SITE });
  if (promoDoc) promoDoc.utilisations = (promoDoc.utilisations || 0) + 1;
  doc.commandes.push(c);
  const complete = commandeComplete(c, index(doc));
  journaliser(doc, date, {
    par: canal === 'telephone' ? par : PAR_SITE,
    action: 'commande.creation',
    cible: { type: 'commande', id: c.id, libelle: `Commande ${c.numero}` },
    details: `${bouteilles} article${bouteilles > 1 ? 's' : ''}, ${euros(complete.totaux.totalTTC)} TTC`,
  });
  deposerCourriel(doc, date, C.confirmationCommande(complete));
  if (donnees.newsletter) {
    const r = inscrireAbonne(doc, date, { email: donnees.client.email, prenom: donnees.client.prenom, source: 'commande' });
    if (!r.deja) deposerCourriel(doc, date, C.bienvenueNewsletter(r.abonne));
  }
  return complete;
}

// Prix pro d'une variante pour un compte (grille, remise).
export const prixPro = (doc, slug, varianteId, compte) => {
  const p = produitDe(slug);
  return prixCompteHT(doc.produits[slug].variantes[varianteId], p.tva, compte);
};

// Lignes, totaux et alertes d'une commande pro (devis comme commande). items résolus.
export function chiffrerPro(doc, compte, items) {
  const lignes = items.map((x) => {
    const l = { slug: x.slug, varianteId: x.varianteId, qte: x.qte, prixUnitaireHT: prixCompteHT(x.d, x.p.tva, compte) };
    if (x.d.colisage) l.colisage = x.d.colisage;
    return l;
  });
  const completes = lignes.map((l) => ligneComplete(l, 'pro'));
  const articlesHT = versEuros(completes.reduce((s, l) => s + versCentimes(l.totalHT), 0));
  const francoHT = compte.francoHT ?? doc.parametres.pro.francoHT;
  const port = fraisPortPro(articlesHT, { francoHT, fraisPortHT: doc.parametres.pro.fraisPortHT });
  const totaux = totauxCommande({ canal: 'pro', lignes, livraison: { prixHT: port } }, completes);
  return { lignes, completes, totaux, port, francoHT, francoRestantHT: versEuros(Math.max(0, versCentimes(francoHT) - versCentimes(articlesHT))) };
}

// Commande pro (espace pro ou CRM). donnees : { lignes, adresseId?, dateSouhaitee?, referenceClient?,
// commentaire? }. Contrôles : licence, colisage (espace pro), stock, minimum, encours.
export function creerCommandePro(doc, m, compte, donnees, { par, auteurId, depuisCrm = false, note }) {
  const date = m.maintenant;
  if (compte.statut !== 'actif') throw erreur(403, 'Ce compte professionnel est suspendu : aucune commande ne peut être enregistrée.', { code: 'suspendu' });
  const items = resoudreLignes(doc, donnees.lignes, { pourCompte: compte });
  if (!depuisCrm) {
    for (const x of items) {
      const col = x.d.colisage || 1;
      if (col > 1 && x.qte % col !== 0) {
        throw erreur(400, `${x.p.nom} ${x.v.volume} se commande par cartons de ${col} bouteilles.`, { champ: 'lignes', code: 'colisage', slug: x.slug, varianteId: x.varianteId });
      }
    }
  }
  controlerStock(items);
  const { lignes, totaux, port } = chiffrerPro(doc, compte, items);
  const minimum = doc.parametres.pro.minimumHT;
  if (versCentimes(totaux.articlesHT) < versCentimes(minimum)) {
    throw erreur(400, `Minimum de commande : ${euros(minimum)} HT (il manque ${euros(versEuros(versCentimes(minimum) - versCentimes(totaux.articlesHT)))} HT).`, { champ: 'lignes', code: 'minimum' });
  }
  const encours = encoursCompte(doc, compte.id);
  if (versCentimes(encours) + versCentimes(totaux.totalTTC) > versCentimes(compte.encoursMax)) {
    throw erreur(409, `Encours autorisé dépassé : ${euros(encours)} de factures à régler + ${euros(totaux.totalTTC)} de commande, pour ${euros(compte.encoursMax)} autorisés. Contactez votre commercial.`, { code: 'encours' });
  }
  const adresse = compte.adressesLivraison.find((a) => a.id === donnees.adresseId) || (donnees.adresseId ? null : compte.adressesLivraison[0]);
  if (!adresse) throw erreur(400, 'Adresse de livraison inconnue : choisissez une adresse du compte.', { champ: 'adresseId', code: 'saisie' });
  const c = {
    id: idAleatoire('cmd'),
    numero: prochainNumero(doc, 'pro', date),
    canal: 'pro',
    compteId: compte.id,
    auteurId,
    contact: { nom: depuisCrm ? compte.enseigne : par.nom, email: compte.email },
    lignes,
    livraison: { mode: 'transporteur', libelle: `Transporteur (${doc.parametres.pro.delai})`, prixHT: port, adresseId: adresse.id, adresse: { ...adresse } },
    paiement: { mode: compte.conditions, statut: 'en-attente' },
    statut: 'nouvelle',
    historique: [{ date: iso(date), statut: 'nouvelle', action: depuisCrm ? `Commande saisie par ${par.nom} (téléphone)` : 'Commande passée dans l’espace pro', par: { ...par } }],
    notes: [],
    createdAt: iso(date),
    updatedAt: iso(date),
  };
  if (compte.telephone) c.contact.telephone = compte.telephone;
  for (const k of ['dateSouhaitee', 'referenceClient', 'commentaire']) if (donnees[k]) c[k] = donnees[k];
  if (note) c.notes.push({ date: iso(date), par: { ...par }, texte: note });
  sortirStock(doc, date, c, { ...par });
  doc.commandes.push(c);
  const complete = commandeComplete(c, index(doc));
  journaliser(doc, date, {
    par: { ...par },
    action: 'commande.creation',
    cible: { type: 'commande', id: c.id, libelle: `Commande ${c.numero}` },
    details: `${compte.enseigne} : ${euros(complete.totaux.totalHT)} HT`,
  });
  deposerCourriel(doc, date, C.confirmationCommande(complete));
  return complete;
}

// ---------- Transitions ----------

// Applique une transition (machine à états du § 5) et ses effets : historique, journal, stock remis
// à l'annulation, remboursement, facture d'une commande pro à l'expédition (ou au retrait),
// courriel au client quand c'est utile.
export function changerStatut(doc, m, c, statut, { par, suivi, note } = {}) {
  const date = m.maintenant;
  controlerTransition(c, statut, { suivi });
  const avant = c.statut;
  if (suivi && (suivi.numero || suivi.transporteur)) c.suivi = { transporteur: suivi.transporteur || c.suivi?.transporteur || 'Colissimo', ...(suivi.numero ? { numero: suivi.numero } : {}), ...(suivi.url ? { url: suivi.url } : {}) };
  if (statut === 'expediee' && !c.suivi && c.canal === 'pro') c.suivi = { transporteur: 'Transporteur de la distillerie' };
  c.statut = statut;
  c.updatedAt = iso(date);
  let action = LIBELLES_STATUTS[statut];
  if (statut === 'expediee' && c.suivi) action = `Expédiée (${c.suivi.transporteur}${c.suivi.numero ? ` ${c.suivi.numero}` : ''})`;
  const h = { date: iso(date), statut, action, par: { id: par.id, nom: par.nom } };
  if (note) h.note = note;
  c.historique.push(h);
  if (statut === 'annulee') {
    rentrerStock(doc, date, c, { id: par.id, nom: par.nom });
    if (c.paiement.statut === 'paye') c.paiement.statut = 'rembourse';
  }
  if (statut === 'remboursee') c.paiement.statut = 'rembourse';
  const compte = c.compteId ? doc.comptes.find((k) => k.id === c.compteId) : null;
  let facture = null;
  if (c.canal === 'pro' && (statut === 'expediee' || statut === 'retiree') && !c.facture) facture = emettreFacture(doc, c, date, { conditions: compte?.conditions });
  journaliser(doc, date, {
    par,
    action: 'commande.statut',
    cible: { type: 'commande', id: c.id, libelle: `Commande ${c.numero}` },
    details: `${LIBELLES_STATUTS[avant]} → ${LIBELLES_STATUTS[statut]}`,
  });
  const complete = commandeComplete(c, index(doc));
  const gabarit = { 'en-preparation': C.preparation, expediee: C.expedition, prete: C.pretRetrait, remboursee: C.remboursement }[statut];
  if (statut === 'annulee') deposerCourriel(doc, date, C.annulation(complete, { rembourse: c.paiement.statut === 'rembourse' }));
  else if (gabarit) deposerCourriel(doc, date, gabarit(complete));
  if (facture) deposerCourriel(doc, date, C.factureDisponible(complete, compte));
  return complete;
}

// ---------- Visites ----------

export const seanceDe = (doc, date, moment) => doc.seances.find((s) => s.date === date && s.moment === moment) || null;

// Séance d'un jour et d'un moment : celle du document, sinon une séance ouverte aux réglages par
// défaut (créée dans le document à la première réservation).
export function seanceVirtuelle(doc, date, moment) {
  return { id: null, date, heure: doc.parametres.visites.horaires[moment], moment, capacite: doc.parametres.visites.capacite, langue: 'fr', statut: 'ouverte' };
}

// Places restantes d'un jour et d'un moment, à cet instant (0 si fermé, passé ou commencé). Une
// séance ajoutée par l'équipe vaut même un jour habituellement fermé.
export function restantes(doc, date, moment, instant) {
  const s = seanceDe(doc, date, moment);
  if (!s && !jourDeVisite(date, doc.parametres.visites)) return 0;
  const sc = s ? seanceComplete(s, doc.parametres) : seanceVirtuelle(doc, date, moment);
  if (instantParis(date, sc.heure).getTime() <= instant.getTime()) return 0;
  return s ? placesRestantes(sc, doc.reservations) : sc.statut === 'fermee' ? 0 : sc.capacite;
}

export function creneauxDuJour(doc, date, instant) {
  const h = doc.parametres.visites.horaires;
  const matin = restantes(doc, date, 'matin', instant);
  const apresMidi = restantes(doc, date, 'apres-midi', instant);
  const speciale = MOMENTS.some((mo) => (seanceDe(doc, date, mo)?.statut || 'ouverte') === 'ouverte' && seanceDe(doc, date, mo));
  const ouvert = (jourDeVisite(date, doc.parametres.visites) || speciale) && date >= jourParis(instant);
  return { date, ouvert, matin: { heure: h.matin, restantes: matin }, apresMidi: { heure: h['apres-midi'], restantes: apresMidi } };
}

// Autres disponibilités : l'autre moment du jour, puis les jours suivants (4 au plus).
export function disponibilites(doc, date, moment, personnes, instant) {
  const out = [];
  const ajouter = (j, mo) => {
    const r = restantes(doc, j, mo, instant);
    if (r >= personnes) out.push({ date: j, moment: mo, heure: doc.parametres.visites.horaires[mo], restantes: r });
  };
  for (const mo of MOMENTS) if (mo !== moment) ajouter(date, mo);
  for (let k = 1; k <= 21 && out.length < 4; k++) for (const mo of MOMENTS) if (out.length < 4) ajouter(ajouterJours(date, k), mo);
  return out;
}

// Réservation sur la séance d'un jour et d'un moment (site ou CRM). Refus 409 avec les autres
// disponibilités si la séance est complète ou fermée.
export function reserver(doc, m, donnees, { source, par }) {
  const date = m.maintenant;
  const { date: jour, moment, personnes } = donnees;
  const p = doc.parametres.visites;
  const existante = seanceDe(doc, jour, moment);
  if (!existante && !jourDeVisite(jour, p)) {
    const fermes = p.fermeLe.length ? `, fermé ${joursSemaine(p.fermeLe)}` : '';
    throw erreur(400, `La distillerie ne propose pas de visite ce jour-là (saison du ${jourEtMois(p.saison.debut)} au ${jourEtMois(p.saison.fin)}${fermes}).`, { champ: 'date', code: 'ferme' });
  }
  const r0 = restantes(doc, jour, moment, date);
  const commencee = instantParis(jour, existante?.heure || p.horaires[moment]).getTime() <= date.getTime();
  if (commencee) throw erreur(400, 'Cette séance a déjà commencé : choisissez une autre date ou un autre moment.', { champ: 'moment', code: 'passe' });
  if (r0 < personnes) {
    const fermee = existante && (existante.statut || 'ouverte') === 'fermee';
    throw erreur(409, fermee ? `Pas de visite le ${libelleSeance(jour, moment, jourParis(date))} : séance fermée.` : r0 ? `Plus que ${r0} place${r0 > 1 ? 's' : ''} pour cette séance.` : 'Cette séance est complète.', {
      code: 'complet',
      restantes: r0,
      disponibilites: disponibilites(doc, jour, moment, personnes, date),
    });
  }
  let s = existante;
  if (!s) {
    s = { id: idAleatoire('sea'), date: jour, heure: p.horaires[moment], moment };
    doc.seances.push(s);
    doc.seances.sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure));
  }
  const r = {
    id: idAleatoire('res'),
    reference: prochainNumero(doc, 'visite', date),
    seanceId: s.id,
    date: jour,
    moment,
    personnes,
    mineurs: donnees.mineurs || 0,
    langue: donnees.langue || 'fr',
    nom: donnees.nom,
    email: donnees.email,
    statut: 'confirmee',
    source,
    newsletter: !!donnees.newsletter,
    createdAt: iso(date),
  };
  for (const k of ['telephone', 'message', 'notes']) if (donnees[k]) r[k] = donnees[k];
  doc.reservations.push(r);
  journaliser(doc, date, {
    par,
    action: 'reservation.creation',
    cible: { type: 'reservation', id: r.id, libelle: `Visite ${r.reference}` },
    details: typo(`${personnes} personne${personnes > 1 ? 's' : ''}, ${libelleSeance(jour, moment, jourParis(date))}`),
  });
  deposerCourriel(doc, date, C.confirmationVisite(r, seanceComplete(s, doc.parametres)));
  if (donnees.newsletter) {
    const ab = inscrireAbonne(doc, date, { email: donnees.email, prenom: donnees.nom.split(' ')[0], source: 'visite' });
    if (!ab.deja) deposerCourriel(doc, date, C.bienvenueNewsletter(ab.abonne));
  }
  return { reservation: r, seance: seanceComplete(s, doc.parametres) };
}

export { nomComplet, auteurCourt };
