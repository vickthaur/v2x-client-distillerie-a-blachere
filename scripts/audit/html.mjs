#!/usr/bin/env node
// Validité HTML (html-validate, règles recommandées) des pages construites (dist/*.html) et du DOM
// rendu après JavaScript (OUT/rendu/*.html, écrit par textes.mjs). Règles de pure forme coupées.
//   AUDIT_TOOLS=<node_modules avec html-validate> node scripts/audit/html.mjs
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, OUT, tool } from './lib.mjs';

const { HtmlValidate } = tool('html-validate');
const hv = new HtmlValidate({
  extends: ['html-validate:recommended'],
  rules: { 'no-inline-style': 'off', 'attribute-boolean-style': 'off', 'void-style': 'off', 'no-trailing-whitespace': 'off', 'attribute-empty-style': 'off', 'doctype-style': 'off' },
});
const HORS = ['crm.html', 'pro.html', 'contact.html'];
const sets = {
  construit: readdirSync(join(ROOT, 'dist')).filter((f) => f.endsWith('.html') && !HORS.includes(f)).map((f) => join(ROOT, 'dist', f)),
  rendu: existsSync(join(OUT, 'rendu')) ? readdirSync(join(OUT, 'rendu')).map((f) => join(OUT, 'rendu', f)) : [],
};
const out = {};
for (const [set, files] of Object.entries(sets)) {
  const agg = {};
  for (const file of files) {
    const report = await hv.validateString(readFileSync(file, 'utf8'), file);
    for (const r of report.results) for (const m of r.messages) {
      agg[m.ruleId] ||= { n: 0, fichiers: new Set(), exemples: [] };
      agg[m.ruleId].n += 1;
      agg[m.ruleId].fichiers.add(file.split('/').pop());
      if (agg[m.ruleId].exemples.length < 4) agg[m.ruleId].exemples.push(`${file.split('/').pop()}:${m.line} ${m.message} ${m.selector || ''}`);
    }
  }
  out[set] = Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, { n: v.n, fichiers: [...v.fichiers], exemples: v.exemples }]));
  console.log(`— ${set} (${files.length} fichiers)`);
  for (const [k, v] of Object.entries(out[set]).sort((a, b) => b[1].n - a[1].n)) console.log(`  ${k} : ${v.n} (${v.fichiers.length} fichiers) · ${v.exemples[0]}`);
}
writeFileSync(join(OUT, 'html-validate.json'), JSON.stringify(out, null, 1));
