// Phrases du journal (tableau de bord et écran Journal) : qui, quoi, sur quel élément, et des
// détails lisibles (codes de statut, dates ISO et noms de champs traduits).
import { Link } from '../lib/router.jsx';
import { lienCible } from '../lib/liens.js';
import { roleNom } from '../lib/droits.js';
import { useSession } from '../lib/session.jsx';
import { rubriqueDe, accessible } from '../nav.js';
import { ABONNE_SOURCE, ACTIONS, COMMANDE, DEMANDE, MESSAGE, MOMENT, RESERVATION, SEANCE, libelle } from '../lib/statuts.js';
import { dateCourte, typo } from '../lib/format.js';

// Libellé du serveur sans le nom du type, que la phrase porte déjà (« Commande WEB-… » → « WEB-… »)
const PREFIXE = /^(Commande|Visite|Demande|Message|Facture|Séance du)\s+/;
const ISO = /\b(\d{4}-\d{2}-\d{2})\b/g;
const STATUTS = { commande: COMMANDE, demande: DEMANDE, message: MESSAGE, reservation: RESERVATION, seance: SEANCE };
const CHAMPS = {
  tags: 'étiquettes',
  notes: 'notes',
  note: 'note',
  telephone: 'téléphone',
  email: 'e-mail',
  prenom: 'prénom',
  nom: 'nom',
  adresse: 'adresse',
  newsletter: 'newsletter',
  origine: 'origine',
  capacite: 'capacité',
  guideId: 'guide',
  langue: 'langue',
  personnes: 'personnes',
  mineurs: 'mineurs',
  seanceId: 'séance',
  statut: 'statut',
  conditions: 'conditions de paiement',
  grille: 'grille',
  remise: 'remise',
  encoursMax: 'encours maximal',
  commercialId: 'commercial',
  francoHT: 'franco',
  licence: 'licence',
  siret: 'SIRET',
  tvaIntra: 'TVA intracommunautaire',
  adresseFacturation: 'adresse de facturation',
  adressesLivraison: 'adresses de livraison',
  enseigne: 'enseigne',
  raisonSociale: 'raison sociale',
  type: 'type',
  poste: 'poste',
  role: 'rôle',
  actif: 'accès',
  livraison: 'livraison',
  pro: 'espace pro',
  visites: 'visites',
  entreprise: 'entreprise',
};

const minuscule = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const dates = (s) => String(s).replace(ISO, (m) => dateCourte(m));

// Détails d'une entrée, lisibles
export function detailsJournal(e) {
  let d = e.details;
  if (d === undefined || d === null || d === '') return null;
  if (typeof d !== 'string') d = Object.entries(d).map(([k, v]) => `${CHAMPS[k] || k} : ${v}`).join(' · ');
  if (e.action?.startsWith('seance.') && MOMENT[d]) return MOMENT[d];
  const table = STATUTS[e.cible?.type];
  d = d.replace(/^Statut : ([a-z-]+)$/, (m, c) => `Statut : ${minuscule(table ? libelle(table, c) : c)}`);
  d = d.replace(/^(Champs|Rubriques) : (.+)$/, (m, s, l) => `${s} : ${l.split(/,\s*/).map((c) => CHAMPS[c] || c).join(', ')}`);
  d = d.replace(/^Source : ([a-z-]+)$/, (m, c) => `Source : ${minuscule(ABONNE_SOURCE[c] || c)}`);
  return typo(dates(d));
}

// Verbe selon l'auteur : membre de l'équipe, client pro (espace pro) ou site public
function verbeDe(e) {
  const a = ACTIONS[e.action];
  const role = e.par?.role;
  if (a) {
    if (!e.par?.id && a.site) return a.site;
    if (role === 'pro' && a.pro) return a.pro;
    return a.verbe;
  }
  const s = String(e.action || '');
  if (/\s/.test(s) || !/[.:_]/.test(s)) return minuscule(s);
  return s.replace(/[._:]/g, ' ');
}

// Élément visé, sans lien quand il n'existe plus ou quand c'est l'auteur lui-même
function objetDe(e) {
  const c = e.cible;
  if (!c?.libelle) return null;
  if (ACTIONS[e.action]?.sansObjet) return null;
  if (c.type === 'utilisateur' && e.par?.id && c.id === e.par.id) return null;
  let t = dates(c.libelle.replace(PREFIXE, ''));
  if (c.type === 'campagne') t = `« ${t} »`;
  return { texte: typo(t), href: ACTIONS[e.action]?.sansLien ? null : lienCible(c) };
}

export function auteurDe(e) {
  if (!e.par) return 'Système';
  if (!e.par.id && e.par.nom === 'Site') return 'Le site';
  return e.par.nom || 'Système';
}

// « Léa Fabre (boutique et visites) a fait avancer la commande WEB-26-01060 »
export function PhraseJournal({ e, role = true, encre = false }) {
  const s = useSession();
  const verbe = verbeDe(e);
  const objet = objetDe(e);
  const visible = (href) => {
    if (!href) return false;
    const r = rubriqueDe(new URL(href, location.origin).pathname);
    return r?.droit ? accessible(r, s.peut) : true;
  };
  const cible = objet ? (
    visible(objet.href) ? (
      <Link class={encre ? 'link link--ink' : 'link'} href={objet.href}>
        {objet.texte}
      </Link>
    ) : (
      <span class="strong">{objet.texte}</span>
    )
  ) : null;
  const [avant, apres] = verbe.includes('{}') ? verbe.split('{}') : [verbe, ''];
  return (
    <>
      <span class="strong">{auteurDe(e)}</span>
      {role && e.par?.role && <span class="small muted"> ({roleNom(e.par.role).toLowerCase()})</span>} {avant.trim()}
      {cible && ' '}
      {cible}
      {apres && (apres.startsWith(' ') ? apres : ` ${apres}`)}
    </>
  );
}
