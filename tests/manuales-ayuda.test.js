// Sección «Ayuda»: a cada persona le toca el manual de cada rol que tiene. Datos ficticios. Ejecutar con: npm run test:unit
import { describe, expect, it } from 'vitest';
import { MANUALES, manualesDeUsuario, rutaGuiaRapida, rutaManual } from '../src/utils/manuales.js';

const archivos = (a) => manualesDeUsuario(a).map(m => m.archivo);

describe('manualesDeUsuario', () => {
  it('cada rol trae su manual', () => {
    expect(archivos({ areasSolicitante: ['moldes'] })).toEqual(['solicitante']);
    // quien puede capturar tiempo extra (Aut. 1, Aut. 2, RH) ve también el manual del solicitante, donde está cómo se captura
    expect(archivos({ areasAut1: ['moldes'] })).toEqual(['solicitante', 'autorizador-1']);
    expect(archivos({ esAut2: true })).toEqual(['solicitante', 'autorizador-2']);
    expect(archivos({ esRH: true })).toEqual(['solicitante', 'rh']);
    expect(archivos({ esNomina: true })).toEqual(['nominas']);
  });
  it('quien tiene varios roles ve el manual de cada uno, en orden', () => {
    expect(archivos({ areasSolicitante: ['moldes'], areasAut1: ['moldes'], esAut2: true })).toEqual(['solicitante', 'autorizador-1', 'autorizador-2']);
    expect(archivos({ esRH: true, esAut2: true })).toEqual(['solicitante', 'autorizador-2', 'rh']);
  });
  it('el administrador tiene todos los permisos: ve los cinco', () => {
    expect(archivos({ esAdmin: true })).toEqual(MANUALES.map(m => m.archivo));
    expect(MANUALES).toHaveLength(5);
  });
  it('sin ningún rol no hay manual (la pantalla lo explica)', () => {
    expect(manualesDeUsuario({})).toEqual([]);
    expect(manualesDeUsuario(undefined)).toEqual([]);
    expect(manualesDeUsuario({ areasSolicitante: [], areasAut1: [], esAut2: false })).toEqual([]);
  });
  it('las rutas apuntan a los PDF publicados en /manuales/', () => {
    expect(rutaManual('rh')).toBe('/manuales/manual-rh.pdf');
    expect(rutaGuiaRapida('rh')).toBe('/manuales/guia-rapida-rh.pdf');
    expect(manualesDeUsuario({ esNomina: true })[0]).toMatchObject({ rol: 'Nóminas', manual: '/manuales/manual-nominas.pdf', guia: '/manuales/guia-rapida-nominas.pdf' });
  });
});
