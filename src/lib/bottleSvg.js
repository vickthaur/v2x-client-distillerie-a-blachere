// Illustration SVG d'une bouteille (même silhouette que la 3D) : affichée quand WebGL n'est pas
// disponible, et dans les cartes de la boutique en attendant le rendu 3D.
import { shapes, shapeHeight } from '../data/shapes.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function bottleSVG(p, { title = true } = {}) {
  const s = shapes[p.bottle.shape];
  const H = shapeHeight(s) + 4;
  const W = 120;
  const cx = W / 2;
  const Y = (y) => H - y;
  const right = s.pts.map(([r, y]) => `${(cx + r).toFixed(1)},${Y(y).toFixed(1)}`);
  const left = [...s.pts].reverse().map(([r, y]) => `${(cx - r).toFixed(1)},${Y(y).toFixed(1)}`);
  const outline = `M${right.join(' L')} L${left.join(' L')} Z`;
  const id = `b-${p.id}`;
  const [l0, l1] = s.label;
  const [c0, c1, cr] = s.closure;
  const L = p.label;
  const pop = L.style === 'pop';
  const capFill = p.bottle.closure === 'cork' ? '#8a5a32' : p.bottle.cap;
  const name0 = esc(p.name[0]);
  const name1 = esc(p.name[1]);
  const lh = l1 - l0;
  return `<svg class="bottle-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(p.fullName)}">
  ${title ? `<title>${esc(p.fullName)}</title>` : ''}
  <defs>
    <clipPath id="${id}-c"><path d="${outline}"/></clipPath>
    <linearGradient id="${id}-l" x1="0" x2="1">
      <stop offset="0" stop-color="${p.bottle.attenuation}"/>
      <stop offset="0.45" stop-color="${p.bottle.liquid}"/>
      <stop offset="1" stop-color="${p.bottle.attenuation}"/>
    </linearGradient>
    <linearGradient id="${id}-g" x1="0" x2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.35"/>
      <stop offset="0.2" stop-color="#fff" stop-opacity="0.05"/>
      <stop offset="0.75" stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.9" stop-color="#fff" stop-opacity="0.25"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <g clip-path="url(#${id}-c)">
    <rect x="0" y="0" width="${W}" height="${H}" fill="rgba(255,255,255,0.08)"/>
    <rect x="0" y="${Y(s.fillTop)}" width="${W}" height="${s.fillTop}" fill="url(#${id}-l)"/>
  </g>
  <rect x="${cx - s.body - 0.5}" y="${Y(l1)}" width="${(s.body + 0.5) * 2}" height="${lh}" rx="2" fill="${L.bg}"/>
  <text x="${cx}" y="${Y(l1) + lh * 0.16}" text-anchor="middle" font-family="Archivo Variable, Arial, sans-serif" font-weight="700" font-size="${s.body * 0.13}" letter-spacing="1" fill="${L.ink}">DISTILLERIE A. BLACHÈRE</text>
  <text x="${cx}" y="${Y(l1) + lh * 0.5}" text-anchor="middle" font-family="${pop ? 'Archivo Variable, Arial Black, sans-serif' : 'Instrument Serif, Georgia, serif'}" font-style="italic" font-weight="${pop ? 900 : 400}" font-size="${Math.min(s.body * 0.5, (s.body * 1.7) / Math.max(name0.length, 3))}" fill="${L.ink}">${name0}</text>
  <text x="${cx}" y="${Y(l1) + lh * 0.7}" text-anchor="middle" font-family="Archivo Variable, Arial Black, sans-serif" font-weight="900" font-size="${Math.min(s.body * 0.3, (s.body * 1.75) / Math.max(name1.length, 4))}" fill="${pop ? L.accent : L.ink}">${name1.toUpperCase()}</text>
  <text x="${cx}" y="${Y(l1) + lh * 0.9}" text-anchor="middle" font-family="Archivo Variable, Arial, sans-serif" font-weight="600" font-size="${s.body * 0.11}" letter-spacing="1" fill="${L.ink}">DEPUIS 1835</text>
  <rect x="${cx - cr}" y="${Y(c1)}" width="${cr * 2}" height="${c1 - c0}" rx="3" fill="${capFill}"/>
  <path d="${outline}" fill="url(#${id}-g)" stroke="rgba(255,255,255,0.35)" stroke-width="0.8"/>
</svg>`;
}
