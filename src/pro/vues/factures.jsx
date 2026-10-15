// Factures : liste (statut, échéance, retard mis en évidence) et facture A4 imprimable (coordonnées
// de la distillerie, client, lignes, TVA par taux, mentions légales ; les mentions que la
// distillerie doit fournir sont marquées « à compléter »).
import { useDonnees } from '../donnees.js';
import { enRetard, joursRetard, totalHT, totalTTC } from '../commun.js';
import { adresseLignes } from '../adresses.jsx';
import { infos } from '../../data/site.js';
import textes from '../../data/site/textes.json';
import { EVIN } from '../../data/products.js';
import { eur, dateLongue, dateCourte, pluriel, volume, typo, CONDITIONS, pourcent, NB } from '../format.js';
import { Chargement, Erreur, Icone, Montant, Pastille, TitreVue, Vide, Note } from '../ui.jsx';

export function Factures({ route, session }) {
  return route.id ? <Facture id={route.id} session={session} /> : <Liste />;
}

function Liste() {
  const { data, error, loading, reload } = useDonnees('factures');
  const items = Array.isArray(data) ? data : data?.factures || data?.elements || [];
  const aRegler = items.filter((f) => f.statut !== 'payee');
  const retard = aRegler.filter(enRetard);
  const montant = (f) => f.montantTTC ?? f.totalTTC ?? totalTTC(f) ?? 0;
  const somme = (l) => Math.round(l.reduce((s, f) => s + montant(f), 0) * 100) / 100;
  const prochaine = aRegler.filter((f) => !enRetard(f)).sort((a, b) => String(a.echeance).localeCompare(String(b.echeance)))[0];
  return (
    <>
      <TitreVue kicker="Comptabilité" titre="Vos" accent="factures">
        <p class="pro-lead">Chaque commande expédiée donne lieu à une facture, réglée selon les conditions de votre compte. Ouvrez une facture pour l’imprimer ou l’enregistrer en PDF.</p>
      </TitreVue>
      {loading && !data ? (
        <Chargement lignes={5} />
      ) : error ? (
        <Erreur erreur={error} reessayer={reload} />
      ) : !items.length ? (
        <Vide titre="Aucune facture pour l’instant." icone="doc">
          La facture d’une commande est émise à son expédition.
        </Vide>
      ) : (
        <>
          <div class="pro-kpis">
            <div class="pro-kpi">
              <p class="pro-kpi__k">À régler</p>
              <p class="pro-kpi__v">
                <Montant v={somme(aRegler)} />
              </p>
              <p class="pro-muted">{aRegler.length ? pluriel(aRegler.length, 'facture') : 'Tout est réglé'}</p>
            </div>
            <div class={`pro-kpi${retard.length ? ' pro-kpi--err' : ''}`}>
              <p class="pro-kpi__k">En retard</p>
              <p class="pro-kpi__v">
                <Montant v={somme(retard)} />
              </p>
              <p class="pro-muted">{retard.length ? pluriel(retard.length, 'facture') : 'Aucune'}</p>
            </div>
            <div class="pro-kpi">
              <p class="pro-kpi__k">Prochaine échéance</p>
              <p class="pro-kpi__v pro-kpi__v--date">{prochaine ? dateLongue(prochaine.echeance) : '—'}</p>
              <p class="pro-muted">{prochaine ? `${prochaine.numero} · ${eur(montant(prochaine))}` : 'Aucune échéance à venir'}</p>
            </div>
          </div>
          <div class="pro-table-wrap">
            <table class="pro-table">
              <caption class="sr-only">Factures du compte</caption>
              <thead>
                <tr>
                  <th scope="col">Facture</th>
                  <th scope="col">Date</th>
                  <th scope="col">Commande</th>
                  <th scope="col">Échéance</th>
                  <th scope="col" class="num">Montant TTC</th>
                  <th scope="col">État</th>
                  <th scope="col">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((f) => {
                  const late = f.statut !== 'payee' && enRetard(f);
                  const id = f.commandeId || f.commande?.id || f.id;
                  return (
                    <tr key={f.numero} class={late ? 'is-late' : ''}>
                      <th scope="row" data-label="Facture">
                        <a class="pro-table__main" href={`/espace-pro/factures/${id}`}>
                          {f.numero}
                        </a>
                      </th>
                      <td data-label="Date">{dateLongue(f.date)}</td>
                      <td data-label="Commande">{f.commandeNumero || f.commande?.numero || '—'}</td>
                      <td data-label="Échéance">
                        {dateLongue(f.echeance)}
                        {late && <span class="pro-table__sub pro-err">{pluriel(joursRetard(f), 'jour')} de retard</span>}
                      </td>
                      <td data-label="Montant TTC" class="num">
                        <Montant v={montant(f)} />
                      </td>
                      <td data-label="État">
                        <Pastille ton={f.statut === 'payee' ? 'ok' : late ? 'err' : 'warn'}>{f.statut === 'payee' ? 'Payée' : late ? 'En retard' : 'À régler'}</Pastille>
                        {f.statut === 'payee' && f.payeeLe && <span class="pro-table__sub">le {dateCourte(f.payeeLe)}</span>}
                      </td>
                      <td class="pro-table__act">
                        <a class="btn btn--ghost btn--sm" href={`/espace-pro/factures/${id}`}>
                          <Icone n="print" />
                          Voir
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {retard.length > 0 && (
            <Note ton="err" titre="Une facture est en retard de paiement.">
              Si le règlement est déjà parti, ignorez ce message. Une question{NB}? <a class="link" href="/espace-pro/messages?nouveau=1&sujet=commande">Écrivez à la distillerie</a>.
            </Note>
          )}
        </>
      )}
    </>
  );
}

// ---------- Facture A4 ----------
// Coordonnées de la distillerie : paramètres de la démo s'ils sont fournis, sinon les mentions du site.
const mentions = textes.mentions?.texte || [];
const SIRET = (mentions.find((l) => /^SIRET/.test(l)) || '').replace(/^SIRET\s*:\s*/, '') || null;

function Facture({ id, session }) {
  const cmd = useDonnees('commande', { id });
  const cpt = useDonnees('compte');
  const c = cmd.data?.commande || cmd.data;
  if (cmd.loading && !cmd.data)
    return (
      <>
        <Retour />
        <Chargement lignes={6} texte="Chargement de la facture…" />
      </>
    );
  if (cmd.error || (c && !c.facture))
    return (
      <>
        <Retour />
        <TitreVue kicker="Facture" titre="Facture introuvable" />
        {cmd.error && cmd.error.status !== 404 ? (
          <Erreur erreur={cmd.error} reessayer={cmd.reload} />
        ) : (
          <Vide titre={c && !c.facture ? 'Cette commande n’est pas encore facturée.' : 'Cette facture n’existe pas ou n’appartient pas à votre compte.'} icone="doc" action={<a class="btn btn--primary btn--sm" href="/espace-pro/factures">Toutes les factures</a>} />
        )}
      </>
    );
  const f = c.facture;
  const compte = cpt.data?.compte || cpt.data || session.compte || {};
  const ent = cmd.data?.entreprise || c.entreprise || {};
  const t = c.totaux || {};
  const late = f.statut !== 'payee' && enRetard(f);
  const alcool = (c.lignes || []).some((l) => l.alcool);
  const facturation = compte.adresseFacturation;
  return (
    <>
      <div class="inv-tools no-print">
        <Retour />
        <div class="inv-tools__right">
          <Pastille ton={f.statut === 'payee' ? 'ok' : late ? 'err' : 'warn'}>{f.statut === 'payee' ? 'Payée' : late ? 'En retard' : 'À régler'}</Pastille>
          <button type="button" class="btn btn--primary btn--sm" onClick={() => print()}>
            <Icone n="print" />
            Imprimer ou enregistrer en PDF
          </button>
        </div>
      </div>
      <h1 class="sr-only" id="pro-titre" tabindex="-1">
        Facture {f.numero}
      </h1>
      <article class="sheet inv" aria-label={`Facture ${f.numero}`}>
        <p class="sheet__demo">Facture de démonstration · sans valeur comptable</p>
        <header class="inv__head">
          <div class="inv__from">
            <img class="sheet__logo" src="/logos/logo.svg" alt="Distillerie A. Blachère" width="200" height="49" />
            <p>
              <strong>{ent.nom || 'Distillerie A. Blachère'}</strong>
              <br />
              {(ent.adresse ? [ent.adresse] : infos.adresse).map((l, i) => (
                <span key={i}>
                  {l}
                  <br />
                </span>
              ))}
              Tél. {ent.telephone || infos.bureaux.tel} · {ent.email || infos.bureaux.email}
            </p>
          </div>
          <div class="inv__meta">
            <p class="inv__title">Facture</p>
            <dl>
              <div>
                <dt>Numéro</dt>
                <dd>{f.numero}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{dateLongue(f.date)}</dd>
              </div>
              <div>
                <dt>Échéance</dt>
                <dd>{dateLongue(f.echeance)}</dd>
              </div>
              <div>
                <dt>Commande</dt>
                <dd>
                  {c.numero}
                  {c.referenceClient ? ` · votre réf. ${c.referenceClient}` : ''}
                </dd>
              </div>
            </dl>
          </div>
        </header>
        <div class="inv__parties">
          <div>
            <p class="inv__k">Facturé à</p>
            <p>
              <strong>{compte.raisonSociale || compte.enseigne || session.compte?.raisonSociale}</strong>
              {compte.enseigne && compte.enseigne !== compte.raisonSociale ? <span> ({compte.enseigne})</span> : null}
              <br />
              {adresseLignes(facturation).map((l, i) => (
                <span key={i}>
                  {l}
                  <br />
                </span>
              ))}
              {compte.siret ? <span>SIRET {String(compte.siret).replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, `$1${NB}$2${NB}$3${NB}$4`)}</span> : null}
              {compte.tvaIntra ? <span> · TVA {compte.tvaIntra}</span> : null}
            </p>
          </div>
          <div>
            <p class="inv__k">Livré à</p>
            <p>
              {adresseLignes(c.livraison?.adresse).map((l, i) => (
                <span key={i}>
                  {l}
                  <br />
                </span>
              ))}
              {c.suivi?.numero ? (
                <span>
                  {c.suivi.transporteur || 'Transporteur'} · suivi {c.suivi.numero}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <table class="inv__table">
          <thead>
            <tr>
              <th scope="col">Désignation</th>
              <th scope="col" class="num">
                Qté
              </th>
              <th scope="col" class="num">
                PU HT
              </th>
              <th scope="col" class="num">
                TVA
              </th>
              <th scope="col" class="num">
                Total HT
              </th>
            </tr>
          </thead>
          <tbody>
            {(c.lignes || []).map((l) => (
              <tr key={`${l.slug}|${l.varianteId}`}>
                <td>
                  {typo(l.nom)} · {volume(l.varianteId, l.volume)}
                  {l.colisage > 1 ? <small> · {pluriel(Math.round(l.qte / l.colisage), 'carton')} de {l.colisage}</small> : null}
                </td>
                <td class="num">{l.qte}</td>
                <td class="num">{eur(l.prixUnitaireHT)}</td>
                <td class="num">{pourcent(l.tva)}</td>
                <td class="num">{eur(l.totalHT)}</td>
              </tr>
            ))}
            {(t.fraisPortHT || t.livraisonHT) > 0 && (
              <tr>
                <td>Frais de port</td>
                <td class="num">1</td>
                <td class="num">{eur(t.fraisPortHT || t.livraisonHT)}</td>
                <td class="num">au prorata</td>
                <td class="num">{eur(t.fraisPortHT || t.livraisonHT)}</td>
              </tr>
            )}
          </tbody>
        </table>
        <div class="inv__bottom">
          <div class="inv__tva">
            <p class="inv__k">Détail de la TVA</p>
            <table>
              <thead>
                <tr>
                  <th scope="col">Taux</th>
                  <th scope="col" class="num">
                    Base HT
                  </th>
                  <th scope="col" class="num">
                    Montant
                  </th>
                </tr>
              </thead>
              <tbody>
                {(t.tva || []).map((x) => (
                  <tr key={x.taux}>
                    <td>{pourcent(x.taux)}</td>
                    <td class="num">{eur(x.baseHT)}</td>
                    <td class="num">{eur(x.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {t.tva?.length > 1 && <p class="inv__fine">Frais de port ventilés au prorata des bases hors taxes de chaque taux.</p>}
          </div>
          <dl class="inv__totals">
            <div>
              <dt>Total HT</dt>
              <dd>{eur(t.totalHT ?? totalHT(c))}</dd>
            </div>
            <div>
              <dt>Total TVA</dt>
              <dd>{eur(t.totalTVA)}</dd>
            </div>
            <div class="inv__grand">
              <dt>Total TTC</dt>
              <dd>{eur(t.totalTTC ?? totalTTC(c))}</dd>
            </div>
            <div class="inv__due">
              <dt>{f.statut === 'payee' ? `Payée${f.payeeLe ? ` le ${dateCourte(f.payeeLe)}` : ''}` : 'Net à payer'}</dt>
              <dd>{f.statut === 'payee' ? eur(0) : eur(t.totalTTC ?? totalTTC(c))}</dd>
            </div>
          </dl>
        </div>
        <footer class="inv__legal">
          <p>
            <strong>Règlement{NB}:</strong> {CONDITIONS[compte.conditions] || 'selon les conditions du compte'}, échéance le {dateLongue(f.echeance)}. Coordonnées bancaires{NB}: <Afc />. Escompte pour paiement anticipé{NB}: <Afc />.
          </p>
          <p>
            En cas de retard de paiement, pénalités au taux de <Afc /> (au moins trois fois le taux d’intérêt légal) et indemnité forfaitaire pour frais de recouvrement de 40{NB}€ (articles L.{NB}441-10 et D.{NB}441-5 du Code de commerce).
          </p>
          <p>
            {(ent.raisonSociale || 'SARL Distillerie A. Blachère')} · capital social <Afc /> · SIRET {ent.siret || SIRET || <Afc />} · RCS {ent.rcs || <Afc />} · TVA intracommunautaire {ent.tvaIntra || <Afc />}.
          </p>
          {alcool && <p class="inv__evin">{EVIN}</p>}
        </footer>
      </article>
    </>
  );
}

const Afc = () => <span class="sheet__tbc">à compléter</span>;

const Retour = () => (
  <p class="pro-back">
    <a href="/espace-pro/factures">
      <Icone n="back" /> Toutes les factures
    </a>
  </p>
);
