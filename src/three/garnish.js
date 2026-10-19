// Éléments en volume autour des bouteilles (citrons, tranches, glaçons, feuilles de menthe), rendus
// comme en photo : peau du citron grenue (pores, cire), tranche avec quartiers, membranes et vésicules
// de jus translucides, glaçons qui réfractent (arêtes arrondies, bulles, fêlure, buée), feuilles de
// menthe nervurées et légèrement translucides. Mouvement lent et pesant (aucun rebond).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvas, rng, fbm, normalFromHeight, heightFromCanvas, blurHeight, dataTexture, once } from './tex.js';

// ------------------------------------------------------------------ citron : peau

function peelTextures() {
  return once('peel', () => {
    const W = 1024;
    const H = 512;
    const r = rng(17);
    const mott = fbm(3, 6, 4);
    // couleur
    const col = canvas(W, H);
    const g = col.getContext('2d');
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      const v = y / H;
      const tip = Math.pow(Math.max(0, 1 - Math.min(v, 1 - v) / 0.16), 2); // vers les pointes
      for (let x = 0; x < W; x++) {
        const m = mott(x / W, v);
        const o = (y * W + x) * 4;
        // jaune citron, un peu plus vert et plus sombre aux pointes
        img.data[o] = 236 + (m - 0.5) * 26 - tip * 30;
        img.data[o + 1] = 196 + (m - 0.5) * 30 - tip * 6;
        img.data[o + 2] = 28 + (m - 0.5) * 18 + tip * 6;
        img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // pores : petits creux, un peu plus orangés
    const hc = canvas(W, H);
    const hg = hc.getContext('2d');
    hg.fillStyle = '#c8c8c8';
    hg.fillRect(0, 0, W, H);
    const pores = [];
    for (let i = 0; i < 16000; i++) {
      const x = r() * W;
      const y = r() * H;
      const rad = 0.8 + r() * 1.9;
      pores.push([x, y, rad]);
      hg.fillStyle = `rgba(0,0,0,${0.35 + r() * 0.4})`;
      hg.beginPath();
      hg.arc(x, y, rad, 0, Math.PI * 2);
      hg.fill();
    }
    g.globalAlpha = 0.18;
    g.fillStyle = '#c98d12';
    pores.forEach(([x, y, rad], i) => {
      if (i % 3) return;
      g.beginPath();
      g.arc(x, y, rad * 0.8, 0, Math.PI * 2);
      g.fill();
    });
    g.globalAlpha = 1;
    let hgt = heightFromCanvas(hc);
    const und = fbm(9, 4, 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) hgt[y * W + x] = hgt[y * W + x] * 0.7 + und(x / W, y / H) * 0.3;
    hgt = blurHeight(hgt, W, H, 1);
    // rugosité : pores plus mats
    const rc = canvas(W, H);
    const rg = rc.getContext('2d');
    const rimg = rg.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      const v = 120 + (1 - hgt[i]) * 120;
      rimg.data[i * 4] = rimg.data[i * 4 + 1] = rimg.data[i * 4 + 2] = Math.min(255, v);
      rimg.data[i * 4 + 3] = 255;
    }
    rg.putImageData(rimg, 0, 0);
    return {
      map: dataTexture(col, { srgb: true, anisotropy: 8 }),
      normal: dataTexture(normalFromHeight(hgt, W, H, 5)),
      roughness: dataTexture(rc),
    };
  });
}

function peelMaterial() {
  const t = peelTextures();
  return new THREE.MeshPhysicalMaterial({
    map: t.map,
    normalMap: t.normal,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 0.62,
    roughnessMap: t.roughness,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.32,
    sheen: 0.25,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color('#fff2b0'),
    // diffusion sous la peau (approximation) : un peu de lumière propre, chaude
    emissive: new THREE.Color('#f2a900'),
    emissiveIntensity: 0.04,
  });
}

// ------------------------------------------------------------------ citron : coupe (tranche)

