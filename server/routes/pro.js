// api/pro : espace des clients professionnels (docs/crm-espace-pro.md, § 7). Chaque appel exige une
// session bl_pro valable (compte actif) et ne voit que les données de SON compte : un identifiant
// d'un autre compte rend 404, comme un identifiant inconnu (rien n'est révélé).
import { demoCourante, exigerSession, moiDans, muter } from '../acces.js';
import { PRODUITS, produit as produitDe } from '../catalogue.js';
import { journaliser, nomComplet } from '../evenements.js';
import { avecStatut, erreur, introuvable, paginer, trier } from '../http.js';
import { chiffrerPro, controlerStock, creerCommandePro, encoursCompte, resoudreLignes } from '../metier.js';
import { commandeComplete, index } from '../modele.js';
import { idAleatoire } from '../aleatoire.js';
import {
  alertesPro,
  enRetard,
  etatStock,
  LIBELLES_CONDITIONS,
  LIBELLES_STATUTS,
  licenceAlcool,
  prixCompteHT,
  prochainNumero,
  STATUTS,
  ttcDepuisHt,
  versCentimes,
  versEuros,
} from '../regles.js';
import { iso, jourParis } from '../temps.js';
import * as V from '../valider.js';

const EVIN = 'L’abus d’alcool est dangereux pour la santé, à consommer avec modération.';
const MINEURS = 'La vente d’alcool est interdite aux mineurs de moins de 18 ans.';

// Session pro + compte de l'utilisateur (relus dans le document de l'appel).
async function session(ctx) {
  const u = await exigerSession(ctx, 'pro');
  const doc = (await demoCourante(ctx)).doc;
  const compte = doc.comptes.find((k) => k.id === u.compteId);
  return { u, doc, compte, idx: index(doc) };
}

async function ecrire(ctx, fn) {
  await exigerSession(ctx, 'pro');
  return muter(ctx, (doc, m) => {
    const moi = moiDans(doc, ctx);
    const compte = doc.comptes.find((k) => k.id === moi.compteId);
    return fn(doc, m, moi, compte);
  });
}

// Élément du compte, sinon 404 (un identifiant d'un autre compte n'est jamais distingué).
const commandeDuCompte = (doc, compte, id) => {
  V.identifiant(id, 'cmd');
  const c = doc.commandes.find((x) => x.id === id && x.compteId === compte.id);
  if (!c) throw introuvable();
  return c;
};

const somme = (l) => versEuros(l.reduce((s, x) => s + versCentimes(x), 0));
const visible = (p, pd, compte) => !!pd?.actif && p.enLigne && (!p.alcool || licenceAlcool(compte.licence));

// ---------- Vues ----------

function vueCompte(k) {
  return {
    id: k.id,
    raisonSociale: k.raisonSociale,
    enseigne: k.enseigne,
    type: k.type,
    siret: k.siret,
    tvaIntra: k.tvaIntra,
    licence: k.licence,
    telephone: k.telephone,
    email: k.email,
    adresseFacturation: k.adresseFacturation,
    adressesLivraison: k.adressesLivraison,
    grille: k.grille,
    remise: k.remise,
    conditions: k.conditions,
    conditionsLibelle: LIBELLES_CONDITIONS[k.conditions],
    francoHT: k.francoHT,
    encoursMax: k.encoursMax,
    statut: k.statut,
  };
}

function commercialDe(doc, compte) {
  const x = doc.utilisateurs.find((u) => u.id === compte.commercialId);
  return x ? { nom: nomComplet(x), email: x.email, telephone: x.telephone, poste: x.poste } : { nom: 'Service commercial', email: 'commercial@blachere.example', telephone: '04 90 83 55 65' };
}

const articles = (c) => c.lignes.reduce((s, l) => s + l.qte, 0);

function resume(c, aujourdhui) {
  const out = {
    id: c.id,
    numero: c.numero,
    date: c.createdAt,
    statut: c.statut,
    statutLibelle: LIBELLES_STATUTS[c.statut],
    articles: articles(c),
    totalHT: c.totaux.totalHT,
    totalTTC: c.totaux.totalTTC,
    referenceClient: c.referenceClient,
    dateSouhaitee: c.dateSouhaitee,
  };
  if (c.suivi) out.suivi = c.suivi;
  if (c.facture) out.facture = { numero: c.facture.numero, statut: c.facture.statut, echeance: c.facture.echeance, enRetard: enRetard(c.facture, aujourdhui) };
  return out;
}

