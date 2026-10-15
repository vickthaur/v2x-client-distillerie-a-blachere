// Espace pro, page publique : présentation, connexion, mot de passe oublié, entrée en démo et demande
// de compte, branchées sur l'API de la démo (docs/crm-espace-pro.md, § 7 : api/session et
// api/site, demande-pro). Une démo est un espace privé à ce navigateur : rien n'est transmis à la
// distillerie.
import '../styles/base.css';
import '../styles/brand.css';
import '../styles/pratique.css';
import { initSite } from '../app/site.js';
import { api, demoActive } from '../lib/api.js';
import { mountDemoBar } from '../lib/demo.js';
import { $, $$, esc } from '../lib/dom.js';
import { icons } from '../lib/icons.js';

const site = initSite({ askAge: false });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NB = ' ';
const NNB = ' ';
const DEMO = { email: 'julien@cafe-des-platanes.example', mdp: 'Distillerie1835' };
const qs = new URLSearchParams(location.search);
// Retour prévu après la connexion (une page de l'espace connecté seulement)
const suite = /^\/espace-pro\/[\w/-]+(\?[\w=&%.-]*)?$/.test(qs.get('suite') || '') ? qs.get('suite') : null;

function mark(form, bad) {
  $$('input, select, textarea', form).forEach((el) => {
    const on = bad.has(el.name);
    el.classList.toggle('is-invalid', on);
    if (on) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
  });
  form.querySelector('.is-invalid')?.focus();
}

function say(el, text, kind = 'err') {
  el.className = `form-msg ${kind}`;
  el.textContent = text;
}

const busy = (btn, on, label) => {
  btn.disabled = on;
  if (label) btn.textContent = label;
};

// ---------- Connexion ----------
const login = $('#pro-login');
const loginMsg = $('#login-msg');

// Message d'arrivée : session expirée, déconnexion
if (qs.get('session') === 'expiree') say(loginMsg, `Votre session a expiré${NB}: reconnectez-vous pour continuer.`, 'info');
else if (qs.has('deconnecte')) say(loginMsg, 'Vous êtes déconnecté de l’espace pro.', 'ok');
else if (qs.get('demo') === 'lien-invalide') say(loginMsg, `Ce lien de démonstration n’est plus valable${NB}: ouvrez une nouvelle démo ci-dessous.`, 'info');

function go(redirection) {
  location.assign(suite || (redirection && /^\/espace-pro\//.test(redirection) ? redirection : '/espace-pro/accueil'));
}

login.addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(login));
  const bad = new Set();
  if (!EMAIL.test((d.email || '').trim())) bad.add('email');
  if (!d.mdp) bad.add('mdp');
  mark(login, bad);
  if (bad.size) return say(loginMsg, 'Indiquez votre identifiant (une adresse e-mail) et votre mot de passe.');
  const btn = login.querySelector('button[type="submit"]');
  busy(btn, true, 'Connexion…');
  try {
    const r = await api('session', 'connexion', { method: 'POST', body: { email: d.email.trim(), motDePasse: d.mdp, espace: 'pro', resterConnecte: d.rester === '1' } });
    say(loginMsg, 'Connexion réussie, ouverture de votre espace…', 'ok');
    go(r?.redirection);
  } catch (x) {
    busy(btn, false, 'Se connecter');
    login.elements.mdp.value = '';
    // Compte du personnel sur l'écran de l'espace pro : le message oriente vers le CRM.
    if (x?.code === 'mauvais-espace') {
      mark(login, new Set());
      say(loginMsg, x.message);
      const to = x.data?.redirection;
      if (to && /^\/(crm|espace-pro)/.test(to)) loginMsg.insertAdjacentHTML('beforeend', ` <a class="link" href="${esc(to)}">Ouvrir ${to.startsWith('/crm') ? 'le CRM' : 'l’espace pro'}</a>`);
      return;
    }
    mark(login, new Set(x?.champ === 'email' ? ['email'] : ['mdp']));
    say(loginMsg, x?.message || 'La connexion a échoué. Réessayez.');
  }
});

