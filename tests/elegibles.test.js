// Personal elegible para tiempo extra: filtro, columna ELEGIBLE TE de la importación, carga del archivo de elegibles y lista del Inicio.
// Datos ficticios. Ejecutar con: npm run test:unit
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { EMP_HEADERS, leerElegiblesArchivo, leerEmpleados } from '../src/utils/formatosImportacion.js';
import { compararEmpleados } from '../src/utils/comparacionImportacion.js';
import { FILTRO_ELEGIBLE, esElegibleActivo, esElegibleTE, filtrarPorElegibilidad, leerElegible, planElegiblesTE } from '../src/utils/elegibles.js';
import { areasDeLaLista, filtrarLista, quienVeTelefono } from '../src/utils/listaPersonal.js';
import { AREAS_INICIALES, PUESTOS_INICIALES } from '../src/utils/estructura.js';

const libro = async (hojas) => {
  const wb = new ExcelJS.Workbook();
  for (const { nombre, filas } of hojas) { const ws = wb.addWorksheet(nombre); filas.forEach(f => ws.addRow(f)); }
  return wb.xlsx.writeBuffer();
};

describe('esElegibleTE', () => {
  it('solo elegibleTE:false oculta; un documento sin el campo cuenta como elegible', () => {
    expect(esElegibleTE({ elegibleTE: true })).toBe(true);
    expect(esElegibleTE({})).toBe(true);
    expect(esElegibleTE({ elegibleTE: false })).toBe(false);
    expect(esElegibleTE(null)).toBe(false);
  });
  it('las listas de captura piden además que esté activo', () => {
    expect(esElegibleActivo({ elegibleTE: true })).toBe(true);
    expect(esElegibleActivo({ elegibleTE: true, activo: false })).toBe(false);
    expect(esElegibleActivo({ elegibleTE: false })).toBe(false);
  });
  it('el filtro de Personal separa elegibles y no elegibles', () => {
    const l = [{ nomina: '1', elegibleTE: true }, { nomina: '2', elegibleTE: false }, { nomina: '3' }];
    expect(filtrarPorElegibilidad(l, FILTRO_ELEGIBLE.ELEGIBLES).map(e => e.nomina)).toEqual(['1', '3']);
    expect(filtrarPorElegibilidad(l, FILTRO_ELEGIBLE.NO_ELEGIBLES).map(e => e.nomina)).toEqual(['2']);
    expect(filtrarPorElegibilidad(l, FILTRO_ELEGIBLE.TODOS)).toHaveLength(3);
  });
  it('leerElegible entiende SI/NO con o sin acento, y distingue vacío de inválido', () => {
    expect(leerElegible('SI')).toBe(true);
    expect(leerElegible(' sí ')).toBe(true);
    expect(leerElegible('NO')).toBe(false);
    expect(leerElegible('')).toBe(null);
    expect(leerElegible(undefined)).toBe(null);
    expect(leerElegible('quizá')).toBe(undefined);
  });
});

describe('importación de Personal: columna ELEGIBLE TE', () => {
  const plan = (filas, empleados = []) => compararEmpleados(filas, empleados, { catalogo: PUESTOS_INICIALES, areas: AREAS_INICIALES });
  const filas = async (valores, encabezados = EMP_HEADERS) => leerEmpleados(await libro([{ nombre: 'Empleados', filas: [encabezados, ...valores] }]), new Map());

  it('la plantilla trae ELEGIBLE TE como última columna opcional y un archivo sin ella se sigue leyendo', async () => {
    expect(EMP_HEADERS.at(-1)).toBe('ELEGIBLE TE');
    const f = await filas([[7219, 'PEREZ JUAN', 'PRODUCTION OPERATOR', '']], EMP_HEADERS.slice(0, 4));
    expect(f[0].estado).not.toBe('error');
    expect(f[0].datos['ELEGIBLE TE']).toBe(null);
  });
  it('SI/NO cambian el valor; vacía no cambia el actual; un valor raro avisa y tampoco cambia', async () => {
    const base = { puesto: 'PRODUCTION OPERATOR', puestoId: 'production-operator', areaId: 'produccion', activo: true };
    const existentes = [
      { id: '1', nomina: '1', nombre: 'UNO', elegibleTE: true, ...base },
      { id: '2', nomina: '2', nombre: 'DOS', elegibleTE: false, ...base },
      { id: '3', nomina: '3', nombre: 'TRES', elegibleTE: false, ...base },
    ];
    const f = await filas([
      [1, 'UNO', 'PRODUCTION OPERATOR', '', '', 'NO'],
      [2, 'DOS', 'PRODUCTION OPERATOR', '', '', ''],
      [3, 'TRES', 'PRODUCTION OPERATOR', '', '', 'tal vez'],
    ]);
    expect(f[2].estado).toBe('advertencia');
    const p = plan(f, existentes);
    const por = (n) => p.items.find(i => i.clave === n);
    expect(por('1').datos.elegibleTE).toBe(false);
    expect(por('1').cambios).toEqual([{ campo: 'ELEGIBLE TE', antes: 'SI', despues: 'NO' }]);
    expect(por('2').accion).toBe('sinCambios');
    expect(por('3').accion).toBe('sinCambios');
  });
  it('un empleado nuevo sin valor queda como elegible', async () => {
    const f = await filas([[9, 'NUEVO', 'PRODUCTION OPERATOR']]);
    expect(plan(f).items[0].datos.elegibleTE).toBe(true);
  });
});

