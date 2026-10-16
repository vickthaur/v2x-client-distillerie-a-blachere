// Éléments communs à toutes les pages : en-tête et menu, vérification de l'âge, panier latéral,
// messages, pied de page, apparitions au scroll.
//
// Âge (logique de la v1 conservée) :
// - première visite : la date de naissance est demandée ; les sirops restent accessibles sans répondre ;
// - moins de 18 ans : les spiritueux sont retirés de toutes les pages pour la session ;
// - 18 ans ou plus : réponse gardée dans le navigateur (clé blachere-age).
import { bySlug, products, euro, EVIN, MINEURS, DISPO_BOUTIQUE, surtitre, prixAuLitreHTML } from '../data/products.js';
import { readAge, saveAge, resetAge, ageFrom } from '../lib/age.js';
import { cart } from '../lib/cart.js';
import { $, $$, esc, calm, plural, fold } from '../lib/dom.js';
import { icons } from '../lib/icons.js';
import { thumbHTML, renderHTML, upgradeThumbs } from '../lib/thumbs.js';
import { watchBrands } from '../lib/marques.js';
import { api } from '../lib/api.js';
import { mountDemoBar, loadDemoPrices } from '../lib/demo.js';
import { devis, devisLocal } from '../lib/livraison.js';
import { operationAffichee, lignePanierHTML } from '../lib/operation.js';
// Mode revue (?revue) sur toutes les pages : notes de la maquette masquées par défaut (QUAL-8).
import '../lib/revue.js';
import '../styles/operation.css';

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
      $('#gate-err').textContent = 'Cette date n’est pas valide\u00a0: vérifiez le jour, le mois et l’année (ex. 07 / 03 / 1985).';
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
  // Les quatre rayons de la boutique officielle, chacun avec l'un de ses produits
  const picks = [
    ['pastis-marra', 'Les Apéritifs et Pastis', '/spiritueux#pastis-aperitifs'],
    ['la-camarguaise', 'Les Liqueurs', '/spiritueux#liqueurs'],
    ['creme-de-chataigne', 'Les Crèmes et Eaux de Vie', '/spiritueux#cremes-eaux-de-vie'],
    ['marc-chateauneuf-du-pape-reserve-des-legats', 'Les Vieux Marcs', '/spiritueux#marcs'],
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
  // Au clavier : le panneau suit son bouton dans l'ordre du focus ; il se ferme quand le focus
  // quitte le bouton et le panneau (un clic dans le vide du panneau ne le ferme pas).
  $$('.nav__item').forEach((item) => {
    const btn = $('[data-mega]', item);
    if (!btn) return;
    item.addEventListener('focusout', (e) => {
      if (btn.getAttribute('aria-expanded') === 'true' && e.relatedTarget && !item.contains(e.relatedTarget)) closeMegas();
    });
  });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = $('[data-mega][aria-expanded="true"]');
    if (open) {
      closeMegas();
      open.focus();
    }
  });
  // langues et compte : pas encore en place, visibles seulement en mode revue (UX-13)
  $$('[data-lang]').forEach((b) => b.addEventListener('click', () => toast(`Version ${b.dataset.lang === 'en' ? 'anglaise' : 'allemande'}\u00a0: à venir (maquette).`)));
  $$('[data-account]').forEach((b) => b.addEventListener('click', () => toast('Espace client\u00a0: prévu pour la mise en ligne (maquette).')));
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
  ['Contact', '/contact', 'contact ecrire message telephone adresse horaires'],
];
function bindSearch() {
  const box = $('#search');
  const btn = $('#search-open');
  if (!box || !btn) return;
  const input = $('#search-q');
  const out = $('#search-results');
  // Fenêtre modale : le reste de la page est inerte, Échap ferme (événement « close »).
  const open = () => {
    if (box.open) return;
    closeMegas();
    box.showModal();
    void box.offsetWidth; // départ du fondu
    box.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('search-ouverte');
    input.focus();
    run();
  };
  box.addEventListener('close', () => {
    box.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('search-ouverte');
    btn.focus({ preventScroll: true });
  });
  const run = () => {
    const q = fold(input.value.trim());
    const pool = products.filter((p) => !p.alcool || age === 'majeur');
    const hits = q ? pool.filter((p) => fold(`${p.nom} ${p.gammeNom} ${p.arome || ''} ${p.type}`).includes(q)).slice(0, 6) : pool.filter((p) => p.bestSeller).slice(0, 4);
    const pages = q ? PAGES.filter(([t, , k]) => fold(`${t} ${k}`).includes(q)).slice(0, 4) : PAGES.slice(0, 4);
    out.innerHTML = `<div class="search__col"><p class="search__h">${q ? `Produits (${hits.length})` : 'Meilleures ventes'}</p>${
      hits.length
        ? `<ul class="search__products">${hits
            .map((p) => `<li><a href="/boutique/${p.slug}"><span class="search__thumb">${thumbHTML(p)}</span><span><span class="search__name">${esc(p.nom)}</span><span class="search__meta">${esc(surtitre(p))}</span></span></a></li>`)
            .join('')}</ul>`
        : '<p class="search__none">Aucun produit ne correspond.</p>'
    }</div><div class="search__col"><p class="search__h">Pages</p><ul class="search__pages">${pages.map(([t, href]) => `<li><a href="${href}">${esc(t)}</a></li>`).join('') || '<li class="search__none">Aucune page.</li>'}</ul>${
      q ? `<a class="btn btn--ghost btn--sm" href="/boutique?q=${encodeURIComponent(input.value.trim())}">Voir tous les résultats dans la boutique</a>` : ''
    }</div>`;
    upgradeThumbs(out);
  };
  btn.addEventListener('click', () => (box.open ? box.close() : open()));
  $('[data-search-close]', box).addEventListener('click', () => box.close());
  input.addEventListener('input', run);
  // Échap ferme du premier coup, même avec du texte (un champ « search » se viderait d'abord)
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    box.close();
  });
  // clic sur le voile, hors du panneau
  box.addEventListener('click', (e) => e.target === box && box.close());
}

