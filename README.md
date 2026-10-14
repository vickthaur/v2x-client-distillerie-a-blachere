# Distillerie A. Blachère · maquette de refonte v2

Proposition de nouveau site pour la **Distillerie A. Blachère** (Avignon 1835, Châteauneuf-du-Pape
depuis 1993), préparée par V2X Studio. Maquette non indexée (`noindex` dans les pages et les en-têtes
Vercel, `robots.txt` qui interdit tout), avec la pastille « Proposition de refonte » de V2X.

- Site actuel : https://www.distillerieablachere.com/
- Sources des faits : note de prospection (`V2X-Studio/research_notes/Sites web datés entreprises
  Vaucluse/blachere_et_spiritueux.md`, sections 1 à 3), catalogue de la recherche
  (`blachere_catalogue.json`), brief DA (`blachere_da.md`) et étude d'identité
  (`V2X-Studio/reports/Identité visuelle Distillerie Blachère.md`, éléments marqués « Fait »).
  Rien d'inventé : un prix, un degré, une contenance, un horaire, un tarif ou une date qui manque est
  écrit « Prix en boutique » ou « à confirmer ».

## Direction artistique

« Le rayon dit l'usage, l'habillage dit l'univers, la porte d'âge dit le public » (étude d'identité).

- **Un cadre commun, « maison 1835 »** : papier chaux, encre sépia, filets bruns, sceau
  « A. Blachère · Avignon 1835 → Châteauneuf-du-Pape » (proposition), Fraunces pour le récit,
  Archivo pour l'interface. L'ovale jaune de l'étiquette PAC est le bouton principal du site.
- **Neuf univers**, qui ne changent que la couleur, le motif et la police de titre
  (`data-univers` dans `src/styles/base.css`) : PAC Citron (fuchsia à rayures, Lobster Two, Spicy
  Rice pour la grille du T-shirt), Fun Blue (dégradé du ciel au bleu nuit, lagon, île, voiles, Molle),
  les collectors (salle sombre, cadres colorés), Couleur Provence® (une couleur par parfum, Fraunces),
  Comtat et papes (affiche de l'Origan, Federant), Camargue, Ventoux et garrigue (herbier, Della
  Respira), marcs et eaux-de-vie (chai, Cinzel), la maison.
- **Pop pour les sirops, rigueur pour les spiritueux** : la femme à la paille, la grille pop et l'été
  ne côtoient jamais un alcool. Les spiritueux ont une présentation sobre (pas de décor ni de rotation
  automatique en 3D, fiches limitées aux mentions autorisées).
- **Étiquettes reproduites en code** (ni photo de presse, ni recadrage des images de référence sur le
  site) : PAC Citron et sa femme à la paille en vectoriel (`src/lib/femme.js`), Fun Blue, et treize
  étiquettes anciennes du mur du magasin dans le musée (`src/lib/archives.js`). Les logos ne sont pas
  recomposés comme s'ils étaient définitifs : il faudra les fichiers vectoriels de la distillerie.
- **Les œuvres de C215 et de Claude Viallat ne sont pas reproduites** : cadres neutres « visuel à
  fournir par la distillerie », crédits en texte.

Polices (SIL OFL, sous-ensemble latin, auto-hébergées dans `src/fonts`, licences jointes) : Archivo
(interface), Fraunces (récit), Lobster Two 700 italique (titres « esprit pac »), Spicy Rice (« PAC »
du T-shirt), Molle italique (Fun Blue), Federant (Comtat, affiches), Della Respira (« SIROP »,
« SANS COLORANT », herbier), Cinzel 900 (« CITRON », marcs). Aucune requête vers un CDN.

## Plan du site

| Adresse | Page |
|---|---|
| `/` | Accueil : les meilleures ventes (PAC Citron et Fun Blue, champ `bestSeller` du catalogue) en 3D devant une affiche coupée en deux, femme à la paille coupée par le bord gauche dont la paille pointe vers l'ovale ; gros plan PAC puis Fun Blue ; grille du T-shirt ; deux portes ; collectors ; musée ; maison ; visites ; actualités |
| `/pac-citron` | Univers PAC : bouteille 3D, histoire, rituel du PAC à l'eau, formats, salle des collectors, étiquettes anciennes |
| `/fun-blue` | Univers Fun Blue : le lagon, d'« Aurélie » à Fun Blue, le Blue Mojito, formats |
| `/couleur-provence` | Trois étagères : classiques du comptoir (1 L), parfums de Provence (70 cl), gourmands et fruités (70 cl et 50 cl) |
| `/recettes` | Le Blue Mojito, l'index des recettes officielles, les idées des fiches ; « sans alcool » par défaut |
| `/spiritueux` | Porte d'âge ; un bandeau par univers : Comtat et papes, Camargue, Ventoux et garrigue, marcs et eaux-de-vie, pastis Marra |
| `/la-maison` | « Je suis née en 1835… » : frise de 1835 à 2035, famille, lieu, chantier (`/la-distillerie` y redirige) |
| `/musee` | Le musée de l'étiquette : le mur, la frise, la fiche ; aile des spiritueux réservée aux majeurs |
| `/visiter` | Quatre formules, réservation en mode maquette, infos pratiques, questions fréquentes |
| `/boutique`, `/boutique/<slug>` | Boutique filtrée et fiches produits avec bouteille 3D |
| `/panier` | Panier et commande en mode maquette |
| `/ou-trouver` | Points de vente : la distillerie, grandes surfaces, cavistes et épiceries fines, cafés |
| `/actualites` | Actualités datées et sourcées, « On parle de nous » |
| `/espace-pro` | Connexion et demande de compte (maquette) |
| `/mentions-legales`, 404 | Données des registres ; page « évaporée » (statut 404) |

## Boutique, fiches et commande

- **Filtres** (`/boutique`) : univers (sirops ou spiritueux, avec ou sans alcool), gamme, famille
  d'arômes, contenance, prix, degré (majeurs), meilleures ventes, recherche sans accents (« chataigne »
  trouve « châtaigne »), tri, filtres actifs en pastilles avec « Tout effacer », compteur, adresse
  synchronisée (`?gamme=couleur-provence&arome=agrumes`), état vide, panneau qui monte du bas sur
  téléphone. Chaque option affiche le nombre de résultats qu'elle donnerait ; les options vides sont
  désactivées, les filtres sans objet (coffrets, grands formats) ne sont pas affichés.
