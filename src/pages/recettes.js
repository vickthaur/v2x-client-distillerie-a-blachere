// Recettes : les recettes publiées par la distillerie sur son site (textes exacts, leurs photos).
// Sans alcool par défaut ; celles qui contiennent de l'alcool ne s'affichent qu'aux personnes
// majeures (filtre « Toutes · 18+ »).
import '../styles/base.css';
import '../styles/home.css';
import '../styles/brand.css';
import { initSite } from '../app/site.js';
import { evinHTML } from '../app/blocks.js';
import { bySlug, recettes } from '../data/products.js';
import { $, esc, plural } from '../lib/dom.js';
import { noteRevue } from '../lib/revue.js';

// Photos des recettes : 619 × 1 100 px (618 pour deux), réduites à l'import (scripts/import-site.mjs).
const IMG = 'width="619" height="1100"';

const site = initSite();
let filtre = 'sans';
const visibles = () => recettes.filter((r) => !r.alcool || (site.majeur && filtre === 'toutes'));
const list = (items) => (items?.length ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
// Lignes « Pour 2 personnes : », « Dans un verre de 50 cl : » : intertitres
const steps = (items) =>
  items?.length
    ? `<ol class="rec-steps">${items.map((x) => (/:\s*$/.test(x) && x.length < 60 ? `<li class="rec-steps__sub">${esc(x)}</li>` : `<li>${esc(x)}</li>`)).join('')}</ol>`
    : '';

function render() {
  const sans = recettes.filter((r) => !r.alcool).length;
  $('#rec-lead').textContent = `Les ${recettes.length} recettes publiées par la distillerie\u00a0: cocktails, boissons et desserts. Les ${sans} recettes sans alcool s’affichent d’abord\u202f; celles qui contiennent de l’alcool sont réservées aux personnes majeures.`;
  $('#rec-filtre').innerHTML = `<button type="button" class="cat${filtre === 'sans' ? ' is-on' : ''}" data-f="sans" aria-pressed="${filtre === 'sans'}">Sans alcool<span class="cat__n">${sans}</span></button>
    <button type="button" class="cat${filtre === 'toutes' ? ' is-on' : ''}" data-f="toutes" aria-pressed="${filtre === 'toutes'}">Toutes les recettes · 18+<span class="cat__n">${site.majeur ? recettes.length : ''}</span></button>`;
  const items = visibles();
  $('#rec-grid').innerHTML = items
    .map(
      (r) => `<li class="rcard"><a href="#${r.id}">
        <span class="rcard__img"><img src="${r.image}" alt="" ${IMG} loading="lazy" decoding="async" /></span>
        <span class="rcard__title">${esc(r.titre)}</span>
        ${r.alcool ? '<span class="badge badge--age">18+</span>' : '<span class="rcard__meta">Sans alcool</span>'}
      </a></li>`,
    )
    .join('');
  $('#rec-list').innerHTML = items
    .map(
      (r) => `<article class="section rec" id="${r.id}" aria-labelledby="t-${r.id}">
        <div class="wrap rec__in">
          <figure class="rec__img"><img src="${r.image}" alt="${esc(r.titre)}" ${IMG} loading="lazy" decoding="async" /></figure>
          <div class="rec__body">
            <p class="kicker">${r.alcool ? 'Avec alcool · 18+' : 'Sans alcool'}</p>
            <h2 class="h-section rec__title" id="t-${r.id}">${esc(r.titre)}</h2>
            ${r.produits?.length ? `<p class="rec__products">Avec ${r.produits.filter((s) => bySlug[s] && (!bySlug[s].alcool || site.majeur)).map((s) => `<a class="link" href="/boutique/${s}">${esc(bySlug[s].nom)}</a>`).join(', ')}</p>` : ''}
            <div class="rec__cols">
              ${r.ingredients?.length ? `<div><h3 class="rec__h">Ingrédients</h3>${list(r.ingredients)}</div>` : ''}
              ${r.decoration?.length ? `<div><h3 class="rec__h">Décoration</h3>${list(r.decoration)}</div>` : ''}
            </div>
            ${r.preparation?.length ? `<div><h3 class="rec__h">Préparation</h3>${steps(r.preparation)}</div>` : ''}
            ${r.notes?.length ? `<div class="rec__notes">${r.notes.map((n) => `<p>${esc(n)}</p>`).join('')}</div>` : ''}
            ${noteRevue(`Recette du site de la distillerie · <a class="link" href="${r.url}" target="_blank" rel="noopener">voir la page<span class="sr-only"> (nouvel onglet)</span></a>`, { tag: 'p', cls: 'bsource' })}
            ${r.alcool ? evinHTML('rec__evin') : ''}
          </div>
        </div>
      </article>`,
    )
    .join('');
  $('#rec-evin').innerHTML = '';
  const id = location.hash.slice(1);
  if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' });
}

$('#rec-filtre').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-f]');
  if (!b) return;
  if (b.dataset.f === 'toutes' && !site.majeur) {
    const age = await site.requireAge();
    if (age !== 'majeur') return;
  }
  filtre = b.dataset.f;
  render();
});
// Lien direct vers une recette avec alcool : on la montre aux majeurs
if (recettes.find((r) => r.id === location.hash.slice(1))?.alcool && site.majeur) filtre = 'toutes';
site.onAge(() => {
  if (!site.majeur) filtre = 'sans';
  render();
});
render();
