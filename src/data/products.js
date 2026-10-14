// Gamme de la Distillerie A. Blachère : modifier ici noms, couleurs, textes et bouteilles,
// tout le site suit (carrousel 3D, étiquettes, gros plan, boutique, formulaires).
//
// Règle de la maquette : uniquement des faits publics vérifiés (voir README). Aucun prix,
// degré ou contenance n'est inventé : un champ vide n'est simplement pas affiché.
//
// alcool: true  → produit affiché seulement après la vérification de l'âge (date de naissance),
//                 toujours accompagné du message sanitaire de la loi Évin.
// color / color2 → couleurs du fond et des dégradés ; deep = fond sombre ; light = texte clair.
// bottle         → silhouette (src/data/shapes.js), couleur et transparence du liquide (clarity, depth),
//                  bouchon : 'screw' (vis), 'capsule' ou 'cork' (liège).
// label          → style de l'étiquette dessinée en code (src/three/label.js).
// garnish        → éléments 3D qui flottent autour de la bouteille (src/three/garnish.js).

export const EVIN = 'L’abus d’alcool est dangereux pour la santé, à consommer avec modération.';
export const MINEURS = 'La vente d’alcool est interdite aux mineurs de moins de 18 ans.';

export const products = [
  {
    id: 'pac-citron',
    alcool: false,
    univers: 'Sirop',
    name: ['PAC', 'Citron'],
    fullName: 'PAC Citron',
    kind: 'Sirop de citron',
    format: '1 L',
    price: '6,70 €',
    priceNote: 'TTC le litre',
    tagline: 'Sans colorant ni conservateur',
    description:
      'Le sirop de citron de la maison, lancé en 1960 : 100 % naturel au jus de citron, sans colorant ni conservateur.',
    notes: ['Jus de citron', 'Sans colorant', 'Sans conservateur', '1 L'],
    chapters: [
      { k: '1960', t: ['Né en', '1960'], p: 'Le PAC Citron est lancé en 1960, selon l’histoire de la distillerie.' },
      {
        k: 'P·A·C',
        t: ['Trois lettres,', 'une famille'],
        p: 'Son nom reprend les initiales des enfants de Louis Guiot : Pierre, Annick, Christian et Colette.',
      },
      { k: '100 %', t: ['100 %', 'naturel'], p: 'Au jus de citron, sans colorant ni conservateur.' },
    ],
    backLines: ['100 % naturel au jus de citron.', 'Sans colorant ni conservateur.', 'Lancé en 1960.'],
    color: '#ffd23f',
    color2: '#ff9a3c',
    deep: '#2b1f00',
    light: '#fff3c4',
    bottle: { shape: 'sirop', liquid: '#ffe45c', attenuation: '#ffd000', clarity: 0.45, depth: 2.6, glow: 0.24, cap: '#f3c614', closure: 'screw' },
    label: { style: 'pop', bg: '#ffd23f', bg2: '#ffb52e', ink: '#1f1500', accent: '#ffffff', art: 'lemon' },
    garnish: ['lemonSlice', 'lemon'],
  },
  {
    id: 'fun-blue',
    alcool: false,
    univers: 'Sirop',
    name: ['Fun', 'Blue'],
    fullName: 'Fun Blue',
    kind: 'Sirop menthe bleue',
    format: '1 L',
    price: '6,70 €',
    priceNote: 'TTC le litre',
    tagline: 'La menthe, en bleu',
    description:
      'Le sirop de menthe bleue de la distillerie. Avec le PAC Citron, il porte une gamme d’une trentaine de sirops.',
    notes: ['Menthe bleue', 'Sirop', '1 L'],
    chapters: [
      { k: 'Bleu', t: ['Menthe', 'bleue'], p: 'Fun Blue, c’est le sirop de menthe bleue de la maison.' },
      {
        k: 'Duo',
        t: ['Le duo', 'des sirops'],
        p: 'PAC Citron et Fun Blue sont les deux sirops phares de la distillerie.',
      },
      {
        k: '30',
        t: ['Une trentaine', 'de sirops'],
        p: 'Ils ouvrent une gamme d’une trentaine de sirops, avec la gamme Couleur Provence.',
      },
    ],
    backLines: ['Sirop menthe bleue.', 'Une gamme d’une trentaine de sirops.'],
    color: '#22b8ff',
    color2: '#3de0c0',
    deep: '#021a33',
    light: '#d3f0ff',
    bottle: { shape: 'sirop', liquid: '#1aa7ff', attenuation: '#0a7cff', clarity: 0.95, depth: 1.2, cap: '#1f8fff', closure: 'screw' },
    label: { style: 'pop', bg: '#0f6fe0', bg2: '#22b8ff', ink: '#ffffff', accent: '#3de0c0', art: 'mint' },
    garnish: ['mint', 'ice'],
  },
  {
    id: 'pastis-marra',
    alcool: true,
    univers: 'Pastis',
    name: ['Pastis', 'Marra'],
    fullName: 'Pastis Marra',
    kind: 'Pastis',
    format: '70 cl · 45 % vol.',
    price: '',
    priceNote: '',
    tagline: '40 plantes et épices',
    description:
      'La distillerie est le seul fabricant du pastis Marra depuis 1955. Un pastis à 45 % vol., aux 40 plantes et épices, sans sucre.',
    notes: ['40 plantes et épices', 'Sans sucre', '45 % vol.', '70 cl'],
    chapters: [
      { k: '1955', t: ['Depuis', '1955'], p: 'La distillerie est le seul fabricant du pastis Marra depuis 1955.' },
      { k: '40', t: ['40 plantes', 'et épices'], p: 'Le pastis Marra réunit 40 plantes et épices.' },
      { k: '0', t: ['Sans', 'sucre'], p: 'Un pastis sans sucre, à 45 % vol., en bouteille de 70 cl.' },
    ],
    backLines: ['40 plantes et épices. Sans sucre.', 'Fabriqué par la distillerie depuis 1955.'],
    color: '#f2b134',
    color2: '#3d8bd9',
    deep: '#241500',
    light: '#ffe9b8',
    bottle: { shape: 'pastis', liquid: '#e2a51e', attenuation: '#c27c00', clarity: 0.95, cap: '#1d4f91', closure: 'capsule' },
    label: { style: 'heritage', bg: '#f3e6c4', ink: '#1b2f57', accent: '#d4931c' },
    garnish: ['anise'],
  },
  {
    id: 'la-magistrale',
    alcool: true,
    univers: 'Liqueur',
    name: ['La', 'Magistrale'],
    fullName: 'La Magistrale',
    kind: 'Eau d’arquebuse',
    format: '',
    price: '',
    priceNote: '',
    tagline: 'Eau d’arquebuse aux plantes de Provence',
    description:
      'Une eau d’arquebuse aux plantes de Provence, dont l’absinthe-plante, aussi appelée armoise.',
    notes: ['Eau d’arquebuse', 'Plantes de Provence', 'Armoise'],
    chapters: [
      { k: 'Arquebuse', t: ['Eau', 'd’arquebuse'], p: 'La Magistrale est une eau d’arquebuse aux plantes de Provence.' },
      { k: 'Armoise', t: ['L’absinthe-', 'plante'], p: 'Parmi ses plantes : l’absinthe-plante, que l’on appelle aussi armoise.' },
      {
        k: 'Liqueurs',
        t: ['Une famille', 'de liqueurs'],
        p: 'Elle voisine avec La Comtadine, La Camarguaise, l’Élixir du Mont Ventoux et l’Origan du Comtat.',
      },
    ],
    backLines: ['Eau d’arquebuse aux plantes de Provence,', 'dont l’absinthe-plante (armoise).'],
    color: '#9cc63f',
    color2: '#e3c45c',
    deep: '#122005',
    light: '#e8f6cc',
    bottle: { shape: 'apothicaire', liquid: '#c4cf55', attenuation: '#93a81a', clarity: 0.95, cap: '#8a5a32', closure: 'cork' },
    label: { style: 'heritage', bg: '#efe6cf', ink: '#203513', accent: '#7c9a26' },
    garnish: ['armoise'],
  },
  {
    id: 'origan-du-comtat',
    alcool: true,
    univers: 'Liqueur',
    name: ['Origan', 'du Comtat'],
    fullName: 'Origan du Comtat',
    kind: 'Liqueur',
    format: '',
    price: '',
    priceNote: '',
    tagline: 'Une histoire d’Avignon',
    description:
      'Une liqueur liée à l’histoire d’Avignon : elle aurait aidé à lutter contre le choléra en 1884, et entre dans la recette de la papaline d’Avignon.',
    notes: ['Liqueur', 'Avignon, 1884', 'Papaline d’Avignon'],
    chapters: [
      {
        k: '1884',
        t: ['Avignon,', '1884'],
        p: 'Selon l’histoire de la maison, l’Origan du Comtat aurait aidé à lutter contre le choléra à Avignon en 1884.',
      },
      {
        k: 'Papaline',
        t: ['Dans la', 'papaline'],
        p: 'Il entre dans la recette de la papaline d’Avignon, un chocolat de la ville.',
      },
    ],
    backLines: ['Liqueur de la distillerie.', 'Elle entre dans la recette de la papaline d’Avignon.'],
    color: '#e0526a',
    color2: '#a86b45',
    deep: '#2a0710',
    light: '#ffdde3',
    bottle: { shape: 'liqueur', liquid: '#b8452a', attenuation: '#7a1f0c', clarity: 0.9, cap: '#7a1a2b', closure: 'capsule' },
    label: { style: 'heritage', bg: '#f1e4d0', ink: '#4a0f1c', accent: '#c0392b' },
    garnish: ['origan', 'chocolate'],
  },
  {
    id: 'marc-chateauneuf',
    alcool: true,
    univers: 'Marc',
    name: ['Marc de', 'Châteauneuf'],
    fullName: 'Marc de Châteauneuf-du-Pape',
    kind: 'Marc de Châteauneuf-du-Pape',
    format: '',
    price: '',
    priceNote: '',
    tagline: 'Les vignes de Châteauneuf, distillées',
    description:
      'Le marc du village où la distillerie s’est installée en 1993, au milieu des vignes. Il existe sous les noms « Réserve des Légats » et « Gros Calan ».',
    notes: ['Eau-de-vie de marc', 'Réserve des Légats', 'Gros Calan'],
    chapters: [
      {
        k: '1993',
        t: ['Au milieu', 'des vignes'],
        p: 'Depuis 1993, la distillerie travaille à Châteauneuf-du-Pape, au milieu des vignes.',
      },
      { k: 'Marcs', t: ['Réserve des Légats', 'Gros Calan'], p: 'Deux noms pour le Marc de Châteauneuf-du-Pape de la maison.' },
      { k: 'Eaux-de-vie', t: ['Marcs et', 'eaux-de-vie'], p: 'À côté du Marc de Provence et des eaux-de-vie de fruits.' },
    ],
    backLines: ['Marc de Châteauneuf-du-Pape.', '« Réserve des Légats » · « Gros Calan ».'],
    color: '#d08a34',
    color2: '#8a2f5f',
    deep: '#1f0c05',
    light: '#f9dfc2',
    bottle: { shape: 'marc', liquid: '#d99a3a', attenuation: '#a3570c', clarity: 0.97, cap: '#5a1630', closure: 'capsule' },
    label: { style: 'heritage', bg: '#f2e8d6', ink: '#3a1408', accent: '#a8742c' },
    garnish: ['grape', 'vineLeaf'],
  },
];

