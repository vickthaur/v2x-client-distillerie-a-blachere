// Règles métier (docs/crm-espace-pro.md, § 5). Fonctions pures, testées au centime près : les
// montants sont stockés en euros à deux décimales mais calculés en centimes entiers (arrondi
// commercial, au centime, à chaque ligne).
import { erreur } from './http.js';
import { ajouterJours, annee2, finDeMois, jourSemaine } from './temps.js';
import { euros } from './typo.js';

// ---------- Centimes ----------

export const versCentimes = (x) => Math.round(Number(x) * 100);
export const versEuros = (c) => Math.round(c) / 100;
const somme = (l) => l.reduce((s, x) => s + x, 0);

// ---------- TVA ----------

// Sirops et produits sans alcool 5,5 % ; boissons alcoolisées 20 %.
export const TVA_SANS_ALCOOL = 5.5;
export const TVA_ALCOOL = 20;
export const tauxTva = (alcool) => (alcool ? TVA_ALCOOL : TVA_SANS_ALCOOL);
const dixiemes = (taux) => Math.round(taux * 10);

// Conversions au centime (calcul exact en entiers, arrondi au plus proche, demi vers le haut).
export const htDepuisTtc = (ttcC, taux) => Math.round((ttcC * 1000) / (1000 + dixiemes(taux)));
export const ttcDepuisHt = (htC, taux) => Math.round((htC * (1000 + dixiemes(taux))) / 1000);
export const tvaSurHt = (htC, taux) => Math.round((htC * dixiemes(taux)) / 1000);

