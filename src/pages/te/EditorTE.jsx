/**
 * EditorTE.jsx — Captura de tiempo extra (/tiempo-extra/nueva) y edición de un borrador o de una devuelta (/tiempo-extra/:id/editar).
 *
 * Todo nace como BORRADOR (solo lo ve su creador): "Guardar borrador" escribe la solicitud y los empleados en lotes de 10 con barra
 * de progreso y se puede salir y continuar. "Enviar a autorización" valida, pide confirmación con el resumen, asigna el FOLIO (contador en
 * transacción) y pasa a pendiente_aut1, o a pendiente_aut2 si quien captura es Aut. 1 vigente de esa área. Si quien captura es Aut. 2 vigente, queda
 * autorizada al enviarla (firma de nivel 2 propia) y pasa directo a "Por enviar al proveedor".
 * Si la sesión se cierra por inactividad con cambios sin guardar, el borrador se guarda solo antes de salir (utils/guardadoAutomatico.js).
 *
 * Tipo: "Turno extra / día extra" (el empleado viene a la planta) o "Extensión de turno" (ya está en la planta: el tiempo extra empieza al
 * terminar su turno normal y solo lleva transporte de salida). Rutas: se cuentan las rutas distintas; con más de una se exige justificarlo.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Loader2, Plus, Route, Save, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAccesos } from '../../hooks/useAccesos';
import { useAreas } from '../../hooks/useAreas';
import { useCatalogos } from '../../hooks/useCatalogos';
import { useConfirmar } from '../../hooks/useConfirmar';
import { useToast } from '../../hooks/useToast';
import { useAvisarTE } from '../../hooks/useAvisarTE';
import Ayuda from '../../components/Ayuda';
import AyudaPantalla from '../../components/AyudaPantalla';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import { AreaTexto, Campo, Entrada, Selector } from '../../components/ui/Campo';
import EncabezadoPagina from '../../components/ui/EncabezadoPagina';
import EstadoVacio from '../../components/ui/EstadoVacio';
import { EsqueletoPagina } from '../../components/ui/Esqueleto';
import { CASILLA } from '../../components/ui/estilos';
import Insignia from '../../components/ui/Insignia';
import { Tarjeta } from '../../components/ui/Tarjeta';
import { esActivo, rutaVigente } from '../../utils/activo';
import { ymd } from '../../utils/fechas';
import { registrarGuardador } from '../../utils/guardadoAutomatico';
import {
  HORAS_ENTRADA_TE, HORAS_SALIDA_TE, MIN_COMENTARIO_TE, MIN_JUSTIFICACION_RUTAS, MAX_MOTIVO_OTRO, MOTIVO_OTRO, MOTIVOS_TE, TIPOS_TE, TIPOS_TE_INFO, aplicarA, conTransporte, datosTE,
  empleadoDesdePadron, estatusAlEnviar, normalizarTipo, nuevoIdBorrador, problemasDeEnvio, quienDevolvio, resumenRutas, resumenTE, salidasPosteriores, textoRutas,
} from '../../utils/tiempoExtra';
import { MAX_PASAJEROS } from '../../utils/solicitudes';
import {
  cancelarSolicitud, eliminarBorrador, enviarSolicitud, guardarBorrador, guardarRutasEnPadron, leerOcupados, leerSolicitudTE,
} from '../../utils/tiempoExtraDb';
import FilaEmpleadoTE, { COLUMNAS_FILA } from './FilaEmpleadoTE';
import SelectorEmpleadosTE from './SelectorEmpleadosTE';

export default function EditorTE() {
  const { id: idParam } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const accesos = useAccesos();
  const { areas, cargando: cargandoAreas } = useAreas();
  const { rutas, comunidades, puntos, empleados: padron, cargando: cargandoCat, parchearEmpleados } = useCatalogos();
  const confirmar = useConfirmar();
  const toast = useToast();
  const avisar = useAvisarTE();

  const [idNuevo] = useState(() => nuevoIdBorrador());
  const id = idParam ?? idNuevo;
  const [hoy] = useState(() => ymd());
  const [cargandoDoc, setCargandoDoc] = useState(!!idParam);
  const [servidor, setServidor] = useState(null); // { existe, estatus, folio, devolucion }
  const [areaId, setAreaId] = useState('');
  const [fechaTE, setFechaTE] = useState('');
  const [tipo, setTipo] = useState(TIPOS_TE.TURNO_EXTRA);
  const [motivo, setMotivo] = useState('');
  const [motivoOtro, setMotivoOtro] = useState('');
  const [comentario, setComentario] = useState('');
  const [justificacionRutas, setJustificacionRutas] = useState('');
  const [empleados, setEmpleados] = useState([]);
  const [sucios, setSucios] = useState(() => new Set());
  const [eliminados, setEliminados] = useState(() => new Set());
  const enServidor = useRef(new Set());
  const [seleccion, setSeleccion] = useState(() => new Set());
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [ocupados, setOcupados] = useState(() => new Map());
  const [intentoEnvio, setIntentoEnvio] = useState(false);
  const [trabajo, setTrabajo] = useState(null); // { texto, hechos, total }
  const [bulk, setBulk] = useState({ entrada: '', salida: '' });

  const existe = !!servidor?.existe;
  const esDevuelta = servidor?.estatus === 'devuelta';
  const extension = tipo === TIPOS_TE.EXTENSION;

  // Áreas donde puede capturar: sus áreas de solicitante/Aut. 1 con participaTE; RH y Aut. 2, también las que no participan
  const areasCaptura = useMemo(() => {
    const propias = new Set([...accesos.areasSolicitante, ...accesos.areasAut1]);
    const lista = areas.filter(a => propias.has(a.id) && a.participaTE);
    if (accesos.esRH || accesos.esAut2) lista.push(...areas.filter(a => a.participaTE === false && a.activa !== false));
    return lista;
  }, [areas, accesos.areasSolicitante, accesos.areasAut1, accesos.esRH, accesos.esAut2]);
  const areaActual = areaId || (areasCaptura.length === 1 ? areasCaptura[0].id : '');
  const area = areas.find(a => a.id === areaActual);
  const esAut1DeLaArea = accesos.areasAut1.includes(areaActual);
  // Un Aut. 2 vigente autoriza lo que captura (es el nivel más alto): su solicitud queda autorizada al enviarla
  const esAut2 = !!accesos.esAut2;

  // Cambios sin guardar de la cabecera (fecha, motivo, comentario…): los empleados se siguen aparte (sucios/eliminados)
  const firmaCabecera = [areaActual, fechaTE, tipo, motivo, motivoOtro, comentario, justificacionRutas].join('\u0001');
  const firmaGuardada = useRef(null);

  // Abrir un borrador o una devuelta existente
  useEffect(() => {
    if (!idParam || !usuario?.uid) return;
    let vigente = true;
    leerSolicitudTE(idParam).then(t => {
      if (!vigente) return;
      if (!t || t.creadoPor !== usuario.uid || !['borrador', 'devuelta'].includes(t.estatus)) {
        toast.error('Solo puedes editar tus borradores y tus solicitudes devueltas.');
        navigate('/tiempo-extra/mis-solicitudes', { replace: true });
        return;
      }
      setServidor({ existe: true, estatus: t.estatus, folio: t.folio ?? null, devolucion: t.devolucion ?? null });
      setAreaId(t.areaId); setFechaTE(t.fechaTE ?? ''); setMotivo(t.motivo ?? ''); setMotivoOtro(t.motivoOtro ?? ''); setComentario(t.comentario ?? '');
      setTipo(normalizarTipo(t.tipo)); setJustificacionRutas(t.justificacionRutas ?? '');
      setEmpleados(t.empleados);
      enServidor.current = new Set(t.empleados.map(e => e.nomina));
      firmaGuardada.current = [t.areaId, t.fechaTE ?? '', normalizarTipo(t.tipo), t.motivo ?? '', t.motivoOtro ?? '', t.comentario ?? '', t.justificacionRutas ?? ''].join('\u0001');
      setCargandoDoc(false);
    }).catch(err => { if (vigente) { toast.error('No se pudo abrir la solicitud: ' + err.message); navigate('/tiempo-extra/mis-solicitudes', { replace: true }); } });
    return () => { vigente = false; };
  }, [idParam, usuario?.uid, navigate, toast]);

  // Aviso (sin bloquear) de quien ya tiene otro tiempo extra ese día
  useEffect(() => {
    if (!fechaTE || !areaActual || !usuario?.uid) return;
    let vigente = true;
    const t = setTimeout(() => {
      leerOcupados({ uid: usuario.uid, areaId: areaActual, fechaTE, esAut1DeLaArea, excluirId: id }).then(m => { if (vigente) setOcupados(m); });
    }, 400);
    return () => { vigente = false; clearTimeout(t); };
  }, [fechaTE, areaActual, usuario?.uid, esAut1DeLaArea, id]);

  const nombreRuta = (rid) => rutas.find(r => r.id === rid)?.nombre ?? '';
  const empleadosArea = useMemo(() => padron.filter(e => esActivo(e) && e.areaId === areaActual), [padron, areaActual]);
  const yaAgregados = useMemo(() => new Set(empleados.map(e => e.nomina)), [empleados]);
  const resumen = useMemo(() => resumenTE(empleados), [empleados]);
  const infoRutas = useMemo(() => resumenRutas(empleados, (rid) => rutas.find(r => r.id === rid)?.nombre ?? ''), [empleados, rutas]);
  const variasRutas = infoRutas.rutasDistintas > 1;
  const problemas = useMemo(
    () => problemasDeEnvio({ areaId: areaActual, fechaTE, motivo, motivoOtro, comentario, empleados, hoy, ocupados, tipo, justificacionRutas }),
    [areaActual, fechaTE, motivo, motivoOtro, comentario, empleados, hoy, ocupados, tipo, justificacionRutas],
  );
  const errores = problemas.filter(p => p.nivel === 'error');
  const avisoDe = (nomina) => problemas.find(p => p.nivel === 'aviso' && p.nomina === nomina)?.mensaje;
  const errorDe = (nomina) => (intentoEnvio ? errores.find(p => p.nomina === nomina)?.mensaje : undefined);
  const faltaJustificacion = variasRutas && justificacionRutas.trim().length < MIN_JUSTIFICACION_RUTAS;

  const ocupado = !!trabajo;
  const extras = () => datosTE({ tipo, empleados, justificacionRutas, nombreRuta, motivo, motivoOtro });

  // ── Edición ────────────────────────────────────────────────────────────
  const agregar = (lista) => {
    const nuevos = lista.filter(e => !yaAgregados.has(String(e.nomina))).slice(0, Math.max(0, MAX_PASAJEROS - empleados.length));
    if (nuevos.length < lista.length) toast.warning(`Se agregaron ${nuevos.length}: máximo ${MAX_PASAJEROS} empleados por solicitud.`);
    const catalogos = { rutas, comunidades, puntos };
    const filas = nuevos.map(e => empleadoDesdePadron(e, rutaVigente(e, catalogos), { tipo }));
    setEmpleados(prev => [...prev, ...filas]);
    setSucios(prev => new Set([...prev, ...filas.map(f => f.nomina)]));
    setEliminados(prev => { const s = new Set(prev); filas.forEach(f => s.delete(f.nomina)); return s; });
    setSelectorAbierto(false);
  };
  const cambiar = (nomina, parche) => {
    setEmpleados(prev => prev.map(e => {
      if (e.nomina !== nomina) return e;
      const nuevo = conTransporte({ ...e, ...parche });
      return nuevo.transporte ? nuevo : { ...nuevo, necesitaConfirmar: false, confirmada: false };
    }));
    setSucios(prev => new Set(prev).add(nomina));
  };
  const quitar = (nomina) => {
    setEmpleados(prev => prev.filter(e => e.nomina !== nomina));
    setSucios(prev => { const s = new Set(prev); s.delete(nomina); return s; });
    setSeleccion(prev => { const s = new Set(prev); s.delete(nomina); return s; });
    if (enServidor.current.has(nomina)) setEliminados(prev => new Set(prev).add(nomina));
  };
  const alternarSeleccion = (nomina) => setSeleccion(prev => { const s = new Set(prev); if (s.has(nomina)) s.delete(nomina); else s.add(nomina); return s; });
  const aplicarMasivo = (cambios) => {
    const objetivo = seleccion.size ? seleccion : null;
    setEmpleados(prev => aplicarA(prev, objetivo, cambios));
    setSucios(prev => new Set([...prev, ...(objetivo ?? empleados.map(e => e.nomina))]));
  };
  const aplicarHorario = () => {
    if (extension) {
      if (!bulk.entrada && !bulk.salida) { toast.warning('Elige cuándo termina su turno o hasta qué hora se quedan para aplicar.'); return; }
      if (bulk.entrada && bulk.salida && !salidasPosteriores(bulk.entrada).includes(bulk.salida)) { toast.warning('Se quedan hasta una hora posterior al fin de su turno.'); return; }
      // Cambiar el fin de turno borra la hora hasta la que se quedan (sus opciones dependen de él)
      aplicarMasivo({ ...(bulk.entrada ? { horaEntrada: bulk.entrada, horaSalida: '' } : {}), ...(bulk.salida ? { horaSalida: bulk.salida } : {}) });
      return;
    }
    if (!bulk.entrada || !bulk.salida) { toast.warning('Elige la entrada y la salida para aplicar.'); return; }
    if (bulk.entrada === bulk.salida) { toast.warning('La entrada y la salida no pueden ser iguales.'); return; }
    aplicarMasivo({ horaEntrada: bulk.entrada, horaSalida: bulk.salida });
  };
  const confirmarRutasPrecargadas = () => {
    setEmpleados(prev => prev.map(e => (e.transporte && e.necesitaConfirmar && !e.confirmada && e.rutaId && e.comunidadId && e.puntoReunionId ? { ...e, confirmada: true } : e)));
    setSucios(prev => new Set([...prev, ...empleados.map(e => e.nomina)]));
  };

  /** Cambiar el tipo reinicia horarios y transporte de los empleados ya agregados (empiezan distinto): se pide confirmar */
  const cambiarTipo = async (nuevo) => {
    if (nuevo === tipo) return;
    if (empleados.length) {
      const ok = await confirmar({
        titulo: 'Cambiar el tipo de tiempo extra',
        mensaje: `Los ${empleados.length} empleados ya agregados volverán a empezar: se borran sus horarios y se reinicia su transporte (${nuevo === TIPOS_TE.EXTENSION ? 'solo salida' : 'llegada y salida'}).`,
        textoConfirmar: 'Cambiar',
      });
      if (!ok) return;
      setEmpleados(prev => prev.map(e => conTransporte({
        ...e, horaEntrada: '', horaSalida: '',
        transporteLlegada: nuevo !== TIPOS_TE.EXTENSION, transporteSalida: true,
      })));
      setSucios(prev => new Set([...prev, ...empleados.map(e => e.nomina)]));
      setBulk({ entrada: '', salida: '' });
    }
    setTipo(nuevo);
  };

  // ── Guardar ────────────────────────────────────────────────────────────
  /** Ruta confirmada → padrón (solo si cambió; un fallo avisa pero no detiene el guardado) */
  const recordarRutas = async () => {
    const cambios = {};
    for (const e of empleados) {
      if (!e.transporte || !e.rutaId || !e.comunidadId || !e.puntoReunionId || (e.necesitaConfirmar && !e.confirmada)) continue;
      const p = padron.find(x => String(x.nomina) === e.nomina);
      if (p && (p.rutaId !== e.rutaId || p.comunidadId !== e.comunidadId || p.puntoReunionId !== e.puntoReunionId)) {
        cambios[e.nomina] = { rutaId: e.rutaId, comunidadId: e.comunidadId, puntoReunionId: e.puntoReunionId };
      }
    }
    if (!Object.keys(cambios).length) return;
    try { await guardarRutasEnPadron(cambios); parchearEmpleados(cambios); }
    catch (err) { console.error('Rutas al padrón:', err); toast.warning('La solicitud se guardó, pero no se pudieron recordar las rutas en el padrón.'); }
  };
  const guardar = async (texto = 'Guardando borrador') => {
    const meta = areas.find(a => a.id === areaActual);
    await guardarBorrador({
      id, existe, usuario, area: { id: areaActual, nombre: meta?.nombre ?? areaActual }, fechaTE, motivo, comentario, empleados, sucios, eliminados, extras: extras(),
      onProgreso: (hechos, total) => setTrabajo({ texto, hechos, total }),
    });
    enServidor.current = new Set(empleados.map(e => e.nomina));
    firmaGuardada.current = firmaCabecera;
    setSucios(new Set()); setEliminados(new Set());
    setServidor(s => ({ ...(s ?? {}), existe: true, estatus: s?.estatus ?? 'borrador', folio: s?.folio ?? null }));
    await recordarRutas();
  };

  // Cierre por inactividad: si hay cambios sin guardar, se guarda el borrador antes de cerrar la sesión (hace falta área y fecha: sin ellas
  // las reglas no admiten el borrador). La función registrada siempre usa lo último que ve la persona.
  const guardarAuto = async () => {
    const cabeceraCambiada = firmaGuardada.current === null
      ? [fechaTE, motivo, motivoOtro, comentario, justificacionRutas].some(v => String(v).trim())
      : firmaCabecera !== firmaGuardada.current;
    const hayCambios = sucios.size > 0 || eliminados.size > 0 || cabeceraCambiada || (!existe && empleados.length > 0);
    if (ocupado || cargandoDoc || !hayCambios || !areaActual || !fechaTE) return false;
    await guardar('Guardando borrador');
    return true;
  };
  const guardarAutoRef = useRef(guardarAuto);
  useEffect(() => { guardarAutoRef.current = guardarAuto; });
  useEffect(() => registrarGuardador(() => guardarAutoRef.current()), []);

  const guardarBorradorClick = async () => {
    if (!areaActual) { toast.warning('Elige el área.'); return; }
    setTrabajo({ texto: 'Guardando borrador', hechos: 0, total: 1 });
    try {
      await guardar();
      toast.success('Borrador guardado. Puedes salir y continuar después.');
      if (!idParam) navigate(`/tiempo-extra/${id}/editar`, { replace: true });
    } catch (err) { console.error(err); toast.error('No se pudo guardar: ' + err.message); }
    finally { setTrabajo(null); }
  };

  const enviarClick = async () => {
    setIntentoEnvio(true);
    if (errores.length) { toast.error(`Faltan ${errores.length} cosas por corregir antes de enviar.`); document.getElementById('problemas-te')?.scrollIntoView({ behavior: 'smooth' }); return; }
    const estatus = estatusAlEnviar({ esAut1DeLaArea, areaParticipa: area?.participaTE !== false, esAut2 });
    const destino = estatus === 'autorizada' ? 'Por enviar al proveedor' : estatus === 'pendiente_aut2' ? 'Autorización 2' : 'Autorización 1';
    const ok = await confirmar({
      titulo: esDevuelta ? 'Reenviar a autorización' : 'Enviar a autorización',
      mensaje: `${resumen.totalEmpleados} empleados · ${resumen.totalHoras} h en total · ${resumen.totalTransporte} con transporte · ${resumen.totalAlimentos} con alimentos`
        + `${infoRutas.rutasDistintas ? ` · ${infoRutas.rutasDistintas} ${infoRutas.rutasDistintas === 1 ? 'ruta' : 'rutas'}` : ''}. `
        + `Va a ${destino}. ${esDevuelta ? 'Vuelve a empezar su autorización.' : 'Se le asignará su folio.'} El transporte se solicitará automáticamente a RH al quedar autorizada.`
        + (esAut2 ? ' Como eres Autorización 2, al enviarla quedará autorizada.' : ''),
      textoConfirmar: esDevuelta ? 'Reenviar' : 'Enviar',
    });
    if (!ok) return;
    setTrabajo({ texto: 'Guardando empleados', hechos: 0, total: 1 });
    try {
      await guardar('Guardando empleados');
      setTrabajo({ texto: 'Enviando', hechos: 1, total: 1 });
      const folio = await enviarSolicitud({ id, devuelta: esDevuelta, usuario, estatus, fechaTE, motivo, comentario, empleados, extras: extras() });
      toast.success(esDevuelta ? `Reenviada (${folio}).` : `Enviada con el folio ${folio}.`);
      await avisar.envio({ folio, estatus, areaId: areaActual, reenviada: esDevuelta });
      navigate('/tiempo-extra/mis-solicitudes', { replace: true });
    } catch (err) { console.error(err); toast.error('No se pudo enviar: ' + err.message, 8000); setTrabajo(null); }
  };

  const eliminarClick = async () => {
    if (!await confirmar({ titulo: 'Eliminar borrador', mensaje: 'Se borrará el borrador y sus empleados. No se puede deshacer.', textoConfirmar: 'Eliminar', peligroso: true })) return;
    setTrabajo({ texto: 'Eliminando borrador', hechos: 0, total: 1 });
    try { await eliminarBorrador(id); toast.success('Borrador eliminado.'); navigate('/tiempo-extra/mis-solicitudes', { replace: true }); }
    catch (err) { toast.error('No se pudo eliminar: ' + err.message); setTrabajo(null); }
  };
  const cancelarClick = async () => {
    const motivoCancelacion = await confirmar({
      titulo: 'Cancelar solicitud', mensaje: 'La solicitud devuelta se cancela y ya no se podrá reenviar.', textoConfirmar: 'Cancelar solicitud', peligroso: true,
      campo: { etiqueta: 'Motivo de la cancelación', minLength: 3, multilinea: true },
    });
    if (!motivoCancelacion) return;
    try { await cancelarSolicitud({ id, usuario, motivo: motivoCancelacion }); toast.success('Solicitud cancelada.'); navigate('/tiempo-extra/mis-solicitudes', { replace: true }); }
    catch (err) { toast.error('No se pudo cancelar: ' + err.message); }
  };

  if (accesos.cargando || cargandoAreas || cargandoCat || cargandoDoc) return <EsqueletoPagina />;
  if (areasCaptura.length === 0 && !idParam) {
    return <EstadoVacio titulo="No tienes un área asignada" texto="Para solicitar tiempo extra necesitas un área asignada. Pide al área de Sistemas o, en su caso, a Recursos Humanos que te la asignen." accion={{ texto: 'Volver al inicio', to: '/' }} />;
  }
  const nombreArea = area?.nombre ?? areasCaptura.find(a => a.id === areaActual)?.nombre ?? areaActual;
  const sinGuardar = sucios.size > 0 || eliminados.size > 0;

  return (
    <div className="space-y-6 pb-4">
      <EncabezadoPagina
        antetitulo="Tiempo extra"
        titulo={esDevuelta ? `Corregir ${servidor.folio ?? 'solicitud devuelta'}` : existe ? 'Continuar borrador' : 'Solicitar tiempo extra'}
        descripcion={<>Área: <b className="font-medium text-[var(--text-main)]">{nombreArea || '—'}</b>{esAut2 ? ' · Como eres Autorización 2, al enviarla quedará autorizada.' : esAut1DeLaArea ? ' · Al enviarla pasa directo a Autorización 2 (eres su Aut. 1).' : ''}</>}
        ayuda={<AyudaPantalla id="solicitar" />}
      />

      {esDevuelta && servidor.devolucion && (
        <Aviso tono="aviso" titulo={`Devuelta por ${quienDevolvio(servidor.devolucion.nivel)}`}>
          <p>{servidor.devolucion.motivo}</p>
          <p className="mt-1 text-xs opacity-90">Corrige y reenvía: vuelve a empezar en Autorización 1.</p>
        </Aviso>
      )}

      <Tarjeta titulo="Datos generales" className="" cuerpoClassName="p-5 sm:p-6">
        <section aria-label="Datos generales" data-tour="solicitar-datos">
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <Campo etiqueta="Área">
                {areasCaptura.length > 1 && !idParam ? (
                  <Selector id="te-area" value={areaActual} onChange={e => { setAreaId(e.target.value); if (empleados.length) toast.warning('Cambiar de área quita los empleados agregados.'); setEmpleados([]); setSucios(new Set()); setEliminados(new Set()); }}>
                    <option value="">Elige el área…</option>
                    {areasCaptura.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </Selector>
                ) : <Entrada id="te-area" value={nombreArea} disabled readOnly />}
              </Campo>
              <Ayuda clave="solicitar.area" />
            </div>
            <div>
              <Campo etiqueta="Fecha del tiempo extra">
                <Entrada id="te-fecha" type="date" min={hoy} value={fechaTE} onChange={e => setFechaTE(e.target.value)} />
              </Campo>
              <Ayuda clave="solicitar.fecha" />
            </div>
            <div>
              <Campo etiqueta="Motivo">
                <Selector id="te-motivo" value={motivo} onChange={e => { setMotivo(e.target.value); if (e.target.value !== MOTIVO_OTRO) setMotivoOtro(''); }}>
                  <option value="">Elige el motivo…</option>
                  {MOTIVOS_TE.map(m => <option key={m} value={m}>{m}</option>)}
                </Selector>
              </Campo>
              <Ayuda clave="solicitar.motivo" />
              {motivo === MOTIVO_OTRO && (
                <Campo className="mt-3" etiqueta="¿Cuál?" obligatorio ayuda={`${motivoOtro.length}/${MAX_MOTIVO_OTRO} caracteres`}>
                  <Entrada id="te-motivo-otro" value={motivoOtro} maxLength={MAX_MOTIVO_OTRO} onChange={e => setMotivoOtro(e.target.value)} placeholder="Escribe el motivo" />
                </Campo>
              )}
            </div>
          </div>

          <fieldset className="mt-6">
            <legend className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Tipo de tiempo extra</legend>
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de tiempo extra">
              {TIPOS_TE_INFO.map(t => (
                <label key={t.value} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors duration-150 ${tipo === t.value
                  ? 'border-[var(--text-main)] bg-[var(--bg-surface-hover)]' : 'border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]'}`}>
                  <input type="radio" name="te-tipo" value={t.value} checked={tipo === t.value} onChange={() => cambiarTipo(t.value)} disabled={ocupado} className={`${CASILLA} mt-0.5`} />
                  <span>
                    <span className="block text-sm font-medium text-[var(--text-main)]">{t.label}</span>
                    <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">{t.value === TIPOS_TE.EXTENSION ? 'El empleado ya está en la planta y se queda más tiempo.' : 'El empleado viene a la planta para el tiempo extra.'}</span>
                  </span>
                </label>
              ))}
            </div>
            <Ayuda clave="solicitar.tipo" />
          </fieldset>

          <div className="mt-6">
            <Campo etiqueta="Comentario" obligatorio ayuda={`Al menos ${MIN_COMENTARIO_TE} caracteres (llevas ${comentario.trim().length}).`}>
              <AreaTexto id="te-comentario" rows={3} value={comentario} onChange={e => setComentario(e.target.value)} placeholder="¿Por qué se necesita el tiempo extra?" />
            </Campo>
            <Ayuda clave="solicitar.comentario" />
          </div>
        </section>
      </Tarjeta>

      <Tarjeta
        titulo={<>Empleados <span className="ml-1 font-mono text-[var(--text-secondary)]">{empleados.length}</span></>}
        accion={<Boton id="btn-agregar-empleados" data-tour="solicitar-agregar" icono={Plus} disabled={!areaActual || ocupado} onClick={() => setSelectorAbierto(true)}>Agregar empleados</Boton>}
        cuerpoClassName="p-5 sm:p-6"
      >
        <section aria-label="Empleados">
          <Ayuda clave="solicitar.agregar" className="-mt-2 mb-3" />

          {empleados.length > 0 && (
            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-4" role="group" aria-label="Aplicar a todos o a los seleccionados">
              <span className="w-full text-xs font-medium text-[var(--text-secondary)]">Aplicar a {seleccion.size ? `los ${seleccion.size} seleccionados` : 'todos'}:</span>
              <Selector aria-label={extension ? 'Fin de turno para aplicar' : 'Entrada para aplicar'} value={bulk.entrada} onChange={e => setBulk(b => ({ ...b, entrada: e.target.value }))} className="!w-auto">
                <option value="">{extension ? 'Termina su turno…' : 'Entrada…'}</option>{(extension ? HORAS_SALIDA_TE : HORAS_ENTRADA_TE).map(h => <option key={h} value={h}>{h}</option>)}
              </Selector>
              <Selector aria-label={extension ? 'Hora hasta la que se quedan, para aplicar' : 'Salida para aplicar'} value={bulk.salida} onChange={e => setBulk(b => ({ ...b, salida: e.target.value }))} className="!w-auto">
                <option value="">{extension ? 'Se quedan hasta…' : 'Salida…'}</option>{HORAS_SALIDA_TE.map(h => <option key={h} value={h}>{h}</option>)}
              </Selector>
              <Boton tamano="sm" onClick={aplicarHorario}>Aplicar horario</Boton>
              <Boton tamano="sm" onClick={() => aplicarMasivo({ alimentos: true })}>Con alimentos</Boton>
              <Boton tamano="sm" onClick={() => aplicarMasivo({ alimentos: false })}>Sin alimentos</Boton>
              <Boton tamano="sm" onClick={() => aplicarMasivo({ transporteLlegada: !extension, transporteSalida: true })}>Con transporte</Boton>
              <Boton tamano="sm" onClick={() => aplicarMasivo({ transporteLlegada: false, transporteSalida: false })}>Sin transporte</Boton>
              {empleados.some(e => e.transporte && e.necesitaConfirmar && !e.confirmada) && (
                <Boton tamano="sm" variante="secundario" icono={AlertTriangle} onClick={confirmarRutasPrecargadas}>Confirmar las rutas del padrón</Boton>
              )}
              {seleccion.size > 0 && <Boton tamano="sm" variante="fantasma" onClick={() => setSeleccion(new Set())}>Quitar selección</Boton>}
              <Ayuda clave="solicitar.aplicar" className="w-full" />
            </div>
          )}

          {empleados.length === 0 ? (
            <div data-tour="solicitar-empleados-vacio" className="rounded-lg border border-dashed border-[var(--border-color)]">
              <EstadoVacio texto="Aún no hay empleados. Usa «Agregar empleados» para elegir a quienes harán tiempo extra." />
            </div>
          ) : (
            <div className="space-y-3">
              <div className={`hidden px-3 text-xs font-medium text-[var(--text-muted)] ${COLUMNAS_FILA}`}>
                <span /><span>Empleado</span>
                <span>{extension ? 'Termina su turno' : 'Entrada'}<Ayuda clave={extension ? 'solicitar.finTurno' : 'solicitar.entrada'} className="normal-case tracking-normal font-normal" /></span>
                <span>{extension ? 'Se queda hasta' : 'Salida'}<Ayuda clave={extension ? 'solicitar.hasta' : 'solicitar.salida'} className="normal-case tracking-normal font-normal" /></span>
                <span className="text-center">Horas<Ayuda clave="solicitar.horas" className="normal-case tracking-normal font-normal" /></span>
                <span className="text-center">Alimentos<Ayuda clave="solicitar.alimentos" className="normal-case tracking-normal font-normal" /></span>
                <span className="text-center">Transporte<Ayuda clave="solicitar.transporte" className="normal-case tracking-normal font-normal" /></span><span />
              </div>
              <div className="space-y-1 rounded-md bg-[var(--bg-surface-secondary)] p-2 lg:hidden">
                <Ayuda clave={extension ? 'solicitar.finTurno' : 'solicitar.entrada'} className="!mt-0" />
                <Ayuda clave={extension ? 'solicitar.hasta' : 'solicitar.salida'} className="!mt-0" />
                <Ayuda clave="solicitar.alimentos" className="!mt-0" />
                <Ayuda clave="solicitar.transporte" className="!mt-0" />
              </div>
              {empleados.map((e, i) => (
                <FilaEmpleadoTE key={e.nomina} tour={i === 0 ? 'solicitar-empleado-fila' : undefined} e={e} tipo={tipo} rutas={rutas} comunidades={comunidades} puntos={puntos} seleccionado={seleccion.has(e.nomina)}
                  aviso={avisoDe(e.nomina)} error={errorDe(e.nomina)} onSeleccionar={alternarSeleccion} onCambio={cambiar} onQuitar={quitar} />
              ))}
              <Ayuda clave="solicitar.ruta" />
            </div>
          )}
        </section>
      </Tarjeta>

      {/* Rutas distintas: cada ruta adicional cuesta, así que más de una se justifica */}
      {infoRutas.rutasDistintas > 0 && (
        <section aria-label="Rutas">
          {variasRutas ? (
            <Aviso tono="aviso" titulo={textoRutas(infoRutas.desglose)} icon={Route}>
              <p>Cada ruta adicional representa un costo extra. Los autorizadores decidirán si se aprueba.</p>
              <Campo className="mt-3" etiqueta="¿Por qué se necesita más de una ruta?" obligatorio ayuda={`Al menos ${MIN_JUSTIFICACION_RUTAS} caracteres (llevas ${justificacionRutas.trim().length}).`}
                error={intentoEnvio && faltaJustificacion ? 'Explica por qué no basta una sola ruta.' : undefined}>
                <AreaTexto id="te-justificacion-rutas" rows={2} value={justificacionRutas} onChange={e => setJustificacionRutas(e.target.value)} placeholder="Explica por qué no basta una sola ruta…" />
              </Campo>
              <Ayuda clave="solicitar.justificacionRutas" className="!text-[var(--status-warning-text)]" />
            </Aviso>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-5 py-3 text-sm font-medium text-[var(--text-main)]"><Route className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />{textoRutas(infoRutas.desglose)}</div>
          )}
        </section>
      )}

      {intentoEnvio && errores.length > 0 && (
        <div id="problemas-te">
          <Aviso tono="error" titulo="Antes de enviar corrige:">
            <ul className="list-disc space-y-1 pl-5">{errores.slice(0, 12).map((p, i) => <li key={i}>{p.mensaje}</li>)}{errores.length > 12 && <li>…y {errores.length - 12} más</li>}</ul>
          </Aviso>
        </div>
      )}

      {/* Barra fija abajo: el resumen y las acciones (la principal, Enviar, es el único botón rojo) */}
      <div data-tour="solicitar-resumen" className="[@media(min-height:600px)]:sticky bottom-0 z-20 -mx-4 border-t border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10" aria-label="Resumen">
        {trabajo && (
          <div className="mb-3" role="status">
            <p className="flex items-center gap-2 text-xs font-medium text-[var(--text-main)]"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />{trabajo.texto}… lote {Math.min(trabajo.hechos + 1, trabajo.total)} de {trabajo.total}</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface-hover)]"><div className="h-full bg-[var(--text-secondary)] transition-all duration-200" style={{ width: `${(trabajo.hechos / trabajo.total) * 100}%` }} /></div>
          </div>
        )}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <dl className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {[['Empleados', resumen.totalEmpleados], ['Horas', resumen.totalHoras], ['Con transporte', resumen.totalTransporte], ['Con alimentos', resumen.totalAlimentos], ['Rutas', infoRutas.rutasDistintas]].map(([t, v]) => (
              <div key={t} className="flex items-baseline gap-1.5"><dt className="text-[var(--text-secondary)]">{t}</dt><dd className={`text-base font-medium tabular-nums ${t === 'Rutas' && v > 1 ? 'text-[var(--status-warning-text)]' : 'text-[var(--text-main)]'}`}>{v}</dd></div>
            ))}
          </dl>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Empleados por horario">
              {Object.entries(resumen.porBloque).map(([b, n]) => <Insignia key={b} tono="neutro" sinIcono>{b}: {n}</Insignia>)}
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <div className="grid grid-cols-2 gap-2 sm:flex">
              {existe && !esDevuelta && <Boton variante="peligro" icono={Trash2} onClick={eliminarClick} disabled={ocupado}>Eliminar borrador</Boton>}
              {esDevuelta && <Boton variante="peligro" onClick={cancelarClick} disabled={ocupado}>Cancelar solicitud</Boton>}
              <Boton to="/tiempo-extra/mis-solicitudes" variante="fantasma">Salir</Boton>
              <Boton id="btn-guardar-borrador" icono={Save} onClick={guardarBorradorClick} disabled={ocupado || !areaActual}>{esDevuelta ? 'Guardar cambios' : 'Guardar borrador'}{sinGuardar ? ' •' : ''}</Boton>
            </div>
            <Boton id="btn-enviar-autorizacion" data-tour="solicitar-enviar" variante="primario" icono={Send} onClick={enviarClick} disabled={ocupado || !areaActual}>{esDevuelta ? 'Reenviar a autorización' : 'Enviar a autorización'}</Boton>
          </div>
        </div>
        <Ayuda clave="solicitar.resumen" />
      </div>

      {selectorAbierto && <SelectorEmpleadosTE empleados={empleadosArea} yaAgregados={yaAgregados} rutas={rutas} onAgregar={agregar} onClose={() => setSelectorAbierto(false)} />}
    </div>
  );
}
