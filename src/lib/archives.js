// Le musée de l'étiquette : les étiquettes anciennes du mur du magasin, redessinées en SVG pour la
// maquette (d'après les photos de référence), les objets de la marque, les collectors et l'aile
// des spiritueux (réservée aux majeurs). Ce sont des évocations, pas des reproductions : les scans
// haute définition, les dates et les crédits sont à demander à la distillerie.
// Modèle de données (étude d'identité) : titre, aile et gamme, période et certitude, technique et
// support, auteur et crédit, statut, récit, image et source. Jamais de date inventée.
import { femmeSVG } from './femme.js';

const W = 300;
const H = 360;
let n = 0;
const uid = (p) => `${p}${++n}`;

const stripes = (id, bg, gap = 26, w = 2.4, color = 'rgba(255,255,255,.88)') =>
  `<pattern id="${id}" width="${gap * 3}" height="${gap}" patternUnits="userSpaceOnUse" patternTransform="rotate(-10)"><rect width="${gap * 3}" height="${gap}" fill="${bg}"/><rect y="${gap - w}" width="${gap * 3}" height="${w}" fill="${color}"/></pattern>`;

const pacScript = (x, y, size, fill = '#ebd540', extra = '') =>
  `<text x="${x}" y="${y}" font-family="Lobster Two, cursive" font-style="italic" font-weight="700" font-size="${size}" fill="${fill}" stroke="#17170f" stroke-width="${size * 0.2}" paint-order="stroke" stroke-linejoin="round" ${extra}>pac</text>
   <text x="${x}" y="${y}" font-family="Lobster Two, cursive" font-style="italic" font-weight="700" font-size="${size}" fill="${fill}" stroke="#fff" stroke-width="${size * 0.13}" paint-order="stroke" stroke-linejoin="round" ${extra}>pac</text>
   <text x="${x}" y="${y}" font-family="Lobster Two, cursive" font-style="italic" font-weight="700" font-size="${size}" fill="${fill}" ${extra}>pac</text>`;

