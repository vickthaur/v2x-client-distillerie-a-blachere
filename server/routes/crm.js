// api/crm : back-office du personnel (docs/crm-espace-pro.md, § 7). Chaque appel exige une session
// bl_crm valable et le droit du rôle sur la rubrique (tableau du § 3) : le serveur fait foi,
// l'interface ne fait que masquer.
import { demoCourante, exigerSession, moiDans, muter } from '../acces.js';
import { DUREE_INVITATION_MS, exiger, NOMS_ROLES, nouveauJeton, peutLire, peutEcrire, ROLES_PERSONNEL } from '../auth.js';
import { NOMS_GAMMES, PRODUITS, produit as produitDe } from '../catalogue.js';
import * as C from '../courriels.js';
import { reponseCsv } from '../csv.js';
import { auteur, auteurCourt, deposerCourriel, journaliser, nomComplet } from '../evenements.js';
import { avecStatut, erreur, introuvable, paginer, trier } from '../http.js';
import {
  ajusterStock,
  changerStatut,
  creerCommandeParticulier,
  creerCommandePro,
  encoursCompte,
  inscrireAbonne,
  LIENS_CRM,
  reserver,
  trouverClient,
} from '../metier.js';
import { abonneComplet, clientComplet, commandeComplete, compteResume, index, reservationComplete, seanceComplete, totauxCommande } from '../modele.js';
import { bilanOperation, OPERATIONS } from '../operation.js';
import {
  CONDITIONS,
  enRetard,
  etatStock,
  LIBELLES_CONDITIONS,
  LIBELLES_LICENCES,
  LIBELLES_ORIGINES,
  LIBELLES_PAIEMENTS,
  LIBELLES_RESERVATIONS,
  LIBELLES_SOURCES,
  LIBELLES_STATUTS,
  LIBELLES_STATUTS_PAIEMENT,
  LIBELLES_TYPES_COMPTE,
  libelleSeance,
  MODES_PARTICULIER,
  MOMENTS,
  placesRestantes,
  prixProReference,
  STATUTS,
  suiviExige,
  transitionsPossibles,
  versCentimes,
  versEuros,
} from '../regles.js';
import { ajouterJours, debutSemaine, ecartJours, estJour, instantParis, iso, jourParis, mois as moisDe, moisPrecedent } from '../temps.js';
import { typo } from '../typo.js';
import { idAleatoire } from '../aleatoire.js';
import * as V from '../valider.js';

// ---------- Accès ----------

// Lecture : session du personnel, droit de lecture sur la rubrique, document de la démo.
async function lire(ctx, rubrique) {
  const u = await exigerSession(ctx, 'crm');
  if (rubrique) exiger(u, rubrique, 'lecture');
  const doc = (await demoCourante(ctx)).doc;
  return { u, doc, idx: index(doc) };
}

// Droit vérifié dès l'entrée d'un gestionnaire d'écriture (avant la lecture de la saisie) :
// sans session → 401, sans droit → 403.
async function droit(ctx, rubrique, mode = 'ecriture') {
  const u = await exigerSession(ctx, 'crm');
  if (rubrique) exiger(u, rubrique, mode);
  return u;
}

// Écriture : droit d'écriture vérifié avant, puis de nouveau dans le document de la mutation.
async function ecrire(ctx, rubrique, fn) {
  const u = await exigerSession(ctx, 'crm');
  if (rubrique) exiger(u, rubrique, 'ecriture');
  return muter(ctx, (doc, m) => {
    const moi = moiDans(doc, ctx);
    if (rubrique) exiger(moi, rubrique, 'ecriture');
    return fn(doc, m, moi);
  });
}

const rubriqueCommande = (c) => (c.canal === 'pro' ? 'commandes-pro' : 'commandes');
const sansAccents = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const contient = (q, ...champs) => champs.some((c) => sansAccents(c).includes(q));
const trouver = (liste, id, prefixe) => {
  V.identifiant(id, prefixe);
  const x = liste.find((e) => e.id === id);
  if (!x) throw introuvable();
  return x;
};
const parametreId = (ctx, prefixe) => V.identifiant(ctx.param('id', 40), prefixe);
const aujourdhuiDe = (ctx) => jourParis(ctx.maintenant);
const nomUtilisateur = (idx, id) => {
  const u = id ? idx.utilisateurs.get(id) : null;
  return u ? { id: u.id, nom: nomComplet(u) } : null;
};
const somme = (l) => versEuros(l.reduce((s, x) => s + versCentimes(x), 0));

// ---------- Vues ----------

function articles(c) {
  return c.lignes.reduce((s, l) => s + l.qte, 0);
}

function alerteCommande(c, aujourdhui, instant) {
  if (c.facture && enRetard(c.facture, aujourdhui)) return 'Facture en retard';
  if (c.paiement.statut === 'en-attente' && c.canal !== 'pro') return 'Paiement en attente';
  if (['nouvelle', 'en-preparation'].includes(c.statut)) {
    const heures = (instant.getTime() - Date.parse(c.createdAt)) / 3600000;
    if (heures > 72) return `En attente depuis ${Math.floor(heures / 24)} jours`;
    if (c.dateSouhaitee && c.dateSouhaitee <= ajouterJours(aujourdhui, 1)) return 'Date de livraison souhaitée proche';
  }
  if (c.statut === 'prete' && c.livraison.jourRetrait && c.livraison.jourRetrait < aujourdhui) return 'Pas encore retirée';
  return undefined;
}

function resumeCommande(c, idx, aujourdhui, instant) {
  const compte = c.compteId ? idx.comptes.get(c.compteId) : null;
  const out = {
    id: c.id,
    numero: c.numero,
    date: c.createdAt,
    canal: c.canal,
    client: compte ? { id: compte.id, nom: compte.enseigne, type: 'pro' } : { id: c.clientId, nom: c.contact.nom, type: 'particulier' },
    articles: articles(c),
    totalHT: c.totaux.totalHT,
    totalTTC: c.totaux.totalTTC,
    paiement: { mode: c.paiement.mode, statut: c.paiement.statut },
    statut: c.statut,
  };
  const alerte = alerteCommande(c, aujourdhui, instant);
  if (alerte) out.alerte = alerte;
  if (c.operation) out.operation = c.operation;
  return out;
}

// Commande complète pour un rôle (sans facture pour qui n'a pas le droit de les voir).
function commandePourRole(c, u) {
  const out = { ...c };
  if (!peutLire(u.role, 'factures')) delete out.facture;
  return out;
}

const transitionsDe = (c) => transitionsPossibles(c).map((s) => ({ statut: s, libelle: LIBELLES_STATUTS[s], exigeSuivi: s === 'expediee' && suiviExige(c) }));

// ---------- Tableau de bord, notifications, recherche ----------

async function tableau(ctx) {
  const { doc, idx } = await lire(ctx, 'tableau');
  const aujourdhui = aujourdhuiDe(ctx);
  const valides = doc.commandes.filter((c) => c.statut !== 'annulee' && c.statut !== 'remboursee').map((c) => commandeComplete(c, idx));
  const jourDe = (c) => jourParis(c.createdAt);
  const debut30 = ajouterJours(aujourdhui, -29);
  const sur30 = valides.filter((c) => jourDe(c) >= debut30);
  // les 30 jours d'avant (J−59 à J−30), pour comparer 30 jours à 30 jours
  const debutPrecedent30 = ajouterJours(aujourdhui, -59);
  const precedent30 = valides.filter((c) => jourDe(c) >= debutPrecedent30 && jourDe(c) < debut30);
  const ht = (l) => somme(l.map((c) => c.totaux.totalHT));
  const moisCourant = moisDe(aujourdhui);
  const precedent = moisPrecedent(aujourdhui);
  const ventes30 = Array.from({ length: 30 }, (_, i) => {
    const date = ajouterJours(debut30, i);
    const du = sur30.filter((c) => jourDe(c) === date);
    return { date, enLigne: ht(du.filter((c) => c.canal !== 'pro')), pro: ht(du.filter((c) => c.canal === 'pro')) };
  });
  const top = new Map();
  for (const c of sur30)
    for (const l of c.lignes) {
      const t = top.get(l.slug) || { slug: l.slug, nom: l.nom, qte: 0, c: 0 };
      t.qte += l.qte;
      t.c += versCentimes(l.totalHT);
      top.set(l.slug, t);
    }
  const stocksBas = [];
  for (const [slug, p] of Object.entries(doc.produits))
    for (const [id, v] of Object.entries(p.variantes)) {
      if (v.stock > v.seuil) continue;
      const pc = produitDe(slug);
      stocksBas.push({ slug, varianteId: id, nom: pc?.nom || slug, volume: pc?.variantes.find((x) => x.id === id)?.volume || id, stock: v.stock, seuil: v.seuil, etat: etatStock(v), actif: p.actif });
    }
  stocksBas.sort((a, b) => a.stock / Math.max(1, a.seuil) - b.stock / Math.max(1, b.seuil));
  // les cinq prochaines séances ouvertes, pas encore commencées
  const prochaines = doc.seances
    .filter((s) => s.date >= aujourdhui && (s.statut || 'ouverte') === 'ouverte' && instantParis(s.date, s.heure).getTime() > ctx.maintenant.getTime())
    .slice(0, 5)
    .map((s) => vueSeance(s, doc, idx));
  const caSur30 = ht(sur30);
  return {
    ca: {
      jour: ht(valides.filter((c) => jourDe(c) === aujourdhui)),
      semaine: ht(valides.filter((c) => jourDe(c) >= debutSemaine(aujourdhui))),
      mois: ht(valides.filter((c) => moisDe(jourDe(c)) === moisCourant)),
      moisPrecedent: ht(valides.filter((c) => moisDe(jourDe(c)) === precedent)),
      enLigne30: ht(sur30.filter((c) => c.canal !== 'pro')),
      pro30: ht(sur30.filter((c) => c.canal === 'pro')),
      precedent30: ht(precedent30),
    },
    commandes30: sur30.length,
    panierMoyen30: sur30.length ? versEuros(Math.round(versCentimes(caSur30) / sur30.length)) : 0,
    aTraiter: {
      commandes: doc.commandes.filter((c) => c.statut === 'nouvelle' || c.statut === 'en-preparation').length,
      demandes: doc.demandes.filter((d) => d.statut === 'nouvelle').length,
      messages: doc.messages.filter((m) => m.statut === 'nouveau').length,
      reservationsJour: doc.reservations.filter((r) => r.date === aujourdhui && r.statut === 'confirmee').length,
      facturesEnRetard: doc.commandes.filter((c) => c.statut !== 'annulee' && c.facture && enRetard({ ...c.facture, echeance: c.facture.echeance || c.facture.date }, aujourdhui)).length,
    },
    ventes30,
    top: [...top.values()]
      .sort((a, b) => b.c - a.c)
      .slice(0, 5)
      .map((t) => ({ slug: t.slug, nom: t.nom, qte: t.qte, totalHT: versEuros(t.c) })),
    stocksBas,
    prochainesVisites: prochaines,
    activite: doc.journal.slice(-10).reverse(),
    operation: bilanOperation(doc.commandes, ctx.maintenant),
    montants: 'HT',
  };
}

async function notifications(ctx) {
  const { u, doc } = await lire(ctx, null);
  const vu = doc.vu?.[u.id]?.notifications || doc.createdAt;
  const lisible = (r) => peutLire(u.role, r);
  let stocksBas = 0;
  for (const p of Object.values(doc.produits)) for (const v of Object.values(p.variantes)) if (v.stock <= v.seuil) stocksBas += 1;
  return {
    commandes: doc.commandes.filter((c) => c.createdAt > vu && lisible(rubriqueCommande(c))).length,
    demandes: lisible('comptes') ? doc.demandes.filter((d) => d.createdAt > vu).length : 0,
    messages: lisible('messages') ? doc.messages.filter((m) => !m.lu && m.statut !== 'archive').length : 0,
    stocksBas: lisible('stocks') ? stocksBas : 0,
    version: doc.updatedAt,
    vuLe: vu,
  };
}

async function notificationsVues(ctx) {
  return ecrire(ctx, null, (doc, m, moi) => {
    doc.vu ||= {};
    doc.vu[moi.id] = { notifications: iso(m.maintenant) };
    return { ok: true, vuLe: iso(m.maintenant) };
  });
}

async function recherche(ctx) {
  const { u, doc, idx } = await lire(ctx, null);
  const q = sansAccents(ctx.param('q', 80) || '');
  if (q.length < 2) return { resultats: [] };
  const out = [];
  const ajouter = (type, liste) => out.push(...liste.slice(0, 8).map((x) => ({ type, ...x })));
  const lisible = (r) => peutLire(u.role, r);
  if (lisible('commandes') || lisible('commandes-pro')) {
    ajouter(
      'commande',
      doc.commandes
        .filter((c) => lisible(rubriqueCommande(c)))
        .map((c) => commandeComplete(c, idx))
        .filter((c) => contient(q, c.numero, c.contact.nom, c.contact.email, c.referenceClient))
        .reverse()
        .map((c) => ({ id: c.id, titre: c.numero, sousTitre: typo(`${c.contact.nom} · ${LIBELLES_STATUTS[c.statut]}`), url: LIENS_CRM.commande(c.id) })),
    );
  }
  if (lisible('clients'))
    ajouter('client', doc.clients.filter((c) => contient(q, `${c.prenom} ${c.nom}`, c.email, c.telephone)).map((c) => ({ id: c.id, titre: `${c.prenom} ${c.nom}`, sousTitre: c.email, url: LIENS_CRM.client(c.id) })));
  if (lisible('comptes')) {
    ajouter('compte', doc.comptes.filter((k) => contient(q, k.enseigne, k.raisonSociale, k.adresseFacturation?.ville, k.email)).map((k) => ({ id: k.id, titre: k.enseigne, sousTitre: k.adresseFacturation?.ville || '', url: LIENS_CRM.compte(k.id) })));
    ajouter('demande', doc.demandes.filter((d) => contient(q, d.reference, d.societe, d.nom, d.email)).map((d) => ({ id: d.id, titre: `${d.reference} · ${d.societe}`, sousTitre: d.ville, url: LIENS_CRM.demande(d.id) })));
  }
  if (lisible('messages'))
    ajouter('message', doc.messages.filter((m) => contient(q, m.reference, m.nom, m.email)).reverse().map((m) => ({ id: m.id, titre: `${m.reference} · ${m.nom}`, sousTitre: m.sujet, url: LIENS_CRM.message(m.id) })));
  if (lisible('visites'))
    ajouter('reservation', doc.reservations.filter((r) => contient(q, r.reference, r.nom, r.email)).reverse().map((r) => ({ id: r.id, titre: `${r.reference} · ${r.nom}`, sousTitre: r.date, url: LIENS_CRM.reservation(r.id) })));
  if (lisible('produits'))
    ajouter('produit', PRODUITS.filter((p) => contient(q, p.nom, p.slug, p.nomOfficiel)).map((p) => ({ id: p.slug, titre: p.nom, sousTitre: p.gammeNom, url: LIENS_CRM.produit(p.slug) })));
  return { resultats: out.slice(0, 30) };
}

