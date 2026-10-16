/**
 * InicioRol.jsx — Inicio de quien NO es RH/admin: directamente su panel, según los roles que tiene hoy.
 * Una persona con varios roles ve la unión de lo que le toca a cada uno. Mientras no existan solicitudes de tiempo extra,
 * las tarjetas muestran 0 (sin error).
 * Un solo botón principal: «Solicitar tiempo extra» para quien solicita; quien solo autoriza lo tiene en «Por autorizar».
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, CheckCircle2, Clock, FilePlus, Users } from 'lucide-react';
import { useAccesos } from '../hooks/useAccesos';
import { useAreas } from '../hooks/useAreas';
import { useCatalogos } from '../hooks/useCatalogos';
import { useResumenTE } from '../hooks/useResumenTE';
import { usePorAutorizar } from '../hooks/usePendientes';
import { useAuth } from '../hooks/useAuth';
import { useSaludo } from '../hooks/useSaludo';
import { esActivo } from '../utils/activo';
import { RUTAS, rutaMisSolicitudes } from '../rutas';
import { contarMisSolicitudes, proximosAutorizados, semanaPorArea, ultimasDelArea } from '../utils/resumenInicio';
import { formatoFecha } from '../utils/asignaciones';
import AyudaPantalla from '../components/AyudaPantalla';
import BadgeEstatus from '../components/BadgeEstatus';
import Aviso from '../components/ui/Aviso';
import Boton from '../components/ui/Boton';
import EncabezadoPagina from '../components/ui/EncabezadoPagina';
import EstadoVacio from '../components/ui/EstadoVacio';
import { EsqueletoPagina, EsqueletoIndicadores } from '../components/ui/Esqueleto';
import { Fila, Tabla, Td, Th } from '../components/ui/Tabla';
import { Indicador } from '../components/ui/Tarjeta';

/** Tabla con título y mensaje cuando no hay filas. `columnas`: [{ texto, derecha }] */
function TablaInicio({ titulo, columnas, filas, vacio }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-[var(--text-main)]">{titulo}</h2>
      {filas.length === 0 ? (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]"><EstadoVacio texto={vacio} className="py-8" /></div>
      ) : (
        <Tabla etiqueta={titulo}>
          <thead><tr>{columnas.map(c => <Th key={c.texto} derecha={c.derecha}>{c.texto}</Th>)}</tr></thead>
          <tbody>{filas.map((f, i) => <Fila key={i}>{f.map((c, j) => <Td key={j} derecha={columnas[j].derecha} mono={columnas[j].mono}>{c}</Td>)}</Fila>)}</tbody>
        </Tabla>
      )}
    </section>
  );
}

