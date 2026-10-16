// Panier et commande, branchés sur l'API de la démo (docs/crm-espace-pro.md, § 7, api/site) :
// frais de livraison (retrait gratuit, Colissimo à domicile ou en point relais) et code promo
// calculés par le serveur, commande enregistrée dans la démo de ce navigateur (paiement simulé),
// confirmation avec le numéro, le paiement et le lien vers le CRM de démonstration.
// Étapes : panier → coordonnées → retrait ou livraison → récapitulatif → paiement → confirmation.
// L'étape est dans l'adresse (?etape=…), le bouton « retour » du navigateur marche.
import '../styles/base.css';
import '../styles/shop.css';
import '../styles/checkout.css';
import '../styles/operation.css';
import { initSite, totalsHTML, affinerLivraison } from '../app/site.js';
import { EVIN, MINEURS, prixAuLitreHTML } from '../data/products.js';
import { infos } from '../data/site.js';
import { api } from '../lib/api.js';
import { cart } from '../lib/cart.js';
import { loadDemoPrices, mountDemoBar, ETATS } from '../lib/demo.js';
import { $, $$, esc, plural } from '../lib/dom.js';
import { icons } from '../lib/icons.js';
import { operationAffichee, lignePanierHTML, donPour, ruban, euros as eurosOp } from '../lib/operation.js';
import { OPERATIONS } from '../data/operation.js';
import { readJSON, writeJSON, remove } from '../lib/store.js';
import { thumbHTML, upgradeThumbs } from '../lib/thumbs.js';
import { erreursParChamp } from '../lib/formulaire.js';

const site = initSite();
const NB = ' ';
const NNB = ' ';
// Montants : espace insécable avant l'euro (« 14,90 € »), comme partout sur le site (la fine ne se
// voyait presque pas avec Archivo).
const euro = (n) => `${Number(n || 0).toFixed(2).replace('.', ',')}${NB}€`;
const STEPS = [
  { id: 'panier', label: 'Panier', title: 'Votre panier' },
  { id: 'coordonnees', label: 'Coordonnées', title: 'Vos coordonnées' },
  { id: 'livraison', label: 'Retrait ou livraison', title: 'Retrait ou livraison' },
  { id: 'recapitulatif', label: 'Récapitulatif', title: 'Récapitulatif' },
  { id: 'paiement', label: 'Paiement', title: 'Paiement' },
  { id: 'confirmation', label: 'Confirmation', title: `Merci${NNB}!` },
];
const KEY = 'blachere-commande';
const order = readJSON(KEY, null, 'session') || {};
const save = () => writeJSON(KEY, order, 'session');
let step = 'panier';
// Message d'un refus du serveur pour stock insuffisant, affiché au panier jusqu'au prochain changement.
let stockMsg = '';
// Opération du moment (Octobre Rose) : don affiché au panier, au récapitulatif et à la confirmation.
const operation = operationAffichee();

