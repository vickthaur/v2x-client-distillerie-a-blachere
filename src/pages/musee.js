// Le musée de l'étiquette : trois vues (le mur, la frise, la fiche) sur le même modèle de données
// (src/lib/archives.js). L'aile des sirops est ouverte ; l'aile des spiritueux (affiche de
// l'Origan, étiquettes d'alcool) n'apparaît qu'aux personnes majeures.
import '../styles/base.css';
import '../styles/editorial.css';
import '../styles/pages.css';
import { initSite, reveal } from '../app/site.js';
import { evinHTML, lockHTML } from '../app/blocks.js';
import { archives, pieceSVG } from '../lib/archives.js';
import { $, $$, esc, calm } from '../lib/dom.js';

const site = initSite();
const GAMMES = ['Toutes', 'PAC', 'Menthe bleue et Fun Blue', 'Objets', 'Collectors'];
const FRISE = ['Années 1960 ?', 'Années 1970', '1960 – 1995', 'Depuis 1995', '2012', '2023', 'Aujourd’hui', 'À dater'];
const TILTS = [-2, 1.2, -0.6, 1.8, -1.4, 0.8, -1.8, 1.1, -0.9, 1.5, -1.2, 0.6];
const params = new URLSearchParams(location.search);
const state = { vue: params.get('vue') || 'mur', gamme: 'Toutes', id: location.hash.slice(1) || null };
if (state.id && archives.some((a) => a.id === state.id)) state.vue = 'fiche';

const visibles = () => archives.filter((a) => a.aile === 'sirops' || site.majeur);
const inGamme = (a) => state.gamme === 'Toutes' || a.gamme === state.gamme || a.aile === 'spiritueux';

const tile = (a, i) =>
  `<li class="wall__item" style="--tilt:${TILTS[i % TILTS.length]}deg"><button type="button" data-piece="${a.id}" aria-label="${esc(a.titre)} : voir la fiche">${pieceSVG(a)}</button></li>`;

function wing(title, items, extra = '') {
  return `<section class="musee-aile">
    <div class="musee-aile__head"><h2 class="musee-aile__title">${title}</h2><p class="note">${items.length} pièce${items.length > 1 ? 's' : ''}</p></div>
    ${extra}
    ${items.length ? `<div class="wall"><ul class="wall__grid">${items.map(tile).join('')}</ul></div>` : ''}
  </section>`;
}

function spiritsWing() {
  if (!site.majeur)
    return `<section class="musee-aile"><div class="musee-aile__head"><h2 class="musee-aile__title">L’aile des spiritueux</h2></div>${lockHTML({
      mineur: site.age === 'mineur',
      titre: 'Aile réservée aux personnes majeures',
      texte: 'Affiches et étiquettes des liqueurs, pastis et marcs : indiquez votre date de naissance pour entrer.',
    })}</section>`;
  const items = archives.filter((a) => a.aile === 'spiritueux');
  return wing('L’aile des spiritueux', items, evinHTML());
}

function renderMur() {
  const sirops = archives.filter((a) => a.aile === 'sirops' && inGamme(a));
  return wing('L’aile des sirops', sirops) + spiritsWing();
}

function renderFrise() {
  const items = visibles().filter(inGamme);
  const rows = FRISE.map((label) => [label, items.filter((a) => a.frise === label)]).filter(([, l]) => l.length);
  return `<div class="musee-frise">${rows
    .map(
      ([label, list]) => `<div class="musee-frise__row"><p class="musee-frise__label">${esc(label)}</p><ul class="wall__grid">${list.map(tile).join('')}</ul></div>`,
    )
    .join('')}</div>${site.majeur ? '' : `<p class="note" style="margin-top:20px">L’aile des spiritueux s’ajoute à la frise après la vérification de l’âge.</p>`}`;
}

function renderFiche() {
  const list = visibles();
  let i = list.findIndex((a) => a.id === state.id);
  if (i < 0) i = 0;
  const a = list[i];
  state.id = a.id;
  const prev = list[(i - 1 + list.length) % list.length];
  const next = list[(i + 1) % list.length];
  const rows = [
    ['Aile et gamme', `${a.aile === 'spiritueux' ? 'Spiritueux (18+)' : 'Sirops'} · ${a.gamme}`],
    ['Période', a.periode],
    ['Technique et support', a.technique],
    ['Auteur et crédit', a.auteur],
    ['Statut', a.statut],
    ['Image et source', a.source],
  ];
  return `<article class="fiche" id="fiche" aria-labelledby="fiche-title">
    <div class="fiche__img">${pieceSVG(a)}</div>
    <div>
      <p class="kicker">Pièce ${i + 1} sur ${list.length}</p>
      <h2 class="fiche__title" id="fiche-title">${esc(a.titre)}</h2>
      <p class="lead" style="margin-bottom:18px">${esc(a.recit)}</p>
      <dl>${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${a.aile === 'spiritueux' ? evinHTML() : ''}
      <div class="fiche__nav">
        <button type="button" class="btn btn--ghost" data-piece="${prev.id}">← ${esc(prev.titre)}</button>
        <button type="button" class="btn btn--ink" data-piece="${next.id}">${esc(next.titre)} →</button>
        <button type="button" class="link" data-vue-go="mur">Retour au mur</button>
      </div>
    </div>
  </article>`;
}

function render() {
  $$('[data-vue]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vue === state.vue)));
  $('#musee-gammes').innerHTML = GAMMES.map((g) => `<button type="button" data-gamme="${g}" aria-pressed="${g === state.gamme}">${g === 'Menthe bleue et Fun Blue' ? 'Fun Blue' : g}</button>`).join('');
  $('#musee-gammes').hidden = state.vue === 'fiche';
  const view = $('#musee-view');
  view.innerHTML = state.vue === 'frise' ? renderFrise() : state.vue === 'fiche' ? renderFiche() : renderMur();
  $('[data-verify]', view)?.addEventListener('click', () => site.requireAge());
  const url = new URL(location.href);
  if (state.vue === 'mur') url.searchParams.delete('vue');
  else url.searchParams.set('vue', state.vue);
  url.hash = state.vue === 'fiche' && state.id ? state.id : '';
  history.replaceState(null, '', url);
  reveal(view);
}

document.addEventListener('click', (e) => {
  const v = e.target.closest('[data-vue], [data-vue-go]');
  if (v) {
    state.vue = v.dataset.vue || v.dataset.vueGo;
    render();
    return;
  }
  const g = e.target.closest('[data-gamme]');
  if (g) {
    state.gamme = g.dataset.gamme;
    render();
    return;
  }
  const p = e.target.closest('[data-piece]');
  if (p) {
    state.id = p.dataset.piece;
    state.vue = 'fiche';
    render();
    $('#fiche')?.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' });
  }
});

site.onAge(render);
render();
// Arrivée sur une pièce précise (/musee#pac-roue) : la fiche est mise à l'écran.
if (state.vue === 'fiche' && location.hash) requestAnimationFrame(() => $('#fiche')?.scrollIntoView({ block: 'start' }));
