// Clients particuliers : liste par segment et recherche ; fiche (commandes, total dépensé,
// consentement à la newsletter, étiquettes, notes, modification), export RGPD et suppression.
import { useEffect, useState } from 'preact/hooks';
import { crm, crmUrl, elements, invalider, telecharger, useCrm } from '../lib/data.js';
import { useFil, useSession } from '../lib/session.jsx';
import { Link, clicLigne, navigate, useQuery } from '../lib/router.jsx';
import { Icon } from '../ui/icons.jsx';
import { Avatar, Button, Card, Chips, Empty, Erreur, Notice, PageHead, Pagination, Pill, SearchInput, SkeletonPage, SkeletonRows, SortTh, Statut, useTitre } from '../ui/base.jsx';
import { Check, Input, Switch, Textarea, erreurDe } from '../ui/form.jsx';
import { Dialog, Menu, MenuItem, MenuSep, confirmer, toast } from '../ui/overlay.jsx';
import { ABONNE_SOURCE, CLIENT_ORIGINE, COMMANDE, CANAL, MESSAGE, RESERVATION, SUJET } from '../lib/statuts.js';
import { date, euros, heure, nombre, pluriel, relatif, telephone } from '../lib/format.js';
import { formatAdresse } from './commande.jsx';

const PAR = 25;
const SEGMENTS = [
  { id: 'tous', label: 'Tous' },
  { id: 'newsletter', label: 'Abonnés à la newsletter' },
  { id: 'fideles', label: 'Fidèles' },
  { id: 'inactifs', label: 'Inactifs' },
];
const nomDe = (c) => [c?.prenom, c?.nom].filter(Boolean).join(' ') || c?.email || 'Client';

