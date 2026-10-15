// Messages : boîte de réception (nouveau, en cours, traité, archivé) et volet de lecture (plein
// écran sur téléphone) ; réponse (déposée dans les courriels envoyés), attribution, statut, liens
// vers le client ou le compte pro.
import { useEffect, useRef, useState } from 'preact/hooks';
import { crm, elements, invalider, useCrm } from '../lib/data.js';
import { useFil, useSession } from '../lib/session.jsx';
import { Link, origineNavigation, useQuery } from '../lib/router.jsx';
import { Icon } from '../ui/icons.jsx';
import { Avatar, Button, Chips, Empty, Erreur, Notice, PageHead, SearchInput, SkeletonRows, Statut, cx, useTitre, coupe } from '../ui/base.jsx';
import { Menu, MenuItem, MenuLabel, MenuSep, toast } from '../ui/overlay.jsx';
import { Marque } from '../ui/marque.jsx';
import { MESSAGE, SUJET } from '../lib/statuts.js';
import { dateHeure, nomComplet, relatif, telephone, typo } from '../lib/format.js';
import { useMembres } from './comptes.jsx';

const ORDRE = ['nouveau', 'en-cours', 'traite', 'archive'];
const PLURIELS = { nouveau: 'Nouveaux', 'en-cours': 'En cours', traite: 'Traités', archive: 'Archivés' };

function useEquipe() {
  const s = useSession();
  const l = useMembres();
  if (!l.some((u) => u.id === s.moi.id)) l.unshift(s.moi);
  return l;
}

