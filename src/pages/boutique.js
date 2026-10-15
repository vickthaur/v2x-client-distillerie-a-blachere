// Boutique : filtres (univers, gamme, arôme, contenance, prix, degré, meilleures ventes),
// recherche sans accents, tri, filtres actifs, adresse synchronisée, panneau de filtres sur téléphone.
// Les spiritueux n'apparaissent qu'après la vérification de l'âge.
// Démo active dans ce navigateur : prix et stocks de la démo (« Stock bas », « Rupture » : ajout au
// panier désactivé), chargés une fois ; sans démo, aucun appel à l'API.
import '../styles/base.css';
import '../styles/shop.css';
import { initSite, addToCart } from '../app/site.js';
import { EVIN, MINEURS, GAMMES, products, visibleProducts, euro, bySlug } from '../data/products.js';
import { cardHTML, lockedCardHTML } from '../app/cards.js';
import { $, $$, esc, debounce, plural } from '../lib/dom.js';
import { applyFilters, facets, matches, parseState, serializeState, activeCount, emptyState, volumeLabel } from '../lib/filters.js';
import { icons } from '../lib/icons.js';
import { upgradeThumbs } from '../lib/thumbs.js';
import { demoCatalogue, appliquerDemo, etatDemo, indisponible, ETATS } from '../lib/demo.js';
import { noteRevue } from '../lib/revue.js';

const site = initSite();
let state = parseState(location.search);
let base = [];
let facetData = null;
let demo = null; // catalogue de la démo (prix, stocks) ou null

const spiritsCount = products.filter((p) => p.alcool).length;

// ---------- Rayons (liens texte) ----------
function renderTiles() {
  const tiles = [
    { id: 'pac', label: 'PAC Citron<sup>®</sup>' },
    { id: 'fun-blue', label: 'Fun Blue<sup>®</sup>' },
    { id: 'couleur-provence', label: 'Couleur Provence<sup>®</sup>' },
  ];
  const all = `<a class="cat" href="/boutique" data-tile="tout">Tout<span class="cat__n">${base.length}</span></a>`;
  const html = tiles
    .map((t) => {
      const n = base.filter((p) => p.gamme === t.id).length;
      return `<a class="cat" href="/boutique?gamme=${t.id}" data-tile="${t.id}">${t.label}<span class="cat__n">${n}</span></a>`;
    })
    .join('');
  const spirits =
    site.age === 'mineur'
      ? ''
      : site.majeur
        ? `<a class="cat" href="/boutique?univers=spiritueux" data-tile="spiritueux">Spiritueux 18+<span class="cat__n">${spiritsCount}</span></a>`
        : `<button type="button" class="cat cat--locked" data-verify>${icons.lock}Spiritueux 18+<span class="cat__n">vérifier mon âge</span></button>`;
  $('#shop-tiles').innerHTML = all + html + spirits;
  ajusterBarre();
}

// ---------- Rangée des rayons et des outils (UX-2) ----------
// Au bureau, rayons, recherche et tri tiennent sur une rangée quand la place le permet ; sinon la
// recherche et le tri passent sur la rangée du compteur (is-serre). Les rayons ne vont jamais à la
// ligne.
function ajusterBarre() {
  const bar = $('#shop-bar');
  const tiles = $$('#shop-tiles > *');
  if (!bar || !tiles.length) return;
  if (!matchMedia('(min-width: 1024px)').matches) return bar.classList.remove('is-serre');
  const dernier = tiles[tiles.length - 1];
  const rayons = dernier.getBoundingClientRect().right + (parseFloat(getComputedStyle(dernier).marginRight) || 0) - tiles[0].getBoundingClientRect().left;
  const outils = $('.shop__tools', bar).getBoundingClientRect().width;
  const ecart = parseFloat(getComputedStyle(bar).columnGap) || 0;
  bar.classList.toggle('is-serre', rayons + ecart + outils > bar.clientWidth + 0.5);
}
if ('ResizeObserver' in window) new ResizeObserver(() => ajusterBarre()).observe($('#shop-bar'));
document.fonts?.ready.then(ajusterBarre);

