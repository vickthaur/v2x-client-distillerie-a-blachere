// Fiche produit /boutique/<slug> : la bouteille en 3D (tirée de la vraie photo, sur un plateau de
// studio neutre) qu'on fait tourner ; le nom, une ligne de type (« Sirop de citron · 1 L »), le prix,
// les contenances et l'ajout au panier (au téléphone, tout cela dans le premier écran) ; puis
// l'accroche, les textes officiels de la fiche (description, ingrédients, valeurs nutritionnelles,
// conseils, « le saviez-vous ? ») dans un tableau de détails, les conditions d'expédition, les
// recettes (une carte par photo) et les suggestions.
// Spiritueux : rien du produit n'est affiché (ni nom, ni visuel, ni prix) avant la vérification
// de l'âge ; une personne mineure voit seulement un message et le lien vers les sirops. Sur les
// fiches de sirops, les conseils qui mentionnent de l'alcool ne sont montrés qu'aux majeurs.
import '../styles/base.css';
import '../styles/shop.css';
import '../styles/product.css';
import '../styles/operation.css';
import { initSite, addToCart } from '../app/site.js';
import { cardHTML, evinCartesHTML } from '../app/cards.js';
import { nomDansPhrase } from '../lib/typo.js';
import { bySlug, products, visibleProducts, recettes, FAMILLES, EVIN, MINEURS, euro, DISPO_BOUTIQUE, formatsAilleursTexte, prixAuLitreTexte, prixAuLitreHTML } from '../data/products.js';
import { devis, devisLocal } from '../lib/livraison.js';
import { boutonPause, pauseVoulue } from '../lib/pause.js';
import { infos } from '../data/site.js';
import { $, $$, esc, fold, calm, hasWebGL, idle, sobre, whenVisible } from '../lib/dom.js';
import { icons } from '../lib/icons.js';
import { thumbHTML, upgradeThumbs } from '../lib/thumbs.js';
import { photoOf } from '../lib/photos.js';
import { operationAffichee, concerne, encartFicheHTML } from '../lib/operation.js';
import { noteRevue, selonRevue } from '../lib/revue.js';
import { demoCatalogue, appliquerDemo, etatDemo, indisponible, ETATS } from '../lib/demo.js';

const site = initSite({ askAge: false });
// Opération du moment (Octobre Rose) : pastille et encart sur la fiche des produits concernés.
const operation = operationAffichee();
const slug = decodeURIComponent(location.pathname.replace(/\/+$/, '').split('/').pop() || '');
const p = bySlug[slug];
const root = $('#product-root');
let viewer = null;
let selected = 0;
let qty = 1;
// Démo active : prix et stocks de la démo (« Stock bas », « Rupture » : ajout au panier désactivé).
let demo = null;
const etatDe = (c) => (demo && c ? etatDemo(demo, p.slug, c.id) : null);

const famille = (x) => FAMILLES.find((f) => f.id === x.famille)?.nom;

