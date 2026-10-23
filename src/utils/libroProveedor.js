/**
 * libroProveedor.js — Construye el libro de Excel maestro de transporte para el proveedor ("Formato de Solicitud de Rutas"):
 * una hoja por fecha de servicio y turno, bloques por solicitante con subtotales y TOTAL DEL TURNO.
 * Sin dependencias del navegador ni de Firebase (se prueba en Node); exportarSolicitudes.js lo descarga.
 *
 * Columnas: AREA · PUESTO · NÓMINA · NOMBRE · ENTRADA · SALIDA · ALIMENTOS · RUTA · COMUNIDAD O COLONIA · PUNTO DE REUNION · TELÉFONO
 *   TELÉFONO: el del empleado en el padrón (`telefonoDe(nómina)`, para que el transporte pueda llamar); vacío si no tiene.
 *   AREA: área del pasajero (pasajero.areaId del padrón); en solicitudes anteriores sin área, la de la solicitud; si no hay, vacía.
 * ENTRADA y SALIDA salen en 24 horas con dos dígitos ("07:00", "16:00"); se cambia con FORMATO_HORA_PROVEEDOR (horas.js).
 * Tiempo extra: sus pasajeros ya traen el turno que corresponde a su hora de ENTRADA (pasajero.turno), así que caen en la hoja de ese
 * turno; un pasajero que viene y se va otro día (cruza la medianoche) sale en DOS hojas: la llegada el día del servicio (SALIDA «NO REQUIERE») y la salida
 * el día siguiente (ENTRADA «YA EN PLANTA»), en el turno que termina a esa hora. Su bloque dice "Solicitante: [solicitante original] · Tiempo extra TE-AAAA-NNNN" (no el nombre de RH).
 */
import { SIN_SALIDA, YA_EN_PLANTA, fechasDePasajero, solicitanteDeTransporte } from './tiempoExtra.js';
import { aFechaIso, comparar, texto } from './orden.js';
import { formatoTelefono } from './telefono.js';
import { horaParaProveedor } from './horas.js';

export const ENCABEZADOS_PROVEEDOR = ['AREA', 'PUESTO', 'NÓMINA', 'NOMBRE', 'ENTRADA', 'SALIDA', 'ALIMENTOS', 'RUTA', 'COMUNIDAD O COLONIA', 'PUNTO DE REUNION', 'TELÉFONO'];
const COLUMNAS = ENCABEZADOS_PROVEEDOR.length;

const NOMBRE_TURNO = { 1: 'Turno 1', 2: 'Turno 2', 3: 'Turno 3', TE: 'Tiempo extra' };
const CODIGO_TURNO = { 'Turno 1': '1', 'Turno 2': '2', 'Turno 3': '3', 'Tiempo extra': 'TE' };

const relleno = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const bordeFino = (argb) => ({ top: { style: 'thin', color: { argb } }, left: { style: 'thin', color: { argb } }, bottom: { style: 'thin', color: { argb } }, right: { style: 'thin', color: { argb } } });

