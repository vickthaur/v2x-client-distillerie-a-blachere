// Typographie française des textes affichés : des espaces insécables là où le français les
// demande, pour qu'un signe, une unité ou un symbole ne parte jamais seul à la ligne (QUAL-10).
// Les sources (catalogue officiel, textes de la maquette) s'écrivent avec des espaces ordinaires ;
// typo() pose :
// - une espace insécable (U+00A0) avant « : », après « et avant », avant « € », entre un nombre
//   et son unité (« 70 cl », « 1,75 L », « 100 ml », « 10 h », « 90 °C »), avant « vol. »
//   (« 43 % vol. »), après « n° » et après l'initiale d'un prénom (« A. Blachère ») ;
// - une fine insécable (U+202F) avant « ; ! ? », avant « % » et entre les milliers (« 6 000 »).
// Texte brut seulement, jamais du HTML (une entité « &nbsp; » serait coupée). Idempotente : un
// texte déjà traité ne change plus. Pour comparer ou chercher, espacesOrdinaires() ramène ces
// espaces à des espaces ordinaires (la recherche trouve « 70 cl » tapé au clavier).

export const INSECABLE = '\u00a0';
export const FINE = '\u202f';

// Espaces insécables et fines (U+00A0, U+2007, U+2009, U+200A, U+202F).
const SPECIALES = /[\u00a0\u2007\u2009\u200a\u202f]/g;
export const espacesOrdinaires = (s) => String(s ?? '').replace(SPECIALES, ' ');

// Unités de mesure qui suivent un nombre (la plus longue d'abord : « min » avant « m »).
const UNITE = new RegExp(`(\\d)[ \\u00a0\\u202f]?(kcal|Kcal|kJ|kj|cl|ml|dl|mg|kg|cm|mm|km|min|°C|g|l|L|h|m)(?![\\p{L}\\p{N}])`, 'gu');

export function typo(s) {
  if (typeof s !== 'string' || !s) return s;
  return (
    s
      // guillemets français : « texte »
      .replace(/«[ \u00a0\u202f]*/g, '«\u00a0')
      .replace(/[ \u00a0\u202f]*»/g, '\u00a0»')
      // deux-points (pas ceux d'une heure « 10:30 » ni d'une adresse « https:// »)
      .replace(/(\S)[ \u00a0\u202f]*:(?=\s|$)/g, '$1\u00a0:')
      // point-virgule, point d'exclamation, point d'interrogation (pas ceux d'une adresse « ?q= »)
      .replace(/([^\s;!?])[ \u00a0\u202f]*([;!?]+)(?=[\s»)”"’']|$)/g, '$1\u202f$2')
      // milliers : « 6 000 », « 1 508 428 »
      .replace(/(?<=\d)[ \u00a0](?=\d{3}(?!\d))/g, '\u202f')
      // pour cent, degré d'alcool, euro
      .replace(/(\d)[ \u00a0\u202f]?%/g, '$1\u202f%')
      .replace(/%[ \u00a0\u202f]vol\./g, '%\u00a0vol.')
      .replace(/(\d)[ \u00a0\u202f]?€/g, '$1\u00a0€')
      // heures : « 1 h 30 », « 10 h »
      .replace(/(\d)[ \u00a0\u202f]?h[ \u00a0\u202f]?(\d{2})(?!\d)/g, '$1\u00a0h\u00a0$2')
      // nombre et unité : « 70 cl », « 1,75 L », « 125 g », « 90 °C »
      .replace(UNITE, '$1\u00a0$2')
      // « n° 59-107 », « N° 74-631 »
      .replace(/(^|[^\p{L}])([nN])°[ \u202f]?(?=\d)/gu, '$1$2°\u00a0')
      // initiale d'un prénom : « A. Blachère », « J.-C. Blachère », « M. Auguste »
      .replace(/(?<![\p{L}\p{N}])(\p{Lu})\. (?=\p{Lu})/gu, '$1.\u00a0')
  );
}

// Nom d'un produit dans une phrase (« Avec … ») : un nom commun prend l'article et la minuscule
// (« avec le sirop de grenadine », « avec la liqueur de lavande « A. Blachère® » ») ; une marque
// reste telle quelle (« avec PAC Citron® », « avec L’Élixir du Mont Ventoux® »).
const ARTICLES = [
  [/^Sirop\b/, 'le '],
  [/^Sucre\b/, 'le '],
  [/^Pastis\b/, 'le '],
  [/^Vieux marc\b/, 'le '],
  [/^Marc\b/, 'le '],
  [/^Liqueur\b/, 'la '],
  [/^Crème\b/, 'la '],
  [/^Verveine\b/, 'la '],
  [/^Apéritif\b/, 'l’'],
  [/^Eau-de-vie\b/, 'l’'],
];
export function nomDansPhrase(nom) {
  const s = String(nom ?? '');
  const a = ARTICLES.find(([re]) => re.test(s));
  return a ? a[1] + s[0].toLowerCase() + s.slice(1) : s;
}
