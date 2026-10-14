// Accueil : les meilleures ventes en 3D (PAC Citron et Fun Blue, champ bestSeller du catalogue)
// devant une affiche coupée en deux, la femme à la paille coupée par le bord gauche dont la paille
// pointe vers l'ovale jaune ; puis le gros plan (PAC, puis Fun Blue), la grille du T-shirt, les
// deux portes (sirops pour tous, spiritueux pour les majeurs), les collectors, le musée, la
// maison, les visites et les actualités.
import '../styles/base.css';
import '../styles/editorial.css';
import '../styles/home.css';
import { initSite, addToCart, reveal } from '../app/site.js';
import { collectorsHTML, formulesHTML, saisonHTML, newsHTML, timelineHTML, lockHTML, evinHTML } from '../app/blocks.js';
import { products, bySlug, minPrice, euro, ETAGERES } from '../data/products.js';
import { archives } from '../lib/archives.js';
import { bottleSVG } from '../lib/bottleSvg.js';
import { femmeSVG } from '../lib/femme.js';
import { $, $$, esc, calm, clamp, hasWebGL } from '../lib/dom.js';
import { icons } from '../lib/icons.js';

const site = initSite();
const best = products.filter((p) => p.bestSeller);
const reduced = calm();

// ---------- Héros : l'ardoise des meilleures ventes ----------
function renderTickets() {
  const rows = best
    .map((p, i) => {
      const c = p.contenances[0];
      const price = minPrice(p);
      return `<li class="board__row board__row--${p.theme}" data-i="${i}">
        <a class="board__name" href="/boutique/${p.slug}">${esc(p.nom).replace('®', '<sup>®</sup>')}</a>
        <span class="board__vol">${c ? esc(c.volume) : ''}</span>
        <span class="board__dots" aria-hidden="true"></span>
        <span class="board__price">${price !== null ? euro(price) : 'Prix en boutique'}</span>
        <button type="button" class="board__add" data-add="${p.slug}" data-ml="${c?.ml ?? ''}" aria-label="Ajouter ${esc(p.nom)}${c ? ` (${esc(c.volume)})` : ''} au panier">${icons.plus}</button>
      </li>`;
    })
    .join('');
  $('#hero-tickets').innerHTML = `<div class="board">
    <p class="board__head">Au comptoir · prix TTC</p>
    <ul class="board__rows">${rows}</ul>
    <p class="board__links"><a href="/pac-citron">L’histoire du PAC</a><a href="/fun-blue">Le monde de Fun Blue</a></p>
  </div>`;
}

// ---------- Héros : la femme à la paille ----------
function renderFemme() {
  $('#hero-femme').innerHTML = femmeSVG({ className: 'femme' });
}

// La paille part des lèvres (repère 400 × 1000 du dessin) et pointe vers l'ovale jaune.
function drawStraw() {
  const svg = $('#hero-straw');
  const femme = $('#hero-femme .femme');
  const cta = $('#hero-cta');
  if (!svg || !femme || !cta) return;
  const hero = $('#meilleures-ventes').getBoundingClientRect();
  const f = femme.getBoundingClientRect();
  const c = cta.getBoundingClientRect();
  if (!f.width || getComputedStyle($('#hero-femme')).display === 'none') {
    svg.innerHTML = '';
    return;
  }
  const x0 = f.left + (60 / 400) * f.width - hero.left;
  const y0 = f.top + (912 / 1000) * f.height - hero.top;
  const x1 = c.left + 14 - hero.left;
  const y1 = c.top + c.height / 2 - hero.top;
  svg.setAttribute('viewBox', `0 0 ${hero.width} ${hero.height}`);
  svg.innerHTML = `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#17170f" stroke-width="15" stroke-linecap="round"/>
    <line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#fff" stroke-width="10" stroke-linecap="round"/>`;
}