// Étiquette « femme à la paille » (classique et ses déclinaisons).
function femmeLabel({ bg, word, wordColor = '#d8962e', ovalFill = '#ebd540', title }) {
  const id = uid('st');
  const femme = femmeSVG({ palette: {} })
    .replace('<svg ', `<svg x="-34" y="0" width="${H * 0.4}" height="${H}" preserveAspectRatio="xMinYMin meet" `)
    .replace(/class="[^"]*" /, '');
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title}">
    <defs>${stripes(id, bg)}</defs>
    <rect width="${W}" height="${H}" fill="url(#${id})"/>
    <text x="70" y="36" font-family="Archivo, sans-serif" font-weight="700" font-stretch="75%" font-size="11.5" fill="#fff" transform="rotate(-6 150 30)">CONSERVER ET CONSOMMER FRAIS</text>
    ${pacScript(118, 178, 118, '#ebd540', 'transform="rotate(-4 200 150)"')}
    <line x1="34" y1="${H * 0.912}" x2="116" y2="${H * 0.79}" stroke="#17170f" stroke-width="8" stroke-linecap="round"/>
    <line x1="34" y1="${H * 0.912}" x2="116" y2="${H * 0.79}" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    ${femme}
    <g transform="rotate(-5 205 278)">
      <ellipse cx="205" cy="278" rx="88" ry="54" fill="${ovalFill}" stroke="#17170f" stroke-width="2.5"/>
      <text x="205" y="258" text-anchor="middle" font-family="Della Respira, serif" font-size="17" fill="#17170f">SIROP</text>
      <text x="205" y="290" text-anchor="middle" font-family="Cinzel, serif" font-weight="900" font-size="${word.length > 6 ? 26 : 32}" fill="${wordColor}" stroke="#6e3f12" stroke-width="1.6" paint-order="stroke">${word}</text>
      <text x="205" y="312" text-anchor="middle" font-family="Della Respira, serif" font-size="13" fill="#17170f">SANS COLORANT</text>
    </g>
  </svg>`;
}

const LABELS = [
  {
    id: 'pac-art-deco',
    titre: '« P.A.C. » Art déco',
    recit: 'Brun-bordeaux et rouge, volutes et éventails Art déco, bandeau blanc « P.A.C. ». Sans doute l’une des plus anciennes du mur.',
    svg: () => {
      const fan = (cx, cy, r) =>
        [0.92, 0.74, 0.56, 0.38].map((k, i) => `<circle cx="${cx}" cy="${cy}" r="${r * k}" fill="none" stroke="${i % 2 ? '#c9a24a' : '#c0392b'}" stroke-width="${r * 0.08}"/>`).join('');
      return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Étiquette P.A.C. Art déco">
        <rect width="${W}" height="${H}" fill="#6b2418"/>
        <clipPath id="ad1"><rect width="${W}" height="${H}"/></clipPath>
        <g clip-path="url(#ad1)">${fan(0, 0, 90)}${fan(W, 0, 90)}${fan(0, H, 90)}${fan(W, H, 90)}${fan(150, H + 20, 110)}</g>
        <rect x="18" y="104" width="264" height="150" fill="#b8352b"/>
        <rect x="18" y="128" width="264" height="58" fill="#f4ede0"/>
        <text x="150" y="173" text-anchor="middle" font-family="Cinzel, serif" font-weight="900" font-size="44" letter-spacing="6" fill="#17170f">P.A.C.</text>
        <rect x="70" y="204" width="160" height="4" fill="#f4ede0" opacity=".6"/><rect x="90" y="216" width="120" height="4" fill="#f4ede0" opacity=".6"/><rect x="80" y="228" width="140" height="4" fill="#f4ede0" opacity=".6"/>
      </svg>`;
    },
  },
  {
    id: 'pac-chapeau',
    titre: '« PAC citron », la femme au chapeau',
    recit: 'Fond noir cerné de rouge, portrait glamour dans un disque jaune, « PAC » en capitales jaunes ombrées.',
    svg: () => `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Étiquette PAC citron à la femme au chapeau">
      <rect width="${W}" height="${H}" fill="#c0392b"/><rect x="10" y="10" width="${W - 20}" height="${H - 20}" fill="#17170f"/>
      <circle cx="150" cy="104" r="72" fill="#ebd540"/>
      <path d="M118 150c-6-30 4-60 30-68 26-6 44 14 42 40-1 12-8 20-6 30 2 8-6 12-14 10-10 6-30 6-52-12z" fill="#17170f"/>
      <path d="M86 92c30-30 100-36 132-6-10 4-22 2-30 0-26-8-60-6-102 6z" fill="#17170f"/>
      <path d="M140 116c6-6 16-6 22 0" stroke="#ebd540" stroke-width="3" fill="none"/>
      <rect x="10" y="190" width="${W - 20}" height="150" fill="#f4ede0"/>
      <text x="153" y="266" text-anchor="middle" font-family="Spicy Rice, serif" font-size="70" fill="#17170f">PAC</text>
      <text x="150" y="262" text-anchor="middle" font-family="Spicy Rice, serif" font-size="70" fill="#ebd540" stroke="#17170f" stroke-width="2" paint-order="stroke">PAC</text>
      <text x="150" y="312" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="800" font-size="36" fill="#9aa51c">citron</text>
    </svg>`,
  },
  {
    id: 'pac-danseuses',
    titre: '« P.A.C. » aux danseuses',
    recit: 'Fond jaune, deux femmes en longues robes noires dansent autour d’un mât à rubans, sous des rayons rouge-orange. La scène évoque la danse provençale des cordelles (à confirmer).',
    svg: () => {
      const rays = Array.from({ length: 9 }, (_, i) => {
        const a = Math.PI * (0.1 + (i / 8) * 0.8);
        return `<path d="M150 58 L${150 + Math.cos(a) * 260} ${58 + Math.sin(a) * 170} L${150 + Math.cos(a + 0.07) * 260} ${58 + Math.sin(a + 0.07) * 170}Z" fill="${i % 2 ? '#e07b3c' : '#c0392b'}" opacity=".85"/>`;
      }).join('');
      const dancer = (x, flip) => `<g transform="translate(${x} 0) scale(${flip} 1)">
        <circle cx="0" cy="196" r="10" fill="#17170f"/><path d="M-6 206 L6 206 L10 236 L34 304 L-34 304 L-10 236Z" fill="#17170f"/>
        <path d="M-4 214 L-38 190" stroke="#17170f" stroke-width="5" stroke-linecap="round"/><path d="M4 214 L22 196" stroke="#17170f" stroke-width="5" stroke-linecap="round"/></g>`;
      return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Étiquette P.A.C. aux danseuses">
        <rect width="${W}" height="${H}" fill="#e9cf4f"/>${rays}
        <rect x="146" y="58" width="8" height="260" fill="#fff"/>${Array.from({ length: 13 }, (_, i) => `<rect x="146" y="${62 + i * 20}" width="8" height="9" fill="#c0392b"/>`).join('')}
        <circle cx="150" cy="58" r="10" fill="#c0392b"/>
        ${dancer(102, 1)}${dancer(198, -1)}
        <path d="M150 64 Q 110 120 68 190 M150 64 Q 190 120 232 190" stroke="#c0392b" stroke-width="2.5" fill="none"/>
        <text x="150" y="40" text-anchor="middle" font-family="Cinzel, serif" font-weight="900" font-size="34" letter-spacing="4" fill="#17170f">P.A.C.</text>
        <rect x="0" y="322" width="${W}" height="38" fill="#c0392b"/>
      </svg>`;
    },
  },
  {
    id: 'pac-roue',
    titre: '« pac CITRON » psychédélique',
    recit: 'Fond blanc, lettrage ondulant de la fin des années 1960, grosse tranche de citron en roue, éclaboussures orange et bande turquoise.',
    svg: () => {
      const seg = Array.from({ length: 10 }, (_, i) => {
        const a0 = (i / 10) * Math.PI * 2 + 0.04;
        const a1 = ((i + 1) / 10) * Math.PI * 2 - 0.04;
        const r = 74;
        return `<path d="M150 196 L${150 + Math.cos(a0) * r} ${196 + Math.sin(a0) * r} A${r} ${r} 0 0 1 ${150 + Math.cos(a1) * r} ${196 + Math.sin(a1) * r}Z" fill="#f6e070"/>`;
      }).join('');
      return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Étiquette pac citron psychédélique">
        <rect width="${W}" height="${H}" fill="#f6f1e2"/>
        <rect x="0" y="120" width="${W}" height="80" fill="#5fb8a2"/>
        ${[30, 70, 230, 262, 48, 250].map((x, i) => `<circle cx="${x}" cy="${[150, 240, 140, 230, 280, 118][i]}" r="${[14, 9, 12, 16, 8, 7][i]}" fill="#e07b3c"/>`).join('')}
        <circle cx="150" cy="196" r="86" fill="#e9c93c"/><circle cx="150" cy="196" r="80" fill="#fffbe6"/>${seg}
        <text x="150" y="96" text-anchor="middle" font-family="Lobster Two, cursive" font-style="italic" font-weight="700" font-size="92" fill="#f2d22e" stroke="#7d7a2a" stroke-width="5" paint-order="stroke" transform="rotate(-6 150 70)">pac</text>
        <text x="150" y="330" text-anchor="middle" font-family="Cinzel, serif" font-weight="900" font-size="38" fill="#17170f">CITRON</text>
      </svg>`;
    },
  },
  {
    id: 'pac-profil',
    titre: '« pac CITRON » violet, la femme de profil',
    recit: 'La femme est de profil, tournée vers la gauche, sa paille plongée dans une pastille ronde « CITRON ». Sans doute l’une des premières apparitions de la femme à la paille.',
    svg: () => {
      const id = uid('st');
      const femme = femmeSVG({})
        .replace('<svg ', `<svg x="${W - 150}" y="0" width="150" height="${H}" preserveAspectRatio="xMaxYMin meet" `)
        .replace(/class="[^"]*" /, '');
      return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Étiquette pac citron violette, femme de profil">
        <defs>${stripes(id, '#8e2a8a', 30, 1.6, 'rgba(255,255,255,.35)')}</defs>
        <rect width="${W}" height="${H}" fill="url(#${id})"/>
        <g transform="translate(${W} 0) scale(-1 1)">${femme}</g>
        <line x1="128" y1="${H * 0.9}" x2="70" y2="262" stroke="#17170f" stroke-width="8" stroke-linecap="round"/><line x1="128" y1="${H * 0.9}" x2="70" y2="262" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
        <circle cx="66" cy="252" r="46" fill="#ebd540" stroke="#17170f" stroke-width="2.5"/>
        <text x="66" y="262" text-anchor="middle" font-family="Cinzel, serif" font-weight="900" font-size="22" fill="#d8962e" stroke="#6e3f12" stroke-width="1" paint-order="stroke">CITRON</text>
        <text x="96" y="120" text-anchor="middle" font-family="Lobster Two, cursive" font-style="italic" font-weight="700" font-size="96" fill="#f0b631" stroke="#fff" stroke-width="7" paint-order="stroke" transform="rotate(-8 96 90)">pac</text>
      </svg>`;
    },
  },
  {
    id: 'pac-bulle',
    titre: '« pac » en lettres bulles',
    recit: 'Lettres bulles très grasses, jaunes à contours concentriques orange et brun, sur fond violet, avec un losange « CITRON » et une paille.',
    svg: () => `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Étiquette pac en lettres bulles">
      <rect width="${W}" height="${H}" fill="#7d2a86"/>
      ${[['#6b2418', 30], ['#e07b3c', 20], ['#f6e070', 8]].map(([c, w]) => `<text x="150" y="168" text-anchor="middle" font-family="Spicy Rice, serif" font-size="108" fill="#f2d22e" stroke="${c}" stroke-width="${w}" stroke-linejoin="round" paint-order="stroke">pac</text>`).join('')}
      <path d="M150 210 L232 262 L150 314 L68 262Z" fill="#ebd540" stroke="#17170f" stroke-width="2.5"/>
      <text x="150" y="272" text-anchor="middle" font-family="Cinzel, serif" font-weight="900" font-size="26" fill="#6b2418">CITRON</text>
      <line x1="226" y1="300" x2="290" y2="190" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'pac-classique',
    titre: '« pac CITRON », la femme à la paille',
    recit: 'La version classique : fond magenta à fines rayures, femme coupée par le bord gauche, paille jusqu’à l’ovale « SIROP CITRON SANS COLORANT ».',
    svg: () => femmeLabel({ bg: '#a82ba2', word: 'CITRON', title: 'Étiquette pac citron classique, femme à la paille' }),
  },
  {
    id: 'pac-orange',
    titre: '« pac ORANGE »',
    recit: 'Le même dessin sur fond orange, avec un ovale « ORANGE ». Étiquette ancienne : le PAC Orange n’est pas dans la boutique actuelle.',
    svg: () => femmeLabel({ bg: '#e07b3c', word: 'ORANGE', wordColor: '#e07b3c', ovalFill: '#f6f1e2', title: 'Étiquette pac orange, fond orange' }),
  },
  {
    id: 'pac-orange-turquoise',
    titre: '« pac ORANGE », version turquoise',
    recit: 'Variante sur fond turquoise menthe.',
    svg: () => femmeLabel({ bg: '#5fb8a2', word: 'ORANGE', wordColor: '#e07b3c', ovalFill: '#f6f1e2', title: 'Étiquette pac orange, fond turquoise' }),
  },
  {
    id: 'pac-orange-petrole',
    titre: '« pac ORANGE », version bleu pétrole',
    recit: 'Variante sur fond bleu pétrole.',
    svg: () => femmeLabel({ bg: '#1f7ea0', word: 'ORANGE', wordColor: '#e07b3c', ovalFill: '#f6f1e2', title: 'Étiquette pac orange, fond bleu pétrole' }),
  },
  {
    id: 'aurelie',
    titre: '« AURELIE » menthe bleue',
    recit: 'Dégradé bleu nuit, « AURELIE » en capitales blanches en arc : la menthe bleue que Fun Blue a remplacée en 1995.',
    svg: () => `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Étiquette Aurélie menthe bleue">
      <defs><linearGradient id="au1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a6fc0"/><stop offset="1" stop-color="#1d459b"/></linearGradient><path id="au2" d="M40 170 Q150 90 260 170"/></defs>
      <rect width="${W}" height="${H}" fill="url(#au1)"/><rect x="12" y="12" width="${W - 24}" height="${H - 24}" fill="none" stroke="#fff" stroke-width="1.5" opacity=".7"/>
      <text font-family="Cinzel, serif" font-weight="900" font-size="34" letter-spacing="4" fill="#fff"><textPath href="#au2" startOffset="50%" text-anchor="middle">AURELIE</textPath></text>
      <text x="150" y="230" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="800" font-stretch="80%" font-size="24" letter-spacing="2" fill="#fff">MENTHE BLEUE</text>
      <rect x="110" y="250" width="80" height="2" fill="#fff" opacity=".7"/>
    </svg>`,
  },
  {
    id: 'menthe-palmiers',
    titre: '« Sirop MENTHE BLEUE » aux palmiers',
    recit: 'Palmiers en contre-jour, coucher de soleil orange, mer bleue et voiliers, « Sirop » en script rouge-orangé.',
    svg: () => `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Étiquette sirop menthe bleue aux palmiers">
      <defs><linearGradient id="mp1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0a050"/><stop offset=".6" stop-color="#f6d77a"/><stop offset="1" stop-color="#f0a050"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#mp1)"/><circle cx="196" cy="168" r="34" fill="#fff3c4"/>
      <rect y="196" width="${W}" height="84" fill="#357691"/><path d="M60 236 l18 -42 l4 42z M200 226 l14 -30 l3 30z" fill="#f4f8fc"/>
      <path d="M40 200 q14 -70 0 -150" stroke="#3b2a1e" stroke-width="7" fill="none"/>
      ${[0, 1, 2, 3, 4, 5].map((k) => `<path d="M40 50 q${-60 + k * 24} ${-20 + Math.abs(k - 2.5) * 10} ${-90 + k * 36} ${18 + Math.abs(k - 2.5) * 6}" stroke="#2e6f2c" stroke-width="10" fill="none" stroke-linecap="round"/>`).join('')}
      <text x="150" y="104" text-anchor="middle" font-family="Lobster Two, cursive" font-style="italic" font-weight="700" font-size="58" fill="#c0392b" stroke="#fff" stroke-width="4" paint-order="stroke">Sirop</text>
      <rect y="292" width="${W}" height="46" fill="#fff"/>
      <text x="150" y="324" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="800" font-size="25" fill="#1d459b">MENTHE BLEUE</text>
    </svg>`,
  },
  {
    id: 'fun-blue-ancien',
    titre: 'Fun Blue, l’île et les planches à voile',
    recit: '« Fun Blue » en script blanc à paraphes, île à palmiers sur l’horizon, deux planches à voile dans les vagues.',
    svg: () => `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Étiquette Fun Blue ancienne">
      <defs><linearGradient id="fb1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d459b"/><stop offset=".55" stop-color="#2f64a8"/><stop offset="1" stop-color="#6e9bd0"/></linearGradient></defs>
      <rect width="${W}" height="220" fill="url(#fb1)"/><rect y="220" width="${W}" height="140" fill="#357691"/>
      <ellipse cx="150" cy="222" rx="70" ry="10" fill="#e8c877"/><path d="M90 222 A60 40 0 0 1 210 222Z" fill="#3f8a3c"/>
      <path d="M130 196 q4 -24 12 -40" stroke="#5b3a1e" stroke-width="3" fill="none"/>${[0, 1, 2, 3].map((k) => `<path d="M142 156 q${-24 + k * 16} -8 ${-30 + k * 20} 8" stroke="#2f7a35" stroke-width="5" fill="none" stroke-linecap="round"/>`).join('')}
      ${[[62, 300, 1], [236, 290, -1]].map(([x, y, f]) => `<g transform="translate(${x} ${y}) scale(${f} 1)"><ellipse cx="0" cy="0" rx="26" ry="4" fill="#f4f8fc"/><path d="M-2 -3 L6 -86 Q26 -44 22 -4Z" fill="#f4f8fc"/>${[0, 1, 2, 3].map((k) => `<rect x="-6" y="${-80 + k * 18}" width="34" height="6" fill="#1d459b"/>`).join('')}</g>`).join('')}
      <text x="140" y="78" text-anchor="middle" font-family="Molle, cursive" font-style="italic" font-size="58" fill="#9db9e8">Fun</text><text x="137" y="75" text-anchor="middle" font-family="Molle, cursive" font-style="italic" font-size="58" fill="#fff">Fun</text>
      <text x="170" y="136" text-anchor="middle" font-family="Molle, cursive" font-style="italic" font-size="58" fill="#9db9e8">Blue</text><text x="167" y="133" text-anchor="middle" font-family="Molle, cursive" font-style="italic" font-size="58" fill="#fff">Blue</text>
      ${[0, 1, 2, 3, 4, 5, 6].map((k) => `<path d="M${10 + k * 44} ${246 + (k % 3) * 30} q12 -6 24 0" stroke="#f4f8fc" stroke-width="3" fill="none" opacity=".8"/>`).join('')}
    </svg>`,
  },
];

