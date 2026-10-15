// Droits du personnel (docs/crm-espace-pro.md, § 3). Le serveur contrôle chaque appel ; l'interface
// ne fait que masquer ce que le profil ne peut pas faire. Les droits viennent de `moi`
// (utilisateur.droits) ; à défaut, la matrice du document de conception sert de repli.

const E = 'ecriture';
const L = 'lecture';

// Matrice du § 3 (repli si le serveur ne fournit pas de droits)
const MATRICE = {
  direction: { tableau: E, commandes: E, 'commandes-pro': E, factures: E, clients: E, comptes: E, demandes: E, produits: E, stocks: E, visites: E, messages: E, newsletter: E, promos: E, courriels: E, journal: E, equipe: E, parametres: E, exports: E },
  commercial: { tableau: E, commandes: L, 'commandes-pro': E, factures: E, clients: L, comptes: E, demandes: E, produits: L, stocks: L, visites: L, messages: E, newsletter: E, promos: E, courriels: E, journal: E, exports: E },
  logistique: { tableau: E, commandes: E, 'commandes-pro': E, clients: L, comptes: L, demandes: L, produits: L, stocks: E, courriels: E, journal: E, exports: E },
  boutique: { tableau: E, commandes: E, 'commandes-pro': L, factures: L, clients: E, produits: L, stocks: L, visites: E, messages: E, newsletter: L, promos: L, courriels: E, journal: E, exports: E },
};

// Synonymes possibles des rubriques renvoyées par le serveur
const ALIAS = {
  commandespro: 'commandes-pro',
  commandes_pro: 'commandes-pro',
  'commandes-en-ligne': 'commandes',
  commandesenligne: 'commandes',
  'comptes-pro': 'comptes',
  comptespro: 'comptes',
  // le serveur range les demandes pro sous « comptes » et les codes promo sous « newsletter »
  demandes: 'comptes',
  'demandes-pro': 'comptes',
  promos: 'newsletter',
  'codes-promo': 'newsletter',
  promo: 'newsletter',
  prix: 'produits',
  stock: 'stocks',
  visite: 'visites',
  message: 'messages',
  courriel: 'courriels',
  'courriels-envoyes': 'courriels',
  export: 'exports',
  parametre: 'parametres',
  'tableau-de-bord': 'tableau',
};
const norme = (r) => {
  const k = String(r).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return ALIAS[k] || k;
};
const niveau = (v) => (/^(l|lecture|read|r)$/i.test(String(v)) ? L : E);

// Droits normalisés : { rubrique: 'lecture' | 'ecriture' }
export function lireDroits(utilisateur) {
  const d = utilisateur?.droits;
  const out = {};
  if (Array.isArray(d) && d.length) {
    for (const item of d) {
      if (!item) continue;
      if (typeof item === 'object') {
        const r = item.rubrique || item.nom || item.id;
        if (r) out[norme(r)] = item.ecriture === false || /lecture/i.test(item.acces || item.niveau || '') ? L : E;
        continue;
      }
      const [r, n] = String(item).split(/[:.]/);
      const k = norme(r);
      const v = n ? niveau(n) : E;
      if (out[k] !== E) out[k] = v;
    }
    return out;
  }
  if (d && typeof d === 'object') {
    for (const [r, v] of Object.entries(d)) if (v) out[norme(r)] = v === true ? E : niveau(v);
    return out;
  }
  return { ...(MATRICE[utilisateur?.role] || {}) };
}

export function creerPeut(droits) {
  return (rubrique, mode = 'lecture') => {
    const v = droits[norme(rubrique)];
    if (!v) return false;
    return mode === 'lecture' ? true : v === E;
  };
}

export const ROLES = {
  direction: { nom: 'Direction', court: 'Direction', desc: 'Tout le CRM : pilotage, ventes, équipe et réglages.' },
  commercial: { nom: 'Commercial', court: 'Commercial', desc: 'Comptes et demandes pro, commandes pro, factures, newsletter.' },
  logistique: { nom: 'Logistique', court: 'Logistique', desc: 'Préparation, expéditions, stocks et mouvements.' },
  boutique: { nom: 'Boutique et visites', court: 'Boutique', desc: 'Commandes en ligne, clients, visites, messages.' },
  pro: { nom: 'Client pro', court: 'Pro', desc: 'Espace professionnel.' },
};
export const roleNom = (r) => ROLES[r]?.nom || r || '';
