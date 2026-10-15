// Documents à imprimer (nouvel onglet, A4, noir sur blanc) : facture, bon de préparation et
// feuille d'émargement d'une visite.
import { useEffect } from 'preact/hooks';
import { elements, useCrm } from '../lib/data.js';
import { correspond, useQuery } from '../lib/router.jsx';
import { useSession } from '../lib/session.jsx';
import { Icon } from '../ui/icons.jsx';
import { Marque } from '../ui/marque.jsx';
import { CANAL, COMMANDE, CONDITIONS, LANGUE, LIVRAISON, MOMENT, PAIEMENT_MODE, RESERVATION } from '../lib/statuts.js';
import { ajouterJours, aujourdHui, date, dateHeure, euros, heure, jourSemaine, nombre, pluriel, taux, telephone } from '../lib/format.js';
import { factureStatut, formatAdresse } from '../screens/commande.jsx';

const ENTREPRISE_DEFAUT = {
  nom: 'Distillerie A. Blachère',
  adresse: '1695 route de Sorgues, quartier Cansaud\n84230 Châteauneuf-du-Pape',
  telephone: '04 90 83 55 65',
  email: '',
};
const A_COMPLETER = 'à compléter';

export function Impression({ path }) {
  let m = correspond('/crm/imprimer/facture/:id', path);
  if (m) return <Facture id={m.id} />;
  m = correspond('/crm/imprimer/preparation/:id', path);
  if (m) return <Preparation id={m.id} />;
  m = correspond('/crm/imprimer/emargement/:id', path);
  if (m) return <Emargement id={m.id} />;
  return (
    <Feuille titre="Document introuvable">
      <p>Ce document n’existe pas.</p>
    </Feuille>
  );
}

function Barre({ titre }) {
  return (
    <div class="print-barre" role="toolbar" aria-label="Impression">
      <span class="print-barre__titre">{titre}</span>
      <div class="btn-row">
        <button type="button" class="btn btn--primary" onClick={() => window.print()}>
          <Icon name="imprimer" />
          Imprimer
        </button>
        <button type="button" class="btn" onClick={() => (window.opener ? window.close() : history.back())}>
          Fermer
        </button>
      </div>
    </div>
  );
}

function Feuille({ titre, children, etat }) {
  useEffect(() => {
    document.title = `${titre} · Distillerie A. Blachère`;
    document.documentElement.classList.add('impression');
    return () => document.documentElement.classList.remove('impression');
  }, [titre]);
  return (
    <div class="print">
      <Barre titre={titre} />
      <main class="print__page" id="contenu">
        {etat || children}
      </main>
    </div>
  );
}

const Chargement = () => <p class="print__etat">Chargement du document…</p>;
const ErreurDoc = ({ e }) => <p class="print__etat">{e?.status === 401 ? 'Connectez-vous au CRM pour imprimer ce document.' : e?.message || 'Document introuvable.'}</p>;

function useEntreprise(cmd) {
  const s = useSession();
  const r = useCrm(s.peut('parametres') ? 'parametres' : null, {});
  const p = r.data?.parametres || r.data;
  return { ...ENTREPRISE_DEFAUT, ...(cmd?.entreprise || {}), ...(p?.entreprise || {}) };
}

function Entete({ titre, sous, droite }) {
  return (
    <header class="doc__entete">
      <img class="doc__logo" src="/logos/logo.svg" alt="Distillerie A. Blachère" width="200" height="49" />
      <div class="doc__titre">
        <h1>{titre}</h1>
        {sous && <p>{sous}</p>}
        {droite}
      </div>
    </header>
  );
}

const Demo = () => <p class="doc__demo">Document de démonstration (maquette V2X Studio) : données fictives, sans valeur comptable.</p>;

