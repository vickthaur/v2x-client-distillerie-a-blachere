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
// dpr : densité du rendu (1 par défaut ; 2 pour les rendus pré-calculés des écrans haute densité).
export async function renderShots(jobs, onDone, { dpr = 1, type = 'image/webp', quality = 0.88 } = {}) {
  const groups = new Map();
  jobs.forEach((j) => groups.set(j.fmt, [...(groups.get(j.fmt) || []), j]));
  for (const [fmt, list] of groups) {
    const [width, height] = FORMATS[fmt] || FORMATS.portrait;
    const canvas = document.createElement('canvas');
    // max-width:none : sur téléphone, le « max-width: 100% » des canvas (base.css) ramènerait le rendu
    // à la largeur de l'écran et changerait son cadrage
    canvas.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;max-width:none;max-height:none;pointer-events:none;`;
    document.body.appendChild(canvas);
    // cadre des bouteilles dans l'image (format « carte » : la moitié haute, le texte vient dessous)
    const frame = fmt === 'carte' ? { x: 0.1, y: 0.07, w: 0.8, h: 0.53 } : null;
    const target = frame
      ? () => {
          const c = canvas.getBoundingClientRect();
          return { left: c.left + c.width * frame.x, top: c.top + c.height * frame.y, width: c.width * frame.w, height: c.height * frame.h };
        }
      : null;
    // dos : false → les bouteilles sont vues de face, le dos des étiquettes n'est pas téléchargé
    const stage = new Stage(canvas, { colors: { a: THUMB_BG }, bottles: [], manual: true, dpr, target, fill: fmt === 'paysage' ? 0.8 : 0.86, dof: false, sway: false, interactive: false, dos: false, spot: [0, 0, -6.5, 7] });
    try {
      for (const job of list) {
        stage.setColors({ a: job.bg || THUMB_BG });
        await stage.setBottles(layout(job.slugs.filter((s) => bySlug[s])));
        onDone(job, stage.snapshot(type, quality));
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
