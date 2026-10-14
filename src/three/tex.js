// Textures procédurales (aucune image téléchargée) : bruit, cartes de relief (normal maps) calculées
// depuis une hauteur, rugosité. Tout est généré une fois puis partagé entre les objets.
import * as THREE from 'three';

export function rng(seed = 1) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Bruit de valeur 2D périodique (raccord parfait sur les bords), lissé (quintique).
export function valueNoise(seed = 1, period = 8) {
  const r = rng(seed);
  const grid = new Float32Array(period * period).map(() => r());
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const tx = fade(x - xi);
    const ty = fade(y - yi);
    const g = (i, j) => grid[(((j % period) + period) % period) * period + (((i % period) + period) % period)];
    const a = g(xi, yi);
    const b = g(xi + 1, yi);
    const c = g(xi, yi + 1);
    const d = g(xi + 1, yi + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}

// Somme d'octaves (fbm) d'un bruit périodique : u, v ∈ [0, 1].
export function fbm(seed, base = 4, octaves = 4) {
  const layers = Array.from({ length: octaves }, (_, k) => ({ n: valueNoise(seed + k * 101, base << k), f: base << k, a: 0.5 ** k }));
  const norm = layers.reduce((s, l) => s + l.a, 0);
  return (u, v) => layers.reduce((s, l) => s + l.n(u * l.f, v * l.f) * l.a, 0) / norm;
}

// Hauteur (Float32Array w×h, 0…1) → normal map (espace tangent, convention OpenGL : +Y vers le haut).
export function normalFromHeight(height, w, h, strength = 2, wrap = true) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const at = (x, y) => {
    if (wrap) {
      x = (x + w) % w;
      y = (y + h) % h;
    } else {
      x = Math.min(w - 1, Math.max(0, x));
      y = Math.min(h - 1, Math.max(0, y));
    }
    return height[y * w + x];
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      // ligne de l'image vers le bas = v vers le bas : la pente en v change de signe
      let nx = -dx;
      let ny = dy;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      const o = (y * w + x) * 4;
      img.data[o] = (nx * 0.5 + 0.5) * 255;
      img.data[o + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[o + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[o + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return c;
}

// Canvas → hauteur (canal rouge, 0…1).
export function heightFromCanvas(c) {
  const g = c.getContext('2d');
  const { data } = g.getImageData(0, 0, c.width, c.height);
  const out = new Float32Array(c.width * c.height);
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4] / 255;
  return out;
}

// Flou de boîte séparable (rayon r, périodique) sur une hauteur.
export function blurHeight(src, w, h, r = 1, wrap = true) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const n = 2 * r + 1;
  const ix = (x) => (wrap ? (x + w) % w : Math.min(w - 1, Math.max(0, x)));
  const iy = (y) => (wrap ? (y + h) % h : Math.min(h - 1, Math.max(0, y)));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += src[y * w + ix(x + k)];
      tmp[y * w + x] = s / n;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[iy(y + k) * w + x];
      out[y * w + x] = s / n;
    }
  return out;
}

export function dataTexture(c, { srgb = false, repeat = null, anisotropy = 4, wrap = THREE.RepeatWrapping } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = wrap;
  t.anisotropy = anisotropy;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.userData.shared = true;
  return t;
}

const cache = new Map();
export const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

// ------------------------------------------------------------------ textures partagées

// Papier (fibres) : relief très fin, raccordable. Sert aux étiquettes papier et aux contre-étiquettes.
export function paperTextures() {
  return once('paper', () => {
    const S = 512;
    const n = fbm(7, 16, 4);
    const fib = rng(9);
    const hgt = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) hgt[y * S + x] = n(x / S, y / S) * 0.6;
    // fibres : petits traits clairs et sombres
    for (let k = 0; k < 2600; k++) {
      const x0 = fib() * S;
      const y0 = fib() * S;
      const a = fib() * Math.PI;
      const len = 3 + fib() * 12;
      const v = (fib() - 0.5) * 0.5;
      for (let t = 0; t < len; t++) {
        const x = Math.round(x0 + Math.cos(a) * t + S) % S;
        const y = Math.round(y0 + Math.sin(a) * t + S) % S;
        hgt[y * S + x] += v;
      }
    }
    const rough = canvas(S);
    const g = rough.getContext('2d');
    const img = g.createImageData(S, S);
    for (let i = 0; i < S * S; i++) {
      const v = 200 + (hgt[i] - 0.3) * 90;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = Math.max(0, Math.min(255, v));
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return {
      normal: dataTexture(normalFromHeight(blurHeight(hgt, S, S, 1), S, S, 3)),
      roughness: dataTexture(rough),
    };
  });
}

// Film plastique d'une étiquette pelliculée : ondulations très douces (plis du film, collage).
export function filmNormal() {
  return once('film', () => {
    const W = 512;
    const H = 256;
    const n = fbm(21, 3, 3);
    const hgt = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) hgt[y * W + x] = n(x / W, y / H);
    return dataTexture(normalFromHeight(hgt, W, H, 1.2));
  });
}

// Légères irrégularités du verre (ondulations de moulage) : rugosité et relief à peine visibles.
export function glassTextures() {
  return once('glass', () => {
    const W = 256;
    const H = 512;
    const n = fbm(33, 2, 4);
    const hgt = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) hgt[y * W + x] = n(x / W, y / H);
    const rough = canvas(W, H);
    const g = rough.getContext('2d');
    const img = g.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      // rugosité 0,02…0,09 (canal vert pour three.js)
      const v = Math.round((0.35 + hgt[i] * 0.65) * 255);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return { normal: dataTexture(normalFromHeight(hgt, W, H, 0.6)), roughness: dataTexture(rough) };
  });
}

// Moletage d'un bouchon à vis : stries verticales fines.
export function knurlNormal(count = 90) {
  return once(`knurl:${count}`, () => {
    const W = 1024;
    const H = 8;
    const hgt = new Float32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const t = ((x / W) * count) % 1;
        hgt[y * W + x] = Math.pow(Math.sin(Math.PI * t), 0.6);
      }
    return dataTexture(normalFromHeight(hgt, W, H, 3.5));
  });
}

// Métal brossé ou laqué (capsules) : fines rayures horizontales.
export function brushedNormal() {
  return once('brushed', () => {
    const W = 256;
    const H = 256;
    const r = rng(5);
    const hgt = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      const v = r();
      for (let x = 0; x < W; x++) hgt[y * W + x] = v * 0.6 + r() * 0.1;
    }
    return dataTexture(normalFromHeight(blurHeight(hgt, W, H, 1), W, H, 0.8));
  });
}
