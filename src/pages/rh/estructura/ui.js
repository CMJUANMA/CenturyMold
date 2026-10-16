// Clases compartidas por las pestañas de la pantalla Estructura: salen del sistema de diseño (components/ui)
import { claseBoton } from '../../../components/ui/Boton';
import { CONTROL, CONTROL_OK } from '../../../components/ui/estilos';

export const btnPrimary = claseBoton('primario', 'md');
export const btnSecondary = claseBoton('contorno', 'md');
export const btnIcon = claseBoton('fantasma', 'icono');
export const inputCls = `${CONTROL} ${CONTROL_OK} py-2`;
export const labelCls = 'mb-1.5 block text-xs font-medium text-[var(--text-secondary)]';
export const tablaWrap = 'overflow-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]';
export const thCls = 'px-4 py-3 whitespace-nowrap';
export const theadCls = 'border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] font-medium';
export const chip = 'inline-flex items-center rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)] whitespace-nowrap';
export const chipWarn = 'inline-flex items-center rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-0.5 text-xs font-medium text-[var(--status-warning-text)] whitespace-nowrap';
