// Gabarits des courriels (docs/crm-espace-pro.md, § 4) : rien ne sort, chaque courriel est déposé
// dans la boîte d'envoi de la démo (« Courriels envoyés » du CRM) avec son contenu structuré :
// { titre, paragraphes, tableau?, bouton? }. Les liens sont des adresses relatives du site.
import { euros, dateLongue, heureFr, typo } from './typo.js';
import { jourParis } from './temps.js';
import { LIBELLES_CONDITIONS, LIBELLES_LIVRAISON } from './regles.js';
import { phraseDon } from './operation.js';

const SIGNATURE = 'L’équipe de la Distillerie A. Blachère';

function courriel(type, a, objet, contenu, lie) {
  const c = {
    titre: typo(contenu.titre),
    paragraphes: contenu.paragraphes.filter(Boolean).map(typo),
  };
  if (contenu.tableau?.length) c.tableau = contenu.tableau.map((l) => ({ libelle: typo(l.libelle), valeur: typo(l.valeur) }));
  if (contenu.bouton) c.bouton = { libelle: typo(contenu.bouton.libelle), url: contenu.bouton.url };
  const out = { type, a, objet: typo(objet), contenu: c };
  if (lie) out.lie = lie;
  return out;
}

const prenomDe = (commande) => (commande.contact?.nom || '').split(' ')[0] || '';
const bonjour = (prenom) => (prenom ? `Bonjour ${prenom},` : 'Bonjour,');
const lienCommande = (c) => ({ type: 'commande', id: c.id });

// Lignes et totaux d'une commande (TTC pour un particulier, HT pour un pro).
function tableauCommande(c) {
  const pro = c.canal === 'pro';
  const t = c.totaux;
  const lignes = c.lignes.map((l) => ({ libelle: `${l.qte} × ${l.nom} ${l.volume}`, valeur: euros(pro ? l.totalHT : l.totalTTC) + (pro ? ' HT' : '') }));
  if (pro) {
    lignes.push({ libelle: 'Articles', valeur: `${euros(t.articlesHT)} HT` });
    lignes.push({ libelle: 'Port', valeur: t.livraisonHT ? `${euros(t.livraisonHT)} HT` : 'Franco' });
    lignes.push({ libelle: 'Total HT', valeur: euros(t.totalHT) });
    lignes.push({ libelle: 'TVA', valeur: euros(t.totalTVA) });
    lignes.push({ libelle: 'Total TTC', valeur: euros(t.totalTTC) });
  } else {
    lignes.push({ libelle: 'Articles', valeur: euros(t.articlesTTC) });
    if (t.remiseTTC) lignes.push({ libelle: `Remise${c.promo ? ` (${c.promo.code})` : ''}`, valeur: `− ${euros(t.remiseTTC)}` });
    lignes.push({ libelle: c.livraison.libelle, valeur: t.livraisonTTC ? euros(t.livraisonTTC) : c.livraison.mode === 'retrait' ? 'Gratuit' : 'Offerte' });
    lignes.push({ libelle: 'Total TTC', valeur: euros(t.totalTTC) });
    lignes.push({ libelle: 'dont TVA', valeur: euros(t.totalTVA) });
  }
  return lignes;
}

function phraseLivraison(c) {
  const l = c.livraison;
  if (l.mode === 'retrait') return `Retrait à la distillerie le ${dateLongue(l.jourRetrait)} (9 h – 12 h et 14 h – 17 h), 1695 route de Sorgues à Châteauneuf-du-Pape : nous vous écrirons dès qu’elle sera prête.`;
  if (l.mode === 'transporteur') return `Livraison par transporteur sous 48 à 72 h ouvrées après expédition${l.adresse ? `, ${l.adresse.ligne1}, ${l.adresse.cp} ${l.adresse.ville}` : ''}.`;
  const a = l.mode === 'relais' ? l.relais?.adresse || l.adresse : l.adresse;
  return `${LIBELLES_LIVRAISON[l.mode]}${a ? ` : ${a.ligne1}, ${a.cp} ${a.ville}` : ''}. Expédition sous 3 jours ouvrés après réception du règlement.`;
}

