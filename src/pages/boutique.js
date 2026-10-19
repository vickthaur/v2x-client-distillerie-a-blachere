// Boutique : filtres (univers, gamme, arôme, contenance, prix, degré, meilleures ventes),
// recherche sans accents, tri, filtres actifs, adresse synchronisée, panneau de filtres sur téléphone.
// Les spiritueux n'apparaissent qu'après la vérification de l'âge.
// Démo active dans ce navigateur : prix et stocks de la démo (« Stock bas », « Rupture » : ajout au
// panier désactivé), chargés une fois ; sans démo, aucun appel à l'API.
import '../styles/base.css';
import '../styles/shop.css';
import { initSite, addToCart } from '../app/site.js';
import { EVIN, MINEURS, GAMMES, products, visibleProducts, euro, bySlug } from '../data/products.js';
import { cardHTML, lockedCardHTML, regrouperMillesimes } from '../app/cards.js';
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
  // Le nom dans un seul élément (le ® reste en exposant, collé au nom : l'onglet est en flex), le
  // nombre à part, plus discret.
  const all = `<a class="cat" href="/boutique" data-tile="tout"><span class="cat__label">Tout</span><span class="cat__n">${base.length}</span></a>`;
  const html = tiles
    .map((t) => {
      const n = base.filter((p) => p.gamme === t.id).length;
      return `<a class="cat" href="/boutique?gamme=${t.id}" data-tile="${t.id}"><span class="cat__label">${t.label}</span><span class="cat__n">${n}</span></a>`;
    })
    .join('');
  const spirits =
    site.age === 'mineur'
      ? ''
      : site.majeur
        ? `<a class="cat" href="/boutique?univers=spiritueux" data-tile="spiritueux"><span class="cat__label">Spiritueux 18+</span><span class="cat__n">${spiritsCount}</span></a>`
        : `<button type="button" class="cat cat--locked" data-verify>${icons.lock}<span class="cat__label">Spiritueux 18+</span><span class="cat__n">vérifier mon âge</span></button>`;
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
// ® en exposant dans les libellés (« Sirops Couleur Provence® »), comme dans les rayons.
const deposee = (html) => html.replace(/®/g, '<sup>®</sup>');
const opt = (type, name, value, label, n, checked, extra = '') =>
  `<label class="opt${n === 0 && !checked ? ' is-empty' : ''}"><input type="${type}" name="${name}" value="${esc(value)}"${checked ? ' checked' : ''}${n === 0 && !checked ? ' disabled' : ''} ${extra}/><span class="opt__label">${label}</span><span class="opt__n" data-n="${name}:${esc(value)}">${n}</span></label>`;

