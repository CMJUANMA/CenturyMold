/**
 * InicioRH.jsx — Inicio de RH y admin (/): lo que requiere atención hoy y cómo va la semana de tiempo extra.
 *   Requieren atención (resaltado si es mayor a 0): por enviar al proveedor · fechas vencidas sin confirmar · por autorizar nivel 1 ·
 *   por autorizar nivel 2 (con la más antigua) · devueltas sin corregir. Cada indicador lleva a la pantalla donde se atiende.
 *   Esta semana: horas autorizadas (semana y mes) · empleados con tiempo extra · con transporte en los próximos 7 días.
 * Orden: primero lo que pide acción; después la semana y los próximos 7 días; accesos rápidos y datos del sistema, en segundo plano.
 * Todo sale de las solicitudes de la planta que ya se escuchan en tiempo real (useResumenTE); solo "Transporte del mes" hace un conteo
 * en el servidor.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getCountFromServer, query, where, Timestamp } from 'firebase/firestore';
import { BadgeCheck, Bus, CalendarX, Clock, Inbox, Layers, MapPin, ShieldCheck, Undo2, Users } from 'lucide-react';
import { db } from '../firebase';
import { useAreas } from '../hooks/useAreas';
import { useCatalogos } from '../hooks/useCatalogos';
import { useResumenTE } from '../hooks/useResumenTE';
import { useSaludo } from '../hooks/useSaludo';
import { formatoFecha } from '../utils/asignaciones';
import { indicadoresRH, proximos7Dias } from '../utils/resumenInicio';
import { RUTAS, rutaConsultaTE } from '../rutas';
import AyudaPantalla from '../components/AyudaPantalla';
import BadgeEstatus from '../components/BadgeEstatus';
import Aviso from '../components/ui/Aviso';
import Boton from '../components/ui/Boton';
import EncabezadoPagina from '../components/ui/EncabezadoPagina';
import EstadoVacio from '../components/ui/EstadoVacio';
import { EsqueletoIndicadores, EsqueletoTabla } from '../components/ui/Esqueleto';
import { Fila, Tabla, Td, Th } from '../components/ui/Tabla';
import { Indicador } from '../components/ui/Tarjeta';

function AccesoRapido({ to, Icono, titulo, ayuda }) {
  return (
    <Link to={to} className="group flex items-start gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 transition-colors duration-150 hover:bg-[var(--bg-surface-hover)]">
      <Icono className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-main)]" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--text-main)]">{titulo}</span>
        <span className="block text-xs text-[var(--text-muted)]">{ayuda}</span>
      </span>
    </Link>
  );
}

const Seccion = ({ titulo, children }) => (
  <section className="space-y-4" aria-label={titulo}>
    <h2 className="text-lg font-semibold text-[var(--text-main)]">{titulo}</h2>
    {children}
  </section>
);

const textoDias = (d) => (d === null ? null : d === 0 ? 'La más antigua: de hoy' : `La más antigua: hace ${d} ${d === 1 ? 'día' : 'días'}`);

export default function InicioRH() {
  const { planta, cargando, error } = useResumenTE();
  const { nombres } = useAreas();
  const { rutasActivas, empleadosActivos, cargando: cargandoCat } = useCatalogos();
  const nombresPadron = useMemo(() => empleadosActivos.map(e => e.nombre), [empleadosActivos]);
  const { saludo, nombre, descripcion } = useSaludo(nombresPadron);
  const [ahora] = useState(() => new Date());
  const [transporteMes, setTransporteMes] = useState(null);

  const ind = useMemo(() => indicadoresRH(planta, ahora), [planta, ahora]);
  const proximos = useMemo(() => proximos7Dias(planta, ahora), [planta, ahora]);
  const { atencion: a, semana: s } = ind;
  const hayAtencion = a.porEnviar + a.vencidas + a.nivel1 + a.nivel2 + a.devueltas > 0;

  // Solicitudes de transporte del mes: conteo en el servidor (fechaSolicitud es Timestamp en las nuevas y texto ISO en las viejas)
  useEffect(() => {
    let cancelado = false;
    const ini = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
    const col = collection(db, 'solicitudes');
    Promise.all([
      getCountFromServer(query(col, where('fechaSolicitud', '>=', Timestamp.fromDate(ini)), where('fechaSolicitud', '<', Timestamp.fromDate(fin)))),
      getCountFromServer(query(col, where('fechaSolicitud', '>=', ini.toISOString()), where('fechaSolicitud', '<', fin.toISOString()))),
    ]).then(([ts, iso]) => { if (!cancelado) setTransporteMes(ts.data().count + iso.data().count); })
      .catch(err => { console.error('Conteo de transporte del mes:', err); if (!cancelado) setTransporteMes(null); });
    return () => { cancelado = true; };
  }, [ahora]);

  return (
    <div className="space-y-10">
      <EncabezadoPagina
        antetitulo={`${descripcion || 'Recursos Humanos'} · Century Mold Querétaro`}
        titulo={`${saludo}${nombre ? `, ${nombre}` : ''}`}
        descripcion="Esto es lo que necesita tu atención hoy."
        ayuda={<AyudaPantalla id="inicio" />}
        accion={<Boton to={RUTAS.teRecepcion} variante="primario" icono={Inbox}>Por enviar al proveedor</Boton>}
      />

      {error && <Aviso tono="error" titulo="No se pudieron leer las solicitudes">{error.message}. Revisa tu conexión y vuelve a abrir esta pantalla.</Aviso>}

      <Seccion titulo="Requieren atención">
        {cargando ? <EsqueletoIndicadores cantidad={5} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" /> : (
          <>
            {!hayAtencion && !error && <Aviso tono="exito">Nada pendiente por ahora: todo está al día.</Aviso>}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Indicador etiqueta="Por enviar al proveedor" valor={a.porEnviar} to={RUTAS.teRecepcion} atencion={a.porEnviar > 0} icono={Inbox} ayuda="Autorizadas por confirmar" />
              <Indicador etiqueta="Fechas vencidas" valor={a.vencidas} to={RUTAS.teRecepcion} atencion={a.vencidas > 0} icono={CalendarX} ayuda="Sin confirmar y con fecha que ya pasó" />
              <Indicador etiqueta="Por autorizar · nivel 1" valor={a.nivel1} to={rutaConsultaTE('pendiente_aut1')} atencion={a.nivel1 > 0} icono={BadgeCheck} ayuda="Esperan al Aut. 1 de su área" />
              <Indicador etiqueta="Por autorizar · nivel 2" valor={a.nivel2} to={RUTAS.teAutorizar} atencion={a.nivel2 > 0} icono={ShieldCheck} ayuda={textoDias(a.masAntiguaNivel2) ?? 'Esperan la firma de nivel 2'} />
              <Indicador etiqueta="Devueltas sin corregir" valor={a.devueltas} to={rutaConsultaTE('devuelta')} atencion={a.devueltas > 0} icono={Undo2} ayuda="Esperan que el área las corrija" />
            </div>
          </>
        )}
      </Seccion>

      <Seccion titulo="Esta semana">
        {cargando ? <EsqueletoIndicadores cantidad={3} className="grid gap-4 sm:grid-cols-3" /> : (
          <div className="grid gap-4 sm:grid-cols-3">
            <Indicador etiqueta="Horas autorizadas" valor={s.horasSemana} to={RUTAS.teConsulta} icono={Clock} ayuda={`esta semana · ${s.horasMes} en el mes`} />
            <Indicador etiqueta="Empleados con tiempo extra" valor={s.empleadosSemana} to={RUTAS.teConsulta} icono={Users} ayuda="autorizados esta semana" />
            <Indicador etiqueta="Con transporte" valor={s.transporte7} to={RUTAS.transporteSolicitudes} icono={Bus} ayuda="empleados, en los próximos 7 días" />
          </div>
        )}
      </Seccion>

      <Seccion titulo="Próximos tiempos extra (7 días)">
        {cargando ? <EsqueletoTabla filas={4} columnas={7} /> : proximos.length === 0 ? (
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
            <EstadoVacio texto="No hay tiempos extra autorizados para los próximos 7 días." accion={{ texto: 'Ver todas las solicitudes', to: RUTAS.teConsulta }} />
          </div>
        ) : (
          <Tabla etiqueta="Próximos tiempos extra (7 días)">
            <thead>
              <tr>
                <Th>Folio</Th><Th>Área</Th><Th>Fecha</Th><Th derecha>Empleados</Th><Th derecha>Horas</Th><Th derecha>Transporte</Th><Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {proximos.map(p => (
                <Fila key={p.id}>
                  <Td mono><Link to={`${RUTAS.teConsulta}?abrir=${p.id}`} className="font-medium text-[var(--text-main)] underline decoration-[var(--border-color)] underline-offset-4 hover:decoration-[var(--text-main)]">{p.folio}</Link></Td>
                  <Td>{nombres.get(p.areaId) ?? p.areaId}</Td>
                  <Td className="whitespace-nowrap">{formatoFecha(`${p.fecha}T12:00:00`)}</Td>
                  <Td derecha mono>{p.empleados}</Td>
                  <Td derecha mono>{p.horas}</Td>
                  <Td derecha mono>{p.transporte}</Td>
                  <Td><BadgeEstatus estatus={p.estatus} modulo="te" /></Td>
                </Fila>
              ))}
            </tbody>
          </Tabla>
        )}
      </Seccion>

      <Seccion titulo="Accesos rápidos">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AccesoRapido to={RUTAS.teRecepcion} Icono={Inbox} titulo="Por enviar al proveedor" ayuda="Confirmar y bajar el formato de rutas" />
          <AccesoRapido to={RUTAS.teAutorizar} Icono={BadgeCheck} titulo="Por autorizar" ayuda="Firmar o devolver solicitudes" />
          <AccesoRapido to={RUTAS.teConsulta} Icono={Layers} titulo="Solicitudes de tiempo extra" ayuda="Ver todas, con filtros y Excel" />
          <AccesoRapido to={RUTAS.transporteSolicitudes} Icono={Bus} titulo="Solicitudes de transporte" ayuda="Las que se generan al confirmar" />
          <AccesoRapido to={RUTAS.padron} Icono={Users} titulo="Padrón de empleados" ayuda="Altas, bajas, rutas e importación" />
          <AccesoRapido to={RUTAS.accesos} Icono={ShieldCheck} titulo="Usuarios y accesos" ayuda="Cuentas y roles por área" />
        </div>
      </Seccion>

      <Seccion titulo="Datos del sistema">
        <div className="grid gap-4 sm:grid-cols-3">
          <Indicador etiqueta="Transporte del mes" valor={transporteMes ?? '—'} to={RUTAS.transporteSolicitudes} icono={Bus} ayuda="solicitudes de transporte registradas" />
          <Indicador etiqueta="Personal activo" valor={empleadosActivos.length} to={RUTAS.padron} icono={Users} cargando={cargandoCat} ayuda="empleados en el padrón" />
          <Indicador etiqueta="Rutas activas" valor={rutasActivas.length} to={RUTAS.transporteCatalogos} icono={MapPin} cargando={cargandoCat} ayuda="en servicio" />
        </div>
      </Seccion>
    </div>
  );
}
