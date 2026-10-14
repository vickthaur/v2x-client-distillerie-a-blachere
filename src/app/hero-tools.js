// Outils des héros de marque : la femme à la paille coupée par le bord gauche, dont la paille
// pointe vers l'ovale jaune ; la bouteille 3D à faire tourner (ou son illustration sans WebGL).
import { femmeSVG } from '../lib/femme.js';
import { $, calm, hasWebGL } from '../lib/dom.js';
import { thumbHTML } from '../lib/thumbs.js';

// La paille part des lèvres (repère 400 × 1000 du dessin) et rejoint la cible (bouton ovale).
export function mountFemme(host, { straw, target, scope }) {
  if (!host) return () => {};
  host.innerHTML = femmeSVG({ className: 'femme' });
  const draw = () => {
    const femme = $('.femme', host);
    const t = typeof target === 'string' ? $(target) : target;
    if (!straw || !femme || !t) return;
    const box = scope.getBoundingClientRect();
    const f = femme.getBoundingClientRect();
    const c = t.getBoundingClientRect();
    if (!f.width || getComputedStyle(host).display === 'none' || getComputedStyle(straw).display === 'none') {
      straw.innerHTML = '';
      return;
    }
    const x0 = f.left + (60 / 400) * f.width - box.left;
    const y0 = f.top + (912 / 1000) * f.height - box.top;
    const x1 = c.left + 14 - box.left;
    const y1 = c.top + c.height / 2 - box.top;
    straw.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    straw.innerHTML = `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#17170f" stroke-width="15" stroke-linecap="round"/>
      <line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#fff" stroke-width="10" stroke-linecap="round"/>`;
  };
  addEventListener('resize', draw);
  document.fonts?.ready.then(draw);
  requestAnimationFrame(draw);
  return draw;
}

// Bouteille 3D dans un cadre (<div class="bstage"><canvas>…</div>). Spiritueux : sobre.
export async function mountBottle(stage, product, colors) {
  if (!stage) return null;
  const canvas = $('canvas', stage);
  const poster = $('.bstage__poster', stage);
  if (poster) poster.innerHTML = thumbHTML(product, { eager: true });
  if (!hasWebGL()) {
    stage.classList.add('is-static');
    return null;
  }
  try {
    const { BottleViewer } = await import('../three/viewer.js');
    const viewer = new BottleViewer(canvas, product, { calm: calm() || product.alcool, garnish: !product.alcool, colors });
    await viewer.ready;
    stage.classList.add('is-live');
    return viewer;
  } catch (err) {
    console.warn('3D indisponible, illustration affichée.', err);
    stage.classList.add('is-static');
    return null;
  }
}
