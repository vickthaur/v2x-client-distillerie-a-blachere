import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
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
  proApp: 'pro.html',
  crm: 'crm.html',
  contact: 'contact.html',
  mentions: 'mentions-legales.html',
  cgv: 'conditions-de-vente.html',
  introuvable: '404.html',
};

// Adresse propre → fichier (/boutique/<slug> → produit.html, /crm/… → crm.html et
// /espace-pro/… → pro.html sont traités à part).
const clean = Object.fromEntries(
  Object.values(pages)
    .filter((f) => !['404.html', 'produit.html', 'pro.html'].includes(f))
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
    if (!target && /^\/crm\/.+/.test(p)) target = 'crm.html';
    if (!target && /^\/espace-pro\/.+/.test(p)) target = 'pro.html';
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

// API en développement et en prévisualisation : /api/<nom> → api/<nom>.js, appelé comme sur Vercel
// (gestionnaire Web Request → Response, un export par méthode HTTP). Sans BLOB_READ_WRITE_TOKEN,
// le serveur range ses données dans .data/ (pilote fs).
const HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'content-length', 'upgrade', 'expect']);
function apiRoutes() {
  const handle = (load) => async (req, res, next) => {
    const m = req.url.match(/^\/api\/([a-z][a-z-]*)\/?(?:\?|$)/);
    if (!m) return next();
    const json = (status, body) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(body));
    };
    const file = resolve(__dirname, 'api', `${m[1]}.js`);
    if (!existsSync(file)) return json(404, { erreur: 'Adresse inconnue.' });
    try {
      const mod = await load(file);
      const fn = mod[req.method] ?? (req.method === 'HEAD' ? mod.GET : undefined);
      if (typeof fn !== 'function') return json(405, { erreur: 'Méthode non prise en charge.' });
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (v === undefined || HOP.has(k) || k.startsWith(':')) continue;
        headers.set(k, Array.isArray(v) ? v.join(', ') : v);
      }
      const hasBody = !['GET', 'HEAD'].includes(req.method) && chunks.length > 0;
      const request = new Request(`http://${req.headers.host || 'localhost'}${req.url}`, {
        method: req.method,
        headers,
        body: hasBody ? Buffer.concat(chunks) : undefined,
      });
      const response = await fn(request);
      res.statusCode = response.status;
      response.headers.forEach((v, k) => {
        if (k !== 'set-cookie') res.setHeader(k, v);
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length) res.setHeader('Set-Cookie', cookies);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (e) {
      console.error(e);
      if (!res.headersSent) json(500, { erreur: 'Erreur interne du serveur de développement.' });
    }
  };
  return {
    name: 'blachere-api',
    configureServer(server) {
      server.middlewares.use(handle((file) => server.ssrLoadModule(file)));
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle((file) => import(pathToFileURL(file).href)));
    },
  };
}

export default defineConfig({
  appType: 'mpa',
  plugins: [apiRoutes(), partials(), cleanUrls()],
  // JSX (CRM et espace pro) compilé pour Preact.
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
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
