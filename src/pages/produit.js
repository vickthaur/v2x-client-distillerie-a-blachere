// Fiche produit /boutique/<slug> : bouteille 3D à faire tourner, contenance, prix (ou « Prix en
// boutique »), ajout au panier, faits connus, « Vous aimerez aussi ».
// Spiritueux : rien du produit n'est affiché (ni nom, ni visuel, ni prix) avant la vérification
// de l'âge ; une personne mineure voit seulement un message et le lien vers les sirops.
import '../styles/base.css';
import '../styles/shop.css';
import '../styles/product.css';
import { initSite, addToCart } from '../app/site.js';
import { cardHTML } from '../app/cards.js';
import { bySlug, products, visibleProducts, recettes, FAMILLES, UNIVERS, EVIN, MINEURS, euro } from '../data/products.js';
import { infos } from '../data/site.js';
import { $, $$, esc, calm, hasWebGL } from '../lib/dom.js';
import { icons } from '../lib/icons.js';
import { thumbHTML, upgradeThumbs } from '../lib/thumbs.js';
import { photoOf } from '../lib/photos.js';

const site = initSite({ askAge: false });
const slug = decodeURIComponent(location.pathname.replace(/\/+$/, '').split('/').pop() || '');
const p = bySlug[slug];
const root = $('#product-root');
let viewer = null;
let selected = 0;
let qty = 1;

// Fond de la scène 3D : couleurs de l'univers du produit (src/data/products.js, UNIVERS).
const stageColors = (x) => UNIVERS[x.theme]?.scene || { top: x.light, bottom: x.color2, glow: '#ffffff', rim: x.color };
const famille = (x) => FAMILLES.find((f) => f.id === x.famille)?.nom;

function notFound() {
  document.title = 'Produit introuvable · Distillerie A. Blachère';
  root.innerHTML = `<section class="wrap product-msg">
    <p class="kicker">Boutique</p>
    <h1 class="h-section">Ce produit est introuvable.</h1>
    <p class="lead">Il a peut-être changé de nom. Toute la gamme est dans la boutique.</p>
    <a class="oval" href="/boutique">Voir la boutique</a>
  </section>`;
}

// Porte d'âge propre à la fiche : aucun élément du produit dans la page.
function lockedView() {
  document.title = 'Produit réservé aux personnes majeures · Distillerie A. Blachère';
  const minor = site.age === 'mineur';
  root.innerHTML = `<section class="wrap product-msg product-msg--locked" data-univers="maison">
    <span class="product-msg__icon">${icons.lock}</span>
    <p class="kicker">Spiritueux · 18+</p>
    <h1 class="h-section">Cette page est réservée aux personnes majeures.</h1>
    <p class="lead">${minor ? 'Bonne découverte de nos sirops, de notre histoire et des visites de la distillerie.' : 'Indiquez votre date de naissance pour voir ce produit.'}</p>
    <div class="product-msg__actions">
      ${minor ? '' : '<button type="button" class="oval" data-verify>Vérifier mon âge</button>'}
      <a class="btn btn--ink" href="/boutique?univers=sirops">Voir les sirops</a>
    </div>
    <p class="evin">${esc(EVIN)} ${esc(MINEURS)}</p>
  </section>`;
  $('#related').hidden = true;
  $('[data-verify]', root)?.addEventListener('click', () => site.requireAge());
}

function priceHTML() {
  const c = p.contenances[selected];
  if (c?.prix != null)
    return `<p class="pp__price"><strong>${euro(c.prix)}</strong><span>TTC · ${esc(c.volume)}${c.aVerifier ? ' · prix à confirmer' : ''}</span></p>`;
  return `<p class="pp__price pp__price--none"><strong>Prix en boutique</strong><span>Ce prix n’est pas affiché en ligne : la distillerie vous le donne au magasin ou par téléphone (${infos.magasin.tel}).</span></p>`;
}