// ---------- Commandes ----------

const TRI_COMMANDES = { date: (c) => c.createdAt, total: (c) => c.totaux.totalTTC, numero: (c) => c.numero, statut: (c) => STATUTS.indexOf(c.statut) };

// Commandes lisibles filtrées comme dans la liste du CRM (et dans son export) : canal, compte,
// client, période (jour de Paris) et recherche. Le statut demandé est rendu à part : les compteurs de
// la liste comptent tous les statuts.
function commandesFiltrees(ctx, doc, idx, lisibles) {
  const statut = ctx.param('statut');
  const canal = ctx.param('canal');
  const du = ctx.param('du');
  const au = ctx.param('au');
  const q = sansAccents(ctx.param('q', 80) || '');
  const compteId = ctx.param('compteId', 40);
  const clientId = ctx.param('clientId', 40);
  if (statut && !STATUTS.includes(statut)) throw erreur(400, 'Statut inconnu.', { champ: 'statut', code: 'saisie' });
  if (canal && !['en-ligne', 'pro', 'telephone'].includes(canal)) throw erreur(400, 'Canal inconnu.', { champ: 'canal', code: 'saisie' });
  if ((du && !estJour(du)) || (au && !estJour(au))) throw erreur(400, 'Dates invalides (AAAA-MM-JJ).', { champ: du && !estJour(du) ? 'du' : 'au', code: 'saisie' });
  const liste = doc.commandes
    .filter((c) => lisibles.includes(rubriqueCommande(c)))
    .filter((c) => !canal || c.canal === canal)
    .filter((c) => !compteId || c.compteId === compteId)
    .filter((c) => !clientId || c.clientId === clientId)
    .filter((c) => (!du || jourParis(c.createdAt) >= du) && (!au || jourParis(c.createdAt) <= au))
    .map((c) => commandeComplete(c, idx))
    .filter((c) => !q || contient(q, c.numero, c.contact.nom, c.contact.email, c.referenceClient, idx.comptes.get(c.compteId)?.enseigne));
  return { liste, statut };
}

async function commandes(ctx) {
  const { u, doc, idx } = await lire(ctx, null);
  const lisibles = ['commandes', 'commandes-pro'].filter((r) => peutLire(u.role, r));
  if (!lisibles.length) exiger(u, 'commandes', 'lecture');
  const aujourdhui = aujourdhuiDe(ctx);
  const { liste: toutes, statut } = commandesFiltrees(ctx, doc, idx, lisibles);
  const compteurs = Object.fromEntries(STATUTS.map((s) => [s, 0]));
  for (const c of toutes) compteurs[c.statut] += 1;
  const liste = trier(statut ? toutes.filter((c) => c.statut === statut) : toutes, ctx.param('tri'), TRI_COMMANDES, '-date');
  const page = paginer(liste, ctx);
  return { ...page, elements: page.elements.map((c) => resumeCommande(c, idx, aujourdhui, ctx.maintenant)), compteurs };
}

function vueCommande(c, doc, idx, u, instant) {
  const out = commandePourRole(commandeComplete(c, idx), u);
  if (c.clientId) {
    const k = idx.clients.get(c.clientId);
    if (k) out.client = { id: k.id, nom: `${k.prenom} ${k.nom}`, email: k.email, telephone: k.telephone, commandes: doc.commandes.filter((x) => x.clientId === k.id).length };
  }
  if (c.compteId) {
    const k = idx.comptes.get(c.compteId);
    if (k) {
      out.compte = { ...compteResume(k), type: k.type, conditions: k.conditions, licence: k.licence, telephone: k.telephone, email: k.email };
      if (peutLire(u.role, 'factures')) Object.assign(out.compte, { encours: encoursCompte(doc, k.id), encoursMax: k.encoursMax });
    }
  }
  if (c.auteurId) out.auteur = nomUtilisateur(idx, c.auteurId);
  out.transitions = peutEcrire(u.role, rubriqueCommande(c)) ? transitionsDe(c) : [];
  out.alerte = alerteCommande(out, jourParis(instant), instant);
  if (!out.alerte) delete out.alerte;
  return out;
}

async function commande(ctx) {
  const { u, doc, idx } = await lire(ctx, null);
  const c = trouver(doc.commandes, ctx.param('id', 40), 'cmd');
  if (!peutLire(u.role, rubriqueCommande(c))) throw introuvable();
  return vueCommande(c, doc, idx, u, ctx.maintenant);
}

// Saisie d'une commande (téléphone ou pro).
async function creerCommande(ctx) {
  await droit(ctx, ctx.corps.compteId !== undefined ? 'commandes-pro' : 'commandes');
  const corps = ctx.corps;
  const note = V.texte(corps, 'note', { max: 1000, multiligne: true, libelle: 'Note' });
  const lignes = V.lignes(corps);
  if (corps.compteId !== undefined) {
    const compteId = V.identifiant(corps.compteId, 'cpt', { champ: 'compteId' });
    const liv = V.objet(corps, 'livraison', { libelle: 'Livraison' }) || {};
    const donnees = {
      lignes,
      adresseId: liv.adresseId === undefined ? undefined : V.identifiant(liv.adresseId, 'adr', { champ: 'adresseId' }),
      dateSouhaitee: V.jour(corps, 'dateSouhaitee', { libelle: 'Date souhaitée' }),
      referenceClient: V.texte(corps, 'referenceClient', { max: 40, libelle: 'Référence client' }),
      commentaire: V.texte(corps, 'commentaire', { max: 500, multiligne: true, libelle: 'Commentaire' }),
    };
    const c = await ecrire(ctx, 'commandes-pro', (doc, m, moi) => {
      const compte = doc.comptes.find((k) => k.id === compteId);
      if (!compte) throw introuvable('Compte introuvable.');
      const cree = creerCommandePro(doc, m, compte, donnees, { par: auteurCourt(moi), auteurId: moi.id, depuisCrm: true, note });
      return vueCommande(doc.commandes.find((x) => x.id === cree.id), doc, index(doc), moi, m.maintenant);
    });
    return avecStatut(201, c);
  }
  const client = V.objet(corps, 'client', { requis: true, libelle: 'Client' });
  const liv = V.objet(corps, 'livraison', { requis: true, libelle: 'Livraison' });
  const pai = V.objet(corps, 'paiement', { requis: true, libelle: 'Paiement' });
  const donnees = {
    client: {
      prenom: V.texte(client, 'prenom', { requis: true, max: 60, libelle: 'Prénom' }),
      nom: V.texte(client, 'nom', { requis: true, max: 80, libelle: 'Nom' }),
      email: V.email(client, 'email', { requis: true }),
      telephone: V.telephone(client, 'telephone'),
    },
    livraison: { mode: V.choix(liv, 'mode', MODES_PARTICULIER, { requis: true, libelle: 'Mode de livraison' }) },
    paiement: {
      mode: V.choix(pai, 'mode', ['carte', 'virement', 'a-reception', 'comptant'], { requis: true, libelle: 'Moyen de paiement' }),
      statut: V.choix(pai, 'statut', ['paye', 'en-attente'], { libelle: 'Statut du paiement' }),
    },
    lignes,
    code: V.texte(corps, 'code', { max: 30, libelle: 'Code promo' })?.toUpperCase(),
    ageConfirme: V.booleen(corps, 'ageConfirme', { defaut: false }),
    newsletter: V.booleen(corps, 'newsletter', { defaut: false }),
  };
  if (donnees.livraison.mode === 'retrait') donnees.livraison.jourRetrait = V.jour(liv, 'jourRetrait', { requis: true, libelle: 'Jour de retrait' });
  else {
    donnees.livraison.adresse = V.adresse(liv, 'adresse', { requis: true, libelle: 'Adresse de livraison' });
    if (!V.estMetropole(donnees.livraison.adresse.cp)) throw erreur(400, 'Pas d’envoi hors de France métropolitaine dans la démonstration.', { champ: 'cp', code: 'saisie' });
  }
  const c = await ecrire(ctx, 'commandes', (doc, m, moi) => {
    const cree = creerCommandeParticulier(doc, m, donnees, { canal: 'telephone', par: auteurCourt(moi), auteurId: moi.id, note });
    return vueCommande(doc.commandes.find((x) => x.id === cree.id), doc, index(doc), moi, m.maintenant);
  });
  return avecStatut(201, c);
}

function lireSuivi(corps) {
  const s = V.objet(corps, 'suivi', { libelle: 'Suivi' });
  if (!s) return undefined;
  const out = V.sansVide({
    transporteur: V.texte(s, 'transporteur', { max: 60, libelle: 'Transporteur' }),
    numero: V.texte(s, 'numero', { max: 40, libelle: 'Numéro de suivi' }),
    url: V.texte(s, 'url', { max: 300, libelle: 'Lien de suivi' }),
  });
  if (out.url && !/^https:\/\/[^\s]+$/.test(out.url)) throw erreur(400, 'Lien de suivi : adresse https attendue.', { champ: 'url', code: 'saisie' });
  return out;
}

async function modifierCommande(ctx) {
  await droit(ctx, null);
  const id = parametreId(ctx, 'cmd');
  const corps = ctx.corps;
  const statut = V.choix(corps, 'statut', STATUTS, { libelle: 'Statut' });
  const suivi = lireSuivi(corps);
  const note = V.texte(corps, 'note', { max: 1000, multiligne: true, libelle: 'Note' });
  const paiementStatut = V.choix(corps, 'paiementStatut', ['paye'], { libelle: 'Statut du paiement' });
  const factureStatut = V.choix(corps, 'factureStatut', ['payee', 'a-regler'], { libelle: 'Statut de la facture' });
  return muter(ctx, (doc, m) => {
    const moi = moiDans(doc, ctx);
    const c = doc.commandes.find((x) => x.id === id);
    if (!c || !peutLire(moi.role, rubriqueCommande(c))) throw introuvable();
    exiger(moi, rubriqueCommande(c), 'ecriture');
    const par = auteur(moi);
    const date = m.maintenant;
    const cible = { type: 'commande', id: c.id, libelle: `Commande ${c.numero}` };
    if (suivi && !statut) {
      c.suivi = { ...(c.suivi || {}), ...suivi };
      c.updatedAt = iso(date);
      journaliser(doc, date, { par, action: 'commande.suivi', cible, details: `Suivi : ${c.suivi.transporteur || ''} ${c.suivi.numero || ''}`.trim() });
    }
    if (statut) changerStatut(doc, m, c, statut, { par, suivi, note });
    else if (note) {
      c.notes ||= [];
      c.notes.push({ date: iso(date), par: auteurCourt(moi), texte: note });
      c.updatedAt = iso(date);
      journaliser(doc, date, { par, action: 'commande.note', cible, details: 'Note interne ajoutée' });
    }
    if (paiementStatut) {
      if (c.paiement.statut !== 'en-attente') throw erreur(409, 'Le paiement n’est pas en attente.', { code: 'paiement' });
      c.paiement.statut = 'paye';
      c.paiement.date = iso(date);
      if (c.facture && c.canal !== 'pro') {
        c.facture.statut = 'payee';
        c.facture.payeeLe = jourParis(date);
      }
      c.historique.push({ date: iso(date), action: 'Paiement reçu', par: auteurCourt(moi) });
      c.updatedAt = iso(date);
      journaliser(doc, date, { par, action: 'commande.paiement', cible, details: 'Paiement reçu' });
    }
    if (factureStatut) {
      exiger(moi, 'factures', 'ecriture');
      if (!c.facture) throw erreur(409, 'Cette commande n’a pas encore de facture.', { code: 'facture' });
      if (factureStatut === 'payee') {
        c.facture.statut = 'payee';
        c.facture.payeeLe = jourParis(date);
        c.paiement.statut = 'paye';
        c.paiement.date = iso(date);
      } else {
        c.facture.statut = 'a-regler';
        delete c.facture.payeeLe;
        if (c.canal === 'pro') {
          c.paiement.statut = 'en-attente';
          delete c.paiement.date;
        }
      }
      c.updatedAt = iso(date);
      journaliser(doc, date, { par, action: 'facture.paiement', cible: { ...cible, libelle: `Facture ${c.facture.numero}` }, details: factureStatut === 'payee' ? 'Règlement reçu' : 'Remise « à régler »' });
    }
    if (!statut && !suivi && !note && !paiementStatut && !factureStatut) throw erreur(400, 'Rien à modifier.', { code: 'saisie' });
    return vueCommande(c, doc, index(doc), moi, date);
  });
}

async function commandesStatut(ctx) {
  await droit(ctx, null);
  const ids = V.liste(ctx.corps, 'ids', { requis: true, min: 1, max: 100, libelle: 'Commandes' });
  for (const id of ids) V.identifiant(id, 'cmd', { champ: 'ids' });
  const statut = V.choix(ctx.corps, 'statut', STATUTS, { requis: true, libelle: 'Statut' });
  return muter(ctx, (doc, m) => {
    const moi = moiDans(doc, ctx);
    const ok = [];
    const erreurs = [];
    for (const id of new Set(ids)) {
      const c = doc.commandes.find((x) => x.id === id);
      if (!c || !peutLire(moi.role, rubriqueCommande(c))) {
        erreurs.push({ id, erreur: 'Élément introuvable.' });
        continue;
      }
      try {
        exiger(moi, rubriqueCommande(c), 'ecriture');
        changerStatut(doc, m, c, statut, { par: auteur(moi) });
        ok.push(id);
      } catch (e) {
        if (!e.status) throw e;
        erreurs.push({ id, numero: c.numero, erreur: e.message });
      }
    }
    if (!ok.length) m.inchange();
    return { ok, erreurs };
  });
}

// ---------- Clients particuliers ----------

function statsClients(doc, idx) {
  const parClient = new Map();
  for (const c of doc.commandes) {
    if (!c.clientId || c.statut === 'annulee') continue;
    const s = parClient.get(c.clientId) || { n: 0, c: 0, derniere: null, premiere: null };
    s.n += 1;
    s.c += versCentimes(totauxCommande(c).totalTTC);
    if (!s.derniere || c.createdAt > s.derniere) s.derniere = c.createdAt;
    if (!s.premiere || c.createdAt < s.premiere) s.premiere = c.createdAt;
    parClient.set(c.clientId, s);
  }
  void idx;
  return parClient;
}

function segmentDe(k, s, abonnes, limiteInactif) {
  return {
    newsletter: !!k.newsletter || abonnes.has(k.email),
    fideles: (s?.n || 0) >= 3,
    inactifs: !s?.derniere || s.derniere < limiteInactif,
  };
}

const TRI_CLIENTS = { nom: (x) => `${x.k.nom} ${x.k.prenom}`, date: (x) => x.k.createdAt, total: (x) => x.s?.c || 0, commandes: (x) => x.s?.n || 0, derniere: (x) => x.s?.derniere || '' };

