/**
 * RhSolicitudes.jsx
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection, getDocs, doc, query, where, onSnapshot,
  runTransaction, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Eye, Undo2, Edit, AlertTriangle, Timer } from 'lucide-react';
import Modal from '../../components/Modal';
import BadgeEstatus from '../../components/BadgeEstatus';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import { AreaTexto, Campo, Entrada, Selector } from '../../components/ui/Campo';
import EncabezadoPagina from '../../components/ui/EncabezadoPagina';
import EstadoVacio from '../../components/ui/EstadoVacio';
import { EsqueletoTabla } from '../../components/ui/Esqueleto';
import Insignia from '../../components/ui/Insignia';
import { Fila, Tabla, Td, Th } from '../../components/ui/Tabla';
import { toDate, fmtFecha, fmtFechaHora, ymd, sumarDias, rangoSemana } from '../../utils/fechas';
import { resumenPasajeros, textoConteo } from '../../utils/solicitudes';
import { leerTelefonos } from '../../utils/contactosDb';
import { formatoTelefono } from '../../utils/telefono';
import { useCatalogos } from '../../hooks/useCatalogos';
import { useAreas } from '../../hooks/useAreas';
import { useConfirmar } from '../../hooks/useConfirmar';
import BotonFormatoRutas from '../../components/FormatoRutas';
import { ESTATUS_SOLICITUD } from '../../utils/constantes';
import { FUNCIONES, rutaEditarTransporte } from '../../funciones';

// Revisión de transporte suelto (aprobar / rechazar / revertir / editar): apagada con funciones.js. El transporte de tiempo extra nace aprobado.
const REVISION_ACTIVA = FUNCIONES.transporteSuelto;

// Helpers
// fechaSolicitud puede ser Timestamp (nuevas) o string ISO (viejas)
const fmtIso = fmtFecha;
function fmtFechaStr(str) {
  if (!str) return '—';
  const [yyyy, mm, dd] = str.split('-');
  if (!yyyy || !mm || !dd) return str;
  return `${dd}/${mm}/${yyyy}`;
}

// Normaliza un documento de solicitud: fechaSolicitud a ISO (Timestamp o string viejo), estatus en
// minúsculas y textos de turno/puesto tomados del resumen guardado en la solicitud.
// Las solicitudes viejas sin resumen muestran '—' (se calcula al abrir el detalle).
function normalizarSol(d) {
  const data = d.data();
  return {
    id: d.id,
    ...data,
    fechaSolicitud: toDate(data.fechaSolicitud)?.toISOString() || '',
    estatus: data.estatus?.toLowerCase() || ESTATUS_SOLICITUD.PENDIENTE,
    _turnosStr: data.conteoTurnos ? textoConteo(data.conteoTurnos) : (data.turno || '—'),
    _puestosStr: data.conteoPuestos ? textoConteo(data.conteoPuestos) : (data.puesto || '—'),
  };
}

/** Folio que se muestra: el del tiempo extra (TE-2026-0012) si viene de uno; en las anteriores, el id corto de siempre */
const folioVisible = (sol) => (sol.origen === 'tiempo_extra' && sol.folioTE ? sol.folioTE : sol.id.slice(0, 8));

function ordenarSols(sols) {
  return sols.sort((a, b) => {
    const fsA = a.fechaServicio || ''; const fsB = b.fechaServicio || '';
    if (fsA !== fsB) return fsB.localeCompare(fsA); // Descendente por fecha servicio
    return (b.fechaSolicitud || '').localeCompare(a.fechaSolicitud || '');
  });
}

