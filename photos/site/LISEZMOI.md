# Visuels et catalogue du site actuel de la Distillerie A. Blachère

Récupération faite le **14 octobre 2026** sur https://www.distillerieablachere.com (versions `/fr/` et `/en/`),
pour préparer la maquette de refonte. **Matériel de travail interne** : ce dossier n'est lu par aucun script
du dépôt (`scripts/photos.mjs` ne lit que `photos/produits/` et `photos/lieux/`).

## Accès

Accès OK (HTTP 200). Le proxy réseau a coupé quelques connexions au passage (« connection reset ») :
chaque requête a été réessayée, aucune page ni image n'a été perdue pour cette raison.

Méthode : au moins 1,2 s entre deux requêtes, un seul client à la fois, uniquement sur
`www.distillerieablachere.com`. Pas de formulaire, pas de compte, pas de panier, pas de newsletter.
La fenêtre d'âge du site est un simple cookie posé par le bouton « J'ai l'âge légal » (pays : France) ;
on a envoyé ce même cookie, sans quoi les catégories d'alcools affichent « 0 produit(s) ».

## En chiffres

| | |
|---|---|
| URL visitées (crawl final) | 358, dont 285 pages distinctes après redirections |
| Identifiants produits sondés en plus | 117 (tous les identifiants libres de 1 à 180) |
| Images | **319** fichiers, 262 Mo, toutes en **original** (fichier sans suffixe `_M`/`_L`/`_XL`), sans recompression |
| Produits | **63** : 27 sirops, 1 sirop « Couleur provence® », 35 alcools |
| Pages texte | 63 fichiers `.md` dans `pages/` |

## Contenu

- `catalogue-site.json` : un objet par produit : `nom` exact, `categorie` et `gamme` (fil d'Ariane de la
  fiche), `contenances` (volume et prix TTC tels qu'affichés, toutes les options du menu déroulant quand
  il y en a plusieurs), `degre`, `description` et `ingredients` (texte exact), `autres_rubriques`
  (Valeurs nutritionnelles, Application, Le saviez-vous ?), `reference` (SKU), `url`, `url_en`/`nom_en`
  quand la fiche anglaise existe, `images` (fichiers locaux, dans l'ordre de la galerie).
- `manifest.json` : une entrée par image : `fichier`, `url_source`, `page_source`, `alt`, `produit`,
  `largeur`, `hauteur`, `type` (produit | lieu | bandeau | logo | affiche | autre), plus `octets` et
  `autres_pages` (nombre d'autres pages où l'image apparaît).
- `produits/` (161) : photos des fiches produits, `<produit>-1` = image principale de la galerie.
  Hauteur de 261 à 4 096 px (médiane 1 768 px). C'est la plus grande taille que le site possède.
- `autres/fiches-produits/` (44) : illustrations insérées dans les textes des fiches (étiquettes anciennes,
  archives) ; le champ `produit` du manifeste indique la fiche.
- `lieux/` (2) : la boutique de la distillerie, et une photo d'archive du stand au Palais des Papes.
- `affiches/` (3) : affiche ancienne de La Magistrale, étiquettes anciennes PAC Citron et Mauresque.
- `bandeaux/` (3) : bandeau de la page Histoire, bannières « Octobre rose » et « Factory outlet opening ».
- `logos/` (5) : logos SVG (principal, pied de page, carré, version défilement) et favicon.
- `autres/presse/` (49) : vignettes et coupures de la rubrique « On parle de nous ». **Les droits de ces
  images sont à leurs éditeurs (La Provence, Le Dauphiné, BFM…) : à ne pas réutiliser telles quelles.**
- `autres/recettes/` (27), `autres/textures-theme/` (13 fonds et motifs du thème, pris dans ses CSS),
  `autres/pictos/` (5 pictos « atouts »), `autres/drapeaux/` (3), `autres/histoire/` (vers manuscrits de
  Mistral), et dans `autres/` l'image de partage réseaux sociaux et les logos de paiement.
- `pages/` : texte exact, URL source en tête : `histoire.md`, `contact-acces.md` (adresse, horaires
  boutique et bureaux), `horaires-boutique.md`, `mentions-legales.md`, `confidentialite.md`, `cgv.md`,
  `livraison.md`, `accueil.md`, `recettes-index.md` et `recettes/` (26 fiches), `on-parle-de-nous-index*.md`
  et `on-parle-de-nous/` (20 articles), versions anglaises préfixées `en-`.
- `outils/` : les scripts Python utilisés (crawl, extraction, téléchargement, assemblage), pour refaire
  la récupération plus tard.

## Ce qui n'a pas pu être récupéré, et points à savoir

- **Pages en anglais** : seuls 6 produits ont une fiche anglaise (PAC Citron, FUN Blue, Sirop Fraise,
  Pastis Marra, Pastis Le Camarguais, Elixir du Mont Ventoux). Pour les 57 autres, `/en/` renvoie à la
  boutique. Pages anglaises récupérées : accueil, boutique, achat express, histoire, contact, CGV,
  confidentialité, conditions d'utilisation, 2 recettes.
- **`/pr/avertissement` n'existe pas** (404). `/pr/` est la version en provençal du site, doublon de `/fr/`,
  non parcourue. `/fr/avertissement` et `/en/avertissement` redirigent vers la page Confidentialité.
- **Pas de page « visites »** sur le site : horaires et adresse sont sur la page Contact et dans la fenêtre
  « Horaires boutique » de l'en-tête.
- **3 images référencées mais absentes du serveur** (redirection 301) : `uploads/company/img_seo.jpg`
  (balise de partage), `assets/images/logos/icon-512x512.png` (icône d'application),
  `themes/public/img/filigrane.svg` (fond CSS).
- 68 images insérées dans les textes pointent vers un ancien domaine de prévisualisation
  (`*.preview.infomaniak.website`) ; ce domaine n'a pas été contacté : les mêmes fichiers ont été pris sur
  `www.distillerieablachere.com/uploads/pages/`, et tous existaient.
- Très peu de **photos de lieux** sur le site : seulement les 2 de `lieux/` (et des photos de la boutique
  dans les coupures de presse, aux droits des journaux). Les photos du chai, des alambics et des extérieurs
  restent à faire.
- Les slugs d'URL ne correspondent pas toujours au produit (`sirop-d-orgeat_44` est le Sirop Framboise) :
  le nom fait foi, le champ `id_site` est l'identifiant stable.
- Les prix sont ceux affichés le 14/10/2026. « Coffrets » est un format proposé dans le menu déroulant
  de certaines fiches.
- **Vidéos non téléchargées** (hors périmètre « images ») : la rubrique « On parle de nous › Vidéos »
  héberge 18 MP4 sur le site même ; leurs URL et pages sont listées dans `videos.json`.
