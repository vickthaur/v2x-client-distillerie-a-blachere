// Demandes de compte pro : liste par statut et fiche (volet de droite, plein écran sur téléphone) ;
// prise en charge, acceptation (crée le compte, l'utilisateur et l'invitation) ou refus motivé.
import { useEffect, useRef, useState } from 'preact/hooks';
import { crm, elements, invalider, useCrm } from '../lib/data.js';
import { useFil, useSession } from '../lib/session.jsx';
import { Link, navigate, origineNavigation, useQuery } from '../lib/router.jsx';
import { Icon } from '../ui/icons.jsx';
import { Avatar, Button, Chips, Empty, Erreur, Notice, PageHead, Pill, SkeletonRows, Statut, cx, useTitre, coupe } from '../ui/base.jsx';
import { Input, Select, Textarea, erreurDe, lireNombre } from '../ui/form.jsx';
import { Dialog, toast } from '../ui/overlay.jsx';
import { ApercuCourriel } from '../ui/courriel.jsx';
import { COMPTE_TYPE, CONDITIONS, DEMANDE, GRILLE, LICENCE } from '../lib/statuts.js';
import { date, dateHeure, nomComplet, pluriel, relatif, siret, telephone, typo } from '../lib/format.js';
import { Marque } from '../ui/marque.jsx';
import { useCommerciaux } from './comptes.jsx';

const PLURIEL = { nouvelle: 'Nouvelles', 'en-cours': 'En cours', acceptee: 'Acceptées', refusee: 'Refusées' };

const ORDRE = ['nouvelle', 'en-cours', 'acceptee', 'refusee'];
const grilleDe = (activite) => (activite === 'caviste' || activite === 'epicerie' ? 'caviste' : activite === 'distributeur' ? 'distributeur' : 'chr');

