// Nos spiritueux (porte d'âge) : rien n'est affiché (ni nom, ni visuel, ni prix) avant la
// vérification de l'âge. Pour les personnes majeures : un bandeau par univers (habillage), des
// fiches sobres (mentions autorisées par la loi Évin : degré, origine, dénomination, composition,
// fabricant, élaboration, modalités de vente, mode de consommation), le message sanitaire partout.
// Les remèdes anciens sont racontés comme de l'histoire, jamais comme des bienfaits.
import '../styles/base.css';
import '../styles/shop.css';
import '../styles/editorial.css';
import '../styles/pages.css';
import { initSite, addToCart, reveal } from '../app/site.js';
import { evinHTML, lockHTML } from '../app/blocks.js';
import { cardHTML } from '../app/cards.js';
import { bySlug, products } from '../data/products.js';
import { archives } from '../lib/archives.js';
import { $, esc, calm } from '../lib/dom.js';
import { upgradeThumbs } from '../lib/thumbs.js';

const site = initSite({ askAge: false });
const root = $('#spirits-root');

const cards = (slugs) => `<ul class="grid">${slugs.map((s) => bySlug[s]).filter(Boolean).map((p) => cardHTML(p)).join('')}</ul>`;

// Feuilles stylisées pour l'herbier (dessin de la maquette, une seule forme déclinée).
const leaf = (k) => `<svg viewBox="0 0 44 56" aria-hidden="true" focusable="false"><path d="M22 54 V12"/>${[0, 1, 2, 3]
  .map((i) => {
    const y = 16 + i * 9;
    const w = 6 + ((k + i) % 3) * 3;
    return `<path d="M22 ${y + 4} q-${w} -2 -${w + 6} -${8 + (i % 2) * 3} q${w} 0 ${w + 6} ${8 + (i % 2) * 3}"/><path d="M22 ${y + 8} q${w} -2 ${w + 6} -${8 + ((i + 1) % 2) * 3} q-${w} 0 -${w + 6} ${8 + ((i + 1) % 2) * 3}"/>`;
  })
  .join('')}</svg>`;
const PLANTES = ['Thym', 'Romarin', 'Marjolaine', 'Mélisse', 'Lavande', 'Verveine', 'Armoise', 'Origan'];

