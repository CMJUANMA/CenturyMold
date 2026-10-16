/**
 * RecepcionTE.jsx — "Por enviar al proveedor" (/tiempo-extra/recepcion; RH y admin; antes "Recepción"): lo autorizado que RH aún debe CONFIRMAR,
 * en tiempo real y agrupado por fecha del tiempo extra (la más próxima primero). "Confirmar y generar transporte" crea UNA solicitud de transporte
 * por tiempo extra con los empleados que pidieron transporte (cada pasajero con su horario); "Confirmar todas las de esta fecha" lo hace por
 * fecha, cada una en su transacción. Si nadie lleva transporte, el botón dice "Confirmar (sin transporte)".
 * Aquí no se editan empleados: si algo está mal, RH devuelve con motivo. También baja el resumen de horas extra (mismo panel que Consulta).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronRight, Clock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAreas } from '../../hooks/useAreas';
import { useCatalogos } from '../../hooks/useCatalogos';
import { useConfirmar } from '../../hooks/useConfirmar';
import { useRecepcion } from '../../hooks/useRecepcion';
import { useToast } from '../../hooks/useToast';
import Ayuda from '../../components/Ayuda';
import AyudaPantalla from '../../components/AyudaPantalla';
import InsigniasTE from '../../components/InsigniasTE';
import Modal from '../../components/Modal';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import EncabezadoPagina from '../../components/ui/EncabezadoPagina';
import EstadoVacio from '../../components/ui/EstadoVacio';
import { EsqueletoPagina, EsqueletoTabla } from '../../components/ui/Esqueleto';
import Insignia from '../../components/ui/Insignia';
import { Fila, Tabla, Td, Th } from '../../components/ui/Tabla';
import { formatoFecha } from '../../utils/asignaciones';
import { crearFormateadorNombres } from '../../utils/nombresPersona';
import { NOMBRE_POR_ENVIAR, firmaTexto, mensajeConfirmada } from '../../utils/tiempoExtra';
import { ymd } from '../../utils/fechas';
import { leerHistorialTE, leerSolicitudTE, recibirVarias } from '../../utils/tiempoExtraDb';
import AccionesRH from './AccionesRH';
import { BotonDescargaResumenTE } from './DescargaTE';
import BotonFormatoRutas from '../../components/FormatoRutas';
import { RUTAS } from '../../rutas';
import DetalleTE from './DetalleTE';

const suma = (lista, campo) => lista.reduce((a, t) => a + (t.resumen?.[campo] ?? 0), 0);
const fechaLarga = (f) => (f ? formatoFecha(`${f}T12:00:00`) : 'Sin fecha');

/** Flujo de una solicitud con el paso actual marcado */
const PASOS_FLUJO = ['Solicitud', 'Aut. 1', 'Aut. 2', NOMBRE_POR_ENVIAR, 'Formato de rutas'];
function FlujoPasos() {
  return (
    <ol aria-label="Pasos de la solicitud" className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
      {PASOS_FLUJO.map((p, i) => {
        const actual = p === NOMBRE_POR_ENVIAR;
        return (
          <li key={p} className="flex items-center gap-1.5" aria-current={actual ? 'step' : undefined}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden="true" />}
            <span className={actual ? 'rounded-md bg-[var(--text-main)] px-3 py-1.5 text-[var(--bg-surface)]' : 'rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-[var(--text-secondary)]'}>{p}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function RecepcionTE() {
  const { usuario } = useAuth();
  const { porFecha, lista, cargando, error } = useRecepcion();
  const { areas, nombres } = useAreas();
  const { rutas, comunidades, puntos } = useCatalogos({ empleados: false });
  const confirmar = useConfirmar();
  const toast = useToast();
  const [hoy] = useState(() => ymd());
  const [detalle, setDetalle] = useState(null); // { id, solicitud, historial, cargando }
  const [trabajando, setTrabajando] = useState(null); // fecha, 'detalle' o null
  const [resultado, setResultado] = useState(null); // { ok: [{ folio, fecha, pasajeros }], fallidas }
  const vistas = useRef(new Set());
  const ocupadoRef = useRef(false);
  const formato = useMemo(() => crearFormateadorNombres([]), []);
  const nombreArea = (id) => nombres.get(id) ?? id;
  const catalogos = useMemo(() => ({ rutas, comunidades, puntos }), [rutas, comunidades, puntos]);

  // Aviso cuando algo desaparece de la lista sin que lo haya recibido yo (otra persona de RH la recibió, la devolvió o la canceló)
  useEffect(() => {
    if (cargando) return;
    const ahoraIds = new Set(lista.map(t => t.id));
    const quitadas = [...vistas.current].filter(id => !ahoraIds.has(id));
    vistas.current = ahoraIds;
    if (quitadas.length && !ocupadoRef.current) {
      toast.warning(quitadas.length === 1 ? 'Una solicitud ya no está pendiente: alguien más la recibió, la devolvió o la canceló.' : `${quitadas.length} solicitudes ya no están pendientes: alguien más las atendió.`, 7000);
      if (detalle && quitadas.includes(detalle.id)) setDetalle(null);
    }
  }, [lista, cargando, detalle, toast]);

  const abrir = async (t) => {
    setDetalle({ id: t.id, solicitud: { ...t, empleados: [] }, historial: [], cargando: true });
    try {
      const [s, h] = await Promise.all([leerSolicitudTE(t.id), leerHistorialTE(t.id).catch(() => [])]);
      setDetalle(d => (d?.id === t.id ? { ...d, solicitud: s ?? t, historial: h, cargando: false } : d));
    } catch (err) { toast.error(`No se pudo abrir la solicitud: ${err.message}`); setDetalle(null); }
  };

  // Mientras RH responde desde el detalle, que la solicitud desaparezca de la lista no es un aviso
  const enDetalle = (v) => {
    setTrabajando(v ? 'detalle' : null);
    if (v) ocupadoRef.current = true; else setTimeout(() => { ocupadoRef.current = false; }, 1500);
  };

  const recibirFecha = async ({ fecha, items }) => {
    const conTransporte = items.filter(t => (t.resumen?.totalTransporte ?? 0) > 0).length;
    const ok = await confirmar({
      titulo: `Confirmar ${items.length} ${items.length === 1 ? 'solicitud' : 'solicitudes'} del ${fechaLarga(fecha)}`,
      mensaje: `${suma(items, 'totalEmpleados')} empleados · ${suma(items, 'totalHoras')} horas · ${suma(items, 'totalTransporte')} con transporte (${conTransporte} ${conTransporte === 1 ? 'solicitud genera' : 'solicitudes generan'} transporte).\nCada una se confirma por separado y se crea su solicitud de transporte.`,
      textoConfirmar: `Confirmar ${items.length}`,
    });
    if (!ok) return;
    setTrabajando(fecha); ocupadoRef.current = true;
    const r = await recibirVarias({ ids: items.map(t => t.id), usuario });
    const folio = (id) => items.find(t => t.id === id)?.folio ?? id;
    setResultado({ ok: r.ok.map(x => ({ folio: folio(x.id), fecha, pasajeros: x.pasajeros })), fallidas: r.fallidas.map(f => ({ folio: folio(f.id), motivo: f.motivo })) });
    setTrabajando(null); setTimeout(() => { ocupadoRef.current = false; }, 1500);
  };

  if (cargando) return <div className="space-y-8"><EsqueletoPagina bloques={0} /><EsqueletoTabla filas={3} columnas={7} /></div>;
  const totalPendientes = lista.length;
  return (
    <div className="space-y-8">
      <EncabezadoPagina
        antetitulo="Tiempo extra · Recursos Humanos"
        titulo={NOMBRE_POR_ENVIAR}
        descripcion={totalPendientes === 0 ? 'No hay tiempo extra autorizado por confirmar.' : `${totalPendientes} ${totalPendientes === 1 ? 'autorizada por confirmar' : 'autorizadas por confirmar'}, la fecha más próxima primero. Se actualiza sola.`}
        ayuda={<AyudaPantalla id="recepcion" />}
        accion={(
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <BotonFormatoRutas id="btn-formato-rutas-recepcion" />
            <div className="max-w-xs">
              <BotonDescargaResumenTE id="btn-descargar-te-recepcion" areas={areas} nombresArea={nombres} catalogos={catalogos} nombre={(x) => formato.nombre(x)} />
            </div>
          </div>
        )}
      />

      <section aria-label="Qué es esta pantalla" className="space-y-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
        <p className="text-sm text-[var(--text-main)]">
          Estas solicitudes ya tienen las dos autorizaciones. Al confirmar, se crea su solicitud de transporte para que aparezca en el Formato de rutas del proveedor. Si algo está mal, puedes devolverla al solicitante.
        </p>
        <FlujoPasos />
      </section>

      {error && <Aviso tono="error" titulo="No se pudo leer la lista">{error.message}. Revisa tu conexión y vuelve a abrir esta pantalla.</Aviso>}

      {porFecha.length === 0 && !error && (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
          <EstadoVacio titulo="Nada por confirmar" texto="Cuando una solicitud tenga sus dos autorizaciones, aparecerá aquí." accion={{ texto: 'Ver todas las solicitudes', to: RUTAS.teConsulta }} />
        </div>
      )}

      {porFecha.length > 0 && <Ayuda clave="recepcion.fecha" className="-mt-4" />}
      {porFecha.map(({ fecha, items }, indice) => (
        <section key={fecha} aria-label={`Fecha ${fechaLarga(fecha)}`} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex flex-wrap items-center gap-3 text-lg font-semibold text-[var(--text-main)]">
              {fechaLarga(fecha)}
              {fecha < hoy && <Insignia tono="aviso" icono={Clock}>Fecha vencida</Insignia>}
              <Insignia sinIcono>{items.length}</Insignia>
            </h2>
            {/* La primera fecha (la más próxima) lleva el botón principal; las demás, en contorno */}
            <Boton variante={indice === 0 ? 'primario' : 'contorno'} icono={CheckCircle2} estado={trabajando === fecha ? 'cargando' : undefined} disabled={!!trabajando} onClick={() => recibirFecha({ fecha, items })}>
              Confirmar todas las de esta fecha ({items.length})
            </Boton>
          </div>

          <div className="hidden md:block">
            <Tabla etiqueta={`Solicitudes del ${fechaLarga(fecha)}`}>
              <thead>
                <tr><Th>Folio</Th><Th>Área</Th><Th>Solicitante</Th><Th derecha>Empleados</Th><Th derecha>Horas</Th><Th derecha>Transporte</Th><Th derecha>Alimentos</Th><Th>Firmaron</Th><Th /></tr>
              </thead>
              <tbody>
                {items.map(t => (
                  <Fila key={t.id}>
                    <Td mono>{t.folio}<InsigniasTE t={t} className="mt-1 !flex font-sans" /></Td>
                    <Td>{nombreArea(t.areaId)}</Td>
                    <Td>{formato.nombre(t.creadoPorNombre)}</Td>
                    <Td derecha>{t.resumen?.totalEmpleados ?? 0}</Td>
                    <Td derecha mono>{t.resumen?.totalHoras ?? 0}</Td>
                    <Td derecha>{t.resumen?.totalTransporte ?? 0}</Td>
                    <Td derecha>{t.resumen?.totalAlimentos ?? 0}</Td>
                    <Td className="text-[var(--text-secondary)]">
                      <div>Aut. 1: {firmaTexto(t.aut1, (x) => formato.nombre(x)) || '—'}</div>
                      <div>Aut. 2: {firmaTexto(t.aut2, (x) => formato.nombre(x)) || '—'}</div>
                    </Td>
                    <Td className="text-right"><Boton tamano="sm" onClick={() => abrir(t)}>Revisar</Boton></Td>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
          </div>
          <ul className="space-y-3 md:hidden">
            {items.map(t => (
              <li key={t.id} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
                <p className="font-mono text-sm font-medium text-[var(--text-main)]">{t.folio}</p>
                <p className="text-xs text-[var(--text-secondary)]">{nombreArea(t.areaId)} · {formato.nombre(t.creadoPorNombre)}</p>
                <InsigniasTE t={t} className="mt-1" />
                <p className="mt-2 text-xs text-[var(--text-secondary)]"><b className="font-medium">{t.resumen?.totalEmpleados ?? 0}</b> empleados · <b className="font-medium">{t.resumen?.totalHoras ?? 0}</b> h · <b className="font-medium">{t.resumen?.totalTransporte ?? 0}</b> con transporte · <b className="font-medium">{t.resumen?.totalAlimentos ?? 0}</b> con alimentos</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Aut. 1: {firmaTexto(t.aut1, (x) => formato.nombre(x)) || '—'} · Aut. 2: {firmaTexto(t.aut2, (x) => formato.nombre(x)) || '—'}</p>
                <Boton className="mt-3 w-full" onClick={() => abrir(t)}>Revisar y confirmar</Boton>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {detalle && (
        <Modal isOpen onClose={() => trabajando !== 'detalle' && setDetalle(null)} title={detalle.solicitud.folio ?? 'Solicitud'} maxWidth="max-w-4xl" preventCloseOnBackdrop={trabajando === 'detalle'}>
          {detalle.cargando ? <EsqueletoTabla filas={3} columnas={4} /> : (
            <DetalleTE t={detalle.solicitud} historial={detalle.historial} area={nombreArea(detalle.solicitud.areaId)} catalogos={catalogos} formato={formato}
              acciones={(
                <>
                  <div className="w-full"><Ayuda clave="recepcion.recibir" className="!mt-0" /><Ayuda clave="recepcion.devolver" /></div>
                  <AccionesRH t={detalle.solicitud} acciones={['cancelar', 'devolver', 'recibir']} onHecho={() => setDetalle(null)} onTrabajando={enDetalle}
                    onConfirmada={(t, r) => setResultado({ ok: [{ folio: t.folio, fecha: t.fechaTE, pasajeros: r.pasajeros }], fallidas: [] })} />
                </>
              )} />
          )}
        </Modal>
      )}

      {resultado && (
        <Modal isOpen onClose={() => setResultado(null)} title={resultado.ok.length ? 'Listo' : 'No se pudo confirmar'} maxWidth="max-w-md">
          <div className="space-y-4 text-sm">
            {resultado.ok.length > 0 && (
              <div className="space-y-3">
                <Aviso tono="exito">{resultado.ok.length} {resultado.ok.length === 1 ? 'confirmada' : 'confirmadas'}: {resultado.ok.map(x => x.folio).join(', ')}</Aviso>
                {[...new Set(resultado.ok.filter(x => x.pasajeros > 0).map(x => x.fecha))].map(fecha => (
                  <p key={fecha} className="text-[var(--text-main)]">{mensajeConfirmada({ fecha, pasajeros: 1 })}</p>
                ))}
                {resultado.ok.some(x => !(x.pasajeros > 0)) && <p className="text-[var(--text-main)]">{mensajeConfirmada({ pasajeros: 0 })}{resultado.ok.some(x => x.pasajeros > 0) ? ` (${resultado.ok.filter(x => !(x.pasajeros > 0)).map(x => x.folio).join(', ')})` : ''}</p>}
                {resultado.ok.some(x => x.pasajeros > 0) && (
                  <p className="text-xs text-[var(--text-secondary)]">Para el proveedor, baja el «Formato de rutas (proveedor)» desde esta misma pantalla.</p>
                )}
                {resultado.ok.some(x => x.pasajeros > 0) && (
                  <Boton to={RUTAS.transporteSolicitudes} variante="fantasma" onClick={() => setResultado(null)}>Ver en Solicitudes de transporte</Boton>
                )}
              </div>
            )}
            {resultado.fallidas.length > 0 && (
              <Aviso tono="error" titulo={`${resultado.fallidas.length} no se pudieron confirmar`}>
                <ul className="space-y-0.5">{resultado.fallidas.map(f => <li key={f.folio}><b className="font-medium">{f.folio}:</b> {f.motivo}</li>)}</ul>
              </Aviso>
            )}
            <div className="flex justify-end"><Boton onClick={() => setResultado(null)}>Cerrar</Boton></div>
          </div>
        </Modal>
      )}

    </div>
  );
}
