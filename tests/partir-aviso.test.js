import { describe, expect, it } from 'vitest';
import { LARGO_MAXIMO_AVISO, partirAviso } from '../src/utils/partirAviso.js';

const ERROR_FIRESTORE = 'No se pudo enviar: 7 PERMISSION_DENIED: Unable to evaluate the expression as the maximum of 1000 expressions to evaluate has been reached. for \'update\' @ L759, ' + [771, 782, 792, 802, 810, 820].map(l => `false for 'update' @ L${l}`).join(', ');

describe('partirAviso (avisos que nunca ocupan media pantalla)', () => {
  it('un mensaje corto queda igual, sin detalle', () => {
    expect(partirAviso('Borrador guardado.')).toEqual({ msg: 'Borrador guardado.', detalle: '' });
  });
  it('el detalle que se da explícitamente se conserva', () => {
    expect(partirAviso('No se pudo enviar. Tu borrador está guardado.', 'PERMISSION_DENIED')).toEqual({ msg: 'No se pudo enviar. Tu borrador está guardado.', detalle: 'PERMISSION_DENIED' });
  });
  it('un mensaje largo se recorta en un espacio y el texto completo pasa al detalle', () => {
    const r = partirAviso(ERROR_FIRESTORE);
    expect(r.msg.length).toBeLessThanOrEqual(LARGO_MAXIMO_AVISO + 1);
    expect(r.msg.endsWith('…')).toBe(true);
    expect(r.msg).not.toMatch(/\s…$/);
    expect(r.detalle).toBe(ERROR_FIRESTORE);
  });
  it('con detalle propio y mensaje largo, el detalle va primero y luego el texto completo', () => {
    expect(partirAviso(ERROR_FIRESTORE, 'extra').detalle).toBe(`extra\n\n${ERROR_FIRESTORE}`);
  });
  it('sin espacios para cortar, corta en el máximo', () => {
    expect(partirAviso('x'.repeat(400)).msg).toBe('x'.repeat(LARGO_MAXIMO_AVISO) + '…');
  });
  it('null o indefinido no truenan', () => {
    expect(partirAviso(undefined)).toEqual({ msg: '', detalle: '' });
  });
});
