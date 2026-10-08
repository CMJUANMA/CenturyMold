/**
 * RhSolicitudes.jsx
 */
import { useState, useEffect } from 'react';
import {
  collection, getDocs, doc, updateDoc, query, onSnapshot,
  runTransaction, serverTimestamp,
} from 'firebase/firestore';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { db } from '../../firebase';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Layers, Search, Filter, CheckCircle2, XCircle, Loader2,
  Clock, Eye, RefreshCw, Users, FileDown, CalendarDays, Undo2, Edit, AlertTriangle, X
} from 'lucide-react';
import Modal from '../../components/Modal';

// Helpers
function fmtIso(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}
function fmtFechaStr(str) {
  if (!str) return '—';
  const [yyyy, mm, dd] = str.split('-');
  if (!yyyy || !mm || !dd) return str;
  return `${dd}/${mm}/${yyyy}`;
}

const ESTATUS_MAP = {
  pendiente: { label: 'Pendiente', cls: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]   ', dot: 'bg-[var(--status-warning-text)]' },
  aprobada: { label: 'Aprobada', cls: 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]   ', dot: 'bg-[var(--status-success-bg)]0' },
  rechazada: { label: 'Rechazada', cls: 'bg-[var(--status-error-bg)] text-[var(--status-error-text)] border-[var(--status-error-border)]   ', dot: 'bg-[var(--status-error-bg)]0' },
  cancelada: { label: 'Cancelada', cls: 'bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]  dark:text-[var(--text-muted)] ', dot: 'bg-[var(--border-color)]' },
  'enviada al proveedor': { label: 'Enviada al proveedor', cls: 'bg-purple-100 text-purple-800 border-purple-200', dot: 'bg-purple-800' },
};

function BadgeEstatus({ estatus }) {
  const norm = estatus?.toLowerCase() || 'pendiente';
  const cfg = ESTATUS_MAP[norm] ?? ESTATUS_MAP.pendiente;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${cfg.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
    </span>
  );
}

const inputCls = 'rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--cm-red)]';

// Exportación

