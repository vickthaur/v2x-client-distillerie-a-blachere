// Nouvelle commande saisie dans le CRM : commande téléphonique d'un particulier ou commande pour
// un compte pro. Le navigateur n'envoie que des quantités : prix, remise, port et TVA sont
// recalculés par le serveur.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { crm, elements, invalider, useCrm } from '../lib/data.js';
import { useFil, useSession } from '../lib/session.jsx';
import { navigate, useQuery } from '../lib/router.jsx';
import { Icon } from '../ui/icons.jsx';
import { Avatar, Button, Card, Empty, Notice, PageHead, Pill, SearchInput, cx, useTitre } from '../ui/base.jsx';
import { Check, Choices, Input, Select, Stepper, Textarea, erreurDe } from '../ui/form.jsx';
import { toast } from '../ui/overlay.jsx';
import { Marque } from '../ui/marque.jsx';
import { Vignette, formatAdresse } from './commande.jsx';
import { COMPTE_TYPE_COURT, CONDITIONS, GAMMES, GRILLE, LIVRAISON } from '../lib/statuts.js';
import { ajouterJours, aujourdHui, euros, jourDeSemaine, nombre, plier, pluriel } from '../lib/format.js';

// Produits et variantes, quelle que soit la forme de la réponse
export function lireProduits(d) {
  return elements(d, 'produits').map((p) => ({
    ...p,
    variantes: Array.isArray(p.variantes) ? p.variantes : Object.entries(p.variantes || {}).map(([id, v]) => ({ id, ...v })),
  }));
}

function prochainJourOuvre() {
  let j = ajouterJours(aujourdHui(), 1);
  while (jourDeSemaine(j) === 6) j = ajouterJours(j, 1);
  return j;
}

