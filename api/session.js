// Fonction Vercel /api/session : connexion, démo, mots de passe, profil (docs/crm-espace-pro.md, § 7).
// Mince : la logique est dans server/routes/session.js.
import { fonction } from '../server/http.js';
import { routes } from '../server/routes/session.js';

const f = fonction(routes);

export const GET = (req) => f.GET(req);
export const POST = (req) => f.POST(req);
export const PATCH = (req) => f.PATCH(req);
export const DELETE = (req) => f.DELETE(req);
// HEAD, PUT, OPTIONS… : 405 en JSON.
export const HEAD = (req) => f.HEAD(req);
export const PUT = (req) => f.PUT(req);
export const OPTIONS = (req) => f.OPTIONS(req);
