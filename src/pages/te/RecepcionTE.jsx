/**
 * RecepcionTE.jsx — /tiempo-extra/recepcion (RH y admin): lo autorizado que RH aún debe RECIBIR, en tiempo real y agrupado por fecha del
 * tiempo extra (la más próxima primero). "Recibir y generar transporte" crea UNA solicitud de transporte por tiempo extra con los empleados
 * que pidieron transporte (cada pasajero con su horario); "Recibir todas de esta fecha" lo hace por fecha, cada una en su transacción.
 * En la recepción no se editan empleados: si algo está mal, RH devuelve con motivo. También baja el Excel de tiempo extra.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, Download, Inbox, Loader2 } from 'lucide-react';
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
import Spinner from '../../components/Spinner';
import { formatoFecha } from '../../utils/asignaciones';
import { crearFormateadorNombres } from '../../utils/nombresPersona';
import { firmaTexto } from '../../utils/tiempoExtra';
import { ymd } from '../../utils/fechas';
import { leerHistorialTE, leerSolicitudTE, recibirVarias } from '../../utils/tiempoExtraDb';
import AccionesRH from './AccionesRH';
import DescargaTE from './DescargaTE';
import DetalleTE from './DetalleTE';

const boton = 'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-semibold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50';
const suma = (lista, campo) => lista.reduce((a, t) => a + (t.resumen?.[campo] ?? 0), 0);
const fechaLarga = (f) => (f ? formatoFecha(`${f}T12:00:00`) : 'Sin fecha');

export default function RecepcionTE() {
  const { usuario } = useAuth();
  const { porFecha, lista, cargando, error } = useRecepcion();
  const { areas, nombres } = useAreas();
  const { rutas, comunidades, puntos } = useCatalogos({ empleados: false });
  const confirmar = useConfirmar();
  const toast = useToast();
  const [hoy] = useState(() => ymd());
  const [detalle, setDetalle] = useState(null); // { id, solicitud, historial, cargando }
  const [descarga, setDescarga] = useState(false);
  const [trabajando, setTrabajando] = useState(null); // fecha, 'detalle' o null
  const [resultado, setResultado] = useState(null); // { ok, fallidas, pasajeros }
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
      titulo: `Recibir ${items.length} ${items.length === 1 ? 'solicitud' : 'solicitudes'} del ${fechaLarga(fecha)}`,
      mensaje: `${suma(items, 'totalEmpleados')} empleados · ${suma(items, 'totalHoras')} horas · ${suma(items, 'totalTransporte')} con transporte (${conTransporte} ${conTransporte === 1 ? 'solicitud genera' : 'solicitudes generan'} transporte).\nCada una se recibe por separado y se crea su solicitud de transporte.`,
      textoConfirmar: `Recibir ${items.length}`,
    });
    if (!ok) return;
    setTrabajando(fecha); ocupadoRef.current = true;
    const r = await recibirVarias({ ids: items.map(t => t.id), usuario });
    const folio = (id) => items.find(t => t.id === id)?.folio ?? id;
    setResultado({ ok: r.ok.map(x => ({ folio: folio(x.id), pasajeros: x.pasajeros })), fallidas: r.fallidas.map(f => ({ folio: folio(f.id), motivo: f.motivo })) });
    setTrabajando(null); setTimeout(() => { ocupadoRef.current = false; }, 1500);
  };

  if (cargando) return <Spinner />;
  const totalPendientes = lista.length;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border-color)] pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Tiempo extra · Recursos Humanos</div>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">Recepción</h1>
            <AyudaPantalla id="recepcion" />
          </div>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {totalPendientes === 0 ? 'No hay tiempo extra autorizado por recibir.' : `${totalPendientes} autorizadas por recibir, la fecha más próxima primero. Se actualiza sola.`}
          </p>
        </div>
        <div className="max-w-xs">
          <button type="button" id="btn-descargar-te-recepcion" onClick={() => setDescarga(true)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]">
            <Download className="h-4 w-4" />Descargar tiempo extra
          </button>
          <Ayuda clave="descarga.tiempoExtra" />
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">El Excel para el proveedor de transporte (formato de rutas) está en <Link to="/rutas/rh/solicitudes" className="font-semibold text-[var(--cm-red)] hover:underline">Todas las solicitudes</Link>.</p>
        </div>
      </header>

      {error && <p role="alert" className="flex items-center gap-2 text-xs text-[var(--status-error-text)]"><AlertTriangle className="h-4 w-4" />No se pudo leer la recepción: {error.message}</p>}

      {porFecha.length === 0 && !error && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] p-10 text-center text-xs text-[var(--text-muted)]">
          <Inbox className="h-8 w-8" />Nada pendiente de recibir.
        </div>
      )}

      {porFecha.length > 0 && <Ayuda clave="recepcion.fecha" />}
      {porFecha.map(({ fecha, items }) => (
        <section key={fecha} aria-label={`Fecha ${fechaLarga(fecha)}`} className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--text-main)]">
              {fechaLarga(fecha)}
              {fecha < hoy && <span className="inline-flex items-center gap-1 rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--status-warning-text)]"><Clock className="h-3 w-3" />Fecha vencida</span>}
              <span className="rounded-full bg-[var(--bg-surface-secondary)] px-2 py-0.5 text-[11px] font-bold text-[var(--text-secondary)]">{items.length}</span>
            </h2>
            <button type="button" disabled={!!trabajando} onClick={() => recibirFecha({ fecha, items })} className={`${boton} bg-[var(--cm-red)] !py-2 !text-xs text-white hover:bg-[var(--cm-red-hover)]`}>
              {trabajando === fecha ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}Recibir todas de esta fecha ({items.length})
            </button>
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] md:block">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                <tr><th className="px-3 py-3">Folio</th><th className="px-3 py-3">Área</th><th className="px-3 py-3">Solicitante</th><th className="px-3 py-3 text-right">Empleados</th><th className="px-3 py-3 text-right">Horas</th>
                  <th className="px-3 py-3 text-right">Transporte</th><th className="px-3 py-3 text-right">Alimentos</th><th className="px-3 py-3">Firmaron</th><th className="px-3 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {items.map(t => (
                  <tr key={t.id} className="hover:bg-[var(--bg-surface-secondary)]">
                    <td className="px-3 py-2.5 font-mono font-semibold text-[var(--text-main)]">{t.folio}<InsigniasTE t={t} className="mt-1 !flex font-sans" /></td>
                    <td className="px-3 py-2.5">{nombreArea(t.areaId)}</td>
                    <td className="px-3 py-2.5">{formato.nombre(t.creadoPorNombre)}</td>
                    <td className="px-3 py-2.5 text-right">{t.resumen?.totalEmpleados ?? 0}</td>
                    <td className="px-3 py-2.5 text-right">{t.resumen?.totalHoras ?? 0}</td>
                    <td className="px-3 py-2.5 text-right">{t.resumen?.totalTransporte ?? 0}</td>
                    <td className="px-3 py-2.5 text-right">{t.resumen?.totalAlimentos ?? 0}</td>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)]">
                      <div>Aut. 1: {firmaTexto(t.aut1, (x) => formato.nombre(x)) || '—'}</div>
                      <div>Aut. 2: {firmaTexto(t.aut2, (x) => formato.nombre(x)) || '—'}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right"><button type="button" onClick={() => abrir(t)} className="cursor-pointer rounded-md border border-[var(--border-color)] px-3 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]">Revisar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 md:hidden">
            {items.map(t => (
              <li key={t.id} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-sm">
                <p className="font-mono text-sm font-bold text-[var(--text-main)]">{t.folio}</p>
                <p className="text-xs text-[var(--text-secondary)]">{nombreArea(t.areaId)} · {formato.nombre(t.creadoPorNombre)}</p>
                <InsigniasTE t={t} className="mt-1" />
                <p className="mt-1 text-xs text-[var(--text-secondary)]"><b>{t.resumen?.totalEmpleados ?? 0}</b> empleados · <b>{t.resumen?.totalHoras ?? 0}</b> h · <b>{t.resumen?.totalTransporte ?? 0}</b> con transporte · <b>{t.resumen?.totalAlimentos ?? 0}</b> con alimentos</p>
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">Aut. 1: {firmaTexto(t.aut1, (x) => formato.nombre(x)) || '—'} · Aut. 2: {firmaTexto(t.aut2, (x) => formato.nombre(x)) || '—'}</p>
                <button type="button" onClick={() => abrir(t)} className={`${boton} mt-3 w-full border border-[var(--border-color)] text-[var(--text-main)]`}>Revisar y recibir</button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {detalle && (
        <Modal isOpen onClose={() => trabajando !== 'detalle' && setDetalle(null)} title={detalle.solicitud.folio ?? 'Solicitud'} maxWidth="max-w-4xl" preventCloseOnBackdrop={trabajando === 'detalle'}>
          {detalle.cargando ? <div className="flex items-center gap-2 py-8 text-xs text-[var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Cargando…</div> : (
            <DetalleTE t={detalle.solicitud} historial={detalle.historial} area={nombreArea(detalle.solicitud.areaId)} catalogos={catalogos} formato={formato}
              acciones={(
                <>
                  <div className="w-full"><Ayuda clave="recepcion.recibir" className="!mt-0" /><Ayuda clave="recepcion.devolver" /></div>
                  <AccionesRH t={detalle.solicitud} acciones={['cancelar', 'devolver', 'recibir']} onHecho={() => setDetalle(null)} onTrabajando={enDetalle} />
                </>
              )} />
          )}
        </Modal>
      )}

      {resultado && (
        <Modal isOpen onClose={() => setResultado(null)} title="Resultado de la recepción" maxWidth="max-w-md">
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-2 font-semibold text-[var(--status-success-text)]"><CheckCircle2 className="h-4 w-4" />{resultado.ok.length} {resultado.ok.length === 1 ? 'recibida' : 'recibidas'}{resultado.ok.length ? `: ${resultado.ok.map(x => x.folio).join(', ')}` : ''}</p>
            {resultado.ok.length > 0 && <p className="text-xs text-[var(--text-secondary)]">Transporte solicitado para {resultado.ok.reduce((a, x) => a + x.pasajeros, 0)} pasajeros.</p>}
            {resultado.fallidas.length > 0 && (
              <div className="rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] p-3 text-xs text-[var(--status-error-text)]">
                <p className="mb-1 font-bold">{resultado.fallidas.length} no se pudieron recibir</p>
                <ul className="space-y-0.5">{resultado.fallidas.map(f => <li key={f.folio}><b>{f.folio}:</b> {f.motivo}</li>)}</ul>
              </div>
            )}
            <div className="flex justify-end"><button type="button" onClick={() => setResultado(null)} className={`${boton} border border-[var(--border-color)] text-[var(--text-main)]`}>Cerrar</button></div>
          </div>
        </Modal>
      )}

      {descarga && <DescargaTE isOpen onClose={() => setDescarga(false)} areas={areas} nombresArea={nombres} catalogos={catalogos} nombre={(x) => formato.nombre(x)} />}
    </div>
  );
}