function sliceTextures() {
  return once('slice', () => {
    const S = 1024;
    const C = S / 2;
    const r = rng(23);
    const col = canvas(S);
    const g = col.getContext('2d');
    const hc = canvas(S);
    const h = hc.getContext('2d');
    const tc = canvas(S); // transmission (pulpe translucide)
    const t = tc.getContext('2d');
    const rc = canvas(S); // rugosité
    const rr = rc.getContext('2d');
    const R = C * 0.995;
    // fonds
    [
      [g, '#e9bd17'],
      [h, '#808080'],
      [t, '#000'],
      [rr, '#707070'],
    ].forEach(([c, f]) => {
      c.fillStyle = f;
      c.fillRect(0, 0, S, S);
    });
    const disc = (c, rad, fill) => {
      c.fillStyle = fill;
      c.beginPath();
      c.arc(C, C, rad, 0, Math.PI * 2);
      c.fill();
    };
    // écorce (anneau extérieur) et albédo blanc
    disc(g, R, '#e2b30f');
    disc(g, R * 0.955, '#f2c629');
    const alb = g.createRadialGradient(C, C, R * 0.8, C, C, R * 0.94);
    alb.addColorStop(0, '#f6ecc6');
    alb.addColorStop(1, '#fbf4dc');
    g.fillStyle = alb;
    g.beginPath();
    g.arc(C, C, R * 0.94, 0, Math.PI * 2);
    g.fill();
    disc(rr, R * 0.94, '#9a9a9a');
    disc(t, R * 0.94, '#262626');
    // quartiers
    const N = 10;
    const rIn = R * 0.1;
    const rOut = R * 0.84;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2 + 0.02 + r() * 0.03;
      const a1 = ((i + 1) / N) * Math.PI * 2 - 0.02 - r() * 0.03;
      const wedge = (c) => {
        c.beginPath();
        c.moveTo(C + Math.cos(a0) * rIn, C + Math.sin(a0) * rIn);
        c.arc(C, C, rOut * (0.97 + r() * 0.03), a0, a1);
        c.lineTo(C + Math.cos(a1) * rIn, C + Math.sin(a1) * rIn);
        c.closePath();
      };
      const pulp = g.createRadialGradient(C, C, rIn, C, C, rOut);
      pulp.addColorStop(0, '#f5e7a0');
      pulp.addColorStop(0.5, '#f7df6c');
      pulp.addColorStop(1, '#f3d24e');
      g.fillStyle = pulp;
      wedge(g);
      g.fill();
      t.fillStyle = '#d0d0d0';
      wedge(t);
      t.fill();
      rr.fillStyle = '#262626';
      wedge(rr);
      rr.fill();
      h.fillStyle = '#9a9a9a';
      wedge(h);
      h.fill();
      // vésicules de jus : gouttes allongées dans l'axe du rayon
      g.save();
      wedge(g);
      g.clip();
      h.save();
      wedge(h);
      h.clip();
      for (let k = 0; k < 150; k++) {
        const rad = rIn + Math.sqrt(r()) * (rOut - rIn);
        const a = a0 + r() * (a1 - a0);
        const x = C + Math.cos(a) * rad;
        const y = C + Math.sin(a) * rad;
        const len = 10 + r() * 26 * (rad / rOut);
        const wid = 3 + r() * 5;
        [g, h].forEach((c, ci) => {
          c.save();
          c.translate(x, y);
          c.rotate(a);
          const gr = c.createRadialGradient(0, 0, 0, 0, 0, len);
          if (ci === 0) {
            gr.addColorStop(0, `rgba(255,248,200,${0.35 + r() * 0.3})`);
            gr.addColorStop(1, 'rgba(232,190,40,0)');
          } else {
            gr.addColorStop(0, 'rgba(255,255,255,0.55)');
            gr.addColorStop(1, 'rgba(255,255,255,0)');
          }
          c.fillStyle = gr;
          c.beginPath();
          c.ellipse(0, 0, len, wid, 0, 0, Math.PI * 2);
          c.fill();
          c.restore();
        });
      }
      g.restore();
      h.restore();
    }
    // membranes entre les quartiers et petits pépins
    g.strokeStyle = 'rgba(252,247,226,0.95)';
    h.strokeStyle = '#b8b8b8';
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      [g, h].forEach((c) => {
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(C + Math.cos(a) * rIn, C + Math.sin(a) * rIn);
        c.lineTo(C + Math.cos(a) * rOut, C + Math.sin(a) * rOut);
        c.stroke();
      });
    }
    disc(g, rIn * 1.05, '#fbf3d6');
    disc(t, rIn * 1.05, '#202020');
    disc(rr, rIn * 1.05, '#9a9a9a');
    for (let k = 0; k < 2; k++) {
      const a = r() * Math.PI * 2;
      const rad = rIn * 2 + r() * R * 0.25;
      g.fillStyle = '#efe3b3';
      g.save();
      g.translate(C + Math.cos(a) * rad, C + Math.sin(a) * rad);
      g.rotate(a);
      g.beginPath();
      g.ellipse(0, 0, 22, 11, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    const hgt = blurHeight(heightFromCanvas(hc), S, S, 2, false);
    return {
      map: dataTexture(col, { srgb: true, anisotropy: 8, wrap: THREE.ClampToEdgeWrapping }),
      normal: dataTexture(normalFromHeight(hgt, S, S, 4, false), { wrap: THREE.ClampToEdgeWrapping }),
      transmission: dataTexture(tc, { wrap: THREE.ClampToEdgeWrapping }),
      roughness: dataTexture(rc, { wrap: THREE.ClampToEdgeWrapping }),
    };
  });
}

