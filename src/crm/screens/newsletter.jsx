// Newsletter : abonnés (total, évolution, sources, liste cherchable, désinscription, suppression,
// export CSV) et campagnes (liste, rédaction avec aperçu fidèle, envoi simulé).
import { useEffect, useMemo, useState } from 'preact/hooks';
import { crm, crmUrl, elements, invalider, useCrm } from '../lib/data.js';
import { useFil, useSession } from '../lib/session.jsx';
import { Link, clicLigne, navigate, useQuery } from '../lib/router.jsx';
import { Icon } from '../ui/icons.jsx';
import { Button, Card, Empty, Erreur, Notice, PageHead, Pagination, Pill, SearchInput, Skeleton, SkeletonRows, Statut, TabPanel, Tabs, cx, useTitre } from '../ui/base.jsx';
import { Choices, Input, Textarea, erreurDe } from '../ui/form.jsx';
import { Menu, MenuItem, confirmer, toast } from '../ui/overlay.jsx';
import { Anneau, BasculeTableau, Courbe } from '../charts/charts.jsx';
import { ApercuCourriel } from '../ui/courriel.jsx';
import { COULEURS } from '../lib/liens.js';
import { ABONNE, ABONNE_SOURCE, CAMPAGNE, SEGMENT } from '../lib/statuts.js';
import { date, dateHeure, mois, moisCourt, nombre, pluriel, relatif } from '../lib/format.js';

const PAR = 20;

// Sources : objet { source: n } ou liste [{ source, n }]
function lireSources(ps) {
  if (!ps) return [];
  const l = Array.isArray(ps) ? ps.map((x) => [x.source || x.id || x.cle, x.n ?? x.total ?? x.valeur ?? 0]) : Object.entries(ps);
  const ordre = Object.keys(ABONNE_SOURCE);
  return l.sort((a, b) => ordre.indexOf(a[0]) - ordre.indexOf(b[0])).map(([k, n], i) => ({ cle: k, label: ABONNE_SOURCE[k] || k, valeur: Number(n) || 0, couleur: COULEURS.serie[i % COULEURS.serie.length] }));
}
function lireEvolution(ev) {
  return elements(ev).map((p) => ({ cle: p.mois || p.date || p.jour, valeur: Number(p.inscrits ?? p.total ?? p.n ?? p.valeur ?? 0), nouveaux: p.nouveaux }));
}
const etiquetteMois = (cle) => (/^\d{4}-\d{2}$/.test(cle) ? `${cle}-01` : cle);