// ---------- Gros plan : chapitres ----------
const chapters = [
  {
    slug: 'pac-citron',
    kicker: 'PAC Citron · 1962',
    title: '<span class="ch-pac">pac</span>',
    text: 'Louis Guiot crée le PAC « à la suite d’étés torrides », après deux ans d’essais, et le baptise des initiales de ses enfants. Marque déposée en 1962.',
  },
  {
    slug: 'pac-citron',
    kicker: 'Le rituel',
    title: 'Un PAC à l’eau',
    text: '1 volume de sirop pour 8 à 10 volumes d’eau plate ou gazeuse. « 100 % naturel au jus de citron, sans colorant ni conservateur », dit sa fiche.',
    mention: 'Conserver et consommer frais',
  },
  {
    slug: 'pac-citron',
    kicker: 'Né dans le Vaucluse',
    title: 'Pas marseillais : vauclusien',
    text: 'Beaucoup de Marseillais le croient de chez eux. Il est « toujours fabriqué dans le Vaucluse par la Distillerie A. Blachère », rappelle sa fiche.',
    cta: { href: '/pac-citron', label: 'L’histoire du PAC' },
  },
  {
    slug: 'fun-blue',
    kicker: 'Fun Blue · 1995',
    title: 'D’« Aurélie » à Fun Blue',
    text: 'Depuis les années 1960, la maison fabriquait une menthe bleue, « Aurélie ». Fun Blue lui succède en 1995.',
  },
  {
    slug: 'fun-blue',
    kicker: 'Le lagon en bouteille',
    title: 'Bleu turquoise, goût chlorophylle',
    text: 'Un sirop de menthe goût chlorophylle, « le sirop de menthe bleu le plus populaire en Provence », selon sa fiche.',
  },
  {
    slug: 'fun-blue',
    kicker: 'La recette de la maison',
    title: 'Le Blue Mojito',
    text: '2 cl de Fun Blue, 2 cl de PAC, 15 cl d’eau pétillante et un tiers de glace pilée. Sans alcool.',
    cta: { href: '/fun-blue', label: 'Le monde de Fun Blue' },
  },
];

function renderStory() {
  $('#story-panels').innerHTML = chapters
    .map((c, i) => {
      const p = bySlug[c.slug];
      return `<article class="chapter chapter--${p.theme}" data-ch="${i}" aria-hidden="${i ? 'true' : 'false'}">
        <p class="chapter__kicker">${esc(c.kicker)}</p>
        <h2 class="chapter__title">${c.title}</h2>
        <p class="chapter__text">${esc(c.text)}</p>
        ${c.mention ? `<p class="chapter__mention">${esc(c.mention)}</p>` : ''}
        ${c.cta ? `<a class="oval oval--small chapter__cta" href="${c.cta.href}">${esc(c.cta.label)}</a>` : ''}
      </article>`;
    })
    .join('');
  $('#story-dots').innerHTML = chapters.map((c, i) => `<li><button type="button" data-goto="${i}" aria-label="Chapitre ${i + 1} : ${esc(c.kicker)}"></button></li>`).join('');
}

// ---------- La grille du T-shirt (sirops seulement) ----------
function renderTshirt() {
  const cp = products.filter((p) => p.gamme === 'couleur-provence');
  $('#tshirt-grid').innerHTML = `
    <a class="tbox tbox--vert" href="/pac-citron" data-reveal>
      <span class="tbox__small">Le seul, l’unique</span>
      <span class="tbox__pac">PAC</span>
      <span class="tbox__label">Son histoire</span>
    </a>
    <a class="tbox tbox--magenta" href="/musee" data-reveal>
      <span class="tbox__femme">${femmeSVG({ className: 'tbox__femme-svg' })}</span>
      <span class="tbox__label">La femme à la paille</span>
    </a>
    <a class="tbox tbox--orange" href="/recettes" data-reveal>
      <span class="tbox__oval"><small>Sirop</small><b>citron</b><small>sans colorant</small></span>
      <span class="tbox__label">Un PAC à l’eau</span>
    </a>
    <a class="tbox tbox--cyan" href="/fun-blue" data-reveal>
      <span class="tbox__sun" aria-hidden="true"></span>
      <span class="tbox__fb">Fun Blue</span>
      <span class="tbox__label">Le lagon</span>
    </a>
    <a class="tbox tbox--jaune" href="/pac-citron#collectors" data-reveal>
      <span class="tbox__big">60</span>
      <span class="tbox__label">Les collectors</span>
    </a>
    <a class="tbox tbox--noir" href="/couleur-provence" data-reveal>
      <span class="tbox__dots" aria-hidden="true">${cp
        .slice(0, 12)
        .map((p) => `<i style="--c:${p.bottle.liquid}"></i>`)
        .join('')}</span>
      <span class="tbox__label">Couleur Provence®</span>
    </a>`;
}

