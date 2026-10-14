// Cartes produit (boutique, « Vous aimerez aussi », aperçu de la boutique en page d'accueil).
import { EVIN, products, minPrice, euro } from '../data/products.js';
import { esc, plural } from '../lib/dom.js';
import { icons } from '../lib/icons.js';
import { thumbHTML } from '../lib/thumbs.js';

export function cardHTML(p, { tag = 'li' } = {}) {
  const price = minPrice(p);
  const c = p.contenances[0];
  const volumes = p.contenances.map((k) => k.volume).join(' · ') || 'Contenance à confirmer';
  const badges = [p.bestSeller ? '<span class="badge badge--best">Meilleure vente</span>' : '', p.alcool ? '<span class="badge badge--age">18+</span>' : ''].join('');
  return `<${tag} class="card" data-theme="${p.theme}" data-slug="${p.slug}" style="--c:${p.color};--l:${p.light};--d:${p.deep}">
    <a class="card__media" href="/boutique/${p.slug}" tabindex="-1" aria-hidden="true">${thumbHTML(p)}</a>
    ${badges ? `<div class="card__badges">${badges}</div>` : ''}
    <div class="card__body">
      <p class="card__gamme">${esc(p.gammeNom)}</p>
      <h3 class="card__name"><a href="/boutique/${p.slug}">${esc(p.nom)}</a></h3>
      <p class="card__meta">${esc(p.alcool && p.degre ? `${volumes} · ${p.degre} % vol.` : volumes)}</p>
      <div class="card__row">
        ${price !== null ? `<p class="card__price">${p.contenances.length > 1 ? 'dès ' : ''}${euro(price)}</p>` : '<p class="card__price card__price--none">Prix en boutique</p>'}
        <button type="button" class="card__add" data-add="${p.slug}" data-ml="${c?.ml ?? ''}" aria-label="Ajouter ${esc(p.nom)}${c ? ` (${esc(c.volume)})` : ''} au panier">${icons.plus}<span>Ajouter</span></button>
      </div>
      ${p.alcool ? `<p class="card__evin">${esc(EVIN)}</p>` : ''}
    </div>
  </${tag}>`;
}

const spiritsCount = products.filter((p) => p.alcool).length;

// Carte verrouillée : aucun nom ni visuel d'alcool, seulement l'invitation à vérifier son âge.
export function lockedCardHTML({ tag = 'li' } = {}) {
  return `<${tag} class="card card--locked" data-theme="spiritueux">
    <div class="card__lock">
      <span class="card__lock-icon">${icons.lock}</span>
      <p class="card__lock-title">Spiritueux · 18+</p>
      <p>${plural(spiritsCount, 'référence')} réservée${spiritsCount > 1 ? 's' : ''} aux personnes majeures.</p>
      <button type="button" class="oval oval--small" data-verify>Vérifier mon âge</button>
    </div>
  </${tag}>`;
}
