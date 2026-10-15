// Actualités : les nouvelles de la maison (datées et sourcées : festival, saison des visites,
// chantier, éditions limitées), puis la rubrique « On parle de nous » du site officiel (titre,
// date, lien ; jamais les images de presse, dont les droits appartiennent aux journaux).
import '../styles/base.css';
import '../styles/home.css';
import '../styles/brand.css';
import { initSite, reveal } from '../app/site.js';
import { pressHTML } from '../app/brand.js';
import { actualites } from '../data/site.js';
import { $, esc } from '../lib/dom.js';
import { noteRevue } from '../lib/revue.js';

// Date inconnue (« Date à confirmer ») ou à venir (« date à annoncer ») : note de la maquette.
const aConfirmer = (t) => /à (confirmer|annoncer|préciser)/i.test(t || '');

const site = initSite();
function render() {
  $('#actus').innerHTML = actualites
    .filter((a) => !a.alcool || site.majeur)
    .map(
      (a) => `<li class="newscard" data-reveal>
        <p class="newscard__meta"><span>${esc(a.rubrique)}</span>${aConfirmer(a.quand) ? noteRevue(esc(a.quand)) : `<span>${esc(a.quand)}</span>`}</p>
        <h3 class="newscard__title">${esc(a.titre)}</h3>
        <p class="newscard__text">${esc(a.texte)}</p>
        ${a.suite ? (aConfirmer(a.suite) ? noteRevue(esc(a.suite), { tag: 'p', cls: 'newscard__text' }) : `<p class="newscard__text">${esc(a.suite)}</p>`) : ''}
        ${a.lien ? `<a class="newscard__src" href="${a.lien.href}">${esc(a.lien.texte)}</a>` : ''}
        ${a.source ? noteRevue(`<a class="newscard__src newscard__src--ext" href="${a.source.url}" target="_blank" rel="noopener">Source : ${esc(a.source.nom)}<span class="sr-only"> (nouvel onglet)</span></a>`, { tag: 'p' }) : ''}
      </li>`,
    )
    .join('');
  $('#presse').innerHTML = pressHTML(() => true, 40);
  reveal();
}
site.onAge(render);
render();
