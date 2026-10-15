#!/usr/bin/env node
// Recette « fidèle à Vercel » de la maquette Blachère.
// vite preview ne lit pas vercel.json : ses en-têtes (CSP stricte du CRM et de l'espace pro,
// X-Frame-Options…) ne sont donc jamais testés en local. Ce script les applique par interception
// dans Chromium, parcourt le site, le CRM et l'espace pro (connexion de démo par l'API), et relève :
// violations CSP, erreurs de console, exceptions, requêtes en échec (4xx/5xx inattendus).
//
// Usage : node scripts/recette-vercel.mjs . [--build] [--shots <dossier>] [--base <url>] [--seulement 1,2,5]
//   --build : lance « npm run build » avant (sinon dist/ doit exister)
//   --base  : teste une adresse déjà en ligne au lieu de lancer vite preview (en-têtes réels)
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');

const dir = resolve(process.argv[2] || '.');
const args = process.argv.slice(3);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const shots = opt('--shots') ? resolve(opt('--shots')) : null;
const baseEnLigne = opt('--base');
const seulement = opt('--seulement')?.split(',');
const doit = (n) => !seulement || seulement.includes(String(n));
if (shots) mkdirSync(shots, { recursive: true });

const vercel = JSON.parse(readFileSync(join(dir, 'vercel.json'), 'utf8'));

// --- path-to-regexp minimal (sources de vercel.json) ---
function versRegex(source) {
  const s = source
    .replace(/[.^$|[\]{}\\]/g, '\\$&')
    .replace(/:([A-Za-z_]\w*)\*/g, '(.*)')
    .replace(/:([A-Za-z_]\w*)\+/g, '(.+)')
    .replace(/:([A-Za-z_]\w*)/g, '([^/]+)');
  return new RegExp(`^${s}$`);
}
const regles = (vercel.headers || []).map((r) => ({ re: versRegex(r.source), headers: r.headers }));
function entetesPour(chemin) {
  const out = new Map();
  for (const r of regles) if (r.re.test(chemin)) for (const h of r.headers) out.set(h.key.toLowerCase(), h.value);
  return out;
}

// --- serveur ---
let BASE = baseEnLigne;
let serveur = null;
if (!BASE) {
  if (args.includes('--build')) execSync('npm run build', { cwd: dir, stdio: 'inherit' });
  const PORT = 4400 + Math.floor(Math.random() * 500);
  const data = mkdtempSync(join(tmpdir(), 'blachere-data-'));
  serveur = spawn(join(dir, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: dir,
    env: { ...process.env, BLACHERE_DATA: data, BLOB_READ_WRITE_TOKEN: '', NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serveur.stderr.on('data', (d) => process.stderr.write(`[preview] ${d}`));
  BASE = `http://127.0.0.1:${PORT}`;
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(`${BASE}/`);
      if (r.ok) break;
    } catch {}
    if (i > 100) throw new Error('vite preview ne répond pas');
    await new Promise((r) => setTimeout(r, 200));
  }
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});

const problemes = [];
const note = (p) => {
  problemes.push(p);
  console.log(`  ✗ ${p}`);
};

async function contexte(vp = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, locale: 'fr-FR', isMobile: vp.width < 600, hasTouch: vp.width < 600 });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('blachere-age', 'majeur');
      localStorage.setItem('v2x_moi', '1');
    } catch {}
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      window.__csp.push({ directive: e.violatedDirective, bloque: e.blockedURI, extrait: e.sample, source: e.sourceFile, ligne: e.lineNumber }),
    );
  });
  if (!baseEnLigne) {
    // en-têtes de vercel.json appliqués à chaque réponse du serveur local
    await ctx.route(`${BASE}/**`, async (route) => {
      const url = new URL(route.request().url());
      let res;
      try {
        res = await route.fetch({ maxRedirects: 0 });
      } catch {
        return route.abort();
      }
      const h = { ...res.headers() };
      for (const [k, v] of entetesPour(url.pathname)) h[k] = v;
      await route.fulfill({ response: res, headers: h });
    });
  }
  return ctx;
}

// Requête d'API depuis la page (cookies du contexte, en-têtes du contrôle CSRF).
const api = (page, chemin, methode = 'GET', corps) =>
  page.evaluate(
    async ({ chemin, methode, corps }) => {
      const r = await fetch(chemin, {
        method: methode,
        headers: corps ? { 'Content-Type': 'application/json', 'X-Blachere': '1' } : { 'X-Blachere': '1' },
        body: corps ? JSON.stringify(corps) : undefined,
      });
      let json = null;
      try {
        json = await r.json();
      } catch {}
      return { status: r.status, json };
    },
    { chemin, methode, corps },
  );

