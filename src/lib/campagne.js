// Campagnes 3D (accueil, PAC Citron, Fun Blue, Couleur Provence) : l'affiche d'abord, la 3D en plus.
// - L'affiche : les vraies photos détourées des bouteilles (scripts/photos.mjs), posées dans le cadre
//   de la campagne dès le HTML (premier affichage, élément LCP découvert tout de suite). Elle reste
//   seule sans WebGL, en mouvement réduit, en économie de données, en 2G, ou si la 3D échoue :
//   jamais de cadre vide.
// - La 3D (three.js, plateau, garnitures) n'est chargée que quand le cadre est à l'écran, au premier
//   moment libre du navigateur ; elle remplace l'affiche en fondu une fois sa première image dessinée.
import { clamp, hasWebGL, idle, sobre, whenVisible } from './dom.js';
import { faceURL } from './thumbs.js';
import { boutonPause, pauseVoulue } from './pause.js';

const TEST = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');

// Affiche (utilisée si le HTML de la page ne la porte pas déjà).
export const afficheHTML = (slugs) =>
  `<div class="poster poster--${slugs.length}">${slugs.map((s) => `<span class="poster__b"><img src="${faceURL(s)}" alt="" width="287" height="1024" fetchpriority="high" decoding="async" /></span>`).join('')}</div>`;

// hero : la section ; stage : le cadre des bouteilles ; canvas : le canvas de la 3D ;
// scene : 'duo' | 'pac' | 'funblue' | 'provence' (src/three/hero.js) ; products : les produits posés.
export async function monterCampagne({ hero, stage, canvas, scene, products }) {
  if (!hero || !stage || !canvas) return null;
  if (!stage.querySelector('.poster')) stage.insertAdjacentHTML('afterbegin', afficheHTML(products.map((p) => p.slug)));
  if (sobre() || !hasWebGL()) {
    hero.classList.add('is-static');
    return null;
  }
  await whenVisible(stage);
  await idle();
  try {
    const { HeroScene } = await import('../three/hero.js');
    const s = new HeroScene(canvas, { scene, products, target: () => stage.getBoundingClientRect(), pause: pauseVoulue() });
    window.__hero = s;
    await s.shown;
    hero.classList.add('is-live');
    // « Mettre l'animation en pause » (A11Y-7) : dans la case du cadre des bouteilles, en bas à droite
    // (le cadre lui-même est masqué aux lecteurs d'écran : le bouton est placé à côté, voir home.css)
    stage.after(boutonPause(s, { clair: scene === 'provence' }));
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
