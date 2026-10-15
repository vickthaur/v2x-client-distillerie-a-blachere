# Distillerie A. Blachère · maquette de refonte v3

Proposition de nouveau site pour la **Distillerie A. Blachère** (Avignon 1835, Châteauneuf-du-Pape
depuis 1993), préparée par V2X Studio. Maquette non indexée (`noindex` dans les pages et les en-têtes
Vercel, `robots.txt` qui interdit tout), avec la pastille « Proposition de refonte » de V2X
(`public/v2x/`, inchangée).

- Site actuel : https://www.distillerieablachere.com/
- **Source de vérité depuis la v3** : les visuels et le catalogue officiels relevés sur le site le
  14 octobre 2026 (branche `photos-site`, commit `513b695`, jamais fusionnée dans `main`), importés par
  `scripts/import-site.mjs` : noms, contenances, prix, degrés, descriptions, ingrédients, valeurs
  nutritionnelles, « le saviez-vous ? », photos des produits, étiquettes à plat, archives, recettes,
  textes (Histoire, Contact, CGV, mentions légales, « On parle de nous ») et logos.
- Ce que le site officiel ne dit pas vient de la note de prospection (`V2X-Studio/research_notes/Sites
  web datés entreprises Vaucluse/blachere_et_spiritueux.md`, sections 1 à 3) et de son complément
  (`blachere_catalogue_complement.*`). Rien d'inventé : une valeur inconnue est contournée (« Prix en
  boutique », « Date à préciser ») ou signalée « à confirmer ».

## Direction artistique v3

- **Le réalisme d'abord.** Les bouteilles sont construites à partir des vraies photos (« scan 3D »),
  posées sur un plateau de studio photographique (fond en arrondi, lumière, ombres de contact,
  reflets au sol, caustiques), avec des citrons, tranches, glaçons et feuilles de menthe photoréalistes
  en suspension lente. **Aucune illustration dessinée hors des archives** : plus de femme à la paille
  coupée, de lagon, d'île, de pastilles de couleur ni de titres détourés.
- **Structure de grande marque** : barre utilitaire (Où acheter, Espace pro, Visiter, FR/EN/DE, Compte,
  Panier), navigation à méga-menus avec rendus des bouteilles (Nos marques, Spiritueux 18+, La maison,
  Visiter, Boutique), recherche, en-tête collant qui se resserre au défilement, menu plein écran sur
  téléphone avec vignettes ; accueil dans l'ordre d'une campagne : PAC Citron et Fun Blue en 3D →
  nos marques → carrousel avec prix → la maison en chiffres → savoir-faire → archives → visite →
  presse → où acheter et espace pro → lettre d'information → pied de page complet.
- **Typographie** : grotesque Archivo (titres affirmés, interface) et serif patrimoniale Fraunces
  (accents en italique). Aplats de couleur de marque contrôlés (fuchsia PAC, bleu Fun Blue, crème
  Couleur Provence) réservés aux chapitres de marque ; boutique et fiches sur fonds neutres.
- **Les marques PAC et Fun Blue** : logotypes vectorisés depuis les étiquettes dans tous les titres et
  étiquettes ; police la plus proche et couleur de marque dans le texte courant (voir plus bas).
- **Spiritueux sobres et photographiques** : les quatre rayons officiels, racontés par la page
  Histoire et illustrés par les archives et les photos du chai ; pas de décor ni de rotation
  automatique en 3D.
- **Archives présentées comme au musée** : cadres, passe-partout, cartels (titre, date telle qu'elle
  est imprimée, technique, statut), fond pierre.

Polices (SIL OFL, sous-ensemble latin, auto-hébergées dans `src/fonts`, licences jointes) : Archivo,
Fraunces, Lobster Two 700 italique (nom « pac » dans le texte), Molle italique (nom « Fun Blue » dans
le texte) ; Spicy Rice, Federant, Della Respira et Cinzel ne servent plus qu'aux bouteilles dessinées
de secours. Aucune requête vers un CDN.

## Plan du site

