// Outils communs de l'audit (octobre 2026) : pages, tailles d'écran, lancement de Chromium,
// états (âge vérifié ou non, panier rempli), mesures de performance injectées dans les pages.
//
// Les scripts d'audit ne lancent pas de serveur : ils visent un « vite preview » déjà démarré
//   npm run build && npx vite preview --port 4184 --strictPort
// (AUDIT_BASE, par défaut http://localhost:4184). Ils n'ajoutent aucune dépendance au projet :
// Playwright vient de l'installation globale (PLAYWRIGHT_MODULE), Chromium de PLAYWRIGHT_CHROMIUM ;
// axe-core, html-validate et Lighthouse d'un dossier d'outils (AUDIT_TOOLS, un node_modules où
// « npm i lighthouse @axe-core/playwright axe-core html-validate » a été lancé, hors du projet).
// Sorties : AUDIT_OUT (par défaut .cache/audit, non versionné).
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const BASE = process.env.AUDIT_BASE || 'http://localhost:4184';
export const OUT = resolve(process.env.AUDIT_OUT || join(ROOT, '.cache/audit'));
export const TOOLS = process.env.AUDIT_TOOLS || '';
mkdirSync(OUT, { recursive: true });

const require = createRequire(import.meta.url);
export const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
export const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
export const tool = (name) => require(TOOLS ? require.resolve(name, { paths: [TOOLS] }) : name);

// Pages publiques auditées (le CRM, pro.html, contact.html et /api sont hors périmètre).
export const PAGES = [
  ['accueil', '/'],
  ['boutique', '/boutique'],
  ['fiche-pac', '/boutique/pac-citron'],
  ['fiche-fun-blue', '/boutique/fun-blue'],
  ['fiche-spiritueux', '/boutique/la-camarguaise'],
  ['pac-citron', '/pac-citron'],
  ['fun-blue', '/fun-blue'],
  ['couleur-provence', '/couleur-provence'],
  ['spiritueux', '/spiritueux'],
  ['la-maison', '/la-maison'],
  ['musee', '/musee'],
  ['visiter', '/visiter'],
  ['recettes', '/recettes'],
  ['ou-trouver', '/ou-trouver'],
  ['actualites', '/actualites'],
  ['panier', '/panier'],
  ['espace-pro', '/espace-pro'],
  ['mentions-legales', '/mentions-legales'],
  ['conditions-de-vente', '/conditions-de-vente'],
  ['404', '/page-evaporee'],
];

export const WIDTHS = [320, 360, 390, 768, 1024, 1280, 1440, 1920, 2560];
export const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
export const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

// Panier de test : deux sirops vendus en ligne et un spiritueux (gardé seulement pour les majeurs).
export const PANIER = { v: 3, items: [{ slug: 'pac-citron', v: '1000', qty: 2 }, { slug: 'fun-blue', v: '1000', qty: 1 }, { slug: 'la-camarguaise', v: '700', qty: 1 }] };

// webgl: false → --disable-3d-apis (le site montre alors ses photos à la place de la 3D) : plus
// rapide pour les contrôles qui ne portent pas sur la 3D (liens, HTML).
export async function launch({ webgl = true } = {}) {
  return chromium.launch({
    executablePath: CHROMIUM,
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--ignore-gpu-blocklist', ...(webgl ? [] : ['--disable-3d-apis'])],
  });
}

// age : 'majeur' (réponse gardée), null (première visite : la porte d'âge s'ouvre), 'sirops'.
export async function context(browser, { device = DESKTOP, age = 'majeur', panier = false, reducedMotion = 'no-preference', extra = {} } = {}) {
  const ctx = await browser.newContext({ ...device, reducedMotion, locale: 'fr-FR', ...extra });
  await ctx.addInitScript(
    ({ age, panier }) => {
      try {
        localStorage.setItem('v2x_moi', '1');
        if (age === 'majeur') localStorage.setItem('blachere-age', 'majeur');
        else if (age) sessionStorage.setItem('blachere-age', age);
        if (panier) localStorage.setItem('blachere-panier', JSON.stringify(panier));
      } catch {
        /* rien */
      }
    },
    { age, panier: panier ? PANIER : null },
  );
  return ctx;
}

// Mesures injectées avant tout script de la page : LCP (élément), décalages (CLS, sources),
// tâches longues, et tampon des Resource Timing agrandi.
export const PERF_INIT = () => {
  const describe = (n) => {
    if (!n) return null;
    const el = n.nodeType === 1 ? n : n.parentElement;
    if (!el) return null;
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    const id = el.id ? `#${el.id}` : '';
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    return `${el.tagName.toLowerCase()}${id}${cls ? `.${cls}` : ''}${text ? ` « ${text} »` : ''}`;
  };
  window.__audit = { lcp: [], cls: [], longtasks: [] };
  try {
    performance.setResourceTimingBufferSize(2000);
  } catch {
    /* rien */
  }
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__audit.lcp.push({ t: Math.round(e.startTime), size: e.size, url: e.url || '', el: describe(e.element) });
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries())
        if (!e.hadRecentInput)
          window.__audit.cls.push({
            t: Math.round(e.startTime),
            v: Number(e.value.toFixed(4)),
            sources: (e.sources || []).map((s) => ({ el: describe(s.node), avant: s.previousRect && [s.previousRect.x, s.previousRect.y, s.previousRect.width, s.previousRect.height].map(Math.round), apres: s.currentRect && [s.currentRect.x, s.currentRect.y, s.currentRect.width, s.currentRect.height].map(Math.round) })),
          });
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__audit.longtasks.push({ t: Math.round(e.startTime), d: Math.round(e.duration) });
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    /* rien */
  }
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.max(200, innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 400));
    scrollTo(0, 0);
  });
}
