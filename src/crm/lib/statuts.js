// Libellés et tons des états et des listes fermées du modèle (docs/crm-espace-pro.md, § 4).
// Ton : new (fuchsia, à traiter), warn (or, en cours), info (bleu), ok (vert), err (rouge), mute.

export const COMMANDE = {
  nouvelle: { label: 'Nouvelle', ton: 'new' },
  'en-preparation': { label: 'En préparation', ton: 'warn' },
  prete: { label: 'Prête au retrait', court: 'Prête', ton: 'info' },
  expediee: { label: 'Expédiée', ton: 'info' },
  livree: { label: 'Livrée', ton: 'ok' },
  retiree: { label: 'Retirée', ton: 'ok' },
  annulee: { label: 'Annulée', ton: 'mute' },
  remboursee: { label: 'Remboursée', ton: 'mute' },
};
export const ORDRE_COMMANDE = ['nouvelle', 'en-preparation', 'prete', 'expediee', 'livree', 'retiree', 'annulee', 'remboursee'];

// Verbe de chaque transition (boutons)
export const TRANSITION = {
  'en-preparation': { label: 'Passer en préparation', icone: 'box' },
  prete: { label: 'Prête au retrait', icone: 'store' },
  expediee: { label: 'Expédier', icone: 'truck' },
  livree: { label: 'Marquer livrée', icone: 'check' },
  retiree: { label: 'Marquer retirée', icone: 'check' },
  annulee: { label: 'Annuler la commande', icone: 'x', danger: true },
  remboursee: { label: 'Rembourser', icone: 'undo', danger: true },
  nouvelle: { label: 'Remettre en « nouvelle »', icone: 'undo' },
};

export const CANAL = {
  'en-ligne': { label: 'En ligne', icone: 'globe' },
  pro: { label: 'Pro', icone: 'building' },
  telephone: { label: 'Téléphone', icone: 'phone' },
};

export const PAIEMENT_STATUT = {
  paye: { label: 'Payée', ton: 'ok' },
  'en-attente': { label: 'En attente', ton: 'warn' },
  rembourse: { label: 'Remboursée', ton: 'mute' },
};
export const PAIEMENT_MODE = {
  carte: 'Carte bancaire',
  paypal: 'PayPal',
  virement: 'Virement',
  'a-reception': 'À réception',
  '30j-fdm': '30 jours fin de mois',
  '45j': '45 jours',
  prelevement: 'Prélèvement',
  comptant: 'Comptant',
  especes: 'Espèces',
  cheque: 'Chèque',
};
export const FACTURE = {
  'a-regler': { label: 'À régler', ton: 'warn' },
  payee: { label: 'Payée', ton: 'ok' },
  'en-retard': { label: 'En retard', ton: 'err' },
};

export const LIVRAISON = {
  retrait: { label: 'Retrait à la distillerie', court: 'Retrait', icone: 'store' },
  colissimo: { label: 'Colissimo à domicile', court: 'Colissimo', icone: 'truck' },
  relais: { label: 'Point relais', court: 'Relais', icone: 'pin' },
  transporteur: { label: 'Transporteur', court: 'Transporteur', icone: 'truck' },
};

export const CLIENT_ORIGINE = {
  'boutique-en-ligne': 'Boutique en ligne',
  boutique: 'Boutique de la distillerie',
  visite: 'Visite',
  newsletter: 'Lettre d’information',
  salon: 'Salon',
};

export const COMPTE_TYPE = {
  chr: 'Café, hôtel, restaurant',
  hotel: 'Hôtel',
  camping: 'Camping',
  caviste: 'Caviste',
  epicerie: 'Épicerie fine',
  distributeur: 'Distributeur',
  autre: 'Autre',
};
export const COMPTE_TYPE_COURT = { chr: 'CHR', hotel: 'Hôtel', camping: 'Camping', caviste: 'Caviste', epicerie: 'Épicerie', distributeur: 'Distributeur', autre: 'Autre' };
export const COMPTE_STATUT = {
  actif: { label: 'Actif', ton: 'ok' },
  suspendu: { label: 'Suspendu', ton: 'err' },
};
export const GRILLE = {
  chr: { label: 'Grille CHR', coef: 0.72 },
  caviste: { label: 'Grille caviste', coef: 0.68 },
  distributeur: { label: 'Grille distributeur', coef: 0.6 },
};
export const CONDITIONS = {
  comptant: 'Comptant',
  '30j-fdm': '30 jours fin de mois',
  '45j': '45 jours',
  prelevement: 'Prélèvement',
};
export const LICENCE = {
  'licence-iv': 'Licence IV',
  'licence-restaurant': 'Licence restaurant',
  'petite-licence-restaurant': 'Petite licence restaurant',
  'vente-a-emporter': 'Licence à emporter',
  aucune: 'Aucune licence d’alcool',
};
export const COMPTE_ORIGINE = { site: 'Site', salon: 'Salon', commercial: 'Commercial' };

