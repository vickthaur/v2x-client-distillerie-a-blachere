// Scène 3D : carrousel de bouteilles façon Fruitzz, gros plan au scroll, fond réfracté.
// Seules les bouteilles de la liste visible apparaissent (les spiritueux n'y entrent qu'après
// la vérification de l'âge) ; les autres restent hors champ, invisibles.
import * as THREE from 'three';
import { createBottle } from './bottle.js';
import { studioEnvironment } from './textures.js';
import { createGarnish, updateGarnish } from './garnish.js';
import { createBackdrop } from './backdrop.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
const TEXT_FONT = '"Archivo Variable", "Arial Black", sans-serif';

// Poussière dorée qui monte lentement : un seul draw call, animée dans le shader.
function buildMotes(count) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 16;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
    seed[i * 2] = 0.15 + Math.random() * 0.5;
    seed[i * 2 + 1] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#ffffff') }, uPixel: { value: 1 }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec2 aSeed;
      uniform float uTime;
      uniform float uPixel;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.y = mod(p.y + 5.0 + uTime * aSeed.x * 0.5, 10.0) - 5.0;
        p.x += sin(uTime * 0.7 + aSeed.y * 40.0) * 0.18;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.03 + aSeed.y * aSeed.y * 0.16) * uPixel / -mv.z;
        vAlpha = smoothstep(-5.0, -3.5, p.y) * (1.0 - smoothstep(3.5, 5.0, p.y));
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.0, d) * vAlpha * uOpacity * 0.55;
        gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.6) * a, a);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

