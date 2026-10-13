// Clases compartidas por las pestañas de Usuarios y accesos
export const inputCls = 'w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-xs focus:border-[var(--cm-red)] focus:outline-none focus:ring-1 focus:ring-[var(--cm-red)]';
export const selectCls = 'rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--cm-red)]';
export const btnPrimary = 'inline-flex items-center gap-1.5 rounded-md bg-[var(--cm-red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--cm-red-hover)] active:scale-95 transition-all disabled:opacity-50 cursor-pointer';
export const btnSecondary = 'inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] active:scale-95 transition-all cursor-pointer';
export const btnIcon = 'rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-secondary)] hover:text-[var(--text-main)] active:scale-95 transition-all cursor-pointer';
export const labelCls = 'block text-xs font-medium text-[var(--text-secondary)] mb-1';
export const etiquetaCls = 'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)]';

export const ESTADO_CLS = {
  vigente: 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]',
  programada: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]',
  vencida: 'bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]',
  revocada: 'bg-[var(--status-error-bg)] text-[var(--status-error-text)] border-[var(--status-error-border)]',
};
