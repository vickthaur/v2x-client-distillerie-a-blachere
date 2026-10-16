// Blocs communs des pages de marque (PAC Citron, Fun Blue, Couleur Provence) : campagne 3D avec
// carte de prix, textes officiels, rituel de dilution, composition, recettes, étiquettes
// d'archives et presse. Tout vient des données (catalogue officiel, recettes, archives, presse).
import { addToCart, reveal } from './site.js';
import { pieceById, pieceHTML } from './pieces.js';
import { bySlug, recettes, euro, minPrice, formatsAilleursTexte } from '../data/products.js';
import textes from '../data/textes.js';
import { monterCampagne } from '../lib/campagne.js';
import { $, esc } from '../lib/dom.js';
import { icons } from '../lib/icons.js';
import { noteRevue } from '../lib/revue.js';

// Campagne : la vraie bouteille sur l'aplat de la marque, en photo dans le HTML (affiche), puis en
// 3D quand elle est prête (scène de src/three/hero.js ; jamais en mouvement réduit, en économie de
// données ou sans WebGL : voir src/lib/campagne.js).
export const mountBrandHero = (sceneName, products) => monterCampagne({ hero: $('#bhero'), stage: $('#bhero-stage'), canvas: $('#bhero-canvas'), scene: sceneName, products });

// Carte de prix (contenance, prix TTC, ajout au panier) sous le titre de la campagne.
export function priceCardHTML(p) {
  const c = p.contenances[0];
  const price = minPrice(p);
  return `<div class="bprice">
    <div class="bprice__txt"><span class="bprice__name">${esc(p.nom).replace(/®/g, '<sup>®</sup>')}</span><span class="bprice__meta">${esc(p.type)}${c ? ` · ${esc(c.volume)}` : ''}</span></div>
    <strong class="bprice__price">${price !== null ? euro(price) : 'Prix en boutique'}</strong>
    ${p.enLigne && c ? `<button type="button" class="btn btn--light btn--sm" data-add="${p.slug}" data-v="${c.id}">${icons.bag}<span>Ajouter</span></button>` : ''}
  </div>`;
}

// Paragraphes d'un texte officiel (lignes vides = paragraphes).
export const paragraphs = (text, max = 99) =>
  (text || '')
    .split(/\n\s*\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((x) => `<p>${esc(x)}</p>`)
    .join('');

// Composition et valeurs nutritionnelles (fiche officielle).
export function compositionHTML(p) {
  const rows = (p.nutrition || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^-\s/.test(l))
    .map((l) => l.replace(/^-\s*/, ''))
    .map((l) => {
      const [k, ...v] = l.split(':');
      return v.length ? [k.trim(), v.join(':').trim()] : [l, ''];
    });
  return `<dl class="bfacts">
    <div><dt>Ingrédients</dt><dd>${esc(p.ingredients || '—')}</dd></div>
    ${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
  </dl>
  <p class="bnote">Valeurs pour 100\u00a0ml de sirop non dilué${noteRevue(', d’après la fiche du produit sur le site de la distillerie')}.</p>`;
}

// Recettes officielles avec ce produit (les recettes avec alcool seulement pour les majeurs).
export function recipesHTML(slugs, majeur, max = 3) {
  const list = recettes.filter((r) => r.produits?.some((s) => slugs.includes(s)) && (!r.alcool || majeur)).slice(0, max);
  if (!list.length) return '';
  return `<ul class="brecipes">${list
    .map(
      (r) => `<li class="rcard"><a href="/recettes#${r.id}">
        ${r.image ? `<span class="rcard__img"><img src="${r.image}" alt="" width="619" height="1100" loading="lazy" decoding="async" /></span>` : ''}
        <span class="rcard__title">${esc(r.titre)}</span>
        ${r.alcool ? '<span class="badge badge--age">18+</span>' : '<span class="rcard__meta">Sans alcool</span>'}
      </a></li>`,
    )
    .join('')}</ul>`;
}

// Étiquettes d'archives encadrées.
export const piecesHTML = (ids) =>
  `<ul class="pieces">${ids
    .map((id) => pieceById[id])
    .filter(Boolean)
    .map((p) => pieceHTML(p))
    .join('')}</ul>`;

// Presse : la rubrique « On parle de nous » du site officiel, filtrée.
export function pressHTML(test, max = 6) {
  const items = textes.presse.filter((a) => test(a.titre)).slice(0, max);
  if (!items.length) return '';
  return `<ul class="bpress">${items
    .map(
      (a) => `<li><a href="${a.url}" target="_blank" rel="noopener">
        <span class="bpress__meta">${a.type === 'video' ? 'Vidéo' : 'Presse'} · ${esc(a.date)}</span>
        <span class="bpress__title">${esc(a.titre)}</span>
        <span class="bpress__go">${icons.arrow}<span class="sr-only"> (nouvel onglet${noteRevue(', site de la distillerie')})</span></span>
      </a></li>`,
    )
    .join('')}</ul>`;
}

export function ailleursHTML(p) {
  const t = formatsAilleursTexte(p);
  return t ? `<p class="bnote">${esc(t)} — voir <a href="/ou-trouver">Où trouver nos produits</a>.</p>` : '';
}

export function bindAdd() {
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) addToCart(add.dataset.add, add.dataset.v || null);
  });
}

export { bySlug, reveal };
