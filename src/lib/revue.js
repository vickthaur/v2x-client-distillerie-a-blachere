// Mode « revue » de la maquette : les notes de travail (sources citées dans le texte, valeurs
// « à confirmer », écarts entre les sources, choses à demander à la distillerie) sont masquées par
// défaut, pour que le site se lise comme un site fini ; une valeur inconnue est alors contournée
// sans rien inventer (« Tarif sur demande », « Sans date »). ?revue les affiche (gardé pour la
// session, avec un filet pointillé et l'étiquette « Note V2X ») ; ?revue=0 les masque de nouveau.
// Les faits restent tracés dans le code, les données (src/data) et le README.
//   HTML : <span data-revue>…</span> (note, visible en revue) ;
//          <span data-revue-hors>…</span> (texte remplacé par la note en revue).
//   JS   : noteRevue(html) et selonRevue(normal, enRevue) écrivent ces balises.
import { readJSON, writeJSON } from './store.js';

const KEY = 'blachere-revue';

function lire() {
  if (typeof location === 'undefined') return false;
  const q = new URLSearchParams(location.search);
  if (q.has('revue')) {
    const on = q.get('revue') !== '0';
    writeJSON(KEY, on, 'session');
    return on;
  }
  return readJSON(KEY, false, 'session') === true;
}

export const REVUE = lire();

// html déjà échappé (ou balisé) ; tag : élément de la note (span dans le texte, p ou div en bloc).
export const noteRevue = (html, { tag = 'span', cls = '' } = {}) => (html ? `<${tag}${cls ? ` class="${cls}"` : ''} data-revue>${html}</${tag}>` : '');
export const selonRevue = (normal, enRevue) => `${normal ? `<span data-revue-hors>${normal}</span>` : ''}${noteRevue(enRevue)}`;

if (typeof document !== 'undefined') {
  document.documentElement.classList.toggle('revue', REVUE);
  // En revue, un repère discret (en bas à droite, la pastille V2X étant à gauche) pour en sortir.
  const repere = () => {
    if (document.querySelector('.revue-tag')) return;
    const url = new URL(location.href);
    url.searchParams.set('revue', '0');
    document.body.insertAdjacentHTML('beforeend', `<p class="revue-tag">Notes de la maquette affichées · <a href="${url.pathname}${url.search}${url.hash}">Masquer</a></p>`);
  };
  if (REVUE) document.body ? repere() : addEventListener('DOMContentLoaded', repere);
}
