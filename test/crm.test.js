// api/crm : droits du tableau du § 3 (rôle par rubrique), comportements et effets des actions.
import assert from 'node:assert/strict';
import { before, beforeEach, describe, test } from 'node:test';
import { commandePublique, environnementNeuf, ligne, MAINTENANT, Navigateur } from './aide.js';
import { chargeDemo } from '../server/acces.js';
import { bacs } from '../server/demo.js';
import { commandeComplete, index } from '../server/modele.js';
import { fixerHorloge, jourParis } from '../server/temps.js';

async function docDe(n) {
  const id = chargeDemo({ cookies: { bl_demo: n.cookies.get('bl_demo') }, maintenant: new Date(MAINTENANT) }).sb;
  return (await bacs.lire(id)).doc;
}
const premier = async (n, r, query = {}) => (await n.get('crm', r, { par: 100, ...query })).json.elements[0];

describe('accès', () => {
  beforeEach(() => environnementNeuf());

  test('sans session : 401 partout ; un cookie bl_pro ne vaut rien pour le CRM', async () => {
    const n = new Navigateur();
    assert.equal((await n.get('crm', 'tableau')).status, 401);
    assert.equal((await n.post('crm', 'client', { prenom: 'A', nom: 'B', email: 'a@example.com' })).status, 401);
    await n.entrer('pro');
    for (const r of ['tableau', 'commandes', 'clients', 'notifications', 'equipe']) assert.equal((await n.get('crm', r)).status, 401, r);
    n.cookies.set('bl_crm', n.cookies.get('bl_pro'));
    assert.equal((await n.get('crm', 'tableau')).status, 401);
    // sans droit, la saisie n'est même pas lue : 401 avant 400
    const vide = new Navigateur();
    assert.equal((await vide.post('crm', 'client', { email: 'pas-un-email' })).status, 401);
  });
});

// Tableau du § 3 : pour chaque rubrique, une lecture et une écriture représentatives.
describe('droits par rôle (tableau du § 3)', () => {
  const nav = {};
  let ids;
  before(async () => {
    environnementNeuf();
    const d = new Navigateur();
    await d.entrer('direction');
    const doc = await docDe(d);
    const idx = index(doc);
    const enLigne = doc.commandes.find((c) => c.canal === 'en-ligne');
    const pro = doc.commandes.filter((c) => c.canal === 'pro' && c.facture).at(-1);
    ids = {
      enLigne: enLigne.id,
      pro: pro.id,
      compte: doc.comptes[0].id,
      client: doc.clients[0].id,
      message: doc.messages.at(-1).id,
      membre: doc.utilisateurs.find((u) => u.role === 'boutique').id,
    };
    void idx;
    for (const role of ['direction', 'commercial', 'logistique', 'boutique']) {
      nav[role] = new Navigateur();
      nav[role].cookies = new Map(d.cookies);
      await nav[role].entrer(role);
    }
  });

  let jour = 0;
  // [rubrique, lecture(n), écriture(n)] ; lecture/écriture rendent un statut.
  const cas = {
    tableau: [(n) => n.get('crm', 'tableau'), null],
    commandes: [(n) => n.get('crm', 'commande', { id: ids.enLigne }), (n) => n.patch('crm', 'commande', { note: 'Vu' }, { query: { id: ids.enLigne } })],
    'commandes-pro': [(n) => n.get('crm', 'commande', { id: ids.pro }), (n) => n.patch('crm', 'commande', { note: 'Vu' }, { query: { id: ids.pro } })],
    factures: [null, (n) => n.patch('crm', 'commande', { factureStatut: 'payee' }, { query: { id: ids.pro } })],
    clients: [(n) => n.get('crm', 'clients'), (n) => n.patch('crm', 'client', { notes: 'Note' }, { query: { id: ids.client } })],
    comptes: [(n) => n.get('crm', 'comptes'), (n) => n.patch('crm', 'compte', { notes: 'Note' }, { query: { id: ids.compte } })],
    demandes: [(n) => n.get('crm', 'demandes'), null],
    produits: [(n) => n.get('crm', 'produits'), (n) => n.patch('crm', 'produit', { variantes: { 1000: { seuil: 100 } } }, { query: { slug: 'pac-citron' } })],
    stocks: [(n) => n.get('crm', 'mouvements'), (n) => n.post('crm', 'stock', { slug: 'pac-citron', varianteId: '1000', delta: 6, motif: 'production' })],
    visites: [(n) => n.get('crm', 'visites'), (n) => n.post('crm', 'seance', { date: `2026-12-${String(20 + (jour += 1)).padStart(2, '0')}`, moment: 'apres-midi' })],
    messages: [(n) => n.get('crm', 'messages'), (n) => n.patch('crm', 'message', { statut: 'en-cours' }, { query: { id: ids.message } })],
    newsletter: [(n) => n.get('crm', 'newsletter'), (n) => n.post('crm', 'promo', { code: `T${Math.random().toString(36).slice(2, 8).toUpperCase()}`, libelle: 'Essai', type: 'montant', valeur: 1 })],
    promos: [(n) => n.get('crm', 'promos'), null],
    courriels: [(n) => n.get('crm', 'courriels'), null],
    journal: [(n) => n.get('crm', 'journal'), null],
    equipe: [null, (n) => n.patch('crm', 'membre', { poste: 'Boutique et visites' }, { query: { id: ids.membre } })],
    parametres: [(n) => n.get('crm', 'parametres'), (n) => n.patch('crm', 'parametres', { pro: { delai: '48 à 72 h ouvrées' } })],
    exports: [(n) => n.get('crm', 'export', { type: 'produits' }), null],
  };
  // L : lecture seule ; E : lecture et écriture ; — : rien.
  const attendu = {
    direction: { tableau: 'E', commandes: 'E', 'commandes-pro': 'E', factures: 'E', clients: 'E', comptes: 'E', demandes: 'E', produits: 'E', stocks: 'E', visites: 'E', messages: 'E', newsletter: 'E', promos: 'E', courriels: 'E', journal: 'E', equipe: 'E', parametres: 'E', exports: 'E' },
    commercial: { tableau: 'E', commandes: 'L', 'commandes-pro': 'E', factures: 'E', clients: 'L', comptes: 'E', demandes: 'E', produits: 'L', stocks: 'L', visites: 'L', messages: 'E', newsletter: 'E', promos: 'E', courriels: 'E', journal: 'E', equipe: '—', parametres: '—', exports: 'E' },
    logistique: { tableau: 'E', commandes: 'E', 'commandes-pro': 'E', factures: '—', clients: 'L', comptes: 'L', demandes: 'L', produits: 'L', stocks: 'E', visites: '—', messages: '—', newsletter: '—', promos: '—', courriels: 'E', journal: 'E', equipe: '—', parametres: '—', exports: 'E' },
    boutique: { tableau: 'E', commandes: 'E', 'commandes-pro': 'L', factures: 'L', clients: 'E', comptes: '—', demandes: '—', produits: 'L', stocks: 'L', visites: 'E', messages: 'E', newsletter: 'L', promos: 'L', courriels: 'E', journal: 'E', equipe: '—', parametres: '—', exports: 'E' },
  };

  for (const role of ['direction', 'commercial', 'logistique', 'boutique']) {
    test(role, async () => {
      for (const [rubrique, [lecture, ecriture]] of Object.entries(cas)) {
        const droit = attendu[role][rubrique];
        if (lecture) {
          const r = await lecture(nav[role]);
          assert.equal(r.status, droit === '—' ? 403 : 200, `${role} lit ${rubrique} (${r.status} ${r.texte.slice(0, 120)})`);
        }
        if (ecriture) {
          const r = await ecriture(nav[role]);
          assert.equal(r.status >= 200 && r.status < 300 ? 'ok' : r.status, droit === 'E' ? 'ok' : 403, `${role} modifie ${rubrique} (${r.status} ${r.texte.slice(0, 160)})`);
        }
      }
      // droits exposés à l'interface
      const moi = await nav[role].get('session', 'moi', { espace: 'crm' });
      for (const [rubrique, droit] of Object.entries(attendu[role])) {
        if (['demandes', 'promos'].includes(rubrique)) continue;
        const d = moi.json.utilisateur.droits;
        const vu = d.includes(rubrique) ? 'E' : d.includes(`${rubrique}:lecture`) ? 'L' : '—';
        assert.equal(vu, droit, `${role} droits ${rubrique}`);
      }
    });
  }

  test('logistique : commandes pro sans facture ni encours', async () => {
    const c = (await nav.logistique.get('crm', 'commande', { id: ids.pro })).json;
    assert.equal(c.facture, undefined);
    assert.equal(c.compte.encours, undefined);
    const k = (await nav.logistique.get('crm', 'compte', { id: ids.compte })).json;
    assert.equal(k.factures, undefined);
    assert.equal(k.encours, undefined);
    assert.ok((await nav.boutique.get('crm', 'commande', { id: ids.pro })).json.facture);
  });

  test('équipe : liste complète pour la direction, noms seulement pour les autres', async () => {
    const d = (await nav.direction.get('crm', 'equipe')).json.membres;
    const c = (await nav.commercial.get('crm', 'equipe')).json.membres;
    assert.ok(d[0].email && d[0].statut);
    assert.ok(c.length >= 4 && c.every((x) => !x.email && x.nom));
  });

  test('exports : chaque type suit le droit de lecture de sa rubrique', async () => {
    assert.equal((await nav.boutique.get('crm', 'export', { type: 'comptes' })).status, 403);
    assert.equal((await nav.logistique.get('crm', 'export', { type: 'abonnes' })).status, 403);
    assert.equal((await nav.logistique.get('crm', 'export', { type: 'commandes' })).status, 200);
    const csv = (await nav.logistique.get('crm', 'export', { type: 'commandes' })).texte;
    assert.doesNotMatch(csv.split('\r\n')[0], /Facture/);
  });
});

