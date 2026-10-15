// Bouteille construite depuis une vraie photo (voir scripts/photos.mjs et photos/LISEZMOI.md),
// rendue comme un scan 3D :
// - la silhouette mesurée sur la photo (profil.json) est tournée autour de l'axe (LatheGeometry) ;
// - la photo de face est projetée sur la moitié avant ; la moitié arrière reçoit la photo de dos,
//   ou, à défaut, la photo de face projetée en miroir et un peu assombrie ; fondu sur les côtés ;
// - là où la photo montre son propre fond à travers le verre (col vide, épaule), la bouteille devient
//   du verre transparent qui laisse voir le décor (transmission) ;
// - un vernis (clearcoat) et les reflets du studio donnent le volume quand elle tourne ;
// - quand l'étiquette à plat du produit existe (fichier du site, recalé sur la photo par le
//   pipeline), elle remplace la photo dans sa bande : nette à toutes les tailles, éclairée par le
//   studio, et le dos de la bouteille montre le liquide (photo prise juste au-dessus de l'étiquette).
// Les flacons « à plat » (carafe et étui) sont montrés comme une photo posée, sans rotation.
import * as THREE from 'three';
import { BOTTLE_HEIGHT } from './bottle.js';

const loader = new THREE.TextureLoader();
const assets = new Map(); // slug → Promise<{ profil, front, back, label, body }>
const labelBacks = new Map(); // url → Promise<Texture> (dos de l'étiquette, chargé seulement s'il sert)

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
        const [front, back, label, body] = await Promise.all([
          loadTexture(entry.face, anisotropy),
          entry.dos ? loadTexture(entry.dos, anisotropy) : null,
          entry.etiquette && profil.etiquette ? loadTexture(entry.etiquette, anisotropy).catch(() => null) : null,
          entry.corps ? loadTexture(entry.corps, 1).catch(() => null) : null,
        ]);
        return { profil, front, back, label, body };
      })(),
    );
    assets.get(slug).catch(() => assets.delete(slug));
  }
  return assets.get(slug);
}

// réglables depuis le labo (window.__photoGain) : diffus photo, auto-éclairage photo, diffus
// étiquette, auto-éclairage étiquette
export const PHOTO_GAIN = [0.75, 0.2, 0.95, 0.22];

const transmissionChunk = THREE.ShaderChunk.transmission_fragment.replace('material.transmission = transmission;', 'material.transmission = transmission * glassK;');

