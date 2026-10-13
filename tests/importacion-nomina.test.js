// Importación del reporte de nómina: detección de formato, limpieza y área de tiempo extra.
// Ejecutar con: npm run test:unit
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { leerEmpleados, construirFormatoEmpleados, ENCABEZADOS_NOMINA } from '../src/utils/formatosImportacion.js';
import { compararEmpleados } from '../src/utils/comparacionImportacion.js';
import { calcularAreaTE, REGLAS_AREA_TE_INICIALES } from '../src/utils/areasTE.js';
import { limpiarTexto } from '../src/utils/puestos.js';
import { AREAS_INICIALES, PUESTOS_INICIALES } from '../src/utils/estructura.js';

async function reporte(filas, { hoja = 'Hoja1', filaEnc = 1 } = {}) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(hoja);
  for (let i = 1; i < filaEnc; i++) ws.addRow(['Reporte de nómina']);
  ws.addRow(ENCABEZADOS_NOMINA);
  filas.forEach(f => ws.addRow(f));
  return wb.xlsx.writeBuffer();
}

const FILAS = [
  [11, 'MALDONADO SALVADOR', '317', 'CALIDAD', 'A', 'DIRECTOR', 'G1', new Date(Date.UTC(2010, 2, 15))],
  [7219, 'PEREZ JUAN', '316', 'MOLDEO', 'B', 'PRODUCTION OPERATOR      _x0002_', 'G2', new Date(Date.UTC(2020, 0, 6))],
  [50001, 'LOPEZ ANA', '316', 'MOLDEO', 'C', 'QUALITY INSPECTOR', 'G2', '15/03/2021'],
  [50002, 'RUIZ LUIS', '323', 'ALMACEN', 'A', 'RESINER', 'G2', null],
  [50003, 'GOMEZ PEDRO', '323', 'ALMACEN', 'A', 'FORKLIFT OPERATOR', 'G2', null],
  [50004, 'DIAZ OSCAR', '320', 'MANTTO', 'A', 'TECNICO', 'G2', null],
  [50005, 'SOTO RAUL', '321', 'MOLDES', 'A', 'MACHINIST', 'G2', null],
  [50006, 'CRUZ MARIA', '472', 'ADMIN', 'A', 'ASISTENTE', 'G2', null],
  [50007, 'VEGA TOMAS', '999', 'NUEVO', 'A', 'OTRO', 'G2', null],
];

describe('limpieza de puesto', () => {
  it('quita _x0002_, caracteres de control y espacios', () => {
    expect(limpiarTexto('PRODUCTION OPERATOR      _x0002_')).toBe('PRODUCTION OPERATOR');
    expect(limpiarTexto('  A\u0001  B\t\tC ')).toBe('A B C');
  });
});

describe('reglas de área de TE', () => {
  const area = (d, p) => calcularAreaTE(d, p, REGLAS_AREA_TE_INICIALES).areaId;
  it('316 inspector de calidad → calidad, el resto → producción', () => {
    expect(area('316', 'QUALITY INSPECTOR')).toBe('calidad');
    expect(area('316', 'PRODUCTION OPERATOR')).toBe('produccion');
  });
  it('323 resiner/scrap miller → producción, montacargas → almacén', () => {
    expect(area('323', 'RESINER')).toBe('produccion');
    expect(area('323', 'SCRAP MILLER')).toBe('produccion');
    expect(area('323', 'FORKLIFT')).toBe('almacen');
  });
  it('departamentos simples y sin área', () => {
    expect(area('317', 'X')).toBe('calidad');
    for (const d of ['319', '324']) expect(area(d, 'X')).toBe('produccion');
    for (const d of ['322', '328', '329']) expect(area(d, 'X')).toBe('almacen');
    expect(area('320', 'X')).toBe('mantenimiento');
    expect(area('321', 'X')).toBe('moldes');
    for (const d of ['318', '331', '461', '472', '474']) expect(area(d, 'X')).toBe('');
  });
  it('un departamento sin regla no tiene área ni regla', () => {
    expect(calcularAreaTE('999', 'X', REGLAS_AREA_TE_INICIALES)).toEqual({ areaId: '', regla: null });
  });
});

