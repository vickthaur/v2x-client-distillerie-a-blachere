// Vignettes des bouteilles construites en code (cartes de la boutique, panier, menus) : chaque
// bouteille est photographiée seule sur le fond neutre des cartes, avec son ombre et son reflet,
// puis exportée en image. Un seul contexte WebGL, libéré après chaque série.
import { Stage } from './stage.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
export const THUMB_BG = '#efece6';

export async function renderThumbs(products, onDone, { width = 420, height = 560 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;`;
  canvas.width = width;
  canvas.height = height;
  document.body.appendChild(canvas);
  const stage = new Stage(canvas, { colors: { a: THUMB_BG }, bottles: [], manual: true, dpr: 1, fill: 0.86, dof: false, sway: false, interactive: false, spot: [0, 0, -6.5, 7] });
  try {
    for (const p of products) {
      await stage.setBottles([{ product: p, x: 0, ry: p.label === 'pac' ? 0.05 : 0 }]);
      onDone(p.slug, stage.snapshot());
      await nextFrame();
    }
  } finally {
    stage.dispose();
    canvas.remove();
  }
}
