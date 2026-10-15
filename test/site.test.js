// api/site : catalogue de la démo, créneaux, panier (port, code promo), formulaires.
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { commandePublique, environnementNeuf, ligne, Navigateur } from './aide.js';
import { bacs } from '../server/demo.js';
import { chargeDemo } from '../server/acces.js';

beforeEach(() => environnementNeuf());

// Document de la démo d'un navigateur (lecture directe du magasin).
async function docDe(n) {
  const id = chargeDemo({ cookies: { bl_demo: n.cookies.get('bl_demo') }, maintenant: new Date('2026-10-15T08:30:00Z') }).sb;
  return (await bacs.lire(id)).doc;
}

describe('lectures publiques', () => {
  test('catalogue : 204 sans démo ; prix et états de la démo sinon', async () => {
    const n = new Navigateur();
    const r = await n.get('site', 'catalogue');
    assert.equal(r.status, 204);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    await n.entrer('direction');
    const c = await n.get('site', 'catalogue');
    assert.equal(c.status, 200);
    assert.deepEqual(c.json.produits['pac-citron'], { actif: true, variantes: { 1000: { prixTTC: 6.7, etat: 'disponible' } } });
    const etats = Object.values(c.json.produits).flatMap((p) => Object.values(p.variantes).map((v) => v.etat));
    assert.equal(etats.filter((e) => e === 'rupture').length, 1);
    assert.ok(etats.includes('stock-bas'));
  });

  test('créneaux sans démo : calculés en mémoire, rien n’est créé', async () => {
    const n = new Navigateur();
    const r = await n.get('site', 'creneaux', { mois: '2026-10' });
    assert.equal(r.status, 200);
    assert.equal(n.cookies.size, 0);
    assert.equal(r.json.jours.length, 31);
    const j = Object.fromEntries(r.json.jours.map((x) => [x.date, x]));
    assert.equal(j['2026-10-18'].ouvert, false); // dimanche
    assert.equal(j['2026-10-14'].ouvert, false); // passé
    assert.equal(j['2026-10-15'].matin.restantes, 0); // 10 h 30 à Paris : séance commencée
    assert.equal(j['2026-10-20'].matin.heure, '10:30');
    assert.equal(j['2026-10-20'].apresMidi.heure, '15:00');
    assert.ok(j['2026-10-20'].matin.restantes > 0 && j['2026-10-20'].matin.restantes <= 25);
    const fevrier = await n.get('site', 'creneaux', { mois: '2027-02' });
    const f = Object.fromEntries(fevrier.json.jours.map((x) => [x.date, x]));
    assert.equal(f['2027-02-11'].ouvert, false);
    assert.equal(f['2027-02-12'].ouvert, true);
    assert.equal((await n.get('site', 'creneaux', { mois: '2026-13' })).status, 400);
  });

  test('créneaux sans démo = disponibilités de la démo créée le même jour', async () => {
    const n = new Navigateur();
    const avant = (await n.get('site', 'creneaux', { mois: '2026-11' })).json;
    await n.entrer('boutique');
    const apres = (await n.get('site', 'creneaux', { mois: '2026-11' })).json;
    assert.deepEqual(apres, avant);
  });
});

