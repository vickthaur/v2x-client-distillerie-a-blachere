// Validation stricte des saisies (docs/crm-espace-pro.md, § 6) : types, longueurs, listes fermées,
// e-mail, code postal, téléphone, SIRET (14 chiffres), quantités (1 à 999). Les champs inconnus sont
// ignorés (on ne lit que ceux qu'on attend) ; les textes sont nettoyés (Unicode NFC, caractères de
// contrôle retirés, espaces réduits). Une erreur → 400 { erreur, champ }.
import { erreur } from './http.js';
import { estJour, estMois } from './temps.js';

const invalide = (champ, message) => erreur(400, message, { champ, code: 'saisie' });
const absent = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

// Texte nettoyé : NFC, sans caractères de contrôle (retours à la ligne gardés si multiligne),
// espaces réduits, bornes retirées.
export function nettoyer(v, { multiligne = false } = {}) {
  let s = String(v).normalize('NFC');
  if (multiligne) {
    s = s
      .replace(/\r\n?/g, '\n')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '')
      .replace(/[ \t ]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n');
  } else {
    s = s
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, ' ')
      .replace(/\s+/g, ' ');
  }
  return s.trim();
}

export function texte(corps, champ, { requis = false, min = 1, max = 200, multiligne = false, libelle = champ } = {}) {
  const v = corps?.[champ];
  if (absent(v)) {
    if (requis) throw invalide(champ, `${libelle} : champ obligatoire.`);
    return undefined;
  }
  if (typeof v !== 'string' && typeof v !== 'number') throw invalide(champ, `${libelle} : texte attendu.`);
  const s = nettoyer(v, { multiligne });
  if (s.length < min) throw invalide(champ, `${libelle} : ${min} caractères au moins.`);
  if (s.length > max) throw invalide(champ, `${libelle} : ${max} caractères au plus.`);
  return s;
}

const RE_EMAIL = /^[^\s@<>()[\]\\,;:"]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,24}$/;
export const estEmail = (s) => typeof s === 'string' && s.length <= 254 && RE_EMAIL.test(s);

export function email(corps, champ = 'email', { requis = false, libelle = 'E-mail' } = {}) {
  const s = texte(corps, champ, { requis, max: 254, libelle });
  if (s === undefined) return undefined;
  const e = s.toLowerCase();
  if (!estEmail(e)) throw invalide(champ, `${libelle} : adresse invalide.`);
  return e;
}

// Téléphone : numéro français (10 chiffres, ou +33) remis au format « 04 90 83 55 65 », ou numéro
// international (+ et 8 à 15 chiffres).
export function normaliserTelephone(s) {
  const brut = String(s).replace(/[\s.\-()]/g, '');
  let m = brut.match(/^(?:\+33|0033)([1-9]\d{8})$/) || brut.match(/^0([1-9]\d{8})$/);
  if (m) return `0${m[1]}`.replace(/(\d{2})(?=\d)/g, '$1 ');
  m = brut.match(/^\+(\d{8,15})$/);
  if (m) return `+${m[1]}`;
  return null;
}

export function telephone(corps, champ = 'telephone', { requis = false, libelle = 'Téléphone' } = {}) {
  const s = texte(corps, champ, { requis, max: 30, libelle });
  if (s === undefined) return undefined;
  const t = normaliserTelephone(s);
  if (!t) throw invalide(champ, `${libelle} : numéro invalide.`);
  return t;
}

// Code postal français (5 chiffres).
export function codePostal(corps, champ = 'cp', { requis = false, libelle = 'Code postal' } = {}) {
  const s = texte(corps, champ, { requis, max: 10, libelle });
  if (s === undefined) return undefined;
  const c = s.replace(/\s/g, '');
  if (!/^\d{5}$/.test(c) || c.startsWith('00')) throw invalide(champ, `${libelle} : 5 chiffres attendus.`);
  return c;
}
// France métropolitaine (Corse comprise) : pas d'envoi outre-mer ni à Monaco dans la démo.
export const estMetropole = (cp) => /^\d{5}$/.test(cp) && !/^(97|98|99|00)/.test(cp);

export function siret(corps, champ = 'siret', { requis = false, libelle = 'SIRET' } = {}) {
  const s = texte(corps, champ, { requis, max: 30, libelle });
  if (s === undefined) return undefined;
  const c = s.replace(/[\s.]/g, '');
  if (!/^\d{14}$/.test(c)) throw invalide(champ, `${libelle} : 14 chiffres attendus.`);
  return c;
}

export function tvaIntra(corps, champ = 'tvaIntra', { requis = false, libelle = 'N° de TVA intracommunautaire' } = {}) {
  const s = texte(corps, champ, { requis, max: 20, libelle });
  if (s === undefined) return undefined;
  const c = s.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9A-Z]{8,12}$/.test(c)) throw invalide(champ, `${libelle} : format invalide.`);
  return c;
}

