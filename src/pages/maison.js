// La maison : l'histoire racontée par la page Histoire du site officiel (quatre époques, texte
// exact), avec les archives de chaque époque ; le savoir-faire (le parcours de la visite) ; le
// chantier. Pour les personnes qui n'ont pas vérifié leur âge, les phrases qui parlent d'alcool
// sont retirées (jamais réécrites) et les archives des spiritueux ne s'affichent pas.
import '../styles/base.css';
import '../styles/home.css';
import '../styles/brand.css';
import { initSite, reveal } from '../app/site.js';
import { fillPlaces } from '../app/lieux.js';
import { imgPiece, pieceById, pieceHTML } from '../app/pieces.js';
import textes from '../data/textes.js';
import { phrasesSansAlcool, hasAlcool, resserrer } from '../lib/alcool.js';
import { $, esc } from '../lib/dom.js';

const site = initSite();
const PIECES = [
  ['lettre-maison-fondee-1835', 'avenue-de-la-gare', 'manuscrit-1726', 'entete-aug-blachere'],
  ['pac-1962', 'papalines', 'petit-calan'],
  ['camarguaise', 'mauresque'],
  ['fun-blue-70cl', 'lavande-flacons', 'ardechoise-chataigne'],
];

function render() {
  const majeur = site.majeur;
  const h = textes.histoire;
  $('#maison-epi').textContent = h.epigraphe;
  // le bandeau (carte postale du stand au Palais des Papes) est écrit dans la-maison.html
  let retirees = 0;
  $('#periodes').innerHTML = h.periodes
    .map((p, i) => {
      const paras = p.paragraphes
        .map((x) => {
          if (majeur) return x;
          const t = phrasesSansAlcool(x);
          if (t !== resserrer(x)) retirees++;
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
  // Note neutre : elle ne nomme aucun alcool (une personne mineure la lit aussi)
  $('#histoire-note').textContent =
    majeur || !retirees ? '' : site.age === 'mineur' ? 'Certains passages de l’histoire sont réservés aux personnes majeures.' : 'Certains passages de l’histoire sont réservés aux personnes majeures\u00a0: ils s’affichent après la vérification de l’âge.';

  // Savoir-faire : le parcours de la visite (les plantes et les secrets sont déjà dans l'époque 1835).
  // Sans vérification de l'âge, deux étiquettes de sirops à la place de la boutique et du chai (des
  // bouteilles d'alcool y sont visibles).
  const savoir = ['La visite de la distillerie passe par l’herboristerie, la salle d’étiquetage, le vieux chai et la production, derrière les vitres.'];
  $('#savoir-texte').innerHTML = savoir.map((x) => `<p>${esc(x)}</p>`).join('');
  $('#savoir-photos').innerHTML = majeur
    ? `<figure class="ph"><span class="ph__slot" data-lieu="boutique-rayons"></span><figcaption>La boutique de la distillerie</figcaption></figure>
       <figure class="ph">${imgPiece(pieceById['chai-futs'], { sizes: '(max-width: 1000px) 50vw, 25vw' })}<figcaption>Les fûts du chai</figcaption></figure>`
    : ['menthe-glaciale', 'citron-pur-sucre']
        .map((id) => `<figure class="ph ph--archive">${imgPiece(pieceById[id], { sizes: '(max-width: 1000px) 40vw, 20vw' })}<figcaption>${esc(pieceById[id].titre)} (étiquette)</figcaption></figure>`)
        .join('');
  fillPlaces($('#savoir-photos'));
  reveal();
}

site.onAge(render);
render();
