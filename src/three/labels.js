// Étiquettes dessinées en code, enroulées autour des bouteilles 3D (canvas 2048 px de tour).
// La face avant est centrée à u = 0,75 (x = 1536), la contre-étiquette à u = 0,25 (x = 512).
// - pac      : reproduction de l'étiquette PAC Citron actuelle (fuchsia, rayures, femme à la paille,
//              « pac » en autocollant, ovale jaune). Approximation typographique : le logo et
//              l'étiquette réels sont à demander en vectoriel à la distillerie.
// - funblue  : d'après les étiquettes Fun Blue d'archives (île à palmiers, planches à voile).
// - provence : gabarit provisoire pour les sirops Couleur Provence® (étiquette réelle à fournir).
// - maison   : gabarit provisoire pour les spiritueux (esprit affiche, crème et brun).
// Aucun texte inventé : seulement le nom, la gamme, la contenance et les mentions connues.
import { drawFemme, drawStraw } from '../lib/femme.js';
import { EVIN } from '../data/products.js';

export const LABEL_W = 2048;
const FRONT = 1536;
const BACK = 512;

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
      [
        `italic 700 80px ${F.pac}`,
        `italic 400 80px ${F.fb}`,
        `400 40px ${F.badge}`,
        `900 40px ${F.citron}`,
        `400 40px ${F.affiche}`,
        `700 40px ${F.sans}`,
        `700 40px ${F.serif}`,
      ].map((f) => document.fonts.load(f).catch(() => null)),
    ),
    new Promise((r) => setTimeout(r, 3000)),
  ]);
  return fontsReady;
}

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function fit(g, text, font, maxW, maxSize) {
  g.font = font(maxSize);
  const w = g.measureText(text).width;
  return w > maxW ? (maxSize * maxW) / w : maxSize;
}

