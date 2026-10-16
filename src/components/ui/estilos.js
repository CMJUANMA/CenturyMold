/**
 * estilos.js — Clases compartidas por los componentes de src/components/ui/ (el sistema de diseño; ver docs/diseno.md).
 * Todo el color sale de los tokens de index.css: aquí no hay colores sueltos.
 */
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

/** Tonos de estado: siempre con ícono y texto (nunca solo color). El error NO usa el rojo de la marca: es un ladrillo oscuro sobre fondo suave. */
export const TONOS = {
  exito: {
    Icono: CheckCircle2,
    caja: 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]',
    texto: 'text-[var(--status-success-text)]',
  },
  aviso: {
    Icono: AlertTriangle,
    caja: 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]',
    texto: 'text-[var(--status-warning-text)]',
  },
  error: {
    Icono: AlertCircle,
    caja: 'border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-text)]',
    texto: 'text-[var(--status-error-text)]',
  },
  info: {
    Icono: Info,
    caja: 'border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]',
    texto: 'text-[var(--status-info-text)]',
  },
  neutro: {
    Icono: null,
    caja: 'border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)]',
    texto: 'text-[var(--text-secondary)]',
  },
};

/** Campo de formulario: 44 px de alto en celular (área táctil), 40 px en escritorio; el foco lo dibuja el anillo global */
export const CONTROL =
  'block w-full rounded-md border bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] '
  + 'min-h-11 md:min-h-10 transition-colors duration-150 disabled:cursor-not-allowed disabled:bg-[var(--bg-surface-hover)] disabled:text-[var(--text-disabled)]';
export const CONTROL_OK = 'border-[var(--border-color)] hover:border-[var(--text-muted)] focus:border-[var(--accent-text)]';
export const CONTROL_ERROR = 'border-[var(--status-error-text)]';
