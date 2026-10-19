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
  expediee: { label: 'Expédier', icone: 'camion' },
  livree: { label: 'Marquer livrée', icone: 'check' },
  retiree: { label: 'Marquer retirée', icone: 'check' },
  annulee: { label: 'Annuler la commande', icone: 'x', danger: true },
  remboursee: { label: 'Rembourser', icone: 'annuler', danger: true },
  nouvelle: { label: 'Remettre en « nouvelle »', icone: 'annuler' },
};

export const CANAL = {
  'en-ligne': { label: 'En ligne', icone: 'globe' },
  pro: { label: 'Pro', icone: 'store' },
  telephone: { label: 'Téléphone', icone: 'telephone' },
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
  colissimo: { label: 'Colissimo à domicile', court: 'Colissimo', icone: 'camion' },
  relais: { label: 'Point relais', court: 'Relais', icone: 'pin' },
  transporteur: { label: 'Transporteur', court: 'Transporteur', icone: 'camion' },
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
  commande: 'Commande',
  expedition: 'Expédition',
  retrait: 'Prête au retrait',
  facture: 'Facture',
  reservation: 'Réservation de visite',
  reponse: 'Réponse à un message',
  'demande-pro': 'Demande pro',
  invitation: 'Invitation',
  reinitialisation: 'Mot de passe',
  bienvenue: 'Bienvenue',
  campagne: 'Campagne',
};

export const GAMMES = {
  pac: { nom: 'PAC Citron', ordre: 1 },
  'fun-blue': { nom: 'Fun Blue', ordre: 2 },
  'couleur-provence': { nom: 'Sirops Couleur Provence®', ordre: 3 },
  'pastis-aperitifs': { nom: 'Les apéritifs et pastis', ordre: 4 },
  liqueurs: { nom: 'Les liqueurs', ordre: 5 },
  'cremes-eaux-de-vie': { nom: 'Les crèmes et eaux-de-vie', ordre: 6 },
  marcs: { nom: 'Les vieux marcs', ordre: 7 },
};

export const libelle = (table, v) => {
  const x = table[v];
  if (!x) return v ? String(v) : '—';
  return typeof x === 'string' ? x : x.label;
};
export const tonDe = (table, v) => table[v]?.ton || 'mute';

// Actions du journal (codes du serveur) : verbe pour la phrase, nom pour les filtres.
export const ACTIONS = {
  'commande.creation': { verbe: 'a saisi la commande', site: 'a reçu la commande', pro: 'a passé la commande', nom: 'Commande créée' },
  'commande.statut': { verbe: 'a fait avancer la commande', nom: 'Statut de commande' },
  'commande.suivi': { verbe: 'a ajouté le suivi du colis de la commande', nom: 'Suivi de colis' },
  'commande.paiement': { verbe: 'a enregistré le paiement de la commande', nom: 'Paiement de commande' },
  'commande.note': { verbe: 'a annoté la commande', nom: 'Note de commande' },
  'facture.paiement': { verbe: 'a enregistré le règlement de la facture', nom: 'Règlement de facture' },
  'stock.mouvement': { verbe: 'a mis à jour le stock de', nom: 'Mouvement de stock' },
  'produit.modification': { verbe: 'a modifié le produit', nom: 'Produit modifié' },
  'message.creation': { verbe: 'a enregistré le message', site: 'a reçu le message', pro: 'a envoyé le message', nom: 'Message reçu' },
  'message.reponse': { verbe: 'a répondu au message', pro: 'a répondu au message', nom: 'Réponse à un message' },
  'message.modification': { verbe: 'a classé le message', nom: 'Message classé' },
  'demande.creation': { verbe: 'a enregistré la demande', site: 'a reçu la demande', nom: 'Demande pro reçue' },
  'demande.acceptation': { verbe: 'a accepté la demande', nom: 'Demande pro acceptée' },
  'demande.refus': { verbe: 'a refusé la demande', nom: 'Demande pro refusée' },
  'demande.modification': { verbe: 'a mis à jour la demande', nom: 'Demande pro modifiée' },
  'reservation.creation': { verbe: 'a enregistré la réservation', site: 'a reçu la réservation', nom: 'Réservation' },
  'reservation.modification': { verbe: 'a mis à jour la réservation', nom: 'Réservation modifiée' },
  'seance.creation': { verbe: 'a ajouté la séance du', nom: 'Séance ajoutée' },
  'seance.modification': { verbe: 'a modifié la séance du', nom: 'Séance modifiée' },
  'campagne.creation': { verbe: 'a rédigé la campagne', nom: 'Campagne créée' },
  'campagne.modification': { verbe: 'a modifié la campagne', nom: 'Campagne modifiée' },
  'campagne.envoi': { verbe: 'a envoyé la campagne', nom: 'Campagne envoyée' },
  'campagne.suppression': { verbe: 'a supprimé la campagne', sansLien: true, nom: 'Campagne supprimée' },
  'abonne.inscription': { verbe: 'a inscrit {} à la newsletter', nom: 'Inscription à la newsletter' },
  'abonne.desinscription': { verbe: 'a désinscrit {} de la newsletter', nom: 'Désinscription' },
  'abonne.suppression': { verbe: 'a effacé un abonné (RGPD)', sansObjet: true, nom: 'Abonné supprimé' },
  'client.creation': { verbe: 'a créé la fiche de', nom: 'Client créé' },
  'client.modification': { verbe: 'a mis à jour la fiche de', nom: 'Client modifié' },
  'client.suppression': { verbe: 'a effacé une fiche client (RGPD)', sansObjet: true, nom: 'Client supprimé (RGPD)' },
  'compte.creation': { verbe: 'a ouvert le compte pro', nom: 'Compte pro ouvert' },
  'compte.modification': { verbe: 'a modifié le compte', nom: 'Compte pro modifié' },
  'compte.invitation': { verbe: 'a invité un utilisateur pour {}', nom: 'Invitation espace pro' },
  'promo.creation': { verbe: 'a créé le code promo', nom: 'Code promo créé' },
  'promo.modification': { verbe: 'a modifié le code promo', nom: 'Code promo modifié' },
  'parametres.modification': { verbe: 'a modifié les paramètres', nom: 'Paramètres' },
  'equipe.invitation': { verbe: 'a invité {} dans l’équipe', nom: 'Invitation d’un membre' },
  'equipe.modification': { verbe: 'a modifié l’accès de', nom: 'Équipe modifiée' },
  'utilisateur.connexion': { verbe: '· connexion', nom: 'Connexion' },
  'utilisateur.activation': { verbe: '· accès activé', nom: 'Activation d’un accès' },
  'utilisateur.mot-de-passe': { verbe: '· mot de passe changé', nom: 'Mot de passe' },
  'demo.reinitialisation': { verbe: 'a réinitialisé la démo', nom: 'Démo réinitialisée' },
};
