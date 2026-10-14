// Rendus produit (« packshots ») : la photo traitée (photos/produits → vignette.webp) quand elle
// existe, sinon un rendu 3D de la bouteille construite en code (fait à la demande, quand l'image
// devient visible, et gardé pour la session), sinon l'illustration SVG.
// - bg  : couleur du plateau (fond neutre des cartes par défaut, aplat de marque dans les menus) ;
// - fmt : 'portrait' (3:4, cartes) ou 'paysage' (4:3, menus et cartes de marque) ;
// - plusieurs produits : photo de groupe (bouteilles côte à côte).
import { bySlug } from '../data/products.js';
import { bottleSVG } from './bottleSvg.js';
import { hasWebGL } from './dom.js';
import { photoIndex } from './photos.js';
import { readJSON, writeJSON } from './store.js';

const RENDER_VERSION = 10; // à incrémenter quand le rendu des bouteilles change
const KEY = `blachere-rendus-${RENDER_VERSION}`;
const snaps = readJSON(KEY, {}, 'session') || {};
let photos = {};
const ready = photoIndex().then((p) => (photos = p));
const webgl = typeof window !== 'undefined' && hasWebGL();
export const FORMATS = { portrait: [420, 560], paysage: [640, 480] };
const key = (slugs, bg, fmt) => `${slugs.join('+')}|${bg}|${fmt}`;

function src(slugs, bg, fmt) {
  if (slugs.length === 1 && !bg && fmt === 'portrait' && photos[slugs[0]]?.vignette) return photos[slugs[0]].vignette;
  return snaps[key(slugs, bg, fmt)] || null;
}

export function renderHTML(slugs, { eager = false, bg = '', fmt = 'portrait' } = {}) {
  const list = slugs.filter((s) => bySlug[s]);
  const s = src(list, bg, fmt);
  if (s) return `<img class="thumb" src="${s}" alt="" ${eager ? '' : 'loading="lazy"'} decoding="async" />`;
  return `<span class="thumb thumb--svg" data-shot="${list.join(' ')}" data-bg="${bg}" data-fmt="${fmt}"${bg ? ` style="background:${bg}"` : ''}>${list.map((x) => bottleSVG(bySlug[x])).join('')}</span>`;
}

export const thumbHTML = (p, opts = {}) => renderHTML([p.slug], opts);

const queue = new Map();
let rendering = false;
let io = null;

async function flush() {
  if (rendering || !queue.size) return;
  rendering = true;
  const jobs = [...queue.values()];
  queue.clear();
  try {
    const { renderShots } = await import('../three/snap.js');
    await renderShots(jobs, (job, url) => {
      snaps[key(job.slugs, job.bg, job.fmt)] = url;
      writeJSON(KEY, snaps, 'session');
      swap(job);
    });
  } catch (err) {
    console.warn('Rendus 3D indisponibles, illustrations conservées.', err);
  }
  rendering = false;
  if (queue.size) flush();
}

const jobOf = (el) => ({ slugs: el.dataset.shot.split(' ').filter(Boolean), bg: el.dataset.bg || '', fmt: el.dataset.fmt || 'portrait' });

function swap(job, root = document) {
  const s = src(job.slugs, job.bg, job.fmt);
  if (!s) return;
  root.querySelectorAll('[data-shot]').forEach((el) => {
    const j = jobOf(el);
    if (key(j.slugs, j.bg, j.fmt) !== key(job.slugs, job.bg, job.fmt)) return;
    const img = new Image();
    img.className = 'thumb is-new';
    img.alt = '';
    img.decoding = 'async';
    img.src = s;
    img.onload = () => el.replaceWith(img);
  });
}

// Remplace les illustrations SVG d'un bloc par la photo ou le rendu 3D dès qu'ils sont prêts.
export async function upgradeThumbs(root = document) {
  await ready;
  root.querySelectorAll('[data-shot]').forEach((el) => {
    const j = jobOf(el);
    if (src(j.slugs, j.bg, j.fmt)) swap(j, root);
  });
  if (!webgl) return;
  io ||= new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        if (!e.target.dataset.shot) return;
        const j = jobOf(e.target);
        if (src(j.slugs, j.bg, j.fmt)) return swap(j);
        queue.set(key(j.slugs, j.bg, j.fmt), j);
        clearTimeout(upgradeThumbs.t);
        upgradeThumbs.t = setTimeout(flush, 60);
      }),
    { rootMargin: '300px 0px' },
  );
  root.querySelectorAll('[data-shot]').forEach((el) => io.observe(el));
}
