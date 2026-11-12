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
    expect(r.map(x => x.texto)).toEqual([expect.stringMatching(/comentario/i), 'Falta completar o corregir el horario de 4 empleados']);
    expect(r[1]).toMatchObject({ campo: 'fila-1', cantidad: 4 });
  });
  it('un solo empleado conserva su mensaje con el nombre', () => {
    const r = resumirPendientes(problemasDeEnvio({ ...base, empleados: [emp('1', { rutaId: '' })] }));
    expect(r).toEqual([{ texto: 'EMPLEADO 1: completa ruta, comunidad y punto de reunión.', campo: 'fila-1', cantidad: 1 }]);
  });
  it('rutas y horarios van en renglones distintos; los avisos no cuentan', () => {
    const lista = [emp('1', { horaSalida: '' }), emp('2', { rutaId: '' }), emp('3', { rutaId: '' })];
    const r = resumirPendientes(problemasDeEnvio({ ...base, empleados: lista, ocupados: new Map([['1', { folio: 'TE-2099-0001', estatus: 'autorizada', horaEntrada: '17:00', horaSalida: '19:00' }]]) }));
    expect(r.map(x => x.texto)).toEqual(['EMPLEADO 1: falta el horario (con 0 horas no se puede enviar).', 'Falta completar la ruta de 2 empleados']);
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

describe('otro tiempo extra el mismo día', () => {
  const otro = (extra = {}) => new Map([['1', { folio: 'TE-2099-0012', estatus: 'autorizada', horaEntrada: '14:00', horaSalida: '18:00', ...extra }]]);
  it('si los horarios se encima, es un ERROR (obligatorio para enviar), con el folio y el horario del otro', () => {
    const p = problemasDeEnvio({ ...base, ocupados: otro() });
    const e = p.find(x => x.nivel === 'error');
    expect(e).toMatchObject({ nomina: '1', grupo: 'traslape', campo: 'fila-1' });
    expect(e.mensaje).toMatch(/TE-2099-0012/);
    expect(e.mensaje).toMatch(/2:00 p\. ?m\./);
    expect(p.some(x => x.nivel === 'aviso')).toBe(false);
  });
  it('si no se encima, es solo un AVISO informativo con el folio y el horario del otro', () => {
    const p = problemasDeEnvio({ ...base, ocupados: otro({ horaEntrada: '17:00', horaSalida: '19:00' }) });
    expect(p.filter(x => x.nivel === 'error')).toEqual([]);
    const a = p.find(x => x.nivel === 'aviso');
    expect(a.mensaje).toMatch(/TE-2099-0012/);
    expect(a.mensaje).toMatch(/puedes enviar igual/);
  });
  it('con varias solicitudes del mismo día, basta que una se encime', () => {
    const bloques = [{ folio: 'TE-2099-0001', horaEntrada: '17:00', horaSalida: '19:00' }, { folio: 'TE-2099-0002', horaEntrada: '9:00', horaSalida: '12:00' }];
    const p = problemasDeEnvio({ ...base, ocupados: new Map([['1', { ...bloques[0], bloques }]]) });
    expect(p.find(x => x.nivel === 'error').mensaje).toMatch(/TE-2099-0002/);
  });
  it('sin horario guardado en el otro, solo avisa (no se puede comparar)', () => {
    const p = problemasDeEnvio({ ...base, ocupados: new Map([['1', { folio: 'TE-2099-0003', estatus: 'autorizada' }]]) });
    expect(p.filter(x => x.nivel === 'error')).toEqual([]);
    expect(p.find(x => x.nivel === 'aviso').mensaje).toMatch(/TE-2099-0003/);
  });
});