export function Demandes({ id }) {
  useTitre('Demandes pro');
  const [q, setQ] = useQuery();
  const statut = q.get('statut') ?? '';
  const r = useCrm('demandes', { statut }, { garder: true });
  const liste = elements(r.data, 'demandes');
  const compteurs = r.data?.compteurs || {};
  const choisie = liste.find((x) => x.id === id);
  const lien = (x) => `/crm/demandes/${x.id}${statut ? `?statut=${statut}` : ''}`;

  return (
    <div class={cx('page page--wide split-page', id && 'has-detail')}>
      <div class="split">
        <section class="split__list" aria-label="Liste des demandes">
          <PageHead titre="Demandes pro" sous="Demandes d’ouverture de compte reçues par le site" />
          <Chips
            label="Statut"
            items={[
              { id: '', label: 'Toutes', n: compteurs.toutes ?? compteurs.total ?? (r.data ? ORDRE.reduce((t, k) => t + (compteurs[k] || 0), 0) : undefined) },
              ...ORDRE.map((k) => ({ id: k, label: PLURIEL[k] || DEMANDE[k].label, n: ['nouvelle', 'en-cours'].includes(k) ? compteurs[k] : undefined })),
            ]}
            value={statut}
            onChange={(v) => setQ({ statut: v || undefined })}
          />
          {r.error && !r.data && <Erreur erreur={r.error} onRetry={r.reload} />}
          {!r.data && !r.error && (
            <div class="card">
              <SkeletonRows n={6} cols={2} />
            </div>
          )}
          {r.data && liste.length === 0 && (
            <div class="card">
              <Empty icone="briefcase" titre="Aucune demande" texte={statut ? 'Aucune demande avec ce statut.' : 'Les demandes envoyées depuis la page Espace pro du site arrivent ici.'} />
            </div>
          )}
          {liste.length > 0 && (
            <div class={cx('card inbox', r.refreshing && 'refreshing')}>
              {liste.map((x) => (
                <Link key={x.id} class="inbox__item" href={lien(x)} aria-current={x.id === id ? 'page' : undefined}>
                  <Avatar nom={x.societe} cle={x.id} />
                  <span class="inbox__main">
                    <span class="inbox__top">
                      <span class="inbox__from">{x.societe}</span>
                      <time class="inbox__date" dateTime={x.createdAt}>
                        {relatif(x.createdAt)}
                      </time>
                    </span>
                    <span class="inbox__subject">
                      {COMPTE_TYPE[x.activite] || x.activite} · {x.ville}
                    </span>
                    <span class="inbox__bottom">
                      <span class="inbox__preview">{x.nom}{x.message ? ` — ${x.message}` : ''}</span>
                      <Statut table={DEMANDE} valeur={x.statut} />
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section class="split__detail" aria-label="Demande sélectionnée">
          {id ? (
            <Detail key={id} id={id} depuisListe={choisie} retour={`/crm/demandes${statut ? `?statut=${statut}` : ''}`} onChange={() => r.reload({ silencieux: true })} />
          ) : (
            <div class="split__vide">
              <Empty icone="briefcase" titre="Choisissez une demande" texte="Sa fiche s’affiche ici : contact, activité, message, et les boutons pour l’accepter ou la refuser." />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Detail({ id, depuisListe, retour, onChange }) {
  const s = useSession();
  const r = useCrm('demande', { id });
  const dm = r.data?.demande || r.data || depuisListe;
  useFil(dm?.societe);
  const [accepter, setAccepter] = useState(false);
  const [refuser, setRefuser] = useState(false);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState('');
  const titre = useRef(null);
  const peutModifier = s.peut('comptes', 'ecriture');
  useEffect(() => setNote(dm?.note || ''), [dm?.note]);
  useEffect(() => {
    if (origineNavigation() !== 'init') titre.current?.focus({ preventScroll: true });
  }, [id]);

  if (!dm && r.error) return <Erreur erreur={r.error} onRetry={r.reload} />;
  if (!dm) return <div class="card"><SkeletonRows n={5} cols={2} /></div>;

  const patch = async (body, cle, message) => {
    setBusy(cle);
    try {
      await crm('demande', { method: 'PATCH', query: { id: dm.id }, body });
      r.reload({ silencieux: true });
      onChange();
      invalider('tableau');
      if (message) toast(message);
    } catch (e) {
      toast.erreur(e);
    } finally {
      setBusy(null);
    }
  };
  const ouverte = dm.statut === 'nouvelle' || dm.statut === 'en-cours';

  return (
    <article class="detail">
      <Link class="page__back detail__retour" href={retour}>
        <Icon name="gauche" />
        Demandes
      </Link>
      <header class="detail__head">
        <Avatar nom={dm.societe} cle={dm.id} size="xl" />
        <div class="detail__titres">
          <h2 class="detail__titre" tabIndex={-1} ref={titre}>
            {dm.societe}
          </h2>
          <p class="muted">
            <span class="mono">{dm.reference}</span> · reçue {relatif(dm.createdAt)}
          </p>
        </div>
        <Statut table={DEMANDE} valeur={dm.statut} lg />
      </header>

      {peutModifier && ouverte && (
        <div class="btn-row detail__actions">
          <Button variant="primary" icon="check" onClick={() => setAccepter(true)}>
            Accepter et créer le compte
          </Button>
          {dm.statut === 'nouvelle' && (
            <Button icon="horloge" busy={busy === 'cours'} onClick={() => patch({ statut: 'en-cours' }, 'cours', 'Demande prise en charge')}>
              Prendre en charge
            </Button>
          )}
          <Button variant="danger-soft" icon="x" onClick={() => setRefuser(true)}>
            Refuser
          </Button>
        </div>
      )}
      {dm.statut === 'acceptee' && (
        <Notice ton="ok">
          Demande acceptée{dm.traiteeLe ? ` le ${date(dm.traiteeLe)}` : ''}
          {dm.traiteePar ? ` par ${dm.traiteePar.nom || dm.traiteePar}` : ''}.{' '}
          {dm.compteId && (
            <Link class="link" href={`/crm/comptes/${dm.compteId}`}>
              Voir le compte
            </Link>
          )}
        </Notice>
      )}
      {dm.statut === 'refusee' && (
        <Notice ton="warn">
          Demande refusée{dm.traiteeLe ? ` le ${date(dm.traiteeLe)}` : ''}.{dm.motif ? ` Motif : « ${dm.motif} »` : ''}
        </Notice>
      )}

      <div class="detail__grid">
        <dl class="dl">
          <dt>Activité</dt>
          <dd>{COMPTE_TYPE[dm.activite] || dm.activite || '—'}</dd>
          <dt>Ville</dt>
          <dd>{dm.ville || '—'}</dd>
          <dt>SIRET</dt>
          <dd class="mono">{dm.siret ? siret(dm.siret) : 'Non communiqué'}</dd>
          <dt>Contact</dt>
          <dd>{dm.nom}</dd>
          <dt>E-mail</dt>
          <dd>
            <a class="link link--ink" href={`mailto:${dm.email}`}>
              {coupe(dm.email)}
            </a>
          </dd>
          <dt>Téléphone</dt>
          <dd>{dm.telephone ? <a class="link link--ink" href={`tel:${dm.telephone.replace(/\s/g, '')}`}>{telephone(dm.telephone)}</a> : '—'}</dd>
          <dt>Reçue le</dt>
          <dd>{dateHeure(dm.createdAt)}</dd>
        </dl>
      </div>

      {dm.message && (
        <figure class="citation">
          <blockquote>
            <Marque texte={typo(dm.message)} />
          </blockquote>
          <figcaption>— {dm.nom}</figcaption>
        </figure>
      )}

      {peutModifier && (
        <div class="stack stack--xs">
          <Textarea label="Note interne" value={note} onInput={(e) => setNote(e.currentTarget.value)} rows={3} placeholder="Ex. : rappelé le 15/10, attend la grille tarifaire" />
          <div class="btn-row btn-row--end">
            <Button size="sm" disabled={note === (dm.note || '')} busy={busy === 'note'} onClick={() => patch({ note }, 'note', 'Note enregistrée')}>
              Enregistrer la note
            </Button>
          </div>
        </div>
      )}

      {accepter && (
        <DialogAccepter
          dm={dm}
          onClose={() => setAccepter(false)}
          onFait={() => {
            r.reload({ silencieux: true });
            onChange();
            invalider('comptes', 'tableau', 'courriels');
          }}
        />
      )}
      {refuser && (
        <DialogRefuser
          dm={dm}
          onClose={() => setRefuser(false)}
          onFait={() => {
            r.reload({ silencieux: true });
            onChange();
            invalider('tableau', 'courriels');
          }}
        />
      )}
    </article>
  );
}

function DialogAccepter({ dm, onClose, onFait }) {
  const s = useSession();
  const commerciaux = useCommerciaux();
  const [f, setF] = useState({
    grille: grilleDe(dm.activite),
    remise: '0',
    conditions: '30j-fdm',
    commercialId: s.moi.role === 'commercial' ? s.moi.id : commerciaux.find((u) => u.role === 'commercial')?.id || '',
    encoursMax: '1500',
    licence: 'aucune',
    ligne1: '',
    cp: '',
    ville: dm.ville || '',
  });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [courriel, setCourriel] = useState(null);
  const maj = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  useEffect(() => {
    if (!f.commercialId && commerciaux.length) setF((x) => ({ ...x, commercialId: commerciaux.find((u) => u.role === 'commercial')?.id || commerciaux[0].id }));
  }, [commerciaux.length]);
  const envoyer = async () => {
    const remise = lireNombre(f.remise);
    if (Number.isNaN(remise) || remise < 0 || remise > 30) return setErr({ champ: 'remise', message: 'Remise entre 0 et 30 %.' });
    const encoursMax = lireNombre(f.encoursMax);
    if (encoursMax === null || Number.isNaN(encoursMax) || encoursMax < 0) return setErr({ champ: 'encoursMax', message: 'Indiquez l’encours autorisé (0 si paiement à la commande).' });
    const adresse = f.ligne1.trim() ? { nom: dm.societe, ligne1: f.ligne1.trim(), cp: f.cp.trim(), ville: f.ville.trim(), pays: 'France' } : undefined;
    if (adresse && (!/^\d{5}$/.test(adresse.cp) || !adresse.ville)) return setErr({ champ: 'cp', message: 'Code postal (5 chiffres) et ville de l’adresse.' });
    setBusy(true);
    setErr(null);
    try {
      const d = await crm('demande-accepter', {
        method: 'POST',
        query: { id: dm.id },
        body: { grille: f.grille, remise: remise || 0, conditions: f.conditions, commercialId: f.commercialId || undefined, encoursMax, licence: f.licence, adresse },
      });
      setRes(d || {});
      onFait();
      invalider('comptes', 'tableau', 'notifications', 'courriels');
      // Aperçu du courriel d'invitation, tel que rangé dans la boîte d'envoi de la démo
      const email = d?.utilisateur?.email || dm.email;
      try {
        const l = await crm('courriels', { query: { q: email } });
        const dernier = elements(l)[0];
        if (dernier) setCourriel(await crm('courriel', { query: { id: dernier.id } }));
      } catch {
        // aperçu facultatif
      }
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  if (res) {
    const compte = res.compte || {};
    const u = res.utilisateur || {};
    return (
      <Dialog
        titre="Compte créé"
        sous={`${compte.enseigne || dm.societe} peut maintenant commander dans l’espace pro.`}
        icone="check"
        iconeTon="ok"
        taille="l"
        onClose={onClose}
        pied={
          <>
            <Button onClick={onClose}>Fermer</Button>
            {(compte.id || res.compteId) && (
              <Button
                variant="primary"
                icon="store"
                onClick={() => {
                  onClose();
                  navigate(`/crm/comptes/${compte.id || res.compteId}`);
                }}
              >
                Ouvrir le compte
              </Button>
            )}
          </>
        }
      >
        <div class="stack">
          <div class="cols cols--2" style="gap:12px">
            <div class="card card--inset">
              <div class="card__body--tight stack stack--xs">
                <span class="eyebrow">Compte</span>
                <strong>{compte.enseigne || compte.raisonSociale || dm.societe}</strong>
                <span class="small muted">
                  {GRILLE[compte.grille || f.grille]?.label} · {CONDITIONS[compte.conditions || f.conditions]}
                </span>
              </div>
            </div>
            <div class="card card--inset">
              <div class="card__body--tight stack stack--xs">
                <span class="eyebrow">Invitation envoyée à</span>
                <strong>{nomComplet(u) || dm.nom}</strong>
                <span class="small muted">{u.email || dm.email}</span>
              </div>
            </div>
          </div>
          {res.lienDemo && (
            <Notice ton="demo" titre="Démonstration">
              Aucun courriel ne part vraiment : ouvrez le lien d’activation pour choisir le mot de passe de {u.prenom || dm.nom} et découvrir son espace pro.
              <div class="btn-row" style="margin-top:10px">
                <Button size="sm" href={res.lienDemo} target="_blank" rel="noopener" icon="externe">
                  Ouvrir le lien d’activation
                </Button>
              </div>
            </Notice>
          )}
          {courriel || res.courriel ? (
            <ApercuCourriel courriel={courriel || res.courriel} compact />
          ) : (
            <p class="small muted">
              Le courriel d’invitation est rangé dans{' '}
              <Link class="link" href="/crm/courriels" onClick={onClose}>
                Courriels envoyés
              </Link>
              .
            </p>
          )}
        </div>
      </Dialog>
    );
  }
  return (
    <Dialog
      titre={`Accepter ${dm.societe}`}
      sous="Le compte est créé avec ces conditions et le contact reçoit une invitation à l’espace pro."
      icone="check"
      iconeTon="ok"
      taille="l"
      onClose={onClose}
      onSubmit={envoyer}
      pied={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary" icon="check" busy={busy}>
            Créer le compte et inviter
          </Button>
        </>
      }
    >
      <div class="form">
        <div class="form-grid">
          <Select label="Grille tarifaire" value={f.grille} onChange={maj('grille')} options={Object.entries(GRILLE).map(([value, g]) => ({ value, label: `${g.label} (coef. ${String(g.coef).replace('.', ',')})` }))} />
          <Input label="Remise supplémentaire" inputMode="decimal" suffixe="%" value={f.remise} onInput={maj('remise')} error={erreurDe(err, 'remise')} help="30 % au plus" />
          <Select label="Conditions de paiement" value={f.conditions} onChange={maj('conditions')} options={Object.entries(CONDITIONS).map(([value, label]) => ({ value, label }))} />
          <Input label="Encours autorisé" inputMode="decimal" suffixe="€" value={f.encoursMax} onInput={maj('encoursMax')} error={erreurDe(err, 'encoursMax')} />
          <Select
            class="span-2"
            label="Licence de débit de boissons"
            value={f.licence}
            onChange={maj('licence')}
            options={Object.entries(LICENCE).map(([value, label]) => ({ value, label }))}
            help={f.licence === 'aucune' ? 'Sans licence renseignée, le compte ne voit pas les produits alcoolisés.' : 'Le compte peut commander les spiritueux et liqueurs.'}
            error={erreurDe(err, 'licence')}
          />
          <Select
            class="span-2"
            label="Commercial"
            value={f.commercialId}
            onChange={maj('commercialId')}
            options={[{ value: '', label: 'À attribuer plus tard' }, ...commerciaux.map((u) => ({ value: u.id, label: `${nomComplet(u)}${u.id === s.moi.id ? ' (moi)' : ''}` }))]}
            error={erreurDe(err, 'commercialId')}
          />
        </div>
        <fieldset class="fieldset">
          <legend class="field__label">
            Adresse de livraison et de facturation <span class="field__opt">facultatif</span>
          </legend>
          <div class="form-grid">
            <Input class="span-2" label="Adresse" value={f.ligne1} onInput={maj('ligne1')} autoComplete="off" error={erreurDe(err, 'ligne1', 'adresse')} placeholder="Numéro et rue" />
            <Input label="Code postal" inputMode="numeric" value={f.cp} onInput={maj('cp')} autoComplete="off" error={erreurDe(err, 'cp')} />
            <Input label="Ville" value={f.ville} onInput={maj('ville')} autoComplete="off" error={erreurDe(err, 'ville')} />
          </div>
          <p class="small muted">Sinon, le client la complète dans son espace pro.</p>
        </fieldset>
        <div class="card card--inset">
          <div class="card__body--tight small">
            <strong>{dm.nom}</strong> ({dm.email}) recevra un lien pour choisir son mot de passe, valable 7 jours.
          </div>
        </div>
        {err && !erreurDe(err, 'remise', 'encoursMax', 'commercialId', 'licence', 'ligne1', 'adresse', 'cp', 'ville') && <Notice ton="err">{err.message}</Notice>}
      </div>
    </Dialog>
  );
}

function DialogRefuser({ dm, onClose, onFait }) {
  const [motif, setMotif] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const envoyer = async () => {
    if (motif.trim().length < 5) return setErr({ champ: 'motif', message: 'Expliquez brièvement le motif (il figure dans la réponse).' });
    setBusy(true);
    setErr(null);
    try {
      await crm('demande-refuser', { method: 'POST', query: { id: dm.id }, body: { motif: motif.trim() } });
      toast(`Réponse envoyée à ${dm.nom}`, { detail: 'Courriel rangé dans « Courriels envoyés ».', action: { label: 'Voir', href: '/crm/courriels' } });
      onFait();
      onClose();
    } catch (e) {
      setErr(e);
      setBusy(false);
    }
  };
  return (
    <Dialog
      titre={`Refuser la demande de ${dm.societe}`}
      sous={`${dm.nom} reçoit une réponse courtoise avec ce motif.`}
      icone="x"
      iconeTon="danger"
      onClose={onClose}
      onSubmit={envoyer}
      pied={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="danger" busy={busy}>
            Refuser et répondre
          </Button>
        </>
      }
    >
      <div class="form">
        <Textarea label="Motif" value={motif} onInput={(e) => setMotif(e.currentTarget.value)} rows={4} error={erreurDe(err, 'motif')} placeholder="Ex. : nous travaillons déjà avec un distributeur dans votre secteur, qui pourra vous livrer." />
        {err && !erreurDe(err, 'motif') && <Notice ton="err">{err.message}</Notice>}
      </div>
    </Dialog>
  );
}

export { Pill };