// Menu du téléphone : fenêtre modale qui glisse depuis la droite ; elle ne se ferme (et ne rend le
// focus au bouton) qu'une fois sortie de l'écran.
function bindMenu() {
  const menu = $('#menu');
  const open = $('#menu-open');
  if (!menu || !open) return;
  let timer = 0;
  const show = () => {
    if (menu.open) return;
    clearTimeout(timer);
    fillRenders(menu);
    menu.showModal();
    void menu.offsetWidth; // départ du glissé
    menu.classList.add('is-open');
    open.setAttribute('aria-expanded', 'true');
    document.body.classList.add('menu-ouvert');
    $('#menu-close').focus();
  };
  const hide = () => {
    if (!menu.open || !menu.classList.contains('is-open')) return;
    menu.classList.remove('is-open');
    const done = () => {
      clearTimeout(timer);
      menu.removeEventListener('transitionend', end);
      if (menu.open) menu.close();
    };
    const end = (e) => e.target === menu && done();
    menu.addEventListener('transitionend', end);
    timer = setTimeout(done, calm() ? 0 : 650);
  };
  menu.addEventListener('cancel', (e) => {
    e.preventDefault();
    hide();
  });
  menu.addEventListener('close', () => {
    menu.classList.remove('is-open');
    open.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-ouvert');
    open.focus({ preventScroll: true });
  });
  open.addEventListener('click', show);
  $('#menu-close').addEventListener('click', hide);
  menu.addEventListener('click', (e) => {
    if (e.target === menu || e.target.closest('a')) hide();
  });
}

