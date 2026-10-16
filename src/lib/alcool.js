// Mots de l'alcool : un texte qui en contient n'est montré qu'aux personnes majeures (loi Évin et
// règle de la maquette : un mineur ne voit jamais d'alcool). Filtrage par phrase ou par ligne,
// sans jamais réécrire un texte officiel.
export const ALCOOL = /\b(bières?|pastis|tequila|vodka|rhums?|gin|whiskys?|vins?|champagnes?|liqueurs?|alcools?|alcoolisée?s?|apéritifs?|anisé|cognac|armagnac|martini|kir|spritz|prosecco|cidres?|calvados|absinthe|mojito|caïpirinha|ti-punch|punch|marcs?|eaux?-de-vie|eau d’arquebuse|breuvages?|potions?|distillation|macérations?|Camarguaise|Camarguais|Lou Gardian|Marra|Zoulla|Origan|Magistrale|Ardéchoise|Thé au Magot|Légats|Calan)\b/i;

export const hasAlcool = (t) => ALCOOL.test(t || '');

// Espaces ordinaires regroupées ; les insécables de la typographie (src/lib/typo.js) restent.
export const resserrer = (t) => (t || '').replace(/[^\S\u00a0\u202f]+/g, ' ').trim();

// Phrases d'un texte sans celles qui parlent d'alcool.
export function phrasesSansAlcool(text) {
  const parts = (text || '').match(/[^.!?…]+(?:[.!?…]+[»”]?|$)/g) || [];
  return resserrer(parts.filter((x) => !ALCOOL.test(x)).join(''));
}