| Adresse | Page |
|---|---|
| `/` | Campagne 3D (PAC Citron et Fun Blue, étiquettes réelles), nos marques, carrousel avec prix, la maison en chiffres, savoir-faire, archives, visite, presse, où acheter et espace pro |
| `/pac-citron`, `/fun-blue` | Campagne 3D sur l'aplat de la marque, carte de prix, l'histoire racontée par la fiche officielle et la page Histoire, le rituel, la composition, les recettes, les étiquettes d'archives, la presse (PAC), les formats |
| `/couleur-provence` | Trois bouteilles en 3D sur le plateau crème, les 26 parfums rangés par contenance avec leurs prix, recettes, sirops d'hier |
| `/recettes` | Les 26 recettes du site (textes exacts, photos) ; sans alcool par défaut, « Toutes · 18+ » après vérification de l'âge |
| `/spiritueux` | Porte d'âge ; les quatre rayons officiels (apéritifs et pastis, liqueurs, crèmes et eaux-de-vie, vieux marcs) |
| `/la-maison` | L'histoire officielle en quatre époques (texte exact), archives de chaque époque, savoir-faire, papiers de la rue Molière, chantier (`/la-distillerie` y redirige) |
| `/musee` | Les archives : 46 pièces en trois ailes (sirops, maison, spiritueux 18+), pièce en grand, pièces sans visuel |
| `/visiter` | Formules, réservation en mode maquette, horaires officiels, accès, questions fréquentes |
| `/boutique`, `/boutique/<slug>` | Boutique filtrée et fiches produits avec bouteille 3D et textes officiels |
| `/panier` | Panier et commande en mode maquette (CGV officielles) |
| `/actualites` | Nouvelles datées et sourcées ; « On parle de nous » du site officiel (20 articles et vidéos) |
| `/ou-trouver`, `/espace-pro` | Points de vente (liste indicative) ; connexion et demande de compte (maquette) |
| `/mentions-legales`, `/conditions-de-vente`, 404 | Textes officiels repris tels quels ; page « évaporée » (statut 404) |

## Bouteilles « scan 3D »

`scripts/photos.mjs` (sharp, lancé avant `vite dev` et `vite build`) traite `photos/produits/<slug>.webp`
(les packshots officiels détourés) vers `public/bouteilles/<slug>/` (non versionné) :