// ---------- Deux portes ----------
function renderDoors() {
  const cp = products.filter((p) => p.gamme === 'couleur-provence');
  const majeur = site.majeur;
  const sirops = `<article class="porte porte--sirops" data-reveal>
    <p class="porte__k">Ouvert à tous</p>
    <h3 class="porte__title">Nos sirops</h3>
    <p class="porte__text">PAC Citron, Fun Blue et ${cp.length} parfums Couleur Provence® : ${ETAGERES.map((e) => e.titre.charAt(0).toLowerCase() + e.titre.slice(1)).join(', ')}.</p>
    <ul class="porte__swatches" aria-hidden="true">${cp.map((p) => `<li style="--c:${p.bottle.liquid}"></li>`).join('')}</ul>
    <p class="porte__note">Couleurs indicatives, en attendant les photos des bouteilles.</p>
    <div class="porte__links">
      <a class="oval oval--small" href="/couleur-provence">Les sirops Couleur Provence®</a>
      <a class="btn btn--ink" href="/recettes">Les recettes</a>
    </div>
  </article>`;
  const spiritueux = majeur
    ? `<article class="porte porte--spiritueux" data-univers="comtat" data-reveal>
        <p class="porte__k">18+ · réservé aux personnes majeures</p>
        <h3 class="porte__title">Nos spiritueux</h3>
        <p class="porte__text">Pastis et apéritifs, liqueurs, marcs et eaux-de-vie, dans l’habillage de leur univers.</p>
        <ul class="porte__univers">
          <li><a href="/spiritueux#comtat">Comtat et papes</a></li>
          <li><a href="/spiritueux#camargue">Camargue</a></li>
          <li><a href="/spiritueux#ventoux">Ventoux et garrigue</a></li>
          <li><a href="/spiritueux#marcs">Marcs et eaux-de-vie</a></li>
        </ul>
        <div class="porte__links"><a class="btn btn--ink" href="/spiritueux">Entrer</a></div>
        ${evinHTML()}
      </article>`
    : `<article class="porte porte--spiritueux is-locked" data-univers="comtat" data-reveal>
        <p class="porte__k">18+</p>
        <h3 class="porte__title">Nos spiritueux</h3>
        ${lockHTML({ mineur: site.age === 'mineur', titre: 'Réservé aux personnes majeures' })}
      </article>`;
  $('#portes-grid').innerHTML = sirops + spiritueux;
  $('[data-verify]', $('#portes-grid'))?.addEventListener('click', () => site.requireAge());
  reveal($('#portes-grid'));
}

// ---------- Musée, maison, visites, actualités ----------
function renderSections() {
  $('#collectors-frames').innerHTML = collectorsHTML();
  const pick = ['pac-art-deco', 'pac-chapeau', 'pac-roue', 'pac-classique', 'aurelie', 'fun-blue-ancien'];
  $('#musee-wall').innerHTML = `<ul class="wall__grid">${pick
    .map((id, i) => {
      const a = archives.find((x) => x.id === id);
      return `<li class="wall__item" style="--tilt:${[-2.2, 1.4, -0.8, 2, -1.6, 0.9][i]}deg"><a href="/musee#${a.id}" aria-label="${esc(a.titre)}">${a.svg()}</a></li>`;
    })
    .join('')}</ul>`;
  renderFrise();
  $('#visites-saison').innerHTML = saisonHTML();
  $('#visites-formules').innerHTML = formulesHTML({ compact: true });
  $('#actus-list').innerHTML = newsHTML(undefined, { limit: 3 });
  reveal();
}

function renderFrise() {
  $('#maison-frise').innerHTML = timelineHTML({ majeur: site.majeur, only: ['1835', '1962', '1993', '1995', '2023', '2035'], compact: true });
  reveal($('#maison-frise'));
}

// ---------- Scène 3D ----------
let hero = null;
let raf = 0;
const state = { focus: 0, story: 0, chapter: 0, visible: true };

function fallbackStage() {
  document.documentElement.classList.add('no-3d');
  $('#stage-bottles').innerHTML = best.map((p) => `<div class="stage__bottle">${bottleSVG(p)}</div>`).join('');
}

