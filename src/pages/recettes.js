// Recettes : le Blue Mojito (seule recette dont l'adresse et les ingrédients sont connus), les
// autres titres de l'index officiel (sans ingrédients inventés) et les idées des fiches des
// sirops. Filtre « sans alcool » par défaut ; les recettes avec alcool (ou de type incertain)
// n'apparaissent qu'aux personnes majeures, même pour un sirop.
import '../styles/base.css';
import '../styles/editorial.css';
import '../styles/pages.css';
import { initSite } from '../app/site.js';
import { evinHTML } from '../app/blocks.js';
import { bySlug, recettes } from '../data/products.js';
import { $, esc } from '../lib/dom.js';

const site = initSite();
let filtre = 'sans';

// Idées notées sur les fiches des sirops (catalogue de la recherche) : noms seulement.
const IDEES = [
  { titre: 'Shirley Temple', produit: 'sirop-couleur-provence-grenadine', alcool: false },
  { titre: 'Kiwi, banane et une pointe de pomme', produit: 'sirop-couleur-provence-kiwi', alcool: false },
  { titre: 'Vinaigrette au sirop de châtaigne, vinaigre balsamique et huile d’olive', produit: 'sirop-chataigne', alcool: false },
  { titre: 'Monaco, Tomate, Tequila Sunrise', produit: 'sirop-couleur-provence-grenadine', alcool: true },
  { titre: 'Mauresque : pastis et sirop d’orgeat', produit: 'sirop-couleur-provence-orgeat', alcool: true },
  { titre: 'Mojito, caïpirinha, ti-punch', produit: 'sucre-de-canne', alcool: true },
];

const mojito = recettes.find((r) => r.titre === 'Le Blue Mojito');
$('#mojito').innerHTML = `<ul>${mojito.ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
  <p class="recette__prep" style="margin-top:14px">${esc(mojito.preparation)}</p>
  <p style="margin-top:14px"><a class="link" href="${mojito.url}" target="_blank" rel="noopener">La recette sur le site actuel<span class="sr-only"> (nouvel onglet)</span></a></p>`;

const show = (alcool) => !alcool || (site.majeur && filtre === 'toutes');

function render() {
  $('#rec-filtre').innerHTML = `<button type="button" data-f="sans" aria-pressed="${filtre === 'sans'}">Sans alcool</button>
    <button type="button" data-f="toutes" aria-pressed="${filtre === 'toutes'}">Toutes les recettes · 18+</button>`;
  const index = recettes.filter((r) => r.titre !== 'Le Blue Mojito' && show(r.alcool));
  $('#rec-index').innerHTML = index
    .map(
      (r) => `<li class="rec-item"><p class="${r.alcool ? 'tbc' : 'badge-sans'}">${r.alcool ? 'Avec alcool · 18+' : 'Sans alcool'}</p><h3>${esc(r.titre)}</h3>
      ${r.produits?.length ? `<p>Avec ${r.produits.map((s) => `<a class="link" href="/boutique/${s}">${esc(bySlug[s]?.nom || s)}</a>`).join(', ')}</p>` : ''}
      <p>Recette à reprendre du site de la distillerie.</p></li>`,
    )
    .join('');
  $('#rec-idees').innerHTML = IDEES.filter((i) => show(i.alcool))
    .map(
      (i) => `<li class="rec-item"><p class="${i.alcool ? 'tbc' : 'badge-sans'}">${i.alcool ? 'Avec alcool · 18+' : 'Sans alcool'}</p><h3>${esc(i.titre)}</h3>
      <p>Idée de la fiche du <a class="link" href="/boutique/${i.produit}">${esc(bySlug[i.produit]?.nom.toLowerCase())}</a>.</p></li>`,
    )
    .join('');
  $('#rec-evin').innerHTML = site.majeur && filtre === 'toutes' ? `<div style="margin-top:24px">${evinHTML()}</div>` : '';
}

$('#rec-filtre').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-f]');
  if (!b) return;
  if (b.dataset.f === 'toutes' && !site.majeur) {
    const age = await site.requireAge();
    if (age !== 'majeur') return;
  }
  filtre = b.dataset.f;
  render();
});
site.onAge(() => {
  if (!site.majeur) filtre = 'sans';
  render();
});
render();