// Clients filtrés et triés comme dans la liste du CRM (et dans son export) : segment, recherche, tri.
// Rend tous les clients (compteurs) et la liste filtrée : [{ k: client, s: statistiques, seg }].
function clientsFiltres(ctx, doc, idx) {
  const segment = V.choix({ s: ctx.param('segment') || 'tous' }, 's', ['tous', 'newsletter', 'fideles', 'inactifs'], { libelle: 'Segment' });
  const q = sansAccents(ctx.param('q', 80) || '');
  const stats = statsClients(doc, idx);
  const abonnes = new Set(doc.abonnes.filter((a) => (a.statut || 'inscrit') === 'inscrit').map((a) => a.email));
  const limite = iso(ctx.maintenant.getTime() - 90 * 86400000);
  const tous = doc.clients.map((k) => ({ k: clientComplet(k), s: stats.get(k.id) })).map(({ k, s }) => ({ k, s, seg: segmentDe(k, s, abonnes, limite) }));
  let liste = segment === 'tous' ? tous : tous.filter((x) => x.seg[segment]);
  if (q) liste = liste.filter(({ k }) => contient(q, `${k.prenom} ${k.nom}`, k.email, k.telephone, k.adresse?.ville, k.tags.join(' ')));
  return { tous, liste: trier(liste, ctx.param('tri'), TRI_CLIENTS, 'nom') };
}

async function clients(ctx) {
  const { doc, idx } = await lire(ctx, 'clients');
  const { tous, liste } = clientsFiltres(ctx, doc, idx);
  const compteurs = { tous: tous.length, newsletter: 0, fideles: 0, inactifs: 0 };
  for (const x of tous) for (const seg of ['newsletter', 'fideles', 'inactifs']) if (x.seg[seg]) compteurs[seg] += 1;
  const page = paginer(liste, ctx);
  return {
    ...page,
    elements: page.elements.map(({ k, s, seg }) => ({
      id: k.id,
      prenom: k.prenom,
      nom: k.nom,
      email: k.email,
      telephone: k.telephone,
      ville: k.adresse?.ville,
      newsletter: seg.newsletter,
      tags: k.tags,
      origine: k.origine,
      commandes: s?.n || 0,
      totalTTC: versEuros(s?.c || 0),
      derniereCommande: s?.derniere || null,
      createdAt: k.createdAt,
    })),
    compteurs,
  };
}

function ficheClient(doc, idx, k, u, instant) {
  const s = statsClients(doc, idx).get(k.id);
  const cmds = doc.commandes.filter((c) => c.clientId === k.id).map((c) => commandeComplete(c, idx));
  return {
    ...clientComplet(k),
    commandes: cmds.reverse().map((c) => resumeCommande(c, idx, jourParis(instant), instant)),
    totaux: { commandes: s?.n || 0, totalTTC: versEuros(s?.c || 0), panierMoyen: s?.n ? versEuros(Math.round(s.c / s.n)) : 0, premiereCommande: s?.premiere || null, derniereCommande: s?.derniere || null },
    reservations: peutLire(u.role, 'visites') ? doc.reservations.filter((r) => r.email === k.email).map(reservationComplete) : [],
    messages: peutLire(u.role, 'messages') ? doc.messages.filter((m) => m.clientId === k.id || m.email === k.email).map((m) => ({ id: m.id, reference: m.reference, sujet: m.sujet, statut: m.statut, createdAt: m.createdAt })) : [],
    abonnement: doc.abonnes.find((a) => a.email === k.email) ? abonneComplet(doc.abonnes.find((a) => a.email === k.email)) : null,
  };
}

async function client(ctx) {
  const { u, doc, idx } = await lire(ctx, 'clients');
  const k = trouver(doc.clients, ctx.param('id', 40), 'cli');
  return ficheClient(doc, idx, k, u, ctx.maintenant);
}

const ORIGINES_CLIENT = ['boutique-en-ligne', 'boutique', 'visite', 'newsletter', 'salon'];

// Saisie d'un client ; en modification, null ou '' efface téléphone, adresse et notes.
function lireClient(corps, { creation }) {
  const opt = (k, lire, vide = null) => (creation ? lire() : V.effacable(corps, k, lire, { vide }));
  return V.sansVide({
    prenom: V.texte(corps, 'prenom', { requis: creation, max: 60, libelle: 'Prénom' }),
    nom: V.texte(corps, 'nom', { requis: creation, max: 80, libelle: 'Nom' }),
    email: V.email(corps, 'email', { requis: creation }),
    telephone: opt('telephone', () => V.telephone(corps, 'telephone')),
    adresse: opt('adresse', () => V.adresse(corps, 'adresse')),
    newsletter: V.booleen(corps, 'newsletter'),
    tags: V.etiquettes(corps),
    notes: opt('notes', () => V.texte(corps, 'notes', { max: 2000, multiligne: true, libelle: 'Notes' }), ''),
    origine: V.choix(corps, 'origine', ORIGINES_CLIENT, { libelle: 'Origine' }),
  });
}

function synchroniserAbonnement(doc, date, k, avant) {
  if (k.newsletter && !avant) inscrireAbonne(doc, date, { email: k.email, prenom: k.prenom, source: k.origine === 'visite' ? 'visite' : k.origine === 'salon' ? 'salon' : 'contact' });
  if (!k.newsletter && avant) {
    const a = doc.abonnes.find((x) => x.email === k.email);
    if (a && (a.statut || 'inscrit') === 'inscrit') {
      a.statut = 'desinscrit';
      a.desinscritLe = iso(date);
    }
  }
}

async function creerClient(ctx) {
  await droit(ctx, 'clients');
  const d = lireClient(ctx.corps, { creation: true });
  const r = await ecrire(ctx, 'clients', (doc, m, moi) => {
    if (trouverClient(doc, d.email)) throw erreur(409, 'Un client existe déjà avec cet e-mail.', { champ: 'email', code: 'conflit' });
    const k = { id: idAleatoire('cli'), newsletter: false, tags: [], notes: '', origine: 'boutique', ...d, createdAt: iso(m.maintenant) };
    doc.clients.push(k);
    synchroniserAbonnement(doc, m.maintenant, k, false);
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'client.creation', cible: { type: 'client', id: k.id, libelle: `${k.prenom} ${k.nom}` } });
    return ficheClient(doc, index(doc), k, moi, m.maintenant);
  });
  return avecStatut(201, r);
}

async function modifierClient(ctx) {
  await droit(ctx, 'clients');
  const id = parametreId(ctx, 'cli');
  const d = lireClient(ctx.corps, { creation: false });
  return ecrire(ctx, 'clients', (doc, m, moi) => {
    const k = trouver(doc.clients, id, 'cli');
    if (d.email && d.email !== k.email && trouverClient(doc, d.email)) throw erreur(409, 'Un client existe déjà avec cet e-mail.', { champ: 'email', code: 'conflit' });
    const avant = !!k.newsletter;
    V.appliquer(k, d);
    synchroniserAbonnement(doc, m.maintenant, k, avant);
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'client.modification', cible: { type: 'client', id: k.id, libelle: `${k.prenom} ${k.nom}` }, details: `Champs : ${Object.keys(d).join(', ')}` });
    return ficheClient(doc, index(doc), k, moi, m.maintenant);
  });
}

// Suppression (RGPD) : le client est effacé, ses commandes anonymisées, ses autres traces aussi.
async function supprimerClient(ctx) {
  await droit(ctx, 'clients');
  const id = parametreId(ctx, 'cli');
  return ecrire(ctx, 'clients', (doc, m, moi) => {
    const k = trouver(doc.clients, id, 'cli');
    const email = k.email;
    let n = 0;
    for (const c of doc.commandes) {
      if (c.clientId !== k.id && c.contact?.email !== email) continue;
      n += 1;
      c.contact = { nom: 'Client supprimé', email: '' };
      delete c.clientId;
      if (c.livraison) delete c.livraison.adresse;
      if (c.livraison?.relais) delete c.livraison.relais;
      c.anonymise = true;
    }
    doc.clients = doc.clients.filter((x) => x.id !== k.id);
    doc.abonnes = doc.abonnes.filter((a) => a.email !== email);
    for (const r of doc.reservations.filter((x) => x.email === email)) {
      r.nom = 'Personne supprimée';
      r.email = '';
      delete r.telephone;
      delete r.message;
    }
    for (const msg of doc.messages.filter((x) => x.email === email || x.clientId === k.id)) {
      msg.nom = 'Personne supprimée';
      msg.email = '';
      delete msg.telephone;
      delete msg.clientId;
      for (const f of msg.fil) if (f.de === 'client') f.texte = '(message effacé à la demande de la personne)';
    }
    doc.courriels = doc.courriels.filter((c) => c.a !== email);
    for (const e of doc.journal) if (e.cible?.id === k.id) e.cible.libelle = 'Client supprimé';
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'client.suppression', cible: { type: 'client', id: k.id, libelle: 'Client supprimé' }, details: `Données personnelles effacées (RGPD), ${n} commande${n > 1 ? 's' : ''} anonymisée${n > 1 ? 's' : ''}` });
    return { ok: true, commandesAnonymisees: n };
  });
}