describe('commandes', () => {
  let n;
  beforeEach(async () => {
    environnementNeuf();
    n = new Navigateur();
    await n.entrer('direction');
  });

  test('liste : filtres, tri, pagination, compteurs', async () => {
    const r = await n.get('crm', 'commandes', { canal: 'pro', par: 10, page: 2, tri: 'total' });
    assert.equal(r.status, 200);
    assert.equal(r.json.page, 2);
    assert.equal(r.json.elements.length, 10);
    assert.ok(r.json.elements.every((c) => c.canal === 'pro' && c.client.type === 'pro'));
    const totaux = r.json.elements.map((c) => c.totalTTC);
    assert.deepEqual(totaux, [...totaux].sort((a, b) => a - b));
    assert.equal(Object.values(r.json.compteurs).reduce((s, x) => s + x, 0), r.json.total);
    const nouvelles = await n.get('crm', 'commandes', { statut: 'nouvelle' });
    assert.ok(nouvelles.json.elements.every((c) => c.statut === 'nouvelle'));
    const q = await n.get('crm', 'commandes', { q: 'platanes' });
    assert.ok(q.json.total >= 10);
    assert.equal((await n.get('crm', 'commandes', { statut: 'perdue' })).status, 400);
    assert.equal((await n.get('crm', 'commande', { id: 'cmd_aaaaaaaaaaaa' })).status, 404);
    assert.equal((await n.get('crm', 'commande', { id: '../x' })).status, 404);
  });

  test('cycle complet d’une commande en ligne : préparation, expédition (suivi exigé), livraison, remboursement', async () => {
    const cree = await n.post('site', 'commande', commandePublique());
    const id = cree.json.id;
    let c = (await n.get('crm', 'commande', { id })).json;
    assert.deepEqual(c.transitions.map((t) => t.statut), ['en-preparation', 'annulee']);
    assert.equal(c.totaux.totalTTC, 41.7);
    assert.equal(c.client.email, 'anne.essai@essai.test');
    const p = await n.patch('crm', 'commande', { statut: 'en-preparation' }, { query: { id } });
    assert.equal(p.json.statut, 'en-preparation');
    const sansSuivi = await n.patch('crm', 'commande', { statut: 'expediee' }, { query: { id } });
    assert.equal(sansSuivi.status, 400);
    assert.equal(sansSuivi.json.champ, 'suivi');
    const interdit = await n.patch('crm', 'commande', { statut: 'livree' }, { query: { id } });
    assert.equal(interdit.status, 409);
    const e = await n.patch('crm', 'commande', { statut: 'expediee', suivi: { transporteur: 'Colissimo', numero: '6A12345678901' } }, { query: { id } });
    assert.equal(e.json.statut, 'expediee');
    assert.deepEqual(e.json.suivi, { transporteur: 'Colissimo', numero: '6A12345678901' });
    await n.patch('crm', 'commande', { statut: 'livree' }, { query: { id } });
    c = (await n.patch('crm', 'commande', { statut: 'remboursee' }, { query: { id } })).json;
    assert.equal(c.statut, 'remboursee');
    assert.equal(c.paiement.statut, 'rembourse');
    assert.deepEqual(c.historique.map((h) => h.statut).filter(Boolean), ['nouvelle', 'en-preparation', 'expediee', 'livree', 'remboursee']);
    const doc = await docDe(n);
    const types = doc.courriels.filter((x) => x.lie?.id === id).map((x) => x.objet);
    assert.equal(types.length, 4); // confirmation, préparation, expédition, remboursement
    assert.ok(types.some((o) => /expédiée/.test(o)));
    assert.ok(doc.courriels.some((x) => x.lie?.id === id && x.contenu.paragraphes.some((t) => t.includes('6A12345678901'))));
    assert.ok(doc.journal.some((j) => j.action === 'commande.statut' && j.cible.id === id && /Expédiée → Livrée/.test(j.details)));
  });

  test('annulation : stock remis, remboursement, courriel', async () => {
    const avant = (await docDe(n)).produits['pac-citron'].variantes['1000'].stock;
    const cree = await n.post('site', 'commande', commandePublique({ lignes: [ligne('pac-citron', '1000', 5)] }));
    assert.equal((await docDe(n)).produits['pac-citron'].variantes['1000'].stock, avant - 5);
    const c = await n.patch('crm', 'commande', { statut: 'annulee' }, { query: { id: cree.json.id } });
    assert.equal(c.json.statut, 'annulee');
    assert.equal(c.json.paiement.statut, 'rembourse');
    const doc = await docDe(n);
    assert.equal(doc.produits['pac-citron'].variantes['1000'].stock, avant);
    assert.ok(doc.mouvements.some((m) => m.motif === 'annulation' && m.commandeId === cree.json.id && m.delta === 5));
    assert.ok(doc.courriels.at(-1).objet.includes('annulée'));
  });

  test('retrait : préparation, prête (courriel), retirée', async () => {
    const cree = await n.post('site', 'commande', commandePublique({ livraison: { mode: 'retrait', jourRetrait: '2026-10-17' } }));
    const id = cree.json.id;
    await n.patch('crm', 'commande', { statut: 'en-preparation' }, { query: { id } });
    const exp = await n.patch('crm', 'commande', { statut: 'expediee', suivi: { numero: 'X' } }, { query: { id } });
    assert.equal(exp.status, 409);
    const p = await n.patch('crm', 'commande', { statut: 'prete' }, { query: { id } });
    assert.deepEqual(p.json.transitions.map((t) => t.statut), ['retiree', 'annulee']);
    assert.equal((await docDe(n)).courriels.at(-1).type, 'retrait');
    assert.equal((await n.patch('crm', 'commande', { statut: 'retiree' }, { query: { id } })).json.statut, 'retiree');
  });

  test('commande pro : facture à l’expédition (numéro suivant, échéance), règlement', async () => {
    const pro = await premier(n, 'commandes', { canal: 'pro', statut: 'nouvelle' });
    const doc0 = await docDe(n);
    const seq = doc0.seq.facture;
    await n.patch('crm', 'commande', { statut: 'en-preparation' }, { query: { id: pro.id } });
    const e = await n.patch('crm', 'commande', { statut: 'expediee' }, { query: { id: pro.id } });
    assert.equal(e.status, 200, e.texte);
    assert.equal(e.json.facture.numero, `FA-26-${String(seq + 1).padStart(5, '0')}`);
    assert.equal(e.json.facture.date, '2026-10-15');
    assert.equal(e.json.facture.statut, 'a-regler');
    const compte = (await docDe(n)).comptes.find((k) => k.id === e.json.compteId);
    const echeances = { comptant: '2026-10-15', '30j-fdm': '2026-11-30', '45j': '2026-11-29', prelevement: '2026-10-25' };
    assert.equal(e.json.facture.echeance, echeances[compte.conditions]);
    assert.ok((await docDe(n)).courriels.some((x) => x.type === 'facture' && x.lie.id === pro.id));
    const reglee = await n.patch('crm', 'commande', { factureStatut: 'payee' }, { query: { id: pro.id } });
    assert.equal(reglee.json.facture.statut, 'payee');
    assert.equal(reglee.json.facture.payeeLe, '2026-10-15');
    assert.equal(reglee.json.paiement.statut, 'paye');
  });

  test('actions groupées : succès et refus détaillés', async () => {
    const nouvelles = (await n.get('crm', 'commandes', { statut: 'nouvelle', canal: 'en-ligne' })).json.elements.filter((c) => c.paiement.statut === 'paye');
    const livree = await premier(n, 'commandes', { statut: 'livree' });
    const r = await n.post('crm', 'commandes-statut', { ids: [...nouvelles.map((c) => c.id), livree.id], statut: 'en-preparation' });
    assert.equal(r.status, 200);
    assert.equal(r.json.ok.length, nouvelles.length);
    assert.equal(r.json.erreurs.length, 1);
    assert.equal(r.json.erreurs[0].id, livree.id);
  });

  test('saisie par téléphone (particulier) et pour un compte pro (licence, minimum, encours)', async () => {
    const tel = await n.post('crm', 'commande', { client: { prenom: 'Lou', nom: 'Essai', email: 'lou@example.org', telephone: '0639981234' }, livraison: { mode: 'retrait', jourRetrait: '2026-10-17' }, paiement: { mode: 'a-reception' }, lignes: [ligne('fun-blue', '1000', 2)], note: 'Appel du matin' });
    assert.equal(tel.status, 201);
    assert.equal(tel.json.canal, 'telephone');
    assert.match(tel.json.numero, /^WEB-/);
    assert.equal(tel.json.operation, undefined, 'Octobre Rose : pas pour le téléphone');
    assert.equal(tel.json.notes[0].texte, 'Appel du matin');
    assert.equal(tel.json.paiement.statut, 'en-attente');
    const doc = await docDe(n);
    const sansLicence = doc.comptes.find((k) => k.licence === 'aucune');
    const lic = await n.post('crm', 'commande', { compteId: sansLicence.id, lignes: [ligne('pastis-marra', '700', 30)] });
    assert.equal(lic.status, 403);
    assert.equal(lic.json.code, 'licence');
    const platanes = doc.comptes.find((k) => k.enseigne === 'Café des Platanes');
    const petit = await n.post('crm', 'commande', { compteId: platanes.id, lignes: [ligne('pac-citron', '1000', 6)] });
    assert.equal(petit.json.code, 'minimum');
    // encours autorisé abaissé : la commande le dépasse
    await n.patch('crm', 'compte', { encoursMax: 100 }, { query: { id: platanes.id } });
    const gros = await n.post('crm', 'commande', { compteId: platanes.id, lignes: [ligne('pac-citron', '1000', 40)] });
    assert.equal(gros.status, 409);
    assert.equal(gros.json.code, 'encours');
    await n.patch('crm', 'compte', { encoursMax: 4000 }, { query: { id: platanes.id } });
    const ok = await n.post('crm', 'commande', { compteId: platanes.id, lignes: [ligne('pac-citron', '1000', 40)] });
    assert.equal(ok.status, 201);
    assert.match(ok.json.numero, /^PRO-26-\d{5}$/);
    assert.equal(ok.json.lignes[0].prixUnitaireHT, 4.43); // grille CHR, remise 3 %
    assert.equal(ok.json.totaux.articlesHT, 177.2);
    assert.equal(ok.json.totaux.livraisonHT, 18);
    assert.equal(ok.json.contact.nom, 'Café des Platanes');
  });
});

