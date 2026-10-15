// Catalogue du serveur : server/generated/catalogue.js doit être à jour de src/data/products.js.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import './aide.js';
import { CIBLE, genererCatalogueServeur } from '../scripts/server-catalogue.mjs';
import { PRODUITS } from '../server/catalogue.js';

test('le catalogue généré est à jour (sinon : node scripts/server-catalogue.mjs)', async () => {
  assert.equal(readFileSync(CIBLE, 'utf8'), await genererCatalogueServeur());
});

test('63 produits, 76 variantes, prix TTC officiels, photos du site', () => {
  assert.equal(PRODUITS.length, 63);
  assert.equal(PRODUITS.reduce((s, p) => s + p.variantes.length, 0), 76);
  const pac = PRODUITS.find((p) => p.slug === 'pac-citron');
  assert.deepEqual(pac.variantes, [{ id: '1000', volume: '1 L', ml: 1000, prixTTC: 6.7, coffret: false }]);
  assert.equal(pac.photo, '/bouteilles/pac-citron/vignette.webp');
  assert.equal(pac.tva, 5.5);
  for (const p of PRODUITS) {
    assert.equal(p.tva, p.alcool ? 20 : 5.5, p.slug);
    for (const v of p.variantes) assert.ok(v.prixTTC > 0, `${p.slug} ${v.id}`);
  }
});
