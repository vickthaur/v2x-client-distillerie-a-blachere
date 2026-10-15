// Pilote Vercel Blob à travers le vrai SDK (@vercel/blob 2.8.2) contre une fausse API Blob locale :
// options envoyées (privé, sans suffixe, écrasement, ifMatch, type JSON), lecture sans cache, ETag,
// conflit (412 → ConflitStockage), création seule, liste paginée avec ETag, suppression simple ou
// conditionnelle (ménage) ; mutation atomique.
// Comme en production, la lecture du contenu (réseau de diffusion) rend un ETag différent de celui de
// l'API : seul l'ETag de head (API) est accepté par ifMatch. Le pilote doit donc prendre celui-là.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { after, before, describe, test } from 'node:test';
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from 'undici';
import './aide.js';
import { cheminDemo, creerBacs } from '../server/demo.js';
import { ConflitStockage, piloteBlob } from '../server/store.js';

const MAGASIN = 'testmagasin';
const blobs = new Map(); // pathname → { contenu, etag, majLe }
const requetes = [];
let serveur;
let base;
const dispatcherOrigine = getGlobalDispatcher();

const json = (res, status, corps) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(corps));
};
const urlBlob = (p) => `https://${MAGASIN}.private.blob.vercel-storage.com/${p}`;
// ETag rendu par le réseau de diffusion à la lecture : pas celui de l'API (vu en production)
const etagDiffusion = (etag) => `W/${etag.replace(/"$/, '-cdn"')}`;

before(async () => {
  serveur = createServer(async (req, res) => {
    const morceaux = [];
    for await (const m of req) morceaux.push(m);
    const corps = Buffer.concat(morceaux).toString('utf8');
    const url = new URL(req.url, 'http://local');
    requetes.push({ methode: req.method, url: url.pathname + url.search, entetes: req.headers });
    if (req.headers.authorization !== `Bearer vercel_blob_rw_${MAGASIN}_secret`) return json(res, 403, { error: { code: 'forbidden' } });
    // écriture (put)
    if (req.method === 'PUT' && url.pathname === '/') {
      const p = url.searchParams.get('pathname');
      const actuel = blobs.get(p);
      if (req.headers['x-if-match'] && (!actuel || actuel.etag !== req.headers['x-if-match'])) return json(res, 412, { error: { code: 'precondition_failed', message: 'Precondition failed' } });
      if (actuel && req.headers['x-allow-overwrite'] !== '1') return json(res, 400, { error: { code: 'bad_request', message: 'This blob already exists, use `allowOverwrite: true` if you want to overwrite it.' } });
      const etag = `"${createHash('md5').update(corps).digest('hex')}"`;
      blobs.set(p, { contenu: corps, etag, majLe: new Date() });
      return json(res, 200, { url: urlBlob(p), downloadUrl: `${urlBlob(p)}?download=1`, pathname: p, contentType: req.headers['x-content-type'], contentDisposition: 'inline', etag });
    }
    // métadonnées (head : GET /?url=…)
    if (req.method === 'GET' && url.pathname === '/' && url.searchParams.has('url')) {
      const u = url.searchParams.get('url');
      const p = u.startsWith('http') ? new URL(u).pathname.slice(1) : u;
      const b = blobs.get(p);
      if (!b) return json(res, 404, { error: { code: 'not_found', message: 'The requested blob does not exist' } });
      return json(res, 200, { url: urlBlob(p), downloadUrl: `${urlBlob(p)}?download=1`, pathname: p, size: Buffer.byteLength(b.contenu), uploadedAt: b.majLe.toISOString(), contentType: 'application/json', contentDisposition: 'inline', cacheControl: 'public, max-age=0', etag: b.etag });
    }
    // liste paginée (2 par page)
    if (req.method === 'GET' && url.pathname === '/') {
      const prefixe = url.searchParams.get('prefix') || '';
      const tous = [...blobs.keys()].filter((p) => p.startsWith(prefixe)).sort();
      const debut = Number(url.searchParams.get('cursor') || 0);
      const page = tous.slice(debut, debut + 2);
      return json(res, 200, {
        blobs: page.map((p) => ({ url: urlBlob(p), downloadUrl: urlBlob(p), pathname: p, size: blobs.get(p).contenu.length, uploadedAt: blobs.get(p).majLe.toISOString(), etag: blobs.get(p).etag })),
        cursor: debut + 2 < tous.length ? String(debut + 2) : undefined,
        hasMore: debut + 2 < tous.length,
      });
    }
    if (req.method === 'POST' && url.pathname === '/delete') {
      const chemins = JSON.parse(corps).urls.map((u) => (u.startsWith('http') ? new URL(u).pathname.slice(1) : u));
      const si = req.headers['x-if-match'];
      if (si && chemins.some((p) => blobs.get(p)?.etag !== si)) return json(res, 412, { error: { code: 'precondition_failed', message: 'Precondition failed' } });
      for (const p of chemins) blobs.delete(p);
      return json(res, 200, {});
    }
    return json(res, 404, { error: { code: 'not_found' } });
  });
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${serveur.address().port}`;
  process.env.BLOB_READ_WRITE_TOKEN = `vercel_blob_rw_${MAGASIN}_secret`;
  process.env.VERCEL_BLOB_API_URL = base;
  process.env.VERCEL_BLOB_RETRIES = '0';
  // get() lit https://<magasin>.private.blob.vercel-storage.com/<chemin> (fetch d'undici) :
  // intercepté ; les appels à l'API (put, list, del) vont au faux serveur local.
  const agent = new MockAgent();
  agent.enableNetConnect(/^127\.0\.0\.1/);
  agent
    .get(`https://${MAGASIN}.private.blob.vercel-storage.com`)
    .intercept({ path: () => true, method: 'GET' })
    .reply((opts) => {
      const u = new URL(opts.path, 'https://x');
      requetes.push({ methode: 'GET', url: opts.path, magasin: true, autorisation: opts.headers.authorization || opts.headers.Authorization });
      const b = blobs.get(decodeURIComponent(u.pathname.slice(1)));
      if (!b) return { statusCode: 404, data: '' };
      return { statusCode: 200, data: b.contenu, responseOptions: { headers: { 'content-type': 'application/json', etag: etagDiffusion(b.etag), 'content-length': String(Buffer.byteLength(b.contenu)), 'last-modified': b.majLe.toUTCString() } } };
    })
    .persist();
  setGlobalDispatcher(agent);
});

