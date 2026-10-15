// Graphiques SVG faits main (aucune bibliothèque) : barres empilées, courbe avec aire, anneau,
// jauges, mini-courbes. Règles : traits fins, 2 px d'espace entre segments, extrémités arrondies
// de 4 px, grille en filets pleins discrets, info-bulle au survol ET au clavier, légende dès deux
// séries, tableau des valeurs disponible (les info-bulles complètent, elles ne cachent rien).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Portal } from '../ui/overlay.jsx';
import { Icon } from '../ui/icons.jsx';
import { cx } from '../ui/base.jsx';
import { nombre, pourcent } from '../lib/format.js';

// Largeur réelle du conteneur (le SVG est dessiné au pixel près, textes nets)
function useLargeur(initiale = 600) {
  const ref = useRef(null);
  const [l, setL] = useState(initiale);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setL(el.clientWidth || initiale);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      if (w > 0) setL(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, l];
}

// Graduations « rondes » : 0, 250, 500, 750…
export function graduations(max, n = 4) {
  if (!(max > 0)) return [0, 1];
  const brut = max / n;
  const p = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= brut) || 10 * p;
  const fin = Math.ceil(max / pas) * pas;
  const out = [];
  for (let v = 0; v <= fin + pas / 2; v += pas) out.push(Math.round(v * 100) / 100);
  return out;
}

