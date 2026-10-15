// Composants de base : boutons, pastilles d'état, cartes, en-tête de page, états de chargement,
// vide et erreur, onglets, filtres, pagination.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './icons.jsx';
import { Link, origineNavigation } from '../lib/router.jsx';
import { initiales, nombre, ton as tonDeCle } from '../lib/format.js';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

export function Button({ variant, size, icon, iconEnd, busy, block, href, children, class: cls, type = 'button', ...props }) {
  const c = cx('btn', variant && `btn--${variant}`, size && `btn--${size}`, block && 'btn--block', !children && icon && 'btn--icon', cls);
  const inner = (
    <>
      {icon && <Icon name={icon} />}
      {children}
      {iconEnd && <Icon name={iconEnd} />}
    </>
  );
  if (href) {
    const ext = props.target === '_blank' || !href.startsWith('/crm');
    return ext ? (
      <a class={c} href={href} {...props}>
        {inner}
      </a>
    ) : (
      <Link class={c} href={href} {...props}>
        {inner}
      </Link>
    );
  }
  return (
    <button type={type} class={c} data-busy={busy ? '' : undefined} aria-busy={busy ? 'true' : undefined} {...props}>
      {inner}
    </button>
  );
}

// Pastille d'état : point + libellé (jamais la couleur seule)
export function Pill({ ton = 'mute', children, lg, nodot, class: cls, title }) {
  return (
    <span class={cx('pill', `pill--${ton}`, lg && 'pill--lg', nodot && 'pill--nodot', cls)} title={title}>
      {children}
    </span>
  );
}
// Pastille d'après une table de statuts (lib/statuts.js)
export function Statut({ table, valeur, lg }) {
  const s = table[valeur];
  if (!s) return valeur ? <Pill lg={lg}>{valeur}</Pill> : null;
  return (
    <Pill ton={s.ton} lg={lg}>
      {s.label}
    </Pill>
  );
}

export function Badge({ n, ton, label }) {
  if (!n) return null;
  return (
    <span class={cx('badge', ton && `badge--${ton}`)} aria-label={label}>
      {n > 99 ? '99+' : n}
    </span>
  );
}

export function Avatar({ nom, cle, size, class: cls }) {
  return (
    <span class={cx('avatar', size && `avatar--${size}`, cls)} data-ton={tonDeCle(cle || nom)} aria-hidden="true">
      {initiales(nom)}
    </span>
  );
}

export function Card({ titre, sous, icone, actions, children, foot, class: cls, corps = true, ligne, id, as: As = 'section', ...props }) {
  const hid = id ? `${id}-titre` : undefined;
  return (
    <As class={cx('card', cls)} aria-labelledby={titre && hid ? hid : undefined} id={id} {...props}>
      {(titre || actions) && (
        <div class={cx('card__head', ligne && 'card__head--line')}>
          <div class="grow">
            {titre && (
              <h2 class="card__title" id={hid}>
                {icone && <Icon name={icone} />}
                {titre}
              </h2>
            )}
            {sous && <p class="card__sub">{sous}</p>}
          </div>
          {actions && <div class="row" style="gap:6px">{actions}</div>}
        </div>
      )}
      {corps === true ? <div class="card__body">{children}</div> : children}
      {foot && <div class="card__foot">{foot}</div>}
    </As>
  );
}

// En-tête de page : titre (reçoit le focus après une navigation), sous-titre, actions, retour
export function PageHead({ titre, sous, actions, retour, children, actionsMobiles = true }) {
  const ref = useRef(null);
  useEffect(() => {
    if (origineNavigation() !== 'init') ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <header class="page__head">
      <div class="page__titles">
        {retour && (
          <Link class="page__back" href={retour.href}>
            <Icon name="gauche" />
            {retour.label}
          </Link>
        )}
        <h1 class="page__title" tabIndex={-1} ref={ref}>
          {titre}
        </h1>
        {sous && <div class="page__sub">{sous}</div>}
        {children}
      </div>
      {actions && <div class={cx('page__actions', !actionsMobiles && 'page__actions--desk')}>{actions}</div>}
    </header>
  );
}

export function useTitre(titre) {
  useEffect(() => {
    if (titre) document.title = `${titre} · CRM Blachère`;
  }, [titre]);
}

export function Skeleton({ w, h, class: cls, style }) {
  const base = `${w ? `width:${w};` : ''}${h ? `height:${h};` : ''}`;
  const st = typeof style === 'string' ? base + style : { ...(w ? { width: w } : {}), ...(h ? { height: h } : {}), ...(style || {}) };
  return <span class={cx('skel', cls)} style={st} aria-hidden="true" />;
}
export function SkeletonRows({ n = 6, cols = 4 }) {
  return (
    <div class="skel-rows" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: n }, (_, i) => (
        <div class="skel-row" key={i}>
          <Skeleton w="22%" />
          {Array.from({ length: cols - 1 }, (_, j) => (
            <Skeleton key={j} w={`${[18, 26, 12, 14, 20][j % 5]}%`} />
          ))}
        </div>
      ))}
    </div>
  );
}
export function SkeletonPage() {
  return (
    <div class="stack" aria-busy="true" aria-label="Chargement">
      <Skeleton class="skel--title" />
      <div class="cols cols--3">
        <Skeleton class="skel--block" h="110px" />
        <Skeleton class="skel--block" h="110px" />
        <Skeleton class="skel--block" h="110px" />
      </div>
      <div class="card">
        <SkeletonRows />
      </div>
    </div>
  );
}

export function Empty({ icone = 'boite', titre, texte, action, petit }) {
  return (
    <div class={cx('empty', petit && 'empty--s')}>
      <div class="empty__ico">
        <Icon name={icone} />
      </div>
      <p class="empty__title">{titre}</p>
      {texte && <p class="empty__text">{texte}</p>}
      {action}
    </div>
  );
}

