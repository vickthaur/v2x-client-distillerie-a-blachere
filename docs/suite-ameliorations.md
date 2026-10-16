# Suite des améliorations · deuxième vague (octobre 2026)

La première vague (branche `wt-ameliorations`) a corrigé, dans les fichiers qui ne sont pas en cours
de réécriture ailleurs, une partie du plan d'action de l'audit (`docs/audit-2026-10.md`) : affiche des
campagnes et 3D sobre, vignettes paresseuses, rendus des menus pré-calculés, contrastes et focus,
double marge des pages de contenu, en-tête à 320 px, mode revue, poids (logos, Fraunces, archives),
balises de page et données structurées. Ce qui suit demande des fichiers tenus par les autres
chantiers (boutique, fiches, panier et commande, visites, espace pro, CRM, en-tête et pied de page,
`src/app/site.js`, `vite.config.js`, `vercel.json`) : à faire quand ces chantiers seront fusionnés.
Chaque point donne le fichier, le changement et la référence de l'audit.

La deuxième vague (branche `wt-vague2`, un commit par thème) a fait les points 1 à 6, sauf ce qui
attend le pré-rendu (fiches et grille pré-rendues, affiche des fiches dans le HTML, JSON-LD, vraies
404, redirections), l'index léger du catalogue, la porte d'âge (UX-3, en attente de l'avis du
juriste) et le domaine définitif ; et deux points du 7 (pause des animations, impression) : voir
« Deuxième vague : fait » ci-dessous. Les sections 1 à 7 restent la liste d'origine.

## Troisième vague : finitions design (16 octobre 2026)

Revue de toutes les pages publiques et de leurs états (menus, recherche, panier, porte d'âge,
commande) à 390 × 844 et 1 440 × 900, puis corrections (branche `design`, chantiers `design-textes`,
`design-cartes`, `design-fiche`). Recette rapide 198/198, `recette:vercel` sans problème.

| Point | Avant | Après |
|---|---|---|
| Recherche au téléphone | deux colonnes serrées, images sur les textes, bouton coupé | une colonne, vignettes réduites |
| Pastille « Maquette non officielle » | 200 × 40 px sur le contenu de chaque écran | mention à l'arrivée, puis rond « V2X » de 40 px |
| Campagnes au téléphone | étiquettes de prix empilées sous la pastille ; citron 3D sur les boutons | étiquettes côte à côte dans le premier écran ; éléments flottants dans le cadre des bouteilles |
| Fiche au téléphone : prix / bouton d'achat | sous la ligne de flottaison | 616 / 684 px (PAC) |
| Cartes produit | surtitre sur 2 lignes, rangées irrégulières, message sanitaire sous chaque spiritueux | surtitre court, rangées alignées, bouton rond au téléphone, message une fois par section |
| Boutique au bureau : CLS | 0,691 | 0 |
| Typographie | « 6,70€ », guillemets et « % vol. » coupés, titres en capitales, fautes reprises | espaces insécables, casse de phrase, corrections (`src/data/corrections.js`, `src/lib/typo.js`) |
| Pied de page au téléphone | 2,5 écrans de liens | groupes repliables (environ 650 px de moins sur chaque page) |
| Hauteur des pages au téléphone | accueil 10 824, boutique 17 931, recettes 23 992 px | 10 118, 15 036, 18 252 px |

Ajouts : bandeau « Commander à la distillerie » (livraison offerte dès 120 €, retrait gratuit,
paiement, fabrication) sur l'accueil, cartes de presse avec pictogramme, photos du savoir-faire
recadrées, recettes cadrées en paysage au téléphone, produits utilisés sous chaque recette.

## Deuxième vague : fait (avant → après)

Même méthode que pour la première vague : build de production servi par `vite preview`, Chromium sans
tête, mêmes scripts avant et après (mesures de la vague, `scripts/audit/axe.mjs`, `clavier.mjs`,
`debordements.mjs`).