// Rectangle à coins hauts arrondis (barre posée sur la ligne de base)
function barre(x, y, w, h, r) {
  if (h <= 0 || w <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}A${rr},${rr} 0 0 1 ${x + rr},${y}H${x + w - rr}A${rr},${rr} 0 0 1 ${x + w},${y + rr}V${y + h}Z`;
}

// ---------- Info-bulle ----------
export function Tip({ tip }) {
  if (!tip) return null;
  const vw = typeof window !== 'undefined' ? document.documentElement.clientWidth : 1000;
  const x = Math.max(96, Math.min(vw - 96, tip.x));
  const y = Math.max(tip.y, 80);
  return (
    <Portal>
      <div class="tip" style={{ left: `${x}px`, top: `${y}px` }} aria-hidden="true">
        {tip.titre && <div class="tip__title">{tip.titre}</div>}
        {tip.lignes.map((l, i) => (
          <div class="tip__row" key={i}>
            {l.couleur && <span class="tip__key" style={{ background: l.couleur }} />}
            <span class="tip__lab">{l.label}</span>
            <span class="tip__val">{l.valeur}</span>
          </div>
        ))}
      </div>
    </Portal>
  );
}

// Légende (pastille de la forme de la marque + libellé + valeur)
export function Legende({ items, forme = 'barre' }) {
  return (
    <ul class="legend">
      {items.map((it) => (
        <li key={it.label}>
          <span class={cx('legend__key', `legend__key--${forme}`)} style={{ background: it.couleur }} aria-hidden="true" />
          <span class="legend__label">{it.label}</span>
          {it.valeur !== undefined && <span class="legend__val">{it.valeur}</span>}
        </li>
      ))}
    </ul>
  );
}

// Bouton « Tableau » : bascule vers les valeurs en clair
export function BasculeTableau({ actif, onChange }) {
  return (
    <button type="button" class="more" aria-pressed={actif ? 'true' : 'false'} onClick={() => onChange(!actif)}>
      <Icon name={actif ? 'graphique' : 'liste'} />
      {actif ? 'Graphique' : 'Tableau'}
    </button>
  );
}

/**
 * Barres empilées (une colonne par jour).
 * @param {{ data: object[], series: { cle, label, couleur }[], etiquette: (d) => string,
 *   etiquetteLongue?: (d) => string, format: (n) => string, formatAxe?: (n) => string,
 *   hauteur?: number, label: string, pasEtiquettes?: number }} p
 */
export function BarresEmpilees({ data, series, etiquette, etiquetteLongue, format, formatAxe, hauteur = 220, label, pasEtiquettes = 7 }) {
  const [ref, largeur] = useLargeur();
  const [actif, setActif] = useState(null);
  const [tip, setTip] = useState(null);
  const [annonce, setAnnonce] = useState('');
  const svgRef = useRef(null);
  const n = data.length;
  const totaux = data.map((d) => series.reduce((s, x) => s + (Number(d[x.cle]) || 0), 0));
  const ticks = graduations(Math.max(...totaux, 0));
  const max = ticks[ticks.length - 1] || 1;
  const fa = formatAxe || format;
  const gauche = Math.max(34, Math.max(...ticks.map((t) => fa(t).length)) * 6.6 + 10);
  const m = { t: 10, r: 6, b: 26, l: gauche };
  const pw = Math.max(10, largeur - m.l - m.r);
  const ph = hauteur - m.t - m.b;
  const bande = pw / Math.max(n, 1);
  const lb = Math.max(2, Math.min(24, bande * 0.64));
  const y = (v) => m.t + ph - (v / max) * ph;
  const GAP = 2;

  const montrer = (i, ev) => {
    if (i === null || i < 0 || i >= n) {
      setTip(null);
      return;
    }
    const d = data[i];
    const rect = svgRef.current.getBoundingClientRect();
    const cx_ = rect.left + (m.l + i * bande + bande / 2) * (rect.width / largeur);
    const cy = rect.top + y(totaux[i]) * (rect.height / hauteur);
    setActif(i);
    const lignes = series.map((s) => ({ label: s.label, valeur: format(Number(d[s.cle]) || 0), couleur: s.couleur }));
    if (series.length > 1) lignes.push({ label: 'Total', valeur: format(totaux[i]) });
    setTip({ x: ev?.clientX ?? cx_, y: cy, titre: (etiquetteLongue || etiquette)(d), lignes });
  };
  const surTouche = (e) => {
    let i = actif ?? n - 1;
    if (e.key === 'ArrowRight') i = Math.min(n - 1, (actif ?? -1) + 1);
    else if (e.key === 'ArrowLeft') i = Math.max(0, (actif ?? n) - 1);
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = n - 1;
    else if (e.key === 'Escape') {
      setActif(null);
      setTip(null);
      return;
    } else return;
    e.preventDefault();
    montrer(i);
    const d = data[i];
    setAnnonce(`${(etiquetteLongue || etiquette)(d)} : ${series.map((s) => `${s.label} ${format(Number(d[s.cle]) || 0)}`).join(', ')}`);
  };

  return (
    <div class="chart" ref={ref}>
      <svg
        ref={svgRef}
        class="chart__svg"
        width={largeur}
        height={hauteur}
        viewBox={`0 0 ${largeur} ${hauteur}`}
        role="group"
        aria-label={`${label}. Flèches gauche et droite pour lire chaque jour.`}
        tabIndex={0}
        onKeyDown={surTouche}
        onBlur={() => {
          setTip(null);
          setActif(null);
        }}
        onPointerLeave={() => {
          setTip(null);
          setActif(null);
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line class={t === 0 ? 'chart__base' : 'chart__grid'} x1={m.l} x2={largeur - m.r} y1={Math.round(y(t)) + 0.5} y2={Math.round(y(t)) + 0.5} />
            <text class="chart__tick" x={m.l - 8} y={y(t)} dy="0.32em" text-anchor="end">
              {fa(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = m.l + i * bande + (bande - lb) / 2;
          let base = 0;
          const segs = [];
          const visibles = series.filter((s) => (Number(d[s.cle]) || 0) > 0);
          visibles.forEach((s, k) => {
            const v = Number(d[s.cle]) || 0;
            const y0 = y(base);
            const y1 = y(base + v);
            base += v;
            const dessus = k === visibles.length - 1;
            const h = Math.max(0, y0 - y1 - (k > 0 ? GAP : 0));
            const top = y0 - (k > 0 ? GAP : 0) - h;
            if (h <= 0.2) return;
            segs.push(dessus ? <path key={s.cle} d={barre(x, top, lb, h, 4)} fill={s.couleur} /> : <rect key={s.cle} x={x} y={top} width={lb} height={h} fill={s.couleur} />);
          });
          return (
            <g key={i} class={cx('chart__col', actif !== null && actif !== i && 'is-dim')}>
              {actif === i && <rect class="chart__hl" x={m.l + i * bande} y={m.t} width={bande} height={ph} rx="4" />}
              {segs}
              <rect class="chart__hit" x={m.l + i * bande} y={m.t} width={bande} height={ph} onPointerEnter={(e) => montrer(i, e)} onPointerMove={(e) => montrer(i, e)} />
            </g>
          );
        })}
        {data.map((d, i) =>
          i % pasEtiquettes === (n - 1) % pasEtiquettes ? (
            <text key={`x${i}`} class="chart__tick" x={m.l + i * bande + bande / 2} y={hauteur - 8} text-anchor={i === n - 1 ? 'end' : 'middle'} dx={i === n - 1 ? bande / 2 : 0}>
              {etiquette(d)}
            </text>
          ) : null,
        )}
      </svg>
      <p class="sr-only" aria-live="polite">
        {annonce}
      </p>
      <Tip tip={tip} />
    </div>
  );
}

/**
 * Courbe avec aire légère et réticule (évolution des abonnés).
 */
export function Courbe({ points, format, etiquette, etiquetteLongue, hauteur = 200, label, couleur = 'var(--c-1)', pasEtiquettes }) {
  const [ref, largeur] = useLargeur();
  const [actif, setActif] = useState(null);
  const [tip, setTip] = useState(null);
  const [annonce, setAnnonce] = useState('');
  const svgRef = useRef(null);
  const n = points.length;
  const vals = points.map((p) => Number(p.valeur) || 0);
  const ticks = graduations(Math.max(...vals, 0));
  const max = ticks[ticks.length - 1] || 1;
  const gauche = Math.max(30, Math.max(...ticks.map((t) => format(t).length)) * 6.6 + 10);
  const m = { t: 12, r: 12, b: 26, l: gauche };
  const pw = Math.max(10, largeur - m.l - m.r);
  const ph = hauteur - m.t - m.b;
  const x = (i) => m.l + (n <= 1 ? pw / 2 : (i / (n - 1)) * pw);
  const y = (v) => m.t + ph - (v / max) * ph;
  const ligne = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const aire = n ? `${ligne}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : '';
  const pas = pasEtiquettes || Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 70))));

  const montrer = (i, ev) => {
    if (i === null || i < 0 || i >= n) return;
    const rect = svgRef.current.getBoundingClientRect();
    const k = rect.width / largeur;
    setActif(i);
    setTip({
      x: ev?.clientX ?? rect.left + x(i) * k,
      y: rect.top + y(vals[i]) * k,
      titre: (etiquetteLongue || etiquette)(points[i]),
      lignes: [{ label, valeur: format(vals[i]), couleur }],
    });
  };
  const surPointeur = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * largeur;
    const i = Math.round(((px - m.l) / pw) * (n - 1));
    montrer(Math.max(0, Math.min(n - 1, i)), e);
  };
  const surTouche = (e) => {
    let i = actif ?? n - 1;
    if (e.key === 'ArrowRight') i = Math.min(n - 1, (actif ?? -1) + 1);
    else if (e.key === 'ArrowLeft') i = Math.max(0, (actif ?? n) - 1);
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = n - 1;
    else return;
    e.preventDefault();
    montrer(i);
    setAnnonce(`${(etiquetteLongue || etiquette)(points[i])} : ${format(vals[i])}`);
  };
  return (
    <div class="chart" ref={ref}>
      <svg
        ref={svgRef}
        class="chart__svg"
        width={largeur}
        height={hauteur}
        viewBox={`0 0 ${largeur} ${hauteur}`}
        role="group"
        aria-label={`${label}. Flèches gauche et droite pour lire chaque point.`}
        tabIndex={0}
        onKeyDown={surTouche}
        onPointerMove={surPointeur}
        onPointerLeave={() => {
          setActif(null);
          setTip(null);
        }}
        onBlur={() => {
          setActif(null);
          setTip(null);
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line class={t === 0 ? 'chart__base' : 'chart__grid'} x1={m.l} x2={largeur - m.r} y1={Math.round(y(t)) + 0.5} y2={Math.round(y(t)) + 0.5} />
            <text class="chart__tick" x={m.l - 8} y={y(t)} dy="0.32em" text-anchor="end">
              {format(t)}
            </text>
          </g>
        ))}
        <path d={aire} fill={couleur} opacity="0.1" />
        <path d={ligne} fill="none" stroke={couleur} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        {actif !== null && <line class="chart__cross" x1={x(actif)} x2={x(actif)} y1={m.t} y2={m.t + ph} />}
        {n > 0 && <circle cx={x(actif ?? n - 1)} cy={y(vals[actif ?? n - 1])} r="4.5" fill={couleur} stroke="#fff" stroke-width="2" />}
        {points.map((p, i) =>
          (n - 1 - i) % pas === 0 ? (
            <text key={i} class="chart__tick" x={x(i)} y={hauteur - 8} text-anchor={i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle'}>
              {etiquette(p)}
            </text>
          ) : null,
        )}
      </svg>
      <p class="sr-only" aria-live="polite">
        {annonce}
      </p>
      <Tip tip={tip} />
    </div>
  );
}

