// Revisión de nómina a pantalla completa: el borrador de cambios (horas por celda, quitar, restaurar, agregar empleados), sus validaciones, lo que se guarda
// con UNA sola razón y la URL del periodo. Datos ficticios, sin Firebase.
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { construirLibroFormatoNomina } from '../src/utils/exportarFormatoNomina.js';
import {
  TIPOS_CAMBIO, agregadosSinHoras, aplicarCambios, cambioAgregar, cambioHoras, cambioMotivo, cambioQuitar, cambioReemplazar, conHoras, conRenglonQuitado, conRenglonRestaurado,
  contarSinGuardar, desgloseFila, esCambioNuevo, estadoDeArea, filasDelArea, filasVigentes, fueAjustada, nominasRepetidas, periodoDeClave, problemaEmpleadoManual, renglonParaGuardar,
  resumenDeGuardado, resumenDelPeriodo, sellarCambios, semanaDe, totalesDeFilas, yaEstaEnTabla,
} from '../src/utils/formatoNomina.js';
import { rutaRevisarNomina, rutaReportesNomina } from '../src/rutas.js';

const s = semanaDe('2026-10-14'); // semana 42: 12–18 oct
const LUN = '2026-10-12', MAR = '2026-10-13', MIE = '2026-10-14';
const fila = (nomina, nombre, horas = {}, extra = {}) => ({
  clave: String(nomina), nomina: String(nomina), nombre, puesto: 'MOLDEADOR', horas, motivos: { [LUN]: ['Producción'] }, numeros: {}, detalle: {}, ...extra,
});
const base = () => [fila(100, 'ACOSTA MARTINEZ GUADALUPE ARACELI', { [LUN]: 8, [MAR]: 4 }), fila(101, 'GARCIA LOPEZ JOSE', { [MAR]: 8 })];
const produccion = { nombre: 'Producción', numero: '', tipoNumero: '', comentario: '', detalle: '' };
const cargoPO = { nombre: 'Cargo a P.O.', numero: '4551099797', tipoNumero: 'po', comentario: '', detalle: '' };
const celda = (filas, clave, dia) => filas.find(f => f.clave === clave).horas[dia];

describe('el periodo en la URL', () => {
  it('la clave de una semana o de un rango libre vuelve a ser su periodo; lo demás no sirve', () => {
    expect(periodoDeClave('2026-42').desde).toBe('2026-10-12');
    const r = periodoDeClave('r20261019-20261023');
    expect([r.tipo, r.desde, r.hasta]).toEqual(['rango', '2026-10-19', '2026-10-23']);
    expect(periodoDeClave('r20261019-20261030')).toBeNull();
    expect(periodoDeClave('2026-99')).toBeNull();
    expect(periodoDeClave('hola')).toBeNull();
    expect(periodoDeClave(null)).toBeNull();
  });
  it('las rutas llevan la clave del periodo y el área (y volver a la semana regresa a la misma semana)', () => {
    expect(rutaRevisarNomina('2026-42', 'moldes')).toBe('/nomina/semana/2026-42/moldes');
    expect(rutaReportesNomina('2026-42')).toBe('/nomina/reportes?periodo=2026-42');
    expect(rutaReportesNomina()).toBe('/nomina/reportes');
    expect(periodoDeClave(decodeURIComponent(rutaRevisarNomina('r20261019-20261023', 'moldes').split('/')[3])).tipo).toBe('rango');
  });
});