- **Deux rayons séparés** quand sirops et spiritueux sont affichés ensemble ; « Vous aimerez aussi »
  reste dans le même univers.
- **Fiche produit** (`/boutique/<slug>`) : bouteille 3D à faire tourner (souris, doigt, flèches),
  boutons face et dos, contenance, prix officiel ou « Prix en boutique » (avec le numéro du magasin),
  quantité, ajout au panier, faits connus, recette liée, message sanitaire.
- **Panier** latéral et `/panier` : coordonnées → retrait à la distillerie (9 h-12 h et 14 h-17 h,
  horaires de la page « Achat express ») ou livraison (frais non inventés : « calculés avec la
  distillerie ») → récapitulatif → paiement simulé → confirmation. Avec de l'alcool, la case
  « J'ai 18 ans ou plus » est obligatoire et l'étape de paiement affiche « Vente interdite aux
  mineurs ». Panier gardé dans le navigateur (`localStorage`, clé `blachere-panier`, accès protégés).

## Photos → bouteilles 3D

Déposer `photos/produits/<slug>.jpg` (et `<slug>-dos.jpg`) et `photos/lieux/<nom>.jpg` : au build,
`scripts/photos.mjs` (sharp) retire le fond, redresse, mesure la silhouette et écrit dans
`public/bouteilles/<slug>/` `face.webp`, `dos.webp`, `profil.json`, `vignette.webp` (dossier non
versionné, régénéré à chaque build, sharp s'installe avec `npm ci` sur Vercel). Three.js fait tourner
le profil (`LatheGeometry`) et y projette la photo, devant et derrière (le dos reprend la face,
retournée et assombrie, s'il n'y a pas de photo de dos), avec vernis et reflets. Sans photo, la
bouteille dessinée en code reste affichée. Mode d'emploi et liste des 35 slugs : `photos/LISEZMOI.md`.

Preuve de bout en bout : `npm run test:photos` (`scripts/test-packshot.mjs`) dessine un packshot de PAC
Citron penché de 2° avec une ombre au sol (`scripts/test-packshot.png`), le fait passer dans le
pipeline vers un dossier temporaire, vérifie la fiche produit (bouteille reconstruite à partir de la
photo, captures sous quatre angles) et la photo de lieu sur « La maison », puis nettoie tout.

## Âge légal et loi Évin

Les neuf règles de l'étude d'identité :

1. Les sirops ne passent jamais derrière la porte d'âge (PAC, Fun Blue, Couleur Provence® ouverts).
2. Date de naissance à la première visite, sortie « Continuer avec les sirops seulement » ; question
   reposée à l'entrée de tout contenu alcool ; réponse « mineur » gardée pour la session, « majeur »
   dans le navigateur (`blachere-age`). Lien « Revoir la vérification de l'âge » en pied de page.
3. La porte se superpose à la page : titres et descriptions réels dans le HTML. **Compromis** : le
   contenu des pages d'alcool (noms, visuels, prix) n'est inséré qu'après la vérification, pour qu'une
   personne mineure ne voie jamais d'alcool, même dans le code de la page. À arbitrer avec un juriste
   (règle 9) si le référencement de ces pages compte.
4. Message sanitaire partout où un alcool apparaît : cartes, fiches, bandeaux d'univers, panier,
   paiement, musée, recettes, pied de page (majeurs).
5. Paiement : bandeau « vente interdite aux mineurs » et case « J'ai 18 ans ou plus » obligatoire.
6. Fiches d'alcool limitées aux mentions autorisées : degré, origine, dénomination, composition,
   fabricant, élaboration, modalités de vente, mode de consommation.
7. L'univers PAC ne côtoie jamais l'alcool : rayons séparés, recommandations dans le même univers,
   recettes et notes « avec alcool » réservées aux majeurs même sur la fiche d'un sirop, porte d'âge
   au cadre maison (sans rayures PAC).
8. Les remèdes anciens sont de l'histoire (choléra, eau d'arquebuse) ; affiche de l'Origan et
   étiquettes d'alcool dans l'aile du musée réservée aux majeurs.
