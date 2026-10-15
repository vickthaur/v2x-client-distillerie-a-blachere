// api/site : formulaires publics, catalogue de la démo, créneaux de visite (docs/crm-espace-pro.md, § 7).
// Sans démo, les lectures (créneaux, frais de port, code promo) se font sur le jeu de démonstration
// du jour calculé en mémoire, jamais enregistré ; tout POST qui enregistre quelque chose (commande,
// réservation, message, inscription, demande pro) crée la démo s'il n'y en a pas (rien n'est créé
// si la saisie est refusée) et rend liens.crm vers l'élément créé.
import { demoCourante, ecrireSite } from '../acces.js';
import { hacheMotDePasseDemo } from '../auth.js';
import * as C from '../courriels.js';
import { deposerCourriel, journaliser, PAR_SITE } from '../evenements.js';
import { avecStatut, erreur } from '../http.js';
import { creerCommandeParticulier, creneauxDuJour, inscrireAbonne, LIENS_CRM, reserver, resoudreLignes, trouverClient } from '../metier.js';
import { appliquerPromo, etatStock, francoRestant, MODES_PARTICULIER, MOMENTS, optionsLivraison, prochainNumero, versCentimes, versEuros } from '../regles.js';
import { genererDemo } from '../seed.js';
import { ajouterJours, estMois, iso, joursDuMois, jourParis, jourSemaine, mois as moisDe } from '../temps.js';
import { idAleatoire } from '../aleatoire.js';
import * as V from '../valider.js';

// Jeu de démonstration du jour, en mémoire (visiteurs sans démo).
let vitrine = null;
async function jeuDuJour(ctx) {
  const jour = jourParis(ctx.maintenant);
  if (!vitrine || vitrine.jour !== jour) {
    vitrine = { jour, doc: genererDemo({ id: 'vitrinedujourabc', maintenant: ctx.maintenant, hache: await hacheMotDePasseDemo() }) };
  }
  return vitrine.doc;
}
async function docLecture(ctx) {
  return (await demoCourante(ctx))?.doc || jeuDuJour(ctx);
}

// ---------- GET ----------

async function catalogue(ctx) {
  const d = await demoCourante(ctx);
  if (!d) return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  const produits = {};
  for (const [slug, p] of Object.entries(d.doc.produits)) {
    const variantes = {};
    for (const [id, v] of Object.entries(p.variantes)) variantes[id] = { prixTTC: v.prixTTC, etat: etatStock(v) };
    produits[slug] = { actif: p.actif, variantes };
  }
  return { produits };
}

async function creneaux(ctx) {
  const aujourdhui = jourParis(ctx.maintenant);
  const m = ctx.param('mois') || moisDe(aujourdhui);
  if (!estMois(m)) throw erreur(400, 'Mois invalide (AAAA-MM).', { champ: 'mois', code: 'saisie' });
  if (m < moisDe(ajouterJours(aujourdhui, -31)) || m > moisDe(ajouterJours(aujourdhui, 400))) throw erreur(400, 'Mois hors de la période de réservation.', { champ: 'mois', code: 'saisie' });
  const doc = await docLecture(ctx);
  return { jours: joursDuMois(m).map((j) => creneauxDuJour(doc, j, ctx.maintenant)) };
}

// ---------- Calculs du panier (rien n'est enregistré) ----------

function articlesDe(doc, lignes) {
  const items = resoudreLignes(doc, lignes);
  const articlesTTC = versEuros(items.reduce((s, x) => s + versCentimes(x.d.prixTTC) * x.qte, 0));
  const bouteilles = items.reduce((s, x) => s + x.qte, 0);
  return { items, articlesTTC, bouteilles };
}

async function livraison(ctx) {
  const lignes = V.lignes(ctx.corps);
  V.choix(ctx.corps, 'mode', MODES_PARTICULIER, { libelle: 'Mode de livraison' });
  const cp = V.codePostal(ctx.corps, 'cp');
  const doc = await docLecture(ctx);
  const { articlesTTC, bouteilles } = articlesDe(doc, lignes);
  return {
    options: optionsLivraison({ bouteilles, articlesTTC, cp, parametres: doc.parametres }),
    francoRestantTTC: francoRestant(articlesTTC, doc.parametres),
    articlesTTC,
    bouteilles,
  };
}

const codeDe = (corps, requis) => {
  const s = V.texte(corps, 'code', { requis, max: 30, libelle: 'Code promo' });
  return s === undefined ? undefined : s.toUpperCase().replace(/\s/g, '');
};

async function codePromo(ctx) {
  const code = codeDe(ctx.corps, true);
  const lignes = V.lignes(ctx.corps);
  const doc = await docLecture(ctx);
  const { articlesTTC } = articlesDe(doc, lignes);
  const promo = doc.promos.find((p) => p.code === code);
  const r = appliquerPromo(promo, { articlesTTC, aujourdhui: jourParis(ctx.maintenant) });
  return { valide: true, code: promo.code, libelle: promo.libelle, remiseTTC: r.remiseTTC, livraisonOfferte: r.livraisonOfferte };
}

// ---------- Formulaires ----------

