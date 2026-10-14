import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { products, timeline, infos, EVIN, MINEURS } from './data/products.js';
import { icons } from './lib/icons.js';
import { readAge, saveAge, resetAge, ageFrom } from './lib/age.js';
import { bottleSVG } from './lib/bottleSvg.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const euro = (n) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const priceValue = (p) => (p.price ? parseFloat(p.price.replace(',', '.')) : null);

let scene = null; // scène 3D (null sans WebGL)
let age = readAge(); // 'majeur' | 'mineur' | 'sirops' | null
let list = []; // produits affichés (indices dans products)
let active = 0; // produit actif (indice dans products)
let snaps = {}; // id → rendu 3D pour la boutique
const cart = new Map(); // id → quantité
const story = { p: 0, step: -1 };
let lenis = null;

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
scrollTo(0, 0);

const visibleList = () => products.map((_, i) => i).filter((i) => !products[i].alcool || age === 'majeur');
const position = () => Math.max(0, list.indexOf(active));
const firstOf = (alcool) => list.find((i) => products[i].alcool === alcool);
const evinHTML = (extra = '') => `${EVIN}${extra ? ` ${extra}` : ''}`;

// ---------- Rendu (dépend de l'âge : les spiritueux n'existent dans la page qu'après vérification) ----------
function renderSelector() {
  const n = list.length;
  const at = (k) => (n > 1 ? (k / (n - 1)) * 100 : 50);
  $('#selector-track').style.background = `linear-gradient(90deg, ${list.map((i) => products[i].color).join(', ')})`;
  $$('.selector__dot').forEach((d) => d.remove());
  list.forEach((i, k) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'selector__dot';
    dot.style.left = `${at(k)}%`;
    dot.setAttribute('aria-label', products[i].fullName);
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      setProduct(i, 'selector');
    });
    $('#selector').insertBefore(dot, $('#selector-knob'));
  });
  // Étiquettes de groupe sous la frise : Sirops / Spiritueux 18+
  const groups = [
    ['Sirops', list.filter((i) => !products[i].alcool)],
    ['Spiritueux · 18+', list.filter((i) => products[i].alcool)],
  ].filter(([, g]) => g.length);
  $('#selector-groups').innerHTML = groups
    .map(([label, g]) => {
      const a = at(list.indexOf(g[0]));
      const b = at(list.indexOf(g[g.length - 1]));
      return `<span style="left:${(a + b) / 2}%">${label}</span>`;
    })
    .join('');
  document.documentElement.style.setProperty('--rainbow', `linear-gradient(90deg, ${list.map((i) => products[i].color).join(', ')})`);

  $('#chips').innerHTML = list
    .map((i) => `<button type="button" class="chip" data-i="${i}" style="--c:${products[i].color}" aria-pressed="false"><i></i>${esc(products[i].fullName.replace('Marc de Châteauneuf-du-Pape', 'Marc de CdP'))}</button>`)
    .join('');
  $$('.chip').forEach((b) => b.addEventListener('click', () => setProduct(Number(b.dataset.i), 'chip')));
}

function renderTimeline() {
  const items = timeline.filter((t) => !t.alcool || age === 'majeur');
  $('#timeline').innerHTML = items
    .map(
      (t) => `<li class="year${t.alcool ? ' year--alcool' : ''}${t.year === '2035' ? ' year--future' : ''}">
        <span class="year__n">${t.year}</span>
        <h3>${esc(t.title)}</h3>
        <p>${esc(t.text)}</p>
      </li>`,
    )
    .join('');
  const ev = $('#history-evin');
  ev.hidden = age !== 'majeur';
  ev.textContent = EVIN;
}

