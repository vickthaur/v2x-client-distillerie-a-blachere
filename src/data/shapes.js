// Silhouettes des bouteilles dessinées en code, en millimètres : [rayon, hauteur], du centre du
// fond jusqu'à la bague. Formes génériques en attendant les photos des vraies bouteilles : dès
// qu'une photo est déposée dans photos/produits/, sa silhouette réelle remplace celle-ci
// (voir photos/LISEZMOI.md). Utilisées par la 3D (LatheGeometry) et par l'illustration SVG de
// secours quand WebGL n'est pas disponible.
//
// label   = [bas, haut] de l'étiquette sur la partie droite du corps
// body    = rayon de la partie droite (étiquette)
// neck    = rayon du goulot ; lip = haut de la bague
// closure = bouchon : [bas, haut, rayon]
// fillTop = niveau du liquide (bouteille pleine)
export const shapes = {
  // Sirop 1 L (PAC Citron, Fun Blue, sirops 1 L) : proportions relevées sur la photo du PAC 1 L
  // (corps droit de 85 mm, épaules larges et carrées en tronc de cône, col court, bague, grand
  // bouchon à vis). Étiquette de face de 130 mm de haut, à 10 mm du fond.
  pac1l: {
    pts: [[0, 0], [33, 0.4], [39.4, 2], [41.8, 5], [42.5, 9], [42.5, 158], [42.3, 161], [41.6, 164], [26.6, 196], [25.1, 198.5], [22.7, 200.6], [19.9, 202.6], [17.2, 205], [15.3, 208], [14.3, 211.5], [13.9, 215], [13.8, 218], [13.8, 228], [14.2, 228.6], [17, 229.2], [17.2, 230.4], [16.8, 231.4], [14, 231.8], [13.9, 232.4], [13.9, 247], [13.2, 248], [12.2, 248.4]],
    label: [10, 140],
    body: 42.5,
    neck: 13.8,
    lip: 248.4,
    closure: [232.6, 268, 16.6],
    closureKind: 'tall',
    fillTop: 194,
  },
  // Sirop 1 L en verre (type PAC Citron) : long corps droit, épaule ronde, long col, capsule à vis.
  sirop: {
    pts: [[0, 0], [35, 0.4], [40, 2.4], [42, 7], [42.4, 14], [42.4, 168], [41.6, 180], [38.5, 193], [32, 205], [24, 214], [18.4, 221], [16.2, 229], [15.8, 240], [16.3, 262], [15.8, 276], [17.2, 277.5], [17.2, 284], [15.4, 286.2], [13, 286.6]],
    label: [26, 160],
    body: 42.4,
    neck: 15.8,
    lip: 286.6,
    closure: [266, 306, 18.6],
    fillTop: 248,
  },
  // Sirop 70 cl : même famille, un peu plus fin et plus court.
  sirop70: {
    pts: [[0, 0], [31, 0.4], [36, 2.4], [37.8, 7], [38.2, 14], [38.2, 150], [37.4, 162], [34.5, 174], [28.5, 185], [21.5, 193], [16.8, 199], [15, 207], [14.8, 218], [15.2, 238], [14.8, 250], [16.1, 251.5], [16.1, 257.5], [14.4, 259.6], [12.2, 260]],
    label: [24, 142],
    body: 38.2,
    neck: 14.8,
    lip: 260,
    closure: [243, 278, 17.2],
    fillTop: 222,
  },
  // Sirop 50 cl : bouteille trapue.
  sirop50: {
    pts: [[0, 0], [28, 0.4], [32, 2.4], [33.6, 7], [34, 14], [34, 126], [33.2, 137], [30, 148], [24.5, 158], [19, 165], [15.5, 170], [14, 178], [14, 206], [15.3, 207.5], [15.3, 213], [13.7, 215], [11.6, 215.4]],
    label: [22, 118],
    body: 34,
    neck: 14,
    lip: 215.4,
    closure: [198, 232, 16.2],
    fillTop: 182,
  },
  // Pastis 70 cl : épaule marquée, long goulot, capsule.
  pastis: {
    pts: [[0, 0], [32, 0.4], [37.5, 2.4], [39.6, 7], [40, 14], [40, 182], [39.2, 195], [35, 208], [27, 220], [19.5, 231], [15.4, 242], [14.6, 252], [14.6, 282], [15.9, 283.5], [15.9, 289], [14.2, 291], [12, 291.4]],
    label: [32, 152],
    body: 40,
    neck: 14.6,
    lip: 291,
    closure: [258, 293, 15.6],
    fillTop: 214,
  },
  // Flacon d'apothicaire, large et trapu, bouchon de liège à tête de bois.
  apothicaire: {
    pts: [[0, 0], [38, 0.5], [44, 3], [46.6, 9], [47, 16], [47, 148], [46, 160], [41.5, 172], [33, 182], [24, 188.5], [18.2, 193], [16.8, 199], [16.8, 222], [18.4, 223.5], [18.4, 228], [16.5, 229.6], [14, 230]],
    label: [30, 132],
    body: 47,
    neck: 16.8,
    lip: 230,
    closure: [224, 252, 21.5],
    fillTop: 176,
  },
  // Bouteille de liqueur élancée, long goulot, capsule.
  liqueur: {
    pts: [[0, 0], [28, 0.4], [32.6, 2.4], [34.6, 7], [35, 14], [35, 196], [34.4, 210], [30.5, 226], [23.5, 241], [16.5, 253], [13.2, 262], [12.6, 270], [12.6, 300], [13.9, 301.5], [13.9, 306.5], [12.3, 308.5], [10.4, 309]],
    label: [36, 168],
    body: 35,
    neck: 12.6,
    lip: 309,
    closure: [276, 311, 13.6],
    fillTop: 238,
  },
  // Marc : épaules tombantes (type bourguignonne), capsule.
  marc: {
    pts: [[0, 0], [31, 0.4], [36.2, 2.4], [38.4, 7], [38.8, 14], [38.8, 146], [38.2, 162], [35.6, 182], [30.4, 204], [23.5, 226], [17.4, 246], [14.6, 260], [14.2, 268], [14.2, 296], [15.6, 297.5], [15.6, 302.5], [13.9, 304.5], [11.8, 305]],
    label: [30, 132],
    body: 38.8,
    neck: 14.2,
    lip: 305,
    closure: [270, 307, 15.2],
    fillTop: 208,
  },
};

// Hauteur totale (bouchon compris), en mm.
export const shapeHeight = (s) => Math.max(s.lip, s.closure[1]);
