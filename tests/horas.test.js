// Cómo se muestran las horas: 12 h con a. m./p. m. en la app y 24 h con dos dígitos en el Excel del proveedor (src/utils/horas.js)
import { describe, expect, it } from 'vitest';
import { FORMATO_HORA_PROVEEDOR, etiquetaBloque12, formatoHora12, formatoHora24, horaParaProveedor, horasEnTexto12, minutosDeHoraTexto } from '../src/utils/horas.js';

describe('horas en 12 h (la app)', () => {
  it('los bloques de las rutas', () => {
    expect(['7:00', '16:00', '19:00', '0:00'].map(formatoHora12)).toEqual(['7:00 a. m.', '4:00 p. m.', '7:00 p. m.', '12:00 a. m.']);
  });
  it('mediodía y medianoche', () => {
    expect(formatoHora12('12:00')).toBe('12:00 p. m.');
    expect(formatoHora12('00:00')).toBe('12:00 a. m.');
    expect(formatoHora12('23:59')).toBe('11:59 p. m.');
    expect(formatoHora12('9:05')).toBe('9:05 a. m.');
  });
  it('acepta también lo que ya se guardó en el formato de rutas (4:00PM) y con dos dígitos', () => {
    expect(['7:00AM', '4:00PM', '7:00PM', '12:00AM', '12:00PM', '07:00'].map(formatoHora12)).toEqual(['7:00 a. m.', '4:00 p. m.', '7:00 p. m.', '12:00 a. m.', '12:00 p. m.', '7:00 a. m.']);
  });
  it('lo que no es una hora queda igual', () => {
    expect(formatoHora12('YA EN PLANTA')).toBe('YA EN PLANTA');
    expect(formatoHora12('NO REQUIERE')).toBe('NO REQUIERE');
    expect(formatoHora12('')).toBe('');
    expect(formatoHora12(null)).toBe('');
    expect(formatoHora12('25:00')).toBe('25:00');
    expect(formatoHora12('13:00PM')).toBe('13:00PM');
  });
  it('en un texto y en un bloque de horario', () => {
    expect(horasEnTexto12('7:00 → 16:00')).toBe('7:00 a. m. → 4:00 p. m.');
    expect(horasEnTexto12('Sin horario')).toBe('Sin horario');
    expect(horasEnTexto12('4:00PM → 12:00AM')).toBe('4:00 p. m. → 12:00 a. m.');
    expect(etiquetaBloque12({ horaEntrada: '16:00', horaSalida: '0:00' })).toBe('4:00 p. m. → 12:00 a. m.');
    expect(etiquetaBloque12({ horaEntrada: '16:00' })).toBe('Sin horario');
  });
  it('los datos no cambian: solo se interpreta la hora', () => {
    expect(minutosDeHoraTexto('4:00PM')).toBe(960);
    expect(minutosDeHoraTexto('4:00 p. m.')).toBe(960);
    expect(minutosDeHoraTexto('nada')).toBeNull();
  });
});

describe('horas del Excel del proveedor', () => {
  it('por defecto, 24 h con dos dígitos', () => {
    expect(FORMATO_HORA_PROVEEDOR).toBe('24h');
    expect(['7:00AM', '4:00PM', '7:00PM', '12:00AM', '7:00', '16:00', '0:00'].map(h => horaParaProveedor(h))).toEqual(['07:00', '16:00', '19:00', '00:00', '07:00', '16:00', '00:00']);
    expect(formatoHora24('12:00PM')).toBe('12:00');
  });
  it('los textos del formato (YA EN PLANTA, NO REQUIERE) se respetan', () => {
    expect(horaParaProveedor('YA EN PLANTA')).toBe('YA EN PLANTA');
    expect(horaParaProveedor('NO REQUIERE')).toBe('NO REQUIERE');
    expect(horaParaProveedor('')).toBe('');
  });
  it('con la constante en "12h" vuelve al formato de rutas (4:00PM)', () => {
    expect(['7:00', '16:00', '0:00', '12:00PM'].map(h => horaParaProveedor(h, '12h'))).toEqual(['7:00AM', '4:00PM', '12:00AM', '12:00PM']);
  });
});
