// Étiquettes des bouteilles 3D dessinées en code, en attendant les photos ou les fichiers
// d'impression : une étiquette de face et une contre-étiquette, posées comme de vraies étiquettes
// (bords nets, le liquide se voit entre les deux). Rendu « imprimé » : aplats légèrement tramés,
// grain du papier, pas de contours de dessin animé.
// - pac      : reproduction de l'étiquette PAC Citron (fuchsia, rayures, femme à la paille, ovale
//              jaune). Utilisée seulement si l'étiquette déroulée depuis la photo est absente.
// - funblue  : d'après les étiquettes Fun Blue d'archives (lagon, île, planches à voile).
// - provence : gabarit provisoire des sirops Couleur Provence® (étiquette réelle à fournir).
// - maison   : gabarit provisoire des spiritueux (papier crème, filets et lettres dorées à chaud).
// Aucun texte inventé : seulement le nom, la gamme, la contenance et les mentions connues.
import { drawFemme, drawStraw } from '../lib/femme.js';
import { EVIN } from '../data/products.js';
import { rng } from './tex.js';

const F = {
  sans: '"Archivo", system-ui, sans-serif',
  serif: '"Fraunces", Georgia, serif',
  pac: '"Lobster Two", cursive',
  fb: '"Molle", cursive',
  badge: '"Della Respira", Georgia, serif',
  citron: '"Cinzel", Georgia, serif',
  affiche: '"Federant", Georgia, serif',
};

let fontsReady = null;
// Les étiquettes utilisent les polices du site : on attend qu'elles soient chargées.
export function labelFontsReady() {
  fontsReady ||= Promise.race([
    Promise.all(
      [`italic 700 80px ${F.pac}`, `italic 400 80px ${F.fb}`, `400 40px ${F.badge}`, `900 40px ${F.citron}`, `400 40px ${F.affiche}`, `700 40px ${F.sans}`, `700 40px ${F.serif}`, `italic 500 40px ${F.serif}`].map((f) =>
        document.fonts.load(f).catch(() => null),
      ),
    ),
    new Promise((r) => setTimeout(r, 3000)),
  ]);
  return fontsReady;
}

// Proportions des étiquettes (angle couvert autour de la bouteille, hauteur relative).
export const LABELS = {
  pac: { front: 165, back: 95, backSpan: [0.25, 1.1], film: true },
  funblue: { front: 175, back: 95, backSpan: [0.1, 0.95], film: true },
  provence: { front: 150, back: 92, backSpan: [0.08, 0.92], film: false },
  maison: { front: 128, back: 84, backSpan: [0.1, 0.9], film: false },
};

function fit(g, text, font, maxW, maxSize) {
  g.font = font(maxSize);
  const w = g.measureText(text).width;
  return w > maxW ? (maxSize * maxW) / w : maxSize;
}

