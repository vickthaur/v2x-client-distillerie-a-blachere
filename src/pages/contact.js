// Page Contact : coordonnées et horaires de la boutique et des bureaux (page Contact du site de la
// distillerie, src/data/site.js), et formulaire branché sur l'API de la démo (api/site, contact) :
// le message est enregistré dans la démo de ce navigateur et arrive dans les messages du CRM.
// Voir docs/crm-espace-pro.md, § 7.
import '../styles/base.css';
import '../styles/brand.css';
import '../styles/pratique.css';
import { initSite } from '../app/site.js';
import { infos } from '../data/site.js';
import { api } from '../lib/api.js';
import { mountDemoBar } from '../lib/demo.js';
import { $, $$, esc } from '../lib/dom.js';
import { icons } from '../lib/icons.js';
import { noteRevue } from '../lib/revue.js';

const site = initSite({ askAge: false });
const NB = ' ';
const NNB = ' ';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SUJETS = { commande: 'Une commande', visite: 'Une visite de la distillerie', pro: 'Un compte professionnel', presse: 'La presse', autre: 'Autre chose' };
const HINTS = {
  commande: 'Indiquez le numéro de la commande (WEB-… ou PRO-…) et ce qui vous amène.',
  visite: 'Indiquez la date, le moment et le nombre de personnes. Pour réserver directement, utilisez la page Visiter.',
  pro: 'Indiquez votre établissement et votre ville. Pour ouvrir un compte, la demande se fait sur la page Espace pro.',
  presse: 'Indiquez votre rédaction et l’objet de votre demande (interview, visuels, visite).',
  autre: '',
};

// ---------- Coordonnées ----------
$('#contact-coord').innerHTML = `
  <div class="contact-block">
    <h3>${icons.pin}Adresse</h3>
    <p>${infos.adresse.map(esc).join('<br />')}</p>
    <p><a class="link" href="${infos.itineraire}" target="_blank" rel="noopener">Itinéraire<span class="sr-only"> (nouvel onglet)</span></a></p>
  </div>
  <div class="contact-block">
    <h3>${icons.store}Magasin</h3>
    <p><a href="${infos.magasin.telLien}">${esc(infos.magasin.tel)}</a><br /><a href="mailto:${infos.magasin.email}">${esc(infos.magasin.email)}</a></p>
    <p>${esc(infos.jours)}</p>
    <dl class="contact-hours">${infos.horaires.map((h) => `<div><dt>${esc(h.periode)}</dt><dd>${esc(h.heures)}</dd></div>`).join('')}</dl>
  </div>
  <div class="contact-block">
    <h3>${icons.phone}Bureaux</h3>
    <p><a href="${infos.bureaux.telLien}">${esc(infos.bureaux.tel)}</a><br /><a href="mailto:${infos.bureaux.email}">${esc(infos.bureaux.email)}</a></p>
    <p>${esc(infos.bureauxHoraires.jours)}</p>
    <dl class="contact-hours"><div><dt>Horaires</dt><dd>${esc(infos.bureauxHoraires.heures)}</dd></div></dl>
  </div>
  <ul class="contact-links">
    <li><a class="arrow-link" href="/visiter#reserver">Réserver une visite ${icons.arrow}</a></li>
    <li><a class="arrow-link" href="/espace-pro">Espace professionnel ${icons.arrow}</a></li>
    <li><a class="arrow-link" href="/ou-trouver">Où trouver nos produits ${icons.arrow}</a></li>
  </ul>
  ${noteRevue(`<p class="note">${esc(infos.horairesNote)}</p>`, { tag: 'div' })}`;

// ---------- Formulaire ----------
const form = $('#contact-form');
const msg = $('#contact-msg');
const hint = $('#contact-hint');
const defaultHint = hint.textContent;
const asked = new URLSearchParams(location.search).get('sujet');
if (SUJETS[asked]) form.elements.sujet.value = asked;
const syncHint = () => {
  const h = HINTS[form.elements.sujet.value];
  hint.textContent = h === undefined ? defaultHint : h;
};
syncHint();
form.elements.sujet.addEventListener('change', syncHint);