function spaced(g, text, x, y, spacing) {
  const chars = [...text];
  const widths = chars.map((ch) => g.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = x - total / 2;
  const align = g.textAlign;
  g.textAlign = 'left';
  chars.forEach((ch, i) => {
    g.fillText(ch, cx, y);
    cx += widths[i] + spacing;
  });
  g.textAlign = align;
}

// Texte posé sur un arc (« FABRIQUÉ EN PROVENCE » le long du bas de l'ovale).
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

// Rayures blanches qui montent d'environ 10° vers la droite.
function pinstripes(g, x, y, w, h, gap, width, color = 'rgba(255,255,255,0.9)') {
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

// Lettrage « autocollant » : filet encre, contour blanc épais, remplissage en dégradé or → jaune.
function sticker(g, text, x, y, size, { fill1 = '#d8962e', fill2 = '#ebd540', white = 0.075, ink = 0.02 } = {}) {
  g.font = `italic 700 ${size}px ${F.pac}`;
  g.lineJoin = 'round';
  g.textBaseline = 'alphabetic';
  g.strokeStyle = '#17170f';
  g.lineWidth = size * (white + ink) * 2;
  g.strokeText(text, x, y);
  g.strokeStyle = '#ffffff';
  g.lineWidth = size * white * 2;
  g.strokeText(text, x, y);
  const grad = g.createLinearGradient(0, y + size * 0.1, 0, y - size * 0.62);
  grad.addColorStop(0, fill1);
  grad.addColorStop(0.55, fill2);
  grad.addColorStop(1, '#f6e65a');
  g.fillStyle = grad;
  g.fillText(text, x, y);
  g.lineWidth = size * 0.012;
  g.strokeStyle = 'rgba(23,23,15,0.55)';
  g.strokeText(text, x, y);
}

function barcode(g, x, y, w, h, seed) {
  const rand = rng(seed);
  g.fillStyle = '#fff';
  g.fillRect(x, y, w, h);
  g.fillStyle = '#17170f';
  let cx = x + w * 0.12;
  while (cx < x + w * 0.88) {
    const bw = 1.5 + Math.floor(rand() * 3) * 1.6;
    if (rand() > 0.42) g.fillRect(cx, y + h * 0.08, bw, h * 0.78);
    cx += bw + 1.6;
  }
}

// ---------------------------------------------------------------- PAC Citron
function labelPac(g, p, W, H) {
  // Fond fuchsia et rayures sur tout le tour
  g.fillStyle = '#c2167f';
  g.fillRect(0, 0, W, H);
  pinstripes(g, 0, 0, W, H, H / 9.5, Math.max(2.5, H / 190));

  const fw = 900; // largeur de la face avant
  const x0 = FRONT - fw / 2;
  const s = H / 1000; // échelle de la femme (toute la hauteur de l'étiquette)
  const fx = x0 - 70; // le bord gauche coupe son visage
  const oval = { x: x0 + fw * 0.66, y: H * 0.79, rx: fw * 0.29, ry: H * 0.155 };

  // Mention du haut, dans l'axe des rayures
  g.save();
  g.translate(x0 + fw * 0.42, H * 0.085);
  g.rotate((-6 * Math.PI) / 180);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.font = `700 ${H * 0.042}px ${F.sans}`;
  g.fontStretch = 'condensed';
  spaced(g, 'CONSERVER ET CONSOMMER FRAIS', 0, 0, H * 0.002);
  g.restore();

  // « pac » en autocollant
  g.save();
  g.translate(x0 + fw * 0.64, H * 0.54);
  g.rotate((-4 * Math.PI) / 180);
  g.textAlign = 'center';
  const size = fit(g, 'pac', (n) => `italic 700 ${n}px ${F.pac}`, fw * 0.62, H * 0.6);
  sticker(g, 'pac', 0, 0, size);
  g.font = `600 ${H * 0.03}px ${F.sans}`;
  g.fillStyle = '#fff';
  g.fillText('®', size * 0.86, -size * 0.52);
  // Mention sous le logo (texte officiel de la fiche)
  g.font = `500 ${H * 0.022}px ${F.sans}`;
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.fillText('100 % naturel au jus de citron, sans colorant ni conservateur', 0, H * 0.075);
  g.restore();

  // La femme, coupée par le bord gauche, et sa paille qui mène à l'ovale
  drawFemme(g, fx, 0, s);
  drawStraw(g, fx, 0, s, oval.x - oval.rx * 0.82, oval.y + oval.ry * 0.05, 15);

  // Ovale jaune « SIROP CITRON SANS COLORANT FABRIQUÉ EN PROVENCE »
  g.save();
  g.translate(oval.x, oval.y);
  g.rotate((-5 * Math.PI) / 180);
  g.beginPath();
  g.ellipse(0, 0, oval.rx, oval.ry, 0, 0, Math.PI * 2);
  g.fillStyle = '#ebd540';
  g.fill();
  g.lineWidth = H * 0.006;
  g.strokeStyle = '#17170f';
  g.stroke();
  g.textAlign = 'center';
  g.fillStyle = '#17170f';
  g.font = `400 ${H * 0.05}px ${F.badge}`;
  g.fillText('SIROP', 0, -oval.ry * 0.5);
  const cs = fit(g, 'CITRON', (n) => `900 ${n}px ${F.citron}`, oval.rx * 1.55, H * 0.1);
  g.font = `900 ${cs}px ${F.citron}`;
  g.lineJoin = 'round';
  g.lineWidth = cs * 0.08;
  g.strokeStyle = '#6e3f12';
  g.strokeText('CITRON', 0, -oval.ry * 0.02 + cs * 0.3);
  g.fillStyle = '#d8962e';
  g.fillText('CITRON', 0, -oval.ry * 0.02 + cs * 0.3);
  g.fillStyle = '#17170f';
  g.font = `400 ${H * 0.042}px ${F.badge}`;
  g.fillText('SANS', 0, oval.ry * 0.42);
  g.fillText('COLORANT', 0, oval.ry * 0.68);
  g.font = `400 ${H * 0.026}px ${F.badge}`;
  arcText(g, 'FABRIQUÉ EN PROVENCE', 0, 0, oval.ry * 0.86, Math.PI / 2, H * 0.002);
  g.restore();

  // « 1L » en bas à gauche, code-barres sur le côté droit
  g.font = `600 ${H * 0.05}px ${F.serif}`;
  g.fillStyle = '#fff';
  g.textAlign = 'left';
  g.fillText(p.contenances[0]?.volume?.replace(' ', '') || '', x0 + fw * 0.06, H * 0.965);
  g.save();
  g.translate(x0 + fw + 30, H * 0.92);
  g.rotate(-Math.PI / 2);
  g.fillStyle = '#ebd540';
  g.fillRect(-H * 0.05, -6, H * 0.9, 92);
  barcode(g, H * 0.04, 6, H * 0.36, 70, 7);
  g.fillStyle = '#17170f';
  g.font = `500 ${H * 0.02}px ${F.sans}`;
  g.fillText('Distillerie A. Blachère · 84230 Châteauneuf-du-Pape', H * 0.42, 50);
  g.restore();

  // Contre-étiquette
  back(g, p, W, H, { bg: '#fff', ink: '#17170f', accent: '#c2167f' });
}

// ---------------------------------------------------------------- Fun Blue
export function palm(g, x, y, s, flip = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s * flip, s);
  g.strokeStyle = '#5b3a1e';
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(10, -60, 28, -118);
  g.stroke();
  g.fillStyle = '#2f7a35';
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI * 0.95 + (k / 6) * Math.PI * 0.9;
    g.save();
    g.translate(28, -118);
    g.rotate(a);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(34, -18, 70, 6);
    g.quadraticCurveTo(36, -4, 0, 4);
    g.fill();
    g.restore();
  }
  g.restore();
}

