/**
 * EditorTE.jsx — Captura de tiempo extra (/tiempo-extra/nueva) y edición de un borrador o de una devuelta (/tiempo-extra/:id/editar).
 *
 * Todo nace como BORRADOR (solo lo ve su creador): "Guardar borrador" escribe la solicitud y los empleados en lotes de 10 con barra
 * de progreso y se puede salir y continuar. "Enviar a autorización" valida, pide confirmación con el resumen, asigna el FOLIO (contador en
 * transacción) y pasa a pendiente_aut1, o a pendiente_aut2 si quien captura es Aut. 1 vigente de esa área.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Loader2, Plus, Save, Send, Trash2, Users } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAccesos } from '../../hooks/useAccesos';
import { useAreas } from '../../hooks/useAreas';
import { useCatalogos } from '../../hooks/useCatalogos';
import { useConfirmar } from '../../hooks/useConfirmar';
import { useToast } from '../../hooks/useToast';
import Spinner from '../../components/Spinner';
import { esActivo, rutaVigente } from '../../utils/activo';
import { ymd } from '../../utils/fechas';
import {
  HORAS_ENTRADA_TE, HORAS_SALIDA_TE, MIN_COMENTARIO_TE, MOTIVOS_TE, aplicarA, empleadoDesdePadron, estatusAlEnviar, nuevoIdBorrador,
  problemasDeEnvio, resumenTE,
} from '../../utils/tiempoExtra';
import { MAX_PASAJEROS } from '../../utils/solicitudes';
import {
  cancelarSolicitud, eliminarBorrador, enviarSolicitud, guardarBorrador, guardarRutasEnPadron, leerOcupados, leerSolicitudTE,
} from '../../utils/tiempoExtraDb';
import FilaEmpleadoTE, { COLUMNAS_FILA } from './FilaEmpleadoTE';
import SelectorEmpleadosTE from './SelectorEmpleadosTE';

const inp = 'w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-main)] focus:border-[var(--cm-red)] focus:outline-none focus:ring-1 focus:ring-[var(--cm-red)] disabled:opacity-60';
const lbl = 'mb-1 block text-xs font-medium text-[var(--text-secondary)]';
const btn = 'inline-flex cursor-pointer items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50';

export default function EditorTE() {
  const { id: idParam } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const accesos = useAccesos();
  const { areas, cargando: cargandoAreas } = useAreas();
  const { rutas, comunidades, puntos, empleados: padron, cargando: cargandoCat, parchearEmpleados } = useCatalogos();
  const confirmar = useConfirmar();
  const toast = useToast();

  const [idNuevo] = useState(() => nuevoIdBorrador());
  const id = idParam ?? idNuevo;
  const [hoy] = useState(() => ymd());
  const [cargandoDoc, setCargandoDoc] = useState(!!idParam);
  const [servidor, setServidor] = useState(null); // { existe, estatus, folio, devolucion }
  const [areaId, setAreaId] = useState('');
  const [fechaTE, setFechaTE] = useState('');
  const [motivo, setMotivo] = useState('');
  const [comentario, setComentario] = useState('');
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
      setAreaId(t.areaId); setFechaTE(t.fechaTE ?? ''); setMotivo(t.motivo ?? ''); setComentario(t.comentario ?? '');
      setEmpleados(t.empleados);
      enServidor.current = new Set(t.empleados.map(e => e.nomina));
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

  const empleadosArea = useMemo(() => padron.filter(e => esActivo(e) && e.areaId === areaActual), [padron, areaActual]);
  const yaAgregados = useMemo(() => new Set(empleados.map(e => e.nomina)), [empleados]);
  const resumen = useMemo(() => resumenTE(empleados), [empleados]);
  const problemas = useMemo(
    () => problemasDeEnvio({ areaId: areaActual, fechaTE, motivo, comentario, empleados, hoy, ocupados }),
    [areaActual, fechaTE, motivo, comentario, empleados, hoy, ocupados],
  );
  const errores = problemas.filter(p => p.nivel === 'error');
  const avisoDe = (nomina) => problemas.find(p => p.nivel === 'aviso' && p.nomina === nomina)?.mensaje;
  const errorDe = (nomina) => (intentoEnvio ? errores.find(p => p.nomina === nomina)?.mensaje : undefined);

  const ocupado = !!trabajo;

  // ── Edición ────────────────────────────────────────────────────────────
  const agregar = (lista) => {
    const nuevos = lista.filter(e => !yaAgregados.has(String(e.nomina))).slice(0, Math.max(0, MAX_PASAJEROS - empleados.length));
    if (nuevos.length < lista.length) toast.warning(`Se agregaron ${nuevos.length}: máximo ${MAX_PASAJEROS} empleados por solicitud.`);
    const catalogos = { rutas, comunidades, puntos };
    const filas = nuevos.map(e => empleadoDesdePadron(e, rutaVigente(e, catalogos)));
    setEmpleados(prev => [...prev, ...filas]);
    setSucios(prev => new Set([...prev, ...filas.map(f => f.nomina)]));
    setEliminados(prev => { const s = new Set(prev); filas.forEach(f => s.delete(f.nomina)); return s; });
    setSelectorAbierto(false);
  };
  const cambiar = (nomina, parche) => {
    setEmpleados(prev => prev.map(e => (e.nomina === nomina ? { ...e, ...parche } : e)));
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
    if (!bulk.entrada || !bulk.salida) { toast.warning('Elige la entrada y la salida para aplicar.'); return; }
    if (bulk.entrada === bulk.salida) { toast.warning('La entrada y la salida no pueden ser iguales.'); return; }
    aplicarMasivo({ horaEntrada: bulk.entrada, horaSalida: bulk.salida });
  };
  const confirmarRutasPrecargadas = () => {
    setEmpleados(prev => prev.map(e => (e.transporte && e.necesitaConfirmar && !e.confirmada && e.rutaId && e.comunidadId && e.puntoReunionId ? { ...e, confirmada: true } : e)));
    setSucios(prev => new Set([...prev, ...empleados.map(e => e.nomina)]));
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
      id, existe, usuario, area: { id: areaActual, nombre: meta?.nombre ?? areaActual }, fechaTE, motivo, comentario, empleados, sucios, eliminados,
      onProgreso: (hechos, total) => setTrabajo({ texto, hechos, total }),
    });
    enServidor.current = new Set(empleados.map(e => e.nomina));
    setSucios(new Set()); setEliminados(new Set());
    setServidor(s => ({ ...(s ?? {}), existe: true, estatus: s?.estatus ?? 'borrador', folio: s?.folio ?? null }));
    await recordarRutas();
  };

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
    const estatus = estatusAlEnviar({ esAut1DeLaArea, areaParticipa: area?.participaTE !== false });
    const destino = estatus === 'pendiente_aut2' ? 'Autorización 2' : 'Autorización 1';
    const ok = await confirmar({
      titulo: esDevuelta ? 'Reenviar a autorización' : 'Enviar a autorización',
      mensaje: `${resumen.totalEmpleados} empleados · ${resumen.totalHoras} h en total · ${resumen.totalTransporte} con transporte · ${resumen.totalAlimentos} con alimentos. `
        + `Va a ${destino}. ${esDevuelta ? 'Vuelve a empezar su autorización.' : 'Se le asignará su folio.'} El transporte se solicitará automáticamente a RH al quedar autorizada.`,
      textoConfirmar: esDevuelta ? 'Reenviar' : 'Enviar',
    });
    if (!ok) return;
    setTrabajo({ texto: 'Guardando empleados', hechos: 0, total: 1 });
    try {
      await guardar('Guardando empleados');
      setTrabajo({ texto: 'Enviando', hechos: 1, total: 1 });
      const folio = await enviarSolicitud({ id, devuelta: esDevuelta, usuario, estatus, fechaTE, motivo, comentario, empleados });
      toast.success(esDevuelta ? `Reenviada (${folio}).` : `Enviada con el folio ${folio}.`);
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

  if (accesos.cargando || cargandoAreas || cargandoCat || cargandoDoc) return <Spinner />;
  if (areasCaptura.length === 0 && !idParam) {
    return <p className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 text-center text-xs text-[var(--text-secondary)]">No tienes un área asignada para capturar tiempo extra.</p>;
  }
  const nombreArea = area?.nombre ?? areasCaptura.find(a => a.id === areaActual)?.nombre ?? areaActual;
  const sinGuardar = sucios.size > 0 || eliminados.size > 0;

  return (
    <div className="space-y-5 pb-4">
      <header className="border-b border-[var(--border-color)] pb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Tiempo extra</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">
          {esDevuelta ? `Corregir ${servidor.folio ?? 'solicitud devuelta'}` : existe ? 'Continuar borrador' : 'Solicitar tiempo extra'}
        </h1>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Área: <b>{nombreArea || '—'}</b>{esAut1DeLaArea ? ' · Al enviarla pasa directo a Autorización 2 (eres su Aut. 1).' : ''}</p>
      </header>

      {esDevuelta && servidor.devolucion && (
        <div role="alert" className="rounded-lg border-2 border-[var(--status-error-border)] bg-[var(--status-error-bg)] p-4 text-[var(--status-error-text)]">
          <p className="flex items-center gap-2 text-sm font-bold"><AlertTriangle className="h-4 w-4" />Devuelta por Autorización {servidor.devolucion.nivel}</p>
          <p className="mt-1 text-sm">{servidor.devolucion.motivo}</p>
          <p className="mt-1 text-[11px] opacity-80">Corrige y reenvía: vuelve a empezar en Autorización 1.</p>
        </div>
      )}

      <section aria-label="Datos generales" className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-sm">
        <h2 className="mb-4 border-b border-[var(--border-subtle)] pb-2 text-sm font-semibold text-[var(--text-main)]">Datos generales</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={lbl} htmlFor="te-area">Área</label>
            {areasCaptura.length > 1 && !idParam ? (
              <select id="te-area" value={areaActual} onChange={e => { setAreaId(e.target.value); if (empleados.length) toast.warning('Cambiar de área quita los empleados agregados.'); setEmpleados([]); setSucios(new Set()); setEliminados(new Set()); }} className={inp}>
                <option value="">Elige el área…</option>
                {areasCaptura.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            ) : <input id="te-area" value={nombreArea} disabled className={inp} readOnly />}
          </div>
          <div>
            <label className={lbl} htmlFor="te-fecha">Fecha del tiempo extra</label>
            <input id="te-fecha" type="date" min={hoy} value={fechaTE} onChange={e => setFechaTE(e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl} htmlFor="te-motivo">Motivo</label>
            <select id="te-motivo" value={motivo} onChange={e => setMotivo(e.target.value)} className={inp}>
              <option value="">Elige el motivo…</option>
              {MOTIVOS_TE.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className={lbl} htmlFor="te-comentario">Comentario <span className="text-[var(--status-error-text)]">*</span> <span className="text-[var(--text-muted)]">(al menos {MIN_COMENTARIO_TE} caracteres: {comentario.trim().length})</span></label>
          <textarea id="te-comentario" rows={2} value={comentario} onChange={e => setComentario(e.target.value)} className={inp} placeholder="¿Por qué se necesita el tiempo extra?" />
        </div>
      </section>

      <section aria-label="Empleados" className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2">
          <h2 className="text-sm font-semibold text-[var(--text-main)]">Empleados <span className="ml-1 text-[var(--cm-red)]">{empleados.length}</span></h2>
          <button type="button" id="btn-agregar-empleados" disabled={!areaActual || ocupado} onClick={() => setSelectorAbierto(true)}
            className={`${btn} border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]`}><Plus className="h-3.5 w-3.5" />Agregar empleados</button>
        </div>

        {empleados.length > 0 && (
          <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-3" role="group" aria-label="Aplicar a todos o a los seleccionados">
            <span className="w-full text-[11px] font-semibold text-[var(--text-secondary)]">Aplicar a {seleccion.size ? `los ${seleccion.size} seleccionados` : 'todos'}:</span>
            <select aria-label="Entrada para aplicar" value={bulk.entrada} onChange={e => setBulk(b => ({ ...b, entrada: e.target.value }))} className={`${inp} !w-auto`}>
              <option value="">Entrada…</option>{HORAS_ENTRADA_TE.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <select aria-label="Salida para aplicar" value={bulk.salida} onChange={e => setBulk(b => ({ ...b, salida: e.target.value }))} className={`${inp} !w-auto`}>
              <option value="">Salida…</option>{HORAS_SALIDA_TE.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <button type="button" onClick={aplicarHorario} className={`${btn} border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] !px-3`}>Aplicar horario</button>
            <button type="button" onClick={() => aplicarMasivo({ alimentos: true })} className={`${btn} border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] !px-3`}>Con alimentos</button>
            <button type="button" onClick={() => aplicarMasivo({ alimentos: false })} className={`${btn} border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] !px-3`}>Sin alimentos</button>
            <button type="button" onClick={() => aplicarMasivo({ transporte: true })} className={`${btn} border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] !px-3`}>Con transporte</button>
            <button type="button" onClick={() => aplicarMasivo({ transporte: false })} className={`${btn} border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] !px-3`}>Sin transporte</button>
            {empleados.some(e => e.transporte && e.necesitaConfirmar && !e.confirmada) && (
              <button type="button" onClick={confirmarRutasPrecargadas} className={`${btn} bg-[var(--status-warning-text)] text-white !px-3`}>Confirmar las rutas del padrón</button>
            )}
            {seleccion.size > 0 && <button type="button" onClick={() => setSeleccion(new Set())} className="text-[11px] font-semibold text-[var(--cm-red)] hover:underline cursor-pointer">Quitar selección</button>}
          </div>
        )}

        {empleados.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[var(--border-color)] py-10 text-center text-xs text-[var(--text-secondary)]">
            <Users className="h-8 w-8 text-[var(--text-muted)]" />Aún no hay empleados. Usa "Agregar empleados" para elegir a quienes harán tiempo extra.
          </div>
        ) : (
          <div className="space-y-2">
            <div className={`hidden px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] ${COLUMNAS_FILA}`} aria-hidden="true">
              <span /><span>Empleado</span><span>Entrada</span><span>Salida</span><span className="text-center">Horas</span><span className="text-center">Alimentos</span><span className="text-center">Transporte</span><span />
            </div>
            {empleados.map(e => (
              <FilaEmpleadoTE key={e.nomina} e={e} rutas={rutas} comunidades={comunidades} puntos={puntos} seleccionado={seleccion.has(e.nomina)}
                aviso={avisoDe(e.nomina)} error={errorDe(e.nomina)} onSeleccionar={alternarSeleccion} onCambio={cambiar} onQuitar={quitar} />
            ))}
          </div>
        )}
      </section>

      {intentoEnvio && errores.length > 0 && (
        <div id="problemas-te" role="alert" className="rounded-lg border border-[var(--status-error-border)] bg-[var(--status-error-bg)] p-4 text-xs text-[var(--status-error-text)]">
          <p className="mb-1 font-bold">Antes de enviar corrige:</p>
          <ul className="list-disc space-y-0.5 pl-5">{errores.slice(0, 12).map((p, i) => <li key={i}>{p.mensaje}</li>)}{errores.length > 12 && <li>…y {errores.length - 12} más</li>}</ul>
        </div>
      )}

      {/* Resumen fijo abajo */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" aria-label="Resumen">
        {trabajo && (
          <div className="mb-2" role="status">
            <p className="flex items-center gap-2 text-xs font-semibold text-[var(--text-main)]"><Loader2 className="h-3.5 w-3.5 animate-spin" />{trabajo.texto}… lote {Math.min(trabajo.hechos + 1, trabajo.total)} de {trabajo.total}</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface-secondary)]"><div className="h-full bg-[var(--cm-red)] transition-all" style={{ width: `${(trabajo.hechos / trabajo.total) * 100}%` }} /></div>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
            {[['Empleados', resumen.totalEmpleados], ['Horas', resumen.totalHoras], ['Con transporte', resumen.totalTransporte], ['Con alimentos', resumen.totalAlimentos]].map(([t, v]) => (
              <div key={t} className="flex items-baseline gap-1"><dt className="text-[var(--text-secondary)]">{t}</dt><dd className="text-base font-bold text-[var(--text-main)]">{v}</dd></div>
            ))}
            <div className="flex flex-wrap gap-1.5" aria-label="Empleados por horario">
              {Object.entries(resumen.porBloque).map(([b, n]) => (
                <span key={b} className="rounded-full border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">{b}: {n}</span>
              ))}
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            {existe && !esDevuelta && (
              <button type="button" onClick={eliminarClick} disabled={ocupado}
                className={`${btn} border border-[var(--status-error-border)] bg-[var(--bg-surface)] text-[var(--status-error-text)] hover:bg-[var(--status-error-bg)]`}><Trash2 className="h-3.5 w-3.5" />Eliminar borrador</button>
            )}
            {esDevuelta && (
              <button type="button" onClick={cancelarClick} disabled={ocupado}
                className={`${btn} border border-[var(--status-error-border)] bg-[var(--bg-surface)] text-[var(--status-error-text)] hover:bg-[var(--status-error-bg)]`}>Cancelar solicitud</button>
            )}
            <Link to="/tiempo-extra/mis-solicitudes" className={`${btn} border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]`}>Salir</Link>
            <button type="button" id="btn-guardar-borrador" onClick={guardarBorradorClick} disabled={ocupado || !areaActual}
              className={`${btn} border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]`}>
              <Save className="h-3.5 w-3.5" />{esDevuelta ? 'Guardar cambios' : 'Guardar borrador'}{sinGuardar ? ' •' : ''}</button>
            <button type="button" id="btn-enviar-autorizacion" onClick={enviarClick} disabled={ocupado || !areaActual}
              className={`${btn} bg-[var(--cm-red)] text-white hover:bg-[var(--cm-red-hover)]`}><Send className="h-3.5 w-3.5" />{esDevuelta ? 'Reenviar a autorización' : 'Enviar a autorización'}</button>
          </div>
        </div>
      </div>

      {selectorAbierto && <SelectorEmpleadosTE empleados={empleadosArea} yaAgregados={yaAgregados} onAgregar={agregar} onClose={() => setSelectorAbierto(false)} />}
    </div>
  );
}
