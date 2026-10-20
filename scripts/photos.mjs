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
//      dos.webp (si photo de dos), profil.json (silhouette), vignette.webp (cartes de la boutique),
//      detour.webp (la vraie photo redressée et détourée à son bord, pour les usages à plat).
// Les photos de lieux photos/lieux/<nom>.jpg sont redimensionnées dans public/lieux/.
// Les archives (public/archives/<id>.webp, versionnées, jusqu'à 1 400 px de large) reçoivent des
// tailles réduites pour leur srcset (src/app/pieces.js) : public/archives-tailles/<id>-400.webp et
// -800.webp, seulement quand l'original est plus large.
// Étiquettes : photos/etiquettes/<slug>.jpg|png (photo de la bouteille de face, étiquette bien
// visible) → public/etiquettes/<slug>.webp, l'étiquette « déroulée » (projection cylindrique
// inverse, éclairage égalisé), posée sur la bouteille 3D dessinée en code à la place de
// l'étiquette dessinée. Réglages facultatifs dans photos/etiquettes/<slug>.json (angle, source).
// Les dossiers produits sont régénérés à chaque build (ils ne sont pas versionnés).
//
// Options : --entree <dossier> (défaut photos) --sortie <dossier> (défaut public) --force --strict
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = 20; // à incrémenter quand le traitement change (invalide le cache)
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
const outLabels = join(OUT, 'etiquettes');
const outArchives = join(OUT, 'archives-tailles');
const ARCHIVE_TAILLES = [400, 800]; // mêmes largeurs que src/app/pieces.js

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
    let y0 = h;
    let y1 = 0;
    queue[tail++] = s;
    label[s] = id;
    while (head < tail) {
      const p = queue[head++];
      const x = p % w;
      const y = (p - x) / w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x > 0 && mask[p - 1] && !label[p - 1]) ((label[p - 1] = id), (queue[tail++] = p - 1));
      if (x < w - 1 && mask[p + 1] && !label[p + 1]) ((label[p + 1] = id), (queue[tail++] = p + 1));
      if (y > 0 && mask[p - w] && !label[p - w]) ((label[p - w] = id), (queue[tail++] = p - w));
      if (y < h - 1 && mask[p + w] && !label[p + w]) ((label[p + w] = id), (queue[tail++] = p + w));
    }
    comps.push({ id, size: tail, x0, x1, y0, y1 });
  }
  if (!comps.length) return { mask: new Uint8Array(n), size: 0 };
  const main = comps.reduce((a, b) => (b.size > a.size ? b : a));
  const span = main.x1 - main.x0;
  const c0 = main.x0 + span * 0.25;
  const c1 = main.x1 - span * 0.25;
  // un morceau tout entier sous le pied de la bouteille est son reflet sur le sol (ou son ombre) :
  // écarté (la photo de l'Apéritif à l'olive le montre)
  const keep = new Set(comps.filter((c) => c === main || (c.size > main.size * 0.0015 && c.x1 >= c0 && c.x0 <= c1 && c.y0 < main.y1 - 2)).map((c) => c.id));
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
// cote : 'max' (par défaut), ou 'droit' / 'gauche' quand un accessoire (collerette, étiquette
// suspendue, ficelle) déborde d'un côté : la silhouette est alors prise du côté propre.
function halfWidths(left, right, top, bottom, cx, cote = 'max') {
  const n = bottom - top + 1;
  const hw = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const y = top + k;
    const l = cx - left[y] + 0.5;
    const r = right[y] + 0.5 - cx;
    hw[k] = left[y] < 0 ? 0 : Math.max(cote === 'droit' ? r : cote === 'gauche' ? l : cote === 'min' ? Math.min(l, r) : Math.max(l, r), 0);
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

// Bords « blanchis » : une photo détourée sur fond blanc garde souvent, sur un ou deux pixels, un
// reste de ce fond (liseré clair autour d'un verre sombre). Un pixel du bord nettement plus clair que
// la bouteille juste à l'intérieur reprend la couleur de cet intérieur ; l'alpha ne change pas. Le
// verre clair, les capsules et manchons blancs (intérieur clair lui aussi) ne bougent pas.
function nettoyerBords(raw, mask) {
  const { w, h, data } = raw;
  const n = w * h;
  // distance au bord, en pixels (0 hors masque), jusqu'à 4
  const dist = new Uint8Array(n);
  for (let p = 0; p < n; p++) dist[p] = mask[p] ? 4 : 0;
  for (let d = 1; d <= 3; d++)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (dist[p] <= d) continue;
        if ((x > 0 && dist[p - 1] < d) || (x < w - 1 && dist[p + 1] < d) || (y > 0 && dist[p - w] < d) || (y < h - 1 && dist[p + w] < d)) dist[p] = d;
      }
  const lum = (p) => data[p * 4] * 0.299 + data[p * 4 + 1] * 0.587 + data[p * 4 + 2] * 0.114;
  const src = Buffer.from(data);
  let fixes = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      // bord : les deux premiers pixels de l'objet et l'anticrénelage juste dehors
      if (dist[p] > 2 || (dist[p] === 0 && !data[p * 4 + 3])) continue;
      let r = 0;
      let g = 0;
      let b = 0;
      let k = 0;
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const q = yy * w + xx;
          if (dist[q] < 4) continue;
          r += src[q * 4];
          g += src[q * 4 + 1];
          b += src[q * 4 + 2];
          k++;
        }
      if (k < 3) continue;
      r /= k;
      g /= k;
      b /= k;
      const li = r * 0.299 + g * 0.587 + b * 0.114;
      const lp = lum(p);
      if (lp > 150 && lp - li > 45) {
        data[p * 4] = Math.round(r);
        data[p * 4 + 1] = Math.round(g);
        data[p * 4 + 2] = Math.round(b);
        fixes++;
      }
    }
  return fixes;
}

