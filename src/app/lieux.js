// Photos des lieux : un cadre « photo à faire » marqué data-lieu="comptoir" est remplacé par la
// photo traitée (photos/lieux/comptoir.jpg → public/lieux/comptoir-1600.webp et -800.webp) dès
// qu'elle existe. Sans photo, le cadre reste tel quel.
import { placeIndex } from '../lib/photos.js';
import { $$, esc } from '../lib/dom.js';

export async function fillPlaces(root = document) {
  const lieux = await placeIndex();
  $$('[data-lieu]', root).forEach((el) => {
    const l = lieux[el.dataset.lieu];
    if (!l) return;
    const big = l.tailles?.[1600];
    const small = l.tailles?.[800];
    if (!big) return;
    const alt = el.dataset.alt || '';
    el.outerHTML = `<img class="lieu-photo" src="${big.fichier}" srcset="${small ? `${small.fichier} ${small.largeur}w, ` : ''}${big.fichier} ${big.largeur}w" sizes="(max-width: 760px) 100vw, 50vw" width="${big.largeur}" height="${big.hauteur}" alt="${esc(alt)}" loading="lazy" decoding="async" />`;
  });
}
