/**
 * ReportesNomina.jsx — /nomina/reportes (Nóminas, RH y admin): el FORMATO DE AUTORIZACIÓN DE TIEMPO EXTRA semanal, un área por tarjeta.
 * Toma solo el tiempo extra autorizado por Aut. 2 (autorizada o procesada) de la semana ISO elegida (lunes a domingo; por defecto la última completa)
 * o de un rango libre de hasta 7 días. Cada tarjeta trae empleados, horas y estado (Sin revisar / Ajustada / Firmada) con «Revisar» (tabla editable)
 * y «Descargar» (Excel listo para imprimir). Los ajustes viven aparte (ajustesNomina) y nunca modifican las solicitudes.
 */
import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, ClipboardCheck, Download, FileSpreadsheet, Lock } from 'lucide-react';
import { useAccesos } from '../../hooks/useAccesos';
import { useAjustesNomina } from '../../hooks/useAjustesNomina';
import { useAreas } from '../../hooks/useAreas';
import { useAuth } from '../../hooks/useAuth';
import { useCatalogos } from '../../hooks/useCatalogos';
import { useResumenTE } from '../../hooks/useResumenTE';
import { useToast } from '../../hooks/useToast';
import { RUTAS } from '../../rutas';
import AyudaPantalla from '../../components/AyudaPantalla';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import { Campo, Entrada } from '../../components/ui/Campo';
import EncabezadoPagina from '../../components/ui/EncabezadoPagina';
import EstadoVacio from '../../components/ui/EstadoVacio';
import { Esqueleto } from '../../components/ui/Esqueleto';
import Insignia from '../../components/ui/Insignia';
import { ACCIONES_DESCARGA, registrarDescarga } from '../../utils/bitacoraDb';
import { ymd } from '../../utils/fechas';
import {
  ESTADOS_AREA, autorizadasDelPeriodo, estadoDeArea, etiquetaPeriodo, filasAutorizadas, filasDelArea, filasVigentes, moverSemana, nombreArchivoFormato,
  pendientesDelPeriodo, periodoLibre, semanaDe, totalesDeFilas, ultimaSemanaCompleta,
} from '../../utils/formatoNomina';
import { crearFormateadorNombres } from '../../utils/nombresPersona';
import { trozos } from '../../utils/tiempoExtra';
import { leerSolicitudTE } from '../../utils/tiempoExtraDb';
import TablaAjustesArea from './TablaAjustesArea';

const TONO_ESTADO = { sin_revisar: 'neutro', ajustada: 'info', firmada: 'exito' };

