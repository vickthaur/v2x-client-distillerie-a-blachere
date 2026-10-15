// Application du CRM : session (connexion, démo, droits), routes, coque.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { SessionCtx, useNotifications } from './lib/session.jsx';
import { correspond, navigate, useLocation } from './lib/router.jsx';
import { quandSessionExpire, session as sessionApi, viderCache, toutRecharger } from './lib/data.js';
import { creerPeut, lireDroits, ROLES } from './lib/droits.js';
import { ConfirmHost, Toaster, confirmer, toast } from './ui/overlay.jsx';
import { Sidebar, Topbar, TabBar, Palette, Plus } from './shell.jsx';
import { nomComplet } from './lib/format.js';
import { Empty } from './ui/base.jsx';

import { Connexion, MotDePasse, Activer } from './screens/connexion.jsx';
import { Tableau } from './screens/tableau.jsx';
import { Commandes } from './screens/commandes.jsx';
import { Commande } from './screens/commande.jsx';
import { NouvelleCommande } from './screens/nouvelle-commande.jsx';
import { Clients, Client } from './screens/clients.jsx';
import { Comptes, Compte } from './screens/comptes.jsx';
import { Demandes } from './screens/demandes.jsx';
import { Produits } from './screens/produits.jsx';
import { Visites } from './screens/visites.jsx';
import { Messages } from './screens/messages.jsx';
import { Newsletter, Campagne } from './screens/newsletter.jsx';
import { Promos } from './screens/promos.jsx';
import { Courriels } from './screens/courriels.jsx';
import { Equipe } from './screens/equipe.jsx';
import { Journal } from './screens/journal.jsx';
import { Parametres } from './screens/parametres.jsx';
import { Impression } from './print/impression.jsx';

const ROUTES = [
  ['/crm', Tableau],
  ['/crm/tableau', Tableau],
  ['/crm/commandes', Commandes],
  ['/crm/commandes/nouvelle', NouvelleCommande],
  ['/crm/commandes/:id', Commande],
  ['/crm/clients', Clients],
  ['/crm/clients/:id', Client],
  ['/crm/comptes', Comptes],
  ['/crm/comptes/:id', Compte],
  ['/crm/demandes', Demandes],
  ['/crm/demandes/:id', Demandes],
  ['/crm/produits', Produits],
  ['/crm/produits/:slug', Produits],
  ['/crm/visites', Visites],
  ['/crm/visites/:id', Visites],
  ['/crm/messages', Messages],
  ['/crm/messages/:id', Messages],
  ['/crm/newsletter', Newsletter],
  ['/crm/newsletter/campagnes/:id', Campagne],
  ['/crm/promos', Promos],
  ['/crm/courriels', Courriels],
  ['/crm/courriels/:id', Courriels],
  ['/crm/equipe', Equipe],
  ['/crm/journal', Journal],
  ['/crm/parametres', Parametres],
  ['/crm/plus', Plus],
];

// Écrans à deux volets (liste + détail) : la même instance reste en place quand on change
// d'élément ; les autres écrans repartent de zéro à chaque adresse.
const DEUX_VOLETS = new Set([Demandes, Produits, Visites, Messages, Courriels]);
const cleEcran = (route, path) => (route && DEUX_VOLETS.has(route.Ecran) ? route.motif.split('/:')[0] : path);

function trouver(path) {
  for (const [motif, Ecran] of ROUTES) {
    const p = correspond(motif, path);
    if (p) return { Ecran, params: p, motif };
  }
  return null;
}

function Introuvable() {
  return (
    <div class="page">
      <Empty icone="recherche" titre="Page introuvable" texte="Cette adresse ne correspond à aucun écran du CRM." action={<a class="btn btn--primary" href="/crm">Retour au tableau de bord</a>} />
    </div>
  );
}