async function analyse(sharp, file, opts = {}) {
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
    if (opts.cote === 'droit' || opts.cote === 'gauche') {
      // axe pris sur le bord propre et la largeur du corps (l'accessoire est de l'autre côté)
      const ys = [];
      for (let y = Math.round(top + (bottom - top) * 0.55); y <= Math.round(bottom - (bottom - top) * 0.1); y++) if (ext.left[y] >= 0) ys.push(y);
      const half = median(ys.map((y) => (ext.right[y] - ext.left[y]) / 2));
      axis.cx = median(ys.map((y) => (opts.cote === 'droit' ? ext.right[y] - half : ext.left[y] + half)));
    }
    const t = (Math.atan(axis.slope) * 180) / Math.PI;
    if (opts.redresser === false || Math.abs(t) <= 0.2 || Math.abs(tilt + t) >= 12 || pass === 2) break;
    tilt += t;
  }
  const hw = halfWidths(ext.left, ext.right, top, bottom, axis.cx, opts.cote);
  const bords = nettoyerBords(raw, m.mask);
  return { raw, mask: m.mask, mode: m.mode, bg: m.bg, top, bottom, cx: axis.cx, hw, tilt, bords };
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
    // Vrais bords de l'objet sur la ligne : la silhouette est symétrique, la photo pas toujours
    // (capsule, col). Entre la silhouette et le vrai bord, la couleur est celle du bord, jamais
    // celle du fond retiré (noir transparent, qui ressortait en liseré sombre).
    let vl = Math.round(l);
    let vr = Math.round(r) - 1;
    while (vl < cx && !(vl >= 0 && vl < raw.w && mask[y * raw.w + vl])) vl++;
    while (vr > cx && !(vr >= 0 && vr < raw.w && mask[y * raw.w + vr])) vr--;
    for (let i = 0; i < W; i++) {
      const sx = cx - R + i + 0.5; // centre du pixel dans l'image source
      const inside = half > 0 && sx >= l && sx <= r;
      const cov = half <= 0 ? 0 : Math.min(1, Math.max(0, Math.min(sx - l + 0.5, r - sx + 0.5)));
      const px = Math.min(raw.w - 1, Math.max(0, vl, Math.min(vr, Math.round(Math.min(Math.max(sx, l + 1), r - 1)))));
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

// Photo à plat (vignettes des cartes, bandeau des opérations, affiches des campagnes) : la vraie
// photo, redressée comme pour la 3D, détourée à son propre bord. Ni la silhouette symétrique de la
// 3D (bosses du côté étroit, épaules lissées), ni les fragments détachés de la photo.
function buildPhoto2D(a) {
  const { raw, mask, mode, top, bottom } = a;
  const { w, h } = raw;
  // masque élargi de 2 px : l'anticrénelage du bord reste, les fragments détachés partent
  const keep = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy >= 0 && yy < h && xx >= 0 && xx < w) keep[yy * w + xx] = 1;
        }
    }
  let x0 = w;
  let x1 = -1;
  for (let y = top; y <= bottom; y++)
    for (let x = 0; x < w; x++)
      if (mask[y * w + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
  x0 = Math.max(0, x0 - 2);
  x1 = Math.min(w - 1, x1 + 2);
  const y0 = Math.max(0, top - 1);
  const y1 = Math.min(h - 1, bottom + 1);
  const W = x1 - x0 + 1;
  const H = y1 - y0 + 1;
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = (y0 + y) * w + x0 + x;
      const o = (y * W + x) * 4;
      out[o] = raw.data[p * 4];
      out[o + 1] = raw.data[p * 4 + 1];
      out[o + 2] = raw.data[p * 4 + 2];
      out[o + 3] = mode === 'fond retiré' ? (mask[p] ? 255 : 0) : keep[p] ? raw.data[p * 4 + 3] : 0;
    }
  return { buffer: out, W, H };
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

// ---------------------------------------------------------------------------------------------
// Étiquette à plat (fichier d'étiquette du site) posée sur la bouteille en photo : on cherche où
// elle se trouve sur la photo de face (haut, bas, colonne de l'étiquette au centre de la face) en
// comparant la photo et l'étiquette « enroulée » (corrélation normalisée, recherche grossière puis
// fine). L'étiquette nette remplace alors la photo dans cette bande, et tourne avec la bouteille.
async function calibrateLabel(sharp, tex, hw, labelFile) {
  const H = tex.H;
  const W = tex.W;
  const R = Math.max(...hw);
  const cx = W / 2;
  // échantillons de la photo : 240 lignes, 25 colonnes sur ±62 % du rayon (centre de la face)
  const ROWS = 240;
  const COLS = 25;
  const at = (x, y) => {
    const i = (Math.min(H - 1, Math.max(0, Math.round(y))) * W + Math.min(W - 1, Math.max(0, Math.round(x)))) * 4;
    return [tex.buffer[i], tex.buffer[i + 1], tex.buffer[i + 2], tex.buffer[i + 3]];
  };
  const F = [];
  for (let r = 0; r < ROWS; r++) {
    const y = ((r + 0.5) / ROWS) * H;
    const row = [];
    for (let j = 0; j < COLS; j++) {
      const dx = (-0.62 + (1.24 * j) / (COLS - 1)) * R;
      row.push(at(cx + dx, y));
    }
    F.push(row);
  }
  // étiquette réduite
  const LW = 160;
  const { data: L, info } = await sharp(labelFile).resize({ width: LW }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const LH = info.height;
  const lab = (u, v) => {
    const x = Math.min(LW - 1, Math.max(0, u * (LW - 1)));
    const y = Math.min(LH - 1, Math.max(0, v * (LH - 1)));
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = x - x0;
    const ty = y - y0;
    const g = (xx, yy, k) => L[(Math.min(LH - 1, yy) * LW + Math.min(LW - 1, xx)) * 3 + k];
    return [0, 1, 2].map((k) => g(x0, y0, k) * (1 - tx) * (1 - ty) + g(x0 + 1, y0, k) * tx * (1 - ty) + g(x0, y0 + 1, k) * (1 - tx) * ty + g(x0 + 1, y0 + 1, k) * tx * ty);
  };
  const aspect = LW / LH;
  // lignes du corps (largeur proche du maximum) : l'étiquette y est posée
  const body = [];
  for (let r = 0; r < ROWS; r++) if (hw[Math.min(H - 1, Math.round(((r + 0.5) / ROWS) * H))] > R * 0.86) body.push(r);
  if (body.length < ROWS * 0.15) return null;
  const rMin = body[0];
  const rMax = body[body.length - 1];
  const score = (r0, r1, u0) => {
    const span = (aspect * ((r1 - r0) / ROWS) * H) / R; // angle couvert (rad)
    let n = 0;
    let sp = 0;
    let sl = 0;
    const P = [];
    const Q = [];
    for (let r = r0; r <= r1; r += 3) {
      const v = (r - r0) / (r1 - r0);
      for (let j = 0; j < COLS; j++) {
        const f = F[r][j];
        if (f[3] < 200) continue;
        const dx = -0.62 + (1.24 * j) / (COLS - 1);
        const u = u0 + Math.asin(dx) / span;
        if (u < 0 || u > 1) continue;
        const l = lab(u, v);
        for (let k = 0; k < 3; k++) {
          P.push(f[k]);
          Q.push(l[k]);
          sp += f[k];
          sl += l[k];
          n++;
        }
      }
    }
    if (n < 60) return -1;
    const mp = sp / n;
    const mq = sl / n;
    let num = 0;
    let dp = 0;
    let dq = 0;
    for (let i = 0; i < n; i++) {
      const a = P[i] - mp;
      const b = Q[i] - mq;
      num += a * b;
      dp += a * a;
      dq += b * b;
    }
    return num / Math.sqrt(dp * dq + 1e-9);
  };
  // contraintes physiques : une étiquette à plat couvre au moins 80° du tour et au plus le tour
  // entier, et mesure au moins 15 % de la hauteur de la bouteille
  const spanOf = (r0, r1) => (aspect * ((r1 - r0) / ROWS) * H) / R;
  const plausible = (r0, r1) => r1 - r0 >= ROWS * 0.15 && spanOf(r0, r1) >= 1.4 && spanOf(r0, r1) <= 6.4;
  let best = { s: -2 };
  for (let r0 = rMin; r0 < rMax - ROWS * 0.15; r0 += 4)
    for (let r1 = r0 + Math.round(ROWS * 0.15); r1 <= rMax; r1 += 4)
      for (let u0 = 0.3; u0 <= 0.701; u0 += 0.04) {
        if (!plausible(r0, r1)) continue;
        const sc = score(r0, r1, u0);
        if (sc > best.s) best = { s: sc, r0, r1, u0 };
      }
  if (best.s < -1) return { ok: false, score: 0 };
  // affinage
  for (let pass = 0; pass < 2; pass++) {
    const b0 = { ...best };
    for (let r0 = b0.r0 - 4; r0 <= b0.r0 + 4; r0++)
      for (let r1 = b0.r1 - 4; r1 <= b0.r1 + 4; r1++)
        for (let u0 = b0.u0 - 0.04; u0 <= b0.u0 + 0.0401; u0 += 0.01) {
          if (r0 < 0 || r1 >= ROWS || !plausible(r0, r1)) continue;
          const sc = score(r0, r1, u0);
          if (sc > best.s) best = { s: sc, r0, r1, u0 };
        }
  }
  if (process.env.DEBUG_LABEL) log(`calage : ${JSON.stringify(best)} (lignes ${rMin}–${rMax} sur ${ROWS})`);
  if (best.s < 0.3) return { ok: false, score: +best.s.toFixed(3) };
  const y0 = (best.r0 / ROWS) * H;
  const y1 = ((best.r1 + 1) / ROWS) * H;
  const span = (aspect * (y1 - y0)) / R;
  // Couleurs : le fichier d'étiquette (souvent converti depuis la quadrichromie) est ramené aux
  // couleurs de la vraie bouteille photographiée. On compare les aplats (zones unies de l'étiquette,
  // loin des contours que la photo adoucit) au centre de la face, où l'éclairage est égal, et on
  // ajuste une matrice couleur 3×3 + décalage, retenue vers l'identité (régularisation).
  const fitColors = (cut) => {
    const X = [];
    const Y = [];
    const dU = 1.6 / LW;
    const dV = 1.6 / LH;
    for (let r = best.r0 + 2; r <= best.r1 - 2; r++) {
      const v = (r - best.r0) / (best.r1 - best.r0);
      for (let j = 0; j < COLS; j++) {
        const dx = -0.62 + (1.24 * j) / (COLS - 1);
        if (Math.abs(dx) > 0.42 || F[r][j][3] < 220) continue;
        const u = best.u0 + Math.asin(dx) / span;
        if (u < 0.03 || u > 0.97) continue;
        const l = lab(u, v);
        let flat = true;
        for (const [du, dv] of [[dU, 0], [-dU, 0], [0, dV], [0, -dV], [dU, dV], [-dU, -dV]]) {
          const n = lab(u + du, v + dv);
          if (Math.abs(n[0] - l[0]) + Math.abs(n[1] - l[1]) + Math.abs(n[2] - l[2]) > 30) {
            flat = false;
            break;
          }
        }
        if (!flat || (cut && cut(u, v))) continue;
        X.push(l);
        Y.push([F[r][j][0], F[r][j][1], F[r][j][2]]);
      }
    }
    let matrice = null;
    if (X.length >= 80) {
      // moindres carrés régularisés, une sortie à la fois : y = w·x + d, ‖w − identité‖ pénalisé
      const lambda = X.length * 0.15;
      const solve = (A, bvec) => {
        const n = bvec.length;
        const M = A.map((row, i) => [...row, bvec[i]]);
        for (let c = 0; c < n; c++) {
          let piv = c;
          for (let r2 = c + 1; r2 < n; r2++) if (Math.abs(M[r2][c]) > Math.abs(M[piv][c])) piv = r2;
          [M[c], M[piv]] = [M[piv], M[c]];
          if (Math.abs(M[c][c]) < 1e-9) return null;
          for (let r2 = 0; r2 < n; r2++) {
            if (r2 === c) continue;
            const f = M[r2][c] / M[c][c];
            for (let k = c; k <= n; k++) M[r2][k] -= f * M[c][k];
          }
        }
        return M.map((row, i) => row[n] / row[i]);
      };
      const rows = [];
      for (let k = 0; k < 3; k++) {
        // inconnues [w0, w1, w2, d] ; x normalisé 0–1, d en 0–255
        const A = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
        const bvec = [0, 0, 0, 0];
        for (let i = 0; i < X.length; i++) {
          const xi = [X[i][0], X[i][1], X[i][2], 255];
          for (let a = 0; a < 4; a++) {
            for (let b2 = 0; b2 < 4; b2++) A[a][b2] += xi[a] * xi[b2];
            bvec[a] += xi[a] * Y[i][k];
          }
        }
        const scale = 255 * 255;
        for (let a = 0; a < 3; a++) {
          A[a][a] += lambda * scale;
          if (a === k) bvec[a] += lambda * scale;
        }
        const w = solve(A, bvec);
        if (!w) {
          rows.push(null);
          continue;
        }
        rows.push(w);
      }
      if (rows.every(Boolean)) {
        const err = (f) => {
          let e = 0;
          for (let i = 0; i < X.length; i++) for (let k = 0; k < 3; k++) e += Math.abs(f(X[i], k) - Y[i][k]);
          return e / X.length;
        };
        const before = err((x, k) => x[k]);
        const after = err((x, k) => rows[k][0] * x[0] + rows[k][1] * x[1] + rows[k][2] * x[2] + rows[k][3] * 255);
        if (after < before * 0.85) matrice = rows.map((w) => w.map((v, i) => +(i === 3 ? v * 255 : v).toFixed(4)));
        if (process.env.DEBUG_LABEL) log(`couleurs : ${X.length} aplats, écart ${before.toFixed(1)} → ${after.toFixed(1)}${matrice ? '' : ' (non appliqué)'}`);
      }
    }
    return matrice;
  };

  // Découpe de l'étiquette (arche, fenêtre du soleil des Couleur Provence…) : le fichier est
  // rectangulaire, la vraie étiquette ne l'est pas toujours. Là où la photo montre la bouteille nue
  // (couleur prise juste au-dessus de l'étiquette) alors que le fichier montre du papier, l'étiquette
  // est découpée. Seule la face visible sur la photo est mesurée ; ailleurs l'étiquette reste pleine.
  const MW = 220;
  const { data: LM, info: im } = await sharp(labelFile).resize({ width: MW }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const MH = im.height;
  const pix = (x, y) => {
    const xx = Math.min(W - 1.001, Math.max(0, x));
    const yy = Math.min(H - 1.001, Math.max(0, y));
    const x0 = Math.floor(xx);
    const y0p = Math.floor(yy);
    const tx = xx - x0;
    const ty = yy - y0p;
    const out = [0, 0, 0, 0];
    for (const [dx2, dy2, wgt] of [[0, 0, (1 - tx) * (1 - ty)], [1, 0, tx * (1 - ty)], [0, 1, (1 - tx) * ty], [1, 1, tx * ty]]) {
      const i = ((y0p + dy2) * W + x0 + dx2) * 4;
      for (let k = 0; k < 4; k++) out[k] += tex.buffer[i + k] * wgt;
    }
    return out;
  };
  const yTop = y0;
  const yBot = y1;
  const cutMask = (mat) => {
    const m = new Uint8Array(MW * MH).fill(1);
    for (let j = 0; j < MH; j++) {
      const v = (j + 0.5) / MH;
      const y = yTop + v * (yBot - yTop);
      for (let i = 0; i < MW; i++) {
        const u = (i + 0.5) / MW;
        const th = (u - best.u0) * span;
        if (Math.abs(th) > 1.15) continue;
        const x = cx + R * Math.sin(th);
        const p = pix(x, y);
        if (p[3] < 200) continue;
        const b = [0, 0, 0];
        for (const k of [0.012, 0.02, 0.03]) {
          const q = pix(x, yTop - k * H);
          for (let c = 0; c < 3; c++) b[c] += q[c] / 3;
        }
        let l = [LM[(j * MW + i) * 3], LM[(j * MW + i) * 3 + 1], LM[(j * MW + i) * 3 + 2]];
        if (mat) l = mat.map((w) => w[0] * l[0] + w[1] * l[1] + w[2] * l[2] + w[3]);
        const dB = Math.hypot(p[0] - b[0], p[1] - b[1], p[2] - b[2]);
        const dL = Math.hypot(p[0] - l[0], p[1] - l[1], p[2] - l[2]);
        if (dB < 60 && dL > dB + 50) m[j * MW + i] = 0;
      }
    }
    // ouverture morphologique (rayon 2) : pas de liseré découpé le long des contours
    const morph = (src, keepIfAll) => {
      const out = new Uint8Array(src.length);
      for (let j = 0; j < MH; j++)
        for (let i = 0; i < MW; i++) {
          let all = true;
          let any = false;
          for (let dj = -2; dj <= 2; dj++)
            for (let di = -2; di <= 2; di++) {
              const jj = Math.min(MH - 1, Math.max(0, j + dj));
              const ii = Math.min(MW - 1, Math.max(0, i + di));
              const c = src[jj * MW + ii] === 0;
              all = all && c;
              any = any || c;
            }
          out[j * MW + i] = (keepIfAll ? all : any) ? 0 : 1;
        }
      return out;
    };
    let cutM = morph(morph(m, true), false);
    // petites zones isolées : ignorées
    const seen = new Uint8Array(MW * MH);
    const minArea = MW * MH * 0.004;
    for (let s0 = 0; s0 < MW * MH; s0++) {
      if (cutM[s0] !== 0 || seen[s0]) continue;
      const comp = [s0];
      seen[s0] = 1;
      for (let h = 0; h < comp.length; h++) {
        const q = comp[h];
        const qi = q % MW;
        for (const n of [q - 1, q + 1, q - MW, q + MW]) {
          if (n < 0 || n >= MW * MH || seen[n] || cutM[n] !== 0) continue;
          if ((n === q - 1 && qi === 0) || (n === q + 1 && qi === MW - 1)) continue;
          seen[n] = 1;
          comp.push(n);
        }
      }
      if (comp.length < minArea) for (const q of comp) cutM[q] = 1;
    }
    // contour adouci (filtre majoritaire 5×5, deux passes) : une découpe d'imprimeur est nette et
    // régulière, sans les crans de la mesure
    for (let pass = 0; pass < 2; pass++) {
      const next = new Uint8Array(cutM.length);
      for (let j = 0; j < MH; j++)
        for (let i = 0; i < MW; i++) {
          let n = 0;
          for (let dj = -2; dj <= 2; dj++)
            for (let di = -2; di <= 2; di++) n += cutM[Math.min(MH - 1, Math.max(0, j + dj)) * MW + Math.min(MW - 1, Math.max(0, i + di))];
          next[j * MW + i] = n >= 13 ? 1 : 0;
        }
      cutM = next;
    }
    return cutM;
  };
  if (process.env.DEBUG_LABEL_DIR) {
    // photo « déroulée » dans le repère de l'étiquette, étiquette et découpe, pour contrôle visuel
    const un = Buffer.alloc(MW * MH * 3, 128);
    for (let j = 0; j < MH; j++)
      for (let i = 0; i < MW; i++) {
        const th = ((i + 0.5) / MW - best.u0) * span;
        if (Math.abs(th) > 1.15) continue;
        const p = pix(cx + R * Math.sin(th), yTop + ((j + 0.5) / MH) * (yBot - yTop));
        for (let c = 0; c < 3; c++) un[(j * MW + i) * 3 + c] = p[c];
      }
    const tag = basename(labelFile, extname(labelFile));
    mkdirSync(process.env.DEBUG_LABEL_DIR, { recursive: true });
    await sharp(un, { raw: { width: MW, height: MH, channels: 3 } }).png().toFile(join(process.env.DEBUG_LABEL_DIR, `${tag}-photo.png`));
    await sharp(LM, { raw: { width: MW, height: MH, channels: 3 } }).png().toFile(join(process.env.DEBUG_LABEL_DIR, `${tag}-label.png`));
  }
  const m0 = cutMask(null);
  const inCut = (mask) => (u, v) => mask[Math.min(MH - 1, Math.floor(v * MH)) * MW + Math.min(MW - 1, Math.floor(u * MW))] === 0;
  const matrice = fitColors(inCut(m0));
  const masque = cutMask(matrice);
  if (process.env.DEBUG_LABEL_DIR)
    await sharp(Buffer.from(Array.from(masque, (v) => (v ? 255 : 0))), { raw: { width: MW, height: MH, channels: 1 } })
      .png()
      .toFile(join(process.env.DEBUG_LABEL_DIR, `${basename(labelFile, extname(labelFile))}-masque.png`));
  let nCut = 0;
  for (const c of masque) if (c === 0) nCut++;
  const couleurs = matrice;
  return {
    ok: true,
    score: +best.s.toFixed(3),
    // hauteurs depuis le pied (0) jusqu'au sommet (1) de la bouteille
    bas: +(1 - y1 / H).toFixed(5),
    haut: +(1 - y0 / H).toFixed(5),
    centre: +best.u0.toFixed(4), // colonne de l'étiquette (0…1) au centre de la face
    angle: +span.toFixed(5), // angle couvert autour de la bouteille (radians)
    rayon: +(R / H).toFixed(5),
    couleurs, // matrice 3×3 + décalage (0–255) appliquée au fichier, ou null
    decoupe: +(nCut / (MW * MH)).toFixed(4), // part de l'étiquette découpée (0 = rectangle plein)
    masque: nCut ? { data: masque, w: MW, h: MH } : null,
  };
}

async function processBottle(sharp, slug, front, back, dest, label = null, plat = false, opts = {}) {
  const a = await analyse(sharp, front, plat ? { ...opts, redresser: false } : opts);
  const tex = buildTexture(a);
  const scale = TEX_H / tex.H;
  const width = Math.max(2, Math.round(tex.W * scale));
  mkdirSync(dest, { recursive: true });
  const rgba = sharp(tex.buffer, { raw: { width: tex.W, height: tex.H, channels: 4 } });
  await rgba.clone().resize(width, TEX_H, { kernel: 'lanczos3' }).webp({ quality: 88, alphaQuality: 90, effort: 5 }).toFile(join(dest, 'face.webp'));
  const p2d = buildPhoto2D(a);
  const rgba2d = sharp(p2d.buffer, { raw: { width: p2d.W, height: p2d.H, channels: 4 } });
  // Flacon non tourné (carafe et étui, coffret) : la photo elle-même, détourée, sans symétrie.
  let photo = null;
  if (plat) {
    const trimmed = await sharp(a.raw.data, { raw: { width: a.raw.w, height: a.raw.h, channels: 4 } }).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true });
    const ph = Math.min(TEX_H, trimmed.info.height);
    await sharp(trimmed.data).resize({ height: ph, kernel: 'lanczos3' }).webp({ quality: 88, alphaQuality: 90, effort: 5 }).toFile(join(dest, 'photo.webp'));
    await sharp(trimmed.data).resize({ height: THUMB_H, kernel: 'lanczos3' }).webp({ quality: 84, alphaQuality: 85, effort: 5 }).toFile(join(dest, 'vignette.webp'));
    photo = { fichier: 'photo.webp', ratio: +(trimmed.info.width / trimmed.info.height).toFixed(5) };
  } else {
    await rgba2d
      .clone()
      .resize(Math.round((p2d.W * THUMB_H) / p2d.H), THUMB_H, { kernel: 'lanczos3' })
      .webp({ quality: 84, alphaQuality: 85, effort: 5 })
      .toFile(join(dest, 'vignette.webp'));
    // La même en grand (bandeau des opérations, affiches des campagnes avant la 3D).
    await rgba2d.clone().resize(Math.round((p2d.W * TEX_H) / p2d.H), TEX_H, { kernel: 'lanczos3' }).webp({ quality: 88, alphaQuality: 90, effort: 5 }).toFile(join(dest, 'detour.webp'));
  }
  const prof = profilePoints(a.hw, tex.R);
  // Couleur « tout autour » : la bouteille est un solide de révolution ; sur ses côtés et son dos
  // (que la photo ne montre pas), on reprend, ligne par ligne, la couleur médiane du centre de la
  // face (verre, liquide, capsule), sans les reflets ni le bord sombre de la silhouette.
  {
    const rows = Buffer.alloc(tex.H * 3);
    for (let k = 0; k < tex.H; k++) {
      const half = a.hw[k] || 0;
      const vals = [[], [], []];
      // bandes latérales de la photo (entre 45 et 80 % du rayon, des deux côtés) : sans l'impression
      // centrée (logo de la capsule) ni le bord sombre du verre
      for (let f = 0.45; f <= 0.801; f += 0.035) for (const dx of [-half * f, half * f]) {
        const x = Math.round(tex.W / 2 + dx);
        const i = (k * tex.W + Math.min(tex.W - 1, Math.max(0, x))) * 4;
        if (tex.buffer[i + 3] < 200) continue;
        for (let c = 0; c < 3; c++) vals[c].push(tex.buffer[i + c]);
      }
      for (let c = 0; c < 3; c++) rows[k * 3 + c] = vals[c].length ? median(vals[c]) : 0;
    }
    // trous (lignes sans pixel) : couleur de la ligne voisine
    for (let k = 1; k < tex.H; k++) if (!rows[k * 3] && !rows[k * 3 + 1] && !rows[k * 3 + 2]) rows.copy(rows, k * 3, (k - 1) * 3, k * 3);
    await sharp(rows, { raw: { width: 1, height: tex.H, channels: 3 } })
      .resize(4, 512, { kernel: 'cubic', fit: 'fill' })
      .png()
      .toFile(join(dest, 'corps.png'));
  }
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
    // couleur du fond de la photo : là où on la retrouve à l'intérieur de la silhouette, on voit à
    // travers le verre (col vide, épaule) ; la 3D y rend du verre transparent
    couleurFond: a.mode === 'fond retiré' && a.bg ? `#${a.bg.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}` : null,
    redressement: +a.tilt.toFixed(2),
    texture: { fichier: 'face.webp', largeur: width, hauteur: TEX_H },
    ratio: +(width / TEX_H).toFixed(5),
    rayonMax: prof.rayonMax,
    dos,
    vignette: 'vignette.webp',
    corps: 'corps.png',
    points: prof.points,
    plat,
    photo,
    etiquette: null,
    etiquetteDos: null,
  };
  if (label && !plat) {
    try {
      const cal = await calibrateLabel(sharp, tex, a.hw, label.file);
      if (cal?.ok) {
        const { masque, ...info } = cal;
        // fichier ramené aux couleurs de la photo, avec sa découpe en transparence
        const colour = (img) =>
          img
            .removeAlpha()
            .recomb(cal.couleurs ? cal.couleurs.map((w) => w.slice(0, 3)) : [[1, 0, 0], [0, 1, 0], [0, 0, 1]])
            .linear([1, 1, 1], cal.couleurs ? cal.couleurs.map((w) => w[3]) : [0, 0, 0]);
        const front = await colour(sharp(label.file).resize({ width: 1400, withoutEnlargement: true })).raw().toBuffer({ resolveWithObject: true });
        let out = sharp(front.data, { raw: front.info });
        if (masque) {
          const m = Buffer.from(Array.from(masque.data, (v) => (v ? 255 : 0)));
          const alpha = await sharp(m, { raw: { width: masque.w, height: masque.h, channels: 1 } })
            .resize(front.info.width, front.info.height, { kernel: 'cubic' })
            .blur(1.1)
            .extractChannel(0)
            .raw()
            .toBuffer({ resolveWithObject: true });
          if (alpha.info.channels !== 1 || alpha.data.length !== front.info.width * front.info.height) throw new Error(`masque de découpe mal formé (${alpha.info.channels} canaux)`);
          // assemblage RGBA explicite
          const rgba = Buffer.alloc(front.info.width * front.info.height * 4);
          const ch = front.info.channels;
          for (let i = 0, n = front.info.width * front.info.height; i < n; i++) {
            rgba[i * 4] = front.data[i * ch];
            rgba[i * 4 + 1] = front.data[i * ch + 1];
            rgba[i * 4 + 2] = front.data[i * ch + 2];
            rgba[i * 4 + 3] = alpha.data[i];
          }
          out = sharp(rgba, { raw: { width: front.info.width, height: front.info.height, channels: 4 } });
        }
        await out.webp({ quality: 88, alphaQuality: 90, effort: 5 }).toFile(join(dest, 'etiquette.webp'));
        profil.etiquette = { fichier: 'etiquette.webp', ...info };
        // contre-étiquette : même imprimeur, même bas d'étiquette, taille relative des fichiers
        // d'origine (même résolution de numérisation), centrée au dos
        if (label.dos && label.meta?.hauteur && label.dos.meta?.hauteur) {
          const back = await colour(sharp(label.dos.file).resize({ width: 1200, withoutEnlargement: true })).webp({ quality: 86, effort: 5 }).toBuffer({ resolveWithObject: true });
          writeFileSync(join(dest, 'etiquette-dos.webp'), back.data);
          const hFront = cal.haut - cal.bas;
          const hBack = Math.min(hFront * 1.05, hFront * (label.dos.meta.hauteur / label.meta.hauteur));
          const aspect = label.dos.meta.largeur / label.dos.meta.hauteur;
          const angle = (aspect * hBack) / cal.rayon;
          // pas de chevauchement avec l'étiquette de face
          const free = Math.PI * 2 - cal.angle;
          if (angle < free * 0.96) profil.etiquetteDos = { fichier: 'etiquette-dos.webp', bas: cal.bas, haut: +(cal.bas + hBack).toFixed(5), angle: +angle.toFixed(5) };
          else warn(`${slug} : contre-étiquette trop large pour le dos (${angle.toFixed(2)} rad pour ${free.toFixed(2)} libres), ignorée.`);
        }
      } else warn(`${slug} : étiquette à plat non retrouvée sur la photo (score ${cal?.score ?? '—'}), photo seule.`);
    } catch (err) {
      warn(`${slug} : étiquette à plat illisible (${err.message}).`);
    }
  }
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
// Étiquette déroulée depuis une photo de face (projection cylindrique inverse)
//
// 1. Bords de la bouteille (fond retiré) sur les lignes de l'étiquette : axe cx et rayon R (px).
// 2. Haut et bas de l'étiquette, colonne par colonne : premier écart net avec la couleur du liquide
//    au-dessus (et au-dessous), puis ajustement d'une parabole (perspective + légère inclinaison).
// 3. Pour chaque colonne de la texture, l'angle θ ∈ [−angle, +angle] donne x = cx + R·sin θ ; la ligne
//    est interpolée entre le haut et le bas de l'étiquette à cet x.
// 4. Éclairage égalisé : la couleur dominante (fond de l'étiquette) doit garder la même luminosité
//    d'un bord à l'autre (les bords d'un cylindre sont plus sombres sur la photo).
// 5. Lignes manquantes (étiquette coupée par le bas de la photo) : couleur dominante.

function quadFit(xs, ys) {
  // moindres carrés y = a + b·x + c·x², deux passes (écarts > 3 px écartés)
  let keep = xs.map((_, i) => i);
  let coef = [0, 0, 0];
  for (let pass = 0; pass < 3; pass++) {
    const S = Array.from({ length: 3 }, () => [0, 0, 0, 0]);
    for (const i of keep) {
      const x = xs[i];
      const v = [1, x, x * x];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) S[r][c] += v[r] * v[c];
        S[r][3] += v[r] * ys[i];
      }
    }
    // Gauss
    for (let c = 0; c < 3; c++) {
      let piv = c;
      for (let r = c + 1; r < 3; r++) if (Math.abs(S[r][c]) > Math.abs(S[piv][c])) piv = r;
      [S[c], S[piv]] = [S[piv], S[c]];
      for (let r = 0; r < 3; r++) {
        if (r === c || !S[c][c]) continue;
        const f = S[r][c] / S[c][c];
        for (let k = c; k < 4; k++) S[r][k] -= f * S[c][k];
      }
    }
    coef = [0, 1, 2].map((r) => (S[r][r] ? S[r][3] / S[r][r] : 0));
    const f = (x) => coef[0] + coef[1] * x + coef[2] * x * x;
    const next = keep.filter((i) => Math.abs(f(xs[i]) - ys[i]) < 3);
    if (next.length < 8 || next.length === keep.length) break;
    keep = next;
  }
  return (x) => coef[0] + coef[1] * x + coef[2] * x * x;
}