describe('lectura del reporte de nómina', () => {
  it('detecta el formato por los encabezados y mapea los campos', async () => {
    const filas = await leerEmpleados(await reporte(FILAS), new Map(), []);
    expect(filas).toHaveLength(FILAS.length);
    expect(filas.every(f => f.formato === 'nomina')).toBe(true);
    const corta = filas.find(f => f.datos.NOMINA === '11');
    expect(corta.datos.NOMBRE).toBe('MALDONADO SALVADOR');
    expect(corta.extra).toEqual({ depto: '317', descDepto: 'CALIDAD', turnoNomina: 'A', nivel: 'G1', fechaAlta: '2010-03-15' });
    const limpia = filas.find(f => f.datos.NOMINA === '7219');
    expect(limpia.datos.PUESTO).toBe('PRODUCTION OPERATOR');
    expect(limpia.extra.fechaAlta).toBe('2020-01-06');
    expect(filas.find(f => f.datos.NOMINA === '50001').extra.fechaAlta).toBe('2021-03-15');
  });

  it('encuentra los encabezados aunque no estén en la primera fila ni hoja', async () => {
    const filas = await leerEmpleados(await reporte(FILAS.slice(0, 2), { hoja: 'Reporte', filaEnc: 3 }), new Map(), []);
    expect(filas).toHaveLength(2);
  });

  it('sigue aceptando el formato propio', async () => {
    const wb = construirFormatoEmpleados([]);
    const ws = wb.getWorksheet('Empleados');
    ws.getRow(2).values = [undefined, '12345', 'GARCIA JUAN', 'OPERADOR'];
    const filas = await leerEmpleados(await wb.xlsx.writeBuffer(), new Map(), []);
    expect(filas).toHaveLength(1);
    expect(filas[0].formato).toBe('propio');
    expect(filas[0].extra).toBeNull();
  });

  it('un archivo sin formato conocido da el error de la hoja faltante', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Otra').addRow(['a', 'b']);
    await expect(leerEmpleados(await wb.xlsx.writeBuffer(), new Map(), [])).rejects.toThrow(/Empleados/);
  });
});

