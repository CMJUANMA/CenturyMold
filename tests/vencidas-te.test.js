// Tiempo extra VENCIDO: pasado el día de su fecha (hora de México) sin terminar de autorizarse. Una sola función (esVencida) decide; no se escribe ningún estatus.
// Datos ficticios, sin Firebase. México no tiene horario de verano desde 2022: la medianoche local es a las 06:00 UTC.
import { describe, expect, it } from 'vitest';
import {
  ESTATUS_FILTRO_TE, PESTANAS_TE, conVenceHoyPrimero, esFechaPasadaSinEnviar, esVencida, estatusVisible, filtrarSolicitudes, hoyMexico, venceHoy,
} from '../src/utils/tiempoExtra.js';
import { contarMisSolicitudes, indicadoresRH, semanaPorArea } from '../src/utils/resumenInicio.js';
import { pendientesDelPeriodo, semanaDe } from '../src/utils/formatoNomina.js';
import { etiquetaEstatusTE } from '../src/utils/constantes.js';

const t = (estatus, fechaTE, extra = {}) => ({ id: `${estatus}-${fechaTE}`, folio: `TE-${estatus}`, areaId: 'moldes', estatus, fechaTE, fechaActualizacion: 1000, fechaCreacion: 1000, resumen: { totalEmpleados: 2, totalHoras: 16 }, ...extra });
// Jueves 22/oct/2026
const ULTIMO_INSTANTE = new Date('2026-10-23T05:59:59Z'); // 11:59:59 p. m. del 22 en México
const MEDIANOCHE = new Date('2026-10-23T06:00:00Z'); // 12:00 a. m. del 23
const MEDIODIA_22 = new Date('2026-10-22T18:00:00Z');
const MEDIODIA_23 = new Date('2026-10-23T18:00:00Z');

describe('la fecha de hoy es la de México, no la del servidor ni la del navegador', () => {
  it('a las 11:59 p. m. en México todavía es el mismo día aunque en UTC ya sea el siguiente', () => {
    expect(hoyMexico(ULTIMO_INSTANTE)).toBe('2026-10-22');
    expect(hoyMexico(MEDIANOCHE)).toBe('2026-10-23');
    expect(hoyMexico(new Date('2026-10-22T06:00:00Z'))).toBe('2026-10-22');
    expect(hoyMexico(new Date('2026-10-22T05:59:59Z'))).toBe('2026-10-21');
  });
  it('acepta milisegundos', () => {
    expect(hoyMexico(MEDIANOCHE.getTime())).toBe('2026-10-23');
  });
});

describe('cuándo está vencida', () => {
  it('vence a medianoche: a las 11:59:59 p. m. de su fecha aún no; a las 12:00 a. m. sí', () => {
    const p = t('pendiente_aut1', '2026-10-22');
    expect(esVencida(p, ULTIMO_INSTANTE)).toBe(false);
    expect(esVencida(p, MEDIANOCHE)).toBe(true);
  });
  it('vence hoy: con fecha de hoy sigue viva pero es urgente; con fecha de ayer ya venció', () => {
    const hoy = t('pendiente_aut2', '2026-10-22');
    expect(esVencida(hoy, MEDIODIA_22)).toBe(false);
    expect(venceHoy(hoy, MEDIODIA_22)).toBe(true);
    expect(venceHoy(hoy, MEDIODIA_23)).toBe(false);
    expect(esVencida(hoy, MEDIODIA_23)).toBe(true);
    expect(venceHoy(t('pendiente_aut1', '2026-10-23'), MEDIODIA_22)).toBe(false); // mañana: no es urgente
  });
  it('una devuelta vencida es vencida, y un borrador con la fecha pasada también', () => {
    expect(esVencida(t('devuelta', '2026-10-20'), MEDIODIA_22)).toBe(true);
    expect(esVencida(t('borrador', '2026-10-21'), MEDIODIA_22)).toBe(true);
    expect(esVencida(t('borrador', '2026-10-22'), MEDIODIA_22)).toBe(false);
  });
  it('solo vencen borrador, pendiente_aut1, pendiente_aut2 y devuelta: autorizada, procesada y cancelada, nunca', () => {
    for (const e of ['autorizada', 'procesada', 'cancelada']) expect(esVencida(t(e, '2026-01-01'), MEDIODIA_22), e).toBe(false);
    for (const e of ['borrador', 'pendiente_aut1', 'pendiente_aut2', 'devuelta']) expect(esVencida(t(e, '2026-01-01'), MEDIODIA_22), e).toBe(true);
  });
  it('sin fecha no vence; «Vence hoy» solo aplica a lo que espera una firma', () => {
    expect(esVencida(t('pendiente_aut1', ''), MEDIODIA_22)).toBe(false);
    expect(esVencida({ estatus: 'pendiente_aut1' }, MEDIODIA_22)).toBe(false);
    expect(esVencida(null)).toBe(false);
    expect(venceHoy(t('devuelta', '2026-10-22'), MEDIODIA_22)).toBe(false);
    expect(venceHoy(t('borrador', '2026-10-22'), MEDIODIA_22)).toBe(false);
    expect(venceHoy(t('autorizada', '2026-10-22'), MEDIODIA_22)).toBe(false);
  });
  it('el estatus que se muestra es «vencida» (gris, «Vencida») en lugar del guardado', () => {
    expect(estatusVisible(t('pendiente_aut1', '2026-10-20'), MEDIODIA_22)).toBe('vencida');
    expect(estatusVisible(t('devuelta', '2026-10-20'), MEDIODIA_22)).toBe('vencida');
    expect(estatusVisible(t('pendiente_aut1', '2026-10-25'), MEDIODIA_22)).toBe('pendiente_aut1');
    expect(estatusVisible(t('autorizada', '2026-10-01'), MEDIODIA_22)).toBe('autorizada');
    expect(etiquetaEstatusTE('vencida')).toBe('Vencida');
  });
});

