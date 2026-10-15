#!/usr/bin/env node
// Lighthouse (téléphone avec ralentissement simulé, et bureau) sur les pages clés.
// Deux états : « première visite » (stockage vidé : la porte d'âge s'ouvre après 900 ms) et
// « majeur » (réponse déjà donnée, --majeur), préparé avec Puppeteer avant la mesure.
// WebGL tourne ici en logiciel (SwiftShader) : les temps absolus des pages 3D sont pessimistes,
// seules les comparaisons (octets, requêtes, travail du fil principal, élément LCP, CLS) comptent.
//   AUDIT_TOOLS=<node_modules avec lighthouse> node scripts/audit/lighthouse.mjs [--pages …] [--majeur]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { BASE, OUT, CHROMIUM, TOOLS } from './lib.mjs';

const require = createRequire(import.meta.url);
const load = async (name) => import(pathToFileURL(require.resolve(name, TOOLS ? { paths: [TOOLS] } : undefined)).href);
const { default: lighthouse, desktopConfig } = await load('lighthouse');
const chromeLauncher = await load('chrome-launcher');
const puppeteer = (await load('puppeteer-core')).default;

const args = process.argv.slice(2);
const MAJEUR = args.includes('--majeur');
// --sans-webgl : WebGL coupé (--disable-3d-apis) ; le site montre alors ses photos à la place de la
// 3D. Avec SwiftShader, les pages 3D gardent le fil principal occupé et Lighthouse s'arrête
// (PAGE_HUNG) : la coque du site est mesurée sans 3D, la 3D à part (collecte.mjs, profil).
const SANS_WEBGL = args.includes('--sans-webgl');
// --test : adresse en « ?test » (la boucle 3D s'arrête une fois la scène prête) : la mise en place de
// la 3D (three.js, textures, shaders) est mesurée sans le rendu continu qui bloque SwiftShader.
const TEST = args.includes('--test');
const SUFFIX = `${MAJEUR ? '-majeur' : ''}${SANS_WEBGL ? '-sans-webgl' : ''}${TEST ? '-test' : ''}`;
const only = args.includes('--pages') ? args[args.indexOf('--pages') + 1].split(',') : null;
const KEY = [
  ['accueil', '/'],
  ['boutique', '/boutique'],
  ['fiche-pac', '/boutique/pac-citron'],
  ['pac-citron', '/pac-citron'],
  ['la-maison', '/la-maison'],
  ['visiter', '/visiter'],
  ['recettes', '/recettes'],
  ['musee', '/musee'],
  ['spiritueux', '/spiritueux'],
].filter(([n]) => !only || only.includes(n));

const dir = join(OUT, 'lighthouse');
mkdirSync(dir, { recursive: true });
const summary = [];
const chrome = await chromeLauncher.launch({
  chromePath: CHROMIUM,
  chromeFlags: ['--headless=new', '--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...(SANS_WEBGL ? ['--disable-3d-apis'] : [])],
});
try {
  for (const [name, path] of KEY) {
    for (const mode of ['mobile', 'bureau']) {
      let page = null;
      let browser = null;
      const flags = { port: chrome.port, output: 'json', logLevel: 'error', maxWaitForLoad: 60000, onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] };
      if (MAJEUR) {
        browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
        page = await browser.newPage();
        await page.goto(`${BASE}/robots.txt`);
        await page.evaluate(() => {
          localStorage.setItem('blachere-age', 'majeur');
          localStorage.setItem('v2x_moi', '1');
        });
        flags.disableStorageReset = true;
      }
      const config = mode === 'bureau' ? desktopConfig : undefined;
      const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}moi${TEST ? '&test' : ''}`;
      let r;
      try {
        r = await lighthouse(url, flags, config, page || undefined);
      } catch (e) {
        console.log(`${name} ${mode} : échec ${e.message}`);
        if (browser) await browser.disconnect();
        continue;
      }
      if (browser) {
        await page.close().catch(() => {});
        await browser.disconnect();
      }
      const lhr = r.lhr;
      const file = join(dir, `${name}-${mode}${SUFFIX}.json`);
      writeFileSync(file, JSON.stringify(lhr));
      const a = lhr.audits;
      const num = (id) => a[id]?.numericValue ?? null;
      const lcpEl = a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet || a['lcp-breakdown-insight']?.details?.items?.[0]?.node?.snippet || null;
      const row = {
        page: name,
        mode,
        majeur: MAJEUR,
        webgl: !SANS_WEBGL,
        erreur: lhr.runtimeError?.code || null,
        perf: Math.round((lhr.categories.performance?.score ?? 0) * 100),
        a11y: Math.round((lhr.categories.accessibility?.score ?? 0) * 100),
        bp: Math.round((lhr.categories['best-practices']?.score ?? 0) * 100),
        seo: Math.round((lhr.categories.seo?.score ?? 0) * 100),
        fcp: Math.round(num('first-contentful-paint')),
        lcp: Math.round(num('largest-contentful-paint')),
        tbt: Math.round(num('total-blocking-time')),
        cls: Number((num('cumulative-layout-shift') ?? 0).toFixed(3)),
        si: Math.round(num('speed-index')),
        octets: Math.round((num('total-byte-weight') ?? 0) / 1024),
        requetes: a['network-requests']?.details?.items?.length ?? null,
        mainThread: Math.round(num('mainthread-work-breakdown') ?? 0),
        bootup: Math.round(num('bootup-time') ?? 0),
        lcpElement: lcpEl,
      };
      summary.push(row);
      console.log(JSON.stringify(row));
    }
  }
} finally {
  await chrome.kill();
}
writeFileSync(join(dir, `resume${SUFFIX}.json`), JSON.stringify(summary, null, 1));