function spaced(g, text, x, y, spacing) {
  const chars = [...text];
  const widths = chars.map((ch) => g.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  const align = g.textAlign;
  let cx = align === 'left' ? x : align === 'right' ? x - total : x - total / 2;
  g.textAlign = 'left';
  chars.forEach((ch, i) => {
    g.fillText(ch, cx, y);
    cx += widths[i] + spacing;
  });
  g.textAlign = align;
}

function arcText(g, text, cx, cy, r, center, spacing = 0) {
  const chars = [...text];
  const widths = chars.map((ch) => g.measureText(ch).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0);
  let a = center + total / 2 / r;
  g.save();
  chars.forEach((ch, i) => {
    const w = widths[i];
    a -= w / 2 / r;
    g.save();
    g.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    g.rotate(a - Math.PI / 2);
    g.textAlign = 'center';
    g.fillText(ch, 0, 0);
    g.restore();
    a -= w / 2 / r;
  });
  g.restore();
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function wrapText(g, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  words.forEach((w) => {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  });
  if (line) lines.push(line);
  return lines;
}

// Rayures blanches qui montent d'environ 10° vers la droite (étiquette PAC).
function pinstripes(g, x, y, w, h, gap, width, color = 'rgba(255,255,255,0.88)') {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.strokeStyle = color;
  g.lineWidth = width;
  const slope = Math.tan((10 * Math.PI) / 180);
  for (let k = -Math.ceil((w * slope) / gap) - 2; k * gap < h + w * slope + gap; k++) {
    const y0 = y + k * gap;
    g.beginPath();
    g.moveTo(x, y0 + w * slope);
    g.lineTo(x + w, y0);
    g.stroke();
  }
  g.restore();
}

function barcode(g, x, y, w, h, seed) {
  const rand = rng(seed);
  g.fillStyle = '#fbfaf6';
  g.fillRect(x, y, w, h);
  g.fillStyle = '#1b1a17';
  let cx = x + w * 0.1;
  while (cx < x + w * 0.9) {
    const bw = (1 + Math.floor(rand() * 3)) * w * 0.009;
    if (rand() > 0.4) g.fillRect(cx, y + h * 0.08, bw, h * 0.8);
    cx += bw + w * 0.009;
  }
}

// Grain d'impression : légère irrégularité de l'encre et du papier (multiplie, très faible).
function printGrain(g, W, H, seed, amount = 0.05) {
  const rand = rng(seed);
  const n = Math.round((W * H) / 900);
  for (let i = 0; i < n; i++) {
    const v = rand();
    g.fillStyle = v < 0.5 ? `rgba(0,0,0,${rand() * amount})` : `rgba(255,255,255,${rand() * amount * 0.8})`;
    const s = 1 + rand() * 2.2;
    g.fillRect(rand() * W, rand() * H, s, s);
  }
}

// ---------------------------------------------------------------- PAC Citron (secours)
function frontPac(g, p, W, H) {
  g.fillStyle = '#c2177f';
  g.fillRect(0, 0, W, H);
  pinstripes(g, 0, 0, W, H, H / 9.5, Math.max(2, H / 260));
  const s = H / 1000;
  const fx = -W * 0.02;
  const oval = { x: W * 0.6, y: H * 0.79, rx: W * 0.26, ry: H * 0.15 };
  // femme et paille (bord gauche)
  drawFemme(g, fx, 0, s);
  drawStraw(g, fx, 0, s, oval.x - oval.rx * 0.82, oval.y + oval.ry * 0.05, 13);
  g.save();
  g.translate(W * 0.55, H * 0.075);
  g.rotate((-6 * Math.PI) / 180);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.font = `700 ${H * 0.038}px ${F.sans}`;
  spaced(g, 'CONSERVER ET CONSOMMER FRAIS', 0, 0, H * 0.002);
  g.restore();
  // logo « pac » : dégradé or → jaune, filet blanc fin (comme l'étiquette imprimée)
  g.save();
  g.translate(W * 0.6, H * 0.53);
  g.rotate((-4 * Math.PI) / 180);
  g.textAlign = 'center';
  const size = fit(g, 'pac', (n) => `italic 700 ${n}px ${F.pac}`, W * 0.62, H * 0.56);
  g.font = `italic 700 ${size}px ${F.pac}`;
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(40,10,25,0.55)';
  g.lineWidth = size * 0.07;
  g.strokeText('pac', 0, 0);
  g.strokeStyle = '#fffdf6';
  g.lineWidth = size * 0.05;
  g.strokeText('pac', 0, 0);
  const grad = g.createLinearGradient(0, size * 0.08, 0, -size * 0.62);
  grad.addColorStop(0, '#c8861f');
  grad.addColorStop(0.5, '#e9c234');
  grad.addColorStop(1, '#f5e35a');
  g.fillStyle = grad;
  g.fillText('pac', 0, 0);
  g.restore();
  // ovale
  g.save();
  g.translate(oval.x, oval.y);
  g.rotate((-5 * Math.PI) / 180);
  g.beginPath();
  g.ellipse(0, 0, oval.rx, oval.ry, 0, 0, Math.PI * 2);
  g.fillStyle = '#ead63e';
  g.fill();
  g.lineWidth = H * 0.004;
  g.strokeStyle = '#3a2a10';
  g.stroke();
  g.textAlign = 'center';
  g.fillStyle = '#1d1a12';
  g.font = `400 ${H * 0.046}px ${F.badge}`;
  g.fillText('SIROP', 0, -oval.ry * 0.5);
  const cs = fit(g, 'CITRON', (n) => `900 ${n}px ${F.citron}`, oval.rx * 1.55, H * 0.095);
  g.font = `900 ${cs}px ${F.citron}`;
  g.fillStyle = '#cf7d1d';
  g.fillText('CITRON', 0, -oval.ry * 0.02 + cs * 0.3);
  g.fillStyle = '#1d1a12';
  g.font = `400 ${H * 0.04}px ${F.badge}`;
  g.fillText('SANS', 0, oval.ry * 0.42);
  g.fillText('COLORANT', 0, oval.ry * 0.68);
  g.font = `400 ${H * 0.024}px ${F.badge}`;
  arcText(g, 'FABRIQUÉ EN PROVENCE', 0, 0, oval.ry * 0.86, Math.PI / 2, H * 0.002);
  g.restore();
  g.font = `500 ${H * 0.048}px ${F.serif}`;
  g.fillStyle = '#fff';
  g.textAlign = 'left';
  g.fillText(p.contenances[0]?.volume?.replace(' ', '') || '', W * 0.2, H * 0.965);
  printGrain(g, W, H, 3);
}

// ---------------------------------------------------------------- Fun Blue
function palm(g, x, y, s, flip = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s * flip, s);
  const trunk = g.createLinearGradient(-6, 0, 10, 0);
  trunk.addColorStop(0, '#5a3d22');
  trunk.addColorStop(1, '#8b6238');
  g.strokeStyle = trunk;
  g.lineWidth = 6;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(6, -40, 14, -80, 28, -118);
  g.stroke();
  for (let k = 0; k < 8; k++) {
    const a = -Math.PI * 0.98 + (k / 7) * Math.PI * 0.96;
    g.save();
    g.translate(28, -118);
    g.rotate(a);
    const lg = g.createLinearGradient(0, 0, 72, 0);
    lg.addColorStop(0, '#1f5a2a');
    lg.addColorStop(1, '#3f8f3c');
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(24, -16, 52, -12, 74, 8);
    g.bezierCurveTo(50, 0, 26, 2, 0, 4);
    g.fill();
    g.restore();
  }
  g.restore();
}

function sail(g, x, y, s, flip = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s * flip, s);
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.beginPath();
  g.ellipse(0, 0, 66, 7, -0.04, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(-4, -6);
  g.lineTo(16, -226);
  g.quadraticCurveTo(66, -118, 58, -10);
  g.closePath();
  g.save();
  g.clip();
  g.fillStyle = '#f7f9fb';
  g.fillRect(-20, -240, 120, 240);
  g.fillStyle = '#1f4ea0';
  for (let k = 0; k < 6; k++) g.fillRect(-20, -214 + k * 36, 120, 12);
  g.restore();
  g.fillStyle = '#16233d';
  g.beginPath();
  g.arc(-22, -94, 8, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#16233d';
  g.lineWidth = 6;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-22, -86);
  g.lineTo(-28, -46);
  g.lineTo(-16, -8);
  g.moveTo(-28, -46);
  g.lineTo(-38, -8);
  g.moveTo(-24, -72);
  g.lineTo(10, -82);
  g.stroke();
  g.restore();
}

function island(g, x, y, s = 1) {
  const sand = g.createLinearGradient(0, y - 10 * s, 0, y + 30 * s);
  sand.addColorStop(0, '#f1d896');
  sand.addColorStop(1, '#cfa95a');
  g.fillStyle = sand;
  g.beginPath();
  g.ellipse(x, y + 4 * s, 190 * s, 24 * s, 0, 0, Math.PI * 2);
  g.fill();
  const veg = g.createRadialGradient(x - 30 * s, y - 60 * s, 10 * s, x, y, 170 * s);
  veg.addColorStop(0, '#4f9a45');
  veg.addColorStop(1, '#245f2b');
  g.fillStyle = veg;
  g.beginPath();
  g.ellipse(x, y, 158 * s, 84 * s, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = 'rgba(20,70,30,0.55)';
  g.beginPath();
  g.ellipse(x + 44 * s, y, 104 * s, 56 * s, 0, Math.PI, 0);
  g.fill();
  palm(g, x - 70 * s, y - 30 * s, 0.9 * s);
  palm(g, x + 20 * s, y - 52 * s, 1.05 * s, -1);
  palm(g, x + 95 * s, y - 26 * s, 0.8 * s);
}

function frontFunBlue(g, p, W, H) {
  const horizon = H * 0.6;
  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#1b4596');
  sky.addColorStop(0.55, '#2f64a8');
  sky.addColorStop(1, '#79a5d6');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, horizon);
  // halo du soleil derrière l'île
  const sun = g.createRadialGradient(W * 0.5, horizon - H * 0.05, 0, W * 0.5, horizon - H * 0.05, H * 0.35);
  sun.addColorStop(0, 'rgba(255,240,205,0.55)');
  sun.addColorStop(1, 'rgba(255,240,205,0)');
  g.fillStyle = sun;
  g.fillRect(0, 0, W, horizon);
  const sea = g.createLinearGradient(0, horizon, 0, H);
  sea.addColorStop(0, '#22b3c6');
  sea.addColorStop(0.4, '#2a7f9e');
  sea.addColorStop(1, '#1b4596');
  g.fillStyle = sea;
  g.fillRect(0, horizon, W, H - horizon);
  // reflets de l'eau : traits fins et clairs, plus longs vers le bas
  const rand = rng(31);
  g.lineCap = 'round';
  for (let k = 0; k < 110; k++) {
    const t = rand();
    const y = horizon + 6 + t * t * (H - horizon - 10);
    const x = rand() * W;
    const l = 14 + (y - horizon) * 0.35 * rand();
    g.strokeStyle = `rgba(240,250,255,${0.25 + rand() * 0.45})`;
    g.lineWidth = 1 + ((y - horizon) / (H - horizon)) * 3.5;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + l / 2, y - 3, x + l, y);
    g.stroke();
  }
  island(g, W * 0.5, horizon, H / 1000);
  sail(g, W * 0.18, H * 0.9, 1.05 * (H / 1000));
  sail(g, W * 0.82, H * 0.86, 0.92 * (H / 1000), -1);
  g.textAlign = 'center';
  const size = H * 0.24;
  g.font = `italic 400 ${size}px ${F.fb}`;
  [
    ['Fun', W * 0.44, H * 0.27],
    ['Blue', W * 0.56, H * 0.48],
  ].forEach(([t, x, y]) => {
    g.fillStyle = 'rgba(14,38,92,0.55)';
    g.fillText(t, x + size * 0.03, y + size * 0.035);
    g.fillStyle = '#ffffff';
    g.fillText(t, x, y);
  });
  g.font = `600 ${H * 0.034}px ${F.sans}`;
  g.fillStyle = 'rgba(255,255,255,0.95)';
  spaced(g, 'SIROP DE MENTHE · GOÛT CHLOROPHYLLE', W * 0.5, H * 0.07, H * 0.004);
  g.font = `500 ${H * 0.048}px ${F.serif}`;
  g.textAlign = 'left';
  g.fillStyle = '#fff';
  g.fillText(p.contenances[0]?.volume?.replace(' ', '') || '', W * 0.08, H * 0.965);
  printGrain(g, W, H, 5);
}

