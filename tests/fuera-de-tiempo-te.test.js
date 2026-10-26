// Autorización FUERA DE TIEMPO de solicitudes vencidas (solo Aut. 2): quién puede, cómo se etiqueta, el filtro y el aviso a Nóminas. Datos ficticios, sin Firebase.
import { describe, expect, it } from 'vitest';
import {
  COMENTARIO_SIN_AUT1, ESTATUS_FUERA_DE_TIEMPO, esAutorizadaFueraDeTiempo, esFechaPasadaSinEnviar, esVencida, filtrarSolicitudes, motivoFueraDeTiempo, puedeAutorizarseFueraDeTiempo,
} from '../src/utils/tiempoExtra.js';
import { autorizadasDelPeriodo, fueraDeTiempoDelArea, pendientesDelPeriodo, semanaDe } from '../src/utils/formatoNomina.js';
import { ACCIONES_TE_LABELS } from '../src/utils/constantes.js';

const t = (estatus, fechaTE, extra = {}) => ({ id: `${estatus}-${fechaTE}`, folio: `TE-${estatus}-${fechaTE}`, areaId: 'moldes', estatus, fechaTE, fechaActualizacion: 1000, fechaCreacion: 1000, resumen: { totalEmpleados: 2, totalHoras: 16 }, ...extra });
const HOY = new Date('2026-10-23T18:00:00Z'); // viernes 23/oct/2026, mediodía en México
const fuera = (extra = {}) => t('autorizada', '2026-10-21', { autorizadaFueraDeTiempo: true, fueraDeTiempo: { nombre: 'Aut Dos', motivo: 'Sí se trabajó; el jefe no autorizó a tiempo', estatusAnterior: 'pendiente_aut1', fecha: { toMillis: () => Date.parse('2026-10-23T15:00:00Z') } }, ...extra });

describe('quién puede autorizarse fuera de tiempo', () => {
  it('solo las vencidas que estaban en pendiente_aut1 o pendiente_aut2', () => {
    expect(ESTATUS_FUERA_DE_TIEMPO).toEqual(['pendiente_aut1', 'pendiente_aut2']);
    expect(puedeAutorizarseFueraDeTiempo(t('pendiente_aut1', '2026-10-22'), HOY)).toBe(true);
    expect(puedeAutorizarseFueraDeTiempo(t('pendiente_aut2', '2026-10-01'), HOY)).toBe(true);
  });
  it('no las borradores ni las devueltas vencidas (esas se duplican con otra fecha)', () => {
    expect(esVencida(t('borrador', '2026-10-22'), HOY)).toBe(true);
    expect(puedeAutorizarseFueraDeTiempo(t('borrador', '2026-10-22'), HOY)).toBe(false);
    expect(puedeAutorizarseFueraDeTiempo(t('devuelta', '2026-10-22'), HOY)).toBe(false);
  });
  it('no las que todavía están a tiempo (hoy o después): esas se autorizan de la forma normal', () => {
    expect(puedeAutorizarseFueraDeTiempo(t('pendiente_aut2', '2026-10-23'), HOY)).toBe(false);
    expect(puedeAutorizarseFueraDeTiempo(t('pendiente_aut1', '2026-10-30'), HOY)).toBe(false);
  });
  it('no las que ya están autorizadas, procesadas o canceladas', () => {
    for (const e of ['autorizada', 'procesada', 'cancelada']) expect(puedeAutorizarseFueraDeTiempo(t(e, '2026-10-01'), HOY)).toBe(false);
  });
});

describe('la etiqueta «Autorizada fuera de tiempo»', () => {
  it('la lleva la autorizada o procesada con la marca; ya no la que volvió a otro estatus', () => {
    expect(esAutorizadaFueraDeTiempo(fuera())).toBe(true);
    expect(esAutorizadaFueraDeTiempo(fuera({ estatus: 'procesada' }))).toBe(true);
    expect(esAutorizadaFueraDeTiempo(fuera({ estatus: 'devuelta' }))).toBe(false);
    expect(esAutorizadaFueraDeTiempo(fuera({ estatus: 'cancelada' }))).toBe(false);
    expect(esAutorizadaFueraDeTiempo(t('autorizada', '2026-10-21'))).toBe(false);
  });
  it('trae el motivo para el detalle', () => {
    expect(motivoFueraDeTiempo(fuera())).toBe('Sí se trabajó; el jefe no autorizó a tiempo');
    expect(motivoFueraDeTiempo(t('autorizada', '2026-10-21'))).toBe('');
  });
  it('el historial tiene su propia etiqueta y el texto de «sin Aut. 1» es el que exigen las reglas', () => {
    expect(ACCIONES_TE_LABELS.autorizada_fuera_de_tiempo).toBe('Autorizada por Aut. 2, fuera de tiempo');
    expect(COMENTARIO_SIN_AUT1).toBe('Autorizada por Aut. 2 sin Aut. 1, fuera de tiempo');
  });
});

