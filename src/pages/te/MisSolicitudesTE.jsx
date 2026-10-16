/**
 * MisSolicitudesTE.jsx — /tiempo-extra/mis-solicitudes: mis solicitudes de tiempo extra con pestañas por estatus y contadores,
 * detalle (línea de tiempo, empleados, motivo de devolución) y las acciones que corresponden a cada estatus:
 *   borrador → Continuar o Eliminar · devuelta → Corregir y reenviar · pendiente → Cancelar (con motivo) · autorizada → solo consulta.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Eye, FilePlus, Loader2, Pencil, Trash2, XCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useResumenTE } from '../../hooks/useResumenTE';
import { useAreas } from '../../hooks/useAreas';
import { useConfirmar } from '../../hooks/useConfirmar';
import { useToast } from '../../hooks/useToast';
import AyudaPantalla from '../../components/AyudaPantalla';
import BadgeEstatus from '../../components/BadgeEstatus';
import InsigniasTE from '../../components/InsigniasTE';
import Modal from '../../components/Modal';
import Spinner from '../../components/Spinner';
import { formatoFecha } from '../../utils/asignaciones';
import { PESTANAS_TE, nivelEnTexto, textoRecibida } from '../../utils/tiempoExtra';
import { useCatalogos } from '../../hooks/useCatalogos';
import DetalleTE from './DetalleTE';
import { cancelarSolicitud, eliminarBorrador, leerHistorialTE, leerSolicitudTE } from '../../utils/tiempoExtraDb';

const cuando = (t) => t.fechaActualizacion?.toMillis?.() ?? t.fechaCreacion?.toMillis?.() ?? 0;
const btn = 'inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors';

export default function MisSolicitudesTE() {
  const { usuario } = useAuth();
  const { propias, cargando, error } = useResumenTE();
  const { nombres } = useAreas();
  const { rutas, comunidades, puntos } = useCatalogos({ empleados: false });
  const navigate = useNavigate();
  const confirmar = useConfirmar();
  const toast = useToast();
  const [params] = useSearchParams();
  // ?pestana=... llega desde las tarjetas del Inicio
  const [pestana, setPestana] = useState(() => (PESTANAS_TE.some(p => p.id === params.get('pestana')) ? params.get('pestana') : 'borrador'));
  const [detalle, setDetalle] = useState(null); // { solicitud, historial, cargando }
  const [ocupadoId, setOcupadoId] = useState(null);

  const porPestana = useMemo(() => Object.fromEntries(PESTANAS_TE.map(p => [p.id, propias.filter(t => p.estatus.includes(t.estatus)).sort((a, b) => cuando(b) - cuando(a))])), [propias]);
  // Si la pestaña elegida está vacía y hay otra con datos (p. ej. recién enviada), se muestra la primera con datos
  const activa = PESTANAS_TE.find(p => p.id === pestana) ?? PESTANAS_TE[0];
  const lista = porPestana[activa.id] ?? [];

  const abrirDetalle = async (t) => {
    setDetalle({ solicitud: { ...t, empleados: [] }, historial: [], cargando: true });
    try {
      const [s, h] = await Promise.all([leerSolicitudTE(t.id), leerHistorialTE(t.id).catch(() => [])]);
      setDetalle({ solicitud: s ?? t, historial: h, cargando: false });
    } catch (err) { toast.error('No se pudo abrir el detalle: ' + err.message); setDetalle(null); }
  };

  const eliminar = async (t) => {
    if (!await confirmar({ titulo: 'Eliminar borrador', mensaje: 'Se borrará el borrador y sus empleados. No se puede deshacer.', textoConfirmar: 'Eliminar', peligroso: true })) return;
    setOcupadoId(t.id);
    try { await eliminarBorrador(t.id); toast.success('Borrador eliminado.'); } catch (err) { toast.error('No se pudo eliminar: ' + err.message); } finally { setOcupadoId(null); }
  };
  const cancelar = async (t) => {
    const motivo = await confirmar({
      titulo: 'Cancelar solicitud', mensaje: `¿Cancelar ${t.folio ?? 'la solicitud'}? Ya no seguirá en autorización.`, textoConfirmar: 'Cancelar solicitud', peligroso: true,
      campo: { etiqueta: 'Motivo de la cancelación', minLength: 3, multilinea: true },
    });
    if (!motivo) return;
    setOcupadoId(t.id);
    try { await cancelarSolicitud({ id: t.id, usuario, motivo }); toast.success('Solicitud cancelada.'); setDetalle(null); } catch (err) { toast.error('No se pudo cancelar: ' + err.message); } finally { setOcupadoId(null); }
  };

  const acciones = (t) => {
    const cargandoFila = ocupadoId === t.id;
    if (t.estatus === 'borrador') return (
      <>
        <button type="button" disabled={cargandoFila} onClick={() => navigate(`/tiempo-extra/${t.id}/editar`)} className={`${btn} border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]`}><Pencil className="h-3 w-3" />Continuar</button>
        <button type="button" disabled={cargandoFila} onClick={() => eliminar(t)} className={`${btn} border-[var(--status-error-border)] bg-[var(--bg-surface)] text-[var(--status-error-text)] hover:bg-[var(--status-error-bg)]`}><Trash2 className="h-3 w-3" />Eliminar</button>
      </>
    );
    if (t.estatus === 'devuelta') return (
      <>
        <button type="button" disabled={cargandoFila} onClick={() => navigate(`/tiempo-extra/${t.id}/editar`)} className={`${btn} border-[var(--cm-red)] bg-[var(--cm-red)] text-white hover:bg-[var(--cm-red-hover)]`}><Pencil className="h-3 w-3" />Corregir y reenviar</button>
        <button type="button" disabled={cargandoFila} onClick={() => cancelar(t)} className={`${btn} border-[var(--status-error-border)] bg-[var(--bg-surface)] text-[var(--status-error-text)] hover:bg-[var(--status-error-bg)]`}><XCircle className="h-3 w-3" />Cancelar</button>
      </>
    );
    if (['pendiente_aut1', 'pendiente_aut2'].includes(t.estatus)) return (
      <button type="button" disabled={cargandoFila} onClick={() => cancelar(t)} className={`${btn} border-[var(--status-error-border)] bg-[var(--bg-surface)] text-[var(--status-error-text)] hover:bg-[var(--status-error-bg)]`}><XCircle className="h-3 w-3" />Cancelar</button>
    );
    return null; // autorizada, procesada, cancelada: solo consulta
  };

  if (cargando) return <Spinner />;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border-color)] pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Tiempo extra</div>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">Mis solicitudes</h1>
            <AyudaPantalla id="misSolicitudes" />
          </div>
        </div>
        <Link to="/tiempo-extra/nueva" className="inline-flex items-center gap-1.5 rounded-md bg-[var(--cm-red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--cm-red-hover)]"><FilePlus className="h-3.5 w-3.5" />Solicitar tiempo extra</Link>
      </header>

      {error && <p role="alert" className="flex items-center gap-2 text-xs text-[var(--status-error-text)]"><AlertTriangle className="h-4 w-4" />No se pudieron leer tus solicitudes: {error.message}</p>}

      <nav className="-mb-px flex gap-0 overflow-x-auto border-b border-[var(--border-color)]" aria-label="Estatus">
        {PESTANAS_TE.map(p => {
          const n = porPestana[p.id].length;
          const resaltar = p.id === 'devuelta' && n > 0;
          return (
            <button key={p.id} type="button" onClick={() => setPestana(p.id)} aria-current={activa.id === p.id ? 'page' : undefined}
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${activa.id === p.id ? 'border-[var(--cm-red)] text-[var(--accent-text)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}`}>
              {p.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${resaltar ? 'border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]' : 'bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)]'}`}>{n}</span>
            </button>
          );
        })}
      </nav>

      <div className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Folio</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Área</th><th className="px-4 py-3 text-right">Empleados</th>
                <th className="px-4 py-3 text-right">Horas</th><th className="px-4 py-3 text-right">Transporte</th><th className="px-4 py-3">Estatus</th><th className="px-4 py-3">Nivel</th><th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {lista.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-[var(--text-muted)]">No hay solicitudes en "{activa.label}".</td></tr>
              ) : lista.map(t => (
                <tr key={t.id} className="hover:bg-[var(--bg-surface-secondary)]">
                  <td className="px-4 py-2.5 font-mono font-semibold text-[var(--text-main)]">{t.folio ?? <span className="font-sans font-normal italic text-[var(--text-muted)]">Borrador</span>}<InsigniasTE t={t} className="mt-1 !flex font-sans" /></td>
                  <td className="px-4 py-2.5">{t.fechaTE ? formatoFecha(`${t.fechaTE}T12:00:00`) : '—'}</td>
                  <td className="px-4 py-2.5">{nombres.get(t.areaId) ?? t.areaNombre ?? t.areaId}</td>
                  <td className="px-4 py-2.5 text-right">{t.resumen?.totalEmpleados ?? 0}</td>
                  <td className="px-4 py-2.5 text-right">{t.resumen?.totalHoras ?? 0}</td>
                  <td className="px-4 py-2.5 text-right">{t.resumen?.totalTransporte ?? 0}</td>
                  <td className="px-4 py-2.5"><BadgeEstatus estatus={t.estatus} modulo="te" />{t.estatus === 'procesada' && <p className="mt-1 text-[10px] text-[var(--text-secondary)]">{textoRecibida(t)}</p>}</td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)]">{nivelEnTexto(t.estatus)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button type="button" onClick={() => abrirDetalle(t)} className={`${btn} border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]`} aria-label={`Ver detalle ${t.folio ?? 'del borrador'}`}><Eye className="h-3 w-3" />Ver</button>
                      {acciones(t)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detalle && (
        <Modal isOpen onClose={() => setDetalle(null)} title={detalle.solicitud.folio ?? 'Borrador'} maxWidth="max-w-4xl">
          {detalle.cargando ? <div className="flex items-center gap-2 py-8 text-xs text-[var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Cargando…</div> : (
            <DetalleTE t={detalle.solicitud} historial={detalle.historial} area={nombres.get(detalle.solicitud.areaId) ?? detalle.solicitud.areaId}
              catalogos={{ rutas, comunidades, puntos }} acciones={acciones(detalle.solicitud)} avisoTransporte />
          )}
        </Modal>
      )}
    </div>
  );
}
