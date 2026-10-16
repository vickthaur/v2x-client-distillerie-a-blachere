// Les archives de la distillerie (étiquettes, affiches, documents, cartes postales, photographies
// publiées sur le site officiel) présentées comme au musée : cadre, passe-partout et cartel
// (titre, date telle qu'elle est imprimée sur la pièce, technique, statut). Aucune date n'est
// déduite : sans date imprimée, le cartel dit « Sans date » (usage des musées, « s. d. ») ; la
// note « Date à préciser » (archives.json) reste visible en mode revue (src/lib/revue.js).
// Aile « spiritueux » : réservée aux personnes majeures (comme tout ce qui touche à l'alcool).
import data from '../data/site/archives.json';
import { corrigerPiece } from '../data/corrections.js';
import { esc } from '../lib/dom.js';
import { selonRevue } from '../lib/revue.js';

// cartels avec leurs espaces insécables (« Tampon « 16 mai 1962 » », « 40 % vol. »)
export const pieces = data.pieces.map(corrigerPiece);
export const pieceById = Object.fromEntries(pieces.map((p) => [p.id, p]));
export const AILES = [
  { id: 'sirops', nom: 'L’aile des sirops', texte: 'Les étiquettes du PAC, de la menthe bleue «\u00a0Aurélie\u00a0» et des sirops pur sucre.' },
  { id: 'maison', nom: 'La maison', texte: 'Cartes postales et papiers à en-tête de la rue Molière, à Avignon.' },
  { id: 'spiritueux', nom: 'L’aile des spiritueux', texte: 'Affiches, étiquettes et documents des liqueurs, des apéritifs et des marcs.', majeur: true },
];
export const STATUT = 'Archive de la distillerie';

export const visiblePieces = (majeur) => pieces.filter((p) => p.aile !== 'spiritueux' || majeur);

// Date du cartel : telle qu'elle est imprimée, sinon « Sans date » (« Date à préciser » en revue).
export const dateHTML = (date) => (/à préciser/i.test(date || '') ? selonRevue('Sans date', esc(date)) : esc(date));

// Tailles réduites écrites par scripts/photos.mjs (public/archives-tailles/<id>-<largeur>.webp),
// seulement pour les originaux plus larges : le navigateur prend la plus petite qui suffit.
const TAILLES = [400, 800];
export const srcsetPiece = (p) =>
  p.largeur > TAILLES[0] ? [...TAILLES.filter((w) => p.largeur > w).map((w) => `/archives-tailles/${p.id}-${w}.webp ${w}w`), `${p.image} ${p.largeur}w`].join(', ') : '';

// Image d'archive seule (photos de l'accueil, de la maison, des spiritueux) : srcset et dimensions.
export function imgPiece(p, { alt = '', sizes = '(max-width: 760px) 100vw, 50vw', eager = false } = {}) {
  const srcset = srcsetPiece(p);
  return `<img src="${p.image}"${srcset ? ` srcset="${srcset}" sizes="${sizes}"` : ''} alt="${esc(alt)}" width="${p.largeur}" height="${p.hauteur}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />`;
}

// Pièce encadrée. link : lien vers la pièce dans les archives ; legende : texte du cartel ;
// sizes : largeur affichée du cadre (choix de la taille dans le srcset) ; zoom : le cadre est un
// bouton qui ouvre la pièce en grand (archives : souris, clavier, lecteur d'écran).
export function pieceHTML(p, { link = true, eager = false, legende = false, tag = 'li', sizes = '(max-width: 760px) 50vw, 22vw', zoom = false } = {}) {
  const srcset = srcsetPiece(p);
  const img = `<img src="${p.image}"${srcset ? ` srcset="${srcset}" sizes="${sizes}"` : ''} alt="${esc(p.titre)}" width="${p.largeur}" height="${p.hauteur}" ${eager ? '' : 'loading="lazy"'} decoding="async" />`;
  const photo = /photographie/i.test(p.technique) && !/étiquette/i.test(p.technique);
  const frame = zoom
    ? `<button type="button" class="piece__frame piece__zoom${photo ? ' piece__frame--photo' : ''}" aria-haspopup="dialog" aria-label="Voir en grand\u00a0: ${esc(p.titre)}"><span class="piece__mat">${img}</span></button>`
    : `<span class="piece__frame${photo ? ' piece__frame--photo' : ''}"><span class="piece__mat">${img}</span></span>`;
  const cartel = `<span class="cartel">
      <span class="cartel__title">${esc(p.titre)}</span>
      <span class="cartel__meta">${dateHTML(p.date)}</span>
      <span class="cartel__meta">${esc(p.technique)} · ${STATUT}</span>
      ${legende && p.legende ? `<span class="cartel__text">${esc(p.legende)}</span>` : ''}
    </span>`;
  const inner = link ? `<a href="/musee#${p.id}">${frame}${cartel}</a>` : `<div class="piece__in">${frame}${cartel}</div>`;
  return `<${tag} class="piece" id="${link ? '' : p.id}" data-aile="${p.aile}">${inner}</${tag}>`.replace(' id=""', '');
}
