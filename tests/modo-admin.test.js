// MODO ADMIN (utils/modoAdmin.js): accesos ampliados, marcas y confirmación antes de escribir.
import { afterEach, describe, expect, it } from 'vitest';
import {
  AccionAdminCancelada, accesosEnModoAdmin, confirmarAccionAdmin, fijarModoAdmin, marcaAdmin, marcaAdminHistorial, modoAdminActivo, nombreConAdmin, registrarConfirmacionAdmin,
} from '../src/utils/modoAdmin.js';
import { filtrarSolicitudes } from '../src/utils/tiempoExtra.js';
import { accesosDePerfil } from '../src/utils/permisos.js';

afterEach(() => { fijarModoAdmin(false); registrarConfirmacionAdmin(null); });

describe('accesos en modo admin', () => {
  const admin = accesosDePerfil({ rol: 'admin' });
  it('encendido: Aut. 2, Aut. 1 y solicitante de todas las áreas que participan; guarda los accesos reales', () => {
    const a = accesosEnModoAdmin(admin, ['mantenimiento', 'produccion'], true);
    expect(a).toMatchObject({ modoAdmin: true, esAut2: true, esAdmin: true, esRH: true, areasAut1: ['mantenimiento', 'produccion'], areasSolicitante: ['mantenimiento', 'produccion'], tieneAcceso: true });
    expect(a.reales.esAut2).toBe(false);
    expect(a.reales.areasAut1).toEqual([]);
  });
  it('apagado: los accesos no cambian', () => {
    const a = accesosEnModoAdmin(admin, ['produccion'], false);
    expect(a).toMatchObject({ modoAdmin: false, esAut2: false, areasAut1: [] });
  });
  it('nadie que no sea admin gana nada, aunque el modo esté encendido', () => {
    for (const rol of ['rh', 'nomina', 'usuario']) {
      const a = accesosEnModoAdmin(accesosDePerfil({ rol }), ['produccion'], true);
      expect(a).toMatchObject({ modoAdmin: false, esAut2: false, areasAut1: [], areasSolicitante: [] });
    }
  });
});

describe('marcas', () => {
  it('apagado no marca nada', () => {
    expect(modoAdminActivo()).toBe(false);
    expect(marcaAdmin()).toEqual({});
    expect(marcaAdminHistorial()).toEqual({});
  });
  it('encendido marca la solicitud (accionAdmin) y el historial (admin)', () => {
    fijarModoAdmin(true);
    expect(marcaAdmin()).toEqual({ accionAdmin: true });
    expect(marcaAdminHistorial()).toEqual({ admin: true });
  });
  it('el nombre lleva «(admin)» solo si la acción fue en modo admin; nunca cambia el nombre', () => {
    expect(nombreConAdmin('Juan Manuel Jaramillo', true)).toBe('Juan Manuel Jaramillo (admin)');
    expect(nombreConAdmin('Juan Manuel Jaramillo', false)).toBe('Juan Manuel Jaramillo');
  });
});

describe('confirmar antes de escribir', () => {
  it('apagado no pregunta nada', async () => {
    let preguntas = 0;
    registrarConfirmacionAdmin(async () => { preguntas++; return true; });
    await confirmarAccionAdmin('Autorizar');
    expect(preguntas).toBe(0);
  });
  it('encendido pregunta con la frase de la acción y sigue si acepta', async () => {
    fijarModoAdmin(true);
    const vistas = [];
    registrarConfirmacionAdmin(async (frase) => { vistas.push(frase); return true; });
    await confirmarAccionAdmin('Autorizar (Aut. 2) la solicitud TE-2026-0007.');
    expect(vistas).toEqual(['Autorizar (Aut. 2) la solicitud TE-2026-0007.']);
  });
  it('si no acepta, lanza AccionAdminCancelada y no se escribe nada', async () => {
    fijarModoAdmin(true);
    registrarConfirmacionAdmin(async () => false);
    await expect(confirmarAccionAdmin('Cancelar')).rejects.toBeInstanceOf(AccionAdminCancelada);
  });
});

describe('filtro «Acciones de admin»', () => {
  const lista = [{ id: 'a', accionAdmin: true, estatus: 'autorizada' }, { id: 'b', estatus: 'autorizada' }, { id: 'c', accionAdmin: false, estatus: 'autorizada' }];
  it('deja solo las solicitudes con acciones de admin', () => {
    expect(filtrarSolicitudes(lista, { accionAdmin: true }).map(t => t.id)).toEqual(['a']);
    expect(filtrarSolicitudes(lista, {}).map(t => t.id)).toEqual(['a', 'b', 'c']);
  });
});