// ---------------------------------------------------------------- Couleur Provence® (provisoire)
function frontProvence(g, p, W, H) {
  g.fillStyle = '#f5f0e4';
  g.fillRect(0, 0, W, H);
  const band = g.createLinearGradient(0, H * 0.3, 0, H * 0.78);
  band.addColorStop(0, p.color);
  band.addColorStop(1, p.deep);
  g.fillStyle = band;
  g.fillRect(0, H * 0.3, W, H * 0.48);
  g.fillStyle = '#1b1a14';
  g.fillRect(0, H * 0.296, W, H * 0.005);
  g.fillRect(0, H * 0.779, W, H * 0.005);
  g.textAlign = 'center';
  g.fillStyle = '#1b1a14';
  g.font = `700 ${H * 0.052}px ${F.sans}`;
  spaced(g, 'COULEUR PROVENCE®', W / 2, H * 0.13, H * 0.008);
  g.font = `500 ${H * 0.036}px ${F.sans}`;
  spaced(g, 'SIROP', W / 2, H * 0.21, H * 0.02);
  const [a, b] = p.lignes;
  const name = b ? `${a} ${b}` : a;
  const size = fit(g, name, (n) => `600 ${n}px ${F.serif}`, W * 0.8, H * 0.2);
  g.font = `600 ${size}px ${F.serif}`;
  g.fillStyle = '#fff';
  g.fillText(name, W / 2, H * 0.54 + size * 0.34);
  g.fillStyle = '#1b1a14';
  g.font = `600 ${H * 0.036}px ${F.sans}`;
  spaced(g, 'DISTILLERIE A. BLACHÈRE · DEPUIS 1835', W / 2, H * 0.87, H * 0.006);
  g.font = `500 ${H * 0.046}px ${F.serif}`;
  g.fillText(p.contenances[0]?.volume || '', W / 2, H * 0.95);
  printGrain(g, W, H, 7 + p.index);
}