function renderUniverses() {
  const el = $('#uni-spiritueux');
  if (age === 'majeur') {
    el.innerHTML = `
      <p class="uni__tag">Réservé aux majeurs · 18+</p>
      <h3 class="uni__title">Les spiritueux</h3>
      <p class="uni__text">Pastis, liqueurs régionales, marcs et eaux-de-vie de la distillerie.</p>
      <ul class="uni__list">
        <li><strong>Pastis</strong>Pastis Marra (40 plantes et épices, depuis 1955), Le Camarguais</li>
        <li><strong>Liqueurs</strong>La Magistrale, La Comtadine, La Camarguaise, Élixir du Mont Ventoux, Origan du Comtat</li>
        <li><strong>Marcs et eaux-de-vie</strong>Marc de Provence, Marc de Châteauneuf-du-Pape, eaux-de-vie de fruits</li>
      </ul>
      <p class="evin">${EVIN}</p>
      <button type="button" class="btn btn--light" data-goto-univers="spiritueux">Voir les spiritueux</button>`;
  } else if (age === 'mineur') {
    el.innerHTML = `
      <span class="uni__lock">${icons.lock}</span>
      <p class="uni__tag">18+</p>
      <h3 class="uni__title">Les spiritueux</h3>
      <p class="uni__text">Cette partie du site est réservée aux personnes majeures.</p>`;
  } else {
    el.innerHTML = `
      <span class="uni__lock">${icons.lock}</span>
      <p class="uni__tag">18+</p>
      <h3 class="uni__title">Les spiritueux</h3>
      <p class="uni__text">Cette partie du site est réservée aux personnes majeures. Indiquez votre date de naissance pour y accéder.</p>
      <button type="button" class="btn btn--light" data-goto-univers="spiritueux">Vérifier mon âge</button>`;
  }
  $$('[data-goto-univers]').forEach((b) => (b.onclick = () => gotoUnivers(b.dataset.gotoUnivers)));
}

function mediaHTML(p) {
  return snaps[p.id] ? `<img src="${snaps[p.id]}" alt="Bouteille ${esc(p.fullName)}" width="480" height="600" loading="lazy" />` : bottleSVG(p);
}

function renderShop() {
  $('#shop-grid').innerHTML = list
    .map((i) => {
      const p = products[i];
      const price = p.price
        ? `<span class="product__price"><strong>${p.price}</strong><small>${p.priceNote} · ${p.format}</small></span>`
        : `<span class="product__price product__price--none"><strong>Prix à compléter</strong></span>`;
      return `<article class="product" data-id="${p.id}" style="--c:${p.color};--d:${p.deep}">
        <div class="product__media">
          <span class="product__badge">${p.alcool ? `${esc(p.univers)} · 18+` : `Sirop · ${p.format}`}</span>
          ${mediaHTML(p)}
        </div>
        <div class="product__body">
          <h3 class="product__name">${esc(p.fullName)}</h3>
          <p class="product__kind">${esc(p.kind)}${p.alcool && p.format ? ` · ${esc(p.format)}` : ''}</p>
          <div class="product__row">
            ${price}
            <button type="button" class="btn btn--accent" data-add="${p.id}" aria-label="Ajouter ${esc(p.fullName)} au panier">Ajouter</button>
          </div>
        </div>
        ${p.alcool ? `<p class="evin">${EVIN}</p>` : ''}
      </article>`;
    })
    .join('');
  $$('[data-add]').forEach((b) => b.addEventListener('click', () => addToCart(b.dataset.add)));
  $('#shop-note').innerHTML =
    `<span>Prix TTC. Le paiement en ligne n’est pas branché sur cette maquette.</span>` +
    (age === 'majeur' ? `<span class="evin">${evinHTML(MINEURS)}</span>` : '');
}

function renderPro() {
  const options = ['PAC Citron', 'Fun Blue', 'Gamme de sirops'];
  if (age === 'majeur') options.push('Pastis', 'Liqueurs', 'Marcs et eaux-de-vie');
  const checked = new Set($$('#pro-gammes input:checked').map((c) => c.value));
  $('#pro-gammes').innerHTML =
    '<legend>Ce qui vous intéresse</legend>' +
    options
      .map((o) => `<label class="pill-check"><input type="checkbox" name="gammes" value="${esc(o)}"${checked.has(o) ? ' checked' : ''} /><span>${esc(o)}</span></label>`)
      .join('');
}

function renderAll() {
  list = visibleList();
  if (!list.includes(active)) active = list[0];
  document.body.classList.toggle('is-majeur', age === 'majeur');
  renderSelector();
  renderTimeline();
  renderUniverses();
  renderShop();
  renderPro();
  $('#footer-evin').hidden = age !== 'majeur';
  $('#footer-evin').textContent = evinHTML(MINEURS);
  $('#hero-evin').textContent = EVIN;
  $('[data-univers="spiritueux"]').innerHTML = age === 'mineur' ? `${icons.lock} Spiritueux <span class="switch__badge">18+</span>` : 'Spiritueux <span class="switch__badge">18+</span>';
  if (age !== 'majeur') for (const id of [...cart.keys()]) if (products.find((p) => p.id === id).alcool) cart.delete(id);
  renderCart();
}

