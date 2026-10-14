# Photos de la maquette

Déposez ici les photos de la distillerie : au prochain `npm run build` (ou `npm run photos`), elles
remplacent les bouteilles dessinées en code par de vraies bouteilles 3D, et les cadres « photo à
faire » par les photos des lieux. Rien d’autre à modifier dans le code.

## Bouteilles : `photos/produits/`

| Fichier | Rôle |
|---|---|
| `<slug>.jpg` (ou `.png`, `.webp`) | Photo de face, obligatoire |
| `<slug>-dos.jpg` (ou `.png`, `.webp`) | Contre-étiquette, facultative |

Sans photo de dos, le dos de la bouteille 3D reprend la face, retournée et assombrie.

### Comment photographier

- La bouteille debout, de face, entière (bouchon compris), à hauteur d’étiquette.
- Un fond uni et clair (blanc ou gris très clair), sans autre objet ; ou un PNG déjà détouré.
- La plus grande définition possible (2 000 px de haut ou plus). Une légère inclinaison est corrigée.
- Une ombre douce au sol est acceptée : le script la retire.

### Ce que fait `scripts/photos.mjs`

1. Retire le fond depuis les bords de l’image (les blancs intérieurs, comme une étiquette blanche,
   sont gardés ; l’ombre portée au sol est retirée ; la transparence d’un PNG est conservée).
2. Redresse la bouteille si elle penche, puis la recadre.
3. Mesure la silhouette ligne par ligne autour de l’axe, la lisse et la normalise (181 points).
4. Écrit dans `public/bouteilles/<slug>/` :
   - `face.webp` : texture de la bouteille (1 024 px de haut, fond transparent) ;
   - `dos.webp` : texture du dos, si une photo de dos existe ;
   - `profil.json` : la silhouette, que Three.js fait tourner (LatheGeometry) ;
   - `vignette.webp` : l’image des cartes de la boutique.
5. Met à jour `public/bouteilles/index.json`, que le site lit au chargement.

Le dossier `public/bouteilles/` est régénéré à chaque build : il n’est pas versionné. Un cache
(`.cache/photos.json`) évite de retraiter une photo qui n’a pas changé ; `npm run photos -- --force`
retraite tout.

La preuve de bout en bout est dans `scripts/test-packshot.mjs` : le script dessine une bouteille sur
fond blanc (`scripts/test-packshot.png`), la fait passer dans le pipeline vers un dossier temporaire,
affiche la bouteille 3D obtenue sous plusieurs angles, puis nettoie.

```bash
npm run photos                 # traite photos/ → public/
node scripts/test-packshot.mjs # preuve de bout en bout (Chromium de Playwright requis)
```

## Lieux : `photos/lieux/`

`<nom>.jpg` → `public/lieux/<nom>-1600.webp` et `<nom>-800.webp`. Les noms attendus par les pages :

| Fichier | Où il apparaît |
|---|---|
| `comptoir.jpg` | La maison, le lieu ; Visiter |
| `herboristerie.jpg` | La maison, le lieu |
| `chai.jpg` | La maison, le lieu |
| `vignes.jpg` | La maison, le lieu |
| `sandrine-blachere.jpg` | La maison, la famille (avec accord écrit) |
| `raphael-vannelle.jpg` | La maison, la famille (avec accord écrit) |

Les photos de presse et les visuels de revendeurs ne doivent pas être utilisés sans accord. Les
étiquettes collector de C215 et de Claude Viallat ne sont publiées qu’avec l’accord des artistes.

## Les 35 slugs du catalogue

| Slug | Nom officiel | Univers |
|---|---|---|
| `pac-citron` | PAC CITRON® | sirop |
| `fun-blue` | FUN BLUE | sirop |
| `sirop-couleur-provence-cola` | SIROP COULEUR PROVENCE® COLA | sirop |
| `sirop-couleur-provence-orgeat` | SIROP COULEUR PROVENCE® ORGEAT | sirop |
| `sirop-couleur-provence-grenadine` | SIROP COULEUR PROVENCE® GRENADINE | sirop |
| `sirop-couleur-provence-figue` | SIROP COULEUR PROVENCE® FIGUE | sirop |
| `sirop-couleur-provence-violette` | SIROP COULEUR PROVENCE® VIOLETTE | sirop |
| `sirop-couleur-provence-reglisse` | SIROP COULEUR PROVENCE® REGLISSE | sirop |
| `sirop-couleur-provence-kiwi` | SIROP COULEUR PROVENCE® KIWI | sirop |
| `sirop-anis` | Sirop d'anis | sirop |
| `sirop-chataigne` | Sirop de chataîgne | sirop |
| `sirop-fraise-barbe-a-papa` | SIROP FRAISE BARBE A PAPA | sirop |
| `sucre-de-canne` | Sucre de canne | sirop |
| `sirop-menthe` | SIROP MENTHE | sirop |
| `sirop-fraise` | SIROP FRAISE | sirop |
| `sirop-citron` | SIROP CITRON | sirop |
| `sirop-framboise` | SIROP FRAMBOISE | sirop |
| `sirop-peche` | SIROP PECHE | sirop |
| `sirop-cassis` | SIROP CASSIS | sirop |
| `sirop-orange` | SIROP ORANGE | sirop |
| `sirop-lavande` | SIROP LAVANDE | sirop |
| `sirop-melon` | SIROP MELON | sirop |
| `sirop-vanille` | SIROP VANILLE | sirop |
| `sirop-passion` | SIROP PASSION | sirop |
| `sirop-pomme` | SIROP POMME | sirop |
| `sirop-banane` | SIROP BANANE | sirop |
| `sirop-caramel` | SIROP CARAMEL | sirop |
| `sirop-caramel-fleur-de-sel-camargue` | SIROP CARAMEL A LA FLEUR DE SEL DE CAMARGUE | sirop |
| `pastis-marra` | PASTIS MARRA® | spiritueux (18+) |
| `pastis-le-camarguais` | LE CAMARGUAIS® | spiritueux (18+) |
| `aperitif-lou-gardian` | APERITIF VIN ET PECHE « LOU GARDIAN » | spiritueux (18+) |
| `la-camarguaise` | LA CAMARGUAISE ® | spiritueux (18+) |
| `verveine-auguste-vieilli` | VERVEINE AUGUSTE VIEILLI | spiritueux (18+) |
| `eau-de-vie-poire-williams-flirt` | Eau de vie Poires Williams « FLIRT® » | spiritueux (18+) |
| `marc-chateauneuf-du-pape-reserve-des-legats` | Réserve des LEGATS | spiritueux (18+) |
