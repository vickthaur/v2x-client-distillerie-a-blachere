// Démonstration (docs/crm-espace-pro.md, § 3 et § 8).
// - Barre de démo : quand une démo existe dans ce navigateur (cookie lisible bl_demo_actif), une
//   pastille discrète en bas à droite des pages (la pastille V2X est en bas à gauche) mène au CRM,
//   à l'espace pro, et permet de quitter la démo. Repliée sur téléphone, sous les messages (toast),
//   cachée quand le menu ou la porte d'âge sont ouverts, jamais imprimée.
// - Catalogue de la démo : prix et stocks modifiés dans le CRM, chargés une fois par page et
//   seulement s'il existe une démo. Sans démo, aucun appel à l'API.
import '../styles/demo.css';
import { bySlug } from '../data/products.js';
import { api, demoActive } from './api.js';
import { cart } from './cart.js';
import { readJSON, writeJSON, remove } from './store.js';

// ---------- Catalogue de la démo ----------
let catalogue = null;

// { [slug]: { actif, variantes: { [id]: { prixTTC, etat } } } }, ou null sans démo (ou en cas d'échec :
// le site garde alors les prix officiels).
export function demoCatalogue({ force = false } = {}) {
  if (!demoActive()) return Promise.resolve(null);
  if (force) catalogue = null;
  catalogue ||= api('site', 'catalogue')
    .then((d) => d?.produits || null)
    .catch(() => null);
  return catalogue;
}

// Prix et états de la démo appliqués au panier (totaux du panier latéral et de la commande).
export async function loadDemoPrices(opts) {
  const produits = await demoCatalogue(opts);
  if (produits) cart.setDemo(produits);
  return produits;
}

// Variante d'un produit dans la démo : { prixTTC, etat: 'disponible'|'stock-bas'|'rupture'|'inactif' }.
export function demoVariante(produits, slug, id) {
  const p = produits?.[slug];
  if (!p) return null;
  const v = p.variantes?.[id];
  if (p.actif === false) return { prixTTC: v?.prixTTC ?? null, etat: 'inactif' };
  return v ? { prixTTC: v.prixTTC ?? null, etat: v.etat || 'disponible' } : null;
}

export const ETATS = {
  'stock-bas': 'Stock bas',
  rupture: 'Rupture',
  inactif: 'Indisponible',
};

// Prix de la démo appliqués au catalogue affiché par la page (cartes, filtres de prix, tri, fiche,
// panier) : une seule source de prix sur toute la page, comme côté serveur.
export function appliquerDemo(produits) {
  if (!produits) return false;
  for (const [slug, d] of Object.entries(produits)) {
    const p = bySlug[slug];
    if (!p) continue;
    for (const c of p.contenances) {
      const v = d.variantes?.[c.id];
      if (v && typeof v.prixTTC === 'number') {
        c.prix = v.prixTTC;
        c.prixTexte = `${v.prixTTC.toFixed(2).replace('.', ',')}\u00a0€`;
      }
    }
  }
  cart.setDemo(produits);
  return true;
}

// État d'une variante dans la démo : 'disponible' | 'stock-bas' | 'rupture' | 'inactif' | null.
export const etatDemo = (produits, slug, id) => demoVariante(produits, slug, id)?.etat || null;
export const indisponible = (etat) => etat === 'rupture' || etat === 'inactif';

// ---------- Barre de démo ----------
const KEY = 'blachere-demo-barre';
const QUITTEE = 'blachere-demo-quittee';