async function clientExport(ctx) {
  const u = await exigerSession(ctx, 'crm');
  exiger(u, 'clients', 'ecriture');
  const doc = (await demoCourante(ctx)).doc;
  const idx = index(doc);
  const k = trouver(doc.clients, ctx.param('id', 40), 'cli');
  const donnees = {
    exporteLe: iso(ctx.maintenant),
    responsable: doc.parametres.entreprise.nom,
    client: clientComplet(k),
    commandes: doc.commandes.filter((c) => c.clientId === k.id).map((c) => commandeComplete(c, idx)),
    reservations: doc.reservations.filter((r) => r.email === k.email).map(reservationComplete),
    messages: doc.messages.filter((m) => m.email === k.email || m.clientId === k.id),
    abonnement: doc.abonnes.filter((a) => a.email === k.email).map(abonneComplet),
    courriels: doc.courriels.filter((c) => c.a === k.email),
  };
  return new Response(JSON.stringify(donnees, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="donnees-${k.id}.json"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

// ---------- Comptes pro et demandes ----------

const TYPES_COMPTE = ['chr', 'hotel', 'camping', 'caviste', 'epicerie', 'distributeur', 'autre'];
const LICENCES = ['licence-iv', 'licence-restaurant', 'petite-licence-restaurant', 'vente-a-emporter', 'aucune'];
const GRILLES = ['chr', 'caviste', 'distributeur'];

function ca12(doc, compteId, instant) {
  const depuis = iso(instant.getTime() - 365 * 86400000);
  return somme(doc.commandes.filter((c) => c.compteId === compteId && c.statut !== 'annulee' && c.statut !== 'remboursee' && c.createdAt >= depuis).map((c) => totauxCommande(c).totalHT));
}

const statutUtilisateur = (x) => (!x.actif ? 'desactive' : x.hash ? 'actif' : 'invitation');

const TRI_COMPTES = { nom: (x) => x.r.enseigne, ca: (x) => x.r.ca12, date: (x) => x.r.derniereCommande || '', encours: (x) => x.r.encours || 0 };

// Comptes filtrés et triés comme dans la liste du CRM (et dans son export) : type, statut,
// commercial, recherche, tri. Rend [{ k: compte, r: résumé de la liste }]. Dans l'export, `type`
// désigne l'export : le type de compte y passe en `typeCompte`.
function comptesFiltres(ctx, doc, idx, factures, { type = ctx.param('type') } = {}) {
  const q = sansAccents(ctx.param('q', 80) || '');
  const statut = ctx.param('statut');
  const commercial = ctx.param('commercial', 40);
  const liste = doc.comptes
    .filter((k) => !type || k.type === type)
    .filter((k) => !statut || k.statut === statut)
    .filter((k) => !commercial || k.commercialId === commercial)
    .filter((k) => !q || contient(q, k.enseigne, k.raisonSociale, k.adresseFacturation?.ville, k.email, (k.tags || []).join(' ')))
    .map((k) => ({ k, r: resumeCompte(doc, idx, k, ctx.maintenant, factures) }));
  return trier(liste, ctx.param('tri'), TRI_COMPTES, 'nom');
}

// Résumé d'un compte dans la liste (et clés de tri) ; encours pour qui voit les factures.
function resumeCompte(doc, idx, k, instant, factures) {
  const dernieres = doc.commandes.filter((c) => c.compteId === k.id).map((c) => c.createdAt).sort();
  const out = {
    id: k.id,
    enseigne: k.enseigne,
    raisonSociale: k.raisonSociale,
    type: k.type,
    ville: k.adresseFacturation?.ville,
    statut: k.statut,
    grille: k.grille,
    remise: k.remise,
    conditions: k.conditions,
    licence: k.licence,
    commercial: nomUtilisateur(idx, k.commercialId),
    ca12: ca12(doc, k.id, instant),
    derniereCommande: dernieres.at(-1) || null,
    utilisateurs: doc.utilisateurs.filter((x) => x.compteId === k.id).length,
    tags: k.tags || [],
    createdAt: k.createdAt,
  };
  if (factures) Object.assign(out, { encours: encoursCompte(doc, k.id), encoursMax: k.encoursMax });
  return out;
}

async function comptes(ctx) {
  const { u, doc, idx } = await lire(ctx, 'comptes');
  return paginer(comptesFiltres(ctx, doc, idx, peutLire(u.role, 'factures')).map((x) => x.r), ctx);
}

function ficheCompte(doc, idx, k, u, instant) {
  const factures = peutLire(u.role, 'factures');
  const aujourdhui = jourParis(instant);
  const cmds = doc.commandes.filter((c) => c.compteId === k.id).map((c) => commandeComplete(c, idx));
  const out = {
    ...k,
    commercial: (() => {
      const x = idx.utilisateurs.get(k.commercialId);
      return x ? { id: x.id, nom: nomComplet(x), email: x.email, telephone: x.telephone } : null;
    })(),
    utilisateurs: doc.utilisateurs
      .filter((x) => x.compteId === k.id)
      .map((x) => ({ id: x.id, prenom: x.prenom, nom: x.nom, email: x.email, telephone: x.telephone, statut: statutUtilisateur(x), derniereConnexion: x.derniereConnexion || null, invitationExpireLe: x.invitation?.exp })),
    commandes: cmds.reverse().map((c) => resumeCommande(c, idx, aujourdhui, instant)),
    ca12: ca12(doc, k.id, instant),
    messages: peutLire(u.role, 'messages') ? doc.messages.filter((m) => m.compteId === k.id).map((m) => ({ id: m.id, reference: m.reference, sujet: m.sujet, statut: m.statut, createdAt: m.createdAt })) : [],
  };
  if (factures) {
    out.encours = encoursCompte(doc, k.id);
    out.factures = cmds
      .filter((c) => c.facture)
      .map((c) => ({ numero: c.facture.numero, date: c.facture.date, echeance: c.facture.echeance, statut: c.facture.statut, payeeLe: c.facture.payeeLe, enRetard: enRetard(c.facture, aujourdhui), totalTTC: c.totaux.totalTTC, commandeId: c.id, commandeNumero: c.numero }));
  } else delete out.encoursMax;
  return out;
}

async function compte(ctx) {
  const { u, doc, idx } = await lire(ctx, 'comptes');
  const k = trouver(doc.comptes, ctx.param('id', 40), 'cpt');
  return ficheCompte(doc, idx, k, u, ctx.maintenant);
}

// Saisie d'un compte ; en modification, null ou '' efface SIRET, TVA intracommunautaire, téléphone,
// commercial et notes.
function lireCompte(corps, { creation }) {
  const opt = (k, lire, vide = null) => (creation ? lire() : V.effacable(corps, k, lire, { vide }));
  return V.sansVide({
    raisonSociale: V.texte(corps, 'raisonSociale', { requis: creation, max: 120, libelle: 'Raison sociale' }),
    enseigne: V.texte(corps, 'enseigne', { requis: creation, max: 120, libelle: 'Enseigne' }),
    type: V.choix(corps, 'type', TYPES_COMPTE, { requis: creation, libelle: 'Type' }),
    siret: opt('siret', () => V.siret(corps, 'siret')),
    tvaIntra: opt('tvaIntra', () => V.tvaIntra(corps, 'tvaIntra')),
    licence: V.choix(corps, 'licence', LICENCES, { requis: creation, libelle: 'Licence' }),
    telephone: opt('telephone', () => V.telephone(corps, 'telephone')),
    email: V.email(corps, 'email', { requis: creation, libelle: 'E-mail de facturation' }),
    adresseFacturation: V.adresse(corps, 'adresseFacturation', { requis: creation, libelle: 'Adresse de facturation' }),
    statut: V.choix(corps, 'statut', ['actif', 'suspendu'], { libelle: 'Statut' }),
    grille: V.choix(corps, 'grille', GRILLES, { requis: creation, libelle: 'Grille' }),
    remise: V.nombre(corps, 'remise', { min: 0, max: 30, libelle: 'Remise (%)' }),
    conditions: V.choix(corps, 'conditions', CONDITIONS, { requis: creation, libelle: 'Conditions de paiement' }),
    francoHT: V.nombre(corps, 'francoHT', { min: 0, max: 10000, libelle: 'Franco (€ HT)' }),
    encoursMax: V.nombre(corps, 'encoursMax', { min: 0, max: 1000000, libelle: 'Encours autorisé (€)' }),
    commercialId: opt('commercialId', () => (corps.commercialId === undefined || corps.commercialId === null || corps.commercialId === '' ? undefined : V.identifiant(corps.commercialId, 'usr', { champ: 'commercialId' }))),
    tags: V.etiquettes(corps),
    notes: opt('notes', () => V.texte(corps, 'notes', { max: 2000, multiligne: true, libelle: 'Notes' }), ''),
  });
}

// Membre actif du personnel (commercial d'un compte, guide d'une séance) ; null ou absent : rien à contrôler.
function controlerPersonnel(doc, id, { champ = 'commercialId', message = 'Commercial inconnu.' } = {}) {
  if (id === undefined || id === null) return;
  const x = doc.utilisateurs.find((y) => y.id === id && ROLES_PERSONNEL.includes(y.role) && y.actif);
  if (!x) throw erreur(400, message, { champ, code: 'saisie' });
}
const controlerCommercial = (doc, id) => controlerPersonnel(doc, id);
const controlerGuide = (doc, id) => controlerPersonnel(doc, id, { champ: 'guideId', message: 'Guide inconnu.' });

// Invitation d'un utilisateur (pro ou personnel) : jeton haché, 7 jours, courriel.
function inviter(doc, m, { prenom, nom, email, role, compte, poste, telephone }) {
  if (doc.utilisateurs.some((x) => x.email === email)) throw erreur(409, 'Un utilisateur existe déjà avec cet e-mail.', { champ: 'email', code: 'conflit' });
  const { jeton, hache } = nouveauJeton();
  const x = { id: idAleatoire('usr'), prenom, nom, email, role, actif: true, sessionVersion: 0, echecs: { n: 0 }, invitation: { hache, exp: iso(m.maintenant.getTime() + DUREE_INVITATION_MS) }, createdAt: iso(m.maintenant) };
  if (compte) x.compteId = compte.id;
  if (poste) x.poste = poste;
  if (telephone) x.telephone = telephone;
  doc.utilisateurs.push(x);
  deposerCourriel(doc, m.maintenant, compte ? C.invitationPro(x, compte, jeton) : C.invitationPersonnel(x, jeton));
  const lienDemo = compte ? `/espace-pro/activer?jeton=${jeton}` : `/crm/activer?jeton=${jeton}`;
  return { utilisateur: x, lienDemo };
}

function lireNouvelUtilisateur(corps, champ) {
  const o = champ ? V.objet(corps, champ, { libelle: 'Utilisateur' }) : corps;
  if (!o) return undefined;
  return {
    prenom: V.texte(o, 'prenom', { requis: true, max: 60, libelle: 'Prénom' }),
    nom: V.texte(o, 'nom', { requis: true, max: 80, libelle: 'Nom' }),
    email: V.email(o, 'email', { requis: true }),
  };
}

const utilisateurVue = (x) => ({ id: x.id, prenom: x.prenom, nom: x.nom, email: x.email, role: x.role, compteId: x.compteId, statut: statutUtilisateur(x) });

async function creerCompte(ctx) {
  await droit(ctx, 'comptes');
  const d = lireCompte(ctx.corps, { creation: true });
  const premier = lireNouvelUtilisateur(ctx.corps, 'utilisateur');
  const adressesLivraison = (V.liste(ctx.corps, 'adressesLivraison', { max: 10, libelle: 'Adresses de livraison' }) || []).map((a, i) => ({ id: idAleatoire('adr'), ...V.adresse({ a }, 'a', { requis: true, libelle: `Adresse de livraison ${i + 1}` }) }));
  const r = await ecrire(ctx, 'comptes', (doc, m, moi) => {
    controlerCommercial(doc, d.commercialId);
    const k = {
      id: idAleatoire('cpt'),
      ...d,
      adressesLivraison: adressesLivraison.length ? adressesLivraison : [{ id: idAleatoire('adr'), nom: d.enseigne, ...d.adresseFacturation }],
      statut: d.statut || 'actif',
      remise: d.remise ?? 0,
      francoHT: d.francoHT ?? doc.parametres.pro.francoHT,
      encoursMax: d.encoursMax ?? 1500,
      commercialId: d.commercialId || (moi.role === 'commercial' ? moi.id : undefined),
      tags: d.tags || [],
      notes: d.notes || '',
      origine: 'commercial',
      createdAt: iso(m.maintenant),
    };
    V.sansVide(k);
    doc.comptes.push(k);
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'compte.creation', cible: { type: 'compte', id: k.id, libelle: k.enseigne } });
    const out = { compte: ficheCompte(doc, index(doc), k, moi, m.maintenant) };
    if (premier) {
      const inv = inviter(doc, m, { ...premier, role: 'pro', compte: k });
      out.utilisateur = utilisateurVue(inv.utilisateur);
      out.lienDemo = inv.lienDemo;
      out.compte = ficheCompte(doc, index(doc), k, moi, m.maintenant);
    }
    return out;
  });
  return avecStatut(201, r);
}

async function modifierCompte(ctx) {
  await droit(ctx, 'comptes');
  const id = parametreId(ctx, 'cpt');
  const d = lireCompte(ctx.corps, { creation: false });
  return ecrire(ctx, 'comptes', (doc, m, moi) => {
    const k = trouver(doc.comptes, id, 'cpt');
    controlerCommercial(doc, d.commercialId);
    const avant = k.statut;
    V.appliquer(k, d);
    const details = d.statut && d.statut !== avant ? (d.statut === 'suspendu' ? 'Compte suspendu' : 'Compte réactivé') : `Champs : ${Object.keys(d).join(', ')}`;
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'compte.modification', cible: { type: 'compte', id: k.id, libelle: k.enseigne }, details });
    return ficheCompte(doc, index(doc), k, moi, m.maintenant);
  });
}

async function compteUtilisateur(ctx) {
  await droit(ctx, 'comptes');
  const compteId = V.identifiant(ctx.corps.compteId, 'cpt', { champ: 'compteId' });
  const nouveau = lireNouvelUtilisateur(ctx.corps);
  const r = await ecrire(ctx, 'comptes', (doc, m, moi) => {
    const k = trouver(doc.comptes, compteId, 'cpt');
    const inv = inviter(doc, m, { ...nouveau, role: 'pro', compte: k });
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'compte.invitation', cible: { type: 'compte', id: k.id, libelle: k.enseigne }, details: `Invitation de ${nouveau.prenom} ${nouveau.nom}` });
    return { utilisateur: utilisateurVue(inv.utilisateur), lienDemo: inv.lienDemo };
  });
  return avecStatut(201, r);
}

const STATUTS_DEMANDE = ['nouvelle', 'en-cours', 'acceptee', 'refusee'];

function vueDemande(d, idx) {
  const out = { ...d };
  if (d.traiteePar) out.traiteePar = nomUtilisateur(idx, d.traiteePar);
  if (d.compteId) {
    const k = idx.comptes.get(d.compteId);
    if (k) out.compte = compteResume(k);
  }
  return out;
}

async function demandes(ctx) {
  const { doc, idx } = await lire(ctx, 'comptes');
  const statut = ctx.param('statut');
  if (statut && !STATUTS_DEMANDE.includes(statut)) throw erreur(400, 'Statut inconnu.', { champ: 'statut', code: 'saisie' });
  const compteurs = Object.fromEntries(STATUTS_DEMANDE.map((s) => [s, doc.demandes.filter((d) => d.statut === s).length]));
  const liste = [...doc.demandes].filter((d) => !statut || d.statut === statut).reverse().map((d) => vueDemande(d, idx));
  return { ...paginer(liste, ctx), compteurs };
}

async function demande(ctx) {
  const { doc, idx } = await lire(ctx, 'comptes');
  return vueDemande(trouver(doc.demandes, ctx.param('id', 40), 'dem'), idx);
}

async function modifierDemande(ctx) {
  await droit(ctx, 'comptes');
  const id = parametreId(ctx, 'dem');
  const statut = V.choix(ctx.corps, 'statut', ['nouvelle', 'en-cours'], { libelle: 'Statut' });
  // null ou '' efface la note
  const note = V.effacable(ctx.corps, 'note', () => V.texte(ctx.corps, 'note', { max: 2000, multiligne: true, libelle: 'Note' }));
  return ecrire(ctx, 'comptes', (doc, m, moi) => {
    const d = trouver(doc.demandes, id, 'dem');
    if (['acceptee', 'refusee'].includes(d.statut) && statut) throw erreur(409, 'Cette demande est déjà traitée.', { code: 'statut' });
    if (statut) d.statut = statut;
    V.appliquer(d, { note });
    if (statut === 'en-cours' && !d.traiteePar) {
      d.traiteePar = moi.id;
      d.traiteeLe = iso(m.maintenant);
    }
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'demande.modification', cible: { type: 'demande', id: d.id, libelle: `Demande ${d.reference}` }, details: statut ? `Statut : ${statut}` : 'Note' });
    return vueDemande(d, index(doc));
  });
}

async function accepterDemande(ctx) {
  await droit(ctx, 'comptes');
  const id = parametreId(ctx, 'dem');
  const c = ctx.corps;
  const reglages = {
    grille: V.choix(c, 'grille', GRILLES, { requis: true, libelle: 'Grille' }),
    remise: V.nombre(c, 'remise', { min: 0, max: 30, defaut: 0, libelle: 'Remise (%)' }),
    conditions: V.choix(c, 'conditions', CONDITIONS, { requis: true, libelle: 'Conditions de paiement' }),
    commercialId: c.commercialId === undefined || c.commercialId === null ? undefined : V.identifiant(c.commercialId, 'usr', { champ: 'commercialId' }),
    encoursMax: V.nombre(c, 'encoursMax', { min: 0, max: 1000000, requis: true, libelle: 'Encours autorisé (€)' }),
    licence: V.choix(c, 'licence', LICENCES, { defaut: 'aucune', libelle: 'Licence' }),
    type: V.choix(c, 'type', TYPES_COMPTE, { libelle: 'Type' }),
    francoHT: V.nombre(c, 'francoHT', { min: 0, max: 10000, libelle: 'Franco (€ HT)' }),
    adresse: V.adresse(c, 'adresse', { libelle: 'Adresse' }),
  };
  const r = await ecrire(ctx, 'comptes', (doc, m, moi) => {
    const d = trouver(doc.demandes, id, 'dem');
    if (!['nouvelle', 'en-cours'].includes(d.statut)) throw erreur(409, 'Cette demande est déjà traitée.', { code: 'statut' });
    controlerCommercial(doc, reglages.commercialId);
    const adresse = reglages.adresse || { ligne1: 'Adresse à compléter', cp: '', ville: d.ville, pays: 'France' };
    const k = V.sansVide({
      id: idAleatoire('cpt'),
      raisonSociale: d.societe,
      enseigne: d.societe,
      type: reglages.type || d.activite || 'autre',
      siret: d.siret,
      licence: reglages.licence,
      telephone: d.telephone,
      email: d.email,
      adresseFacturation: adresse,
      adressesLivraison: reglages.adresse ? [{ id: idAleatoire('adr'), nom: d.societe, ...reglages.adresse }] : [],
      statut: 'actif',
      grille: reglages.grille,
      remise: reglages.remise,
      conditions: reglages.conditions,
      francoHT: reglages.francoHT ?? doc.parametres.pro.francoHT,
      encoursMax: reglages.encoursMax,
      commercialId: reglages.commercialId || (moi.role === 'commercial' ? moi.id : undefined),
      tags: ['nouveau'],
      notes: d.message ? `Demande ${d.reference} : ${d.message}` : `Demande ${d.reference}`,
      origine: 'site',
      createdAt: iso(m.maintenant),
    });
    doc.comptes.push(k);
    const [prenom, ...reste] = d.nom.split(' ');
    const inv = inviter(doc, m, { prenom, nom: reste.join(' ') || prenom, email: d.email, role: 'pro', compte: k, telephone: d.telephone });
    Object.assign(d, { statut: 'acceptee', traiteePar: moi.id, traiteeLe: iso(m.maintenant), compteId: k.id });
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'demande.acceptation', cible: { type: 'demande', id: d.id, libelle: `Demande ${d.reference}` }, details: `Compte ouvert pour ${k.enseigne}` });
    return { compte: ficheCompte(doc, index(doc), k, moi, m.maintenant), utilisateur: utilisateurVue(inv.utilisateur), lienDemo: inv.lienDemo, demande: vueDemande(d, index(doc)) };
  });
  return avecStatut(201, r);
}

