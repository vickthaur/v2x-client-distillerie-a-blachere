// Fond de la scène, dessiné dans la 3D (et non en CSS) pour que le verre et les liquides le
// réfractent : dégradé aux couleurs du produit, halos qui dérivent, et nom géant en contour qui
// défile derrière les bouteilles (le « marquee » de Fruitzz).
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.99999, 1.0);
  }`;

const fragmentShader = /* glsl */ `
  uniform vec3 uA;
  uniform vec3 uB;
  uniform vec3 uDeep;
  uniform vec3 uLight;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uStory;
  uniform float uHero;
  uniform float uBand;
  uniform float uTileAspect;
  uniform float uOffset;
  uniform float uText;
  uniform sampler2D uTextMap;
  varying vec2 vUv;

  float glow(vec2 uv, vec2 c, vec2 r, float edge) {
    vec2 d = (uv - c) / r;
    return 1.0 - smoothstep(0.0, edge, length(d));
  }

  void main() {
    vec2 uv = vUv;
    // Fond : sombre en haut, couleur profonde en bas
    vec3 top = uDeep * 0.42;
    vec3 col = mix(uDeep, top, smoothstep(0.0, 1.0, uv.y));
    // Halo central derrière la bouteille active
    col = mix(col, mix(uDeep, uA, 0.5), glow(uv, vec2(0.5, 0.56), vec2(0.6, 0.56), 0.95) * 0.7);
    // Lumière qui monte du bas
    col = mix(col, mix(uDeep, uA, 0.62), glow(uv, vec2(0.5, -0.2), vec2(1.05, 0.7), 1.0) * 0.75);
    // Deux halos qui dérivent lentement (couleur principale à gauche, secondaire à droite)
    vec2 c1 = vec2(0.12 + sin(uTime * 0.05) * 0.08, 0.02 + cos(uTime * 0.04) * 0.06);
    vec2 c2 = vec2(0.9 + cos(uTime * 0.045) * 0.07, 0.08 + sin(uTime * 0.05) * 0.07);
    col = mix(col, uA, glow(uv, c1, vec2(0.42, 0.55), 1.0) * 0.36);
    col = mix(col, uB, glow(uv, c2, vec2(0.42, 0.55), 1.0) * 0.4);
    // Gros plan (scroll) : la lumière se déplace vers la bouteille, à droite
    vec3 story = mix(uDeep * 0.5, uDeep, uv.y < 0.5 ? 1.0 : 1.0 - (uv.y - 0.5));
    story = mix(story, mix(uDeep, uA, 0.6), glow(uv, vec2(0.7, 0.5), vec2(0.5, 0.62), 1.0));
    story = mix(story, mix(uDeep, uB, 0.55), glow(uv, vec2(0.08, -0.05), vec2(0.5, 0.5), 1.0) * 0.8);
    col = mix(col, story, uStory);
    // Vignettage : bords plus sombres, la lumière reste sur les bouteilles
    float vig = smoothstep(1.15, 0.25, length((uv - vec2(0.5, 0.52)) * vec2(1.0, 1.25)));
    col *= mix(0.5, 1.0, vig);

    // Nom géant en contour, qui défile (bande centrée un peu au-dessus du milieu)
    vec2 px = uv * uRes;
    float center = uRes.y * 0.5 + uBand * 0.08;
    float ty = (px.y - (center - uBand * 0.5)) / uBand;
    if (ty > 0.0 && ty < 1.0 && uText > 0.001) {
      float tx = fract(px.x / (uBand * uTileAspect) + uOffset);
      float a = texture2D(uTextMap, vec2(tx, ty)).a;
      col = mix(col, uLight, a * 0.32 * uHero * uText);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

// Texture du texte : le nom du produit en contour, répété sans couture.
function textCanvas(text, font) {
  const c = document.createElement('canvas');
  const H = 256;
  const g = c.getContext('2d');
  g.font = `italic 900 ${H * 0.86}px ${font}`;
  const w = Math.ceil(g.measureText(text).width + H * 0.5);
  c.width = Math.min(8192, w);
  c.height = H;
  g.font = `italic 900 ${H * 0.86}px ${font}`;
  g.textBaseline = 'middle';
  g.strokeStyle = '#fff';
  g.lineWidth = 3;
  g.lineJoin = 'round';
  g.strokeText(text, H * 0.25, H * 0.53);
  return c;
}

export function createBackdrop() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  // Texture du nom : recréée à chaque changement (sa largeur dépend du nom ; WebGL ne redimensionne
  // pas une texture déjà allouée).
  const makeMap = (canvas) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return t;
  };
  const textMap = makeMap(document.createElement('canvas'));
  const mat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uA: { value: new THREE.Color() },
      uB: { value: new THREE.Color() },
      uDeep: { value: new THREE.Color() },
      uLight: { value: new THREE.Color() },
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uStory: { value: 0 },
      uHero: { value: 1 },
      uBand: { value: 280 },
      uTileAspect: { value: 4 },
      uOffset: { value: 0 },
      uText: { value: 1 },
      uTextMap: { value: textMap },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.userData.setText = (text, font) => {
    const c = textCanvas(text, font);
    mat.uniforms.uTextMap.value.dispose();
    mat.uniforms.uTextMap.value = makeMap(c);
    mat.uniforms.uTileAspect.value = c.width / c.height;
  };
  return mesh;
}
