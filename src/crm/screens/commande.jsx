// Fiche commande : étapes et transitions permises, suivi du colis, paiement et facture, lignes
// avec TVA, totaux ventilés par taux, client ou compte, livraison, historique et notes internes.
import { useState } from 'preact/hooks';
import { crm, invalider, useCrm } from '../lib/data.js';
import { useFil, useSession } from '../lib/session.jsx';
import { Link } from '../lib/router.jsx';
import { Icon } from '../ui/icons.jsx';
import { Avatar, Button, Card, Empty, Erreur, Notice, PageHead, Pill, SkeletonPage, Statut, cx, useTitre } from '../ui/base.jsx';
import { Dialog, Menu, MenuItem, confirmer, toast } from '../ui/overlay.jsx';
import { Input, Select, Textarea, erreurDe } from '../ui/form.jsx';
import { Marque } from '../ui/marque.jsx';
import { Ruban } from '../ui/ruban.jsx';
import { CANAL, COMMANDE, FACTURE, LIVRAISON, PAIEMENT_MODE, PAIEMENT_STATUT, TRANSITION, CONDITIONS } from '../lib/statuts.js';
import { aujourdHui, date, dateHeure, euros, heure, jourSemaine, nombre, pluriel, relatif, taux, telephone } from '../lib/format.js';

const TRANSPORTEURS = ['Colissimo', 'Chronopost', 'DPD', 'GLS', 'Transporteur de la distillerie', 'Autre'];
const AVANT = new Set(['en-preparation', 'prete', 'expediee', 'livree', 'retiree']);

export function factureStatut(f) {
  if (!f) return null;
  if (f.statut === 'payee') return 'payee';
  if (f.enRetard || (f.echeance && f.echeance.slice(0, 10) < aujourdHui())) return 'en-retard';
  return f.statut || 'a-regler';
}

