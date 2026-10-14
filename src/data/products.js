// Catalogue affiché par le site : faits issus de catalogue.json (généré depuis la recherche par
// scripts/import-catalogue.mjs, à ne pas modifier à la main) + présentation (noms d'affichage,
// familles d'arômes, couleurs, bouteilles 3D) définie ici.
//
// Règles de la maquette (voir README) :
// - aucun prix, degré, contenance ou texte inventé : un champ vide n'est pas affiché ;
// - prix : seulement les prix TTC du site officiel, jamais ceux des revendeurs ;
// - alcool: true → visible seulement après la vérification de l'âge, toujours avec le message
//   sanitaire (loi Évin). Les notes marquées alcool: true (une recette avec alcool, par exemple)
//   ne s'affichent qu'aux personnes majeures, même sur la fiche d'un sirop.
import catalogue from './catalogue.json';

export const EVIN = 'L’abus d’alcool est dangereux pour la santé, à consommer avec modération.';
export const MINEURS = 'La vente d’alcool est interdite aux mineurs de moins de 18 ans.';

// Catégories de la boutique officielle (rubriques et pages catégories du site actuel).
// « Le rayon dit l'usage, l'habillage dit l'univers, la porte d'âge dit le public » (étude
// d'identité) : la gamme range le produit, son univers (theme) l'habille.
export const GAMMES = [
  { id: 'pac', nom: 'PAC Citron', univers: 'sirops', theme: 'pac' },
  { id: 'fun-blue', nom: 'Fun Blue', univers: 'sirops', theme: 'funblue' },
  { id: 'couleur-provence', nom: 'Sirops Couleur Provence®', court: 'Couleur Provence®', univers: 'sirops', theme: 'provence' },
  { id: 'pastis-aperitifs', nom: 'Pastis & apéritifs', univers: 'spiritueux', theme: 'maison' },
  { id: 'liqueurs-regionales', nom: 'Liqueurs régionales', univers: 'spiritueux', theme: 'maison' },
  { id: 'eaux-de-vie', nom: 'Eaux-de-vie de fruits', univers: 'spiritueux', theme: 'marcs' },
  { id: 'marcs', nom: 'Eaux-de-vie de marc', univers: 'spiritueux', theme: 'marcs' },
];

// Les neuf univers de la maison (étude d'identité). Couleurs : PAC, Fun Blue et collectors sont
// mesurées sur les étiquettes ; Couleur Provence®, Comtat, Camargue, Ventoux, marcs et maison sont
// des propositions V2X, à valider sur les vraies étiquettes (voir README).
// scene : couleurs du fond de la bouteille 3D (fiche produit).
export const UNIVERS = {
  pac: { nom: 'PAC Citron', page: '/pac-citron', alcool: false, scene: { top: '#d0258d', bottom: '#9e1068', glow: '#e04aa0', rim: '#ebd540', stripes: true } },
  funblue: { nom: 'Fun Blue', page: '/fun-blue', alcool: false, scene: { top: '#6e9bd0', bottom: '#1d459b', glow: '#18afc4', rim: '#18afc4' } },
  collectors: { nom: 'Les collectors', page: '/pac-citron#collectors', alcool: false },
  provence: { nom: 'Couleur Provence®', page: '/couleur-provence', alcool: false },
  comtat: { nom: 'Comtat et papes', page: '/spiritueux#comtat', alcool: true, scene: { top: '#eadfc2', bottom: '#6faeb6', glow: '#fff4dc', rim: '#c9a24a' } },
  camargue: { nom: 'Camargue', page: '/spiritueux#camargue', alcool: true, scene: { top: '#f3f0ea', bottom: '#2f6585', glow: '#ffffff', rim: '#8e3b2e' } },
  ventoux: { nom: 'Ventoux et garrigue', page: '/spiritueux#ventoux', alcool: true, scene: { top: '#dcd6c8', bottom: '#8a9a7b', glow: '#f4f1e8', rim: '#6e5c9e' } },
  marcs: { nom: 'Marcs et eaux-de-vie', page: '/spiritueux#marcs', alcool: true, scene: { top: '#6e4526', bottom: '#15110f', glow: '#c4863a', rim: '#c9a24a' } },
  maison: { nom: 'La maison 1835', page: '/la-maison', alcool: false, scene: { top: '#f6f1e7', bottom: '#cfc4a8', glow: '#fffaf0', rim: '#aa752e' } },
};

