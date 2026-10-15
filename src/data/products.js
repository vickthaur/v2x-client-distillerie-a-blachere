// Catalogue affiché par le site : le catalogue officiel du site de la distillerie (relevé du
// 14 octobre 2026, src/data/catalogue.json généré par scripts/import-site.mjs : noms, rubriques,
// contenances et prix TTC, degrés, descriptions et ingrédients exacts) + présentation définie ici
// (noms d'affichage, familles d'arômes, couleurs de liquide pour la 3D de secours, notes sourcées).
//
// Règles de la maquette (voir README) :
// - aucun prix, degré, contenance ou texte inventé : un champ vide n'est pas affiché ;
// - alcool: true → visible seulement après la vérification de l'âge, toujours avec le message
//   sanitaire (loi Évin). Les notes marquées alcool: true (une recette avec alcool, par exemple)
//   ne s'affichent qu'aux personnes majeures, même sur la fiche d'un sirop.
import catalogue from './catalogue.json';
import recettesSite from './site/recettes.json';

export const EVIN = 'L’abus d’alcool est dangereux pour la santé, à consommer avec modération.';
export const MINEURS = 'La vente d’alcool est interdite aux mineurs de moins de 18 ans.';

// Rubriques de la boutique officielle (fil d'Ariane des fiches) ; la gamme range le produit,
// son univers (theme) l'habille.
export const GAMMES = [
  { id: 'pac', nom: 'PAC Citron', univers: 'sirops', theme: 'pac' },
  { id: 'fun-blue', nom: 'Fun Blue', univers: 'sirops', theme: 'funblue' },
  { id: 'couleur-provence', nom: 'Sirops Couleur Provence®', court: 'Couleur Provence®', univers: 'sirops', theme: 'provence' },
  { id: 'pastis-aperitifs', nom: 'Les Apéritifs et Pastis', univers: 'spiritueux', theme: 'maison' },
  { id: 'liqueurs', nom: 'Les Liqueurs', univers: 'spiritueux', theme: 'maison' },
  { id: 'cremes-eaux-de-vie', nom: 'Les Crèmes et Eaux de Vie', univers: 'spiritueux', theme: 'marcs' },
  { id: 'marcs', nom: 'Les Vieux Marcs', univers: 'spiritueux', theme: 'marcs' },
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


// Présentation de chaque produit.
// nom      : nom d'affichage (le nom officiel reste dans nomOfficiel) ; lignes : nom sur deux lignes
// type     : ligne descriptive courte ; famille : famille d'arômes
// liquide  : couleur du liquide (bouteille 3D en attendant les photos) ; trouble : liquide opaque
// etiquette: pac | funblue | provence | maison ; bouteille : silhouette (src/data/shapes.js)
// phrase   : phrase d'accroche (citation de la fiche officielle quand elle existe)
// notes    : faits à afficher sur la fiche : t, la forme publique ; revue, la forme sourcée (site
//            officiel, page Histoire, presse citée), montrée en mode revue (?revue) à la place de t
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
      { t: 'Depuis plus de 60 ans, un « sirop à base de sucre et de citron, sans colorants ».', revue: 'Lancé en 1960 selon la page Histoire de la maison (marque déposée en 1962) : « sirop à base de sucre et de citron, sans colorants ».' },
      { t: 'Son nom, Louis Guiot le compose « de chaque première lettre du prénom de ses enfants : Pierre, Annick, Christian et Colette ».', revue: 'Louis Guiot le compose « de chaque première lettre du prénom de ses enfants : Pierre, Annick, Christian et Colette » (page Histoire).' },
      { t: 'Toujours fabriqué dans le Vaucluse par la Distillerie A. Blachère.', revue: '« Toujours fabriqué dans le Vaucluse par la Distillerie A. Blachère », dit sa fiche.' },
      { t: 'Pour ses 60 ans, en 2023 : quatre étiquettes collector, trois de C215 et une de Claude Viallat.' },
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
      { t: 'À essayer aussi : la Mauresque, pastis et sirop d’orgeat.', revue: 'Sa fiche suggère aussi la Mauresque : pastis et sirop d’orgeat.', alcool: true },
    ],
  },
  'sirop-couleur-provence-grenadine': {
    nom: 'Sirop de grenadine',
    lignes: ['Grenadine', ''],
    famille: 'fruits-rouges',
    liquide: '#b3121d',
    notes: [
      { t: 'À essayer : le Shirley Temple.', revue: 'Idée de la fiche : le Shirley Temple.' },
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
    notes: [{ t: 'À essayer : une vinaigrette au vinaigre balsamique, avec un peu de sirop et d’huile d’olive.', revue: 'Idée de la fiche : une vinaigrette au vinaigre balsamique, avec un peu de sirop et d’huile d’olive.' }],
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
  // ---------- Spiritueux (noms d'affichage ; faits : fiches officielles, page Histoire) ----------
  'pastis-marra': {
    nom: 'Pastis « Marra® »',
    lignes: ['Pastis', 'Marra'],
    type: 'Pastis',
    famille: 'anis-reglisse',
    liquide: '#d39a2c',
    bouteille: 'pastis',
    bouchon: '#1d4f91',
    habillage: 'maison',
    notes: [{ t: 'Il a été créé par un confrère de L’Isle-sur-la-Sorgue, Michel Marra.', revue: 'La page Histoire de la maison raconte qu’il a été créé par un confrère de L’Isle-sur-la-Sorgue, Michel Marra.' }],
  },
  'pastis-le-camarguais': {
    nom: 'Pastis « Le Camarguais® »',
    lignes: ['Le', 'Camarguais'],
    type: 'Pastis',
    famille: 'anis-reglisse',
    liquide: '#dcae47',
    bouteille: 'pastis',
    bouchon: '#8a1c2b',
    habillage: 'camargue',
    notes: [{ t: '« Un des derniers pastis fabriqué à l’ancienne », né de l’amour de Jean-Claude Blachère pour la Camargue.', revue: 'Selon la page Histoire, « un des derniers pastis fabriqué à l’ancienne », né de l’amour de Jean-Claude Blachère pour la Camargue.' }],
  },
  'aperitif-lou-gardian': {
    nom: 'Lou Gardian®',
    lignes: ['Lou', 'Gardian'],
    type: 'Apéritif à la pêche',
    famille: 'vigne',
    liquide: '#e48b6d',
    bouteille: 'liqueur',
    bouchon: '#6d1b2a',
    habillage: 'camargue',
    notes: [{ t: '« Un doux mélange de vin et de pêche ».', revue: 'La page Histoire le décrit comme « un doux mélange de vin et de pêche ».' }],
  },
  'aperitif-a-l-olive-bronzini': {
    nom: 'Apéritif à l’olive « Bronzini® »',
    lignes: ['Bronzini', 'à l’olive'],
    type: 'Apéritif à l’olive',
    famille: 'fleurs-plantes',
    liquide: '#b6a24a',
    bouteille: 'liqueur',
    habillage: 'maison',
  },
  'la-camarguaise': {
    nom: 'La Camarguaise®',
    lignes: ['La', 'Camarguaise'],
    type: 'Liqueur des gardians',
    famille: 'fleurs-plantes',
    liquide: '#b4651f',
    bouteille: 'apothicaire',
    bouchon: '#8a5a32',
    bouchage: 'cork',
    habillage: 'camargue',
    notes: [{ t: 'La première bouteille sérigraphiée de la maison, « à base de thym et de romarin de l’arrière-pays ».', revue: 'Selon la page Histoire, la première bouteille sérigraphiée de la maison, « à base de thym et de romarin de l’arrière-pays ».' }],
  },
  'la-camarguaise-luxe': {
    nom: 'La Camarguaise® Luxe',
    lignes: ['La Camarguaise', 'Luxe'],
    type: 'Liqueur des gardians',
    famille: 'fleurs-plantes',
    liquide: '#b4651f',
    bouteille: 'apothicaire',
    habillage: 'camargue',
  },
  'verveine-auguste-vieilli': {
    nom: 'Verveine « Auguste® » vieillie',
    lignes: ['Verveine', 'Auguste'],
    type: 'Liqueur de verveine vieillie',
    habillage: 'ventoux',
    famille: 'fleurs-plantes',
    liquide: '#5f7a26',
    bouteille: 'liqueur',
    bouchon: '#3f5a1a',
  },
  'verveine-l-ardechoise': {
    nom: 'Verveine « L’Ardéchoise® »',
    lignes: ['Verveine', 'L’Ardéchoise'],
    type: 'Liqueur de verveine',
    habillage: 'ventoux',
    famille: 'fleurs-plantes',
    liquide: '#6d8f2a',
    bouteille: 'liqueur',
  },
  'eau-de-vie-poire-williams-flirt': {
    nom: 'Flirt®, eau-de-vie de poires Williams',
    lignes: ['Flirt', 'Poires Williams'],
    type: 'Eau-de-vie de fruits',
    famille: 'fruits',
    liquide: '#f6f2e6',
    bouteille: 'liqueur',
    bouchon: '#c9a14a',
    habillage: 'marcs',
  },
  'marc-chateauneuf-du-pape-reserve-des-legats': {
    nom: 'Réserve des Légats®',
    lignes: ['Réserve', 'des Légats'],
    type: 'Vieux marc de Châteauneuf-du-Pape hors d’âge',
    famille: 'vigne',
    liquide: '#c4863a',
    bouteille: 'marc',
    bouchon: '#5a1630',
    habillage: 'comtat',
    notes: [
      { t: 'L’un des vieux marcs développés à partir de 1951, sous la direction de Louis Guiot.', revue: 'La page Histoire la cite parmi les vieux marcs développés à partir de 1951, sous la direction de Louis Guiot.' },
      { t: 'Son nom évoque les légats qui ont gouverné Avignon et le Comtat après les papes.' },
    ],
  },
  'vieux-marc-de-provence-gros-calan': {
    nom: 'Marc de Provence « Gros Calan® » 2016',
    lignes: ['Gros', 'Calan'],
    type: 'Vieux marc de Provence, millésime 2016',
    famille: 'vigne',
    liquide: '#a8692a',
    bouteille: 'marc',
    bouchon: '#6e4526',
    habillage: 'marcs',
  },
  'marc-elixir-millesime': {
    type: 'Vieux marc de Châteauneuf-du-Pape « Elixir® »',
    famille: 'vigne',
    liquide: '#b9772f',
    bouteille: 'marc',
    bouchon: '#5e1a2b',
    habillage: 'marcs',
  },
  'origan-du-comtat': {
    nom: 'Origan du Comtat®',
    lignes: ['Origan', 'du Comtat'],
    type: 'Liqueur d’Avignon',
    famille: 'fleurs-plantes',
    liquide: '#b88a2e',
    bouteille: 'liqueur',
    bouchon: '#405e77',
    habillage: 'comtat',
  },
  'la-comtadine': {
    nom: 'La Comtadine®',
    lignes: ['La', 'Comtadine'],
    type: 'Liqueur de Provence',
    famille: 'fleurs-plantes',
    liquide: '#c49a52',
    bouteille: 'liqueur',
    bouchon: '#9e1b32',
    habillage: 'comtat',
  },
  'la-magistrale': {
    nom: 'La Magistrale®',
    lignes: ['La', 'Magistrale'],
    type: 'Eau d’arquebuse',
    famille: 'fleurs-plantes',
    liquide: '#a3ad5c',
    bouteille: 'apothicaire',
    bouchage: 'cork',
    habillage: 'ventoux',
    notes: [{ t: 'Inspirée des produits du révérend frère Imbert, chimiste religieux du XVIIIe siècle.', revue: 'Selon la page Histoire, inspirée des produits du révérend frère Imbert, chimiste religieux du XVIIIe siècle.' }],
  },
  'elixir-du-mont-ventoux': {
    nom: 'Élixir du Mont Ventoux®',
    lignes: ['Élixir', 'du Mont Ventoux'],
    type: 'Liqueur du Ventoux',
    famille: 'fleurs-plantes',
    liquide: '#7a913f',
    bouteille: 'liqueur',
    bouchon: '#55613a',
    habillage: 'ventoux',
  },
  'liqueur-de-lavande': {
    nom: 'Liqueur de lavande « A. Blachère® »',
    lignes: ['Liqueur', 'de lavande'],
    type: 'Liqueur régionale',
    famille: 'fleurs-plantes',
    liquide: '#8f7bc4',
    bouteille: 'liqueur',
    bouchon: '#6e5c9e',
    habillage: 'ventoux',
  },
  'creme-de-chataigne': {
    nom: 'Crème de châtaigne « L’Ardéchoise® »',
    lignes: ['Crème', 'de châtaigne'],
    type: 'Crème de liqueur',
    famille: 'gourmands',
    liquide: '#6b3f22',
    trouble: true,
    bouteille: 'liqueur',
    habillage: 'maison',
    notes: [{ t: 'Inspirée par Jean-Claude Blachère, natif de l’Ardèche.', revue: 'Selon la page Histoire, inspirée par Jean-Claude Blachère, natif de l’Ardèche.' }],
  },
  'creme-de-myrtille': { nom: 'Crème de myrtille « L’Ardéchoise® »', lignes: ['Crème', 'de myrtille'], type: 'Crème de liqueur', famille: 'fruits-rouges', liquide: '#3a1530', bouteille: 'liqueur', habillage: 'maison' },
  'creme-de-framboise': { nom: 'Crème de framboise « L’Ardéchoise® »', lignes: ['Crème', 'de framboise'], type: 'Crème de liqueur', famille: 'fruits-rouges', liquide: '#8a1530', bouteille: 'liqueur', habillage: 'maison' },
  'creme-de-cassis': { nom: 'Crème de cassis « L’Ardéchoise® »', lignes: ['Crème', 'de cassis'], type: 'Crème de liqueur', famille: 'fruits-rouges', liquide: '#2a0a1a', bouteille: 'liqueur', habillage: 'maison' },
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

// Formats vus seulement en grande surface ou chez des revendeurs (complément de la recherche) :
// jamais vendus en ligne, mentionnés sur la fiche.
const AILLEURS = {
  'pac-citron': [{ volume: '70 cl', ou: 'en grande surface' }],
  'fun-blue': [{ volume: '70 cl', ou: 'en grande surface' }],
  'sirop-couleur-provence-orgeat': [{ volume: '70 cl', ou: 'en grande surface' }],
};

const ELIXIR = /ELIXIR®.*MILLESIME (\d{4})/i;
// Nom d'affichage par défaut : le nom officiel, en minuscules soignées.
function displayName(c) {
  const m = c.nomOfficiel.match(ELIXIR);
  if (m) return `Vieux marc « Elixir® » ${m[1]}`;
  return c.nomOfficiel;
}

export const products = catalogue.produits.map((c, index) => {
  const e = P[c.slug] || (ELIXIR.test(c.nomOfficiel) ? P['marc-elixir-millesime'] : {}) || {};
  const gamme = c.gamme;
  const g = GAMMES.find((x) => x.id === gamme);
  const alcool = c.categorie === 'Alcools';
  const contenances = c.contenances.map((k) => ({ ...k, prixTexte: k.prix !== null ? euro(k.prix) : null }));
  const premier = contenances.find((k) => k.ml) || contenances[0];
  const bouteille = e.bouteille || (premier?.ml === 700 ? 'sirop70' : premier?.ml === 500 ? 'sirop50' : 'pac1l');
  const millesime = (c.nomOfficiel.match(ELIXIR) || [])[1] || null;
  return {
    index,
    id: c.slug,
    slug: c.slug,
    idSite: c.idSite,
    nom: e.nom || displayName(c),
    nomOfficiel: c.nomOfficiel,
    lignes: e.lignes || (millesime ? ['Elixir®', millesime] : [displayName(c), '']),
    type: e.type || (alcool ? (c.rubrique || '').split('>').pop().trim() || 'Spiritueux' : `Sirop ${g?.court || ''}`.trim()),
    categorie: c.categorie,
    rubrique: c.rubrique,
    gamme,
    gammeNom: g?.nom || c.rubrique || '',
    univers: alcool ? 'spiritueux' : 'sirops',
    alcool,
    theme: e.habillage || g?.theme || 'provence',
    famille: e.famille || (alcool ? null : null),
    contenances,
    degre: c.degre,
    description: c.description,
    ingredients: c.ingredients,
    nutrition: c.nutrition,
    application: c.application,
    saviezVous: c.saviezVous,
    reference: c.reference,
    // accroche : la première ligne de la description officielle
    phrase: e.phrase || (c.description ? c.description.split('\n').find((l) => l.trim()) : null),
    phraseAlcool: alcool,
    bestSeller: c.bestSeller,
    url: c.url,
    millesime,
    plat: !!c.plat,
    certitude: 'officielle',
    disponibilite: c.disponibilite || 'en-ligne',
    enLigne: (c.disponibilite || 'en-ligne') === 'en-ligne',
    formatsAilleurs: AILLEURS[c.slug] || [],
    notes: e.notes || [],
    conseil: e.conseil || null,
    ...palette(e.liquide || (alcool ? '#c4863a' : '#e2c46a')),
    // 3D de secours (bouteille construite en code) quand la photo manque
    bottle: {
      shape: bouteille,
      liquid: e.liquide || (alcool ? '#c4863a' : '#e2c46a'),
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

// Ligne au-dessus du nom (cartes, recherche) : la gamme ; pour PAC et Fun Blue, dont le nom porte
// déjà le logo de la marque, ce qu'est le produit (« Sirop de citron »).
const MARQUES = new Set(['pac', 'fun-blue']);
export const surtitre = (p) => (MARQUES.has(p.gamme) ? p.type : p.gammeNom);

// « Aussi en 70 cl en grande surface » : formats vus hors du site officiel, jamais vendus en ligne.
export function formatsAilleursTexte(p) {
  if (!p.formatsAilleurs?.length) return null;
  const groups = {};
  p.formatsAilleurs.forEach((f) => (groups[f.ou] ||= []).push(f.volume));
  return Object.entries(groups)
    .map(([ou, v]) => `${p.enLigne ? 'Aussi' : 'Vu'} en ${v.join(' et en ')} ${ou}`)
    .join(' ; ');
}

// Plus petit prix officiel connu (« à partir de »), ou null.
export const minPrice = (p) => {
  const prices = p.contenances.map((c) => c.prix).filter((x) => x !== null);
  return prices.length ? Math.min(...prices) : null;
};

// Produits visibles selon la réponse à la vérification de l'âge.
export const visibleProducts = (age) => products.filter((p) => !p.alcool || age === 'majeur');

// Recettes et cocktails : les fiches officielles (textes exacts et photos, src/data/site/recettes.json).
// alcool: true → réservées aux personnes majeures.
export const recettes = recettesSite.recettes;
