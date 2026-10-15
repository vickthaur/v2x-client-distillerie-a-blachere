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
de secours. Aucune requête vers un CDN. L'italique de Fraunces (accents des titres, graisses 400 à 420)
est une instance de la police variable (graisses 400 à 500, axe SOFT fixé à 0, fontTools
`varLib.instancer`) : 75 → 42 Ko, rendu identique. Archivo garde ses axes complets : la bande
Octobre Rose utilise la largeur 74 % (graisse 820).

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

**L'affiche d'abord, la 3D en plus** (`src/lib/campagne.js`) : les campagnes (accueil, PAC Citron,
Fun Blue, Couleur Provence) portent dans leur HTML une affiche faite des vraies photos détourées
(`/bouteilles/<slug>/face.webp`, la texture de face de la 3D : rien de plus à télécharger), posées
là où la 3D placera les bouteilles. Three.js n'est chargé que quand le cadre est à l'écran, au
premier moment libre du navigateur, puis la 3D remplace l'affiche en fondu une fois sa première image
dessinée. **Jamais de 3D** en mouvement réduit (`prefers-reduced-motion`), en économie de données
(`Save-Data`), en 2G ou sans WebGL : l'affiche reste, jamais de cadre vide. Les campagnes et les
vignettes ne téléchargent pas le dos des étiquettes (`dos: false`) ; en mouvement réduit (visionneuse
des fiches), l'image n'est redessinée que si quelque chose change.

Vignettes : la vraie photo détourée sur fond neutre pour les cartes, à son chemin connu d'avance
(`/bouteilles/<slug>/vignette.webp`), en `loading="lazy"` : seules les vignettes proches de l'écran
sont téléchargées. Rendus 3D de groupe des menus et des cartes de marque **pré-calculés** :
`node scripts/rendus.mjs --base <serveur de développement>` les fait avec le même code
(`src/three/snap.js`) dans Chromium sans tête → `public/rendus/<nom>.webp` et `@2x.webp`,
manifeste `src/data/rendus.json` (à relancer quand une bouteille, le plateau ou `RENDER_VERSION`
changent). Ouvrir un menu ne charge plus three.js ; un rendu absent du manifeste est fait à la
demande (jamais en économie de données ni en mouvement réduit), en attendant les photos côte à côte —
jamais de bouteille dessinée. La bouteille dessinée en code (`src/three/bottle.js`, `labels.js`) ne
sert plus que si une photo manquait.

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
- **Commande** (démo) : coordonnées (case « J'ai 18 ans ou plus » avec de l'alcool) → retrait à la
  distillerie (jour choisi, gratuit) ou livraison Colissimo à domicile ou en point relais (tarifs et
  franco calculés par le serveur ; expédition sous 3 jours ouvrés au plus après le règlement) →
  récapitulatif (code promo, rétractation de 14 jours, casse) → paiement simulé (CB, Visa, Mastercard ;
  PayPal ; virement : les moyens des CGV) avec acceptation des CGV obligatoire → numéro de commande,
  montant du serveur et lien vers la commande dans le CRM de démonstration. Pendant une démo, la
  boutique, les fiches et le panier suivent les prix et les stocks de la démo (« Stock bas »,
  « Rupture »).
- **Espace professionnel** (`/espace-pro`, démo) : connexion, mot de passe oublié, demande de compte,
  invitation ; catalogue aux tarifs du compte (par cartons, stocks, spiritueux selon la licence),
  commande avec devis du serveur (franco, minimum, encours), suivi des commandes, factures et fiches
  techniques imprimables (A4), médiathèque, compte et adresses, messages avec la distillerie.

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
  internationale, 1884, médaille d'or ») ; sinon « Sans date » (« Date à préciser » en mode revue).
  `scripts/photos.mjs` en tire des tailles réduites (`public/archives-tailles/<id>-400.webp` et
  `-800.webp`, non versionnées) pour le `srcset` des cadres.
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

## Mode revue (`?revue`)

