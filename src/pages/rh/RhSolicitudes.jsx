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
import {
  Filter, CheckCircle2, XCircle, Loader2, Eye, FileDown, Undo2, Edit, AlertTriangle,
} from 'lucide-react';
import Ayuda from '../../components/Ayuda';
import Modal from '../../components/Modal';
import BadgeEstatus from '../../components/BadgeEstatus';
import { toDate, fmtFecha, fmtFechaHora, ymd, sumarDias, rangoSemana } from '../../utils/fechas';
import { resumenPasajeros, textoConteo } from '../../utils/solicitudes';
import { useCatalogos } from '../../hooks/useCatalogos';
import { useAreas } from '../../hooks/useAreas';
import { useConfirmar } from '../../hooks/useConfirmar';
import { exportarSolicitudes } from '../../utils/exportarSolicitudes';
import { ESTATUS_SOLICITUD } from '../../utils/constantes';

// Helpers
// fechaSolicitud puede ser Timestamp (nuevas) o string ISO (viejas)
const fmtIso = fmtFecha;
function fmtFechaStr(str) {
  if (!str) return '—';
  const [yyyy, mm, dd] = str.split('-');
  if (!yyyy || !mm || !dd) return str;
  return `${dd}/${mm}/${yyyy}`;
}

const inputCls = 'rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--cm-red)]';