async function refuserDemande(ctx) {
  await droit(ctx, 'comptes');
  const id = parametreId(ctx, 'dem');
  const motif = V.texte(ctx.corps, 'motif', { requis: true, max: 1000, multiligne: true, libelle: 'Motif' });
  return ecrire(ctx, 'comptes', (doc, m, moi) => {
    const d = trouver(doc.demandes, id, 'dem');
    if (!['nouvelle', 'en-cours'].includes(d.statut)) throw erreur(409, 'Cette demande est déjà traitée.', { code: 'statut' });
    Object.assign(d, { statut: 'refusee', note: motif, traiteePar: moi.id, traiteeLe: iso(m.maintenant) });
    deposerCourriel(doc, m.maintenant, C.demandeProRefusee(d, motif));
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'demande.refus', cible: { type: 'demande', id: d.id, libelle: `Demande ${d.reference}` }, details: motif });
    return vueDemande(d, index(doc));
  });
}

// ---------- Produits et stocks ----------

function vendus30(doc, instant) {
  const depuis = iso(instant.getTime() - 30 * 86400000);
  const n = new Map();
  for (const c of doc.commandes) {
    if (c.createdAt < depuis || c.statut === 'annulee') continue;
    for (const l of c.lignes) n.set(`${l.slug}|${l.varianteId}`, (n.get(`${l.slug}|${l.varianteId}`) || 0) + l.qte);
  }
  return n;
}

function vueProduit(p, pd, ventes) {
  return {
    slug: p.slug,
    nom: p.nom,
    type: p.type,
    gamme: p.gamme,
    gammeNom: p.gammeNom,
    univers: p.univers,
    alcool: p.alcool,
    degre: p.degre,
    photo: p.photo,
    reference: p.reference,
    actif: pd.actif,
    enLigne: p.enLigne,
    variantes: p.variantes.map((v) => {
      const d = pd.variantes[v.id];
      return {
        id: v.id,
        volume: v.volume,
        coffret: v.coffret,
        prixTTC: d.prixTTC,
        prixOfficielTTC: v.prixTTC,
        prixProHT: d.prixProHT,
        proManuel: !!d.proManuel,
        tva: p.tva,
        stock: d.stock,
        seuil: d.seuil,
        colisage: d.colisage,
        etat: etatStock(d),
        vendus30: ventes.get(`${p.slug}|${v.id}`) || 0,
      };
    }),
  };
}

// Produits filtrés comme dans la liste du CRM (et dans son export) : gamme, recherche, état du stock
// (un produit dont une contenance est en stock bas ou en rupture). Rend tous les produits et la liste.
function produitsFiltres(ctx, doc) {
  const q = sansAccents(ctx.param('q', 80) || '');
  const gamme = ctx.param('gamme');
  const stock = ctx.param('stock') || 'tous';
  if (!['tous', 'bas', 'rupture'].includes(stock)) throw erreur(400, 'Filtre de stock inconnu.', { champ: 'stock', code: 'saisie' });
  const ventes = vendus30(doc, ctx.maintenant);
  const tous = PRODUITS.map((p) => vueProduit(p, doc.produits[p.slug], ventes));
  const liste = tous
    .filter((p) => !gamme || p.gamme === gamme)
    .filter((p) => !q || contient(q, p.nom, p.slug, p.gammeNom))
    .filter((p) => stock === 'tous' || p.variantes.some((v) => v.etat === (stock === 'bas' ? 'stock-bas' : 'rupture')));
  return { tous, liste };
}

async function produits(ctx) {
  const { doc } = await lire(ctx, 'produits');
  const { tous, liste } = produitsFiltres(ctx, doc);
  const compteurs = {
    tous: tous.length,
    bas: tous.filter((p) => p.variantes.some((v) => v.etat === 'stock-bas')).length,
    rupture: tous.filter((p) => p.variantes.some((v) => v.etat === 'rupture')).length,
  };
  return { ...paginer(liste, ctx, { parDefaut: 100, max: 100 }), compteurs, gammes: Object.entries(NOMS_GAMMES).map(([id, nom]) => ({ id, nom })) };
}

async function modifierProduit(ctx) {
  await droit(ctx, 'produits');
  const slug = ctx.param('slug', 80);
  const p = produitDe(slug);
  if (!p) throw introuvable('Produit introuvable.');
  const actif = V.booleen(ctx.corps, 'actif', { libelle: 'En vente' });
  const brut = V.objet(ctx.corps, 'variantes', { libelle: 'Variantes' }) || {};
  const changements = {};
  for (const [id, x] of Object.entries(brut)) {
    if (!p.variantes.some((v) => v.id === id)) throw erreur(400, `Contenance inconnue : ${id}.`, { champ: 'variantes', code: 'saisie' });
    if (!x || typeof x !== 'object') throw erreur(400, 'Variante : objet attendu.', { champ: 'variantes', code: 'saisie' });
    changements[id] = V.sansVide({
      prixTTC: V.nombre(x, 'prixTTC', { min: 0.5, max: 5000, libelle: 'Prix TTC' }),
      prixProHT: V.nombre(x, 'prixProHT', { min: 0.1, max: 5000, libelle: 'Tarif pro HT' }),
      seuil: V.entier(x, 'seuil', { min: 0, max: 9999, libelle: 'Seuil' }),
      colisage: V.entier(x, 'colisage', { min: 1, max: 48, libelle: 'Colisage' }),
    });
  }
  if (actif === undefined && !Object.keys(changements).length) throw erreur(400, 'Rien à modifier.', { code: 'saisie' });
  return ecrire(ctx, 'produits', (doc, m, moi) => {
    const pd = doc.produits[slug];
    if (actif !== undefined) pd.actif = actif;
    for (const [id, ch] of Object.entries(changements)) {
      const v = pd.variantes[id];
      if (ch.prixTTC !== undefined) {
        v.prixTTC = ch.prixTTC;
        if (!v.proManuel) v.prixProHT = prixProReference(ch.prixTTC, p.tva);
      }
      if (ch.prixProHT !== undefined) {
        v.prixProHT = ch.prixProHT;
        v.proManuel = true;
      }
      if (ch.seuil !== undefined) v.seuil = ch.seuil;
      if (ch.colisage !== undefined) v.colisage = ch.colisage;
    }
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'produit.modification', cible: { type: 'produit', id: slug, libelle: p.nom }, details: actif === false ? 'Retiré de la vente' : actif ? 'Remis en vente' : 'Prix, seuils ou colisages modifiés' });
    return vueProduit(p, pd, vendus30(doc, m.maintenant));
  });
}

const MOTIFS_STOCK = ['production', 'inventaire', 'casse', 'ajustement'];

function vueMouvement(mv, idx) {
  const p = produitDe(mv.slug);
  return { ...mv, nom: p?.nom || mv.slug, volume: p?.variantes.find((v) => v.id === mv.varianteId)?.volume || mv.varianteId, par: mv.par?.id && !mv.par.nom ? nomUtilisateur(idx, mv.par.id) : mv.par };
}

async function stock(ctx) {
  await droit(ctx, 'stocks');
  const c = ctx.corps;
  const slug = V.texte(c, 'slug', { requis: true, max: 80, libelle: 'Produit' });
  const p = produitDe(slug);
  if (!p) throw introuvable('Produit introuvable.');
  const varianteId = V.texte(c, 'varianteId', { requis: true, max: 20, libelle: 'Contenance' });
  if (!p.variantes.some((v) => v.id === varianteId)) throw introuvable('Contenance introuvable.');
  const delta = V.entier(c, 'delta', { requis: true, min: -9999, max: 9999, libelle: 'Quantité' });
  if (delta === 0) throw erreur(400, 'Quantité : différente de zéro.', { champ: 'delta', code: 'saisie' });
  const motif = V.choix(c, 'motif', MOTIFS_STOCK, { requis: true, libelle: 'Motif' });
  if (motif === 'production' && delta < 0) throw erreur(400, 'Une production ajoute du stock.', { champ: 'delta', code: 'saisie' });
  if (motif === 'casse' && delta > 0) throw erreur(400, 'Une casse retire du stock.', { champ: 'delta', code: 'saisie' });
  const note = V.texte(c, 'note', { max: 500, libelle: 'Note' });
  const r = await ecrire(ctx, 'stocks', (doc, m, moi) => {
    const mv = ajusterStock(doc, m.maintenant, { slug, varianteId, delta, motif, par: auteurCourt(moi), note });
    const v = doc.produits[slug].variantes[varianteId];
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'stock.mouvement', cible: { type: 'produit', id: slug, libelle: `${p.nom} ${p.variantes.find((x) => x.id === varianteId).volume}` }, details: `${delta > 0 ? '+' : ''}${delta} (${motif})` });
    return { mouvement: vueMouvement(mv, index(doc)), stock: v.stock, etat: etatStock(v) };
  });
  return avecStatut(201, r);
}

async function mouvements(ctx) {
  const { doc, idx } = await lire(ctx, 'stocks');
  const slug = ctx.param('slug', 80);
  const liste = doc.mouvements.filter((mv) => !slug || mv.slug === slug).slice(-200).reverse().map((mv) => vueMouvement(mv, idx));
  return paginer(liste, ctx, { parDefaut: 50, max: 200 });
}

// ---------- Visites ----------

function vueSeance(s, doc, idx) {
  const sc = seanceComplete(s, doc.parametres);
  const resas = doc.reservations.filter((r) => r.seanceId === s.id && r.statut !== 'annulee');
  const out = { ...sc, inscrits: resas.reduce((t, r) => t + r.personnes, 0), restantes: placesRestantes(sc, doc.reservations), reservations: resas.length };
  if (s.guideId) out.guide = nomUtilisateur(idx, s.guideId);
  return out;
}

// Réservations d'une période (jours compris ; bornes facultatives), avec l'heure de leur séance,
// dans l'ordre des séances : planning des visites et export.
function reservationsDe(doc, du, au) {
  const heures = new Map(doc.seances.map((s) => [s.id, s.heure]));
  return doc.reservations
    .filter((r) => (!du || r.date >= du) && (!au || r.date <= au))
    .map((r) => ({ ...reservationComplete(r), heure: heures.get(r.seanceId) }))
    .sort((a, b) => `${a.date}${a.heure}`.localeCompare(`${b.date}${b.heure}`));
}

async function visites(ctx) {
  const { doc, idx } = await lire(ctx, 'visites');
  const aujourdhui = aujourdhuiDe(ctx);
  const du = ctx.param('du') || aujourdhui;
  const au = ctx.param('au') || ajouterJours(du, 13);
  if (!estJour(du) || !estJour(au) || au < du || ecartJours(du, au) > 120) throw erreur(400, 'Période invalide (AAAA-MM-JJ, 120 jours au plus).', { champ: 'du', code: 'saisie' });
  const seances = doc.seances.filter((s) => s.date >= du && s.date <= au).map((s) => vueSeance(s, doc, idx));
  return { du, au, seances, reservations: reservationsDe(doc, du, au) };
}

async function creerSeance(ctx) {
  await droit(ctx, 'visites');
  const c = ctx.corps;
  const date = V.jour(c, 'date', { requis: true });
  const moment = V.choix(c, 'moment', MOMENTS, { requis: true, libelle: 'Moment' });
  const heure = V.texte(c, 'heure', { max: 5, libelle: 'Heure' });
  if (heure && !/^([01]\d|2[0-3]):[0-5]\d$/.test(heure)) throw erreur(400, 'Heure : HH:MM.', { champ: 'heure', code: 'saisie' });
  const d = V.sansVide({
    capacite: V.entier(c, 'capacite', { min: 1, max: 60, libelle: 'Capacité' }),
    langue: V.choix(c, 'langue', ['fr', 'en', 'de'], { libelle: 'Langue' }),
    guideId: c.guideId === undefined || c.guideId === null ? undefined : V.identifiant(c.guideId, 'usr', { champ: 'guideId' }),
    notes: V.texte(c, 'notes', { max: 500, multiligne: true, libelle: 'Notes' }),
  });
  if (date < aujourdhuiDe(ctx)) throw erreur(400, 'Date passée.', { champ: 'date', code: 'saisie' });
  const r = await ecrire(ctx, 'visites', (doc, m, moi) => {
    if (doc.seances.some((s) => s.date === date && s.moment === moment)) throw erreur(409, 'Une séance existe déjà ce jour-là à ce moment.', { code: 'conflit' });
    controlerGuide(doc, d.guideId);
    const s = { id: idAleatoire('sea'), date, heure: heure || doc.parametres.visites.horaires[moment], moment, capacite: d.capacite ?? doc.parametres.visites.capacite, langue: d.langue || 'fr', statut: 'ouverte', ...d };
    doc.seances.push(s);
    doc.seances.sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure));
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'seance.creation', cible: { type: 'seance', id: s.id, libelle: `Séance du ${libelleSeance(date, moment, jourParis(m.maintenant))}` } });
    return vueSeance(s, doc, index(doc));
  });
  return avecStatut(201, r);
}

async function modifierSeance(ctx) {
  await droit(ctx, 'visites');
  const id = parametreId(ctx, 'sea');
  const c = ctx.corps;
  const d = V.sansVide({
    capacite: V.entier(c, 'capacite', { min: 1, max: 60, libelle: 'Capacité' }),
    statut: V.choix(c, 'statut', ['ouverte', 'fermee'], { libelle: 'Statut' }),
    langue: V.choix(c, 'langue', ['fr', 'en', 'de'], { libelle: 'Langue' }),
    // null ou '' : guide retiré, notes effacées
    guideId: V.effacable(c, 'guideId', () => V.identifiant(c.guideId, 'usr', { champ: 'guideId' })),
    notes: V.effacable(c, 'notes', () => V.texte(c, 'notes', { max: 500, multiligne: true, libelle: 'Notes' })),
  });
  return ecrire(ctx, 'visites', (doc, m, moi) => {
    const s = trouver(doc.seances, id, 'sea');
    controlerGuide(doc, d.guideId);
    const inscrits = doc.reservations.filter((r) => r.seanceId === s.id && r.statut !== 'annulee').reduce((t, r) => t + r.personnes, 0);
    if (d.capacite !== undefined && d.capacite < inscrits) throw erreur(409, `Capacité inférieure aux ${inscrits} personnes déjà inscrites.`, { champ: 'capacite', code: 'capacite' });
    V.appliquer(s, d);
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'seance.modification', cible: { type: 'seance', id: s.id, libelle: `Séance du ${libelleSeance(s.date, s.moment, jourParis(m.maintenant))}` }, details: d.statut === 'fermee' ? 'Séance fermée' : `Champs : ${Object.keys(d).join(', ')}` });
    return vueSeance(s, doc, index(doc));
  });
}

