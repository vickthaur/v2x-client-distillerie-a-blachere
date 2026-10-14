// Éléments communs à toutes les pages : en-tête et menu, vérification de l'âge, panier latéral,
// messages, pied de page, apparitions au scroll.
//
// Âge (logique de la v1 conservée) :
// - première visite : la date de naissance est demandée ; les sirops restent accessibles sans répondre ;
// - moins de 18 ans : les spiritueux sont retirés de toutes les pages pour la session ;
// - 18 ans ou plus : réponse gardée dans le navigateur (clé blachere-age).
import { bySlug, products, euro, EVIN, MINEURS, DISPO_BOUTIQUE } from '../data/products.js';
import { readAge, saveAge, resetAge, ageFrom } from '../lib/age.js';
import { cart } from '../lib/cart.js';
import { $, $$, esc, calm, plural, fold } from '../lib/dom.js';
import { icons } from '../lib/icons.js';
import { thumbHTML, renderHTML, upgradeThumbs } from '../lib/thumbs.js';
import { watchBrands } from '../lib/marques.js';

let age = readAge(); // 'majeur' | 'mineur' | 'sirops' | null
const TEST = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');
const ageListeners = new Set();
let gateThen = null;
let gateResolve = null;

export const site = {
  get age() {
    return age;
  },
  get majeur() {
    return age === 'majeur';
  },
  onAge(fn) {
    ageListeners.add(fn);
    return () => ageListeners.delete(fn);
  },
  openGate,
  requireAge,
  toast,
  openCart,
};

function setAge(value) {
  age = value;
  document.documentElement.dataset.age = age || 'inconnu';
  if (age !== 'majeur') {
    const removed = cart.purgeAlcohol();
    if (removed) toast('Les spiritueux ont été retirés du panier.');
  }
  $$('[data-evin-majeur], [data-majeur]').forEach((el) => (el.hidden = age !== 'majeur'));
  if (!$('#mega-spiritueux')?.hidden) spiritsMenu();
  ageListeners.forEach((fn) => fn(age));
}

// ---------- Vérification de l'âge ----------
const gate = () => $('#gate');

function openGate(mode = 'ask', then = null) {
  const g = gate();
  if (!g) return;
  gateThen = then;
  $('#gate-ask').hidden = mode !== 'ask';
  $('#gate-no').hidden = mode !== 'no';
  $('#gate-err').textContent = '';
  if (!g.open) g.showModal();
  document.body.classList.add('age-ouvert');
  if (mode === 'ask') setTimeout(() => $('[name="jour"]', g)?.focus(), 60);
  else $('#gate-no .gate__title')?.focus();
}

// Promesse résolue quand la personne a répondu (ou fermé la fenêtre).
function requireAge() {
  if (age === 'majeur' || age === 'mineur') return Promise.resolve(age);
  return new Promise((resolve) => {
    gateResolve = resolve;
    openGate(age === 'mineur' ? 'no' : 'ask');
  });
}

function closeGate() {
  if (gate()?.open) gate().close();
}

function bindGate() {
  const g = gate();
  if (!g) return;
  g.addEventListener('close', () => {
    document.body.classList.remove('age-ouvert');
    // Fermer sans répondre (Échap) = continuer avec les sirops pour cette session.
    if (age === null) {
      saveAge('sirops');
      setAge('sirops');
    }
    if (gateResolve) {
      gateResolve(age);
      gateResolve = null;
    }
  });
  const form = $('#gate-form');
  const fields = $$('input', form);
  fields.forEach((f, k) =>
    f.addEventListener('input', () => {
      f.value = f.value.replace(/\D/g, '');
      if (k < 2 && f.value.length === 2) fields[k + 1].focus();
    }),
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const years = ageFrom(d.jour, d.mois, d.annee);
    fields.forEach((f) => f.classList.toggle('is-invalid', !f.value));
    if (years === null) {
      $('#gate-err').textContent = 'Cette date n’est pas valide : vérifiez le jour, le mois et l’année (ex. 07 / 03 / 1985).';
      return;
    }
    form.reset();
    fields.forEach((f) => f.classList.remove('is-invalid'));
    if (years < 18) {
      saveAge('mineur');
      setAge('mineur');
      openGate('no');
      return;
    }
    saveAge('majeur');
    const then = gateThen;
    setAge('majeur');
    closeGate();
    if (typeof then === 'function') then('majeur');
  });
  $('#gate-skip').addEventListener('click', () => {
    saveAge('sirops');
    setAge('sirops');
    closeGate();
  });
  $('#gate-ok').addEventListener('click', () => {
    closeGate();
    if (typeof gateThen === 'function') gateThen('mineur');
  });
  $$('[data-age-reset]').forEach((b) =>
    b.addEventListener('click', () => {
      resetAge();
      setAge(null);
      openGate('ask');
    }),
  );
}

