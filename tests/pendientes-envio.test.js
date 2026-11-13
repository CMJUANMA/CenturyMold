// Panel «Faltan N cosas» del editor de tiempo extra y choque de horarios con otro tiempo extra del mismo día. Datos ficticios. Ejecutar con: npm run test:unit
import { describe, expect, it } from 'vitest';
import { problemasDeEnvio, resumirPendientes, seTraslapan, textoFaltan } from '../src/utils/tiempoExtra.js';

const MOTIVO = { clave: 'm1', motivoId: 'inventario-fisico', numero: '', comentario: '', detalle: '' };
const CATALOGO = [{ id: 'inventario-fisico', nombre: 'Inventario físico', activo: true }];
const emp = (nomina, extra = {}) => ({
  nomina, nombre: `EMPLEADO ${nomina}`, horaEntrada: '7:00', horaSalida: '16:00', transporte: true, transporteLlegada: true, transporteSalida: true,
  rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1', necesitaConfirmar: false, confirmada: false, motivoIndex: 0, ...extra,
});
const base = { areaId: 'produccion', fechaTE: '2099-12-01', hoy: '2099-11-01', motivos: [MOTIVO], catalogoMotivos: CATALOGO, comentario: 'Pedido urgente del cliente', empleados: [emp('1')] };
const errores = (o) => problemasDeEnvio({ ...base, ...o }).filter(p => p.nivel === 'error');

describe('textoFaltan', () => {
  it('singular y plural', () => {
    expect(textoFaltan(1)).toBe('Falta 1 cosa');
    expect(textoFaltan(2)).toBe('Faltan 2 cosas');
    expect(textoFaltan(12)).toBe('Faltan 12 cosas');
  });
});

describe('cada problema lleva el campo al que enlaza', () => {
  it('los de la cabecera', () => {
    const p = problemasDeEnvio({ ...base, areaId: '', fechaTE: '', motivos: [{ ...MOTIVO, motivoId: '' }], comentario: '', empleados: [] });
    const campos = Object.fromEntries(p.map(x => [x.mensaje, x.campo]));
    expect(campos['Elige el área.']).toBe('te-area');
    expect(campos['Elige la fecha del tiempo extra.']).toBe('te-fecha');
    expect(campos['Agrega al menos un empleado.']).toBe('btn-agregar-empleados');
    expect(p.find(x => /comentario/i.test(x.mensaje)).campo).toBe('te-comentario');
    expect(p.find(x => /motivo/i.test(x.mensaje)).campo).toBe('te-motivo-0');
  });
  it('los de un empleado llevan a su fila; la justificación de rutas, a su campo', () => {
    const lista = [emp('1', { horaEntrada: '', horaSalida: '' }), emp('2', { rutaId: 'r2' })];
    const p = errores({ empleados: lista });
    expect(p.find(x => x.nomina === '1').campo).toBe('fila-1');
    expect(p.find(x => x.campo === 'te-justificacion-rutas')).toBeTruthy();
  });
});

describe('resumirPendientes', () => {
  it('junta los problemas por empleado del mismo tipo y deja los demás con su mensaje', () => {
    const lista = [1, 2, 3, 4].map(n => emp(String(n), { horaEntrada: '', horaSalida: '' }));
    const r = resumirPendientes(problemasDeEnvio({ ...base, comentario: '', empleados: lista }));
    expect(r.map(x => x.texto)).toEqual([expect.stringMatching(/comentario/i), 'Horario de 4 empleados']);
    expect(r[1]).toMatchObject({ campo: 'fila-1', cantidad: 4 });
  });
  it('un solo empleado conserva su mensaje con el nombre', () => {
    const r = resumirPendientes(problemasDeEnvio({ ...base, empleados: [emp('1', { rutaId: '' })] }));
    expect(r).toEqual([{ texto: 'EMPLEADO 1: completa ruta, comunidad y punto de reunión.', campo: 'fila-1', cantidad: 1 }]);
  });
  it('rutas y horarios van en renglones distintos; los avisos no cuentan', () => {
    const lista = [emp('1', { horaSalida: '' }), emp('2', { rutaId: '' }), emp('3', { rutaId: '' })];
    const r = resumirPendientes(problemasDeEnvio({ ...base, empleados: lista, ocupados: new Map([['1', { folio: 'TE-2099-0001', estatus: 'autorizada', horaEntrada: '17:00', horaSalida: '19:00' }]]) }));
    expect(r.map(x => x.texto)).toEqual(['EMPLEADO 1: falta el horario (con 0 horas no se puede enviar).', 'Ruta de 2 empleados']);
  });
  it('sin problemas no hay nada pendiente', () => { expect(resumirPendientes(problemasDeEnvio(base))).toEqual([]); });
});