// Couleur Provence® en trois étagères (proposition de l'étude d'identité, prix officiels relevés
// le 14 octobre 2026).
export const ETAGERES = [
  {
    id: 'comptoir',
    titre: 'Les classiques du comptoir',
    format: '1 L',
    slugs: ['sirop-couleur-provence-grenadine', 'sirop-menthe', 'sirop-citron', 'sirop-fraise', 'sirop-orange', 'sirop-couleur-provence-orgeat', 'sirop-cassis', 'sirop-peche', 'sirop-couleur-provence-cola', 'sirop-framboise', 'sucre-de-canne'],
  },
  {
    id: 'provence',
    titre: 'Les parfums de Provence',
    format: '70 cl',
    slugs: ['sirop-anis', 'sirop-chataigne', 'sirop-melon', 'sirop-couleur-provence-figue', 'sirop-couleur-provence-violette', 'sirop-lavande', 'sirop-couleur-provence-reglisse'],
  },
  {
    id: 'gourmands',
    titre: 'Les gourmands et les fruités',
    format: '70 cl et 50 cl',
    slugs: ['sirop-banane', 'sirop-couleur-provence-kiwi', 'sirop-passion', 'sirop-pomme', 'sirop-caramel', 'sirop-vanille', 'sirop-fraise-barbe-a-papa', 'sirop-caramel-fleur-de-sel-camargue'],
  },
];

// Familles d'arômes, déduites du champ « arôme » du catalogue.
export const FAMILLES = [
  { id: 'agrumes', nom: 'Agrumes' },
  { id: 'menthe', nom: 'Menthe' },
  { id: 'fruits-rouges', nom: 'Fruits rouges' },
  { id: 'fruits', nom: 'Fruits' },
  { id: 'fleurs-plantes', nom: 'Fleurs & plantes' },
  { id: 'gourmands', nom: 'Gourmands' },
  { id: 'anis-reglisse', nom: 'Anis & réglisse' },
  { id: 'vigne', nom: 'Vigne & raisin' },
];

const GAMME_DU_CATALOGUE = {
  PAC: 'pac',
  'Fun Blue': 'fun-blue',
  'Couleur Provence®': 'couleur-provence',
  Pastis: 'pastis-aperitifs',
  Apéritifs: 'pastis-aperitifs',
  'Les Régionales': 'liqueurs-regionales',
  'Eaux-de-vie de fruits': 'eaux-de-vie',
  'Vieux Marc de Châteauneuf-du-Pape': 'marcs',
  'Vieux Marc de Provence': 'marcs',
};

