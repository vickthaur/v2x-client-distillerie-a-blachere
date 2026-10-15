// Petit routeur de l'espace pro (History API) : /espace-pro/<vue>[/<id>][?…].
// Les liens internes (<a href="/espace-pro/…">) sont interceptés : pas de rechargement de page.
import { useEffect, useState } from 'preact/hooks';

export const BASE = '/espace-pro';
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

export function navigate(to, { replace = false, state = null } = {}) {
  const url = to.startsWith('/') ? to : `${BASE}/${to}`;
  if (url === location.pathname + location.search && !replace) return notify();
  history[replace ? 'replaceState' : 'pushState'](state, '', url);
  notify();
}

// Emplacement courant : { vue, id, path, query } ; la vue est le premier segment après /espace-pro/.
export function parse() {
  const parts = location.pathname.replace(/\/+$/, '').slice(BASE.length).split('/').filter(Boolean);
  return { vue: parts[0] || 'accueil', id: parts[1] ? decodeURIComponent(parts[1]) : null, path: location.pathname, query: new URLSearchParams(location.search) };
}

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const update = () => setRoute(parse());
    listeners.add(update);
    addEventListener('popstate', update);
    return () => {
      listeners.delete(update);
      removeEventListener('popstate', update);
    };
  }, []);
  return route;
}

// Interception des liens internes (clic simple, même onglet).
export function interceptLinks(root = document) {
  root.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a[href]');
    if (!a || a.target || a.hasAttribute('download') || a.dataset.reload !== undefined) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !/^\/espace-pro\/.+/.test(url.pathname)) return;
    e.preventDefault();
    navigate(url.pathname + url.search);
  });
}
