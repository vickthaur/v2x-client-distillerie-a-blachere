# CRM de la distillerie et espace professionnel

Document de conception (octobre 2026). Il fait foi pour le back-end (`api/`, `server/`), le CRM
(`/crm`), l'espace pro (`/espace-pro/…`) et les formulaires du site public. Toute évolution du
contrat d'API se fait **ici d'abord**.

## 1. Principes

1. **Fonctionnel pour de vrai.** Comptes, mots de passe, sessions, commandes, stocks, factures,
   réservations, e-mails sortants : tout est enregistré côté serveur et relu par les autres écrans.
   Une commande passée sur le site ou dans l'espace pro apparaît dans le CRM ; un changement de
   statut ou de stock dans le CRM se voit dans l'espace pro et dans la boutique.
2. **Une démo privée par navigateur (« bac à sable »).** La maquette est publique (lien partagé à la
   distillerie) : chaque visiteur qui entre dans le CRM, l'espace pro ou envoie un formulaire reçoit
   son propre jeu de données, copie d'un jeu de démonstration réaliste. Personne ne voit les données
   d'un autre visiteur. Un lien « Ouvrir cette démo sur un autre appareil » permet de rejoindre la
   même démo (ordinateur + téléphone). Une démo inutilisée 30 jours est effacée.
3. **Rien ne sort.** Aucun e-mail réel, aucun paiement réel, rien n'est transmis à la distillerie.
   Les e-mails sont déposés dans la boîte d'envoi du CRM (« Courriels envoyés »), avec leur rendu.
   Les textes le disent honnêtement (« Démonstration : … »).
4. **Données fictives, catalogue réel.** Les 63 produits et 76 contenances viennent du catalogue
   officiel (`src/data/catalogue.json`, prix TTC exacts). Clients, comptes pro, commandes, stocks,
   tarifs professionnels, barèmes de livraison et colisages sont **fictifs** et signalés comme tels
   (« tarifs de démonstration »). Adresses e-mail fictives en domaines réservés (`example.com`,
   `example.org`, `example.net`, `blachere.example`). Pas de nom d'établissement réel connu.
5. **Mêmes règles que le site.** Âge légal (aucun alcool montré ni vendu sans vérification), loi
   Évin (message sanitaire avec tout alcool), PAC et Fun Blue écrits avec leurs logotypes
   (`src/lib/marques.js`), français soigné (espaces fines, guillemets « », apostrophes ’).
6. **Téléphone d'abord.** Le CRM et l'espace pro doivent être aussi agréables sur téléphone que sur
   ordinateur (le commanditaire travaille sur téléphone).

## 2. Architecture

```
api/                    Fonctions Vercel (Node 22, gestionnaires Web Request → Response)
  session.js            connexion, démo, mot de passe, profil
  site.js               formulaires publics, catalogue de la démo, créneaux de visite
  crm.js                back-office (personnel de la distillerie)
  pro.js                espace professionnel (clients pro)
  menage.js             tâche planifiée : efface les démos inactives (Vercel Cron, CRON_SECRET)
server/                 Code partagé (jamais exposé tel quel)
  http.js               lecture/validation des requêtes, réponses JSON, cookies, contrôle d'origine
  valider.js            validation stricte des saisies (types, longueurs, listes fermées, formats)
  store.js              pilotes de stockage : blob (production), fs (développement), memoire (tests)
  demo.js               bacs à sable : création, lecture, mutation atomique (ETag + reprise)
  auth.js               scrypt, cookies signés (HMAC), rôles et droits, verrouillage
  acces.js              cookie de démo, sessions bl_crm / bl_pro d'un appel
  limiteur.js           limiteurs en mémoire par adresse IP
  seed.js               jeu de démonstration déterministe (dates relatives au jour de création)
  modele.js             forme stockée (compacte) → forme rendue (complète) des éléments
  regles.js             prix, TVA, franco, livraison, stocks, statuts, numérotation, factures
  metier.js             opérations partagées : commandes, transitions, stocks, visites, abonnés
  operation.js          opérations du moment (Octobre Rose), d'après src/data/operation.js
  courriels.js          gabarits des e-mails (contenu structuré)
  evenements.js         journal et boîte d'envoi ; temps.js, typo.js, aleatoire.js, catalogue.js : outils
  routes/{session,site,crm,pro}.js
  generated/catalogue.js  catalogue pour le serveur, généré depuis src/data/products.js (esbuild,
                        scripts/server-catalogue.mjs, lancé avant dev et build ; un test vérifie qu'il
                        est à jour)
src/lib/api.js          client du navigateur (fetch, en-tête CSRF, erreurs)
crm.html + src/crm/     CRM (Preact + JSX), adresse /crm et /crm/…
pro.html + src/pro/     espace pro connecté (Preact + JSX), adresses /espace-pro/…
espace-pro.html         page publique de l'espace pro (présentation, connexion, demande de compte)
contact.html            nouvelle page Contact (formulaire branché)
test/                   tests node:test (règles, sécurité, parcours complets)
```

- **Fonctions** : chaque fichier `api/*.js` exporte `GET`, `POST`, `PATCH`, `DELETE` (Web
  `Request` → `Response`) qui délèguent à `server/routes/*`. La ressource est passée en paramètre
  `r` (`/api/crm?r=commandes&statut=nouvelle`), l'identifiant en `id`. Pas de route attrape-tout.
  Région `cdg1` (Paris), comme le stockage.
- **Stockage** : magasin **Vercel Blob privé** `blachere-crm` (région cdg1, relié au projet, variable
  `BLOB_READ_WRITE_TOKEN`). Une démo = un document JSON `demos/<id>.json`. Lecture avec
  `get(chemin, { access: 'private', useCache: false })` (toujours frais), écriture avec
  `put(…, { access: 'private', allowOverwrite: true, addRandomSuffix: false, ifMatch: etag })` :
  concurrence optimiste, reprise automatique (3 essais) sur `BlobPreconditionFailedError`. Toute
  mutation est une fonction pure du document, rejouable. En local et en test : pilote `fs`
  (dossier `.data/`, ignoré par git) ou `memoire`, avec la même sémantique d'ETag.
- **Coût** : une requête d'API = une lecture ; une action = une lecture + une écriture. Pas de
  `list()` hors du ménage quotidien. Les visiteurs du site sans démo ne déclenchent **aucun** appel.
- **Taille** : document visé < 400 Ko ; journal et boîte d'envoi plafonnés (500 entrées chacun).
- **Secrets** : `SESSION_SECRET` (signature des cookies, obligatoire sur Vercel : sans lui l'API
  refuse de fonctionner), `CRON_SECRET` (ménage). En local, secret de développement fixe.

## 3. Sessions, démo, rôles

- Cookie `bl_demo` : identifiant de la démo, signé (HMAC-SHA256), `HttpOnly; Secure; SameSite=Lax;
  Path=/; Max-Age=30 jours`. Cookie lisible `bl_demo_actif=1` (non `HttpOnly`) pour que les pages
  publiques sachent qu'une démo existe (barre de démo, prix et stocks de la démo).