const TRANSPORTS = {
  colissimo: { label: 'Colissimo à domicile', icon: icons.truck },
  relais: { label: 'Colissimo en point relais', icon: icons.pin },
};
const PAIEMENTS = { carte: 'Carte bancaire', paypal: 'PayPal', virement: 'Virement bancaire' };

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || '').trim());
const isPhone = (v) => /^(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}$/.test((v || '').trim());
const isCP = (v) => /^\d{5}$/.test((v || '').trim());
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return iso(d);
};
// Retrait : du lundi au samedi, à partir de demain et dans les 30 jours (règle du serveur).
const maxRetrait = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return iso(d);
};
const premierJourRetrait = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return iso(d);
};
const frDate = (s) => new Date(`${s}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

// Lignes envoyées au serveur : uniquement des quantités (le serveur recalcule tout).
const apiLines = () => cart.items.map((i) => ({ slug: i.slug, varianteId: String(i.v), qte: i.qty }));
// Articles en rupture ou retirés de la vente dans la démo : à retirer avant de commander.
const blocked = (t = cart.totals()) => t.lines.filter((l) => l.etat === 'rupture' || l.etat === 'inactif');

// ---------- Frais de livraison (api/site, livraison) ----------
const quotes = new Map();
function quote(cp = order.livraison?.cp) {
  const body = { lignes: apiLines(), mode: order.transport || 'colissimo', cp: isCP(cp) ? cp.trim() : undefined };
  const key = JSON.stringify(body);
  if (!quotes.has(key))
    quotes.set(
      key,
      api('site', 'livraison', { method: 'POST', body }).then(
        (r) => {
          order.devisLivraison = { key, options: r?.options || [], francoRestantTTC: r?.francoRestantTTC ?? null };
          save();
          return order.devisLivraison;
        },
        (e) => {
          quotes.delete(key);
          throw e;
        },
      ),
    );
  return quotes.get(key);
}
const quoteFresh = () => order.devisLivraison?.key === JSON.stringify({ lignes: apiLines(), mode: order.transport || 'colissimo', cp: isCP(order.livraison?.cp) ? order.livraison.cp.trim() : undefined });
const option = (mode) => order.devisLivraison?.options?.find((o) => o.mode === mode) || null;

// Frais de livraison TTC de la commande (0 au retrait ; null tant que le serveur n'a pas répondu).
function livraisonTTC() {
  if (order.mode === 'retrait') return 0;
  if (order.mode !== 'livraison') return null;
  if (order.promo?.livraisonOfferte) return 0;
  const o = option(order.transport || 'colissimo');
  return o && quoteFresh() ? o.prixTTC : null;
}

function montants(t = cart.totals()) {
  const remise = Math.min(order.promo?.remiseTTC || 0, t.subtotal);
  const livraison = livraisonTTC();
  return { articles: t.subtotal, remise, livraison, total: Math.round((t.subtotal - remise + (livraison || 0)) * 100) / 100 };
}

// ---------- Code promo (api/site, code-promo) ----------
async function checkPromo(code) {
  const r = await api('site', 'code-promo', { method: 'POST', body: { code, lignes: apiLines() } });
  if (r && r.valide === false) throw Object.assign(new Error(r.erreur || r.message || 'Ce code promo n’est pas valable.'), { champ: 'code' });
  order.promo = { code: r?.code || code, libelle: r?.libelle || code, remiseTTC: r?.remiseTTC || 0, livraisonOfferte: !!r?.livraisonOfferte, panier: JSON.stringify(apiLines()) };
  save();
  return order.promo;
}
// Le panier a changé depuis l'application du code : il est revérifié par le serveur.
async function refreshPromo() {
  if (!order.promo || order.promo.panier === JSON.stringify(apiLines())) return;
  try {
    await checkPromo(order.promo.code);
  } catch (e) {
    const code = order.promo.code;
    delete order.promo;
    save();
    site.toast(`Code ${code} retiré${NB}: ${e?.message || 'il ne s’applique plus à ce panier.'}`);
  }
}

// ---------- Validation des étapes ----------
function checkCoord(c = order.coord || {}, alcohol = cart.totals().alcohol) {
  const bad = [];
  if (!(c.prenom || '').trim()) bad.push(['prenom', 'Indiquez votre prénom.']);
  if (!(c.nom || '').trim()) bad.push(['nom', 'Indiquez votre nom.']);
  if (!isEmail(c.email)) bad.push(['email', 'Indiquez une adresse e-mail valide (ex. prenom@exemple.fr).']);
  if (!isPhone(c.tel)) bad.push(['tel', 'Indiquez un numéro de téléphone français valide (ex. 06 12 34 56 78).']);
  if (alcohol && !c.majeur) bad.push(['majeur', 'Votre panier contient de l’alcool\u00a0: cochez «\u00a0J’ai 18 ans ou plus\u00a0».']);
  return bad;
}
function checkMode(m = order) {
  const bad = [];
  if (m.mode !== 'retrait' && m.mode !== 'livraison') bad.push(['mode', 'Choisissez le retrait à la distillerie ou la livraison.']);
  if (m.mode === 'retrait') {
    const d = m.retrait?.date;
    if (!d) bad.push(['date', 'Choisissez le jour de retrait.']);
    else if (d < tomorrow()) bad.push(['date', 'Choisissez une date à partir de demain.']);
    else if (d > maxRetrait()) bad.push(['date', 'Choisissez un jour dans les 30 prochains jours.']);
    else if (new Date(`${d}T12:00:00`).getDay() === 0) bad.push(['date', 'La boutique est fermée le dimanche\u00a0: choisissez un autre jour.']);
  }
  if (m.mode === 'livraison') {
    const l = m.livraison || {};
    if (!TRANSPORTS[m.transport]) bad.push(['transport', 'Choisissez Colissimo à domicile ou en point relais.']);
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
  const etat = ETATS[l.etat];
  return `<li class="co-line${etat ? ` is-${l.etat}` : ''}" data-slug="${p.slug}" data-v="${l.v ?? ''}">
    <a class="co-line__img" href="/boutique/${p.slug}" style="--c:${p.light}" tabindex="-1" aria-hidden="true">${thumbHTML(p)}</a>
    <div class="co-line__info">
      <a class="co-line__name" href="/boutique/${p.slug}">${esc(p.nom)}</a>
      <span class="co-line__meta">${esc(l.contenance?.volume || 'Contenance à confirmer')} · ${l.prix !== null ? `${euro(l.prix)} l’unité${prixAuLitreHTML({ ...l.contenance, prix: l.prix }) ? ` · ${prixAuLitreHTML({ ...l.contenance, prix: l.prix })}` : ''}` : 'Prix en boutique'}</span>
      ${etat ? `<span class="co-line__stock co-line__stock--${l.etat}">${esc(etat)}${l.etat === 'stock-bas' ? '' : `${NB}: retirez cet article pour commander`}</span>` : ''}
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
    return `<p class="co-mode">${icons.store}<span><strong>Retrait à la distillerie</strong> · gratuit<br />${esc(infos.adresseLigne)}<br />${esc(infos.retrait)}, du lundi au samedi${order.retrait?.date ? `<br />Jour de retrait${NB}: ${esc(frDate(order.retrait.date))}` : ''}</span></p>`;
  if (order.mode === 'livraison') {
    const l = order.livraison || {};
    const tr = TRANSPORTS[order.transport] || TRANSPORTS.colissimo;
    return `<p class="co-mode">${tr.icon}<span><strong>${esc(tr.label)}</strong><br />${esc(l.adresse)}${l.complement ? `, ${esc(l.complement)}` : ''}<br />${esc(l.cp)} ${esc(l.ville)}</span></p>`;
  }
  return '';
}

// Totaux du récapitulatif et du paiement : articles, code promo, livraison (calculés par le serveur).
function totalsFull(t, { compact = false } = {}) {
  const m = montants(t);
  const rows = [`<div class="totals__row"><span>Articles${t.unpriced ? ' (prix affichés en ligne)' : ''}</span><strong>${euro(m.articles)}</strong></div>`];
  if (t.unpriced) rows.push(`<div class="totals__row"><span>${plural(t.unpriced, 'article')} au prix de la boutique</span><span>confirmé par la distillerie</span></div>`);
  if (order.promo) rows.push(`<div class="totals__row totals__row--promo"><span>Code ${esc(order.promo.code)}${!compact && order.promo.libelle && order.promo.libelle !== order.promo.code ? ` <small>· ${esc(order.promo.libelle)}</small>` : ''}</span><strong>${m.remise ? `−${euro(m.remise)}` : 'appliqué'}</strong></div>`);
  if (order.mode === 'retrait') rows.push('<div class="totals__row"><span>Retrait à la distillerie</span><span>gratuit</span></div>');
  if (order.mode === 'livraison') {
    const tr = TRANSPORTS[order.transport] || TRANSPORTS.colissimo;
    rows.push(`<div class="totals__row"><span>${esc(tr.label)}</span>${m.livraison === null ? '<span class="totals__wait">calcul…</span>' : `<strong>${m.livraison ? euro(m.livraison) : 'offerte'}</strong>`}</div>`);
  }
  rows.push(`<div class="totals__row totals__row--total"><span>Total TTC</span><strong data-total>${euro(m.total)}</strong></div>`);
  return `<div class="totals">${rows.join('')}</div>`;
}

