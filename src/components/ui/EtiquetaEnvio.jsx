/**
 * EtiquetaEnvio.jsx — La misma etiqueta en toda la captura para decir si algo BLOQUEA el envío o no:
 *   «Obligatorio para enviar» (rojo): sin esto no se puede enviar.
 *   «Aviso, no impide enviar» (ámbar): es informativo; se puede enviar igual.
 * Siempre con texto (nunca solo color).
 */
const TEXTO_ETIQUETA = { obligatorio: 'Obligatorio para enviar', aviso: 'Aviso, no impide enviar' };

export default function EtiquetaEnvio({ tipo = 'obligatorio', className = '' }) {
  const color = tipo === 'obligatorio'
    ? 'border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-text)]'
    : 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]';
  return (
    <span className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold leading-tight ${color} ${className}`}>
      {TEXTO_ETIQUETA[tipo] ?? TEXTO_ETIQUETA.aviso}
    </span>
  );
}
