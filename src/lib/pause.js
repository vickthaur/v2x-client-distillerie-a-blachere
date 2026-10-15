// Pause des animations 3D (A11Y-7, critère WCAG 2.2.2) : sur les campagnes (éléments qui flottent,
// bouteilles qui se balancent) et sur la bouteille des fiches de sirop (rotation lente), un bouton
// « Mettre l'animation en pause » fige la scène telle qu'elle est. Le choix est gardé dans le
// navigateur et vaut pour tout le site ; sans stockage (navigation privée), il vaut pour la page.
// En mouvement réduit, en économie de données ou en 2G, rien ne bouge (photos seules) : pas de bouton.
const CLE = 'blachere-animation';

export function pauseVoulue() {
  try {
    return localStorage.getItem(CLE) === 'pause';
  } catch {
    return false;
  }
}

function garder(pause) {
  try {
    if (pause) localStorage.setItem(CLE, 'pause');
    else localStorage.removeItem(CLE);
  } catch {
    /* stockage indisponible : le choix vaut pour la page */
  }
}

const PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6.5" y="5" width="4" height="14" rx="1.3"/><rect x="13.5" y="5" width="4" height="14" rx="1.3"/></svg>';
const LECTURE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8.5 6.1v11.8a1.1 1.1 0 0 0 1.67.94l9.5-5.9a1.1 1.1 0 0 0 0-1.88l-9.5-5.9A1.1 1.1 0 0 0 8.5 6.1z"/></svg>';

// Bouton bascule : nom fixe, état dans aria-pressed (enfoncé : animation en pause) ; l'icône montre
// ce que fait le prochain appui (pause, ou lecture pour reprendre).
//   scene : objet qui a pause(vrai | faux) et paused (HeroScene, BottleViewer) ; clair : bouton blanc
//   (fonds clairs : Couleur Provence, fiches), sinon verre fumé (campagnes PAC Citron, Fun Blue).
export function boutonPause(scene, { clair = false } = {}) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = clair ? 'anim-pause anim-pause--clair' : 'anim-pause';
  b.innerHTML = `${PAUSE}${LECTURE}<span class="sr-only">Mettre l’animation en pause</span>`;
  const maj = () => b.setAttribute('aria-pressed', String(!!scene.paused));
  b.addEventListener('click', () => {
    scene.pause(!scene.paused);
    garder(scene.paused);
    maj();
  });
  maj();
  return b;
}