9. Un juriste valide l'ensemble (statut de la porte d'âge, exception éventuelle pour le patrimoine,
   photos du lieu où un alcool est visible).

## Données et règles d'import

`npm run catalogue -- <chemin vers blachere_catalogue.json>` régénère `src/data/catalogue.json` :
fiches de certitude « élevée » ou « moyenne » seulement, prix et degrés repris seulement si leur source
est le site officiel, **jamais les prix revendeurs**. Résultat : **35 produits** (28 sirops,
7 spiritueux), dont 27 avec un prix officiel. Écartés (certitude faible, présence en boutique non
confirmée) : La Magistrale, La Comtadine, Origan du Comtat, Élixir du Mont Ventoux, liqueur de lavande,
crème de châtaigne, millésimes de vieux marc « Elixir® », vieux marc de Provence Gros Calan.

La présentation (noms d'affichage, familles d'arômes, univers, couleurs, silhouettes 3D, notes
sourcées) est dans `src/data/products.js` ; contacts, horaires, visites, frise, actualités, presse et
points de vente dans `src/data/site.js`.

## À faire valider par la distillerie

**Prix « à vérifier »**, vus une seule fois pendant la collecte (affichés, avec la mention « prix à
confirmer » sur la fiche) : sirop de figue 6,00 € / 70 cl, sirop de violette 6,00 € / 70 cl, sirop
de kiwi 5,60 € / 70 cl, sirop de citron 4,00 € / 1 L.

**Sans prix officiel** (« Prix en boutique ») : Pastis Marra, Le Camarguais, La Camarguaise, Réserve
des Légats, Lou Gardian, Verveine Auguste vieilli, sirop fraise barbe à papa, sucre de canne.
**Contenance connue seulement chez des revendeurs** (affichée « à confirmer ») : Marra, Le Camarguais,
La Camarguaise, Réserve des Légats (70 cl). **Sans contenance** : fraise barbe à papa, sucre de canne,
Lou Gardian, Verveine Auguste vieilli. **Degrés de revendeurs, non affichés** : Le Camarguais 45 %,
verveine 40 %, Réserve des Légats 43 % (et Lou Gardian 16 %, vu une seule fois).

**Horaires du magasin** : quatre versions se contredisent (site anglais 9 h-12 h / 14 h-17 h ; fiches
françaises 10 h-18 h d'octobre à mars et 9 h-19 h d'avril à septembre ; Instagram 9 h-19 h ; Petit
Futé). La maquette affiche la version des fiches françaises, avec la mention « à confirmer ».

**Visites** : quatre formules (passage libre gratuit, séance en boutique, visite guidée d'une heure
pour 25 personnes au plus, groupes) ; tarifs « à confirmer » (gratuit, 4 €, 5 €, 7 € ou 10 € selon les
sources) ; langues proposées (français, anglais, allemand) à confirmer ; créneaux exacts confirmés par
la distillerie (aucun horaire de visite inventé).