function phrasePaiement(c) {
  const p = c.paiement;
  if (c.canal === 'pro') return `Règlement : ${LIBELLES_CONDITIONS[p.mode] || p.mode}, à réception de la facture émise à l’expédition.`;
  if (p.statut === 'paye') return `Paiement reçu (${{ carte: 'carte bancaire', paypal: 'PayPal', virement: 'virement' }[p.mode] || p.mode}). Démonstration : aucun paiement réel n’a été effectué.`;
  if (p.mode === 'virement') return 'Paiement par virement : la commande sera préparée à réception du virement (démonstration : aucun paiement réel).';
  return 'Paiement à réception.';
}

// ---------- Commandes ----------

export function confirmationCommande(c) {
  const pro = c.canal === 'pro';
  return courriel(
    'commande',
    c.contact.email,
    `Votre commande ${c.numero} est enregistrée`,
    {
      titre: 'Merci pour votre commande',
      paragraphes: [
        bonjour(prenomDe(c)),
        `Nous avons bien reçu votre commande ${c.numero} du ${dateLongue(jourParis(c.createdAt), { semaine: false })}${c.referenceClient ? ` (votre référence : ${c.referenceClient})` : ''}.`,
        phraseLivraison(c),
        phrasePaiement(c),
        c.operation ? phraseDon(c.operation) : null,
        SIGNATURE,
      ],
      tableau: tableauCommande(c),
      bouton: pro ? { libelle: 'Suivre la commande', url: `/espace-pro/commandes/${c.id}` } : undefined,
    },
    lienCommande(c),
  );
}

export function preparation(c) {
  return courriel('commande', c.contact.email, `Commande ${c.numero} : en préparation`, {
    titre: 'Votre commande est en préparation',
    paragraphes: [bonjour(prenomDe(c)), `Votre commande ${c.numero} est en cours de préparation à la distillerie.`, SIGNATURE],
  }, lienCommande(c));
}

export function expedition(c) {
  const s = c.suivi;
  return courriel(
    'expedition',
    c.contact.email,
    `Commande ${c.numero} : expédiée`,
    {
      titre: 'Votre commande est en route',
      paragraphes: [
        bonjour(prenomDe(c)),
        `Votre commande ${c.numero} vient de quitter la distillerie.`,
        s?.numero ? `Transporteur : ${s.transporteur}, numéro de suivi ${s.numero}.` : s?.transporteur ? `Transporteur : ${s.transporteur}.` : null,
        c.canal === 'pro' ? 'Livraison sous 48 à 72 h ouvrées.' : 'Livraison en 48 h environ à domicile, 3 à 5 jours en point relais.',
        SIGNATURE,
      ],
      bouton: s?.url ? { libelle: 'Suivre le colis', url: s.url } : c.canal === 'pro' ? { libelle: 'Suivre la commande', url: `/espace-pro/commandes/${c.id}` } : undefined,
    },
    lienCommande(c),
  );
}

export function pretRetrait(c) {
  return courriel('retrait', c.contact.email, `Commande ${c.numero} : prête au retrait`, {
    titre: 'Votre commande vous attend',
    paragraphes: [
      bonjour(prenomDe(c)),
      `Votre commande ${c.numero} est prête. Elle vous attend à la boutique de la distillerie, 1695 route de Sorgues à Châteauneuf-du-Pape, du lundi au samedi (9 h – 12 h et 14 h – 17 h).`,
      'Pensez à vous munir du numéro de commande. Une pièce d’identité peut vous être demandée pour les boissons alcoolisées.',
      SIGNATURE,
    ],
  }, lienCommande(c));
}

