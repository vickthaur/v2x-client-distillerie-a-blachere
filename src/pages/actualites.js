// Actualités : nouvelles datées et sourcées, rubrique « On parle de nous ».
import '../styles/base.css';
import '../styles/editorial.css';
import '../styles/pages.css';
import { initSite, reveal } from '../app/site.js';
import { newsHTML, pressHTML } from '../app/blocks.js';
import { $ } from '../lib/dom.js';

const site = initSite();
function render() {
  $('#actus').innerHTML = newsHTML();
  $('#presse').innerHTML = pressHTML({ majeur: site.majeur });
  reveal();
}
site.onAge(render);
render();
