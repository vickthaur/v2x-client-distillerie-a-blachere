// Commandes : filtres par statut (avec compteurs), canal, période et recherche synchronisés avec
// l'adresse ; tri ; actions groupées ; cartes sur téléphone.
import { useMemo, useState } from 'preact/hooks';
import { crm, crmUrl, invalider, useCrm } from '../lib/data.js';
import { useSession } from '../lib/session.jsx';
import { Link, clicLigne, useQuery } from '../lib/router.jsx';
import { Icon } from '../ui/icons.jsx';
import { Button, Chips, Empty, Erreur, PageHead, Pagination, Pill, SearchInput, SkeletonRows, SortTh, Statut, useTitre } from '../ui/base.jsx';
import { Check } from '../ui/form.jsx';
import { Menu, MenuItem, confirmer, toast } from '../ui/overlay.jsx';
import { Ruban } from '../ui/ruban.jsx';
import { CANAL, COMMANDE, ORDRE_COMMANDE, PAIEMENT_STATUT, TRANSITION } from '../lib/statuts.js';
import { ajouterJours, aujourdHui, date, euros, heure, nombre, pluriel } from '../lib/format.js';

const PAR = 25;
// Machine à états (docs § 5) : transitions possibles, pour les actions groupées
export const SUITES = {
  nouvelle: ['en-preparation', 'annulee'],
  'en-preparation': ['expediee', 'prete', 'annulee'],
  prete: ['retiree', 'annulee'],
  expediee: ['livree', 'remboursee'],
  livree: ['remboursee'],
  retiree: ['remboursee'],
  annulee: [],
  remboursee: [],
};
const GROUPEES = ['en-preparation', 'prete', 'livree', 'retiree', 'annulee'];

const PERIODES = [
  { id: '', label: 'Toutes les dates' },
  { id: 'jour', label: 'Aujourd’hui' },
  { id: '7j', label: '7 derniers jours' },
  { id: '30j', label: '30 derniers jours' },
  { id: '90j', label: '90 derniers jours' },
  { id: 'annee', label: 'Cette année' },
  { id: 'perso', label: 'Dates précises…' },
];
function bornes(periode, du, au) {
  const j = aujourdHui();
  switch (periode) {
    case 'jour':
      return { du: j, au: j };
    case '7j':
      return { du: ajouterJours(j, -6), au: j };
    case '30j':
      return { du: ajouterJours(j, -29), au: j };
    case '90j':
      return { du: ajouterJours(j, -89), au: j };
    case 'annee':
      return { du: `${j.slice(0, 4)}-01-01`, au: j };
    default:
      return { du: du || undefined, au: au || undefined };
  }
}

export function paiementDe(c) {
  const p = c.paiement;
  if (!p) return null;
  return typeof p === 'string' ? p : p.statut;
}