async function creerReservation(ctx) {
  await droit(ctx, 'visites');
  const c = ctx.corps;
  const seanceId = c.seanceId === undefined ? undefined : V.identifiant(c.seanceId, 'sea', { champ: 'seanceId' });
  const personnes = V.entier(c, 'personnes', { requis: true, min: 1, max: 60, libelle: 'Nombre de personnes' });
  const mineurs = V.entier(c, 'mineurs', { min: 0, max: 59, defaut: 0, libelle: 'Mineurs' });
  if (mineurs >= personnes) throw erreur(400, 'Au moins un adulte accompagne le groupe.', { champ: 'mineurs', code: 'saisie' });
  const donnees = {
    date: seanceId ? undefined : V.jour(c, 'date', { requis: true }),
    moment: seanceId ? undefined : V.choix(c, 'moment', MOMENTS, { requis: true, libelle: 'Moment' }),
    personnes,
    mineurs,
    langue: V.choix(c, 'langue', ['fr', 'en', 'de'], { defaut: 'fr', libelle: 'Langue' }),
    nom: V.texte(c, 'nom', { requis: true, min: 2, max: 80, libelle: 'Nom' }),
    email: V.email(c, 'email', { requis: true }),
    telephone: V.telephone(c, 'telephone'),
    message: V.texte(c, 'message', { max: 1000, multiligne: true, libelle: 'Message' }),
    notes: V.texte(c, 'notes', { max: 1000, multiligne: true, libelle: 'Notes' }),
    newsletter: V.booleen(c, 'newsletter', { defaut: false }),
  };
  const source = V.choix(c, 'source', ['telephone', 'crm'], { defaut: 'crm', libelle: 'Source' });
  const r = await ecrire(ctx, 'visites', (doc, m, moi) => {
    if (seanceId) {
      const s = trouver(doc.seances, seanceId, 'sea');
      donnees.date = s.date;
      donnees.moment = s.moment;
    }
    const { reservation } = reserver(doc, m, donnees, { source, par: auteur(moi) });
    return reservationComplete(reservation);
  });
  return avecStatut(201, r);
}

async function modifierReservation(ctx) {
  await droit(ctx, 'visites');
  const id = parametreId(ctx, 'res');
  const c = ctx.corps;
  const d = V.sansVide({
    statut: V.choix(c, 'statut', ['confirmee', 'annulee', 'venue', 'absente'], { libelle: 'Statut' }),
    personnes: V.entier(c, 'personnes', { min: 1, max: 60, libelle: 'Nombre de personnes' }),
    mineurs: V.entier(c, 'mineurs', { min: 0, max: 59, libelle: 'Mineurs' }),
    seanceId: c.seanceId === undefined ? undefined : V.identifiant(c.seanceId, 'sea', { champ: 'seanceId' }),
    // null ou '' efface les notes
    notes: V.effacable(c, 'notes', () => V.texte(c, 'notes', { max: 1000, multiligne: true, libelle: 'Notes' })),
  });
  return ecrire(ctx, 'visites', (doc, m, moi) => {
    const r = trouver(doc.reservations, id, 'res');
    const cible = d.seanceId ? trouver(doc.seances, d.seanceId, 'sea') : doc.seances.find((s) => s.id === r.seanceId);
    const personnes = d.personnes ?? r.personnes;
    if ((d.mineurs ?? r.mineurs ?? 0) >= personnes) throw erreur(400, 'Au moins un adulte accompagne le groupe.', { champ: 'mineurs', code: 'saisie' });
    const statut = d.statut ?? r.statut;
    if (cible && statut !== 'annulee') {
      const autres = doc.reservations.filter((x) => x.id !== r.id && x.seanceId === cible.id && x.statut !== 'annulee').reduce((t, x) => t + x.personnes, 0);
      const cap = seanceComplete(cible, doc.parametres).capacite;
      if (autres + personnes > cap) throw erreur(409, `Plus que ${Math.max(0, cap - autres)} place(s) pour cette séance.`, { code: 'complet' });
    }
    V.appliquer(r, d);
    if (cible) {
      r.seanceId = cible.id;
      r.date = cible.date;
      r.moment = cible.moment;
    }
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'reservation.modification', cible: { type: 'reservation', id: r.id, libelle: `Visite ${r.reference}` }, details: d.statut ? `Statut : ${d.statut}` : `Champs : ${Object.keys(d).join(', ')}` });
    return reservationComplete(r);
  });
}

// ---------- Messages ----------

const STATUTS_MESSAGE = ['nouveau', 'en-cours', 'traite', 'archive'];

function vueMessage(msg, idx, { complet = false } = {}) {
  const dernier = msg.fil[msg.fil.length - 1];
  const out = {
    id: msg.id,
    reference: msg.reference,
    nom: msg.nom,
    email: msg.email,
    telephone: msg.telephone,
    sujet: msg.sujet,
    statut: msg.statut,
    lu: msg.lu,
    assigneA: nomUtilisateur(idx, msg.assigneA),
    extrait: msg.fil[0]?.texte.slice(0, 140),
    dernierMessage: dernier?.date,
    nbMessages: msg.fil.length,
    createdAt: msg.createdAt,
  };
  if (msg.compteId) {
    const k = idx.comptes.get(msg.compteId);
    if (k) out.compte = compteResume(k);
  }
  if (msg.clientId) {
    const k = idx.clients.get(msg.clientId);
    if (k) out.client = { id: k.id, nom: `${k.prenom} ${k.nom}` };
  }
  if (complet) out.fil = msg.fil.map((f) => (f.par?.id && !f.par.nom ? { ...f, par: nomUtilisateur(idx, f.par.id) } : f));
  return out;
}

async function messages(ctx) {
  const { doc, idx } = await lire(ctx, 'messages');
  const statut = ctx.param('statut');
  if (statut && !STATUTS_MESSAGE.includes(statut)) throw erreur(400, 'Statut inconnu.', { champ: 'statut', code: 'saisie' });
  const q = sansAccents(ctx.param('q', 80) || '');
  const compteurs = Object.fromEntries(STATUTS_MESSAGE.map((s) => [s, doc.messages.filter((m) => m.statut === s).length]));
  compteurs.nonLus = doc.messages.filter((m) => !m.lu).length;
  const liste = [...doc.messages]
    .filter((m) => !statut || m.statut === statut)
    .filter((m) => !q || contient(q, m.reference, m.nom, m.email, m.fil.map((f) => f.texte).join(' ')))
    .sort((a, b) => (b.fil.at(-1)?.date || b.createdAt).localeCompare(a.fil.at(-1)?.date || a.createdAt))
    .map((m) => vueMessage(m, idx));
  return { ...paginer(liste, ctx), compteurs };
}

async function message(ctx) {
  const id = parametreId(ctx, 'msg');
  const { u, doc, idx } = await lire(ctx, 'messages');
  const msg = trouver(doc.messages, id, 'msg');
  if (msg.lu || !peutEcrire(u.role, 'messages')) return vueMessage(msg, idx, { complet: true });
  // la lecture marque le message lu
  return ecrire(ctx, 'messages', (d) => {
    const x = trouver(d.messages, id, 'msg');
    x.lu = true;
    return vueMessage(x, index(d), { complet: true });
  });
}

async function modifierMessage(ctx) {
  await droit(ctx, 'messages');
  const id = parametreId(ctx, 'msg');
  const statut = V.choix(ctx.corps, 'statut', STATUTS_MESSAGE, { libelle: 'Statut' });
  // null ou '' : attribution retirée
  const assigne = V.effacable(ctx.corps, 'assigneA', () => V.identifiant(ctx.corps.assigneA, 'usr', { champ: 'assigneA' }));
  const lu = V.booleen(ctx.corps, 'lu', { libelle: 'Lu' });
  return ecrire(ctx, 'messages', (doc, m, moi) => {
    const msg = trouver(doc.messages, id, 'msg');
    if (assigne) {
      const x = doc.utilisateurs.find((y) => y.id === assigne && ROLES_PERSONNEL.includes(y.role) && y.actif);
      if (!x) throw erreur(400, 'Personne inconnue.', { champ: 'assigneA', code: 'saisie' });
      msg.assigneA = assigne;
    }
    if (assigne === null) delete msg.assigneA;
    if (statut) msg.statut = statut;
    if (lu !== undefined) msg.lu = lu;
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'message.modification', cible: { type: 'message', id: msg.id, libelle: `Message ${msg.reference}` }, details: statut ? `Statut : ${statut}` : assigne ? 'Attribué' : 'Modifié' });
    return vueMessage(msg, index(doc), { complet: true });
  });
}

async function messageReponse(ctx) {
  await droit(ctx, 'messages');
  const id = parametreId(ctx, 'msg');
  const texte = V.texte(ctx.corps, 'texte', { requis: true, min: 2, max: 4000, multiligne: true, libelle: 'Réponse' });
  const r = await ecrire(ctx, 'messages', (doc, m, moi) => {
    const msg = trouver(doc.messages, id, 'msg');
    if (!msg.email) throw erreur(409, 'Cette personne a demandé l’effacement de ses données : impossible de répondre.', { code: 'anonymise' });
    msg.fil.push({ date: iso(m.maintenant), de: 'equipe', par: auteurCourt(moi), texte });
    msg.lu = true;
    if (msg.statut === 'nouveau') msg.statut = 'en-cours';
    if (!msg.assigneA) msg.assigneA = moi.id;
    deposerCourriel(doc, m.maintenant, C.reponseMessage(msg, texte, auteurCourt(moi)));
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'message.reponse', cible: { type: 'message', id: msg.id, libelle: `Message ${msg.reference}` }, details: `Réponse à ${msg.nom}` });
    return vueMessage(msg, index(doc), { complet: true });
  });
  return avecStatut(201, r);
}

// ---------- Newsletter, campagnes, codes promo ----------

const SOURCES_ABONNE = ['pied-de-page', 'commande', 'visite', 'contact', 'salon'];
const SEGMENTS = ['tous', 'clients', 'pros', 'visiteurs'];

function destinataires(doc, segment) {
  const inscrits = doc.abonnes.filter((a) => (a.statut || 'inscrit') === 'inscrit');
  if (segment === 'clients') {
    const emails = new Set(doc.clients.map((k) => k.email));
    return inscrits.filter((a) => emails.has(a.email)).map((a) => a.email);
  }
  if (segment === 'visiteurs') return inscrits.filter((a) => a.source === 'visite').map((a) => a.email);
  if (segment === 'pros') return [...new Set(doc.comptes.filter((k) => k.statut === 'actif').map((k) => k.email))];
  return inscrits.map((a) => a.email);
}

function vueCampagne(cam, doc, idx) {
  const out = { ...cam, creePar: nomUtilisateur(idx, cam.creePar) };
  if (cam.statut === 'brouillon') out.destinatairesPrevus = destinataires(doc, cam.segment).length;
  return out;
}

// Abonnés filtrés comme dans la liste de la newsletter (et dans son export) : statut, source,
// recherche ; du plus récent au plus ancien.
function abonnesFiltres(ctx, tous) {
  const statut = ctx.param('statut');
  const source = ctx.param('source');
  const q = sansAccents(ctx.param('q', 80) || '');
  return tous
    .filter((a) => !statut || a.statut === statut)
    .filter((a) => !source || a.source === source)
    .filter((a) => !q || contient(q, a.email, a.prenom))
    .sort((a, b) => b.inscritLe.localeCompare(a.inscritLe));
}

async function newsletter(ctx) {
  const { doc, idx } = await lire(ctx, 'newsletter');
  const tous = doc.abonnes.map(abonneComplet);
  const parSource = Object.fromEntries(SOURCES_ABONNE.map((s) => [s, tous.filter((a) => a.source === s && a.statut === 'inscrit').length]));
  const aujourdhui = aujourdhuiDe(ctx);
  const evolution = [];
  let m = moisDe(aujourdhui);
  for (let i = 0; i < 12; i++) {
    const fin = `${m}-31`;
    evolution.unshift({
      mois: m,
      inscrits: tous.filter((a) => jourParis(a.inscritLe) <= fin && (!a.desinscritLe || jourParis(a.desinscritLe) > fin)).length,
      nouveaux: tous.filter((a) => moisDe(jourParis(a.inscritLe)) === m).length,
    });
    m = moisPrecedent(`${m}-01`);
  }
  return {
    abonnes: { total: tous.length, inscrits: tous.filter((a) => a.statut === 'inscrit').length, desinscrits: tous.filter((a) => a.statut === 'desinscrit').length, parSource, evolution },
    liste: paginer(abonnesFiltres(ctx, tous), ctx),
    campagnes: [...doc.campagnes].reverse().map((c) => vueCampagne(c, doc, idx)),
  };
}

function lireCampagne(corps, { creation }) {
  const bouton = V.objet(corps, 'bouton', { libelle: 'Bouton' });
  const out = V.sansVide({
    objet: V.texte(corps, 'objet', { requis: creation, max: 120, libelle: 'Objet' }),
    introduction: V.texte(corps, 'introduction', { requis: creation, max: 500, multiligne: true, libelle: 'Introduction' }),
    corps: V.texte(corps, 'corps', { requis: creation, max: 8000, multiligne: true, libelle: 'Texte' }),
    segment: V.choix(corps, 'segment', SEGMENTS, { requis: creation, libelle: 'Destinataires' }),
  });
  if (bouton) {
    const url = V.texte(bouton, 'url', { requis: true, max: 300, libelle: 'Lien du bouton' });
    if (!/^(\/(?!\/)[^\s]*|https:\/\/[^\s]+)$/.test(url)) throw erreur(400, 'Lien du bouton : adresse du site (/…) ou https.', { champ: 'url', code: 'saisie' });
    out.bouton = { libelle: V.texte(bouton, 'libelle', { requis: true, max: 60, libelle: 'Texte du bouton' }), url };
  }
  if (corps.bouton === null) out.bouton = null;
  return out;
}

async function creerCampagne(ctx) {
  await droit(ctx, 'newsletter');
  const d = lireCampagne(ctx.corps, { creation: true });
  const r = await ecrire(ctx, 'newsletter', (doc, m, moi) => {
    const cam = { id: idAleatoire('cam'), ...d, statut: 'brouillon', creePar: moi.id, createdAt: iso(m.maintenant) };
    if (cam.bouton === null) delete cam.bouton;
    doc.campagnes.push(cam);
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'campagne.creation', cible: { type: 'campagne', id: cam.id, libelle: cam.objet }, details: 'Brouillon créé' });
    return vueCampagne(cam, doc, index(doc));
  });
  return avecStatut(201, r);
}

async function modifierCampagne(ctx) {
  await droit(ctx, 'newsletter');
  const id = parametreId(ctx, 'cam');
  const d = lireCampagne(ctx.corps, { creation: false });
  return ecrire(ctx, 'newsletter', (doc, m, moi) => {
    const cam = trouver(doc.campagnes, id, 'cam');
    if (cam.statut !== 'brouillon') throw erreur(409, 'Une campagne envoyée ne se modifie plus.', { code: 'statut' });
    Object.assign(cam, d);
    if (cam.bouton === null) delete cam.bouton;
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'campagne.modification', cible: { type: 'campagne', id: cam.id, libelle: cam.objet } });
    return vueCampagne(cam, doc, index(doc));
  });
}

async function supprimerCampagne(ctx) {
  await droit(ctx, 'newsletter');
  const id = parametreId(ctx, 'cam');
  return ecrire(ctx, 'newsletter', (doc, m, moi) => {
    const cam = trouver(doc.campagnes, id, 'cam');
    if (cam.statut !== 'brouillon') throw erreur(409, 'Seul un brouillon peut être supprimé.', { code: 'statut' });
    doc.campagnes = doc.campagnes.filter((x) => x.id !== id);
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'campagne.suppression', cible: { type: 'campagne', id, libelle: cam.objet } });
    return { ok: true };
  });
}

