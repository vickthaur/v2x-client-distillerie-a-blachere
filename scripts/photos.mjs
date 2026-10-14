#!/usr/bin/env node
// Photos → bouteilles 3D. Lancé automatiquement avant chaque build (npm « prebuild ») et à la main
// avec « npm run photos ». Voir photos/LISEZMOI.md pour les noms de fichiers attendus.
//
// Pour chaque photo photos/produits/<slug>.jpg|png|webp (bouteille debout, de face, fond uni clair
// ou PNG transparent) et, si elle existe, photos/produits/<slug>-dos.* (contre-étiquette) :
//   1. fond retiré : remplissage depuis les bords de l'image, avec tolérance (les blancs intérieurs,
//      comme une étiquette blanche, sont gardés) ; la transparence d'un PNG détouré est conservée ;
//   2. bouteille redressée si la photo penche un peu, puis recadrée ;
//   3. silhouette mesurée ligne par ligne (demi-largeur autour de l'axe central), lissée, normalisée ;
//   4. écrit dans public/bouteilles/<slug>/ : face.webp (texture RGBA, 1024 px de haut),
//      dos.webp (si photo de dos), profil.json (silhouette), vignette.webp (cartes de la boutique).
// Les photos de lieux photos/lieux/<nom>.jpg sont redimensionnées dans public/lieux/.
// Les deux dossiers produits sont régénérés à chaque build (ils ne sont pas versionnés).
//
// Options : --entree <dossier> (défaut photos) --sortie <dossier> (défaut public) --force --strict
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = 3; // à incrémenter quand le traitement change (invalide le cache)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);
const IN = resolve(root, opt('entree', 'photos'));
const OUT = resolve(root, opt('sortie', 'public'));
const STRICT = flag('strict');
const FORCE = flag('force');
const CACHE_FILE = resolve(root, '.cache/photos.json');

const TEX_H = 1024; // hauteur de la texture 3D
const THUMB_H = 480; // hauteur de la vignette
const WORK = 2000; // côté maximal de l'image de travail
const EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const log = (...a) => console.log('[photos]', ...a);
const warn = (...a) => console.warn('[photos] ⚠', ...a);

const outBottles = join(OUT, 'bouteilles');
const outPlaces = join(OUT, 'lieux');