function render() {
  if (site.age !== 'majeur') {
    document.title = 'Nos spiritueux · réservé aux personnes majeures · Distillerie A. Blachère';
    $('#spirits-lead').innerHTML = '';
    root.innerHTML = `<section class="section" data-univers="maison"><div class="wrap">${lockHTML({
      mineur: site.age === 'mineur',
      titre: 'Cette page est réservée aux personnes majeures',
    })}</div></section>`;
    $('[data-verify]', root)?.addEventListener('click', () => site.requireAge());
    return;
  }
  document.title = 'Nos spiritueux · Distillerie A. Blachère';
  $('#spirits-lead').innerHTML =
    '<p class="lead">Pastis et apéritifs, liqueurs, marcs et eaux-de-vie de la maison. Le rayon dit l’usage, l’habillage dit l’univers : Comtat et papes, Camargue, Ventoux et garrigue, le chai et la vigne.</p>';
  const origan = archives.find((a) => a.id === 'affiche-origan');
  root.innerHTML = `
  <section class="univers-band" id="comtat" data-univers="comtat" aria-labelledby="u-comtat">
    <div class="wrap univers-band__in">
      <div class="univers-band__text" data-reveal>
        <p class="kicker">Comtat et papes</p>
        <h2 class="univers-band__title" id="u-comtat">Le Comtat des papes et des légats</h2>
        <p class="lead">Après les papes, Avignon et le Comtat ont été gouvernés par des légats, puis par des vice-légats. Trois dates suffisent à expliquer le nom de la Réserve des Légats.</p>
        <div class="legats">
          <div><strong>1542</strong>La vice-légation devient permanente.</div>
          <div><strong>1691</strong>La fonction de légat disparaît.</div>
          <div><strong>1791</strong>Le rattachement à la France est décidé, le 14 septembre.</div>
        </div>
        <ul class="facts-list">
          <li>L’Origan du Comtat : une recette de la fin du XIXe siècle, faite de dizaines de plantes du Ventoux. Il entre dans les papalines d’Avignon, chocolats au cœur de liqueur.</li>
          <li>Il n’est pas en vente sur le site : sa disponibilité est à confirmer avec la distillerie.</li>
        </ul>
        ${cards(['marc-chateauneuf-du-pape-reserve-des-legats'])}
      </div>
      <figure class="affiche" data-reveal>
        ${origan.svg()}
        <figcaption>Évocation dessinée de l’affiche peinte du comptoir, pour la maquette. Auteur, date et technique inconnus : photo haute définition à faire.</figcaption>
      </figure>
    </div>
    <div class="wrap">${evinHTML()}</div>
  </section>

  <section class="univers-band" id="camargue" data-univers="camargue" aria-labelledby="u-camargue">
    <div class="wrap univers-band__in">
      <div class="univers-band__text" data-reveal>
        <p class="kicker">Camargue · milieu des années 1970</p>
        <h2 class="univers-band__title" id="u-camargue">Le trio camarguais</h2>
        <p class="lead">Jean-Claude Blachère, amoureux de la Camargue, crée et dépose Le Camarguais, La Camarguaise et Lou Gardian.</p>
        <ul class="facts-list">
          <li>La Camarguaise : « obtenue par distillation, macération et infusion de plus de 20 plantes et épices », dont le thym, le romarin et la réglisse. À température ambiante ou sur glace pilée.</li>
          <li>Lou Gardian : un apéritif vin et pêche, dans une bouteille sérigraphiée de motifs camarguais.</li>
          <li>Le Camarguais : l’un des derniers pastis faits à l’ancienne, selon la page Histoire de la maison.</li>
        </ul>
        <p class="note">Aucune étiquette du trio n’a encore été vue : les motifs viendront de la sérigraphie de Lou Gardian.</p>
      </div>
      <div data-reveal>${cards(['pastis-le-camarguais', 'la-camarguaise', 'aperitif-lou-gardian'])}</div>
    </div>
    <div class="wrap">${evinHTML()}</div>
  </section>

  <section class="univers-band" id="ventoux" data-univers="ventoux" aria-labelledby="u-ventoux">
    <div class="wrap univers-band__in">
      <div class="univers-band__text" data-reveal>
        <p class="kicker">Ventoux et garrigue</p>
        <h2 class="univers-band__title" id="u-ventoux">L’herbier de la maison</h2>
        <p class="lead">La page Histoire de la maison évoque le parfum puissant qui descend des hauteurs du Mont Ventoux. La visite de la distillerie passe par l’herboristerie.</p>
        <ul class="facts-list">
          <li>La maison dit avoir fabriqué de la verveine dès le début des années 1880.</li>
        </ul>
        <ul class="herbier" aria-label="Plantes citées par la maison">${PLANTES.map((n, k) => `<li>${leaf(k)}<span>${n}</span></li>`).join('')}</ul>
      </div>
      <div data-reveal>${cards(['verveine-auguste-vieilli'])}</div>
    </div>
    <div class="wrap">${evinHTML()}</div>
  </section>

  <section class="univers-band" id="marcs" data-univers="marcs" aria-labelledby="u-marcs">
    <div class="wrap univers-band__in">
      <div class="univers-band__text" data-reveal>
        <p class="kicker">Le chai et la vigne</p>
        <h2 class="univers-band__title" id="u-marcs">Marcs et eaux-de-vie</h2>
        <p class="lead">Les marcs de la maison vieillissent en fûts de chêne. La boutique range la Réserve des Légats parmi les vieux marcs de Châteauneuf-du-Pape ; elle porte l’habillage du Comtat.</p>
        <ul class="facts-list">
          <li>Flirt®, eau-de-vie de fruits : poires Williams, 43 % vol. Sa fiche la conseille aussi en cuisine : tartes aux poires, confitures, sorbets.</li>
        </ul>
      </div>
      <div data-reveal>${cards(['eau-de-vie-poire-williams-flirt'])}</div>
    </div>
    <div class="wrap">${evinHTML()}</div>
  </section>

  <section class="univers-band" id="marra" data-univers="maison" aria-labelledby="u-marra">
    <div class="wrap univers-band__in">
      <div class="univers-band__text" data-reveal>
        <p class="kicker">Pastis</p>
        <h2 class="univers-band__title" id="u-marra">Le pastis Marra</h2>
        <p class="lead">Pastis Marra · 45 % vol · réglisse en bâton macérée dans la préparation · recette de la distillerie Marra, à L’Isle-sur-la-Sorgue, rachetée en 1955.</p>
        <ul class="facts-list">
          <li>« L’essence de badiane qui se mélange à un alcoolat composé de plus de 30 plantes et épices », dit sa fiche.</li>
          <li>1 volume de pastis pour 5 à 7 volumes d’eau fraîche.</li>
        </ul>
      </div>
      <div data-reveal>${cards(['pastis-marra'])}</div>
    </div>
    <div class="wrap">${evinHTML()}</div>
  </section>`;
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
