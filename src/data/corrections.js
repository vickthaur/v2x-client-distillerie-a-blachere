// Corrections des textes repris du site officiel de la distillerie (catalogue, recettes, histoire,
// presse, conditions de vente, mentions légales), pour un site qui se lit comme un site soigné.
//
// Où elles s'appliquent : au chargement des données, côté site (src/data/products.js,
// src/data/textes.js, src/app/pieces.js). Les JSON générés par scripts/import-site.mjs gardent les
// textes officiels tels qu'ils ont été relevés : un nouvel import ne perd donc aucune correction, et
// test/corrections.test.js signale une correction dont le texte d'origine a disparu (texte changé
// sur le site officiel). Le serveur garde les textes officiels (catalogue de l'API : commandes,
// courriels, exports du CRM, données de l'espace pro) : scripts/server-catalogue.mjs lit
// produitsOfficiels.
//
// Règles : jamais de mise en minuscules aveugle, chaque correction est écrite à la main ; le sens
// ne change pas, aucune phrase n'est réécrite ni raccourcie ; les symboles ® restent ; dans les
// conditions de vente et les mentions légales, la typographie seulement (casse, accents des
// capitales, espaces, ponctuation), jamais les mots.
//
// Ordre pour chaque texte : nettoyage typographique (NETTOYAGE), corrections communes (PARTOUT),
// corrections propres au texte, puis espaces insécables (typo(), src/lib/typo.js). Les tables sont
// écrites contre le texte nettoyé : apostrophes ’, guillemets « » (espaces ordinaires), points de
// suspension « … ».
import { typo } from '../lib/typo.js';

// ---------------------------------------------------------------- nettoyage typographique

