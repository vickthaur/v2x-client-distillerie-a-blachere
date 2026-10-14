# Distillerie A. Blachère · maquette de refonte

Proposition de nouveau site pour la **Distillerie A. Blachère** (Sandrine et Raphaël, 8e génération, Châteauneuf-du-Pape), préparée par V2X Studio.

- Maquette : à déployer sur Vercel (projet `v2x-client-distillerie-a-blachere`), non indexée (`noindex` + `robots.txt`)
- Site actuel : https://www.distillerieablachere.com/

## Ce qu'il y a dedans

Un site vitrine dans l'esprit de Fruitzz, la démo 3D de V2X : fond aux couleurs du produit actif, grandes bouteilles en 3D qui tournent en carrousel avec leurs fruits et leurs plantes autour, nom géant, gros plan au scroll. Le ton reste celui d'une maison de 1835 : étiquettes typographiques, accents en italique, papier vergé pour les spiritueux.

- **Héros** : carrousel 3D des six produits (PAC Citron, Fun Blue, Pastis Marra, La Magistrale, Origan du Comtat, Marc de Châteauneuf-du-Pape). Bouteilles en verre construites en code (silhouette tournée, liquide coloré qui réfracte le fond, bouchon à vis, capsule ou liège), étiquette enroulée dessinée en code : nom du produit + « Distillerie A. Blachère · depuis 1835 », contre-étiquette avec l'adresse. Autour : citrons, menthe et glaçons, badiane, armoise, origan et chocolat, raisin et feuille de vigne. Flèches, frise à glisser, clavier, glisser du doigt, pastilles sur téléphone.
- **Gros plan** : au scroll, la bouteille avance et tourne pour montrer sa contre-étiquette ; à gauche, la fiche du produit puis deux ou trois chapitres (PAC : 1960, les initiales P·A·C, 100 % naturel ; Marra : depuis 1955, 40 plantes et épices, sans sucre ; etc.).
- **De 1835 à 2035** : frise horizontale épinglée au scroll (ordinateur), à faire glisser sur téléphone : 1835 rue Molière, 1884 Origan du Comtat, 1955 pastis Marra, 1960 PAC Citron, 1993 Châteauneuf-du-Pape et la 8e génération, 2035 le bicentenaire.
- **Deux univers** : les sirops pour tout le monde (PAC Citron, Fun Blue, gamme Couleur Provence, une trentaine de sirops) ; les spiritueux (pastis, liqueurs, marcs et eaux-de-vie) seulement après la vérification de l'âge.
- **Boutique** (aperçu) : une carte par produit avec un rendu 3D de la bouteille, bouton « Ajouter », panier latéral. Seul prix connu : PAC Citron et Fun Blue, 6,70 € TTC le litre. Les autres affichent « Prix à compléter ». Le paiement n'est pas branché.
- **Visites et dégustations** : visite gratuite sur réservation, 5 € par personne pour les groupes avec dégustation, boutique d'octobre à mars du lundi au samedi de 10 h à 18 h. Formulaire de réservation : individuel ou groupe (total calculé), date, créneau, nombre de personnes, nom, e-mail ou téléphone.
- **Espace pro** : cafés-hôtels-restaurants, cavistes, épiceries fines ; formulaire de demande (gammes qui intéressent).
- **Nous trouver** : 1695 route de Sorgues, 84230 Châteauneuf-du-Pape, lien d'itinéraire (OpenStreetMap), horaires de la boutique. Pas de téléphone ni d'e-mail (inconnus).
- **Mentions légales** avec les données des registres (SARL DISTILLERIE A. BLACHERE, capital 1 508 428 €, SIREN 325 034 106, siège), mention « maquette non officielle », hébergement Vercel, conception V2X Studio. **Page 404.**
- Tous les faits viennent de la note de prospection (`V2X-Studio/research_notes/…/blachere_et_spiritueux.md`, sections 1 à 3) : rien d'inventé, ni prix, ni degré, ni contenance, ni horaire en dehors de ceux-là.
- Formulaires en mode maquette : ils vérifient la saisie et affichent une confirmation, sans rien envoyer.
- Pastille « Proposition de refonte » en bas à gauche (`public/v2x/proposition.js`) : qui a fait la maquette, comparaison avec le site actuel, appel, demande de rappel. Chaque ouverture remonte dans le CRM (v2x-studio.fr/prospection), sans cookie. Pour ne pas compter tes propres visites : ouvre une fois la maquette avec `?moi`.

