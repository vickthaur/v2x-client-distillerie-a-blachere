// Commandes : historique (filtres par état) et détail (frise des statuts, suivi du transporteur,
// facture, lignes et totaux, recommander en un geste).
import { useState } from 'preact/hooks';
import { useDonnees } from '../donnees.js';
import { navigate } from '../router.js';
import { totalHT, totalTTC, dateDe, recommander, enRetard } from '../commun.js';
import { Adresse } from '../adresses.jsx';
import { eur, dateLongue, dateCourte, dateJour, dateHeure, statut, pluriel, volume, ETAPES, FACTURES, pourcent, NB } from '../format.js';
import { Chargement, Erreur, Evin, Icone, Montant, NomProduit, Packshot, Pastille, TitreVue, Vide } from '../ui.jsx';

const FILTRES = [
  { id: 'toutes', nom: 'Toutes', test: () => true },
  { id: 'en-cours', nom: 'En cours', test: (c) => ['nouvelle', 'en-preparation', 'prete', 'expediee'].includes(c.statut) },
  { id: 'livrees', nom: 'Livrées', test: (c) => ['livree', 'retiree'].includes(c.statut) },
  { id: 'annulees', nom: 'Annulées', test: (c) => ['annulee', 'remboursee'].includes(c.statut) },
];

export function Commandes({ route, site }) {
  return route.id ? <Detail id={route.id} site={site} /> : <Liste site={site} />;
}

