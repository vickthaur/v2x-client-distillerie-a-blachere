// Illustrations dessinées en canvas (fond transparent, 512 px) : textures des éléments 3D qui
// flottent autour des bouteilles et dessins des étiquettes de sirop.
// Tranche de citron et feuille de menthe reprises de Fruitzz ; feuilles d'armoise, d'origan et de vigne ajoutées.
const S = 512;
const C = S / 2;

function canvas() {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  return c;
}

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount));
  return `rgb(${ch.join(',')})`;
}

// Tranche d'agrume : zeste, ziste blanc, quartiers juteux.
function citrus({ rind, flesh, fleshCenter, segments = 10, seed = 1 }) {
  const c = canvas();
  const g = c.getContext('2d');
  const rand = rng(seed);
  const R = C - 6;
  const zest = g.createRadialGradient(C, C, R * 0.85, C, C, R);
  zest.addColorStop(0, rind);
  zest.addColorStop(1, shade(rind, -0.18));
  g.fillStyle = zest;
  g.beginPath();
  g.arc(C, C, R, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff8dc';
  g.beginPath();
  g.arc(C, C, R * 0.9, 0, Math.PI * 2);
  g.fill();
  const inner = R * 0.84;
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2 + 0.035;
    const a1 = ((i + 1) / segments) * Math.PI * 2 - 0.035;
    const grad = g.createRadialGradient(C, C, inner * 0.08, C, C, inner);
    grad.addColorStop(0, fleshCenter);
    grad.addColorStop(1, flesh);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(C + Math.cos((a0 + a1) / 2) * inner * 0.1, C + Math.sin((a0 + a1) / 2) * inner * 0.1);
    g.arc(C, C, inner, a0, a1);
    g.closePath();
    g.fill();
    for (let k = 0; k < 26; k++) {
      const a = a0 + (a1 - a0) * (0.15 + rand() * 0.7);
      const r = inner * (0.2 + rand() * 0.75);
      g.save();
      g.translate(C + Math.cos(a) * r, C + Math.sin(a) * r);
      g.rotate(a);
      g.fillStyle = `rgba(255,255,255,${0.15 + rand() * 0.25})`;
      g.beginPath();
      g.ellipse(0, 0, 9 + rand() * 9, 2.5 + rand() * 2, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
  g.fillStyle = '#fffbe6';
  g.beginPath();
  g.arc(C, C, inner * 0.09, 0, Math.PI * 2);
  g.fill();
  gloss(g, R);
  return c;
}

// Feuille de menthe.
function mint() {
  const c = canvas();
  const g = c.getContext('2d');
  g.save();
  g.translate(C, C);
  g.rotate(-0.6);
  const leaf = () => {
    g.beginPath();
    g.moveTo(0, -230);
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      g.lineTo(Math.sin(Math.PI * Math.pow(t, 0.8)) * 140 + (i % 2 ? 8 : 0), -230 + t * 440);
    }
    for (let i = 20; i >= 0; i--) {
      const t = i / 20;
      g.lineTo(-(Math.sin(Math.PI * Math.pow(t, 0.8)) * 140 + (i % 2 ? 8 : 0)), -230 + t * 440);
    }
    g.closePath();
  };
  const fill = g.createLinearGradient(-140, -230, 140, 210);
  fill.addColorStop(0, '#5fe07a');
  fill.addColorStop(1, '#1f9a45');
  g.fillStyle = fill;
  leaf();
  g.fill();
  veins(g, 'rgba(220,255,225,0.6)', 220, 110);
  g.fillStyle = '#17803a';
  g.fillRect(-5, 205, 10, 50);
  g.restore();
  gloss(g, 180);
  return c;
}

function veins(g, color, len, spread) {
  g.strokeStyle = color;
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(0, -len);
  g.lineTo(0, len + 20);
  g.stroke();
  g.lineWidth = 3;
  for (let i = 0; i < 7; i++) {
    const y = -len * 0.77 + i * len * 0.25;
    [-1, 1].forEach((s) => {
      g.beginPath();
      g.moveTo(0, y);
      g.quadraticCurveTo(s * spread * 0.55, y - 10, s * spread, y - 50);
      g.stroke();
    });
  }
}

// Feuille d'armoise (absinthe-plante) : découpée en lobes arrondis, vert argenté.
function armoise() {
  const c = canvas();
  const g = c.getContext('2d');
  g.save();
  g.translate(C, C + 10);
  g.rotate(-0.5);
  const fill = g.createLinearGradient(-160, -230, 160, 230);
  fill.addColorStop(0, '#c9d6c2');
  fill.addColorStop(0.5, '#93a88c');
  fill.addColorStop(1, '#6f8a6a');
  g.fillStyle = fill;
  const lobe = (x, y, rx, ry, a) => {
    g.beginPath();
    g.ellipse(x, y, rx, ry, a, 0, Math.PI * 2);
    g.fill();
  };
  // Tige centrale et lobes latéraux, eux-mêmes découpés
  g.fillRect(-7, -220, 14, 440);
  const arms = [
    [-150, -0.9, 120],
    [-70, -0.75, 150],
    [20, -0.6, 160],
    [110, -0.45, 130],
  ];
  arms.forEach(([y, a, len]) => {
    [-1, 1].forEach((s) => {
      g.save();
      g.translate(0, y);
      g.rotate(s * (Math.PI / 2 + a));
      g.fillRect(-6, -len, 12, len);
      lobe(0, -len, 26, 40, 0);
      lobe(-24, -len * 0.62, 20, 32, -0.5);
      lobe(24, -len * 0.62, 20, 32, 0.5);
      g.restore();
    });
  });
  lobe(0, -225, 30, 46, 0);
  g.strokeStyle = 'rgba(240,248,236,0.55)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, -215);
  g.lineTo(0, 220);
  g.stroke();
  g.restore();
  gloss(g, 200);
  return c;
}

// Petite feuille d'origan, ovale.
function origan() {
  const c = canvas();
  const g = c.getContext('2d');
  g.save();
  g.translate(C, C);
  g.rotate(0.4);
  const fill = g.createRadialGradient(-40, -60, 20, 0, 0, 230);
  fill.addColorStop(0, '#8fc25a');
  fill.addColorStop(1, '#3f7a2a');
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(0, 0, 150, 215, 0, 0, Math.PI * 2);
  g.fill();
  veins(g, 'rgba(225,245,200,0.5)', 190, 100);
  g.restore();
  gloss(g, 200);
  return c;
}

// Feuille de vigne : cinq lobes dentelés.
function vineLeaf() {
  const c = canvas();
  const g = c.getContext('2d');
  const rand = rng(21);
  g.save();
  g.translate(C, C + 30);
  const pts = [];
  const lobes = [-2, -1, 0, 1, 2];
  const N = 220;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = -Math.PI / 2 + (t - 0.5) * Math.PI * 1.75;
    // Cinq lobes : le rayon gonfle au milieu de chaque lobe et se creuse entre deux.
    let r = 120;
    lobes.forEach((k) => {
      const ca = -Math.PI / 2 + k * 0.62;
      r += 115 * Math.exp(-Math.pow((a - ca) / 0.2, 2)) * (k === 0 ? 1.05 : Math.abs(k) === 1 ? 0.95 : 0.7);
    });
    r += (i % 4 < 2 ? 7 : -4) + rand() * 3; // dents
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const fill = g.createLinearGradient(-200, -230, 200, 120);
  fill.addColorStop(0, '#7fbf4d');
  fill.addColorStop(1, '#2f6b22');
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(0, 30);
  pts.forEach(([x, y]) => g.lineTo(x, y));
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(220,245,190,0.55)';
  g.lineWidth = 4;
  lobes.forEach((k) => {
    const a = -Math.PI / 2 + k * 0.62;
    g.beginPath();
    g.moveTo(0, 20);
    g.lineTo(Math.cos(a) * 210, Math.sin(a) * 210);
    g.stroke();
  });
  g.fillStyle = '#4a6b2a';
  g.fillRect(-5, 20, 10, 90);
  g.restore();
  gloss(g, 220);
  return c;
}

// Reflet humide commun.
function gloss(g, r) {
  const sheen = g.createRadialGradient(C - r * 0.35, C - r * 0.4, 0, C - r * 0.35, C - r * 0.4, r * 0.7);
  sheen.addColorStop(0, 'rgba(255,255,255,0.32)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = sheen;
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'source-over';
}

const ART = {
  lemon: () => citrus({ rind: '#f5d90a', flesh: '#ffe04a', fleshCenter: '#fffbd0', segments: 10, seed: 4 }),
  mint,
  armoise,
  origan,
  vineLeaf,
};

const cache = new Map();
export function artCanvas(name) {
  if (!ART[name]) return null;
  if (!cache.has(name)) cache.set(name, ART[name]());
  return cache.get(name);
}
