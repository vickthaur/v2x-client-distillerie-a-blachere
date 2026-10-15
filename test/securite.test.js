// Sécurité (docs/crm-espace-pro.md, § 6) : signatures, falsification, CSRF, origine, taille,
// verrouillage, limiteurs, secret obligatoire sur Vercel, en-têtes, erreurs sans donnée personnelle.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { environnementNeuf, MOT_DE_PASSE, Navigateur } from './aide.js';
import { signer, USAGES, verifier } from '../server/auth.js';
import { fixerHorloge } from '../server/temps.js';

beforeEach(() => environnementNeuf());
afterEach(() => {
  delete process.env.VERCEL;
  delete process.env.SESSION_SECRET;
});

const charge = (jeton) => JSON.parse(Buffer.from(jeton.split('.')[0], 'base64url').toString());

describe('jetons signés', () => {
  test('clé dérivée par usage : un jeton n’est valable que pour son usage', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const j = signer(USAGES.crm, { sb: 'abcdefghijklmnop', uid: 'usr_x', v: 0, exp });
    assert.ok(verifier(USAGES.crm, j));
    for (const autre of [USAGES.pro, USAGES.demo, USAGES.partage]) assert.equal(verifier(autre, j), null);
  });
  test('falsification, expiration, formes invalides', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const j = signer(USAGES.demo, { sb: 'abcdefghijklmnop', exp });
    const [corps, sig] = j.split('.');
    const autreCorps = Buffer.from(JSON.stringify({ sb: 'bbbbbbbbbbbbbbbb', exp })).toString('base64url');
    assert.equal(verifier(USAGES.demo, `${autreCorps}.${sig}`), null);
    assert.equal(verifier(USAGES.demo, `${corps}.${sig.slice(0, -2)}AA`), null);
    assert.equal(verifier(USAGES.demo, signer(USAGES.demo, { sb: 'x', exp: Math.floor(Date.now() / 1000) - 1 })), null);
    for (const x of [undefined, '', 'a', 'a.b.c', `${corps}.`, '.'.repeat(2000)]) assert.equal(verifier(USAGES.demo, x), null);
  });
  test('SESSION_SECRET change la signature', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const j = signer(USAGES.crm, { exp });
    process.env.SESSION_SECRET = 'un-secret-de-production-tres-long-0123456789';
    assert.equal(verifier(USAGES.crm, j), null);
    assert.ok(verifier(USAGES.crm, signer(USAGES.crm, { exp })));
  });
});

describe('cookies de session', () => {
  test('cookie bl_crm falsifié ou expiré : rejeté et effacé', async () => {
    const n = new Navigateur();
    await n.entrer('direction');
    const vrai = n.cookies.get('bl_crm');
    const c = charge(decodeURIComponent(vrai));
    // élévation : même charge, autre utilisateur, sans la clé
    const faux = `${Buffer.from(JSON.stringify({ ...c, uid: 'usr_aaaaaaaaaaaa' })).toString('base64url')}.${decodeURIComponent(vrai).split('.')[1]}`;
    n.cookies.set('bl_crm', encodeURIComponent(faux));
    const r = await n.get('session', 'moi', { espace: 'crm' });
    assert.equal(r.json.utilisateur, null);
    assert.ok(r.setCookies.some((s) => s.startsWith('bl_crm=;') && /Max-Age=0/.test(s)));
    n.cookies.set('bl_crm', vrai);
    assert.ok((await n.get('session', 'moi', { espace: 'crm' })).json.utilisateur);
    fixerHorloge('2026-10-15T20:31:00Z'); // 12 h plus tard
    assert.equal((await n.get('session', 'moi', { espace: 'crm' })).json.utilisateur, null);
  });

  test('un bl_pro présenté comme bl_crm n’ouvre rien', async () => {
    const n = new Navigateur();
    await n.entrer('pro');
    n.cookies.set('bl_crm', n.cookies.get('bl_pro'));
    assert.equal((await n.get('session', 'moi', { espace: 'crm' })).json.utilisateur, null);
  });

  test('une session ne vaut que dans sa démo', async () => {
    const a = new Navigateur({ ip: '203.0.113.1' });
    const b = new Navigateur({ ip: '203.0.113.2' });
    await a.entrer('direction');
    await b.entrer('direction');
    // la session de A avec la démo de B
    b.cookies.set('bl_crm', a.cookies.get('bl_crm'));
    assert.equal((await b.get('session', 'moi', { espace: 'crm' })).json.utilisateur, null);
  });

  test('bl_demo falsifié : traité comme absent, aucun accès', async () => {
    const n = new Navigateur();
    await n.entrer('direction');
    n.cookies.set('bl_demo', `${n.cookies.get('bl_demo')}x`);
    const r = await n.get('session', 'moi', { espace: 'crm' });
    assert.deepEqual(r.json, { utilisateur: null, demo: { active: false } });
    assert.equal(n.cookies.size, 0);
  });
});

