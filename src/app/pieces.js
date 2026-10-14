// Les archives de la distillerie (étiquettes, affiches, documents, cartes postales, photographies
// publiées sur le site officiel) présentées comme au musée : cadre, passe-partout et cartel
// (titre, date telle qu'elle est imprimée sur la pièce, technique, statut). Aucune date n'est
// déduite : sans date imprimée, le cartel dit « Date à préciser ».
// Aile « spiritueux » : réservée aux personnes majeures (comme tout ce qui touche à l'alcool).
import data from '../data/site/archives.json';
import { esc } from '../lib/dom.js';

export const pieces = data.pieces;
export const pieceById = Object.fromEntries(pieces.map((p) => [p.id, p]));
export const AILES = [
  { id: 'sirops', nom: 'L’aile des sirops', texte: 'Les étiquettes du PAC, de la menthe bleue « Aurélie » et des sirops pur sucre.' },
  { id: 'maison', nom: 'La maison', texte: 'Cartes postales et papiers à en-tête de la rue Molière, à Avignon.' },
  { id: 'spiritueux', nom: 'L’aile des spiritueux', texte: 'Affiches, étiquettes et documents des liqueurs, des apéritifs et des marcs.', majeur: true },
];
export const STATUT = 'Archive de la distillerie';

export const visiblePieces = (majeur) => pieces.filter((p) => p.aile !== 'spiritueux' || majeur);

// Pièce encadrée. link : lien vers la pièce dans les archives ; legende : texte du cartel.
export function pieceHTML(p, { link = true, eager = false, legende = false, tag = 'li', sizes = '(max-width: 760px) 80vw, 30vw' } = {}) {
  const img = `<img src="${p.image}" alt="${esc(p.titre)}" width="${p.largeur}" height="${p.hauteur}" ${eager ? '' : 'loading="lazy"'} decoding="async" sizes="${sizes}" />`;
  const photo = /photographie/i.test(p.technique) && !/étiquette/i.test(p.technique);
  const frame = `<span class="piece__frame${photo ? ' piece__frame--photo' : ''}"><span class="piece__mat">${img}</span></span>`;
  const cartel = `<span class="cartel">
      <span class="cartel__title">${esc(p.titre)}</span>
      <span class="cartel__meta">${esc(p.date)}</span>
      <span class="cartel__meta">${esc(p.technique)} · ${STATUT}</span>
      ${legende && p.legende ? `<span class="cartel__text">${esc(p.legende)}</span>` : ''}
    </span>`;
  const inner = link ? `<a href="/musee#${p.id}">${frame}${cartel}</a>` : `<div class="piece__in">${frame}${cartel}</div>`;
  return `<${tag} class="piece" id="${link ? '' : p.id}" data-aile="${p.aile}">${inner}</${tag}>`.replace(' id=""', '');
}
