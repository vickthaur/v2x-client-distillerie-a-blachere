// La maison : l'histoire racontée par la page Histoire du site officiel (quatre époques, texte
// exact), avec les archives de chaque époque ; le savoir-faire ; les papiers de la rue Molière ;
// le chantier. Pour les personnes qui n'ont pas vérifié leur âge, les phrases qui parlent d'alcool
// sont retirées (jamais réécrites) et les archives des spiritueux ne s'affichent pas.
import '../styles/base.css';
import '../styles/home.css';
import '../styles/brand.css';
import { initSite, reveal } from '../app/site.js';
import { fillPlaces } from '../app/lieux.js';
import { pieceById, pieceHTML } from '../app/pieces.js';
import textes from '../data/site/textes.json';
import { phrasesSansAlcool, hasAlcool } from '../lib/alcool.js';
import { $, esc } from '../lib/dom.js';

const site = initSite();
const PIECES = [
  ['lettre-maison-fondee-1835', 'manuscrit-1726', 'entete-aug-blachere'],
  ['pac-1962', 'papalines', 'petit-calan'],
  ['camarguaise', 'mauresque'],
  ['fun-blue-70cl', 'lavande-flacons', 'ardechoise-chataigne'],
];

function render() {
  const majeur = site.majeur;
  const h = textes.histoire;
  $('#maison-epi').textContent = h.epigraphe;
  const stand = pieceById['stand-palais-des-papes'];
  $('#maison-hero-fig').innerHTML = `<span class="piece__frame"><span class="piece__mat"><img src="${stand.image}" alt="${esc(stand.titre)}" width="${stand.largeur}" height="${stand.hauteur}" /></span></span><figcaption class="cartel"><span class="cartel__title">${esc(stand.titre)}</span><span class="cartel__meta">${esc(stand.technique)} · archive de la distillerie</span></figcaption>`;
  let retirees = 0;
  $('#periodes').innerHTML = h.periodes
    .map((p, i) => {
      const paras = p.paragraphes
        .map((x) => {
          if (majeur) return x;
          const t = phrasesSansAlcool(x);
          if (t !== x.replace(/\s+/g, ' ').trim()) retirees++;
          return t;
        })
        .filter(Boolean);
      const pcs = (PIECES[i] || []).map((id) => pieceById[id]).filter((x) => x && (x.aile !== 'spiritueux' || majeur));
      const [a, b] = p.titre.split(/\s*-\s*/);
      return `<article class="mh-periode" data-reveal>
        <h3 class="mh-periode__dates"><span>${esc(a)}</span>${b ? `<span class="mh-periode__to">${esc(/^à/.test(b) ? b : `à ${b}`)}</span>` : ''}</h3>
        <div class="mh-periode__body prose">${paras.map((x) => `<p>${esc(x)}</p>`).join('')}</div>
        ${pcs.length ? `<ul class="pieces mh-periode__pieces">${pcs.map((x) => pieceHTML(x)).join('')}</ul>` : '<div></div>'}
      </article>`;
    })
    .join('');
  $('#histoire-note').textContent = majeur || !retirees ? '' : 'Les passages qui parlent des liqueurs, des marcs et des pastis de la maison s’affichent après la vérification de l’âge.';

  // Savoir-faire : la page Histoire (plantes et secrets de la maison), puis le parcours de la visite
  const all = h.periodes.flatMap((p) => p.paragraphes);
  const secrets = all.find((x) => /garde précieusement mes secrets/.test(x)) || '';
  const savoir = [majeur ? secrets : phrasesSansAlcool(secrets), 'La visite de la distillerie passe par l’herboristerie, la salle d’étiquetage, le vieux chai et la production, derrière les vitres.'].filter(Boolean);
  $('#savoir-texte').innerHTML = savoir.map((x) => `<p>${esc(x)}</p>`).join('');
  $('#savoir-photos').innerHTML = majeur
    ? `<figure class="ph"><span class="ph__slot" data-lieu="boutique-rayons"></span><figcaption>La boutique de la distillerie</figcaption></figure>
       <figure class="ph"><img src="${pieceById['chai-futs'].image}" alt="" loading="lazy" /><figcaption>Les fûts du chai (archive de la distillerie)</figcaption></figure>`
    : `<figure class="ph ph--archive"><img src="${pieceById['lettre-14-rue-moliere'].image}" alt="" loading="lazy" /><figcaption>Papier à en-tête, 14 rue Molière</figcaption></figure>
       <figure class="ph ph--archive"><img src="${pieceById['avenue-de-la-gare'].image}" alt="" loading="lazy" /><figcaption>Avignon, avenue de la Gare (carte postale)</figcaption></figure>`;
  fillPlaces($('#savoir-photos'));
  $('#maison-pieces').innerHTML = `<ul class="pieces">${['lettre-maison-fondee-1835', 'lettre-14-rue-moliere', 'avenue-de-la-gare', 'stand-palais-des-papes']
    .map((id) => pieceHTML(pieceById[id]))
    .join('')}</ul>`;
  reveal();
}

site.onAge(render);
render();
