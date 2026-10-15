// Stockage : sémantique d'ETag des pilotes mémoire et fs, mutation atomique (relecture et reprise,
// 409 après trois essais), pas de mise à jour perdue sous concurrence.
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import './aide.js';
import { cheminDemo, creerBacs, DemoIntrouvable } from '../server/demo.js';
import { ErreurHttp } from '../server/http.js';
import { ConflitStockage, piloteBlob, piloteFs, piloteMemoire, choisirPilote } from '../server/store.js';

const dossiers = [];
after(async () => {
  for (const d of dossiers) await rm(d, { recursive: true, force: true });
});

async function pilotes() {
  const d = await mkdtemp(join(tmpdir(), 'blachere-fs-'));
  dossiers.push(d);
  return [
    ['mémoire', piloteMemoire()],
    ['fs', piloteFs(d)],
  ];
}

const ID = 'abcdefghijklmnop';
const docDe = (id = ID, extra = {}) => ({ v: 1, id, createdAt: '2026-10-15T08:30:00Z', updatedAt: '2026-10-15T08:30:00Z', compteur: 0, journal: [], courriels: [], mouvements: [], ...extra });

describe('choix du pilote', () => {
  test('jeton Blob → blob ; BLACHERE_STORE=memoire → mémoire ; sinon fs ; Vercel sans jeton → erreur de configuration', () => {
    assert.equal(choisirPilote({ BLOB_READ_WRITE_TOKEN: 'x' }).nom, 'blob');
    assert.equal(choisirPilote({ BLACHERE_STORE: 'memoire' }).nom, 'memoire');
    assert.equal(choisirPilote({}).nom, 'fs');
    assert.throws(() => choisirPilote({ VERCEL: '1' }), (e) => e.name === 'ErreurConfiguration');
    assert.equal(piloteBlob().nom, 'blob');
  });
});

describe('pilotes : ETag, création seule, écriture conditionnelle', async () => {
  for (const [nom, p] of await pilotes()) {
    test(nom, async () => {
      const ch = 'demos/abcdefghijklmnop.json';
      assert.equal(await p.lire(ch), null);
      const { etag: e1 } = await p.ecrire(ch, '{"a":1}', { creation: true });
      assert.equal((await p.lire(ch)).etag, e1);
      await assert.rejects(p.ecrire(ch, '{"a":2}', { creation: true }), ConflitStockage);
      await assert.rejects(p.ecrire(ch, '{"a":2}', { ifMatch: '"autre"' }), ConflitStockage);
      const { etag: e2 } = await p.ecrire(ch, '{"a":2}', { ifMatch: e1 });
      assert.notEqual(e1, e2);
      assert.deepEqual(await p.lire(ch), { contenu: '{"a":2}', etag: e2 });
      // écriture conditionnelle sur un document absent : refusée
      await assert.rejects(p.ecrire('demos/zzzzzzzzzzzzzzzz.json', '{}', { ifMatch: e2 }), ConflitStockage);
      const liste = [];
      for await (const x of p.lister('demos/')) liste.push(x);
      assert.deepEqual(
        liste.map((x) => [x.chemin, x.etag, x.taille]),
        [[ch, e2, 7]],
      );
      // suppression conditionnelle (ménage) : refusée si le document a changé depuis la liste
      await assert.rejects(p.supprimer(ch, { ifMatch: e1 }), ConflitStockage);
      assert.equal((await p.lire(ch)).etag, e2);
      await p.supprimer(ch, { ifMatch: e2 });
      assert.equal(await p.lire(ch), null);
      await p.ecrire(ch, '{"a":3}', { creation: true });
      await p.supprimer(ch);
      assert.equal(await p.lire(ch), null);
      await p.supprimer(ch); // déjà absent : sans erreur
      await assert.rejects(p.lire('../etc/passwd'), /Chemin/);
    });
  }
  test('fs : écriture atomique, aucun fichier temporaire laissé', async () => {
    const d = await mkdtemp(join(tmpdir(), 'blachere-fs-'));
    dossiers.push(d);
    const p = piloteFs(d);
    const ch = 'demos/abcdefghijklmnop.json';
    let { etag } = await p.ecrire(ch, '{"n":0}', { creation: true });
    for (let i = 1; i <= 5; i++) ({ etag } = await p.ecrire(ch, `{"n":${i}}`, { ifMatch: etag }));
    assert.deepEqual(await readdir(join(d, 'demos')), ['abcdefghijklmnop.json']);
  });
});

