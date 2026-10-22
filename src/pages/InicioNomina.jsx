/**
 * InicioNomina.jsx — Inicio del rol Nóminas (/): el tiempo extra AUTORIZADO de hoy y de esta semana (solicitudes, empleados y horas totales
 * por área) y lo que falta por enviar al proveedor. Es solo de consulta: todo sale de las solicitudes de la planta que ya se escuchan en
 * tiempo real (useResumenTE). "Autorizado" = autorizada o confirmada; la semana va de lunes a domingo, por la fecha del tiempo extra.
 * (La sección «Reportes de nómina» se agregará aquí y en el menú en la siguiente entrega.)
 */
import { useMemo, useState } from 'react';
import { CalendarDays, CalendarX, Clock, Inbox, Layers, Users } from 'lucide-react';
import { useAccesos } from '../hooks/useAccesos';
import { useAreas } from '../hooks/useAreas';
import { useCatalogos } from '../hooks/useCatalogos';
import { useResumenTE } from '../hooks/useResumenTE';
import { useSaludo } from '../hooks/useSaludo';
import { RUTAS } from '../rutas';
import { resumenNomina } from '../utils/resumenInicio';
import AyudaPantalla from '../components/AyudaPantalla';
import Aviso from '../components/ui/Aviso';
import Boton from '../components/ui/Boton';
import EncabezadoPagina from '../components/ui/EncabezadoPagina';
import EstadoVacio from '../components/ui/EstadoVacio';
import { EsqueletoIndicadores, EsqueletoTabla } from '../components/ui/Esqueleto';
import { Fila, Tabla, Td, Th } from '../components/ui/Tabla';
import { Indicador } from '../components/ui/Tarjeta';

function TablaPorArea({ periodo, titulo, vacio }) {
  const { filas, total } = periodo;
  if (filas.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
        <EstadoVacio texto={vacio} accion={{ texto: 'Ver el tiempo extra', to: RUTAS.teConsulta }} />
      </div>
    );
  }
  return (
    <Tabla etiqueta={titulo}>
      <thead><tr><Th>Área</Th><Th derecha>Solicitudes</Th><Th derecha>Empleados</Th><Th derecha>Horas</Th></tr></thead>
      <tbody>
        {filas.map(g => (
          <Fila key={g.areaId}><Td>{g.nombre}</Td><Td derecha>{g.solicitudes}</Td><Td derecha>{g.empleados}</Td><Td derecha mono>{g.horas}</Td></Fila>
        ))}
        <Fila><Td className="font-medium">Total</Td><Td derecha className="font-medium">{total.solicitudes}</Td><Td derecha className="font-medium">{total.empleados}</Td><Td derecha mono className="font-medium">{total.horas}</Td></Fila>
      </tbody>
    </Tabla>
  );
}

const Seccion = ({ titulo, tour, children }) => (
  <section className="space-y-4" aria-label={titulo} data-tour={tour}>
    <h2 className="text-lg font-semibold text-[var(--text-main)]">{titulo}</h2>
    {children}
  </section>
);

