// Cartes produit (boutique, « Vous aimerez aussi », aperçu de la boutique en page d'accueil, pages
// de gamme et de spiritueux).
//
// Anatomie, pensée pour que chaque rangée d'une grille s'aligne (styles : base.css, « Cartes
// produit ») : la vignette sur son fond neutre (badges en haut à gauche), un surtitre court sur une
// ligne, le nom sur deux lignes au plus (hauteur réservée), la contenance (ou « 3 formats ») et le
// degré sur une ligne, puis la rangée du prix et du bouton d'ajout, calée en bas de la carte. Un
// seul lien par carte (le nom, étendu à toute la carte) et un bouton : rond « + » au téléphone,
// « + Ajouter » au-delà.
//
// Message sanitaire (loi Évin) : il n'est plus répété sous chaque spiritueux. Il accompagne
// l'ensemble qui en montre (une ligne sous la grille ou le carrousel : evinCartesHTML ; bande
// collante dans le rayon Spiritueux de la boutique ; à défaut, le filet de sécurité plus bas) ; les
// cartes d'alcool portent data-alcool.
import { EVIN, FAMILLES, GAMMES, products, minPrice, euro, DISPO_BOUTIQUE, prixAuLitreHTML } from '../data/products.js';
import { esc, plural } from '../lib/dom.js';
import { icons } from '../lib/icons.js';
import { thumbHTML } from '../lib/thumbs.js';
import { operationAffichee, concerne } from '../lib/operation.js';
import { noteRevue } from '../lib/revue.js';

// ---------- Surtitre court ----------
// Une ligne au-dessus du nom, qui dit ce qu'est le produit sans répéter le rayon de la grille
// (surtitre() de src/data/products.js reste la ligne longue de la recherche et de l'espace pro) :
// - sirops Couleur Provence® : le nom court de la gamme ;
// - PAC Citron et Fun Blue, dont le nom porte déjà la marque : ce qu'est le sirop (« Sirop de citron ») ;
// - spiritueux : la famille, tirée du type du produit (« Pastis », « Liqueur », « Crème »,
//   « Eau-de-vie », « Vieux marc »), à défaut de sa gamme ;
// - variante « famille » (page Couleur Provence®, où toutes les cartes sont de la gamme) : la
//   famille d'arômes (« Fruits rouges », « Agrumes »).
const FAMILLE_ALCOOL = [
  [/^pastis/i, 'Pastis'],
  [/^ap[ée]ritif/i, 'Apéritif'],
  [/^cr[èe]me/i, 'Crème'],
  [/^eau-de-vie/i, 'Eau-de-vie'],
  [/^(vieux )?marc/i, 'Vieux marc'],
  [/liqueur|arquebuse|[ée]lixir/i, 'Liqueur'],
];
const ALCOOL_PAR_GAMME = { 'pastis-aperitifs': 'Apéritif', liqueurs: 'Liqueur', 'cremes-eaux-de-vie': 'Crème', marcs: 'Vieux marc' };
const NOM_FAMILLE = Object.fromEntries(FAMILLES.map((f) => [f.id, f.nom]));
const GAMME = Object.fromEntries(GAMMES.map((g) => [g.id, g]));

// Un produit peut porter son propre surtitre, celui de son étiquette (src/data/products.js :
// le sirop caramel à la fleur de sel est un « Le Camarguais® »), à la place du nom de la gamme.
export function surtitreCourt(p, { variante = 'gamme' } = {}) {
  if (variante === 'famille' && !p.alcool && NOM_FAMILLE[p.famille]) return NOM_FAMILLE[p.famille];
  if (p.surtitre) return p.surtitre;
  if (p.alcool) return FAMILLE_ALCOOL.find(([rx]) => rx.test(p.type || ''))?.[1] || ALCOOL_PAR_GAMME[p.gamme] || 'Spiritueux';
  const g = GAMME[p.gamme];
  return g?.court || p.type || g?.nom || '';
}

// ---------- Contenance et degré, sur une ligne ----------
// Une contenance : « 70 cl · 45 % vol. » ; plusieurs : « 3 formats · 45 % vol. » (la liste reste
// dite aux lecteurs d'écran ; elle est sur la fiche). Contenance inconnue : une note du mode revue.
function metaHTML(p) {
  const vols = p.contenances.map((k) => k.volume).filter(Boolean);
  if (!vols.length) return noteRevue(p.enLigne ? 'Contenance à confirmer' : 'Contenance et degré à confirmer');
  const degre = p.alcool && p.degre ? ` · ${String(p.degre).replace('.', ',')}\u202f%\u00a0vol.` : '';
  if (vols.length === 1) return esc(`${vols[0]}${degre}`);
  return `${vols.length}\u00a0formats<span class="sr-only"> (${esc(vols.join(', '))})</span>${esc(degre)}`;
}