## Âge légal et loi Évin

C'est l'argument de conformité face au site actuel (simple question « Avez vous l'age légal » sous `/pr/avertissement`, dont on ne sait pas si elle bloque vraiment, capital erroné dans les mentions légales) :

- À la première visite, une fenêtre demande la **date de naissance** (jour, mois, année). Les sirops restent accessibles sans répondre (« Continuer avec les sirops seulement »).
- Moins de 18 ans : les spiritueux sont **retirés de la page** (carrousel 3D, boutique, frise, univers, espace pro) et la réponse est gardée pour la session : impossible de réessayer tout de suite. 18 ans ou plus : la réponse est gardée dans le navigateur (`localStorage`, clé `blachere-age`).
- Le message « L'abus d'alcool est dangereux pour la santé, à consommer avec modération. » accompagne chaque endroit où un alcool apparaît : héros, gros plan, chapitres, frise, univers, cartes de la boutique, panier, pied de page, contre-étiquettes, fenêtre d'âge.
- Lien « Revoir la vérification de l'âge » en pied de page (pratique pour les démonstrations).

## Modifier

- Produits : `src/data/products.js` (noms, textes, chapitres, couleurs, liquide, bouchon, style d'étiquette, éléments autour), avec la frise (`timeline`) et les infos pratiques (`infos`). Tout le site suit : 3D, étiquettes, boutique, formulaires.
- Silhouettes des bouteilles : `src/data/shapes.js` (cotes en millimètres, partagées par la 3D et l'illustration de secours).
- Étiquettes : `src/three/label.js` (style « pop » pour les sirops, « maison » pour les spiritueux). 3D : `src/three/` (`scene.js` carrousel et gros plan, `bottle.js`, `garnish.js`, `backdrop.js` fond réfracté).
- Styles : `src/styles.css` (couleurs en variables au début). Titres en Archivo, accents en Instrument Serif, texte en Inter : polices hébergées dans `src/fonts` (sous-ensemble latin, licence SIL OFL), aucune requête vers Google Fonts.
- Lancer : `npm install`, `npm run dev` ; construire : `npm run build` (sortie dans `dist/`), vérifier : `npm run preview`.

## Robustesse

- Téléphone (390 px) et ordinateur, sans défilement horizontal.
- `prefers-reduced-motion` : pas de défilement doux, pas d'animation automatique, frise en grille au lieu de l'épinglage.
- Sans WebGL : fond en dégradé CSS, nom géant, bouteilles en SVG (mêmes silhouettes et couleurs), tout le contenu reste lisible.
- Three.js est chargé à part, après le reste de la page ; la résolution baisse toute seule si l'appareil peine. Les petits appareils (moins de 4 cœurs) ont un liquide opaque au lieu du volume transparent.

## Avant la mise en ligne réelle

1. Visuels : photos ou modèles des vraies bouteilles (formes, contenances, couleurs des liquides), vraies étiquettes et logos à la place des étiquettes dessinées en code, photos de la distillerie, de la boutique et des visites.
2. Prix de tous les produits (seuls PAC Citron et Fun Blue sont connus), degrés et contenances des liqueurs et des marcs, autres sirops de la gamme Couleur Provence → boutique avec paiement (Stripe ou la solution actuelle), CGV de vente d'alcool à distance.
3. Téléphone et e-mail de la distillerie (pied de page, mentions légales, page de contact), directeur de la publication.
4. Réservation des visites : brancher un vrai agenda (créneaux, jours de fermeture, horaires d'avril à septembre, confirmation par e-mail, rappels), et l'envoi du formulaire pro.
5. Versions anglaise et allemande (clientèle touristique de Châteauneuf et du Ventoux).
6. Bandeau cookies si une mesure d'audience est ajoutée.
7. Domaine `distillerieablachere.com` dans Vercel, retirer `noindex` (`vercel.json`, balises `robots` des pages, `public/robots.txt`) et la pastille (`public/v2x/` et les deux lignes qui la chargent dans `index.html` et `mentions-legales.html`).