export default function InicioNomina() {
  const { planta, cargando, error } = useResumenTE();
  const { nombres } = useAreas();
  const { empleadosActivos } = useCatalogos();
  const { saludo, nombre, descripcion } = useSaludo(empleadosActivos);
  const { areasSolicitante, areasAut1, esAut2 } = useAccesos();
  const [ahora] = useState(() => new Date());
  const r = useMemo(() => resumenNomina(planta, nombres, ahora), [planta, nombres, ahora]);
  const { porEnviar } = r;
  const tieneRolOperativo = areasSolicitante.length > 0 || areasAut1.length > 0 || esAut2;

  return (
    <div className="space-y-10">
      <EncabezadoPagina
        antetitulo={`${descripcion || 'Nóminas'} · Century Mold Querétaro`}
        titulo={`${saludo}${nombre ? `, ${nombre}` : ''}`}
        descripcion="Este es el tiempo extra autorizado y lo que falta por enviar al proveedor."
        ayuda={<AyudaPantalla id="inicioNomina" listo={!cargando} />}
        accion={porEnviar.total > 0 ? <Boton to={RUTAS.teRecepcion} variante="primario" icono={Inbox}>Por enviar al proveedor ({porEnviar.total})</Boton> : undefined}
      />

      {error && <Aviso tono="error" titulo="No se pudieron leer las solicitudes">{error.message}. Revisa tu conexión y vuelve a abrir esta pantalla.</Aviso>}

      <Seccion titulo="Pendiente de enviar al proveedor" tour={'inicioNomina-pendiente'}>
        {cargando ? <EsqueletoIndicadores cantidad={3} className="grid gap-4 sm:grid-cols-3" /> : (
          <div className="grid gap-4 sm:grid-cols-3">
            <Indicador etiqueta="Por enviar al proveedor" valor={porEnviar.total} to={RUTAS.teRecepcion} icono={Inbox} atencion={porEnviar.total > 0} ayuda="autorizadas por confirmar" />
            <Indicador etiqueta="Fechas vencidas" valor={porEnviar.vencidas} to={RUTAS.teRecepcion} icono={CalendarX} atencion={porEnviar.vencidas > 0} ayuda="sin confirmar y con fecha que ya pasó" />
            <Indicador etiqueta="Empleados por enviar" valor={porEnviar.empleados} to={RUTAS.teRecepcion} icono={Users} ayuda="en lo que falta por confirmar" />
          </div>
        )}
      </Seccion>

      <Seccion titulo="Autorizado hoy" tour={'inicioNomina-hoy'}>
        {cargando ? <EsqueletoTabla filas={3} columnas={4} /> : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Indicador etiqueta="Solicitudes de hoy" valor={r.hoy.total.solicitudes} to={RUTAS.teConsulta} icono={Layers} ayuda="tiempo extra autorizado" />
              <Indicador etiqueta="Empleados de hoy" valor={r.hoy.total.empleados} to={RUTAS.teConsulta} icono={Users} ayuda="con tiempo extra autorizado" />
              <Indicador etiqueta="Horas de hoy" valor={r.hoy.total.horas} to={RUTAS.teConsulta} icono={Clock} ayuda="horas extra autorizadas" />
            </div>
            <TablaPorArea periodo={r.hoy} titulo="Tiempo extra autorizado de hoy, por área" vacio="No hay tiempo extra autorizado para hoy." />
          </>
        )}
      </Seccion>

      <Seccion titulo="Autorizado esta semana (lunes a domingo)" tour={'inicioNomina-semana'}>
        {cargando ? <EsqueletoTabla filas={4} columnas={4} /> : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Indicador etiqueta="Solicitudes de la semana" valor={r.semana.total.solicitudes} to={RUTAS.teConsulta} icono={CalendarDays} ayuda="tiempo extra autorizado" />
              <Indicador etiqueta="Empleados de la semana" valor={r.semana.total.empleados} to={RUTAS.teConsulta} icono={Users} ayuda="con tiempo extra autorizado" />
              <Indicador etiqueta="Horas de la semana" valor={r.semana.total.horas} to={RUTAS.teConsulta} icono={Clock} ayuda="horas extra autorizadas" />
            </div>
            <TablaPorArea periodo={r.semana} titulo="Tiempo extra autorizado de la semana, por área" vacio="No hay tiempo extra autorizado para esta semana." />
          </>
        )}
      </Seccion>

      {tieneRolOperativo && (
        <Seccion titulo="Tus otros accesos">
          <div className="flex flex-wrap gap-3">
            {(areasSolicitante.length > 0 || areasAut1.length > 0 || esAut2) && <Boton to={RUTAS.teNueva} variante="contorno">Solicitar tiempo extra</Boton>}
            {(areasSolicitante.length > 0 || areasAut1.length > 0 || esAut2) && <Boton to={RUTAS.teMisSolicitudes} variante="contorno">Mis solicitudes</Boton>}
            {(areasAut1.length > 0 || esAut2) && <Boton to={RUTAS.teAutorizar} variante="contorno">Por autorizar</Boton>}
          </div>
        </Seccion>
      )}
    </div>
  );
}
