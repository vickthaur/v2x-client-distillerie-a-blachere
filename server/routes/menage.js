// api/menage : tâche planifiée (Vercel Cron, vercel.json : tous les jours à 3 h 17 UTC) qui efface
// les démos sans écriture depuis 30 jours. Exige Authorization: Bearer ${CRON_SECRET} (Vercel
// l'envoie de lui-même quand la variable est définie) ; sans CRON_SECRET, la tâche refuse de tourner.
// Suppression conditionnelle (ETag de la liste) : une démo reprise pendant le passage est gardée.
import { timingSafeEqual } from 'node:crypto';
import { cheminDemo, idDeChemin } from '../demo.js';
import { ErreurConfiguration, erreur } from '../http.js';
import { ConflitStockage, magasin } from '../store.js';

export const INACTIVITE_MS = 30 * 86400000;
// Une fonction dure 15 s au plus (vercel.json) : au plus 500 suppressions et 10 s par passage ;
// le reste attend le passage du lendemain.
export const SUPPRESSIONS_MAX = 500;
const BUDGET_MS = 10_000;

function autoriser(ctx) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.VERCEL) throw new ErreurConfiguration('CRON_SECRET absent');
    throw erreur(401, 'Ménage désactivé : CRON_SECRET n’est pas défini.', { code: 'secret' });
  }
  const recu = Buffer.from(ctx.req.headers.get('authorization') || '');
  const attendu = Buffer.from(`Bearer ${secret}`);
  if (recu.length !== attendu.length || !timingSafeEqual(recu, attendu)) throw erreur(401, 'Accès refusé.', { code: 'secret' });
}

async function menage(ctx) {
  autoriser(ctx);
  const debut = performance.now();
  const store = magasin();
  const limite = ctx.maintenant.getTime() - INACTIVITE_MS;
  const aSupprimer = [];
  let examinees = 0;
  for await (const b of store.lister('demos/')) {
    const id = idDeChemin(b.chemin);
    if (!id) continue;
    examinees += 1;
    if (new Date(b.majLe).getTime() < limite) aSupprimer.push({ id, etag: b.etag });
  }
  const lot = aSupprimer.slice(0, SUPPRESSIONS_MAX);
  let traitees = 0;
  let supprimees = 0;
  let reprises = 0;
  // par 10 ; suppression conditionnelle : une démo réutilisée depuis la liste (ETag changé) est gardée
  for (let i = 0; i < lot.length && performance.now() - debut < BUDGET_MS; i += 10) {
    const tranche = lot.slice(i, i + 10);
    traitees += tranche.length;
    const r = await Promise.all(
      tranche.map(({ id, etag }) =>
        store.supprimer(cheminDemo(id), { ifMatch: etag }).then(
          () => 1,
          (e) => {
            if (e instanceof ConflitStockage) return 0;
            throw e;
          },
        ),
      ),
    );
    for (const x of r) x ? (supprimees += 1) : (reprises += 1);
  }
  // aucune donnée personnelle : seulement des nombres
  console.log(`[menage] ${supprimees} démo(s) effacée(s) sur ${examinees}`);
  return { examinees, supprimees, conservees: examinees - supprimees, restantes: aSupprimer.length - traitees, reprises };
}

export const routes = { GET: { '': menage, menage } };