describe('mutation atomique', async () => {
  for (const [nom, p] of await pilotes()) {
    test(`${nom} : une écriture concurrente provoque un nouvel essai sur le document frais`, async () => {
      const bacs = creerBacs(p);
      await bacs.creer(docDe('bcdefghijklmnopq'));
      const lu = await bacs.lire('bcdefghijklmnopq');
      // écriture « d'une autre instance » après notre lecture
      await p.ecrire(cheminDemo('bcdefghijklmnopq'), JSON.stringify({ ...lu.doc, compteur: 10 }), { ifMatch: lu.etag });
      const vus = [];
      const r = await bacs.muter(
        'bcdefghijklmnopq',
        (doc) => {
          vus.push(doc.compteur);
          doc.compteur += 1;
          return doc.compteur;
        },
        { initial: lu },
      );
      assert.deepEqual(vus, [0, 10]);
      assert.equal(r.resultat, 11);
      assert.equal((await bacs.lire('bcdefghijklmnopq')).doc.compteur, 11);
    });

    test(`${nom} : 409 après trois essais en conflit`, async () => {
      const bacs = creerBacs(p);
      const id = 'cdefghijklmnopqr';
      await bacs.creer(docDe(id));
      const autre = creerBacs(p);
      let essais = 0;
      // à chaque essai, le document est relu puis modifié ailleurs avant notre écriture
      const original = p.ecrire.bind(p);
      const pilote = {
        ...p,
        lire: p.lire.bind(p),
        lister: p.lister.bind(p),
        supprimer: p.supprimer.bind(p),
        async ecrire(ch, contenu, opts) {
          if (opts?.ifMatch) {
            essais += 1;
            await autre.muter(id, (doc) => {
              doc.compteur += 100;
            });
          }
          return original(ch, contenu, opts);
        },
      };
      const gene = creerBacs(pilote);
      await assert.rejects(
        gene.muter(id, (doc) => {
          doc.compteur += 1;
        }),
        (e) => e instanceof ErreurHttp && e.status === 409 && e.extra.code === 'conflit',
      );
      assert.equal(essais, 3);
      assert.equal((await bacs.lire(id)).doc.compteur, 300);
    });

    test(`${nom} : 20 incréments simultanés, aucun perdu`, async () => {
      const bacs = creerBacs(p);
      const id = 'defghijklmnopqrs';
      await bacs.creer(docDe(id));
      const r = await Promise.all(
        Array.from({ length: 20 }, () =>
          bacs.muter(id, (doc) => {
            doc.compteur += 1;
            return doc.compteur;
          }),
        ),
      );
      assert.equal((await bacs.lire(id)).doc.compteur, 20);
      assert.deepEqual(r.map((x) => x.resultat).sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1));
    });

    test(`${nom} : deux instances, 2 × 10 incréments simultanés : chaque succès compte, rien n'est perdu`, async () => {
      const id = 'efghijklmnopqrst';
      const a = creerBacs(p);
      const b = creerBacs(p);
      await a.creer(docDe(id));
      const essai = (bacs) =>
        bacs
          .muter(id, (doc) => {
            doc.compteur += 1;
          })
          .then(
            () => 1,
            (e) => {
              if (e.status === 409) return 0;
              throw e;
            },
          );
      const r = await Promise.all([...Array.from({ length: 10 }, () => essai(a)), ...Array.from({ length: 10 }, () => essai(b))]);
      const succes = r.reduce((s, x) => s + x, 0);
      assert.ok(succes >= 10, `${succes} succès`);
      assert.equal((await a.lire(id)).doc.compteur, succes);
    });

    test(`${nom} : démo absente → DemoIntrouvable ; mutation sans écriture ; mutation asynchrone refusée`, async () => {
      const bacs = creerBacs(p);
      await assert.rejects(bacs.muter('ffffffffffffffff', () => {}), DemoIntrouvable);
      const id = 'fghijklmnopqrstu';
      const cree = await bacs.creer(docDe(id));
      const r = await bacs.muter(id, (doc, m) => {
        m.inchange();
        return 'rien';
      });
      assert.equal(r.resultat, 'rien');
      assert.equal(r.etag, cree.etag);
      await assert.rejects(bacs.muter(id, async () => {}), /synchrone/);
    });

    test(`${nom} : boîte d'envoi et journal plafonnés à 500 entrées`, async () => {
      const bacs = creerBacs(p);
      const id = 'ghijklmnopqrstuv';
      await bacs.creer(docDe(id));
      await bacs.muter(id, (doc) => {
        for (let i = 0; i < 620; i++) {
          doc.courriels.push({ id: i });
          doc.journal.push({ id: i });
        }
      });
      const { doc } = await bacs.lire(id);
      assert.equal(doc.courriels.length, 500);
      assert.equal(doc.journal.length, 500);
      assert.equal(doc.journal[0].id, 120);
    });
  }
});
