// Authentification (docs/crm-espace-pro.md, § 3 et § 6) :
// - secret de signature : SESSION_SECRET, obligatoire sur Vercel (sinon l'API refuse de tourner),
//   secret de développement fixe ailleurs ; une clé HMAC-SHA256 dérivée par usage (bl_demo, bl_crm,
//   bl_pro, lien de partage) : un jeton signé pour un usage n'est valable pour aucun autre ;
// - mots de passe : scrypt (N = 16384, r = 8, p = 1, sel de 16 octets), comparaison à temps constant ;
// - jetons d'invitation et de réinitialisation : 32 octets aléatoires, seul le haché SHA-256 est gardé ;
// - rôles du personnel et droits par rubrique (tableau du § 3), contrôlés à chaque appel ;
// - verrouillage : 5 échecs → 15 minutes ; limiteurs en mémoire par adresse IP.
import { createHash, createHmac, randomBytes, scrypt as scryptRappel, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ErreurConfiguration, erreur } from './http.js';

const scrypt = promisify(scryptRappel);

// ---------- Secret et signatures ----------

const SECRET_DEV = 'blachere-maquette-secret-de-developpement-ne-pas-utiliser-en-production';

export function secret(env = process.env) {
  const s = env.SESSION_SECRET;
  if (env.VERCEL) {
    if (!s || s.length < 32) throw new ErreurConfiguration('SESSION_SECRET absent ou trop court');
    return s;
  }
  return s || SECRET_DEV;
}

const cles = new Map();
function cle(usage) {
  const s = secret();
  const k = `${usage}\u0000${s}`;
  if (!cles.has(k)) {
    if (cles.size > 32) cles.clear();
    cles.set(k, createHmac('sha256', s).update(`blachere/cle/${usage}`).digest());
  }
  return cles.get(k);
}

export const USAGES = { demo: 'bl_demo', crm: 'bl_crm', pro: 'bl_pro', partage: 'partage' };

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const egalConstant = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

// Jeton signé : base64url(JSON) + « . » + base64url(HMAC(clé de l'usage, usage + « . » + charge)).
export function signer(usage, charge) {
  const corps = b64(JSON.stringify(charge));
  const sig = b64(createHmac('sha256', cle(usage)).update(`${usage}.${corps}`).digest());
  return `${corps}.${sig}`;
}

