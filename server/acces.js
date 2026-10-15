// Accès d'un appel à sa démo et à ses sessions (docs/crm-espace-pro.md, § 3) :
// - bl_demo : identifiant signé de la démo (30 jours) ; bl_demo_actif=1 lisible par les pages ;
//   un cookie falsifié, expiré, ou qui désigne une démo effacée (ménage) est traité comme absent
//   (cookies effacés) ;
// - bl_crm (personnel) et bl_pro (client pro) : { sb, uid, v, exp } signés, chacun avec sa clé ;
//   une session n'est valable que dans la démo du cookie bl_demo et tant que v = sessionVersion.
import { nouvelIdDemo } from './aleatoire.js';
import { hacheMotDePasseDemo, LIMITES, limiter, listeDroits, nouveauJeton, ROLES_PERSONNEL, signer, USAGES, verifier } from './auth.js';
import { bacs, DemoIntrouvable, plafonner } from './demo.js';
import { erreur } from './http.js';
import { compteResume, utilisateurPublic } from './modele.js';
import { genererDemo } from './seed.js';
import { iso } from './temps.js';

export const DUREE_DEMO_S = 30 * 86400;
export const DUREE_SESSION_S = 12 * 3600;
export const DUREE_SESSION_LONGUE_S = 30 * 86400;
export const DUREE_PARTAGE_S = 7 * 86400;

const secondes = (ctx) => Math.floor(ctx.maintenant.getTime() / 1000);

// ---------- Démo ----------

export function chargeDemo(ctx) {
  const c = verifier(USAGES.demo, ctx.cookies.bl_demo, ctx.maintenant.getTime());
  return c && typeof c.sb === 'string' ? c : null;
}

export function poserCookiesDemo(ctx, id) {
  ctx.poserCookie('bl_demo', signer(USAGES.demo, { sb: id, exp: secondes(ctx) + DUREE_DEMO_S }), { maxAge: DUREE_DEMO_S });
  ctx.poserCookie('bl_demo_actif', '1', { maxAge: DUREE_DEMO_S, httpOnly: false });
}

export function effacerCookiesDemo(ctx) {
  ctx.effacerCookie('bl_demo');
  ctx.effacerCookie('bl_crm');
  ctx.effacerCookie('bl_pro');
  ctx.effacerCookie('bl_demo_actif', { httpOnly: false });
}

// Démo de l'appel : { id, doc, etag } ou null.
export async function demoCourante(ctx) {
  if (ctx._demo !== undefined) return ctx._demo;
  const charge = chargeDemo(ctx);
  const lu = charge ? await bacs.lire(charge.sb) : null;
  if (!lu) {
    if (ctx.cookies.bl_demo || ctx.cookies.bl_demo_actif || ctx.cookies.bl_crm || ctx.cookies.bl_pro) effacerCookiesDemo(ctx);
    ctx._demo = null;
    return null;
  }
  ctx._demo = lu;
  return lu;
}

// Nouveau jeu de démonstration (en mémoire), dans la limite de 20 créations par heure et par
// adresse IP (et par instance).
async function nouveauJeu(ctx) {
  if (!limiter(`demos:${ctx.ip}`, LIMITES.demos.max, LIMITES.demos.fenetre, ctx.maintenant.getTime())) {
    throw erreur(429, 'Trop de démonstrations créées depuis cette adresse : réessayez dans une heure.', { code: 'limite', reessayerDans: 3600 });
  }
  const hache = await hacheMotDePasseDemo();
  return genererDemo({ id: nouvelIdDemo(), maintenant: ctx.maintenant, hache, jetons: nouveauJeton });
}

async function enregistrerNouvelle(ctx, doc) {
  const cree = await bacs.creer(plafonner(doc));
  poserCookiesDemo(ctx, cree.id);
  ctx._demo = cree;
  return cree;
}

// Démo de l'appel, créée si besoin.
export async function assurerDemo(ctx) {
  return (await demoCourante(ctx)) || enregistrerNouvelle(ctx, await nouveauJeu(ctx));
}