// ---------- En-tête : état collant, méga-menus, recherche, menu plein écran ----------

// Vignettes des menus (rendus 3D ou photos) : posées à la première ouverture.
function fillRenders(root) {
  $$('[data-render]', root).forEach((el) => {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    el.innerHTML = renderHTML(el.dataset.render.split(' '), { bg: el.dataset.bg || '', fmt: 'paysage' });
  });
  upgradeThumbs(root);
}

// Méga-menu « Spiritueux » : produits visibles seulement après la vérification de l'âge.
function spiritsMenu() {
  const box = $('[data-spirits-menu]');
  if (!box) return;
  if (age !== 'majeur') {
    box.innerHTML = `<div class="mega__lock">${icons.lock}<div><p class="mega__t">Réservé aux personnes majeures</p><p class="mega__d">${
      age === 'mineur' ? 'Bonne découverte de nos sirops, de notre histoire et des visites.' : 'Indiquez votre date de naissance pour voir les pastis, liqueurs, marcs et eaux-de-vie de la maison.'
    }</p>${age === 'mineur' ? '' : '<button type="button" class="btn btn--primary btn--sm" data-verify-menu>Vérifier mon âge</button>'}</div></div>`;
    $('[data-verify-menu]', box)?.addEventListener('click', () => {
      closeMegas();
      requireAge();
    });
    return;
  }
  const picks = [
    ['pastis-marra', 'Les Apéritifs et Pastis', '/boutique?gamme=pastis-aperitifs'],
    ['la-camarguaise', 'Liqueurs régionales', '/boutique?gamme=liqueurs-regionales'],
    ['marc-chateauneuf-du-pape-reserve-des-legats', 'Vieux marcs', '/boutique?gamme=marcs'],
    ['eau-de-vie-poire-williams-flirt', 'Les Crèmes et Eaux de Vie', '/boutique?gamme=cremes-eaux-de-vie'],
  ];
  box.innerHTML = `<ul class="mega__brands mega__brands--4">${picks
    .map(([slug, label, href]) => {
      const p = bySlug[slug];
      return p ? `<li><a class="mega-brand mega-brand--sober" href="${href}"><span class="mega-brand__render" data-render="${slug}"></span><span class="mega-brand__txt"><span class="mega-brand__name">${esc(label)}</span><span class="mega-brand__line">${esc(p.nom)}</span></span></a></li>` : '';
    })
    .join('')}</ul>`;
}

let megaTimer;
function closeMegas(except = null) {
  $$('.mega').forEach((m) => {
    if (m === except) return;
    m.hidden = true;
    m.classList.remove('is-open');
  });
  $$('[data-mega]').forEach((b) => {
    if (except && b.getAttribute('aria-controls') === except.id) return;
    b.setAttribute('aria-expanded', 'false');
  });
  if (!except) $('#site-header')?.classList.remove('has-mega');
}

function openMega(btn) {
  const panel = $(`#${btn.getAttribute('aria-controls')}`);
  if (!panel) return;
  closeMegas(panel);
  if (panel.dataset.panel === 'spiritueux') spiritsMenu();
  panel.hidden = false;
  requestAnimationFrame(() => panel.classList.add('is-open'));
  btn.setAttribute('aria-expanded', 'true');
  $('#site-header').classList.add('has-mega');
  fillRenders(panel);
}