**Citations, à relire dans les articles ou les fiches** :
- « 100 % naturel au jus de citron, sans colorant ni conservateur » et « toujours fabriqué dans le
  Vaucluse par la Distillerie A. Blachère » (fiche PAC) ;
- « à la suite d'étés torrides » (L'Écho du Mardi) ;
- « depuis les années 1960, nous fabriquions un sirop de menthe bleue nommé Menthe "Aurélie" »,
  « très vite » et « le sirop de menthe bleu le plus populaire en Provence » (fiche Fun Blue) ;
- « Le sirop citronné de l'enfance, le goût du soleil, les saveurs de l'été, les racines du Sud »
  (le groupe Pakalo, InfoConcert) ;
- « obtenue par distillation, macération et infusion de plus de 20 plantes et épices » (fiche
  La Camarguaise) ; « L'essence de badiane qui se mélange à un alcoolat composé de plus de 30 plantes
  et épices » (fiche Marra) ; « des notes d'amande grillée et de fleur d'oranger » (fiche orgeat) ;
- paraphrases de la page Histoire anglaise (« l'un des derniers pastis faits à l'ancienne », « le
  parfum puissant qui descend des hauteurs du Mont Ventoux ») : à reprendre de l'original français ;
- les titres de la rubrique « On parle de nous », reconstitués d'après les adresses des articles.

**Slogans à valider** : « Le seul, l'unique » (T-shirt) et « pac … le vrai » (capsule) ; mentions
d'étiquette reprises : « Conserver et consommer frais », « Sans colorant », « Fabriqué en Provence »,
« Summer PAC » (gobelets).

**Formulations proposées par V2X** (ton de l'étude, à valider) : « Un PAC à l'eau, s'il vous plaît. »,
« Le lagon en bouteille », « Pas marseillais : vauclusien », « 60 ans, deux artistes, quatre
étiquettes », « Tout est parti d'un carton de sirop… », « Je suis née en 1835 au 14 rue Molière » (la
maison qui parle à la première personne, comme sa page Histoire), « Quatre façons de passer la
porte », « Un PAC près de chez vous », « Page évaporée ».