export class BottleScene {
  constructor(canvas, products, { calm = false } = {}) {
    this.canvas = canvas;
    this.products = products;
    this.calm = calm;
    this.state = { current: 0, target: 0, focus: 0, spin: 0, spinTarget: 0, drag: 0, mouseX: 0, mouseY: 0 };
    this.list = products.map((_, i) => i);
    this.mobile = innerWidth <= 760;
    // Petits appareils : liquide opaque au lieu du vrai volume transparent (moins coûteux).
    this.lite = (navigator.hardwareConcurrency || 8) < 4 || (navigator.deviceMemory || 8) < 4;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.mobile, alpha: false, powerPreference: 'high-performance' });
    this.maxDpr = Math.min(devicePixelRatio, this.mobile || this.lite ? 1.5 : 2);
    this.dpr = this.maxDpr;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.camera.position.set(0, 0, 10);
    this.scene.environment = studioEnvironment(this.renderer);

    this.backdrop = createBackdrop();
    this.scene.add(this.backdrop);

    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(4, 6, 6);
    this.tint = new THREE.DirectionalLight(0xffffff, 2.4);
    this.tint.position.set(-6, 1, -3);
    this.tint2 = new THREE.PointLight(0xffffff, 5, 14);
    this.tint2.position.set(3, -3, 3);
    this.scene.add(key, this.tint, this.tint2, new THREE.AmbientLight(0xffffff, 0.2));

    const u = this.backdrop.material.uniforms;
    this.colors = {
      a: u.uA.value,
      b: u.uB.value,
      deep: u.uDeep.value,
      light: u.uLight.value,
      ta: new THREE.Color(),
      tb: new THREE.Color(),
      tdeep: new THREE.Color(),
      tlight: new THREE.Color(),
    };

    this.motes = buildMotes(this.mobile ? 60 : 130);
    this.scene.add(this.motes);

    const anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 8);
    this.bottles = products.map((p, i) => {
      const b = createBottle(p, i, { lite: this.lite, anisotropy });
      b.visible = false;
      this.scene.add(b);
      return b;
    });
    this.garnish = products.map((p) => {
      const g = createGarnish(p, this.lite || this.mobile);
      this.scene.add(g);
      return g;
    });

    this.resize();
    addEventListener('resize', () => this.resize());
    this.clock = new THREE.Clock();
    this.frames = [];
    this.textOffset = 0;
  }

  // Couleurs (fond, lumières teintées) et nom géant du produit actif.
  setProduct(i, immediate = false) {
    const p = this.products[i];
    const c = this.colors;
    c.ta.set(p.color);
    c.tb.set(p.color2);
    c.tdeep.set(p.deep);
    c.tlight.set(p.light);
    if (immediate) {
      c.a.copy(c.ta);
      c.b.copy(c.tb);
      c.deep.copy(c.tdeep);
      c.light.copy(c.tlight);
    }
    const name = p.name.join(' ').toUpperCase();
    this.backdrop.userData.setText(`${name}   ${name}   `, TEXT_FONT);
  }

  // Liste des produits affichés (indices dans products), et produit actif.
  setList(list, activeIndex) {
    this.list = list;
    const k = Math.max(0, list.indexOf(activeIndex));
    this.state.current = this.state.target = k;
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.mobile = w <= 760;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Écran étroit : on recule la caméra pour garder la bouteille entière.
    this.camera.position.z = this.camera.aspect < 0.8 ? (10 / Math.max(this.camera.aspect, 0.45)) * 0.6 : 10;
    this.camera.updateProjectionMatrix();
    this.motes.material.uniforms.uPixel.value = h * this.dpr * 0.5;
    const u = this.backdrop.material.uniforms;
    u.uRes.value.set(w, h);
    u.uBand.value = clamp(w * 0.2, 120, 320) * 1.05;
  }

  // Baisse la résolution si l'appareil n'arrive pas à tenir ~50 images par seconde.
  adapt(dt) {
    this.frames.push(dt);
    if (this.frames.length < 90) return;
    const avg = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    this.frames.length = 0;
    if (avg > 1 / 48 && this.dpr > 1) this.dpr = Math.max(1, this.dpr - 0.25);
    else if (avg < 1 / 58 && this.dpr < this.maxDpr) this.dpr = Math.min(this.maxDpr, this.dpr + 0.25);
    else return;
    this.renderer.setPixelRatio(this.dpr);
    this.resize();
  }

  // Décalage d'une bouteille (position k dans la liste) par rapport à l'index courant.
  // À partir de 4 bouteilles le carrousel tourne en boucle ; en dessous il reste linéaire.
  offset(k) {
    const n = this.list.length;
    let d = k - this.state.current;
    if (n >= 4) {
      d = ((d % n) + n) % n;
      if (d > n / 2) d -= n;
    }
    return d;
  }

  update() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.calm ? 0 : this.clock.elapsedTime;
    const s = this.state;
    this.adapt(dt);

    const n = this.list.length;
    let diff = s.target - s.current;
    if (n >= 4) {
      diff = ((diff % n) + n) % n;
      if (diff > n / 2) diff -= n;
    }
    s.current += diff * (1 - Math.pow(0.0015, dt));
    if (n >= 4) s.current = ((s.current % n) + n) % n;
    s.spin += (s.spinTarget - s.spin) * (1 - Math.pow(0.006, dt)); // indépendant de la cadence d'images

    const c = this.colors;
    const k = 1 - Math.pow(0.02, dt);
    c.a.lerp(c.ta, k);
    c.b.lerp(c.tb, k);
    c.deep.lerp(c.tdeep, k);
    c.light.lerp(c.tlight, k);
    this.tint.color.copy(c.a);
    this.tint2.color.copy(c.b);
    const mu = this.motes.material.uniforms;
    mu.uTime.value = this.clock.elapsedTime;
    mu.uColor.value.copy(c.a);

    const f = smooth(clamp(s.focus, 0, 1));
    const u = this.backdrop.material.uniforms;
    u.uTime.value = t;
    u.uStory.value = f;
    u.uHero.value = clamp(1 - s.focus * 1.6, 0, 1);
    if (!this.calm) this.textOffset += dt * 0.02;
    u.uOffset.value = this.textOffset;

    const spacing = this.mobile ? 1.55 : 2.2;
    const focusX = this.mobile ? 0 : 1.55;
    const activeK = Math.round(((s.target % n) + n) % n);
    const activeIndex = this.list[activeK];

    this.bottles.forEach((b, i) => {
      const ud = b.userData;
      const k2 = this.list.indexOf(i);
      const inList = k2 >= 0;
      // Apparition / disparition douce (changement d'univers)
      ud.appear += ((inList ? 1 : 0) - ud.appear) * (1 - Math.pow(0.004, dt));
      if (!inList && ud.appear < 0.01) {
        b.visible = false;
        return;
      }
      b.visible = true;
      const d = inList ? this.offset(k2) + s.drag : ud.lastD ?? 0;
      ud.lastD = d;
      const ad = Math.abs(d);
      const isActive = i === activeIndex;
      const bob = Math.sin(t * 1.1 + ud.seed) * 0.08;

      // Pose carrousel
      const cx = d * spacing;
      const cy = (this.mobile ? 0.95 : 0.5) + bob + ad * 0.12;
      const cz = -ad * 1.3;
      // Au-delà de 2,5 positions, la bouteille rétrécit jusqu'à disparaître (évite le saut de bord).
      const cs = lerp(0.96, 0.72, clamp(ad, 0, 1)) * clamp((3 - ad) / 0.6, 0, 1);
      const crz = -0.2 + d * 0.06 + Math.sin(t * 0.7 + ud.seed) * 0.03;
      const cry = Math.sin(t * 0.5 + ud.seed) * 0.3 - d * 0.28;

      // Pose gros plan : la bouteille active avance, les autres s'envolent vers le bas.
      let fx, fy, fz, fs, frz, fry;
      if (isActive) {
        fx = focusX + s.mouseX * 0.12;
        fy = (this.mobile ? 1.25 : -0.05) + bob * 0.5 + s.mouseY * 0.08;
        fz = this.mobile ? 0.6 : 2.3;
        fs = this.mobile ? 0.82 : 1.18;
        frz = -0.32;
        fry = s.spin + Math.sin(t * 0.6) * 0.08;
      } else {
        fx = cx * 1.8;
        fy = cy - 7 - ad;
        fz = cz;
        fs = cs;
        frz = crz;
        fry = cry;
      }

      const drop = (1 - smooth(ud.appear)) * 7;
      b.position.set(lerp(cx, fx, f), lerp(cy, fy, f) - drop, lerp(cz, fz, f));
      const scale = lerp(cs, fs, f) * (0.4 + 0.6 * ud.appear);
      b.scale.setScalar(Math.max(scale, 0.0001));
      b.visible = scale > 0.002;
      b.rotation.z = lerp(crz, frz, f);
      b.rotation.y = lerp(isActive ? wrapNear(cry, fry) : cry, fry, f);
      b.rotation.x = lerp(0.1, 0.06, f);
    });

    this.garnish.forEach((g, i) =>
      updateGarnish(g, {
        t,
        dt,
        target: i === activeIndex && this.bottles[i].visible ? 1 : 0,
        anchor: this.bottles[i].position,
        scale: this.bottles[i].scale.x,
        spread: lerp(1, this.mobile ? 0.8 : 1.1, f),
        calm: this.calm,
      }),
    );

    this.renderer.render(this.scene, this.camera);
  }

  // Index (dans products) de la bouteille sous le pointeur, ou -1.
  pick(clientX, clientY) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1), this.camera);
    const hits = ray.intersectObjects(this.bottles.filter((b) => b.visible), true);
    if (!hits.length) return -1;
    let o = hits[0].object;
    while (o && o.userData.index === undefined) o = o.parent;
    return o ? o.userData.index : -1;
  }

  // « Photos » des bouteilles pour les cartes de la boutique : chaque bouteille seule, sur son fond.
  async snapshots(indices, width = 480, height = 600) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.setSize(width, height, false);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.05;
    const scene = new THREE.Scene();
    scene.environment = studioEnvironment(r);
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(4, 6, 6);
    const tint = new THREE.DirectionalLight(0xffffff, 2.2);
    tint.position.set(-6, 1, -3);
    scene.add(key, tint, new THREE.AmbientLight(0xffffff, 0.2));
    const bg = createBackdrop();
    const u = bg.material.uniforms;
    u.uRes.value.set(width, height);
    u.uText.value = 0;
    scene.add(bg);
    const cam = new THREE.PerspectiveCamera(30, width / height, 0.1, 50);
    cam.position.set(0, 0.05, 7.4);
    const out = {};
    for (const i of indices) {
      const p = this.products[i];
      u.uA.value.set(p.color);
      u.uB.value.set(p.color2);
      u.uDeep.value.set(p.deep);
      u.uLight.value.set(p.light);
      tint.color.set(p.color);
      const clone = this.bottles[i].clone();
      clone.position.set(0, -0.05, 0);
      clone.scale.setScalar(1);
      clone.rotation.set(0.08, -0.35, -0.08);
      clone.visible = true;
      scene.add(clone);
      r.render(scene, cam);
      out[p.id] = r.domElement.toDataURL('image/webp', 0.88);
      scene.remove(clone);
      await new Promise((res) => setTimeout(res, 0));
    }
    scene.environment.dispose();
    r.dispose();
    r.forceContextLoss();
    return out;
  }
}

// Ramène l'angle a dans la même révolution que b (évite les tours parasites pendant le fondu).
function wrapNear(a, b) {
  const TAU = Math.PI * 2;
  return a - Math.round((a - b) / TAU) * TAU;
}
