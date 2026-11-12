// Atajos de fecha del editor de tiempo extra: «Mañana» y «Próximo sábado». Ejecutar con: npm run test:unit
import { describe, expect, it } from 'vitest';
import { manana, proximoDomingo, proximoSabado, ymd } from '../src/utils/fechas.js';

describe('manana', () => {
  it('es el día siguiente, también al cambiar de mes y de año', () => {
    expect(manana('2026-11-12')).toBe('2026-11-13');
    expect(manana('2026-11-30')).toBe('2026-12-01');
    expect(manana('2026-12-31')).toBe('2027-01-01');
  });
});

describe('proximoSabado', () => {
  it('de lunes a viernes es el sábado de esa semana (12 nov 2026 es jueves)', () => {
    expect(proximoSabado('2026-11-09')).toBe('2026-11-14'); // lunes
    expect(proximoSabado('2026-11-12')).toBe('2026-11-14'); // jueves
    expect(proximoSabado('2026-11-13')).toBe('2026-11-14'); // viernes
  });
  it('en sábado va al sábado siguiente; en domingo, al de esa semana', () => {
    expect(proximoSabado('2026-11-14')).toBe('2026-11-21');
    expect(proximoSabado('2026-11-15')).toBe('2026-11-21');
  });
  it('cruza de mes y de año', () => {
    expect(proximoSabado('2026-12-28')).toBe('2027-01-02');
  });
  it('siempre cae en sábado y es posterior a hoy', () => {
    for (let d = 0; d < 21; d++) {
      const hoy = new Date(2026, 10, 1 + d);
      const [a, m, dd] = proximoSabado(ymd(hoy)).split('-').map(Number);
      expect(new Date(a, m - 1, dd).getDay()).toBe(6);
      expect(new Date(a, m - 1, dd) > hoy).toBe(true);
    }
  });
});

describe('proximoDomingo', () => {
  it('el primer domingo después de hoy (12 nov 2026 es jueves)', () => {
    expect(proximoDomingo('2026-11-12')).toBe('2026-11-15');
    expect(proximoDomingo('2026-11-14')).toBe('2026-11-15'); // sábado
    expect(proximoDomingo('2026-11-15')).toBe('2026-11-22'); // si hoy es domingo, el siguiente
    expect(proximoDomingo('2026-12-28')).toBe('2027-01-03');
  });
});
