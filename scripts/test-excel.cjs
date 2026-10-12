const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function testExport() {
  const catalogos = {
    rutas: [{ id: 'r1', nombre: 'Ruta Sur' }, { id: 'r2', nombre: 'Ruta Norte' }],
    comunidades: [{ id: 'c1', nombre: 'Comunidad Centro' }, { id: 'c2', nombre: 'Colonia de los Trabajadores Larga' }],
    puntos: [{ id: 'p1', nombre: 'Punto A' }, { id: 'p2', nombre: 'Punto B (Oxxo Central)' }]
  };

  const solicitudesExport = [
    {
      id: 's1',
      fechaServicio: '2026-10-10',
      fechaSolicitud: '2026-10-09T10:00:00Z',
      solicitanteNombre: 'Juan', // Corto
      pasajeros: [
        { nomina: '123', nombre: 'Ana', area: 'Produccion', turno: '1', horaEntrada: '7:00AM', horaSalida: '4:00PM', alimentos: true, rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1' },
        { nomina: '124', nombre: 'Luis', area: 'Almacen', turno: '1', horaEntrada: '7:00AM', horaSalida: '4:00PM', alimentos: false, rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1' }
      ]
    },
    {
      id: 's2',
      fechaServicio: '2026-10-10',
      fechaSolicitud: '2026-10-09T11:00:00Z',
      solicitanteNombre: 'Maria de los Angeles Martinez Hernandez', // Largo
      pasajeros: [
        { nomina: '999', nombre: 'Maximiliano Aurelio Zapata de la Cruz y Sanchez', area: 'Calidad', turno: '1', horaEntrada: '7:00AM', horaSalida: '4:00PM', alimentos: true, rutaId: 'r2', comunidadId: 'c2', puntoReunionId: 'p2' }
      ]
    }
  ];

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
      
      let area = pas.area || sol.area || '';
      
      hojasData[key].pasajeros.push({
        solicitud: sol,
        pasajero: { ...pas, area }
      });
    }
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CenturyMold Test';

  for (const data of Object.values(hojasData)) {
    const { fechaServicio, turnoName, pasajeros } = data;
    let sheetName = turnoName;
    
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
    
    const bloques = Object.values(bloquesMap).sort((a, b) => a.fechaSolicitudMin.localeCompare(b.fechaSolicitudMin));
    
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
    
    const formattedFechaServicio = fechaServicio.split('-').reverse().join('/');
    subtitleCell.value = `Fecha de Solicitud: varias - Fecha de Servicio: ${formattedFechaServicio}`;
    subtitleCell.font = { italic: true, color: { argb: 'FFFFFFFF' } };
    subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2328' } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };

    ['B1','C1'].forEach(ref => ws.getCell(ref).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2328' } });
    ['B2','C2','D2','E2','F2'].forEach(ref => ws.getCell(ref).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2328' } });

    let currentRow = 4;
    const maxColWidths = Array(9).fill(8);
    const updateMax = (colIndex, text) => {
      if (!text) return;
      const len = text.toString().length;
      if (len > maxColWidths[colIndex]) maxColWidths[colIndex] = Math.min(len, 45);
    };
    
    const headers = ['AREA', 'NÓMINA', 'NOMBRE', 'ENTRADA', 'SALIDA', 'ALIMENTOS', 'RUTA', 'COMUNIDAD O COLONIA', 'PUNTO DE REUNION'];
    headers.forEach((h, i) => updateMax(i, h));
    
    let sheetTotalSolicitantes = 0, sheetTotalPasajeros = 0, sheetTotalAlimentos = 0, sheetTotalSinAlimentos = 0;

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

      const rTurno = ws.getRow(currentRow);
      rTurno.getCell(1).value = "TURNO:";
      rTurno.getCell(1).font = { bold: true };
      rTurno.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
      rTurno.getCell(2).value = '1';
      rTurno.getCell(2).font = { bold: true };
      currentRow++;

      const rFecha = ws.getRow(currentRow);
      rFecha.getCell(1).value = "Fecha:";
      rFecha.getCell(1).font = { bold: true };
      rFecha.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
      rFecha.getCell(2).value = formattedFechaServicio;
      rFecha.getCell(2).font = { bold: true };
      currentRow++;
      
      currentRow++; // blank

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
      
      const pasSorted = bloque.pasajeros;
      
      let conAlimentos = 0, sinAlimentos = 0, filaColorToggle = false;
      for (const p of pasSorted) {
        sheetTotalPasajeros++;
        const tieneAli = !!p.alimentos;
        if (tieneAli) { conAlimentos++; sheetTotalAlimentos++; } else { sinAlimentos++; sheetTotalSinAlimentos++; }
        
        const rPas = ws.getRow(currentRow);
        const rData = [p.area, p.nomina, p.nombre, p.horaEntrada, p.horaSalida, tieneAli ? 'SI' : 'NO', nombreRuta(p.rutaId), nombreCom(p.comunidadId), nombrePunto(p.puntoReunionId)];
        
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
      
      [1, 4, 7].forEach(c => rCount.getCell(c).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} });
      currentRow += 2;
    }
    
    const rTot = ws.getRow(currentRow);
    rTot.getCell(1).value = `TOTAL DEL TURNO`;
    rTot.getCell(1).font = { bold: true };
    rTot.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    ws.mergeCells(`A${currentRow}:C${currentRow}`);
    
    const rTot2 = ws.getRow(currentRow + 1);
    rTot2.getCell(1).value = `Solicitantes: ${sheetTotalSolicitantes}`;
    rTot2.getCell(2).value = `Pasajeros: ${sheetTotalPasajeros}`;
    rTot2.getCell(4).value = `Con alimentos: ${sheetTotalAlimentos}`;
    rTot2.getCell(7).value = `Sin alimentos: ${sheetTotalSinAlimentos}`;
    [1,2,4,7].forEach(c => {
      rTot2.getCell(c).font = { bold: true };
      rTot2.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    });
    ws.mergeCells(`D${currentRow+1}:F${currentRow+1}`);
    ws.mergeCells(`G${currentRow+1}:I${currentRow+1}`);
    
    [1].forEach(c => rTot.getCell(c).border = {top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}});
    [1, 2, 4, 7].forEach(c => rTot2.getCell(c).border = {top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}});

    for (let i = 0; i < 9; i++) ws.getColumn(i + 1).width = maxColWidths[i] + 3;
    
    let maxSolNameLen = 0;
    bloques.forEach(b => { if(b.solicitanteNombre.length > maxSolNameLen) maxSolNameLen = b.solicitanteNombre.length; });
    const colBWidth = maxColWidths[1] + 3;
    const colCWidth = maxColWidths[2] + 3;
    if (colBWidth + colCWidth < maxSolNameLen + 3) ws.getColumn(3).width = (maxSolNameLen + 3) - colBWidth;
  }

  const salida = path.join(__dirname, 'salida');
  fs.mkdirSync(salida, { recursive: true });
  const archivo = path.join(salida, 'test-solicitudes.xlsx');
  await workbook.xlsx.writeFile(archivo);
  console.log(`${archivo} generado correctamente`);
}

testExport().catch(console.error);
