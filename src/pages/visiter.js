// Visiter : les quatre formules (tarifs « à confirmer »), la réservation branchée sur l'API de la
// démo (docs/crm-espace-pro.md, § 5 et § 7 : disponibilités par jour et par moment, réservation
// confirmée sur la séance du matin ou de l'après-midi s'il reste de la place, sinon les autres
// disponibilités du jour) et les infos pratiques. Pas de questions fréquentes : elles redisaient les
// formules et la saison ; le numéro à appeler pour le tarif est sous le prix des formules.
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
import { api } from '../lib/api.js';
import { mountDemoBar } from '../lib/demo.js';
import { noteRevue, selonRevue } from '../lib/revue.js';
import { erreursParChamp } from '../lib/formulaire.js';

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
// Valeur d'une formule : le texte public (« Tarif sur demande »), la note « à confirmer » en revue.
const val = (f, k) => selonRevue(esc(f[k] || ''), f.revue?.[k] ? esc(f.revue[k]) : '');
$('#booking-formules').innerHTML = reservables
  .map((f, i) => `<label><input type="radio" name="formule" value="${f.id}"${i === 1 ? ' checked' : ''} /><strong>${esc(f.nom)}</strong><span>${val(f, 'duree')}${f.capacite ? ` · ${esc(f.capacite)}` : ''}</span><span>${val(f, 'prix')}</span></label>`)
  .join('');

$('#infos').innerHTML = `
  <div class="info-card"><h3>${icons.pin}Adresse</h3><p>${infos.adresse.map(esc).join('<br />')}</p><p><a class="link" href="${infos.itineraire}" target="_blank" rel="noopener">Itinéraire<span class="sr-only"> (nouvel onglet)</span></a></p></div>
  <div class="info-card"><h3>${icons.clock}Magasin</h3><p>${esc(infos.jours)}</p>${infos.horaires.map((h) => `<p><strong>${esc(h.periode)}</strong>\u00a0: ${esc(h.heures)}</p>`).join('')}<p>Bureaux et entrepôts\u00a0: ${esc(infos.bureauxHoraires.jours.toLowerCase())}, ${esc(infos.bureauxHoraires.heures)}.</p><p class="note">${noteRevue(`${esc(infos.horairesNote)} `)}Visites fermées le dimanche.</p></div>
  <div class="info-card"><h3>${icons.phone}Contact</h3><p>Magasin\u00a0: <a href="${infos.magasin.telLien}">${infos.magasin.tel}</a><br /><a href="mailto:${infos.magasin.email}">${infos.magasin.email}</a></p><p>Bureaux\u00a0: <a href="${infos.bureaux.telLien}">${infos.bureaux.tel}</a><br /><a href="mailto:${infos.bureaux.email}">${infos.bureaux.email}</a></p></div>`;

// ---------- Réservation ----------
const NB = ' ';
const NNB = ' ';
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
$('#date-hint').innerHTML = seasonOver ? `La saison 2026 est terminée.${noteRevue(' Les dates de 2027 sont à annoncer.')}` : `Du ${new Date(min).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au 31 décembre 2026, sauf le dimanche. Choisissez dans le calendrier ou saisissez la date.`;
const MOMENTS = { matin: 'Matin', 'apres-midi': 'Après-midi' };
const LANGUES = { fr: 'Français', en: 'Anglais', de: 'Allemand' };
const heureFr = (h) => (h ? h.replace(/^0/, '').replace(':00', `${NB}h`).replace(':', `${NB}h${NB}`) : '');
const jourFr = (d, opts = { weekday: 'long', day: 'numeric', month: 'long' }) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', opts);

$('#formules').addEventListener('click', (e) => {
  const b = e.target.closest('[data-formule]');
  if (!b) return;
  const r = form.querySelector(`input[name="formule"][value="${b.dataset.formule}"]`);
  if (r) r.checked = true;
  $('#reserver').scrollIntoView({ behavior: calm() ? 'auto' : 'smooth' });
});

