// Fenêtres de dialogue (feuilles sur téléphone), panneau latéral, confirmations, menus déroulants
// et notifications (« toasts »). Focus piégé dans les fenêtres, Échap pour fermer, retour du
// focus sur l'élément d'origine.
import { createPortal } from 'preact/compat';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './icons.jsx';
import { Button, cx } from './base.jsx';
import { Field } from './form.jsx';
import { Link } from '../lib/router.jsx';

const FOCUSABLES = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const CHAMPS = 'input:not([disabled]):not([type=hidden]):not([type=checkbox]):not([type=radio]), select:not([disabled]), textarea:not([disabled])';

// Pile des fenêtres ouvertes : Échap ne ferme que celle du dessus ; le défilement de la page est
// bloqué tant qu'il en reste une.
const pile = [];
function verrouiller() {
  document.documentElement.style.overflow = pile.length ? 'hidden' : '';
}

function useCouche(ouvert, ref, onClose, { fermable = true, focusInitial } = {}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!ouvert) return undefined;
    const precedent = document.activeElement;
    const jeton = {};
    pile.push(jeton);
    verrouiller();
    const raf = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const cible = (focusInitial && el.querySelector(focusInitial)) || el.querySelector('[data-autofocus]') || (window.matchMedia('(pointer: fine)').matches && el.querySelector(CHAMPS)) || el;
      cible.focus({ preventScroll: true });
    });
    const onKey = (e) => {
      if (pile[pile.length - 1] !== jeton) return;
      if (e.key === 'Escape' && fermable) {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current?.();
      } else if (e.key === 'Tab') {
        const el = ref.current;
        if (!el) return;
        const f = [...el.querySelectorAll(FOCUSABLES)].filter((x) => x.offsetParent !== null || x === document.activeElement);
        if (!f.length) {
          e.preventDefault();
          return;
        }
        const premier = f[0];
        const dernier = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === premier || document.activeElement === el)) {
          e.preventDefault();
          dernier.focus();
        } else if (!e.shiftKey && document.activeElement === dernier) {
          e.preventDefault();
          premier.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey, true);
      const i = pile.indexOf(jeton);
      if (i >= 0) pile.splice(i, 1);
      verrouiller();
      if (precedent && document.contains(precedent)) precedent.focus?.({ preventScroll: true });
    };
  }, [ouvert]);
}

export function Portal({ children }) {
  return createPortal(children, document.body);
}

/**
 * Fenêtre de dialogue modale (feuille glissée du bas sur téléphone).
 */
export function Dialog({ open = true, onClose, titre, sous, icone, iconeTon, taille, children, pied, fermable = true, focusInitial, role = 'dialog', class: cls, onSubmit }) {
  const ref = useRef(null);
  const id = useRef(`dlg-${Math.random().toString(36).slice(2, 8)}`).current;
  useCouche(open, ref, onClose, { fermable, focusInitial });
  if (!open) return null;
  const Corps = onSubmit ? 'form' : 'div';
  return (
    <Portal>
      <div
        class="dlg-back"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && fermable) onClose?.();
        }}
      >
        <Corps
          class={cx('dlg', taille && `dlg--${taille}`, cls)}
          role={role}
          aria-modal="true"
          aria-labelledby={`${id}-t`}
          aria-describedby={sous ? `${id}-s` : undefined}
          tabIndex={-1}
          ref={ref}
          onSubmit={
            onSubmit
              ? (e) => {
                  e.preventDefault();
                  onSubmit(e);
                }
              : undefined
          }
          noValidate={onSubmit ? true : undefined}
        >
          <span class="dlg__handle" aria-hidden="true" />
          <div class="dlg__head">
            {icone && (
              <span class={cx('dlg__ico', iconeTon && `dlg__ico--${iconeTon}`)}>
                <Icon name={icone} />
              </span>
            )}
            <div class="dlg__titles">
              <h2 class="dlg__title" id={`${id}-t`}>
                {titre}
              </h2>
              {sous && (
                <p class="dlg__sub" id={`${id}-s`}>
                  {sous}
                </p>
              )}
            </div>
            {fermable && <Button variant="ghost" icon="x" class="dlg__close" aria-label="Fermer" onClick={onClose} />}
          </div>
          <div class="dlg__body">{children}</div>
          {pied && <div class="dlg__foot">{pied}</div>}
        </Corps>
      </div>
    </Portal>
  );
}