describe('carga del archivo de elegibles (AREA TE manda)', () => {
  const areas = AREAS_INICIALES;
  const puestos = PUESTOS_INICIALES.map(p => ({ id: p.id, areaId: p.areaId }));
  const emp = (nomina, o = {}) => ({ id: nomina, nomina, nombre: `EMPLEADO ${nomina}`, puestoId: 'forklift-operator', puesto: 'FORKLIFT OPERATOR', areaId: 'almacen', activo: true, ...o });
  const fila = (nomina, areaTE, elegible, filaExcel = 2) => ({ filaExcel, nomina, areaTE, elegible });

  it('pone elegibleTE y el área; si AREA TE difiere del puesto la guarda como excepción', () => {
    const p = planElegiblesTE({
      filas: [fila('1', 'Producción', true), fila('2', 'Almacén', true), fila('3', '', false)],
      empleados: [emp('1'), emp('2'), emp('3', { areaId: 'administrativo', puestoId: 'it-analyst' })],
      areas, puestos,
    });
    const c = (n) => p.cambios.find(x => x.nomina === n);
    expect(c('1').datos).toEqual({ elegibleTE: true, areaId: 'produccion', areaExcepcion: 'produccion', areaExcepcionMotivo: expect.any(String) });
    expect(c('2').datos).toEqual({ elegibleTE: true }); // ya estaba en su área; sin excepción
    expect(c('3').datos).toEqual({ elegibleTE: false }); // a un NO no se le toca el área
    expect(Object.fromEntries(p.porArea)).toEqual({ produccion: 1, almacen: 1 });
  });
  it('si el área del archivo coincide con la del puesto, quita una excepción anterior', () => {
    const p = planElegiblesTE({
      filas: [fila('1', 'Almacén', true)],
      empleados: [emp('1', { areaId: 'produccion', areaExcepcion: 'produccion', areaExcepcionMotivo: 'x' })], areas, puestos,
    });
    expect(p.cambios[0].datos).toEqual({ elegibleTE: true, areaId: 'almacen', areaExcepcion: null, areaExcepcionMotivo: '' });
  });
  it('los del padrón que no vienen en el archivo quedan no elegibles y se listan; no se desactivan', () => {
    const p = planElegiblesTE({ filas: [fila('1', 'Almacén', true)], empleados: [emp('1'), emp('2'), emp('3', { activo: false }), emp('4', { elegibleTE: false })], areas, puestos });
    expect(p.noEnArchivo.map(e => e.nomina)).toEqual(['2', '3', '4']);
    expect(p.cambios.filter(c => c.datos.elegibleTE === false).map(c => c.nomina).sort()).toEqual(['2', '3']); // el 4 ya estaba en false
    expect(p.cambios.some(c => 'activo' in c.datos)).toBe(false);
    expect(p.conteo.sinArchivo).toBe(3);
  });
  it('reporta nóminas que no están en el padrón, repetidas, valores no válidos y áreas desconocidas', () => {
    const p = planElegiblesTE({
      filas: [fila('99', 'Almacén', true), fila('1', 'Almacén', true), fila('1', 'Almacén', true, 3), fila('2', 'Almacén', undefined, 4), fila('3', 'Marte', true, 5)],
      empleados: [emp('1'), emp('2'), emp('3')], areas, puestos,
    });
    expect(p.noEnPadron.map(e => e.nomina)).toEqual(['99']);
    expect(p.problemas.map(x => x.mensaje).join('|')).toMatch(/repetida.*SI o NO.*no existe/);
    // los que traen problema no se marcan como «no vienen en el archivo»
    expect(p.noEnArchivo).toEqual([]);
  });
  it('lee el archivo: hoja con NOMINA, AREA TE y ELEGIBLE TE; ignora la hoja de resumen', async () => {
    const buf = await libro([
      { nombre: 'Padron TE', filas: [['NOMINA', 'NOMBRE', 'PUESTO', 'DEPTO NOMINA', 'AREA TE', 'ELEGIBLE TE'], [50131, 'A', 'P', 'D', 'Almacén', 'SI'], [50132, 'B', 'P', 'D', '', 'NO']] },
      { nombre: 'Resumen', filas: [['AREA', 'EN LISTA'], ['Almacén', 1]] },
    ]);
    const { hoja, filas } = await leerElegiblesArchivo(buf);
    expect(hoja).toBe('Padron TE');
    expect(filas).toEqual([
      { filaExcel: 2, nomina: '50131', areaTE: 'Almacén', elegible: true },
      { filaExcel: 3, nomina: '50132', areaTE: '', elegible: false },
    ]);
    await expect(leerElegiblesArchivo(await libro([{ nombre: 'Otra', filas: [['X']] }]))).rejects.toThrow(/NOMINA, AREA TE y ELEGIBLE TE/);
  });
});

