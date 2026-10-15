// QR code (modèle 2, mode octet, correction d'erreur M) pour le lien de partage de la démo.
// Implémentation compacte d'après la norme ISO/IEC 18004 (même découpage que qrcodegen de
// Nayuki) : encodage, Reed-Solomon, placement, choix du meilleur masque.

const ECC_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const BLOCS_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
const FORMAT_M = 0; // bits de niveau pour M

function modulesBruts(v) {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) {
    const n = Math.floor(v / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (v >= 7) r -= 36;
  }
  return r;
}
const motsDonnees = (v) => Math.floor(modulesBruts(v) / 8) - ECC_M[v] * BLOCS_M[v];

// Corps de Galois GF(256), polynôme 0x11D
function mul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
function diviseur(degre) {
  const r = new Array(degre).fill(0);
  r[degre - 1] = 1;
  let racine = 1;
  for (let i = 0; i < degre; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = mul(r[j], racine);
      if (j + 1 < r.length) r[j] ^= r[j + 1];
    }
    racine = mul(racine, 0x02);
  }
  return r;
}
function reste(donnees, div) {
  const r = div.map(() => 0);
  for (const b of donnees) {
    const f = b ^ r.shift();
    r.push(0);
    div.forEach((c, i) => {
      r[i] ^= mul(c, f);
    });
  }
  return r;
}

function positionsAlignement(v) {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2;
  const pas = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
  const r = [6];
  for (let p = v * 4 + 17 - 7; r.length < n; p -= pas) r.splice(1, 0, p);
  return r;
}

/**
 * @param {string} texte
 * @returns {{ taille: number, modules: boolean[][] }}
 */
