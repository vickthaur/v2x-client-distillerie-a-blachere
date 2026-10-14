// Vignettes produit : la photo traitée (photos/produits → vignette.webp) quand elle existe, sinon
// un rendu 3D de la bouteille dessinée en code (fait à la demande, quand la vignette devient
// visible, et gardé pour la session), sinon l'illustration SVG.
import { bySlug } from '../data/products.js';
import { bottleSVG } from './bottleSvg.js';
import { hasWebGL } from './dom.js';
import { photoIndex } from './photos.js';
import { readJSON, writeJSON } from './store.js';

const RENDER_VERSION = 7; // à incrémenter quand le rendu des bouteilles change
const KEY = `blachere-rendus-${RENDER_VERSION}`;
const snaps = readJSON(KEY, {}, 'session') || {};
let photos = {};
const ready = photoIndex().then((p) => (photos = p));
const webgl = typeof window !== 'undefined' && hasWebGL();

function src(slug) {
  return photos[slug]?.vignette || snaps[slug] || null;
}

export function thumbHTML(p, { eager = false } = {}) {
  const s = src(p.slug);
  if (s) return `<img class="thumb" src="${s}" alt="" ${eager ? '' : 'loading="lazy"'} decoding="async" />`;
  return `<span class="thumb thumb--svg" data-thumb="${p.slug}">${bottleSVG(p)}</span>`;
}

const queue = new Set();
let rendering = false;
let io = null;

async function flush() {
  if (rendering || !queue.size) return;
  rendering = true;
  const slugs = [...queue];
  queue.clear();
  try {
    const { renderThumbs } = await import('../three/snap.js');
    await renderThumbs(
      slugs.map((s) => bySlug[s]).filter(Boolean),
      (slug, url) => {
        snaps[slug] = url;
        writeJSON(KEY, snaps, 'session');
        swap(slug);
      },
    );
  } catch (err) {
    console.warn('Vignettes 3D indisponibles, illustrations conservées.', err);
  }
  rendering = false;
  if (queue.size) flush();
}

function swap(slug, root = document) {
  const s = src(slug);
  if (!s) return;
  root.querySelectorAll(`[data-thumb="${slug}"]`).forEach((el) => {
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
  const els = [...root.querySelectorAll('[data-thumb]')];
  els.forEach((el) => src(el.dataset.thumb) && swap(el.dataset.thumb, root));
  if (!webgl) return;
  io ||= new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        const slug = e.target.dataset.thumb;
        if (!slug || src(slug)) return swap(slug);
        queue.add(slug);
        clearTimeout(upgradeThumbs.t);
        upgradeThumbs.t = setTimeout(flush, 60);
      }),
    { rootMargin: '300px 0px' },
  );
  root.querySelectorAll('[data-thumb]').forEach((el) => io.observe(el));
}
