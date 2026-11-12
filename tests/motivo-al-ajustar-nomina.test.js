// Nóminas: el motivo se pide al agregar o quitar a alguien; el guardado solo pide la razón general si hace falta. Datos ficticios. Ejecutar con: npm run test:unit
import { describe, expect, it } from 'vitest';
import { TIPOS_CAMBIO, cambioAgregar, cambioHoras, conRenglonQuitado, esCambioNuevo, faltaRazonGeneral, sellarCambios } from '../src/utils/formatoNomina.js';

const fila = { clave: 'a1', nomina: '600', nombre: 'GARCIA LUNA ANA', agregado: false };
const nuevo = { nombre: 'Inventario físico', numero: '', tipoNumero: '', comentario: '', detalle: '' };

describe('quitar con motivo en el momento', () => {
  it('el cambio guarda su motivo previo y sigue siendo «nuevo» (sin guardar) hasta sellarse', () => {
    const t = conRenglonQuitado([], fila, 'No asistió');
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ tipo: TIPOS_CAMBIO.QUITAR, nomina: '600', motivo: '', motivoPrevio: 'No asistió' });
    expect(esCambioNuevo(t[0])).toBe(true);
  });
  it('sin motivo previo (compatibilidad), queda como antes', () => {
    expect(conRenglonQuitado([], fila)[0].motivoPrevio).toBeUndefined();
  });
  it('quitar a alguien agregado en esta sesión solo deshace el agregado', () => {
    const agregado = { ...cambioAgregar({ nomina: '700', nombre: 'LOPEZ ANA' }, nuevo), motivoPrevio: 'Trabajó el sábado' };
    expect(conRenglonQuitado([agregado], { clave: agregado.clave, agregado: true })).toEqual([]);
  });
});

describe('sellarCambios', () => {
  it('el motivo pedido al agregar o quitar manda; la razón general cubre lo demás; el campo temporal no se guarda', () => {
    const quitar = conRenglonQuitado([], fila, 'No asistió')[0];
    const agregar = { ...cambioAgregar({ nomina: '700', nombre: 'LOPEZ ANA' }, nuevo), motivoPrevio: 'Trabajó el sábado' };
    const horas = cambioHoras({ clave: 'b2', nomina: '601', nombre: 'RUIZ', horas: {} }, '2026-11-13', 4, '');
    const sellados = sellarCambios([quitar, agregar, horas], 'Corrección de la semana');
    expect(sellados.map(c => c.motivo)).toEqual(['No asistió', 'Trabajó el sábado', 'Corrección de la semana']);
    expect(sellados.some(c => 'motivoPrevio' in c)).toBe(false);
  });
  it('lo ya guardado no se toca', () => {
    const guardado = { tipo: TIPOS_CAMBIO.QUITAR, clave: 'x', nomina: '1', nombre: 'X', motivo: 'Antes' };
    expect(sellarCambios([guardado], 'Otra')).toEqual([guardado]);
  });
});

describe('faltaRazonGeneral', () => {
  const quitar = () => conRenglonQuitado([], fila, 'No asistió')[0];
  const horas = () => cambioHoras({ clave: 'b2', nomina: '601', nombre: 'RUIZ', horas: {} }, '2026-11-13', 4, '');
  it('si todos los cambios nuevos ya traen su motivo, no hay que preguntar nada más', () => {
    expect(faltaRazonGeneral([quitar()])).toBe(false);
    expect(faltaRazonGeneral([])).toBe(false);
  });
  it('un cambio de horas (o reemplazo, o de motivo) sin motivo sí pide la razón general', () => {
    expect(faltaRazonGeneral([quitar(), horas()])).toBe(true);
  });
  it('lo ya guardado no cuenta', () => {
    expect(faltaRazonGeneral([{ tipo: TIPOS_CAMBIO.QUITAR, clave: 'x', nomina: '1', nombre: 'X', motivo: 'Antes' }])).toBe(false);
  });
});