async function visiter(ctx, chemin, { attente = 1800, nom = chemin, capture = null, attendu = [200] } = {}) {
  const page = await ctx.newPage();
  const erreurs = [];
  // page d'erreur attendue (404) : sa propre réponse et le message de console qui l'accompagne ne comptent pas
  const pageAttendueEnErreur = attendu.some((s) => s >= 400);
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (pageAttendueEnErreur && /Failed to load resource: the server responded with a status of 404/.test(m.text())) return;
    erreurs.push(`console : ${m.text()}`);
  });
  page.on('pageerror', (e) => erreurs.push(`exception : ${e.message}`));
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (u.origin !== new URL(BASE).origin) return;
    if (pageAttendueEnErreur && u.pathname === chemin.split('?')[0]) return;
    if (r.status() >= 400 && !(u.pathname === '/api/session' && r.status() === 401)) erreurs.push(`HTTP ${r.status()} ${u.pathname}${u.search}`);
  });
  let statut = 0;
  try {
    const res = await page.goto(`${BASE}${chemin}`, { waitUntil: 'load', timeout: 60000 });
    statut = res?.status() ?? 0;
  } catch (e) {
    erreurs.push(`navigation : ${e.message.split('\n')[0]}`);
  }
  await page.waitForTimeout(attente);
  const csp = await page.evaluate(() => window.__csp || []).catch(() => []);
  if (!attendu.includes(statut)) note(`${nom} : statut ${statut}`);
  for (const v of csp) note(`${nom} : CSP ${v.directive} a bloqué ${v.bloque || '(inline)'} ${v.extrait ? `« ${v.extrait.slice(0, 60)} »` : ''} ${v.source ? `(${v.source}:${v.ligne})` : ''}`);
  for (const e of erreurs) note(`${nom} : ${e}`);
  if (!csp.length && !erreurs.length && attendu.includes(statut)) console.log(`  ✓ ${nom}`);
  if (shots && capture) await page.screenshot({ path: join(shots, `${capture}.png`), fullPage: false }).catch(() => {});
  return page;
}

console.log(`Recette fidèle à Vercel sur ${BASE}${baseEnLigne ? ' (en ligne)' : ' (vite preview + en-têtes de vercel.json)'}`);

// 1. Site public
console.log('\n1. Site public');
if (doit(1)) {
  const ctx = await contexte();
  const pages = ['/', '/boutique', '/boutique/pac-citron', '/panier', '/visiter', '/contact', '/espace-pro', '/pac-citron', '/fun-blue',
    '/couleur-provence', '/spiritueux', '/la-maison', '/musee', '/ou-trouver', '/actualites', '/recettes', '/mentions-legales', '/conditions-de-vente'];
  for (const p of pages) await (await visiter(ctx, p, { attente: p === '/' ? 4000 : 1500 })).close();
  await (await visiter(ctx, '/page-qui-n-existe-pas', { attendu: [404] })).close();
  await ctx.close();
}

// 2. CRM (connexion de démo par l'API, chaque rubrique)
console.log('\n2. CRM');
for (const vp of doit(2) ? [{ width: 1440, height: 900 }, { width: 390, height: 844 }] : []) {
  const ctx = await contexte(vp);
  const p0 = await visiter(ctx, '/crm', { nom: `/crm (${vp.width}, déconnecté)`, capture: `crm-connexion-${vp.width}` });
  const r = await api(p0, '/api/session?r=demo', 'POST', { profil: 'direction' });
  if (r.status !== 200 && r.status !== 201) note(`démo direction : ${r.status} ${JSON.stringify(r.json)}`);
  await p0.close();
  const rubriques = ['tableau', 'commandes', 'commandes/nouvelle', 'clients', 'comptes', 'demandes', 'produits', 'visites', 'messages', 'newsletter',
    'promos', 'courriels', 'equipe', 'journal', 'parametres'];
  for (const rub of rubriques) {
    const page = await visiter(ctx, `/crm/${rub}`, { nom: `/crm/${rub} (${vp.width})`, capture: vp.width === 390 || rub === 'tableau' ? `crm-${rub.replace('/', '-')}-${vp.width}` : null });
    if (rub === 'commandes') {
      const l = await api(page, '/api/crm?r=commandes&par=5');
      const id = l.json?.elements?.[0]?.id;
      if (!id) note(`/api/crm?r=commandes : pas de commande (${l.status})`);
      else await (await visiter(ctx, `/crm/commandes/${id}`, { nom: `/crm/commandes/<id> (${vp.width})`, capture: `crm-commande-${vp.width}` })).close();
    }
    await page.close();
  }
  await ctx.close();
}