// Commande vue par le client pro : sans notes internes ni identifiants du personnel.
function vueCommande(c, aujourdhui) {
  const out = { ...c };
  delete out.notes;
  delete out.auteurId;
  delete out.anonymise;
  out.historique = c.historique.map((h) => ({ date: h.date, statut: h.statut, action: h.action, par: { nom: h.par?.nom || 'Distillerie A. Blachère' } }));
  out.statutLibelle = LIBELLES_STATUTS[c.statut];
  if (c.facture) out.facture = { ...c.facture, enRetard: enRetard(c.facture, aujourdhui) };
  return out;
}

function vueLignesCatalogue(p, pd, compte) {
  return p.variantes
    .filter((v) => pd.variantes[v.id])
    .map((v) => {
      const d = pd.variantes[v.id];
      const prixHT = prixCompteHT(d, p.tva, compte);
      return {
        id: v.id,
        volume: v.volume,
        coffret: v.coffret,
        colisage: d.colisage,
        parCarton: d.colisage > 1,
        prixHT,
        prixCartonHT: versEuros(versCentimes(prixHT) * d.colisage),
        prixTTC: versEuros(ttcDepuisHt(versCentimes(prixHT), p.tva)),
        prixPublicTTC: d.prixTTC,
        tva: p.tva,
        etat: etatStock(d),
      };
    });
}

// ---------- Accueil ----------

async function accueil(ctx) {
  const { doc, compte, idx } = await session(ctx);
  const aujourdhui = jourParis(ctx.maintenant);
  const cmds = doc.commandes.filter((c) => c.compteId === compte.id).map((c) => commandeComplete(c, idx));
  const enCours = cmds.filter((c) => ['nouvelle', 'en-preparation', 'prete', 'expediee'].includes(c.statut));
  const aRegler = cmds.filter((c) => c.statut !== 'annulee' && c.facture?.statut === 'a-regler');
  const derniere = cmds.at(-1);
  // Suggestions : ce que le compte commande souvent et n'a pas commandé depuis 30 jours.
  const depuis = iso(ctx.maintenant.getTime() - 30 * 86400000);
  const freq = new Map();
  for (const c of cmds) {
    if (c.statut === 'annulee') continue;
    for (const l of c.lignes) {
      const k = `${l.slug}|${l.varianteId}`;
      const f = freq.get(k) || { slug: l.slug, varianteId: l.varianteId, nom: l.nom, volume: l.volume, n: 0, recent: false };
      f.n += 1;
      if (c.createdAt >= depuis) f.recent = true;
      freq.set(k, f);
    }
  }
  const suggestions = [...freq.values()]
    .filter((f) => {
      const p = produitDe(f.slug);
      const pd = doc.produits[f.slug];
      return p && visible(p, pd, compte) && pd.variantes[f.varianteId]?.stock > 0;
    })
    .sort((a, b) => Number(a.recent) - Number(b.recent) || b.n - a.n)
    .slice(0, 4)
    .map((f) => {
      const p = produitDe(f.slug);
      const d = doc.produits[f.slug].variantes[f.varianteId];
      return { slug: f.slug, varianteId: f.varianteId, nom: f.nom, volume: f.volume, photo: p.photo, colisage: d.colisage, prixHT: prixCompteHT(d, p.tva, compte), raison: f.recent ? 'Vous le commandez souvent' : 'Pas commandé depuis plus de 30 jours' };
    });
  return {
    compte: vueCompte(compte),
    commercial: commercialDe(doc, compte),
    encours: encoursCompte(doc, compte.id, idx),
    encoursMax: compte.encoursMax,
    commandesEnCours: enCours.reverse().map((c) => resume(c, aujourdhui)),
    derniereCommande: derniere ? resume(derniere, aujourdhui) : null,
    facturesARegler: {
      nombre: aRegler.length,
      totalTTC: somme(aRegler.map((c) => c.totaux.totalTTC)),
      enRetard: aRegler.filter((c) => enRetard(c.facture, aujourdhui)).length,
      prochaineEcheance: aRegler.map((c) => c.facture.echeance).sort()[0] || null,
    },
    suggestions,
    conditions: { minimumHT: doc.parametres.pro.minimumHT, francoHT: compte.francoHT ?? doc.parametres.pro.francoHT, fraisPortHT: doc.parametres.pro.fraisPortHT, delai: doc.parametres.pro.delai },
  };
}