export function sail(g, x, y, s, flip = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s * flip, s);
  // planche
  g.fillStyle = '#f4f8fc';
  g.beginPath();
  g.ellipse(0, 0, 70, 9, -0.05, 0, Math.PI * 2);
  g.fill();
  // voile rayée blanc et bleu
  g.beginPath();
  g.moveTo(-6, -6);
  g.lineTo(18, -232);
  g.quadraticCurveTo(70, -120, 60, -10);
  g.closePath();
  g.fillStyle = '#f4f8fc';
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = '#1d459b';
  for (let k = 0; k < 6; k++) g.fillRect(-20, -220 + k * 36, 120, 13);
  g.restore();
  g.strokeStyle = 'rgba(23,23,15,0.35)';
  g.lineWidth = 2;
  g.stroke();
  // véliplanchiste stylisé
  g.fillStyle = '#17170f';
  g.beginPath();
  g.arc(-24, -96, 9, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.strokeStyle = '#17170f';
  g.beginPath();
  g.moveTo(-24, -86);
  g.lineTo(-30, -44);
  g.lineTo(-18, -6);
  g.moveTo(-30, -44);
  g.lineTo(-40, -6);
  g.moveTo(-26, -72);
  g.lineTo(10, -84);
  g.stroke();
  g.restore();
}

