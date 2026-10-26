// El Excel del formato de autorización de tiempo extra: encabezado, casilla del área, tabla, firmas, notas, pie, páginas y hoja Resumen. Sin Firebase.
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { construirLibroFormatoNomina } from '../src/utils/exportarFormatoNomina.js';
import { FIRMAS_FORMATO, FILAS_POR_PAGINA, NOTAS_FORMATO, PIE_FORMATO, TITULO_FORMATO, aplicarCambios, cambioHoras, cambioQuitar, semanaDe } from '../src/utils/formatoNomina.js';
import { bufferSeguro } from '../src/utils/excelSeguro.js';

const s = semanaDe('2026-10-22');
const fila = (i, extra = {}) => ({
  clave: String(1000 + i), nomina: String(1000 + i), nombre: `EMPLEADO ${i}`, puesto: 'Op', horas: { '2026-10-24': 9, '2026-10-25': 4 },
  motivos: { '2026-10-24': ['Producción'], '2026-10-25': ['Inventario'] }, ...extra,
});
const filasDe = (n, cambios = []) => aplicarCambios(Array.from({ length: n }, (_, i) => fila(i)), cambios, s);
const libro = (areas, extra = {}) => construirLibroFormatoNomina({ ExcelJS, periodo: s, areas, fecha: new Date(2026, 9, 26), ...extra });
const textos = (ws) => { const t = []; ws.eachRow(r => r.eachCell(c => { if (c.isMerged && c.address !== c.master.address) return; if (c.value !== null && c.value !== '') t.push(String(c.value)); })); return t; };

describe('hoja de un área', () => {
  const wb = libro([{ areaId: 'moldes', nombre: 'Taller de Moldes', filas: filasDe(3) }]);
  const ws = wb.getWorksheet('Taller de Moldes');
  const t = textos(ws);

  it('trae el título, la casilla del área marcada (solo esa), la semana y la fecha de descarga', () => {
    expect(t).toContain(TITULO_FORMATO);
    expect(t).toContain('☒  Taller Moldes');
    expect(t.filter(x => x.startsWith('☒'))).toHaveLength(1);
    expect(t.filter(x => x.startsWith('☐'))).toHaveLength(7);
    expect(t).toContain('43');
    expect(t).toContain('19–25 oct 2026');
    expect(t).toContain('26/10/2026');
  });
  it('la tabla lleva Item, No. Empleado, Nombre, los siete días con su fecha, Sub-Total, P.O./TB y la descripción', () => {
    for (const h of ['Item', 'No. Empleado', 'Nombre Completo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo', 'Sub-Total', 'P.O./TB', 'Descripción Motivo / Razón']) expect(t, h).toContain(h);
    for (const d of ['19/10', '20/10', '21/10', '22/10', '23/10', '24/10', '25/10']) expect(t, d).toContain(d);
  });
  it('usa las horas, el subtotal y el total; el motivo cambia por día cuando es distinto', () => {
    const a = ws.getRow(8); // primer empleado (fila 5 de encabezado + 2 de la tabla = 7... se busca por su nombre)
    const r = [...Array(40).keys()].map(i => ws.getRow(i + 1)).find(x => x.getCell('C').value === 'EMPLEADO 0');
    expect(a).toBeTruthy();
    expect(r.getCell('B').value).toBe('1000');
    expect(r.getCell('I').value).toBe(9); // sábado
    expect(r.getCell('J').value).toBe(4); // domingo
    expect(r.getCell('K').value).toBe(13);
    expect(r.getCell('L').value).toBe(''); // P.O./TB vacío por ahora
    expect(r.getCell('M').value).toBe('Sáb: Producción; Dom: Inventario');
    const total = [...Array(40).keys()].map(i => ws.getRow(i + 1)).find(x => x.getCell('A').value === 'Total Hrs.');
    expect(total.getCell('K').value).toBe(39);
    expect(total.getCell('I').value).toBe(27);
  });
  it('trae las cuatro firmas con su etiqueta, las dos notas y el pie (código, revisión y fecha de revisión)', () => {
    for (const f of FIRMAS_FORMATO) expect(t, f).toContain(f);
    for (const n of NOTAS_FORMATO) expect(t, n.slice(0, 30)).toContain(n);
    expect(t).toContain(PIE_FORMATO.codigo);
    expect(t).toContain(PIE_FORMATO.revision);
    expect(t).toContain(PIE_FORMATO.fechaRev);
  });
  it('está lista para imprimir: carta horizontal, escala fija, centrada y con área de impresión', () => {
    expect(ws.pageSetup.orientation).toBe('landscape');
    expect(ws.pageSetup.paperSize).toBe(1);
    expect(ws.pageSetup.scale).toBe(80);
    expect(ws.pageSetup.horizontalCentered).toBe(true);
    expect(ws.pageSetup.printArea).toMatch(/^A1:M\d+$/);
  });
  it('sin saltos de página con hasta 15 empleados (una sola hoja carta)', () => {
    for (const n of [1, FILAS_POR_PAGINA]) {
      const hoja = libro([{ areaId: 'moldes', nombre: 'A', filas: filasDe(n) }]).getWorksheet('A');
      expect(hoja.rowBreaks ?? [], `${n} empleados`).toHaveLength(0);
    }
  });
});

