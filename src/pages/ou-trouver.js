// Où trouver nos produits : la distillerie, puis trois couches (grandes surfaces, cavistes et
// épiceries fines, cafés), recherche sans accents par ville, enseigne ou produit. Les spiritueux
// sont filtrés tant que l'âge n'est pas confirmé (un point de vente qui ne propose que des
// spiritueux n'apparaît pas). Les cafés ne seraient cités qu'avec leur accord.
import '../styles/base.css';
import '../styles/brand.css';
import '../styles/pratique.css';
import { initSite } from '../app/site.js';
import { bySlug, EVIN } from '../data/products.js';
import { couches, infos, pointsDeVente } from '../data/site.js';
import { $, $$, esc, fold, plural, debounce } from '../lib/dom.js';
import { icons } from '../lib/icons.js';
import { noteRevue } from '../lib/revue.js';

const site = initSite();
const params = new URLSearchParams(location.search);
const state = { couche: params.get('type') || 'tous', q: params.get('q') || '' };
$('#ot-q').value = state.q;

function visibleProducts(pdv) {
  return pdv.produits.map((s) => bySlug[s]).filter((p) => p && (!p.alcool || site.majeur));
}

function render() {
  $('#ot-couches').innerHTML = [{ id: 'tous', nom: 'Tous' }, ...couches]
    .map((c) => `<button type="button" class="cat${c.id === state.couche ? ' is-on' : ''}" data-couche="${c.id}" aria-pressed="${c.id === state.couche}">${esc(c.nom)}</button>`)
    .join('');
  const q = fold(state.q.trim());
  const list = pointsDeVente
    .map((pdv) => ({ pdv, produits: visibleProducts(pdv) }))
    .filter(({ produits }) => produits.length)
    .filter(({ pdv }) => state.couche === 'tous' || pdv.couche === state.couche)
    .filter(({ pdv, produits }) => !q || fold([pdv.nom, pdv.lieu, ...produits.map((p) => p.nom)].join(' ')).includes(q));
  const home =
    (state.couche === 'tous' && (!q || fold(`distillerie blachere chateauneuf-du-pape boutique ${infos.adresseLigne}`).includes(q)))
      ? `<li class="pdv__item pdv__item--home"><div class="pdv__inner">
          <p class="pdv__couche">À la source</p>
          <p class="pdv__nom">La boutique de la distillerie</p>
          <p class="pdv__lieu">${icons.pin}${esc(infos.adresseLigne)}</p>
          <p>Toute la gamme, la dégustation et le retrait des commandes (${esc(infos.retrait)}).</p>
          <a class="link" href="/visiter">Horaires et visites</a>
        </div></li>`
      : '';
  const nom = (c) => couches.find((x) => x.id === c)?.nom || '';
  $('#ot-list').innerHTML =
    home +
    list
      .map(
        ({ pdv, produits }) => `<li class="pdv__item" data-couche="${pdv.couche}">
        <p class="pdv__couche">${esc(nom(pdv.couche))}</p>
        <p class="pdv__nom">${esc(pdv.nom)}</p>
        <p class="pdv__lieu">${icons.pin}${esc(pdv.lieu)}</p>
        <p class="pdv__produits">${produits.map((p) => `<span>${esc(p.nom)}</span>`).join('')}</p>
        ${pdv.detail ? `<p class="note">${esc(pdv.detail)}</p>` : ''}
        ${pdv.accord ? noteRevue('Accord du café à demander', { tag: 'p', cls: 'tbc' }) : ''}
        ${produits.some((p) => p.alcool) ? `<p class="note">${esc(EVIN)}</p>` : ''}
        ${pdv.url ? `<a class="link" href="${pdv.url}" target="_blank" rel="noopener">Voir chez ${esc(pdv.nom)}<span class="sr-only"> (nouvel onglet)</span></a>` : ''}
      </li>`,
      )
      .join('');
  const n = list.length + (home ? 1 : 0);
  $('#ot-count').textContent = n ? `${plural(n, 'point de vente', 'points de vente')}${site.majeur ? '' : ' · les spiritueux s’affichent après la vérification de l’âge'}` : 'Aucun point de vente ne correspond\u00a0: essayez un autre mot, ou la boutique de la distillerie.';
  const url = new URL(location.href);
  state.couche === 'tous' ? url.searchParams.delete('type') : url.searchParams.set('type', state.couche);
  state.q ? url.searchParams.set('q', state.q) : url.searchParams.delete('q');
  history.replaceState(null, '', url);
}

$('#ot-couches').addEventListener('click', (e) => {
  const b = e.target.closest('[data-couche]');
  if (!b) return;
  state.couche = b.dataset.couche;
  render();
});
$('#ot-q').addEventListener(
  'input',
  debounce((e) => {
    state.q = e.target.value;
    render();
  }, 120),
);

site.onAge(render);
render();
if (import.meta.env.DEV) window.__ot = () => $$('.pdv__item').length;