async function commande(ctx) {
  const c = ctx.corps;
  const client = V.objet(c, 'client', { requis: true, libelle: 'Coordonnées' });
  const liv = V.objet(c, 'livraison', { requis: true, libelle: 'Livraison' });
  const pai = V.objet(c, 'paiement', { requis: true, libelle: 'Paiement' });
  const aujourdhui = jourParis(ctx.maintenant);
  const donnees = {
    client: {
      prenom: V.texte(client, 'prenom', { requis: true, max: 60, libelle: 'Prénom' }),
      nom: V.texte(client, 'nom', { requis: true, max: 80, libelle: 'Nom' }),
      email: V.email(client, 'email', { requis: true }),
      telephone: V.telephone(client, 'telephone', { requis: true }),
    },
    livraison: { mode: V.choix(liv, 'mode', MODES_PARTICULIER, { requis: true, libelle: 'Mode de livraison' }) },
    paiement: { mode: V.choix(pai, 'mode', ['carte', 'paypal', 'virement'], { requis: true, libelle: 'Moyen de paiement' }) },
    lignes: V.lignes(c),
    code: codeDe(c, false),
    ageConfirme: V.booleen(c, 'ageConfirme', { defaut: false }),
    newsletter: V.booleen(c, 'newsletter', { defaut: false }),
  };
  V.vrai(c, 'cgv', 'Acceptez les conditions générales de vente pour valider la commande.');
  if (donnees.livraison.mode === 'retrait') {
    const j = V.jour(liv, 'jourRetrait', { requis: true, libelle: 'Jour de retrait' });
    if (j <= aujourdhui || j > ajouterJours(aujourdhui, 30) || jourSemaine(j) === 0) {
      throw erreur(400, 'Jour de retrait : du lundi au samedi, à partir de demain et dans les 30 jours.', { champ: 'jourRetrait', code: 'saisie' });
    }
    donnees.livraison.jourRetrait = j;
  } else {
    const a = V.adresse(liv, 'adresse', { requis: true, libelle: 'Adresse de livraison' });
    if (!V.estMetropole(a.cp)) throw erreur(400, 'Pas d’envoi hors de France métropolitaine dans la démonstration.', { champ: 'cp', code: 'saisie' });
    donnees.livraison.adresse = a;
  }
  const cmd = await ecrireSite(ctx, (doc, m) => creerCommandeParticulier(doc, m, donnees, { canal: 'en-ligne', par: PAR_SITE }));
  const out = { id: cmd.id, numero: cmd.numero, totalTTC: cmd.totaux.totalTTC, statut: cmd.statut, paiement: { mode: cmd.paiement.mode, statut: cmd.paiement.statut }, liens: { crm: LIENS_CRM.commande(cmd.id) } };
  if (cmd.operation) out.operation = cmd.operation;
  return avecStatut(201, out);
}

async function reservation(ctx) {
  const c = ctx.corps;
  const aujourdhui = jourParis(ctx.maintenant);
  const date = V.jour(c, 'date', { requis: true, libelle: 'Date de visite' });
  if (date < aujourdhui || date > ajouterJours(aujourdhui, 366)) throw erreur(400, 'Date de visite : à partir d’aujourd’hui et dans l’année.', { champ: 'date', code: 'saisie' });
  const personnes = V.entier(c, 'personnes', { requis: true, min: 1, max: 25, libelle: 'Nombre de personnes' });
  const mineurs = V.entier(c, 'mineurs', { min: 0, max: 24, defaut: 0, libelle: 'Mineurs' });
  if (mineurs >= personnes) throw erreur(400, 'Au moins un adulte accompagne le groupe (les mineurs sont comptés dans les personnes).', { champ: 'mineurs', code: 'saisie' });
  const donnees = {
    date,
    moment: V.choix(c, 'moment', MOMENTS, { requis: true, libelle: 'Moment' }),
    personnes,
    mineurs,
    langue: V.choix(c, 'langue', ['fr', 'en', 'de'], { defaut: 'fr', libelle: 'Langue' }),
    nom: V.texte(c, 'nom', { requis: true, min: 2, max: 80, libelle: 'Nom' }),
    email: V.email(c, 'email', { requis: true }),
    telephone: V.telephone(c, 'telephone'),
    message: V.texte(c, 'message', { max: 1000, multiligne: true, libelle: 'Message' }),
    newsletter: V.booleen(c, 'newsletter', { defaut: false }),
  };
  V.vrai(c, 'rgpd', 'Acceptez le traitement de vos données pour réserver.');
  const { reservation: r, seance } = await ecrireSite(ctx, (doc, m) => reserver(doc, m, donnees, { source: 'site', par: PAR_SITE }));
  return avecStatut(201, { reference: r.reference, date: r.date, moment: r.moment, heure: seance.heure, liens: { crm: LIENS_CRM.reservation(r.id) } });
}

const SUJETS = ['commande', 'visite', 'pro', 'presse', 'autre'];

