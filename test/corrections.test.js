// Textes du site : typographie française (src/lib/typo.js) et corrections des textes repris du site
// officiel (src/data/corrections.js), appliquées au chargement des données, côté site.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { typo, espacesOrdinaires } from '../src/lib/typo.js';
import { fold } from '../src/lib/dom.js';
import { EPIGRAPHES, FICHES, HISTOIRE, LEGAL, PARTOUT, TITRES_PRESSE, TITRES_RECETTES, corrigerFiche, corrigerRecette, corrigerTextes, nettoyer, remplacer } from '../src/data/corrections.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const json = (f) => JSON.parse(readFileSync(join(root, f), 'utf8'));
const catalogue = json('src/data/catalogue.json').produits;
const recettes = json('src/data/site/recettes.json').recettes;
const textes = json('src/data/site/textes.json');

const NB = '\u00a0';
const FINE = '\u202f';
const CHAMPS = ['description', 'ingredients', 'nutrition', 'application', 'saviezVous'];

test('typo : espaces insécables du français, idempotente', () => {
  const cas = [
    ['Liqueur de lavande « A. Blachère® »', `Liqueur de lavande «${NB}A.${NB}Blachère®${NB}»`],
    ['70 cl · 1,75 L · Coffret · 43 % vol.', `70${NB}cl · 1,75${NB}L · Coffret · 43${FINE}%${NB}vol.`],
    ['Dilution : 1 volume', `Dilution${NB}: 1 volume`],
    ['Une merveille!', `Une merveille${FINE}!`],
    ['Le saviez-vous ? Oui ; non', `Le saviez-vous${FINE}? Oui${FINE}; non`],
    ['Sirop 100% naturel', `Sirop 100${FINE}% naturel`],
    ['500 000 € et 6 000 bouteilles', `500${FINE}000${NB}€ et 6${FINE}000 bouteilles`],
    ['1h30 à 90°C, 125g, 2cl', `1${NB}h${NB}30 à 90${NB}°C, 125${NB}g, 2${NB}cl`],
    ['J.-C. Blachère, n°59-107', `J.-C.${NB}Blachère, n°${NB}59-107`],
  ];
  for (const [avant, apres] of cas) {
    assert.equal(typo(avant), apres, avant);
    assert.equal(typo(apres), apres, `idempotente : ${avant}`);
  }
  // ni les heures, ni les adresses, ni les minutes ou les gouttes, ni le degré d'un pastis
  for (const s of ['à 10:30', 'https://exemple.fr/boutique?q=pac', '5 minutes, 3 gouttes', '45° pas moins', '04 90 83 55 65']) assert.equal(typo(s), s, s);
  assert.equal(espacesOrdinaires(`70${NB}cl, 6${FINE}000`), '70 cl, 6 000');
});

test('recherche : un nom avec insécables se trouve en tapant des espaces ordinaires', () => {
  assert.ok(fold(typo('Crème de myrtille « L’Ardéchoise® »')).includes(fold('myrtille « l’ardechoise')));
  assert.ok(fold(typo('Pastis « Marra® » 70 cl')).includes('70 cl'));
});

// Une correction dont le texte d'origine a disparu (texte changé sur le site officiel, nouvel
// import) ne s'applique plus : la signaler pour mettre la table à jour.
test('chaque correction trouve encore son texte d’origine', () => {
  const lignes = (r) => [r.ingredients, r.decoration, r.preparation, r.notes].flat().filter(Boolean);
  const tous = [
    ...catalogue.flatMap((c) => CHAMPS.map((k) => c[k]).filter(Boolean)),
    ...recettes.flatMap((r) => [TITRES_RECETTES[r.titre] ?? r.titre, ...lignes(r)]),
    textes.histoire.epigraphe,
    ...textes.histoire.periodes.flatMap((p) => p.paragraphes),
    ...textes.presse.map((a) => TITRES_PRESSE[a.titre] ?? a.titre),
    ...textes.cgv.sections.flatMap((s) => s.paragraphes),
    ...textes.mentions.texte,
  ];
  const trouve = (t, avant) => (avant instanceof RegExp ? new RegExp(avant.source, avant.flags.replace('g', '')).test(t) : t.includes(avant));
  // corrections communes, appliquées dans l'ordre de la table
  const vues = new Set();
  for (const brut of tous) {
    let t = nettoyer(brut);
    PARTOUT.forEach(([avant, apres], i) => {
      if (trouve(t, avant)) vues.add(i);
      t = remplacer(t, [[avant, apres]]);
    });
  }
  assert.deepEqual(PARTOUT.filter((_, i) => !vues.has(i)).map(([avant]) => String(avant)), [], 'PARTOUT');
  // corrections propres à une fiche, à l'histoire, aux textes légaux
  const propres = (textesBruts, table, nom) => {
    const vus = new Set();
    for (const brut of textesBruts) {
      let t = remplacer(nettoyer(brut), PARTOUT);
      table.forEach(([avant, apres], i) => {
        if (trouve(t, avant)) vus.add(i);
        t = remplacer(t, [[avant, apres]]);
      });
    }
    assert.deepEqual(table.filter((_, i) => !vus.has(i)).map(([avant]) => String(avant)), [], nom);
  };
  for (const [slug, champs] of Object.entries(FICHES)) {
    const c = catalogue.find((x) => x.slug === slug);
    assert.ok(c, `fiche ${slug}`);
    for (const [k, table] of Object.entries(champs)) propres([c[k] || ''], table, `${slug}.${k}`);
  }
  propres(textes.histoire.periodes.flatMap((p) => p.paragraphes), HISTOIRE, 'HISTOIRE');
  propres([...textes.cgv.sections.flatMap((s) => s.paragraphes), ...textes.mentions.texte], LEGAL, 'LEGAL');
  // titres remplacés en entier
  const titres = new Set(recettes.map((r) => r.titre));
  assert.deepEqual(Object.keys(TITRES_RECETTES).filter((t) => !titres.has(t)), [], 'TITRES_RECETTES');
  const presse = new Set(textes.presse.map((a) => a.titre));
  assert.deepEqual(Object.keys(TITRES_PRESSE).filter((t) => !presse.has(t)), [], 'TITRES_PRESSE');
  assert.deepEqual(Object.keys(EPIGRAPHES), [textes.histoire.epigraphe], 'EPIGRAPHES');
});