describe('autorizada sin enviar con la fecha pasada (Por enviar al proveedor)', () => {
  it('no es vencida (sí se autorizó), pero va en «Fecha pasada – transporte no enviado»', () => {
    const a = t('autorizada', '2026-10-21');
    expect(esVencida(a, MEDIODIA_22)).toBe(false);
    expect(esFechaPasadaSinEnviar(a, MEDIODIA_22)).toBe(true);
    expect(esFechaPasadaSinEnviar(t('autorizada', '2026-10-22'), MEDIODIA_22)).toBe(false); // hoy todavía se puede enviar
    expect(esFechaPasadaSinEnviar(t('autorizada', '2026-10-22'), MEDIODIA_23)).toBe(true);
    expect(esFechaPasadaSinEnviar(t('procesada', '2026-10-01'), MEDIODIA_22)).toBe(false);
    expect(esFechaPasadaSinEnviar(t('pendiente_aut2', '2026-10-01'), MEDIODIA_22)).toBe(false);
  });
});

describe('bandejas: vence hoy primero', () => {
  it('las que vencen hoy salen primero y luego las más antiguas', () => {
    const lista = [
      t('pendiente_aut1', '2026-10-25', { id: 'antigua', fechaActualizacion: 100 }), t('pendiente_aut1', '2026-10-22', { id: 'hoy-nueva', fechaActualizacion: 900 }),
      t('pendiente_aut1', '2026-10-24', { id: 'reciente', fechaActualizacion: 500 }), t('pendiente_aut1', '2026-10-22', { id: 'hoy-vieja', fechaActualizacion: 200 }),
    ];
    expect(conVenceHoyPrimero(lista, MEDIODIA_22).map(x => x.id)).toEqual(['hoy-vieja', 'hoy-nueva', 'antigua', 'reciente']);
  });
});

describe('Mis solicitudes y la consulta', () => {
  const lista = [
    t('borrador', '2026-10-20', { id: 'b-v' }), t('borrador', '2026-10-30', { id: 'b' }), t('pendiente_aut1', '2026-10-20', { id: 'p-v' }), t('pendiente_aut2', '2026-10-30', { id: 'p' }),
    t('devuelta', '2026-10-20', { id: 'd-v' }), t('devuelta', '2026-10-30', { id: 'd' }), t('autorizada', '2026-10-20', { id: 'a' }), t('cancelada', '2026-10-20', { id: 'c' }),
  ];
  it('cada solicitud cae en UNA sola pestaña, la de su estatus visible: las vencidas en «Vencidas»', () => {
    const porPestana = Object.fromEntries(PESTANAS_TE.map(p => [p.id, lista.filter(x => p.estatus.includes(estatusVisible(x, MEDIODIA_22))).map(x => x.id)]));
    expect(porPestana).toEqual({ borrador: ['b'], autorizacion: ['p'], devuelta: ['d'], autorizada: ['a'], vencida: ['b-v', 'p-v', 'd-v'], cancelada: ['c'] });
    expect(Object.values(porPestana).flat()).toHaveLength(lista.length);
  });
  it('el filtro de estatus de la consulta ofrece «vencida» y las vencidas ya no salen como pendientes ni devueltas', () => {
    expect(ESTATUS_FILTRO_TE).toContain('vencida');
    const ids = (estatus) => filtrarSolicitudes(lista, { estatus, ahora: MEDIODIA_22 }).map(x => x.id);
    expect(ids('vencida')).toEqual(['b-v', 'p-v', 'd-v']);
    expect(ids('pendiente_aut1')).toEqual([]);
    expect(ids('pendiente_aut2')).toEqual(['p']);
    expect(ids('devuelta')).toEqual(['d']);
    expect(ids('autorizada')).toEqual(['a']);
    expect(ids('')).toHaveLength(8);
  });
});