function bindHeader() {
  const hd = $('#site-header');
  if (!hd) return;
  // état collant : en haut de page (transparent sur un visuel), puis fond plein et barre réduite
  let ticking = false;
  const state = () => {
    ticking = false;
    const y = scrollY;
    hd.dataset.state = y > 24 ? 'scrolled' : 'top';
  };
  addEventListener(
    'scroll',
    () => {
      if (!ticking) requestAnimationFrame(state);
      ticking = true;
    },
    { passive: true },
  );
  state();
  // méga-menus : survol avec délai (souris), clic, clavier
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  $$('[data-mega]').forEach((btn) => {
    btn.addEventListener('click', () => (btn.getAttribute('aria-expanded') === 'true' ? closeMegas() : openMega(btn)));
    btn.addEventListener('mouseenter', () => {
      if (!fine.matches) return;
      clearTimeout(megaTimer);
      megaTimer = setTimeout(() => openMega(btn), 120);
    });
  });
  hd.addEventListener('mouseleave', () => {
    if (!fine.matches) return;
    clearTimeout(megaTimer);
    megaTimer = setTimeout(() => closeMegas(), 220);
  });
  hd.addEventListener('mouseenter', () => clearTimeout(megaTimer));
  $$('.nav__link:not([data-mega]), .logo, .hd__tools > *', hd).forEach((el) =>
    el.addEventListener('mouseenter', () => {
      if (fine.matches) closeMegas();
    }),
  );
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.mega') && !e.target.closest('[data-mega]')) closeMegas();
  });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = $('[data-mega][aria-expanded="true"]');
    if (open) {
      closeMegas();
      open.focus();
    }
  });
  // langues et compte : maquette
  $$('[data-lang]').forEach((b) => b.addEventListener('click', () => toast(`Version ${b.dataset.lang === 'en' ? 'anglaise' : 'allemande'} : à venir (maquette).`)));
  $$('[data-account]').forEach((b) => b.addEventListener('click', () => toast('Espace client : prévu pour la mise en ligne (maquette).')));
  $$('[data-cart-open]').forEach((b) => b.addEventListener('click', openCart));
}

// Recherche : produits visibles (selon l'âge) et pages, sans accents ni majuscules.
const PAGES = [
  ['PAC Citron', '/pac-citron', 'pac citron sirop citron histoire collectors'],
  ['Fun Blue', '/fun-blue', 'fun blue menthe bleue sirop'],
  ['Couleur Provence®', '/couleur-provence', 'couleur provence sirops fruits fleurs plantes'],
  ['Recettes', '/recettes', 'recettes cocktails blue mojito'],
  ['Notre histoire', '/la-maison', 'histoire maison 1835 avignon generation savoir faire'],
  ['Les archives', '/musee', 'archives etiquettes affiches musee collection'],
  ['Visiter la distillerie', '/visiter', 'visite visiter degustation reservation horaires'],
  ['Où acheter', '/ou-trouver', 'ou acheter points de vente magasins cavistes'],
  ['Actualités', '/actualites', 'actualites presse'],
  ['Espace pro', '/espace-pro', 'pro professionnels chr cavistes'],
];
function bindSearch() {
  const box = $('#search');
  const btn = $('#search-open');
  if (!box || !btn) return;
  const input = $('#search-q');
  const out = $('#search-results');
  const set = (on) => {
    box.hidden = !on;
    btn.setAttribute('aria-expanded', String(on));
    document.body.classList.toggle('search-ouverte', on);
    if (on) {
      closeMegas();
      requestAnimationFrame(() => box.classList.add('is-open'));
      input.focus();
      run();
    } else {
      box.classList.remove('is-open');
      btn.focus({ preventScroll: true });
    }
  };
  const run = () => {
    const q = fold(input.value.trim());
    const pool = products.filter((p) => !p.alcool || age === 'majeur');
    const hits = q ? pool.filter((p) => fold(`${p.nom} ${p.gammeNom} ${p.arome || ''} ${p.type}`).includes(q)).slice(0, 6) : pool.filter((p) => p.bestSeller).slice(0, 4);
    const pages = q ? PAGES.filter(([t, , k]) => fold(`${t} ${k}`).includes(q)).slice(0, 4) : PAGES.slice(0, 4);
    out.innerHTML = `<div class="search__col"><p class="search__h">${q ? `Produits (${hits.length})` : 'Meilleures ventes'}</p>${
      hits.length
        ? `<ul class="search__products">${hits
            .map((p) => `<li><a href="/boutique/${p.slug}"><span class="search__thumb">${thumbHTML(p)}</span><span><span class="search__name">${esc(p.nom)}</span><span class="search__meta">${esc(p.gammeNom)}</span></span></a></li>`)
            .join('')}</ul>`
        : '<p class="search__none">Aucun produit ne correspond.</p>'
    }</div><div class="search__col"><p class="search__h">Pages</p><ul class="search__pages">${pages.map(([t, href]) => `<li><a href="${href}">${esc(t)}</a></li>`).join('') || '<li class="search__none">Aucune page.</li>'}</ul>${
      q ? `<a class="btn btn--ghost btn--sm" href="/boutique?q=${encodeURIComponent(input.value.trim())}">Voir tous les résultats dans la boutique</a>` : ''
    }</div>`;
    upgradeThumbs(out);
  };
  btn.addEventListener('click', () => set(box.hidden));
  $('[data-search-close]', box).addEventListener('click', () => set(false));
  input.addEventListener('input', run);
  box.addEventListener('click', (e) => e.target === box && set(false));
  addEventListener('keydown', (e) => e.key === 'Escape' && !box.hidden && set(false));
}

