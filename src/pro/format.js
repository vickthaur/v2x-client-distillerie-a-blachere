// Mise en forme française (montants, dates, statuts) pour l'espace pro.
// Montants : « 1 240,00 € » (espace fine insécable entre les milliers, espace insécable avant €).

export const NB = ' '; // espace insécable (avant « : », dans « » et avant €)
export const NNB = ' '; // espace fine insécable (avant « ; ! ? »)

const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
export const eur = (n) => money.format(Number.isFinite(Number(n)) ? Number(n) : 0);
const num = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
export const nombre = (n) => num.format(Number(n) || 0);
export const pourcent = (n) => `${num.format(Number(n) || 0)}${NB}%`;

// Un jour « AAAA-MM-JJ » ou une date ISO → Date (à midi pour un jour : pas de décalage horaire).
export function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date(v);
}
const fmt = (v, opts) => {
  const d = toDate(v);
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('fr-FR', opts) : '';
};
export const dateCourte = (v) => fmt(v, { day: '2-digit', month: '2-digit', year: 'numeric' }); // 15/10/2026
export const dateLongue = (v) => fmt(v, { day: 'numeric', month: 'long', year: 'numeric' }); // 15 octobre 2026
export const dateJour = (v) => fmt(v, { weekday: 'long', day: 'numeric', month: 'long' }); // jeudi 15 octobre
export const dateMois = (v) => fmt(v, { day: 'numeric', month: 'short' }); // 15 oct.
export function heure(v) {
  const d = toDate(v);
  return d ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', `${NB}h${NB}`) : '';
}
export const dateHeure = (v) => `${dateLongue(v)} à ${heure(v)}`;

// Jour local « AAAA-MM-JJ » (champ date) ; décalage de n jours ouvrés (lundi à vendredi).
export function isoJour(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function joursOuvres(n, from = new Date()) {
  const d = new Date(from);
  let k = 0;
  while (k < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) k += 1;
  }
  return d;
}

export const pluriel = (n, un, plusieurs = `${un}s`) => `${nombre(n)}${NB}${n > 1 ? plusieurs : un}`;

// ---------- Statuts ----------
// Commandes : vus par le client professionnel (« nouvelle » = enregistrée par la distillerie).
export const STATUTS = {
  nouvelle: { libelle: 'Enregistrée', ton: 'info' },
  'en-preparation': { libelle: 'En préparation', ton: 'warn' },
  prete: { libelle: 'Prête', ton: 'ok' },
  expediee: { libelle: 'Expédiée', ton: 'info' },
  livree: { libelle: 'Livrée', ton: 'ok' },
  retiree: { libelle: 'Retirée', ton: 'ok' },
  annulee: { libelle: 'Annulée', ton: 'muet' },
  remboursee: { libelle: 'Remboursée', ton: 'muet' },
};
export const statut = (s) => STATUTS[s] || { libelle: s || '—', ton: 'muet' };
// Étapes affichées sur la frise d'une commande livrée par transporteur.
export const ETAPES = ['nouvelle', 'en-preparation', 'expediee', 'livree'];

export const FACTURES = {
  'a-regler': { libelle: 'À régler', ton: 'warn' },
  payee: { libelle: 'Payée', ton: 'ok' },
  retard: { libelle: 'En retard', ton: 'err' },
};

export const CONDITIONS = {
  comptant: 'Comptant à réception',
  '30j-fdm': '30 jours fin de mois',
  '45j': '45 jours',
  prelevement: 'Prélèvement à 10 jours',
};

export const ETATS = {
  disponible: { libelle: 'En stock', ton: 'ok' },
  'stock-bas': { libelle: 'Stock bas', ton: 'warn' },
  rupture: { libelle: 'Rupture', ton: 'err' },
};

export const SUJETS = { commande: 'Commande', visite: 'Visite', pro: 'Compte professionnel', presse: 'Presse', autre: 'Autre' };

// Contenance lisible depuis un identifiant de variante (« 1000 » → « 1 L », « 700 » → « 70 cl »).
export function volume(id, texte) {
  if (texte) return texte;
  const n = Number(id);
  if (!Number.isFinite(n)) return id === 'coffrets' ? 'Coffret' : String(id || '');
  return n >= 1000 ? `${String(n / 1000).replace('.', ',')}${NB}L` : `${n / 10}${NB}cl`;
}
