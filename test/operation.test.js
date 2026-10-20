// Octobre Rose : affiché du 1er au 31 octobre (jours à Paris), retiré de lui-même le 1er novembre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { operationEnCours } from '../src/data/operation.js';

test('Octobre Rose : du 1er octobre 0 h au 31 octobre 23 h 59, heure de Paris', () => {
  // 30 septembre 23 h 59 à Paris (UTC+2) : pas encore
  assert.equal(operationEnCours(new Date('2026-09-30T21:59:00Z')), null);
  // 1er octobre 0 h à Paris
  assert.equal(operationEnCours(new Date('2026-09-30T22:00:00Z'))?.id, 'octobre-rose-2026');
  // 31 octobre 23 h 59 à Paris (UTC+1 après le changement d'heure du 25)
  assert.equal(operationEnCours(new Date('2026-10-31T22:59:00Z'))?.id, 'octobre-rose-2026');
  // 1er novembre 0 h à Paris : retiré partout (bandeaux, pastilles, fiche, panier, commandes)
  assert.equal(operationEnCours(new Date('2026-10-31T23:00:00Z')), null);
  assert.equal(operationEnCours(new Date('2026-11-15T10:00:00Z')), null);
});

test('Octobre Rose : ?operation=<id> le montre encore après la date (présentation de la maquette)', () => {
  assert.equal(operationEnCours(new Date('2026-11-15T10:00:00Z'), 'octobre-rose-2026')?.id, 'octobre-rose-2026');
});
