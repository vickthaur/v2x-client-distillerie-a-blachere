// Studio photo en temps réel : environnement lumineux (boîtes à lumière et bandes verticales, comme
// pour un packshot de bouteille), rendu HDR, puis post-traitement : halo léger sur les reflets
// (bloom), petite profondeur de champ, mappage tonal AgX, vignettage et grain très discrets.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

// ------------------------------------------------------------------ environnement

// gels : { left, right } couleurs facultatives qui teintent les bandes arrière (reflets colorés).
export function studioEnvironment(renderer, { gels = null, warm = 0.0 } = {}) {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x0d0c0b), side: THREE.BackSide }));
  env.add(room);
  const panel = (w, h, intensity, pos, tint = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
    return m;
  };
  const warmTint = new THREE.Color(1, 0.96 - warm * 0.08, 0.9 - warm * 0.2);
  // Grande boîte à lumière de face, en haut à gauche (lumière principale).
  panel(9, 6, 2.6, [-7, 6, 9], warmTint);
  // Deux bandes verticales de côté : les longs reflets nets du verre.
  panel(1.2, 16, 9, [-11, 1, 2]);
  panel(1.2, 16, 7, [11, 1, 3]);
  // Bandes arrière (contre-jour) : les liserés lumineux sur les bords des bouteilles.
  panel(1.6, 16, gels ? 5 : 7, [-8, 0, -10], gels?.left || 0xffffff);
  panel(1.6, 16, gels ? 5 : 7, [8, 0, -10], gels?.right || 0xffffff);
  // Plafond diffusant, et rebond chaud du sol.
  panel(16, 10, 1.4, [0, 14, 0]);
  panel(30, 30, 0.35, [0, -14, 2], 0xfff1df);
  // Petit réflecteur de face, bas (fait briller le bas des étiquettes).
  panel(6, 2.5, 0.9, [3, -3, 12]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.025).texture;
  pmrem.dispose();
  env.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
  return tex;
}

// ------------------------------------------------------------------ post-traitement

const quadVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }`;

// Seuil doux + réduction 4 points.
const brightFrag = /* glsl */ `
  uniform sampler2D tMap;
  uniform vec2 uTexel;
  uniform float uThreshold;
  uniform float uKnee;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tMap, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture2D(tMap, vUv + uTexel * vec2(0.5, -0.5)).rgb
           + texture2D(tMap, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture2D(tMap, vUv + uTexel * vec2(0.5, 0.5)).rgb;
    c *= 0.25;
    float br = max(c.r, max(c.g, c.b));
    float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
    soft = soft * soft / (4.0 * uKnee + 1e-4);
    float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
    gl_FragColor = vec4(min(c * contrib, vec3(16.0)), 1.0);
  }`;

const downFrag = /* glsl */ `
  uniform sampler2D tMap;
  uniform vec2 uTexel;
  varying vec2 vUv;
  void main() {
    vec2 t = uTexel;
    vec3 c = texture2D(tMap, vUv).rgb * 4.0;
    c += texture2D(tMap, vUv + t * vec2(-1.0, -1.0)).rgb;
    c += texture2D(tMap, vUv + t * vec2(1.0, -1.0)).rgb;
    c += texture2D(tMap, vUv + t * vec2(-1.0, 1.0)).rgb;
    c += texture2D(tMap, vUv + t * vec2(1.0, 1.0)).rgb;
    gl_FragColor = vec4(c / 8.0, 1.0);
  }`;

const upFrag = /* glsl */ `
  uniform sampler2D tMap;
  uniform vec2 uTexel;
  uniform float uWeight;
  varying vec2 vUv;
  void main() {
    vec2 t = uTexel;
    vec3 c = texture2D(tMap, vUv + t * vec2(-1.0, 0.0)).rgb * 2.0 + texture2D(tMap, vUv + t * vec2(1.0, 0.0)).rgb * 2.0
           + texture2D(tMap, vUv + t * vec2(0.0, -1.0)).rgb * 2.0 + texture2D(tMap, vUv + t * vec2(0.0, 1.0)).rgb * 2.0
           + texture2D(tMap, vUv + t * vec2(-1.0, -1.0)).rgb + texture2D(tMap, vUv + t * vec2(1.0, -1.0)).rgb
           + texture2D(tMap, vUv + t * vec2(-1.0, 1.0)).rgb + texture2D(tMap, vUv + t * vec2(1.0, 1.0)).rgb
           + texture2D(tMap, vUv).rgb * 4.0;
    gl_FragColor = vec4(c / 16.0 * uWeight, 1.0);
  }`;

// Image finale : profondeur de champ (cercle de confusion calculé depuis la profondeur), halo,
// exposition, mappage tonal (celui du renderer : AgX), « look » (saturation), vignettage, grain.
const compositeFrag = /* glsl */ `
  #include <packing>
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform sampler2D tBloom;
  uniform vec2 uRes;
  uniform float uNear;
  uniform float uFar;
  uniform float uFocus;
  uniform float uAperture;
  uniform float uMaxBlur;
  uniform float uBloom;
  uniform float uSaturation;
  uniform float uContrast;
  uniform float uVignette;
  uniform float uGrain;
  uniform float uTime;
  uniform float uUseDepth;
  varying vec2 vUv;

  float viewZ(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    return -perspectiveDepthToViewZ(d, uNear, uFar);
  }
  float coc(float z) {
    return clamp(uAperture * abs(z - uFocus) / max(z, 0.001) * uRes.y, 0.0, uMaxBlur);
  }

  void main() {
    vec3 col = texture2D(tColor, vUv).rgb;
    if (uUseDepth > 0.5 && uMaxBlur > 0.5) {
      float z0 = viewZ(vUv);
      float c0 = coc(z0);
      // le fond (aucune profondeur écrite) garde le flou de sa distance réelle
      if (c0 > 0.75) {
        vec3 acc = col;
        float wsum = 1.0;
        for (int i = 0; i < 24; i++) {
          float fi = float(i) + 0.5;
          float r = sqrt(fi / 24.0);
          float a = fi * 2.39996323;
          vec2 o = vec2(cos(a), sin(a)) * r * c0;
          vec2 uv = vUv + o / uRes;
          float z = viewZ(uv);
          float c = coc(z);
          // un échantillon net plus proche ne déborde pas sur un fond flou
          float w = (z < z0 - 0.05) ? smoothstep(0.0, 1.0, c / max(r * c0, 0.5)) : 1.0;
          acc += texture2D(tColor, uv).rgb * w;
          wsum += w;
        }
        col = acc / wsum;
      }
    }
    col += texture2D(tBloom, vUv).rgb * uBloom;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    // look : saturation et contraste légers (AgX désature les couleurs franches)
    vec3 c = gl_FragColor.rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, uSaturation);
    c = (c - 0.5) * uContrast + 0.5;
    vec2 q = vUv - 0.5;
    q.x *= uRes.x / uRes.y;
    c *= mix(1.0, smoothstep(1.25, 0.35, length(q)), uVignette);
    gl_FragColor.rgb = clamp(c, 0.0, 1.0);
    #include <colorspace_fragment>
    float n = fract(sin(dot(gl_FragCoord.xy + vec2(uTime * 61.0, uTime * 37.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    gl_FragColor.rgb += n * uGrain;
  }`;

function rt(w, h, opts = {}) {
  return new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, ...opts });
}

export class Post {
  constructor(renderer, { bloom = 0.22, threshold = 1.15, dof = true, grain = 0.012, vignette = 0.28, saturation = 1.12, contrast = 1.04, levels = 5 } = {}) {
    this.renderer = renderer;
    this.settings = { bloom, threshold, dof, grain, vignette, saturation, contrast };
    const samples = Math.min(4, renderer.capabilities.maxSamples || 0);
    const depthTexture = new THREE.DepthTexture(1, 1);
    depthTexture.type = THREE.FloatType;
    this.scene = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples, depthTexture, depthBuffer: true });
    this.levels = levels;
    this.down = Array.from({ length: levels }, () => rt(1, 1));
    this.bright = new THREE.ShaderMaterial({ vertexShader: quadVertex, fragmentShader: brightFrag, uniforms: { tMap: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: threshold }, uKnee: { value: 0.5 } }, depthTest: false, depthWrite: false });
    this.downMat = new THREE.ShaderMaterial({ vertexShader: quadVertex, fragmentShader: downFrag, uniforms: { tMap: { value: null }, uTexel: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false });
    this.upMat = new THREE.ShaderMaterial({
      vertexShader: quadVertex,
      fragmentShader: upFrag,
      uniforms: { tMap: { value: null }, uTexel: { value: new THREE.Vector2() }, uWeight: { value: 1 } },
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
    this.composite = new THREE.ShaderMaterial({
      vertexShader: quadVertex,
      fragmentShader: compositeFrag,
      uniforms: {
        tColor: { value: this.scene.texture },
        tDepth: { value: depthTexture },
        tBloom: { value: this.down[0].texture },
        uRes: { value: new THREE.Vector2(1, 1) },
        uNear: { value: 0.1 },
        uFar: { value: 100 },
        uFocus: { value: 10 },
        uAperture: { value: 0 },
        uMaxBlur: { value: 0 },
        uBloom: { value: bloom },
        uSaturation: { value: saturation },
        uContrast: { value: contrast },
        uVignette: { value: vignette },
        uGrain: { value: grain },
        uTime: { value: 0 },
        uUseDepth: { value: dof ? 1 : 0 },
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: true,
    });
    this.quad = new FullScreenQuad(null);
    this.size = new THREE.Vector2(1, 1);
  }

  setSize(w, h) {
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    if (w === this.size.x && h === this.size.y) return;
    this.size.set(w, h);
    this.scene.setSize(w, h);
    let bw = w;
    let bh = h;
    for (const d of this.down) {
      bw = Math.max(1, bw >> 1);
      bh = Math.max(1, bh >> 1);
      d.setSize(bw, bh);
    }
    this.composite.uniforms.uRes.value.set(w, h);
  }

  pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.quad.render(this.renderer);
  }

  // focus : distance de mise au point (unités de scène) ; aperture : force du flou (0 = aucun).
  render(scene, camera, { focus = 10, aperture = 0, maxBlur = 0, time = 0, target = null } = {}) {
    const r = this.renderer;
    r.setRenderTarget(this.scene);
    r.clear();
    r.render(scene, camera);
    // halo
    const s = this.settings;
    if (s.bloom > 0) {
      this.bright.uniforms.tMap.value = this.scene.texture;
      this.bright.uniforms.uTexel.value.set(1 / this.size.x, 1 / this.size.y);
      this.bright.uniforms.uThreshold.value = s.threshold;
      this.pass(this.bright, this.down[0]);
      for (let i = 1; i < this.levels; i++) {
        this.downMat.uniforms.tMap.value = this.down[i - 1].texture;
        this.downMat.uniforms.uTexel.value.set(1 / this.down[i - 1].width, 1 / this.down[i - 1].height);
        this.pass(this.downMat, this.down[i]);
      }
      for (let i = this.levels - 1; i > 0; i--) {
        this.upMat.uniforms.tMap.value = this.down[i].texture;
        this.upMat.uniforms.uTexel.value.set(1 / this.down[i].width, 1 / this.down[i].height);
        this.upMat.uniforms.uWeight.value = 1;
        this.renderer.setRenderTarget(this.down[i - 1]);
        this.quad.material = this.upMat;
        this.quad.render(this.renderer);
      }
    }
    const u = this.composite.uniforms;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    u.uFocus.value = focus;
    u.uAperture.value = s.dof ? aperture : 0;
    u.uMaxBlur.value = s.dof ? maxBlur : 0;
    u.uBloom.value = s.bloom;
    u.uTime.value = time % 100;
    this.pass(this.composite, target);
  }

  // Sans post-traitement (appareils modestes) : rendu direct à l'écran, mappage tonal du renderer.
  renderDirect(scene, camera) {
    const r = this.renderer;
    r.setRenderTarget(null);
    r.clear();
    r.render(scene, camera);
  }

  dispose() {
    this.scene.depthTexture?.dispose();
    this.scene.dispose();
    this.down.forEach((d) => d.dispose());
    [this.bright, this.downMat, this.upMat, this.composite].forEach((m) => m.dispose());
    this.quad.dispose();
  }
}

// Rendu WebGL commun : couleurs en sRGB, mappage tonal AgX appliqué à l'image finale.
export function createRenderer(canvas, { alpha = false, preserve = false } = {}) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: false, alpha, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: preserve });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.AgXToneMapping;
  r.toneMappingExposure = 1;
  // effacements faits à la main (le halo s'additionne dans ses cibles)
  r.autoClear = false;
  return r;
}
