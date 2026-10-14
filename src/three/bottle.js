// Bouteille 3D construite en code (quand il n'y a pas encore de photo du produit), rendue comme un
// packshot : verre physique (transmission, indice 1,5, légères irrégularités), liquide intérieur
// (transmission et absorption de la couleur, trouble pour le PAC), étiquette de face et
// contre-étiquette en papier ou en film pelliculé (grain, relief, vernis), bouchon en plastique
// moleté, capsule métallique ou bouchon de liège.
// L'étiquette de face vient de la photo déroulée quand elle existe (public/etiquettes, voir
// scripts/photos.mjs), sinon du dessin (labels.js).
import * as THREE from 'three';
import { shapes, shapeHeight } from '../data/shapes.js';
import { drawFront, drawBack, drawCapPrint, LABELS } from './labels.js';
import { paperTextures, filmNormal, glassTextures, knurlNormal, brushedNormal, canvas, rng } from './tex.js';

export const BOTTLE_HEIGHT = 3.2; // hauteur commune de toutes les bouteilles (unités de scène)
const WALL = 2.6; // épaisseur du verre (mm)
const BASE = 7; // fond épais (mm)

// Profil lissé (Catmull-Rom centripète : pas de dépassement dans les angles).
function smoothProfile(pts, segments = 280) {
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([r, y]) => new THREE.Vector3(r, y, 0)),
    false,
    'centripetal',
  );
  return curve.getPoints(segments).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
}

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
  const s = shapes[shapeName] || shapes.pac1l;
  const H = shapeHeight(s);
  const k = BOTTLE_HEIGHT / H; // mm → unités
  const Y0 = H / 2;
  const seg = lite ? 64 : 112;
  const v = (r, y) => new THREE.Vector2(r * k, (y - Y0) * k);
  const outer = smoothProfile(s.pts);
  const glass = new THREE.LatheGeometry(
    outer.map((p) => v(p.x, p.y)),
    seg,
  );
  // Liquide : intérieur du verre jusqu'au niveau de remplissage, surface plane (léger ménisque).
  const top = s.fillTop;
  const pts = [v(0, BASE)];
  for (let y = BASE; y <= top; y += 1.2) pts.push(v(Math.max(0.1, radiusAt(outer, y) - WALL), y));
  const rt = Math.max(0.1, radiusAt(outer, top) - WALL);
  pts.push(v(rt * 0.97, top + 0.5), v(rt * 0.6, top + 0.6), v(0, top + 0.6));
  const liquid = new THREE.LatheGeometry(pts, seg);
  [glass, liquid].forEach((g) => (g.userData.shared = true));
  const out = { glass, liquid, k, Y0, H, outer, s, seg };
  geometryCache.set(key, out);
  return out;
}

// Morceau de cylindre (étiquette) : angle de début et longueur en radians, centré en y.
function labelPatch(radius, height, y, start, length, seg) {
  const g = new THREE.CylinderGeometry(radius, radius, height, Math.max(8, Math.round((seg * length) / (Math.PI * 2))), 1, true, start, length);
  g.translate(0, y, 0);
  return g;
}

// ------------------------------------------------------------------ matériaux

export function glassMaterial({ lite = false, tint = '#f1f7f2' } = {}) {
  const t = glassTextures();
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: lite ? 0.06 : 0.1,
    roughnessMap: lite ? null : t.roughness,
    normalMap: lite ? null : t.normal,
    normalScale: new THREE.Vector2(0.12, 0.12),
    transmission: 1,
    thickness: 0.035,
    ior: 1.5,
    attenuationColor: new THREE.Color(tint),
    attenuationDistance: 0.6,
    specularIntensity: 1,
    envMapIntensity: 1.2,
    side: THREE.DoubleSide,
  });
}

function liquidMaterial(b, G) {
  const color = new THREE.Color(b.liquid);
  const diameter = G.s.body * 2 * G.k;
  if (b.cloudy) {
    // Sirop trouble (PAC, orgeat) : laiteux, la lumière passe mais floue.
    return new THREE.MeshPhysicalMaterial({
      color: color.clone(),
      metalness: 0,
      roughness: 0.6,
      transmission: 0.45,
      thickness: diameter,
      ior: 1.36,
      attenuationColor: color.clone(),
      attenuationDistance: diameter * 0.8,
      specularIntensity: 0.3,
      envMapIntensity: 0.55,
      side: THREE.DoubleSide,
    });
  }
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.04,
    transmission: 1,
    thickness: diameter,
    ior: 1.36,
    attenuationColor: color.clone(),
    attenuationDistance: diameter * 0.85,
    specularIntensity: 0.3,
    envMapIntensity: 0.5,
    side: THREE.DoubleSide,
  });
}

