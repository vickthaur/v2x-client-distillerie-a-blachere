// Règles métier (docs/crm-espace-pro.md, § 5) : montants au centime près, calculés à la main.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import './aide.js';
import { produit } from '../server/catalogue.js';
import {
  alertesPro,
  appliquerPromo,
  appliquerRemise,
  colisageParDefaut,
  controlerTransition,
  echeance,
  enRetard,
  etatStock,
  fraisLivraison,
  fraisPortPro,
  francoRestant,
  htDepuisTtc,
  jourDeVisite,
  licenceAlcool,
  ligneParticulier,
  lignePro,
  numero,
  optionsLivraison,
  placesRestantes,
  prixCompteHT,
  prixGrilleHT,
  prochainNumero,
  repartir,
  STATUTS,
  tauxTva,
  totauxParticulier,
  totauxPro,
  transitionsPossibles,
  ttcDepuisHt,
} from '../server/regles.js';

const pac = { slug: 'pac-citron', varianteId: '1000', nom: 'PAC Citron®', volume: '1 L', alcool: false };
const marra = { slug: 'pastis-marra', varianteId: '700', nom: 'Pastis « MARRA® »', volume: '70 cl', alcool: true };

describe('TVA et conversions', () => {
  test('taux : 5,5 % sans alcool, 20 % avec', () => {
    assert.equal(tauxTva(false), 5.5);
    assert.equal(tauxTva(true), 20);
    assert.equal(produit('pac-citron').tva, 5.5);
    assert.equal(produit('pastis-marra').tva, 20);
  });
  test('HT depuis TTC et inverse, au centime', () => {
    assert.equal(htDepuisTtc(670, 5.5), 635);
    assert.equal(htDepuisTtc(2710, 20), 2258);
    assert.equal(htDepuisTtc(3, 20), 3); // 2,5 → arrondi au-dessus
    assert.equal(ttcDepuisHt(457, 5.5), 482);
    assert.equal(ttcDepuisHt(1626, 20), 1951);
  });
  test('répartition au plus fort reste : la somme est exacte', () => {
    assert.deepEqual(repartir(1490, [1905, 2258]), [682, 808]);
    assert.deepEqual(repartir(100, [1, 1, 1]), [34, 33, 33]);
    assert.deepEqual(repartir(500, [0, 0]), [500, 0]);
    for (const total of [1, 7, 999, 1800]) assert.equal(repartir(total, [3, 5, 11]).reduce((s, x) => s + x, 0), total);
  });
});

describe('commande de particulier', () => {
  const lignes = [ligneParticulier({ ...pac, qte: 3, prixTTC: 6.7 }), ligneParticulier({ ...marra, qte: 1, prixTTC: 27.1 })];

  test('lignes : HT déduit de chaque ligne TTC', () => {
    assert.deepEqual(lignes[0], { ...pac, tva: 5.5, qte: 3, prixUnitaireHT: 6.35, prixUnitaireTTC: 6.7, totalHT: 19.05, totalTTC: 20.1 });
    assert.equal(lignes[1].totalHT, 22.58);
    assert.equal(lignes[1].prixUnitaireHT, 22.58);
  });

  test('totaux : port ventilé au prorata des bases HT, TVA par taux, HT + TVA = TTC', () => {
    const t = totauxParticulier(lignes, { livraisonTTC: 14.9 });
    assert.deepEqual(t, {
      articlesTTC: 47.2,
      articlesHT: 41.63,
      remiseTTC: 0,
      livraisonTTC: 14.9,
      livraisonHT: 13.19,
      tva: [
        { taux: 5.5, baseHT: 25.52, montant: 1.4 },
        { taux: 20, baseHT: 29.32, montant: 5.86 },
      ],
      totalHT: 54.84,
      totalTVA: 7.26,
      totalTTC: 62.1,
    });
  });

  test('remise de 10 % ventilée par taux, puis port', () => {
    const t = totauxParticulier(lignes, { remiseTTC: 4.72, livraisonTTC: 14.9 });
    assert.equal(t.remiseTTC, 4.72);
    assert.deepEqual(t.tva, [
      { taux: 5.5, baseHT: 23.61, montant: 1.3 },
      { taux: 20, baseHT: 27.06, montant: 5.41 },
    ]);
    assert.equal(t.totalTTC, 57.38);
    assert.equal(t.totalHT, 50.67);
    assert.equal(t.totalTVA, 6.71);
  });

  test('un seul taux : tout le port à ce taux', () => {
    const t = totauxParticulier([ligneParticulier({ ...pac, qte: 2, prixTTC: 6.7 })], { livraisonTTC: 9.9 });
    assert.deepEqual(t.tva, [{ taux: 5.5, baseHT: 22.09, montant: 1.21 }]);
    assert.equal(t.totalTTC, 23.3);
  });

  test('barème Colissimo, point relais, retrait et franco', () => {
    const p = (mode, bouteilles, articlesTTC) => fraisLivraison(mode, { bouteilles, articlesTTC });
    assert.equal(p('colissimo', 1, 6.7), 9.9);
    assert.equal(p('colissimo', 2, 13.4), 9.9);
    assert.equal(p('colissimo', 3, 20.1), 14.9);
    assert.equal(p('colissimo', 6, 40.2), 14.9);
    assert.equal(p('colissimo', 7, 46.9), 19.9);
    assert.equal(p('colissimo', 12, 80.4), 19.9);
    assert.equal(p('colissimo', 13, 87.1), 24.9);
    assert.equal(p('relais', 2, 13.4), 7.9);
    assert.equal(p('relais', 13, 87.1), 22.9);
    assert.equal(p('retrait', 13, 87.1), 0);
    // franco dès 120 € TTC d'articles
    assert.equal(p('colissimo', 17, 113.9), 24.9);
    assert.equal(p('colissimo', 18, 120.6), 0);
    assert.equal(p('relais', 18, 120), 0);
    assert.equal(francoRestant(113.9), 6.1);
    assert.equal(francoRestant(130), 0);
  });

  test('pas d’envoi hors de France métropolitaine', () => {
    const o = optionsLivraison({ bouteilles: 2, articlesTTC: 13.4, cp: '97200' });
    assert.deepEqual(o.map((x) => [x.mode, x.disponible]), [['retrait', true], ['colissimo', false], ['relais', false]]);
    assert.ok(optionsLivraison({ bouteilles: 2, articlesTTC: 13.4, cp: '20000' }).every((x) => x.disponible));
  });
});

