// Logotypes « pac » et « Fun Blue » vectorisés depuis les vraies étiquettes à plat du site officiel
// (branche photos-site : photos/site/produits/pac-citron-2.jpg et fun-blue-2.jpg).
// Outil ponctuel, pas lancé au build : les SVG produits sont versionnés dans public/marques/.
//
//   npm i --no-save potrace@2.1.8      (traceur vectoriel, non installé avec le site)
//   node scripts/marques.mjs [--source /chemin/vers/photos/site]
//
// Méthode :
// - « pac » : les lettres jaunes sont isolées par leur couleur (composantes connexes de la zone du
//   mot, sans le blason ni l'ovale « SIROP CITRON »), agrandies ×2 puis tracées (potrace) ; le
//   liseré sombre et le halo blanc du mot, mesurés sur l'étiquette (épaisseurs en pixels), sont
//   rendus par des contours SVG arrondis autour du même tracé : forme exacte, couleurs exactes.
//   pac-clair.svg, pour les fonds clairs : même tracé, sans le halo blanc, liseré triplé.
// - « Fun Blue » : la silhouette (lettres blanches + relief bleu marine) et les lettres blanches sont
//   isolées puis tracées séparément ; le relief marine est dessiné sous les lettres.
// Les couleurs sont les médianes mesurées sur l'étiquette.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
let potrace;
try {
  potrace = require('potrace');
} catch {
  console.error('[marques] potrace manquant : npm i --no-save potrace@2.1.8');
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv.indexOf('--source');
const SRC = arg > 0 ? process.argv[arg + 1] : '/home/user/blachere-photos-site/photos/site';
const OUT = join(root, 'public/marques');
mkdirSync(OUT, { recursive: true });
const log = (m) => console.log(`[marques] ${m}`);

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const hex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

async function load(file, box) {
  const meta = await sharp(file).metadata();
  const left = Math.round(meta.width * box.x0);
  const top = Math.round(meta.height * box.y0);
  const width = Math.round(meta.width * (box.x1 - box.x0));
  const height = Math.round(meta.height * (box.y1 - box.y0));
  const { data, info } = await sharp(file).extract({ left, top, width, height }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height };
}

// Composantes connexes (4-voisinage) d'un masque ; renvoie { label, comps:[{id,size,x0,y0,x1,y1}] }.
function components(mask, W, H) {
  const label = new Int32Array(W * H);
  const comps = [];
  const queue = new Int32Array(W * H);
  let id = 0;
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || label[s]) continue;
    id++;
    let head = 0;
    let tail = 0;
    queue[tail++] = s;
    label[s] = id;
    const c = { id, size: 0, x0: W, y0: H, x1: 0, y1: 0 };
    while (head < tail) {
      const p = queue[head++];
      const x = p % W;
      const y = (p - x) / W;
      c.size++;
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
      for (const n of [p - 1, p + 1, p - W, p + W]) {
        if (n < 0 || n >= W * H || label[n] || !mask[n]) continue;
        if ((n === p - 1 && x === 0) || (n === p + 1 && x === W - 1)) continue;
        label[n] = id;
        queue[tail++] = n;
      }
    }
    comps.push(c);
  }
  return { label, comps };
}

// Distance (en pixels, chanfrein 3-4) de chaque pixel au masque.
function distanceTo(mask, W, H) {
  const INF = 1e9;
  const d = new Float32Array(W * H).fill(INF);
  for (let i = 0; i < W * H; i++) if (mask[i]) d[i] = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (x > 0) d[i] = Math.min(d[i], d[i - 1] + 1);
      if (y > 0) {
        d[i] = Math.min(d[i], d[i - W] + 1);
        if (x > 0) d[i] = Math.min(d[i], d[i - W - 1] + 1.4142);
        if (x < W - 1) d[i] = Math.min(d[i], d[i - W + 1] + 1.4142);
      }
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      if (x < W - 1) d[i] = Math.min(d[i], d[i + 1] + 1);
      if (y < H - 1) {
        d[i] = Math.min(d[i], d[i + W] + 1);
        if (x < W - 1) d[i] = Math.min(d[i], d[i + W + 1] + 1.4142);
        if (x > 0) d[i] = Math.min(d[i], d[i + W - 1] + 1.4142);
      }
    }
  return d;
}

