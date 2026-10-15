// api/pro : session bl_pro, données limitées au compte (un identifiant d'un autre compte → 404),
// catalogue selon la licence, devis, commande (colisage, minimum, encours, stock), factures,
// documents, compte, adresses, messages.
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { environnementNeuf, ligne, MAINTENANT, MOT_DE_PASSE, Navigateur } from './aide.js';
import { chargeDemo } from '../server/acces.js';
import { bacs } from '../server/demo.js';

async function docDe(n) {
  const id = chargeDemo({ cookies: { bl_demo: n.cookies.get('bl_demo') }, maintenant: new Date(MAINTENANT) }).sb;
  return (await bacs.lire(id)).doc;
}

// Connexion d'un utilisateur pro du jeu de démonstration (même démo que `n`).
async function commeCompte(n, filtre) {
  const doc = await docDe(n);
  const compte = doc.comptes.find(filtre);
  const u = doc.utilisateurs.find((x) => x.compteId === compte.id && x.hash);
  const autre = new Navigateur({ ip: '203.0.113.77' });
  autre.cookies = new Map([...n.cookies].filter(([k]) => k.startsWith('bl_demo')));
  const r = await autre.post('session', 'connexion', { email: u.email, motDePasse: MOT_DE_PASSE, espace: 'pro' });
  assert.equal(r.status, 200, r.texte);
  return { nav: autre, compte, utilisateur: u };
}

let n;
beforeEach(async () => {
  environnementNeuf();
  n = new Navigateur();
  await n.entrer('pro');
});

describe('accès et isolement des comptes', () => {
  test('sans session pro : 401 ; une session du CRM ne suffit pas', async () => {
    const v = new Navigateur();
    assert.equal((await v.get('pro', 'accueil')).status, 401);
    await v.entrer('direction');
    assert.equal((await v.get('pro', 'accueil')).status, 401);
    v.cookies.set('bl_pro', v.cookies.get('bl_crm'));
    assert.equal((await v.get('pro', 'catalogue')).status, 401);
  });

  test('un identifiant d’un autre compte rend 404 (commande, recommander, message, adresse)', async () => {
    const doc = await docDe(n);
    const julien = doc.utilisateurs.find((u) => u.email === 'julien@cafe-des-platanes.example');
    const autreCommande = doc.commandes.find((c) => c.canal === 'pro' && c.compteId !== julien.compteId);
    const enLigne = doc.commandes.find((c) => c.canal === 'en-ligne');
    const autreMessage = doc.messages.find((m) => m.compteId && m.compteId !== julien.compteId);
    const autreAdresse = doc.comptes.find((k) => k.id !== julien.compteId).adressesLivraison[0];
    for (const id of [autreCommande.id, enLigne.id, 'cmd_aaaaaaaaaaaa']) {
      assert.equal((await n.get('pro', 'commande', { id })).status, 404);
      assert.equal((await n.get('pro', 'recommander', { id })).status, 404);
    }
    assert.equal((await n.get('pro', 'message', { id: autreMessage.id })).status, 404);
    assert.equal((await n.post('pro', 'message', { id: autreMessage.id, texte: 'Intrusion' })).status, 404);
    assert.equal((await n.patch('pro', 'adresse', { ligne1: 'X', cp: '84000', ville: 'Avignon' }, { query: { id: autreAdresse.id } })).status, 404);
    assert.equal((await n.delete('pro', 'adresse', {}, { query: { id: autreAdresse.id } })).status, 404);
    // les listes ne contiennent que le compte
    const liste = (await n.get('pro', 'commandes', { par: 100 })).json.elements;
    const miens = new Set(doc.commandes.filter((c) => c.compteId === julien.compteId).map((c) => c.id));
    assert.ok(liste.length > 0 && liste.every((c) => miens.has(c.id)));
    const f = (await n.get('pro', 'factures')).json.factures;
    assert.ok(f.every((x) => miens.has(x.commandeId)));
    const m = (await n.get('pro', 'messages')).json.elements;
    assert.ok(m.every((x) => doc.messages.find((y) => y.id === x.id).compteId === julien.compteId));
  });

  test('compte suspendu : la session pro ne vaut plus', async () => {
    const crm = new Navigateur();
    crm.cookies = new Map(n.cookies);
    await crm.entrer('direction');
    const doc = await docDe(n);
    const julien = doc.utilisateurs.find((u) => u.email === 'julien@cafe-des-platanes.example');
    await crm.patch('crm', 'compte', { statut: 'suspendu' }, { query: { id: julien.compteId } });
    assert.equal((await n.get('pro', 'accueil')).status, 401);
    const r = await n.post('session', 'connexion', { email: 'julien@cafe-des-platanes.example', motDePasse: MOT_DE_PASSE, espace: 'pro' });
    assert.equal(r.status, 403);
    assert.equal(r.json.code, 'suspendu');
  });

  test('vue pro d’une commande : sans notes internes ni identifiants du personnel', async () => {
    const crm = new Navigateur();
    crm.cookies = new Map(n.cookies);
    await crm.entrer('direction');
    const c = (await n.get('pro', 'commandes')).json.elements[0];
    await crm.patch('crm', 'commande', { note: 'Client à relancer (interne)' }, { query: { id: c.id } });
    const vue = (await n.get('pro', 'commande', { id: c.id })).json;
    assert.equal(vue.notes, undefined);
    assert.equal(vue.auteurId, undefined);
    assert.ok(!JSON.stringify(vue).includes('interne'));
    assert.ok(vue.historique.every((h) => h.par.nom && h.par.id === undefined));
  });
});