// ---------- Produit actif ----------
function setProduct(i, source = 'ui') {
  if (!list.includes(i)) i = list[0];
  const changed = i !== active;
  active = i;
  const p = products[i];
  const root = document.documentElement.style;
  root.setProperty('--accent', p.color);
  root.setProperty('--accent2', p.color2);
  root.setProperty('--deep', p.deep);
  root.setProperty('--light', p.light);
  $('meta[name="theme-color"]').setAttribute('content', p.deep);

  if (scene) {
    scene.state.target = position();
    scene.setProduct(i, source === 'init');
  } else {
    $('#fallback-bottle').innerHTML = bottleSVG(p, { title: false });
  }
  const big = p.name.join(' ');
  $('#marquee').innerHTML = `<span>${esc(big)}</span>`.repeat(4);
  const n = list.length;
  $('#selector-knob').style.left = `${n > 1 ? (position() / (n - 1)) * 100 : 50}%`;
  $$('.selector__dot').forEach((d, k) => d.setAttribute('aria-pressed', String(k === position())));
  $$('.chip').forEach((c) => c.setAttribute('aria-pressed', String(Number(c.dataset.i) === i)));
  if (changed) $(`.chip[data-i="${i}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
  $$('.switch__btn').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.univers === 'spiritueux') === p.alcool)));

  $('#hero-kicker').innerHTML = `<i></i>${esc(p.alcool ? `${p.univers} · réservé aux majeurs` : 'Sirop · tout public')}`;
  const name = $('#hero-name');
  const html = p.name.map((l) => `<span class="line"><span>${esc(l)}</span></span>`).join('');
  if (!changed || calm || !name.innerHTML) {
    name.innerHTML = html;
  } else {
    gsap.to($$('.line span', name), {
      yPercent: -110,
      duration: 0.3,
      ease: 'power2.in',
      stagger: 0.04,
      onComplete: () => {
        name.innerHTML = html;
        gsap.from($$('.line span', name), { yPercent: 110, duration: 0.6, ease: 'power3.out', stagger: 0.06 });
      },
    });
  }
  $('#hero-tagline').textContent = p.tagline;
  $('#hero-evin').hidden = age !== 'majeur';

  // Gros plan
  $('#story-kind').textContent = `${p.kind}${p.format ? ` · ${p.format}` : ''}`;
  $('#story-name').innerHTML = `<span>${esc(p.name[0])}</span><span>${esc(p.name[1])}</span>`;
  $('#story-desc').textContent = p.description;
  $('#story-notes').innerHTML = p.notes.map((t) => `<li>${esc(t)}</li>`).join('');
  $('#story-evin').hidden = !p.alcool;
  $('#story-evin').textContent = EVIN;
  $('#story-chapters').innerHTML = p.chapters
    .map(
      (c, k) => `<article class="chapter" data-step="${k}">
        <span class="chapter__k">${esc(c.k)}</span>
        <h3 class="display">${c.t.map((l) => `<span>${esc(l)}</span>`).join('')}</h3>
        <p>${esc(c.p)}</p>
        ${p.alcool ? `<p class="evin">${EVIN}</p>` : ''}
      </article>`,
    )
    .join('');
  $('#story-nav').innerHTML = p.chapters
    .map((c, k) => `<button type="button" data-step="${k}" aria-label="${esc(c.t.join(' '))}">0${k + 1}</button>`)
    .join('');
  $$('#story-nav button').forEach((b) => b.addEventListener('click', () => gotoStep(Number(b.dataset.step))));
  story.step = -2; // force la mise à jour des chapitres au prochain scroll
  updateStory();
}

function gotoUnivers(u) {
  if (u === 'spiritueux') {
    if (age === 'majeur') {
      setProduct(firstOf(true), 'univers');
      lenis ? lenis.scrollTo(0) : scrollTo(0, 0);
    } else openGate(age === 'mineur' ? 'no' : 'ask', 'spiritueux');
    return;
  }
  setProduct(firstOf(false), 'univers');
  lenis ? lenis.scrollTo(0) : scrollTo(0, 0);
}

// ---------- Vérification de l'âge ----------
const gate = $('#gate');
let gateThen = null;

function openGate(mode = 'ask', then = null) {
  gateThen = then;
  $('#gate-ask').hidden = mode !== 'ask';
  $('#gate-no').hidden = mode !== 'no';
  $('#gate-err').textContent = '';
  if (!gate.open) gate.showModal();
  document.body.classList.add('age-ouvert');
  lenis?.stop();
  if (mode === 'ask') setTimeout(() => $('[name="jour"]', gate).focus(), 50);
  else $('#gate-no .gate__title').focus();
}
function closeGate() {
  if (gate.open) gate.close();
}
gate.addEventListener('close', () => {
  document.body.classList.remove('age-ouvert');
  lenis?.start();
  // Fermer sans répondre (Échap) = continuer avec les sirops pour cette session.
  if (age === null) {
    age = 'sirops';
    saveAge('sirops');
    applyAge();
  }
});

function applyAge(then = null) {
  renderAll();
  scene?.setList(list, active);
  let target = active;
  if (then === 'spiritueux' && age === 'majeur') target = firstOf(true);
  setProduct(target, 'age');
  ScrollTrigger.refresh();
  makeSnapshots();
}

function bindGate() {
  const form = $('#gate-form');
  const fields = $$('input', form);
  fields.forEach((f, k) =>
    f.addEventListener('input', () => {
      f.value = f.value.replace(/\D/g, '');
      if (k < 2 && f.value.length === 2) fields[k + 1].focus();
    }),
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const years = ageFrom(d.jour, d.mois, d.annee);
    fields.forEach((f) => f.classList.toggle('is-invalid', !f.value));
    if (years === null) {
      $('#gate-err').textContent = 'Cette date n’est pas valide : vérifiez le jour, le mois et l’année (ex. 07 / 03 / 1985).';
      return;
    }
    form.reset();
    if (years < 18) {
      age = 'mineur';
      saveAge('mineur');
      applyAge();
      openGate('no');
      return;
    }
    age = 'majeur';
    saveAge('majeur');
    const then = gateThen;
    closeGate();
    applyAge(then);
  });
  $('#gate-skip').addEventListener('click', () => {
    age = 'sirops';
    saveAge('sirops');
    closeGate();
    applyAge();
  });
  $('#gate-ok').addEventListener('click', () => {
    closeGate();
    gotoUnivers('sirops');
  });
  $('#age-reset').addEventListener('click', () => {
    resetAge();
    age = null;
    applyAge();
    openGate('ask');
  });
}

// ---------- Panier (maquette) ----------
const drawer = $('#cart');
function addToCart(id) {
  const p = products.find((x) => x.id === id);
  if (p.alcool && age !== 'majeur') return;
  cart.set(id, (cart.get(id) || 0) + 1);
  renderCart();
  toast(`${p.fullName} ajouté au panier`);
  const btn = $('#cart-open');
  btn.classList.add('is-bump');
  setTimeout(() => btn.classList.remove('is-bump'), 300);
}
function renderCart() {
  const count = [...cart.values()].reduce((a, b) => a + b, 0);
  $('#cart-count').textContent = count;
  $('#cart-open').setAttribute('aria-label', `Panier, ${count} article${count > 1 ? 's' : ''}`);
  const items = [...cart.entries()].map(([id, q]) => [products.find((p) => p.id === id), q]);
  $('#cart-list').innerHTML = items.length
    ? items
        .map(
          ([p, q]) => `<li class="line-item" style="--d:${p.deep}">
            <span class="line-item__img">${snaps[p.id] ? `<img src="${snaps[p.id]}" alt="" />` : bottleSVG(p, { title: false })}</span>
            <span><strong>${esc(p.fullName)}</strong><small>${p.price ? `${p.price} · ${p.format}` : 'Prix à compléter'}</small></span>
            <span class="line-item__qty">
              <button type="button" data-q="-1" data-id="${p.id}" aria-label="Retirer un ${esc(p.fullName)}">${icons.minus}</button>
              <span aria-label="Quantité">${q}</span>
              <button type="button" data-q="1" data-id="${p.id}" aria-label="Ajouter un ${esc(p.fullName)}">${icons.plus}</button>
            </span>
          </li>`,
        )
        .join('')
    : '<li class="drawer__empty">Votre panier est vide. Les produits s’ajoutent depuis la boutique.</li>';
  const total = items.reduce((s, [p, q]) => s + (priceValue(p) || 0) * q, 0);
  const unpriced = items.some(([p]) => !p.price);
  const alcool = items.some(([p]) => p.alcool);
  $('#cart-foot').innerHTML = items.length
    ? `<p class="drawer__total"><span>Total</span><span>${euro(total)}${unpriced ? ' <small>+ articles à prix à compléter</small>' : ''}</span></p>
       <button type="button" class="btn btn--accent" id="checkout">Commander</button>
       <p class="drawer__fine" id="checkout-msg" role="status"></p>
       ${alcool ? `<p class="evin">${evinHTML(MINEURS)}</p>` : ''}`
    : '';
  $$('[data-q]', drawer).forEach((b) =>
    b.addEventListener('click', () => {
      const q = (cart.get(b.dataset.id) || 0) + Number(b.dataset.q);
      if (q <= 0) cart.delete(b.dataset.id);
      else cart.set(b.dataset.id, q);
      renderCart();
    }),
  );
  $('#checkout')?.addEventListener('click', () => {
    $('#checkout-msg').textContent = 'Maquette : le paiement n’est pas branché. Sur le site en ligne, cette étape mènera au paiement sécurisé.';
  });
}
function bindCart() {
  $('#cart-open').addEventListener('click', () => {
    closeMenu();
    drawer.showModal();
    lenis?.stop();
  });
  $('#cart-close').addEventListener('click', () => drawer.close());
  drawer.addEventListener('click', (e) => e.target === drawer && drawer.close());
  drawer.addEventListener('close', () => lenis?.start());
}

let toastTimer;
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), 2200);
}

// ---------- Formulaires (maquette : vérifient la saisie, n'envoient rien) ----------
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const isPhone = (v) => (v.replace(/\D/g, '').length >= 10 && /^[+\d][\d .-]+$/.test(v.trim()));
const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

function bindForm(form, check, done) {
  const msg = $('.form__msg', form);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    data.gammes = new FormData(form).getAll('gammes');
    const bad = check(data, form);
    $$('.is-invalid', form).forEach((el) => {
      el.classList.remove('is-invalid');
      el.removeAttribute('aria-invalid');
    });
    if (bad.length) {
      bad.forEach((name) => {
        const el = form.elements[name];
        el.classList.add('is-invalid');
        el.setAttribute('aria-invalid', 'true');
      });
      msg.className = 'form__msg err';
      msg.textContent = 'Merci de vérifier les champs entourés en rouge.';
      form.elements[bad[0]].focus();
      return;
    }
    msg.className = 'form__msg ok';
    msg.innerHTML = done(data);
    form.reset();
    form.dispatchEvent(new Event('change'));
  });
}

function bindForms() {
  const date = $('#visit-date');
  date.min = todayISO();
  const max = new Date();
  max.setFullYear(max.getFullYear() + 1);
  date.max = max.toISOString().slice(0, 10);

  const visit = $('#visit-form');
  const qty = $('#visit-qty');
  const total = () => {
    const n = clamp(parseInt(qty.value, 10) || 0, 0, 99);
    const groupe = visit.elements.type.value === 'groupe';
    $('#visit-total').textContent = !n
      ? ''
      : groupe
        ? `Groupe avec dégustation : ${n} × 5 € = ${n * 5} €`
        : `Visite gratuite · ${n} personne${n > 1 ? 's' : ''}`;
  };
  $$('[data-qty]', visit).forEach((b) => {
    b.innerHTML = Number(b.dataset.qty) > 0 ? icons.plus : icons.minus;
    b.addEventListener('click', () => {
      qty.value = clamp((parseInt(qty.value, 10) || 0) + Number(b.dataset.qty), 1, 99);
      total();
    });
  });
  visit.addEventListener('input', total);
  visit.addEventListener('change', total);
  total();

  bindForm(
    visit,
    (d) => {
      const bad = [];
      if (!d.date || d.date < todayISO() || d.date > date.max) bad.push('date');
      if (!d.creneau) bad.push('creneau');
      const n = parseInt(d.personnes, 10);
      if (!(n >= 1 && n <= 99)) bad.push('personnes');
      if (!d.nom.trim()) bad.push('nom');
      if (!isEmail(d.contact) && !isPhone(d.contact)) bad.push('contact');
      return bad;
    },
    (d) => {
      const n = parseInt(d.personnes, 10);
      const when = new Date(`${d.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      const what = d.type === 'groupe' ? `visite de groupe avec dégustation (${n} × 5 € = ${n * 5} €)` : 'visite gratuite';
      return `<strong>Merci ${esc(d.nom.trim())} !</strong> Demande de ${what} pour ${n} personne${n > 1 ? 's' : ''}, le ${esc(when)} (${esc(d.creneau.toLowerCase())}). Sur le site en ligne, la distillerie la recevrait et vous confirmerait le créneau. <em>Maquette : rien n’a été envoyé.</em>`;
    },
  );

  bindForm(
    $('#pro-form'),
    (d) => {
      const bad = [];
      ['etablissement', 'activite', 'ville', 'nom'].forEach((k) => !d[k].trim() && bad.push(k));
      if (!isEmail(d.email)) bad.push('email');
      if (d.tel && !isPhone(d.tel)) bad.push('tel');
      return bad;
    },
    (d) =>
      `<strong>Merci ${esc(d.nom.trim())} !</strong> Demande reçue pour ${esc(d.etablissement.trim())} (${esc(d.ville.trim())})${d.gammes.length ? ` : ${esc(d.gammes.join(', '))}` : ''}. La distillerie reviendrait vers vous avec ses conditions. <em>Maquette : rien n’a été envoyé.</em>`,
  );
}