// ---------- Fiches du musée (modèle de données de l'étude d'identité) ----------
const MUR = 'Mur d’étiquettes du magasin (photo de référence, maquette seulement) ; scan à plat à demander à la distillerie.';
const META = {
  'pac-art-deco': { gamme: 'PAC', periode: 'Datation à confirmer', certitude: 'Style Art déco', frise: 'À dater' },
  'pac-chapeau': { gamme: 'PAC', periode: 'Années 1960, datation par le style, à confirmer', frise: 'Années 1960 ?' },
  'pac-danseuses': { gamme: 'PAC', periode: 'Datation à confirmer', frise: 'À dater' },
  'pac-roue': { gamme: 'PAC', periode: 'Fin des années 1960, datation par le style, à confirmer', frise: 'Années 1960 ?' },
  'pac-profil': { gamme: 'PAC', periode: 'Datation à confirmer', frise: 'À dater' },
  'pac-bulle': { gamme: 'PAC', periode: 'Datation à confirmer', frise: 'À dater' },
  'pac-classique': { gamme: 'PAC', periode: 'Étiquette actuelle', statut: 'Produit actuel', frise: 'Aujourd’hui' },
  'pac-orange': { gamme: 'PAC', periode: 'Datation à confirmer', frise: 'À dater' },
  'pac-orange-turquoise': { gamme: 'PAC', periode: 'Datation à confirmer', frise: 'À dater' },
  'pac-orange-petrole': { gamme: 'PAC', periode: 'Datation à confirmer', frise: 'À dater' },
  aurelie: { gamme: 'Menthe bleue et Fun Blue', periode: 'Entre les années 1960 et 1995 : la menthe « Aurélie » est remplacée par Fun Blue en 1995', frise: '1960 – 1995' },
  'menthe-palmiers': { gamme: 'Menthe bleue et Fun Blue', periode: 'Datation à confirmer', frise: 'À dater' },
  'fun-blue-ancien': { gamme: 'Menthe bleue et Fun Blue', periode: 'Après 1995 (Fun Blue est créé en 1995) ; étiquette ancienne, pas l’emballage actuel', frise: 'Depuis 1995' },
};
const DEFAUT = { aile: 'sirops', technique: 'Étiquette imprimée', auteur: 'Auteur inconnu', statut: 'Archive', source: MUR, certitude: null };