// Présentation de chaque produit.
// nom      : nom d'affichage (le nom officiel reste dans nomOfficiel) ; lignes : nom sur deux lignes
// type     : ligne descriptive courte ; famille : famille d'arômes
// liquide  : couleur du liquide (bouteille 3D en attendant les photos) ; trouble : liquide opaque
// etiquette: pac | funblue | provence | maison ; bouteille : silhouette (src/data/shapes.js)
// phrase   : phrase d'accroche (citation de la fiche officielle quand elle existe)
// notes    : faits à afficher sur la fiche (sources : site officiel, page Histoire, presse citée)
// garnish  : éléments 3D autour de la bouteille (héros et fiche)
// habillage: univers d'un spiritueux (comtat | camargue | ventoux | marcs | maison), sinon celui de la gamme
const P = {
  'pac-citron': {
    nom: 'PAC Citron®',
    lignes: ['PAC', 'Citron'],
    type: 'Sirop de citron',
    famille: 'agrumes',
    liquide: '#f1e9b6',
    trouble: true,
    bouchon: '#f2d22e',
    etiquette: 'pac',
    garnish: ['lemonSlice', 'lemon', 'ice'],
    phrase: '100 % naturel au jus de citron, sans colorant ni conservateur',
    notes: [
      { t: 'Créé par Louis Guiot « à la suite d’étés torrides », après deux ans d’essais ; marque déposée en 1962.' },
      { t: 'Son nom reprend les initiales des enfants de Louis Guiot.' },
      { t: '« Toujours fabriqué dans le Vaucluse par la Distillerie A. Blachère », dit sa fiche.' },
      { t: 'Pour ses 60 ans, en 2023 : quatre étiquettes collector, trois de C215 et une de Claude Viallat.' },
      { t: 'En grande surface, il existe aussi en 70 cl.' },
    ],
    conseil: '1 volume de sirop pour 8 à 10 volumes d’eau plate ou gazeuse.',
  },
  'fun-blue': {
    nom: 'Fun Blue®',
    lignes: ['Fun', 'Blue'],
    type: 'Sirop de menthe bleue',
    famille: 'menthe',
    liquide: '#18afc4',
    bouchon: '#1d459b',
    etiquette: 'funblue',
    garnish: ['mint', 'ice', 'mint'],
    phrase: 'Sirop de menthe goût chlorophylle',
    notes: [
      { t: 'Créé en 1995, il succède à la menthe bleue « Aurélie », fabriquée depuis les années 1960.' },
      { t: 'Sa fiche le présente comme « le sirop de menthe bleu le plus populaire en Provence ».' },
      { t: 'En grande surface, il existe en 70 cl et en 1 L.' },
    ],
    conseil: '1 volume de sirop pour 8 à 10 volumes d’eau.',
  },
  'sirop-couleur-provence-cola': { nom: 'Sirop cola', lignes: ['Cola', ''], famille: 'gourmands', liquide: '#4a2412' },
  'sirop-couleur-provence-orgeat': {
    nom: 'Sirop d’orgeat',
    lignes: ['Orgeat', ''],
    famille: 'gourmands',
    liquide: '#f2ede1',
    trouble: true,
    notes: [
      { t: 'Sa fiche évoque « des notes d’amande grillée et de fleur d’oranger ».' },
      { t: 'Elle suggère aussi la Mauresque : pastis et sirop d’orgeat.', alcool: true },
    ],
  },
  'sirop-couleur-provence-grenadine': {
    nom: 'Sirop de grenadine',
    lignes: ['Grenadine', ''],
    famille: 'fruits-rouges',
    liquide: '#b3121d',
    notes: [
      { t: 'Idée de la fiche : le Shirley Temple.' },
      { t: 'Et aussi le Monaco (grenadine et bière), la Tomate (grenadine et pastis) et le Tequila Sunrise.', alcool: true },
    ],
    conseil: '1 volume de sirop pour 8 à 10 volumes d’eau.',
  },
  'sirop-couleur-provence-figue': {
    nom: 'Sirop de figue',
    lignes: ['Figue', ''],
    famille: 'fruits',
    liquide: '#6e3550',
    notes: [{ t: 'Sa fiche le range parmi les sirops typiquement provençaux.' }],
  },
  'sirop-couleur-provence-violette': {
    nom: 'Sirop de violette',
    lignes: ['Violette', ''],
    famille: 'fleurs-plantes',
    liquide: '#7b55c0',
    notes: [{ t: 'Sa fiche indique le colorant E151.' }],
  },
  'sirop-couleur-provence-reglisse': {
    nom: 'Sirop de réglisse',
    lignes: ['Réglisse', ''],
    famille: 'anis-reglisse',
    liquide: '#2b1a12',
    notes: [{ t: 'Sa fiche porte une mise en garde sur l’acide glycyrrhizique.' }],
  },
  'sirop-couleur-provence-kiwi': {
    nom: 'Sirop de kiwi',
    lignes: ['Kiwi', ''],
    famille: 'fruits',
    liquide: '#86bd45',
    notes: [{ t: 'Sa fiche propose de le mélanger au sirop de banane, avec une pointe de sirop de pomme.' }],
  },
  'sirop-anis': {
    nom: 'Sirop d’anis',
    lignes: ['Anis', ''],
    famille: 'anis-reglisse',
    liquide: '#eeebd8',
    notes: [{ t: 'Sa fiche le présente comme le goût du pastis, sans alcool.', alcool: true }],
  },
  'sirop-chataigne': {
    nom: 'Sirop de châtaigne',
    lignes: ['Châtaigne', ''],
    famille: 'gourmands',
    liquide: '#7a4a2a',
    phrase: 'La version non alcoolisée de la crème de châtaigne de la maison',
    phraseAlcool: true,
    notes: [{ t: 'Idée de la fiche : une vinaigrette au vinaigre balsamique, avec un peu de sirop et d’huile d’olive.' }],
  },
  'sirop-fraise-barbe-a-papa': { nom: 'Sirop fraise barbe à papa', lignes: ['Fraise', 'barbe à papa'], famille: 'fruits-rouges', liquide: '#f28bb3' },
  'sucre-de-canne': {
    nom: 'Sucre de canne',
    lignes: ['Sucre', 'de canne'],
    type: 'Sirop de sucre de canne',
    famille: 'gourmands',
    liquide: '#f4eedb',
    notes: [{ t: 'Sa fiche le destine aux cocktails : mojito, caïpirinha, ti-punch.', alcool: true }],
  },
  'sirop-menthe': { nom: 'Sirop de menthe', lignes: ['Menthe', ''], famille: 'menthe', liquide: '#1f9a52' },
  'sirop-fraise': { nom: 'Sirop de fraise', lignes: ['Fraise', ''], famille: 'fruits-rouges', liquide: '#de2f4a' },
  'sirop-citron': { nom: 'Sirop de citron', lignes: ['Citron', ''], famille: 'agrumes', liquide: '#f0de6c' },
  'sirop-framboise': { nom: 'Sirop de framboise', lignes: ['Framboise', ''], famille: 'fruits-rouges', liquide: '#c0175a' },
  'sirop-peche': { nom: 'Sirop de pêche', lignes: ['Pêche', ''], famille: 'fruits', liquide: '#f5a160' },
  'sirop-cassis': { nom: 'Sirop de cassis', lignes: ['Cassis', ''], famille: 'fruits-rouges', liquide: '#470d2c' },
  'sirop-orange': { nom: 'Sirop d’orange', lignes: ['Orange', ''], famille: 'agrumes', liquide: '#f08a24' },
  'sirop-lavande': { nom: 'Sirop de lavande', lignes: ['Lavande', ''], famille: 'fleurs-plantes', liquide: '#9b7bd1' },
  'sirop-melon': { nom: 'Sirop de melon', lignes: ['Melon', ''], famille: 'fruits', liquide: '#f39a4f' },
  'sirop-vanille': { nom: 'Sirop de vanille', lignes: ['Vanille', ''], famille: 'gourmands', liquide: '#e8d4a2' },
  'sirop-passion': { nom: 'Sirop passion', lignes: ['Passion', ''], famille: 'fruits', liquide: '#f4b300' },
  'sirop-pomme': { nom: 'Sirop de pomme', lignes: ['Pomme', ''], famille: 'fruits', liquide: '#a3d066' },
  'sirop-banane': { nom: 'Sirop de banane', lignes: ['Banane', ''], famille: 'fruits', liquide: '#f1dc6a' },
  'sirop-caramel': { nom: 'Sirop caramel', lignes: ['Caramel', ''], famille: 'gourmands', liquide: '#b2622a' },
  'sirop-caramel-fleur-de-sel-camargue': {
    nom: 'Sirop caramel à la fleur de sel de Camargue',
    lignes: ['Caramel', 'fleur de sel'],
    famille: 'gourmands',
    liquide: '#9a5226',
  },
  'pastis-marra': {
    nom: 'Pastis Marra®',
    lignes: ['Pastis', 'Marra'],
    type: 'Pastis',
    famille: 'anis-reglisse',
    liquide: '#d39a2c',
    bouteille: 'pastis',
    bouchon: '#1d4f91',
    garnish: ['anise', 'anise'],
    habillage: 'maison',
    notes: [
      { t: 'Recette de la distillerie Marra, à L’Isle-sur-la-Sorgue, rachetée par la maison en 1955.' },
      { t: 'Réglisse en bâton macérée dans la préparation.' },
    ],
    conseil: '1 volume de pastis pour 5 à 7 volumes d’eau fraîche.',
  },
  'pastis-le-camarguais': {
    nom: 'Le Camarguais®',
    lignes: ['Le', 'Camarguais'],
    type: 'Pastis',
    famille: 'anis-reglisse',
    liquide: '#dcae47',
    bouteille: 'pastis',
    bouchon: '#8a1c2b',
    habillage: 'camargue',
    phrase: 'L’un des derniers pastis faits à l’ancienne, selon la page Histoire de la maison',
    notes: [
      { t: 'Créé au milieu des années 1970 par Jean-Claude Blachère, inspiré de la Camargue.' },
      { t: 'Nom exact en boutique à confirmer (« Pastis Camarguais » sur la page Histoire).' },
    ],
  },
  'aperitif-lou-gardian': {
    nom: 'Apéritif vin et pêche « Lou Gardian »',
    lignes: ['Lou', 'Gardian'],
    type: 'Apéritif vin et pêche',
    famille: 'vigne',
    liquide: '#e48b6d',
    bouteille: 'liqueur',
    bouchon: '#6d1b2a',
    habillage: 'camargue',
    notes: [
      { t: 'Créé au milieu des années 1970 par Jean-Claude Blachère ; son nom évoque le gardian, figure de la culture camarguaise.' },
      { t: 'Sa bouteille est sérigraphiée de motifs camarguais.' },
    ],
  },
  'la-camarguaise': {
    nom: 'La Camarguaise®',
    lignes: ['La', 'Camarguaise'],
    type: 'Liqueur de plantes et d’épices',
    famille: 'fleurs-plantes',
    liquide: '#b4651f',
    bouteille: 'apothicaire',
    bouchon: '#8a5a32',
    bouchage: 'cork',
    garnish: ['origan', 'anise'],
    habillage: 'camargue',
    notes: [
      { t: 'Créée au milieu des années 1970 par Jean-Claude Blachère, inspirée de la Camargue.' },
      { t: 'Elle se boit à température ambiante ou sur glace pilée, et sert aussi à flamber les crustacés.' },
    ],
  },
  'verveine-auguste-vieilli': {
    nom: 'Verveine Auguste vieilli',
    lignes: ['Verveine', 'Auguste'],
    type: 'Liqueur de verveine',
    habillage: 'ventoux',
    famille: 'fleurs-plantes',
    liquide: '#8aa63a',
    bouteille: 'liqueur',
    bouchon: '#3f5a1a',
    notes: [{ t: 'La maison dit avoir fabriqué de la verveine dès le début des années 1880.' }],
  },
  'eau-de-vie-poire-williams-flirt': {
    nom: 'Eau-de-vie Poires Williams « Flirt® »',
    lignes: ['Flirt', 'Poires Williams'],
    type: 'Eau-de-vie de poire Williams',
    famille: 'fruits',
    liquide: '#f6f2e6',
    bouteille: 'liqueur',
    bouchon: '#c9a14a',
    habillage: 'marcs',
    notes: [{ t: 'Sa fiche la conseille aussi en cuisine : tartes aux poires, confitures, sorbets.' }],
  },
  'marc-chateauneuf-du-pape-reserve-des-legats': {
    nom: 'Réserve des Légats',
    lignes: ['Réserve', 'des Légats'],
    type: 'Vieux marc de Châteauneuf-du-Pape',
    famille: 'vigne',
    liquide: '#c4863a',
    bouteille: 'marc',
    bouchon: '#5a1630',
    garnish: ['grape', 'vineLeaf'],
    habillage: 'comtat',
    notes: [
      { t: 'La page Histoire de la maison la cite parmi les créations de la période Louis Guiot (1951-1989).' },
      { t: 'Son nom évoque les légats qui ont gouverné Avignon et le Comtat après les papes.' },
    ],
  },
  // Produits attestés (page Histoire, boutique officielle, presse, offices de tourisme) mais sans
  // fiche ni prix officiels : « disponibles à la boutique de la distillerie », à confirmer.
  'origan-du-comtat': {
    nom: 'Origan du Comtat',
    lignes: ['Origan', 'du Comtat'],
    type: 'Liqueur de plantes',
    famille: 'fleurs-plantes',
    liquide: '#b88a2e',
    bouteille: 'liqueur',
    bouchon: '#405e77',
    habillage: 'comtat',
    notes: [
      { t: 'Une recette de la fin du XIXe siècle, faite de dizaines de plantes du Ventoux.' },
      { t: 'Elle entre dans la recette des papalines d’Avignon, chocolats au cœur de liqueur.' },
    ],
  },
  'la-comtadine': {
    nom: 'La Comtadine',
    lignes: ['La', 'Comtadine'],
    type: 'Liqueur',
    liquide: '#c49a52',
    bouteille: 'liqueur',
    bouchon: '#9e1b32',
    habillage: 'comtat',
    notes: [{ t: 'Citée par une fiche touristique parmi les liqueurs que l’on déguste gratuitement à la boutique ; absente du site actuel.' }],
  },
  'la-magistrale': {
    nom: 'La Magistrale',
    lignes: ['La', 'Magistrale'],
    type: 'Eau d’arquebuse',
    famille: 'fleurs-plantes',
    liquide: '#a3ad5c',
    bouteille: 'apothicaire',
    bouchage: 'cork',
    habillage: 'ventoux',
    notes: [
      { t: 'La page Histoire de la maison la relie au « Révérend Frère Imbert », chimiste religieux du XVIIIe siècle.' },
      { t: 'Une eau d’arquebuse aux plantes de Provence, dont l’armoise, selon le blog de Gilles Pudlowski.' },
    ],
  },
  'elixir-du-mont-ventoux': {
    nom: 'Élixir du Mont-Ventoux',
    lignes: ['Élixir', 'du Mont-Ventoux'],
    type: 'Liqueur',
    famille: 'fleurs-plantes',
    liquide: '#7a913f',
    bouteille: 'liqueur',
    bouchon: '#55613a',
    habillage: 'ventoux',
    notes: [
      { t: 'Marque déposée à l’INPI par la maison le 29 mai 2000.' },
      { t: 'Vendue par un caviste ; absente du site actuel.' },
      { t: 'À ne pas confondre avec les millésimes de vieux marc « Elixir® ».' },
    ],
  },
  'liqueur-de-lavande': {
    nom: 'Liqueur de lavande',
    lignes: ['Liqueur', 'de lavande'],
    type: 'Liqueur de lavande',
    famille: 'fleurs-plantes',
    liquide: '#8f7bc4',
    bouteille: 'liqueur',
    bouchon: '#6e5c9e',
    habillage: 'ventoux',
    notes: [{ t: 'Vue seulement chez des revendeurs ; absente du site actuel.' }],
  },
  'creme-de-chataigne': {
    nom: 'Crème de châtaigne',
    lignes: ['Crème', 'de châtaigne'],
    type: 'Crème de liqueur',
    famille: 'gourmands',
    liquide: '#6b3f22',
    trouble: true,
    bouteille: 'liqueur',
    bouchon: '#6e4526',
    habillage: 'maison',
    notes: [
      { t: 'La fiche du sirop de châtaigne la cite : « notre crème de châtaigne », dont le sirop est la version sans alcool.' },
      { t: 'La même fiche évoque des liens « très forts » de la maison avec la terre ardéchoise.' },
    ],
  },
  'vieux-marc-elixir-millesimes': {
    nom: 'Vieux marc « Elixir® », millésimes',
    lignes: ['Vieux marc', '« Elixir® »'],
    type: 'Vieux marc de Châteauneuf-du-Pape',
    famille: 'vigne',
    liquide: '#b9772f',
    bouteille: 'marc',
    bouchon: '#5e1a2b',
    habillage: 'marcs',
    notes: [
      { t: 'Libellé de la rubrique des vieux marcs de Châteauneuf-du-Pape de la boutique officielle ; millésimes à confirmer.' },
      { t: 'À ne pas confondre avec l’Élixir du Mont-Ventoux, une liqueur.' },
    ],
  },
  'vieux-marc-de-provence-gros-calan': {
    nom: 'Vieux marc de Provence « Gros Calan »',
    lignes: ['Gros', 'Calan'],
    type: 'Vieux marc de Provence',
    famille: 'vigne',
    liquide: '#a8692a',
    bouteille: 'marc',
    bouchon: '#6e4526',
    habillage: 'marcs',
    notes: [{ t: 'La page Histoire le cite parmi les créations de la période Louis Guiot (1951-1989).' }],
  },
};