describe('lista del personal desde el Inicio', () => {
  const areas = AREAS_INICIALES;
  const acc = (o) => ({ esRH: false, esNomina: false, esAut2: false, areasAut1: [], areasSolicitante: [], ...o });
  it('RH, admin, Nóminas y Aut. 2 ven todas las áreas que participan; Aut. 1 y solicitante, solo las suyas', () => {
    const todas = areas.filter(a => a.participaTE).map(a => a.id);
    for (const o of [{ esRH: true }, { esNomina: true }, { esAut2: true }]) expect(areasDeLaLista(acc(o), areas).map(a => a.id)).toEqual(todas);
    expect(areasDeLaLista(acc({ areasAut1: ['moldes'], areasSolicitante: ['calidad'] }), areas).map(a => a.id).sort()).toEqual(['calidad', 'moldes']);
    expect(areasDeLaLista(acc({}), areas)).toEqual([]);
  });
  it('filtra por área, límite de áreas y buscador (sin acentos), ordenado por nombre', () => {
    const l = [
      { nomina: '2', nombre: 'ZÚÑIGA', areaId: 'calidad' }, { nomina: '1', nombre: 'ÁVILA', areaId: 'moldes' }, { nomina: '3', nombre: 'MORA', areaId: 'produccion' },
    ];
    expect(filtrarLista(l, { areasPermitidas: ['calidad', 'moldes'] }).map(e => e.nomina)).toEqual(['1', '2']);
    expect(filtrarLista(l, { areaId: 'moldes' }).map(e => e.nomina)).toEqual(['1']);
    expect(filtrarLista(l, { busqueda: 'avila' }).map(e => e.nomina)).toEqual(['1']);
    expect(filtrarLista(l, { busqueda: '3' }).map(e => e.nomina)).toEqual(['3']);
  });
  it('el teléfono solo lo ven RH, admin, Nóminas y el solicitante de esa área', () => {
    expect(quienVeTelefono(acc({ esRH: true })).puede({ areaId: 'x' })).toBe(true);
    expect(quienVeTelefono(acc({ esNomina: true })).muestra).toBe(true);
    const sol = quienVeTelefono(acc({ areasSolicitante: ['calidad'], areasAut1: ['moldes'] }));
    expect(sol.muestra).toBe(true);
    expect(sol.puede({ areaId: 'calidad' })).toBe(true);
    expect(sol.puede({ areaId: 'moldes' })).toBe(false);
    expect(quienVeTelefono(acc({ areasAut1: ['moldes'] })).muestra).toBe(false);
    expect(quienVeTelefono(acc({ esAut2: true })).muestra).toBe(false);
  });
});