describe('clients, comptes, demandes', () => {
  let n;
  beforeEach(async () => {
    environnementNeuf();
    n = new Navigateur();
    await n.entrer('direction');
  });

  test('clients : segments, création (doublon refusé), modification, newsletter synchronisée', async () => {
    const l = await n.get('crm', 'clients', { segment: 'fideles' });
    assert.ok(l.json.elements.every((k) => k.commandes >= 3));
    assert.equal(l.json.compteurs.tous, 90);
    const cree = await n.post('crm', 'client', { prenom: 'Nina', nom: 'Essai', email: 'nina@example.com', newsletter: true, tags: ['salon', 'salon', 'VIP'] });
    assert.equal(cree.status, 201);
    assert.deepEqual(cree.json.tags, ['salon', 'VIP']);
    assert.equal((await n.post('crm', 'client', { prenom: 'N', nom: 'E', email: 'NINA@example.com' })).status, 409);
    const m = await n.patch('crm', 'client', { newsletter: false, notes: 'Préfère le téléphone' }, { query: { id: cree.json.id } });
    assert.equal(m.json.notes, 'Préfère le téléphone');
    assert.equal((await docDe(n)).abonnes.find((a) => a.email === 'nina@example.com').statut, 'desinscrit');
  });

  test('RGPD : export des données, puis suppression qui anonymise les commandes', async () => {
    await n.post('site', 'commande', commandePublique({ newsletter: true }));
    const doc = await docDe(n);
    const k = doc.clients.find((x) => x.email === 'anne.essai@essai.test');
    const ex = await n.get('crm', 'client-export', { id: k.id });
    assert.equal(ex.status, 200);
    assert.match(ex.headers.get('content-disposition'), /attachment/);
    assert.equal(ex.json.client.email, 'anne.essai@essai.test');
    assert.equal(ex.json.commandes.length, 1);
    const s = await n.delete('crm', 'client', {}, { query: { id: k.id } });
    assert.deepEqual(s.json, { ok: true, commandesAnonymisees: 1 });
    const apres = await docDe(n);
    assert.equal(apres.clients.find((x) => x.id === k.id), undefined);
    assert.equal(apres.abonnes.find((a) => a.email === 'anne.essai@essai.test'), undefined);
    const c = apres.commandes.find((x) => x.anonymise);
    const vue = commandeComplete(c, index(apres));
    assert.equal(vue.contact.nom, 'Client supprimé');
    assert.equal(vue.livraison.adresse, undefined);
    assert.ok(!JSON.stringify(apres).includes('anne.essai@essai.test'));
    assert.equal((await n.get('crm', 'client', { id: k.id })).status, 404);
  });

  test('comptes : création avec invitation, activation, connexion du pro', async () => {
    const r = await n.post('crm', 'compte', {
      raisonSociale: 'SAS Essai',
      enseigne: 'Bar Essai',
      type: 'chr',
      licence: 'licence-iv',
      email: 'bar@example.com',
      adresseFacturation: { ligne1: '1 rue A', cp: '84000', ville: 'Avignon' },
      grille: 'chr',
      conditions: 'comptant',
      encoursMax: 1000,
      utilisateur: { prenom: 'Max', nom: 'Essai', email: 'max@example.com' },
    });
    assert.equal(r.status, 201);
    assert.equal(r.json.compte.adressesLivraison.length, 1);
    assert.equal(r.json.utilisateur.statut, 'invitation');
    assert.match(r.json.lienDemo, /^\/espace-pro\/activer\?jeton=/);
    const jeton = new URL(r.json.lienDemo, 'http://x').searchParams.get('jeton');
    const inv = await n.get('session', 'invitation', { jeton });
    assert.deepEqual(inv.json, { email: 'max@example.com', prenom: 'Max', espace: 'pro', compte: { id: r.json.compte.id, raisonSociale: 'SAS Essai', enseigne: 'Bar Essai' } });
    const a = await n.post('session', 'activer', { jeton, motDePasse: 'Bar-Essai-2026' });
    assert.equal(a.status, 200);
    assert.equal(a.json.redirection, '/espace-pro/accueil');
    assert.equal((await n.post('session', 'activer', { jeton, motDePasse: 'Bar-Essai-2026' })).status, 404, 'usage unique');
    const doublon = await n.post('crm', 'compte-utilisateur', { compteId: r.json.compte.id, prenom: 'Max', nom: 'Essai', email: 'max@example.com' });
    assert.equal(doublon.status, 409);
    const suspendu = await n.patch('crm', 'compte', { statut: 'suspendu' }, { query: { id: r.json.compte.id } });
    assert.equal(suspendu.json.statut, 'suspendu');
    assert.equal((await n.get('session', 'moi', { espace: 'pro' })).json.utilisateur, null, 'session pro fermée par la suspension');
  });

  test('demandes : accepter (compte + invitation), refuser (courriel), pas deux fois', async () => {
    const nouvelles = (await n.get('crm', 'demandes', { statut: 'nouvelle' })).json;
    assert.equal(nouvelles.compteurs.nouvelle, 3);
    const [a, b] = nouvelles.elements;
    const ok = await n.post('crm', 'demande-accepter', { grille: 'chr', conditions: '30j-fdm', encoursMax: 2000, licence: 'licence-iv', remise: 2 }, { query: { id: a.id } });
    assert.equal(ok.status, 201);
    assert.equal(ok.json.demande.statut, 'acceptee');
    assert.equal(ok.json.compte.enseigne, a.societe);
    assert.equal(ok.json.compte.origine, 'site');
    assert.ok((await docDe(n)).courriels.some((c) => c.type === 'invitation' && c.a === a.email));
    assert.equal((await n.post('crm', 'demande-accepter', { grille: 'chr', conditions: '30j-fdm', encoursMax: 2000 }, { query: { id: a.id } })).status, 409);
    const non = await n.post('crm', 'demande-refuser', { motif: 'Hors de notre zone de livraison.' }, { query: { id: b.id } });
    assert.equal(non.json.statut, 'refusee');
    const c = (await docDe(n)).courriels.at(-1);
    assert.equal(c.type, 'demande-pro');
    assert.ok(c.contenu.paragraphes.some((p) => p.includes('Hors de notre zone')));
  });
});

