// Bouteille en verre construite en code (quand il n'y a pas encore de photo du produit) :
// silhouette tournée (LatheGeometry), liquide coloré à l'intérieur (trouble pour le PAC),
// étiquette enroulée dessinée sur un canvas, bouchon (vis, capsule ou liège).
import * as THREE from 'three';
import { shapes, shapeHeight } from '../data/shapes.js';
import { drawLabel, drawCapLabel, LABEL_W } from './labels.js';
import { stripesBump, woodTextures } from './textures.js';

export const BOTTLE_HEIGHT = 3.2; // hauteur commune de toutes les bouteilles (unités de scène)
const WALL = 2.4; // épaisseur du verre (mm)
const BASE = 6; // fond épais (mm)

// Profil lissé (Catmull-Rom centripète : pas de dépassement dans les angles).
function smoothProfile(pts, segments = 220) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([r, y]) => new THREE.Vector3(r, y, 0)), false, 'centripetal');
  return curve.getPoints(segments).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
}

// Rayon extérieur à la hauteur y (sur la partie montante du profil).
function radiusAt(profile, y) {
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i];
    const b = profile[i + 1];
    if (y >= a.y && y <= b.y && b.y > a.y) return a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
  }
  return profile[profile.length - 1].x;
}

const geometryCache = new Map();
function geometries(shapeName, lite) {
  const key = `${shapeName}:${lite}`;
  if (geometryCache.has(key)) return geometryCache.get(key);
  const s = shapes[shapeName] || shapes.sirop;
  const H = shapeHeight(s);
  const k = BOTTLE_HEIGHT / H; // mm → unités
  const Y0 = H / 2;
  const seg = lite ? 64 : 96;
  const v = (r, y) => new THREE.Vector2(r * k, (y - Y0) * k);

  const outer = smoothProfile(s.pts);
  const glass = new THREE.LatheGeometry(outer.map((p) => v(p.x, p.y)), seg);

  // Liquide : intérieur du verre jusqu'au niveau de remplissage, surface plane.
  const top = s.fillTop;
  const liquidPts = [v(0, BASE)];
  for (let y = BASE; y <= top; y += 1.5) liquidPts.push(v(Math.max(0.1, radiusAt(outer, y) - WALL), y));
  liquidPts.push(v(Math.max(0.1, radiusAt(outer, top) - WALL - 0.6), top + 0.4), v(0, top + 0.4));
  const liquid = new THREE.LatheGeometry(liquidPts, seg);

  // Étiquette : cylindre ouvert, juste au-dessus du verre.
  const [l0, l1] = s.label;
  const lr = (s.body + 0.45) * k;
  const lh = (l1 - l0) * k;
  const label = new THREE.CylinderGeometry(lr, lr, lh, seg, 1, true, Math.PI / 2);
  label.translate(0, ((l0 + l1) / 2) * k - Y0 * k, 0);
  const labelCanvasH = Math.round((LABEL_W * lh) / (2 * Math.PI * lr));

  // Géométries partagées entre bouteilles de même forme : jamais libérées.
  [glass, liquid, label].forEach((geo) => (geo.userData.shared = true));
  const out = { glass, liquid, label, labelCanvasH, k, Y0, outer, s };
  geometryCache.set(key, out);
  return out;
}

function closureGeometry(s, outer, kind, k, Y0, seg) {
  const v = (r, y) => new THREE.Vector2(r * k, (y - Y0) * k);
  const [y0, y1, R] = s.closure;
  if (kind === 'screw') {
    return new THREE.LatheGeometry([v(s.neck - 0.4, y0), v(R - 0.6, y0), v(R, y0 + 0.8), v(R, y1 - 2.2), v(R - 0.5, y1 - 0.6), v(R - 2, y1), v(0, y1)], seg);
  }
  if (kind === 'cork') {
    return new THREE.LatheGeometry([v(s.neck - 1, y0), v(R - 1, y0), v(R, y0 + 1.2), v(R, y1 - 2), v(R - 1.6, y1 - 0.2), v(R - 4, y1), v(0, y1)], seg);
  }
  // Capsule : épouse le col et la bague, avec un petit bourrelet en bas.
  const pts = [v(radiusAt(outer, y0) + 0.2, y0 - 0.2), v(radiusAt(outer, y0) + 1.1, y0 + 0.6)];
  for (let y = y0 + 2; y < s.lip - 1; y += 2) pts.push(v(radiusAt(outer, Math.min(y, s.lip - 3)) + 0.75, y));
  pts.push(v(R, s.lip - 0.8), v(R - 1, s.lip + 1.2), v(0, s.lip + 1.4));
  return new THREE.LatheGeometry(pts, seg);
}