describe('comparación del reporte de nómina (área sale del puesto)', () => {
  const catalogo = PUESTOS_INICIALES;
  const areas = AREAS_INICIALES;
  // Puestos que no están en el catálogo: se resuelven como puesto nuevo en Administrativo o se omiten
  const decisiones = new Map([
    ['director', { tipo: 'nuevo', areaId: 'administrativo' }],
    ['tecnico', { tipo: 'alias', puestoId: 'maintenance-technician' }],
    ['machinist', { tipo: 'nuevo', areaId: 'moldes' }],
    ['asistente', { tipo: 'nuevo', areaId: 'administrativo' }],
    ['otro', { tipo: 'omitir' }],
  ]);
  const planDe = async (existentes = [], opciones = {}) =>
    compararEmpleados(await leerEmpleados(await reporte(FILAS), new Map()), existentes, { catalogo, areas, decisiones, ...opciones });

  it('sin decisiones, los puestos no reconocidos quedan pendientes y sus filas fuera del plan', async () => {
    const plan = await planDe([], { decisiones: new Map() });
    expect(plan.resolucion.pendientes.map(g => g.texto).sort()).toEqual(['ASISTENTE', 'DIRECTOR', 'MACHINIST', 'OTRO', 'TECNICO']);
    expect(plan.items.map(i => i.clave).sort()).toEqual(['50001', '50002', '50003', '7219']);
  });

  it('cuenta empleados por área, incluido Administrativo, y omite los omitidos', async () => {
    const plan = await planDe();
    expect(plan.resolucion.pendientes).toHaveLength(0);
    expect(plan.areas.porArea).toEqual({ administrativo: 2, produccion: 2, calidad: 1, almacen: 1, mantenimiento: 1, moldes: 1 });
    expect(plan.items.find(i => i.clave === '50007')).toBeUndefined(); // OTRO se omitió
  });

  it('el departamento no decide el área: 316 con RESINER o con inspector depende solo del puesto', async () => {
    const plan = await planDe();
    expect(plan.items.find(i => i.clave === '50001').areaId).toBe('calidad');
    expect(plan.items.find(i => i.clave === '7219').areaId).toBe('produccion');
    expect(plan.items.find(i => i.clave === '50003').areaId).toBe('almacen'); // depto 323 pero puesto de almacén
  });

  it('guarda puestoId, areaId y datos informativos en los empleados nuevos', async () => {
    const plan = await planDe();
    const it = plan.items.find(i => i.clave === '50001');
    expect(it.accion).toBe('crear');
    expect(it.datos).toMatchObject({
      nomina: '50001', puesto: 'QUALITY INSPECTOR', puestoId: 'quality-inspector', areaId: 'calidad', areaExcepcion: null,
      depto: '316', descDepto: 'MOLDEO', turnoNomina: 'C', nivel: 'G2', fechaAlta: '2021-03-15',
      rutaId: '', comunidadId: '', puntoReunionId: '',
    });
    expect(it.datos.areaTE).toBeUndefined();
  });

  it('marca la corrección automática (espacios y _x0002_) y la confirmada', async () => {
    const plan = await planDe();
    const auto = plan.items.find(i => i.clave === '7219').puestoCorreccion;
    expect(auto).toEqual({ antes: 'PRODUCTION OPERATOR      _x0002_', despues: 'PRODUCTION OPERATOR', tipo: 'automatica' });
    expect(plan.items.find(i => i.clave === '50004').puestoCorreccion).toMatchObject({ despues: 'MAINTENANCE TECHNICIAN', tipo: 'confirmada' });
    expect(plan.items.find(i => i.clave === '50002').puestoCorreccion).toBeNull();
  });

  it('las equivalencias confirmadas y los puestos nuevos salen en el plan para guardarse', async () => {
    const plan = await planDe();
    expect(plan.resolucion.aliasNuevos).toEqual([{ puestoId: 'maintenance-technician', alias: 'TECNICO' }]);
    expect(plan.resolucion.puestosNuevos.map(p => [p.id, p.areaId]).sort())
      .toEqual([['asistente', 'administrativo'], ['director', 'administrativo'], ['machinist', 'moldes']]);
  });

  it('no pisa ruta/comunidad/punto ni la excepción de área existentes', async () => {
    const existente = {
      id: '50001', nomina: '50001', nombre: 'LOPEZ ANA', puesto: 'QUALITY INSPECTOR', puestoId: 'quality-inspector',
      rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1', areaId: 'moldes', areaExcepcion: 'moldes',
      areaExcepcionMotivo: 'Prestada', activo: true,
    };
    const plan = await planDe([existente]);
    const it = plan.items.find(i => i.clave === '50001');
    expect(it.datos.areaId).toBeUndefined();
    expect(it.datos.areaExcepcion).toBeUndefined();
    expect(it.datos.rutaId).toBeUndefined();
    expect(it.areaId).toBe('moldes');
  });

  it('un empleado sin cambios queda "sin cambios" en la segunda importación', async () => {
    const primera = await planDe();
    const existentes = primera.items.map(i => ({ id: i.id, ...i.datos }));
    const segunda = await planDe(existentes);
    expect(segunda.conteos.sinCambios).toBe(primera.items.length);
  });

  it('sincronizar propone bajas de los que no aparecen, pero no de los omitidos ni pendientes', async () => {
    const existentes = [
      { id: '99999', nomina: '99999', nombre: 'YA NO ESTA', puesto: 'X', activo: true },
      { id: '50007', nomina: '50007', nombre: 'VEGA TOMAS', puesto: 'OTRO', activo: true },
    ];
    const plan = await planDe(existentes, { modo: 'sincronizar' });
    expect(plan.bajas.map(b => b.clave)).toEqual(['99999']);
  });
});