function bindMenu() {
  const menu = $('#menu');
  const open = $('#menu-open');
  if (!menu || !open) return;
  const set = (on) => {
    menu.classList.toggle('is-open', on);
    menu.inert = !on;
    open.setAttribute('aria-expanded', String(on));
    document.body.classList.toggle('menu-ouvert', on);
    if (on) {
      fillRenders(menu);
      $('#menu-close').focus();
    } else open.focus({ preventScroll: true });
  };
  open.addEventListener('click', () => set(true));
  $('#menu-close').addEventListener('click', () => set(false));
  menu.addEventListener('click', (e) => {
    if (e.target === menu || e.target.closest('a')) set(false);
  });
  addEventListener('keydown', (e) => e.key === 'Escape' && menu.classList.contains('is-open') && set(false));
}

// Lettre d'information (maquette : rien n'est envoyé).
function bindNewsletter() {
  $$('[data-newsletter]').forEach((f) =>
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('input[type="email"]', f);
      const msg = $('.ft__news-msg, [data-newsletter-msg]', f);
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
      input.classList.toggle('is-invalid', !ok);
      if (msg) msg.textContent = ok ? 'Merci : inscription enregistrée (maquette, aucun envoi).' : 'Indiquez une adresse e-mail valide.';
      if (ok) input.value = '';
    }),
  );
}

function markNav() {
  const page = document.body.dataset.page;
  $$('[data-nav]').forEach((a) => {
    if (a.dataset.nav === page) a.setAttribute('aria-current', 'page');
  });
  // rubrique active dans la barre principale
  const group = { pac: 'marques', funblue: 'marques', provence: 'marques', recettes: 'marques', spiritueux: 'spiritueux', maison: 'maison', musee: 'maison', actualites: 'maison' }[page];
  if (group) $(`[data-mega="${group}"]`)?.classList.add('is-current');
}

// ---------- Panier latéral ----------
function openCart() {
  const d = $('#cart');
  if (!d) return;
  renderDrawer();
  if (!d.open) d.showModal();
}

function lineHTML(l, { compact = false } = {}) {
  const p = l.product;
  const meta = [l.contenance?.volume || 'Contenance à confirmer', l.prix !== null ? euro(l.prix) : 'Prix en boutique'].join(' · ');
  return `<li class="line" data-slug="${p.slug}" data-v="${l.v ?? ''}">
    <a class="line__img" href="/boutique/${p.slug}" style="--c:${p.light}" tabindex="-1" aria-hidden="true">${thumbHTML(p)}</a>
    <span>
      <a class="line__name" href="/boutique/${p.slug}">${esc(p.nom)}</a>
      <span class="line__meta">${esc(meta)}</span>
      ${p.alcool && !compact ? `<span class="line__meta">${esc(EVIN)}</span>` : ''}
    </span>
    <span class="qty" role="group" aria-label="Quantité de ${esc(p.nom)}">
      <button type="button" data-q="-1" aria-label="Retirer un ${esc(p.nom)}">${icons.minus}</button>
      <output aria-live="polite">${l.qty}</output>
      <button type="button" data-q="1" aria-label="Ajouter un ${esc(p.nom)}">${icons.plus}</button>
    </span>
  </li>`;
}

export function totalsHTML(t, { mode = 'panier' } = {}) {
  const rows = [`<div class="totals__row"><span>Sous-total${t.unpriced ? ' (prix connus)' : ''}</span><strong data-subtotal>${euro(t.subtotal)}</strong></div>`];
  if (t.unpriced)
    rows.push(`<p class="totals__note">+ ${plural(t.unpriced, 'article')} au prix de la boutique : le montant vous est confirmé par la distillerie.</p>`);
  if (mode === 'panier') rows.push('<p class="totals__note">Retrait à la distillerie ou livraison : vous choisissez à l’étape suivante. Les frais de livraison sont calculés avec la distillerie.</p>');
  return `<div class="totals">${rows.join('')}</div>`;
}