async function exportarExcelData(solicitudesExport, catalogos, toast, fileName) {
  if (solicitudesExport.length === 0) return toast.error('No hay solicitudes para exportar.');

  // 1. Fetch empleados para fallback
  let empList = [];
  try {
    const empSnap = await getDocs(collection(db, 'empleados'));
    empList = empSnap.docs.map(d => d.data());
  } catch (e) { console.error("Error al obtener empleados", e); }
  const getEmpFallback = (nomina) => empList.find(e => e.nomina === nomina) || {};

  const nombreRuta  = id => catalogos.rutas.find(r => r.id === id)?.nombre || '';
  const nombreCom   = id => catalogos.comunidades.find(c => c.id === id)?.nombre || '';
  const nombrePunto = id => catalogos.puntos.find(p => p.id === id)?.nombre || '';

  const hojasData = {};

  for (const sol of solicitudesExport) {
    const pasArr = sol.pasajeros || [];
    for (const pas of pasArr) {
      const fechaServicio = sol.fechaServicio || 'Sin fecha';
      const turnoRaw = pas.turno || sol.turno || 'Sin turno';
      let turnoName = turnoRaw;
      if (turnoRaw === '1') turnoName = 'Turno 1';
      else if (turnoRaw === '2') turnoName = 'Turno 2';
      else if (turnoRaw === '3') turnoName = 'Turno 3';
      else if (turnoRaw === 'TE') turnoName = 'Tiempo extra';
      
      const key = `${fechaServicio}|${turnoName}`;
      if (!hojasData[key]) hojasData[key] = { fechaServicio, turnoName, pasajeros: [] };
      
      let puesto = pas.puesto;
      if (!puesto) puesto = getEmpFallback(pas.nomina).puesto || '';
      
      hojasData[key].pasajeros.push({
        solicitud: sol,
        pasajero: { ...pas, puesto }
      });
    }
  }

  if (Object.keys(hojasData).length === 0) return toast.error('No hay pasajeros válidos para exportar.');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CenturyMold';
  
  const isRange = new Set(Object.values(hojasData).map(h => h.fechaServicio)).size > 1;

  for (const [key, data] of Object.entries(hojasData)) {
    const { fechaServicio, turnoName, pasajeros } = data;
    
    let sheetName = turnoName;
    if (isRange) {
      const [y, m, d] = fechaServicio.split('-');
      if (y && m && d) sheetName = `${d}-${m} ${turnoName}`;
      else sheetName = `${fechaServicio} ${turnoName}`;
    }
    sheetName = sheetName.substring(0, 31);
    
    const bloquesMap = {};
    for (const p of pasajeros) {
      const sol = p.solicitud;
      const solNombre = sol.solicitanteNombre || 'Desconocido';
      if (!bloquesMap[solNombre]) {
        bloquesMap[solNombre] = {
          solicitanteNombre: solNombre,
          fechaSolicitudMin: sol.fechaSolicitud,
          fechasSolicitud: new Set([sol.fechaSolicitud]),
          pasajeros: []
        };
      }
      if (sol.fechaSolicitud < bloquesMap[solNombre].fechaSolicitudMin) {
        bloquesMap[solNombre].fechaSolicitudMin = sol.fechaSolicitud;
      }
      bloquesMap[solNombre].fechasSolicitud.add(sol.fechaSolicitud);
      bloquesMap[solNombre].pasajeros.push(p.pasajero);
    }
    
    const bloques = Object.values(bloquesMap).sort((a, b) => {
      const aDate = a.fechaSolicitudMin || '';
      const bDate = b.fechaSolicitudMin || '';
      return aDate.localeCompare(bDate);
    });
    
    const ws = workbook.addWorksheet(sheetName, {
      pageSetup: { orientation: 'landscape', paperSize: 1, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.25, right: 0.25, top: 0.25, bottom: 0.25, header: 0.1, footer: 0.1 } }
    });
    ws.headerFooter.oddFooter = "&R&P / &N";

    ws.mergeCells('A1:C1');
    const titleCell = ws.getCell('A1');
    titleCell.value = "Formato de Solicitud de Rutas";
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2328' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    
    ws.mergeCells('A2:F2');
    const subtitleCell = ws.getCell('A2');
    
    const allFechasSol = new Set();
    bloques.forEach(b => b.fechasSolicitud.forEach(fs => allFechasSol.add(fs)));
    const fsArr = Array.from(allFechasSol);
    
    const formatIsoDate = (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    };
    const formatYMD = (ymd) => {
      const [y,m,d] = ymd.split('-');
      if (!y || !m || !d) return ymd;
      return `${d}/${m}/${y}`;
    };

    const formattedFechaServicio = formatYMD(fechaServicio);
    
    const uniqueDaysSol = new Set(fsArr.map(fs => {
      if (!fs) return '';
      const d = new Date(fs);
      return isNaN(d.getTime()) ? fs : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }).filter(Boolean));

    let isVarias = uniqueDaysSol.size > 1;
    let singleDateSolFormat = formatIsoDate(fsArr[0]);
    if (uniqueDaysSol.size === 0) singleDateSolFormat = '';

    if (isVarias) {
      subtitleCell.value = `Fecha de Solicitud: varias - Fecha de Servicio: ${formattedFechaServicio}`;
    } else {
      subtitleCell.value = `Fecha de Solicitud: ${singleDateSolFormat} - Fecha de Servicio: ${formattedFechaServicio}`;
    }
    subtitleCell.font = { italic: true, color: { argb: 'FFFFFFFF' } };
    subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2328' } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };

    ['B1','C1'].forEach(ref => {
      ws.getCell(ref).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2328' } };
    });
    ['B2','C2','D2','E2','F2'].forEach(ref => {
      ws.getCell(ref).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2328' } };
    });

    let currentRow = 4;
    
    const maxColWidths = Array(9).fill(8);
    const updateMax = (colIndex, text) => {
      if (!text) return;
      const len = text.toString().length;
      if (len > maxColWidths[colIndex]) {
        maxColWidths[colIndex] = Math.min(len, 45);
      }
    };
    
    const headers = ['PUESTO', 'NÓMINA', 'NOMBRE', 'ENTRADA', 'SALIDA', 'ALIMENTOS', 'RUTA', 'COMUNIDAD O COLONIA', 'PUNTO DE REUNION'];
    headers.forEach((h, i) => updateMax(i, h));
    
    let sheetTotalSolicitantes = 0;
    let sheetTotalPasajeros = 0;
    let sheetTotalAlimentos = 0;
    let sheetTotalSinAlimentos = 0;

    for (const bloque of bloques) {
      sheetTotalSolicitantes++;
      
      const rSol = ws.getRow(currentRow);
      rSol.getCell(1).value = "Solicitante:";
      rSol.getCell(1).font = { bold: true };
      rSol.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
      rSol.getCell(2).value = bloque.solicitanteNombre;
      rSol.getCell(2).font = { bold: true };
      ws.mergeCells(`B${currentRow}:C${currentRow}`);
      currentRow++;
      
      if (isVarias) {
        const fsBlockArr = Array.from(bloque.fechasSolicitud);
        const uniqueDaysBlock = new Set(fsBlockArr.map(fs => {
          if (!fs) return '';
          const d = new Date(fs);
          return isNaN(d.getTime()) ? fs : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        }).filter(Boolean));
        
        let blockDateDisplay = formatIsoDate(fsBlockArr[0]);
        if (uniqueDaysBlock.size > 1) blockDateDisplay = "Varias fechas";
        
        const rSolDate = ws.getRow(currentRow);
        rSolDate.getCell(1).value = "Solicitada el:";
        rSolDate.getCell(1).font = { bold: true };
        rSolDate.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
        rSolDate.getCell(2).value = blockDateDisplay;
        rSolDate.getCell(2).font = { bold: true };
        ws.mergeCells(`B${currentRow}:C${currentRow}`);
        currentRow++;
      }

      const rTurno = ws.getRow(currentRow);
      rTurno.getCell(1).value = "TURNO:";
      rTurno.getCell(1).font = { bold: true };
      rTurno.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
      let tDisplay = turnoName;
      if (tDisplay === 'Turno 1') tDisplay = '1';
      else if (tDisplay === 'Turno 2') tDisplay = '2';
      else if (tDisplay === 'Turno 3') tDisplay = '3';
      else if (tDisplay === 'Tiempo extra') tDisplay = 'TE';
      rTurno.getCell(2).value = tDisplay;
      rTurno.getCell(2).font = { bold: true };
      currentRow++;

      const rFecha = ws.getRow(currentRow);
      rFecha.getCell(1).value = "Fecha:";
      rFecha.getCell(1).font = { bold: true };
      rFecha.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
      rFecha.getCell(2).value = formattedFechaServicio;
      rFecha.getCell(2).font = { bold: true };
      currentRow++;
      
      currentRow++;

      const rHead = ws.getRow(currentRow);
      rHead.height = 22;
      headers.forEach((h, i) => {
        const cell = rHead.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8102E' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });
      currentRow++;
      
      const pasSorted = bloque.pasajeros.sort((a, b) => {
        const rA = nombreRuta(a.rutaId); const rB = nombreRuta(b.rutaId);
        if (rA !== rB) return rA.localeCompare(rB);
        const cA = nombreCom(a.comunidadId); const cB = nombreCom(b.comunidadId);
        if (cA !== cB) return cA.localeCompare(cB);
        const pA = nombrePunto(a.puntoReunionId); const pB = nombrePunto(b.puntoReunionId);
        if (pA !== pB) return pA.localeCompare(pB);
        const nA = a.nombre || ''; const nB = b.nombre || '';
        return nA.localeCompare(nB);
      });
      
      let conAlimentos = 0;
      let sinAlimentos = 0;
      let filaColorToggle = false;
      
      for (const p of pasSorted) {
        sheetTotalPasajeros++;
        const tieneAli = !!p.alimentos;
        if (tieneAli) { conAlimentos++; sheetTotalAlimentos++; }
        else { sinAlimentos++; sheetTotalSinAlimentos++; }
        
        const rPas = ws.getRow(currentRow);
        const rData = [
          p.puesto || '', p.nomina || '', p.nombre || '', p.horaEntrada || '', p.horaSalida || '',
          tieneAli ? 'SI' : 'NO', nombreRuta(p.rutaId), nombreCom(p.comunidadId), nombrePunto(p.puntoReunionId)
        ];
        
        rData.forEach((val, i) => {
          updateMax(i, val);
          const cell = rPas.getCell(i + 1);
          cell.value = val;
          cell.alignment = { vertical: 'middle' };
          cell.border = { top: {style:'thin', color: {argb:'FF9CA3AF'}}, left: {style:'thin', color: {argb:'FF9CA3AF'}}, bottom: {style:'thin', color: {argb:'FF9CA3AF'}}, right: {style:'thin', color: {argb:'FF9CA3AF'}} };
          if (filaColorToggle) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
          if ([1, 3, 4, 5].includes(i)) cell.alignment = { vertical: 'middle', horizontal: 'center' };
          if (i === 5 && tieneAli) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        });
        
        filaColorToggle = !filaColorToggle;
        currentRow++;
      }
      
      const rCount = ws.getRow(currentRow);
      rCount.getCell(1).value = `Pasajeros: ${pasSorted.length}`;
      rCount.getCell(1).font = { bold: true };
      rCount.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
      ws.mergeCells(`A${currentRow}:C${currentRow}`);
      
      rCount.getCell(4).value = `Con alimentos: ${conAlimentos}`;
      rCount.getCell(4).font = { bold: true };
      rCount.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
      ws.mergeCells(`D${currentRow}:F${currentRow}`);
      
      rCount.getCell(7).value = `Sin alimentos: ${sinAlimentos}`;
      rCount.getCell(7).font = { bold: true };
      rCount.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
      ws.mergeCells(`G${currentRow}:I${currentRow}`);
      
      [1, 4, 7].forEach(c => {
         rCount.getCell(c).border = { top: {style:'thin', color: {argb:'FF000000'}}, left: {style:'thin', color: {argb:'FF000000'}}, bottom: {style:'thin', color: {argb:'FF000000'}}, right: {style:'thin', color: {argb:'FF000000'}} };
      });

      currentRow += 2;
    }
    
    const rTot = ws.getRow(currentRow);
    rTot.getCell(1).value = `TOTAL DEL TURNO`;
    rTot.getCell(1).font = { bold: true };
    rTot.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    ws.mergeCells(`A${currentRow}:C${currentRow}`);
    
    const rTot2 = ws.getRow(currentRow + 1);
    rTot2.getCell(1).value = `Solicitantes: ${sheetTotalSolicitantes}`;
    rTot2.getCell(1).font = { bold: true };
    rTot2.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    
    rTot2.getCell(2).value = `Pasajeros: ${sheetTotalPasajeros}`;
    rTot2.getCell(2).font = { bold: true };
    rTot2.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    
    rTot2.getCell(4).value = `Con alimentos: ${sheetTotalAlimentos}`;
    rTot2.getCell(4).font = { bold: true };
    rTot2.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    ws.mergeCells(`D${currentRow+1}:F${currentRow+1}`);
    
    rTot2.getCell(7).value = `Sin alimentos: ${sheetTotalSinAlimentos}`;
    rTot2.getCell(7).font = { bold: true };
    rTot2.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    ws.mergeCells(`G${currentRow+1}:I${currentRow+1}`);
    
    [1].forEach(c => rTot.getCell(c).border = {top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}});
    [1, 2, 4, 7].forEach(c => rTot2.getCell(c).border = {top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}});

    for (let i = 0; i < 9; i++) {
      ws.getColumn(i + 1).width = maxColWidths[i] + 3;
    }
    
    let maxSolNameLen = 0;
    bloques.forEach(b => { if(b.solicitanteNombre.length > maxSolNameLen) maxSolNameLen = b.solicitanteNombre.length; });
    const colBWidth = maxColWidths[1] + 3;
    const colCWidth = maxColWidths[2] + 3;
    if (colBWidth + colCWidth < maxSolNameLen + 3) {
      ws.getColumn(3).width = (maxSolNameLen + 3) - colBWidth;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
  
  let tot = 0;
  for (const s of solicitudesExport) tot += (s.pasajeros || []).length;
  toast.success(`Archivo "${fileName}" generado con ${tot} pasajeros.`);
}

function getLocalDates() {
  const d = new Date();
  const H = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  d.setDate(d.getDate() + 1);
  const M = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { hoy: H, manana: M };
}


export default function RhSolicitudes() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [exportando, setExportando] = useState(false);

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('');
  const [fechaConsulta, setFechaConsulta] = useState(''); // Por defecto sin filtro

  const [detalle, setDetalle] = useState(null);
  const [procesando, setProcesando] = useState(null);
  
  // Modals de aprobación/rechazo
  const [modalAprobar, setModalAprobar] = useState(null);
  const [modalRechazar, setModalRechazar] = useState(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  const [catalogos, setCatalogos] = useState({ rutas: [], comunidades: [], puntos: [] });

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

  const solsParaExportar = solicitudes.filter(s => {
    if (!expAprobadas && s.estatus === 'aprobada') return false;
    if (!expPendientes && s.estatus === 'pendiente') return false;
    if (s.estatus !== 'aprobada' && s.estatus !== 'pendiente') return false;
    if (!s.fechaServicio) return false;
    if (expRangoDesde && s.fechaServicio < expRangoDesde) return false;
    if (expRangoHasta && s.fechaServicio > expRangoHasta) return false;
    return true;
  });

  const pasExportCount = solsParaExportar.reduce((acc, s) => acc + (s.totalPasajeros || 0), 0);
  const rutasExportSet = new Set();
  solsParaExportar.forEach(s => {
    (s.pasajeros || []).forEach(p => { if (p.rutaId) rutasExportSet.add(p.rutaId); });
  });

  const btnExportarModalClick = () => {
    const suffix = (expEsRango && expTipoFecha === 'elegir') ? `${expDesde}_a_${expHasta}` : expRangoDesde;
    const fileName = `Transporte_${suffix}.xlsx`;
    exportarExcelData(solsParaExportar, catalogos, toast, fileName);
    setModalExportar(false);
  };


  useEffect(() => {
    async function loadCatalogos() {
      try {
        const [r, c, p] = await Promise.all([ getDocs(collection(db, 'rutas')), getDocs(collection(db, 'comunidades')), getDocs(collection(db, 'puntosReunion')) ]);
        setCatalogos({ rutas: r.docs.map(d=>({id:d.id,...d.data()})), comunidades: c.docs.map(d=>({id:d.id,...d.data()})), puntos: p.docs.map(d=>({id:d.id,...d.data()})) });
      } catch (err) { console.error(err); }
    }
    loadCatalogos();

    // Tiempo Real SIN filtros de 'creadoPor'
    const unsub = onSnapshot(collection(db, 'solicitudes'), async (snap) => {
      try {
        setErrorMsg('');
        const sols = snap.docs.map(d => {
          const data = d.data();
          return { id: d.id, ...data, estatus: data.estatus?.toLowerCase() || 'pendiente' };
        });

        // Ordenar en cliente
        sols.sort((a, b) => {
          const fsA = a.fechaServicio || ''; const fsB = b.fechaServicio || '';
          if (fsA !== fsB) return fsB.localeCompare(fsA); // Descendente por fecha servicio
          const fA = a.fechaSolicitud || ''; const fB = b.fechaSolicitud || '';
          return fB.localeCompare(fA);
        });

        // Enriquecer pasajeros
        const conPas = await Promise.all(sols.map(async sol => {
          try {
            const psnap = await getDocs(collection(db, `solicitudes/${sol.id}/pasajeros`));
            const pas = psnap.docs.map(d => d.data());
            const t = [...new Set(pas.map(x=>x.turno).filter(Boolean))];
            const p = [...new Set(pas.map(x=>x.puesto).filter(Boolean))];
            return {
              ...sol,
              pasajeros: pas,
              _turnosStr: t.length > 0 ? t.join(', ') : (sol.turno||'—'),
              _puestosStr: p.length > 0 ? p.join(', ') : (sol.puesto||'—')
            };
          } catch {
            return { ...sol, pasajeros: [], _turnosStr: sol.turno||'—', _puestosStr: sol.puesto||'—' };
          }
        }));
        
        setSolicitudes(conPas);
        setCargando(false);
      } catch (err) {
        console.error('Error onSnapshot:', err);
        setErrorMsg(err.message);
        setCargando(false);
      }
    }, (err) => {
      console.error('Snapshot Error:', err);
      setErrorMsg('Error de permisos o red: ' + err.message);
      setCargando(false);
    });

    return () => unsub();
  }, []);

  const handleTransaccion = async (sol, nuevoEstatus, motivo = '') => {
    setProcesando(sol.id);
    try {
      const ref = doc(db, 'solicitudes', sol.id);
      await runTransaction(db, async (t) => {
        const docSnap = await t.get(ref);
        if (!docSnap.exists()) throw new Error('No existe la solicitud.');
        const data = docSnap.data();
        
        if (nuevoEstatus !== 'pendiente' && data.estatus !== 'pendiente') {
          throw new Error(`Esta solicitud ya fue ${data.estatus} por ${data.revisadoPorNombre || 'alguien'}.`);
        }

        const updateData = {
          estatus: nuevoEstatus,
          vistoPorSolicitante: false,
        };
        
        if (nuevoEstatus !== 'pendiente') {
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
      if (detalle?.sol.id === sol.id) setDetalle(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcesando(null);
      setModalAprobar(null);
      setModalRechazar(null);
      setMotivoRechazo('');
    }
  };

  const confirmRevert = (sol) => {
    if (confirm('¿Estás seguro de regresar esta solicitud a Pendiente?')) {
      handleTransaccion(sol, 'pendiente');
    }
  };

  const filtradas = solicitudes.filter(s => {
    const q = busqueda.toLowerCase();
    const okBusq = !q || (s.solicitanteNombre||'').toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
    const okFecha = !fechaConsulta || s.fechaServicio === fechaConsulta;
    
    // Si no se está filtrando explícitamente por 'cancelada', oculta las canceladas.
    let okEst = false;
    if (filtroEstatus === 'cancelada') {
      okEst = s.estatus === 'cancelada';
    } else if (filtroEstatus === '') {
      okEst = s.estatus !== 'cancelada';
    } else {
      okEst = s.estatus === filtroEstatus;
    }
    
    return okBusq && okEst && okFecha;
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
        <input type="date" value={fechaConsulta} onChange={e=>setFechaConsulta(e.target.value)} className={inputCls} title="Fecha Servicio" />
        <select value={filtroEstatus} onChange={e=>setFiltroEstatus(e.target.value)} className={inputCls}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="aprobada">Aprobadas</option>
          <option value="rechazada">Rechazadas</option>
          <option value="cancelada">Canceladas</option>
        </select>
        <input type="search" value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar..." className={inputCls} />
        <div className="ml-auto flex items-center gap-2">
          <span className="font-semibold text-[var(--text-main)]">{filtradas.length} solicitudes</span>
          <button type="button" onClick={()=>setModalExportar(true)} className="inline-flex items-center gap-1.5 rounded-md bg-[var(--status-success-text)] px-3 py-1.5 text-white text-xs hover:bg-[var(--status-success-text)] hover:opacity-90 transition-opacity disabled:opacity-50">
            <FileDown className="h-3.5 w-3.5"/> Exportar
          </button>
        </div>
      </div>

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
                <td className="px-4 py-3 font-medium">{sol.solicitanteNombre}</td>
                <td className="px-4 py-3 text-[var(--text-secondary)] truncate max-w-[120px]" title={sol._puestosStr}>{sol._puestosStr} <br/><span className="text-[10px] font-bold text-[var(--text-main)]">{sol._turnosStr}</span></td>
                <td className="px-4 py-3 font-bold">{fmtFechaStr(sol.fechaServicio)}</td>
                <td className="px-4 py-3 text-center"><span className="rounded-full bg-[var(--bg-surface-secondary)] px-2 py-0.5 border">{sol.totalPasajeros}</span></td>
                <td className="px-4 py-3"><BadgeEstatus estatus={sol.estatus} />
                  {sol.modificada && <span className="ml-2 inline-flex items-center gap-1 text-[9px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full uppercase"><AlertTriangle className="h-3 w-3"/> Modificada</span>}
                  {sol.historial?.some(h=>h.esAviso) && <span className="ml-2 inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full uppercase" title="El solicitante envió un mensaje">Aviso del solicitante</span>}
                  {sol.estatus === 'cancelada' && sol.historial?.some(h=>h.accion === 'aprobada') && <span className="ml-2 inline-flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full uppercase" title="Fue cancelada después de ser aprobada">Antes aprobada</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <button onClick={()=>setDetalle(sol)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)]" title="Ver Detalle"><Eye className="h-4 w-4"/></button>
                    <button onClick={()=>navigate(`/solicitud/editar/${sol.id}`)} className="p-1.5 text-blue-600 hover:text-blue-800" title="Editar (RH)"><Edit className="h-4 w-4"/></button>
                    {sol.estatus === 'pendiente' && (
                      <>
                        <button onClick={()=>setModalRechazar(sol)} className="p-1.5 text-[var(--status-error-text)] bg-[var(--status-error-bg)] hover:bg-[var(--status-error-bg)] rounded-md" title="Rechazar"><XCircle className="h-4 w-4"/></button>
                        <button onClick={()=>setModalAprobar(sol)} className="p-1.5 text-[var(--status-success-text)] bg-[var(--status-success-bg)] hover:bg-[var(--status-success-bg)] rounded-md" title="Aprobar"><CheckCircle2 className="h-4 w-4"/></button>
                      </>
                    )}
                    {['aprobada','rechazada','enviada al proveedor'].includes(sol.estatus) && (
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
            <h3 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2"><FileDown className="h-5 w-5"/> Exportar solicitudes a Excel</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Descarga el formato maestro. No depende de los filtros de la tabla.</p>
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
              {solsParaExportar.length === 0 ? (
                <div className="text-[var(--status-error-text)] font-semibold flex items-center gap-1.5"><XCircle className="h-4 w-4"/> No hay solicitudes aprobadas para esta fecha.</div>
              ) : (
                <ul className="space-y-1">
                  <li className="font-semibold">{solsParaExportar.length} solicitudes encontradas</li>
                  <li>{pasExportCount} pasajeros en total</li>
                  <li>{rutasExportSet.size} rutas distintas</li>
                  {expPendientes && solsParaExportar.some(s=>s.estatus==='pendiente') && (
                    <li className="text-[var(--status-warning-text)] text-xs font-semibold mt-1">Atención: Hay pendientes incluidas.</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border-color)] mt-4">
            <button onClick={()=>setModalExportar(false)} className="px-4 py-2 text-xs font-semibold border border-[var(--border-color)] text-[var(--text-main)] rounded-md hover:bg-[var(--bg-surface-hover)] transition-colors">Cancelar</button>
            <button onClick={btnExportarModalClick} disabled={solsParaExportar.length === 0} className="px-4 py-2 text-xs font-semibold bg-[var(--status-success-text)] text-white rounded-md flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity">
              <FileDown className="h-3.5 w-3.5"/> Descargar Excel
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
              <button onClick={()=>handleTransaccion(modalAprobar, 'aprobada')} disabled={!!procesando} className="px-4 py-2 text-xs font-semibold bg-[var(--status-success-text)] text-white rounded-md flex items-center gap-1 hover:opacity-90">
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
              <button onClick={()=>handleTransaccion(modalRechazar, 'rechazada', motivoRechazo)} disabled={!!procesando || motivoRechazo.trim().length<5} className="px-4 py-2 text-xs font-semibold bg-[var(--status-error-text)] hover:opacity-90 text-white rounded-md disabled:opacity-50 flex items-center gap-1">
                {procesando === modalRechazar.id ? <Loader2 className="h-3 w-3 animate-spin"/> : <XCircle className="h-3 w-3"/>} Confirmar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!detalle} onClose={() => setDetalle(null)} title="" maxWidth="max-w-5xl" className="!p-0">
        {detalle && (
          <div className="-m-5">
            <div className="border border-[var(--border-color)] mx-5 my-5">
              {/* Encabezado Visual Excel */}
              <div className="bg-[var(--cm-dark)] text-white p-3 border-b border-[var(--border-color)]">
                <h2 className="font-bold text-lg">Formato de Solicitud de Rutas</h2>
                <p className="italic text-sm text-gray-300">Fecha de Solicitud: {fmtIso(detalle.fechaSolicitud)} - Fecha de Servicio: {fmtFechaStr(detalle.fechaServicio)}</p>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-[var(--bg-surface-secondary)] border-b border-[var(--border-color)]">
                <div><strong className="text-[var(--text-muted)] uppercase text-xs block">Solicitante</strong><span className="font-bold text-[var(--text-main)]">{detalle.solicitanteNombre}</span></div>
                <div><strong className="text-[var(--text-muted)] uppercase text-xs block">Turno</strong><span className="font-bold text-[var(--text-main)]">{detalle._turnosStr}</span></div>
                <div><strong className="text-[var(--text-muted)] uppercase text-xs block">Área</strong><span className="font-bold text-[var(--text-main)]">{detalle._puestosStr}</span></div>
                <div><strong className="text-[var(--text-muted)] uppercase text-xs block">Estatus</strong><BadgeEstatus estatus={detalle.estatus}/></div>
              </div>
              
              {/* Tabla de Beneficiarios */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--cm-red)] text-white">
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
                    {(detalle.pasajeros || []).map((p, idx) => {
                      const bgCls = idx % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-[var(--bg-surface-secondary)]';
                      const nameR = catalogos.rutas.find(r => r.id === p.rutaId)?.nombre || '';
                      const nameC = catalogos.comunidades.find(c => c.id === p.comunidadId)?.nombre || '';
                      const nameP = catalogos.puntos.find(pt => pt.id === p.puntoReunionId)?.nombre || '';
                      return (
                        <tr key={p.nomina} className={`${bgCls} text-[var(--text-main)]`}>
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
                <p><strong>Con alimentos:</strong> {(detalle.pasajeros||[]).filter(p=>p.alimentos).length}</p>
                <p><strong>Sin alimentos:</strong> {(detalle.pasajeros||[]).filter(p=>!p.alimentos).length}</p>
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
                      <span className="text-xs text-[var(--text-muted)]">{new Date(h.fecha).toLocaleString()}</span>
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