function Liste({ site }) {
  const { data, error, loading, reload } = useDonnees('commandes', { par: 100, tri: '-date' });
  const [filtre, setFiltre] = useState('toutes');
  const items = Array.isArray(data) ? data : data?.elements || data?.commandes || [];
  const f = FILTRES.find((x) => x.id === filtre);
  const vus = items.filter(f.test);
  return (
    <>
      <TitreVue kicker="Suivi" titre="Vos" accent="commandes">
        <p class="pro-lead">Préparation, expédition et livraison de chaque commande, avec sa facture. Recommandez en un geste une commande passée.</p>
      </TitreVue>
      {loading && !data ? (
        <Chargement lignes={5} />
      ) : error ? (
        <Erreur erreur={error} reessayer={reload} />
      ) : !items.length ? (
        <Vide titre="Aucune commande pour l’instant." icone="bag" action={<a class="btn btn--primary btn--sm" href="/espace-pro/catalogue">Ouvrir le catalogue</a>}>
          Vos commandes passées dans l’espace pro, par téléphone ou auprès de votre commercial apparaîtront ici.
        </Vide>
      ) : (
        <>
          <div class="cats pro-filters" role="group" aria-label="Filtrer les commandes">
            {FILTRES.map((x) => (
              <button type="button" key={x.id} class={`cat${filtre === x.id ? ' is-on' : ''}`} aria-pressed={filtre === x.id} onClick={() => setFiltre(x.id)}>
                {x.nom}
                <span class="cat__n">{items.filter(x.test).length}</span>
              </button>
            ))}
          </div>
          {!vus.length ? (
            <p class="pro-muted pro-pad">Aucune commande dans cette catégorie.</p>
          ) : (
            <div class="pro-table-wrap">
              <table class="pro-table">
                <caption class="sr-only">Commandes, de la plus récente à la plus ancienne</caption>
                <thead>
                  <tr>
                    <th scope="col">Commande</th>
                    <th scope="col">Date</th>
                    <th scope="col">Votre référence</th>
                    <th scope="col" class="num">Total HT</th>
                    <th scope="col">État</th>
                    <th scope="col">
                      <span class="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vus.map((c) => (
                    <Rangee key={c.id} c={c} site={site} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

function Rangee({ c, site }) {
  const s = statut(c.statut);
  const [occupe, setOccupe] = useState(false);
  const again = async () => {
    setOccupe(true);
    try {
      const r = await recommander(c.id);
      site?.toast(r.message);
      navigate('/espace-pro/commande');
    } catch (e) {
      setOccupe(false);
      site?.toast(e?.message || 'La commande n’a pas pu être reprise.');
    }
  };
  return (
    <tr>
      <th scope="row" data-label="Commande">
        <a class="pro-table__main" href={`/espace-pro/commandes/${c.id}`}>
          {c.numero}
        </a>
        {c.canal && c.canal !== 'pro' && <span class="pro-table__sub">{c.canal === 'telephone' ? 'Par téléphone' : 'En ligne'}</span>}
      </th>
      <td data-label="Date">{dateLongue(dateDe(c))}</td>
      <td data-label="Votre référence">{c.referenceClient || <span class="pro-muted">—</span>}</td>
      <td data-label="Total HT" class="num">
        <Montant v={totalHT(c)} />
      </td>
      <td data-label="État">
        <Pastille ton={s.ton}>{s.libelle}</Pastille>
        {c.suivi?.numero && <span class="pro-table__sub">Suivi {c.suivi.numero}</span>}
      </td>
      <td class="pro-table__act">
        <div class="pro-table__btns">
          <a class="btn btn--ghost btn--sm" href={`/espace-pro/commandes/${c.id}`}>
            Détail<span class="sr-only"> de {c.numero}</span>
          </a>
          <button type="button" class="btn btn--ghost btn--sm" onClick={again} disabled={occupe} aria-label={`Recommander ${c.numero}`}>
            <Icone n="repeat" />
            {occupe ? '…' : 'Recommander'}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---------- Détail ----------
function Detail({ id, site }) {
  const { data, error, loading, reload } = useDonnees('commande', { id });
  const c = data?.commande || data;
  const [occupe, setOccupe] = useState(false);
  if (loading && !data)
    return (
      <>
        <Retour />
        <TitreVue kicker="Commande" titre="Chargement…" />
        <Chargement lignes={5} />
      </>
    );
  if (error)
    return (
      <>
        <Retour />
        <TitreVue kicker="Commande" titre={error.status === 404 ? 'Commande introuvable' : 'Commande'} />
        {error.status === 404 ? (
          <Vide titre="Cette commande n’existe pas ou n’appartient pas à votre compte." icone="search" action={<a class="btn btn--primary btn--sm" href="/espace-pro/commandes">Toutes les commandes</a>} />
        ) : (
          <Erreur erreur={error} reessayer={reload} />
        )}
      </>
    );
  const s = statut(c.statut);
  const t = c.totaux || {};
  const f = c.facture;
  const alcool = (c.lignes || []).some((l) => l.alcool);
  const again = async () => {
    setOccupe(true);
    try {
      const r = await recommander(c.id);
      site?.toast(r.message);
      navigate('/espace-pro/commande');
    } catch (e) {
      setOccupe(false);
      site?.toast(e?.message || 'La commande n’a pas pu être reprise.');
    }
  };
  return (
    <>
      <Retour />
      <TitreVue
        kicker={`Commande du ${dateLongue(dateDe(c))}`}
        titre={c.numero}
        actions={
          <>
            <button type="button" class="btn btn--ink btn--sm" onClick={again} disabled={occupe}>
              <Icone n="repeat" />
              {occupe ? 'Un instant…' : 'Recommander'}
            </button>
            {f && (
              <a class="btn btn--ghost btn--sm" href={`/espace-pro/factures/${c.id}`}>
                <Icone n="doc" />
                Facture {f.numero}
              </a>
            )}
            <a class="btn btn--ghost btn--sm" href={`/espace-pro/messages?nouveau=1&sujet=commande&commande=${encodeURIComponent(c.numero)}`}>
              <Icone n="chat" />
              Une question{NB}?
            </a>
          </>
        }
      >
        <p class="pro-lead pro-lead--meta">
          <Pastille ton={s.ton}>{s.libelle}</Pastille>
          <span>
            {pluriel((c.lignes || []).length, 'ligne')} · <Montant v={t.totalHT ?? totalHT(c)} />
            {NB}HT
          </span>
          {c.referenceClient && <span>Votre référence{NB}: {c.referenceClient}</span>}
        </p>
      </TitreVue>

      <Frise c={c} />

      <div class="pro-detail">
        <section class="pro-card" aria-labelledby="det-livraison">
          <h2 class="pro-h2" id="det-livraison">
            Livraison
          </h2>
          {c.livraison?.adresse ? <Adresse a={c.livraison.adresse} /> : <p class="pro-muted">{c.livraison?.libelle || 'Adresse du compte'}</p>}
          {c.dateSouhaitee && (
            <p class="pro-muted">
              Date souhaitée{NB}: <strong>{dateJour(c.dateSouhaitee)}</strong>
            </p>
          )}
          {c.suivi?.numero ? (
            <div class="pro-track">
              <Icone n="truck" />
              <div>
                <p>
                  {c.suivi.transporteur || 'Transporteur'} · n°{NB}
                  <strong>{c.suivi.numero}</strong>
                </p>
                {c.suivi.url && (
                  <a class="link" href={c.suivi.url} target="_blank" rel="noopener">
                    Suivre le colis<span class="sr-only"> (nouvel onglet)</span>
                  </a>
                )}
              </div>
            </div>
          ) : (
            ['nouvelle', 'en-preparation', 'prete'].includes(c.statut) && <p class="pro-muted">Le numéro de suivi apparaîtra ici à l’expédition.</p>
          )}
        </section>
        <section class="pro-card" aria-labelledby="det-facture">
          <h2 class="pro-h2" id="det-facture">
            Facture
          </h2>
          {f ? (
            <>
              <p>
                <strong>{f.numero}</strong> du {dateLongue(f.date)}
              </p>
              <p class="pro-muted">
                Échéance{NB}: {dateLongue(f.echeance)} ·{' '}
                <Pastille ton={f.statut === 'payee' ? 'ok' : enRetard(f) ? 'err' : 'warn'} petit>
                  {f.statut === 'payee' ? FACTURES.payee.libelle : enRetard(f) ? FACTURES.retard.libelle : FACTURES['a-regler'].libelle}
                </Pastille>
              </p>
              <a class="btn btn--ghost btn--sm" href={`/espace-pro/factures/${c.id}`}>
                <Icone n="print" />
                Voir et imprimer
              </a>
            </>
          ) : (
            <p class="pro-muted">La facture est émise à l’expédition de la commande.</p>
          )}
        </section>
      </div>

      <section class="pro-card" aria-labelledby="det-lignes">
        <h2 class="pro-h2" id="det-lignes">
          Articles
        </h2>
        <ul class="det-lines">
          {(c.lignes || []).map((l) => (
            <li class="det-line" key={`${l.slug}|${l.varianteId}`}>
              <Packshot slug={l.slug} taille="s" />
              <div class="det-line__info">
                <p class="det-line__nom">
                  <NomProduit nom={l.nom} />
                </p>
                <p class="pro-muted">
                  {volume(l.varianteId, l.volume)}
                  {l.colisage > 1 ? ` · ${pluriel(Math.round(l.qte / l.colisage), 'carton')} de ${l.colisage}` : ''} · {pluriel(l.qte, 'unité')} à {eur(l.prixUnitaireHT)}
                  {NB}HT
                </p>
              </div>
              <p class="det-line__total">
                <Montant v={l.totalHT} />
              </p>
            </li>
          ))}
        </ul>
        {alcool && <Evin />}
        <div class="det-totals">
          <dl class="pro-totals">
            <div>
              <dt>Articles</dt>
              <dd>
                <Montant v={t.articlesHT} />
              </dd>
            </div>
            <div>
              <dt>Frais de port</dt>
              <dd>{t.fraisPortHT || t.livraisonHT ? <Montant v={t.fraisPortHT || t.livraisonHT} /> : <span class="pro-ok">Offerts</span>}</dd>
            </div>
            <div class="pro-totals__sub">
              <dt>Total HT</dt>
              <dd>
                <Montant v={t.totalHT} />
              </dd>
            </div>
            {(t.tva || []).map((x) => (
              <div class="pro-totals__tva" key={x.taux}>
                <dt>
                  TVA {pourcent(x.taux)} <small>sur {eur(x.baseHT)}</small>
                </dt>
                <dd>
                  <Montant v={x.montant} />
                </dd>
              </div>
            ))}
            <div class="pro-totals__grand">
              <dt>Total TTC</dt>
              <dd>
                <Montant v={t.totalTTC ?? totalTTC(c)} />
              </dd>
            </div>
          </dl>
        </div>
        {c.commentaire && (
          <p class="pro-comment">
            <strong>Votre commentaire{NB}:</strong> {c.commentaire}
          </p>
        )}
      </section>
    </>
  );
}

const Retour = () => (
  <p class="pro-back">
    <a href="/espace-pro/commandes">
      <Icone n="back" /> Toutes les commandes
    </a>
  </p>
);

// Frise : enregistrée → en préparation → expédiée → livrée (dates tirées de l'historique).
function Frise({ c }) {
  const hist = c.historique || [];
  const dateDu = (st) => hist.find((h) => h.statut === st)?.date;
  if (['annulee', 'remboursee'].includes(c.statut)) {
    const s = statut(c.statut);
    return (
      <div class="pro-frise pro-frise--stop">
        <p>
          <Pastille ton="muet">{s.libelle}</Pastille> {dateDu(c.statut) ? `le ${dateHeure(dateDu(c.statut))}` : ''}
        </p>
      </div>
    );
  }
  const etapes = c.statut === 'prete' || c.statut === 'retiree' || c.livraison?.mode === 'retrait' ? ['nouvelle', 'en-preparation', 'prete', 'retiree'] : ETAPES;
  const k = etapes.indexOf(c.statut);
  return (
    <ol class="pro-frise" aria-label="Avancement de la commande">
      {etapes.map((st, i) => {
        const d = dateDu(st) || (i === 0 ? dateDe(c) : null);
        const etat = i < k ? 'done' : i === k ? 'now' : 'next';
        return (
          <li class={`pro-frise__step is-${etat}`} key={st} aria-current={etat === 'now' ? 'step' : undefined}>
            <span class="pro-frise__dot" aria-hidden="true">
              {etat !== 'next' && <Icone n="check" />}
            </span>
            <span class="pro-frise__lbl">{statut(st).libelle}</span>
            <span class="pro-frise__date">{d && etat !== 'next' ? dateCourte(d) : etat === 'next' ? 'À venir' : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}
