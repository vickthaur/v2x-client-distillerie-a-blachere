// Compte : établissement (raison sociale, SIRET en lecture seule ; téléphone et e-mail de facturation
// modifiables), adresses de livraison (ajout, modification, suppression), utilisateurs, mot de passe,
// déconnexion.
import { useRef, useState } from 'preact/hooks';
import { api } from '../../lib/api.js';
import { pro, useDonnees } from '../donnees.js';
import { Adresse, AdresseForm } from '../adresses.jsx';
import { dateHeure, CONDITIONS, eur, NB } from '../format.js';
import { Chargement, Confirmer, Erreur, Icone, Pastille, TitreVue } from '../ui.jsx';

const TYPES = { chr: 'Café, hôtel, restaurant', hotel: 'Hôtel', camping: 'Camping', caviste: 'Caviste', epicerie: 'Épicerie fine', distributeur: 'Distributeur', autre: 'Autre' };
const LICENCES = { 'licence-iv': 'Licence IV', 'licence-restaurant': 'Licence restaurant', 'petite-licence-restaurant': 'Petite licence restaurant', 'vente-a-emporter': 'Licence de vente à emporter', aucune: 'Aucune licence de débit de boissons' };

export function Compte({ session, site }) {
  const { data, error, loading, reload, setData } = useDonnees('compte');
  const c = data?.compte || data || {};
  const utilisateurs = data?.utilisateurs || c.utilisateurs || [];
  return (
    <>
      <TitreVue kicker="Paramètres" titre="Votre" accent="compte" />
      {loading && !data ? (
        <Chargement lignes={6} />
      ) : error ? (
        <Erreur erreur={error} reessayer={reload} />
      ) : (
        <div class="acc">
          <div class="acc__main">
            <Etablissement c={c} site={site} onSaved={(d) => (d ? setData((x) => (x?.compte ? { ...x, compte: { ...x.compte, ...(d.compte || d) } } : { ...x, ...(d.compte || d) })) : reload())} />
            <Adresses c={c} site={site} reload={reload} />
            <Utilisateurs utilisateurs={utilisateurs} moi={session.utilisateur} />
          </div>
          <aside class="acc__side">
            <section class="pro-card" aria-labelledby="acc-cond">
              <h2 class="pro-h2" id="acc-cond">
                Conditions
              </h2>
              <dl class="pro-dl pro-dl--compact">
                <div>
                  <dt>Règlement</dt>
                  <dd>{CONDITIONS[c.conditions] || c.conditions || '—'}</dd>
                </div>
                {c.francoHT > 0 && (
                  <div>
                    <dt>Franco</dt>
                    <dd>
                      {eur(c.francoHT)}
                      {NB}HT
                    </dd>
                  </div>
                )}
                {c.encoursMax > 0 && (
                  <div>
                    <dt>Encours autorisé</dt>
                    <dd>{eur(c.encoursMax)}</dd>
                  </div>
                )}
              </dl>
              <a class="pro-more" href="/espace-pro/documents?onglet=conditions">
                Détail des conditions <Icone n="arrow" />
              </a>
            </section>
            <MotDePasse site={site} />
            <section class="pro-card" aria-labelledby="acc-out">
              <h2 class="pro-h2" id="acc-out">
                Session
              </h2>
              <p class="pro-muted">
                Connecté en tant que <strong>{session.utilisateur.email}</strong>
                {session.utilisateur.derniereConnexion ? `, dernière connexion le ${dateHeure(session.utilisateur.derniereConnexion)}` : ''}.
              </p>
              <Deconnexion site={site} />
            </section>
          </aside>
        </div>
      )}
    </>
  );
}

