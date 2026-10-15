// Fiche produit /boutique/<slug> : la bouteille en 3D (tirée de la vraie photo, sur un plateau de
// studio neutre) qu'on fait tourner, les contenances avec leur prix, l'ajout au panier, puis les
// textes officiels de la fiche (description, ingrédients, valeurs nutritionnelles, conseils, « le
// saviez-vous ? ») dans un tableau de détails, les conditions d'expédition et les recettes.
// Spiritueux : rien du produit n'est affiché (ni nom, ni visuel, ni prix) avant la vérification
// de l'âge ; une personne mineure voit seulement un message et le lien vers les sirops. Sur les
// fiches de sirops, les conseils qui mentionnent de l'alcool ne sont montrés qu'aux majeurs.
import '../styles/base.css';
import '../styles/shop.css';
import '../styles/product.css';
import '../styles/operation.css';
import { initSite, addToCart } from '../app/site.js';
import { cardHTML } from '../app/cards.js';
import { bySlug, products, visibleProducts, recettes, FAMILLES, EVIN, MINEURS, euro, DISPO_BOUTIQUE, formatsAilleursTexte } from '../data/products.js';
import { infos } from '../data/site.js';
import { $, $$, esc, calm, hasWebGL } from '../lib/dom.js';
import { icons } from '../lib/icons.js';
import { thumbHTML, upgradeThumbs } from '../lib/thumbs.js';
import { photoOf } from '../lib/photos.js';
import { operationAffichee, concerne, encartFicheHTML } from '../lib/operation.js';

const site = initSite({ askAge: false });
// Opération du moment (Octobre Rose) : pastille et encart sur la fiche des produits concernés.
const operation = operationAffichee();
const slug = decodeURIComponent(location.pathname.replace(/\/+$/, '').split('/').pop() || '');
const p = bySlug[slug];
const root = $('#product-root');
let viewer = null;
let selected = 0;
let qty = 1;

const famille = (x) => FAMILLES.find((f) => f.id === x.famille)?.nom;

// ---------- Textes officiels ----------
// Mots de l'alcool : une ligne (ou un élément de liste) qui en contient n'est montrée qu'aux majeurs.
const ALCOOL = /\b(bières?|pastis|tequila|vodka|rhums?|gin|whiskys?|vins?|champagnes?|liqueurs?|alcools?|alcoolisée?s?|apéritifs?|cognac|armagnac|martini|kir|spritz|prosecco|cidres?|calvados|absinthe|mojito|caïpirinha|ti-punch|punch|marc|cocktails? alcoolisés?)\b/i;
function sansAlcool(text) {
  return text
    .split('\n')
    .map((line) => {
      if (!ALCOOL.test(line)) return line;
      const parts = line.split(/,\s*/);
      const kept = parts.filter((x) => !ALCOOL.test(x));
      const out = kept.join(', ');
      return kept.length && kept.length < parts.length && !ALCOOL.test(out) ? out : null;
    })
    .filter((l) => l !== null)
    .join('\n');
}
const clean = (text) => (text ? (p.alcool || site.majeur ? text : sansAlcool(text)) : '');

