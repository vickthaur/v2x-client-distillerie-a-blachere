// Parcours complets à travers les fonctions (docs/crm-espace-pro.md, § 9), cookies gardés d'un appel
// à l'autre : démo → commande sur le site → CRM (totaux) → transitions et courriels → demande pro →
// acceptation → invitation → activation → connexion pro → commande pro → expédition → facture vue
// par le pro ; visites jusqu'à la séance complète ; ménage des démos inutilisées.
import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { commandePublique, environnementNeuf, ligne, Navigateur } from './aide.js';
import { magasin, utiliserPilote } from '../server/store.js';
import { cheminDemo } from '../server/demo.js';
import { chargeDemo } from '../server/acces.js';

describe('parcours de démonstration', () => {
  test('du site au CRM, puis à l’espace pro, et retour', async () => {
    environnementNeuf();
    const navigateur = new Navigateur();

    // 1. Un visiteur commande sur le site : la démo est créée pour lui.
    const commande = await navigateur.post('site', 'commande', {
      client: { prenom: 'Claire', nom: 'Vidal', email: 'claire.vidal@example.org', telephone: '06 39 98 45 12' },
      livraison: { mode: 'relais', adresse: { ligne1: '12 rue des Écoles', cp: '30000', ville: 'Nîmes' } },
      paiement: { mode: 'paypal' },
      lignes: [ligne('pac-citron', '1000', 3), ligne('pastis-marra', '700', 1)],
      code: 'BIENVENUE10',
      ageConfirme: true,
      newsletter: true,
      cgv: true,
    });
    assert.equal(commande.status, 201, commande.texte);
    assert.ok(navigateur.cookies.has('bl_demo'));
    // 3 × 6,70 + 27,10 = 47,20 ; −10 % = 4,72 ; point relais 4 bouteilles : 12,90 → 55,38
    assert.equal(commande.json.totalTTC, 55.38);
    assert.equal(commande.json.operation.bouteilles, 3);

    // 2. Le bouton « Voir dans le CRM » : la commande est là, avec ses totaux exacts.
    await navigateur.entrer('logistique');
    const id = commande.json.liens.crm.split('/').pop();
    const fiche = (await navigateur.get('crm', 'commande', { id })).json;
    assert.equal(fiche.numero, commande.json.numero);
    // remise 4,72 ventilée [2,01 ; 2,71] ; port 12,90 ventilé sur les bases HT [17,15 ; 20,33] → [5,90 ; 7,00]
    assert.deepEqual(fiche.totaux.tva, [
      { taux: 5.5, baseHT: 22.74, montant: 1.25 },
      { taux: 20, baseHT: 26.16, montant: 5.23 },
    ]);
    assert.equal(Math.round(fiche.totaux.totalHT * 100) + Math.round(fiche.totaux.totalTVA * 100), 5538);
    assert.equal(fiche.promo.code, 'BIENVENUE10');
    assert.equal(fiche.ageConfirme, true);

    // 3. Préparation et expédition (courriels au client).
    await navigateur.patch('crm', 'commande', { statut: 'en-preparation' }, { query: { id } });
    const exp = await navigateur.patch('crm', 'commande', { statut: 'expediee', suivi: { transporteur: 'Colissimo', numero: '6A98765432109' } }, { query: { id } });
    assert.equal(exp.json.statut, 'expediee');
    const courriels = (await navigateur.get('crm', 'courriels', { q: 'claire.vidal' })).json.elements;
    // confirmation, bienvenue (newsletter), préparation, expédition
    assert.deepEqual(courriels.map((c) => c.type).sort(), ['bienvenue', 'commande', 'commande', 'expedition']);
    const confirmation = (await navigateur.get('crm', 'courriel', { id: courriels.find((c) => c.objet.includes('enregistrée')).id })).json;
    assert.ok(confirmation.contenu.tableau.some((l) => l.libelle === 'Total TTC' && l.valeur === '55,38 €'));
    assert.ok(confirmation.contenu.paragraphes.some((p) => p.startsWith('Grâce à votre commande, 3 € seront reversés')));

    // 4. Une demande de compte pro arrive du site.
    const demande = await navigateur.post('site', 'demande-pro', { societe: 'Le Comptoir Essai', activite: 'chr', siret: '123 456 789 00012', nom: 'Marc Essai', ville: 'Orange', email: 'marc@example.com', telephone: '04 65 71 99 88', message: 'Bar à vins, ouverture en novembre.', rgpd: true });
    assert.equal(demande.status, 201);
    await navigateur.entrer('commercial');
    const demandes = (await navigateur.get('crm', 'demandes', { statut: 'nouvelle' })).json.elements;
    const dem = demandes.find((d) => d.reference === demande.json.reference);
    assert.ok(dem);

    // 5. Acceptée : compte, utilisateur et courriel d'invitation.
    const acceptee = await navigateur.post('crm', 'demande-accepter', { grille: 'chr', remise: 0, conditions: '30j-fdm', encoursMax: 3000, licence: 'licence-iv' }, { query: { id: dem.id } });
    assert.equal(acceptee.status, 201, acceptee.texte);
    const invitation = (await navigateur.get('crm', 'courriels', { type: 'invitation', q: 'marc@example.com' })).json.elements[0];
    const lien = (await navigateur.get('crm', 'courriel', { id: invitation.id })).json.contenu.bouton.url;
    assert.match(lien, /^\/espace-pro\/activer\?jeton=[\w-]{43}$/);

    // 6. Le nouveau client active son accès sur son téléphone (lien de partage) et choisit son mot de passe.
    const partage = (await navigateur.post('session', 'partager', { vers: 'pro' })).json;
    const telephone = new Navigateur({ ip: '198.51.100.20' });
    const rejoint = await telephone.get('session', 'rejoindre', { jeton: new URL(partage.lien).searchParams.get('jeton'), vers: 'pro' });
    assert.equal(rejoint.headers.get('location'), '/espace-pro');
    const jeton = new URL(lien, 'http://x').searchParams.get('jeton');
    assert.equal((await telephone.get('session', 'invitation', { jeton })).json.email, 'marc@example.com');
    const active = await telephone.post('session', 'activer', { jeton, motDePasse: 'Comptoir-Essai-2026' });
    assert.equal(active.status, 200);
    await telephone.post('session', 'deconnexion', { espace: 'pro' });
    const connexion = await telephone.post('session', 'connexion', { email: 'marc@example.com', motDePasse: 'Comptoir-Essai-2026', espace: 'pro', resterConnecte: true });
    assert.equal(connexion.status, 200);

    // (la production remplit le stock de pastis avant l'ouverture)
    await navigateur.entrer('logistique');
    assert.equal((await navigateur.post('crm', 'stock', { slug: 'pastis-marra', varianteId: '700', delta: 120, motif: 'production' })).status, 201);

    // 7. Commande pro : il faut d'abord une adresse de livraison.
    const sansAdresse = await telephone.post('pro', 'commande', { lignes: [ligne('pac-citron', '1000', 36)] });
    assert.equal(sansAdresse.json.code, 'adresse');
    const adresse = (await telephone.post('pro', 'adresse', { nom: 'Le Comptoir Essai', ligne1: '5 place Clemenceau', cp: '84100', ville: 'Orange' })).json;
    const devis = (await telephone.post('pro', 'devis', { lignes: [ligne('pac-citron', '1000', 36), ligne('pastis-marra', '700', 12)] })).json;
    assert.equal(devis.valide, true);
    const pro = await telephone.post('pro', 'commande', { lignes: [ligne('pac-citron', '1000', 36), ligne('pastis-marra', '700', 12)], adresseId: adresse.id, referenceClient: 'OUVERTURE' });
    assert.equal(pro.status, 201, pro.texte);
    assert.deepEqual(pro.json.totaux, devis.totaux);
    // CHR : 4,57 × 36 + 16,26 × 12 = 164,52 + 195,12 = 359,64 HT ≥ 300 : franco
    assert.equal(pro.json.totaux.articlesHT, 359.64);
    assert.equal(pro.json.totaux.livraisonHT, 0);

    // 8. La logistique l'expédie : la facture est émise.
    await navigateur.entrer('logistique');
    await navigateur.patch('crm', 'commande', { statut: 'en-preparation' }, { query: { id: pro.json.id } });
    const expediee = await navigateur.patch('crm', 'commande', { statut: 'expediee' }, { query: { id: pro.json.id } });
    assert.equal(expediee.status, 200, expediee.texte);
    assert.equal(expediee.json.facture, undefined, 'la logistique ne voit pas les factures');

    // 9. Le client pro voit sa facture.
    const factures = (await telephone.get('pro', 'factures')).json;
    assert.equal(factures.factures.length, 1);
    const f = factures.factures[0];
    assert.match(f.numero, /^FA-26-\d{5}$/);
    assert.equal(f.statut, 'a-regler');
    assert.equal(f.echeance, '2026-11-30');
    assert.equal(f.totalTTC, pro.json.totaux.totalTTC);
    assert.equal(factures.totalARegler, f.totalTTC);
    const accueil = (await telephone.get('pro', 'accueil')).json;
    assert.equal(accueil.encours, f.totalTTC);
    assert.equal((await telephone.get('pro', 'commande', { id: pro.json.id })).json.statut, 'expediee');
    // le courriel « facture disponible » est parti (dans la boîte d'envoi)
    await navigateur.entrer('direction');
    assert.ok((await navigateur.get('crm', 'courriels', { type: 'facture', q: 'marc@example.com' })).json.total >= 1);
  });

  test('visites : réservations jusqu’à la séance complète, puis 409 avec d’autres disponibilités', async () => {
    environnementNeuf();
    const n = new Navigateur();
    const creneaux = (await n.get('site', 'creneaux', { mois: '2026-10' })).json.jours;
    const jour =
      creneaux.find((j) => j.date > '2026-10-15' && j.ouvert && j.apresMidi.restantes >= 6 && j.apresMidi.restantes < 25) ||
      creneaux.find((j) => j.date > '2026-10-15' && j.ouvert && j.apresMidi.restantes > 0);
    let restantes = jour.apresMidi.restantes;
    const corps = (personnes) => ({ date: jour.date, moment: 'apres-midi', personnes, mineurs: 0, langue: 'fr', nom: 'Famille Essai', email: 'famille@example.net', rgpd: true, newsletter: false });
    while (restantes > 0) {
      const p = Math.min(restantes, 6);
      const r = await n.post('site', 'reservation', corps(p));
      assert.equal(r.status, 201, r.texte);
      restantes -= p;
    }
    const plein = await n.post('site', 'reservation', corps(1));
    assert.equal(plein.status, 409);
    assert.equal(plein.json.code, 'complet');
    assert.ok(plein.json.disponibilites.length > 0);
    assert.ok(plein.json.disponibilites.every((d) => d.restantes >= 1 && (d.date > jour.date || d.moment === 'matin')));
    const apres = (await n.get('site', 'creneaux', { mois: '2026-10' })).json.jours.find((j) => j.date === jour.date);
    assert.equal(apres.apresMidi.restantes, 0);
    await n.entrer('boutique');
    const vis = (await n.get('crm', 'visites', { du: jour.date, au: jour.date })).json;
    assert.equal(vis.seances.find((s) => s.moment === 'apres-midi').restantes, 0);
  });
});