function rgbToHsv(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx / 255];
}

async function processLabel(sharp, file, params, dest) {
  const { data, info } = await sharp(file, { failOn: 'none' }).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const at = (x, y) => {
    const i = (Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  // Bords de la bouteille ligne par ligne : premier écart net avec le fond local de la ligne (pris
  // aux deux extrémités, coins sombres d'une vignette exclus). Plus robuste qu'un détourage global
  // quand le fond est un dégradé (ombre d'un côté).
  const ext = { left: new Int32Array(H).fill(-1), right: new Int32Array(H).fill(-1) };
  for (let y = 0; y < H; y++) {
    const side = (x0, x1) => {
      const cs = [];
      for (let x = x0; x < x1; x++) {
        const c = at(x, y);
        if (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114 > 90) cs.push(c);
      }
      return cs.length > 4 ? [0, 1, 2].map((k) => median(cs.map((c) => c[k]))) : null;
    };
    const band = Math.max(6, Math.round(W * 0.04));
    const bl = side(0, band);
    const br = side(W - band, W);
    if (!bl || !br) continue;
    const far = (c, b) => dist(c[0], c[1], c[2], b[0], b[1], b[2]) > 38;
    for (let x = band; x < W - band - 2; x++)
      if (far(at(x, y), bl) && far(at(x + 1, y), bl) && far(at(x + 2, y), bl)) {
        ext.left[y] = x;
        break;
      }
    for (let x = W - band - 1; x > band + 2; x--)
      if (far(at(x, y), br) && far(at(x - 1, y), br) && far(at(x - 2, y), br)) {
        ext.right[y] = x;
        break;
      }
    if (ext.left[y] < 0 || ext.right[y] <= ext.left[y]) ext.left[y] = ext.right[y] = -1;
  }
  // Lignes de l'étiquette : les plus « colorées » (saturation ou sombre) de la moitié basse.
  const rowScore = new Float64Array(H);
  for (let y = 0; y < H; y++) {
    if (ext.left[y] < 0) continue;
    let n = 0;
    let c = 0;
    for (let x = ext.left[y] + 4; x < ext.right[y] - 4; x += 2) {
      const [r, g, b] = at(x, y);
      const [, sat, val] = rgbToHsv(r, g, b);
      if (sat > 0.45 || val < 0.35) c++;
      n++;
    }
    rowScore[y] = n ? c / n : 0;
  }
  // Plus long bloc continu de lignes « étiquette » (petits trous tolérés : texte blanc, filets).
  let best = [0, -1];
  let start = -1;
  let gap = 0;
  for (let y = 0; y <= H; y++) {
    const on = y < H && rowScore[y] > 0.5;
    if (on) {
      if (start < 0) start = y;
      gap = 0;
    } else if (start >= 0 && ++gap > 6) {
      const end = y - gap;
      if (end - start > best[1] - best[0]) best = [start, end];
      start = -1;
      gap = 0;
    }
  }
  if (start >= 0 && H - 1 - start > best[1] - best[0]) best = [start, H - 1];
  const labelRows = [];
  for (let y = best[0]; y <= best[1]; y++) labelRows.push(y);
  if (labelRows.length < H * 0.08) throw new Error('étiquette introuvable sur la photo');
  const y0 = params.haut ?? labelRows[0];
  const y1 = params.bas ?? labelRows[labelRows.length - 1];
  const mid = labelRows.filter((y) => y > y0 + (y1 - y0) * 0.1 && y < y1 - (y1 - y0) * 0.1);
  const lefts = mid.map((y) => ext.left[y]).filter((x) => x >= 0);
  const rights = mid.map((y) => ext.right[y]).filter((x) => x >= 0);
  const xl = median(lefts);
  const xr = median(rights) + 1;
  const cx = (xl + xr) / 2;
  const R = (xr - xl) / 2;

  // Haut / bas de l'étiquette colonne par colonne.
  const tops = [];
  const bots = [];
  const xs = [];
  const xb = [];
  const DIFF = 70;
  for (let x = Math.round(xl + R * 0.12); x <= Math.round(xr - R * 0.12); x += 2) {
    const ref = (ya, yb) => {
      const cs = [];
      for (let y = ya; y <= yb; y++) if (y >= 0 && y < H) cs.push(at(x, y));
      if (cs.length < 4) return null;
      return [0, 1, 2].map((k) => median(cs.map((c) => c[k])));
    };
    const above = ref(y0 - 70, y0 - 30);
    if (above) {
      for (let y = y0 - 30; y < y0 + 40; y++) {
        const ok = [0, 1, 2].every((d) => {
          const c = at(x, y + d);
          return dist(c[0], c[1], c[2], above[0], above[1], above[2]) > DIFF;
        });
        if (ok) {
          xs.push(x);
          tops.push(y);
          break;
        }
      }
    }
    const below = y1 + 60 < H ? ref(y1 + 30, y1 + 60) : null;
    if (below) {
      for (let y = y1 + 30; y > y1 - 40; y--) {
        const ok = [0, 1, 2].every((d) => {
          const c = at(x, y - d);
          return dist(c[0], c[1], c[2], below[0], below[1], below[2]) > DIFF;
        });
        if (ok) {
          xb.push(x);
          bots.push(y + 1);
          break;
        }
      }
    }
  }
  const top = tops.length >= 8 ? quadFit(xs, tops) : () => y0;
  // Bas coupé par la photo : même courbure que le haut, décalée.
  const bottom = bots.length >= 8 ? quadFit(xb, bots) : (x) => top(x) + (y1 - y0);
  const heightPx = bottom(cx) - top(cx);
  // Angles gardés à gauche et à droite de l'axe (au-delà, la photo est trop écrasée).
  const degG = params.angleGauche ?? params.angle ?? 80;
  const degD = params.angleDroite ?? params.angle ?? 80;
  const aG = (degG * Math.PI) / 180;
  const aD = (degD * Math.PI) / 180;
  const arcPx = R * (aG + aD);
  const OW = params.largeur ?? 1536;
  const OH = Math.round((OW * heightPx) / arcPx);
  const out = Buffer.alloc(OW * OH * 4);
  const sample = (fx, fy) => {
    const x0 = Math.floor(fx);
    const y0s = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0s;
    const a = at(x0, y0s);
    const b = at(x0 + 1, y0s);
    const c = at(x0, y0s + 1);
    const d = at(x0 + 1, y0s + 1);
    return [0, 1, 2].map((k) => a[k] * (1 - tx) * (1 - ty) + b[k] * tx * (1 - ty) + c[k] * (1 - tx) * ty + d[k] * tx * ty);
  };
  for (let i = 0; i < OW; i++) {
    const th = -aG + ((i + 0.5) / OW) * (aG + aD);
    const sx = cx + R * Math.sin(th) - 0.5;
    const t = top(sx);
    const b = bottom(sx);
    for (let j = 0; j < OH; j++) {
      const sy = t + ((j + 0.5) / OH) * (b - t) - 0.5;
      const o = (j * OW + i) * 4;
      if (sy > H - 1.5 || sy < 0) {
        out[o + 3] = 0;
        continue;
      }
      const c = sample(sx, sy);
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
      out[o + 3] = 255;
    }
  }
  // Couleur dominante (teinte la plus fréquente des pixels saturés du centre).
  const hist = new Float64Array(36);
  for (let j = Math.round(OH * 0.1); j < OH * 0.9; j += 3)
    for (let i = Math.round(OW * 0.3); i < OW * 0.7; i += 3) {
      const o = (j * OW + i) * 4;
      const [h, sat, val] = rgbToHsv(out[o], out[o + 1], out[o + 2]);
      if (sat > 0.5 && val > 0.3) hist[Math.floor(h / 10) % 36]++;
    }
  const peak = hist.indexOf(Math.max(...hist)) * 10 + 5;
  const isDom = (o) => {
    const [h, sat, val] = rgbToHsv(out[o], out[o + 1], out[o + 2]);
    const dh = Math.min(Math.abs(h - peak), 360 - Math.abs(h - peak));
    return out[o + 3] && dh < 16 && sat > 0.5 && val > 0.25;
  };
  // Luminosité du fond par colonne → gain (égalisation de l'éclairage).
  const colL = new Float64Array(OW).fill(NaN);
  const domRGB = [[], [], []];
  for (let i = 0; i < OW; i++) {
    const ls = [];
    for (let j = 0; j < OH; j += 2) {
      const o = (j * OW + i) * 4;
      if (!isDom(o)) continue;
      ls.push(Math.max(out[o], out[o + 1], out[o + 2]));
      if (i > OW * 0.35 && i < OW * 0.65 && j % 8 === 0) for (let k = 0; k < 3; k++) domRGB[k].push(out[o + k]);
    }
    if (ls.length > OH * 0.04) colL[i] = median(ls);
  }
  // interpolation des colonnes sans mesure, lissage
  let last = -1;
  for (let i = 0; i < OW; i++) {
    if (Number.isNaN(colL[i])) continue;
    if (last < 0) for (let k = 0; k < i; k++) colL[k] = colL[i];
    else for (let k = last + 1; k < i; k++) colL[k] = colL[last] + ((colL[i] - colL[last]) * (k - last)) / (i - last);
    last = i;
  }
  for (let k = last + 1; k < OW && last >= 0; k++) colL[k] = colL[last];
  const rad = Math.max(4, Math.round(OW * 0.03));
  const smoothL = colL.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let k = Math.max(0, i - rad); k <= Math.min(OW - 1, i + rad); k++) (s += colL[k], n++);
    return s / n;
  });
  const ref = median(Array.from(smoothL.slice(Math.round(OW * 0.4), Math.round(OW * 0.6))));
  const dom = domRGB.map((v) => median(v));
  for (let i = 0; i < OW; i++) {
    const g = Math.min(1.6, Math.max(0.85, ref / (smoothL[i] || ref)));
    for (let j = 0; j < OH; j++) {
      const o = (j * OW + i) * 4;
      if (!out[o + 3]) {
        // ligne manquante : couleur dominante
        out[o] = dom[0];
        out[o + 1] = dom[1];
        out[o + 2] = dom[2];
        out[o + 3] = 255;
        continue;
      }
      for (let k = 0; k < 3; k++) out[o + k] = Math.min(255, Math.round(out[o + k] * g));
    }
  }
  mkdirSync(dirname(dest), { recursive: true });
  await sharp(out, { raw: { width: OW, height: OH, channels: 4 } })
    .removeAlpha()
    .sharpen({ sigma: 0.8, m1: 0.6, m2: 1.2 })
    .webp({ quality: 90, effort: 5 })
    .toFile(dest);
  return {
    largeur: OW,
    hauteur: OH,
    // largeur physique / hauteur physique de la partie déroulée (arc / hauteur)
    ratio: +(OW / OH).toFixed(5),
    angleGauche: degG,
    angleDroite: degD,
    dominante: `#${dom.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`,
    axe: { cx: +cx.toFixed(1), rayon: +R.toFixed(1), haut: +top(cx).toFixed(1), bas: +bottom(cx).toFixed(1), basDetecte: bots.length >= 8 },
  };
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
    writeJSON(join(outLabels, 'index.json'), { version: VERSION, etiquettes: {} });
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
  // étiquettes à plat (photos/etiquettes/<slug>.webp|jpg|png + <slug>.json { "type": "plat" })
  const flatLabel = (slug) => {
    const j = join(IN, 'etiquettes', `${slug}.json`);
    if (!existsSync(j)) return null;
    try {
      if (JSON.parse(readFileSync(j, 'utf8')).type !== 'plat') return null;
    } catch {
      return null;
    }
    return listImages(join(IN, 'etiquettes')).find((f) => basename(f, extname(f)).toLowerCase() === slug) || null;
  };
  // contre-étiquette à plat (photos/etiquettes/<slug>-dos.* + <slug>-dos.json { "type": "dos" })
  const backLabel = (slug) => {
    const j = join(IN, 'etiquettes', `${slug}-dos.json`);
    let meta = {};
    try {
      meta = existsSync(j) ? JSON.parse(readFileSync(j, 'utf8')) : {};
    } catch {
      meta = {};
    }
    const file = listImages(join(IN, 'etiquettes')).find((f) => basename(f, extname(f)).toLowerCase() === `${slug}-dos`);
    return file ? { file, meta } : null;
  };
  const labelMeta = (slug) => {
    try {
      return JSON.parse(readFileSync(join(IN, 'etiquettes', `${slug}.json`), 'utf8'));
    } catch {
      return {};
    }
  };
  // flacons non tournés (photo affichée à plat)
  let plats = new Set();
  try {
    plats = new Set(JSON.parse(readFileSync(join(IN, 'produits', 'plats.json'), 'utf8')).slugs || []);
  } catch {
    /* facultatif */
  }
  for (const [slug, g] of groups) {
    if (!g.front) {
      warn(`${slug} : photo de dos sans photo de face, ignorée.`);
      continue;
    }
    const dest = join(outBottles, slug);
    const label = flatLabel(slug);
    const dos = label ? backLabel(slug) : null;
    const plat = plats.has(slug);
    // réglages facultatifs : photos/produits/<slug>.json { "redresser": false, "cote": "droit" }
    let opts = {};
    const oj = join(IN, 'produits', `${slug}.json`);
    if (existsSync(oj)) {
      try {
        opts = JSON.parse(readFileSync(oj, 'utf8'));
      } catch (err) {
        warn(`${relative(root, oj)} : JSON illisible (${err.message}), réglages par défaut.`);
      }
    }
    const key = `${stamp(g.front)}|${g.back ? stamp(g.back) : '-'}|${label ? stamp(label) : '-'}|${dos ? stamp(dos.file) : '-'}|${plat ? 'plat' : 'tour'}|${JSON.stringify(opts)}`;
    try {
      let profil;
      if (cache[slug] === key && existsSync(join(dest, 'profil.json'))) {
        profil = JSON.parse(readFileSync(join(dest, 'profil.json'), 'utf8'));
      } else {
        rmSync(dest, { recursive: true, force: true });
        const t0 = Date.now();
        profil = await processBottle(sharp, slug, g.front, g.back, dest, label ? { file: label, meta: labelMeta(slug), dos } : null, plat, opts);
        cache[slug] = key;
        log(`${slug} : ${profil.fond}${profil.redressement ? `, redressée de ${profil.redressement}°` : ''}${profil.dos ? ', avec dos' : ''}${profil.etiquette ? `, étiquette à plat (score ${profil.etiquette.score})` : ''}${plat ? ', photo à plat' : ''} (${Date.now() - t0} ms)`);
      }
      manifest.produits[slug] = {
        profil: `/bouteilles/${slug}/profil.json`,
        face: `/bouteilles/${slug}/face.webp`,
        dos: profil.dos ? `/bouteilles/${slug}/dos.webp` : null,
        vignette: `/bouteilles/${slug}/vignette.webp`,
        ratio: profil.ratio,
        plat: !!profil.plat,
        photo: profil.photo ? `/bouteilles/${slug}/photo.webp` : null,
        photoRatio: profil.photo?.ratio ?? null,
        etiquette: profil.etiquette ? `/bouteilles/${slug}/etiquette.webp` : null,
        etiquetteDos: profil.etiquetteDos ? `/bouteilles/${slug}/etiquette-dos.webp` : null,
        corps: `/bouteilles/${slug}/corps.png`,
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

  // Archives : tailles réduites (srcset des cadres du musée, des pages de marque et de l'accueil)
  rmSync(outArchives, { recursive: true, force: true });
  mkdirSync(outArchives, { recursive: true });
  let archives = 0;
  try {
    const { pieces } = JSON.parse(readFileSync(join(root, 'src/data/site/archives.json'), 'utf8'));
    for (const piece of pieces) {
      const src = join(OUT, piece.image.replace(/^\//, ''));
      if (!existsSync(src)) continue;
      for (const w of ARCHIVE_TAILLES.filter((x) => piece.largeur > x)) {
        await sharp(src, { failOn: 'none' }).resize({ width: w }).webp({ quality: 78, effort: 5 }).toFile(join(outArchives, `${piece.id}-${w}.webp`));
        archives++;
      }
    }
  } catch (err) {
    errors++;
    warn(`archives : ${err.message}`);
  }

  // Étiquettes déroulées (photos/etiquettes/<slug>.jpg|png + <slug>.json facultatif)
  rmSync(outLabels, { recursive: true, force: true });
  const labels = { version: VERSION, etiquettes: {} };
  for (const f of listImages(join(IN, 'etiquettes'))) {
    const slug = basename(f, extname(f)).toLowerCase();
    // contre-étiquette : traitée avec la bouteille en photo
    if (slug.endsWith('-dos') && (!slugs || slugs.has(slug.slice(0, -4)))) continue;
    if (slugs && !slugs.has(slug)) {
      warn(`${relative(root, f)} : « ${slug} » ne correspond à aucun produit (le plus proche : « ${closest(slug, slugs)} »). Fichier ignoré.`);
      continue;
    }
    let params = {};
    const pj = join(IN, 'etiquettes', `${slug}.json`);
    if (existsSync(pj)) {
      try {
        params = JSON.parse(readFileSync(pj, 'utf8'));
      } catch (err) {
        warn(`${relative(root, pj)} : JSON illisible (${err.message}), réglages par défaut.`);
      }
    }
    // étiquette à plat et contre-étiquette : traitées avec la bouteille en photo (calibrateLabel)
    if (params.type === 'plat' || params.type === 'dos') continue;
    try {
      const t0 = Date.now();
      const meta = await processLabel(sharp, f, params, join(outLabels, `${slug}.webp`));
      labels.etiquettes[slug] = { texture: `/etiquettes/${slug}.webp`, source: params.source || relative(root, f), ...meta };
      log(`étiquette ${slug} : ${meta.largeur}×${meta.hauteur}, de −${meta.angleGauche}° à +${meta.angleDroite}°, axe ${meta.axe.cx} / rayon ${meta.axe.rayon} px (${Date.now() - t0} ms)`);
    } catch (err) {
      errors++;
      warn(`${relative(root, f)} : ${err.message}`);
    }
  }
  writeJSON(join(outLabels, 'index.json'), labels);

  try {
    writeJSON(CACHE_FILE, cache);
  } catch {
    /* cache facultatif */
  }
  const nb = Object.keys(manifest.produits).length;
  log(`${nb} bouteille${nb > 1 ? 's' : ''} en photo, ${Object.keys(places.lieux).length} photo(s) de lieux, ${archives} taille(s) d'archives${errors ? `, ${errors} erreur(s)` : ''}.`);
  if (errors && STRICT) process.exit(1);
}

main().catch((err) => {
  warn(err.stack || err.message);
  if (STRICT) process.exit(1);
});
