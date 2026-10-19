// Excel seguro: inyección de fórmulas en las exportaciones y límites de las importaciones. Datos ficticios.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  LIMITES_IMPORTACION, bufferSeguro, esTextoPeligroso, motivoArchivoNoValido, motivoLibroDemasiadoGrande, neutralizarLibro, neutralizarTexto,
} from '../src/utils/excelSeguro.js';
import { construirRespaldoPadron } from '../src/utils/respaldoPadron.js';
import { construirLibroAccesos } from '../src/utils/accesosIniciales.js';

const PELIGROSOS = ['=1+1', '=HYPERLINK("http://malo","clic")', '+cmd|calc', '-2+3', '@SUM(A1)', '\t=1', '\r=1', "=cmd|' /C calc'!A0"];

describe('neutralizar texto', () => {
  it('detecta lo que empieza como fórmula', () => {
    for (const p of PELIGROSOS) expect(esTextoPeligroso(p), p).toBe(true);
    for (const ok of ['Juan', 'ESPINOSA MARCO', '12345', 'A=B', 'a+b', ' =1', '', 'x-y', '—']) expect(esTextoPeligroso(ok), ok).toBe(false);
    expect(esTextoPeligroso(5)).toBe(false);
    expect(esTextoPeligroso(null)).toBe(false);
  });
  it('antepone una comilla simple solo si hace falta', () => {
    expect(neutralizarTexto('=1+1')).toBe("'=1+1");
    expect(neutralizarTexto('Juan')).toBe('Juan');
    expect(neutralizarTexto(7)).toBe(7);
  });
});

describe('libro neutralizado', () => {
  const armar = () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Datos');
    ws.addRow(['Nombre', 'Motivo', 'Número']);
    ws.addRow(['=1+1', '+cmd|calc', 42]);
    ws.addRow(['Normal', '@SUM(A1)', -5]);
    ws.getCell('D2').value = { richText: [{ text: '=rico' }, { text: ' y más' }] };
    ws.getCell('D3').value = { text: '=enlace', hyperlink: 'https://example.com' };
    ws.getCell('D4').value = { formula: 'A1+1' };
    ws.getCell('D5').value = new Date(2026, 0, 1);
    wb.addWorksheet('Otra').addRow(['-1+1', 'ok']);
    return wb;
  };
  it('neutraliza textos, texto con formato y enlaces, en todas las hojas; no toca números ni fechas; descarta fórmulas', () => {
    const wb = armar();
    const n = neutralizarLibro(wb);
    const a = wb.getWorksheet('Datos');
    expect(a.getCell('A2').value).toBe("'=1+1");
    expect(a.getCell('B2').value).toBe("'+cmd|calc");
    expect(a.getCell('B3').value).toBe("'@SUM(A1)");
    expect(a.getCell('A3').value).toBe('Normal');
    expect(a.getCell('C2').value).toBe(42);
    expect(a.getCell('C3').value).toBe(-5);
    expect(a.getCell('D2').value.richText[0].text).toBe("'=rico");
    expect(a.getCell('D3').value.text).toBe("'=enlace");
    expect(a.getCell('D4').value).toBeNull();
    expect(a.getCell('D5').value).toBeInstanceOf(Date);
    expect(wb.getWorksheet('Otra').getCell('A1').value).toBe("'-1+1");
    expect(n).toBe(7);
  });
  it('lo escrito y leído de nuevo conserva la neutralización', async () => {
    const wb = armar();
    const buffer = await bufferSeguro(wb);
    const leido = new ExcelJS.Workbook();
    await leido.xlsx.load(buffer);
    for (const ws of leido.worksheets) {
      ws.eachRow(row => row.eachCell(cell => {
        const v = typeof cell.value === 'string' ? cell.value : cell.value?.text ?? cell.value?.richText?.[0]?.text;
        if (typeof v === 'string') expect(esTextoPeligroso(v), `${ws.name}!${cell.address}: ${v}`).toBe(false);
        expect(cell.value?.formula, `${ws.name}!${cell.address}`).toBeUndefined();
      }));
    }
  });
  it('los libros reales (respaldo del padrón, accesos) salen neutralizados con nombres maliciosos', async () => {
    const wb = construirRespaldoPadron({ empleados: [{ nomina: '1', nombre: '=HYPERLINK("http://malo")', puesto: '+OPERADOR', puestoId: 'x', areaId: 'a', turnoNomina: 'A', activo: true }], areas: [{ id: 'a', nombre: '@AREA' }] });
    neutralizarLibro(wb);
    const ws = wb.getWorksheet('Padron');
    const valores = [];
    ws.eachRow(row => row.eachCell(c => valores.push(String(c.value))));
    expect(valores.some(v => v.startsWith("'=HYPERLINK"))).toBe(true);
    expect(valores.some(v => v.startsWith("'+OPERADOR"))).toBe(true);
    expect(valores.some(v => v.startsWith("'@AREA"))).toBe(true);
    expect(valores.filter(v => esTextoPeligroso(v))).toEqual([]);
    const accesos = construirLibroAccesos([{ nomina: '2', nombre: '-PERSONA', area: '=AREA', roles: '@x', password: 'CM-AAAA-BBBB' }]);
    expect(neutralizarLibro(accesos)).toBe(3);
  });
});