// Tracé vectoriel d'un masque (agrandi ×SCALE et lissé avant le tracé) ; coordonnées ramenées à
// l'échelle de l'étiquette.
const SCALE = 4;
async function trace(mask, W, H, soft01 = null) {
  // soft01 : appartenance continue (0…1) au bord, pour un contour au sous-pixel près ; hors du
  // masque et à plus de 2 px de lui, rien (pas de forme voisine de même couleur)
  const img = Buffer.alloc(W * H);
  const near = soft01 ? distanceTo(mask, W, H) : null;
  for (let i = 0; i < W * H; i++) {
    let v = mask[i] ? 1 : 0;
    if (soft01) v = mask[i] ? Math.max(soft01[i], 0.55) : near[i] <= 2 ? Math.min(soft01[i], 0.45) : 0;
    img[i] = Math.round(255 * (1 - v));
  }
  // flou avant agrandissement : le bord en escalier du masque devient une pente douce, et le seuil
  // donne un contour lisse au quart de pixel près
  const soft = await sharp(img, { raw: { width: W, height: H, channels: 1 } }).blur(1.3).extractChannel(0).raw().toBuffer();
  if (soft.length !== W * H) throw new Error(`masque flou mal formé (${soft.length} octets pour ${W * H})`);
  const big = await sharp(soft, { raw: { width: W, height: H, channels: 1 } })
    .resize(W * SCALE, H * SCALE, { kernel: 'cubic' })
    .threshold(128)
    .png()
    .toBuffer();
  const tracer = new potrace.Potrace({ turdSize: 100 * SCALE * SCALE, alphaMax: 1.2, optCurve: true, optTolerance: 1.2, threshold: 128, blackOnWhite: true });
  await new Promise((ok, ko) => tracer.loadImage(big, (err) => (err ? ko(err) : ok())));
  const tag = tracer.getPathTag('#000');
  const d = /\sd="([^"]+)"/.exec(tag)[1];
  // ramène les coordonnées à l'échelle 1 (au dixième de pixel de l'étiquette : invisible à l'écran)
  return d
    .replace(/-?\d+(\.\d+)?/g, (n) => String(Math.round((Number(n) / SCALE) * 10) / 10))
    .replace(/,\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s?([MCLZ])\s?/gi, '$1')
    .trim();
}