export function App() {
  const loc = useLocation();
  const [etat, setEtat] = useState({ statut: 'chargement', moi: null, demo: null });
  const [message, setMessage] = useState(null);
  const [palette, setPalette] = useState(false);

  const chargerMoi = async () => {
    try {
      const d = await sessionApi('moi', { query: { espace: 'crm' } });
      const u = d?.utilisateur;
      setEtat({ statut: u ? 'connecte' : 'anonyme', moi: u || null, demo: d?.demo || null });
      return u;
    } catch (e) {
      setEtat((s) => ({ ...s, statut: 'anonyme', moi: null }));
      if (e.status !== 401) setMessage({ ton: 'err', texte: e.message });
      return null;
    }
  };

  useEffect(() => {
    chargerMoi();
    quandSessionExpire(() => {
      viderCache();
      setEtat((s) => (s.statut === 'connecte' ? { ...s, statut: 'anonyme', moi: null } : s));
      setMessage({ ton: 'warn', texte: 'Votre session a expiré : reconnectez-vous pour continuer.' });
    });
  }, []);

  // ⌘K / Ctrl+K : recherche
  useEffect(() => {
    if (etat.statut !== 'connecte') return undefined;
    const f = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [etat.statut]);

  // Défilement en haut à chaque nouvel écran
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.path]);

  const notifs = useNotifications(etat.statut === 'connecte' && !loc.path.startsWith('/crm/imprimer'));

  const valeur = useMemo(() => {
    const droits = lireDroits(etat.moi);
    const peut = creerPeut(droits);
    return {
      moi: etat.moi,
      demo: etat.demo,
      droits,
      peut,
      notifs: notifs.data,
      recharger: chargerMoi,
      async connecte() {
        setMessage(null);
        viderCache();
        await chargerMoi();
        if (location.pathname === '/crm/connexion') navigate('/crm', { replace: true });
      },
      async deconnecter() {
        try {
          await sessionApi('deconnexion', { method: 'POST', body: { espace: 'crm' } });
        } catch {
          /* la session est peut-être déjà close */
        }
        viderCache();
        setEtat((s) => ({ ...s, statut: 'anonyme', moi: null }));
        setMessage({ ton: 'ok', texte: 'Vous êtes déconnecté.' });
        navigate('/crm', { replace: true });
      },
      async changerProfil(profil) {
        try {
          await sessionApi('demo', { method: 'POST', body: { profil } });
          viderCache();
          const u = await chargerMoi();
          navigate('/crm');
          if (u) toast(`Vous êtes ${nomComplet(u)}`, { detail: `Profil ${ROLES[u.role]?.nom.toLowerCase() || u.role} : ${ROLES[u.role]?.desc || ''}`, ton: 'info' });
        } catch (e) {
          toast.erreur(e);
        }
      },
      async ouvrirEspacePro() {
        const w = window.open('about:blank', '_blank');
        try {
          const d = await sessionApi('demo', { method: 'POST', body: { profil: 'pro' } });
          const cible = d?.redirection || '/espace-pro/accueil';
          if (w) {
            w.opener = null;
            w.location.href = cible;
          } else {
            window.open(cible, '_blank', 'noopener');
          }
        } catch (e) {
          w?.close();
          toast.erreur(e, 'L’espace pro de démonstration n’a pas pu s’ouvrir.');
        }
      },
      async reinitialiserDemo() {
        const ok = await confirmer({
          titre: 'Réinitialiser la démo ?',
          message: 'Commandes, clients, stocks, messages… tout revient au jeu de démonstration de départ. Vous restez connecté.',
          confirmer: 'Réinitialiser',
          icone: 'recharger',
          danger: true,
          action: () => sessionApi('reinitialiser', { method: 'POST', body: {} }),
        });
        if (!ok) return;
        viderCache();
        await chargerMoi();
        toutRecharger();
        toast('Démo réinitialisée', { detail: 'Les données de départ sont de retour.' });
      },
      async quitterDemo() {
        const ok = await confirmer({
          titre: 'Quitter la démo ?',
          message: 'Ce navigateur quitte la démonstration : vous êtes déconnecté du CRM et de l’espace pro. Vous pourrez en ouvrir une nouvelle à tout moment.',
          confirmer: 'Quitter la démo',
          icone: 'sortie',
          danger: true,
          action: () => sessionApi('quitter', { method: 'POST', body: {} }),
        });
        if (!ok) return;
        viderCache();
        setEtat({ statut: 'anonyme', moi: null, demo: null });
        setMessage({ ton: 'ok', texte: 'Vous avez quitté la démo.' });
        navigate('/crm', { replace: true });
      },
    };
  }, [etat, notifs.data]);

  // Écrans publics (lien reçu par courriel)
  if (loc.path === '/crm/mot-de-passe') return <Public><MotDePasse onConnecte={valeur.connecte} /></Public>;
  if (loc.path === '/crm/activer') return <Public><Activer onConnecte={valeur.connecte} /></Public>;

  if (etat.statut === 'chargement') {
    return (
      <div class="loading-screen" role="status" aria-label="Chargement du CRM">
        <img src="/logos/logo-blanc.svg" alt="" style="width:180px" />
      </div>
    );
  }

  if (etat.statut === 'anonyme') {
    return (
      <Public>
        <SessionCtx.Provider value={valeur}>
          <Connexion message={message} demo={etat.demo} onConnecte={valeur.connecte} />
        </SessionCtx.Provider>
      </Public>
    );
  }

  // Documents à imprimer (nouvel onglet, sans la coque)
  if (loc.path.startsWith('/crm/imprimer/')) {
    return (
      <SessionCtx.Provider value={valeur}>
        <Impression path={loc.path} />
        <Toaster />
      </SessionCtx.Provider>
    );
  }

  if (loc.path === '/crm/connexion') {
    navigate('/crm', { replace: true });
    return null;
  }

  const route = trouver(loc.path);
  const Ecran = route?.Ecran || Introuvable;

  return (
    <SessionCtx.Provider value={valeur}>
      <a class="skip" href="#contenu">
        Aller au contenu
      </a>
      <div class="app">
        <Sidebar notifs={notifs.data} onRecherche={() => setPalette(true)} />
        <div class="app__main">
          <Topbar notifs={notifs.data} onRecherche={() => setPalette(true)} marquerVu={notifs.marquerVu} />
          <main id="contenu" tabIndex={-1}>
            <Ecran key={cleEcran(route, loc.path)} {...(route?.params || {})} />
          </main>
        </div>
        <TabBar notifs={notifs.data} />
      </div>
      {palette && <Palette onClose={() => setPalette(false)} />}
      <ConfirmHost />
      <Toaster />
    </SessionCtx.Provider>
  );
}

function Public({ children }) {
  return (
    <>
      {children}
      <ConfirmHost />
      <Toaster />
    </>
  );
}