function Etablissement({ c, site, onSaved }) {
  const [edition, setEdition] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [err, setErr] = useState(null);
  const ref = useRef(null);
  const save = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(ref.current));
    const body = { telephone: v.telephone.trim(), email: v.email.trim() };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email)) return setErr({ message: 'Indiquez une adresse e-mail valide.', champ: 'email' });
    if (body.telephone && !/^[+\d][\d\s.-]{8,}$/.test(body.telephone)) return setErr({ message: 'Ce numéro de téléphone ne semble pas valide.', champ: 'telephone' });
    setOccupe(true);
    setErr(null);
    try {
      const r = await pro('compte', { method: 'PATCH', body });
      onSaved(r && typeof r === 'object' ? r : null);
      setEdition(false);
      site?.toast('Coordonnées enregistrées');
    } catch (x) {
      setErr(x);
    } finally {
      setOccupe(false);
    }
  };
  return (
    <section class="pro-card" aria-labelledby="acc-etab">
      <div class="pro-card__head">
        <h2 class="pro-h2" id="acc-etab">
          Établissement
        </h2>
        {!edition && (
          <button type="button" class="btn btn--ghost btn--sm" onClick={() => setEdition(true)}>
            <Icone n="edit" />
            Modifier les coordonnées
          </button>
        )}
      </div>
      <dl class="pro-dl">
        <div>
          <dt>Raison sociale</dt>
          <dd>{c.raisonSociale || '—'}</dd>
        </div>
        <div>
          <dt>Enseigne</dt>
          <dd>{c.enseigne || '—'}</dd>
        </div>
        {c.type && (
          <div>
            <dt>Activité</dt>
            <dd>{TYPES[c.type] || c.type}</dd>
          </div>
        )}
        <div>
          <dt>SIRET</dt>
          <dd>{c.siret ? String(c.siret).replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, `$1${NB}$2${NB}$3${NB}$4`) : '—'}</dd>
        </div>
        {c.tvaIntra && (
          <div>
            <dt>TVA intracommunautaire</dt>
            <dd>{c.tvaIntra}</dd>
          </div>
        )}
        {c.licence && (
          <div>
            <dt>Licence</dt>
            <dd>{LICENCES[c.licence] || c.licence}</dd>
          </div>
        )}
        {!edition && (
          <>
            <div>
              <dt>Téléphone</dt>
              <dd>{c.telephone || '—'}</dd>
            </div>
            <div>
              <dt>E-mail de facturation</dt>
              <dd>{c.email || '—'}</dd>
            </div>
          </>
        )}
        <div>
          <dt>Adresse de facturation</dt>
          <dd>
            <Adresse a={c.adresseFacturation} />
          </dd>
        </div>
      </dl>
      {edition && (
        <form class="pro-form" ref={ref} onSubmit={save} onInput={() => err && setErr(null)} noValidate>
          <div class="pro-grid">
            <label class="field">
              <span>Téléphone</span>
              <input name="telephone" type="tel" autocomplete="tel" defaultValue={c.telephone || ''} maxLength={30} aria-invalid={err?.champ === 'telephone' ? 'true' : undefined} class={err?.champ === 'telephone' ? 'is-invalid' : ''} />
            </label>
            <label class="field">
              <span>E-mail de facturation</span>
              <input name="email" type="email" autocomplete="email" defaultValue={c.email || ''} maxLength={160} required aria-invalid={err?.champ === 'email' ? 'true' : undefined} class={err?.champ === 'email' ? 'is-invalid' : ''} />
            </label>
          </div>
          {err && (
            <p class="form-msg is-error" role="alert">
              {err.message}
            </p>
          )}
          <div class="pro-form__actions">
            <button type="submit" class="btn btn--primary btn--sm" disabled={occupe}>
              {occupe ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="button" class="btn btn--ghost btn--sm" onClick={() => (setEdition(false), setErr(null))} disabled={occupe}>
              Annuler
            </button>
          </div>
        </form>
      )}
      <p class="pro-fine">La raison sociale, le SIRET et l’adresse de facturation se modifient avec votre commercial.</p>
    </section>
  );
}

