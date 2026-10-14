// Silhouettes des bouteilles, en millimètres : [rayon, hauteur], du centre du fond jusqu'à la bague.
// Formes génériques (sirop 1 L, pastis, flacon d'apothicaire, liqueur, marc) en attendant les cotes
// et les photos des vraies bouteilles. Utilisées par la 3D (LatheGeometry) et par l'illustration SVG
// de secours quand WebGL n'est pas disponible.
//
// label   = [bas, haut] de l'étiquette sur la partie droite du corps
// body    = rayon de la partie droite (étiquette)
// neck    = rayon du goulot ; lip = haut de la bague
// closure = bouchon : [bas, haut, rayon]
// fillTop = niveau du liquide (bouteille pleine)
export const shapes = {
  // Bouteille de sirop 1 L, épaule ronde, bouchon à vis.
  sirop: {
    pts: [[0, 0], [34, 0.4], [39.5, 2.4], [41.6, 7], [42, 14], [42, 186], [41.4, 199], [37.5, 214], [29.5, 230], [21, 242], [16.6, 251], [15.8, 258], [15.8, 279], [17.3, 280.5], [17.3, 286.5], [15.6, 288.6], [13.2, 289]],
    label: [36, 160],
    body: 42,
    neck: 15.8,
    lip: 289,
    closure: [275, 304, 18.8],
    fillTop: 232,
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
