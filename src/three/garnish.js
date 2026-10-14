// Éléments en volume qui flottent autour de la bouteille active (un nuage par produit) :
// citrons, menthe, glaçons, badiane, armoise, origan, carrés de chocolat, raisin et feuille de vigne.
// Structure reprise des fruits de Fruitzz.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { artCanvas } from '../lib/garnishArt.js';
import { dimpleBump } from './textures.js';

// Emplacements autour de la bouteille : x, y, z, échelle (repère de la bouteille, avant inclinaison).
const SLOTS = [
  [-1.55, 1.05, 0.75, 0.78],
  [1.5, 1.3, -0.5, 0.64],
  [-1.3, -0.95, 1.05, 0.66],
  [1.55, -0.6, 0.95, 0.8],
  [-0.55, 1.95, -0.9, 0.5],
  [0.95, -1.75, -0.7, 0.56],
  [-2.0, 0.1, -1.2, 0.54],
  [2.05, 0.4, 1.35, 0.48],
];

let lite = false;
const textures = new Map();
function texture(name) {
  if (!textures.has(name)) {
    const t = new THREE.CanvasTexture(artCanvas(name));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    textures.set(name, t);
  }
  return textures.get(name);
}

// Aspect humide et brillant (vernis + léger éclat interne).
function juicy(params) {
  const { glow, ...rest } = params;
  const base = { roughness: 0.32, metalness: 0, ...rest };
  if (glow) {
    base.emissive = new THREE.Color(glow);
    base.emissiveIntensity = 0.12;
  }
  if (lite) {
    const { sheen, sheenColor, clearcoat, clearcoatRoughness, ...std } = base;
    return new THREE.MeshStandardMaterial(std);
  }
  return new THREE.MeshPhysicalMaterial({ clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.3, sheenColor: new THREE.Color('#ffffff'), ...base });
}

const cache = {};
const once = (k, fn) => (cache[k] ||= fn());

// Tranche de citron épaisse : faces dessinées, tranche couleur écorce.
function lemonSlice() {
  const geo = once('slice', () => new THREE.CylinderGeometry(0.5, 0.5, 0.15, 56, 1));
  const face = juicy({ map: texture('lemon') });
  const side = juicy({ color: '#f5d90a', roughness: 0.5 });
  return new THREE.Mesh(geo, [side, face, face]);
}

// Citron entier : ellipsoïde à bouts pointus, peau grenue.
function lemon() {
  const geo = once('lemon', () => {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const y = -0.5 + t;
      const r = 0.36 * Math.pow(Math.sin(Math.PI * t), 0.82) + (t < 0.06 || t > 0.94 ? 0.012 : 0);
      pts.push(new THREE.Vector2(r, y));
    }
    return new THREE.LatheGeometry(pts, 40);
  });
  const bump = once('dimples', () => {
    const t = dimpleBump();
    t.repeat.set(4, 3);
    return t;
  });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, juicy({ color: '#f7d417', roughness: 0.42, bumpMap: bump, bumpScale: 0.6, glow: '#ffcc00' })));
  const leaf = new THREE.Mesh(once('leafPlane', () => bentLeaf()), juicy({ map: texture('mint'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5 }));
  leaf.scale.setScalar(0.5);
  leaf.position.set(0.12, 0.52, 0);
  leaf.rotation.set(0.4, 0, -0.9);
  g.add(leaf);
  return g;
}

// Feuille incurvée générique (texture dessinée + alphaTest).
function bentLeaf() {
  const p = new THREE.PlaneGeometry(1, 1, 16, 16);
  const pos = p.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, 0.16 * Math.cos(Math.PI * x) - 0.12 * y * y);
  }
  p.computeVertexNormals();
  return p;
}

function leaf(name, roughness = 0.45) {
  return new THREE.Mesh(
    once('leafPlane', () => bentLeaf()),
    juicy({ map: texture(name), alphaTest: 0.5, side: THREE.DoubleSide, roughness }),
  );
}

// Glaçon : cube arrondi transparent.
function ice() {
  const geo = once('ice', () => new RoundedBoxGeometry(0.42, 0.42, 0.42, 4, 0.07));
  const mat = lite
    ? new THREE.MeshStandardMaterial({ color: '#dff6ff', roughness: 0.08, transparent: true, opacity: 0.55 })
    : new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.22, transmission: 0.92, thickness: 0.18, ior: 1.31, specularIntensity: 1, envMapIntensity: 1.6, emissive: '#d8f3ff', emissiveIntensity: 0.12 });
  return new THREE.Mesh(geo, mat);
}

// Badiane (anis étoilé) : huit carpelles en étoile, une graine brillante dans chacune.
function anise() {
  const g = new THREE.Group();
  const pod = once('pod', () => new THREE.SphereGeometry(0.5, 20, 12).scale(0.44, 0.1, 0.12));
  const seed = once('aniseSeed', () => new THREE.SphereGeometry(0.045, 12, 8).scale(1.4, 0.8, 0.9));
  // Écorce mate et sèche (pas de vernis « juteux »), graine brillante.
  const podMat = new THREE.MeshStandardMaterial({ color: '#5e2f16', roughness: 0.92, metalness: 0 });
  const seedMat = new THREE.MeshStandardMaterial({ color: '#b07a45', roughness: 0.3, metalness: 0 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const p = new THREE.Mesh(pod, podMat);
    p.position.set(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2);
    p.rotation.y = -a;
    g.add(p);
    const s = new THREE.Mesh(seed, seedMat);
    s.position.set(Math.cos(a) * 0.22, 0.06, Math.sin(a) * 0.22);
    s.rotation.y = -a;
    g.add(s);
  }
  const core = new THREE.Mesh(once('core', () => new THREE.CylinderGeometry(0.05, 0.06, 0.12, 12)), podMat);
  g.add(core);
  g.scale.setScalar(0.95);
  return g;
}

// Brin d'herbe aromatique : tige et feuilles dessinées.
function sprig(name, count, size) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(once('stem', () => new THREE.CylinderGeometry(0.012, 0.018, 1.1, 8)), juicy({ color: '#6f8a4a', roughness: 0.6 }));
  g.add(stem);
  for (let i = 0; i < count; i++) {
    const l = leaf(name);
    const t = i / (count - 1);
    l.scale.setScalar(size * (1 - t * 0.35));
    const side = i % 2 ? 1 : -1;
    l.position.set(side * size * 0.32, -0.45 + t * 0.95, 0);
    l.rotation.set(0.3, side * 0.4, side * -0.9);
    g.add(l);
  }
  return g;
}