export const NETTOYAGE = [
  // renvois du site officiel restés dans le texte : « (lien vers le produit) », « (lien) »
  [/\s*\(lien(?: vers le produit)?\)/g, ''],
  // ligne parasite (« ` » seul en fin de texte)
  [/\n+`\s*$/g, ''],
  // guillemets droits ou anglais → guillemets français ; ‘titre cité’ → « titre cité »
  [/[“"]\s*([^"“”\n]*?)\s*[”"]/g, '« $1 »'],
  [/‘([^’\n]*)’/g, '« $1 »'],
  [/«\s*/g, '« '],
  [/\s*»/g, ' »'],
  // apostrophe typographique
  [/'/g, '’'],
  // points de suspension : un seul signe, collé au mot qui précède, suivi d'une espace
  [/\.{3,}/g, '…'],
  [/ +…/g, '…'],
  [/…(?=[\p{L}(])/gu, '… '],
  // espaces en trop : avant ®, avant une virgule ou un point, doublées
  [/ +®/g, '®'],
  [/ +([.,])(?=\s|$|[)»])/g, '$1'],
  [/ {2,}/g, ' '],
  // deux-points suivis d'une espace (« kcal :354 »)
  [/ :(?=\S)/g, ' : '],
  // « A » en début de phrase : « À consommer », « À la distillation », « À vous de jouer »
  [/(^|[.!?…]\s+|\n|- )A (?=\p{Ll})/gu, '$1À '],
  // liste à double tiret (« - - À utiliser »)
  [/^- - /gm, '- '],
  // ordinaux : « XVIIIème » → « XVIIIe », « 4eme » → « 4e »
  [/(\d|\b[IVXLC]+)(?:ème|eme)(?!\p{L})/gu, '$1e'],
  // décimales à la française devant une unité (« 0.1 g » → « 0,1 g », « 0.5cl »)
  [/(\d)\.(\d+)(?=[ ]?(?:g|cl|ml|l|L)(?!\p{L}))/gu, '$1,$2'],
  // « < 0,1 g » : signe insécable devant son nombre
  [/<[ ]?(?=\d)/g, '<\u00a0'],
  // unités : kilojoule (kJ), kilocalorie (kcal)
  [/(?<!\p{L})kj(?!\p{L})/gu, 'kJ'],
  [/(?<!\p{L})Kcal(?!\p{L})/gu, 'kcal'],
  // eau-de-vie (orthographe)
  [/([Ee]au)(x?) de vie/g, '$1$2-de-vie'],
  // accents oubliés : goût, arôme, poire Williams
  [/(?<!\p{L})gout(?!\p{L})/gu, 'goût'],
  [/(?<!\p{L})arome(s?)(?!\p{L})/gu, 'arôme$1'],
  [/Poire William(?!s)/g, 'Poire Williams'],
];

export const nettoyer = (texte) => NETTOYAGE.reduce((t, [avant, apres]) => t.replace(avant, apres), texte);

// Remplacements [avant, après] : texte exact (toutes ses occurrences) ou expression régulière.
export const remplacer = (texte, table = []) => table.reduce((t, [avant, apres]) => (avant instanceof RegExp ? t.replace(avant, apres) : t.split(avant).join(apres)), texte);

// ---------------------------------------------------------------- corrections communes

// Noms et marques en capitales, lieux, coquilles qui reviennent d'une fiche à l'autre.
export const PARTOUT = [
  // la maison et ses fondateurs
  ['DISTILLERIE A. BLACHERE', 'Distillerie A. Blachère'],
  ['DISTILLERIE A BLACHERE', 'Distillerie A. Blachère'],
  ['Distillerie A. BLACHERE', 'Distillerie A. Blachère'],
  ['A.BLACHERE', 'A. Blachère'],
  ['A.Blachère', 'A. Blachère'],
  ['J.C BLACHERE le créateur', 'J.-C. Blachère, le créateur'],
  ['Jean Clause Blachère', 'Jean-Claude Blachère'],
  ['Jean-Claude Blachère Amoureux de la Camargue, créé ', 'Jean-Claude Blachère, amoureux de la Camargue, crée '],
  ['CLARA HENACHE-MICHELS', 'Clara Henache-Michels'],
  // marques (le ® reste)
  ['PASTIS « MARRA® »', 'pastis « Marra® »'],
  ['PASTIS MARRA®', 'pastis Marra®'],
  ['distillerie MARRA', 'distillerie Marra'],
  ['PASTIS « LE CAMARGUAIS® »', 'pastis « Le Camarguais® »'],
  ['vrai PASTIS…', 'vrai pastis…'],
  ['LE CAMARGUAIS®', 'Le Camarguais®'],
  ['LA CAMARGUAISE®', 'La Camarguaise®'],
  ['« CAMARGUAISE® »', '« Camarguaise® »'],
  ['liqueur la Camarguaise®', 'liqueur La Camarguaise®'],
  ['LOU GARDIAN®', 'Lou Gardian®'],
  ['L’ORIGAN DU COMTAT®', 'L’Origan du Comtat®'],
  ['L’ORIGAN du COMTAT®', 'L’Origan du Comtat®'],
  ['« ORIGAN DU COMTAT »', '« Origan du Comtat »'],
  ['LES PAPALINES D’AVIGNON®', 'Les Papalines d’Avignon®'],
  ['L’ELIXIR DU MONT VENTOUX®', 'L’Élixir du Mont Ventoux®'],
  ['« ELIXIR DU MONT VENTOUX® »', '« Élixir du Mont Ventoux® »'],
  ['l’Elixir du Mont Ventoux', 'l’Élixir du Mont Ventoux'],
  ['LA COMTADINE®', 'La Comtadine®'],
  ['La COMTADINE®', 'La Comtadine®'],
  ['LA COMTADINE est', 'La Comtadine est'],
  ['« COMTADINES »', '« Comtadines »'],
  ['LA MAGISTRALE®', 'La Magistrale®'],
  ['La MAGISTRALE®', 'La Magistrale®'],
  ['L’ARDÉCHOISE®', 'L’Ardéchoise®'],
  ['L’ARDECHOISE®', 'L’Ardéchoise®'],
  ['Châtaigne l’Ardéchoise®', 'Châtaigne L’Ardéchoise®'],
  ['« MOJITEAU Provençal »', '« Mojiteau provençal »'],
  ['La RÉSERVE DES LÉGATS®', 'La Réserve des Légats®'],
  ['VIEUX Marc de Provence', 'Vieux Marc de Provence'],
  ['FLIRT®', 'Flirt®'],
  ['La VERVEINE AUGUSTE®', 'La verveine Auguste®'],
  ['Très vite, FUN BLUE®, devient', 'Très vite, Fun Blue® devient'],
  ['FUN BLUE®', 'Fun Blue®'],
  ['FUN BLUE', 'Fun Blue'],
  ['La menthe FUN par excellence', 'La menthe Fun par excellence'],
  ['CHLOROPHYLLE', 'chlorophylle'],
  ['eaux-de-vie de MARC', 'eaux-de-vie de marc'],
  // lieux (noms officiels)
  ['CHÂTEAUNEUF DU PAPE', 'Châteauneuf-du-Pape'],
  ['CHATEAUNEUF DU PAPE', 'Châteauneuf-du-Pape'],
  ['Chateauneuf-du-Pape', 'Châteauneuf-du-Pape'],
  ['Châteauneuf du pape', 'Châteauneuf-du-Pape'],
  ['hors d’age', 'hors d’âge'],
  ['VAUCLUSE', 'Vaucluse'],
  ['Les Saintes Maries de la Mer, Aigues Mortes, Port Saint Louis, le Grau du Roi', 'Les Saintes-Maries-de-la-Mer, Aigues-Mortes, Port-Saint-Louis, le Grau-du-Roi'],
  ['Saintes-Maries-de-la-mer', 'Saintes-Maries-de-la-Mer'],
  ['l’Isle-sur-la-Sorgues', 'L’Isle-sur-la-Sorgue'],
  ['l’Isle-sur-sorgues', 'L’Isle-sur-la-Sorgue'],
  ['l’Isle-sur-la-Sorgue', 'L’Isle-sur-la-Sorgue'],
  ['l’ardèche', 'l’Ardèche'],
  ['mont ventoux', 'mont Ventoux'],
  ['l’Ile de la Réunion', 'l’île de la Réunion'],
  ['des iles françaises', 'des îles françaises'],
  ['Frederic Mistral le grand poete provencal', 'Frédéric Mistral, le grand poète provençal'],
  // adjectifs de lieu (minuscule) et habitants (majuscule)
  ['la terre Ardéchoise', 'la terre ardéchoise'],
  ['le kir Ardéchois', 'le kir ardéchois'],
  ['typiquement Provençal', 'typiquement provençal'],
  ['réellement Provençal', 'réellement provençal'],
  ['pastis provencal, Marseillais', 'pastis provençal, marseillais'],
  ['culture Camarguaise', 'culture camarguaise'],
  ['spécialité Avignonnaise', 'spécialité avignonnaise'],
  ['invasions Mauresques', 'invasions mauresques'],
  ['l’histoire Papale', 'l’histoire papale'],
  ['les provençaux l’ont', 'les Provençaux l’ont'],
  // coquilles
  ['Mente « Aurélie »', 'Menthe « Aurélie »'],
  ['du coté de', 'du côté de'],
  ['flamands roses', 'flamants roses'],
  ['les flamands qui', 'les flamants qui'],
  ['auprés', 'auprès'],
  ['Révérand', 'Révérend'],
  ['13 Juin 1890', '13 juin 1890'],
  ['épidémie de Choléra', 'épidémie de choléra'],
  ['parmis lesquelles', 'parmi lesquelles'],
  ['MéIisse', 'Mélisse'],
  ['Cardamone', 'Cardamome'],
  ['Sariette', 'Sarriette'],
  ['l’anethol', 'l’anéthol'],
  ['arômatique', 'aromatique'],
  ['chataîgne', 'châtaigne'],
  ['de couleur doré dégage', 'de couleur dorée dégage'],
  ['pêche bien mure', 'pêche bien mûre'],
  ['fleurs, epices, plantes', 'fleurs, épices, plantes'],
  ['Dans des futs centenaires', 'Dans des fûts centenaires'],
  ['Des futs anciens', 'Des fûts anciens'],
  ['Le fut date', 'Le fût date'],
  ['Ce fut ancien', 'Ce fût ancien'],
  ['pleinement.sans', 'pleinement sans'],
  ['garder la plus de matière', 'garder le plus de matière'],
  ['ont toujours contenus', 'ont toujours contenu'],
  ['Ces Marcs ont vieillis', 'Ces Marcs ont vieilli'],
  ['plusieurs Marc millésimés', 'plusieurs Marcs millésimés'],
  ['De nombreux fabricant ont', 'De nombreux fabricants ont'],
  ['les boissons anisée ont', 'les boissons anisées ont'],
  ['avait conclut', 'avait conclu'],
  ['ont pour la plupart modifiés', 'ont pour la plupart modifié'],
  ['le sucre est l’alcool', 'le sucre et l’alcool'],
  ['étaient ramassée par', 'étaient ramassées par'],
  ['plantes qui la compose, étaient', 'plantes qui la composent, étaient'],
  ['La verveine est intrinsèquement lié ', 'La verveine est intrinsèquement liée '],
  ['Il s’utilise pure', 'Il s’utilise pur'],
  ['l’allongée d’eau', 'l’allonger d’eau'],
  ['légèrement anisées qui rappelle', 'légèrement anisées qui rappellent'],
  ['Boisson concentré ', 'Boisson concentrée '],
  ['au couleur claire', 'à la couleur claire'],
  ['notes d’ écorce', 'notes d’écorce'],
  ['florales vanillée et briochée', 'florales vanillées et briochées'],
  ['brun au nuance orange', 'brun aux nuances orange'],
  ['amère et pimenté.', 'amère et pimentée.'],
  ['ce côté mentholée', 'ce côté mentholé'],
  ['des notes mentholée,', 'des notes mentholées,'],
  ['de jolie note torréfié et grillé', 'de jolies notes torréfiées et grillées'],
  ['délicieusement harmonieuse de', 'délicieusement harmonieuses de'],
  ['d’herbe séchées', 'd’herbes séchées'],
  ['Olfactif : Des notes', 'Olfactif : des notes'],
  ['des notes réglisées', 'des notes réglissées'],
  ['« pousse café »', '« pousse-café »'],
  ['cette fois ci', 'cette fois-ci'],
  ['Vous souvenez vous', 'Vous souvenez-vous'],
  ['Son parfum, vous rappellera', 'Son parfum vous rappellera'],
  ['sucre de canne ou il y a', 'sucre de canne où il y a'],
  ['en Provence ou le PAC®', 'en Provence où le PAC®'],
  ['de 2 x 1,5 m', 'de 2 × 1,5 m'],
  ['etc…', 'etc.'],
  ['Camargue, Au cœur', 'Camargue, au cœur'],
  ['A. Blachère : Il portera', 'A. Blachère : il portera'],
  // recettes
  ['1c.à.c', '1\u00a0c.\u00a0à\u00a0c.'],
  ['les des deux sirops', 'les deux sirops'],
  ['la bananes séchées', 'les bananes séchées'],
  ['Régalez vous', 'Régalez-vous'],
  ['soupoudrez', 'saupoudrez'],
  ['Une banche de', 'Une branche de'],
  ['verinnes', 'verrines'],
  ['delicatement', 'délicatement'],
  ['préparez le sirop : Dans', 'préparez le sirop : dans'],
];

// ---------------------------------------------------------------- fiches produits

// Par fiche (slug) et par champ : première ligne des descriptions en capitales, ponctuation
// propre à un texte.
export const FICHES = {
  'pac-citron': { description: [['LE SIROP DE CITRON ULTIME !', 'Le sirop de citron ultime !']] },
  'sirop-citron': { saviezVous: [['de citron « PAC Citron® »\n', 'de citron « PAC Citron® ».\n']] },
  'sirop-couleur-provence-figue': {
    saviezVous: [
      ['la figue noire de solfies', 'la figue noire de Solliès'],
      ['à la vanille… LIENS', 'à la vanille…'],
    ],
  },
  'origan-du-comtat': {
    saviezVous: [
      ['de la cité des Papes\n', 'de la cité des Papes.\n'],
      ['En 1959 : Les maitres', 'En 1959 : les maitres'],
    ],
  },
  'elixir-du-mont-ventoux': { application: [['un Trou Provençal (sorbet pèche arrosée', 'un trou provençal (sorbet pêche arrosé']] },
  'la-comtadine': { saviezVous: [['fièro ? - Vau au Ventour - Culi de flour pèr la liquour - Que fai Blachèro.', 'fièro ? – Vau au Ventour – Culi de flour pèr la liquour – Que fai Blachèro.']] },
  'creme-de-framboise': { description: [['le sucre et l’alcool\n', 'le sucre et l’alcool.\n']] },
  'verveine-auguste-vieilli': { description: [['à 2000 exemplaires', 'à 2 000 exemplaires']] },
  'vieux-marc-de-provence-gros-calan': {
    description: [
      ['Olfactif : Au nez', 'Olfactif : au nez'],
      ['Gustatif : La bouche', 'Gustatif : la bouche'],
    ],
  },
};

// ---------------------------------------------------------------- recettes

// Titres en capitales du site officiel → casse de phrase (noms propres et marques gardés).
export const TITRES_RECETTES = {
  'BLUE MOJITO': 'Blue Mojito',
  'BLUE MOJITO SANS ALCOOL': 'Blue Mojito sans alcool',
  'CAFÉ VIENNOIS DE MR AUGUSTE': 'Café viennois de M. Auguste',
  'CAFÉ VIENNOIS DE MR AUGUSTE SANS ALCOOL': 'Café viennois de M. Auguste sans alcool',
  'BANANE ARRANGÉE': 'Banane arrangée',
  'BANANE ARRANGÉE SANS ALCOOL': 'Banane arrangée sans alcool',
  DAIKIWI: 'Daikiwi',
  'DAIKIWI SANS ALCOOL': 'Daikiwi sans alcool',
  'BORA BORA': 'Bora Bora',
  'BORA BORA SANS ALCOOL': 'Bora Bora sans alcool',
  'EL MIQUEL': 'El Miquel',
  'EL MIQUEL SANS ALCOOL': 'El Miquel sans alcool',
  'CAFÉ IRLANDAIS': 'Café irlandais',
  'AMERICAN ROSE': 'American Rose',
  "D'ICI ET D'AILLEURS": 'D’ici et d’ailleurs',
  'CARTON BLEU': 'Carton bleu',
  'CARTON BLEU SANS ALCOOL': 'Carton bleu sans alcool',
  COLAROTTE: 'Colarotte',
  'GAMBAS FLAMBÉES À LA LIQUEUR LA CAMARGUAISE®': 'Gambas flambées à la liqueur La Camarguaise®',
  'TARTARE DE SAUMON ET FRUIT DE LA PASSION': 'Tartare de saumon et fruit de la passion',
  'MERINGUE FRANÇAISE AU SIROP': 'Meringue française au sirop',
  'TIRAMISU À LA CHÂTAIGNE': 'Tiramisu à la châtaigne',
  'MADELEINE À LA LAVANDE OU VIOLETTE': 'Madeleine à la lavande ou violette',
  'PINK LADY (milkshake)': 'Pink Lady (milkshake)',
  'PINK LADY': 'Pink Lady',
  'PINK LADY SANS ALCOOL': 'Pink Lady sans alcool',
};

// ---------------------------------------------------------------- histoire, presse

// La citation de Mistral en capitales, avec des guillemets anglais.
export const EPIGRAPHES = {
  '“OÙ VAS-TU COMTADINE FIÈRE ? JE VAIS AU VENTOUX CUEILLIR DES FLEURS POUR LA LIQUEUR QUE FAIT BLACHÈRE”': '« Où vas-tu, Comtadine fière ? Je vais au Ventoux cueillir des fleurs pour la liqueur que fait Blachère. »',
};

export const HISTOIRE = [
  // initiales du fondateur (prénom inconnu : V.-L. s'il est composé, à demander à la distillerie)
  ['V.L Blachère', 'V.L. Blachère'],
  ['vieux marcs : La « Réserve des Légats »', 'vieux marcs : la « Réserve des Légats »'],
  ['« GROS CALAN »', '« Gros Calan »'],
  ['l’arrière pays', 'l’arrière-pays'],
  ['Evasion et innovations', 'Évasion et innovations'],
  ['cet nouvel élan', 'ce nouvel élan'],
  ['la liqueur « l’Ardéchoise »', 'la liqueur « L’Ardéchoise »'],
];

// Titres de « On parle de nous » (titre relevé → titre corrigé).
export const TITRES_PRESSE = {
  'ICI VAUCLUSE, Le saviez vous ?': 'Ici Vaucluse, le saviez-vous ?',
  "LE SEUL, LE VRAI, L'UNIQUE : LE PACALO": 'Le seul, le vrai, l’unique : le Pacalo',
  '‘Avignon’, le fim primé au Festival de l’Alpe d’Huez en vedette au cinéma Capitole': '« Avignon », le film primé au Festival de l’Alpe d’Huez en vedette au cinéma Capitole',
  'DISTILLERIE BLACHÈRE UNE LÉGENDE CENTENAIRE': 'Distillerie Blachère, une légende centenaire',
  "PAC citron l'édition collector": 'PAC Citron, l’édition collector',
  'Un marche en effervescence': 'Un marché en effervescence',
  'Echappées belle aix en provence': 'Échappées belles, Aix-en-Provence',
};

// ---------------------------------------------------------------- textes légaux

// Conditions de vente et mentions légales : typographie seulement (casse, accents, espaces,
// ponctuation, numéros de téléphone), jamais les mots.
export const LEGAL = [
  ['L’Abus d’alcool', 'L’abus d’alcool'],
  ['rubrique BOUTIQUE', 'rubrique « Boutique »'],
  ['prix des articles La Distillerie', 'prix des articles. La Distillerie'],
  [/\s*=>\s*/g, ' → '],
  ['route de sorgues 84230 Châteauneuf-du-Pape ou PAR MAIL/ ', 'route de Sorgues, 84230 Châteauneuf-du-Pape, ou par mail : '],
  ['165 493 EUROS', '165 493 euros'],
  ['1695 ROUTE DE SORGUES', '1695 route de Sorgues'],
  ['Distillerie A. Blachère 1695 route de Sorgues 84230 Châteauneuf-du-Pape', 'Distillerie A. Blachère, 1695 route de Sorgues, 84230 Châteauneuf-du-Pape'],
  ['04.90.83.53.81 BOUTIQUE 04.90.83.55.65', '04\u00a090\u00a083\u00a053\u00a081, boutique 04\u00a090\u00a083\u00a055\u00a065'],
  ['Mme VANNELLE Sandrine Par courrier :', 'Mme Sandrine Vannelle. Par courrier :'],
  ['21 Juin 2014', '21 juin 2014'],
  ['l’Economie Numérique', 'l’économie numérique'],
  ['06 Août 2004', '6 août 2004'],
  [/auprès de la Distillerie A\. Blachère$/, 'auprès de la Distillerie A. Blachère.'],
  ['3 avenue saint exupery,', '3 avenue Saint-Exupéry,'],
];

// ---------------------------------------------------------------- application

// Un texte : nettoyage, corrections communes, corrections propres, espaces insécables.
export function corrigerTexte(texte, propres = []) {
  if (typeof texte !== 'string' || !texte) return texte;
  return typo(remplacer(remplacer(nettoyer(texte), PARTOUT), propres));
}

const CHAMPS_FICHE = ['description', 'ingredients', 'nutrition', 'application', 'saviezVous'];

// Fiche du catalogue officiel (src/data/catalogue.json) : textes corrigés, le reste inchangé.
export function corrigerFiche(c) {
  const propres = FICHES[c.slug] || {};
  return { ...c, ...Object.fromEntries(CHAMPS_FICHE.map((k) => [k, corrigerTexte(c[k], propres[k])])) };
}

// Recette officielle (src/data/site/recettes.json).
export function corrigerRecette(r) {
  const lignes = (l) => (Array.isArray(l) ? l.map((x) => corrigerTexte(x)) : l);
  return {
    ...r,
    titre: corrigerTexte(TITRES_RECETTES[r.titre] ?? r.titre),
    ingredients: lignes(r.ingredients),
    decoration: lignes(r.decoration),
    preparation: lignes(r.preparation),
    notes: lignes(r.notes),
  };
}

// Textes officiels (src/data/site/textes.json) : histoire, presse, conditions de vente, mentions.
export function corrigerTextes(t) {
  const legal = (x) => corrigerTexte(x, LEGAL);
  return {
    ...t,
    histoire: {
      ...t.histoire,
      epigraphe: corrigerTexte(EPIGRAPHES[t.histoire.epigraphe] ?? t.histoire.epigraphe),
      periodes: t.histoire.periodes.map((p) => ({ ...p, paragraphes: p.paragraphes.map((x) => corrigerTexte(x, HISTOIRE)) })),
    },
    // titre corrigé ; date sans zéro initial (« 7 mai 2026 »)
    presse: t.presse.map((a) => ({ ...a, titre: corrigerTexte(TITRES_PRESSE[a.titre] ?? a.titre), date: (a.date || '').replace(/^0(\d)/, '$1') })),
    cgv: { ...t.cgv, sections: t.cgv.sections.map((s) => ({ ...s, titre: typo(s.titre), paragraphes: s.paragraphes.map(legal) })) },
    mentions: { ...t.mentions, texte: t.mentions.texte.map(legal) },
  };
}

// Cartels des archives (écrits par V2X, scripts/archives-site.json) : espaces insécables seulement.
export const corrigerPiece = (p) => ({ ...p, titre: typo(p.titre), date: typo(p.date), technique: typo(p.technique), legende: typo(p.legende) });
