// Accueil, dans l'ordre d'un grand site de marque : campagne (PAC Citron et Fun Blue en 3D, citrons,
// glaçons et menthe en suspension), nos marques, la boutique (carrousel avec prix), la maison en
// chiffres, le savoir-faire (photos de la boutique), les archives, la visite, la presse, où acheter
// et l'espace pro ; la lettre d'information et le pied de page complet suivent.
import '../styles/base.css';
import '../styles/home.css';
import '../styles/operation.css';
import { initSite, addToCart, reveal } from '../app/site.js';
import { cardHTML } from '../app/cards.js';
import { fillPlaces } from '../app/lieux.js';
import { imgPiece, pieceById, pieceHTML } from '../app/pieces.js';
import { products, bySlug, minPrice, euro, EVIN } from '../data/products.js';
import { infos, formules, saison } from '../data/site.js';
import textes from '../data/site/textes.json';
import { monterCampagne } from '../lib/campagne.js';
import { $, $$, esc, calm } from '../lib/dom.js';
import { icons } from '../lib/icons.js';
import { noteRevue, selonRevue } from '../lib/revue.js';
import { renderHTML, upgradeThumbs } from '../lib/thumbs.js';
import { monterBandeau, pastilleHTML } from '../lib/operation.js';
import { BAREME } from '../lib/livraison.js';

const site = initSite();
const heroProducts = [bySlug['pac-citron'], bySlug['fun-blue']];

