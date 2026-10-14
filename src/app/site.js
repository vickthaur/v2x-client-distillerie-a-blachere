// Éléments communs à toutes les pages : en-tête et menu, vérification de l'âge, panier latéral,
// messages, pied de page, apparitions au scroll.
//
// Âge (logique de la v1 conservée) :
// - première visite : la date de naissance est demandée ; les sirops restent accessibles sans répondre ;
// - moins de 18 ans : les spiritueux sont retirés de toutes les pages pour la session ;
// - 18 ans ou plus : réponse gardée dans le navigateur (clé blachere-age).
import { bySlug, euro, EVIN, MINEURS } from '../data/products.js';
import { readAge, saveAge, resetAge, ageFrom } from '../lib/age.js';
import { cart } from '../lib/cart.js';
import { $, $$, esc, calm, plural } from '../lib/dom.js';
import { icons } from '../lib/icons.js';
import { thumbHTML, upgradeThumbs } from '../lib/thumbs.js';

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
  $$('[data-evin-majeur]').forEach((el) => (el.hidden = age !== 'majeur'));
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

// ---------- Menu ----------
function bindMenu() {
  const menu = $('#menu');
  const open = $('#menu-open');
  if (!menu || !open) return;
  const set = (on) => {
    menu.classList.toggle('is-open', on);
    menu.inert = !on;
    open.setAttribute('aria-expanded', String(on));
    document.body.classList.toggle('menu-ouvert', on);
    if (on) $('#menu-close').focus();
    else open.focus({ preventScroll: true });
  };
  open.addEventListener('click', () => set(true));
  $('#menu-close').addEventListener('click', () => set(false));
  menu.addEventListener('click', (e) => {
    if (e.target === menu || e.target.closest('a')) set(false);
  });
  addEventListener('keydown', (e) => e.key === 'Escape' && menu.classList.contains('is-open') && set(false));
}

function markNav() {
  const page = document.body.dataset.page;
  $$('[data-nav]').forEach((a) => {
    if (a.dataset.nav === page) a.setAttribute('aria-current', 'page');
  });
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
  return `<li class="line" data-slug="${p.slug}" data-ml="${l.ml ?? ''}">
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
    const ml = li.dataset.ml ? Number(li.dataset.ml) : null;
    const line = cart.items.find((i) => i.slug === slug && (i.ml ?? null) === ml);
    if (line) cart.set(slug, ml, line.qty + Number(b.dataset.q));
  });
  const count = () => {
    const n = cart.count();
    const c = $('#cart-count');
    if (c) c.textContent = n;
    $('#cart-open')?.setAttribute('aria-label', `Panier, ${plural(n, 'article')}`);
  };
  count();
  cart.subscribe(() => {
    count();
    if (d?.open) renderDrawer();
  });
}

// Ajout au panier depuis n'importe quelle page (bouton data-add="slug" data-ml="700").
export function addToCart(slug, ml = null, qty = 1, { open = false } = {}) {
  const p = bySlug[slug];
  if (!p) return false;
  if (p.alcool && age !== 'majeur') {
    requireAge();
    return false;
  }
  cart.add(slug, ml, qty);
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
  markNav();
  bindMenu();
  bindGate();
  bindCart();
  $$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
  $$('[data-evin-majeur]').forEach((el) => (el.hidden = age !== 'majeur'));
  if (age !== 'majeur') cart.purgeAlcohol();
  reveal();
  // Première visite : on demande l'âge (les sirops restent accessibles sans répondre).
  if (askAge && age === null) setTimeout(() => age === null && openGate('ask'), calm() ? 0 : 900);
  return site;
}