// fade : { floorY, length } pour la copie en reflet au sol (rendu séparé), sinon null.
// label : { texture, bas, haut, centre, angle } (étiquette à plat recalée), sinon null.
export function photoMaterial(front, back, { lite = false, background = null, fade = null, label = null, body = null } = {}) {
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
    // gains (diffus, auto-éclairage) de la photo puis de l'étiquette : la photo porte déjà la
    // lumière de la prise de vue, l'étiquette à plat n'en porte aucune
    photoGain: { value: new THREE.Vector4(...PHOTO_GAIN) },
    bgColor: { value: new THREE.Color(background || '#ffffff').convertSRGBToLinear() },
    uFloorY: fade?.floorY || { value: 0 },
    uFadeLen: fade?.length || { value: 1 },
    labelMap: { value: label?.texture || null },
    labelBand: { value: new THREE.Vector4(label?.bas ?? 0, label?.haut ?? 0, label?.centre ?? 0.5, label?.angle ?? 1) },
    labelBackMap: { value: label?.dos?.texture || null },
    bodyMap: { value: body },
    labelBack: { value: new THREE.Vector3(label?.dos?.bas ?? 0, label?.dos?.haut ?? 0, label?.dos?.angle ?? 1) },
  };
  mat.defines = { ...(mat.defines || {}), ...(label ? { PHOTO_LABEL: '', ...(label.dos ? { PHOTO_LABEL_BACK: '' } : {}) } : {}), ...(body ? { PHOTO_BODY: '' } : {}), ...(back ? { PHOTO_BACK: '' } : {}), ...(!back && !label ? { PHOTO_MIRROR: '' } : {}) };
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
         varying float vWorldY;
         varying float vLatheU;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vUvFront = uvFront;
         vUvBack = uvBack;
         vSide = side;
         vLatheU = uv.x;`,
      )
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;');
    let frag = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform sampler2D photoFront;
         uniform sampler2D photoBack;
         uniform vec3 backTint;
         uniform vec4 photoGain;
         uniform vec3 bgColor;
         uniform float uFloorY;
         uniform float uFadeLen;
         varying vec2 vUvFront;
         varying vec2 vUvBack;
         varying float vSide;
         varying float vWorldY;
         varying float vLatheU;
         uniform sampler2D labelMap;
         uniform vec4 labelBand;
         uniform sampler2D labelBackMap;
         uniform vec3 labelBack;
         uniform sampler2D bodyMap;
         // couleur à un angle donné : la photo de face devant, la couleur « tout autour » sur les
         // côtés et au dos (ou la photo de dos quand elle existe)
         vec3 aroundColor(vec2 uvF, vec2 uvB, float side) {
           vec3 col = texture2D(photoFront, uvF).rgb;
           #ifdef PHOTO_BODY
           vec3 sym = texture2D(bodyMap, vec2(0.5, uvF.y)).rgb;
           #if defined(PHOTO_BACK) || defined(PHOTO_MIRROR)
           // photo de dos, ou (sans étiquette à plat) la face en miroir, pour le dos
           vec3 b = texture2D(photoBack, uvB).rgb * backTint;
           sym = mix(sym, b, smoothstep(0.35, 0.72, -side));
           #endif
           col = mix(sym, col, smoothstep(0.35, 0.72, side));
           #else
           vec3 b = texture2D(photoBack, uvB).rgb * backTint;
           col = mix(b, col, smoothstep(-0.14, 0.14, side));
           #endif
           return col;
         }
         float glassK = 0.0;
         float labelK = 0.0;`,
      )
      .replace(
        '#include <map_fragment>',
        `vec4 photo = vec4(aroundColor(vUvFront, vUvBack, vSide), 1.0);
         #ifdef PHOTO_LABEL
         {
           float h = vUvFront.y;
           float lo = labelBand.x;
           float hi = labelBand.y;
           #ifdef PHOTO_LABEL_BACK
           lo = min(lo, labelBack.x);
           hi = max(hi, labelBack.y);
           #endif
           if (h >= lo && h <= hi) {
             // angle autour de l'axe (0 = face à l'objectif)
             float th = vLatheU * 6.2831853;
             th = th > 3.14159265 ? th - 6.2831853 : th;
             // bouteille nue hors de l'étiquette (et dans ses découpes) : la photo prise juste
             // au-dessus de l'étiquette, même colonne
             float hb = min(labelBand.y + 0.022, 0.995);
             vec3 col = aroundColor(vec2(vUvFront.x, hb), vec2(vUvBack.x, hb), vSide);
             float k = 0.0;
             float ah = max(fwidth(h) * 1.25, 1e-5);
             {
               float u = labelBand.z + th / labelBand.w;
               float v = (h - labelBand.x) / (labelBand.y - labelBand.x);
               float aa = clamp(fwidth(u) * 1.25, 1e-4, 0.02);
               float inside = smoothstep(-aa, aa, u) * smoothstep(-aa, aa, 1.0 - u)
                 * smoothstep(labelBand.x - ah, labelBand.x + ah, h) * smoothstep(labelBand.y + ah, labelBand.y - ah, h);
               vec4 lab = texture2D(labelMap, vec2(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0)));
               inside *= lab.a;
               col = mix(col, lab.rgb, inside);
               k = max(k, inside);
             }
             #ifdef PHOTO_LABEL_BACK
             {
               float tb = th - 3.14159265;
               tb = tb < -3.14159265 ? tb + 6.2831853 : tb;
               float u = 0.5 + tb / labelBack.z;
               float v = (h - labelBack.x) / (labelBack.y - labelBack.x);
               float aa = clamp(fwidth(u) * 1.25, 1e-4, 0.02);
               float inside = smoothstep(-aa, aa, u) * smoothstep(-aa, aa, 1.0 - u)
                 * smoothstep(labelBack.x - ah, labelBack.x + ah, h) * smoothstep(labelBack.y + ah, labelBack.y - ah, h);
               vec3 lab = texture2D(labelBackMap, vec2(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0))).rgb;
               col = mix(col, lab, inside);
               k = max(k, inside);
             }
             #endif
             photo.rgb = col;
             labelK = k;
           }
         }
         #endif
         ${glass ? 'glassK = (1.0 - smoothstep(0.012, 0.06, distance(photo.rgb, bgColor))) * 0.92 * (1.0 - labelK);' : ''}
         diffuseColor.rgb *= photo.rgb * mix(photoGain.x, photoGain.z, labelK);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         roughnessFactor = mix(roughnessFactor, 0.46, labelK);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         totalEmissiveRadiance += photo.rgb * mix(photoGain.y, photoGain.w, labelK) * (1.0 - glassK);`,
      );
    if (!lite && !fade)
      frag = frag.replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>
         #ifdef USE_CLEARCOAT
         material.clearcoat *= mix(1.0, 0.45, labelK);
         #endif`,
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
  mat.customProgramCacheKey = () => `photo-bottle-${lite ? 'l' : 'p'}-${glass ? 'g' : 'o'}-${fade ? 'r' : 'n'}-${label ? (label.dos ? 'ed' : 'e') : 's'}-${body ? 'c' : 'x'}-${back ? 'd' : 'm'}`;
  return mat;
}