// ---------- Carrousel : flèches, clavier, glisser, clic sur une bouteille ----------
function step(dir) {
  const n = list.length;
  setProduct(list[(((position() + dir) % n) + n) % n], 'arrow');
}

function bindSelection() {
  $('#prev').innerHTML = icons.arrowL;
  $('#next').innerHTML = icons.arrowR;
  $('#prev').addEventListener('click', () => step(-1));
  $('#next').addEventListener('click', () => step(1));
  addEventListener('keydown', (e) => {
    if (scrollY > innerHeight * 0.5 || e.target.closest('input, textarea, select, dialog, [contenteditable]')) return;
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  const sel = $('#selector');
  const fromX = (x) => {
    const r = sel.getBoundingClientRect();
    return list[Math.round(clamp((x - r.left) / r.width, 0, 1) * (list.length - 1))];
  };
  sel.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.selector__dot')) return;
    sel.setPointerCapture(e.pointerId);
    sel.classList.add('is-dragging');
    setProduct(fromX(e.clientX), 'selector');
    const move = (ev) => setProduct(fromX(ev.clientX), 'selector');
    const up = () => {
      sel.classList.remove('is-dragging');
      sel.removeEventListener('pointermove', move);
      sel.removeEventListener('pointerup', up);
    };
    sel.addEventListener('pointermove', move);
    sel.addEventListener('pointerup', up);
  });

  const canvas = $('#webgl');
  let startX = null;
  let startY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (scrollY > innerHeight * 0.3) return;
    startX = e.clientX;
    startY = e.clientY;
  });
  addEventListener('pointermove', (e) => {
    if (scene) {
      scene.state.mouseX = (e.clientX / innerWidth) * 2 - 1;
      scene.state.mouseY = -((e.clientY / innerHeight) * 2 - 1);
    }
    if (startX === null || !scene) return;
    const dx = e.clientX - startX;
    if (Math.abs(e.clientY - startY) > Math.abs(dx) * 1.5 && Math.abs(dx) < 10) return;
    scene.state.drag = -dx / (innerWidth * (innerWidth <= 760 ? 0.38 : 0.17));
  });
  addEventListener('pointerup', (e) => {
    if (startX === null || !scene) return;
    const dx = e.clientX - startX;
    startX = null;
    const s = scene.state;
    if (Math.abs(dx) < 6) {
      s.drag = 0;
      const hit = scene.pick(e.clientX, e.clientY);
      if (hit >= 0 && list.includes(hit)) setProduct(hit, 'click');
      return;
    }
    const n = list.length;
    let k = Math.round(s.current - s.drag);
    s.current -= s.drag;
    s.drag = 0;
    k = n >= 4 ? ((k % n) + n) % n : clamp(k, 0, n - 1);
    setProduct(list[k], 'swipe');
  });
}