export default function RhSolicitudes() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const confirmar = useConfirmar();
  // Solo catálogos (nombres de ruta/comunidad/punto); los empleados no se necesitan aquí
  const { rutas, comunidades, puntos } = useCatalogos({ empleados: false });
  const { areas } = useAreas();
  const catalogos = useMemo(() => ({ rutas, comunidades, puntos, areas }), [rutas, comunidades, puntos, areas]);
  const nombreAreaDe = (id) => areas.find(a => a.id === id)?.nombre ?? '';

  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('');
  const [filtroOrigen, setFiltroOrigen] = useState(''); // '' = todas · 'normal' · 'tiempo_extra'

  // Rango de fechaServicio que se escucha en Firestore (por defecto: hace 7 días → dentro de 30)
  // o modo 'pendientes' (todas las pendientes, sin importar la fecha)
  const [modo, setModo] = useState('rango');
  const [desde, setDesde] = useState(() => sumarDias(ymd(), -7));
  const [hasta, setHasta] = useState(() => sumarDias(ymd(), 30));
  const rangoValido = modo === 'pendientes' || (!!desde && !!hasta && desde <= hasta);

  const aplicarRango = (d, h) => {
    setModo('rango'); setDesde(d); setHasta(h);
    setCargando(!!d && !!h && d <= h);
  };
  const verPendientes = () => { setModo('pendientes'); setCargando(true); };

  const [detalle, setDetalle] = useState(null);
  const [procesando, setProcesando] = useState(null);

  // Modals de aprobación/rechazo
  const [modalAprobar, setModalAprobar] = useState(null);
  const [modalRechazar, setModalRechazar] = useState(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  // Solicitudes en tiempo real SOLO del rango elegido. No se lee la subcolección pasajeros al listar.
  // El callback es síncrono y cancelar la suscripción descarta cualquier snapshot viejo.
  useEffect(() => {
    if (!rangoValido) return;
    const col = collection(db, 'solicitudes');
    const q = modo === 'pendientes'
      ? query(col, where('estatus', '==', ESTATUS_SOLICITUD.PENDIENTE))
      : query(col, where('fechaServicio', '>=', desde), where('fechaServicio', '<=', hasta));

    const unsub = onSnapshot(q, (snap) => {
      setErrorMsg('');
      setSolicitudes(ordenarSols(snap.docs.map(normalizarSol)));
      setCargando(false);
    }, (err) => {
      console.error('Snapshot Error:', err);
      setErrorMsg('Error de permisos o red: ' + err.message);
      setCargando(false);
    });
    return unsub;
  }, [modo, desde, hasta, rangoValido]);

  // Detalle: los pasajeros se leen solo aquí. 'detalleReq' descarta respuestas de detalles ya cerrados
  // o reemplazados por otro.
  const detalleReq = useRef(0);
  const abrirDetalle = async (sol) => {
    const req = ++detalleReq.current;
    setDetalle({ ...sol, pasajeros: null });
    try {
      const ps = await getDocs(collection(db, `solicitudes/${sol.id}/pasajeros`));
      if (req !== detalleReq.current) return;
      const pasajeros = ps.docs.map(d => d.data());
      const resumen = resumenPasajeros(pasajeros); // también cubre las solicitudes viejas sin resumen
      // Teléfono del padrón (empleadosContacto): solo RH lo lee; no se guarda en la solicitud
      const telefonos = await leerTelefonos(pasajeros.map(p => String(p.nomina))).catch(() => new Map());
      if (req !== detalleReq.current) return;
      setDetalle(prev => (prev && prev.id === sol.id ? {
        ...prev, pasajeros, totalAlimentos: resumen.totalAlimentos, _telefonos: telefonos,
        _turnosStr: textoConteo(resumen.conteoTurnos), _puestosStr: textoConteo(resumen.conteoPuestos),
      } : prev));
    } catch (err) {
      if (req !== detalleReq.current) return;
      toast.error('No se pudieron cargar los pasajeros: ' + err.message);
      setDetalle(prev => (prev && prev.id === sol.id ? { ...prev, pasajeros: [] } : prev));
    }
  };
  const cerrarDetalle = () => { detalleReq.current++; setDetalle(null); };

  const handleTransaccion = async (sol, nuevoEstatus, motivo = '') => {
    setProcesando(sol.id);
    try {
      const ref = doc(db, 'solicitudes', sol.id);
      await runTransaction(db, async (t) => {
        const docSnap = await t.get(ref);
        if (!docSnap.exists()) throw new Error('No existe la solicitud.');
        const data = docSnap.data();
        
        if (nuevoEstatus !== ESTATUS_SOLICITUD.PENDIENTE && data.estatus !== ESTATUS_SOLICITUD.PENDIENTE) {
          throw new Error(`Esta solicitud ya fue ${data.estatus} por ${data.revisadoPorNombre || 'alguien'}.`);
        }

        const updateData = {
          estatus: nuevoEstatus,
          vistoPorSolicitante: false,
        };
        
        if (nuevoEstatus !== ESTATUS_SOLICITUD.PENDIENTE) {
          updateData.revisadoPor = usuario.uid;
          updateData.revisadoPorNombre = usuario.nombre;
          updateData.fechaRevision = serverTimestamp();
          if (motivo) updateData.motivoRechazo = motivo;
        }

        const histEntry = {
          fecha: new Date().toISOString(),
          usuario: usuario?.nombre || '',
          accion: nuevoEstatus,
          comentario: motivo || `Cambio de estatus a ${nuevoEstatus}`
        };

        const currentHist = data.historial || [];
        updateData.historial = [...currentHist, histEntry];

        t.update(ref, updateData);
      });
      toast.success(`Solicitud ${nuevoEstatus} con éxito.`);
      if (detalle?.id === sol.id) cerrarDetalle();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcesando(null);
      setModalAprobar(null);
      setModalRechazar(null);
      setMotivoRechazo('');
    }
  };

  const confirmRevert = async (sol) => {
    if (await confirmar({ titulo: 'Regresar a pendiente', mensaje: '¿Estás seguro de regresar esta solicitud a Pendiente?', textoConfirmar: 'Regresar' })) {
      handleTransaccion(sol, ESTATUS_SOLICITUD.PENDIENTE);
    }
  };

  const filtradas = solicitudes.filter(s => {
    const q = busqueda.toLowerCase();
    const okBusq = !q || (s.solicitanteNombre||'').toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || (s.folioTE||'').toLowerCase().includes(q);
    const esTE = s.origen === 'tiempo_extra';
    if ((filtroOrigen === 'tiempo_extra' && !esTE) || (filtroOrigen === 'normal' && esTE)) return false;
    
    // Si no se está filtrando explícitamente por 'cancelada', oculta las canceladas.
    let okEst = false;
    if (filtroEstatus === ESTATUS_SOLICITUD.CANCELADA) {
      okEst = s.estatus === ESTATUS_SOLICITUD.CANCELADA;
    } else if (filtroEstatus === '') {
      okEst = s.estatus !== ESTATUS_SOLICITUD.CANCELADA;
    } else {
      okEst = s.estatus === filtroEstatus;
    }
    
    return okBusq && okEst;
  });

  return (
    <div className="space-y-8">
      <EncabezadoPagina
        antetitulo="Recursos Humanos"
        titulo="Solicitudes de transporte"
        descripcion="Gestión global de viajes de todos los usuarios."
        accion={<div className="max-w-xs"><BotonFormatoRutas /></div>}
      />

      {errorMsg && <Aviso tono="error" titulo="No se pudo leer la lista">{errorMsg}. Revisa tu conexión y vuelve a abrir esta pantalla.</Aviso>}

      {/* Filtros */}
      <section aria-label="Filtros" className="space-y-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[auto_auto_1fr_1fr_1fr] lg:items-end">
          <Campo etiqueta="Fecha de servicio, desde"><Entrada type="date" value={desde} onChange={e => aplicarRango(e.target.value, hasta)} /></Campo>
          <Campo etiqueta="Hasta"><Entrada type="date" value={hasta} onChange={e => aplicarRango(desde, e.target.value)} /></Campo>
          <Campo etiqueta="Estado">
            <Selector value={filtroEstatus} onChange={e => setFiltroEstatus(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value={ESTATUS_SOLICITUD.PENDIENTE}>Pendientes</option>
              <option value={ESTATUS_SOLICITUD.APROBADA}>Aprobadas</option>
              <option value={ESTATUS_SOLICITUD.RECHAZADA}>Rechazadas</option>
              <option value={ESTATUS_SOLICITUD.CANCELADA}>Canceladas</option>
            </Selector>
          </Campo>
          {REVISION_ACTIVA && (
            <Campo etiqueta="Origen">
              <Selector value={filtroOrigen} onChange={e => setFiltroOrigen(e.target.value)}>
                <option value="">Todas</option>
                <option value="normal">Normales</option>
                <option value="tiempo_extra">Tiempo extra</option>
              </Selector>
            </Campo>
          )}
          <Campo etiqueta="Buscar"><Entrada type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Solicitante o folio" /></Campo>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            ['Hoy', () => aplicarRango(ymd(), ymd())],
            ['Esta semana', () => { const r = rangoSemana(ymd(), 0); aplicarRango(r.desde, r.hasta); }],
            ['Próxima semana', () => { const r = rangoSemana(ymd(), 1); aplicarRango(r.desde, r.hasta); }],
          ].map(([texto, fn]) => <Boton key={texto} tamano="sm" onClick={fn}>{texto}</Boton>)}
          {REVISION_ACTIVA && (
            <Boton tamano="sm" variante={modo === 'pendientes' ? 'secundario' : 'contorno'} aria-pressed={modo === 'pendientes'} onClick={verPendientes}
              title="Todas las pendientes, sin importar la fecha de servicio">Todas las pendientes</Boton>
          )}
          <span className="ml-auto text-sm font-medium text-[var(--text-main)]" aria-live="polite">{filtradas.length} {filtradas.length === 1 ? 'solicitud' : 'solicitudes'}</span>
        </div>
      </section>

      {!rangoValido && <Aviso tono="aviso">Elige un rango de fechas válido: la fecha inicial no puede ser posterior a la final.</Aviso>}

      {/* Tabla */}
      {cargando ? <EsqueletoTabla filas={4} columnas={7} /> : filtradas.length === 0 ? (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
          <EstadoVacio titulo="Sin solicitudes" texto="No hay solicitudes de transporte en este rango con esos filtros. Cambia las fechas o el estado." />
        </div>
      ) : (
        <Tabla etiqueta="Solicitudes de transporte">
          <thead>
            <tr><Th>Folio</Th><Th>Solicitante</Th><Th>Puesto / Turnos</Th><Th>Fecha de servicio</Th><Th derecha>Pasajeros</Th><Th>Estado</Th><Th derecha>Acciones</Th></tr>
          </thead>
          <tbody>
            {filtradas.map(sol => (
              <Fila key={sol.id}>
                <Td mono>{folioVisible(sol)}</Td>
                <Td className="font-medium">{sol.solicitanteNombre}
                  <div className="mt-1 flex flex-col items-start gap-1">
                    {sol.origen === 'tiempo_extra' && (
                      <Link to={`/tiempo-extra/consulta?abrir=${sol.tiempoExtraId}`} title="Abrir el tiempo extra" className="rounded-md">
                        <Insignia tono="info" icono={Timer}>Tiempo extra · {sol.folioTE}</Insignia>
                      </Link>
                    )}
                    {sol.requiereRevision && <span title={sol.motivoRevision}><Insignia tono="aviso">Revisar: avisar al proveedor</Insignia></span>}
                  </div>
                </Td>
                <Td className="max-w-[10rem] text-[var(--text-secondary)]"><span className="block truncate" title={sol._puestosStr}>{sol._puestosStr}</span><span className="text-xs font-medium text-[var(--text-main)]">{sol._turnosStr}</span></Td>
                <Td className="whitespace-nowrap font-medium">{fmtFechaStr(sol.fechaServicio)}</Td>
                <Td derecha>{sol.totalPasajeros}</Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <BadgeEstatus estatus={sol.estatus} conPunto />
                    {sol.modificada && <Insignia tono="aviso" icono={AlertTriangle}>Modificada</Insignia>}
                    {sol.historial?.some(h => h.esAviso) && <span title="El solicitante envió un mensaje"><Insignia tono="info">Aviso del solicitante</Insignia></span>}
                    {sol.estatus === ESTATUS_SOLICITUD.CANCELADA && sol.historial?.some(h => h.accion === ESTATUS_SOLICITUD.APROBADA) && <span title="Fue cancelada después de ser aprobada"><Insignia tono="error">Antes aprobada</Insignia></span>}
                  </div>
                </Td>
                <Td className="text-right">
                  <div className="inline-flex gap-1">
                    <Boton variante="fantasma" tamano="icono" onClick={() => abrirDetalle(sol)} title="Ver detalle" aria-label={`Ver detalle de ${folioVisible(sol)}`}><Eye className="h-4 w-4" aria-hidden="true" /></Boton>
                    {REVISION_ACTIVA && sol.origen !== 'tiempo_extra' && <Boton variante="fantasma" tamano="icono" onClick={() => navigate(rutaEditarTransporte(sol.id))} title="Editar (RH)" aria-label="Editar"><Edit className="h-4 w-4" aria-hidden="true" /></Boton>}
                    {REVISION_ACTIVA && sol.estatus === ESTATUS_SOLICITUD.PENDIENTE && (
                      <>
                        <Boton variante="peligro" tamano="icono" onClick={() => setModalRechazar(sol)} title="Rechazar" aria-label="Rechazar"><XCircle className="h-4 w-4" aria-hidden="true" /></Boton>
                        <Boton tamano="icono" onClick={() => setModalAprobar(sol)} title="Aprobar" aria-label="Aprobar"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /></Boton>
                      </>
                    )}
                    {REVISION_ACTIVA && [ESTATUS_SOLICITUD.APROBADA, ESTATUS_SOLICITUD.RECHAZADA, ESTATUS_SOLICITUD.ENVIADA_PROVEEDOR].includes(sol.estatus) && (
                      <Boton tamano="icono" onClick={() => confirmRevert(sol)} title="Revertir a pendiente" aria-label="Revertir a pendiente"><Undo2 className="h-4 w-4" aria-hidden="true" /></Boton>
                    )}
                  </div>
                </Td>
              </Fila>
            ))}
          </tbody>
        </Tabla>
      )}

      {/* MODALES */}
      <Modal isOpen={!!modalAprobar} onClose={() => setModalAprobar(null)} title="Aprobar solicitud" maxWidth="max-w-sm">
        {modalAprobar && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">Se aprobará la solicitud de <strong className="font-medium text-[var(--text-main)]">{modalAprobar.totalPasajeros} pasajeros</strong> para el <strong className="font-medium text-[var(--text-main)]">{fmtFechaStr(modalAprobar.fechaServicio)}</strong> (turnos: {modalAprobar._turnosStr}).</p>
            <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-color)] pt-4 sm:flex-row sm:justify-end">
              <Boton onClick={() => setModalAprobar(null)}>Cancelar</Boton>
              <Boton variante="primario" icono={CheckCircle2} estado={procesando === modalAprobar.id ? 'cargando' : undefined} onClick={() => handleTransaccion(modalAprobar, ESTATUS_SOLICITUD.APROBADA)} disabled={!!procesando}>Confirmar</Boton>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!modalRechazar} onClose={() => setModalRechazar(null)} title="Rechazar solicitud" maxWidth="max-w-sm">
        {modalRechazar && (
          <div className="space-y-4">
            <Campo etiqueta="Motivo del rechazo" ayuda="Obligatorio: mínimo 5 caracteres." obligatorio>
              <AreaTexto rows={3} value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)} placeholder="Explica por qué se rechaza" />
            </Campo>
            <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-color)] pt-4 sm:flex-row sm:justify-end">
              <Boton onClick={() => setModalRechazar(null)}>Cancelar</Boton>
              <Boton variante="peligro" icono={XCircle} estado={procesando === modalRechazar.id ? 'cargando' : undefined} onClick={() => handleTransaccion(modalRechazar, ESTATUS_SOLICITUD.RECHAZADA, motivoRechazo)} disabled={!!procesando || motivoRechazo.trim().length < 5}>Rechazar</Boton>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!detalle} onClose={cerrarDetalle} title="Formato de Solicitud de Rutas" maxWidth="max-w-5xl">
        {detalle && (
          <div className="space-y-6">
            <div className="overflow-hidden rounded-lg border border-[var(--border-color)]">
              <div className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">Fecha de solicitud: <span className="text-[var(--text-main)]">{fmtIso(detalle.fechaSolicitud)}</span> · Fecha de servicio: <span className="text-[var(--text-main)]">{fmtFechaStr(detalle.fechaServicio)}</span></p>
              </div>
              <dl className="grid grid-cols-2 gap-4 border-b border-[var(--border-color)] p-4 text-sm md:grid-cols-4">
                <div><dt className="text-xs text-[var(--text-muted)]">Solicitante</dt><dd className="font-medium text-[var(--text-main)]">{detalle.solicitanteNombre}{detalle.origen === 'tiempo_extra' ? ` · Tiempo extra ${detalle.folioTE}` : ''}</dd></div>
                <div><dt className="text-xs text-[var(--text-muted)]">Turno</dt><dd className="font-medium text-[var(--text-main)]">{detalle._turnosStr}</dd></div>
                <div><dt className="text-xs text-[var(--text-muted)]">Área</dt><dd className="font-medium text-[var(--text-main)]">{detalle._puestosStr}</dd></div>
                <div><dt className="text-xs text-[var(--text-muted)]">Estatus</dt><dd className="mt-0.5"><BadgeEstatus estatus={detalle.estatus} conPunto /></dd></div>
              </dl>

              {/* Tabla de beneficiarios */}
              {detalle.pasajeros === null ? <div className="p-4"><EsqueletoTabla filas={3} columnas={6} /></div> : (
                <Tabla etiqueta="Pasajeros" className="rounded-none border-0">
                  <thead>
                    <tr><Th>Área</Th><Th>Puesto</Th><Th>Nómina</Th><Th>Nombre</Th><Th>Entrada</Th><Th>Salida</Th><Th>Alimentos</Th><Th>Ruta</Th><Th>Comunidad o colonia</Th><Th>Punto de reunión</Th><Th>Teléfono</Th></tr>
                  </thead>
                  <tbody>
                    {detalle.pasajeros.map(p => {
                      const nameR = catalogos.rutas.find(r => r.id === p.rutaId)?.nombre || '';
                      const nameC = catalogos.comunidades.find(c => c.id === p.comunidadId)?.nombre || '';
                      const nameP = catalogos.puntos.find(pt => pt.id === p.puntoReunionId)?.nombre || '';
                      return (
                        <Fila key={p.nomina}>
                          <Td>{nombreAreaDe(p.areaId || detalle.areaId) || p.areaNombre || ''}</Td>
                          <Td>{p.puesto}</Td>
                          <Td mono>{p.nomina}</Td>
                          <Td>{p.nombre}</Td>
                          <Td mono>{p.horaEntrada}</Td>
                          <Td mono>{p.horaSalida}</Td>
                          <Td>{p.alimentos ? 'Sí' : 'No'}</Td>
                          <Td>{nameR}</Td>
                          <Td>{nameC}</Td>
                          <Td>{nameP}</Td>
                          <Td mono>{formatoTelefono(detalle._telefonos?.get(String(p.nomina)) ?? '') || '—'}</Td>
                        </Fila>
                      );
                    })}
                  </tbody>
                </Tabla>
              )}

              {/* Conteos */}
              <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-[var(--border-color)] bg-[var(--bg-surface-secondary)] p-4 text-sm text-[var(--text-main)]">
                <p><span className="text-[var(--text-secondary)]">Pasajeros:</span> {detalle.totalPasajeros}</p>
                <p><span className="text-[var(--text-secondary)]">Con alimentos:</span> {detalle.pasajeros ? detalle.pasajeros.filter(p => p.alimentos).length : (detalle.totalAlimentos ?? '—')}</p>
                <p><span className="text-[var(--text-secondary)]">Sin alimentos:</span> {detalle.pasajeros ? detalle.pasajeros.filter(p => !p.alimentos).length : (detalle.totalAlimentos != null ? (detalle.totalPasajeros || 0) - detalle.totalAlimentos : '—')}</p>
              </div>
            </div>

            {/* Historial */}
            <section aria-label="Historial de la solicitud">
              <h3 className="mb-3 text-sm font-semibold text-[var(--text-main)]">Historial de la solicitud</h3>
              <div className="space-y-3">
                {(detalle.historial || []).map((h, i) => (
                  <div key={i} className={`rounded-md border p-3 text-sm ${h.esAviso ? 'border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]' : 'border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-main)]'}`}>
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <span className="font-medium">{h.usuario}</span>
                      <span className="text-xs text-[var(--text-muted)]">{fmtFechaHora(h.fecha)}</span>
                    </div>
                    <Insignia>{h.accion}</Insignia>
                    <p className="mt-2">{h.comentario}</p>
                  </div>
                ))}
                {(!detalle.historial || detalle.historial.length === 0) && <p className="text-sm text-[var(--text-muted)]">Sin historial registrado.</p>}
              </div>
            </section>
          </div>
        )}
      </Modal>
    </div>
  );
}