// ---------------------------------------------------------------- Spiritueux (provisoire)
function paper(g, W, H, bg, seed) {
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  printGrain(g, W, H, seed, 0.06);
}

// foil : dessine aussi les zones dorées dans un masque (métal).
function frontMaison(g, p, W, H, foil) {
  paper(g, W, H, '#ece2c8', 11 + p.index);
  const brun = '#3a2a1d';
  const accent = p.bottle.cap;
  const both = (fn) => {
    fn(g, '#b8893a');
    if (foil) fn(foil, '#ffffff');
  };
  // filets dorés
  both((c, col) => {
    c.strokeStyle = col;
    c.lineWidth = H * 0.006;
    c.strokeRect(W * 0.05, H * 0.035, W * 0.9, H * 0.93);
    c.lineWidth = H * 0.0025;
    c.strokeRect(W * 0.075, H * 0.055, W * 0.85, H * 0.89);
  });
  g.fillStyle = accent;
  g.fillRect(W * 0.075, H * 0.6, W * 0.85, H * 0.1);
  g.textAlign = 'center';
  g.fillStyle = brun;
  g.font = `600 ${H * 0.038}px ${F.sans}`;
  spaced(g, 'DISTILLERIE', W / 2, H * 0.13, H * 0.018);
  both((c, col) => {
    c.textAlign = 'center';
    c.fillStyle = col;
    c.font = `400 ${H * 0.078}px ${F.affiche}`;
    spaced(c, 'A. BLACHÈRE', W / 2, H * 0.22, H * 0.006);
  });
  g.fillStyle = brun;
  g.font = `italic 500 ${H * 0.04}px ${F.serif}`;
  g.fillText('depuis 1835', W / 2, H * 0.29);
  const [a, b] = p.lignes;
  const sa = fit(g, a.toUpperCase(), (n) => `400 ${n}px ${F.affiche}`, W * 0.74, H * 0.11);
  g.font = `400 ${sa}px ${F.affiche}`;
  g.fillText(a.toUpperCase(), W / 2, H * 0.42);
  if (b) {
    const sb = fit(g, b.toUpperCase(), (n) => `400 ${n}px ${F.affiche}`, W * 0.74, H * 0.1);
    g.font = `400 ${sb}px ${F.affiche}`;
    g.fillText(b.toUpperCase(), W / 2, H * 0.53);
  }
  g.fillStyle = '#f6efe0';
  const type = p.type.toUpperCase();
  g.font = `600 ${fit(g, type, (n) => `600 ${n}px ${F.sans}`, W * 0.66, H * 0.04)}px ${F.sans}`;
  spaced(g, type, W / 2, H * 0.663, H * 0.004);
  g.fillStyle = brun;
  g.font = `600 ${H * 0.036}px ${F.sans}`;
  const bits = [p.contenances[0]?.volume, p.degre ? `${p.degre} % vol.` : null].filter(Boolean).join('  ·  ');
  if (bits) g.fillText(bits, W / 2, H * 0.79);
  g.font = `600 ${H * 0.028}px ${F.sans}`;
  spaced(g, 'CHÂTEAUNEUF-DU-PAPE', W / 2, H * 0.88, H * 0.012);
}