Les notes de travail de la maquette (sources citées dans le texte, « à confirmer », écarts entre les
sources, choses à demander à la distillerie) sont **masquées par défaut** : le site se lit comme un
site fini, et une valeur inconnue est contournée sans rien inventer (« Tarif sur demande », « Sans
date »). `?revue` les affiche pour la session (filet pointillé, étiquette « Note V2X », repère en bas
à droite pour en sortir), `?revue=0` les masque. Balisage : `data-revue` (note) et `data-revue-hors`
(texte remplacé par la note en revue) ; `noteRevue()` et `selonRevue()` dans `src/lib/revue.js` ;
champ `revue` des formules de visite dans `src/data/site.js`. Les faits restent tracés dans le code,
les données et la liste « À confirmer » ci-dessous. Restent visibles : la pastille V2X, la ligne
« Maquette non officielle » du pied de page et les mentions légales de la maquette.

## Partage et icônes

- **Aperçu des liens** (iMessage, WhatsApp, réseaux) : `public/og-v4.jpg` (1200 × 630), capture du
  haut de l'accueil tel qu'il est en ligne (bouteilles en 3D, citrons, menthe, glaçons), prise en
  mode recette (`?test`, image 3D fixe) à 1440 × 756 px ×2 puis réduite, sans la pastille V2X ni la
  pastille d'opération du moment (l'aperçu doit rester valable après l'opération). `og.jpg` en est
  une copie, pour les anciens liens. Le nom versionné force les messageries à reprendre l'image :
  en changer à chaque nouvelle capture.
- **Favicon** : l'écu au « B » du blason de la distillerie, seul (le blason complet, avec ses herbes
  et son citron, est illisible à 16 px) : `favicon.svg` (tracé d'origine extrait de
  `logos/blason.svg`), `favicon.ico` (16, 32, 48 px), `apple-touch-icon.png` et icônes 192 / 512 px
  sur fond d'encre pour l'écran d'accueil (`site.webmanifest`).
- **Balises de page** : `canonical`, `og:url`, `og:title`, `og:description` (155 caractères au plus)
  sur chaque page ; données structurées `Organization`, `Store` (horaires du magasin) et `WebSite`
  (recherche dans la boutique) sur l'accueil, `AboutPage` sur la maison. Adresse de base :
  https://v2x-client-distillerie-a-blachere.vercel.app (à remplacer par le domaine définitif).

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

## Accès, retrait et propriété intellectuelle

La maquette reprend les marques, textes et photos de la distillerie sans son accord : elle n'est
destinée qu'à la distillerie. Elle est publique par lien simple (choix de Victor, le lien privé était
trop contraignant), non référencée, clairement présentée comme non officielle, et retirée sur simple
demande.

- **Retrait** : `MAQUETTE_RETIREE=1` (variable Vercel) affiche « Maquette retirée » (410) pour tout
  le monde. `middleware.js` (Routing Middleware Vercel, avant toute page, image ou appel d'API),
  décision dans `server/portail.js`, testée par `test/portail.test.js`.
- **Accès privé, désactivé** (`MAQUETTE_PRIVEE=1` pour le réactiver, et `MAQUETTES_PRIVEES` dans le
  projet de V2X Studio pour que son CRM ajoute le jeton aux liens). Lien
  `https://v2x-client-distillerie-a-blachere.vercel.app/?acces=<jeton>` : le jeton (22 caractères)
  est dérivé de `MAQUETTES_SECRET` et du nom de la maquette ; la première visite pose le cookie
  `v2x_acces` (HttpOnly, 180 jours) et la pastille retire le jeton de la barre d'adresse. Sans
  lien ni cookie : page neutre « Maquette privée » (401), qui ne nomme pas la distillerie.
- **Publics** : `/robots.txt` (tout interdit) et `/og-v4.jpg` (aperçu du lien dans le message).
  `/api/menage` garde sa propre protection (`CRON_SECRET`).
- **Variables (Vercel)** : `MAQUETTES_SECRET` (le même que dans le projet de V2X Studio) ;
  `MAQUETTE_PRIVEE=1` active le lien privé (sans `MAQUETTES_SECRET`, tout est alors refusé) ;
  `MAQUETTE_RETIREE=1` retire la maquette.
- **En local** : `MAQUETTE_PRIVEE=1 MAQUETTES_SECRET=… npm run preview` rejoue le verrou.
- **Mentions** : pastille « Maquette non officielle », pied de page (sans lien avec la distillerie,
  © des titulaires, retrait sur simple demande), mentions légales (statut, propriété
  intellectuelle, retrait, signal de consultation). En-têtes : `noindex, nofollow,
  noarchive, nosnippet, noimageindex`, pas d'affichage dans un cadre (`frame-ancestors 'none'`).
- **Jamais** dans le portfolio, les réseaux ou une présentation à d'autres prospects sans accord
  écrit de la distillerie.

## Ce qui est simulé

Le paiement (carte, PayPal, virement) et tout envoi réel. La commande, la réservation de visite, le
contact, la demande de compte pro et la lettre d'information s'enregistrent dans la démo privée du
navigateur (voir « CRM et espace pro ») et apparaissent dans le CRM de démonstration ; les e-mails sont
rangés dans ses courriels envoyés, rien n'est transmis à la distillerie. Une barre « Démo » (en bas à
droite) mène au CRM et à l'espace pro et permet de quitter la démo ; sans démo en cours, la boutique et
les fiches produit n'appellent pas l'API. La carte des points de vente reste à faire (son emplacement n'apparaît qu'en mode
revue) ; la liste est indicative.

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
npm run recette:vercel # en-têtes de vercel.json (CSP…), CRM, espace pro, parcours par l'API
npm run test:photos    # preuve du pipeline photo
node scripts/rendus.mjs --base http://localhost:5173   # rendus des menus et cartes (serveur dev lancé)
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