// Île ronde à palmiers posée sur l'horizon (étiquette Fun Blue et décor du héros).
export function island(g, x, y, s = 1) {
  g.fillStyle = '#e8c877';
  g.beginPath();
  g.ellipse(x, y + 4 * s, 190 * s, 26 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3f8a3c';
  g.beginPath();
  g.ellipse(x, y, 160 * s, 88 * s, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = '#2e6f2c';
  g.beginPath();
  g.ellipse(x + 40 * s, y, 110 * s, 60 * s, 0, Math.PI, 0);
  g.fill();
  palm(g, x - 70 * s, y - 30 * s, 0.9 * s);
  palm(g, x + 20 * s, y - 52 * s, 1.05 * s, -1);
  palm(g, x + 95 * s, y - 26 * s, 0.8 * s);
}

function labelFunBlue(g, p, W, H) {
  const horizon = H * 0.62;
  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#1d459b');
  sky.addColorStop(0.55, '#2f64a8');
  sky.addColorStop(1, '#6e9bd0');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, horizon);
  const sea = g.createLinearGradient(0, horizon, 0, H);
  sea.addColorStop(0, '#18afc4');
  sea.addColorStop(0.35, '#357691');
  sea.addColorStop(1, '#1d459b');
  g.fillStyle = sea;
  g.fillRect(0, horizon, W, H - horizon);
  // Écume et vagues
  const rand = rng(31);
  g.strokeStyle = 'rgba(244,248,252,0.75)';
  g.lineCap = 'round';
  for (let k = 0; k < 70; k++) {
    const y = horizon + 12 + rand() * (H - horizon - 20);
    const x = rand() * W;
    const l = 30 + rand() * 90 * ((y - horizon) / (H - horizon) + 0.3);
    g.lineWidth = 2 + ((y - horizon) / (H - horizon)) * 5;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + l / 2, y - 8, x + l, y);
    g.stroke();
  }
  // Île ronde à palmiers, au centre de la face
  island(g, FRONT, horizon, 1);
  // Planches à voile
  sail(g, FRONT - 330, H * 0.9, 1.25 * (H / 1000));
  sail(g, FRONT + 330, H * 0.86, 1.1 * (H / 1000), -1);

  // « Fun Blue » en script blanc, ombré de bleu
  g.textAlign = 'center';
  const size = H * 0.25;
  g.font = `italic 400 ${size}px ${F.fb}`;
  [
    ['Fun', FRONT - 60, H * 0.27],
    ['Blue', FRONT + 50, H * 0.49],
  ].forEach(([t, x, y]) => {
    g.fillStyle = '#9db9e8';
    g.fillText(t, x + size * 0.04, y + size * 0.04);
    g.fillStyle = '#ffffff';
    g.fillText(t, x, y);
  });
  g.font = `700 ${H * 0.04}px ${F.sans}`;
  g.fillStyle = '#fff';
  spaced(g, 'SIROP DE MENTHE · GOÛT CHLOROPHYLLE', FRONT, H * 0.075, H * 0.004);
  g.font = `600 ${H * 0.05}px ${F.serif}`;
  g.textAlign = 'left';
  g.fillText(p.contenances[0]?.volume?.replace(' ', '') || '', FRONT - 430, H * 0.965);
  back(g, p, W, H, { bg: '#f4f8fc', ink: '#1d459b', accent: '#18afc4' });
}

// ---------------------------------------------------------------- Couleur Provence® (provisoire)
function labelProvence(g, p, W, H) {
  g.fillStyle = '#f6f1e7';
  g.fillRect(0, 0, W, H);
  const fw = 760;
  const x0 = FRONT - fw / 2;
  // Bande de couleur du parfum, avec un léger dégradé
  const band = g.createLinearGradient(0, H * 0.3, 0, H * 0.78);
  band.addColorStop(0, p.color);
  band.addColorStop(1, p.deep);
  g.fillStyle = band;
  g.fillRect(0, H * 0.3, W, H * 0.48);
  pinstripes(g, 0, H * 0.3, W, H * 0.48, H / 11, Math.max(2, H / 260), 'rgba(255,255,255,0.18)');
  g.fillStyle = '#17170f';
  g.fillRect(0, H * 0.295, W, H * 0.008);
  g.fillRect(0, H * 0.777, W, H * 0.008);
  g.textAlign = 'center';
  g.fillStyle = '#17170f';
  g.font = `700 ${H * 0.06}px ${F.sans}`;
  spaced(g, 'COULEUR PROVENCE®', FRONT, H * 0.13, H * 0.008);
  g.font = `600 ${H * 0.04}px ${F.sans}`;
  spaced(g, 'SIROP', FRONT, H * 0.22, H * 0.02);
  const [a, b] = p.lignes;
  const name = b ? `${a} ${b}` : a;
  const size = fit(g, name, (n) => `700 ${n}px ${F.serif}`, fw * 0.92, H * 0.24);
  g.font = `700 ${size}px ${F.serif}`;
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillText(name, FRONT + size * 0.03, H * 0.54 + size * 0.36 + size * 0.03);
  g.fillStyle = '#fff';
  g.fillText(name, FRONT, H * 0.54 + size * 0.36);
  g.fillStyle = '#17170f';
  g.font = `700 ${H * 0.042}px ${F.sans}`;
  spaced(g, 'DISTILLERIE A. BLACHÈRE · DEPUIS 1835', FRONT, H * 0.87, H * 0.006);
  g.font = `600 ${H * 0.05}px ${F.serif}`;
  g.fillText(p.contenances[0]?.volume || '', FRONT, H * 0.95);
  back(g, p, W, H, { bg: '#f6f1e7', ink: '#17170f', accent: p.color });
}

