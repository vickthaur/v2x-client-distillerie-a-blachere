// Adresses du CRM pour les éléments du modèle (journal, recherche, tableau de bord).
import { lundi } from './format.js';

export const COULEURS = {
  enLigne: '#1f56a8',
  pro: '#d94f97',
  serie: ['#1f56a8', '#eb6834', '#1baf7a', '#eda100', '#d94f97'],
};

export function lienDe(type, id, extra = {}) {
  if (!type) return null;
  switch (type) {
    case 'commande':
    case 'facture':
      return id ? `/crm/commandes/${id}` : '/crm/commandes';
    case 'client':
      return id ? `/crm/clients/${id}` : '/crm/clients';
    case 'compte':
      return id ? `/crm/comptes/${id}` : '/crm/comptes';
    case 'demande':
      return id ? `/crm/demandes/${id}` : '/crm/demandes';
    case 'message':
      return id ? `/crm/messages/${id}` : '/crm/messages';
    case 'reservation':
    case 'seance':
    case 'visite':
      if (extra.date) return `/crm/visites?semaine=${lundi(extra.date)}${extra.seanceId ? `&seance=${extra.seanceId}` : ''}`;
      return id ? `/crm/visites/${id}` : '/crm/visites';
    case 'produit':
    case 'stock':
      return id ? `/crm/produits/${id}` : '/crm/produits';
    case 'campagne':
      return id ? `/crm/newsletter/campagnes/${id}` : '/crm/newsletter';
    case 'abonne':
      return id ? `/crm/newsletter/${id}` : '/crm/newsletter';
    case 'promo':
      return '/crm/promos';
    case 'courriel':
      return id ? `/crm/courriels/${id}` : '/crm/courriels';
    case 'utilisateur':
    case 'membre':
      return '/crm/equipe';
    case 'parametres':
      return '/crm/parametres';
    default:
      return null;
  }
}

// Adresse renvoyée par l'API (« /crm/… ») ou reconstruite depuis une cible du journal
export const lienCible = (cible) => (cible?.url && cible.url.startsWith('/crm') ? cible.url : lienDe(cible?.type, cible?.id, cible));