// Frise « De 1835 à 2035 ». alcool: true → affiché uniquement après la vérification de l'âge.
export const timeline = [
  {
    year: '1835',
    title: 'Naissance à Avignon',
    text: 'V.L. Blachère et son fils Auguste fondent la distillerie au 14 rue Molière, à Avignon.',
  },
  {
    year: '1884',
    alcool: true,
    title: 'L’Origan du Comtat',
    text: 'Selon l’histoire de la maison, l’Origan du Comtat aurait aidé à lutter contre le choléra à Avignon.',
  },
  {
    year: '1955',
    alcool: true,
    title: 'Le pastis Marra',
    text: 'La distillerie devient le seul fabricant du pastis Marra.',
  },
  {
    year: '1960',
    title: 'Le PAC Citron',
    text: 'Lancement du PAC Citron. Son nom reprend les initiales des enfants de Louis Guiot : Pierre, Annick, Christian et Colette.',
  },
  {
    year: '1993',
    title: 'Au milieu des vignes',
    text: 'La distillerie s’installe à Châteauneuf-du-Pape. Sandrine et Raphaël, la 8e génération, reprennent la maison.',
  },
  {
    year: '2035',
    title: 'Le bicentenaire',
    text: 'Deux cents ans après la rue Molière, la plus ancienne distillerie de Provence fêtera ses 200 ans.',
  },
];

// Faits pratiques (rien d'autre n'est affiché : pas de téléphone ni d'e-mail connus).
export const infos = {
  nom: 'Distillerie A. Blachère',
  adresse: ['1695 route de Sorgues', '84230 Châteauneuf-du-Pape'],
  visite: 'Visite gratuite, sur réservation',
  groupes: '5 € par personne pour les groupes, avec dégustation',
  boutique: 'Boutique ouverte d’octobre à mars, du lundi au samedi, de 10 h à 18 h',
  itineraire: 'https://www.openstreetmap.org/search?query=1695%20route%20de%20Sorgues%2C%2084230%20Ch%C3%A2teauneuf-du-Pape',
};
