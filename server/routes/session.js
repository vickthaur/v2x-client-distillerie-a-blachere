// api/session : connexion, démo, mots de passe (docs/crm-espace-pro.md, § 7).
import {
  assurerDemo,
  chargeDemo,
  compteDe,
  demoCourante,
  DUREE_DEMO_S,
  DUREE_PARTAGE_S,
  effacerCookiesDemo,
  ESPACES,
  estPersonnel,
  exigerSession,
  moiDans,
  muter,
  poserCookiesDemo,
  poserSession,
  REDIRECTIONS,
  sessionCourante,
  valablePour,
  vuePublique,
} from '../acces.js';
import {
  depasse,
  DUREE_REINITIALISATION_MS,
  erreurVerrou,
  hacherJeton,
  hacherMotDePasse,
  hacheMotDePasseDemo,
  jetonValide,
  LIMITES,
  limiter,
  memeHache,
  MOT_DE_PASSE_DEMO,
  nouveauJeton,
  noterEchec,
  ROLES_PERSONNEL,
  signer,
  USAGES,
  verifier,
  verifierMotDePasse,
  verrouJusqua,
} from '../auth.js';
import * as C from '../courriels.js';
import { bacs } from '../demo.js';
import { auteur, deposerCourriel, journaliser, nomComplet } from '../evenements.js';
import { erreur, redirection } from '../http.js';
import { genererDemo } from '../seed.js';
import { iso } from '../temps.js';
import * as V from '../valider.js';

const PROFILS = ['direction', 'commercial', 'logistique', 'boutique', 'pro'];
const EMAILS_DEMO = ['direction@blachere.example', 'commercial@blachere.example', 'logistique@blachere.example', 'boutique@blachere.example', 'julien@cafe-des-platanes.example'];

const espaceDe = (corps, { requis = true } = {}) => V.choix(corps, 'espace', ESPACES, { requis, libelle: 'Espace' });
const espaceDuRole = (u) => (estPersonnel(u) ? 'crm' : 'pro');

const MAUVAIS_ESPACE = {
  crm: { erreur: 'Ce compte est un compte professionnel : connectez-vous depuis l’espace pro.', redirection: '/espace-pro' },
  pro: { erreur: 'Ce compte appartient au personnel de la distillerie : connectez-vous depuis le CRM.', redirection: '/crm' },
};

function echecIp(ctx) {
  limiter(`echecs:${ctx.ip}`, LIMITES.echecs.max + 1, LIMITES.echecs.fenetre, ctx.maintenant.getTime());
}
function controlerIp(ctx) {
  if (depasse(`echecs:${ctx.ip}`, LIMITES.echecs.max, ctx.maintenant.getTime())) {
    throw erreur(429, 'Trop de tentatives de connexion depuis cette adresse : réessayez dans quelques minutes.', { code: 'limite', reessayerDans: 900 });
  }
}

// Connexion réussie (dans une mutation) : compteur remis à zéro, dernière connexion, journal.
function noterConnexion(doc, m, id) {
  const u = doc.utilisateurs.find((x) => x.id === id);
  u.echecs = { n: 0 };
  u.derniereConnexion = iso(m.maintenant);
  if (estPersonnel(u)) journaliser(doc, m.maintenant, { par: auteur(u), action: 'utilisateur.connexion', cible: { type: 'utilisateur', id: u.id, libelle: nomComplet(u) } });
  return u;
}

async function connecter(ctx, espace, id, options) {
  const u = await muter(ctx, (doc, m) => noterConnexion(doc, m, id));
  poserSession(ctx, espace, u, options);
  // chaque connexion prolonge le cookie de démo (30 jours)
  poserCookiesDemo(ctx, ctx._demo.id);
  return { utilisateur: vuePublique(ctx._demo.doc, u), redirection: REDIRECTIONS[espace] };
}

// ---------- GET ----------

async function moi(ctx) {
  const espace = ctx.param('espace') === 'pro' ? 'pro' : 'crm';
  const d = await demoCourante(ctx);
  if (!d) return { utilisateur: null, demo: { active: false } };
  // le cookie de démo est prolongé à chaque visite (30 jours après la dernière)
  const charge = chargeDemo(ctx);
  if (charge && charge.exp - Math.floor(ctx.maintenant.getTime() / 1000) < DUREE_DEMO_S - 86400) poserCookiesDemo(ctx, d.id);
  const u = await sessionCourante(ctx, espace);
  const out = {
    utilisateur: u ? vuePublique(d.doc, u) : null,
    demo: { active: true, creeLe: d.doc.createdAt, expireLe: iso(Date.parse(d.doc.updatedAt) + DUREE_DEMO_S * 1000) },
  };
  const compte = u ? compteDe(d.doc, u) : undefined;
  if (compte) out.compte = compte;
  return out;
}

