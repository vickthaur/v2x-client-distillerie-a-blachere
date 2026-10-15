// Comptes professionnels : liste (type, ville, commercial, CA 12 mois, encours, statut) et fiche à
// onglets (infos, commandes, factures, utilisateurs, adresses, notes) ; conditions commerciales,
// suspension, invitation d'un utilisateur, commande pour le compte.
import { useState } from 'preact/hooks';
import { crm, crmUrl, elements, invalider, useCrm } from '../lib/data.js';
import { useFil, useSession } from '../lib/session.jsx';
import { Link, clicLigne, navigate, useQuery } from '../lib/router.jsx';
import { Icon } from '../ui/icons.jsx';
import { Avatar, Button, Card, Chips, Empty, Erreur, Notice, PageHead, Pagination, Pill, SearchInput, SkeletonPage, SkeletonRows, SortTh, Statut, TabPanel, Tabs, useTitre } from '../ui/base.jsx';
import { Input, Select, erreurDe, lireNombre } from '../ui/form.jsx';
import { Dialog, Menu, MenuItem, MenuSep, confirmer, toast } from '../ui/overlay.jsx';
import { Jauge } from '../charts/charts.jsx';
import { COMMANDE, COMPTE_ORIGINE, COMPTE_STATUT, COMPTE_TYPE, COMPTE_TYPE_COURT, CONDITIONS, FACTURE, GRILLE, LICENCE } from '../lib/statuts.js';
import { date, euros, eurosRond, nombre, nomComplet, pluriel, relatif, telephone } from '../lib/format.js';
import { factureStatut, formatAdresse } from './commande.jsx';
import { NotesClient, Tags } from './clients.jsx';

const PAR = 25;
export const nomCompte = (c) => c?.enseigne || c?.raisonSociale || 'Compte';

// Membres de l'équipe pouvant suivre un compte (liste de l'API si le profil y a accès)
// Membres de l'équipe (tous les rôles les lisent, pour l'attribution : noms seulement hors direction)
export function useMembres(actif = true) {
  const r = useCrm(actif ? 'equipe' : null, {});
  return elements(r.data, 'membres').filter((u) => u.actif !== false && u.role !== 'pro');
}

export function useCommerciaux(actif = true) {
  const s = useSession();
  const membres = useMembres(actif).filter((u) => ['commercial', 'direction'].includes(u.role));
  if (!membres.some((m) => m.id === s.moi.id) && ['commercial', 'direction'].includes(s.moi.role)) membres.push(s.moi);
  return membres;
}

