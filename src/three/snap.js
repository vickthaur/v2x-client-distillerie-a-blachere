// Rendus produit (cartes de la boutique, panier, menus) : chaque bouteille construite en code est
// photographiée sur le plateau (fond neutre des cartes ou aplat de marque), avec son ombre et son
// reflet, puis exportée en image. Un seul contexte WebGL par série, libéré ensuite.
import { FORMATS } from '../lib/thumbs.js';
import { bySlug } from '../data/products.js';
import { Stage } from './stage.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
export const THUMB_BG = '#efece6';

function layout(slugs) {
  const n = slugs.length;
  const gap = 1.12;
  return slugs.map((s, i) => ({ product: bySlug[s], x: (i - (n - 1) / 2) * gap, z: n === 3 && i === 1 ? 0.25 : 0, ry: bySlug[s]?.label === 'pac' ? 0.05 : 0 }));
}

// jobs : [{ slugs, bg, fmt }] ; onDone(job, dataURL)
export async function renderShots(jobs, onDone) {
  const groups = new Map();
  jobs.forEach((j) => groups.set(j.fmt, [...(groups.get(j.fmt) || []), j]));
  for (const [fmt, list] of groups) {
    const [width, height] = FORMATS[fmt] || FORMATS.portrait;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;pointer-events:none;`;
    document.body.appendChild(canvas);
    const stage = new Stage(canvas, { colors: { a: THUMB_BG }, bottles: [], manual: true, dpr: 1, fill: fmt === 'paysage' ? 0.8 : 0.86, dof: false, sway: false, interactive: false, spot: [0, 0, -6.5, 7] });
    try {
      for (const job of list) {
        stage.setColors({ a: job.bg || THUMB_BG });
        await stage.setBottles(layout(job.slugs.filter((s) => bySlug[s])));
        onDone(job, stage.snapshot());
        await nextFrame();
      }
    } finally {
      stage.dispose();
      canvas.remove();
    }
  }
}

// Compatibilité : une vignette par produit, fond neutre.
export function renderThumbs(products, onDone) {
  return renderShots(
    products.map((p) => ({ slugs: [p.slug], bg: '', fmt: 'portrait' })),
    (job, url) => onDone(job.slugs[0], url),
  );
}
