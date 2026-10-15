// Page de marque PAC Citron : campagne 3D (la vraie bouteille sur l'aplat fuchsia, citrons et
// glaçons), l'histoire racontée par la fiche officielle, le rituel du PAC à l'eau, la composition,
// les recettes, les étiquettes d'archives et la presse.
import '../styles/base.css';
import '../styles/home.css';
import '../styles/brand.css';
import '../styles/operation.css';
import { initSite } from '../app/site.js';
import { mountBrandHero, priceCardHTML, compositionHTML, recipesHTML, piecesHTML, pressHTML, ailleursHTML, bindAdd, bySlug, reveal } from '../app/brand.js';
import { actualites } from '../data/site.js';
import textes from '../data/site/textes.json';
import { $, esc } from '../lib/dom.js';
import { monterBandeau } from '../lib/operation.js';
import { noteRevue } from '../lib/revue.js';

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

// Les étiquettes collector des 60 ans : vues seulement dans la presse (aucune image reprise) ;
// les faits et la source viennent de src/data/site.js (actualités).
const collec = actualites.find((a) => a.id === 'collectors');
if (collec)
  $('#collectors').innerHTML = `<p class="kicker">${esc(collec.rubrique)} · ${esc(collec.quand)}</p>
    <h3 class="bcollec__title">${esc(collec.titre)}</h3>
    <p class="bcollec__text">${esc(collec.texte)}${noteRevue(collec.source ? ` Source : <a class="link" href="${collec.source.url}" target="_blank" rel="noopener">${esc(collec.source.nom)}<span class="sr-only"> (nouvel onglet)</span></a>.` : '')}</p>
    <a class="arrow-link" href="/musee#collectors-60-ans">Dans les archives, parmi les pièces sans visuel <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></a>`;
$('#pac-press').innerHTML = pressHTML((t) => /\bpac\b/i.test(t), 7);
$('#pac-ailleurs').innerHTML = `<p class="lead">À la boutique de la distillerie, à Châteauneuf-du-Pape, et dans la boutique en ligne : ${esc(p.contenances.map((c) => c.volume).join(', '))}.</p>${ailleursHTML(p)}`;

mountBrandHero('pac', [p]);
bindAdd();
reveal();
// lien direct vers une section remplie ici (#collectors) : on s'y rend une fois le contenu posé
if (location.hash.length > 1) document.getElementById(location.hash.slice(1))?.scrollIntoView();
site.onAge(() => {
  usages();
  recipes();
});
