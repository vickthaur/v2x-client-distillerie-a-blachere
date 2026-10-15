// Requêtes et réponses de l'API (fonctions Vercel : gestionnaires Web Request → Response).
// - Écritures (POST, PATCH, DELETE) : Content-Type JSON, en-tête X-Blachere: 1, Origin (s'il est
//   présent) égal à l'hôte, corps ≤ 64 Ko (docs/crm-espace-pro.md, § 6). Pas de CORS.
// - Réponses JSON avec Cache-Control: no-store et X-Content-Type-Options: nosniff.
// - Erreurs : { erreur, champ?, code? } ; erreur imprévue → 500 { erreur, reference } (la référence
//   est la seule chose écrite dans les journaux de la plateforme, avec la pile d'appels : jamais de
//   donnée personnelle dans console.*).
import { randomBytes } from 'node:crypto';
import { typo } from './typo.js';
import { maintenant } from './temps.js';
import { LIMITES, limiter } from './limiteur.js';

export const TAILLE_MAX_CORPS = 64 * 1024;

export class ErreurHttp extends Error {
  constructor(status, message, extra = {}) {
    super(typo(message));
    this.name = 'ErreurHttp';
    this.status = status;
    this.extra = extra;
  }
}
export const erreur = (status, message, extra) => new ErreurHttp(status, message, extra);
export const introuvable = (message = 'Élément introuvable.') => new ErreurHttp(404, message);

// Secret absent sur Vercel, etc. : l'API refuse de fonctionner plutôt que de tourner sans protection.
export class ErreurConfiguration extends Error {
  constructor(message) {
    super(message);
    this.name = 'ErreurConfiguration';
  }
}

const ENTETES = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

export function reponseJson(status, corps, { cookies = [], entetes = {} } = {}) {
  const h = new Headers({ 'Content-Type': 'application/json; charset=utf-8', ...ENTETES, ...entetes });
  for (const c of cookies) h.append('Set-Cookie', c);
  return new Response(status === 204 ? null : JSON.stringify(corps), { status, headers: h });
}

// Réponse d'un gestionnaire avec un autre statut que 200 (201 à la création, 204…).
const STATUT = Symbol('statut');
export const avecStatut = (status, corps) => ({ [STATUT]: status, corps });

// ---------- Cookies ----------

export function lireCookies(req) {
  const out = {};
  for (const part of (req.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k || Object.hasOwn(out, k)) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

// HttpOnly; SameSite=Lax; Path=/ ; Secure quand la requête est en HTTPS (pas sur http://localhost).
export function cookie(nom, valeur, { maxAge, httpOnly = true, secure = false } = {}) {
  let s = `${nom}=${encodeURIComponent(valeur)}; Path=/; SameSite=Lax`;
  if (maxAge !== undefined) s += `; Max-Age=${maxAge}`;
  if (maxAge === 0) s += '; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  if (httpOnly) s += '; HttpOnly';
  if (secure) s += '; Secure';
  return s;
}

export function estHttps(req) {
  try {
    if (new URL(req.url).protocol === 'https:') return true;
  } catch {
    // adresse illisible : traitée comme du HTTP
  }
  return (req.headers.get('x-forwarded-proto') || '').split(',')[0].trim() === 'https';
}

// Adresse IP du client (Vercel renseigne x-forwarded-for ; en local, « locale »).
export function adresseIp(req) {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim().slice(0, 64);
  return (req.headers.get('x-real-ip') || 'locale').slice(0, 64);
}

// ---------- Contrôle des écritures ----------

function hotesAcceptes(req) {
  const hotes = new Set();
  try {
    hotes.add(new URL(req.url).host);
  } catch {
    // ignoré
  }
  for (const nom of ['host', 'x-forwarded-host']) {
    const v = req.headers.get(nom);
    if (v) hotes.add(v.split(',')[0].trim());
  }
  return hotes;
}

export function controlerEcriture(req) {
  const type = (req.headers.get('content-type') || '').toLowerCase();
  if (!/^application\/json\s*(;|$)/.test(type)) throw erreur(415, 'Format de requête non pris en charge (JSON attendu).', { code: 'format' });
  if (req.headers.get('x-blachere') !== '1') throw erreur(403, 'Requête refusée : en-tête de sécurité manquant.', { code: 'csrf' });
  const origine = req.headers.get('origin');
  if (origine !== null) {
    let hote = null;
    try {
      hote = new URL(origine).host;
    } catch {
      hote = null;
    }
    if (!hote || !hotesAcceptes(req).has(hote)) throw erreur(403, 'Requête refusée : origine non autorisée.', { code: 'origine' });
  }
}

export async function lireCorpsJson(req) {
  const annonce = Number(req.headers.get('content-length') || 0);
  if (annonce > TAILLE_MAX_CORPS) throw erreur(413, 'Requête trop volumineuse (64 Ko au plus).', { code: 'taille' });
  if (!req.body) return {};
  const lecteur = req.body.getReader();
  const morceaux = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.byteLength;
    if (total > TAILLE_MAX_CORPS) {
      lecteur.cancel().catch(() => {});
      throw erreur(413, 'Requête trop volumineuse (64 Ko au plus).', { code: 'taille' });
    }
    morceaux.push(value);
  }
  if (!total) return {};
  let texte;
  try {
    texte = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(morceaux));
  } catch {
    throw erreur(400, 'Requête illisible (UTF-8 attendu).', { code: 'format' });
  }
  if (!texte.trim()) return {};
  let corps;
  try {
    corps = JSON.parse(texte);
  } catch {
    throw erreur(400, 'Requête illisible (JSON attendu).', { code: 'format' });
  }
  if (corps === null || typeof corps !== 'object' || Array.isArray(corps)) throw erreur(400, 'Requête invalide (objet JSON attendu).', { code: 'format' });
  return corps;
}

