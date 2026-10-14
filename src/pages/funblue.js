// Page de marque Fun Blue : l'écran bascule dans le bleu (dégradé du ciel au bleu nuit), île
// ronde à palmiers, planches à voile rayées, vagues ; bouteille 3D, d'« Aurélie » à Fun Blue,
// le Blue Mojito, les formats.
import '../styles/base.css';
import '../styles/shop.css';
import '../styles/editorial.css';
import '../styles/pages.css';
import { initSite, addToCart, reveal } from '../app/site.js';
import { cardHTML } from '../app/cards.js';
import { mountBottle } from '../app/hero-tools.js';
import { bySlug, euro, recettes, UNIVERS } from '../data/products.js';
import { archives } from '../lib/archives.js';
import { $, esc } from '../lib/dom.js';
import { icons } from '../lib/icons.js';
import { upgradeThumbs } from '../lib/thumbs.js';

initSite();
const p = bySlug['fun-blue'];
const c = p.contenances[0];

// Le lagon : horizon, île ronde à palmiers, deux planches à voile, vagues (dessin de la maquette).
function lagonSVG() {
  const palm = (x, y, h, lean) => `<path d="M${x} ${y} q${lean} ${-h * 0.5} ${lean * 1.6} ${-h}" stroke="#5b3a1e" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${[-1, -0.5, 0, 0.5, 1].map((k) => `<path d="M${x + lean * 1.6} ${y - h} q${k * 46} ${-18 + Math.abs(k) * 14} ${k * 78} ${10 + Math.abs(k) * 26}" stroke="#3f8a3c" stroke-width="9" fill="none" stroke-linecap="round"/>`).join('')}`;
  const sail = (x, y, s, flip) => `<g transform="translate(${x} ${y}) scale(${s * flip} ${s})">
    <ellipse cx="0" cy="0" rx="46" ry="6" fill="#f4f8fc"/>
    <path d="M-4 -4 L10 -150 Q48 -76 40 -6Z" fill="#f4f8fc"/>
    ${[0, 1, 2, 3, 4].map((k) => `<path d="M${-1 + k * 2.6} ${-132 + k * 28} L${16 + k * 5} ${-130 + k * 28} L${18 + k * 5} ${-118 + k * 28} L${-2 + k * 2.6} ${-120 + k * 28}Z" fill="#1d459b"/>`).join('')}
    <path d="M14 -60 q12 18 26 30" stroke="#17170f" stroke-width="3" fill="none"/><circle cx="44" cy="-58" r="6" fill="#17170f"/><path d="M44 -52 L46 -20 M46 -20 L36 -4 M46 -20 L56 -4 M44 -44 L28 -50" stroke="#17170f" stroke-width="4" stroke-linecap="round"/>
  </g>`;
  const waves = Array.from({ length: 26 }, (_, k) => `<path d="M${(k * 211) % 1600} ${70 + ((k * 37) % 190)} q14 -7 28 0" stroke="#f4f8fc" stroke-width="3" fill="none" opacity="${0.35 + ((k * 13) % 5) / 10}"/>`).join('');
  return `<svg viewBox="0 0 1600 300" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="lg-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#18afc4"/><stop offset=".45" stop-color="#357691"/><stop offset="1" stop-color="#1d459b"/></linearGradient></defs>
    <circle cx="1270" cy="-10" r="70" fill="#f0a050" opacity=".55"/>
    <rect y="40" width="1600" height="260" fill="url(#lg-sea)"/>
    <ellipse cx="1180" cy="42" rx="150" ry="16" fill="#e8c877"/>
    <path d="M1060 42 A120 64 0 0 1 1300 42Z" fill="#3f8a3c"/>
    ${palm(1140, 20, 110, -10)}${palm(1190, 8, 130, 8)}${palm(1250, 26, 90, 14)}
    ${waves}
    ${sail(120, 210, 0.9, 1)}${sail(560, 170, 0.62, -1)}
  </svg>`;
}

$('#lagon').innerHTML = lagonSVG();
$('#bhero-buy').innerHTML = `<button type="button" class="btn btn--white" data-add="${p.slug}" data-ml="${c.ml}">${icons.bag}<span>Ajouter · ${esc(c.volume)} · ${euro(c.prix)}</span></button>`;
$('#fb-card').innerHTML = cardHTML(p);
upgradeThumbs($('#fb-card'));
$('#fb-wall').innerHTML = `<ul class="wall__grid">${archives
  .filter((a) => a.gamme === 'Menthe bleue et Fun Blue')
  .map((a, i) => `<li class="wall__item" style="--tilt:${[-1.6, 1.2, -0.8][i % 3]}deg"><a href="/musee#${a.id}" aria-label="${esc(a.titre)}">${a.svg()}</a></li>`)
  .join('')}</ul>`;
const mojito = recettes.find((r) => r.titre === 'Le Blue Mojito');
$('#mojito').innerHTML = `<ul>${mojito.ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
  <p class="recette__prep" style="margin-top:14px">${esc(mojito.preparation)}</p>
  <p style="margin-top:14px"><a class="link" href="${mojito.url}" target="_blank" rel="noopener">La recette sur le site actuel<span class="sr-only"> (nouvel onglet)</span></a></p>`;

mountBottle($('#bstage'), p, UNIVERS.funblue.scene);
reveal();

document.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  if (add) addToCart(add.dataset.add, add.dataset.ml ? Number(add.dataset.ml) : null);
});
