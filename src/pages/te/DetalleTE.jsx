/**
 * DetalleTE.jsx — Detalle de una solicitud de tiempo extra (Mis solicitudes, bandejas de autorización y consulta):
 * encabezado (folio, área, solicitante, fecha, motivo, comentario), motivo de devolución, tabla de empleados con su ruta,
 * resumen por bloque de horario y línea de tiempo del historial. Las acciones (props.acciones) las pone quien lo usa.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, Bus } from 'lucide-react';
import BadgeEstatus from '../../components/BadgeEstatus';
import { ACCIONES_TE_LABELS } from '../../utils/constantes';
import { formatoFecha } from '../../utils/asignaciones';
import { calcularHoras, etiquetaBloque, firmaTexto, quienDevolvio, resumenTE, textoRuta } from '../../utils/tiempoExtra';
import { leerTransporteDeTE } from '../../utils/tiempoExtraDb';

const fechaHora = (f) => (f?.toDate ? f.toDate().toLocaleString('es-MX') : '');

/** Solicitud de transporte que RH generó al recibir este tiempo extra, con su estatus (se lee al abrir el detalle) */
function TransporteDeTE({ t }) {
  const id = t.solicitudTransporteId;
  const [lectura, setLectura] = useState({ id: null, sol: null });
  useEffect(() => {
    if (!id) return;
    let vigente = true;
    leerTransporteDeTE(id).then(sol => { if (vigente) setLectura({ id, sol }); });
    return () => { vigente = false; };
  }, [id]);

  if (t.estatus !== 'procesada' && !(t.estatus === 'cancelada' && id)) return null;
  const sol = lectura.id === id ? lectura.sol : undefined;
  return (
    <section aria-label="Transporte">
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Solicitud de transporte</h3>
      {!id ? <p className="text-[var(--text-secondary)]">Sin empleados con transporte: RH no generó solicitud de transporte.</p>
        : sol === undefined ? <p className="text-[var(--text-muted)]">Consultando el transporte…</p>
        : sol === null ? <p className="text-[var(--text-secondary)]">Transporte solicitado (no se pudo leer su estatus).</p> : (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] p-3">
            <Bus className="h-4 w-4 text-[var(--text-muted)]" />
            <BadgeEstatus estatus={sol.estatus} />
            <span className="text-[var(--text-main)]">{sol.totalPasajeros ?? 0} pasajeros · fecha de servicio {sol.fechaServicio ? formatoFecha(`${sol.fechaServicio}T12:00:00`) : '—'}</span>
            {sol.requiereRevision && <span className="rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--status-warning-text)]">Requiere revisión: avisar al proveedor</span>}
          </div>
        )}
    </section>
  );
}

