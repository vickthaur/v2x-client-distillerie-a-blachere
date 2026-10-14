// Textures procédurales (aucune image à télécharger).
import * as THREE from 'three';

export function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// Stries verticales (relief) : bouchons à vis.
export function stripesBump(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, size, 0);
  grad.addColorStop(0, '#000');
  grad.addColorStop(0.5, '#fff');
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Grain du bois (relief + couleur) : tête de bouchon de liège.
export function woodTextures(base = '#8a5a32', size = 256) {
  const rand = rng(11);
  const color = document.createElement('canvas');
  const bump = document.createElement('canvas');
  color.width = color.height = bump.width = bump.height = size;
  const g = color.getContext('2d');
  const b = bump.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  b.fillStyle = '#808080';
  b.fillRect(0, 0, size, size);
  for (let i = 0; i < 140; i++) {
    const x = rand() * size;
    const w = 0.6 + rand() * 2.4;
    const v = rand();
    g.fillStyle = `rgba(${v < 0.5 ? '40,22,10' : '190,140,90'},${0.08 + rand() * 0.18})`;
    g.fillRect(x, 0, w, size);
    b.fillStyle = `rgba(${v < 0.5 ? '0,0,0' : '255,255,255'},${0.2 + rand() * 0.3})`;
    b.fillRect(x, 0, w, size);
  }
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  return { map, bumpMap };
}

// Petites aspérités (peau du citron).
export function dimpleBump(size = 256, count = 1400, seed = 5) {
  const rand = rng(seed);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < count; i++) {
    const r = 1 + rand() * 2.2;
    g.fillStyle = `rgba(0,0,0,${0.15 + rand() * 0.25})`;
    g.beginPath();
    g.arc(rand() * size, rand() * size, r, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Environnement « studio photo » : les bandes lumineuses verticales dessinent les reflets nets du verre.
export function studioEnvironment(renderer) {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(20, 14, 20), new THREE.MeshBasicMaterial({ color: 0x2c2a2a, side: THREE.BackSide }));
  env.add(room);
  const panel = (w, h, intensity, x, y, z, tint = 0xffffff) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(intensity), side: THREE.DoubleSide }),
    );
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(1.4, 11, 7, -6, 0, 3); // bande principale gauche
  panel(0.8, 11, 5, 6.5, 0, 2); // bande droite
  panel(0.5, 11, 3, 3, 0, 7.5); // liseré avant
  panel(7, 10, 0.8, -4, 0, 8); // grande boîte à lumière douce
  panel(10, 4, 2.4, 0, 6.8, 0); // plafond
  panel(12, 3, 0.8, 0, -6.5, 0, 0xfff0dc); // rebond chaud au sol
  panel(4, 8, 0.7, 0, 0, -9, 0xe2ebff); // fond froid
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.015).texture;
  pmrem.dispose();
  env.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
  return tex;
}