// Dos de l'étiquette (contre-étiquette des sirops) : ~180 Ko, utile seulement quand la bouteille
// tourne (visionneuse des fiches) ; les campagnes et les vignettes (dos: false) ne le chargent pas.
function loadLabelBack(url, anisotropy) {
  if (!labelBacks.has(url)) labelBacks.set(url, loadTexture(url, anisotropy).catch(() => null));
  return labelBacks.get(url);
}

export async function createPhotoBottle(product, entry, { lite = false, anisotropy = 8, dos = true } = {}) {
  if (entry.plat && entry.photo) return createFlatPhoto(product, entry, { anisotropy });
  const { profil, front, back, label: labelTex, body } = await loadAssets(product.slug, entry, anisotropy);
  const labelBack = dos && entry.etiquetteDos && profil.etiquetteDos ? await loadLabelBack(entry.etiquetteDos, anisotropy) : null;
  const label = labelTex && profil.etiquette ? { texture: labelTex, ...profil.etiquette, dos: labelBack && profil.etiquetteDos ? { texture: labelBack, ...profil.etiquetteDos } : null } : null;
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
  const mesh = new THREE.Mesh(geo, photoMaterial(front, back, { lite, background, label, body }));
  mesh.userData.part = 'photo';
  mesh.userData.makeReflection = (fade) => photoMaterial(front, back, { fade, label, body });
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
    labelSource: label ? 'etiquette' : 'photo',
  };
  return group;
}

// Flacon montré à plat (carafe et son étui) : la photo détourée, debout sur le sol du studio.
const flatTextures = new Map();
async function createFlatPhoto(product, entry, { anisotropy = 8 } = {}) {
  if (!flatTextures.has(entry.photo)) flatTextures.set(entry.photo, loadTexture(entry.photo, anisotropy));
  const map = await flatTextures.get(entry.photo);
  const H = BOTTLE_HEIGHT * 0.86;
  const W = H * (entry.photoRatio || 0.8);
  const geo = new THREE.PlaneGeometry(W, H);
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.02, depthWrite: true, toneMapped: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -BOTTLE_HEIGHT / 2 + H / 2;
  mesh.userData.part = 'photo';
  mesh.userData.makeReflection = () => new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.02, opacity: 0.4, side: THREE.DoubleSide });
  const group = new THREE.Group();
  group.add(mesh);
  group.userData = {
    slug: product.slug,
    kind: 'plat',
    height: BOTTLE_HEIGHT,
    radius: W / 2,
    ratio: W / H,
    liquid: product.bottle.liquid,
    cloudy: false,
    bottom: -BOTTLE_HEIGHT / 2,
    labelSource: 'photo',
    flat: true,
  };
  return group;
}