// Couleurs dérivées d'une teinte de liquide (fond, dégradé, fond sombre, texte clair).
export function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}
export const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};
function palette(liquide) {
  const pale = lum(liquide) > 0.82;
  const color = pale ? mix(liquide, '#c9a24a', 0.35) : liquide;
  return {
    color,
    color2: mix(color, '#ffffff', 0.35),
    deep: mix(color, '#120b06', 0.72),
    light: mix(color, '#ffffff', 0.82),
  };
}

const THEME_GAMME = Object.fromEntries(GAMMES.map((g) => [g.id, g.theme]));
export const euro = (n) => `${n.toFixed(2).replace('.', ',')} €`;

export const products = catalogue.produits.map((c, index) => {
  const e = P[c.slug] || {};
  // Crème de châtaigne : pas de gamme dans le catalogue officiel, rangée avec les liqueurs régionales.
  const gamme = GAMME_DU_CATALOGUE[c.gamme] || (c.categorie === 'Crèmes' ? 'liqueurs-regionales' : undefined);
  const g = GAMMES.find((x) => x.id === gamme);
  const alcool = c.categorie !== 'Sirops';
  const contenances = c.contenances.map((k) => ({ ...k, prixTexte: k.prix !== null ? euro(k.prix) : null }));
  const premier = contenances[0];
  const bouteille = e.bouteille || (premier?.ml === 700 ? 'sirop70' : premier?.ml === 500 ? 'sirop50' : 'sirop');
  return {
    index,
    id: c.slug,
    slug: c.slug,
    nom: e.nom || c.nomOfficiel,
    nomOfficiel: c.nomOfficiel,
    lignes: e.lignes || [c.nomOfficiel, ''],
    type: e.type || (alcool ? c.categorie : `Sirop ${g?.court || ''}`.trim()),
    categorie: c.categorie,
    gamme,
    gammeNom: g?.nom || c.gamme,
    univers: alcool ? 'spiritueux' : 'sirops',
    alcool,
    theme: e.habillage || THEME_GAMME[gamme] || 'provence',
    arome: c.arome,
    famille: e.famille || null,
    contenances,
    degre: c.degre,
    citation: c.citationLangue === 'fr' ? c.citation : null,
    phrase: e.phrase || (c.citationLangue === 'fr' ? c.citation : null),
    phraseAlcool: !!e.phraseAlcool,
    ingredients: c.ingredients,
    bestSeller: c.bestSeller,
    url: c.url,
    presence: c.presence,
    certitude: c.certitude,
    // « boutique » : disponible à la boutique de la distillerie, présence à confirmer, hors panier.
    disponibilite: c.disponibilite || 'en-ligne',
    enLigne: (c.disponibilite || 'en-ligne') === 'en-ligne',
    notes: e.notes || [],
    conseil: e.conseil || null,
    ...palette(e.liquide || '#c9a24a'),
    // 3D : bouteille dessinée en code tant qu'il n'y a pas de photo (voir photos/LISEZMOI.md)
    bottle: {
      shape: bouteille,
      liquid: e.liquide || '#c9a24a',
      cloudy: !!e.trouble,
      cap: e.bouchon || mix(e.liquide || '#c9a24a', '#1d150c', 0.35),
      closure: e.bouchage || (alcool ? 'capsule' : 'screw'),
    },
    label: e.etiquette || (alcool ? 'maison' : 'provence'),
    garnish: e.garnish || [],
  };
});

