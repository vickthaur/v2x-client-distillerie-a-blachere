// Ruban de sensibilisation (Octobre Rose), redessiné d'après src/lib/operation.js (branche
// operation-rose) : deux tons pour le croisement, extrémités en queue d'aronde.
import { useMemo } from 'preact/hooks';

const TONS = {
  rose: ['#c23a80', '#e45aa0'],
  clair: ['#f7b6d4', '#ffe4f0'],
  pale: ['#f3bcd6', '#f9d6e7'],
};
let n = 0;

export function Ruban({ ton = 'rose', class: cls = 'ruban', style, titre }) {
  const id = useMemo(() => `ruban-crm-${++n}`, []);
  const [dos, face] = TONS[ton] || TONS.rose;
  return (
    <svg class={cls} style={style} viewBox="0 0 64 96" aria-hidden={titre ? undefined : 'true'} role={titre ? 'img' : undefined} focusable="false">
      {titre && <title>{titre}</title>}
      <defs>
        <clipPath id={id}>
          <path d="M0 0H64V96H51L45.2 90.5 39.4 96H24.6L18.8 90.5 13 96H0Z" />
        </clipPath>
      </defs>
      <g clip-path={`url(#${id})`} fill="none" stroke-width="10.5">
        <path d="M46 98 27 55C22 43 20 14.5 32 14.5" stroke={dos} />
        <path d="M32 14.5C44 14.5 42 43 37 55L18 98" stroke={face} />
      </g>
    </svg>
  );
}