// Mutation de la démo de l'appel (voir demo.js : ETag, reprise, 409).
export async function muter(ctx, fn) {
  const d = ctx._demo === undefined ? await demoCourante(ctx) : ctx._demo;
  if (!d) throw erreur(401, 'Aucune démo en cours : ouvrez d’abord la démonstration.', { code: 'demo' });
  try {
    const r = await bacs.muter(d.id, fn, { initial: d });
    ctx._demo = { id: d.id, doc: r.doc, etag: r.etag, version: r.version };
    return r.resultat;
  } catch (e) {
    if (e instanceof DemoIntrouvable) {
      effacerCookiesDemo(ctx);
      ctx._demo = null;
      throw erreur(401, 'Cette démo a été effacée : ouvrez une nouvelle démonstration.', { code: 'demo' });
    }
    throw e;
  }
}

// Écriture d'un formulaire public : dans la démo existante, ou dans un nouveau jeu de
// démonstration enregistré seulement si la saisie est acceptée (un refus ne crée rien).
export async function ecrireSite(ctx, fn) {
  if (await demoCourante(ctx)) return muter(ctx, fn);
  const doc = await nouveauJeu(ctx);
  const m = { maintenant: ctx.maintenant, inchange() {}, remplacer() {} };
  const resultat = fn(doc, m);
  doc.updatedAt = iso(ctx.maintenant);
  await enregistrerNouvelle(ctx, doc);
  return resultat;
}

// ---------- Sessions ----------

export const ESPACES = ['crm', 'pro'];
export const REDIRECTIONS = { crm: '/crm', pro: '/espace-pro/accueil' };
export const estPersonnel = (u) => ROLES_PERSONNEL.includes(u?.role);

// Utilisateur valide pour un espace dans un document (personnel actif pour le CRM ; client pro actif
// d'un compte actif pour l'espace pro).
export function valablePour(doc, u, espace) {
  if (!u || !u.actif) return false;
  if (espace === 'crm') return estPersonnel(u);
  if (u.role !== 'pro') return false;
  const k = doc.comptes.find((x) => x.id === u.compteId);
  return !!k && k.statut === 'actif';
}

export function poserSession(ctx, espace, u, { resterConnecte = false } = {}) {
  const longue = espace === 'pro' && resterConnecte;
  const duree = longue ? DUREE_SESSION_LONGUE_S : DUREE_SESSION_S;
  const jeton = signer(USAGES[espace], { sb: ctx._demo.id, uid: u.id, v: u.sessionVersion || 0, exp: secondes(ctx) + duree });
  // personnel : 12 h ; pro : 30 jours avec « Rester connecté », sinon cookie de session (12 h au plus)
  ctx.poserCookie(`bl_${espace}`, jeton, espace === 'pro' && !longue ? {} : { maxAge: duree });
}

// Utilisateur de la session d'un espace, ou null (cookie effacé s'il n'est plus valable).
export async function sessionCourante(ctx, espace) {
  const nom = `bl_${espace}`;
  if (!ctx.cookies[nom]) return null;
  const charge = verifier(USAGES[espace], ctx.cookies[nom], ctx.maintenant.getTime());
  const d = await demoCourante(ctx);
  const u = charge && d && charge.sb === d.id ? d.doc.utilisateurs.find((x) => x.id === charge.uid) : null;
  if (!u || (u.sessionVersion || 0) !== charge.v || !valablePour(d.doc, u, espace)) {
    if (ctx.cookies[nom]) ctx.effacerCookie(nom);
    return null;
  }
  return u;
}

export async function exigerSession(ctx, espace) {
  const u = await sessionCourante(ctx, espace);
  if (!u) throw erreur(401, 'Session expirée : reconnectez-vous.', { code: 'session' });
  ctx.utilisateur = u;
  ctx.espace = espace;
  return u;
}

// L'utilisateur de la session dans le document d'une mutation (relu à chaque essai).
export function moiDans(doc, ctx) {
  const u = doc.utilisateurs.find((x) => x.id === ctx.utilisateur?.id);
  if (!u || (u.sessionVersion || 0) !== (ctx.utilisateur.sessionVersion || 0) || !valablePour(doc, u, ctx.espace)) {
    throw erreur(401, 'Session expirée : reconnectez-vous.', { code: 'session' });
  }
  return u;
}

// Utilisateur public (§ 7), avec ses droits pour le personnel.
export function vuePublique(doc, u) {
  return utilisateurPublic(u, estPersonnel(u) ? { droits: listeDroits(u.role) } : {});
}

export function compteDe(doc, u) {
  const k = u?.compteId ? doc.comptes.find((x) => x.id === u.compteId) : null;
  return k ? compteResume(k) : undefined;
}
