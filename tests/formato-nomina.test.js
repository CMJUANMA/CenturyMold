// «Reportes de nómina»: semana ISO, qué solicitudes cuentan, la tabla por empleado y los ajustes. Datos ficticios, sin Firebase.
import { describe, expect, it } from 'vitest';
import {
  CASILLAS_AREA, CASILLA_POR_AREA, aplicarCambios, autorizadasDelPeriodo, cambioHoras, cambioQuitar, cambioReemplazar, casillaDeArea, estadoDeArea, etiquetaPeriodo,
  filasAutorizadas, filasDelArea, filasVigentes, horasValidas, idAjuste, motivoDeFila, moverSemana, nombreArchivoFormato, pendientesDelPeriodo, periodoLibre,
  problemaMotivo, resumenDelPeriodo, semanaDe, semanaDeClave, totalesDeFilas, ultimaSemanaCompleta, yaEstaEnTabla,
} from '../src/utils/formatoNomina.js';

describe('semana ISO 8601 (lunes a domingo)', () => {
  it('la semana 40 de 2026 es del 28/09 al 04/10 y la 43 del 19 al 25 de octubre', () => {
    const s40 = semanaDe('2026-09-30');
    expect([s40.clave, s40.semana, s40.desde, s40.hasta]).toEqual(['2026-40', 40, '2026-09-28', '2026-10-04']);
    const s43 = semanaDe('2026-10-22');
    expect([s43.clave, s43.desde, s43.hasta]).toEqual(['2026-43', '2026-10-19', '2026-10-25']);
    expect(s43.dias).toHaveLength(7);
    expect(s43.dias[0]).toBe('2026-10-19');
    expect(s43.dias[6]).toBe('2026-10-25');
  });
  it('se muestra como «Semana 43 · 19–25 oct 2026» y cuando cruza mes o año lo dice completo', () => {
    expect(etiquetaPeriodo(semanaDe('2026-10-22'))).toBe('Semana 43 · 19–25 oct 2026');
    expect(etiquetaPeriodo(semanaDe('2026-09-30'))).toBe('Semana 40 · 28 sep–4 oct 2026');
    expect(etiquetaPeriodo(semanaDe('2025-12-31'))).toBe('Semana 1 · 29 dic 2025–4 ene 2026');
  });
  it('los días de enero que son de la última semana del año anterior (53) o de la 1 del año que entra', () => {
    expect(semanaDe('2027-01-01').clave).toBe('2026-53');
    expect(semanaDe('2026-01-01').clave).toBe('2026-01');
    expect(semanaDe('2024-12-30').clave).toBe('2025-01');
  });
  it('por defecto es la última semana COMPLETA (la anterior a la de hoy) y las flechas la mueven', () => {
    expect(ultimaSemanaCompleta('2026-10-22').clave).toBe('2026-42');
    expect(ultimaSemanaCompleta('2026-10-26').clave).toBe('2026-43'); // lunes: la semana pasada ya terminó
    expect(ultimaSemanaCompleta('2026-10-25').clave).toBe('2026-42'); // domingo: la de hoy aún no termina
    expect(moverSemana(semanaDe('2026-10-22'), 1).clave).toBe('2026-44');
    expect(moverSemana(semanaDe('2026-01-05'), -1).clave).toBe('2026-01');
  });
  it('la clave se convierte de vuelta en la misma semana', () => {
    expect(semanaDeClave('2026-43').desde).toBe('2026-10-19');
    expect(semanaDeClave('2026-53').desde).toBe('2026-12-28');
    expect(semanaDeClave('2025-53')).toBeNull();
    expect(semanaDeClave('basura')).toBeNull();
  });
  it('un rango libre de hasta 7 días llena las columnas del día de la semana que toca', () => {
    const p = periodoLibre('2026-10-21', '2026-10-24');
    expect(p.dias).toEqual([null, null, '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', null]);
    expect(etiquetaPeriodo(p)).toBe('21–24 oct 2026');
    expect(periodoLibre('2026-10-21', '2026-10-29')).toBeNull();
    expect(periodoLibre('2026-10-25', '2026-10-21')).toBeNull();
    expect(idAjuste(semanaDe('2026-10-22'), 'moldes')).toBe('2026-43_moldes');
    expect(idAjuste(p, 'moldes')).toBe('r20261021-20261024_moldes');
  });
});

