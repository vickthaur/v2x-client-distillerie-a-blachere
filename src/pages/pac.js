// Page de marque PAC Citron : plein écran fuchsia rayé, femme à la paille coupée par le bord
// gauche (sa paille pointe vers l'ovale « Trouver un PAC »), bouteille 3D, histoire, rituel,
// formats, salle des collectors (cadres « visuel à fournir »), étiquettes anciennes.
import '../styles/base.css';
import '../styles/shop.css';
import '../styles/editorial.css';
import '../styles/pages.css';
import { initSite, addToCart, reveal } from '../app/site.js';
import { collectorsHTML } from '../app/blocks.js';
import { cardHTML } from '../app/cards.js';
import { mountFemme, mountBottle } from '../app/hero-tools.js';
import { bySlug, euro, UNIVERS } from '../data/products.js';
import { archives } from '../lib/archives.js';
import { $, esc } from '../lib/dom.js';
import { icons } from '../lib/icons.js';
import { upgradeThumbs } from '../lib/thumbs.js';

initSite();
const p = bySlug['pac-citron'];
const c = p.contenances[0];

$('#bhero-buy').innerHTML = `<button type="button" class="btn btn--white" data-add="${p.slug}" data-v="${c.id}">${icons.bag}<span>Ajouter · ${esc(c.volume)} · ${euro(c.prix)}</span></button>`;
$('#pac-card').innerHTML = cardHTML(p);
upgradeThumbs($('#pac-card'));
$('#collectors-frames').innerHTML = collectorsHTML();
$('#pac-wall').innerHTML = `<ul class="wall__grid">${archives
  .filter((a) => a.gamme === 'PAC' && a.aile === 'sirops' && a.svg)
  .map((a, i) => `<li class="wall__item" style="--tilt:${[-2, 1.2, -0.6, 1.8, -1.4, 0.8, -1.8, 1.1, -0.9][i % 9]}deg"><a href="/musee#${a.id}" aria-label="${esc(a.titre)}">${a.svg()}</a></li>`)
  .join('')}</ul>`;

mountFemme($('#bhero-femme'), { straw: $('#bhero-straw'), target: '#bhero-cta', scope: $('#bhero') });
mountBottle($('#bstage'), p, UNIVERS.pac.scene);
reveal();

document.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  if (add) addToCart(add.dataset.add, add.dataset.v || null);
});
