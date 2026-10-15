// PAC et Fun Blue dans le CRM : même règle que src/lib/marques.js (le site), en composant Preact
// (le parcours du DOM de marques.js ne doit pas toucher aux nœuds gérés par Preact).
// - logo : dans un nom de produit ou un titre, le logotype vectorisé (nom gardé pour les lecteurs
//   d'écran) ;
// - sinon, dans le texte courant : la police la plus proche du logo et la couleur de la marque.
const SOURCE = '(?<![\\p{L}\\p{N}./@_-])(?:PAC|Pac|pac|Fun[\\s\\u00a0]+Blue|FUN[\\s\\u00a0]+BLUE|Fun[\\s\\u00a0]+blue|FUN[\\s\\u00a0]+Blue)(?![\\p{L}\\p{N}]|\\.[\\p{L}]|\\/)';
const TEST = new RegExp(SOURCE, 'u');

export const aMarque = (t) => typeof t === 'string' && TEST.test(t);

export function Marque({ texte, logo = false }) {
  if (!aMarque(texte)) return texte ?? null;
  const out = [];
  let dernier = 0;
  let i = 0;
  for (const m of texte.matchAll(new RegExp(SOURCE, 'gu'))) {
    if (m.index > dernier) out.push(texte.slice(dernier, m.index));
    const pac = /^p/i.test(m[0]);
    if (logo) {
      out.push(
        <span class={`wm wm--${pac ? 'pac' : 'fb'}`} key={i++}>
          <span class="sr-only">{m[0]}</span>
        </span>,
      );
    } else {
      out.push(
        <span class={`marque marque--${pac ? 'pac' : 'fb'}`} key={i++}>
          {pac ? m[0] : 'Fun Blue'}
        </span>,
      );
    }
    dernier = m.index + m[0].length;
  }
  if (dernier < texte.length) out.push(texte.slice(dernier));
  return out;
}
