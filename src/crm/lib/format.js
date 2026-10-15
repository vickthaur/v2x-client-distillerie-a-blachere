// Mise en forme à la française : montants « 1 234,50 € », dates « 15 oct. 2026 », heures
// « 10 h 30 », durées relatives « il y a 5 min ». Heure de Paris (la distillerie), quel que soit
// le fuseau de l'appareil.

export const TZ = 'Europe/Paris';
const NBSP = ' ';

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const eur0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const num = (d = 0, min = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: min });
const pct = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 });

const ok = (n) => typeof n === 'number' && Number.isFinite(n);

// 1 234,50 €
export const euros = (n) => (ok(n) ? eur.format(n) : '—');
// 3 € (entier) ou 2,50 € : montants ronds sans centimes inutiles
export const eurosSimple = (n) => (ok(n) ? (Number.isInteger(n) ? eur0.format(n) : eur.format(n)) : '—');
// 1 235 € (sans centimes, pour les grands chiffres)
export const eurosRond = (n) => (ok(n) ? eur0.format(n) : '—');
// 12,4 k€ (axes et tuiles compactes)
export function eurosCourt(n) {
  if (!ok(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e6) return `${num(1).format(n / 1e6)}${NBSP}M€`;
  if (a >= 1e4) return `${num(0).format(n / 1e3)}${NBSP}k€`;
  if (a >= 1e3) return `${num(1).format(n / 1e3)}${NBSP}k€`;
  return `${num(0).format(n)}${NBSP}€`;
}
export const nombre = (n, d = 0) => (ok(n) ? num(d).format(n) : '—');
export const decimal = (n, d = 2) => (ok(n) ? num(d, d).format(n) : '—');
// 0,124 → « 12,4 % »
export const pourcent = (ratio) => (ok(ratio) ? pct.format(ratio) : '—');
// 5.5 → « 5,5 % » (taux déjà en pourcentage)
export const taux = (t) => (ok(t) ? `${num(1).format(t)}${NBSP}%` : '—');
// Variation signée « +12,4 % » / « −3 % »
export function variation(ratio) {
  if (!ok(ratio)) return '—';
  const s = pct.format(Math.abs(ratio));
  if (Math.abs(ratio) < 0.0005) return s;
  return `${ratio > 0 ? '+' : '−'}${s}`;
}

// « 1 commande », « 3 commandes » (0 et 1 au singulier en français)
export const pluriel = (n, un, plusieurs = `${un}s`) => `${nombre(n)} ${Math.abs(n) >= 2 ? plusieurs : un}`;

// ---------- Dates ----------
// Jour « AAAA-MM-JJ » → Date locale (midi, à l'abri des changements d'heure)
export function jourDate(s) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return new Date(s);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
}
const asDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return jourDate(v);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const fmt = (opts) => new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, ...opts });
const fDate = fmt({ day: 'numeric', month: 'short', year: 'numeric' });
const fDateCourte = fmt({ day: 'numeric', month: 'short' });
const fDateLongue = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fJourSemaine = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
const fJourCourt = fmt({ weekday: 'short', day: 'numeric' });
const fMois = fmt({ month: 'long', year: 'numeric' });
const fMoisCourt = fmt({ month: 'short' });
const fHeure = fmt({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const fIso = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

// « 15 oct. 2026 »
export const date = (v) => { const d = asDate(v); return d ? fDate.format(d) : '—'; };
// « 15 oct. »
export const dateCourte = (v) => { const d = asDate(v); return d ? fDateCourte.format(d) : '—'; };
// « jeudi 15 octobre 2026 »
export const dateLongue = (v) => { const d = asDate(v); return d ? fDateLongue.format(d) : '—'; };
// « jeudi 15 octobre »
export const jourSemaine = (v) => { const d = asDate(v); return d ? fJourSemaine.format(d) : '—'; };
// « jeu. 15 »
export const jourCourt = (v) => { const d = asDate(v); return d ? fJourCourt.format(d) : '—'; };
export const mois = (v) => { const d = asDate(v); return d ? fMois.format(d) : '—'; };
export const moisCourt = (v) => { const d = asDate(v); return d ? fMoisCourt.format(d).replace('.', '') : '—'; };
// « 14 h 05 » ; accepte une date ISO ou une heure « 10:30 »
export function heure(v) {
  if (!v) return '—';
  if (/^\d{1,2}:\d{2}$/.test(v)) {
    const [h, m] = v.split(':');
    return m === '00' ? `${+h}${NBSP}h` : `${+h}${NBSP}h${NBSP}${m}`;
  }
  const d = asDate(v);
  if (!d) return '—';
  const [h, m] = fHeure.format(d).split(':');
  return `${+h}${NBSP}h${NBSP}${m}`;
}
// « 15 oct. 2026 à 14 h 05 »
export const dateHeure = (v) => (asDate(v) ? `${date(v)} à ${heure(v)}` : '—');

// Période « du 1er au 31 octobre 2026 », « du 28 sept. au 4 oct. 2026 »
const fJourMois = fmt({ day: 'numeric', month: 'long' });
export function periode(debut, fin) {
  const a = asDate(debut);
  const b = asDate(fin);
  if (!a || !b) return '';
  const jA = Number(fmt({ day: 'numeric' }).format(a));
  const premier = (j) => (j === 1 ? '1er' : String(j));
  const memeAnnee = isoJour(a).slice(0, 4) === isoJour(b).slice(0, 4);
  const memeMois = memeAnnee && isoJour(a).slice(0, 7) === isoJour(b).slice(0, 7);
  if (memeMois) return `du ${premier(jA)} au ${fJourMois.format(b).replace(/^1 /, '1er ')} ${isoJour(b).slice(0, 4)}`;
  if (memeAnnee) return `du ${fJourMois.format(a).replace(/^1 /, '1er ')} au ${fJourMois.format(b).replace(/^1 /, '1er ')} ${isoJour(b).slice(0, 4)}`;
  return `du ${date(a)} au ${date(b)}`;
}

// Jour calendaire à Paris « AAAA-MM-JJ »
export const isoJour = (v = new Date()) => fIso.format(asDate(v));
export const aujourdHui = () => isoJour(new Date());
export function ajouterJours(jour, n) {
  const d = jourDate(jour);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// Lundi de la semaine du jour donné
export function lundi(jour) {
  const d = jourDate(jour);
  const wd = (d.getUTCDay() + 6) % 7;
  return ajouterJours(jour, -wd);
}
export const jourDeSemaine = (jour) => (jourDate(jour).getUTCDay() + 6) % 7; // 0 = lundi
export function ecartJours(a, b) {
  return Math.round((jourDate(b) - jourDate(a)) / 86400000);
}

// « à l'instant », « il y a 5 min », « il y a 3 h », « hier à 14 h 05 », « il y a 4 j », sinon la date
export function relatif(v, maintenant = Date.now()) {
  const d = asDate(v);
  if (!d) return '—';
  const s = Math.round((maintenant - d.getTime()) / 1000);
  if (s < 0) {
    const f = -s;
    if (f < 3600) return `dans ${Math.max(1, Math.round(f / 60))}${NBSP}min`;
    if (f < 86400) return `dans ${Math.round(f / 3600)}${NBSP}h`;
    return date(d);
  }
  if (s < 45) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.max(1, Math.round(s / 60))}${NBSP}min`;
  const jours = ecartJours(isoJour(d), isoJour(new Date(maintenant)));
  if (jours === 0) return `il y a ${Math.round(s / 3600)}${NBSP}h`;
  if (jours === 1) return `hier à ${heure(d)}`;
  if (jours < 7) return `il y a ${jours}${NBSP}j`;
  return date(d);
}

// Initiales (« HG ») : premier et dernier mot significatif (sans « de », « la », « d’ »…)
const PARTICULES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'au', 'aux', 'sur', 'sous', '&']);
export function initiales(nom = '') {
  const p = String(nom)
    .trim()
    .split(/[\s-]+/)
    .map((m) => m.replace(/^[dl][’']/i, '').replace(/^[^\p{L}\p{N}]+/u, ''))
    .filter((m) => m && !PARTICULES.has(m.toLowerCase()));
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
}
// Teinte stable (1 à 6) pour un avatar
export function ton(cle = '') {
  let h = 0;
  for (const c of String(cle)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (h % 6) + 1;
}
export const nomComplet = (u) => (u ? [u.prenom, u.nom].filter(Boolean).join(' ') || u.email || '' : '');

// Typographie française d'un texte saisi (affichage) : insécables avant « : » et « ; ! ? »,
// dans les guillemets « ».
export function typo(t) {
  if (typeof t !== 'string') return t;
  return t
    .replace(/ :(?=\s|$)/g, '\u00a0:')
    .replace(/ ([;!?])(?=\s|$|[»)])/g, '\u202f$1')
    .replace(/« /g, '«\u00a0')
    .replace(/ »/g, '\u00a0»');
}

// Recherche sans accents
export const plier = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Téléphone « 04 90 83 55 65 »
export function telephone(t) {
  if (!t) return '';
  const d = String(t).replace(/[^\d+]/g, '');
  if (/^0\d{9}$/.test(d)) return d.replace(/(\d{2})(?=\d)/g, `$1${NBSP}`);
  return t;
}