// Étiquette : papier (rugueux, fibres) ou film pelliculé (brillant). Le dos (vu à travers le
// liquide) est du papier blanc sans impression. foil : dorure à chaud (métal brillant).
function labelMaterial(map, { film = false, foil = null, anisotropy = 8 } = {}) {
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = anisotropy;
  const paper = paperTextures();
  paper.normal.repeat.set(5, 5);
  paper.roughness.repeat.set(5, 5);
  let foilTex = null;
  if (foil) {
    foilTex = new THREE.CanvasTexture(foil);
    foilTex.anisotropy = anisotropy;
  }
  const m = new THREE.MeshPhysicalMaterial({
    map,
    metalness: foil ? 1 : 0,
    metalnessMap: foilTex,
    roughness: film ? 0.42 : 0.86,
    roughnessMap: film ? null : paper.roughness,
    normalMap: film ? filmNormal() : paper.normal,
    normalScale: film ? new THREE.Vector2(0.1, 0.1) : new THREE.Vector2(0.4, 0.4),
    clearcoat: film ? 0.7 : 0,
    clearcoatRoughness: 0.08,
    envMapIntensity: film ? 0.75 : 0.9,
    sheen: film ? 0 : 0.3,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color('#fffaf0'),
    specularIntensity: film ? 1 : 0.4,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         if (!gl_FrontFacing) diffuseColor.rgb = vec3(0.83, 0.81, 0.77);`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
         if (!gl_FrontFacing) metalnessFactor = 0.0;
         ${foil ? 'roughnessFactor = mix(roughnessFactor, 0.3, metalnessFactor);' : ''}`,
      );
  };
  m.customProgramCacheKey = () => `label-${film ? 'film' : 'paper'}-${foil ? 'foil' : 'plain'}`;
  return m;
}

function plasticMaterial(color, { map = null, knurl = 0, anisotropy = 8 } = {}) {
  if (map) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = anisotropy;
  }
  return new THREE.MeshPhysicalMaterial({
    color: map ? 0xffffff : new THREE.Color(color),
    map,
    metalness: 0,
    roughness: 0.4,
    clearcoat: 0.35,
    clearcoatRoughness: 0.3,
    normalMap: knurl ? knurlNormal(knurl) : null,
    normalScale: new THREE.Vector2(0.35, 0.35),
    specularIntensity: 0.6,
  });
}

function metalMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    metalness: 0.85,
    roughness: 0.3,
    clearcoat: 0.8,
    clearcoatRoughness: 0.12,
    normalMap: brushedNormal(),
    normalScale: new THREE.Vector2(0.15, 0.15),
  });
}

