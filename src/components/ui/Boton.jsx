/**
 * Boton.jsx — Botón del sistema de diseño. Un solo primario (rojo) por pantalla: la acción principal.
 *   variante: primario · secundario · contorno · fantasma · peligro (contorno con texto de error: Devolver, Cancelar, Revocar; nunca rojo sólido)
 *   tamano:   md (44 px en celular, 40 en escritorio) · sm (44 px en celular, 36 en escritorio; para tablas y barras)
 *   icono:    componente de lucide-react (opcional, a la izquierda)
 *   to:       si se da, es un enlace (react-router) con el mismo aspecto
 *   estado:   'cargando' (deshabilita y muestra el giro) · 'hecho' (marca de listo); con useAccionBoton se pasa solo de uno a otro
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';

export const VARIANTES = {
  primario: 'border border-transparent bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] active:bg-[var(--accent-hover)]',
  secundario: 'border border-transparent bg-[var(--bg-surface-hover)] text-[var(--text-main)] hover:bg-[var(--border-subtle)] active:bg-[var(--border-color)]',
  contorno: 'border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] active:bg-[var(--border-subtle)]',
  fantasma: 'border border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]',
  peligro: 'border border-[var(--status-error-border)] bg-[var(--bg-surface)] text-[var(--status-error-text)] hover:bg-[var(--status-error-bg)] active:bg-[var(--status-error-bg)]',
};
export const TAMANOS = {
  icono: 'inline-flex h-11 w-11 md:h-9 md:w-9 items-center justify-center p-0 text-xs',
  md: 'min-h-11 md:min-h-10 px-4 text-sm',
  sm: 'min-h-11 md:min-h-9 px-3 text-xs',
};

/** Clases de un botón (para <Link> o <label> que deben verse como botón): claseBoton('primario', 'md') */
export const claseBoton = (variante = 'contorno', tamano = 'md', extra = '') =>
  `inline-flex cursor-pointer items-center justify-center gap-2 rounded-md font-medium sm:whitespace-nowrap transition-colors duration-150 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${TAMANOS[tamano]} ${extra}`;

export default function Boton({
  variante = 'contorno', tamano = 'md', icono: Icono, estado, to, type = 'button', className = '', disabled, children, ...resto
}) {
  const ocupado = estado === 'cargando';
  const Etiqueta = to ? Link : 'button';
  const propias = to ? { to } : { type, disabled: disabled || ocupado, 'aria-busy': ocupado || undefined };
  return (
    <Etiqueta
      {...propias}
      className={claseBoton(variante, tamano, className)}
      {...resto}
    >
      {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        : estado === 'hecho' ? <Check className="h-4 w-4" aria-hidden="true" />
        : Icono ? <Icono className="h-4 w-4" aria-hidden="true" /> : null}
      {children}
    </Etiqueta>
  );
}

/**
 * Pasa un botón de reposo → cargando → hecho → reposo al ejecutar una acción async, sin bloquear la pantalla.
 *   const [estado, ejecutar] = useAccionBoton(); <Boton estado={estado} onClick={() => ejecutar(guardar)}>Guardar</Boton>
 * Si la acción falla, vuelve a reposo y relanza el error para que la pantalla lo muestre.
 */
export function useAccionBoton(msHecho = 1400) {
  const [estado, setEstado] = useState('reposo');
  const t = useRef(null);
  useEffect(() => () => clearTimeout(t.current), []);
  const ejecutar = useCallback(async (accion) => {
    clearTimeout(t.current);
    setEstado('cargando');
    try {
      const r = await accion();
      setEstado('hecho');
      t.current = setTimeout(() => setEstado('reposo'), msHecho);
      return r;
    } catch (err) {
      setEstado('reposo');
      throw err;
    }
  }, [msHecho]);
  return [estado, ejecutar];
}