describe('produits, stocks, visites, messages, newsletter, équipe, paramètres', () => {
  let n;
  beforeEach(async () => {
    environnementNeuf();
    n = new Navigateur();
    await n.entrer('direction');
  });

  test('prix : le site de la démo suit ; tarif pro de référence recalculé ou fixé', async () => {
    const r = await n.patch('crm', 'produit', { variantes: { 1000: { prixTTC: 6.9 } } }, { query: { slug: 'pac-citron' } });
    const v = r.json.variantes[0];
    assert.equal(v.prixTTC, 6.9);
    assert.equal(v.prixProHT, 4.71);
    assert.equal(v.prixOfficielTTC, 6.7);
    assert.equal((await n.get('site', 'catalogue')).json.produits['pac-citron'].variantes['1000'].prixTTC, 6.9);
    const f = await n.patch('crm', 'produit', { variantes: { 1000: { prixProHT: 4.5 } } }, { query: { slug: 'pac-citron' } });
    assert.equal(f.json.variantes[0].proManuel, true);
    const off = await n.patch('crm', 'produit', { actif: false }, { query: { slug: 'fun-blue' } });
    assert.equal(off.json.actif, false);
    const refus = await n.post('site', 'commande', commandePublique());
    assert.equal(refus.status, 400);
    assert.equal(refus.json.code, 'produit');
    assert.equal((await n.patch('crm', 'produit', { variantes: { 700: { prixTTC: 5 } } }, { query: { slug: 'pac-citron' } })).status, 400);
  });

  test('stock : mouvements, pas de stock négatif, motifs cohérents', async () => {
    const r = await n.post('crm', 'stock', { slug: 'pac-citron', varianteId: '1000', delta: -2, motif: 'casse', note: 'Chute' });
    assert.equal(r.status, 201);
    assert.equal(r.json.mouvement.delta, -2);
    assert.equal((await n.post('crm', 'stock', { slug: 'pac-citron', varianteId: '1000', delta: -99999, motif: 'inventaire' })).status, 400);
    assert.equal((await n.post('crm', 'stock', { slug: 'pac-citron', varianteId: '1000', delta: -5000, motif: 'inventaire' })).status, 409);
    assert.equal((await n.post('crm', 'stock', { slug: 'pac-citron', varianteId: '1000', delta: 5, motif: 'casse' })).status, 400);
    assert.equal((await n.post('crm', 'stock', { slug: 'pac-citron', varianteId: '1000', delta: 5, motif: 'vente' })).status, 400);
    const m = await n.get('crm', 'mouvements', { slug: 'pac-citron' });
    assert.equal(m.json.elements[0].note, 'Chute');
  });

  test('visites : séance ajoutée (même un dimanche), capacité, réservation, modification', async () => {
    const s = await n.post('crm', 'seance', { date: '2026-12-20', moment: 'matin', capacite: 10, langue: 'en' });
    assert.equal(s.status, 201);
    assert.equal((await n.post('crm', 'seance', { date: '2026-12-20', moment: 'matin' })).status, 409);
    const r1 = await n.post('crm', 'reservation', { seanceId: s.json.id, personnes: 8, nom: 'Club Essai', email: 'club@example.org', source: 'telephone' });
    assert.equal(r1.status, 201);
    assert.equal(r1.json.source, 'telephone');
    const plein = await n.post('crm', 'reservation', { seanceId: s.json.id, personnes: 3, nom: 'Trop', email: 'trop@example.org' });
    assert.equal(plein.status, 409);
    assert.equal((await n.patch('crm', 'seance', { capacite: 5 }, { query: { id: s.json.id } })).status, 409);
    assert.equal((await n.patch('crm', 'reservation', { personnes: 11 }, { query: { id: r1.json.id } })).status, 409);
    const v = await n.patch('crm', 'reservation', { statut: 'annulee' }, { query: { id: r1.json.id } });
    assert.equal(v.json.statut, 'annulee');
    const vis = await n.get('crm', 'visites', { du: '2026-12-20', au: '2026-12-20' });
    assert.equal(vis.json.seances[0].restantes, 10);
    const pub = await new Navigateur().get('site', 'creneaux', { mois: '2026-12' });
    assert.ok(pub.status === 200);
    assert.equal((await n.get('site', 'creneaux', { mois: '2026-12' })).json.jours.find((j) => j.date === '2026-12-20').ouvert, true);
  });

  test('messages : lecture qui marque lu, réponse (fil + courriel), attribution', async () => {
    const m = await premier(n, 'messages', { statut: 'nouveau' });
    assert.equal(m.lu, false);
    const lu = await n.get('crm', 'message', { id: m.id });
    assert.equal(lu.json.lu, true);
    assert.ok(Array.isArray(lu.json.fil));
    const rep = await n.post('crm', 'message-reponse', { texte: 'Bonjour,\n\nC’est noté, merci !' }, { query: { id: m.id } });
    assert.equal(rep.status, 201);
    assert.equal(rep.json.statut, 'en-cours');
    assert.equal(rep.json.fil.at(-1).de, 'equipe');
    const doc = await docDe(n);
    assert.equal(doc.courriels.at(-1).type, 'reponse');
    assert.equal(doc.courriels.at(-1).a, m.email);
    const boutique = doc.utilisateurs.find((u) => u.role === 'boutique');
    const att = await n.patch('crm', 'message', { assigneA: boutique.id, statut: 'traite' }, { query: { id: m.id } });
    assert.equal(att.json.assigneA.id, boutique.id);
    assert.equal((await n.patch('crm', 'message', { assigneA: 'usr_aaaaaaaaaaaa' }, { query: { id: m.id } })).status, 400);
  });

  test('newsletter : statistiques, campagne (brouillon → envoi simulé), désinscription, codes promo', async () => {
    const nl = (await n.get('crm', 'newsletter')).json;
    assert.equal(nl.abonnes.total, 220);
    assert.equal(nl.abonnes.evolution.length, 12);
    assert.equal(nl.campagnes.length, 2);
    const cam = await n.post('crm', 'campagne', { objet: 'Essai', introduction: 'Intro', corps: 'Texte', segment: 'visiteurs', bouton: { libelle: 'Voir', url: '/visiter' } });
    assert.equal(cam.json.statut, 'brouillon');
    assert.equal((await n.post('crm', 'campagne', { objet: 'X', introduction: 'Y', corps: 'Z', segment: 'tous', bouton: { libelle: 'V', url: 'javascript:alert(1)' } })).status, 400);
    const env = await n.post('crm', 'campagne-envoyer', {}, { query: { id: cam.json.id } });
    assert.equal(env.json.destinataires, nl.abonnes.parSource.visite);
    assert.equal((await n.patch('crm', 'campagne', { objet: 'Autre' }, { query: { id: cam.json.id } })).status, 409);
    assert.equal((await n.delete('crm', 'campagne', {}, { query: { id: cam.json.id } })).status, 409);
    const doc = await docDe(n);
    assert.equal(doc.courriels.at(-1).type, 'campagne');
    const a = doc.abonnes.find((x) => (x.statut || 'inscrit') === 'inscrit');
    assert.equal((await n.patch('crm', 'abonne', { statut: 'desinscrit' }, { query: { id: a.id } })).json.statut, 'desinscrit');
    assert.deepEqual((await n.delete('crm', 'abonne', {}, { query: { id: a.id } })).json, { ok: true });
    assert.equal((await n.post('crm', 'promo', { code: 'pacete', libelle: 'Doublon', type: 'montant', valeur: 1 })).status, 409);
    const p = await n.post('crm', 'promo', { code: 'NOEL15', libelle: '−15 %', type: 'pourcentage', valeur: 15, fin: '2026-10-01' });
    assert.equal(p.json.etat, 'expire');
    const code = await n.post('site', 'code-promo', { code: 'NOEL15', lignes: [ligne('pac-citron', '1000', 3)] });
    assert.equal(code.status, 400);
    const ouvert = await n.patch('crm', 'promo', { fin: null }, { query: { id: p.json.id } });
    assert.equal(ouvert.json.etat, 'actif');
    assert.equal((await n.post('site', 'code-promo', { code: 'NOEL15', lignes: [ligne('pac-citron', '1000', 3)] })).json.remiseTTC, 3.02);
  });

  test('équipe : invitation, changement de rôle qui ferme les sessions, pas contre soi-même', async () => {
    const inv = await n.post('crm', 'membre', { prenom: 'Sam', nom: 'Essai', email: 'sam@blachere.example', role: 'boutique' });
    assert.equal(inv.status, 201);
    assert.match(inv.json.lienDemo, /^\/crm\/activer\?jeton=/);
    const sam = new Navigateur();
    sam.cookies = new Map([...n.cookies].filter(([k]) => k.startsWith('bl_demo')));
    const jeton = new URL(inv.json.lienDemo, 'http://x').searchParams.get('jeton');
    assert.equal((await sam.post('session', 'activer', { jeton, motDePasse: 'Sam-Essai-2026' })).json.redirection, '/crm');
    assert.equal((await sam.get('crm', 'visites')).status, 200);
    await n.patch('crm', 'membre', { role: 'logistique' }, { query: { id: inv.json.membre.id } });
    assert.equal((await sam.get('crm', 'visites')).status, 401);
    const moi = (await n.get('session', 'moi', { espace: 'crm' })).json.utilisateur;
    assert.equal((await n.patch('crm', 'membre', { actif: false }, { query: { id: moi.id } })).status, 409);
    const julien = (await docDe(n)).utilisateurs.find((u) => u.role === 'pro');
    assert.equal((await n.patch('crm', 'membre', { role: 'direction' }, { query: { id: julien.id } })).status, 404);
  });

  test('paramètres : barème validé, conditions pro appliquées', async () => {
    assert.equal((await n.patch('crm', 'parametres', { livraison: { colissimo: [{ jusquA: 5, prixTTC: 5 }, { jusquA: 3, prixTTC: 6 }] } })).status, 400);
    const r = await n.patch('crm', 'parametres', { livraison: { francoTTC: 80 }, pro: { minimumHT: 100 } });
    assert.equal(r.json.livraison.francoTTC, 80);
    assert.equal(r.json.pro.minimumHT, 100);
    const opt = await n.post('site', 'livraison', { lignes: [ligne('pac-citron', '1000', 12)] });
    assert.deepEqual(opt.json.options.map((o) => o.prixTTC), [0, 0, 0]);
  });
});

