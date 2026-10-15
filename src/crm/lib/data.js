// Accès aux données du CRM : appels à api/crm (session expirée → retour à la connexion),
// cache par clé, rechargement silencieux quand la démo change (sondage des notifications) et
// mises à jour optimistes.
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { dateLongue } from './format.js';
import { api, apiUrl, ApiError } from '../../lib/api.js';

export { ApiError, apiUrl };

let surExpiration = null;
export const quandSessionExpire = (fn) => {
  surExpiration = fn;
};

// Appel à api/crm ; un 401 signale la fin de session à l'application.
export async function crm(r, options = {}) {
  try {
    return await api('crm', r, options);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) surExpiration?.(e);
    // dates ISO des messages du serveur (« le 2026-10-16 ») écrites à la française
    if (e instanceof ApiError && /\d{4}-\d{2}-\d{2}/.test(e.message)) e.message = e.message.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (m) => dateLongue(m));
    throw e;
  }
}
export const session = (r, options) => api('session', r, options);
export const crmUrl = (r, query) => apiUrl('crm', r, query);

// Éléments d'une réponse de liste, quelle que soit sa forme ({ elements }, tableau, { cle: [] })
export function elements(data, ...cles) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.elements)) return data.elements;
  for (const c of cles) if (Array.isArray(data[c])) return data[c];
  return [];
}

// ---------- Cache et ressources ----------
const cache = new Map();
const montees = new Set();

/**
 * Ressource chargée depuis l'API.
 * @param {string|null} cle  clé de cache (null : rien à charger)
 * @param {(signal: AbortSignal) => Promise<any>} charger
 * @param {{ garder?: boolean }} options  garder : conserver l'affichage précédent pendant le
 *   chargement d'une nouvelle clé (filtres d'une liste), sans squelette ni saut de mise en page
 */
export function useResource(cle, charger, { garder = false } = {}) {
  const enCache = cle ? cache.get(cle) : undefined;
  const [etat, setEtat] = useState(() => ({
    data: enCache?.data,
    error: null,
    loading: !!cle && !enCache,
    refreshing: false,
  }));
  const chargerRef = useRef(charger);
  chargerRef.current = charger;
  const cleRef = useRef(cle);
  cleRef.current = cle;
  const ctrl = useRef(null);

  const recharger = useCallback(async ({ silencieux = false } = {}) => {
    const k = cleRef.current;
    if (!k) return undefined;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setEtat((s) => ({ ...s, refreshing: s.data !== undefined, loading: s.data === undefined, error: silencieux ? s.error : null }));
    try {
      const data = await chargerRef.current(c.signal);
      if (c.signal.aborted || cleRef.current !== k) return undefined;
      cache.set(k, { data, t: Date.now() });
      setEtat({ data, error: null, loading: false, refreshing: false });
      return data;
    } catch (e) {
      if (e?.name === 'AbortError' || c.signal.aborted) return undefined;
      setEtat((s) => ({ ...s, error: silencieux && s.data !== undefined ? s.error : e, loading: false, refreshing: false }));
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (!cle) {
      setEtat({ data: undefined, error: null, loading: false, refreshing: false });
      return undefined;
    }
    const c = cache.get(cle);
    setEtat((s) => {
      if (c) return { data: c.data, error: null, loading: false, refreshing: true };
      if (garder && s.data !== undefined) return { ...s, error: null, loading: false, refreshing: true };
      return { data: undefined, error: null, loading: true, refreshing: false };
    });
    recharger({ silencieux: !!c });
    const entree = { cle, recharger };
    montees.add(entree);
    return () => {
      montees.delete(entree);
      ctrl.current?.abort();
    };
  }, [cle]);

  const mutate = useCallback((maj) => {
    setEtat((s) => {
      const data = typeof maj === 'function' ? maj(s.data) : maj;
      if (cleRef.current) cache.set(cleRef.current, { data, t: Date.now() });
      return { ...s, data };
    });
  }, []);

  return { ...etat, reload: recharger, mutate };
}

// Toutes les ressources affichées se rechargent sans squelette (la démo a changé).
export function toutRecharger() {
  for (const m of montees) m.recharger({ silencieux: true });
}
// Oublie les ressources dont la clé commence par l'un des préfixes et recharge celles affichées.
export function invalider(...prefixes) {
  const vise = (k) => prefixes.some((p) => k === p || k.startsWith(`${p}?`) || k.startsWith(`${p}:`) || k.startsWith(p));
  for (const k of [...cache.keys()]) if (vise(k)) cache.delete(k);
  for (const m of montees) if (vise(m.cle)) m.recharger({ silencieux: true });
}
export function viderCache() {
  cache.clear();
}

// Clé stable d'une requête : « commandes?canal=pro&statut=nouvelle »
export function cleDe(r, query = {}) {
  const p = new URLSearchParams();
  for (const k of Object.keys(query).sort()) {
    const v = query[k];
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `${r}?${s}` : r;
}

// Ressource d'api/crm par nom et paramètres
export function useCrm(r, query = {}, options = {}) {
  const cle = r ? cleDe(r, query) : null;
  return useResource(cle, (signal) => crm(r, { query, signal }), options);
}

// Action asynchrone avec état « en cours » (boutons) et erreurs gardées pour le formulaire
export function useAction(fn) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const lancer = useCallback(async (...args) => {
    setEnCours(true);
    setErreur(null);
    try {
      return await fnRef.current(...args);
    } catch (e) {
      setErreur(e);
      throw e;
    } finally {
      setEnCours(false);
    }
  }, []);
  return { lancer, enCours, erreur, setErreur };
}

// Téléchargement d'un fichier produit par l'API (export RGPD, CSV) sans quitter la page
export async function telecharger(url, nomParDefaut) {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) {
    let msg = 'Le téléchargement a échoué.';
    try {
      msg = (await res.json()).erreur || msg;
    } catch {
      /* corps non JSON */
    }
    if (res.status === 401) surExpiration?.(new ApiError(msg, 401));
    throw new ApiError(msg, res.status);
  }
  const dispo = res.headers.get('content-disposition') || '';
  const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(dispo);
  const nom = m ? decodeURIComponent(m[1] || m[2]) : nomParDefaut;
  const blob = await res.blob();
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(blob);
  lien.download = nom;
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 4000);
  return nom;
}

// Applique fn à chaque élément d'une réponse de liste, quelle que soit sa forme
export function mapElements(data, fn, ...cles) {
  if (!data) return data;
  if (Array.isArray(data)) return data.map(fn);
  if (Array.isArray(data.elements)) return { ...data, elements: data.elements.map(fn) };
  for (const c of cles) if (Array.isArray(data[c])) return { ...data, [c]: data[c].map(fn) };
  return data;
}
