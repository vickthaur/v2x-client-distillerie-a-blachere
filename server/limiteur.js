// Limiteurs en mémoire, par instance de fonction (docs/crm-espace-pro.md, § 6) : fenêtre fixe,
// `max` événements par fenêtre et par clé (adresse IP en général).
const compteurs = new Map();

// Fenêtre fixe : `max` événements par `fenetreMs` et par clé. Rend true si l'événement est accepté.
export function limiter(cle, max, fenetreMs, maintenantMs = Date.now()) {
  if (compteurs.size > 20000) for (const [k, v] of compteurs) if (v.fin <= maintenantMs) compteurs.delete(k);
  let c = compteurs.get(cle);
  if (!c || c.fin <= maintenantMs) {
    c = { n: 0, fin: maintenantMs + fenetreMs };
    compteurs.set(cle, c);
  }
  if (c.n >= max) return false;
  c.n += 1;
  return true;
}

export function depasse(cle, max, maintenantMs = Date.now()) {
  const c = compteurs.get(cle);
  return !!c && c.fin > maintenantMs && c.n >= max;
}

export function reinitialiserLimiteurs() {
  compteurs.clear();
}

export const LIMITES = {
  // créations de démo : 60 par heure et par adresse IP (§ 6) ; en présentation, plusieurs appareils
  // partagent le même réseau wifi, donc la même adresse
  demos: { max: 60, fenetre: 3600000 },
  // échecs de connexion par adresse IP (en plus du verrouillage par compte)
  echecs: { max: 30, fenetre: 15 * 60000 },
  // écritures par adresse IP (garde-fou contre l'emballement)
  ecritures: { max: 240, fenetre: 60000 },
};
