// Captura de tiempo extra: horas, validaciones, resumen y lotes. Datos ficticios.
import { describe, expect, it } from 'vitest';
import {
  HORAS_ENTRADA_TE, HORAS_SALIDA_TE, LOTE_EMPLEADOS, PESTANAS_TE, aplicarA, calcularHoras, docAEmpleado, empleadoADoc, empleadoDesdePadron,
  datosTE, estatusAlEnviar, folioDe, motivoTexto, nivelEnTexto, nuevoIdBorrador, problemasDeEnvio, resumenTE, transporteCompleto, trozos,
  MIN_MOTIVO_DEVOLUCION, MSG_YA_RESPONDIDA, esPropia, fechaVencida, filtrarSolicitudes, firmaTexto, haceTiempo, masAntiguasPrimero, totalesDe,
} from '../src/utils/tiempoExtra.js';

const emp = (nomina, extra = {}) => ({
  nomina, nombre: `Empleado ${nomina}`, puesto: 'X', turnoNomina: 'A', horaEntrada: '16:00', horaSalida: '0:00', alimentos: false, transporte: true,
  rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1', necesitaConfirmar: false, confirmada: false, ...extra,
});

describe('horas', () => {
  it('los bloques de las rutas', () => {
    expect(HORAS_ENTRADA_TE).toEqual(['7:00', '16:00', '19:00', '0:00']);
    expect(HORAS_SALIDA_TE).toEqual(['16:00', '19:00', '0:00', '7:00']);
  });
  it('calcula las horas, incluso cruzando la medianoche', () => {
    expect(calcularHoras('7:00', '16:00')).toBe(9);
    expect(calcularHoras('16:00', '0:00')).toBe(8);
    expect(calcularHoras('19:00', '7:00')).toBe(12);
    expect(calcularHoras('0:00', '7:00')).toBe(7);
    expect(calcularHoras('16:00', '7:00')).toBe(15);
  });
  it('0 si falta una hora o entrada = salida', () => {
    expect(calcularHoras('', '16:00')).toBe(0);
    expect(calcularHoras('7:00', '7:00')).toBe(0);
    expect(calcularHoras('raro', '7:00')).toBe(0);
  });
});

describe('ids, folios y lotes', () => {
  it('el id del borrador cumple el patrón de las reglas', () => {
    for (let i = 0; i < 200; i++) expect(nuevoIdBorrador()).toMatch(/^BR-[A-Za-z0-9]{10,}$/);
    expect(new Set(Array.from({ length: 500 }, () => nuevoIdBorrador())).size).toBe(500);
  });
  it('el folio tiene el formato TE-AAAA-NNNN', () => {
    expect(folioDe(2026, 1)).toBe('TE-2026-0001');
    expect(folioDe(2026, 12345)).toBe('TE-2026-12345');
  });
  it('lotes de 10 empleados', () => {
    expect(LOTE_EMPLEADOS).toBe(10);
    expect(trozos(Array.from({ length: 35 }, (_, i) => i)).map(t => t.length)).toEqual([10, 10, 10, 5]);
    expect(trozos([])).toEqual([]);
  });
});