export function Commande({ id }) {
  const s = useSession();
  const r = useCrm('commande', { id });
  const c = r.data?.commande || r.data;
  useTitre(c?.numero ? `Commande ${c.numero}` : 'Commande');
  useFil(c?.numero);
  const [expedier, setExpedier] = useState(false);
  const [busy, setBusy] = useState(null);

  if (r.error && !c) {
    return (
      <div class="page">
        <PageHead titre="Commande" retour={{ href: '/crm/commandes', label: 'Commandes' }} />
        {r.error.status === 404 ? <Empty icone="commandes" titre="Commande introuvable" texte="Elle a peut-être été supprimée, ou l’adresse est incomplète." action={<Button href="/crm/commandes">Toutes les commandes</Button>} /> : <Erreur erreur={r.error} onRetry={r.reload} />}
      </div>
    );
  }
  if (!c) {
    return (
      <div class="page">
        <SkeletonPage />
      </div>
    );
  }

  const pro = c.canal === 'pro' || !!c.compteId;
  const peutModifier = pro ? s.peut('commandes-pro', 'ecriture') : s.peut('commandes', 'ecriture');
  const voitFactures = s.peut('factures');
  const transitions = (r.data?.transitions || c.transitions || []).filter((t) => t !== c.statut);
  const principales = transitions.filter((t) => AVANT.has(t));
  const secondaires = transitions.filter((t) => !AVANT.has(t));
  const fStatut = factureStatut(c.facture);
  const client = r.data?.client || c.client;
  const compte = r.data?.compte || c.compte;

  const maj = (data) => {
    if (data && (data.commande || data.id)) r.mutate((x) => (x?.commande ? { ...x, ...data, commande: data.commande || data } : { ...(x || {}), ...data }));
    else r.reload({ silencieux: true });
    invalider('commandes', 'tableau');
  };

  const patch = async (body, cle) => {
    setBusy(cle);
    try {
      const data = await crm('commande', { method: 'PATCH', query: { id: c.id }, body });
      maj(data);
      return data;
    } finally {
      setBusy(null);
    }
  };

  const transition = async (t) => {
    if (t === 'expediee') {
      setExpedier(true);
      return;
    }
    const faire = async () => {
      await patch({ statut: t }, t);
      toast(`Commande ${c.numero} : ${COMMANDE[t].label.toLowerCase()}`, { detail: messageCourriel(t, c) });
    };
    if (t === 'annulee' || t === 'remboursee') {
      await confirmer({
        titre: t === 'annulee' ? `Annuler la commande ${c.numero} ?` : `Rembourser la commande ${c.numero} ?`,
        message:
          t === 'annulee'
            ? `Les produits reviennent en stock${c.paiement?.statut === 'paye' ? ' et le paiement est remboursé' : ''}. ${c.contact?.nom || 'Le client'} reçoit un courriel.`
            : `Le montant de ${euros(c.totaux?.totalTTC)} est marqué comme remboursé et le client reçoit un courriel.`,
        confirmer: t === 'annulee' ? 'Annuler la commande' : 'Rembourser',
        annuler: 'Retour',
        danger: true,
        action: faire,
      });
      return;
    }
    try {
      await faire();
    } catch (e) {
      toast.erreur(e);
    }
  };

  return (
    <div class="page">
      <PageHead
        titre={
          <span class="row row--wrap" style="gap:12px">
            <span class="tnum">{c.numero}</span>
            <Statut table={COMMANDE} valeur={c.statut} lg />
          </span>
        }
        retour={{ href: '/crm/commandes', label: 'Commandes' }}
        sous={
          <>
            <span class="canal">
              <Icon name={CANAL[c.canal]?.icone || 'globe'} size="xs" />
              {CANAL[c.canal]?.label || c.canal}
            </span>
            <span>Passée le {dateHeure(c.createdAt)}</span>
            {c.auteur?.nom || c.auteurNom ? <span>par {c.auteur?.nom || c.auteurNom}</span> : null}
          </>
        }
        actions={
          <>
            {c.facture && voitFactures && (
              <Button href={`/crm/imprimer/facture/${c.id}`} target="_blank" rel="noopener" icon="facture">
                Facture
              </Button>
            )}
            <Button href={`/crm/imprimer/preparation/${c.id}`} target="_blank" rel="noopener" icon="imprimer">
              <span class="hide-s">Bon de préparation</span>
            </Button>
          </>
        }
      />

      <div class="cols cols--main">
        <div class="stack">
          <Card titre="Suivi de la commande" icone="route" corps={false}>
            <div class="card__body stack stack--s">
              <Etapes c={c} />
              {c.suivi?.numero && (
                <div class="suivi">
                  <Icon name="camion" />
                  <span>
                    {c.suivi.transporteur || 'Transporteur'} · <span class="mono">{c.suivi.numero}</span>
                  </span>
                  {c.suivi.url && (
                    <a class="link" href={c.suivi.url} target="_blank" rel="noopener noreferrer">
                      Suivre le colis
                      <Icon name="externe" size="xs" style="display:inline;vertical-align:-2px;margin-left:4px" />
                    </a>
                  )}
                </div>
              )}
              {peutModifier && transitions.length > 0 && (
                <div class="btn-row etapes__actions only-desk-flex">
                  {principales.map((t) => (
                    <Button key={t} variant="primary" icon={TRANSITION[t]?.icone} busy={busy === t} onClick={() => transition(t)}>
                      {TRANSITION[t]?.label || t}
                    </Button>
                  ))}
                  {secondaires.map((t) => (
                    <Button key={t} variant="danger-soft" icon={TRANSITION[t]?.icone} busy={busy === t} onClick={() => transition(t)}>
                      {TRANSITION[t]?.label || t}
                    </Button>
                  ))}
                </div>
              )}
              {!peutModifier && transitions.length > 0 && <p class="small muted">Votre profil consulte cette commande en lecture seule.</p>}
            </div>
          </Card>

          <Lignes c={c} pro={pro} />
          <Historique c={c} />
        </div>

        <div class="stack">
          <CarteClient c={c} client={client} compte={compte} pro={pro} />
          <CarteLivraison c={c} />
          <CartePaiement c={c} peutModifier={peutModifier} patch={patch} busy={busy} />
          {c.facture && voitFactures && <CarteFacture c={c} statut={fStatut} peutModifier={peutModifier} patch={patch} busy={busy} />}
          <Notes c={c} patch={patch} peutModifier={peutModifier || s.peut('commandes', 'lecture')} />
        </div>
      </div>

      {peutModifier && transitions.length > 0 && (
        <div class="dock">
          {principales.slice(0, 1).map((t) => (
            <Button key={t} variant="primary" icon={TRANSITION[t]?.icone} busy={busy === t} onClick={() => transition(t)}>
              {TRANSITION[t]?.label || t}
            </Button>
          ))}
          {(principales.length > 1 || secondaires.length > 0) && (
            <Menu label="Autres actions" haut bouton={(props) => <Button icon="points" aria-label="Autres actions" {...props} />}>
              {(fermer) => (
                <>
                  {principales.slice(1).map((t) => (
                    <MenuItem key={t} icone={TRANSITION[t]?.icone} fermer={fermer} onSelect={() => transition(t)}>
                      {TRANSITION[t]?.label}
                    </MenuItem>
                  ))}
                  {secondaires.map((t) => (
                    <MenuItem key={t} icone={TRANSITION[t]?.icone} danger fermer={fermer} onSelect={() => transition(t)}>
                      {TRANSITION[t]?.label}
                    </MenuItem>
                  ))}
                </>
              )}
            </Menu>
          )}
        </div>
      )}

      {expedier && (
        <DialogExpedition
          c={c}
          pro={pro}
          onClose={() => setExpedier(false)}
          onValider={async (suivi) => {
            await patch({ statut: 'expediee', suivi }, 'expediee');
            setExpedier(false);
            toast(`Commande ${c.numero} expédiée`, { detail: suivi ? `${c.contact?.nom || 'Le client'} a reçu le numéro de suivi par courriel.` : 'Livraison par le transporteur de la distillerie.' });
          }}
        />
      )}
    </div>
  );
}