// ---------- Facture ----------
function Facture({ id }) {
  const r = useCrm('commande', { id });
  const c = r.data?.commande || r.data;
  const ent = useEntreprise(r.data);
  if (!c) return <Feuille titre="Facture" etat={r.error ? <ErreurDoc e={r.error} /> : <Chargement />} />;
  const f = c.facture;
  const pro = c.canal === 'pro';
  const compte = r.data?.compte || c.compte || {};
  const t = c.totaux || {};
  const st = factureStatut(f);
  const adresseFact = pro ? compte.adresseFacturation || c.livraison?.adresse : r.data?.client?.adresse || c.livraison?.adresse;
  const alcool = (c.lignes || []).some((l) => l.alcool);
  if (!f) {
    return (
      <Feuille titre="Facture">
        <p class="print__etat">Pas encore de facture pour la commande {c.numero} : elle est émise à l’expédition pour les commandes pro.</p>
      </Feuille>
    );
  }
  const livraisonHT = t.livraisonTTC ? Math.max(0, (t.totalHT || 0) - (t.articlesHT || 0) + (t.remiseHT || 0)) : 0;
  return (
    <Feuille titre={`Facture ${f.numero}`}>
      <article class="doc">
        <Entete
          titre="Facture"
          droite={
            <dl class="doc__ref">
              <div>
                <dt>Numéro</dt>
                <dd>{f.numero}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{date(f.date)}</dd>
              </div>
              <div>
                <dt>Échéance</dt>
                <dd>{date(f.echeance)}</dd>
              </div>
              <div>
                <dt>Commande</dt>
                <dd>{c.numero}</dd>
              </div>
            </dl>
          }
        />
        <div class="doc__parties">
          <section>
            <h2>Vendeur</h2>
            <p class="strong">{ent.nom}</p>
            {String(ent.adresse || '')
              .split('\n')
              .map((l, i) => (
                <p key={i}>{l}</p>
              ))}
            {ent.telephone && <p>Tél. {telephone(ent.telephone)}</p>}
            {ent.email && <p>{ent.email}</p>}
            <p>SIRET : {ent.siret || <em class="doc__acompleter">{A_COMPLETER}</em>}</p>
            <p>TVA intracommunautaire : {ent.tvaIntra || <em class="doc__acompleter">{A_COMPLETER}</em>}</p>
            <p>RCS : {ent.rcs || <em class="doc__acompleter">{A_COMPLETER}</em>}</p>
          </section>
          <section>
            <h2>Client</h2>
            <p class="strong">{pro ? compte.raisonSociale || compte.enseigne || c.contact?.nom : c.contact?.nom}</p>
            {pro && compte.enseigne && compte.enseigne !== compte.raisonSociale && <p>{compte.enseigne}</p>}
            {formatAdresse(adresseFact ? { ...adresseFact, nom: null } : null).map((l, i) => (
              <p key={i}>{l}</p>
            ))}
            {c.contact?.email && <p>{c.contact.email}</p>}
            {pro && compte.siret && <p>SIRET : {compte.siret}</p>}
            {pro && compte.tvaIntra && <p>TVA : {compte.tvaIntra}</p>}
            {c.referenceClient && <p>Votre référence : {c.referenceClient}</p>}
          </section>
        </div>
        <table class="doc__table">
          <thead>
            <tr>
              <th>Désignation</th>
              <th class="num">Qté</th>
              <th class="num">PU HT</th>
              <th class="num">TVA</th>
              <th class="num">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {(c.lignes || []).map((l, i) => (
              <tr key={i}>
                <td>
                  <Marque texte={l.nom} /> · {l.volume}
                </td>
                <td class="num">{nombre(l.qte)}</td>
                <td class="num">{euros(l.prixUnitaireHT)}</td>
                <td class="num">{taux(l.tva)}</td>
                <td class="num">{euros(l.totalHT)}</td>
              </tr>
            ))}
            {t.remiseTTC > 0 && (
              <tr>
                <td colSpan={4}>Remise{c.promo?.code ? ` (code ${c.promo.code})` : ''} · TTC</td>
                <td class="num">−{euros(t.remiseTTC)}</td>
              </tr>
            )}
            {t.livraisonTTC > 0 && (
              <tr>
                <td colSpan={4}>Frais de port · {c.livraison?.libelle || LIVRAISON[c.livraison?.mode]?.label}</td>
                <td class="num">{euros(livraisonHT || t.livraisonTTC)}</td>
              </tr>
            )}
          </tbody>
        </table>
        <div class="doc__bas">
          <table class="doc__tva">
            <thead>
              <tr>
                <th>TVA</th>
                <th class="num">Base HT</th>
                <th class="num">Montant</th>
              </tr>
            </thead>
            <tbody>
              {(t.tva || []).map((v) => (
                <tr key={v.taux}>
                  <td>{taux(v.taux)}</td>
                  <td class="num">{euros(v.baseHT)}</td>
                  <td class="num">{euros(v.montant)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl class="doc__totaux">
            <div>
              <dt>Total HT</dt>
              <dd>{euros(t.totalHT)}</dd>
            </div>
            <div>
              <dt>Total TVA</dt>
              <dd>{euros(t.totalTVA)}</dd>
            </div>
            <div class="doc__ttc">
              <dt>Total TTC</dt>
              <dd>{euros(t.totalTTC)}</dd>
            </div>
            <div class="doc__net">
              <dt>{st === 'payee' ? 'Payée' : 'Net à payer'}</dt>
              <dd>{st === 'payee' ? (f.payeeLe ? `le ${date(f.payeeLe)}` : euros(0)) : euros(t.totalTTC)}</dd>
            </div>
          </dl>
        </div>
        <section class="doc__conditions">
          <h2>Conditions de paiement</h2>
          <p>
            {pro ? CONDITIONS[compte.conditions] || PAIEMENT_MODE[c.paiement?.mode] || '—' : PAIEMENT_MODE[c.paiement?.mode] || '—'} · échéance le {date(f.echeance)}
            {st === 'payee' ? ' · facture acquittée' : ''}.
          </p>
          <p>Règlement par virement : coordonnées bancaires <em class="doc__acompleter">{A_COMPLETER}</em>.</p>
        </section>
        <footer class="doc__mentions">
          <p>
            En cas de retard de paiement, pénalités égales à trois fois le taux d’intérêt légal et indemnité forfaitaire de 40 € pour frais de recouvrement (articles L441-10 et D441-5 du Code de commerce). Pas d’escompte pour paiement anticipé.
          </p>
          {alcool && <p>L’abus d’alcool est dangereux pour la santé, à consommer avec modération.</p>}
          <p>
            {ent.nom} · {String(ent.adresse || '').replace(/\n/g, ', ')}
          </p>
          <Demo />
        </footer>
      </article>
    </Feuille>
  );
}

// ---------- Bon de préparation ----------
const cartonsDe = (qte, col) => (col > 1 ? `${Math.floor(qte / col)}${qte % col ? ` + ${qte % col}` : ''}` : '—');

function Preparation({ id }) {
  const r = useCrm('commande', { id });
  const c = r.data?.commande || r.data;
  if (!c) return <Feuille titre="Bon de préparation" etat={r.error ? <ErreurDoc e={r.error} /> : <Chargement />} />;
  const l = c.livraison || {};
  const compte = r.data?.compte || c.compte || {};
  const lignes = c.lignes || [];
  const bouteilles = lignes.reduce((n, x) => n + (x.qte || 0), 0);
  const cartons = lignes.reduce((n, x) => n + (x.colisage > 1 ? Math.floor(x.qte / x.colisage) : 0), 0);
  return (
    <Feuille titre={`Bon de préparation ${c.numero}`}>
      <article class="doc">
        <Entete
          titre="Bon de préparation"
          droite={
            <dl class="doc__ref">
              <div>
                <dt>Commande</dt>
                <dd>{c.numero}</dd>
              </div>
              <div>
                <dt>Passée le</dt>
                <dd>{dateHeure(c.createdAt)}</dd>
              </div>
              <div>
                <dt>Canal</dt>
                <dd>{CANAL[c.canal]?.label || c.canal}</dd>
              </div>
              <div>
                <dt>Statut</dt>
                <dd>{COMMANDE[c.statut]?.label || c.statut}</dd>
              </div>
            </dl>
          }
        />
        <div class="doc__parties">
          <section>
            <h2>Client</h2>
            <p class="strong">{c.canal === 'pro' ? compte.enseigne || compte.raisonSociale || c.contact?.nom : c.contact?.nom}</p>
            {c.contact?.telephone && <p>Tél. {telephone(c.contact.telephone)}</p>}
            {c.contact?.email && <p>{c.contact.email}</p>}
            {c.referenceClient && <p>Référence client : {c.referenceClient}</p>}
          </section>
          <section>
            <h2>Livraison</h2>
            <p class="strong">{l.libelle || LIVRAISON[l.mode]?.label || l.mode}</p>
            {l.mode === 'retrait' && l.jourRetrait && <p>Retrait prévu {jourSemaine(l.jourRetrait)}</p>}
            {l.relais && <p>{l.relais.nom}</p>}
            {formatAdresse(l.adresse).map((x, i) => (
              <p key={i}>{x}</p>
            ))}
            {l.adresse?.instructions && <p>« {l.adresse.instructions} »</p>}
            {c.dateSouhaitee && <p>Date souhaitée : {date(c.dateSouhaitee)}</p>}
          </section>
        </div>
        {c.commentaire && (
          <p class="doc__commentaire">
            <strong>Commentaire du client :</strong> {c.commentaire}
          </p>
        )}
        <table class="doc__table doc__table--prep">
          <thead>
            <tr>
              <th class="doc__case">
                <span class="sr-only">Préparé</span>
              </th>
              <th>Produit</th>
              <th>Contenance</th>
              <th class="num">Bouteilles</th>
              <th class="num">Cartons</th>
              <th class="num">Colisage</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((x, i) => (
              <tr key={i}>
                <td class="doc__case">
                  <span class="doc__boite" aria-hidden="true" />
                </td>
                <td>
                  <strong>
                    <Marque texte={x.nom} />
                  </strong>
                  {x.alcool && <span class="doc__18"> 18+</span>}
                </td>
                <td>{x.volume}</td>
                <td class="num doc__qte">{nombre(x.qte)}</td>
                <td class="num">{cartonsDe(x.qte, x.colisage)}</td>
                <td class="num">{x.colisage > 1 ? `× ${x.colisage}` : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td />
              <td colSpan={2}>Total</td>
              <td class="num">{nombre(bouteilles)}</td>
              <td class="num">{cartons ? nombre(cartons) : '—'}</td>
              <td />
            </tr>
          </tfoot>
        </table>
        {(c.notes || []).length > 0 && (
          <section class="doc__notes">
            <h2>Notes internes</h2>
            {c.notes.map((n, i) => (
              <p key={i}>
                {n.texte} <span class="doc__gris">— {n.par?.nom || n.par}</span>
              </p>
            ))}
          </section>
        )}
        <div class="doc__signatures">
          <div>
            <span>Préparé par</span>
            <span>Le</span>
          </div>
          <div>
            <span>Contrôlé par</span>
            <span>Colis : ……</span>
          </div>
        </div>
        <footer class="doc__mentions">
          <p>Vérifier l’état des bouteilles et le bouchage ; caler les bouteilles debout. Imprimé le {dateHeure(new Date())}.</p>
          <Demo />
        </footer>
      </article>
    </Feuille>
  );
}

// ---------- Feuille d'émargement ----------
function Emargement({ id }) {
  const [q] = useQuery();
  const jour = q.get('date');
  const du = jour || aujourdHui();
  const au = jour || ajouterJours(du, 60);
  const r = useCrm('visites', { du, au });
  const seance = elements(r.data?.seances).find((s) => s.id === id);
  const reservations = elements(r.data?.reservations).filter((x) => x.seanceId === id && x.statut !== 'annulee');
  if (!seance) return <Feuille titre="Feuille d’émargement" etat={r.error ? <ErreurDoc e={r.error} /> : r.data ? <p class="print__etat">Séance introuvable.</p> : <Chargement />} />;
  const total = reservations.reduce((t, x) => t + (x.personnes || 0), 0);
  const mineurs = reservations.reduce((t, x) => t + (x.mineurs || 0), 0);
  const tri = [...reservations].sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr'));
  return (
    <Feuille titre={`Émargement ${date(seance.date)} ${heure(seance.heure)}`}>
      <article class="doc">
        <Entete
          titre="Feuille d’émargement"
          sous="Visite de la distillerie"
          droite={
            <dl class="doc__ref">
              <div>
                <dt>Jour</dt>
                <dd>{jourSemaine(seance.date)}</dd>
              </div>
              <div>
                <dt>Heure</dt>
                <dd>
                  {heure(seance.heure)} · {MOMENT[seance.moment] || ''}
                </dd>
              </div>
              <div>
                <dt>Langue</dt>
                <dd>{LANGUE[seance.langue] || 'Français'}</dd>
              </div>
              <div>
                <dt>Guide</dt>
                <dd>{seance.guide?.nom || '……………………'}</dd>
              </div>
            </dl>
          }
        />
        <p class="doc__resume">
          {pluriel(reservations.length, 'réservation', 'réservations')} · {pluriel(total, 'personne attendue', 'personnes attendues')}
          {mineurs ? ` dont ${pluriel(mineurs, 'mineur', 'mineurs')} (pas de dégustation d’alcool)` : ''} · capacité {nombre(seance.capacite)}
        </p>
        <table class="doc__table doc__table--emarg">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Réf.</th>
              <th class="num">Pers.</th>
              <th class="num">Mineurs</th>
              <th>Téléphone</th>
              <th class="doc__case">Présent</th>
              <th class="doc__sign">Signature</th>
            </tr>
          </thead>
          <tbody>
            {tri.map((x) => (
              <tr key={x.id}>
                <td>
                  <strong>{x.nom}</strong>
                  {(x.message || x.notes) && <span class="doc__gris"> · {x.message || x.notes}</span>}
                </td>
                <td class="doc__mono">{x.reference}</td>
                <td class="num">{x.personnes}</td>
                <td class="num">{x.mineurs || '—'}</td>
                <td>{x.telephone ? telephone(x.telephone) : '—'}</td>
                <td class="doc__case">
                  <span class="doc__boite" aria-hidden="true" />
                </td>
                <td class="doc__sign" />
              </tr>
            ))}
            {Array.from({ length: Math.max(3, 8 - tri.length) }, (_, i) => (
              <tr key={`v${i}`} class="doc__vide">
                <td>&nbsp;</td>
                <td />
                <td />
                <td />
                <td />
                <td class="doc__case">
                  <span class="doc__boite" aria-hidden="true" />
                </td>
                <td class="doc__sign" />
              </tr>
            ))}
          </tbody>
        </table>
        <footer class="doc__mentions">
          <p>Dégustation des alcools réservée aux personnes majeures. L’abus d’alcool est dangereux pour la santé, à consommer avec modération.</p>
          <p>Statuts à reporter dans le CRM après la visite : {RESERVATION.venue.label.toLowerCase()} ou {RESERVATION.absente.label.toLowerCase()}. Imprimé le {dateHeure(new Date())}.</p>
          <Demo />
        </footer>
      </article>
    </Feuille>
  );
}
