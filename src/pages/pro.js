// Espace pro en mode maquette : la connexion et la demande de compte vérifient la saisie,
// confirment, et n'envoient rien.
import '../styles/base.css';
import '../styles/editorial.css';
import '../styles/pages.css';
import { initSite } from '../app/site.js';
import { $, $$, esc } from '../lib/dom.js';
import { icons } from '../lib/icons.js';

initSite({ askAge: false });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mark(form, bad) {
  $$('input, select, textarea', form).forEach((el) => el.classList.toggle('is-invalid', bad.has(el.name)));
  form.querySelector('.is-invalid')?.focus();
}

$('#pro-login').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const d = Object.fromEntries(new FormData(form));
  const bad = new Set();
  if (!EMAIL.test(d.email || '')) bad.add('email');
  if (!d.mdp) bad.add('mdp');
  mark(form, bad);
  const msg = $('#login-msg');
  if (bad.size) {
    msg.className = 'form-msg err';
    msg.textContent = 'Indiquez votre identifiant (une adresse e-mail) et votre mot de passe.';
    return;
  }
  msg.className = 'form-msg ok';
  msg.textContent = 'Maquette : la connexion n’est pas active. Sur le site en ligne, vous arriveriez sur votre espace (fiches, médiathèque, tarifs).';
});

$('#pro-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const d = Object.fromEntries(new FormData(form));
  const bad = new Set();
  const errs = [];
  if (!d.societe?.trim()) bad.add('societe');
  if (!d.activite) bad.add('activite');
  if (!d.nom?.trim()) bad.add('nom');
  if (!d.ville?.trim()) bad.add('ville');
  if (!EMAIL.test(d.email || '')) bad.add('email');
  if (bad.size) errs.push('Complétez les champs en rouge.');
  const siret = (d.siret || '').replace(/\s/g, '');
  if (siret && !/^\d{14}$/.test(siret)) {
    bad.add('siret');
    errs.push('Le SIRET compte 14 chiffres.');
  }
  if (!d.rgpd) {
    bad.add('rgpd');
    errs.push('Cochez la case d’accord.');
  }
  mark(form, bad);
  const msg = $('#pro-msg');
  if (errs.length) {
    msg.className = 'form-msg err';
    msg.textContent = errs.join(' ');
    return;
  }
  $('#pro-card').innerHTML = `<div class="done" tabindex="-1" id="pro-done">
    <span class="done__icon">${icons.check}</span>
    <h2>Demande prête</h2>
    <p class="mock-note"><strong>Maquette :</strong> rien n’a été envoyé. Sur le site en ligne, les bureaux de la distillerie vous répondraient.</p>
    <dl class="recap">
      <div><dt>Établissement</dt><dd>${esc(d.societe)} · ${esc(d.activite)}</dd></div>
      <div><dt>Contact</dt><dd>${esc(d.nom)} · ${esc(d.ville)} · ${esc(d.email)}</dd></div>
    </dl>
  </div>`;
  $('#pro-done').focus();
});
