// Tableau de bord : chiffres des 30 derniers jours, ventes en ligne et pro, ce qui attend
// l'équipe, stocks bas, meilleures ventes, prochaines visites, activité récente et opération
// du moment (Octobre Rose).
import { useState } from 'preact/hooks';
import { useCrm } from '../lib/data.js';
import { useSession } from '../lib/session.jsx';
import { Link } from '../lib/router.jsx';
import { Icon } from '../ui/icons.jsx';
import { Avatar, Button, Card, Empty, Erreur, Pill, Skeleton, useTitre } from '../ui/base.jsx';
import { Marque } from '../ui/marque.jsx';
import { Ruban } from '../ui/ruban.jsx';
import { PhraseJournal, auteurDe, detailsJournal } from '../ui/journal.jsx';
import { BarresEmpilees, BasculeTableau, Jauge, Legende, MiniCourbe } from '../charts/charts.jsx';
import { COULEURS } from '../lib/liens.js';
import { aujourdHui, date, dateCourte, dateLongue, ecartJours, euros, eurosCourt, eurosRond, heure, jourSemaine, lundi, mois, nombre, periode, pluriel, relatif, variation } from '../lib/format.js';
import { LANGUE_COURT, MOMENT } from '../lib/statuts.js';

export function Tableau() {
  useTitre('Tableau de bord');
  const s = useSession();
  const t = useCrm('tableau');
  const d = t.data;
  const prenom = s.moi?.prenom || '';
  const peutCommander = s.peut('commandes', 'ecriture') || s.peut('commandes-pro', 'ecriture');
  const heureParis = Number(new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Paris' }).format(new Date()));
  const salut = heureParis >= 18 || heureParis < 5 ? 'Bonsoir' : 'Bonjour';

  return (
    <div class="page dash">
      <header class="page__head dash__head">
        <div class="page__titles">
          <p class="eyebrow">{dateLongue(new Date())}</p>
          <h1 class="page__title dash__hello" tabIndex={-1}>
            {salut} {prenom}
          </h1>
        </div>
        <div class="page__actions">
          {peutCommander && (
            <Button href="/crm/commandes/nouvelle" variant="primary" icon="plus">
              Nouvelle commande
            </Button>
          )}
        </div>
      </header>

      {t.error && !d && <Erreur erreur={t.error} onRetry={t.reload} />}
      {!d && !t.error && <SqueletteTableau />}
      {d && (
        <div class={t.refreshing ? 'dash__grid is-refreshing' : 'dash__grid'}>
          <Kpis d={d} />
          <div class="dash__main">
            {d.operation && <Operation op={d.operation} />}
            <CarteVentes ventes={d.ventes30 || []} ca={d.ca} ht={d.montants === 'TTC' ? 'TTC' : 'HT'} />
            <div class="cols cols--2 dash__duo">
              <TopProduits top={d.top || []} />
              <StocksBas liste={d.stocksBas || []} />
            </div>
          </div>
          <div class="dash__side">
            <ATraiter a={d.aTraiter || {}} />
            <Visites liste={d.prochainesVisites || []} />
            <Activite liste={d.activite || []} />
          </div>
        </div>
      )}
    </div>
  );
}

function SqueletteTableau() {
  return (
    <div class="stack" aria-busy="true" aria-label="Chargement du tableau de bord">
      <div class="kpis">
        {[1, 2, 3, 4].map((i) => (
          <div class="card kpi" key={i}>
            <Skeleton w="50%" />
            <Skeleton w="70%" h="28px" style="margin-top:14px" />
            <Skeleton w="40%" style="margin-top:12px" />
          </div>
        ))}
      </div>
      <div class="card" style="height:320px;padding:20px">
        <Skeleton w="30%" />
        <Skeleton class="skel--block" style="height:220px;margin-top:20px" />
      </div>
    </div>
  );
}

// ---------- Chiffres clés ----------
function Kpis({ d }) {
  const ca = d.ca || {};
  const ventes = d.ventes30 || [];
  const parJour = ventes.map((v) => (Number(v.enLigne) || 0) + (Number(v.pro) || 0));
  const ca30 = Number.isFinite(ca.enLigne30) || Number.isFinite(ca.pro30) ? (Number(ca.enLigne30) || 0) + (Number(ca.pro30) || 0) : parJour.reduce((t, v) => t + v, 0);
  // Variation sur 30 jours : CA HT tous canaux des 30 jours d'avant (J−59 à J−30, ca.precedent30)
  const precedent30 = Number(ca.precedent30) || 0;
  const delta = precedent30 > 0 ? (ca30 - precedent30) / precedent30 : null;
  const a = d.aTraiter || {};
  const totalATraiter = (a.commandes || 0) + (a.demandes || 0) + (a.messages || 0) + (a.facturesEnRetard || 0);
  const ht = d.montants === 'TTC' ? 'TTC' : 'HT';
  return (
    <div class="kpis" role="list" aria-label="Chiffres clés">
      <div class="card kpi kpi--hero" role="listitem">
        <p class="kpi__label">
          <span class="kpi__long">Chiffre d’affaires {ht} · 30 jours</span>
          <span class="kpi__court">CA {ht} · 30 jours</span>
        </p>
        <p class="kpi__value">{eurosRond(ca30)}</p>
        <div class="kpi__spark">
          <MiniCourbe valeurs={parJour} couleur={COULEURS.enLigne} largeur={240} hauteur={30} />
        </div>
        <div class="kpi__foot">
          {delta !== null && (
            <span class={`kpi__delta kpi__delta--${delta >= 0 ? 'up' : 'down'}`}>
              <Icon name={delta >= 0 ? 'hausse' : 'baisse'} size="xs" />
              {variation(delta)}
            </span>
          )}
          <span class="kpi__cmp" title={precedent30 > 0 ? `30 jours précédents : ${eurosRond(precedent30)}` : undefined}>
            {delta !== null ? 'vs les 30 jours précédents' : 'Pas d’historique pour comparer'}
          </span>
        </div>
      </div>
      <div class="card kpi" role="listitem">
        <p class="kpi__label">Commandes · 30 jours</p>
        <p class="kpi__value">{nombre(d.commandes30)}</p>
        <Repartition enLigne={ca.enLigne30 || 0} pro={ca.pro30 || 0} />
      </div>
      <div class="card kpi" role="listitem">
        <p class="kpi__label">Panier moyen {ht}</p>
        <p class="kpi__value">{euros(d.panierMoyen30)}</p>
        <div class="kpi__foot">
          <span class="kpi__cmp">
            CA du jour : {eurosRond(ca.jour)} · depuis lundi : {eurosRond(ca.semaine)}
          </span>
        </div>
      </div>
      <Link class="card kpi kpi--link" role="listitem" href="#a-traiter" onClick={(e) => { e.preventDefault(); document.getElementById('a-traiter')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); document.getElementById('a-traiter-titre')?.focus?.(); }}>
        <p class="kpi__label">À traiter</p>
        <p class="kpi__value">
          {nombre(totalATraiter)}
          {totalATraiter > 0 && <span class="kpi__pulse" aria-hidden="true" />}
        </p>
        <div class="kpi__foot">
          <span class="kpi__cmp">{totalATraiter ? [a.commandes && pluriel(a.commandes, 'commande', 'commandes'), a.messages && pluriel(a.messages, 'message', 'messages'), a.demandes && pluriel(a.demandes, 'demande pro', 'demandes pro')].filter(Boolean).join(', ') : 'Rien en attente'}</span>
        </div>
      </Link>
    </div>
  );
}