// ---------- Opération du moment (Octobre Rose) : bandeau sous le héros, pastille dans le héros ----------
const operation = monterBandeau($('#octobre-rose'));
if (operation) {
  $('#hero-op').innerHTML = pastilleHTML(operation, { href: '#octobre-rose' });
  $('#hero-op').hidden = false;
}
// ---------- 1. Campagne ----------
function heroTags() {
  $('#hero-tags').innerHTML = heroProducts
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

// L'affiche (les deux vraies bouteilles) est dans le HTML ; la 3D la remplace quand elle est prête,
// sauf en mouvement réduit, en économie de données ou sans WebGL (src/lib/campagne.js).
const mountHero = () => monterCampagne({ hero: $('#hero'), stage: $('#hero-stage'), canvas: $('#hero-canvas'), scene: 'duo', products: heroProducts });

// ---------- 2. Nos marques ----------
function brands() {
  const majeur = site.majeur;
  const cp = products.filter((p) => p.gamme === 'couleur-provence').length;
  const cards = [
    { cls: 'pac', href: '/pac-citron', slugs: ['pac-citron'], bg: '#c2177f', k: 'Depuis plus de 60 ans', name: 'PAC Citron<sup>®</sup>', text: 'Le sirop de citron sans colorant, devenu le produit phare de la maison.' },
    { cls: 'fb', href: '/fun-blue', slugs: ['fun-blue'], bg: '#1f56a8', k: 'Le petit frère du PAC', name: 'Fun Blue<sup>®</sup>', text: 'Sucre et essence de menthe, couleur « bleu Méditerranée », goût chlorophylle.' },
    { cls: 'provence', href: '/couleur-provence', slugs: ['sirop-couleur-provence-grenadine', 'sirop-menthe', 'sirop-lavande'], bg: '#e9dfc8', k: `${cp} parfums`, name: 'Couleur Provence<sup>®</sup>', text: 'Les sirops de fruits, de fleurs et de plantes de la maison.' },
  ];
  const spirits = majeur
    ? `<li class="brand brand--spirits" data-reveal><a href="/spiritueux">
        <span class="brand__render">${renderHTML(['pastis-marra', 'marc-chateauneuf-du-pape-reserve-des-legats'], { bg: '#2b2723', fmt: 'carte' })}</span>
        <span class="brand__txt"><span class="kicker kicker--light">18+</span><span class="brand__name">Spiritueux</span><span class="brand__text">Pastis, liqueurs, crèmes, eaux-de-vie et vieux marcs de la maison.</span><span class="brand__cta">Découvrir ${icons.arrow}</span></span>
      </a></li>`
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
        <span class="brand__render">${renderHTML(c.slugs, { bg: c.bg, fmt: 'carte' })}</span>
        <span class="brand__txt"><span class="kicker kicker--light">${esc(c.k)}</span><span class="brand__name">${c.name}</span><span class="brand__text">${esc(c.text)}</span><span class="brand__cta">Découvrir ${icons.arrow}</span></span>
      </a></li>`,
      )
      .join('') + spirits;
  // message sanitaire une fois, sous le carrousel (et non sous la seule carte des spiritueux, où il
  // allongeait toute la rangée au téléphone)
  const evin = $('#brands-evin');
  if (evin) {
    evin.textContent = EVIN;
    evin.hidden = !majeur;
  }
  $('[data-verify]', $('#brands'))?.addEventListener('click', () => site.requireAge());
  upgradeThumbs($('#brands'));
  reveal($('#brands'));
}

// ---------- 3 bis. Commander à la distillerie ----------
function assurance() {
  const box = $('#assure');
  if (!box) return;
  const items = [
    [icons.truck, `Livraison offerte dès ${euro(BAREME.francoTTC).replace(',00', '')}`, 'Colissimo, à domicile ou en point relais'],
    [icons.store, 'Retrait gratuit à la distillerie', 'À Châteauneuf-du-Pape, du lundi au samedi'],
    [icons.card, 'Carte bancaire, PayPal ou virement', 'Paiement en ligne sécurisé'],
    [icons.sun, 'Fabriqué à Châteauneuf-du-Pape', 'Distillerie familiale depuis 1835'],
  ];
  box.innerHTML = items.map(([svg, t, s]) => `<li>${svg}<p><strong>${esc(t)}</strong><span>${esc(s)}</span></p></li>`).join('');
}

// ---------- 3. La boutique ----------
// Meilleures ventes du site officiel, puis des sirops ; les spiritueux seulement pour les majeurs.
function shelf() {
  const ok = (p) => p.enLigne && minPrice(p) !== null && (!p.alcool || site.majeur);
  const best = products.filter((p) => p.bestSeller && ok(p));
  const more = products.filter((p) => !p.bestSeller && p.gamme === 'couleur-provence' && ok(p));
  const picks = [...best, ...more].slice(0, 12);
  $('#shelf-track').innerHTML = picks.map((p) => cardHTML(p)).join('');
  upgradeThumbs($('#shelf-track'));
}
const vp = $('#shelf');
$$('[data-shelf]').forEach((b) => b.addEventListener('click', () => vp.scrollBy({ left: Number(b.dataset.shelf) * vp.clientWidth * 0.8, behavior: calm() ? 'auto' : 'smooth' })));

// ---------- 5. Savoir-faire : photos de la boutique (pour les majeurs : des bouteilles d'alcool
// y sont visibles), archives de la maison sinon ----------
function savoir() {
  const box = $('#savoir-photos');
  if (!box) return;
  const items = site.majeur
    ? [
        ['savoir__ph--a', '<figure class="ph"><span class="ph__slot" data-lieu="boutique-rayons"></span><figcaption>La boutique de la distillerie, à Châteauneuf-du-Pape</figcaption></figure>'],
        ['savoir__ph--b', '<figure class="ph"><span class="ph__slot" data-lieu="boutique-salon"></span><figcaption>Le salon de la boutique</figcaption></figure>'],
        ['savoir__ph--c', `<figure class="ph ph--archive">${imgPiece(pieceById['stand-palais-des-papes'], { sizes: '(max-width: 900px) 45vw, 22vw' })}<figcaption>Le stand de la maison au Palais des Papes (carte postale)</figcaption></figure>`],
      ]
    : [
        ['savoir__ph--a', `<figure class="ph ph--archive">${imgPiece(pieceById['stand-palais-des-papes'], { sizes: '(max-width: 900px) 50vw, 26vw' })}<figcaption>Le stand de la maison au Palais des Papes (carte postale)</figcaption></figure>`],
        ['savoir__ph--b', `<figure class="ph ph--archive ph--paper">${imgPiece(pieceById['lettre-14-rue-moliere'], { sizes: '(max-width: 900px) 45vw, 22vw' })}<figcaption>Papier à en-tête, 14 rue Molière, Avignon</figcaption></figure>`],
        ['savoir__ph--c', `<figure class="ph ph--archive">${imgPiece(pieceById['avenue-de-la-gare'], { sizes: '(max-width: 900px) 45vw, 22vw' })}<figcaption>Avignon, avenue de la Gare (carte postale)</figcaption></figure>`],
      ];
  box.innerHTML = items.map(([cls, html]) => html.replace('<figure class="ph', `<figure class="${cls} ph`)).join('');
  fillPlaces(box);
}

// ---------- 6. Les archives ----------
function pieces() {
  const ids = site.majeur ? ['pac-1962', 'aurelie', 'magistrale-affiche', 'stand-palais-des-papes'] : ['pac-1962', 'aurelie', 'fun-blue-70cl', 'stand-palais-des-papes'];
  $('#pieces').innerHTML = ids
    .map((id) => pieceById[id])
    .filter(Boolean)
    .map((p) => pieceHTML(p))
    .join('');
  reveal($('#pieces'));
}

// ---------- 7. Visiter ----------
function visit() {
  const g = formules.find((f) => f.id === 'guidee');
  const facts = [
    [icons.clock, `<strong>Boutique :</strong> du lundi au samedi, ${infos.horaires.map((h) => `${esc(h.heures)} ${esc(h.periode.toLowerCase().replace('d’', 'd’'))}`).join(', ')} (hors jours fériés)`],
    [icons.route, `<strong>Visite guidée :</strong> ${esc(g.duree)}, groupes de ${saison.groupeMax} personnes au plus, sur réservation`],
    [icons.pin, esc(infos.adresseLigne)],
    // tarif inconnu (les sources se contredisent) : contourné, la note reste visible en revue
    [icons.card, selonRevue(`<strong>Tarifs :</strong> sur demande à la boutique, au <a href="${infos.magasin.telLien}">${esc(infos.magasin.tel)}</a>`, 'Tarif de la visite guidée à confirmer avec la distillerie')],
  ];
  $('#visit-facts').innerHTML = facts.map(([i, t]) => `<li>${i}<span>${t}</span></li>`).join('');
  const stand = pieceById['stand-palais-des-papes'];
  $('#visit-photo').innerHTML = site.majeur
    ? '<span class="ph__slot" data-lieu="boutique-rayons"></span><figcaption>La boutique de la distillerie</figcaption>'
    : `${imgPiece(stand, { sizes: '(max-width: 900px) 92vw, 50vw' })}<figcaption>Le stand de la maison au Palais des Papes (carte postale ancienne)</figcaption>`;
  fillPlaces($('#visit-photo'));
}

// ---------- 8. Presse : la rubrique « On parle de nous » du site officiel ----------
// Pictogrammes du type (lecture d'une vidéo, journal) devant la rubrique de chaque carte.
const PICTO_VIDEO = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M10 8.6v6.8l5.6-3.4z" fill="currentColor" /></svg>';
const PICTO_PRESSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 5.5h12.5v13H6a2 2 0 0 1-2-2z" /><path d="M16.5 9H20v7.5a2 2 0 0 1-2 2h-1.5" /><path d="M7 9h6.5M7 12h6.5M7 15h4" stroke-linecap="round" /></svg>';
function news() {
  const items = textes.presse.slice(0, 3);
  $('#newsgrid').innerHTML = items
    .map(
      (a) => `<li class="newscard newscard--${a.type === 'video' ? 'video' : 'presse'}" data-reveal>
        <p class="newscard__meta"><span>${a.type === 'video' ? PICTO_VIDEO : PICTO_PRESSE}${a.type === 'video' ? 'Vidéo' : 'Presse'}</span><span>${esc(a.date)}</span></p>
        <h3 class="newscard__title">${esc(a.titre)}</h3>
        <a class="newscard__src" href="${a.url}" target="_blank" rel="noopener">${a.type === 'video' ? 'Voir la vidéo' : 'Lire l’article'}${noteRevue(' sur le site de la distillerie')}<span class="sr-only"> (nouvel onglet)</span></a>
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
assurance();
savoir();
pieces();
visit();
news();
fillPlaces();
reveal();
site.onAge(() => {
  brands();
  shelf();
  savoir();
  pieces();
  visit();
});