// ---------- Formulaire de filtres ----------
const opt = (type, name, value, label, n, checked, extra = '') =>
  `<label class="opt${n === 0 && !checked ? ' is-empty' : ''}"><input type="${type}" name="${name}" value="${esc(value)}"${checked ? ' checked' : ''}${n === 0 && !checked ? ' disabled' : ''} ${extra}/><span class="opt__label">${label}</span><span class="opt__n" data-n="${name}:${esc(value)}">${n}</span></label>`;

function rangeHTML(name, title, [min, max], value, fmt, step) {
  const [a, b] = value || [min, max];
  return `<fieldset class="fgroup fgroup--range" data-range="${name}" data-min="${min}" data-max="${max}">
    <legend>${title}</legend>
    <p class="range__out" id="${name}-out">${fmt(a)} – ${fmt(b)}</p>
    <div class="range">
      <input type="range" name="${name}-min" min="${min}" max="${max}" step="${step}" value="${a}" aria-label="${title} minimum" />
      <input type="range" name="${name}-max" min="${min}" max="${max}" step="${step}" value="${b}" aria-label="${title} maximum" />
      <span class="range__fill" aria-hidden="true"></span>
    </div>
  </fieldset>`;
}

function buildForm() {
  facetData = facets(base, state);
  const f = facetData;
  const groups = [];
  // Univers (avec ou sans alcool)
  const uni = [opt('radio', 'univers', 'tous', 'Tout', base.length, state.univers === 'tous')];
  uni.push(opt('radio', 'univers', 'sirops', 'Sirops <small>sans alcool</small>', f.univers.find((u) => u.id === 'sirops')?.n ?? 0, state.univers === 'sirops'));
  if (site.majeur) uni.push(opt('radio', 'univers', 'spiritueux', 'Spiritueux <small>avec alcool · 18+</small>', f.univers.find((u) => u.id === 'spiritueux')?.n ?? 0, state.univers === 'spiritueux'));
  else if (site.age !== 'mineur') uni.push(`<button type="button" class="opt opt--locked" data-verify>${icons.lock}<span class="opt__label">Spiritueux <small>18+ · vérifier mon âge</small></span></button>`);
  groups.push(`<fieldset class="fgroup"><legend>Univers</legend>${uni.join('')}</fieldset>`);
  if (f.gammes.length > 1)
    groups.push(`<fieldset class="fgroup"><legend>Gamme</legend>${f.gammes.map((g) => opt('checkbox', 'gamme', g.id, esc(g.nom), g.n, state.gammes.has(g.id))).join('')}</fieldset>`);
  if (f.familles.length > 1)
    groups.push(`<fieldset class="fgroup"><legend>Arôme</legend>${f.familles.map((x) => opt('checkbox', 'arome', x.id, esc(x.nom), x.n, state.familles.has(x.id))).join('')}</fieldset>`);
  if (f.volumes.length > 1)
    groups.push(`<fieldset class="fgroup"><legend>Contenance</legend><div class="opts-inline">${f.volumes.map((v) => opt('checkbox', 'contenance', v.ml, v.label, v.n, state.volumes.has(v.ml))).join('')}</div></fieldset>`);
  if (f.prix) groups.push(rangeHTML('prix', 'Prix', [Math.floor(f.prix[0]), Math.ceil(f.prix[1])], state.prix, (n) => euro(n), 0.1));
  if (site.majeur && f.degre) groups.push(rangeHTML('degre', 'Degré d’alcool', f.degre, state.degre, (n) => `${n} % vol.`, 1));
  if (f.best)
    groups.push(`<fieldset class="fgroup"><legend>Sélection</legend><label class="switch"><input type="checkbox" name="meilleures" value="1"${state.best ? ' checked' : ''} /><span class="switch__track" aria-hidden="true"></span><span>Meilleures ventes <span class="opt__n" data-n="meilleures:1">${f.best}</span></span></label></fieldset>`);
  if (f.prix) groups.push('<p class="filters__note">Le filtre de prix ne garde que les produits dont le prix est affiché en ligne.</p>');
  $('#filters').innerHTML = groups.join('');
  $$('#filters [data-range]').forEach(syncRange);
}

