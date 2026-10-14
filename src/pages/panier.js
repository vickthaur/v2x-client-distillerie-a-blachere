// Panier et commande (maquette : rien n'est payé ni envoyé).
// Étapes : panier → coordonnées → retrait ou livraison → récapitulatif → paiement simulé →
// confirmation. L'étape est dans l'adresse (?etape=…), le bouton « retour » du navigateur marche.
// Frais de livraison inconnus : ils sont « calculés avec la distillerie », jamais chiffrés.
import '../styles/base.css';
import '../styles/shop.css';
import '../styles/checkout.css';
import { initSite, totalsHTML } from '../app/site.js';
import { EVIN, MINEURS, euro } from '../data/products.js';
import { infos } from '../data/site.js';
import { cart } from '../lib/cart.js';
import { $, $$, esc, plural } from '../lib/dom.js';
import { icons } from '../lib/icons.js';
import { readJSON, writeJSON, remove } from '../lib/store.js';
import { thumbHTML, upgradeThumbs } from '../lib/thumbs.js';

const site = initSite();
const STEPS = [
  { id: 'panier', label: 'Panier', title: 'Votre panier' },
  { id: 'coordonnees', label: 'Coordonnées', title: 'Vos coordonnées' },
  { id: 'livraison', label: 'Retrait ou livraison', title: 'Retrait ou livraison' },
  { id: 'recapitulatif', label: 'Récapitulatif', title: 'Récapitulatif' },
  { id: 'paiement', label: 'Paiement', title: 'Paiement' },
  { id: 'confirmation', label: 'Confirmation', title: 'Merci !' },
];
const KEY = 'blachere-commande';
const order = readJSON(KEY, null, 'session') || {};
const save = () => writeJSON(KEY, order, 'session');
let step = 'panier';

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || '').trim());
const isPhone = (v) => /^(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}$/.test((v || '').trim());
const isCP = (v) => /^\d{5}$/.test((v || '').trim());
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return iso(d);
};
const frDate = (s) => new Date(`${s}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

// ---------- Validation des étapes ----------
function checkCoord(c = order.coord || {}, alcohol = cart.totals().alcohol) {
  const bad = [];
  if (!(c.prenom || '').trim()) bad.push(['prenom', 'Indiquez votre prénom.']);
  if (!(c.nom || '').trim()) bad.push(['nom', 'Indiquez votre nom.']);
  if (!isEmail(c.email)) bad.push(['email', 'Indiquez une adresse e-mail valide (ex. prenom@exemple.fr).']);
  if (!isPhone(c.tel)) bad.push(['tel', 'Indiquez un numéro de téléphone français valide (ex. 06 12 34 56 78).']);
  if (alcohol && !c.majeur) bad.push(['majeur', 'Votre panier contient de l’alcool : cochez « J’ai 18 ans ou plus ».']);
  return bad;
}
function checkMode(m = order) {
  const bad = [];
  if (m.mode !== 'retrait' && m.mode !== 'livraison') bad.push(['mode', 'Choisissez le retrait à la distillerie ou la livraison.']);
  if (m.mode === 'retrait' && m.retrait?.date) {
    const d = m.retrait.date;
    if (d < tomorrow()) bad.push(['date', 'Choisissez une date à partir de demain.']);
    else if (new Date(`${d}T12:00:00`).getDay() === 0) bad.push(['date', 'La boutique est fermée le dimanche : choisissez un autre jour.']);
  }
  if (m.mode === 'livraison') {
    const l = m.livraison || {};
    if (!(l.adresse || '').trim()) bad.push(['adresse', 'Indiquez l’adresse de livraison.']);
    if (!isCP(l.cp)) bad.push(['cp', 'Indiquez un code postal à 5 chiffres.']);
    if (!(l.ville || '').trim()) bad.push(['ville', 'Indiquez la ville.']);
  }
  return bad;
}
// Première étape incomplète (on ne saute pas d'étape).
function firstIncomplete() {
  if (!cart.items.length) return 'panier';
  if (checkCoord().length) return 'coordonnees';
  if (checkMode().length) return 'livraison';
  return null;
}

// ---------- Rendu ----------
function stepsHTML() {
  const k = STEPS.findIndex((s) => s.id === step);
  return STEPS.map(
    (s, i) =>
      `<li class="steps__item${i < k ? ' is-done' : ''}${i === k ? ' is-current' : ''}"${i === k ? ' aria-current="step"' : ''}><span class="steps__n">${i < k ? icons.check : i + 1}</span><span class="steps__label">${s.label}</span></li>`,
  ).join('');
}

function lineHTML(l, editable) {
  const p = l.product;
  return `<li class="co-line" data-slug="${p.slug}" data-v="${l.v ?? ''}">
    <a class="co-line__img" href="/boutique/${p.slug}" style="--c:${p.light}" tabindex="-1" aria-hidden="true">${thumbHTML(p)}</a>
    <div class="co-line__info">
      <a class="co-line__name" href="/boutique/${p.slug}">${esc(p.nom)}</a>
      <span class="co-line__meta">${esc(l.contenance?.volume || 'Contenance à confirmer')} · ${l.prix !== null ? `${euro(l.prix)} l’unité` : 'Prix en boutique'}</span>
      ${p.alcool ? `<span class="co-line__evin">${esc(EVIN)}</span>` : ''}
    </div>
    ${
      editable
        ? `<span class="qty" role="group" aria-label="Quantité de ${esc(p.nom)}">
        <button type="button" data-q="-1" aria-label="Retirer un ${esc(p.nom)}">${icons.minus}</button>
        <output>${l.qty}</output>
        <button type="button" data-q="1" aria-label="Ajouter un ${esc(p.nom)}">${icons.plus}</button>
      </span>
      <button type="button" class="co-line__del" data-del aria-label="Supprimer ${esc(p.nom)} du panier">${icons.trash}</button>`
        : `<span class="co-line__qty">× ${l.qty}</span>`
    }
    <strong class="co-line__total">${l.total !== null ? euro(l.total) : '—'}</strong>
  </li>`;
}

function modeSummary() {
  if (order.mode === 'retrait')
    return `<p class="co-mode">${icons.store}<span><strong>Retrait à la distillerie</strong><br />${esc(infos.adresseLigne)}<br />${esc(infos.retrait)}, du lundi au samedi${order.retrait?.date ? `<br />Jour souhaité : ${esc(frDate(order.retrait.date))}` : ''}</span></p>`;
  if (order.mode === 'livraison') {
    const l = order.livraison || {};
    return `<p class="co-mode">${icons.truck}<span><strong>Livraison</strong><br />${esc(l.adresse)}${l.complement ? `, ${esc(l.complement)}` : ''}<br />${esc(l.cp)} ${esc(l.ville)}</span></p>`;
  }
  return '';
}

function payable(t) {
  return t.subtotal;
}

function totalsFull(t) {
  const rows = [`<div class="totals__row"><span>Sous-total${t.unpriced ? ' (prix affichés en ligne)' : ''}</span><strong>${euro(t.subtotal)}</strong></div>`];
  if (t.unpriced) rows.push(`<div class="totals__row"><span>${plural(t.unpriced, 'article')} au prix de la boutique</span><span>confirmé par la distillerie</span></div>`);
  if (order.mode === 'retrait') rows.push('<div class="totals__row"><span>Retrait à la distillerie</span><span>sur place</span></div>');
  if (order.mode === 'livraison') rows.push('<div class="totals__row"><span>Livraison</span><span>frais indiqués avant validation</span></div>');
  rows.push(
    `<div class="totals__row totals__row--total"><span>${order.mode === 'livraison' ? 'À payer (hors livraison)' : 'À payer'}</span><strong data-total>${euro(payable(t))}</strong></div>`,
  );
  return `<div class="totals">${rows.join('')}</div>`;
}

function sideHTML() {
  const done = step === 'confirmation' && order.done;
  const t = done ? order.done.totals : cart.totals();
  const lines = done ? order.done.lines : t.lines;
  if (!lines.length) return '';
  return `<div class="co-card">
    <h2 class="co-card__title">Récapitulatif</h2>
    <ul class="co-mini">${lines
      .map((l) => `<li><span>${esc(l.nom || l.product.nom)} <small>× ${l.qty}</small></span><span>${l.total !== null ? euro(l.total) : '—'}</span></li>`)
      .join('')}</ul>
    ${step === 'panier' ? totalsHTML(t) : totalsFull(t)}
    ${step !== 'panier' ? modeSummary() : ''}
    ${t.alcohol ? `<p class="evin">${esc(EVIN)} ${esc(MINEURS)}</p>` : ''}
    <p class="co-card__fine">Maquette : aucun paiement n’est demandé et rien n’est envoyé.</p>
  </div>`;
}

const field = (name, label, value = '', attrs = '', hint = '') =>
  `<label class="field"><span>${label}</span><input name="${name}" value="${esc(value)}" ${attrs} />${hint ? `<small class="field__hint">${hint}</small>` : ''}<small class="field__err" data-err="${name}"></small></label>`;

const VIEWS = {
  panier() {
    const t = cart.totals();
    if (!t.lines.length)
      return `<div class="co-empty"><p class="co-empty__title">Votre panier est vide.</p><p>${site.majeur ? 'Les sirops et les spiritueux de la maison vous attendent dans la boutique.' : 'PAC Citron, Fun Blue et une trentaine de sirops vous attendent dans la boutique.'}</p><a class="btn btn--primary" href="/boutique">Voir la boutique</a></div>`;
    return `<ul class="co-lines">${t.lines.map((l) => lineHTML(l, true)).join('')}</ul>
      <div class="co-sum">${totalsHTML(t)}${t.alcohol ? `<p class="evin">${esc(EVIN)} ${esc(MINEURS)}</p>` : ''}</div>
      <div class="co-actions"><a class="btn btn--ghost" href="/boutique">Continuer mes achats</a><button type="button" class="btn btn--primary" data-next>Commander</button></div>`;
  },
  coordonnees() {
    const c = order.coord || {};
    const alcohol = cart.totals().alcohol;
    return `<form class="co-form" id="co-form" novalidate>
      <div class="form-row">${field('prenom', 'Prénom', c.prenom, 'autocomplete="given-name" required')}${field('nom', 'Nom', c.nom, 'autocomplete="family-name" required')}</div>
      <div class="form-row">${field('email', 'E-mail', c.email, 'type="email" autocomplete="email" required inputmode="email"')}${field('tel', 'Téléphone', c.tel, 'type="tel" autocomplete="tel" required inputmode="tel"', 'Pour vous prévenir quand la commande est prête.')}</div>
      ${
        alcohol
          ? `<div class="co-age"><label class="check"><input type="checkbox" name="majeur" value="1"${c.majeur ? ' checked' : ''} required /><span><strong>J’ai 18 ans ou plus.</strong> Votre panier contient de l’alcool : la vente d’alcool est interdite aux mineurs de moins de 18 ans.</span></label><small class="field__err" data-err="majeur"></small><p class="evin">${esc(EVIN)}</p></div>`
          : ''
      }
      <p class="form-msg" role="alert" id="co-msg"></p>
      <div class="co-actions"><button type="button" class="btn btn--ghost" data-prev>Retour au panier</button><button type="submit" class="btn btn--primary">Continuer</button></div>
    </form>`;
  },
  livraison() {
    const l = order.livraison || {};
    const r = order.retrait || {};
    return `<form class="co-form" id="co-form" novalidate>
      <fieldset class="modes" id="modes">
        <legend class="sr-only">Mode de remise</legend>
        <label class="mode">
          <input type="radio" name="mode" value="retrait"${order.mode === 'retrait' ? ' checked' : ''} />
          <span class="mode__card">${icons.store}<span><strong>Retrait à la distillerie</strong><span>${esc(infos.adresseLigne)}</span><span>Horaires de retrait : ${esc(infos.retrait)}, du lundi au samedi</span></span></span>
        </label>
        <label class="mode">
          <input type="radio" name="mode" value="livraison"${order.mode === 'livraison' ? ' checked' : ''} />
          <span class="mode__card">${icons.truck}<span><strong>Livraison</strong><span>Expédiée sous 3 jours ouvrés au plus après la réception du règlement, livrée dans les 30 jours au plus. Les frais de livraison sont indiqués avant la validation de la commande.</span></span></span>
        </label>
        <small class="field__err" data-err="mode"></small>
      </fieldset>
      <div class="co-sub" data-for="retrait" ${order.mode === 'retrait' ? '' : 'hidden'}>
        ${field('date', 'Jour de retrait souhaité (facultatif)', r.date || '', `type="date" min="${tomorrow()}"`, 'Du lundi au samedi. La distillerie vous confirme le jour de retrait.')}
      </div>
      <div class="co-sub" data-for="livraison" ${order.mode === 'livraison' ? '' : 'hidden'}>
        ${field('adresse', 'Adresse', l.adresse, 'autocomplete="address-line1"')}
        ${field('complement', 'Complément (facultatif)', l.complement, 'autocomplete="address-line2"')}
        <div class="form-row">${field('cp', 'Code postal', l.cp, 'autocomplete="postal-code" inputmode="numeric" maxlength="5"')}${field('ville', 'Ville', l.ville, 'autocomplete="address-level2"')}</div>
      </div>
      <p class="form-msg" role="alert" id="co-msg"></p>
      <div class="co-actions"><button type="button" class="btn btn--ghost" data-prev>Retour</button><button type="submit" class="btn btn--primary">Continuer</button></div>
    </form>`;
  },
  recapitulatif() {
    const t = cart.totals();
    const c = order.coord || {};
    return `<div class="co-recap">
      <ul class="co-lines">${t.lines.map((l) => lineHTML(l, false)).join('')}</ul>
      <div class="co-recap__grid">
        <div class="co-card co-card--flat"><h2 class="co-card__title">Vos coordonnées</h2><p>${esc(c.prenom)} ${esc(c.nom)}<br />${esc(c.email)}<br />${esc(c.tel)}</p><button type="button" class="link" data-goto="coordonnees">Modifier</button></div>
        <div class="co-card co-card--flat"><h2 class="co-card__title">Remise</h2>${modeSummary()}<button type="button" class="link" data-goto="livraison">Modifier</button></div>
      </div>
      ${totalsFull(t)}
      ${t.unpriced ? `<p class="co-note">${plural(t.unpriced, 'article n’a', 'articles n’ont')} pas de prix affiché en ligne : la distillerie vous confirme le montant avant de préparer la commande.</p>` : ''}
      ${order.mode === 'livraison' ? '<p class="co-note">Les frais de livraison (et, hors de France, les taxes douanières) sont indiqués avant la validation de la commande et facturés en supplément, selon les conditions générales de vente de la distillerie.</p>' : ''}
      <p class="co-note">Droit de rétractation : quatorze jours francs à compter de la réception, pour des articles intacts et non ouverts. Colis endommagé : le refuser ou l’indiquer sur le récépissé ; la distillerie réexpédie ou rembourse.</p>
      <div class="co-actions"><button type="button" class="btn btn--ghost" data-prev>Retour</button><button type="button" class="btn btn--primary" data-next>Passer au paiement</button></div>
    </div>`;
  },
  paiement() {
    const t = cart.totals();
    const pay = order.paiement || 'carte';
    return `<form class="co-form" id="co-form" novalidate>
      ${t.alcohol ? `<div class="co-mineurs" role="note"><strong>Vente interdite aux mineurs</strong><span>Votre commande contient de l’alcool : la vente d’alcool est interdite aux mineurs de moins de 18 ans.</span><span class="evin">${esc(EVIN)}</span></div>` : ''}
      <div class="co-sim">
        <p class="co-sim__badge">Paiement simulé</p>
        <p>Maquette : aucun paiement n’est demandé. Sur le site en ligne, cette étape ouvrira le paiement sécurisé.</p>
      </div>
      <fieldset class="modes">
        <legend class="sr-only">Moyen de paiement</legend>
        <label class="mode"><input type="radio" name="paiement" value="carte"${pay === 'carte' ? ' checked' : ''} /><span class="mode__card">${icons.card}<span><strong>Carte bancaire</strong><span>CB, Visa, Mastercard (simulation)</span></span></span></label>
        <label class="mode"><input type="radio" name="paiement" value="paypal"${pay === 'paypal' ? ' checked' : ''} /><span class="mode__card">${icons.card}<span><strong>PayPal</strong><span>Simulation</span></span></span></label>
        <label class="mode"><input type="radio" name="paiement" value="virement"${pay === 'virement' ? ' checked' : ''} /><span class="mode__card">${icons.card}<span><strong>Virement bancaire</strong><span>Simulation : les coordonnées bancaires seraient envoyées par e-mail</span></span></span></label>
      </fieldset>
      <label class="check co-cgv"><input type="checkbox" name="cgv" required /><span>J’ai lu et j’accepte les <a class="link" href="/conditions-de-vente" target="_blank" rel="noopener">conditions générales de vente</a>.</span></label>
      ${t.alcohol ? '<label class="check co-cgv"><input type="checkbox" name="majeur" required /><span>Je certifie avoir 18 ans révolus.</span></label>' : ''}
      <p class="form-msg" role="alert" id="co-msg"></p>
      <div class="co-actions"><button type="button" class="btn btn--ghost" data-prev>Retour</button><button type="submit" class="btn btn--primary" id="pay">Payer ${euro(payable(t))} (simulation)</button></div>
    </form>`;
  },
  confirmation() {
    const d = order.done;
    if (!d) return VIEWS.panier();
    // Commande avec alcool : cadre maison (jamais l'univers PAC à côté d'un spiritueux).
    return `<div class="co-done${d.totals?.alcohol ? ' co-done--maison' : ''}">
      <p class="co-done__seal" aria-hidden="true">${icons.check}</p>
      <p class="co-done__lead">Merci ${esc(d.prenom)} ! Votre commande <strong>${esc(d.numero)}</strong> est enregistrée.</p>
      <p>${
        d.mode === 'retrait'
          ? `Vous la retirerez à la distillerie, ${esc(infos.adresseLigne)}, ${esc(infos.retrait)}, du lundi au samedi${d.date ? ` (jour souhaité : ${esc(frDate(d.date))})` : ''}.`
          : `Elle sera expédiée sous 3 jours ouvrés au plus après la réception du règlement, à l’adresse indiquée.`
      }</p>
      <p>Sur le site en ligne, vous recevriez une confirmation par e-mail à ${esc(d.email)}.</p>
      <p class="co-sim"><span class="co-sim__badge">Maquette</span> Rien n’a été payé ni envoyé.</p>
      <div class="co-actions"><a class="btn btn--primary" href="/boutique">Retour à la boutique</a><a class="btn btn--ghost" href="/visiter">Préparer une visite</a></div>
    </div>`;
  },
};

function showErrors(form, bad) {
  $$('.is-invalid', form).forEach((el) => {
    el.classList.remove('is-invalid');
    el.removeAttribute('aria-invalid');
  });
  $$('[data-err]', form).forEach((el) => (el.textContent = ''));
  bad.forEach(([name, msg]) => {
    const el = form.elements[name];
    const target = el instanceof RadioNodeList ? null : el;
    if (target) {
      target.classList.add('is-invalid');
      target.setAttribute('aria-invalid', 'true');
    }
    const err = $(`[data-err="${name}"]`, form);
    if (err) err.textContent = msg;
  });
  const msg = $('#co-msg', form);
  if (msg) msg.textContent = bad.length ? 'Merci de corriger les champs signalés.' : '';
  if (bad.length) {
    const first = form.elements[bad[0][0]];
    (first instanceof RadioNodeList ? first[0] : first)?.focus();
  }
}

function render(focus = false) {
  const meta = STEPS.find((s) => s.id === step);
  $('#co-title').textContent = meta.title;
  document.title = `${meta.title} · Distillerie A. Blachère`;
  $('#steps').innerHTML = stepsHTML();
  $('#steps').hidden = step === 'panier' && !cart.items.length;
  $('#co-main').innerHTML = VIEWS[step]();
  $('#co-side').innerHTML = step === 'panier' ? '' : sideHTML();
  $('#co-side').hidden = step === 'panier';
  document.body.dataset.step = step;
  bindStep();
  upgradeThumbs($('#co-main'));
  if (focus) {
    $('#co-main').focus({ preventScroll: true });
    scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function go(next, { push = true } = {}) {
  const k = STEPS.findIndex((s) => s.id === next);
  const block = firstIncomplete();
  if (next !== 'panier' && next !== 'confirmation' && block) {
    const kb = STEPS.findIndex((s) => s.id === block);
    if (kb < k) next = block;
  }
  if (next === 'confirmation' && !order.done) next = block || 'paiement';
  step = next;
  const url = step === 'panier' ? '/panier' : `/panier?etape=${step}`;
  if (push) history.pushState({ step }, '', url);
  else history.replaceState({ step }, '', url);
  render(true);
}

function bindStep() {
  const main = $('#co-main');
  $$('[data-next]', main).forEach((b) => b.addEventListener('click', () => go(STEPS[STEPS.findIndex((s) => s.id === step) + 1].id)));
  $$('[data-prev]', main).forEach((b) => b.addEventListener('click', () => go(STEPS[STEPS.findIndex((s) => s.id === step) - 1].id)));
  $$('[data-goto]', main).forEach((b) => b.addEventListener('click', () => go(b.dataset.goto)));
  const form = $('#co-form', main);
  if (!form) return;
  if (step === 'coordonnees') {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const c = { prenom: fd.get('prenom') || '', nom: fd.get('nom') || '', email: fd.get('email') || '', tel: fd.get('tel') || '', majeur: fd.get('majeur') === '1' };
      order.coord = c;
      save();
      const bad = checkCoord(c);
      showErrors(form, bad);
      if (!bad.length) go('livraison');
    });
  }
  if (step === 'livraison') {
    const sync = () => {
      const mode = form.elements.mode.value;
      $$('.co-sub', form).forEach((s) => (s.hidden = s.dataset.for !== mode));
    };
    form.addEventListener('change', sync);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      order.mode = fd.get('mode') || null;
      order.retrait = { date: fd.get('date') || '' };
      order.livraison = { adresse: fd.get('adresse') || '', complement: fd.get('complement') || '', cp: fd.get('cp') || '', ville: fd.get('ville') || '' };
      if (!['carte', 'paypal', 'virement'].includes(order.paiement)) order.paiement = 'carte';
      save();
      const bad = checkMode();
      showErrors(form, bad);
      if (!bad.length) go('recapitulatif');
    });
  }
  if (step === 'paiement') {
    form.addEventListener('change', () => {
      order.paiement = form.elements.paiement.value;
      save();
      $('#pay').textContent = `Payer ${euro(payable(cart.totals()))} (simulation)`;
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const block = firstIncomplete();
      if (block) return go(block);
      // Conditions générales de vente acceptées (et majorité certifiée si la commande contient de l'alcool)
      const bad = [];
      if (!form.elements.cgv?.checked) bad.push(['cgv', 'Merci de lire et d’accepter les conditions générales de vente.']);
      if (form.elements.majeur && !form.elements.majeur.checked) bad.push(['majeur', 'La vente d’alcool est interdite aux mineurs : merci de certifier avoir 18 ans révolus.']);
      if (bad.length) {
        const msg = $('#co-msg', form);
        if (msg) msg.textContent = bad.map((b) => b[1]).join(' ');
        form.elements[bad[0][0]]?.focus();
        return;
      }
      const t = cart.totals();
      const now = new Date();
      order.done = {
        numero: `BL-${iso(now).replace(/-/g, '')}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        prenom: order.coord.prenom,
        email: order.coord.email,
        mode: order.mode,
        date: order.retrait?.date || '',
        paiement: order.paiement || 'carte',
        lines: t.lines.map((l) => ({ nom: l.product.nom, qty: l.qty, total: l.total, prix: l.prix })),
        totals: { subtotal: t.subtotal, unpriced: t.unpriced, alcohol: t.alcohol, count: t.count, lines: [] },
      };
      save();
      cart.clear();
      go('confirmation');
    });
  }
}