// ---------- Chaque information une fois ----------
// Noms comparés sans casse ni accents, sans marque déposée ni guillemets, au pluriel simple près :
// « PAC Citron® » est la gamme « PAC Citron ». La gamme est dans le fil d'Ariane (seulement si elle
// n'est pas le produit lui-même) ; au-dessus du nom, les seules pastilles (meilleure vente, 18+ ;
// l'opération du moment a son encart) ; sous le nom, ce qu'est le produit (« Sirop de citron », « Sirop Couleur
// Provence® », « Liqueur des gardians »), sauf s'il redit le nom.
const mots = (s) =>
  fold(s)
    .replace(/[®™©«»"“”]/g, ' ')
    .split(/[^a-z0-9%]+/)
    .filter(Boolean)
    .map((m) => (m.length > 3 ? m.replace(/s$/, '') : m));
const memeNom = (a, b) => !!a && !!b && mots(a).join(' ') === mots(b).join(' ');
const gammeUtile = (x) => !!x.gammeNom && !memeNom(x.gammeNom, x.nom);
// Type sous le nom (« Sirop de citron ») ; rien quand il redit le nom.
const typeUtile = (x) => (x.type && !memeNom(x.type, x.nom) ? x.type : null);
const degreTexte = (x) => (x.alcool && x.degre ? `${String(x.degre).replace('.', ',')}\u202f%\u00a0vol.` : null);

// ---------- Textes officiels ----------
// Mots de l'alcool : une ligne (ou un élément de liste) qui en contient n'est montrée qu'aux majeurs.
const ALCOOL = /\b(bières?|pastis|tequila|vodka|rhums?|gin|whiskys?|vins?|champagnes?|liqueurs?|alcools?|alcoolisée?s?|apéritifs?|cognac|armagnac|martini|kir|spritz|prosecco|cidres?|calvados|absinthe|mojito|caïpirinha|ti-punch|punch|marc|cocktails? alcoolisés?)\b/i;
function sansAlcool(text) {
  return text
    .split('\n')
    .map((line) => {
      if (!ALCOOL.test(line)) return line;
      const parts = line.split(/,\s*/);
      const kept = parts.filter((x) => !ALCOOL.test(x));
      const out = kept.join(', ');
      return kept.length && kept.length < parts.length && !ALCOOL.test(out) ? out : null;
    })
    .filter((l) => l !== null)
    .join('\n');
}
const clean = (text) => (text ? (p.alcool || site.majeur ? text : sansAlcool(text)) : '');

// Paragraphes, listes « - … » et intertitres « … : » du site officiel.
function rich(text) {
  const blocks = clean(text)
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  let html = '';
  let list = [];
  const flush = () => {
    if (list.length) html += `<ul>${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    list = [];
  };
  for (const b of blocks) {
    if (/^-\s/.test(b)) {
      list.push(b.replace(/^-\s*/, ''));
      continue;
    }
    flush();
    if (/:\s*$/.test(b) && b.length < 80) html += `<p class="pp__sub">${esc(b)}</p>`;
    else html += `<p>${esc(b).replace(/\n/g, '<br />')}</p>`;
  }
  flush();
  return html;
}

// ---------- Balises de la fiche (SEO-3) ----------
// Tant que les fiches ne sont pas pré-rendues, une seule page sert les 63 adresses : l'adresse
// canonique (/boutique/<fiche>), og:url, le titre et la description sont posés ici. Fiche de
// spiritueux encore verrouillée : rien du produit (ni nom ni description) dans les balises.
const SITE = 'https://v2x-client-distillerie-a-blachere.vercel.app';
function balise(sel, creer) {
  let el = document.head.querySelector(sel);
  if (!el) {
    el = creer();
    document.head.append(el);
  }
  return el;
}
const meta = (attr, nom) =>
  balise(`meta[${attr}="${nom}"]`, () => {
    const m = document.createElement('meta');
    m.setAttribute(attr, nom);
    return m;
  });
function balises({ titre, description = null, canonique = true }) {
  const url = `${SITE}/boutique/${encodeURIComponent(slug)}`;
  if (canonique) balise('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' })).href = url;
  else document.head.querySelector('link[rel="canonical"]')?.remove();
  meta('property', 'og:url').content = url;
  meta('property', 'og:title').content = titre;
  if (description) {
    const d = description.length > 155 ? `${description.slice(0, 154).replace(/\s+\S*$/, '')}…` : description;
    meta('name', 'description').content = d;
    meta('property', 'og:description').content = d;
  }
}

function notFound() {
  document.title = 'Produit introuvable · Distillerie A. Blachère';
  balises({ titre: document.title, canonique: false });
  root.innerHTML = `<section class="wrap product-msg">
    <p class="kicker">Boutique</p>
    <h1 class="h-section">Ce produit est introuvable.</h1>
    <p class="lead">Il a peut-être changé de nom. Toute la gamme est dans la boutique.</p>
    <a class="btn btn--primary" href="/boutique">Voir la boutique</a>
  </section>`;
}

// Porte d'âge propre à la fiche : aucun élément du produit dans la page.
function lockedView() {
  document.title = 'Produit réservé aux personnes majeures · Distillerie A. Blachère';
  balises({ titre: document.title, description: 'Spiritueux de la Distillerie A. Blachère, réservé aux personnes majeures.' });
  const minor = site.age === 'mineur';
  root.innerHTML = `<section class="wrap product-msg product-msg--locked">
    <span class="product-msg__icon">${icons.lock}</span>
    <p class="kicker">Spiritueux · 18+</p>
    <h1 class="h-section">Cette page est réservée aux personnes majeures.</h1>
    <p class="lead">${minor ? 'Bonne découverte de nos sirops, de notre histoire et des visites de la distillerie.' : 'Indiquez votre date de naissance pour voir ce produit.'}</p>
    <div class="product-msg__actions">
      ${minor ? '' : '<button type="button" class="btn btn--primary" data-verify>Vérifier mon âge</button>'}
      <a class="btn btn--ghost" href="/boutique?univers=sirops">Voir les sirops</a>
    </div>
    <p class="evin">${esc(EVIN)} ${esc(MINEURS)}</p>
  </section>`;
  $('#related').hidden = true;
  $('[data-verify]', root)?.addEventListener('click', () => site.requireAge());
}

function priceHTML() {
  const c = p.contenances[selected];
  const etat = etatDe(c);
  const stock = etat && etat !== 'disponible' ? `<span class="pp__stock pp__stock--${etat}">${esc(ETATS[etat])}${etat === 'stock-bas' ? ' · dernières bouteilles' : etat === 'rupture' ? ' · réassort à venir' : ''}</span>` : '';
  // prix au litre à côté du prix, sauf en 1 L (UX-5) ; la contenance n'est rappelée que s'il y a
  // un choix (une seule contenance : elle est déjà sous le nom, « Sirop de citron · 1 L »)
  const unite = prixAuLitreTexte(c);
  const contenance = p.contenances.length > 1 ? ` · <span class="pp__nb">${esc(c.volume)}</span>` : '';
  if (c?.prix != null) return `<p class="pp__price"><strong>${euro(c.prix)}</strong><span class="pp__ttc">TTC${contenance}</span>${unite ? `<span class="pp__unit">soit ${unite}</span>` : ''}${stock}</p>`;
  return `<p class="pp__price pp__price--none"><strong>Prix en boutique</strong><span>Ce prix n’est pas affiché en ligne\u00a0: la distillerie vous le donne au magasin ou par téléphone (${infos.magasin.tel}).</span></p>`;
}

function boutiqueHTML() {
  return `<div class="pp__dispo">
    <p class="pp__dispo-title">${icons.store}<strong>${esc(DISPO_BOUTIQUE)}</strong></p>
    <p>Ce produit n’est pas vendu en ligne. Prix, contenance${p.alcool ? ' et degré' : ''}\u00a0: renseignez-vous à la boutique, au <a href="${infos.magasin.telLien}">${esc(infos.magasin.tel)}</a>.${noteRevue(` Prix, contenance${p.alcool ? ' et degré' : ''} à confirmer avec la distillerie.`)}</p>
    <a class="link" href="/visiter">Préparer une visite</a>
  </div>`;
}

// Première phrase utile de la description officielle (hors slogan en capitales).
function accroche() {
  const lines = clean(p.description || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^dilution/i.test(l));
  return lines.find((l) => l !== l.toUpperCase() && l.length > 20) || null;
}

// Accroche sous l'achat : la première phrase utile, sans redire en tête ce que dit déjà la ligne de
// type (« Sirop de citron 100% naturel… » sous « Sirop de citron · 1 L » : « 100% naturel… »), et
// seulement si elle apprend quelque chose (deux mots pleins qui ne sont ni dans le nom, ni dans le
// type, ni dans la gamme). Sinon rien : la description complète est juste en dessous.
const VIDES = new Set(mots('les des une aux par pour avec sans sur dans qui que notre nos votre vos est son ses cette plus tout tous très bien elle nous vous'));
function leadUtile() {
  let a = accroche();
  if (!a) return null;
  for (const deja of [typeUtile(p), p.nom]) {
    if (deja && fold(a).startsWith(fold(deja))) a = a.slice(deja.length).replace(/^[\s,.;:!?–—-]+/, '');
  }
  // une accroche, pas un paragraphe : au-delà de 150 signes, la première phrase (« J.C BLACHERE »,
  // « A.BLACHERE » ne coupent pas : la phrase finit après une minuscule)
  if (a.length > 150) {
    const fin = /[a-zà-ÿ»")]\s?[.!?…](?=\s+["«A-ZÀ-Ý0-9])/g;
    for (let m; (m = fin.exec(a)); ) {
      if (m.index < 40) continue;
      a = a.slice(0, m.index + m[0].length);
      break;
    }
  }
  const connus = new Set(mots(`${p.nom} ${p.type || ''} ${p.gammeNom}`));
  const neufs = mots(a).filter((m) => m.length > 2 && !VIDES.has(m) && !connus.has(m));
  return neufs.length >= 2 ? a.charAt(0).toUpperCase() + a.slice(1) : null;
}

function detailsHTML() {
  const sections = [];
  if (p.description) sections.push(['description', 'Description', rich(p.description)]);
  if (p.ingredients) sections.push(['ingredients', 'Ingrédients', `<p>${esc(p.ingredients)}</p>`]);
  if (p.nutrition) sections.push(['nutrition', 'Valeurs nutritionnelles', rich(p.nutrition)]);
  if (p.application) {
    const html = rich(p.application);
    if (html) sections.push(['conseils', 'Conseils d’utilisation', html]);
  }
  if (p.saviezVous) {
    const html = rich(p.saviezVous);
    if (html) sections.push(['histoire', 'Le saviez-vous\u202f?', html]);
  }
  sections.push(['livraison', 'Expédition et paiement', livraisonHTML()]);
  return sections
    .map(
      ([id, title, html], i) => `<details class="pp__acc" id="d-${id}"${i === 0 ? ' open' : ''}>
        <summary><span>${esc(title)}</span>${icons.chevron}</summary>
        <div class="pp__acc-body prose">${html}</div>
      </details>`,
    )
    .join('');
}

// Conditions générales de vente du site officiel (articles « Expédition et livraison »,
// « Modalité de paiement », « Délais de rétractation », « Casse au cours de la livraison »).
function livraisonHTML() {
  return `<ul class="pp__terms">
    <li><strong>Expédition</strong> sous 3\u00a0jours ouvrés au plus après la réception du règlement, si les produits sont disponibles\u202f; livraison dans les 30\u00a0jours au plus.</li>
    <li><strong>Frais de livraison</strong> indiqués avant la validation de la commande.</li>
    <li><strong>Paiement</strong> à la commande\u00a0: carte bancaire (CB, Visa, Mastercard), PayPal ou virement.</li>
    <li><strong>Rétractation</strong>\u00a0: quatorze jours francs à compter de la réception\u202f; articles intacts et non ouverts.</li>
    <li><strong>Casse</strong>\u00a0: refuser le colis endommagé ou l’indiquer sur le récépissé\u202f; la distillerie réexpédie ou rembourse.</li>
  </ul>
  <p><a class="link" href="/conditions-de-vente">Conditions générales de vente</a></p>`;
}

// Recettes du produit : une carte par photo. Une recette et sa version sans alcool partagent la
// même photo (« Blue mojito » et « Blue mojito sans alcool ») : une seule carte, la version sans
// alcool de préférence ; les recettes avec alcool, seulement pour les personnes majeures.
function recettesDuProduit(majeur) {
  const parPhoto = new Map();
  for (const r of recettes.filter((x) => x.produits?.includes(p.slug) && (!x.alcool || majeur))) {
    const photo = (r.image || r.id).replace(/-sans-alcool(?=\.\w+$|$)/, '');
    const deja = parPhoto.get(photo);
    if (!deja || (deja.alcool && !r.alcool)) parPhoto.set(photo, r);
  }
  return [...parPhoto.values()];
}

// Carte de recette : le titre est le lien (toute la carte est cliquable) ; une ou deux recettes :
// carte en largeur avec les premiers ingrédients (sans mot d'alcool pour qui n'est pas majeur).
function recetteHTML(r, riche) {
  const ingr = riche && r.ingredients?.length ? r.ingredients.filter((x) => site.majeur || !ALCOOL.test(x)).slice(0, 4) : [];
  return `<li class="rcard">
    ${r.image ? `<span class="rcard__img"><img src="${r.image}" alt="" width="619" height="1100" loading="lazy" decoding="async" /></span>` : ''}
    <div class="rcard__body">
      ${r.alcool ? '<span class="badge badge--age">18+</span>' : '<span class="rcard__meta">Sans alcool</span>'}
      <h3 class="rcard__title"><a href="/recettes#${r.id}">${esc(r.titre)}</a></h3>
      ${ingr.length ? `<ul class="rcard__ingr">${ingr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${riche ? `<span class="rcard__cta" aria-hidden="true">Voir la recette${icons.arrow}</span>` : ''}
    </div>
  </li>`;
}

function render() {
  document.title = `${p.nom} · Boutique · Distillerie A. Blachère`;
  // accroche courte (« La liqueur de Camargue ! ») : complétée par le type et la maison
  const signature = `${p.type || p.nom}, Distillerie A. Blachère, Châteauneuf-du-Pape.`;
  const a = accroche();
  balises({ titre: document.title, description: a ? (a.length < 80 ? `${a} ${signature}` : a) : signature });
  const majeur = site.majeur;
  const notes = p.notes.filter((n) => (!n.alcool || majeur) && !/^Sa fiche/.test(n.t));
  const recs = recettesDuProduit(majeur).slice(0, 4);
  const lead = leadUtile();
  const ailleurs = formatsAilleursTexte(p);
  const facts = [
    ['Gamme', p.gammeNom],
    ['Arôme', famille(p)],
    ['Contenance', p.contenances.map((c) => c.volume).join(' · ') || null, 'Sur demande à la boutique', 'À confirmer'],
    p.alcool ? ['Degré d’alcool', degreTexte(p), 'Sur demande à la boutique', 'À confirmer avec la distillerie'] : ['Alcool', 'Sans alcool'],
    p.reference ? ['Référence', p.reference] : null,
  ].filter((f) => f && (f[1] || f[2]));
  // Sous le nom, une ligne : ce qu'est le produit, sa contenance s'il n'y en a qu'une, son degré
  // (« Sirop de citron · 1 L », « Liqueur des gardians · 43 % vol. »).
  const typeLigne = [typeUtile(p) && esc(typeUtile(p)), p.contenances.length === 1 && `<span class="pp__nb">${esc(p.contenances[0].volume)}</span>`, degreTexte(p) && `<span class="pp__nb">${esc(degreTexte(p))}</span>`].filter(Boolean);
  // pas de pastille de l'opération du moment : son encart est affiché sous l'achat
  const badges = [p.bestSeller ? '<span class="badge badge--best">Meilleure vente</span>' : '', p.alcool ? '<span class="badge badge--age">18+</span>' : ''].join('');
  const volumes =
    p.contenances.length > 1
      ? `<fieldset class="pp__volumes"><legend>Contenance</legend><div class="pp__vols">${p.contenances
          .map(
            (c, i) =>
              `<label class="vol${indisponible(etatDe(c)) ? ' is-off' : ''}"><input type="radio" name="volume" value="${i}"${i === selected ? ' checked' : ''} /><span class="vol__in"><span class="vol__name">${esc(c.volume)}</span>${c.prix != null ? `<span class="vol__price">${euro(c.prix)}${indisponible(etatDe(c)) ? ` · ${esc(ETATS[etatDe(c)].toLowerCase())}` : ''}</span>` : ''}${prixAuLitreHTML(c) ? `<span class="vol__unit">${prixAuLitreHTML(c)}</span>` : ''}</span></label>`,
          )
          .join('')}</div></fieldset>`
      : p.contenances.length
        ? ''
        : '<p class="pp__muted">Contenance à confirmer avec la distillerie.</p>';
  root.innerHTML = `
  <nav class="crumbs wrap" aria-label="Fil d’Ariane">
    <ol>
      <li><a href="/boutique">Boutique</a></li>
      ${gammeUtile(p) ? `<li><a href="/boutique?gamme=${p.gamme}">${esc(p.gammeNom)}</a></li>` : ''}
      <li><span aria-current="page">${esc(p.nom)}</span></li>
    </ol>
  </nav>
  <article class="pp wrap" data-alcool="${p.alcool ? '1' : '0'}">
    <div class="pp__stage" id="stage">
      <div class="pp__poster" id="poster">${thumbHTML(p, { eager: true })}</div>
      <canvas class="pp__canvas" id="viewer" tabindex="0" aria-label="Bouteille ${esc(p.nom)} en 3D\u00a0: faites-la tourner en la faisant glisser, ou avec les flèches gauche et droite"></canvas>
      <div class="pp__stage-ui">
        <p class="pp__hint">${icons.rotate}<span>Glissez pour faire tourner</span></p>
        <div class="pp__sides" role="group" aria-label="Voir la bouteille" hidden>
          <button type="button" data-side="0">Face</button><button type="button" data-side="1">Dos</button>
        </div>
      </div>
      <p class="pp__source" id="source" data-revue hidden></p>
    </div>
    <div class="pp__info">
      <div class="pp__head">
        ${badges ? `<p class="pp__badges">${badges}</p>` : ''}
        <h1 class="pp__name">${esc(p.nom).replace(/®/g, '<sup>®</sup>')}</h1>
        ${typeLigne.length ? `<p class="pp__type">${typeLigne.join('\u00a0<span class="pp__dot" aria-hidden="true">·</span> ')}</p>` : ''}
      </div>
      ${p.enLigne ? '' : boutiqueHTML()}
      <form class="pp__buy" id="buy" novalidate${p.enLigne ? '' : ' hidden'}>
        <div id="price">${priceHTML()}</div>
        ${volumes}
        <div class="pp__row">
          <span class="qty qty--big" role="group" aria-label="Quantité">
            <button type="button" data-step="-1" aria-label="Une bouteille de moins">${icons.minus}</button>
            <input type="number" id="qty" name="qty" min="1" max="99" value="${qty}" inputmode="numeric" aria-label="Quantité" />
            <button type="button" data-step="1" aria-label="Une bouteille de plus">${icons.plus}</button>
          </span>
          <button type="submit" class="btn btn--primary pp__add">${icons.bag}<span>Ajouter au panier</span></button>
        </div>
        <p class="pp__ship" id="pp-ship">${icons.truck}<span id="pp-ship-txt"></span></p>
      </form>
      ${lead ? `<p class="pp__lead">${esc(lead)}</p>` : ''}
      ${concerne(operation, p.slug) ? encartFicheHTML(operation) : ''}
      ${ailleurs ? `<p class="pp__ailleurs">${esc(ailleurs)}\u00a0: voir <a href="/ou-trouver">Où trouver nos produits</a>.</p>` : ''}
      ${p.alcool ? `<p class="evin pp__evin">${esc(EVIN)} ${esc(MINEURS)}</p>` : ''}
      <dl class="pp__facts">${facts.map(([k, v, sinon, revue]) => `<div><dt>${esc(k)}</dt><dd>${v ? esc(v) : selonRevue(esc(sinon), esc(revue))}</dd></div>`).join('')}</dl>
      <div class="pp__details">${detailsHTML()}</div>
      ${notes.length ? `<div class="pp__notes"><h2>À savoir</h2><ul>${notes.map((n) => `<li>${n.revue ? selonRevue(esc(n.t), esc(n.revue)) : esc(n.t)}</li>`).join('')}</ul></div>` : ''}
    </div>
  </article>
  ${
    recs.length
      ? `<section class="pp-recipes wrap" aria-labelledby="pp-rec-title" data-n="${recs.length}">
      <div class="section__head"><div><p class="kicker">Recettes de la maison</p><h2 class="h-section" id="pp-rec-title">Avec ${esc(nomDansPhrase(p.nom))}</h2></div><a class="arrow-link" href="/recettes">Toutes les recettes ${icons.arrow}</a></div>
      <ul class="pp-recipes__list">${recs.map((r) => recetteHTML(r, recs.length <= 2)).join('')}</ul>
    </section>`
      : ''
  }`;
  bindBuy();
  bindBar();
  mountViewer();
  renderRelated();
}

// Bouton d'ajout selon le stock de la démo pour la contenance choisie.
function syncStock() {
  const btn = $('.pp__add');
  if (!btn) return;
  const etat = etatDe(p.contenances[selected]);
  const off = indisponible(etat);
  btn.disabled = off;
  btn.innerHTML = `${icons.bag}<span>${off ? esc(etat === 'rupture' ? 'En rupture de stock' : 'Indisponible') : 'Ajouter au panier'}</span>`;
  syncBar();
}

// ---------- Frais de livraison dès la fiche (UX-4) ----------
// Pour la contenance et la quantité choisies : Colissimo en point relais et à domicile, franco,
// retrait gratuit. Le barème de démonstration s'affiche tout de suite ; la route de la démo (barème
// réglable dans le CRM) le confirme ou le corrige.
// Délai et moyens de paiement des CGV, dans la même ligne (plus de liste de réassurance qui les
// redisait) ; le détail est dans « Expédition et paiement ».
const CONDITIONS = 'Expédition sous 3\u00a0jours ouvrés\u202f; carte bancaire, PayPal ou virement.';
let shipTimer = 0;
let shipToken = 0;
function syncShip() {
  const box = $('#pp-ship');
  const out = $('#pp-ship-txt');
  if (!box || !out) return;
  const c = p.contenances[selected];
  box.hidden = !c || c.prix == null;
  if (box.hidden) return;
  const articlesTTC = Math.round(c.prix * qty * 100) / 100;
  const local = devisLocal({ bouteilles: qty, articlesTTC });
  const note = noteRevue(' Barème de démonstration (docs/crm-espace-pro.md, § 5), réglable dans le CRM\u00a0: à remplacer par celui de la distillerie.');
  const ecrire = (d) => {
    const n = qty === 1 ? 'd’une bouteille' : `de ${qty}\u00a0bouteilles`;
    out.innerHTML =
      d.relais || d.colissimo
        ? `Livraison ${n}\u00a0: <strong>${euro(d.relais)}</strong> en point relais, ${euro(d.colissimo)} à domicile, offerte dès ${euro(d.francoTTC)} d’achats. Retrait gratuit à la distillerie. ${CONDITIONS}${note}`
        : `Livraison ${n} offerte. Retrait gratuit à la distillerie. ${CONDITIONS}${note}`;
  };
  ecrire(local);
  const t = ++shipToken;
  clearTimeout(shipTimer);
  shipTimer = setTimeout(() => devis([{ slug: p.slug, varianteId: String(c.id), qte: qty }], local).then((d) => t === shipToken && out.isConnected && ecrire(d)), 250);
}

// ---------- Barre d'achat collante (UX-1) ----------
// Quand le bouton d'ajout est passé sous l'en-tête (on descend lire la fiche), une barre rappelle le
// produit, la contenance choisie, son prix, et garde le bouton d'ajout à portée de pouce. Elle
// s'efface quand le bouton revient à l'écran et quand le pied de page arrive (mentions et pastilles
// dégagées). Hors de l'écran, elle est inerte : ni focus ni lecture.
const bar = document.createElement('div');
bar.className = 'pp-bar';
bar.id = 'pp-bar';
bar.setAttribute('role', 'region');
bar.setAttribute('aria-label', 'Achat rapide');
bar.inert = true;
$('#contenu')?.append(bar);
let barWanted = false;

// Spiritueux : le message sanitaire reste dans la barre (README, « Âge légal et loi Évin », règle 4),
// sur une ligne au bureau, en petit sous le produit et le bouton au téléphone.
function barHTML() {
  return `<div class="pp-bar__in wrap${p.alcool ? ' pp-bar__in--evin' : ''}">
    <span class="pp-bar__img" aria-hidden="true">${thumbHTML(p)}</span>
    <p class="pp-bar__txt"><span class="pp-bar__name" data-wordmark>${esc(p.nom).replace(/®/g, '<sup>®</sup>')}</span><span class="pp-bar__meta" id="pp-bar-meta"></span></p>
    ${p.alcool ? `<p class="pp-bar__evin">${esc(EVIN)}</p>` : ''}
    <button type="button" class="btn btn--primary pp-bar__add" id="pp-bar-add">${icons.bag}<span class="pp-bar__label"></span></button>
  </div>`;
}

// Contenu de la barre : contenance, prix, quantité et état du bouton suivent le formulaire.
function syncBar() {
  const btn = $('#pp-bar-add', bar);
  const main = $('.pp__add');
  if (!btn || !main) return;
  const c = p.contenances[selected];
  $('#pp-bar-meta', bar).innerHTML = [c?.volume ? esc(c.volume) : null, c?.prix != null ? euro(c.prix) : null, prixAuLitreHTML(c) || null, qty > 1 ? `${qty}\u00a0bouteilles` : null].filter(Boolean).join(' · ');
  btn.disabled = main.disabled;
  $('.pp-bar__label', btn).innerHTML = main.disabled ? esc(main.textContent.trim()) : 'Ajouter<span class="pp-bar__long"> au panier</span>';
  if (main.disabled) btn.removeAttribute('aria-label');
  else btn.setAttribute('aria-label', `Ajouter au panier : ${p.nom}${c ? `, ${c.volume}` : ''}${qty > 1 ? `, ${qty} bouteilles` : ''}`);
}

function showBar(on) {
  barWanted = on;
  if (on === bar.classList.contains('is-on')) return;
  // le focus clavier est dans la barre : elle reste jusqu'à ce qu'il en sorte (après un clic de
  // souris, le bouton garde le focus sans contour : la barre s'efface quand même)
  if (!on && bar.contains(document.activeElement) && document.activeElement.matches(':focus-visible')) return;
  bar.classList.toggle('is-on', on);
  bar.inert = !on;
  document.body.classList.toggle('pp-bar-on', on);
  if (on) document.body.style.setProperty('--pp-bar-h', `${bar.offsetHeight}px`);
}
bar.addEventListener('focusout', () => setTimeout(() => !bar.contains(document.activeElement) && showBar(barWanted)));
bar.addEventListener('click', (e) => {
  if (e.target.closest('#pp-bar-add')) $('.pp__add')?.click();
});

// Position du bouton d'ajout et du pied de page, lue au défilement (une fois par image) : un saut
// (lien d'ancre, défilement rapide) qui passe d'un coup au-delà du bouton est vu aussi.
let barSuivi = null;
function bindBar() {
  if (barSuivi) {
    removeEventListener('scroll', barSuivi);
    removeEventListener('resize', barSuivi);
    barSuivi = null;
  }
  const row = $('#buy .pp__row');
  if (!row || !p.enLigne || $('#buy').hidden) {
    bar.replaceChildren();
    return showBar(false);
  }
  bar.innerHTML = barHTML();
  syncBar();
  const ft = $('.ft');
  let attente = false;
  const mesure = () => {
    attente = false;
    if (!row.isConnected) return;
    // hauteur de l'en-tête collé (64 px au téléphone, 76 px au bureau) : sous lui, le bouton est caché
    const head = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--main-h')) || 64;
    const passe = row.getBoundingClientRect().bottom < head;
    const pied = !!ft && ft.getBoundingClientRect().top < innerHeight;
    showBar(passe && !pied);
  };
  barSuivi = () => {
    if (attente) return;
    attente = true;
    requestAnimationFrame(mesure);
  };
  addEventListener('scroll', barSuivi, { passive: true });
  addEventListener('resize', barSuivi, { passive: true });
  mesure();
}

function bindBuy() {
  const form = $('#buy');
  form.addEventListener('change', (e) => {
    if (e.target.name === 'volume') {
      selected = Number(e.target.value);
      $('#price').innerHTML = priceHTML();
      syncStock();
      syncShip();
    }
  });
  syncStock();
  syncShip();
  const input = $('#qty');
  const setQty = (n) => {
    qty = Math.min(99, Math.max(1, Number.isFinite(n) ? Math.round(n) : 1));
    input.value = qty;
    syncBar();
    syncShip();
  };
  $$('[data-step]', form).forEach((b) => b.addEventListener('click', () => setQty(qty + Number(b.dataset.step))));
  input.addEventListener('change', () => setQty(parseInt(input.value, 10)));
  if (p.enLigne)
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const c = p.contenances[selected];
      if (indisponible(etatDe(c))) return;
      addToCart(p.slug, c?.id ?? null, qty, { open: true });
    });
  // Face / dos : le dos de l'étiquette n'est téléchargé qu'au premier clic sur « Dos » (PERF-2).
  $$('[data-side]').forEach((b) => {
    const dos = b.dataset.side === '1';
    if (dos) b.addEventListener('pointerdown', () => viewer?.chargerDos());
    b.addEventListener('click', async () => {
      const v = viewer;
      if (!v) return;
      if (dos && !v.dosCharge) {
        b.setAttribute('aria-busy', 'true');
        await v.chargerDos();
        b.removeAttribute('aria-busy');
      }
      if (v === viewer) v.setAngle(dos ? Math.PI : 0);
    });
  });
}

// 3D sobre (PERF-2, PERF-4) : l'affiche (photo de face, dans le rendu de la fiche) d'abord, et
// elle suffit en mouvement réduit, en économie de données, en 2G et sans WebGL ; sinon la
// visionneuse est chargée quand le plateau approche de l'écran, au premier moment libre du
// navigateur, comme les campagnes (src/lib/campagne.js), sans le dos de l'étiquette (bouton « Dos »).
// L'index des photos (29 Ko) n'est lu que pour les flacons « à plat » (millésimes, coffret).
async function mountViewer() {
  const stage = $('#stage');
  const source = $('#source');
  const canvas = $('#viewer');
  const still = (texte) => {
    stage.classList.add('is-static');
    canvas.hidden = true;
    // sans la 3D, l'affiche est la seule image du produit : elle porte son nom
    $('#poster img')?.setAttribute('alt', p.nom);
    source.textContent = texte;
    source.hidden = false;
  };
  // Carafe et étui (millésimes, coffret) : la photo, telle quelle, sans 3D tournante.
  if (p.plat) {
    const photo = await photoOf(p.slug);
    if (!stage.isConnected) return;
    if (photo?.photo) {
      $('#poster').innerHTML = `<img class="thumb pp__flat" src="${photo.photo}" alt="${esc(p.nom)}" />`;
      stage.classList.add('is-flat');
      return still('Photo du produit.');
    }
  }
  if (sobre() || !hasWebGL()) return still('Photo du produit.');
  await whenVisible(stage);
  await idle();
  if (!stage.isConnected) return;
  let v = null;
  try {
    const { BottleViewer } = await import('../three/viewer.js');
    if (!stage.isConnected) return;
    // Spiritueux : présentation sobre (ni décor, ni rotation automatique).
    v = viewer = new BottleViewer(canvas, p, { calm: calm() || p.alcool, dos: false, pause: pauseVoulue(), target: () => stage.getBoundingClientRect() });
    await v.ready;
    if (v !== viewer) return;
    stage.classList.add('is-live');
    // rotation automatique (sirops) : bouton « Mettre l'animation en pause » en haut à droite (A11Y-7)
    // (avant « Face / Dos » dans l'ordre du clavier, comme à l'écran)
    if (!v.calm) $('.pp__stage-ui', stage).before(boutonPause(v, { clair: true }));
    $('.pp__sides', stage).hidden = !v.dosDisponible;
    source.textContent = v.kind === 'photo' ? (v.labelSource === 'etiquette' ? 'Bouteille 3D tirée de la photo du produit, avec son étiquette d’origine.' : 'Bouteille 3D tirée de la photo du produit.') : 'Bouteille dessinée en code, en attendant la photo du produit.';
    source.hidden = false;
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('test')) window.__viewer = v;
  } catch (err) {
    if (v && v !== viewer) return;
    console.warn('3D indisponible, photo affichée.', err);
    viewer?.dispose();
    viewer = null;
    still('Photo du produit.');
  }
}

function renderRelated() {
  // Jamais de mélange : un sirop propose des sirops, un spiritueux des spiritueux.
  const pool = visibleProducts(site.age).filter((x) => x.slug !== p.slug && x.univers === p.univers);
  const score = (x) => (x.gamme === p.gamme ? 2 : 0) + (x.famille === p.famille ? 3 : 0) + (x.bestSeller ? 1 : 0);
  const picks = pool
    .map((x) => [x, score(x)])
    .sort((a, b) => b[1] - a[1] || a[0].index - b[0].index)
    .slice(0, 4)
    .map(([x]) => x);
  $('#related-grid').innerHTML = picks.map((x) => cardHTML(x)).join('');
  // spiritueux : le message sanitaire une fois, sous la grille (README, « Âge légal et loi Évin »)
  $('#related-evin').innerHTML = evinCartesHTML(picks);
  // « Tous les sirops », « Tous les spiritueux » : la rubrique de la boutique d'où viennent les suggestions
  $('#related-all').href = `/boutique?univers=${p.univers}`;
  $('#related-all > span').textContent = p.univers === 'spiritueux' ? 'Tous les spiritueux' : 'Tous les sirops';
  $('#related').hidden = !picks.length;
  upgradeThumbs($('#related-grid'));
}

function show() {
  viewer?.dispose();
  viewer = null;
  if (barSuivi) {
    removeEventListener('scroll', barSuivi);
    removeEventListener('resize', barSuivi);
    barSuivi = null;
  }
  bar.replaceChildren();
  showBar(false);
  if (!p) return notFound();
  if (p.alcool && site.age !== 'majeur') return lockedView();
  render();
}

document.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  if (add) addToCart(add.dataset.add, add.dataset.v || null);
});

site.onAge(show);
show();
// Démo : prix et stocks appliqués à la fiche sans reconstruire la bouteille 3D.
demoCatalogue().then((d) => {
  if (!d || !p) return;
  demo = d;
  appliquerDemo(d);
  if (!$('#buy')) return;
  $('#price').innerHTML = priceHTML();
  $$('.vol', root).forEach((label, i) => {
    const c = p.contenances[i];
    const etat = etatDe(c);
    label.classList.toggle('is-off', indisponible(etat));
    const price = $('.vol__price', label);
    if (price && c?.prix != null) price.textContent = `${euro(c.prix)}${indisponible(etat) ? ` · ${ETATS[etat].toLowerCase()}` : ''}`;
    const unit = $('.vol__unit', label);
    if (unit) unit.innerHTML = prixAuLitreHTML(c);
  });
  syncStock();
  syncShip();
  renderRelated();
});
// Spiritueux sans âge vérifié : on pose la question tout de suite.
if (p?.alcool && (site.age === null || site.age === 'sirops')) site.requireAge();
else if (site.age === null) setTimeout(() => site.age === null && site.openGate('ask'), calm() ? 0 : 900);

if (import.meta.env.DEV) window.__p = { p, products };