// ---------------------------------------------------------------- contre-étiquettes
function backLabel(g, p, W, H, { bg = '#fbf9f3', ink = '#1d1b16', accent = '#1d1b16' } = {}) {
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const pad = W * 0.09;
  const maxW = W - pad * 2;
  g.textAlign = 'left';
  g.fillStyle = ink;
  let y = H * 0.1;
  g.font = `700 ${H * 0.04}px ${F.sans}`;
  wrapText(g, p.nom, maxW).forEach((l) => {
    g.fillText(l, pad, y);
    y += H * 0.048;
  });
  g.fillStyle = accent;
  g.fillRect(pad, y - H * 0.02, maxW * 0.3, H * 0.006);
  g.fillStyle = ink;
  y += H * 0.03;
  g.font = `400 ${H * 0.028}px ${F.sans}`;
  const lines = [p.phrase && !p.phraseAlcool ? p.phrase : null, p.ingredients ? `Ingrédients : ${p.ingredients.replace(/^\(extrait\)\s*/, '')}` : null].filter(Boolean);
  lines.forEach((t) => {
    wrapText(g, t, maxW).forEach((l) => {
      g.fillText(l, pad, y);
      y += H * 0.037;
    });
    y += H * 0.015;
  });
  y = Math.max(y + H * 0.02, H * 0.58);
  g.font = `600 ${H * 0.027}px ${F.sans}`;
  ['Distillerie A. Blachère', '1695 route de Sorgues', '84230 Châteauneuf-du-Pape'].forEach((l) => {
    g.fillText(l, pad, y);
    y += H * 0.036;
  });
  if (p.alcool) {
    g.font = `500 ${H * 0.022}px ${F.sans}`;
    y += H * 0.01;
    wrapText(g, EVIN, maxW).forEach((l) => {
      g.fillText(l, pad, y);
      y += H * 0.03;
    });
  }
  barcode(g, pad, H * 0.82, maxW * 0.55, H * 0.12, 7 + p.index);
  if (p.contenances[0]?.volume) {
    g.font = `700 ${H * 0.05}px ${F.sans}`;
    g.textAlign = 'right';
    g.fillText(p.contenances[0].volume, W - pad, H * 0.93);
  }
  printGrain(g, W, H, 13 + p.index, 0.035);
}

