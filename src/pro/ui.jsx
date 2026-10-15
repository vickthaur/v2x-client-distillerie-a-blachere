// Composants communs de l'espace pro : titres de vue, états (chargement, erreur, vide), pastilles de
// statut, jauges, quantités par carton, packshots, noms de produits avec les logotypes PAC et
// Fun Blue, fenêtre de confirmation.
import { Fragment } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { photoIndex } from '../lib/photos.js';
import { EVIN } from '../data/products.js';
import { eur, nombre, NB } from './format.js';

// ---------- Icônes (trait 1,8, comme le site) ----------
const P = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6h11v10H3z" />
      <path d="M14 9h4l3 3v4h-7" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </>
  ),
  doc: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M10 13h6M10 17h6" />
    </>
  ),
  print: (
    <>
      <path d="M7 9V3h10v6" />
      <rect x="3" y="9" width="18" height="8" rx="2" />
      <path d="M7 14h10v7H7z" />
    </>
  ),
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  logout: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  pin: (
    <>
      <path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  repeat: (
    <>
      <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" />
      <path d="M18 3v4h-4M6 21v-4h4" />
    </>
  ),
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  alert: (
    <>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5M12 18v.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.01" />
    </>
  ),
  send: <path d="M4 12l16-8-6 16-2.5-6.5z" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  box: (
    <>
      <path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z" />
      <path d="M3 7.5l9 4.5 9-4.5M12 12v9" />
    </>
  ),
  euro: <path d="M17 6.5A6.5 6.5 0 0 0 7 12a6.5 6.5 0 0 0 10 5.5M4 10.5h9M4 13.5h9" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  home: <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />,
};
export function Icone({ n, class: cls = '' }) {
  return (
    <svg class={`pro-ico ${cls}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      {P[n]}
    </svg>
  );
}

// ---------- Titre de vue (cible du focus à chaque changement de vue) ----------
export function TitreVue({ kicker, titre, accent, children, actions }) {
  return (
    <header class="pro-head">
      <div class="pro-head__txt">
        {kicker && <p class="kicker">{kicker}</p>}
        <h1 class="pro-h1" id="pro-titre" tabindex="-1">
          {titre}
          {accent && (
            <>
              {' '}
              <span class="accent">{accent}</span>
            </>
          )}
        </h1>
        {children}
      </div>
      {actions && <div class="pro-head__actions">{actions}</div>}
    </header>
  );
}

// ---------- États ----------
export function Chargement({ texte = 'Chargement…', lignes = 3 }) {
  return (
    <div class="pro-loading" role="status" aria-live="polite">
      <span class="sr-only">{texte}</span>
      {Array.from({ length: lignes }, (_, i) => (
        <span class="pro-skel" key={i} style={{ width: `${[92, 76, 84, 60][i % 4]}%` }} aria-hidden="true" />
      ))}
    </div>
  );
}

export function Erreur({ erreur, reessayer, titre = 'Ces informations n’ont pas pu être chargées.' }) {
  return (
    <div class="pro-state pro-state--err" role="alert">
      <span class="pro-state__icon">
        <Icone n="alert" />
      </span>
      <div>
        <p class="pro-state__t">{titre}</p>
        <p class="pro-state__d">{erreur?.message || 'Vérifiez votre connexion et réessayez.'}</p>
      </div>
      {reessayer && (
        <button type="button" class="btn btn--ghost btn--sm" onClick={reessayer}>
          Réessayer
        </button>
      )}
    </div>
  );
}

export function Vide({ titre, children, action, icone = 'box' }) {
  return (
    <div class="pro-state pro-state--vide">
      <span class="pro-state__icon">
        <Icone n={icone} />
      </span>
      <div>
        <p class="pro-state__t">{titre}</p>
        {children && <div class="pro-state__d">{children}</div>}
      </div>
      {action}
    </div>
  );
}

// Message dans une vue (succès, alerte, erreur, information).
export function Note({ ton = 'info', titre, children, role }) {
  const icone = { ok: 'check', warn: 'alert', err: 'alert', info: 'info' }[ton] || 'info';
  return (
    <div class={`pro-note pro-note--${ton}`} role={role}>
      <Icone n={icone} />
      <div>
        {titre && <p class="pro-note__t">{titre}</p>}
        {children && <div class="pro-note__d">{children}</div>}
      </div>
    </div>
  );
}

// ---------- Pastilles ----------
export function Pastille({ ton = 'muet', children, petit }) {
  return <span class={`pro-pill pro-pill--${ton}${petit ? ' pro-pill--sm' : ''}`}>{children}</span>;
}

// ---------- Jauge (franco, encours) ----------
export function Jauge({ valeur, max, ton = 'ink', libelle, texte }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (valeur / max) * 100)) : 0;
  return (
    <div
      class={`pro-gauge pro-gauge--${ton}`}
      role="progressbar"
      aria-label={libelle}
      aria-valuemin="0"
      aria-valuemax={Math.round(max * 100) / 100}
      aria-valuenow={Math.round(Math.min(valeur, max) * 100) / 100}
      aria-valuetext={texte}
    >
      <span class="pro-gauge__bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------- Montant ----------
export const Montant = ({ v, class: cls = '' }) => <span class={`pro-num ${cls}`}>{eur(v)}</span>;

// ---------- Quantité par carton ----------
// La quantité est comptée en bouteilles (ou coffrets) ; le pas est le colisage. L'affichage dit les
// deux : « 2 cartons · 12 bouteilles ».
export function Pas({ qte, colisage = 1, onChange, nom, max = 9999, compact = false }) {
  const pas = Math.max(1, colisage || 1);
  const n = Math.round(qte / pas);
  const unite = pas > 1 ? (n > 1 ? 'cartons' : 'carton') : n > 1 ? 'unités' : 'unité';
  const [txt, setTxt] = useState(String(n));
  useEffect(() => setTxt(String(n)), [n]);
  const commit = (v) => {
    const k = Math.max(0, Math.min(Math.floor(max / pas), Math.round(Number(String(v).replace(',', '.')) || 0)));
    setTxt(String(k));
    if (k * pas !== qte) onChange(k * pas);
  };
  return (
    <div class={`pro-step${compact ? ' pro-step--compact' : ''}`}>
      <div class="pro-step__ctl" role="group" aria-label={`Quantité de ${nom}, en ${pas > 1 ? `cartons de ${pas}` : 'unités'}`}>
        <button type="button" onClick={() => commit(n - 1)} aria-label={pas > 1 ? `Un carton de moins` : `Une unité de moins`} disabled={n <= 0}>
          <Icone n="minus" />
        </button>
        <input
          type="text"
          inputmode="numeric"
          value={txt}
          aria-label={pas > 1 ? 'Nombre de cartons' : 'Nombre d’unités'}
          onInput={(e) => setTxt(e.currentTarget.value.replace(/[^\d]/g, ''))}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(e.currentTarget.value);
            }
          }}
        />
        <button type="button" onClick={() => commit(n + 1)} aria-label={pas > 1 ? `Un carton de plus` : `Une unité de plus`}>
          <Icone n="plus" />
        </button>
      </div>
      {!compact && (
        <span class="pro-step__u">
          {unite}
          {pas > 1 && n > 0 ? ` · ${nombre(n * pas)}${NB}bt` : ''}
        </span>
      )}
    </div>
  );
}

// ---------- Packshot (photo détourée de la bouteille, src/lib/photos.js) ----------
let photos = null;
const photosPret = photoIndex().then((p) => (photos = p));
export function Packshot({ slug, photo, alt = '', taille = 'm' }) {
  const [src, setSrc] = useState(photo || photos?.[slug]?.vignette || null);
  useEffect(() => {
    if (photo) return setSrc(photo);
    if (photos) return setSrc(photos[slug]?.vignette || null);
    let on = true;
    photosPret.then((p) => on && setSrc(p[slug]?.vignette || null));
    return () => {
      on = false;
    };
  }, [slug, photo]);
  return <span class={`pro-shot pro-shot--${taille}`}>{src ? <img src={src} alt={alt} loading="lazy" decoding="async" /> : <span class="pro-shot__ph" aria-hidden="true" />}</span>;
}

// ---------- Marques PAC et Fun Blue (même règle que src/lib/marques.js) ----------
// Dans un nom de produit ou un titre : le logotype (nom gardé pour les lecteurs d'écran) ; dans le
// texte courant : la police et la couleur de la marque. L'application porte data-no-marque : c'est
// ce composant, et non le parcours du DOM de marques.js, qui écrit les marques (Preact garde ainsi
// la main sur ses nœuds).
const SOURCE = '(?<![\\p{L}\\p{N}./@_-])(?:PAC|Pac|pac|Fun[\\s\\u00a0]+Blue|FUN[\\s\\u00a0]+BLUE|Fun[\\s\\u00a0]+blue|FUN[\\s\\u00a0]+Blue)(?![\\p{L}\\p{N}]|\\.[\\p{L}]|\\/)';
// imprimable : le logotype en image (les fonds CSS ne s'impriment pas par défaut).
const LOGOS = { pac: '/marques/pac-clair.svg', fb: '/marques/fun-blue.svg' };
export function Marques({ texte, logo = false, imprimable = false }) {
  const s = String(texte ?? '');
  const out = [];
  let last = 0;
  for (const m of s.matchAll(new RegExp(SOURCE, 'gu'))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const b = /^p/i.test(m[0]) ? 'pac' : 'fb';
    out.push(
      logo && imprimable ? (
        <img class={`wm-img wm-img--${b}`} src={LOGOS[b]} alt={b === 'fb' ? 'Fun Blue' : 'PAC'} key={m.index} />
      ) : logo ? (
        <span class={`wm wm--${b}`} key={m.index}>
          <span class="sr-only">{m[0]}</span>
        </span>
      ) : (
        <span class={`marque marque--${b}`} key={m.index}>
          {b === 'fb' ? 'Fun Blue' : m[0]}
        </span>
      ),
    );
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out.length ? out : s;
}

// Nom de produit : logotypes, « ® » en exposant.
export function NomProduit({ nom, imprimable = false }) {
  const parts = String(nom || '').split('®');
  return parts.map((p, i) => (
    <Fragment key={i}>
      <Marques texte={p} logo imprimable={imprimable} />
      {i < parts.length - 1 && <sup>®</sup>}
    </Fragment>
  ));
}

export const Evin = ({ class: cls = '' }) => <p class={`evin pro-evin ${cls}`}>{EVIN}</p>;

// ---------- Fenêtre de confirmation (dialog natif : focus piégé, Échap) ----------
export function Confirmer({ ouvert, titre, children, confirmer = 'Confirmer', annuler = 'Annuler', danger, onConfirmer, onAnnuler, occupe }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ouvert && !d.open) d.showModal();
    if (!ouvert && d.open) d.close();
  }, [ouvert]);
  return (
    <dialog class="pro-dialog" ref={ref} aria-labelledby="pro-dialog-t" onClose={() => ouvert && onAnnuler?.()} onCancel={(e) => occupe && e.preventDefault()}>
      <div class="pro-dialog__in">
        <p class="pro-dialog__t" id="pro-dialog-t">
          {titre}
        </p>
        <div class="pro-dialog__d">{children}</div>
        <div class="pro-dialog__actions">
          <button type="button" class="btn btn--ghost btn--sm" onClick={onAnnuler} disabled={occupe} autofocus>
            {annuler}
          </button>
          <button type="button" class={`btn btn--sm ${danger ? 'pro-btn--danger' : 'btn--primary'}`} onClick={onConfirmer} disabled={occupe}>
            {occupe ? 'Un instant…' : confirmer}
          </button>
        </div>
      </div>
    </dialog>
  );
}

// Lien d'action en ligne (bouton à l'apparence de lien).
export const LienBouton = ({ children, ...props }) => (
  <button type="button" class="link pro-linkbtn" {...props}>
    {children}
  </button>
);
