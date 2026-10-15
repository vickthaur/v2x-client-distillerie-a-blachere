// Accès privé de la maquette (server/portail.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decider, jetonAcces, COOKIE, SLUG } from '../server/portail.js';

const SECRET = 'secret-de-test-0123456789abcdefghijklmnop';
const BASE = 'https://v2x-client-distillerie-a-blachere.vercel.app';
const html = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

function cookieDe(d) {
  assert.equal(d.type, 'passer');
  assert.ok(d.cookie, 'un cookie est posé');
  return d.cookie.split(';')[0];
}

test('sans jeton ni cookie : page privée neutre, 401, sans le nom de l’entreprise', () => {
  for (const chemin of ['/', '/boutique', '/boutique/pac-citron', '/crm', '/espace-pro/accueil', '/bouteilles/pac-citron.webp', '/assets/site.js']) {
    const d = decider({ url: BASE + chemin, accept: html, secret: SECRET });
    assert.equal(d.type, 'reponse', chemin);
    assert.equal(d.status, 401, chemin);
    assert.equal(d.headers['X-V2X-Maquette'], 'privee');
    assert.match(d.headers['X-Robots-Tag'], /noindex/);
    assert.equal(d.headers['Cache-Control'], 'no-store');
    assert.match(d.body, /Maquette privée/);
    assert.doesNotMatch(d.body, /Blach|\bPAC\b|pac-citron|distillerie/i);
  }
});

test('API sans accès : JSON 401', () => {
  const d = decider({ url: `${BASE}/api/site?r=catalogue`, accept: '*/*', secret: SECRET });
  assert.equal(d.status, 401);
  assert.match(d.headers['Content-Type'], /json/);
  assert.deepEqual(JSON.parse(d.body), { erreur: 'Accès réservé.' });
});

test('bon jeton : la page passe et le cookie est posé (HttpOnly, Secure, 180 jours)', () => {
  const jeton = jetonAcces(SECRET);
  assert.equal(jeton.length, 22);
  const d = decider({ url: `${BASE}/?acces=${jeton}&src=email`, accept: html, secret: SECRET });
  assert.equal(d.type, 'passer');
  assert.match(d.cookie, new RegExp(`^${COOKIE}=v1\\.`));
  assert.match(d.cookie, /HttpOnly/);
  assert.match(d.cookie, /Secure/);
  assert.match(d.cookie, /SameSite=Lax/);
  assert.match(d.cookie, /Max-Age=15552000/);
});

test('avec le cookie : tout passe sans jeton (pages, images, API)', () => {
  const c = cookieDe(decider({ url: `${BASE}/?acces=${jetonAcces(SECRET)}`, secret: SECRET }));
  for (const chemin of ['/', '/boutique/pac-citron', '/bouteilles/pac-citron.webp', '/api/site?r=catalogue', '/crm/tableau']) {
    const d = decider({ url: BASE + chemin, cookie: `autre=1; ${c}; bl_demo=x`, accept: html, secret: SECRET });
    assert.deepEqual(d, { type: 'passer' }, chemin);
  }
});

test('mauvais jeton, jeton d’une autre maquette, cookie falsifié ou d’un autre secret : refusés', () => {
  const autres = [
    { url: `${BASE}/?acces=` },
    { url: `${BASE}/?acces=${jetonAcces(SECRET).slice(0, 21)}x` },
    { url: `${BASE}/?acces=${jetonAcces(SECRET, 'moulin-de-l-aqueduc')}` },
    { url: `${BASE}/?acces=${jetonAcces('un-autre-secret-0123456789abcdefghij')}` },
    { url: `${BASE}/`, cookie: `${COOKIE}=v1.faux` },
    { url: `${BASE}/`, cookie: cookieDe(decider({ url: `${BASE}/?acces=${jetonAcces('un-autre-secret-0123456789abcdefghij')}`, secret: 'un-autre-secret-0123456789abcdefghij' })) },
    { url: `${BASE}/`, cookie: cookieDe(decider({ url: `${BASE}/?acces=${jetonAcces(SECRET, 'le-mesclun')}`, secret: SECRET, slug: 'le-mesclun' })) },
  ];
  for (const r of autres) {
    const d = decider({ ...r, accept: html, secret: SECRET });
    assert.equal(d.type, 'reponse', JSON.stringify(r));
    assert.equal(d.status, 401);
  }
});

test('publics : robots.txt et image d’aperçu ; /api/menage garde sa propre protection', () => {
  for (const chemin of ['/robots.txt', '/og-v4.jpg', '/api/menage']) {
    assert.deepEqual(decider({ url: BASE + chemin, secret: SECRET }), { type: 'passer' }, chemin);
  }
  // pas d'échappée par un chemin voisin
  for (const chemin of ['/og-v4.jpg.html', '/api/menage/x', '/api/menage2', '/robots.txt/x']) {
    assert.equal(decider({ url: BASE + chemin, accept: html, secret: SECRET }).status, 401, chemin);
  }
});

test('sans secret configuré : tout est refusé (jamais ouvert par erreur)', () => {
  assert.equal(decider({ url: `${BASE}/?acces=n-importe-quoi`, accept: html, secret: '' }).status, 401);
  assert.equal(decider({ url: `${BASE}/`, accept: html }).status, 401);
});

test('maquette retirée : 410 pour tout le monde, même avec le jeton ou le cookie', () => {
  const c = cookieDe(decider({ url: `${BASE}/?acces=${jetonAcces(SECRET)}`, secret: SECRET }));
  for (const r of [{ url: `${BASE}/` }, { url: `${BASE}/?acces=${jetonAcces(SECRET)}` }, { url: `${BASE}/boutique`, cookie: c }, { url: `${BASE}/og-v4.jpg` }]) {
    const d = decider({ ...r, accept: html, secret: SECRET, retiree: true });
    assert.equal(d.status, 410, r.url);
    assert.match(d.body, /retirée/);
  }
  assert.deepEqual(decider({ url: `${BASE}/robots.txt`, secret: SECRET, retiree: true }), { type: 'passer' });
});

test('le jeton dépend du nom de la maquette', () => {
  assert.equal(SLUG, 'distillerie-a-blachere');
  assert.notEqual(jetonAcces(SECRET, 'distillerie-a-blachere'), jetonAcces(SECRET, 'le-mesclun'));
  assert.match(jetonAcces(SECRET), /^[A-Za-z0-9_-]{22}$/);
});
