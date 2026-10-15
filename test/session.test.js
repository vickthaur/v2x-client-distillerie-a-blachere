// api/session : démo, connexions, sessions indépendantes, partage, remise à zéro, mots de passe.
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { environnementNeuf, MAINTENANT, MOT_DE_PASSE, Navigateur } from './aide.js';
import { fixerHorloge } from '../server/temps.js';

beforeEach(() => environnementNeuf());

describe('démo et profils', () => {
  test('sans démo : moi rend { utilisateur: null, demo.active: false } sans rien créer', async () => {
    const n = new Navigateur();
    const r = await n.get('session', 'moi', { espace: 'crm' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { utilisateur: null, demo: { active: false } });
    assert.equal(n.cookies.size, 0);
  });

  test('entrer en démo par chaque profil, sans toucher à l’autre session', async () => {
    const n = new Navigateur();
    for (const [profil, redirection] of [
      ['direction', '/crm'],
      ['commercial', '/crm'],
      ['logistique', '/crm'],
      ['boutique', '/crm'],
      ['pro', '/espace-pro/accueil'],
    ]) {
      const r = await n.post('session', 'demo', { profil });
      assert.equal(r.status, 200, profil);
      assert.equal(r.json.redirection, redirection);
      assert.equal(r.json.utilisateur.role, profil);
      assert.equal(r.json.utilisateur.hash, undefined);
    }
    assert.ok(n.cookies.has('bl_demo') && n.cookies.has('bl_crm') && n.cookies.has('bl_pro'));
    assert.equal(n.cookies.get('bl_demo_actif'), '1');
    const crm = await n.get('session', 'moi', { espace: 'crm' });
    const pro = await n.get('session', 'moi', { espace: 'pro' });
    assert.equal(crm.json.utilisateur.role, 'boutique');
    assert.ok(crm.json.utilisateur.droits.includes('visites') && crm.json.utilisateur.droits.includes('produits:lecture'));
    assert.ok(!crm.json.utilisateur.droits.some((d) => d.startsWith('comptes')));
    assert.equal(pro.json.utilisateur.email, 'julien@cafe-des-platanes.example');
    assert.equal(pro.json.compte.enseigne, 'Café des Platanes');
    assert.equal(pro.json.utilisateur.droits, undefined);
    assert.equal(crm.json.demo.active, true);
  });

  test('cookies : HttpOnly; SameSite=Lax; Path=/, Secure en HTTPS seulement, bl_demo_actif lisible', async () => {
    const http = new Navigateur();
    const r = await http.post('session', 'demo', { profil: 'direction' });
    const demo = r.setCookies.find((c) => c.startsWith('bl_demo='));
    assert.match(demo, /HttpOnly/);
    assert.match(demo, /SameSite=Lax/);
    assert.match(demo, /Path=\//);
    assert.match(demo, /Max-Age=2592000/);
    assert.doesNotMatch(demo, /Secure/);
    assert.doesNotMatch(r.setCookies.find((c) => c.startsWith('bl_demo_actif=')), /HttpOnly/);
    assert.match(r.setCookies.find((c) => c.startsWith('bl_crm=')), /Max-Age=43200/);
    const https = new Navigateur({ https: true, hote: 'maquette.example' });
    const r2 = await https.post('session', 'demo', { profil: 'pro' });
    for (const c of r2.setCookies) assert.match(c, /; Secure/);
    // pro en démo : « rester connecté » (30 jours)
    assert.match(r2.setCookies.find((c) => c.startsWith('bl_pro=')), /Max-Age=2592000/);
  });
});

describe('connexion', () => {
  test('sans démo : identifiants de démonstration → démo créée ; autres → 401 sans démo', async () => {
    const a = new Navigateur();
    const ko = await a.post('session', 'connexion', { email: 'inconnu@example.com', motDePasse: 'nimportequoi', espace: 'crm' });
    assert.equal(ko.status, 401);
    assert.equal(a.cookies.size, 0);
    const ok = await a.post('session', 'connexion', { email: 'commercial@blachere.example', motDePasse: MOT_DE_PASSE, espace: 'crm' });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.utilisateur.role, 'commercial');
    assert.ok(a.cookies.has('bl_demo') && a.cookies.has('bl_crm'));
  });

  test('mauvais espace : message qui oriente', async () => {
    const n = new Navigateur();
    await n.entrer('direction');
    const r1 = await n.post('session', 'connexion', { email: 'julien@cafe-des-platanes.example', motDePasse: MOT_DE_PASSE, espace: 'crm' });
    assert.equal(r1.status, 403);
    assert.equal(r1.json.code, 'mauvais-espace');
    assert.equal(r1.json.redirection, '/espace-pro');
    const r2 = await n.post('session', 'connexion', { email: 'direction@blachere.example', motDePasse: MOT_DE_PASSE, espace: 'pro' });
    assert.equal(r2.json.redirection, '/crm');
    const r3 = await n.post('session', 'connexion', { email: 'julien@cafe-des-platanes.example', motDePasse: MOT_DE_PASSE, espace: 'pro', resterConnecte: true });
    assert.equal(r3.status, 200);
    assert.equal(r3.json.redirection, '/espace-pro/accueil');
  });

  test('mauvais mot de passe : 401 générique ; e-mail inconnu : même réponse', async () => {
    const n = new Navigateur();
    await n.entrer('direction');
    const a = await n.post('session', 'connexion', { email: 'direction@blachere.example', motDePasse: 'Mauvais1234', espace: 'crm' });
    const b = await n.post('session', 'connexion', { email: 'personne@blachere.example', motDePasse: 'Mauvais1234', espace: 'crm' });
    assert.equal(a.status, 401);
    assert.deepEqual(a.json, b.json);
  });

  test('déconnexion d’un espace ; déconnexion de tous les appareils', async () => {
    const pc = new Navigateur();
    await pc.entrer('direction');
    await pc.entrer('pro');
    const tel = new Navigateur();
    tel.cookies = new Map(pc.cookies);
    assert.equal((await pc.post('session', 'deconnexion', { espace: 'pro' })).json.ok, true);
    assert.equal((await pc.get('session', 'moi', { espace: 'pro' })).json.utilisateur, null);
    assert.ok((await pc.get('session', 'moi', { espace: 'crm' })).json.utilisateur);
    // le téléphone garde sa session pro (simple déconnexion de l'ordinateur)
    assert.ok((await tel.get('session', 'moi', { espace: 'pro' })).json.utilisateur);
    await pc.post('session', 'deconnexion', { espace: 'crm', partout: true });
    assert.equal((await tel.get('session', 'moi', { espace: 'crm' })).json.utilisateur, null);
  });
});

describe('partage, remise à zéro, sortie', () => {
  test('lien de partage → même démo sur un autre appareil', async () => {
    const pc = new Navigateur();
    await pc.entrer('direction');
    const p = await pc.post('session', 'partager', {});
    assert.equal(p.status, 200);
    assert.match(p.json.lien, /^http:\/\/localhost:5181\/api\/session\?r=rejoindre&jeton=.+&vers=crm$/);
    assert.equal(p.json.expireLe, '2026-10-22T08:30:00Z');
    const tel = new Navigateur({ ip: '198.51.100.7' });
    const url = new URL(p.json.lien);
    const r = await tel.get('session', 'rejoindre', { jeton: url.searchParams.get('jeton'), vers: 'crm' });
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('location'), '/crm');
    assert.ok(tel.cookies.has('bl_demo') && tel.cookies.get('bl_demo_actif') === '1');
    const moi = await tel.get('session', 'moi', { espace: 'crm' });
    assert.equal(moi.json.utilisateur, null);
    assert.equal(moi.json.demo.active, true);
    const u = await tel.entrer('logistique');
    const vu = await pc.get('session', 'moi', { espace: 'crm' });
    assert.equal(vu.json.demo.creeLe, moi.json.demo.creeLe);
    assert.equal(u.role, 'logistique');
    // jeton falsifié ou expiré : retour à l'écran de connexion
    const faux = await new Navigateur().get('session', 'rejoindre', { jeton: 'abc.def', vers: 'pro' });
    assert.equal(faux.headers.get('location'), '/espace-pro?demo=lien-invalide');
    fixerHorloge('2026-10-23T08:30:00Z');
    const tard = await new Navigateur().get('session', 'rejoindre', { jeton: url.searchParams.get('jeton') });
    assert.equal(tard.headers.get('location'), '/crm?demo=lien-invalide');
  });

  test('partager sans session : 401', async () => {
    const n = new Navigateur();
    assert.equal((await n.post('session', 'partager', {})).status, 401);
  });

  test('réinitialiser : jeu remis à zéro, session gardée', async () => {
    const n = new Navigateur();
    await n.entrer('commercial');
    await n.entrer('pro');
    const avant = (await n.post('site', 'contact', { nom: 'Zoé Essai', email: 'zoe@example.net', sujet: 'autre', message: 'Bonjour, une question.', rgpd: true })).json;
    assert.ok(avant.reference);
    fixerHorloge('2026-10-15T15:00:00Z');
    const r = await n.post('session', 'reinitialiser', {});
    assert.equal(r.status, 200);
    const crm = await n.get('session', 'moi', { espace: 'crm' });
    const pro = await n.get('session', 'moi', { espace: 'pro' });
    assert.equal(crm.json.utilisateur.email, 'commercial@blachere.example');
    assert.equal(pro.json.utilisateur.email, 'julien@cafe-des-platanes.example');
    assert.equal(crm.json.demo.creeLe, '2026-10-15T15:00:00Z');
    // le message envoyé avant la remise à zéro n'existe plus
    const apres = (await n.post('site', 'contact', { nom: 'Zoé Essai', email: 'zoe@example.net', sujet: 'autre', message: 'Une autre question.', rgpd: true })).json;
    assert.equal(apres.reference, avant.reference);
  });

  test('quitter : cookies de démo et des deux sessions effacés', async () => {
    const n = new Navigateur();
    await n.entrer('direction');
    await n.entrer('pro');
    const r = await n.post('session', 'quitter', {});
    assert.equal(r.status, 200);
    assert.equal(n.cookies.size, 0);
    assert.equal(r.setCookies.length, 4);
  });

  test('démo effacée (ménage) : cookie traité comme absent et effacé', async () => {
    const n = new Navigateur();
    await n.entrer('direction');
    environnementNeuf(MAINTENANT); // nouveau magasin vide : la démo n'existe plus
    const r = await n.get('session', 'moi', { espace: 'crm' });
    assert.deepEqual(r.json, { utilisateur: null, demo: { active: false } });
    assert.equal(n.cookies.size, 0);
  });
});