describe('más empleados de los que caben', () => {
  const n = 22;
  const ws = libro([{ areaId: 'calidad', nombre: 'Calidad', filas: filasDe(n) }]).getWorksheet('Calidad');
  const t = textos(ws);
  it('continúa en otra página repitiendo el encabezado; las firmas, las notas y el total van solo en la última', () => {
    expect(ws.rowBreaks).toHaveLength(1);
    expect(t.filter(x => x === TITULO_FORMATO)).toHaveLength(2);
    expect(t.filter(x => x === 'Nombre Completo')).toHaveLength(2);
    expect(t.filter(x => x === FIRMAS_FORMATO[0])).toHaveLength(1);
    expect(t.filter(x => x === 'Total Hrs.')).toHaveLength(1);
    expect(t.filter(x => x === PIE_FORMATO.codigo)).toHaveLength(2);
  });
  it('numera los renglones de corrido (Item 1 a 22)', () => {
    const items = [...Array(120).keys()].map(i => ws.getRow(i + 1).getCell('A').value).filter(v => typeof v === 'number');
    expect(items).toEqual(Array.from({ length: n }, (_, i) => i + 1));
  });
});

describe('usa lo ajustado y no incluye a quien se quitó', () => {
  const filas = filasDe(3, [cambioQuitar(fila(1), 'No asistió'), cambioHoras(fila(0), '2026-10-24', 5, 'Salió antes')]);
  const ws = libro([{ areaId: 'moldes', nombre: 'Moldes', filas }]).getWorksheet('Moldes');
  const t = textos(ws);
  it('sin el empleado quitado, con las horas corregidas y el total ajustado', () => {
    expect(t).not.toContain('EMPLEADO 1');
    expect(t).toContain('EMPLEADO 0');
    const r = [...Array(40).keys()].map(i => ws.getRow(i + 1)).find(x => x.getCell('C').value === 'EMPLEADO 0');
    expect(r.getCell('I').value).toBe(5);
    expect(r.getCell('K').value).toBe(9);
    const total = [...Array(40).keys()].map(i => ws.getRow(i + 1)).find(x => x.getCell('A').value === 'Total Hrs.');
    expect(total.getCell('K').value).toBe(9 + 13);
  });
});

describe('«todas las áreas»: hoja Resumen primero y una hoja por área', () => {
  const wb = libro([
    { areaId: 'moldes', nombre: 'Moldes', filas: filasDe(2) },
    { areaId: 'calidad', nombre: 'Calidad', filas: filasDe(1) },
  ], { conResumen: true });
  it('Resumen es la primera hoja, y después van las áreas', () => {
    expect(wb.worksheets.map(w => w.name)).toEqual(['Resumen', 'Moldes', 'Calidad']);
  });
  it('trae horas por área, por empleado y por motivo con su porcentaje', () => {
    const t = textos(wb.getWorksheet('Resumen'));
    for (const x of ['Horas por área', 'Horas por empleado (para capturar la nómina)', 'Horas por motivo', 'Producción', 'Inventario', '% del total']) expect(t, x).toContain(x);
    expect(t).toContain('69.2%'); // 27 de 39 horas
    expect(t).toContain('30.8%');
    expect(t).toContain('EMPLEADO 0');
  });
  it('sin «conResumen» (una sola área) no hay hoja Resumen', () => {
    expect(libro([{ areaId: 'moldes', nombre: 'Moldes', filas: filasDe(1) }]).worksheets.map(w => w.name)).toEqual(['Moldes']);
  });
  it('dos áreas con el mismo nombre de hoja no chocan', () => {
    const w = libro([{ areaId: 'a', nombre: 'Moldes', filas: filasDe(1) }, { areaId: 'b', nombre: 'moldes', filas: filasDe(1) }]);
    expect(new Set(w.worksheets.map(x => x.name.toLowerCase())).size).toBe(2);
  });
});