// ---------- Disponibilités (api/site, creneaux) ----------
// Sans démo, le serveur les calcule depuis le jeu de démonstration sans rien créer.
const mois = new Map(); // 'AAAA-MM' → promesse de { date → jour }
const jours = new Map(); // 'AAAA-MM-JJ' → { date, ouvert, matin, apresMidi }
const moisDe = (d) => d.slice(0, 7);
function charger(m) {
  if (!mois.has(m))
    mois.set(
      m,
      api('site', 'creneaux', { query: { mois: m } }).then(
        (r) => {
          for (const j of r?.jours || []) jours.set(j.date, j);
          return true;
        },
        (e) => {
          mois.delete(m);
          throw e;
        },
      ),
    );
  return mois.get(m);
}
const seance = (j, moment) => (j ? (moment === 'matin' ? j.matin : j.apresMidi || j['apres-midi']) : null);
const restantes = (j, moment) => (j?.ouvert && seance(j, moment) ? seance(j, moment).restantes ?? 0 : 0);
function etatJour(d) {
  if (d < min || d > saison.fin) return 'passe';
  const j = jours.get(d);
  if (!j) return 'inconnu';
  if (!j.ouvert) return 'ferme';
  const r = [restantes(j, 'matin'), restantes(j, 'apres-midi')];
  if (!r[0] && !r[1]) return 'complet';
  if (Math.min(...r.filter(Boolean)) <= 5) return 'peu';
  return 'ouvert';
}

