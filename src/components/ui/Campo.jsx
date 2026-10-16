/**
 * Campo.jsx — Controles de formulario del sistema de diseño. La etiqueta SIEMPRE está visible (el placeholder solo da un ejemplo) y el error va
 * junto al campo, con ícono y texto.
 *
 *   <Campo etiqueta="Número de nómina" ayuda="Solo números" error={error}><Entrada value=… onChange=… /></Campo>
 *
 * Campo conecta etiqueta, ayuda y error con el control (id, aria-describedby, aria-invalid). También: Selector, AreaTexto, Casilla, OpcionRadio.
 */
import { Children, cloneElement, forwardRef, isValidElement, useId } from 'react';
import { AlertCircle } from 'lucide-react';
import { CONTROL, CONTROL_ERROR, CONTROL_OK } from './estilos';

export function Campo({ etiqueta, ayuda, error, obligatorio = false, className = '', children }) {
  const id = useId();
  const control = Children.only(children);
  const idControl = control.props?.id ?? id;
  const idAyuda = ayuda ? `${idControl}-ayuda` : undefined;
  const idError = error ? `${idControl}-error` : undefined;
  const hijo = isValidElement(control)
    ? cloneElement(control, {
      id: idControl,
      'aria-describedby': [idAyuda, idError].filter(Boolean).join(' ') || undefined,
      'aria-invalid': error ? true : undefined,
      invalido: !!error,
    })
    : control;
  return (
    <div className={className}>
      {etiqueta && (
        <label htmlFor={idControl} className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
          {etiqueta}{obligatorio && <span className="text-[var(--accent-text)]" aria-hidden="true"> *</span>}
        </label>
      )}
      {hijo}
      {ayuda && !error && <p id={idAyuda} className="mt-1.5 text-xs text-[var(--text-muted)]">{ayuda}</p>}
      {error && (
        <p id={idError} role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs text-[var(--status-error-text)]">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span>{error}</span>
        </p>
      )}
    </div>
  );
}

const clase = (invalido, extra) => `${CONTROL} ${invalido ? CONTROL_ERROR : CONTROL_OK} ${extra ?? ''}`;

export const Entrada = forwardRef(function Entrada({ invalido, className, ...resto }, ref) {
  return <input ref={ref} className={clase(invalido, `py-2 ${className ?? ''}`)} {...resto} />;
});

export const AreaTexto = forwardRef(function AreaTexto({ invalido, className, rows = 3, ...resto }, ref) {
  return <textarea ref={ref} rows={rows} className={clase(invalido, `py-2 ${className ?? ''}`)} {...resto} />;
});

export const Selector = forwardRef(function Selector({ invalido, className, children, ...resto }, ref) {
  return <select ref={ref} className={clase(invalido, `py-2 pr-8 ${className ?? ''}`)} {...resto}>{children}</select>;
});

const CAJA = 'mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed';
export function Casilla({ etiqueta, ayuda, className = '', ...resto }) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-start gap-3 py-2 md:min-h-0 ${className}`}>
      <input type="checkbox" className={CAJA} {...resto} />
      <span><span className="block text-sm text-[var(--text-main)]">{etiqueta}</span>{ayuda && <span className="block text-xs text-[var(--text-muted)]">{ayuda}</span>}</span>
    </label>
  );
}
export function OpcionRadio({ etiqueta, ayuda, className = '', ...resto }) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-start gap-3 py-2 md:min-h-0 ${className}`}>
      <input type="radio" className={CAJA} {...resto} />
      <span><span className="block text-sm text-[var(--text-main)]">{etiqueta}</span>{ayuda && <span className="block text-xs text-[var(--text-muted)]">{ayuda}</span>}</span>
    </label>
  );
}