const formatIsoDate = (valor) => {
  const iso = aFechaIso(valor) || texto(valor);
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};
const formatYMD = (valor) => {
  const ymd = texto(valor);
  const [y, m, d] = ymd.split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
};
const diaLocal = (valor) => {
  const fs = aFechaIso(valor) || texto(valor);
  if (!fs) return '';
  const d = new Date(fs);
  return isNaN(d.getTime()) ? fs : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/**
 * Agrupa los pasajeros por hoja (fecha de servicio + turno).
 * @returns {Record<string, {fechaServicio, turnoName, pasajeros: {solicitud, pasajero}[]}>}
 */
export function agruparHojas(solicitudes, { puestoDe = () => '', areaDe = () => '', rango = null } = {}) {
  const hojasData = {};
  for (const sol of solicitudes) {
    for (const pas of sol.pasajeros || []) {
      const servicio = texto(sol.fechaServicio) || 'Sin fecha';
      const viajes = servicio === 'Sin fecha' ? [{ fecha: servicio, viaje: pas.sentido, turno: pas.turno }] : fechasDePasajero(pas, servicio);
      for (const v of viajes) {
        // `rango` { desde, hasta }: solo las hojas de esos días (una solicitud del día anterior puede traer salidas de hoy)
        if (rango && (v.fecha < rango.desde || v.fecha > rango.hasta)) continue;
        const turnoRaw = v.turno || pas.turno || sol.turno || 'Sin turno';
        const turnoName = NOMBRE_TURNO[turnoRaw] ?? texto(turnoRaw);
        const key = `${v.fecha}|${turnoName}`;
        // Cada viaje lleva solo lo suyo: la llegada no pide salida y la salida no pide entrada
        const horas = viajes.length < 2 ? {} : v.viaje === 'llegada' ? { horaSalida: SIN_SALIDA } : { horaEntrada: YA_EN_PLANTA };
        if (!hojasData[key]) hojasData[key] = { fechaServicio: v.fecha, turnoName, pasajeros: [] };
        hojasData[key].pasajeros.push({ solicitud: sol, pasajero: { ...pas, ...horas, puesto: pas.puesto || puestoDe(pas.nomina), area: areaDe(pas, sol) } });
      }
    }
  }
  return hojasData;
}

/**
 * @param {object} p
 * @param {object} p.ExcelJS            la librería (se carga con import() dinámico en el navegador)
 * @param {Array}  p.solicitudes        solicitudes con su arreglo `pasajeros`
 * @param {{rutas: Array, comunidades: Array, puntos: Array, areas?: Array}} p.catalogos  para resolver nombres
 * @param {(nomina: string) => object} [p.empleadoDe]  padrón, para completar el puesto de pasajeros que no lo traen
 * @param {(nomina: string) => string} [p.telefonoDe]  teléfono del empleado (10 dígitos) o ''
 * @param {{desde: string, hasta: string}} [p.rango]  solo las hojas de esos días (AAAA-MM-DD)
 * @returns el libro, o null si no hay pasajeros
 */
export function construirLibroProveedor({ ExcelJS, solicitudes, catalogos, empleadoDe = () => ({}), telefonoDe = () => '', rango = null }) {
  const nombreDe = (lista, id) => texto((lista ?? []).find(x => x.id === id)?.nombre);
  const nombreRuta = id => nombreDe(catalogos.rutas, id);
  const nombreCom = id => nombreDe(catalogos.comunidades, id);
  const nombrePunto = id => nombreDe(catalogos.puntos, id);
  const nombreArea = id => nombreDe(catalogos.areas, id);

  const hojasData = agruparHojas(solicitudes, {
    puestoDe: (nomina) => texto(empleadoDe(nomina).puesto),
    areaDe: (pas, sol) => nombreArea(pas.areaId || sol.areaId) || texto(pas.areaNombre), rango,
  });
  if (Object.keys(hojasData).length === 0) return null;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CenturyMold';

  const isRange = new Set(Object.values(hojasData).map(h => h.fechaServicio)).size > 1;

  for (const data of Object.values(hojasData)) {
    const { fechaServicio, turnoName, pasajeros } = data;

    let sheetName = turnoName;
    if (isRange) {
      const [y, m, d] = texto(fechaServicio).split('-');
      if (y && m && d) sheetName = `${d}-${m} ${turnoName}`;
      else sheetName = `${fechaServicio} ${turnoName}`;
    }
    sheetName = texto(sheetName).replace(/[\\/?*[\]:]/g, '-').substring(0, 31) || 'Hoja';

    const bloquesMap = {};
    for (const p of pasajeros) {
      const sol = p.solicitud;
      const solNombre = texto(solicitanteDeTransporte(sol)) || 'Desconocido';
      // fechaSolicitud es un Timestamp en las solicitudes nuevas y un texto ISO en las viejas: se compara siempre como texto ISO
      const fechaSol = aFechaIso(sol.fechaSolicitud);
      if (!bloquesMap[solNombre]) {
        bloquesMap[solNombre] = {
          solicitanteNombre: solNombre,
          fechaSolicitudMin: fechaSol,
          fechasSolicitud: new Set([fechaSol]),
          pasajeros: [],
        };
      }
      if (fechaSol && (!bloquesMap[solNombre].fechaSolicitudMin || fechaSol < bloquesMap[solNombre].fechaSolicitudMin)) {
        bloquesMap[solNombre].fechaSolicitudMin = fechaSol;
      }
      bloquesMap[solNombre].fechasSolicitud.add(fechaSol);
      bloquesMap[solNombre].pasajeros.push(p.pasajero);
    }

    const bloques = Object.values(bloquesMap).sort((a, b) => comparar(a.fechaSolicitudMin, b.fechaSolicitudMin) || comparar(a.solicitanteNombre, b.solicitanteNombre));

    const ws = workbook.addWorksheet(sheetName, {
      pageSetup: { orientation: 'landscape', paperSize: 1, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.25, right: 0.25, top: 0.25, bottom: 0.25, header: 0.1, footer: 0.1 } },
    });
    ws.headerFooter.oddFooter = '&R&P / &N';

    ws.mergeCells('A1:C1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'Formato de Solicitud de Rutas';
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = relleno('FF1F2328');
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

    ws.mergeCells('A2:F2');
    const subtitleCell = ws.getCell('A2');

    const allFechasSol = new Set();
    bloques.forEach(b => b.fechasSolicitud.forEach(fs => allFechasSol.add(fs)));
    const fsArr = Array.from(allFechasSol);

    const formattedFechaServicio = formatYMD(fechaServicio);

    const uniqueDaysSol = new Set(fsArr.map(diaLocal).filter(Boolean));

    const isVarias = uniqueDaysSol.size > 1;
    let singleDateSolFormat = formatIsoDate(fsArr.find(Boolean) ?? '');
    if (uniqueDaysSol.size === 0) singleDateSolFormat = '';

    if (isVarias) {
      subtitleCell.value = `Fecha de Solicitud: varias - Fecha de Servicio: ${formattedFechaServicio}`;
    } else {
      subtitleCell.value = `Fecha de Solicitud: ${singleDateSolFormat} - Fecha de Servicio: ${formattedFechaServicio}`;
    }
    subtitleCell.font = { italic: true, color: { argb: 'FFFFFFFF' } };
    subtitleCell.fill = relleno('FF1F2328');
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };

    ['B1', 'C1'].forEach(ref => { ws.getCell(ref).fill = relleno('FF1F2328'); });
    ['B2', 'C2', 'D2', 'E2', 'F2'].forEach(ref => { ws.getCell(ref).fill = relleno('FF1F2328'); });

    let currentRow = 4;

    const maxColWidths = Array(COLUMNAS).fill(8);
    const updateMax = (colIndex, text) => {
      if (!text) return;
      const len = text.toString().length;
      if (len > maxColWidths[colIndex]) {
        maxColWidths[colIndex] = Math.min(len, 45);
      }
    };

    ENCABEZADOS_PROVEEDOR.forEach((h, i) => updateMax(i, h));

    let sheetTotalSolicitantes = 0;
    let sheetTotalPasajeros = 0;
    let sheetTotalAlimentos = 0;
    let sheetTotalSinAlimentos = 0;

    const etiqueta = (celda) => { celda.font = { bold: true }; celda.fill = relleno('FFE5E7EB'); };

    for (const bloque of bloques) {
      sheetTotalSolicitantes++;

      const rSol = ws.getRow(currentRow);
      rSol.getCell(1).value = 'Solicitante:';
      etiqueta(rSol.getCell(1));
      rSol.getCell(2).value = bloque.solicitanteNombre;
      rSol.getCell(2).font = { bold: true };
      ws.mergeCells(`B${currentRow}:D${currentRow}`);
      currentRow++;

      if (isVarias) {
        const fsBlockArr = Array.from(bloque.fechasSolicitud);
        const uniqueDaysBlock = new Set(fsBlockArr.map(diaLocal).filter(Boolean));

        let blockDateDisplay = formatIsoDate(fsBlockArr.find(Boolean) ?? '');
        if (uniqueDaysBlock.size > 1) blockDateDisplay = 'Varias fechas';

        const rSolDate = ws.getRow(currentRow);
        rSolDate.getCell(1).value = 'Solicitada el:';
        etiqueta(rSolDate.getCell(1));
        rSolDate.getCell(2).value = blockDateDisplay;
        rSolDate.getCell(2).font = { bold: true };
        ws.mergeCells(`B${currentRow}:D${currentRow}`);
        currentRow++;
      }

      const rTurno = ws.getRow(currentRow);
      rTurno.getCell(1).value = 'TURNO:';
      etiqueta(rTurno.getCell(1));
      rTurno.getCell(2).value = CODIGO_TURNO[turnoName] ?? turnoName;
      rTurno.getCell(2).font = { bold: true };
      currentRow++;

      const rFecha = ws.getRow(currentRow);
      rFecha.getCell(1).value = 'Fecha:';
      etiqueta(rFecha.getCell(1));
      rFecha.getCell(2).value = formattedFechaServicio;
      rFecha.getCell(2).font = { bold: true };
      currentRow++;

      currentRow++;

      const rHead = ws.getRow(currentRow);
      rHead.height = 22;
      ENCABEZADOS_PROVEEDOR.forEach((h, i) => {
        const cell = rHead.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = relleno('FFC8102E');
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });
      currentRow++;

      // Ruta, comunidad, punto y nombre; todo se compara como texto (la nómina o un nombre vacío no deben romper el orden)
      const pasSorted = bloque.pasajeros.sort((a, b) => comparar(nombreRuta(a.rutaId), nombreRuta(b.rutaId))
        || comparar(nombreCom(a.comunidadId), nombreCom(b.comunidadId))
        || comparar(nombrePunto(a.puntoReunionId), nombrePunto(b.puntoReunionId))
        || comparar(a.nombre, b.nombre) || comparar(a.nomina, b.nomina));

      let conAlimentos = 0;
      let sinAlimentos = 0;
      let filaColorToggle = false;

      for (const p of pasSorted) {
        sheetTotalPasajeros++;
        const tieneAli = !!p.alimentos;
        if (tieneAli) { conAlimentos++; sheetTotalAlimentos++; }
        else { sinAlimentos++; sheetTotalSinAlimentos++; }

        const rPas = ws.getRow(currentRow);
        // Todo como texto: una nómina numérica o un campo vacío no cambian el tipo de la celda
        const rData = [
          texto(p.area), texto(p.puesto), texto(p.nomina), texto(p.nombre), horaParaProveedor(texto(p.horaEntrada)), horaParaProveedor(texto(p.horaSalida)),
          tieneAli ? 'SI' : 'NO', nombreRuta(p.rutaId), nombreCom(p.comunidadId), nombrePunto(p.puntoReunionId), formatoTelefono(telefonoDe(p.nomina)),
        ];

        rData.forEach((val, i) => {
          updateMax(i, val);
          const cell = rPas.getCell(i + 1);
          cell.value = val;
          cell.alignment = { vertical: 'middle' };
          cell.border = bordeFino('FF9CA3AF');
          if (filaColorToggle) cell.fill = relleno('FFF3F4F6');
          if ([2, 4, 5, 6, 10].includes(i)) cell.alignment = { vertical: 'middle', horizontal: 'center' };
          if (i === 6 && tieneAli) cell.fill = relleno('FFDCFCE7');
        });

        filaColorToggle = !filaColorToggle;
        currentRow++;
      }

      const rCount = ws.getRow(currentRow);
      rCount.getCell(1).value = `Pasajeros: ${pasSorted.length}`;
      etiqueta(rCount.getCell(1));
      ws.mergeCells(`A${currentRow}:D${currentRow}`);

      rCount.getCell(5).value = `Con alimentos: ${conAlimentos}`;
      etiqueta(rCount.getCell(5));
      ws.mergeCells(`E${currentRow}:G${currentRow}`);

      rCount.getCell(8).value = `Sin alimentos: ${sinAlimentos}`;
      etiqueta(rCount.getCell(8));
      ws.mergeCells(`H${currentRow}:J${currentRow}`);

      [1, 5, 8].forEach(c => { rCount.getCell(c).border = bordeFino('FF000000'); });

      currentRow += 2;
    }

    const rTot = ws.getRow(currentRow);
    rTot.getCell(1).value = 'TOTAL DEL TURNO';
    etiqueta(rTot.getCell(1));
    ws.mergeCells(`A${currentRow}:D${currentRow}`);

    const rTot2 = ws.getRow(currentRow + 1);
    rTot2.getCell(1).value = `Solicitantes: ${sheetTotalSolicitantes}`;
    etiqueta(rTot2.getCell(1));

    rTot2.getCell(2).value = `Pasajeros: ${sheetTotalPasajeros}`;
    etiqueta(rTot2.getCell(2));

    rTot2.getCell(5).value = `Con alimentos: ${sheetTotalAlimentos}`;
    etiqueta(rTot2.getCell(5));
    ws.mergeCells(`E${currentRow + 1}:G${currentRow + 1}`);

    rTot2.getCell(8).value = `Sin alimentos: ${sheetTotalSinAlimentos}`;
    etiqueta(rTot2.getCell(8));
    ws.mergeCells(`H${currentRow + 1}:J${currentRow + 1}`);

    const bordeSimple = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    rTot.getCell(1).border = bordeSimple;
    [1, 2, 5, 8].forEach(c => { rTot2.getCell(c).border = bordeSimple; });

    for (let i = 0; i < COLUMNAS; i++) {
      ws.getColumn(i + 1).width = maxColWidths[i] + 3;
    }

    // El nombre del solicitante ocupa PUESTO + NÓMINA + NOMBRE (combinadas): si no cabe, se ensancha NOMBRE
    let maxSolNameLen = 0;
    bloques.forEach(b => { if (b.solicitanteNombre.length > maxSolNameLen) maxSolNameLen = b.solicitanteNombre.length; });
    const anchoCombinado = (maxColWidths[1] + 3) + (maxColWidths[2] + 3) + (maxColWidths[3] + 3);
    if (anchoCombinado < maxSolNameLen + 3) {
      ws.getColumn(4).width = (maxSolNameLen + 3) - (maxColWidths[1] + 3) - (maxColWidths[2] + 3);
    }
  }

  return workbook;
}