- **Deux sessions indépendantes**, pour ouvrir le CRM et l'espace pro côte à côte dans le même
  navigateur : cookie `bl_crm` (personnel, lu seulement par `api/crm`) et cookie `bl_pro` (client
  pro, lu seulement par `api/pro`). Contenu : `{ sb, uid, v, exp }` en base64url + signature HMAC
  (clé dérivée par usage : la signature d'un `bl_crm` n'est pas valable comme `bl_pro`).
  `HttpOnly; Secure; SameSite=Lax; Path=/`. Durée : 12 h (personnel), 30 jours si « Rester
  connecté » (pro), sinon cookie de session. `v` = `sessionVersion` de l'utilisateur : la
  déconnexion de tous les appareils ou un changement de mot de passe l'incrémente. Une session n'est
  valable que dans sa démo (`sb` = démo du cookie `bl_demo`).
- Mots de passe : scrypt (N = 16384, r = 8, p = 1, sel de 16 octets), comparaison à temps constant,
  10 caractères au moins. 5 échecs → compte verrouillé 15 minutes (compteur dans le document) ;
  limiteur en mémoire par adresse IP en plus.
- Jetons d'invitation et de réinitialisation : 32 octets aléatoires, seul leur haché SHA-256 est
  stocké, validité 7 jours (invitation) ou 1 heure (réinitialisation), usage unique.
- Lien de partage de démo : jeton signé `{ sb, exp }` (7 jours) → `/api/session?r=rejoindre&jeton=…`
  pose `bl_demo` et redirige.
- **Rôles du personnel** (CRM) et droits — contrôlés côté serveur à chaque appel, l'interface ne fait
  que masquer :

| Rubrique | direction | commercial | logistique | boutique |
|---|---|---|---|---|
| Tableau de bord | ✔ | ✔ | ✔ | ✔ |
| Commandes en ligne | ✔ | lecture | ✔ | ✔ |
| Commandes pro, factures | ✔ | ✔ | ✔ (sans factures) | lecture |
| Clients particuliers | ✔ | lecture | lecture | ✔ |
| Comptes pro, demandes pro | ✔ | ✔ | lecture | — |
| Produits, prix | ✔ | lecture | lecture | lecture |
| Stocks | ✔ | lecture | ✔ | lecture |
| Visites | ✔ | lecture | — | ✔ |
| Messages | ✔ | ✔ | — | ✔ |
| Newsletter, codes promo | ✔ | ✔ | — | lecture |
| Courriels envoyés, journal | ✔ | ✔ | ✔ | ✔ |
| Équipe, paramètres, exports | ✔ | exports | exports | exports |