// ---------- Prix ----------
// Le prix affiché (« dès … » quand il y a plusieurs contenances) et, dessous, le prix au litre de la
// contenance la moins chère (directive 98/6/CE ; aucun en 1 L, où il est identique).
function priceHTML(p, price) {
  if (price === null) return '<p class="card__price card__price--none">Prix en boutique</p>';
  const unite = prixAuLitreHTML(p.contenances.find((k) => k.prix === price));
  const des = p.contenances.length > 1 ? '<span class="card__from">dès </span>' : '';
  return `<p class="card__price"><span class="card__amount">${des}${euro(price)}</span>${unite ? `<span class="card__unit">${unite}</span>` : ''}</p>`;
}

// options :
// - tag : élément de la carte ('li' par défaut) ;
// - surtitre : 'gamme' (par défaut) ou 'famille' ;
// - best : false dans un ensemble de meilleures ventes (carrousel de l'accueil, filtre « Meilleures
//   ventes ») : la pastille « Meilleure vente » y redirait le titre de l'ensemble.
// Une pastille au plus, au-dessus de la bouteille (la vignette lui réserve une bande, base.css) :
// l'opération du moment (Octobre Rose), sinon « Meilleure vente ». Pas de « 18+ » sur les cartes :
// les spiritueux ne sont montrés qu'après la vérification de l'âge, la fiche le rappelle.
// Un groupe de millésimes (regrouperMillesimes) donne sa carte de groupe.
// (Appelée aussi par Array.map : le deuxième argument peut être un index, ignoré.)
export function cardHTML(p, options = {}) {
  const { tag = 'li', surtitre = 'gamme', best = true, href = null } = typeof options === 'object' && options ? options : {};
  if (p.groupe) return groupeCardHTML(p, { tag, href });
  verifierEvin();
  const price = minPrice(p);
  const c = p.contenances[0];
  const op = operationAffichee();
  const badges = concerne(op, p.slug) ? `<span class="badge badge--rose">${esc(op.nom)}</span>` : best && p.bestSeller ? '<span class="badge badge--best">Meilleure vente</span>' : '';
  return `<${tag} class="card" data-theme="${p.theme}" data-slug="${p.slug}"${p.alcool ? ' data-alcool' : ''} style="--c:${p.color};--l:${p.light};--d:${p.deep}">
    <a class="card__media" href="/boutique/${p.slug}" tabindex="-1" aria-hidden="true">${thumbHTML(p)}</a>
    ${badges ? `<div class="card__badges">${badges}</div>` : ''}
    <div class="card__body">
      <p class="card__gamme">${esc(surtitreCourt(p, { variante: surtitre }))}</p>
      <h3 class="card__name"><a href="/boutique/${p.slug}">${esc(p.nom)}</a></h3>
      <p class="card__meta">${metaHTML(p)}</p>
      ${
        p.enLigne
          ? `<div class="card__row">
        ${priceHTML(p, price)}
        <button type="button" class="card__add" data-add="${p.slug}" data-v="${c?.id ?? ''}" aria-label="Ajouter ${esc(p.nom)}${c ? ` (${esc(c.volume)})` : ''} au panier">${icons.plus}<span>Ajouter</span></button>
      </div>`
          : `<p class="card__dispo">${icons.store}<span>${esc(DISPO_BOUTIQUE)}</span></p>`
      }
    </div>
  </${tag}>`;
}

// ---------- Millésimes regroupés ----------
// Les millésimes du Vieux marc « Elixir® » (une fiche par année, la même carafe en photo) forment une
// seule carte dans les grilles qui montrent tout un rayon (boutique sans recherche ni gamme, rayon
// des vieux marcs de /spiritueux). Les fiches restent séparées ; la carte mène à la liste des
// millésimes (href). Nombre, années, contenance, degré et prix sont tirés des fiches.
export const estMillesimeElixir = (p) => !!p?.millesime && p.slug.startsWith('marc-elixir-millesime');
// Recherche de la boutique qui liste les millésimes (et pas l'Élixir du Mont Ventoux).
export const RECHERCHE_ELIXIR = 'Elixir millésimé';
export const NOM_ELIXIR = 'Vieux marc « Elixir® » millésimé';

export function regrouperMillesimes(items) {
  const elixirs = items.filter(estMillesimeElixir);
  if (elixirs.length < 2) return items;
  const groupe = { groupe: 'elixir', items: [...elixirs].sort((a, b) => Number(a.millesime) - Number(b.millesime)) };
  return items.flatMap((p) => (!estMillesimeElixir(p) ? [p] : p === elixirs[0] ? [groupe] : []));
}

