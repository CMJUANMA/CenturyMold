/**
 * FilaEmpleadoTE.jsx — Un empleado del tiempo extra. En escritorio es una fila compacta (datos · entrada · salida · horas ·
 * alimentos · transporte); en celular se vuelve una tarjeta. Con Transporte marcado (por defecto) pide ruta → comunidad → punto
 * en cascada, precargados del padrón con confirmación (igual que el formulario de rutas); al guardar se recuerdan en el padrón.
 */
import { AlertCircle, CheckCircle2, MapPin, Trash2 } from 'lucide-react';
import { opcionesVigentes } from '../../utils/activo';
import { HORAS_ENTRADA_TE, HORAS_SALIDA_TE, calcularHoras } from '../../utils/tiempoExtra';

const sel = 'w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-main)] focus:border-[var(--cm-red)] focus:outline-none disabled:opacity-50';
const etiqueta = 'mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] lg:hidden';
export const COLUMNAS_FILA = 'lg:grid lg:grid-cols-[1.5rem_minmax(0,2.2fr)_7rem_7rem_4rem_5.5rem_6rem_2rem] lg:items-center lg:gap-3';

export default function FilaEmpleadoTE({ e, rutas, comunidades, puntos, seleccionado, aviso, error, onSeleccionar, onCambio, onQuitar }) {
  const horas = calcularHoras(e.horaEntrada, e.horaSalida);
  const pedirConfirmar = e.transporte && e.necesitaConfirmar && !e.confirmada;
  const cambiar = (parche) => onCambio(e.nomina, parche);

  return (
    <div className={`relative rounded-lg border bg-[var(--bg-surface)] p-3 ${error ? 'border-[var(--status-error-border)]' : 'border-[var(--border-color)]'}`}>
      <div className={`space-y-2 ${COLUMNAS_FILA} lg:space-y-0`}>
        <input type="checkbox" checked={seleccionado} onChange={() => onSeleccionar(e.nomina)} aria-label={`Seleccionar a ${e.nombre}`} className="h-3.5 w-3.5 accent-[var(--cm-red)]" />
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-[var(--text-main)]">{e.nombre}</p>
          <p className="truncate text-[10px] text-[var(--text-secondary)]">
            <span className="font-mono">{e.nomina}</span>{e.puesto ? ` · ${e.puesto}` : ''}{e.turnoNomina ? ` · Turno ${e.turnoNomina}` : ''}
          </p>
          {aviso && <p className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-[var(--status-warning-text)]"><AlertCircle className="h-3 w-3 shrink-0" />{aviso}</p>}
        </div>
        <div className="grid grid-cols-6 items-end gap-2 lg:contents">
          <div className="col-span-3 lg:col-span-1">
            <label className={etiqueta} htmlFor={`ent-${e.nomina}`}>Entrada</label>
            <select id={`ent-${e.nomina}`} value={e.horaEntrada} onChange={ev => cambiar({ horaEntrada: ev.target.value })} className={sel} aria-label={`Entrada de ${e.nombre}`}>
              <option value="">—</option>{HORAS_ENTRADA_TE.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div className="col-span-3 lg:col-span-1">
            <label className={etiqueta} htmlFor={`sal-${e.nomina}`}>Salida</label>
            <select id={`sal-${e.nomina}`} value={e.horaSalida} onChange={ev => cambiar({ horaSalida: ev.target.value })} className={sel} aria-label={`Salida de ${e.nombre}`}>
              <option value="">—</option>{HORAS_SALIDA_TE.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div className="col-span-2 lg:col-span-1">
            <span className={etiqueta}>Horas</span>
            <p className="py-1.5 text-center text-sm font-bold text-[var(--text-main)]" aria-label={`Horas de ${e.nombre}`}>{horas || '—'}</p>
          </div>
          <label className="col-span-2 flex cursor-pointer items-center gap-1.5 pb-1.5 text-xs text-[var(--text-main)] lg:col-span-1 lg:justify-center lg:pb-0">
            <input type="checkbox" checked={e.alimentos} onChange={ev => cambiar({ alimentos: ev.target.checked })} className="h-3.5 w-3.5 accent-[var(--cm-red)]" />Alimentos
          </label>
          <label className="col-span-2 flex cursor-pointer items-center gap-1.5 pb-1.5 text-xs text-[var(--text-main)] lg:col-span-1 lg:justify-center lg:pb-0">
            <input type="checkbox" checked={e.transporte} onChange={ev => cambiar(ev.target.checked ? { transporte: true } : { transporte: false, necesitaConfirmar: false, confirmada: false })}
              className="h-3.5 w-3.5 accent-[var(--cm-red)]" />Transporte
          </label>
        </div>
        <button type="button" onClick={() => onQuitar(e.nomina)} aria-label={`Quitar a ${e.nombre}`}
          className="absolute right-2 top-2 cursor-pointer rounded-md p-1.5 lg:static lg:justify-self-end text-[var(--status-error-text)] hover:bg-[var(--status-error-bg)]"><Trash2 className="h-4 w-4" /></button>
      </div>

      {e.transporte && (
        <div className="mt-3 space-y-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"><MapPin className="h-3 w-3" />Ruta de transporte</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select aria-label={`Ruta de ${e.nombre}`} disabled={pedirConfirmar} value={e.rutaId} onChange={ev => cambiar({ rutaId: ev.target.value, comunidadId: '', puntoReunionId: '' })} className={sel}>
              <option value="">Ruta…</option>{opcionesVigentes(rutas, e.rutaId).map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
            <select aria-label={`Comunidad de ${e.nombre}`} disabled={pedirConfirmar || !e.rutaId} value={e.comunidadId} onChange={ev => cambiar({ comunidadId: ev.target.value, puntoReunionId: '' })} className={sel}>
              <option value="">Comunidad…</option>{opcionesVigentes(comunidades.filter(c => c.rutaId === e.rutaId), e.comunidadId).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <select aria-label={`Punto de reunión de ${e.nombre}`} disabled={pedirConfirmar || !e.comunidadId} value={e.puntoReunionId} onChange={ev => cambiar({ puntoReunionId: ev.target.value })} className={sel}>
              <option value="">Punto de reunión…</option>{opcionesVigentes(puntos.filter(p => p.comunidadId === e.comunidadId), e.puntoReunionId).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          {pedirConfirmar && (
            <div className="flex flex-col justify-between gap-2 rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-[var(--status-warning-text)] sm:flex-row sm:items-center">
              <span className="flex items-center gap-2 text-[11px] font-medium"><AlertCircle className="h-4 w-4 shrink-0" />Ya tiene ruta en el padrón. ¿Es correcta?</span>
              <span className="flex shrink-0 gap-2">
                <button type="button" onClick={() => cambiar({ necesitaConfirmar: false })} className="cursor-pointer rounded border border-[var(--status-warning-border)] px-2 py-1 text-[10px] font-bold uppercase hover:opacity-80">Modificar</button>
                <button type="button" onClick={() => cambiar({ confirmada: true })} className="inline-flex cursor-pointer items-center gap-1 rounded bg-[var(--status-warning-text)] px-2 py-1 text-[10px] font-bold uppercase text-white hover:opacity-90"><CheckCircle2 className="h-3 w-3" />Confirmar</button>
              </span>
            </div>
          )}
          {e.confirmada && e.rutaId && <p className="flex items-center gap-1 text-[11px] font-medium text-[var(--status-success-text)]"><CheckCircle2 className="h-3.5 w-3.5" />Ruta confirmada.</p>}
          {!pedirConfirmar && !e.necesitaConfirmar && (!e.rutaId || !e.comunidadId || !e.puntoReunionId) && (
            <p className="text-[11px] text-[var(--text-secondary)]">Elige ruta, comunidad y punto; se guardarán en el padrón del empleado.</p>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-[11px] font-semibold text-[var(--status-error-text)]">{error}</p>}
    </div>
  );
}