// ---------- Catalogue, devis, commande ----------

async function catalogue(ctx) {
  const { doc, compte } = await session(ctx);
  const produits = PRODUITS.filter((p) => visible(p, doc.produits[p.slug], compte)).map((p) => ({
    slug: p.slug,
    nom: p.nom,
    type: p.type,
    gamme: p.gamme,
    gammeNom: p.gammeNom,
    univers: p.univers,
    alcool: p.alcool,
    degre: p.degre,
    photo: p.photo,
    variantes: vueLignesCatalogue(p, doc.produits[p.slug], compte),
  }));
  const out = {
    produits,
    conditions: { minimumHT: doc.parametres.pro.minimumHT, francoHT: compte.francoHT ?? doc.parametres.pro.francoHT, fraisPortHT: doc.parametres.pro.fraisPortHT, delai: doc.parametres.pro.delai },
    grille: compte.grille,
    remise: compte.remise,
    spiritueux: licenceAlcool(compte.licence),
  };
  if (produits.some((p) => p.alcool)) out.mentions = { evin: EVIN, mineurs: MINEURS };
  return out;
}

// Devis : totaux, franco restant, alertes (produit, licence, colisage, stock, minimum, encours) ;
// rien n'est enregistré.
async function devis(ctx) {
  const lignes = V.lignes(ctx.corps);
  const { doc, compte, idx } = await session(ctx);
  const alertes = [];
  const items = [];
  for (const l of lignes) {
    try {
      const [x] = resoudreLignes(doc, [l], { pourCompte: compte });
      const col = x.d.colisage || 1;
      if (col > 1 && x.qte % col !== 0) alertes.push({ type: 'colisage', slug: x.slug, varianteId: x.varianteId, message: `${x.p.nom} ${x.v.volume} se commande par cartons de ${col} bouteilles.` });
      try {
        controlerStock([x]);
      } catch (e) {
        alertes.push({ type: 'stock', slug: x.slug, varianteId: x.varianteId, message: e.message, disponible: e.extra.details[0].disponible });
      }
      items.push(x);
    } catch (e) {
      if (!e.status) throw e;
      alertes.push({ type: e.extra?.code === 'licence' ? 'licence' : 'produit', slug: l.slug, varianteId: l.varianteId, message: e.message });
    }
  }
  if (!items.length) return { lignes: [], totaux: null, francoRestantHT: compte.francoHT, alertes, valide: false };
  const { completes, totaux, francoRestantHT } = chiffrerPro(doc, compte, items);
  alertes.push(...alertesPro({ totaux, encours: encoursCompte(doc, compte.id, idx), encoursMax: compte.encoursMax, minimumHT: doc.parametres.pro.minimumHT }));
  const out = { lignes: completes, totaux, francoRestantHT, alertes, valide: !alertes.length };
  if (completes.some((l) => l.alcool)) out.mentions = { evin: EVIN };
  return out;
}

async function commande(ctx) {
  const c = ctx.corps;
  const donnees = {
    lignes: V.lignes(c),
    adresseId: c.adresseId === undefined || c.adresseId === null ? undefined : V.identifiant(c.adresseId, 'adr', { champ: 'adresseId' }),
    dateSouhaitee: V.jour(c, 'dateSouhaitee', { libelle: 'Date souhaitée' }),
    referenceClient: V.texte(c, 'referenceClient', { max: 40, libelle: 'Votre référence' }),
    commentaire: V.texte(c, 'commentaire', { max: 500, multiligne: true, libelle: 'Commentaire' }),
  };
  const aujourdhui = jourParis(ctx.maintenant);
  if (donnees.dateSouhaitee && donnees.dateSouhaitee < aujourdhui) throw erreur(400, 'Date souhaitée : à partir d’aujourd’hui.', { champ: 'dateSouhaitee', code: 'saisie' });
  const r = await ecrire(ctx, (doc, m, moi, compte) => {
    if (!compte.adressesLivraison.length) throw erreur(400, 'Ajoutez d’abord une adresse de livraison (rubrique Compte).', { champ: 'adresseId', code: 'adresse' });
    const cree = creerCommandePro(doc, m, compte, donnees, { par: { id: moi.id, nom: nomComplet(moi) }, auteurId: moi.id });
    return vueCommande(cree, jourParis(m.maintenant));
  });
  return avecStatut(201, r);
}