export const DEMANDE = {
  nouvelle: { label: 'Nouvelle', ton: 'new' },
  'en-cours': { label: 'En cours', ton: 'warn' },
  acceptee: { label: 'Acceptée', ton: 'ok' },
  refusee: { label: 'Refusée', ton: 'mute' },
};

export const SEANCE = {
  ouverte: { label: 'Ouverte', ton: 'ok' },
  fermee: { label: 'Fermée', ton: 'mute' },
  complete: { label: 'Complète', ton: 'warn' },
};
export const MOMENT = { matin: 'Matin', 'apres-midi': 'Après-midi' };
export const LANGUE = { fr: 'Français', en: 'Anglais', de: 'Allemand' };
export const LANGUE_COURT = { fr: 'FR', en: 'EN', de: 'DE' };
export const RESERVATION = {
  confirmee: { label: 'Confirmée', ton: 'info' },
  venue: { label: 'Venue', ton: 'ok' },
  absente: { label: 'Absente', ton: 'err' },
  annulee: { label: 'Annulée', ton: 'mute' },
};
export const RESERVATION_SOURCE = { site: 'Site', telephone: 'Téléphone', crm: 'CRM' };

export const MESSAGE = {
  nouveau: { label: 'Nouveau', ton: 'new' },
  'en-cours': { label: 'En cours', ton: 'warn' },
  traite: { label: 'Traité', ton: 'ok' },
  archive: { label: 'Archivé', ton: 'mute' },
};
export const SUJET = { commande: 'Commande', visite: 'Visite', pro: 'Espace pro', presse: 'Presse', autre: 'Autre' };

export const ABONNE_SOURCE = { 'pied-de-page': 'Pied de page du site', commande: 'Commande', visite: 'Visite', contact: 'Formulaire de contact', salon: 'Salon' };
export const ABONNE = { inscrit: { label: 'Inscrit', ton: 'ok' }, desinscrit: { label: 'Désinscrit', ton: 'mute' } };
export const SEGMENT = {
  tous: { label: 'Tous les inscrits', court: 'Tous' },
  clients: { label: 'Clients (déjà commandé)', court: 'Clients' },
  pros: { label: 'Professionnels', court: 'Pros' },
  visiteurs: { label: 'Visiteurs de la distillerie', court: 'Visiteurs' },
};
export const CAMPAGNE = { brouillon: { label: 'Brouillon', ton: 'mute' }, envoyee: { label: 'Envoyée', ton: 'ok' } };

export const PROMO_TYPE = { pourcentage: 'Pourcentage', montant: 'Montant fixe', livraison: 'Livraison offerte' };

export const MOTIF_STOCK = {
  production: { label: 'Production', signe: 1, desc: 'Mise en bouteilles, entrée en stock' },
  inventaire: { label: 'Inventaire', signe: 0, desc: 'Quantité comptée en rayon' },
  casse: { label: 'Casse', signe: -1, desc: 'Bouteilles cassées ou invendables' },
  ajustement: { label: 'Ajustement', signe: 0, desc: 'Correction ponctuelle' },
  vente: { label: 'Vente', signe: -1 },
  annulation: { label: 'Annulation', signe: 1 },
};
export const STOCK = {
  disponible: { label: 'En stock', ton: 'ok' },
  'stock-bas': { label: 'Stock bas', ton: 'warn' },
  rupture: { label: 'Rupture', ton: 'err' },
};

export const COURRIEL_TYPE = {
  commande: 'Confirmation de commande',
  expedition: 'Expédition',
  retrait: 'Prête au retrait',
  facture: 'Facture',
  invitation: 'Invitation',
  reinitialisation: 'Mot de passe',
  reservation: 'Réservation de visite',
  reponse: 'Réponse à un message',
  'demande-pro': 'Demande pro',
  campagne: 'Campagne',
  bienvenue: 'Bienvenue',
  annulation: 'Annulation',
  remboursement: 'Remboursement',
  preparation: 'En préparation',
};

export const GAMMES = {
  pac: { nom: 'PAC Citron', ordre: 1 },
  'fun-blue': { nom: 'Fun Blue', ordre: 2 },
  'couleur-provence': { nom: 'Sirops Couleur Provence®', ordre: 3 },
  'pastis-aperitifs': { nom: 'Les Apéritifs et Pastis', ordre: 4 },
  liqueurs: { nom: 'Les Liqueurs', ordre: 5 },
  'cremes-eaux-de-vie': { nom: 'Les Crèmes et Eaux de Vie', ordre: 6 },
  marcs: { nom: 'Les Vieux Marcs', ordre: 7 },
};

export const libelle = (table, v) => {
  const x = table[v];
  if (!x) return v ? String(v) : '—';
  return typeof x === 'string' ? x : x.label;
};
export const tonDe = (table, v) => table[v]?.ton || 'mute';
