// Fabrique des bouteilles 3D : la vraie photo quand elle a été déposée dans photos/produits/
// (et traitée au build), sinon la bouteille dessinée en code.
import { photoIndex } from '../lib/photos.js';
import { createBottle } from './bottle.js';
import { labelFontsReady } from './labels.js';
import { createPhotoBottle } from './photoBottle.js';

export async function makeBottle(product, opts = {}) {
  const entry = (await photoIndex())[product.slug];
  if (entry) {
    try {
      return await createPhotoBottle(product, entry, opts);
    } catch (err) {
      console.warn(`Photo de ${product.slug} inutilisable, bouteille dessinée affichée.`, err);
    }
  }
  await labelFontsReady();
  return createBottle(product, opts);
}
