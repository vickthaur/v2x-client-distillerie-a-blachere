// Journal : qui a fait quoi, quand (équipe, site, système), avec filtres.
import { elements, useCrm } from '../lib/data.js';
import { useQuery } from '../lib/router.jsx';
import { Icon } from '../ui/icons.jsx';
import { Avatar, Button, Empty, Erreur, PageHead, Pagination, SkeletonRows, cx, useTitre } from '../ui/base.jsx';
import { ACTIONS } from '../lib/statuts.js';
import { dateHeure, heure, jourSemaine, isoJour, aujourdHui, ajouterJours } from '../lib/format.js';
import { PhraseJournal, auteurDe, detailsJournal } from '../ui/journal.jsx';

const PAR = 50;

export function Journal() {
  useTitre('Journal');
  const [q, setQ] = useQuery();
  const page = Number(q.get('page')) || 1;
  const action = q.get('action') || '';
  const par = q.get('par') || '';
  const r = useCrm('journal', { page, par: PAR, action, auteur: par || undefined }, { garder: true });
  const liste = elements(r.data, 'entrees', 'journal');
  const actions = r.data?.actions || [...new Set(liste.map((e) => e.action))].sort();
  const auteurs = r.data?.auteurs || [...new Map(liste.filter((e) => e.par?.nom).map((e) => [e.par.id || e.par.nom, e.par.nom])).entries()].map(([id, nom]) => ({ id, nom }));

  // Regroupement par jour
  const jours = [];
  for (const e of liste) {
    const j = isoJour(e.date);
    const g = jours[jours.length - 1];
    if (g && g.jour === j) g.items.push(e);
    else jours.push({ jour: j, items: [e] });
  }
  const titreJour = (j) => (j === aujourdHui() ? 'Aujourd’hui' : j === ajouterJours(aujourdHui(), -1) ? 'Hier' : jourSemaine(j));

  return (
    <div class="page page--journal">
      <PageHead titre="Journal" sous="Toutes les actions de l’équipe, du site et du système, des plus récentes aux plus anciennes." />
      <div class="toolbar">
        <select class="select select--sm" style="width:auto;max-width:100%" aria-label="Action" value={action} onChange={(e) => setQ({ action: e.currentTarget.value, page: undefined })}>
          <option value="">Toutes les actions</option>
          {actions.map((a) => {
            const id = typeof a === 'string' ? a : a.id;
            return (
              <option key={id} value={id}>
                {typeof a === 'string' ? ACTIONS[a]?.nom || a : a.libelle || ACTIONS[id]?.nom || id}
              </option>
            );
          })}
        </select>
        <select class="select select--sm" style="width:auto" aria-label="Auteur" value={par} onChange={(e) => setQ({ par: e.currentTarget.value, page: undefined })}>
          <option value="">Tout le monde</option>
          {auteurs.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nom}
            </option>
          ))}
        </select>
        {(action || par) && (
          <Button size="sm" variant="ghost" icon="x" onClick={() => setQ({ action: undefined, par: undefined, page: undefined })}>
            Effacer
          </Button>
        )}
      </div>
      {r.error && !r.data && <Erreur erreur={r.error} onRetry={r.reload} />}
      {!r.data && !r.error && (
        <div class="card">
          <SkeletonRows n={10} cols={2} />
        </div>
      )}
      {r.data && liste.length === 0 && (
        <div class="card">
          <Empty icone="journal" titre="Rien à afficher" texte="Aucune entrée ne correspond à ces filtres." />
        </div>
      )}
      <div class={cx('stack', r.refreshing && 'refreshing')}>
        {jours.map((g) => (
          <section key={g.jour} class="card" aria-label={titreJour(g.jour)}>
            <h2 class="journal__jour">{titreJour(g.jour)}</h2>
            <ol class="journal">
              {g.items.map((e) => {
                const qui = auteurDe(e);
                const details = detailsJournal(e);
                return (
                  <li key={e.id} class="journal__item">
                    <time class="journal__heure tnum" dateTime={e.date} title={dateHeure(e.date)}>
                      {heure(e.date)}
                    </time>
                    {e.par?.id ? (
                      <Avatar nom={qui} cle={e.par.id} size="s" />
                    ) : (
                      <span class="feed__sys" aria-hidden="true">
                        <Icon name={e.par?.nom === 'Site' ? 'globe' : 'etincelle'} size="xs" />
                      </span>
                    )}
                    <div class="journal__txt">
                      <p>
                        <PhraseJournal e={e} />
                      </p>
                      {details && <p class="small muted">{details}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
      {r.data && (
        <div class="card mt">
          <Pagination page={r.data.page || page} pages={r.data.pages || 1} total={r.data.total} par={PAR} onPage={(p) => setQ({ page: p > 1 ? p : undefined }, { replace: false })} unite={['entrée', 'entrées']} />
        </div>
      )}
    </div>
  );
}