describe('empleado ↔ documento', () => {
  it('el documento solo trae campos permitidos y las horas calculadas', () => {
    const d = empleadoADoc(emp('1', { alimentos: true }));
    expect(Object.keys(d).sort()).toEqual(['comunidadId', 'horaEntrada', 'horaSalida', 'horas', 'nombre', 'puesto', 'puntoReunionId', 'requiereAlimentos', 'requiereTransporte', 'rutaId', 'transporteLlegada', 'transporteSalida', 'turnoNomina'].sort());
    expect(d).toMatchObject({ horas: 8, requiereAlimentos: true, requiereTransporte: true, rutaId: 'r1' });
  });
  it('sin transporte no guarda ruta', () => {
    expect(empleadoADoc(emp('1', { transporte: false }))).toMatchObject({ requiereTransporte: false, rutaId: '', comunidadId: '', puntoReunionId: '' });
  });
  it('del padrón: transporte marcado por defecto; ruta completa pide confirmar', () => {
    const e = empleadoDesdePadron({ nomina: 5, nombre: 'ANA', puesto: 'OP', turnoNomina: 'B' }, { rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1' });
    expect(e).toMatchObject({ nomina: '5', transporte: true, necesitaConfirmar: true, confirmada: false, turnoNomina: 'B' });
    expect(empleadoDesdePadron({ nomina: 6, nombre: 'LUIS' }, {}).necesitaConfirmar).toBe(false);
  });
  it('al reabrir un borrador, lo guardado ya está confirmado', () => {
    expect(docAEmpleado('1', empleadoADoc(emp('1')))).toMatchObject({ nomina: '1', horaEntrada: '16:00', confirmada: true, transporte: true });
  });
});

describe('motivo "Otro" (¿Cuál?)', () => {
  const base = { areaId: 'mantenimiento', fechaTE: '2026-10-20', comentario: 'Pedido urgente del cliente', hoy: '2026-10-14', empleados: [emp('1')] };
  const errores = (p) => problemasDeEnvio({ ...base, ...p }).filter(x => x.nivel === 'error').map(x => x.mensaje);
  it('con Otro, ¿Cuál? es obligatorio: de 3 a 60 caracteres (sin contar espacios de los lados)', () => {
    expect(errores({ motivo: 'Otro' })).toHaveLength(1);
    expect(errores({ motivo: 'Otro', motivoOtro: '  ab  ' })).toHaveLength(1);
    expect(errores({ motivo: 'Otro', motivoOtro: 'abc' })).toEqual([]);
    expect(errores({ motivo: 'Otro', motivoOtro: 'x'.repeat(60) })).toEqual([]);
    expect(errores({ motivo: 'Otro', motivoOtro: 'x'.repeat(61) })).toHaveLength(1);
  });
  it('con otro motivo no se pide', () => {
    expect(errores({ motivo: 'Calidad', motivoOtro: '' })).toEqual([]);
  });
  it('datosTE guarda motivoOtro recortado solo con Otro; si cambia de motivo se limpia', () => {
    expect(datosTE({ empleados: [emp('1')], motivo: 'Otro', motivoOtro: '  Visita de cliente ' }).motivoOtro).toBe('Visita de cliente');
    expect(datosTE({ empleados: [emp('1')], motivo: 'Calidad', motivoOtro: 'Visita de cliente' }).motivoOtro).toBe('');
  });
  it('se muestra como "Otro: lo que escribió"; los demás motivos, tal cual', () => {
    expect(motivoTexto({ motivo: 'Otro', motivoOtro: 'Visita de cliente' })).toBe('Otro: Visita de cliente');
    expect(motivoTexto({ motivo: 'Otro' })).toBe('Otro');
    expect(motivoTexto({ motivo: 'Calidad', motivoOtro: 'sobra' })).toBe('Calidad');
    expect(motivoTexto({})).toBe('');
  });
});

describe('validaciones de envío', () => {
  const base = { areaId: 'mantenimiento', fechaTE: '2026-10-20', motivo: 'Producción', comentario: 'Pedido urgente del cliente', hoy: '2026-10-14' };
  const errores = (p) => problemasDeEnvio({ ...base, ...p }).filter(x => x.nivel === 'error').map(x => x.mensaje);

  it('una solicitud completa no tiene errores', () => {
    expect(errores({ empleados: [emp('1'), emp('2', { transporte: false })] })).toEqual([]);
  });
  it('fecha de hoy o futura; motivo de la lista; comentario de 10 caracteres', () => {
    expect(errores({ empleados: [emp('1')], fechaTE: '2026-10-13' })).toContain('La fecha debe ser hoy o futura.');
    expect(errores({ empleados: [emp('1')], fechaTE: '2026-10-14' })).toEqual([]);
    expect(errores({ empleados: [emp('1')], motivo: 'Fiesta' })).toContain('Elige el motivo.');
    expect(errores({ empleados: [emp('1')], comentario: 'corto' }).join()).toMatch(/comentario es obligatorio/);
    expect(errores({ empleados: [emp('1')], comentario: '   123456789   ' }).join()).toMatch(/comentario es obligatorio/);
  });
  it('al menos un empleado y máximo MAX_PASAJEROS', () => {
    expect(errores({ empleados: [] })).toContain('Agrega al menos un empleado.');
    expect(errores({ empleados: Array.from({ length: 151 }, (_, i) => emp(String(i))) }).join()).toMatch(/Máximo 150/);
  });
  it('sin repetidos, con horario y entrada distinta de salida', () => {
    expect(errores({ empleados: [emp('1'), emp('1')] }).join()).toMatch(/repetido/);
    expect(errores({ empleados: [emp('1', { horaEntrada: '' })] }).join()).toMatch(/falta el horario/);
    expect(errores({ empleados: [emp('1', { horaEntrada: '7:00', horaSalida: '7:00' })] }).join()).toMatch(/no pueden ser iguales/);
  });
  it('transporte completo en cada empleado que lo pida; la precargada se confirma', () => {
    expect(errores({ empleados: [emp('1', { puntoReunionId: '' })] }).join()).toMatch(/completa ruta, comunidad y punto/);
    expect(errores({ empleados: [emp('1', { necesitaConfirmar: true, confirmada: false })] }).join()).toMatch(/confirma la ruta/);
    expect(errores({ empleados: [emp('1', { necesitaConfirmar: true, confirmada: true })] })).toEqual([]);
    expect(errores({ empleados: [emp('1', { transporte: false, rutaId: '' })] })).toEqual([]);
    expect(transporteCompleto(emp('1', { transporte: false, rutaId: '' }))).toBe(true);
  });
  it('un empleado con otro tiempo extra el mismo día solo da AVISO (no bloquea)', () => {
    const p = problemasDeEnvio({ ...base, empleados: [emp('1')], ocupados: new Map([['1', { folio: 'TE-2026-0004', estatus: 'autorizada' }]]) });
    expect(p.filter(x => x.nivel === 'error')).toEqual([]);
    expect(p.find(x => x.nivel === 'aviso').mensaje).toMatch(/TE-2026-0004/);
  });
});

describe('resumen y aplicar a varios', () => {
  it('totales y empleados por bloque de horario', () => {
    const r = resumenTE([emp('1'), emp('2', { alimentos: true }), emp('3', { horaEntrada: '7:00', horaSalida: '16:00', transporte: false })]);
    expect(r).toMatchObject({ totalEmpleados: 3, totalHoras: 25, totalTransporte: 2, totalAlimentos: 1 });
    expect(r.porBloque).toEqual({ '16:00 → 0:00': 2, '7:00 → 16:00': 1 });
  });
  it('aplica horario, alimentos y transporte a los seleccionados (o a todos)', () => {
    const lista = [emp('1'), emp('2'), emp('3')];
    const solo = aplicarA(lista, new Set(['2']), { horaEntrada: '19:00', horaSalida: '7:00', alimentos: true });
    expect(solo.map(e => e.horaEntrada)).toEqual(['16:00', '19:00', '16:00']);
    expect(solo[1].alimentos).toBe(true);
    const todos = aplicarA(lista, null, { transporte: false });
    expect(todos.every(e => !e.transporte)).toBe(true);
  });
});

describe('estatus y pestañas', () => {
  it('el Aut. 1 de esa área, o un área sin participaTE, va directo a nivel 2', () => {
    expect(estatusAlEnviar({ esAut1DeLaArea: false, areaParticipa: true })).toBe('pendiente_aut1');
    expect(estatusAlEnviar({ esAut1DeLaArea: true, areaParticipa: true })).toBe('pendiente_aut2');
    expect(estatusAlEnviar({ esAut1DeLaArea: false, areaParticipa: false })).toBe('pendiente_aut2');
  });
  it('nivel en texto y pestañas de Mis solicitudes', () => {
    expect(nivelEnTexto('pendiente_aut1')).toBe('Autorización 1');
    expect(PESTANAS_TE.map(p => p.label)).toEqual(['Borradores', 'En autorización', 'Devueltas', 'Autorizadas', 'Canceladas']);
  });
});

describe('bandejas: antigüedad, orden, filtros y totales', () => {
  const t = (folio, extra = {}) => ({ folio, areaId: 'moldes', estatus: 'pendiente_aut1', fechaTE: '2026-10-20', creadoPor: 'u1', creadoPorNombre: 'ROMERO OSCAR', creadoPorNomina: '50875', resumen: { totalEmpleados: 4, totalHoras: 32 }, fechaActualizacion: 1000, ...extra });
  const AHORA = 10 * 24 * 3600 * 1000;
  it('antigüedad en texto', () => {
    expect(haceTiempo(AHORA - 20_000, AHORA)).toBe('hace un momento');
    expect(haceTiempo(AHORA - 5 * 60_000, AHORA)).toBe('hace 5 min');
    expect(haceTiempo(AHORA - 3 * 3600_000, AHORA)).toBe('hace 3 h');
    expect(haceTiempo(AHORA - 24 * 3600_000, AHORA)).toBe('hace 1 día');
    expect(haceTiempo(AHORA - 2 * 24 * 3600_000, AHORA)).toBe('hace 2 días');
    expect(haceTiempo({ toMillis: () => AHORA - 2 * 24 * 3600_000 }, AHORA)).toBe('hace 2 días');
  });
  it('las más antiguas primero', () => {
    const lista = masAntiguasPrimero([t('B', { fechaActualizacion: 3000 }), t('A', { fechaActualizacion: 1000 }), t('C', { fechaActualizacion: 2000 })]);
    expect(lista.map(x => x.folio)).toEqual(['A', 'C', 'B']);
  });
  it('fecha vencida y propias', () => {
    expect(fechaVencida('2026-10-13', '2026-10-14')).toBe(true);
    expect(fechaVencida('2026-10-14', '2026-10-14')).toBe(false);
    expect(esPropia(t('A'), 'u1')).toBe(true);
    expect(esPropia(t('A'), 'u2')).toBe(false);
  });
  it('firma con "(RH)" cuando firmó por su rol de RH', () => {
    expect(firmaTexto({ nombre: 'SALVADOR', comoRH: false })).toBe('SALVADOR');
    expect(firmaTexto({ nombre: 'ALGUIEN', comoRH: true })).toBe('ALGUIEN (RH)');
    expect(firmaTexto(undefined)).toBe('');
  });
  it('filtros por área, estatus, fechas y solicitante', () => {
    const lista = [t('A'), t('B', { areaId: 'calidad', estatus: 'autorizada', fechaTE: '2026-11-02', creadoPorNombre: 'PEREZ LUIS', creadoPorNomina: '50272' }), t('C', { fechaTE: '2026-10-05' })];
    expect(filtrarSolicitudes(lista, { areaId: 'calidad' }).map(x => x.folio)).toEqual(['B']);
    expect(filtrarSolicitudes(lista, { estatus: 'autorizada' }).map(x => x.folio)).toEqual(['B']);
    expect(filtrarSolicitudes(lista, { desde: '2026-10-10', hasta: '2026-10-31' }).map(x => x.folio)).toEqual(['A']);
    expect(filtrarSolicitudes(lista, { solicitante: 'pérez' }).map(x => x.folio)).toEqual(['B']);
    expect(filtrarSolicitudes(lista, { solicitante: '50875' }).map(x => x.folio)).toEqual(['A', 'C']);
  });
  it('totales para la confirmación masiva', () => {
    expect(totalesDe([t('A'), t('B', { resumen: { totalEmpleados: 6, totalHoras: 45.5 } })])).toEqual({ solicitudes: 2, empleados: 10, horas: 77.5 });
    expect(totalesDe([])).toEqual({ solicitudes: 0, empleados: 0, horas: 0 });
  });
  it('constantes del flujo', () => {
    expect(MIN_MOTIVO_DEVOLUCION).toBe(10);
    expect(MSG_YA_RESPONDIDA).toBe('Alguien más ya respondió esta solicitud');
  });
});

describe('Excel de la consulta', () => {
  it('hoja Resumen por área y estatus; hoja Detalle con una fila por empleado y quién firmó', async () => {
    const { construirLibroConsulta, ENCABEZADOS_DETALLE } = await import('../src/utils/exportarConsultaTE.js');
    const e = (nomina, extra = {}) => ({ nomina, nombre: `EMP ${nomina}`, puesto: 'OP', horaEntrada: '7:00', horaSalida: '16:00', alimentos: true, transporte: true, rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1', ...extra });
    const solicitudes = [
      { folio: 'TE-2026-0001', areaId: 'moldes', estatus: 'autorizada', fechaTE: '2026-10-20', motivo: 'Otro', motivoOtro: 'Visita de cliente', resumen: { totalEmpleados: 2, totalHoras: 18 }, empleados: [e('1'), e('2', { transporte: false })],
        aut1: { nombre: 'ANSELMO', comoRH: false }, aut2: { nombre: 'ADMIN', comoRH: true } },
      { folio: 'TE-2026-0002', areaId: 'moldes', estatus: 'pendiente_aut1', fechaTE: '2026-10-21', resumen: { totalEmpleados: 1, totalHoras: 9 }, empleados: [e('3')] },
      { folio: 'TE-2026-0003', areaId: 'calidad', estatus: 'autorizada', fechaTE: '2026-10-22', resumen: { totalEmpleados: 1, totalHoras: 9 }, empleados: [e('4')] },
    ];
    const catalogos = { rutas: [{ id: 'r1', nombre: 'Norte' }], comunidades: [{ id: 'c1', nombre: 'Pueblito' }], puntos: [{ id: 'p1', nombre: 'Plaza' }] };
    const wb = construirLibroConsulta({ solicitudes, nombresArea: new Map([['moldes', 'Moldes'], ['calidad', 'Calidad']]), catalogos });
    expect(wb.worksheets.map(w => w.name)).toEqual(['Resumen', 'Detalle']);
    const r = wb.getWorksheet('Resumen');
    expect(r.getRow(2).values.slice(1)).toEqual(['Calidad', 'Autorizada', 1, 1, 9]);
    expect(r.getRow(3).values.slice(1)).toEqual(['Moldes', 'En autorización (nivel 1)', 1, 1, 9]);
    expect(r.getRow(4).values.slice(1)).toEqual(['Moldes', 'Autorizada', 1, 2, 18]);
    expect(r.getRow(5).values.slice(1)).toEqual(['TOTAL', '', 3, 4, 36]);
    const d = wb.getWorksheet('Detalle');
    expect(d.getRow(1).values.slice(1)).toEqual(ENCABEZADOS_DETALLE);
    expect(d.rowCount).toBe(5); // encabezado + 4 empleados
    expect(d.getRow(2).values.slice(1)).toEqual(['TE-2026-0001', 'Moldes', '2026-10-20', 'Otro: Visita de cliente', '1', 'EMP 1', 'OP', '7:00 → 16:00', 9, 'Sí', 'Sí', 'Norte · Pueblito · Plaza', 'Autorizada', 'ANSELMO', 'ADMIN (RH)']);
    expect(d.getRow(3).values.slice(1)).toEqual(expect.arrayContaining(['No', '']));
  });
});