after(async () => {
  setGlobalDispatcher(dispatcherOrigine);
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.VERCEL_BLOB_API_URL;
  delete process.env.VERCEL_BLOB_RETRIES;
  await new Promise((r) => serveur.close(r));
});

describe('pilote Vercel Blob (SDK réel, fausse API)', () => {
  test('création seule, lecture sans cache, écriture conditionnelle, conflit, liste, suppression', async () => {
    const p = piloteBlob();
    const ch = 'demos/abcdefghijklmnop.json';
    assert.equal(await p.lire(ch), null);
    const { etag: e1 } = await p.ecrire(ch, '{"n":1}', { creation: true });
    const put = requetes.filter((r) => r.methode === 'PUT').at(-1);
    assert.equal(put.url, `/?pathname=${encodeURIComponent(ch)}`);
    assert.equal(put.entetes['x-vercel-blob-access'], 'private');
    assert.equal(put.entetes['x-add-random-suffix'], '0');
    assert.equal(put.entetes['x-allow-overwrite'], '0');
    assert.equal(put.entetes['x-content-type'], 'application/json');
    await assert.rejects(p.ecrire(ch, '{"n":1}', { creation: true }), ConflitStockage);
    const lu = await p.lire(ch);
    assert.deepEqual(lu, { contenu: '{"n":1}', etag: e1 }, "l'ETag lu est celui de l'API (head), pas celui de la diffusion");
    const iHead = requetes.findLastIndex((r) => r.methode === 'GET' && !r.magasin && /[?&]url=/.test(r.url));
    const iGet = requetes.findLastIndex((r) => r.magasin);
    assert.ok(iHead >= 0 && iHead < iGet, 'head (API) avant la lecture du contenu');
    const lecture = requetes.filter((r) => r.magasin).at(-1);
    assert.match(lecture.url, /[?&]cache=0/, 'lecture sans cache (useCache: false)');
    assert.equal(lecture.autorisation, `Bearer vercel_blob_rw_${MAGASIN}_secret`, 'magasin privé : lecture authentifiée');
    await assert.rejects(p.ecrire(ch, '{"n":2}', { ifMatch: '"perime"' }), ConflitStockage);
    const { etag: e2 } = await p.ecrire(ch, '{"n":2}', { ifMatch: e1 });
    const put2 = requetes.filter((r) => r.methode === 'PUT').at(-1);
    assert.equal(put2.entetes['x-if-match'], e1);
    assert.equal(put2.entetes['x-allow-overwrite'], '1');
    assert.notEqual(e2, e1);
    for (const id of ['bbbbbbbbbbbbbbbb', 'cccccccccccccccc', 'dddddddddddddddd']) await p.ecrire(`demos/${id}.json`, '{}', { creation: true });
    const vus = [];
    for await (const b of p.lister('demos/')) vus.push(b);
    assert.equal(vus.length, 4, 'pages suivies (curseur)');
    assert.equal(vus.find((b) => b.chemin === ch).etag, e2, 'ETag donné par la liste');
    // suppression conditionnelle (ménage) : 412 → ConflitStockage, document gardé
    await assert.rejects(p.supprimer(ch, { ifMatch: e1 }), ConflitStockage);
    assert.ok(await p.lire(ch));
    await p.supprimer(ch, { ifMatch: e2 });
    assert.equal(requetes.filter((r) => r.url === '/delete').at(-1).entetes['x-if-match'], e2);
    assert.equal(await p.lire(ch), null);
    await p.supprimer('demos/bbbbbbbbbbbbbbbb.json');
    assert.equal(requetes.filter((r) => r.url === '/delete').at(-1).entetes['x-if-match'], undefined);
    assert.equal(await p.lire('demos/bbbbbbbbbbbbbbbb.json'), null);
  });

  test("ETag de la diffusion refusé par ifMatch : la mutation passe avec celui de l'API", async () => {
    const p = piloteBlob();
    const ch = 'demos/ffffffffffffffff.json';
    const { etag } = await p.ecrire(ch, '{"n":1}', { creation: true });
    await assert.rejects(p.ecrire(ch, '{"n":2}', { ifMatch: etagDiffusion(etag) }), ConflitStockage, "la fausse API refuse l'ETag de diffusion, comme en production");
    const bacs = creerBacs(p);
    const id = 'gggggggggggggggg';
    await bacs.creer({ v: 1, id, createdAt: '2026-10-15T08:30:00Z', updatedAt: '2026-10-15T08:30:00Z', compteur: 0, journal: [], courriels: [], mouvements: [] });
    const r = await bacs.muter(id, (doc) => (doc.compteur += 1));
    assert.equal(r.resultat, 1);
    assert.equal((await bacs.lire(id)).doc.compteur, 1);
  });

  test('mutations simultanées : aucune mise à jour perdue', async () => {
    const bacs = creerBacs(piloteBlob());
    const id = 'eeeeeeeeeeeeeeee';
    await bacs.creer({ v: 1, id, createdAt: '2026-10-15T08:30:00Z', updatedAt: '2026-10-15T08:30:00Z', compteur: 0, journal: [], courriels: [], mouvements: [] });
    await Promise.all(Array.from({ length: 8 }, () => bacs.muter(id, (doc) => void (doc.compteur += 1))));
    assert.equal((await bacs.lire(id)).doc.compteur, 8);
    // une autre instance écrit entre-temps : nouvel essai sur le document frais
    const autre = creerBacs(piloteBlob());
    const lu = await bacs.lire(id);
    await autre.muter(id, (doc) => void (doc.compteur += 10));
    const r = await bacs.muter(id, (doc) => (doc.compteur += 1), { initial: lu });
    assert.equal(r.resultat, 19);
    assert.ok(requetes.some((x) => x.methode === 'PUT' && x.entetes['x-if-match']));
    assert.ok(blobs.has(cheminDemo(id)));
  });
});