describe('tarifs et commandes pro', () => {
  test('grilles : prix TTC ÷ (1 + TVA) × coefficient, arrondi, puis remise du compte', () => {
    const v = { prixTTC: 6.7 };
    assert.equal(prixGrilleHT(v, 5.5, 'chr'), 4.57);
    assert.equal(prixGrilleHT(v, 5.5, 'caviste'), 4.32);
    assert.equal(prixGrilleHT(v, 5.5, 'distributeur'), 3.81);
    assert.equal(prixGrilleHT({ prixTTC: 27.1 }, 20, 'chr'), 16.26);
    assert.equal(prixGrilleHT({ prixTTC: 27.1 }, 20, 'caviste'), 15.36);
    assert.equal(appliquerRemise(4.57, 3), 4.43);
    assert.equal(appliquerRemise(16.26, 3), 15.77);
    assert.equal(prixCompteHT(v, 5.5, { grille: 'chr', remise: 5 }), 4.34);
    // tarif CHR fixé à la main : les autres grilles suivent au prorata
    assert.equal(prixGrilleHT({ prixTTC: 6.7, prixProHT: 4.5, proManuel: true }, 5.5, 'chr'), 4.5);
    assert.equal(prixGrilleHT({ prixTTC: 6.7, prixProHT: 4.5, proManuel: true }, 5.5, 'caviste'), 4.25);
  });

  test('colisage : 6 (70 cl, 1 L et plus), 12 (50 cl et moins), 1 (coffrets, flacons en étui)', () => {
    const c = (slug, id) => {
      const p = produit(slug);
      return colisageParDefaut(p.variantes.find((v) => v.id === id), p);
    };
    assert.equal(c('pac-citron', '1000'), 6);
    assert.equal(c('sirop-banane', '700'), 6);
    assert.equal(c('sirop-caramel-fleur-de-sel-camargue', '500'), 12);
    assert.equal(c('pastis-marra', '1750'), 6);
    assert.equal(c('pastis-marra', 'coffrets'), 1);
    assert.equal(c('marc-elixir-millesime-1958', '500'), 1);
  });

  const lignes = [lignePro({ ...pac, qte: 24, prixHT: 4.43, colisage: 6 }), lignePro({ ...marra, qte: 6, prixHT: 15.77, colisage: 6 })];

  test('totaux : port HT ventilé par taux, TVA sur chaque base', () => {
    assert.deepEqual(lignes[0], { ...pac, tva: 5.5, qte: 24, prixUnitaireHT: 4.43, prixUnitaireTTC: 4.67, totalHT: 106.32, totalTTC: 112.17, colisage: 6 });
    const t = totauxPro(lignes, { livraisonHT: fraisPortPro(200.94, { francoHT: 300, fraisPortHT: 18 }) });
    assert.equal(t.articlesHT, 200.94);
    assert.equal(t.livraisonHT, 18);
    assert.deepEqual(t.tva, [
      { taux: 5.5, baseHT: 115.84, montant: 6.37 },
      { taux: 20, baseHT: 103.1, montant: 20.62 },
    ]);
    assert.equal(t.totalHT, 218.94);
    assert.equal(t.totalTVA, 26.99);
    assert.equal(t.totalTTC, 245.93);
  });

  test('franco 300 € HT, sinon 18 € HT ; minimum 150 € HT ; encours', () => {
    assert.equal(fraisPortPro(299.99, { francoHT: 300, fraisPortHT: 18 }), 18);
    assert.equal(fraisPortPro(300, { francoHT: 300, fraisPortHT: 18 }), 0);
    const petit = totauxPro([lignePro({ ...pac, qte: 12, prixHT: 4.43 })], { livraisonHT: 18 });
    assert.deepEqual(alertesPro({ totaux: petit, encours: 0, encoursMax: 2500, minimumHT: 150 }).map((a) => a.type), ['minimum']);
    const t = totauxPro(lignes, { livraisonHT: 18 });
    assert.deepEqual(alertesPro({ totaux: t, encours: 2254.07, encoursMax: 2500, minimumHT: 150 }), []);
    assert.deepEqual(alertesPro({ totaux: t, encours: 2254.08, encoursMax: 2500, minimumHT: 150 }).map((a) => a.type), ['encours']);
  });

  test('licence : sans licence, pas d’alcool', () => {
    assert.equal(licenceAlcool('aucune'), false);
    assert.equal(licenceAlcool(undefined), false);
    for (const l of ['licence-iv', 'licence-restaurant', 'petite-licence-restaurant', 'vente-a-emporter']) assert.equal(licenceAlcool(l), true);
  });
});