// Allègement d'un tracé : les points d'appui de chaque sous-chemin sont réduits (Ramer-Douglas-
// Peucker, tolérance au quart de pixel de l'étiquette), puis reliés par des courbes de Catmull-Rom
// converties en Bézier cubiques ; les angles vifs restent vifs.
function simplify(d, eps = 0.1) {
  const subs = d.split('M').filter(Boolean);
  const out = [];
  for (const sp of subs) {
    const nums = (sp.match(/-?\d+(\.\d+)?/g) || []).map(Number);
    // points d'extrémité : le premier couple (M), puis le dernier couple de chaque C (6 nombres) ou L (2)
    const pts = [[nums[0], nums[1]]];
    const cmds = sp.slice(sp.search(/[CLZ]/i)).match(/[CL][^CLZ]*/gi) || [];
    for (const c of cmds) {
      const n = (c.match(/-?\d+(\.\d+)?/g) || []).map(Number);
      if (n.length >= 2) pts.push([n[n.length - 2], n[n.length - 1]]);
    }
    if (pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.01) pts.pop();
    if (pts.length < 4) continue;
    // RDP sur un contour fermé : on coupe au point le plus éloigné du premier
    const rdp = (a) => {
      if (a.length < 3) return a;
      const [x0, y0] = a[0];
      const [x1, y1] = a[a.length - 1];
      const L = Math.hypot(x1 - x0, y1 - y0) || 1e-9;
      let best = -1;
      let dmax = 0;
      for (let i = 1; i < a.length - 1; i++) {
        const dd = Math.abs((y1 - y0) * a[i][0] - (x1 - x0) * a[i][1] + x1 * y0 - y1 * x0) / L;
        if (dd > dmax) ((dmax = dd), (best = i));
      }
      if (dmax <= eps) return [a[0], a[a.length - 1]];
      return [...rdp(a.slice(0, best + 1)).slice(0, -1), ...rdp(a.slice(best))];
    };
    let far = 0;
    let fd = 0;
    pts.forEach((q, i) => {
      const dd = Math.hypot(q[0] - pts[0][0], q[1] - pts[0][1]);
      if (dd > fd) ((fd = dd), (far = i));
    });
    const P = [...rdp(pts.slice(0, far + 1)).slice(0, -1), ...rdp([...pts.slice(far), pts[0]]).slice(0, -1)];
    const n = P.length;
    if (n < 3) continue;
    const f = (v) => String(Math.round(v * 10) / 10);
    let path = `M${f(P[0][0])} ${f(P[0][1])}`;
    for (let i = 0; i < n; i++) {
      const p0 = P[(i - 1 + n) % n];
      const p1 = P[i];
      const p2 = P[(i + 1) % n];
      const p3 = P[(i + 2) % n];
      // angle au départ et à l'arrivée : un angle vif garde une tangente nulle (coin)
      const corner = (a, b, c) => {
        const ux = b[0] - a[0];
        const uy = b[1] - a[1];
        const vx = c[0] - b[0];
        const vy = c[1] - b[1];
        const cos = (ux * vx + uy * vy) / ((Math.hypot(ux, uy) * Math.hypot(vx, vy)) || 1);
        return cos < Math.cos((115 * Math.PI) / 180);
      };
      const t = 1 / 6;
      const c1 = corner(p0, p1, p2) ? p1 : [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
      const c2 = corner(p1, p2, p3) ? p2 : [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
      path += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
    }
    out.push(`${path}Z`);
  }
  return out.join('');
}

const bboxOf = (mask, W, H) => {
  let x0 = W;
  let y0 = H;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (mask[y * W + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return { x0, y0, x1, y1 };
};

// ------------------------------------------------------------------ pac
{
  const { data, W, H } = await load(join(SRC, 'produits/pac-citron-2.jpg'), { x0: 0.22, x1: 0.84, y0: 0.1, y1: 0.585 });
  const px = (i) => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
  const yellow = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const [r, g, b] = px(i);
    yellow[i] = r > 190 && g > 180 && b < 140 && r - b > 90 ? 1 : 0;
  }
  // les trois lettres : grandes composantes jaunes qui ne touchent pas le bas (l'ovale) ; le blason
  // de la distillerie (petit, en haut) est écarté par sa taille
  const { label, comps } = components(yellow, W, H);
  const big = comps.filter((c) => c.size > W * H * 0.01 && c.y1 < H - 2);
  const keep = new Set(big.map((c) => c.id));
  const Y = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (keep.has(label[i])) Y[i] = 1;
  log(`pac : ${big.length} lettres jaunes (${big.map((c) => c.size).join(', ')} px)`);
  // épaisseurs du liseré sombre et du halo blanc, mesurées autour des lettres
  const dist = distanceTo(Y, W, H);
  const dark = [];
  const white = [];
  for (let k = 1; k <= 30; k++) {
    let n = 0;
    let nd = 0;
    let nw = 0;
    for (let i = 0; i < W * H; i++) {
      if (dist[i] <= k - 1 || dist[i] > k) continue;
      const [r, g, b] = px(i);
      const l = (r + g + b) / 3;
      n++;
      if (l < 110) nd++;
      else if (r > 225 && g > 225 && b > 225) nw++;
    }
    dark.push(nd / (n || 1));
    white.push(nw / (n || 1));
  }
  let outline = 0;
  while (outline < dark.length && dark[outline] > 0.4) outline++;
  let halo = outline;
  while (halo < white.length && white[halo] > 0.5) halo++;
  // couleurs médianes
  const cy = [[], [], []];
  const cd = [[], [], []];
  for (let i = 0; i < W * H; i++) {
    const [r, g, b] = px(i);
    if (Y[i] && dist[i] === 0) for (let c = 0; c < 3; c++) cy[c].push([r, g, b][c]);
    if (dist[i] > 0.5 && dist[i] <= Math.max(1, outline - 0.5)) {
      const l = (r + g + b) / 3;
      if (l < 110) for (let c = 0; c < 3; c++) cd[c].push([r, g, b][c]);
    }
  }
  const jaune = hex(cy.map(median));
  const liseré = hex(cd.map(median));
  // jaune « continu » : (min(R, V) − B) ramené entre le fond et la lettre
  const softY = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const [r, g, b] = px(i);
    softY[i] = Math.min(1, Math.max(0, (Math.min(r, g) - b - 30) / 150));
  }
  log(`pac : liseré ${outline} px (${liseré}), halo blanc jusqu'à ${halo} px, jaune ${jaune}`);
  // Liseré et halo : des contours d'épaisseur constante autour des lettres, comme sur le fichier de
  // l'étiquette (mesurés : liseré ${outline} px, halo jusqu'à ${halo} px des lettres).
  const d = await trace(Y, W, H, softY);
  const bb = bboxOf(Y, W, H);
  const m = halo + 2;
  const vb = [bb.x0 - m, bb.y0 - m, bb.x1 - bb.x0 + 2 * m, bb.y1 - bb.y0 + 2 * m].map((v) => Math.round(v));
  // Contrepoinçons (intérieur du « p » et du « a ») : les sous-chemins contenus dans un autre. Le
  // tracé est rempli en pair-impair (le fond se voit au travers, comme sur l'étiquette) ; le halo
  // blanc borde l'extérieur des lettres et, plus fin, l'intérieur des contrepoinçons.
  const subs = d.split(/(?=M)/).filter(Boolean);
  const bbs = subs.map((sp) => {
    const n = sp.match(/-?\d+(\.\d+)?/g).map(Number);
    const xs = n.filter((_, i) => i % 2 === 0);
    const ys = n.filter((_, i) => i % 2 === 1);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  });
  const trou = (i) => bbs.some((o, j) => j !== i && bbs[i][0] >= o[0] && bbs[i][1] >= o[1] && bbs[i][2] <= o[2] && bbs[i][3] <= o[3]);
  const dOut = subs.filter((_, i) => !trou(i)).join('');
  const dTrous = subs.filter((_, i) => trou(i)).join('');
  const defs = `<defs><path id="l" fill-rule="evenodd" d="${d}"/><path id="o" d="${dOut}"/><path id="h" d="${dTrous}"/></defs>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" width="${vb[2]}" height="${vb[3]}">${defs}<use href="#l" fill="#fff"/><use href="#o" fill="none" stroke="#fff" stroke-width="${2 * halo}" stroke-linejoin="round"/><use href="#h" fill="none" stroke="#fff" stroke-width="${Math.round(halo + outline / 2)}" stroke-linejoin="round"/><use href="#l" fill="${liseré}" stroke="${liseré}" stroke-width="${2 * outline}" stroke-linejoin="round"/><use href="#l" fill="${jaune}"/></svg>\n`;
  writeFileSync(join(OUT, 'pac.svg'), svg);
  // Version pour les fonds clairs : le halo blanc de l'étiquette y disparaît ; le liseré, triplé,
  // détache le jaune du papier, comme le trait noir des étiquettes anciennes du PAC (archives).
  const clair = 3 * outline;
  const m2 = clair + 2;
  writeFileSync(
    join(OUT, 'pac-clair.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${[bb.x0 - m2, bb.y0 - m2, bb.x1 - bb.x0 + 2 * m2, bb.y1 - bb.y0 + 2 * m2].map(Math.round).join(' ')}"><defs><path id="l" fill-rule="evenodd" d="${d}"/></defs><use href="#l" fill="${liseré}" stroke="${liseré}" stroke-width="${2 * clair}" stroke-linejoin="round"/><use href="#l" fill="${jaune}"/></svg>\n`,
  );
  writeFileSync(join(OUT, 'pac.json'), `${JSON.stringify({ source: 'photos/site/produits/pac-citron-2.jpg (étiquette à plat du site officiel)', jaune, lisere: liseré, halo: '#ffffff', epaisseurs: { lisere: outline, halo }, ratio: +(vb[2] / vb[3]).toFixed(4) }, null, 1)}\n`);
  log(`pac : public/marques/pac.svg (${(svg.length / 1024).toFixed(1)} Ko)`);
}

// ------------------------------------------------------------------ Fun Blue
{
  const { data, W, H } = await load(join(SRC, 'produits/fun-blue-2.jpg'), { x0: 0.13, x1: 0.8, y0: 0.14, y1: 0.5 });
  const px = (i) => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
  const white = new Uint8Array(W * H);
  const navy = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const [r, g, b] = px(i);
    white[i] = r > 205 && g > 205 && b > 205 ? 1 : 0;
    navy[i] = r < 90 && g < 90 && b > 60 && b < 170 && b > r + 15 ? 1 : 0;
  }
  const union = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) union[i] = white[i] || navy[i] ? 1 : 0;
  const { label, comps } = components(union, W, H);
  // le mot est d'un seul tenant (lettres reliées par le relief) : la plus grande forme ; le « ® »
  // et la voile de la planche, à droite, sont écartés
  const big = [comps.reduce((a, b) => (b.size > a.size ? b : a))];
  const keep = new Set(big.map((c) => c.id));
  const U = new Uint8Array(W * H);
  const Wm = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++)
    if (keep.has(label[i])) {
      U[i] = 1;
      if (white[i]) Wm[i] = 1;
    }
  log(`fun blue : ${big.length} formes (${big.map((c) => c.size).join(', ')} px)`);
  const cn = [[], [], []];
  for (let i = 0; i < W * H; i++) if (U[i] && navy[i]) for (let c = 0; c < 3; c++) cn[c].push(px(i)[c]);
  const marine = hex(cn.map(median));
  // appartenances continues : « pas le bleu du fond » pour la silhouette, « blanc » pour les lettres
  const softU = new Float32Array(W * H);
  const softW = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const [r, g, b] = px(i);
    softW[i] = Math.min(1, Math.max(0, (Math.min(r, g, b) - 150) / 80));
    // fond : bleu ciel (vert élevé, bleu élevé) ; silhouette : blanc ou marine (vert bas ou très clair)
    const nav = Math.min(1, Math.max(0, (95 - g) / 40));
    softU[i] = Math.max(softW[i], nav);
  }
  const dU = await trace(U, W, H, softU);
  const dW = await trace(Wm, W, H, softW);
  const bb = bboxOf(U, W, H);
  const m = 2;
  const vb = [bb.x0 - m, bb.y0 - m, bb.x1 - bb.x0 + 2 * m, bb.y1 - bb.y0 + 2 * m].map((v) => Math.round(v));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" width="${vb[2]}" height="${vb[3]}"><path fill="${marine}" fill-rule="evenodd" d="${dU}"/><path fill="#fff" fill-rule="evenodd" d="${dW}"/></svg>\n`;
  writeFileSync(join(OUT, 'fun-blue.svg'), svg);
  writeFileSync(join(OUT, 'fun-blue.json'), `${JSON.stringify({ source: 'photos/site/produits/fun-blue-2.jpg (étiquette à plat du site officiel)', marine, lettres: '#ffffff', ratio: +(vb[2] / vb[3]).toFixed(4) }, null, 1)}\n`);
  log(`fun blue : public/marques/fun-blue.svg (${(svg.length / 1024).toFixed(1)} Ko), marine ${marine}`);
}
