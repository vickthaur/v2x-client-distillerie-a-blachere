// Rubriques du CRM : barre latérale (groupes), barre d'onglets du téléphone, recherche rapide.
// `droit` : rubrique(s) des droits du § 3 qui donnent accès à l'écran.

export const GROUPES = [
  {
    id: 'pilotage',
    nom: 'Pilotage',
    items: [
      { id: 'tableau', nom: 'Tableau de bord', court: 'Tableau', href: '/crm', icone: 'tableau', droit: ['tableau'] },
      { id: 'journal', nom: 'Journal', href: '/crm/journal', icone: 'journal', droit: ['journal'] },
    ],
  },
  {
    id: 'ventes',
    nom: 'Ventes',
    items: [
      { id: 'commandes', nom: 'Commandes', href: '/crm/commandes', icone: 'commandes', droit: ['commandes', 'commandes-pro'], notif: 'commandes' },
      { id: 'clients', nom: 'Clients', href: '/crm/clients', icone: 'client', droit: ['clients'] },
      { id: 'comptes', nom: 'Comptes pro', href: '/crm/comptes', icone: 'store', droit: ['comptes'] },
      { id: 'demandes', nom: 'Demandes pro', href: '/crm/demandes', icone: 'briefcase', droit: ['demandes', 'comptes'], notif: 'demandes' },
    ],
  },
  {
    id: 'distillerie',
    nom: 'Distillerie',
    items: [
      { id: 'produits', nom: 'Produits et stocks', court: 'Produits', href: '/crm/produits', icone: 'bouteille', droit: ['produits', 'stocks'], notif: 'stocksBas', notifTon: 'mute' },
      { id: 'visites', nom: 'Visites', href: '/crm/visites', icone: 'calendrier', droit: ['visites'] },
    ],
  },
  {
    id: 'relation',
    nom: 'Relation',
    items: [
      { id: 'messages', nom: 'Messages', href: '/crm/messages', icone: 'message', droit: ['messages'], notif: 'messages' },
      { id: 'newsletter', nom: 'Newsletter', href: '/crm/newsletter', icone: 'mail', droit: ['newsletter'] },
      { id: 'promos', nom: 'Codes promo', href: '/crm/promos', icone: 'ticket', droit: ['promos', 'newsletter'] },
      { id: 'courriels', nom: 'Courriels envoyés', court: 'Courriels', href: '/crm/courriels', icone: 'send', droit: ['courriels'] },
    ],
  },
  {
    id: 'administration',
    nom: 'Administration',
    items: [
      { id: 'equipe', nom: 'Équipe', href: '/crm/equipe', icone: 'equipe', droit: ['equipe'] },
      { id: 'parametres', nom: 'Paramètres', href: '/crm/parametres', icone: 'reglages', droit: ['parametres'] },
    ],
  },
];

export const RUBRIQUES = GROUPES.flatMap((g) => g.items.map((i) => ({ ...i, groupe: g.nom })));
export const rubrique = (id) => RUBRIQUES.find((r) => r.id === id);

export const accessible = (item, peut) => item.droit.some((d) => peut(d));

// Rubrique de l'adresse courante
export function rubriqueDe(path) {
  const seg = path.split('/')[2] || 'tableau';
  if (seg === 'plus') return { id: 'plus', nom: 'Plus', href: '/crm/plus' };
  return RUBRIQUES.find((r) => r.id === seg) || RUBRIQUES[0];
}

// Barre d'onglets du téléphone : Tableau, Commandes, Visites, Messages (ou ce que le profil voit), Plus
export function onglets(peut) {
  const prefs = ['tableau', 'commandes', 'visites', 'messages'];
  const repli = ['produits', 'demandes', 'clients', 'comptes', 'newsletter', 'courriels'];
  const choix = prefs.map(rubrique).filter((r) => accessible(r, peut));
  for (const id of repli) {
    if (choix.length >= 4) break;
    const r = rubrique(id);
    if (accessible(r, peut)) choix.push(r);
  }
  return choix.slice(0, 4);
}
