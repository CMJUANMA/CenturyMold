import { describe, expect, it } from 'vitest';
import { GRACIA_NAVEGACION_MS, alNavegar } from '../src/utils/recordatoriosPantalla.js';

const t0 = 1_000_000;
const r = (id, extra = {}) => ({ id, creado: t0, ruta: null, ...extra });

describe('recordatorios por pantalla', () => {
  it('uno recién creado acompaña la navegación que provoca la acción (enviar → Mis solicitudes)', () => {
    const [x] = alNavegar([r(1)], '/tiempo-extra/mis-solicitudes', t0 + 400);
    expect(x.ruta).toBe('/tiempo-extra/mis-solicitudes');
  });
  it('en la pantalla donde quedó se queda; al ir a otra desaparece', () => {
    const en = alNavegar([r(1)], '/a', t0 + 400);
    expect(alNavegar(en, '/a', t0 + 60_000)).toBe(en);
    expect(alNavegar(en, '/b', t0 + 61_000)).toEqual([]);
  });
  it('si ya pasó el tiempo de gracia, cualquier cambio de pantalla lo quita', () => {
    expect(alNavegar([r(1)], '/b', t0 + GRACIA_NAVEGACION_MS + 1)).toEqual([]);
  });
  it('solo acompaña una vez: el segundo cambio lo quita aunque sea inmediato', () => {
    const uno = alNavegar([r(1)], '/a', t0 + 100);
    expect(alNavegar(uno, '/b', t0 + 200)).toEqual([]);
  });
  it('se queda la de esta pantalla y se quita la de otra', () => {
    const lista = [r(1, { ruta: '/a' }), r(2, { ruta: '/b' })];
    expect(alNavegar(lista, '/a', t0 + 99999).map(x => x.id)).toEqual([1]);
  });
});
