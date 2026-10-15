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
      // PAC Citron tournée pour présenter « pac » et l'ovale « Sirop citron » (étiquette réelle)
      { product: products[0], x: -0.72, ry: -0.25 },
      { product: products[1] || products[0], x: 0.72, ry: -0.1 },
    ],
  }),
  pac: (products) => ({ colors: { a: '#c2177f' }, gels: { left: 0xff6fbf, right: 0xffd36f }, layout: 'pac', bottles: [{ product: products[0], x: 0, ry: -0.4 }] }),
  // Couleur Provence : trois bouteilles sur le plateau crème, sans décor
  provence: (products) => ({
    colors: { a: '#e6dcc5' },
    gels: null,
    layout: null,
    bottles: products.slice(0, 3).map((product, i, all) => ({ product, x: (i - (all.length - 1) / 2) * 1.15, z: i === 1 ? 0.3 : 0, ry: 0 })),
  }),
  funblue: (products) => ({ colors: { a: '#1f56a8' }, gels: { left: 0x6fd8ff, right: 0x6fb2ff }, layout: 'funblue', bottles: [{ product: products[0], x: 0, ry: -0.05 }] }),
};

export class HeroScene {
  constructor(canvas, { scene = 'duo', products, target = null, calm = false } = {}) {
    // dos : false → les bouteilles restent de face : le dos des étiquettes n'est pas téléchargé
    this.stage = new Stage(canvas, { ...SCENES[scene](products), target, calm, fill: 0.94, dos: false });
    this.ready = this.stage.ready;
    // bouteilles posées et première image dessinée : l'affiche peut s'effacer
    this.shown = this.ready.then(() => this.stage.firstFrame);
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