function messageCourriel(t, c) {
  const nom = c.contact?.nom || 'Le client';
  if (t === 'en-preparation') return `${nom} est prévenu que sa commande est en préparation.`;
  if (t === 'prete') return `${nom} est prévenu que sa commande l’attend à la distillerie.`;
  if (t === 'annulee') return 'Stocks remis à jour, courriel envoyé.';
  if (t === 'remboursee') return 'Courriel de remboursement envoyé.';
  return undefined;
}

// Étapes : retrait (nouvelle → préparation → prête → retirée) ou envoi (… → expédiée → livrée)
function Etapes({ c }) {
  const retrait = c.livraison?.mode === 'retrait';
  const etapes = retrait ? ['nouvelle', 'en-preparation', 'prete', 'retiree'] : ['nouvelle', 'en-preparation', 'expediee', 'livree'];
  const fin = c.statut === 'annulee' || c.statut === 'remboursee';
  let courant = etapes.indexOf(c.statut);
  if (courant < 0) {
    const passes = new Set((c.historique || []).map((h) => h.statut).filter(Boolean));
    courant = 0;
    etapes.forEach((e, i) => {
      if (passes.has(e)) courant = i;
    });
  }
  const dernier = etapes.length - 1;
  const dateDe = (st) => {
    if (st === 'nouvelle') return c.createdAt;
    const h = [...(c.historique || [])].reverse().find((x) => x.statut === st);
    return h?.date;
  };
  return (
    <div>
      <ol class={cx('etapes', fin && 'etapes--fin')} aria-label="Étapes de la commande">
        {etapes.map((e, i) => {
          const fait = i < courant || (i === courant && (i === dernier || fin));
          const actuel = !fin && i === courant && i !== dernier;
          const d = i <= courant ? dateDe(e) : null;
          return (
            <li key={e} class={cx('etape', fait && 'is-done', actuel && 'is-current')} aria-current={actuel ? 'step' : undefined}>
              <span class="etape__pt" aria-hidden="true">
                {fait ? <Icon name="check" size="xs" /> : null}
              </span>
              <span class="etape__txt">
                <span class="etape__lab">
                  {COMMANDE[e].court || COMMANDE[e].label}
                  <span class="sr-only">{fait ? ' : fait' : actuel ? ' : en cours' : ' : à venir'}</span>
                </span>
                {d && <span class="etape__date">{date(d)}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {fin && (
        <Notice ton={c.statut === 'annulee' ? 'warn' : 'info'} class="etapes__fin">
          Commande {COMMANDE[c.statut].label.toLowerCase()}
          {dateDe(c.statut) ? ` le ${dateHeure(dateDe(c.statut))}` : ''}.
        </Notice>
      )}
    </div>
  );
}

function DialogExpedition({ c, pro, onClose, onValider }) {
  const proTransporteur = pro && c.livraison?.mode === 'transporteur';
  const [f, setF] = useState({ transporteur: c.livraison?.mode === 'colissimo' || c.livraison?.mode === 'relais' ? 'Colissimo' : proTransporteur ? 'Transporteur de la distillerie' : 'Colissimo', numero: '', url: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const requis = !proTransporteur;
  const envoyer = async () => {
    if (requis && f.numero.trim().length < 4) {
      setErr({ champ: 'numero', message: 'Le numéro de suivi est obligatoire pour une expédition.' });
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const suivi = f.numero.trim() ? { transporteur: f.transporteur, numero: f.numero.trim(), ...(f.url.trim() ? { url: f.url.trim() } : {}) } : proTransporteur ? { transporteur: f.transporteur, numero: f.numero.trim() || undefined } : undefined;
      await onValider(suivi);
    } catch (e) {
      setErr(e);
      setBusy(false);
    }
  };
  return (
    <Dialog
      titre={`Expédier ${c.numero}`}
      sous={requis ? 'Le client reçoit un courriel avec le numéro de suivi.' : 'Livraison par le transporteur de la distillerie : le numéro de suivi est facultatif.'}
      icone="camion"
      onClose={onClose}
      onSubmit={envoyer}
      pied={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary" icon="camion" busy={busy}>
            Marquer expédiée
          </Button>
        </>
      }
    >
      <div class="form">
        <div class="form-grid">
          <Select label="Transporteur" value={f.transporteur} onChange={(e) => setF({ ...f, transporteur: e.currentTarget.value })} options={TRANSPORTEURS} />
          <Input label="Numéro de suivi" opt={!requis} value={f.numero} onInput={(e) => setF({ ...f, numero: e.currentTarget.value })} error={erreurDe(err, 'numero', 'suivi')} autoComplete="off" spellcheck={false} placeholder="6A12345678901" />
        </div>
        <Input label="Lien de suivi" opt type="url" value={f.url} onInput={(e) => setF({ ...f, url: e.currentTarget.value })} placeholder="https://…" error={erreurDe(err, 'url')} />
        {c.livraison?.adresse && (
          <div class="card card--inset">
            <div class="card__body--tight small">
              <span class="muted">Adresse de livraison : </span>
              {formatAdresse(c.livraison.adresse).join(', ')}
            </div>
          </div>
        )}
        {err && !erreurDe(err, 'numero', 'suivi', 'url') && <Notice ton="err">{err.message}</Notice>}
      </div>
    </Dialog>
  );
}

export function formatAdresse(a) {
  if (!a) return [];
  return [a.nom, a.ligne1, a.ligne2, [a.cp, a.ville].filter(Boolean).join(' '), a.pays && a.pays !== 'France' ? a.pays : null].filter(Boolean);
}

// ---------- Lignes et totaux ----------
function Lignes({ c, pro }) {
  const t = c.totaux || {};
  const lignes = c.lignes || [];
  const alcool = lignes.some((l) => l.alcool);
  return (
    <Card titre="Articles" sous={`${pluriel(lignes.reduce((n, l) => n + (l.qte || 0), 0), 'bouteille', 'bouteilles')} · ${pluriel(lignes.length, 'référence', 'références')}`} icone="bouteille" corps={false}>
      <div class="tbl-wrap only-desk">
        <table class="tbl tbl--lignes">
          <caption class="sr-only">Lignes de la commande</caption>
          <thead>
            <tr>
              <th>Produit</th>
              <th class="num">TVA</th>
              <th class="num">Quantité</th>
              <th class="num">{pro ? 'Prix unit. HT' : 'Prix unit. TTC'}</th>
              <th class="num">{pro ? 'Total HT' : 'Total TTC'}</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={`${l.slug}-${l.varianteId}-${i}`}>
                <td>
                  <span class="ligne-prod">
                    <Vignette slug={l.slug} />
                    <span>
                      <span class="strong">
                        <Marque texte={l.nom} logo />
                      </span>
                      <span class="tbl__sub">
                        {l.volume}
                        {l.alcool && <span class="age18" style="margin-left:6px" title="Boisson alcoolisée">18+</span>}
                      </span>
                    </span>
                  </span>
                </td>
                <td class="num muted">{taux(l.tva)}</td>
                <td class="num">
                  {nombre(l.qte)}
                  {l.colisage > 1 && l.qte >= l.colisage && <span class="tbl__sub">{cartons(l.qte, l.colisage)}</span>}
                </td>
                <td class="num">{euros(pro ? l.prixUnitaireHT : l.prixUnitaireTTC)}</td>
                <td class="num strong">{euros(pro ? l.totalHT : l.totalTTC)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul class="lignes-mob only-mob">
        {lignes.map((l, i) => (
          <li key={i}>
            <Vignette slug={l.slug} />
            <div class="grow">
              <div class="strong">
                <Marque texte={l.nom} logo />
              </div>
              <div class="small muted">
                {l.volume} · TVA {taux(l.tva)}
                {l.alcool && <span class="age18" style="margin-left:6px">18+</span>}
              </div>
              <div class="small muted tnum">
                {nombre(l.qte)} × {euros(pro ? l.prixUnitaireHT : l.prixUnitaireTTC)}
                {l.colisage > 1 && l.qte >= l.colisage ? ` · ${cartons(l.qte, l.colisage)}` : ''}
              </div>
            </div>
            <div class="strong tnum">{euros(pro ? l.totalHT : l.totalTTC)}</div>
          </li>
        ))}
      </ul>
      <div class="totaux">
        {c.operation && (
          <p class="op-ligne">
            <Ruban />
            <span>
              <strong>{c.operation.nom || 'Octobre Rose'}</strong> : {euros(c.operation.montant)} {c.operation.montant > 1 ? 'reversés' : 'reversé'} à {c.operation.beneficiaire?.startsWith('l’') || c.operation.beneficiaire?.startsWith('l\'') ? c.operation.beneficiaire : `l’${c.operation.beneficiaire || 'Institut du Cancer Avignon-Provence'}`}
              {c.operation.bouteilles ? ` (${pluriel(c.operation.bouteilles, 'bouteille', 'bouteilles')} de PAC Citron)` : ''}
            </span>
          </p>
        )}
        <dl class="totaux__dl">
          <div>
            <dt>Articles {pro ? 'HT' : 'TTC'}</dt>
            <dd>{euros(pro ? t.articlesHT : t.articlesTTC)}</dd>
          </div>
          {t.remiseTTC > 0 && (
            <div>
              <dt>
                Remise{c.promo?.code ? <> · code <span class="mono">{c.promo.code}</span></> : ''}
              </dt>
              <dd>−{euros(t.remiseTTC)}</dd>
            </div>
          )}
          <div>
            <dt>Livraison{c.livraison?.libelle ? ` · ${c.livraison.libelle}` : ''}</dt>
            <dd>{t.livraisonTTC ? euros(t.livraisonTTC) : 'Offerte'}</dd>
          </div>
          <div class="totaux__sep">
            <dt>Total HT</dt>
            <dd>{euros(t.totalHT)}</dd>
          </div>
          {(t.tva || []).map((v) => (
            <div key={v.taux} class="totaux__tva">
              <dt>
                TVA {taux(v.taux)} <span class="muted">sur {euros(v.baseHT)}</span>
              </dt>
              <dd>{euros(v.montant)}</dd>
            </div>
          ))}
          <div class="totaux__total">
            <dt>Total TTC</dt>
            <dd>{euros(t.totalTTC)}</dd>
          </div>
        </dl>
        {alcool && <p class="small muted">L’abus d’alcool est dangereux pour la santé, à consommer avec modération.{c.ageConfirme ? ' Âge du client vérifié lors de la commande.' : ''}</p>}
      </div>
    </Card>
  );
}

export const cartons = (qte, colisage) => {
  const n = Math.floor(qte / colisage);
  const reste = qte % colisage;
  return `${pluriel(n, 'carton', 'cartons')} de ${colisage}${reste ? ` + ${reste}` : ''}`;
};

export function Vignette({ slug, taille = 'm' }) {
  const [ok, setOk] = useState(true);
  return (
    <span class={`vignette vignette--${taille}`} aria-hidden="true">
      {ok ? <img src={`/bouteilles/${slug}/vignette.webp`} alt="" loading="lazy" decoding="async" onError={() => setOk(false)} /> : <Icon name="bouteille" size="s" />}
    </span>
  );
}

// ---------- Historique ----------
function Historique({ c }) {
  const h = [...(c.historique || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <Card titre="Historique" icone="journal" corps={false}>
      {h.length === 0 ? (
        <Empty petit icone="journal" titre="Aucun évènement" />
      ) : (
        <ol class="timeline">
          {h.map((e, i) => (
            <li key={i} class={cx('timeline__item', e.statut && `timeline__item--${COMMANDE[e.statut]?.ton || 'mute'}`)}>
              <span class="timeline__pt" aria-hidden="true" />
              <div class="timeline__txt">
                <p>
                  <span class="strong">{e.action || COMMANDE[e.statut]?.label}</span>
                  {e.statut && e.action && <> · <Statut table={COMMANDE} valeur={e.statut} /></>}
                </p>
                {e.note && <p class="small">{e.note}</p>}
                <p class="small muted">
                  {e.par?.nom || 'Système'} · <time dateTime={e.date} title={dateHeure(e.date)}>{relatif(e.date)}</time>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

// ---------- Colonne latérale ----------
function CarteClient({ c, client, compte, pro }) {
  const s = useSession();
  const contact = c.contact || {};
  if (pro || compte) {
    const cp = compte || {};
    return (
      <Card titre="Compte pro" icone="store" actions={c.compteId && s.peut('comptes') && <Link class="more" href={`/crm/comptes/${c.compteId}`}>Fiche<Icon name="droite" /></Link>}>
        <div class="stack stack--s">
          <div class="row" style="gap:12px">
            <Avatar nom={cp.enseigne || cp.raisonSociale || contact.nom} cle={c.compteId} size="l" />
            <div style="min-width:0">
              <div class="strong">{cp.enseigne || cp.raisonSociale || contact.nom}</div>
              {cp.raisonSociale && cp.enseigne && cp.raisonSociale !== cp.enseigne && <div class="small muted">{cp.raisonSociale}</div>}
            </div>
          </div>
          <Contact contact={contact} />
          {c.referenceClient && (
            <div class="kv">
              <span>Référence client</span>
              <span class="mono">{c.referenceClient}</span>
            </div>
          )}
          {cp.conditions && (
            <div class="kv">
              <span>Conditions</span>
              <span>{CONDITIONS[cp.conditions] || cp.conditions}</span>
            </div>
          )}
        </div>
      </Card>
    );
  }
  const cl = client || {};
  return (
    <Card titre="Client" icone="client" actions={c.clientId && s.peut('clients') && <Link class="more" href={`/crm/clients/${c.clientId}`}>Fiche<Icon name="droite" /></Link>}>
      <div class="stack stack--s">
        <div class="row" style="gap:12px">
          <Avatar nom={contact.nom || [cl.prenom, cl.nom].join(' ')} cle={c.clientId || contact.email} size="l" />
          <div style="min-width:0">
            <div class="strong">{contact.nom || [cl.prenom, cl.nom].filter(Boolean).join(' ')}</div>
            {cl.commandes !== undefined && <div class="small muted">{pluriel(cl.commandes, 'commande', 'commandes')}{cl.totalTTC !== undefined ? ` · ${euros(cl.totalTTC)}` : ''}</div>}
          </div>
        </div>
        <Contact contact={contact} />
      </div>
    </Card>
  );
}

function Contact({ contact }) {
  return (
    <ul class="contact">
      {contact.email && (
        <li>
          <Icon name="mail" size="s" />
          <a class="link link--ink" href={`mailto:${contact.email}`}>
            {contact.email}
          </a>
        </li>
      )}
      {contact.telephone && (
        <li>
          <Icon name="telephone" size="s" />
          <a class="link link--ink" href={`tel:${contact.telephone.replace(/\s/g, '')}`}>
            {telephone(contact.telephone)}
          </a>
        </li>
      )}
    </ul>
  );
}

function CarteLivraison({ c }) {
  const l = c.livraison || {};
  const m = LIVRAISON[l.mode];
  return (
    <Card titre="Livraison" icone={m?.icone || 'camion'}>
      <div class="stack stack--s">
        <div class="row row--between">
          <span class="strong">{l.libelle || m?.label || l.mode}</span>
          <span class="tnum">{l.prixTTC ? euros(l.prixTTC) : 'Offerte'}</span>
        </div>
        {l.mode === 'retrait' && l.jourRetrait && (
          <p class="small">
            Retrait prévu <strong>{jourSemaine(l.jourRetrait)}</strong> à la distillerie, 1695 route de Sorgues, Châteauneuf-du-Pape.
          </p>
        )}
        {l.relais && (
          <p class="small">
            <strong>{l.relais.nom}</strong>
            <br />
            {typeof l.relais.adresse === 'string' ? l.relais.adresse : formatAdresse(l.relais.adresse).join(', ')}
          </p>
        )}
        {l.adresse && (
          <address class="adresse">
            {formatAdresse(l.adresse).map((x, i) => (
              <span key={i}>{x}</span>
            ))}
            {l.adresse.instructions && <span class="small muted">« {l.adresse.instructions} »</span>}
          </address>
        )}
        {c.dateSouhaitee && (
          <div class="kv">
            <span>Date souhaitée</span>
            <span>{date(c.dateSouhaitee)}</span>
          </div>
        )}
        {c.commentaire && (
          <div class="quote">
            <Icon name="message" size="s" />
            <p>{c.commentaire}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

function CartePaiement({ c, peutModifier, patch, busy }) {
  const p = c.paiement || {};
  const marquer = async () => {
    try {
      await patch({ paiementStatut: 'paye' }, 'paye');
      toast('Paiement enregistré');
    } catch (e) {
      toast.erreur(e);
    }
  };
  return (
    <Card titre="Paiement" icone="paiement">
      <div class="stack stack--s">
        <div class="row row--between">
          <span class="strong">{PAIEMENT_MODE[p.mode] || p.mode || '—'}</span>
          <Statut table={PAIEMENT_STATUT} valeur={p.statut} />
        </div>
        {p.reference && (
          <div class="kv">
            <span>Référence</span>
            <span class="mono">{p.reference}</span>
          </div>
        )}
        {p.date && (
          <div class="kv">
            <span>Réglé le</span>
            <span>{date(p.date)}</span>
          </div>
        )}
        {p.statut === 'en-attente' && peutModifier && (
          <Button size="sm" icon="check" busy={busy === 'paye'} onClick={marquer}>
            Marquer comme payée
          </Button>
        )}
      </div>
    </Card>
  );
}

function CarteFacture({ c, statut, peutModifier, patch, busy }) {
  const f = c.facture;
  const regler = async () => {
    try {
      await patch({ factureStatut: 'payee' }, 'facture');
      toast(`Facture ${f.numero} réglée`);
    } catch (e) {
      toast.erreur(e);
    }
  };
  return (
    <Card titre="Facture" icone="facture" actions={<Link class="more" href={`/crm/imprimer/facture/${c.id}`} target="_blank" rel="noopener">Imprimer<Icon name="externe" /></Link>}>
      <div class="stack stack--s">
        <div class="row row--between">
          <span class="strong mono">{f.numero}</span>
          <Statut table={FACTURE} valeur={statut} />
        </div>
        <div class="kv">
          <span>Émise le</span>
          <span>{date(f.date)}</span>
        </div>
        <div class="kv">
          <span>Échéance</span>
          <span class={statut === 'en-retard' ? 'strong' : ''} style={statut === 'en-retard' ? 'color:var(--err)' : ''}>
            {date(f.echeance)}
          </span>
        </div>
        {f.payeeLe && (
          <div class="kv">
            <span>Payée le</span>
            <span>{date(f.payeeLe)}</span>
          </div>
        )}
        {statut !== 'payee' && peutModifier && (
          <Button size="sm" icon="check" busy={busy === 'facture'} onClick={regler}>
            Marquer la facture payée
          </Button>
        )}
      </div>
    </Card>
  );
}

function Notes({ c, patch, peutModifier }) {
  const [texte, setTexte] = useState('');
  const [busy, setBusy] = useState(false);
  const notes = [...(c.notes || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  const ajouter = async (e) => {
    e.preventDefault();
    if (!texte.trim()) return;
    setBusy(true);
    try {
      await patch({ note: texte.trim() }, 'note');
      setTexte('');
      toast('Note ajoutée');
    } catch (x) {
      toast.erreur(x);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card titre="Notes internes" icone="note" sous="Visibles par l’équipe seulement">
      <div class="stack stack--s">
        {notes.map((n, i) => (
          <div class="note" key={i}>
            <p>{n.texte}</p>
            <p class="small muted">
              {n.par?.nom || n.par || 'Équipe'} · {relatif(n.date)}
            </p>
          </div>
        ))}
        {peutModifier && (
          <form class="stack stack--xs" onSubmit={ajouter}>
            <Textarea label="Ajouter une note" value={texte} onInput={(e) => setTexte(e.currentTarget.value)} rows={2} placeholder="Ex. : client rappelé, livraison avant 10 h…" style="min-height:72px" />
            <div class="btn-row btn-row--end">
              <Button type="submit" size="sm" busy={busy} disabled={!texte.trim()}>
                Ajouter
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}

export { Pill, heure };