describe('écritures : CSRF, origine, format, taille', () => {
  test('sans en-tête X-Blachere : 403', async () => {
    const n = new Navigateur();
    const r = await n.appel('session', 'POST', 'demo', { corps: { profil: 'direction' }, entetes: { 'content-type': 'application/json' }, sansCsrf: true });
    assert.equal(r.status, 403);
    assert.equal(r.json.code, 'csrf');
    assert.equal(n.cookies.size, 0);
  });
  test('formulaire classique (text/plain, x-www-form-urlencoded) : 415', async () => {
    const n = new Navigateur();
    for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x']) {
      const r = await n.appel('session', 'POST', 'demo', { brut: '{"profil":"direction"}', entetes: { 'content-type': type, 'x-blachere': '1' }, sansCsrf: true });
      assert.equal(r.status, 415, type);
    }
  });
  test('Origin d’un autre site : 403 ; même hôte : accepté', async () => {
    const n = new Navigateur();
    const r = await n.post('session', 'demo', { profil: 'direction' }, { entetes: { origin: 'https://attaquant.example' } });
    assert.equal(r.status, 403);
    assert.equal(r.json.code, 'origine');
    assert.equal((await n.post('session', 'demo', { profil: 'direction' }, { entetes: { origin: 'null' } })).status, 403);
    assert.equal((await n.post('session', 'demo', { profil: 'direction' }, { entetes: { origin: 'http://localhost:5181' } })).status, 200);
  });
  test('corps de plus de 64 Ko : 413 ; JSON invalide : 400 ; tableau : 400', async () => {
    const n = new Navigateur();
    const gros = JSON.stringify({ profil: 'direction', bourrage: 'x'.repeat(70 * 1024) });
    assert.equal((await n.appel('session', 'POST', 'demo', { brut: gros })).status, 413);
    assert.equal((await n.appel('session', 'POST', 'demo', { brut: '{"profil":' })).status, 400);
    assert.equal((await n.appel('session', 'POST', 'demo', { brut: '[1,2]' })).status, 400);
  });
  test('champs inconnus ignorés, textes nettoyés', async () => {
    const n = new Navigateur();
    const r = await n.post('site', 'contact', { nom: '  Zoé\u0000\u0007   Essai ', email: 'ZOE@EXAMPLE.NET', sujet: 'autre', message: 'Bonjour\u0000,\n\n\n\nune question.', rgpd: true, admin: true, __proto__: { x: 1 } });
    assert.equal(r.status, 201);
  });
});