describe('tableau de bord, notifications, recherche, courriels, journal', () => {
  let n;
  beforeEach(async () => {
    environnementNeuf();
    n = new Navigateur();
    await n.entrer('direction');
  });

  test('indicateurs calculés depuis les données', async () => {
    const t = (await n.get('crm', 'tableau')).json;
    const doc = await docDe(n);
    const idx = index(doc);
    const valides = doc.commandes.filter((c) => !['annulee', 'remboursee'].includes(c.statut)).map((c) => commandeComplete(c, idx));
    const htDu = (f) => Math.round(valides.filter(f).reduce((s, c) => s + Math.round(c.totaux.totalHT * 100), 0)) / 100;
    assert.equal(t.ca.jour, htDu((c) => jourParis(c.createdAt) === '2026-10-15'));
    assert.equal(t.ca.mois, htDu((c) => jourParis(c.createdAt).startsWith('2026-10')));
    assert.equal(t.ca.moisPrecedent, htDu((c) => jourParis(c.createdAt).startsWith('2026-09')));
    assert.equal(t.ventes30.length, 30);
    assert.equal(t.ventes30.at(-1).date, '2026-10-15');
    assert.equal(Math.round(t.ventes30.reduce((s, j) => s + j.enLigne * 100 + j.pro * 100, 0)), Math.round((t.ca.enLigne30 + t.ca.pro30) * 100));
    assert.equal(t.aTraiter.facturesEnRetard, 1);
    assert.equal(t.aTraiter.demandes, 3);
    assert.equal(t.top.length, 5);
    assert.ok(t.stocksBas.some((s) => s.etat === 'rupture'));
    assert.ok(t.prochainesVisites.every((s) => s.date >= '2026-10-15' && typeof s.restantes === 'number'));
    assert.equal(t.activite.length, 10);
  });

  test('notifications : nouveautés depuis la dernière consultation', async () => {
    const avant = (await n.get('crm', 'notifications')).json;
    fixerHorloge('2026-10-15T08:31:00Z');
    await new Navigateur({ ip: '203.0.113.99' }).post('site', 'commande', commandePublique());
    await n.post('site', 'commande', commandePublique());
    const apres = (await n.get('crm', 'notifications')).json;
    assert.equal(apres.commandes, avant.commandes + 1);
    assert.notEqual(apres.version, avant.version);
    fixerHorloge('2026-10-15T08:32:00Z');
    await n.post('crm', 'notifications-vues', {});
    assert.equal((await n.get('crm', 'notifications')).json.commandes, 0);
  });

  test('recherche globale, filtrée par les droits', async () => {
    const r = (await n.get('crm', 'recherche', { q: 'platanes' })).json.resultats;
    assert.ok(r.some((x) => x.type === 'compte' && x.titre === 'Café des Platanes'));
    assert.ok(r.some((x) => x.type === 'commande'));
    assert.ok(r.every((x) => x.url.startsWith('/crm/')));
    assert.deepEqual((await n.get('crm', 'recherche', { q: 'p' })).json.resultats, []);
    const l = new Navigateur();
    l.cookies = new Map(n.cookies);
    await l.entrer('logistique');
    const rl = (await l.get('crm', 'recherche', { q: 'a' })).json.resultats;
    assert.ok(!rl.some((x) => x.type === 'message' || x.type === 'reservation'));
  });

  test('courriels et journal : listes filtrées, détail', async () => {
    const c = (await n.get('crm', 'courriels', { type: 'invitation' })).json;
    assert.ok(c.elements.every((x) => x.type === 'invitation'));
    const d = (await n.get('crm', 'courriel', { id: c.elements[0].id })).json;
    assert.match(d.contenu.bouton.url, /^\/espace-pro\/activer\?jeton=/);
    const j = (await n.get('crm', 'journal', { action: 'commande' })).json;
    assert.ok(j.elements.length > 0 && j.elements.every((e) => e.action.startsWith('commande.')));
    assert.ok(j.actions.includes('stock.mouvement'));
  });
});