async function commandes(ctx) {
  const { doc, compte, idx } = await session(ctx);
  const aujourdhui = jourParis(ctx.maintenant);
  const statut = ctx.param('statut');
  if (statut && !STATUTS.includes(statut)) throw erreur(400, 'Statut inconnu.', { champ: 'statut', code: 'saisie' });
  let liste = doc.commandes.filter((c) => c.compteId === compte.id && (!statut || c.statut === statut)).map((c) => commandeComplete(c, idx));
  liste = trier(liste, ctx.param('tri'), { date: (c) => c.createdAt, total: (c) => c.totaux.totalTTC, numero: (c) => c.numero }, '-date');
  const page = paginer(liste, ctx);
  return { ...page, elements: page.elements.map((c) => resume(c, aujourdhui)) };
}

async function commandeDetail(ctx) {
  const { doc, compte, idx } = await session(ctx);
  const c = commandeDuCompte(doc, compte, ctx.param('id', 40));
  return vueCommande(commandeComplete(c, idx), jourParis(ctx.maintenant));
}

// Recommander : les lignes d'une commande passée, avec ce qui est encore disponible.
async function recommander(ctx) {
  const { doc, compte, idx } = await session(ctx);
  const c = commandeComplete(commandeDuCompte(doc, compte, ctx.param('id', 40)), idx);
  const lignes = [];
  const indisponibles = [];
  for (const l of c.lignes) {
    const p = produitDe(l.slug);
    const pd = doc.produits[l.slug];
    const d = pd?.variantes[l.varianteId];
    const base = { slug: l.slug, varianteId: l.varianteId, nom: l.nom, volume: l.volume, qte: l.qte };
    if (!p || !d || !visible(p, pd, compte)) indisponibles.push({ ...base, raison: 'Produit retiré de la vente ou non autorisé pour ce compte.' });
    else if (d.stock <= 0) indisponibles.push({ ...base, raison: 'En rupture de stock.' });
    else {
      const col = d.colisage || 1;
      const qte = Math.max(col, Math.round(l.qte / col) * col);
      lignes.push({ ...base, qte: Math.min(qte, Math.floor(d.stock / col) * col || qte), colisage: col, prixHT: prixCompteHT(d, p.tva, compte), etat: etatStock(d) });
    }
  }
  return { depuis: { id: c.id, numero: c.numero, date: c.createdAt }, lignes, indisponibles };
}

// ---------- Factures, documents ----------

async function factures(ctx) {
  const { doc, compte, idx } = await session(ctx);
  const aujourdhui = jourParis(ctx.maintenant);
  const liste = doc.commandes
    .filter((c) => c.compteId === compte.id && c.facture && c.statut !== 'annulee')
    .map((c) => commandeComplete(c, idx))
    .map((c) => ({ ...c.facture, enRetard: enRetard(c.facture, aujourdhui), totalHT: c.totaux.totalHT, totalTVA: c.totaux.totalTVA, totalTTC: c.totaux.totalTTC, commandeId: c.id, commandeNumero: c.numero }))
    .sort((a, b) => b.numero.localeCompare(a.numero));
  const aRegler = liste.filter((f) => f.statut === 'a-regler');
  return {
    factures: liste,
    totalARegler: somme(aRegler.map((f) => f.totalTTC)),
    enRetard: aRegler.filter((f) => f.enRetard).length,
    emetteur: doc.parametres.entreprise,
    client: { raisonSociale: compte.raisonSociale, enseigne: compte.enseigne, siret: compte.siret, tvaIntra: compte.tvaIntra, adresseFacturation: compte.adresseFacturation },
  };
}