export function NouvelleCommande() {
  useTitre('Nouvelle commande');
  useFil('Nouvelle commande');
  const s = useSession();
  const [q] = useQuery();
  const peutPro = s.peut('commandes-pro', 'ecriture');
  const peutTel = s.peut('commandes', 'ecriture');
  const [type, setType] = useState(q.get('compte') ? 'pro' : peutTel ? 'telephone' : 'pro');
  const [client, setClient] = useState({ prenom: '', nom: '', email: '', telephone: '' });
  const [clientChoisi, setClientChoisi] = useState(null);
  const [compteId, setCompteId] = useState(q.get('compte') || '');
  const [lignes, setLignes] = useState([]);
  const [livraison, setLivraison] = useState({ mode: 'retrait', jourRetrait: prochainJourOuvre(), adresse: { ligne1: '', ligne2: '', cp: '', ville: '', pays: 'France' }, adresseId: '' });
  const [paiement, setPaiement] = useState('carte');
  const [paye, setPaye] = useState(false);
  const [code, setCode] = useState('');
  const [consentement, setConsentement] = useState(false);
  const [pro, setPro] = useState({ referenceClient: '', dateSouhaitee: '', commentaire: '' });
  const [note, setNote] = useState('');
  const [age, setAge] = useState(false);
  const [err, setErr] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const clientQ = useCrm(q.get('client') && !clientChoisi ? 'client' : null, { id: q.get('client') });
  useEffect(() => {
    const k = clientQ.data?.client || clientQ.data;
    if (k?.id && !clientChoisi) setClientChoisi(k);
  }, [clientQ.data]);
  const produits = useCrm('produits', {});
  const catalogue = useMemo(() => lireProduits(produits.data).filter((p) => p.actif !== false), [produits.data]);
  const compte = useCrm(type === 'pro' && compteId ? 'compte' : null, { id: compteId });
  const cpt = compte.data?.compte || compte.data;

  useEffect(() => {
    if (type === 'pro') setLivraison((l) => ({ ...l, adresseId: cpt?.adressesLivraison?.[0]?.id || '' }));
  }, [type, cpt?.id]);

  const ajouter = (p, v) => {
    setLignes((ls) => {
      const i = ls.findIndex((l) => l.slug === p.slug && l.varianteId === v.id);
      const pas = type === 'pro' && v.colisage > 1 ? v.colisage : 1;
      if (i >= 0) return ls.map((l, k) => (k === i ? { ...l, qte: Math.min(999, l.qte + pas) } : l));
      return [...ls, { slug: p.slug, varianteId: v.id, qte: pas, nom: p.nom, volume: v.volume, alcool: p.alcool, prixTTC: v.prixTTC, prixProHT: v.prixProHT, stock: v.stock, colisage: v.colisage }];
    });
  };
  const alcool = lignes.some((l) => l.alcool);
  const sousTotal = lignes.reduce((t, l) => t + l.qte * ((type === 'pro' ? l.prixProHT : l.prixTTC) || 0), 0);
  const bouteilles = lignes.reduce((t, l) => t + l.qte, 0);
  const licenceSansAlcool = type === 'pro' && cpt?.licence === 'aucune';

  const creer = async () => {
    setErr(null);
    if (type === 'pro' && !compteId) return setErr({ champ: 'compteId', message: 'Choisissez le compte pro.' });
    if (type === 'telephone' && !clientChoisi && (!client.prenom.trim() || !client.nom.trim() || !client.email.trim())) return setErr({ champ: 'client', message: 'Indiquez le prénom, le nom et l’e-mail du client.' });
    if (!lignes.length) return setErr({ champ: 'lignes', message: 'Ajoutez au moins un produit.' });
    if (alcool && type === 'telephone' && !age) return setErr({ champ: 'ageConfirme', message: 'Confirmez que le client a 18 ans ou plus (boisson alcoolisée).' });
    const lignesApi = lignes.map((l) => ({ slug: l.slug, varianteId: l.varianteId, qte: l.qte }));
    let body;
    if (type === 'pro') {
      body = {
        compteId,
        lignes: lignesApi,
        livraison: livraison.adresseId ? { adresseId: livraison.adresseId } : {},
        dateSouhaitee: pro.dateSouhaitee || undefined,
        referenceClient: pro.referenceClient.trim() || undefined,
        commentaire: pro.commentaire.trim() || undefined,
        note: note.trim() || undefined,
      };
    } else {
      const k = clientChoisi || client;
      const liv = { mode: livraison.mode };
      if (livraison.mode === 'retrait') liv.jourRetrait = livraison.jourRetrait;
      else {
        const a = livraison.adresse;
        liv.adresse = { nom: `${(k.prenom || '').trim()} ${(k.nom || '').trim()}`.trim() || undefined, ligne1: a.ligne1.trim(), ligne2: a.ligne2.trim() || undefined, cp: a.cp.trim(), ville: a.ville.trim(), pays: 'France' };
      }
      body = {
        client: { prenom: (k.prenom || '').trim(), nom: (k.nom || '').trim(), email: (k.email || '').trim(), telephone: (k.telephone || '').trim() || undefined },
        livraison: liv,
        paiement: { mode: paiement, statut: paye ? 'paye' : 'en-attente' },
        lignes: lignesApi,
        code: code.trim() || undefined,
        ageConfirme: alcool ? age : undefined,
        newsletter: consentement || undefined,
        note: note.trim() || undefined,
      };
    }
    setEnvoi(true);
    try {
      const d = await crm('commande', { method: 'POST', body });
      const c = d?.commande || d;
      invalider('commandes', 'tableau', 'produits', 'clients', 'compte');
      toast(`Commande ${c?.numero || ''} créée`, { detail: type === 'pro' ? 'Le compte reçoit la confirmation par courriel.' : 'Le client reçoit la confirmation par courriel.' });
      navigate(c?.id ? `/crm/commandes/${c.id}` : '/crm/commandes', { replace: true });
    } catch (e) {
      setErr(e);
      setEnvoi(false);
    }
  };

  return (
    <div class="page">
      <PageHead titre="Nouvelle commande" retour={{ href: '/crm/commandes', label: 'Commandes' }} sous="Commande prise au téléphone ou pour un compte pro. Les prix, le port et la TVA sont calculés à l’enregistrement." />
      <div class="cols cols--main">
        <div class="stack">
          <Card titre="1. Client" icone="client">
            <div class="stack">
              {peutPro && peutTel && (
                <Choices
                  name="type"
                  value={type}
                  onChange={setType}
                  items={[
                    { value: 'telephone', titre: 'Particulier', desc: 'Commande prise au téléphone ou à la boutique', icone: 'telephone' },
                    { value: 'pro', titre: 'Compte pro', desc: 'Prix de la grille du compte, conditions de paiement', icone: 'store' },
                  ]}
                />
              )}
              {type === 'pro' ? (
                <ChoixCompte compteId={compteId} setCompteId={setCompteId} cpt={cpt} chargement={compte.loading} err={erreurDe(err, 'compteId')} />
              ) : (
                <ChoixClient client={client} setClient={setClient} choisi={clientChoisi} setChoisi={setClientChoisi} err={erreurDe(err, 'client', 'email', 'nom', 'prenom', 'telephone')} />
              )}
            </div>
          </Card>

          <Card titre="2. Articles" icone="bouteille" corps={false}>
            <div class="card__body stack">
              {licenceSansAlcool && <Notice ton="warn">Ce compte n’a pas de licence pour l’alcool : seuls les sirops peuvent lui être vendus.</Notice>}
              <Catalogue catalogue={licenceSansAlcool ? catalogue.filter((p) => !p.alcool) : catalogue} chargement={produits.loading} erreur={produits.error} onAjouter={ajouter} pro={type === 'pro'} />
              {erreurDe(err, 'lignes') && <Notice ton="err">{erreurDe(err, 'lignes')}</Notice>}
            </div>
            {lignes.length > 0 && (
              <ul class="panier">
                {lignes.map((l, i) => (
                  <li key={`${l.slug}-${l.varianteId}`} class="panier__ligne">
                    <Vignette slug={l.slug} taille="s" />
                    <div class="panier__nom">
                      <span class="strong">
                        <Marque texte={l.nom} logo />
                      </span>
                      <span class="small muted">
                        {l.volume} · {euros(type === 'pro' ? l.prixProHT : l.prixTTC)} {type === 'pro' ? 'HT (grille de base)' : 'TTC'}
                        {l.stock !== undefined && l.qte > l.stock && <span style="color:var(--err)"> · stock : {nombre(l.stock)}</span>}
                      </span>
                    </div>
                    <Stepper value={l.qte} min={1} step={type === 'pro' && l.colisage > 1 ? l.colisage : 1} onChange={(v) => setLignes((ls) => ls.map((x, k) => (k === i ? { ...x, qte: v } : x)))} label={`Quantité de ${l.nom} ${l.volume}`} />
                    <button type="button" class="tool" aria-label={`Retirer ${l.nom} ${l.volume}`} onClick={() => setLignes((ls) => ls.filter((_, k) => k !== i))}>
                      <Icon name="corbeille" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {type === 'pro' ? (
            <Card titre="3. Livraison" icone="camion">
              <div class="form">
                {cpt?.adressesLivraison?.length > 0 ? (
                  <Select
                    label="Adresse de livraison"
                    value={livraison.adresseId}
                    onChange={(e) => setLivraison({ ...livraison, adresseId: e.currentTarget.value })}
                    options={cpt.adressesLivraison.map((a, i) => ({ value: a.id || String(i), label: formatAdresse(a).join(', ') }))}
                    help="Transporteur de la distillerie, 48 à 72 h ouvrées."
                  />
                ) : (
                  <p class="small muted">Livraison à l’adresse du compte, par le transporteur de la distillerie.</p>
                )}
                <div class="form-grid">
                  <Input label="Référence du client" opt value={pro.referenceClient} onInput={(e) => setPro({ ...pro, referenceClient: e.currentTarget.value })} maxLength={40} error={erreurDe(err, 'referenceClient')} placeholder="Bon de commande n°…" />
                  <Input label="Date souhaitée" opt type="date" min={aujourdHui()} value={pro.dateSouhaitee} onInput={(e) => setPro({ ...pro, dateSouhaitee: e.currentTarget.value })} error={erreurDe(err, 'dateSouhaitee')} />
                </div>
                <Textarea label="Commentaire du client" opt value={pro.commentaire} onInput={(e) => setPro({ ...pro, commentaire: e.currentTarget.value })} rows={2} style="min-height:64px" error={erreurDe(err, 'commentaire')} />
                <Textarea label="Note interne" opt value={note} onInput={(e) => setNote(e.currentTarget.value)} rows={2} placeholder="Ex. : livraison avant 11 h" style="min-height:64px" />
                {cpt && (
                  <p class="small muted">
                    Paiement selon les conditions du compte : <strong>{CONDITIONS[cpt.conditions] || cpt.conditions}</strong>. Prix de la grille {GRILLE[cpt.grille]?.label.replace('Grille ', '') || cpt.grille}
                    {cpt.remise ? `, remise de ${String(cpt.remise).replace('.', ',')} %` : ''}.
                  </p>
                )}
              </div>
            </Card>
          ) : (
            <Card titre="3. Livraison et paiement" icone="camion">
              <div class="form">
                <Choices name="livraison" value={livraison.mode} onChange={(m) => setLivraison({ ...livraison, mode: m })} items={['retrait', 'colissimo', 'relais'].map((m) => ({ value: m, titre: LIVRAISON[m].label, icone: LIVRAISON[m].icone }))} />
                {livraison.mode === 'retrait' ? (
                  <Input label="Jour de retrait" type="date" min={aujourdHui()} value={livraison.jourRetrait} onInput={(e) => setLivraison({ ...livraison, jourRetrait: e.currentTarget.value })} help="Du lundi au samedi, à la distillerie." error={erreurDe(err, 'jourRetrait')} />
                ) : (
                  <div class="form-grid">
                    <Input class="span-2" label={livraison.mode === 'relais' ? 'Adresse du client (pour choisir le relais)' : 'Adresse'} value={livraison.adresse.ligne1} onInput={(e) => setLivraison({ ...livraison, adresse: { ...livraison.adresse, ligne1: e.currentTarget.value } })} autoComplete="off" error={erreurDe(err, 'adresse', 'ligne1')} />
                    <Input class="span-2" label="Complément" opt value={livraison.adresse.ligne2} onInput={(e) => setLivraison({ ...livraison, adresse: { ...livraison.adresse, ligne2: e.currentTarget.value } })} autoComplete="off" />
                    <Input label="Code postal" inputMode="numeric" value={livraison.adresse.cp} onInput={(e) => setLivraison({ ...livraison, adresse: { ...livraison.adresse, cp: e.currentTarget.value } })} autoComplete="off" error={erreurDe(err, 'cp')} help="France métropolitaine" />
                    <Input label="Ville" value={livraison.adresse.ville} onInput={(e) => setLivraison({ ...livraison, adresse: { ...livraison.adresse, ville: e.currentTarget.value } })} autoComplete="off" error={erreurDe(err, 'ville')} />
                  </div>
                )}
                <div class="form-grid">
                  <Select
                    label="Paiement"
                    value={paiement}
                    onChange={(e) => setPaiement(e.currentTarget.value)}
                    options={[
                      { value: 'carte', label: 'Carte bancaire (par téléphone)' },
                      { value: 'virement', label: 'Virement' },
                      { value: 'a-reception', label: 'À la réception ou au retrait' },
                      { value: 'comptant', label: 'Comptant à la boutique' },
                    ]}
                  />
                  <Input label="Code promo" opt value={code} onInput={(e) => setCode(e.currentTarget.value.toUpperCase())} champClass="mono" error={erreurDe(err, 'code')} autoComplete="off" />
                </div>
                <Check label="Paiement déjà reçu" checked={paye} onChange={(e) => setPaye(e.currentTarget.checked)} />
                <Check label="Le client accepte de recevoir la lettre d’information" checked={consentement} onChange={(e) => setConsentement(e.currentTarget.checked)} />
                <Textarea label="Note interne" opt value={note} onInput={(e) => setNote(e.currentTarget.value)} rows={2} placeholder="Ex. : rappeler le client à la préparation" style="min-height:72px" />
                {alcool && <Check label="Le client a confirmé avoir 18 ans ou plus (la commande contient de l’alcool)." checked={age} onChange={(e) => setAge(e.currentTarget.checked)} boite />}
                {erreurDe(err, 'ageConfirme') && <p class="field__err">{erreurDe(err, 'ageConfirme')}</p>}
              </div>
            </Card>
          )}
        </div>

        <aside class="stack resume-col">
          <Card titre="Récapitulatif" icone="commandes">
            <div class="stack stack--s">
              <div class="kv">
                <span>Client</span>
                <span class="strong ellipsis" style="max-width:60%">{type === 'pro' ? cpt?.enseigne || cpt?.raisonSociale || '—' : clientChoisi ? `${clientChoisi.prenom || ''} ${clientChoisi.nom || ''}` : `${client.prenom} ${client.nom}`.trim() || '—'}</span>
              </div>
              <div class="kv">
                <span>Articles</span>
                <span>{pluriel(bouteilles, 'bouteille', 'bouteilles')}</span>
              </div>
              <div class="kv">
                <span>Livraison</span>
                <span>{type === 'pro' ? 'Transporteur' : LIVRAISON[livraison.mode]?.court}</span>
              </div>
              <div class="kv">
                <span>Sous-total indicatif {type === 'pro' ? 'HT' : 'TTC'}</span>
                <span class="strong">{euros(sousTotal)}</span>
              </div>
              <p class="small muted">{type === 'pro' ? 'Prix de la grille de base : la remise du compte, le franco et la TVA sont appliqués à l’enregistrement.' : 'Port, code promo et TVA calculés à l’enregistrement.'}</p>
              {err && !erreurDe(err, 'compteId', 'client', 'email', 'nom', 'prenom', 'lignes', 'ageConfirme', 'jourRetrait', 'adresse', 'ligne1', 'cp', 'ville', 'code', 'referenceClient', 'dateSouhaitee', 'commentaire') && <Notice ton="err">{err.message}</Notice>}
              <Button variant="primary" size="lg" block icon="check" busy={envoi} onClick={creer} class="only-desk-flex">
                Créer la commande
              </Button>
            </div>
          </Card>
        </aside>
      </div>
      <div class="dock">
        <Button variant="primary" icon="check" busy={envoi} onClick={creer}>
          Créer · {euros(sousTotal)}
        </Button>
      </div>
    </div>
  );
}

function ChoixClient({ client, setClient, choisi, setChoisi, err }) {
  const [q, setQ] = useState('');
  const res = useCrm(q.trim().length >= 2 ? 'clients' : null, { q: q.trim(), par: 6 });
  const liste = elements(res.data, 'clients');
  if (choisi) {
    return (
      <div class="choisi">
        <Avatar nom={`${choisi.prenom || ''} ${choisi.nom || ''}`} cle={choisi.id} />
        <div class="grow">
          <div class="strong">
            {choisi.prenom} {choisi.nom}
          </div>
          <div class="small muted">{[choisi.email, choisi.telephone].filter(Boolean).join(' · ')}</div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setChoisi(null)}>
          Changer
        </Button>
      </div>
    );
  }
  return (
    <div class="stack stack--s">
      <SearchInput value={q} onChange={setQ} placeholder="Chercher un client existant (nom, e-mail, téléphone)" label="Chercher un client" />
      {q.trim().length >= 2 && (
        <div class="suggestions" role="list">
          {res.loading && <p class="small muted" style="padding:8px 12px">Recherche…</p>}
          {!res.loading && liste.length === 0 && <p class="small muted" style="padding:8px 12px">Aucun client trouvé : saisissez-le ci-dessous.</p>}
          {liste.map((c) => (
            <button key={c.id} type="button" class="list__item" role="listitem" onClick={() => setChoisi(c)}>
              <Avatar nom={`${c.prenom || ''} ${c.nom || ''}`} cle={c.id} size="s" />
              <span class="list__main">
                <span class="list__title">
                  {c.prenom} {c.nom}
                </span>
                <span class="list__meta">{[c.email, c.ville || c.adresse?.ville].filter(Boolean).join(' · ')}</span>
              </span>
              <Icon name="plus" size="s" class="list__chev" />
            </button>
          ))}
        </div>
      )}
      <p class="eyebrow" style="margin-top:6px">Ou nouveau client</p>
      <div class="form-grid">
        <Input label="Prénom" value={client.prenom} onInput={(e) => setClient({ ...client, prenom: e.currentTarget.value })} autoComplete="off" />
        <Input label="Nom" value={client.nom} onInput={(e) => setClient({ ...client, nom: e.currentTarget.value })} autoComplete="off" />
        <Input label="E-mail" type="email" value={client.email} onInput={(e) => setClient({ ...client, email: e.currentTarget.value })} autoComplete="off" help="Le client y reçoit la confirmation." />
        <Input label="Téléphone" opt type="tel" value={client.telephone} onInput={(e) => setClient({ ...client, telephone: e.currentTarget.value })} autoComplete="off" />
      </div>
      {err && <p class="field__err">{err}</p>}
    </div>
  );
}

function ChoixCompte({ compteId, setCompteId, cpt, chargement, err }) {
  const [q, setQ] = useState('');
  const res = useCrm(!compteId ? 'comptes' : null, { q: q.trim(), par: 8, statut: 'actif' });
  const liste = elements(res.data, 'comptes');
  if (compteId) {
    return (
      <div class="choisi">
        <Avatar nom={cpt?.enseigne || cpt?.raisonSociale || '…'} cle={compteId} />
        <div class="grow">
          <div class="strong">{chargement && !cpt ? 'Chargement…' : cpt?.enseigne || cpt?.raisonSociale}</div>
          {cpt && (
            <div class="small muted">
              {COMPTE_TYPE_COURT[cpt.type] || cpt.type} · {GRILLE[cpt.grille]?.label || cpt.grille}
              {cpt.remise ? ` −${cpt.remise} %` : ''} · {CONDITIONS[cpt.conditions] || cpt.conditions}
            </div>
          )}
          {cpt?.statut === 'suspendu' && <Pill ton="err">Compte suspendu</Pill>}
        </div>
        <Button size="sm" variant="ghost" onClick={() => setCompteId('')}>
          Changer
        </Button>
      </div>
    );
  }
  return (
    <div class="stack stack--s">
      <SearchInput value={q} onChange={setQ} placeholder="Chercher un compte (enseigne, ville)" label="Chercher un compte pro" />
      <div class="suggestions" role="list">
        {res.loading && !res.data && <p class="small muted" style="padding:8px 12px">Chargement…</p>}
        {res.data && liste.length === 0 && <p class="small muted" style="padding:8px 12px">Aucun compte actif ne correspond.</p>}
        {liste.map((c) => (
          <button key={c.id} type="button" class="list__item" role="listitem" onClick={() => setCompteId(c.id)}>
            <Avatar nom={c.enseigne || c.raisonSociale} cle={c.id} size="s" />
            <span class="list__main">
              <span class="list__title">{c.enseigne || c.raisonSociale}</span>
              <span class="list__meta">{[COMPTE_TYPE_COURT[c.type], c.ville || c.adresseFacturation?.ville].filter(Boolean).join(' · ')}</span>
            </span>
            <Icon name="plus" size="s" class="list__chev" />
          </button>
        ))}
      </div>
      {err && <p class="field__err">{err}</p>}
    </div>
  );
}

function Catalogue({ catalogue, chargement, erreur, onAjouter, pro }) {
  const [q, setQ] = useState('');
  const terme = plier(q.trim());
  const filtres = terme ? catalogue.filter((p) => plier(`${p.nom} ${p.gamme} ${GAMMES[p.gamme]?.nom || ''}`).includes(terme)) : [];
  return (
    <div class="stack stack--s">
      <SearchInput value={q} onChange={setQ} delai={120} placeholder="Ajouter un produit : PAC, menthe, pastis…" label="Chercher un produit à ajouter" />
      {erreur && <Notice ton="err">{erreur.message}</Notice>}
      {chargement && <p class="small muted">Chargement du catalogue…</p>}
      {!terme && catalogue.length > 0 && (
        <div class="rapide">
          <span class="small muted">Les plus vendus :</span>
          {catalogue
            .flatMap((p) => p.variantes.filter((v) => v.stock > 0).map((v) => ({ p, v })))
            .sort((a, b) => (b.v.vendus30 || 0) - (a.v.vendus30 || 0))
            .slice(0, 6)
            .map(({ p, v }) => (
              <button key={`${p.slug}-${v.id}`} type="button" class="chip" onClick={() => onAjouter(p, v)} aria-label={`Ajouter ${p.nom} ${v.volume}`}>
                <Icon name="plus" size="xs" />
                <Marque texte={p.nom} />
                <span class="chip__n">{v.volume}</span>
              </button>
            ))}
        </div>
      )}
      {terme && (
        <div class="suggestions">
          {filtres.length === 0 && <Empty petit icone="bouteille" titre="Aucun produit" texte={`Rien ne correspond à « ${q.trim()} ».`} />}
          {filtres.slice(0, 8).map((p) => (
            <div key={p.slug} class="sugg-prod">
              <Vignette slug={p.slug} taille="s" />
              <div class="grow" style="min-width:0">
                <div class="strong ellipsis">
                  <Marque texte={p.nom} logo />
                  {p.alcool && <span class="age18" style="margin-left:6px">18+</span>}
                </div>
                <div class="sugg-prod__vars">
                  {p.variantes.map((v) => (
                    <button key={v.id} type="button" class={cx('chip', v.stock <= 0 && 'chip--off')} onClick={() => onAjouter(p, v)} disabled={v.stock <= 0} aria-label={`Ajouter ${p.nom} ${v.volume}`}>
                      <Icon name="plus" size="xs" />
                      {v.volume}
                      <span class="chip__n">{euros(pro ? v.prixProHT : v.prixTTC)}</span>
                      {v.stock <= 0 && <span class="chip__n">· rupture</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
