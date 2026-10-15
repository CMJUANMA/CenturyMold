/**
 * PanelPersona.jsx — Panel lateral con el detalle de una persona del organigrama. Dos vistas, según quién mira (ver vistaDePersona):
 *   completa (RH, admin y la Aut. 2 hacia abajo): datos del padrón, todas sus asignaciones (rol, área, desde, hasta, motivo, quién la asignó
 *     y cuándo), el historial de la bitácora y, para quien puede asignar, Revocar (con motivo), Extender y Cambiar posición.
 *   básica (Aut. 1, y la Aut. 2 sobre otros Aut. 2): nombre, puesto, nómina, y de cada asignación vigente su rol, área y desde / hasta.
 *     Sin quién la asignó, sin fecha de asignación, sin motivo, sin historial y sin acciones.
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Clock, History, Loader2, ShieldOff, CalendarPlus, X } from 'lucide-react';
import { useConfirmar } from '../../../hooks/useConfirmar';
import { useToast } from '../../../hooks/useToast';
import {
  ESTADO_LABELS, POSICION_LABELS, ROL_OP_LABELS, VISTA_PERSONA, admitePosicion, aFecha, estadoAsignacion, formatoFecha, rolesAsignables,
} from '../../../utils/asignaciones';
import { leerHistorialAsignacion, revocarAsignacion } from '../../../utils/asignacionesDb';
import { ModalExtender, ModalPosicion } from './TabAsignaciones';
import { Avatar } from './NodosOrganigrama';
import { ESTADO_CLS, btnIcon } from './ui';

const ACCIONES = {
  asignar: 'Asignó', reasignar: 'Volvió a asignar', revocar: 'Revocó', extender: 'Cambió la vigencia', cambiar_posicion: 'Cambió la posición',
  migracion_asignacion: 'Carga del modelo anterior',
};
const detalle = (d) => d && `${d.activo ? 'activa' : 'revocada'} · ${d.desde ? formatoFecha(d.desde) : '?'} → ${d.hasta ? formatoFecha(d.hasta) : 'permanente'}${d.motivo ? ` · ${d.motivo}` : ''}`;

export default function PanelPersona({ nomina, asignaciones, empleado, conUsuario, actor, ahora, nombresArea, formato, onClose, vista = VISTA_PERSONA.COMPLETA }) {
  const completa = vista === VISTA_PERSONA.COMPLETA;
  const confirmar = useConfirmar();
  const toast = useToast();
  const [extender, setExtender] = useState(null);
  const [posicion, setPosicion] = useState(null);
  const [version, setVersion] = useState(0);
  const [historial, setHistorial] = useState({ cargando: false, filas: [], error: '', sinPermiso: false });

  const propias = useMemo(
    () => asignaciones.filter(a => String(a.nomina) === String(nomina)).map(a => ({ ...a, estado: estadoAsignacion(a, ahora) }))
      // La vista básica solo muestra lo que está en uso: nada de revocadas ni vencidas (eso es historial)
      .filter(a => completa || a.estado === 'vigente' || a.estado === 'programada')
      .sort((x, y) => ['vigente', 'programada', 'vencida', 'revocada'].indexOf(x.estado) - ['vigente', 'programada', 'vencida', 'revocada'].indexOf(y.estado)),
    [asignaciones, nomina, ahora, completa],
  );
  const asignables = rolesAsignables(actor);
  const puedeActuar = (a) => completa && asignables.includes(a.rol) && (actor.esAdmin || String(a.nomina) !== String(actor.nomina)) && a.estado !== 'revocada';
  const ids = propias.map(a => a.id).join('|');
  // La bitácora solo la leen RH, admin y la Aut. 2
  const puedeVerHistorial = completa && (actor.esRH || actor.esAut2);

  useEffect(() => {
    if (!puedeVerHistorial) return;
    let vigente = true;
    Promise.resolve().then(() => { if (vigente) setHistorial(h => ({ ...h, cargando: true, error: '' })); });
    Promise.all((ids ? ids.split('|') : []).map(leerHistorialAsignacion))
      .then(grupos => {
        if (!vigente) return;
        const filas = grupos.flat().sort((a, b) => (b.fecha?.toMillis?.() ?? 0) - (a.fecha?.toMillis?.() ?? 0));
        setHistorial({ cargando: false, filas, error: '', sinPermiso: false });
      })
      .catch(err => { if (vigente) setHistorial({ cargando: false, filas: [], error: err.message, sinPermiso: false }); });
    return () => { vigente = false; };
  }, [ids, version, puedeVerHistorial]);

  const revocar = async (a) => {
    const motivo = await confirmar({
      titulo: 'Revocar rol',
      mensaje: `¿Revocar ${ROL_OP_LABELS[a.rol]}${a.areaId ? ` · ${nombresArea.get(a.areaId) ?? a.areaId}` : ''} a ${formato.nombre(a.nombre)}? Deja de tener el permiso de inmediato; el registro se conserva.`,
      textoConfirmar: 'Revocar', peligroso: true,
      campo: { etiqueta: 'Motivo de la revocación', minLength: 3, multilinea: true },
    });
    if (!motivo) return;
    try {
      await revocarAsignacion(actor, a, motivo);
      toast.success('Rol revocado.');
      setVersion(v => v + 1);
    } catch (err) { toast.error('No se pudo revocar: ' + err.message); }
  };

  const nombre = empleado?.nombre ?? propias[0]?.nombre ?? String(nomina);
  const fechaHora = (f) => (f?.toDate ? f.toDate().toLocaleString('es-MX') : '');

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside role="dialog" aria-label={`Detalle de ${formato.nombre(nombre)}`}
        className="fixed inset-y-0 right-0 z-[95] flex w-full flex-col overflow-hidden border-l border-[var(--border-color)] bg-[var(--bg-surface)] shadow-2xl sm:w-[26rem]">
        <header className="flex items-start gap-3 border-b border-[var(--border-color)] p-4">
          <Avatar iniciales={formato.iniciales(nombre)} rol={propias.find(a => a.estado === 'vigente')?.rol ?? 'solicitante'} tamano={48} />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold leading-tight text-[var(--text-main)]">{formato.nombre(nombre)}</h2>
            <p className="text-xs text-[var(--text-secondary)]">{propias.find(a => a.puesto)?.puesto || empleado?.puesto || 'Sin puesto registrado'}</p>
            <p className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">Nómina {nomina}</p>
            {completa && <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              Área en el padrón: {empleado?.areaId ? (nombresArea.get(empleado.areaId) ?? empleado.areaId) : '—'}
              {conUsuario === false && <span className="ml-2 inline-flex items-center gap-1 text-[var(--status-warning-text)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--status-warning-text)]" />Sin usuario</span>}
            </p>}
          </div>
          <button type="button" onClick={onClose} className={btnIcon} aria-label="Cerrar panel"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <section aria-label="Asignaciones">
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Asignaciones ({propias.length})</h3>
            {propias.length === 0 ? <p className="text-xs text-[var(--text-muted)]">Sin asignaciones.</p> : (
              <ul className="space-y-2">
                {propias.map(a => (
                  <li key={a.id} className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--text-main)]">
                        {ROL_OP_LABELS[a.rol]}{a.areaId ? ` · ${nombresArea.get(a.areaId) ?? a.areaId}` : ' · toda la planta'}
                        {a.posicion && <span className="ml-1.5 text-[10px] font-semibold text-[var(--text-secondary)]">({POSICION_LABELS[a.posicion]})</span>}
                      </span>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${ESTADO_CLS[a.estado]}`}>{ESTADO_LABELS[a.estado]}</span>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-[var(--text-secondary)]">
                      <Clock className="h-3 w-3" />{formatoFecha(a.desde)} → {aFecha(a.hasta) ? formatoFecha(a.hasta) : 'permanente'}
                    </p>
                    {completa && a.motivo && <p className="mt-0.5 text-[var(--text-secondary)]">Motivo: {a.motivo}</p>}
                    {completa && (
                      <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                        Asignada por {a.asignadoPor?.nombre || '—'}{a.fechaAsignacion ? ` · ${fechaHora(a.fechaAsignacion)}` : ''}
                      </p>
                    )}
                    {puedeActuar(a) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {admitePosicion(a.rol) && a.estado !== 'vencida' && (
                          <button type="button" onClick={() => setPosicion(a)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]">
                            <ArrowLeftRight className="h-3 w-3" />Cambiar posición
                          </button>
                        )}
                        <button type="button" onClick={() => setExtender(a)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]">
                          <CalendarPlus className="h-3 w-3" />Extender
                        </button>
                        <button type="button" onClick={() => revocar(a)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[var(--status-error-border)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] font-semibold text-[var(--status-error-text)] hover:bg-[var(--status-error-bg)]">
                          <ShieldOff className="h-3 w-3" />Revocar
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {puedeVerHistorial && (
            <section aria-label="Historial">
              <h3 className="mb-2 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]"><History className="h-3 w-3" />Historial</h3>
              {historial.cargando ? (
                <p className="flex items-center gap-2 text-xs text-[var(--text-muted)]"><Loader2 className="h-3 w-3 animate-spin" />Cargando…</p>
              ) : historial.error ? (
                <p className="text-xs text-[var(--status-error-text)]">{historial.error}</p>
              ) : historial.filas.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">Sin movimientos registrados.</p>
              ) : (
                <ul className="space-y-2">
                  {historial.filas.map(f => (
                    <li key={f.id} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-[var(--text-main)]">{ACCIONES[f.accion] ?? f.accion}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">{fechaHora(f.fecha)}</span>
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        {ROL_OP_LABELS[f.despues?.rol] ?? ''}{f.despues?.areaId ? ` · ${nombresArea.get(f.despues.areaId) ?? f.despues.areaId}` : ''} · por {f.porNombre || f.porUid}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">{detalle(f.despues)}</div>
                      {f.despues?.motivoRevocacion && <div className="text-[10px] text-[var(--text-muted)]">Motivo de la revocación: {f.despues.motivoRevocacion}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </aside>

      {posicion && (
        <ModalPosicion asignacion={posicion} actor={actor} onClose={() => setPosicion(null)}
          onGuardado={() => { toast.success('Posición actualizada.'); setVersion(v => v + 1); }} />
      )}
      {extender && (
        <ModalExtender asignacion={extender} actor={actor} onClose={() => setExtender(null)}
          onGuardado={() => { toast.success('Vigencia actualizada.'); setVersion(v => v + 1); }} />
      )}
    </>
  );
}