export function Messages({ id }) {
  useTitre('Messages');
  const [q, setQ] = useQuery();
  const statut = q.get('statut') ?? '';
  const recherche = q.get('q') || '';
  const r = useCrm('messages', { statut, q: recherche }, { garder: true });
  const liste = elements(r.data, 'messages');
  const compteurs = r.data?.compteurs || {};
  const lien = (m) => `/crm/messages/${m.id}${location.search}`;

  return (
    <div class={cx('page page--wide split-page', id && 'has-detail')}>
      <div class="split">
        <section class="split__list" aria-label="Boîte de réception">
          <PageHead titre="Messages" sous="Formulaire de contact du site et messages de l’espace pro" />
          <Chips
            label="Statut"
            items={[
              { id: '', label: 'Tous', n: compteurs.tous ?? compteurs.total ?? (r.data ? ORDRE.reduce((t, k) => t + (compteurs[k] || 0), 0) : undefined) },
              ...ORDRE.map((k) => ({ id: k, label: PLURIELS[k], n: ['nouveau', 'en-cours'].includes(k) ? compteurs[k] : undefined })),
            ]}
            value={statut}
            onChange={(v) => setQ({ statut: v || undefined })}
          />
          <div class="toolbar">
            <SearchInput class="toolbar__search" value={recherche} onChange={(v) => setQ({ q: v })} placeholder="Nom, e-mail, référence…" label="Rechercher un message" />
          </div>
          {r.error && !r.data && <Erreur erreur={r.error} onRetry={r.reload} />}
          {!r.data && !r.error && (
            <div class="card">
              <SkeletonRows n={7} cols={2} />
            </div>
          )}
          {r.data && liste.length === 0 && (
            <div class="card">
              <Empty icone="message" titre={statut === 'nouveau' ? 'Aucun nouveau message' : 'Aucun message'} texte={statut === 'nouveau' ? 'Tout a été lu. Bravo !' : 'Les messages du formulaire de contact et de l’espace pro arrivent ici.'} />
            </div>
          )}
          {liste.length > 0 && (
            <div class={cx('card inbox', r.refreshing && 'refreshing')}>
              {liste.map((m) => {
                const dernier = (m.fil || [])[m.fil?.length - 1];
                const apercu = m.extrait || m.apercu || dernier?.texte || m.message || '';
                return (
                  <Link key={m.id} class={cx('inbox__item', m.lu === false && 'is-unread')} href={lien(m)} aria-current={m.id === id ? 'page' : undefined}>
                    <Avatar nom={m.nom} cle={m.email || m.id} />
                    <span class="inbox__main">
                      <span class="inbox__top">
                        <span class="inbox__from">
                          {m.lu === false && <span class="inbox__dot" aria-label="Non lu" />}
                          {m.nom}
                        </span>
                        <time class="inbox__date" dateTime={m.date || m.createdAt}>
                          {relatif(m.dernierMessage || m.date || m.createdAt)}
                        </time>
                      </span>
                      <span class="inbox__subject">
                        <span class="tag tag--soft">{SUJET[m.sujet] || m.sujet}</span>
                        <span class="mono small muted">{m.reference}</span>
                        {(m.compte || m.compteId) && <Icon name="store" size="xs" title="Compte pro" />}
                        {m.nbMessages > 1 && <span class="small muted">· {m.nbMessages} messages</span>}
                        {m.assigneA?.nom && (
                          <span class="inbox__assigne small" title={`Attribué à ${m.assigneA.nom}`}>
                            <Icon name="client" size="xs" />
                            {m.assigneA.nom.split(' ')[0]}
                          </span>
                        )}
                      </span>
                      <span class="inbox__bottom">
                        <span class="inbox__preview">{typo(apercu)}</span>
                        <Statut table={MESSAGE} valeur={m.statut} />
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
        <section class="split__detail" aria-label="Message sélectionné">
          {id ? (
            <Lecture key={id} id={id} retour={`/crm/messages${location.search}`} onChange={() => r.reload({ silencieux: true })} />
          ) : (
            <div class="split__vide">
              <Empty icone="message" titre="Choisissez un message" texte="Lisez, répondez, attribuez-le à un membre de l’équipe ou classez-le." />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Lecture({ id, retour, onChange }) {
  const s = useSession();
  const r = useCrm('message', { id });
  const m = r.data?.message || r.data;
  useFil(m?.nom);
  const equipe = useEquipe();
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const titre = useRef(null);
  const finFil = useRef(null);
  const peutModifier = s.peut('messages', 'ecriture');
  useEffect(() => {
    if (r.data) onChange();
  }, [!!r.data]);
  useEffect(() => {
    if (m && origineNavigation() !== 'init') titre.current?.focus({ preventScroll: true });
  }, [id, !!m]);

  if (r.error && !m) return r.error.status === 404 ? <Empty icone="message" titre="Message introuvable" /> : <Erreur erreur={r.error} onRetry={r.reload} />;
  if (!m) return <div class="card"><SkeletonRows n={5} cols={2} /></div>;

  const patch = async (body, message) => {
    const avant = r.data;
    r.mutate((x) => (x?.message ? { ...x, message: { ...x.message, ...body } } : { ...x, ...body }));
    try {
      await crm('message', { method: 'PATCH', query: { id: m.id }, body });
      if (message) toast(message);
      onChange();
      invalider('tableau');
    } catch (e) {
      r.mutate(avant);
      toast.erreur(e);
    }
  };
  const repondre = async (e) => {
    e.preventDefault();
    if (texte.trim().length < 2) return;
    setEnvoi(true);
    try {
      const d = await crm('message-reponse', { method: 'POST', query: { id: m.id }, body: { texte: texte.trim() } });
      setTexte('');
      if (d && (d.message || d.fil)) r.mutate(d.message ? d : { ...r.data, ...d });
      else r.reload({ silencieux: true });
      onChange();
      invalider('courriels', 'tableau');
      toast(`Réponse envoyée à ${m.nom}`, { detail: 'Démonstration : le courriel est rangé dans « Courriels envoyés ».', action: { label: 'Voir', href: '/crm/courriels' } });
      requestAnimationFrame(() => finFil.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
    } catch (x) {
      toast.erreur(x);
    } finally {
      setEnvoi(false);
    }
  };
  const assigne = equipe.find((u) => u.id === (m.assigneA?.id || m.assigneA));
  const fil = m.fil?.length ? m.fil : m.message ? [{ date: m.createdAt, de: 'client', texte: m.message }] : [];

  return (
    <article class="detail lecture">
      <Link class="page__back detail__retour" href={retour}>
        <Icon name="gauche" />
        Messages
      </Link>
      <header class="detail__head">
        <Avatar nom={m.nom} cle={m.email || m.id} size="xl" />
        <div class="detail__titres">
          <h2 class="detail__titre" tabIndex={-1} ref={titre}>
            {m.nom}
          </h2>
          <p class="muted small">
            <span class="tag tag--soft">{SUJET[m.sujet] || m.sujet}</span> <span class="mono">{m.reference}</span> · {dateHeure(m.createdAt)}
          </p>
        </div>
        <Statut table={MESSAGE} valeur={m.statut} lg />
      </header>

      <div class="lecture__barre">
        <ul class="contact contact--ligne">
          <li>
            <Icon name="mail" size="s" />
            <a class="link link--ink" href={`mailto:${m.email}`}>
              {coupe(m.email)}
            </a>
          </li>
          {m.telephone && (
            <li>
              <Icon name="telephone" size="s" />
              <a class="link link--ink" href={`tel:${m.telephone.replace(/\s/g, '')}`}>
                {telephone(m.telephone)}
              </a>
            </li>
          )}
          {(m.client?.id || m.clientId) && (
            <li>
              <Icon name="client" size="s" />
              {s.peut('clients') ? (
                <Link class="link" href={`/crm/clients/${m.client?.id || m.clientId}`}>
                  Fiche client
                </Link>
              ) : (
                <span>Client connu</span>
              )}
            </li>
          )}
          {(m.compte?.id || m.compteId) && (
            <li>
              <Icon name="store" size="s" />
              {s.peut('comptes') ? (
                <Link class="link" href={`/crm/comptes/${m.compte?.id || m.compteId}`}>
                  {m.compte?.enseigne || m.compte?.nom || 'Compte pro'}
                </Link>
              ) : (
                <span>{m.compte?.enseigne || m.compte?.nom || 'Compte pro'}</span>
              )}
            </li>
          )}
        </ul>
        {peutModifier && (
          <div class="btn-row">
            <Menu
              label="Attribuer"
              bouton={(p) => (
                <Button size="sm" {...p}>
                  {assigne ? <Avatar nom={nomComplet(assigne)} cle={assigne.id} size="s" /> : <Icon name="user-plus" />}
                  {assigne ? nomComplet(assigne).split(' ')[0] : 'Attribuer'}
                  <Icon name="bas" />
                </Button>
              )}
            >
              {(fermer) => (
                <>
                  <MenuLabel>Attribuer à</MenuLabel>
                  {equipe.map((u) => (
                    <MenuItem key={u.id} fermer={fermer} checked={assigne?.id === u.id} avatar={<Avatar nom={nomComplet(u)} cle={u.id} size="s" />} onSelect={() => patch({ assigneA: u.id }, `Message attribué à ${nomComplet(u)}`)}>
                      {nomComplet(u)}
                      {u.id === s.moi.id ? ' (moi)' : ''}
                    </MenuItem>
                  ))}
                  {assigne && (
                    <>
                      <MenuSep />
                      <MenuItem icone="x" fermer={fermer} onSelect={() => patch({ assigneA: null }, 'Message non attribué')}>
                        Retirer l’attribution
                      </MenuItem>
                    </>
                  )}
                </>
              )}
            </Menu>
            <Menu
              label="Statut"
              bouton={(p) => (
                <Button size="sm" {...p}>
                  Statut
                  <Icon name="bas" />
                </Button>
              )}
            >
              {(fermer) => (
                <>
                  {ORDRE.map((k) => (
                    <MenuItem key={k} fermer={fermer} checked={m.statut === k} onSelect={() => m.statut !== k && patch({ statut: k }, `Message ${MESSAGE[k].label.toLowerCase()}`)}>
                      {MESSAGE[k].label}
                    </MenuItem>
                  ))}
                </>
              )}
            </Menu>
            {m.statut !== 'traite' && m.statut !== 'archive' && (
              <Button size="sm" icon="check" onClick={() => patch({ statut: 'traite' }, 'Message traité')}>
                <span class="hide-s">Traité</span>
              </Button>
            )}
            {m.statut !== 'archive' && <Button size="sm" variant="ghost" icon="archive" aria-label="Archiver" title="Archiver" onClick={() => patch({ statut: 'archive' }, 'Message archivé')} />}
          </div>
        )}
      </div>

      <ol class="fil" aria-label="Échanges">
        {fil.map((x, i) => (
          <li key={i} class={cx('bulle', x.de === 'equipe' ? 'bulle--equipe' : 'bulle--client')}>
            <div class="bulle__meta">
              <span class="strong">{x.de === 'equipe' ? x.par?.nom || 'Équipe' : m.nom}</span>
              <time dateTime={x.date} title={dateHeure(x.date)}>
                {relatif(x.date)}
              </time>
            </div>
            <div class="bulle__texte">
              {String(x.texte || '')
                .split('\n')
                .map((l, j) => (
                  <p key={j}>{l ? <Marque texte={typo(l)} /> : ' '}</p>
                ))}
            </div>
          </li>
        ))}
        <li ref={finFil} aria-hidden="true" />
      </ol>

      {peutModifier && m.statut !== 'archive' && (
        <form class="reponse" onSubmit={repondre}>
          <label class="sr-only" for={`rep-${m.id}`}>
            Votre réponse
          </label>
          <textarea id={`rep-${m.id}`} class="textarea" rows={4} value={texte} onInput={(e) => setTexte(e.currentTarget.value)} placeholder={`Répondre à ${m.nom.split(' ')[0]}…`} onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && repondre(e)} />
          <div class="reponse__pied">
            <span class="small muted">
              Envoyée à {m.email}
              <span class="kbd-astuce">
                {' '}
                · <kbd>Ctrl</kbd> <kbd>↵</kbd>
              </span>
            </span>
            <Button type="submit" variant="primary" icon="send" busy={envoi} disabled={texte.trim().length < 2}>
              Envoyer la réponse
            </Button>
          </div>
        </form>
      )}
      {m.statut === 'archive' && <Notice>Message archivé. Changez son statut pour y répondre.</Notice>}
    </article>
  );
}
