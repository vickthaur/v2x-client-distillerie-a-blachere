// Application de l'espace pro connecté : session, barre de l'espace pro (enseigne, onglets,
// déconnexion), vues, focus et titre de page à chaque changement de vue.
import { useEffect, useRef, useState } from 'preact/hooks';
import { api, demoActive } from '../lib/api.js';
import { navigate, useRoute } from './router.js';
import { versConnexion } from './donnees.js';
import { panier, usePanier } from './panier.js';
import { Chargement, Erreur, Icone } from './ui.jsx';
import { Accueil } from './vues/accueil.jsx';
import { Catalogue } from './vues/catalogue.jsx';
import { Commande } from './vues/commande.jsx';
import { Commandes } from './vues/commandes.jsx';
import { Factures } from './vues/factures.jsx';
import { Documents } from './vues/documents.jsx';
import { Compte } from './vues/compte.jsx';
import { Messages } from './vues/messages.jsx';
import { Acces } from './vues/acces.jsx';
import { Introuvable } from './vues/introuvable.jsx';

const VUES = {
  accueil: { titre: 'Accueil', C: Accueil },
  catalogue: { titre: 'Catalogue', C: Catalogue },
  commande: { titre: 'Commande en cours', C: Commande, onglet: 'Commande' },
  commandes: { titre: 'Commandes', C: Commandes },
  factures: { titre: 'Factures', C: Factures },
  documents: { titre: 'Documents', C: Documents },
  compte: { titre: 'Compte', C: Compte },
  messages: { titre: 'Messages', C: Messages },
};
const ONGLETS = ['accueil', 'catalogue', 'commande', 'commandes', 'factures', 'documents', 'compte', 'messages'];
// Vues ouvertes sans session : invitation (choisir son mot de passe) et réinitialisation.
const PUBLIQUES = { activer: 'Activer votre compte', 'mot-de-passe': 'Nouveau mot de passe' };

export function App({ site }) {
  const route = useRoute();
  const [session, setSession] = useState(null);
  const [erreur, setErreur] = useState(null);
  const publique = !!PUBLIQUES[route.vue];

  const chargerSession = async () => {
    setErreur(null);
    if (!demoActive()) return versConnexion({ expiree: false });
    try {
      const r = await api('session', 'moi', { query: { espace: 'pro' } });
      if (!r?.utilisateur) return versConnexion({ expiree: false });
      panier.ouvrir(r.utilisateur.id);
      setSession(r);
    } catch (e) {
      if (e?.status === 401) return versConnexion();
      setErreur(e);
    }
  };

  useEffect(() => {
    if (!publique && !session) chargerSession();
  }, [publique]);

  // Titre de la page, focus sur le titre de la vue et retour en haut à chaque changement de vue.
  const premier = useRef(true);
  useEffect(() => {
    const t = PUBLIQUES[route.vue] || VUES[route.vue]?.titre || 'Page introuvable';
    document.title = `${t} · Espace pro · Distillerie A. Blachère`;
    if (premier.current) {
      premier.current = false;
      return;
    }
    scrollTo({ top: 0 });
    const focus = () => document.getElementById('pro-titre')?.focus({ preventScroll: true });
    requestAnimationFrame(() => requestAnimationFrame(focus));
  }, [route.path]);

  if (publique) return <Acces route={route} site={site} onConnecte={(s) => (panier.ouvrir(s.utilisateur.id), setSession(s))} />;
  if (erreur)
    return (
      <div class="wrap pro-vue">
        <Erreur erreur={erreur} titre="L’espace pro n’a pas pu s’ouvrir." reessayer={chargerSession} />
      </div>
    );
  if (!session)
    return (
      <div class="wrap pro-vue">
        <Chargement texte="Ouverture de votre espace…" />
      </div>
    );

  const vue = VUES[route.vue];
  const V = vue?.C || Introuvable;
  return (
    <div class="pro">
      <BarrePro session={session} route={route} site={site} />
      <div class="pro-vue wrap" id="pro-vue">
        <V key={route.vue} route={route} session={session} site={site} setSession={setSession} />
      </div>
    </div>
  );
}

// ---------- Barre de l'espace pro ----------
function BarrePro({ session, route, site }) {
  const { lignes } = usePanier();
  const u = session.utilisateur;
  const c = session.compte || {};
  const nav = useRef(null);
  const [sortie, setSortie] = useState(false);
  // Onglet actif visible dans la barre défilante (téléphone).
  useEffect(() => {
    const a = nav.current?.querySelector('[aria-current="page"]');
    a?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [route.vue]);
  const deconnexion = async () => {
    setSortie(true);
    try {
      await api('session', 'deconnexion', { method: 'POST', body: { espace: 'pro' } });
      location.assign('/espace-pro?deconnecte=1');
    } catch (e) {
      setSortie(false);
      site?.toast(e?.message || 'La déconnexion a échoué. Réessayez.');
    }
  };
  return (
    <>
      <div class="pro-bar">
        <div class="wrap pro-bar__in">
          <div class="pro-bar__id">
            <p class="pro-bar__k">Espace professionnel</p>
            <p class="pro-bar__nom">{c.enseigne || c.raisonSociale || 'Votre établissement'}</p>
            <p class="pro-bar__qui">
              {[u.prenom, u.nom].filter(Boolean).join(' ')}
              {c.raisonSociale && c.raisonSociale !== c.enseigne ? <span> · {c.raisonSociale}</span> : null}
            </p>
          </div>
          <button type="button" class="btn btn--ghost btn--sm pro-bar__out" onClick={deconnexion} disabled={sortie}>
            <Icone n="logout" />
            <span>{sortie ? 'Déconnexion…' : 'Se déconnecter'}</span>
          </button>
        </div>
      </div>
      <nav class="pro-tabs" aria-label="Espace professionnel">
        <div class="wrap">
          <ul class="pro-tabs__list" ref={nav}>
            {ONGLETS.map((id) => {
              const n = id === 'commande' ? lignes.length : 0;
              return (
                <li key={id}>
                  <a class="pro-tab" href={`/espace-pro/${id}`} aria-current={route.vue === id ? 'page' : undefined}>
                    {VUES[id].onglet || VUES[id].titre}
                    {n > 0 && (
                      <span class="pro-tab__n">
                        {n}
                        <span class="sr-only"> {n > 1 ? 'lignes' : 'ligne'}</span>
                      </span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </>
  );
}

export { navigate };