function cutMaterial() {
  const t = sliceTextures();
  return new THREE.MeshPhysicalMaterial({
    map: t.map,
    normalMap: t.normal,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 1,
    roughnessMap: t.roughness,
    metalness: 0,
    transmission: 0.55,
    transmissionMap: t.transmission,
    thickness: 0.06,
    ior: 1.34,
    attenuationColor: new THREE.Color('#f6dc5c'),
    attenuationDistance: 0.12,
    clearcoat: 0.7,
    clearcoatRoughness: 0.08,
    emissive: new THREE.Color('#f2c22a'),
    emissiveIntensity: 0.05,
  });
}

// ------------------------------------------------------------------ glaçon

function iceTextures() {
  return once('ice', () => {
    const S = 512;
    const r = rng(41);
    const n = fbm(5, 3, 4);
    const hc = canvas(S);
    const h = hc.getContext('2d');
    h.fillStyle = '#808080';
    h.fillRect(0, 0, S, S);
    // gouttes de buée
    for (let i = 0; i < 260; i++) {
      const x = r() * S;
      const y = r() * S;
      const rad = 1.5 + r() * r() * 9;
      const gr = h.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      h.fillStyle = gr;
      h.beginPath();
      h.arc(x, y, rad, 0, Math.PI * 2);
      h.fill();
    }
    let hgt = heightFromCanvas(hc);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) hgt[y * S + x] = hgt[y * S + x] * 0.75 + n(x / S, y / S) * 0.25;
    hgt = blurHeight(hgt, S, S, 1);
    // rugosité : zones givrées (plus mates), gouttes brillantes
    const rc = canvas(S);
    const rg = rc.getContext('2d');
    const img = rg.createImageData(S, S);
    const frost = fbm(8, 2, 3);
    for (let i = 0; i < S * S; i++) {
      const x = i % S;
      const y = (i - x) / S;
      const f = Math.max(0, frost(x / S, y / S) - 0.45) * 2.2;
      const v = 40 + f * 170 - Math.max(0, hgt[i] - 0.55) * 200;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = Math.max(10, Math.min(255, v));
      img.data[i * 4 + 3] = 255;
    }
    rg.putImageData(img, 0, 0);
    // fêlure (plan intérieur)
    const cc = canvas(256);
    const cg = cc.getContext('2d');
    cg.strokeStyle = 'rgba(255,255,255,1)';
    cg.lineCap = 'round';
    let x = 30;
    let y = 40;
    for (let i = 0; i < 14; i++) {
      const nx = x + 10 + r() * 18;
      const ny = y + (r() - 0.3) * 28;
      cg.lineWidth = 1 + r() * 2.5;
      cg.beginPath();
      cg.moveTo(x, y);
      cg.lineTo(nx, ny);
      cg.stroke();
      if (r() < 0.4) {
        cg.lineWidth = 0.8;
        cg.beginPath();
        cg.moveTo(nx, ny);
        cg.lineTo(nx + (r() - 0.5) * 40, ny + 10 + r() * 30);
        cg.stroke();
      }
      x = nx;
      y = ny;
    }
    return {
      normal: dataTexture(normalFromHeight(hgt, S, S, 3)),
      roughness: dataTexture(rc),
      crack: dataTexture(cc, { wrap: THREE.ClampToEdgeWrapping }),
    };
  });
}

function iceGeometry(seed) {
  return once(`iceGeo:${seed}`, () => {
    const g = new RoundedBoxGeometry(0.42, 0.4, 0.43, 5, 0.07);
    const n = fbm(seed, 2, 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const k = (n((x + 1) * 0.5 + z * 0.3, (y + 1) * 0.5) - 0.5) * 0.05;
      p.setXYZ(i, x * (1 + k), y * (1 + k * 0.6), z * (1 - k * 0.8));
    }
    g.computeVertexNormals();
    g.userData.shared = true;
    return g;
  });
}

