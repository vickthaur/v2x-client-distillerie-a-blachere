// Rendus produit (« packshots ») :
// - une bouteille sur fond neutre (cartes, recherche, panier) : la vraie photo détourée, traitée par
//   scripts/photos.mjs à un chemin connu d'avance (public/bouteilles/<slug>/vignette.webp). Elle est
//   posée tout de suite, en loading="lazy" (téléchargée seulement à l'approche de l'écran), sans
//   attendre l'index des photos ; l'affiche des fiches prend la photo de face, plus fine ;
// - une photo de groupe ou un fond de couleur (menus, cartes de marque) : le rendu 3D des bouteilles
//   tirées des photos, pré-calculé (public/rendus, scripts/rendus.mjs, src/data/rendus.json) ; à
//   défaut, fait à la demande quand l'image devient visible et gardé pour la session, jamais en
//   mouvement réduit, en économie de données ou en 2G. En attendant, ou sans WebGL, les photos
//   détourées côte à côte sur le même fond.
// Jamais d'illustration dessinée.
// - bg  : couleur du plateau (fond neutre des cartes par défaut, aplat de marque dans les menus) ;
// - fmt : 'portrait' (3:4, cartes), 'paysage' (4:3, menus) ou 'carte' (cartes de marque de l'accueil).
import { bySlug } from '../data/products.js';
import rendus from '../data/rendus.json';
import { esc, hasWebGL, idle, sobre } from './dom.js';
import { readJSON, writeJSON } from './store.js';

export const RENDER_VERSION = 13; // à incrémenter quand le rendu des bouteilles change (et relancer scripts/rendus.mjs)
const KEY = `blachere-rendus-${RENDER_VERSION}`;
const snaps = readJSON(KEY, {}, 'session') || {};
// carte : cartes de marque de l'accueil (3:4,1), bouteilles dans le haut, sol sous le texte
export const FORMATS = { portrait: [420, 560], paysage: [640, 480], carte: [420, 575] };
export const renderKey = (slugs, bg, fmt) => `${slugs.join('+')}|${bg}|${fmt}`;
const key = renderKey;

// Chemins écrits par scripts/photos.mjs pour chaque produit.
export const vignetteURL = (slug) => `/bouteilles/${slug}/vignette.webp`;
export const faceURL = (slug) => `/bouteilles/${slug}/face.webp`;

// WebGL n'est testé qu'au premier rendu à faire (pas à chaque chargement de page).
let gl = null;
const webgl = () => (gl ??= typeof window !== 'undefined' && hasWebGL());

// Rendu pré-calculé au même numéro de version : { src, srcset, w, h }.
const prerendu = (k) => (rendus.version === RENDER_VERSION && rendus.images?.[k]) || null;

function groupSrc(slugs, bg, fmt) {
  const k = key(slugs, bg, fmt);
  return prerendu(k)?.src || snaps[k] || null;
}

const imgHTML = (url, { alt = '', w = 0, h = 0, eager = false, srcset = '', cls = 'thumb' } = {}) =>
  `<img class="${cls}" src="${url}"${srcset ? ` srcset="${srcset}"` : ''} alt="${esc(alt)}"${w ? ` width="${w}" height="${h}"` : ''} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />`;

const photosOf = (list) => list.map((s) => imgHTML(vignetteURL(s), { w: 135, h: 480, cls: '' }).replace(' class=""', '')).join('');

export function renderHTML(slugs, { eager = false, bg = '', fmt = 'portrait', alt = '' } = {}) {
  const list = slugs.filter((s) => bySlug[s]);
  // Une bouteille sur fond neutre : la photo détourée (photo de face pour l'affiche d'une fiche).
  if (list.length === 1 && !bg && fmt === 'portrait')
    return eager ? imgHTML(faceURL(list[0]), { alt, w: 287, h: 1024, eager, cls: 'thumb thumb--photo' }) : imgHTML(vignetteURL(list[0]), { alt, w: 135, h: 480, cls: 'thumb thumb--photo' });
  const k = key(list, bg, fmt);
  const pre = prerendu(k);
  if (pre) return imgHTML(pre.src, { alt, w: pre.w, h: pre.h, eager, srcset: pre.srcset });
  if (snaps[k]) return imgHTML(snaps[k], { alt, eager });
  return `<span class="thumb thumb--wait thumb--n${list.length}" data-shot="${list.join(' ')}" data-bg="${bg}" data-fmt="${fmt}"${bg ? ` style="background:${bg}"` : ''}>${photosOf(list)}</span>`;
}

export const thumbHTML = (p, opts = {}) => renderHTML([p.slug], opts);

// Photo absente (produit sans photo traitée) : jamais d'image cassée ; la vignette laisse la place
// au fond neutre, la photo manquante d'un groupe est retirée.
if (typeof document !== 'undefined')
  document.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (img?.tagName !== 'IMG' || !/\/bouteilles\//.test(img.getAttribute('src') || '')) return;
      if (img.classList.contains('thumb')) {
        const box = document.createElement('span');
        box.className = 'thumb thumb--wait thumb--n1';
        img.replaceWith(box);
      } else if (img.parentElement?.classList.contains('thumb--wait')) img.remove();
    },
    true,
  );

const queue = new Map();
let rendering = false;
let io = null;

async function flush() {
  if (rendering || !queue.size) return;
  rendering = true;
  await idle();
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
    console.warn('Rendus 3D indisponibles, photos conservées.', err);
  }
  rendering = false;
  if (queue.size) flush();
}

const jobOf = (el) => ({ slugs: el.dataset.shot.split(' ').filter(Boolean), bg: el.dataset.bg || '', fmt: el.dataset.fmt || 'portrait' });

function swap(job, root = document) {
  const s = groupSrc(job.slugs, job.bg, job.fmt);
  if (!s) return;
  const pre = prerendu(key(job.slugs, job.bg, job.fmt));
  root.querySelectorAll('[data-shot]').forEach((el) => {
    const j = jobOf(el);
    if (key(j.slugs, j.bg, j.fmt) !== key(job.slugs, job.bg, job.fmt)) return;
    const img = new Image();
    img.className = 'thumb is-new';
    img.alt = '';
    img.decoding = 'async';
    img.loading = 'lazy'; // avant src : rien n'est téléchargé hors de l'écran
    if (pre?.srcset) img.srcset = pre.srcset;
    img.src = s;
    img.onload = () => el.replaceWith(img);
  });
}

// Rendus de groupe en attente : le rendu pré-calculé ou de la session s'il existe, sinon les photos
// côte à côte, puis (WebGL, sans économie) un rendu 3D fait quand le bloc devient visible.
export function upgradeThumbs(root = document) {
  const waits = [...root.querySelectorAll('[data-shot]')];
  if (!waits.length) return;
  waits.forEach((el) => {
    const j = jobOf(el);
    if (groupSrc(j.slugs, j.bg, j.fmt)) swap(j, root);
    else if (!el.children.length) el.innerHTML = photosOf(j.slugs);
  });
  if (sobre() || !webgl()) return;
  io ||= new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        if (!e.target.dataset.shot) return;
        const j = jobOf(e.target);
        if (groupSrc(j.slugs, j.bg, j.fmt)) return swap(j);
        queue.set(key(j.slugs, j.bg, j.fmt), j);
        clearTimeout(upgradeThumbs.t);
        upgradeThumbs.t = setTimeout(flush, 60);
      }),
    { rootMargin: '300px 0px' },
  );
  waits.forEach((el) => el.isConnected && el.dataset.shot && io.observe(el));
}