/**
 * Anneau (part de chaque catégorie) ; la légende donne les valeurs et les parts en clair.
 */
export function Anneau({ items, taille = 168, epaisseur = 22, centre, sousCentre, label, format = (v) => nombre(v) }) {
  const [tip, setTip] = useState(null);
  const [actif, setActif] = useState(null);
  const total = items.reduce((s, it) => s + (Number(it.valeur) || 0), 0);
  const r = (taille - epaisseur) / 2;
  const c = 2 * Math.PI * r;
  const gap = items.filter((it) => it.valeur > 0).length > 1 ? 2 : 0;
  let cumul = 0;
  const segs = items.map((it) => {
    const v = Number(it.valeur) || 0;
    const long = total ? (v / total) * c : 0;
    const s = { ...it, debut: cumul, long: Math.max(0, long - gap) };
    cumul += long;
    return s;
  });
  const montrer = (it, e) => {
    setActif(it.label);
    const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
    setTip({ x: e.clientX ?? rect.left + rect.width / 2, y: e.clientY ?? rect.top, titre: it.label, lignes: [{ label: format(it.valeur), valeur: total ? pourcent(it.valeur / total) : '', couleur: it.couleur }] });
  };
  return (
    <div class="donut">
      <svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`} role="img" aria-label={label} class="donut__svg">
        <circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke="var(--paper-2)" stroke-width={epaisseur} />
        {segs.map((s) =>
          s.long > 0 ? (
            <circle
              key={s.label}
              cx={taille / 2}
              cy={taille / 2}
              r={r}
              fill="none"
              stroke={s.couleur}
              stroke-width={epaisseur}
              stroke-dasharray={`${s.long} ${c - s.long}`}
              stroke-dashoffset={-s.debut}
              transform={`rotate(-90 ${taille / 2} ${taille / 2})`}
              class={cx('donut__seg', actif && actif !== s.label && 'is-dim')}
              onPointerEnter={(e) => montrer(s, e)}
              onPointerMove={(e) => montrer(s, e)}
              onPointerLeave={() => {
                setTip(null);
                setActif(null);
              }}
            />
          ) : null,
        )}
        {centre !== undefined && (
          <>
            <text x="50%" y="50%" text-anchor="middle" class="donut__centre" dy={sousCentre ? '-0.1em' : '0.35em'}>
              {centre}
            </text>
            {sousCentre && (
              <text x="50%" y="50%" text-anchor="middle" class="donut__sous" dy="1.45em">
                {sousCentre}
              </text>
            )}
          </>
        )}
      </svg>
      <ul class="donut__legend">
        {items.map((it) => (
          <li key={it.label} class={cx(actif === it.label && 'is-on')}>
            <span class="legend__key legend__key--carre" style={{ background: it.couleur }} aria-hidden="true" />
            <span class="donut__lab">{it.label}</span>
            <span class="donut__val tnum">{format(it.valeur)}</span>
            <span class="donut__pct tnum">{total ? pourcent(it.valeur / total) : '—'}</span>
          </li>
        ))}
      </ul>
      <Tip tip={tip} />
    </div>
  );
}

// Jauge horizontale : la couleur dit la gravité (bleu, puis or à 80 %, rouge quand c'est plein)
export function Jauge({ valeur = 0, max = 1, label, texte, fin = false, seuil = 0.8, class: cls }) {
  const ratio = max > 0 ? Math.min(1, valeur / max) : 0;
  const ton = ratio >= 1 ? 'err' : ratio >= seuil ? 'warn' : 'info';
  return (
    <div class={cx('meter', `meter--${ton}`, fin && 'meter--fin', cls)}>
      <div class="meter__track" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={valeur} aria-label={label} aria-valuetext={texte}>
        <div class="meter__fill" style={{ width: `${(ratio * 100).toFixed(1)}%` }} />
      </div>
    </div>
  );
}

// Jauge circulaire (fiche d'une séance)
export function JaugeRonde({ valeur = 0, max = 1, taille = 76, epaisseur = 8, label, sous }) {
  const ratio = max > 0 ? Math.min(1, valeur / max) : 0;
  const r = (taille - epaisseur) / 2;
  const c = 2 * Math.PI * r;
  const ton = ratio >= 1 ? 'var(--err)' : ratio >= 0.8 ? 'var(--warn)' : 'var(--fb)';
  const fond = ratio >= 1 ? 'var(--err-50)' : ratio >= 0.8 ? 'var(--warn-50)' : 'var(--fb-50)';
  return (
    <svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`} role="img" aria-label={label} class="ring">
      <circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke={fond} stroke-width={epaisseur} />
      <circle
        cx={taille / 2}
        cy={taille / 2}
        r={r}
        fill="none"
        stroke={ton}
        stroke-width={epaisseur}
        stroke-linecap="round"
        stroke-dasharray={`${Math.max(0.001, ratio * c)} ${c}`}
        transform={`rotate(-90 ${taille / 2} ${taille / 2})`}
      />
      <text x="50%" y="50%" text-anchor="middle" dy={sous ? '-0.05em' : '0.35em'} class="ring__val">
        {nombre(valeur)}
      </text>
      {sous && (
        <text x="50%" y="50%" text-anchor="middle" dy="1.35em" class="ring__sous">
          {sous}
        </text>
      )}
    </svg>
  );
}