function trouverParJeton(doc, champ, jeton, maintenantMs) {
  const h = hacherJeton(jeton);
  return doc.utilisateurs.find((u) => u[champ] && memeHache(u[champ].hache, h) && Date.parse(u[champ].exp) > maintenantMs) || null;
}

async function invitation(ctx) {
  const jeton = ctx.param('jeton', 100);
  const d = await demoCourante(ctx);
  const u = d && jetonValide(jeton) ? trouverParJeton(d.doc, 'invitation', jeton, ctx.maintenant.getTime()) : null;
  if (!u) throw erreur(404, 'Invitation introuvable ou expirée : demandez un nouveau lien à la distillerie.', { code: 'jeton' });
  const out = { email: u.email, prenom: u.prenom, espace: espaceDuRole(u) };
  const k = compteDe(d.doc, u);
  if (k) out.compte = k;
  return out;
}

// Lien de partage : pose bl_demo puis redirige vers l'écran de connexion de l'espace.
async function rejoindre(ctx) {
  const vers = ctx.param('vers') === 'pro' ? 'pro' : 'crm';
  const page = vers === 'pro' ? '/espace-pro' : '/crm';
  const charge = verifier(USAGES.partage, ctx.param('jeton', 1024), ctx.maintenant.getTime());
  const lu = charge && typeof charge.sb === 'string' ? await bacs.lire(charge.sb) : null;
  if (!lu) return redirection(`${page}?demo=lien-invalide`);
  const actuelle = chargeDemo(ctx);
  if (!actuelle || actuelle.sb !== lu.id) {
    effacerCookiesDemo(ctx);
    ctx._demo = lu;
    poserCookiesDemo(ctx, lu.id);
  }
  return redirection(page);
}

// ---------- POST ----------

async function connexion(ctx) {
  const c = ctx.corps;
  const email = V.email(c, 'email', { requis: true });
  const motDePasse = V.motDePasse(c, 'motDePasse', { controleLongueur: false });
  const espace = espaceDe(c);
  const resterConnecte = V.booleen(c, 'resterConnecte', { defaut: false });
  controlerIp(ctx);
  const refus = () => erreur(401, 'E-mail ou mot de passe incorrect.', { code: 'identifiants' });

  let d = await demoCourante(ctx);
  if (!d) {
    // Sans démo, seuls les comptes de démonstration ouvrent une démo (rien n'est créé sinon).
    const okDemo = EMAILS_DEMO.includes(email) && motDePasse === MOT_DE_PASSE_DEMO;
    await verifierMotDePasse(motDePasse, null);
    if (!okDemo) {
      echecIp(ctx);
      throw refus();
    }
    d = await assurerDemo(ctx);
  }
  const u = d.doc.utilisateurs.find((x) => x.email === email);
  if (!u) {
    await verifierMotDePasse(motDePasse, null);
    echecIp(ctx);
    throw refus();
  }
  const now = ctx.maintenant.getTime();
  const verrou = verrouJusqua(u, now);
  if (verrou) throw erreurVerrou(verrou, now);
  const ok = await verifierMotDePasse(motDePasse, u.hash);
  if (!ok) {
    echecIp(ctx);
    const verrouille = await muter(ctx, (doc, m) => {
      const x = doc.utilisateurs.find((y) => y.id === u.id);
      return noterEchec(x, m.maintenant.getTime()) ? Date.parse(x.echecs.jusqua) : 0;
    });
    if (verrouille) throw erreurVerrou(verrouille, now);
    throw refus();
  }
  if (!u.actif) throw erreur(403, 'Ce compte est désactivé : contactez la direction de la distillerie.', { code: 'inactif' });
  if (espaceDuRole(u) !== espace) throw erreur(403, MAUVAIS_ESPACE[espace].erreur, { code: 'mauvais-espace', redirection: MAUVAIS_ESPACE[espace].redirection });
  if (!valablePour(d.doc, u, espace)) throw erreur(403, 'Le compte professionnel est suspendu : contactez la distillerie.', { code: 'suspendu' });
  return connecter(ctx, espace, u.id, { resterConnecte });
}