// Calendrier du mois : jours ouverts, complets, fermés ; flèches du clavier pour se déplacer.
let vue = moisDe(min);
const cal = $('#cal');
const MOIS_MIN = moisDe(min);
const MOIS_MAX = moisDe(saison.fin);
function decaler(m, n) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function renderCal(focusDay = null) {
  if (seasonOver) {
    cal.innerHTML = '';
    return;
  }
  const [y, mo] = vue.split('-').map(Number);
  const first = new Date(y, mo - 1, 1);
  const n = new Date(y, mo, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // lundi d'abord
  const titre = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const loaded = mois.has(vue) && [...jours.keys()].some((k) => k.startsWith(vue));
  const sel = dateInput.value;
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<span class="cal__pad" aria-hidden="true"></span>');
  for (let k = 1; k <= n; k++) {
    const d = `${vue}-${pad(k)}`;
    const e = etatJour(d);
    const j = jours.get(d);
    const off = e === 'passe' || e === 'ferme' || e === 'complet';
    const dots = j?.ouvert && e !== 'passe'
      ? ['matin', 'apres-midi'].map((m) => `<i class="cal-dot${restantes(j, m) ? (restantes(j, m) <= 5 ? ' cal-dot--few' : '') : ' cal-dot--full'}"></i>`).join('')
      : '';
    const label = `${jourFr(d)}${e === 'passe' ? ', non réservable' : e === 'ferme' ? ', fermé' : e === 'complet' ? ', complet' : j ? `, matin${NB}: ${restantes(j, 'matin') ? `${restantes(j, 'matin')} places` : 'complet'}, après-midi${NB}: ${restantes(j, 'apres-midi') ? `${restantes(j, 'apres-midi')} places` : 'complet'}` : ''}`;
    cells.push(
      `<button type="button" class="cal__d is-${e}${d === sel ? ' is-sel' : ''}" data-d="${d}" aria-label="${esc(label)}" aria-pressed="${d === sel}"${off ? ' aria-disabled="true"' : ''} tabindex="-1"><span class="cal__n">${k}</span><span class="cal__dots" aria-hidden="true">${dots}</span></button>`,
    );
  }
  cal.innerHTML = `<div class="cal__head">
      <button type="button" class="cal__nav" data-nav="-1" aria-label="Mois précédent"${vue <= MOIS_MIN ? ' disabled' : ''}>${icons.arrowL}</button>
      <p class="cal__title" aria-live="polite">${esc(titre)}${loaded ? '' : ' <span class="cal__wait">· chargement…</span>'}</p>
      <button type="button" class="cal__nav" data-nav="1" aria-label="Mois suivant"${vue >= MOIS_MAX ? ' disabled' : ''}>${icons.arrowR}</button>
    </div>
    <div class="cal__week" aria-hidden="true"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
    <div class="cal__grid" role="group" aria-label="Jours de ${esc(titre)}">${cells.join('')}</div>`;
  // Un seul jour atteignable à la tabulation (le jour choisi, sinon le premier réservable).
  const days = $$('.cal__d', cal);
  const target = days.find((b) => b.dataset.d === (focusDay || sel)) || days.find((b) => !b.getAttribute('aria-disabled')) || days[0];
  if (target) target.tabIndex = 0;
  if (focusDay) target?.focus();
}
async function voir(m, focusDay = null) {
  vue = m < MOIS_MIN ? MOIS_MIN : m > MOIS_MAX ? MOIS_MAX : m;
  renderCal(focusDay);
  try {
    await charger(vue);
  } catch (e) {
    $('.cal__title', cal).innerHTML = `${esc(new Date(`${vue}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))} <span class="cal__wait">· disponibilités indisponibles</span>`;
    return;
  }
  if (moisDe(vue) === m.slice(0, 7)) renderCal(focusDay);
  syncMoments();
}
cal.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (nav) return voir(decaler(vue, Number(nav.dataset.nav)));
  const b = e.target.closest('[data-d]');
  if (!b || b.getAttribute('aria-disabled')) return;
  choisir(b.dataset.d, { focus: true });
});
cal.addEventListener('keydown', (e) => {
  const b = e.target.closest('[data-d]');
  if (!b) return;
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
  if (!step && e.key !== 'Home' && e.key !== 'End') return;
  e.preventDefault();
  const d = new Date(`${b.dataset.d}T12:00:00`);
  if (step) d.setDate(d.getDate() + step);
  else if (e.key === 'Home') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  else d.setDate(d.getDate() + (6 - ((d.getDay() + 6) % 7)));
  const next = iso(d);
  if (next < min || next > saison.fin) return;
  if (moisDe(next) !== vue) voir(moisDe(next), next);
  else {
    $$('.cal__d', cal).forEach((x) => (x.tabIndex = x.dataset.d === next ? 0 : -1));
    $(`[data-d="${next}"]`, cal)?.focus();
  }
});

// Moments du jour choisi : heure exacte et places restantes ; un moment complet est désactivé.
function syncMoments() {
  const d = dateInput.value;
  const j = jours.get(d);
  const n = Math.max(1, Number(form.elements.personnes.value) || 1);
  for (const m of Object.keys(MOMENTS)) {
    const input = form.querySelector(`input[name="moment"][value="${m}"]`);
    const span = $(`[data-moment="${m}"]`, form);
    const s = seance(j, m);
    const r = restantes(j, m);
    const full = !!j && (!j.ouvert || r < n);
    input.disabled = full;
    input.closest('label').classList.toggle('is-full', full);
    if (!j) span.textContent = m === 'matin' ? `10${NB}h${NB}30` : `15${NB}h`;
    else if (!j.ouvert) span.textContent = 'Fermé';
    else span.textContent = `${heureFr(s?.heure) || (m === 'matin' ? `10${NB}h${NB}30` : `15${NB}h`)} · ${r ? (r < n ? `${r} place${r > 1 ? 's' : ''} seulement` : `${r} place${r > 1 ? 's' : ''}`) : 'complet'}`;
  }
  // Le moment coché est complet : on passe à l'autre s'il a de la place.
  const checked = form.querySelector('input[name="moment"]:checked');
  if (checked?.disabled) {
    const other = form.querySelector('input[name="moment"]:not(:disabled)');
    if (other) other.checked = true;
  }
}
function choisir(d, { focus = false } = {}) {
  dateInput.value = d;
  dateInput.classList.remove('is-invalid');
  dateInput.removeAttribute('aria-invalid');
  $('#err-date').textContent = '';
  $('#booking-alt').hidden = true;
  if (moisDe(d) !== vue) voir(moisDe(d));
  else renderCal(focus ? d : null);
  syncMoments();
}
dateInput.addEventListener('change', () => {
  const d = dateInput.value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d >= min && d <= saison.fin) {
    if (moisDe(d) !== vue) voir(moisDe(d));
    else renderCal();
  }
  syncMoments();
});
form.elements.personnes.addEventListener('input', syncMoments);
voir(vue);

// Une erreur par champ (A11Y-10) : nom du champ → message, écrit sous le champ (src/lib/formulaire.js).
function check() {
  const d = Object.fromEntries(new FormData(form));
  const e = new Map();
  if (!d.formule) e.set('formule', 'Choisissez une formule.');
  if (!d.date) e.set('date', 'Choisissez une date.');
  else if (d.date < min || d.date > saison.fin) e.set('date', 'Cette date est hors de la saison des visites.');
  else if (new Date(`${d.date}T12:00:00`).getDay() === 0) e.set('date', 'Les visites sont fermées le dimanche\u00a0: choisissez un autre jour.');
  else if (etatJour(d.date) === 'ferme') e.set('date', 'La distillerie ne fait pas de visite ce jour-là\u00a0: choisissez un autre jour.');
  const n = Number(d.personnes);
  const m = Number(d.mineurs || 0);
  if (!Number.isInteger(n) || n < 1 || n > saison.groupeMax) e.set('personnes', `Le groupe compte de 1 à ${saison.groupeMax}\u00a0personnes.`);
  if (!Number.isInteger(m) || m < 0 || m >= n) e.set('mineurs', 'Au moins un adulte accompagne le groupe\u00a0: les mineurs sont comptés dans le nombre de personnes.');
  if (!d.moment && !e.has('date')) e.set('moment', 'Ce jour est complet\u00a0: choisissez un autre jour.');
  if (!d.nom?.trim()) e.set('nom', 'Indiquez votre nom.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email || '')) e.set('email', 'Indiquez une adresse e-mail valide (ex. prenom@exemple.fr).');
  if (d.tel && !/^[+\d][\d\s.-]{8,}$/.test(d.tel)) e.set('tel', 'Ce numéro de téléphone ne semble pas valide.');
  if (!d.rgpd) e.set('rgpd', 'Cochez la case d’accord pour que la distillerie puisse vous répondre.');
  return { d, e };
}

// Autres disponibilités (séance complète) : boutons qui choisissent le jour et le moment.
function alternatives(list, texte) {
  const box = $('#booking-alt');
  const items = (list || []).filter((x) => x && x.date && x.moment);
  box.innerHTML = `<p class="vis-alt__t">${esc(texte)}</p>${
    items.length
      ? `<div class="vis-alt__list">${items
          .slice(0, 6)
          .map(
            (x) =>
              `<button type="button" class="chip vis-alt__btn" data-alt-d="${esc(x.date)}" data-alt-m="${esc(x.moment)}">${esc(jourFr(x.date, { weekday: 'short', day: 'numeric', month: 'short' }))} · ${esc(MOMENTS[x.moment] || x.moment)}${x.heure ? ` ${esc(heureFr(x.heure))}` : ''}${x.restantes != null ? ` · ${x.restantes} pl.` : ''}</button>`,
          )
          .join('')}</div>`
      : '<p class="vis-alt__none">Aucune autre séance disponible\u00a0: choisissez un autre jour dans le calendrier.</p>'
  }`;
  box.hidden = false;
  box.querySelector('button')?.focus();
}
$('#booking-alt').addEventListener('click', (e) => {
  const b = e.target.closest('[data-alt-d]');
  if (!b) return;
  choisir(b.dataset.altD);
  const r = form.querySelector(`input[name="moment"][value="${b.dataset.altM}"]`);
  if (r && !r.disabled) r.checked = true;
  $('#booking-err').textContent = '';
  $('#booking-alt').hidden = true;
  form.querySelector('button[type="submit"]').focus();
});

// Autres séances du même jour (ou des jours suivants) d'après les disponibilités chargées.
function autresSeances(date, moment, n) {
  const out = [];
  const keys = [...jours.keys()].filter((k) => k >= date).sort();
  for (const k of keys) {
    for (const m of Object.keys(MOMENTS)) {
      if (k === date && m === moment) continue;
      const j = jours.get(k);
      if (j?.ouvert && restantes(j, m) >= n) out.push({ date: k, moment: m, heure: seance(j, m)?.heure, restantes: restantes(j, m) });
    }
    if (out.length >= 4) break;
  }
  return out;
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const { d, e } = check();
  const msg = $('#booking-err');
  $('#booking-alt').hidden = true;
  msg.className = 'form-msg err';
  erreursParChamp(form, e, { resume: msg });
  if (e.size) return;
  const n = Number(d.personnes);
  const j = jours.get(d.date);
  if (j && restantes(j, d.moment) < n) {
    msg.className = 'form-msg err';
    msg.textContent = `Il ne reste pas ${n} places ${d.moment === 'matin' ? 'le matin' : 'l’après-midi'} ce jour-là.`;
    return alternatives(autresSeances(d.date, d.moment, n), 'Autres séances disponibles\u00a0:');
  }
  const f = formules.find((x) => x.id === d.formule);
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Réservation…';
  msg.textContent = '';
  let r;
  try {
    r = await api('site', 'reservation', {
      method: 'POST',
      body: {
        date: d.date,
        moment: d.moment,
        personnes: n,
        mineurs: Number(d.mineurs || 0),
        langue: d.langue || 'fr',
        nom: d.nom.trim(),
        email: d.email.trim(),
        telephone: d.tel?.trim() || undefined,
        message: [`Formule${NB}: ${f.nom}`, d.message?.trim()].filter(Boolean).join('\n'),
        rgpd: true,
        newsletter: d.news === 'on',
      },
    });
  } catch (x) {
    btn.disabled = false;
    btn.textContent = 'Réserver la visite';
    msg.className = 'form-msg err';
    msg.textContent = x?.message || 'La réservation n’a pas abouti. Réessayez.';
    if (x?.status === 409) {
      // Séance complète entre-temps : disponibilités relues, autres séances du jour proposées.
      mois.delete(moisDe(d.date));
      voir(moisDe(d.date));
      return alternatives(x.data?.disponibilites || autresSeances(d.date, d.moment, n), 'Autres séances disponibles\u00a0:');
    }
    const champ = { telephone: 'tel', date: 'date', moment: 'moment', personnes: 'personnes', mineurs: 'mineurs', email: 'email', nom: 'nom', rgpd: 'rgpd' }[String(x?.champ || '').split('.').pop()];
    if (champ) erreursParChamp(form, { [champ]: x.message });
    return;
  }
  const date = jourFr(r?.date || d.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const heure = heureFr(r?.heure) || (d.moment === 'matin' ? `10${NB}h${NB}30` : `15${NB}h`);
  const crm = r?.liens?.crm;
  $('#booking-card').innerHTML = `<div class="done" tabindex="-1" id="booking-done">
    <span class="done__icon">${icons.check}</span>
    <h3>Visite réservée</h3>
    <p class="vis-done__when"><strong>${esc(date)}</strong> à <strong>${esc(heure)}</strong>${r?.reference ? `<br />Référence <strong>${esc(r.reference)}</strong>` : ''}</p>
    <dl class="recap">
      <div><dt>Formule</dt><dd>${esc(f.nom)} · ${val(f, 'prix')}</dd></div>
      <div><dt>Groupe</dt><dd>${esc(d.personnes)} personne${n > 1 ? 's' : ''}${Number(d.mineurs) ? `, dont ${esc(d.mineurs)} mineur${d.mineurs > 1 ? 's' : ''} (sirops)` : ''}</dd></div>
      <div><dt>Langue</dt><dd>${esc(LANGUES[d.langue] || d.langue)}</dd></div>
      <div><dt>Contact</dt><dd>${esc(d.nom)} · ${esc(d.email)}${d.tel ? ` · ${esc(d.tel)}` : ''}</dd></div>
      <div><dt>Adresse</dt><dd>${esc(infos.adresseLigne)}</dd></div>
    </dl>
    <p class="mock-note"><strong>Démonstration${NB}:</strong> la réservation est enregistrée dans un espace de démonstration privé, visible seulement depuis ce navigateur${NNB}; rien n’a été envoyé à la distillerie. L’e-mail de confirmation est déposé dans les courriels envoyés du CRM de démonstration.</p>
    <div class="done__actions">
      ${crm ? `<a class="btn btn--primary" href="${esc(crm)}">Voir la réservation dans le CRM (démo)</a>` : ''}
      <button type="button" class="btn btn--ghost" id="booking-again">Faire une autre réservation</button>
    </div>
  </div>`;
  // La carte de confirmation, plus courte que le formulaire, remonterait sous l'en-tête collant :
  // alignée sous l'en-tête (scroll-padding-top de la page), le focus ne fait pas défiler.
  $('#booking-done').focus({ preventScroll: true });
  $('#booking-card').scrollIntoView({ block: 'start', behavior: calm() ? 'auto' : 'smooth' });
  $('#booking-again').addEventListener('click', () => location.reload());
  mountDemoBar({ toast: site.toast });
});

reveal();