export function qrcode(texte) {
  const octets = [...new TextEncoder().encode(texte)];
  let v = 1;
  for (; v <= 40; v++) {
    const bits = 4 + (v <= 9 ? 8 : 16) + octets.length * 8;
    if (bits <= motsDonnees(v) * 8) break;
  }
  if (v > 40) throw new Error('Texte trop long pour un QR code.');
  // Flux de bits
  const bb = [];
  const ajouter = (val, n) => {
    for (let i = n - 1; i >= 0; i--) bb.push((val >>> i) & 1);
  };
  ajouter(0b0100, 4);
  ajouter(octets.length, v <= 9 ? 8 : 16);
  for (const o of octets) ajouter(o, 8);
  const capacite = motsDonnees(v) * 8;
  ajouter(0, Math.min(4, capacite - bb.length));
  ajouter(0, (8 - (bb.length % 8)) % 8);
  for (let p = 0xec; bb.length < capacite; p ^= 0xec ^ 0x11) ajouter(p, 8);
  const donnees = [];
  for (let i = 0; i < bb.length; i += 8) donnees.push(bb.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  // Blocs et correction d'erreur, entrelacés
  const nb = BLOCS_M[v];
  const ecc = ECC_M[v];
  const brut = Math.floor(modulesBruts(v) / 8);
  const courts = nb - (brut % nb);
  const longCourt = Math.floor(brut / nb);
  const div = diviseur(ecc);
  const blocs = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const d = donnees.slice(k, k + longCourt - ecc + (i < courts ? 0 : 1));
    k += d.length;
    const e = reste(d, div);
    if (i < courts) d.push(0);
    blocs.push(d.concat(e));
  }
  const mots = [];
  for (let i = 0; i < blocs[0].length; i++) {
    blocs.forEach((b, j) => {
      if (i !== longCourt - ecc || j >= courts) mots.push(b[i]);
    });
  }

  // Matrice
  const n = v * 4 + 17;
  const m = Array.from({ length: n }, () => new Array(n).fill(false));
  const fonction = Array.from({ length: n }, () => new Array(n).fill(false));
  const poser = (x, y, noir) => {
    m[y][x] = noir;
    fonction[y][x] = true;
  };
  for (let i = 0; i < n; i++) {
    poser(6, i, i % 2 === 0);
    poser(i, 6, i % 2 === 0);
  }
  const reperes = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < n && y >= 0 && y < n) poser(x, y, d !== 2 && d !== 4);
      }
  };
  reperes(3, 3);
  reperes(n - 4, 3);
  reperes(3, n - 4);
  const al = positionsAlignement(v);
  al.forEach((a, i) =>
    al.forEach((b, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) poser(a + dx, b + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }),
  );
  const formater = (masque) => {
    const d = (FORMAT_M << 3) | masque;
    let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const bits = ((d << 10) | r) ^ 0x5412;
    const b = (i) => ((bits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) poser(8, i, b(i));
    poser(8, 7, b(6));
    poser(8, 8, b(7));
    poser(7, 8, b(8));
    for (let i = 9; i < 15; i++) poser(14 - i, 8, b(i));
    for (let i = 0; i < 8; i++) poser(n - 1 - i, 8, b(i));
    for (let i = 8; i < 15; i++) poser(8, n - 15 + i, b(i));
    poser(8, n - 8, true);
  };
  formater(0);
  if (v >= 7) {
    let r = v;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const bits = (v << 12) | r;
    for (let i = 0; i < 18; i++) {
      const noir = ((bits >>> i) & 1) !== 0;
      const a = n - 11 + (i % 3);
      const b = Math.floor(i / 3);
      poser(a, b, noir);
      poser(b, a, noir);
    }
  }
  // Données en zigzag
  let i = 0;
  for (let droite = n - 1; droite >= 1; droite -= 2) {
    if (droite === 6) droite = 5;
    for (let vert = 0; vert < n; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = droite - j;
        const monte = ((droite + 1) & 2) === 0;
        const y = monte ? n - 1 - vert : vert;
        if (!fonction[y][x] && i < mots.length * 8) {
          m[y][x] = ((mots[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }
  // Masques : le meilleur selon les pénalités de la norme
  const masquer = (k) => {
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        if (fonction[y][x]) continue;
        let inv;
        switch (k) {
          case 0: inv = (x + y) % 2 === 0; break;
          case 1: inv = y % 2 === 0; break;
          case 2: inv = x % 3 === 0; break;
          case 3: inv = (x + y) % 3 === 0; break;
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: inv = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: inv = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: inv = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
        }
        if (inv) m[y][x] = !m[y][x];
      }
  };
  const penalite = () => {
    let p = 0;
    const lignes = (get) => {
      for (let a = 0; a < n; a++) {
        let couleur = false;
        let run = 0;
        const hist = [0, 0, 0, 0, 0, 0, 0];
        const pousser = (r) => {
          if (hist[0] === 0) r += n;
          hist.pop();
          hist.unshift(r);
        };
        const motif = () => {
          const c = hist[1];
          const core = c > 0 && hist[2] === c && hist[3] === c * 3 && hist[4] === c && hist[5] === c;
          return (core && hist[0] >= c * 4 && hist[6] >= c ? 1 : 0) + (core && hist[6] >= c * 4 && hist[0] >= c ? 1 : 0);
        };
        for (let b = 0; b < n; b++) {
          if (get(a, b) === couleur) {
            run++;
            if (run === 5) p += 3;
            else if (run > 5) p++;
          } else {
            pousser(run);
            if (!couleur) p += motif() * 40;
            couleur = get(a, b);
            run = 1;
          }
        }
        // fin de ligne
        if (couleur) {
          pousser(run);
          run = 0;
        }
        run += n;
        pousser(run);
        p += motif() * 40;
      }
    };
    lignes((a, b) => m[a][b]);
    lignes((a, b) => m[b][a]);
    for (let y = 0; y < n - 1; y++)
      for (let x = 0; x < n - 1; x++) {
        const c = m[y][x];
        if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
      }
    let noirs = 0;
    for (const l of m) for (const c of l) if (c) noirs++;
    const total = n * n;
    p += (Math.ceil(Math.abs(noirs * 20 - total * 10) / total) - 1) * 10;
    return p;
  };
  let meilleur = 0;
  let min = Infinity;
  for (let k = 0; k < 8; k++) {
    masquer(k);
    formater(k);
    const p = penalite();
    if (p < min) {
      min = p;
      meilleur = k;
    }
    masquer(k);
  }
  masquer(meilleur);
  formater(meilleur);
  return { taille: n, modules: m };
}

// Chemin SVG des modules noirs (un carré par module, regroupés par ligne)
export function cheminQr(modules) {
  let d = '';
  modules.forEach((ligne, y) => {
    let x = 0;
    while (x < ligne.length) {
      if (!ligne[x]) {
        x++;
        continue;
      }
      let l = 1;
      while (x + l < ligne.length && ligne[x + l]) l++;
      d += `M${x} ${y}h${l}v1h-${l}z`;
      x += l;
    }
  });
  return d;
}