async function documents(ctx) {
  const { doc, compte } = await session(ctx);
  const fiches = PRODUITS.filter((p) => visible(p, doc.produits[p.slug], compte)).map((p) => ({
    slug: p.slug,
    nom: p.nom,
    nomOfficiel: p.nomOfficiel,
    type: p.type,
    gammeNom: p.gammeNom,
    alcool: p.alcool,
    degre: p.degre,
    reference: p.reference,
    photo: p.photo,
    photoGrande: p.photoGrande,
    phrase: p.phrase,
    ingredients: p.ingredients,
    nutrition: p.nutrition,
    contenances: p.variantes.map((v) => ({ volume: v.volume, colisage: doc.produits[p.slug].variantes[v.id]?.colisage, coffret: v.coffret })),
    mentions: p.alcool ? [EVIN, MINEURS] : [],
  }));
  const mediatheque = [
    { titre: 'Logo de la distillerie', type: 'logo', format: 'svg', url: '/logos/logo.svg' },
    { titre: 'Logo de la distillerie (blanc)', type: 'logo', format: 'svg', url: '/logos/logo-blanc.svg' },
    { titre: 'Blason', type: 'logo', format: 'svg', url: '/logos/blason.svg' },
    { titre: 'Logotype PAC (fonds sombres et colorés)', type: 'logo', format: 'svg', url: '/marques/pac.svg' },
    { titre: 'Logotype PAC (fonds clairs)', type: 'logo', format: 'svg', url: '/marques/pac-clair.svg' },
    { titre: 'Logotype Fun Blue', type: 'logo', format: 'svg', url: '/marques/fun-blue.svg' },
    ...fiches.filter((f) => f.photo).map((f) => ({ titre: f.nom, type: 'photo', format: 'webp', url: f.photoGrande || f.photo, alcool: f.alcool })),
  ];
  return {
    fiches,
    mediatheque,
    plv: { disponible: false, texte: 'Démonstration : la PLV (affiches, présentoirs, chevalets) sera proposée ici.' },
    conditions: {
      grille: compte.grille,
      remise: compte.remise,
      paiement: LIBELLES_CONDITIONS[compte.conditions],
      minimumHT: doc.parametres.pro.minimumHT,
      francoHT: compte.francoHT ?? doc.parametres.pro.francoHT,
      fraisPortHT: doc.parametres.pro.fraisPortHT,
      delai: doc.parametres.pro.delai,
      note: 'Tarifs de démonstration, fictifs.',
    },
  };
}

// ---------- Compte et adresses ----------

async function compteGet(ctx) {
  const { doc, compte } = await session(ctx);
  return {
    compte: vueCompte(compte),
    utilisateurs: doc.utilisateurs
      .filter((x) => x.compteId === compte.id)
      .map((x) => ({ id: x.id, prenom: x.prenom, nom: x.nom, email: x.email, statut: !x.actif ? 'desactive' : x.hash ? 'actif' : 'invitation', derniereConnexion: x.derniereConnexion || null })),
    commercial: commercialDe(doc, compte),
  };
}

async function comptePatch(ctx) {
  const d = V.sansVide({
    // null ou '' efface le téléphone
    telephone: V.effacable(ctx.corps, 'telephone', () => V.telephone(ctx.corps, 'telephone')),
    email: V.email(ctx.corps, 'email', { libelle: 'E-mail de facturation' }),
  });
  if (!Object.keys(d).length) throw erreur(400, 'Seuls le téléphone et l’e-mail de facturation se modifient ici ; pour le reste, contactez votre commercial.', { code: 'saisie' });
  return ecrire(ctx, (doc, m, moi, compte) => {
    V.appliquer(compte, d);
    journaliser(doc, m.maintenant, { par: { id: moi.id, nom: nomComplet(moi), role: 'pro' }, action: 'compte.modification', cible: { type: 'compte', id: compte.id, libelle: compte.enseigne }, details: `Modifié dans l’espace pro : ${Object.keys(d).join(', ')}` });
    return vueCompte(compte);
  });
}

const lireAdresse = (corps) => V.adresse({ a: corps }, 'a', { requis: true, libelle: 'Adresse' });

async function adressePost(ctx) {
  const a = lireAdresse(ctx.corps);
  const r = await ecrire(ctx, (doc, m, moi, compte) => {
    if (compte.adressesLivraison.length >= 10) throw erreur(409, 'Dix adresses de livraison au plus.', { code: 'limite' });
    const x = { id: idAleatoire('adr'), ...a };
    compte.adressesLivraison.push(x);
    return x;
  });
  return avecStatut(201, r);
}

