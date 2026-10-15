// Routeur minimal sur l'API History, sous /crm. Les liens profonds (/crm/commandes/cmd_…)
// fonctionnent au rechargement : Vite et vercel.json servent crm.html pour /crm/*.
import { useEffect, useState } from 'preact/hooks';

export const BASE = '/crm';
const abonnes = new Set();
let dernier = { path: '', search: '' };
let origine = 'init'; // 'push' | 'pop' | 'replace' | 'init'

function lire() {
  return { path: location.pathname.replace(/\/+$/, '') || '/', search: location.search, hash: location.hash };
}
function emettre(o) {
  origine = o;
  const l = lire();
  for (const fn of abonnes) fn(l);
}
if (typeof window !== 'undefined') window.addEventListener('popstate', () => emettre('pop'));

export const origineNavigation = () => origine;

export function navigate(to, { replace = false } = {}) {
  const url = new URL(to, location.href);
  if (url.origin !== location.origin || !(url.pathname === BASE || url.pathname.startsWith(`${BASE}/`))) {
    location.assign(url.href);
    return;
  }
  const cible = url.pathname + url.search + url.hash;
  const actuelle = location.pathname + location.search + location.hash;
  if (cible === actuelle) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', cible);
  emettre(replace ? 'replace' : 'push');
}

export function useLocation() {
  const [l, set] = useState(lire);
  useEffect(() => {
    const fn = (n) => set(n);
    abonnes.add(fn);
    // l'adresse a pu changer entre le rendu et l'abonnement
    const n = lire();
    if (n.path !== l.path || n.search !== l.search) set(n);
    return () => abonnes.delete(fn);
  }, []);
  return l;
}

// Paramètres de l'adresse (?statut=…) et mise à jour sans entrée d'historique par défaut
export function useQuery() {
  const { search, path } = useLocation();
  const params = new URLSearchParams(search);
  const set = (patch, { replace = true } = {}) => {
    const p = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null || v === '' || v === false) p.delete(k);
      else p.set(k, String(v));
    }
    const s = p.toString();
    navigate(`${path}${s ? `?${s}` : ''}`, { replace });
  };
  return [params, set];
}

// '/crm/commandes/:id' → { id } ou null
const cacheMotifs = new Map();
export function correspond(motif, path) {
  let re = cacheMotifs.get(motif);
  if (!re) {
    const noms = [];
    const src = motif.replace(/\/:([a-zA-Z]+)(\*)?/g, (_, n, etoile) => {
      noms.push(n);
      return etoile ? '/(.*)' : '/([^/]+)';
    });
    re = { rx: new RegExp(`^${src}/?$`), noms };
    cacheMotifs.set(motif, re);
  }
  const m = re.rx.exec(path);
  if (!m) return null;
  return Object.fromEntries(re.noms.map((n, i) => [n, decodeURIComponent(m[i + 1] || '')]));
}

// Lien interne : clic simple → navigation sans rechargement ; ⌘/Ctrl-clic → nouvel onglet.
export function Link({ href, onClick, replace, children, ...props }) {
  const handle = (e) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (props.target && props.target !== '_self') return;
    if (!href || !href.startsWith(BASE)) return;
    e.preventDefault();
    navigate(href, { replace });
  };
  return (
    <a href={href} onClick={handle} {...props}>
      {children}
    </a>
  );
}

// Lien actif (barre latérale, onglets) : préfixe de l'adresse courante
export function estActif(href, path) {
  if (href === BASE || href === `${BASE}/tableau`) return path === BASE || path === `${BASE}/tableau`;
  return path === href || path.startsWith(`${href}/`);
}

// Rend la ligne entière d'un tableau cliquable (le lien de la première cellule reste la cible
// du clavier et des lecteurs d'écran).
export function clicLigne(href) {
  return (e) => {
    if (e.target.closest('a, button, input, select, textarea, label')) return;
    if (window.getSelection?.()?.toString()) return;
    if (e.metaKey || e.ctrlKey) window.open(href, '_blank', 'noopener');
    else navigate(href);
  };
}
