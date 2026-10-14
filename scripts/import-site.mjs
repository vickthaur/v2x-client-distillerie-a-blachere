#!/usr/bin/env node
// Import du site officiel de la distillerie (récupération du 14 octobre 2026, branche « photos-site »,
// à ouvrir dans un worktree séparé : la branche fait 262 Mo et ne doit pas entrer dans main).
//
//   git worktree add /home/user/blachere-photos-site origin/photos-site
//   node scripts/import-site.mjs [--source /home/user/blachere-photos-site/photos/site]
//
// Ce script ne copie que ce dont le site a besoin, réduit et compressé :
// - src/data/catalogue.json        : les 63 produits officiels (noms, rubriques, contenances et prix TTC,
//                                    degrés, descriptions et ingrédients exacts, références), source de
//                                    vérité de la boutique ; la recherche ne sert plus qu'en secours ;
// - photos/produits/<slug>.webp    : le packshot détouré principal de chaque produit (→ bouteilles 3D) ;
// - photos/etiquettes/<slug>.webp  : l'étiquette à plat (fichier du site) des sirops, posée nette sur la 3D ;
// - photos/lieux/                  : la boutique, le stand d'archive du Palais des Papes ;
// - public/archives/ + src/data/site/archives.json : étiquettes anciennes, documents, affiches ;
// - public/recettes/ + src/data/site/recettes.json : les recettes officielles et leurs photos ;
// - src/data/site/textes.json      : histoire, contact et horaires, conditions de vente et de livraison,
//                                    mentions légales, liste « On parle de nous » (titres et liens, pas
//                                    d'images de presse : leurs droits appartiennent aux journaux) ;
// - public/logos/                  : les logos SVG officiels (et une version blanche pour les visuels).
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const SRC = resolve(opt('source', '/home/user/blachere-photos-site/photos/site'));
if (!existsSync(join(SRC, 'catalogue-site.json'))) {
  console.error(`Dossier introuvable : ${SRC} (ouvrir d'abord le worktree de la branche photos-site).`);
  process.exit(1);
}
const sharp = (await import('sharp')).default;
const log = (...a) => console.log('[site]', ...a);
const readJSON = (f) => JSON.parse(readFileSync(f, 'utf8'));
const writeJSON = (f, d) => {
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, `${JSON.stringify(d, null, 1)}\n`);
};

// ---------------------------------------------------------------- produits

// id_site → slug de la maquette (les adresses /boutique/<slug> déjà en place sont gardées).
const SLUGS = {
  12: 'sirop-couleur-provence-orgeat',
  13: 'sirop-banane',
  16: 'pastis-marra',
  17: 'pastis-le-camarguais',
  40: 'sirop-citron',
  41: 'sirop-fraise',
  42: 'sirop-melon',
  44: 'sirop-framboise',
  45: 'sirop-anis',
  46: 'sirop-chataigne',
  47: 'sirop-peche',
  48: 'sirop-orange',
  49: 'sirop-couleur-provence-grenadine',
  50: 'sirop-menthe',
  51: 'sirop-cassis',
  52: 'sirop-couleur-provence-cola',
  53: 'sirop-passion',
  54: 'sirop-vanille',
  55: 'sirop-lavande',
  56: 'sirop-caramel',
  57: 'sirop-couleur-provence-violette',
  58: 'sirop-fraise-barbe-a-papa',
  59: 'sirop-pomme',
  60: 'sirop-couleur-provence-kiwi',
  61: 'sirop-couleur-provence-reglisse',
  62: 'sirop-couleur-provence-figue',
  63: 'sucre-de-canne',
  93: 'liqueur-de-lavande',
  95: 'sirop-caramel-fleur-de-sel-camargue',
  115: 'aperitif-a-l-olive-bronzini',
  116: 'origan-du-comtat',
  117: 'elixir-du-mont-ventoux',
  118: 'la-comtadine',
  119: 'la-magistrale',
  120: 'verveine-l-ardechoise',
  121: 'creme-de-chataigne',
  123: 'creme-de-myrtille',
  124: 'creme-de-framboise',
  125: 'vieux-marc-de-provence-gros-calan',
  126: 'marc-chateauneuf-du-pape-reserve-des-legats',
  127: 'eau-de-vie-poire-williams-flirt',
  131: 'la-camarguaise',
  132: 'verveine-auguste-vieilli',
  134: 'aperitif-lou-gardian',
  137: 'la-camarguaise-luxe',
  156: 'creme-de-cassis',
  158: 'pac-citron',
  159: 'fun-blue',
};
const slugify = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/®/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
function slugOf(p) {
  if (SLUGS[p.id_site]) return SLUGS[p.id_site];
  const mil = String(p.nom).match(/ELIXIR.*MILLESIME\s+(\d{4})/i);
  if (mil) return `marc-elixir-millesime-${mil[1]}`;
  return slugify(p.nom);
}