// ---------- Scroll ----------
function updateStory() {
  const p = story.p;
  const chapters = products[active].chapters.length;
  const s = p < 0.2 ? -1 : clamp(Math.floor((p - 0.2) / (0.8 / chapters)), 0, chapters - 1);
  if (s === story.step) return;
  story.step = s;
  $$('.chapter').forEach((c, i) => c.classList.toggle('is-active', i === s));
  $$('#story-nav button').forEach((b, i) => b.classList.toggle('is-active', i === s));
}

function gotoStep(k) {
  const el = $('#decouvrir');
  const chapters = products[active].chapters.length;
  const total = el.offsetHeight - innerHeight;
  const y = el.offsetTop + total * (0.2 + (k + 0.5) * (0.8 / chapters));
  lenis ? lenis.scrollTo(y) : scrollTo(0, y);
}

function setupScroll() {
  lenis = new Lenis({ duration: 1.15, smoothWheel: !calm });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  const heroBottom = $('.hero__bottom');
  const arrows = $$('.hero__arrow');
  const root = document.documentElement.style;
  const intro = $('#story-intro');
  const nav = $('#story-nav');

  // Héros → gros plan
  ScrollTrigger.create({
    trigger: '#decouvrir',
    start: 'top bottom',
    end: 'top top',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      if (scene) scene.state.focus = p;
      root.setProperty('--story', p.toFixed(3));
      root.setProperty('--hero', clamp(1 - p * 1.6, 0, 1).toFixed(3));
      heroBottom.style.opacity = String(clamp(1 - p * 2.5, 0, 1));
      if (story.p === 0) intro.style.opacity = String(clamp((p - 0.6) / 0.4, 0, 1));
      arrows.forEach((a) => {
        a.style.opacity = String(clamp(1 - p * 3, 0, 1));
        a.style.pointerEvents = p > 0.2 ? 'none' : '';
      });
    },
  });

  // Narration pendant la section collante
  ScrollTrigger.create({
    trigger: '#decouvrir',
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      story.p = p;
      const out = clamp((p - 0.13) / 0.06, 0, 1);
      intro.style.opacity = String(1 - out);
      intro.style.transform = innerWidth <= 760 ? `translateY(${-out * 40}px)` : `translateY(calc(-50% - ${out * 40}px))`;
      intro.style.pointerEvents = out > 0.5 ? 'none' : '';
      nav.style.opacity = String(clamp((p - 0.15) / 0.06, 0, 1));
      updateStory();
    },
  });

  // Progression globale, et en-tête sur fond flou dès qu'on quitte la 3D (jusqu'en bas de page)
  const bar = $('#scroll-progress');
  const band = $('.band');
  const content = () => document.body.classList.toggle('is-content', band.getBoundingClientRect().top < 130);
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      bar.style.transform = `scaleX(${self.progress})`;
      content();
    },
  });
  ScrollTrigger.addEventListener('refresh', content);

  // Bouton « Réserver » (téléphone) : caché sur le formulaire de visite
  const cta = $('#mobile-cta');
  ScrollTrigger.create({ trigger: '#visites', start: 'top 80%', end: 'bottom 20%', onToggle: (self) => cta.classList.toggle('is-hidden', self.isActive) });

  // Frise 1835 → 2035 : défilement horizontal épinglé (ordinateur, animations autorisées)
  const mm = gsap.matchMedia();
  mm.add('(min-width: 761px) and (prefers-reduced-motion: no-preference)', () => {
    const track = $('#timeline');
    const pin = $('#history-pin');
    const dist = () => Math.max(0, track.scrollWidth - pin.clientWidth);
    const tween = gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        trigger: pin,
        start: 'center 55%',
        end: () => `+=${dist() + innerHeight * 0.3}`,
        pin: true,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          $('#history-progress').style.transform = `scaleX(${self.progress})`;
          $$('.year').forEach((y) => y.classList.toggle('is-on', y.getBoundingClientRect().left < innerWidth * 0.62));
        },
      },
    });
    return () => tween.scrollTrigger?.kill();
  });
  mm.add('(max-width: 760px), (prefers-reduced-motion: reduce)', () => {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle('is-on', e.isIntersecting)), { threshold: 0.6 });
    const watch = () => $$('.year').forEach((y) => io.observe(y));
    watch();
    const mo = new MutationObserver(watch);
    mo.observe($('#timeline'), { childList: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  });

  // Liens d'ancre via Lenis
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    e.preventDefault();
    closeMenu();
    if (id === '#contenu') {
      $('#histoire').setAttribute('tabindex', '-1');
      $('#histoire').focus({ preventScroll: true });
    }
    lenis.scrollTo(id === '#top' ? 0 : id === '#contenu' ? '#histoire' : id, { offset: id === '#top' ? 0 : -20 });
  });
}