export function annulation(c, { rembourse = false } = {}) {
  return courriel('commande', c.contact.email, `Commande ${c.numero} : annulée`, {
    titre: 'Votre commande est annulée',
    paragraphes: [
      bonjour(prenomDe(c)),
      `Votre commande ${c.numero} a été annulée.`,
      rembourse ? `Le montant de ${euros(c.totaux.totalTTC)} vous est remboursé sur le moyen de paiement utilisé (démonstration : aucun mouvement réel).` : null,
      'Pour toute question, répondez simplement à ce message.',
      SIGNATURE,
    ],
  }, lienCommande(c));
}

export function remboursement(c) {
  return courriel('commande', c.contact.email, `Commande ${c.numero} : remboursée`, {
    titre: 'Votre remboursement est en cours',
    paragraphes: [
      bonjour(prenomDe(c)),
      `Nous avons procédé au remboursement de votre commande ${c.numero}, soit ${euros(c.totaux.totalTTC)} (démonstration : aucun mouvement réel).`,
      SIGNATURE,
    ],
  }, lienCommande(c));
}

export function factureDisponible(c, compte) {
  const f = c.facture;
  return courriel('facture', compte?.email || c.contact.email, `Facture ${f.numero} disponible`, {
    titre: 'Votre facture est disponible',
    paragraphes: [
      bonjour(prenomDe(c)),
      `La facture ${f.numero} de votre commande ${c.numero} est disponible dans votre espace professionnel.`,
      `Montant : ${euros(c.totaux.totalTTC)} TTC, à régler au plus tard le ${dateLongue(f.echeance, { semaine: false })}.`,
      SIGNATURE,
    ],
    tableau: [
      { libelle: 'Facture', valeur: f.numero },
      { libelle: 'Total HT', valeur: euros(c.totaux.totalHT) },
      { libelle: 'TVA', valeur: euros(c.totaux.totalTVA) },
      { libelle: 'Total TTC', valeur: euros(c.totaux.totalTTC) },
      { libelle: 'Échéance', valeur: dateLongue(f.echeance, { semaine: false }) },
    ],
    bouton: { libelle: 'Voir mes factures', url: '/espace-pro/factures' },
  }, { type: 'facture', id: c.id });
}

// ---------- Comptes ----------

export function invitationPro(u, compte, jeton) {
  return courriel('invitation', u.email, 'Votre accès à l’espace professionnel', {
    titre: 'Bienvenue dans l’espace pro',
    paragraphes: [
      bonjour(u.prenom),
      `Un accès à l’espace professionnel de la Distillerie A. Blachère a été ouvert pour ${compte.enseigne}. Choisissez votre mot de passe pour l’activer : le lien est valable 7 jours.`,
      'Vous y retrouverez vos tarifs, le catalogue, vos commandes et vos factures.',
      SIGNATURE,
    ],
    bouton: { libelle: 'Activer mon accès', url: `/espace-pro/activer?jeton=${jeton}` },
  }, { type: 'compte', id: compte.id });
}

export function invitationPersonnel(u, jeton) {
  return courriel('invitation', u.email, 'Votre accès au CRM de la distillerie', {
    titre: 'Bienvenue dans le CRM',
    paragraphes: [bonjour(u.prenom), 'Un accès au CRM de la Distillerie A. Blachère a été ouvert pour vous. Choisissez votre mot de passe pour l’activer : le lien est valable 7 jours.', SIGNATURE],
    bouton: { libelle: 'Activer mon accès', url: `/crm/activer?jeton=${jeton}` },
  }, { type: 'utilisateur', id: u.id });
}

export function reinitialisation(u, jeton, espace) {
  return courriel('reinitialisation', u.email, 'Réinitialisation de votre mot de passe', {
    titre: 'Choisir un nouveau mot de passe',
    paragraphes: [
      bonjour(u.prenom),
      'Vous avez demandé à changer votre mot de passe. Le lien ci-dessous est valable une heure et ne sert qu’une fois.',
      'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.',
      SIGNATURE,
    ],
    bouton: { libelle: 'Choisir un mot de passe', url: `${espace === 'crm' ? '/crm' : '/espace-pro'}/mot-de-passe?jeton=${jeton}` },
  }, { type: 'utilisateur', id: u.id });
}