**Couleurs « Proposition V2X »**, à recaler sur les vraies étiquettes et le fichier de l'imprimeur :
maison (chaux, crème, sépia, encre, or, pierre ; le bois est mesuré sur le comptoir), Couleur
Provence® (les couleurs de liquide de chaque parfum sont inventées), Comtat (or, crème, sépia,
cardinal, chardon ; ciel, remparts et robe sont mesurés sur la photo de l'affiche), Camargue, Ventoux,
marcs ; `--fb-lagon` #18AFC4 (liquide de Fun Blue) n'est pas mesuré, `--pac-fuchsia` est une valeur
moyenne entre deux mesures.

**Étiquettes jamais vues** : Couleur Provence® et tous les spiritueux (les bouteilles 3D portent des
étiquettes neutres de maquette), étiquette actuelle de Fun Blue (évocation dessinée), sérigraphie de
Lou Gardian.

**Droits** : l'illustrateur de la femme à la paille est inconnu (ayant droit à identifier avant toute
déclinaison, dont celle de la maquette) ; C215 et Claude Viallat (droit de reproduire les étiquettes
collector, mention de crédit, société d'auteurs éventuelle) ; auteur et droits de l'affiche de
l'Origan du Comtat, ici seulement évoquée en dessin et réservée aux majeurs ; accord écrit des
personnes photographiées et des cafés cités (Café de la Banque, bar de la Relève).

**Contradictions tranchées provisoirement** (comme le recommande l'étude) : PAC « marque déposée en
1962 » (1960 sur la page Histoire) ; « les initiales de ses enfants », sans prénoms ; Fun Blue « créé
en 1995 » ; choléra « à la fin du XIXe siècle » (1882 ou 1884) ; « des dizaines de plantes du
Ventoux » pour l'Origan ; « recette de la distillerie Marra, rachetée en 1955 » ; aucun volume de
ventes affiché ; Raphaël Vannelle « codirigeant » ; festival non numéroté.

**Faits à confirmer** : disponibilité de l'Origan du Comtat, de La Magistrale, de La Comtadine et de
l'Élixir du Mont Ventoux ; « Auguste » de la verveine ; nom exact « Le Camarguais » en boutique ;
licence de vente à emporter, transporteur, frais et seuil de livraison, moyens de paiement, CGV de
vente d'alcool à distance ; directeur de la publication ; liste officielle des points de vente ;
dates du festival 2027.

## Ce qui est simulé

Paiement, envoi de la commande, réservation de visite, connexion et demande de compte pro, inscription
aux actualités : les formulaires vérifient la saisie, affichent une confirmation et n'envoient rien.
La carte des points de vente est un emplacement réservé ; la liste est indicative (relevée en ligne le
14 octobre 2026). Les bouteilles et étiquettes sont dessinées en code tant que les photos manquent.

## Lancer, construire, vérifier

```bash
npm ci
npm run dev            # http://localhost:5173 (traite d'abord photos/)
npm run build          # dist/ (traite d'abord photos/)
npm run preview        # http://localhost:4173
npm run qa             # recette complète sur le build (voir ci-dessous)
npm run test:photos    # preuve du pipeline photo
npm run catalogue -- "../V2X-Studio/research_notes/Sites web datés entreprises Vaucluse/blachere_catalogue.json"
```

`npm run qa` (`scripts/qa.mjs`) lance `vite preview`, parcourt toutes les pages au format bureau
(1440 × 900) et téléphone (390 × 844), prend les captures (`--sortie <dossier>`, par défaut
`.cache/qa`) et vérifie : absence d'erreur dans la console, absence de défilement horizontal à
390 px, compteurs des filtres, adresse synchronisée, totaux du panier, case 18 ans, parcours de
commande, formulaires en mode maquette, page 404, `robots.txt`, et qu'une personne mineure ne voit
aucun alcool sur dix-huit pages. Les scripts de recette utilisent Playwright et le Chromium déjà
installés sur la machine (variables `PLAYWRIGHT_MODULE` et `PLAYWRIGHT_CHROMIUM`) ; ils n'ajoutent
aucune dépendance au projet.

Dernière recette (14 octobre 2026, Chromium avec SwiftShader) : `npm ci && npm run build` sans
erreur ; `npm run qa` 73/73 vérifications réussies, aucune erreur de console ; `npm run test:photos`
11/11. Build : `dist/` 1,5 Mo, dont JavaScript 703 Kio (Three.js 480 Kio, 121 Kio compressé, chargé
à part), CSS 95 Kio, polices 380 Kio.

Adresses propres : réécritures de Vite en développement et en prévisualisation (`vite.config.js`),
`cleanUrls`, réécriture `/boutique/:slug` → `produit.html` et redirection `/la-distillerie` →
`/la-maison` dans `vercel.json`.

## Code

- `src/data/` : catalogue importé, présentation des produits et univers, informations du site.
- `src/partials/` : en-tête, menu, pied de page, sceau, fenêtres communes (inclus au build).
- `src/app/` : éléments communs (âge, panier latéral, apparitions), cartes, blocs éditoriaux, héros.
- `src/pages/` : un module par page. `src/lib/` : panier, filtres, archives du musée, femme à la
  paille, vignettes, stockage. `src/three/` : bouteilles, étiquettes, scènes 3D.
- `src/styles/` : `base.css` (tokens et univers), `editorial.css`, `home.css`, `pages.css`,
  `shop.css`, `product.css`, `checkout.css`.

## Robustesse

- Téléphone (390 px) et ordinateur, sans défilement horizontal ; `prefers-reduced-motion` respecté.
- Sans WebGL : affiche en CSS et bouteilles en SVG ; tout le contenu reste lisible.
- Three.js dans son propre fichier, chargé après la page ; la résolution baisse si l'appareil peine.
- Stockage du navigateur toujours protégé (navigation privée, stockage bloqué).

## Avant la mise en ligne réelle

1. Visuels : photos des bouteilles (voir `photos/LISEZMOI.md`), étiquettes à plat, logos vectoriels,
   photos du lieu après les travaux, portraits avec accord.
2. Prix, degrés et contenances manquants ; paiement réel, CGV de vente d'alcool à distance.
3. Agenda de visites branché (créneaux, confirmations, rappels), espace pro réel, liste des points de
   vente, carte.
4. Versions anglaise et allemande (puis néerlandaise), avec `hreflang`.
5. Avis d'un juriste sur la porte d'âge et la loi Évin.
6. Domaine dans Vercel, retirer `noindex` (`vercel.json`, balises `robots`, `public/robots.txt`) et la
   pastille (`public/v2x/` et les lignes qui la chargent dans les pages).