// Part en ligne / pro du chiffre d'affaires (barre à deux segments, valeurs écrites)
function Repartition({ enLigne, pro }) {
  const total = enLigne + pro;
  const p = total ? enLigne / total : 0;
  return (
    <div class="repart">
      <div class="repart__barre" role="img" aria-label={`Chiffre d’affaires : ${eurosRond(enLigne)} particuliers, ${eurosRond(pro)} pro`}>
        {enLigne > 0 && <span style={{ width: `${p * 100}%`, background: COULEURS.enLigne }} />}
        {pro > 0 && <span style={{ width: `${(1 - p) * 100}%`, background: COULEURS.pro }} />}
      </div>
      <div class="repart__leg">
        <span>
          <i style={{ background: COULEURS.enLigne }} />
          Particuliers <strong>{eurosRond(enLigne)}</strong>
        </span>
        <span>
          <i style={{ background: COULEURS.pro }} />
          Pro <strong>{eurosRond(pro)}</strong>
        </span>
      </div>
    </div>
  );
}

// ---------- Ventes des 30 derniers jours ----------
function CarteVentes({ ventes, ca = {}, ht }) {
  const [tableau, setTableau] = useState(false);
  const totEnLigne = ventes.reduce((s, v) => s + (Number(v.enLigne) || 0), 0);
  const totPro = ventes.reduce((s, v) => s + (Number(v.pro) || 0), 0);
  const series = [
    { cle: 'enLigne', label: 'Particuliers', couleur: COULEURS.enLigne },
    { cle: 'pro', label: 'Pro', couleur: COULEURS.pro },
  ];
  return (
    <Card titre="Ventes des 30 derniers jours" sous={`Montants ${ht} par jour : boutique en ligne et téléphone, commandes pro`} actions={<BasculeTableau actif={tableau} onChange={setTableau} />}>
      <div class="chart-head">
        <Legende items={series.map((x) => ({ label: x.label, couleur: x.couleur, valeur: eurosRond(x.cle === 'enLigne' ? totEnLigne : totPro) }))} />
        <span class="small muted">
          {Number.isFinite(ca.mois) ? `${mois(aujourdHui()).replace(/ \d{4}$/, '')} : ${eurosRond(ca.mois)}` : ''}
          {Number.isFinite(ca.moisPrecedent) ? ` · mois dernier : ${eurosRond(ca.moisPrecedent)}` : ''}
        </span>
      </div>
      {ventes.length === 0 ? (
        <Empty petit icone="graphique" titre="Pas encore de ventes" texte="Les ventes des 30 derniers jours apparaîtront ici." />
      ) : tableau ? (
        <div class="chart-table-wrap">
          <table class="chart-table">
            <caption class="sr-only">Ventes par jour, en ligne et pro</caption>
            <thead>
              <tr>
                <th scope="col">Jour</th>
                <th scope="col">Particuliers</th>
                <th scope="col">Pro</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {[...ventes].reverse().map((v) => (
                <tr key={v.date}>
                  <td>{jourSemaine(v.date)}</td>
                  <td>{euros(Number(v.enLigne) || 0)}</td>
                  <td>{euros(Number(v.pro) || 0)}</td>
                  <td>{euros((Number(v.enLigne) || 0) + (Number(v.pro) || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <BarresEmpilees
          data={ventes}
          series={series}
          etiquette={(v) => dateCourte(v.date)}
          etiquetteLongue={(v) => jourSemaine(v.date)}
          format={euros}
          formatAxe={eurosCourt}
          hauteur={236}
          label="Ventes des 30 derniers jours, en ligne et pro, par jour"
        />
      )}
    </Card>
  );
}

// ---------- À traiter ----------
function ATraiter({ a }) {
  const s = useSession();
  const jour = aujourdHui();
  const lignes = [
    { cle: 'commandes', icone: 'commandes', ton: 'new', titre: 'Commandes à traiter', sous: 'Nouvelles ou en préparation', href: '/crm/commandes?statut=nouvelle', droit: ['commandes', 'commandes-pro'] },
    { cle: 'demandes', icone: 'briefcase', ton: 'new', titre: 'Demandes de compte pro', sous: 'À étudier', href: '/crm/demandes?statut=nouvelle', droit: ['demandes', 'comptes'] },
    { cle: 'messages', icone: 'message', ton: 'info', titre: 'Messages non lus', sous: 'Formulaire de contact et espace pro', href: '/crm/messages?statut=nouveau', droit: ['messages'] },
    { cle: 'reservationsJour', icone: 'calendrier', ton: 'ok', titre: 'Visites aujourd’hui', sous: 'Réservations du jour', href: `/crm/visites?jour=${jour}`, droit: ['visites'] },
    { cle: 'facturesEnRetard', icone: 'facture', ton: 'err', titre: 'Factures en retard', sous: 'Échéance dépassée, non réglées', href: '/crm/comptes?tri=-encours', droit: ['factures', 'comptes'] },
  ].filter((l) => l.droit.some((x) => s.peut(x)));
  const total = lignes.reduce((t, l) => t + (a[l.cle] || 0), 0);
  return (
    <section class="card" id="a-traiter" aria-labelledby="a-traiter-titre">
      <div class="card__head">
        <h2 class="card__title" id="a-traiter-titre" tabIndex={-1}>
          À traiter
        </h2>
        {total === 0 && <Pill ton="ok">Tout est à jour</Pill>}
      </div>
      <div class="card__body--flush list todo">
        {lignes.map((l) => {
          const n = a[l.cle] || 0;
          return (
            <Link key={l.cle} class={`list__item todo__item${n ? '' : ' is-zero'}`} href={l.href}>
              <span class={`list__ico list__ico--${n ? l.ton : 'mute'}`}>
                <Icon name={l.icone} />
              </span>
              <span class="list__main">
                <span class="list__title">{l.titre}</span>
                <span class="list__meta">{l.sous}</span>
              </span>
              <span class="todo__n tnum">{nombre(n)}</span>
              <Icon name="droite" class="list__chev" size="s" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ---------- Meilleures ventes ----------
function TopProduits({ top }) {
  const max = Math.max(...top.map((p) => Number(p.totalHT) || 0), 1);
  return (
    <Card titre="Meilleures ventes" sous="30 derniers jours, montants hors taxes" corps={false} actions={<Link class="more" href="/crm/produits">Produits<Icon name="droite" /></Link>}>
      {top.length === 0 ? (
        <Empty petit icone="bouteille" titre="Aucune vente" texte="Les produits les plus vendus apparaîtront ici." />
      ) : (
        <ol class="palmares">
          {top.slice(0, 6).map((p, i) => (
            <li key={`${p.slug}-${p.varianteId || i}`} class="palmares__item">
              <span class="palmares__rang tnum">{i + 1}</span>
              <span class="palmares__main">
                <span class="palmares__nom">
                  <Marque texte={p.nom} logo />
                  {p.volume && <span class="palmares__vol"> · {p.volume}</span>}
                </span>
                <span class="palmares__bar" aria-hidden="true">
                  <span style={{ width: `${((Number(p.totalHT) || 0) / max) * 100}%` }} />
                </span>
              </span>
              <span class="palmares__chiffres">
                <span class="tnum strong">{eurosRond(p.totalHT)}</span>
                <span class="tnum small muted">{pluriel(p.qte || 0, 'bouteille', 'bouteilles')}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

// ---------- Stocks bas ----------
function StocksBas({ liste }) {
  return (
    <Card titre="Stocks bas" sous="Au seuil d’alerte ou en rupture" corps={false} actions={<Link class="more" href="/crm/produits?stock=bas">Stocks<Icon name="droite" /></Link>}>
      {liste.length === 0 ? (
        <Empty petit icone="ok" titre="Stocks en ordre" texte="Aucune contenance n’est sous son seuil." />
      ) : (
        <div class="list">
          {liste.slice(0, 6).map((p) => {
            const rupture = (p.stock ?? 0) <= 0;
            return (
              <Link key={`${p.slug}-${p.varianteId}`} class="list__item" href={`/crm/produits/${p.slug}`}>
                <span class="list__main">
                  <span class="list__title">
                    <span class="ellipsis">
                      <Marque texte={p.nom} logo />
                    </span>
                  </span>
                  <span class="list__meta">
                    {p.volume || ''} · seuil {nombre(p.seuil)}
                  </span>
                </span>
                <span class="list__end">
                  <span class="tnum strong">{nombre(p.stock)}</span>
                  <Pill ton={rupture ? 'err' : 'warn'}>{rupture ? 'Rupture' : 'Stock bas'}</Pill>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ---------- Prochaines visites ----------
function Visites({ liste }) {
  const s = useSession();
  if (!s.peut('visites')) return null;
  const visiteurs = liste.reduce((t, v) => t + (Number(v.inscrits ?? v.personnes) || 0), 0);
  return (
    <Card titre="Prochaines visites" sous={liste.length ? `${pluriel(visiteurs, 'visiteur attendu', 'visiteurs attendus')}` : null} corps={false} actions={<Link class="more" href="/crm/visites">Agenda<Icon name="droite" /></Link>}>
      {liste.length === 0 ? (
        <Empty petit icone="calendrier" titre="Aucune visite prévue" texte="Les séances réservées des prochains jours apparaîtront ici." />
      ) : (
        <div class="list">
          {liste.slice(0, 5).map((v) => {
            const inscrits = Number(v.inscrits ?? v.personnes) || 0;
            const cap = Number(v.capacite) || 0;
            const ecart = ecartJours(aujourdHui(), v.date);
            const quand = ecart === 0 ? 'Aujourd’hui' : ecart === 1 ? 'Demain' : jourSemaine(v.date);
            return (
              <Link key={v.id || `${v.date}-${v.heure}`} class="list__item visit-mini" href={`/crm/visites?semaine=${lundi(v.date)}${v.id ? `&seance=${v.id}` : ''}`}>
                <span class="visit-mini__date" aria-hidden="true">
                  <span>{dateCourte(v.date).split(' ')[0]}</span>
                  <small>{dateCourte(v.date).split(' ')[1]}</small>
                </span>
                <span class="list__main">
                  <span class="list__title">
                    <span>
                      {quand} · {heure(v.heure)}
                    </span>
                    {v.langue && v.langue !== 'fr' && <span class="tag tag--soft">{LANGUE_COURT[v.langue]}</span>}
                  </span>
                  {cap > 0 ? (
                    <span class="visit-mini__gauge">
                      <Jauge valeur={inscrits} max={cap} fin label={`Remplissage ${inscrits} sur ${cap}`} texte={`${inscrits} inscrits sur ${cap} places`} />
                      <span class="tnum small muted">
                        {inscrits}/{cap}
                      </span>
                    </span>
                  ) : (
                    <span class="list__meta">{pluriel(inscrits, 'personne', 'personnes')}{v.moment ? ` · ${MOMENT[v.moment] || ''}` : ''}</span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ---------- Activité récente ----------
function Activite({ liste }) {
  const s = useSession();
  return (
    <Card titre="Activité récente" corps={false} actions={s.peut('journal') && <Link class="more" href="/crm/journal">Journal<Icon name="droite" /></Link>}>
      {liste.length === 0 ? (
        <Empty petit icone="journal" titre="Rien pour l’instant" texte="Les actions de l’équipe et du site s’afficheront ici." />
      ) : (
        <ol class="feed">
          {liste.slice(0, 8).map((e) => {
            const qui = auteurDe(e);
            const details = detailsJournal(e);
            return (
              <li key={e.id} class="feed__item">
                {e.par?.id ? <Avatar nom={qui} cle={e.par.id} size="s" /> : <span class="feed__sys" aria-hidden="true"><Icon name={e.par?.nom === 'Site' ? 'globe' : 'etincelle'} size="xs" /></span>}
                <div class="feed__txt">
                  <p>
                    <PhraseJournal e={e} role={false} encre />
                  </p>
                  {details && <p class="small muted ellipsis">{details}</p>}
                  <time class="small muted" dateTime={e.date} title={date(e.date)}>
                    {relatif(e.date)}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

// ---------- Octobre Rose ----------
function Operation({ op }) {
  const jour = aujourdHui();
  const debut = op.debut;
  const fin = op.fin;
  const enCours = op.enCours ?? (debut <= jour && jour <= fin);
  const avant = jour < debut;
  const restants = fin ? ecartJours(jour, fin) + 1 : null;
  const duree = debut && fin ? ecartJours(debut, fin) + 1 : null;
  const ecoules = debut && duree ? Math.min(duree, Math.max(0, ecartJours(debut, jour) + 1)) : 0;
  const etat = avant ? `Commence le ${date(debut)}` : enCours ? (restants === 1 ? 'Dernier jour' : `Encore ${restants} jours`) : 'Terminée — don à verser';
  const lien = `/crm/commandes?canal=en-ligne${debut ? `&du=${debut}` : ''}${fin ? `&au=${fin}` : ''}`;
  return (
    <section class="card op" aria-labelledby="op-titre">
      <div class="op__in">
        <div class="op__head">
          <Ruban class="op__ruban" titre="Ruban rose" />
          <div>
            <h2 class="op__titre" id="op-titre">
              {op.nom || 'Octobre Rose'}
            </h2>
            <p class="op__periode">
              {debut && fin ? `${periode(debut, fin)} · ` : ''}1 € reversé par bouteille de <Marque texte="PAC Citron" /> vendue en ligne ou en boutique d’usine
            </p>
          </div>
          <span class="op__etat">
            <span class={`pill${!enCours && !avant ? ' pill--fini' : ''}`}>{etat}</span>
          </span>
        </div>
        {duree && enCours && (
          <div class="op__track" role="progressbar" aria-label="Avancement de l’opération" aria-valuemin={0} aria-valuemax={duree} aria-valuenow={ecoules} aria-valuetext={`Jour ${ecoules} sur ${duree}`}>
            <span style={{ width: `${(ecoules / duree) * 100}%` }} />
          </div>
        )}
        <div class="op__chiffres">
          <div class="op__chiffre">
            <span class="op__k">
              Bouteilles de <Marque texte="PAC Citron" /> vendues
            </span>
            <span class="op__v">{nombre(op.bouteilles)}</span>
          </div>
          <div class="op__chiffre op__chiffre--don">
            <span class="op__k">{enCours || avant ? 'Don à ce jour' : 'Don à verser'}</span>
            <span class="op__v">{euros(op.montant)}</span>
          </div>
          <div class="op__chiffre op__chiffre--cmd">
            <span class="op__k">Commandes concernées</span>
            <span class="op__v">{nombre(op.commandes)}</span>
          </div>
        </div>
        <div class="op__benef">
          <span>
            Au profit de <strong>{op.beneficiaire || 'l’Institut du Cancer Avignon-Provence'}</strong>
          </span>
          <Link class="op__lien" href={lien}>
            Commandes en ligne de la période
            <Icon name="droite" />
          </Link>
        </div>
      </div>
    </section>
  );
}