describe('editar una celda de horas (el borrador)', () => {
  it('cambiar una celda deja un cambio nuevo, sin razón todavía, con lo autorizado como «antes»', () => {
    const t = conHoras(base(), [], s, '100', LUN, 9.5);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ tipo: 'horas', clave: '100', dia: LUN, antes: 8, horas: 9.5, motivo: '' });
    expect(esCambioNuevo(t[0])).toBe(true);
    expect(celda(aplicarCambios(base(), t, s), '100', LUN)).toBe(9.5);
  });
  it('volver a editar la misma celda reemplaza el cambio (no se acumulan); si queda como estaba, no queda ninguno', () => {
    let t = conHoras(base(), [], s, '100', LUN, 9.5);
    t = conHoras(base(), t, s, '100', LUN, 10);
    expect(t).toHaveLength(1);
    expect(t[0].horas).toBe(10);
    t = conHoras(base(), t, s, '100', LUN, 8);
    expect(t).toEqual([]);
  });
  it('vacío (0) = sin horas; admite medios', () => {
    const t = conHoras(base(), conHoras(base(), [], s, '100', LUN, 0), s, '101', MAR, 0.5);
    const filas = aplicarCambios(base(), t, s);
    expect(celda(filas, '100', LUN)).toBeUndefined();
    expect(celda(filas, '101', MAR)).toBe(0.5);
    expect(totalesDeFilas(filas, s).horas).toBe(4.5);
  });
  it('una celda cambiada se marca solo mientras difiere de lo autorizado', () => {
    const filas = aplicarCambios(base(), conHoras(base(), [], s, '100', LUN, 9), s);
    expect(filas[0].editados).toEqual([LUN]);
    expect(fueAjustada(filas[0])).toBe(true);
    // un cambio ya guardado cuyo valor vuelve a ser el autorizado ya no se marca
    const guardado = { ...cambioHoras(base()[0], LUN, 8, 'Se regresó'), antes: 9 };
    expect(aplicarCambios(base(), [guardado], s)[0].editados).toEqual([]);
  });
  it('una celda sobre un renglón que ya no existe no rompe nada', () => {
    expect(conHoras(base(), [], s, 'no-existe', LUN, 4)).toEqual([]);
  });
});

describe('contar lo que falta por guardar y sellarlo con UNA sola razón', () => {
  const guardado = { ...cambioHoras(base()[0], MAR, 5, 'Salió antes'), antes: 4 };
  it('sin borrador no hay cambios sin guardar; los ya guardados no cuentan', () => {
    expect(contarSinGuardar(null, [guardado])).toBe(0);
    expect(contarSinGuardar([guardado], [guardado])).toBe(0);
  });
  it('cuenta los nuevos y los guardados que se quitaron del borrador', () => {
    const t = conHoras(base(), [guardado], s, '101', MAR, 6);
    expect(contarSinGuardar(t, [guardado])).toBe(1);
    expect(contarSinGuardar(conRenglonRestaurado(t, '100'), [guardado])).toBe(2); // 1 nuevo + 1 guardado que se borró
  });
  it('al guardar, todos los cambios nuevos llevan la misma razón y los guardados conservan la suya', () => {
    let t = [guardado];
    t = conHoras(base(), t, s, '100', LUN, 9);
    t = conHoras(base(), t, s, '101', MAR, 6);
    t = conRenglonQuitado(t, aplicarCambios(base(), t, s)[1]);
    const sellados = sellarCambios(t, '  Corrección de asistencia ');
    expect(sellados.map(c => c.motivo)).toEqual(['Salió antes', 'Corrección de asistencia', 'Corrección de asistencia', 'Corrección de asistencia']);
    expect(sellados.some(esCambioNuevo)).toBe(false);
    expect(estadoDeArea({ cambios: sellados })).toBe('ajustada');
  });
  it('el resumen para la bitácora dice qué cambió (tipo, nómina, día, antes y después) y cuántos son', () => {
    const t = conHoras(base(), [], s, '100', LUN, 9);
    const r = resumenDeGuardado(conRenglonQuitado(t, aplicarCambios(base(), t, s)[1]), []);
    expect(r.total).toBe(2);
    expect(r.cambios[0]).toEqual({ tipo: 'horas', nomina: '100', dia: LUN, antes: 8, horas: 9 });
    expect(r.cambios[1]).toEqual({ tipo: 'quitar', nomina: '101' });
  });
  it('el resumen anota lo que se restauró y no pasa de 80 renglones (pero cuenta el total)', () => {
    expect(resumenDeGuardado(conRenglonRestaurado([guardado], '100'), [guardado]).cambios).toEqual([{ tipo: 'restaurar', nomina: '100', deshace: 'horas' }]);
    const muchos = Array.from({ length: 150 }, (_, i) => ({ ...cambioHoras(base()[0], LUN, i % 24, ''), dia: `2026-10-${String(1 + (i % 28)).padStart(2, '0')}`, horas: i % 24 + 1 }));
    const r = resumenDeGuardado(muchos, []);
    expect([r.total, r.cambios.length]).toEqual([150, 80]);
  });
});