// Paragraphes, listes « - … » et intertitres « … : » du site officiel.
function rich(text) {
  const blocks = clean(text)
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  let html = '';
  let list = [];
  const flush = () => {
    if (list.length) html += `<ul>${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    list = [];
  };
  for (const b of blocks) {
    if (/^-\s/.test(b)) {
      list.push(b.replace(/^-\s*/, ''));
      continue;
    }
    flush();
    if (/:\s*$/.test(b) && b.length < 80) html += `<p class="pp__sub">${esc(b)}</p>`;
    else html += `<p>${esc(b).replace(/\n/g, '<br />')}</p>`;
  }
  flush();
  return html;
}

function notFound() {
  document.title = 'Produit introuvable · Distillerie A. Blachère';
  root.innerHTML = `<section class="wrap product-msg">
    <p class="kicker">Boutique</p>
    <h1 class="h-section">Ce produit est introuvable.</h1>
    <p class="lead">Il a peut-être changé de nom. Toute la gamme est dans la boutique.</p>
    <a class="btn btn--primary" href="/boutique">Voir la boutique</a>
  </section>`;
}

// Porte d'âge propre à la fiche : aucun élément du produit dans la page.
function lockedView() {
  document.title = 'Produit réservé aux personnes majeures · Distillerie A. Blachère';
  const minor = site.age === 'mineur';
  root.innerHTML = `<section class="wrap product-msg product-msg--locked">
    <span class="product-msg__icon">${icons.lock}</span>
    <p class="kicker">Spiritueux · 18+</p>
    <h1 class="h-section">Cette page est réservée aux personnes majeures.</h1>
    <p class="lead">${minor ? 'Bonne découverte de nos sirops, de notre histoire et des visites de la distillerie.' : 'Indiquez votre date de naissance pour voir ce produit.'}</p>
    <div class="product-msg__actions">
      ${minor ? '' : '<button type="button" class="btn btn--primary" data-verify>Vérifier mon âge</button>'}
      <a class="btn btn--ghost" href="/boutique?univers=sirops">Voir les sirops</a>
    </div>
    <p class="evin">${esc(EVIN)} ${esc(MINEURS)}</p>
  </section>`;
  $('#related').hidden = true;
  $('[data-verify]', root)?.addEventListener('click', () => site.requireAge());
}

function priceHTML() {
  const c = p.contenances[selected];
  if (c?.prix != null) return `<p class="pp__price"><strong>${euro(c.prix)}</strong><span>TTC · ${esc(c.volume)}</span></p>`;
  return `<p class="pp__price pp__price--none"><strong>Prix en boutique</strong><span>Ce prix n’est pas affiché en ligne : la distillerie vous le donne au magasin ou par téléphone (${infos.magasin.tel}).</span></p>`;
}

function boutiqueHTML() {
  return `<div class="pp__dispo">
    <p class="pp__dispo-title">${icons.store}<strong>${esc(DISPO_BOUTIQUE)}</strong></p>
    <p>Ce produit n’est pas vendu en ligne. Prix, contenance${p.alcool ? ' et degré' : ''} à confirmer avec la distillerie : ${esc(infos.magasin.tel)}.</p>
    <a class="link" href="/visiter">Préparer une visite</a>
  </div>`;
}

// Première phrase utile de la description officielle (hors slogan en capitales).
function accroche() {
  const lines = clean(p.description || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^dilution/i.test(l));
  return lines.find((l) => l !== l.toUpperCase() && l.length > 20) || null;
}

function detailsHTML() {
  const sections = [];
  if (p.description) sections.push(['description', 'Description', rich(p.description)]);
  if (p.ingredients) sections.push(['ingredients', 'Ingrédients', `<p>${esc(p.ingredients)}</p>`]);
  if (p.nutrition) sections.push(['nutrition', 'Valeurs nutritionnelles', rich(p.nutrition)]);
  if (p.application) {
    const html = rich(p.application);
    if (html) sections.push(['conseils', 'Conseils d’utilisation', html]);
  }
  if (p.saviezVous) {
    const html = rich(p.saviezVous);
    if (html) sections.push(['histoire', 'Le saviez-vous ?', html]);
  }
  sections.push(['livraison', 'Expédition et paiement', livraisonHTML()]);
  return sections
    .map(
      ([id, title, html], i) => `<details class="pp__acc" id="d-${id}"${i === 0 ? ' open' : ''}>
        <summary><span>${esc(title)}</span>${icons.chevron}</summary>
        <div class="pp__acc-body prose">${html}</div>
      </details>`,
    )
    .join('');
}

// Conditions générales de vente du site officiel (articles « Expédition et livraison »,
// « Modalité de paiement », « Délais de rétractation », « Casse au cours de la livraison »).
function livraisonHTML() {
  return `<ul class="pp__terms">
    <li><strong>Expédition</strong> sous 3 jours ouvrés au plus après la réception du règlement, si les produits sont disponibles ; livraison dans les 30 jours au plus.</li>
    <li><strong>Frais de livraison</strong> indiqués avant la validation de la commande.</li>
    <li><strong>Paiement</strong> à la commande : carte bancaire (CB, Visa, Mastercard), PayPal ou virement.</li>
    <li><strong>Rétractation</strong> : quatorze jours francs à compter de la réception ; articles intacts et non ouverts.</li>
    <li><strong>Casse</strong> : refuser le colis endommagé ou l’indiquer sur le récépissé ; la distillerie réexpédie ou rembourse.</li>
  </ul>
  <p><a class="link" href="/conditions-de-vente">Conditions générales de vente</a></p>`;
}

function render() {
  document.title = `${p.nom} · Boutique · Distillerie A. Blachère`;
  const majeur = site.majeur;
  const notes = p.notes.filter((n) => (!n.alcool || majeur) && !/^Sa fiche/.test(n.t));
  const recs = recettes.filter((r) => r.produits?.includes(p.slug) && (!r.alcool || majeur));
  const lead = accroche();
  const ailleurs = formatsAilleursTexte(p);
  const facts = [
    ['Gamme', p.gammeNom],
    ['Arôme', famille(p)],
    ['Contenance', p.contenances.map((c) => (c.prix != null ? `${c.volume} (${euro(c.prix)})` : c.volume)).join(' · ') || 'À confirmer'],
    p.alcool ? ['Degré d’alcool', p.degre ? `${String(p.degre).replace('.', ',')} % vol.` : 'À confirmer avec la distillerie'] : ['Alcool', 'Sans alcool'],
    p.reference ? ['Référence', p.reference] : null,
  ].filter((f) => f && f[1]);
  const volumes =
    p.contenances.length > 1
      ? `<fieldset class="pp__volumes"><legend>Contenance</legend><div class="pp__vols">${p.contenances
          .map(
            (c, i) =>
              `<label class="vol"><input type="radio" name="volume" value="${i}"${i === selected ? ' checked' : ''} /><span class="vol__in"><span class="vol__name">${esc(c.volume)}</span>${c.prix != null ? `<span class="vol__price">${euro(c.prix)}</span>` : ''}</span></label>`,
          )
          .join('')}</div></fieldset>`
      : p.contenances.length
        ? `<p class="pp__one">${esc(p.contenances[0].volume)}</p>`
        : '<p class="pp__muted">Contenance à confirmer avec la distillerie.</p>';
  root.innerHTML = `
  <nav class="crumbs wrap" aria-label="Fil d’Ariane">
    <a href="/boutique">Boutique</a><span aria-hidden="true">/</span><a href="/boutique?gamme=${p.gamme}">${esc(p.gammeNom)}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(p.nom)}</span>
  </nav>
  <article class="pp wrap" data-alcool="${p.alcool ? '1' : '0'}">
    <div class="pp__stage" id="stage">
      <div class="pp__poster" id="poster">${thumbHTML(p, { eager: true })}</div>
      <canvas class="pp__canvas" id="viewer" tabindex="0" aria-label="Bouteille ${esc(p.nom)} en 3D : faites-la tourner en la faisant glisser, ou avec les flèches gauche et droite"></canvas>
      <div class="pp__stage-ui">
        <p class="pp__hint">${icons.rotate}<span>Glissez pour faire tourner</span></p>
        <div class="pp__sides" role="group" aria-label="Voir la bouteille">
          <button type="button" data-side="0">Face</button><button type="button" data-side="1">Dos</button>
        </div>
      </div>
      <p class="pp__source" id="source" hidden></p>
    </div>
    <div class="pp__info">
      <p class="pp__gamme"><span>${esc(p.gammeNom)}</span>${p.bestSeller ? ' <span class="badge badge--best">Meilleure vente</span>' : ''}${concerne(operation, p.slug) ? ` <span class="badge badge--rose">${esc(operation.nom)}</span>` : ''}${p.alcool ? ' <span class="badge badge--age">18+</span>' : ''}</p>
      <h1 class="pp__name">${esc(p.nom).replace(/®/g, '<sup>®</sup>')}</h1>
      <p class="pp__type">${esc(p.type)}${p.alcool && p.degre ? ` · ${String(p.degre).replace('.', ',')} % vol.` : ''}</p>
      ${lead ? `<p class="pp__lead">${esc(lead)}</p>` : ''}
      ${p.enLigne ? '' : boutiqueHTML()}
      <form class="pp__buy" id="buy" novalidate${p.enLigne ? '' : ' hidden'}>
        ${volumes}
        <div id="price">${priceHTML()}</div>
        <div class="pp__row">
          <span class="qty qty--big" role="group" aria-label="Quantité">
            <button type="button" data-step="-1" aria-label="Une bouteille de moins">${icons.minus}</button>
            <input type="number" id="qty" name="qty" min="1" max="99" value="${qty}" inputmode="numeric" aria-label="Quantité" />
            <button type="button" data-step="1" aria-label="Une bouteille de plus">${icons.plus}</button>
          </span>
          <button type="submit" class="btn btn--primary pp__add">${icons.bag}Ajouter au panier</button>
        </div>
      </form>
      ${concerne(operation, p.slug) ? encartFicheHTML(operation) : ''}
      ${ailleurs ? `<p class="pp__ailleurs">${esc(ailleurs)} — voir <a href="/ou-trouver">Où trouver nos produits</a></p>` : ''}
      <ul class="pp__reassure">
        <li>${icons.truck}<span><strong>Expédiée sous 3 jours ouvrés</strong> au plus après le règlement</span></li>
        <li>${icons.card}<span><strong>Carte bancaire, PayPal ou virement</strong></span></li>
        <li>${icons.store}<span><strong>La boutique de la distillerie</strong> à Châteauneuf-du-Pape, du lundi au samedi</span></li>
      </ul>
      ${p.alcool ? `<p class="evin pp__evin">${esc(EVIN)} ${esc(MINEURS)}</p>` : ''}
      <dl class="pp__facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <div class="pp__details">${detailsHTML()}</div>
      ${notes.length ? `<div class="pp__notes"><h2>À savoir</h2><ul>${notes.map((n) => `<li>${esc(n.t)}</li>`).join('')}</ul></div>` : ''}
    </div>
  </article>
  ${
    recs.length
      ? `<section class="pp-recipes wrap" aria-labelledby="pp-rec-title">
      <div class="section__head"><div><p class="kicker">Recettes de la maison</p><h2 class="h-section" id="pp-rec-title">Avec ${esc(p.nom)}</h2></div><a class="arrow-link" href="/recettes">Toutes les recettes ${icons.arrow}</a></div>
      <ul class="pp-recipes__list">${recs
        .slice(0, 3)
        .map(
          (r) => `<li class="rcard"><a href="/recettes#${r.id}">
            ${r.image ? `<span class="rcard__img"><img src="${r.image}" alt="" loading="lazy" decoding="async" /></span>` : ''}
            <span class="rcard__title">${esc(r.titre)}</span>
            ${r.alcool ? '<span class="badge badge--age">18+</span>' : '<span class="rcard__meta">Sans alcool</span>'}
          </a></li>`,
        )
        .join('')}</ul>
    </section>`
      : ''
  }`;
  bindBuy();
  mountViewer();
  renderRelated();
}

function bindBuy() {
  const form = $('#buy');
  form.addEventListener('change', (e) => {
    if (e.target.name === 'volume') {
      selected = Number(e.target.value);
      $('#price').innerHTML = priceHTML();
    }
  });
  const input = $('#qty');
  const setQty = (n) => {
    qty = Math.min(99, Math.max(1, Number.isFinite(n) ? Math.round(n) : 1));
    input.value = qty;
  };
  $$('[data-step]', form).forEach((b) => b.addEventListener('click', () => setQty(qty + Number(b.dataset.step))));
  input.addEventListener('change', () => setQty(parseInt(input.value, 10)));
  if (p.enLigne)
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const c = p.contenances[selected];
      addToCart(p.slug, c?.id ?? null, qty, { open: true });
    });
  $$('[data-side]').forEach((b) => b.addEventListener('click', () => viewer?.setAngle(Number(b.dataset.side) ? Math.PI : 0)));
}

async function mountViewer() {
  const stage = $('#stage');
  const photo = await photoOf(p.slug);
  const source = $('#source');
  // Carafe et étui (millésimes, coffret) : la photo, telle quelle, sans 3D tournante.
  if (photo?.plat && photo.photo) {
    $('#poster').innerHTML = `<img class="thumb pp__flat" src="${photo.photo}" alt="${esc(p.nom)}" />`;
    stage.classList.add('is-static', 'is-flat');
    source.textContent = 'Photo du produit.';
    source.hidden = false;
    return;
  }
  source.textContent = photo ? (photo.etiquette ? 'Bouteille 3D tirée de la photo du produit, avec son étiquette d’origine.' : 'Bouteille 3D tirée de la photo du produit.') : 'Bouteille dessinée en code, en attendant la photo du produit.';
  source.hidden = false;
  if (!photo?.etiquetteDos) $('.pp__sides')?.setAttribute('hidden', '');
  if (!hasWebGL()) {
    stage.classList.add('is-static');
    return;
  }
  try {
    const { BottleViewer } = await import('../three/viewer.js');
    // Spiritueux : présentation sobre (ni décor, ni rotation automatique).
    viewer = new BottleViewer($('#viewer'), p, { calm: calm() || p.alcool, target: () => $('#stage').getBoundingClientRect() });
    await viewer.ready;
    stage.classList.add('is-live');
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('test')) window.__viewer = viewer;
  } catch (err) {
    console.warn('3D indisponible, photo affichée.', err);
    stage.classList.add('is-static');
  }
}

function renderRelated() {
  // Jamais de mélange : un sirop propose des sirops, un spiritueux des spiritueux.
  const pool = visibleProducts(site.age).filter((x) => x.slug !== p.slug && x.univers === p.univers);
  const score = (x) => (x.gamme === p.gamme ? 2 : 0) + (x.famille === p.famille ? 3 : 0) + (x.bestSeller ? 1 : 0);
  const picks = pool
    .map((x) => [x, score(x)])
    .sort((a, b) => b[1] - a[1] || a[0].index - b[0].index)
    .slice(0, 4)
    .map(([x]) => x);
  $('#related-grid').innerHTML = picks.map((x) => cardHTML(x)).join('');
  $('#related').hidden = !picks.length;
  upgradeThumbs($('#related-grid'));
}

function show() {
  viewer?.dispose();
  viewer = null;
  if (!p) return notFound();
  if (p.alcool && site.age !== 'majeur') return lockedView();
  render();
}

document.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  if (add) addToCart(add.dataset.add, add.dataset.v || null);
});

site.onAge(show);
show();
// Spiritueux sans âge vérifié : on pose la question tout de suite.
if (p?.alcool && (site.age === null || site.age === 'sirops')) site.requireAge();
else if (site.age === null) setTimeout(() => site.age === null && site.openGate('ask'), calm() ? 0 : 900);

if (import.meta.env.DEV) window.__p = { p, products };