export function Newsletter({ id }) {
  useTitre('Newsletter');
  const s = useSession();
  const [q, setQ] = useQuery();
  const onglet = q.get('onglet') || 'abonnes';
  const recherche = q.get('q') || '';
  const statut = q.get('statut') || '';
  const page = Number(q.get('page')) || 1;
  const r = useCrm('newsletter', { q: recherche, statut, page, par: PAR }, { garder: true });
  // Lien direct vers un abonné (/crm/newsletter/<id>, depuis le journal ou le site) : l'API n'a pas
  // de fiche abonné, on le cherche dans la liste puis on filtre sur son adresse.
  useEffect(() => {
    if (!id) return;
    if (id === 'campagnes') return navigate('/crm/newsletter?onglet=campagnes', { replace: true });
    let fini = false;
    (async () => {
      try {
        for (let p = 1, pages = 1; p <= pages && !fini; p++) {
          const d = await crm('newsletter', { query: { page: p, par: 100 } });
          const a = elements(d?.liste).find((x) => x.id === id);
          if (a) return navigate(`/crm/newsletter?q=${encodeURIComponent(a.email)}&abonne=${a.id}`, { replace: true });
          pages = d?.liste?.pages || 1;
        }
        if (!fini) {
          toast.info('Abonné introuvable', { detail: 'Il a pu être supprimé (RGPD).' });
          navigate('/crm/newsletter', { replace: true });
        }
      } catch (e) {
        if (!fini) navigate('/crm/newsletter', { replace: true });
      }
    })();
    return () => {
      fini = true;
    };
  }, [id]);
  const d = r.data;
  const peutModifier = s.peut('newsletter', 'ecriture');
  const campagnes = elements(d?.campagnes, 'campagnes');
  const ab = d?.abonnes || {};

  return (
    <div class="page">
      <PageHead
        titre="Newsletter"
        sous={d ? `${pluriel(ab.inscrits ?? 0, 'abonné inscrit', 'abonnés inscrits')} · ${pluriel(campagnes.length, 'campagne', 'campagnes')}` : 'La lettre d’information de la distillerie'}
        actions={
          <>
            {s.peut('exports') && (
              <Button href={crmUrl('export', { type: 'abonnes' })} target="_blank" download="" icon="telecharger">
                <span class="hide-s">Exporter</span>
              </Button>
            )}
            {peutModifier && (
              <Button variant="primary" icon="plus" href="/crm/newsletter/campagnes/nouvelle">
                Nouvelle campagne
              </Button>
            )}
          </>
        }
      />
      <Tabs
        label="Newsletter"
        items={[
          { id: 'abonnes', label: 'Abonnés', n: ab.inscrits },
          { id: 'campagnes', label: 'Campagnes', n: campagnes.length },
        ]}
        value={onglet}
        onChange={(v) => setQ({ onglet: v === 'abonnes' ? undefined : v })}
      />
      {r.error && !d && <Erreur erreur={r.error} onRetry={r.reload} />}
      {!d && !r.error && (
        <div class="stack">
          <div class="cols cols--3">
            <Skeleton class="skel--block" style="height:96px" />
            <Skeleton class="skel--block" style="height:96px" />
            <Skeleton class="skel--block" style="height:96px" />
          </div>
          <Skeleton class="skel--block" style="height:260px" />
        </div>
      )}
      {d && (
        <TabPanel id={onglet}>
          {onglet === 'abonnes' ? <Abonnes d={d} recherche={recherche} statut={statut} vise={q.get('abonne')} page={page} setQ={setQ} r={r} peutModifier={peutModifier} /> : <ListeCampagnes campagnes={campagnes} peutModifier={peutModifier} />}
        </TabPanel>
      )}
    </div>
  );
}