// « 70 CL » → 700, « 1.75 L » → 1750 ; « Coffrets » → null (format coffret)
function ml(volume) {
  const m = String(volume).toLowerCase().replace(',', '.').match(/([\d.]+)\s*(ml|cl|l)\b/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Math.round(m[2] === 'l' ? n * 1000 : m[2] === 'cl' ? n * 10 : n);
}
const prix = (s) => {
  const m = String(s || '').replace(/\s/g, '').match(/([\d]+[,.]\d+|\d+)/);
  return m ? Math.round(parseFloat(m[1].replace(',', '.')) * 100) / 100 : null;
};
const degre = (s) => {
  const m = String(s || '').match(/([\d]+(?:[.,]\d+)?)\s*%/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
};
const volumeLabel = (v) => {
  const n = ml(v);
  if (n === null) return /coffret/i.test(v) ? 'Coffret' : String(v).trim();
  if (n >= 1000) return `${String(n / 1000).replace('.', ',')} L`;
  return `${n / 10} cl`;
};

// Rubrique officielle → gamme de la boutique de la maquette.
function gammeOf(p) {
  if (p.id_site === 158) return 'pac';
  if (p.id_site === 159) return 'fun-blue';
  if (p.categorie !== 'Alcools') return 'couleur-provence';
  const g = String(p.gamme || '');
  if (/Apéritifs et Pastis/i.test(g)) return 'pastis-aperitifs';
  if (/Liqueurs/i.test(g)) return 'liqueurs';
  if (/Crèmes et Eaux de Vie/i.test(g)) return 'cremes-eaux-de-vie';
  if (/Vieux Marc/i.test(g)) return 'marcs';
  return 'liqueurs';
}

// Meilleures ventes affichées sur la page d'accueil officielle (pages/accueil.md).
const BEST = new Set([158, 159, 49, 131, 117, 93]);
// Flacons non tournés (carafe carrée et étui des millésimes « Elixir® ») : photo à plat, pas de 3D tournée.
const PLATS = new Set([136, 139, 140, 141, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 137]);

const site = readJSON(join(SRC, 'catalogue-site.json'));
const produits = site.map((p) => {
  const slug = slugOf(p);
  const contenances = (p.contenances || []).map((c) => {
    const n = ml(c.volume);
    return { id: n !== null ? String(n) : slugify(c.volume) || 'format', volume: volumeLabel(c.volume), ml: n, prix: prix(c.prix_ttc), coffret: n === null && /coffret/i.test(c.volume) };
  });
  const r = p.autres_rubriques || {};
  return {
    slug,
    idSite: p.id_site,
    nomOfficiel: p.nom.replace(/\s+/g, ' ').trim(),
    categorie: p.categorie === 'Alcools' ? 'Alcools' : 'Sirops',
    rubrique: p.gamme || (p.categorie === 'Alcools' ? null : p.categorie === 'Sirops' ? 'Sirops' : p.categorie),
    gamme: gammeOf(p),
    contenances,
    degre: degre(p.degre),
    description: p.description || null,
    ingredients: p.ingredients || null,
    nutrition: r['Valeurs Nutritionnelles'] || null,
    application: r.Application || null,
    saviezVous: r['Le saviez-vous ?'] || null,
    reference: p.reference || null,
    url: p.url,
    urlEn: p.url_en || null,
    bestSeller: BEST.has(p.id_site),
    plat: PLATS.has(p.id_site),
    disponibilite: 'en-ligne',
    source: 'site officiel, relevé du 14 octobre 2026',
  };
});
const dup = produits.map((p) => p.slug).filter((s, i, a) => a.indexOf(s) !== i);
if (dup.length) throw new Error(`slugs en double : ${dup.join(', ')}`);
writeJSON(join(root, 'src/data/catalogue.json'), {
  _source: 'Site officiel distillerieablachere.com, catalogue relevé le 14 octobre 2026 (photos/site/catalogue-site.json de la branche photos-site). Généré par scripts/import-site.mjs : ne pas modifier à la main.',
  produits,
});
log(`catalogue : ${produits.length} produits (${produits.filter((p) => p.categorie === 'Sirops').length} sirops, ${produits.filter((p) => p.categorie === 'Alcools').length} alcools)`);

// ---------------------------------------------------------------- images produits

async function toWebp(src, dest, { max = 1600, quality = 90, alpha = true, lossless = false } = {}) {
  mkdirSync(dirname(dest), { recursive: true });
  let img = sharp(src, { failOn: 'none' }).rotate();
  const meta = await img.metadata();
  const big = Math.max(meta.width, meta.height);
  if (big > max) img = img.resize({ width: meta.width >= meta.height ? max : null, height: meta.height > meta.width ? max : null, kernel: 'lanczos3' });
  if (!alpha) img = img.flatten({ background: '#ffffff' });
  await img.webp({ quality, alphaQuality: 100, effort: 5, lossless }).toFile(dest);
}

const prodDir = join(root, 'photos/produits');
const labelDir = join(root, 'photos/etiquettes');
for (const f of existsSync(prodDir) ? readdirSync(prodDir) : []) if (!f.startsWith('.') && !f.endsWith('.json')) rmSync(join(prodDir, f)); // réglages <slug>.json et plats.json conservés
for (const f of existsSync(labelDir) ? readdirSync(labelDir) : []) if (!f.startsWith('.')) rmSync(join(labelDir, f));
let nP = 0;
let nL = 0;
for (const p of site) {
  const slug = slugOf(p);
  const imgs = (p.images || []).filter((x) => x.startsWith('produits/'));
  if (!imgs.length) continue;
  await toWebp(join(SRC, imgs[0]), join(prodDir, `${slug}.webp`), { max: 1600, quality: 92 });
  nP++;
  // étiquettes à plat (sirops) : 2e image de la galerie = étiquette de face (ou tour complet pour
  // PAC Citron, Fun Blue et Cola), 3e image = contre-étiquette (dos) des Couleur Provence
  if (p.categorie !== 'Alcools' && imgs[1]) {
    for (const [img, suffix, type] of [
      [imgs[1], '', 'plat'],
      [imgs[2], '-dos', 'dos'],
    ]) {
      if (!img) continue;
      const src = join(SRC, img);
      // marges transparentes retirées (fichiers PNG détourés), puis fond blanc (papier)
      const hasAlpha = (await sharp(src, { failOn: 'none' }).metadata()).hasAlpha;
      const trimmed = hasAlpha ? await sharp(src, { failOn: 'none' }).trim({ threshold: 2 }).png().toBuffer() : readFileSync(src);
      const meta = await sharp(trimmed).metadata();
      await toWebp(trimmed, join(labelDir, `${slug}${suffix}.webp`), { max: 1200, quality: 86, alpha: false });
      writeJSON(join(labelDir, `${slug}${suffix}.json`), { type, largeur: meta.width, hauteur: meta.height, source: `${type === 'dos' ? 'Contre-étiquette' : 'Étiquette'} publiée sur la fiche officielle (${p.url}).` });
      nL++;
    }
  }
}
writeJSON(join(prodDir, 'plats.json'), { _note: 'Flacons non tournés : photo affichée à plat (pas de bouteille 3D tournée).', slugs: produits.filter((p) => p.plat).map((p) => p.slug) });
log(`packshots : ${nP} → photos/produits ; étiquettes à plat : ${nL} → photos/etiquettes`);

// ---------------------------------------------------------------- lieux

const lieuxDir = join(root, 'photos/lieux');
mkdirSync(lieuxDir, { recursive: true });
// La photo « boutique » du site est un montage de deux photos inclinées (+8° et −17°) : chacune est
// redressée et recadrée à l'intérieur de son cadre (la seconde recouvre un coin de la première).
{
  const src = join(SRC, 'lieux/boutique-de-la-distillerie-1.png');
  const isW = (d, i) => d[i] > 238 && d[i + 1] > 238 && d[i + 2] > 238;
  const straight = (angle) => sharp(src).flatten({ background: '#ffffff' }).rotate(angle, { background: '#ffffff' }).raw().toBuffer({ resolveWithObject: true });
  const scan = ({ data, info }) => {
    const { width: W, channels: C } = info;
    return {
      row: (y, x0, x1) => {
        let n = 0;
        for (let x = x0; x < x1; x++) if (!isW(data, (y * W + x) * C)) n++;
        return n / (x1 - x0);
      },
      col: (x, y0, y1) => {
        let n = 0;
        for (let y = y0; y < y1; y++) if (!isW(data, (y * W + x) * C)) n++;
        return n / (y1 - y0);
      },
      white: (x, y) => isW(data, (y * W + x) * C),
    };
  };
  rmSync(join(lieuxDir, 'boutique.jpg'), { force: true });
  {
    const img = await straight(-8);
    const { width: W, height: H } = img.info;
    const f = scan(img);
    let top = 0;
    while (top < H && f.row(top, Math.round(W * 0.1), Math.round(W * 0.6)) < 0.9) top++;
    let left = 0;
    while (left < W && f.col(left, top + 20, top + Math.round(H * 0.3)) < 0.9) left++;
    let right = W - 1;
    while (right > 0 && f.col(right, top + 10, top + Math.round(H * 0.12)) < 0.9) right--;
    let bottom = H - 1;
    while (bottom > 0 && f.row(bottom, left + 10, left + Math.round(W * 0.2)) < 0.9) bottom--;
    const inset = 6;
    await sharp(img.data, { raw: img.info })
      .extract({ left: left + inset, top: top + inset, width: Math.round((right - left) * 0.69) - inset, height: Math.round((bottom - top) * 0.82) - inset })
      .jpeg({ quality: 90 })
      .toFile(join(lieuxDir, 'boutique-salon.jpg'));
  }
  {
    const img = await straight(17);
    const { width: W, height: H } = img.info;
    const f = scan(img);
    let bottom = H - 1;
    while (bottom > 0 && f.row(bottom, Math.round(W * 0.4), Math.round(W * 0.8)) < 0.9) bottom--;
    let right = W - 1;
    while (right > 0 && f.col(right, bottom - Math.round(H * 0.3), bottom - 20) < 0.9) right--;
    let left = 0;
    while (left < W && f.col(left, bottom - Math.round(H * 0.2), bottom - 10) < 0.9) left++;
    let top = bottom - 10;
    while (top > 0 && [left + 6, left + 10, left + 14].some((x) => !f.white(x, top))) top--;
    top += 1;
    const inset = 6;
    await sharp(img.data, { raw: img.info })
      .extract({ left: left + inset, top: top + inset, width: right - left - 2 * inset, height: bottom - top - 2 * inset })
      .jpeg({ quality: 90 })
      .toFile(join(lieuxDir, 'boutique-rayons.jpg'));
  }
}
await sharp(join(SRC, 'lieux/stand-exposition-palais-des-papes-archive-1.png')).flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toFile(join(lieuxDir, 'stand-palais-des-papes.jpg'));
log('lieux : boutique (salon et rayons, redressés), stand du Palais des Papes');

// ---------------------------------------------------------------- archives

const ARCH = readJSON(join(root, 'scripts/archives-site.json'));
const archDir = join(root, 'public/archives');
rmSync(archDir, { recursive: true, force: true });
mkdirSync(archDir, { recursive: true });
const manifest = readJSON(join(SRC, 'manifest.json'));
const byFile = Object.fromEntries(manifest.map((e) => [e.fichier, e]));
const archives = [];
for (const a of ARCH.pieces) {
  const src = join(SRC, a.fichier);
  if (!existsSync(src)) {
    console.warn('[site] archive absente :', a.fichier);
    continue;
  }
  const id = a.id;
  const dest = join(archDir, `${id}.webp`);
  await toWebp(src, dest, { max: 1400, quality: 84, alpha: true });
  const meta = await sharp(dest).metadata();
  const m = byFile[a.fichier] || {};
  archives.push({ ...a, image: `/archives/${id}.webp`, largeur: meta.width, hauteur: meta.height, page: m.page_source || null });
}
writeJSON(join(root, 'src/data/site/archives.json'), { _source: 'Images publiées sur le site officiel (fiches produits, page Histoire) ; légendes V2X d’après ce qui se lit sur les pièces, dates seulement quand elles y figurent.', pieces: archives });
log(`archives : ${archives.length} pièces → public/archives`);

// ---------------------------------------------------------------- recettes

function parseRecette(md) {
  const lines = md.split('\n');
  const url = (lines.find((l) => l.startsWith('Source :')) || '').replace('Source :', '').trim();
  const body = md.split('\n---\n')[1] || '';
  const L = body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const stop = L.findIndex((l) => /^- Facebook/.test(l));
  const content = stop >= 0 ? L.slice(0, stop) : L;
  const titre = content[0];
  const sections = { ingredients: [], decoration: [], preparation: [], notes: [] };
  let cur = 'notes';
  for (const l of content.slice(1)) {
    if (/^Ingrédients/i.test(l)) cur = 'ingredients';
    else if (/^Décoration/i.test(l)) cur = 'decoration';
    else if (/^Préparation/i.test(l)) cur = 'preparation';
    else if (/^Régalez-vous/i.test(l)) cur = 'fin';
    else if (cur !== 'fin') sections[cur].push(l.replace(/^- /, ''));
  }
  // produits utilisés
  const after = stop >= 0 ? L.slice(stop) : [];
  const i0 = after.findIndex((l) => /PRODUIT\(S\) UTILISÉ/i.test(l));
  const produits = [];
  if (i0 >= 0)
    for (let i = i0 + 1; i < after.length; i++) {
      const l = after[i];
      if (/^Ajouter tous/i.test(l) || /^Recettes et cocktails/i.test(l)) break;
      if (/€/.test(l) || /^Loading|^Ajouter au panier/i.test(l)) continue;
      produits.push(l);
    }
  return { titre, url, ...sections, produitsNoms: produits };
}
const recDir = join(root, 'public/recettes');
rmSync(recDir, { recursive: true, force: true });
mkdirSync(recDir, { recursive: true });
const index = readFileSync(join(SRC, 'pages/recettes-index.md'), 'utf8');
const typeOf = {};
index.split('\n- ').forEach((chunk) => {
  const m = chunk.match(/^(Avec alcool|Sans alcool)\s*\n\s*\n?([^\n]+)/);
  if (m) typeOf[m[2].trim().toUpperCase()] = m[1] === 'Avec alcool' ? 'avec' : 'sans';
});
const nameToSlug = Object.fromEntries(produits.map((p) => [p.nomOfficiel.toUpperCase(), p.slug]));
const findSlug = (name) => {
  const n = name.replace(/\s+/g, ' ').trim().toUpperCase();
  if (nameToSlug[n]) return nameToSlug[n];
  const hit = produits.find((p) => n.includes(p.nomOfficiel.toUpperCase()) || p.nomOfficiel.toUpperCase().includes(n));
  return hit?.slug || null;
};
const recettes = [];
const seen = new Set();
for (const f of readdirSync(join(SRC, 'pages/recettes')).sort((a, b) => parseInt(a) - parseInt(b))) {
  const r = parseRecette(readFileSync(join(SRC, 'pages/recettes', f), 'utf8'));
  if (!r.titre || seen.has(r.titre.toUpperCase())) continue;
  seen.add(r.titre.toUpperCase());
  const id = slugify(r.titre);
  const img = manifest.find((e) => e.fichier.startsWith('autres/recettes/') && (e.alt || '').toUpperCase() === r.titre.toUpperCase());
  let image = null;
  if (img) {
    await toWebp(join(SRC, img.fichier), join(recDir, `${id}.webp`), { max: 1100, quality: 80, alpha: false });
    image = `/recettes/${id}.webp`;
  }
  const type = typeOf[r.titre.toUpperCase()] || (/SANS ALCOOL/i.test(r.titre) ? 'sans' : null);
  recettes.push({
    id,
    titre: r.titre,
    // type inconnu → traité « avec alcool » (réservé aux majeurs)
    alcool: type !== 'sans',
    ingredients: r.ingredients,
    decoration: r.decoration,
    preparation: r.preparation,
    notes: r.notes,
    produits: r.produitsNoms.map(findSlug).filter(Boolean),
    image,
    url: r.url,
  });
}
writeJSON(join(root, 'src/data/site/recettes.json'), { _source: 'Recettes et cocktails du site officiel (textes exacts), relevé du 14 octobre 2026.', recettes });
log(`recettes : ${recettes.length} (${recettes.filter((r) => r.image).length} avec photo, ${recettes.filter((r) => !r.alcool).length} sans alcool)`);

// ---------------------------------------------------------------- textes

const page = (f) => {
  const md = readFileSync(join(SRC, 'pages', f), 'utf8');
  return { url: (md.match(/^Source : (.+)$/m) || [])[1] || null, body: (md.split('\n---\n')[1] || '').trim() };
};
// Histoire : épigraphe, puis périodes (« 1835 - 1841 ») et leurs paragraphes.
const h = page('histoire.md');
const hl = h.body.split('\n').map((l) => l.trim()).filter(Boolean);
const histoire = { url: h.url, epigraphe: hl.find((l) => /^“/.test(l)) || null, periodes: [] };
for (const l of hl.slice(1)) {
  if (/^“/.test(l)) continue;
  if (/^\d{4}\s*-\s*(\d{4}|A nos jours)/i.test(l)) histoire.periodes.push({ titre: l.replace(/A nos jours/i, 'à nos jours'), paragraphes: [] });
  else histoire.periodes.at(-1)?.paragraphes.push(l);
}
// Contact et horaires (boutique ; bureaux et entrepôts)
const c = page('contact-acces.md');
const cl = c.body.split('\n').map((l) => l.trim()).filter(Boolean);
const iB = cl.findIndex((l) => /^BUREAUX/.test(l));
const contact = {
  url: c.url,
  boutique: { horaires: cl.slice(0, iB).filter((l) => /h\d\d|Hors jours/i.test(l)), tel: '04 90 83 55 65', email: 'magasin@distillerieablachere.com' },
  bureaux: { horaires: cl.slice(iB).filter((l) => /h\d\d|lundi|Hors jours/i.test(l)), tel: '04 90 83 53 81', email: 'info@distillerieablachere.com' },
  adresse: ['1695 route de Sorgues', 'Quartier Cansaud', '84230 Châteauneuf-du-Pape'],
};
// Conditions générales de vente : les paragraphes utiles à la boutique (titre → texte exact).
const g = page('cgv.md');
const TITRES = ['Objet du contrat', 'Informations légales', 'Présentation des produits', 'Zone géographique', 'Tarifs', 'Commandes', 'Modalité de paiement', 'Délais de rétractation : échange ou retour', 'Conditions d’échange et de retour pour remboursement', 'Expédition et livraison', 'Casse au cours de la livraison', 'Responsabilité', 'Relation clients – Service après-vente'];
const cgv = { url: g.url, sections: [] };
for (const l of g.body.split('\n').map((x) => x.trim()).filter(Boolean)) {
  if (TITRES.includes(l)) cgv.sections.push({ titre: l, paragraphes: [] });
  else if (cgv.sections.length) cgv.sections.at(-1).paragraphes.push(l.replace(/^LLes/, 'Les').replace(/^-\s*\*\s*/, ''));
}
// Mentions légales du site actuel
const ml2 = page('mentions-legales.md');
const mentions = { url: ml2.url, texte: ml2.body.split('\n').map((x) => x.trim()).filter(Boolean) };
// On parle de nous : titres, dates, adresses (articles et vidéos), sans images
const presse = [];
for (const f of readdirSync(join(SRC, 'pages/on-parle-de-nous')).sort()) {
  const md = readFileSync(join(SRC, 'pages/on-parle-de-nous', f), 'utf8');
  const url = (md.match(/^Source : (.+)$/m) || [])[1];
  const body = (md.split('\n---\n')[1] || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const date = (body.find((l) => /^- \d{1,2} \S+ \d{4}$/.test(l)) || '').replace(/^- /, '');
  const iT = body.findIndex((l) => l === '- |');
  const titre = iT >= 0 ? body[iT + 1] : (md.match(/^# (.+?) - Distillerie/m) || [])[1];
  presse.push({ type: f.startsWith('les-videos') ? 'video' : 'presse', titre, date, url });
}
const parseDate = (d) => {
  const M = { janvier: 1, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, août: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12 };
  const m = d.match(/(\d{1,2}) (\S+) (\d{4})/);
  return m ? Number(m[3]) * 10000 + (M[m[2]] || 0) * 100 + Number(m[1]) : 0;
};
presse.sort((a, b) => parseDate(b.date) - parseDate(a.date));
writeJSON(join(root, 'src/data/site/textes.json'), { _source: 'Textes exacts du site officiel, relevés le 14 octobre 2026 (photos/site/pages).', histoire, contact, cgv, mentions, presse });
log(`textes : histoire (${histoire.periodes.length} périodes), contact, CGV (${cgv.sections.length} sections), mentions, presse (${presse.length})`);

// ---------------------------------------------------------------- logos

const logoDir = join(root, 'public/logos');
mkdirSync(logoDir, { recursive: true });
// allègement sans perte visible : coordonnées arrondies au centième, noms de calques retirés
const slim = (svg) =>
  svg
    .replace(/<\?xml[^>]*>\s*/g, '')
    .replace(/<!DOCTYPE[^>]*>\s*/g, '')
    .replace(/\s(data-name|serif:id)="[^"]*"/g, '')
    .replace(/-?\d+\.\d{3,}/g, (n) => String(Math.round(Number(n) * 100) / 100))
    .replace(/>\s+</g, '><')
    .trim();
// version claire (texte blanc, or conservé) pour les fonds sombres et les visuels en couleur
const white = (svg) =>
  svg
    .replace(/fill:rgb\((34,34,33|35,35,35)\)/g, 'fill:rgb(255,255,255)')
    .replace(/fill="#1d1d1b"/gi, 'fill="#ffffff"');
for (const [from, to] of [
  ['logos/logo-1.svg', 'logo.svg'],
  ['logos/logo-scroll-1.svg', 'logo-provence.svg'],
  ['logos/logo-square-1.svg', 'blason.svg'],
]) {
  const svg = slim(readFileSync(join(SRC, from), 'utf8'));
  writeFileSync(join(logoDir, to), svg);
  if (to !== 'blason.svg') writeFileSync(join(logoDir, to.replace('.svg', '-blanc.svg')), white(svg));
}
rmSync(join(logoDir, 'blason-blanc.svg'), { force: true });
// favicon officiel (le blason doré), à pleine opacité pour rester lisible dans l'onglet
writeFileSync(
  join(root, 'public/favicon.svg'),
  slim(readFileSync(join(SRC, 'logos/favicon-1.svg'), 'utf8'))
    .replace(/\sopacity="0?\.\d+"/, '')
    .replace(/\sstyle="mix-blend-mode:[^"]*"/, ''),
);
log('logos : public/logos (+ versions blanches), favicon');
