// Courriels envoyés : la boîte d'envoi de la démo (rien ne part) et l'aperçu fidèle de chaque
// courriel, tel que le destinataire l'aurait reçu.
import { useEffect, useRef } from 'preact/hooks';
import { elements, useCrm } from '../lib/data.js';
import { useFil } from '../lib/session.jsx';
import { Link, origineNavigation, useQuery } from '../lib/router.jsx';
import { Icon } from '../ui/icons.jsx';
import { Empty, Erreur, Notice, PageHead, Pagination, SkeletonRows, cx, useTitre } from '../ui/base.jsx';
import { ApercuCourriel } from '../ui/courriel.jsx';
import { lienDe } from '../lib/liens.js';
import { COURRIEL_TYPE } from '../lib/statuts.js';
import { relatif } from '../lib/format.js';

const PAR = 30;
const ICONES = { commande: 'commandes', expedition: 'camion', retrait: 'store', facture: 'facture', invitation: 'user-plus', reinitialisation: 'cle', reservation: 'calendrier', reponse: 'repondre', 'demande-pro': 'briefcase', campagne: 'send', bienvenue: 'etincelle' };

export function Courriels({ id }) {
  useTitre('Courriels envoyés');
  const [q, setQ] = useQuery();
  const type = q.get('type') || '';
  const page = Number(q.get('page')) || 1;
  const r = useCrm('courriels', { type, page, par: PAR }, { garder: true });
  const liste = elements(r.data, 'courriels');
  const types = [...new Set(liste.map((c) => c.type))];
  return (
    <div class={cx('page page--wide split-page', id && 'has-detail')}>
      <div class="split split--large">
        <section class="split__list" aria-label="Courriels envoyés">
          <PageHead titre="Courriels envoyés" sous="Tout ce que le CRM et le site auraient envoyé : rien ne part vraiment." />
          <div class="toolbar">
            <select class="select select--sm" style="width:auto" aria-label="Type de courriel" value={type} onChange={(e) => setQ({ type: e.currentTarget.value, page: undefined })}>
              <option value="">Tous les types</option>
              {Object.entries(COURRIEL_TYPE)
                .filter(([k]) => types.includes(k) || k === type || !r.data)
                .map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
            </select>
          </div>
          {r.error && !r.data && <Erreur erreur={r.error} onRetry={r.reload} />}
          {!r.data && !r.error && (
            <div class="card">
              <SkeletonRows n={8} cols={2} />
            </div>
          )}
          {r.data && liste.length === 0 && (
            <div class="card">
              <Empty icone="send" titre="Aucun courriel" texte="Confirmations de commande, expéditions, invitations, réponses : ils s’afficheront ici." />
            </div>
          )}
          {liste.length > 0 && (
            <div class={cx('card inbox', r.refreshing && 'refreshing')}>
              {liste.map((c) => (
                <Link key={c.id} class="inbox__item" href={`/crm/courriels/${c.id}${location.search}`} aria-current={c.id === id ? 'page' : undefined}>
                  <span class="list__ico">
                    <Icon name={ICONES[c.type] || 'mail'} size="s" />
                  </span>
                  <span class="inbox__main">
                    <span class="inbox__top">
                      <span class="inbox__from">{c.a}</span>
                      <time class="inbox__date" dateTime={c.date}>
                        {relatif(c.date)}
                      </time>
                    </span>
                    <span class="inbox__preview inbox__preview--strong">{c.objet}</span>
                    <span class="inbox__subject">
                      <span class="tag tag--soft">{COURRIEL_TYPE[c.type] || c.type}</span>
                    </span>
                  </span>
                </Link>
              ))}
              <Pagination page={r.data.page || page} pages={r.data.pages || 1} total={r.data.total} par={PAR} onPage={(p) => setQ({ page: p > 1 ? p : undefined }, { replace: false })} unite={['courriel', 'courriels']} />
            </div>
          )}
        </section>
        <section class="split__detail" aria-label="Aperçu du courriel">
          {id ? (
            <Apercu key={id} id={id} depuisListe={liste.find((c) => c.id === id)} />
          ) : (
            <div class="split__vide">
              <Empty icone="mail" titre="Choisissez un courriel" texte="Son aperçu s’affiche ici, avec le logo, les couleurs et le pied de page de la distillerie." />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Apercu({ id, depuisListe }) {
  const besoin = !depuisListe?.contenu;
  const r = useCrm(besoin ? 'courriel' : null, { id });
  const c = besoin ? r.data?.courriel || r.data : depuisListe;
  useFil(c?.objet);
  const ref = useRef(null);
  useEffect(() => {
    if (c && origineNavigation() !== 'init') ref.current?.focus({ preventScroll: true });
  }, [id, !!c]);
  if (besoin && r.error) return <Erreur erreur={r.error} onRetry={r.reload} />;
  if (!c) return <div class="card"><SkeletonRows n={6} cols={2} /></div>;
  const lie = c.lie ? lienDe(c.lie.type, c.lie.id) : null;
  return (
    <div class="detail stack stack--s">
      <Link class="page__back detail__retour" href={`/crm/courriels${location.search}`}>
        <Icon name="gauche" />
        Courriels
      </Link>
      <h2 class="sr-only" tabIndex={-1} ref={ref}>
        {c.objet}
      </h2>
      {lie && (
        <Notice icone="lien">
          Lié à{' '}
          <Link class="link" href={lie}>
            {c.lie.libelle || `${c.lie.type} ${c.lie.id}`}
          </Link>
        </Notice>
      )}
      <ApercuCourriel courriel={c} />
    </div>
  );
}
