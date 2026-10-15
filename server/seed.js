// Jeu de démonstration (docs/crm-espace-pro.md, § 4) : déterministe pour une démo et une date de
// création données (générateur pseudo-aléatoire tiré de l'identifiant de la démo, un flux par
// rubrique), dates relatives au jour de création. Données fictives (personnes, établissements,
// adresses e-mail en domaines réservés, numéros de téléphone des plages réservées à la fiction,
// SIRET qui ne passent pas la clé de Luhn), catalogue et prix TTC officiels. Aucun indicateur n'est
// écrit en dur : le tableau de bord calcule tout depuis ces données.
import { prng } from './aleatoire.js';
import { PRODUITS, produit as produitDe } from './catalogue.js';
import * as C from './courriels.js';
import { auteur, auteurCourt, nomComplet, PAR_SITE, PAR_SYSTEME } from './evenements.js';
import {
  actionParDefaut,
  commandeComplete,
  compacterAbonne,
  compacterClient,
  compacterCommande,
  compacterReservation,
  compacterSeance,
  index,
  ligneComplete,
  totauxCommande,
} from './modele.js';
import { operationPourCommande } from './operation.js';
import {
  appliquerPromo,
  colisageParDefaut,
  echeance,
  fraisLivraison,
  fraisPortPro,
  jourDeVisite,
  libelleSeance,
  numero,
  PARAMETRES_DEFAUT,
  prixCompteHT,
  prixProReference,
  versCentimes,
} from './regles.js';
import { ajouterJours, heureParis, instantParis, iso, jourParis, jourSemaine, JOUR_MS } from './temps.js';

// ---------- Référentiels fictifs ----------

const PRENOMS = [
  'Camille', 'Julie', 'Sophie', 'Claire', 'Manon', 'Chloé', 'Laura', 'Pauline', 'Élodie', 'Marion', 'Céline', 'Aurélie', 'Mathilde', 'Lucie',
  'Anaïs', 'Émilie', 'Sandrine', 'Isabelle', 'Nathalie', 'Valérie', 'Agnès', 'Brigitte', 'Martine', 'Odile', 'Margaux', 'Inès', 'Juliette',
  'Nicolas', 'Julien', 'Sébastien', 'Mathieu', 'Antoine', 'Romain', 'Guillaume', 'Maxime', 'Alexandre', 'Florian', 'Kévin', 'Jérôme',
  'Olivier', 'Laurent', 'Philippe', 'Christophe', 'Frédéric', 'Pierre', 'Bernard', 'Michel', 'Alain', 'Gérard', 'Yves', 'Lucas', 'Hugo',
  'Théo', 'Baptiste', 'Quentin', 'Arnaud', 'Damien', 'Bruno', 'Patrice', 'Rémi',
];
const NOMS = [
  'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre',
  'Michel', 'David', 'Bertrand', 'Vincent', 'Fournier', 'Girard', 'André', 'Lefèvre', 'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'François',
  'Legrand', 'Faure', 'Rousseau', 'Blanc', 'Guérin', 'Henry', 'Roussel', 'Perrin', 'Morin', 'Mathieu', 'Clément', 'Gauthier', 'Dumont',
  'Fontaine', 'Robin', 'Masson', 'Boyer', 'Denis', 'Lemaire', 'Duval', 'Joly', 'Roche', 'Meunier', 'Marchand', 'Dufour', 'Blanchard',
  'Barbier', 'Brun', 'Dumas', 'Brunet', 'Colin', 'Renard', 'Arnaud', 'Rolland', 'Aubert', 'Giraud', 'Vidal', 'Bourgeois', 'Renaud',
  'Picard', 'Gaillard', 'Audibert', 'Bonnefoy', 'Chabaud', 'Daumas', 'Estève', 'Jullien', 'Pellegrin', 'Sauvan', 'Tardieu', 'Reynaud',
  'Castel', 'Pons', 'Bérenger', 'Gras', 'Vaillant', 'Abeille', 'Aillaud', 'Barral', 'Coulomb', 'Granier',
];
const RUES = [
  'rue de la République', 'avenue Jean-Jaurès', 'boulevard Gambetta', 'rue Victor-Hugo', 'place du Marché', 'chemin des Vignes',
  'rue des Lilas', 'avenue de la Gare', 'rue du Portail', 'impasse des Oliviers', 'rue des Écoles', 'allée des Cigales',
  'rue Pasteur', 'avenue Frédéric-Mistral', 'chemin des Garrigues', 'rue du Moulin', 'place de l’Église', 'rue des Remparts',
  'avenue des Platanes', 'rue de la Fontaine', 'chemin de la Sorgue', 'rue Saint-Michel', 'boulevard des Arènes', 'rue du Four',
];
// Villes et codes postaux : Vaucluse, Gard, Bouches-du-Rhône (clients et comptes pro de la région),
// puis le reste de la France métropolitaine (boutique en ligne).
const VILLES_REGION = [
  ['Avignon', '84000'], ['Orange', '84100'], ['Carpentras', '84200'], ['Cavaillon', '84300'], ['L’Isle-sur-la-Sorgue', '84800'],
  ['Arles', '13200'], ['Nîmes', '30000'], ['Uzès', '30700'], ['Aix-en-Provence', '13100'], ['Apt', '84400'],
  ['Vaison-la-Romaine', '84110'], ['Sorgues', '84700'], ['Villeneuve-lès-Avignon', '30400'], ['Pertuis', '84120'], ['Bédarrides', '84370'],
  ['Le Pontet', '84130'], ['Monteux', '84170'], ['Pernes-les-Fontaines', '84210'], ['Bollène', '84500'], ['Beaucaire', '30300'],
  ['Saint-Rémy-de-Provence', '13210'], ['Tarascon', '13150'], ['Châteauneuf-du-Pape', '84230'], ['Courthézon', '84350'], ['Valréas', '84600'],
];
const VILLES_FRANCE = [
  ['Marseille', '13006'], ['Montpellier', '34000'], ['Lyon', '69003'], ['Paris', '75011'], ['Grenoble', '38000'], ['Toulouse', '31000'],
  ['Nice', '06000'], ['Valence', '26000'], ['Montélimar', '26200'], ['Bordeaux', '33000'], ['Nantes', '44000'], ['Lille', '59000'],
  ['Dijon', '21000'], ['Clermont-Ferrand', '63000'], ['Annecy', '74000'], ['Rennes', '35000'], ['Toulon', '83000'], ['Strasbourg', '67000'],
];
const DOMAINES = ['example.com', 'example.org', 'example.net'];

// Personnel (comptes de démonstration du § 3, mot de passe commun « Distillerie1835 »).
const PERSONNEL = [
  { cle: 'direction', prenom: 'Hélène', nom: 'Garnier', email: 'direction@blachere.example', role: 'direction', poste: 'Direction', telephone: '04 65 71 20 01', demo: true, anciennete: 1900 },
  { cle: 'commercial', prenom: 'Thomas', nom: 'Roux', email: 'commercial@blachere.example', role: 'commercial', poste: 'Commercial Vaucluse et Gard', telephone: '06 39 98 20 02', demo: true, anciennete: 1300 },
  { cle: 'logistique', prenom: 'Karim', nom: 'Benali', email: 'logistique@blachere.example', role: 'logistique', poste: 'Expéditions et stocks', telephone: '04 65 71 20 03', demo: true, anciennete: 1100 },
  { cle: 'boutique', prenom: 'Léa', nom: 'Fabre', email: 'boutique@blachere.example', role: 'boutique', poste: 'Boutique et visites', telephone: '04 65 71 20 04', demo: true, anciennete: 800 },
  { cle: 'commercial-13', prenom: 'Nadia', nom: 'Chevalier', email: 'nadia.chevalier@blachere.example', role: 'commercial', poste: 'Commerciale Bouches-du-Rhône', telephone: '06 39 98 20 05', anciennete: 500 },
  { cle: 'ancien', prenom: 'Paul', nom: 'Mercier', email: 'paul.mercier@blachere.example', role: 'logistique', poste: 'Préparateur (saison 2025)', actif: false, anciennete: 420 },
];

