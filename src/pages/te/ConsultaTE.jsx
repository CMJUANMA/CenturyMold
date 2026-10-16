/**
 * ConsultaTE.jsx — /tiempo-extra/consulta (Aut. 2, RH y admin): todas las solicitudes menos borradores, en tiempo real.
 * Filtros (área, estatus, fechas del TE, solicitante), tarjetas (pendientes por nivel, autorizadas de la semana, horas y empleados
 * autorizados del mes por área) y exportación a Excel (hoja Resumen y hoja Detalle con una fila por empleado).
 * RH además descarga el tiempo extra autorizado (nómina y comedor) y cancela lo autorizado o ya recibido; "?abrir=ID" abre una solicitud
 * (así llega el enlace desde la pantalla de transporte).
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Eye, FileSpreadsheet } from 'lucide-react';
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
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import { Campo, Entrada, Selector } from '../../components/ui/Campo';
import EncabezadoPagina from '../../components/ui/EncabezadoPagina';
import EstadoVacio from '../../components/ui/EstadoVacio';
import { EsqueletoIndicadores, EsqueletoPagina, EsqueletoTabla } from '../../components/ui/Esqueleto';
import { Fila, Tabla, Td, Th } from '../../components/ui/Tabla';
import { Indicador } from '../../components/ui/Tarjeta';
import { ESTATUS_TE_MAP } from '../../utils/constantes';
import { formatoFecha, aFecha } from '../../utils/asignaciones';
import { crearFormateadorNombres } from '../../utils/nombresPersona';
import { ESTATUS_TE_VISIBLES, esperaDesde, filtrarSolicitudes } from '../../utils/tiempoExtra';
import { inicioDeMes, inicioDeSemana } from '../../utils/resumenInicio';
import { leerHistorialTE, leerSolicitudTE } from '../../utils/tiempoExtraDb';
import AccionesRH from './AccionesRH';
import { RUTAS } from '../../rutas';
import { BotonDescargaResumenTE } from './DescargaTE';
import DetalleTE from './DetalleTE';

const AUTORIZADAS = ['autorizada', 'procesada'];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function ConsultaTE() {
  const { planta, cargando, error } = useResumenTE();
  const { areas, nombres } = useAreas();
  const { rutas, comunidades, puntos } = useCatalogos({ empleados: false });
  const toast = useToast();
  const { esRH } = useAccesos();
  const [params, setParams] = useSearchParams();
  const [ahora] = useState(() => new Date());
  const [filtros, setFiltros] = useState(() => ({
    areaId: '', estatus: ESTATUS_TE_VISIBLES.includes(params.get('estatus')) ? params.get('estatus') : '', desde: '', hasta: '', solicitante: '',
  })); // ?estatus=... llega desde los indicadores del Inicio
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

  // Consulta es de solo lectura: lo autorizado se confirma, devuelve o cancela en "Por enviar al proveedor". Lo ya confirmado no está allí,
  // así que su cancelación (que avisa al transporte) se queda aquí.
  const accionesDeRH = (t) => {
    if (!esRH) return null;
    if (t.estatus === 'autorizada') {
      return <Boton to={RUTAS.teRecepcion} variante="contorno">Está por confirmar: ir a «Por enviar al proveedor»</Boton>;
    }
    return t.estatus === 'procesada' ? <AccionesRH t={t} acciones={['cancelar']} onHecho={() => setDetalle(null)} /> : null;
  };

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

  if (cargando) return <div className="space-y-8"><EsqueletoPagina bloques={0} /><EsqueletoIndicadores cantidad={3} className="grid gap-4 sm:grid-cols-3" /><EsqueletoTabla filas={5} columnas={7} /></div>;
  const hayFiltros = Object.values(filtros).some(Boolean);
  const limpiar = () => setFiltros({ areaId: '', estatus: '', desde: '', hasta: '', solicitante: '' });
  return (
    <div className="space-y-8">
      <EncabezadoPagina
        antetitulo="Tiempo extra"
        titulo="Todas las solicitudes"
        descripcion="Todas las solicitudes enviadas (los borradores solo los ve su creador)."
        ayuda={<AyudaPantalla id="consulta" />}
        accion={(
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {esRH && (
              <div className="max-w-xs">
                <BotonDescargaResumenTE id="btn-descargar-te-consulta" icono={FileSpreadsheet} areas={areas} nombresArea={nombres}
                  catalogos={{ rutas, comunidades, puntos }} nombre={(x) => formato.nombre(x)} />
              </div>
            )}
            <div className="max-w-xs">
              <Boton id="btn-exportar-consulta" icono={Download} estado={exportando ? 'cargando' : undefined} onClick={exportar} disabled={!!exportando || filtradas.length === 0}>
                {exportando ? `Leyendo empleados ${exportando.hechos}/${exportando.total}…` : `Exportar consulta (${filtradas.length})`}
              </Boton>
              <Ayuda>Lista de las solicitudes que ves en pantalla (con los filtros), con su estatus y quién firmó. No es el reporte de nómina.</Ayuda>
            </div>
          </div>
        )}
      />

      {error && <Aviso tono="error" titulo="No se pudieron leer las solicitudes">{error.message}. Revisa tu conexión y vuelve a abrir esta pantalla.</Aviso>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Indicador etiqueta="Pendientes por nivel" valor={`${pendientes1} · ${pendientes2}`} ayuda="Nivel 1 · Nivel 2" />
        <Indicador etiqueta="Autorizadas esta semana" valor={autorizadasSemana} ayuda="solicitudes" />
        <Indicador etiqueta="Autorizadas del mes" valor={delMes.reduce((a, x) => a + x.empleados, 0)} ayuda={`empleados · ${Math.round(delMes.reduce((a, x) => a + x.horas, 0) * 100) / 100} horas`} />
      </div>

      <section aria-label="Autorizado del mes por área" className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--text-main)]">Autorizado del mes, por área</h2>
        <Tabla etiqueta="Horas y empleados autorizados del mes, por área">
          <thead><tr><Th>Área</Th><Th derecha>Empleados</Th><Th derecha>Horas</Th></tr></thead>
          <tbody>
            {delMes.map(x => <Fila key={x.id}><Td>{x.nombre}</Td><Td derecha>{x.empleados}</Td><Td derecha mono>{x.horas}</Td></Fila>)}
          </tbody>
        </Tabla>
      </section>

      <section aria-label="Solicitudes" className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-main)]">Solicitudes</h2>
        <div className="grid gap-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end" role="group" aria-label="Filtros">
          <Campo etiqueta="Área">
            <Selector value={filtros.areaId} onChange={e => setFiltros(f => ({ ...f, areaId: e.target.value }))}>
              <option value="">Todas</option>{areas.filter(a => a.participaTE !== undefined).map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </Selector>
          </Campo>
          <Campo etiqueta="Estatus">
            <Selector value={filtros.estatus} onChange={e => setFiltros(f => ({ ...f, estatus: e.target.value }))}>
              <option value="">Todos</option>{ESTATUS_TE_VISIBLES.map(s => <option key={s} value={s}>{ESTATUS_TE_MAP[s].label}</option>)}
            </Selector>
          </Campo>
          <Campo etiqueta="Fecha del tiempo extra, desde"><Entrada type="date" value={filtros.desde} onChange={e => setFiltros(f => ({ ...f, desde: e.target.value }))} /></Campo>
          <Campo etiqueta="Hasta"><Entrada type="date" value={filtros.hasta} min={filtros.desde} onChange={e => setFiltros(f => ({ ...f, hasta: e.target.value }))} /></Campo>
          <Campo etiqueta="Solicitante"><Entrada type="search" value={filtros.solicitante} placeholder="Nombre o nómina" onChange={e => setFiltros(f => ({ ...f, solicitante: e.target.value }))} /></Campo>
          {hayFiltros && <div className="sm:col-span-2 lg:col-span-5"><Boton variante="fantasma" onClick={limpiar}>Limpiar filtros</Boton></div>}
        </div>

        {filtradas.length === 0 ? (
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
            <EstadoVacio texto={hayFiltros ? 'No hay solicitudes con esos filtros.' : 'Todavía no hay solicitudes enviadas.'} accion={hayFiltros ? { texto: 'Limpiar filtros', onClick: limpiar } : undefined} />
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Tabla etiqueta="Solicitudes de tiempo extra">
                <thead><tr><Th>Folio</Th><Th>Área</Th><Th>Solicitante</Th><Th>Fecha del TE</Th><Th derecha>Empleados</Th><Th derecha>Horas</Th><Th>Estatus</Th><Th /></tr></thead>
                <tbody>
                  {filtradas.map(t => (
                    <Fila key={t.id}>
                      <Td mono>{t.folio ?? '—'}<InsigniasTE t={t} className="mt-1 !flex font-sans" /></Td><Td>{nombreArea(t.areaId)}</Td><Td>{formato.nombre(t.creadoPorNombre ?? '')}</Td>
                      <Td className="whitespace-nowrap">{formatoFecha(`${t.fechaTE}T12:00:00`)}</Td><Td derecha>{t.resumen?.totalEmpleados ?? 0}</Td><Td derecha mono>{t.resumen?.totalHoras ?? 0}</Td>
                      <Td><BadgeEstatus estatus={t.estatus} modulo="te" /></Td>
                      <Td className="text-right"><Boton tamano="sm" icono={Eye} onClick={() => abrir(t)} aria-label={`Ver ${t.folio}`}>Ver</Boton></Td>
                    </Fila>
                  ))}
                </tbody>
              </Tabla>
            </div>
            <ul className="space-y-3 md:hidden">
              {filtradas.map(t => (
                <li key={t.id} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
                  <div className="flex items-start justify-between gap-3"><p className="font-mono text-sm font-medium text-[var(--text-main)]">{t.folio ?? '—'}</p><BadgeEstatus estatus={t.estatus} modulo="te" /></div>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{nombreArea(t.areaId)} · {formatoFecha(`${t.fechaTE}T12:00:00`)}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{formato.nombre(t.creadoPorNombre ?? '')} · {t.resumen?.totalEmpleados ?? 0} empleados · {t.resumen?.totalHoras ?? 0} h</p>
                  <InsigniasTE t={t} className="mt-2" />
                  <Boton className="mt-3 w-full" icono={Eye} onClick={() => abrir(t)} aria-label={`Ver ${t.folio}`}>Ver</Boton>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {detalle && (
        <Modal isOpen onClose={() => setDetalle(null)} title={detalle.solicitud.folio ?? 'Solicitud'} maxWidth="max-w-4xl">
          {detalle.cargando ? <EsqueletoTabla filas={3} columnas={4} /> : (
            <DetalleTE t={detalle.solicitud} historial={detalle.historial} area={nombreArea(detalle.solicitud.areaId)} catalogos={{ rutas, comunidades, puntos }} formato={formato}
              acciones={accionesDeRH(detalle.solicitud)} />
          )}
        </Modal>
      )}
    </div>
  );
}