async function envoyerCampagne(ctx) {
  await droit(ctx, 'newsletter');
  const id = parametreId(ctx, 'cam');
  return ecrire(ctx, 'newsletter', (doc, m, moi) => {
    const cam = trouver(doc.campagnes, id, 'cam');
    if (cam.statut !== 'brouillon') throw erreur(409, 'Cette campagne est déjà envoyée.', { code: 'statut' });
    const liste = destinataires(doc, cam.segment);
    if (!liste.length) throw erreur(409, 'Aucun destinataire pour ce segment.', { code: 'segment' });
    Object.assign(cam, { statut: 'envoyee', envoyeeLe: iso(m.maintenant), destinataires: liste.length });
    // simulation : un seul courriel d'exemple dans la boîte d'envoi
    deposerCourriel(doc, m.maintenant, C.campagne(cam, liste[0]));
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'campagne.envoi', cible: { type: 'campagne', id: cam.id, libelle: cam.objet }, details: `Envoyée à ${liste.length} destinataires (démonstration : rien n’est parti)` });
    return { ok: true, destinataires: liste.length, campagne: vueCampagne(cam, doc, index(doc)) };
  });
}

// Fiche d'un abonné : l'abonné, le client de même e-mail et les courriels qui lui ont été envoyés
// (20 derniers, du plus récent), selon les droits.
async function abonne(ctx) {
  const { u, doc } = await lire(ctx, 'newsletter');
  const a = trouver(doc.abonnes, parametreId(ctx, 'abo'), 'abo');
  const k = peutLire(u.role, 'clients') ? trouverClient(doc, a.email) : null;
  return {
    ...abonneComplet(a),
    client: k ? { id: k.id, nom: `${k.prenom} ${k.nom}` } : null,
    courriels: peutLire(u.role, 'courriels')
      ? doc.courriels
          .filter((x) => x.a === a.email)
          .slice(-20)
          .reverse()
          .map((x) => ({ id: x.id, date: x.date, objet: x.objet, type: x.type }))
      : [],
  };
}

async function modifierAbonne(ctx) {
  await droit(ctx, 'newsletter');
  const id = parametreId(ctx, 'abo');
  const statut = V.choix(ctx.corps, 'statut', ['inscrit', 'desinscrit'], { requis: true, libelle: 'Statut' });
  return ecrire(ctx, 'newsletter', (doc, m, moi) => {
    const a = trouver(doc.abonnes, id, 'abo');
    a.statut = statut;
    if (statut === 'desinscrit') a.desinscritLe = iso(m.maintenant);
    else {
      delete a.desinscritLe;
      a.inscritLe = iso(m.maintenant);
    }
    const k = trouverClient(doc, a.email);
    if (k) k.newsletter = statut === 'inscrit';
    journaliser(doc, m.maintenant, { par: auteur(moi), action: statut === 'inscrit' ? 'abonne.inscription' : 'abonne.desinscription', cible: { type: 'abonne', id: a.id, libelle: a.email } });
    return abonneComplet(a);
  });
}

async function supprimerAbonne(ctx) {
  await droit(ctx, 'newsletter');
  const id = parametreId(ctx, 'abo');
  return ecrire(ctx, 'newsletter', (doc, m, moi) => {
    const a = trouver(doc.abonnes, id, 'abo');
    doc.abonnes = doc.abonnes.filter((x) => x.id !== id);
    const k = trouverClient(doc, a.email);
    if (k) k.newsletter = false;
    for (const e of doc.journal) if (e.cible?.id === id) e.cible.libelle = 'Abonné supprimé';
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'abonne.suppression', cible: { type: 'abonne', id, libelle: 'Abonné supprimé' }, details: 'Données effacées (RGPD)' });
    return { ok: true };
  });
}

function etatPromo(p, aujourdhui) {
  if (!p.actif) return 'inactif';
  if (p.debut && aujourdhui < p.debut) return 'a-venir';
  if (p.fin && aujourdhui > p.fin) return 'expire';
  if (p.limite && p.utilisations >= p.limite) return 'epuise';
  return 'actif';
}

async function promos(ctx) {
  const { doc } = await lire(ctx, 'newsletter');
  const aujourdhui = aujourdhuiDe(ctx);
  return { elements: doc.promos.map((p) => ({ ...p, etat: etatPromo(p, aujourdhui) })), total: doc.promos.length, page: 1, pages: 1 };
}

// Saisie d'un code promo ; en modification, null ou '' efface début, fin et limite d'utilisations.
function lirePromo(corps, { creation }) {
  const opt = (k, lire) => (creation ? lire() : V.effacable(corps, k, lire));
  const d = V.sansVide({
    code: (V.texte(corps, 'code', { requis: creation, min: 3, max: 20, libelle: 'Code' }) || '').toUpperCase() || undefined,
    libelle: V.texte(corps, 'libelle', { requis: creation, max: 120, libelle: 'Libellé' }),
    type: V.choix(corps, 'type', ['pourcentage', 'montant', 'livraison'], { requis: creation, libelle: 'Type' }),
    valeur: V.nombre(corps, 'valeur', { requis: creation, min: 0, max: 500, libelle: 'Valeur' }),
    minimumTTC: V.nombre(corps, 'minimumTTC', { min: 0, max: 10000, libelle: 'Minimum d’achat' }),
    debut: opt('debut', () => V.jour(corps, 'debut', { libelle: 'Début' })),
    fin: opt('fin', () => V.jour(corps, 'fin', { libelle: 'Fin' })),
    limite: opt('limite', () => V.entier(corps, 'limite', { min: 1, max: 100000, libelle: 'Limite d’utilisations' })),
    actif: V.booleen(corps, 'actif', { libelle: 'Actif' }),
  });
  if (d.code && !/^[A-Z0-9-]{3,20}$/.test(d.code)) throw erreur(400, 'Code : lettres, chiffres et tirets.', { champ: 'code', code: 'saisie' });
  if (d.type === 'pourcentage' && d.valeur > 90) throw erreur(400, 'Pourcentage : 90 % au plus.', { champ: 'valeur', code: 'saisie' });
  return d;
}

async function creerPromo(ctx) {
  await droit(ctx, 'newsletter');
  const d = lirePromo(ctx.corps, { creation: true });
  const r = await ecrire(ctx, 'newsletter', (doc, m, moi) => {
    if (doc.promos.some((p) => p.code === d.code)) throw erreur(409, 'Ce code existe déjà.', { champ: 'code', code: 'conflit' });
    const p = { id: idAleatoire('pro'), minimumTTC: 0, limite: null, actif: true, ...d, utilisations: 0 };
    doc.promos.push(p);
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'promo.creation', cible: { type: 'promo', id: p.id, libelle: p.code } });
    return { ...p, etat: etatPromo(p, jourParis(m.maintenant)) };
  });
  return avecStatut(201, r);
}

async function modifierPromo(ctx) {
  await droit(ctx, 'newsletter');
  const id = parametreId(ctx, 'pro');
  const d = lirePromo(ctx.corps, { creation: false });
  return ecrire(ctx, 'newsletter', (doc, m, moi) => {
    const p = trouver(doc.promos, id, 'pro');
    if (d.code && d.code !== p.code && doc.promos.some((x) => x.code === d.code)) throw erreur(409, 'Ce code existe déjà.', { champ: 'code', code: 'conflit' });
    const { limite, ...reste } = d;
    V.appliquer(p, reste);
    if (limite !== undefined) p.limite = limite; // null : sans limite, comme à la création
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'promo.modification', cible: { type: 'promo', id: p.id, libelle: p.code } });
    return { ...p, etat: etatPromo(p, jourParis(m.maintenant)) };
  });
}

// ---------- Courriels, journal ----------

async function courriels(ctx) {
  const { doc } = await lire(ctx, 'courriels');
  const type = ctx.param('type');
  const q = sansAccents(ctx.param('q', 80) || '');
  const liste = [...doc.courriels]
    .reverse()
    .filter((c) => !type || c.type === type)
    .filter((c) => !q || contient(q, c.a, c.objet))
    .map((c) => ({ id: c.id, date: c.date, a: c.a, objet: c.objet, type: c.type, lie: c.lie }));
  return paginer(liste, ctx);
}

async function courriel(ctx) {
  const { doc } = await lire(ctx, 'courriels');
  return trouver(doc.courriels, ctx.param('id', 40), 'crl');
}

async function journal(ctx) {
  const { doc } = await lire(ctx, 'journal');
  const action = ctx.param('action', 60);
  const auteurId = ctx.param('auteur', 40);
  const liste = [...doc.journal]
    .reverse()
    .filter((e) => !action || e.action === action || e.action.startsWith(`${action}.`))
    .filter((e) => !auteurId || e.par?.id === auteurId);
  return { ...paginer(liste, ctx, { parDefaut: 50, max: 200 }), actions: [...new Set(doc.journal.map((e) => e.action))].sort() };
}

// ---------- Équipe et paramètres ----------

async function equipe(ctx) {
  const { u, doc } = await lire(ctx, null);
  const personnel = doc.utilisateurs.filter((x) => ROLES_PERSONNEL.includes(x.role));
  if (!peutLire(u.role, 'equipe')) {
    // les autres rôles ne voient que les noms (attribution des messages, commercial d'un compte)
    return { membres: personnel.filter((x) => x.actif).map((x) => ({ id: x.id, prenom: x.prenom, nom: x.nom, role: x.role, poste: x.poste })) };
  }
  return {
    membres: personnel.map((x) => ({
      id: x.id,
      prenom: x.prenom,
      nom: x.nom,
      email: x.email,
      role: x.role,
      roleNom: NOMS_ROLES[x.role],
      poste: x.poste,
      telephone: x.telephone,
      actif: x.actif,
      statut: statutUtilisateur(x),
      derniereConnexion: x.derniereConnexion || null,
      demo: !!x.demo,
      invitationExpireLe: x.invitation?.exp,
    })),
  };
}

async function creerMembre(ctx) {
  await droit(ctx, 'equipe');
  const c = ctx.corps;
  const d = {
    ...lireNouvelUtilisateur(c),
    role: V.choix(c, 'role', ROLES_PERSONNEL, { requis: true, libelle: 'Rôle' }),
    poste: V.texte(c, 'poste', { max: 80, libelle: 'Poste' }),
    telephone: V.telephone(c, 'telephone'),
  };
  const r = await ecrire(ctx, 'equipe', (doc, m, moi) => {
    const inv = inviter(doc, m, d);
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'equipe.invitation', cible: { type: 'utilisateur', id: inv.utilisateur.id, libelle: `${d.prenom} ${d.nom}` }, details: `Rôle : ${NOMS_ROLES[d.role]}` });
    return { membre: utilisateurVue(inv.utilisateur), lienDemo: inv.lienDemo };
  });
  return avecStatut(201, r);
}

async function modifierMembre(ctx) {
  await droit(ctx, 'equipe');
  const id = parametreId(ctx, 'usr');
  const c = ctx.corps;
  const d = V.sansVide({
    role: V.choix(c, 'role', ROLES_PERSONNEL, { libelle: 'Rôle' }),
    actif: V.booleen(c, 'actif', { libelle: 'Actif' }),
    // null ou '' efface le poste ou le téléphone
    poste: V.effacable(c, 'poste', () => V.texte(c, 'poste', { max: 80, libelle: 'Poste' })),
    telephone: V.effacable(c, 'telephone', () => V.telephone(c, 'telephone')),
  });
  return ecrire(ctx, 'equipe', (doc, m, moi) => {
    const x = doc.utilisateurs.find((y) => y.id === id && ROLES_PERSONNEL.includes(y.role));
    if (!x) throw introuvable();
    if (x.id === moi.id && ((d.role && d.role !== moi.role) || d.actif === false)) throw erreur(409, 'Vous ne pouvez pas retirer vos propres droits.', { code: 'soi-meme' });
    const avant = { role: x.role, actif: x.actif };
    V.appliquer(x, d);
    // changement de rôle ou désactivation : ses sessions sont fermées
    if (x.role !== avant.role || x.actif !== avant.actif) x.sessionVersion = (x.sessionVersion || 0) + 1;
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'equipe.modification', cible: { type: 'utilisateur', id: x.id, libelle: nomComplet(x) }, details: d.actif === false ? 'Accès désactivé' : d.role ? `Rôle : ${NOMS_ROLES[d.role]}` : 'Coordonnées' });
    return { membre: { ...utilisateurVue(x), poste: x.poste, telephone: x.telephone, actif: x.actif } };
  });
}

async function parametres(ctx) {
  const { doc } = await lire(ctx, 'parametres');
  return { ...doc.parametres, libellesConditions: LIBELLES_CONDITIONS };
}

function lireBareme(liste, champ) {
  if (!Array.isArray(liste) || liste.length < 1 || liste.length > 8) throw erreur(400, 'Barème : 1 à 8 tranches.', { champ, code: 'saisie' });
  let precedent = 0;
  return liste.map((t, i) => {
    const jusquA = t?.jusquA === null ? null : V.entier(t, 'jusquA', { requis: true, min: 1, max: 999, libelle: 'Tranche' });
    const prixTTC = V.nombre(t, 'prixTTC', { requis: true, min: 0, max: 500, libelle: 'Prix TTC' });
    if (jusquA !== null && jusquA <= precedent) throw erreur(400, 'Barème : tranches croissantes.', { champ, code: 'saisie' });
    if (jusquA === null && i !== liste.length - 1) throw erreur(400, 'Barème : seule la dernière tranche est ouverte.', { champ, code: 'saisie' });
    precedent = jusquA ?? precedent;
    return { jusquA, prixTTC };
  });
}

