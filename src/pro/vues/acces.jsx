// Accès sans session : invitation (/espace-pro/activer?jeton=…, choisir son mot de passe) et
// réinitialisation (/espace-pro/mot-de-passe?jeton=…). Une fois le mot de passe choisi, la personne
// est connectée et arrive sur l'accueil de l'espace pro.
import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../../lib/api.js';
import { navigate } from '../router.js';
import { NB } from '../format.js';
import { Chargement, Icone, Note } from '../ui.jsx';

export function Acces({ route, site, onConnecte }) {
  const jeton = route.query.get('jeton') || '';
  const invitation = route.vue === 'activer';
  const [info, setInfo] = useState(invitation ? null : {});
  const [invalide, setInvalide] = useState(!jeton);
  const [err, setErr] = useState(null);
  useEffect(() => {
    if (!invitation || !jeton) return;
    api('session', 'invitation', { query: { jeton } }).then(
      (r) => {
        // Invitation d'un membre de l'équipe ouverte depuis l'espace pro : l'écran du CRM s'en charge.
        if (r?.espace === 'crm') return location.replace(`/crm/activer?jeton=${encodeURIComponent(jeton)}`);
        setInfo(r || {});
      },
      (e) => (e?.status === 404 || e?.status === 400 || e?.status === 410 ? setInvalide(true) : setErr(e)),
    );
  }, [jeton]);
  useEffect(() => {
    requestAnimationFrame(() => document.getElementById('pro-titre')?.focus({ preventScroll: true }));
  }, [invalide, !!info]);

  return (
    <div class="wrap pro-vue">
      <div class="acces">
        <div class="acces__card">
          <p class="kicker">Espace professionnel</p>
          {invalide ? (
            <>
              <h1 class="pro-h1" id="pro-titre" tabindex="-1">
                Ce lien n’est plus valable
              </h1>
              <p class="pro-lead">
                {invitation ? 'Une invitation est valable 7 jours et ne sert qu’une fois.' : 'Un lien de réinitialisation est valable une heure et ne sert qu’une fois.'} Demandez un nouveau lien depuis la page de connexion, ou écrivez aux bureaux de la distillerie.
              </p>
              <div class="pro-actions">
                <a class="btn btn--primary" href="/espace-pro">
                  Page de connexion
                </a>
                <a class="btn btn--ghost" href="/contact?sujet=pro">
                  Contacter la distillerie
                </a>
              </div>
            </>
          ) : err ? (
            <>
              <h1 class="pro-h1" id="pro-titre" tabindex="-1">
                Un problème est survenu
              </h1>
              <Note ton="err" role="alert">
                {err.message}
              </Note>
              <button type="button" class="btn btn--ghost" onClick={() => location.reload()}>
                Réessayer
              </button>
            </>
          ) : !info ? (
            <Chargement lignes={3} texte="Vérification du lien…" />
          ) : (
            <Formulaire invitation={invitation} info={info} jeton={jeton} site={site} onConnecte={onConnecte} onInvalide={() => setInvalide(true)} />
          )}
        </div>
      </div>
    </div>
  );
}

function Formulaire({ invitation, info, jeton, site, onConnecte, onInvalide }) {
  const ref = useRef(null);
  const [err, setErr] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [mdp, setMdp] = useState('');
  const force = mdp.length >= 14 && /[A-Z]/.test(mdp) && /\d/.test(mdp) ? 3 : mdp.length >= 12 ? 2 : mdp.length >= 10 ? 1 : 0;
  const submit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(ref.current));
    if ((v.motDePasse || '').length < 10) {
      setErr({ message: 'Le mot de passe compte au moins 10 caractères.', champ: 'motDePasse' });
      return ref.current.elements.motDePasse.focus();
    }
    if (v.motDePasse !== v.confirmation) {
      setErr({ message: 'Les deux saisies diffèrent.', champ: 'confirmation' });
      return ref.current.elements.confirmation.focus();
    }
    setOccupe(true);
    setErr(null);
    try {
      const r = await api('session', invitation ? 'activer' : 'reinitialiser-mot-de-passe', { method: 'POST', body: { jeton, motDePasse: v.motDePasse } });
      // Lien de réinitialisation d'un membre de l'équipe : connecté au CRM, on l'y emmène.
      if (r?.redirection && !r.redirection.startsWith('/espace-pro')) return location.assign(r.redirection);
      const s = await api('session', 'moi', { query: { espace: 'pro' } });
      if (!s?.utilisateur) throw new Error(`La connexion n’a pas abouti${NB}: connectez-vous depuis la page de l’espace pro.`);
      onConnecte(s);
      site?.toast(invitation ? `Bienvenue dans votre espace pro${s.compte?.enseigne ? `, ${s.compte.enseigne}` : ''}${NB}!` : `Mot de passe modifié${NB}: vous êtes connecté.`);
      navigate('/espace-pro/accueil', { replace: true });
    } catch (x) {
      setOccupe(false);
      if (x?.status === 404 || x?.status === 410) return onInvalide();
      setErr({ message: x?.message, champ: x?.champ || 'motDePasse' });
    }
  };
  const inv = (n) => (err?.champ === n ? { 'aria-invalid': 'true', class: 'is-invalid' } : {});
  return (
    <>
      <h1 class="pro-h1" id="pro-titre" tabindex="-1">
        {invitation ? (
          <>
            Bienvenue{info.prenom ? ` ${info.prenom}` : ''}
            <span class="accent">, choisissez votre mot de passe</span>
          </>
        ) : (
          <>
            Nouveau <span class="accent">mot de passe</span>
          </>
        )}
      </h1>
      <p class="pro-lead">
        {invitation
          ? `La distillerie a ouvert votre accès à l’espace professionnel${info.compte?.enseigne || info.compte?.raisonSociale ? ` pour ${info.compte.enseigne || info.compte.raisonSociale}` : ''}. Il ne reste qu’à choisir votre mot de passe.`
          : `Choisissez un nouveau mot de passe${NB}: vous serez connecté, et vos autres appareils déconnectés.`}
      </p>
      <form class="pro-form" ref={ref} onSubmit={submit} noValidate>
        {info.email && (
          <label class="field">
            <span>Identifiant</span>
            <input type="email" name="email" value={info.email} autocomplete="username" readOnly />
          </label>
        )}
        <label class="field">
          <span>Mot de passe</span>
          <input type="password" name="motDePasse" autocomplete="new-password" minLength={10} required value={mdp} onInput={(e) => {
              setMdp(e.currentTarget.value);
              if (err) setErr(null);
            }} aria-describedby="acces-force" {...inv('motDePasse')} />
          <span class={`acces__force acces__force--${force}`} id="acces-force" aria-live="polite">
            <span class="acces__bar" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            {mdp.length < 10 ? `${10 - mdp.length > 1 ? `Encore ${10 - mdp.length} caractères` : 'Encore 1 caractère'} au moins` : ['', 'Correct', 'Bon', 'Très bon'][force]}
          </span>
        </label>
        <label class="field">
          <span>Confirmation</span>
          <input type="password" name="confirmation" autocomplete="new-password" required onInput={() => err && setErr(null)} {...inv('confirmation')} />
        </label>
        {err && (
          <p class="form-msg is-error" role="alert">
            {err.message}
          </p>
        )}
        <button type="submit" class="btn btn--primary" disabled={occupe}>
          <Icone n="check" />
          {occupe ? 'Un instant…' : invitation ? 'Activer mon compte' : 'Enregistrer et me connecter'}
        </button>
      </form>
    </>
  );
}
