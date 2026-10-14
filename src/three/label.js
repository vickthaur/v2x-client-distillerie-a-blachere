// Étiquettes typographiques dessinées sur un canvas enroulé autour de la bouteille.
// Le cylindre de l'étiquette commence à thetaStart = PI/2 : la face avant est centrée à u = 0,75
// et la contre-étiquette (dos) à u = 0,25. Entre les deux, le canvas reste transparent : on voit le verre.
// Pas de logo de marque copié : nom du produit + « Distillerie A. Blachère · depuis 1835 ».
import { artCanvas } from '../lib/garnishArt.js';
import { EVIN } from '../data/products.js';

const DISPLAY = '"Archivo Variable", "Arial Black", sans-serif';
const SERIF = '"Instrument Serif", Georgia, serif';
const BODY = '"Inter Variable", system-ui, sans-serif';

export const LABEL_W = 2048;

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// Texte espacé (petites capitales façon étiquette), centré sur x.
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
  return total;
}

// Taille de police maximale pour que `text` tienne dans `maxW`.
function fit(g, text, font, maxW, maxSize) {
  g.font = font(maxSize);
  const w = g.measureText(text).width;
  return Math.min(maxSize, (maxSize * maxW) / w);
}

function wrap(g, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  words.forEach((w) => {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  });
  if (line) lines.push(line);
  return lines;
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

function diamond(g, x, y, r) {
  g.beginPath();
  g.moveTo(x, y - r);
  g.lineTo(x + r, y);
  g.lineTo(x, y + r);
  g.lineTo(x - r, y);
  g.closePath();
  g.fill();
}

// Papier vergé : léger grain et vignettage.
function paper(g, x, y, w, h, bg, seed) {
  const rand = rng(seed);
  g.fillStyle = bg;
  g.fillRect(x, y, w, h);
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = rand() < 0.5 ? `rgba(80,55,20,${rand() * 0.07})` : `rgba(255,255,255,${rand() * 0.12})`;
    g.fillRect(x + rand() * w, y + rand() * h, 1 + rand() * 2.5, 1 + rand() * 2.5);
  }
  for (let k = 0; k < h; k += 7) {
    g.fillStyle = 'rgba(90,60,20,0.025)';
    g.fillRect(x, y + k, w, 1);
  }
  const v = g.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.3, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(70,40,10,0.22)');
  g.fillStyle = v;
  g.fillRect(x, y, w, h);
  g.restore();
}

// ---------- Face avant, style « pop » (sirops) ----------
function frontPop(g, p, X, W, H) {
  const L = p.label;
  const x0 = X - W / 2;
  const s = Math.min(W, H * 0.95);
  g.save();
  roundRect(g, x0, 0, W, H, 18);
  g.clip();
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, L.bg);
  bg.addColorStop(1, L.bg2);
  g.fillStyle = bg;
  g.fillRect(x0, 0, W, H);

  // Grand dessin du fruit / de la feuille, en partie hors cadre
  const art = artCanvas(L.art);
  if (art) {
    const r = s * 0.62;
    g.globalAlpha = 0.95;
    g.drawImage(art, X + W * 0.08, H * 0.2, r, r);
    g.globalAlpha = 1;
  }
  // Rayons de soleil discrets derrière le nom
  g.save();
  g.translate(X - W * 0.12, H * 0.5);
  g.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 18; i++) {
    g.rotate((Math.PI * 2) / 18);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(s * 0.9, -s * 0.06);
    g.lineTo(s * 0.9, s * 0.06);
    g.closePath();
    g.fill();
  }
  g.restore();

  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  // Bandeau haut : la maison
  g.fillStyle = L.ink;
  g.font = `800 ${s * 0.046}px ${DISPLAY}`;
  spaced(g, 'DISTILLERIE A. BLACHÈRE', X, H * 0.11, s * 0.012);
  g.font = `600 ${s * 0.034}px ${DISPLAY}`;
  g.globalAlpha = 0.8;
  spaced(g, 'DEPUIS 1835', X, H * 0.17, s * 0.016);
  g.globalAlpha = 1;
  g.fillRect(X - s * 0.33, H * 0.155, s * 0.12, 3);
  g.fillRect(X + s * 0.21, H * 0.155, s * 0.12, 3);

  // Nom : premier mot géant, second mot en dessous
  const [a, b] = p.name.map((t) => t.toUpperCase());
  const sizeA = fit(g, a, (n) => `italic 900 ${n}px ${DISPLAY}`, W * 0.8, H * 0.3);
  g.font = `italic 900 ${sizeA}px ${DISPLAY}`;
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillText(a, X + 8, H * 0.56 + 10);
  g.fillStyle = L.ink;
  g.fillText(a, X, H * 0.56);
  const sizeB = fit(g, b, (n) => `italic 900 ${n}px ${DISPLAY}`, W * 0.74, H * 0.13);
  g.font = `italic 900 ${sizeB}px ${DISPLAY}`;
  g.fillStyle = L.accent;
  g.fillText(b, X, H * 0.56 + sizeB * 1.05);

  // Pastille « type de produit »
  g.font = `800 ${s * 0.04}px ${DISPLAY}`;
  const kind = p.kind.toUpperCase();
  const kw = g.measureText(kind).width + kind.length * s * 0.006 + s * 0.09;
  g.fillStyle = L.ink;
  roundRect(g, X - kw / 2, H * 0.775, kw, s * 0.08, s * 0.04);
  g.fill();
  g.fillStyle = L.bg;
  spaced(g, kind, X, H * 0.775 + s * 0.055, s * 0.006);

  // Pied : contenance et lieu
  g.fillStyle = L.ink;
  g.font = `700 ${s * 0.034}px ${DISPLAY}`;
  spaced(g, `CHÂTEAUNEUF-DU-PAPE${p.format ? `  ·  ${p.format.toUpperCase()}` : ''}`, X, H * 0.935, s * 0.008);
  g.restore();
}

