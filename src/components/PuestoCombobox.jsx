/**
 * PuestoCombobox.jsx
 * Combobox reutilizable para capturar puestos de trabajo.
 *
 * Props:
 *   puestosExistentes  string[]   Lista de puestos ya registrados (derivarPuestos).
 *   value              string     Valor actual del campo ('' = sin puesto).
 *   onChange           fn         Callback con el puesto elegido/confirmado.
 *   disabled           boolean    Deshabilita el control.
 *   required           boolean    Marca el campo como requerido.
 *   inputCls           string     Clases extra para el input.
 *
 * El valor solo se emite cuando el puesto está decidido: al elegir de la lista,
 * al confirmar "Otro" sin coincidencias, o tras responder "¿Quisiste decir...?".
 */
import { useState, useRef, useEffect } from 'react';
import Boton from './ui/Boton';
import { CONTROL, CONTROL_OK } from './ui/estilos';
import { ChevronDown, ChevronUp, AlertTriangle, Check, Sparkles } from 'lucide-react';
import { normalizarPuesto, clavePuesto, resolverPuesto, existePuesto } from '../utils/puestos';

const OTRO = '__OTRO__';
const ETIQUETA_OTRO = 'Otro (escribir uno nuevo)';

const baseInputCls = `${CONTROL} ${CONTROL_OK} py-2`;