export function entier(corps, champ, { requis = false, min = 0, max = 999, libelle = champ, defaut } = {}) {
  const v = corps?.[champ];
  if (absent(v)) {
    if (requis) throw invalide(champ, `${libelle} : champ obligatoire.`);
    return defaut;
  }
  const n = typeof v === 'string' && /^-?\d+$/.test(v.trim()) ? Number(v) : v;
  if (!Number.isInteger(n)) throw invalide(champ, `${libelle} : nombre entier attendu.`);
  if (n < min || n > max) throw invalide(champ, `${libelle} : entre ${min} et ${max}.`);
  return n;
}

// Montant ou nombre décimal (2 décimales au plus).
export function nombre(corps, champ, { requis = false, min = 0, max = 100000, libelle = champ, defaut } = {}) {
  const v = corps?.[champ];
  if (absent(v)) {
    if (requis) throw invalide(champ, `${libelle} : champ obligatoire.`);
    return defaut;
  }
  const n = typeof v === 'string' && /^-?\d+([.,]\d+)?$/.test(v.trim()) ? Number(v.replace(',', '.')) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw invalide(champ, `${libelle} : nombre attendu.`);
  if (Math.abs(Math.round(n * 100) - n * 100) > 1e-6) throw invalide(champ, `${libelle} : deux décimales au plus.`);
  if (n < min || n > max) throw invalide(champ, `${libelle} : entre ${min} et ${max}.`);
  return Math.round(n * 100) / 100;
}

export function booleen(corps, champ, { requis = false, libelle = champ, defaut } = {}) {
  const v = corps?.[champ];
  if (v === undefined || v === null) {
    if (requis) throw invalide(champ, `${libelle} : champ obligatoire.`);
    return defaut;
  }
  if (typeof v !== 'boolean') throw invalide(champ, `${libelle} : vrai ou faux attendu.`);
  return v;
}

// Case à cocher obligatoire (CGV, consentement).
export function vrai(corps, champ, message) {
  if (corps?.[champ] !== true) throw invalide(champ, message);
  return true;
}

export function choix(corps, champ, valeurs, { requis = false, libelle = champ, defaut } = {}) {
  const v = corps?.[champ];
  if (absent(v)) {
    if (requis) throw invalide(champ, `${libelle} : champ obligatoire.`);
    return defaut;
  }
  if (typeof v !== 'string' || !valeurs.includes(v)) throw invalide(champ, `${libelle} : valeur non reconnue.`);
  return v;
}

export function jour(corps, champ, { requis = false, libelle = 'Date' } = {}) {
  const v = corps?.[champ];
  if (absent(v)) {
    if (requis) throw invalide(champ, `${libelle} : champ obligatoire.`);
    return undefined;
  }
  if (!estJour(v)) throw invalide(champ, `${libelle} : date invalide (AAAA-MM-JJ).`);
  return v;
}

export function objet(corps, champ, { requis = false, libelle = champ } = {}) {
  const v = corps?.[champ];
  if (v === undefined || v === null) {
    if (requis) throw invalide(champ, `${libelle} : champ obligatoire.`);
    return undefined;
  }
  if (typeof v !== 'object' || Array.isArray(v)) throw invalide(champ, `${libelle} : objet attendu.`);
  return v;
}