function writeJSON(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 1)}\n`);
}

function listImages(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => EXT.has(extname(f).toLowerCase()) && !f.startsWith('.'))
    .map((f) => join(dir, f));
}

function knownSlugs() {
  try {
    const cat = JSON.parse(readFileSync(resolve(root, 'src/data/catalogue.json'), 'utf8'));
    return new Set(cat.produits.map((p) => p.slug));
  } catch {
    return null;
  }
}

function closest(name, slugs) {
  const d = (a, b) => {
    const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return m[a.length][b.length];
  };
  return [...slugs].sort((a, b) => d(name, a) - d(name, b))[0];
}

// ---------------------------------------------------------------------------------------------
// Détourage

// Distance de couleur pondérée (« redmean »), 0…~765.
function dist(r1, g1, b1, r2, g2, b2) {
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

const median = (arr) => {
  const s = Float64Array.from(arr).sort();
  return s.length ? s[s.length >> 1] : 0;
};

// Couleur de fond estimée sur la bande extérieure de l'image (médiane), et sa dispersion.
function borderStats(data, w, h) {
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.015));
  const R = [];
  const G = [];
  const B = [];
  const A = [];
  const push = (x, y) => {
    const i = (y * w + x) * 4;
    R.push(data[i]);
    G.push(data[i + 1]);
    B.push(data[i + 2]);
    A.push(data[i + 3]);
  };
  for (let y = 0; y < h; y += 2) for (let k = 0; k < band; k++) (push(k, y), push(w - 1 - k, y));
  for (let x = 0; x < w; x += 2) for (let k = 0; k < band; k++) (push(x, k), push(x, h - 1 - k));
  const bg = [median(R), median(G), median(B)];
  const dev = median(R.map((r, i) => dist(r, G[i], B[i], bg[0], bg[1], bg[2])));
  const transparent = A.filter((a) => a < 16).length / A.length;
  return { bg, dev, transparent };
}

// Remplissage depuis les bords : tout pixel proche de la couleur du fond ET relié au bord est du fond.
// Le critère local (écart avec le voisin déjà rempli) empêche de traverser un contour doux.
function floodBackground(data, w, h, bg, tol) {
  const n = w * h;
  const isBg = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const lumBg = bg[0] * 0.299 + bg[1] * 0.587 + bg[2] * 0.114;
  // Ombre portée : pixel neutre (peu saturé), plus sombre que le fond mais pas noir. On ne la
  // traverse que par petits pas (critère local ci-dessous) : le bord net de la bouteille l'arrête.
  const shadow = (i) => {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const l = r * 0.299 + g * 0.587 + b * 0.114;
    return Math.max(r, g, b) - Math.min(r, g, b) < 16 && l < lumBg && l > lumBg * 0.45;
  };
  const near = (p) => {
    const i = p * 4;
    return data[i + 3] < 16 || dist(data[i], data[i + 1], data[i + 2], bg[0], bg[1], bg[2]) < tol;
  };
  const seed = (x, y) => {
    const p = y * w + x;
    if (!isBg[p] && near(p)) {
      isBg[p] = 1;
      queue[tail++] = p;
    }
  };
  for (let x = 0; x < w; x++) (seed(x, 0), seed(x, h - 1));
  for (let y = 0; y < h; y++) (seed(0, y), seed(w - 1, y));
  const localTol = tol * 0.55;
  const shadowStep = 9; // écart maximal entre deux pixels voisins d'une ombre (dégradé doux)
  while (head < tail) {
    const p = queue[head++];
    const x = p % w;
    const y = (p - x) / w;
    const i = p * 4;
    const visit = (q) => {
      if (isBg[q]) return;
      const j = q * 4;
      if (data[j + 3] >= 16) {
        const step = dist(data[j], data[j + 1], data[j + 2], data[i], data[i + 1], data[i + 2]);
        const isNear = dist(data[j], data[j + 1], data[j + 2], bg[0], bg[1], bg[2]) < tol;
        if (isNear ? step >= localTol : !(shadow(j) && step < shadowStep)) return;
      }
      isBg[q] = 1;
      queue[tail++] = q;
    };
    if (x > 0) visit(p - 1);
    if (x < w - 1) visit(p + 1);
    if (y > 0) visit(p - w);
    if (y < h - 1) visit(p + w);
  }
  return isBg;
}

// Zones d'objet : la plus grande, plus toutes celles qui sont dans son axe (une étiquette blanche
// sur fond blanc peut couper la bouteille en morceaux : on garde les morceaux). Les poussières et
// reflets isolés, hors de l'axe ou minuscules, sont supprimés.
function bottleComponents(mask, w, h) {
  const n = w * h;
  const label = new Int32Array(n);
  const queue = new Int32Array(n);
  const comps = [];
  let id = 0;
  for (let s = 0; s < n; s++) {
    if (!mask[s] || label[s]) continue;
    id++;
    let head = 0;
    let tail = 0;
    let x0 = w;
    let x1 = 0;
    queue[tail++] = s;
    label[s] = id;
    while (head < tail) {
      const p = queue[head++];
      const x = p % w;
      const y = (p - x) / w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (x > 0 && mask[p - 1] && !label[p - 1]) ((label[p - 1] = id), (queue[tail++] = p - 1));
      if (x < w - 1 && mask[p + 1] && !label[p + 1]) ((label[p + 1] = id), (queue[tail++] = p + 1));
      if (y > 0 && mask[p - w] && !label[p - w]) ((label[p - w] = id), (queue[tail++] = p - w));
      if (y < h - 1 && mask[p + w] && !label[p + w]) ((label[p + w] = id), (queue[tail++] = p + w));
    }
    comps.push({ id, size: tail, x0, x1 });
  }
  if (!comps.length) return { mask: new Uint8Array(n), size: 0 };
  const main = comps.reduce((a, b) => (b.size > a.size ? b : a));
  const span = main.x1 - main.x0;
  const c0 = main.x0 + span * 0.25;
  const c1 = main.x1 - span * 0.25;
  const keep = new Set(comps.filter((c) => c === main || (c.size > main.size * 0.0015 && c.x1 >= c0 && c.x0 <= c1)).map((c) => c.id));
  const out = new Uint8Array(n);
  let size = 0;
  for (let p = 0; p < n; p++)
    if (keep.has(label[p])) {
      out[p] = 1;
      size++;
    }
  return { mask: out, size };
}

// Masque de l'objet : alpha existant (PNG détouré) ou fond retiré par remplissage.
function objectMask(data, w, h, tolerance) {
  const stats = borderStats(data, w, h);
  let mask;
  let mode;
  if (stats.transparent > 0.5) {
    mode = 'transparence d’origine';
    mask = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) mask[p] = data[p * 4 + 3] >= 128 ? 1 : 0;
  } else {
    mode = 'fond retiré';
    const lightness = (stats.bg[0] * 0.299 + stats.bg[1] * 0.587 + stats.bg[2] * 0.114) / 255;
    if (lightness < 0.6 || stats.dev > 40) warn(`le fond ne semble pas uni et clair (luminosité ${lightness.toFixed(2)}, écart ${stats.dev.toFixed(0)}) : détourage approximatif.`);
    const tol = tolerance ?? Math.max(30, Math.min(70, stats.dev * 2.5 + 28));
    const isBg = floodBackground(data, w, h, stats.bg, tol);
    mask = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) mask[p] = isBg[p] ? 0 : 1;
  }
  const { mask: clean, size } = bottleComponents(mask, w, h);
  return { mask: clean, size, mode, bg: stats.bg };
}

// ---------------------------------------------------------------------------------------------
// Silhouette

// Bords gauche/droit de chaque ligne (x du premier et du dernier pixel de l'objet), ou -1.
function rowExtents(mask, w, h) {
  const left = new Int32Array(h).fill(-1);
  const right = new Int32Array(h).fill(-1);
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++)
      if (mask[o + x]) {
        left[y] = x;
        break;
      }
    if (left[y] < 0) continue;
    for (let x = w - 1; x >= 0; x--)
      if (mask[o + x]) {
        right[y] = x;
        break;
      }
  }
  return { left, right };
}

// Axe vertical : centre des lignes du corps (lignes larges, loin du bouchon et de l'ombre au sol),
// et inclinaison (pente x/y).
function axisOf(left, right, top, bottom) {
  let maxW = 0;
  for (let y = top; y <= bottom; y++) if (left[y] >= 0) maxW = Math.max(maxW, right[y] - left[y]);
  const ys = [];
  const cs = [];
  const H = bottom - top;
  for (let y = Math.round(top + H * 0.12); y <= Math.round(bottom - H * 0.1); y++) {
    if (left[y] < 0 || right[y] - left[y] < maxW * 0.6) continue;
    ys.push(y);
    cs.push((left[y] + right[y]) / 2);
  }
  if (ys.length < 8) return { cx: median(cs.length ? cs : [0]), slope: 0, maxW };
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const mc = cs.reduce((a, b) => a + b, 0) / cs.length;
  let num = 0;
  let den = 0;
  ys.forEach((y, i) => {
    num += (y - my) * (cs[i] - mc);
    den += (y - my) * (y - my);
  });
  return { cx: median(cs), slope: den ? num / den : 0, maxW };
}

function medianFilter(values, radius) {
  const out = new Float64Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const a = Math.max(0, i - radius);
    const b = Math.min(values.length - 1, i + radius);
    out[i] = median(values.slice(a, b + 1));
  }
  return out;
}

// Creux dans le corps de la bouteille : la largeur chute d'un coup puis revient d'un coup à la même
// valeur. C'est la signature d'un détourage qui a « mangé » une étiquette claire (une étiquette est
// un cylindre : la bouteille garde sa largeur). On rebouche ces creux. Un col n'est pas concerné :
// on y descend progressivement (épaule) et la largeur du bouchon n'est pas celle du corps.
function repairDips(hw) {
  const n = hw.length;
  const maxW = Math.max(...hw);
  const step = Math.max(2, Math.round(n * 0.008));
  let fixed = 0;
  for (let k = step; k < n - step; k++) {
    let wa = 0;
    for (let j = k - step; j < k; j++) wa = Math.max(wa, hw[j]);
    if (wa < maxW * 0.5 || hw[k] >= wa * 0.88) continue;
    // Retour à la largeur d'avant, et retour brusque (moins de 2 « pas »).
    let k1 = -1;
    for (let j = k + 1; j < Math.min(n, k + Math.round(n * 0.7)); j++) {
      if (hw[j] >= wa * 0.97) {
        k1 = j;
        break;
      }
    }
    if (k1 < 0) continue;
    let abrupt = false;
    for (let j = Math.max(k, k1 - step * 2); j < k1; j++) if (hw[j] < wa * 0.9) abrupt = true;
    if (!abrupt) continue;
    const wb = hw[k1];
    for (let j = k; j < k1; j++) hw[j] = wa + ((wb - wa) * (j - k)) / (k1 - k);
    fixed += k1 - k;
    k = k1;
  }
  return fixed;
}

// Demi-largeur par ligne autour de l'axe (côté le plus large : un côté rogné par le détourage,
// sur une étiquette blanche par exemple, ne réduit pas la silhouette), lissée.
function halfWidths(left, right, top, bottom, cx) {
  const n = bottom - top + 1;
  const hw = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const y = top + k;
    hw[k] = left[y] < 0 ? 0 : Math.max(cx - left[y] + 0.5, right[y] + 0.5 - cx, 0);
  }
  const repaired = repairDips(hw);
  if (repaired) warn(`silhouette réparée sur ${Math.round((repaired / n) * 100)} % de la hauteur (étiquette proche de la couleur du fond).`);
  const smooth = medianFilter(hw, Math.max(2, Math.round(n * 0.004)));
  // Pied de la bouteille : une ombre portée ne doit pas l'élargir au-delà du corps.
  const mid = smooth.slice(Math.round(n * 0.25), Math.round(n * 0.85));
  const body = Math.max(...mid);
  for (let k = Math.round(n * 0.88); k < n; k++) smooth[k] = Math.min(smooth[k], body * 1.02);
  // Petit lissage final (3 points), sans toucher aux paliers nets (bouchon, bague).
  const out = Float64Array.from(smooth);
  for (let k = 1; k < n - 1; k++) out[k] = (smooth[k - 1] + 2 * smooth[k] + smooth[k + 1]) / 4;
  return out;
}

// ---------------------------------------------------------------------------------------------
// Traitement d'une photo de bouteille

async function loadRaw(sharp, file, rotateDeg = 0, background = { r: 255, g: 255, b: 255, alpha: 1 }) {
  let img = sharp(file, { failOn: 'none' }).rotate(); // orientation EXIF
  if (rotateDeg) img = sharp(await img.ensureAlpha().png().toBuffer()).rotate(rotateDeg, { background });
  img = img.ensureAlpha().resize({ width: WORK, height: WORK, fit: 'inside', withoutEnlargement: true });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

async function analyse(sharp, file) {
  let tilt = 0;
  let raw;
  let m;
  let ext;
  let top;
  let bottom;
  let axis;
  // Mesure, puis redressement si la photo penche un peu (deux passes au plus).
  for (let pass = 0; pass < 3; pass++) {
    const bgc = m && m.mode === 'fond retiré' ? { r: m.bg[0], g: m.bg[1], b: m.bg[2], alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 };
    raw = await loadRaw(sharp, file, tilt, bgc);
    m = objectMask(raw.data, raw.w, raw.h);
    ext = rowExtents(m.mask, raw.w, raw.h);
    top = ext.left.findIndex((x) => x >= 0);
    bottom = raw.h - 1 - [...ext.left].reverse().findIndex((x) => x >= 0);
    if (top < 0 || m.size < raw.w * raw.h * 0.01) throw new Error('aucune bouteille trouvée (fond trop proche de la bouteille ?)');
    axis = axisOf(ext.left, ext.right, top, bottom);
    const t = (Math.atan(axis.slope) * 180) / Math.PI;
    if (Math.abs(t) <= 0.2 || Math.abs(tilt + t) >= 12 || pass === 2) break;
    tilt += t;
  }
  const hw = halfWidths(ext.left, ext.right, top, bottom, axis.cx);
  return { raw, mask: m.mask, mode: m.mode, top, bottom, cx: axis.cx, hw, tilt };
}

// Texture RGBA centrée sur l'axe : alpha = silhouette symétrique (sans les franges de fond), couleurs
// prolongées au-delà du bord (pas de liseré blanc quand la carte graphique filtre la texture).
function buildTexture(a) {
  const { raw, mask, top, bottom, cx, hw } = a;
  const H = bottom - top + 1;
  const R = Math.ceil(Math.max(...hw)) + 1;
  const W = R * 2;
  const out = Buffer.alloc(W * H * 4);
  const fringe = Math.max(2, Math.round(R * 0.03));
  for (let k = 0; k < H; k++) {
    const y = top + k;
    const half = hw[k];
    let l = cx - half;
    let r = cx + half;
    // Côté étroit : si l'objet réel commence juste à l'intérieur, on suit le vrai bord.
    for (let d = 0; d < fringe; d++) {
      const x = Math.round(l + d);
      if (x >= 0 && x < raw.w && mask[y * raw.w + x]) {
        l = x;
        break;
      }
    }
    for (let d = 0; d < fringe; d++) {
      const x = Math.round(r - d);
      if (x >= 0 && x < raw.w && mask[y * raw.w + x]) {
        r = x + 1;
        break;
      }
    }
    for (let i = 0; i < W; i++) {
      const sx = cx - R + i + 0.5; // centre du pixel dans l'image source
      const inside = half > 0 && sx >= l && sx <= r;
      const cov = half <= 0 ? 0 : Math.min(1, Math.max(0, Math.min(sx - l + 0.5, r - sx + 0.5)));
      const px = Math.min(raw.w - 1, Math.max(0, Math.round(Math.min(Math.max(sx, l + 1), r - 1))));
      const si = (y * raw.w + px) * 4;
      const o = (k * W + i) * 4;
      out[o] = raw.data[si];
      out[o + 1] = raw.data[si + 1];
      out[o + 2] = raw.data[si + 2];
      out[o + 3] = inside ? Math.round(cov * 255) : 0;
    }
  }
  return { buffer: out, W, H, R };
}

function profilePoints(hw, R, samples = 180) {
  const H = hw.length;
  const pts = [];
  for (let s = 0; s <= samples; s++) {
    const t = s / samples; // 0 = pied, 1 = sommet
    const k = Math.min(H - 1, Math.round((1 - t) * (H - 1)));
    pts.push([+(hw[k] / H).toFixed(5), +t.toFixed(5)]);
  }
  return { points: pts, rayonMax: +(R / H).toFixed(5) };
}

async function processBottle(sharp, slug, front, back, dest) {
  const a = await analyse(sharp, front);
  const tex = buildTexture(a);
  const scale = TEX_H / tex.H;
  const width = Math.max(2, Math.round(tex.W * scale));
  mkdirSync(dest, { recursive: true });
  const rgba = sharp(tex.buffer, { raw: { width: tex.W, height: tex.H, channels: 4 } });
  await rgba.clone().resize(width, TEX_H, { kernel: 'lanczos3' }).webp({ quality: 88, alphaQuality: 90, effort: 5 }).toFile(join(dest, 'face.webp'));
  await rgba
    .clone()
    .resize(Math.round((tex.W * THUMB_H) / tex.H), THUMB_H, { kernel: 'lanczos3' })
    .webp({ quality: 84, alphaQuality: 85, effort: 5 })
    .toFile(join(dest, 'vignette.webp'));
  const prof = profilePoints(a.hw, tex.R);
  let dos = null;
  if (back) {
    try {
      const b = await analyse(sharp, back);
      const tb = buildTexture(b);
      await sharp(tb.buffer, { raw: { width: tb.W, height: tb.H, channels: 4 } })
        .resize(Math.max(2, Math.round((tb.W * TEX_H) / tb.H)), TEX_H, { kernel: 'lanczos3' })
        .webp({ quality: 86, alphaQuality: 90, effort: 5 })
        .toFile(join(dest, 'dos.webp'));
      dos = { fichier: 'dos.webp', rayonMax: +(tb.R / tb.H).toFixed(5) };
    } catch (err) {
      warn(`${basename(back)} : ${err.message} (dos ignoré, la face sera reprise en miroir).`);
    }
  }
  const profil = {
    version: VERSION,
    slug,
    source: relative(root, front),
    fond: a.mode,
    redressement: +a.tilt.toFixed(2),
    texture: { fichier: 'face.webp', largeur: width, hauteur: TEX_H },
    ratio: +(width / TEX_H).toFixed(5),
    rayonMax: prof.rayonMax,
    dos,
    vignette: 'vignette.webp',
    points: prof.points,
  };
  writeJSON(join(dest, 'profil.json'), profil);
  return profil;
}

async function processPlace(sharp, file, name) {
  mkdirSync(outPlaces, { recursive: true });
  const meta = await sharp(file, { failOn: 'none' }).rotate().metadata();
  const sizes = {};
  for (const w of [1600, 800]) {
    const out = join(outPlaces, `${name}-${w}.webp`);
    const info = await sharp(file, { failOn: 'none' }).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78, effort: 5 }).toFile(out);
    sizes[w] = { fichier: `/lieux/${basename(out)}`, largeur: info.width, hauteur: info.height };
  }
  return { nom: name, source: relative(root, file), ratio: +((meta.autoOrient?.width || meta.width) / (meta.autoOrient?.height || meta.height)).toFixed(4), tailles: sizes };
}

// ---------------------------------------------------------------------------------------------

async function main() {
  const productFiles = listImages(join(IN, 'produits'));
  const placeFiles = listImages(join(IN, 'lieux'));
  const empty = { version: VERSION, genere: new Date().toISOString(), produits: {} };

  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch (err) {
    warn(`sharp indisponible (${err.message}) : les bouteilles dessinées en code restent affichées.`);
    writeJSON(join(outBottles, 'index.json'), empty);
    writeJSON(join(outPlaces, 'index.json'), { version: VERSION, lieux: {} });
    if (STRICT) process.exit(1);
    return;
  }

  const slugs = knownSlugs();
  const cache = (() => {
    try {
      return FORCE ? {} : JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    } catch {
      return {};
    }
  })();
  const stamp = (f) => {
    const s = statSync(f);
    return `${VERSION}:${s.size}:${Math.round(s.mtimeMs)}`;
  };

  // Regroupe face / dos par slug.
  const groups = new Map();
  for (const f of productFiles) {
    const base = basename(f, extname(f)).toLowerCase();
    const isBack = base.endsWith('-dos');
    const slug = isBack ? base.slice(0, -4) : base;
    if (slugs && !slugs.has(slug)) {
      warn(`${relative(root, f)} : « ${slug} » ne correspond à aucun produit (le plus proche : « ${closest(slug, slugs)} »). Fichier ignoré.`);
      continue;
    }
    const g = groups.get(slug) || {};
    g[isBack ? 'back' : 'front'] = f;
    groups.set(slug, g);
  }

  const manifest = { ...empty, produits: {} };
  let errors = 0;
  for (const [slug, g] of groups) {
    if (!g.front) {
      warn(`${slug} : photo de dos sans photo de face, ignorée.`);
      continue;
    }
    const dest = join(outBottles, slug);
    const key = `${stamp(g.front)}|${g.back ? stamp(g.back) : '-'}`;
    try {
      let profil;
      if (cache[slug] === key && existsSync(join(dest, 'profil.json'))) {
        profil = JSON.parse(readFileSync(join(dest, 'profil.json'), 'utf8'));
      } else {
        rmSync(dest, { recursive: true, force: true });
        const t0 = Date.now();
        profil = await processBottle(sharp, slug, g.front, g.back, dest);
        cache[slug] = key;
        log(`${slug} : ${profil.fond}${profil.redressement ? `, redressée de ${profil.redressement}°` : ''}${profil.dos ? ', avec dos' : ''} (${Date.now() - t0} ms)`);
      }
      manifest.produits[slug] = {
        profil: `/bouteilles/${slug}/profil.json`,
        face: `/bouteilles/${slug}/face.webp`,
        dos: profil.dos ? `/bouteilles/${slug}/dos.webp` : null,
        vignette: `/bouteilles/${slug}/vignette.webp`,
        ratio: profil.ratio,
      };
    } catch (err) {
      errors++;
      delete cache[slug];
      rmSync(dest, { recursive: true, force: true });
      warn(`${relative(root, g.front)} : ${err.message}`);
    }
  }
  // Dossiers de bouteilles dont la photo a été retirée : supprimés.
  if (existsSync(outBottles))
    for (const d of readdirSync(outBottles)) {
      const p = join(outBottles, d);
      if (statSync(p).isDirectory() && !manifest.produits[d]) rmSync(p, { recursive: true, force: true });
    }
  writeJSON(join(outBottles, 'index.json'), manifest);

  // Lieux (distillerie, boutique, alambics, vignes…)
  rmSync(outPlaces, { recursive: true, force: true });
  const places = { version: VERSION, lieux: {} };
  for (const f of placeFiles) {
    const name = basename(f, extname(f))
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    try {
      places.lieux[name] = await processPlace(sharp, f, name);
    } catch (err) {
      errors++;
      warn(`${relative(root, f)} : ${err.message}`);
    }
  }
  writeJSON(join(outPlaces, 'index.json'), places);

  try {
    writeJSON(CACHE_FILE, cache);
  } catch {
    /* cache facultatif */
  }
  const nb = Object.keys(manifest.produits).length;
  log(`${nb} bouteille${nb > 1 ? 's' : ''} en photo, ${Object.keys(places.lieux).length} photo(s) de lieux${errors ? `, ${errors} erreur(s)` : ''}.`);
  if (errors && STRICT) process.exit(1);
}

main().catch((err) => {
  warn(err.stack || err.message);
  if (STRICT) process.exit(1);
});
