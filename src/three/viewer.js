// Bouteille 3D de la fiche produit : plateau de studio neutre, la bouteille posée (ombre, reflet au
// sol), qu'on fait tourner en la faisant glisser (souris, doigt) ou au clavier (flèches gauche et
// droite, Origine). Vraie photo quand elle existe, sinon bouteille construite en code.
import { Stage } from './stage.js';

const TEST = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');

export class BottleViewer {
  constructor(canvas, product, { calm = false, colors = null, target = null } = {}) {
    this.canvas = canvas;
    this.product = product;
    this.calm = calm;
    this.angle = 0;
    this.velocity = 0;
    this.dragging = false;
    this.stage = new Stage(canvas, {
      colors: colors || { a: product.alcool ? '#ddd6cb' : '#ebe7e0' },
      bottles: [{ product, x: 0, ry: product.label === 'pac' ? 0.06 : 0 }],
      target,
      fill: 0.9,
      calm,
      sway: false,
      interactive: false,
      spot: [0, -0.2, -6.5, 6],
      onUpdate: (t, dt) => this.tick(t, dt),
    });
    this.ready = this.stage.ready.then(() => {
      this.kind = this.stage.slots[0]?.bottle?.userData.kind;
      this.labelSource = this.stage.slots[0]?.bottle?.userData.labelSource || null;
      return this;
    });
    this.bind();
  }

  tick(t, dt) {
    const slot = this.stage.slots[0];
    if (!slot) return;
    if (!this.dragging) {
      this.angle += this.velocity * dt;
      this.velocity *= Math.pow(0.04, dt);
      // rotation automatique très lente (sauf spiritueux et mouvement réduit)
      // (pas en recette : la bouteille reste de face)
      if (!this.calm && !TEST && Math.abs(this.velocity) < 0.05) this.angle += dt * 0.12;
    }
    slot.angle = this.angle;
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

  bounds() {
    return this.stage.bounds();
  }

  dispose() {
    this.stage.dispose();
  }
}
