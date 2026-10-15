// Visites de la distillerie : semaine en grille sur ordinateur, liste du jour sur téléphone ;
// séances avec jauge (inscrits / capacité), ouverture et fermeture, capacité, guide et notes ;
// réservations de la séance (venue, absente, annulée), réservation manuelle, feuille d'émargement.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { crm, crmUrl, elements, invalider, useCrm } from '../lib/data.js';
import { useSession } from '../lib/session.jsx';
import { navigate, useQuery } from '../lib/router.jsx';
import { Icon } from '../ui/icons.jsx';
import { Avatar, Button, Empty, Erreur, Notice, PageHead, Pill, Skeleton, Statut, cx, useTitre, coupe } from '../ui/base.jsx';
import { Check, Input, Select, Stepper, Switch, Textarea, erreurDe } from '../ui/form.jsx';
import { Dialog, Drawer, Menu, MenuItem, toast } from '../ui/overlay.jsx';
import { Jauge, JaugeRonde } from '../charts/charts.jsx';
import { LANGUE, LANGUE_COURT, MOMENT, RESERVATION, RESERVATION_SOURCE } from '../lib/statuts.js';
import { ajouterJours, aujourdHui, date, dateCourte, heure, jourCourt, jourDeSemaine, jourSemaine, lundi, nombre, nomComplet, pluriel, relatif, telephone, typo } from '../lib/format.js';
import { useMembres } from './comptes.jsx';

const MOMENTS = ['matin', 'apres-midi'];
const HEURES = { matin: '10:30', 'apres-midi': '15:00' };
const actives = (rs) => rs.filter((x) => x.statut !== 'annulee');
const personnes = (rs) => actives(rs).reduce((t, x) => t + (Number(x.personnes) || 0), 0);