// ---------------------------------------------------------------- Spiritueux (provisoire)
function paper(g, x, y, w, h, bg, seed) {
  const rand = rng(seed);
  g.fillStyle = bg;
  g.fillRect(x, y, w, h);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = rand() < 0.5 ? `rgba(80,55,20,${rand() * 0.06})` : `rgba(255,255,255,${rand() * 0.12})`;
    g.fillRect(x + rand() * w, y + rand() * h, 1 + rand() * 2.5, 1 + rand() * 2.5);
  }
}

function labelMaison(g, p, W, H) {
  paper(g, 0, 0, W, H, '#eadfc2', 11 + p.index);
  const fw = 720;
  const x0 = FRONT - fw / 2;
  const brun = '#3b2a1e';
  const accent = p.bottle.cap;
  // Cadre double et bandeau
  g.strokeStyle = brun;
  g.lineWidth = 6;
  g.strokeRect(x0 + 24, H * 0.04, fw - 48, H * 0.92);
  g.lineWidth = 2;
  g.strokeRect(x0 + 40, H * 0.04 + 16, fw - 80, H * 0.92 - 32);
  g.fillStyle = accent;
  g.fillRect(x0 + 40, H * 0.6, fw - 80, H * 0.11);
  g.textAlign = 'center';
  g.fillStyle = brun;
  g.font = `700 ${H * 0.045}px ${F.sans}`;
  spaced(g, 'DISTILLERIE', FRONT, H * 0.14, H * 0.02);
  g.font = `400 ${H * 0.085}px ${F.affiche}`;
  spaced(g, 'A. BLACHÈRE', FRONT, H * 0.23, H * 0.008);
  g.font = `italic 500 ${H * 0.045}px ${F.serif}`;
  g.fillText('depuis 1835', FRONT, H * 0.3);
  const [a, b] = p.lignes;
  const sa = fit(g, a.toUpperCase(), (n) => `400 ${n}px ${F.affiche}`, fw * 0.74, H * 0.12);
  g.font = `400 ${sa}px ${F.affiche}`;
  g.fillText(a.toUpperCase(), FRONT, H * 0.43);
  if (b) {
    const sb = fit(g, b.toUpperCase(), (n) => `400 ${n}px ${F.affiche}`, fw * 0.74, H * 0.11);
    g.font = `400 ${sb}px ${F.affiche}`;
    g.fillText(b.toUpperCase(), FRONT, H * 0.54);
  }
  g.fillStyle = '#fff';
  const type = p.type.toUpperCase();
  g.font = `700 ${fit(g, type, (n) => `700 ${n}px ${F.sans}`, fw * 0.62, H * 0.045)}px ${F.sans}`;
  spaced(g, type, FRONT, H * 0.67, H * 0.004);
  g.fillStyle = brun;
  g.font = `600 ${H * 0.04}px ${F.sans}`;
  const bits = [p.contenances[0]?.volume, p.degre ? `${p.degre} % vol.` : null].filter(Boolean).join('  ·  ');
  if (bits) g.fillText(bits, FRONT, H * 0.8);
  g.font = `600 ${H * 0.032}px ${F.sans}`;
  spaced(g, 'CHÂTEAUNEUF-DU-PAPE', FRONT, H * 0.89, H * 0.012);
  back(g, p, W, H, { bg: '#eadfc2', ink: brun, accent });
}