| Mesure | Avant | Après |
|---|---|---|
| Boutique au bureau (1 440 × 900) : `h1` / première carte / cartes dans le premier écran | 325 / 800 px / 4 | 158 / 360 px / 8 |
| Boutique au téléphone (390 × 844) : `h1` / première carte | 193 / 677 px | 103 / 478 px |
| Fiche au téléphone : `h1` / prix / bouton d'achat / plateau | 753 / 997 / 1 108 / 488 px | 572 / 815 / 926 / 390 px (56 svh au plus) |
| Fiche au bureau : `h1` / prix / bouton d'achat | 334 / 578 / 627 px | 222 / 466 / 515 px |
| Barre d'achat collante (téléphone et bureau) | aucune | nom, contenance, prix et « Ajouter » dès que le bouton passe sous l'en-tête, effacée au pied de page |
| Fiche de sirop en mouvement réduit (de même en économie de données et en 2G) | three.js, index des photos, étiquette et contre-étiquette : 29 requêtes, 782 Ko | l'affiche seule, nommée : 22 requêtes, 265 Ko |
| Fiche avec WebGL : contre-étiquette (184 Ko) | chargée d'office | au premier clic sur « Dos » |
| Lignes de maquette visibles sans `?revue` (7 pages, en-tête et pied de page compris) | 25 | 0 |
| Boutique : tri nommé au téléphone, groupes, rayon actif annoncé, `aria-valuetext` | non, non, non, 0 curseur | oui, oui, oui, 4 curseurs |
| Prix au litre : cartes de la boutique / fiche La Camarguaise (70 cl) | 0 / « 31,70 € TTC · 70 cl » | 49 / « 31,70 € TTC · 70 cl soit 45,29 € le litre » |
| Frais de port : fiche / panier (latéral et page) | rien / « calculés avec la distillerie » | « 7,90 € en point relais, 9,90 € à domicile, offerte dès 120,00 € d'achats » / « dès 12,90 € en point relais […], plus que 68,20 € » |
| Espace avant « € » | insécable (U+00A0) | fine insécable (U+202F) |
| Focus après « + » ou après un retrait, panier latéral et page panier | perdu (`body`) | reste sur le bouton, ou passe à la ligne suivante |
| Erreurs reliées à leur champ (`aria-describedby`) : Visiter / espace pro / commande | 1 sur 6 / 0 sur 6 / 0 sur 5 | 6 sur 6 / 6 sur 6 / 5 sur 5 |
| Boutique, fiche, panier : `canonical`, `og:url`, `og:description`, Archivo préchargée | non | oui (fiche : posés par `produit.js` tant qu'elle n'est pas pré-rendue) |
| `/v2x/proposition.css` (5 pages mesurées) | bloque le rendu | ne bloque plus ; la pastille s'insère une fois sa feuille chargée |
| Impression : fiche PAC Citron / recettes | 6 pages incomplètes (accordéons fermés, en-tête répété, bouton blanc sur blanc) / 45 pages | 5 pages complètes / 13 pages |
| Campagnes et fiches de sirop : commande de pause (WCAG 2.2.2) | aucune | « Mettre l'animation en pause » (bascule, choix gardé d'une page à l'autre) |
| Méga-menu ouvert au clavier : tabulations avant d'entrer dans le panneau / panneau resté ouvert quand le focus part | 7 / oui | 0 / non |
| Recherche / menu du téléphone ouverts : éléments de la page atteints à la tabulation | 5 / 20 | 0 / 0 (vraies fenêtres modales, Échap rend le focus au bouton) |
| axe (52 analyses de l'audit) : nœuds en échec | 3 (boutique : `aria-prohibited-attr` sur `#shop-chips`, tri sans nom au téléphone) | 0 |
| Focus caché (clavier.mjs, 9 pages) | 17 | 15 : les cases des filtres et la visionneuse ne passent plus sous la pastille V2X ; restent le lien d'évitement (9, voulu), les curseurs des filtres couverts par leur piste (5, anneau sur la poignée) et une carte de recette de la fiche, plus haute que l'espace au-dessus de la pastille (1) |
| Débordements de 320 à 2 560 px (180 cas) | 0 | 0 |

Avant chacun des commits de code : build vert, `npm test` vert (174 tests, puis 176 avec
`test/livraison.test.js`), recette complète (`node scripts/qa.mjs`, sans `--rapide`) verte : de 258 à
278 vérifications selon l'étape, aucune erreur de console. Contrôles ajoutés : double marge
(17 pages, bureau et téléphone), fiche au téléphone et au bureau, barre d'achat, boutique au bureau,
3D sobre et dos de l'étiquette, mode revue, méga-menus au clavier, fenêtres modales, focus du panier,
prix au litre, frais de port, erreurs par champ, balises, cache des images, feuille de la pastille,
pause des animations, impression.

### Ce que la deuxième vague change pour les autres chantiers

- `src/app/site.js` : `import '../lib/revue.js'` (mode revue sur toutes les pages) ; recherche et menu
  du téléphone en `<dialog>` ouverts par `showModal()` (Échap ferme, focus rendu au bouton) ;
  méga-menus dans `.nav__item`, fermés quand le focus quitte le bouton et le panneau ; `toast()`
  s'affiche dans la fenêtre modale ouverte ; panier latéral mis à jour sans réécrire la liste ;
  `affinerLivraison(root, totaux)` exportée ; accordéons ouverts à l'impression.
- `src/partials/header.html` : `<dialog class="search">`, `<dialog class="menu">` ; langues et
  « Compte » en `data-revue` ; `src/partials/footer.html` : langues en `data-revue`.
- `src/partials/head.html` : `proposition.css` en `media="print"` (passée en `all` par
  `public/v2x/proposition.js`) ; boutique, fiche et panier incluent maintenant `head.html`.
- `src/lib/livraison.js` : barème de la démo (`BAREME`, `devisLocal()`) et `devis(lignes, local)`
  (`POST /api/site?r=livraison`, repli sur le barème) ; test `test/livraison.test.js` (barème
  identique à `PARAMETRES_DEFAUT.livraison`).
- `src/lib/formulaire.js` : `erreursParChamp(form, erreurs, { resume, focus })` (message sous le
  champ, `aria-invalid`, `aria-describedby`, résumé, focus au premier champ).
- `src/lib/pause.js` : `pauseVoulue()`, `boutonPause(scene, { clair })` ; `Stage`, `HeroScene`,
  `BottleViewer` : option `pause`, `pause(on)`, `paused`.
- `src/lib/dom.js` : `whenVisible(el, rootMargin)` ; `src/three/stage.js` : `redraw()` ;
  `src/three/viewer.js` : `dosDisponible`, `chargerDos()` ; `src/three/photoBottle.js` :
  `userData.ajouterDos()`.
- `src/data/products.js` : `euro()` avec U+202F, `prixAuLitre()`, `prixAuLitreTexte()`,
  `prixAuLitreHTML()` ; `p.notes` en `{ t, revue }`.
- `src/styles/print.css` (importée par `base.css`, sans effet sur l'espace pro et ses factures).
- `vercel.json` : `public, max-age=86400, stale-while-revalidate=604800` pour les images ;
  `fetchJSON()` (`src/lib/photos.js`) sans `cache: 'no-cache'`.

### Reste à faire après la deuxième vague

- Pré-rendu des fiches, de la grille de la boutique, des recettes et des archives, avec JSON-LD
  `Product` / `Offer` / `BreadcrumbList`, vraies 404 et redirections 301 du site actuel (PERF-1, SEO-2,
  SEO-4, SEO-5) ; index léger du catalogue (PERF-6) : hors du périmètre de cette vague.
- Porte d'âge à la première action vers l'alcool (UX-3) : en attente de l'avis du juriste, porte
  inchangée.
- À la mise en ligne : domaine définitif dans `canonical`, `og:url` et le JSON-LD.
- Garnitures 3D pré-cuites (PERF-2, PERF-5), instance allégée d'Archivo (PERF-5), bouton « Imprimer
  la recette » et page par recette (QUAL-7, SEO-6).

## Mesures de la première vague (avant → après)

Build de production servi par `vite preview` (octets bruts, non compressés), Chromium sans tête ;
scripts de l'audit (`scripts/audit/axe.mjs`, `clavier.mjs`, `debordements.mjs`) relancés tels quels.

| Mesure | Avant | Après |
|---|---|---|
| axe (52 analyses de l'audit) : nœuds en échec | 1 534 (dont 1 531 contrastes) | 3 (boutique : `#shop-chips`, tri sans nom) |
| Focus caché (clavier.mjs, 9 pages) / focus hors de l'écran (barre utilitaire) | 98 / 63 | 17 / 0 : lien d'évitement posé sur l'en-tête (voulu, 9), champs des filtres de la boutique (7), visionneuse de la fiche sous la pastille V2X (1) |
| Débordements de 320 à 2 560 px (180 cas) | 20 (en-tête à 320 px) | 0 |
| `h1` sous l'en-tête des pages de contenu (1 440 px / 390 px) | 322–359 / 186–195 px | 210–247 / 122–131 px |
| Campagnes sans WebGL | cadre vide (rectangle beige) | les vraies bouteilles |
| Mouvement réduit : three.js et poids de la page (accueil au téléphone, Couleur Provence) | 547 Ko de JS, 2 133 Ko / 3 025 Ko | non chargé, 860 Ko / 790 Ko |
| Ouvrir « Nos marques » (bureau) / le menu du téléphone | 31 requêtes, 2 288 Ko / 14, 996 Ko (three.js) | 3 requêtes, 47 Ko / 3, 70 Ko |
| Vignettes avant défilement (téléphone) : accueil, Couleur Provence, spiritueux, boutique | 16, 26, 35, 63 (1 041 Ko) | 0, 6, 4, 8 (112 Ko) |
| CLS au bureau : spiritueux, archives, recettes, mentions légales | 0,561 ; 0,55 ; 0,46 ; 0,194 | 0,02 ; 0,001 ; 0 ; 0 (aucune des 13 pages au-dessus de 0,02) |
| Archives (`/musee`), page entière, bureau / téléphone | 4 456 / 4 456 Ko | 1 833 / 3 051 Ko |
| Logos (SVG chargés par chaque page) / polices de l'accueil | 324 / 233 Ko | 119 / 199 Ko |
| Lignes de maquette visibles sans `?revue` (13 pages, porte d'âge passée ou non) | 53 | 10 : 8 dans les mentions légales, où la maquette se déclare (gardées exprès), 2 faux positifs (« visite de la distillerie » lu comme « site de la distillerie ») |

Recette `node scripts/qa.mjs --port 4187 --rapide` : 167 vérifications sur 167, aucune erreur de
console (campagnes 3D entières dans leur cadre à 1 920 × 1 080, 1 920 × 950, 3 440 × 1 440 et
390 × 844).

## Ce que la première vague change pour les autres chantiers

À savoir avant de fusionner (aucun appel existant n'est cassé, la recette `scripts/qa.mjs` passe) :

- `src/lib/thumbs.js` : `renderHTML()` / `thumbHTML()` posent tout de suite la vraie photo à son chemin
  connu d'avance (`/bouteilles/<slug>/vignette.webp`, `loading="lazy"`) au lieu d'attendre l'index des
  photos ; `thumbHTML(p, { eager: true })` (affiche des fiches) pose la photo de face
  (`face.webp`, 1 024 px de haut, `fetchpriority="high"`) : l'affiche des fiches s'affiche donc dès le
  rendu de la fiche, avec ou sans WebGL (QUAL-1). Les rendus de groupe (menus, cartes de marque) sont
  pré-calculés (`public/rendus`, `src/data/rendus.json`, `scripts/rendus.mjs`). `upgradeThumbs()` est
  devenue synchrone (aucun appelant n'attendait sa promesse).
- `src/lib/dom.js` : `sobre()` (mouvement réduit, `Save-Data`, 2G) et `idle()`.
- `src/data/site.js`, formules de visite : `prix`, `duree`, `reservation` portent le texte public
  (« Tarif sur demande », « Sur demande », « Sur réservation ») ; la version « à confirmer » est dans
  `f.revue` (affichée par `formulesHTML()` en mode revue).
- `src/styles/base.css` : `--ink-3` à 64 %, anneau de focus double (`--focus`, `--focus-halo`), champs
  de formulaire avec cet anneau (la recherche `.shop-search` aussi), barre utilitaire qui redescend au
  focus, en-tête resserré sous 360 px, `a[href^="tel:"]` insécable, styles du mode revue
  (`[data-revue]`, `[data-revue-hors]`), logotypes en texte en contraste forcé et à l'impression.
- `src/styles/brand.css` : la double marge de `.vis-hero` (page Visiter) est aussi retirée.
- `src/app/pieces.js` : `srcset` des archives (tailles écrites par `scripts/photos.mjs` dans
  `public/archives-tailles/`, non versionné) ; `imgPiece()` ; `dateHTML()` (« Sans date ») ; option
  `zoom` (cadre en bouton « Voir en grand », utilisée par les archives).
- `src/three/stage.js` : option `dos` (dos des étiquettes), promesse `firstFrame`, rendu à la demande
  en mouvement réduit (`calm`) : la visionneuse des spiritueux (calm) ne redessine plus en continu.
  `BottleViewer` accepte `dos` (vrai par défaut, comportement inchangé).
- Mode revue : les pages qui importent `src/lib/revue.js` (directement, ou par `pieces.js`,
  `blocks.js`) posent la classe `revue` sur `<html>` ; les autres (boutique, fiche, panier, espace
  pro, contact) ne l'ont pas encore (point 3 ci-dessous).

## 1. Mise en page : double marge sous l'en-tête (QUAL-6, UX-1, UX-2)

| Fichier | Changement | Réf. |
|---|---|---|
| `src/styles/shop.css` l. 4 | `.shop-page { padding-top: var(--header-h) }` → retirer `padding-top` (`body` porte déjà la marge de l'en-tête). Mesuré : `h1` à 325 px au bureau (en-tête à 112 px), 193 px au téléphone. | QUAL-6, UX-2 |
| `src/styles/product.css` l. 2 | `.product-page { padding-top: var(--header-h) }` → retirer. Mesuré : `h1` de la fiche à 334 px au bureau, **753 px** au téléphone. | QUAL-6, UX-1 |
| `src/styles/product.css` | sous 760 px : `.pp__stage { aspect-ratio: 1 / 1; max-height: 56svh }` ; barre d'achat collante quand `#buy` sort de l'écran (`IntersectionObserver` dans `src/pages/produit.js`). | UX-1 |
| `src/styles/shop.css`, `boutique.html` | en-tête de boutique compact (titre ~2,4 rem, introduction d'une ligne, rayons + recherche + tri sur une rangée) : produits vers 350 px au bureau. | UX-2 |
| `scripts/qa.mjs` | relancer le contrôle « sous l'en-tête » après ces retraits. | QUAL-6 |

## 2. 3D sobre sur les fiches (PERF-2, PERF-4, QUAL-1)

| Fichier | Changement | Réf. |
|---|---|---|
| `src/pages/produit.js`, `mountViewer()` | ne pas lancer la visionneuse si `sobre()` (`src/lib/dom.js`) : l'affiche (photo de face) suffit ; sinon la lancer à la visibilité de `#stage` et au repos (`idle()`), comme `src/lib/campagne.js`. | PERF-2 |
| `src/pages/produit.js` | `new BottleViewer(canvas, p, { dos: false, … })` puis, au premier clic sur « Dos » (`[data-side]`), recréer la bouteille avec `dos: true` (ou garder `dos: true` seulement pour les sirops qui ont une contre-étiquette) : −180 Ko par fiche de sirop. | PERF-2 |
| `src/pages/produit.js` | n'appeler `photoOf()` (index de 29 Ko) que pour les flacons « à plat » (millésimes, coffret) ; la photo de face est à un chemin connu. | PERF-3, PERF-4 |
| `produit.html` / pré-rendu | affiche dans le HTML (`<img fetchpriority="high">`, deux tailles) dès que les fiches sont pré-rendues (voir 6). | PERF-4 |

## 3. Mode revue dans les pages des autres chantiers (QUAL-8)

Outil : `import { noteRevue, selonRevue } from '../lib/revue.js'` (ou `data-revue` /
`data-revue-hors` dans le HTML). Le plus simple pour toutes les pages : une ligne
`import '../lib/revue.js';` dans `src/app/site.js` (pose la classe `revue` partout).

| Fichier | Texte | Proposition |
|---|---|---|
| `src/pages/boutique.js` l. 171 (`#shop-note`) | « Prix TTC du site actuel de la distillerie. … Maquette : le paiement n'est pas branché. » | « Prix TTC. Les produits sans prix en ligne sont vendus au prix de la boutique. » ; le reste en `noteRevue()`. |
| `boutique.html` | « Prix TTC du site de la distillerie » (introduction) | « du site de la distillerie » en note. |
| `src/pages/produit.js` l. 297 (`#source`) | « Bouteille 3D tirée de la photo du produit, avec son étiquette d'origine. » | en `noteRevue()`. |
| `src/pages/produit.js` (notes de `products.js`) | « Lancé en 1960 selon la page Histoire de la maison… », « Selon la page Histoire, … » | rendre `p.notes` avec `selonRevue()` ; ajouter dans `src/data/products.js` une forme publique de chaque note (`{ t, revue }`) — la date de naissance du PAC reste à trancher (README, « À confirmer »). |
| `src/pages/visiter.js` | `f.prix`, `f.duree` (formulaire, récapitulatif) | afficher `selonRevue(esc(f.prix), esc(f.revue?.prix))` ; FAQ « Le tarif de la visite guidée est à confirmer… » → « sur demande » + note ; `#date-hint` « les dates de 2027 sont à annoncer » en note ; `infos.horairesNote` (« Horaires de la page Contact du site de la distillerie ») en note. |
| `visiter.html`, `espace-pro.html`, `src/pages/pro.js`, `src/pages/panier.js`, `panier.html` | « Maquette : … » | garder les avertissements qui décrivent une action simulée (formulaire envoyé, paiement) ; passer en note « Contenus à fournir par la distillerie. Le site actuel exporte déjà ses fiches produits en PDF. » et le surtitre « Commande · maquette ». |
| `src/partials/footer.html` l. 62 | « Français · English et Deutsch à venir » | `data-revue` (ou retirer) ; la ligne « Maquette non officielle réalisée par V2X Studio » reste. |

## 4. En-tête, menus et recherche (A11Y-3, A11Y-4, UX-3, UX-13)

| Fichier | Changement | Réf. |
|---|---|---|
| `src/partials/header.html`, `src/app/site.js` (`bindHeader`) | chaque `.mega` juste après son bouton dans `.nav__item` (ou focus sur le premier lien du panneau à l'ouverture au clavier) ; fermeture au `focusout` hors du bouton et du panneau. | A11Y-3 |
| `src/app/site.js` (`bindSearch`, `bindMenu`) | recherche et menu plein écran en `<dialog>` + `showModal()` (ou `inert` sur `#contenu`, le pied de page et le reste de l'en-tête pendant l'ouverture). | A11Y-4 |
| `src/app/site.js` (`initSite`) | porte d'âge à la première action vers l'alcool, plus à l'entrée (après avis du juriste). | UX-3 |
| `src/partials/header.html` | « Compte », « EN », « DE » : retirer ou relier ; langue courante déjà soulignée. | UX-13 |
| `src/app/site.js` (`fillRenders`) | rien à changer : les rendus des menus sont pré-calculés (−2,3 Mo à l'ouverture de « Nos marques » au bureau, −1 Mo pour le menu du téléphone). Penser à relancer `scripts/rendus.mjs` si un `data-render` / `data-bg` change dans l'en-tête ou si `spiritsMenu()` change de produits. | PERF-2 |

## 5. Boutique, panier et commande (A11Y-6, A11Y-8, A11Y-9, A11Y-10, UX-4, UX-5)

| Fichier | Changement | Réf. |
|---|---|---|
| `src/styles/shop.css` | `.sort span { display: none }` → classe `sr-only` (le tri garde son nom au téléphone). | A11Y-8 |
| `src/styles/shop.css` (`.range input`) | les deux curseurs d'un intervalle se superposent sur toute la largeur : l'anneau de focus entoure toute la piste et ne dit pas quelle poignée bouge. Anneau sur la poignée : `.range input:focus-visible { outline: none; box-shadow: none }` et, sur `::-webkit-slider-thumb` / `::-moz-range-thumb`, `outline: 2px solid var(--focus); box-shadow: 0 0 0 4px var(--focus-halo)`. | A11Y-2 |
| `src/styles/shop.css` (`.shop__side`) | `scroll-padding-bottom: 72px` : la colonne des filtres défile seule (le `scroll-padding` posé sur `html` ne s'y applique pas) et ses dernières cases passent sous la pastille V2X au clavier. | A11Y-2 |
| `boutique.html`, `src/pages/boutique.js` | `role="group"` sur `#shop-chips`, `#shop-grid` ; `aria-current="true"` sur le rayon actif ; `aria-valuetext` (« 4,40 € ») sur les curseurs ; ne pas reconstruire tout le formulaire dans `removeChip()`. | A11Y-9, A11Y-6 |
| `src/app/site.js` (`renderDrawer`), `src/pages/panier.js` (`render`) | mettre à jour la quantité et les totaux sans réécrire la liste, ou rendre le focus au même bouton. | A11Y-6 |
| `src/pages/panier.js`, `src/pages/visiter.js`, `src/pages/pro.js` | une erreur par champ (`aria-describedby`, `aria-invalid`), champs obligatoires signalés. | A11Y-10 |
| `src/pages/produit.js`, `src/app/cards.js`, `src/pages/panier.js` | prix au litre (70 cl, 50 cl, 1,5 L, 1,75 L), frais de port visibles dès la fiche. | UX-5, UX-4 |
| `src/data/products.js` (`euro()`) | espace fine insécable (` `) avant « € ». | QUAL-10 |

## 6. Pré-rendu, référencement et cache (PERF-1, SEO-2 à SEO-5, SEO-8, PERF-8, PERF-9)

| Fichier | Changement | Réf. |
|---|---|---|
| `vite.config.js` | plugin de pré-rendu à côté de `partials()` : fiches de sirops (`dist/boutique/<slug>.html`), grille de la boutique, recettes, archives ; titre, description, `canonical`, `og:*` et JSON-LD `Product`/`Offer`/`BreadcrumbList` par fiche ; spiritueux après la porte d'âge avec un squelette. | PERF-1, SEO-2, SEO-4 |
| `vercel.json` | retirer la réécriture `/boutique/:slug` une fois les fiches pré-rendues (vraies 404) ; redirections 301 du site actuel (`url` de `catalogue.json`, recettes, presse). | SEO-2, SEO-5 |
| `vercel.json` (`headers`) | `Cache-Control: public, max-age=31536000, immutable` (chemins versionnés) ou `public, max-age=86400, stale-while-revalidate=604800` pour `/bouteilles/*`, `/archives/*`, `/archives-tailles/*`, `/rendus/*`, `/recettes/*`, `/lieux/*`, `/logos/*`, `/marques/*` ; puis retirer `cache: 'no-cache'` de `fetchJSON()` (`src/lib/photos.js`). | PERF-8 |
| `boutique.html`, `produit.html`, `panier.html` | `canonical`, `og:url`, `og:description` (comme les autres pages) ; `noindex` gardé sur `/panier`. | SEO-3 |
| `index.html`, `src/partials/head.html` | à la mise en ligne : domaine définitif dans `canonical`, `og:url` et le JSON-LD ; horaires du `Store` générés depuis `src/data/site.js` au build (les dates `validFrom` / `validThrough` sont écrites pour 2026-2027). | SEO-3, SEO-4 |
| `boutique.html`, `produit.html`, `panier.html` | `preload` de la police Archivo, comme dans `src/partials/head.html` et `index.html` (fait dans la première vague : il a supprimé le décalage de 0,06 des archives au chargement de la police). | PERF-5 |
| ces trois pages, `src/partials/head.html`, `index.html`, `public/v2x/proposition.js` | `/v2x/proposition.css` chargé sans bloquer le rendu (`media="print" onload="this.media='all'"`) tant que la pastille reste, à faire sur les cinq en-têtes à la fois ; la pastille ne doit alors s'insérer qu'une fois sa feuille chargée (sinon elle s'affiche un instant sans style). | PERF-9 |
| `src/app/site.js`, `src/data/products.js` | index léger du catalogue pour les cartes, la recherche et le panier ; textes complets seulement dans les fiches. | PERF-6 |

## 7. Encore possible dans les fichiers de la première vague

Pas faits dans cette vague (hors du périmètre demandé), sans conflit prévisible :

- Garnitures 3D pré-cuites (`src/three/garnish.js`, `tex.js` : textures déterministes écrites au build
  ou calculées dans un Worker) : la tâche longue d'environ 1 s après l'arrivée de three.js (PERF-2, 5).
- Bouton « Mettre l'animation en pause » sur les campagnes (`src/lib/campagne.js`, `Stage.calm`,
  préférence gardée dans le navigateur) (A11Y-7). (La pièce d'archive en grand s'ouvre déjà au
  clavier : cadre en `<button class="piece__zoom">`, A11Y-5, fait dans cette vague.)
- Feuille d'impression (`src/styles/print.css` importée par `base.css`) (QUAL-7).
- Archivo : instance allégée possible (graisses 400 à 820, largeurs 74 à 104 %, 87 → 73 Ko) quand
  tous les chantiers auront figé leurs graisses (le CRM et l'espace pro peuvent en ajouter) (PERF-5).