const donHTML = (lines) => (operation ? lignePanierHTML(operation, lines) : '');
const DEMO_NOTE = `Démonstration${NB}: la commande est enregistrée dans un espace de démonstration privé, visible seulement depuis ce navigateur${NNB}; aucun paiement n’est demandé et rien n’est transmis à la distillerie.`;

function sideHTML() {
  const done = step === 'confirmation' && order.done;
  if (done) return '';
  const t = cart.totals();
  if (!t.lines.length) return '';
  return `<div class="co-card">
    <h2 class="co-card__title">Récapitulatif</h2>
    <ul class="co-mini">${t.lines.map((l) => `<li><span>${esc(l.product.nom)} <small>× ${l.qty}</small></span><span>${l.total !== null ? euro(l.total) : '—'}</span></li>`).join('')}</ul>
    ${step === 'panier' ? totalsHTML(t) : totalsFull(t, { compact: true })}
    ${donHTML(t.lines)}
    ${step !== 'panier' ? modeSummary() : ''}
    ${t.alcohol ? `<p class="evin">${esc(EVIN)} ${esc(MINEURS)}</p>` : ''}
    <p class="co-card__fine">${DEMO_NOTE}</p>
  </div>`;
}

// Champ : libellé (astérisque si obligatoire), aide et message d'erreur reliés au champ par
// aria-describedby ; une erreur par champ (A11Y-10).
const NOTE_OBLIGATOIRES = '<p class="form-note">Les champs marqués d’un astérisque (*) sont obligatoires.</p>';
const etoile = '<span class="req" aria-hidden="true"> *</span>';
const field = (name, label, value = '', attrs = '', hint = '') =>
  `<label class="field"><span>${label}${/\brequired\b/.test(attrs) ? etoile : ''}</span><input name="${name}" value="${esc(value)}" ${attrs} aria-describedby="${hint ? `co-aide-${name} ` : ''}co-err-${name}" />${hint ? `<small class="field__hint" id="co-aide-${name}">${hint}</small>` : ''}<small class="field__err" id="co-err-${name}" data-err="${name}"></small></label>`;