// Panneau latéral (feuille sur téléphone)
export function Drawer({ open = true, onClose, titre, sous, children, pied, entete }) {
  const ref = useRef(null);
  const id = useRef(`tir-${Math.random().toString(36).slice(2, 8)}`).current;
  useCouche(open, ref, onClose, {});
  if (!open) return null;
  return (
    <Portal>
      <div class="drawer-back" onMouseDown={() => onClose?.()} />
      <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} tabIndex={-1} ref={ref}>
        <div class="drawer__head">
          <div class="grow" style="display:grid;gap:4px;min-width:0">
            <h2 class="dlg__title" id={`${id}-t`}>
              {titre}
            </h2>
            {sous && <div class="dlg__sub">{sous}</div>}
            {entete}
          </div>
          <Button variant="ghost" icon="x" aria-label="Fermer" onClick={onClose} style="margin:-6px -8px 0 0" />
        </div>
        <div class="drawer__body">{children}</div>
        {pied && <div class="drawer__foot">{pied}</div>}
      </aside>
    </Portal>
  );
}

// ---------- Confirmations ----------
let hoteConfirmation = null;

/**
 * Demande de confirmation. Avec `action`, le bouton reste en attente pendant l'appel et l'erreur
 * s'affiche dans la fenêtre ; avec `saisie`, il faut taper le texte demandé (suppression).
 * @returns {Promise<any>} résultat de l'action (ou true), false si annulé
 */