async function contact(ctx) {
  const c = ctx.corps;
  const donnees = {
    nom: V.texte(c, 'nom', { requis: true, min: 2, max: 80, libelle: 'Nom' }),
    email: V.email(c, 'email', { requis: true }),
    telephone: V.telephone(c, 'telephone'),
    sujet: V.choix(c, 'sujet', SUJETS, { requis: true, libelle: 'Sujet' }),
    texte: V.texte(c, 'message', { requis: true, min: 5, max: 4000, multiligne: true, libelle: 'Message' }),
  };
  V.vrai(c, 'rgpd', 'Acceptez le traitement de vos données pour envoyer le message.');
  const msg = await ecrireSite(ctx, (doc, m) => {
    const date = m.maintenant;
    const x = {
      id: idAleatoire('msg'),
      reference: prochainNumero(doc, 'message', date),
      nom: donnees.nom,
      email: donnees.email,
      sujet: donnees.sujet,
      statut: 'nouveau',
      lu: false,
      fil: [{ date: iso(date), de: 'client', texte: donnees.texte }],
      createdAt: iso(date),
    };
    if (donnees.telephone) x.telephone = donnees.telephone;
    const client = trouverClient(doc, donnees.email);
    if (client) x.clientId = client.id;
    const pro = doc.utilisateurs.find((u) => u.role === 'pro' && u.email === donnees.email);
    if (pro) x.compteId = pro.compteId;
    doc.messages.push(x);
    journaliser(doc, date, { par: PAR_SITE, action: 'message.creation', cible: { type: 'message', id: x.id, libelle: `Message ${x.reference}` }, details: `De ${x.nom}` });
    return x;
  });
  return avecStatut(201, { reference: msg.reference, liens: { crm: LIENS_CRM.message(msg.id) } });
}

const SOURCES = ['pied-de-page', 'commande', 'visite', 'contact', 'salon'];

async function newsletter(ctx) {
  const c = ctx.corps;
  const email = V.email(c, 'email', { requis: true });
  const prenom = V.texte(c, 'prenom', { max: 60, libelle: 'Prénom' });
  const source = V.choix(c, 'source', SOURCES, { defaut: 'pied-de-page', libelle: 'Source' });
  const d = await demoCourante(ctx);
  // déjà inscrit : rien à enregistrer (et pas de démo créée pour autant)
  const deja = d?.doc.abonnes.find((a) => a.email === email && (a.statut || 'inscrit') === 'inscrit');
  if (deja) return { ok: true, deja: true, liens: { crm: LIENS_CRM.abonne(deja.id) } };
  const r = await ecrireSite(ctx, (doc, m) => {
    const res = inscrireAbonne(doc, m.maintenant, { email, prenom, source });
    if (res.deja) {
      m.inchange();
      return res;
    }
    journaliser(doc, m.maintenant, { par: PAR_SITE, action: 'abonne.inscription', cible: { type: 'abonne', id: res.abonne.id, libelle: email }, details: `Source : ${source}` });
    deposerCourriel(doc, m.maintenant, C.bienvenueNewsletter(res.abonne));
    return res;
  });
  if (r.deja) return { ok: true, deja: true, liens: { crm: LIENS_CRM.abonne(r.abonne.id) } };
  return avecStatut(201, { ok: true, liens: { crm: LIENS_CRM.abonne(r.abonne.id) } });
}

export const ACTIVITES = ['chr', 'hotel', 'camping', 'caviste', 'epicerie', 'distributeur', 'autre'];

async function demandePro(ctx) {
  const c = ctx.corps;
  const donnees = {
    societe: V.texte(c, 'societe', { requis: true, min: 2, max: 120, libelle: 'Société' }),
    activite: V.choix(c, 'activite', ACTIVITES, { requis: true, libelle: 'Activité' }),
    siret: V.siret(c, 'siret'),
    nom: V.texte(c, 'nom', { requis: true, min: 2, max: 80, libelle: 'Nom' }),
    ville: V.texte(c, 'ville', { requis: true, max: 80, libelle: 'Ville' }),
    email: V.email(c, 'email', { requis: true }),
    telephone: V.telephone(c, 'telephone'),
    message: V.texte(c, 'message', { max: 2000, multiligne: true, libelle: 'Message' }),
  };
  V.vrai(c, 'rgpd', 'Acceptez le traitement de vos données pour envoyer la demande.');
  const dem = await ecrireSite(ctx, (doc, m) => {
    const date = m.maintenant;
    const x = { id: idAleatoire('dem'), reference: prochainNumero(doc, 'demande', date), ...V.sansVide({ ...donnees }), statut: 'nouvelle', createdAt: iso(date) };
    doc.demandes.push(x);
    journaliser(doc, date, { par: PAR_SITE, action: 'demande.creation', cible: { type: 'demande', id: x.id, libelle: `Demande ${x.reference}` }, details: x.societe });
    deposerCourriel(doc, date, C.demandeProRecue(x));
    return x;
  });
  return avecStatut(201, { reference: dem.reference, liens: { crm: LIENS_CRM.demande(dem.id) } });
}

export const routes = {
  GET: { catalogue, creneaux },
  POST: { livraison, 'code-promo': codePromo, commande, reservation, contact, newsletter, 'demande-pro': demandePro },
};
