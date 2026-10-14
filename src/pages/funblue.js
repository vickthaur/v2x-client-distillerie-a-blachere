// Page de marque Fun Blue : campagne 3D (la vraie bouteille sur l'aplat bleu, glaçons et menthe),
// l'histoire racontée par la fiche officielle (de la menthe bleue « Aurélie » à Fun Blue), le
// rituel, la composition, les recettes et les étiquettes d'archives.
import '../styles/base.css';
import '../styles/home.css';
import '../styles/brand.css';
import { initSite } from '../app/site.js';
import { mountBrandHero, priceCardHTML, compositionHTML, recipesHTML, piecesHTML, ailleursHTML, bindAdd, bySlug, reveal } from '../app/brand.js';
import textes from '../data/site/textes.json';
import { $, esc } from '../lib/dom.js';

const site = initSite();
const p = bySlug['fun-blue'];

$('#bhero-price').innerHTML = priceCardHTML(p);

// « Le saviez-vous ? » de la fiche, puis la page Histoire (« le digne petit frère du PAC Citron »).
const histoire = textes.histoire.periodes.flatMap((x) => x.paragraphes).find((x) => /Fun Blue/.test(x));
const frere = histoire ? /donnant naissance au « Fun Blue »[^.]*\./.exec(histoire)?.[0] : null;
$('#fb-saviez').innerHTML = [
  ...(p.saviezVous || '')
    .split(/\n\s*\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => `<p>${esc(x)}</p>`),
  frere ? `<p>La page Histoire de la maison raconte qu’elle a orienté son activité vers les sirops, ${esc(frere.charAt(0).toLowerCase() + frere.slice(1))}</p>` : '',
].join('');
$('#fb-pieces-a').innerHTML = piecesHTML(['aurelie', 'fun-blue-70cl']);

function usages() {
  const lines = (p.application || '')
    .split(/\n\s*\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => (site.majeur ? x : x.replace(/,\s*de la bière/gi, '')));
  $('#fb-usages').innerHTML = lines.map((x) => `<p>${esc(x)}</p>`).join('');
}
usages();

$('#fb-facts').innerHTML = compositionHTML(p);
const recipes = () => ($('#fb-recipes').innerHTML = recipesHTML(['fun-blue'], site.majeur, 3) || '<p class="lead">Les recettes de la maison sont dans la rubrique Recettes.</p>');
recipes();
$('#fb-pieces').innerHTML = piecesHTML(['aurelie', 'menthe-glaciale', 'fun-blue-70cl', 'menthe-special-bar']);
$('#fb-ailleurs').innerHTML = `<p class="lead">À la boutique de la distillerie, à Châteauneuf-du-Pape, et dans la boutique en ligne : ${esc(p.contenances.map((c) => c.volume).join(', '))}.</p>${ailleursHTML(p)}`;

mountBrandHero('funblue', [p]);
bindAdd();
reveal();
site.onAge(() => {
  usages();
  recipes();
});