describe('mots de passe', () => {
  test('oubli → lien (démo) → nouveau mot de passe, à usage unique', async () => {
    const n = new Navigateur();
    await n.entrer('direction');
    const o = await n.post('session', 'oubli', { email: 'julien@cafe-des-platanes.example', espace: 'pro' });
    assert.equal(o.json.ok, true);
    assert.match(o.json.lienDemo, /^\/espace-pro\/mot-de-passe\?jeton=[\w-]{43}$/);
    const inconnu = await n.post('session', 'oubli', { email: 'personne@example.com', espace: 'pro' });
    assert.deepEqual(inconnu.json, { ok: true });
    const jeton = new URL(o.json.lienDemo, 'http://x').searchParams.get('jeton');
    const court = await n.post('session', 'reinitialiser-mot-de-passe', { jeton, motDePasse: 'court' });
    assert.equal(court.status, 400);
    const r = await n.post('session', 'reinitialiser-mot-de-passe', { jeton, motDePasse: 'Platanes-2026!' });
    assert.equal(r.status, 200);
    assert.equal(r.json.redirection, '/espace-pro/accueil');
    assert.equal((await n.get('session', 'moi', { espace: 'pro' })).json.utilisateur.email, 'julien@cafe-des-platanes.example');
    const deux = await n.post('session', 'reinitialiser-mot-de-passe', { jeton, motDePasse: 'Autre-mot-2026' });
    assert.equal(deux.status, 404);
    const ancien = await n.post('session', 'connexion', { email: 'julien@cafe-des-platanes.example', motDePasse: MOT_DE_PASSE, espace: 'pro' });
    assert.equal(ancien.status, 401);
    const nouveau = await n.post('session', 'connexion', { email: 'julien@cafe-des-platanes.example', motDePasse: 'Platanes-2026!', espace: 'pro' });
    assert.equal(nouveau.status, 200);
  });

  test('lien de réinitialisation expiré au bout d’une heure', async () => {
    const n = new Navigateur();
    await n.entrer('direction');
    const o = await n.post('session', 'oubli', { email: 'boutique@blachere.example', espace: 'crm' });
    assert.match(o.json.lienDemo, /^\/crm\/mot-de-passe\?jeton=/);
    fixerHorloge('2026-10-15T09:31:00Z');
    const r = await n.post('session', 'reinitialiser-mot-de-passe', { jeton: new URL(o.json.lienDemo, 'http://x').searchParams.get('jeton'), motDePasse: 'Boutique-2026!' });
    assert.equal(r.status, 404);
  });

  test('changer son mot de passe : les autres appareils sont déconnectés, celui-ci reste connecté', async () => {
    const pc = new Navigateur();
    await pc.entrer('boutique');
    const tel = new Navigateur();
    tel.cookies = new Map(pc.cookies);
    const faux = await pc.post('session', 'mot-de-passe', { espace: 'crm', actuel: 'pas-le-bon-1', nouveau: 'Boutique-2026!' });
    assert.equal(faux.status, 401);
    assert.equal(faux.json.champ, 'actuel');
    const r = await pc.post('session', 'mot-de-passe', { espace: 'crm', actuel: MOT_DE_PASSE, nouveau: 'Boutique-2026!' });
    assert.equal(r.status, 200);
    assert.ok((await pc.get('session', 'moi', { espace: 'crm' })).json.utilisateur);
    assert.equal((await tel.get('session', 'moi', { espace: 'crm' })).json.utilisateur, null);
  });

  test('invitation inconnue : 404', async () => {
    const n = new Navigateur();
    await n.entrer('direction');
    assert.equal((await n.get('session', 'invitation', { jeton: 'x'.repeat(43) })).status, 404);
    assert.equal((await n.post('session', 'activer', { jeton: 'x'.repeat(43), motDePasse: 'Bienvenue-2026' })).status, 404);
  });
});
