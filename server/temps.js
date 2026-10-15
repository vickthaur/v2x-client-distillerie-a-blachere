// Dates de la maquette. Instants en ISO 8601 UTC à la seconde (« 2026-10-15T08:29:34Z »), jours en
// AAAA-MM-JJ et heures au fuseau de la distillerie (Europe/Paris) : un jour, une séance de visite, une
// échéance de facture sont des jours de Châteauneuf-du-Pape, pas des jours UTC.
export const FUSEAU = 'Europe/Paris';
export const JOUR_MS = 86400000;

// Horloge du serveur. Les tests la fixent (fixerHorloge) pour rejouer un parcours à une date donnée
// (opération en cours ou terminée, échéances) ; rien d'autre ne la modifie.
let horloge = null;
export const maintenant = () => (horloge ? new Date(horloge) : new Date());
export function fixerHorloge(date) {
  horloge = date ? new Date(date).getTime() : null;
}

const formatJour = new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' });
const formatParties = new Intl.DateTimeFormat('en-GB', {
  timeZone: FUSEAU,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

// Instant → texte ISO 8601 UTC à la seconde.
export const iso = (d) => new Date(d).toISOString().replace(/\.\d{3}Z$/, 'Z');

// Jour (AAAA-MM-JJ) d'un instant à Paris.
export const jourParis = (d = new Date()) => formatJour.format(new Date(d));

function parties(ms) {
  const p = Object.fromEntries(formatParties.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { a: +p.year, m: +p.month, j: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

// Heure (HH:MM) d'un instant à Paris.
export function heureParis(d) {
  const p = parties(new Date(d).getTime());
  return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`;
}

// Décalage de Paris sur UTC (en ms) à un instant donné.
function decalage(ms) {
  const p = parties(ms);
  return Date.UTC(p.a, p.m - 1, p.j, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
}

// Instant d'une heure de Paris un jour donné (« 2026-10-20 », « 10:30 »).
export function instantParis(jour, hhmm = '00:00') {
  const [a, m, j] = jour.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const naif = Date.UTC(a, m - 1, j, h, mi);
  let t = naif - decalage(naif);
  const d2 = decalage(t);
  if (naif - d2 !== t) t = naif - d2;
  return new Date(t);
}

const versJour = (ms) => new Date(ms).toISOString().slice(0, 10);
const enMs = (jour) => {
  const [a, m, j] = jour.split('-').map(Number);
  return Date.UTC(a, m - 1, j);
};

export const ajouterJours = (jour, n) => versJour(enMs(jour) + n * JOUR_MS);
// Nombre de jours de a à b (b − a).
export const ecartJours = (a, b) => Math.round((enMs(b) - enMs(a)) / JOUR_MS);
// 0 = dimanche … 6 = samedi.
export const jourSemaine = (jour) => new Date(enMs(jour)).getUTCDay();
export const mois = (jour) => jour.slice(0, 7);
export function finDeMois(jour) {
  const [a, m] = jour.split('-').map(Number);
  return versJour(Date.UTC(a, m, 0));
}
export function debutSemaine(jour) {
  const js = jourSemaine(jour);
  return ajouterJours(jour, js === 0 ? -6 : 1 - js);
}
export function moisPrecedent(jour) {
  const [a, m] = jour.split('-').map(Number);
  return versJour(Date.UTC(a, m - 2, 1)).slice(0, 7);
}
export function joursDuMois(m) {
  const debut = `${m}-01`;
  const n = Number(finDeMois(debut).slice(8));
  return Array.from({ length: n }, (_, i) => ajouterJours(debut, i));
}
// Année sur deux chiffres (numérotation : WEB-26-…).
export const annee2 = (d) => jourParis(d).slice(2, 4);

export const estJour = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && versJour(enMs(s)) === s;
export const estMois = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
