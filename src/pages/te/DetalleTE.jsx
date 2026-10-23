/**
 * DetalleTE.jsx — Detalle de una solicitud de tiempo extra (Mis solicitudes, bandejas de autorización y consulta):
 * encabezado (folio, área, solicitante, fecha, motivo, comentario), motivo de devolución, tabla de empleados con su ruta,
 * resumen por bloque de horario y línea de tiempo del historial. Las acciones (props.acciones) las pone quien lo usa.
 */
import { useEffect, useState } from 'react';
import { Bus, Route } from 'lucide-react';
import BadgeEstatus from '../../components/BadgeEstatus';
import InsigniasTE from '../../components/InsigniasTE';
import MotivosTE, { AvisoProgramManager } from '../../components/MotivosTE';
import { useAccesos } from '../../hooks/useAccesos';
import Aviso from '../../components/ui/Aviso';
import Insignia from '../../components/ui/Insignia';
import { Fila, Tabla, Td, Th } from '../../components/ui/Tabla';
import { ACCIONES_TE_LABELS } from '../../utils/constantes';
import { formatoFecha } from '../../utils/asignaciones';
import { etiquetaBloque12, horasEnTexto12 } from '../../utils/horas';
import { motivosDeTE, motivoTextoEmpleado } from '../../utils/motivosTE';
import { calcularHoras, esExtension, firmaTexto, quienDevolvio, resumenTE, textoRuta, textoRutas } from '../../utils/tiempoExtra';
import { leerTransporteDeTE } from '../../utils/tiempoExtraDb';
import { quienCancelo } from '../../utils/cancelacion';

const fechaHora = (f) => (f?.toDate ? f.toDate().toLocaleString('es-MX') : '');

const Titulo = ({ children }) => <h3 className="mb-3 text-sm font-semibold text-[var(--text-main)]">{children}</h3>;

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
      <Titulo>Solicitud de transporte</Titulo>
      {!id ? <p className="text-[var(--text-secondary)]">Sin empleados con transporte: RH no generó solicitud de transporte.</p>
        : sol === undefined ? <p className="text-[var(--text-muted)]">Consultando el transporte…</p>
        : sol === null ? <p className="text-[var(--text-secondary)]">Transporte solicitado (no se pudo leer su estatus).</p> : (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] p-3">
            <Bus className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
            <BadgeEstatus estatus={sol.estatus} />
            <span className="text-[var(--text-main)]">{sol.totalPasajeros ?? 0} pasajeros · fecha de servicio {sol.fechaServicio ? formatoFecha(`${sol.fechaServicio}T12:00:00`) : '—'}</span>
            {sol.requiereRevision && <Insignia tono="aviso">Requiere revisión: avisar al proveedor</Insignia>}
          </div>
        )}
    </section>
  );
}