export default function InicioRol() {
  const { usuario } = useAuth();
  const accesos = useAccesos();
  const { esAut2, areasAut1, areasSolicitante, cargando } = accesos;
  const { areas, nombres } = useAreas();
  const { empleados, cargando: cargandoEmp } = useCatalogos({ empleados: true });
  const resumen = useResumenTE();
  const porAutorizar = usePorAutorizar(usuario, accesos, true);
  const { saludo, nombre, descripcion } = useSaludo(empleados);

  const esSolicitante = areasSolicitante.length > 0;
  const esAut1 = areasAut1.length > 0;
  const misAreas = useMemo(() => [...new Set([...areasSolicitante, ...areasAut1])], [areasSolicitante, areasAut1]);
  const tieneRol = esSolicitante || esAut1 || esAut2;
  const puedeSolicitar = esSolicitante || esAut1;
  const puedeAutorizar = esAut1 || esAut2;

  const [ahora] = useState(() => new Date());
  const mias = contarMisSolicitudes(resumen.propias, ahora);
  const proximos = proximosAutorizados(resumen.propias, ahora);
  const empleadosDeMiArea = empleados.filter(e => esActivo(e) && misAreas.includes(e.areaId)).length;
  const empleadosDePlanta = empleados.filter(esActivo).length;
  const nombreArea = (id) => nombres.get(id) ?? id;

  if (cargando) return <div className="space-y-8"><EsqueletoPagina bloques={0} /><EsqueletoIndicadores cantidad={4} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" /></div>;
  return (
    <div className="space-y-8">
      <EncabezadoPagina
        antetitulo="Century Mold Querétaro"
        titulo={`${saludo}${nombre ? `, ${nombre}` : ''}`}
        descripcion={descripcion || 'Sin roles asignados por ahora'}
        ayuda={<AyudaPantalla id="inicioRol" />}
        accion={puedeSolicitar
          ? <Boton to={RUTAS.teNueva} variante="primario" icono={FilePlus}>Solicitar tiempo extra</Boton>
          : (esAut2 && porAutorizar.total > 0 ? <Boton to={RUTAS.teAutorizar} variante="primario" icono={BadgeCheck}>Por autorizar ({porAutorizar.total})</Boton> : null)}
      />

      {!tieneRol && (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
          <EstadoVacio titulo="Aún no tienes acceso" texto="Pide a Recursos Humanos que te asignen un rol para poder usar el portal." />
        </div>
      )}

      {resumen.error && <Aviso tono="error" titulo="No se pudieron leer las solicitudes">{resumen.error.message}. Revisa tu conexión y recarga la página.</Aviso>}

      {puedeAutorizar && (puedeSolicitar || porAutorizar.total === 0) && (
        <Aviso
          tono={porAutorizar.total > 0 ? 'aviso' : 'info'}
          icon={BadgeCheck}
          titulo={`Por autorizar (${porAutorizar.total})`}
          accion={<Boton to={RUTAS.teAutorizar} variante="contorno" tamano="sm">Ir a la bandeja</Boton>}
        >
          {esAut1 && esAut2 ? `Nivel 1: ${porAutorizar.aut1} · Nivel 2: ${porAutorizar.aut2}` : esAut2 ? 'Solicitudes esperando tu firma de nivel 2.' : 'Solicitudes de tu área esperando tu firma.'}
        </Aviso>
      )}

      {puedeSolicitar && (
        <section aria-label="Mi área" className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--text-main)]">
            {misAreas.length === 1 ? `Mi área · ${nombreArea(misAreas[0])}` : `Mis áreas · ${misAreas.map(nombreArea).join(', ')}`}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Indicador etiqueta="Empleados de mi área" valor={empleadosDeMiArea} cargando={cargandoEmp} icono={Users} ayuda="activos en tu área" />
            <Indicador etiqueta="En borrador" valor={mias.borrador} to={rutaMisSolicitudes('borrador')} ayuda="Aún no las envías" />
            <Indicador etiqueta="En autorización" valor={mias.enAutorizacion} to={rutaMisSolicitudes('autorizacion')} icono={Clock} ayuda="Esperando firmas" />
            <Indicador etiqueta="Devueltas" valor={mias.devueltas} to={rutaMisSolicitudes('devuelta')} atencion={mias.devueltas > 0} icono={AlertTriangle}
              ayuda={mias.devueltas > 0 ? 'Piden que las corrijas' : 'Nada por corregir'} />
            <Indicador etiqueta="Autorizadas este mes" valor={mias.autorizadasMes} to={rutaMisSolicitudes('autorizada')} icono={CheckCircle2} ayuda="solicitudes" />
          </div>
          <TablaInicio titulo="Próximos tiempos extra autorizados"
            columnas={[{ texto: 'Folio', mono: true }, { texto: 'Fecha' }, { texto: 'Empleados', derecha: true }, { texto: 'Horas', derecha: true, mono: true }, { texto: 'Transporte', derecha: true }]}
            filas={proximos.map(p => [p.folio, formatoFecha(`${p.fecha}T12:00:00`), p.empleados, p.horas, p.transporte])}
            vacio="Todavía no tienes tiempos extra autorizados por venir." />
        </section>
      )}

      {esAut1 && (
        <TablaInicio titulo="Últimas solicitudes de mi área"
          columnas={[{ texto: 'Folio', mono: true }, { texto: 'Área' }, { texto: 'Fecha' }, { texto: 'Estado' }]}
          filas={ultimasDelArea(resumen.delArea).map(s => [s.folio ?? s.id, nombreArea(s.areaId), formatoFecha(`${s.fechaTE}T12:00:00`), <BadgeEstatus key="e" estatus={s.estatus} modulo="te" />])}
          vacio="Aún no hay solicitudes en tu área." />
      )}

      {esAut2 && (
        <section aria-label="Planta" className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--text-main)]">Planta</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Indicador etiqueta="Por autorizar nivel 2" valor={porAutorizar.aut2} to={RUTAS.teAutorizar} atencion={porAutorizar.aut2 > 0} icono={BadgeCheck} ayuda="Esperando tu firma" />
            <Indicador etiqueta="Empleados de planta" valor={empleadosDePlanta} cargando={cargandoEmp} icono={Users} ayuda="activos" />
            <Indicador etiqueta="Solicitudes de la semana" valor={semanaPorArea(resumen.planta, areas, ahora).reduce((a, x) => a + x.total, 0)} to={RUTAS.teConsulta} ayuda="enviadas esta semana" />
          </div>
          <TablaInicio titulo="Solicitudes de la semana por área"
            columnas={[{ texto: 'Área' }, { texto: 'Solicitudes', derecha: true }]}
            filas={semanaPorArea(resumen.planta, areas.filter(a => a.participaTE), ahora).map(x => [x.nombre, x.total])} vacio="Sin áreas con tiempo extra." />
        </section>
      )}
    </div>
  );
}