export function Visites({ id }) {
  useTitre('Visites');
  const s = useSession();
  const [q, setQ] = useQuery();
  // Lien direct (/crm/visites/<réservation ou séance>, depuis le journal, la recherche ou le site) :
  // on retrouve la semaine et la séance, puis l'adresse devient celle de la semaine.
  const lien = useCrm(id ? 'visites' : null, { du: ajouterJours(aujourdHui(), -60), au: ajouterJours(aujourdHui(), 59) });
  useEffect(() => {
    if (!id || (!lien.data && !lien.error)) return;
    const rs = elements(lien.data?.reservations);
    const ss = elements(lien.data?.seances);
    const res = rs.find((x) => x.id === id || x.reference === id);
    const se = ss.find((x) => x.id === (res ? res.seanceId : id));
    const jour = res?.date || se?.date;
    if (jour) navigate(`/crm/visites?semaine=${lundi(jour)}${se ? `&seance=${se.id}` : `&jour=${jour}`}${res ? `&resa=${res.id}` : ''}`, { replace: true });
    else {
      toast.info('Réservation introuvable', { detail: 'Elle a pu être supprimée, ou date de plus de deux mois.' });
      navigate('/crm/visites', { replace: true });
    }
  }, [id, lien.data, lien.error]);
  const jourQ = q.get('jour');
  const semaine = q.get('semaine') || lundi(jourQ || aujourdHui());
  const seanceId = q.get('seance');
  const fin = ajouterJours(semaine, 6);
  const r = useCrm('visites', { du: semaine, au: fin }, { garder: true });
  const seances = elements(r.data?.seances);
  const reservations = elements(r.data?.reservations);
  const peutModifier = s.peut('visites', 'ecriture');
  const aujour = aujourdHui();
  const [jourMob, setJourMob] = useState(jourQ || (aujour >= semaine && aujour <= fin ? aujour : semaine));
  useEffect(() => {
    if (!(jourMob >= semaine && jourMob <= fin)) setJourMob(jourQ && jourQ >= semaine && jourQ <= fin ? jourQ : aujour >= semaine && aujour <= fin ? aujour : semaine);
  }, [semaine]);
  const [reserver, setReserver] = useState(null);

  const jours = useMemo(() => {
    const l = Array.from({ length: 7 }, (_, i) => ajouterJours(semaine, i));
    return l.filter((j) => jourDeSemaine(j) !== 6 || seances.some((x) => x.date === j));
  }, [semaine, seances.length]);
  const resaDe = (id) => reservations.filter((x) => x.seanceId === id);
  const inscritsDe = (se) => se.inscrits ?? personnes(resaDe(se.id));
  const visiteurs = reservations.length ? personnes(reservations) : seances.reduce((t, x) => t + (x.inscrits || 0), 0);
  const capacite = seances.filter((x) => x.statut !== 'fermee').reduce((t, x) => t + (x.capacite || 0), 0);
  const choisie = seances.find((x) => x.id === seanceId);

  const aller = (n) => setQ({ semaine: ajouterJours(semaine, 7 * n), seance: undefined, jour: undefined });

  return (
    <div class="page visites">
      <PageHead
        titre="Visites"
        sous={`Semaine du ${dateCourte(semaine)} au ${date(ajouterJours(semaine, 5))}`}
        actions={
          <>
            {s.peut('exports') && (
              <Button href={crmUrl('export', { type: 'reservations', du: semaine, au: fin })} target="_blank" download="" icon="telecharger" title="Exporte les réservations de la semaine affichée au format CSV (tableur)">
                <span class="hide-s">Exporter</span>
              </Button>
            )}
            {peutModifier && (
              <Button variant="primary" icon="plus" onClick={() => setReserver({ date: jourMob, moment: 'matin' })}>
                Réserver
              </Button>
            )}
          </>
        }
      />
      <div class="toolbar">
        <div class="btn-row">
          <Button size="sm" icon="gauche" aria-label="Semaine précédente" onClick={() => aller(-1)} />
          <Button size="sm" onClick={() => setQ({ semaine: undefined, seance: undefined, jour: undefined })} disabled={semaine === lundi(aujour)}>
            Cette semaine
          </Button>
          <Button size="sm" icon="droite" aria-label="Semaine suivante" onClick={() => aller(1)} />
        </div>
        <div class="toolbar__end visites__stats" aria-live="polite">
          <span>
            <strong class="tnum">{nombre(visiteurs)}</strong> {visiteurs > 1 ? 'visiteurs attendus' : 'visiteur attendu'}
          </span>
          {capacite > 0 && (
            <span>
              <strong class="tnum">{Math.round((visiteurs / capacite) * 100)} %</strong> de remplissage
            </span>
          )}
        </div>
      </div>

      {r.error && !r.data && <Erreur erreur={r.error} onRetry={r.reload} />}
      {!r.data && !r.error && (
        <div class="semaine">
          {Array.from({ length: 6 }, (_, i) => (
            <div class="jour" key={i}>
              <Skeleton w="60%" />
              <Skeleton class="skel--block" style="height:110px;margin-top:12px" />
              <Skeleton class="skel--block" style="height:110px;margin-top:10px" />
            </div>
          ))}
        </div>
      )}
      {r.data && (
        <>
          <div class={cx('semaine only-desk-grid', r.refreshing && 'refreshing')} role="grid" aria-label="Séances de la semaine">
            <div class="semaine__row" role="row">
              {jours.map((j) => (
                <div key={j} role="columnheader" class={cx('jour__head', j === aujour && 'is-today')}>
                  <span class="jour__nom">{jourCourt(j).split(' ')[0]}</span>
                  <span class="jour__num">{jourCourt(j).split(' ')[1]}</span>
                  {j === aujour && <span class="sr-only">(aujourd’hui)</span>}
                </div>
              ))}
            </div>
            {MOMENTS.map((m) => (
              <div class="semaine__row" role="row" key={m}>
                {jours.map((j) => {
                  const se = seances.find((x) => x.date === j && x.moment === m);
                  return (
                    <div key={j} role="gridcell" class={cx('creneau', j === aujour && 'is-today', j < aujour && 'is-passe')}>
                      {se ? (
                        <CarteSeance se={se} inscrits={inscritsDe(se)} nbResa={actives(resaDe(se.id)).length} actif={se.id === seanceId} onOuvrir={() => setQ({ seance: se.id })} />
                      ) : (
                        <div class="creneau__vide">
                          <span class="small muted">{MOMENT[m]}</span>
                          <span class="small muted">{jourDeSemaine(j) === 6 ? 'Fermé' : 'Pas de séance'}</span>
                          {peutModifier && j >= aujour && jourDeSemaine(j) !== 6 && <AjoutSeance date={j} moment={m} onFait={() => r.reload({ silencieux: true })} />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <p class="small muted only-desk" style="margin-top:10px">
            Deux séances par jour, du lundi au samedi (fermé le dimanche), 25 personnes au plus. Saison du 12 février au 31 décembre.
          </p>
          <ReservationsSemaine reservations={reservations} seances={seances} ouvrir={(id) => setQ({ seance: id })} />

          <div class="only-mob">
            <div class="jours-strip" role="tablist" aria-label="Jour">
              {jours.map((j) => {
                const nb = personnes(reservations.filter((x) => x.date === j));
                return (
                  <button key={j} type="button" role="tab" aria-selected={j === jourMob ? 'true' : 'false'} class={cx('jours-strip__j', j === aujour && 'is-today')} onClick={() => setJourMob(j)}>
                    <span>{jourCourt(j).split(' ')[0]}</span>
                    <strong>{jourCourt(j).split(' ')[1]}</strong>
                    <small>{nb ? nombre(nb) : '·'}</small>
                  </button>
                );
              })}
            </div>
            <h2 class="h3" style="margin:14px 2px 10px">
              {jourSemaine(jourMob)}
              {jourMob === aujour ? ' · aujourd’hui' : ''}
            </h2>
            <div class="stack stack--s">
              {MOMENTS.map((m) => {
                const se = seances.find((x) => x.date === jourMob && x.moment === m);
                return se ? (
                  <CarteSeance key={m} se={se} inscrits={inscritsDe(se)} nbResa={actives(resaDe(se.id)).length} actif={false} large onOuvrir={() => setQ({ seance: se.id })} />
                ) : (
                  <div class="card card--paper" key={m}>
                    <div class="card__body--tight small muted">
                      {MOMENT[m]} · {jourDeSemaine(jourMob) === 6 ? 'fermé le dimanche' : 'pas de séance'}
                    </div>
                  </div>
                );
              })}
            </div>
            <VisiteursDuJour reservations={reservations.filter((x) => x.date === jourMob)} seances={seances} ouvrir={(id) => setQ({ seance: id })} />
          </div>
        </>
      )}

      {choisie && (
        <DrawerSeance
          se={choisie}
          reservations={resaDe(choisie.id)}
          visee={q.get('resa')}
          inscrits={inscritsDe(choisie)}
          peutModifier={peutModifier}
          onClose={() => setQ({ seance: undefined })}
          onReserver={() => setReserver({ date: choisie.date, moment: choisie.moment, seanceId: choisie.id, langue: choisie.langue })}
          onChange={() => {
            r.reload({ silencieux: true });
            invalider('tableau');
          }}
          mutate={r.mutate}
        />
      )}
      {reserver && (
        <DialogReservation
          init={reserver}
          seances={seances}
          onClose={() => setReserver(null)}
          onFait={() => {
            r.reload({ silencieux: true });
            invalider('tableau');
          }}
        />
      )}
    </div>
  );
}

// Visiteurs du jour (téléphone) : qui vient, à quelle séance
function VisiteursDuJour({ reservations, seances, ouvrir }) {
  const liste = [...reservations].sort((a, b) => `${a.moment === 'matin' ? 0 : 1}${a.statut === 'annulee' ? 1 : 0}${a.nom}`.localeCompare(`${b.moment === 'matin' ? 0 : 1}${b.statut === 'annulee' ? 1 : 0}${b.nom}`, 'fr'));
  if (!liste.length) return null;
  return (
    <section class="card mt" aria-labelledby="visiteurs-jour">
      <div class="card__head">
        <h2 class="card__title" id="visiteurs-jour">
          Visiteurs du jour
        </h2>
        <span class="small muted">{pluriel(personnes(liste), 'personne', 'personnes')}</span>
      </div>
      <div class="list" style="margin-top:6px">
        {liste.map((x) => {
          const se = seances.find((y) => y.id === x.seanceId);
          return (
            <button key={x.id} type="button" class={cx('list__item', x.statut === 'annulee' && 'is-inactif')} onClick={() => se && ouvrir(se.id)}>
              <span class="list__main">
                <span class="list__title">
                  <span>{x.nom}</span>
                </span>
                <span class="list__meta">
                  {heure(se?.heure || HEURES[x.moment])} · {pluriel(x.personnes, 'personne', 'personnes')}
                  {x.langue && x.langue !== 'fr' ? ` · ${LANGUE_COURT[x.langue]}` : ''}
                </span>
              </span>
              <Statut table={RESERVATION} valeur={x.statut} />
            </button>
          );
        })}
      </div>
    </section>
  );
}

// Toutes les réservations de la semaine (ordinateur), par jour et séance
function ReservationsSemaine({ reservations, seances, ouvrir }) {
  const ordre = (x) => `${x.date}-${x.moment === 'matin' ? 0 : 1}-${x.statut === 'annulee' ? 1 : 0}-${x.nom}`;
  const liste = [...reservations].sort((a, b) => (ordre(a) < ordre(b) ? -1 : 1));
  if (!liste.length) return null;
  return (
    <section class="card mt only-desk" aria-labelledby="resa-semaine">
      <div class="card__head">
        <h2 class="card__title" id="resa-semaine">
          Réservations de la semaine
        </h2>
        <span class="small muted">{pluriel(actives(liste).length, 'réservation', 'réservations')} · {pluriel(personnes(liste), 'personne', 'personnes')}</span>
      </div>
      <div class="tbl-wrap" style="margin-top:12px">
        <table class="tbl tbl--compact">
          <caption class="sr-only">Réservations de la semaine</caption>
          <thead>
            <tr>
              <th>Séance</th>
              <th>Nom</th>
              <th class="num">Personnes</th>
              <th>Langue</th>
              <th>Contact</th>
              <th>Source</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {liste.map((x) => {
              const se = seances.find((y) => y.id === x.seanceId);
              return (
                <tr key={x.id} data-href="" onClick={() => se && ouvrir(se.id)} class={x.statut === 'annulee' ? 'is-inactif' : ''}>
                  <td class="nowrap">
                    <button type="button" class="tbl__main lien-btn" onClick={() => se && ouvrir(se.id)}>
                      {jourCourt(x.date)} · {heure(se?.heure || HEURES[x.moment])}
                    </button>
                  </td>
                  <td>
                    <span class="strong">{x.nom}</span>
                    <span class="tbl__sub mono">{x.reference}</span>
                  </td>
                  <td class="num">
                    {x.personnes}
                    {x.mineurs ? <span class="tbl__sub">dont {x.mineurs} mineur{x.mineurs > 1 ? 's' : ''}</span> : null}
                  </td>
                  <td>{LANGUE_COURT[x.langue] || x.langue}</td>
                  <td class="small">{x.telephone ? telephone(x.telephone) : x.email || '—'}</td>
                  <td class="small muted">{RESERVATION_SOURCE[x.source] || x.source}</td>
                  <td>
                    <Statut table={RESERVATION} valeur={x.statut} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CarteSeance({ se, inscrits, nbResa, actif, onOuvrir, large }) {
  const cap = Number(se.capacite) || 0;
  const ferme = se.statut === 'fermee';
  const complet = !ferme && cap > 0 && inscrits >= cap;
  return (
    <button type="button" class={cx('seance', ferme && 'is-fermee', complet && 'is-complete', actif && 'is-active', large && 'seance--large')} onClick={onOuvrir} aria-label={`${jourSemaine(se.date)}, ${heure(se.heure)} : ${inscrits} inscrits sur ${cap}${ferme ? ', séance fermée' : complet ? ', complète' : ''}`}>
      <span class="seance__top">
        <span class="seance__heure">
          <Icon name={se.moment === 'matin' ? 'soleil' : 'couchant'} size="xs" />
          {heure(se.heure)}
        </span>
        {se.langue && se.langue !== 'fr' && <span class="tag tag--soft">{LANGUE_COURT[se.langue]}</span>}
        {ferme && <Pill>Fermée</Pill>}
        {complet && <Pill ton="warn">Complète</Pill>}
      </span>
      <span class="seance__chiffre">
        <strong class="tnum">{nombre(inscrits)}</strong>
        <span class="muted">/ {nombre(cap)}</span>
      </span>
      <Jauge valeur={inscrits} max={cap || 1} label="Remplissage" texte={`${inscrits} inscrits sur ${cap}`} />
      <span class="seance__bas small muted">
        <span>{nbResa ? pluriel(nbResa, 'réservation', 'réservations') : 'Aucune réservation'}</span>
        {se.guide?.nom || se.guideNom ? <span class="seance__guide">{(se.guide?.nom || se.guideNom).split(' ')[0]}</span> : null}
      </span>
    </button>
  );
}

function AjoutSeance({ date: jour, moment, onFait }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      icon="plus"
      busy={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await crm('seance', { method: 'POST', body: { date: jour, moment, heure: HEURES[moment], capacite: 25, langue: 'fr' } });
          toast(`Séance ajoutée : ${jourSemaine(jour)}, ${heure(HEURES[moment])}`);
          onFait();
        } catch (e) {
          toast.erreur(e);
        } finally {
          setBusy(false);
        }
      }}
    >
      Ajouter
    </Button>
  );
}

function DrawerSeance({ se, reservations, visee, inscrits, peutModifier, onClose, onReserver, onChange, mutate }) {
  const s = useSession();
  const membres = useMembres();
  const [f, setF] = useState({ capacite: se.capacite, guideId: se.guideId || '', notes: se.notes || '', langue: se.langue || 'fr' });
  const [busy, setBusy] = useState(null);
  useEffect(() => setF({ capacite: se.capacite, guideId: se.guideId || '', notes: se.notes || '', langue: se.langue || 'fr' }), [se.id, se.capacite, se.guideId, se.notes, se.langue]);
  useEffect(() => {
    if (!visee) return;
    const t = setTimeout(() => document.getElementById(`resa-${visee}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
    return () => clearTimeout(t);
  }, [visee, se.id]);
  const cap = Number(se.capacite) || 0;
  const tri = [...reservations].sort((a, b) => (a.statut === 'annulee') - (b.statut === 'annulee') || String(a.nom).localeCompare(String(b.nom), 'fr'));
  const mineurs = actives(reservations).reduce((t, x) => t + (Number(x.mineurs) || 0), 0);
  const change = f.capacite !== se.capacite || (f.guideId || '') !== (se.guideId || '') || (f.notes || '') !== (se.notes || '') || f.langue !== (se.langue || 'fr');
  const optionsGuides = membres.length ? membres : se.guide ? [{ id: se.guideId, prenom: se.guide.nom, nom: '' }] : [];

  const patchSeance = async (body, cle, message) => {
    setBusy(cle);
    try {
      await crm('seance', { method: 'PATCH', query: { id: se.id }, body });
      toast(message);
      onChange();
    } catch (e) {
      toast.erreur(e);
    } finally {
      setBusy(null);
    }
  };
  const statutResa = async (res, statut) => {
    mutate((d) => (d ? { ...d, reservations: (d.reservations || []).map((x) => (x.id === res.id ? { ...x, statut } : x)) } : d));
    try {
      await crm('reservation', { method: 'PATCH', query: { id: res.id }, body: { statut } });
      toast(`${res.nom} : ${RESERVATION[statut].label.toLowerCase()}`, { detail: statut === 'annulee' ? 'Les places sont libérées.' : undefined });
      onChange();
    } catch (e) {
      mutate((d) => (d ? { ...d, reservations: (d.reservations || []).map((x) => (x.id === res.id ? { ...x, statut: res.statut } : x)) } : d));
      toast.erreur(e);
    }
  };
  const passee = se.date < aujourdHui();
  const [noteResa, setNoteResa] = useState(null);

  return (
    <Drawer
      onClose={onClose}
      titre={`${jourSemaine(se.date)} · ${heure(se.heure)}`}
      sous={`Visite en ${(LANGUE[se.langue] || 'français').toLowerCase()} · ${MOMENT[se.moment] || ''}${se.guide?.nom ? ` · guide : ${se.guide.nom}` : ''}`}
      pied={
        <>
          <Button href={`/crm/imprimer/emargement/${se.id}?date=${se.date}`} target="_blank" rel="noopener" icon="imprimer">
            Feuille d’émargement
          </Button>
          {peutModifier && (
            <Button variant="primary" icon="plus" onClick={onReserver} disabled={se.statut === 'fermee'}>
              Ajouter une réservation
            </Button>
          )}
        </>
      }
    >
      <div class="stack">
        <div class="seance-tete">
          <JaugeRonde valeur={inscrits} max={cap || 1} taille={88} label={`${inscrits} inscrits sur ${cap} places`} sous={`sur ${cap}`} />
          <div class="seance-tete__chiffres">
            <div>
              <span class="stat__k">Places restantes</span>
              <span class="stat__v">{nombre(Math.max(0, se.restantes ?? cap - inscrits))}</span>
            </div>
            <div>
              <span class="stat__k">Réservations</span>
              <span class="stat__v">{nombre(actives(reservations).length)}</span>
            </div>
            <div>
              <span class="stat__k">Dont mineurs</span>
              <span class="stat__v">{nombre(mineurs)}</span>
            </div>
          </div>
        </div>

        {peutModifier && (
          <section class="card card--inset" aria-label="Réglages de la séance">
            <div class="card__body stack stack--s">
              <Switch
                label={se.statut === 'fermee' ? 'Séance fermée aux réservations' : 'Séance ouverte aux réservations'}
                checked={se.statut !== 'fermee'}
                disabled={busy === 'statut'}
                onChange={(e) => patchSeance({ statut: e.currentTarget.checked ? 'ouverte' : 'fermee' }, 'statut', e.currentTarget.checked ? 'Séance ouverte' : 'Séance fermée : le site ne propose plus ce créneau')}
              />
              <div class="form-grid">
                <div class="field">
                  <span class="field__label">Capacité</span>
                  <Stepper value={f.capacite} min={Math.max(1, inscrits)} max={60} onChange={(v) => setF((prec) => ({ ...prec, capacite: v }))} label="Capacité de la séance" />
                </div>
                <Select label="Langue" value={f.langue} onChange={(e) => { const cible = e.currentTarget; setF((prec) => ({ ...prec, langue: cible.value })); }} options={Object.entries(LANGUE).map(([value, label]) => ({ value, label }))} />
                <Select class="span-2" label="Guide" value={f.guideId} onChange={(e) => { const cible = e.currentTarget; setF((prec) => ({ ...prec, guideId: cible.value })); }} options={[{ value: '', label: 'Non attribué' }, ...optionsGuides.map((u) => ({ value: u.id, label: nomComplet(u) }))]} />
                <Textarea class="span-2" label="Notes" opt value={f.notes} onInput={(e) => { const cible = e.currentTarget; setF((prec) => ({ ...prec, notes: cible.value })); }} rows={2} placeholder="Ex. : groupe scolaire, accès PMR…" style="min-height:64px" />
              </div>
              <div class="btn-row btn-row--end">
                <Button size="sm" variant="primary" disabled={!change} busy={busy === 'reglages'} onClick={() => patchSeance({ capacite: f.capacite, guideId: f.guideId || null, notes: f.notes, langue: f.langue }, 'reglages', 'Séance mise à jour')}>
                  Enregistrer
                </Button>
              </div>
            </div>
          </section>
        )}

        <section aria-labelledby="resa-titre">
          <div class="row row--between" style="margin-bottom:10px">
            <h3 class="h3" id="resa-titre">
              Réservations
            </h3>
            <span class="small muted">{pluriel(personnes(reservations), 'personne', 'personnes')}</span>
          </div>
          {tri.length === 0 ? (
            <Empty petit icone="calendrier" titre="Aucune réservation" texte="Les réservations du site et celles prises au téléphone apparaissent ici." />
          ) : (
            <ul class="resas">
              {tri.map((x) => (
                <li key={x.id} id={`resa-${x.id}`} class={cx('resa', x.statut === 'annulee' && 'is-annulee', x.id === visee && 'is-visee')} aria-current={x.id === visee ? 'true' : undefined}>
                  <Avatar nom={x.nom} cle={x.id} />
                  <div class="resa__main">
                    <div class="resa__top">
                      <span class="strong">{x.nom}</span>
                      <Statut table={RESERVATION} valeur={x.statut} />
                    </div>
                    <div class="small muted">
                      {pluriel(x.personnes, 'personne', 'personnes')}
                      {x.mineurs ? ` dont ${pluriel(x.mineurs, 'mineur', 'mineurs')}` : ''} · {LANGUE_COURT[x.langue] || x.langue} · <span class="mono">{x.reference}</span> · {RESERVATION_SOURCE[x.source] || x.source}
                    </div>
                    <div class="small">
                      {x.telephone && (
                        <a class="link link--ink" href={`tel:${x.telephone.replace(/\s/g, '')}`}>
                          {telephone(x.telephone)}
                        </a>
                      )}
                      {x.telephone && x.email && ' · '}
                      {x.email && (
                        <a class="link link--ink" href={`mailto:${x.email}`}>
                          {coupe(x.email)}
                        </a>
                      )}
                    </div>
                    {x.message && <p class="small resa__msg">« {typo(x.message)} »</p>}
                    {x.notes && (
                      <p class="small resa__note">
                        <Icon name="note" size="xs" /> {typo(x.notes)}
                      </p>
                    )}
                  </div>
                  {peutModifier && (
                    <Menu label={`Actions pour la réservation de ${x.nom}`} bouton={(p) => <Button size="sm" variant="ghost" icon="points" {...p} />}>
                      {(fermer) => (
                        <>
                          {x.statut !== 'venue' && x.statut !== 'annulee' && (
                            <MenuItem icone="check" fermer={fermer} onSelect={() => statutResa(x, 'venue')} desc={passee || se.date === aujourdHui() ? null : 'Normalement le jour de la visite'}>
                              Venue
                            </MenuItem>
                          )}
                          {x.statut !== 'absente' && x.statut !== 'annulee' && (
                            <MenuItem icone="interdit" fermer={fermer} onSelect={() => statutResa(x, 'absente')}>
                              Absente
                            </MenuItem>
                          )}
                          {x.statut !== 'confirmee' && (
                            <MenuItem icone="annuler" fermer={fermer} onSelect={() => statutResa(x, 'confirmee')}>
                              Remettre en « confirmée »
                            </MenuItem>
                          )}
                          <MenuItem icone="note" fermer={fermer} onSelect={() => setNoteResa(x)}>
                            {x.notes ? 'Modifier la note interne…' : 'Ajouter une note interne…'}
                          </MenuItem>
                          {x.statut !== 'annulee' && (
                            <MenuItem icone="x" danger fermer={fermer} onSelect={() => statutResa(x, 'annulee')}>
                              Annuler la réservation
                            </MenuItem>
                          )}
                        </>
                      )}
                    </Menu>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {noteResa && (
        <DialogNoteResa
          res={noteResa}
          onClose={() => setNoteResa(null)}
          onFait={(notes) => {
            mutate((d) => (d ? { ...d, reservations: (d.reservations || []).map((y) => (y.id === noteResa.id ? { ...y, notes } : y)) } : d));
            onChange();
          }}
        />
      )}
    </Drawer>
  );
}

// Note interne d'une réservation (vidée : effacée)
function DialogNoteResa({ res, onClose, onFait }) {
  const [v, setV] = useState(res.notes || '');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const envoyer = async () => {
    setBusy(true);
    setErr(null);
    try {
      await crm('reservation', { method: 'PATCH', query: { id: res.id }, body: { notes: v.trim() } });
      toast(v.trim() ? `Note enregistrée pour ${res.nom}` : `Note de ${res.nom} effacée`);
      onFait(v.trim());
      onClose();
    } catch (e) {
      setErr(e);
      setBusy(false);
    }
  };
  return (
    <Dialog
      titre="Note interne"
      sous={`${res.nom} · ${res.reference} · visible par l’équipe seulement`}
      icone="note"
      onClose={onClose}
      onSubmit={envoyer}
      pied={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary" busy={busy}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div class="form">
        <Textarea label="Note" value={v} onInput={(e) => setV(e.currentTarget.value)} rows={3} placeholder="Ex. : groupe avec une personne en fauteuil, prévoir l’accès PMR" error={erreurDe(err, 'notes')} help="Laissez vide pour effacer la note." />
        {err && !erreurDe(err, 'notes') && <Notice ton="err">{err.message}</Notice>}
      </div>
    </Dialog>
  );
}

function DialogReservation({ init, seances, onClose, onFait }) {
  const [f, setF] = useState({ date: init.date || aujourdHui(), moment: init.moment || 'matin', personnes: 2, mineurs: 0, langue: init.langue || 'fr', nom: '', email: '', telephone: '', message: '', newsletter: false });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const se = seances.find((x) => x.date === f.date && x.moment === f.moment);
  const maj = (k) => (e) => { const cible = e.currentTarget; setF((prec) => ({ ...prec, [k]: cible.type === 'checkbox' ? cible.checked : cible.value })); };
  const envoyer = async () => {
    if (!f.nom.trim()) return setErr({ champ: 'nom', message: 'Indiquez le nom de la réservation.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setErr({ champ: 'email', message: 'Indiquez l’e-mail : la confirmation et le rappel y sont envoyés.' });
    if (f.mineurs >= f.personnes) return setErr({ champ: 'mineurs', message: 'Au moins un adulte accompagne le groupe.' });
    setBusy(true);
    setErr(null);
    try {
      const d = await crm('reservation', {
        method: 'POST',
        body: {
          date: f.date,
          moment: f.moment,
          seanceId: se?.id,
          personnes: f.personnes,
          mineurs: f.mineurs,
          langue: f.langue,
          nom: f.nom.trim(),
          email: f.email.trim(),
          telephone: f.telephone.trim() || undefined,
          message: f.message.trim() || undefined,
          newsletter: f.newsletter,
          source: 'telephone',
        },
      });
      const res = d?.reservation || d;
      toast(`Réservation ${res?.reference || ''} enregistrée`, { detail: `${jourSemaine(f.date)}, ${heure(se?.heure || HEURES[f.moment])} · ${pluriel(f.personnes, 'personne', 'personnes')} · confirmation envoyée` });
      onFait();
      onClose();
    } catch (e) {
      setErr(e);
      setBusy(false);
    }
  };
  return (
    <Dialog
      titre="Nouvelle réservation"
      sous="Prise au téléphone ou à l’accueil. Les mineurs sont comptés dans le nombre de personnes."
      icone="calendrier"
      onClose={onClose}
      onSubmit={envoyer}
      pied={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary" busy={busy}>
            Réserver
          </Button>
        </>
      }
    >
      <div class="form">
        <div class="form-grid">
          <Input label="Jour" type="date" min={aujourdHui()} value={f.date} onInput={maj('date')} error={erreurDe(err, 'date')} />
          <Select label="Séance" value={f.moment} onChange={maj('moment')} options={MOMENTS.map((m) => ({ value: m, label: `${MOMENT[m]} · ${heure(HEURES[m])}` }))} error={erreurDe(err, 'moment')} />
        </div>
        {se ? (
          <p class="small muted">
            {se.statut === 'fermee' ? 'Cette séance est fermée.' : `${nombre(Math.max(0, se.restantes ?? se.capacite - (se.inscrits || 0)))} places restantes sur ${se.capacite}.`}
          </p>
        ) : (
          <p class="small muted">Disponibilités vérifiées à l’enregistrement.</p>
        )}
        <div class="form-grid">
          <div class="field">
            <span class="field__label">Personnes</span>
            <Stepper value={f.personnes} min={1} max={25} onChange={(v) => setF((prec) => ({ ...prec, personnes: v, mineurs: Math.min(prec.mineurs, v - 1) }))} label="Nombre de personnes" />
          </div>
          <div class="field">
            <span class="field__label">Dont mineurs</span>
            <Stepper value={f.mineurs} min={0} max={Math.max(0, f.personnes - 1)} onChange={(v) => setF((prec) => ({ ...prec, mineurs: v }))} label="Nombre de mineurs" />
            {erreurDe(err, 'mineurs') && <p class="field__err">{erreurDe(err, 'mineurs')}</p>}
          </div>
          <Input class="span-2" label="Nom" value={f.nom} onInput={maj('nom')} error={erreurDe(err, 'nom')} autoComplete="off" />
          <Input label="E-mail" type="email" value={f.email} onInput={maj('email')} error={erreurDe(err, 'email')} help="Confirmation et rappel la veille." autoComplete="off" />
          <Input label="Téléphone" opt type="tel" value={f.telephone} onInput={maj('telephone')} error={erreurDe(err, 'telephone')} autoComplete="off" />
          <Select label="Langue" value={f.langue} onChange={maj('langue')} options={Object.entries(LANGUE).map(([value, label]) => ({ value, label }))} />
          <Textarea class="span-2" label="Message" opt value={f.message} onInput={maj('message')} rows={2} style="min-height:64px" />
        </div>
        <Check label="Accepte de recevoir la lettre d’information" checked={f.newsletter} onChange={maj('newsletter')} />
        {err && !erreurDe(err, 'nom', 'email', 'telephone', 'date', 'moment', 'mineurs') && (
          <Notice ton="err">
            {err.message}
            {Array.isArray(err.data?.disponibilites) && err.data.disponibilites.length > 0 && (
              <>
                <span class="block small" style="margin-top:6px">Places disponibles :</span>
                <span class="chips" style="margin:6px 0 0">
                  {err.data.disponibilites.map((x) => (
                    <button
                      key={`${x.date}-${x.moment}`}
                      type="button"
                      class="chip"
                      onClick={() => {
                        setF((prec) => ({ ...prec, date: x.date, moment: x.moment }));
                        setErr(null);
                      }}
                    >
                      {x.date === f.date ? MOMENT[x.moment] : jourCourt(x.date)} · {heure(x.heure || HEURES[x.moment])}
                      <span class="chip__n">{pluriel(x.restantes, 'place', 'places')}</span>
                    </button>
                  ))}
                </span>
              </>
            )}
          </Notice>
        )}
      </div>
    </Dialog>
  );
}

export { Pill, relatif };