describe('exports CSV', () => {
  test('BOM, « ; », décimales à virgule, pièce jointe, formules neutralisées, don Octobre Rose', async () => {
    environnementNeuf();
    const n = new Navigateur();
    await n.entrer('direction');
    await n.post('site', 'commande', commandePublique({ client: { prenom: '=HYPERLINK("x")', nom: 'Essai', email: 'formule@example.com', telephone: '06 39 98 11 22' } }));
    const r = await n.get('crm', 'export', { type: 'commandes' });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'text/csv; charset=utf-8');
    assert.equal(r.headers.get('content-disposition'), 'attachment; filename="commandes-2026-10-15.csv"');
    assert.ok(r.texte.startsWith('﻿'));
    const lignes = r.texte.slice(1).split('\r\n');
    assert.equal(lignes[0].slice(0, 7), 'Numéro;');
    const entete = lignes[0].split(';');
    assert.equal(entete.at(-1), 'Don Octobre Rose (€)');
    assert.ok(lignes[1].includes(';"\'=HYPERLINK(""x"") Essai";'), lignes[1]);
    assert.match(lignes[1], /;41,70;/);
    assert.ok(lignes[1].endsWith(';3,00'), lignes[1]);
    const p = await n.get('crm', 'export', { type: 'produits' });
    assert.match(p.texte, /PAC Citron®;PAC Citron;1 L;non;;6,70;4,57;5,5;/);
    assert.equal((await n.get('crm', 'export', { type: 'secret' })).status, 400);
  });
});

describe('Octobre Rose au tableau de bord', () => {
  test('dons comptés, commandes annulées et pro exclues, hors période exclue, 30 jours après la fin', async () => {
    environnementNeuf(MAINTENANT);
    const n = new Navigateur();
    await n.entrer('direction');
    const base = (await n.get('crm', 'tableau')).json.operation;
    assert.equal(base.enCours, true);
    assert.equal(base.debut, '2026-10-01');
    // + 4 bouteilles de PAC Citron en ligne
    const a = await n.post('site', 'commande', commandePublique({ lignes: [ligne('pac-citron', '1000', 4), ligne('fun-blue', '1000', 2)] }));
    assert.deepEqual(a.json.operation, { id: 'octobre-rose-2026', nom: 'Octobre Rose', beneficiaire: 'Institut du Cancer Avignon-Provence', bouteilles: 4, montant: 4 });
    // annulée : ne compte pas
    const b = await n.post('site', 'commande', commandePublique({ lignes: [ligne('pac-citron', '1000', 10)] }));
    await n.patch('crm', 'commande', { statut: 'annulee' }, { query: { id: b.json.id } });
    // pro : pas concernée
    const doc = await docDe(n);
    const platanes = doc.comptes.find((k) => k.enseigne === 'Café des Platanes');
    const pro = await n.post('crm', 'commande', { compteId: platanes.id, lignes: [ligne('pac-citron', '1000', 36)] });
    assert.equal(pro.status, 201);
    assert.equal(pro.json.operation, undefined);
    const op = (await n.get('crm', 'tableau')).json.operation;
    assert.equal(op.bouteilles, base.bouteilles + 4);
    assert.equal(op.montant, base.montant + 4);
    assert.equal(op.commandes, base.commandes + 1);
    // le courriel de confirmation le dit
    const c = (await docDe(n)).courriels.find((x) => x.lie?.id === a.json.id);
    assert.ok(c.contenu.paragraphes.includes('Grâce à votre commande, 4 € seront reversés à l’Institut du Cancer Avignon-Provence (Sainte-Catherine) dans le cadre d’Octobre Rose.'));
    // la commande et l'export le montrent
    assert.deepEqual((await n.get('crm', 'commande', { id: a.json.id })).json.operation, a.json.operation);
    // après la fin : bilan affiché 30 jours (enCours: false), commandes de novembre non concernées
    // (même démo : le cookie de démo vaut 30 jours)
    fixerHorloge('2026-11-10T10:00:00Z');
    await n.entrer('direction');
    const nov = await n.post('site', 'commande', commandePublique({ lignes: [ligne('pac-citron', '1000', 2)] }));
    assert.equal(nov.json.operation, undefined);
    const apres = (await n.get('crm', 'tableau')).json.operation;
    assert.equal(apres.enCours, false);
    assert.equal(apres.bouteilles, op.bouteilles);
    fixerHorloge('2026-12-01T10:00:00Z');
    await n.entrer('direction');
    assert.equal((await n.get('crm', 'tableau')).json.operation, null);
    fixerHorloge('2026-11-30T10:00:00Z');
    await n.entrer('direction');
    assert.equal((await n.get('crm', 'tableau')).json.operation?.enCours, false);
    // avant le début : rien
    environnementNeuf('2026-09-20T10:00:00Z');
    const s = new Navigateur();
    await s.entrer('direction');
    assert.equal((await s.get('crm', 'tableau')).json.operation, null);
    assert.equal((await s.post('site', 'commande', commandePublique())).json.operation, undefined);
  });
});

