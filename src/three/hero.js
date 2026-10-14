// Héros de la page d'accueil : les meilleures ventes en 3D (PAC Citron et Fun Blue par défaut,
// la liste vient des données : bestSeller: true), devant une affiche coupée en deux et dessinée
// dans la 3D pour que le verre la réfracte : rayures fuchsia du PAC à gauche, lagon Fun Blue à
// droite (île à palmiers, planches à voile). Au scroll, gros plan : l'écran bascule entièrement
// dans le fuchsia pour le PAC, puis dans le bleu pour le Fun Blue.
import * as THREE from 'three';
import { disposeObject } from './bottle.js';
import { makeBottle } from './factory.js';
import { createGarnish, updateGarnish } from './garnish.js';
import { island, sail } from './labels.js';
import { studioEnvironment } from './textures.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.99999, 1.0);
  }`;

// Deux côtés : 0 = rayures PAC, 1 = lagon Fun Blue, 2 = aplat (couleur du produit).
const fragmentShader = /* glsl */ `
  uniform vec2 uRes;
  uniform float uPixel;
  uniform float uTime;
  uniform float uSplit;
  uniform int uKindA;
  uniform int uKindB;
  uniform vec3 uColA;
  uniform vec3 uColB;
  uniform sampler2D uIsland;
  uniform float uIslandAspect;
  uniform float uIslandX;
  uniform float uHorizon;
  varying vec2 vUv;

  vec3 stripes(vec2 px, vec3 base) {
    float k = -px.x * 0.17365 + px.y * 0.98481;
    float spacing = max(46.0, uRes.y / 10.5) * uPixel;
    float f = fract(k / spacing);
    float w = 2.6 * uPixel / spacing;
    float line = smoothstep(0.0, w * 0.35, f) * (1.0 - smoothstep(w * 0.65, w, f));
    return mix(base, vec3(1.0), line * 0.9);
  }

  vec3 lagoon(vec2 uv, vec2 px) {
    vec3 sky = mix(vec3(0.431, 0.608, 0.816), vec3(0.184, 0.392, 0.659), smoothstep(uHorizon, 1.0, uv.y));
    sky = mix(sky, vec3(0.114, 0.271, 0.608), smoothstep(0.75, 1.0, uv.y));
    vec3 sea = mix(vec3(0.094, 0.686, 0.769), vec3(0.208, 0.463, 0.569), smoothstep(uHorizon, uHorizon - 0.12, uv.y));
    sea = mix(sea, vec3(0.114, 0.271, 0.608), smoothstep(uHorizon - 0.1, 0.0, uv.y));
    // reflets et petites vagues
    float wave = sin(px.x * 0.035 / uPixel + uTime * 0.8 + sin(px.y * 0.05 / uPixel) * 2.0) * sin(px.y * 0.21 / uPixel + uTime * 0.6);
    sea += vec3(0.9) * smoothstep(0.82, 0.98, wave) * 0.35 * smoothstep(uHorizon, uHorizon - 0.04, uv.y);
    vec3 col = uv.y > uHorizon ? sky : sea;
    // soleil couchant discret
    float sun = 1.0 - smoothstep(0.0, 0.09, length((uv - vec2(uIslandX + 0.12, uHorizon + 0.22)) * vec2(uRes.x / uRes.y, 1.0)));
    col = mix(col, vec3(1.0, 0.86, 0.55), sun * 0.55);
    // île et voiles (illustration dessinée dans un canvas)
    float ih = 0.34;
    vec2 iuv = vec2((uv.x - uIslandX) * (uRes.x / uRes.y) / (ih * uIslandAspect) + 0.5, (uv.y - (uHorizon - ih * 0.43)) / ih);
    if (iuv.x > 0.0 && iuv.x < 1.0 && iuv.y > 0.0 && iuv.y < 1.0) {
      vec4 il = texture2D(uIsland, iuv);
      col = mix(col, il.rgb, il.a);
    }
    return col;
  }

  vec3 side(int kind, vec3 c, vec2 uv, vec2 px) {
    if (kind == 0) return stripes(px, c);
    if (kind == 1) return lagoon(uv, px);
    return mix(c * 0.75, c, uv.y);
  }

  void main() {
    vec2 uv = vUv;
    vec2 px = gl_FragCoord.xy;
    float seam = uSplit + (uv.y - 0.5) * 0.14;
    float a = smoothstep(seam - 0.0008, seam + 0.0008, uv.x);
    vec3 col = mix(side(uKindA, uColA, uv, px), side(uKindB, uColB, uv, px), a);
    // couture : filet blanc puis encre, comme le bord d'une étiquette
    float d = abs(uv.x - seam) * uRes.x / uPixel;
    col = mix(col, vec3(1.0), 1.0 - smoothstep(4.0, 5.5, d));
    col = mix(col, vec3(0.09, 0.09, 0.06), 1.0 - smoothstep(1.2, 2.2, d));
    // vignettage léger
    col *= mix(0.86, 1.0, smoothstep(1.25, 0.35, length((uv - 0.5) * vec2(1.0, 1.3))));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

function islandTexture() {
  const c = document.createElement('canvas');
  c.width = 1400;
  c.height = 620;
  const g = c.getContext('2d');
  island(g, 700, 266, 1.25);
  sail(g, 230, 560, 1.15);
  sail(g, 1170, 520, 0.95, -1);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { texture: t, aspect: c.width / c.height };
}

const KIND = { pac: 0, funblue: 1 };

export class HeroScene {
  constructor(canvas, products, { calm = false } = {}) {
    this.canvas = canvas;
    this.products = products;
    this.calm = calm;
    this.state = { focus: 0, story: 0, mouseX: 0, mouseY: 0, hover: -1, split: 0.5 };
    this.mobile = innerWidth <= 760;
    this.lite = (navigator.hardwareConcurrency || 8) < 4 || (navigator.deviceMemory || 8) < 4;
    const r = new THREE.WebGLRenderer({ canvas, antialias: !this.mobile, alpha: false, powerPreference: 'high-performance' });
    this.maxDpr = Math.min(devicePixelRatio, this.mobile || this.lite ? 1.5 : 2);
    this.dpr = this.maxDpr;
    r.setPixelRatio(this.dpr);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.04;
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.scene.environment = studioEnvironment(r);
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.camera.position.set(0, 0, 10);

    const isl = islandTexture();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const a = products[0];
    const b = products[1] || products[0];
    this.bg = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uRes: { value: new THREE.Vector2(1, 1) },
          uPixel: { value: this.dpr },
          uTime: { value: 0 },
          uSplit: { value: 0.5 },
          uKindA: { value: KIND[a.theme] ?? 2 },
          uKindB: { value: KIND[b.theme] ?? 2 },
          uColA: { value: new THREE.Color(a.theme === 'pac' ? '#c2167f' : a.color) },
          uColB: { value: new THREE.Color(b.theme === 'pac' ? '#c2167f' : b.color) },
          uIsland: { value: isl.texture },
          uIslandAspect: { value: isl.aspect },
          uIslandX: { value: 0.75 },
          uHorizon: { value: 0.44 },
        },
      }),
    );
    this.bg.frustumCulled = false;
    this.bg.renderOrder = -1000;
    this.scene.add(this.bg);

    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(4, 6, 6);
    const rimA = new THREE.DirectionalLight(0xff8fd0, 1.6);
    rimA.position.set(-6, 1, -3);
    const rimB = new THREE.DirectionalLight(0x8fe8ff, 1.6);
    rimB.position.set(6, 1, -3);
    this.scene.add(key, rimA, rimB, new THREE.AmbientLight(0xffffff, 0.22));

    this.slots = products.map((p, i) => {
      const pivot = new THREE.Group();
      pivot.userData = { index: i, appear: 0, seed: i * 2.3 + 0.7 };
      this.scene.add(pivot);
      const garnish = createGarnish(p, this.lite || this.mobile);
      this.scene.add(garnish);
      return { product: p, pivot, garnish, bottle: null };
    });
    const anisotropy = Math.min(r.capabilities.getMaxAnisotropy(), 8);
    this.ready = Promise.all(
      this.slots.map(async (s) => {
        s.bottle = await makeBottle(s.product, { lite: this.lite, anisotropy });
        s.bottle.userData.index = this.slots.indexOf(s);
        s.pivot.add(s.bottle);
      }),
    );

    this.clock = new THREE.Clock();
    this.frames = [];
    this.resize();
    this.onResize = () => this.resize();
    addEventListener('resize', this.onResize);
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.mobile = w <= 760;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.position.z = this.camera.aspect < 0.8 ? (10 / Math.max(this.camera.aspect, 0.42)) * 0.62 : 10;
    this.camera.updateProjectionMatrix();
    const u = this.bg.material.uniforms;
    u.uRes.value.set(w * this.dpr, h * this.dpr);
    u.uPixel.value = this.dpr;
    u.uHorizon.value = this.mobile ? 0.36 : 0.44;
  }

  // Baisse la résolution si l'appareil n'arrive pas à tenir ~50 images par seconde.
  adapt(dt) {
    this.frames.push(dt);
    if (this.frames.length < 90) return;
    const avg = this.frames.reduce((x, y) => x + y, 0) / this.frames.length;
    this.frames.length = 0;
    if (avg > 1 / 48 && this.dpr > 1) this.dpr = Math.max(1, this.dpr - 0.25);
    else if (avg < 1 / 58 && this.dpr < this.maxDpr) this.dpr = Math.min(this.maxDpr, this.dpr + 0.25);
    else return;
    this.renderer.setPixelRatio(this.dpr);
    this.resize();
  }

  // Pose « affiche » : les bouteilles côte à côte, penchées l'une vers l'autre.
  heroPose(i, n, t) {
    const m = this.mobile;
    const spread = m ? 0.92 : 1.42;
    const x = n === 1 ? 0 : lerp(-spread, spread, i / (n - 1)) * (n > 2 ? 1.25 : 1);
    const hover = this.state.hover;
    const hov = hover === i ? 1 : hover >= 0 ? -1 : 0;
    return {
      x: x + this.state.mouseX * 0.12 * (m ? 0 : 1),
      y: (m ? 0.02 : -0.7) + Math.sin(t * 1.1 + i * 1.7) * 0.06 + this.state.mouseY * 0.06,
      z: hov * 0.6,
      s: (m ? 0.86 : 1.06) * (1 + hov * 0.05),
      rz: n === 1 ? -0.06 : (i === 0 ? 0.11 : -0.11) + Math.sin(t * 0.7 + i) * 0.02,
      ry: (i === 0 ? 0.42 : -0.25) + Math.sin(t * 0.5 + i * 2) * 0.22,
    };
  }

  // Pose « gros plan » : la bouteille active à droite (en haut sur téléphone), qui tourne pour
  // montrer sa contre-étiquette au fil des chapitres.
  focusPose(t, turn) {
    const m = this.mobile;
    return {
      x: (m ? 0 : 2.15) + this.state.mouseX * 0.1,
      y: (m ? 1.25 : -0.08) + Math.sin(t * 1.1) * 0.05,
      z: m ? 0.4 : 1.6,
      s: m ? 0.78 : 1.32,
      rz: -0.16,
      ry: 0.35 + turn * (Math.PI - 0.5),
    };
  }

  update() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.calm ? 0 : this.clock.elapsedTime;
    this.adapt(dt);
    const s = this.state;
    const n = this.slots.length;
    const f = smooth(clamp(s.focus, 0, 1));
    // Gros plan : produit actif selon l'avancée de l'histoire (une moitié chacun pour deux produits).
    const seg = Math.min(n - 1, Math.floor(clamp(s.story, 0, 0.9999) * n));
    const within = clamp(s.story * n - seg, 0, 1);
    // Passage au produit suivant (jamais après le dernier : il reste à l'écran).
    const swap = n > 1 && seg < n - 1 ? smooth(clamp((s.story * n - seg - 0.92) / 0.08, 0, 1)) : 0;

    // Couture de l'affiche : au centre (survol : le côté survolé s'élargit), puis tout PAC, puis tout Fun Blue.
    const heroSplit = 0.5 + (s.hover === 0 ? 0.07 : s.hover === 1 ? -0.07 : 0);
    const storySplit = seg === 0 ? lerp(1.12, -0.12, swap) : -0.12;
    const target = lerp(heroSplit, storySplit, f);
    s.split += (target - s.split) * (1 - Math.pow(0.002, dt));
    const u = this.bg.material.uniforms;
    u.uSplit.value = s.split;
    u.uTime.value = t;
    u.uIslandX.value = clamp((Math.max(s.split, 0) + 1) / 2, 0.5, 0.8);

    this.slots.forEach((slot, i) => {
      const pv = slot.pivot;
      const ud = pv.userData;
      ud.appear += ((slot.bottle ? 1 : 0) - ud.appear) * (1 - Math.pow(0.01, dt));
      const h = this.heroPose(i, n, t);
      let fp;
      if (i === seg) fp = this.focusPose(t, within);
      else {
        // les autres s'éclipsent : vers le bas si elles viennent après, vers le haut si avant
        const dir = i > seg ? 1 : -1;
        fp = { x: h.x * 2.4, y: dir * -7.5, z: -1, s: h.s * 0.8, rz: h.rz, ry: h.ry };
      }
      // Passage d'un produit à l'autre : la bouteille active sort par le haut, la suivante entre par le bas.
      if (i === seg && swap > 0) fp.y += swap * 8;
      if (i === seg + 1 && swap > 0) {
        const nx = this.focusPose(t, 0);
        fp = { ...nx, y: lerp(-8, nx.y, swap) };
      }
      const drop = (1 - smooth(clamp(ud.appear, 0, 1))) * 3;
      pv.position.set(lerp(h.x, fp.x, f), lerp(h.y, fp.y, f) - drop, lerp(h.z, fp.z, f));
      pv.scale.setScalar(Math.max(0.0001, lerp(h.s, fp.s, f) * (0.6 + 0.4 * ud.appear)));
      pv.rotation.set(lerp(0.06, 0.04, f), lerp(h.ry, fp.ry, f), lerp(h.rz, fp.rz, f));
      const showGarnish = slot.bottle && (f < 0.5 ? 1 : i === seg && swap < 0.5 ? 1 : i === seg + 1 && swap >= 0.5 ? 1 : 0);
      updateGarnish(slot.garnish, {
        t,
        dt,
        target: showGarnish,
        anchor: pv.position,
        scale: pv.scale.x * (f < 0.5 ? 0.82 : 1),
        spread: lerp(0.78, this.mobile ? 0.82 : 1.05, f),
        calm: this.calm,
      });
    });
    this.renderer.render(this.scene, this.camera);
  }

  // Index du produit sous le pointeur, ou -1.
  pick(clientX, clientY) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1), this.camera);
    const hits = ray.intersectObjects(
      this.slots.map((s) => s.pivot),
      true,
    );
    if (!hits.length) return -1;
    let o = hits[0].object;
    while (o && o.userData.index === undefined) o = o.parent;
    return o ? o.userData.index : -1;
  }

  dispose() {
    removeEventListener('resize', this.onResize);
    this.slots.forEach((s) => s.bottle && disposeObject(s.bottle));
    this.renderer.dispose();
  }
}