const VIEWS = {
  panier() {
    const t = cart.totals();
    if (!t.lines.length)
      return `<div class="co-empty"><p class="co-empty__title" tabindex="-1">Votre panier est vide.</p><p>${site.majeur ? 'Les sirops et les spiritueux de la maison vous attendent dans la boutique.' : 'PAC Citron, Fun Blue et une trentaine de sirops vous attendent dans la boutique.'}</p><a class="btn btn--primary" href="/boutique">Voir la boutique</a></div>`;
    const stop = blocked(t);
    return `<ul class="co-lines">${t.lines.map((l) => lineHTML(l, true)).join('')}</ul>
      <div class="co-sum">${totalsHTML(t)}${donHTML(t.lines)}${t.alcohol ? `<p class="evin">${esc(EVIN)} ${esc(MINEURS)}</p>` : ''}</div>
      ${stockMsg ? `<p class="form-msg is-error co-stop" role="alert">${esc(stockMsg)}</p>` : ''}
      ${stop.length ? `<p class="form-msg is-error co-stop" role="alert">${stop.length > 1 ? `${stop.length} articles ne sont plus disponibles` : `${esc(stop[0].product.nom)} n’est plus disponible`}${NB}: retirez-${stop.length > 1 ? 'les' : 'le'} du panier pour commander.</p>` : ''}
      <div class="co-actions"><a class="btn btn--ghost" href="/boutique">Continuer mes achats</a><button type="button" class="btn btn--primary" data-next${stop.length ? ' disabled' : ''}>Commander</button></div>`;
  },
  coordonnees() {
    const c = order.coord || {};
    const alcohol = cart.totals().alcohol;
    return `<form class="co-form" id="co-form" novalidate>
      ${NOTE_OBLIGATOIRES}
      <div class="form-row">${field('prenom', 'Prénom', c.prenom, 'autocomplete="given-name" required')}${field('nom', 'Nom', c.nom, 'autocomplete="family-name" required')}</div>
      <div class="form-row">${field('email', 'E-mail', c.email, 'type="email" autocomplete="email" required inputmode="email"')}${field('tel', 'Téléphone', c.tel, 'type="tel" autocomplete="tel" required inputmode="tel"', 'Pour vous prévenir quand la commande est prête.')}</div>
      ${
        alcohol
          ? `<div class="co-age"><label class="check"><input type="checkbox" name="majeur" value="1"${c.majeur ? ' checked' : ''} required aria-describedby="co-err-majeur" /><span><strong>J’ai 18 ans ou plus.</strong>${etoile} Votre panier contient de l’alcool\u00a0: la vente d’alcool est interdite aux mineurs de moins de 18 ans.</span></label><small class="field__err" id="co-err-majeur" data-err="majeur"></small><p class="evin">${esc(EVIN)}</p></div>`
          : ''
      }
      <label class="check co-news"><input type="checkbox" name="newsletter" value="1"${c.newsletter ? ' checked' : ''} /><span>Je souhaite recevoir la lettre de la distillerie (facultatif).</span></label>
      <p class="form-msg" role="alert" id="co-msg"></p>
      <div class="co-actions"><button type="button" class="btn btn--ghost" data-prev>Retour au panier</button><button type="submit" class="btn btn--primary">Continuer</button></div>
    </form>`;
  },
  livraison() {
    const l = order.livraison || {};
    const r = order.retrait || {};
    const tr = order.transport || 'colissimo';
    const transport = (mode) => {
      const o = option(mode);
      const off = o && o.disponible === false;
      return `<label class="mode mode--sub${off ? ' is-off' : ''}">
        <input type="radio" name="transport" value="${mode}"${tr === mode ? ' checked' : ''}${off ? ' disabled' : ''} />
        <span class="mode__card">${TRANSPORTS[mode].icon}<span><strong>${TRANSPORTS[mode].label}</strong><span data-delai="${mode}">${esc(o?.delai || (mode === 'relais' ? 'Livraison dans le point relais de votre choix, près de chez vous' : 'Livraison à l’adresse indiquée'))}</span>${off && o.raison ? `<span class="mode__off">${esc(o.raison)}</span>` : ''}</span><b class="mode__price" data-prix="${mode}">${o ? (o.prixTTC ? euro(o.prixTTC) : 'Offerte') : '…'}</b></span>
      </label>`;
    };
    return `<form class="co-form" id="co-form" novalidate>
      ${NOTE_OBLIGATOIRES}
      <fieldset class="modes" id="modes" aria-describedby="co-err-mode">
        <legend class="sr-only">Mode de remise (obligatoire)</legend>
        <label class="mode">
          <input type="radio" name="mode" value="retrait"${order.mode === 'retrait' ? ' checked' : ''} required />
          <span class="mode__card">${icons.store}<span><strong>Retrait à la distillerie</strong><span>${esc(infos.adresseLigne)}</span><span>Horaires de retrait\u00a0: ${esc(infos.retrait)}, du lundi au samedi</span></span><b class="mode__price">Gratuit</b></span>
        </label>
        <label class="mode">
          <input type="radio" name="mode" value="livraison"${order.mode === 'livraison' ? ' checked' : ''} />
          <span class="mode__card">${icons.truck}<span><strong>Livraison en France métropolitaine</strong><span>Colissimo, à domicile ou en point relais. Expédiée sous 3 jours ouvrés au plus après le règlement.</span><span id="co-franco" class="co-franco"></span></span><b class="mode__price" id="co-des"></b></span>
        </label>
        <small class="field__err" id="co-err-mode" data-err="mode"></small>
      </fieldset>
      <div class="co-sub" data-for="retrait" ${order.mode === 'retrait' ? '' : 'hidden'}>
        ${field('date', 'Jour de retrait', r.date || premierJourRetrait(), `type="date" min="${tomorrow()}" max="${maxRetrait()}" required`, `Du lundi au samedi, dans les 30 prochains jours (horaires de retrait${NB}: ${esc(infos.retrait)}).`)}
      </div>
      <div class="co-sub" data-for="livraison" ${order.mode === 'livraison' ? '' : 'hidden'}>
        <fieldset class="modes modes--sub" aria-describedby="co-err-transport">
          <legend class="co-sub__legend">Transporteur${etoile}</legend>
          ${transport('colissimo')}
          ${transport('relais')}
          <small class="field__err" id="co-err-transport" data-err="transport"></small>
        </fieldset>
        <p class="co-quote-err" id="co-quote-err" role="alert" hidden></p>
        <p class="co-sub__note" data-relais ${tr === 'relais' ? '' : 'hidden'}>Point relais${NB}: dans la démonstration, le colis part vers le point relais le plus proche de l’adresse ci-dessous${NNB}; sur le site en ligne, vous le choisirez sur une carte.</p>
        ${field('adresse', 'Adresse', l.adresse, 'autocomplete="address-line1" required')}
        ${field('complement', 'Complément (facultatif)', l.complement, 'autocomplete="address-line2"')}
        <div class="form-row">${field('cp', 'Code postal', l.cp, 'autocomplete="postal-code" inputmode="numeric" maxlength="5" required')}${field('ville', 'Ville', l.ville, 'autocomplete="address-level2" required')}</div>
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
        <div class="co-card co-card--flat"><h2 class="co-card__title">${order.mode === 'retrait' ? 'Retrait' : 'Livraison'}</h2>${modeSummary()}<button type="button" class="link" data-goto="livraison">Modifier</button></div>
      </div>
      ${promoHTML()}
      <div id="co-totals">${totalsFull(t)}</div>
      ${donHTML(t.lines)}
      ${t.unpriced ? `<p class="co-note">${plural(t.unpriced, 'article n’a', 'articles n’ont')} pas de prix affiché en ligne\u00a0: la distillerie vous confirme le montant avant de préparer la commande.</p>` : ''}
      ${order.mode === 'livraison' ? '<p class="co-note">Livraison en France métropolitaine. Les frais de livraison suivent le barème de démonstration et sont offerts dès 120,00\u00a0€ d’articles.</p>' : ''}
      <p class="co-note">Droit de rétractation\u00a0: quatorze jours francs à compter de la réception, pour des articles intacts et non ouverts. Colis endommagé\u00a0: le refuser ou l’indiquer sur le récépissé\u202f; la distillerie réexpédie ou rembourse.</p>
      <div class="co-actions"><button type="button" class="btn btn--ghost" data-prev>Retour</button><button type="button" class="btn btn--primary" data-next>Passer au paiement</button></div>
    </div>`;
  },
  paiement() {
    const t = cart.totals();
    const pay = order.paiement || 'carte';
    return `<form class="co-form" id="co-form" novalidate>
      ${t.alcohol ? `<div class="co-mineurs" role="note"><strong>Vente interdite aux mineurs</strong><span>Votre commande contient de l’alcool\u00a0: la vente d’alcool est interdite aux mineurs de moins de 18 ans.</span><span class="evin">${esc(EVIN)}</span></div>` : ''}
      <div class="co-sim">
        <p class="co-sim__badge">Paiement simulé</p>
        <p>Démonstration${NB}: aucun paiement n’est demandé. Sur le site en ligne, cette étape ouvrira le paiement sécurisé.</p>
      </div>
      <fieldset class="modes">
        <legend class="sr-only">Moyen de paiement</legend>
        <label class="mode"><input type="radio" name="paiement" value="carte"${pay === 'carte' ? ' checked' : ''} /><span class="mode__card">${icons.card}<span><strong>Carte bancaire</strong><span>CB, Visa, Mastercard (simulation)</span></span></span></label>
        <label class="mode"><input type="radio" name="paiement" value="paypal"${pay === 'paypal' ? ' checked' : ''} /><span class="mode__card">${icons.card}<span><strong>PayPal</strong><span>Simulation</span></span></span></label>
        <label class="mode"><input type="radio" name="paiement" value="virement"${pay === 'virement' ? ' checked' : ''} /><span class="mode__card">${icons.card}<span><strong>Virement bancaire</strong><span>Simulation\u00a0: les coordonnées bancaires seraient envoyées par e-mail\u202f; la commande est préparée à réception du virement</span></span></span></label>
      </fieldset>
      <div class="co-cgv"><label class="check"><input type="checkbox" name="cgv" required aria-describedby="co-err-cgv" /><span>J’ai lu et j’accepte les <a class="link" href="/conditions-de-vente" target="_blank" rel="noopener">conditions générales de vente<span class="sr-only"> (nouvel onglet)</span></a>.${etoile}</span></label><small class="field__err" id="co-err-cgv" data-err="cgv"></small></div>
      <p class="form-msg" role="alert" id="co-msg"></p>
      <div class="co-actions"><button type="button" class="btn btn--ghost" data-prev>Retour</button><button type="submit" class="btn btn--primary" id="pay">${payLabel()}</button></div>
    </form>`;
  },
  confirmation() {
    const d = order.done;
    if (!d) return VIEWS.panier();
    const statut = d.paiement?.statut;
    const pay = `${esc(PAIEMENTS[d.paiement?.mode] || 'Carte bancaire')} · ${statut === 'en-attente' ? 'en attente du virement' : statut === 'paye' || !statut ? 'accepté' : esc(statut)} (simulation)${d.paiement?.reference ? ` · référence ${esc(d.paiement.reference)}` : ''}`;
    const don = d.don?.montant ? d.don : null;
    // Commande avec alcool : cadre maison (jamais l'univers PAC à côté d'un spiritueux).
    return `<div class="co-done${d.alcohol ? ' co-done--maison' : ''}">
      <p class="co-done__seal" aria-hidden="true">${icons.check}</p>
      <p class="co-done__lead">Merci ${esc(d.prenom)}${NNB}! Votre commande <strong class="co-nowrap">${esc(d.numero)}</strong> est enregistrée.</p>
      <dl class="co-done__recap">
        <div><dt>Montant</dt><dd>${euro(d.totalTTC)}${d.remise ? ` <small>(code ${esc(d.code)}\u00a0: −${euro(d.remise)})</small>` : ''}</dd></div>
        <div><dt>Paiement</dt><dd>${pay}</dd></div>
        <div><dt>${d.mode === 'retrait' ? 'Retrait' : 'Livraison'}</dt><dd>${d.mode === 'retrait' ? `À la distillerie${d.date ? `, ${esc(frDate(d.date))}` : ''} · gratuit` : `${esc(TRANSPORTS[d.transport]?.label || 'Livraison')} · ${d.livraison ? euro(d.livraison) : 'offerte'}`}</dd></div>
      </dl>
      <p>${
        d.mode === 'retrait'
          ? `Vous la retirerez à la distillerie, ${esc(infos.adresseLigne)}, ${esc(infos.retrait)}, du lundi au samedi${d.date ? ` (jour souhaité\u00a0: ${esc(frDate(d.date))})` : ''}.`
          : statut === 'en-attente'
            ? 'Elle sera expédiée sous 3 jours ouvrés au plus après la réception du virement, à l’adresse indiquée.'
            : 'Elle sera expédiée sous 3 jours ouvrés au plus, à l’adresse indiquée.'
      }</p>
      ${don ? `<p class="op-cart">${ruban('rose', 'op-cart__ruban')}<span>Grâce à votre commande, <strong>${eurosOp(don.montant)}</strong> ${don.montant >= 2 ? 'seront reversés' : 'sera reversé'} ${esc(don.beneficiaire)} dans le cadre ${/^[aeiouyhâàéèêëîïôûüœ]/i.test(don.nom || '') ? 'd’' : 'de '}${esc(don.nom)}.</span></p>` : ''}
      <p class="co-sim"><span class="co-sim__badge">Démonstration</span> La commande est enregistrée dans un espace de démonstration privé, visible seulement depuis ce navigateur${NNB}; rien n’a été payé ni transmis à la distillerie. L’e-mail de confirmation adressé à ${esc(d.email)} est déposé dans les courriels envoyés du CRM de démonstration.</p>
      <div class="co-actions">${d.crm ? `<a class="btn btn--primary" href="${esc(d.crm)}">Voir la commande dans le CRM (démo)</a>` : ''}<a class="btn btn--ghost" href="/boutique">Retour à la boutique</a><a class="btn btn--ghost" href="/visiter">Préparer une visite</a></div>
    </div>`;
  },
};