function ice(seed) {
  const t = iceTextures();
  const group = new THREE.Group();
  const cube = new THREE.Mesh(
    iceGeometry(seed % 3),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.3,
      roughnessMap: t.roughness,
      normalMap: t.normal,
      normalScale: new THREE.Vector2(0.6, 0.6),
      transmission: 1,
      thickness: 0.32,
      ior: 1.31,
      attenuationColor: new THREE.Color('#e3f2fb'),
      attenuationDistance: 1.4,
      specularIntensity: 1,
      envMapIntensity: 1.3,
      side: THREE.DoubleSide,
    }),
  );
  group.add(cube);
  // bulles d'air et fêlure, visibles à travers la glace
  const r = rng(seed * 13 + 1);
  const bubbleMat = once('bubbleMat', () => new THREE.MeshStandardMaterial({ color: 0xe9f4fa, roughness: 0.25, metalness: 0, transparent: true, opacity: 0.7 }));
  const bubbleGeo = once('bubbleGeo', () => new THREE.SphereGeometry(1, 8, 6));
  // cœur un peu laiteux : petites bulles serrées au centre, quelques plus grosses autour
  for (let i = 0; i < 26; i++) {
    const b = new THREE.Mesh(bubbleGeo, bubbleMat);
    const core = i < 18;
    const rad = core ? 0.0025 + r() * 0.004 : 0.005 + r() * r() * 0.008;
    const spread = core ? 0.07 : 0.2;
    b.scale.setScalar(rad);
    b.position.set((r() - 0.5) * spread, (r() - 0.5) * spread * 0.9, (r() - 0.5) * spread);
    group.add(b);
  }
  const crack = new THREE.Mesh(
    once('crackGeo', () => new THREE.PlaneGeometry(0.22, 0.22)),
    once('crackMat', () => new THREE.MeshStandardMaterial({ color: 0xdfeef6, alphaMap: iceTextures().crack, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.4, transparent: true, opacity: 0.55 })),
  );
  crack.rotation.set(r() * 3, r() * 3, r() * 3);
  group.add(crack);
  return group;
}

// ------------------------------------------------------------------ menthe

function mintTextures() {
  return once('mint', () => {
    const W = 512;
    const H = 1024;
    const r = rng(29);
    // contour : feuille ovale, pointe, bord denté
    const shape = (c) => {
      c.beginPath();
      const pts = [];
      const N = 90;
      for (let i = 0; i <= N; i++) {
        const t = i / N; // 0 = base, 1 = pointe
        const width = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 0.9) * (1 - 0.25 * t);
        const teeth = i > 4 && i < N - 3 ? (i % 2 ? 0.035 : -0.01) : 0;
        pts.push([W / 2 + (width * 0.45 + teeth) * W, H * 0.97 - t * H * 0.93]);
      }
      c.moveTo(W / 2, H * 0.97);
      pts.forEach(([x, y]) => c.lineTo(x, y));
      [...pts].reverse().forEach(([x, y]) => c.lineTo(W - x, y));
      c.closePath();
    };
    const col = canvas(W, H);
    const g = col.getContext('2d');
    g.clearRect(0, 0, W, H);
    shape(g);
    const base = g.createLinearGradient(0, H, 0, 0);
    base.addColorStop(0, '#5aa646');
    base.addColorStop(0.6, '#43943c');
    base.addColorStop(1, '#3a8a37');
    g.fillStyle = base;
    g.fill();
    g.save();
    shape(g);
    g.clip();
    // nervures plus claires
    const vein = (c, w, color) => {
      c.strokeStyle = color;
      c.lineCap = 'round';
      c.lineWidth = w;
      c.beginPath();
      c.moveTo(W / 2, H * 0.97);
      c.lineTo(W / 2, H * 0.06);
      c.stroke();
      for (let i = 0; i < 7; i++) {
        const y = H * (0.85 - i * 0.11);
        [-1, 1].forEach((sgn) => {
          c.lineWidth = w * 0.55;
          c.beginPath();
          c.moveTo(W / 2, y);
          c.quadraticCurveTo(W / 2 + sgn * W * 0.18, y - H * 0.04, W / 2 + sgn * W * 0.38, y - H * 0.11);
          c.stroke();
        });
      }
    };
    vein(g, 9, 'rgba(176,214,120,0.75)');
    // grain : petites bosses plus sombres et plus claires
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = r() < 0.5 ? `rgba(20,60,20,${r() * 0.12})` : `rgba(160,210,120,${r() * 0.1})`;
      g.beginPath();
      g.arc(r() * W, r() * H, 2 + r() * 5, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    // relief : creux des nervures, cloques entre elles
    const hc = canvas(W, H);
    const h = hc.getContext('2d');
    h.fillStyle = '#808080';
    h.fillRect(0, 0, W, H);
    const bumps = fbm(12, 8, 3);
    const img = h.getImageData(0, 0, W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const v = 110 + bumps(x / W, y / H) * 90;
        const o = (y * W + x) * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
      }
    h.putImageData(img, 0, 0);
    vein(h, 12, '#2a2a2a');
    const hgt = blurHeight(heightFromCanvas(hc), W, H, 2, false);
    return {
      map: dataTexture(col, { srgb: true, anisotropy: 8, wrap: THREE.ClampToEdgeWrapping }),
      normal: dataTexture(normalFromHeight(hgt, W, H, 4, false), { wrap: THREE.ClampToEdgeWrapping }),
    };
  });
}