async function deconnexion(ctx) {
  const espace = espaceDe(ctx.corps);
  if (ctx.corps.partout === true) {
    // déconnexion de tous les appareils : sessionVersion + 1
    await exigerSession(ctx, espace);
    await muter(ctx, (doc) => {
      const u = moiDans(doc, ctx);
      u.sessionVersion = (u.sessionVersion || 0) + 1;
    });
  }
  ctx.effacerCookie(`bl_${espace}`);
  return { ok: true };
}

async function demo(ctx) {
  const profil = V.choix(ctx.corps, 'profil', PROFILS, { requis: true, libelle: 'Profil' });
  const espace = profil === 'pro' ? 'pro' : 'crm';
  const d = await assurerDemo(ctx);
  const u = d.doc.utilisateurs.find((x) => x.demo && x.role === profil && valablePour(d.doc, x, espace));
  if (!u) throw erreur(409, 'Ce profil de démonstration n’est plus disponible dans cette démo : réinitialisez-la.', { code: 'profil' });
  return connecter(ctx, espace, u.id, { resterConnecte: espace === 'pro' });
}

async function partager(ctx) {
  const crm = await sessionCourante(ctx, 'crm');
  const pro = crm ? null : await sessionCourante(ctx, 'pro');
  if (!crm && !pro) throw erreur(401, 'Session expirée : reconnectez-vous.', { code: 'session' });
  const vers = V.choix(ctx.corps, 'vers', ESPACES, { defaut: crm ? 'crm' : 'pro' });
  const exp = Math.floor(ctx.maintenant.getTime() / 1000) + DUREE_PARTAGE_S;
  const jeton = signer(USAGES.partage, { sb: ctx._demo.id, exp });
  return { lien: `${ctx.origine}/api/session?r=rejoindre&jeton=${encodeURIComponent(jeton)}&vers=${vers}`, expireLe: iso(exp * 1000) };
}

async function reinitialiser(ctx) {
  const sessions = {};
  for (const e of ESPACES) {
    const u = await sessionCourante(ctx, e);
    if (u) sessions[e] = u;
  }
  if (!Object.keys(sessions).length) throw erreur(401, 'Session expirée : reconnectez-vous.', { code: 'session' });
  const hache = await hacheMotDePasseDemo();
  const id = ctx._demo.id;
  const nouveau = genererDemo({ id, maintenant: ctx.maintenant, hache, jetons: nouveauJeton });
  // La session reste ouverte : même e-mail dans le nouveau jeu, sinon le profil de démonstration du même rôle.
  const remplacants = {};
  for (const [e, u] of Object.entries(sessions)) {
    remplacants[e] =
      nouveau.utilisateurs.find((x) => x.email === u.email && valablePour(nouveau, x, e)) ||
      nouveau.utilisateurs.find((x) => x.demo && x.role === u.role && valablePour(nouveau, x, e)) ||
      nouveau.utilisateurs.find((x) => x.demo && valablePour(nouveau, x, e));
  }
  journaliser(nouveau, ctx.maintenant, { par: auteur(remplacants.crm || remplacants.pro), action: 'demo.reinitialisation', details: 'Démo remise à zéro : jeu de démonstration du jour.' });
  await muter(ctx, (doc, m) => m.remplacer(nouveau));
  for (const [e, u] of Object.entries(remplacants)) if (u) poserSession(ctx, e, u);
  return { ok: true };
}

async function quitter(ctx) {
  effacerCookiesDemo(ctx);
  return { ok: true };
}

async function oubli(ctx) {
  const email = V.email(ctx.corps, 'email', { requis: true });
  const espace = espaceDe(ctx.corps);
  const d = await demoCourante(ctx);
  const u = d?.doc.utilisateurs.find((x) => x.email === email && valablePour(d.doc, x, espace) && x.hash);
  if (!u) return { ok: true };
  const { jeton, hache } = nouveauJeton();
  await muter(ctx, (doc, m) => {
    const x = doc.utilisateurs.find((y) => y.id === u.id);
    x.reinit = { hache, exp: iso(m.maintenant.getTime() + DUREE_REINITIALISATION_MS) };
    deposerCourriel(doc, m.maintenant, C.reinitialisation(x, jeton, espace));
  });
  // Démonstration : le lien est rendu pour pouvoir le tester (il est aussi dans la boîte d'envoi).
  return { ok: true, lienDemo: `${espace === 'crm' ? '/crm' : '/espace-pro'}/mot-de-passe?jeton=${jeton}` };
}

