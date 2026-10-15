// Typographie française des textes rendus par l'API (messages d'erreur, courriels, journal) :
// espace insécable avant « : », fine insécable avant « ; ! ? », insécables dans les guillemets
// « », avant « € » et « % ». Les sources s'écrivent avec des espaces ordinaires.
export function typo(s) {
  if (typeof s !== 'string') return s;
  return s
    .replace(/ :(?=\s|$)/g, ' :')
    .replace(/ ([;!?])(?=\s|$|[»)])/g, ' $1')
    .replace(/« /g, '« ')
    .replace(/ »/g, ' »')
    .replace(/ (€|%)/g, ' $1');
}

const EUROS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const NOMBRE = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

// 1234.5 → « 1 234,50 € » (fine insécable des milliers, insécable avant €).
export const euros = (n) => EUROS.format(n);
export const nombre = (n) => NOMBRE.format(n);

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// « 2026-10-20 » → « mardi 20 octobre 2026 » (sans le jour de la semaine : « 20 octobre 2026 »).
export function dateLongue(jour, { semaine = true } = {}) {
  const [a, m, j] = jour.split('-').map(Number);
  const js = new Date(Date.UTC(a, m - 1, j)).getUTCDay();
  return `${semaine ? `${JOURS[js]} ` : ''}${j === 1 ? '1er' : j} ${MOIS[m - 1]} ${a}`;
}

// Messages d'erreur et journal : « 2026-11-12 » → « 12 novembre », avec l'année seulement si elle
// diffère de celle du jour de référence (« 12 janvier 2027 ») ; sans référence, toujours l'année.
export function dateCourte(jour, reference) {
  const [a, m, j] = jour.split('-').map(Number);
  const annee = reference && Number(reference.slice(0, 4)) === a ? '' : ` ${a}`;
  return `${j === 1 ? '1er' : j} ${MOIS[m - 1]}${annee}`;
}

// « 02-12 » (MM-JJ) → « 12 février ».
export function jourEtMois(mmjj) {
  const [m, j] = mmjj.split('-').map(Number);
  return `${j === 1 ? '1er' : j} ${MOIS[m - 1]}`;
}

// Jours de la semaine (0 = dimanche), du lundi au dimanche : [0, 1] → « le lundi et le dimanche ».
export function joursSemaine(jours) {
  const noms = [...new Set(jours)].sort((x, y) => ((x + 6) % 7) - ((y + 6) % 7)).map((j) => `le ${JOURS[j]}`);
  return noms.length > 1 ? `${noms.slice(0, -1).join(', ')} et ${noms.at(-1)}` : noms[0] || '';
}

// « 10:30 » → « 10 h 30 », « 15:00 » → « 15 h ».
export function heureFr(hhmm) {
  const [h, m] = hhmm.split(':');
  return m === '00' ? `${Number(h)} h` : `${Number(h)} h ${m}`;
}
