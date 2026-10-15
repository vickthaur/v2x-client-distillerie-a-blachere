// Pilotes de stockage des démos (docs/crm-espace-pro.md, § 2). Même interface et même sémantique
// d'ETag pour les trois :
//   lire(chemin)                          → { contenu, etag } ou null
//   ecrire(chemin, contenu, { ifMatch })  → { etag } ; ConflitStockage si l'ETag a changé
//   ecrire(chemin, contenu, { creation }) → { etag } ; ConflitStockage si le document existe déjà
//   supprimer(chemin, { ifMatch })        → supprime ; ConflitStockage si l'ETag a changé
//   lister(prefixe)                       → itérateur asynchrone de { chemin, majLe, taille, etag }
// Choix : BLOB_READ_WRITE_TOKEN → Vercel Blob privé ; BLACHERE_STORE=memoire → mémoire (tests) ;
// sinon fichiers dans .data/ (développement, recette locale).
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { ErreurConfiguration } from './http.js';

export class ConflitStockage extends Error {
  constructor(message = 'Le document a été modifié entre-temps.') {
    super(message);
    this.name = 'ConflitStockage';
  }
}

const CHEMIN = /^(?!.*\.\.)[a-z0-9][a-z0-9/_.-]{0,200}$/;
function controlerChemin(chemin) {
  if (!CHEMIN.test(chemin)) throw new Error('Chemin de stockage invalide.');
  return chemin;
}

const etagDe = (contenu) => `"${createHash('sha256').update(contenu).digest('hex')}"`;

// File d'attente par chemin dans ce processus : une écriture conditionnelle (lecture de l'ETag
// courant, comparaison, écriture) est atomique pour les pilotes fs et mémoire.
function creerVerrous() {
  const files = new Map();
  return async function avecVerrou(cle, fn) {
    const avant = files.get(cle) || Promise.resolve();
    let liberer;
    const tour = new Promise((r) => {
      liberer = r;
    });
    const suite = avant.then(() => tour);
    files.set(cle, suite);
    await avant;
    try {
      return await fn();
    } finally {
      liberer();
      if (files.get(cle) === suite) files.delete(cle);
    }
  };
}

const auTourSuivant = () => new Promise((r) => setImmediate(r));

// ---------- Mémoire (tests) ----------

export function piloteMemoire() {
  const docs = new Map();
  const avecVerrou = creerVerrous();
  return {
    nom: 'memoire',
    async lire(chemin) {
      controlerChemin(chemin);
      await auTourSuivant();
      const d = docs.get(chemin);
      return d ? { contenu: d.contenu, etag: d.etag } : null;
    },
    async ecrire(chemin, contenu, { ifMatch, creation = false } = {}) {
      controlerChemin(chemin);
      await auTourSuivant();
      return avecVerrou(chemin, async () => {
        const actuel = docs.get(chemin);
        if (creation && actuel) throw new ConflitStockage('Le document existe déjà.');
        if (ifMatch && (!actuel || actuel.etag !== ifMatch)) throw new ConflitStockage();
        const etag = etagDe(contenu);
        docs.set(chemin, { contenu, etag, majLe: new Date() });
        return { etag };
      });
    },
    async supprimer(chemin, { ifMatch } = {}) {
      controlerChemin(chemin);
      await avecVerrou(chemin, async () => {
        const actuel = docs.get(chemin);
        if (ifMatch && actuel && actuel.etag !== ifMatch) throw new ConflitStockage();
        docs.delete(chemin);
      });
    },
    async *lister(prefixe = '') {
      for (const [chemin, d] of [...docs]) if (chemin.startsWith(prefixe)) yield { chemin, majLe: d.majLe, taille: d.contenu.length, etag: d.etag };
    },
    // tests : vieillir un document (ménage)
    _vieillir(chemin, date) {
      const d = docs.get(chemin);
      if (d) d.majLe = new Date(date);
    },
  };
}

// ---------- Fichiers (.data/) ----------

const verrousFs = creerVerrous();

