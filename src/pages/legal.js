// Mentions légales et conditions générales de vente : les textes du site de la distillerie
// (src/data/site/textes.json), repris tels quels, avec un sommaire.
import '../styles/base.css';
import '../styles/brand.css';
import { initSite } from '../app/site.js';
import textes from '../data/site/textes.json';
import { $, esc } from '../lib/dom.js';
import { REVUE, noteRevue } from '../lib/revue.js';

initSite({ askAge: false });
const slug = (t) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Conditions générales de vente
if ($('#cgv-body')) {
  const s = textes.cgv.sections;
  $('#cgv-toc').innerHTML = `<p class="legal-toc__h">Sommaire</p><ol>${s.map((x) => `<li><a href="#${slug(x.titre)}">${esc(x.titre)}</a></li>`).join('')}</ol>`;
  $('#cgv-body').innerHTML =
    s.map((x) => `<h2 id="${slug(x.titre)}">${esc(x.titre)}</h2>${(x.paragraphes || []).map((p) => `<p>${esc(p)}</p>`).join('')}`).join('') +
    noteRevue(`Texte du site de la distillerie (<a class="link" href="${textes.cgv.url || 'https://www.distillerieablachere.com'}" target="_blank" rel="noopener">page des CGV</a>).`, { tag: 'p', cls: 'bsource' });
}

// Mentions légales : le texte officiel, rangé sous ses intertitres
if ($('#legal-official')) {
  const lines = textes.mentions.texte.filter((l) => l !== 'Mentions légales');
  const TITRES = ['Informations Légales', 'Protection des données personnelles', 'Protection des mineurs', 'Propriété intellectuelle', 'Liens hypertextes', 'Responsabilité', 'Hébergement :'];
  let html = '';
  let open = false;
  for (const l of lines) {
    if (TITRES.includes(l)) {
      if (open) html += '</dl>';
      const t = l.replace(/\s*:$/, '');
      html += `<h2 id="${slug(t)}">${esc(t === 'Informations Légales' ? 'Informations légales' : t === 'Hébergement' ? 'Hébergement du site de la distillerie' : t)}</h2><dl class="legal-dl">`;
      open = true;
      continue;
    }
    const m = /^([^:]{2,40}) : (.+)$/.exec(l);
    html += m ? `<div><dt>${esc(m[1])}</dt><dd>${esc(m[2])}</dd></div>` : `<div class="legal-dl__p"><dd>${esc(l)}</dd></div>`;
  }
  if (open) html += '</dl>';
  $('#legal-official').innerHTML = html + noteRevue('Texte des mentions légales du site de la distillerie.', { tag: 'p', cls: 'bsource' });
  // sommaire : sans les sections réservées au mode revue (notes de la maquette)
  const titres = [...$('.legal-body').querySelectorAll('h2')].filter((h) => REVUE || !h.closest('[data-revue]'));
  $('#legal-toc').innerHTML = `<p class="legal-toc__h">Sommaire</p><ol>${titres.map((h) => `<li><a href="#${h.id}">${esc(h.textContent)}</a></li>`).join('')}</ol>`;
}
