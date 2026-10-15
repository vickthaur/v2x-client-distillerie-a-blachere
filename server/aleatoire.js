// Hasard de la maquette : identifiants aléatoires (crypto) pour ce qui est créé en direct, et
// générateur pseudo-aléatoire déterministe (mulberry32, graine tirée de l'identifiant de la démo)
// pour le jeu de démonstration, qui doit être le même pour une même démo à une même date.
import { createHash, randomBytes } from 'node:crypto';

const B32 = 'abcdefghijklmnopqrstuvwxyz234567';

// Identifiant « préfixe_ » + n caractères base32 aléatoires (docs/crm-espace-pro.md, § 4).
export function idAleatoire(prefixe, n = 12) {
  const octets = randomBytes(n);
  let s = '';
  for (const o of octets) s += B32[o & 31];
  return prefixe ? `${prefixe}_${s}` : s;
}

export const ID_DEMO = /^[a-z2-7]{16}$/;
export const nouvelIdDemo = () => idAleatoire('', 16);
export const ID = /^[a-z]{3}_[a-z2-7]{12}$/;

const graineDe = (texte) => createHash('sha256').update(texte).digest().readUInt32LE(0);

// Générateur déterministe. Chaque rubrique du jeu de démonstration a son propre flux
// (prng(`${idDemo}:commandes`)…), pour que l'ajout de données dans une rubrique ne décale pas les
// autres (les comptes de démonstration gardent ainsi leurs identifiants d'une remise à zéro à l'autre).
export function prng(graine) {
  let a = graineDe(String(graine));
  const suivant = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const g = {
    suivant,
    // entier de min à max inclus
    entier: (min, max) => min + Math.floor(suivant() * (max - min + 1)),
    reel: (min, max) => min + suivant() * (max - min),
    chance: (p) => suivant() < p,
    choix: (liste) => liste[Math.floor(suivant() * liste.length)],
    // choix pondéré : poids(x) ≥ 0
    pondere(liste, poids) {
      const p = liste.map(poids);
      const total = p.reduce((s, x) => s + x, 0);
      let r = suivant() * total;
      for (let i = 0; i < liste.length; i++) {
        r -= p[i];
        if (r < 0) return liste[i];
      }
      return liste[liste.length - 1];
    },
    melanger(liste) {
      const l = [...liste];
      for (let i = l.length - 1; i > 0; i--) {
        const j = Math.floor(suivant() * (i + 1));
        [l[i], l[j]] = [l[j], l[i]];
      }
      return l;
    },
    id(prefixe, n = 12) {
      let s = '';
      for (let i = 0; i < n; i++) s += B32[Math.floor(suivant() * 32)];
      return `${prefixe}_${s}`;
    },
    chiffres(n) {
      let s = '';
      for (let i = 0; i < n; i++) s += Math.floor(suivant() * 10);
      return s;
    },
  };
  return g;
}