test('textes corrigés : ni capitales criardes, ni guillemets droits, ni espaces ordinaires avant la ponctuation', () => {
  const t = corrigerTextes(textes);
  const affiches = [
    ...catalogue.flatMap((c) => CHAMPS.map((k) => corrigerFiche(c)[k]).filter(Boolean).map((x) => [c.slug, x])),
    ...recettes.flatMap((r) => {
      const x = corrigerRecette(r);
      return [x.titre, ...[x.ingredients, x.decoration, x.preparation, x.notes].flat().filter(Boolean)].map((l) => [x.id, l]);
    }),
    ['épigraphe', t.histoire.epigraphe],
    ...t.histoire.periodes.flatMap((p) => p.paragraphes.map((x) => [p.titre, x])),
    ...t.presse.map((a) => ['presse', `${a.date} ${a.titre}`]),
    ...t.cgv.sections.flatMap((s) => s.paragraphes.map((x) => [s.titre, x])),
    ...t.mentions.texte.map((x) => ['mentions', x]),
  ];
  // sigles gardés en capitales
  const SIGLES = new Set(['PAC', 'PACA', 'OGM', 'USA', 'BD', 'DB', 'CGV', 'TVA', 'TTC', 'SARL', 'SIRET', 'RGPD', 'IMCA', 'II', 'VI', 'XIVe', 'XVIIIe']);
  const fautes = [];
  for (const [ou, x] of affiches) {
    const capitales = (x.match(/(?<![\p{L}])\p{Lu}{2,}(?![\p{L}])/gu) || []).filter((m) => !SIGLES.has(m));
    if (capitales.length) fautes.push(`${ou} : capitales ${capitales.join(', ')}`);
    if (/["“”]|\.\.\.|[ ][:;!?](?=\s|$)|« | »|\d(?:cl|ml|g)(?!\p{L})|(?:^|[.!?]\s)A [a-zé]|\(lien/u.test(x)) fautes.push(`${ou} : ${x.slice(0, 120)}`);
  }
  assert.deepEqual(fautes, []);
  // la citation de la page Histoire, les titres de recettes et de presse en casse de phrase
  assert.equal(t.histoire.epigraphe, `«${NB}Où vas-tu, Comtadine fière${FINE}? Je vais au Ventoux cueillir des fleurs pour la liqueur que fait Blachère.${NB}»`);
  assert.equal(corrigerRecette(recettes.find((r) => r.titre === 'BLUE MOJITO SANS ALCOOL')).titre, 'Blue Mojito sans alcool');
  assert.ok(t.presse.some((a) => a.titre === `Ici Vaucluse, le saviez-vous${FINE}?` && a.date === '7 mai 2026'));
  assert.ok(corrigerFiche(catalogue.find((c) => c.slug === 'pac-citron')).description.startsWith(`Le sirop de citron ultime${FINE}!`));
});

// Le site affiche les textes corrigés, le serveur garde les textes officiels (son catalogue est
// généré depuis produitsOfficiels : test/catalogue.test.js).
test('catalogue du site : prix « 6,70 € », noms insécables, recherche ; le serveur garde les textes officiels', async () => {
  const res = await build({
    stdin: { contents: "export * from './src/data/products.js'; export { matches, emptyState } from './src/lib/filters.js';", resolveDir: root, loader: 'js' },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    loader: { '.json': 'json' },
    logLevel: 'silent',
  });
  const m = await import(`data:text/javascript;base64,${Buffer.from(res.outputFiles[0].text).toString('base64')}`);
  assert.equal(m.euro(6.7), `6,70${NB}€`);
  assert.equal(m.prixAuLitreTexte({ prix: 6, ml: 700 }), `8,57${NB}€ le litre`);
  const lavande = m.bySlug['liqueur-de-lavande'];
  assert.equal(lavande.nom, `Liqueur de lavande «${NB}A.${NB}Blachère®${NB}»`);
  assert.equal(lavande.contenances[0].volume, `50${NB}cl`);
  const officiel = m.produitsOfficiels.find((p) => p.slug === 'liqueur-de-lavande');
  assert.equal(officiel.nom, 'Liqueur de lavande « A. Blachère® »');
  assert.equal(officiel.contenances[0].volume, '50 cl');
  assert.equal(m.produitsOfficiels.find((p) => p.slug === 'pastis-marra').phrase, '45° pas moins ! Nous faisons du vrai PASTIS…');
  assert.equal(m.bySlug['pastis-marra'].phrase, `45° pas moins${FINE}! Nous faisons du vrai pastis…`);
  // la boutique trouve « lavande « A. Blachère » » tapé avec des espaces ordinaires
  assert.ok(m.matches(lavande, { ...m.emptyState(), q: 'lavande « a. blachère' }));
});
