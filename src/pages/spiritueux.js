// Nos spiritueux (porte d'âge) : rien n'est affiché (ni nom, ni visuel, ni prix) avant la
// vérification de l'âge. Pour les personnes majeures : les quatre rayons de la boutique
// officielle (apéritifs et pastis, liqueurs, crèmes et eaux-de-vie, vieux marcs), chacun raconté
// par la page Histoire de la maison et ses archives (affiches, étiquettes, photographies du chai),
// avec les produits sur fond neutre. Mentions de la loi Évin seulement (degré, origine, composition,
// fabricant, élaboration, mode de consommation), le message sanitaire une fois par rayon, sous sa
// grille (pas sous chaque carte).
import '../styles/base.css';
import '../styles/home.css';
import '../styles/brand.css';
import { initSite, addToCart, reveal } from '../app/site.js';
import { evinHTML, lockHTML } from '../app/blocks.js';
import { cardHTML, regrouperMillesimes, estMillesimeElixir } from '../app/cards.js';
import { imgPiece, pieceById, pieceHTML } from '../app/pieces.js';
import { products, euro } from '../data/products.js';
import textes from '../data/textes.js';
import { $, esc, calm, plural } from '../lib/dom.js';
import { noteRevue } from '../lib/revue.js';
import { upgradeThumbs } from '../lib/thumbs.js';

const site = initSite({ askAge: false });
const root = $('#spirits-root');
const H = textes.histoire.periodes.flatMap((x) => x.paragraphes);
const find = (rx) => H.find((x) => rx.test(x)) || '';
const sentence = (text, rx) => (text.match(/[^.!?]+[.!?]/g) || []).find((x) => rx.test(x))?.trim() || '';

// Les rayons, dans l'ordre de la boutique officielle ; textes tirés de la page Histoire.
const RAYONS = [
  {
    gamme: 'pastis-aperitifs',
    titre: 'Les apéritifs et les pastis',
    texte: [
      sentence(find(/Pastis Marra/), /Pastis Marra/),
      sentence(find(/Pastis Camarguais/), /Pastis Camarguais/),
      sentence(find(/Lou Gardian/), /Lou Gardian/),
    ],
    pieces: ['mauresque', 'cordial-anis'],
  },
  {
    gamme: 'liqueurs',
    titre: 'Les liqueurs',
    texte: [
      sentence(find(/Thym, romarin/), /J’y puise/),
      sentence(find(/frère Imbert/), /La Magistrale/),
      sentence(find(/Papalines/), /Origan du Comtat/),
      sentence(find(/sérigraphiée/), /sérigraphiée/),
    ],
    pieces: ['origan-1884', 'magistrale-affiche', 'camarguaise', 'lavande-flacons'],
  },
  {
    gamme: 'cremes-eaux-de-vie',
    titre: 'Les crèmes et les eaux-de-vie',
    texte: [sentence(find(/l’Ardéchoise/i), /l’Ardéchoise/i).replace(/^.*?(j’élabore)/, 'J’élabore'), 'Et des eaux-de-vie de fruits (poire, framboise…), comme Flirt®, eau-de-vie de poires Williams.'],
    pieces: ['ardechoise-chataigne', 'creme-banane', 'creme-cacao'],
  },
  {
    gamme: 'marcs',
    titre: 'Les vieux marcs',
    texte: [sentence(find(/vieux marcs/), /vieux marcs/), sentence(find(/marc de Châteauneuf-du-Pape/), /marc de Châteauneuf-du-Pape/)],
    pieces: ['chai-futs', 'petit-calan', 'cave-bouteilles'],
  },
];

