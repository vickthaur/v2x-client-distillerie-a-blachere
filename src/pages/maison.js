// La maison : frise 1835 → 2035 (les dates liées à l'alcool n'apparaissent qu'aux majeurs), la
// famille (portraits à fournir), le lieu, le chantier.
import '../styles/base.css';
import '../styles/editorial.css';
import '../styles/pages.css';
import { initSite, reveal } from '../app/site.js';
import { timelineHTML } from '../app/blocks.js';
import { fillPlaces } from '../app/lieux.js';
import { timeline } from '../data/site.js';
import { $ } from '../lib/dom.js';

const site = initSite();

function render() {
  const majeur = site.majeur;
  $('#frise').innerHTML = timelineHTML({ majeur });
  const hidden = timeline.filter((t) => t.alcool).length;
  $('#frise-note').textContent = majeur ? '' : `${hidden} dates liées aux spiritueux de la maison s’affichent après la vérification de l’âge.`;
  // Le décor du magasin compte aussi l'affiche de l'Origan du Comtat (une liqueur) : majeurs seulement.
  $('#lieu-alcool').innerHTML = majeur
    ? '<li>Au mur, d’après une photo de presse, un grand panneau peint de l’Origan du Comtat.</li><li>Les liqueurs se dégustent gratuitement en boutique.</li>'
    : '';
  reveal();
}

site.onAge(render);
render();
fillPlaces();
