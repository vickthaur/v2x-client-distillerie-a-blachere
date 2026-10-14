// Sirops Couleur Provence® : campagne 3D (trois bouteilles sur le plateau crème), la gamme
// rangée par contenance avec les prix officiels, les recettes et les étiquettes d'hier.
import '../styles/base.css';
import '../styles/home.css';
import '../styles/brand.css';
import { initSite } from '../app/site.js';
import { cardHTML } from '../app/cards.js';
import { mountBrandHero, recipesHTML, piecesHTML, bindAdd, bySlug, reveal } from '../app/brand.js';
import { products } from '../data/products.js';
import textes from '../data/site/textes.json';
import { $, esc, plural } from '../lib/dom.js';
import { upgradeThumbs } from '../lib/thumbs.js';

const site = initSite();
const cp = products.filter((p) => p.gamme === 'couleur-provence');

// La page Histoire : « je lance la gamme « Couleur Provence », déclinée en douze parfums… »
const histoire = textes.histoire.periodes.flatMap((x) => x.paragraphes).find((x) => /Couleur Provence/.test(x));
const phrase = histoire ? /je lance la gamme « Couleur Provence ».*?réglisse/.exec(histoire)?.[0] : null;
$('#cp-lead').innerHTML = `${phrase ? `« Fidèle à mon âme provençale et guidée par l’innovation, ${esc(phrase.replace(/\s+$/, ''))} », raconte la page Histoire de la maison. ` : ''}Aujourd’hui, ${plural(cp.length, 'sirop')} dans la boutique.`;

// La gamme, par contenance (celle de la fiche officielle)
const groups = new Map();
for (const p of cp) {
  const v = p.contenances[0]?.volume || 'Autres';
  groups.set(v, [...(groups.get(v) || []), p]);
}
const order = ['1 L', '70 cl', '50 cl'];
$('#cp-groups').innerHTML = [...groups.entries()]
  .sort((a, b) => (order.indexOf(a[0]) + 99) % 99 - ((order.indexOf(b[0]) + 99) % 99))
  .map(
    ([v, items]) => `<section class="bgamme__group" aria-label="Sirops en ${esc(v)}">
      <div class="bgamme__head"><h3 class="bgamme__title">En ${esc(v)}<span>${plural(items.length, 'parfum')}</span></h3></div>
      <ul class="grid">${items.map((p) => cardHTML(p)).join('')}</ul>
    </section>`,
  )
  .join('');
upgradeThumbs($('#cp-groups'));

const recipes = () => ($('#cp-recipes').innerHTML = recipesHTML(cp.map((p) => p.slug), site.majeur, 3));
recipes();
$('#cp-pieces').innerHTML = piecesHTML(['citron-pur-sucre', 'grenadine-pur-sucre', 'orgeat-fantaisie', 'reglisse', 'fraise-special-bar', 'sirop-cassis-cie', 'orangeade-pur-sucre', 'sirop-de-sucre-cie']);

mountBrandHero('provence', [bySlug['sirop-couleur-provence-grenadine'], bySlug['sirop-menthe'], bySlug['sirop-lavande']]);
bindAdd();
reveal();
site.onAge(recipes);