// Écarts relevés par l'interface du CRM : effacement d'un champ facultatif, CA des 30 jours
// précédents, fiche d'un abonné, exports filtrés comme les listes, dates des messages en français.
describe('retours du CRM', () => {
  let n;
  beforeEach(async () => {
    environnementNeuf();
    n = new Navigateur();
    await n.entrer('direction');
  });

  const sansIso = (texte) => assert.doesNotMatch(texte, /\d{4}-\d{2}-\d{2}/, texte);

  test('PATCH séance : guideId null retire le guide, notes "" efface les notes', async () => {
    const lea = (await docDe(n)).utilisateurs.find((u) => u.role === 'boutique');
    const s = (await n.post('crm', 'seance', { date: '2026-12-27', moment: 'matin', guideId: lea.id, notes: 'Groupe scolaire' })).json;
    assert.equal(s.guide.id, lea.id);
    assert.equal(s.notes, 'Groupe scolaire');
    const x = await n.patch('crm', 'seance', { guideId: null, notes: '' }, { query: { id: s.id } });
    assert.equal(x.status, 200, x.texte);
    assert.equal(x.json.guide, undefined);
    assert.equal(x.json.notes, undefined);
    const stockee = (await docDe(n)).seances.find((y) => y.id === s.id);
    assert.ok(!('guideId' in stockee) && !('notes' in stockee), JSON.stringify(stockee));
    // champ absent : inchangé ; '' vaut null ; guide inconnu : 400 sur guideId
    assert.equal((await n.patch('crm', 'seance', { guideId: lea.id, notes: 'Accueil en anglais' }, { query: { id: s.id } })).json.guide.id, lea.id);
    const c = (await n.patch('crm', 'seance', { capacite: 12 }, { query: { id: s.id } })).json;
    assert.equal(c.guide.id, lea.id);
    assert.equal(c.notes, 'Accueil en anglais');
    assert.equal((await n.patch('crm', 'seance', { guideId: '' }, { query: { id: s.id } })).json.guide, undefined);
    const inconnu = await n.patch('crm', 'seance', { guideId: 'usr_aaaaaaaaaaaa' }, { query: { id: s.id } });
    assert.equal(inconnu.status, 400);
    assert.equal(inconnu.json.champ, 'guideId');
    // journal : libellé daté en français
    const j = (await docDe(n)).journal.filter((e) => e.cible?.id === s.id);
    assert.equal(j[0].cible.libelle, 'Séance du 27 décembre (matin)');
    for (const e of j) sansIso(`${e.cible.libelle} ${e.details || ''}`);
  });

  test('PATCH : null ou "" efface aussi les autres champs facultatifs', async () => {
    const doc = await docDe(n);
    const lea = doc.utilisateurs.find((u) => u.role === 'boutique');
    // client : téléphone et adresse retirés, notes vidées
    const k = doc.clients.find((c) => c.telephone && c.adresse);
    await n.patch('crm', 'client', { notes: 'À rappeler' }, { query: { id: k.id } });
    const kx = (await n.patch('crm', 'client', { telephone: null, adresse: null, notes: '' }, { query: { id: k.id } })).json;
    assert.equal(kx.telephone, undefined);
    assert.equal(kx.adresse, undefined);
    assert.equal(kx.notes, '');
    assert.equal(kx.email, k.email);
    // compte : commercial, téléphone, SIRET ; notes vidées
    const compte = doc.comptes.find((c) => c.telephone && c.commercialId && c.siret);
    const cx = (await n.patch('crm', 'compte', { commercialId: null, telephone: '', siret: null, notes: null }, { query: { id: compte.id } })).json;
    assert.equal(cx.commercial, null);
    assert.equal(cx.telephone, undefined);
    assert.equal(cx.siret, undefined);
    assert.equal(cx.notes, '');
    assert.equal(cx.enseigne, compte.enseigne);
    // membre : poste et téléphone
    const mx = (await n.patch('crm', 'membre', { telephone: null, poste: '' }, { query: { id: lea.id } })).json.membre;
    assert.equal(mx.telephone, undefined);
    assert.equal(mx.poste, undefined);
    // demande : note
    const dem = doc.demandes.find((d) => d.statut === 'nouvelle');
    assert.equal((await n.patch('crm', 'demande', { note: 'Rappeler lundi' }, { query: { id: dem.id } })).json.note, 'Rappeler lundi');
    assert.equal((await n.patch('crm', 'demande', { note: null }, { query: { id: dem.id } })).json.note, undefined);
    // réservation : notes
    const r = (await n.post('crm', 'reservation', { date: '2026-12-26', moment: 'apres-midi', personnes: 2, nom: 'Anne Essai', email: 'anne.visite@example.org', notes: 'Fauteuil roulant' })).json;
    assert.equal(r.notes, 'Fauteuil roulant', JSON.stringify(r));
    assert.equal((await n.patch('crm', 'reservation', { notes: '' }, { query: { id: r.id } })).json.notes, undefined);
    // message : attribution retirée par ''
    const msg = doc.messages.find((m) => m.statut === 'nouveau');
    assert.equal((await n.patch('crm', 'message', { assigneA: lea.id }, { query: { id: msg.id } })).json.assigneA.id, lea.id);
    assert.equal((await n.patch('crm', 'message', { assigneA: '' }, { query: { id: msg.id } })).json.assigneA, null);
    // promo : fin retirée, limite levée (null, comme à la création)
    const p = (await n.post('crm', 'promo', { code: 'HIVER5', libelle: '−5 €', type: 'montant', valeur: 5, fin: '2026-12-31', limite: 10 })).json;
    const px = (await n.patch('crm', 'promo', { fin: '', limite: null }, { query: { id: p.id } })).json;
    assert.equal(px.fin, undefined);
    assert.equal(px.limite, null);
    assert.equal(px.etat, 'actif');
  });

  test('tableau : CA HT des 30 jours précédents (J−59 à J−30)', async () => {
    const t = (await n.get('crm', 'tableau')).json;
    const doc = await docDe(n);
    const idx = index(doc);
    const valides = doc.commandes.filter((c) => !['annulee', 'remboursee'].includes(c.statut)).map((c) => commandeComplete(c, idx));
    const htDu = (f) => Math.round(valides.filter(f).reduce((s, c) => s + Math.round(c.totaux.totalHT * 100), 0)) / 100;
    assert.equal(t.ca.precedent30, htDu((c) => jourParis(c.createdAt) >= '2026-08-17' && jourParis(c.createdAt) <= '2026-09-15'));
    assert.ok(t.ca.precedent30 > 0);
    // une commande d'aujourd'hui ne change pas les 30 jours précédents
    await n.post('site', 'commande', commandePublique());
    assert.equal((await n.get('crm', 'tableau')).json.ca.precedent30, t.ca.precedent30);
  });

  test('fiche d’un abonné : abonné, client de même e-mail, courriels reçus ; droits', async () => {
    await n.post('site', 'commande', commandePublique({ newsletter: true, client: { prenom: 'Iris', nom: 'Abonnée', email: 'iris.abonnee@essai.test', telephone: '06 39 98 11 22' } }));
    const doc = await docDe(n);
    const a = doc.abonnes.find((x) => x.email === 'iris.abonnee@essai.test');
    const f = await n.get('crm', 'abonne', { id: a.id });
    assert.equal(f.status, 200, f.texte);
    assert.equal(f.json.id, a.id);
    assert.equal(f.json.email, 'iris.abonnee@essai.test');
    assert.equal(f.json.statut, 'inscrit');
    assert.equal(f.json.source, 'commande');
    assert.equal(f.json.client.nom, 'Iris Abonnée');
    assert.deepEqual(
      f.json.courriels.map((c) => c.type),
      ['bienvenue', 'commande'],
    );
    assert.ok(f.json.courriels.every((c) => c.id && c.date && c.objet));
    // un abonné sans fiche client
    const seul = doc.abonnes.find((x) => !doc.clients.some((k) => k.email === x.email));
    assert.equal((await n.get('crm', 'abonne', { id: seul.id })).json.client, null);
    assert.equal((await n.get('crm', 'abonne', { id: 'abo_aaaaaaaaaaaa' })).status, 404);
    assert.equal((await n.get('crm', 'abonne', { id: 'pas-un-id' })).status, 404);
    const l = new Navigateur();
    l.cookies = new Map(n.cookies);
    await l.entrer('logistique');
    assert.equal((await l.get('crm', 'abonne', { id: a.id })).status, 403);
    await l.entrer('boutique');
    assert.equal((await l.get('crm', 'abonne', { id: a.id })).status, 200);
  });

  test('exports : mêmes filtres que la liste quand ils sont fournis, complets sinon', async () => {
    const lignes = (r) => {
      assert.equal(r.status, 200, r.texte);
      return r.texte.slice(1).split('\r\n').filter(Boolean).slice(1);
    };
    const exporter = async (type, filtres = {}) => lignes(await n.get('crm', 'export', { type, ...filtres }));
    const doc = await docDe(n);
    // commandes
    assert.equal((await exporter('commandes')).length, doc.commandes.length);
    for (const f of [{ statut: 'livree' }, { canal: 'pro', du: '2026-09-01', au: '2026-09-30' }, { q: 'platanes' }, { canal: 'en-ligne', statut: 'nouvelle' }]) {
      const liste = (await n.get('crm', 'commandes', { ...f, par: 100 })).json;
      const csv = await exporter('commandes', f);
      assert.equal(csv.length, liste.total, JSON.stringify(f));
      assert.ok(liste.total > 0, JSON.stringify(f));
      // même ordre que la liste (plus récente d'abord)
      assert.deepEqual(
        csv.slice(0, liste.elements.length).map((x) => x.split(';')[0]),
        liste.elements.map((c) => c.numero),
      );
    }
    assert.ok((await exporter('commandes', { statut: 'livree' })).every((x) => x.split(';')[5] === 'Livrée'));
    assert.equal((await n.get('crm', 'export', { type: 'commandes', statut: 'inconnu' })).status, 400);
    // tri inconnu (même un nom d'Object.prototype) : tri par défaut, pas d'erreur interne
    for (const tri of ['__proto__', 'constructor', '-toString']) {
      assert.equal((await n.get('crm', 'commandes', { tri })).status, 200, tri);
      assert.equal((await n.get('crm', 'export', { type: 'clients', tri })).status, 200, tri);
    }
    // clients
    assert.equal((await exporter('clients')).length, doc.clients.length);
    const fideles = (await n.get('crm', 'clients', { segment: 'fideles', par: 100 })).json;
    assert.equal((await exporter('clients', { segment: 'fideles' })).length, fideles.total);
    assert.ok(fideles.total > 0 && fideles.total < doc.clients.length);
    // comptes
    assert.equal((await exporter('comptes')).length, doc.comptes.length);
    const chr = (await n.get('crm', 'comptes', { type: 'chr', par: 100 })).json;
    assert.deepEqual(
      (await exporter('comptes', { typeCompte: 'chr' })).map((x) => x.split(';')[0]),
      chr.elements.map((k) => k.enseigne),
    );
    // abonnés
    assert.equal((await exporter('abonnes')).length, doc.abonnes.length);
    const desinscrits = (await n.get('crm', 'newsletter', { statut: 'desinscrit', par: 100 })).json.liste;
    assert.equal((await exporter('abonnes', { statut: 'desinscrit' })).length, desinscrits.total);
    assert.ok(desinscrits.total > 0);
    // réservations : période du planning
    assert.equal((await exporter('reservations')).length, doc.reservations.length);
    const vis = (await n.get('crm', 'visites', { du: '2026-10-15', au: '2026-10-28' })).json;
    assert.deepEqual(
      (await exporter('reservations', { du: '2026-10-15', au: '2026-10-28' })).map((x) => x.split(';')[0]),
      vis.reservations.map((r) => r.reference),
    );
    assert.ok(vis.reservations.length > 0);
    assert.equal((await n.get('crm', 'export', { type: 'reservations', du: '2026-10-28', au: '2026-10-15' })).status, 400);
    // produits : une ligne par contenance des produits de la liste
    const variantes = (l) => l.reduce((t, p) => t + p.variantes.length, 0);
    const tous = (await n.get('crm', 'produits')).json;
    assert.equal((await exporter('produits')).length, variantes(tous.elements));
    const rupture = (await n.get('crm', 'produits', { stock: 'rupture' })).json;
    assert.equal((await exporter('produits', { stock: 'rupture' })).length, variantes(rupture.elements));
    assert.ok(rupture.elements.length > 0 && rupture.elements.length < tous.elements.length);
  });

  test('messages d’erreur : dates en français, jamais au format ISO', async () => {
    // séance fermée
    const s = (await n.post('crm', 'seance', { date: '2026-12-27', moment: 'matin' })).json;
    await n.patch('crm', 'seance', { statut: 'fermee' }, { query: { id: s.id } });
    const fermee = await n.post('crm', 'reservation', { date: '2026-12-27', moment: 'matin', personnes: 2, nom: 'Anne Essai', email: 'anne.visite@example.org' });
    assert.equal(fermee.status, 409);
    assert.match(fermee.json.erreur, /^Pas de visite le 27 décembre \(matin\)\s: séance fermée\.$/);
    // journal des réservations
    const r = await n.post('crm', 'reservation', { date: '2026-12-26', moment: 'apres-midi', personnes: 3, nom: 'Club Essai', email: 'club@example.org' });
    assert.equal(r.status, 201, r.texte);
    const e = (await docDe(n)).journal.at(-1);
    assert.equal(e.action, 'reservation.creation');
    assert.equal(e.details, '3 personnes, 26 décembre (après-midi)');
    // jour sans visite : saison et jours de fermeture tirés des paramètres
    const corps = { date: '2026-10-18', moment: 'matin', personnes: 2, nom: 'Anne Essai', email: 'anne.visite@example.org', rgpd: true };
    const dimanche = await n.post('site', 'reservation', corps);
    assert.equal(dimanche.status, 400);
    assert.match(dimanche.json.erreur, /^La distillerie ne propose pas de visite ce jour-là \(saison du 12 février au 31 décembre, fermé le dimanche\)\.$/);
    await n.patch('crm', 'parametres', { visites: { saison: { debut: '03-01', fin: '11-30' }, fermeLe: [0, 1] } });
    assert.match((await n.post('site', 'reservation', corps)).json.erreur, /\(saison du 1er mars au 30 novembre, fermé le lundi et le dimanche\)\.$/);
    // codes promo pas encore valables ou expirés
    await n.post('crm', 'promo', { code: 'NOVEMBRE', libelle: 'Novembre', type: 'montant', valeur: 2, debut: '2026-11-01' });
    await n.post('crm', 'promo', { code: 'RENTREE', libelle: 'Rentrée', type: 'montant', valeur: 2, fin: '2026-10-01' });
    const panier = { lignes: [ligne('pac-citron', '1000', 3)] };
    assert.match((await n.post('site', 'code-promo', { code: 'NOVEMBRE', ...panier })).json.erreur, /^Ce code promo n’est valable qu’à partir du 1er novembre\.$/);
    assert.match((await n.post('site', 'code-promo', { code: 'RENTREE', ...panier })).json.erreur, /^Ce code promo a expiré le 1er octobre\.$/);
    // jeu de démonstration : aucune date ISO dans le journal
    for (const x of (await docDe(n)).journal) sansIso(`${x.cible?.libelle || ''} ${x.details || ''}`);
  });
});