describe('qué cuenta de la semana', () => {
  const s = semanaDe('2026-10-22');
  const t = (id, estatus, fechaTE, areaId = 'moldes') => ({ id, estatus, fechaTE, areaId, areaNombre: areaId });
  const planta = [
    t('a', 'autorizada', '2026-10-19'), t('b', 'procesada', '2026-10-25'), t('c', 'autorizada', '2026-10-26'), t('d', 'autorizada', '2026-10-18'),
    t('e', 'pendiente_aut2', '2026-10-20'), t('f', 'devuelta', '2026-10-21', 'calidad'), t('g', 'pendiente_aut1', '2026-10-21', 'calidad'),
    t('h', 'cancelada', '2026-10-21'), t('i', 'borrador', '2026-10-21'),
  ];
  it('solo lo autorizado por Aut. 2 (autorizada o procesada) cuya fecha cae de lunes a domingo', () => {
    expect(autorizadasDelPeriodo(planta, s).map(x => x.id)).toEqual(['a', 'b']);
  });
  it('avisa cuántas siguen pendientes o devueltas y de qué áreas', () => {
    const p = pendientesDelPeriodo(planta, s, new Map([['moldes', 'Moldes'], ['calidad', 'Calidad']]));
    expect(p.total).toBe(3);
    expect(p.porArea).toEqual([
      { areaId: 'calidad', nombre: 'Calidad', pendientes: 1, devueltas: 1 },
      { areaId: 'moldes', nombre: 'Moldes', pendientes: 1, devueltas: 0 },
    ]);
    expect(pendientesDelPeriodo([], s).total).toBe(0);
  });
});

describe('la tabla por empleado', () => {
  const s = semanaDe('2026-10-22');
  const emp = (nomina, nombre, entrada, salida) => ({ nomina, nombre, puesto: 'Op', horaEntrada: entrada, horaSalida: salida });
  const sol = (id, fechaTE, motivo, empleados, extra = {}) => ({ id, fechaTE, motivo, empleados, ...extra });
  const solicitudes = [
    sol('1', '2026-10-24', 'Producción', [emp('100', 'ANA', '7:00', '16:00'), emp('200', 'BETO', '7:00', '16:00')]),
    sol('2', '2026-10-24', 'Producción', [emp('100', 'ANA', '16:00', '0:00')]), // mismo día: se suman
    sol('3', '2026-10-25', 'Otro', [emp('100', 'ANA', '7:00', '11:00')], { motivoOtro: 'Inventario anual' }),
    sol('4', '2026-11-30', 'Producción', [emp('100', 'ANA', '7:00', '16:00')]), // fuera de la semana
  ];
  const base = filasAutorizadas(solicitudes, s);

  it('suma las horas del mismo día, ordena por nombre y deja fuera lo de otra semana', () => {
    expect(base.map(f => f.nomina)).toEqual(['100', '200']);
    expect(base[0].horas).toEqual({ '2026-10-24': 17, '2026-10-25': 4 });
    expect(base[1].horas).toEqual({ '2026-10-24': 9 });
  });
  it('subtotal y motivo: uno solo si no cambia en la semana; «Sáb: …; Dom: …» si cambia', () => {
    const filas = aplicarCambios(base, [], s);
    expect(filas[0].subtotal).toBe(21);
    expect(filas[0].motivo).toBe('Sáb: Producción; Dom: Otro: Inventario anual');
    expect(filas[1].motivo).toBe('Producción');
    expect(motivoDeFila({ horas: {}, motivos: {} }, s)).toBe('');
  });
  it('quitar a un empleado lo saca del formato y de los totales, sin perder lo autorizado', () => {
    const filas = aplicarCambios(base, [cambioQuitar(base[1], 'No asistió')], s);
    expect(filas[1].quitado).toBe(true);
    expect(filasVigentes(filas).map(f => f.nomina)).toEqual(['100']);
    expect(totalesDeFilas(filas, s)).toEqual({ empleados: 1, horas: 21, porDia: [0, 0, 0, 0, 0, 17, 4] });
    expect(filas[1].original).toEqual({ '2026-10-24': 9 });
  });
  it('reemplazar cambia a la persona y conserva sus horas; el renglón recuerda quién estaba', () => {
    const filas = aplicarCambios(base, [cambioReemplazar(base[1], { nomina: 300, nombre: 'CARLOS' }, 'Cambio de persona')], s);
    expect(filas[1]).toMatchObject({ nomina: '300', nombre: 'CARLOS', clave: '200', reemplazoDe: { nomina: '200', nombre: 'BETO' } });
    expect(filas[1].subtotal).toBe(9);
    expect(yaEstaEnTabla(filas, '300')).toBe(true);
    expect(yaEstaEnTabla(filas, '200')).toBe(false);
  });
  it('corregir las horas de un día muestra lo autorizado y lo ajustado («9 → 5»), y con 0 se vacía el día', () => {
    const filas = aplicarCambios(base, [cambioHoras(base[1], '2026-10-24', 5, 'Salió antes')], s);
    expect(filas[1].original['2026-10-24']).toBe(9);
    expect(filas[1].horas['2026-10-24']).toBe(5);
    expect(filas[1].editados).toEqual(['2026-10-24']);
    expect(filas[1].subtotalOriginal).toBe(9);
    expect(filas[1].subtotal).toBe(5);
    const cero = aplicarCambios(base, [cambioHoras(base[1], '2026-10-24', 0, 'No vino ese día')], s);
    expect(cero[1].horas).toEqual({});
  });
  it('los cambios se aplican en orden y un cambio de un renglón que ya no existe se ignora', () => {
    const filas = aplicarCambios(base, [cambioHoras(base[1], '2026-10-24', 5, 'a'), cambioHoras(base[1], '2026-10-24', 6, 'b'), { tipo: 'quitar', clave: 'zzz' }], s);
    expect(filas[1].horas['2026-10-24']).toBe(6);
    expect(filas).toHaveLength(2);
  });
  it('«Deshacer ajustes» = aplicar una lista vacía: vuelve a lo autorizado', () => {
    const ajustadas = aplicarCambios(base, [cambioQuitar(base[0], 'x1x')], s);
    expect(ajustadas[0].quitado).toBe(true);
    expect(aplicarCambios(base, [], s)[0].quitado).toBe(false);
  });
  it('un área firmada se imprime con la copia guardada al firmar, no con lo que cambie después en las solicitudes', () => {
    const copia = [{ clave: '100', nomina: '100', nombre: 'ANA', horas: { '2026-10-24': 1 }, original: { '2026-10-24': 17 }, motivos: {}, quitado: false, reemplazoDe: null, subtotal: 1, motivo: 'x' }];
    expect(filasDelArea({ solicitudes, periodo: s, ajuste: { firmada: true, renglones: copia } })[0].subtotal).toBe(1);
    expect(filasDelArea({ solicitudes, periodo: s, ajuste: { firmada: false, renglones: copia, cambios: [] } })[0].subtotal).toBe(21);
    expect(filasDelArea({ solicitudes, periodo: s, ajuste: null })).toHaveLength(2);
  });
  it('estado del área: sin revisar · ajustada · firmada', () => {
    expect(estadoDeArea(null)).toBe('sin_revisar');
    expect(estadoDeArea({ cambios: [] })).toBe('sin_revisar');
    expect(estadoDeArea({ cambios: [{}] })).toBe('ajustada');
    expect(estadoDeArea({ cambios: [], firmada: true })).toBe('firmada');
  });
});