// Mini-courbe décorative d'une tuile (le chiffre est écrit à côté)
export function MiniCourbe({ valeurs = [], couleur = 'var(--c-1)', largeur = 120, hauteur = 36 }) {
  const id = useMemo(() => `sp${Math.random().toString(36).slice(2, 8)}`, []);
  if (valeurs.length < 2) return null;
  const max = Math.max(...valeurs, 1);
  const min = Math.min(...valeurs, 0);
  const n = valeurs.length;
  const pad = 4;
  const x = (i) => pad + (i / (n - 1)) * (largeur - 2 * pad);
  const y = (v) => pad + (hauteur - 2 * pad) * (1 - (v - min) / (max - min || 1));
  const d = valeurs.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  return (
    <svg class="spark" width={largeur} height={hauteur} viewBox={`0 0 ${largeur} ${hauteur}`} aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color={couleur} stop-opacity="0.16" />
          <stop offset="1" stop-color={couleur} stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d}L${x(n - 1)},${hauteur}L${x(0)},${hauteur}Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={couleur} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
      <circle cx={x(n - 1)} cy={y(valeurs[n - 1])} r="3.5" fill={couleur} stroke="#fff" stroke-width="2" />
    </svg>
  );
}

// Barres horizontales (une seule série : même couleur pour toutes, valeur au bout)
export function BarresListe({ items, format = (v) => nombre(v), couleur = 'var(--c-1)' }) {
  const max = Math.max(...items.map((i) => i.valeur || 0), 1);
  return (
    <ul class="hbars">
      {items.map((it) => (
        <li key={it.cle || it.label}>
          <div class="hbars__top">
            <span class="hbars__lab">{it.label}</span>
            <span class="hbars__val tnum">{format(it.valeur)}</span>
          </div>
          <div class="hbars__track" aria-hidden="true">
            <div class="hbars__fill" style={{ width: `${((it.valeur || 0) / max) * 100}%`, background: it.couleur || couleur }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Effet : remet l'info-bulle à zéro quand la page défile (évite une bulle orpheline)
export function useFermerAuDefilement(set) {
  useEffect(() => {
    const f = () => set(null);
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
}
