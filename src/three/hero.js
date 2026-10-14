// Scènes de campagne (accueil, pages PAC Citron et Fun Blue) : les bouteilles posées sur un plateau
// de couleur de marque, citrons, tranches, glaçons et feuilles de menthe en suspension.
// Le cadrage suit un rectangle du DOM (les bouteilles y tiennent entières, marge comprise).
import { Stage } from './stage.js';

export const SCENES = {
  // accueil : PAC à gauche sur fuchsia, Fun Blue à droite sur bleu, fondu entre les deux
  duo: (products) => ({
    colors: { a: '#c2177f', b: '#1f56a8', split: 0, soft: 1.3 },
    gels: { left: 0xff6fbf, right: 0x6fb2ff },
    layout: 'duo',
    bottles: [
      { product: products[0], x: -0.72, ry: 0.1 },
      { product: products[1] || products[0], x: 0.72, ry: -0.1 },
    ],
  }),
  pac: (products) => ({ colors: { a: '#c2177f' }, gels: { left: 0xff6fbf, right: 0xffd36f }, layout: 'pac', bottles: [{ product: products[0], x: 0, ry: 0.08 }] }),
  funblue: (products) => ({ colors: { a: '#1f56a8' }, gels: { left: 0x6fd8ff, right: 0x6fb2ff }, layout: 'funblue', bottles: [{ product: products[0], x: 0, ry: -0.08 }] }),
};

export class HeroScene {
  constructor(canvas, { scene = 'duo', products, target = null, calm = false } = {}) {
    this.stage = new Stage(canvas, { ...SCENES[scene](products), target, calm, fill: 0.94 });
    this.ready = this.stage.ready;
  }

  setScroll(v) {
    this.stage.setScroll(v);
  }

  reframe() {
    this.stage.frame();
  }

  bounds() {
    return this.stage.bounds();
  }

  dispose() {
    this.stage.dispose();
  }
}