export function liste(corps, champ, { requis = false, min = 0, max = 100, libelle = champ } = {}) {
  const v = corps?.[champ];
  if (v === undefined || v === null) {
    if (requis) throw invalide(champ, `${libelle} : champ obligatoire.`);
    return undefined;
  }
  if (!Array.isArray(v)) throw invalide(champ, `${libelle} : liste attendue.`);
  if (v.length < min) throw invalide(champ, min === 1 ? `${libelle} : la liste est vide.` : `${libelle} : ${min} éléments au moins.`);
  if (v.length > max) throw invalide(champ, `${libelle} : ${max} éléments au plus.`);
  return v;
}

// Liste d'étiquettes : textes courts, sans doublon.
export function etiquettes(corps, champ = 'tags', { max = 12 } = {}) {
  const l = liste(corps, champ, { max, libelle: 'Étiquettes' });
  if (l === undefined) return undefined;
  const out = [];
  for (const t of l) {
    if (typeof t !== 'string') throw invalide(champ, 'Étiquettes : textes attendus.');
    const s = nettoyer(t).slice(0, 30);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

// Mot de passe : 10 caractères au moins (docs, § 3), 200 au plus.
export function motDePasse(corps, champ = 'motDePasse', { libelle = 'Mot de passe', controleLongueur = true } = {}) {
  const v = corps?.[champ];
  if (typeof v !== 'string' || !v) throw invalide(champ, `${libelle} : champ obligatoire.`);
  if (v.length > 200) throw invalide(champ, `${libelle} : 200 caractères au plus.`);
  if (controleLongueur && [...v].length < 10) throw invalide(champ, `${libelle} : 10 caractères au moins.`);
  return v;
}

// Adresse postale (France).
export function adresse(corps, champ, { requis = false, libelle = 'Adresse' } = {}) {
  const a = objet(corps, champ, { requis, libelle });
  if (a === undefined) return undefined;
  const out = {
    nom: texte(a, 'nom', { max: 80, libelle: 'Nom (adresse)' }),
    ligne1: texte(a, 'ligne1', { requis: true, max: 120, libelle: 'Adresse' }),
    ligne2: texte(a, 'ligne2', { max: 120, libelle: 'Complément d’adresse' }),
    cp: codePostal(a, 'cp', { requis: true }),
    ville: texte(a, 'ville', { requis: true, max: 80, libelle: 'Ville' }),
    pays: 'France',
    instructions: texte(a, 'instructions', { max: 200, multiligne: true, libelle: 'Instructions de livraison' }),
  };
  return sansVide(out);
}

// Lignes de commande : [{ slug, varianteId, qte }] (quantités 1 à 999, lignes identiques fusionnées).
export function lignes(corps, champ = 'lignes', { max = 60 } = {}) {
  const l = liste(corps, champ, { requis: true, min: 1, max, libelle: 'Panier' });
  const fusion = new Map();
  for (const x of l) {
    if (!x || typeof x !== 'object') throw invalide(champ, 'Panier : ligne invalide.');
    const slug = typeof x.slug === 'string' && /^[a-z0-9-]{1,80}$/.test(x.slug) ? x.slug : null;
    const varianteId = typeof x.varianteId === 'string' && /^[a-z0-9-]{1,20}$/.test(x.varianteId) ? x.varianteId : typeof x.varianteId === 'number' ? String(x.varianteId) : null;
    if (!slug || !varianteId) throw invalide(champ, 'Panier : produit inconnu.');
    const qte = entier(x, 'qte', { requis: true, min: 1, max: 999, libelle: 'Quantité' });
    const cle = `${slug}|${varianteId}`;
    const avant = fusion.get(cle);
    if (avant) {
      avant.qte += qte;
      if (avant.qte > 999) throw invalide(champ, 'Quantité : 999 au plus par produit.');
    } else fusion.set(cle, { slug, varianteId, qte });
  }
  return [...fusion.values()];
}

// Identifiant d'élément (préfixe + 12 caractères base32), en paramètre ou dans le corps.
export function identifiant(v, prefixe, { champ = 'id' } = {}) {
  if (typeof v !== 'string' || !new RegExp(`^${prefixe}_[a-z2-7]{12}$`).test(v)) throw erreur(404, 'Élément introuvable.', { champ });
  return v;
}

export const mois = (v) => (estMois(v) ? v : null);

// Retire les clés indéfinies (documents compacts).
export function sansVide(o) {
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
  return o;
}