function mintGeometry() {
  return once('mintGeo', () => {
    const g = new THREE.PlaneGeometry(0.5, 0.9, 14, 26);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      // pliée le long de la nervure, cambrée, bords légèrement ondulés
      const z = Math.abs(x) * 0.32 - (y * y) * 0.22 + Math.sin(y * 18) * Math.abs(x) * 0.04;
      p.setZ(i, z);
    }
    g.computeVertexNormals();
    g.userData.shared = true;
    return g;
  });
}

function mint() {
  const t = mintTextures();
  return new THREE.Mesh(
    mintGeometry(),
    once(
      'mintMat',
      () =>
        new THREE.MeshPhysicalMaterial({
          map: t.map,
          alphaTest: 0.5,
          normalMap: t.normal,
          normalScale: new THREE.Vector2(1.3, 1.3),
          roughness: 0.46,
          metalness: 0,
          sheen: 0.5,
          sheenRoughness: 0.5,
          sheenColor: new THREE.Color('#cfe8b0'),
          transmission: 0.3,
          thickness: 0.01,
          attenuationColor: new THREE.Color('#5fae3e'),
          attenuationDistance: 0.02,
          side: THREE.DoubleSide,
        }),
    ),
  );
}

// ------------------------------------------------------------------ citron, tranche, demi-citron

function lemonGeometry(half = false) {
  return once(`lemonGeo:${half}`, () => {
    const pts = [];
    const N = 64;
    const from = half ? N / 2 : 0;
    if (!half) pts.push(new THREE.Vector2(0, -0.585), new THREE.Vector2(0.03, -0.575), new THREE.Vector2(0.055, -0.55));
    for (let i = from; i <= N; i++) {
      const t = i / N;
      const y = -0.5 + t;
      const r = 0.36 * Math.pow(Math.sin(Math.PI * Math.min(Math.max(t, 0.02), 0.98)), 0.78);
      pts.push(new THREE.Vector2(r, y));
    }
    pts.push(new THREE.Vector2(0.055, 0.55), new THREE.Vector2(0.03, 0.575), new THREE.Vector2(0, 0.585));
    const g = new THREE.LatheGeometry(pts, 72);
    g.scale(1, 1, 0.94);
    g.userData.shared = true;
    return g;
  });
}

function lemon() {
  return new THREE.Mesh(lemonGeometry(), once('peelMat', peelMaterial));
}

function lemonSlice() {
  const geo = once('sliceGeo', () => {
    const g = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 96, 1, false);
    g.userData.shared = true;
    return g;
  });
  return new THREE.Mesh(geo, [once('peelMat', peelMaterial), once('cutMat', cutMaterial), once('cutMat', cutMaterial)]);
}

// Demi-citron (posé, coupe visible) : moitié de citron + disque de coupe.
function lemonHalf() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(lemonGeometry(true), once('peelMat', peelMaterial)));
  const face = new THREE.Mesh(
    once('cutDisc', () => {
      const d = new THREE.CircleGeometry(0.357, 72);
      d.rotateX(Math.PI / 2);
      d.scale(1, 1, 0.94);
      d.userData.shared = true;
      return d;
    }),
    once('cutMat', cutMaterial),
  );
  face.position.y = -0.002; // face coupée tournée vers −y (le dôme est au-dessus)
  g.add(face);
  return g;
}

