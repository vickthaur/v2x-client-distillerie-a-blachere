// Informations pratiques, histoire, visites, actualités, presse et points de vente.
// Sources : note de prospection (blachere_et_spiritueux.md, sections 1 à 3), catalogue de la
// recherche (infos_boutique, presse) et étude d'identité (reports/Identité visuelle Distillerie
// Blachère.md), dont seuls les éléments marqués « Fait » sont repris. Rien d'inventé : un horaire,
// un tarif ou une date qui manque est contourné (« Tarif sur demande ») ; la mention « à confirmer »
// et l'écart entre les sources restent dans le champ revue (affiché en mode revue, ?revue :
// src/lib/revue.js). Les citations restent à relire dans les articles avant publication (README).
// alcool: true → affiché uniquement après la vérification de l'âge.

export const infos = {
  nom: 'Distillerie A. Blachère',
  adresse: ['1695 route de Sorgues', 'Quartier Cansaud', '84230 Châteauneuf-du-Pape'],
  adresseLigne: '1695 route de Sorgues, quartier Cansaud, 84230 Châteauneuf-du-Pape',
  magasin: { tel: '04 90 83 55 65', telLien: 'tel:+33490835565', email: 'magasin@distillerieablachere.com' },
  bureaux: { tel: '04 90 83 53 81', telLien: 'tel:+33490835381', email: 'info@distillerieablachere.com' },
  // Horaires du magasin : page Contact du site officiel (relevée le 14 octobre 2026), qui fait
  // référence ; elle tranche les versions différentes des autres pages.
  horaires: [
    { periode: 'D’octobre à mars', heures: '10 h – 18 h' },
    { periode: 'D’avril à septembre', heures: '9 h – 19 h' },
  ],
  jours: 'Du lundi au samedi, hors jours fériés',
  horairesNote: 'Horaires de la page Contact du site de la distillerie.',
  bureauxHoraires: { jours: 'Du lundi au vendredi, hors jours fériés', heures: '8 h – 12 h, 14 h – 18 h' },
  // Horaires de retrait indiqués par la page « Achat express » du site actuel.
  retrait: '9 h – 12 h et 14 h – 17 h',
  itineraire: 'https://www.openstreetmap.org/search?query=1695%20route%20de%20Sorgues%2C%2084230%20Ch%C3%A2teauneuf-du-Pape',
  instagram: 'https://www.instagram.com/distillerieablachere/',
};

// ---------- Visites ----------
// Saison 2026 : Provence-Alpes-Côte d'Azur Tourisme. Parcours : Pop Tourisme. Durée, taille des
// groupes : Provence Guide. Les tarifs se contredisent d'une source à l'autre : « sur demande » pour
// le visiteur, « à confirmer » (revue) pour la distillerie.
export const saison = { debut: '2026-02-12', fin: '2026-12-31', texte: 'Du 12 février au 31 décembre 2026', ferme: 'Fermé le dimanche', groupeMax: 25 };

export const formules = [
  {
    id: 'libre',
    nom: 'Passage libre',
    sous: 'Boutique et dégustation',
    voir: ['La boutique de la distillerie', 'La dégustation\u00a0: les sirops pour tous, les alcools pour les majeurs'],
    duree: 'Aux heures du magasin',
    reservation: 'Sans réservation',
    prix: 'Gratuit',
    prixNote: 'La dégustation en boutique est gratuite.',
    revue: { prixNote: 'La dégustation en boutique est gratuite, selon la fiche de l’office de tourisme.' },
    reservable: false,
  },
  {
    id: 'seance',
    nom: 'Séance en boutique',
    sous: 'L’histoire de la maison et une dégustation',
    voir: ['L’histoire de la maison, racontée en boutique', 'La dégustation'],
    duree: 'Sur demande',
    reservation: 'Sur réservation',
    prix: 'Tarif sur demande',
    revue: { duree: 'Durée à confirmer', prix: 'Tarif à confirmer' },
    reservable: true,
  },
  {
    id: 'guidee',
    nom: 'Visite guidée de la distillerie',
    sous: 'La séance en boutique, puis l’usine',
    voir: ['La zone de stockage', 'L’herboristerie', 'La salle d’étiquetage', 'Le vieux chai', 'La production, derrière les vitres', 'La dégustation'],
    duree: '1 h, dégustation comprise',
    capacite: '25 personnes au plus',
    reservation: 'Toute l’année, sur réservation\u202f; fermé le dimanche',
    prix: 'Tarif sur demande',
    revue: { prix: 'Tarif à confirmer', prixNote: 'Gratuit, 4 €, 5 €, 7 € ou 10 € selon les sources\u00a0: à trancher avec la distillerie.' },
    reservable: true,
  },
  {
    id: 'groupes',
    nom: 'Groupes',
    sous: 'La visite guidée, adaptée au groupe',
    voir: ['Le parcours de la visite guidée', 'La dégustation'],
    duree: 'Sur demande',
    capacite: 'Jusqu’à 25 personnes',
    reservation: 'Sur réservation',
    prix: 'Tarif sur demande',
    revue: { duree: 'Durée à confirmer', reservation: 'Délai de réservation à fixer', prix: 'Tarif à confirmer' },
    reservable: true,
  },
];

