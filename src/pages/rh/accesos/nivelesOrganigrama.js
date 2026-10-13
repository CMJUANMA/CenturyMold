// Acento, ícono y etiquetas de cada nivel del organigrama (colores: tokens del tema)
import { BadgeCheck, ShieldCheck, User } from 'lucide-react';

export const NIVELES = {
  aut2: { Icono: ShieldCheck, acento: 'var(--org-aut2-border)', fondo: 'var(--org-aut2-bg)', etiqueta: 'Autoriza nivel 2', corto: 'Autorización 2' },
  aut1: { Icono: BadgeCheck, acento: 'var(--org-aut1-border)', fondo: 'var(--org-aut1-bg)', etiqueta: 'Autoriza nivel 1', corto: 'Autorización 1' },
  solicitante: { Icono: User, acento: 'var(--org-sol-border)', fondo: 'var(--org-sol-bg)', etiqueta: 'Solicitante', corto: 'Solicitante' },
};

/** Línea del árbol (color del tema) */
export const COLOR_LINEA = 'var(--text-muted)';

export const textoConteo = (n) => (n === 0 ? 'sin solicitantes' : n === 1 ? '1 solicitante' : `${n} solicitantes`);
