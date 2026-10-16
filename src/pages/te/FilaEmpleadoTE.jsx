/**
 * FilaEmpleadoTE.jsx — Un empleado del tiempo extra. En escritorio es una fila compacta (datos · entrada · salida · horas ·
 * alimentos · transporte); en celular se vuelve una tarjeta con controles de 44 px.
 *
 * Turno extra: entrada y salida en los bloques de horario; transporte de Llegada y de Salida, las dos marcadas por defecto.
 * Extensión de turno (el empleado ya está en la planta): el tiempo extra empieza cuando termina su turno normal (según su turno de nómina;
 * si RH aún no lo configura, se elige a mano) y se elige hasta qué hora se queda; solo lleva transporte de Salida.
 * Con transporte pide ruta → comunidad → punto en cascada, precargados del padrón con confirmación (igual que el formulario de rutas);
 * al guardar se recuerdan en el padrón.
 */
import { AlertCircle, CheckCircle2, MapPin, Trash2 } from 'lucide-react';
import Boton from '../../components/ui/Boton';
import { Selector } from '../../components/ui/Campo';
import { CASILLA } from '../../components/ui/estilos';
import { opcionesVigentes } from '../../utils/activo';
import { HORAS_ENTRADA_TE, HORAS_SALIDA_TE, TIPOS_TE, calcularHoras, salidasPosteriores } from '../../utils/tiempoExtra';

// Selectores de la fila: 44 px en celular y 36 px en escritorio, donde la fila es compacta
const SEL = 'md:!min-h-9 !py-1.5';
const etiqueta = 'mb-1 block text-xs font-medium text-[var(--text-muted)] lg:hidden';
export const COLUMNAS_FILA = 'lg:grid lg:grid-cols-[2rem_minmax(0,2.2fr)_7rem_7rem_4rem_6rem_8rem_2.5rem] lg:items-center lg:gap-3';

