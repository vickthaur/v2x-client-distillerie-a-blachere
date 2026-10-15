// Habillage des opérations du moment (Octobre Rose…) : ruban, pastille, bandeau et encart de fiche.
// Les textes viennent de src/data/operation.js ; hors période, rien n'est affiché.
import { operationEnCours, concerne, donPour } from '../data/operation.js';
import { esc } from './dom.js';

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
  return `Pour chaque bouteille de ${esc(op.produitNom)} vendue*, ${euros(op.montant)} sera reversé ${esc(op.beneficiaireAvecArticle)}.`;
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

// Bandeau (accueil, page de marque) : fond semé de rubans, panneau rose en trois temps comme la
// bannière officielle (dates · message · bénéficiaire), conditions dessous.
export function bandeauHTML(op, { titreId = 'op-titre', cta = true } = {}) {
  const semis = op.semis
    .map(([x, y, r, s, ton]) => `<span class="op-band__seme" style="--x:${x}%;--y:${y}%;--r:${r}deg;--s:${s}">${ruban(ton, 'op-band__ruban')}</span>`)
    .join('');
  const [j1, j2] = op.periode.replace(/^du /, '').split(' au ');
  return `<div class="op-band__semis" aria-hidden="true">${semis}</div>
    <div class="wrap">
      <div class="op-band__panel">
        <p class="op-band__date">
          <span class="op-band__nom">${ruban('clair', 'op-band__ruban-nom')}${esc(op.nom)}</span>
          <span class="op-band__jours">Du ${esc(j1).replace(/^1er/, '1<sup>er</sup>')} <span class="op-band__l2">au ${esc(j2)}</span></span>
        </p>
        <div class="op-band__message">
          <h2 class="op-band__titre" id="${titreId}">${euros(op.montant)} reversé pour chaque bouteille de ${esc(op.produitNom)} vendue*</h2>
          ${cta ? `<div class="op-band__ctas"><a class="btn btn--light" href="${esc(op.produitUrl)}">Acheter le ${esc(op.produitNom)}</a></div>` : ''}
        </div>
        <p class="op-band__benef"><span class="op-band__benef-k">Au profit de</span><strong>${op.beneficiaireLignes.map((l) => `<span>${esc(l).replace(/-/g, '\u2011')}</span>`).join(' ')}</strong><span>${esc(op.beneficiaireSousTitre)}</span></p>
      </div>
      <p class="op-band__fine">${esc(op.conditions)} ${esc(op.precisions || '')}</p>
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
  el.hidden = false;
  return op;
}

export { concerne, donPour };