// Mot de passe choisi depuis un lien (invitation ou réinitialisation), à usage unique.
async function depuisJeton(ctx, champ) {
  const jeton = typeof ctx.corps.jeton === 'string' ? ctx.corps.jeton : '';
  const motDePasse = V.motDePasse(ctx.corps, 'motDePasse');
  const d = await demoCourante(ctx);
  const invalide = () => erreur(404, champ === 'invitation' ? 'Invitation introuvable ou expirée : demandez un nouveau lien à la distillerie.' : 'Lien expiré ou déjà utilisé : refaites une demande de mot de passe.', { code: 'jeton' });
  if (!d || !jetonValide(jeton)) throw invalide();
  if (!trouverParJeton(d.doc, champ, jeton, ctx.maintenant.getTime())) throw invalide();
  const hash = await hacherMotDePasse(motDePasse);
  const u = await muter(ctx, (doc, m) => {
    const x = trouverParJeton(doc, champ, jeton, m.maintenant.getTime());
    if (!x) throw invalide();
    delete x[champ];
    x.hash = hash;
    x.sessionVersion = (x.sessionVersion || 0) + 1;
    x.echecs = { n: 0 };
    if (champ === 'invitation') x.actif = true;
    x.derniereConnexion = iso(m.maintenant);
    journaliser(doc, m.maintenant, {
      par: auteur(x),
      action: champ === 'invitation' ? 'utilisateur.activation' : 'utilisateur.mot-de-passe',
      cible: { type: 'utilisateur', id: x.id, libelle: nomComplet(x) },
      details: champ === 'invitation' ? 'Accès activé' : 'Mot de passe réinitialisé',
    });
    return x;
  });
  const espace = espaceDuRole(u);
  if (!valablePour(ctx._demo.doc, u, espace)) throw erreur(403, 'Le compte professionnel est suspendu : contactez la distillerie.', { code: 'suspendu' });
  poserSession(ctx, espace, u);
  return { utilisateur: vuePublique(ctx._demo.doc, u), redirection: REDIRECTIONS[espace] };
}

async function motDePasse(ctx) {
  const espace = espaceDe(ctx.corps);
  const actuel = V.motDePasse(ctx.corps, 'actuel', { libelle: 'Mot de passe actuel', controleLongueur: false });
  const nouveau = V.motDePasse(ctx.corps, 'nouveau', { libelle: 'Nouveau mot de passe' });
  if (nouveau === actuel) throw erreur(400, 'Le nouveau mot de passe doit être différent de l’actuel.', { champ: 'nouveau', code: 'saisie' });
  const u = await exigerSession(ctx, espace);
  const now = ctx.maintenant.getTime();
  const verrou = verrouJusqua(u, now);
  if (verrou) throw erreurVerrou(verrou, now);
  if (!(await verifierMotDePasse(actuel, u.hash))) {
    const verrouille = await muter(ctx, (doc, m) => {
      const x = moiDans(doc, ctx);
      return noterEchec(x, m.maintenant.getTime()) ? Date.parse(x.echecs.jusqua) : 0;
    });
    if (verrouille) throw erreurVerrou(verrouille, now);
    throw erreur(401, 'Mot de passe actuel incorrect.', { champ: 'actuel', code: 'identifiants' });
  }
  const hash = await hacherMotDePasse(nouveau);
  const x = await muter(ctx, (doc, m) => {
    const y = moiDans(doc, ctx);
    y.hash = hash;
    y.sessionVersion = (y.sessionVersion || 0) + 1;
    y.echecs = { n: 0 };
    delete y.reinit;
    if (estPersonnel(y)) journaliser(doc, m.maintenant, { par: auteur(y), action: 'utilisateur.mot-de-passe', cible: { type: 'utilisateur', id: y.id, libelle: nomComplet(y) }, details: 'Mot de passe modifié' });
    return y;
  });
  // les autres appareils sont déconnectés ; celui-ci reçoit un nouveau cookie
  poserSession(ctx, espace, x);
  return { ok: true };
}

export const routes = {
  GET: { moi, invitation, rejoindre },
  POST: {
    connexion,
    deconnexion,
    demo,
    partager,
    reinitialiser,
    quitter,
    oubli,
    'reinitialiser-mot-de-passe': (ctx) => depuisJeton(ctx, 'reinit'),
    activer: (ctx) => depuisJeton(ctx, 'invitation'),
    'mot-de-passe': motDePasse,
  },
};

export { ROLES_PERSONNEL };