// Carré de chocolat.
function chocolate() {
  const geo = once('choco', () => new RoundedBoxGeometry(0.46, 0.46, 0.16, 3, 0.04));
  return new THREE.Mesh(geo, juicy({ color: '#3a1c12', roughness: 0.38 }));
}

// Petite grappe de raisin noir (pruine claire).
function grape() {
  const g = new THREE.Group();
  const geo = once('berry', () => new THREE.SphereGeometry(1, 28, 20));
  const mat = juicy({ color: '#3b1838', roughness: 0.35, sheen: 0.6, sheenColor: new THREE.Color('#b6a3c9') });
  const rows = [
    [4, 0.2, 0.17],
    [3, 0.02, 0.15],
    [3, -0.15, 0.12],
    [2, -0.3, 0.08],
    [1, -0.42, 0],
  ];
  rows.forEach(([n, y, r], j) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + j;
      const b = new THREE.Mesh(geo, mat);
      b.scale.setScalar(0.11);
      b.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      g.add(b);
    }
  });
  const stem = new THREE.Mesh(once('stem', () => new THREE.CylinderGeometry(0.012, 0.018, 1.1, 8)), juicy({ color: '#6b5a2e', roughness: 0.7 }));
  stem.scale.set(1, 0.3, 1);
  stem.position.y = 0.38;
  g.add(stem);
  g.scale.setScalar(1.3);
  return g;
}

function buildPiece(name) {
  switch (name) {
    case 'lemonSlice':
      return lemonSlice();
    case 'lemon':
      return lemon();
    case 'mint':
      return leaf('mint');
    case 'ice':
      return ice();
    case 'anise':
      return anise();
    case 'armoise':
      return sprig('armoise', 4, 0.5);
    case 'origan':
      return sprig('origan', 6, 0.26);
    case 'chocolate':
      return chocolate();
    case 'grape':
      return grape();
    case 'vineLeaf':
      return leaf('vineLeaf', 0.5);
    default:
      return new THREE.Group();
  }
}

const LEAFY = new Set(['mint', 'vineLeaf', 'armoise', 'origan']);

export function createGarnish(product, isLite) {
  lite = isLite;
  const group = new THREE.Group();
  const count = isLite ? 5 : SLOTS.length;
  const pieces = [];
  for (let i = 0; i < count; i++) {
    const [x, y, z, s] = SLOTS[i];
    const name = product.garnish[i % product.garnish.length];
    const pivot = new THREE.Group();
    pivot.add(buildPiece(name));
    pivot.position.set(x, y, z);
    pivot.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    group.add(pivot);
    pieces.push({
      pivot,
      base: new THREE.Vector3(x, y, z),
      scale: s,
      phase: Math.random() * Math.PI * 2,
      leaf: LEAFY.has(name),
      tilt: pivot.rotation.clone(),
      spin: new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.5),
      delay: i * 0.06,
    });
  }
  group.userData = { pieces, appear: 0 };
  group.visible = false;
  return group;
}

const easeOutBack = (t) => 1 + 2.5 * Math.pow(t - 1, 3) + 1.5 * Math.pow(t - 1, 2);

// Le nuage suit sa bouteille et apparaît (ou disparaît) en cascade.
export function updateGarnish(group, { t, dt, target, anchor, scale, spread, calm }) {
  const u = group.userData;
  u.appear += (target - u.appear) * (1 - Math.pow(0.02, dt));
  group.visible = u.appear > 0.01;
  if (!group.visible) return;
  group.position.copy(anchor);
  group.scale.setScalar(scale);
  const m = calm ? 0.25 : 1;
  for (const p of u.pieces) {
    const k = Math.min(1, Math.max(0, (u.appear - p.delay) / (1 - p.delay)));
    const s = p.scale * (target ? easeOutBack(k) : k);
    p.pivot.scale.setScalar(Math.max(s, 0.0001));
    p.pivot.position.set(
      p.base.x * spread + Math.sin(t * 0.6 + p.phase) * 0.12 * m,
      p.base.y * spread + Math.sin(t * 0.9 + p.phase) * 0.16 * m,
      p.base.z,
    );
    if (p.leaf) {
      p.pivot.rotation.x = p.tilt.x * 0.2 + Math.sin(t * 0.7 + p.phase) * 0.4 * m;
      p.pivot.rotation.y = p.tilt.y * 0.2 + Math.sin(t * 0.5 + p.phase) * 0.5 * m;
      p.pivot.rotation.z += p.spin.z * dt * m;
    } else {
      p.pivot.rotation.x += p.spin.x * dt * m;
      p.pivot.rotation.y += p.spin.y * dt * m;
      p.pivot.rotation.z += p.spin.z * dt * m;
    }
  }
}