// ---------- Visites, messages, demandes, newsletter ----------

export function confirmationVisite(r, seance) {
  return courriel('reservation', r.email, `Visite du ${dateLongue(r.date, { semaine: false })} : réservation confirmée`, {
    titre: 'Votre visite est réservée',
    paragraphes: [
      bonjour(r.nom.split(' ')[0]),
      `Nous vous attendons le ${dateLongue(r.date)} à ${heureFr(seance.heure)}, pour ${r.personnes} personne${r.personnes > 1 ? 's' : ''}${r.mineurs ? ` dont ${r.mineurs} mineur${r.mineurs > 1 ? 's' : ''}` : ''}.`,
      'Distillerie A. Blachère, 1695 route de Sorgues, quartier Cansaud, 84230 Châteauneuf-du-Pape. Merci d’arriver dix minutes avant le début de la visite.',
      r.mineurs ? 'La dégustation des boissons alcoolisées est réservée aux personnes majeures ; les sirops sont pour tout le monde.' : null,
      SIGNATURE,
    ],
    tableau: [
      { libelle: 'Référence', valeur: r.reference },
      { libelle: 'Date', valeur: dateLongue(r.date) },
      { libelle: 'Heure', valeur: heureFr(seance.heure) },
      { libelle: 'Personnes', valeur: String(r.personnes) },
    ],
  }, { type: 'reservation', id: r.id });
}

export function reponseMessage(m, texte, auteur) {
  return courriel('reponse', m.email, `Re : votre message ${m.reference}`, {
    titre: 'Réponse à votre message',
    paragraphes: [bonjour(m.nom.split(' ')[0]), ...texte.split(/\n{2,}/), `${auteur.nom}, Distillerie A. Blachère`],
  }, { type: 'message', id: m.id });
}

export function demandeProRecue(d) {
  return courriel('demande-pro', d.email, `Demande de compte professionnel ${d.reference}`, {
    titre: 'Nous avons bien reçu votre demande',
    paragraphes: [
      bonjour(d.nom.split(' ')[0]),
      `Merci pour votre demande d’ouverture de compte professionnel pour ${d.societe}. Notre équipe commerciale l’étudie et revient vers vous sous 48 h ouvrées.`,
      SIGNATURE,
    ],
  }, { type: 'demande', id: d.id });
}

export function demandeProRefusee(d, motif) {
  return courriel('demande-pro', d.email, `Votre demande de compte professionnel ${d.reference}`, {
    titre: 'Réponse à votre demande',
    paragraphes: [
      bonjour(d.nom.split(' ')[0]),
      `Merci de l’intérêt que vous portez à la Distillerie A. Blachère. Nous ne pouvons pas donner suite à votre demande d’ouverture de compte pour ${d.societe}.`,
      motif ? `Motif : ${motif}` : null,
      'Nos produits restent disponibles sur notre boutique en ligne et à la boutique de la distillerie.',
      SIGNATURE,
    ],
  }, { type: 'demande', id: d.id });
}

export function bienvenueNewsletter(abonne) {
  return courriel('bienvenue', abonne.email, 'Bienvenue dans la lettre de la distillerie', {
    titre: 'Bienvenue',
    paragraphes: [
      abonne.prenom ? bonjour(abonne.prenom) : 'Bonjour,',
      'Merci de votre inscription à la lettre d’information de la Distillerie A. Blachère : recettes, nouveautés, visites et événements, une à deux fois par mois.',
      'Vous pouvez vous désinscrire à tout moment depuis chaque lettre.',
      SIGNATURE,
    ],
    bouton: { libelle: 'Découvrir les recettes', url: '/recettes' },
  }, { type: 'abonne', id: abonne.id });
}

export function campagne(cam, destinataire) {
  return courriel('campagne', destinataire, cam.objet, {
    titre: cam.objet,
    paragraphes: [cam.introduction, ...String(cam.corps || '').split(/\n{2,}/)],
    bouton: cam.bouton,
  }, { type: 'campagne', id: cam.id });
}