describe('accueil, catalogue, documents', () => {
  test('accueil : encours, factures à régler, suggestions, commercial', async () => {
    const a = (await n.get('pro', 'accueil')).json;
    assert.equal(a.compte.enseigne, 'Café des Platanes');
    assert.equal(a.commercial.nom, 'Thomas Roux');
    assert.equal(a.encoursMax, 4000);
    assert.ok(a.encours < 0.5 * a.encoursMax, `encours ${a.encours}`);
    assert.equal(a.facturesARegler.totalTTC, a.encours);
    assert.ok(a.commandesEnCours.length >= 1);
    assert.ok(a.suggestions.length > 0 && a.suggestions.length <= 4);
    assert.deepEqual(a.conditions, { minimumHT: 150, francoHT: 300, fraisPortHT: 18, delai: '48 à 72 h ouvrées' });
  });

  test('catalogue : prix de la grille et de la remise, cartons, mentions sanitaires', async () => {
    const c = (await n.get('pro', 'catalogue')).json;
    assert.equal(c.produits.length, 63);
    const pac = c.produits.find((p) => p.slug === 'pac-citron').variantes[0];
    assert.deepEqual(pac, { id: '1000', volume: '1 L', coffret: false, colisage: 6, parCarton: true, prixHT: 4.43, prixCartonHT: 26.58, prixTTC: 4.67, prixPublicTTC: 6.7, tva: 5.5, etat: 'disponible' });
    assert.ok(c.mentions.evin.includes('modération'));
    const coffret = c.produits.find((p) => p.slug === 'pastis-marra').variantes.find((v) => v.id === 'coffrets');
    assert.equal(coffret.colisage, 1);
    assert.equal(coffret.parCarton, false);
  });

  test('sans licence : spiritueux masqués (catalogue, documents) et refusés (devis, commande)', async () => {
    const { nav } = await commeCompte(n, (k) => k.licence === 'aucune');
    const c = (await nav.get('pro', 'catalogue')).json;
    assert.ok(c.produits.length < 63 && c.produits.every((p) => !p.alcool));
    assert.equal(c.mentions, undefined);
    assert.equal(c.spiritueux, false);
    const d = (await nav.get('pro', 'documents')).json;
    assert.ok(d.fiches.every((f) => !f.alcool));
    const devis = (await nav.post('pro', 'devis', { lignes: [ligne('pastis-marra', '700', 6)] })).json;
    assert.equal(devis.alertes[0].type, 'licence');
    assert.equal(devis.valide, false);
    const cmd = await nav.post('pro', 'commande', { lignes: [ligne('pac-citron', '1000', 36), ligne('pastis-marra', '700', 6)] });
    assert.equal(cmd.status, 403);
    assert.equal(cmd.json.code, 'licence');
  });

  test('documents : fiches techniques, médiathèque, conditions', async () => {
    const d = (await n.get('pro', 'documents')).json;
    const pac = d.fiches.find((f) => f.slug === 'pac-citron');
    assert.ok(pac.ingredients && pac.reference && pac.photo);
    assert.ok(d.fiches.find((f) => f.alcool).mentions.length === 2);
    assert.ok(d.mediatheque.some((x) => x.url === '/marques/pac.svg'));
    assert.equal(d.conditions.paiement, '30 jours fin de mois');
  });
});