function render() {
  document.title = `${p.nom} · Boutique · Distillerie A. Blachère`;
  const majeur = site.majeur;
  const notes = p.notes.filter((n) => !n.alcool || majeur);
  const recs = recettes.filter((r) => r.produits?.includes(p.slug) && (!r.alcool || majeur));
  const phrase = p.phrase && (!p.phraseAlcool || majeur) ? p.phrase : null;
  const facts = [
    ['Gamme', p.gammeNom],
    ['Arôme', [famille(p), p.arome && !/^(None|null)$/.test(p.arome) ? p.arome : null].filter(Boolean).join(' · ') || null],
    ['Contenance', p.contenances.map((c) => c.volume).join(' · ') || 'À confirmer'],
    p.alcool ? ['Degré d’alcool', p.degre ? `${p.degre} % vol.` : 'À confirmer avec la distillerie'] : ['Alcool', 'Sans alcool'],
    p.ingredients ? ['Ingrédients', p.ingredients.replace(/^\(extrait\)\s*/, 'Extrait de la fiche : ')] : null,
    p.conseil ? ['Conseil de la maison', p.conseil] : null,
  ].filter((f) => f && f[1]);
  const volumes = p.contenances.length
    ? `<fieldset class="pp__volumes"><legend>Contenance</legend>${p.contenances
        .map(
          (c, i) =>
            `<label class="vol"><input type="radio" name="volume" value="${i}"${i === selected ? ' checked' : ''} /><span>${esc(c.volume)}${c.volumeRevendeur ? ' <small>à confirmer</small>' : ''}</span></label>`,
        )
        .join('')}</fieldset>`
    : '<p class="pp__muted">Contenance à confirmer avec la distillerie.</p>';
  root.innerHTML = `
  <nav class="crumbs wrap" aria-label="Fil d’Ariane">
    <a href="/boutique">Boutique</a><span aria-hidden="true">/</span><a href="/boutique?gamme=${p.gamme}">${esc(p.gammeNom)}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(p.nom)}</span>
  </nav>
  <article class="pp wrap" data-theme="${p.theme}" style="--c:${p.color};--l:${p.light};--d:${p.deep}">
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
      <p class="pp__gamme">${esc(p.gammeNom)}${p.bestSeller ? ' <span class="badge badge--best">Meilleure vente</span>' : ''}${p.alcool ? ' <span class="badge badge--age">18+</span>' : ''}</p>
      <h1 class="pp__name">${esc(p.nom).replace(/®/g, '<sup>®</sup>')}</h1>
      <p class="pp__type">${esc(p.type)}</p>
      ${phrase ? `<p class="pp__phrase">« ${esc(phrase)} »</p>` : ''}
      <form class="pp__buy" id="buy" novalidate>
        ${volumes}
        <div id="price">${priceHTML()}</div>
        <div class="pp__row">
          <span class="qty qty--big" role="group" aria-label="Quantité">
            <button type="button" data-step="-1" aria-label="Une bouteille de moins">${icons.minus}</button>
            <input type="number" id="qty" name="qty" min="1" max="99" value="${qty}" inputmode="numeric" aria-label="Quantité" />
            <button type="button" data-step="1" aria-label="Une bouteille de plus">${icons.plus}</button>
          </span>
          <button type="submit" class="oval pp__add">${icons.bag}Ajouter au panier</button>
        </div>
      </form>
      <ul class="pp__reassure">
        <li>${icons.store}<span><strong>Retrait à la distillerie</strong>, ${esc(infos.retrait)}, du lundi au samedi</span></li>
        <li>${icons.truck}<span><strong>Livraison</strong> : frais calculés avec la distillerie</span></li>
      </ul>
      ${p.alcool ? `<p class="evin pp__evin">${esc(EVIN)} ${esc(MINEURS)}</p>` : ''}
      <dl class="pp__facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${notes.length ? `<div class="pp__notes"><h2>À savoir</h2><ul>${notes.map((n) => `<li>${esc(n.t)}</li>`).join('')}</ul></div>` : ''}
      ${recs
        .map(
          (r) => `<div class="pp__recipe">
        <h2>Recette de la maison : ${esc(r.titre)}</h2>
        ${r.ingredients ? `<ul>${r.ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
        ${r.preparation ? `<p>${esc(r.preparation)}</p>` : ''}
        ${r.url ? `<a class="link" href="${r.url}" target="_blank" rel="noopener">La recette sur le site actuel <span class="sr-only">(nouvel onglet)</span></a>` : ''}
      </div>`,
        )
        .join('')}
    </div>
  </article>`;
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
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const c = p.contenances[selected];
    addToCart(p.slug, c?.ml ?? null, qty, { open: true });
  });
  $$('[data-side]').forEach((b) =>
    b.addEventListener('click', () => {
      viewer?.setAngle(Number(b.dataset.side) ? Math.PI : 0);
    }),
  );
}

async function mountViewer() {
  const stage = $('#stage');
  const photo = await photoOf(p.slug);
  const source = $('#source');
  source.textContent = photo ? 'Bouteille 3D construite à partir de la photo du produit.' : 'Bouteille et étiquette dessinées en code, en attendant la photo du produit.';
  source.hidden = false;
  if (!hasWebGL()) {
    stage.classList.add('is-static');
    return;
  }
  try {
    const { BottleViewer } = await import('../three/viewer.js');
    // Spiritueux : présentation sobre (ni décor, ni rotation automatique), règle 7 de l'étude.
    viewer = new BottleViewer($('#viewer'), p, { calm: calm() || p.alcool, garnish: !p.alcool, colors: stageColors(p) });
    await viewer.ready;
    stage.classList.add('is-live');
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('test')) window.__viewer = viewer;
  } catch (err) {
    console.warn('3D indisponible, illustration affichée.', err);
    stage.classList.add('is-static');
  }
}

function renderRelated() {
  // Jamais de mélange : un sirop propose des sirops, un spiritueux des spiritueux.
  const pool = visibleProducts(site.age).filter((x) => x.slug !== p.slug && x.univers === p.univers);
  const score = (x) => (x.gamme === p.gamme ? 2 : 0) + (x.famille === p.famille ? 3 : 0) + (x.bestSeller ? 1 : 0) + (x.theme === p.theme ? 1 : 0);
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
  if (add) addToCart(add.dataset.add, add.dataset.ml ? Number(add.dataset.ml) : null);
});

site.onAge(show);
show();
// Spiritueux sans âge vérifié : on pose la question tout de suite.
if (p?.alcool && (site.age === null || site.age === 'sirops')) site.requireAge();
else if (site.age === null) setTimeout(() => site.age === null && site.openGate('ask'), calm() ? 0 : 900);

if (import.meta.env.DEV) window.__p = { p, products };
