# Photos de la maquette

Les photos de ce dossier sont la **source de vérité** des bouteilles 3D et des lieux. Depuis la v3,
elles viennent du site officiel (branche `photos-site`, importée par `npm run import-site`) ; on peut
en déposer de meilleures à la main (même nom de fichier). Au prochain `npm run build` (ou
`npm run photos`), `scripts/photos.mjs` les traite vers `public/` (non versionné, régénéré au build).
Rien d'autre à modifier dans le code.

## Bouteilles : `photos/produits/`

| Fichier | Rôle |
|---|---|
| `<slug>.webp` (ou `.jpg`, `.png`) | Photo de face, obligatoire (un PNG détouré est idéal) |
| `<slug>-dos.webp` | Photo du dos, facultative |
| `<slug>.json` | Réglages facultatifs : `{ "redresser": false, "cote": "droit" }` (silhouette prise du côté droit quand un accessoire — étiquette suspendue, collerette — déborde à gauche) |
| `plats.json` | Flacons montrés en photo, sans rotation (`{ "slugs": [...] }` : carafes et étuis) |

Les 63 slugs sont ceux de `src/data/catalogue.json`.

## Étiquettes à plat : `photos/etiquettes/`

| Fichier | Rôle |
|---|---|
| `<slug>.webp` + `<slug>.json` `{ "type": "plat", "largeur", "hauteur" }` | L'étiquette à plat (fichier de l'imprimeur, ou celui publié sur la fiche officielle), posée nette sur la bouteille 3D |
| `<slug>-dos.webp` + `<slug>-dos.json` `{ "type": "dos", … }` | La contre-étiquette, posée au dos |

`largeur` et `hauteur` sont les dimensions du fichier d'origine : elles donnent la taille relative de
la contre-étiquette. Une photo d'étiquette sur bouteille (sans `"type"`) est encore acceptée : elle est
« déroulée » (ancienne méthode, `public/etiquettes/`).

## Ce que fait `scripts/photos.mjs`

1. Retire le fond (ou garde la transparence d'un PNG), redresse, recadre.
2. Mesure la silhouette ligne par ligne autour de l'axe (181 points) : `profil.json`, que Three.js fait
   tourner (`LatheGeometry`).
3. Écrit `face.webp` (texture de 1 024 px de haut), `vignette.webp` (cartes), `corps.png` (la couleur
   « tout autour », mesurée sur les bandes latérales de la photo, pour les côtés et le dos), et pour un
   flacon à plat `photo.webp`.
4. **Étiquette à plat** : la recale sur la photo de face (corrélation : bas, haut, colonne au centre de
   la face, angle couvert autour de la bouteille), mesure une matrice couleur sur les aplats pour la
   ramener aux couleurs de la vraie bouteille, déduit sa découpe (arche, fenêtre) des zones où la photo
   montre la bouteille nue, et écrit `etiquette.webp` (avec la découpe en transparence) et
   `etiquette-dos.webp`. Les mesures sont dans `profil.json` (`etiquette`, `etiquetteDos`).
5. Met à jour `public/bouteilles/index.json`, que le site lit au chargement.

Un cache (`.cache/photos.json`) évite de retraiter ce qui n'a pas changé ; `npm run photos -- --force`
retraite tout (environ une minute pour 63 bouteilles). `DEBUG_LABEL=1` affiche le calage des
étiquettes ; `DEBUG_LABEL_DIR=<dossier>` y écrit, pour chaque étiquette, la photo « déroulée » dans le
repère de l'étiquette, le fichier et la découpe trouvée.

La preuve de bout en bout est dans `scripts/test-packshot.mjs` (`npm run test:photos`).

## Lieux : `photos/lieux/`

`<nom>.jpg` → `public/lieux/<nom>-1600.webp` et `<nom>-800.webp`. Les pages les appellent par
`data-lieu="<nom>"`.

| Fichier | Où il apparaît |
|---|---|
| `boutique-rayons.jpg` | Accueil (savoir-faire, visite), Visiter, La maison — majeurs seulement : des bouteilles d'alcool y sont visibles |
| `boutique-salon.jpg` | Accueil (savoir-faire) — majeurs seulement |
| `stand-palais-des-papes.jpg` | Carte postale ancienne (aussi dans les archives) |

Les deux photos de la boutique sont redressées et recadrées depuis le montage incliné publié sur le
site (`scripts/import-site.mjs`). À remplacer par des photos du lieu après les travaux (herboristerie,
chai, comptoir, vignes), avec l'accord des personnes photographiées.
