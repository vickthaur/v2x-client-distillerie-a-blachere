// Opérations du moment de la distillerie, affichées pendant leur période (jours en heure de Paris)
// puis retirées d'elles-mêmes. Textes relevés mot pour mot sur le site officiel : voir
// photos/operation-octobre-rose/RELEVE.md (branche operation-octobre-rose). Rien d'inventé : ce que
// la bannière officielle ne dit pas (plafond du don, autres contenances) n'est pas écrit.
//
// Module sans dépendance au navigateur : le serveur (API, CRM) l'importe aussi pour compter les
// bouteilles concernées et le montant à reverser.

export const OPERATIONS = [
  {
    id: 'octobre-rose-2026',
    nom: 'Octobre Rose',
    // « Du 1/10 au 31/10 » sur la bannière, mise en ligne le 21 septembre 2026.
    debut: '2026-10-01',
    fin: '2026-10-31',
    periode: 'du 1er au 31 octobre',
    titre: '1 € reversé pour chaque bouteille de PAC Citron',
    produits: ['pac-citron'],
    produitNom: 'PAC Citron',
    produitUrl: '/boutique/pac-citron',
    page: '/pac-citron#octobre-rose',
    montant: 1,
    // Nom tel qu'il est écrit sur la bannière (logo « Sainte Catherine ») ; l'établissement se
    // présente aussi comme « Sainte-Catherine – Institut du Cancer Avignon-Provence ».
    beneficiaire: 'Institut du Cancer Avignon-Provence',
    beneficiaireAvecArticle: 'à l’Institut du Cancer Avignon-Provence (Sainte-Catherine)',
    // Deux lignes, comme sur la bannière : « INSTITUT DU CANCER » / « Avignon-Provence ».
    beneficiaireLignes: ['Institut du Cancer', 'Avignon-Provence'],
    beneficiaireSousTitre: 'Sainte-Catherine',
    lien: null,
    // Unicancer : https://www.unicancer.fr/en/clcc/sainte-catherine-institut-du-cancer-avignon-provence/
    precisions: 'Sainte-Catherine, à Avignon, est l’un des centres de lutte contre le cancer du réseau Unicancer.',
    conditions: '* Offre valable uniquement sur le site web et en boutique d’usine.',
    // Semis de rubans du bandeau : [x %, y %, rotation, échelle, ton].
    semis: [
      [3, 8, -14, 1, 'pale'], [11, 62, 10, 0.8, 'rose'], [19, 18, 6, 0.9, 'rose'], [26, 78, -8, 1, 'pale'],
      [34, 4, 14, 0.75, 'pale'], [41, 70, -16, 0.9, 'rose'], [49, 12, -6, 1, 'rose'], [57, 82, 12, 0.8, 'pale'],
      [64, 6, 8, 0.9, 'pale'], [71, 66, -12, 1, 'rose'], [79, 16, 16, 0.8, 'rose'], [86, 74, 6, 0.9, 'pale'],
      [94, 10, -10, 1, 'rose'], [97, 52, 14, 0.75, 'pale'],
    ],
    source: 'https://www.distillerieablachere.com/ (bannière de l’accueil, relevée le 15 octobre 2026)',
  },
];

// Jour « AAAA-MM-JJ » à Paris.
export function jourParis(date = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

// Opération en cours à cette date ; `force` (identifiant) la renvoie hors période, pour présenter
// la maquette après la date.
export function operationEnCours(date = new Date(), force = null) {
  if (force) {
    const op = OPERATIONS.find((o) => o.id === force);
    if (op) return op;
  }
  const j = jourParis(date);
  return OPERATIONS.find((o) => o.debut <= j && j <= o.fin) || null;
}

export const concerne = (op, slug) => Boolean(op && op.produits.includes(slug));

// Don correspondant à des lignes { slug, qty } (ou { slug, qte }) : bouteilles concernées et montant.
export function donPour(op, lignes = []) {
  if (!op) return { bouteilles: 0, montant: 0 };
  const bouteilles = lignes.filter((l) => concerne(op, l.slug)).reduce((s, l) => s + (Number(l.qty ?? l.qte) || 0), 0);
  return { bouteilles, montant: Math.round(bouteilles * op.montant * 100) / 100 };
}
