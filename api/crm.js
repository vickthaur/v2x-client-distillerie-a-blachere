// Fonction Vercel /api/crm : back-office du personnel de la distillerie (docs/crm-espace-pro.md, § 7).
// Mince : la logique est dans server/routes/crm.js.
import { fonction } from '../server/http.js';
import { routes } from '../server/routes/crm.js';

const f = fonction(routes);

export const GET = (req) => f.GET(req);
export const POST = (req) => f.POST(req);
export const PATCH = (req) => f.PATCH(req);
export const DELETE = (req) => f.DELETE(req);
// HEAD, PUT, OPTIONS… : 405 en JSON.
export const HEAD = (req) => f.HEAD(req);
export const PUT = (req) => f.PUT(req);
export const OPTIONS = (req) => f.OPTIONS(req);
