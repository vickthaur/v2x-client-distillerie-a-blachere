// Fonction Vercel /api/pro : espace des clients professionnels, limité au compte de la session
// (docs/crm-espace-pro.md, § 7). Mince : la logique est dans server/routes/pro.js.
import { fonction } from '../server/http.js';
import { routes } from '../server/routes/pro.js';

const f = fonction(routes);

export const GET = (req) => f.GET(req);
export const POST = (req) => f.POST(req);
export const PATCH = (req) => f.PATCH(req);
export const DELETE = (req) => f.DELETE(req);
// HEAD, PUT, OPTIONS… : 405 en JSON.
export const HEAD = (req) => f.HEAD(req);
export const PUT = (req) => f.PUT(req);
export const OPTIONS = (req) => f.OPTIONS(req);
