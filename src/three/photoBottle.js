// Bouteille construite depuis une vraie photo (voir scripts/photos.mjs et photos/LISEZMOI.md),
// rendue comme un scan 3D :
// - la silhouette mesurée sur la photo (profil.json) est tournée autour de l'axe (LatheGeometry) ;
// - la photo de face est projetée sur la moitié avant ; la moitié arrière reçoit la photo de dos,
//   ou, à défaut, la photo de face projetée en miroir et un peu assombrie ; fondu sur les côtés ;
// - là où la photo montre son propre fond à travers le verre (col vide, épaule), la bouteille devient
//   du verre transparent qui laisse voir le décor (transmission) ;
// - un vernis (clearcoat) et les reflets du studio donnent le volume quand elle tourne.
import * as THREE from 'three';
import { BOTTLE_HEIGHT } from './bottle.js';

const loader = new THREE.TextureLoader();
const assets = new Map(); // slug → Promise<{ profil, front, back }>

function loadTexture(url, anisotropy) {
  return new Promise((resolve, reject) =>
    loader.load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = anisotropy;
        t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
        t.userData.shared = true; // partagée entre les instances (vignettes, héros, fiche)
        resolve(t);
      },
      undefined,
      reject,
    ),
  );
}

function loadAssets(slug, entry, anisotropy) {
  if (!assets.has(slug)) {
    assets.set(
      slug,
      (async () => {
        const res = await fetch(entry.profil);
        if (!res.ok) throw new Error(`profil introuvable (${res.status})`);
        const profil = await res.json();
        const [front, back] = await Promise.all([loadTexture(entry.face, anisotropy), entry.dos ? loadTexture(entry.dos, anisotropy) : null]);
        return { profil, front, back };
      })(),
    );
    assets.get(slug).catch(() => assets.delete(slug));
  }
  return assets.get(slug);
}

const transmissionChunk = THREE.ShaderChunk.transmission_fragment.replace('material.transmission = transmission;', 'material.transmission = transmission * glassK;');

// fade : { floorY, length } pour la copie en reflet au sol (rendu séparé), sinon null.
export function photoMaterial(front, back, { lite = false, background = null, fade = null } = {}) {
  const glass = !!background && !fade && !lite;
  const params = { color: 0xffffff, roughness: 0.3, metalness: 0, envMapIntensity: 0.8 };
  const mat =
    lite || fade
      ? new THREE.MeshStandardMaterial(params)
      : new THREE.MeshPhysicalMaterial({
          ...params,
          clearcoat: 0.8,
          clearcoatRoughness: 0.08,
          specularIntensity: 0.7,
          ...(glass ? { transmission: 1, thickness: 0.05, ior: 1.5, side: THREE.FrontSide } : {}),
        });
  if (fade) mat.side = THREE.DoubleSide;
  mat.userData.uniforms = {
    photoFront: { value: front },
    photoBack: { value: back || front },
    backTint: { value: new THREE.Color(back ? 0xffffff : 0xcfcfcf) },
    selfLit: { value: 0.42 },
    bgColor: { value: new THREE.Color(background || '#ffffff').convertSRGBToLinear() },
    uFloorY: fade?.floorY || { value: 0 },
    uFadeLen: fade?.length || { value: 1 },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute vec2 uvFront;
         attribute vec2 uvBack;
         attribute float side;
         varying vec2 vUvFront;
         varying vec2 vUvBack;
         varying float vSide;
         varying float vWorldY;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vUvFront = uvFront;
         vUvBack = uvBack;
         vSide = side;`,
      )
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;');
    let frag = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform sampler2D photoFront;
         uniform sampler2D photoBack;
         uniform vec3 backTint;
         uniform float selfLit;
         uniform vec3 bgColor;
         uniform float uFloorY;
         uniform float uFadeLen;
         varying vec2 vUvFront;
         varying vec2 vUvBack;
         varying float vSide;
         varying float vWorldY;
         float glassK = 0.0;`,
      )
      .replace(
        '#include <map_fragment>',
        `vec4 photoF = texture2D(photoFront, vUvFront);
         vec4 photoB = texture2D(photoBack, vUvBack);
         photoB.rgb *= backTint;
         vec4 photo = mix(photoB, photoF, smoothstep(-0.14, 0.14, vSide));
         ${glass ? 'glassK = (1.0 - smoothstep(0.012, 0.06, distance(photo.rgb, bgColor))) * 0.92;' : ''}
         diffuseColor.rgb *= photo.rgb;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         totalEmissiveRadiance += photo.rgb * selfLit * (1.0 - glassK);`,
      );
    if (glass) frag = frag.replace('#include <transmission_fragment>', transmissionChunk);
    if (fade)
      frag = frag.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         float fadeK = 1.0 - smoothstep(0.0, uFadeLen, uFloorY - vWorldY);
         gl_FragColor = vec4(gl_FragColor.rgb * fadeK, fadeK);`,
      );
    shader.fragmentShader = frag;
  };
  mat.customProgramCacheKey = () => `photo-bottle-${lite ? 'l' : 'p'}-${glass ? 'g' : 'o'}-${fade ? 'r' : 'n'}`;
  return mat;
}

export async function createPhotoBottle(product, entry, { lite = false, anisotropy = 8 } = {}) {
  const { profil, front, back } = await loadAssets(product.slug, entry, anisotropy);
  const H = BOTTLE_HEIGHT;
  const pts = profil.points.map(([r, y]) => new THREE.Vector2(Math.max(r * H, 0.0005), (y - 0.5) * H));
  pts.unshift(new THREE.Vector2(0, -0.5 * H));
  pts.push(new THREE.Vector2(0, 0.5 * H));
  const geo = new THREE.LatheGeometry(pts, lite ? 72 : 128);

  // Coordonnées de texture : projection de face (et de dos), comme l'objectif qui a pris la photo.
  const pos = geo.attributes.position;
  const n = pos.count;
  const uvF = new Float32Array(n * 2);
  const uvB = new Float32Array(n * 2);
  const side = new Float32Array(n);
  const RF = profil.rayonMax * H;
  const RB = (profil.dos?.rayonMax ?? profil.rayonMax) * H;
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const v = y / H + 0.5;
    uvF[i * 2] = 0.5 + x / (2 * RF);
    uvF[i * 2 + 1] = v;
    uvB[i * 2] = 0.5 - x / (2 * RB);
    uvB[i * 2 + 1] = v;
    const r = Math.hypot(x, z);
    side[i] = r > 1e-5 ? z / r : 1;
  }
  geo.setAttribute('uvFront', new THREE.BufferAttribute(uvF, 2));
  geo.setAttribute('uvBack', new THREE.BufferAttribute(uvB, 2));
  geo.setAttribute('side', new THREE.BufferAttribute(side, 1));
  geo.computeVertexNormals();

  const background = profil.couleurFond || null;
  const mesh = new THREE.Mesh(geo, photoMaterial(front, back, { lite, background }));
  mesh.userData.part = 'photo';
  mesh.userData.makeReflection = (fade) => photoMaterial(front, back, { fade });
  const group = new THREE.Group();
  group.add(mesh);
  let rmax = 0;
  for (const [r] of profil.points) rmax = Math.max(rmax, r);
  group.userData = {
    slug: product.slug,
    kind: 'photo',
    height: H,
    radius: rmax * H,
    ratio: profil.ratio,
    liquid: product.bottle.liquid,
    cloudy: !!product.bottle.cloudy,
    bottom: -H / 2,
    labelSource: 'photo',
  };
  return group;
}
