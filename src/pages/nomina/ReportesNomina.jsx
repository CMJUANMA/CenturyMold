/**
 * ReportesNomina.jsx — /nomina/reportes (Nóminas, RH y admin): el FORMATO DE AUTORIZACIÓN DE TIEMPO EXTRA semanal, un área por tarjeta.
 * Toma solo el tiempo extra autorizado por Aut. 2 (autorizada o procesada) de la semana ISO elegida (lunes a domingo; por defecto la última completa)
 * o de un rango libre de hasta 7 días. Cada tarjeta trae empleados, horas y estado (Sin revisar / Ajustada / Firmada) con «Revisar» (abre la pantalla
 * completa RevisarAreaNomina) y «Descargar» (Excel listo para imprimir). Los ajustes viven aparte (ajustesNomina) y nunca modifican las solicitudes.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarRange, ChevronLeft, ChevronRight, ClipboardCheck, Download, FileSpreadsheet, Lock } from 'lucide-react';
import { useAreasNomina } from '../../hooks/useAreasNomina';
import { useToast } from '../../hooks/useToast';
import { RUTAS, rutaConsultaFueraDeTiempo, rutaConsultaTE, rutaRevisarNomina } from '../../rutas';
import AyudaPantalla from '../../components/AyudaPantalla';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import { Campo, Entrada } from '../../components/ui/Campo';
import EncabezadoPagina from '../../components/ui/EncabezadoPagina';
import EstadoVacio from '../../components/ui/EstadoVacio';
import { Esqueleto } from '../../components/ui/Esqueleto';
import Insignia from '../../components/ui/Insignia';
import MenuRenglon from './MenuRenglon';
import { descargarFormatoAreas } from '../../utils/descargarFormatoNomina';
import { ymd } from '../../utils/fechas';
import {
  ESTADOS_AREA, etiquetaPeriodo, filasVigentes, moverSemana, periodoDeClave, periodoLibre, semanaDe, ultimaSemanaCompleta,
} from '../../utils/formatoNomina';
import { crearFormateadorNombres } from '../../utils/nombresPersona';

const TONO_ESTADO = { sin_revisar: 'neutro', ajustada: 'info', firmada: 'exito' };

export default function ReportesNomina() {
  const toast = useToast();
  const formato = useMemo(() => crearFormateadorNombres([]), []);
  const nombre = (x) => formato.nombre(x);

  const [hoy] = useState(() => ymd());
  const [params] = useSearchParams();
  const [inicial] = useState(() => periodoDeClave(params.get('periodo')));
  const [modo, setModo] = useState(inicial?.tipo === 'rango' ? 'rango' : 'semana');
  const [semana, setSemana] = useState(() => (inicial?.tipo === 'semana' ? inicial : ultimaSemanaCompleta(hoy)));
  const [rango, setRango] = useState(() => (inicial?.tipo === 'rango' ? { desde: inicial.desde, hasta: inicial.hasta } : { desde: semana.desde, hasta: semana.dias[4] }));
  const periodo = useMemo(() => (modo === 'semana' ? semana : periodoLibre(rango.desde, rango.hasta)), [modo, semana, rango]);

  const { areas, pendientes, cargando: cargandoPlanta, cargandoDetalle, error } = useAreasNomina(periodo);

  const navegar = useNavigate();
  const [descargando, setDescargando] = useState(null); // areaId | 'conTE' | 'todas'
  const conEmpleados = areas.filter(a => filasVigentes(a.filas).length > 0);

  // modo: 'area' (la tarjeta; vacía sale en blanco) · 'conTE' (Resumen + las áreas con al menos un empleado) · 'todas' (Resumen + cada área, las vacías en blanco)
  const descargar = async (lista, modo = 'area') => {
    if (!periodo || lista.length === 0) return;
    setDescargando(modo === 'area' ? lista[0].areaId : modo);
    try {
      await descargarFormatoAreas({ periodo, areas: lista, modo, nombre });
      toast.success(modo === 'area' ? `Excel descargado: ${lista[0].nombre}.` : `Excel descargado: ${lista.length} ${lista.length === 1 ? 'área' : 'áreas'} con su hoja Resumen.`);
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
        accion={(
          <div className="flex flex-wrap items-center gap-2">
            <Boton variante="primario" icono={FileSpreadsheet} id="btn-descargar-todas" onClick={() => descargar(conEmpleados, 'conTE')} estado={descargando === 'conTE' ? 'cargando' : undefined} disabled={conEmpleados.length === 0 || cargandoDetalle}>Descargar áreas con tiempo extra</Boton>
            <MenuRenglon etiqueta="Más opciones de descarga" texto="Más opciones" deshabilitado={areas.length === 0 || cargandoDetalle || !!descargando}
              acciones={[{ texto: `Descargar todas las áreas (${areas.length})`, icono: FileSpreadsheet, ayuda: 'Resumen y una hoja por cada área; las que no tienen tiempo extra salen en blanco', onClick: () => descargar(areas, 'todas') }]} />
          </div>
        )}
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

      {error && (
        <Aviso tono="error" titulo="No se pudo leer la información">{error.message}. Revisa tu conexión y vuelve a abrir esta pantalla.</Aviso>
      )}

      {pendientes.vencidas.total > 0 && (
        <Aviso tono="aviso" titulo={`${pendientes.vencidas.total} ${pendientes.vencidas.total === 1 ? 'solicitud' : 'solicitudes'} de esta semana ${pendientes.vencidas.total === 1 ? 'venció' : 'vencieron'} sin autorizarse`}
          accion={<Boton tamano="sm" to={rutaConsultaTE('vencida')}>Ver las vencidas</Boton>}>
          No cuentan en el formato. Si alguien trabajó de todos modos, puedes agregarlo a mano en «Revisar»: {pendientes.vencidas.porArea.map(g => `${g.nombre} (${g.cantidad})`).join(' · ')}.
        </Aviso>
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
              <article key={a.areaId} aria-label={a.nombre} data-sin-te={a.sinTE ? 'true' : undefined}
                className={`flex flex-col gap-4 rounded-lg border p-5 ${a.sinTE ? 'border-dashed border-[var(--border-color)] bg-[var(--bg-surface-secondary)] opacity-75' : 'border-[var(--border-color)] bg-[var(--bg-surface)]'}`}>
                <header className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold text-[var(--text-main)]">{a.nombre}</h2>
                  <Insignia tono={TONO_ESTADO[a.estado]} icono={a.estado === 'firmada' ? Lock : undefined} sinIcono={a.estado === 'sin_revisar'}>{ESTADOS_AREA[a.estado]}</Insignia>
                </header>
                {a.sinTE ? <p className="text-sm text-[var(--text-secondary)]">Sin tiempo extra esta semana</p>
                  : cargandoDetalle && a.base.length === 0 ? <Esqueleto className="h-12" /> : (
                  <dl className="grid grid-cols-2 gap-3">
                    <div><dt className="text-xs text-[var(--text-muted)]">Empleados</dt><dd className="text-2xl font-medium tabular-nums text-[var(--text-main)]">{a.totales.empleados}</dd></div>
                    <div><dt className="text-xs text-[var(--text-muted)]">Horas totales</dt><dd className="text-2xl font-medium tabular-nums text-[var(--text-main)]">{a.totales.horas}</dd></div>
                  </dl>
                )}
                {a.fueraDeTiempo.trasFirma.length > 0 ? (
                  <Aviso tono="aviso" titulo="Autorizada fuera de tiempo después de firmar">
                    {a.fueraDeTiempo.trasFirma.join(', ')} no {a.fueraDeTiempo.trasFirma.length === 1 ? 'está' : 'están'} en el formato firmado. RH tiene que reabrir esta área para que la revises otra vez.
                  </Aviso>
                ) : a.fueraDeTiempo.total > 0 && (
                  <p className="text-xs text-[var(--text-secondary)]">{a.fueraDeTiempo.total} {a.fueraDeTiempo.total === 1 ? 'solicitud autorizada' : 'solicitudes autorizadas'} fuera de tiempo ({a.fueraDeTiempo.folios.join(', ')}). <Link className="underline" to={rutaConsultaFueraDeTiempo()}>Ver en la consulta</Link></p>
                )}
                <div className="mt-auto flex flex-wrap gap-2">
                  <Boton icono={ClipboardCheck} onClick={() => navegar(rutaRevisarNomina(periodo.clave, a.areaId))} disabled={cargandoDetalle && a.base.length === 0 && !a.sinTE} aria-label={`Revisar ${a.nombre}`}>Revisar</Boton>
                  <Boton icono={Download} onClick={() => descargar([a])} estado={descargando === a.areaId ? 'cargando' : undefined} disabled={cargandoDetalle} aria-label={`Descargar ${a.nombre}`}>Descargar</Boton>
                </div>
              </article>
            ))}
          </section>
        )}
    </div>
  );
}