`npm run recette:vercel` (`scripts/recette-vercel.mjs`, `--shots <dossier>`, `--seulement 1,2,5`)
rejoue sur le build les en-têtes de `vercel.json` que `vite preview` ignore (CSP stricte du CRM et de
l'espace pro, `X-Frame-Options`) et relève violations CSP, erreurs de console et requêtes en échec : site
public, chaque rubrique du CRM et de l'espace pro (390 et 1440 px), refus attendus de l'API, puis un
parcours complet par l'API (commande en ligne → CRM jusqu'au retrait, visite, contact, lettre, demande
pro, commande pro, export CSV). Avec `--base https://…`, il teste le site en ligne (en-têtes réels).

Adresses propres : réécritures de Vite en développement (`vite.config.js`), `cleanUrls`, réécriture
`/boutique/:slug` → `produit.html` et redirection `/la-distillerie` → `/la-maison` dans `vercel.json`.

## Code

- `src/data/` : catalogue officiel importé, données du site (`site/`), présentation des produits.
- `src/partials/` : en-tête (barre utilitaire, méga-menus, recherche, menu), pied de page, fenêtres.
- `src/app/` : site commun (âge, en-tête, panier latéral), cartes, pièces d'archives, blocs de marque.
- `src/pages/` : un module par page (dont `contact.js`). `src/lib/` : panier, filtres, marques, alcool,
  vignettes, photos, campagnes (affiche puis 3D), mode revue, client d'API (`api.js`), démo (`demo.js` : barre de démo, prix et stocks de la
  démo sur la boutique).
- `src/pro/` : application de l'espace professionnel (`pro.html`, Preact) : routeur, données, commande
  en cours, composants, vues (`src/pro/vues/`).
- `src/three/` : studio (rendu, post-traitement), plateau, bouteilles en photo, garnitures, campagnes,
  visionneuse, rendus de vignettes ; bouteilles et étiquettes dessinées de secours.
- `src/styles/` : `base.css` (système), `home.css`, `brand.css` (pages de marque, archives, maison,
  recettes, textes légaux), `pratique.css` (visiter, où trouver, espace pro : formulaires, formules,
  points de vente, contact), `shop.css`, `product.css`, `checkout.css`, `pro.css` (espace pro, feuilles
  A4 imprimables), `demo.css` (barre de démo).

## Robustesse

- De 320 à 3440 px de large sans défilement horizontal (en-tête resserré sous 360 px) ;
  `prefers-reduced-motion` respecté (ni 3D ni animation, l'affiche des campagnes reste).
- Sans WebGL, en économie de données ou en 2G : les photos détourées à la place de la 3D, jamais de
  cadre vide ; tout le contenu reste lisible.
- Three.js dans son propre fichier, chargé seulement quand une campagne est à l'écran (au repos du
  navigateur) ; la résolution baisse si l'appareil peine.
- Accessibilité : texte secondaire à 64 % d'encre (≥ 5:1 sur le papier), anneau de focus double
  (trait et halo) lisible sur le papier, le fuchsia, le bleu Fun Blue et les fonds sombres ; la barre
  utilitaire cachée au défilement redescend quand elle reçoit le focus.
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
