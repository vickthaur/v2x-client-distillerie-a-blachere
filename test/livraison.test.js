// Frais de livraison montés dès la fiche (src/lib/livraison.js) : le barème de repli du navigateur
// est celui du serveur (server/regles.js, PARAMETRES_DEFAUT), et le devis local donne les mêmes
// montants que fraisLivraison et francoRestant, au centime près.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import './aide.js';
import { BAREME, devisLocal } from '../src/lib/livraison.js';
import { PARAMETRES_DEFAUT, fraisLivraison, francoRestant } from '../server/regles.js';

test('le barème de repli du site est le barème de démonstration du serveur', () => {
  const l = PARAMETRES_DEFAUT.livraison;
  assert.deepEqual(BAREME.colissimo, l.colissimo);
  assert.deepEqual(BAREME.relais, l.relais);
  assert.equal(BAREME.francoTTC, l.francoTTC);
});

test('devis local : mêmes frais et même reste avant le franco que le serveur', () => {
  for (const bouteilles of [1, 2, 3, 6, 7, 12, 13, 30]) {
    for (const articlesTTC of [4.4, 31.7, 119.99, 120, 250]) {
      const d = devisLocal({ bouteilles, articlesTTC });
      assert.equal(d.colissimo, fraisLivraison('colissimo', { bouteilles, articlesTTC }), `colissimo ${bouteilles} × ${articlesTTC}`);
      assert.equal(d.relais, fraisLivraison('relais', { bouteilles, articlesTTC }), `relais ${bouteilles} × ${articlesTTC}`);
      assert.equal(d.francoRestantTTC, francoRestant(articlesTTC), `franco ${articlesTTC}`);
    }
  }
});