export function Clients() {
  useTitre('Clients');
  const s = useSession();
  const [q, setQ] = useQuery();
  const segment = q.get('segment') || 'tous';
  const recherche = q.get('q') || '';
  const page = Number(q.get('page')) || 1;
  const tri = q.get('tri') || 'nom';
  const trier = (t) => setQ({ tri: t === 'nom' ? undefined : t, page: undefined });
  const r = useCrm('clients', { segment, q: recherche, page, par: PAR, tri }, { garder: true });
  const d = r.data;
  const liste = elements(d, 'clients');
  const compteurs = d?.compteurs || d?.segments || {};
  const [creer, setCreer] = useState(false);
  const peutModifier = s.peut('clients', 'ecriture');

  return (
    <div class="page">
      <PageHead
        titre="Clients"
        sous={d ? `${pluriel(d.total ?? liste.length, 'client particulier', 'clients particuliers')}` : 'Clients particuliers de la boutique en ligne et de la distillerie'}
        actions={
          <>
            {s.peut('exports') && (
              <Button href={crmUrl('export', { type: 'clients' })} target="_blank" download="" icon="telecharger" title="Tous les clients, au format CSV (tableur)">
                <span class="hide-s">Exporter</span>
              </Button>
            )}
            {peutModifier && (
              <Button variant="primary" icon="plus" onClick={() => setCreer(true)}>
                Nouveau client
              </Button>
            )}
          </>
        }
      />
      <Chips label="Segments" items={SEGMENTS.map((x) => ({ ...x, n: compteurs[x.id] }))} value={segment} onChange={(v) => setQ({ segment: v === 'tous' ? undefined : v, page: undefined })} />
      <div class="toolbar">
        <SearchInput class="toolbar__search" value={recherche} onChange={(v) => setQ({ q: v, page: undefined })} placeholder="Nom, e-mail, téléphone, ville…" label="Rechercher un client" />
        <select class="select select--sm only-mob-inline" style="width:auto" aria-label="Trier" value={tri} onChange={(e) => trier(e.currentTarget.value)}>
          <option value="nom">Par nom</option>
          <option value="-total">Total dépensé</option>
          <option value="-commandes">Nombre de commandes</option>
          <option value="-derniere">Dernière commande</option>
          <option value="-date">Plus récents</option>
        </select>
      </div>
      {r.error && !d && <Erreur erreur={r.error} onRetry={r.reload} />}
      <div class={r.refreshing ? 'refreshing' : ''}>
        {!d && !r.error && (
          <div class="card">
            <SkeletonRows n={8} cols={5} />
          </div>
        )}
        {d && liste.length === 0 && (
          <div class="card">
            <Empty icone="client" titre={recherche ? 'Aucun client trouvé' : 'Aucun client dans ce segment'} texte={recherche ? `Rien ne correspond à « ${recherche} ».` : 'Les clients apparaissent à leur première commande ou inscription.'} />
          </div>
        )}
        {d && liste.length > 0 && (
          <>
            <div class="card only-desk">
              <div class="tbl-wrap">
                <table class="tbl">
                  <caption class="sr-only">Clients</caption>
                  <thead>
                    <tr>
                      <SortTh id="nom" tri={tri} onTri={trier}>
                        Client
                      </SortTh>
                      <th>Ville</th>
                      <SortTh id="commandes" tri={tri} onTri={trier} class="num">
                        Commandes
                      </SortTh>
                      <SortTh id="total" tri={tri} onTri={trier} class="num">
                        Total dépensé
                      </SortTh>
                      <SortTh id="derniere" tri={tri} onTri={trier}>
                        Dernière commande
                      </SortTh>
                      <th>Newsletter</th>
                      <th>Étiquettes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liste.map((c) => {
                      const href = `/crm/clients/${c.id}`;
                      return (
                        <tr key={c.id} data-href={href} onClick={clicLigne(href)}>
                          <td>
                            <span class="row" style="gap:10px">
                              <Avatar nom={nomDe(c)} cle={c.id} size="s" />
                              <span style="min-width:0">
                                <Link class="tbl__main" href={href}>
                                  {nomDe(c)}
                                </Link>
                                <span class="tbl__sub ellipsis" style="max-width:260px">{c.email}</span>
                              </span>
                            </span>
                          </td>
                          <td>{c.ville || c.adresse?.ville || <span class="muted">—</span>}</td>
                          <td class="num">{nombre(c.commandes ?? c.nbCommandes ?? 0)}</td>
                          <td class="num strong">{euros(c.totalTTC ?? c.totalDepense ?? 0)}</td>
                          <td>{c.derniereCommande ? date(c.derniereCommande.date || c.derniereCommande) : <span class="muted">Aucune</span>}</td>
                          <td>{c.newsletter ? <Pill ton="ok">Inscrit</Pill> : <span class="muted small">Non</span>}</td>
                          <td>
                            <span class="row row--wrap" style="gap:4px">
                              {(c.tags || []).slice(0, 3).map((t) => (
                                <span class="tag" key={t}>
                                  {t}
                                </span>
                              ))}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={d.page || page} pages={d.pages || 1} total={d.total} par={PAR} onPage={(p) => setQ({ page: p > 1 ? p : undefined }, { replace: false })} unite={['client', 'clients']} />
            </div>
            <div class="mcards only-mob">
              {liste.map((c) => (
                <Link key={c.id} class="mcard" href={`/crm/clients/${c.id}`}>
                  <div class="mcard__top">
                    <span class="row" style="gap:10px;min-width:0">
                      <Avatar nom={nomDe(c)} cle={c.id} size="s" />
                      <span class="mcard__title">{nomDe(c)}</span>
                    </span>
                    <span class="mcard__amount">{euros(c.totalTTC ?? c.totalDepense ?? 0)}</span>
                  </div>
                  <div class="mcard__meta">
                    <span>{[c.ville || c.adresse?.ville, pluriel(c.commandes ?? c.nbCommandes ?? 0, 'commande', 'commandes')].filter(Boolean).join(' · ')}</span>
                    {c.newsletter && <Pill ton="ok">Newsletter</Pill>}
                  </div>
                </Link>
              ))}
              <Pagination page={d.page || page} pages={d.pages || 1} total={d.total} par={PAR} onPage={(p) => setQ({ page: p > 1 ? p : undefined }, { replace: false })} unite={['client', 'clients']} />
            </div>
          </>
        )}
      </div>
      {creer && (
        <DialogClient
          onClose={() => setCreer(false)}
          onFait={(c) => {
            setCreer(false);
            invalider('clients');
            if (c?.id) navigate(`/crm/clients/${c.id}`);
          }}
        />
      )}
    </div>
  );
}

// Création ou modification d'un client
function DialogClient({ client, onClose, onFait }) {
  const [f, setF] = useState(() => ({
    prenom: client?.prenom || '',
    nom: client?.nom || '',
    email: client?.email || '',
    telephone: client?.telephone || '',
    ligne1: client?.adresse?.ligne1 || '',
    ligne2: client?.adresse?.ligne2 || '',
    cp: client?.adresse?.cp || '',
    ville: client?.adresse?.ville || '',
    newsletter: !!client?.newsletter,
  }));
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const maj = (k) => (e) => setF({ ...f, [k]: e.currentTarget.type === 'checkbox' ? e.currentTarget.checked : e.currentTarget.value });
  const envoyer = async () => {
    if (!f.nom.trim() || !/^\S+@\S+\.\S+$/.test(f.email.trim())) {
      setErr({ champ: !f.nom.trim() ? 'nom' : 'email', message: !f.nom.trim() ? 'Le nom est obligatoire.' : 'Adresse e-mail invalide.' });
      return;
    }
    setBusy(true);
    setErr(null);
    const adresse = f.ligne1.trim() ? { ligne1: f.ligne1.trim(), ligne2: f.ligne2.trim() || undefined, cp: f.cp.trim(), ville: f.ville.trim(), pays: 'France' } : undefined;
    const body = { prenom: f.prenom.trim(), nom: f.nom.trim(), email: f.email.trim(), telephone: f.telephone.trim() || undefined, adresse, newsletter: f.newsletter };
    try {
      const d = client ? await crm('client', { method: 'PATCH', query: { id: client.id }, body }) : await crm('client', { method: 'POST', body: { ...body, origine: 'boutique' } });
      toast(client ? 'Fiche client mise à jour' : 'Client créé');
      onFait(d?.client || d);
    } catch (e) {
      setErr(e);
      setBusy(false);
    }
  };
  return (
    <Dialog
      titre={client ? 'Modifier le client' : 'Nouveau client'}
      icone="client"
      onClose={onClose}
      onSubmit={envoyer}
      pied={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary" busy={busy}>
            {client ? 'Enregistrer' : 'Créer le client'}
          </Button>
        </>
      }
    >
      <div class="form">
        <div class="form-grid">
          <Input label="Prénom" value={f.prenom} onInput={maj('prenom')} error={erreurDe(err, 'prenom')} autoComplete="off" />
          <Input label="Nom" value={f.nom} onInput={maj('nom')} error={erreurDe(err, 'nom')} autoComplete="off" />
          <Input label="E-mail" type="email" value={f.email} onInput={maj('email')} error={erreurDe(err, 'email')} autoComplete="off" />
          <Input label="Téléphone" opt type="tel" value={f.telephone} onInput={maj('telephone')} error={erreurDe(err, 'telephone')} autoComplete="off" />
          <Input class="span-2" label="Adresse" opt value={f.ligne1} onInput={maj('ligne1')} error={erreurDe(err, 'ligne1', 'adresse')} />
          <Input class="span-2" label="Complément" opt value={f.ligne2} onInput={maj('ligne2')} />
          <Input label="Code postal" opt inputMode="numeric" value={f.cp} onInput={maj('cp')} error={erreurDe(err, 'cp')} />
          <Input label="Ville" opt value={f.ville} onInput={maj('ville')} error={erreurDe(err, 'ville')} />
        </div>
        <Check label="Accepte de recevoir la lettre d’information (consentement recueilli)" checked={f.newsletter} onChange={maj('newsletter')} boite />
        {err && !erreurDe(err, 'prenom', 'nom', 'email', 'telephone', 'ligne1', 'adresse', 'cp', 'ville') && <Notice ton="err">{err.message}</Notice>}
      </div>
    </Dialog>
  );
}

export function Client({ id }) {
  const s = useSession();
  const r = useCrm('client', { id });
  const d = r.data;
  const c = d?.client || d;
  useTitre(c ? nomDe(c) : 'Client');
  useFil(c ? nomDe(c) : null);
  const [edition, setEdition] = useState(false);
  const peutModifier = s.peut('clients', 'ecriture');
  if (r.error && !c) {
    return (
      <div class="page">
        <PageHead titre="Client" retour={{ href: '/crm/clients', label: 'Clients' }} />
        {r.error.status === 404 ? <Empty icone="client" titre="Client introuvable" texte="Il a peut-être été supprimé (RGPD)." action={<Button href="/crm/clients">Tous les clients</Button>} /> : <Erreur erreur={r.error} onRetry={r.reload} />}
      </div>
    );
  }
  if (!c) return <div class="page"><SkeletonPage /></div>;
  const commandes = elements(d?.commandes || c.commandes, 'commandes');
  const tot = d?.totaux || c.totaux || {};
  const total = tot.totalTTC ?? tot.total ?? commandes.reduce((t, x) => t + (x.statut !== 'annulee' && x.statut !== 'remboursee' ? x.totalTTC || x.totaux?.totalTTC || 0 : 0), 0);
  const nb = tot.commandes ?? commandes.length;
  const derniere = commandes[0];
  const derniereDate = tot.derniereCommande || derniere?.date || derniere?.createdAt;
  const reservations = elements(d?.reservations);
  const messages = elements(d?.messages);
  const abonnement = d?.abonnement;

  const patch = async (body, message) => {
    const avant = r.data;
    r.mutate((x) => (x?.client ? { ...x, client: { ...x.client, ...body } } : { ...x, ...body }));
    try {
      await crm('client', { method: 'PATCH', query: { id: c.id }, body });
      if (message) toast(message);
      invalider('clients');
    } catch (e) {
      r.mutate(avant);
      toast.erreur(e);
    }
  };
  const exporter = async () => {
    try {
      const nom = await telecharger(crmUrl('client-export', { id: c.id }), `donnees-${(c.nom || 'client').toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.json`);
      toast('Données personnelles exportées', { detail: nom });
    } catch (e) {
      toast.erreur(e);
    }
  };
  const supprimer = async () => {
    const ok = await confirmer({
      titre: `Supprimer ${nomDe(c)} ?`,
      message: 'Droit à l’effacement (RGPD) : la fiche est supprimée définitivement et ses commandes sont anonymisées (montants conservés pour la comptabilité). Cette action est irréversible.',
      confirmer: 'Supprimer définitivement',
      danger: true,
      icone: 'corbeille',
      saisie: 'SUPPRIMER',
      action: () => crm('client', { method: 'DELETE', query: { id: c.id } }),
    });
    if (ok) {
      invalider('clients', 'commandes', 'tableau');
      toast('Client supprimé', { detail: 'Ses commandes sont anonymisées.' });
      navigate('/crm/clients', { replace: true });
    }
  };

  return (
    <div class="page">
      <PageHead
        titre={
          <span class="row" style="gap:14px">
            <Avatar nom={nomDe(c)} cle={c.id} size="l" />
            <span>{nomDe(c)}</span>
          </span>
        }
        retour={{ href: '/crm/clients', label: 'Clients' }}
        sous={
          <>
            <span>Client depuis le {date(c.createdAt)}</span>
            {c.origine && <span>{CLIENT_ORIGINE[c.origine] || c.origine}</span>}
          </>
        }
        actions={
          <>
            {peutModifier && (
              <Button icon="crayon" onClick={() => setEdition(true)}>
                Modifier
              </Button>
            )}
            <Menu label="Plus d’actions" bouton={(p) => <Button icon="points" aria-label="Plus d’actions" {...p} />}>
              {(fermer) => (
                <>
                  {s.peut('commandes', 'ecriture') && (
                    <MenuItem icone="plus" fermer={fermer} href={`/crm/commandes/nouvelle?client=${c.id}`}>
                      Nouvelle commande
                    </MenuItem>
                  )}
                  {peutModifier && (
                    <MenuItem icone="telecharger" fermer={fermer} onSelect={exporter} desc="Toutes ses données au format JSON (RGPD)">
                      Exporter ses données
                    </MenuItem>
                  )}
                  {peutModifier && (
                    <>
                      <MenuSep />
                      <MenuItem icone="corbeille" danger fermer={fermer} onSelect={supprimer} desc="Droit à l’effacement">
                        Supprimer le client
                      </MenuItem>
                    </>
                  )}
                </>
              )}
            </Menu>
          </>
        }
      />
      <div class="stats-row">
        <div class="stat">
          <span class="stat__k">Commandes</span>
          <span class="stat__v">{nombre(nb)}</span>
        </div>
        <div class="stat">
          <span class="stat__k">Total dépensé</span>
          <span class="stat__v">{euros(total)}</span>
        </div>
        <div class="stat">
          <span class="stat__k">Panier moyen</span>
          <span class="stat__v">{nb ? euros(total / nb) : '—'}</span>
        </div>
        <div class="stat">
          <span class="stat__k">Dernière commande</span>
          <span class="stat__v stat__v--s">{derniereDate ? relatif(derniereDate) : 'Aucune'}</span>
        </div>
      </div>
      <div class="cols cols--main">
        <div class="stack">
          <Card titre="Commandes" icone="commandes" corps={false} sous={nb ? pluriel(nb, 'commande', 'commandes') : null}>
            {commandes.length === 0 ? (
              <Empty petit icone="commandes" titre="Aucune commande" texte="Ce client n’a pas encore commandé." />
            ) : (
              <div class="list">
                {commandes.map((x) => (
                  <Link key={x.id} class="list__item" href={`/crm/commandes/${x.id}`}>
                    <span class="list__ico">
                      <Icon name={CANAL[x.canal]?.icone || 'commandes'} size="s" />
                    </span>
                    <span class="list__main">
                      <span class="list__title">
                        <span class="mono">{x.numero}</span>
                      </span>
                      <span class="list__meta">
                        {date(x.date || x.createdAt)} · {CANAL[x.canal]?.label || x.canal}
                        {x.articles ? ` · ${pluriel(x.articles, 'article', 'articles')}` : ''}
                      </span>
                    </span>
                    <span class="list__end">
                      <span class="strong">{euros(x.totalTTC ?? x.totaux?.totalTTC)}</span>
                      <Statut table={COMMANDE} valeur={x.statut} />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
          {reservations.length > 0 && (
            <Card titre="Visites de la distillerie" icone="calendrier" corps={false} sous={pluriel(reservations.length, 'réservation', 'réservations')}>
              <div class="list">
                {reservations.map((x) => (
                  <Link key={x.id} class="list__item" href={`/crm/visites/${x.id}`}>
                    <span class="list__ico">
                      <Icon name="calendrier" size="s" />
                    </span>
                    <span class="list__main">
                      <span class="list__title">
                        {date(x.date)} · {heure(x.heure || (x.moment === 'matin' ? '10:30' : '15:00'))}
                      </span>
                      <span class="list__meta">
                        {pluriel(x.personnes, 'personne', 'personnes')} · <span class="mono">{x.reference}</span>
                      </span>
                    </span>
                    <span class="list__end">
                      <Statut table={RESERVATION} valeur={x.statut} />
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
          )}
          {messages.length > 0 && (
            <Card titre="Messages" icone="message" corps={false} sous={pluriel(messages.length, 'message', 'messages')}>
              <div class="list">
                {messages.map((x) => (
                  <Link key={x.id} class="list__item" href={`/crm/messages/${x.id}`}>
                    <span class="list__ico">
                      <Icon name="message" size="s" />
                    </span>
                    <span class="list__main">
                      <span class="list__title">{SUJET[x.sujet] || x.sujet || 'Message'}</span>
                      <span class="list__meta">
                        {date(x.dernierMessage || x.createdAt)} · <span class="mono">{x.reference}</span>
                      </span>
                    </span>
                    <span class="list__end">
                      <Statut table={MESSAGE} valeur={x.statut} />
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
          )}
          <NotesClient c={c} patch={patch} peutModifier={peutModifier} />
        </div>
        <div class="stack">
          <Card titre="Coordonnées" icone="client" actions={peutModifier && <button type="button" class="more" onClick={() => setEdition(true)}><Icon name="crayon" />Modifier</button>}>
            <div class="stack stack--s">
              <ul class="contact">
                <li>
                  <Icon name="mail" size="s" />
                  <a class="link link--ink" href={`mailto:${c.email}`}>
                    {c.email}
                  </a>
                </li>
                {c.telephone && (
                  <li>
                    <Icon name="telephone" size="s" />
                    <a class="link link--ink" href={`tel:${c.telephone.replace(/\s/g, '')}`}>
                      {telephone(c.telephone)}
                    </a>
                  </li>
                )}
                {c.adresse && (
                  <li style="align-items:flex-start">
                    <Icon name="pin" size="s" />
                    <span>{formatAdresse(c.adresse).join(', ')}</span>
                  </li>
                )}
              </ul>
            </div>
          </Card>
          <Card titre="Newsletter" icone="mail">
            <div class="stack stack--s">
              <Switch label={c.newsletter ? 'Inscrit à la lettre d’information' : 'Non inscrit'} checked={!!c.newsletter} disabled={!peutModifier} onChange={(e) => patch({ newsletter: e.currentTarget.checked }, e.currentTarget.checked ? 'Client inscrit à la newsletter' : 'Client désinscrit de la newsletter')} />
              {abonnement?.inscritLe && (
                <p class="small">
                  {abonnement.statut === 'desinscrit' && abonnement.desinscritLe ? `Désinscrit le ${date(abonnement.desinscritLe)}` : `Inscrit le ${date(abonnement.inscritLe)}`}
                  {abonnement.source ? ` · ${ABONNE_SOURCE[abonnement.source] || abonnement.source}` : ''}
                </p>
              )}
              <p class="small muted">Consentement explicite exigé (RGPD) : ne cochez qu’à la demande du client.</p>
            </div>
          </Card>
          <Tags c={c} patch={patch} peutModifier={peutModifier} />
          {peutModifier && <Card titre="Données personnelles" icone="cadenas" class="card--paper">
            <div class="stack stack--s">
              <p class="small muted">Le client peut demander une copie de ses données ou leur effacement.</p>
              <div class="btn-row">
                <Button size="sm" icon="telecharger" onClick={exporter}>
                  Exporter (JSON)
                </Button>
                <Button size="sm" variant="danger-soft" icon="corbeille" onClick={supprimer}>
                  Supprimer
                </Button>
              </div>
            </div>
          </Card>}
        </div>
      </div>
      {edition && (
        <DialogClient
          client={c}
          onClose={() => setEdition(false)}
          onFait={() => {
            setEdition(false);
            r.reload({ silencieux: true });
            invalider('clients');
          }}
        />
      )}
    </div>
  );
}

export function Tags({ c, patch, peutModifier, titre = 'Étiquettes' }) {
  const [v, setV] = useState('');
  const tags = c.tags || [];
  const ajouter = (e) => {
    e.preventDefault();
    const t = v.trim().replace(/\s+/g, ' ');
    if (!t || tags.includes(t)) return setV('');
    patch({ tags: [...tags, t] });
    setV('');
  };
  return (
    <Card titre={titre} icone="etiquette">
      <div class="stack stack--s">
        <div class="row row--wrap" style="gap:6px">
          {tags.length === 0 && <span class="small muted">Aucune étiquette.</span>}
          {tags.map((t) => (
            <span class="tag" key={t}>
              {t}
              {peutModifier && (
                <button type="button" aria-label={`Retirer l’étiquette ${t}`} onClick={() => patch({ tags: tags.filter((x) => x !== t) })}>
                  <Icon name="x" size="xs" />
                </button>
              )}
            </span>
          ))}
        </div>
        {peutModifier && (
          <form class="row" style="gap:8px" onSubmit={ajouter}>
            <input class="input input--sm" value={v} onInput={(e) => setV(e.currentTarget.value)} placeholder="Nouvelle étiquette" aria-label="Nouvelle étiquette" maxLength={30} />
            <Button size="sm" type="submit" icon="plus" disabled={!v.trim()}>
              Ajouter
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}

export function NotesClient({ c, patch, peutModifier, titre = 'Notes' }) {
  const [v, setV] = useState(c.notes || '');
  const [busy, setBusy] = useState(false);
  useEffect(() => setV(c.notes || ''), [c.notes]);
  const change = v !== (c.notes || '');
  return (
    <Card titre={titre} icone="note" sous="Visibles par l’équipe seulement">
      <div class="stack stack--s">
        <textarea class="textarea" aria-label={titre} value={v} onInput={(e) => setV(e.currentTarget.value)} disabled={!peutModifier} rows={4} placeholder="Goûts, habitudes, échanges…" />
        {peutModifier && (
          <div class="btn-row btn-row--end">
            {change && (
              <Button size="sm" variant="ghost" onClick={() => setV(c.notes || '')}>
                Annuler
              </Button>
            )}
            <Button
              size="sm"
              disabled={!change}
              busy={busy}
              onClick={async () => {
                setBusy(true);
                await patch({ notes: v }, 'Notes enregistrées');
                setBusy(false);
              }}
            >
              Enregistrer
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