1. **Silhouette** mesurée ligne par ligne, axe et redressement automatiques (réglages par photo dans
   `photos/produits/<slug>.json` : la Verveine « Auguste », dont l'étiquette suspendue au col faussait
   l'axe, est prise du côté droit) ; Three.js la fait tourner (`LatheGeometry`).
2. **Photo de face** projetée comme par l'objectif qui l'a prise ; sur les côtés et au dos, la couleur
   « tout autour » mesurée sur les bandes latérales de la photo (verre, liquide, capsule), pour qu'une
   bouteille qu'on fait tourner reste juste.
3. **Étiquette à plat** (le fichier publié sur la fiche officielle, `photos/etiquettes/<slug>.webp`) :
   recalée sur la photo de face par corrélation (hauteur, colonne centrale, angle couvert, sous
   contraintes physiques), **ramenée aux couleurs de la vraie bouteille** (matrice couleur mesurée sur
   les aplats), **découpée comme la vraie** (l'arche et la fenêtre du soleil des Couleur Provence,
   déduites des zones où la photo montre la bouteille nue), puis posée nette, éclairée par le studio.
   La **contre-étiquette** (`<slug>-dos.webp`) est posée au dos. Les 28 sirops en ont une ; les
   spiritueux gardent leur photo.
4. **Flacons à plat** (`photos/produits/plats.json` : carafes Elixir millésimées et Camarguaise Luxe
   avec leur étui) : montrés en photo, sans rotation.

Studio (`src/three/stage.js`, `studio.js`) : environnement PMREM fait de panneaux lumineux (gélatines
colorées sur les campagnes), matières PBR (vernis, rugosité), lumières principale, contre-jour et
débouchage, fond en arrondi (ombres de contact, reflets au sol rendus à part, caustiques douces),
léger *bloom*, profondeur de champ discrète, grain fin. **Mappage tonal Khronos PBR Neutral** plutôt
qu'AgX : AgX ternissait le fuchsia PAC et les bleus Fun Blue (comparaison dans le labo), Neutral est
conçu pour le rendu de produits et garde les couleurs d'étiquette ; AgX reste disponible
(`tone: 'agx'`). Citrons, tranches, glaçons et menthe (`src/three/garnish.js`) : textures procédurales
(pores et albédo de l'écorce, quartiers translucides, glace à bulles et fissures, nervures),
mouvement lent et pesant. Le cadrage tient les bouteilles entières dans un rectangle de la page, à
toutes les tailles d'écran (vérifié par la recette, de 390 à 3440 px de large).

Vignettes : la vraie photo détourée sur fond neutre pour les cartes ; rendus 3D de groupe pour les
menus et les cartes de marque (faits à la demande, gardés pour la session) ; en attendant, ou sans
WebGL, les photos côte à côte — jamais de bouteille dessinée. La bouteille dessinée en code
(`src/three/bottle.js`, `labels.js`) ne sert plus que si une photo manquait.

Labo de réglage (développement seulement, non versionné) : `labo.html?scene=duo|pac|funblue|neutre&slug=…`.

## Marques PAC et Fun Blue

- `scripts/marques.mjs` (outil ponctuel ; `npm i --no-save potrace@2.1.8`) vectorise les logotypes
  depuis les étiquettes à plat du site : **« pac »** (lettres jaunes #feed01, liseré #403512 et halo
  blanc, épaisseurs mesurées sur l'étiquette) et **« Fun Blue »** (lettres blanches et relief marine
  #2d2b6a) → `public/marques/pac.svg` (tel que sur l'étiquette, pour les fonds sombres et colorés),
  `pac-clair.svg` (même tracé, liseré renforcé et sans halo, pour le papier, où le halo blanc ne se
  verrait pas), `fun-blue.svg` (+ `.json` des mesures).
- `src/lib/marques.js` parcourt tout le texte des pages, y compris ce qui est généré : dans un titre
  ou une étiquette (h1–h4, noms de produits et de marques, méga-menu, menu, pied de page, carte des
  prix, panier, recherche), le nom devient le **logotype** (nom gardé en texte masqué pour les
  lecteurs d'écran et le copier-coller) ; dans le texte courant (paragraphes, légendes, fil d'Ariane,
  rayons, filtres), il prend la **police la plus proche** (Lobster Two 700 italique pour pac, Molle
  italique pour Fun Blue) **et la couleur de la marque**, contrastée pour le fond : fuchsia foncé
  #ad1270 (6,2:1 sur le papier) et bleu #1f56a8 (6,5:1) sur fond clair ; jaune du logo, bleu clair ou
  blanc sur fond sombre et sur les aplats de marque (AA, 4,6:1 au moins). « Citron » et « Sirop de
  menthe » restent dans la police de l'interface. Les titres d'articles de presse cités restent du
  texte courant. Sur les cartes produit, le logo tient lieu de nom ; la ligne du dessus dit ce qu'est
  le produit (« Sirop de citron »).

## Boutique, fiches et commande

- **63 produits** officiels (28 sirops, 35 spiritueux) ; chaque contenance est une **variante avec son
  prix** (70 cl, 1 L, 1,5 L, 1,75 L, coffret) ; panier `blachere-panier` v3 (`{slug, v, qty}`).
- **Filtres** : univers, gamme (les rayons officiels), famille d'arômes, contenance, prix, degré
  (majeurs), meilleures ventes (le bloc « Best sellers » du site), recherche sans accents, tri, filtres
  actifs, adresse synchronisée, panneau sur téléphone. Rayons en liens texte à filet, filtres à filets
  fins, cartes sur fond neutre avec la vraie photo.
- **Fiche produit** : bouteille 3D (face et dos quand la contre-étiquette existe), contenances avec leur
  prix, quantité, panier ; textes officiels en tableau de détails (description, ingrédients, valeurs
  nutritionnelles, conseils, « le saviez-vous ? ») ; « Expédition et paiement » d'après les CGV ;
  formats vus seulement en grande surface (« Aussi en 70 cl en grande surface — voir Où trouver nos
  produits ») ; recettes liées.
- **Commande** (maquette) : coordonnées (case « J'ai 18 ans ou plus » avec de l'alcool) → retrait ou
  livraison (expédition sous 3 jours ouvrés au plus après le règlement, livraison sous 30 jours, frais
  indiqués avant validation) → récapitulatif (rétractation de 14 jours, casse) → paiement simulé (CB,
  Visa, Mastercard ; PayPal ; virement : les moyens des CGV) avec acceptation des CGV obligatoire.

## Âge légal et loi Évin

1. Les sirops ne passent jamais derrière la porte d'âge.
2. Date de naissance à la première visite, sortie « Continuer avec les sirops seulement » ; réponse
   « mineur » gardée pour la session, « majeur » dans le navigateur (`blachere-age`).
3. **Une personne mineure ne voit jamais d'alcool** : pages et fiches d'alcool remplacées par un
   message ; carrousel, recherche, méga-menu et recettes filtrés ; sur la page Histoire, les phrases
   qui parlent d'alcool sont retirées (jamais réécrites) ; sur les fiches de sirops, les conseils qui
   en parlent (« Monaco : grenadine + bière »…) aussi ; photos de la boutique (des bouteilles d'alcool
   y sont visibles) remplacées par des archives de la maison. La recette le vérifie sur dix-huit pages.
4. Message sanitaire partout où un alcool apparaît ; bandeau « vente interdite aux mineurs » au
   paiement.
5. Fiches d'alcool limitées aux mentions autorisées. Les remèdes anciens sont de l'histoire.
6. Un juriste valide l'ensemble (porte d'âge, patrimoine, photos où un alcool est visible).

## Données

- `npm run import-site` (`scripts/import-site.mjs --source <photos/site>`) régénère, depuis le
  worktree de la branche `photos-site` : `src/data/catalogue.json`, `src/data/site/*.json`
  (archives, recettes, textes), `photos/produits`, `photos/etiquettes`, `photos/lieux` (les deux
  photos de la boutique sont redressées depuis le montage incliné du site ; le site ne les a qu'en
  665 et 542 px de large, elles ont donc ensuite été agrandies ×4 par Real-ESRGAN (x4plus) pour rester
  nettes sur écran Retina : relancer l'import remet les petits originaux ; à remplacer par de vraies
  photos HD de la distillerie), `public/archives`,
  `public/recettes`, `public/logos`, `public/favicon.svg`. Les images sont réduites (build léger).
- `scripts/archives-site.json` : les 46 pièces choisies, avec leur cartel. **Dates des cartels** :
  seulement ce qui est imprimé sur la pièce (« Tampon « 16 mai 1962 » », « Nice, Exposition
  internationale, 1884, médaille d'or ») ; sinon « Date à préciser ».
- `src/data/products.js` : présentation (noms d'affichage, familles d'arômes, couleurs de secours,
  notes sourcées) ; `src/data/site.js` : contacts, horaires, visites, actualités, points de vente.
- `scripts/import-catalogue.mjs` (catalogue de la recherche) est gardé pour l'historique.
- Les images de presse ne sont jamais reprises : titre, date et lien seulement.

## Opérations du moment (Octobre Rose)

- `src/data/operation.js` décrit les opérations de la distillerie (dates en heure de Paris, produits
  concernés, montant reversé, bénéficiaire, conditions) ; `src/lib/operation.js` les affiche pendant
  leur période et les retire ensuite d'eux-mêmes : bandeau sous le héros de l'accueil et de la page
  PAC Citron (`#octobre-rose`), pastille dans le héros de l'accueil, pastille « Octobre Rose » sur
  les cartes produit, encart sur la fiche du produit concerné. `?operation=octobre-rose-2026` montre
  l'opération hors période (présentation de la maquette après le 31 octobre).
- **Octobre Rose 2026** : « Pour chaque bouteille de PAC CITRON vendue* 1€ sera reversé à » l'Institut
  du Cancer Avignon-Provence (logo « Sainte Catherine »), « Du 1/10 au 31/10 », « * Offre valable
  uniquement sur le site web et en boutique d'usine ». Texte relevé mot pour mot sur la bannière de
  l'accueil du site officiel le 15 octobre 2026 : `photos/operation-octobre-rose/RELEVE.md` et
  l'image d'origine. Le site officiel ne précise ni les contenances (seul le 1 L est vendu en ligne)
  ni un plafond : rien n'est ajouté à ce sujet.

## À confirmer avec la distillerie

- **Naissance du PAC Citron** : 1960 sur la page Histoire, « voit le jour en 1963 » sur la fiche,
  tampon « 16 mai 1962 » sur une étiquette ancienne, « 60 ans » fêtés en 2022-2023 par la presse. La
  maquette écrit « depuis plus de 60 ans » et cite chaque texte tel quel.
- **Capital social** : 165 493 € (mentions du site) ou 1 508 428 € (BODACC, 21 mai 2025).
- **Étiquette PAC Citron** : le fichier à plat publié sur le site (ramené aux couleurs de la
  photo) ; idéalement à remplacer par le fichier de l'imprimeur. L'ancienne étiquette « déroulée » d'une
  photo de revendeur (v3 intermédiaire) n'est plus utilisée. Même remarque pour la **découpe des
  étiquettes Couleur Provence**, déduite des photos.
- **Logotypes PAC et Fun Blue** : vectorisés depuis les étiquettes à plat publiées sur le site ; la
  version « fonds clairs » du pac (liseré renforcé, sans le halo blanc) est une proposition de la
  maquette. À remplacer par les fichiers vectoriels de la marque et à faire valider.
- **Collectors des 60 ans** (C215, Claude Viallat), **objets du PAC** (T-shirt, gobelets « Summer
  PAC », verres) et **magnums numérotés** (une centaine, un été, sans doute 2025, sans doute épuisés) :
  vus seulement dans la presse ; cartels sans image dans les archives, photos et droits à demander.
- **Eaux-de-vie de fruits** : seule Flirt® (poire Williams) est au catalogue ; l'eau-de-vie de
  framboise du complément n'y est pas (famille seulement évoquée).
- **Fiches 122, 128 à 130, 133, 135, 138, 142, 143, 155 et 157** : absentes du catalogue officiel relevé
  (numéros manquants) ; produits retirés ou masqués ?
- **Visites** : tarifs (gratuit, 4 €, 5 €, 7 € ou 10 € selon les sources), langues, créneaux ;
  horaires de retrait des commandes (9 h-12 h et 14 h-17 h sur la page « Achat express ») face aux
  horaires du magasin (page Contact, qui fait référence ailleurs).
- **Chiffres de presse** affichés comme tels : 800 000 bouteilles de PAC par an (L'Écho du Mardi,
  décembre 2025) ou un million (Made in Marseille) ; 4,9/5 sur TripAdvisor (environ 354 avis, relevé
  d'octobre 2026).
- **Textes repris tels quels**, coquilles comprises (« Mente « Aurélie » », « Ajoutez les des deux
  sirops ») : à corriger sur le site officiel d'abord.
- **Directeur de la publication**, licence de vente à emporter, transporteur et frais réels, liste
  officielle des points de vente, dates du festival 2027.

## Ce qui est simulé

Paiement, envoi de la commande, réservation de visite, connexion et demande de compte pro, lettre
d'information : les formulaires vérifient la saisie, affichent une confirmation et n'envoient rien.
La carte des points de vente est un emplacement réservé ; la liste est indicative.

## CRM et espace pro

Le CRM de la distillerie (`/crm`), l'espace professionnel (`/espace-pro/…`) et les formulaires du site
s'appuient sur une API réelle (`api/`, `server/`) : **une démo privée par navigateur**, enregistrée
côté serveur, où rien ne sort (pas d'e-mail ni de paiement réels : les courriels sont rangés dans la
boîte d'envoi du CRM). La conception, le modèle de données, les règles métier et le **contrat d'API**
sont dans [`docs/crm-espace-pro.md`](docs/crm-espace-pro.md), qui fait foi.

**En local.** `npm run dev` et `npm run preview` servent l'API avec le site (`/api/<nom>` →
`api/<nom>.js`, appelé comme sur Vercel ; `npm run dev -- --port 5181` pour un autre port). Sans
`BLOB_READ_WRITE_TOKEN`, les démos sont des fichiers JSON dans `.data/demos/` (ignoré par git) : les
effacer remet tout à zéro. `npm test` lance les tests (node:test, magasin en mémoire) : règles au
centime près, droits, sécurité, stockage et concurrence, parcours complets à travers les fonctions.

**Comptes de démonstration** (mot de passe commun `Distillerie1835`, affiché en démo ; les boutons
« Entrer en démo » connectent sans mot de passe) :

| Compte | Profil |
|---|---|
| `direction@blachere.example` | Hélène Garnier, direction (tous les droits) |
| `commercial@blachere.example` | Thomas Roux, commercial Vaucluse et Gard |
| `logistique@blachere.example` | Karim Benali, expéditions et stocks |
| `boutique@blachere.example` | Léa Fabre, boutique et visites |
| `julien@cafe-des-platanes.example` | Julien Morel, client pro (Café des Platanes, Avignon) |

Le jeu de démonstration (`server/seed.js`) est fictif et déterministe : 17 comptes pro, 90 clients,
230 commandes sur 120 jours (saisons, statuts selon l'âge), factures, stocks, visites, messages,
abonnés, campagnes, codes promo `BIENVENUE10`, `PACETE`, `PORTOFFERT`. Catalogue et prix TTC officiels
(`server/generated/catalogue.js`, régénéré depuis `src/data/products.js` par
`scripts/server-catalogue.mjs` avant `dev` et `build`).

**Variables d'environnement (Vercel)**

| Variable | Rôle |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | magasin Vercel Blob **privé** relié au projet (région cdg1) ; sans lui, l'API refuse de tourner sur Vercel |
| `SESSION_SECRET` | signature des cookies (32 caractères au moins, aléatoires) ; obligatoire sur Vercel, sinon l'API répond 500 « configuration » |
| `CRON_SECRET` | protège `/api/menage` (Vercel Cron l'envoie en `Authorization: Bearer …`) ; sans lui, le ménage ne tourne pas |

En local et en test : secret de développement fixe, pilote `fs` (ou `BLACHERE_STORE=memoire`).

**Stockage.** Un document JSON par démo, `demos/<id>.json` (moins de 400 Ko, stockage compact : l'API
recalcule totaux et libellés), lu sans cache et écrit avec `ifMatch` (concurrence optimiste, trois
essais). Cookies : `bl_demo` (démo, 30 jours), `bl_demo_actif` (lisible par les pages), `bl_crm`
(personnel, 12 h) et `bl_pro` (client pro), signés avec une clé par usage. `/api/menage` (tous les
jours à 3 h 17 UTC) efface les démos inutilisées depuis 30 jours.

**Sécurité (revue d'octobre 2026).** Écritures : JSON, en-tête `X-Blachere`, origine vérifiée, 64 Ko
au plus, validation stricte ; droits du rôle contrôlés par le serveur à chaque appel ; un client pro
ne voit que son compte (404 sinon) ; mots de passe scrypt, verrouillage après 5 échecs, limiteurs par
adresse IP ; jetons d'invitation et de réinitialisation hachés, à usage unique ; aucune donnée
personnelle dans les journaux de la plateforme ; exports CSV protégés contre les formules. Détail et
points restant à traiter avant une vraie mise en service : `docs/crm-espace-pro.md`, § 6.

## Lancer, construire, vérifier

```bash
npm ci
npm run dev            # http://localhost:5173 (traite d'abord photos/)
npm run build          # dist/ (traite d'abord photos/, ~1 min pour 63 bouteilles)
npm run preview        # http://localhost:4173
npm run qa             # recette complète sur le build
npm run test:photos    # preuve du pipeline photo
```

`npm run qa` (`scripts/qa.mjs`, `--sortie <dossier>`, `--rapide`) lance `vite preview`, parcourt les
21 pages au format bureau (1440 × 900) et téléphone (390 × 844), puis la campagne, la boutique et une
fiche aux **dix tailles d'écran** (1920 × 1080, 1920 × 950, 2560 × 1440, 3440 × 1440, 1440 × 900,
1366 × 768, 1280 × 720, 1024 × 768, 768 × 1024, 390 × 844) et vérifie : aucune erreur de console ;
rien ne dépasse de l'écran (largeur de la page comparée à la fenêtre de mise en page, et en-tête,
navigation, campagne, cartes de prix, cartes) ; **bouteilles 3D
entières dans leur cadre et sous l'en-tête** ; compteurs des filtres (calculés depuis le catalogue),
adresse synchronisée, variantes et prix ; totaux du panier, case 18 ans, CGV, parcours de commande ;
méga-menus, recherche, menu mobile ; archives et recettes ; logotypes et police de marque ; aucune
trace d'alcool pour une personne mineure ; 404, `robots.txt`. Playwright et Chromium sont ceux de la
machine (`PLAYWRIGHT_MODULE`, `PLAYWRIGHT_CHROMIUM`, SwiftShader) ; aucune dépendance ajoutée. Les
captures pleine page de plus de 6 000 px sont prises par tranches puis assemblées (au-delà de
8 192 px, le rendu logiciel recopierait le haut de la page).

Adresses propres : réécritures de Vite en développement (`vite.config.js`), `cleanUrls`, réécriture
`/boutique/:slug` → `produit.html` et redirection `/la-distillerie` → `/la-maison` dans `vercel.json`.

## Code

- `src/data/` : catalogue officiel importé, données du site (`site/`), présentation des produits.
- `src/partials/` : en-tête (barre utilitaire, méga-menus, recherche, menu), pied de page, fenêtres.
- `src/app/` : site commun (âge, en-tête, panier latéral), cartes, pièces d'archives, blocs de marque.
- `src/pages/` : un module par page. `src/lib/` : panier, filtres, marques, alcool, vignettes, photos.
- `src/three/` : studio (rendu, post-traitement), plateau, bouteilles en photo, garnitures, campagnes,
  visionneuse, rendus de vignettes ; bouteilles et étiquettes dessinées de secours.
- `src/styles/` : `base.css` (système), `home.css`, `brand.css` (pages de marque, archives, maison,
  recettes, textes légaux), `pratique.css` (visiter, où trouver, espace pro : formulaires, formules,
  points de vente), `shop.css`, `product.css`, `checkout.css`.

## Robustesse

- De 390 à 3440 px de large sans défilement horizontal ; `prefers-reduced-motion` respecté.
- Sans WebGL : photos détourées à la place de la 3D ; tout le contenu reste lisible.
- Three.js dans son propre fichier, chargé après la page ; la résolution baisse si l'appareil peine.
- Stockage du navigateur toujours protégé (navigation privée, stockage bloqué).

## Avant la mise en ligne réelle

1. Fichiers de l'imprimeur (étiquettes, logotypes), photos du lieu après les travaux, photos des
   objets et des collectors avec leurs droits.
2. Paiement réel, transporteur, CGV relues pour la vente d'alcool à distance.
3. Agenda de visites branché, espace pro réel, liste des points de vente, carte.
4. Versions anglaise et allemande, avec `hreflang`.
5. Avis d'un juriste sur la porte d'âge et la loi Évin.
6. Domaine dans Vercel, retirer `noindex` (`vercel.json`, balises `robots`, `public/robots.txt`) et la
   pastille (`public/v2x/` et les lignes qui la chargent dans les pages).