// ---------- Contexte d'un appel ----------

export class Contexte {
  constructor(req, url, methode) {
    this.req = req;
    this.url = url;
    this.methode = methode;
    this.ressource = url.searchParams.get('r') || '';
    this.corps = {};
    this.cookies = lireCookies(req);
    this.secure = estHttps(req);
    this.ip = adresseIp(req);
    this.maintenant = maintenant();
    this.aPoser = [];
  }

  // Paramètre d'adresse (texte nettoyé, borné).
  param(nom, max = 200) {
    const v = this.url.searchParams.get(nom);
    if (v === null) return null;
    // eslint-disable-next-line no-control-regex
    return v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  }

  poserCookie(nom, valeur, options = {}) {
    // un seul Set-Cookie par nom : le dernier l'emporte
    this.aPoser = this.aPoser.filter((c) => !c.startsWith(`${nom}=`));
    this.aPoser.push(cookie(nom, valeur, { secure: this.secure, ...options }));
  }

  effacerCookie(nom, { httpOnly = true } = {}) {
    this.poserCookie(nom, '', { maxAge: 0, httpOnly });
  }

  // Origine publique (liens absolus : partage de démo).
  get origine() {
    const proto = this.secure ? 'https' : 'http';
    const hote = this.req.headers.get('x-forwarded-host')?.split(',')[0].trim() || this.req.headers.get('host') || this.url.host;
    return `${proto}://${hote}`;
  }
}

export const nouvelleReference = () => randomBytes(5).toString('hex').toUpperCase();

function journaliserErreur(e, ctx) {
  const reference = nouvelleReference();
  // Seulement le type d'erreur et la pile d'appels (sans le message, qui pourrait citer une saisie).
  const pile = String(e?.stack || '')
    .split('\n')
    .filter((l) => /^\s+at /.test(l))
    .slice(0, 8)
    .join('\n');
  console.error(`[api] erreur interne ${reference} (${ctx?.methode || '?'} r=${ctx?.ressource || '?'}) ${e?.name || 'Error'}${e?.code ? ` ${e.code}` : ''}\n${pile}`);
  return reference;
}

export function reponseErreur(e, ctx) {
  const cookies = ctx?.aPoser || [];
  if (e instanceof ErreurHttp) {
    const corps = { erreur: e.message, ...e.extra };
    const entetes = {};
    if (e.extra?.reessayerDans) entetes['Retry-After'] = String(e.extra.reessayerDans);
    return reponseJson(e.status, corps, { cookies, entetes });
  }
  if (e instanceof ErreurConfiguration) {
    const reference = journaliserErreur(e, ctx);
    return reponseJson(500, { erreur: typo('Configuration du serveur incomplète : l’API est désactivée.'), code: 'configuration', reference }, { cookies });
  }
  const reference = journaliserErreur(e, ctx);
  return reponseJson(500, { erreur: 'Une erreur interne est survenue. Réessayez dans un instant.', reference }, { cookies });
}

