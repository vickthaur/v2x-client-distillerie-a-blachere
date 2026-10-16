// Les archives de la maison, présentées comme au musée : trois ailes (les sirops, la maison, les
// spiritueux), un accrochage en salon (cadres, passe-partout, cartels), une pièce en grand au clic.
// L'aile des spiritueux n'apparaît qu'aux personnes majeures. Les objets vus seulement sur des
// photos de presse (dont on n'a pas les droits) ont un cartel sans image.
import '../styles/base.css';
import '../styles/brand.css';
import { initSite, reveal } from '../app/site.js';
import { evinHTML, lockHTML } from '../app/blocks.js';
import { AILES, STATUT, dateHTML, pieces, pieceById, pieceHTML } from '../app/pieces.js';
import { $, $$, esc, calm, plural } from '../lib/dom.js';
import { noteRevue, selonRevue } from '../lib/revue.js';
import { typo } from '../lib/typo.js';

const site = initSite();

// Pièces connues sans visuel utilisable (photos de presse, objets à photographier à la distillerie).
// note : ce qui reste à faire, visible seulement en mode revue (src/lib/revue.js).
const SANS_VISUEL = [
  {
    titre: 'Les étiquettes collector des 60 ans du PAC',
    date: '2023',
    technique: 'Étiquettes imprimées',
    texte: 'Trois signées par le graffeur C215, une par le peintre Claude Viallat, glissées au hasard dans la production (L’Écho du Mardi, 11 mai 2023).',
    id: 'collectors-60-ans',
  },
  {
    titre: 'Les magnums numérotés',
    date: 'Un été, sans doute 2025',
    technique: 'Édition limitée',
    texte: 'Une centaine de bouteilles numérotées des deux sirops phares de la maison, le temps d’un été (L’Écho du Mardi, décembre 2025). Édition sans doute épuisée.',
  },
  {
    titre: 'Les objets du PAC',
    date: 'Date à préciser',
    technique: 'Objets',
    texte: typo('Le T-shirt noir « Le seul, l’unique PAC », les gobelets « Summer PAC », les verres « pac » à fleurs, vus sur des photographies de presse.'),
    note: 'À photographier à la distillerie.',
  },
];

function aileHTML(a) {
  const list = pieces.filter((p) => p.aile === a.id);
  const locked = a.majeur && !site.majeur;
  return `<section class="mus-aile${a.majeur ? ' mus-aile--sp' : ''}" id="aile-${a.id}" aria-labelledby="t-${a.id}">
    <div class="wrap">
      <div class="mus-aile__head">
        <h2 class="h-section" id="t-${a.id}">${esc(a.nom)}</h2>
        <p class="mus-aile__text">${locked ? 'Réservée aux personnes majeures.' : `${esc(a.texte)} ${plural(list.length, 'pièce')}.`}</p>
      </div>
      ${
        locked
          ? lockHTML({ mineur: site.age === 'mineur', titre: 'Aile réservée aux personnes majeures', texte: 'Indiquez votre date de naissance pour entrer dans cette aile.' })
          : `<ul class="mus-wall">${list.map((p) => pieceHTML(p, { link: false, legende: true, zoom: true, sizes: '(max-width: 560px) 42vw, (max-width: 900px) 30vw, 21vw' })).join('')}</ul>
             ${a.id === 'sirops' ? sansVisuelHTML() : ''}
             ${a.majeur ? evinHTML('mus-aile__evin') : ''}`
      }
    </div>
  </section>`;
}

function sansVisuelHTML() {
  return `<div class="mus-absent">
    <h3 class="mus-absent__title">Pièces sans visuel</h3>
    <ul class="mus-absent__list">${SANS_VISUEL.map(
      (x) => `<li class="mus-absent__item"${x.id ? ` id="${x.id}"` : ''}><span class="mus-absent__frame" aria-hidden="true"><span>${selonRevue('Sans visuel', 'Pièce à photographier')}</span></span>
        <span class="cartel"><span class="cartel__title">${esc(x.titre)}</span><span class="cartel__meta">${dateHTML(x.date)}</span><span class="cartel__meta">${esc(x.technique)} · non exposé</span><span class="cartel__text">${esc(x.texte)}${noteRevue(x.note ? ` ${esc(x.note)}` : '')}</span></span></li>`,
    ).join('')}</ul>
  </div>`;
}

function render() {
  const ailes = AILES;
  $('#mus-nav').innerHTML = ailes
    .map((a) => {
      const n = pieces.filter((p) => p.aile === a.id).length;
      return `<a class="cat" href="#aile-${a.id}">${esc(a.nom)}<span class="cat__n">${a.majeur && !site.majeur ? '18+' : n}</span></a>`;
    })
    .join('');
  $('#mus-ailes').innerHTML = ailes.map(aileHTML).join('');
  $$('[data-verify]', $('#mus-ailes')).forEach((b) => b.addEventListener('click', () => site.requireAge()));
  reveal();
  const id = location.hash.slice(1);
  if (id && pieceById[id] && (pieceById[id].aile !== 'spiritueux' || site.majeur)) {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'center' });
    el?.classList.add('is-target');
  } else if (id && !pieceById[id]) document.getElementById(id)?.scrollIntoView({ block: id.startsWith('aile-') ? 'start' : 'center' }); // aile, pièce sans visuel
}

// Une pièce en grand
const dialog = $('#mus-dialog');
document.addEventListener('click', (e) => {
  const frame = e.target.closest('.mus-wall .piece__frame');
  if (frame) {
    const p = pieceById[frame.closest('.piece').id];
    if (!p) return;
    // l'image n'est posée qu'à l'ouverture (pas d'<img> sans source dans la page)
    $('#mus-dialog-fig').innerHTML = `<img src="${p.image}" alt="${esc(p.titre)}" width="${p.largeur}" height="${p.hauteur}" />`;
    $('#mus-dialog-cartel').innerHTML = `<span class="cartel__title" id="mus-dialog-title">${esc(p.titre)}</span><span class="cartel__meta">${dateHTML(p.date)}</span><span class="cartel__meta">${esc(p.technique)} · ${STATUT}</span>${p.legende ? `<span class="cartel__text">${esc(p.legende)}</span>` : ''}`;
    dialog.showModal();
    return;
  }
  if (e.target.closest('[data-close]') || e.target === dialog) dialog.close();
});

site.onAge(render);
render();