function Abonnes({ d, recherche, statut, vise, page, setQ, r, peutModifier }) {
  const ab = d.abonnes || {};
  const sources = lireSources(ab.parSource);
  const evolution = lireEvolution(ab.evolution);
  const [tableau, setTableau] = useState(false);
  const listeD = d.liste || {};
  const liste = elements(listeD, 'abonnes');
  const desinscrits = ab.desinscrits ?? Math.max(0, (ab.total ?? 0) - (ab.inscrits ?? 0));
  const dernier = evolution[evolution.length - 1];
  const nouveaux = dernier?.nouveaux ?? (evolution.length >= 2 ? dernier.valeur - evolution[evolution.length - 2].valeur : null);
  const totalSources = sources.reduce((t, x) => t + x.valeur, 0);
  useEffect(() => {
    if (!vise || !liste.length) return;
    const t = setTimeout(() => [...document.querySelectorAll('.is-visee')].find((e) => e.offsetParent)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 200);
    return () => clearTimeout(t);
  }, [vise, liste.length]);
  const premiere = sources.length ? [...sources].sort((a, b) => b.valeur - a.valeur)[0] : null;

  const desinscrire = async (a) => {
    r.mutate((x) => (x ? { ...x, liste: { ...x.liste, elements: elements(x.liste, 'abonnes').map((y) => (y.id === a.id ? { ...y, statut: 'desinscrit' } : y)) } } : x));
    try {
      await crm('abonne', { method: 'PATCH', query: { id: a.id }, body: { statut: 'desinscrit' } });
      toast(`${a.email} désinscrit`);
      r.reload({ silencieux: true });
    } catch (e) {
      r.reload({ silencieux: true });
      toast.erreur(e);
    }
  };
  const supprimer = async (a) => {
    const ok = await confirmer({
      titre: 'Supprimer cet abonné ?',
      message: `${a.email} est effacé définitivement de la liste (droit à l’effacement, RGPD).`,
      confirmer: 'Supprimer',
      danger: true,
      icone: 'corbeille',
      action: () => crm('abonne', { method: 'DELETE', query: { id: a.id } }),
    });
    if (ok) {
      toast('Abonné supprimé');
      r.reload({ silencieux: true });
    }
  };

  return (
    <div class="stack">
      <div class="stats-row">
        <div class="stat">
          <span class="stat__k">Abonnés inscrits</span>
          <span class="stat__v">{nombre(ab.inscrits ?? 0)}</span>
          {nouveaux !== null && dernier && (
            <span class="stat__s">
              {nouveaux >= 0 ? `+${nombre(nouveaux)}` : `−${nombre(-nouveaux)}`} {/^\d{4}-\d{2}$/.test(dernier.cle) ? `en ${mois(etiquetteMois(dernier.cle)).replace(/ \d{4}$/, '')}` : 'sur la dernière période'}
            </span>
          )}
        </div>
        <div class="stat">
          <span class="stat__k">Désinscrits</span>
          <span class="stat__v">{nombre(desinscrits)}</span>
          <span class="stat__s">sur {nombre(ab.total ?? 0)} adresses connues</span>
        </div>
        <div class="stat">
          <span class="stat__k">Première source</span>
          <span class="stat__v stat__v--s">{premiere ? premiere.label : '—'}</span>
          {premiere && totalSources > 0 && <span class="stat__s">{pluriel(premiere.valeur, 'abonné', 'abonnés')} · {Math.round((premiere.valeur / totalSources) * 100)} % des inscrits</span>}
        </div>
      </div>
      <div class="cols cols--main">
        <Card titre="Évolution des inscrits" sous="Abonnés inscrits, en fin de période" actions={<BasculeTableau actif={tableau} onChange={setTableau} />}>
          {evolution.length < 2 ? (
            <Empty petit icone="graphique" titre="Pas encore d’historique" />
          ) : tableau ? (
            <div class="chart-table-wrap">
              <table class="chart-table">
                <caption class="sr-only">Évolution des inscrits</caption>
                <thead>
                  <tr>
                    <th scope="col">Période</th>
                    <th scope="col">Inscrits</th>
                  </tr>
                </thead>
                <tbody>
                  {[...evolution].reverse().map((p) => (
                    <tr key={p.cle}>
                      <td>{/^\d{4}-\d{2}$/.test(p.cle) ? mois(etiquetteMois(p.cle)) : date(p.cle)}</td>
                      <td>{nombre(p.valeur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Courbe
              points={evolution}
              format={(v) => nombre(v)}
              etiquette={(p) => (/^\d{4}-\d{2}$/.test(p.cle) ? moisCourt(etiquetteMois(p.cle)) : date(p.cle).replace(/ \d{4}$/, ''))}
              etiquetteLongue={(p) => (/^\d{4}-\d{2}$/.test(p.cle) ? mois(etiquetteMois(p.cle)) : date(p.cle))}
              label="Abonnés inscrits"
              couleur={COULEURS.enLigne}
              hauteur={220}
            />
          )}
        </Card>
        <Card titre="D’où viennent les abonnés" sous="Inscrits par source">
          {sources.length === 0 ? (
            <Empty petit icone="graphique" titre="Aucune source" />
          ) : (
            <Anneau items={sources} centre={nombre(sources.reduce((t, x) => t + x.valeur, 0))} sousCentre="abonnés" label={`Répartition des abonnés par source : ${sources.map((x) => `${x.label} ${x.valeur}`).join(', ')}`} />
          )}
        </Card>
      </div>
      <Card
        titre="Abonnés"
        corps={false}
        actions={
          <div class="card-filtres">
            <select class="select select--sm" aria-label="Statut" value={statut} onChange={(e) => setQ({ statut: e.currentTarget.value || undefined, page: undefined, abonne: undefined })}>
              <option value="">Tous les statuts</option>
              <option value="inscrit">Inscrits</option>
              <option value="desinscrit">Désinscrits</option>
            </select>
            <SearchInput value={recherche} onChange={(v) => setQ({ q: v, page: undefined, abonne: undefined })} placeholder="Rechercher une adresse" label="Rechercher un abonné" class="card-search" />
          </div>
        }
      >
        {liste.length === 0 ? (
          <Empty petit icone="mail" titre={recherche || statut ? 'Aucun abonné trouvé' : 'Aucun abonné'} />
        ) : (
          <div class={r.refreshing ? 'refreshing' : ''}>
            <div class="tbl-wrap only-desk">
              <table class="tbl">
                <caption class="sr-only">Abonnés</caption>
                <thead>
                  <tr>
                    <th>Adresse</th>
                    <th>Source</th>
                    <th>Inscription</th>
                    <th>Statut</th>
                    <th class="w-actions">
                      <span class="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {liste.map((a) => (
                    <tr key={a.id} class={a.id === vise ? 'is-visee' : undefined}>
                      <td>
                        <span class="strong">{a.email}</span>
                        {a.prenom && <span class="tbl__sub">{a.prenom}</span>}
                      </td>
                      <td>{ABONNE_SOURCE[a.source] || a.source}</td>
                      <td>
                        {date(a.inscritLe)}
                        {a.desinscritLe && <span class="tbl__sub">désinscrit le {date(a.desinscritLe)}</span>}
                      </td>
                      <td>
                        <Statut table={ABONNE} valeur={a.statut} />
                      </td>
                      <td class="w-actions">{peutModifier && <ActionsAbonne a={a} desinscrire={desinscrire} supprimer={supprimer} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div class="list only-mob">
              {liste.map((a) => (
                <div class={cx('list__item', a.id === vise && 'is-visee')} key={a.id}>
                  <span class="list__main">
                    <span class="list__title">{a.email}</span>
                    <span class="list__meta">
                      {ABONNE_SOURCE[a.source] || a.source} · {date(a.inscritLe)}
                    </span>
                  </span>
                  <Statut table={ABONNE} valeur={a.statut} />
                  {peutModifier && <ActionsAbonne a={a} desinscrire={desinscrire} supprimer={supprimer} />}
                </div>
              ))}
            </div>
            <Pagination page={listeD.page || page} pages={listeD.pages || 1} total={listeD.total} par={PAR} onPage={(p) => setQ({ page: p > 1 ? p : undefined }, { replace: false })} unite={['abonné', 'abonnés']} />
          </div>
        )}
      </Card>
    </div>
  );
}

function ActionsAbonne({ a, desinscrire, supprimer }) {
  return (
    <Menu label={`Actions pour ${a.email}`} bouton={(p) => <Button size="sm" variant="ghost" icon="points" aria-label={`Actions pour ${a.email}`} {...p} />}>
      {(fermer) => (
        <>
          {a.statut !== 'desinscrit' && (
            <MenuItem icone="interdit" fermer={fermer} onSelect={() => desinscrire(a)}>
              Désinscrire
            </MenuItem>
          )}
          <MenuItem icone="corbeille" danger fermer={fermer} onSelect={() => supprimer(a)} desc="Effacement définitif (RGPD)">
            Supprimer
          </MenuItem>
        </>
      )}
    </Menu>
  );
}

function ListeCampagnes({ campagnes, peutModifier }) {
  const tri = [...campagnes].sort((a, b) => ((b.envoyeeLe || b.createdAt) > (a.envoyeeLe || a.createdAt) ? 1 : -1));
  if (!tri.length) {
    return (
      <div class="card">
        <Empty icone="send" titre="Aucune campagne" texte="Rédigez une lettre, choisissez un segment, vérifiez l’aperçu, puis envoyez-la (en simulation)." action={peutModifier && <Button variant="primary" icon="plus" href="/crm/newsletter/campagnes/nouvelle">Nouvelle campagne</Button>} />
      </div>
    );
  }
  return (
    <div class="campagnes">
      {tri.map((c) => (
        <Link key={c.id} class="card campagne" href={`/crm/newsletter/campagnes/${c.id}`}>
          <div class="campagne__top">
            <Statut table={CAMPAGNE} valeur={c.statut} />
            <span class="small muted">{SEGMENT[c.segment]?.court || c.segment}</span>
          </div>
          <h3 class="campagne__objet">{c.objet || 'Sans objet'}</h3>
          <p class="campagne__intro">{c.introduction}</p>
          <div class="campagne__bas small muted">
            {c.statut === 'envoyee' ? (
              <>
                <span>Envoyée le {date(c.envoyeeLe)}</span>
                <span class="strong" style="color:var(--ink)">
                  {pluriel(c.destinataires || 0, 'destinataire', 'destinataires')}
                </span>
              </>
            ) : (
              <span>Brouillon modifié {relatif(c.updatedAt || c.createdAt)}</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

// ---------- Rédaction d'une campagne ----------
const vide = { objet: '', introduction: '', corps: '', boutonLibelle: '', boutonUrl: '', segment: 'tous' };
export function contenuCampagne(f) {
  const paragraphes = [f.introduction, ...String(f.corps || '').split(/\n{2,}/)].map((p) => p.trim()).filter(Boolean);
  return {
    titre: f.objet || 'Objet de la lettre',
    paragraphes: paragraphes.length ? paragraphes : ['Votre texte apparaîtra ici.'],
    bouton: f.boutonLibelle ? { libelle: f.boutonLibelle, url: f.boutonUrl || '#' } : undefined,
  };
}

export function Campagne({ id }) {
  const s = useSession();
  const nouvelle = id === 'nouvelle';
  const r = useCrm('newsletter', {});
  const campagne = elements(r.data?.campagnes, 'campagnes').find((c) => c.id === id);
  useTitre(nouvelle ? 'Nouvelle campagne' : campagne?.objet || 'Campagne');
  useFil(nouvelle ? 'Nouvelle campagne' : campagne?.objet);
  const [f, setF] = useState(vide);
  const [charge, setCharge] = useState(nouvelle);
  const [vue, setVue] = useState('rediger');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(null);
  const [resultat, setResultat] = useState(null);
  const peutModifier = s.peut('newsletter', 'ecriture');
  useEffect(() => {
    if (campagne && !charge) {
      setF({ objet: campagne.objet || '', introduction: campagne.introduction || '', corps: campagne.corps || '', boutonLibelle: campagne.bouton?.libelle || '', boutonUrl: campagne.bouton?.url || '', segment: campagne.segment || 'tous' });
      setCharge(true);
    }
  }, [campagne?.id]);

  const envoyee = campagne?.statut === 'envoyee';
  const lecture = envoyee || !peutModifier;
  const segments = r.data?.segments || r.data?.abonnes?.parSegment || {};
  const maj = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  const corpsApi = () => ({
    objet: f.objet.trim(),
    introduction: f.introduction.trim(),
    corps: f.corps.trim(),
    bouton: f.boutonLibelle.trim() ? { libelle: f.boutonLibelle.trim(), url: f.boutonUrl.trim() || 'https://www.distillerieablachere.com/' } : null,
    segment: f.segment,
  });
  const change = !campagne || JSON.stringify(corpsApi()) !== JSON.stringify({ objet: campagne.objet || '', introduction: campagne.introduction || '', corps: campagne.corps || '', bouton: campagne.bouton?.libelle ? { libelle: campagne.bouton.libelle, url: campagne.bouton.url } : null, segment: campagne.segment || 'tous' });

  const verifier = () => {
    if (f.objet.trim().length < 3) return { champ: 'objet', message: 'Donnez un objet à la lettre.' };
    if (f.introduction.trim().length < 3) return { champ: 'introduction', message: 'Écrivez une introduction.' };
    return null;
  };
  const enregistrer = async ({ silencieux = false } = {}) => {
    const e = verifier();
    if (e) {
      setErr(e);
      throw e;
    }
    setErr(null);
    const body = corpsApi();
    const d = nouvelle ? await crm('campagne', { method: 'POST', body }) : await crm('campagne', { method: 'PATCH', query: { id }, body });
    const c = d?.campagne || d;
    invalider('newsletter');
    if (!silencieux) toast('Brouillon enregistré');
    if (nouvelle && c?.id) navigate(`/crm/newsletter/campagnes/${c.id}`, { replace: true });
    return c;
  };
  const sauver = async () => {
    setBusy('sauver');
    try {
      await enregistrer();
    } catch (e) {
      if (e.status) setErr(e);
    } finally {
      setBusy(null);
    }
  };
  const envoyer = async () => {
    const e = verifier();
    if (e) return setErr(e);
    const nb = segments[f.segment];
    const ok = await confirmer({
      titre: 'Envoyer la campagne ?',
      message: `« ${f.objet.trim()} » partira vers le segment ${SEGMENT[f.segment].label.toLowerCase()}${nb ? ` (${pluriel(nb, 'destinataire', 'destinataires')})` : ''}. Démonstration : aucun courriel ne part réellement, un exemplaire est rangé dans les courriels envoyés.`,
      confirmer: 'Envoyer (simulation)',
      icone: 'send',
      iconeTon: 'pac',
      action: async () => {
        const c = change || nouvelle ? await enregistrer({ silencieux: true }) : campagne;
        return crm('campagne-envoyer', { method: 'POST', query: { id: c?.id || id } });
      },
    });
    if (ok) {
      const res = ok === true ? {} : ok;
      setResultat(res);
      invalider('newsletter', 'courriels');
      toast(`Campagne envoyée à ${pluriel(res.destinataires ?? res.campagne?.destinataires ?? 0, 'destinataire', 'destinataires')}`, { detail: 'Simulation : un exemplaire est dans « Courriels envoyés ».', action: { label: 'Voir', href: '/crm/courriels' } });
      r.reload({ silencieux: true });
    }
  };
  const supprimer = async () => {
    const ok = await confirmer({ titre: 'Supprimer ce brouillon ?', message: 'Il sera effacé définitivement.', confirmer: 'Supprimer', danger: true, icone: 'corbeille', action: () => crm('campagne', { method: 'DELETE', query: { id } }) });
    if (ok) {
      invalider('newsletter');
      toast('Brouillon supprimé');
      navigate('/crm/newsletter?onglet=campagnes', { replace: true });
    }
  };

  if (!nouvelle && r.data && !campagne) {
    return (
      <div class="page">
        <PageHead titre="Campagne" retour={{ href: '/crm/newsletter?onglet=campagnes', label: 'Campagnes' }} />
        <Empty icone="send" titre="Campagne introuvable" action={<Button href="/crm/newsletter?onglet=campagnes">Toutes les campagnes</Button>} />
      </div>
    );
  }
  if (r.error && !r.data) {
    return (
      <div class="page">
        <PageHead titre="Campagne" retour={{ href: '/crm/newsletter?onglet=campagnes', label: 'Campagnes' }} />
        <Erreur erreur={r.error} onRetry={r.reload} />
      </div>
    );
  }
  const apercu = { objet: f.objet || 'Objet de la lettre', a: SEGMENT[f.segment]?.label || 'Abonnés', type: 'campagne', contenu: contenuCampagne(f), date: envoyee ? campagne.envoyeeLe : undefined };

  return (
    <div class="page">
      <PageHead
        titre={nouvelle ? 'Nouvelle campagne' : campagne?.objet || 'Campagne'}
        retour={{ href: '/crm/newsletter?onglet=campagnes', label: 'Campagnes' }}
        sous={
          envoyee ? (
            <>
              <Statut table={CAMPAGNE} valeur="envoyee" /> Envoyée le {dateHeure(campagne.envoyeeLe)} à {pluriel(campagne.destinataires || 0, 'destinataire', 'destinataires')} (simulation)
            </>
          ) : (
            <>
              <Statut table={CAMPAGNE} valeur="brouillon" /> {campagne ? `Modifié ${relatif(campagne.updatedAt || campagne.createdAt)}` : 'Non enregistré'}
            </>
          )
        }
        actions={
          !lecture && (
            <>
              {!nouvelle && (
                <Button variant="danger-soft" icon="corbeille" onClick={supprimer}>
                  <span class="hide-s">Supprimer</span>
                </Button>
              )}
              <Button icon="check" busy={busy === 'sauver'} disabled={!change && !nouvelle} onClick={sauver}>
                Enregistrer
              </Button>
              <Button variant="primary" icon="send" onClick={envoyer}>
                Envoyer (simulation)
              </Button>
            </>
          )
        }
        actionsMobiles={false}
      />
      {resultat && (
        <Notice ton="ok" class="mb">
          <strong>Campagne envoyée</strong> à {pluriel(resultat.destinataires ?? resultat.campagne?.destinataires ?? campagne?.destinataires ?? 0, 'destinataire', 'destinataires')} (simulation).{' '}
          <Link class="link" href={resultat.courriel?.id ? `/crm/courriels/${resultat.courriel.id}` : '/crm/courriels'}>
            Voir l’exemplaire envoyé
          </Link>
        </Notice>
      )}
      <div class="seg only-mob-flex mb" role="tablist" aria-label="Vue">
        <button type="button" role="tab" aria-selected={vue === 'rediger' ? 'true' : 'false'} onClick={() => setVue('rediger')}>
          <Icon name="crayon" size="s" />
          {lecture ? 'Contenu' : 'Rédiger'}
        </button>
        <button type="button" role="tab" aria-selected={vue === 'apercu' ? 'true' : 'false'} onClick={() => setVue('apercu')}>
          <Icon name="oeil" size="s" />
          Aperçu
        </button>
      </div>
      <div class={cx('composer', `composer--${vue}`)}>
        <div class="composer__form stack">
          <Card titre="Contenu" icone="crayon">
            <div class="form">
              <Input label="Objet" value={f.objet} onInput={maj('objet')} disabled={lecture} error={erreurDe(err, 'objet')} maxLength={120} help={`${f.objet.length} / 120 · c’est aussi le titre de la lettre`} />
              <Textarea label="Introduction" value={f.introduction} onInput={maj('introduction')} disabled={lecture} rows={3} error={erreurDe(err, 'introduction')} placeholder="Quelques mots d’accueil…" />
              <Textarea label="Corps" value={f.corps} onInput={maj('corps')} disabled={lecture} rows={8} error={erreurDe(err, 'corps')} help="Une ligne vide sépare les paragraphes." placeholder="Les nouveautés, la recette du mois, les dates de visite…" />
              <div class="form-grid">
                <Input label="Bouton" opt value={f.boutonLibelle} onInput={maj('boutonLibelle')} disabled={lecture} placeholder="Découvrir" maxLength={40} />
                <Input label="Lien du bouton" opt type="url" value={f.boutonUrl} onInput={maj('boutonUrl')} disabled={lecture} placeholder="https://…" error={erreurDe(err, 'bouton', 'url')} />
              </div>
            </div>
          </Card>
          <Card titre="Destinataires" icone="equipe">
            <Choices
              name="segment"
              value={f.segment}
              onChange={(v) => !lecture && setF({ ...f, segment: v })}
              items={Object.entries(SEGMENT).map(([k, x]) => ({ value: k, titre: x.court, desc: `${x.label}${segments[k] !== undefined ? ` · ${pluriel(segments[k], 'adresse', 'adresses')}` : ''}` }))}
            />
            {err && !erreurDe(err, 'objet', 'introduction', 'corps', 'bouton', 'url') && (
              <Notice ton="err" class="mt">
                {err.message}
              </Notice>
            )}
          </Card>
        </div>
        <div class="composer__apercu">
          <div class="composer__sticky">
            <p class="eyebrow composer__label">
              <Icon name="oeil" size="s" />
              Aperçu du courriel
            </p>
            <ApercuCourriel courriel={apercu} campagne />
          </div>
        </div>
      </div>
      {!lecture && (
        <div class="dock">
          <Button icon="check" busy={busy === 'sauver'} disabled={!change && !nouvelle} onClick={sauver}>
            Enregistrer
          </Button>
          <Button variant="primary" icon="send" onClick={envoyer}>
            Envoyer
          </Button>
        </div>
      )}
      {charge === false && !nouvelle && <SkeletonRows />}
    </div>
  );
}

export { Pill, clicLigne };
