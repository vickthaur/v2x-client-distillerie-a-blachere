// Campagnes 3D (accueil, PAC Citron, Fun Blue, Couleur Provence) : l'affiche d'abord, la 3D en plus.
// - L'affiche : les vraies photos détourées des bouteilles (scripts/photos.mjs), posées dans le cadre
//   de la campagne dès le HTML (premier affichage, élément LCP découvert tout de suite). Elle reste
//   seule sans WebGL, en mouvement réduit, en économie de données, en 2G, ou si la 3D échoue :
//   jamais de cadre vide.
// - La 3D (three.js, plateau, garnitures) n'est chargée que quand le cadre est à l'écran, au premier
//   moment libre du navigateur ; elle remplace l'affiche en fondu une fois sa première image dessinée.
import { clamp, hasWebGL, idle, sobre } from './dom.js';
import { faceURL } from './thumbs.js';

const TEST = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');

// Affiche (utilisée si le HTML de la page ne la porte pas déjà).
export const afficheHTML = (slugs) =>
  `<div class="poster poster--${slugs.length}">${slugs.map((s) => `<span class="poster__b"><img src="${faceURL(s)}" alt="" width="287" height="1024" fetchpriority="high" decoding="async" /></span>`).join('')}</div>`;

// Résolue quand l'élément approche de l'écran.
function visible(el) {
  return new Promise((resolve) => {
    if (!('IntersectionObserver' in window)) return resolve();
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        resolve();
      },
      { rootMargin: '200px 0px' },
    );
    io.observe(el);
  });
}

// hero : la section ; stage : le cadre des bouteilles ; canvas : le canvas de la 3D ;
// scene : 'duo' | 'pac' | 'funblue' | 'provence' (src/three/hero.js) ; products : les produits posés.
export async function monterCampagne({ hero, stage, canvas, scene, products }) {
  if (!hero || !stage || !canvas) return null;
  if (!stage.querySelector('.poster')) stage.insertAdjacentHTML('afterbegin', afficheHTML(products.map((p) => p.slug)));
  if (sobre() || !hasWebGL()) {
    hero.classList.add('is-static');
    return null;
  }
  await visible(stage);
  await idle();
  try {
    const { HeroScene } = await import('../three/hero.js');
    const s = new HeroScene(canvas, { scene, products, target: () => stage.getBoundingClientRect() });
    window.__hero = s;
    await s.shown;
    hero.classList.add('is-live');
    // défilement : les éléments montent et les bouteilles tournent un peu, au rythme de la page
    const onScroll = () => s.setScroll(clamp(scrollY / Math.max(hero.offsetHeight, 1), 0, 1));
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    if (TEST) setTimeout(() => (window.__heroReady = true), 600);
    return s;
  } catch (err) {
    console.warn('3D indisponible, photos des bouteilles affichées.', err);
    hero.classList.add('is-static');
    return null;
  }
}
