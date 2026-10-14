// Illustration SVG d'une bouteille (même silhouette que la 3D) : affichée quand WebGL n'est pas
// disponible, et dans les vignettes en attendant le rendu 3D ou la photo.
// Étiquettes simplifiées par famille : pac, funblue, provence (Couleur Provence®), maison (spiritueux).
import { shapes, shapeHeight } from '../data/shapes.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let uid = 0;

function labelSVG(p, id, x, y, w, h) {
  const cx = x + w / 2;
  const [a, b] = p.lignes;
  const fit = (text, max, size) => Math.min(size, (max / Math.max(text.length, 1)) * 1.9);
  switch (p.label) {
    case 'pac':
      return `<defs><pattern id="${id}-st" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-10)"><rect width="12" height="12" fill="#c2167f"/><rect y="10.6" width="12" height="1.4" fill="#fff" opacity=".9"/></pattern></defs>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id}-st)"/>
        <path d="M${x} ${y} q${w * 0.28} ${h * 0.35} ${w * 0.05} ${h}" fill="none" stroke="#17170f" stroke-width="${w * 0.16}"/>
        <text x="${cx + w * 0.06}" y="${y + h * 0.5}" text-anchor="middle" font-family="Lobster Two, cursive" font-style="italic" font-weight="700" font-size="${w * 0.5}" fill="#ebd540" stroke="#fff" stroke-width="${w * 0.05}" paint-order="stroke" stroke-linejoin="round">pac</text>
        <ellipse cx="${cx + w * 0.08}" cy="${y + h * 0.76}" rx="${w * 0.34}" ry="${h * 0.15}" fill="#ebd540" stroke="#17170f" stroke-width="1"/>
        <text x="${cx + w * 0.08}" y="${y + h * 0.79}" text-anchor="middle" font-family="Cinzel, serif" font-weight="900" font-size="${w * 0.13}" fill="#d8962e">CITRON</text>`;
    case 'funblue':
      return `<defs><linearGradient id="${id}-fb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6e9bd0"/><stop offset=".55" stop-color="#2f64a8"/><stop offset="1" stop-color="#1d459b"/></linearGradient></defs>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id}-fb)"/>
        <rect x="${x}" y="${y + h * 0.66}" width="${w}" height="${h * 0.34}" fill="#357691"/>
        <ellipse cx="${cx}" cy="${y + h * 0.66}" rx="${w * 0.2}" ry="${h * 0.08}" fill="#3f8a3c"/>
        <path d="M${cx + w * 0.26} ${y + h * 0.86} l${w * 0.1} ${-h * 0.3} l${w * 0.02} ${h * 0.3}z" fill="#f4f8fc"/>
        <text x="${cx}" y="${y + h * 0.3}" text-anchor="middle" font-family="Molle, cursive" font-style="italic" font-size="${w * 0.27}" fill="#fff">Fun</text>
        <text x="${cx + w * 0.06}" y="${y + h * 0.5}" text-anchor="middle" font-family="Molle, cursive" font-style="italic" font-size="${w * 0.27}" fill="#fff">Blue</text>`;
    case 'maison':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#eadfc2"/>
        <rect x="${x + w * 0.06}" y="${y + h * 0.05}" width="${w * 0.88}" height="${h * 0.9}" fill="none" stroke="#3b2a1e" stroke-width="1.4"/>
        <text x="${cx}" y="${y + h * 0.2}" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="700" font-size="${w * 0.075}" letter-spacing="1" fill="#3b2a1e">A. BLACHÈRE</text>
        <text x="${cx}" y="${y + h * 0.47}" text-anchor="middle" font-family="Federant, serif" font-size="${fit(a, w * 0.8, w * 0.2)}" fill="#3b2a1e">${esc(a.toUpperCase())}</text>
        <text x="${cx}" y="${y + h * 0.66}" text-anchor="middle" font-family="Federant, serif" font-size="${fit(b, w * 0.8, w * 0.2)}" fill="${p.bottle.cap}">${esc(b.toUpperCase())}</text>
        <text x="${cx}" y="${y + h * 0.86}" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="600" font-size="${w * 0.065}" fill="#3b2a1e">DEPUIS 1835</text>`;
    default: {
      const name = b ? `${a} ${b}` : a;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f6f1e7"/>
        <rect x="${x}" y="${y + h * 0.3}" width="${w}" height="${h * 0.42}" fill="${p.color}"/>
        <text x="${cx}" y="${y + h * 0.18}" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="700" font-size="${w * 0.07}" letter-spacing="1" fill="#17170f">COULEUR PROVENCE®</text>
        <text x="${cx}" y="${y + h * 0.56}" text-anchor="middle" font-family="Fraunces, serif" font-weight="700" font-size="${fit(name, w * 0.86, w * 0.22)}" fill="#fff">${esc(name)}</text>
        <text x="${cx}" y="${y + h * 0.88}" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="600" font-size="${w * 0.065}" fill="#17170f">A. BLACHÈRE · 1835</text>`;
    }
  }
}

export function bottleSVG(p, { title = false } = {}) {
  const s = shapes[p.bottle.shape] || shapes.sirop;
  const H = shapeHeight(s) + 4;
  const W = 120;
  const cx = W / 2;
  const Y = (y) => H - y;
  const right = s.pts.map(([r, y]) => `${(cx + r).toFixed(1)},${Y(y).toFixed(1)}`);
  const left = [...s.pts].reverse().map(([r, y]) => `${(cx - r).toFixed(1)},${Y(y).toFixed(1)}`);
  const outline = `M${right.join(' L')} L${left.join(' L')} Z`;
  const id = `b${++uid}`;
  const [l0, l1] = s.label;
  const [c0, c1, cr] = s.closure;
  const capFill = p.bottle.closure === 'cork' ? '#8a5a32' : p.bottle.cap;
  const lw = (s.body + 0.4) * 2;
  return `<svg class="bottle-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(p.nom)}">
  ${title ? `<title>${esc(p.nom)}</title>` : ''}
  <defs>
    <clipPath id="${id}-c"><path d="${outline}"/></clipPath>
    <linearGradient id="${id}-l" x1="0" x2="1"><stop offset="0" stop-color="${p.bottle.liquid}" stop-opacity=".78"/><stop offset=".45" stop-color="${p.bottle.liquid}"/><stop offset="1" stop-color="${p.bottle.liquid}" stop-opacity=".7"/></linearGradient>
    <linearGradient id="${id}-g" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".18" stop-color="#fff" stop-opacity=".06"/><stop offset=".78" stop-color="#fff" stop-opacity="0"/><stop offset=".9" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>
  <g clip-path="url(#${id}-c)">
    <rect x="0" y="0" width="${W}" height="${H}" fill="rgba(255,255,255,.35)"/>
    <rect x="0" y="${Y(s.fillTop)}" width="${W}" height="${s.fillTop}" fill="url(#${id}-l)"/>
    <g>${labelSVG(p, id, cx - lw / 2, Y(l1), lw, l1 - l0)}</g>
  </g>
  <rect x="${cx - cr}" y="${Y(c1)}" width="${cr * 2}" height="${c1 - c0}" rx="3" fill="${capFill}"/>
  <path d="${outline}" fill="url(#${id}-g)" stroke="rgba(23,23,15,.28)" stroke-width=".8"/>
</svg>`;
}