export function Comptes() {
  useTitre('Comptes pro');
  const s = useSession();
  const [q, setQ] = useQuery();
  const statut = q.get('statut') || '';
  const type = q.get('type') || '';
  const recherche = q.get('q') || '';
  const commercial = q.get('commercial') || '';
  const page = Number(q.get('page')) || 1;
  const tri = q.get('tri') || 'nom';
  const r = useCrm('comptes', { q: recherche, type, statut, commercial, page, par: PAR, tri }, { garder: true });
  const d = r.data;
  const liste = elements(d, 'comptes');
  const [creer, setCreer] = useState(false);
  const peutModifier = s.peut('comptes', 'ecriture');
  const compteurs = d?.compteurs || {};
  const equipe = useCommerciaux();
  const commerciaux = equipe.length ? equipe.map((u) => [u.id, nomComplet(u)]) : [...new Map(liste.filter((c) => c.commercial?.id || c.commercialId).map((c) => [c.commercial?.id || c.commercialId, c.commercial?.nom || c.commercialNom])).entries()];
  const voitEncours = liste.some((c) => c.encours !== undefined);
  const trier = (t) => setQ({ tri: t === 'nom' ? undefined : t, page: undefined });

  return (
    <div class="page">
      <PageHead
        titre="Comptes pro"
        sous={d ? `${pluriel(d.total ?? liste.length, 'compte', 'comptes')} · cafés, hôtels, restaurants, cavistes, épiceries, distributeurs` : 'Clients professionnels'}
        actions={
          <>
            {s.peut('exports') && (
              <Button href={crmUrl('export', { type: 'comptes' })} target="_blank" download="" icon="telecharger" title="Tous les comptes pro, au format CSV (tableur)">
                <span class="hide-s">Exporter</span>
              </Button>
            )}
            {peutModifier && (
              <Button variant="primary" icon="plus" onClick={() => setCreer(true)}>
                Nouveau compte
              </Button>
            )}
          </>
        }
      />
      <Chips
        label="Statut"
        items={[
          { id: '', label: 'Tous', n: compteurs.tous ?? compteurs.total },
          { id: 'actif', label: 'Actifs', n: compteurs.actif },
          { id: 'suspendu', label: 'Suspendus', n: compteurs.suspendu },
        ]}
        value={statut}
        onChange={(v) => setQ({ statut: v, page: undefined })}
      />
      <div class="toolbar">
        <SearchInput class="toolbar__search" value={recherche} onChange={(v) => setQ({ q: v, page: undefined })} placeholder="Enseigne, raison sociale, ville, SIRET…" label="Rechercher un compte" />
        <select class="select select--sm" style="width:auto" aria-label="Type d’établissement" value={type} onChange={(e) => setQ({ type: e.currentTarget.value, page: undefined })}>
          <option value="">Tous les types</option>
          {Object.entries(COMPTE_TYPE).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        {(commerciaux.length > 1 || commercial) && (
          <select class="select select--sm" style="width:auto" aria-label="Commercial" value={commercial} onChange={(e) => setQ({ commercial: e.currentTarget.value, page: undefined })}>
            <option value="">Tous les commerciaux</option>
            {commerciaux.map(([id, nom]) => (
              <option key={id} value={id}>
                {nom || id}
              </option>
            ))}
          </select>
        )}
        <select class="select select--sm only-mob-inline" style="width:auto" aria-label="Trier" value={tri} onChange={(e) => trier(e.currentTarget.value)}>
          <option value="nom">Par nom</option>
          <option value="-ca">CA 12 mois décroissant</option>
          {voitEncours && <option value="-encours">Encours décroissant</option>}
          <option value="-date">Plus récents</option>
        </select>
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
            <Empty icone="store" titre="Aucun compte ne correspond" texte="Modifiez la recherche ou les filtres." />
          </div>
        )}
        {d && liste.length > 0 && (
          <>
            <div class="card only-desk">
              <div class="tbl-wrap">
                <table class="tbl">
                  <caption class="sr-only">Comptes pro</caption>
                  <thead>
                    <tr>
                      <SortTh id="nom" tri={tri} onTri={trier}>
                        Compte
                      </SortTh>
                      <th>Type</th>
                      <th>Ville</th>
                      <th>Commercial</th>
                      <SortTh id="ca" tri={tri} onTri={trier} class="num">
                        CA 12 mois HT
                      </SortTh>
                      {voitEncours && (
                        <SortTh id="encours" tri={tri} onTri={trier} class="num">
                          Encours
                        </SortTh>
                      )}
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liste.map((c) => {
                      const href = `/crm/comptes/${c.id}`;
                      const enc = Number(c.encours) || 0;
                      const retard = c.enRetard || c.facturesEnRetard > 0 || (c.encoursMax > 0 && enc > c.encoursMax);
                      return (
                        <tr key={c.id} data-href={href} onClick={clicLigne(href)}>
                          <td>
                            <span class="row" style="gap:10px">
                              <Avatar nom={nomCompte(c)} cle={c.id} size="s" />
                              <span style="min-width:0">
                                <Link class="tbl__main" href={href}>
                                  {nomCompte(c)}
                                </Link>
                                {c.raisonSociale && c.raisonSociale !== c.enseigne && <span class="tbl__sub">{c.raisonSociale}</span>}
                              </span>
                            </span>
                          </td>
                          <td>{COMPTE_TYPE_COURT[c.type] || c.type}</td>
                          <td>{c.ville || c.adresseFacturation?.ville || '—'}</td>
                          <td>{c.commercial?.nom || c.commercialNom || <span class="muted">—</span>}</td>
                          <td class="num strong">{eurosRond(c.ca12 ?? c.ca12Mois ?? 0)}</td>
                          {voitEncours && (
                            <td class="num">
                              {enc > 0 ? (
                                <span class={retard ? 'encours encours--retard' : 'encours'} title={c.encoursMax ? `Plafond : ${euros(c.encoursMax)}` : undefined}>
                                  {retard && <Icon name="alerte" size="xs" title={c.encoursMax && enc > c.encoursMax ? 'Encours au-delà du plafond' : 'Facture en retard'} />}
                                  {euros(enc)}
                                </span>
                              ) : (
                                <span class="muted">—</span>
                              )}
                            </td>
                          )}
                          <td>
                            <Statut table={COMPTE_STATUT} valeur={c.statut} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={d.page || page} pages={d.pages || 1} total={d.total} par={PAR} onPage={(p) => setQ({ page: p > 1 ? p : undefined }, { replace: false })} unite={['compte', 'comptes']} />
            </div>
            <div class="mcards only-mob">
              {liste.map((c) => (
                <Link key={c.id} class="mcard" href={`/crm/comptes/${c.id}`}>
                  <div class="mcard__top">
                    <span class="mcard__title">{nomCompte(c)}</span>
                    <Statut table={COMPTE_STATUT} valeur={c.statut} />
                  </div>
                  <div class="mcard__meta">
                    <span>{[COMPTE_TYPE_COURT[c.type], c.ville || c.adresseFacturation?.ville].filter(Boolean).join(' · ')}</span>
                    <span class="mcard__amount">{eurosRond(c.ca12 ?? 0)}</span>
                  </div>
                  {(Number(c.encours) || 0) > 0 && (
                    <div class="mcard__meta">
                      <span>Encours</span>
                      <span class={c.enRetard || (c.encoursMax > 0 && c.encours > c.encoursMax) ? 'strong' : ''} style={c.enRetard || (c.encoursMax > 0 && c.encours > c.encoursMax) ? 'color:var(--err)' : ''}>
                        {euros(c.encours)}
                      </span>
                    </div>
                  )}
                </Link>
              ))}
              <Pagination page={d.page || page} pages={d.pages || 1} total={d.total} par={PAR} onPage={(p) => setQ({ page: p > 1 ? p : undefined }, { replace: false })} unite={['compte', 'comptes']} />
            </div>
          </>
        )}
      </div>
      {creer && <DialogNouveauCompte onClose={() => setCreer(false)} />}
    </div>
  );
}

function DialogNouveauCompte({ onClose }) {
  const commerciaux = useCommerciaux();
  const s = useSession();
  const [f, setF] = useState({ raisonSociale: '', enseigne: '', type: 'chr', siret: '', licence: 'licence-iv', email: '', telephone: '', ligne1: '', cp: '', ville: '', grille: 'chr', remise: '0', conditions: '30j-fdm', francoHT: '300', encoursMax: '1500', commercialId: s.moi.role === 'commercial' ? s.moi.id : '', prenom: '', nom: '', emailUtilisateur: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const maj = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  const envoyer = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body = {
        raisonSociale: f.raisonSociale.trim(),
        enseigne: f.enseigne.trim() || f.raisonSociale.trim(),
        type: f.type,
        siret: f.siret.replace(/\s/g, '') || undefined,
        licence: f.licence,
        email: f.email.trim(),
        telephone: f.telephone.trim() || undefined,
        adresseFacturation: { ligne1: f.ligne1.trim(), cp: f.cp.trim(), ville: f.ville.trim(), pays: 'France' },
        grille: f.grille,
        remise: lireNombre(f.remise) || 0,
        conditions: f.conditions,
        francoHT: lireNombre(f.francoHT) || 0,
        encoursMax: lireNombre(f.encoursMax) || 0,
        commercialId: f.commercialId || undefined,
        origine: 'commercial',
        utilisateur: f.emailUtilisateur.trim() ? { prenom: f.prenom.trim(), nom: f.nom.trim(), email: f.emailUtilisateur.trim() } : undefined,
      };
      const d = await crm('compte', { method: 'POST', body });
      const c = d?.compte || d;
      invalider('comptes');
      toast(`Compte ${nomCompte(c)} créé`, { detail: body.utilisateur ? `Invitation envoyée à ${body.utilisateur.email}.` : undefined });
      onClose();
      if (c?.id) navigate(`/crm/comptes/${c.id}`);
    } catch (e) {
      setErr(e);
      setBusy(false);
    }
  };
  const champs = ['raisonSociale', 'enseigne', 'siret', 'email', 'telephone', 'ligne1', 'cp', 'ville', 'remise', 'francoHT', 'encoursMax', 'prenom', 'nom', 'utilisateur'];
  return (
    <Dialog
      titre="Nouveau compte pro"
      sous="Le premier utilisateur reçoit une invitation pour choisir son mot de passe."
      icone="store"
      taille="l"
      onClose={onClose}
      onSubmit={envoyer}
      pied={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary" busy={busy}>
            Créer le compte
          </Button>
        </>
      }
    >
      <div class="form">
        <section class="form-section">
          <h3 class="form-section__title">Établissement</h3>
          <div class="form-grid">
            <Input label="Raison sociale" value={f.raisonSociale} onInput={maj('raisonSociale')} error={erreurDe(err, 'raisonSociale')} />
            <Input label="Enseigne" opt value={f.enseigne} onInput={maj('enseigne')} error={erreurDe(err, 'enseigne')} />
            <Select label="Type" value={f.type} onChange={maj('type')} options={Object.entries(COMPTE_TYPE).map(([value, label]) => ({ value, label }))} />
            <Select label="Licence" value={f.licence} onChange={maj('licence')} options={Object.entries(LICENCE).map(([value, label]) => ({ value, label }))} />
            <Input label="SIRET" opt inputMode="numeric" value={f.siret} onInput={maj('siret')} error={erreurDe(err, 'siret')} help="14 chiffres" />
            <Input label="Téléphone" opt type="tel" value={f.telephone} onInput={maj('telephone')} error={erreurDe(err, 'telephone')} />
            <Input class="span-2" label="E-mail de facturation" type="email" value={f.email} onInput={maj('email')} error={erreurDe(err, 'email')} />
            <Input class="span-2" label="Adresse de facturation" value={f.ligne1} onInput={maj('ligne1')} error={erreurDe(err, 'ligne1', 'adresseFacturation')} />
            <Input label="Code postal" inputMode="numeric" value={f.cp} onInput={maj('cp')} error={erreurDe(err, 'cp')} />
            <Input label="Ville" value={f.ville} onInput={maj('ville')} error={erreurDe(err, 'ville')} />
          </div>
        </section>
        <section class="form-section">
          <h3 class="form-section__title">Conditions commerciales</h3>
          <ChampsConditions f={f} maj={maj} err={err} commerciaux={commerciaux} />
        </section>
        <section class="form-section">
          <h3 class="form-section__title">Premier utilisateur (facultatif)</h3>
          <div class="form-grid">
            <Input label="Prénom" value={f.prenom} onInput={maj('prenom')} error={erreurDe(err, 'prenom')} />
            <Input label="Nom" value={f.nom} onInput={maj('nom')} error={erreurDe(err, 'nom')} />
            <Input class="span-2" label="E-mail" type="email" value={f.emailUtilisateur} onInput={maj('emailUtilisateur')} error={erreurDe(err, 'utilisateur')} help="Reçoit l’invitation à l’espace pro." />
          </div>
        </section>
        {err && !champs.some((c) => erreurDe(err, c)) && <Notice ton="err">{err.message}</Notice>}
      </div>
    </Dialog>
  );
}

function ChampsConditions({ f, maj, err, commerciaux, lectureCommercial }) {
  return (
    <div class="form-grid">
      <Select label="Grille tarifaire" value={f.grille} onChange={maj('grille')} options={Object.entries(GRILLE).map(([value, g]) => ({ value, label: `${g.label} (coef. ${String(g.coef).replace('.', ',')})` }))} help="Prix HT = prix public HT × coefficient" />
      <Input label="Remise supplémentaire" inputMode="decimal" suffixe="%" value={f.remise} onInput={maj('remise')} error={erreurDe(err, 'remise')} />
      <Select label="Conditions de paiement" value={f.conditions} onChange={maj('conditions')} options={Object.entries(CONDITIONS).map(([value, label]) => ({ value, label }))} />
      <Input label="Franco de port" inputMode="decimal" suffixe="€ HT" value={f.francoHT} onInput={maj('francoHT')} error={erreurDe(err, 'francoHT')} />
      <Input label="Encours maximal" inputMode="decimal" suffixe="€" value={f.encoursMax} onInput={maj('encoursMax')} error={erreurDe(err, 'encoursMax')} help="Factures non réglées + commande en cours" />
      {lectureCommercial ? (
        <Input label="Commercial" value={lectureCommercial} readOnly />
      ) : (
        <Select label="Commercial" value={f.commercialId} onChange={maj('commercialId')} options={[{ value: '', label: 'Aucun' }, ...commerciaux.map((u) => ({ value: u.id, label: nomComplet(u) }))]} />
      )}
    </div>
  );
}

export function Compte({ id }) {
  const s = useSession();
  const [q, setQ] = useQuery();
  const onglet = q.get('onglet') || 'infos';
  const r = useCrm('compte', { id });
  const d = r.data;
  const c = d?.compte || d;
  useTitre(c ? nomCompte(c) : 'Compte pro');
  useFil(c ? nomCompte(c) : null);
  const [conditions, setConditions] = useState(false);
  const [inviter, setInviter] = useState(false);
  const peutModifier = s.peut('comptes', 'ecriture');
  if (r.error && !c) {
    return (
      <div class="page">
        <PageHead titre="Compte pro" retour={{ href: '/crm/comptes', label: 'Comptes pro' }} />
        {r.error.status === 404 ? <Empty icone="store" titre="Compte introuvable" action={<Button href="/crm/comptes">Tous les comptes</Button>} /> : <Erreur erreur={r.error} onRetry={r.reload} />}
      </div>
    );
  }
  if (!c) return <div class="page"><SkeletonPage /></div>;

  const commandes = elements(d?.commandes || c.commandes, 'commandes');
  const factures = elements(d?.factures || c.factures, 'factures');
  const utilisateurs = elements(d?.utilisateurs || c.utilisateurs, 'utilisateurs');
  const adresses = c.adressesLivraison || d?.adresses || [];
  const encours = Number(d?.encours ?? c.encours) || 0;
  const ca12 = d?.ca12 ?? c.ca12;
  const enRetard = factures.filter((f) => factureStatut(f) === 'en-retard');
  const commercial = d?.commercial || c.commercial;

  const patch = async (body, message) => {
    const avant = r.data;
    r.mutate((x) => (x?.compte ? { ...x, compte: { ...x.compte, ...body } } : { ...x, ...body }));
    try {
      const res = await crm('compte', { method: 'PATCH', query: { id: c.id }, body });
      if (message) toast(message);
      invalider('comptes');
      if (res) r.reload({ silencieux: true });
    } catch (e) {
      r.mutate(avant);
      toast.erreur(e);
      throw e;
    }
  };
  const suspendre = async () => {
    const suspendu = c.statut === 'suspendu';
    await confirmer({
      titre: suspendu ? `Réactiver ${nomCompte(c)} ?` : `Suspendre ${nomCompte(c)} ?`,
      message: suspendu ? 'Ses utilisateurs pourront de nouveau commander dans l’espace pro.' : 'Ses utilisateurs ne pourront plus passer commande dans l’espace pro. Les commandes en cours ne sont pas modifiées.',
      confirmer: suspendu ? 'Réactiver' : 'Suspendre le compte',
      danger: !suspendu,
      icone: suspendu ? 'lecture' : 'pause',
      action: () => patch({ statut: suspendu ? 'actif' : 'suspendu' }, suspendu ? 'Compte réactivé' : 'Compte suspendu'),
    });
  };

  const onglets = [
    { id: 'infos', label: 'Infos' },
    { id: 'commandes', label: 'Commandes', n: commandes.length },
    ...(s.peut('factures') ? [{ id: 'factures', label: 'Factures', n: factures.length }] : []),
    { id: 'utilisateurs', label: 'Utilisateurs', n: utilisateurs.length },
    { id: 'adresses', label: 'Adresses', n: adresses.length },
    { id: 'notes', label: 'Notes' },
  ];

  return (
    <div class="page">
      <PageHead
        titre={
          <span class="row row--wrap" style="gap:12px">
            <span>{nomCompte(c)}</span>
            <Statut table={COMPTE_STATUT} valeur={c.statut} lg />
          </span>
        }
        retour={{ href: '/crm/comptes', label: 'Comptes pro' }}
        sous={
          <>
            <span>{COMPTE_TYPE[c.type] || c.type}</span>
            {c.raisonSociale && c.raisonSociale !== c.enseigne && <span>{c.raisonSociale}</span>}
            {(c.adresseFacturation?.ville || c.ville) && <span>{c.adresseFacturation?.ville || c.ville}</span>}
          </>
        }
        actions={
          <>
            {s.peut('commandes-pro', 'ecriture') && c.statut !== 'suspendu' && (
              <Button href={`/crm/commandes/nouvelle?compte=${c.id}`} variant="primary" icon="plus">
                Nouvelle commande
              </Button>
            )}
            {peutModifier && (
              <Menu label="Actions du compte" bouton={(p) => <Button icon="points" aria-label="Actions du compte" {...p} />}>
                {(fermer) => (
                  <>
                    <MenuItem icone="pourcent" fermer={fermer} onSelect={() => setConditions(true)}>
                      Modifier les conditions
                    </MenuItem>
                    <MenuItem icone="user-plus" fermer={fermer} onSelect={() => setInviter(true)}>
                      Inviter un utilisateur
                    </MenuItem>
                    <MenuSep />
                    <MenuItem icone={c.statut === 'suspendu' ? 'lecture' : 'pause'} danger={c.statut !== 'suspendu'} fermer={fermer} onSelect={suspendre}>
                      {c.statut === 'suspendu' ? 'Réactiver le compte' : 'Suspendre le compte'}
                    </MenuItem>
                  </>
                )}
              </Menu>
            )}
          </>
        }
      />
      {c.statut === 'suspendu' && <Notice ton="warn" class="mb">Compte suspendu : ses utilisateurs ne peuvent plus commander dans l’espace pro.</Notice>}
      <div class="stats-row">
        <div class="stat">
          <span class="stat__k">CA 12 mois HT</span>
          <span class="stat__v">{eurosRond(ca12 ?? 0)}</span>
        </div>
        <div class="stat">
          <span class="stat__k">Encours</span>
          <span class="stat__v">{euros(encours)}</span>
          {c.encoursMax > 0 && <Jauge valeur={encours} max={c.encoursMax} fin label="Encours utilisé" texte={`${euros(encours)} sur ${euros(c.encoursMax)}`} />}
          <span class="stat__s">sur {euros(c.encoursMax)} autorisés</span>
        </div>
        <div class="stat">
          <span class="stat__k">Commandes</span>
          <span class="stat__v">{nombre(commandes.length)}</span>
          {commandes[0] && <span class="stat__s">dernière {relatif(commandes[0].date || commandes[0].createdAt)}</span>}
        </div>
        <div class="stat">
          <span class="stat__k">Factures en retard</span>
          <span class="stat__v" style={enRetard.length ? 'color:var(--err)' : ''}>
            {nombre(enRetard.length)}
          </span>
          {enRetard.length > 0 && <span class="stat__s">{euros(enRetard.reduce((t, f) => t + (f.montantTTC || f.totalTTC || 0), 0))}</span>}
        </div>
      </div>

      <Tabs label="Fiche du compte" items={onglets} value={onglet} onChange={(v) => setQ({ onglet: v === 'infos' ? undefined : v })} />

      <TabPanel id={onglet}>
        {onglet === 'infos' && (
          <div class="cols cols--2">
            <Card titre="Établissement" icone="store">
              <dl class="dl">
                <dt>Raison sociale</dt>
                <dd>{c.raisonSociale || '—'}</dd>
                <dt>Enseigne</dt>
                <dd>{c.enseigne || '—'}</dd>
                <dt>Type</dt>
                <dd>{COMPTE_TYPE[c.type] || c.type}</dd>
                <dt>SIRET</dt>
                <dd class="mono">{c.siret ? c.siret.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, '$1 $2 $3 $4') : '—'}</dd>
                <dt>TVA intracom.</dt>
                <dd class="mono">{c.tvaIntra || '—'}</dd>
                <dt>Licence</dt>
                <dd>
                  {LICENCE[c.licence] || '—'}
                  {c.licence === 'aucune' && <span class="small muted"> · spiritueux masqués</span>}
                </dd>
                <dt>E-mail</dt>
                <dd>
                  <a class="link link--ink" href={`mailto:${c.email}`}>
                    {c.email}
                  </a>
                </dd>
                <dt>Téléphone</dt>
                <dd>{c.telephone ? <a class="link link--ink" href={`tel:${c.telephone.replace(/\s/g, '')}`}>{telephone(c.telephone)}</a> : '—'}</dd>
                <dt>Facturation</dt>
                <dd>{formatAdresse(c.adresseFacturation).join(', ') || '—'}</dd>
                <dt>Origine</dt>
                <dd>
                  {COMPTE_ORIGINE[c.origine] || c.origine || '—'} · client depuis le {date(c.createdAt)}
                </dd>
              </dl>
            </Card>
            <Card titre="Conditions commerciales" icone="pourcent" actions={peutModifier && <button type="button" class="more" onClick={() => setConditions(true)}><Icon name="crayon" />Modifier</button>}>
              <dl class="dl">
                <dt>Grille</dt>
                <dd>
                  {GRILLE[c.grille]?.label || c.grille}
                  {GRILLE[c.grille] && <span class="muted"> · coef. {String(GRILLE[c.grille].coef).replace('.', ',')}</span>}
                </dd>
                <dt>Remise</dt>
                <dd>{c.remise ? `${String(c.remise).replace('.', ',')} % en plus de la grille` : 'Aucune'}</dd>
                <dt>Paiement</dt>
                <dd>{CONDITIONS[c.conditions] || c.conditions}</dd>
                <dt>Franco</dt>
                <dd>{euros(c.francoHT)} HT</dd>
                <dt>Encours max.</dt>
                <dd>{euros(c.encoursMax)}</dd>
                <dt>Commercial</dt>
                <dd>{commercial?.nom || nomComplet(commercial) || '—'}</dd>
              </dl>
              <p class="small muted" style="margin-top:12px">Tarifs de démonstration, fictifs.</p>
            </Card>
          </div>
        )}
        {onglet === 'commandes' && (
          <Card titre="Commandes" corps={false} actions={s.peut('commandes-pro', 'ecriture') && c.statut !== 'suspendu' && <Button size="sm" icon="plus" href={`/crm/commandes/nouvelle?compte=${c.id}`}>Nouvelle commande</Button>}>
            {commandes.length === 0 ? (
              <Empty petit icone="commandes" titre="Aucune commande" />
            ) : (
              <div class="list">
                {commandes.map((x) => (
                  <Link key={x.id} class="list__item" href={`/crm/commandes/${x.id}`}>
                    <span class="list__main">
                      <span class="list__title">
                        <span class="mono">{x.numero}</span>
                        {x.referenceClient && <span class="small muted">réf. {x.referenceClient}</span>}
                      </span>
                      <span class="list__meta">
                        {date(x.date || x.createdAt)}
                        {x.articles ? ` · ${pluriel(x.articles, 'article', 'articles')}` : ''}
                        {x.auteur?.nom ? ` · ${x.auteur.nom}` : ''}
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
        )}
        {onglet === 'factures' && (
          <Card titre="Factures" corps={false}>
            {factures.length === 0 ? (
              <Empty petit icone="facture" titre="Aucune facture" texte="Les factures sont émises à l’expédition des commandes pro." />
            ) : (
              <div class="tbl-wrap">
                <table class="tbl">
                  <caption class="sr-only">Factures du compte</caption>
                  <thead>
                    <tr>
                      <th>Facture</th>
                      <th>Émise le</th>
                      <th>Échéance</th>
                      <th class="num">Montant TTC</th>
                      <th>Statut</th>
                      <th class="w-actions">
                        <span class="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {factures.map((f) => {
                      const st = factureStatut(f);
                      return (
                        <tr key={f.numero}>
                          <td>
                            <span class="strong mono">{f.numero}</span>
                            {f.commande && <span class="tbl__sub mono">{f.commande.numero || f.commande}</span>}
                          </td>
                          <td>{date(f.date)}</td>
                          <td style={st === 'en-retard' ? 'color:var(--err);font-weight:600' : ''}>{date(f.echeance)}</td>
                          <td class="num strong">{euros(f.montantTTC ?? f.totalTTC)}</td>
                          <td>
                            <Statut table={FACTURE} valeur={st} />
                          </td>
                          <td class="w-actions">
                            {(f.commandeId || f.commande?.id) && (
                              <Button size="sm" variant="ghost" icon="imprimer" href={`/crm/imprimer/facture/${f.commandeId || f.commande.id}`} target="_blank" rel="noopener" aria-label={`Imprimer la facture ${f.numero}`} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
        {onglet === 'utilisateurs' && (
          <Card titre="Utilisateurs de l’espace pro" corps={false} actions={peutModifier && <Button size="sm" icon="user-plus" onClick={() => setInviter(true)}>Inviter</Button>}>
            {utilisateurs.length === 0 ? (
              <Empty petit icone="equipe" titre="Aucun utilisateur" texte="Invitez une personne de l’établissement pour qu’elle commande en ligne." />
            ) : (
              <div class="list">
                {utilisateurs.map((u) => (
                  <div class="list__item" key={u.id}>
                    <Avatar nom={nomComplet(u)} cle={u.id} />
                    <span class="list__main">
                      <span class="list__title">{nomComplet(u)}</span>
                      <span class="list__meta">{u.email}</span>
                    </span>
                    <span class="list__end">
                      {u.invitation || u.invite || u.statut === 'invite' ? <Pill ton="info">Invitation envoyée</Pill> : u.actif === false ? <Pill>Désactivé</Pill> : <Pill ton="ok">Actif</Pill>}
                      {u.derniereConnexion && <span class="small muted">connecté {relatif(u.derniereConnexion)}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
        {onglet === 'adresses' && (
          <Card titre="Adresses de livraison" sous="Gérées par le client dans son espace pro" corps={false}>
            {adresses.length === 0 ? (
              <Empty petit icone="pin" titre="Aucune adresse" texte="Les livraisons se font à l’adresse de facturation." />
            ) : (
              <div class="list">
                {adresses.map((a, i) => (
                  <div class="list__item" key={a.id || i}>
                    <span class="list__ico">
                      <Icon name="pin" size="s" />
                    </span>
                    <span class="list__main">
                      <span class="list__title">{a.nom || `Adresse ${i + 1}`}</span>
                      <span class="list__meta" style="white-space:normal">{formatAdresse({ ...a, nom: null }).join(', ')}</span>
                      {a.instructions && <span class="small muted">« {a.instructions} »</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
        {onglet === 'notes' && (
          <div class="cols cols--2">
            <NotesClient c={c} patch={(b, m) => patch(b, m).catch(() => {})} peutModifier={peutModifier} titre="Notes du commercial" />
            <Tags c={c} patch={(b) => patch(b).catch(() => {})} peutModifier={peutModifier} />
          </div>
        )}
      </TabPanel>

      {conditions && <DialogConditions c={c} commercial={commercial} onClose={() => setConditions(false)} patch={patch} />}
      {inviter && <DialogInviter compte={c} onClose={() => setInviter(false)} onFait={() => r.reload({ silencieux: true })} />}
    </div>
  );
}

function DialogConditions({ c, commercial, onClose, patch }) {
  const s = useSession();
  const commerciaux = useCommerciaux();
  const [f, setF] = useState({ grille: c.grille, remise: String(c.remise ?? 0).replace('.', ','), conditions: c.conditions, francoHT: String(c.francoHT ?? '').replace('.', ','), encoursMax: String(c.encoursMax ?? '').replace('.', ','), commercialId: c.commercialId || '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const maj = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  const peutChoisir = commerciaux.length > 1;
  const envoyer = async () => {
    const remise = lireNombre(f.remise);
    if (Number.isNaN(remise) || remise < 0 || remise > 50) return setErr({ champ: 'remise', message: 'Remise entre 0 et 50 %.' });
    setBusy(true);
    setErr(null);
    try {
      const body = { grille: f.grille, remise: remise || 0, conditions: f.conditions, francoHT: lireNombre(f.francoHT) || 0, encoursMax: lireNombre(f.encoursMax) || 0 };
      if (peutChoisir) body.commercialId = f.commercialId || null;
      await patch(body, 'Conditions commerciales mises à jour');
      onClose();
    } catch (e) {
      setErr(e);
      setBusy(false);
    }
  };
  return (
    <Dialog
      titre="Conditions commerciales"
      sous={`${nomCompte(c)} · les prochaines commandes en tiennent compte.`}
      icone="pourcent"
      taille="l"
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
        <ChampsConditions f={f} maj={maj} err={err} commerciaux={commerciaux} lectureCommercial={!peutChoisir ? commercial?.nom || '—' : null} />
        {err && !erreurDe(err, 'remise', 'francoHT', 'encoursMax') && <Notice ton="err">{err.message}</Notice>}
      </div>
    </Dialog>
  );
}

function DialogInviter({ compte, onClose, onFait }) {
  const [f, setF] = useState({ prenom: '', nom: '', email: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const maj = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  const envoyer = async () => {
    setBusy(true);
    setErr(null);
    try {
      await crm('compte-utilisateur', { method: 'POST', body: { compteId: compte.id, prenom: f.prenom.trim(), nom: f.nom.trim(), email: f.email.trim() } });
      toast(`Invitation envoyée à ${f.email.trim()}`, { detail: 'Voir le courriel dans « Courriels envoyés ».', action: { label: 'Voir', href: '/crm/courriels' } });
      onFait?.();
      onClose();
    } catch (e) {
      setErr(e);
      setBusy(false);
    }
  };
  return (
    <Dialog
      titre="Inviter un utilisateur"
      sous={`${nomCompte(compte)} · la personne reçoit un lien pour choisir son mot de passe (valable 7 jours).`}
      icone="user-plus"
      onClose={onClose}
      onSubmit={envoyer}
      pied={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary" icon="send" busy={busy}>
            Envoyer l’invitation
          </Button>
        </>
      }
    >
      <div class="form">
        <div class="form-grid">
          <Input label="Prénom" value={f.prenom} onInput={maj('prenom')} error={erreurDe(err, 'prenom')} />
          <Input label="Nom" value={f.nom} onInput={maj('nom')} error={erreurDe(err, 'nom')} />
        </div>
        <Input label="E-mail" type="email" value={f.email} onInput={maj('email')} error={erreurDe(err, 'email')} />
        {err && !erreurDe(err, 'prenom', 'nom', 'email') && <Notice ton="err">{err.message}</Notice>}
      </div>
    </Dialog>
  );
}