let woodCache = null;
function woodMaterial() {
  if (!woodCache) {
    const c = canvas(256);
    const g = c.getContext('2d');
    const r = rng(11);
    g.fillStyle = '#7d5230';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '40,22,10' : '190,140,90'},${0.06 + r() * 0.16})`;
      g.fillRect(r() * 256, 0, 0.6 + r() * 2.4, 256);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.userData.shared = true;
    woodCache = t;
  }
  return new THREE.MeshPhysicalMaterial({ map: woodCache, roughness: 0.55, clearcoat: 0.5, clearcoatRoughness: 0.4, metalness: 0 });
}

// ------------------------------------------------------------------ bouchons

function capGroup(product, G, anisotropy) {
  const b = product.bottle;
  const s = G.s;
  const { k, Y0, seg } = G;
  const v = (r, y) => new THREE.Vector2(r * k, (y - Y0) * k);
  const [y0, y1, R] = s.closure;
  const group = new THREE.Group();
  const kind = b.closure === 'screw' ? s.closureKind || 'screw' : b.closure;
  if (kind === 'tall' || kind === 'screw') {
    const band = Math.min(4.2, (y1 - y0) * 0.16);
    const print = drawCapPrint(product);
    const side = new THREE.Mesh(
      new THREE.CylinderGeometry(R * k, R * k, (y1 - 2.2 - (y0 + band + 0.6)) * k, seg, 1, true),
      plasticMaterial(b.cap, { map: print ? new THREE.CanvasTexture(print) : null, knurl: print ? 0 : 120, anisotropy }),
    );
    side.position.y = ((y1 - 2.2 + y0 + band + 0.6) / 2 - Y0) * k;
    const top = new THREE.Mesh(
      new THREE.LatheGeometry([v(0, y1), v(R - 2.2, y1), v(R - 0.9, y1 - 0.35), v(R - 0.2, y1 - 1.2), v(R, y1 - 2.2)].reverse(), seg),
      plasticMaterial(b.cap, { anisotropy }),
    );
    // bague d'inviolabilité, séparée par une fine rainure
    const ring = new THREE.Mesh(
      new THREE.LatheGeometry([v(R - 0.5, y0), v(R + 0.05, y0 + 0.3), v(R + 0.05, y0 + band - 0.3), v(R - 0.6, y0 + band), v(R - 0.6, y0 + band + 0.6), v(R, y0 + band + 0.6)], seg),
      plasticMaterial(b.cap, { knurl: 60, anisotropy }),
    );
    group.add(side, top, ring);
  } else if (kind === 'cork') {
    const cork = new THREE.Mesh(new THREE.LatheGeometry([v(s.neck - 1, y0), v(R - 1, y0), v(R, y0 + 1.2), v(R, y1 - 2), v(R - 1.6, y1 - 0.2), v(R - 4, y1), v(0, y1)], seg), woodMaterial());
    group.add(cork);
  } else {
    // capsule métallique : épouse le col et la bague
    const outer = G.outer;
    const pts = [v(radiusAt(outer, y0) + 0.2, y0 - 0.2), v(radiusAt(outer, y0) + 0.9, y0 + 0.6)];
    for (let y = y0 + 2; y < s.lip - 1; y += 2) pts.push(v(radiusAt(outer, Math.min(y, s.lip - 3)) + 0.7, y));
    pts.push(v(R, s.lip - 0.8), v(R - 1, s.lip + 1.2), v(0, s.lip + 1.4));
    group.add(new THREE.Mesh(new THREE.LatheGeometry(pts, seg), metalMaterial(b.cap)));
  }
  return group;
}

// ------------------------------------------------------------------ bouteille

// photoLabel : { texture: THREE.Texture, angleGauche, angleDroite } (étiquette déroulée de la photo)
export function createBottle(product, { lite = false, anisotropy = 8, photoLabel = null } = {}) {
  const b = product.bottle;
  const G = geometries(b.shape, lite);
  const { k, Y0, s, seg } = G;
  const spec = LABELS[product.label] || LABELS.provence;
  const group = new THREE.Group();

  const glass = new THREE.Mesh(G.glass, glassMaterial({ lite, tint: product.alcool ? '#eef3ea' : '#f4f8f6' }));
  const liquid = new THREE.Mesh(G.liquid, liquidMaterial(b, G));
  group.add(liquid, glass);

  // Étiquette de face
  const [l0, l1] = s.label;
  const lr = (s.body + 0.3) * k;
  const lh = (l1 - l0) * k;
  const ly = ((l0 + l1) / 2 - Y0) * k;
  let front;
  if (photoLabel) {
    const aG = (photoLabel.angleGauche * Math.PI) / 180;
    const aD = (photoLabel.angleDroite * Math.PI) / 180;
    // la hauteur de l'étiquette suit la photo (rapport largeur / hauteur de la partie déroulée)
    const h = Math.min(lh * 1.08, (lr * (aG + aD)) / photoLabel.ratio);
    front = new THREE.Mesh(labelPatch(lr, h, ly + (h - lh) / 2, -aG, aG + aD, seg), labelMaterial(photoLabel.texture, { film: true, anisotropy }));
    group.userData.labelSource = 'photo';
  } else {
    const span = (spec.front * Math.PI) / 180;
    const pxH = lite ? 900 : 1500;
    const pxW = (pxH * (lr * span)) / lh;
    const art = drawFront(product, pxW, pxH);
    front = new THREE.Mesh(labelPatch(lr, lh, ly, -span / 2, span, seg), labelMaterial(new THREE.CanvasTexture(art.canvas), { film: spec.film, foil: art.foil, anisotropy }));
    group.userData.labelSource = 'dessin';
  }
  front.renderOrder = 2;
  group.add(front);

  // Contre-étiquette (au dos, centrée à 180°)
  const bspan = (spec.back * Math.PI) / 180;
  const [f0, f1] = spec.backSpan;
  // haut de la partie droite du corps (la contre-étiquette ne monte pas sur l'épaule)
  const bodyTop = s.pts.filter((pt) => pt[0] >= s.body - 0.3).reduce((m, pt) => Math.max(m, pt[1]), l1);
  const by0 = l0 + (l1 - l0) * f0;
  const by1 = Math.min(l0 + (l1 - l0) * f1, bodyTop - 4);
  const bh = (by1 - by0) * k;
  const bpxH = lite ? 500 : 900;
  const backArt = drawBack(product, (bpxH * (lr * bspan)) / bh, bpxH);
  const back = new THREE.Mesh(labelPatch(lr, bh, ((by0 + by1) / 2 - Y0) * k, Math.PI - bspan / 2, bspan, seg), labelMaterial(new THREE.CanvasTexture(backArt), { film: false, anisotropy }));
  group.add(back);

  group.add(capGroup(product, G, anisotropy));
  group.traverse((o) => {
    if (o.isMesh) o.userData.part = o === glass ? 'glass' : o === liquid ? 'liquid' : o === front || o === back ? 'label' : 'cap';
  });
  group.userData = {
    ...group.userData,
    slug: product.slug,
    kind: 'dessinée',
    height: BOTTLE_HEIGHT,
    radius: s.body * k,
    liquid: b.liquid,
    cloudy: !!b.cloudy,
    bottom: -BOTTLE_HEIGHT / 2,
  };
  return group;
}

export function disposeObject(obj) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.geometry?.userData?.shared) o.geometry?.dispose?.();
    [].concat(o.material).forEach((m) => {
      if (!m) return;
      ['map', 'emissiveMap', 'bumpMap', 'metalnessMap', 'roughnessMap', 'normalMap', 'alphaMap', 'transmissionMap'].forEach((key) => !m[key]?.userData?.shared && m[key]?.dispose?.());
      m.uniforms?.photoFront?.value?.dispose?.();
      m.uniforms?.photoBack?.value?.dispose?.();
      m.dispose();
    });
  });
}

// Reflet au sol : copie simplifiée (matériaux opaques, sans transmission) dessinée dans le rendu
// des reflets, qui s'efface en s'éloignant du sol.
const reflectionFade = (m, fade) => {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFloorY = fade.floorY;
    sh.uniforms.uFadeLen = fade.length;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWorldY;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWorldY;\nuniform float uFloorY;\nuniform float uFadeLen;')
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         float fadeK = 1.0 - smoothstep(0.0, uFadeLen, uFloorY - vWorldY);
         gl_FragColor = vec4(gl_FragColor.rgb * fadeK, fadeK);`,
      );
  };
  m.customProgramCacheKey = () => `refl-${m.type}`;
  return m;
};

