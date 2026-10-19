// Les marques PAC et Fun Blue, partout où leur nom est écrit, sans rien saisir à la main :
// - dans un titre ou une étiquette (titres h1–h4, noms de produits et de marques, menus, pied de
//   page, carte des prix) : le vrai logotype vectorisé depuis l'étiquette (public/marques/*.svg,
//   voir scripts/marques.mjs), avec le nom en texte masqué pour les lecteurs d'écran ;
// - dans le texte courant (paragraphes, légendes, fil d'Ariane, filtres) : le nom dans la police la
//   plus proche du logo (Lobster Two gras italique pour pac, Molle italique pour Fun Blue) et dans la
//   couleur de la marque, assez contrastée pour le fond (voir base.css, « Marques »).
// Le texte de la page est parcouru au chargement puis à chaque ajout (MutationObserver) : les
// contenus générés par les pages (cartes, fiches, recettes, archives…) sont traités de la même façon.

// Contextes « logotype » : titres et étiquettes.
const WORDMARK = 'h1, h2, h3, h4, .card__name, .search__name, .brand__name, .mega-brand__name, .menu__brand-name, .hero__tag-name, .bprice__name, .line__name, .co-line__name, .ft__brands a, .piece__brand, [data-wordmark]';
// Titres qui restent du texte courant : titres d'articles de presse cités tels quels.
const TEXTE = '.newscard__title, .bpress__title, [data-texte]';
// Jamais touchés : code, champs, options de liste, éléments déjà traités, textes masqués ; cartels des
// archives (« PAC citron, la femme à la paille », étiquette de 1962 : pas de logotype d'aujourd'hui).
const SKIP = 'script, style, title, textarea, select, option, input, code, pre, svg, canvas, .marque, .wm, .sr-only, .cartel, [data-no-marque]';
// « PAC », « Pac » (Pac à l'eau), « pac », « Fun Blue » : mot entier, hors adresses (www.pac…,
// paccitron.com, @…) et hors mots plus longs (PACA, Pacalo…). « P.A.C. » (étiquette ancienne)
// reste tel qu'il est imprimé.
const SOURCE = '(?<![\\p{L}\\p{N}./@_-])(?:PAC|Pac|pac|Fun[\\s\\u00a0]+Blue|FUN[\\s\\u00a0]+BLUE|Fun[\\s\\u00a0]+blue|FUN[\\s\\u00a0]+Blue)(?![\\p{L}\\p{N}]|\\.[\\p{L}]|\\/)';
const TEST = new RegExp(SOURCE, 'u');

const brandOf = (m) => (/^p/i.test(m) ? 'pac' : 'fb');

function node(match, logo, seul = false) {
  const b = brandOf(match);
  const span = document.createElement('span');
  if (logo) {
    span.className = `wm wm--${b}${seul ? ' wm--seul' : ''}`;
    const t = document.createElement('span');
    t.className = 'sr-only';
    t.textContent = match;
    span.append(t);
  } else {
    span.className = `marque marque--${b}`;
    // « FUN BLUE » en capitales : écrit « Fun Blue », comme sur l'étiquette
    span.textContent = b === 'fb' ? 'Fun Blue' : match;
  }
  return span;
}

export function brandify(root = document.body) {
  if (!root) return;
  if (root.nodeType === 3) {
    if (root.parentElement) brandify(root.parentElement);
    return;
  }
  if (root.nodeType !== 1 || root.closest?.(SKIP)) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!TEST.test(n.data)) return NodeFilter.FILTER_REJECT;
      const el = n.parentElement;
      return !el || el.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  const found = [];
  while (walker.nextNode()) found.push(walker.currentNode);
  for (const n of found) {
    const logo = !!n.parentElement.closest(WORDMARK) && !n.parentElement.closest(TEXTE);
    // Titre fait du seul nom de marque (« Fun Blue », « Fun Blue® ») : le logo prend la place du mot.
    const seul = logo && n.parentElement.textContent.replace(/®/g, '').trim().replace(/\s+/g, ' ') === n.data.trim().replace(/\s+/g, ' ');
    const text = n.data;
    // Un seul élément en ligne pour tout le texte traité : dans un bouton ou une étiquette en flex,
    // le logo ne devient pas un élément à part, écarté des mots voisins par l'espacement du flex.
    const frag = document.createElement('span');
    frag.className = 'mq';
    let last = 0;
    for (const m of text.matchAll(new RegExp(SOURCE, 'gu'))) {
      if (m.index > last) frag.append(text.slice(last, m.index));
      const marque = node(m[0], logo, seul);
      last = m.index + m[0].length;
      // « PAC Citron », « Fun Blue Glacial » : le nom et le mot qui le suit forment un bloc insécable
      // (un logo en ligne laisse sinon une coupure possible juste après lui).
      const suite = /^ ([\p{L}\p{N}][\p{L}\p{N}’'-]*)/u.exec(text.slice(last));
      if (suite) {
        const bloc = document.createElement('span');
        bloc.className = 'mq-bloc';
        bloc.append(marque, `\u00a0${suite[1]}`);
        frag.append(bloc);
        last += suite[0].length;
      } else frag.append(marque);
    }
    if (last < text.length) frag.append(text.slice(last));
    n.replaceWith(frag);
  }
}

let observer = null;
export function watchBrands() {
  if (observer || typeof document === 'undefined') return;
  brandify(document.body);
  observer = new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) brandify(n);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