export default function DetalleTE({ t, historial = [], area, catalogos, formato, acciones, avisoTransporte = false }) {
  const empleados = t.empleados ?? [];
  const { esRH, esAut2, esNomina } = useAccesos();
  const variosMotivos = motivosDeTE(t).length > 1;
  const bloques = Object.entries(resumenTE(empleados).porBloque);
  const nombre = (x) => formato?.nombre(x) ?? x;
  const devolucionPrevia = t.devolucion && t.estatus !== 'devuelta';

  return (
    <div className="space-y-6 text-sm">
      {t.estatus === 'devuelta' && t.devolucion && (
        <Aviso tono="aviso" titulo={`Devuelta por ${quienDevolvio(t.devolucion.nivel)} · ${nombre(t.devolucion.nombre)}`}>{t.devolucion.motivo}</Aviso>
      )}
      {devolucionPrevia && (
        <Aviso tono="aviso" titulo={`Fue devuelta antes (${quienDevolvio(t.devolucion.nivel)}, ${nombre(t.devolucion.nombre)})`}>{t.devolucion.motivo}</Aviso>
      )}
      {t.estatus === 'cancelada' && (t.motivoCancelacion || t.canceladaPor) && (
        <Aviso tono="info" titulo={quienCancelo(t, nombre) ?? 'Cancelada'}>{t.motivoCancelacion ? `Motivo: ${t.motivoCancelacion}` : ''}</Aviso>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] p-5 sm:grid-cols-4">
        {[['Estatus', <span key="e" className="flex flex-wrap items-center gap-1.5"><BadgeEstatus estatus={t.estatus} modulo="te" /><InsigniasTE t={t} /></span>], ['Tipo', esExtension(t) ? 'Extensión de turno' : 'Turno extra / día extra'], ['Área', area], ['Solicitante', nombre(t.creadoPorNombre ?? '—')],
          ['Fecha', t.fechaTE ? formatoFecha(`${t.fechaTE}T12:00:00`) : '—'], ['Motivo', motivosDeTE(t).some(m => m.nombre) ? <MotivosTE key="m" t={t} /> : '—'],
          ['Empleados', t.resumen?.totalEmpleados ?? 0], ['Horas', t.resumen?.totalHoras ?? 0], ['Con transporte', t.resumen?.totalTransporte ?? 0],
          ['Con alimentos', t.resumen?.totalAlimentos ?? 0], ['Firmó nivel 1', firmaTexto(t.aut1, nombre) || '—'], ['Firmó nivel 2', firmaTexto(t.aut2, nombre) || '—'],
          ...(t.recibidaPor ? [['Confirmada por RH', `${nombre(t.recibidaPor.nombre)} · ${fechaHora(t.fechaRecepcion)}`]] : [])].map(([k, v]) => (
          <div key={k}><dt className="text-xs text-[var(--text-muted)]">{k}</dt><dd className="mt-0.5 font-medium text-[var(--text-main)]">{v}</dd></div>
        ))}
        {t.comentario && <div className="col-span-full"><dt className="text-xs text-[var(--text-muted)]">Comentario</dt><dd className="mt-0.5 text-[var(--text-main)]">{t.comentario}</dd></div>}
      </dl>

      {(esAut2 || esNomina || esRH) && <AvisoProgramManager t={t} />}

      {avisoTransporte && ['pendiente_aut1', 'pendiente_aut2', 'autorizada'].includes(t.estatus) && (
        <Aviso tono="info">Al quedar autorizada, RH la confirmará y generará la solicitud de transporte de los empleados que lo pidieron.</Aviso>
      )}

      <TransporteDeTE t={t} />

      {(t.desgloseRutas?.length ?? 0) > 0 && (
        <section aria-label="Rutas">
          <Aviso tono={t.rutasDistintas > 1 ? 'aviso' : 'neutro'} icon={Route} titulo={textoRutas(t.desgloseRutas)}>
            <ul className="mt-1 space-y-0.5">
              {t.desgloseRutas.map(g => (
                <li key={g.rutaId}><b className="font-medium">{g.nombre}</b>: {g.empleados} {g.empleados === 1 ? 'empleado' : 'empleados'} ({g.llegada} de llegada · {g.salida} de salida)</li>
              ))}
            </ul>
            {t.rutasDistintas > 1 && (
              <div className="mt-3 rounded-md border border-[var(--status-warning-border)] bg-[var(--bg-surface)] p-3 text-[var(--text-main)]">
                <p className="text-xs font-medium text-[var(--status-warning-text)]">¿Por qué se necesita más de una ruta?</p>
                <p className="mt-1">{t.justificacionRutas || 'Sin justificación.'}</p>
                <p className="mt-2 text-xs text-[var(--status-warning-text)]">Cada ruta adicional representa un costo extra. Los autorizadores decidirán si se aprueba.</p>
              </div>
            )}
          </Aviso>
        </section>
      )}

      <section aria-label="Horarios">
        <Titulo>Empleados por horario</Titulo>
        <div className="flex flex-wrap gap-2">
          {bloques.length === 0 && <span className="text-[var(--text-muted)]">Sin empleados.</span>}
          {bloques.map(([b, n]) => <Insignia key={b} sinIcono>{horasEnTexto12(b)}: {n} {n === 1 ? 'empleado' : 'empleados'}</Insignia>)}
        </div>
      </section>

      <section>
        <Titulo>Empleados ({empleados.length})</Titulo>
        <div className="hidden md:block">
          <Tabla etiqueta="Empleados de la solicitud">
            <thead>
              <tr><Th>Nómina</Th><Th>Nombre</Th><Th>Puesto</Th><Th>Horario</Th><Th derecha>Horas</Th><Th>Alimentos</Th>{variosMotivos && <Th>Motivo</Th>}<Th>Ruta / comunidad / punto</Th></tr>
            </thead>
            <tbody>
              {empleados.map(e => (
                <Fila key={e.nomina}>
                  <Td mono>{e.nomina}</Td><Td>{nombre(e.nombre)}</Td><Td className="text-[var(--text-secondary)]">{e.puesto}</Td>
                  <Td className="whitespace-nowrap">{etiquetaBloque12(e)}</Td><Td derecha mono>{calcularHoras(e.horaEntrada, e.horaSalida)}</Td>
                  <Td>{e.alimentos ? 'Sí' : 'No'}</Td>{variosMotivos && <Td className="min-w-40 whitespace-normal text-[var(--text-secondary)]">{motivoTextoEmpleado(t, e) || '—'}</Td>}<Td>{textoRuta(e, catalogos ?? {})}</Td>
                </Fila>
              ))}
              {empleados.length === 0 && <tr><td colSpan={variosMotivos ? 8 : 7} className="px-4 py-6 text-center text-[var(--text-muted)]">Sin empleados.</td></tr>}
            </tbody>
          </Tabla>
        </div>
        <ul className="space-y-2 md:hidden">
          {empleados.map(e => (
            <li key={e.nomina} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
              <p className="font-medium text-[var(--text-main)]">{nombre(e.nombre)}</p>
              <p className="text-xs text-[var(--text-secondary)]"><span className="font-mono">{e.nomina}</span> · {e.puesto}</p>
              <p className="mt-1 text-[var(--text-main)]">{etiquetaBloque12(e)} · <b className="font-medium">{calcularHoras(e.horaEntrada, e.horaSalida)} h</b>{e.alimentos ? ' · Alimentos' : ''}</p>
              {variosMotivos && <p className="text-xs text-[var(--text-secondary)]">Motivo: {motivoTextoEmpleado(t, e) || '—'}</p>}
              <p className="text-[var(--text-secondary)]">{textoRuta(e, catalogos ?? {})}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <Titulo>Historial</Titulo>
        {historial.length === 0 ? <p className="text-[var(--text-muted)]">Todavía sin movimientos: un borrador no tiene historial hasta enviarse.</p> : (
          <ol className="space-y-3 border-l border-[var(--border-color)] pl-5">
            {historial.map(h => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[1.6rem] top-1.5 h-2 w-2 rounded-full bg-[var(--text-secondary)]" aria-hidden="true" />
                <p className="font-medium text-[var(--text-main)]">{ACCIONES_TE_LABELS[h.accion] ?? h.accion}</p>
                <p className="text-xs text-[var(--text-secondary)]">{nombre(h.porNombre || h.porNomina)} · {fechaHora(h.fecha)}</p>
                {h.comentario && <p className="text-xs text-[var(--text-secondary)]">“{h.comentario}”</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {acciones && <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-color)] pt-4">{acciones}</div>}
    </div>
  );
}