function getLocalDates() {
  const d = new Date();
  const H = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  d.setDate(d.getDate() + 1);
  const M = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { hoy: H, manana: M };
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

function ordenarSols(sols) {
  return sols.sort((a, b) => {
    const fsA = a.fechaServicio || ''; const fsB = b.fechaServicio || '';
    if (fsA !== fsB) return fsB.localeCompare(fsA); // Descendente por fecha servicio
    return (b.fechaSolicitud || '').localeCompare(a.fechaSolicitud || '');
  });
}

const btnRango = 'rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors';

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
  const [exportando, setExportando] = useState(false);

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

  // Estado para Modal de Exportación
  const [modalExportar, setModalExportar] = useState(false);
  const { hoy: L_HOY, manana: L_MANANA } = getLocalDates();
  const [expTipoFecha, setExpTipoFecha] = useState('manana');
  const [expEsRango, setExpEsRango] = useState(false);
  const [expElegida, setExpElegida] = useState(L_MANANA);
  const [expDesde, setExpDesde] = useState(L_HOY);
  const [expHasta, setExpHasta] = useState(L_HOY);
  const [expAprobadas, setExpAprobadas] = useState(true);
  const [expPendientes, setExpPendientes] = useState(false);

  // Cálculos reactivos de exportación
  const expFechaAplicar = expTipoFecha === 'hoy' ? L_HOY : (expTipoFecha === 'manana' ? L_MANANA : null);
  const expRangoDesde = expEsRango && expTipoFecha === 'elegir' ? expDesde : (expTipoFecha === 'elegir' ? expElegida : expFechaAplicar);
  const expRangoHasta = expEsRango && expTipoFecha === 'elegir' ? expHasta : (expTipoFecha === 'elegir' ? expElegida : expFechaAplicar);

  // La exportación no depende de la lista: si su rango cae dentro de lo que ya está cargado se reutiliza
  // (0 lecturas); si no, se consulta ese rango. La bandera 'vigente' ignora respuestas de rangos viejos.
  const expValido = !!expRangoDesde && !!expRangoHasta && expRangoDesde <= expRangoHasta;
  const expEnMemoria = expValido && modo === 'rango' && rangoValido && expRangoDesde >= desde && expRangoHasta <= hasta;
  const expClave = `${expRangoDesde}|${expRangoHasta}`;
  const [expCand, setExpCand] = useState({ clave: '', lista: [] });

  useEffect(() => {
    if (!modalExportar || !expValido || expEnMemoria) return;
    let vigente = true;
    getDocs(query(collection(db, 'solicitudes'), where('fechaServicio', '>=', expRangoDesde), where('fechaServicio', '<=', expRangoHasta)))
      .then(snap => { if (vigente) setExpCand({ clave: expClave, lista: snap.docs.map(normalizarSol) }); })
      .catch(err => {
        if (!vigente) return;
        toast.error('No se pudieron consultar las solicitudes a exportar: ' + err.message);
        setExpCand({ clave: expClave, lista: [] });
      });
    return () => { vigente = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalExportar, expValido, expEnMemoria, expClave]);

  const expCargando = modalExportar && expValido && !expEnMemoria && expCand.clave !== expClave;
  const candidatas = expEnMemoria ? solicitudes : (expCand.clave === expClave ? expCand.lista : []);

  const solsParaExportar = candidatas.filter(s => {
    if (!expAprobadas && s.estatus === ESTATUS_SOLICITUD.APROBADA) return false;
    if (!expPendientes && s.estatus === ESTATUS_SOLICITUD.PENDIENTE) return false;
    if (s.estatus !== ESTATUS_SOLICITUD.APROBADA && s.estatus !== ESTATUS_SOLICITUD.PENDIENTE) return false;
    if (!s.fechaServicio) return false;
    if (expRangoDesde && s.fechaServicio < expRangoDesde) return false;
    if (expRangoHasta && s.fechaServicio > expRangoHasta) return false;
    return true;
  });

  const pasExportCount = solsParaExportar.reduce((acc, s) => acc + (s.totalPasajeros || 0), 0);

  // Los pasajeros se leen solo al exportar (en tandas para no saturar la red)
  const btnExportarModalClick = async () => {
    const suffix = (expEsRango && expTipoFecha === 'elegir') ? `${expDesde}_a_${expHasta}` : expRangoDesde;
    const fileName = `Transporte_${suffix}.xlsx`;
    setExportando(true);
    try {
      const conPasajeros = [];
      for (let i = 0; i < solsParaExportar.length; i += 20) {
        const tanda = await Promise.all(solsParaExportar.slice(i, i + 20).map(async (sol) => {
          const ps = await getDocs(collection(db, `solicitudes/${sol.id}/pasajeros`));
          return { ...sol, pasajeros: ps.docs.map(d => d.data()) };
        }));
        conPasajeros.push(...tanda);
      }
      await exportarSolicitudes(conPasajeros, catalogos, toast, fileName);
      setModalExportar(false);
    } catch (err) {
      console.error(err);
      toast.error('No se pudo exportar: ' + err.message);
    } finally {
      setExportando(false);
    }
  };

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
      setDetalle(prev => (prev && prev.id === sol.id ? {
        ...prev, pasajeros, totalAlimentos: resumen.totalAlimentos,
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between border-b border-[var(--border-color)] pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Recursos Humanos</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">Todas las solicitudes</h1>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Gestión global de viajes de todos los usuarios.</p>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] p-4 text-sm text-[var(--status-error-text)]">
          <strong>Error de consulta:</strong> {errorMsg}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 text-xs">
        <Filter className="h-4 w-4 text-[var(--text-muted)]" />
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-[var(--text-secondary)]">Del
            <input type="date" value={desde} onChange={e=>aplicarRango(e.target.value, hasta)} className={inputCls} title="Fecha de servicio desde" />
          </label>
          <label className="flex items-center gap-1 text-[var(--text-secondary)]">al
            <input type="date" value={hasta} onChange={e=>aplicarRango(desde, e.target.value)} className={inputCls} title="Fecha de servicio hasta" />
          </label>
          {[
            ['Hoy', () => aplicarRango(ymd(), ymd())],
            ['Esta semana', () => { const r = rangoSemana(ymd(), 0); aplicarRango(r.desde, r.hasta); }],
            ['Próxima semana', () => { const r = rangoSemana(ymd(), 1); aplicarRango(r.desde, r.hasta); }],
          ].map(([texto, fn]) => (
            <button key={texto} type="button" onClick={fn}
              className={`${btnRango} border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]`}>{texto}</button>
          ))}
          <button type="button" onClick={verPendientes}
            className={`${btnRango} ${modo === 'pendientes' ? 'border-[var(--cm-red)] bg-[var(--cm-red)] text-white' : 'border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]'}`}
            title="Todas las pendientes, sin importar la fecha de servicio">Todas las pendientes</button>
        </div>
        <select value={filtroEstatus} onChange={e=>setFiltroEstatus(e.target.value)} className={inputCls}>
          <option value="">Todos los estados</option>
          <option value={ESTATUS_SOLICITUD.PENDIENTE}>Pendientes</option>
          <option value={ESTATUS_SOLICITUD.APROBADA}>Aprobadas</option>
          <option value={ESTATUS_SOLICITUD.RECHAZADA}>Rechazadas</option>
          <option value={ESTATUS_SOLICITUD.CANCELADA}>Canceladas</option>
        </select>
        <select value={filtroOrigen} onChange={e=>setFiltroOrigen(e.target.value)} className={inputCls} aria-label="Origen">
          <option value="">Todas</option>
          <option value="normal">Normales</option>
          <option value="tiempo_extra">Tiempo extra</option>
        </select>
        <input type="search" value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar..." className={inputCls} />
        <div className="ml-auto flex items-center gap-2">
          <span className="font-semibold text-[var(--text-main)]">{filtradas.length} solicitudes</span>
          <div className="max-w-[15rem]">
            <button type="button" id="btn-formato-rutas" onClick={()=>setModalExportar(true)} className="inline-flex items-center gap-1.5 rounded-md bg-[var(--status-success-text)] px-3 py-1.5 text-white text-xs hover:bg-[var(--status-success-text)] hover:opacity-90 transition-opacity disabled:opacity-50">
              <FileDown className="h-3.5 w-3.5"/> Formato de rutas (proveedor)
            </button>
            <Ayuda clave="descarga.formatoRutas" />
          </div>
        </div>
      </div>

      {!rangoValido && (
        <div className="rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 text-xs text-[var(--status-warning-text)]">Elige un rango de fechas válido (la fecha inicial no puede ser posterior a la final).</div>
      )}

      {/* Tabla */}
      <div className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] uppercase">
            <tr>
              <th className="px-4 py-3">Folio</th><th className="px-4 py-3">Solicitante</th>
              <th className="px-4 py-3">Puesto / Turnos</th><th className="px-4 py-3">Fecha Servicio</th>
              <th className="px-4 py-3 text-center">Pas.</th><th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {cargando ? <tr><td colSpan={7} className="py-8 text-center text-[var(--text-muted)]"><Loader2 className="h-5 w-5 animate-spin mx-auto"/></td></tr> :
             filtradas.length === 0 ? <tr><td colSpan={7} className="py-8 text-center text-[var(--text-muted)]">Sin resultados</td></tr> :
             filtradas.map(sol => (
              <tr key={sol.id} className="hover:bg-[var(--bg-surface-secondary)]">
                <td className="px-4 py-3 font-mono">{sol.id.slice(0,8)}</td>
                <td className="px-4 py-3 font-medium">{sol.solicitanteNombre}
                  {sol.origen === 'tiempo_extra' && (
                    <Link to={`/tiempo-extra/consulta?abrir=${sol.tiempoExtraId}`} title="Abrir el tiempo extra"
                      className="mt-0.5 block w-fit rounded-full border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--status-info-text)] hover:underline">Tiempo extra · {sol.folioTE}</Link>
                  )}
                  {sol.requiereRevision && <span className="mt-0.5 block w-fit rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--status-warning-text)]" title={sol.motivoRevision}>Revisar: avisar al proveedor</span>}
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)] truncate max-w-[120px]" title={sol._puestosStr}>{sol._puestosStr} <br/><span className="text-[10px] font-bold text-[var(--text-main)]">{sol._turnosStr}</span></td>
                <td className="px-4 py-3 font-bold">{fmtFechaStr(sol.fechaServicio)}</td>
                <td className="px-4 py-3 text-center"><span className="rounded-full bg-[var(--bg-surface-secondary)] px-2 py-0.5 border">{sol.totalPasajeros}</span></td>
                <td className="px-4 py-3"><BadgeEstatus estatus={sol.estatus} conPunto />
                  {sol.modificada && <span className="ml-2 inline-flex items-center gap-1 text-[9px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full uppercase"><AlertTriangle className="h-3 w-3"/> Modificada</span>}
                  {sol.historial?.some(h=>h.esAviso) && <span className="ml-2 inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full uppercase" title="El solicitante envió un mensaje">Aviso del solicitante</span>}
                  {sol.estatus === ESTATUS_SOLICITUD.CANCELADA && sol.historial?.some(h=>h.accion === ESTATUS_SOLICITUD.APROBADA) && <span className="ml-2 inline-flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full uppercase" title="Fue cancelada después de ser aprobada">Antes aprobada</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <button onClick={()=>abrirDetalle(sol)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)]" title="Ver Detalle"><Eye className="h-4 w-4"/></button>
                    {sol.origen !== 'tiempo_extra' && <button onClick={()=>navigate(`/rutas/solicitud/editar/${sol.id}`)} className="p-1.5 text-blue-600 hover:text-blue-800" title="Editar (RH)"><Edit className="h-4 w-4"/></button>}
                    {sol.estatus === ESTATUS_SOLICITUD.PENDIENTE && (
                      <>
                        <button onClick={()=>setModalRechazar(sol)} className="p-1.5 text-[var(--status-error-text)] bg-[var(--status-error-bg)] hover:bg-[var(--status-error-bg)] rounded-md" title="Rechazar"><XCircle className="h-4 w-4"/></button>
                        <button onClick={()=>setModalAprobar(sol)} className="p-1.5 text-[var(--status-success-text)] bg-[var(--status-success-bg)] hover:bg-[var(--status-success-bg)] rounded-md" title="Aprobar"><CheckCircle2 className="h-4 w-4"/></button>
                      </>
                    )}
                    {[ESTATUS_SOLICITUD.APROBADA,ESTATUS_SOLICITUD.RECHAZADA,ESTATUS_SOLICITUD.ENVIADA_PROVEEDOR].includes(sol.estatus) && (
                      <button onClick={()=>confirmRevert(sol)} title="Revertir a pendiente" className="p-1.5 text-[var(--status-warning-text)] bg-[var(--status-warning-bg)] hover:opacity-80 rounded-md"><Undo2 className="h-4 w-4"/></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODALES */}
      <Modal isOpen={modalExportar} onClose={() => setModalExportar(false)} title="" maxWidth="max-w-md">
        <div className="space-y-5 -mt-2">
          <div>
            <h3 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2"><FileDown className="h-5 w-5"/> Formato de rutas (proveedor)</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Excel para el proveedor de transporte: solo los empleados que llevan transporte. No depende de los filtros de la tabla.</p>
          </div>
          
          <div className="space-y-4">
            {/* Fecha */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Fecha de Servicio</label>
              <div className="flex gap-4 text-sm text-[var(--text-main)]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="rFecha" checked={expTipoFecha==='hoy'} onChange={()=>setExpTipoFecha('hoy')} className="accent-[var(--cm-red)]" /> Hoy
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="rFecha" checked={expTipoFecha==='manana'} onChange={()=>setExpTipoFecha('manana')} className="accent-[var(--cm-red)]" /> Mañana
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="rFecha" checked={expTipoFecha==='elegir'} onChange={()=>setExpTipoFecha('elegir')} className="accent-[var(--cm-red)]" /> Elegir fecha
                </label>
              </div>
              {expTipoFecha === 'elegir' && (
                <div className="mt-2 p-3 border border-[var(--border-subtle)] rounded-md bg-[var(--bg-surface-secondary)] space-y-3">
                  <label className="flex items-center gap-2 text-xs text-[var(--text-main)]">
                    <input type="checkbox" checked={expEsRango} onChange={e=>setExpEsRango(e.target.checked)} className="accent-[var(--cm-red)]" />
                    Rango de fechas
                  </label>
                  {!expEsRango ? (
                    <input type="date" value={expElegida} onChange={e=>setExpElegida(e.target.value)} className={inputCls + " w-full"} />
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1"><span className="text-xs text-[var(--text-muted)] block">Desde:</span><input type="date" value={expDesde} onChange={e=>setExpDesde(e.target.value)} className={inputCls + " w-full"} /></div>
                      <div className="flex-1"><span className="text-xs text-[var(--text-muted)] block">Hasta:</span><input type="date" value={expHasta} onChange={e=>setExpHasta(e.target.value)} className={inputCls + " w-full"} /></div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Estatus */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Incluir estatus</label>
              <div className="flex gap-4 text-sm text-[var(--text-main)]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={expAprobadas} onChange={e=>setExpAprobadas(e.target.checked)} className="accent-[var(--cm-red)]" /> Aprobadas
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={expPendientes} onChange={e=>setExpPendientes(e.target.checked)} className="accent-[var(--cm-red)]" /> Pendientes
                </label>
              </div>
            </div>

            {/* Resumen */}
            <div className="mt-4 border border-[var(--border-subtle)] rounded-md p-3 text-sm text-[var(--text-main)] bg-[var(--bg-surface-secondary)]">
              {expCargando ? (
                <div className="flex items-center gap-2 text-[var(--text-secondary)]"><Loader2 className="h-4 w-4 animate-spin"/> Buscando solicitudes...</div>
              ) : solsParaExportar.length === 0 ? (
                <div className="text-[var(--status-error-text)] font-semibold flex items-center gap-1.5"><XCircle className="h-4 w-4"/> No hay solicitudes aprobadas para esta fecha.</div>
              ) : (
                <ul className="space-y-1">
                  <li className="font-semibold">{solsParaExportar.length} solicitudes encontradas</li>
                  <li>{pasExportCount} pasajeros en total</li>
                  {expPendientes && solsParaExportar.some(s=>s.estatus===ESTATUS_SOLICITUD.PENDIENTE) && (
                    <li className="text-[var(--status-warning-text)] text-xs font-semibold mt-1">Atención: Hay pendientes incluidas.</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border-color)] mt-4">
            <button onClick={()=>setModalExportar(false)} className="px-4 py-2 text-xs font-semibold border border-[var(--border-color)] text-[var(--text-main)] rounded-md hover:bg-[var(--bg-surface-hover)] transition-colors">Cancelar</button>
            <button onClick={btnExportarModalClick} disabled={solsParaExportar.length === 0 || expCargando || exportando} className="px-4 py-2 text-xs font-semibold bg-[var(--status-success-text)] text-white rounded-md flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity">
              {exportando ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <FileDown className="h-3.5 w-3.5"/>} {exportando ? 'Generando...' : 'Descargar Excel'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!modalAprobar} onClose={() => setModalAprobar(null)} title="Aprobar Solicitud" maxWidth="max-w-sm">
        {modalAprobar && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">Se aprobará la solicitud de <strong>{modalAprobar.totalPasajeros} pasajeros</strong> para el <strong>{fmtFechaStr(modalAprobar.fechaServicio)}</strong> (Turnos: {modalAprobar._turnosStr}).</p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)] mt-2">
              <button onClick={()=>setModalAprobar(null)} className="px-4 py-2 text-xs font-semibold border border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] rounded-md">Cancelar</button>
              <button onClick={()=>handleTransaccion(modalAprobar, ESTATUS_SOLICITUD.APROBADA)} disabled={!!procesando} className="px-4 py-2 text-xs font-semibold bg-[var(--status-success-text)] text-white rounded-md flex items-center gap-1 hover:opacity-90">
                {procesando === modalAprobar.id ? <Loader2 className="h-3 w-3 animate-spin"/> : <CheckCircle2 className="h-3 w-3"/>} Confirmar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!modalRechazar} onClose={() => setModalRechazar(null)} title="Rechazar Solicitud" maxWidth="max-w-sm">
        {modalRechazar && (
          <div className="space-y-4">
            <textarea value={motivoRechazo} onChange={e=>setMotivoRechazo(e.target.value)} placeholder="Motivo del rechazo (obligatorio)..." className="w-full text-sm border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] p-2 rounded-md h-24 outline-none focus:border-[var(--cm-red)]" />
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)] mt-2">
              <button onClick={()=>setModalRechazar(null)} className="px-4 py-2 text-xs font-semibold border border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] rounded-md">Cancelar</button>
              <button onClick={()=>handleTransaccion(modalRechazar, ESTATUS_SOLICITUD.RECHAZADA, motivoRechazo)} disabled={!!procesando || motivoRechazo.trim().length<5} className="px-4 py-2 text-xs font-semibold bg-[var(--status-error-text)] hover:opacity-90 text-white rounded-md disabled:opacity-50 flex items-center gap-1">
                {procesando === modalRechazar.id ? <Loader2 className="h-3 w-3 animate-spin"/> : <XCircle className="h-3 w-3"/>} Confirmar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!detalle} onClose={cerrarDetalle} title="" maxWidth="max-w-5xl" className="!p-0">
        {detalle && (
          <div className="-m-5">
            <div className="border border-[var(--border-color)] mx-5 my-5">
              {/* Encabezado Visual Excel */}
              <div className="bg-[var(--cm-dark)] text-white p-3 border-b border-[var(--border-color)]">
                <h2 className="font-bold text-lg">Formato de Solicitud de Rutas</h2>
                <p className="italic text-sm text-gray-300">Fecha de Solicitud: {fmtIso(detalle.fechaSolicitud)} - Fecha de Servicio: {fmtFechaStr(detalle.fechaServicio)}</p>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-[var(--bg-surface-secondary)] border-b border-[var(--border-color)]">
                <div><strong className="text-[var(--text-muted)] uppercase text-xs block">Solicitante</strong><span className="font-bold text-[var(--text-main)]">{detalle.solicitanteNombre}{detalle.origen === 'tiempo_extra' ? ` · Tiempo extra ${detalle.folioTE}` : ''}</span></div>
                <div><strong className="text-[var(--text-muted)] uppercase text-xs block">Turno</strong><span className="font-bold text-[var(--text-main)]">{detalle._turnosStr}</span></div>
                <div><strong className="text-[var(--text-muted)] uppercase text-xs block">Área</strong><span className="font-bold text-[var(--text-main)]">{detalle._puestosStr}</span></div>
                <div><strong className="text-[var(--text-muted)] uppercase text-xs block">Estatus</strong><BadgeEstatus estatus={detalle.estatus} conPunto /></div>
              </div>
              
              {/* Tabla de Beneficiarios */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--cm-red)] text-white">
                      <th className="p-2 border border-[var(--border-color)] font-bold text-center">AREA</th>
                      <th className="p-2 border border-[var(--border-color)] font-bold text-center">PUESTO</th>
                      <th className="p-2 border border-[var(--border-color)] font-bold text-center">NÓMINA</th>
                      <th className="p-2 border border-[var(--border-color)] font-bold text-center">NOMBRE</th>
                      <th className="p-2 border border-[var(--border-color)] font-bold text-center">ENTRADA</th>
                      <th className="p-2 border border-[var(--border-color)] font-bold text-center">SALIDA</th>
                      <th className="p-2 border border-[var(--border-color)] font-bold text-center">ALIMENTOS</th>
                      <th className="p-2 border border-[var(--border-color)] font-bold text-center">RUTA</th>
                      <th className="p-2 border border-[var(--border-color)] font-bold text-center">COMUNIDAD O COLONIA</th>
                      <th className="p-2 border border-[var(--border-color)] font-bold text-center">PUNTO DE REUNION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.pasajeros === null && (
                      <tr><td colSpan={10} className="p-6 text-center text-[var(--text-muted)]"><Loader2 className="h-5 w-5 animate-spin mx-auto"/></td></tr>
                    )}
                    {(detalle.pasajeros || []).map((p, idx) => {
                      const bgCls = idx % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-[var(--bg-surface-secondary)]';
                      const nameR = catalogos.rutas.find(r => r.id === p.rutaId)?.nombre || '';
                      const nameC = catalogos.comunidades.find(c => c.id === p.comunidadId)?.nombre || '';
                      const nameP = catalogos.puntos.find(pt => pt.id === p.puntoReunionId)?.nombre || '';
                      return (
                        <tr key={p.nomina} className={`${bgCls} text-[var(--text-main)]`}>
                          <td className="p-2 border border-[var(--border-subtle)] text-center">{nombreAreaDe(p.areaId || detalle.areaId) || p.areaNombre || ''}</td>
                          <td className="p-2 border border-[var(--border-subtle)] font-medium text-center">{p.puesto}</td>
                          <td className="p-2 border border-[var(--border-subtle)] font-mono text-center">{p.nomina}</td>
                          <td className="p-2 border border-[var(--border-subtle)]">{p.nombre}</td>
                          <td className="p-2 border border-[var(--border-subtle)] text-center">{p.horaEntrada}</td>
                          <td className="p-2 border border-[var(--border-subtle)] text-center">{p.horaSalida}</td>
                          <td className={`p-2 border border-[var(--border-subtle)] text-center font-bold ${p.alimentos ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]' : ''}`}>{p.alimentos ? 'SI' : 'NO'}</td>
                          <td className="p-2 border border-[var(--border-subtle)]">{nameR}</td>
                          <td className="p-2 border border-[var(--border-subtle)]">{nameC}</td>
                          <td className="p-2 border border-[var(--border-subtle)]">{nameP}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Conteos */}
              <div className="bg-[var(--bg-surface-secondary)] text-[var(--text-main)] p-3 border-t border-[var(--border-color)] flex flex-wrap gap-6 text-sm">
                <p><strong>Pasajeros:</strong> {detalle.totalPasajeros}</p>
                <p><strong>Con alimentos:</strong> {detalle.pasajeros ? detalle.pasajeros.filter(p=>p.alimentos).length : (detalle.totalAlimentos ?? '—')}</p>
                <p><strong>Sin alimentos:</strong> {detalle.pasajeros ? detalle.pasajeros.filter(p=>!p.alimentos).length : (detalle.totalAlimentos != null ? (detalle.totalPasajeros || 0) - detalle.totalAlimentos : '—')}</p>
              </div>
            </div>

            {/* Historial */}
            <div className="px-5 pb-5">
              <h3 className="font-bold text-sm mb-3 uppercase text-[var(--text-muted)]">Historial de la solicitud</h3>
              <div className="space-y-3">
                {(detalle.historial || []).map((h, i) => (
                  <div key={i} className={`p-3 rounded-md border text-sm ${h.esAviso ? 'bg-[var(--status-success-bg)] border-[var(--status-success-border)] text-[var(--status-success-text)]' : 'bg-[var(--bg-surface-secondary)] border-[var(--border-color)] text-[var(--text-main)]'}`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold">{h.usuario}</span>
                      <span className="text-xs text-[var(--text-muted)]">{fmtFechaHora(h.fecha)}</span>
                    </div>
                    <span className="uppercase text-[10px] font-bold text-[var(--text-secondary)] bg-[var(--border-color)] px-1.5 py-0.5 rounded">{h.accion}</span>
                    <p className="mt-2 text-[var(--text-main)]">{h.comentario}</p>
                  </div>
                ))}
                {(!detalle.historial || detalle.historial.length === 0) && <p className="text-xs text-[var(--text-muted)]">Sin historial registrado.</p>}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