describe('stocks', () => {
  test('états : disponible, stock bas (≤ seuil), rupture (0)', () => {
    assert.equal(etatStock({ stock: 13, seuil: 12 }), 'disponible');
    assert.equal(etatStock({ stock: 12, seuil: 12 }), 'stock-bas');
    assert.equal(etatStock({ stock: 1, seuil: 12 }), 'stock-bas');
    assert.equal(etatStock({ stock: 0, seuil: 12 }), 'rupture');
  });
});

describe('statuts des commandes', () => {
  const autorisees = {
    livraison: {
      nouvelle: ['en-preparation', 'annulee'],
      'en-preparation': ['expediee', 'annulee'],
      prete: ['annulee'],
      expediee: ['livree', 'remboursee'],
      livree: ['remboursee'],
      retiree: ['remboursee'],
      annulee: [],
      remboursee: [],
    },
    retrait: {
      nouvelle: ['en-preparation', 'annulee'],
      'en-preparation': ['prete', 'annulee'],
      prete: ['retiree', 'annulee'],
      expediee: ['remboursee'],
      livree: ['remboursee'],
      retiree: ['remboursee'],
      annulee: [],
      remboursee: [],
    },
  };
  for (const [cas, table] of Object.entries(autorisees)) {
    test(`toutes les transitions (${cas})`, () => {
      const mode = cas === 'retrait' ? 'retrait' : 'colissimo';
      for (const de of STATUTS) {
        const c = { canal: 'en-ligne', statut: de, livraison: { mode } };
        assert.deepEqual(transitionsPossibles(c).sort(), [...table[de]].sort(), `depuis ${de}`);
        for (const vers of STATUTS) {
          const ok = table[de].includes(vers);
          const f = () => controlerTransition(c, vers, { suivi: { numero: '6A00000000000' } });
          if (ok) assert.doesNotThrow(f, `${de} → ${vers}`);
          else assert.throws(f, (e) => e.status === 409 && e.extra.code === 'transition', `${de} → ${vers}`);
        }
      }
    });
  }
  test('expédier exige un numéro de suivi, sauf transporteur pro', () => {
    assert.throws(() => controlerTransition({ canal: 'en-ligne', statut: 'en-preparation', livraison: { mode: 'colissimo' } }, 'expediee'), (e) => e.status === 400 && e.extra.champ === 'suivi');
    assert.doesNotThrow(() => controlerTransition({ canal: 'pro', statut: 'en-preparation', livraison: { mode: 'transporteur' } }, 'expediee'));
    assert.throws(() => controlerTransition({ canal: 'en-ligne', statut: 'nouvelle', livraison: { mode: 'colissimo' } }, 'inconnu'), (e) => e.status === 400);
  });
});

