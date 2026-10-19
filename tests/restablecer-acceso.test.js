// Restablecer acceso: las partes puras (perfil nuevo, bitácora, enlaces y mensajes). Las reglas se prueban en firestore.rules.restablecer.test.js.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ACCION_RESTABLECER, idBitacoraRestablecer, mensajeErrorRestablecer, perfilRestablecido, registroRestablecimiento,
} from '../src/utils/restablecerAcceso.js';
import { correoDeAcceso, nominaValidaParaAcceso, versionDe } from '../src/utils/accesos.js';
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

describe('accesos: qué correo usa cada nómina', () => {
  it('versión 1 = {nomina}@rutas.app (también sin documento); versión N = {nomina}.vN@rutas.app', () => {
    expect(correoDeAcceso(' 5001 ')).toBe('5001@rutas.app');
    expect(correoDeAcceso('5001', 1)).toBe('5001@rutas.app');
    expect(correoDeAcceso('5001', 2)).toBe('5001.v2@rutas.app');
    expect(correoDeAcceso('5001', 12)).toBe('5001.v12@rutas.app');
  });
  it('un documento ausente, roto o con versión rara vale versión 1', () => {
    expect(versionDe(undefined)).toBe(1);
    expect(versionDe(null)).toBe(1);
    expect(versionDe({})).toBe(1);
    expect(versionDe({ version: 'x' })).toBe(1);
    expect(versionDe({ version: 0 })).toBe(1);
    expect(versionDe({ version: 2.5 })).toBe(1);
    expect(versionDe({ version: 3 })).toBe(3);
  });
  it('una nómina con diagonal, espacios o vacía no se consulta (el login usa la versión 1)', () => {
    expect(nominaValidaParaAcceso('5001')).toBe(true);
    expect(nominaValidaParaAcceso('a/b')).toBe(false);
    expect(nominaValidaParaAcceso('50 01')).toBe(false);
    expect(nominaValidaParaAcceso('')).toBe(false);
  });
});

describe('mensajes y flujo sin consola', () => {
  it('los errores se explican y nunca mandan a borrar la cuenta en la consola', () => {
    expect(mensajeErrorRestablecer({ code: 'auth/email-already-in-use' }, '5001', 2)).toMatch(/5001.v2@rutas.app/);
    expect(mensajeErrorRestablecer({ code: 'permission-denied' }, '5001')).toMatch(/permiso/);
    expect(mensajeErrorRestablecer({ code: 'auth/network-request-failed' }, '5001')).toMatch(/conexión/i);
    expect(mensajeErrorRestablecer({ cuentaHuerfana: true, message: 'x' }, '5001', 3)).toMatch(/5001.v3@rutas.app/);
    expect(mensajeErrorRestablecer({ code: 'auth/email-already-in-use' }, '5001', 2)).toMatch(/Sistemas/);
  });
  it('el asistente viejo (enlace a Firebase Console, «ya borré la cuenta») ya no existe', () => {
    const modal = readFileSync('src/pages/rh/accesos/ModalRestablecerPassword.jsx', 'utf8');
    expect(modal).not.toMatch(/console.firebase|Delete account|Ya elimin/);
    expect(() => readFileSync('src/pages/rh/accesos/ModalRestablecerAcceso.jsx', 'utf8')).toThrow();
    expect(readFileSync('src/utils/restablecerAcceso.js', 'utf8')).not.toContain('urlConsolaAuth');
  });
  it('el flujo: cuenta de la versión siguiente → lote (perfil, accesos, bitácora) → revertir si falla; el login lee accesos', () => {
    const db = readFileSync('src/utils/restablecerAccesoDb.js', 'utf8');
    expect(db).toContain('correoDeAcceso(nomina, version)');
    expect(db).toContain("lote.set(doc(db, 'accesos', nomina), { version, uid: uidNuevo })");
    expect(db.indexOf('lote.commit()')).toBeLessThan(db.indexOf('deleteUser(cred.user)'));
    expect(db).toContain('Nadie restablece su propia contraseña');
    const auth = readFileSync('src/context/AuthContext.jsx', 'utf8');
    expect(auth).toContain('leerAcceso(nomina)');
    expect(auth).toContain('correoDeAcceso(nomina, version)');
    const alta = readFileSync('src/utils/usuariosDb.js', 'utf8');
    expect(alta).toContain("lote.set(doc(db, 'accesos', n), { version, uid })");
  });
  it('la bitácora lleva la versión nueva y nunca la contraseña', () => {
    const r = registroRestablecimiento({ uidViejo: 'v1', uidNuevo: 'n1', perfil: { nomina: 5001, nombre: 'Marco' }, version: 2 }, { uid: 'rh1', nombre: 'Ana' });
    expect(r.despues).toEqual({ uid: 'n1', nomina: '5001', nombre: 'Marco', version: 2 });
    expect(JSON.stringify(r)).not.toMatch(/CM-/);
  });
});

describe('contraseña temporal', () => {
  it('es la misma función del lote (CM-XXXX-XXXX) y sigue exportada desde accesosIniciales', () => {
    expect(accesosIniciales.generarPassword).toBe(generarPassword);
    expect(generarPassword()).toMatch(/^CM-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });
});