const BUILD = { lemon, lemonSlice, lemonHalf, ice: () => ice(1), ice2: () => ice(2), mint };

// ------------------------------------------------------------------ compositions

// x, y, z en unités de scène autour du centre du groupe de bouteilles (sol en y = −1,6).
// s : échelle ; r : rotation initiale ; ground : posé au sol (immobile) ; depth : parallaxe.
// Glaçons des campagnes PAC et duo derrière les bouteilles (z négatif) : devant l'étiquette fuchsia,
// la glace translucide prenait sa couleur et faisait plastique (surtout au téléphone, où la
// composition se resserre sur les bouteilles).
export const LAYOUTS = {
  duo: [
    { k: 'lemonSlice', p: [-1.85, 0.95, 0.55], s: 0.62, r: [1.15, 0.2, 0.3] },
    { k: 'lemon', p: [-2.15, -0.45, -0.75], s: 0.92, r: [0.4, 0.5, 1.35] },
    { k: 'lemonSlice', p: [-1.25, 1.95, -1.45], s: 0.5, r: [1.25, 0.5, -0.3] },
    { k: 'ice', p: [-1.6, -0.85, -1.15], s: 0.95, r: [0.4, 0.7, 0.2] },
    { k: 'mint', p: [-2.55, 1.55, -0.3], s: 0.8, r: [0.3, 0.6, 0.9] },
    { k: 'lemonHalf', p: [-1.55, -1.6, 0.85], s: 0.9, r: [0, 0.6, 0], ground: true },
    { k: 'ice2', p: [1.8, 1.15, -1.0], s: 0.9, r: [0.6, 0.3, 0.5] },
    { k: 'ice', p: [2.2, -0.35, -0.95], s: 0.8, r: [0.2, 1.1, 0.4] },
    { k: 'mint', p: [1.45, 1.95, -0.85], s: 0.9, r: [-0.5, -0.4, -0.7] },
    { k: 'mint', p: [2.45, 0.65, 0.95], s: 0.75, r: [0.9, -0.6, 0.4] },
    { k: 'lemonSlice', p: [1.95, -0.95, 1.05], s: 0.55, r: [1.3, -0.3, 0.6] },
    { k: 'ice2', p: [1.35, -1.6, 0.9], s: 0.95, r: [0, 0.4, 0], ground: true },
    { k: 'mint', p: [0.1, 2.25, -1.7], s: 0.6, r: [0.2, 0.2, 2.2] },
    { k: 'ice', p: [-0.15, 1.55, -2.7], s: 0.55, r: [0.3, 0.3, 0.3] },
  ],
  pac: [
    { k: 'lemonSlice', p: [-1.25, 1.0, 0.6], s: 0.62, r: [1.15, 0.2, 0.3] },
    { k: 'lemon', p: [1.35, -0.2, -0.6], s: 0.95, r: [0.4, 0.5, 1.2] },
    { k: 'lemonSlice', p: [1.05, 1.55, -0.2], s: 0.55, r: [0.5, -0.3, -0.6] },
    { k: 'ice', p: [-1.35, -0.8, -1.0], s: 0.9, r: [0.4, 0.7, 0.2] },
    { k: 'lemonSlice', p: [-0.6, 2.0, -1.5], s: 0.45, r: [0.9, 0.4, 1.2] },
    { k: 'ice2', p: [1.5, -1.0, -0.9], s: 0.8, r: [0.3, 0.2, 0.6] },
    { k: 'lemonHalf', p: [-0.95, -1.6, 1.0], s: 0.9, r: [0, 0.3, 0], ground: true },
    { k: 'lemon', p: [-1.75, 0.2, -1.6], s: 0.8, r: [1.2, 0.2, 0.4] },
  ],
  funblue: [
    { k: 'ice', p: [-1.25, 0.95, 0.6], s: 0.9, r: [0.6, 0.3, 0.5] },
    { k: 'mint', p: [1.3, 1.3, 0.3], s: 0.9, r: [-0.5, -0.4, -0.7] },
    { k: 'ice2', p: [1.35, -0.4, -0.8], s: 0.85, r: [0.2, 1.1, 0.4] },
    { k: 'mint', p: [-1.45, -0.3, -0.9], s: 0.85, r: [0.9, -0.6, 0.4] },
    { k: 'ice', p: [-1.1, -1.0, 1.1], s: 0.8, r: [0.4, 0.7, 0.2] },
    { k: 'mint', p: [0.4, 2.1, -1.4], s: 0.7, r: [0.2, 0.2, 2.2] },
    { k: 'lemonSlice', p: [1.45, -1.05, 1.1], s: 0.55, r: [1.3, -0.3, 0.6] },
    { k: 'ice2', p: [0.95, -1.6, 1.05], s: 0.95, r: [0, 0.4, 0], ground: true },
  ],
};

