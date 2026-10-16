// Clases compartidas por las pestañas de Usuarios y accesos: salen del sistema de diseño (components/ui)
import { claseBoton } from '../../../components/ui/Boton';
import { CONTROL, CONTROL_OK } from '../../../components/ui/estilos';

export const inputCls = `${CONTROL} ${CONTROL_OK} py-2`;
export const selectCls = `${CONTROL} ${CONTROL_OK} py-2 pr-8 !w-auto`;
export const btnPrimary = claseBoton('primario', 'md');
export const btnSecondary = claseBoton('contorno', 'md');
export const btnIcon = claseBoton('fantasma', 'icono');
export const labelCls = 'mb-1.5 block text-xs font-medium text-[var(--text-secondary)]';
export const etiquetaCls = 'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)]';

export const ESTADO_CLS = {
  vigente: 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]',
  programada: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]',
  vencida: 'bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]',
  revocada: 'bg-[var(--status-error-bg)] text-[var(--status-error-text)] border-[var(--status-error-border)]',
};