- `droits` (sur l'utilisateur public du personnel) : la liste des rubriques accessibles, chacune
  écrite `rubrique` (lecture et écriture) ou `rubrique:lecture`. Rubriques : `tableau`,
  `commandes` (commandes en ligne et par téléphone des particuliers), `commandes-pro`, `factures`,
  `clients`, `comptes` (comptes et demandes pro), `produits`, `stocks`, `visites`, `messages`,
  `newsletter` (newsletter et codes promo), `courriels`, `journal`, `equipe`, `parametres`,
  `exports`. Exemple, logistique : `['tableau', 'commandes', 'commandes-pro', 'clients:lecture',
  'comptes:lecture', 'produits:lecture', 'stocks', 'courriels', 'journal', 'exports']` (pas de
  `factures` : les commandes pro lui sont rendues sans leur facture).
- Rôle `pro` : n'accède qu'à `api/pro` et seulement aux données de **son** compte (`compteId`).
- **Comptes de démonstration** (mot de passe commun affiché sur les écrans de connexion en démo :
  `Distillerie1835`) : `direction@blachere.example` (Hélène Garnier, direction),
  `commercial@blachere.example` (Thomas Roux, commercial Vaucluse et Gard),
  `logistique@blachere.example` (Karim Benali, expéditions et stocks),
  `boutique@blachere.example` (Léa Fabre, boutique et visites), et le client pro
  `julien@cafe-des-platanes.example` (Julien Morel, « Café des Platanes », Avignon). Les boutons
  « Entrer en démo » connectent en un clic sans mot de passe.

## 4. Modèle de données (document d'une démo)

Identifiants : préfixe + 12 caractères base32 aléatoires (`cmd_…`, `cli_…`, `cpt_…`, `usr_…`,
`dem_…`, `res_…`, `sea_…`, `msg_…`, `abo_…`, `cam_…`, `pro_…`, `crl_…`, `jrn_…`, `adr_…`). Dates en
ISO 8601 UTC (`createdAt`), jours en `AAAA-MM-JJ`. Montants en euros, nombres à 2 décimales
(arrondi au centime à chaque ligne).

```ts
Demo = {
  v: 1, id, createdAt, updatedAt,
  seq: { web: number, pro: number, facture: number, visite: number, demande: number, message: number },
  parametres: Parametres,
  utilisateurs: Utilisateur[], comptes: Compte[], clients: Client[], commandes: Commande[],
  produits: Record<slug, ProduitDemo>, mouvements: MouvementStock[],
  demandes: DemandePro[], seances: Seance[], reservations: Reservation[], messages: Message[],
  abonnes: Abonne[], campagnes: Campagne[], promos: Promo[], courriels: Courriel[], journal: Entree[],
  vu: Record<usrId, { notifications: iso }>,
}
Utilisateur = { id, prenom, nom, email, role: 'direction'|'commercial'|'logistique'|'boutique'|'pro',
  compteId?, telephone?, poste?, actif, hash?, sessionVersion, echecs: { n, jusqua? }, invitation?: { hache, exp },
  reinit?: { hache, exp }, derniereConnexion?, createdAt, demo?: true }
Adresse = { id?, nom?, ligne1, ligne2?, cp, ville, pays: 'France', instructions? }
Compte = { id, raisonSociale, enseigne, type: 'chr'|'hotel'|'camping'|'caviste'|'epicerie'|'distributeur'|'autre',
  siret?, tvaIntra?, licence?: 'licence-iv'|'licence-restaurant'|'petite-licence-restaurant'|'vente-a-emporter'|'aucune',
  telephone?, email, adresseFacturation: Adresse, adressesLivraison: Adresse[], statut: 'actif'|'suspendu',
  grille: 'chr'|'caviste'|'distributeur', remise: number /* % en plus de la grille */,
  conditions: 'comptant'|'30j-fdm'|'45j'|'prelevement', francoHT: number, encoursMax: number,
  commercialId?, tags: string[], notes: string, origine: 'site'|'salon'|'commercial', createdAt }
Client = { id, prenom, nom, email, telephone?, adresse?: Adresse, newsletter: boolean, tags: string[],
  notes: string, origine: 'boutique-en-ligne'|'boutique'|'visite'|'newsletter'|'salon', createdAt }
Commande = { id, numero /* WEB-26-01042, PRO-26-00318 */, canal: 'en-ligne'|'pro'|'telephone',
  clientId?, compteId?, auteurId?, contact: { nom, email, telephone? },
  lignes: Ligne[], totaux: Totaux, livraison: Livraison, paiement: Paiement,
  statut: 'nouvelle'|'en-preparation'|'prete'|'expediee'|'livree'|'retiree'|'annulee'|'remboursee',
  suivi?: { transporteur, numero, url? }, referenceClient?, dateSouhaitee?, commentaire?,
  promo?: { code, remiseTTC, livraisonOfferte? }, facture?: Facture, ageConfirme?: boolean,
  operation?: { id, nom, beneficiaire, bouteilles, montant } /* Octobre Rose, commandes en ligne */,
  historique: { date, statut?, action, par: { id?, nom }, note? }[], notes: { date, par, texte }[],
  createdAt, updatedAt }
Ligne = { slug, varianteId, nom, volume, alcool: boolean, tva: 5.5|20, qte, colisage?,
  prixUnitaireHT, prixUnitaireTTC, totalHT, totalTTC }
Totaux = { articlesTTC, articlesHT, remiseTTC, livraisonTTC, livraisonHT, tva: { taux, baseHT, montant }[],
  totalHT, totalTVA, totalTTC }
Livraison = { mode: 'retrait'|'colissimo'|'relais'|'transporteur', libelle, prixTTC, adresse?: Adresse,
  jourRetrait?, relais?: { nom, adresse }, prixHT? /* pro */, adresseId? /* pro */ }
Paiement = { mode: 'carte'|'paypal'|'virement'|'a-reception'|'30j-fdm'|'45j'|'prelevement'|'comptant',
  statut: 'paye'|'en-attente'|'rembourse', reference?, date? }
Facture = { numero /* FA-26-00512 */, date, echeance, statut: 'a-regler'|'payee', payeeLe? }
ProduitDemo = { actif: boolean, variantes: Record<varianteId, { prixTTC, prixProHT, proManuel?, stock, seuil, colisage }> }
  /* prixProHT : tarif pro de référence (grille CHR) ; proManuel : fixé à la main dans le CRM (§ 5) */
MouvementStock = { id, date, slug, varianteId, delta, motif: 'production'|'vente'|'annulation'|'inventaire'|'casse'|'ajustement', par, commandeId? }
DemandePro = { id, reference /* DEM-26-0042 */, societe, activite, siret?, nom, email, telephone?, ville,
  message?, statut: 'nouvelle'|'en-cours'|'acceptee'|'refusee', note?, traiteePar?, traiteeLe?, compteId?, createdAt }
Seance = { id, date, heure, moment: 'matin'|'apres-midi', capacite, langue: 'fr'|'en'|'de',
  statut: 'ouverte'|'fermee', guideId?, notes? }
Reservation = { id, reference /* VIS-26-0142 */, seanceId, date, moment, personnes, mineurs, langue,
  nom, email, telephone?, message?, statut: 'confirmee'|'annulee'|'venue'|'absente',
  source: 'site'|'telephone'|'crm', newsletter: boolean, notes?, createdAt }
Message = { id, reference /* MSG-26-0088 */, nom, email, telephone?, sujet: 'commande'|'visite'|'pro'|'presse'|'autre',
  statut: 'nouveau'|'en-cours'|'traite'|'archive', assigneA?, compteId?, clientId?, lu: boolean,
  fil: { date, de: 'client'|'equipe', par?: { id, nom }, texte }[], createdAt }
Abonne = { id, email, prenom?, source: 'pied-de-page'|'commande'|'visite'|'contact'|'salon', statut: 'inscrit'|'desinscrit', inscritLe, desinscritLe? }
Campagne = { id, objet, introduction, corps, bouton?: { libelle, url }, segment: 'tous'|'clients'|'pros'|'visiteurs',
  statut: 'brouillon'|'envoyee', envoyeeLe?, destinataires?, creePar, createdAt }
Promo = { id, code, libelle, type: 'pourcentage'|'montant'|'livraison', valeur, minimumTTC, debut?, fin?,
  limite?, utilisations, actif }
Courriel = { id, date, a, objet, type: 'commande'|'expedition'|'retrait'|'facture'|'invitation'|'reinitialisation'|
  'reservation'|'reponse'|'demande-pro'|'campagne'|'bienvenue', contenu: { titre, paragraphes: string[],
  tableau?: { libelle, valeur }[], bouton?: { libelle, url } }, lie?: { type, id } }
Entree (journal) = { id, date, par: { id, nom, role } | { nom: 'Site' } | { nom: 'Système' }, action, cible?: { type, id, libelle }, details? }
Parametres = {
  livraison: { colissimo: [{ jusquA: bouteilles, prixTTC }], relais: [...], francoTTC, retraitGratuit: true },
  pro: { minimumHT, francoHT, fraisPortHT, delai: '48 à 72 h ouvrées' },
  visites: { capacite: 25, horaires: { matin: '10:30', 'apres-midi': '15:00' }, saison: { debut: 'MM-JJ', fin: 'MM-JJ' }, fermeLe: [0] },
  entreprise: { nom, adresse, telephone, email, siret?, tvaIntra?, rcs? } }
```

**Stockage compact.** Pour tenir sous 400 Ko, le document ne répète pas ce qui se recalcule
(`server/modele.js`) : une ligne de commande stockée ne garde que `{ slug, varianteId, qte,
prixUnitaireTTC }` (particulier) ou `{ slug, varianteId, qte, prixUnitaireHT, colisage }` (pro) ;
les totaux sont recalculés par les règles du § 5 depuis les lignes, la remise et le port
(`livraison.prixTTC`, ou `livraison.prixHT` pour un pro) ; un contact ou une adresse de livraison
absents sont ceux du client (ou du compte et de son adresse `adresseId`) ; les valeurs par défaut
(prix officiel, colisage par défaut, action de l'historique, capacité d'une séance, abonné
« inscrit »…) sont omises. **L'API rend toujours les éléments complets du modèle ci-dessus** : rien
ne change pour le CRM ni l'espace pro.

## 5. Règles métier (`server/regles.js`, testées)

- **TVA** : sirops et produits sans alcool 5,5 % ; boissons alcoolisées 20 %. Les prix du catalogue
  sont TTC. Les frais de port suivent le principal : TVA ventilée au prorata des bases HT par taux.
  Tous les totaux sont recalculés côté serveur ; le navigateur n'envoie que des quantités.
- **Tarifs pro (fictifs)** : prix HT de grille = prix TTC ÷ (1 + TVA) × coefficient (CHR 0,72 ;
  caviste 0,68 ; distributeur 0,60), arrondi au centime, puis remise du compte (arrondie au
  centime). `prixProHT` d'une variante = son tarif CHR de référence ; s'il est fixé à la main dans le
  CRM (`proManuel`), les autres grilles en découlent au prorata des coefficients. Colisage : 6 pour
  les 70 cl, 1 L et plus, 12 pour 50 cl et moins, 1 pour les coffrets et les flacons en étui
  (millésimes Elixir, Camarguaise Luxe) (fictif, « à confirmer »). L'espace pro commande par
  cartons (`qte` = nombre de bouteilles, multiple du colisage) ou à l'unité (colisage 1).
- **Livraison particuliers (barème de démonstration)** : retrait à la distillerie gratuit (jour
  souhaité, du lundi au samedi, de demain à J + 30) ; Colissimo domicile 1 à 2 bouteilles 9,90 €, 3 à
  6 : 14,90 €, 7 à 12 : 19,90 €, au-delà 24,90 € ; point relais 2 € de moins ; franco dès 120 € TTC
  d'articles (avant remise). Pas d'envoi hors de France métropolitaine dans la démo (Corse comprise ;
  codes postaux 97…, 98… refusés).
- **Pro** : minimum de commande 150 € HT ; franco 300 € HT sinon 18 € HT de port ; délai 48 à 72 h
  ouvrées ; paiement selon les conditions du compte ; encours (factures non réglées) + commande ≤
  `encoursMax`, sinon refus clair.
- **Alcool** : une commande en ligne contenant de l'alcool exige `ageConfirme: true` (la porte d'âge
  du site l'a établi) ; jamais de vente d'alcool à un compte pro sans licence adaptée à la vente
  d'alcool (`aucune` → spiritueux masqués dans le catalogue pro, refus serveur).
- **Stocks** : décrémentés à la création de la commande (mouvement « vente »), réincrémentés à
  l'annulation. Refus si stock insuffisant (message précis par produit). Stock ≤ seuil → « stock bas »
  (tableau de bord) ; 0 → « Rupture » sur le site de la démo.
- **Statuts** (machine à états, toute autre transition refusée) :
  `nouvelle → en-preparation → expediee → livree` ; `en-preparation → prete → retiree` (retrait) ;
  `nouvelle|en-preparation|prete → annulee` (restock + remboursement si payé) ;
  `expediee|livree|retiree → remboursee`. « Prête » et « retirée » ne valent que pour un retrait,
  « expédiée » et « livrée » que pour une livraison. `expediee` exige un numéro de suivi (sauf
  transporteur pro).
  Chaque transition : historique, journal, e-mail au client quand c'est utile (préparation,
  expédition avec suivi, prête au retrait, annulation, remboursement).
