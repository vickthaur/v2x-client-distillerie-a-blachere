// Accès aux données de l'espace pro (api/pro, voir docs/crm-espace-pro.md, § 7) : session expirée →
// retour à la page de connexion avec un message ; petit crochet de chargement avec états (chargement,
// erreur, rechargement sans clignotement) ; catalogue gardé pour la session de la page.
import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../lib/api.js';

// Retour à la connexion, avec la page demandée pour y revenir ensuite.
export function versConnexion({ expiree = true } = {}) {
  const suite = location.pathname + location.search;
  location.assign(`/espace-pro?${expiree ? 'session=expiree&' : ''}suite=${encodeURIComponent(suite)}`);
}

// Appel à api/pro ; une session expirée (401) ramène à la connexion (la promesse reste alors en
// attente : l'écran ne montre pas d'erreur pendant la redirection).
export async function pro(ressource, opts = {}) {
  try {
    return await api('pro', ressource, opts);
  } catch (e) {
    if (e?.status === 401) {
      versConnexion();
      return new Promise(() => {});
    }
    throw e;
  }
}

// Données d'une ressource : { data, error, loading, reload, setData }. Pendant un rechargement, les
// données précédentes restent affichées.
export function useDonnees(ressource, query = null, { skip = false } = {}) {
  const key = JSON.stringify([ressource, query]);
  const [state, setState] = useState({ data: null, error: null, loading: !skip });
  const [tour, setTour] = useState(0);
  useEffect(() => {
    if (skip) return undefined;
    const ctrl = new AbortController();
    setState((s) => ({ data: s.data, error: null, loading: true }));
    pro(ressource, { query: query || undefined, signal: ctrl.signal }).then(
      (data) => !ctrl.signal.aborted && setState({ data, error: null, loading: false }),
      (error) => !ctrl.signal.aborted && error?.name !== 'AbortError' && setState({ data: null, error, loading: false }),
    );
    return () => ctrl.abort();
  }, [key, tour, skip]);
  return {
    ...state,
    reload: () => setTour((n) => n + 1),
    setData: (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })),
  };
}

// ---------- Catalogue (produits visibles pour ce compte, tarifs, conditions) ----------
let catalogue = null;
let catalogueData = null;
const abonnes = new Set();

export function chargerCatalogue({ force = false } = {}) {
  if (force || !catalogue) {
    catalogue = pro('catalogue').then(
      (d) => {
        catalogueData = normaliserCatalogue(d);
        abonnes.forEach((fn) => fn(catalogueData));
        return catalogueData;
      },
      (e) => {
        catalogue = null;
        throw e;
      },
    );
  }
  return catalogue;
}

// { produits: [...], conditions, index: { 'slug|varianteId': { produit, variante } } }
function normaliserCatalogue(d) {
  const produits = Array.isArray(d) ? d : d?.produits || [];
  const index = {};
  for (const p of produits) for (const v of p.variantes || []) index[`${p.slug}|${v.id}`] = { produit: p, variante: v };
  return { produits, conditions: d?.conditions || {}, index };
}

// Catalogue en mémoire, rechargé à l'ouverture de l'écran qui le demande (stocks à jour).
export function useCatalogue({ rafraichir = false } = {}) {
  const [state, setState] = useState({ data: catalogueData, error: null, loading: !catalogueData });
  const first = useRef(true);
  useEffect(() => {
    const on = (data) => setState({ data, error: null, loading: false });
    abonnes.add(on);
    const force = rafraichir && first.current && !!catalogueData;
    first.current = false;
    chargerCatalogue({ force }).catch((error) => setState((s) => ({ data: s.data, error: s.data ? null : error, loading: false })));
    return () => abonnes.delete(on);
  }, []);
  return {
    ...state,
    reload: () => {
      setState((s) => ({ ...s, error: null, loading: true }));
      chargerCatalogue({ force: true }).catch((error) => setState({ data: null, error, loading: false }));
    },
  };
}