export function createGarnish(layout, { lite = false } = {}) {
  const group = new THREE.Group();
  const specs = (LAYOUTS[layout] || []).filter((_, i) => !lite || i % 3 !== 2);
  const r = rng(layout.length * 31 + 7);
  const pieces = specs.map((spec, i) => {
    const pivot = new THREE.Group();
    const obj = BUILD[spec.k]();
    pivot.add(obj);
    pivot.rotation.set(...spec.r);
    pivot.scale.setScalar(spec.s);
    group.add(pivot);
    // posé au sol : demi-citron couché, coupe vers l'objectif ; le bas de l'objet touche le sol
    let lift = 0;
    if (spec.ground) {
      if (spec.k === 'lemonHalf') obj.rotation.x = -Math.PI / 2 - 0.55;
      pivot.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(pivot);
      lift = -box.min.y;
    }
    return {
      lift,
      pivot,
      spec,
      kind: spec.k,
      base: new THREE.Vector3(...spec.p),
      rot: new THREE.Euler(...spec.r),
      phase: r() * Math.PI * 2,
      speed: 0.6 + r() * 0.5,
      spin: new THREE.Vector3((r() - 0.5) * 0.16, (r() - 0.5) * 0.22, (r() - 0.5) * 0.12),
      size: spec.k === 'lemon' ? 0.42 : spec.k === 'mint' ? 0.3 : spec.k === 'lemonSlice' ? 0.42 : 0.24,
      index: i,
    };
  });
  group.userData = { pieces, appear: 0 };
  return group;
}

// Mouvement lent et pesant : dérive douce, rotation lente, montée liée au défilement, parallaxe.
// spreadX : resserre la composition sur les écrans étroits.
export function updateGarnish(group, { t, dt, scroll = 0, spreadX = 1, calm = false, appear = 1 }) {
  const u = group.userData;
  u.appear += (appear - u.appear) * (1 - Math.pow(0.05, dt));
  group.visible = u.appear > 0.01;
  const m = calm ? 0.2 : 1;
  for (const p of u.pieces) {
    const { base, spec } = p;
    const k = smoothstep(0, 1, (u.appear - p.index * 0.025) / 0.7);
    if (spec.ground) {
      p.pivot.position.set(base.x * spreadX, base.y + p.lift, base.z);
      p.pivot.scale.setScalar(spec.s * Math.max(0.0001, k));
      continue;
    }
    const w = t * p.speed * 0.32;
    const depth = 1 + base.z * 0.18;
    const sx = p.shift?.x || 0;
    const sy = p.shift?.y || 0;
    p.pivot.position.set(
      base.x * spreadX + sx + Math.sin(w + p.phase) * 0.07 * m,
      base.y + sy + Math.sin(w * 0.8 + p.phase * 1.7) * 0.09 * m + scroll * 1.6 * depth,
      base.z + Math.sin(w * 0.6 + p.phase * 0.7) * 0.05 * m,
    );
    p.pivot.rotation.set(p.rot.x + (p.spin.x * t + scroll * 0.8) * m, p.rot.y + (p.spin.y * t + scroll * 0.5) * m, p.rot.z + p.spin.z * t * m);
    p.pivot.scale.setScalar(spec.s * Math.max(0.0001, k));
  }
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Ombres douces des éléments sur le sol : x, z, hauteur au-dessus du sol, rayon.
export function garnishBlobs(group, floorY, out = []) {
  out.length = 0;
  if (!group.visible) return out;
  const v = new THREE.Vector3();
  for (const p of group.userData.pieces) {
    p.pivot.getWorldPosition(v);
    out.push([v.x, v.z, Math.max(0, v.y - floorY), p.size * p.spec.s * group.scale.x]);
  }
  return out;
}
