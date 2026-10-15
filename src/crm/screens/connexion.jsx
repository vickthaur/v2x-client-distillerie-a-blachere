// Connexion au CRM : profils de démonstration en un clic, connexion classique, mot de passe
// oublié ; pages publiques de réinitialisation (/crm/mot-de-passe) et d'invitation (/crm/activer).
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../ui/icons.jsx';
import { Avatar, Button, Notice, useTitre } from '../ui/base.jsx';
import { Dialog } from '../ui/overlay.jsx';
import { Input, erreurDe } from '../ui/form.jsx';
import { session } from '../lib/data.js';
import { navigate, useQuery } from '../lib/router.jsx';
import { date } from '../lib/format.js';

const MDP_DEMO = 'Distillerie1835';
const PROFILS = [
  { id: 'direction', nom: 'Hélène Garnier', role: 'Direction', email: 'direction@blachere.example', voit: 'Tout le CRM : chiffre d’affaires, ventes, comptes pro, équipe et réglages.' },
  { id: 'commercial', nom: 'Thomas Roux', role: 'Commercial · Vaucluse et Gard', email: 'commercial@blachere.example', voit: 'Comptes et demandes pro, commandes pro et factures, newsletter.' },
  { id: 'logistique', nom: 'Karim Benali', role: 'Logistique', email: 'logistique@blachere.example', voit: 'Préparation et expédition des commandes, stocks et mouvements.' },
  { id: 'boutique', nom: 'Léa Fabre', role: 'Boutique et visites', email: 'boutique@blachere.example', voit: 'Commandes en ligne, clients, visites de la distillerie, messages.' },
];

function Marque() {
  return (
    <aside class="auth__brand" aria-label="Distillerie A. Blachère">
      <img class="auth__blason" src="/logos/blason.svg" alt="" aria-hidden="true" />
      <img class="auth__logo" src="/logos/logo-blanc.svg" alt="Distillerie A. Blachère" width="220" height="54" />
      <div class="auth__pitch">
        <p class="auth__eyebrow">CRM de la distillerie</p>
        <p class="auth__display">
          Toute la distillerie, <em>d’un seul coup d’œil.</em>
        </p>
        <p class="auth__text">Commandes en ligne et pro, stocks, visites, messages et newsletter : un seul outil pour l’équipe de Châteauneuf-du-Pape.</p>
      </div>
      <p class="auth__foot">
        Avignon 1835 · Châteauneuf-du-Pape depuis 1993
        <br />
        Maquette V2X Studio : données fictives, rien n’est envoyé.
      </p>
    </aside>
  );
}

