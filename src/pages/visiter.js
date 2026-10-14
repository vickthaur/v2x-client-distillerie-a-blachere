// Visiter : les quatre formules (tarifs « à confirmer »), le formulaire de réservation en mode
// maquette (vérifie, confirme, n'envoie rien), les infos pratiques et les questions fréquentes.
// Créneaux : date dans la saison 2026, jamais un dimanche ; matin ou après-midi, l'heure exacte
// étant confirmée par la distillerie (aucun horaire de visite n'est inventé).
import '../styles/base.css';
import '../styles/brand.css';
import '../styles/pratique.css';
import { initSite, reveal } from '../app/site.js';
import { fillPlaces } from '../app/lieux.js';
import { pieceById } from '../app/pieces.js';
import { formulesHTML, saisonHTML } from '../app/blocks.js';
import { formules, infos, saison } from '../data/site.js';
import { $, $$, esc, calm } from '../lib/dom.js';
import { icons } from '../lib/icons.js';

const site = initSite();
const reservables = formules.filter((f) => f.reservable);

// Photo : la boutique (des bouteilles d'alcool y sont visibles : majeurs seulement), sinon la
// carte postale du stand de la maison.
function photo() {
  const stand = pieceById['stand-palais-des-papes'];
  $('#visit-photo').innerHTML = site.majeur
    ? '<span class="ph__slot" data-lieu="boutique-rayons"></span><figcaption>La boutique de la distillerie, à Châteauneuf-du-Pape</figcaption>'
    : `<img src="${stand.image}" alt="" width="${stand.largeur}" height="${stand.hauteur}" /><figcaption>Le stand de la maison à l’Exposition industrielle du Palais des Papes (carte postale ancienne)</figcaption>`;
  fillPlaces($('#visit-photo'));
}
photo();
site.onAge(photo);

$('#saison').innerHTML = saisonHTML();
$('#formules').innerHTML = formulesHTML({ choose: true });
$('#booking-formules').innerHTML = reservables
  .map((f, i) => `<label><input type="radio" name="formule" value="${f.id}"${i === 1 ? ' checked' : ''} /><strong>${esc(f.nom)}</strong><span>${esc(f.duree)}${f.capacite ? ` · ${esc(f.capacite)}` : ''}</span><span>${esc(f.prix)}</span></label>`)
  .join('');

$('#infos').innerHTML = `
  <div class="info-card"><h3>${icons.pin}Adresse</h3><p>${infos.adresse.map(esc).join('<br />')}</p><p><a class="link" href="${infos.itineraire}" target="_blank" rel="noopener">Itinéraire<span class="sr-only"> (nouvel onglet)</span></a></p><p>La distillerie a sa fiche sur le site La Provence à Vélo.</p></div>
  <div class="info-card"><h3>${icons.clock}Magasin</h3><p>${esc(infos.jours)}</p>${infos.horaires.map((h) => `<p><strong>${esc(h.periode)}</strong> : ${esc(h.heures)}</p>`).join('')}<p>Bureaux et entrepôts : ${esc(infos.bureauxHoraires.jours.toLowerCase())}, ${esc(infos.bureauxHoraires.heures)}.</p><p class="note">${esc(infos.horairesNote)} Visites fermées le dimanche.</p></div>
  <div class="info-card"><h3>${icons.phone}Contact</h3><p>Magasin : <a href="${infos.magasin.telLien}">${infos.magasin.tel}</a><br /><a href="mailto:${infos.magasin.email}">${infos.magasin.email}</a></p><p>Bureaux : <a href="${infos.bureaux.telLien}">${infos.bureaux.tel}</a><br /><a href="mailto:${infos.bureaux.email}">${infos.bureaux.email}</a></p></div>`;

const faq = [
  ['Faut-il réserver ?', 'Pas pour passer à la boutique et goûter. La visite guidée de la distillerie, elle, se fait uniquement sur réservation.'],
  ['Combien de temps dure la visite guidée ?', 'Une heure, dégustation comprise, par groupes de 25 personnes au plus. Le parcours passe par la zone de stockage, l’herboristerie, la salle d’étiquetage, le vieux chai et la production, visible derrière les vitres.'],
  ['Peut-on venir avec des enfants ?', 'Oui : les mineurs dégustent les sirops. Les alcools sont réservés aux personnes majeures.'],
  ['Est-ce ouvert le dimanche ?', 'Les visites sont fermées le dimanche. La saison 2026 court du 12 février au 31 décembre.'],
  ['Quel est le tarif ?', 'La dégustation en boutique est gratuite. Le tarif de la visite guidée est à confirmer : les sources ne donnent pas toutes le même.'],
];
$('#faq').innerHTML = faq.map(([q, a]) => `<details><summary>${esc(q)}${icons.chevron}</summary><p>${esc(a)}</p></details>`).join('');

