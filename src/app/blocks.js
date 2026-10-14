// Blocs éditoriaux partagés par les pages (accueil, marques, maison, visites, actualités…).
// Tout le texte vient de src/data (faits sourcés) ; un bloc qui touche à l'alcool ne s'affiche
// qu'aux personnes majeures (paramètre majeur).
import { EVIN, MINEURS } from '../data/products.js';
import { actualites, formules, presse, timeline, saison } from '../data/site.js';
import { esc } from '../lib/dom.js';
import { icons } from '../lib/icons.js';

// ---------- Les 60 ans en collector (2023) ----------
// Les œuvres de C215 et de Claude Viallat ne sont pas reproduites : cadres neutres « visuel à
// fournir », en attendant l'accord des artistes. Leurs couleurs ne servent qu'à encadrer.
export const COLLECTORS = [
  { artiste: 'C215', nom: 'Christian Guémy', role: 'Graffeur, pochoiriste', n: 1, k: 'var(--c215-cyan)' },
  { artiste: 'C215', nom: 'Christian Guémy', role: 'Graffeur, pochoiriste', n: 2, k: 'var(--c215-rose)' },
  { artiste: 'C215', nom: 'Christian Guémy', role: 'Graffeur, pochoiriste', n: 3, k: 'var(--c215-lime)' },
  { artiste: 'Claude Viallat', nom: '', role: 'Peintre', n: 4, k: 'var(--viallat-rouge)' },
];

export function collectorsHTML() {
  return `<ul class="frames" aria-label="Les quatre étiquettes collector des 60 ans">${COLLECTORS.map(
    (c) => `<li class="frame" style="--k:${c.k}" data-reveal>
      <div class="frame__mat"><span class="frame__ph">Visuel à fournir par la distillerie</span></div>
      <p class="frame__cartel"><strong>${esc(c.artiste)}</strong>${c.nom ? ` <span>(${esc(c.nom)})</span>` : ''}<br />${esc(c.role)} · étiquette collector n° ${c.n} · 2023</p>
    </li>`,
  ).join('')}</ul>`;
}

// ---------- Frise 1835 → 2035 ----------
export function timelineHTML({ majeur = false, only = null, compact = false } = {}) {
  const items = timeline.filter((t) => (!t.alcool || majeur) && (!only || only.includes(t.year)));
  return `<ol class="frise${compact ? ' frise--compact' : ''}">${items
    .map(
      (t) => `<li class="frise__item${t.future ? ' is-future' : ''}" data-reveal>
        <p class="frise__year">${esc(t.label || t.year)}</p>
        <h3 class="frise__title">${esc(t.title)}</h3>
        ${compact ? '' : `<p class="frise__text">${esc(t.text)}</p>`}
      </li>`,
    )
    .join('')}</ol>`;
}

// ---------- Visites : les quatre formules ----------
export function formulesHTML({ compact = false, choose = false } = {}) {
  return `<ul class="formules${compact ? ' formules--compact' : ''}">${formules
    .map(
      (f, i) => `<li class="formule" data-reveal>
        <p class="formule__n">0${i + 1}</p>
        <h3 class="formule__nom">${esc(f.nom)}</h3>
        <p class="formule__sous">${esc(f.sous)}</p>
        ${compact ? '' : `<ul class="formule__voir">${f.voir.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>`}
        <dl class="formule__facts">
          <div><dt>Durée</dt><dd>${esc(f.duree)}</dd></div>
          ${f.capacite ? `<div><dt>Groupe</dt><dd>${esc(f.capacite)}</dd></div>` : ''}
          <div><dt>Réservation</dt><dd>${esc(f.reservation)}</dd></div>
        </dl>
        <p class="formule__prix${/confirmer/.test(f.prix) ? ' is-tbc' : ''}">${esc(f.prix)}</p>
        ${f.prixNote && !compact ? `<p class="formule__note">${esc(f.prixNote)}</p>` : ''}
        ${choose && f.reservable ? `<button type="button" class="btn btn--ink formule__go" data-formule="${f.id}">Choisir cette formule</button>` : ''}
      </li>`,
    )
    .join('')}</ul>`;
}

export const saisonHTML = () => `<p class="saison">${icons.clock}<span><strong>Saison 2026 :</strong> ${esc(saison.texte.replace('Du ', 'du '))} · ${esc(saison.ferme.toLowerCase())}</span></p>`;

// ---------- Actualités ----------
export function newsHTML(items = actualites, { limit = Infinity } = {}) {
  return `<ul class="news">${items
    .slice(0, limit)
    .map(
      (a) => `<li class="news__item" data-reveal>
        <p class="news__meta"><span class="news__rubrique">${esc(a.rubrique)}</span><span>${esc(a.quand)}</span></p>
        <h3 class="news__title">${esc(a.titre)}</h3>
        <p class="news__text">${esc(a.texte)}</p>
        ${a.suite ? `<p class="news__suite">${esc(a.suite)}</p>` : ''}
        <p class="news__links">${a.lien ? `<a class="link" href="${a.lien.href}">${esc(a.lien.texte)}</a>` : ''}${
          a.source ? `<a class="news__source" href="${a.source.url}" target="_blank" rel="noopener">Source : ${esc(a.source.nom)}<span class="sr-only"> (nouvel onglet)</span></a>` : ''
        }</p>
      </li>`,
    )
    .join('')}</ul>`;
}

export function pressHTML({ majeur = false } = {}) {
  return `<ul class="press">${presse
    .filter((p) => !p.alcool || majeur)
    .map(
      (p) => `<li class="press__item">
        <p class="press__media">${esc(p.media)}${p.date ? ` · ${esc(p.date)}` : ''}</p>
        <a class="press__title" href="${p.url}" target="_blank" rel="noopener"${p.lang ? ` lang="${p.lang}"` : ''}>« ${esc(p.titre)} »<span class="sr-only"> (nouvel onglet)</span></a>
      </li>`,
    )
    .join('')}</ul>`;
}

// ---------- Message sanitaire ----------
export const evinHTML = (extra = '') => `<p class="evin ${extra}">${esc(EVIN)} ${esc(MINEURS)}</p>`;

// Bloc verrouillé (porte d'âge) : aucun nom, visuel ou prix d'alcool.
export function lockHTML({ mineur = false, titre = 'Réservé aux personnes majeures', texte = '' } = {}) {
  return `<div class="lockbox">
    <span class="lockbox__icon">${icons.lock}</span>
    <p class="lockbox__title">${esc(titre)}</p>
    <p class="lockbox__text">${
      mineur ? 'Cette partie du site est réservée aux personnes majeures. Bonne découverte de nos sirops, de notre histoire et des visites.' : esc(texte || 'Indiquez votre date de naissance pour voir cette partie du site.')
    }</p>
    ${mineur ? '<a class="btn btn--ink" href="/couleur-provence">Voir les sirops</a>' : '<button type="button" class="btn btn--primary btn--sm" data-verify>Vérifier mon âge</button>'}
    ${evinHTML('lockbox__evin')}
  </div>`;
}
