// Accès privé de la maquette, avant toute page, image ou appel d'API (Routing Middleware Vercel).
// La décision est dans server/portail.js (testée par test/portail.test.js, rejouée en local par
// vite.config.js quand MAQUETTES_SECRET est défini).
import { next } from '@vercel/functions/middleware';
import { decider } from './server/portail.js';

export const config = { runtime: 'nodejs' };

export default function middleware(request) {
  let d;
  try {
    d = decider({
      url: request.url,
      cookie: request.headers.get('cookie') || '',
      accept: request.headers.get('accept') || '',
      secret: process.env.MAQUETTES_SECRET || '',
      retiree: process.env.MAQUETTE_RETIREE === '1',
    });
  } catch (e) {
    // en cas d'imprévu, la maquette reste fermée (jamais ouverte par erreur)
    console.error('Portail', e?.message);
    return new Response('Accès réservé.', { status: 401, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  if (d.type === 'passer') return d.cookie ? next({ headers: { 'Set-Cookie': d.cookie } }) : next();
  return new Response(request.method === 'HEAD' ? null : d.body, { status: d.status, headers: d.headers });
}