describe('quitar y restaurar un renglón', () => {
  it('quitar un renglón autorizado lo marca (no sale en totales); restaurarlo borra todos sus cambios', () => {
    let t = conHoras(base(), [], s, '100', LUN, 9);
    t = conRenglonQuitado(t, aplicarCambios(base(), t, s)[0]);
    const filas = aplicarCambios(base(), t, s);
    expect(filas[0].quitado).toBe(true);
    expect(totalesDeFilas(filas, s).empleados).toBe(1);
    const restaurado = aplicarCambios(base(), conRenglonRestaurado(t, '100'), s);
    expect(restaurado[0].quitado).toBe(false);
    expect(celda(restaurado, '100', LUN)).toBe(8);
    expect(fueAjustada(restaurado[0])).toBe(false);
  });
  it('quitar dos veces no duplica el cambio', () => {
    let t = conRenglonQuitado([], base()[0]);
    t = conRenglonQuitado(t, base()[0]);
    expect(t.filter(c => c.tipo === TIPOS_CAMBIO.QUITAR)).toHaveLength(1);
  });
});

describe('agregar a alguien que no venía en las solicitudes', () => {
  const nuevo = (extra = {}) => cambioAgregar({ nomina: 300, nombre: 'PEREZ LOPEZ JUAN', puesto: 'MOLDEADOR' }, cargoPO, extra);

  it('el renglón nace «Agregado», sin horas, con su motivo y P.O./TB, y sin lo autorizado', () => {
    const filas = aplicarCambios(base(), [nuevo()], s);
    expect(filas).toHaveLength(3);
    const f = filas[2];
    expect(f).toMatchObject({ clave: '+300', nomina: '300', nombre: 'PEREZ LOPEZ JUAN', agregado: true, enPadron: true, subtotal: 0, quitado: false, editados: [] });
    expect(f.motivo).toBe('Cargo a P.O.');
    expect(f.numero).toBe('4551099797');
    expect(fueAjustada(f)).toBe(true);
    expect(esCambioNuevo(nuevo())).toBe(true);
  });
  it('sus horas se capturan por día como las de cualquiera y suman a los totales', () => {
    let t = [nuevo()];
    t = conHoras(base(), t, s, '+300', MAR, 4);
    t = conHoras(base(), t, s, '+300', MIE, 4.5);
    const filas = aplicarCambios(base(), t, s);
    expect(filas[2].subtotal).toBe(8.5);
    expect(filas[2].editados).toEqual([]); // no hay «autorizado» con qué compararlo
    expect(totalesDeFilas(filas, s)).toMatchObject({ empleados: 3, horas: 20 + 8.5 });
  });
  it('capturado a mano: queda marcado como fuera del padrón', () => {
    const f = aplicarCambios(base(), [nuevo({ enPadron: false })], s)[2];
    expect(f.enPadron).toBe(false);
    expect(renglonParaGuardar(f)).toMatchObject({ agregado: true, enPadron: false, clave: '+300' });
  });
  it('no se permite el mismo empleado dos veces en el área y semana', () => {
    const repetido = cambioAgregar({ nomina: 100, nombre: 'ACOSTA MARTINEZ GUADALUPE ARACELI' }, produccion);
    expect(nominasRepetidas(aplicarCambios(base(), [repetido], s))).toEqual(['100']);
    expect(nominasRepetidas(aplicarCambios(base(), [nuevo()], s))).toEqual([]);
    expect(yaEstaEnTabla(aplicarCambios(base(), [nuevo()], s), '300')).toBe(true);
    // si el autorizado se quitó, sí se puede agregar a esa misma persona (el quitado no cuenta)
    const quitadoYAgregado = aplicarCambios(base(), [cambioQuitar(base()[0], 'No asistió'), repetido], s);
    expect(nominasRepetidas(quitadoYAgregado)).toEqual([]);
  });
  it('un agregado sin horas se detecta (no se guarda así)', () => {
    expect(agregadosSinHoras(aplicarCambios(base(), [nuevo()], s)).map(f => f.nomina)).toEqual(['300']);
    expect(agregadosSinHoras(aplicarCambios(base(), conHoras(base(), [nuevo()], s, '+300', MAR, 4), s))).toEqual([]);
  });
  it('quitar un agregado lo borra por completo, con sus horas; restaurar un renglón autorizado no toca a los demás', () => {
    let t = conHoras(base(), [nuevo()], s, '+300', MAR, 4);
    const f = aplicarCambios(base(), t, s)[2];
    t = conRenglonQuitado(t, f);
    expect(t).toEqual([]);
    expect(aplicarCambios(base(), t, s)).toHaveLength(2);
  });
  it('se puede cambiar el motivo y P.O./TB de un agregado', () => {
    const t = [nuevo(), cambioMotivo(aplicarCambios(base(), [nuevo()], s)[2], produccion, '')];
    const f = aplicarCambios(base(), t, s)[2];
    expect([f.motivo, f.numero]).toEqual(['Producción', '']);
  });
  it('entra al desglose por motivo y por P.O./TB de la hoja Resumen como cualquier renglón', () => {
    const filas = aplicarCambios(base(), conHoras(base(), [nuevo()], s, '+300', MAR, 4), s);
    expect(desgloseFila(filas[2], s)).toEqual([{ nombre: 'Cargo a P.O.', numero: '4551099797', tipo: 'po', horas: 4 }]);
    const r = resumenDelPeriodo([{ areaId: 'moldes', nombre: 'Moldes', filas }], s);
    expect(r.total).toEqual({ empleados: 3, horas: 20 + 4 });
    expect(r.porEmpleado.map(x => x[1])).toContain('300');
    expect(r.porNumero[0].slice(0, 3)).toEqual(['P.O. 4551099797', 4, 1]);
    expect(r.porMotivo.find(m => m[0] === 'Cargo a P.O.')[1]).toBe(4);
  });
  it('sale en el Excel del área con su nómina, nombre, horas y P.O./TB', () => {
    const filas = aplicarCambios(base(), conHoras(base(), [nuevo()], s, '+300', MAR, 4), s);
    const wb = construirLibroFormatoNomina({ ExcelJS, periodo: s, areas: [{ areaId: 'moldes', nombre: 'Moldes', filas }], fecha: new Date(2026, 9, 19) });
    const ws = wb.getWorksheet('Moldes');
    const fr = [...Array(40).keys()].map(i => ws.getRow(i + 1)).find(r => r.getCell('C').value === 'PEREZ LOPEZ JUAN');
    expect(fr).toBeTruthy();
    expect(fr.getCell('B').value).toBe('300');
    expect(fr.getCell('E').value).toBe(4); // martes
    expect(String(fr.getCell('L').value)).toContain('4551099797');
  });
  it('una vez firmada el área, la copia guardada conserva al agregado', () => {
    const filas = aplicarCambios(base(), conHoras(base(), [nuevo()], s, '+300', MAR, 4), s);
    const ajuste = { firmada: true, renglones: filas.map(renglonParaGuardar) };
    const impresas = filasDelArea({ solicitudes: [], periodo: s, ajuste });
    expect(filasVigentes(impresas).map(f => f.nomina)).toEqual(['100', '101', '300']);
    expect(impresas[2].agregado).toBe(true);
  });
  it('agregar no toca las solicitudes: lo autorizado sigue igual en `original`', () => {
    const f = aplicarCambios(base(), [nuevo()], s);
    expect(f[0].original).toEqual({ [LUN]: 8, [MAR]: 4 });
    expect(f[2].original).toEqual({});
  });
});