describe('ninguna exportación se salta el saneado', () => {
  const archivos = (dir) => readdirSync(dir).flatMap(n => {
    const f = join(dir, n);
    return statSync(f).isDirectory() ? archivos(f) : /\.(js|jsx)$/.test(f) ? [f] : [];
  });
  it('wb.xlsx.writeBuffer() solo existe dentro de excelSeguro.js (todo lo demás usa bufferSeguro)', () => {
    const infractores = archivos('src').filter(f => !f.endsWith('excelSeguro.js') && /\.xlsx\.writeBuffer\s*\(/.test(readFileSync(f, 'utf8')));
    expect(infractores).toEqual([]);
  });
  it('wb.xlsx.writeFile / write tampoco se usan', () => {
    const infractores = archivos('src').filter(f => /\.xlsx\.(writeFile|write)\s*\(/.test(readFileSync(f, 'utf8')));
    expect(infractores).toEqual([]);
  });
});

describe('límites de importación', () => {
  it('rechaza archivos vacíos o enormes y dice por qué', () => {
    expect(motivoArchivoNoValido(0)).toMatch(/vacío/);
    expect(motivoArchivoNoValido(LIMITES_IMPORTACION.bytes + 1)).toMatch(/máximo/);
    expect(motivoArchivoNoValido(200 * 1024)).toBeNull();
    expect(motivoArchivoNoValido(LIMITES_IMPORTACION.bytes)).toBeNull();
  });
  it('rechaza libros con demasiadas filas, columnas u hojas', () => {
    const hoja = (rowCount, columnCount = 10, name = 'H') => ({ name, rowCount, columnCount });
    expect(motivoLibroDemasiadoGrande([hoja(500)])).toBeNull();
    expect(motivoLibroDemasiadoGrande([hoja(LIMITES_IMPORTACION.filas + 1)])).toMatch(/filas/);
    expect(motivoLibroDemasiadoGrande([hoja(10, LIMITES_IMPORTACION.columnas + 1)])).toMatch(/columnas/);
    expect(motivoLibroDemasiadoGrande(Array.from({ length: LIMITES_IMPORTACION.hojas + 1 }, () => hoja(1)))).toMatch(/hojas/);
  });
  it('cargarLibro aplica los límites (la importación los usa)', () => {
    const f = readFileSync('src/utils/formatosImportacion.js', 'utf8');
    expect(f).toContain('motivoArchivoNoValido(');
    expect(f).toContain('motivoLibroDemasiadoGrande(');
  });
});