// ---------- Actualités ----------
export const actualites = [
  {
    id: 'festival',
    quand: '13 juin 2026',
    rubrique: 'Festival',
    titre: '«\u00a0Châteauneuf-du-Pape en Bulles\u00a0», le festival de BD',
    texte: 'Avec Enrico Marini, Olivier Berlion, Marc Bourgne et Christopher, sous le parrainage de Sébastien Philippe. Gratuit, au cœur du village, organisé avec la commune et financé par la distillerie.',
    suite: 'Prochaine édition\u00a0: date à annoncer.',
    source: { nom: 'Pop Tourisme', url: 'https://www.poptourisme.fr/fete-manifestation/festival-de-bd-chateauneuf-du-pape-en-bulles/' },
  },
  {
    id: 'saison',
    quand: 'Du 12 février au 31 décembre 2026',
    rubrique: 'Visites',
    titre: 'La saison des visites',
    texte: 'Visites guidées toute l’année sur réservation, par groupes de 25 personnes au plus\u202f; fermé le dimanche.',
    lien: { texte: 'Réserver une visite', href: '/visiter#reserver' },
    source: { nom: 'Provence-Alpes-Côte d’Azur Tourisme', url: 'https://provence-alpes-cotedazur.com/en/offres/visit-to-the-blachere-distillery-chateauneuf-du-pape-en-4707053/' },
  },
  {
    id: 'projet',
    quand: 'À partir de 2026',
    rubrique: 'Chantier',
    titre: 'Un grand projet pour la distillerie',
    texte: 'Moderniser, agrandir et restructurer la production, le stockage, l’accueil et la vente. Pour le rendre possible, la commune a adapté son plan local d’urbanisme\u202f; l’enquête publique s’est tenue du 24 février au 25 mars 2025.',
    source: { nom: 'L’Écho du Mardi, décembre 2025', url: 'https://www.echodumardi.com/economie/depuis-1835-la-distillerie-a-blachere-saffaire-pour-creer-des-saveurs-seduire-et-fideliser-sa-clientele/' },
  },
  {
    id: 'embouteillage',
    quand: 'Date à confirmer',
    rubrique: 'Production',
    titre: 'Une nouvelle ligne d’embouteillage',
    texte: 'Un investissement d’environ 500 000 €, soutenu à 20 % par France Relance, pour atteindre à terme 6 000 bouteilles à l’heure.',
    source: { nom: 'L’Écho du Mardi', url: 'https://www.echodumardi.com/tag/distillerie-blachere/?print=print-search' },
  },
  {
    id: 'magnums',
    quand: 'Un été, sans doute 2025',
    rubrique: 'Édition limitée',
    titre: 'Une centaine de magnums numérotés',
    texte: 'Les deux sirops phares de la maison en magnums numérotés, le temps d’un été. Une édition limitée, sans doute épuisée\u00a0: pas de vente en ligne.',
    source: { nom: 'L’Écho du Mardi, décembre 2025', url: 'https://www.echodumardi.com/economie/depuis-1835-la-distillerie-a-blachere-saffaire-pour-creer-des-saveurs-seduire-et-fideliser-sa-clientele/' },
  },
  {
    id: 'collectors',
    quand: '2023',
    rubrique: '60 ans du PAC',
    titre: 'Quatre étiquettes collector',
    texte: 'Trois signées par le graffeur C215, une par le peintre Claude Viallat, glissées au hasard dans la production.',
    lien: { texte: 'Les collectors', href: '/pac-citron#collectors' },
    source: { nom: 'L’Écho du Mardi, 11 mai 2023', url: 'https://www.echodumardi.com/dossier/pac-a-leau-les-60-ans-se-fetent-avec-des-etiquettes-collectors/' },
  },
];