// Lettre d'information : inscription enregistrée dans la démo de ce navigateur (api/site, newsletter).
function bindNewsletter() {
  $$('[data-newsletter]').forEach((f) =>
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = $('input[type="email"]', f);
      const btn = $('button[type="submit"]', f);
      const msg = $('.ft__news-msg, [data-newsletter-msg]', f);
      const email = input.value.trim();
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      input.classList.toggle('is-invalid', !ok);
      input.setAttribute('aria-invalid', String(!ok));
      if (!ok) {
        if (msg) msg.textContent = 'Indiquez une adresse e-mail valide.';
        input.focus();
        return;
      }
      if (btn) btn.disabled = true;
      if (msg) msg.textContent = 'Inscription en cours…';
      try {
        const r = await api('site', 'newsletter', { method: 'POST', body: { email, source: f.dataset.newsletter || 'pied-de-page' } });
        input.value = '';
        if (msg)
          msg.textContent = r?.deja
            ? 'Cette adresse est déjà inscrite à la lettre de la distillerie.'
            : 'Merci, votre inscription est enregistrée. Démonstration\u00a0: elle est visible dans le CRM de démonstration de ce navigateur, aucun e-mail n’est envoyé.';
        mountDemoBar({ toast });
      } catch (x) {
        input.classList.toggle('is-invalid', x?.champ === 'email');
        if (msg) msg.textContent = x?.message || 'L’inscription n’a pas pu être enregistrée. Réessayez.';
      } finally {
        if (btn) btn.disabled = false;
      }
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
  loadDemoPrices();
  renderDrawer();
  if (!d.open) d.showModal();
}

// Contenance, prix et prix au litre d'une ligne (UX-5).
const lineMeta = (l) => [l.contenance?.volume ? esc(l.contenance.volume) : 'Contenance à confirmer', l.prix !== null ? euro(l.prix) : 'Prix en boutique', l.prix !== null ? prixAuLitreHTML({ ...l.contenance, prix: l.prix }) : ''].filter(Boolean).join(' · ');

function lineHTML(l, { compact = false } = {}) {
  const p = l.product;
  return `<li class="line" data-slug="${p.slug}" data-v="${l.v ?? ''}">
    <a class="line__img" href="/boutique/${p.slug}" style="--c:${p.light}" tabindex="-1" aria-hidden="true">${thumbHTML(p)}</a>
    <span>
      <a class="line__name" href="/boutique/${p.slug}">${esc(p.nom)}</a>
      <span class="line__meta" data-meta>${lineMeta(l)}</span>
      ${p.alcool && !compact ? `<span class="line__meta">${esc(EVIN)}</span>` : ''}
    </span>
    <span class="qty" role="group" aria-label="Quantité de ${esc(p.nom)}">
      <button type="button" data-q="-1" aria-label="Retirer un ${esc(p.nom)}">${icons.minus}</button>
      <output aria-live="polite">${l.qty}</output>
      <button type="button" data-q="1" aria-label="Ajouter un ${esc(p.nom)}">${icons.plus}</button>
    </span>
  </li>`;
}

// Livraison au panier (UX-4) : retrait gratuit, livraison dès … en point relais, franco et reste à
// atteindre ; barème de démonstration tout de suite, confirmé par la route de la démo.
const lignesDevis = (t) => t.lines.filter((l) => l.prix !== null).map((l) => ({ slug: l.product.slug, varianteId: String(l.v), qte: l.qty }));
const devisDuPanier = (t) => devisLocal({ bouteilles: t.count, articlesTTC: t.subtotal });
function livraisonTexte(d) {
  if (!d.relais && !d.colissimo) return 'Retrait gratuit à la distillerie, ou livraison offerte pour ce panier\u00a0: vous choisissez à l’étape suivante.';
  return `Retrait gratuit à la distillerie, ou livraison dès ${euro(Math.min(d.relais, d.colissimo))} en point relais\u00a0: vous choisissez à l’étape suivante. Livraison offerte dès ${euro(d.francoTTC)} d’achats${d.francoRestantTTC > 0 ? `, plus que ${euro(d.francoRestantTTC)}` : ''}.`;
}
export function affinerLivraison(root, t = cart.totals()) {
  const el = root && $('[data-livraison]', root);
  const lignes = lignesDevis(t);
  if (!el || !lignes.length) return;
  devis(lignes, devisDuPanier(t)).then((d) => el.isConnected && (el.textContent = livraisonTexte(d)));
}

export function totalsHTML(t, { mode = 'panier' } = {}) {
  const rows = [`<div class="totals__row"><span>Sous-total${t.unpriced ? ' (prix connus)' : ''}</span><strong data-subtotal>${euro(t.subtotal)}</strong></div>`];
  if (t.unpriced)
    rows.push(`<p class="totals__note">+ ${plural(t.unpriced, 'article')} au prix de la boutique\u00a0: le montant vous est confirmé par la distillerie.</p>`);
  if (mode === 'panier') rows.push(`<p class="totals__note" data-livraison>${livraisonTexte(devisDuPanier(t))}</p>`);
  return `<div class="totals">${rows.join('')}</div>`;
}

// Panier latéral. Quand seules les quantités changent, la liste n'est pas réécrite : le focus reste
// sur le bouton « + » ou « − » et la nouvelle quantité est lue (aria-live). Quand une ligne
// disparaît, le focus passe à la ligne suivante (ou au message « panier vide ») ; jamais perdu (A11Y-6).
function renderDrawer() {
  const list = $('#cart-list');
  const foot = $('#cart-foot');
  if (!list) return;
  const t = cart.totals();
  const lis = $$('.line', list);
  const memes = t.lines.length && lis.length === t.lines.length && t.lines.every((l, i) => lis[i].dataset.slug === l.product.slug && lis[i].dataset.v === String(l.v ?? ''));
  if (memes) {
    t.lines.forEach((l, i) => {
      const out = $('output', lis[i]);
      if (out.textContent !== String(l.qty)) out.textContent = l.qty;
      const meta = $('[data-meta]', lis[i]);
      const html = lineMeta(l);
      if (meta && meta.innerHTML !== html) meta.innerHTML = html;
    });
  } else {
    const actif = list.contains(document.activeElement) ? document.activeElement : null;
    const ancienne = actif?.closest('.line');
    const repere = ancienne ? { slug: ancienne.dataset.slug, v: ancienne.dataset.v, q: actif.dataset.q || '-1', rang: lis.indexOf(ancienne) } : null;
    list.innerHTML = t.lines.length
      ? t.lines.map((l) => lineHTML(l)).join('')
      : `<li class="drawer__empty"><p tabindex="-1">Votre panier est vide.</p><a class="oval" href="/boutique">Voir la boutique</a></li>`;
    if (repere) {
      const nouvelles = $$('.line', list);
      const meme = nouvelles.find((li) => li.dataset.slug === repere.slug && li.dataset.v === repere.v);
      const voisine = nouvelles[Math.min(Math.max(repere.rang, 0), nouvelles.length - 1)];
      const cible = meme ? $(`[data-q="${repere.q}"]`, meme) : voisine ? $(`[data-q="${repere.q}"]`, voisine) : $('.drawer__empty p', list);
      cible?.focus();
    }
    upgradeThumbs(list);
  }
  // Opération du moment (Octobre Rose) : don correspondant aux bouteilles concernées du panier.
  const op = operationAffichee();
  foot.innerHTML = t.lines.length
    ? `${totalsHTML(t)}
       ${op ? lignePanierHTML(op, t.lines) : ''}
       <a class="oval oval--block" href="/panier">Voir le panier et commander</a>
       ${t.alcohol ? `<p class="evin">${esc(EVIN)} ${esc(MINEURS)}</p>` : ''}`
    : '';
  foot.hidden = !t.lines.length;
  affinerLivraison(foot, t);
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
    toast(`${p.nom}\u00a0: ${DISPO_BOUTIQUE.charAt(0).toLowerCase()}${DISPO_BOUTIQUE.slice(1)}`);
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
// Une fenêtre modale est ouverte (menu, recherche, panier, porte d'âge) : le message s'affiche dans
// la fenêtre, sinon il serait caché derrière elle et inerte (jamais lu par les lecteurs d'écran).
const modale = () => {
  try {
    return [...document.querySelectorAll('dialog[open]')].reverse().find((d) => d.matches(':modal')) || null;
  } catch {
    return null;
  }
};
function toast(text) {
  const t = $('#toast');
  if (!t) return;
  const host = modale() || document.body;
  const show = () => {
    t.textContent = text;
    t.classList.add('is-on');
  };
  if (t.parentElement !== host) {
    host.append(t);
    requestAnimationFrame(show);
  } else show();
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
// Impression (QUAL-7, src/styles/print.css) : les accordéons fermés (ingrédients, valeurs
// nutritionnelles, questions) s'impriment ouverts, puis se referment.
function bindPrint() {
  addEventListener('beforeprint', () =>
    $$('details:not([open])').forEach((d) => {
      d.dataset.imprime = '';
      d.open = true;
    }),
  );
  addEventListener('afterprint', () =>
    $$('details[data-imprime]').forEach((d) => {
      d.open = false;
      delete d.dataset.imprime;
    }),
  );
}

// Pied de page : les groupes de liens (<details>, ouverts dans le HTML) restent ouverts au bureau, où
// leur titre n'est pas un interrupteur ; au téléphone ils se replient en une ligne chacun.
function bindFooter() {
  const groupes = $$('[data-ft-col]');
  if (!groupes.length) return;
  const tel = matchMedia('(max-width: 760px)');
  const regler = () =>
    groupes.forEach((d) => {
      d.open = !tel.matches;
      const titre = $('summary', d);
      if (titre) titre.tabIndex = tel.matches ? 0 : -1;
    });
  regler();
  tel.addEventListener('change', regler);
  groupes.forEach((d) => $('summary', d)?.addEventListener('click', (e) => !tel.matches && e.preventDefault()));
}

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
  bindPrint();
  bindFooter();
  // Démo active dans ce navigateur : pastille d'accès au CRM et à l'espace pro (en bas à droite).
  mountDemoBar({ toast });
  $$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
  $$('[data-evin-majeur], [data-majeur]').forEach((el) => (el.hidden = age !== 'majeur'));
  if (age !== 'majeur') cart.purgeAlcohol();
  reveal();
  // Première visite : on demande l'âge (les sirops restent accessibles sans répondre).
  if (askAge && age === null) setTimeout(() => age === null && openGate('ask'), calm() ? 0 : 900);
  return site;
}