// « 15 millésimes, de 1958 à 2010 · 50 cl · 43 % vol. » (contenance et degré seulement s'ils sont
// communs à tous)
export function millesimesMeta(items) {
  const ans = items.map((p) => Number(p.millesime)).filter(Boolean);
  const commun = (vals) => (new Set(vals).size === 1 ? vals[0] : null);
  const vol = commun(items.flatMap((p) => p.contenances.map((k) => k.volume)));
  const deg = commun(items.map((p) => p.degre));
  return [
    `${items.length} millésimes, de ${Math.min(...ans)} à ${Math.max(...ans)}`,
    vol,
    deg ? `${String(deg).replace('.', ',')} % vol.` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function groupeCardHTML(g, { tag = 'li', href = null } = {}) {
  verifierEvin();
  const items = g.items;
  const prix = items.map(minPrice).filter((x) => x !== null);
  const min = prix.length ? Math.min(...prix) : null;
  const moinsCher = items.find((p) => minPrice(p) === min) || items[items.length - 1];
  const p = items[items.length - 1];
  const lien = href || `/boutique?q=${encodeURIComponent(RECHERCHE_ELIXIR)}`;
  const unite = min !== null ? prixAuLitreHTML(moinsCher.contenances.find((k) => k.prix === min)) : '';
  return `<${tag} class="card card--groupe" data-theme="${p.theme}" data-groupe="${g.groupe}" data-alcool style="--c:${p.color};--l:${p.light};--d:${p.deep}">
    <a class="card__media" href="${lien}" tabindex="-1" aria-hidden="true">${thumbHTML(p)}</a>
    <div class="card__body">
      <p class="card__gamme">${esc(surtitreCourt(p))}</p>
      <h3 class="card__name"><a href="${lien}" data-groupe-lien>${esc(NOM_ELIXIR)}</a></h3>
      <p class="card__meta">${esc(millesimesMeta(items))}</p>
      <div class="card__row">
        ${min !== null ? `<p class="card__price"><span class="card__amount"><span class="card__from">dès </span>${euro(min)}</span>${unite ? `<span class="card__unit">${unite}</span>` : ''}</p>` : '<p class="card__price card__price--none">Prix en boutique</p>'}
        <span class="card__add card__add--voir" aria-hidden="true">${icons.arrow}<span>Voir</span></span>
      </div>
    </div>
  </${tag}>`;
}

// ---------- Message sanitaire d'un ensemble de cartes ----------
// Une ligne sous la grille ou le carrousel, seulement s'il montre un alcool (README, « Âge légal et
// loi Évin », règle 4) ; rien sinon.
export const evinCartesHTML = (items, { cls = '' } = {}) => (items.some((p) => p?.alcool) ? `<p class="evin evin--cartes${cls ? ` ${cls}` : ''}">${esc(EVIN)}</p>` : '');

// Filet de sécurité de la règle 4 : une page qui pose des cartes d'alcool sans le message de
// l'ensemble (aujourd'hui « Vous aimerez aussi » sur la fiche d'un spiritueux, src/pages/produit.js)
// le reçoit quand même. Juste après le rendu des cartes (microtâche), chaque section qui montre une
// carte d'alcool sans message en reçoit une ligne sous sa grille ; la ligne ajoutée part si la
// section n'en montre plus. Une page qui appelle evinCartesHTML n'est pas touchée.
let aVerifier = false;
function verifierEvin() {
  if (aVerifier || typeof document === 'undefined' || typeof queueMicrotask !== 'function') return;
  aVerifier = true;
  queueMicrotask(() => {
    aVerifier = false;
    const zone = (el) => el.closest('section') || el.parentElement;
    document.querySelectorAll('[data-evin-filet]').forEach((p) => zone(p)?.querySelector('.card[data-alcool]') || p.remove());
    for (const grille of new Set([...document.querySelectorAll('.card[data-alcool]')].map((c) => c.parentElement))) {
      const z = zone(grille);
      if (z && !z.querySelector('.evin, .shop-evin')) grille.insertAdjacentHTML('afterend', `<p class="evin evin--cartes" data-evin-filet>${esc(EVIN)}</p>`);
    }
  });
}

const spiritsCount = products.filter((p) => p.alcool).length;

// Carte verrouillée : aucun nom ni visuel d'alcool, seulement l'invitation à vérifier son âge.
export function lockedCardHTML({ tag = 'li' } = {}) {
  return `<${tag} class="card card--locked" data-theme="spiritueux">
    <div class="card__lock">
      <span class="card__lock-icon">${icons.lock}</span>
      <p class="card__lock-title">Spiritueux · 18+</p>
      <p>${plural(spiritsCount, 'référence')} réservée${spiritsCount > 1 ? 's' : ''} aux personnes majeures.</p>
      <button type="button" class="btn btn--primary btn--sm" data-verify>Vérifier mon âge</button>
    </div>
  </${tag}>`;
}