export function confirmer(options) {
  return new Promise((resolve) => {
    if (!hoteConfirmation) {
      resolve(window.confirm(options.message || options.titre) || false);
      return;
    }
    hoteConfirmation({ ...options, resolve });
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState(null);
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  useEffect(() => {
    hoteConfirmation = (r) => {
      setSaisie('');
      setErreur(null);
      setEnCours(false);
      setReq(r);
    };
    return () => {
      hoteConfirmation = null;
    };
  }, []);
  if (!req) return null;
  const fermer = (v) => {
    req.resolve(v);
    setReq(null);
  };
  const bloque = req.saisie && saisie.trim().toLowerCase() !== String(req.saisie).toLowerCase();
  const valider = async () => {
    if (bloque) return;
    if (!req.action) return fermer(true);
    setEnCours(true);
    setErreur(null);
    try {
      const r = await req.action();
      fermer(r === undefined ? true : r);
    } catch (e) {
      setErreur(e);
      setEnCours(false);
    }
  };
  return (
    <Dialog
      onClose={() => !enCours && fermer(false)}
      titre={req.titre}
      icone={req.icone || (req.danger ? 'alerte' : 'info')}
      iconeTon={req.danger ? 'danger' : req.iconeTon}
      taille="s"
      role="alertdialog"
      focusInitial={req.saisie ? 'input' : '[data-confirmer]'}
      onSubmit={valider}
      pied={
        <>
          <Button onClick={() => fermer(false)} disabled={enCours}>
            {req.annuler || 'Annuler'}
          </Button>
          <Button type="submit" variant={req.danger ? 'danger' : 'primary'} busy={enCours} disabled={bloque} data-confirmer="">
            {req.confirmer || 'Confirmer'}
          </Button>
        </>
      }
    >
      <div class="stack stack--s">
        {req.message && <p class="lead" style="font-size:14px">{req.message}</p>}
        {req.contenu}
        {req.saisie && (
          <Field label={<>Pour confirmer, tapez « {req.saisie} »</>}>
            <input class="input" value={saisie} onInput={(e) => setSaisie(e.currentTarget.value)} autoComplete="off" spellcheck={false} />
          </Field>
        )}
        {erreur && (
          <p class="field__err" role="alert">
            <Icon name="alerte" />
            {erreur.message}
          </p>
        )}
      </div>
    </Dialog>
  );
}

// ---------- Menus déroulants ----------
/**
 * Menu déroulant accessible (role menu, flèches, Échap), positionné en fixe pour ne jamais être
 * coupé par un tableau qui défile.
 * @param {{ bouton: (props) => any, children: (fermer) => any, align?: 'droite'|'gauche', haut?: boolean, largeur?: number }} p
 */
export function Menu({ bouton, children, align = 'droite', haut = false, largeur, label }) {
  const [ouvert, setOuvert] = useState(false);
  const [pos, setPos] = useState(null);
  const btn = useRef(null);
  const menu = useRef(null);
  const fermer = useCallback((rendreFocus = true) => {
    setOuvert(false);
    if (rendreFocus) btn.current?.focus({ preventScroll: true });
  }, []);
  const ouvrir = () => {
    const r = btn.current.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const p = {};
    if (haut) p.bottom = window.innerHeight - r.top + 6;
    else p.top = r.bottom + 6;
    if (align === 'droite') p.right = Math.max(8, vw - r.right);
    else p.left = Math.max(8, Math.min(r.left, vw - (largeur || 240) - 8));
    setPos(p);
    setOuvert(true);
  };
  useLayoutEffect(() => {
    if (!ouvert) return undefined;
    const items = () => [...(menu.current?.querySelectorAll('[role^=menuitem]') || [])];
    requestAnimationFrame(() => items()[0]?.focus({ preventScroll: true }));
    const surClic = (e) => {
      if (menu.current?.contains(e.target) || btn.current?.contains(e.target)) return;
      fermer(false);
    };
    const surTouche = (e) => {
      const l = items();
      const i = l.indexOf(document.activeElement);
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        fermer();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        l[(i + 1) % l.length]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        l[(i - 1 + l.length) % l.length]?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        l[0]?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        l[l.length - 1]?.focus();
      } else if (e.key === 'Tab') {
        fermer(false);
      }
    };
    const surDefil = (e) => {
      if (menu.current?.contains(e.target)) return;
      fermer(false);
    };
    document.addEventListener('pointerdown', surClic, true);
    document.addEventListener('keydown', surTouche, true);
    window.addEventListener('resize', surDefil);
    document.addEventListener('scroll', surDefil, true);
    return () => {
      document.removeEventListener('pointerdown', surClic, true);
      document.removeEventListener('keydown', surTouche, true);
      window.removeEventListener('resize', surDefil);
      document.removeEventListener('scroll', surDefil, true);
    };
  }, [ouvert]);
  return (
    <>
      {bouton({
        ref: btn,
        'aria-haspopup': 'menu',
        'aria-expanded': ouvert ? 'true' : 'false',
        'aria-label': label,
        onClick: () => (ouvert ? fermer(false) : ouvrir()),
      })}
      {ouvert && pos && (
        <Portal>
          <div class="menu" role="menu" aria-label={label} ref={menu} style={{ position: 'fixed', ...pos, width: largeur ? `${largeur}px` : undefined }}>
            {children(fermer)}
          </div>
        </Portal>
      )}
    </>
  );
}

export function MenuItem({ icone, children, onSelect, href, target, danger, checked, fermer, desc, avatar }) {
  const cls = cx('menu__item', danger && 'menu__item--danger', desc && 'menu__item--two');
  const contenu = (
    <>
      {avatar || (icone && <Icon name={icone} />)}
      <span class="grow">
        {children}
        {desc && <small>{desc}</small>}
      </span>
      {checked !== undefined && <Icon name="check" class="menu__check" />}
    </>
  );
  const role = checked !== undefined ? 'menuitemradio' : 'menuitem';
  if (href) {
    const props = { class: cls, role, href, target, tabIndex: -1, onClick: () => fermer?.(false) };
    if (target === '_blank' || !href.startsWith('/crm')) return <a {...props} rel={target === '_blank' ? 'noopener' : undefined}>{contenu}</a>;
    return <Link {...props}>{contenu}</Link>;
  }
  return (
    <button
      type="button"
      class={cls}
      role={role}
      aria-checked={checked !== undefined ? (checked ? 'true' : 'false') : undefined}
      tabIndex={-1}
      onClick={() => {
        fermer?.(false);
        onSelect?.();
      }}
    >
      {contenu}
    </button>
  );
}
export const MenuSep = () => <div class="menu__sep" role="separator" />;
export const MenuLabel = ({ children }) => (
  <div class="menu__label" role="presentation">
    {children}
  </div>
);

// ---------- Notifications ----------
let hoteToast = null;
let seq = 0;
/**
 * toast('Commande expédiée', { ton: 'ok', detail, action: { label, href | onClick }, duree })
 */
export function toast(message, options = {}) {
  hoteToast?.({ id: ++seq, message, ton: 'ok', duree: 5200, ...options });
}
toast.erreur = (e, message) => toast(message || e?.message || 'Une erreur est survenue.', { ton: 'err', detail: message ? e?.message : undefined, duree: 8000 });
toast.info = (message, options = {}) => toast(message, { ton: 'info', ...options });

export function Toaster() {
  const [liste, setListe] = useState([]);
  useEffect(() => {
    hoteToast = (t) => setListe((l) => [...l.slice(-3), t]);
    return () => {
      hoteToast = null;
    };
  }, []);
  const retirer = (id) => setListe((l) => l.filter((t) => t.id !== id));
  return (
    <>
      <div class="toasts" role="status" aria-live="polite" aria-atomic="false">
        {liste
          .filter((t) => t.ton !== 'err')
          .map((t) => (
            <ToastItem key={t.id} t={t} retirer={retirer} />
          ))}
      </div>
      <div class="toasts" role="alert" aria-live="assertive" style="bottom:auto;top:20px">
        {liste
          .filter((t) => t.ton === 'err')
          .map((t) => (
            <ToastItem key={t.id} t={t} retirer={retirer} />
          ))}
      </div>
    </>
  );
}

function ToastItem({ t, retirer }) {
  const [sortie, setSortie] = useState(false);
  const survol = useRef(false);
  useEffect(() => {
    let reste = t.duree;
    let debut = Date.now();
    let minuteur = null;
    const lancer = () => {
      debut = Date.now();
      minuteur = setTimeout(() => {
        if (survol.current) return;
        setSortie(true);
        setTimeout(() => retirer(t.id), 200);
      }, reste);
    };
    lancer();
    t._pause = () => {
      clearTimeout(minuteur);
      reste -= Date.now() - debut;
    };
    t._reprise = () => lancer();
    return () => clearTimeout(minuteur);
  }, []);
  const icone = { ok: 'ok', err: 'erreur', info: 'info' }[t.ton] || 'info';
  return (
    <div
      class={cx('toast', `toast--${t.ton}`)}
      data-sortie={sortie ? '' : undefined}
      onMouseEnter={() => {
        survol.current = true;
        t._pause?.();
      }}
      onMouseLeave={() => {
        survol.current = false;
        t._reprise?.();
      }}
    >
      <Icon name={icone} />
      <div class="toast__msg">
        {t.message}
        {t.detail && <small>{t.detail}</small>}
      </div>
      {t.action &&
        (t.action.href ? (
          <Link class="toast__act" href={t.action.href} onClick={() => retirer(t.id)}>
            {t.action.label}
          </Link>
        ) : (
          <button
            type="button"
            class="toast__act"
            onClick={() => {
              t.action.onClick?.();
              retirer(t.id);
            }}
          >
            {t.action.label}
          </button>
        ))}
      <button type="button" class="toast__x" aria-label="Fermer la notification" onClick={() => retirer(t.id)}>
        <Icon name="x" size="s" />
      </button>
    </div>
  );
}