export default function ReportesNomina() {
  const toast = useToast();
  const { usuario } = useAuth();
  const { esRH } = useAccesos();
  const { planta, cargando: cargandoPlanta, error } = useResumenTE();
  const { nombres } = useAreas();
  const { empleadosActivos } = useCatalogos();
  const formato = useMemo(() => crearFormateadorNombres([]), []);
  const nombre = (x) => formato.nombre(x);

  const [hoy] = useState(() => ymd());
  const [modo, setModo] = useState('semana');
  const [semana, setSemana] = useState(() => ultimaSemanaCompleta(hoy));
  const [rango, setRango] = useState(() => ({ desde: semana.desde, hasta: semana.dias[4] }));
  const periodo = useMemo(() => (modo === 'semana' ? semana : periodoLibre(rango.desde, rango.hasta)), [modo, semana, rango]);

  const { ajustes, error: errorAjustes } = useAjustesNomina(periodo);
  const autorizadas = useMemo(() => (periodo ? autorizadasDelPeriodo(planta, periodo) : []), [planta, periodo]);
  const pendientes = useMemo(() => (periodo ? pendientesDelPeriodo(planta, periodo, nombres) : { total: 0, porArea: [] }), [planta, periodo, nombres]);

  // Los empleados de cada solicitud autorizada (se guardan por solicitud: cambiar de semana no vuelve a leer lo ya leído)
  const [detalle, setDetalle] = useState(() => new Map());
  const [errorDetalle, setErrorDetalle] = useState('');
  const faltan = useMemo(() => autorizadas.filter(t => !detalle.has(t.id)), [autorizadas, detalle]);
  const claveFaltan = faltan.map(t => t.id).join(',');
  useEffect(() => {
    if (!claveFaltan) return undefined;
    let vigente = true;
    (async () => {
      for (const lote of trozos(claveFaltan.split(','), 5)) {
        const leidas = await Promise.all(lote.map(id => leerSolicitudTE(id).then(s => [id, s])));
        if (!vigente) return;
        setDetalle(prev => { const m = new Map(prev); leidas.forEach(([id, s]) => m.set(id, s ?? { id, empleados: [] })); return m; });
      }
    })().catch(err => { if (vigente) setErrorDetalle(err.message); });
    return () => { vigente = false; };
  }, [claveFaltan]);
  const cargandoDetalle = faltan.length > 0 && !errorDetalle;

  // Una tarjeta por área con tiempo extra autorizado en el periodo
  const areas = useMemo(() => {
    const ids = [...new Set(autorizadas.map(t => t.areaId))];
    return ids.map(areaId => {
      const delArea = autorizadas.map(t => detalle.get(t.id)).filter(s => s && s.areaId === areaId);
      const ajuste = ajustes.get(areaId) ?? null;
      const base = periodo ? filasAutorizadas(delArea, periodo) : [];
      const filas = periodo ? filasDelArea({ solicitudes: delArea, periodo, ajuste }) : [];
      const totales = totalesDeFilas(filas, periodo);
      return { areaId, nombre: nombres.get(areaId) ?? areaId, base, filas, ajuste, totales, estado: estadoDeArea(ajuste) };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [autorizadas, detalle, ajustes, periodo, nombres]);

  const [revisando, setRevisando] = useState(null);
  const [descargando, setDescargando] = useState(null); // areaId | 'todas'
  const revisada = areas.find(a => a.areaId === revisando) ?? null;
  const conEmpleados = areas.filter(a => filasVigentes(a.filas).length > 0);

  const descargar = async (lista, todas) => {
    if (!periodo || lista.length === 0) return;
    setDescargando(todas ? 'todas' : lista[0].areaId);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const { descargarFormatoNomina } = await import('../../utils/exportarFormatoNomina');
      const archivo = nombreArchivoFormato(periodo, todas ? '' : lista[0].nombre);
      await descargarFormatoNomina({
        ExcelJS, periodo, conResumen: todas, fecha: new Date(), nombre,
        areas: lista.map(a => ({ areaId: a.areaId, nombre: a.nombre, filas: a.filas })),
      }, archivo);
      registrarDescarga(ACCIONES_DESCARGA.formatoTENomina, { periodo: periodo.clave, areas: lista.length, archivo });
      toast.success(todas ? `Excel descargado: ${lista.length} áreas con su hoja Resumen.` : `Excel descargado: ${lista[0].nombre}.`);
    } catch (err) {
      console.error(err);
      toast.error(`No se pudo generar el Excel: ${err.message}`, 10000);
    } finally { setDescargando(null); }
  };

  const enCurso = !!periodo && periodo.hasta >= hoy;
  const irA = (delta) => setSemana(s => moverSemana(s, delta));
  const cambiarModo = (m) => {
    if (m === 'rango') setRango({ desde: semana.desde, hasta: semana.dias[4] });
    setModo(m);
  };

  return (
    <div className="space-y-8">
      <EncabezadoPagina
        antetitulo="Reportes de nómina"
        titulo="Formato de autorización de tiempo extra"
        descripcion="Un formato por área y por semana, ya lleno, para recoger las firmas."
        ayuda={<AyudaPantalla id="reportesNomina" listo={!cargandoPlanta} />}
        accion={<Boton variante="primario" icono={FileSpreadsheet} id="btn-descargar-todas" onClick={() => descargar(conEmpleados, true)} estado={descargando === 'todas' ? 'cargando' : undefined} disabled={conEmpleados.length === 0 || cargandoDetalle}>Descargar todas las áreas</Boton>}
      />

      <section aria-label="Periodo" className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {modo === 'semana' ? (
            <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-1">
              <Boton tamano="sm" variante="fantasma" icono={ChevronLeft} onClick={() => irA(-1)} aria-label="Semana anterior" title="Semana anterior" />
              <p className="min-w-56 px-2 text-center text-sm font-semibold text-[var(--text-main)]" aria-live="polite" id="texto-semana">{etiquetaPeriodo(semana)}</p>
              <Boton tamano="sm" variante="fantasma" icono={ChevronRight} onClick={() => irA(1)} aria-label="Semana siguiente" title="Semana siguiente" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:w-96">
              <Campo etiqueta="Desde"><Entrada type="date" value={rango.desde} onChange={e => setRango(r => ({ ...r, desde: e.target.value }))} /></Campo>
              <Campo etiqueta="Hasta" error={!periodo && rango.desde && rango.hasta ? 'Máximo 7 días y la fecha final no puede ser anterior.' : null}><Entrada type="date" value={rango.hasta} min={rango.desde} onChange={e => setRango(r => ({ ...r, hasta: e.target.value }))} /></Campo>
            </div>
          )}
          {modo === 'semana'
            ? <Boton tamano="sm" variante="contorno" icono={CalendarRange} onClick={() => cambiarModo('rango')}>Rango de fechas</Boton>
            : <Boton tamano="sm" variante="contorno" icono={CalendarRange} onClick={() => { setModo('semana'); setSemana(semanaDe(rango.desde || hoy)); }}>Por semana</Boton>}
          {modo === 'semana' && semana.clave !== ultimaSemanaCompleta(hoy).clave && <Boton tamano="sm" variante="fantasma" onClick={() => setSemana(ultimaSemanaCompleta(hoy))}>Última semana completa</Boton>}
        </div>
        {enCurso && <p className="text-xs text-[var(--status-warning-text)]">Este periodo aún no termina: lo autorizado todavía puede cambiar.</p>}
      </section>

      {(error || errorAjustes || errorDetalle) && (
        <Aviso tono="error" titulo="No se pudo leer la información">{(error ?? errorAjustes)?.message ?? errorDetalle}. Revisa tu conexión y vuelve a abrir esta pantalla.</Aviso>
      )}

      {pendientes.total > 0 && (
        <Aviso tono="aviso" titulo={`Hay ${pendientes.total} ${pendientes.total === 1 ? 'solicitud' : 'solicitudes'} de este periodo sin autorizar`}
          accion={<Boton tamano="sm" to={RUTAS.teConsulta}>Verlas en Tiempo extra</Boton>}>
          No entran en el formato mientras Aut. 2 no las autorice: {pendientes.porArea.map(g => {
            const partes = [g.pendientes > 0 && `${g.pendientes} pendiente${g.pendientes === 1 ? '' : 's'}`, g.devueltas > 0 && `${g.devueltas} devuelta${g.devueltas === 1 ? '' : 's'}`].filter(Boolean);
            return `${g.nombre} (${partes.join(', ')})`;
          }).join(' · ')}.
        </Aviso>
      )}

      {!periodo ? <Aviso tono="info">Elige un rango de hasta 7 días.</Aviso>
        : cargandoPlanta ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Cargando">{[0, 1, 2].map(i => <Esqueleto key={i} className="h-40" />)}</div>
        : areas.length === 0 ? (
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
            <EstadoVacio texto={`No hay tiempo extra autorizado en ${etiquetaPeriodo(periodo).toLowerCase()}.`} accion={{ texto: 'Ver el tiempo extra', to: RUTAS.teConsulta }} />
          </div>
        ) : (
          <section aria-label="Áreas" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {areas.map(a => (
              <article key={a.areaId} aria-label={a.nombre} className="flex flex-col gap-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
                <header className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold text-[var(--text-main)]">{a.nombre}</h2>
                  <Insignia tono={TONO_ESTADO[a.estado]} icono={a.estado === 'firmada' ? Lock : undefined} sinIcono={a.estado === 'sin_revisar'}>{ESTADOS_AREA[a.estado]}</Insignia>
                </header>
                {cargandoDetalle && a.base.length === 0 ? <Esqueleto className="h-12" /> : (
                  <dl className="grid grid-cols-2 gap-3">
                    <div><dt className="text-xs text-[var(--text-muted)]">Empleados</dt><dd className="text-2xl font-medium tabular-nums text-[var(--text-main)]">{a.totales.empleados}</dd></div>
                    <div><dt className="text-xs text-[var(--text-muted)]">Horas totales</dt><dd className="text-2xl font-medium tabular-nums text-[var(--text-main)]">{a.totales.horas}</dd></div>
                  </dl>
                )}
                <div className="mt-auto flex flex-wrap gap-2">
                  <Boton icono={ClipboardCheck} onClick={() => setRevisando(a.areaId)} disabled={cargandoDetalle && a.base.length === 0} aria-label={`Revisar ${a.nombre}`}>Revisar</Boton>
                  <Boton icono={Download} onClick={() => descargar([a], false)} estado={descargando === a.areaId ? 'cargando' : undefined} disabled={a.totales.empleados === 0 || cargandoDetalle} aria-label={`Descargar ${a.nombre}`}>Descargar</Boton>
                </div>
              </article>
            ))}
          </section>
        )}

      {revisada && periodo && (
        <TablaAjustesArea abierto onClose={() => setRevisando(null)} area={revisada} periodo={periodo} base={revisada.base} ajuste={revisada.ajuste}
          usuario={usuario} esRH={esRH} empleados={empleadosActivos} nombre={nombre}
          onDescargar={() => descargar([revisada], false)} descargando={descargando === revisada.areaId} />
      )}
    </div>
  );
}