// Mot de passe oublié : lien de réinitialisation (en démo, l'API rend le lien pour le tester)
const forgot = $('#pro-forgot');
const forgotOpen = $('#forgot-open');
const forgotOut = $('#forgot-out');
function showForgot(on) {
  forgot.hidden = !on;
  login.hidden = on;
  forgotOpen.setAttribute('aria-expanded', String(on));
  if (on) {
    forgot.elements.email.value = login.elements.email.value;
    forgotOut.innerHTML = '';
    forgot.elements.email.focus();
  } else forgotOpen.focus();
}
forgotOpen.addEventListener('click', () => showForgot(true));
$('#forgot-close').addEventListener('click', () => showForgot(false));
forgot.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = forgot.elements.email.value.trim();
  mark(forgot, new Set(EMAIL.test(email) ? [] : ['email']));
  if (!EMAIL.test(email)) {
    forgotOut.innerHTML = `<p class="form-msg err">Indiquez l’adresse e-mail de votre compte.</p>`;
    return;
  }
  const btn = forgot.querySelector('button[type="submit"]');
  busy(btn, true, 'Envoi…');
  try {
    const r = await api('session', 'oubli', { method: 'POST', body: { email, espace: 'pro' } });
    forgotOut.innerHTML = `<p class="form-msg ok">Si un compte existe pour ${esc(email)}, un lien de réinitialisation vient de lui être envoyé.</p>${
      r?.lienDemo
        ? `<p class="pro-demo__link"><strong>Démonstration${NB}:</strong> aucun e-mail n’est envoyé. Le lien est aussi dans les courriels envoyés du CRM de démonstration. <a class="link" href="${esc(r.lienDemo)}">Ouvrir le lien de réinitialisation</a></p>`
        : ''
    }`;
    mountDemoBar({ toast: site.toast });
  } catch (x) {
    forgotOut.innerHTML = `<p class="form-msg err">${esc(x?.message || 'La demande n’a pas abouti. Réessayez.')}</p>`;
  } finally {
    busy(btn, false, 'Recevoir le lien');
  }
});

// Entrée en démo : un clic, sans mot de passe (profil client pro de la démo)
$('#pro-demo-go').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  busy(btn, true, 'Ouverture de la démo…');
  try {
    const r = await api('session', 'demo', { method: 'POST', body: { profil: 'pro' } });
    go(r?.redirection);
  } catch (x) {
    busy(btn, false, 'Découvrir l’espace pro (démo)');
    site.toast(x?.message || 'La démo n’a pas pu s’ouvrir. Réessayez.');
  }
});
$('#pro-demo-fill').addEventListener('click', () => {
  showForgot(false);
  login.elements.email.value = DEMO.email;
  login.elements.mdp.value = DEMO.mdp;
  login.querySelector('button[type="submit"]').focus();
});

// Déjà connecté dans cette démo : on propose de continuer (aucun appel sans démo).
async function session() {
  if (!demoActive()) return;
  let r;
  try {
    r = await api('session', 'moi', { query: { espace: 'pro' } });
  } catch {
    return;
  }
  const u = r?.utilisateur;
  if (!u) return;
  const nom = [u.prenom, u.nom].filter(Boolean).join(' ');
  const enseigne = r.compte?.enseigne || r.compte?.raisonSociale;
  $('#login-zone').hidden = true;
  const box = document.createElement('div');
  box.className = 'login-on';
  box.innerHTML = `<p class="login-on__who"><span class="login-on__icon">${icons.user}</span><span>Vous êtes connecté${NB}: <strong>${esc(nom)}</strong>${enseigne ? `, ${esc(enseigne)}` : ''}.</span></p>
    <div class="login-on__actions"><a class="btn btn--primary" href="${esc(suite || '/espace-pro/accueil')}">Continuer vers votre espace</a><button type="button" class="btn btn--ghost" id="login-out">Se déconnecter</button></div>`;
  $('#login-zone').after(box);
  $('#login-out', box).addEventListener('click', async () => {
    try {
      await api('session', 'deconnexion', { method: 'POST', body: { espace: 'pro' } });
    } catch {
      /* la session a pu expirer entre-temps : on affiche le formulaire de toute façon */
    }
    box.remove();
    $('#login-zone').hidden = false;
    say(loginMsg, 'Vous êtes déconnecté de l’espace pro.', 'ok');
    login.elements.email.focus();
  });
}
session();