async function adressePatch(ctx) {
  const id = V.identifiant(ctx.param('id', 40), 'adr');
  const a = lireAdresse(ctx.corps);
  return ecrire(ctx, (doc, m, moi, compte) => {
    const x = compte.adressesLivraison.find((y) => y.id === id);
    if (!x) throw introuvable();
    for (const k of ['nom', 'ligne2', 'instructions']) delete x[k];
    Object.assign(x, a);
    return x;
  });
}

async function adresseDelete(ctx) {
  const id = V.identifiant(ctx.param('id', 40), 'adr');
  return ecrire(ctx, (doc, m, moi, compte) => {
    if (!compte.adressesLivraison.some((y) => y.id === id)) throw introuvable();
    compte.adressesLivraison = compte.adressesLivraison.filter((y) => y.id !== id);
    return { ok: true };
  });
}

// ---------- Messages ----------

function vueMessage(msg, { complet = false } = {}) {
  const out = { id: msg.id, reference: msg.reference, sujet: msg.sujet, statut: msg.statut, extrait: msg.fil[0]?.texte.slice(0, 140), dernierMessage: msg.fil.at(-1)?.date, nbMessages: msg.fil.length, createdAt: msg.createdAt };
  if (complet) out.fil = msg.fil.map((f) => ({ date: f.date, de: f.de, nom: f.de === 'equipe' ? f.par?.nom || 'Distillerie A. Blachère' : msg.nom, texte: f.texte }));
  return out;
}

async function messages(ctx) {
  const { doc, compte } = await session(ctx);
  const liste = doc.messages.filter((m) => m.compteId === compte.id).sort((a, b) => (b.fil.at(-1)?.date || '').localeCompare(a.fil.at(-1)?.date || '')).map((m) => vueMessage(m));
  return paginer(liste, ctx);
}

async function messageGet(ctx) {
  const { doc, compte } = await session(ctx);
  const id = V.identifiant(ctx.param('id', 40), 'msg');
  const msg = doc.messages.find((m) => m.id === id && m.compteId === compte.id);
  if (!msg) throw introuvable();
  return vueMessage(msg, { complet: true });
}

const SUJETS = ['commande', 'visite', 'pro', 'presse', 'autre'];

// Nouveau message (arrive dans les messages du CRM) ou réponse à un échange existant (id).
async function messagePost(ctx) {
  const c = ctx.corps;
  const texte = V.texte(c, 'texte', { requis: true, min: 2, max: 4000, multiligne: true, libelle: 'Message' });
  const sujet = V.choix(c, 'sujet', SUJETS, { defaut: 'pro', libelle: 'Sujet' });
  const id = c.id === undefined || c.id === null ? null : V.identifiant(c.id, 'msg');
  const r = await ecrire(ctx, (doc, m, moi, compte) => {
    const date = iso(m.maintenant);
    let msg;
    if (id) {
      msg = doc.messages.find((x) => x.id === id && x.compteId === compte.id);
      if (!msg) throw introuvable();
      msg.fil.push({ date, de: 'client', texte });
      msg.lu = false;
      if (msg.statut === 'traite' || msg.statut === 'archive') msg.statut = 'en-cours';
    } else {
      msg = { id: idAleatoire('msg'), reference: '', nom: nomComplet(moi), email: moi.email, sujet, statut: 'nouveau', lu: false, compteId: compte.id, assigneA: compte.commercialId, fil: [{ date, de: 'client', texte }], createdAt: date };
      if (!msg.assigneA) delete msg.assigneA;
      msg.reference = prochainNumero(doc, 'message', m.maintenant);
      doc.messages.push(msg);
    }
    journaliser(doc, m.maintenant, { par: { id: moi.id, nom: nomComplet(moi), role: 'pro' }, action: id ? 'message.relance' : 'message.creation', cible: { type: 'message', id: msg.id, libelle: `Message ${msg.reference}` }, details: `${compte.enseigne}` });
    return vueMessage(msg, { complet: true });
  });
  return avecStatut(201, r);
}

export const routes = {
  GET: {
    accueil,
    catalogue,
    commandes,
    commande: commandeDetail,
    recommander,
    factures,
    documents,
    compte: compteGet,
    messages,
    message: messageGet,
  },
  POST: { devis, commande, adresse: adressePost, message: messagePost },
  PATCH: { compte: comptePatch, adresse: adressePatch },
  DELETE: { adresse: adresseDelete },
};
