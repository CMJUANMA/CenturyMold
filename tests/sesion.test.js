// Sesión: la marca de actividad de una sesión que terminó no debe cerrar la sesión siguiente, y nada de una cuenta pasa a otra.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LIMITE_INACTIVIDAD_MS, crearMarca, estadoInactividad, leerMarca, ultimaActividad } from '../src/utils/inactividad.js';

const leer = (f) => readFileSync(f, 'utf8');

describe('marca de última actividad', () => {
  const t0 = Date.parse('2026-10-19T10:00:00Z');
  it('es de una cuenta: otra cuenta, vacía o mal formada vale 0', () => {
    expect(leerMarca(crearMarca('uidA', t0), 'uidA')).toBe(t0);
    expect(leerMarca(crearMarca('uidA', t0), 'uidB')).toBe(0);
    expect(leerMarca(null, 'uidA')).toBe(0);
    expect(leerMarca('basura', 'uidA')).toBe(0);
    expect(leerMarca(String(t0), 'uidA')).toBe(0); // formato anterior (solo la hora) ya no cuenta
    expect(leerMarca(crearMarca('uidA', t0), undefined)).toBe(0);
  });
  it('escenario del error: marca vencida de la sesión anterior NO vence la sesión nueva', () => {
    const ahora = t0 + 3 * 3600_000;
    const vieja = crearMarca('uidA', t0); // quedó al cerrar por inactividad
    // Sin arreglo: la sesión nueva leía la marca vieja y estaba «vencida» al instante
    expect(estadoInactividad(ahora, leerMarca(vieja, 'uidA')).estado).toBe('vencida');
    // Con arreglo: el login escribe la marca de AHORA (misma cuenta) y otra cuenta ignora la vieja
    const nueva = crearMarca('uidA', ahora);
    expect(estadoInactividad(ahora, ultimaActividad(ahora, leerMarca(nueva, 'uidA'))).estado).toBe('activa');
    expect(estadoInactividad(ahora, ultimaActividad(ahora, leerMarca(vieja, 'uidB'))).estado).toBe('activa');
  });
  it('el límite sigue siendo de 30 minutos', () => { expect(LIMITE_INACTIVIDAD_MS).toBe(30 * 60 * 1000); });
});

describe('cableado de la sesión', () => {
  const auth = leer('src/context/AuthContext.jsx');
  const cierre = leer('src/components/CierrePorInactividad.jsx');
  it('el login reinicia la marca de actividad y la limpieza corre al terminar la sesión', () => {
    expect(auth).toContain('crearMarca(cred.user.uid, Date.now())');
    expect(auth).toContain('limpiarEstadoDeSesion()');
    expect(leer('src/utils/sesion.js')).toContain('removeItem(CLAVE_ULTIMA_ACTIVIDAD)');
  });
  it('el temporizador solo corre con sesión (uid) y lee solo la marca de esa cuenta', () => {
    expect(cierre).toContain('if (!uid) return undefined');
    expect(cierre).toContain('leerMarca(localStorage.getItem(CLAVE_ULTIMA_ACTIVIDAD), uid)');
  });
  it('el borrador del cierre se ofrece solo a la misma cuenta', () => {
    expect(auth).toContain('previo?.uid === cred.user.uid && previo.borradorGuardado');
  });
  it('al cerrar sesión o cambiar de cuenta todo el estado de la interfaz se recrea (avisos, toasts, filtros, catálogos)', () => {
    const app = leer('src/App.jsx');
    expect(app).toContain('function AislarSesion');
    expect(app.indexOf('<AislarSesion>')).toBeLessThan(app.indexOf('<ToastProvider>'));
    expect(app.indexOf('<AislarSesion>')).toBeLessThan(app.indexOf('<RecordatoriosProvider>'));
    expect(app.indexOf('<AislarSesion>')).toBeLessThan(app.indexOf('<RouterProvider'));
    expect(app).toContain('estado.uid ? estado.epoca + 1 : estado.epoca'); // entrar desde el login no remonta
  });
});