// 3. Espace pro
console.log('\n3. Espace pro');
for (const vp of doit(3) ? [{ width: 1440, height: 900 }, { width: 390, height: 844 }] : []) {
  const ctx = await contexte(vp);
  const p0 = await visiter(ctx, '/espace-pro', { nom: `/espace-pro (${vp.width})`, capture: `pro-public-${vp.width}` });
  const r = await api(p0, '/api/session?r=demo', 'POST', { profil: 'pro' });
  if (r.status !== 200 && r.status !== 201) note(`démo pro : ${r.status} ${JSON.stringify(r.json)}`);
  await p0.close();
  for (const vue of ['accueil', 'catalogue', 'commande', 'commandes', 'factures', 'documents', 'compte', 'messages']) {
    await (await visiter(ctx, `/espace-pro/${vue}`, { nom: `/espace-pro/${vue} (${vp.width})`, capture: `pro-${vue}-${vp.width}` })).close();
  }
  await ctx.close();
}

// 4. Contrôles d'en-têtes et de sécurité de l'API
console.log('\n4. API : en-têtes et refus attendus');
if (doit(4)) {
  const ctx = await contexte();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  const sansCsrf = await page.evaluate(async () => (await fetch('/api/session?r=demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"profil":"direction"}' })).status);
  if (sansCsrf !== 403 && sansCsrf !== 400) note(`POST sans X-Blachere : ${sansCsrf} (attendu 403)`);
  else console.log(`  ✓ POST sans X-Blachere refusé (${sansCsrf})`);
  const nonConnecte = await api(page, '/api/crm?r=tableau');
  if (nonConnecte.status !== 401) note(`CRM sans session : ${nonConnecte.status} (attendu 401)`);
  else console.log('  ✓ CRM sans session : 401');
  const proNonConnecte = await api(page, '/api/pro?r=accueil');
  if (proNonConnecte.status !== 401) note(`Espace pro sans session : ${proNonConnecte.status} (attendu 401)`);
  else console.log('  ✓ Espace pro sans session : 401');
  const r = await api(page, '/api/session?r=demo', 'POST', { profil: 'pro' });
  const croise = await api(page, '/api/crm?r=tableau');
  if (r.status < 300 && croise.status !== 401 && croise.status !== 403) note(`Session pro sur le CRM : ${croise.status} (attendu 401/403)`);
  else console.log(`  ✓ Session pro refusée par le CRM (${croise.status})`);
  await ctx.close();
}

