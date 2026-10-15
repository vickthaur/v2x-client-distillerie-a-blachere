#!/usr/bin/env node
// Rendus 3D pré-calculés des menus et des cartes de marque (outil ponctuel, comme l'image de partage).
// Le site les faisait à la volée dans le navigateur (src/three/snap.js : three.js, un second contexte
// WebGL, les textures complètes des bouteilles, encodage sur le fil principal) : jusqu'à 2,3 Mo et
// plusieurs secondes de calcul pour ouvrir un menu. Ce script fait les mêmes images, avec le même
// code et le même plateau, dans Chromium sans tête, une fois pour toutes :
//   public/rendus/<nom>.webp (densité 1) et <nom>@2x.webp (écrans haute densité),
//   src/data/rendus.json (clé du rendu → fichiers), lu par src/lib/thumbs.js.
// À relancer quand une bouteille, le plateau ou RENDER_VERSION (src/lib/thumbs.js) changent ; une
// clé absente du manifeste (ou d'une autre version) retombe sur le rendu à la volée.
//
//   npx vite --port 5187 &   (serveur de développement : les modules /src y sont servis tels quels)
//   node scripts/rendus.mjs --base http://localhost:5187
//
// Playwright et Chromium sont ceux de la machine (PLAYWRIGHT_MODULE, PLAYWRIGHT_CHROMIUM), avec
// SwiftShader pour WebGL ; aucune dépendance ajoutée.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const BASE = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'http://localhost:5173';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');

// Les rendus demandés par le site (même slugs, même fond, même format que les appels de renderHTML).
const JOBS = [
  // méga-menu « Nos marques » et menu du téléphone (src/partials/header.html, data-render / data-bg)
  { nom: 'menu-pac-citron', slugs: ['pac-citron'], bg: '#c2177f', fmt: 'paysage' },
  { nom: 'menu-fun-blue', slugs: ['fun-blue'], bg: '#1f56a8', fmt: 'paysage' },
  { nom: 'menu-couleur-provence', slugs: ['sirop-couleur-provence-grenadine', 'sirop-lavande', 'sirop-menthe'], bg: '#e9dfc8', fmt: 'paysage' },
  { nom: 'menu-grenadine', slugs: ['sirop-couleur-provence-grenadine'], bg: '#e9dfc8', fmt: 'paysage' },
  // méga-menu « Spiritueux » (src/app/site.js), affiché seulement après la vérification de l'âge
  { nom: 'menu-pastis-marra', slugs: ['pastis-marra'], bg: '', fmt: 'paysage' },
  { nom: 'menu-la-camarguaise', slugs: ['la-camarguaise'], bg: '', fmt: 'paysage' },
  { nom: 'menu-creme-de-chataigne', slugs: ['creme-de-chataigne'], bg: '', fmt: 'paysage' },
  { nom: 'menu-marc-reserve-des-legats', slugs: ['marc-chateauneuf-du-pape-reserve-des-legats'], bg: '', fmt: 'paysage' },
  // cartes « Nos marques » de l'accueil (src/pages/home.js)
  { nom: 'carte-pac-citron', slugs: ['pac-citron'], bg: '#c2177f', fmt: 'carte' },
  { nom: 'carte-fun-blue', slugs: ['fun-blue'], bg: '#1f56a8', fmt: 'carte' },
  { nom: 'carte-couleur-provence', slugs: ['sirop-couleur-provence-grenadine', 'sirop-menthe', 'sirop-lavande'], bg: '#e9dfc8', fmt: 'carte' },
  { nom: 'carte-spiritueux', slugs: ['pastis-marra', 'marc-chateauneuf-du-pape-reserve-des-legats'], bg: '#2b2723', fmt: 'carte' },
];

const thumbsSrc = readFileSync(join(root, 'src/lib/thumbs.js'), 'utf8');
const VERSION = Number(/RENDER_VERSION = (\d+)/.exec(thumbsSrc)?.[1]);
const FORMATS = { portrait: [420, 560], paysage: [640, 480], carte: [420, 575] };
const key = (j) => `${j.slugs.join('+')}|${j.bg}|${j.fmt}`;

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
// page sans 3D ni porte d'âge ; ?moi coupe le signal de la pastille V2X
await page.goto(`${BASE}/mentions-legales?moi`, { waitUntil: 'load', timeout: 120000 });

const dir = join(root, 'public/rendus');
mkdirSync(dir, { recursive: true });
const manifest = { version: VERSION, genere: new Date().toISOString().slice(0, 10), images: {} };
for (const [dpr, quality] of [
  [1, 0.88],
  [2, 0.82],
]) {
  const t0 = Date.now();
  const urls = await page.evaluate(
    async ({ jobs, dpr, quality }) => {
      const { renderShots } = await import('/src/three/snap.js');
      const out = {};
      await renderShots(jobs, (job, url) => (out[job.nom] = url), { dpr, quality });
      return out;
    },
    { jobs: JOBS, dpr, quality },
  );
  for (const j of JOBS) {
    const data = urls[j.nom];
    if (!data?.startsWith('data:image/webp')) throw new Error(`Rendu manquant : ${j.nom}`);
    const file = `${j.nom}${dpr === 2 ? '@2x' : ''}.webp`;
    const buf = Buffer.from(data.split(',')[1], 'base64');
    writeFileSync(join(dir, file), buf);
    const [w, h] = FORMATS[j.fmt];
    const m = (manifest.images[key(j)] ||= { src: `/rendus/${j.nom}.webp`, w, h });
    if (dpr === 2) m.srcset = `/rendus/${j.nom}.webp 1x, /rendus/${file} 2x`;
    console.log(`${file} : ${Math.round(buf.length / 1024)} Ko`);
  }
  console.log(`densité ${dpr} : ${Math.round((Date.now() - t0) / 1000)} s`);
}
writeFileSync(join(root, 'src/data/rendus.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`${Object.keys(manifest.images).length} rendus (version ${VERSION}) → public/rendus, src/data/rendus.json`);
