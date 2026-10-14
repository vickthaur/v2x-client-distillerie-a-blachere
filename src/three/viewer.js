// Bouteille 3D de la fiche produit : on la fait tourner en la faisant glisser (souris, doigt) ou
// au clavier (flèches gauche et droite). Vraie photo quand elle existe, sinon bouteille dessinée.
import * as THREE from 'three';
import { disposeObject } from './bottle.js';
import { makeBottle } from './factory.js';
import { createGarnish, updateGarnish } from './garnish.js';
import { studioEnvironment } from './textures.js';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.99999, 1.0);
  }`;
const fragmentShader = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform vec3 uGlow;
  uniform float uAspect;
  uniform float uStripes;
  uniform float uSpacing;
  uniform float uPixel;
  varying vec2 vUv;
  void main() {
    vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y));
    vec2 d = (vUv - vec2(0.5, 0.48)) * vec2(uAspect, 1.0);
    col = mix(col, uGlow, (1.0 - smoothstep(0.0, 0.62, length(d))) * 0.55);
    // Rayures PAC : fines lignes blanches qui montent d'environ 10° vers la droite.
    if (uStripes > 0.0) {
      float k = -gl_FragCoord.x * 0.17365 + gl_FragCoord.y * 0.98481;
      float f = fract(k / uSpacing);
      float w = 2.2 * uPixel / uSpacing;
      float line = smoothstep(0.0, w * 0.35, f) * (1.0 - smoothstep(w * 0.65, w, f));
      col = mix(col, vec3(1.0), line * 0.9 * uStripes);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

function backdrop() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const mat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color() },
      uBottom: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() },
      uAspect: { value: 1 },
      uStripes: { value: 0 },
      uSpacing: { value: 48 },
      uPixel: { value: 1 },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}

export class BottleViewer {
  constructor(canvas, product, { calm = false, colors, garnish = true } = {}) {
    this.canvas = canvas;
    this.product = product;
    this.calm = calm;
    this.angle = product.label === 'pac' ? 0.35 : 0.12;
    this.velocity = 0;
    this.dragging = false;
    this.visible = true;
    this.disposed = false;
    const mobile = innerWidth <= 760;
    this.lite = (navigator.hardwareConcurrency || 8) < 4;

    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.75 : 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.05;
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.scene.environment = studioEnvironment(r);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    this.camera.position.set(0, 0.05, 8.2);
    this.bg = backdrop();
    const u = this.bg.material.uniforms;
    u.uTop.value.set(colors?.top || product.light);
    u.uBottom.value.set(colors?.bottom || product.color2);
    u.uGlow.value.set(colors?.glow || '#ffffff');
    u.uStripes.value = colors?.stripes ? 1 : 0;
    this.scene.add(this.bg);
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(4, 6, 6);
    const rim = new THREE.DirectionalLight(new THREE.Color(colors?.rim || product.color), 2);
    rim.position.set(-6, 1, -3);
    this.scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.22));
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    if (garnish && product.garnish?.length) {
      this.garnish = createGarnish({ garnish: product.garnish }, this.lite || mobile);
      this.scene.add(this.garnish);
    }
    this.clock = new THREE.Clock();
    this.ready = makeBottle(product, { lite: this.lite, anisotropy: Math.min(r.capabilities.getMaxAnisotropy(), 8) }).then((b) => {
      if (this.disposed) return disposeObject(b);
      this.bottle = b;
      this.pivot.add(b);
      this.kind = b.userData.kind;
      return b;
    });
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.io = new IntersectionObserver(([e]) => (this.visible = e.isIntersecting));
    this.io.observe(canvas);
    this.bind();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    const px = this.renderer.getPixelRatio();
    this.bg.material.uniforms.uPixel.value = px;
    this.bg.material.uniforms.uSpacing.value = Math.max(34, h / 11) * px;
    this.camera.aspect = w / h;
    // Cadre étroit : on recule pour garder la bouteille entière.
    this.camera.position.z = this.camera.aspect < 0.62 ? 8.2 * (0.62 / this.camera.aspect) : 8.2;
    this.camera.updateProjectionMatrix();
    this.bg.material.uniforms.uAspect.value = w / h;
  }

  bind() {
    const c = this.canvas;
    let lastX = 0;
    let lastT = 0;
    c.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      lastX = e.clientX;
      lastT = performance.now();
      c.setPointerCapture(e.pointerId);
      c.classList.add('is-dragging');
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - lastX;
      const now = performance.now();
      const da = (dx / Math.max(c.clientWidth, 1)) * Math.PI * 1.6;
      this.angle += da;
      this.velocity = da / Math.max((now - lastT) / 1000, 0.008);
      lastX = e.clientX;
      lastT = now;
    });
    const up = () => {
      this.dragging = false;
      c.classList.remove('is-dragging');
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.angle -= 0.35;
      else if (e.key === 'ArrowRight') this.angle += 0.35;
      else if (e.key === 'Home') this.angle = 0;
      else return;
      e.preventDefault();
    });
  }

  // Pour les tests et le bouton « face / dos ».
  setAngle(a) {
    this.angle = a;
    this.velocity = 0;
  }

  loop() {
    if (this.disposed) return;
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (!this.visible || document.hidden) return;
    const t = this.clock.elapsedTime;
    if (!this.dragging) {
      this.angle += this.velocity * dt;
      this.velocity *= Math.pow(0.04, dt);
      if (!this.calm && Math.abs(this.velocity) < 0.05) this.angle += dt * 0.18;
    }
    this.pivot.rotation.y = this.angle;
    this.pivot.rotation.z = -0.04;
    this.pivot.position.y = this.calm ? 0 : Math.sin(t * 1.1) * 0.05;
    if (this.garnish)
      updateGarnish(this.garnish, { t: this.calm ? 0 : t, dt, target: this.bottle ? 1 : 0, anchor: this.pivot.position, scale: 0.95, spread: 1.05, calm: this.calm });
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.ro.disconnect();
    this.io.disconnect();
    if (this.bottle) disposeObject(this.bottle);
    this.scene.environment?.dispose();
    this.renderer.dispose();
  }
}
