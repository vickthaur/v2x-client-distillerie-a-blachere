// Fabrique des bouteilles 3D : la vraie photo quand elle a été déposée dans photos/produits/
// (et traitée au build), sinon la bouteille dessinée en code, avec l'étiquette déroulée depuis une
// photo quand elle existe (photos/etiquettes/), sinon l'étiquette dessinée.
import * as THREE from 'three';
import { labelIndex, photoIndex } from '../lib/photos.js';
import { createBottle } from './bottle.js';
import { labelFontsReady } from './labels.js';
import { createPhotoBottle } from './photoBottle.js';

const labelTextures = new Map();
function loadLabel(url, anisotropy) {
  if (!labelTextures.has(url))
    labelTextures.set(
      url,
      new THREE.TextureLoader().loadAsync(url).then((t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = anisotropy;
        t.userData.shared = true;
        return t;
      }),
    );
  return labelTextures.get(url);
}

export async function makeBottle(product, opts = {}) {
  const entry = (await photoIndex())[product.slug];
  if (entry && !opts.drawn) {
    try {
      return await createPhotoBottle(product, entry, opts);
    } catch (err) {
      console.warn(`Photo de ${product.slug} inutilisable, bouteille dessinée affichée.`, err);
    }
  }
  await labelFontsReady();
  let photoLabel = null;
  const lab = (await labelIndex())[product.slug];
  if (lab) {
    try {
      photoLabel = { texture: await loadLabel(lab.texture, opts.anisotropy || 8), angleGauche: lab.angleGauche, angleDroite: lab.angleDroite, ratio: lab.ratio };
    } catch (err) {
      console.warn(`Étiquette photo de ${product.slug} illisible, étiquette dessinée affichée.`, err);
    }
  }
  return createBottle(product, { ...opts, photoLabel });
}
