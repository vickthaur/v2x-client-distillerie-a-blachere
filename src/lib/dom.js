// Petits utilitaires DOM et texte.
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Comparaison sans accents ni majuscules (« creme » trouve « Crème »).
export const fold = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae');

export const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Sobriété : mouvement réduit, économiseur de données ou connexion très lente (2G). Ni 3D ni rendus
// faits à la volée : les vraies photos des bouteilles suffisent.
export function sobre() {
  const c = (typeof navigator !== 'undefined' && navigator.connection) || {};
  return calm() || c.saveData === true || /2g$/.test(c.effectiveType || '');
}

// Premier moment libre du navigateur (après le chargement de la page), sans attendre plus de « max » ms.
export const idle = (max = 1500) => new Promise((r) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(() => r(), { timeout: max }) : setTimeout(r, 200)));

// Résolue quand l'élément approche de l'écran (marge : 200 px au-dessus et au-dessous).
export function whenVisible(el, rootMargin = '200px 0px') {
  return new Promise((resolve) => {
    if (!el || !('IntersectionObserver' in window)) return resolve();
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        resolve();
      },
      { rootMargin },
    );
    io.observe(el);
  });
}

export function debounce(fn, ms = 150) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}