// Comptes pro (fictifs). poids : part des commandes ; saison : mois où le compte commande.
const COMPTES = [
  { cle: 'platanes', enseigne: 'Café des Platanes', raisonSociale: 'SARL Les Platanes d’Avignon', type: 'chr', ville: 'Avignon', licence: 'licence-iv', grille: 'chr', remise: 3, conditions: '30j-fdm', encoursMax: 4000, commercial: 'commercial', poids: 6, origine: 'commercial', email: 'contact@cafe-des-platanes.example', anciennete: 2100, tags: ['terrasse', 'PAC', 'fidèle'], notes: 'Café-brasserie avec grande terrasse : gros volumes de PAC Citron et de Fun Blue l’été. Livraison le matin avant 11 h, accès par la cour.', utilisateurs: [{ prenom: 'Julien', nom: 'Morel', email: 'julien@cafe-des-platanes.example', demo: true }, { prenom: 'Camille', nom: 'Morel', email: 'camille@cafe-des-platanes.example', invite: true }] },
  { cle: 'zinc', enseigne: 'Le Zinc des Remparts', raisonSociale: 'SAS Zinc des Remparts', type: 'chr', ville: 'Villeneuve-lès-Avignon', licence: 'licence-iv', grille: 'chr', remise: 0, conditions: 'comptant', encoursMax: 1500, commercial: 'commercial', poids: 5, origine: 'salon', anciennete: 900, tags: ['bar'], notes: 'Bar à cocktails : sirops Couleur Provence pour la carte sans alcool.', utilisateurs: [{ prenom: 'Sébastien', nom: 'Audibert' }] },
  { cle: 'cours', enseigne: 'Bar du Cours Fleuri', raisonSociale: 'EURL Cours Fleuri', type: 'chr', ville: 'Orange', licence: 'licence-iv', grille: 'chr', remise: 2, conditions: '30j-fdm', encoursMax: 2000, commercial: 'commercial', poids: 5, origine: 'commercial', anciennete: 1500, tags: ['terrasse'], notes: '', utilisateurs: [{ prenom: 'Martine', nom: 'Chabaud' }] },
  { cle: 'fontaine', enseigne: 'Brasserie de la Fontaine Haute', raisonSociale: 'SARL Fontaine Haute', type: 'chr', ville: 'Carpentras', licence: 'licence-iv', grille: 'chr', remise: 2, conditions: 'prelevement', encoursMax: 2500, commercial: 'commercial', poids: 4, origine: 'site', anciennete: 700, tags: ['marché du vendredi'], notes: 'Commande souvent la veille du marché.', utilisateurs: [{ prenom: 'Arnaud', nom: 'Pellegrin' }] },
  { cle: 'mas', enseigne: 'La Table du Mas Fleuri', raisonSociale: 'SARL Mas Fleuri Restauration', type: 'chr', ville: 'Uzès', licence: 'licence-restaurant', grille: 'chr', remise: 0, conditions: '30j-fdm', encoursMax: 2000, commercial: 'commercial', poids: 3, origine: 'site', anciennete: 104, tags: ['restaurant', 'nouveau'], notes: 'Compte ouvert après une demande sur le site.', utilisateurs: [{ prenom: 'Inès', nom: 'Barral' }] },
  { cle: 'lavoir', enseigne: 'Bistrot du Vieux Lavoir', raisonSociale: 'SAS Vieux Lavoir', type: 'chr', ville: 'Arles', licence: 'licence-restaurant', grille: 'chr', remise: 0, conditions: '45j', encoursMax: 1500, commercial: 'commercial-13', poids: 3, origine: 'commercial', anciennete: 1200, tags: ['relance'], notes: 'Paie parfois en retard : relancer à l’échéance.', utilisateurs: [{ prenom: 'Rémi', nom: 'Coulomb' }] },
  { cle: 'olivier', enseigne: 'L’Olivier Bleu', raisonSociale: 'SARL L’Olivier Bleu', type: 'chr', ville: 'Aix-en-Provence', licence: 'petite-licence-restaurant', grille: 'chr', remise: 0, conditions: 'comptant', encoursMax: 1000, commercial: 'commercial-13', poids: 1, origine: 'salon', anciennete: 1000, statut: 'suspendu', suspenduDepuis: 60, tags: ['fermé'], notes: 'Établissement fermé pour travaux jusqu’au printemps : compte suspendu à sa demande.', utilisateurs: [{ prenom: 'Margaux', nom: 'Granier' }] },
  { cle: 'cypres', enseigne: 'Hôtel des Trois Cyprès', raisonSociale: 'SAS Hôtel des Trois Cyprès', type: 'hotel', ville: 'Vaison-la-Romaine', licence: 'licence-iv', grille: 'chr', remise: 5, conditions: '30j-fdm', encoursMax: 4000, commercial: 'commercial', poids: 4, origine: 'commercial', anciennete: 1700, tags: ['hôtel', 'bar'], notes: 'Bar de l’hôtel et petits-déjeuners (sirops).', utilisateurs: [{ prenom: 'Olivier', nom: 'Tardieu' }] },
  { cle: 'sources', enseigne: 'Hôtel Mas des Sources', raisonSociale: 'SARL Mas des Sources', type: 'hotel', ville: 'L’Isle-sur-la-Sorgue', licence: 'licence-restaurant', grille: 'chr', remise: 4, conditions: '45j', encoursMax: 3500, commercial: 'commercial', poids: 4, origine: 'salon', anciennete: 1300, tags: ['hôtel', 'restaurant'], notes: '', utilisateurs: [{ prenom: 'Claire', nom: 'Bonnefoy' }] },
  { cle: 'ouveze', enseigne: 'Camping Les Rives de l’Ouvèze', raisonSociale: 'SAS Rives de l’Ouvèze', type: 'camping', ville: 'Bédarrides', licence: 'petite-licence-restaurant', grille: 'chr', remise: 3, conditions: 'comptant', encoursMax: 3000, commercial: 'commercial', poids: 5, origine: 'commercial', anciennete: 1400, saison: [4, 9], tags: ['saisonnier', 'snack'], notes: 'Ouvert d’avril à septembre : snack et épicerie du camping.', utilisateurs: [{ prenom: 'Bruno', nom: 'Aillaud' }] },
  { cle: 'chenes', enseigne: 'Camping Les Chênes Verts', raisonSociale: 'SARL Les Chênes Verts', type: 'camping', ville: 'Apt', licence: 'aucune', grille: 'chr', remise: 0, conditions: 'comptant', encoursMax: 1500, commercial: 'commercial', poids: 4, origine: 'site', anciennete: 600, saison: [4, 9], tags: ['saisonnier', 'sans alcool'], notes: 'Pas de licence : sirops seulement (les spiritueux sont masqués dans son catalogue).', utilisateurs: [{ prenom: 'Patrice', nom: 'Gras' }] },
  { cle: 'flacons', enseigne: 'La Cave aux Cent Flacons', raisonSociale: 'SARL Cent Flacons', type: 'caviste', ville: 'Avignon', licence: 'vente-a-emporter', grille: 'caviste', remise: 0, conditions: '30j-fdm', encoursMax: 3000, commercial: 'commercial', poids: 5, origine: 'commercial', anciennete: 2500, tags: ['caviste', 'coffrets'], notes: 'Vitrine de fin d’année : coffrets et vieux marcs.', utilisateurs: [{ prenom: 'Laurent', nom: 'Vaillant' }] },
  { cle: 'cep', enseigne: 'Le Cep et la Grappe', raisonSociale: 'EURL Cep et Grappe', type: 'caviste', ville: 'Nîmes', licence: 'vente-a-emporter', grille: 'caviste', remise: 2, conditions: '30j-fdm', encoursMax: 2500, commercial: 'commercial', poids: 4, origine: 'salon', anciennete: 1600, tags: ['caviste'], notes: '', utilisateurs: [{ prenom: 'Agnès', nom: 'Estève' }] },
  { cle: 'luberon', enseigne: 'Vins et Alambics du Luberon', raisonSociale: 'SARL Alambics du Luberon', type: 'caviste', ville: 'Cavaillon', licence: 'vente-a-emporter', grille: 'caviste', remise: 0, conditions: '45j', encoursMax: 2500, commercial: 'commercial', poids: 4, origine: 'site', anciennete: 112, tags: ['caviste', 'nouveau'], notes: 'Compte ouvert après une demande sur le site.', utilisateurs: [{ prenom: 'Florian', nom: 'Reynaud' }] },
  { cle: 'marche', enseigne: 'Les Saveurs du Marché Couvert', raisonSociale: 'SAS Saveurs du Marché', type: 'epicerie', ville: 'Aix-en-Provence', licence: 'vente-a-emporter', grille: 'caviste', remise: 0, conditions: 'comptant', encoursMax: 1500, commercial: 'commercial-13', poids: 3, origine: 'salon', anciennete: 950, tags: ['épicerie fine'], notes: '', utilisateurs: [{ prenom: 'Nathalie', nom: 'Abeille' }] },
  { cle: 'gardemanger', enseigne: 'Le Garde-Manger d’Uzès', raisonSociale: 'EURL Garde-Manger', type: 'epicerie', ville: 'Uzès', licence: 'vente-a-emporter', grille: 'caviste', remise: 0, conditions: '30j-fdm', encoursMax: 1500, commercial: 'commercial', poids: 3, origine: 'commercial', anciennete: 800, tags: ['épicerie fine', 'touristes'], notes: 'Clientèle de passage : parfums de Provence (lavande, violette, figue).', utilisateurs: [{ prenom: 'Yves', nom: 'Castel' }] },
  { cle: 'rhodanien', enseigne: 'Comptoir Rhodanien des Boissons', raisonSociale: 'SAS Comptoir Rhodanien des Boissons', type: 'distributeur', ville: 'Sorgues', licence: 'vente-a-emporter', grille: 'distributeur', remise: 0, conditions: '45j', encoursMax: 15000, francoHT: 600, commercial: 'commercial', poids: 7, origine: 'commercial', anciennete: 3000, tags: ['distributeur', 'volumes'], notes: 'Distributeur de boissons pour les cafés et restaurants du Vaucluse : palettes de PAC Citron et de Fun Blue.', utilisateurs: [{ prenom: 'Frédéric', nom: 'Daumas' }] },
];

// Assortiments des comptes pro (slugs pondérés).
const ASSORTIMENTS = {
  chr: [['pac-citron', 10], ['fun-blue', 8], ['sirop-couleur-provence-grenadine', 5], ['sirop-menthe', 5], ['sirop-couleur-provence-orgeat', 4], ['sirop-citron', 3], ['sirop-fraise', 3], ['sirop-peche', 2], ['sirop-couleur-provence-cola', 2], ['sucre-de-canne', 3], ['pastis-marra', 4], ['pastis-le-camarguais', 3], ['creme-de-cassis', 2], ['aperitif-lou-gardian', 1]],
  hotel: [['pac-citron', 6], ['fun-blue', 4], ['sirop-couleur-provence-grenadine', 3], ['sirop-lavande', 3], ['sirop-couleur-provence-violette', 2], ['sirop-framboise', 2], ['vieux-marc-de-provence-gros-calan', 2], ['elixir-du-mont-ventoux', 2], ['la-camarguaise', 2], ['liqueur-de-lavande', 2], ['pastis-marra', 2]],
  camping: [['pac-citron', 10], ['fun-blue', 9], ['sirop-couleur-provence-grenadine', 5], ['sirop-menthe', 5], ['sirop-fraise', 3], ['sirop-melon', 2], ['sirop-peche', 2], ['pastis-le-camarguais', 3], ['pastis-marra', 2]],
  caviste: [['pastis-marra', 4], ['elixir-du-mont-ventoux', 4], ['la-camarguaise', 4], ['vieux-marc-de-provence-gros-calan', 3], ['marc-chateauneuf-du-pape-reserve-des-legats', 3], ['verveine-l-ardechoise', 2], ['origan-du-comtat', 2], ['la-comtadine', 2], ['eau-de-vie-poire-williams-flirt', 2], ['creme-de-chataigne', 2], ['marc-elixir-millesime-2003', 1], ['marc-elixir-millesime-1990', 1], ['sirop-lavande', 2], ['pac-citron', 3]],
  epicerie: [['sirop-lavande', 4], ['sirop-couleur-provence-violette', 4], ['sirop-couleur-provence-figue', 3], ['sirop-couleur-provence-reglisse', 2], ['sirop-melon', 2], ['sirop-chataigne', 2], ['sirop-caramel-fleur-de-sel-camargue', 3], ['pac-citron', 4], ['fun-blue', 3], ['creme-de-chataigne', 2], ['liqueur-de-lavande', 2], ['la-camarguaise', 1]],
  distributeur: [['pac-citron', 12], ['fun-blue', 10], ['sirop-couleur-provence-grenadine', 5], ['sirop-menthe', 5], ['sirop-couleur-provence-orgeat', 4], ['sirop-citron', 3], ['pastis-marra', 5], ['pastis-le-camarguais', 5], ['creme-de-cassis', 2]],
};

// ---------- Outils ----------

const sansAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').toLowerCase();
const slugifier = (s) => sansAccents(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const telFiction = (g, mobile) => (mobile ? `06 39 98 ${g.chiffres(2)} ${g.chiffres(2)}` : `04 65 71 ${g.chiffres(2)} ${g.chiffres(2)}`);

// SIRET fictif : 14 chiffres qui échouent à la clé de Luhn (aucun établissement réel ne l'a).
function siretFictif(g) {
  for (;;) {
    const s = `9${g.chiffres(13)}`;
    let total = 0;
    for (let i = 0; i < 14; i++) {
      let d = Number(s[13 - i]);
      if (i % 2 === 1) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      total += d;
    }
    if (total % 10 !== 0) return s;
  }
}
const tvaDeSiret = (siret) => {
  const siren = Number(siret.slice(0, 9));
  return `FR${String((12 + 3 * (siren % 97)) % 97).padStart(2, '0')}${siret.slice(0, 9)}`;
};

// Saison : facteur d'activité par mois (1 = janvier).
const SAISON_VENTES = [0, 0.6, 0.6, 0.7, 0.85, 1, 1.3, 1.5, 1.45, 1, 0.95, 1.25, 1.8];
const ete = (m) => (m >= 6 && m <= 8 ? 1.7 : m === 5 || m === 9 ? 1.2 : 0.8);
const fetes = (m) => (m === 12 ? 3 : m === 11 ? 2.2 : m === 10 ? 1.1 : 0.6);

// ---------- Génération ----------

// options : { id, maintenant (Date), hache (mot de passe des comptes de démonstration), jetons() → { jeton, hache } }
export function genererDemo({ id, maintenant, hache, jetons }) {
  const instant = new Date(maintenant);
  const nowMs = instant.getTime();
  const aujourdhui = jourParis(instant);
  const g = (rubrique) => prng(`${id}:${rubrique}`);
  const params = structuredClone(PARAMETRES_DEFAUT);

  // Instant aléatoire un jour donné, entre deux heures de Paris, jamais dans le futur.
  const instantDuJour = (r, jour, de = 8, a = 21) => {
    const minutes = r.entier(de * 60, a * 60 - 1);
    const t = instantParis(jour, `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`).getTime();
    return Math.min(t, nowMs - r.entier(3, 40) * 60000);
  };
  const versIso = (ms) => iso(ms);

  const doc = {
    v: 1,
    id,
    createdAt: iso(instant),
    updatedAt: iso(instant),
    seq: { web: 0, pro: 0, facture: 0, visite: 0, demande: 0, message: 0 },
    parametres: params,
    utilisateurs: [],
    comptes: [],
    clients: [],
    commandes: [],
    produits: {},
    mouvements: [],
    demandes: [],
    seances: [],
    reservations: [],
    messages: [],
    abonnes: [],
    campagnes: [],
    promos: [],
    courriels: [],
    journal: [],
    vu: {},
  };

  // ----- Personnel -----
  const gu = g('utilisateurs');
  const staff = {};
  for (const p of PERSONNEL) {
    const u = {
      id: gu.id('usr'),
      prenom: p.prenom,
      nom: p.nom,
      email: p.email,
      role: p.role,
      poste: p.poste,
      telephone: p.telephone,
      actif: p.actif !== false,
      hash: hache,
      sessionVersion: 0,
      echecs: { n: 0 },
      createdAt: iso(nowMs - p.anciennete * JOUR_MS),
    };
    if (p.demo) u.demo = true;
    if (u.actif) u.derniereConnexion = iso(nowMs - gu.entier(1, 30) * 3600000);
    staff[p.cle] = u;
    doc.utilisateurs.push(u);
  }
  const quiPrepare = () => staff.logistique;
  const quiBoutique = () => staff.boutique;

  // ----- Comptes pro et leurs utilisateurs -----
  const gc = g('comptes');
  const comptes = {};
  const usagersPro = {};
  for (const def of COMPTES) {
    const [ville, cp] = VILLES_REGION.find(([v]) => v === def.ville);
    const adresse = { ligne1: `${gc.entier(2, 48)} ${gc.choix(RUES)}`, cp, ville, pays: 'France' };
    const siret = siretFictif(gc);
    const compte = {
      id: gc.id('cpt'),
      raisonSociale: def.raisonSociale,
      enseigne: def.enseigne,
      type: def.type,
      siret,
      tvaIntra: tvaDeSiret(siret),
      licence: def.licence,
      telephone: telFiction(gc, false),
      email: def.email || `${slugifier(def.enseigne)}@${gc.choix(DOMAINES)}`,
      adresseFacturation: adresse,
      adressesLivraison: [{ id: gc.id('adr'), nom: def.enseigne, ...adresse, instructions: def.cle === 'platanes' ? 'Livraison avant 11 h, accès par la cour.' : undefined }],
      statut: def.statut || 'actif',
      grille: def.grille,
      remise: def.remise,
      conditions: def.conditions,
      francoHT: def.francoHT || params.pro.francoHT,
      encoursMax: def.encoursMax,
      commercialId: staff[def.commercial].id,
      tags: def.tags,
      notes: def.notes,
      origine: def.origine,
      createdAt: iso(nowMs - def.anciennete * JOUR_MS),
    };
    if (!compte.adressesLivraison[0].instructions) delete compte.adressesLivraison[0].instructions;
    if (def.cle === 'platanes') {
      compte.adressesLivraison.push({ id: gc.id('adr'), nom: 'Kiosque des Platanes (été)', ligne1: `${gc.entier(2, 30)} allée des Platanes`, cp, ville, pays: 'France', instructions: 'Kiosque ouvert de juin à septembre.' });
    }
    comptes[def.cle] = compte;
    doc.comptes.push(compte);
    usagersPro[def.cle] = [];
    for (const up of def.utilisateurs) {
      const u = {
        id: gc.id('usr'),
        prenom: up.prenom,
        nom: up.nom,
        email: up.email || `${slugifier(up.prenom)}.${slugifier(up.nom)}@${gc.choix(DOMAINES)}`,
        role: 'pro',
        compteId: compte.id,
        telephone: telFiction(gc, true),
        actif: true,
        sessionVersion: 0,
        echecs: { n: 0 },
        createdAt: compte.createdAt,
      };
      if (up.demo) u.demo = true;
      if (up.invite) {
        // invitation en cours (le courriel d'invitation est dans la boîte d'envoi)
        u.createdAt = iso(nowMs - 2 * JOUR_MS);
      } else {
        u.hash = hache;
        u.derniereConnexion = iso(nowMs - gc.entier(1, 20) * JOUR_MS);
      }
      usagersPro[def.cle].push(u);
      doc.utilisateurs.push(u);
    }
  }

  // ----- Produits de la démo (prix, stocks, seuils, colisages) -----
  const gp = g('produits');
  const rupturePossible = [
    ['sirop-couleur-provence-violette', '700'],
    ['sirop-caramel-fleur-de-sel-camargue', '500'],
    ['creme-de-myrtille', '500'],
    ['sirop-couleur-provence-kiwi', '700'],
    ['la-camarguaise', '1500'],
    ['marc-elixir-millesime-1958', '500'],
  ];
  const rupture = gp.choix(rupturePossible);
  const candidatsBas = PRODUITS.flatMap((p) => p.variantes.map((v) => [p.slug, v.id])).filter(
    ([s, v]) => !['pac-citron', 'fun-blue'].includes(s) && !(s === rupture[0] && v === rupture[1]),
  );
  const bas = new Set(gp.melanger(candidatsBas).slice(0, 5).map(([s, v]) => `${s}|${v}`));
  for (const p of PRODUITS) {
    const variantes = {};
    for (const v of p.variantes) {
      const marque = p.slug === 'pac-citron' || p.slug === 'fun-blue';
      let seuil;
      let stock;
      if (marque) [seuil, stock] = [120, gp.entier(p.slug === 'pac-citron' ? 640 : 480, p.slug === 'pac-citron' ? 920 : 720)];
      else if (p.plat) [seuil, stock] = [2, gp.entier(3, 14)];
      else if (v.coffret) [seuil, stock] = [6, gp.entier(10, 48)];
      else if (!p.alcool) [seuil, stock] = [24, v.ml >= 1000 ? gp.entier(70, 260) : gp.entier(40, 180)];
      else if (v.ml >= 1500) [seuil, stock] = [6, gp.entier(8, 40)];
      else [seuil, stock] = [12, gp.entier(24, 120)];
      if (bas.has(`${p.slug}|${v.id}`)) stock = gp.entier(1, seuil);
      if (p.slug === rupture[0] && v.id === rupture[1]) stock = 0;
      variantes[v.id] = { prixTTC: v.prixTTC, prixProHT: prixProReference(v.prixTTC, p.tva), stock, seuil, colisage: colisageParDefaut(v, p) };
    }
    doc.produits[p.slug] = { actif: true, variantes };
  }

  // ----- Clients particuliers -----
  const gk = g('clients');
  const emails = new Set(doc.utilisateurs.map((u) => u.email));
  const nouvelEmail = (prenom, nom, r) => {
    const base = `${slugifier(prenom)}.${slugifier(nom)}`;
    let e = `${base}@${r.choix(DOMAINES)}`;
    let n = 2;
    while (emails.has(e)) e = `${base}${n++}@${r.choix(DOMAINES)}`;
    emails.add(e);
    return e;
  };
  const ORIGINES = [['boutique-en-ligne', 60], ['boutique', 15], ['visite', 12], ['newsletter', 5], ['salon', 8]];
  const TAGS_CLIENTS = ['cadeaux', 'PAC', 'Fun Blue', 'spiritueux', 'recettes', 'visite', 'comité d’entreprise'];
  const nomsPris = new Set();
  for (let i = 0; i < 90; i++) {
    let prenom;
    let nom;
    do {
      prenom = gk.choix(PRENOMS);
      nom = gk.choix(NOMS);
    } while (nomsPris.has(`${prenom} ${nom}`) || ['Garnier', 'Roux', 'Benali', 'Fabre', 'Morel'].includes(nom));
    nomsPris.add(`${prenom} ${nom}`);
    const local = gk.chance(0.55);
    const [ville, cp] = gk.choix(local ? VILLES_REGION : VILLES_FRANCE);
    const client = {
      id: gk.id('cli'),
      prenom,
      nom,
      email: nouvelEmail(prenom, nom, gk),
      telephone: telFiction(gk, true),
      adresse: { ligne1: `${gk.entier(1, 120)} ${gk.choix(RUES)}`, cp, ville, pays: 'France' },
      newsletter: gk.chance(0.42),
      tags: gk.chance(0.3) ? [gk.choix(TAGS_CLIENTS)] : [],
      notes: '',
      origine: gk.pondere(ORIGINES, (o) => o[1])[0],
      createdAt: iso(nowMs - gk.entier(130, 1100) * JOUR_MS - gk.entier(0, 86399) * 1000),
    };
    doc.clients.push(client);
  }
  const notesClients = ['Commande chaque été pour la famille.', 'Préfère le retrait à la distillerie.', 'A visité la distillerie avec un groupe.', 'Offre des coffrets à ses clients en fin d’année.'];
  for (let i = 0; i < 4; i++) doc.clients[i * 7 + 3].notes = notesClients[i];

  // ----- Commandes en ligne (forme stockée compacte, voir modele.js) -----
  const go = g('commandes-en-ligne');
  const JOURS_FENETRE = 120;
  const joursFenetre = Array.from({ length: JOURS_FENETRE }, (_, i) => ajouterJours(aujourdhui, i - (JOURS_FENETRE - 1)));
  // Créneau ouvré suivant à Paris (du lundi au samedi, 8 h – 18 h) : les étapes se font aux heures
  // de travail.
  const ouvre = (ms, r) => {
    let jour = jourParis(ms);
    const h = heureParis(ms);
    const hh = Number(h.slice(0, 2));
    let t = ms;
    if (hh < 8 || hh >= 18 || jourSemaine(jour) === 0) {
      if (hh >= 18) jour = ajouterJours(jour, 1);
      if (jourSemaine(jour) === 0) jour = ajouterJours(jour, 1);
      t = instantParis(jour, `0${r.entier(8, 9)}:${String(r.entier(0, 59)).padStart(2, '0')}`).getTime();
    }
    return t;
  };
  const poidsJourWeb = (jour) => {
    const m = Number(jour.slice(5, 7));
    const js = jourSemaine(jour);
    return SAISON_VENTES[m] * (js === 0 || js === 6 ? 1.25 : js === 1 ? 1.1 : 1);
  };
  // 148 commandes réparties sur les jours passés selon la saison, 12 dans les 72 dernières heures.
  const RECENTES_WEB = [1.2, 3.5, 8, 15, 21, 27, 33, 39, 46, 53, 61, 69];
  const anciensJours = joursFenetre.filter((j) => j <= ajouterJours(aujourdhui, -3));
  const instantsWeb = [
    ...Array.from({ length: 148 }, () => instantDuJour(go, go.pondere(anciensJours, poidsJourWeb), 7, 23)),
    ...RECENTES_WEB.map((h) => nowMs - h * 3600000 - go.entier(0, 40) * 60000),
  ].sort((a, b) => a - b);
  const poidsProduitWeb = (p, v, m) => {
    if (p.slug === 'pac-citron') return 34 * ete(m) * (m === 10 ? 1.4 : 1);
    if (p.slug === 'fun-blue') return 24 * ete(m);
    if (!p.alcool) return 2.2 * ete(m);
    if (p.plat) return 0.12 * fetes(m);
    if (v.coffret) return 0.5 * fetes(m) * (m >= 11 ? 2 : 1);
    return 0.9 * fetes(m);
  };
  const toutesVariantes = PRODUITS.filter((p) => p.enLigne).flatMap((p) => p.variantes.map((v) => ({ p, v })));
  const clientsEnLigne = doc.clients.filter((c) => c.origine === 'boutique-en-ligne' || c.origine === 'newsletter');
  const poidsClient = new Map(clientsEnLigne.map((c, i) => [c.id, 1 / (1 + (i % 17) * 0.35)]));
  const commandesWeb = [];
  const factures = [];
  const promosUtilisees = { BIENVENUE10: 0, PACETE: 0, PORTOFFERT: 0 };
  const dejaClient = new Set();
  const promosDef = [
    { code: 'BIENVENUE10', libelle: '−10 % sur votre première commande', type: 'pourcentage', valeur: 10, minimumTTC: 0, actif: true },
    { code: 'PACETE', libelle: '5 € de remise dès 40 € d’achats', type: 'montant', valeur: 5, minimumTTC: 40, actif: true, debut: ajouterJours(aujourdhui, -140), fin: ajouterJours(aujourdhui, 80), limite: 500 },
    { code: 'PORTOFFERT', libelle: 'Livraison offerte dès 60 € d’achats', type: 'livraison', valeur: 0, minimumTTC: 60, actif: true },
  ];
  for (const t of instantsWeb) {
    const jour = jourParis(t);
    const m = Number(jour.slice(5, 7));
    const client = go.pondere(clientsEnLigne, (c) => poidsClient.get(c.id));
    const nbLignes = go.pondere([1, 2, 3, 4], (n) => [45, 35, 15, 5][n - 1]);
    const choisies = new Map();
    for (let k = 0; k < nbLignes; k++) {
      const { p, v } = go.pondere(toutesVariantes, (x) => poidsProduitWeb(x.p, x.v, m));
      const cle = `${p.slug}|${v.id}`;
      if (choisies.has(cle)) continue;
      const marque = p.slug === 'pac-citron' || p.slug === 'fun-blue';
      const qte = marque ? go.pondere([1, 2, 3, 4, 6], (q) => ({ 1: 2, 2: 5, 3: 3, 4: 2, 6: 1.5 })[q]) : !p.alcool ? go.pondere([1, 2, 3], (q) => [5, 3, 1][q - 1]) : p.plat ? 1 : go.pondere([1, 2], (q) => [6, 2][q - 1]);
      choisies.set(cle, { slug: p.slug, varianteId: v.id, qte, prixUnitaireTTC: doc.produits[p.slug].variantes[v.id].prixTTC });
    }
    const lignes = [...choisies.values()];
    const completes = lignes.map((l) => ligneComplete(l, 'en-ligne'));
    const bouteilles = lignes.reduce((s, l) => s + l.qte, 0);
    const articlesTTC = completes.reduce((s, l) => s + Math.round(l.totalTTC * 100), 0) / 100;
    const mode = go.pondere(['retrait', 'colissimo', 'relais'], (x) => ({ retrait: 22, colissimo: 50, relais: 28 })[x]);
    let livraisonTTC = fraisLivraison(mode, { bouteilles, articlesTTC, parametres: params });
    // codes promo (quelques commandes)
    let promo = null;
    const tirage = go.suivant();
    const premiere = !dejaClient.has(client.id);
    let codeChoisi = null;
    if (tirage < 0.05 && premiere) codeChoisi = 'BIENVENUE10';
    else if (tirage < 0.09 && articlesTTC >= 40) codeChoisi = 'PACETE';
    else if (tirage < 0.12 && articlesTTC >= 60 && mode !== 'retrait' && livraisonTTC > 0) codeChoisi = 'PORTOFFERT';
    if (codeChoisi) {
      const def = promosDef.find((x) => x.code === codeChoisi);
      const r = appliquerPromo({ ...def, utilisations: 0 }, { articlesTTC, aujourdhui: jour });
      if (r.livraisonOfferte) {
        promo = { code: def.code, remiseTTC: livraisonTTC, livraisonOfferte: true };
        livraisonTTC = 0;
      } else promo = { code: def.code, remiseTTC: r.remiseTTC };
      promosUtilisees[def.code] += 1;
    }
    dejaClient.add(client.id);
    const paiementMode = go.pondere(['carte', 'paypal', 'virement'], (x) => ({ carte: 68, paypal: 22, virement: 10 })[x]);
    const livraison = { mode, prixTTC: livraisonTTC };
    if (mode === 'retrait') {
      let jr = ajouterJours(jour, go.entier(1, 4));
      if (jourSemaine(jr) === 0) jr = ajouterJours(jr, 1);
      livraison.jourRetrait = jr;
    } else if (mode === 'relais') {
      livraison.relais = { nom: 'Point relais de démonstration', adresse: { ligne1: `${go.entier(1, 60)} ${go.choix(RUES)}`, cp: client.adresse.cp, ville: client.adresse.ville, pays: 'France' } };
    }
    const c = {
      id: go.id('cmd'),
      numero: '',
      canal: 'en-ligne',
      clientId: client.id,
      lignes,
      livraison,
      paiement: { mode: paiementMode, statut: 'paye', date: iso(t) },
      statut: 'nouvelle',
      historique: [{ date: iso(t), statut: 'nouvelle', action: 'Commande passée sur le site', par: { ...PAR_SITE } }],
      createdAt: iso(t),
      updatedAt: iso(t),
    };
    if (promo) c.promo = promo;
    if (completes.some((l) => l.alcool)) c.ageConfirme = true;
    const op = operationPourCommande({ canal: 'en-ligne', lignes, date: t });
    if (op) c.operation = op;
    // paiement par virement : reçu le lendemain, ou encore attendu
    const age = (nowMs - t) / 3600000;
    let prochain = t;
    if (paiementMode === 'virement') {
      c.paiement.reference = `VIR-${go.chiffres(6)}`;
      if (age < 30) {
        c.paiement.statut = 'en-attente';
        delete c.paiement.date;
      } else {
        prochain = ouvre(t + go.entier(18, 28) * 3600000, go);
        c.paiement.date = iso(prochain);
        c.historique.push({ date: iso(prochain), action: 'Virement reçu', par: auteurCourt(quiBoutique()) });
      }
    }
    // avancement selon l'âge de la commande
    const etape = (statut, ms, qui, action) => {
      const h = { date: iso(ms), statut, par: qui };
      if (action) h.action = action;
      c.historique.push(h);
      c.statut = statut;
      c.updatedAt = iso(ms);
    };
    if (c.paiement.statut === 'paye') {
      const tPrep = ouvre(prochain + go.entier(10, 22) * 3600000, go);
      if (tPrep < nowMs) {
        etape('en-preparation', tPrep, auteurCourt(quiPrepare()));
        if (mode === 'retrait') {
          const veille = instantParis(ajouterJours(livraison.jourRetrait, -1), '16:30').getTime();
          const tPrete = Math.max(tPrep + 2 * 3600000, Math.min(veille, tPrep + 26 * 3600000));
          if (tPrete < nowMs) {
            etape('prete', tPrete, auteurCourt(quiBoutique()));
            let tRetrait = instantParis(livraison.jourRetrait, `${go.entier(9, 16)}:${go.choix(['05', '20', '35', '50'])}`).getTime();
            // préparée après le jour prévu : le client passe ensuite
            if (tRetrait <= tPrete) tRetrait = ouvre(tPrete + go.entier(3, 30) * 3600000, go);
            if (tRetrait < nowMs) etape('retiree', tRetrait, auteurCourt(quiBoutique()));
          }
        } else {
          const tExp = ouvre(tPrep + go.entier(2, 6) * 3600000, go);
          if (tExp < nowMs) {
            c.suivi = { transporteur: 'Colissimo', numero: `6A${go.chiffres(11)}` };
            etape('expediee', tExp, auteurCourt(quiPrepare()));
            const tLiv = ouvre(tExp + (mode === 'relais' ? go.entier(60, 100) : go.entier(30, 54)) * 3600000, go);
            if (tLiv < nowMs) etape('livree', tLiv, { ...PAR_SYSTEME }, mode === 'relais' ? 'Retirée en point relais' : null);
          }
        }
      }
    }
    commandesWeb.push(c);
    factures.push({ commande: c, date: jourParis(t), ms: t });
  }
  // Une annulation (avant préparation, stock remis) et un remboursement (colis cassé).
  const anciennes = commandesWeb.filter((c) => (nowMs - Date.parse(c.createdAt)) / JOUR_MS > 12);
  const aAnnuler = anciennes.find((c) => c.livraison.mode !== 'retrait' && c.statut === 'livree' && !c.promo && c.paiement.mode === 'carte');
  if (aAnnuler) {
    const t0 = Date.parse(aAnnuler.createdAt);
    aAnnuler.historique = aAnnuler.historique.slice(0, 1);
    delete aAnnuler.suivi;
    const tA = t0 + go.entier(2, 6) * 3600000;
    aAnnuler.historique.push({ date: iso(tA), statut: 'annulee', action: 'Annulée à la demande du client', par: auteurCourt(quiBoutique()) });
    aAnnuler.statut = 'annulee';
    aAnnuler.paiement.statut = 'rembourse';
    aAnnuler.updatedAt = iso(tA);
  }
  const aRembourser = anciennes.find((c) => c !== aAnnuler && c.statut === 'livree' && c.livraison.mode === 'colissimo' && c.lignes.some((l) => l.qte >= 2));
  if (aRembourser) {
    const tR = Math.min(ouvre(Date.parse(aRembourser.updatedAt) + go.entier(20, 70) * 3600000, go), nowMs - 3600000);
    aRembourser.historique.push({ date: iso(tR), statut: 'remboursee', action: 'Remboursée : bouteille cassée à la livraison', par: auteurCourt(staff.direction) });
    aRembourser.statut = 'remboursee';
    aRembourser.paiement.statut = 'rembourse';
    aRembourser.updatedAt = iso(tR);
  }

  // ----- Commandes pro -----
  const gr = g('commandes-pro');
  const ouvres = joursFenetre.filter((j) => jourSemaine(j) !== 0 && jourSemaine(j) !== 6 && j <= ajouterJours(aujourdhui, -4));
  const poidsJourPro = (jour) => {
    const m = Number(jour.slice(5, 7));
    return m >= 6 && m <= 8 ? 1.3 : m >= 11 ? 1.4 : 1;
  };
  // 64 commandes réparties sur les jours ouvrés passés, 6 dans les quatre derniers jours (dont deux
  // du Café des Platanes).
  const RECENTES_PRO = [
    [2.5, 'platanes'],
    [9, 'rhodanien'],
    [27, 'cep'],
    [50, 'platanes'],
    [74, 'cypres'],
    [97, 'flacons'],
  ];
  const instantsPro = [
    // historique riche du Café des Platanes (compte de démonstration) : 8 commandes garanties
    ...Array.from({ length: 64 }, (_, i) => ({ t: instantDuJour(gr, gr.pondere(ouvres, poidsJourPro), 7, 18), cle: i < 8 ? 'platanes' : null })),
    ...RECENTES_PRO.map(([h, cle]) => ({ t: nowMs - h * 3600000 - gr.entier(0, 30) * 60000, cle })),
  ].sort((a, b) => a.t - b.t);
  const commandesPro = [];
  for (const { t, cle } of instantsPro) {
    const jour = jourParis(t);
    const m = Number(jour.slice(5, 7));
    const def = cle
      ? COMPTES.find((d) => d.cle === cle)
      : gr.pondere(COMPTES, (d) => {
          const compte = comptes[d.cle];
          if (Date.parse(compte.createdAt) > t) return 0;
          if (d.statut === 'suspendu' && jour > ajouterJours(aujourdhui, -d.suspenduDepuis)) return 0;
          if (d.saison && (m < d.saison[0] || m > d.saison[1])) return 0;
          let w = d.poids;
          if ((d.type === 'caviste' || d.type === 'epicerie') && m >= 11) w *= 1.8;
          if ((d.type === 'camping' || d.type === 'hotel') && m >= 6 && m <= 8) w *= 1.5;
          return w;
        });
    const compte = comptes[def.cle];
    const usager = usagersPro[def.cle].find((u) => u.hash) || null;
    const parCommercial = !cle && gr.chance(0.2);
    const assort = ASSORTIMENTS[compte.type].filter(([s]) => compte.licence !== 'aucune' || !produitDe(s).alcool);
    const nb = compte.type === 'distributeur' ? gr.entier(3, 5) : gr.entier(2, 4);
    const choisis = new Map();
    for (let k = 0; k < nb * 2 && choisis.size < nb; k++) {
      const [slug] = gr.pondere(assort, (x) => x[1] * (produitDe(x[0]).alcool ? fetes(m) : ete(m)));
      if (choisis.has(slug)) continue;
      const p = produitDe(slug);
      const v = gr.choix(p.variantes.filter((x) => !x.coffret || compte.type === 'caviste' || compte.type === 'epicerie'));
      const cartons = compte.type === 'distributeur' ? gr.entier(4, 16) : gr.entier(1, slug === 'pac-citron' || slug === 'fun-blue' ? 4 : 2);
      choisis.set(slug, { p, v, cartons });
    }
    const construire = () =>
      [...choisis.values()].map(({ p, v, cartons }) => {
        const d = doc.produits[p.slug].variantes[v.id];
        return { slug: p.slug, varianteId: v.id, qte: cartons * d.colisage, prixUnitaireHT: prixCompteHT(d, p.tva, compte), colisage: d.colisage };
      });
    let lignes = construire();
    const articlesHTde = (ls) => ls.reduce((s, l) => s + Math.round(l.prixUnitaireHT * 100) * l.qte, 0) / 100;
    // minimum de commande : on ajoute des cartons au premier produit
    let garde = 0;
    while (articlesHTde(lignes) < params.pro.minimumHT && garde++ < 40) {
      choisis.values().next().value.cartons += 1;
      lignes = construire();
    }
    const port = fraisPortPro(articlesHTde(lignes), { francoHT: compte.francoHT, fraisPortHT: params.pro.fraisPortHT });
    const auteurCmd = parCommercial || !usager ? staff[def.commercial] : usager;
    const c = {
      id: gr.id('cmd'),
      numero: '',
      canal: 'pro',
      compteId: compte.id,
      auteurId: auteurCmd.id,
      lignes,
      livraison: { mode: 'transporteur', prixHT: port, adresseId: compte.adressesLivraison[0].id },
      paiement: { mode: compte.conditions, statut: 'en-attente' },
      statut: 'nouvelle',
      historique: [
        {
          date: iso(t),
          statut: 'nouvelle',
          action: auteurCmd.role === 'pro' ? 'Commande passée dans l’espace pro' : `Commande saisie par ${nomComplet(auteurCmd)} (téléphone)`,
          par: auteurCourt(auteurCmd),
        },
      ],
      createdAt: iso(t),
      updatedAt: iso(t),
    };
    if (gr.chance(0.35)) c.referenceClient = `BC-${jour.slice(2, 4)}${jour.slice(5, 7)}-${gr.entier(10, 99)}`;
    if (gr.chance(0.25)) c.dateSouhaitee = ajouterJours(jour, gr.entier(3, 6));
    if (gr.chance(0.2)) c.commentaire = gr.choix(['Livrer avant 11 h, merci.', 'Merci de prévenir la veille par téléphone.', 'Accès livraison par la rue de derrière.', 'Commande pour le week-end prolongé.']);
    const etape = (statut, ms, qui, action) => {
      const h = { date: iso(ms), statut, par: qui };
      if (action) h.action = action;
      c.historique.push(h);
      c.statut = statut;
      c.updatedAt = iso(ms);
    };
    const tPrep = ouvre(t + gr.entier(14, 20) * 3600000, gr);
    if (tPrep < nowMs) {
      etape('en-preparation', tPrep, auteurCourt(quiPrepare()));
      const tExp = ouvre(tPrep + gr.entier(4, 22) * 3600000, gr);
      if (tExp < nowMs) {
        c.suivi = { transporteur: 'Transports Rhodaniens (démonstration)', numero: `TR${gr.chiffres(8)}` };
        etape('expediee', tExp, auteurCourt(quiPrepare()));
        factures.push({ commande: c, date: jourParis(tExp), ms: tExp });
        const tLiv = ouvre(tExp + gr.entier(24, 54) * 3600000, gr);
        if (tLiv < nowMs) etape('livree', tLiv, { ...PAR_SYSTEME });
      }
    }
    commandesPro.push(c);
  }
  // une commande pro annulée (commande en double)
  const proAnnulable = commandesPro.find((c) => c.statut === 'livree' && (nowMs - Date.parse(c.createdAt)) / JOUR_MS > 20 && comptes.platanes.id !== c.compteId);
  if (proAnnulable) {
    const t0 = Date.parse(proAnnulable.createdAt);
    proAnnulable.historique = proAnnulable.historique.slice(0, 1);
    delete proAnnulable.suivi;
    proAnnulable.historique.push({ date: iso(t0 + 5 * 3600000), statut: 'annulee', action: 'Annulée : commande en double', par: auteurCourt(staff.commercial) });
    proAnnulable.statut = 'annulee';
    proAnnulable.updatedAt = iso(t0 + 5 * 3600000);
    const i = factures.findIndex((f) => f.commande === proAnnulable);
    if (i >= 0) factures.splice(i, 1);
  }

  // ----- Numérotation chronologique -----
  const toutes = [...commandesWeb, ...commandesPro].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const gnum = g('numeros');
  doc.seq.web = 880 + gnum.entier(0, 60);
  doc.seq.pro = 240 + gnum.entier(0, 30);
  for (const c of toutes) {
    const type = c.canal === 'pro' ? 'pro' : 'web';
    doc.seq[type] += 1;
    c.numero = numero(type, doc.seq[type], c.createdAt);
  }
  // Factures : à la création (en ligne), à l'expédition (pro), numérotées sans trou dans l'ordre des dates.
  factures.sort((a, b) => a.ms - b.ms);
  doc.seq.facture = 1460 + gnum.entier(0, 80);
  const gf = g('factures');
  const facturesPro = [];
  for (const f of factures) {
    doc.seq.facture += 1;
    const c = f.commande;
    const fac = { numero: numero('facture', doc.seq.facture, f.ms), date: f.date, echeance: f.date, statut: 'payee' };
    if (c.canal === 'pro') {
      const compte = doc.comptes.find((x) => x.id === c.compteId);
      fac.echeance = echeance(f.date, compte.conditions);
      fac.statut = 'a-regler';
      facturesPro.push(c);
    } else if (c.paiement.statut === 'en-attente') {
      fac.statut = 'a-regler';
      fac.echeance = ajouterJours(f.date, 7);
    } else fac.payeeLe = jourParis(Date.parse(c.paiement.date || c.createdAt));
    c.facture = fac;
  }
  // Règlements des factures pro : payées à l'échéance (ou un peu avant) une fois l'échéance passée,
  // parfois en avance ; une seule reste en retard (Bistrot du Vieux Lavoir, 45 jours ; à défaut un
  // autre compte, jamais le Café des Platanes, compte de démonstration de l'espace pro).
  const enRetardChoisie =
    facturesPro.filter((c) => c.compteId === comptes.lavoir.id && c.facture.echeance < ajouterJours(aujourdhui, -5)).pop() ||
    facturesPro.filter((c) => c.compteId !== comptes.platanes.id && c.facture.echeance < ajouterJours(aujourdhui, -5)).pop();
  for (const c of facturesPro) {
    const f = c.facture;
    if (c === enRetardChoisie) continue;
    if (f.echeance < aujourdhui) {
      const paye = ajouterJours(f.echeance, -gf.entier(0, 4));
      f.statut = 'payee';
      f.payeeLe = paye < f.date ? f.date : paye;
    } else if (gf.chance(0.35)) {
      const paye = ajouterJours(f.date, gf.entier(3, 20));
      if (paye < aujourdhui) {
        f.statut = 'payee';
        f.payeeLe = paye;
      }
    }
    if (f.statut === 'payee') {
      c.paiement.statut = 'paye';
      c.paiement.date = iso(instantParis(f.payeeLe, '10:00').getTime());
    }
  }
  // Café des Platanes (compte de démonstration) : pour que la démo de l'espace pro puisse toujours
  // commander, deux factures à régler au plus, les plus récentes, et un encours de 40 % au plus de
  // l'encours autorisé (quel que soit le tirage : une seule commande dépasse parfois 900 €).
  const platanesARegler = facturesPro.filter((c) => c.compteId === comptes.platanes.id && c.facture.statut === 'a-regler');
  const plafondPlatanes = Math.floor(versCentimes(comptes.platanes.encoursMax) * 0.4);
  const gardees = new Set();
  let encoursPlatanes = 0;
  for (const c of [...platanesARegler].reverse()) {
    const ttc = versCentimes(totauxCommande(c).totalTTC);
    if (gardees.size === 2 || encoursPlatanes + ttc > plafondPlatanes) break;
    gardees.add(c);
    encoursPlatanes += ttc;
  }
  const veille = ajouterJours(aujourdhui, -1);
  for (const c of platanesARegler.filter((x) => !gardees.has(x))) {
    const paye = ajouterJours(c.facture.date, 8);
    c.facture.statut = 'payee';
    // réglée 8 jours après la facture, hier au plus tard (jamais avant la facture)
    c.facture.payeeLe = paye <= veille ? paye : veille < c.facture.date ? c.facture.date : veille;
    c.paiement.statut = 'paye';
    c.paiement.date = iso(instantParis(c.facture.payeeLe, '10:00').getTime());
  }
  doc.commandes = toutes;
  const idx = index(doc);
  const versComplete = (c) => commandeComplete(c, idx);

  // ----- Stocks : mouvements récents -----
  const gm = g('mouvements');
  const mouvement = (ms, slug, varianteId, delta, motif, par, commandeId) => {
    const mv = { id: gm.id('mvt'), date: iso(ms), slug, varianteId, delta, motif, par };
    if (commandeId) mv.commandeId = commandeId;
    doc.mouvements.push(mv);
  };
  for (let k = 9; k >= 0; k--) {
    const jour = ajouterJours(aujourdhui, -k * 12 - gm.entier(1, 4));
    const ms = instantParis(jour, '07:30').getTime();
    if (ms > nowMs) continue;
    mouvement(ms, 'pac-citron', '1000', gm.choix([480, 540, 600]), 'production', auteurCourt(quiPrepare()));
    if (k % 2 === 0) mouvement(ms + 1800000, 'fun-blue', '1000', gm.choix([360, 420, 480]), 'production', auteurCourt(quiPrepare()));
    if (k % 3 === 0) {
      const s = gm.choix(['sirop-couleur-provence-grenadine', 'sirop-menthe', 'sirop-citron', 'sirop-couleur-provence-orgeat']);
      mouvement(ms + 3600000, s, '1000', 120, 'production', auteurCourt(quiPrepare()));
    }
  }
  const recentes = toutes.filter((c) => nowMs - Date.parse(c.createdAt) < 1.5 * JOUR_MS && c.statut !== 'annulee');
  for (const c of recentes) for (const l of c.lignes) mouvement(Date.parse(c.createdAt), l.slug, l.varianteId, -l.qte, 'vente', c.canal === 'pro' ? auteurCourt(doc.utilisateurs.find((u) => u.id === c.auteurId)) : { ...PAR_SITE }, c.id);
  if (aAnnuler) {
    for (const l of aAnnuler.lignes) mouvement(Date.parse(aAnnuler.createdAt), l.slug, l.varianteId, -l.qte, 'vente', { ...PAR_SITE }, aAnnuler.id);
    for (const l of aAnnuler.lignes) mouvement(Date.parse(aAnnuler.updatedAt), l.slug, l.varianteId, l.qte, 'annulation', auteurCourt(quiBoutique()), aAnnuler.id);
  }
  mouvement(nowMs - gm.entier(4, 9) * JOUR_MS, 'sirop-couleur-provence-grenadine', '1000', -1, 'casse', auteurCourt(quiPrepare()));
  mouvement(nowMs - gm.entier(10, 20) * JOUR_MS, 'pastis-marra', '700', -2, 'casse', auteurCourt(quiPrepare()));
  mouvement(nowMs - gm.entier(25, 35) * JOUR_MS, 'sirop-lavande', '700', 3, 'inventaire', auteurCourt(staff.direction));
  mouvement(nowMs - gm.entier(25, 35) * JOUR_MS, 'la-camarguaise', '700', -1, 'inventaire', auteurCourt(staff.direction));
  mouvement(nowMs - gm.entier(40, 60) * JOUR_MS, 'creme-de-cassis', '1000', 6, 'ajustement', auteurCourt(quiPrepare()));
  doc.mouvements.sort((a, b) => a.date.localeCompare(b.date));

  // ----- Demandes pro -----
  const gd = g('demandes');
  const DEMANDES = [
    { societe: 'Bar Le Petit Mistral', activite: 'chr', ville: 'Sorgues', statut: 'nouvelle', jours: 0.4, message: 'Bonjour, nous ouvrons un bar en centre-ville et souhaiterions proposer le PAC Citron et le Fun Blue. Pouvez-vous nous envoyer vos conditions ?' },
    { societe: 'Épicerie Les Jarres d’Orange', activite: 'epicerie', ville: 'Orange', statut: 'nouvelle', jours: 1.6, message: 'Épicerie fine, nous cherchons des sirops de Provence pour notre rayon régional.' },
    { societe: 'Gîtes du Ventoux', activite: 'autre', ville: 'Bédoin', statut: 'nouvelle', jours: 3.2, message: 'Nous accueillons des familles l’été et voudrions offrir une bouteille de sirop à l’arrivée.' },
    { societe: 'Restaurant La Treille du Comtat', activite: 'chr', ville: 'Pernes-les-Fontaines', statut: 'en-cours', jours: 8, note: 'Rappeler mardi : licence restaurant en cours de transfert.', message: 'Restaurant traditionnel, 40 couverts. Intéressés par vos liqueurs régionales et vos sirops.' },
    { societe: 'La Table du Mas Fleuri', activite: 'chr', ville: 'Uzès', statut: 'acceptee', compte: 'mas', message: 'Nouveau restaurant à Uzès, nous aimerions travailler avec une maison de la région.' },
    { societe: 'Vins et Alambics du Luberon', activite: 'caviste', ville: 'Cavaillon', statut: 'acceptee', compte: 'luberon', message: 'Caviste à Cavaillon, nous voulons développer un rayon de spiritueux provençaux.' },
    { societe: 'Boissons Express Méditerranée', activite: 'distributeur', ville: 'Marseille', statut: 'refusee', jours: 21, note: 'Revente en ligne uniquement, hors de notre réseau de distribution.', message: 'Plateforme de vente en ligne, nous souhaitons référencer toute votre gamme.' },
  ];
  doc.seq.demande = 30 + gd.entier(0, 12);
  const demandes = DEMANDES.map((d) => {
    const prenom = gd.choix(PRENOMS);
    const nom = gd.choix(NOMS);
    let t;
    if (d.compte) t = Date.parse(comptes[d.compte].createdAt) - gd.entier(2, 5) * JOUR_MS;
    else t = nowMs - d.jours * JOUR_MS;
    const dem = {
      id: gd.id('dem'),
      reference: '',
      societe: d.societe,
      activite: d.activite,
      siret: siretFictif(gd),
      nom: `${prenom} ${nom}`,
      email: d.compte ? comptes[d.compte].email : `${slugifier(prenom)}.${slugifier(nom)}@${gd.choix(DOMAINES)}`,
      telephone: telFiction(gd, gd.chance(0.5)),
      ville: d.ville,
      message: d.message,
      statut: d.statut,
      createdAt: iso(t),
    };
    if (d.note) dem.note = d.note;
    if (d.statut === 'acceptee' || d.statut === 'refusee' || d.statut === 'en-cours') {
      dem.traiteePar = staff.commercial.id;
      dem.traiteeLe = d.compte ? comptes[d.compte].createdAt : iso(t + gd.entier(20, 60) * 3600000);
    }
    if (d.compte) {
      dem.compteId = comptes[d.compte].id;
      const u = usagersPro[d.compte][0];
      dem.nom = nomComplet(u);
    }
    return dem;
  });
  demandes.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const d of demandes) {
    doc.seq.demande += 1;
    d.reference = numero('demande', doc.seq.demande, d.createdAt);
  }
  doc.demandes = demandes;

  // ----- Visites : séances (30 jours passés, 60 à venir) et réservations -----
  // Graine du jour de création (et non de la démo) : les disponibilités montrées aux visiteurs qui
  // n'ont pas encore de démo (calculées sur ce même jeu) sont celles de la démo créée à leur
  // réservation.
  const gv = prng(`visites:${aujourdhui}`);
  for (let k = -30; k <= 60; k++) {
    const jour = ajouterJours(aujourdhui, k);
    if (!jourDeVisite(jour, params.visites)) continue;
    for (const moment of ['matin', 'apres-midi']) {
      const js = jourSemaine(jour);
      const s = {
        id: gv.id('sea'),
        date: jour,
        heure: params.visites.horaires[moment],
        moment,
        capacite: params.visites.capacite,
        langue: moment === 'apres-midi' && js === 3 ? 'en' : moment === 'matin' && js === 6 && Number(jour.slice(8)) <= 7 ? 'de' : 'fr',
        statut: 'ouverte',
        guideId: (k + (moment === 'matin' ? 0 : 1)) % 3 === 0 ? staff.direction.id : staff.boutique.id,
      };
      doc.seances.push(s);
    }
  }
  // une séance fermée (inventaire) dans les jours à venir
  const aFermer = doc.seances.find((s) => s.date > ajouterJours(aujourdhui, 15) && s.moment === 'apres-midi');
  if (aFermer) {
    aFermer.statut = 'fermee';
    aFermer.notes = 'Inventaire de la boutique : pas de visite.';
  }
  const places = new Map(doc.seances.map((s) => [s.id, 0]));
  const reservations = [];
  const nouvelleResa = (s, personnes, opts = {}) => {
    const prenom = gv.choix(PRENOMS);
    const nom = gv.choix(NOMS);
    const passe = s.date < aujourdhui;
    const debutSeance = instantParis(s.date, s.heure).getTime();
    const creeMs = Math.min(nowMs - gv.entier(1, 48) * 3600000, debutSeance - gv.entier(1, 20) * JOUR_MS);
    let statut = passe ? gv.pondere(['venue', 'absente', 'annulee'], (x) => ({ venue: 82, absente: 8, annulee: 10 })[x]) : gv.chance(0.08) ? 'annulee' : 'confirmee';
    if (opts.statut) statut = opts.statut;
    const r = {
      id: gv.id('res'),
      reference: '',
      seanceId: s.id,
      date: s.date,
      moment: s.moment,
      personnes,
      mineurs: personnes > 2 && gv.chance(0.45) ? gv.entier(1, Math.min(4, personnes - 1)) : 0,
      langue: s.langue,
      nom: `${prenom} ${nom}`,
      email: `${slugifier(prenom)}.${slugifier(nom)}@${gv.choix(DOMAINES)}`,
      telephone: telFiction(gv, true),
      statut,
      source: opts.source || gv.pondere(['site', 'telephone', 'crm'], (x) => ({ site: 70, telephone: 20, crm: 10 })[x]),
      newsletter: gv.chance(0.3),
      createdAt: iso(creeMs),
    };
    if (opts.message) r.message = opts.message;
    if (opts.notes) r.notes = opts.notes;
    if (statut !== 'annulee') places.set(s.id, places.get(s.id) + personnes);
    reservations.push(r);
    return r;
  };
  const ouvertes = doc.seances.filter((s) => s.statut === 'ouverte');
  // séance complète : le prochain samedi matin (ou la prochaine séance ouverte)
  const complete = ouvertes.find((s) => s.date > ajouterJours(aujourdhui, 1) && jourSemaine(s.date) === 6 && s.moment === 'matin') || ouvertes.find((s) => s.date > aujourdhui);
  if (complete) {
    nouvelleResa(complete, 12, { statut: 'confirmee', source: 'telephone', message: 'Groupe d’un comité des fêtes.', notes: 'Groupe : prévoir la dégustation sans alcool pour les enfants.' });
    nouvelleResa(complete, 8, { statut: 'confirmee' });
    nouvelleResa(complete, 5, { statut: 'confirmee' });
  }
  const presqueComplete = ouvertes.find((s) => s !== complete && s.date > ajouterJours(aujourdhui, 2) && s.moment === 'apres-midi' && jourSemaine(s.date) === 6);
  if (presqueComplete) {
    nouvelleResa(presqueComplete, 15, { statut: 'confirmee', source: 'crm', message: 'Sortie d’une association de randonneurs.' });
    nouvelleResa(presqueComplete, 7, { statut: 'confirmee' });
  }
  let garde2 = 0;
  while (reservations.length < 55 && garde2++ < 500) {
    const s = gv.choix(ouvertes);
    if (s === complete) continue;
    const personnes = gv.chance(0.1) ? gv.entier(8, 16) : gv.entier(1, 6);
    if (places.get(s.id) + personnes > s.capacite) continue;
    nouvelleResa(s, personnes, personnes >= 8 ? { message: 'Visite en groupe.' } : {});
  }
  reservations.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  doc.seq.visite = 100 + gv.entier(0, 40);
  for (const r of reservations) {
    doc.seq.visite += 1;
    r.reference = numero('visite', doc.seq.visite, r.createdAt);
  }
  doc.reservations = reservations;

  // ----- Messages -----
  const gs = g('messages');
  const clientAuHasard = () => gs.choix(doc.clients);
  const MESSAGES = [
    { sujet: 'commande', statut: 'nouveau', heures: 6, texte: 'Bonjour, ma commande est-elle partie ? Je voudrais l’offrir samedi. Merci !', client: true },
    { sujet: 'visite', statut: 'nouveau', heures: 26, texte: 'Bonjour, nous sommes un groupe de 18 personnes (dont 5 enfants). Une visite est-elle possible un samedi matin de novembre ?' },
    { sujet: 'presse', statut: 'en-cours', heures: 70, texte: 'Journaliste pour un magazine régional, je prépare un sujet sur les sirops de Provence. Pourrions-nous convenir d’un entretien ?', reponse: 'Bonjour, avec plaisir. Hélène Garnier vous rappelle cette semaine pour fixer un rendez-vous.' },
    { sujet: 'pro', statut: 'traite', heures: 120, compte: 'platanes', texte: 'Bonjour Thomas, pouvez-vous nous livrer avant samedi ? Nous avons un mariage en terrasse.', reponse: 'Bonjour Julien, c’est noté : livraison vendredi matin avant 11 h.' },
    { sujet: 'pro', statut: 'en-cours', heures: 50, compte: 'rhodanien', texte: 'Bonjour, pouvez-vous nous transmettre vos conditions pour l’an prochain (palettes complètes de PAC Citron) ?', reponse: 'Bonjour, je prépare la proposition et vous l’envoie d’ici vendredi.' },
    { sujet: 'pro', statut: 'nouveau', heures: 9, compte: 'ouveze', texte: 'Bonjour, est-il possible de décaler notre prochaine livraison à la semaine prochaine ?' },
    { sujet: 'autre', statut: 'traite', heures: 200, texte: 'Où peut-on trouver le Fun Blue à Lyon ?', client: true, reponse: 'Bonjour, il est disponible sur notre boutique en ligne, avec livraison partout en France métropolitaine.' },
    { sujet: 'autre', statut: 'archive', heures: 600, texte: 'Merci pour la recette du PAC pétillant, un succès à notre anniversaire !', client: true },
    { sujet: 'commande', statut: 'traite', heures: 300, texte: 'Mon colis est arrivé avec une bouteille cassée, que faire ?', client: true, reponse: 'Bonjour, toutes nos excuses : nous vous remboursons la commande. Inutile de nous renvoyer le colis.' },
    { sujet: 'visite', statut: 'traite', heures: 160, texte: 'Hello, do you offer guided tours in English?', reponse: 'Hello, yes: our Wednesday afternoon tours are in English. You can book them on our website.' },
    { sujet: 'autre', statut: 'en-cours', heures: 96, texte: 'Je possède d’anciennes bouteilles et étiquettes de la distillerie (années 1960). Cela vous intéresserait-il pour vos archives ?', reponse: 'Bonjour, cela nous intéresse beaucoup ! Pourriez-vous nous envoyer quelques photos ?' },
    { sujet: 'pro', statut: 'traite', heures: 240, compte: 'cypres', texte: 'Bonjour, auriez-vous des fiches techniques pour notre nouvelle carte du bar ?', reponse: 'Bonjour, elles sont dans votre espace pro, rubrique Documents.' },
    { sujet: 'commande', statut: 'nouveau', heures: 2, texte: 'Bonjour, puis-je modifier l’adresse de livraison de ma commande passée ce matin ?', client: true },
    { sujet: 'autre', statut: 'archive', heures: 900, texte: 'Proposez-vous des ateliers cocktails sans alcool pour les comités d’entreprise ?', reponse: 'Bonjour, pas pour le moment, mais nous notons l’idée !' },
  ];
  doc.seq.message = 60 + gs.entier(0, 20);
  const messages = MESSAGES.map((d, i) => {
    const t = nowMs - d.heures * 3600000 - gs.entier(0, 50) * 60000;
    let nom;
    let email;
    let compteId;
    let clientId;
    let telephone;
    if (d.compte) {
      const compte = comptes[d.compte];
      const u = usagersPro[d.compte][0];
      nom = nomComplet(u);
      email = u.email;
      compteId = compte.id;
    } else if (d.client) {
      const c = clientAuHasard();
      nom = `${c.prenom} ${c.nom}`;
      email = c.email;
      clientId = c.id;
      telephone = c.telephone;
    } else {
      const prenom = gs.choix(PRENOMS);
      const n = gs.choix(NOMS);
      nom = i === 9 ? 'Emily Carter' : `${prenom} ${n}`;
      email = i === 9 ? `emily.carter@${gs.choix(DOMAINES)}` : `${slugifier(prenom)}.${slugifier(n)}@${gs.choix(DOMAINES)}`;
    }
    const assigne = d.compte ? staff[COMPTES.find((x) => x.cle === d.compte).commercial] : d.sujet === 'visite' ? staff.boutique : d.sujet === 'presse' ? staff.direction : staff.boutique;
    const m = {
      id: gs.id('msg'),
      reference: '',
      nom,
      email,
      sujet: d.sujet,
      statut: d.statut,
      lu: d.statut !== 'nouveau',
      fil: [{ date: iso(t), de: 'client', texte: d.texte }],
      createdAt: iso(t),
    };
    if (telephone) m.telephone = telephone;
    if (d.statut !== 'nouveau') m.assigneA = assigne.id;
    if (compteId) m.compteId = compteId;
    if (clientId) m.clientId = clientId;
    if (d.reponse) m.fil.push({ date: iso(Math.min(t + gs.entier(2, 20) * 3600000, nowMs - 600000)), de: 'equipe', par: auteurCourt(assigne), texte: d.reponse });
    return m;
  });
  messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const m of messages) {
    doc.seq.message += 1;
    m.reference = numero('message', doc.seq.message, m.createdAt);
  }
  doc.messages = messages;

  // ----- Abonnés à la newsletter -----
  const gn = g('abonnes');
  const SOURCES = [['pied-de-page', 45], ['commande', 25], ['visite', 15], ['contact', 5], ['salon', 10]];
  const abonnes = [];
  for (const c of doc.clients.filter((x) => x.newsletter)) {
    abonnes.push({ id: gn.id('abo'), email: c.email, prenom: c.prenom, source: c.origine === 'visite' ? 'visite' : c.origine === 'salon' ? 'salon' : 'commande', statut: 'inscrit', inscritLe: c.createdAt });
  }
  while (abonnes.length < 220) {
    const prenom = gn.choix(PRENOMS);
    const nom = gn.choix(NOMS);
    const email = nouvelEmail(prenom, nom, gn);
    // croissance : plus d'inscriptions récentes
    const jours = Math.floor(720 * gn.suivant() ** 1.6);
    const a = { id: gn.id('abo'), email, source: gn.pondere(SOURCES, (s) => s[1])[0], statut: 'inscrit', inscritLe: iso(nowMs - jours * JOUR_MS - gn.entier(0, 86399) * 1000) };
    if (gn.chance(0.6)) a.prenom = prenom;
    if (gn.chance(0.08) && jours > 20) {
      a.statut = 'desinscrit';
      a.desinscritLe = iso(Date.parse(a.inscritLe) + gn.entier(5, jours - 1) * JOUR_MS);
    }
    abonnes.push(a);
  }
  abonnes.sort((a, b) => a.inscritLe.localeCompare(b.inscritLe));
  doc.abonnes = abonnes;

  // ----- Campagnes -----
  const ga = g('campagnes');
  const envoiMs = nowMs - ga.entier(40, 80) * JOUR_MS;
  const moisEnvoi = Number(jourParis(envoiMs).slice(5, 7));
  const THEMES = {
    ete: { objet: 'L’été en PAC Citron et Fun Blue', introduction: 'Les beaux jours sont là : nos recettes les plus fraîches, à l’eau plate ou pétillante.', corps: 'Citronnade minute, Fun Blue givré, PAC pétillant à la menthe : retrouvez nos recettes de l’été et nos conseils de dilution.\n\nÀ bientôt à la distillerie !' },
    automne: { objet: 'Les parfums d’automne Couleur Provence', introduction: 'Châtaigne, figue, caramel : les sirops de saison sont arrivés.', corps: 'Pour les goûters et les boissons chaudes, découvrez nos sirops de saison et leurs recettes gourmandes.\n\nÀ bientôt à la distillerie !' },
    hiver: { objet: 'Des idées de cadeaux sans alcool', introduction: 'Nos sirops se glissent sous le sapin : coffrets, assortiments et recettes de fête.', corps: 'Composez un assortiment de sirops Couleur Provence ou offrez une visite de la distillerie.\n\nBonnes fêtes de fin d’année !' },
    printemps: { objet: 'Le printemps des sirops', introduction: 'Violette, fraise, lavande : le printemps a ses couleurs.', corps: 'Nos recettes de printemps et les nouveautés de la boutique vous attendent.\n\nÀ bientôt à la distillerie !' },
  };
  const theme = moisEnvoi >= 6 && moisEnvoi <= 8 ? 'ete' : moisEnvoi >= 9 && moisEnvoi <= 11 ? 'automne' : moisEnvoi === 12 || moisEnvoi <= 2 ? 'hiver' : 'printemps';
  const inscritsA = (ms) => abonnes.filter((a) => Date.parse(a.inscritLe) <= ms && (!a.desinscritLe || Date.parse(a.desinscritLe) > ms)).length;
  doc.campagnes.push({
    id: ga.id('cam'),
    ...THEMES[theme],
    bouton: { libelle: 'Voir les recettes', url: '/recettes' },
    segment: 'tous',
    statut: 'envoyee',
    envoyeeLe: iso(envoiMs),
    destinataires: inscritsA(envoiMs),
    creePar: staff.commercial.id,
    createdAt: iso(envoiMs - 3 * JOUR_MS),
  });
  const themeSuivant = { ete: 'automne', automne: 'hiver', hiver: 'printemps', printemps: 'ete' }[theme];
  doc.campagnes.push({
    id: ga.id('cam'),
    ...THEMES[themeSuivant],
    bouton: { libelle: 'Découvrir la boutique', url: '/boutique' },
    segment: 'clients',
    statut: 'brouillon',
    creePar: staff.boutique.id,
    createdAt: iso(nowMs - ga.entier(1, 4) * JOUR_MS),
  });

  // ----- Codes promo -----
  const gpr = g('promos');
  doc.promos = promosDef.map((d) => ({ id: gpr.id('pro'), ...d, utilisations: promosUtilisees[d.code] }));
  for (const p of doc.promos) if (p.limite === undefined) p.limite = null;

  // ----- Boîte d'envoi : les courriels récents -----
  const ge = g('courriels');
  const boite = [];
  const deposer = (ms, courriel) => boite.push({ id: ge.id('crl'), date: iso(ms), ...courriel });
  const webRecentes = commandesWeb.filter((c) => c !== aAnnuler).slice(-3);
  for (const c of webRecentes) deposer(Date.parse(c.createdAt), C.confirmationCommande(versComplete(c)));
  for (const c of commandesWeb.filter((x) => x.statut === 'expediee').slice(-2)) {
    const h = c.historique.find((x) => x.statut === 'expediee');
    deposer(Date.parse(h.date), C.expedition(versComplete(c)));
  }
  const prete = commandesWeb.filter((x) => x.statut === 'prete' || x.statut === 'retiree').pop();
  if (prete) deposer(Date.parse(prete.historique.find((x) => x.statut === 'prete').date), C.pretRetrait(versComplete(prete)));
  const facPlatanes = facturesPro.filter((c) => c.compteId === comptes.platanes.id).pop();
  if (facPlatanes) deposer(Date.parse(facPlatanes.historique.find((x) => x.statut === 'expediee').date), C.factureDisponible(versComplete(facPlatanes), comptes.platanes));
  // invitation de Camille Morel (Café des Platanes), lien valable 7 jours
  const camille = usagersPro.platanes.find((u) => !u.hash);
  if (camille && jetons) {
    const j = jetons();
    camille.invitation = { hache: j.hache, exp: iso(Date.parse(camille.createdAt) + 7 * JOUR_MS) };
    deposer(Date.parse(camille.createdAt), C.invitationPro(camille, comptes.platanes, j.jeton));
  }
  for (const r of reservations.filter((x) => x.source === 'site' && x.statut === 'confirmee').slice(-2)) {
    deposer(Date.parse(r.createdAt), C.confirmationVisite(r, doc.seances.find((s) => s.id === r.seanceId)));
  }
  const repondu = messages.filter((m) => m.fil.length > 1).sort((a, b) => a.fil[1].date.localeCompare(b.fil[1].date)).pop();
  if (repondu) deposer(Date.parse(repondu.fil[1].date), C.reponseMessage(repondu, repondu.fil[1].texte, repondu.fil[1].par));
  const demandeRecente = demandes.filter((d) => d.statut === 'nouvelle').pop();
  if (demandeRecente) deposer(Date.parse(demandeRecente.createdAt), C.demandeProRecue(demandeRecente));
  const nouvelAbonne = abonnes.filter((a) => a.statut === 'inscrit' && a.source === 'pied-de-page').pop();
  if (nouvelAbonne) deposer(Date.parse(nouvelAbonne.inscritLe), C.bienvenueNewsletter(nouvelAbonne));
  boite.sort((a, b) => a.date.localeCompare(b.date));
  doc.courriels = boite;

  // ----- Journal : les 60 dernières actions du personnel -----
  const gj = g('journal');
  const evts = [];
  const libelleCommande = (c) => `Commande ${c.numero}`;
  for (const c of toutes) {
    for (const h of c.historique) {
      if (!h.par?.id || !h.statut || h.statut === 'nouvelle') continue;
      const u = doc.utilisateurs.find((x) => x.id === h.par.id);
      if (!u || u.role === 'pro') continue;
      evts.push({ date: h.date, par: auteur(u), action: 'commande.statut', cible: { type: 'commande', id: c.id, libelle: libelleCommande(c) }, details: h.action || actionParDefaut(h.statut) });
    }
    if (c.canal === 'pro' && c.historique[0].par?.id) {
      const u = doc.utilisateurs.find((x) => x.id === c.historique[0].par.id);
      if (u && u.role !== 'pro') evts.push({ date: c.createdAt, par: auteur(u), action: 'commande.creation', cible: { type: 'commande', id: c.id, libelle: libelleCommande(c) }, details: 'Commande saisie par téléphone' });
    }
    if (c.facture?.statut === 'payee' && c.canal === 'pro' && c.facture.payeeLe) {
      evts.push({ date: iso(instantParis(c.facture.payeeLe, '10:00').getTime()), par: auteur(staff.direction), action: 'facture.paiement', cible: { type: 'commande', id: c.id, libelle: `Facture ${c.facture.numero}` }, details: 'Règlement reçu' });
    }
  }
  for (const mv of doc.mouvements) {
    if (!mv.par?.id) continue;
    const u = doc.utilisateurs.find((x) => x.id === mv.par.id);
    if (!u || u.role === 'pro' || mv.motif === 'vente') continue;
    const p = produitDe(mv.slug);
    const v = p.variantes.find((x) => x.id === mv.varianteId);
    evts.push({ date: mv.date, par: auteur(u), action: 'stock.mouvement', cible: { type: 'produit', id: mv.slug, libelle: `${p.nom} ${v.volume}` }, details: `${mv.delta > 0 ? '+' : ''}${mv.delta} (${mv.motif})` });
  }
  for (const m of messages) {
    if (m.fil[1]?.par?.id) {
      const u = doc.utilisateurs.find((x) => x.id === m.fil[1].par.id);
      evts.push({ date: m.fil[1].date, par: auteur(u), action: 'message.reponse', cible: { type: 'message', id: m.id, libelle: `Message ${m.reference}` }, details: `Réponse à ${m.nom}` });
    }
  }
  for (const d of demandes) {
    if (d.statut === 'acceptee') evts.push({ date: d.traiteeLe, par: auteur(staff.commercial), action: 'demande.acceptation', cible: { type: 'demande', id: d.id, libelle: `Demande ${d.reference}` }, details: `Compte ouvert pour ${d.societe}` });
    if (d.statut === 'refusee') evts.push({ date: d.traiteeLe, par: auteur(staff.commercial), action: 'demande.refus', cible: { type: 'demande', id: d.id, libelle: `Demande ${d.reference}` }, details: d.note });
  }
  for (const r of reservations.filter((x) => x.source === 'crm' || x.source === 'telephone')) {
    evts.push({ date: r.createdAt, par: auteur(staff.boutique), action: 'reservation.creation', cible: { type: 'reservation', id: r.id, libelle: `Visite ${r.reference}` }, details: `${r.personnes} personne${r.personnes > 1 ? 's' : ''}, ${libelleSeance(r.date, r.moment, jourParis(r.createdAt))}` });
  }
  for (const cam of doc.campagnes) {
    const u = doc.utilisateurs.find((x) => x.id === cam.creePar);
    evts.push({ date: cam.createdAt, par: auteur(u), action: 'campagne.creation', cible: { type: 'campagne', id: cam.id, libelle: cam.objet }, details: 'Brouillon créé' });
    if (cam.envoyeeLe) evts.push({ date: cam.envoyeeLe, par: auteur(u), action: 'campagne.envoi', cible: { type: 'campagne', id: cam.id, libelle: cam.objet }, details: `Envoyée à ${cam.destinataires} abonnés (démonstration)` });
  }
  evts.sort((a, b) => a.date.localeCompare(b.date));
  doc.journal = evts.slice(-60).map((e) => ({ id: gj.id('jrn'), ...e }));

  // ----- Compactage : rien de ce qui se recalcule n'est stocké (voir modele.js) -----
  const idxFinal = index(doc);
  for (const c of doc.commandes) compacterCommande(c, idxFinal);
  const limiteGuide = ajouterJours(aujourdhui, 14);
  for (const s of doc.seances) {
    if (s.date < aujourdhui || s.date > limiteGuide) delete s.guideId;
    compacterSeance(s, params);
  }
  doc.reservations.forEach(compacterReservation);
  doc.abonnes.forEach(compacterAbonne);
  doc.clients.forEach(compacterClient);

  return doc;
}