export function Erreur({ erreur, onRetry, titre = 'Chargement impossible' }) {
  if (!erreur) return null;
  const msg = erreur?.message || String(erreur);
  return (
    <div class="error-box" role="alert">
      <Icon name="alerte" />
      <div class="error-box__msg">
        <strong>{titre}</strong>
        {msg}
      </div>
      {onRetry && (
        <Button size="sm" icon="recharger" onClick={() => onRetry()}>
          Réessayer
        </Button>
      )}
    </div>
  );
}

export function Notice({ ton, icone, children, class: cls }) {
  const ic = icone || { warn: 'alerte', ok: 'ok', err: 'erreur', demo: 'etincelle' }[ton] || 'info';
  return (
    <div class={cx('notice', ton && `notice--${ton}`, cls)}>
      <Icon name={ic} />
      <div class="grow">{children}</div>
    </div>
  );
}

export function Spinner({ label = 'Chargement' }) {
  return <span class="spinner" role="status" aria-label={label} />;
}

// Onglets (role tablist) ; navigation aux flèches
export function Tabs({ items, value, onChange, label }) {
  const ref = useRef(null);
  const onKey = (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = items.findIndex((t) => t.id === value);
    let n = i;
    if (e.key === 'ArrowRight') n = (i + 1) % items.length;
    if (e.key === 'ArrowLeft') n = (i - 1 + items.length) % items.length;
    if (e.key === 'Home') n = 0;
    if (e.key === 'End') n = items.length - 1;
    onChange(items[n].id);
    ref.current?.querySelectorAll('[role=tab]')[n]?.focus();
  };
  return (
    <div class="tabs" role="tablist" aria-label={label} ref={ref} onKeyDown={onKey}>
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={`tab-${t.id}`}
          class="tab"
          aria-selected={t.id === value ? 'true' : 'false'}
          aria-controls={`panneau-${t.id}`}
          tabIndex={t.id === value ? 0 : -1}
          onClick={() => onChange(t.id)}
        >
          {t.icone && <Icon name={t.icone} size="s" />}
          {t.label}
          {t.n !== undefined && t.n !== null && <span class="chip__n">{nombre(t.n)}</span>}
        </button>
      ))}
    </div>
  );
}
export function TabPanel({ id, children }) {
  return (
    <div role="tabpanel" id={`panneau-${id}`} aria-labelledby={`tab-${id}`} tabIndex={0} class="tabpanel">
      {children}
    </div>
  );
}

// Filtres en pastilles avec compteurs
export function Chips({ items, value, onChange, label }) {
  return (
    <div class="chips" role="group" aria-label={label}>
      {items.map((c) => (
        <button key={c.id} type="button" class="chip" aria-pressed={c.id === value ? 'true' : 'false'} onClick={() => onChange(c.id)}>
          {c.dot && <span class="chip__dot" style={{ background: c.dot }} aria-hidden="true" />}
          {c.label}
          {c.n !== undefined && c.n !== null && <span class="chip__n">{nombre(c.n)}</span>}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page = 1, pages = 1, total, par, onPage, unite = ['élément', 'éléments'] }) {
  if (!total && pages <= 1) return null;
  const debut = par ? (page - 1) * par + 1 : null;
  const fin = par ? Math.min(total, page * par) : null;
  return (
    <nav class="pager" aria-label="Pagination">
      <span class="tnum">
        {par && total ? `${nombre(debut)}–${nombre(fin)} sur ${nombre(total)}` : `${nombre(total)} ${total > 1 ? unite[1] : unite[0]}`}
      </span>
      {pages > 1 && (
        <div class="pager__btns">
          <Button size="sm" icon="gauche" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Page précédente" />
          <span class="tnum" style="align-self:center;padding:0 6px">
            {page} / {pages}
          </span>
          <Button size="sm" icon="droite" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Page suivante" />
        </div>
      )}
    </nav>
  );
}

// Champ de recherche avec effacement ; la valeur est transmise après une courte pause
export function SearchInput({ value = '', onChange, placeholder = 'Rechercher…', label = 'Rechercher', delai = 260, class: cls, autoFocus }) {
  const [v, setV] = useState(value);
  const t = useRef(null);
  useEffect(() => setV(value), [value]);
  const envoyer = (x) => {
    clearTimeout(t.current);
    t.current = setTimeout(() => onChange(x), delai);
  };
  return (
    <div class={cx('input-group', cls)} role="search">
      <Icon name="recherche" size="s" />
      <input
        class="input"
        type="search"
        value={v}
        placeholder={placeholder}
        aria-label={label}
        autoFocus={autoFocus}
        onInput={(e) => {
          setV(e.currentTarget.value);
          envoyer(e.currentTarget.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            clearTimeout(t.current);
            onChange(v);
          }
        }}
      />
      {v && (
        <button
          type="button"
          class="input-group__clear"
          aria-label="Effacer la recherche"
          onClick={() => {
            setV('');
            clearTimeout(t.current);
            onChange('');
          }}
        >
          <Icon name="x" size="s" />
        </button>
      )}
    </div>
  );
}

// Tri d'une colonne (en-tête de tableau)
export function SortTh({ id, tri, onTri, children, class: cls }) {
  const dir = tri === id ? 'asc' : tri === `-${id}` ? 'desc' : null;
  return (
    <th class={cls} aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
      <button type="button" class="sort" data-dir={dir || undefined} onClick={() => onTri(dir === 'desc' ? id : `-${id}`)}>
        {children}
        <Icon name={dir === 'asc' ? 'fleche-h' : 'fleche-b'} />
      </button>
    </th>
  );
}
