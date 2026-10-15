// Habillage des opérations du moment (Octobre Rose…) : ruban, pastille, bandeau et encart de fiche.
// Les textes viennent de src/data/operation.js ; hors période, rien n'est affiché.
import { operationEnCours, concerne, donPour } from '../data/operation.js';
import { esc } from './dom.js';
import { bySlug, euro } from '../data/products.js';

// Ruban de sensibilisation, dessiné en vecteurs (deux tons pour le croisement, extrémités en queue
// d'aronde).
const TONS = {
  rose: ['#c23a80', '#e45aa0'],
  clair: ['#f7b6d4', '#ffe4f0'],
  pale: ['#f3bcd6', '#f9d6e7'],
};
let nRuban = 0;
export function ruban(ton = 'rose', cls = 'ruban') {
  const [dos, face] = TONS[ton] || TONS.rose;
  const id = `ruban-${++nRuban}`;
  return `<svg class="${cls}" viewBox="0 0 64 96" aria-hidden="true" focusable="false"><defs><clipPath id="${id}"><path d="M0 0H64V96H51L45.2 90.5 39.4 96H24.6L18.8 90.5 13 96H0Z"/></clipPath></defs><g clip-path="url(#${id})" fill="none" stroke-width="10.5"><path d="M46 98 27 55C22 43 20 14.5 32 14.5" stroke="${dos}"/><path d="M32 14.5C44 14.5 42 43 37 55L18 98" stroke="${face}"/></g></svg>`;
}

// Opération affichée : celle du jour (heure de Paris) ; `?operation=<id>` la montre hors période
// (présentation de la maquette après la date).
export function operationAffichee() {
  let force = null;
  try {
    force = new URLSearchParams(location.search).get('operation');
  } catch {
    /* rien */
  }
  return operationEnCours(new Date(), force);
}

export const euros = (n) => `${Number.isInteger(n) ? n : n.toFixed(2).replace('.', ',')} €`;

// Phrase de la bannière officielle : « Pour chaque bouteille de PAC Citron vendue*, 1 € sera
// reversé à … » ; l'astérisque renvoie aux conditions.
export function accroche(op) {
  return `Pour chaque bouteille de ${esc(op.produitNom)} vendue*, ${euros(op.montant)} sera reversé ${esc(op.beneficiaireAvecArticle).replace(/Avignon-Provence/g, 'Avignon\u2011Provence').replace(/Sainte-Catherine/g, 'Sainte\u2011Catherine')}.`;
}

// Pastille courte (héros de l'accueil) : lien vers le bandeau de la page de marque.
export function pastilleHTML(op, { href = op.page } = {}) {
  return `<a class="op-pill" href="${esc(href)}">${ruban('clair', 'op-pill__ruban')}<span><strong>${esc(op.nom)}</strong> · ${euros(op.montant)} reversé par bouteille de ${esc(op.produitNom)}</span></a>`;
}

// Encart de fiche produit (sous le prix) pour un produit concerné.
export function encartFicheHTML(op) {
  return `<aside class="op-note" aria-label="${esc(op.nom)}">${ruban('rose', 'op-note__ruban')}<div><p class="op-note__titre">${esc(op.nom)} · ${esc(op.periode)}</p><p>${accroche(op)}</p><p class="op-note__fine">${esc(op.conditions)}</p></div></aside>`;
}

// Ligne du panier : « Octobre Rose : 3 € reversés à … grâce à votre commande ».
export function lignePanierHTML(op, lignes) {
  const { bouteilles, montant } = donPour(op, lignes);
  if (!bouteilles) return '';
  return `<p class="op-cart">${ruban('rose', 'op-cart__ruban')}<span><strong>${esc(op.nom)}</strong> : ${euros(montant)} ${montant > 1 ? 'seront reversés' : 'sera reversé'} ${esc(op.beneficiaireAvecArticle)} grâce à ${bouteilles > 1 ? `vos ${bouteilles} bouteilles` : 'votre bouteille'} de ${esc(op.produitNom)}.</span></p>`;
}