- **Factures** : commande pro → facture à l'expédition (ou au retrait) ; commande en ligne → facture
  à la création (payée ; par virement : à régler sous 7 jours, payée à réception). Numérotation continue sans trou `FA-AA-NNNNN`. Échéance selon les conditions
  (comptant : à réception ; 30 j fin de mois ; 45 j ; prélèvement : 10 jours). En retard si
  échéance dépassée et non payée (calculé, pas stocké).
- **Visites** : saison du 12 février au 31 décembre, fermé le dimanche, deux séances par jour
  (10 h 30, 15 h), 25 personnes au plus par séance. Le formulaire du site demande un jour et un moment
  (matin / après-midi) : la réservation est confirmée sur la séance correspondante s'il reste de la
  place, sinon refusée avec les autres disponibilités du jour (puis des jours suivants, 4 au plus).
  Mineurs comptés dans les personnes (au moins un adulte). Au-delà des séances enregistrées, chaque
  jour ouvert a ses deux séances aux réglages par défaut (créées à la première réservation). Une
  séance commencée n'est plus réservable.
- **Opérations du moment** (`src/data/operation.js`, partagé avec le site) : **Octobre Rose**, du
  1er au 31 octobre 2026 (jours de Paris), 1 € reversé à l'Institut du Cancer Avignon-Provence
  (Sainte-Catherine) par bouteille de PAC Citron vendue, « offre valable uniquement sur le site web et
  en boutique d'usine ». Une commande **en ligne** (`canal: 'en-ligne'`) passée pendant l'opération
  garde `operation: { id, nom, beneficiaire, bouteilles, montant }` (si au moins une bouteille est
  concernée) et son courriel de confirmation le dit (« Grâce à votre commande, 3 € seront reversés à
  l'Institut du Cancer Avignon-Provence (Sainte-Catherine) dans le cadre d'Octobre Rose. ») ; les
  commandes pro et par téléphone ne sont pas concernées. Le tableau de bord en fait le bilan (§ 7).
