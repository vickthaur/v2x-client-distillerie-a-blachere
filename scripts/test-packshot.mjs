#!/usr/bin/env node
// Preuve de bout en bout du pipeline photo (scripts/photos.mjs) :
//   1. dessine en 3D une bouteille de PAC Citron sur fond blanc, légèrement penchée (2°), avec
//      une ombre douce au sol, comme un packshot de photographe → scripts/test-packshot.png ;
//   2. fait passer cette image dans le pipeline, vers un dossier temporaire ;
//   3. publie le résultat dans public/bouteilles/ et affiche la fiche produit : la bouteille 3D
//      est reconstruite à partir de la photo (captures sous plusieurs angles) ; une photo de lieu
//      de test vérifie aussi le chemin photos/lieux → page « La maison » ;
//   4. nettoie : dossier temporaire supprimé, public/bouteilles et public/lieux régénérés depuis
//      photos/ (vide par défaut), cache du pipeline restauré.
//
//   node scripts/test-packshot.mjs [--sortie <dossier des captures>]
//
// Playwright et Chromium : installation globale (voir scripts/qa.mjs). Jamais « playwright install ».
import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const i = args.indexOf('--sortie');
const SHOTS = resolve(i >= 0 ? args[i + 1] : join(root, '.cache/test-packshot'));
const SLUG = 'pac-citron';
const PORT = 5181;
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const { createServer } = await import('vite');

mkdirSync(SHOTS, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'blachere-packshot-'));
const harnessDir = join(root, '.cache/test-packshot-harness');
const cacheFile = join(root, '.cache/photos.json');
const cacheBackup = existsSync(cacheFile) ? readFileSync(cacheFile) : null;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` · ${detail}` : ''}`);
};

// Page de rendu servie par Vite (même code 3D que le site).
mkdirSync(harnessDir, { recursive: true });
writeFileSync(
  join(harnessDir, 'index.html'),
  '<!doctype html><html lang="fr"><head><meta charset="UTF-8" /><style>html,body{margin:0;background:#fff}</style></head><body><script type="module" src="./harness.js"></script></body></html>',
);
writeFileSync(
  join(harnessDir, 'harness.js'),
  `import * as THREE from 'three';
