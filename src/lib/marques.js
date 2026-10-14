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
const WORDMARK = 'h1, h2, h3, h4, .card__name, .brand__name, .mega-brand__name, .menu__brand-name, .hero__tag-name, .line__name, .co-line__name, .ft__brands a, .piece__brand, [data-wordmark]';
// Jamais touchés : code, champs, options de liste, éléments déjà traités, textes masqués.
const SKIP = 'script, style, title, textarea, select, option, input, code, pre, svg, canvas, .marque, .wm, .sr-only, [data-no-marque]';
// « PAC », « Pac » (Pac à l'eau), « pac », « Fun Blue » : mot entier, hors adresses (www.pac…,
// paccitron.com, @…) et hors mots plus longs (PACA, Pacalo…). « P.A.C. » (étiquette ancienne)
// reste tel qu'il est imprimé.
const SOURCE = '(?<![\\p{L}\\p{N}./@_-])(?:PAC|Pac|pac|Fun[\\s\\u00a0]+Blue|FUN[\\s\\u00a0]+BLUE|Fun[\\s\\u00a0]+blue|FUN[\\s\\u00a0]+Blue)(?![\\p{L}\\p{N}]|\\.[\\p{L}]|\\/)';
const TEST = new RegExp(SOURCE, 'u');

const brandOf = (m) => (/^p/i.test(m) ? 'pac' : 'fb');

function node(match, logo) {
  const b = brandOf(match);
  const span = document.createElement('span');
  if (logo) {
    span.className = `wm wm--${b}`;
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
    const logo = !!n.parentElement.closest(WORDMARK);
    const text = n.data;
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const m of text.matchAll(new RegExp(SOURCE, 'gu'))) {
      if (m.index > last) frag.append(text.slice(last, m.index));
      frag.append(node(m[0], logo));
      last = m.index + m[0].length;
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