// ---------------------------------------------------------------- Contre-étiquette
function wrap(g, text, maxW) {
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

function back(g, p, W, H, { bg, ink, accent }) {
  const bw = 520;
  const x0 = BACK - bw / 2;
  g.save();
  roundRect(g, x0, H * 0.06, bw, H * 0.88, 18);
  g.fillStyle = bg;
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = accent;
  g.stroke();
  const pad = 36;
  g.textAlign = 'left';
  g.fillStyle = ink;
  g.font = `800 ${H * 0.034}px ${F.sans}`;
  let y = H * 0.15;
  g.fillText('DISTILLERIE A. BLACHÈRE', x0 + pad, y);
  g.font = `italic 500 ${H * 0.034}px ${F.serif}`;
  y += H * 0.05;
  g.fillText('depuis 1835', x0 + pad, y);
  g.fillStyle = accent;
  g.fillRect(x0 + pad, y + H * 0.025, bw - pad * 2, 3);
  g.fillStyle = ink;
  g.font = `700 ${H * 0.036}px ${F.sans}`;
  y += H * 0.09;
  wrap(g, p.nom, bw - pad * 2).forEach((l) => {
    g.fillText(l, x0 + pad, y);
    y += H * 0.045;
  });
  g.font = `500 ${H * 0.028}px ${F.sans}`;
  const lines = [p.phrase && !p.phraseAlcool ? p.phrase : null, p.ingredients ? `Ingrédients : ${p.ingredients}` : null].filter(Boolean);
  lines.forEach((t) =>
    wrap(g, t, bw - pad * 2).forEach((l) => {
      g.fillText(l, x0 + pad, y);
      y += H * 0.038;
    }),
  );
  y = Math.max(y + H * 0.03, H * 0.66);
  g.font = `600 ${H * 0.026}px ${F.sans}`;
  ['1695 route de Sorgues', '84230 Châteauneuf-du-Pape', 'France'].forEach((l) => {
    g.fillText(l, x0 + pad, y);
    y += H * 0.036;
  });
  if (p.alcool) {
    g.font = `600 ${H * 0.022}px ${F.sans}`;
    y += H * 0.01;
    wrap(g, EVIN, bw - pad * 2).forEach((l) => {
      g.fillText(l, x0 + pad, y);
      y += H * 0.03;
    });
  }
  if (p.contenances[0]?.volume) {
    g.font = `800 ${H * 0.045}px ${F.sans}`;
    g.textAlign = 'right';
    g.fillText(p.contenances[0].volume, x0 + bw - pad, H * 0.9);
  }
  g.restore();
}

// Dessine l'étiquette complète. height : hauteur du canvas, proportionnelle à la géométrie.
export function drawLabel(p, height) {
  const c = document.createElement('canvas');
  c.width = LABEL_W;
  c.height = Math.max(64, Math.round(height));
  const g = c.getContext('2d');
  const W = LABEL_W;
  const H = c.height;
  if (p.label === 'pac') labelPac(g, p, W, H);
  else if (p.label === 'funblue') labelFunBlue(g, p, W, H);
  else if (p.label === 'maison') labelMaison(g, p, W, H);
  else labelProvence(g, p, W, H);
  return c;
}

// Capsule « pac … le vrai » (bouchon jaune du PAC Citron).
export function drawCapLabel(p) {
  if (p.label !== 'pac') return null;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f2d22e';
  g.fillRect(0, 0, 1024, 256);
  g.fillStyle = '#c2167f';
  g.textAlign = 'center';
  // Répété deux fois autour du bouchon pour être lisible de face comme de dos.
  [256, 768].forEach((x) => {
    g.font = `italic 700 120px ${F.pac}`;
    g.fillText('pac', x - 20, 150);
    g.font = `italic 700 54px ${F.pac}`;
    g.fillText('le vrai', x + 40, 210);
    g.font = `700 40px ${F.sans}`;
    g.fillText('• • •', x - 90, 206);
  });
  return c;
}