describe('validaciones', () => {
  it('cada cambio pide un motivo corto', () => {
    expect(problemaMotivo('')).toMatch(/motivo/);
    expect(problemaMotivo('  a ')).toMatch(/motivo/);
    expect(problemaMotivo('No asistió')).toBeNull();
    expect(problemaMotivo('x'.repeat(121))).toMatch(/largo/);
  });
  it('las horas de un día van de 0 a 24 con a lo más dos decimales', () => {
    for (const ok of [0, 4, '8.5', 24, 7.25]) expect(horasValidas(ok), String(ok)).toBe(true);
    for (const mal of ['', 'a', -1, 25, 1.234, NaN]) expect(horasValidas(mal), String(mal)).toBe(false);
  });
});

describe('mapeo de áreas a las casillas del formato', () => {
  it('cada área de la app marca su casilla y lo desconocido cae en «Otro»', () => {
    expect(casillaDeArea('produccion')).toBe('Producción/Manufactura');
    expect(casillaDeArea('moldes')).toBe('Taller Moldes');
    expect(casillaDeArea('almacen')).toBe('Materiales/Logística');
    expect(casillaDeArea('administrativo')).toBe('Otro');
    expect(casillaDeArea('inventada')).toBe('Otro');
    for (const c of Object.values(CASILLA_POR_AREA)) expect(CASILLAS_AREA).toContain(c);
  });
});

describe('resumen de «todas las áreas»', () => {
  const s = semanaDe('2026-10-22');
  const fila = (nomina, nombre, horas, motivos, subtotal) => ({ nomina, nombre, horas, motivos, subtotal, quitado: false });
  const areas = [
    { areaId: 'moldes', nombre: 'Moldes', filas: [fila('1', 'ANA', { '2026-10-24': 9 }, { '2026-10-24': ['Producción'] }, 9), { ...fila('2', 'BETO', { '2026-10-24': 8 }, {}, 8), quitado: true }] },
    { areaId: 'calidad', nombre: 'Calidad', filas: [fila('3', 'LUZ', { '2026-10-24': 3 }, { '2026-10-24': ['Inventario'] }, 3)] },
  ];
  const r = resumenDelPeriodo(areas, s);
  it('horas por área y por empleado, sin contar a los quitados', () => {
    expect(r.porArea).toEqual([['Moldes', 1, 9], ['Calidad', 1, 3]]);
    expect(r.porEmpleado).toEqual([['Moldes', '1', 'ANA', 9], ['Calidad', '3', 'LUZ', 3]]);
    expect(r.total).toEqual({ empleados: 2, horas: 12 });
  });
  it('horas por motivo con su porcentaje', () => {
    expect(r.porMotivo).toEqual([['Producción', 9, 75], ['Inventario', 3, 25]]);
  });
});

describe('nombre del archivo', () => {
  it('por semana y área, o de todas las áreas', () => {
    const s = semanaDe('2026-10-22');
    expect(nombreArchivoFormato(s, 'Producción')).toBe('FormatoTE_Semana43_2026_Produccion.xlsx');
    expect(nombreArchivoFormato(s)).toBe('FormatoTE_Semana43_2026_TodasLasAreas.xlsx');
    expect(nombreArchivoFormato(periodoLibre('2026-10-21', '2026-10-24'))).toBe('FormatoTE_2026-10-21_a_2026-10-24_TodasLasAreas.xlsx');
  });
});
