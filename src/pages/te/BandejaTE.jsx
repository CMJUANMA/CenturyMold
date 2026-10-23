/**
 * BandejaTE.jsx — /tiempo-extra/autorizar: lo que le toca firmar a cada quien, en tiempo real.
 *   Nivel 1: pendiente_aut1 de sus áreas (Aut. 1) · Nivel 2: pendiente_aut2 de toda la planta (Aut. 2 y RH). Con los dos roles, dos secciones.
 * Las más antiguas primero; filtros por área y fechas; detalle con Autorizar / Devolver; "Autorizar N seleccionadas" (una transacción cada una).
 * Lo que uno mismo creó aparece deshabilitado. Pensada también para el celular: tarjetas y botones grandes.
 * El Aut. 1 tiene además "Historial de mi área" (lo que ya pasó por su nivel, solo lectura).
 * Las VENCIDAS (su fecha ya pasó sin terminar de autorizarse) no salen en la lista ni en los contadores: van en la pestaña «Vencidas», solo consulta, sin Autorizar ni Devolver.
 * Las que vencen HOY llevan «Vence hoy» y salen primero.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlarmClock, CheckCircle2, Undo2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAccesos } from '../../hooks/useAccesos';
import { useAreas } from '../../hooks/useAreas';
import { useBandeja } from '../../hooks/useBandeja';
import { useCatalogos } from '../../hooks/useCatalogos';
import { useResumenTE } from '../../hooks/useResumenTE';
import { useConfirmar } from '../../hooks/useConfirmar';
import { useToast } from '../../hooks/useToast';
import { useAvisarTE } from '../../hooks/useAvisarTE';
import Ayuda from '../../components/Ayuda';
import AyudaPantalla from '../../components/AyudaPantalla';
import BadgeEstatus from '../../components/BadgeEstatus';
import InsigniasTE from '../../components/InsigniasTE';
import MotivosTE from '../../components/MotivosTE';
import Modal from '../../components/Modal';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import { AreaTexto, Campo, Entrada, Selector } from '../../components/ui/Campo';
import EncabezadoPagina from '../../components/ui/EncabezadoPagina';
import EstadoVacio from '../../components/ui/EstadoVacio';
import { EsqueletoPagina, EsqueletoTabla } from '../../components/ui/Esqueleto';
import { CASILLA } from '../../components/ui/estilos';
import Insignia from '../../components/ui/Insignia';
import Pestanas from '../../components/ui/Pestanas';
import { Fila, Tabla, Td, Th } from '../../components/ui/Tabla';
import { formatoFecha } from '../../utils/asignaciones';
import { crearFormateadorNombres } from '../../utils/nombresPersona';
import {
  MIN_MOTIVO_DEVOLUCION, MSG_YA_RESPONDIDA, TEXTO_VENCIDA, esPropia, esVencida, esperaDesde, filtrarSolicitudes, haceTiempo, totalesDe, venceHoy,
} from '../../utils/tiempoExtra';
import { YaRespondida, autorizarSolicitud, autorizarVarias, devolverSolicitud, leerHistorialTE, leerSolicitudTE } from '../../utils/tiempoExtraDb';
import DetalleTE from './DetalleTE';
import AccionCancelarTE from './AccionCancelarTE';

function VenceHoy() {
  return <Insignia tono="error" icono={AlarmClock}>Vence hoy</Insignia>;
}

export default function BandejaTE() {
  const { usuario } = useAuth();
  const accesos = useAccesos();
  const { nivel1, nivel2, vencidas, cargando, error } = useBandeja();
  const { nombres } = useAreas();
  const { rutas, comunidades, puntos } = useCatalogos({ empleados: false });
  const { delArea } = useResumenTE();
  const confirmar = useConfirmar();
  const toast = useToast();
  const avisar = useAvisarTE();
  const [ahora, setAhora] = useState(() => Date.now());
  const [pestana, setPestana] = useState('bandeja');
  const [filtros, setFiltros] = useState({ areaId: '', desde: '', hasta: '' });
  const [seleccion, setSeleccion] = useState({ 1: new Set(), 2: new Set() });
  const [detalle, setDetalle] = useState(null); // { id, nivel, solicitud, historial, cargando, soloLectura }
  const [texto, setTexto] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [resultado, setResultado] = useState(null); // { ok, fallidas }
  const vistas = useRef(new Set());
  const ocupadoRef = useRef(false);

  const esAut1 = accesos.areasAut1.length > 0;
  const firmaNivel2 = accesos.esAut2 || accesos.esRH;
  const secciones = [esAut1 && { nivel: 1, titulo: 'Nivel 1 · Autorización 1', lista: nivel1 }, firmaNivel2 && { nivel: 2, titulo: 'Nivel 2 · Autorización 2', lista: nivel2 }].filter(Boolean);

  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 60_000); return () => clearInterval(t); }, []);
  const formato = useMemo(() => crearFormateadorNombres([]), []);
  const nombreArea = (id) => nombres.get(id) ?? id;
  const areasEnBandeja = useMemo(() => [...new Set([...nivel1, ...nivel2].map(t => t.areaId))], [nivel1, nivel2]);
  const lista = (n) => filtrarSolicitudes(n === 1 ? nivel1 : nivel2, filtros);

  // Aviso cuando algo desaparece de la bandeja sin que yo lo haya respondido (el solicitante la canceló, o alguien más la respondió)
  useEffect(() => {
    if (cargando) return;
    const ahoraIds = new Set([...nivel1, ...nivel2, ...vencidas].map(t => t.id)); // al vencer solo cambia de pestaña: no avisa
    const quitadas = [...vistas.current].filter(id => !ahoraIds.has(id));
    vistas.current = ahoraIds;
    if (quitadas.length && !ocupadoRef.current) {
      toast.warning(quitadas.length === 1 ? 'Una solicitud ya no está disponible: el solicitante la canceló o alguien más la respondió.' : `${quitadas.length} solicitudes ya no están disponibles: las canceló su solicitante o alguien más las respondió.`, 7000);
      if (detalle && quitadas.includes(detalle.id)) setDetalle(null);
    }
  }, [nivel1, nivel2, vencidas, cargando, detalle, toast]);

  const abrir = async (t, nivel, soloLectura = false) => {
    setTexto('');
    setDetalle({ id: t.id, nivel, solicitud: { ...t, empleados: [] }, historial: [], cargando: true, soloLectura });
    try {
      const [s, h] = await Promise.all([leerSolicitudTE(t.id), leerHistorialTE(t.id).catch(() => [])]);
      setDetalle(d => (d?.id === t.id ? { ...d, solicitud: s ?? t, historial: h, cargando: false } : d));
    } catch (err) { toast.error('No se pudo abrir la solicitud: ' + err.message); setDetalle(null); }
  };

  const alternar = (nivel, id) => setSeleccion(s => { const n = new Set(s[nivel]); if (n.has(id)) n.delete(id); else n.add(id); return { ...s, [nivel]: n }; });
  const alternarTodas = (nivel, ids) => setSeleccion(s => ({ ...s, [nivel]: ids.every(i => s[nivel].has(i)) ? new Set() : new Set(ids) }));

  const autorizar = async () => {
    const { id, nivel, solicitud } = detalle;
    setTrabajando(true); ocupadoRef.current = true;
    try {
      await autorizarSolicitud({ id, usuario, nivel, comoRH: !accesos.esAut2, comentario: texto });
      toast.success(nivel === 1 ? 'Autorizada: pasó a Autorización 2.' : 'Autorizada.');
      await avisar.autorizacion({ nivel, folio: solicitud.folio });
      setDetalle(null);
    } catch (err) {
      if (err instanceof YaRespondida) { toast.warning(MSG_YA_RESPONDIDA, 7000); setDetalle(null); } else toast.error('No se pudo autorizar: ' + err.message, 8000);
    } finally { setTrabajando(false); setTimeout(() => { ocupadoRef.current = false; }, 1500); }
  };
  const devolver = async () => {
    const { id, nivel, solicitud } = detalle;
    setTrabajando(true); ocupadoRef.current = true;
    try {
      await devolverSolicitud({ id, usuario, nivel, motivo: texto });
      toast.success('Devuelta al solicitante.');
      avisar.devolucion({ folio: solicitud.folio, creadoPorNombre: solicitud.creadoPorNombre });
      setDetalle(null);
    } catch (err) {
      if (err instanceof YaRespondida) { toast.warning(MSG_YA_RESPONDIDA, 7000); setDetalle(null); } else toast.error('No se pudo devolver: ' + err.message, 8000);
    } finally { setTrabajando(false); setTimeout(() => { ocupadoRef.current = false; }, 1500); }
  };

  const autorizarSeleccion = async (nivel, items) => {
    const elegidas = items.filter(t => seleccion[nivel].has(t.id) && !esPropia(t, usuario.uid));
    if (!elegidas.length) return;
    const tot = totalesDe(elegidas);
    const hoyVencen = elegidas.filter(t => venceHoy(t, new Date(ahora))).length;
    const ok = await confirmar({
      titulo: `Autorizar ${tot.solicitudes} solicitudes`,
      mensaje: `${tot.empleados} empleados · ${tot.horas} horas en total.${hoyVencen ? ` ${hoyVencen} vencen hoy.` : ''} Cada una se autoriza por separado.`,
      textoConfirmar: `Autorizar ${tot.solicitudes}`,
    });
    if (!ok) return;
    setTrabajando(true); ocupadoRef.current = true;
    const r = await autorizarVarias({ tareas: elegidas.map(t => ({ id: t.id, nivel })), usuario, comoRH: !accesos.esAut2 });
    setSeleccion(s => ({ ...s, [nivel]: new Set() }));
    const folioDe = (id) => elegidas.find(t => t.id === id)?.folio ?? id;
    setResultado({ ok: r.ok.map(folioDe), fallidas: r.fallidas.map(f => ({ folio: folioDe(f.id), motivo: f.motivo })) });
    if (r.ok.length) avisar.autorizacionVarias({ nivel, cantidad: r.ok.length });
    setTrabajando(false); setTimeout(() => { ocupadoRef.current = false; }, 1500);
  };

  if (accesos.cargando || cargando) return <div className="space-y-8"><EsqueletoPagina bloques={0} /><EsqueletoTabla filas={4} columnas={8} /></div>;
  const totalPendientes = nivel1.length + nivel2.length;
  // La primera solicitud que se puede revisar (no es mía): ahí apunta el recorrido guiado
  const primeraRevisable = secciones.flatMap(s => lista(s.nivel)).find(t => !esPropia(t, usuario.uid))?.id;
  const historialArea = delArea.filter(t => t.estatus !== 'pendiente_aut1' && t.estatus !== 'borrador').sort((a, b) => esperaDesde(b) - esperaDesde(a));

  return (
    <div className="space-y-8">
      <EncabezadoPagina
        antetitulo="Tiempo extra"
        titulo="Por autorizar"
        descripcion={totalPendientes === 0 ? 'No tienes solicitudes pendientes.' : `${totalPendientes} esperando tu firma, las más antiguas primero. Se actualiza sola.`}
        ayuda={<AyudaPantalla id="autorizar" />}
      />

      {error && <Aviso tono="error" titulo="No se pudo leer la bandeja">{error.message}. Revisa tu conexión y vuelve a abrir esta pantalla.</Aviso>}

      {(esAut1 || firmaNivel2) && (
        <Pestanas etiqueta="Secciones" activa={pestana} onCambio={setPestana}
          items={[{ id: 'bandeja', etiqueta: 'Por autorizar' }, { id: 'vencidas', etiqueta: 'Vencidas', contador: vencidas.length }, ...(esAut1 ? [{ id: 'historial', etiqueta: 'Historial de mi área' }] : [])]} />
      )}

      {pestana === 'bandeja' && (
        <>
          <div data-tour="autorizar-filtros" className="space-y-2">
            <div className="grid gap-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end" role="group" aria-label="Filtros">
              <Campo etiqueta="Área">
                <Selector value={filtros.areaId} onChange={e => setFiltros(f => ({ ...f, areaId: e.target.value }))}>
                  <option value="">Todas</option>{areasEnBandeja.map(id => <option key={id} value={id}>{nombreArea(id)}</option>)}
                </Selector>
              </Campo>
              <Campo etiqueta="Fecha del tiempo extra, desde"><Entrada type="date" value={filtros.desde} onChange={e => setFiltros(f => ({ ...f, desde: e.target.value }))} /></Campo>
              <Campo etiqueta="Hasta"><Entrada type="date" value={filtros.hasta} min={filtros.desde} onChange={e => setFiltros(f => ({ ...f, hasta: e.target.value }))} /></Campo>
              {(filtros.areaId || filtros.desde || filtros.hasta) && <Boton variante="fantasma" onClick={() => setFiltros({ areaId: '', desde: '', hasta: '' })}>Limpiar filtros</Boton>}
            </div>
            <Ayuda clave="autorizar.filtros" />
          </div>

          {secciones.length === 0 && (
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]"><EstadoVacio texto="No tienes un nivel de autorización asignado. Si crees que debería tenerlo, pide al área de Sistemas o, en su caso, a Recursos Humanos que te lo asignen." /></div>
          )}
          {secciones.map(({ nivel, titulo, lista: todas }) => {
            const items = lista(nivel);
            const firmables = items.filter(t => !esPropia(t, usuario.uid));
            const marcadas = firmables.filter(t => seleccion[nivel].has(t.id));
            return (
              <section key={nivel} aria-label={titulo} data-tour={nivel === secciones[0].nivel ? 'autorizar-lista' : undefined} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="flex items-center gap-3 text-lg font-semibold text-[var(--text-main)]">{titulo}
                    <Insignia sinIcono>{items.length}{items.length !== todas.length ? ` de ${todas.length}` : ''}</Insignia></h2>
                  <div className="flex flex-wrap items-center gap-4">
                    {firmables.length > 1 && (
                      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <input type="checkbox" checked={marcadas.length === firmables.length && firmables.length > 0} onChange={() => alternarTodas(nivel, firmables.map(t => t.id))} className={CASILLA} />Todas
                      </label>
                    )}
                    <Boton variante={marcadas.length ? 'primario' : 'contorno'} estado={trabajando ? 'cargando' : undefined} icono={CheckCircle2} disabled={!marcadas.length || trabajando} onClick={() => autorizarSeleccion(nivel, items)}>
                      Autorizar {marcadas.length || ''} {marcadas.length === 1 ? 'seleccionada' : 'seleccionadas'}
                    </Boton>
                  </div>
                </div>

                <Ayuda clave="autorizar.lista" />
                {firmables.length > 1 && <Ayuda clave="autorizar.varias" />}
                {items.length === 0 ? (
                  <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
                    <EstadoVacio texto={todas.length ? 'Ninguna solicitud coincide con esos filtros.' : 'Nada pendiente en este nivel. Te avisamos cuando llegue algo.'}
                      accion={todas.length ? { texto: 'Limpiar filtros', onClick: () => setFiltros({ areaId: '', desde: '', hasta: '' }) } : undefined} />
                  </div>
                ) : (
                  <>
                    <div className="hidden md:block">
                      <Tabla etiqueta={titulo}>
                        <thead>
                          <tr><Th /><Th>Folio</Th><Th>Área</Th><Th>Solicitante</Th><Th>Fecha del TE</Th><Th derecha>Empleados</Th><Th derecha>Horas</Th><Th derecha>Transporte</Th><Th>Espera</Th><Th /></tr>
                        </thead>
                        <tbody>
                          {items.map(t => {
                            const propia = esPropia(t, usuario.uid);
                            return (
                              <Fila key={t.id} className={propia ? 'opacity-60' : ''}>
                                <Td>{!propia && <input type="checkbox" aria-label={`Seleccionar ${t.folio}`} checked={seleccion[nivel].has(t.id)} onChange={() => alternar(nivel, t.id)} className={CASILLA} />}</Td>
                                <Td mono>{t.folio}<InsigniasTE t={t} className="mt-1 !flex font-sans" /></Td>
                                <Td>{nombreArea(t.areaId)}<MotivosTE t={t} className="mt-1" /></Td>
                                <Td>{formato.nombre(t.creadoPorNombre)}</Td>
                                <Td className="whitespace-nowrap">{formatoFecha(`${t.fechaTE}T12:00:00`)} {venceHoy(t, new Date(ahora)) && <VenceHoy />}</Td>
                                <Td derecha>{t.resumen?.totalEmpleados ?? 0}</Td>
                                <Td derecha mono>{t.resumen?.totalHoras ?? 0}</Td>
                                <Td derecha>{t.resumen?.totalTransporte ?? 0}</Td>
                                <Td className="whitespace-nowrap text-[var(--text-secondary)]">{haceTiempo(esperaDesde(t), ahora)}</Td>
                                <Td className="text-right">
                                  {propia ? <span className="text-xs text-[var(--text-muted)]">No puedes autorizar tu propia solicitud</span>
                                    : <Boton tamano="sm" data-tour={t.id === primeraRevisable ? 'autorizar-revisar' : undefined} onClick={() => abrir(t, nivel)}>Revisar</Boton>}
                                </Td>
                              </Fila>
                            );
                          })}
                        </tbody>
                      </Tabla>
                    </div>
                    <ul className="space-y-3 md:hidden">
                      {items.map(t => {
                        const propia = esPropia(t, usuario.uid);
                        return (
                          <li key={t.id} className={`rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 ${propia ? 'opacity-60' : ''}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div><p className="font-mono text-sm font-medium text-[var(--text-main)]">{t.folio}</p><p className="text-xs text-[var(--text-secondary)]">{nombreArea(t.areaId)} · {formato.nombre(t.creadoPorNombre)}</p><InsigniasTE t={t} className="mt-1" /><MotivosTE t={t} className="mt-1" /></div>
                              {!propia && (
                                <label className="-m-2 flex h-11 w-11 cursor-pointer items-center justify-center">
                                  <input type="checkbox" aria-label={`Seleccionar ${t.folio}`} checked={seleccion[nivel].has(t.id)} onChange={() => alternar(nivel, t.id)} className={CASILLA} />
                                </label>
                              )}
                            </div>
                            <p className="mt-2 text-sm text-[var(--text-main)]">{formatoFecha(`${t.fechaTE}T12:00:00`)} {venceHoy(t, new Date(ahora)) && <VenceHoy />}</p>
                            <p className="mt-1 text-xs text-[var(--text-secondary)]"><b className="font-medium">{t.resumen?.totalEmpleados ?? 0}</b> empleados · <b className="font-medium">{t.resumen?.totalHoras ?? 0}</b> h · <b className="font-medium">{t.resumen?.totalTransporte ?? 0}</b> con transporte · {haceTiempo(esperaDesde(t), ahora)}</p>
                            {propia ? <p className="mt-3 text-xs text-[var(--text-muted)]">No puedes autorizar tu propia solicitud</p>
                              : <Boton className="mt-3 w-full" data-tour={t.id === primeraRevisable ? 'autorizar-revisar' : undefined} onClick={() => abrir(t, nivel)}>Revisar y responder</Boton>}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </section>
            );
          })}
        </>
      )}

      {pestana === 'vencidas' && (
        <section aria-label="Vencidas" className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">Su fecha ya pasó y no se terminaron de autorizar: ya no se pueden autorizar ni devolver. Solo consulta; quien la solicitó puede duplicarla con otra fecha.</p>
          {vencidas.length === 0 ? (
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]"><EstadoVacio texto="No hay solicitudes vencidas." /></div>
          ) : (
            <Tabla etiqueta="Solicitudes vencidas">
              <thead><tr><Th>Folio</Th><Th>Área</Th><Th>Solicitante</Th><Th>Fecha del TE</Th><Th derecha>Empleados</Th><Th derecha>Horas</Th><Th>Estatus</Th><Th /></tr></thead>
              <tbody>
                {vencidas.map(t => (
                  <Fila key={t.id}>
                    <Td mono>{t.folio ?? '—'}<InsigniasTE t={t} className="mt-1 !flex font-sans" /></Td><Td>{nombreArea(t.areaId)}<MotivosTE t={t} className="mt-1" /></Td><Td>{formato.nombre(t.creadoPorNombre)}</Td>
                    <Td className="whitespace-nowrap">{formatoFecha(`${t.fechaTE}T12:00:00`)}</Td><Td derecha>{t.resumen?.totalEmpleados ?? 0}</Td><Td derecha mono>{t.resumen?.totalHoras ?? 0}</Td>
                    <Td><BadgeEstatus t={t} modulo="te" /><p className="mt-1 text-xs text-[var(--text-secondary)]">{TEXTO_VENCIDA} · era de nivel {t.nivel}</p></Td>
                    <Td className="text-right"><Boton tamano="sm" onClick={() => abrir(t, t.nivel, true)}>Ver</Boton></Td>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
          )}
        </section>
      )}

      {pestana === 'historial' && esAut1 && (
        <section aria-label="Historial de mi área" className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">Lo que ya pasó por tu nivel (en autorización de nivel 2, autorizadas, devueltas y canceladas). Solo lectura.</p>
          {historialArea.length === 0 ? (
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]"><EstadoVacio texto="Todavía no hay historial en tu área." /></div>
          ) : (
            <Tabla etiqueta="Historial de mi área">
              <thead><tr><Th>Folio</Th><Th>Área</Th><Th>Solicitante</Th><Th>Fecha del TE</Th><Th derecha>Empleados</Th><Th derecha>Horas</Th><Th>Estatus</Th><Th /></tr></thead>
              <tbody>
                {historialArea.map(t => (
                  <Fila key={t.id}>
                    <Td mono>{t.folio ?? '—'}<InsigniasTE t={t} className="mt-1 !flex font-sans" /></Td><Td>{nombreArea(t.areaId)}<MotivosTE t={t} className="mt-1" /></Td><Td>{formato.nombre(t.creadoPorNombre)}</Td>
                    <Td className="whitespace-nowrap">{formatoFecha(`${t.fechaTE}T12:00:00`)}</Td><Td derecha>{t.resumen?.totalEmpleados ?? 0}</Td><Td derecha mono>{t.resumen?.totalHoras ?? 0}</Td>
                    <Td><BadgeEstatus t={t} modulo="te" /></Td>
                    <Td className="text-right"><Boton tamano="sm" onClick={() => abrir(t, 1, true)}>Ver</Boton></Td>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
          )}
        </section>
      )}

      {detalle && (
        <Modal isOpen onClose={() => !trabajando && setDetalle(null)} title={detalle.solicitud.folio ?? 'Solicitud'} maxWidth="max-w-4xl" preventCloseOnBackdrop={trabajando}>
          {detalle.cargando ? <EsqueletoTabla filas={3} columnas={4} /> : (
            <DetalleTE t={detalle.solicitud} historial={detalle.historial} area={nombreArea(detalle.solicitud.areaId)} catalogos={{ rutas, comunidades, puntos }} formato={formato}
              acciones={detalle.soloLectura || esVencida(detalle.solicitud, new Date(ahora)) ? null : esPropia(detalle.solicitud, usuario.uid)
                ? (
                  <div className="flex w-full flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-[var(--text-muted)]">No puedes autorizar tu propia solicitud.</p>
                    <AccionCancelarTE t={detalle.solicitud} onHecho={() => setDetalle(null)} />
                  </div>
                )
                : (
                  <div className="w-full space-y-3">
                    <Campo etiqueta="Comentario" ayuda={`Opcional al autorizar. Obligatorio al devolver: mínimo ${MIN_MOTIVO_DEVOLUCION} caracteres (llevas ${texto.trim().length}).`}>
                      <AreaTexto id="comentario-firma" rows={2} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Comentario o motivo de la devolución…" />
                    </Campo>
                    <Ayuda clave="autorizar.comentario" />
                    <Ayuda clave="autorizar.autorizar" className="!mt-0" />
                    <Ayuda clave="autorizar.devolver" className="!mt-0" />
                    {(detalle.solicitud.rutasDistintas ?? 0) > 1 && <Ayuda clave="autorizar.rutas" className="!mt-0 font-semibold !text-[var(--status-warning-text)]" />}
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                      <AccionCancelarTE id="btn-cancelar-solicitud" tamano="md" t={detalle.solicitud} onHecho={() => setDetalle(null)} />
                      <Boton id="btn-devolver" variante="peligro" icono={Undo2} disabled={trabajando || texto.trim().length < MIN_MOTIVO_DEVOLUCION} onClick={devolver}>Devolver</Boton>
                      <Boton id="btn-autorizar" variante="primario" icono={CheckCircle2} estado={trabajando ? 'cargando' : undefined} onClick={autorizar}>{detalle.nivel === 1 ? 'Autorizar (pasa a nivel 2)' : 'Autorizar'}</Boton>
                    </div>
                  </div>
                )} />
          )}
        </Modal>
      )}

      {resultado && (
        <Modal isOpen onClose={() => setResultado(null)} title="Resultado de la autorización" maxWidth="max-w-md">
          <div className="space-y-4 text-sm">
            <Aviso tono="exito">{resultado.ok.length} autorizadas{resultado.ok.length ? `: ${resultado.ok.join(', ')}` : ''}</Aviso>
            {resultado.fallidas.length > 0 && (
              <Aviso tono="error" titulo={`${resultado.fallidas.length} no se pudieron autorizar`}>
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
