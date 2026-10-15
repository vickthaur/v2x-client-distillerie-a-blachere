// Page de marque PAC Citron : campagne 3D (la vraie bouteille sur l'aplat fuchsia, citrons et
// glaçons), l'histoire racontée par la fiche officielle, le rituel du PAC à l'eau, la composition,
// les recettes, les étiquettes d'archives et la presse.
import '../styles/base.css';
import '../styles/home.css';
import '../styles/brand.css';
import '../styles/operation.css';
import { initSite } from '../app/site.js';
import { mountBrandHero, priceCardHTML, compositionHTML, recipesHTML, piecesHTML, pressHTML, ailleursHTML, bindAdd, bySlug, reveal } from '../app/brand.js';
import textes from '../data/site/textes.json';
import { $, esc } from '../lib/dom.js';
import { monterBandeau } from '../lib/operation.js';

const site = initSite();
const p = bySlug['pac-citron'];

// Opération du moment (Octobre Rose) : bandeau sous le héros pendant sa période.
monterBandeau($('#octobre-rose'), { titreId: 'pac-op-titre' });

$('#bhero-price').innerHTML = priceCardHTML(p);

// « Le saviez-vous ? » de la fiche (sans sa question finale, à laquelle répond la page Histoire),
// puis l'origine du nom, telle que la raconte la page Histoire.
const nom = textes.histoire.periodes.flatMap((x) => x.paragraphes).find((x) => /On doit son nom, PAC Citron/.test(x));
const saviez = (p.saviezVous || '')
  .split(/\n\s*\n/)
  .map((x) => x.trim())
  .filter((x) => x && !/d’où vient le nom/i.test(x));
$('#pac-saviez').innerHTML = [...saviez.map((x) => `<p>${esc(x)}</p>`), nom ? `<p>${esc(nom)}</p>` : ''].join('');
$('#pac-pieces-a').innerHTML = piecesHTML(['pac-1962', 'pac-boisson-1971']);

// Usages de la fiche : sans la bière pour les personnes non majeures.
function usages() {
  const lines = (p.application || '')
    .split(/\n\s*\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => (site.majeur ? x : x.replace(/,\s*de la bière/gi, '')));
  $('#pac-usages').innerHTML = lines.map((x) => `<p>${esc(x)}</p>`).join('');
}
usages();

$('#pac-facts').innerHTML = compositionHTML(p);
const recipes = () => ($('#pac-recipes').innerHTML = recipesHTML(['pac-citron'], site.majeur, 3) || '<p class="lead">Les recettes de la maison sont dans la rubrique Recettes.</p>');
recipes();
$('#pac-pieces').innerHTML = piecesHTML(['pac-1962', 'pac-boisson-1971', 'pac-fuchsia', 'pac-art-deco']);
$('#pac-press').innerHTML = pressHTML((t) => /\bpac\b/i.test(t), 7);
$('#pac-ailleurs').innerHTML = `<p class="lead">À la boutique de la distillerie, à Châteauneuf-du-Pape, et dans la boutique en ligne : ${esc(p.contenances.map((c) => c.volume).join(', '))}.</p>${ailleursHTML(p)}`;

mountBrandHero('pac', [p]);
bindAdd();
reveal();
site.onAge(() => {
  usages();
  recipes();
});
