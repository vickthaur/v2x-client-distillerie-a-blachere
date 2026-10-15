# Opération « Octobre Rose » : relevé sur le site officiel

Relevé fait le **15 octobre 2026 vers 08 h 40 UTC** (10 h 40, heure de Paris), avec `curl` et un
User-Agent de Chrome sur Windows. Aucun texte n'a été inventé ni complété : ce qui n'a pas été trouvé
est listé à la fin.

## Source unique : la bannière du carrousel de l'accueil

- Page : https://www.distillerieablachere.com/ (redirigée vers https://www.distillerieablachere.com/fr/)
- Le carrousel (`swiper`) de l'accueil FR ne contient qu'**une seule diapositive**, celle-ci :
  - Image : https://www.distillerieablachere.com/uploads/advertisings/10/823de1439e490b2c2c59f8ee90d29f9e.jpg
    (JPEG 1920 × 488 px, 60 547 octets, `Last-Modified: Mon, 21 Sep 2026 14:27:05 GMT`)
  - `alt="octobre rose"`, `title="octobre rose"`
  - Titre HTML laissé en commentaire dans le code : `<!--<h1 …>octobre rose</h1> -->`
  - Lien : https://www.distillerieablachere.com/fr/affichage/redirect/10, qui redirige (302) vers la
    fiche produit https://www.distillerieablachere.com/fr/boutique//pac-citron_158?detail_id=98&q=pac
- Copie en taille originale : [`banniere-octobre-rose-pac-citron-1920x488.jpg`](banniere-octobre-rose-pac-citron-1920x488.jpg)
  (SHA-256 `f6c317c40b86343915f0dec0feb5109ed33c424cc5c3c77b02aa27c89dfe0f86`)

### Texte de l'image, mot pour mot

Le texte n'existe que dans l'image (pas de texte HTML). Fond blanc semé de rubans roses ; au centre, un
cartouche rose aux coins arrondis :

- À gauche, en gros caractères blancs : **« Du 1/10 au 31/10 »**
- Au centre, en blanc :
  > Pour chaque bouteille de
  > **PAC CITRON**
  > vendue* 1€ sera reversé à
- À droite, un logo (silhouette stylisée, mention « Sainte Catherine ») suivi de :
  **« INSTITUT DU CANCER »** / « Avignon-Provence »
- En bas, en petits caractères noirs :
  > \* Offre valable uniquement sur le site web et en boutique d’usine

## Relevé structuré

| Point | Ce que dit la source | Source |
|---|---|---|
| Bénéficiaire | « INSTITUT DU CANCER Avignon-Provence », logo « Sainte Catherine » (nom tel qu'il est écrit dans l'image) | bannière |
| Montant | « 1€ » « pour chaque bouteille de PAC CITRON vendue* » | bannière |
| Période | « Du 1/10 au 31/10 » (l'année n'est pas écrite ; image mise en ligne le 21/09/2026) | bannière |
| Conditions | « * Offre valable uniquement sur le site web et en boutique d’usine » | bannière |
| Produits concernés | La bannière dit seulement « bouteille de PAC CITRON », sans contenance. La boutique en ligne ne propose qu'une référence : « PAC CITRON® 6,70€ TTC / 1 L » (une seule variante, `detail_id=98`) | bannière + fiche produit |
| Titre | « octobre rose » (attributs `alt`/`title` et titre en commentaire HTML) | code de l'accueil |

## Pages consultées sans autre mention de l'opération

Recherche de « octobre », « rose », « ruban », « cancer », « reversé », « don », « ligue »,
« association », « institut », « Sainte Catherine » dans le texte, les noms et les `alt` d'images :

- Fiche PAC Citron : https://www.distillerieablachere.com/fr/boutique//pac-citron_158?detail_id=98&q=pac :
  aucune mention de l'opération dans le texte ; ses deux images (étiquette 1 L et bouteille) sont
  les visuels habituels, sans rose ni ruban.
- Catégorie sirops : https://www.distillerieablachere.com/fr/boutique/categories/sirops_1 : rien.
- Achat express : https://www.distillerieablachere.com/fr/achat-express : rien.
- Accueil anglais https://www.distillerieablachere.com/en/ (bannière « FACTORY OUTLET OPENING ») et
  provençal https://www.distillerieablachere.com/pr/ (bannière « OUVERTURE MAGASIN ») : pas de
  bannière Octobre Rose.
- Seules autres occurrences de « octobre » : les horaires « Octobre à Mars 10h00 - 18h00 du lundi au samedi ».

## Ce qui n'a pas pu être trouvé ou consulté

- **Année** de la période : non écrite (« Du 1/10 au 31/10 »).
- **Contenances** : la bannière ne précise pas si toutes les contenances sont concernées ; le site
  ne vend que le 1 L, et rien ne dit ce qu'il en est en boutique d'usine pour d'autres formats.
- **Nom officiel complet / statut juridique** du bénéficiaire, plafond éventuel du don, modalités de
  versement, hashtag : introuvables sur le site.
- **paccitron.com** et **www.paccitron.com** : échec de la connexion TLS (`tlsv1 alert internal error`),
  aucun contenu récupéré.
- **Facebook** (https://www.facebook.com/PACCitron) et **Instagram**
  (https://www.instagram.com/paccitron/) : redirigés vers la page de connexion, non consultés.
- **sitemap.xml** : boucle de redirections, inexploitable.
- Pas de page « actualités » trouvée dans la navigation du site.