export function Commandes() {
  useTitre('Commandes');
  const s = useSession();
  const [q, setQ] = useQuery();
  const statut = q.get('statut') || '';
  const canal = q.get('canal') || '';
  const recherche = q.get('q') || '';
  const page = Number(q.get('page')) || 1;
  const tri = q.get('tri') || '-date';
  const duQ = q.get('du') || '';
  const auQ = q.get('au') || '';
  const periode = q.get('periode') || (duQ || auQ ? 'perso' : '');
  const { du, au } = bornes(periode, duQ, auQ);
  const query = { statut, canal, q: recherche, page, par: PAR, tri, du, au };
  const r = useCrm('commandes', query, { garder: true });
  const d = r.data;
  const liste = d?.elements || [];
  const compteurs = d?.compteurs || {};
  const [sel, setSel] = useState(() => new Set());
  const [modeSel, setModeSel] = useState(false);
  const peutModifier = s.peut('commandes', 'ecriture') || s.peut('commandes-pro', 'ecriture');

  const totalTous = compteurs.toutes ?? compteurs.tous ?? Object.entries(compteurs).reduce((t, [k, v]) => (COMMANDE[k] ? t + (v || 0) : t), 0);
  const chips = [{ id: '', label: 'Toutes', n: totalTous || undefined }, ...ORDRE_COMMANDE.map((k) => ({ id: k, label: COMMANDE[k].court || COMMANDE[k].label, n: compteurs[k] ?? 0 }))];

  const changer = (patch) => {
    setSel(new Set());
    setQ({ page: undefined, ...patch });
  };

  // Transitions communes à la sélection
  const choisis = liste.filter((c) => sel.has(c.id));
  const communes = GROUPEES.filter((t) => choisis.length && choisis.every((c) => (SUITES[c.statut] || []).includes(t)));

  const appliquer = async (cible) => {
    const ids = [...sel];
    const lancer = async () => {
      const avant = r.data;
      r.mutate((x) => (x ? { ...x, elements: x.elements.map((c) => (sel.has(c.id) ? { ...c, statut: cible } : c)) } : x));
      try {
        const res = await crm('commandes-statut', { method: 'POST', body: { ids, statut: cible } });
        const echecs = res?.erreurs || res?.echecs || [];
        const reussis = Array.isArray(res?.ok) ? res.ok.length : res?.modifiees ?? ids.length - echecs.length;
        if (echecs.length) {
          toast(`${pluriel(reussis, 'commande modifiée', 'commandes modifiées')}, ${pluriel(echecs.length, 'refusée', 'refusées')}`, { ton: 'err', detail: echecs[0]?.erreur || echecs[0]?.message, duree: 9000 });
        } else {
          toast(`${pluriel(reussis, 'commande', 'commandes')} : ${COMMANDE[cible].label.toLowerCase()}`);
        }
        setSel(new Set());
        setModeSel(false);
        invalider('commandes', 'tableau', 'commande?');
      } catch (e) {
        r.mutate(avant);
        toast.erreur(e);
      }
    };
    if (cible === 'annulee') {
      await confirmer({
        titre: `Annuler ${pluriel(ids.length, 'commande', 'commandes')} ?`,
        message: 'Les produits reviennent en stock et les commandes payées sont remboursées. Chaque client reçoit un courriel.',
        confirmer: 'Annuler les commandes',
        annuler: 'Garder',
        danger: true,
        action: lancer,
      });
    } else await lancer();
  };

  const exporter = crmUrl('export', { type: 'commandes', statut, canal, du, au, q: recherche });
  const tout = liste.length > 0 && liste.every((c) => sel.has(c.id));
  const basculer = (id) => {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSel(n);
  };

  return (
    <div class="page">
      <PageHead
        titre="Commandes"
        sous={d ? `${pluriel(d.total || 0, 'commande', 'commandes')}${statut ? ` · ${COMMANDE[statut]?.label.toLowerCase()}` : ''}` : 'Boutique en ligne, comptes pro et téléphone'}
        actions={
          <>
            {s.peut('exports') && (
              <Button href={exporter} icon="telecharger" target="_blank" download="">
                <span class="hide-s">Exporter</span>
              </Button>
            )}
            {peutModifier && (
              <Button href="/crm/commandes/nouvelle" variant="primary" icon="plus">
                Nouvelle commande
              </Button>
            )}
          </>
        }
      />

      <Chips label="Filtrer par statut" items={chips} value={statut} onChange={(v) => changer({ statut: v })} />

      <div class="toolbar">
        <SearchInput class="toolbar__search" value={recherche} onChange={(v) => changer({ q: v })} placeholder="Numéro, client, e-mail…" label="Rechercher une commande" />
        <div class="seg only-desk-flex" role="group" aria-label="Canal">
          {[['', 'Tous'], ['en-ligne', 'En ligne'], ['pro', 'Pro'], ['telephone', 'Téléphone']].map(([id, l]) => (
            <button key={id} type="button" aria-pressed={canal === id ? 'true' : 'false'} onClick={() => changer({ canal: id })}>
              {l}
            </button>
          ))}
        </div>
        <select class="select select--sm only-mob" style="width:auto" aria-label="Canal" value={canal} onChange={(e) => changer({ canal: e.currentTarget.value })}>
          <option value="">Tous les canaux</option>
          <option value="en-ligne">En ligne</option>
          <option value="pro">Pro</option>
          <option value="telephone">Téléphone</option>
        </select>
        <select class="select select--sm" style="width:auto" aria-label="Période" value={periode} onChange={(e) => changer({ periode: e.currentTarget.value, du: undefined, au: undefined })}>
          {PERIODES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {periode === 'perso' && (
          <div class="row" style="gap:6px">
            <input type="date" class="input input--sm" style="width:auto" aria-label="Du" value={duQ} onChange={(e) => changer({ du: e.currentTarget.value })} />
            <span class="muted">→</span>
            <input type="date" class="input input--sm" style="width:auto" aria-label="Au" value={auQ} onChange={(e) => changer({ au: e.currentTarget.value })} />
          </div>
        )}
        {peutModifier && liste.length > 0 && (
          <Button size="sm" class="only-mob-inline" variant={modeSel ? 'primary' : undefined} icon="check" aria-pressed={modeSel ? 'true' : 'false'} aria-label={modeSel ? 'Terminer la sélection' : 'Sélectionner des commandes'} onClick={() => { setModeSel(!modeSel); setSel(new Set()); }}>
            {modeSel ? 'Terminer' : null}
          </Button>
        )}
      </div>

      {r.error && !d && <Erreur erreur={r.error} onRetry={r.reload} />}

      <div class={r.refreshing ? 'refreshing' : ''}>
        {!d && !r.error && (
          <div class="card">
            <SkeletonRows n={8} cols={6} />
          </div>
        )}
        {d && liste.length === 0 && (
          <div class="card">
            <Empty
              icone="commandes"
              titre={recherche || statut || canal || periode ? 'Aucune commande ne correspond' : 'Aucune commande pour l’instant'}
              texte={recherche || statut || canal || periode ? 'Essayez d’élargir les filtres ou la période.' : 'Les commandes passées sur le site, dans l’espace pro ou saisies ici apparaîtront dans cette liste.'}
              action={(recherche || statut || canal || periode) && <Button onClick={() => changer({ statut: '', canal: '', q: '', periode: '', du: undefined, au: undefined })}>Effacer les filtres</Button>}
            />
          </div>
        )}
        {d && liste.length > 0 && (
          <>
            <div class="card only-desk">
              <div class="tbl-wrap">
                <table class="tbl">
                  <caption class="sr-only">Liste des commandes</caption>
                  <thead>
                    <tr>
                      {peutModifier && (
                        <th class="w-check">
                          <Check aria-label="Tout sélectionner" checked={tout} indeterminate={sel.size > 0 && !tout} onChange={() => setSel(tout ? new Set() : new Set(liste.map((c) => c.id)))} label={null} />
                        </th>
                      )}
                      <th>Commande</th>
                      <SortTh id="date" tri={tri} onTri={(t) => changer({ tri: t })}>
                        Date
                      </SortTh>
                      <th>Client</th>
                      <th>Canal</th>
                      <th class="num">Articles</th>
                      <SortTh id="total" tri={tri} onTri={(t) => changer({ tri: t })} class="num">
                        Total TTC
                      </SortTh>
                      <th>Paiement</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liste.map((c) => {
                      const href = `/crm/commandes/${c.id}`;
                      const p = paiementDe(c);
                      return (
                        <tr key={c.id} data-href={href} onClick={clicLigne(href)} aria-selected={sel.has(c.id) ? 'true' : undefined}>
                          {peutModifier && (
                            <td class="w-check">
                              <Check aria-label={`Sélectionner ${c.numero}`} checked={sel.has(c.id)} onChange={() => basculer(c.id)} label={null} />
                            </td>
                          )}
                          <td>
                            <span class="row" style="gap:6px">
                              <Link class="tbl__main mono" href={href}>
                                {c.numero}
                              </Link>
                              {c.operation && (
                                <span class="op-badge" title={`${c.operation.nom || 'Octobre Rose'} : ${euros(c.operation.montant)} reversé${c.operation.montant > 1 ? 's' : ''}`}>
                                  <Ruban titre={`${c.operation.nom || 'Octobre Rose'}`} />
                                </span>
                              )}
                              {c.alerte && (
                                <span class="alerte-ico" title={typeof c.alerte === 'string' ? c.alerte : c.alerte.message}>
                                  <Icon name="alerte" size="xs" title={typeof c.alerte === 'string' ? c.alerte : c.alerte.message} />
                                </span>
                              )}
                            </span>
                          </td>
                          <td class="nowrap">
                            {date(c.date || c.createdAt)}
                            <span class="tbl__sub">{heure(c.date || c.createdAt)}</span>
                          </td>
                          <td>
                            <span class="strong">{c.client?.nom || c.contact?.nom || '—'}</span>
                            {c.client?.type && <span class="tbl__sub">{c.client.type === 'pro' ? 'Compte pro' : c.client.type === 'particulier' ? 'Particulier' : c.client.type}</span>}
                          </td>
                          <td>
                            <span class="canal">
                              <Icon name={CANAL[c.canal]?.icone || 'globe'} size="xs" />
                              {CANAL[c.canal]?.label || c.canal}
                            </span>
                          </td>
                          <td class="num">{nombre(c.articles)}</td>
                          <td class="num strong">{euros(c.totalTTC)}</td>
                          <td>{p && <Statut table={PAIEMENT_STATUT} valeur={p} />}</td>
                          <td>
                            <Statut table={COMMANDE} valeur={c.statut} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={d.page || page} pages={d.pages || 1} total={d.total} par={PAR} onPage={(p) => setQ({ page: p > 1 ? p : undefined }, { replace: false })} unite={['commande', 'commandes']} />
            </div>

            <div class="mcards only-mob">
              {liste.map((c) => {
                const href = `/crm/commandes/${c.id}`;
                const p = paiementDe(c);
                const contenu = (
                  <>
                    <div class="mcard__top">
                      <span class="mcard__title mono">
                        {c.numero}
                        {c.operation && <Ruban class="ruban ruban--inline" titre="Octobre Rose" />}
                      </span>
                      <Statut table={COMMANDE} valeur={c.statut} />
                    </div>
                    <div class="mcard__meta">
                      <span class="strong" style="color:var(--ink)">{c.client?.nom || c.contact?.nom || '—'}</span>
                      <span class="mcard__amount">{euros(c.totalTTC)}</span>
                    </div>
                    <div class="mcard__meta">
                      <span>
                        {CANAL[c.canal]?.label || c.canal} · {date(c.date || c.createdAt)} · {pluriel(c.articles || 0, 'article', 'articles')}
                      </span>
                      {p && p !== 'paye' && <Statut table={PAIEMENT_STATUT} valeur={p} />}
                    </div>
                  </>
                );
                return modeSel ? (
                  <label key={c.id} class="mcard mcard--check" aria-selected={sel.has(c.id) ? 'true' : undefined}>
                    <span class="check">
                      <input type="checkbox" checked={sel.has(c.id)} onChange={() => basculer(c.id)} aria-label={`Sélectionner ${c.numero}`} />
                    </span>
                    {contenu}
                  </label>
                ) : (
                  <Link key={c.id} class="mcard" href={href}>
                    {contenu}
                  </Link>
                );
              })}
              <Pagination page={d.page || page} pages={d.pages || 1} total={d.total} par={PAR} onPage={(p) => setQ({ page: p > 1 ? p : undefined }, { replace: false })} unite={['commande', 'commandes']} />
            </div>
          </>
        )}
      </div>

      {sel.size > 0 && (
        <div class="bulk" role="region" aria-label="Actions sur la sélection">
          <span class="bulk__n">{pluriel(sel.size, 'sélectionnée', 'sélectionnées')}</span>
          {communes.length === 0 && <span class="small" style="opacity:.75">Aucune action commune à ces statuts</span>}
          {communes
            .filter((t) => t !== 'annulee')
            .slice(0, 2)
            .map((t) => (
              <Button key={t} size="sm" class="btn--light" icon={TRANSITION[t].icone} onClick={() => appliquer(t)}>
                {TRANSITION[t].label}
              </Button>
            ))}
          {communes.includes('annulee') && (
            <Menu
              label="Autres actions"
              haut
              bouton={(props) => <Button size="sm" icon="points" aria-label="Autres actions" {...props} />}
            >
              {(fermer) => (
                <>
                  {communes
                    .filter((t) => t !== 'annulee')
                    .slice(2)
                    .map((t) => (
                      <MenuItem key={t} icone={TRANSITION[t].icone} fermer={fermer} onSelect={() => appliquer(t)}>
                        {TRANSITION[t].label}
                      </MenuItem>
                    ))}
                  <MenuItem icone="x" danger fermer={fermer} onSelect={() => appliquer('annulee')}>
                    Annuler les commandes
                  </MenuItem>
                </>
              )}
            </Menu>
          )}
          <Button size="sm" variant="ghost" icon="x" aria-label="Vider la sélection" onClick={() => setSel(new Set())} style="color:#fff" />
        </div>
      )}
    </div>
  );
}

export { Pill };