async function mountHero() {
  if (!hasWebGL()) return fallbackStage();
  try {
    const { HeroScene } = await import('../three/hero.js');
    hero = new HeroScene($('#hero-canvas'), best, { calm: reduced });
    await hero.ready;
    // Captures de recette (?test) : bouteilles posées tout de suite, sans l'animation d'entrée.
    if (new URLSearchParams(location.search).has('test')) hero.slots.forEach((s) => (s.pivot.userData.appear = 1));
    document.documentElement.classList.add('has-3d');
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('test')) window.__hero = hero;
    loop();
  } catch (err) {
    console.warn('3D indisponible, affiche dessinée.', err);
    fallbackStage();
  }
}

function loop() {
  raf = requestAnimationFrame(loop);
  if (!hero || !state.visible || document.hidden) return;
  hero.state.focus = state.focus;
  hero.state.story = state.story;
  hero.update();
}

// Survol et clic sur les bouteilles (souris seulement).
function bindPointer() {
  const heroEl = $('#meilleures-ventes');
  let pending = false;
  addEventListener('pointermove', (e) => {
    if (!hero || e.pointerType !== 'mouse') return;
    hero.state.mouseX = (e.clientX / innerWidth) * 2 - 1;
    hero.state.mouseY = -((e.clientY / innerHeight) * 2 - 1);
    if (pending || state.focus > 0.2) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      const over = e.target.closest?.('a, button, .board') ? -1 : hero.pick(e.clientX, e.clientY);
      hero.state.hover = over;
      heroEl.classList.toggle('is-pointing', over >= 0);
      $$('.board__row').forEach((t) => t.classList.toggle('is-hot', Number(t.dataset.i) === over));
    });
  });
  heroEl.addEventListener('click', (e) => {
    if (!hero || e.target.closest('a, button, .board')) return;
    const i = hero.pick(e.clientX, e.clientY);
    if (i >= 0) location.href = `/boutique/${best[i].slug}`;
  });
}

// ---------- Défilement : héros → gros plan → reste de la page ----------
function onScroll() {
  const y = scrollY;
  const vh = innerHeight;
  const story = $('#gros-plan');
  const top = story.offsetTop;
  const len = Math.max(1, story.offsetHeight - vh);
  state.focus = clamp((y - vh * 0.15) / (top - vh * 0.15 || 1), 0, 1);
  state.story = clamp((y - top) / len, 0, 1);
  const ch = Math.min(chapters.length - 1, Math.floor(state.story * chapters.length * 0.9999));
  if (ch !== state.chapter || !document.body.dataset.chapter) {
    state.chapter = ch;
    document.body.dataset.chapter = ch;
    $$('.chapter').forEach((el, i) => {
      el.classList.toggle('is-on', i === ch);
      el.setAttribute('aria-hidden', i === ch ? 'false' : 'true');
    });
    $$('#story-dots button').forEach((b, i) => b.classList.toggle('is-on', i === ch));
  }
  document.body.classList.toggle('in-story', state.focus > 0.6 && state.story < 1);
  document.body.dataset.side = state.story < 0.5 ? 'pac' : 'funblue';
  // La scène s'efface après le gros plan.
  const end = top + story.offsetHeight - vh;
  const fade = clamp((y - end) / (vh * 0.5), 0, 1);
  const stage = $('#stage');
  stage.style.opacity = String(1 - fade);
  state.visible = fade < 1;
  stage.style.visibility = state.visible ? '' : 'hidden';
  $('#meilleures-ventes').style.setProperty('--out', String(state.focus));
}

function bindStory() {
  $('#story-dots').addEventListener('click', (e) => {
    const b = e.target.closest('[data-goto]');
    if (!b) return;
    const story = $('#gros-plan');
    const len = story.offsetHeight - innerHeight;
    const i = Number(b.dataset.goto);
    scrollTo({ top: story.offsetTop + ((i + 0.5) / chapters.length) * len, behavior: reduced ? 'auto' : 'smooth' });
  });
}

// ---------- Démarrage ----------
renderTickets();
renderFemme();
renderStory();
renderTshirt();
renderDoors();
renderSections();
bindStory();
bindPointer();
onScroll();
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', () => {
  onScroll();
  drawStraw();
});
document.fonts?.ready.then(drawStraw);
requestAnimationFrame(drawStraw);
mountHero();

document.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  if (add) addToCart(add.dataset.add, add.dataset.ml ? Number(add.dataset.ml) : null);
});

site.onAge(() => {
  renderDoors();
  renderFrise();
});

addEventListener('pagehide', () => {
  cancelAnimationFrame(raf);
  hero?.dispose();
});