// Verre : transparent, plus opaque sur les bords (Fresnel) et dans les reflets.
export function glassMaterial(tint = '#ffffff') {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(tint).multiplyScalar(0.06),
    metalness: 0,
    roughness: 0.04,
    transparent: true,
    opacity: 0.06,
    depthWrite: false,
    envMapIntensity: 1.6,
    specularIntensity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
  });
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.2);
       float lum = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
       diffuseColor.a = clamp(diffuseColor.a + fres * 0.42 + lum * 1.1, 0.0, 1.0);
       #include <opaque_fragment>`,
    );
  };
  m.customProgramCacheKey = () => 'glass-fresnel';
  return m;
}

let shared = null;
function sharedTextures() {
  if (shared) return shared;
  const stripes = stripesBump();
  stripes.repeat.set(70, 1);
  shared = { stripes, wood: woodTextures() };
  [stripes, shared.wood.map, shared.wood.bumpMap].forEach((tex) => (tex.userData.shared = true));
  return shared;
}

export function createBottle(product, { lite = false, anisotropy = 8 } = {}) {
  const b = product.bottle;
  const G = geometries(b.shape, lite);
  const t = sharedTextures();

  // Liquide : vrai volume coloré (transmission) ; trouble (PAC) ou version simple : opaque.
  const liquidColor = new THREE.Color(b.liquid);
  const liquid =
    lite || b.cloudy
      ? new THREE.MeshPhysicalMaterial({
          color: liquidColor,
          roughness: b.cloudy ? 0.35 : 0.18,
          metalness: 0,
          emissive: liquidColor,
          emissiveIntensity: b.cloudy ? 0.28 : 0.18,
          sheen: b.cloudy ? 0.6 : 0,
          sheenColor: new THREE.Color('#ffffff'),
        })
      : new THREE.MeshPhysicalMaterial({
          color: liquidColor.clone().lerp(new THREE.Color('#ffffff'), 0.3),
          roughness: 0.06,
          metalness: 0,
          transmission: 0.92,
          thickness: G.s.body * 2 * G.k,
          ior: 1.36,
          attenuationColor: liquidColor,
          attenuationDistance: 1.2,
          specularIntensity: 0.7,
          envMapIntensity: 1.2,
          emissive: liquidColor,
          emissiveIntensity: 0.1,
        });

  const map = new THREE.CanvasTexture(drawLabel(product, G.labelCanvasH));
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = anisotropy;
  const glossy = product.label === 'pac' || product.label === 'funblue';
  const labelMat = new THREE.MeshPhysicalMaterial({
    map,
    emissive: '#ffffff',
    emissiveMap: map,
    emissiveIntensity: glossy ? 0.2 : 0.14,
    roughness: glossy ? 0.32 : 0.8,
    metalness: 0,
    clearcoat: glossy ? 0.8 : 0,
    clearcoatRoughness: 0.12,
    sheen: glossy ? 0 : 0.4,
    sheenColor: new THREE.Color('#fff4dd'),
  });

  let closureMat;
  const capCanvas = drawCapLabel(product);
  if (capCanvas) {
    const capMap = new THREE.CanvasTexture(capCanvas);
    capMap.colorSpace = THREE.SRGBColorSpace;
    capMap.anisotropy = anisotropy;
    closureMat = new THREE.MeshPhysicalMaterial({ map: capMap, roughness: 0.3, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.2, emissive: '#ffffff', emissiveMap: capMap, emissiveIntensity: 0.12 });
  } else if (b.closure === 'screw') {
    closureMat = new THREE.MeshPhysicalMaterial({ color: b.cap, roughness: 0.32, metalness: 0, bumpMap: t.stripes, bumpScale: 1.2, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  } else if (b.closure === 'cork') {
    closureMat = new THREE.MeshStandardMaterial({ map: t.wood.map, bumpMap: t.wood.bumpMap, bumpScale: 1.5, color: '#ffffff', roughness: 0.78, metalness: 0 });
  } else {
    closureMat = new THREE.MeshStandardMaterial({ color: b.cap, roughness: 0.3, metalness: 0.75, envMapIntensity: 1.4 });
  }

  const closure = closureGeometry(G.s, G.outer, b.closure, G.k, G.Y0, lite ? 48 : 72);
  const group = new THREE.Group();
  const glass = new THREE.Mesh(G.glass, glassMaterial());
  glass.renderOrder = 5;
  group.add(new THREE.Mesh(G.liquid, liquid), new THREE.Mesh(G.label, labelMat), new THREE.Mesh(closure, closureMat), glass);
  group.userData = { slug: product.slug, kind: 'dessinée', seed: Math.random() * 10, appear: 0, height: BOTTLE_HEIGHT };
  return group;
}

export function disposeObject(obj) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.geometry?.userData?.shared) o.geometry?.dispose?.();
    [].concat(o.material).forEach((m) => {
      if (!m) return;
      ['map', 'emissiveMap', 'bumpMap'].forEach((k) => !m[k]?.userData?.shared && m[k]?.dispose?.());
      m.uniforms?.photoFront?.value?.dispose?.();
      m.uniforms?.photoBack?.value?.dispose?.();
      m.dispose();
    });
  });
}