// Champ de l'API → champ du formulaire
const FIELD = { telephone: 'tel', rgpd: 'rgpd', sujet: 'sujet', nom: 'nom', email: 'email', message: 'message' };

function mark(bad) {
  $$('input, select, textarea', form).forEach((el) => {
    const on = bad.has(el.name);
    el.classList.toggle('is-invalid', on);
    if (on) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
  });
  form.querySelector('.is-invalid')?.focus();
}

function error(text) {
  msg.className = 'form-msg err';
  msg.textContent = text;
}

function check(d) {
  const bad = new Set();
  const errs = [];
  if (!d.sujet) bad.add('sujet');
  if (!d.nom?.trim()) bad.add('nom');
  if (!EMAIL.test((d.email || '').trim())) bad.add('email');
  if (!d.message?.trim()) bad.add('message');
  if (bad.size) errs.push('Complétez les champs en rouge.');
  if (d.message?.trim() && d.message.trim().length < 10) {
    bad.add('message');
    errs.push(`Votre message est un peu court${NB}: dites-nous en quelques mots ce qui vous amène.`);
  }
  if (d.tel && !/^[+\d][\d\s.-]{8,}$/.test(d.tel.trim())) {
    bad.add('tel');
    errs.push('Ce numéro de téléphone ne semble pas valide.');
  }
  if (!d.rgpd) {
    bad.add('rgpd');
    errs.push('Cochez la case d’accord pour que la distillerie puisse vous répondre.');
  }
  return { bad, errs };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(form));
  const { bad, errs } = check(d);
  mark(bad);
  if (errs.length) return error(errs.join(' '));
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Envoi…';
  msg.className = 'form-msg';
  msg.textContent = '';
  try {
    const r = await api('site', 'contact', {
      method: 'POST',
      body: { nom: d.nom.trim(), email: d.email.trim(), telephone: d.tel?.trim() || undefined, sujet: d.sujet, message: d.message.trim(), rgpd: true },
    });
    done(d, r);
  } catch (x) {
    btn.disabled = false;
    btn.textContent = 'Envoyer le message';
    const champ = FIELD[String(x?.champ || '').split('.').pop()];
    mark(new Set(champ ? [champ] : []));
    error(x?.message || 'Le message n’a pas pu être enregistré. Réessayez.');
  }
});

function done(d, r) {
  const crm = r?.liens?.crm;
  $('#contact-card').innerHTML = `<div class="done" tabindex="-1" id="contact-done">
    <span class="done__icon">${icons.check}</span>
    <h2>Message enregistré</h2>
    <p>Merci ${esc(d.nom.trim())}. ${r?.reference ? `Votre message porte la référence <strong>${esc(r.reference)}</strong>.` : ''} Les bureaux vous répondent à ${esc(d.email.trim())}.</p>
    <dl class="recap">
      <div><dt>Sujet</dt><dd>${esc(SUJETS[d.sujet] || d.sujet)}</dd></div>
      <div><dt>Contact</dt><dd>${esc(d.nom.trim())} · ${esc(d.email.trim())}${d.tel?.trim() ? ` · ${esc(d.tel.trim())}` : ''}</dd></div>
    </dl>
    <p class="mock-note"><strong>Démonstration${NB}:</strong> le message est enregistré dans un espace de démonstration privé, visible seulement depuis ce navigateur${NNB}; rien n’est transmis à la distillerie. Il apparaît dans les messages du CRM de démonstration.</p>
    <div class="done__actions">
      ${crm ? `<a class="btn btn--primary" href="${esc(crm)}">Voir le message dans le CRM (démo)</a>` : ''}
      <button type="button" class="btn btn--ghost" id="contact-again">Écrire un autre message</button>
    </div>
  </div>`;
  $('#contact-done').focus();
  $('#contact-again').addEventListener('click', () => location.assign('/contact'));
  // La démo vient d'être créée (ou existait) : la pastille de démo apparaît.
  mountDemoBar({ toast: site.toast });
}
