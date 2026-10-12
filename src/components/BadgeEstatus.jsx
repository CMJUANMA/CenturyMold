/**
 * BadgeEstatus.jsx — Etiqueta de color con el estatus de una solicitud.
 */
import { ESTATUS_MAP, normalizarEstatus } from '../utils/constantes';

const SIN_CONFIG = { label: '', cls: 'bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]', dot: 'bg-[var(--border-color)]' };

export default function BadgeEstatus({ estatus, conPunto = false, className = '' }) {
  const norm = normalizarEstatus(estatus);
  const cfg = ESTATUS_MAP[norm] ?? { ...SIN_CONFIG, label: norm };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${cfg.cls} ${className}`}>
      {conPunto && <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />}
      {cfg.label}
    </span>
  );
}
