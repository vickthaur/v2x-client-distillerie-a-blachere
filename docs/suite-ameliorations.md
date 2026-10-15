# Suite des améliorations · deuxième vague (octobre 2026)

La première vague (branche `wt-ameliorations`) a corrigé, dans les fichiers qui ne sont pas en cours
de réécriture ailleurs, une partie du plan d'action de l'audit (`docs/audit-2026-10.md`) : affiche des
campagnes et 3D sobre, vignettes paresseuses, rendus des menus pré-calculés, contrastes et focus,
double marge des pages de contenu, en-tête à 320 px, mode revue, poids (logos, Fraunces, archives),
balises de page et données structurées. Ce qui suit demande des fichiers tenus par les autres
chantiers (boutique, fiches, panier et commande, visites, espace pro, CRM, en-tête et pied de page,
`src/app/site.js`, `vite.config.js`, `vercel.json`) : à faire quand ces chantiers seront fusionnés.
Chaque point donne le fichier, le changement et la référence de l'audit.

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