function renderDrawer() {
  const list = $('#cart-list');
  const foot = $('#cart-foot');
  if (!list) return;
  const t = cart.totals();
  list.innerHTML = t.lines.length
    ? t.lines.map((l) => lineHTML(l)).join('')
    : `<li class="drawer__empty"><p>Votre panier est vide.</p><a class="oval" href="/boutique">Voir la boutique</a></li>`;
  foot.innerHTML = t.lines.length
    ? `${totalsHTML(t)}
       <a class="oval oval--block" href="/panier">Voir le panier et commander</a>
       ${t.alcohol ? `<p class="evin">${esc(EVIN)} ${esc(MINEURS)}</p>` : ''}`
    : '';
  foot.hidden = !t.lines.length;
  upgradeThumbs(list);
}

function bindCart() {
  const d = $('#cart');
  $('#cart-open')?.addEventListener('click', openCart);
  $('#cart-close')?.addEventListener('click', () => d.close());
  d?.addEventListener('click', (e) => {
    if (e.target === d) d.close();
    const b = e.target.closest('[data-q]');
    if (!b) return;
    const li = b.closest('.line');
    const slug = li.dataset.slug;
    const v = li.dataset.v || null;
    const line = cart.items.find((i) => i.slug === slug && (i.v ?? null) === v);
    if (line) cart.set(slug, v, line.qty + Number(b.dataset.q));
  });
  const count = () => {
    const n = cart.count();
    const c = $('#cart-count');
    if (c) {
      c.textContent = n;
      c.hidden = !n;
    }
    $$('[data-cart-count]').forEach((el) => (el.textContent = n));
    $('#cart-open')?.setAttribute('aria-label', `Panier, ${plural(n, 'article')}`);
  };
  count();
  cart.subscribe(() => {
    count();
    if (d?.open) renderDrawer();
  });
}

// Ajout au panier depuis n'importe quelle page (bouton data-add="slug" data-v="700" : id de variante).
export function addToCart(slug, v = null, qty = 1, { open = false } = {}) {
  const p = bySlug[slug];
  if (!p) return false;
  if (p.alcool && age !== 'majeur') {
    requireAge();
    return false;
  }
  if (!p.enLigne) {
    toast(`${p.nom} : ${DISPO_BOUTIQUE.charAt(0).toLowerCase()}${DISPO_BOUTIQUE.slice(1)}`);
    return false;
  }
  if (!v) v = p.contenances[0]?.id ?? null;
  if (!cart.add(slug, v, qty)) return false;
  const btn = $('#cart-open');
  btn?.classList.add('is-bump');
  setTimeout(() => btn?.classList.remove('is-bump'), 320);
  toast(`${p.nom} ajouté au panier`);
  if (open) openCart();
  return true;
}

// ---------- Message ----------
let toastTimer;
function toast(text) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = text;
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), 2400);
}

// ---------- Apparitions ----------
export function reveal(root = document) {
  const els = $$('[data-reveal]:not(.is-in)', root);
  // Captures de recette (?test) : tout est visible tout de suite.
  if (calm() || TEST || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }),
    { threshold: 0.12, rootMargin: '0px 0px -5% 0px' },
  );
  els.forEach((el) => io.observe(el));
}

// ---------- Démarrage ----------
export function initSite({ askAge = true } = {}) {
  document.documentElement.dataset.age = age || 'inconnu';
  // PAC et Fun Blue : logotypes dans les titres, police et couleur de marque dans le texte
  watchBrands();
  markNav();
  bindHeader();
  bindSearch();
  bindMenu();
  bindGate();
  bindCart();
  bindNewsletter();
  $$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
  $$('[data-evin-majeur], [data-majeur]').forEach((el) => (el.hidden = age !== 'majeur'));
  if (age !== 'majeur') cart.purgeAlcohol();
  reveal();
  // Première visite : on demande l'âge (les sirops restent accessibles sans répondre).
  if (askAge && age === null) setTimeout(() => age === null && openGate('ask'), calm() ? 0 : 900);
  return site;
}
