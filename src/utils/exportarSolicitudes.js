/**
 * exportarSolicitudes.js — Genera el Excel maestro de transporte (una hoja por fecha de servicio y turno)
 * a partir de solicitudes que ya traen sus pasajeros. exceljs se descarga solo al exportar.
 */
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * @param {Array}  solicitudesExport  solicitudes con su arreglo `pasajeros`
 * @param {{rutas: Array, comunidades: Array, puntos: Array}} catalogos  para resolver nombres
 * @param {{success: Function, error: Function}} toast
 * @param {string} fileName
 */
export async function exportarSolicitudes(solicitudesExport, catalogos, toast, fileName) {
  if (solicitudesExport.length === 0) return toast.error('No hay solicitudes para exportar.');

  // exceljs pesa mucho: se descarga solo cuando se exporta
  const ExcelJS = (await import('exceljs')).default;

  // 1. Empleados para completar el puesto: solo se leen si algún pasajero no lo trae
  let empList = [];
  const faltaPuesto = solicitudesExport.some(sol => (sol.pasajeros || []).some(p => !p.puesto));
  if (faltaPuesto) {
    try {
      const empSnap = await getDocs(collection(db, 'empleados'));
      empList = empSnap.docs.map(d => d.data());
    } catch (e) { console.error("Error al obtener empleados", e); }
  }
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

  for (const data of Object.values(hojasData)) {
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

