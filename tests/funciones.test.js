// Interruptor de funciones (src/funciones.js): con transporteSuelto apagado no hay camino a "Nueva solicitud" de transporte,
// "Mis solicitudes" de transporte, editar transporte ni "Transporte (consulta)"; encendido, vuelven.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FUNCIONES, RUTAS_TRANSPORTE_SUELTO, RUTA_EDITAR_TRANSPORTE, esRutaTransporteSuelto, funcionActiva, rutaDisponible, rutaEditarTransporte,
} from '../src/funciones.js';
import { ITEMS_MENU_RH, itemsMenuPorRol, itemsMenuRH } from '../src/utils/navegacion.js';

const APAGADO = { transporteSuelto: false };
const ENCENDIDO = { transporteSuelto: true };
const idsModulos = new Set(['rutas', 'tiempo-extra']);
const todosLosMenus = (funciones) => [
  ...itemsMenuRH({ esRH: true, idsModulos, funciones }),
  ...itemsMenuPorRol({ esAut2: true, areasAut1: ['moldes'], areasSolicitante: ['moldes'], transporteAnterior: true, funciones }),
  ...itemsMenuPorRol({ esAut2: false, areasAut1: [], areasSolicitante: ['moldes'], transporteAnterior: true, funciones }),
].filter(i => !i.section);

describe('interruptor transporteSuelto', () => {
  it('en el código entregado está apagado', () => {
    expect(FUNCIONES.transporteSuelto).toBe(false);
    expect(funcionActiva('transporteSuelto')).toBe(false);
  });

  it('apagado: ninguna ruta de transporte suelto está disponible (nueva, editar con id, mis solicitudes)', () => {
    for (const ruta of [RUTAS_TRANSPORTE_SUELTO.nueva, RUTAS_TRANSPORTE_SUELTO.misSolicitudes, rutaEditarTransporte('abc123'), RUTA_EDITAR_TRANSPORTE]) {
      expect(esRutaTransporteSuelto(ruta)).toBe(true);
      expect(rutaDisponible(ruta, APAGADO)).toBe(false);
    }
    expect(rutaDisponible('/tiempo-extra/nueva', APAGADO)).toBe(true);
  });

  it('apagado: ningún menú (RH, admin, Aut. 2, Aut. 1, solicitante) lleva a esas pantallas, aunque tenga transporte anterior', () => {
    const rutas = todosLosMenus(APAGADO).map(i => i.path);
    expect(rutas.filter(esRutaTransporteSuelto)).toEqual([]);
    expect(todosLosMenus(APAGADO).map(i => i.id)).not.toContain('transporte');
  });

  it('encendido: vuelven al menú y a las rutas', () => {
    const rutas = todosLosMenus(ENCENDIDO).map(i => i.path);
    expect(rutas).toContain(RUTAS_TRANSPORTE_SUELTO.nueva);
    expect(rutas).toContain(RUTAS_TRANSPORTE_SUELTO.misSolicitudes);
    expect(todosLosMenus(ENCENDIDO).map(i => i.id)).toContain('transporte');
    for (const ruta of Object.values(RUTAS_TRANSPORTE_SUELTO)) expect(rutaDisponible(ruta, ENCENDIDO)).toBe(true);
  });

  it('las entradas del menú de RH que dependen del interruptor están marcadas', () => {
    const marcadas = ITEMS_MENU_RH.filter(i => i.funcion === 'transporteSuelto').map(i => i.path);
    expect(marcadas.sort()).toEqual([RUTAS_TRANSPORTE_SUELTO.nueva, RUTAS_TRANSPORTE_SUELTO.misSolicitudes].sort());
  });

  it('el menú de RH sin esas dos entradas conserva el resto', () => {
    const apagado = itemsMenuRH({ esRH: true, idsModulos, funciones: APAGADO }).filter(i => !i.section).map(i => i.path);
    const encendido = itemsMenuRH({ esRH: true, idsModulos, funciones: ENCENDIDO }).filter(i => !i.section).map(i => i.path);
    expect(encendido.filter(p => !apagado.includes(p)).sort()).toEqual([RUTAS_TRANSPORTE_SUELTO.nueva, RUTAS_TRANSPORTE_SUELTO.misSolicitudes].sort());
  });
});

describe('ningún enlace directo a las pantallas ocultas', () => {
  const archivos = (dir) => readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : /\.(jsx?|mjs)$/.test(n) ? [p] : [];
  });
  const PROHIBIDAS = ['/transporte/nueva', '/transporte/mis-solicitudes', '/transporte/editar'];

  it('solo funciones.js escribe esas URLs; el resto usa las constantes', () => {
    const intrusos = archivos('src').filter(f => !f.endsWith('funciones.js') && PROHIBIDAS.some(u => readFileSync(f, 'utf8').includes(u)));
    expect(intrusos).toEqual([]);
  });

  it('App.jsx registra esas rutas solo dentro de RutaFuncion', () => {
    const app = readFileSync('src/App.jsx', 'utf8');
    const inicio = app.indexOf('<RutaFuncion funcion="transporteSuelto" />');
    expect(inicio).toBeGreaterThan(0);
    // el bloque termina en el siguiente comentario de sección
    const fin = app.indexOf('// Módulo de transporte', inicio);
    const bloque = app.slice(inicio, fin > 0 ? fin : undefined);
    for (const c of ['RUTAS_TRANSPORTE_SUELTO.misSolicitudes', 'RUTAS_TRANSPORTE_SUELTO.nueva', 'RUTA_EDITAR_TRANSPORTE']) expect(bloque).toContain(c);
    const fuera = app.slice(0, inicio) + app.slice(inicio + bloque.length);
    expect(fuera).not.toMatch(/path:\s*(RUTAS_TRANSPORTE_SUELTO|RUTA_EDITAR_TRANSPORTE)/);
  });
});