// ---------- Où trouver nos produits ----------
// Liste indicative, d'après les fiches en ligne relevées le 14 octobre 2026 (note de prospection,
// catalogue, étude d'identité). La liste officielle viendra du service commercial. Les cafés ne
// seront cités qu'avec leur accord. produits : slugs ; un point de vente qui ne propose que des
// spiritueux n'apparaît qu'aux personnes majeures.
export const couches = [
  { id: 'gms', nom: 'Grandes surfaces', texte: 'Environ 90 % des ventes de la maison passent par la grande distribution.' },
  { id: 'cavistes', nom: 'Cavistes et épiceries fines', texte: 'À Paris, en Provence et en ligne.' },
  { id: 'cafes', nom: 'Cafés', texte: 'Où commander un PAC à l’eau.' },
];

export const pointsDeVente = [
  { couche: 'gms', nom: 'Auchan', lieu: 'En ligne', produits: ['pac-citron', 'fun-blue'], url: 'https://www.auchan.fr/pac-sirop-au-citron-sans-colorant/pr-C1214038' },
  { couche: 'gms', nom: 'Carrefour', lieu: 'En ligne', produits: ['pac-citron'], detail: 'PAC Citron en 70 cl', url: 'https://www.carrefour.fr/p/sirop-citron-sans-colorant-pac-3365340000057' },
  { couche: 'gms', nom: 'Courses U', lieu: 'En ligne', produits: ['pac-citron'], detail: 'PAC Citron en 70 cl', url: 'https://www.coursesu.com/p/sirop-pac-citron-blachere-70cl/6819753.html' },
  { couche: 'cavistes', nom: 'Les Caves du Roy', lieu: 'Paris', produits: ['pac-citron', 'pastis-marra', 'verveine-auguste-vieilli'], url: 'https://www.cavesduroy.fr/' },
  { couche: 'cavistes', nom: 'Arts & Vin', lieu: 'Saumane', produits: ['pac-citron'], url: 'https://arts-et-vin.fr/boutique/epicerie-fine-locale/distillerie-blachere/pac-citron-1-litre-distillerie-blachere/' },
  { couche: 'cavistes', nom: 'Cave La Petite Reine', lieu: 'En ligne', produits: ['pac-citron', 'pastis-marra', 'marc-chateauneuf-du-pape-reserve-des-legats'], url: 'https://cavelapetitereine.fr/produit/distillerie-a-blachere-sirop-pac-citron-100-cl/' },
  { couche: 'cavistes', nom: 'Maison Molinet', lieu: 'En ligne', produits: ['pac-citron'], url: 'https://maisonmolinet.fr/en-us/products/pac-citron-sirop-de-citron' },
  { couche: 'cavistes', nom: 'Olive et Raisin', lieu: 'En ligne', produits: ['pac-citron'], url: 'https://www.olive-et-raisin.com/produit/pac-citron/' },
  { couche: 'cavistes', nom: 'Le Mas des Agriculteurs', lieu: 'En ligne', produits: ['pac-citron'], url: 'https://www.lemasdesagriculteurs.fr/jus-de-fruits-sirops-eaux/2387-pac-citron-1l-3365340000019.html' },
  { couche: 'cavistes', nom: 'Épicerie fine Nîmes', lieu: 'Nîmes', produits: ['pastis-le-camarguais', 'la-camarguaise'], url: 'https://epicerie-fine-nimes.fr/brand/34-distillerie-blachere' },
  { couche: 'cavistes', nom: 'Maison des vins L’Espiguette', lieu: 'En ligne', produits: ['la-camarguaise'], url: 'https://www.maisondesvins-lespiguette.com/brand/55-distillerie-ablachere' },
  { couche: 'cavistes', nom: 'Comptoir Méditerranéen', lieu: 'En ligne', produits: ['pastis-marra', 'la-camarguaise', 'pastis-le-camarguais'], url: 'https://www.comptoir-mediterraneen.com/' },
  { couche: 'cavistes', nom: 'Épicerie Terroir Provence', lieu: 'En ligne', produits: ['pastis-marra', 'marc-chateauneuf-du-pape-reserve-des-legats'], url: 'https://www.epicerie-terroir-provence.com/' },
  { couche: 'cavistes', nom: 'L’Épicerie de Stelle', lieu: 'En ligne', produits: ['pastis-marra'], url: 'https://lepiceriedestelle.com/' },
  { couche: 'cavistes', nom: 'Drinks&Co', lieu: 'En ligne', produits: ['pastis-marra'], url: 'https://www.drinksco.fr/' },
  { couche: 'cafes', nom: 'Café de la Banque', lieu: 'Marseille', produits: ['pac-citron'], accord: true },
  { couche: 'cafes', nom: 'Bar de la Relève', lieu: 'Marseille', produits: ['pac-citron'], accord: true },
];