// ---------- Menu ----------
const menu = $('#menu');
function openMenu() {
  menu.classList.add('is-open');
  menu.inert = false;
  document.body.classList.add('menu-ouvert');
  $('#menu-close').focus();
  $('#menu-open').setAttribute('aria-expanded', 'true');
  lenis?.stop();
}
function closeMenu() {
  if (!menu.classList.contains('is-open')) return;
  menu.classList.remove('is-open');
  menu.inert = true;
  document.body.classList.remove('menu-ouvert');
  $('#menu-open').focus({ preventScroll: true });
  $('#menu-open').setAttribute('aria-expanded', 'false');
  lenis?.start();
}

function bindUI() {
  $('#menu-open').addEventListener('click', openMenu);
  $('#menu-close').addEventListener('click', closeMenu);
  addEventListener('keydown', (e) => e.key === 'Escape' && closeMenu());
  $$('.switch__btn').forEach((b) => b.addEventListener('click', () => gotoUnivers(b.dataset.univers)));
  $$('[data-icon]').forEach((el) => (el.innerHTML = icons[el.dataset.icon] || ''));
  $('#route-link').href = infos.itineraire;
  $('#year').textContent = new Date().getFullYear();
  const claims = ['Depuis 1835', 'Châteauneuf-du-Pape', 'La plus ancienne distillerie de Provence', '8e génération', 'Une trentaine de sirops', 'Visites sur réservation'];
  $('#band').innerHTML = [...claims, ...claims].map((c) => `<span>${c}</span>`).join('');
}

