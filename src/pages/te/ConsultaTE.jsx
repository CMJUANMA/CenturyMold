/**
 * ConsultaTE.jsx — /tiempo-extra/consulta (Aut. 2, RH y admin): todas las solicitudes menos borradores, en tiempo real.
 * Filtros (área, estatus, fechas del TE, solicitante), tarjetas (pendientes por nivel, autorizadas de la semana, horas y empleados
 * autorizados del mes por área) y exportación a Excel (hoja Resumen y hoja Detalle con una fila por empleado).
 * RH además descarga el tiempo extra autorizado (nómina y comedor) y cancela lo autorizado o ya recibido; "?abrir=ID" abre una solicitud
 * (así llega el enlace desde la pantalla de transporte).
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Download, Eye, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useAccesos } from '../../hooks/useAccesos';
import { useAreas } from '../../hooks/useAreas';
import { useCatalogos } from '../../hooks/useCatalogos';
import { useResumenTE } from '../../hooks/useResumenTE';
import { useToast } from '../../hooks/useToast';
import Ayuda from '../../components/Ayuda';
import AyudaPantalla from '../../components/AyudaPantalla';
import BadgeEstatus from '../../components/BadgeEstatus';
import InsigniasTE from '../../components/InsigniasTE';
import Modal from '../../components/Modal';
import Spinner from '../../components/Spinner';
import { ESTATUS_TE_MAP } from '../../utils/constantes';
import { formatoFecha, aFecha } from '../../utils/asignaciones';
import { crearFormateadorNombres } from '../../utils/nombresPersona';
import { ESTATUS_TE_VISIBLES, esperaDesde, filtrarSolicitudes } from '../../utils/tiempoExtra';
import { inicioDeMes, inicioDeSemana } from '../../utils/resumenInicio';
import { leerHistorialTE, leerSolicitudTE } from '../../utils/tiempoExtraDb';
import AccionesRH from './AccionesRH';
import { BotonDescargaResumenTE } from './DescargaTE';
import DetalleTE from './DetalleTE';

const campo = 'rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--cm-red)]';
const AUTORIZADAS = ['autorizada', 'procesada'];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function Tarjeta({ titulo, valor, ayuda }) {
  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">{titulo}</h3>
      <p className="mt-2 text-3xl font-bold text-[var(--text-main)]">{valor}</p>
      {ayuda && <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{ayuda}</p>}
    </div>
  );
}

export default function ConsultaTE() {
  const { planta, cargando, error } = useResumenTE();
  const { areas, nombres } = useAreas();
  const { rutas, comunidades, puntos } = useCatalogos({ empleados: false });
  const toast = useToast();
  const { esRH } = useAccesos();
  const [params, setParams] = useSearchParams();
  const [ahora] = useState(() => new Date());
  const [filtros, setFiltros] = useState({ areaId: '', estatus: '', desde: '', hasta: '', solicitante: '' });
  const [detalle, setDetalle] = useState(null);
  const [exportando, setExportando] = useState(null); // { hechos, total }
  const formato = useMemo(() => crearFormateadorNombres([]), []);
  const nombreArea = (id) => nombres.get(id) ?? id;

  const filtradas = useMemo(() => filtrarSolicitudes(planta, filtros).sort((a, b) => esperaDesde(b) - esperaDesde(a)), [planta, filtros]);
  const semana = inicioDeSemana(ahora).getTime();
  const mes = iso(inicioDeMes(ahora));
  const pendientes1 = planta.filter(t => t.estatus === 'pendiente_aut1').length;
  const pendientes2 = planta.filter(t => t.estatus === 'pendiente_aut2').length;
  const autorizadasSemana = planta.filter(t => AUTORIZADAS.includes(t.estatus) && (aFecha(t.aut2?.fecha ?? t.fechaActualizacion)?.getTime() ?? 0) >= semana).length;
  const delMes = useMemo(() => {
    const m = new Map(areas.filter(a => a.participaTE).map(a => [a.id, { empleados: 0, horas: 0 }]));
    for (const t of planta) {
      if (!AUTORIZADAS.includes(t.estatus) || String(t.fechaTE ?? '') < mes || String(t.fechaTE ?? '') > iso(new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0))) continue;
      const g = m.get(t.areaId) ?? { empleados: 0, horas: 0 };
      g.empleados += t.resumen?.totalEmpleados ?? 0; g.horas += t.resumen?.totalHoras ?? 0;
      m.set(t.areaId, g);
    }
    return [...m].map(([id, g]) => ({ id, nombre: nombreArea(id), ...g, horas: Math.round(g.horas * 100) / 100 }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planta, areas, mes, ahora, nombres]);

  const abrir = async (t) => {
    setDetalle({ solicitud: { ...t, empleados: [] }, historial: [], cargando: true });
    try {
      const [s, h] = await Promise.all([leerSolicitudTE(t.id), leerHistorialTE(t.id).catch(() => [])]);
      setDetalle({ solicitud: s ?? t, historial: h, cargando: false });
    } catch (err) { toast.error('No se pudo abrir la solicitud: ' + err.message); setDetalle(null); }
  };

  // Enlace desde transporte: /tiempo-extra/consulta?abrir=ID abre esa solicitud una sola vez
  const idAbrir = params.get('abrir');
  useEffect(() => {
    if (!idAbrir || cargando) return;
    const t = planta.find(x => x.id === idAbrir);
    setParams({}, { replace: true });
    if (t) abrir(t); else toast.warning('Ese tiempo extra ya no está disponible.');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idAbrir, cargando]);

  const exportar = async () => {
    setExportando({ hechos: 0, total: filtradas.length });
    try {
      const completas = [];
      for (let i = 0; i < filtradas.length; i += 5) {
        const lote = await Promise.all(filtradas.slice(i, i + 5).map(t => leerSolicitudTE(t.id).then(s => s ?? { ...t, empleados: [] })));
        completas.push(...lote);
        setExportando({ hechos: completas.length, total: filtradas.length });
      }
      const { descargarConsulta } = await import('../../utils/exportarConsultaTE');
      await descargarConsulta({ solicitudes: completas, nombresArea: nombres, catalogos: { rutas, comunidades, puntos }, nombre: (x) => formato.nombre(x) });
      toast.success(`Excel descargado: ${completas.length} solicitudes.`);
    } catch (err) { toast.error('No se pudo exportar: ' + err.message, 8000); } finally { setExportando(null); }
  };

  if (cargando) return <Spinner />;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border-color)] pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Tiempo extra</div>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">Consulta de solicitudes</h1>
            <AyudaPantalla id="consulta" />
          </div>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Todas las solicitudes enviadas (los borradores solo los ve su creador).</p>
        </div>
        <div className="flex flex-wrap items-start gap-4">
          {esRH && (
            <div className="max-w-[16rem]">
            <BotonDescargaResumenTE id="btn-descargar-te-consulta" icono={FileSpreadsheet} areas={areas} nombresArea={nombres}
              catalogos={{ rutas, comunidades, puntos }} nombre={(x) => formato.nombre(x)} />
            </div>
          )}
          <div className="max-w-[16rem]">
          <button type="button" id="btn-exportar-consulta" onClick={exportar} disabled={!!exportando || filtradas.length === 0}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-50">
            {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exportando ? `Leyendo empleados ${exportando.hechos}/${exportando.total}…` : `Exportar consulta (${filtradas.length})`}
          </button>
          <Ayuda>Lista de las solicitudes que ves en pantalla (con los filtros), con su estatus y quién firmó. No es el reporte de nómina.</Ayuda>
          </div>
        </div>
      </header>

      {error && <p role="alert" className="flex items-center gap-2 text-xs text-[var(--status-error-text)]"><AlertTriangle className="h-4 w-4" />No se pudieron leer las solicitudes: {error.message}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Tarjeta titulo="Pendientes por nivel" valor={`${pendientes1} · ${pendientes2}`} ayuda="Nivel 1 · Nivel 2" />
        <Tarjeta titulo="Autorizadas esta semana" valor={autorizadasSemana} />
        <Tarjeta titulo="Autorizadas del mes" valor={delMes.reduce((a, x) => a + x.empleados, 0)} ayuda={`empleados · ${Math.round(delMes.reduce((a, x) => a + x.horas, 0) * 100) / 100} horas`} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
        <table className="w-full text-left text-xs">
          <caption className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Horas y empleados autorizados del mes, por área</caption>
          <thead className="text-[var(--text-muted)]"><tr><th className="px-4 py-2">Área</th><th className="px-4 py-2 text-right">Empleados</th><th className="px-4 py-2 text-right">Horas</th></tr></thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {delMes.map(x => <tr key={x.id}><td className="px-4 py-2">{x.nombre}</td><td className="px-4 py-2 text-right">{x.empleados}</td><td className="px-4 py-2 text-right">{x.horas}</td></tr>)}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-3" role="group" aria-label="Filtros">
        <label className="text-[11px] font-medium text-[var(--text-secondary)]">Área
          <select value={filtros.areaId} onChange={e => setFiltros(f => ({ ...f, areaId: e.target.value }))} className={`${campo} mt-0.5 block`}>
            <option value="">Todas</option>{areas.filter(a => a.participaTE !== undefined).map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-medium text-[var(--text-secondary)]">Estatus
          <select value={filtros.estatus} onChange={e => setFiltros(f => ({ ...f, estatus: e.target.value }))} className={`${campo} mt-0.5 block`}>
            <option value="">Todos</option>{ESTATUS_TE_VISIBLES.map(s => <option key={s} value={s}>{ESTATUS_TE_MAP[s].label}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-medium text-[var(--text-secondary)]">Fecha del TE desde<input type="date" value={filtros.desde} onChange={e => setFiltros(f => ({ ...f, desde: e.target.value }))} className={`${campo} mt-0.5 block`} /></label>
        <label className="text-[11px] font-medium text-[var(--text-secondary)]">hasta<input type="date" value={filtros.hasta} min={filtros.desde} onChange={e => setFiltros(f => ({ ...f, hasta: e.target.value }))} className={`${campo} mt-0.5 block`} /></label>
        <label className="text-[11px] font-medium text-[var(--text-secondary)]">Solicitante
          <input type="search" value={filtros.solicitante} placeholder="Nombre o nómina" onChange={e => setFiltros(f => ({ ...f, solicitante: e.target.value }))} className={`${campo} mt-0.5 block`} />
        </label>
        {Object.values(filtros).some(Boolean) && <button type="button" onClick={() => setFiltros({ areaId: '', estatus: '', desde: '', hasta: '', solicitante: '' })} className="cursor-pointer pb-1.5 text-[11px] font-semibold text-[var(--cm-red)] hover:underline">Limpiar</button>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
            <tr><th className="px-3 py-3">Folio</th><th className="px-3 py-3">Área</th><th className="px-3 py-3">Solicitante</th><th className="px-3 py-3">Fecha del TE</th><th className="px-3 py-3 text-right">Empleados</th><th className="px-3 py-3 text-right">Horas</th><th className="px-3 py-3">Estatus</th><th className="px-3 py-3" /></tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {filtradas.length === 0 ? <tr><td colSpan={8} className="py-10 text-center text-[var(--text-muted)]">No hay solicitudes con esos filtros.</td></tr> : filtradas.map(t => (
              <tr key={t.id} className="hover:bg-[var(--bg-surface-secondary)]">
                <td className="px-3 py-2.5 font-mono font-semibold">{t.folio ?? '—'}<InsigniasTE t={t} className="mt-1 !flex font-sans" /></td><td className="px-3 py-2.5">{nombreArea(t.areaId)}</td><td className="px-3 py-2.5">{formato.nombre(t.creadoPorNombre ?? '')}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{formatoFecha(`${t.fechaTE}T12:00:00`)}</td><td className="px-3 py-2.5 text-right">{t.resumen?.totalEmpleados ?? 0}</td><td className="px-3 py-2.5 text-right">{t.resumen?.totalHoras ?? 0}</td>
                <td className="px-3 py-2.5"><BadgeEstatus estatus={t.estatus} modulo="te" /></td>
                <td className="px-3 py-2.5 text-right"><button type="button" onClick={() => abrir(t)} className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[var(--border-color)] px-2.5 py-1.5 text-xs font-semibold hover:bg-[var(--bg-surface-hover)]" aria-label={`Ver ${t.folio}`}><Eye className="h-3 w-3" />Ver</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detalle && (
        <Modal isOpen onClose={() => setDetalle(null)} title={detalle.solicitud.folio ?? 'Solicitud'} maxWidth="max-w-4xl">
          {detalle.cargando ? <div className="flex items-center gap-2 py-8 text-xs text-[var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Cargando…</div> : (
            <DetalleTE t={detalle.solicitud} historial={detalle.historial} area={nombreArea(detalle.solicitud.areaId)} catalogos={{ rutas, comunidades, puntos }} formato={formato}
              acciones={esRH && ['autorizada', 'procesada'].includes(detalle.solicitud.estatus) ? <AccionesRH t={detalle.solicitud} acciones={['cancelar']} onHecho={() => setDetalle(null)} /> : null} />
          )}
        </Modal>
      )}
    </div>
  );
}