- **Codes promo** : vérifiés côté serveur (actif, dates, minimum, limite d'utilisations). Démo :
  `BIENVENUE10` (−10 %), `PACETE` (−5 € dès 40 €), `PORTOFFERT` (livraison offerte dès 60 €).
- **Numérotation** : `WEB-26-01043` (en ligne), `PRO-26-00319` (pro), `VIS-26-0143`, `DEM-26-0043`,
  `MSG-26-0089` (l'année sur deux chiffres suit la date de création).

## 6. Sécurité

- Toute écriture (`POST`, `PATCH`, `DELETE`) exige `Content-Type: application/json` (sinon 415),
  l'en-tête `X-Blachere: 1` et, si l'en-tête `Origin` est présent, qu'il corresponde à l'hôte (sinon
  403). Corps ≤ 64 Ko (sinon 413). Pas de CORS. Garde-fou : 240 écritures par minute et par adresse IP.
- Validation stricte de chaque champ (types, longueurs, listes fermées, e-mail, code postal,
  téléphone, SIRET 14 chiffres, quantités 1 à 999) ; champs inconnus ignorés ; textes nettoyés
  (espaces, caractères de contrôle) ; le front n'injecte jamais de HTML non échappé (Preact échappe).
- Autorisation vérifiée à chaque appel (rôle + appartenance au compte pour un pro) ; un identifiant
  d'un autre compte renvoie 404 (pas 403) pour ne rien révéler.
- Réponses `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`. Pages `/crm`,
  `/espace-pro`, `/api` : CSP stricte (`default-src 'self'`, `script-src 'self'`, `connect-src
  'self' https://v2x-studio.fr`, `frame-ancestors 'none'`…), `X-Frame-Options: DENY`.
- Aucune donnée personnelle dans les journaux de la plateforme (`console.*`) ; erreurs internes →
  message générique + identifiant d'erreur.
- Ménage : `api/menage` exige `Authorization: Bearer ${CRON_SECRET}`.
- Création de démo seulement en `POST` avec les contrôles ci-dessus (les robots ne créent rien) ;
  limiteur par IP (20 démos par heure et par instance).

## 7. API

Réponse : JSON. Succès `200` (`201` à la création) ; erreurs `{ erreur: 'Message en français',
champ?: 'email', code?: 'conflit'|'verrouille'|'stock'|… }` avec `400` (saisie), `401` (non
connecté), `403` (droit), `404`, `405` (méthode), `409` (conflit, stock), `413` (trop gros), `415`
(pas du JSON), `423` (verrouillé), `429`, `500` (`{ erreur, reference }`). Les messages suivent la
typographie française (espaces insécables avant « : », « ; », « ? », dans « »). Listes
paginées : `?page=1&par=25` → `{ elements, total, page, pages }`. Tris : `?tri=date|-date|total…`.

### `api/session`

| Méthode | `r` | Corps / paramètres | Réponse |
|---|---|---|---|
| GET | `moi` | `espace=crm\|pro` | `{ utilisateur: Utilisateur public \| null, compte?: { id, raisonSociale, enseigne }, demo: { active, creeLe?, expireLe? } }` |
| POST | `connexion` | `{ email, motDePasse, espace: 'crm'\|'pro', resterConnecte? }` | pose `bl_crm` ou `bl_pro` → `{ utilisateur, redirection }` (un compte pro sur l'écran du CRM, ou l'inverse, est refusé avec un message qui oriente) |
| POST | `deconnexion` | `{ espace: 'crm'\|'pro', partout? }` | `{ ok }` (`partout: true` : tous les appareils, `sessionVersion` + 1) |
| POST | `demo` | `{ profil: 'direction'\|'commercial'\|'logistique'\|'boutique'\|'pro' }` | crée la démo si besoin, connecte dans l'espace correspondant (sans toucher à l'autre session) → `{ utilisateur, redirection }` |
| POST | `partager` | `{ vers? }` (connecté) | `{ lien (adresse absolue), expireLe }` |
| GET | `rejoindre` | `jeton`, `vers=crm\|pro` | pose `bl_demo` puis 302 vers `/crm` ou `/espace-pro` (écran de connexion avec les profils de démo) ; lien invalide ou expiré : 302 vers `/crm?demo=lien-invalide` (ou `/espace-pro?…`) |
| POST | `reinitialiser` | — (connecté, démo) | remet le jeu de démonstration, garde la session → `{ ok }` |
| POST | `quitter` | — | efface les cookies de démo et des deux sessions → `{ ok }` |
| POST | `oubli` | `{ email, espace }` | `{ ok, lienDemo? }` (toujours `ok` ; le lien n'est rendu qu'en démo, pour tester) |
| POST | `reinitialiser-mot-de-passe` | `{ jeton, motDePasse }` | connecte → `{ utilisateur, redirection }` |
| GET | `invitation` | `jeton` | `{ email, prenom, espace: 'crm'\|'pro', compte? }` ou 404 |
| POST | `activer` | `{ jeton, motDePasse }` | connecte → `{ utilisateur, redirection }` |
| POST | `mot-de-passe` | `{ espace, actuel, nouveau }` | `{ ok }` (incrémente `sessionVersion`, renvoie un nouveau cookie) |

`Utilisateur public` = `{ id, prenom, nom, email, role, compteId?, telephone?, derniereConnexion? }`
+ `poste?` + pour le personnel `droits: string[]` (rubriques accessibles, en écriture ou lecture :
voir § 3). Connexion sans démo : seuls les comptes de démonstration ouvrent une démo (créée à ce
moment). Lien de réinitialisation : `/crm/mot-de-passe?jeton=…` ou `/espace-pro/mot-de-passe?jeton=…` ;
invitation : `/crm/activer?jeton=…` ou `/espace-pro/activer?jeton=…` (jeton résolu dans la démo du
navigateur).

### `api/site` (public)

| Méthode | `r` | Corps / paramètres | Réponse |
|---|---|---|---|
| GET | `catalogue` | — | sans démo : `204`. Avec démo : `{ produits: { [slug]: { actif, variantes: { [id]: { prixTTC, etat: 'disponible'\|'stock-bas'\|'rupture' } } } } }` |
| GET | `creneaux` | `mois=AAAA-MM` (du mois dernier à 13 mois) | `{ jours: [{ date, ouvert, matin: { heure, restantes }, apresMidi: { heure, restantes } }] }` (sans démo : calculé depuis le jeu de démonstration du jour, rien n'est créé ; jour passé, fermé ou hors saison : `ouvert: false` ; séance commencée ou fermée : `restantes: 0`) |
| POST | `livraison` | `{ lignes: [{ slug, varianteId, qte }], mode?, cp? }` | `{ options: [{ mode, libelle, prixTTC, delai, disponible, raison? }], francoRestantTTC, articlesTTC, bouteilles }` (sans démo : prix du catalogue, rien n'est créé) |
| POST | `code-promo` | `{ code, lignes }` | `{ valide, code, libelle, remiseTTC, livraisonOfferte }` ou 400 `champ: 'code'` (rien n'est créé) |
| POST | `commande` | `{ client: { prenom, nom, email, telephone }, livraison: { mode: 'retrait'\|'colissimo'\|'relais', adresse?: { ligne1, ligne2?, cp, ville, instructions? }, jourRetrait? }, paiement: { mode: 'carte'\|'paypal'\|'virement' }, lignes: [{ slug, varianteId, qte }], code?, ageConfirme, newsletter, cgv: true }` | `201 { id, numero, totalTTC, statut, paiement: { mode, statut }, liens: { crm }, operation? }` ; stock insuffisant : `409 { code: 'stock', details: [{ slug, varianteId, nom, demande, disponible }] }` |
| POST | `reservation` | `{ date, moment: 'matin'\|'apres-midi', personnes (1 à 25), mineurs, langue: 'fr'\|'en'\|'de', nom, email, telephone?, message?, rgpd: true, newsletter }` | `201 { reference, date, moment, heure, liens }` ou `409 { erreur, code: 'complet', restantes, disponibilites: [{ date, moment, heure, restantes }] }` |
| POST | `contact` | `{ nom, email, telephone?, sujet: 'commande'\|'visite'\|'pro'\|'presse'\|'autre', message, rgpd: true }` | `201 { reference, liens }` |
| POST | `newsletter` | `{ email, prenom?, source: 'pied-de-page'\|'commande'\|'visite'\|'contact'\|'salon' }` | `201 { ok, liens }` (déjà inscrit → `200 { ok, deja: true, liens }`) |
| POST | `demande-pro` | `{ societe, activite: 'chr'\|'hotel'\|'camping'\|'caviste'\|'epicerie'\|'distributeur'\|'autre', siret?, nom, ville, email, telephone?, message?, rgpd: true }` | `201 { reference, liens }` |

Tout `POST` qui enregistre (commande, réservation, contact, newsletter, demande pro) crée la démo si
elle n'existe pas (rien n'est créé si la saisie est refusée) et renvoie `liens: { crm: '/crm/…' }`
vers l'élément créé, pour le bouton « Voir dans le CRM (démo) ». Adresses du CRM :
`/crm/commandes/<id>`, `/crm/clients/<id>`, `/crm/comptes/<id>`, `/crm/demandes/<id>`,
`/crm/visites/<id de réservation>`, `/crm/messages/<id>`, `/crm/newsletter/<id d'abonné>`,
`/crm/newsletter/campagnes/<id>`, `/crm/produits/<slug>`.

### `api/crm` (personnel)

Toutes les ressources exigent une session `bl_crm` (sinon 401) et le droit du rôle sur la rubrique
(sinon 403, avant toute lecture de la saisie). Montants du tableau de bord : **HT**. Un identifiant
inconnu ou mal formé → 404.

| Méthode | `r` | Détail |
|---|---|---|
| GET | `tableau` | `{ ca: { jour, semaine (depuis lundi), mois, moisPrecedent, enLigne30 (particuliers : en ligne et téléphone), pro30 }, commandes30, panierMoyen30, aTraiter: { commandes (nouvelles et en préparation), demandes (nouvelles), messages (nouveaux), reservationsJour, facturesEnRetard }, ventes30: [{ date, enLigne, pro }], top: [{ slug, nom, qte, totalHT }] (5, sur 30 jours), stocksBas: [{ slug, varianteId, nom, volume, stock, seuil, etat, actif }], prochainesVisites: [Séance vue¹] (5), activite: Entree[] (10 dernières), operation, montants: 'HT' }` — commandes annulées et remboursées exclues ; `operation` = `{ id, nom, beneficiaire, debut, fin, enCours: boolean, bouteilles, montant, commandes }` (Octobre Rose : commandes en ligne non annulées ni remboursées dont le jour de Paris est dans la période), présent pendant l'opération et 30 jours après sa fin (virement du don), sinon `null` |
| GET | `notifications` | `{ commandes, demandes (créées depuis la dernière consultation), messages (non lus), stocksBas, version, vuLe }` (version = `updatedAt`) — appelé toutes les 30 s quand l'onglet est visible et actif ; 0 pour une rubrique sans droit |
| POST | `notifications-vues` | marque vu → `{ ok, vuLe }` |
| GET | `recherche` | `q` (2 caractères au moins, sans accents) → `{ resultats: [{ type: 'commande'\|'client'\|'compte'\|'demande'\|'message'\|'reservation'\|'produit', id, titre, sousTitre, url }] }` (30 au plus, selon les droits) |
| GET | `commandes` | `statut, canal, du, au, q, compteId, clientId, page, par, tri=date\|total\|numero\|statut (‑ pour décroissant)` → `{ elements: [{ id, numero, date, canal, client: { id, nom, type: 'particulier'\|'pro' }, articles, totalHT, totalTTC, paiement: { mode, statut }, statut, alerte?, operation? }], total, page, pages, compteurs: { [statut]: n } }` |
| GET | `commande` | `id` → Commande complète (§ 4 ; sans `facture` pour un rôle sans droit sur les factures) + `client?: { id, nom, email, telephone, commandes }`, `compte?: { id, raisonSociale, enseigne, type, conditions, licence, telephone, email, encours?, encoursMax? }`, `auteur?: { id, nom }`, `transitions: [{ statut, libelle, exigeSuivi }]` (vide sans droit d'écriture), `alerte?` |
| POST | `commande` | saisie (téléphone ou pro) : `{ compteId, lignes, livraison?: { adresseId? }, dateSouhaitee?, referenceClient?, commentaire?, note? }` (droit `commandes-pro` ; colisage non imposé) ou `{ client: { prenom, nom, email, telephone? }, lignes, livraison: { mode, adresse?, jourRetrait? }, paiement: { mode: 'carte'\|'virement'\|'a-reception'\|'comptant', statut?: 'paye'\|'en-attente' }, code?, ageConfirme?, newsletter?, note? }` (droit `commandes`, canal `telephone`) → `201` commande complète |
| PATCH | `commande` | `id`, `{ statut?, suivi?: { transporteur?, numero?, url? (https) }, note?, paiementStatut?: 'paye', factureStatut?: 'payee'\|'a-regler' (droit factures) }` → commande complète |
| POST | `commandes-statut` | `{ ids (100 au plus), statut }` → `{ ok: [id], erreurs: [{ id, numero?, erreur }] }` (une commande refusée n'empêche pas les autres) |
| GET | `clients` / `client` | liste (`q, segment: 'tous'\|'newsletter'\|'fideles' (3 commandes ou plus)\|'inactifs' (aucune commande depuis 90 jours), page, par, tri=nom\|date\|total\|commandes\|derniere`) → `{ elements: [{ id, prenom, nom, email, telephone, ville, newsletter, tags, origine, commandes, totalTTC, derniereCommande, createdAt }], …, compteurs }` ; fiche → Client + `commandes` (résumés), `totaux: { commandes, totalTTC, panierMoyen, premiereCommande, derniereCommande }`, `reservations`, `messages`, `abonnement` |
| POST / PATCH / DELETE | `client` | créer `{ prenom, nom, email, telephone?, adresse?, newsletter?, tags?, notes?, origine? }` (e-mail déjà connu → 409) ; modifier (mêmes champs ; `newsletter` inscrit ou désinscrit l'abonné) ; supprimer (RGPD : client et abonnement effacés, commandes anonymisées, réservations, messages et courriels aussi) → `{ ok, commandesAnonymisees }` |
| GET | `client-export` | `id` → JSON des données personnelles (RGPD, en pièce jointe ; droit d'écriture sur les clients) |
| GET | `comptes` / `compte` | liste (`q, type, statut, commercial, page, par, tri=nom\|ca\|date\|encours`) → `{ id, enseigne, raisonSociale, type, ville, statut, grille, remise, conditions, licence, commercial: { id, nom }, ca12 (HT), encours?, encoursMax?, derniereCommande, utilisateurs, tags }` ; fiche → Compte + `commercial: { id, nom, email, telephone }`, `utilisateurs: [{ id, prenom, nom, email, telephone, statut: 'actif'\|'invitation'\|'desactive', derniereConnexion, invitationExpireLe? }]`, `commandes`, `ca12`, `messages`, et pour qui voit les factures `encours`, `factures: [{ numero, date, echeance, statut, payeeLe?, enRetard, totalTTC, commandeId, commandeNumero }]` |
| POST / PATCH | `compte` | créer `{ raisonSociale, enseigne, type, siret?, tvaIntra?, licence, telephone?, email, adresseFacturation, adressesLivraison?, grille, remise?, conditions, francoHT?, encoursMax?, commercialId?, tags?, notes?, utilisateur?: { prenom, nom, email } }` → `201 { compte, utilisateur?, lienDemo? }` (invitation du premier utilisateur) ; modifier les mêmes champs + `statut: 'actif'\|'suspendu'` (suspendu : sessions pro fermées) |
| POST | `compte-utilisateur` | `{ compteId, prenom, nom, email }` → invitation (courriel) → `201 { utilisateur, lienDemo }` (e-mail déjà utilisé → 409) |
| GET / PATCH | `demandes` / `demande` | liste (`statut`, paginée, + `compteurs`) ; fiche `id` ; modifier `{ statut?: 'nouvelle'\|'en-cours', note? }` |
| POST | `demande-accepter` | `id`, `{ grille, remise?, conditions, commercialId?, encoursMax, licence? (défaut 'aucune' : pas d'alcool tant qu'elle n'est pas renseignée), type? (défaut : l'activité), adresse?, francoHT? }` → crée compte + utilisateur + invitation (courriel) → `201 { compte, utilisateur, lienDemo, demande }` (demande déjà traitée → 409) |
| POST | `demande-refuser` | `id`, `{ motif }` → courriel de réponse → demande |
| GET | `produits` | `q, gamme, stock=tous\|bas\|rupture` → `{ elements: [{ slug, nom, type, gamme, gammeNom, univers, alcool, degre, photo, reference, actif, enLigne, variantes: [{ id, volume, coffret, prixTTC, prixOfficielTTC, prixProHT, proManuel, tva, stock, seuil, colisage, etat, vendus30 }] }], total, page, pages, compteurs, gammes }` |
| PATCH | `produit` | `slug`, `{ actif?, variantes?: { [id]: { prixTTC?, prixProHT?, seuil?, colisage? } } }` → produit (un `prixProHT` fixé → `proManuel: true` ; sinon il suit le prix TTC) |
| POST | `stock` | `{ slug, varianteId, delta, motif: 'production' (positif)\|'inventaire'\|'casse' (négatif)\|'ajustement', note? }` → `201 { mouvement, stock, etat }` (stock négatif → 409) |
| GET | `mouvements` | `slug?` → mouvements récents (200 au plus, paginés), avec `nom`, `volume` |
| GET | `visites` | `du, au` (défaut : aujourd'hui + 13 jours ; 120 jours au plus) → `{ du, au, seances: [Séance vue¹], reservations: [Réservation + heure] }` |
| POST / PATCH | `seance` | ajouter `{ date, moment, heure?, capacite?, langue?, guideId?, notes? }` (même un jour habituellement fermé ; doublon → 409) ; modifier `{ capacite? (≥ inscrits), statut?: 'ouverte'\|'fermee', langue?, guideId?, notes? }` |
| POST / PATCH | `reservation` | saisie `{ seanceId \| date + moment, personnes, mineurs?, langue?, nom, email, telephone?, message?, notes?, newsletter?, source?: 'telephone'\|'crm' }` (complet → 409 avec disponibilités) ; modifier `{ statut?: 'confirmee'\|'annulee'\|'venue'\|'absente', personnes?, mineurs?, seanceId?, notes? }` |
| GET | `messages` / `message` | liste (`statut, q`, paginée, + `compteurs` dont `nonLus`) → `{ id, reference, nom, email, telephone?, sujet, statut, lu, assigneA: { id, nom } \| null, extrait, dernierMessage, nbMessages, compte?, client?, createdAt }` ; fiche (+ `fil`) : la lecture le marque lu |
| PATCH | `message` | `{ statut?, assigneA? (id du personnel ; null pour retirer), lu? }` |
| POST | `message-reponse` | `id`, `{ texte }` → fil + courriel → `201` message |
| GET | `newsletter` | `{ abonnes: { total, inscrits, desinscrits, parSource, evolution: [{ mois, inscrits, nouveaux }] (12 mois) }, liste: { elements, total, page, pages } (`q, statut, source`), campagnes }` |
| POST / PATCH / DELETE | `campagne` | brouillon `{ objet, introduction, corps, segment: 'tous'\|'clients'\|'pros'\|'visiteurs', bouton?: { libelle, url (/… ou https://…) } }` ; modifier ; supprimer un brouillon (envoyée → 409) |
| POST | `campagne-envoyer` | `id` → « envoyée » à N destinataires (simulation, 1 courriel d'exemple dans la boîte d'envoi) → `{ ok, destinataires, campagne }` |
| PATCH / DELETE | `abonne` | `{ statut: 'inscrit'\|'desinscrit' }` ; supprimer (RGPD) |
| GET / POST / PATCH | `promos` / `promo` | liste (+ `etat: 'actif'\|'inactif'\|'a-venir'\|'expire'\|'epuise'`) ; créer `{ code, libelle, type, valeur, minimumTTC?, debut?, fin?, limite?, actif? }` (code existant → 409) ; modifier (null efface `debut`, `fin`, `limite`) |
| GET | `courriels` / `courriel` | boîte d'envoi (`type, q`, paginée, du plus récent) ; détail `id` avec `contenu` |
| GET | `journal` | `page, par (taille de page), action (préfixe : « commande » ou « commande.statut »), auteur (id)` → paginé + `actions` (liste des codes) |
| GET / POST / PATCH | `equipe` / `membre` | personnel : direction → `{ membres: [{ id, prenom, nom, email, role, roleNom, poste, telephone, actif, statut, derniereConnexion, demo, invitationExpireLe? }] }`, autres rôles → noms seulement (attribution) ; inviter `{ prenom, nom, email, role, poste?, telephone? }` → `201 { membre, lienDemo }` ; modifier `{ role?, actif?, poste?, telephone? }` (rôle ou accès changé : ses sessions sont fermées ; pas sur soi-même → 409) |
| GET / PATCH | `parametres` | réglages (direction) ; modifier par rubrique `{ livraison?: { colissimo?, relais?, francoTTC? }, pro?: { minimumHT?, francoHT?, fraisPortHT?, delai? }, visites?: { capacite?, horaires?, saison?, fermeLe? }, entreprise?: {…} }` |
| GET | `export` | `type=commandes\|clients\|comptes\|abonnes\|reservations\|produits` (droit exports + lecture de la rubrique) → CSV UTF-8 avec BOM, séparateur `;`, décimales à virgule, dates JJ/MM/AAAA, pièce jointe `<type>-AAAA-MM-JJ.csv`, cellules commençant par = + - @ neutralisées (commandes : colonne « Don Octobre Rose (€) ») |

¹ Séance vue = Séance (§ 4) + `inscrits`, `restantes`, `reservations` (nombre), `guide?: { id, nom }`.

### `api/pro` (client pro connecté, limité à son compte)

Session `bl_pro` d'un utilisateur actif d'un compte **actif** (compte suspendu : 401, connexion
refusée avec `code: 'suspendu'`). Un identifiant d'un autre compte rend 404, comme un identifiant
inconnu. Les commandes rendues au pro n'ont ni notes internes ni identifiants du personnel.

| Méthode | `r` | Détail |
|---|---|---|
| GET | `accueil` | `{ compte, commercial: { nom, email, telephone, poste? }, encours, encoursMax, commandesEnCours: [résumé²], derniereCommande: résumé² \| null, facturesARegler: { nombre, totalTTC, enRetard, prochaineEcheance }, suggestions: [{ slug, varianteId, nom, volume, photo, colisage, prixHT, raison }] (4 au plus), conditions: { minimumHT, francoHT, fraisPortHT, delai } }` |
| GET | `catalogue` | produits visibles pour ce compte (en vente ; spiritueux seulement avec une licence) : `{ produits: [{ slug, nom, type, gamme, gammeNom, univers, alcool, degre, photo, variantes: [{ id, volume, coffret, colisage, parCarton, prixHT, prixCartonHT, prixTTC, prixPublicTTC, tva, etat }] }], conditions: { minimumHT, francoHT, fraisPortHT, delai }, grille, remise, spiritueux: boolean, mentions?: { evin, mineurs } }` |
| POST | `devis` | `{ lignes }` → `{ lignes (Ligne complète), totaux, francoRestantHT, alertes: [{ type: 'produit'\|'licence'\|'colisage'\|'stock'\|'minimum'\|'encours', message, slug?, varianteId?, disponible? }], valide, mentions? }` — sans rien enregistrer |
| POST | `commande` | `{ lignes: [{ slug, varianteId, qte (bouteilles, multiple du colisage) }], adresseId?, dateSouhaitee?, referenceClient?, commentaire? }` → `201` commande complète (`numero`, `totaux`, `livraison.adresse`…) ; refus : 400 `colisage`, `minimum`, `adresse`, 403 `licence`, 409 `stock`, `encours` |
| GET | `commandes` / `commande` | historique (`statut, page, par, tri=date\|total\|numero`) → résumés² ; détail : commande complète (suivi, historique, facture avec `enRetard`) |
| GET | `recommander` | `id` → `{ depuis: { id, numero, date }, lignes: [{ slug, varianteId, nom, volume, qte (arrondie au carton, bornée au stock), colisage, prixHT, etat }], indisponibles: [{ …, raison }] }` |
| GET | `factures` | `{ factures: [{ numero, date, echeance, statut, payeeLe?, enRetard, totalHT, totalTVA, totalTTC, commandeId, commandeNumero }], totalARegler, enRetard, emetteur (coordonnées de la distillerie), client }` |
| GET | `documents` | `{ fiches: [{ slug, nom, nomOfficiel, type, gammeNom, alcool, degre, reference, photo, photoGrande, phrase, ingredients, nutrition, contenances, mentions }], mediatheque: [{ titre, type: 'logo'\|'photo', format, url }], plv, conditions }` |
| GET / PATCH | `compte` | `{ compte (raison sociale, SIRET, conditions… en lecture), utilisateurs: [{ id, prenom, nom, email, statut, derniereConnexion }], commercial }` ; modifier `{ telephone?, email? }` (rien d'autre : 400) → compte |
| POST / PATCH / DELETE | `adresse` | ajouter `{ nom?, ligne1, ligne2?, cp, ville, instructions? }` (10 au plus) → `201` adresse ; modifier `id` (remplace l'adresse) ; supprimer `id` (les commandes gardent l'adresse du jour de la commande) |
| GET / POST | `messages` / `message` | liste paginée `[{ id, reference, sujet, statut, extrait, dernierMessage, nbMessages, createdAt }]` ; détail `id` + `fil: [{ date, de, nom, texte }]` ; nouveau `{ texte, sujet? (défaut 'pro') }` ou réponse `{ id, texte }` → `201` (arrive non lu dans les messages du CRM, attribué au commercial du compte) |

² Résumé = `{ id, numero, date, statut, statutLibelle, articles, totalHT, totalTTC, referenceClient?, dateSouhaitee?, suivi?, facture?: { numero, statut, echeance, enRetard } }`.

## 8. Écrans

### CRM (`/crm`)

Application de gestion plein écran, sans l'en-tête du site. Barre latérale sombre (encre `#15130f`,
blason blanc, « CRM »), indicateur actif fuchsia PAC ; contenu sur papier `#f7f5f0`, cartes blanches,
filets fins, Archivo en chiffres tabulaires. Sur téléphone : barre du haut + barre d'onglets en bas
(Tableau, Commandes, Visites, Messages, Plus), tableaux transformés en cartes, actions principales
collées en bas d'écran, cibles de 44 px.

Rubriques : Tableau de bord ; Commandes ; Clients ; Comptes pro ; Demandes pro ; Produits et
stocks ; Visites ; Messages ; Newsletter ; Codes promo ; Courriels envoyés ; Équipe ; Journal ;
Paramètres. Plus : recherche globale (⌘K / bouton loupe), notifications (cloche, compteurs vivants),
menu de démo (rôle actif, changer de profil, ouvrir l'espace pro de démo, partager la démo avec QR
code texte, réinitialiser, quitter la démo), impression de la facture et du bon de préparation
(feuilles A4 propres), exports CSV. Graphiques en SVG maison (pas de bibliothèque). États vides,
chargements, erreurs, confirmations et notifications (« toasts ») soignés.

### Espace pro

- `/espace-pro` (public, avec l'en-tête et le pied du site) : présentation, connexion (avec « Mot de
  passe oublié ? »), demande de compte branchée, bouton « Découvrir l'espace pro (démo) ».
- `/espace-pro/accueil`, `/catalogue`, `/commande`, `/commandes`, `/commandes/<id>`, `/factures`,
  `/documents`, `/compte`, `/messages`, `/activer?jeton=…`, `/mot-de-passe?jeton=…` (application
  connectée, avec l'en-tête et le pied du site et une barre d'espace pro : nom du compte, onglets).
  Commande par cartons, barre de progression du franco, adresse de livraison, référence de commande,
  date souhaitée ; recommander en un geste ; factures imprimables ; fiches techniques imprimables ;
  médiathèque (logos SVG, photos des bouteilles) ; message sanitaire avec tout alcool.

### Site public

- Commande (`/panier`) : livraison et totaux calculés par l'API, code promo, enregistrement réel de
  la commande dans la démo, confirmation avec numéro et « Voir dans le CRM (démo) ».
- Visiter : disponibilités réelles par jour et moment, réservation enregistrée.
- Contact (nouvelle page), lettre d'information (pied de page), demande de compte pro : branchés.
- Boutique et fiches : quand une démo existe, prix et ruptures de la démo appliqués.
- Barre de démo discrète (en bas à droite, la pastille V2X est en bas à gauche) quand une démo est
  active : « Démo · CRM · Espace pro · Quitter ».

## 9. Recette

- `npm test` : règles (TVA, prorata du port, franco, minimum, encours, stocks, transitions,
  numérotation, échéances), sécurité (signature des cookies, falsification, CSRF, droits par rôle,
  isolement des comptes pro et des démos, verrouillage), stockage (conflits d'ETag et reprise), et
  parcours complets à travers les gestionnaires.
- Recette navigateur (Playwright, Chromium) en local avec le pilote `fs` : démo → commande sur le site
  → CRM → expédition → espace pro → commande pro → facture ; aucun message d'erreur dans la console ;
  captures téléphone (390 px) et ordinateur (1440 px).
- `npm run qa` (recette existante du site) toujours au vert.