describe('devis et commande', () => {
  test('devis : totaux et alertes, sans rien enregistrer', async () => {
    // stock de pastis assuré (il peut être bas dans le jeu de démonstration)
    const crm = new Navigateur();
    crm.cookies = new Map(n.cookies);
    await crm.entrer('logistique');
    await crm.post('crm', 'stock', { slug: 'pastis-marra', varianteId: '700', delta: 60, motif: 'production' });
    const avant = JSON.stringify(await docDe(n));
    const d = (await n.post('pro', 'devis', { lignes: [ligne('pac-citron', '1000', 24), ligne('pastis-marra', '700', 6)] })).json;
    assert.equal(d.totaux.totalTTC, 245.93);
    assert.equal(d.totaux.livraisonHT, 18);
    assert.equal(d.francoRestantHT, 99.06);
    assert.deepEqual(d.alertes, []);
    assert.equal(d.valide, true);
    assert.equal(JSON.stringify(await docDe(n)), avant);
    const a = (await n.post('pro', 'devis', { lignes: [ligne('pac-citron', '1000', 7), ligne('sirop-menthe', '1000', 6)] })).json;
    assert.deepEqual(a.alertes.map((x) => x.type).sort(), ['colisage', 'minimum']);
    const doc = await docDe(n);
    const rupture = Object.entries(doc.produits).flatMap(([slug, p]) => Object.entries(p.variantes).filter(([, v]) => v.stock === 0).map(([id]) => ({ slug, id })))[0];
    const r = (await n.post('pro', 'devis', { lignes: [ligne(rupture.slug, rupture.id, 12)] })).json;
    assert.ok(r.alertes.some((x) => x.type === 'stock'));
  });

  test('commande : colisage, minimum, encours, stock ; puis enregistrée et visible au CRM', async () => {
    assert.equal((await n.post('pro', 'commande', { lignes: [ligne('pac-citron', '1000', 25)] })).json.code, 'colisage');
    assert.equal((await n.post('pro', 'commande', { lignes: [ligne('pac-citron', '1000', 12)] })).json.code, 'minimum');
    const crm = new Navigateur();
    crm.cookies = new Map(n.cookies);
    await crm.entrer('commercial');
    const compteId = (await n.get('pro', 'compte')).json.compte.id;
    await crm.patch('crm', 'compte', { encoursMax: 100 }, { query: { id: compteId } });
    const encours = await n.post('pro', 'commande', { lignes: [ligne('pac-citron', '1000', 36)] });
    assert.equal(encours.status, 409);
    assert.equal(encours.json.code, 'encours');
    await crm.patch('crm', 'compte', { encoursMax: 4000 }, { query: { id: compteId } });
    assert.equal((await n.post('pro', 'commande', { lignes: [ligne('pac-citron', '1000', 36)], adresseId: 'adr_aaaaaaaaaaaa' })).json.champ, 'adresseId');
    await crm.entrer('logistique');
    assert.equal((await crm.post('crm', 'stock', { slug: 'pastis-marra', varianteId: '700', delta: 60, motif: 'production' })).status, 201);
    const r = await n.post('pro', 'commande', { lignes: [ligne('pac-citron', '1000', 24), ligne('pastis-marra', '700', 6)], referenceClient: 'BC-ESSAI', dateSouhaitee: '2026-10-20', commentaire: 'Avant 11 h' });
    assert.equal(r.status, 201);
    assert.match(r.json.numero, /^PRO-26-\d{5}$/);
    assert.equal(r.json.totaux.totalTTC, 245.93);
    assert.equal(r.json.referenceClient, 'BC-ESSAI');
    assert.equal(r.json.statut, 'nouvelle');
    assert.equal(r.json.operation, undefined, 'Octobre Rose : pas pour les pros');
    await crm.entrer('logistique');
    const vu = (await crm.get('crm', 'commande', { id: r.json.id })).json;
    assert.equal(vu.compte.enseigne, 'Café des Platanes');
    assert.equal(vu.historique[0].action, 'Commande passée dans l’espace pro');
    const doc = await docDe(n);
    assert.ok(doc.courriels.some((c) => c.lie?.id === r.json.id && c.type === 'commande'));
  });

  test('recommander : lignes encore disponibles, au carton', async () => {
    const liste = (await n.get('pro', 'commandes', { par: 100 })).json.elements;
    const r = (await n.get('pro', 'recommander', { id: liste.at(-1).id })).json;
    assert.ok(r.lignes.length + r.indisponibles.length > 0);
    for (const l of r.lignes) assert.equal(l.qte % l.colisage, 0);
  });
});

