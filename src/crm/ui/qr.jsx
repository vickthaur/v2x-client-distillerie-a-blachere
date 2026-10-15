// QR code du lien de partage (SVG net à toutes les tailles, marge de 4 modules).
import { useMemo } from 'preact/hooks';
import { cheminQr, qrcode } from '../lib/qr.js';

export function QrCode({ texte, taille = 184, label }) {
  const qr = useMemo(() => {
    try {
      return qrcode(texte);
    } catch {
      return null;
    }
  }, [texte]);
  if (!qr) return null;
  const n = qr.taille + 8;
  return (
    <svg class="qr" width={taille} height={taille} viewBox={`-4 -4 ${n} ${n}`} role="img" aria-label={label} shape-rendering="crispEdges">
      <rect x="-4" y="-4" width={n} height={n} fill="#fff" />
      <path d={cheminQr(qr.modules)} fill="#15130f" />
    </svg>
  );
}