export function createReflection(bottle, fade) {
  const proxy = new THREE.Group();
  bottle.updateMatrixWorld(true);
  bottle.traverse((o) => {
    if (!o.isMesh || o.userData.part === 'glass') return;
    const src = o.material;
    let m;
    if (o.userData.makeReflection) {
      const mesh = new THREE.Mesh(o.geometry, o.userData.makeReflection(fade));
      mesh.matrixAutoUpdate = false;
      mesh.userData.source = o;
      proxy.add(mesh);
      return;
    }
    if (o.userData.part === 'liquid') {
      const c = new THREE.Color(bottle.userData.liquid);
      m = new THREE.MeshStandardMaterial({ color: c.multiplyScalar(bottle.userData.cloudy ? 0.85 : 0.55), roughness: 0.15, metalness: 0, emissive: c, emissiveIntensity: 0.25 });
    } else {
      m = new THREE.MeshStandardMaterial({ color: src.map ? 0xffffff : src.color, map: src.map || null, roughness: 0.5, metalness: src.metalness > 0.5 ? 0.6 : 0 });
    }
    m.side = THREE.DoubleSide;
    reflectionFade(m, fade);
    const mesh = new THREE.Mesh(o.geometry, m);
    mesh.matrixAutoUpdate = false;
    mesh.userData.source = o;
    proxy.add(mesh);
  });
  return proxy;
}

// Place la copie en miroir sous le plan du sol (y = floorY).
const mirror = new THREE.Matrix4();
const shift = new THREE.Matrix4();
export function updateReflection(proxy, floorY) {
  mirror.makeScale(1, -1, 1);
  shift.makeTranslation(0, 2 * floorY, 0);
  proxy.children.forEach((m) => {
    const src = m.userData.source;
    src.updateWorldMatrix(true, false);
    m.matrix.copy(shift).multiply(mirror).multiply(src.matrixWorld);
    m.matrixWorld.copy(m.matrix);
    m.visible = src.visible && src.parent?.visible !== false;
  });
}