// ---------- Objets de la marque ----------
const OBJETS = [
  {
    id: 'capsule',
    titre: 'La capsule « pac … le vrai »',
    gamme: 'Objets',
    periode: 'Datation à confirmer',
    frise: 'Aujourd’hui',
    technique: 'Capsule métallique du PAC en verre',
    statut: 'Objet',
    recit: 'Sur le litre de PAC en verre, la capsule jaune signe « pac … le vrai ». Le statut de la formule (slogan déposé ou non) est à confirmer.',
    source: 'Photo de référence ; macro à faire.',
    svg: () => `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Capsule pac le vrai">
      <defs><radialGradient id="cap1" cx=".38" cy=".32" r=".7"><stop offset="0" stop-color="#fff38a"/><stop offset=".55" stop-color="#ebd540"/><stop offset="1" stop-color="#b9a21c"/></radialGradient></defs>
      <rect width="${W}" height="${H}" fill="#2a2320"/>
      ${Array.from({ length: 21 }, (_, k) => {
        const a = (k / 21) * Math.PI * 2;
        return `<circle cx="${150 + Math.cos(a) * 104}" cy="${180 + Math.sin(a) * 104}" r="9" fill="#c9b31f"/>`;
      }).join('')}
      <circle cx="150" cy="180" r="104" fill="url(#cap1)"/>
      <circle cx="150" cy="180" r="90" fill="none" stroke="#9a8616" stroke-width="2" opacity=".6"/>
      <text x="138" y="190" text-anchor="middle" font-family="Lobster Two, cursive" font-style="italic" font-weight="700" font-size="76" fill="#c2167f">pac</text>
      <text x="196" y="228" text-anchor="middle" font-family="Lobster Two, cursive" font-style="italic" font-weight="700" font-size="24" fill="#c2167f">le vrai</text>
    </svg>`,
  },
  {
    id: 'gobelets',
    titre: 'Les gobelets « Summer PAC »',
    gamme: 'Objets',
    periode: 'Datation à confirmer',
    frise: 'Aujourd’hui',
    technique: 'Gobelets imprimés',
    statut: 'Objet',
    recit: 'Au comptoir de dégustation, le PAC à l’eau se sert dans des gobelets imprimés « SUMMER pac ».',
    source: 'Photo de référence (presse) ; photo à faire.',
    svg: () => {
      const cup = (x, r) => `<g transform="translate(${x} 0) rotate(${r} 0 250)">
        <path d="M-52 120 L52 120 L40 300 L-40 300Z" fill="#fff" stroke="#17170f" stroke-width="2.5"/>
        <rect x="-49" y="150" width="98" height="10" fill="#c2167f"/>
        <text x="0" y="200" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="800" font-stretch="75%" font-size="22" letter-spacing="2" fill="#17170f">SUMMER</text>
        <text x="0" y="250" text-anchor="middle" font-family="Lobster Two, cursive" font-style="italic" font-weight="700" font-size="46" fill="#ebd540" stroke="#17170f" stroke-width="2" paint-order="stroke">pac</text>
      </g>`;
      return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Gobelets Summer pac">
        <rect width="${W}" height="${H}" fill="#eee8b9"/>${cup(96, -6)}${cup(204, 5)}
      </svg>`;
    },
  },
  {
    id: 'tshirt',
    titre: 'Le T-shirt « Le seul, l’unique »',
    gamme: 'Objets',
    periode: 'Datation à confirmer',
    frise: 'Aujourd’hui',
    technique: 'T-shirt imprimé',
    statut: 'Objet',
    recit: 'Des cases arrondies en aplats vert, cyan, orange, magenta et jaune sur fond noir, et la formule « Le seul, l’unique », dont le statut de slogan est à confirmer. Vendu ou non : à confirmer.',
    source: 'Photo de référence ; T-shirt à plat à photographier.',
    svg: () => {
      const cols = ['#02b359', '#ce3ca2', '#e38e46', '#01a7d8', '#dde034', '#02b359'];
      return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="T-shirt Le seul, l'unique">
        <rect width="${W}" height="${H}" fill="#f6f1e7"/>
        <path d="M96 40 L130 28 Q150 46 170 28 L204 40 L262 84 L238 124 L214 110 L214 330 L86 330 L86 110 L62 124 L38 84Z" fill="#212428"/>
        ${cols.map((c, k) => `<rect x="${104 + (k % 3) * 32}" y="${150 + Math.floor(k / 3) * 34}" width="28" height="28" rx="7" fill="${c}"/>`).join('')}
        <text x="150" y="128" text-anchor="middle" font-family="Spicy Rice, serif" font-size="16" fill="#fff">LE SEUL, L’UNIQUE</text>
        <text x="150" y="262" text-anchor="middle" font-family="Spicy Rice, serif" font-size="34" fill="#dde034">PAC</text>
      </svg>`;
    },
  },
];