// ---------- Rendus 3D des bouteilles pour la boutique ----------
async function makeSnapshots() {
  if (!scene) return;
  const missing = list.filter((i) => !snaps[products[i].id]);
  if (!missing.length) return;
  try {
    Object.assign(snaps, await scene.snapshots(missing));
    renderShop();
    renderCart();
  } catch {
    /* les illustrations SVG restent en place */
  }
}

// ---------- Boucle de rendu ----------
const storyEl = $('#decouvrir');
const webglEl = $('#webgl');
function loop() {
  // Rotation pilotée par la narration : face avant pendant l'intro, puis contre-étiquette.
  const toBack = clamp((story.p - 0.14) / 0.12, 0, 1);
  scene.state.spinTarget = toBack * (Math.PI - 0.35) + Math.max(0, story.step) * 0.22 * toBack;
  // Plus de rendu quand la scène est recouverte par les sections suivantes.
  const covered = storyEl.getBoundingClientRect().bottom < -innerHeight * 0.1;
  if (!covered && !document.hidden) scene.update();
  if (covered !== loop.covered) {
    loop.covered = covered;
    webglEl.style.visibility = covered ? 'hidden' : '';
  }
  requestAnimationFrame(loop);
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

// ---------- Démarrage ----------
async function boot() {
  bindUI();
  renderAll();
  bindSelection();
  bindGate();
  bindCart();
  bindForms();

  const count = $('#loader-count');
  const bar = $('#loader-bar');
  const progress = { v: 0 };
  const show = () => {
    count.textContent = Math.round(progress.v);
    bar.style.transform = `scaleX(${progress.v / 100})`;
  };
  const fake = gsap.to(progress, { v: 70, duration: 1.2, ease: 'power1.out', onUpdate: show });

  // Les étiquettes sont dessinées avec les polices du site : on attend qu'elles soient chargées.
  await Promise.race([
    Promise.all([
      document.fonts.load('italic 900 100px "Archivo Variable"'),
      document.fonts.load('800 40px "Archivo Variable"'),
      document.fonts.load('italic 400 60px "Instrument Serif"'),
      document.fonts.load('500 30px "Inter Variable"'),
    ]),
    new Promise((r) => setTimeout(r, 2500)),
  ]);

  if (hasWebGL()) {
    try {
      const { BottleScene } = await import('./three/scene.js');
      scene = new BottleScene($('#webgl'), products, { calm });
      scene.setList(list, active);
      document.documentElement.classList.add('has-webgl');
      $('#webgl').addEventListener('webglcontextlost', () => {
        document.documentElement.classList.replace('has-webgl', 'no-webgl');
        scene = null;
        setProduct(active, 'fallback');
      });
    } catch (err) {
      console.warn('3D indisponible, affichage sans WebGL.', err);
      scene = null;
    }
  }
  if (!scene) document.documentElement.classList.add('no-webgl');

  progress.v = Math.max(progress.v, 85);
  show();
  setProduct(active, 'init');
  setupScroll();
  if (scene) loop();

  fake.kill();
  await gsap.to(progress, { v: 100, duration: 0.5, ease: 'power2.out', onUpdate: show });
  $('#loader').classList.add('is-done');
  document.body.classList.remove('is-loading');
  if (!calm) {
    gsap.from('.hud > *', { y: -30, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.1, delay: 0.2 });
    gsap.from('.hero__bottom > *', { y: 30, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.08, delay: 0.35 });
  }
  reveal();
  // Première visite : on demande l'âge (les sirops restent accessibles sans répondre).
  if (age === null) setTimeout(() => openGate('ask'), calm ? 0 : 700);
  // Rendus de la boutique en tâche de fond, après l'apparition du héros.
  setTimeout(makeSnapshots, 1200);
}

// Apparition douce des blocs marqués data-reveal
function reveal() {
  if (calm || !('IntersectionObserver' in window)) {
    $$('[data-reveal]').forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }),
    { threshold: 0.12 },
  );
  $$('[data-reveal]').forEach((el) => io.observe(el));
}

boot();

// Accès de débogage en développement uniquement.
if (import.meta.env.DEV) window.__bl = { get scene() { return scene; }, setProduct, story, get age() { return age; } };