// Curseurs d'un intervalle : la valeur est annoncée en clair (« 4,40 € », « 40 % vol. »), pas
// « 4.4 » (aria-valuetext, A11Y-9).
const fmtRange = (name) => (name === 'prix' ? (n) => euro(Number(n)) : (n) => `${n}\u202f%\u00a0vol.`);
function rangeHTML(name, title, [min, max], value, fmt, step) {
  const [a, b] = value || [min, max];
  return `<fieldset class="fgroup fgroup--range" data-range="${name}" data-min="${min}" data-max="${max}">
    <legend>${title}</legend>
    <p class="range__out" id="${name}-out">${fmt(a)} – ${fmt(b)}</p>
    <div class="range">
      <input type="range" name="${name}-min" min="${min}" max="${max}" step="${step}" value="${a}" aria-label="${title} minimum" aria-valuetext="${esc(fmt(a))}" />
      <input type="range" name="${name}-max" min="${min}" max="${max}" step="${step}" value="${b}" aria-label="${title} maximum" aria-valuetext="${esc(fmt(b))}" />
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
    groups.push(`<fieldset class="fgroup"><legend>Gamme</legend>${f.gammes.map((g) => opt('checkbox', 'gamme', g.id, deposee(esc(g.nom)), g.n, state.gammes.has(g.id))).join('')}</fieldset>`);
  if (f.familles.length > 1)
    groups.push(`<fieldset class="fgroup"><legend>Arôme</legend>${f.familles.map((x) => opt('checkbox', 'arome', x.id, esc(x.nom), x.n, state.familles.has(x.id))).join('')}</fieldset>`);
  if (f.volumes.length > 1)
    groups.push(`<fieldset class="fgroup"><legend>Contenance</legend><div class="opts-inline">${f.volumes.map((v) => opt('checkbox', 'contenance', v.ml, v.label, v.n, state.volumes.has(v.ml))).join('')}</div></fieldset>`);
  if (f.prix) groups.push(rangeHTML('prix', 'Prix', [Math.floor(f.prix[0]), Math.ceil(f.prix[1])], state.prix, fmtRange('prix'), 0.1));
  if (site.majeur && f.degre) groups.push(rangeHTML('degre', 'Degré d’alcool', f.degre, state.degre, fmtRange('degre'), 1));
  if (f.best)
    groups.push(`<fieldset class="fgroup"><legend>Sélection</legend><label class="switch"><input type="checkbox" name="meilleures" value="1"${state.best ? ' checked' : ''} /><span class="switch__track" aria-hidden="true"></span><span>Meilleures ventes <span class="opt__n" data-n="meilleures:1">${f.best}</span></span></label></fieldset>`);
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
  const fmt = fmtRange(fs.dataset.range);
  $('.range__out', fs).textContent = `${fmt(lo)} – ${fmt(hi)}`;
  a.setAttribute('aria-valuetext', fmt(a.value));
  b.setAttribute('aria-valuetext', fmt(b.value));
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
  // Les millésimes du Vieux marc « Elixir® » : une carte quand la grille montre tout un rayon (ni
  // recherche ni gamme) ; elle mène à la recherche qui les liste. Dans la sélection « Meilleures
  // ventes », pas de pastille « Meilleure vente » sur chaque carte.
  const regrouper = !state.q.trim() && !state.gammes.size;
  const list = (items, locked = false) =>
    `<ul class="grid">${(regrouper ? regrouperMillesimes(items) : items).map((p) => cardHTML(p, { best: !state.best })).join('')}${locked ? lockedCardHTML() : ''}</ul>`;
  const group = (id, title, body) =>
    `<section class="shop-group shop-group--${id}">${title ? `<div class="shop-group__head"><h2 class="shop-group__title">${title}</h2></div>` : ''}${body}</section>`;
  // Message sanitaire (loi Évin) : une bande fine, collée sous l'en-tête tant que des spiritueux
  // sont à l'écran, au lieu d'une mention sous chaque carte.
  const evin = spirits.length ? `<p class="shop-evin">${esc(EVIN)}</p>` : '';
  if (lockedOnly) grid.innerHTML = site.age === 'mineur' ? '' : list([], true);
  else if (sirops.length && (spirits.length || showLocked))
    grid.innerHTML =
      group('sirops', `Sirops <span>${plural(sirops.length, 'produit')}</span>`, list(sirops)) +
      group('spiritueux', `Spiritueux · 18+ <span>${spirits.length ? plural(spirits.length, 'produit') : ''}</span>`, evin + list(spirits, showLocked));
  // que des spiritueux (rayon Spiritueux, recherche, gamme) : le même rayon, sans titre (le compteur
  // le dit déjà)
  else if (spirits.length) grid.innerHTML = group('spiritueux', '', evin + list(results, showLocked));
  else grid.innerHTML = list(results, showLocked);
  $('#shop-empty').hidden = lockedOnly || results.length > 0;
  if (!results.length) videHTML();
  const n = lockedOnly ? 0 : results.length;
  $('#shop-count').innerHTML = !activeCount(state)
    ? `<strong>${plural(n, 'produit')}</strong> dans la boutique`
    : n === 0
      ? '<strong>Aucun produit</strong> ne correspond à votre sélection'
      : `<strong>${plural(n, 'produit')}</strong> ${n === 1 ? 'correspond' : 'correspondent'} à votre sélection`;
  $('#sheet-apply').textContent = n ? `Voir ${plural(n, 'produit')}` : 'Aucun produit';
  renderChips();
  refreshCounts();
  const nActive = activeCount(state) - (state.q.trim() ? 1 : 0);
  $('#filters-n').hidden = !nActive;
  $('#filters-n').textContent = nActive;
  const tout = state.univers === 'tous' && !state.gammes.size;
  // rayon actif : souligné, et annoncé (aria-current, A11Y-9)
  $$('[data-tile]').forEach((t) => {
    const on = (t.dataset.tile === 'tout' && tout) || (t.dataset.tile === 'spiritueux' && state.univers === 'spiritueux' && !state.gammes.size) || (state.gammes.size === 1 && state.gammes.has(t.dataset.tile));
    t.classList.toggle('is-on', on);
    if (on) t.setAttribute('aria-current', 'true');
    else t.removeAttribute('aria-current');
  });
  const spiritsShown = results.some((p) => p.alcool);
  // La source des prix est une note du mode revue ; la démonstration (prix et stocks modifiables,
  // paiement simulé) reste dite à tous.
  $('#shop-note').innerHTML = `<span>${
    demo ? 'Prix TTC et stocks de la démonstration, modifiables dans le CRM de démonstration.' : `Prix TTC.${noteRevue(' Prix du site actuel de la distillerie.')}`
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
    // une pastille par carte : l'état du stock prend la place de « Meilleure vente »
    let badges = $('.card__badges', card);
    if (!badges) {
      badges = document.createElement('div');
      badges.className = 'card__badges';
      $('.card__media', card).after(badges);
    }
    badges.innerHTML = `<span class="badge badge--stock badge--${etat}">${esc(ETATS[etat])}</span>`;
    if (indisponible(etat)) {
      btn.disabled = true;
      btn.classList.add('is-off');
      // au téléphone, le bouton rond garde un signe (le libellé est dans la pastille de la vignette)
      btn.innerHTML = `${icons.minus}<span>${esc(ETATS[etat])}</span>`;
      btn.setAttribute('aria-label', `${p.nom}\u00a0: ${ETATS[etat].toLowerCase()}`);
      card.classList.add('is-rupture');
    }
  });
}

