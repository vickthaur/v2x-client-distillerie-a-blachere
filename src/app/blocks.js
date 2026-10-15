// Blocs partagés par les pages : formules de visite, saison, message sanitaire, bloc verrouillé.
// Tout le texte vient de src/data (faits sourcés) ; rien qui touche à l'alcool ne s'affiche aux
// personnes qui n'ont pas confirmé leur majorité.
import { EVIN, MINEURS } from '../data/products.js';
import { formules, saison } from '../data/site.js';
import { esc } from '../lib/dom.js';
import { icons } from '../lib/icons.js';

// ---------- Visites : les quatre formules ----------
export function formulesHTML({ compact = false, choose = false } = {}) {
  return `<ul class="formules${compact ? ' formules--compact' : ''}">${formules
    .map(
      (f, i) => `<li class="formule" data-reveal>
        <p class="formule__n">0${i + 1}</p>
        <h3 class="formule__nom">${esc(f.nom)}</h3>
        <p class="formule__sous">${esc(f.sous)}</p>
        ${compact ? '' : `<ul class="formule__voir">${f.voir.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>`}
        <dl class="formule__facts">
          <div><dt>Durée</dt><dd>${esc(f.duree)}</dd></div>
          ${f.capacite ? `<div><dt>Groupe</dt><dd>${esc(f.capacite)}</dd></div>` : ''}
          <div><dt>Réservation</dt><dd>${esc(f.reservation)}</dd></div>
        </dl>
        <p class="formule__prix${/confirmer/.test(f.prix) ? ' is-tbc' : ''}">${esc(f.prix)}</p>
        ${f.prixNote && !compact ? `<p class="formule__note">${esc(f.prixNote)}</p>` : ''}
        ${choose && f.reservable ? `<button type="button" class="btn btn--ink formule__go" data-formule="${f.id}">Choisir cette formule</button>` : ''}
      </li>`,
    )
    .join('')}</ul>`;
}

export const saisonHTML = () => `<p class="saison">${icons.clock}<span><strong>Saison 2026\u00a0:</strong> ${esc(saison.texte.replace('Du ', 'du '))} · ${esc(saison.ferme.toLowerCase())}</span></p>`;

// ---------- Message sanitaire ----------
export const evinHTML = (extra = '') => `<p class="evin ${extra}">${esc(EVIN)} ${esc(MINEURS)}</p>`;

// Bloc verrouillé (porte d'âge) : aucun nom, visuel ou prix d'alcool.
export function lockHTML({ mineur = false, titre = 'Réservé aux personnes majeures', texte = '' } = {}) {
  return `<div class="lockbox">
    <span class="lockbox__icon">${icons.lock}</span>
    <p class="lockbox__title">${esc(titre)}</p>
    <p class="lockbox__text">${
      mineur ? 'Cette partie du site est réservée aux personnes majeures. Bonne découverte de nos sirops, de notre histoire et des visites.' : esc(texte || 'Indiquez votre date de naissance pour voir cette partie du site.')
    }</p>
    ${mineur ? '<a class="btn btn--ink" href="/couleur-provence">Voir les sirops</a>' : '<button type="button" class="btn btn--primary btn--sm" data-verify>Vérifier mon âge</button>'}
    ${evinHTML('lockbox__evin')}
  </div>`;
}