describe('dónde aparece después de autorizarse', () => {
  it('sale de las vencidas (ya no es pendiente) y cae en «Fecha pasada – transporte no enviado»', () => {
    expect(esVencida(fuera(), HOY)).toBe(false);
    expect(esFechaPasadaSinEnviar(fuera(), HOY)).toBe(true);
  });
  it('cuenta normal en la semana de su fecha para nómina y ya no se avisa como vencida', () => {
    const semana = semanaDe('2026-10-21');
    const planta = [fuera(), t('pendiente_aut2', '2026-10-22')];
    expect(autorizadasDelPeriodo(planta, semana).map(x => x.id)).toEqual([fuera().id]);
    const p = pendientesDelPeriodo(planta, semana, new Map(), HOY);
    expect(p.vencidas.total).toBe(1);
    expect(p.total).toBe(0);
  });
});

describe('filtro «Fuera de tiempo»', () => {
  const lista = [fuera({ id: 'a' }), t('autorizada', '2026-10-21', { id: 'b' }), t('pendiente_aut2', '2026-10-30', { id: 'c' })];
  it('solo deja las autorizadas fuera de tiempo', () => {
    expect(filtrarSolicitudes(lista, { fueraDeTiempo: true, ahora: HOY }).map(x => x.id)).toEqual(['a']);
  });
  it('apagado no filtra nada', () => {
    expect(filtrarSolicitudes(lista, { ahora: HOY })).toHaveLength(3);
    expect(filtrarSolicitudes(lista, { fueraDeTiempo: false, ahora: HOY })).toHaveLength(3);
  });
  it('se combina con los demás filtros', () => {
    expect(filtrarSolicitudes(lista, { fueraDeTiempo: true, areaId: 'calidad', ahora: HOY })).toHaveLength(0);
  });
});

describe('aviso a Nóminas cuando el área ya estaba firmada', () => {
  const firmadaA = (iso) => ({ firmada: true, firmadaPor: { uid: 'n', fecha: iso } });
  it('sin firma, solo cuenta cuántas hay', () => {
    expect(fueraDeTiempoDelArea([fuera({ folio: 'TE-1' })], null)).toEqual({ total: 1, folios: ['TE-1'], trasFirma: [] });
    expect(fueraDeTiempoDelArea([fuera({ folio: 'TE-1' })], { firmada: false }).trasFirma).toEqual([]);
  });
  it('autorizada DESPUÉS de firmar: avisa con su folio', () => {
    const r = fueraDeTiempoDelArea([fuera({ folio: 'TE-1' })], firmadaA('2026-10-22T12:00:00.000Z'));
    expect(r.trasFirma).toEqual(['TE-1']);
  });
  it('autorizada ANTES de firmar: ya venía en lo firmado, no avisa', () => {
    const r = fueraDeTiempoDelArea([fuera({ folio: 'TE-1' })], firmadaA('2026-10-24T12:00:00.000Z'));
    expect(r).toEqual({ total: 1, folios: ['TE-1'], trasFirma: [] });
  });
  it('si la hora del servidor aún no llega, se trata como reciente (avisa)', () => {
    const r = fueraDeTiempoDelArea([fuera({ folio: 'TE-1', fueraDeTiempo: { fecha: null } })], firmadaA('2026-10-22T12:00:00.000Z'));
    expect(r.trasFirma).toEqual(['TE-1']);
  });
  it('ignora lo que no se autorizó fuera de tiempo', () => {
    expect(fueraDeTiempoDelArea([t('autorizada', '2026-10-21')], firmadaA('2026-10-22T12:00:00.000Z'))).toEqual({ total: 0, folios: [], trasFirma: [] });
  });
});
