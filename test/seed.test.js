// Jeu de démonstration : déterministe, < 400 Ko, cohérent, fictif, sans perte au compactage.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MAINTENANT } from './aide.js';
import { commandeComplete, index } from '../server/modele.js';
import { genererDemo } from '../server/seed.js';
import { enRetard, etatStock, jourDeVisite, numero } from '../server/regles.js';
import { ajouterJours, jourParis, jourSemaine } from '../server/temps.js';

const HACHE = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const jetons = () => ({ jeton: 'x'.repeat(43), hache: 'f'.repeat(64) });
const gen = (maintenant = MAINTENANT, id = 'abcdefghijklmnop') => genererDemo({ id, maintenant: new Date(maintenant), hache: HACHE, jetons });

describe('jeu de démonstration', () => {
  const doc = gen();
  const aujourdhui = jourParis(new Date(MAINTENANT));
  const idx = index(doc);
  const commandes = doc.commandes.map((c) => commandeComplete(c, idx));

  test('déterministe pour une démo et une date', () => {
    assert.deepEqual(gen(), doc);
    assert.notDeepEqual(gen(MAINTENANT, 'bcdefghijklmnopq').commandes, doc.commandes);
  });

  test('moins de 400 Ko, à toute date de création', () => {
    for (const d of [MAINTENANT, '2026-01-15T10:00:00Z', '2026-07-15T16:00:00Z', '2026-12-20T09:00:00Z']) {
      const taille = Buffer.byteLength(JSON.stringify(gen(d)));
      assert.ok(taille < 400 * 1000, `${d} : ${taille} octets`);
    }
  });

  test('comptes de démonstration du § 3 (mot de passe haché)', () => {
    const attendus = [
      ['direction@blachere.example', 'direction', 'Hélène', 'Garnier'],
      ['commercial@blachere.example', 'commercial', 'Thomas', 'Roux'],
      ['logistique@blachere.example', 'logistique', 'Karim', 'Benali'],
      ['boutique@blachere.example', 'boutique', 'Léa', 'Fabre'],
      ['julien@cafe-des-platanes.example', 'pro', 'Julien', 'Morel'],
    ];
    for (const [email, role, prenom, nom] of attendus) {
      const u = doc.utilisateurs.find((x) => x.email === email);
      assert.ok(u && u.demo && u.actif && u.role === role && u.prenom === prenom && u.nom === nom, email);
      assert.equal(u.hash, HACHE);
    }
    const julien = doc.utilisateurs.find((x) => x.email === 'julien@cafe-des-platanes.example');
    assert.equal(doc.comptes.find((k) => k.id === julien.compteId).enseigne, 'Café des Platanes');
  });

  test('données fictives : domaines réservés, numéros de fiction, SIRET hors clé de Luhn', () => {
    const emails = [...doc.utilisateurs, ...doc.clients, ...doc.comptes, ...doc.abonnes, ...doc.reservations, ...doc.messages, ...doc.demandes].map((x) => x.email);
    for (const e of emails) assert.match(e, /@((.+\.)?blachere\.example|cafe-des-platanes\.example|example\.(com|org|net))$/, e);
    const tels = [...doc.clients, ...doc.comptes, ...doc.reservations].map((x) => x.telephone).filter(Boolean);
    for (const t of tels) assert.match(t, /^(04 65 71|06 39 98) \d\d \d\d$/, t);
    const luhn = (s) => [...s].reverse().reduce((acc, ch, i) => acc + (i % 2 ? ((2 * ch) % 10) + Math.floor((2 * ch) / 10) : Number(ch)), 0) % 10 === 0;
    for (const k of doc.comptes) assert.equal(luhn(k.siret), false, k.siret);
  });

  test('comptes pro : 16 actifs et 1 suspendu, types variés, villes de la région', () => {
    assert.equal(doc.comptes.filter((k) => k.statut === 'actif').length, 16);
    assert.equal(doc.comptes.filter((k) => k.statut === 'suspendu').length, 1);
    const types = doc.comptes.reduce((m, k) => ({ ...m, [k.type]: (m[k.type] || 0) + 1 }), {});
    assert.deepEqual(types, { chr: 7, hotel: 2, camping: 2, caviste: 3, epicerie: 2, distributeur: 1 });
    assert.ok(doc.comptes.every((k) => /^(84|30|13)/.test(k.adresseFacturation.cp)));
  });

  test('volumes : ~90 clients, ~160 commandes en ligne et ~70 pro sur 120 jours, abonnés, visites…', () => {
    assert.equal(doc.clients.length, 90);
    assert.equal(commandes.filter((c) => c.canal === 'en-ligne').length, 160);
    assert.equal(commandes.filter((c) => c.canal === 'pro').length, 70);
    const debut = ajouterJours(aujourdhui, -119);
    assert.ok(commandes.every((c) => jourParis(c.createdAt) >= debut && c.createdAt <= MAINTENANT));
    assert.equal(doc.abonnes.length, 220);
    assert.equal(doc.reservations.length, 55);
    assert.equal(doc.demandes.length, 7);
    assert.equal(doc.demandes.filter((d) => d.statut === 'nouvelle').length, 3);
    assert.equal(doc.messages.length, 14);
    assert.ok(doc.messages.some((m) => !m.lu) && doc.messages.some((m) => m.compteId));
    assert.equal(doc.campagnes.length, 2);
    assert.deepEqual(doc.campagnes.map((c) => c.statut).sort(), ['brouillon', 'envoyee']);
    assert.deepEqual(doc.promos.map((p) => p.code), ['BIENVENUE10', 'PACETE', 'PORTOFFERT']);
    assert.ok(doc.courriels.length >= 10 && doc.courriels.length <= 14);
    assert.equal(doc.journal.length, 60);
    const platanes = doc.comptes.find((k) => k.enseigne === 'Café des Platanes');
    assert.ok(commandes.filter((c) => c.compteId === platanes.id).length >= 10, 'historique riche du Café des Platanes');
  });

  test('PAC Citron et Fun Blue dominent les ventes en ligne', () => {
    const qte = {};
    for (const c of commandes.filter((x) => x.canal === 'en-ligne')) for (const l of c.lignes) qte[l.slug] = (qte[l.slug] || 0) + l.qte;
    const top = Object.entries(qte).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([s]) => s).sort();
    assert.deepEqual(top, ['fun-blue', 'pac-citron']);
  });

  test('statuts cohérents avec l’âge, quelques annulations', () => {
    for (const c of commandes) {
      const ageJ = (Date.parse(MAINTENANT) - Date.parse(c.createdAt)) / 86400000;
      if (ageJ > 12 && c.statut !== 'annulee' && c.statut !== 'remboursee') assert.ok(['livree', 'retiree'].includes(c.statut), `${c.numero} ${c.statut} (${ageJ.toFixed(1)} j)`);
      if (c.statut === 'nouvelle' || c.statut === 'en-preparation') assert.ok(ageJ < 4, `${c.numero} ${c.statut}`);
    }
    for (const s of ['nouvelle', 'en-preparation', 'expediee']) assert.ok(commandes.some((c) => c.statut === s), s);
    const annulees = commandes.filter((c) => c.statut === 'annulee' || c.statut === 'remboursee');
    assert.ok(annulees.length >= 2 && annulees.length <= 4);
  });

  test('factures : numérotation continue dans l’ordre des dates, une seule en retard', () => {
    const f = commandes.filter((c) => c.facture).map((c) => ({ ...c.facture, canal: c.canal, statut: c.facture.statut }));
    const triees = [...f].sort((a, b) => a.numero.slice(-5) - b.numero.slice(-5));
    triees.forEach((x, i) => {
      if (i) assert.equal(Number(x.numero.slice(-5)), Number(triees[i - 1].numero.slice(-5)) + 1);
      if (i) assert.ok(x.date >= triees[i - 1].date);
    });
    assert.equal(Number(triees.at(-1).numero.slice(-5)), doc.seq.facture);
    const retard = f.filter((x) => enRetard(x, aujourdhui));
    assert.equal(retard.length, 1);
    assert.equal(retard[0].canal, 'pro');
    // commandes pro expédiées : toutes facturées
    for (const c of commandes.filter((x) => x.canal === 'pro' && ['expediee', 'livree'].includes(x.statut))) assert.ok(c.facture, c.numero);
    for (const c of commandes.filter((x) => x.canal === 'pro' && ['nouvelle', 'en-preparation'].includes(x.statut))) assert.ok(!c.facture, c.numero);
    assert.ok(f.filter((x) => x.canal === 'pro' && x.statut === 'payee').length > f.filter((x) => x.canal === 'pro' && x.statut === 'a-regler').length);
  });

  test('numéros des commandes, visites, demandes et messages', () => {
    for (const c of commandes) assert.match(c.numero, c.canal === 'pro' ? /^PRO-2\d-\d{5}$/ : /^WEB-2\d-\d{5}$/);
    assert.equal(commandes.filter((c) => c.canal === 'pro').map((c) => c.numero).at(-1), numero('pro', doc.seq.pro, commandes.filter((c) => c.canal === 'pro').at(-1).createdAt));
    for (const r of doc.reservations) assert.match(r.reference, /^VIS-2\d-\d{4}$/);
    for (const d of doc.demandes) assert.match(d.reference, /^DEM-2\d-\d{4}$/);
    for (const m of doc.messages) assert.match(m.reference, /^MSG-2\d-\d{4}$/);
  });

  test('stocks : quelques stocks bas, une seule rupture (ni PAC ni Fun Blue)', () => {
    const v = Object.entries(doc.produits).flatMap(([slug, p]) => Object.entries(p.variantes).map(([id, x]) => ({ slug, id, ...x })));
    assert.equal(v.length, 76);
    const ruptures = v.filter((x) => etatStock(x) === 'rupture');
    assert.equal(ruptures.length, 1);
    assert.ok(!['pac-citron', 'fun-blue'].includes(ruptures[0].slug));
    assert.ok(v.filter((x) => etatStock(x) === 'stock-bas').length >= 3);
    assert.ok(doc.mouvements.length > 10);
  });

  test('visites : 30 jours passés, 60 à venir, saison et dimanches respectés, capacité tenue', () => {
    const seances = doc.seances;
    assert.ok(seances.every((s) => jourDeVisite(s.date, doc.parametres.visites) && jourSemaine(s.date) !== 0));
    assert.ok(seances.some((s) => s.date < aujourdhui) && seances.some((s) => s.date > ajouterJours(aujourdhui, 50)));
    for (const s of seances) {
      const pris = doc.reservations.filter((r) => r.seanceId === s.id && r.statut !== 'annulee').reduce((t, r) => t + r.personnes, 0);
      assert.ok(pris <= (s.capacite ?? 25));
    }
  });

  test('paramètres : coordonnées réelles de la distillerie', () => {
    assert.deepEqual(doc.parametres.entreprise, {
      nom: 'Distillerie A. Blachère',
      adresse: '1695 route de Sorgues, quartier Cansaud, 84230 Châteauneuf-du-Pape',
      telephone: '04 90 83 55 65',
      email: 'magasin@distillerieablachere.com',
      siret: '325 034 106 00022',
      tvaIntra: '',
      rcs: '',
    });
  });

  test('Octobre Rose : commandes en ligne d’octobre seulement, calculées', () => {
    const avecDon = commandes.filter((c) => c.operation);
    assert.ok(avecDon.length > 0);
    for (const c of avecDon) {
      assert.equal(c.canal, 'en-ligne');
      assert.ok(jourParis(c.createdAt) >= '2026-10-01' && jourParis(c.createdAt) <= '2026-10-31');
      const pac = c.lignes.filter((l) => l.slug === 'pac-citron').reduce((s, l) => s + l.qte, 0);
      assert.deepEqual(c.operation, { id: 'octobre-rose-2026', nom: 'Octobre Rose', beneficiaire: 'Institut du Cancer Avignon-Provence', bouteilles: pac, montant: pac });
    }
    const sansDon = commandes.filter((c) => !c.operation && c.canal === 'en-ligne' && jourParis(c.createdAt) >= '2026-10-01');
    for (const c of sansDon) assert.ok(!c.lignes.some((l) => l.slug === 'pac-citron'), c.numero);
    assert.equal(gen('2026-08-15T10:00:00Z').commandes.filter((c) => c.operation).length, 0);
  });

  test('compactage sans perte : la forme complète ne dépend pas du stockage compact', () => {
    // Totaux recalculés : TTC = articles − remise + port, HT + TVA = TTC.
    for (const c of commandes) {
      const t = c.totaux;
      assert.equal(Math.round(t.totalHT * 100) + Math.round(t.totalTVA * 100), Math.round(t.totalTTC * 100));
      if (c.canal !== 'pro') assert.equal(Math.round(t.totalTTC * 100), Math.round(t.articlesTTC * 100) - Math.round(t.remiseTTC * 100) + Math.round(t.livraisonTTC * 100));
      assert.ok(c.historique.every((h) => h.date && h.action && h.par?.nom));
      assert.ok(c.contact.nom && c.contact.email);
      assert.ok(c.updatedAt >= c.createdAt);
      if (c.livraison.mode !== 'retrait') assert.ok(c.livraison.adresse?.cp, c.numero);
    }
  });
});