const METHODES = ['GET', 'POST', 'PATCH', 'DELETE'];

// Fonction Vercel : { GET: { ressource: gestionnaire }, POST: {…}, … } → exports par méthode.
// Un gestionnaire reçoit le Contexte (corps déjà lu et contrôlé pour une écriture) et rend un objet
// (200 JSON), avecStatut(201, objet) ou une Response (CSV, redirection).
export function fonction(routes) {
  const connues = new Map();
  for (const m of METHODES) for (const r of Object.keys(routes[m] || {})) connues.set(r, [...(connues.get(r) || []), m]);

  const traiter = (methode) => async (req) => {
    let url;
    try {
      url = new URL(req.url);
    } catch {
      return reponseJson(400, { erreur: 'Adresse invalide.' });
    }
    const ctx = new Contexte(req, url, methode);
    const table = routes[methode] || {};
    const gestionnaire = Object.hasOwn(table, ctx.ressource) ? table[ctx.ressource] : null;
    if (!gestionnaire) {
      if (connues.has(ctx.ressource)) {
        return reponseJson(405, { erreur: 'Méthode non prise en charge pour cette ressource.', code: 'methode' }, { entetes: { Allow: connues.get(ctx.ressource).join(', ') } });
      }
      return reponseJson(404, { erreur: 'Ressource inconnue.', code: 'ressource' });
    }
    try {
      if (methode !== 'GET') {
        controlerEcriture(req);
        if (!limiter(`ecritures:${ctx.ip}`, LIMITES.ecritures.max, LIMITES.ecritures.fenetre, ctx.maintenant.getTime())) {
          throw erreur(429, 'Trop de requêtes : réessayez dans un instant.', { code: 'limite', reessayerDans: 60 });
        }
        ctx.corps = await lireCorpsJson(req);
      }
      const resultat = await gestionnaire(ctx);
      if (resultat instanceof Response) {
        for (const c of ctx.aPoser) resultat.headers.append('Set-Cookie', c);
        return resultat;
      }
      if (resultat && Object.hasOwn(resultat, STATUT)) return reponseJson(resultat[STATUT], resultat.corps, { cookies: ctx.aPoser });
      return reponseJson(200, resultat ?? { ok: true }, { cookies: ctx.aPoser });
    } catch (e) {
      return reponseErreur(e, ctx);
    }
  };

  const nonPrisEnCharge = async () =>
    reponseJson(405, { erreur: 'Méthode non prise en charge.', code: 'methode' }, { entetes: { Allow: METHODES.filter((m) => routes[m]).join(', ') } });

  return {
    GET: traiter('GET'),
    POST: traiter('POST'),
    PATCH: traiter('PATCH'),
    DELETE: traiter('DELETE'),
    HEAD: nonPrisEnCharge,
    PUT: nonPrisEnCharge,
    OPTIONS: nonPrisEnCharge,
  };
}

// Redirection (302) sans cache.
export function redirection(vers) {
  return new Response(null, { status: 302, headers: { Location: vers, 'Cache-Control': 'no-store' } });
}

// Pagination ?page=1&par=25 → { elements, total, page, pages }.
export function paginer(liste, ctx, { parDefaut = 25, max = 100 } = {}) {
  const par = Math.min(max, Math.max(1, Number.parseInt(ctx.param('par') || parDefaut, 10) || parDefaut));
  const total = liste.length;
  const pages = Math.max(1, Math.ceil(total / par));
  const page = Math.min(pages, Math.max(1, Number.parseInt(ctx.param('page') || '1', 10) || 1));
  return { elements: liste.slice((page - 1) * par, page * par), total, page, pages };
}

// Tri ?tri=date|-date|total… : cles = { date: (x) => …, total: (x) => … }.
export function trier(liste, tri, cles, parDefaut) {
  const t = tri && cles[tri.replace(/^-/, '')] ? tri : parDefaut;
  const desc = t.startsWith('-');
  const cle = cles[t.replace(/^-/, '')];
  return [...liste].sort((a, b) => {
    const x = cle(a);
    const y = cle(b);
    const c = typeof x === 'string' || typeof y === 'string' ? String(x ?? '').localeCompare(String(y ?? ''), 'fr') : (x ?? 0) - (y ?? 0);
    return desc ? -c : c;
  });
}