describe('factures et numérotation', () => {
  test('échéances : comptant, 30 jours fin de mois, 45 jours, prélèvement à 10 jours', () => {
    assert.equal(echeance('2026-10-15', 'comptant'), '2026-10-15');
    assert.equal(echeance('2026-10-15', '30j-fdm'), '2026-11-30');
    assert.equal(echeance('2026-01-31', '30j-fdm'), '2026-03-31');
    assert.equal(echeance('2026-12-15', '30j-fdm'), '2027-01-31');
    assert.equal(echeance('2026-10-15', '45j'), '2026-11-29');
    assert.equal(echeance('2026-10-15', 'prelevement'), '2026-10-25');
  });
  test('retard : échéance dépassée et non payée (calculé)', () => {
    assert.equal(enRetard({ statut: 'a-regler', echeance: '2026-10-14' }, '2026-10-15'), true);
    assert.equal(enRetard({ statut: 'a-regler', echeance: '2026-10-15' }, '2026-10-15'), false);
    assert.equal(enRetard({ statut: 'payee', echeance: '2026-01-01' }, '2026-10-15'), false);
  });
  test('formats et continuité', () => {
    assert.equal(numero('web', 1043, '2026-10-15T08:00:00Z'), 'WEB-26-01043');
    assert.equal(numero('pro', 319, '2026-10-15T08:00:00Z'), 'PRO-26-00319');
    assert.equal(numero('facture', 512, '2026-10-15T08:00:00Z'), 'FA-26-00512');
    assert.equal(numero('visite', 143, '2026-10-15T08:00:00Z'), 'VIS-26-0143');
    assert.equal(numero('demande', 43, '2026-10-15T08:00:00Z'), 'DEM-26-0043');
    assert.equal(numero('message', 89, '2026-10-15T08:00:00Z'), 'MSG-26-0089');
    // l'année suit la date de Paris : 31 décembre 23 h 30 UTC = 1er janvier à Paris
    assert.equal(numero('facture', 1, '2026-12-31T23:30:00Z'), 'FA-27-00001');
    const doc = { seq: { facture: 511 } };
    const n = [1, 2, 3].map(() => prochainNumero(doc, 'facture', '2026-10-15T08:00:00Z'));
    assert.deepEqual(n, ['FA-26-00512', 'FA-26-00513', 'FA-26-00514']);
  });
});

describe('visites', () => {
  test('saison du 12 février au 31 décembre, fermé le dimanche', () => {
    assert.equal(jourDeVisite('2026-02-11'), false);
    assert.equal(jourDeVisite('2026-02-12'), true);
    assert.equal(jourDeVisite('2026-10-18'), false); // dimanche
    assert.equal(jourDeVisite('2026-10-17'), true); // samedi
    assert.equal(jourDeVisite('2026-12-31'), true);
    assert.equal(jourDeVisite('2027-01-05'), false);
  });
  test('capacité : personnes (mineurs compris) des réservations non annulées', () => {
    const s = { id: 'sea_a', capacite: 25, statut: 'ouverte' };
    const r = [
      { seanceId: 'sea_a', personnes: 12, statut: 'confirmee' },
      { seanceId: 'sea_a', personnes: 8, statut: 'annulee' },
      { seanceId: 'sea_a', personnes: 6, statut: 'confirmee' },
      { seanceId: 'sea_b', personnes: 6, statut: 'confirmee' },
    ];
    assert.equal(placesRestantes(s, r), 7);
    assert.equal(placesRestantes({ ...s, statut: 'fermee' }, r), 0);
  });
});

describe('codes promo', () => {
  const p = (x) => ({ actif: true, utilisations: 0, minimumTTC: 0, ...x });
  test('pourcentage, montant, livraison offerte', () => {
    assert.deepEqual(appliquerPromo(p({ type: 'pourcentage', valeur: 10 }), { articlesTTC: 47.2, aujourdhui: '2026-10-15' }), { remiseTTC: 4.72, livraisonOfferte: false });
    assert.deepEqual(appliquerPromo(p({ type: 'montant', valeur: 5, minimumTTC: 40 }), { articlesTTC: 40, aujourdhui: '2026-10-15' }), { remiseTTC: 5, livraisonOfferte: false });
    assert.deepEqual(appliquerPromo(p({ type: 'livraison', valeur: 0, minimumTTC: 60 }), { articlesTTC: 60, aujourdhui: '2026-10-15' }), { remiseTTC: 0, livraisonOfferte: true });
  });
  test('refus : inactif, dates, minimum, limite', () => {
    const refus = (x, articlesTTC = 50) => assert.throws(() => appliquerPromo(x, { articlesTTC, aujourdhui: '2026-10-15' }), (e) => e.status === 400 && e.extra.champ === 'code');
    refus(undefined);
    refus(p({ type: 'pourcentage', valeur: 10, actif: false }));
    refus(p({ type: 'pourcentage', valeur: 10, debut: '2026-10-16' }));
    refus(p({ type: 'pourcentage', valeur: 10, fin: '2026-10-14' }));
    refus(p({ type: 'montant', valeur: 5, minimumTTC: 40 }), 39.99);
    refus(p({ type: 'pourcentage', valeur: 10, limite: 3, utilisations: 3 }));
  });
});
