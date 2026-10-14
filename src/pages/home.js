// Accueil, dans l'ordre d'un grand site de marque : campagne (meilleures ventes en 3D, citrons,
// glaçons et menthe en suspension), nos marques, la boutique (carrousel avec prix), la maison en
// chiffres, le savoir-faire (photos à venir), les archives, la visite, la presse, où acheter et
// l'espace pro ; la lettre d'information et le pied de page complet suivent.
import '../styles/base.css';
import '../styles/home.css';
import { initSite, addToCart, reveal } from '../app/site.js';
import { cardHTML } from '../app/cards.js';
import { fillPlaces } from '../app/lieux.js';
import { products, minPrice, euro, EVIN } from '../data/products.js';
import { actualites, formules, saison } from '../data/site.js';
import { archives, pieceSVG } from '../lib/archives.js';
import { $, $$, esc, calm, clamp, hasWebGL } from '../lib/dom.js';
import { icons } from '../lib/icons.js';
import { renderHTML, upgradeThumbs } from '../lib/thumbs.js';

const site = initSite();
const best = products.filter((p) => p.bestSeller);
const TEST = new URLSearchParams(location.search).has('test');

// ---------- 1. Campagne ----------
function heroTags() {
  $('#hero-tags').innerHTML = best
    .map((p) => {
      const c = p.contenances[0];
      const price = minPrice(p);
      return `<li class="hero__tag hero__tag--${p.theme}">
        <a href="/boutique/${p.slug}">
          <span class="hero__tag-name">${esc(p.nom).replace('®', '<sup>®</sup>')}</span>
          <span class="hero__tag-meta">${esc(p.type)}${c ? ` · ${esc(c.volume)}` : ''}</span>
        </a>
        <strong class="hero__tag-price">${price !== null ? euro(price) : 'Prix en boutique'}</strong>
        ${p.enLigne && c ? `<button type="button" class="hero__tag-add" data-add="${p.slug}" data-v="${c.id}" aria-label="Ajouter ${esc(p.nom)} (${esc(c.volume)}) au panier">${icons.plus}</button>` : ''}
      </li>`;
    })
    .join('');
}

async function mountHero() {
  const hero = $('#hero');
  const stageEl = $('#hero-stage');
  if (!hasWebGL()) {
    hero.classList.add('is-static');
    stageEl.innerHTML = renderHTML(best.map((p) => p.slug), { bg: '', fmt: 'paysage' });
    return;
  }
  try {
    const { HeroScene } = await import('../three/hero.js');
    const scene = new HeroScene($('#hero-canvas'), { scene: 'duo', products: best, target: () => stageEl.getBoundingClientRect(), calm: calm() });
    window.__hero = scene;
    await scene.ready;
    hero.classList.add('is-live');
    // défilement : les éléments montent et les bouteilles tournent un peu, au rythme de la page
    const onScroll = () => scene.setScroll(clamp(scrollY / Math.max(hero.offsetHeight, 1), 0, 1));
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    if (TEST) setTimeout(() => (window.__heroReady = true), 600);
  } catch (err) {
    console.warn('3D indisponible, visuel fixe affiché.', err);
    hero.classList.add('is-static');
  }
}

// ---------- 2. Nos marques ----------
function brands() {
  const majeur = site.majeur;
  const cp = products.filter((p) => p.gamme === 'couleur-provence').length;
  const cards = [
    { cls: 'pac', href: '/pac-citron', slugs: ['pac-citron'], bg: '#c2177f', k: 'Depuis 1962', name: 'PAC Citron<sup>®</sup>', text: 'Le sirop de citron créé par Louis Guiot « à la suite d’étés torrides ».' },
    { cls: 'fb', href: '/fun-blue', slugs: ['fun-blue'], bg: '#1f56a8', k: 'Depuis 1995', name: 'Fun Blue<sup>®</sup>', text: 'Le sirop de menthe goût chlorophylle, héritier de la menthe bleue « Aurélie ».' },
    { cls: 'provence', href: '/couleur-provence', slugs: ['sirop-couleur-provence-grenadine', 'sirop-lavande', 'sirop-menthe'], bg: '#e9dfc8', k: `${cp} parfums`, name: 'Couleur Provence<sup>®</sup>', text: 'Les sirops de fruits, de fleurs et de plantes de la maison.' },
  ];
  const spirits = majeur
    ? `<li class="brand brand--spirits" data-reveal><a href="/spiritueux">
        <span class="brand__render">${renderHTML(['pastis-marra', 'marc-chateauneuf-du-pape-reserve-des-legats'], { bg: '#2b2723', fmt: 'portrait' })}</span>
        <span class="brand__txt"><span class="kicker kicker--light">18+</span><span class="brand__name">Spiritueux</span><span class="brand__text">Pastis, liqueurs, marcs et eaux-de-vie de la maison.</span><span class="brand__cta">Découvrir ${icons.arrow}</span></span>
      </a><p class="brand__evin">${esc(EVIN)}</p></li>`
    : `<li class="brand brand--spirits brand--locked" data-reveal><div class="brand__lock">
        <span class="brand__lock-icon">${icons.lock}</span>
        <span class="kicker kicker--light">18+</span>
        <span class="brand__name">Spiritueux</span>
        <span class="brand__text">${site.age === 'mineur' ? 'Cette partie du site est réservée aux personnes majeures.' : 'Réservés aux personnes majeures : indiquez votre date de naissance pour les voir.'}</span>
        ${site.age === 'mineur' ? '' : '<button type="button" class="btn btn--light btn--sm" data-verify>Vérifier mon âge</button>'}
      </div></li>`;
  $('#brands').innerHTML =
    cards
      .map(
        (c) => `<li class="brand brand--${c.cls}" data-reveal><a href="${c.href}">
        <span class="brand__render">${renderHTML(c.slugs, { bg: c.bg, fmt: 'portrait' })}</span>
        <span class="brand__txt"><span class="kicker kicker--light">${esc(c.k)}</span><span class="brand__name">${c.name}</span><span class="brand__text">${esc(c.text)}</span><span class="brand__cta">Découvrir ${icons.arrow}</span></span>
      </a></li>`,
      )
      .join('') + spirits;
  $('[data-verify]', $('#brands'))?.addEventListener('click', () => site.requireAge());
  upgradeThumbs($('#brands'));
  reveal($('#brands'));
}