// ---------- Formulaire ----------
const form = $('#booking');
const dateInput = form.elements.date;
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const min = iso(tomorrow) > saison.debut ? iso(tomorrow) : saison.debut;
dateInput.min = min;
dateInput.max = saison.fin;
const seasonOver = min > saison.fin;
$('#date-hint').textContent = seasonOver ? 'La saison 2026 est terminée : les dates de 2027 sont à annoncer.' : `Du ${new Date(min).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au 31 décembre 2026, sauf le dimanche`;

$('#formules').addEventListener('click', (e) => {
  const b = e.target.closest('[data-formule]');
  if (!b) return;
  const r = form.querySelector(`input[name="formule"][value="${b.dataset.formule}"]`);
  if (r) r.checked = true;
  $('#reserver').scrollIntoView({ behavior: calm() ? 'auto' : 'smooth' });
});

function check() {
  const d = Object.fromEntries(new FormData(form));
  const errs = [];
  const bad = new Set();
  if (!d.formule) errs.push('Choisissez une formule.');
  if (!d.date) {
    errs.push('Choisissez une date.');
    bad.add('date');
  } else if (d.date < min || d.date > saison.fin) {
    errs.push('Cette date est hors de la saison des visites.');
    bad.add('date');
  } else if (new Date(`${d.date}T12:00:00`).getDay() === 0) {
    errs.push('Les visites sont fermées le dimanche : choisissez un autre jour.');
    bad.add('date');
  }
  const n = Number(d.personnes);
  const m = Number(d.mineurs || 0);
  if (!Number.isInteger(n) || n < 1 || n > saison.groupeMax) {
    errs.push(`Le groupe compte de 1 à ${saison.groupeMax} personnes.`);
    bad.add('personnes');
  }
  if (!Number.isInteger(m) || m < 0 || m > n) {
    errs.push('Le nombre de mineurs ne peut pas dépasser la taille du groupe.');
    bad.add('mineurs');
  }
  if (!d.nom?.trim()) {
    errs.push('Indiquez votre nom.');
    bad.add('nom');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email || '')) {
    errs.push('Indiquez une adresse e-mail valide.');
    bad.add('email');
  }
  if (d.tel && !/^[+\d][\d\s.-]{8,}$/.test(d.tel)) {
    errs.push('Ce numéro de téléphone ne semble pas valide.');
    bad.add('tel');
  }
  if (!d.rgpd) {
    errs.push('Cochez la case d’accord pour que la distillerie puisse vous répondre.');
    bad.add('rgpd');
  }
  $$('input, select, textarea', form).forEach((el) => el.classList.toggle('is-invalid', bad.has(el.name)));
  return { d, errs };
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const { d, errs } = check();
  const msg = $('#booking-err');
  if (errs.length) {
    msg.className = 'form-msg err';
    msg.textContent = errs.join(' ');
    form.querySelector('.is-invalid')?.focus();
    return;
  }
  const f = formules.find((x) => x.id === d.formule);
  const date = new Date(`${d.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  $('#booking-card').innerHTML = `<div class="done" tabindex="-1" id="booking-done">
    <span class="done__icon">${icons.check}</span>
    <h3>Demande prête</h3>
    <p class="mock-note"><strong>Maquette :</strong> rien n’a été envoyé. Sur le site en ligne, la distillerie confirmerait le créneau par e-mail et enverrait un rappel la veille.</p>
    <dl class="recap">
      <div><dt>Formule</dt><dd>${esc(f.nom)} · ${esc(f.prix)}</dd></div>
      <div><dt>Date</dt><dd>${esc(date)}, ${esc(d.moment.toLowerCase())} (créneau à confirmer)</dd></div>
      <div><dt>Groupe</dt><dd>${esc(d.personnes)} personne${d.personnes > 1 ? 's' : ''}${Number(d.mineurs) ? `, dont ${esc(d.mineurs)} mineur${d.mineurs > 1 ? 's' : ''} (sirops)` : ''}</dd></div>
      <div><dt>Langue</dt><dd>${esc(d.langue)}</dd></div>
      <div><dt>Contact</dt><dd>${esc(d.nom)} · ${esc(d.email)}${d.tel ? ` · ${esc(d.tel)}` : ''}</dd></div>
    </dl>
    <button type="button" class="btn btn--ink" id="booking-again">Faire une autre demande</button>
  </div>`;
  $('#booking-done').focus();
  $('#booking-again').addEventListener('click', () => location.reload());
});

reveal();