describe('panier', () => {
  test('livraison : options, franco restant (prix de la démo ou du catalogue)', async () => {
    const n = new Navigateur();
    const r = await n.post('site', 'livraison', { lignes: [ligne('pac-citron', '1000', 3)], mode: 'colissimo', cp: '84000' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.options.map((o) => [o.mode, o.prixTTC]), [['retrait', 0], ['colissimo', 14.9], ['relais', 12.9]]);
    assert.equal(r.json.francoRestantTTC, 99.9);
    assert.equal(n.cookies.size, 0, 'pas de démo pour un calcul');
    const franco = await n.post('site', 'livraison', { lignes: [ligne('pac-citron', '1000', 18)], mode: 'colissimo' });
    assert.deepEqual(franco.json.options.map((o) => o.prixTTC), [0, 0, 0]);
    const dom = await n.post('site', 'livraison', { lignes: [ligne('pac-citron', '1000', 1)], mode: 'colissimo', cp: '97200' });
    assert.equal(dom.json.options[1].disponible, false);
    const inconnu = await n.post('site', 'livraison', { lignes: [ligne('pac-citron', '700', 1)] });
    assert.equal(inconnu.status, 400);
    assert.equal(inconnu.json.champ, 'lignes');
  });

  test('code promo : valide, minimum, inconnu', async () => {
    const n = new Navigateur();
    const ok = await n.post('site', 'code-promo', { code: ' bienvenue10 ', lignes: [ligne('pac-citron', '1000', 3)] });
    assert.deepEqual(ok.json, { valide: true, code: 'BIENVENUE10', libelle: '−10 % sur votre première commande', remiseTTC: 2.01, livraisonOfferte: false });
    const min = await n.post('site', 'code-promo', { code: 'PACETE', lignes: [ligne('pac-citron', '1000', 5)] });
    assert.equal(min.status, 400);
    assert.equal(min.json.champ, 'code');
    assert.match(min.json.erreur, /40,00 €/);
    const port = await n.post('site', 'code-promo', { code: 'PORTOFFERT', lignes: [ligne('pac-citron', '1000', 9)] });
    assert.equal(port.json.livraisonOfferte, true);
    assert.equal((await n.post('site', 'code-promo', { code: 'FAUX', lignes: [ligne('pac-citron', '1000', 9)] })).status, 400);
  });
});

describe('commande en ligne', () => {
  test('enregistrée dans une démo créée pour l’occasion, avec totaux, stock, facture, courriel', async () => {
    const n = new Navigateur();
    const r = await n.post('site', 'commande', commandePublique({ newsletter: true }));
    assert.equal(r.status, 201);
    assert.match(r.json.numero, /^WEB-26-\d{5}$/);
    assert.equal(r.json.totalTTC, 41.7); // 4 × 6,70 + 14,90
    assert.equal(r.json.statut, 'nouvelle');
    assert.deepEqual(r.json.paiement, { mode: 'carte', statut: 'paye' });
    assert.equal(r.json.liens.crm, `/crm/commandes/${r.json.id}`);
    assert.ok(n.cookies.has('bl_demo'));
    const doc = await docDe(n);
    const c = doc.commandes.find((x) => x.id === r.json.id);
    assert.equal(c.facture.statut, 'payee');
    assert.match(c.facture.numero, /^FA-26-\d{5}$/);
    assert.equal(Number(c.facture.numero.slice(-5)), doc.seq.facture);
    assert.ok(doc.mouvements.some((m) => m.commandeId === c.id && m.motif === 'vente' && m.delta === -3));
    assert.ok(doc.courriels.some((x) => x.type === 'commande' && x.objet.includes(r.json.numero)));
    assert.equal(doc.courriels.at(-1).type, 'bienvenue');
    assert.ok(doc.abonnes.some((a) => a.email === 'anne.essai@essai.test'));
    assert.ok(doc.clients.some((k) => k.email === 'anne.essai@essai.test'));
  });

  test('newsletter cochée par une personne déjà abonnée : pas de second courriel de bienvenue', async () => {
    const n = new Navigateur();
    await n.post('site', 'commande', commandePublique({ newsletter: true }));
    const r = await n.post('site', 'commande', commandePublique({ newsletter: true }));
    assert.equal(r.status, 201, r.texte);
    const doc = await docDe(n);
    const recus = doc.courriels.filter((x) => x.a === 'anne.essai@essai.test').map((x) => x.type);
    assert.deepEqual(recus, ['commande', 'bienvenue', 'commande']);
    assert.equal(doc.abonnes.filter((a) => a.email === 'anne.essai@essai.test').length, 1);
  });

  test('validation : CGV, âge pour l’alcool, adresse, outre-mer, retrait, stock', async () => {
    const n = new Navigateur();
    const err = async (corps) => (await n.post('site', 'commande', corps)).json;
    assert.equal((await err(commandePublique({ cgv: false }))).champ, 'cgv');
    const alcool = commandePublique({ lignes: [ligne('pastis-marra', '700', 1)] });
    assert.equal((await err(alcool)).champ, 'ageConfirme');
    assert.equal((await err(commandePublique({ livraison: { mode: 'colissimo' } }))).champ, 'adresse');
    assert.equal((await err(commandePublique({ livraison: { mode: 'colissimo', adresse: { ligne1: '1 rue A', cp: '97200', ville: 'Fort-de-France' } } }))).champ, 'cp');
    assert.equal((await err(commandePublique({ livraison: { mode: 'retrait', jourRetrait: '2026-10-18' } }))).champ, 'jourRetrait');
    assert.equal((await err(commandePublique({ lignes: [ligne('pac-citron', '1000', 1000)] }))).champ, 'qte');
    assert.equal((await err(commandePublique({ client: { prenom: 'A', nom: 'B', email: 'pas-un-email', telephone: '06 39 98 11 22' } }))).champ, 'email');
    assert.equal(n.cookies.size, 0, 'aucune démo créée par une saisie refusée');
    const stock = await n.post('site', 'commande', commandePublique({ lignes: [ligne('pac-citron', '1000', 999)] }));
    assert.equal(stock.status, 409);
    assert.equal(stock.json.code, 'stock');
    assert.equal(stock.json.details[0].slug, 'pac-citron');
    const ok = await n.post('site', 'commande', { ...alcool, ageConfirme: true, livraison: { mode: 'retrait', jourRetrait: '2026-10-17' } });
    assert.equal(ok.status, 201);
    assert.equal(ok.json.totalTTC, 27.1);
  });

  test('code promo et virement', async () => {
    const n = new Navigateur();
    const r = await n.post('site', 'commande', commandePublique({ code: 'BIENVENUE10', paiement: { mode: 'virement' } }));
    assert.equal(r.status, 201);
    assert.equal(r.json.totalTTC, 39.02); // 26,80 − 2,68 + 14,90
    assert.deepEqual(r.json.paiement, { mode: 'virement', statut: 'en-attente' });
    const doc = await docDe(n);
    const c = doc.commandes.find((x) => x.id === r.json.id);
    assert.equal(c.facture.statut, 'a-regler');
    assert.equal(c.facture.echeance, '2026-10-22');
    assert.equal(doc.promos.find((p) => p.code === 'BIENVENUE10').utilisations > 0, true);
  });
});

describe('autres formulaires', () => {
  test('réservation jusqu’à la séance complète : 409 avec d’autres disponibilités', async () => {
    const n = new Navigateur();
    // au-delà des 60 jours du jeu de démonstration : séance encore vide
    const corps = (personnes, extra = {}) => ({ date: '2026-12-16', moment: 'matin', personnes, mineurs: 0, langue: 'fr', nom: 'Groupe Essai', email: 'groupe@example.org', rgpd: true, newsletter: false, ...extra });
    const r1 = await n.post('site', 'reservation', corps(20));
    assert.equal(r1.status, 201);
    assert.match(r1.json.reference, /^VIS-26-\d{4}$/);
    assert.equal(r1.json.heure, '10:30');
    assert.equal(r1.json.liens.crm.startsWith('/crm/visites/res_'), true);
    const r2 = await n.post('site', 'reservation', corps(5, { mineurs: 2 }));
    assert.equal(r2.status, 201);
    const r3 = await n.post('site', 'reservation', corps(1));
    assert.equal(r3.status, 409);
    assert.equal(r3.json.code, 'complet');
    assert.ok(r3.json.disponibilites.length >= 1);
    assert.deepEqual(r3.json.disponibilites[0], { date: '2026-12-16', moment: 'apres-midi', heure: '15:00', restantes: 25 });
    const dim = await n.post('site', 'reservation', corps(2, { date: '2026-12-20' }));
    assert.equal(dim.status, 400);
    const enfants = await n.post('site', 'reservation', corps(2, { mineurs: 2 }));
    assert.equal(enfants.json.champ, 'mineurs');
  });

  test('contact, newsletter (déjà inscrit), demande pro', async () => {
    const n = new Navigateur();
    const m = await n.post('site', 'contact', { nom: 'Zoé Essai', email: 'zoe@example.net', sujet: 'visite', message: 'Bonjour, visitez-vous en allemand ?', rgpd: true });
    assert.equal(m.status, 201);
    assert.match(m.json.reference, /^MSG-26-\d{4}$/);
    assert.match(m.json.liens.crm, /^\/crm\/messages\/msg_/);
    const a = await n.post('site', 'newsletter', { email: 'Zoe@Example.net', source: 'pied-de-page' });
    assert.equal(a.status, 201);
    const b = await n.post('site', 'newsletter', { email: 'zoe@example.net' });
    assert.equal(b.status, 200);
    assert.equal(b.json.deja, true);
    const d = await n.post('site', 'demande-pro', { societe: 'Bar Essai', activite: 'chr', siret: '123 456 789 00012', nom: 'Max Essai', ville: 'Avignon', email: 'max@example.com', rgpd: true });
    assert.equal(d.status, 201);
    assert.match(d.json.reference, /^DEM-26-\d{4}$/);
    const mauvaise = await n.post('site', 'demande-pro', { societe: 'Bar Essai', activite: 'banque', nom: 'Max Essai', ville: 'Avignon', email: 'max@example.com', rgpd: true });
    assert.equal(mauvaise.json.champ, 'activite');
    const siret = await n.post('site', 'demande-pro', { societe: 'Bar Essai', activite: 'chr', siret: '1234', nom: 'Max Essai', ville: 'Avignon', email: 'max@example.com', rgpd: true });
    assert.equal(siret.json.champ, 'siret');
    const doc = await docDe(n);
    const dem = doc.demandes.find((x) => x.reference === d.json.reference);
    assert.equal(dem.siret, '12345678900012');
    assert.equal(dem.statut, 'nouvelle');
    assert.ok(doc.courriels.some((c) => c.type === 'demande-pro' && c.a === 'max@example.com'));
    assert.ok(doc.courriels.some((c) => c.type === 'bienvenue' && c.a === 'zoe@example.net'));
  });
});