function syncRange(fs) {
  const [a, b] = $$('input[type=range]', fs);
  const min = Number(fs.dataset.min);
  const max = Number(fs.dataset.max);
  const lo = Math.min(Number(a.value), Number(b.value));
  const hi = Math.max(Number(a.value), Number(b.value));
  const fill = $('.range__fill', fs);
  fill.style.left = `${((lo - min) / (max - min || 1)) * 100}%`;
  fill.style.right = `${100 - ((hi - min) / (max - min || 1)) * 100}%`;
  const fmt = fs.dataset.range === 'prix' ? (n) => euro(n) : (n) => `${n} % vol.`;
  $('.range__out', fs).textContent = `${fmt(lo)} – ${fmt(hi)}`;
  return [lo, hi, min, max];
}

function readForm() {
  const form = $('#filters');
  const fd = new FormData(form);
  state.univers = fd.get('univers') || 'tous';
  state.gammes = new Set(fd.getAll('gamme'));
  state.familles = new Set(fd.getAll('arome'));
  state.volumes = new Set(fd.getAll('contenance'));
  state.best = fd.get('meilleures') === '1';
  ['prix', 'degre'].forEach((name) => {
    const fs = $(`[data-range="${name}"]`, form);
    if (!fs) return;
    const [lo, hi, min, max] = syncRange(fs);
    state[name] = lo <= min && hi >= max ? null : [lo, hi];
  });
}

// Met à jour les nombres et les options vides sans reconstruire le formulaire (le focus reste).
function refreshCounts() {
  const f = facets(base, state);
  const set = (key, n) => {
    const el = $(`[data-n="${key}"]`);
    if (!el) return;
    el.textContent = n;
    const input = el.closest('label')?.querySelector('input');
    if (input) {
      const empty = n === 0 && !input.checked;
      input.disabled = empty;
      el.closest('label').classList.toggle('is-empty', empty);
    }
  };
  set('univers:tous', base.filter((p) => matches(p, state, 'univers')).length);
  f.univers.forEach((u) => set(`univers:${u.id}`, u.n));
  f.gammes.forEach((g) => set(`gamme:${g.id}`, g.n));
  f.familles.forEach((x) => set(`arome:${x.id}`, x.n));
  f.volumes.forEach((v) => set(`contenance:${v.ml}`, v.n));
  set('meilleures:1', f.best);
}

