// Couleur Provence® : trois étagères (classiques du comptoir en 1 L, parfums de Provence en
// 70 cl, gourmands et fruités en 70 cl et 50 cl), une couleur par parfum, prix officiels.
import '../styles/base.css';
import '../styles/shop.css';
import '../styles/editorial.css';
import '../styles/pages.css';
import { initSite, addToCart, reveal } from '../app/site.js';
import { cardHTML } from '../app/cards.js';
import { bySlug, ETAGERES, products } from '../data/products.js';
import { $, esc } from '../lib/dom.js';
import { upgradeThumbs } from '../lib/thumbs.js';

initSite();

// Pastilles de couleur en fond du titre (positions fixes, une par parfum).
const cp = products.filter((p) => p.gamme === 'couleur-provence');
$('#cp-dots').innerHTML = cp
  .map((p, i) => {
    const x = 56 + ((i * 37) % 40);
    const y = 8 + ((i * 53) % 80);
    const s = 28 + ((i * 29) % 70);
    return `<i style="--c:${p.bottle.liquid};left:${x}%;top:${y}%;width:${s}px;height:${s}px"></i>`;
  })
  .join('');

$('#etageres').innerHTML = ETAGERES.map((e) => {
  const items = e.slugs.map((s) => bySlug[s]).filter(Boolean);
  return `<section class="etagere" id="${e.id}" aria-labelledby="et-${e.id}">
    <div class="etagere__head" data-reveal>
      <h2 class="etagere__title" id="et-${e.id}">${esc(e.titre)}</h2>
      <p class="etagere__format">${esc(e.format)} · ${items.length} parfums</p>
    </div>
    <ul class="grid">${items.map((p) => cardHTML(p)).join('')}</ul>
  </section>`;
}).join('');
upgradeThumbs($('#etageres'));
reveal();

document.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  if (add) addToCart(add.dataset.add, add.dataset.ml ? Number(add.dataset.ml) : null);
});