const payLabel = () => `Payer ${euro(montants().total)} (simulation)`;

function promoHTML() {
  if (order.promo)
    return `<div class="co-promo co-promo--on"><p>${icons.check}<span>Code <strong>${esc(order.promo.code)}</strong> appliqué${order.promo.libelle && order.promo.libelle !== order.promo.code ? ` · ${esc(order.promo.libelle)}` : ''}</span></p><button type="button" class="link" data-promo-off>Retirer le code</button></div>`;
  return `<form class="co-promo" id="co-promo" novalidate>
    <label class="field"><span>Code promo</span>
      <span class="co-promo__row"><input name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="30" placeholder="Ex. BIENVENUE10" aria-describedby="co-err-code" /><button type="submit" class="btn btn--ghost">Appliquer</button></span>
      <small class="field__err" id="co-err-code" data-err="code"></small>
    </label>
  </form>`;
}

// Erreurs d'une étape : une par champ, sous le champ, et un résumé (src/lib/formulaire.js).
function showErrors(form, bad) {
  erreursParChamp(form, new Map(bad), { resume: $('#co-msg', form) });
}

function render(focus = false) {
  const meta = STEPS.find((s) => s.id === step);
  // Panier : le focus d'un bouton « + », « − » ou « Supprimer » est retrouvé après le rendu (même
  // ligne, ou la ligne suivante si celle-ci a disparu), jamais perdu (A11Y-6).
  const main = $('#co-main');
  const actif = !focus && main.contains(document.activeElement) ? document.activeElement : null;
  const ligne = actif?.closest('.co-line');
  const lignes = $$('.co-line', main);
  const repere = ligne ? { slug: ligne.dataset.slug, v: ligne.dataset.v, sel: actif.matches('[data-del]') ? '[data-del]' : `[data-q="${actif.dataset.q || '-1'}"]`, rang: lignes.indexOf(ligne) } : null;
  $('#co-title').textContent = meta.title;
  document.title = `${meta.title} · Distillerie A. Blachère`;
  $('#steps').innerHTML = stepsHTML();
  $('#steps').hidden = step === 'panier' && !cart.items.length;
  main.innerHTML = VIEWS[step]();
  $('#co-side').innerHTML = step === 'panier' || step === 'confirmation' ? '' : sideHTML();
  $('#co-side').hidden = step === 'panier' || step === 'confirmation';
  document.body.dataset.step = step;
  bindStep();
  upgradeThumbs(main);
  if (step === 'panier') affinerLivraison(main);
  if (repere) {
    const nouvelles = $$('.co-line', main);
    const meme = nouvelles.find((li) => li.dataset.slug === repere.slug && li.dataset.v === repere.v);
    const voisine = nouvelles[Math.min(Math.max(repere.rang, 0), nouvelles.length - 1)];
    const cible = meme ? $(repere.sel, meme) : voisine ? $(repere.sel, voisine) : $('.co-empty__title', main);
    cible?.focus();
    if (meme) annonce(`Quantité de ${meme.querySelector('.co-line__name')?.textContent || 'l’article'}\u00a0: ${$('output', meme)?.textContent || ''}.`);
    else annonce(nouvelles.length ? 'Article retiré du panier.' : 'Votre panier est vide.');
  }
  if (focus) {
    main.focus({ preventScroll: true });
    scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// Message lu par les lecteurs d'écran (quantité changée, article retiré).
function annonce(texte) {
  let el = $('#co-annonce');
  if (!el) {
    el = document.createElement('p');
    el.id = 'co-annonce';
    el.className = 'sr-only';
    el.setAttribute('role', 'status');
    $('#contenu').append(el);
  }
  el.textContent = '';
  requestAnimationFrame(() => (el.textContent = texte));
}

// Totaux et libellé du paiement mis à jour sans reconstruire l'étape (le focus reste).
function refreshTotals() {
  const box = $('#co-totals');
  if (box) box.innerHTML = totalsFull(cart.totals());
  const pay = $('#pay');
  if (pay && !pay.disabled) pay.textContent = payLabel();
  $('#co-side').innerHTML = step === 'panier' || step === 'confirmation' ? '' : sideHTML();
}

function go(next, { push = true } = {}) {
  const k = STEPS.findIndex((s) => s.id === next);
  const block = firstIncomplete();
  if (next !== 'panier' && next !== 'confirmation' && block) {
    const kb = STEPS.findIndex((s) => s.id === block);
    if (kb < k) next = block;
  }
  if (next === 'confirmation' && !order.done) next = block || 'paiement';
  if (next !== 'panier' && next !== 'confirmation' && blocked().length) next = 'panier';
  step = next;
  const url = step === 'panier' ? '/panier' : `/panier?etape=${step}`;
  if (push) history.pushState({ step }, '', url);
  else history.replaceState({ step }, '', url);
  render(true);
  // Récapitulatif et paiement : frais de livraison et code promo à jour (serveur).
  if ((step === 'recapitulatif' || step === 'paiement') && order.mode === 'livraison' && !quoteFresh()) quote().then(refreshTotals, () => refreshTotals());
  if (step === 'recapitulatif' || step === 'paiement') refreshPromo().then(refreshTotals);
}

// Étape « retrait ou livraison » : prix des deux transporteurs, franco, disponibilité (outre-mer).
function fillQuote(form) {
  const err = $('#co-quote-err', form);
  quote(form.elements.cp?.value)
    .then((q) => {
      if (!form.isConnected) return;
      err.hidden = true;
      for (const mode of Object.keys(TRANSPORTS)) {
        const o = q.options.find((x) => x.mode === mode);
        const input = form.querySelector(`input[name="transport"][value="${mode}"]`);
        if (!o || !input) continue;
        const card = input.closest('.mode');
        $(`[data-prix="${mode}"]`, form).textContent = o.prixTTC ? euro(o.prixTTC) : 'Offerte';
        if (o.delai) $(`[data-delai="${mode}"]`, form).textContent = o.delai;
        input.disabled = o.disponible === false;
        card.classList.toggle('is-off', o.disponible === false);
        let off = $('.mode__off', card);
        if (o.disponible === false && o.raison) {
          if (!off) {
            off = document.createElement('span');
            off.className = 'mode__off';
            $('.mode__card > span', card).append(off);
          }
          off.textContent = o.raison;
        } else off?.remove();
      }
      const prices = q.options.filter((o) => o.mode !== 'retrait' && o.disponible !== false).map((o) => o.prixTTC);
      const des = $('#co-des', form);
      if (des) des.textContent = prices.length ? (Math.min(...prices) ? `dès ${euro(Math.min(...prices))}` : 'Offerte') : '';
      const franco = $('#co-franco', form);
      if (franco) franco.textContent = q.francoRestantTTC > 0 ? `Livraison offerte dès 120,00${NB}€ d’articles${NB}: plus que ${euro(q.francoRestantTTC)}.` : 'Livraison offerte pour ce panier.';
      $('#co-side').innerHTML = sideHTML();
    })
    .catch((e) => {
      if (!form.isConnected) return;
      err.hidden = false;
      err.textContent = `Les frais de livraison n’ont pas pu être calculés${NB}: ${e?.message || 'réessayez dans un instant.'}`;
      $$('[data-prix]', form).forEach((el) => (el.textContent = ''));
    });
}

function bindStep() {
  const main = $('#co-main');
  $$('[data-next]', main).forEach((b) => b.addEventListener('click', () => go(STEPS[STEPS.findIndex((s) => s.id === step) + 1].id)));
  $$('[data-prev]', main).forEach((b) => b.addEventListener('click', () => go(STEPS[STEPS.findIndex((s) => s.id === step) - 1].id)));
  $$('[data-goto]', main).forEach((b) => b.addEventListener('click', () => go(b.dataset.goto)));
  if (step === 'recapitulatif') bindPromo(main);
  const form = $('#co-form', main);
  if (!form) return;
  if (step === 'coordonnees') {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const c = { prenom: fd.get('prenom') || '', nom: fd.get('nom') || '', email: fd.get('email') || '', tel: fd.get('tel') || '', majeur: fd.get('majeur') === '1', newsletter: fd.get('newsletter') === '1' };
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
      const tr = form.elements.transport.value || 'colissimo';
      $('[data-relais]', form).hidden = tr !== 'relais';
    };
    // Le récapitulatif suit les choix : mode, transporteur, code postal (frais du serveur).
    const remember = () => {
      const fd = new FormData(form);
      order.mode = fd.get('mode') || order.mode || null;
      order.transport = fd.get('transport') || order.transport || 'colissimo';
      order.retrait = { date: fd.get('date') || '' };
      order.livraison = { adresse: fd.get('adresse') || '', complement: fd.get('complement') || '', cp: fd.get('cp') || '', ville: fd.get('ville') || '' };
      save();
    };
    form.addEventListener('change', (e) => {
      sync();
      remember();
      if (e.target.name === 'mode' || e.target.name === 'transport') fillQuote(form);
      $('#co-side').innerHTML = sideHTML();
    });
    if (!order.transport) order.transport = 'colissimo';
    fillQuote(form);
    let cpTimer;
    form.elements.cp.addEventListener('input', () => {
      clearTimeout(cpTimer);
      if (isCP(form.elements.cp.value))
        cpTimer = setTimeout(() => {
          order.livraison = { ...(order.livraison || {}), cp: form.elements.cp.value };
          save();
          fillQuote(form);
        }, 250);
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      order.mode = fd.get('mode') || null;
      order.transport = fd.get('transport') || order.transport || 'colissimo';
      order.retrait = { date: fd.get('date') || '' };
      order.livraison = { adresse: fd.get('adresse') || '', complement: fd.get('complement') || '', cp: fd.get('cp') || '', ville: fd.get('ville') || '' };
      if (!['carte', 'paypal', 'virement'].includes(order.paiement)) order.paiement = 'carte';
      save();
      const bad = checkMode();
      const o = option(order.transport);
      if (order.mode === 'livraison' && o && o.disponible === false) bad.push(['cp', o.raison || 'Livraison impossible à cette adresse\u00a0: choisissez le retrait à la distillerie.']);
      showErrors(form, bad);
      if (!bad.length) go('recapitulatif');
    });
  }
  if (step === 'paiement') {
    form.addEventListener('change', () => {
      order.paiement = form.elements.paiement.value;
      save();
    });
    form.addEventListener('submit', submitOrder);
  }
}

function bindPromo(main) {
  $('[data-promo-off]', main)?.addEventListener('click', () => {
    delete order.promo;
    save();
    render();
    $('#co-promo input')?.focus();
  });
  const f = $('#co-promo', main);
  if (!f) return;
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = f.elements.code;
    const code = input.value.trim().toUpperCase();
    const err = $('[data-err="code"]', f);
    if (!code) {
      err.textContent = 'Saisissez un code promo.';
      return input.focus();
    }
    const btn = $('button', f);
    btn.disabled = true;
    btn.textContent = 'Vérification…';
    try {
      await checkPromo(code);
      if (order.promo.livraisonOfferte && order.mode === 'livraison' && !quoteFresh()) await quote().catch(() => {});
      render();
      site.toast(`Code ${order.promo.code} appliqué`);
      $('[data-promo-off]')?.focus();
    } catch (x) {
      btn.disabled = false;
      btn.textContent = 'Appliquer';
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
      err.textContent = x?.message || 'Ce code promo n’est pas valable.';
      input.focus();
    }
  });
}

