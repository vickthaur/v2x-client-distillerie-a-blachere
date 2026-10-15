#!/usr/bin/env node
// Inventaire du texte à traduire (versions anglaise et allemande) : mots par source.
// - HTML des pages et des partials (texte visible, attributs alt, aria-label, placeholder, title,
//   meta description) ;
// - données : src/data/catalogue.json, src/data/site/*.json (chaînes de texte, hors adresses, slugs,
//   identifiants), src/data/products.js et src/data/site.js (chaînes littérales) ;
// - chaînes en dur dans le JavaScript des pages et des modules communs (littéraux et gabarits).
// Le décompte est approché (mots contenant au moins une lettre).
//   AUDIT_TOOLS=<node_modules avec acorn et acorn-walk> node scripts/audit/i18n.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT, OUT, tool } from './lib.mjs';

const acorn = tool('acorn');
const walk = tool('acorn-walk');
const words = (s) => (String(s).match(/[\p{L}][\p{L}\p{N}’'-]*/gu) || []).length;
const isProse = (s) => /\p{L}{2,}/u.test(s) && !/^(https?:|\/|#|\.|[a-z0-9-]+$|[a-z0-9_-]+(\s[a-z0-9_-]+)*$)/.test(s.trim()) && !/^[\s\w-]*--[\w-]/.test(s);

// ---------- HTML ----------
const pages = readdirSync(ROOT).filter((f) => f.endsWith('.html') && !['crm.html', 'pro.html', 'contact.html'].includes(f));
const partials = readdirSync(join(ROOT, 'src/partials')).filter((f) => f.endsWith('.html')).map((f) => join('src/partials', f));
function htmlWords(file) {
  let s = readFileSync(join(ROOT, file), 'utf8');
  s = s.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  const attrs = [...s.matchAll(/\b(?:alt|aria-label|placeholder|title|content)="([^"]*)"/g)].map((m) => m[1]).filter((v) => isProse(v) && !/^(width=|#|noindex|fr_FR|website)/.test(v));
  const text = s.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;|&#\d+;/g, ' ');
  return { texte: words(text), attributs: attrs.reduce((n, v) => n + words(v), 0) };
}
const html = Object.fromEntries([...pages, ...partials].map((f) => [f, htmlWords(f)]));

// ---------- Données JSON ----------
const SKIP_KEYS = /^(slug|id|url|urlEn|image|fichier|source|_source|gamme|categorie|rubrique|aile|type|ml|v|reference|disponibilite|produits|largeur|hauteur|idSite|profil|face|dos|vignette|corps|photo|etiquette|etiquetteDos)$/;
function jsonWords(value, key = '') {
  if (typeof value === 'string') return SKIP_KEYS.test(key) || !isProse(value) ? 0 : words(value);
  if (Array.isArray(value)) return value.reduce((n, v) => n + jsonWords(v, key), 0);
  if (value && typeof value === 'object') return Object.entries(value).reduce((n, [k, v]) => n + jsonWords(v, k), 0);
  return 0;
}
const dataFiles = ['src/data/catalogue.json', 'src/data/site/textes.json', 'src/data/site/recettes.json', 'src/data/site/archives.json'];
const data = Object.fromEntries(dataFiles.map((f) => [f, jsonWords(JSON.parse(readFileSync(join(ROOT, f), 'utf8')))]));
// détail du catalogue par champ
const cat = JSON.parse(readFileSync(join(ROOT, 'src/data/catalogue.json'), 'utf8')).produits;
const parChamp = {};
for (const p of cat) for (const [k, v] of Object.entries(p)) if (typeof v === 'string' && !SKIP_KEYS.test(k) && isProse(v)) parChamp[k] = (parChamp[k] || 0) + words(v);

// ---------- JavaScript ----------
function jsFiles(dir) {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? jsFiles(join(dir, d.name)) : /\.js$/.test(d.name) ? [join(dir, d.name)] : []));
}
const js = {};
for (const f of [...jsFiles('src/pages'), ...jsFiles('src/app'), ...jsFiles('src/lib'), 'src/data/products.js', 'src/data/site.js']) {
  if (/\/(contact|pro)\.js$/.test(f)) continue;
  const src = readFileSync(join(ROOT, f), 'utf8');
  let ast;
  try {
    ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
  } catch (e) {
    js[f] = { erreur: e.message };
    continue;
  }
  let n = 0;
  let strings = 0;
  const add = (s) => {
    // gabarits HTML : on retire les balises et les interpolations
    const t = s.replace(/<[^>]*>/g, ' ').replace(/\$\{[^}]*\}/g, ' ');
    if (!isProse(t) || /^\s*[\w-]+(\s[\w-]+)*\s*$/.test(t) && !/\s/.test(t.trim())) return;
    if (/^[\s.#[\]:>*,()='"\w-]+$/.test(t) && !/\s\p{L}{3,}\s/u.test(t)) return; // sélecteurs, classes
    n += words(t);
    strings += 1;
  };
  walk.full(ast, (node) => {
    if (node.type === 'Literal' && typeof node.value === 'string') add(node.value);
    if (node.type === 'TemplateElement') add(node.value.cooked || '');
  });
  js[relative(ROOT, join(ROOT, f))] = { mots: n, chaines: strings };
}

const total = (o, k) => Object.values(o).reduce((s, x) => s + (typeof x === 'number' ? x : x[k] || 0), 0);
const out = {
  html,
  totalHtml: total(html, 'texte') + total(html, 'attributs'),
  donnees: data,
  catalogueParChamp: parChamp,
  totalDonnees: Object.values(data).reduce((a, b) => a + b, 0),
  js,
  totalJs: total(js, 'mots'),
};
writeFileSync(join(OUT, 'i18n.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
