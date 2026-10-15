// Accès privé de la maquette (Routing Middleware Vercel : middleware.js ; en local : vite.config.js).
//
// La maquette n'est visible qu'avec le lien personnel transmis par V2X Studio :
//   https://v2x-client-<slug>.vercel.app/?acces=<jeton>
// Le jeton est dérivé du secret partagé MAQUETTES_SECRET (le même dans le projet Vercel de V2X Studio,
// dont le CRM ajoute ce jeton à chaque lien de maquette envoyé). Une visite avec le bon jeton pose un
// cookie (180 jours) : les pages suivantes, les images et l'API passent sans jeton. Sans jeton ni
// cookie, le visiteur voit une page neutre « Maquette privée », qui ne nomme pas l'entreprise.
//
// Restent publics : /robots.txt (tout interdit) et l'image d'aperçu des liens (/og-v4.jpg, pour
// l'aperçu du message qui contient le lien). /api/menage garde sa propre protection (CRON_SECRET).
// MAQUETTE_RETIREE=1 retire la maquette pour tout le monde (410). Sans MAQUETTES_SECRET, tout est
// refusé : la maquette ne s'ouvre jamais par erreur.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const SLUG = 'distillerie-a-blachere';
export const COOKIE = 'v2x_acces';
const DUREE = 180 * 24 * 3600;
const PUBLICS = new Set(['/robots.txt', '/og-v4.jpg']);
const LIBRES = [/^\/api\/menage\/?$/];

const hmac = (secret, texte) => createHmac('sha256', secret).update(texte).digest('base64url');

/** Jeton du lien d'accès (22 caractères, 132 bits) ; même calcul dans le CRM de V2X Studio. */
export const jetonAcces = (secret, slug = SLUG) => hmac(secret, `acces:${slug}`).slice(0, 22);
const valeurCookie = (secret, slug = SLUG) => `v1.${hmac(secret, `cookie:${slug}`).slice(0, 32)}`;

function egal(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

function lireCookie(entete, nom) {
  for (const morceau of String(entete || '').split(';')) {
    const i = morceau.indexOf('=');
    if (i > 0 && morceau.slice(0, i).trim() === nom) return morceau.slice(i + 1).trim();
  }
  return '';
}

const ENTETES = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'X-V2X-Maquette': 'privee',
};

const page = (titre, texte) => `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>${titre} · V2X Studio</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2315130f'/%3E%3Ctext x='16' y='21' font-family='Arial' font-size='11' font-weight='700' text-anchor='middle' fill='%23f7f5f0'%3EV2X%3C/text%3E%3C/svg%3E">
<style>
  :root { color-scheme: light dark; --fond: #f7f5f0; --encre: #15130f; --doux: #5f5a52; --filet: #ddd8ce; }
  @media (prefers-color-scheme: dark) { :root { --fond: #15130f; --encre: #f2efe8; --doux: #a8a297; --filet: #36322b; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 16px;
    background: var(--fond); color: var(--encre); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 34rem; }
  .marque { display: inline-flex; align-items: center; gap: .6rem; font-weight: 700; letter-spacing: .08em; font-size: .8rem; text-transform: uppercase; }
  .marque span { display: inline-grid; place-items: center; width: 2.2rem; height: 2.2rem; border-radius: .55rem; background: var(--encre); color: var(--fond); font-size: .7rem; }
  h1 { font-size: clamp(1.6rem, 5vw, 2.2rem); line-height: 1.15; margin: 1.6rem 0 .8rem; font-weight: 650; letter-spacing: -.01em; }
  p { margin: 0 0 1rem; color: var(--doux); }
  footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--filet); font-size: .9rem; color: var(--doux); }
  a { color: inherit; }
</style>
</head>
<body>
<main>
  <div class="marque"><span>V2X</span>V2X Studio</div>
  <h1>${titre}</h1>
  ${texte}
  <footer>V2X Studio · studio web à Cavaillon · <a href="https://v2x-studio.fr" rel="noopener">v2x-studio.fr</a></footer>
</main>
</body>
</html>
`;

const PRIVEE = page(
  'Maquette privée',
  `<p>Cette adresse héberge une maquette de site réalisée par V2X Studio, à titre de proposition. Elle n’est pas publique : seuls les destinataires du lien d’accès personnel peuvent la consulter.</p>
  <p>Vous avez reçu ce lien&nbsp;? Ouvrez-le tel quel, sans le modifier, depuis le message où il vous a été transmis.</p>`,
);
const RETIREE = page(
  'Maquette retirée',
  '<p>Cette maquette, réalisée par V2X Studio à titre de proposition, a été retirée et n’est plus consultable.</p>',
);

function refus(chemin, accept, statut, html) {
  if (chemin.startsWith('/api/')) {
    return { type: 'reponse', status: statut, headers: { ...ENTETES, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ erreur: 'Accès réservé.' }) };
  }
  if (/text\/html|\*\/\*/.test(accept || '') || !accept) {
    return {
      type: 'reponse',
      status: statut,
      headers: {
        ...ENTETES,
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      },
      body: html,
    };
  }
  return { type: 'reponse', status: statut, headers: { ...ENTETES, 'Content-Type': 'text/plain; charset=utf-8' }, body: 'Accès réservé.' };
}

/**
 * Sort d'une requête.
 * @param {{ url: string, cookie?: string, accept?: string, secret?: string, retiree?: boolean, slug?: string }} r
 * @returns {{ type: 'passer', cookie?: string } | { type: 'reponse', status: number, headers: Record<string, string>, body: string }}
 */
export function decider({ url, cookie = '', accept = '', secret = '', retiree = false, slug = SLUG }) {
  const { pathname, searchParams } = new URL(url, 'http://localhost');
  if (pathname === '/robots.txt') return { type: 'passer' };
  if (retiree) return refus(pathname, accept, 410, RETIREE);
  if (PUBLICS.has(pathname) || LIBRES.some((re) => re.test(pathname))) return { type: 'passer' };
  if (!secret) return refus(pathname, accept, 401, PRIVEE);
  const attendu = valeurCookie(secret, slug);
  if (egal(lireCookie(cookie, COOKIE), attendu)) return { type: 'passer' };
  if (egal(searchParams.get('acces'), jetonAcces(secret, slug))) {
    return { type: 'passer', cookie: `${COOKIE}=${attendu}; Path=/; Max-Age=${DUREE}; HttpOnly; Secure; SameSite=Lax` };
  }
  return refus(pathname, accept, 401, PRIVEE);
}