// Champ signalé par le serveur → étape et champ du formulaire.
const CHAMPS = {
  prenom: ['coordonnees', 'prenom'],
  nom: ['coordonnees', 'nom'],
  email: ['coordonnees', 'email'],
  telephone: ['coordonnees', 'tel'],
  ageConfirme: ['coordonnees', 'majeur'],
  adresse: ['livraison', 'adresse'],
  ligne1: ['livraison', 'adresse'],
  ligne2: ['livraison', 'complement'],
  cp: ['livraison', 'cp'],
  ville: ['livraison', 'ville'],
  jourRetrait: ['livraison', 'date'],
  mode: ['livraison', 'mode'],
  code: ['recapitulatif', 'code'],
  cgv: ['paiement', 'cgv'],
};

async function submitOrder(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const block = firstIncomplete();
  if (block) return go(block);
  // Conditions générales de vente acceptées (et majorité certifiée si la commande contient de l'alcool)
  if (!form.elements.cgv?.checked) {
    erreursParChamp(form, { cgv: 'Cochez cette case pour accepter les conditions générales de vente.' });
    const msg = $('#co-msg', form);
    if (msg) msg.textContent = 'Merci de lire et d’accepter les conditions générales de vente.';
    return;
  }
  erreursParChamp(form, {}, { focus: false });
  const t = cart.totals();
  const btn = $('#pay');
  btn.disabled = true;
  btn.textContent = 'Paiement en cours (simulation)…';
  $('#co-msg', form).textContent = '';
  const c = order.coord;
  const l = order.livraison || {};
  const livraison =
    order.mode === 'retrait'
      ? { mode: 'retrait', jourRetrait: order.retrait?.date || undefined }
      : { mode: order.transport || 'colissimo', adresse: { ligne1: l.adresse.trim(), ligne2: l.complement?.trim() || undefined, cp: l.cp.trim(), ville: l.ville.trim(), pays: 'France' } };
  let r;
  try {
    r = await api('site', 'commande', {
      method: 'POST',
      body: {
        client: { prenom: c.prenom.trim(), nom: c.nom.trim(), email: c.email.trim(), telephone: c.tel.trim() },
        livraison,
        paiement: { mode: order.paiement || 'carte' },
        lignes: apiLines(),
        code: order.promo?.code || undefined,
        // Majorité établie par la porte d'âge du site et certifiée par la case « J'ai 18 ans ou plus ».
        ageConfirme: t.alcohol ? site.majeur && !!c.majeur : false,
        newsletter: !!c.newsletter,
        cgv: true,
      },
    });
  } catch (x) {
    btn.disabled = false;
    btn.textContent = payLabel();
    return orderError(form, x);
  }
  const m = montants(t);
  // Don de l'opération du moment : la valeur du serveur (commande enregistrée) fait foi.
  const opServeur = r?.operation?.montant ? r.operation : null;
  const opRef = OPERATIONS.find((o) => o.id === (opServeur?.id || operation?.id)) || operation;
  const don = opServeur
    ? { montant: opServeur.montant, bouteilles: opServeur.bouteilles, nom: opServeur.nom, beneficiaire: opRef?.beneficiaireAvecArticle || `à ${opServeur.beneficiaire}` }
    : operation
      ? { ...donPour(operation, t.lines), nom: operation.nom, beneficiaire: operation.beneficiaireAvecArticle }
      : null;
  order.done = {
    numero: r?.numero || '—',
    prenom: c.prenom,
    email: c.email,
    mode: order.mode,
    transport: order.transport,
    date: order.retrait?.date || '',
    totalTTC: r?.totalTTC ?? m.total,
    livraison: r?.livraison?.prixTTC ?? m.livraison,
    remise: r?.totaux?.remiseTTC ?? m.remise,
    code: order.promo?.code || '',
    paiement: r?.paiement || { mode: order.paiement || 'carte' },
    crm: r?.liens?.crm || null,
    alcohol: t.alcohol,
    don,
  };
  delete order.promo;
  delete order.devisLivraison;
  save();
  cart.clear();
  go('confirmation');
  mountDemoBar({ toast: site.toast });
}