// Carte de cave des millésimes de l'Elixir®, sous leur carte : l'année, le prix, le lien vers la
// fiche (une fiche par millésime).
function caveHTML(items) {
  const ordre = [...items].sort((a, b) => Number(a.millesime) - Number(b.millesime));
  return `<div class="cave" id="millesimes-elixir">
    <h3 class="cave__title">Les millésimes de l’Elixir<sup>®</sup></h3>
    <ol class="cave__list">${ordre
      .map((p) => {
        const c = p.contenances[0];
        return `<li><a href="/boutique/${p.slug}"><span class="cave__an">${esc(p.millesime)}</span><span class="cave__fil" aria-hidden="true"></span><span class="cave__prix">${c?.prix != null ? euro(c.prix) : 'Prix en boutique'}</span></a></li>`;
      })
      .join('')}</ol>
  </div>`;
}

function render() {
  if (site.age !== 'majeur') {
    document.title = 'Nos spiritueux · réservé aux personnes majeures · Distillerie A. Blachère';
    $('#spirits-lead').innerHTML = '';
    $('#spirits-photo').innerHTML = '';
    $('#spirits-photo').hidden = true;
    root.innerHTML = `<section class="section"><div class="wrap">${lockHTML({ mineur: site.age === 'mineur', titre: 'Cette page est réservée aux personnes majeures' })}</div></section>`;
    $('[data-verify]', root)?.addEventListener('click', () => site.requireAge());
    return;
  }
  document.title = 'Nos spiritueux · Distillerie A. Blachère';
  const n = products.filter((p) => p.alcool).length;
  const garrigue = sentence(find(/Thym, romarin/), /J’y puise/);
  $('#spirits-lead').innerHTML = `<p class="lead">${esc(garrigue ? `«\u00a0${garrigue}\u00a0»` : '')} ${plural(n, 'référence')} dans la boutique\u00a0: apéritifs et pastis, liqueurs, crèmes, eaux-de-vie et vieux marcs.</p>`;
  const chai = pieceById['chai-lumiere'];
  $('#spirits-photo').hidden = false;
  $('#spirits-photo').innerHTML = `${imgPiece(chai, { sizes: '(max-width: 900px) 92vw, 42vw', eager: true })}<figcaption>${esc(chai.titre)} · ${esc(chai.technique)}, archive de la distillerie</figcaption>`;
  root.innerHTML = RAYONS.map((r) => {
    const items = products.filter((p) => p.gamme === r.gamme);
    // Vieux marcs : les millésimes de l'Elixir® en une carte, puis leur carte de cave
    const cartes = regrouperMillesimes(items);
    return `<section class="section sp-rayon" id="${r.gamme}" aria-labelledby="t-${r.gamme}">
      <div class="wrap">
        <div class="sp-rayon__head">
          <div class="sp-rayon__copy" data-reveal>
            <p class="kicker">${esc(g?.nom || r.titre)} · ${plural(items.length, 'produit')}</p>
            <h2 class="h-section" id="t-${r.gamme}">${esc(r.titre)}</h2>
            <div class="prose">${r.texte.filter(Boolean).map((t) => `<p>${esc(t)}</p>`).join('')}</div>
            ${noteRevue('D’après la page Histoire du site de la distillerie.', { tag: 'p', cls: 'bsource' })}
          </div>
          <ul class="pieces sp-rayon__pieces">${r.pieces.map((id) => pieceById[id]).filter(Boolean).map((p) => pieceHTML(p)).join('')}</ul>
        </div>
        <ul class="grid sp-rayon__grid">${cartes.map((p) => cardHTML(p, { href: '#millesimes-elixir' })).join('')}</ul>
        ${cartes.length < items.length ? caveHTML(items.filter(estMillesimeElixir)) : ''}
        ${evinHTML('sp-rayon__evin evin--cartes')}
      </div>
    </section>`;
  }).join('');
  upgradeThumbs(root);
  reveal(root);
  if (location.hash) $(location.hash)?.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth' });
}

document.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  if (add) addToCart(add.dataset.add, add.dataset.v || null);
});

site.onAge(render);
render();
// Sans âge vérifié, la question est posée tout de suite.
if (site.age === null || site.age === 'sirops') site.requireAge();

if (import.meta.env.DEV) window.__spirits = products.filter((p) => p.alcool).length;
