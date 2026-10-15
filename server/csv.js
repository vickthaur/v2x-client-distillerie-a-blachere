// Exports CSV du CRM : UTF-8 avec BOM (Excel), séparateur « ; », décimales à virgule, dates de
// Paris, en-tête Content-Disposition: attachment. Les cellules de texte qui commenceraient par
// = + - @ (formules d'un tableur) sont neutralisées par une apostrophe.
import { heureParis, jourParis } from './temps.js';

const formuleDangereuse = /^[=+\-@\t\r]/;

function cellule(v, type) {
  if (v === undefined || v === null || v === '') return '';
  let s;
  if (type === 'montant') s = Number(v).toFixed(2).replace('.', ',');
  else if (type === 'nombre') s = String(v).replace('.', ',');
  else if (type === 'instant') s = `${jourParis(v).split('-').reverse().join('/')} ${heureParis(v)}`;
  else if (type === 'jour') s = String(v).split('-').reverse().join('/');
  else if (type === 'booleen') s = v ? 'oui' : 'non';
  else {
    s = String(v);
    if (formuleDangereuse.test(s)) s = `'${s}`;
  }
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// colonnes : [{ titre, valeur: (x) => …, type? : 'texte'|'montant'|'nombre'|'instant'|'jour'|'booleen' }]
export function texteCsv(colonnes, elements) {
  const lignes = [colonnes.map((c) => cellule(c.titre, 'texte')).join(';')];
  for (const x of elements) lignes.push(colonnes.map((c) => cellule(c.valeur(x), c.type)).join(';'));
  return `﻿${lignes.join('\r\n')}\r\n`;
}

export function reponseCsv(nomFichier, colonnes, elements) {
  return new Response(texteCsv(colonnes, elements), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nomFichier}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
