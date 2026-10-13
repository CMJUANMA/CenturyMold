/**
 * BandejaTE.jsx — /tiempo-extra/autorizar: lo que le toca firmar a cada quien, en tiempo real.
 *   Nivel 1: pendiente_aut1 de sus áreas (Aut. 1) · Nivel 2: pendiente_aut2 de toda la planta (Aut. 2 y RH). Con los dos roles, dos secciones.
 * Las más antiguas primero; filtros por área y fechas; detalle con Autorizar / Devolver; "Autorizar N seleccionadas" (una transacción cada una).
 * Lo que uno mismo creó aparece deshabilitado. Pensada también para el celular: tarjetas y botones grandes.
 * El Aut. 1 tiene además "Historial de mi área" (lo que ya pasó por su nivel, solo lectura).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BadgeCheck, CheckCircle2, Clock, Loader2, Undo2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAccesos } from '../../hooks/useAccesos';
import { useAreas } from '../../hooks/useAreas';
import { useBandeja } from '../../hooks/useBandeja';
import { useCatalogos } from '../../hooks/useCatalogos';
import { useResumenTE } from '../../hooks/useResumenTE';
import { useConfirmar } from '../../hooks/useConfirmar';
import { useToast } from '../../hooks/useToast';
import BadgeEstatus from '../../components/BadgeEstatus';
import Modal from '../../components/Modal';
import Spinner from '../../components/Spinner';
import { formatoFecha } from '../../utils/asignaciones';
import { crearFormateadorNombres } from '../../utils/nombresPersona';
import {
  MIN_MOTIVO_DEVOLUCION, MSG_YA_RESPONDIDA, esPropia, esperaDesde, fechaVencida, filtrarSolicitudes, haceTiempo, totalesDe,
} from '../../utils/tiempoExtra';
import { YaRespondida, autorizarSolicitud, autorizarVarias, devolverSolicitud, leerHistorialTE, leerSolicitudTE } from '../../utils/tiempoExtraDb';
import { ymd } from '../../utils/fechas';
import DetalleTE from './DetalleTE';

const campo = 'rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--cm-red)]';
const boton = 'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-semibold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50';

function Vencida() {
  return <span className="inline-flex items-center gap-1 rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--status-warning-text)]"><Clock className="h-3 w-3" />Fecha vencida</span>;
}

export default function BandejaTE() {
  const { usuario } = useAuth();
  const accesos = useAccesos();
  const { nivel1, nivel2, cargando, error } = useBandeja();
  const { nombres } = useAreas();
  const { rutas, comunidades, puntos } = useCatalogos({ empleados: false });
  const { delArea } = useResumenTE();
  const confirmar = useConfirmar();
  const toast = useToast();
  const [hoy] = useState(() => ymd());
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
    const ahoraIds = new Set([...nivel1, ...nivel2].map(t => t.id));
    const quitadas = [...vistas.current].filter(id => !ahoraIds.has(id));
    vistas.current = ahoraIds;
    if (quitadas.length && !ocupadoRef.current) {
      toast.warning(quitadas.length === 1 ? 'Una solicitud ya no está disponible: el solicitante la canceló o alguien más la respondió.' : `${quitadas.length} solicitudes ya no están disponibles: las canceló su solicitante o alguien más las respondió.`, 7000);
      if (detalle && quitadas.includes(detalle.id)) setDetalle(null);
    }
  }, [nivel1, nivel2, cargando, detalle, toast]);

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
    if (fechaVencida(solicitud.fechaTE, hoy)
      && !await confirmar({ titulo: 'Fecha vencida', mensaje: `La fecha del tiempo extra (${formatoFecha(`${solicitud.fechaTE}T12:00:00`)}) ya pasó. ¿Autorizar de todos modos?`, textoConfirmar: 'Autorizar igual', peligroso: true })) return;
    setTrabajando(true); ocupadoRef.current = true;
    try {
      await autorizarSolicitud({ id, usuario, nivel, comoRH: !accesos.esAut2, comentario: texto });
      toast.success(nivel === 1 ? 'Autorizada: pasó a Autorización 2.' : 'Autorizada.');
      setDetalle(null);
    } catch (err) {
      if (err instanceof YaRespondida) { toast.warning(MSG_YA_RESPONDIDA, 7000); setDetalle(null); } else toast.error('No se pudo autorizar: ' + err.message, 8000);
    } finally { setTrabajando(false); setTimeout(() => { ocupadoRef.current = false; }, 1500); }
  };
  const devolver = async () => {
    const { id, nivel } = detalle;
    setTrabajando(true); ocupadoRef.current = true;
    try {
      await devolverSolicitud({ id, usuario, nivel, motivo: texto });
      toast.success('Devuelta al solicitante.');
      setDetalle(null);
    } catch (err) {
      if (err instanceof YaRespondida) { toast.warning(MSG_YA_RESPONDIDA, 7000); setDetalle(null); } else toast.error('No se pudo devolver: ' + err.message, 8000);
    } finally { setTrabajando(false); setTimeout(() => { ocupadoRef.current = false; }, 1500); }
  };

  const autorizarSeleccion = async (nivel, items) => {
    const elegidas = items.filter(t => seleccion[nivel].has(t.id) && !esPropia(t, usuario.uid));
    if (!elegidas.length) return;
    const tot = totalesDe(elegidas);
    const vencidas = elegidas.filter(t => fechaVencida(t.fechaTE, hoy)).length;
    const ok = await confirmar({
      titulo: `Autorizar ${tot.solicitudes} solicitudes`,
      mensaje: `${tot.empleados} empleados · ${tot.horas} horas en total.${vencidas ? ` ${vencidas} tienen la fecha vencida.` : ''} Cada una se autoriza por separado.`,
      textoConfirmar: `Autorizar ${tot.solicitudes}`,
    });
    if (!ok) return;
    setTrabajando(true); ocupadoRef.current = true;
    const r = await autorizarVarias({ tareas: elegidas.map(t => ({ id: t.id, nivel })), usuario, comoRH: !accesos.esAut2 });
    setSeleccion(s => ({ ...s, [nivel]: new Set() }));
    const folioDe = (id) => elegidas.find(t => t.id === id)?.folio ?? id;
    setResultado({ ok: r.ok.map(folioDe), fallidas: r.fallidas.map(f => ({ folio: folioDe(f.id), motivo: f.motivo })) });
    setTrabajando(false); setTimeout(() => { ocupadoRef.current = false; }, 1500);
  };

  if (accesos.cargando || cargando) return <Spinner />;
  const totalPendientes = nivel1.length + nivel2.length;
  const historialArea = delArea.filter(t => t.estatus !== 'pendiente_aut1' && t.estatus !== 'borrador').sort((a, b) => esperaDesde(b) - esperaDesde(a));

  return (
    <div className="space-y-5">
      <header className="border-b border-[var(--border-color)] pb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Tiempo extra</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">Por autorizar</h1>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{totalPendientes === 0 ? 'No tienes solicitudes pendientes.' : `${totalPendientes} esperando tu firma, las más antiguas primero. Se actualiza solo.`}</p>
      </header>

      {error && <p role="alert" className="flex items-center gap-2 text-xs text-[var(--status-error-text)]"><AlertTriangle className="h-4 w-4" />No se pudo leer la bandeja: {error.message}</p>}

      {esAut1 && (
        <nav className="flex gap-0 border-b border-[var(--border-color)]" aria-label="Secciones">
          {[['bandeja', 'Por autorizar'], ['historial', 'Historial de mi área']].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setPestana(id)} aria-current={pestana === id ? 'page' : undefined}
              className={`-mb-px cursor-pointer border-b-2 px-4 py-2.5 text-xs font-semibold ${pestana === id ? 'border-[var(--cm-red)] text-[var(--cm-red)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}`}>{label}</button>
          ))}
        </nav>
      )}

      {pestana === 'bandeja' && (
        <>
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-3" role="group" aria-label="Filtros">
            <label className="text-[11px] font-medium text-[var(--text-secondary)]">Área
              <select value={filtros.areaId} onChange={e => setFiltros(f => ({ ...f, areaId: e.target.value }))} className={`${campo} mt-0.5 block`}>
                <option value="">Todas</option>{areasEnBandeja.map(id => <option key={id} value={id}>{nombreArea(id)}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-medium text-[var(--text-secondary)]">Fecha del TE desde
              <input type="date" value={filtros.desde} onChange={e => setFiltros(f => ({ ...f, desde: e.target.value }))} className={`${campo} mt-0.5 block`} />
            </label>
            <label className="text-[11px] font-medium text-[var(--text-secondary)]">hasta
              <input type="date" value={filtros.hasta} min={filtros.desde} onChange={e => setFiltros(f => ({ ...f, hasta: e.target.value }))} className={`${campo} mt-0.5 block`} />
            </label>
            {(filtros.areaId || filtros.desde || filtros.hasta) && <button type="button" onClick={() => setFiltros({ areaId: '', desde: '', hasta: '' })} className="cursor-pointer pb-1.5 text-[11px] font-semibold text-[var(--cm-red)] hover:underline">Limpiar</button>}
          </div>

          {secciones.length === 0 && <p className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 text-center text-xs text-[var(--text-secondary)]">No tienes un nivel de autorización asignado.</p>}
          {secciones.map(({ nivel, titulo, lista: todas }) => {
            const items = lista(nivel);
            const firmables = items.filter(t => !esPropia(t, usuario.uid));
            const marcadas = firmables.filter(t => seleccion[nivel].has(t.id));
            return (
              <section key={nivel} aria-label={titulo} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)]"><BadgeCheck className="h-4 w-4 text-[var(--text-muted)]" />{titulo}
                    <span className="rounded-full bg-[var(--bg-surface-secondary)] px-2 py-0.5 text-[11px] font-bold text-[var(--text-secondary)]">{items.length}{items.length !== todas.length ? ` de ${todas.length}` : ''}</span></h2>
                  <div className="flex items-center gap-3">
                    {firmables.length > 1 && (
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                        <input type="checkbox" checked={marcadas.length === firmables.length && firmables.length > 0} onChange={() => alternarTodas(nivel, firmables.map(t => t.id))} className="h-4 w-4 accent-[var(--cm-red)]" />Todas
                      </label>
                    )}
                    <button type="button" disabled={!marcadas.length || trabajando} onClick={() => autorizarSeleccion(nivel, items)} className={`${boton} bg-[var(--cm-red)] !py-2 !text-xs text-white hover:bg-[var(--cm-red-hover)]`}>
                      {trabajando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}Autorizar {marcadas.length || ''} {marcadas.length === 1 ? 'seleccionada' : 'seleccionadas'}
                    </button>
                  </div>
                </div>

                {items.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] p-6 text-center text-xs text-[var(--text-muted)]">{todas.length ? 'Ninguna solicitud con esos filtros.' : 'Nada pendiente en este nivel. 🎉'}</p>
                ) : (
                  <>
                    <div className="hidden overflow-x-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] md:block">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
                          <tr><th className="px-3 py-3" /><th className="px-3 py-3">Folio</th><th className="px-3 py-3">Área</th><th className="px-3 py-3">Solicitante</th><th className="px-3 py-3">Fecha del TE</th>
                            <th className="px-3 py-3 text-right">Empleados</th><th className="px-3 py-3 text-right">Horas</th><th className="px-3 py-3 text-right">Transporte</th><th className="px-3 py-3">Espera</th><th className="px-3 py-3" /></tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)]">
                          {items.map(t => {
                            const propia = esPropia(t, usuario.uid);
                            return (
                              <tr key={t.id} className={propia ? 'bg-[var(--bg-surface-secondary)] opacity-70' : 'hover:bg-[var(--bg-surface-secondary)]'}>
                                <td className="px-3 py-2.5">{!propia && <input type="checkbox" aria-label={`Seleccionar ${t.folio}`} checked={seleccion[nivel].has(t.id)} onChange={() => alternar(nivel, t.id)} className="h-4 w-4 accent-[var(--cm-red)]" />}</td>
                                <td className="px-3 py-2.5 font-mono font-semibold text-[var(--text-main)]">{t.folio}</td>
                                <td className="px-3 py-2.5">{nombreArea(t.areaId)}</td>
                                <td className="px-3 py-2.5">{formato.nombre(t.creadoPorNombre)}</td>
                                <td className="px-3 py-2.5 whitespace-nowrap">{formatoFecha(`${t.fechaTE}T12:00:00`)} {fechaVencida(t.fechaTE, hoy) && <Vencida />}</td>
                                <td className="px-3 py-2.5 text-right">{t.resumen?.totalEmpleados ?? 0}</td>
                                <td className="px-3 py-2.5 text-right">{t.resumen?.totalHoras ?? 0}</td>
                                <td className="px-3 py-2.5 text-right">{t.resumen?.totalTransporte ?? 0}</td>
                                <td className="px-3 py-2.5 whitespace-nowrap text-[var(--text-secondary)]">{haceTiempo(esperaDesde(t), ahora)}</td>
                                <td className="px-3 py-2.5 text-right">
                                  {propia ? <span className="text-[10px] font-semibold text-[var(--text-muted)]">No puedes autorizar tu propia solicitud</span>
                                    : <button type="button" onClick={() => abrir(t, nivel)} className="cursor-pointer rounded-md border border-[var(--border-color)] px-3 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]">Revisar</button>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <ul className="space-y-3 md:hidden">
                      {items.map(t => {
                        const propia = esPropia(t, usuario.uid);
                        return (
                          <li key={t.id} className={`rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-sm ${propia ? 'opacity-70' : ''}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div><p className="font-mono text-sm font-bold text-[var(--text-main)]">{t.folio}</p><p className="text-xs text-[var(--text-secondary)]">{nombreArea(t.areaId)} · {formato.nombre(t.creadoPorNombre)}</p></div>
                              {!propia && <input type="checkbox" aria-label={`Seleccionar ${t.folio}`} checked={seleccion[nivel].has(t.id)} onChange={() => alternar(nivel, t.id)} className="h-6 w-6 accent-[var(--cm-red)]" />}
                            </div>
                            <p className="mt-2 text-sm text-[var(--text-main)]">{formatoFecha(`${t.fechaTE}T12:00:00`)} {fechaVencida(t.fechaTE, hoy) && <Vencida />}</p>
                            <p className="mt-1 text-xs text-[var(--text-secondary)]"><b>{t.resumen?.totalEmpleados ?? 0}</b> empleados · <b>{t.resumen?.totalHoras ?? 0}</b> h · <b>{t.resumen?.totalTransporte ?? 0}</b> con transporte · {haceTiempo(esperaDesde(t), ahora)}</p>
                            {propia ? <p className="mt-3 text-xs font-semibold text-[var(--text-muted)]">No puedes autorizar tu propia solicitud</p>
                              : <button type="button" onClick={() => abrir(t, nivel)} className={`${boton} mt-3 w-full border border-[var(--border-color)] text-[var(--text-main)]`}>Revisar y responder</button>}
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

      {pestana === 'historial' && esAut1 && (
        <section aria-label="Historial de mi área" className="space-y-2">
          <p className="text-xs text-[var(--text-secondary)]">Lo que ya pasó por tu nivel (en autorización de nivel 2, autorizadas, devueltas y canceladas). Solo lectura.</p>
          <div className="overflow-x-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
                <tr><th className="px-3 py-3">Folio</th><th className="px-3 py-3">Área</th><th className="px-3 py-3">Solicitante</th><th className="px-3 py-3">Fecha del TE</th><th className="px-3 py-3 text-right">Empleados</th><th className="px-3 py-3 text-right">Horas</th><th className="px-3 py-3">Estatus</th><th className="px-3 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {historialArea.length === 0 ? <tr><td colSpan={8} className="py-8 text-center text-[var(--text-muted)]">Todavía no hay historial en tu área.</td></tr> : historialArea.map(t => (
                  <tr key={t.id} className="hover:bg-[var(--bg-surface-secondary)]">
                    <td className="px-3 py-2.5 font-mono font-semibold">{t.folio ?? '—'}</td><td className="px-3 py-2.5">{nombreArea(t.areaId)}</td><td className="px-3 py-2.5">{formato.nombre(t.creadoPorNombre)}</td>
                    <td className="px-3 py-2.5">{formatoFecha(`${t.fechaTE}T12:00:00`)}</td><td className="px-3 py-2.5 text-right">{t.resumen?.totalEmpleados ?? 0}</td><td className="px-3 py-2.5 text-right">{t.resumen?.totalHoras ?? 0}</td>
                    <td className="px-3 py-2.5"><BadgeEstatus estatus={t.estatus} modulo="te" /></td>
                    <td className="px-3 py-2.5 text-right"><button type="button" onClick={() => abrir(t, 1, true)} className="cursor-pointer rounded-md border border-[var(--border-color)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--bg-surface-hover)]">Ver</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {detalle && (
        <Modal isOpen onClose={() => !trabajando && setDetalle(null)} title={detalle.solicitud.folio ?? 'Solicitud'} maxWidth="max-w-4xl" preventCloseOnBackdrop={trabajando}>
          {detalle.cargando ? <div className="flex items-center gap-2 py-8 text-xs text-[var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Cargando…</div> : (
            <DetalleTE t={detalle.solicitud} historial={detalle.historial} area={nombreArea(detalle.solicitud.areaId)} catalogos={{ rutas, comunidades, puntos }} formato={formato}
              acciones={detalle.soloLectura ? null : esPropia(detalle.solicitud, usuario.uid)
                ? <p className="text-xs font-semibold text-[var(--text-muted)]">No puedes autorizar tu propia solicitud.</p>
                : (
                  <div className="w-full space-y-3">
                    <label className="block text-xs font-medium text-[var(--text-secondary)]" htmlFor="comentario-firma">
                      Comentario <span className="text-[var(--text-muted)]">(opcional al autorizar; obligatorio al devolver, mínimo {MIN_MOTIVO_DEVOLUCION} caracteres: {texto.trim().length})</span>
                    </label>
                    <textarea id="comentario-firma" rows={2} value={texto} onChange={e => setTexto(e.target.value)} className={`${campo} w-full`} placeholder="Comentario o motivo de la devolución…" />
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <button type="button" id="btn-devolver" disabled={trabajando || texto.trim().length < MIN_MOTIVO_DEVOLUCION} onClick={devolver}
                        className={`${boton} border border-[var(--status-error-border)] bg-[var(--bg-surface)] text-[var(--status-error-text)] hover:bg-[var(--status-error-bg)]`}><Undo2 className="h-4 w-4" />Devolver</button>
                      <button type="button" id="btn-autorizar" disabled={trabajando} onClick={autorizar} className={`${boton} bg-[var(--cm-red)] text-white hover:bg-[var(--cm-red-hover)]`}>
                        {trabajando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{detalle.nivel === 1 ? 'Autorizar (pasa a nivel 2)' : 'Autorizar'}</button>
                    </div>
                  </div>
                )} />
          )}
        </Modal>
      )}

      {resultado && (
        <Modal isOpen onClose={() => setResultado(null)} title="Resultado de la autorización" maxWidth="max-w-md">
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-2 font-semibold text-[var(--status-success-text)]"><CheckCircle2 className="h-4 w-4" />{resultado.ok.length} autorizadas{resultado.ok.length ? `: ${resultado.ok.join(', ')}` : ''}</p>
            {resultado.fallidas.length > 0 && (
              <div className="rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] p-3 text-xs text-[var(--status-error-text)]">
                <p className="mb-1 font-bold">{resultado.fallidas.length} no se pudieron autorizar</p>
                <ul className="space-y-0.5">{resultado.fallidas.map(f => <li key={f.folio}><b>{f.folio}:</b> {f.motivo}</li>)}</ul>
              </div>
            )}
            <div className="flex justify-end"><button type="button" onClick={() => setResultado(null)} className={`${boton} border border-[var(--border-color)] text-[var(--text-main)]`}>Cerrar</button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