export const bySlug = Object.fromEntries(products.map((p) => [p.slug, p]));

export const DISPO_BOUTIQUE = 'Disponible à la boutique de la distillerie';

// Plus petit prix officiel connu (« à partir de »), ou null.
export const minPrice = (p) => {
  const prices = p.contenances.map((c) => c.prix).filter((x) => x !== null);
  return prices.length ? Math.min(...prices) : null;
};

// Produits visibles selon la réponse à la vérification de l'âge.
export const visibleProducts = (age) => products.filter((p) => !p.alcool || age === 'majeur');

// Recettes de la maison : titres de l'index officiel. Une seule a une adresse et une recette
// connues (Le Blue Mojito, sans alcool) ; les autres sont listées sans lien ni ingrédients.
// Type incertain ou inconnu → traité comme « avec alcool » (réservé aux majeurs).
export const recettes = [
  {
    titre: 'Le Blue Mojito',
    url: 'https://www.distillerieablachere.com/fr/recettes/34/le-blue-mojito',
    alcool: false,
    produits: ['fun-blue', 'pac-citron'],
    ingredients: ['2 cl de Fun Blue®', '2 cl de PAC®', '15 cl d’eau pétillante', '1/3 de glace pilée', 'Pour décorer : sucre, citron vert, feuilles de menthe'],
    preparation: 'Ajoutez 1/3 de glace pilée, les deux sirops, puis l’eau pétillante ; ajoutez les tranches de citron et la menthe (verre de 50 cl).',
  },
  { titre: 'Pink Lady (sans alcool)', alcool: false },
  { titre: 'Pink Lady milkshake', alcool: true },
  { titre: 'Colarotte', alcool: true },
  { titre: 'Pink Lady', alcool: true },
  { titre: 'Gambas flambées à la liqueur La Camarguaise®', alcool: true, produits: ['la-camarguaise'] },
];
