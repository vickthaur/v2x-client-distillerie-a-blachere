// Mentions légales et conditions générales de vente : les textes du site de la distillerie
// (src/data/site/textes.json), repris tels quels (typographie seulement : capitales, accents,
// espaces insécables, src/data/corrections.js), avec un sommaire. La mise en page suit le texte :
// liste à puces pour une énumération, tableau seulement pour les coordonnées, paragraphes ailleurs,
// adresses e-mail en liens.
import '../styles/base.css';
import '../styles/brand.css';
import { initSite } from '../app/site.js';
import textes from '../data/textes.js';
import { $, esc } from '../lib/dom.js';
import { espacesOrdinaires } from '../lib/typo.js';
import { REVUE, noteRevue } from '../lib/revue.js';

initSite({ askAge: false });
const NB = '\u00a0';
const slug = (t) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Texte échappé, adresses e-mail en liens.
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const texte = (t) => esc(t).replace(EMAIL, (m) => `<a class="link" href="mailto:${m}">${m}</a>`);

// Ponctuation et coupures de paragraphe des CGV (typographie seulement, mots inchangés ; « \n »
// ouvre un nouveau paragraphe). Appliquées après src/data/corrections.js : à y reporter (table LEGAL)
// si la mise en page change. En développement, une correction qui ne trouve plus son texte le dit.
const MISE_EN_PAGE = [
  // « Service client pour toutes vos questions / magasin@… » → deux-points
  [/ \/ (?=[\w.+-]+@)/, `${NB}: `],
  // adresse collée à la phrase suivante (« …@distillerieablachere.com En cas de litige ») → point
  [/([\w.+-]+@[\w-]+(?:\.[\w-]+)+) (?=[A-ZÀ-Ý])/g, '$1.\n'],
  ['l’adresse postale /mail/tel etc', 'l’adresse postale/mail/tél., etc.'],
];
function miseEnPage(p) {
  return MISE_EN_PAGE.reduce((t, [avant, apres]) => t.replace(avant, apres), p);
}
if (import.meta.env.DEV) {
  const tous = textes.cgv.sections.flatMap((s) => s.paragraphes || []);
  for (const [avant] of MISE_EN_PAGE) {
    const re = avant instanceof RegExp ? new RegExp(avant.source, avant.flags.replace('g', '')) : null;
    if (!tous.some((p) => (re ? re.test(p) : p.includes(avant)))) console.warn('CGV : mise en page sans texte d’origine', String(avant));
  }
}

// Paragraphes d'une section : une phrase terminée par « : » suivie de lignes courtes sans point
// (« Carte Bleue, Visa, Mastercard », « PayPal »…) devient une liste à puces.
const court = (p) => p.length <= 60 && !/[.:;]$/.test(p);
function paragraphesHTML(paragraphes) {
  const ps = paragraphes.flatMap((p) => miseEnPage(p).split('\n')).map((p) => p.trim()).filter(Boolean);
  let html = '';
  for (let i = 0; i < ps.length; i++) {
    html += `<p>${texte(ps[i])}</p>`;
    if (!/:$/.test(ps[i])) continue;
    let j = i + 1;
    while (j < ps.length && court(ps[j])) j++;
    if (j - i - 1 >= 2) {
      html += `<ul>${ps.slice(i + 1, j).map((x) => `<li>${texte(x)}</li>`).join('')}</ul>`;
      i = j - 1;
    }
  }
  return html;
}

// Conditions générales de vente
if ($('#cgv-body')) {
  const s = textes.cgv.sections;
  $('#cgv-toc').innerHTML = `<p class="legal-toc__h">Sommaire</p><ol>${s.map((x) => `<li><a href="#${slug(x.titre)}">${esc(x.titre)}</a></li>`).join('')}</ol>`;
  $('#cgv-body').innerHTML =
    s.map((x) => `<h2 id="${slug(x.titre)}">${esc(x.titre)}</h2>${paragraphesHTML(x.paragraphes || [])}`).join('') +
    noteRevue(`Texte du site de la distillerie (<a class="link" href="${textes.cgv.url || 'https://www.distillerieablachere.com'}" target="_blank" rel="noopener">page des CGV</a>).`, { tag: 'p', cls: 'bsource' });
}

// Mentions légales : le texte officiel, rangé sous ses intertitres. Les coordonnées (« Informations
// légales », « Hébergement ») en tableau, ligne « Libellé : valeur » par ligne ; ailleurs, des
// paragraphes : une phrase terminée par un point est un paragraphe, les lignes courtes qui se
// suivent (délégué, adresse, e-mail) en forment un, ligne à ligne.
if ($('#legal-official')) {
  const lines = textes.mentions.texte.filter((l) => l !== 'Mentions légales');
  const TITRES = ['Informations Légales', 'Protection des données personnelles', 'Protection des mineurs', 'Propriété intellectuelle', 'Liens hypertextes', 'Responsabilité', 'Hébergement :'];
  const TABLEAUX = ['Informations Légales', 'Hébergement :'];
  const sections = [];
  for (const l of lines) {
    const t = espacesOrdinaires(l);
    if (TITRES.includes(t)) sections.push({ titre: l.replace(/\s*:$/, ''), tableau: TABLEAUX.includes(t), lignes: [] });
    else sections.at(-1)?.lignes.push(l);
  }
  const NOMS = { 'Informations Légales': 'Informations légales', Hébergement: 'Hébergement du site de la distillerie' };
  const tableau = (lignes) => {
    let html = '';
    let rangees = [];
    const fermer = () => {
      if (rangees.length) html += `<dl class="legal-dl">${rangees.join('')}</dl>`;
      rangees = [];
    };
    for (const l of lignes) {
      const m = /^([^:]{2,40})\s:\s(.+)$/.exec(l);
      // virgule finale d'une ligne d'adresse (« 3 avenue Saint-Exupéry, ») : inutile dans une case
      if (m) rangees.push(`<div><dt>${esc(m[1])}</dt><dd>${texte(m[2].replace(/,$/, ''))}</dd></div>`);
      else {
        fermer();
        html += `<p>${texte(l)}</p>`;
      }
    }
    fermer();
    return html;
  };
  const prose = (lignes) => {
    let html = '';
    let groupe = [];
    const fermer = () => {
      if (groupe.length) html += `<p>${groupe.map(texte).join('<br />')}</p>`;
      groupe = [];
    };
    for (const l of lignes) {
      if (/\.$/.test(l.trim())) {
        fermer();
        html += `<p>${texte(l)}</p>`;
      } else groupe.push(l);
    }
    fermer();
    return html;
  };
  const html = sections
    .map((s) => `<h2 id="${slug(s.titre)}">${esc(NOMS[s.titre] || s.titre)}</h2>${s.tableau ? tableau(s.lignes) : prose(s.lignes)}`)
    .join('');
  $('#legal-official').innerHTML = html + noteRevue('Texte des mentions légales du site de la distillerie.', { tag: 'p', cls: 'bsource' });
  // sommaire : sans les sections réservées au mode revue (notes de la maquette)
  const titres = [...$('.legal-body').querySelectorAll('h2')].filter((h) => REVUE || !h.closest('[data-revue]'));
  $('#legal-toc').innerHTML = `<p class="legal-toc__h">Sommaire</p><ol>${titres.map((h) => `<li><a href="#${h.id}">${esc(h.textContent)}</a></li>`).join('')}</ol>`;
}