// Répartition d'un montant (centimes) au prorata de poids, au plus fort reste : la somme des parts
// est exactement le total.
export function repartir(totalC, poids) {
  const n = poids.length;
  if (!n) return [];
  const p = poids.map((x) => Math.max(0, x));
  const t = somme(p);
  if (t <= 0) {
    const parts = new Array(n).fill(0);
    parts[0] = totalC;
    return parts;
  }
  const brutes = p.map((x) => (totalC * x) / t);
  const parts = brutes.map(Math.floor);
  let reste = totalC - somme(parts);
  const ordre = brutes.map((b, i) => [b - Math.floor(b), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; reste > 0 && k < ordre.length; k++, reste--) parts[ordre[k][1]] += 1;
  return parts;
}

// ---------- Lignes ----------

// Ligne d'une commande de particulier : prix TTC (catalogue de la démo), HT déduit à chaque ligne.
export function ligneParticulier({ slug, varianteId, nom, volume, alcool, qte, prixTTC }) {
  const taux = tauxTva(alcool);
  const puC = versCentimes(prixTTC);
  const totalC = puC * qte;
  return {
    slug,
    varianteId,
    nom,
    volume,
    alcool,
    tva: taux,
    qte,
    prixUnitaireHT: versEuros(htDepuisTtc(puC, taux)),
    prixUnitaireTTC: versEuros(puC),
    totalHT: versEuros(htDepuisTtc(totalC, taux)),
    totalTTC: versEuros(totalC),
  };
}

// Ligne d'une commande pro : prix HT (grille du compte, remise comprise).
export function lignePro({ slug, varianteId, nom, volume, alcool, qte, prixHT, colisage }) {
  const taux = tauxTva(alcool);
  const puC = versCentimes(prixHT);
  const totalC = puC * qte;
  const l = {
    slug,
    varianteId,
    nom,
    volume,
    alcool,
    tva: taux,
    qte,
    prixUnitaireHT: versEuros(puC),
    prixUnitaireTTC: versEuros(ttcDepuisHt(puC, taux)),
    totalHT: versEuros(totalC),
    totalTTC: versEuros(ttcDepuisHt(totalC, taux)),
  };
  if (colisage) l.colisage = colisage;
  return l;
}

// ---------- Totaux ----------

const tauxDes = (lignes) => [...new Set(lignes.map((l) => l.tva))].sort((a, b) => a - b);

// Commande de particulier (prix TTC). La remise est ventilée au prorata des articles TTC de chaque
// taux ; les frais de port suivent le principal : ventilés au prorata des bases HT des articles
// (après remise) de chaque taux. Base HT et TVA de chaque taux se déduisent de son montant TTC, si
// bien que totalHT + totalTVA = totalTTC au centime.
export function totauxParticulier(lignes, { remiseTTC = 0, livraisonTTC = 0 } = {}) {
  const taux = tauxDes(lignes);
  const articles = taux.map((t) => somme(lignes.filter((l) => l.tva === t).map((l) => versCentimes(l.totalTTC))));
  const articlesC = somme(articles);
  const remiseC = Math.min(versCentimes(remiseTTC), articlesC);
  const remises = repartir(remiseC, articles);
  const nets = articles.map((a, i) => a - remises[i]);
  let poids = nets.map((n, i) => htDepuisTtc(n, taux[i]));
  if (!poids.some((p) => p > 0)) poids = articles.map((a) => a);
  const portC = versCentimes(livraisonTTC);
  const ports = repartir(portC, poids);
  const tva = taux.map((t, i) => {
    const ttc = nets[i] + ports[i];
    const base = htDepuisTtc(ttc, t);
    return { taux: t, baseHT: versEuros(base), montant: versEuros(ttc - base), ttc };
  });
  const totalHT = somme(tva.map((x) => versCentimes(x.baseHT)));
  const totalTTC = somme(tva.map((x) => x.ttc));
  return {
    articlesTTC: versEuros(articlesC),
    articlesHT: versEuros(somme(lignes.map((l) => versCentimes(l.totalHT)))),
    remiseTTC: versEuros(remiseC),
    livraisonTTC: versEuros(portC),
    livraisonHT: versEuros(somme(ports.map((p, i) => htDepuisTtc(p, taux[i])))),
    tva: tva.map(({ taux: t, baseHT, montant }) => ({ taux: t, baseHT, montant })),
    totalHT: versEuros(totalHT),
    totalTVA: versEuros(totalTTC - totalHT),
    totalTTC: versEuros(totalTTC),
  };
}

// Commande pro (prix HT). Le port HT est ventilé au prorata des bases HT de chaque taux ; la TVA
// est calculée sur la base de chaque taux.
export function totauxPro(lignes, { livraisonHT = 0 } = {}) {
  const taux = tauxDes(lignes);
  const bases = taux.map((t) => somme(lignes.filter((l) => l.tva === t).map((l) => versCentimes(l.totalHT))));
  const portC = versCentimes(livraisonHT);
  const ports = repartir(portC, bases);
  const tva = taux.map((t, i) => {
    const base = bases[i] + ports[i];
    return { taux: t, baseHT: versEuros(base), montant: versEuros(tvaSurHt(base, t)) };
  });
  const totalHT = somme(tva.map((x) => versCentimes(x.baseHT)));
  const totalTVA = somme(tva.map((x) => versCentimes(x.montant)));
  return {
    articlesTTC: versEuros(somme(lignes.map((l) => versCentimes(l.totalTTC)))),
    articlesHT: versEuros(somme(bases)),
    remiseTTC: 0,
    livraisonTTC: versEuros(somme(ports.map((p, i) => ttcDepuisHt(p, taux[i])))),
    livraisonHT: versEuros(portC),
    tva,
    totalHT: versEuros(totalHT),
    totalTVA: versEuros(totalTVA),
    totalTTC: versEuros(totalHT + totalTVA),
  };
}

// ---------- Tarifs pro ----------

// Coefficients des grilles (fictifs) appliqués au prix HT public : CHR 0,72 ; caviste 0,68 ;
// distributeur 0,60.
export const GRILLES = { chr: 72, caviste: 68, distributeur: 60 };
export const NOMS_GRILLES = { chr: 'CHR (cafés, hôtels, restaurants)', caviste: 'Cavistes et épiceries', distributeur: 'Distributeurs' };

// Prix HT de grille : prix TTC ÷ (1 + TVA) × coefficient, arrondi au centime. Si le tarif pro de
// référence (CHR) a été fixé à la main dans le CRM (proManuel), les autres grilles en découlent au
// prorata des coefficients.
export function prixGrilleHT(v, taux, grille) {
  const coef = GRILLES[grille] ?? GRILLES.chr;
  if (v.proManuel && typeof v.prixProHT === 'number') return versEuros(Math.round((versCentimes(v.prixProHT) * coef) / GRILLES.chr));
  return versEuros(Math.round((versCentimes(v.prixTTC) * coef * 10) / (1000 + dixiemes(taux))));
}

// Tarif pro de référence (grille CHR) d'un prix TTC.
export const prixProReference = (prixTTC, taux) => prixGrilleHT({ prixTTC }, taux, 'chr');

// Remise du compte (%, une décimale) sur le prix de grille, arrondie au centime.
export const appliquerRemise = (prixHT, remise = 0) => versEuros(Math.round((versCentimes(prixHT) * (1000 - Math.round(remise * 10))) / 1000));

export function prixCompteHT(v, taux, compte) {
  return appliquerRemise(prixGrilleHT(v, taux, compte.grille), compte.remise || 0);
}

// Colisage (fictif, « à confirmer ») : 1 pour les coffrets et les flacons en étui (millésimes, Luxe),
// 12 pour les 50 cl et moins, 6 pour les 70 cl, 1 L et plus.
export function colisageParDefaut(v, p) {
  if (v.coffret || p?.plat) return 1;
  if (v.ml !== null && v.ml !== undefined && v.ml <= 500) return 12;
  return 6;
}

// ---------- Paramètres par défaut (barèmes de démonstration) ----------

export const PARAMETRES_DEFAUT = {
  livraison: {
    colissimo: [
      { jusquA: 2, prixTTC: 9.9 },
      { jusquA: 6, prixTTC: 14.9 },
      { jusquA: 12, prixTTC: 19.9 },
      { jusquA: null, prixTTC: 24.9 },
    ],
    relais: [
      { jusquA: 2, prixTTC: 7.9 },
      { jusquA: 6, prixTTC: 12.9 },
      { jusquA: 12, prixTTC: 17.9 },
      { jusquA: null, prixTTC: 22.9 },
    ],
    francoTTC: 120,
    retraitGratuit: true,
  },
  pro: { minimumHT: 150, francoHT: 300, fraisPortHT: 18, delai: '48 à 72 h ouvrées' },
  visites: { capacite: 25, horaires: { matin: '10:30', 'apres-midi': '15:00' }, saison: { debut: '02-12', fin: '12-31' }, fermeLe: [0] },
  entreprise: {
    nom: 'Distillerie A. Blachère',
    adresse: '1695 route de Sorgues, quartier Cansaud, 84230 Châteauneuf-du-Pape',
    telephone: '04 90 83 55 65',
    email: 'magasin@distillerieablachere.com',
    // SIRET des mentions légales du site officiel ; TVA intracommunautaire et RCS absents des
    // mentions : à compléter.
    siret: '325 034 106 00022',
    tvaIntra: '',
    rcs: '',
  },
};

// ---------- Livraison des particuliers ----------

export const MODES_PARTICULIER = ['retrait', 'colissimo', 'relais'];
export const LIBELLES_LIVRAISON = {
  retrait: 'Retrait à la distillerie',
  colissimo: 'Colissimo à domicile',
  relais: 'Colissimo en point relais',
  transporteur: 'Transporteur (livraison professionnelle)',
};
const DELAIS = {
  retrait: 'Le jour choisi, du lundi au samedi (9 h – 12 h et 14 h – 17 h)',
  colissimo: 'Expédition sous 3 jours ouvrés, livraison en 48 h environ',
  relais: 'Expédition sous 3 jours ouvrés, livraison en 3 à 5 jours',
};

export function prixBareme(bareme, bouteilles) {
  for (const t of bareme) if (t.jusquA === null || bouteilles <= t.jusquA) return t.prixTTC;
  return bareme[bareme.length - 1].prixTTC;
}

// Frais de livraison TTC d'une commande de particulier (franco sur les articles TTC avant remise).
export function fraisLivraison(mode, { bouteilles, articlesTTC, parametres = PARAMETRES_DEFAUT }) {
  const l = parametres.livraison;
  if (mode === 'retrait') return 0;
  if (articlesTTC >= l.francoTTC) return 0;
  return prixBareme(mode === 'relais' ? l.relais : l.colissimo, bouteilles);
}

// Options proposées au panier. Hors de France métropolitaine (code postal d'outre-mer, Monaco) :
// retrait seulement.
export function optionsLivraison({ bouteilles, articlesTTC, cp, parametres = PARAMETRES_DEFAUT }) {
  const metropole = !cp || (/^\d{5}$/.test(cp) && !/^(97|98|99|00)/.test(cp));
  return MODES_PARTICULIER.map((mode) => {
    const o = { mode, libelle: LIBELLES_LIVRAISON[mode], prixTTC: fraisLivraison(mode, { bouteilles, articlesTTC, parametres }), delai: DELAIS[mode] };
    if (mode !== 'retrait' && !metropole) {
      o.disponible = false;
      o.raison = 'Pas d’envoi hors de France métropolitaine dans la démonstration.';
    } else o.disponible = true;
    return o;
  });
}

export const francoRestant = (articlesTTC, parametres = PARAMETRES_DEFAUT) =>
  versEuros(Math.max(0, versCentimes(parametres.livraison.francoTTC) - versCentimes(articlesTTC)));

// ---------- Commandes pro ----------

export const fraisPortPro = (articlesHT, { francoHT, fraisPortHT }) => (articlesHT >= francoHT ? 0 : fraisPortHT);
export const licenceAlcool = (licence) => !!licence && licence !== 'aucune';

// Alertes d'une commande pro (devis) : minimum, encours ; le stock et la licence sont contrôlés à part.
export function alertesPro({ totaux, encours, encoursMax, minimumHT }) {
  const alertes = [];
  if (totaux.articlesHT < minimumHT) {
    alertes.push({
      type: 'minimum',
      message: `Minimum de commande : ${euros(minimumHT)} HT (il manque ${euros(versEuros(versCentimes(minimumHT) - versCentimes(totaux.articlesHT)))} HT).`,
    });
  }
  if (versCentimes(encours) + versCentimes(totaux.totalTTC) > versCentimes(encoursMax)) {
    alertes.push({
      type: 'encours',
      message: `Encours autorisé dépassé : ${euros(encours)} de factures à régler + ${euros(totaux.totalTTC)} de commande, pour ${euros(encoursMax)} autorisés. Contactez votre commercial.`,
    });
  }
  return alertes;
}

// ---------- Stocks ----------

export function etatStock(v) {
  if (v.stock <= 0) return 'rupture';
  if (v.stock <= v.seuil) return 'stock-bas';
  return 'disponible';
}

// ---------- Statuts des commandes ----------

export const STATUTS = ['nouvelle', 'en-preparation', 'prete', 'expediee', 'livree', 'retiree', 'annulee', 'remboursee'];
export const LIBELLES_STATUTS = {
  nouvelle: 'Nouvelle',
  'en-preparation': 'En préparation',
  prete: 'Prête au retrait',
  expediee: 'Expédiée',
  livree: 'Livrée',
  retiree: 'Retirée',
  annulee: 'Annulée',
  remboursee: 'Remboursée',
};
const GRAPHE = {
  nouvelle: ['en-preparation', 'annulee'],
  'en-preparation': ['expediee', 'prete', 'annulee'],
  prete: ['retiree', 'annulee'],
  expediee: ['livree', 'remboursee'],
  livree: ['remboursee'],
  retiree: ['remboursee'],
  annulee: [],
  remboursee: [],
};

// Transitions permises : « prête » et « retirée » pour un retrait, « expédiée » et « livrée » sinon.
export function transitionsPossibles(commande) {
  const exclus = commande.livraison?.mode === 'retrait' ? ['expediee', 'livree'] : ['prete', 'retiree'];
  return (GRAPHE[commande.statut] || []).filter((s) => !exclus.includes(s));
}

export const suiviExige = (commande) => !(commande.canal === 'pro' && commande.livraison?.mode === 'transporteur');

export function controlerTransition(commande, statut, { suivi } = {}) {
  if (!STATUTS.includes(statut)) throw erreur(400, 'Statut inconnu.', { champ: 'statut', code: 'saisie' });
  if (!transitionsPossibles(commande).includes(statut)) {
    throw erreur(409, `Transition impossible : ${LIBELLES_STATUTS[commande.statut].toLowerCase()} → ${LIBELLES_STATUTS[statut].toLowerCase()}.`, { code: 'transition' });
  }
  if (statut === 'expediee' && suiviExige(commande) && !(suivi?.numero || commande.suivi?.numero)) {
    throw erreur(400, 'Numéro de suivi obligatoire pour expédier la commande.', { champ: 'suivi', code: 'saisie' });
  }
}

// ---------- Factures ----------

export const CONDITIONS = ['comptant', '30j-fdm', '45j', 'prelevement'];
export const LIBELLES_CONDITIONS = {
  comptant: 'Comptant à réception',
  '30j-fdm': '30 jours fin de mois',
  '45j': '45 jours',
  prelevement: 'Prélèvement à 10 jours',
};

// Échéance : comptant à réception ; 30 jours fin de mois ; 45 jours ; prélèvement à 10 jours.
export function echeance(jour, conditions) {
  switch (conditions) {
    case '30j-fdm':
      return finDeMois(ajouterJours(jour, 30));
    case '45j':
      return ajouterJours(jour, 45);
    case 'prelevement':
      return ajouterJours(jour, 10);
    default:
      return jour;
  }
}

// En retard : échéance dépassée et non payée (calculé, jamais stocké).
export const enRetard = (facture, aujourdhui) => !!facture && facture.statut === 'a-regler' && facture.echeance < aujourdhui;

// ---------- Numérotation ----------

// WEB-26-01043, PRO-26-00319, FA-26-00512, VIS-26-0143, DEM-26-0043, MSG-26-0089 : l'année sur deux
// chiffres suit la date de création, le compteur ne repart jamais à zéro (numérotation continue).
export const FORMATS = { web: ['WEB', 5], pro: ['PRO', 5], facture: ['FA', 5], visite: ['VIS', 4], demande: ['DEM', 4], message: ['MSG', 4] };

export function numero(type, seq, date) {
  const [prefixe, chiffres] = FORMATS[type];
  return `${prefixe}-${annee2(date)}-${String(seq).padStart(chiffres, '0')}`;
}

// Prochain numéro d'un type (incrémente le compteur du document).
export function prochainNumero(doc, type, date) {
  doc.seq[type] = (doc.seq[type] || 0) + 1;
  return numero(type, doc.seq[type], date);
}

// ---------- Visites ----------

export const MOMENTS = ['matin', 'apres-midi'];
export const LIBELLES_MOMENTS = { matin: 'matin', 'apres-midi': 'après-midi' };

// Jour de visite : dans la saison (MM-JJ de début et de fin compris) et pas un jour de fermeture.
export function jourDeVisite(jour, visites = PARAMETRES_DEFAUT.visites) {
  const mj = jour.slice(5);
  const { debut, fin } = visites.saison;
  const dansSaison = debut <= fin ? mj >= debut && mj <= fin : mj >= debut || mj <= fin;
  return dansSaison && !visites.fermeLe.includes(jourSemaine(jour));
}

// Places prises : personnes (mineurs compris) des réservations non annulées.
export const placesPrises = (seanceId, reservations) =>
  somme(reservations.filter((r) => r.seanceId === seanceId && r.statut !== 'annulee').map((r) => r.personnes));

export const placesRestantes = (seance, reservations) =>
  seance.statut === 'fermee' ? 0 : Math.max(0, seance.capacite - placesPrises(seance.id, reservations));

// ---------- Codes promo ----------

// Contrôle d'un code (actif, dates, minimum, limite d'utilisations) et remise TTC sur les articles.
// Rend { remiseTTC, livraisonOfferte } ; un code non applicable lève une erreur 400 (champ « code »).
export function appliquerPromo(promo, { articlesTTC, aujourdhui }) {
  const refus = (message) => erreur(400, message, { champ: 'code', code: 'promo' });
  if (!promo || !promo.actif) throw refus('Ce code promo n’existe pas ou n’est plus actif.');
  if (promo.debut && aujourdhui < promo.debut) throw refus('Ce code promo n’est pas encore valable.');
  if (promo.fin && aujourdhui > promo.fin) throw refus('Ce code promo a expiré.');
  if (promo.limite && promo.utilisations >= promo.limite) throw refus('Ce code promo a atteint son nombre d’utilisations.');
  if (versCentimes(articlesTTC) < versCentimes(promo.minimumTTC || 0)) throw refus(`Ce code s’applique dès ${euros(promo.minimumTTC)} d’achats.`);
  const articlesC = versCentimes(articlesTTC);
  if (promo.type === 'pourcentage') return { remiseTTC: versEuros(Math.round((articlesC * versCentimes(promo.valeur)) / 10000)), livraisonOfferte: false };
  if (promo.type === 'montant') return { remiseTTC: versEuros(Math.min(articlesC, versCentimes(promo.valeur))), livraisonOfferte: false };
  return { remiseTTC: 0, livraisonOfferte: true };
}