describe('capturar a mano a alguien que no está en el padrón', () => {
  it('la nómina son solo números (hasta 10) y el nombre trae al menos 5 letras', () => {
    expect(problemaEmpleadoManual({ nomina: '300', nombre: 'PEREZ LOPEZ JUAN' })).toBeNull();
    expect(problemaEmpleadoManual({ nomina: '', nombre: 'PEREZ LOPEZ JUAN' })).toMatch(/nómina/);
    expect(problemaEmpleadoManual({ nomina: '12a', nombre: 'PEREZ LOPEZ JUAN' })).toMatch(/nómina/);
    expect(problemaEmpleadoManual({ nomina: '12345678901', nombre: 'PEREZ LOPEZ JUAN' })).toMatch(/nómina/);
    expect(problemaEmpleadoManual({ nomina: '300', nombre: ' Pe ' })).toMatch(/nombre/);
    expect(problemaEmpleadoManual({ nomina: '300', nombre: 'X'.repeat(81) })).toMatch(/largo/);
  });
});

describe('reemplazar sigue funcionando con el borrador', () => {
  it('reemplazar deja un cambio nuevo y respeta que no se repita la persona', () => {
    const t = [cambioReemplazar(base()[0], { nomina: '500', nombre: 'LEAL CORTES ISABEL' }, '')];
    const filas = aplicarCambios(base(), t, s);
    expect(filas[0]).toMatchObject({ nomina: '500', nombre: 'LEAL CORTES ISABEL' });
    expect(filas[0].reemplazoDe.nomina).toBe('100');
    expect(contarSinGuardar(t, [])).toBe(1);
  });
});
