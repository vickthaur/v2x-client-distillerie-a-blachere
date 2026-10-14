// La « femme à la paille » de l'étiquette PAC, redessinée en vectoriel d'après le scan de
// l'étiquette (coupée par le bord gauche, chevelure noire soulignée d'ocre qui finit en crochet,
// œil en amande à longs cils, blush en trame de points, lèvres ocre, paille blanche).
// Dessin provisoire de la maquette : à remplacer par le fichier vectoriel de la distillerie.
// Une seule définition, utilisée par les étiquettes 3D (canvas) et par les pages (SVG).
// Repère : 400 × 1000, visage tourné vers la droite.

export const FEMME_W = 400;
export const FEMME_H = 1000;

const C = {
  peau: '#f6ede1',
  encre: '#17170f',
  ocre: '#d49b64',
  levres: '#d5824e',
  levres2: '#c06c39',
  iris: '#c79a6c',
};

// Contour extérieur de la chevelure (porte le liseré ocre).
const OUTER = 'M52 0 C170 60 300 230 335 420 C352 560 346 760 318 880 C304 944 276 986 236 1000';
const HAIR =
  'M0 0 L52 0 C170 60 300 230 335 420 C352 560 346 760 318 880 C304 944 276 986 236 1000 L206 1000 C236 972 254 930 258 880 C268 762 266 642 242 545 C226 484 198 446 168 430 C116 402 58 336 0 246 Z';
const FACE_CLIP = 'M0 246 C58 336 116 402 168 430 C198 446 226 484 242 545 C266 642 268 762 258 880 C254 930 236 972 206 1000 L0 1000 Z';
const BROW = 'M30 456 C74 424 142 420 186 444';
const EYE = 'M20 594 C70 548 182 540 254 580 C190 630 80 642 20 594 Z';
const LID = 'M16 596 C70 544 184 534 260 578';
const LIP_UP = 'M0 902 C22 892 42 888 60 898 C70 891 84 893 96 905 C72 913 40 917 0 914 Z';
const LIP_DOWN = 'M0 917 C36 921 72 917 96 907 C82 940 42 956 0 951 Z';
const LIP_LINE = 'M0 915 C36 919 70 915 96 906';

// Points du bord supérieur de la paupière (cils), calculés sur la courbe LID.
function lashes() {
  const P0 = [16, 596];
  const P1 = [70, 544];
  const P2 = [184, 534];
  const P3 = [260, 578];
  const bez = (t, i) => (1 - t) ** 3 * P0[i] + 3 * (1 - t) ** 2 * t * P1[i] + 3 * (1 - t) * t * t * P2[i] + t ** 3 * P3[i];
  const out = [];
  for (let k = 0; k < 12; k++) {
    const t = 0.36 + k * 0.058;
    const x = bez(t, 0);
    const y = bez(t, 1);
    const a = (-78 + k * 6.5) * (Math.PI / 180);
    const len = 38 + k * 4.5;
    const cx = x + Math.cos(a - 0.5) * len * 0.55;
    const cy = y + Math.sin(a - 0.5) * len * 0.55;
    out.push(`M${x.toFixed(1)} ${y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${(x + Math.cos(a) * len).toFixed(1)} ${(y + Math.sin(a) * len).toFixed(1)}`);
  }
  return out.join(' ');
}
const LASHES = lashes();
const LOWER_LASHES = [0, 1, 2, 3, 4, 5, 6, 7]
  .map((k) => {
    const x = 60 + k * 24;
    const y = 624 - Math.sin((k / 7) * Math.PI) * 9;
    return `M${x} ${y} l${3 + k * 0.8} ${11 + (k % 2) * 5}`;
  })
  .join(' ');

// ---------- Canvas (étiquettes 3D) ----------
let halftone = null;
function halftonePattern(g, color) {
  if (!halftone) {
    halftone = document.createElement('canvas');
    halftone.width = halftone.height = 10;
  }
  const h = halftone.getContext('2d');
  h.clearRect(0, 0, 10, 10);
  h.fillStyle = color;
  h.beginPath();
  h.arc(5, 5, 2.1, 0, Math.PI * 2);
  h.fill();
  return g.createPattern(halftone, 'repeat');
}