describe('contadores e indicadores de Inicio no cuentan las vencidas', () => {
  const planta = [
    t('pendiente_aut1', '2026-10-20', { id: '1v' }), t('pendiente_aut1', '2026-10-30', { id: '1' }), t('pendiente_aut2', '2026-10-20', { id: '2v' }), t('pendiente_aut2', '2026-10-22', { id: '2h' }),
    t('devuelta', '2026-10-20', { id: 'dv' }), t('devuelta', '2026-10-31', { id: 'd' }), t('borrador', '2026-10-20', { id: 'bv' }), t('borrador', '2026-10-30', { id: 'b' }),
    t('autorizada', '2026-10-20', { id: 'a' }),
  ];
  it('mis solicitudes: cada tipo sin las vencidas, y las vencidas aparte', () => {
    expect(contarMisSolicitudes(planta, MEDIODIA_22)).toMatchObject({ borrador: 1, enAutorizacion: 2, devueltas: 1, vencidas: 4 });
  });
  it('Inicio de RH y admin: nivel 1, nivel 2 y devueltas sin las vencidas; autorizada sin enviar sigue contando', () => {
    const { atencion } = indicadoresRH(planta.filter(x => x.estatus !== 'borrador'), MEDIODIA_22);
    expect(atencion).toMatchObject({ nivel1: 1, nivel2: 1, devueltas: 1, sinAutorizar: 3, porEnviar: 1, vencidas: 1 });
  });
  it('las solicitudes de la semana por área no cuentan las vencidas', () => {
    const creada = new Date('2026-10-20T12:00:00Z');
    const lista = [t('pendiente_aut1', '2026-10-30', { fechaCreacion: creada }), t('pendiente_aut1', '2026-10-20', { fechaCreacion: creada })];
    expect(semanaPorArea(lista, [{ id: 'moldes', nombre: 'Moldes' }], MEDIODIA_22)).toEqual([{ areaId: 'moldes', nombre: 'Moldes', total: 1 }]);
  });
});

describe('Reportes de nómina: las vencidas no cuentan, pero se avisan', () => {
  const s = semanaDe('2026-10-14'); // 12–18 oct
  const planta = [
    t('pendiente_aut2', '2026-10-13', { id: 'a' }), t('devuelta', '2026-10-14', { id: 'b', areaId: 'calidad' }), t('pendiente_aut1', '2026-10-16', { id: 'c' }), t('autorizada', '2026-10-15', { id: 'd' }),
  ];
  it('con la semana ya pasada, todo lo no autorizado está vencido', () => {
    const p = pendientesDelPeriodo(planta, s, new Map([['moldes', 'Moldes'], ['calidad', 'Calidad']]), MEDIODIA_22);
    expect(p.total).toBe(0);
    expect(p.vencidas.total).toBe(3);
    expect(p.vencidas.porArea).toEqual([{ areaId: 'calidad', nombre: 'Calidad', cantidad: 1 }, { areaId: 'moldes', nombre: 'Moldes', cantidad: 2 }]);
  });
  it('en plena semana, lo que aún no llega a su fecha sigue pendiente y lo de días anteriores ya venció', () => {
    const p = pendientesDelPeriodo(planta, s, new Map([['moldes', 'Moldes']]), new Date('2026-10-15T18:00:00Z')); // jueves 15 al mediodía
    expect(p.total).toBe(1); // la del viernes 16
    expect(p.vencidas.total).toBe(2); // martes 13 y miércoles 14
  });
});