// Grand ruban du bandeau : dégradés, ombre portée du brin de devant sur le croisement ; chaque brin
// se dessine quand le bandeau entre dans l'écran (pathLength = 1, voir operation.css).
function grandRuban() {
  const id = `gr-${++nRuban}`;
  return `<svg class="op-band__ruban" viewBox="0 0 64 96" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="${id}-dos" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2569c"/><stop offset="1" stop-color="#a50f68"/></linearGradient>
      <linearGradient id="${id}-face" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7a8cb"/><stop offset=".55" stop-color="#e8619f"/><stop offset="1" stop-color="#c81f80"/></linearGradient>
      <filter id="${id}-ombre" x="-30%" y="-10%" width="160%" height="130%"><feDropShadow dx="0" dy="1.4" stdDeviation="1.3" flood-color="#6d0640" flood-opacity=".35"/></filter>
      <clipPath id="${id}-coupe"><path d="M0 0H64V96H51L45.2 90.5 39.4 96H24.6L18.8 90.5 13 96H0Z"/></clipPath>
    </defs>
    <g clip-path="url(#${id}-coupe)" fill="none" stroke-width="10.5">
      <path class="op-band__brin op-band__brin--dos" pathLength="1" d="M46 98 27 55C22 43 20 14.5 32 14.5" stroke="url(#${id}-dos)"/>
      <path class="op-band__brin op-band__brin--face" pathLength="1" d="M32 14.5C44 14.5 42 43 37 55L18 98" stroke="url(#${id}-face)" filter="url(#${id}-ombre)"/>
    </g>
  </svg>`;
}

// Bandeau (accueil, page de marque), version moderne : à gauche « 1 € » en très grand, le message
// et le bénéficiaire ; à droite le grand ruban et la vraie bouteille (photo détourée) devant lui.
export function bandeauHTML(op, { titreId = 'op-titre', cta = true } = {}) {
  const produit = bySlug[op.produits[0]];
  const prix = produit?.contenances?.[0]?.prix;
  const photo = `/bouteilles/${op.produits[0]}/face.webp`;
  const [j1, j2] = op.periode.replace(/^du /, '').split(' au ');
  return `<div class="wrap op-band__in">
      <div class="op-band__copy">
        <p class="op-band__kicker">${ruban('rose', 'op-band__ruban-mini')}<span>${esc(op.nom)}</span><span class="op-band__dates">Du ${esc(j1).replace(/^1er/, '1<sup>er</sup>')} au ${esc(j2)}</span></p>
        <p class="op-band__montant" aria-hidden="true">${euros(op.montant)}</p>
        <h2 class="op-band__titre" id="${titreId}"><span class="sr-only">${euros(op.montant)} </span>reversé pour chaque bouteille de ${esc(op.produitNom)} vendue*</h2>
        <p class="op-band__benef"><span>Au profit de</span> <strong>l’${esc(op.beneficiaire).replace(/-/g, '\u2011')}</strong> <span class="op-band__benef-sous">${esc(op.beneficiaireSousTitre)}</span></p>
        ${cta ? `<div class="op-band__ctas"><a class="btn op-band__cta" href="${esc(op.produitUrl)}"><span>Acheter le ${esc(op.produitNom)}</span>${prix != null ? `<span class="op-band__prix">${euro(prix)}</span>` : ''}</a></div>` : ''}
        <p class="op-band__fine">${esc(op.conditions)} ${esc(op.precisions || '')}</p>
      </div>
      <div class="op-band__visuel" aria-hidden="true">
        <span class="op-band__halo"></span>
        ${grandRuban()}
        <img class="op-band__bouteille" src="${photo}" alt="" width="287" height="1024" loading="lazy" decoding="async" />
      </div>
    </div>`;
}

// Monte le bandeau dans `el` (section posée par la page, masquée) si une opération est en cours ;
// sinon retire la section.
export function monterBandeau(el, options) {
  if (!el) return null;
  const op = operationAffichee();
  if (!op) {
    el.remove();
    return null;
  }
  el.innerHTML = bandeauHTML(op, options);
  el.setAttribute('aria-labelledby', options?.titreId || 'op-titre');
  el.setAttribute('data-reveal', '');
  el.hidden = false;
  // Sans photo traitée (scripts/photos.mjs), le ruban reste seul.
  el.querySelector('.op-band__bouteille')?.addEventListener('error', (e) => e.target.remove(), { once: true });
  return op;
}

export { concerne, donPour };