describe('seguridad del archivo', () => {
  it('un nombre o motivo que empieza como fórmula se neutraliza (como en los demás Excel)', async () => {
    const mala = filasDe(1);
    mala[0].nombre = '=HYPERLINK("http://malo","clic")';
    mala[0].motivo = '+cmd|calc';
    const wb = libro([{ areaId: 'moldes', nombre: 'Moldes', filas: mala }]);
    await bufferSeguro(wb);
    const t = textos(wb.getWorksheet('Moldes'));
    expect(t.some(x => x.startsWith('=HYPERLINK'))).toBe(false);
    expect(t).toContain('\'=HYPERLINK("http://malo","clic")');
    expect(t).toContain('\'+cmd|calc');
  });
});

describe('P.O./TB en el formato', () => {
  const conPO = (i) => fila(i, {
    motivos: { '2026-10-24': ['Cargo a P.O.'], '2026-10-25': ['Cargo a P.O.'] }, numeros: { '2026-10-24': ['4551099797'], '2026-10-25': ['4551099797'] },
    detalle: { '2026-10-24': [{ nombre: 'Cargo a P.O.', numero: '4551099797', tipo: 'po', horas: 9 }], '2026-10-25': [{ nombre: 'Cargo a P.O.', numero: '4551099797', tipo: 'po', horas: 4 }] },
  });
  const filasPO = aplicarCambios([conPO(0), fila(1, { detalle: { '2026-10-24': [{ nombre: 'Inventario físico', numero: '', tipo: '', horas: 9 }] } })], [], s);
  const wb = libro([{ areaId: 'moldes', nombre: 'Moldes', filas: filasPO }, { areaId: 'calidad', nombre: 'Calidad', filas: filasDe(1) }], { conResumen: true });
  const buscar = (ws, nombre) => [...Array(40).keys()].map(i => ws.getRow(i + 1)).find(x => x.getCell('C').value === nombre);

  it('la columna P.O./TB lleva el número de cada empleado (y queda vacía si no tiene)', () => {
    const ws = wb.getWorksheet('Moldes');
    expect(buscar(ws, 'EMPLEADO 0').getCell('L').value).toBe('4551099797');
    expect(buscar(ws, 'EMPLEADO 0').getCell('M').value).toBe('Cargo a P.O.');
    expect(buscar(ws, 'EMPLEADO 1').getCell('L').value).toBe('');
  });
  it('la firma (2) queda como en el formato en papel, con o sin P.O./TB: sin resaltado ni texto extra', () => {
    for (const nombre of ['Moldes', 'Calidad']) {
      const ws = wb.getWorksheet(nombre);
      const t = textos(ws);
      expect(t).toContain(FIRMAS_FORMATO[1]);
      expect(t.some(x => /REQUIER|REQUERIDA/.test(x))).toBe(false);
      ws.eachRow(r => r.eachCell(c => {
        if (String(c.value).includes('Program Manager')) { expect(c.fill?.fgColor?.argb).toBeUndefined(); expect(c.font?.color).toBeUndefined(); }
      }));
    }
  });
  it('la hoja Resumen trae las horas por número de P.O./TB', () => {
    const t = textos(wb.getWorksheet('Resumen'));
    expect(t).toContain('Horas por número de P.O./TB');
    expect(t).toContain('P.O. 4551099797');
  });
  it('sin ningún P.O./TB el Resumen no trae esa tabla', () => {
    const w = libro([{ areaId: 'calidad', nombre: 'Calidad', filas: filasDe(1) }], { conResumen: true });
    expect(textos(w.getWorksheet('Resumen')).some(x => x.includes('Horas por número'))).toBe(false);
  });
});

describe('un área sin tiempo extra', () => {
  const wb = libro([{ areaId: 'moldes', nombre: 'Taller de Moldes', filas: filasDe(2) }, { areaId: 'calidad', nombre: 'Calidad', filas: [] }], { conResumen: true });
  it('sale como formato en blanco, con encabezado, días, renglones vacíos y firmas para llenarlo a mano', () => {
    const ws = wb.getWorksheet('Calidad');
    expect(ws).toBeTruthy();
    const t = textos(ws);
    expect(t).toContain(TITULO_FORMATO);
    expect(t).toContain('☒  Calidad');
    expect(t).toContain('Lunes');
    for (const f of FIRMAS_FORMATO) expect(t).toContain(f);
    expect(t.filter(x => x.startsWith('EMPLEADO'))).toHaveLength(0);
  });
  it('la hoja Resumen no cuenta empleados de esa área', () => {
    expect(wb.worksheets.map(w => w.name)).toEqual(['Resumen', 'Taller de Moldes', 'Calidad']);
    expect(textos(wb.getWorksheet('Resumen'))).toContain('Calidad');
  });
});
