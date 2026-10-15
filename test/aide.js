// Outils des tests : pilote mémoire neuf, horloge fixée, « navigateur » qui appelle les fonctions de
// api/ avec de vraies Request et garde ses cookies d'un appel à l'autre.
process.env.BLACHERE_STORE = 'memoire';
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.VERCEL;

import { reinitialiserLimiteurs } from '../server/limiteur.js';
import { piloteMemoire, utiliserPilote } from '../server/store.js';
import { fixerHorloge } from '../server/temps.js';

export const MOT_DE_PASSE = 'Distillerie1835';
// Jeudi 15 octobre 2026, 10 h 30 à Paris : Octobre Rose en cours, saison des visites ouverte.
export const MAINTENANT = '2026-10-15T08:30:00Z';

const modules = {};
export async function fonctionApi(nom) {
  modules[nom] ||= await import(`../api/${nom}.js`);
  return modules[nom];
}

// Remet l'environnement à zéro : magasin mémoire neuf, limiteurs vides, horloge fixée.
export function environnementNeuf(date = MAINTENANT) {
  reinitialiserLimiteurs();
  fixerHorloge(date);
  return utiliserPilote(piloteMemoire());
}

export class Navigateur {
  constructor({ hote = 'localhost:5181', ip = '203.0.113.10', https = false } = {}) {
    this.hote = hote;
    this.ip = ip;
    this.https = https;
    this.cookies = new Map();
  }

  enteteCookies() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  // Appel brut : { status, json, texte, headers, setCookies }.
  async appel(fonction, methode, r, { query = {}, corps, entetes = {}, sansCsrf = false, brut } = {}) {
    const mod = await fonctionApi(fonction);
    const url = new URL(`${this.https ? 'https' : 'http'}://${this.hote}/api/${fonction}`);
    if (r !== undefined) url.searchParams.set('r', r);
    for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, String(v));
    const headers = { host: this.hote, 'x-forwarded-for': this.ip };
    const ck = this.enteteCookies();
    if (ck) headers.cookie = ck;
    if (methode !== 'GET' && methode !== 'HEAD' && !sansCsrf) {
      headers['content-type'] = 'application/json';
      headers['x-blachere'] = '1';
    }
    Object.assign(headers, entetes);
    const body = brut !== undefined ? brut : corps !== undefined ? JSON.stringify(corps) : undefined;
    const res = await mod[methode](new Request(url, { method: methode, headers, body }));
    const setCookies = res.headers.getSetCookie();
    for (const sc of setCookies) {
      const [kv] = sc.split(';');
      const i = kv.indexOf('=');
      const k = kv.slice(0, i);
      const v = kv.slice(i + 1);
      if (/Max-Age=0/.test(sc)) this.cookies.delete(k);
      else this.cookies.set(k, v);
    }
    const texte = res.status === 204 ? '' : await res.text();
    let json = null;
    try {
      json = texte ? JSON.parse(texte) : null;
    } catch {
      json = null;
    }
    return { status: res.status, json, texte, headers: res.headers, setCookies };
  }

  get(fonction, r, query = {}, options = {}) {
    return this.appel(fonction, 'GET', r, { ...options, query });
  }
  post(fonction, r, corps = {}, options = {}) {
    return this.appel(fonction, 'POST', r, { ...options, corps });
  }
  patch(fonction, r, corps = {}, options = {}) {
    return this.appel(fonction, 'PATCH', r, { ...options, corps });
  }
  delete(fonction, r, corps = {}, options = {}) {
    return this.appel(fonction, 'DELETE', r, { ...options, corps });
  }

  // Entrée en démo par un profil (crée la démo au besoin).
  async entrer(profil) {
    const r = await this.post('session', 'demo', { profil });
    if (r.status !== 200) throw new Error(`Entrée en démo impossible (${r.status}) : ${r.texte}`);
    return r.json.utilisateur;
  }
}

// Lignes de commande simples.
export const ligne = (slug, varianteId, qte) => ({ slug, varianteId, qte });

// Commande publique valide (corps de site?r=commande).
export function commandePublique(extra = {}) {
  return {
    client: { prenom: 'Anne', nom: 'Essai', email: 'anne.essai@example.com', telephone: '06 39 98 11 22' },
    livraison: { mode: 'colissimo', adresse: { ligne1: '3 rue des Lilas', cp: '84000', ville: 'Avignon' } },
    paiement: { mode: 'carte' },
    lignes: [ligne('pac-citron', '1000', 3), ligne('fun-blue', '1000', 1)],
    ageConfirme: false,
    newsletter: false,
    cgv: true,
    ...extra,
  };
}