async function modifierParametres(ctx) {
  await droit(ctx, 'parametres');
  const c = ctx.corps;
  const ch = {};
  const liv = V.objet(c, 'livraison', { libelle: 'Livraison' });
  if (liv) {
    ch.livraison = V.sansVide({
      colissimo: liv.colissimo === undefined ? undefined : lireBareme(liv.colissimo, 'colissimo'),
      relais: liv.relais === undefined ? undefined : lireBareme(liv.relais, 'relais'),
      francoTTC: V.nombre(liv, 'francoTTC', { min: 0, max: 10000, libelle: 'Franco TTC' }),
    });
  }
  const pro = V.objet(c, 'pro', { libelle: 'Conditions pro' });
  if (pro) {
    ch.pro = V.sansVide({
      minimumHT: V.nombre(pro, 'minimumHT', { min: 0, max: 10000, libelle: 'Minimum HT' }),
      francoHT: V.nombre(pro, 'francoHT', { min: 0, max: 10000, libelle: 'Franco HT' }),
      fraisPortHT: V.nombre(pro, 'fraisPortHT', { min: 0, max: 500, libelle: 'Port HT' }),
      delai: V.texte(pro, 'delai', { max: 60, libelle: 'Délai' }),
    });
  }
  const vis = V.objet(c, 'visites', { libelle: 'Visites' });
  if (vis) {
    const h = V.objet(vis, 'horaires', { libelle: 'Horaires' });
    const heure = (o, k) => {
      const x = V.texte(o, k, { requis: true, max: 5, libelle: 'Heure' });
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(x)) throw erreur(400, 'Heure : HH:MM.', { champ: k, code: 'saisie' });
      return x;
    };
    const s = V.objet(vis, 'saison', { libelle: 'Saison' });
    const mj = (o, k) => {
      const x = V.texte(o, k, { requis: true, max: 5, libelle: 'Date (MM-JJ)' });
      if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(x)) throw erreur(400, 'Date : MM-JJ.', { champ: k, code: 'saisie' });
      return x;
    };
    const fermeLe = vis.fermeLe === undefined ? undefined : V.liste(vis, 'fermeLe', { max: 7, libelle: 'Jours de fermeture' });
    if (fermeLe && !fermeLe.every((j) => Number.isInteger(j) && j >= 0 && j <= 6)) throw erreur(400, 'Jours de fermeture : 0 (dimanche) à 6.', { champ: 'fermeLe', code: 'saisie' });
    ch.visites = V.sansVide({
      capacite: V.entier(vis, 'capacite', { min: 1, max: 60, libelle: 'Capacité' }),
      horaires: h ? { matin: heure(h, 'matin'), 'apres-midi': heure(h, 'apres-midi') } : undefined,
      saison: s ? { debut: mj(s, 'debut'), fin: mj(s, 'fin') } : undefined,
      fermeLe: fermeLe ? [...new Set(fermeLe)].sort() : undefined,
    });
  }
  const ent = V.objet(c, 'entreprise', { libelle: 'Entreprise' });
  if (ent) {
    ch.entreprise = V.sansVide({
      nom: V.texte(ent, 'nom', { max: 120, libelle: 'Nom' }),
      adresse: V.texte(ent, 'adresse', { max: 200, libelle: 'Adresse' }),
      telephone: V.telephone(ent, 'telephone'),
      email: V.email(ent, 'email'),
      siret: V.texte(ent, 'siret', { max: 20, libelle: 'SIRET' }),
      tvaIntra: V.texte(ent, 'tvaIntra', { max: 20, libelle: 'TVA intracommunautaire' }),
      rcs: V.texte(ent, 'rcs', { max: 60, libelle: 'RCS' }),
    });
  }
  if (!Object.keys(ch).length) throw erreur(400, 'Rien à modifier.', { code: 'saisie' });
  return ecrire(ctx, 'parametres', (doc, m, moi) => {
    for (const [k, v] of Object.entries(ch)) doc.parametres[k] = { ...doc.parametres[k], ...v };
    journaliser(doc, m.maintenant, { par: auteur(moi), action: 'parametres.modification', details: `Rubriques : ${Object.keys(ch).join(', ')}` });
    return { ...doc.parametres, libellesConditions: LIBELLES_CONDITIONS };
  });
}

// ---------- Exports CSV ----------

const EXPORTS = {
  commandes: ['commandes', 'commandes-pro'],
  clients: ['clients'],
  comptes: ['comptes'],
  abonnes: ['newsletter'],
  reservations: ['visites'],
  produits: ['produits'],
};

// Les filtres et le tri de la liste correspondante s'appliquent quand ils sont fournis (commandes :
// statut, canal, du, au, q, compteId, clientId, tri ; clients : segment, q, tri ; comptes :
// typeCompte (le `type` de la liste), statut, commercial, q, tri ; abonnés : statut, source, q ;
// réservations : du, au ; produits : gamme, q, stock) ; sans filtre, l'export est complet.
async function exporter(ctx) {
  const type = ctx.param('type');
  if (!Object.hasOwn(EXPORTS, type)) throw erreur(400, 'Export inconnu.', { champ: 'type', code: 'saisie' });
  const { u, doc, idx } = await lire(ctx, 'exports');
  const lisibles = EXPORTS[type].filter((r) => peutLire(u.role, r));
  if (!lisibles.length) exiger(u, EXPORTS[type][0], 'lecture');
  const aujourdhui = aujourdhuiDe(ctx);
  const fichier = `${type}-${aujourdhui}.csv`;
  if (type === 'commandes') {
    const factures = peutLire(u.role, 'factures');
    const { liste: toutes, statut } = commandesFiltrees(ctx, doc, idx, lisibles);
    const liste = trier(statut ? toutes.filter((c) => c.statut === statut) : toutes, ctx.param('tri'), TRI_COMMANDES, '-date');
    const colonnes = [
      { titre: 'Numéro', valeur: (c) => c.numero },
      { titre: 'Date', valeur: (c) => c.createdAt, type: 'instant' },
      { titre: 'Canal', valeur: (c) => ({ 'en-ligne': 'En ligne', pro: 'Pro', telephone: 'Téléphone' })[c.canal] },
      { titre: 'Client', valeur: (c) => (c.compteId ? idx.comptes.get(c.compteId)?.enseigne : c.contact.nom) },
      { titre: 'E-mail', valeur: (c) => c.contact.email },
      { titre: 'Statut', valeur: (c) => LIBELLES_STATUTS[c.statut] },
      { titre: 'Paiement', valeur: (c) => LIBELLES_PAIEMENTS[c.paiement.mode] || c.paiement.mode },
      { titre: 'Statut du paiement', valeur: (c) => LIBELLES_STATUTS_PAIEMENT[c.paiement.statut] || c.paiement.statut },
      { titre: 'Articles', valeur: (c) => articles(c), type: 'nombre' },
      { titre: 'Total HT (€)', valeur: (c) => c.totaux.totalHT, type: 'montant' },
      { titre: 'TVA (€)', valeur: (c) => c.totaux.totalTVA, type: 'montant' },
      { titre: 'Total TTC (€)', valeur: (c) => c.totaux.totalTTC, type: 'montant' },
      { titre: 'Livraison', valeur: (c) => c.livraison.libelle },
      { titre: 'Code promo', valeur: (c) => c.promo?.code },
    ];
    if (factures) {
      colonnes.push({ titre: 'Facture', valeur: (c) => c.facture?.numero });
      colonnes.push({ titre: 'Échéance', valeur: (c) => c.facture?.echeance, type: 'jour' });
      colonnes.push({ titre: 'Statut de la facture', valeur: (c) => (c.facture ? (enRetard(c.facture, aujourdhui) ? 'En retard' : c.facture.statut === 'payee' ? 'Payée' : 'À régler') : '') });
    }
    for (const op of OPERATIONS) colonnes.push({ titre: `Don ${op.nom} (€)`, valeur: (c) => (c.operation?.id === op.id ? c.operation.montant : ''), type: 'montant' });
    return reponseCsv(fichier, colonnes, liste);
  }
  if (type === 'clients') {
    return reponseCsv(
      fichier,
      [
        { titre: 'Prénom', valeur: (x) => x.k.prenom },
        { titre: 'Nom', valeur: (x) => x.k.nom },
        { titre: 'E-mail', valeur: (x) => x.k.email },
        { titre: 'Téléphone', valeur: (x) => x.k.telephone },
        { titre: 'Code postal', valeur: (x) => x.k.adresse?.cp },
        { titre: 'Ville', valeur: (x) => x.k.adresse?.ville },
        { titre: 'Newsletter', valeur: (x) => !!x.seg.newsletter, type: 'booleen' },
        { titre: 'Commandes', valeur: (x) => x.s?.n || 0, type: 'nombre' },
        { titre: 'Total TTC (€)', valeur: (x) => versEuros(x.s?.c || 0), type: 'montant' },
        { titre: 'Dernière commande', valeur: (x) => x.s?.derniere, type: 'instant' },
        { titre: 'Origine', valeur: (x) => LIBELLES_ORIGINES[x.k.origine] || x.k.origine },
        { titre: 'Étiquettes', valeur: (x) => x.k.tags.join(', ') },
        { titre: 'Créé le', valeur: (x) => x.k.createdAt, type: 'instant' },
      ],
      clientsFiltres(ctx, doc, idx).liste,
    );
  }
  if (type === 'comptes') {
    const factures = peutLire(u.role, 'factures');
    const colonnes = [
      { titre: 'Enseigne', valeur: (x) => x.k.enseigne },
      { titre: 'Raison sociale', valeur: (x) => x.k.raisonSociale },
      { titre: 'Type', valeur: (x) => LIBELLES_TYPES_COMPTE[x.k.type] || x.k.type },
      { titre: 'SIRET', valeur: (x) => x.k.siret },
      { titre: 'TVA intracommunautaire', valeur: (x) => x.k.tvaIntra },
      { titre: 'Licence', valeur: (x) => LIBELLES_LICENCES[x.k.licence] || x.k.licence },
      { titre: 'Ville', valeur: (x) => x.k.adresseFacturation?.ville },
      { titre: 'Statut', valeur: (x) => (x.k.statut === 'actif' ? 'Actif' : 'Suspendu') },
      { titre: 'Grille', valeur: (x) => x.k.grille.toUpperCase() },
      { titre: 'Remise (%)', valeur: (x) => x.k.remise, type: 'nombre' },
      { titre: 'Conditions', valeur: (x) => LIBELLES_CONDITIONS[x.k.conditions] },
      { titre: 'CA 12 mois HT (€)', valeur: (x) => x.r.ca12, type: 'montant' },
      { titre: 'Commercial', valeur: (x) => x.r.commercial?.nom },
      { titre: 'E-mail', valeur: (x) => x.k.email },
      { titre: 'Téléphone', valeur: (x) => x.k.telephone },
    ];
    if (factures) {
      colonnes.splice(11, 0, { titre: 'Encours (€)', valeur: (x) => x.r.encours, type: 'montant' }, { titre: 'Encours autorisé (€)', valeur: (x) => x.k.encoursMax, type: 'montant' });
    }
    return reponseCsv(fichier, colonnes, comptesFiltres(ctx, doc, idx, factures, { type: ctx.param('typeCompte') }));
  }
  if (type === 'abonnes') {
    return reponseCsv(
      fichier,
      [
        { titre: 'E-mail', valeur: (a) => a.email },
        { titre: 'Prénom', valeur: (a) => a.prenom },
        { titre: 'Source', valeur: (a) => LIBELLES_SOURCES[a.source] || a.source },
        { titre: 'Statut', valeur: (a) => (a.statut === 'inscrit' ? 'Inscrit' : 'Désinscrit') },
        { titre: 'Inscrit le', valeur: (a) => a.inscritLe, type: 'instant' },
        { titre: 'Désinscrit le', valeur: (a) => a.desinscritLe, type: 'instant' },
      ],
      abonnesFiltres(ctx, doc.abonnes.map(abonneComplet)),
    );
  }
  if (type === 'reservations') {
    const du = ctx.param('du');
    const au = ctx.param('au');
    if ((du && !estJour(du)) || (au && !estJour(au)) || (du && au && au < du)) throw erreur(400, 'Période invalide (AAAA-MM-JJ).', { champ: du && !estJour(du) ? 'du' : 'au', code: 'saisie' });
    return reponseCsv(
      fichier,
      [
        { titre: 'Référence', valeur: (r) => r.reference },
        { titre: 'Date', valeur: (r) => r.date, type: 'jour' },
        { titre: 'Heure', valeur: (r) => r.heure },
        { titre: 'Personnes', valeur: (r) => r.personnes, type: 'nombre' },
        { titre: 'Mineurs', valeur: (r) => r.mineurs, type: 'nombre' },
        { titre: 'Langue', valeur: (r) => r.langue },
        { titre: 'Nom', valeur: (r) => r.nom },
        { titre: 'E-mail', valeur: (r) => r.email },
        { titre: 'Téléphone', valeur: (r) => r.telephone },
        { titre: 'Statut', valeur: (r) => LIBELLES_RESERVATIONS[r.statut] || r.statut },
        { titre: 'Source', valeur: (r) => ({ site: 'Site', telephone: 'Téléphone', crm: 'CRM' })[r.source] || r.source },
        { titre: 'Créée le', valeur: (r) => r.createdAt, type: 'instant' },
      ],
      reservationsDe(doc, du, au),
    );
  }
  const lignes = produitsFiltres(ctx, doc).liste.flatMap((p) => p.variantes.map((v) => ({ p, v })));
  return reponseCsv(
    fichier,
    [
      { titre: 'Produit', valeur: (x) => x.p.nom },
      { titre: 'Gamme', valeur: (x) => x.p.gammeNom },
      { titre: 'Contenance', valeur: (x) => x.v.volume },
      { titre: 'Alcool', valeur: (x) => x.p.alcool, type: 'booleen' },
      { titre: 'Degré', valeur: (x) => x.p.degre, type: 'nombre' },
      { titre: 'Prix TTC (€)', valeur: (x) => x.v.prixTTC, type: 'montant' },
      { titre: 'Tarif pro HT (€)', valeur: (x) => x.v.prixProHT, type: 'montant' },
      { titre: 'TVA (%)', valeur: (x) => x.v.tva, type: 'nombre' },
      { titre: 'Stock', valeur: (x) => x.v.stock, type: 'nombre' },
      { titre: 'Seuil', valeur: (x) => x.v.seuil, type: 'nombre' },
      { titre: 'Colisage', valeur: (x) => x.v.colisage, type: 'nombre' },
      { titre: 'État', valeur: (x) => ({ disponible: 'Disponible', 'stock-bas': 'Stock bas', rupture: 'Rupture' })[x.v.etat] },
      { titre: 'Vendus 30 jours', valeur: (x) => x.v.vendus30, type: 'nombre' },
      { titre: 'En vente', valeur: (x) => x.p.actif, type: 'booleen' },
    ],
    lignes,
  );
}

export const routes = {
  GET: {
    tableau,
    notifications,
    recherche,
    commandes,
    commande,
    clients,
    client,
    'client-export': clientExport,
    comptes,
    compte,
    demandes,
    demande,
    produits,
    mouvements,
    visites,
    messages,
    message,
    newsletter,
    abonne,
    promos,
    courriels,
    courriel,
    journal,
    equipe,
    parametres,
    export: exporter,
  },
  POST: {
    'notifications-vues': notificationsVues,
    commande: creerCommande,
    'commandes-statut': commandesStatut,
    client: creerClient,
    compte: creerCompte,
    'compte-utilisateur': compteUtilisateur,
    'demande-accepter': accepterDemande,
    'demande-refuser': refuserDemande,
    stock,
    seance: creerSeance,
    reservation: creerReservation,
    'message-reponse': messageReponse,
    campagne: creerCampagne,
    'campagne-envoyer': envoyerCampagne,
    promo: creerPromo,
    membre: creerMembre,
  },
  PATCH: {
    commande: modifierCommande,
    client: modifierClient,
    compte: modifierCompte,
    demande: modifierDemande,
    produit: modifierProduit,
    seance: modifierSeance,
    reservation: modifierReservation,
    message: modifierMessage,
    campagne: modifierCampagne,
    abonne: modifierAbonne,
    promo: modifierPromo,
    membre: modifierMembre,
    parametres: modifierParametres,
  },
  DELETE: {
    client: supprimerClient,
    campagne: supprimerCampagne,
    abonne: supprimerAbonne,
  },
};