export function Connexion({ message, demo, onConnecte }) {
  useTitre('Connexion');
  const [busy, setBusy] = useState(null);
  const [errDemo, setErrDemo] = useState(null);
  const [f, setF] = useState({ email: '', motDePasse: '' });
  const [err, setErr] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [voir, setVoir] = useState(false);
  const [oubli, setOubli] = useState(false);
  const mdpRef = useRef(null);

  const entrer = async (profil) => {
    setBusy(profil);
    setErrDemo(null);
    try {
      await session('demo', { method: 'POST', body: { profil } });
      await onConnecte();
    } catch (e) {
      setErrDemo(e);
      setBusy(null);
    }
  };
  const connecter = async (e) => {
    e.preventDefault();
    if (!f.email.trim() || !f.motDePasse) {
      setErr({ message: !f.email.trim() ? 'Saisissez votre adresse e-mail.' : 'Saisissez votre mot de passe.', champ: !f.email.trim() ? 'email' : 'motDePasse' });
      return;
    }
    setEnvoi(true);
    setErr(null);
    try {
      await session('connexion', { method: 'POST', body: { email: f.email.trim(), motDePasse: f.motDePasse, espace: 'crm' } });
      await onConnecte();
    } catch (x) {
      setErr(x);
      setEnvoi(false);
    }
  };
  const remplir = (email) => {
    setF({ email, motDePasse: MDP_DEMO });
    setErr(null);
    mdpRef.current?.focus();
  };

  const errEmail = erreurDe(err, 'email');
  const errMdp = erreurDe(err, 'motDePasse', 'mot-de-passe');
  const errAutre = err && !errEmail && !errMdp ? err.message : null;

  return (
    <div class="auth">
      <Marque />
      <main class="auth__main" id="contenu">
        <div class="auth__col">
          <header class="auth__head">
            <p class="eyebrow">Connexion</p>
            <h1 class="auth__title">Entrer dans le CRM</h1>
          </header>

          {message && (
            <Notice ton={message.ton} class="auth__msg">
              {message.texte}
            </Notice>
          )}
          {demo?.active && !message && (
            <Notice ton="demo" class="auth__msg">
              <strong>Démo en cours dans ce navigateur</strong>
              {demo.creeLe ? ` (ouverte le ${date(demo.creeLe)})` : ''}. Choisissez un profil pour la retrouver avec ses données.
            </Notice>
          )}

          <section class="auth__section" aria-labelledby="demo-titre">
            <div class="auth__section-head">
              <h2 class="h3" id="demo-titre">
                Démonstration
              </h2>
              <p class="small muted">Un clic, sans mot de passe. Chaque profil voit ce que son métier demande.</p>
            </div>
            <div class="profils">
              {PROFILS.map((p) => (
                <button key={p.id} type="button" class="profil" onClick={() => entrer(p.id)} disabled={!!busy} aria-busy={busy === p.id ? 'true' : undefined} aria-label={`Entrer en démo : ${p.nom}, ${p.role}`}>
                  <span class="profil__top">
                    <Avatar nom={p.nom} cle={p.id} size="l" />
                    <span class="profil__id">
                      <span class="profil__nom">{p.nom}</span>
                      <span class="profil__role">{p.role}</span>
                    </span>
                  </span>
                  <span class="profil__voit">{p.voit}</span>
                  <span class="profil__go">
                    {busy === p.id ? <span class="spinner" aria-hidden="true" /> : <Icon name="fleche-d" size="s" />}
                    Entrer en démo
                  </span>
                </button>
              ))}
            </div>
            {errDemo && <Notice ton="err">{errDemo.message}</Notice>}
          </section>

          <div class="auth__ou" role="separator">
            <span>ou avec votre adresse e-mail</span>
          </div>

          <form class="form auth__form" onSubmit={connecter} noValidate>
            <Input label="Adresse e-mail" type="email" autoComplete="username" inputMode="email" value={f.email} onInput={(e) => setF({ ...f, email: e.currentTarget.value })} error={errEmail} />
            <div class="field">
              <div class="field__label">
                <label for="mdp">Mot de passe</label>
                <button type="button" class="link small" onClick={() => setOubli(true)}>
                  Mot de passe oublié ?
                </button>
              </div>
              <div class="input-group">
                <input
                  id="mdp"
                  ref={mdpRef}
                  class="input"
                  type={voir ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={f.motDePasse}
                  onInput={(e) => setF({ ...f, motDePasse: e.currentTarget.value })}
                  aria-invalid={errMdp ? 'true' : undefined}
                  aria-describedby={errMdp ? 'mdp-err' : undefined}
                  style="padding-right:44px"
                />
                <button type="button" class="input-group__clear" aria-label={voir ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={voir ? 'true' : 'false'} onClick={() => setVoir(!voir)}>
                  <Icon name="oeil" size="s" />
                </button>
              </div>
              {errMdp && (
                <p class="field__err" id="mdp-err">
                  <Icon name="alerte" />
                  {errMdp}
                </p>
              )}
            </div>
            {errAutre && <Notice ton="err">{errAutre}</Notice>}
            <Button type="submit" variant="primary" size="lg" block busy={envoi}>
              Se connecter
            </Button>
          </form>

          <aside class="auth__hint" aria-labelledby="hint-titre">
            <p class="auth__hint-title" id="hint-titre">
              <Icon name="cle" size="s" />
              Comptes de démonstration
            </p>
            <p class="small">
              Mot de passe commun : <code class="mono auth__code">{MDP_DEMO}</code>
            </p>
            <ul class="auth__emails">
              {PROFILS.map((p) => (
                <li key={p.id}>
                  <button type="button" class="auth__email" onClick={() => remplir(p.email)}>
                    <span class="mono">{p.email}</span>
                    <span class="muted">{p.role.split(' · ')[0]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <p class="auth__links small">
            <a class="link" href="/espace-pro">
              Vous êtes un professionnel ? Espace pro
            </a>
            <a class="link link--ink" href="/">
              Retour au site
            </a>
          </p>
        </div>
      </main>
      {oubli && <DialogOubli emailInitial={f.email} onClose={() => setOubli(false)} />}
    </div>
  );
}

function DialogOubli({ emailInitial, onClose }) {
  const [email, setEmail] = useState(emailInitial || '');
  const [etat, setEtat] = useState({});
  const envoyer = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setEtat({ erreur: { message: 'Saisissez une adresse e-mail valide.', champ: 'email' } });
      return;
    }
    setEtat({ envoi: true });
    try {
      const d = await session('oubli', { method: 'POST', body: { email: email.trim(), espace: 'crm' } });
      setEtat({ fait: true, lienDemo: d?.lienDemo });
    } catch (e) {
      setEtat({ erreur: e });
    }
  };
  return (
    <Dialog
      titre="Mot de passe oublié"
      sous={etat.fait ? null : 'Recevez un lien pour choisir un nouveau mot de passe (valable une heure).'}
      icone="cle"
      taille="s"
      onClose={onClose}
      onSubmit={etat.fait ? onClose : envoyer}
      pied={
        etat.fait ? (
          <Button type="submit" variant="primary">
            Fermer
          </Button>
        ) : (
          <>
            <Button onClick={onClose}>Annuler</Button>
            <Button type="submit" variant="primary" busy={etat.envoi}>
              Envoyer le lien
            </Button>
          </>
        )
      }
    >
      {etat.fait ? (
        <div class="stack stack--s">
          <Notice ton="ok">Si un compte existe pour {email.trim()}, un lien de réinitialisation vient de lui être envoyé.</Notice>
          {etat.lienDemo && (
            <Notice ton="demo">
              <strong>Démonstration :</strong> aucun courriel ne part vraiment. Voici le lien qui aurait été reçu :
              <div style="margin-top:10px">
                <Button
                  variant="primary"
                  size="sm"
                  icon="fleche-d"
                  onClick={() => {
                    onClose();
                    navigate(new URL(etat.lienDemo, location.origin).pathname + new URL(etat.lienDemo, location.origin).search);
                  }}
                >
                  Choisir un nouveau mot de passe
                </Button>
              </div>
            </Notice>
          )}
        </div>
      ) : (
        <div class="form">
          <Input label="Adresse e-mail" type="email" autoComplete="username" value={email} onInput={(e) => setEmail(e.currentTarget.value)} error={erreurDe(etat.erreur, 'email')} />
          {etat.erreur && !erreurDe(etat.erreur, 'email') && <Notice ton="err">{etat.erreur.message}</Notice>}
        </div>
      )}
    </Dialog>
  );
}

// Carte centrée des pages publiques (réinitialisation, invitation)
function CartePublique({ titre, sous, children }) {
  return (
    <div class="auth auth--simple">
      <main class="auth__main" id="contenu">
        <div class="auth__col auth__col--carte">
          <a href="/crm" class="auth__logo-ink" aria-label="CRM de la Distillerie A. Blachère">
            <img src="/logos/logo.svg" alt="" width="200" height="49" />
          </a>
          <div class="card">
            <div class="card__body stack">
              <header class="stack stack--xs">
                <h1 class="auth__title" style="font-size:24px">
                  {titre}
                </h1>
                {sous && <p class="muted">{sous}</p>}
              </header>
              {children}
            </div>
          </div>
          <p class="auth__links small">
            <a class="link link--ink" href="/crm">
              Retour à la connexion
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}

function FormulaireMdp({ bouton, onValider, email }) {
  const [f, setF] = useState({ mdp: '', conf: '' });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const envoyer = async (e) => {
    e.preventDefault();
    const x = {};
    if (f.mdp.length < 10) x.mdp = '10 caractères au moins.';
    if (f.conf !== f.mdp) x.conf = 'Les deux saisies ne correspondent pas.';
    setErr(x);
    if (Object.keys(x).length) return;
    setBusy(true);
    try {
      await onValider(f.mdp);
    } catch (y) {
      setErr({ [y.champ === 'motDePasse' ? 'mdp' : 'general']: y.message });
      setBusy(false);
    }
  };
  return (
    <form class="form" onSubmit={envoyer} noValidate>
      {email && <input type="email" autoComplete="username" value={email} readOnly hidden />}
      <Input label="Nouveau mot de passe" type="password" autoComplete="new-password" value={f.mdp} onInput={(e) => setF({ ...f, mdp: e.currentTarget.value })} error={err.mdp} help="10 caractères au moins. Une phrase courte est facile à retenir." />
      <Input label="Confirmation" type="password" autoComplete="new-password" value={f.conf} onInput={(e) => setF({ ...f, conf: e.currentTarget.value })} error={err.conf} />
      {err.general && <Notice ton="err">{err.general}</Notice>}
      <Button type="submit" variant="primary" size="lg" block busy={busy}>
        {bouton}
      </Button>
    </form>
  );
}

export function MotDePasse({ onConnecte }) {
  useTitre('Nouveau mot de passe');
  const [q] = useQuery();
  const jeton = q.get('jeton');
  if (!jeton) {
    return (
      <CartePublique titre="Lien incomplet">
        <Notice ton="warn">Ce lien de réinitialisation est incomplet. Demandez-en un nouveau depuis l’écran de connexion (« Mot de passe oublié ? »).</Notice>
      </CartePublique>
    );
  }
  return (
    <CartePublique titre="Choisir un nouveau mot de passe" sous="Le lien reçu par courriel est valable une heure et ne sert qu’une fois.">
      <FormulaireMdp
        bouton="Enregistrer et se connecter"
        onValider={async (motDePasse) => {
          const d = await session('reinitialiser-mot-de-passe', { method: 'POST', body: { jeton, motDePasse } });
          navigate(d?.redirection?.startsWith('/crm') ? d.redirection : '/crm', { replace: true });
          await onConnecte();
        }}
      />
    </CartePublique>
  );
}

export function Activer({ onConnecte }) {
  useTitre('Activer votre compte');
  const [q] = useQuery();
  const jeton = q.get('jeton');
  const [inv, setInv] = useState({ chargement: !!jeton });
  useEffect(() => {
    if (!jeton) return;
    session('invitation', { query: { jeton } })
      .then((d) => setInv({ d }))
      .catch((e) => setInv({ erreur: e }));
  }, [jeton]);
  if (!jeton || inv.erreur) {
    return (
      <CartePublique titre="Invitation introuvable">
        <Notice ton="warn">{inv.erreur?.status === 404 || !jeton ? 'Ce lien d’invitation n’est plus valable (il sert une fois et expire après 7 jours). Demandez une nouvelle invitation à la direction.' : inv.erreur.message}</Notice>
      </CartePublique>
    );
  }
  if (inv.chargement) {
    return (
      <CartePublique titre="Activer votre compte">
        <div class="skel skel--block" style="height:160px" />
      </CartePublique>
    );
  }
  return (
    <CartePublique titre={`Bienvenue${inv.d?.prenom ? `, ${inv.d.prenom}` : ''}`} sous={`Choisissez le mot de passe du compte ${inv.d?.email || ''} pour entrer dans le CRM de la distillerie.`}>
      <FormulaireMdp
        email={inv.d?.email}
        bouton="Activer mon compte"
        onValider={async (motDePasse) => {
          const d = await session('activer', { method: 'POST', body: { jeton, motDePasse } });
          if (d?.redirection && !d.redirection.startsWith('/crm')) {
            location.assign(d.redirection);
            return;
          }
          navigate('/crm', { replace: true });
          await onConnecte();
        }}
      />
    </CartePublique>
  );
}