// ---------- Demande de compte ----------
const ACTIVITES = { chr: 'Café, bar, restaurant', hotel: 'Hôtel', camping: 'Camping', caviste: 'Caviste', epicerie: 'Épicerie fine', distributeur: 'Distributeur, centrale d’achat', autre: 'Autre' };
const FIELD = { telephone: 'tel', societe: 'societe', activite: 'activite', siret: 'siret', nom: 'nom', ville: 'ville', email: 'email', message: 'message', rgpd: 'rgpd' };

$('#pro-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const d = Object.fromEntries(new FormData(form));
  const bad = new Set();
  const errs = [];
  if (!d.societe?.trim()) bad.add('societe');
  if (!d.activite) bad.add('activite');
  if (!d.nom?.trim()) bad.add('nom');
  if (!d.ville?.trim()) bad.add('ville');
  if (!EMAIL.test((d.email || '').trim())) bad.add('email');
  if (bad.size) errs.push('Complétez les champs en rouge.');
  const siret = (d.siret || '').replace(/\s/g, '');
  if (siret && !/^\d{14}$/.test(siret)) {
    bad.add('siret');
    errs.push('Le SIRET compte 14 chiffres.');
  }
  if (d.tel && !/^[+\d][\d\s.-]{8,}$/.test(d.tel.trim())) {
    bad.add('tel');
    errs.push('Ce numéro de téléphone ne semble pas valide.');
  }
  if (!d.rgpd) {
    bad.add('rgpd');
    errs.push('Cochez la case d’accord.');
  }
  mark(form, bad);
  const msg = $('#pro-msg');
  if (errs.length) return say(msg, errs.join(' '));
  const btn = form.querySelector('button[type="submit"]');
  busy(btn, true, 'Envoi de la demande…');
  msg.textContent = '';
  msg.className = 'form-msg';
  let r;
  try {
    r = await api('site', 'demande-pro', {
      method: 'POST',
      body: {
        societe: d.societe.trim(),
        activite: d.activite,
        siret: siret || undefined,
        nom: d.nom.trim(),
        ville: d.ville.trim(),
        email: d.email.trim(),
        telephone: d.tel?.trim() || undefined,
        message: d.message?.trim() || undefined,
        rgpd: true,
      },
    });
  } catch (x) {
    busy(btn, false, 'Envoyer la demande');
    const champ = FIELD[String(x?.champ || '').split('.').pop()];
    mark(form, new Set(champ ? [champ] : []));
    return say(msg, x?.message || 'La demande n’a pas pu être enregistrée. Réessayez.');
  }
  const crm = r?.liens?.crm;
  $('#pro-card').innerHTML = `<div class="done" tabindex="-1" id="pro-done">
    <span class="done__icon">${icons.check}</span>
    <h2>Demande enregistrée</h2>
    <p>Merci. ${r?.reference ? `Votre demande porte la référence <strong>${esc(r.reference)}</strong>. ` : ''}Les bureaux de la distillerie l’étudient et vous répondent à ${esc(d.email.trim())}${NB}: une fois le compte ouvert, vous recevez un lien pour choisir votre mot de passe.</p>
    <dl class="recap">
      <div><dt>Établissement</dt><dd>${esc(d.societe.trim())} · ${esc(ACTIVITES[d.activite] || d.activite)}</dd></div>
      <div><dt>Contact</dt><dd>${esc(d.nom.trim())} · ${esc(d.ville.trim())} · ${esc(d.email.trim())}</dd></div>
    </dl>
    <p class="mock-note"><strong>Démonstration${NB}:</strong> la demande est enregistrée dans un espace de démonstration privé, visible seulement depuis ce navigateur${NNB}; rien n’est transmis à la distillerie. Acceptez-la dans le CRM de démonstration pour recevoir l’invitation.</p>
    <div class="done__actions">
      ${crm ? `<a class="btn btn--primary" href="${esc(crm)}">Voir la demande dans le CRM (démo)</a>` : ''}
    </div>
  </div>`;
  $('#pro-done').focus();
  mountDemoBar({ toast: site.toast });
});