describe('factures, compte, adresses, messages', () => {
  test('factures : statut, échéance, retard, total à régler', async () => {
    const f = (await n.get('pro', 'factures')).json;
    assert.ok(f.factures.length > 0);
    assert.ok(f.factures.every((x) => /^FA-2\d-\d{5}$/.test(x.numero) && typeof x.enRetard === 'boolean'));
    assert.equal(f.totalARegler, Math.round(f.factures.filter((x) => x.statut === 'a-regler').reduce((s, x) => s + x.totalTTC * 100, 0)) / 100);
    assert.equal(f.emetteur.siret, '325 034 106 00022');
  });

  test('compte : téléphone et e-mail modifiables, le reste non', async () => {
    const r = await n.patch('pro', 'compte', { telephone: '04 65 71 00 00', siret: '00000000000000', raisonSociale: 'Pirate' });
    assert.equal(r.json.telephone, '04 65 71 00 00');
    assert.notEqual(r.json.raisonSociale, 'Pirate');
    assert.equal((await n.patch('pro', 'compte', { raisonSociale: 'Pirate' })).status, 400);
    // null ou '' efface le téléphone ; l'e-mail de facturation, obligatoire, ne s'efface pas
    assert.equal((await n.patch('pro', 'compte', { telephone: null })).json.telephone, undefined);
    assert.ok((await n.patch('pro', 'compte', { telephone: '04 65 71 00 00', email: '' })).json.email);
    const c = (await n.get('pro', 'compte')).json;
    assert.ok(c.utilisateurs.some((u) => u.statut === 'invitation'), 'Camille Morel invitée');
  });

  test('adresses : ajout, modification, suppression ; commande vers la nouvelle adresse', async () => {
    const a = await n.post('pro', 'adresse', { nom: 'Terrasse d’été', ligne1: '2 place des Platanes', cp: '84000', ville: 'Avignon', instructions: 'Sonner' });
    assert.equal(a.status, 201);
    assert.equal((await n.post('pro', 'adresse', { ligne1: '2 place X', cp: '9700', ville: 'Avignon' })).json.champ, 'cp');
    const c = await n.post('pro', 'commande', { lignes: [ligne('pac-citron', '1000', 36)], adresseId: a.json.id });
    assert.equal(c.json.livraison.adresse.ligne1, '2 place des Platanes');
    const m = await n.patch('pro', 'adresse', { ligne1: '4 place des Platanes', cp: '84000', ville: 'Avignon' }, { query: { id: a.json.id } });
    assert.equal(m.json.ligne1, '4 place des Platanes');
    assert.equal(m.json.instructions, undefined);
    assert.deepEqual((await n.delete('pro', 'adresse', {}, { query: { id: a.json.id } })).json, { ok: true });
    // la commande garde l'adresse du jour de la commande
    assert.equal((await n.get('pro', 'commande', { id: c.json.id })).json.livraison.adresse.ligne1, '2 place des Platanes');
  });

  test('messages : nouveau message → CRM ; réponse du CRM → espace pro ; relance', async () => {
    const r = await n.post('pro', 'message', { texte: 'Bonjour, pouvez-vous ajouter deux cartons de Fun Blue ?' });
    assert.equal(r.status, 201);
    assert.match(r.json.reference, /^MSG-26-\d{4}$/);
    const crm = new Navigateur();
    crm.cookies = new Map(n.cookies);
    await crm.entrer('commercial');
    const l = (await crm.get('crm', 'messages', { statut: 'nouveau' })).json.elements;
    const vu = l.find((x) => x.id === r.json.id);
    assert.equal(vu.compte.enseigne, 'Café des Platanes');
    assert.equal(vu.assigneA.nom, 'Thomas Roux');
    await crm.post('crm', 'message-reponse', { texte: 'C’est ajouté, bonne journée !' }, { query: { id: r.json.id } });
    const fil = (await n.get('pro', 'message', { id: r.json.id })).json.fil;
    assert.deepEqual(fil.map((f) => f.de), ['client', 'equipe']);
    assert.equal(fil[1].nom, 'Thomas Roux');
    const relance = await n.post('pro', 'message', { id: r.json.id, texte: 'Merci !' });
    assert.equal(relance.json.nbMessages, 3);
    const apres = (await crm.get('crm', 'messages', { q: 'Fun Blue' })).json.elements.find((x) => x.id === r.json.id);
    assert.equal(apres.lu, false);
  });
});