export default function DetalleTE({ t, historial = [], area, catalogos, formato, acciones, avisoTransporte = false }) {
  const empleados = t.empleados ?? [];
  const bloques = Object.entries(resumenTE(empleados).porBloque);
  const nombre = (x) => formato?.nombre(x) ?? x;
  const devolucionPrevia = t.devolucion && t.estatus !== 'devuelta';

  return (
    <div className="space-y-5 text-xs">
      {t.estatus === 'devuelta' && t.devolucion && (
        <div role="alert" className="rounded-lg border-2 border-[var(--status-error-border)] bg-[var(--status-error-bg)] p-4 text-[var(--status-error-text)]">
          <p className="flex items-center gap-2 text-sm font-bold"><AlertTriangle className="h-4 w-4" />Devuelta por {quienDevolvio(t.devolucion.nivel)} · {nombre(t.devolucion.nombre)}</p>
          <p className="mt-1 text-sm">{t.devolucion.motivo}</p>
        </div>
      )}
      {devolucionPrevia && (
        <div className="rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 text-[var(--status-warning-text)]">
          <p className="font-bold">Fue devuelta antes ({quienDevolvio(t.devolucion.nivel)}, {nombre(t.devolucion.nombre)})</p>
          <p className="mt-0.5">{t.devolucion.motivo}</p>
        </div>
      )}
      {t.estatus === 'cancelada' && t.motivoCancelacion && <p className="rounded-md bg-[var(--bg-surface-secondary)] p-3 text-[var(--text-secondary)]">Motivo de la cancelación{t.canceladaPor ? ` (RH, ${nombre(t.canceladaPor.nombre)})` : ''}: {t.motivoCancelacion}</p>}

      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] p-4 sm:grid-cols-4">
        {[['Estatus', <BadgeEstatus key="e" estatus={t.estatus} modulo="te" />], ['Área', area], ['Solicitante', nombre(t.creadoPorNombre ?? '—')],
          ['Fecha', t.fechaTE ? formatoFecha(`${t.fechaTE}T12:00:00`) : '—'], ['Motivo', t.motivo || '—'],
          ['Empleados', t.resumen?.totalEmpleados ?? 0], ['Horas', t.resumen?.totalHoras ?? 0], ['Con transporte', t.resumen?.totalTransporte ?? 0],
          ['Con alimentos', t.resumen?.totalAlimentos ?? 0], ['Firmó nivel 1', firmaTexto(t.aut1, nombre) || '—'], ['Firmó nivel 2', firmaTexto(t.aut2, nombre) || '—'],
          ...(t.recibidaPor ? [['Recibida por RH', `${nombre(t.recibidaPor.nombre)} · ${fechaHora(t.fechaRecepcion)}`]] : [])].map(([k, v]) => (
          <div key={k}><dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{k}</dt><dd className="mt-0.5 font-semibold text-[var(--text-main)]">{v}</dd></div>
        ))}
        {t.comentario && <div className="col-span-full"><dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Comentario</dt><dd className="mt-0.5 text-[var(--text-main)]">{t.comentario}</dd></div>}
      </dl>

      {avisoTransporte && ['pendiente_aut1', 'pendiente_aut2', 'autorizada'].includes(t.estatus) && (
        <p className="rounded-md border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 py-2 text-[var(--status-info-text)]">
          Al quedar autorizada, RH la recibirá y generará la solicitud de transporte de los empleados que lo pidieron.
        </p>
      )}

      <TransporteDeTE t={t} />

      <section aria-label="Horarios">
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Empleados por horario</h3>
        <div className="flex flex-wrap gap-2">
          {bloques.length === 0 && <span className="text-[var(--text-muted)]">Sin empleados.</span>}
          {bloques.map(([b, n]) => (
            <span key={b} className="rounded-full border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-3 py-1 text-[11px] font-semibold text-[var(--text-main)]">{b}: {n} {n === 1 ? 'empleado' : 'empleados'}</span>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Empleados ({empleados.length})</h3>
        <div className="hidden overflow-x-auto rounded-lg border border-[var(--border-color)] md:block">
          <table className="w-full text-left">
            <thead className="bg-[var(--bg-surface-secondary)] text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              <tr><th className="px-3 py-2">Nómina</th><th className="px-3 py-2">Nombre</th><th className="px-3 py-2">Puesto</th><th className="px-3 py-2">Horario</th><th className="px-3 py-2 text-right">Horas</th><th className="px-3 py-2">Alimentos</th><th className="px-3 py-2">Ruta / comunidad / punto</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {empleados.map(e => (
                <tr key={e.nomina}>
                  <td className="px-3 py-1.5 font-mono">{e.nomina}</td><td className="px-3 py-1.5">{nombre(e.nombre)}</td><td className="px-3 py-1.5 text-[var(--text-secondary)]">{e.puesto}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">{etiquetaBloque(e)}</td><td className="px-3 py-1.5 text-right">{calcularHoras(e.horaEntrada, e.horaSalida)}</td>
                  <td className="px-3 py-1.5">{e.alimentos ? 'Sí' : 'No'}</td><td className="px-3 py-1.5">{textoRuta(e, catalogos ?? {})}</td>
                </tr>
              ))}
              {empleados.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-center text-[var(--text-muted)]">Sin empleados.</td></tr>}
            </tbody>
          </table>
        </div>
        <ul className="space-y-2 md:hidden">
          {empleados.map(e => (
            <li key={e.nomina} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
              <p className="font-bold text-[var(--text-main)]">{nombre(e.nombre)}</p>
              <p className="text-[10px] text-[var(--text-secondary)]"><span className="font-mono">{e.nomina}</span> · {e.puesto}</p>
              <p className="mt-1 text-[var(--text-main)]">{etiquetaBloque(e)} · <b>{calcularHoras(e.horaEntrada, e.horaSalida)} h</b>{e.alimentos ? ' · Alimentos' : ''}</p>
              <p className="text-[var(--text-secondary)]">{textoRuta(e, catalogos ?? {})}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Historial</h3>
        {historial.length === 0 ? <p className="text-[var(--text-muted)]">Todavía sin movimientos: un borrador no tiene historial hasta enviarse.</p> : (
          <ol className="space-y-2 border-l-2 border-[var(--border-color)] pl-4">
            {historial.map(h => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-[var(--cm-red)]" />
                <p className="font-semibold text-[var(--text-main)]">{ACCIONES_TE_LABELS[h.accion] ?? h.accion}</p>
                <p className="text-[var(--text-secondary)]">{nombre(h.porNombre || h.porNomina)} · {fechaHora(h.fecha)}</p>
                {h.comentario && <p className="text-[var(--text-secondary)]">“{h.comentario}”</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {acciones && <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-color)] pt-3">{acciones}</div>}
    </div>
  );
}
