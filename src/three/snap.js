// Vignettes 3D des bouteilles dessinées en code (cartes de la boutique, panier) : chaque bouteille
// est rendue seule sur fond transparent, puis exportée en image. Un seul contexte WebGL, libéré
// après chaque série.
import * as THREE from 'three';
import { disposeObject } from './bottle.js';
import { makeBottle } from './factory.js';
import { studioEnvironment } from './textures.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export async function renderThumbs(products, onDone, { width = 360, height = 480 } = {}) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(width, height, false);
  r.setClearColor(0x000000, 0);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.NeutralToneMapping;
  r.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(r);
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(4, 6, 6);
  const rim = new THREE.DirectionalLight(0xfff2e0, 1.2);
  rim.position.set(-5, 2, -4);
  scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.25));
  const cam = new THREE.PerspectiveCamera(28, width / height, 0.1, 50);
  cam.position.set(0, 0.1, 7.4);
  cam.lookAt(0, 0, 0);
  try {
    for (const p of products) {
      const bottle = await makeBottle(p, { lite: true, anisotropy: 4 });
      // Légère rotation : on devine le volume (et, pour le PAC, la femme de l'étiquette).
      bottle.rotation.set(0.04, p.label === 'pac' ? 0.42 : 0.18, -0.03);
      scene.add(bottle);
      r.render(scene, cam);
      onDone(p.slug, r.domElement.toDataURL('image/webp', 0.86));
      scene.remove(bottle);
      disposeObject(bottle);
      await nextFrame();
    }
  } finally {
    scene.environment.dispose();
    r.dispose();
    r.forceContextLoss();
  }
}