// ---------- Collectors (œuvres non reproduites : cadres neutres) ----------
const COLLECTORS = [
  ...[1, 2, 3].map((n) => ({
    id: `collector-c215-${n}`,
    titre: `Étiquette collector des 60 ans n° ${n}`,
    gamme: 'Collectors',
    periode: '2023',
    frise: '2023',
    technique: 'Étiquette imprimée d’après l’œuvre de l’artiste',
    auteur: 'C215 (Christian Guémy), graffeur et pochoiriste',
    statut: 'Édition limitée',
    recit: 'L’une des trois étiquettes signées par C215 pour les 60 ans du « Pac à l’eau », glissées au hasard dans la production.',
    source: 'Visuel à fournir par la distillerie, avec l’accord de l’artiste.',
    placeholder: 'Visuel à fournir par la distillerie',
    k: ['#00a0cc', '#b76088', '#d6ec5b'][n - 1],
  })),
  {
    id: 'collector-viallat',
    titre: 'Étiquette collector des 60 ans n° 4',
    gamme: 'Collectors',
    periode: '2023',
    frise: '2023',
    technique: 'Étiquette imprimée d’après l’œuvre de l’artiste',
    auteur: 'Claude Viallat, peintre',
    statut: 'Édition limitée',
    recit: 'L’étiquette signée par Claude Viallat pour les 60 ans du « Pac à l’eau ».',
    source: 'Visuel à fournir par la distillerie, avec l’accord de l’artiste.',
    placeholder: 'Visuel à fournir par la distillerie',
    k: '#d32e2c',
  },
  {
    id: 'collectors-50-ans',
    titre: 'Les six bouteilles des 50 ans',
    gamme: 'Collectors',
    periode: '2012',
    frise: '2012',
    technique: 'Bouteilles collector',
    statut: 'Édition limitée',
    recit: 'Pour les 50 ans du PAC, six bouteilles collector reprennent les étiquettes de 1962 à 1980.',
    source: 'Fichiers et photos à fournir par la distillerie.',
    placeholder: 'Photos à fournir par la distillerie',
    k: '#a82ba2',
  },
];