// ---------------------------------------------------------------- API

function surface(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(64, Math.round(w));
  c.height = Math.max(64, Math.round(h));
  return c;
}

// Étiquette de face : { canvas, foil } (foil : masque des dorures, ou null).
export function drawFront(p, w, h) {
  const c = surface(w, h);
  const g = c.getContext('2d');
  let foil = null;
  if (p.label === 'pac') frontPac(g, p, c.width, c.height);
  else if (p.label === 'funblue') frontFunBlue(g, p, c.width, c.height);
  else if (p.label === 'maison') {
    foil = surface(w, h);
    const fg = foil.getContext('2d');
    fg.fillStyle = '#000';
    fg.fillRect(0, 0, foil.width, foil.height);
    frontMaison(g, p, c.width, c.height, fg);
  } else frontProvence(g, p, c.width, c.height);
  return { canvas: c, foil };
}

export function drawBack(p, w, h) {
  const c = surface(w, h);
  const g = c.getContext('2d');
  if (p.label === 'maison') backLabel(g, p, c.width, c.height, { bg: '#ece2c8', ink: '#3a2a1d', accent: '#b8893a' });
  else if (p.label === 'funblue') backLabel(g, p, c.width, c.height, { accent: '#1f4ea0' });
  else if (p.label === 'pac') backLabel(g, p, c.width, c.height, { accent: '#c2177f' });
  else backLabel(g, p, c.width, c.height, { accent: p.color });
  return c;
}

// Impression du bouchon PAC : « pac » et « le vrai » (deux fois, lisible de face comme de dos).
export function drawCapPrint(p) {
  if (p.label !== 'pac') return null;
  const c = surface(1024, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#f3d21f';
  g.fillRect(0, 0, 1024, 256);
  g.fillStyle = '#c2177f';
  g.textAlign = 'center';
  [256, 768].forEach((x) => {
    g.font = `italic 700 112px ${F.pac}`;
    g.fillText('pac', x - 14, 140);
    g.font = `italic 700 50px ${F.pac}`;
    g.fillText('le vrai', x + 36, 200);
  });
  printGrain(g, 1024, 256, 2, 0.04);
  return c;
}