// Charge du jeton si la signature est bonne et `exp` (secondes) dans le futur, sinon null.
export function verifier(usage, jeton, maintenantMs = Date.now()) {
  if (typeof jeton !== 'string' || jeton.length > 1024) return null;
  const parties = jeton.split('.');
  if (parties.length !== 2 || !parties[0] || !parties[1]) return null;
  const attendue = b64(createHmac('sha256', cle(usage)).update(`${usage}.${parties[0]}`).digest());
  if (!egalConstant(attendue, parties[1])) return null;
  let charge;
  try {
    charge = JSON.parse(Buffer.from(parties[0], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!charge || typeof charge !== 'object' || typeof charge.exp !== 'number' || charge.exp * 1000 <= maintenantMs) return null;
  return charge;
}

// ---------- Mots de passe ----------

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const MOT_DE_PASSE_DEMO = 'Distillerie1835';

export async function hacherMotDePasse(motDePasse) {
  const sel = randomBytes(16);
  const h = await scrypt(motDePasse.normalize('NFC'), sel, 32, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${b64(sel)}$${b64(h)}`;
}

let factice = null;
// Vérifie un mot de passe ; sans haché (compte inconnu, invitation en cours), un calcul factice
// garde le même temps de réponse.
export async function verifierMotDePasse(motDePasse, stocke) {
  const m = typeof stocke === 'string' ? stocke.match(/^scrypt\$(\d+)\$(\d+)\$(\d+)\$([\w-]+)\$([\w-]+)$/) : null;
  if (!m) {
    factice ||= await hacherMotDePasse('factice-pour-temps-constant');
    await verifierMotDePasse(String(motDePasse || ''), factice);
    return false;
  }
  const [, N, r, p, sel, h] = m;
  const attendu = Buffer.from(h, 'base64url');
  const calcule = await scrypt(String(motDePasse).normalize('NFC'), Buffer.from(sel, 'base64url'), attendu.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return calcule.length === attendu.length && timingSafeEqual(calcule, attendu);
}

// Haché du mot de passe commun des comptes de démonstration : calculé une fois par processus (le
// même sel pour tous ces comptes, dont le mot de passe est de toute façon affiché en démo).
let hacheDemo = null;
export function hacheMotDePasseDemo() {
  hacheDemo ||= hacherMotDePasse(MOT_DE_PASSE_DEMO);
  return hacheDemo;
}

// ---------- Jetons à usage unique ----------

export const hacherJeton = (jeton) => createHash('sha256').update(String(jeton)).digest('hex');

export function nouveauJeton() {
  const jeton = randomBytes(32).toString('base64url');
  return { jeton, hache: hacherJeton(jeton) };
}

export const jetonValide = (jeton) => typeof jeton === 'string' && /^[\w-]{43}$/.test(jeton);
export const memeHache = (a, b) => typeof a === 'string' && typeof b === 'string' && egalConstant(a, b);

export const DUREE_INVITATION_MS = 7 * 86400000;
export const DUREE_REINITIALISATION_MS = 3600000;

// ---------- Rôles et droits ----------

export const ROLES_PERSONNEL = ['direction', 'commercial', 'logistique', 'boutique'];
export const NOMS_ROLES = { direction: 'Direction', commercial: 'Commercial', logistique: 'Logistique', boutique: 'Boutique et visites', pro: 'Client professionnel' };

// Rubriques du CRM (tableau du § 3). « commandes » = commandes en ligne et par téléphone (clients
// particuliers) ; « commandes-pro » = commandes des comptes pro ; « factures » à part (la logistique
// gère les commandes pro sans voir les factures) ; « comptes » couvre aussi les demandes pro ;
// « newsletter » couvre aussi les codes promo.
export const RUBRIQUES = [
  'tableau',
  'commandes',
  'commandes-pro',
  'factures',
  'clients',
  'comptes',
  'produits',
  'stocks',
  'visites',
  'messages',
  'newsletter',
  'courriels',
  'journal',
  'equipe',
  'parametres',
  'exports',
];
const E = 'ecriture';
const L = 'lecture';
const TOUT = Object.fromEntries(RUBRIQUES.map((r) => [r, E]));
export const DROITS = {
  direction: TOUT,
  commercial: { tableau: E, commandes: L, 'commandes-pro': E, factures: E, clients: L, comptes: E, produits: L, stocks: L, visites: L, messages: E, newsletter: E, courriels: E, journal: E, exports: E },
  logistique: { tableau: E, commandes: E, 'commandes-pro': E, clients: L, comptes: L, produits: L, stocks: E, courriels: E, journal: E, exports: E },
  boutique: { tableau: E, commandes: E, 'commandes-pro': L, factures: L, clients: E, produits: L, stocks: L, visites: E, messages: E, newsletter: L, courriels: E, journal: E, exports: E },
};

const LIBELLES_RUBRIQUES = {
  tableau: 'le tableau de bord',
  commandes: 'les commandes des particuliers',
  'commandes-pro': 'les commandes pro',
  factures: 'les factures',
  clients: 'les clients particuliers',
  comptes: 'les comptes et demandes pro',
  produits: 'les produits et les prix',
  stocks: 'les stocks',
  visites: 'les visites',
  messages: 'les messages',
  newsletter: 'la newsletter et les codes promo',
  courriels: 'les courriels envoyés',
  journal: 'le journal',
  equipe: 'l’équipe',
  parametres: 'les paramètres',
  exports: 'les exports',
};

// Droit d'un rôle sur une rubrique : 'ecriture', 'lecture' ou null.
export const droitSur = (role, rubrique) => DROITS[role]?.[rubrique] || null;
export const peutLire = (role, rubrique) => !!droitSur(role, rubrique);
export const peutEcrire = (role, rubrique) => droitSur(role, rubrique) === E;

// Liste exposée à l'interface : « rubrique » (lecture et écriture) ou « rubrique:lecture ».
export const listeDroits = (role) =>
  RUBRIQUES.filter((r) => droitSur(role, r)).map((r) => (droitSur(role, r) === E ? r : `${r}:lecture`));

export function exiger(utilisateur, rubrique, mode = 'lecture') {
  const ok = mode === 'ecriture' ? peutEcrire(utilisateur.role, rubrique) : peutLire(utilisateur.role, rubrique);
  if (!ok) {
    const verbe = mode === 'ecriture' ? 'de modifier' : 'd’ouvrir';
    throw erreur(403, `Votre profil (${NOMS_ROLES[utilisateur.role] || utilisateur.role}) ne permet pas ${verbe} ${LIBELLES_RUBRIQUES[rubrique]}.`, { code: 'droit' });
  }
}

// ---------- Verrouillage après échecs ----------

export const ECHECS_MAX = 5;
export const DUREE_VERROU_MS = 15 * 60000;

export function verrouJusqua(utilisateur, maintenantMs) {
  const j = utilisateur.echecs?.jusqua ? Date.parse(utilisateur.echecs.jusqua) : 0;
  return j > maintenantMs ? j : 0;
}

// Échec de connexion (dans une mutation du document) : rend true si le compte vient d'être verrouillé.
export function noterEchec(utilisateur, maintenantMs) {
  const e = utilisateur.echecs || { n: 0 };
  if (e.jusqua && Date.parse(e.jusqua) <= maintenantMs) {
    e.n = 0;
    delete e.jusqua;
  }
  e.n = (e.n || 0) + 1;
  let verrouille = false;
  if (e.n >= ECHECS_MAX) {
    e.jusqua = new Date(maintenantMs + DUREE_VERROU_MS).toISOString().replace(/\.\d{3}Z$/, 'Z');
    e.n = 0;
    verrouille = true;
  }
  utilisateur.echecs = e;
  return verrouille;
}

export function erreurVerrou(jusquaMs, maintenantMs) {
  const minutes = Math.max(1, Math.ceil((jusquaMs - maintenantMs) / 60000));
  return erreur(423, `Compte verrouillé après plusieurs essais : réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`, {
    code: 'verrouille',
    reessayerDans: minutes * 60,
  });
}

// Limiteurs en mémoire : voir limiteur.js.
export { depasse, LIMITES, limiter, reinitialiserLimiteurs } from './limiteur.js';