// ---------- Face avant, style « maison » (spiritueux) ----------
function frontHeritage(g, p, X, W, H, seed) {
  const L = p.label;
  const x0 = X - W / 2;
  const s = Math.min(W, H * 0.9);
  paper(g, x0, 0, W, H, L.bg, seed);

  // Double filet et coins
  g.strokeStyle = L.ink;
  g.lineWidth = 4;
  const m = s * 0.035;
  g.strokeRect(x0 + m, m, W - m * 2, H - m * 2);
  g.lineWidth = 1.5;
  g.strokeRect(x0 + m * 1.45, m * 1.45, W - m * 2.9, H - m * 2.9);
  g.fillStyle = L.accent;
  [
    [x0 + m, m],
    [x0 + W - m, m],
    [x0 + m, H - m],
    [x0 + W - m, H - m],
  ].forEach(([x, y]) => diamond(g, x, y, s * 0.018));

  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = L.ink;
  g.font = `600 ${s * 0.036}px ${DISPLAY}`;
  spaced(g, 'DISTILLERIE', X, H * 0.13, s * 0.03);
  g.font = `800 ${s * 0.078}px ${DISPLAY}`;
  spaced(g, 'A. BLACHÈRE', X, H * 0.13 + s * 0.095, s * 0.012);

  // Filet « depuis 1835 »
  const yd = H * 0.13 + s * 0.16;
  g.font = `italic 400 ${s * 0.05}px ${SERIF}`;
  g.fillStyle = L.accent;
  g.fillText('depuis 1835', X, yd);
  g.fillRect(X - s * 0.36, yd - s * 0.016, s * 0.17, 2);
  g.fillRect(X + s * 0.19, yd - s * 0.016, s * 0.17, 2);

  // Nom du produit : premier mot en italique, second en capitales
  const [a, b] = p.name;
  const yName = H * 0.5;
  const sizeA = fit(g, a, (n) => `italic 400 ${n}px ${SERIF}`, W * 0.72, s * 0.17);
  g.font = `italic 400 ${sizeA}px ${SERIF}`;
  g.fillStyle = L.ink;
  g.fillText(a, X, yName);
  const B = b.toUpperCase();
  const sizeB = fit(g, B, (n) => `900 ${n}px ${DISPLAY}`, W * 0.78, s * 0.15);
  g.font = `900 ${sizeB}px ${DISPLAY}`;
  g.fillText(B, X, yName + sizeB * 1.02);

  // Type de produit
  let y = yName + sizeB * 1.02 + s * 0.085;
  g.fillStyle = L.accent;
  const kind = p.kind.toUpperCase();
  const sizeK = fit(g, kind, (n) => `700 ${n}px ${DISPLAY}`, W * 0.62, s * 0.042);
  g.font = `700 ${sizeK}px ${DISPLAY}`;
  spaced(g, kind, X, y, s * 0.01);

  // Sceau 1835
  y = Math.max(y + s * 0.16, H * 0.78);
  const r = s * 0.075;
  g.strokeStyle = L.ink;
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(X, y - r * 0.35, r, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 1;
  g.beginPath();
  g.arc(X, y - r * 0.35, r * 0.82, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = L.ink;
  g.font = `800 ${r * 0.52}px ${DISPLAY}`;
  g.fillText('1835', X, y - r * 0.35 + r * 0.18);

  // Pied
  g.font = `600 ${s * 0.03}px ${DISPLAY}`;
  g.fillStyle = L.ink;
  spaced(g, 'CHÂTEAUNEUF-DU-PAPE', X, H - m * 2.5, s * 0.012);
  if (p.format) {
    g.font = `700 ${s * 0.034}px ${DISPLAY}`;
    g.textAlign = 'right';
    g.fillText(p.format, x0 + W - m * 2.2, H - m * 2.5 - s * 0.06);
    g.textAlign = 'center';
  }
}

// ---------- Contre-étiquette ----------
function back(g, p, X, W, H, seed) {
  const L = p.label;
  const x0 = X - W / 2;
  const pop = L.style === 'pop';
  const s = Math.min(W * 1.35, H * 0.9);
  if (pop) {
    g.save();
    roundRect(g, x0, 0, W, H, 18);
    g.clip();
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, L.bg2);
    bg.addColorStop(1, L.bg);
    g.fillStyle = bg;
    g.fillRect(x0, 0, W, H);
    g.restore();
  } else {
    paper(g, x0, 0, W, H, L.bg, seed + 7);
    g.strokeStyle = L.ink;
    g.lineWidth = 2;
    g.strokeRect(x0 + 14, 14, W - 28, H - 28);
  }
  const pad = W * 0.1;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.fillStyle = L.ink;
  g.font = `800 ${s * 0.04}px ${DISPLAY}`;
  let y = H * 0.12 + s * 0.04;
  g.fillText('DISTILLERIE A. BLACHÈRE', x0 + pad, y);
  g.font = `italic 400 ${s * 0.05}px ${SERIF}`;
  y += s * 0.06;
  g.fillText('depuis 1835', x0 + pad, y);
  g.fillRect(x0 + pad, y + s * 0.03, W - pad * 2, 2);

  g.font = `500 ${s * 0.036}px ${BODY}`;
  y += s * 0.1;
  p.backLines.forEach((line) => {
    wrap(g, line, W - pad * 2).forEach((l) => {
      g.fillText(l, x0 + pad, y);
      y += s * 0.05;
    });
  });

  g.font = `600 ${s * 0.032}px ${BODY}`;
  y = Math.max(y + s * 0.04, H * 0.62);
  ['1695 route de Sorgues', '84230 Châteauneuf-du-Pape', 'France'].forEach((l) => {
    g.fillText(l, x0 + pad, y);
    y += s * 0.045;
  });

  if (p.alcool) {
    g.font = `600 ${s * 0.028}px ${BODY}`;
    y += s * 0.025;
    wrap(g, EVIN, W - pad * 2).forEach((l) => {
      g.fillText(l, x0 + pad, y);
      y += s * 0.038;
    });
  }
  if (p.format) {
    g.font = `800 ${s * 0.045}px ${DISPLAY}`;
    g.textAlign = 'right';
    g.fillText(p.format.split(' · ')[0], x0 + W - pad, H - s * 0.06);
  }
}

// Dessine l'étiquette complète. height = hauteur du canvas (proportionnelle à la géométrie).
export function drawLabel(product, height, index = 0) {
  const c = document.createElement('canvas');
  c.width = LABEL_W;
  c.height = height;
  const g = c.getContext('2d');
  const W = LABEL_W;
  const pop = product.label.style === 'pop';
  const frontW = W * (pop ? 0.42 : 0.37);
  const backW = W * 0.26;
  if (pop) frontPop(g, product, W * 0.75, frontW, height);
  else frontHeritage(g, product, W * 0.75, frontW, height, index * 31 + 3);
  back(g, product, W * 0.25, backW, height, index * 17 + 5);
  return c;
}