describe('verrouillage et limiteurs', () => {
  test('5 échecs → 423 pendant 15 minutes, même avec le bon mot de passe', async () => {
    const n = new Navigateur();
    await n.entrer('pro');
    const essai = (motDePasse) => n.post('session', 'connexion', { email: 'commercial@blachere.example', motDePasse, espace: 'crm' });
    for (let i = 1; i <= 4; i++) assert.equal((await essai(`mauvais-${i}-xxxx`)).status, 401);
    const cinquieme = await essai('mauvais-5-xxxx');
    assert.equal(cinquieme.status, 423);
    assert.equal(cinquieme.json.code, 'verrouille');
    assert.equal(cinquieme.headers.get('retry-after'), '900');
    assert.equal((await essai(MOT_DE_PASSE)).status, 423);
    fixerHorloge('2026-10-15T08:46:00Z');
    assert.equal((await essai(MOT_DE_PASSE)).status, 200);
  });

  test('limiteur par adresse IP sur les échecs de connexion : 429', async () => {
    const n = new Navigateur({ ip: '192.0.2.99' });
    await n.entrer('direction');
    let dernier;
    for (let i = 0; i < 31; i++) dernier = await n.post('session', 'connexion', { email: `personne${i}@example.com`, motDePasse: 'mauvais-mot-xx', espace: 'crm' });
    assert.equal(dernier.status, 429);
    assert.equal(dernier.json.code, 'limite');
    const autreIp = new Navigateur({ ip: '192.0.2.100' });
    assert.equal((await autreIp.post('session', 'connexion', { email: 'personne@example.com', motDePasse: 'mauvais-mot-xx', espace: 'crm' })).status, 401);
  });

  test('20 démos par heure et par adresse IP', async () => {
    for (let i = 0; i < 20; i++) assert.equal((await new Navigateur({ ip: '192.0.2.50' }).post('session', 'demo', { profil: 'pro' })).status, 200);
    const r = await new Navigateur({ ip: '192.0.2.50' }).post('session', 'demo', { profil: 'pro' });
    assert.equal(r.status, 429);
    assert.equal((await new Navigateur({ ip: '192.0.2.51' }).post('session', 'demo', { profil: 'pro' })).status, 200);
    fixerHorloge('2026-10-15T09:31:00Z');
    assert.equal((await new Navigateur({ ip: '192.0.2.50' }).post('session', 'demo', { profil: 'pro' })).status, 200);
  });

  test('les GET ne créent jamais de démo', async () => {
    const n = new Navigateur();
    for (const [f, r] of [['site', 'catalogue'], ['site', 'creneaux'], ['session', 'moi'], ['session', 'invitation']]) await n.get(f, r, { mois: '2026-10' });
    assert.equal(n.cookies.size, 0);
  });
});

describe('réponses', () => {
  test('JSON sans cache, nosniff ; méthodes et ressources inconnues', async () => {
    const n = new Navigateur();
    const r = await n.get('session', 'moi');
    assert.equal(r.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    for (const m of ['HEAD', 'PUT', 'OPTIONS']) {
      const x = await n.appel('session', m, 'moi', { sansCsrf: true });
      assert.equal(x.status, 405, m);
    }
    const d = await n.appel('session', 'DELETE', 'moi', {});
    assert.equal(d.status, 405);
    assert.equal(d.headers.get('allow'), 'GET');
    assert.equal((await n.get('session', 'inconnue')).status, 404);
  });

  test('sur Vercel sans SESSION_SECRET : l’API refuse de fonctionner (500 « configuration »)', async () => {
    process.env.VERCEL = '1';
    const n = new Navigateur();
    const r = await n.post('session', 'demo', { profil: 'direction' });
    assert.equal(r.status, 500);
    assert.equal(r.json.code, 'configuration');
    assert.match(r.json.reference, /^[0-9A-F]{10}$/);
    process.env.SESSION_SECRET = 'trop-court';
    assert.equal((await n.post('session', 'demo', { profil: 'direction' })).status, 500);
    process.env.SESSION_SECRET = 'un-secret-de-production-tres-long-0123456789';
    assert.equal((await n.post('session', 'demo', { profil: 'direction' })).status, 200);
  });

  test('erreur imprévue : 500 { erreur, reference }, rien de personnel dans les journaux', async () => {
    const { fonction } = await import('../server/http.js');
    const f = fonction({
      POST: {
        boum: (ctx) => {
          throw new Error(`échec pour ${ctx.corps.email}`);
        },
      },
    });
    const lignes = [];
    const avant = console.error;
    console.error = (...a) => lignes.push(a.join(' '));
    try {
      const res = await f.POST(new Request('http://localhost/api/x?r=boum', { method: 'POST', headers: { 'content-type': 'application/json', 'x-blachere': '1' }, body: JSON.stringify({ email: 'secret.personne@example.com' }) }));
      const json = await res.json();
      assert.equal(res.status, 500);
      assert.match(json.reference, /^[0-9A-F]{10}$/);
      assert.doesNotMatch(JSON.stringify(json), /secret\.personne/);
    } finally {
      console.error = avant;
    }
    assert.equal(lignes.length, 1);
    assert.doesNotMatch(lignes[0], /secret\.personne/);
  });
});