describe('ménage', () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.VERCEL;
  });

  test('efface les démos inutilisées depuis 30 jours, avec le secret seulement', async () => {
    const store = environnementNeuf();
    const vieille = new Navigateur({ ip: '203.0.113.1' });
    const recente = new Navigateur({ ip: '203.0.113.2' });
    await vieille.entrer('direction');
    await recente.entrer('direction');
    const idVieille = chargeDemo({ cookies: { bl_demo: vieille.cookies.get('bl_demo') }, maintenant: new Date() }).sb;
    store._vieillir(cheminDemo(idVieille), '2026-09-10T00:00:00Z');
    const cron = new Navigateur();
    assert.equal((await cron.get('menage', undefined)).status, 401, 'sans CRON_SECRET');
    process.env.CRON_SECRET = 'secret-du-menage-0123456789';
    assert.equal((await cron.get('menage', undefined, {}, { entetes: { authorization: 'Bearer mauvais' } })).status, 401);
    const r = await cron.get('menage', undefined, {}, { entetes: { authorization: 'Bearer secret-du-menage-0123456789' } });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { examinees: 2, supprimees: 1, conservees: 1, restantes: 0, reprises: 0 });
    assert.equal(await magasin().lire(cheminDemo(idVieille)), null);
    // le navigateur de la démo effacée retrouve un état propre
    const moi = await vieille.get('session', 'moi', { espace: 'crm' });
    assert.deepEqual(moi.json, { utilisateur: null, demo: { active: false } });
    assert.equal(vieille.cookies.size, 0);
    assert.ok((await recente.get('session', 'moi', { espace: 'crm' })).json.utilisateur);
    assert.equal((await cron.post('menage', undefined, {})).status, 405);
  });

  test('une démo reprise entre la liste et la suppression est gardée (ETag)', async () => {
    const store = environnementNeuf();
    const n = new Navigateur({ ip: '203.0.113.3' });
    await n.entrer('direction');
    const id = chargeDemo({ cookies: { bl_demo: n.cookies.get('bl_demo') }, maintenant: new Date() }).sb;
    store._vieillir(cheminDemo(id), '2026-09-10T00:00:00Z');
    // le visiteur revient et commande pendant que la tâche parcourt la liste
    utiliserPilote({
      ...store,
      async *lister(prefixe) {
        yield* store.lister(prefixe);
        assert.equal((await n.post('site', 'commande', commandePublique())).status, 201);
      },
    });
    process.env.CRON_SECRET = 'secret-du-menage-0123456789';
    const r = await new Navigateur().get('menage', undefined, {}, { entetes: { authorization: 'Bearer secret-du-menage-0123456789' } });
    assert.deepEqual(r.json, { examinees: 1, supprimees: 0, conservees: 1, restantes: 0, reprises: 1 });
    assert.ok(await store.lire(cheminDemo(id)));
    assert.ok((await n.get('session', 'moi', { espace: 'crm' })).json.utilisateur);
  });

  test('sur Vercel sans CRON_SECRET : erreur de configuration', async () => {
    environnementNeuf();
    process.env.VERCEL = '1';
    process.env.SESSION_SECRET = 'un-secret-de-production-tres-long-0123456789';
    const r = await new Navigateur().get('menage', undefined);
    assert.equal(r.status, 500);
    assert.equal(r.json.code, 'configuration');
    delete process.env.SESSION_SECRET;
  });
});