// ---------- Résultats ----------
function render({ scroll = false } = {}) {
  const results = applyFilters(base, state);
  const grid = $('#shop-grid');
  const showLocked = !site.majeur && site.age !== 'mineur' && state.univers !== 'sirops' && !state.q.trim() && !state.gammes.size && !state.familles.size;
  const lockedOnly = !site.majeur && state.univers === 'spiritueux';
  // Règle 7 de l'étude : les sirops (univers pop) et les spiritueux ne se mélangent jamais dans
  // une même grille ; quand les deux sont affichés, ils forment deux rayons séparés.
  const sirops = results.filter((p) => !p.alcool);
  const spirits = results.filter((p) => p.alcool);
  const list = (items, locked = false) => `<ul class="grid">${items.map(cardHTML).join('')}${locked ? lockedCardHTML() : ''}</ul>`;
  const group = (id, title, body, extra = '') =>
    `<section class="shop-group shop-group--${id}"><div class="shop-group__head"><h2 class="shop-group__title">${title}</h2>${extra}</div>${body}</section>`;
  if (lockedOnly) grid.innerHTML = site.age === 'mineur' ? '' : list([], true);
  else if (sirops.length && (spirits.length || showLocked))
    grid.innerHTML =
      group('sirops', `Sirops <span>${plural(sirops.length, 'produit')}</span>`, list(sirops)) +
      group('spiritueux', `Spiritueux · 18+ <span>${spirits.length ? plural(spirits.length, 'produit') : ''}</span>`, list(spirits, showLocked), spirits.length ? `<p class="evin">${esc(EVIN)}</p>` : '');
  else grid.innerHTML = list(results, showLocked);
  $('#shop-empty').hidden = lockedOnly || results.length > 0;
  const n = lockedOnly ? 0 : results.length;
  $('#shop-count').innerHTML = `<strong>${plural(n, 'produit')}</strong>${activeCount(state) ? ' correspondent à votre sélection' : ' dans la boutique'}`;
  $('#sheet-apply').textContent = n ? `Voir ${plural(n, 'produit')}` : 'Aucun produit';
  renderChips();
  refreshCounts();
  const nActive = activeCount(state) - (state.q.trim() ? 1 : 0);
  $('#filters-n').hidden = !nActive;
  $('#filters-n').textContent = nActive;
  const tout = state.univers === 'tous' && !state.gammes.size;
  $$('[data-tile]').forEach((t) =>
    t.classList.toggle('is-on', (t.dataset.tile === 'tout' && tout) || (t.dataset.tile === 'spiritueux' && state.univers === 'spiritueux' && !state.gammes.size) || (state.gammes.size === 1 && state.gammes.has(t.dataset.tile))),
  );
  const spiritsShown = results.some((p) => p.alcool);
  // La source des prix est une note du mode revue ; la démonstration (prix et stocks modifiables,
  // paiement simulé) reste dite à tous.
  $('#shop-note').innerHTML = `<span>${
    demo
      ? 'Prix TTC et stocks de la démonstration, modifiables dans le CRM de démonstration. Les produits sans prix en ligne sont vendus au prix de la boutique.'
      : `Prix TTC.${noteRevue(' Prix du site actuel de la distillerie.')} Les produits sans prix en ligne sont vendus au prix de la boutique.`
  } Démonstration\u00a0: le paiement est simulé.</span>${spiritsShown ? `<span class="evin">${esc(EVIN)} ${esc(MINEURS)}</span>` : ''}`;
  history.replaceState(null, '', `${location.pathname}${serializeState(state)}`);
  stocks(grid);
  upgradeThumbs(grid);
  if (scroll) $('.shop__status').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// États de stock de la démo sur les cartes : pastille « Stock bas » ou « Rupture », bouton désactivé.
function stocks(grid) {
  if (!demo) return;
  $$('.card[data-slug]', grid).forEach((card) => {
    const p = bySlug[card.dataset.slug];
    const btn = $('.card__add', card);
    if (!p || !btn) return;
    const etat = etatDemo(demo, p.slug, btn.dataset.v);
    if (!etat || etat === 'disponible') return;
    let badges = $('.card__badges', card);
    if (!badges) {
      badges = document.createElement('div');
      badges.className = 'card__badges';
      $('.card__media', card).after(badges);
    }
    badges.insertAdjacentHTML('beforeend', `<span class="badge badge--stock badge--${etat}">${esc(ETATS[etat])}</span>`);
    if (indisponible(etat)) {
      btn.disabled = true;
      btn.classList.add('is-off');
      btn.innerHTML = `<span>${esc(ETATS[etat])}</span>`;
      btn.setAttribute('aria-label', `${p.nom} : ${ETATS[etat].toLowerCase()}`);
      card.classList.add('is-rupture');
    }
  });
}

function renderChips() {
  const chips = [];
  const gName = Object.fromEntries(GAMMES.map((g) => [g.id, g.nom]));
  const fam = Object.fromEntries((facetData?.familles || []).map((f) => [f.id, f.nom]));
  if (state.q.trim()) chips.push(['q', '', `« ${state.q.trim()} »`]);
  if (state.univers !== 'tous') chips.push(['univers', '', state.univers === 'sirops' ? 'Sirops' : 'Spiritueux']);
  state.gammes.forEach((g) => chips.push(['gamme', g, gName[g]]));
  state.familles.forEach((f) => chips.push(['arome', f, fam[f] || f]));
  state.volumes.forEach((v) => chips.push(['contenance', v, volumeLabel(v)]));
  if (state.prix) chips.push(['prix', '', `${euro(state.prix[0])} – ${euro(state.prix[1])}`]);
  if (state.degre) chips.push(['degre', '', `${state.degre[0]} – ${state.degre[1]} % vol.`]);
  if (state.best) chips.push(['meilleures', '', 'Meilleures ventes']);
  $('#shop-chips').innerHTML = chips.length
    ? chips.map(([k, v, label]) => `<button type="button" class="chip" data-chip="${k}" data-value="${esc(v)}" aria-label="Retirer le filtre ${esc(label)}">${esc(label)}${icons.close}</button>`).join('') +
      '<button type="button" class="chip chip--reset" data-reset>Tout effacer</button>'
    : '';
}

function removeChip(k, v) {
  if (k === 'q') {
    state.q = '';
    $('#shop-q').value = '';
  } else if (k === 'univers') state.univers = 'tous';
  else if (k === 'gamme') state.gammes.delete(v);
  else if (k === 'arome') state.familles.delete(v);
  else if (k === 'contenance') state.volumes.delete(String(v));
  else if (k === 'prix') state.prix = null;
  else if (k === 'degre') state.degre = null;
  else if (k === 'meilleures') state.best = false;
  buildForm();
  render();
}

function reset() {
  const tri = state.tri;
  state = emptyState();
  state.tri = tri;
  $('#shop-q').value = '';
  buildForm();
  render();
}

// ---------- Panneau de filtres (téléphone) ----------
const sheet = $('#filter-sheet');
function openSheet() {
  $('#sheet-body').append($('#filters'));
  sheet.showModal();
}
sheet.addEventListener('close', () => $('#filters-home').append($('#filters')));
$('#filters-open').addEventListener('click', openSheet);
$('#sheet-close').addEventListener('click', () => sheet.close());
$('#sheet-apply').addEventListener('click', () => sheet.close());
sheet.addEventListener('click', (e) => e.target === sheet && sheet.close());

// ---------- Événements ----------
function setBase() {
  base = visibleProducts(site.age);
  if (site.age === 'mineur' && state.univers === 'spiritueux') state.univers = 'tous';
  renderTiles();
  buildForm();
  render();
}

$('#filters').addEventListener('input', (e) => {
  if (e.target.type === 'range') {
    const fs = e.target.closest('[data-range]');
    const [a, b] = $$('input[type=range]', fs);
    if (Number(a.value) > Number(b.value)) (e.target === a ? b : a).value = e.target.value;
  }
  readForm();
  render();
});
$('#shop-q').addEventListener(
  'input',
  debounce(() => {
    state.q = $('#shop-q').value;
    render();
  }, 120),
);
$('#shop-q').addEventListener('keydown', (e) => e.key === 'Enter' && e.preventDefault());
$('#shop-sort').addEventListener('change', () => {
  state.tri = $('#shop-sort').value;
  render();
});

document.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  if (add) {
    addToCart(add.dataset.add, add.dataset.v || null);
    return;
  }
  if (e.target.closest('[data-verify]')) {
    site.openGate('ask', () => {
      state.univers = 'spiritueux';
      setBase();
    });
    return;
  }
  const chip = e.target.closest('[data-chip]');
  if (chip) return removeChip(chip.dataset.chip, chip.dataset.value);
  if (e.target.closest('[data-reset]')) return reset();
  const tile = e.target.closest('[data-tile]');
  if (tile) {
    e.preventDefault();
    const id = tile.dataset.tile;
    const on = tile.classList.contains('is-on');
    state.gammes = new Set();
    state.univers = 'tous';
    if (!on && id !== 'tout') {
      if (id === 'spiritueux') state.univers = 'spiritueux';
      else state.gammes.add(id);
    }
    buildForm();
    render({ scroll: true });
  }
});

site.onAge(setBase);

$('#shop-q').value = state.q;
$('#shop-sort').value = state.tri;
setBase();
// Démo : prix et stocks appliqués dès qu'ils arrivent (une seule lecture).
demoCatalogue().then((d) => {
  if (!d) return;
  demo = d;
  appliquerDemo(d);
  setBase();
});

if (import.meta.env.DEV) window.__shop = { get state() { return state; }, products };