export function piloteFs(dossier = process.env.BLACHERE_DATA || resolve(process.cwd(), '.data')) {
  const fichier = (chemin) => join(dossier, controlerChemin(chemin));
  async function lireBrut(chemin) {
    try {
      return await readFile(fichier(chemin), 'utf8');
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }
  return {
    nom: 'fs',
    dossier,
    async lire(chemin) {
      const contenu = await lireBrut(chemin);
      return contenu === null ? null : { contenu, etag: etagDe(contenu) };
    },
    async ecrire(chemin, contenu, { ifMatch, creation = false } = {}) {
      const f = fichier(chemin);
      return verrousFs(f, async () => {
        const actuel = await lireBrut(chemin);
        if (creation && actuel !== null) throw new ConflitStockage('Le document existe déjà.');
        if (ifMatch && (actuel === null || etagDe(actuel) !== ifMatch)) throw new ConflitStockage();
        await mkdir(dirname(f), { recursive: true });
        // écriture atomique : fichier temporaire puis renommage
        const tmp = `${f}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
        await writeFile(tmp, contenu, 'utf8');
        try {
          await rename(tmp, f);
        } catch (e) {
          await unlink(tmp).catch(() => {});
          throw e;
        }
        return { etag: etagDe(contenu) };
      });
    },
    async supprimer(chemin, { ifMatch } = {}) {
      const f = fichier(chemin);
      await verrousFs(f, async () => {
        if (ifMatch) {
          const actuel = await lireBrut(chemin);
          if (actuel !== null && etagDe(actuel) !== ifMatch) throw new ConflitStockage();
        }
        await unlink(f).catch((e) => (e.code === 'ENOENT' ? undefined : Promise.reject(e)));
      });
    },
    async *lister(prefixe = '') {
      const base = join(dossier, prefixe.replace(/[^/]*$/, ''));
      let noms = [];
      try {
        noms = await readdir(base);
      } catch (e) {
        if (e.code === 'ENOENT') return;
        throw e;
      }
      for (const n of noms) {
        if (n.endsWith('.tmp')) continue;
        const chemin = `${prefixe.replace(/[^/]*$/, '')}${n}`;
        if (!chemin.startsWith(prefixe)) continue;
        const s = await stat(join(base, n)).catch(() => null);
        if (!s?.isFile()) continue;
        const contenu = await lireBrut(chemin);
        if (contenu !== null) yield { chemin, majLe: s.mtime, taille: s.size, etag: etagDe(contenu) };
      }
    },
  };
}

// ---------- Vercel Blob (production) ----------

export function piloteBlob() {
  let sdk = null;
  const charger = async () => (sdk ||= await import('@vercel/blob'));
  return {
    nom: 'blob',
    async lire(chemin) {
      const { head, get, BlobNotFoundError } = await charger();
      controlerChemin(chemin);
      // ETag pris à l'API (head), comme dans l'exemple de la documentation Vercel : c'est celui que
      // put compare (ifMatch). Celui de la réponse de lecture (get) passe par le réseau de diffusion
      // et n'est pas le même : en production, toutes les écritures conditionnelles étaient refusées.
      // head avant get : si le document change entre les deux, l'écriture conditionnelle échoue et la
      // mutation reprend sur le document frais (jamais d'écrasement d'une version plus récente).
      let meta;
      try {
        meta = await head(chemin);
      } catch (e) {
        if (e instanceof BlobNotFoundError) return null;
        throw e;
      }
      const res = await get(chemin, { access: 'private', useCache: false });
      if (!res || res.statusCode !== 200 || !res.stream) return null;
      const contenu = await new Response(res.stream).text();
      return { contenu, etag: meta.etag };
    },
    async ecrire(chemin, contenu, { ifMatch, creation = false } = {}) {
      const { put, BlobPreconditionFailedError } = await charger();
      const options = { access: 'private', addRandomSuffix: false, contentType: 'application/json' };
      if (creation) options.allowOverwrite = false;
      else {
        options.allowOverwrite = true;
        if (ifMatch) options.ifMatch = ifMatch;
      }
      try {
        const r = await put(controlerChemin(chemin), contenu, options);
        return { etag: r.etag };
      } catch (e) {
        if (e instanceof BlobPreconditionFailedError) throw new ConflitStockage();
        // création : le document existe déjà (allowOverwrite: false)
        if (creation && /exist/i.test(String(e?.message || ''))) throw new ConflitStockage('Le document existe déjà.');
        throw e;
      }
    },
    async supprimer(chemin, { ifMatch } = {}) {
      const { del, BlobPreconditionFailedError } = await charger();
      try {
        await del(controlerChemin(chemin), ifMatch ? { ifMatch } : undefined);
      } catch (e) {
        if (e instanceof BlobPreconditionFailedError) throw new ConflitStockage();
        throw e;
      }
    },
    async *lister(prefixe = '') {
      const { list } = await charger();
      let cursor;
      do {
        const page = await list({ prefix: prefixe, cursor, limit: 1000 });
        for (const b of page.blobs) yield { chemin: b.pathname, majLe: new Date(b.uploadedAt), taille: b.size, etag: b.etag };
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
    },
  };
}

// ---------- Choix du pilote ----------

let courant = null;

export function choisirPilote(env = process.env) {
  if (env.BLOB_READ_WRITE_TOKEN) return piloteBlob();
  if (env.BLACHERE_STORE === 'memoire') return piloteMemoire();
  // Sur Vercel, le disque est en lecture seule : sans magasin Blob relié, l'API refuse de tourner.
  if (env.VERCEL) throw new ErreurConfiguration('BLOB_READ_WRITE_TOKEN absent');
  return piloteFs();
}

export function magasin() {
  courant ||= choisirPilote();
  return courant;
}

// Tests : remplacer le pilote (mémoire neuve, fs dans un dossier temporaire).
export function utiliserPilote(p) {
  courant = p;
  return p;
}
