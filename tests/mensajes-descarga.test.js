import { describe, expect, it } from 'vitest';
import { textoDescarga } from '../src/utils/mensajesDescarga.js';

describe('textoDescarga', () => {
  it('con el nombre del archivo y dónde buscarlo', () => {
    expect(textoDescarga('Transporte_2026-11-13.xlsx')).toBe('Se descargó «Transporte_2026-11-13.xlsx». Ábrelo desde el ícono de descargas del navegador (arriba a la derecha) o en la carpeta Descargas de tu computadora.');
  });
  it('sin nombre, dice qué se descargó', () => {
    expect(textoDescarga('', 'el Excel de Producción')).toMatch(/^Se descargó el Excel de Producción\. Ábrelo desde el ícono de descargas/);
    expect(textoDescarga()).toMatch(/^Se descargó el Excel\./);
  });
});