// 5. Parcours fonctionnel complet par l'API (même démo du début à la fin)
console.log('\n5. Parcours : commande sur le site → CRM → visite, contact, lettre, demande pro → commande pro → export');
if (doit(5)) {
  const ctx = await contexte();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  const ok = (cond, libelle, detail) => (cond ? console.log(`  ✓ ${libelle}`) : note(`${libelle} : ${JSON.stringify(detail)?.slice(0, 300)}`));
  const jour = (d) => d.toISOString().slice(0, 10);
  const demain = new Date(Date.now() + 86400000);
  if (demain.getUTCDay() === 0) demain.setUTCDate(demain.getUTCDate() + 1);

  // a) commande en ligne, retrait à la distillerie, avec un spiritueux (âge confirmé)
  const proDemo = await api(page, '/api/session?r=demo', 'POST', { profil: 'pro' });
  const cat = await api(page, '/api/pro?r=catalogue');
  const spiritueux = cat.json?.produits?.find((p) => p.alcool && p.variantes.some((v) => v.etat !== 'rupture'));
  const vSpiritueux = spiritueux?.variantes.find((v) => v.etat !== 'rupture');
  const lignesSite = [{ slug: 'pac-citron', varianteId: '1000', qte: 2 }];
  if (spiritueux) lignesSite.push({ slug: spiritueux.slug, varianteId: vSpiritueux.id, qte: 1 });
  const cmd = await api(page, '/api/site?r=commande', 'POST', {
    client: { prenom: 'Recette', nom: 'Automatique', email: 'recette@example.com', telephone: '06 12 34 56 78' },
    livraison: { mode: 'retrait', jourRetrait: jour(demain) },
    paiement: { mode: 'carte' },
    lignes: lignesSite,
    ageConfirme: true,
    newsletter: false,
    cgv: true,
  });
  ok(proDemo.status < 300 && cmd.status === 201 && cmd.json?.numero, `commande en ligne ${cmd.json?.numero ?? ''} (${cmd.json?.totalTTC ?? '?'} € TTC)`, cmd);

  // b) la commande dans le CRM, puis préparation → prête → retirée
  await api(page, '/api/session?r=demo', 'POST', { profil: 'direction' });
  if (cmd.json?.id) {
    const fiche = await api(page, `/api/crm?r=commande&id=${cmd.json.id}`);
    ok(fiche.status === 200 && fiche.json?.numero === cmd.json.numero, 'commande visible dans le CRM', fiche);
    for (const statut of ['en-preparation', 'prete', 'retiree']) {
      const t = await api(page, `/api/crm?r=commande&id=${cmd.json.id}`, 'PATCH', { statut });
      ok(t.status === 200, `statut « ${statut} »`, t);
    }
    const courriels = await api(page, '/api/crm?r=courriels&par=10');
    const liste = courriels.json?.elements ?? courriels.json?.courriels ?? [];
    ok(courriels.status === 200 && liste.some((c) => c.a === 'recette@example.com'), 'courriels au client dans la boîte d\'envoi', { status: courriels.status, n: liste.length });
  }

  // c) réservation de visite sur le premier créneau libre
  let resa = null;
  for (let m = 0; m < 3 && !resa; m++) {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + m);
    const cr = await api(page, `/api/site?r=creneaux&mois=${jour(d).slice(0, 7)}`);
    const libre = cr.json?.jours?.find((j) => j.ouvert && (j.matin?.restantes >= 2 || j.apresMidi?.restantes >= 2));
    if (libre) {
      const moment = libre.matin?.restantes >= 2 ? 'matin' : 'apres-midi';
      resa = await api(page, '/api/site?r=reservation', 'POST', {
        date: libre.date, moment, personnes: 2, mineurs: 0, langue: 'fr', nom: 'Recette Automatique', email: 'recette@example.com', rgpd: true, newsletter: false,
      });
    }
  }
  ok(resa?.status === 201 && resa.json?.reference, `réservation de visite ${resa?.json?.reference ?? ''}`, resa);

  // d) contact, lettre d'information, demande de compte pro
  const contact = await api(page, '/api/site?r=contact', 'POST', { nom: 'Recette Automatique', email: 'recette@example.com', sujet: 'autre', message: 'Message de recette automatique.', rgpd: true });
  ok(contact.status === 201, `message de contact ${contact.json?.reference ?? ''}`, contact);
  const news = await api(page, '/api/site?r=newsletter', 'POST', { email: 'recette.lettre@example.com', source: 'pied-de-page' });
  ok(news.status === 201 || news.status === 200, 'inscription à la lettre d\'information', news);
  const dem = await api(page, '/api/site?r=demande-pro', 'POST', { societe: 'Recette SARL', activite: 'caviste', nom: 'Recette Automatique', ville: 'Avignon', email: 'recette.pro@example.com', rgpd: true });
  ok(dem.status === 201, `demande de compte pro ${dem.json?.reference ?? ''}`, dem);

  // e) commande pro au-dessus du minimum (devis puis commande), retrouvée dans le CRM
  const sirop = cat.json?.produits?.find((p) => !p.alcool && p.variantes.some((v) => v.etat === 'disponible' && v.prixCartonHT > 0));
  const vs = sirop?.variantes.find((v) => v.etat === 'disponible' && v.prixCartonHT > 0);
  if (vs) {
    const cartons = Math.max(1, Math.ceil(170 / vs.prixCartonHT));
    // parCarton est un booléen (commande par cartons) ; la quantité est en bouteilles, multiple du colisage
    const lignes = [{ slug: sirop.slug, varianteId: vs.id, qte: cartons * (vs.colisage || 1) }];
    const devis = await api(page, '/api/pro?r=devis', 'POST', { lignes });
    ok(devis.status === 200 && devis.json?.valide, `devis pro (${devis.json?.totaux?.totalHT ?? '?'} € HT)`, devis);
    const cpro = await api(page, '/api/pro?r=commande', 'POST', { lignes, referenceClient: 'RECETTE' });
    ok(cpro.status === 201 && cpro.json?.numero, `commande pro ${cpro.json?.numero ?? ''}`, cpro);
    if (cpro.json?.numero) {
      const dansCrm = await api(page, `/api/crm?r=commandes&q=${encodeURIComponent(cpro.json.numero)}`);
      ok((dansCrm.json?.elements ?? []).some((c) => c.numero === cpro.json.numero), 'commande pro visible dans le CRM', dansCrm);
    }
  } else note('catalogue pro : aucun sirop disponible');

  // f) export CSV
  const exp = await page.evaluate(async () => {
    const r = await fetch('/api/crm?r=export&type=commandes', { headers: { 'X-Blachere': '1' } });
    return { status: r.status, type: r.headers.get('content-type'), debut: (await r.text()).slice(0, 80) };
  });
  ok(exp.status === 200 && /csv/.test(exp.type || ''), 'export CSV des commandes', exp);
  await ctx.close();
}

await browser.close();
serveur?.kill();
console.log(`\n${problemes.length ? `${problemes.length} problème(s)` : 'Aucun problème'}.`);
if (shots) writeFileSync(join(shots, 'problemes.json'), JSON.stringify(problemes, null, 2));
process.exit(problemes.length ? 1 : 0);