// Erreur de la commande : stock (retour au panier), saisie (étape et champ concernés), autre.
function orderError(form, x) {
  const msg = $('#co-msg', form);
  if (x?.code === 'stock' || x?.status === 409) {
    // Les stocks ont changé : prix et états de la démo relus, retour au panier avec le message.
    stockMsg = x.message || 'Un article n’est plus disponible en quantité suffisante\u00a0: ajustez le panier.';
    go('panier');
    loadDemoPrices({ force: true });
    return;
  }
  const champ = String(x?.champ || '').split('.').pop();
  const target = CHAMPS[champ];
  if (target && target[0] !== 'paiement') {
    go(target[0]);
    const f = $('#co-form') || $('#co-promo');
    if (f) {
      showErrors(f, [[target[1], x.message]]);
      const m = $('#co-msg', f);
      if (m) m.textContent = x.message;
    }
    return;
  }
  if (msg) msg.textContent = x?.message || 'La commande n’a pas pu être enregistrée. Réessayez.';
  (form.elements[target?.[1]] || msg)?.focus?.();
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

let lastItems = JSON.stringify(cart.items);
cart.subscribe(() => {
  // Le message de stock disparaît dès que le panier change.
  const now = JSON.stringify(cart.items);
  if (now !== lastItems) stockMsg = '';
  lastItems = now;
  if (step === 'panier') render();
  else if (!cart.items.length && step !== 'confirmation') go('panier', { push: false });
  else if (step !== 'confirmation') $('#co-side').innerHTML = sideHTML();
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
// Démo existante : prix et stocks de la démo (le panier se redessine quand ils arrivent).
loadDemoPrices();