export function mountDemoBar({ toast } = {}) {
  if (readJSON(QUITTEE, false, 'session')) {
    remove(QUITTEE, 'session');
    setTimeout(() => toast?.('Démo quittée\u00a0: les données de démonstration de ce navigateur sont effacées.'), 400);
  }
  if (!demoActive() || document.querySelector('.demo-bar')) return;
  const mobile = matchMedia('(max-width: 760px)');
  const saved = readJSON(KEY, null, 'session');
  const bar = document.createElement('div');
  bar.className = 'demo-bar';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Démonstration');
  bar.innerHTML = `
    <div class="demo-bar__confirm" id="demo-bar-confirm" role="alertdialog" aria-modal="false" aria-labelledby="demo-bar-q" aria-describedby="demo-bar-d" hidden>
      <p class="demo-bar__q" id="demo-bar-q">Quitter la démo\u202f?</p>
      <p class="demo-bar__d" id="demo-bar-d">Les commandes, comptes, réservations et messages de démonstration de ce navigateur seront effacés, et vous serez déconnecté du CRM et de l’espace pro.</p>
      <p class="demo-bar__err" role="alert"></p>
      <div class="demo-bar__actions">
        <button type="button" class="demo-bar__btn" data-demo-cancel>Annuler</button>
        <button type="button" class="demo-bar__btn demo-bar__btn--go" data-demo-go>Quitter la démo</button>
      </div>
    </div>
    <div class="demo-bar__pill">
      <button type="button" class="demo-bar__tag" aria-expanded="false" aria-controls="demo-bar-links" title="Démonstration : afficher ou masquer les liens">
        <span class="demo-bar__dot" aria-hidden="true"></span><span>Démo</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 15l6-6 6 6" /></svg>
      </button>
      <div class="demo-bar__links" id="demo-bar-links">
        <a href="/crm">CRM</a>
        <a href="/espace-pro">Espace pro</a>
        <button type="button" data-demo-quit aria-haspopup="true" aria-controls="demo-bar-confirm">Quitter la démo</button>
      </div>
    </div>`;
  document.body.append(bar);
  document.body.classList.add('demo-on');

  const tag = bar.querySelector('.demo-bar__tag');
  const links = bar.querySelector('.demo-bar__links');
  const confirm = bar.querySelector('.demo-bar__confirm');
  const quit = bar.querySelector('[data-demo-quit]');
  const err = bar.querySelector('.demo-bar__err');
  // Ouverte par défaut sur ordinateur, repliée sur téléphone ; le choix est gardé pour la session.
  const setOpen = (on, store = true) => {
    links.hidden = !on;
    tag.setAttribute('aria-expanded', String(on));
    bar.classList.toggle('is-open', on);
    if (!on) setConfirm(false);
    if (store) writeJSON(KEY, on, 'session');
  };
  const setConfirm = (on) => {
    confirm.hidden = !on;
    quit.setAttribute('aria-expanded', String(on));
    err.textContent = '';
    if (on) bar.querySelector('[data-demo-cancel]').focus();
  };
  setOpen(typeof saved === 'boolean' ? saved : !mobile.matches, false);

  tag.addEventListener('click', () => setOpen(links.hidden));
  quit.addEventListener('click', () => setConfirm(confirm.hidden));
  bar.querySelector('[data-demo-cancel]').addEventListener('click', () => {
    setConfirm(false);
    quit.focus();
  });
  bar.querySelector('[data-demo-go]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Un instant…';
    try {
      await api('session', 'quitter', { method: 'POST', body: {} });
      writeJSON(QUITTEE, true, 'session');
      remove(KEY, 'session');
      // Les pages de l'espace pro connecté n'ont plus de sens sans démo : retour à l'accueil pro.
      if (/^\/espace-pro\/.+/.test(location.pathname)) location.assign('/espace-pro');
      else location.reload();
    } catch (x) {
      btn.disabled = false;
      btn.textContent = 'Quitter la démo';
      err.textContent = x?.message || 'La démo n’a pas pu être quittée. Réessayez.';
    }
  });
  bar.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!confirm.hidden) {
      setConfirm(false);
      quit.focus();
    } else if (mobile.matches && !links.hidden) {
      setOpen(false);
      tag.focus();
    }
  });
  // Téléphone : un toucher ailleurs replie la barre.
  document.addEventListener('click', (e) => {
    if (mobile.matches && !links.hidden && !bar.contains(e.target)) setOpen(false, false);
  });
}