import { makeBottle } from '/src/three/factory.js';
import { bySlug } from '/src/data/products.js';
import { studioEnvironment } from '/src/three/textures.js';
window.renderPackshot = async (slug, w, h) => {
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(w, h);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.NeutralToneMapping;
  document.body.append(r.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#ffffff');
  scene.environment = studioEnvironment(r);
  const cam = new THREE.PerspectiveCamera(26, w / h, 0.1, 50);
  cam.position.set(0, 0.1, 9.2);
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(3, 5, 6);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.35));
  // Ombre douce au sol (le pipeline doit la retirer).
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,0,0,0.32)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  shadow.position.set(0.04, -1.62, -0.2);
  scene.add(shadow);
  const bottle = await makeBottle(bySlug[slug], {});
  bottle.rotation.set(0, 0.0, 0.035); // 2° : le pipeline doit la redresser
  scene.add(bottle);
  r.render(scene, cam);
  return r.domElement.toDataURL('image/png');
};
window.harnessReady = true;
`,
);

const server = await createServer({ root, configFile: join(root, 'vite.config.js'), server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});

let failed = false;
try {
  // ---------- 1. Packshot sur fond blanc ----------
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(`http://localhost:${PORT}/.cache/test-packshot-harness/index.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.harnessReady === true, null, { timeout: 60000 });
  const dataUrl = await page.evaluate((slug) => window.renderPackshot(slug, 900, 1200), SLUG);
  const png = Buffer.from(dataUrl.split(',')[1], 'base64');
  writeFileSync(join(root, 'scripts/test-packshot.png'), png);
  check('Packshot rendu sur fond blanc', png.length > 20000, `scripts/test-packshot.png, ${(png.length / 1024).toFixed(0)} Ko`);
  await page.close();

  // ---------- 2. Pipeline vers un dossier temporaire ----------
  mkdirSync(join(tmp, 'photos/produits'), { recursive: true });
  mkdirSync(join(tmp, 'photos/lieux'), { recursive: true });
  copyFileSync(join(root, 'scripts/test-packshot.png'), join(tmp, `photos/produits/${SLUG}.png`));
  // Photo de lieu de test : un dégradé chaud, pour vérifier le chemin photos/lieux → la page.
  const sharp = (await import('sharp')).default;
  const W = 1800;
  const H = 1200;
  const raw = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 3;
      raw[k] = 170 + Math.round((60 * x) / W);
      raw[k + 1] = 117 + Math.round((60 * y) / H);
      raw[k + 2] = 46 + Math.round((40 * (x + y)) / (W + H));
    }
  await sharp(raw, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 80 }).toFile(join(tmp, 'photos/lieux/comptoir.jpg'));
  const log = execFileSync('node', [join(root, 'scripts/photos.mjs'), '--entree', join(tmp, 'photos'), '--sortie', join(tmp, 'public'), '--force', '--strict'], { cwd: root, encoding: 'utf8' });
  process.stdout.write(log);
  const profil = JSON.parse(readFileSync(join(tmp, `public/bouteilles/${SLUG}/profil.json`), 'utf8'));
  check('Fond retiré, ombre comprise', /fond|blanc|uni/i.test(profil.fond || ''), profil.fond);
  check('Bouteille redressée (2° attendus)', Math.abs(Math.abs(profil.redressement || 0) - 2) < 0.8, `${profil.redressement}°`);
  check('Profil de 181 points', profil.points?.length === 181);
  for (const f of ['face.webp', 'profil.json', 'vignette.webp']) check(`Sortie ${f}`, existsSync(join(tmp, `public/bouteilles/${SLUG}/${f}`)));
  check('Photo de lieu : 1 600 et 800 px', existsSync(join(tmp, 'public/lieux/comptoir-1600.webp')) && existsSync(join(tmp, 'public/lieux/comptoir-800.webp')));

  // ---------- 3. La bouteille 3D reconstruite, sur la fiche produit ----------
  rmSync(join(root, 'public/bouteilles'), { recursive: true, force: true });
  rmSync(join(root, 'public/lieux'), { recursive: true, force: true });
  cpSync(join(tmp, 'public/bouteilles'), join(root, 'public/bouteilles'), { recursive: true });
  cpSync(join(tmp, 'public/lieux'), join(root, 'public/lieux'), { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => sessionStorage.setItem('blachere-age', 'sirops'));
  const p2 = await ctx.newPage();
  await p2.goto(`http://localhost:${PORT}/boutique/${SLUG}?test`, { waitUntil: 'networkidle' });
  await p2.waitForFunction(() => window.__viewer && document.querySelector('#stage')?.classList.contains('is-live'), null, { timeout: 90000 });
  await p2.waitForTimeout(2500);
  const source = await p2.evaluate(() => ({ text: document.querySelector('#source')?.textContent || '', kind: window.__viewer.kind }));
  check('La fiche utilise la photo (bouteille reconstruite)', /photo/.test(source.text) && source.kind !== 'dessinée', `${source.kind} · ${source.text}`);
  for (const [name, a] of [['face', 0], ['profil', Math.PI / 2], ['dos', Math.PI], ['trois-quarts', -0.6]]) {
    await p2.evaluate((x) => window.__viewer.setAngle(x), a);
    await p2.waitForTimeout(1800);
    await p2.locator('#stage').screenshot({ path: join(SHOTS, `pipeline-3d-${name}.png`) });
  }
  const pb = await ctx.newPage();
  await pb.goto(`http://localhost:${PORT}/boutique?gamme=pac&test`, { waitUntil: 'networkidle' });
  await pb.waitForTimeout(1500);
  const card = await pb.evaluate((slug) => document.querySelector(`.card[data-slug="${slug}"] img.thumb`)?.getAttribute('src') || '', SLUG);
  check('Boutique : la carte affiche la vignette tirée de la photo', /vignette\.webp/.test(card), card);
  await pb.close();
  const p3 = await ctx.newPage();
  await p3.goto(`http://localhost:${PORT}/la-maison?test`, { waitUntil: 'networkidle' });
  await p3.waitForTimeout(1500);
  const img = await p3.evaluate(() => document.querySelector('img.lieu-photo')?.getAttribute('src') || '');
  check('Page « La maison » : la photo de lieu remplace le cadre', /comptoir-1600\.webp/.test(img), img);
  await p3.locator('#lieu').screenshot({ path: join(SHOTS, 'pipeline-lieu-la-maison.png') });
  await ctx.close();
} catch (err) {
  failed = true;
  console.error(err);
} finally {
  // ---------- 4. Nettoyage ----------
  await browser.close();
  await server.close();
  rmSync(tmp, { recursive: true, force: true });
  rmSync(harnessDir, { recursive: true, force: true });
  execFileSync('node', [join(root, 'scripts/photos.mjs'), '--force'], { cwd: root, stdio: 'ignore' });
  if (cacheBackup) writeFileSync(cacheFile, cacheBackup);
  else rmSync(cacheFile, { force: true });
  console.log(`Nettoyé : dossier temporaire supprimé, public/bouteilles et public/lieux régénérés depuis photos/.`);
}
const ko = failed || results.some((r) => !r.ok);
console.log(`${results.filter((r) => r.ok).length}/${results.length} vérifications réussies · captures dans ${SHOTS}`);
process.exit(ko ? 1 : 0);