// Dessine la femme à (x, y) avec l'échelle s (1 = 400 × 1000 px).
// opts.palette permet les variantes d'archives (orange, turquoise…) sans changer le dessin.
export function drawFemme(g, x, y, s, opts = {}) {
  const col = { ...C, ...(opts.palette || {}) };
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  const face = new Path2D(FACE_CLIP);
  // Peau, avec une ombre douce le long des cheveux (aérographe)
  g.fillStyle = col.peau;
  g.fill(face);
  g.save();
  g.clip(face);
  const shade = g.createLinearGradient(260, 0, 120, 0);
  shade.addColorStop(0, 'rgba(212,155,100,0.55)');
  shade.addColorStop(1, 'rgba(212,155,100,0)');
  g.fillStyle = shade;
  g.fillRect(0, 380, 280, 620);
  // Fard à paupières
  const lid = g.createRadialGradient(140, 560, 10, 140, 560, 120);
  lid.addColorStop(0, 'rgba(212,155,100,0.9)');
  lid.addColorStop(1, 'rgba(212,155,100,0)');
  g.fillStyle = lid;
  g.fillRect(0, 440, 300, 220);
  // Blush en trame de points
  g.save();
  g.beginPath();
  g.arc(204, 752, 86, 0, Math.PI * 2);
  g.clip();
  const blush = g.createRadialGradient(204, 752, 10, 204, 752, 88);
  blush.addColorStop(0, 'rgba(213,130,78,0.55)');
  blush.addColorStop(1, 'rgba(213,130,78,0)');
  g.fillStyle = blush;
  g.fillRect(100, 650, 220, 200);
  g.globalAlpha = 0.3;
  g.fillStyle = halftonePattern(g, col.levres);
  g.fillRect(100, 650, 220, 200);
  g.restore();
  g.restore();
  // Œil
  g.fillStyle = '#fff';
  g.fill(new Path2D(EYE));
  g.save();
  g.clip(new Path2D(EYE));
  g.fillStyle = col.iris;
  g.beginPath();
  g.arc(160, 588, 38, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#6b4426';
  g.lineWidth = 7;
  g.stroke();
  g.fillStyle = col.encre;
  g.beginPath();
  g.arc(160, 588, 17, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(171, 577, 7, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = col.encre;
  g.lineWidth = 9;
  g.stroke(new Path2D(LID));
  g.lineWidth = 10;
  g.stroke(new Path2D(BROW));
  g.lineWidth = 3;
  g.stroke(new Path2D(LOWER_LASHES));
  // Chevelure et liseré ocre
  g.fillStyle = col.encre;
  g.fill(new Path2D(HAIR));
  g.strokeStyle = col.ocre;
  g.lineWidth = 16;
  g.stroke(new Path2D(OUTER));
  // Cils : foncés sur la peau, clairs sur les cheveux
  const lashPath = new Path2D(LASHES);
  g.lineWidth = 4.5;
  g.save();
  g.clip(face);
  g.strokeStyle = col.encre;
  g.stroke(lashPath);
  g.restore();
  g.save();
  g.clip(new Path2D(HAIR));
  g.strokeStyle = '#e8e1d4';
  g.stroke(lashPath);
  g.restore();
  // Lèvres
  g.fillStyle = col.levres;
  g.fill(new Path2D(LIP_UP));
  g.fillStyle = col.levres2;
  g.fill(new Path2D(LIP_DOWN));
  g.strokeStyle = col.encre;
  g.lineWidth = 3;
  g.stroke(new Path2D(LIP_LINE));
  g.restore();
}

// Paille : des lèvres (point d'attache en repère femme) jusqu'à (tx, ty) en repère canvas.
export function drawStraw(g, x, y, s, tx, ty, width = 16) {
  const ax = x + 52 * s;
  const ay = y + 912 * s;
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = C.encre;
  g.lineWidth = width * s + 5;
  g.beginPath();
  g.moveTo(ax, ay);
  g.lineTo(tx, ty);
  g.stroke();
  g.strokeStyle = '#fff';
  g.lineWidth = width * s;
  g.stroke();
  g.restore();
}

// ---------- SVG (pages) ----------
let svgId = 0;
export function femmeSVG({ className = '', title = '', straw = null, palette = {} } = {}) {
  const col = { ...C, ...palette };
  const id = `femme${++svgId}`;
  const strawLine = straw
    ? `<path d="M52 912 L${straw[0]} ${straw[1]}" stroke="${col.encre}" stroke-width="22" stroke-linecap="round"/><path d="M52 912 L${straw[0]} ${straw[1]}" stroke="#fff" stroke-width="15" stroke-linecap="round"/>`
    : '';
  return `<svg class="${className}" viewBox="0 0 ${straw ? Math.max(FEMME_W, straw[0] + 20) : FEMME_W} ${straw ? Math.max(FEMME_H, straw[1] + 20) : FEMME_H}" xmlns="http://www.w3.org/2000/svg" ${title ? `role="img" aria-label="${title}"` : 'aria-hidden="true" focusable="false"'} overflow="visible">
  <defs>
    <clipPath id="${id}-face"><path d="${FACE_CLIP}"/></clipPath>
    <clipPath id="${id}-hair"><path d="${HAIR}"/></clipPath>
    <clipPath id="${id}-eye"><path d="${EYE}"/></clipPath>
    <linearGradient id="${id}-shade" x1="260" x2="120" y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#d49b64" stop-opacity=".55"/><stop offset="1" stop-color="#d49b64" stop-opacity="0"/></linearGradient>
    <radialGradient id="${id}-lid" cx="140" cy="560" r="120" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#d49b64" stop-opacity=".9"/><stop offset="1" stop-color="#d49b64" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}-blush" cx="204" cy="752" r="88" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${col.levres}" stop-opacity=".6"/><stop offset="1" stop-color="${col.levres}" stop-opacity="0"/></radialGradient>
    <pattern id="${id}-dots" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="2.1" fill="${col.levres}" opacity=".55"/></pattern>
    <mask id="${id}-bm"><circle cx="204" cy="752" r="86" fill="url(#${id}-blush)"/></mask>
  </defs>
  <path d="${FACE_CLIP}" fill="${col.peau}"/>
  <g clip-path="url(#${id}-face)">
    <rect x="0" y="380" width="280" height="620" fill="url(#${id}-shade)"/>
    <rect x="0" y="440" width="300" height="220" fill="url(#${id}-lid)"/>
    <circle cx="204" cy="752" r="86" fill="url(#${id}-blush)"/>
    <rect x="110" y="650" width="200" height="200" fill="url(#${id}-dots)" mask="url(#${id}-bm)" opacity=".55"/>
  </g>
  <path d="${EYE}" fill="#fff"/>
  <g clip-path="url(#${id}-eye)"><circle cx="160" cy="588" r="38" fill="${col.iris}" stroke="#6b4426" stroke-width="7"/><circle cx="160" cy="588" r="17" fill="${col.encre}"/><circle cx="171" cy="577" r="7" fill="#fff"/></g>
  <g fill="none" stroke="${col.encre}" stroke-linecap="round" stroke-linejoin="round">
    <path d="${LID}" stroke-width="9"/><path d="${BROW}" stroke-width="10"/><path d="${LOWER_LASHES}" stroke-width="3"/>
  </g>
  <path d="${HAIR}" fill="${col.encre}"/>
  <path d="${OUTER}" fill="none" stroke="${col.ocre}" stroke-width="16"/>
  <g fill="none" stroke-linecap="round" stroke-width="4.5">
    <path d="${LASHES}" stroke="${col.encre}" clip-path="url(#${id}-face)"/>
    <path d="${LASHES}" stroke="#e8e1d4" clip-path="url(#${id}-hair)"/>
  </g>
  ${strawLine}
  <path d="${LIP_UP}" fill="${col.levres}"/><path d="${LIP_DOWN}" fill="${col.levres2}"/>
  <path d="${LIP_LINE}" fill="none" stroke="${col.encre}" stroke-width="3"/>
</svg>`;
}
