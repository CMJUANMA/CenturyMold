/**
 * BadgeEstatus.jsx — Etiqueta de color con el estatus de una solicitud.
 * Con `modulo="te"` usa los estatus de tiempo extra (ESTATUS_TE_MAP).
 */
import { ESTATUS_MAP, ESTATUS_TE_MAP, normalizarEstatus } from '../utils/constantes';

const SIN_CONFIG = { label: '', cls: 'bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]', dot: 'bg-[var(--border-color)]' };

export default function BadgeEstatus({ estatus, modulo = 'rutas', conPunto = false, className = '' }) {
  const norm = normalizarEstatus(estatus);
  const mapa = modulo === 'te' ? ESTATUS_TE_MAP : ESTATUS_MAP;
  const cfg = mapa[norm] ?? { ...SIN_CONFIG, label: norm };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${cfg.cls} ${className}`}>
      {conPunto && <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />}
      {cfg.label}
    </span>
  );
}