export default function FilaEmpleadoTE({ e, tipo = TIPOS_TE.TURNO_EXTRA, finFijo = false, rutas, comunidades, puntos, seleccionado, aviso, error, onSeleccionar, onCambio, onQuitar }) {
  const extension = tipo === TIPOS_TE.EXTENSION;
  const horas = calcularHoras(e.horaEntrada, e.horaSalida);
  const pedirConfirmar = e.transporte && e.necesitaConfirmar && !e.confirmada;
  const cambiar = (parche) => onCambio(e.nomina, parche);
  const posteriores = extension ? salidasPosteriores(e.horaEntrada) : [];

  return (
    <div className={`relative rounded-lg border bg-[var(--bg-surface)] p-4 lg:p-3 ${error ? 'border-[var(--status-error-text)]' : 'border-[var(--border-color)]'}`}>
      <div className={`space-y-3 ${COLUMNAS_FILA} lg:space-y-0`}>
        <label className="absolute left-1 top-1 flex h-11 w-11 cursor-pointer items-center justify-center lg:static lg:h-8 lg:w-8">
          <input type="checkbox" checked={seleccionado} onChange={() => onSeleccionar(e.nomina)} aria-label={`Seleccionar a ${e.nombre}`} className={CASILLA} />
        </label>
        <div className="min-w-0 pl-9 pr-10 lg:pl-0 lg:pr-0">
          <p className="truncate text-sm font-medium text-[var(--text-main)]">{e.nombre}</p>
          <p className="truncate text-xs text-[var(--text-secondary)]">
            <span className="font-mono">{e.nomina}</span>{e.puesto ? ` · ${e.puesto}` : ''}{e.turnoNomina ? ` · Turno ${e.turnoNomina}` : ''}
          </p>
          {aviso && <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[var(--status-warning-text)]"><AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{aviso}</p>}
        </div>
        <div className="grid grid-cols-6 items-end gap-3 lg:contents">
          <div className="col-span-3 lg:col-span-1">
            {extension ? (
              <>
                <label className={etiqueta} htmlFor={`ent-${e.nomina}`}>Termina su turno</label>
                {finFijo ? (
                  <p id={`ent-${e.nomina}`} className="py-2 text-sm font-medium text-[var(--text-main)]" aria-label={`Su turno termina a las ${e.horaEntrada} (${e.nombre})`}>{e.horaEntrada || '—'}</p>
                ) : (
                  <Selector id={`ent-${e.nomina}`} className={SEL} value={e.horaEntrada} onChange={ev => cambiar({ horaEntrada: ev.target.value, horaSalida: '' })} aria-label={`Fin de turno de ${e.nombre}`}>
                    <option value="">Fin de turno…</option>{HORAS_SALIDA_TE.map(h => <option key={h} value={h}>{h}</option>)}
                  </Selector>
                )}
              </>
            ) : (
              <>
                <label className={etiqueta} htmlFor={`ent-${e.nomina}`}>Entrada</label>
                <Selector id={`ent-${e.nomina}`} className={SEL} value={e.horaEntrada} onChange={ev => cambiar({ horaEntrada: ev.target.value })} aria-label={`Entrada de ${e.nombre}`}>
                  <option value="">—</option>{HORAS_ENTRADA_TE.map(h => <option key={h} value={h}>{h}</option>)}
                </Selector>
              </>
            )}
          </div>
          <div className="col-span-3 lg:col-span-1">
            <label className={etiqueta} htmlFor={`sal-${e.nomina}`}>{extension ? 'Se queda hasta' : 'Salida'}</label>
            <Selector id={`sal-${e.nomina}`} className={SEL} value={e.horaSalida} onChange={ev => cambiar({ horaSalida: ev.target.value })} aria-label={`${extension ? 'Hora hasta la que se queda' : 'Salida de'} ${e.nombre}`}
              disabled={extension && posteriores.length === 0}>
              <option value="">—</option>{(extension ? posteriores : HORAS_SALIDA_TE).map(h => <option key={h} value={h}>{h}</option>)}
            </Selector>
          </div>
          <div className="col-span-2 lg:col-span-1">
            <span className={etiqueta}>Horas</span>
            <p className="py-2 text-center font-mono text-sm font-medium text-[var(--text-main)]" aria-label={`Horas de ${e.nombre}`}>{horas || '—'}</p>
          </div>
          <label className="col-span-2 flex min-h-11 cursor-pointer items-center gap-2 text-sm text-[var(--text-main)] lg:col-span-1 lg:min-h-0 lg:justify-center lg:text-xs">
            <input type="checkbox" checked={e.alimentos} onChange={ev => cambiar({ alimentos: ev.target.checked })} className={CASILLA} />Alimentos
          </label>
          <div className="col-span-2 flex flex-col text-sm text-[var(--text-main)] lg:col-span-1 lg:gap-1 lg:text-xs">
            <label className={`flex min-h-11 items-center gap-2 lg:min-h-0 ${extension ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
              <input type="checkbox" checked={!!e.transporteLlegada} disabled={extension} aria-label={`Transporte de llegada de ${e.nombre}`}
                onChange={ev => cambiar({ transporteLlegada: ev.target.checked })} className={CASILLA} />Llegada
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 lg:min-h-0">
              <input type="checkbox" checked={!!e.transporteSalida} aria-label={`Transporte de salida de ${e.nombre}`}
                onChange={ev => cambiar({ transporteSalida: ev.target.checked })} className={CASILLA} />Salida
            </label>
            {extension && <span className="text-xs leading-tight text-[var(--text-muted)]">Ya se encuentra en la planta</span>}
          </div>
        </div>
        <button type="button" onClick={() => onQuitar(e.nomina)} aria-label={`Quitar a ${e.nombre}`} title="Quitar de la solicitud"
          className="absolute right-1 top-1 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--status-error-bg)] hover:text-[var(--status-error-text)] lg:static lg:h-9 lg:w-9 lg:justify-self-end">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {e.transporte && (
        <div className="mt-4 space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />Ruta de transporte</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Selector className={SEL} aria-label={`Ruta de ${e.nombre}`} disabled={pedirConfirmar} value={e.rutaId} onChange={ev => cambiar({ rutaId: ev.target.value, comunidadId: '', puntoReunionId: '' })}>
              <option value="">Ruta…</option>{opcionesVigentes(rutas, e.rutaId).map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </Selector>
            <Selector className={SEL} aria-label={`Comunidad de ${e.nombre}`} disabled={pedirConfirmar || !e.rutaId} value={e.comunidadId} onChange={ev => cambiar({ comunidadId: ev.target.value, puntoReunionId: '' })}>
              <option value="">Comunidad…</option>{opcionesVigentes(comunidades.filter(c => c.rutaId === e.rutaId), e.comunidadId).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Selector>
            <Selector className={SEL} aria-label={`Punto de reunión de ${e.nombre}`} disabled={pedirConfirmar || !e.comunidadId} value={e.puntoReunionId} onChange={ev => cambiar({ puntoReunionId: ev.target.value })}>
              <option value="">Punto de reunión…</option>{opcionesVigentes(puntos.filter(p => p.comunidadId === e.comunidadId), e.puntoReunionId).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </Selector>
          </div>
          {pedirConfirmar && (
            <div className="flex flex-col justify-between gap-3 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 text-[var(--status-warning-text)] sm:flex-row sm:items-center">
              <span className="flex items-center gap-2 text-sm font-medium"><AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />Ya tiene ruta en el padrón. ¿Es correcta?</span>
              <span className="flex shrink-0 gap-2">
                <Boton tamano="sm" variante="contorno" onClick={() => cambiar({ necesitaConfirmar: false })}>Modificar</Boton>
                <Boton tamano="sm" variante="secundario" icono={CheckCircle2} onClick={() => cambiar({ confirmada: true })}>Confirmar</Boton>
              </span>
            </div>
          )}
          {e.confirmada && e.rutaId && <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--status-success-text)]"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />Ruta confirmada.</p>}
          {!pedirConfirmar && !e.necesitaConfirmar && (!e.rutaId || !e.comunidadId || !e.puntoReunionId) && (
            <p className="text-xs text-[var(--text-secondary)]">Elige ruta, comunidad y punto; se guardarán en el padrón del empleado.</p>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-3 flex items-start gap-1.5 text-xs font-medium text-[var(--status-error-text)]"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{error}</p>}
    </div>
  );
}