export default function PuestoCombobox({
  puestosExistentes = [],
  value = '',
  onChange,
  disabled = false,
  required = false,
  inputCls = '',
}) {
  const [abiertoRaw, setAbierto] = useState(false);
  const abierto = abiertoRaw && !disabled;
  const [query, setQuery]       = useState('');
  const [activo, setActivo]     = useState(-1);
  const [modoOtro, setModoOtro] = useState(false);
  const [textOtro, setTextOtro] = useState('');
  // { tipo: 'exacto', puesto } | { tipo: 'similar', sugerido, escrito }
  const [aviso, setAviso]       = useState(null);

  const wrapRef   = useRef(null);
  const inputRef  = useRef(null);
  const otroRef   = useRef(null);
  const previoRef = useRef('');

  // Validación nativa del formulario: el texto escrito no cuenta si no se eligió un puesto
  useEffect(() => {
    const msg = required && !value && !disabled
      ? (modoOtro ? 'Confirma el puesto nuevo con OK.' : 'Selecciona un puesto de la lista o elige "Otro".')
      : '';
    inputRef.current?.setCustomValidity(msg);
    otroRef.current?.setCustomValidity(msg);
  }, [required, value, disabled, modoOtro, aviso]);

  const claveQuery = clavePuesto(query);
  const listaFiltrada = claveQuery
    ? puestosExistentes.filter(p => clavePuesto(p).includes(claveQuery))
    : puestosExistentes;
  const opciones = [...listaFiltrada, OTRO];
  const esNuevo = !!value && !existePuesto(value, puestosExistentes);

  const abrir = () => {
    if (disabled) return;
    setQuery(''); setActivo(-1); setAbierto(true); setAviso(null);
  };

  const seleccionar = (op) => {
    setAbierto(false); setAviso(null);
    if (op === OTRO) {
      previoRef.current = value;
      setModoOtro(true);
      setTextOtro(query);
      onChange('');
      setTimeout(() => otroRef.current?.focus(), 0);
      return;
    }
    onChange(op);
  };

  const salirOtro = () => {
    setModoOtro(false); setTextOtro('');
  };

  const cancelarOtro = () => {
    salirOtro(); setAviso(null);
    onChange(previoRef.current);
  };

  const confirmarOtro = () => {
    const escrito = normalizarPuesto(textOtro);
    if (!escrito) return;
    const r = resolverPuesto(escrito, puestosExistentes.map(nombre => ({ nombre })));
    if (r.nivel === 'a') {
      setAviso({ tipo: 'exacto', puesto: r.puesto.nombre });
      salirOtro();
      onChange(r.puesto.nombre);
    } else if (r.nivel === 'b') {
      // No se emite valor hasta que el usuario decida
      setTextOtro(escrito);
      setAviso({ tipo: 'similar', sugerido: r.puesto.nombre, escrito });
    } else {
      setAviso(null);
      salirOtro();
      onChange(escrito);
    }
  };

  const usarSugerido = () => {
    const sugerido = aviso.sugerido;
    setAviso(null); salirOtro();
    onChange(sugerido);
  };

  const esDistinto = () => {
    const escrito = aviso.escrito;
    setAviso(null); salirOtro();
    onChange(escrito);
  };

  const handleKeyDown = (e) => {
    if (!abierto) {
      if (e.key === 'ArrowDown') { e.preventDefault(); abrir(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo(a => Math.min(a + 1, opciones.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (activo >= 0) seleccionar(opciones[activo]);
      else if (claveQuery && listaFiltrada.length === 1) seleccionar(listaFiltrada[0]);
    }
    else if (e.key === 'Escape') { e.preventDefault(); setAbierto(false); }
  };

  // Cerrar al salir del control (mouse o teclado)
  const handleBlur = (e) => {
    if (!wrapRef.current?.contains(e.relatedTarget)) setAbierto(false);
  };

  return (
    <div ref={wrapRef} className="relative" onBlur={handleBlur}>
      {!modoOtro && (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={abierto}
            autoComplete="off"
            disabled={disabled}
            value={abierto ? query : value}
            placeholder={abierto && value ? value : 'Buscar puesto...'}
            className={`${baseInputCls} ${inputCls} pr-8`}
            onFocus={abrir}
            onClick={() => { if (!abierto) abrir(); }}
            onChange={e => { setQuery(e.target.value); setAbierto(true); setActivo(-1); }}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button" tabIndex={-1} disabled={disabled}
            onMouseDown={e => e.preventDefault()}
            onClick={() => (abierto ? setAbierto(false) : (inputRef.current?.focus(), abrir()))}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          >
            {abierto ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {abierto && (
            <div role="listbox" className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xl">
              {listaFiltrada.length === 0 && (
                <div className="px-3 py-2 text-xs text-[var(--text-muted)] italic">
                  {claveQuery ? 'Sin coincidencias.' : 'Aun no hay puestos registrados.'}
                </div>
              )}
              {opciones.map((op, i) => (
                <button
                  key={op} type="button" role="option" tabIndex={-1}
                  aria-selected={op === value}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => seleccionar(op)}
                  onMouseEnter={() => setActivo(i)}
                  className={[
                    'flex w-full items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2 text-left text-xs last:border-0 hover:bg-[var(--bg-surface-secondary)] transition-colors',
                    activo === i ? 'bg-[var(--bg-surface-secondary)]' : '',
                    op === OTRO ? 'italic text-[var(--text-secondary)]' : 'text-[var(--text-main)]',
                  ].join(' ')}
                >
                  {op !== OTRO && clavePuesto(op) === clavePuesto(value) && <Check className="h-3 w-3 text-[var(--accent-text)] shrink-0" />}
                  {op === OTRO ? ETIQUETA_OTRO : op}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {modoOtro && (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <input
              ref={otroRef} type="text" autoComplete="off"
              disabled={disabled}
              value={textOtro} placeholder="Escribe el nuevo puesto..."
              className={`${baseInputCls} ${inputCls} flex-1`}
              onChange={e => { setTextOtro(e.target.value); setAviso(null); }}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); confirmarOtro(); }
                if (e.key === 'Escape') { e.preventDefault(); cancelarOtro(); }
              }}
            />
            <Boton variante="primario" onClick={confirmarOtro} disabled={disabled || !textOtro.trim()}>Aceptar</Boton>
            <Boton onClick={cancelarOtro} title="Cancelar" aria-label="Cancelar">Cancelar</Boton>
          </div>
          {!aviso && (
            <p className="text-xs text-[var(--text-muted)]">Se guardara en mayusculas y sin espacios dobles.</p>
          )}
        </div>
      )}

      {esNuevo && !modoOtro && !abierto && (
        <p className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]">
          <Sparkles className="h-3 w-3" />Puesto nuevo: se agregara a la lista al guardar.
        </p>
      )}

      {aviso?.tipo === 'exacto' && (
        <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-[var(--status-success-bg)] border border-[var(--status-success-border)] px-2.5 py-2 text-xs text-[var(--status-success-text)]">
          <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Ya existe el puesto &quot;<strong>{aviso.puesto}</strong>&quot;. Se usara ese para evitar duplicados.</span>
        </div>
      )}

      {aviso?.tipo === 'similar' && (
        <div className="mt-1.5 rounded-md bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] px-2.5 py-2 space-y-1.5">
          <div className="flex items-start gap-1.5 text-xs text-[var(--status-warning-text)]">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>¿Quisiste decir &quot;<strong>{aviso.sugerido}</strong>&quot;?</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={usarSugerido}
              className="rounded border border-[var(--status-warning-border)] bg-[var(--bg-surface)] px-2 py-0.5 text-xs font-semibold text-[var(--status-warning-text)] hover:bg-[var(--status-warning-bg)] transition-colors">
              Usar {aviso.sugerido}
            </button>
            <button type="button" onClick={esDistinto}
              className="rounded border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-0.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-secondary)] transition-colors">
              Es distinto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