// Panier : quantités et suppression
document.addEventListener('click', (e) => {
  const li = e.target.closest('.co-line');
  if (!li || step !== 'panier') return;
  const slug = li.dataset.slug;
  const v = li.dataset.v || null;
  const line = cart.items.find((i) => i.slug === slug && (i.v ?? null) === v);
  if (!line) return;
  if (e.target.closest('[data-del]')) cart.set(slug, v, 0);
  const q = e.target.closest('[data-q]');
  if (q) cart.set(slug, v, line.qty + Number(q.dataset.q));
});

cart.subscribe(() => {
  if (step === 'panier') render();
  else if (!cart.items.length && step !== 'confirmation') go('panier', { push: false });
  else $('#co-side').innerHTML = sideHTML();
});
site.onAge(() => render());
addEventListener('popstate', () => {
  const s = new URLSearchParams(location.search).get('etape') || 'panier';
  step = STEPS.some((x) => x.id === s) ? s : 'panier';
  go(step, { push: false });
});

// Nouvelle commande après une confirmation : on repart du panier.
const asked = new URLSearchParams(location.search).get('etape') || 'panier';
if (asked !== 'confirmation' && order.done) {
  delete order.done;
  remove(KEY, 'session');
  save();
}
go(STEPS.some((s) => s.id === asked) ? asked : 'panier', { push: false });
