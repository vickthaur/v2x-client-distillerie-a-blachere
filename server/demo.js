// Bacs à sable : une démo = un document JSON demos/<id>.json (docs/crm-espace-pro.md, § 2 et § 4).
// - lire(id) → { id, doc, etag } ou null ;
// - creer(doc) : écriture « création seulement » ;
// - muter(id, fn) : lecture (avec ETag) → fn appliquée à une copie → écriture conditionnelle
//   (ifMatch) ; si l'ETag a changé (autre instance, autre appareil), relecture et nouvel essai, trois
//   au plus, puis 409. fn doit être une fonction pure et synchrone du document (rejouable).
// Dans un même processus, les mutations d'une même démo passent en file : pas de conflit inutile
// entre deux requêtes simultanées servies par la même instance ; l'ETag protège entre instances.
import { ConflitStockage, magasin } from './store.js';
import { erreur } from './http.js';
import { iso, maintenant } from './temps.js';
import { ID_DEMO } from './aleatoire.js';

export const ESSAIS = 3;
export const PLAFOND_JOURNAL = 500;
export const PLAFOND_COURRIELS = 500;
export const PLAFOND_MOUVEMENTS = 1000;
// Au-delà, la démo refuse de grossir (le jeu de démonstration pèse moins de 400 Ko).
export const TAILLE_MAX = 2 * 1024 * 1024;

export const cheminDemo = (id) => `demos/${id}.json`;
export const idDeChemin = (chemin) => (chemin.match(/^demos\/([a-z2-7]{16})\.json$/) || [])[1] || null;

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

export class DemoIntrouvable extends Error {
  constructor() {
    super('Démo introuvable.');
    this.name = 'DemoIntrouvable';
  }
}

// Plafonds : boîte d'envoi et journal gardent les 500 entrées les plus récentes.
export function plafonner(doc) {
  if (doc.courriels?.length > PLAFOND_COURRIELS) doc.courriels = doc.courriels.slice(-PLAFOND_COURRIELS);
  if (doc.journal?.length > PLAFOND_JOURNAL) doc.journal = doc.journal.slice(-PLAFOND_JOURNAL);
  if (doc.mouvements?.length > PLAFOND_MOUVEMENTS) doc.mouvements = doc.mouvements.slice(-PLAFOND_MOUVEMENTS);
  return doc;
}

export function creerBacs(store = null) {
  const s = () => store || magasin();
  const files = new Map();

  // Nombre d'écritures faites par ce processus sur chaque démo : une lecture faite avant d'entrer
  // dans la file ne sert de premier essai que si rien n'a été écrit depuis.
  const versions = new Map();

  async function enFile(id, fn) {
    const avant = files.get(id) || Promise.resolve();
    let liberer;
    const tour = new Promise((r) => {
      liberer = r;
    });
    const suite = avant.then(() => tour);
    files.set(id, suite);
    await avant;
    try {
      return await fn();
    } finally {
      liberer();
      if (files.get(id) === suite) files.delete(id);
    }
  }

  async function lire(id) {
    if (!ID_DEMO.test(id || '')) return null;
    const version = versions.get(id) || 0;
    const lu = await s().lire(cheminDemo(id));
    if (!lu) return null;
    return { id, doc: JSON.parse(lu.contenu), etag: lu.etag, version };
  }

  async function creer(doc) {
    if (!ID_DEMO.test(doc.id || '')) throw new Error('Identifiant de démo invalide.');
    const contenu = JSON.stringify(plafonner(doc));
    const { etag } = await s().ecrire(cheminDemo(doc.id), contenu, { creation: true });
    return { id: doc.id, doc, etag };
  }

  // fn(doc, m) : m.maintenant (Date, la même à chaque essai), m.inchange() (rien à écrire),
  // m.remplacer(nouveauDoc) (remise à zéro). Rend { resultat, doc, etag }.
  async function muter(id, fn, { initial = null } = {}) {
    const instant = maintenant();
    return enFile(id, async () => {
      let lu = initial && initial.id === id && initial.version === (versions.get(id) || 0) ? initial : null;
      for (let essai = 1; essai <= ESSAIS; essai++) {
        if (!lu) lu = await lire(id);
        if (!lu) throw new DemoIntrouvable();
        let remplacement = null;
        let inchange = false;
        const doc = structuredClone(lu.doc);
        const m = {
          maintenant: instant,
          inchange: () => {
            inchange = true;
          },
          remplacer: (d) => {
            remplacement = d;
          },
        };
        const resultat = fn(doc, m);
        if (resultat && typeof resultat.then === 'function') throw new Error('Une mutation doit être synchrone.');
        if (inchange && !remplacement) return { resultat, doc: lu.doc, etag: lu.etag, version: lu.version };
        const final = remplacement || doc;
        final.updatedAt = iso(instant);
        plafonner(final);
        const contenu = JSON.stringify(final);
        if (contenu.length > TAILLE_MAX) {
          throw erreur(409, 'La démo a atteint sa taille maximale : réinitialisez-la depuis le menu de démo.', { code: 'demo-pleine' });
        }
        try {
          const { etag } = await s().ecrire(cheminDemo(id), contenu, { ifMatch: lu.etag });
          const version = (versions.get(id) || 0) + 1;
          versions.set(id, version);
          if (versions.size > 5000) versions.clear();
          return { resultat, doc: final, etag, version };
        } catch (e) {
          if (!(e instanceof ConflitStockage)) throw e;
          lu = null;
          if (essai < ESSAIS) await pause(5 + Math.floor(Math.random() * 40) * essai);
        }
      }
      throw erreur(409, 'Les données viennent d’être modifiées ailleurs : réessayez.', { code: 'conflit' });
    });
  }

  async function supprimer(id) {
    await s().supprimer(cheminDemo(id));
  }

  return { lire, creer, muter, supprimer };
}

// Bacs de ce processus (une instance de fonction).
export const bacs = creerBacs();
