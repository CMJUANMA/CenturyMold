// Restablecer acceso: las partes puras (perfil nuevo, bitácora, enlaces y mensajes). Las reglas se prueban en firestore.rules.restablecer.test.js.
import { describe, expect, it } from 'vitest';
import {
  ACCION_RESTABLECER, correoDeNomina, idBitacoraRestablecer, mensajeErrorRestablecer, perfilRestablecido, registroRestablecimiento, urlConsolaAuth,
} from '../src/utils/restablecerAcceso.js';
import { generarPassword } from '../src/utils/passwordTemporal.js';
import * as accesosIniciales from '../src/utils/accesosIniciales.js';

describe('perfil que pasa al uid nuevo', () => {
  const viejo = { uid: 'abc', nomina: '5001', nombre: 'Marco', rol: 'usuario', activo: true, debeCambiarPassword: false, preferencias: { tema: 'oscuro', ayudas: false } };
  it('conserva rol, preferencias, nómina y nombre; exige cambiar la contraseña; no lleva el uid viejo', () => {
    const nuevo = perfilRestablecido(viejo);
    expect(nuevo).toEqual({ nomina: '5001', nombre: 'Marco', rol: 'usuario', activo: true, debeCambiarPassword: true, preferencias: { tema: 'oscuro', ayudas: false } });
    expect(nuevo).not.toHaveProperty('uid');
  });
  it('no modifica el perfil original', () => {
    perfilRestablecido(viejo);
    expect(viejo.debeCambiarPassword).toBe(false);
    expect(viejo.uid).toBe('abc');
  });
  it('un usuario desactivado sigue desactivado', () => {
    expect(perfilRestablecido({ ...viejo, activo: false }).activo).toBe(false);
  });
});

describe('bitácora del restablecimiento', () => {
  const r = registroRestablecimiento({ uidViejo: 'v1', uidNuevo: 'n1', perfil: { nomina: 5001, nombre: 'Marco', rol: 'usuario' } }, { uid: 'rh1', nombre: 'Ana de RH' });
  it('dice quién restableció a quién, con uid viejo y nuevo', () => {
    expect(r).toEqual({
      accion: ACCION_RESTABLECER, entidad: 'usuarios/n1', antes: { uid: 'v1' }, despues: { uid: 'n1', nomina: '5001', nombre: 'Marco' },
      porUid: 'rh1', porNombre: 'Ana de RH',
    });
  });
  it('nunca incluye una contraseña', () => {
    expect(JSON.stringify(r).toLowerCase()).not.toMatch(/password|contrase|CM-/i);
  });
  it('el id del renglón es predecible: lo exigen las reglas', () => { expect(idBitacoraRestablecer('v1')).toBe('restablecer-v1'); });
});

describe('enlaces y mensajes', () => {
  it('la consola abre Authentication del proyecto', () => {
    expect(urlConsolaAuth('solicitud-rutas')).toBe('https://console.firebase.google.com/project/solicitud-rutas/authentication/users');
  });
  it('el correo interno sale de la nómina', () => { expect(correoDeNomina(' 5001 ')).toBe('5001@rutas.app'); });
  it('si la cuenta sigue en Firebase pide borrarla; otros errores se explican', () => {
    expect(mensajeErrorRestablecer({ code: 'auth/email-already-in-use' }, '5001')).toMatch(/5001@rutas\.app todavía existe/);
    expect(mensajeErrorRestablecer({ code: 'permission-denied' }, '5001')).toMatch(/permiso/);
    expect(mensajeErrorRestablecer({ code: 'auth/network-request-failed' }, '5001')).toMatch(/conexión/i);
    expect(mensajeErrorRestablecer({ cuentaHuerfana: true, message: 'x' }, '5001')).toMatch(/5001@rutas\.app/);
  });
});

describe('contraseña temporal', () => {
  it('es la misma función del lote (CM-XXXX-XXXX) y sigue exportada desde accesosIniciales', () => {
    expect(accesosIniciales.generarPassword).toBe(generarPassword);
    expect(generarPassword()).toMatch(/^CM-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });
});