// ---------- 3. La boutique ----------
function shelf() {
  const prices = (p) => p.enLigne && minPrice(p) !== null;
  const picks = [...best, ...products.filter((p) => p.gamme === 'couleur-provence' && prices(p) && !p.contenances.some((c) => c.aVerifier))].slice(0, 12);
  $('#shelf-track').innerHTML = picks.map((p) => cardHTML(p)).join('');
  upgradeThumbs($('#shelf-track'));
  const vp = $('#shelf');
  $$('[data-shelf]').forEach((b) => b.addEventListener('click', () => vp.scrollBy({ left: Number(b.dataset.shelf) * vp.clientWidth * 0.8, behavior: calm() ? 'auto' : 'smooth' })));
}

// ---------- 6. Les archives ----------
function pieces() {
  const ids = ['pac-classique', 'aurelie', 'fun-blue-ancien'];
  $('#pieces').innerHTML = ids
    .map((id) => archives.find((a) => a.id === id))
    .filter(Boolean)
    .map(
      (a) => `<li class="piece" data-reveal><a href="/musee#${a.id}">
        <span class="piece__frame"><span class="piece__mat">${pieceSVG(a)}</span></span>
        <span class="cartel"><span class="cartel__title">${esc(a.titre)}</span><span class="cartel__meta">${esc(a.periode)}</span><span class="cartel__meta">${esc(a.technique)} · ${esc(a.statut)}</span></span>
      </a></li>`,
    )
    .join('');
}

// ---------- 7. Visiter ----------
function visit() {
  const g = formules.find((f) => f.id === 'guidee');
  const facts = [
    [icons.clock, `<strong>Visite guidée : ${esc(g.duree)}</strong>`],
    [icons.people, `Groupes de ${saison.groupeMax} personnes au plus, sur réservation`],
    [icons.route, `<strong>Saison 2026 :</strong> ${esc(saison.texte.replace('Du ', 'du '))} · ${esc(saison.ferme.toLowerCase())}`],
    [icons.pin, '1695 route de Sorgues, 84230 Châteauneuf-du-Pape'],
    [icons.card, 'Tarifs à confirmer avec la distillerie'],
  ];
  $('#visit-facts').innerHTML = facts.map(([i, t]) => `<li>${i}<span>${t}</span></li>`).join('');
}

// ---------- 8. Actualités ----------
function news() {
  const ids = ['magnums', 'collectors', 'projet'];
  $('#newsgrid').innerHTML = ids
    .map((id) => actualites.find((a) => a.id === id))
    .filter(Boolean)
    .map(
      (a) => `<li class="newscard" data-reveal>
        <p class="newscard__meta"><span>${esc(a.rubrique)}</span><span>${esc(a.quand)}</span></p>
        <h3 class="newscard__title">${esc(a.titre)}</h3>
        <p class="newscard__text">${esc(a.texte)}</p>
        ${a.source ? `<a class="newscard__src" href="${a.source.url}" target="_blank" rel="noopener">${esc(a.source.nom)}<span class="sr-only"> (nouvel onglet)</span></a>` : ''}
      </li>`,
    )
    .join('');
}

document.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  if (add) addToCart(add.dataset.add, add.dataset.v || null);
});

heroTags();
mountHero();
brands();
shelf();
pieces();
visit();
news();
fillPlaces();
reveal();
site.onAge(() => brands());
