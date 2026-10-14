import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Pages du site (Vite multi-pages). Les adresses propres (/boutique, /panier…) et les fiches
// produits (/boutique/<slug> → produit.html) sont réécrites ici en développement et en
// prévisualisation, et par vercel.json en production.
const pages = {
  main: 'index.html',
  pac: 'pac-citron.html',
  funblue: 'fun-blue.html',
  provence: 'couleur-provence.html',
  recettes: 'recettes.html',
  spiritueux: 'spiritueux.html',
  maison: 'la-maison.html',
  musee: 'musee.html',
  visiter: 'visiter.html',
  boutique: 'boutique.html',
  produit: 'produit.html',
  panier: 'panier.html',
  ouTrouver: 'ou-trouver.html',
  actualites: 'actualites.html',
  pro: 'espace-pro.html',
  mentions: 'mentions-legales.html',
  cgv: 'conditions-de-vente.html',
  introuvable: '404.html',
};

// Adresse propre → fichier (/boutique/<slug> → produit.html est traité à part).
const clean = Object.fromEntries(
  Object.values(pages)
    .filter((f) => f !== '404.html' && f !== 'produit.html')
    .map((f) => [f === 'index.html' ? '/' : `/${f.replace(/\.html$/, '')}`, f]),
);
// Ancienne adresse de la v1 (redirection 301 dans vercel.json).
clean['/la-distillerie'] = 'la-maison.html';

// <!-- @include header.html --> → contenu de src/partials/header.html (en-tête, pied de page,
// fenêtres communes) : un seul exemplaire pour toutes les pages, en HTML statique.
function partials() {
  const dir = resolve(__dirname, 'src/partials');
  const include = (html, depth = 0) =>
    html.replace(/<!--\s*@include\s+([\w.-]+)\s*-->/g, (_, name) => {
      const file = resolve(dir, name);
      if (!existsSync(file)) throw new Error(`Partial introuvable : ${name}`);
      return depth > 3 ? '' : include(readFileSync(file, 'utf8'), depth + 1);
    });
  return {
    name: 'blachere-partials',
    transformIndexHtml: { order: 'pre', handler: (html) => include(html) },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(dir)) server.ws.send({ type: 'full-reload' });
    },
  };
}

// Adresses propres en développement et en prévisualisation (même logique que vercel.json).
function cleanUrls() {
  const rewrite = (req) => {
    const [path, query] = req.url.split('?');
    const p = path.length > 1 ? path.replace(/\/$/, '') : path;
    let target = clean[p];
    if (!target && /^\/boutique\/[a-z0-9-]+$/.test(p)) target = 'produit.html';
    if (target) req.url = `/${target}${query ? `?${query}` : ''}`;
  };
  const notFound = (root) => (req, res, next) => {
    const accept = req.headers.accept || '';
    if (req.method !== 'GET' || !accept.includes('text/html')) return next();
    const file = resolve(root, '404.html');
    if (!existsSync(file)) return next();
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(readFileSync(file));
  };
  return {
    name: 'blachere-clean-urls',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewrite(req);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewrite(req);
        next();
      });
      return () => server.middlewares.use(notFound(resolve(__dirname, 'dist')));
    },
  };
}

export default defineConfig({
  appType: 'mpa',
  plugins: [partials(), cleanUrls()],
  server: { port: 5173 },
  preview: { port: 4173 },
  build: {
    target: 'es2020',
    outDir: 'dist',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: Object.fromEntries(Object.entries(pages).map(([k, f]) => [k, resolve(__dirname, f)])),
      output: {
        // Three.js dans son propre fichier : mis en cache séparément, chargé après le reste de la page.
        manualChunks: { three: ['three'] },
      },
    },
  },
});
