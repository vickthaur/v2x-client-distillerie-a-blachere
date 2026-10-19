// Plateau photo en 3D : fond cyclo (sol qui remonte en mur, sans horizon visible) éclairé comme en
// studio, ombres de contact, caustiques colorées du liquide sur le sol, reflets au sol qui
// s'effacent, bouteilles posées, éléments qui flottent autour. Le cadrage suit un rectangle du DOM :
// les bouteilles tiennent toujours entières dans ce rectangle, quel que soit le format d'écran
// (de 390 px à 3 440 px de large), avec une marge.
import * as THREE from 'three';
import { BOTTLE_HEIGHT, createReflection, updateReflection, disposeObject } from './bottle.js';
import { makeBottle } from './factory.js';
import { createGarnish, updateGarnish, garnishBlobs } from './garnish.js';
import { createRenderer, studioEnvironment, Post } from './studio.js';

export const FLOOR_Y = -BOTTLE_HEIGHT / 2;
const LAYER_REFL = 1;
const MAX_BOTTLES = 4;
const MAX_BLOBS = 16;
const TEST = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');
const DEBUG = new Set(typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('debug3d') || '').split(',') : []);

// ------------------------------------------------------------------ fond cyclo

function sweepGeometry() {
  const prof = [];
  for (let i = 0; i <= 40; i++) prof.push([32 - i * (36 / 40), 0]);
  for (let i = 1; i <= 28; i++) {
    const a = (i / 28) * (Math.PI / 2);
    prof.push([-4 - Math.sin(a) * 6, 6 - Math.cos(a) * 6]);
  }
  for (let i = 1; i <= 16; i++) prof.push([-10, 6 + i * 3]);
  // maillage fin, sans colonne de sommets en x = 0 (axe de la caméra : évite une fissure d'un pixel)
  const xs = Array.from({ length: 48 }, (_, i) => -120 + (i * 240) / 47);
  const pos = [];
  const idx = [];
  prof.forEach(([z, y]) => xs.forEach((x) => pos.push(x, y + FLOOR_Y, z)));
  for (let j = 0; j < prof.length - 1; j++)
    for (let i = 0; i < xs.length - 1; i++) {
      const a = j * xs.length + i;
      const b = a + 1;
      const c = a + xs.length;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

const sweepVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const sweepFragment = /* glsl */ `
  uniform vec3 uColA;
  uniform vec3 uColB;
  uniform float uSplitX;
  uniform float uSplitSoft;
  uniform vec4 uSpot;
  uniform float uFloorY;
  uniform vec4 uBottles[${MAX_BOTTLES}];
  uniform vec3 uLiquids[${MAX_BOTTLES}];
  uniform vec4 uBlobs[${MAX_BLOBS}];
  uniform int uBlobCount;
  uniform sampler2D uRefl;
  uniform vec2 uRes;
  uniform float uReflK;
  uniform float uCaustic;
  uniform float uTime;
  uniform float uExposure;
  varying vec3 vWorld;

  float caustic(vec2 p, float time) {
    vec2 i = p;
    float c = 1.0;
    float inten = 0.005;
    for (int n = 0; n < 4; n++) {
      float t = time * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
      c += 1.0 / max(length(vec2(p.x / (sin(i.x + t) / inten + 1e-4), p.y / (cos(i.y + t) / inten + 1e-4))), 1e-3);
    }
    c /= 4.0;
    c = 1.17 - pow(max(c, 0.0), 1.4);
    return clamp(pow(abs(c), 8.0), 0.0, 1.5);
  }

  void main() {
    float h = vWorld.y - uFloorY;
    float floorMask = 1.0 - smoothstep(0.0, 0.8, h);
    vec3 base = mix(uColA, uColB, smoothstep(uSplitX - uSplitSoft, uSplitX + uSplitSoft, vWorld.x));
    // éclairage du cyclo : tache de lumière douce derrière les bouteilles, mur qui s'assombrit vers
    // le haut, sol qui s'assombrit vers l'objectif
    vec3 sp = vWorld - uSpot.xyz;
    sp.y *= 0.8;
    float spot = exp(-dot(sp, sp) / (uSpot.w * uSpot.w));
    float wall = mix(1.0, 0.55, smoothstep(1.0, 10.0, h));
    float front = mix(1.0, 0.7, smoothstep(2.0, 16.0, vWorld.z));
    float side = mix(1.0, 0.78, smoothstep(6.0, 22.0, abs(vWorld.x - uSpot.x)));
    vec3 col = base * (0.5 + 0.5 * spot) * wall * front * side;
    // ombres de contact et caustiques des bouteilles
    float shade = 1.0;
    vec3 caus = vec3(0.0);
    for (int i = 0; i < ${MAX_BOTTLES}; i++) {
      vec4 b = uBottles[i];
      if (b.w < 0.5) continue;
      vec2 d = vWorld.xz - b.xy;
      float r = b.z;
      float dist = length(d);
      float edge = max(dist - r, 0.0);
      float ao = exp(-edge / (r * 0.1));
      vec2 sd = d - vec2(0.35, -0.45) * r;
      float soft = exp(-dot(sd, sd) / (r * r * 2.4));
      shade *= 1.0 - clamp(ao * 0.6 + soft * 0.32, 0.0, 0.88) * floorMask;
      vec2 q = (d - vec2(0.2, 1.45) * r) / (vec2(0.7, 1.05) * r);
      float m = exp(-dot(q, q) * 1.5);
      if (m > 0.01) caus += uLiquids[i] * m * (0.35 + 1.4 * caustic(vWorld.xz * 2.6 + vec2(float(i) * 3.1), uTime * 0.12));
    }
    for (int j = 0; j < ${MAX_BLOBS}; j++) {
      if (j >= uBlobCount) break;
      vec4 b = uBlobs[j];
      float rr = b.w * (1.0 + b.z * 0.9);
      vec2 d = vWorld.xz - b.xy;
      shade *= 1.0 - exp(-dot(d, d) / (rr * rr)) * 0.32 / (1.0 + b.z * b.z * 0.5) * floorMask;
    }
    col = col * shade + caus * uCaustic * floorMask;
    // reflets au sol (rendu séparé, en miroir)
    vec4 refl = texture2D(uRefl, gl_FragCoord.xy / uRes);
    col = col * (1.0 - refl.a * uReflK * floorMask) + refl.rgb * uReflK * floorMask;
    col = clamp(col, 0.0, 8.0);
    gl_FragColor = vec4(col * uExposure, 1.0);
  }`;

// ------------------------------------------------------------------ plateau

export class Stage {
  // options :
  //  colors : { a, b, split, soft } couleurs du fond (gauche, droite), position et largeur du fondu
  //  gels   : couleurs des bandes arrière de l'environnement (reflets colorés), facultatif
  //  layout : composition des éléments flottants (garnish.js LAYOUTS), ou null
  //  bottles: [{ product, x, z, ry }]
  //  target : () => DOMRect du rectangle où doivent tenir les bouteilles (sinon tout le canvas)
  //  dof    : profondeur de champ ; quality : 'auto' | 'high' | 'low'
  //  calm   : mouvement réduit (ni balancement ni parallaxe ; l'image n'est redessinée que si
  //           quelque chose change : taille, défilement, angle, bouteilles)
  //  dos    : charger le dos des étiquettes (visionneuse des fiches) ; les campagnes et les rendus de
  //           vignettes montrent les bouteilles de face et s'en passent
  //  pause  : scène figée dès le départ (choix « Mettre l'animation en pause » gardé, src/lib/pause.js)
  constructor(canvas, { colors, gels = null, layout = null, bottles = [], target = null, dof = true, fill = 0.92, calm = false, exposure = 1, spot = null, interactive = true, tone = 'neutral', look = null, manual = false, dpr = null, sway = true, dos = true, pause = false, onUpdate = null } = {}) {
    this.canvas = canvas;
    this.calm = calm;
    // Pause (A11Y-7) : le temps de l'animation s'arrête (garnitures, balancement, caustiques, grain,
    // parallaxe du pointeur) et l'image n'est redessinée que si quelque chose change, comme en
    // mouvement réduit ; la reprise repart du même instant. Figée dès le départ : la composition de
    // la recette (t = 6).
    this.paused = !!pause;
    this.time = pause ? 6 : 0;
    this.dos = dos;
    this.target = target;
    this.fill = fill;
    this.mobile = innerWidth <= 760;
    this.lite = (navigator.hardwareConcurrency || 8) < 4 || (navigator.deviceMemory || 8) < 4;
    this.maxDpr = dpr || Math.min(devicePixelRatio || 1, this.mobile || this.lite ? 1.5 : 1.75);
    this.dpr = this.maxDpr;
    this.manual = manual;
    this.sway = sway;
    this.onUpdate = onUpdate;
    this.state = { pointerX: 0, pointerY: 0, px: 0, py: 0, scroll: 0, appear: 0 };
    this.disposed = false;
    this.visible = true;

    const r = createRenderer(canvas, { preserve: manual });
    // Mappage tonal « PBR Neutral » (Khronos, conçu pour le rendu de produits) : garde les couleurs de
    // marque (fuchsia PAC, bleus Fun Blue) ; AgX reste disponible (tone: 'agx') mais les ternit.
    if (tone === 'neutral') r.toneMapping = THREE.NeutralToneMapping;
    else if (tone === 'aces') r.toneMapping = THREE.ACESFilmicToneMapping;
    r.setPixelRatio(this.dpr);
    this.renderer = r;
    this.post = new Post(r, { dof: dof && !this.lite, bloom: 0.18, grain: manual ? 0 : this.mobile ? 0.008 : 0.011, saturation: tone === 'agx' ? 1.12 : 1, contrast: tone === 'agx' ? 1.04 : 1, vignette: manual ? 0 : 0.26, ...(look || {}) });
    this.scene = new THREE.Scene();
    this.scene.environment = studioEnvironment(r, { gels });
    this.scene.environmentIntensity = 1;
    this.camera = new THREE.PerspectiveCamera(24, 1, 0.5, 120);
    this.camera.layers.enable(0);

    // lumières : principale (avant gauche, haut), contre-jour, débouchage
    const key = new THREE.DirectionalLight(0xfff4e6, 2.2);
    key.position.set(-5, 7, 7);
    const rim = new THREE.DirectionalLight(0xffffff, 1.6);
    rim.position.set(5, 4, -7);
    const fillL = new THREE.DirectionalLight(0xe8f0ff, 0.5);
    fillL.position.set(6, 1, 6);
    this.scene.add(key, rim, fillL);

    // fond
    this.reflRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 });
    const col = (c) => new THREE.Color(c);
    this.sweep = new THREE.Mesh(
      sweepGeometry(),
      new THREE.ShaderMaterial({
        vertexShader: sweepVertex,
        fragmentShader: sweepFragment,
        side: THREE.DoubleSide,
        uniforms: {
          uColA: { value: col(colors?.a || '#efece6') },
          uColB: { value: col(colors?.b || colors?.a || '#efece6') },
          uSplitX: { value: colors?.split ?? 0 },
          uSplitSoft: { value: colors?.soft ?? 0.8 },
          uSpot: { value: new THREE.Vector4(...(spot || [0, FLOOR_Y + 1.6, -6.5, 7])) },
          uFloorY: { value: FLOOR_Y },
          uBottles: { value: Array.from({ length: MAX_BOTTLES }, () => new THREE.Vector4()) },
          uLiquids: { value: Array.from({ length: MAX_BOTTLES }, () => new THREE.Color()) },
          uBlobs: { value: Array.from({ length: MAX_BLOBS }, () => new THREE.Vector4()) },
          uBlobCount: { value: 0 },
          uRefl: { value: this.reflRT.texture },
          uRes: { value: new THREE.Vector2(1, 1) },
          uReflK: { value: 0.32 },
          uCaustic: { value: 0.55 },
          uTime: { value: 0 },
          uExposure: { value: exposure },
        },
      }),
    );
    this.sweep.frustumCulled = false;
    this.scene.add(this.sweep);

    // éléments flottants
    this.garnish = layout ? createGarnish(layout, { lite: this.lite || this.mobile }) : null;
    if (this.garnish) this.scene.add(this.garnish);
    this.blobs = [];
    this.anisotropy = Math.min(r.capabilities.getMaxAnisotropy(), 8);
    this.slots = [];
    this.ready = this.setBottles(bottles);
    this.ready.then(() => (this.isReady = true));
    // première image dessinée avec les bouteilles (la campagne remplace alors son affiche en fondu)
    this.firstFrame = new Promise((r) => (this.onFirstFrame = r));

    this.clock = new THREE.Clock();
    this.frames = [];
    this.resize();
    if (manual) return;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.io = new IntersectionObserver(([e]) => (this.visible = e.isIntersecting), { rootMargin: '100px' });
    this.io.observe(canvas);
    if (interactive && !calm) {
      this.onPointer = (e) => {
        this.state.pointerX = (e.clientX / innerWidth) * 2 - 1;
        this.state.pointerY = (e.clientY / innerHeight) * 2 - 1;
      };
      addEventListener('pointermove', this.onPointer, { passive: true });
    }
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  setColors(colors) {
    const u = this.sweep.material.uniforms;
    u.uColA.value.set(colors.a);
    u.uColB.value.set(colors.b || colors.a);
    if (colors.split !== undefined) u.uSplitX.value = colors.split;
  }

  // Remplace les bouteilles posées (fiche produit, vignettes).
  async setBottles(list) {
    for (const s of this.slots) {
      this.scene.remove(s.pivot);
      if (s.refl) this.scene.remove(s.refl);
      if (s.bottle) disposeObject(s.bottle);
      s.refl?.traverse((o) => o.isMesh && o.material.dispose());
    }
    this.slots = list.map((b, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(b.x || 0, 0, b.z || 0);
      pivot.userData = { index: i };
      this.scene.add(pivot);
      return { ...b, pivot, bottle: null, refl: null, ry: b.ry ?? 0, angle: 0 };
    });
    const slots = this.slots;
    await Promise.all(
      slots.map(async (s) => {
        const bottle = await makeBottle(s.product, { lite: this.lite, anisotropy: this.anisotropy, dos: this.dos });
        if (this.disposed || slots !== this.slots) return disposeObject(bottle);
        s.bottle = bottle;
        s.pivot.add(bottle);
        s.refl = createReflection(bottle, { floorY: { value: FLOOR_Y }, length: { value: BOTTLE_HEIGHT * 0.42 } });
        s.refl.traverse((o) => o.layers.set(LAYER_REFL));
        this.scene.add(s.refl);
      }),
    );
    this.frame();
    return this;
  }

  // Image fixe (vignettes de la boutique) : rendu immédiat, renvoie l'image.
  snapshot(type = 'image/webp', quality = 0.88) {
    this.state.appear = 1;
    if (this.garnish) this.garnish.userData.appear = 1;
    this.update(0, 1);
    this.render(0);
    return this.canvas.toDataURL(type, quality);
  }

  resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.width = w;
    this.height = h;
    this.mobile = innerWidth <= 760;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    const pw = Math.round(w * this.dpr);
    const ph = Math.round(h * this.dpr);
    this.post.setSize(pw, ph);
    this.reflRT.setSize(Math.max(1, pw >> 1), Math.max(1, ph >> 1));
    this.sweep.material.uniforms.uRes.value.set(pw, ph);
    this.camera.aspect = w / h;
    this.frame();
  }

  // Rectangle cible (px CSS, repère du canvas).
  targetRect() {
    const w = this.width;
    const h = this.height;
    const t = this.target?.();
    if (!t) return { x: w * 0.06, y: h * 0.08, w: w * 0.88, h: h * 0.84 };
    const c = this.canvas.getBoundingClientRect();
    return { x: t.left - c.left, y: t.top - c.top, w: t.width, h: t.height };
  }

  // Boîte englobante (monde) des bouteilles posées.
  bottleBox(box = new THREE.Box3()) {
    box.makeEmpty();
    for (const s of this.slots) {
      const r = s.bottle?.userData.radius ?? 0.52;
      const p = s.pivot.position;
      box.expandByPoint(new THREE.Vector3(p.x - r, FLOOR_Y, p.z - r));
      box.expandByPoint(new THREE.Vector3(p.x + r, FLOOR_Y + BOTTLE_HEIGHT, p.z + r));
    }
    if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, FLOOR_Y, -0.5), new THREE.Vector3(0.5, -FLOOR_Y, 0.5));
    return box;
  }

  // Cadrage : distance et décentrement (objectif à bascule) pour que les bouteilles tiennent dans le
  // rectangle cible, entières, avec une marge. Trois passes de correction sur la projection réelle.
  frame() {
    const cam = this.camera;
    const W = this.width;
    const H = this.height;
    if (!W || !H) return;
    const rect = this.targetRect();
    const box = this.bottleBox();
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const want = { w: rect.w * this.fill, h: rect.h * this.fill };
    let d = Math.max(size.y / 2 / tanV / (want.h / H), size.x / 2 / (tanV * (W / H)) / (want.w / W)) + size.z / 2;
    let offX = 0;
    let offY = 0;
    const corners = [];
    for (let i = 0; i < 8; i++) corners.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    this.focus = d;
    for (let pass = 0; pass < 4; pass++) {
      this.place(center, d);
      cam.setViewOffset(W, H, W / 2 - cx + offX, H / 2 - cy + offY, W, H);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      const v = new THREE.Vector3();
      for (const c of corners) {
        v.copy(c).project(cam);
        const px = ((v.x + 1) / 2) * W;
        const py = ((1 - v.y) / 2) * H;
        x0 = Math.min(x0, px);
        x1 = Math.max(x1, px);
        y0 = Math.min(y0, py);
        y1 = Math.max(y1, py);
      }
      const k = Math.max((x1 - x0) / want.w, (y1 - y0) / want.h);
      d *= k;
      offX += (x0 + x1) / 2 - cx;
      offY += (y0 + y1) / 2 - cy;
    }
    this.distance = d;
    this.center = center;
    this.offset = [offX, offY];
    this.focus = d;
    this.fitGarnish();
  }

  // Les éléments flottants restent dans le cadre (marge) : décalage calculé une fois par cadrage.
  fitGarnish() {
    if (!this.garnish) return;
    const cam = this.camera;
    const W = this.width;
    const H = this.height;
    const spread = this.spreadX();
    const v = new THREE.Vector3();
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    // Écran en hauteur (téléphone) : le texte et les boutons sont au-dessus du cadre des bouteilles ;
    // les éléments flottants ne montent pas plus haut que ce cadre (jamais sur les boutons).
    // Écran large : ils restent sous l'en-tête (jamais sur le menu).
    const sousEntete = () => {
      const hd = document.getElementById('site-header');
      return hd ? hd.getBoundingClientRect().bottom - this.canvas.getBoundingClientRect().top : 0;
    };
    const haut = Math.max(0, W / H < 0.9 ? this.targetRect().y : sousEntete());
    for (const p of this.garnish.userData.pieces) {
      p.shift = p.shift || new THREE.Vector2();
      p.shift.set(0, 0);
      if (p.spec.ground) continue;
      v.set(p.base.x * spread, p.base.y, p.base.z).project(cam);
      const px = ((v.x + 1) / 2) * W;
      const py = ((1 - v.y) / 2) * H;
      const depth = cam.position.distanceTo(new THREE.Vector3(p.base.x * spread, p.base.y, p.base.z));
      const worldPerPx = (2 * depth * tanV) / H;
      const half = (p.size * p.spec.s) / worldPerPx; // demi-taille à l'écran (px)
      const m = Math.min(W, H) * 0.03 + half;
      let dx = 0;
      let dy = 0;
      if (px < m) dx = m - px;
      else if (px > W - m) dx = W - m - px;
      if (py < haut + m) dy = haut + m - py;
      else if (py > H - m) dy = H - m - py;
      p.shift.set(dx * worldPerPx, -dy * worldPerPx);
    }
  }

  place(center, d) {
    const cam = this.camera;
    const yaw = this.state.px * 0.07;
    const pitch = 0.075 + this.state.py * 0.03;
    cam.position.set(center.x + Math.sin(yaw) * d * Math.cos(pitch), center.y + Math.sin(pitch) * d, center.z + Math.cos(yaw) * d * Math.cos(pitch));
    cam.lookAt(center);
  }

  // Rectangles projetés (px CSS, repère du canvas) de chaque bouteille : recette « jamais coupée ».
  bounds() {
    const out = [];
    const v = new THREE.Vector3();
    for (const s of this.slots) {
      if (!s.bottle) continue;
      s.bottle.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(s.bottle);
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (let i = 0; i < 8; i++) {
        v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(this.camera);
        x0 = Math.min(x0, ((v.x + 1) / 2) * this.width);
        x1 = Math.max(x1, ((v.x + 1) / 2) * this.width);
        y0 = Math.min(y0, ((1 - v.y) / 2) * this.height);
        y1 = Math.max(y1, ((1 - v.y) / 2) * this.height);
      }
      out.push({ slug: s.product.slug, left: x0, right: x1, top: y0, bottom: y1, width: this.width, height: this.height });
    }
    return out;
  }

  // Baisse la résolution si l'appareil n'arrive pas à tenir ~45 images par seconde.
  adapt(dt) {
    if (TEST || this.calm || this.paused) return;
    this.frames.push(dt);
    if (this.frames.length < 60) return;
    const avg = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    this.frames.length = 0;
    if (avg > 1 / 40 && this.dpr > 0.75) this.dpr = Math.max(0.75, this.dpr - 0.25);
    else if (avg < 1 / 57 && this.dpr < this.maxDpr) this.dpr = Math.min(this.maxDpr, this.dpr + 0.25);
    else return;
    this.resize();
  }

  update(t, dt) {
    const s = this.state;
    const ease = 1 - Math.pow(0.02, dt);
    // en pause, la caméra ne suit plus le pointeur
    if (!this.paused) {
      s.px += (s.pointerX - s.px) * ease * 0.6;
      s.py += (s.pointerY - s.py) * ease * 0.6;
    }
    const shown = this.slots.every((x) => x.bottle) ? 1 : 0;
    s.appear = this.calm || this.paused ? shown : s.appear + (shown - s.appear) * (1 - Math.pow(0.03, dt));
    if (this.center) {
      this.place(this.center, this.distance);
      this.camera.updateMatrixWorld();
    }
    const u = this.sweep.material.uniforms;
    this.onUpdate?.(t, dt);
    this.slots.forEach((slot, i) => {
      const p = slot.pivot;
      const sway = this.calm || !this.sway ? 0 : Math.sin(t * 0.21 + i * 1.9) * 0.1;
      p.rotation.y = slot.ry + slot.angle + sway + (this.sway ? s.px * 0.12 + s.scroll * (i % 2 ? -0.35 : 0.35) : 0);
      if (slot.bottle && slot.refl) updateReflection(slot.refl, FLOOR_Y);
      const b = u.uBottles.value[i];
      if (slot.bottle) {
        b.set(p.position.x, p.position.z, slot.bottle.userData.radius * 0.98, 1);
        u.uLiquids.value[i].set(slot.bottle.userData.liquid).multiplyScalar(slot.bottle.userData.cloudy ? 0.35 : 0.8);
      } else b.w = 0;
    });
    // plateau réutilisé pour moins de bouteilles (série de rendus) : plus d'ombre ni de caustique fantôme
    for (let i = this.slots.length; i < MAX_BOTTLES; i++) u.uBottles.value[i].w = 0;
    if (this.garnish) {
      // en pause, les éléments sont là tout de suite (pas d'apparition en fondu figée à mi-chemin)
      if (this.paused) this.garnish.userData.appear = s.appear;
      updateGarnish(this.garnish, { t, dt, scroll: s.scroll, spreadX: this.spreadX(), calm: this.calm, appear: s.appear });
      garnishBlobs(this.garnish, FLOOR_Y, this.blobs);
      const n = Math.min(MAX_BLOBS, this.blobs.length);
      for (let j = 0; j < n; j++) u.uBlobs.value[j].set(...this.blobs[j]);
      u.uBlobCount.value = n;
    }
    u.uTime.value = t;
  }

  // Composition resserrée sur les écrans étroits (les éléments restent près des bouteilles).
  spreadX() {
    const a = this.width / this.height;
    return a < 0.8 ? 0.62 : a < 1.2 ? 0.8 : 1;
  }

  render(t) {
    const r = this.renderer;
    // 1. reflets (copies en miroir) → texture lue par le sol
    this.camera.layers.set(LAYER_REFL);
    r.setRenderTarget(this.reflRT);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(this.scene, this.camera);
    this.camera.layers.set(0);
    r.setClearColor(0x000000, 1);
    // 2. scène, puis post-traitement
    const H = this.height * this.dpr;
    const dbg = DEBUG;
    if (dbg.has('nobloom')) this.post.settings.bloom = 0;
    this.post.render(this.scene, this.camera, { focus: this.focus || 10, aperture: dbg.has('nodof') ? 0 : this.mobile ? 0.012 : 0.02, maxBlur: dbg.has('nodof') ? 0 : H * 0.008, time: t });
  }

  // Ce qui change l'image quand rien ne bouge tout seul : taille, défilement, caméra, bouteilles, angles.
  signature() {
    const s = this.state;
    const f = (v) => (v || 0).toFixed(4);
    return `${this.width}x${this.height}@${this.dpr}|${f(s.scroll)}|${f(s.px)},${f(s.py)}|${f(s.appear)}|${f(this.distance)}|${this.slots.map((x) => `${x.bottle ? 1 : 0}:${f(x.angle)}`).join(',')}`;
  }

  loop() {
    if (this.disposed) return;
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (!this.visible || document.hidden) return;
    // Mode recette (?test, image fixe à t = 6), mouvement réduit (t = 0) et pause (temps arrêté) : une
    // fois la scène prête et quelques images dessinées, on ne redessine plus que si quelque chose change.
    const still = TEST || this.calm || this.paused;
    if (!still) this.time += dt;
    const t = TEST ? 6 : this.calm ? 0 : this.time;
    this.adapt(dt);
    this.update(t, TEST ? 1 : dt);
    if (still) {
      const sig = this.signature();
      if (sig !== this.stillSig) {
        this.stillSig = sig;
        this.stillFrames = 0;
      }
      if (this.isReady && ++this.stillFrames > (TEST ? 20 : 3)) return;
    }
    this.render(t);
    if (this.isReady && this.onFirstFrame) {
      this.onFirstFrame(this);
      this.onFirstFrame = null;
    }
  }

  setScroll(v) {
    this.state.scroll = v;
  }

  // Bouton « Mettre l'animation en pause » (src/lib/pause.js) : fige ou relance la scène.
  pause(on = true) {
    this.paused = !!on;
    this.stillSig = null;
  }

  // Image fixe (mouvement réduit, recette) : redessiner après un changement que la signature ne voit
  // pas (texture arrivée après coup, comme le dos d'une étiquette).
  redraw() {
    this.stillSig = null;
  }

  dispose() {
    this.disposed = true;
    this.ro?.disconnect();
    this.io?.disconnect();
    if (this.onPointer) removeEventListener('pointermove', this.onPointer);
    this.slots.forEach((s) => s.bottle && disposeObject(s.bottle));
    this.scene.environment?.dispose();
    this.post.dispose();
    this.reflRT.dispose();
    this.renderer.dispose();
    if (this.manual) this.renderer.forceContextLoss();
  }
}