// État vide : une recherche qui ne trouve rien n'appelle pas la même aide que des filtres trop
// serrés. La recherche seule (sans les autres filtres) ne trouve rien : « Rien pour cette
// recherche » ; sinon, ce sont les filtres.
function videHTML() {
  const q = state.q.trim();
  const autres = activeCount(state) - (q ? 1 : 0);
  const recherche = q && !applyFilters(base, { ...emptyState(), q }).length;
  $('#shop-empty-title').textContent = recherche ? 'Rien pour cette recherche.' : 'Aucun produit ne correspond à ces filtres.';
  $('#shop-empty-text').textContent = recherche
    ? 'Vérifiez l’orthographe, ou cherchez un parfum\u00a0: citron, menthe, grenadine.'
    : q
      ? 'Retirez un filtre, ou essayez une autre recherche.'
      : 'Retirez un filtre pour élargir la sélection.';
  $('#shop-empty-reset').textContent = recherche && !autres ? 'Effacer la recherche' : 'Tout effacer';
}

function renderChips() {
  const chips = [];
  const gName = Object.fromEntries(GAMMES.map((g) => [g.id, g.nom]));
  const fam = Object.fromEntries((facetData?.familles || []).map((f) => [f.id, f.nom]));
  if (state.q.trim()) chips.push(['q', '', `«\u00a0${state.q.trim()}\u00a0»`]);
  if (state.univers !== 'tous') chips.push(['univers', '', state.univers === 'sirops' ? 'Sirops' : 'Spiritueux']);
  state.gammes.forEach((g) => chips.push(['gamme', g, gName[g]]));
  state.familles.forEach((f) => chips.push(['arome', f, fam[f] || f]));
  state.volumes.forEach((v) => chips.push(['contenance', v, volumeLabel(v)]));
  if (state.prix) chips.push(['prix', '', `${euro(state.prix[0])} – ${euro(state.prix[1])}`]);
  if (state.degre) chips.push(['degre', '', `${state.degre[0]} – ${state.degre[1]}\u202f%\u00a0vol.`]);
  if (state.best) chips.push(['meilleures', '', 'Meilleures ventes']);
  $('#shop-chips').innerHTML = chips.length
    ? chips.map(([k, v, label]) => `<button type="button" class="chip" data-chip="${k}" data-value="${esc(v)}" aria-label="Retirer le filtre ${esc(label)}"><span>${deposee(esc(label))}</span>${icons.close}</button>`).join('') +
      '<button type="button" class="chip chip--reset" data-reset>Tout effacer</button>'
    : '';
}

// Retirer un filtre actif : la case (ou le curseur) correspondante est remise à zéro dans le
// formulaire, sans le reconstruire ; le focus passe au filtre actif suivant (ou au compteur de
// résultats quand il n'en reste plus), jamais perdu (A11Y-6).
function removeChip(k, v, chip) {
  const form = $('#filters');
  const rang = chip ? $$('#shop-chips [data-chip]').indexOf(chip) : -1;
  if (k === 'q') {
    state.q = '';
    $('#shop-q').value = '';
  } else if (k === 'univers') {
    state.univers = 'tous';
    const r = $('input[name="univers"][value="tous"]', form);
    if (r) r.checked = true;
  } else if (k === 'gamme' || k === 'arome' || k === 'contenance' || k === 'meilleures') {
    const name = k === 'meilleures' ? 'meilleures' : k;
    $$(`input[name="${name}"]`, form).forEach((x) => {
      if (k === 'meilleures' || x.value === String(v)) x.checked = false;
    });
    if (k === 'gamme') state.gammes.delete(v);
    else if (k === 'arome') state.familles.delete(v);
    else if (k === 'contenance') state.volumes.delete(String(v));
    else state.best = false;
  } else if (k === 'prix' || k === 'degre') {
    const fs = $(`[data-range="${k}"]`, form);
    if (fs) {
      const [a, b] = $$('input[type=range]', fs);
      a.value = fs.dataset.min;
      b.value = fs.dataset.max;
      syncRange(fs);
    }
    state[k] = null;
  }
  render();
  const reste = $$('#shop-chips [data-chip]');
  const suivant = reste[Math.min(Math.max(rang, 0), reste.length - 1)];
  (suivant || $('#shop-count')).focus();
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
  if (chip) return removeChip(chip.dataset.chip, chip.dataset.value, chip);
  const raz = e.target.closest('[data-reset]');
  if (raz) {
    reset();
    // bouton disparu (filtres actifs, état vide) : le focus va au compteur de résultats
    if (!raz.isConnected || raz.closest('[hidden]')) $('#shop-count').focus();
    return;
  }
  // carte des millésimes de l'Elixir® : la recherche qui les liste, sans recharger la page
  const groupe = e.target.closest('a[data-groupe-lien], .card--groupe .card__media');
  if (groupe && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
    e.preventDefault();
    state.q = new URL(groupe.href).searchParams.get('q') || '';
    $('#shop-q').value = state.q;
    render({ scroll: true });
    return;
  }
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
