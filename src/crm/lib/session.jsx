// Session du personnel : utilisateur connecté, droits, démo, notifications.
import { createContext } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { crm, toutRecharger } from './data.js';

export const SessionCtx = createContext(null);
export const useSession = () => useContext(SessionCtx);
export const usePeut = () => useContext(SessionCtx).peut;

// Fil d'Ariane de la barre du haut : la page courante peut préciser son dernier maillon
const abonnesFil = new Set();
let fil = null;
export function useFil(libelle) {
  useEffect(() => {
    fil = libelle || null;
    for (const f of abonnesFil) f(fil);
    return () => {
      fil = null;
      for (const f of abonnesFil) f(null);
    };
  }, [libelle]);
}
export function useFilCourant() {
  const [v, set] = useState(fil);
  useEffect(() => {
    abonnesFil.add(set);
    return () => abonnesFil.delete(set);
  }, []);
  return v;
}

// Sondage des notifications : toutes les 30 s quand l'onglet est visible et que la personne a
// agi dans les 5 dernières minutes ; un changement de version recharge les écrans affichés.
const PERIODE = 30000;
const INACTIF = 5 * 60000;
export function useNotifications(actif) {
  const [data, setData] = useState(null);
  const version = useRef(null);
  const derniereActivite = useRef(Date.now());
  const enCours = useRef(false);

  const charger = async () => {
    if (enCours.current) return;
    enCours.current = true;
    try {
      const d = await crm('notifications');
      if (!d) return;
      setData(d);
      if (version.current && d.version && d.version !== version.current) toutRecharger();
      version.current = d.version || version.current;
    } catch {
      /* silencieux : la session expirée est gérée par crm() */
    } finally {
      enCours.current = false;
    }
  };

  useEffect(() => {
    if (!actif) return undefined;
    const marquer = () => {
      const avant = derniereActivite.current;
      derniereActivite.current = Date.now();
      // retour après une longue absence : rafraîchir tout de suite
      if (Date.now() - avant > INACTIF && document.visibilityState === 'visible') charger();
    };
    const evts = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
    evts.forEach((e) => window.addEventListener(e, marquer, { passive: true, capture: true }));
    const surVisibilite = () => {
      if (document.visibilityState === 'visible') {
        derniereActivite.current = Date.now();
        charger();
      }
    };
    document.addEventListener('visibilitychange', surVisibilite);
    charger();
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - derniereActivite.current > INACTIF) return;
      charger();
    }, PERIODE);
    return () => {
      clearInterval(t);
      evts.forEach((e) => window.removeEventListener(e, marquer, { capture: true }));
      document.removeEventListener('visibilitychange', surVisibilite);
    };
  }, [actif]);

  const marquerVu = async () => {
    setData((d) => (d ? { ...d, commandes: 0, demandes: 0, messages: 0, stocksBas: d.stocksBas, vu: true } : d));
    try {
      await crm('notifications-vues', { method: 'POST', body: {} });
    } finally {
      charger();
    }
  };
  return { data, recharger: charger, marquerVu };
}