describe('seTraslapan', () => {
  it('horarios que se encima y que no', () => {
    expect(seTraslapan('7:00', '16:00', '14:00', '18:00')).toBe(true);
    expect(seTraslapan('7:00', '16:00', '16:00', '0:00')).toBe(false); // uno empieza cuando el otro termina
    expect(seTraslapan('7:00', '16:00', '7:00', '16:00')).toBe(true);
    expect(seTraslapan('7:00', '16:00', '19:00', '7:00')).toBe(false);
  });
  it('lo que cruza la medianoche', () => {
    expect(seTraslapan('19:00', '7:00', '22:00', '0:00')).toBe(true);
    expect(seTraslapan('16:00', '0:00', '19:00', '7:00')).toBe(true);
    expect(seTraslapan('16:00', '19:00', '19:00', '7:00')).toBe(false);
  });
  it('sin horario completo no se puede decir que se encima', () => {
    expect(seTraslapan('', '', '7:00', '16:00')).toBe(false);
    expect(seTraslapan('7:00', '', '7:00', '16:00')).toBe(false);
  });
});

describe('otro tiempo extra del día anterior, el mismo día o el siguiente', () => {
  const otro = (extra = {}) => new Map([['1', { folio: 'TE-2099-0012', estatus: 'autorizada', horaEntrada: '14:00', horaSalida: '18:00', desfase: 0, ...extra }]]);
  it('si los horarios se encima, es un ERROR (obligatorio para enviar) en la fila, con folio y horario del otro y qué hacer', () => {
    const p = problemasDeEnvio({ ...base, ocupados: otro() });
    const e = p.find(x => x.nivel === 'error');
    expect(e).toMatchObject({ nomina: '1', grupo: 'traslape', campo: 'fila-1', folio: 'TE-2099-0012' });
    expect(e.mensaje).toMatch(/^Ya tiene TE-2099-0012 de 2:00 p\. ?m\. a 6:00 p\. ?m\. ese día\. Cambia el horario o quítalo\.$/);
    expect(e.mensajePanel).toMatch(/^EMPLEADO 1: ya tiene TE-2099-0012/);
    expect(p.some(x => x.nivel === 'nota')).toBe(false); // si es la única, el error ya lo dice
  });
  it('si no se encima, es solo una NOTA gris, sin etiqueta de aviso: «También tiene…» con el día', () => {
    const p = problemasDeEnvio({ ...base, ocupados: otro({ horaEntrada: '17:00', horaSalida: '19:00' }) });
    expect(p.filter(x => x.nivel === 'error')).toEqual([]);
    expect(p.some(x => x.nivel === 'aviso')).toBe(false);
    expect(p.find(x => x.nivel === 'nota').mensaje).toMatch(/^También tiene: TE-2099-0012 \(el mismo día, de 5:00 p\. ?m\. a 7:00 p\. ?m\.\)\.$/);
  });
  it('lo que cruza la medianoche: la del día anterior que termina de madrugada se encima con la de las 12 a las 8', () => {
    const ayer = otro({ horaEntrada: '19:00', horaSalida: '7:00', desfase: -1 }); // ayer 7 p. m. → hoy 7 a. m.
    const madrugada = problemasDeEnvio({ ...base, empleados: [emp('1', { horaEntrada: '0:00', horaSalida: '8:00' })], ocupados: ayer });
    expect(madrugada.find(x => x.nivel === 'error').mensaje).toMatch(/ el día anterior\./);
    const tarde = problemasDeEnvio({ ...base, empleados: [emp('1', { horaEntrada: '7:00', horaSalida: '16:00' })], ocupados: ayer });
    expect(tarde.filter(x => x.nivel === 'error')).toEqual([]);
    expect(tarde.find(x => x.nivel === 'nota').mensaje).toMatch(/\(ayer, de 7:00 p\. ?m\. a 7:00 a\. ?m\.\)/);
  });
  it('la del día siguiente que empieza cuando la mía (que cruza la medianoche) aún no termina', () => {
    const manana = otro({ horaEntrada: '0:00', horaSalida: '6:00', desfase: 1 });
    const mia = problemasDeEnvio({ ...base, empleados: [emp('1', { horaEntrada: '19:00', horaSalida: '7:00' })], ocupados: manana });
    expect(mia.find(x => x.nivel === 'error').mensaje).toMatch(/ el día siguiente\./);
    const corta = problemasDeEnvio({ ...base, empleados: [emp('1', { horaEntrada: '16:00', horaSalida: '0:00' })], ocupados: manana });
    expect(corta.filter(x => x.nivel === 'error')).toEqual([]);
  });
  it('con varias solicitudes, la nota las lista todas con su día y marca la que choca', () => {
    const bloques = [{ folio: 'TE-2099-0001', horaEntrada: '17:00', horaSalida: '19:00', desfase: 0 }, { folio: 'TE-2099-0002', horaEntrada: '9:00', horaSalida: '12:00', desfase: 0 }];
    const p = problemasDeEnvio({ ...base, ocupados: new Map([['1', { ...bloques[0], bloques }]]) });
    expect(p.find(x => x.nivel === 'error').mensaje).toMatch(/TE-2099-0002/);
    const nota = p.find(x => x.nivel === 'nota').mensaje;
    expect(nota).toMatch(/TE-2099-0001 \(el mismo día, de 5:00 p\. ?m\. a 7:00 p\. ?m\.\)/);
    expect(nota).toMatch(/TE-2099-0002 \(el mismo día, de 9:00 a\. ?m\. a 12:00 p\. ?m\.; CHOCA con este horario\)/);
  });
  it('la nota dice ayer, el mismo día o mañana', () => {
    const bloques = [
      { folio: 'TE-A', horaEntrada: '7:00', horaSalida: '16:00', desfase: -1, estatus: 'autorizada' },
      { folio: 'TE-B', horaEntrada: '19:00', horaSalida: '21:00', desfase: 0, estatus: 'autorizada' },
      { folio: 'TE-C', horaEntrada: '7:00', horaSalida: '16:00', desfase: 1, estatus: 'autorizada' },
    ];
    const nota = problemasDeEnvio({ ...base, empleados: [emp('1', { horaEntrada: '20:00', horaSalida: '23:00' })], ocupados: new Map([['1', { ...bloques[0], bloques }]]) }).find(x => x.nivel === 'nota').mensaje;
    expect(nota).toMatch(/TE-A \(ayer,/);
    expect(nota).toMatch(/TE-B \(el mismo día,.*CHOCA/);
    expect(nota).toMatch(/TE-C \(mañana,/);
  });
  it('un borrador propio sin enviar no bloquea: solo se anota', () => {
    const p = problemasDeEnvio({ ...base, ocupados: otro({ estatus: 'borrador', folio: null }) });
    expect(p.filter(x => x.nivel === 'error')).toEqual([]);
    expect(p.find(x => x.nivel === 'nota').mensaje).toMatch(/borrador/);
  });
  it('sin horario guardado en el otro, solo se anota (no se puede comparar)', () => {
    const p = problemasDeEnvio({ ...base, ocupados: new Map([['1', { folio: 'TE-2099-0003', estatus: 'autorizada' }]]) });
    expect(p.filter(x => x.nivel === 'error')).toEqual([]);
    expect(p.find(x => x.nivel === 'nota').mensaje).toBe('También tiene: TE-2099-0003 (el mismo día).');
  });
  it('la medianoche se lee «12:00 a. m. (medianoche)»', () => {
    const p = problemasDeEnvio({ ...base, empleados: [emp('1', { horaEntrada: '16:00', horaSalida: '0:00' })], ocupados: otro({ horaEntrada: '17:00', horaSalida: '0:00' }) });
    expect(p.find(x => x.nivel === 'error').mensaje).toMatch(/a 12:00 a\. ?m\. \(medianoche\) ese día/);
  });
});

describe('el renglón del choque en el panel de pendientes', () => {
  const choca = (nomina, folio) => ({ nomina, folio, estatus: 'autorizada', horaEntrada: '7:00', horaSalida: '16:00', desfase: 0 });
  it('«Horario encimado: 8050 y 8053 con TE-2026-0012», con un enlace por empleado', () => {
    const ocupados = new Map([['8050', choca('8050', 'TE-2026-0012')], ['8053', choca('8053', 'TE-2026-0012')]]);
    const r = resumirPendientes(problemasDeEnvio({ ...base, empleados: [emp('8050'), emp('8051'), emp('8053')], ocupados }));
    expect(r).toHaveLength(1);
    expect(r[0].texto).toBe('Horario encimado: 8050 y 8053 con TE-2026-0012');
    expect(r[0].piezas.filter(z => z.nomina).map(z => [z.nomina, z.campo])).toEqual([['8050', 'fila-8050'], ['8053', 'fila-8053']]);
  });
  it('con tres, separa con comas y «y»; con folios distintos, cada uno con el suyo', () => {
    const ocupados = new Map([['1', choca('1', 'TE-A')], ['2', choca('2', 'TE-B')], ['3', choca('3', 'TE-C')]]);
    const r = resumirPendientes(problemasDeEnvio({ ...base, empleados: [emp('1'), emp('2'), emp('3')], ocupados }));
    expect(r[0].texto).toBe('Horario encimado: 1 con TE-A, 2 con TE-B y 3 con TE-C');
  });
  it('uno solo también dice quién y con qué folio', () => {
    const r = resumirPendientes(problemasDeEnvio({ ...base, empleados: [emp('1')], ocupados: new Map([['1', choca('1', 'TE-2026-0012')]]) }));
    expect(r[0].texto).toBe('Horario encimado: 1 con TE-2026-0012');
  });
});

describe('seTraslapan entre días', () => {
  it('con el desfase de días reales', () => {
    expect(seTraslapan('0:00', '8:00', '19:00', '7:00', -1)).toBe(true);
    expect(seTraslapan('7:00', '16:00', '19:00', '7:00', -1)).toBe(false);
    expect(seTraslapan('19:00', '7:00', '0:00', '6:00', 1)).toBe(true);
    expect(seTraslapan('16:00', '0:00', '0:00', '6:00', 1)).toBe(false);
  });
});