function Adresses({ c, site, reload }) {
  const [mode, setMode] = useState(null); // null | 'nouvelle' | id en modification
  const [suppr, setSuppr] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const adresses = c.adressesLivraison || [];
  return (
    <section class="pro-card" aria-labelledby="acc-adr">
      <div class="pro-card__head">
        <h2 class="pro-h2" id="acc-adr">
          Adresses de livraison
        </h2>
        {mode !== 'nouvelle' && (
          <button type="button" class="btn btn--ghost btn--sm" onClick={() => setMode('nouvelle')}>
            <Icone n="plus" />
            Ajouter une adresse
          </button>
        )}
      </div>
      {mode === 'nouvelle' && (
        <AdresseForm
          onAnnuler={() => setMode(null)}
          onEnregistrer={async (val) => {
            await pro('adresse', { method: 'POST', body: val });
            setMode(null);
            reload();
            site?.toast('Adresse ajoutée');
          }}
        />
      )}
      {adresses.length ? (
        <ul class="acc-adr">
          {adresses.map((a) => (
            <li key={a.id} class="acc-adr__item">
              {mode === a.id ? (
                <AdresseForm
                  titre="Modifier l’adresse"
                  initiale={a}
                  onAnnuler={() => setMode(null)}
                  onEnregistrer={async (val) => {
                    await pro('adresse', { method: 'PATCH', query: { id: a.id }, body: val });
                    setMode(null);
                    reload();
                    site?.toast('Adresse modifiée');
                  }}
                />
              ) : (
                <>
                  <span class="acc-adr__icon">
                    <Icone n="pin" />
                  </span>
                  <Adresse a={a} />
                  <div class="acc-adr__actions">
                    <button type="button" class="btn btn--ghost btn--sm" onClick={() => setMode(a.id)} aria-label={`Modifier l’adresse ${a.nom || a.ligne1}`}>
                      Modifier
                    </button>
                    <button type="button" class="btn btn--ghost btn--sm" onClick={() => setSuppr(a)} disabled={adresses.length < 2} aria-label={`Supprimer l’adresse ${a.nom || a.ligne1}`} title={adresses.length < 2 ? 'Gardez au moins une adresse de livraison' : undefined}>
                      Supprimer
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        mode !== 'nouvelle' && <p class="pro-muted">Aucune adresse de livraison&nbsp;: ajoutez-en une pour commander.</p>
      )}
      <Confirmer
        ouvert={!!suppr}
        titre="Supprimer cette adresse&#8239;?"
        danger
        confirmer="Supprimer"
        occupe={occupe}
        onAnnuler={() => setSuppr(null)}
        onConfirmer={async () => {
          setOccupe(true);
          try {
            await pro('adresse', { method: 'DELETE', query: { id: suppr.id } });
            site?.toast('Adresse supprimée');
            setSuppr(null);
            reload();
          } catch (x) {
            site?.toast(x?.message || 'L’adresse n’a pas pu être supprimée.');
          } finally {
            setOccupe(false);
          }
        }}
      >
        {suppr && <Adresse a={suppr} />}
        <p class="pro-muted">Les commandes déjà passées gardent leur adresse.</p>
      </Confirmer>
    </section>
  );
}

function Utilisateurs({ utilisateurs, moi }) {
  return (
    <section class="pro-card" aria-labelledby="acc-users">
      <h2 class="pro-h2" id="acc-users">
        Utilisateurs du compte
      </h2>
      {utilisateurs.length ? (
        <ul class="acc-users">
          {utilisateurs.map((u) => (
            <li key={u.id || u.email}>
              <span class="acc-users__av" aria-hidden="true">
                {`${u.prenom?.[0] || ''}${u.nom?.[0] || ''}`}
              </span>
              <span class="acc-users__txt">
                <strong>
                  {[u.prenom, u.nom].filter(Boolean).join(' ')}
                  {u.id === moi.id ? ' (vous)' : ''}
                </strong>
                <span>{u.email}</span>
              </span>
              {u.actif === false ? <Pastille ton="muet">Désactivé</Pastille> : u.invitation || u.statut === 'invite' ? <Pastille ton="warn">Invitation envoyée</Pastille> : <Pastille ton="ok">Actif</Pastille>}
            </li>
          ))}
        </ul>
      ) : (
        <p class="pro-muted">Vous êtes le seul utilisateur du compte.</p>
      )}
      <p class="pro-fine">
        Pour donner accès à un collègue, <a class="link" href="/espace-pro/messages?nouveau=1&sujet=pro">demandez-le à votre commercial</a>&nbsp;: il recevra une invitation par e-mail.
      </p>
    </section>
  );
}

function MotDePasse({ site }) {
  const ref = useRef(null);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(ref.current));
    setOk(false);
    if (!v.actuel) return setErr({ message: 'Indiquez votre mot de passe actuel.', champ: 'actuel' });
    if ((v.nouveau || '').length < 10) return setErr({ message: 'Le nouveau mot de passe compte au moins 10 caractères.', champ: 'nouveau' });
    if (v.nouveau !== v.confirmation) return setErr({ message: 'Les deux saisies du nouveau mot de passe diffèrent.', champ: 'confirmation' });
    setOccupe(true);
    setErr(null);
    try {
      await api('session', 'mot-de-passe', { method: 'POST', body: { espace: 'pro', actuel: v.actuel, nouveau: v.nouveau } });
      ref.current.reset();
      setOk(true);
      site?.toast('Mot de passe modifié');
    } catch (x) {
      setErr({ ...x, message: x?.message, champ: x?.champ || (x?.status === 400 || x?.status === 401 ? 'actuel' : null) });
    } finally {
      setOccupe(false);
    }
  };
  const inv = (n) => (err?.champ === n ? { 'aria-invalid': 'true', class: 'is-invalid' } : {});
  return (
    <section class="pro-card" aria-labelledby="acc-mdp">
      <h2 class="pro-h2" id="acc-mdp">
        Mot de passe
      </h2>
      <form class="pro-form" ref={ref} onSubmit={submit} onInput={() => err && setErr(null)} noValidate>
        <label class="field">
          <span>Mot de passe actuel</span>
          <input name="actuel" type="password" autocomplete="current-password" required {...inv('actuel')} />
        </label>
        <label class="field">
          <span>Nouveau mot de passe</span>
          <input name="nouveau" type="password" autocomplete="new-password" minLength={10} required {...inv('nouveau')} />
          <small>10 caractères au moins. Vos autres appareils seront déconnectés.</small>
        </label>
        <label class="field">
          <span>Confirmation</span>
          <input name="confirmation" type="password" autocomplete="new-password" required {...inv('confirmation')} />
        </label>
        {err && (
          <p class="form-msg is-error" role="alert">
            {err.message}
          </p>
        )}
        {ok && (
          <p class="form-msg" role="status">
            Mot de passe modifié.
          </p>
        )}
        <button type="submit" class="btn btn--primary btn--sm" disabled={occupe}>
          {occupe ? 'Enregistrement…' : 'Changer le mot de passe'}
        </button>
      </form>
    </section>
  );
}

function Deconnexion({ site }) {
  const [occupe, setOccupe] = useState(false);
  return (
    <button
      type="button"
      class="btn btn--ghost btn--sm"
      disabled={occupe}
      onClick={async () => {
        setOccupe(true);
        try {
          await api('session', 'deconnexion', { method: 'POST', body: { espace: 'pro' } });
          location.assign('/espace-pro?deconnecte=1');
        } catch (x) {
          setOccupe(false);
          site?.toast(x?.message || 'La déconnexion a échoué.');
        }
      }}
    >
      <Icone n="logout" />
      {occupe ? 'Déconnexion…' : 'Se déconnecter'}
    </button>
  );
}