// ---------- Aile des spiritueux (réservée aux personnes majeures) ----------
// Évocation dessinée de l'affiche peinte du comptoir : pas une reproduction, auteur et date inconnus.
function origanPoster() {
  const w = 300;
  const h = 420;
  const merlons = (x0, x1, y, step = 12) =>
    Array.from({ length: Math.floor((x1 - x0) / step) }, (_, k) => `<rect x="${x0 + k * step}" y="${y - 8}" width="${step * 0.55}" height="8"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Évocation de l'affiche de l'Origan du Comtat">
    <defs>
      <linearGradient id="og-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fc3c9"/><stop offset="1" stop-color="#6faeb6"/></linearGradient>
      <linearGradient id="og-gold" x1="0" x2="1"><stop offset="0" stop-color="#8a6a22"/><stop offset=".35" stop-color="#e6c66e"/><stop offset=".6" stop-color="#c9a24a"/><stop offset="1" stop-color="#7a5a1c"/></linearGradient>
      <path id="og-arc" d="M58 70 Q150 18 242 70"/>
    </defs>
    <rect width="${w}" height="${h}" fill="#eadfc2"/>
    <rect x="34" y="34" width="${w - 50}" height="${h - 84}" fill="url(#og-sky)"/>
    <g fill="#405e77">
      <rect x="40" y="246" width="250" height="60"/>${merlons(40, 290, 246)}
      <rect x="64" y="186" width="34" height="70"/>${merlons(64, 98, 186, 9)}
      <rect x="110" y="168" width="26" height="90"/>${merlons(110, 136, 168, 9)}
      <rect x="214" y="200" width="40" height="56"/>${merlons(214, 254, 200, 9)}
    </g>
    <g fill="#4f63a0" opacity=".8"><rect x="34" y="282" width="${w - 50}" height="68"/></g>
    <path d="M34 300 q60 -16 120 0 t130 0" fill="none" stroke="#eadfc2" stroke-width="2" opacity=".5"/>
    <g transform="translate(150 0)">
      <rect x="-9" y="96" width="18" height="70" rx="3" fill="url(#og-gold)"/>
      <rect x="-12" y="100" width="24" height="7" fill="#7a5a1c"/><rect x="-12" y="128" width="24" height="5" fill="#7a5a1c"/>
      <path d="M-9 166 C-9 190 -40 196 -40 228 L-40 336 Q-40 346 -30 346 L30 346 Q40 346 40 336 L40 228 C40 196 9 190 9 166Z" fill="url(#og-gold)" stroke="#5a4214" stroke-width="1.5"/>
      <rect x="-30" y="250" width="60" height="58" rx="3" fill="#eadfc2" stroke="#3b2a1e" stroke-width="1.2"/>
      <text x="0" y="276" text-anchor="middle" font-family="Federant, serif" font-size="13" fill="#3b2a1e">ORIGAN</text>
      <text x="0" y="294" text-anchor="middle" font-family="Federant, serif" font-size="9" fill="#3b2a1e">DU COMTAT</text>
    </g>
    <g transform="translate(232 0)">
      <path d="M-6 150 Q-30 120 -16 70" stroke="#eadfc2" stroke-width="9" stroke-linecap="round" fill="none"/>
      <circle cx="-15" cy="66" r="6" fill="#eadfc2"/>
      <ellipse cx="0" cy="146" rx="13" ry="15" fill="#e8c9a8"/>
      <path d="M-15 140 Q0 120 15 140 Q12 132 0 130 Q-12 132 -15 140Z" fill="#fff"/>
      <path d="M-14 160 L14 160 L26 212 L-26 212Z" fill="#9e1b32"/>
      <path d="M-22 170 Q0 190 22 170 L18 186 Q0 200 -18 186Z" fill="#eadfc2"/>
      <path d="M-26 212 L26 212 L40 340 L-40 340Z" fill="#577c50"/>
      <path d="M-30 260 L30 260" stroke="#eadfc2" stroke-width="3" opacity=".6"/>
    </g>
    <text font-family="Federant, serif" font-size="26" letter-spacing="3" fill="#3b2a1e"><textPath href="#og-arc" startOffset="50%" text-anchor="middle">DU COMTAT</textPath></text>
    ${'ORIGAN'.split('').map((l, k) => `<text x="18" y="${92 + k * 40}" text-anchor="middle" font-family="Federant, serif" font-size="30" fill="#3b2a1e">${l}</text>`).join('')}
    <text x="${w / 2 + 8}" y="${h - 22}" text-anchor="middle" font-family="Federant, serif" font-size="30" letter-spacing="8" fill="#3b2a1e">LIQUEUR</text>
    <path d="M34 34 q-18 30 -2 60 M${w - 16} ${h - 50} q16 -30 -2 -60" stroke="#3b2a1e" stroke-width="1.5" fill="none"/>
  </svg>`;
}

const SPIRITUEUX = [
  {
    id: 'affiche-origan',
    aile: 'spiritueux',
    titre: 'L’affiche de l’Origan du Comtat',
    gamme: 'Affiches',
    periode: 'Datation à confirmer',
    frise: 'À dater',
    technique: 'Panneau peint (évocation dessinée pour la maquette)',
    auteur: 'Auteur inconnu',
    statut: 'Décor du magasin',
    recit: 'D’après une photo de presse, derrière le comptoir de dégustation : « ORIGAN » à la verticale, « COMTAT » en arc, « LIQUEUR » ; un ciel turquoise, la silhouette d’Avignon, une bouteille dorée à long col bagué et une femme en costume provençal. L’Origan du Comtat n’est pas en vente sur le site : sa disponibilité est à confirmer.',
    source: 'Photo de référence (presse) ; photo haute définition à faire, auteur et droits à identifier.',
    svg: origanPoster,
  },
  {
    id: 'lou-gardian-serigraphie',
    aile: 'spiritueux',
    titre: 'La bouteille sérigraphiée de Lou Gardian',
    gamme: 'Étiquettes de spiritueux',
    periode: 'Marques camarguaises déposées à partir du milieu des années 1970',
    frise: 'Années 1970',
    technique: 'Bouteille sérigraphiée',
    statut: 'Produit actuel',
    recit: 'La bouteille de Lou Gardian est sérigraphiée de motifs de la culture camarguaise.',
    source: 'Photo macro à faire.',
    placeholder: 'Photo à fournir par la distillerie',
    k: '#2f6585',
  },
  {
    id: 'etiquettes-spiritueux',
    aile: 'spiritueux',
    titre: 'Les étiquettes des spiritueux',
    gamme: 'Étiquettes de spiritueux',
    periode: 'Datation à confirmer',
    frise: 'À dater',
    technique: 'Étiquettes imprimées',
    statut: 'À scanner',
    recit: 'Pastis Marra, Le Camarguais, La Camarguaise, Réserve des Légats, Verveine Auguste vieilli, Flirt : aucune de leurs étiquettes n’a encore été vue. Elles rejoindront cette aile après numérisation.',
    source: 'Scans à plat à fournir par la distillerie.',
    placeholder: 'Scans à fournir par la distillerie',
    k: '#5e1a2b',
  },
];

export const archives = [...LABELS.map((a) => ({ ...DEFAUT, ...a, ...META[a.id] })), ...OBJETS.map((a) => ({ ...DEFAUT, ...a })), ...COLLECTORS.map((a) => ({ ...DEFAUT, ...a })), ...SPIRITUEUX.map((a) => ({ ...DEFAUT, ...a }))];

// Vignette d'une pièce : dessin, ou cadre neutre « visuel à fournir ».
export function pieceSVG(a) {
  if (a.svg) return a.svg();
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${a.titre} : ${a.placeholder}">
    <rect width="${W}" height="${H}" fill="${a.k || '#cfc4a8'}"/>
    <rect x="22" y="22" width="${W - 44}" height="${H - 44}" fill="#f6f1e7" opacity=".92"/>
    <rect x="22" y="22" width="${W - 44}" height="${H - 44}" fill="none" stroke="#1d150c" stroke-width="2" stroke-dasharray="8 6" opacity=".55"/>
    <text x="150" y="172" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="700" font-size="15" letter-spacing="1.5" fill="#1d150c">${(a.placeholder || 'Visuel à fournir').toUpperCase().replace(/ PAR /, '</text><text x="150" y="196" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="700" font-size="15" letter-spacing="1.5" fill="#1d150c">PAR ')}</text>
  </svg>`;
}
