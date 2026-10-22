// Seguridad del cliente y del hosting: política de contraseñas, cierre por inactividad, encabezados de seguridad y revisiones del código.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { PASSWORD_MIN, errorPasswordNueva } from '../src/utils/passwordPolitica.js';
import { MSG_BORRADOR_GUARDADO, guardarBorradorAntesDeCerrar, mensajeCierreInactividad, registrarGuardador } from '../src/utils/guardadoAutomatico.js';
import { AVISO_INACTIVIDAD_MS, LIMITE_INACTIVIDAD_MS, estadoInactividad, ultimaActividad } from '../src/utils/inactividad.js';

const archivos = (dir, ext = /\.(js|jsx)$/) => readdirSync(dir).flatMap(n => {
  const f = join(dir, n);
  return statSync(f).isDirectory() ? archivos(f, ext) : ext.test(f) ? [f] : [];
});
const leer = (f) => readFileSync(f, 'utf8');

describe('política de contraseñas', () => {
  it('pide 8 caracteres, con letra y número', () => {
    expect(PASSWORD_MIN).toBe(8);
    expect(errorPasswordNueva('abc123')).toMatch(/8 caracteres/);
    expect(errorPasswordNueva('abcdefgh')).toMatch(/letra y un número/);
    expect(errorPasswordNueva('12345678')).toMatch(/letra y un número/);
    expect(errorPasswordNueva('Rutas2026')).toBeNull();
    expect(errorPasswordNueva('Contraseña9')).toBeNull();
  });
  it('rechaza la nómina, las contraseñas obvias y repetir la anterior', () => {
    expect(errorPasswordNueva('Juan50532x', { nomina: '50532' })).toMatch(/nómina/);
    expect(errorPasswordNueva('Password1')).toMatch(/fácil/);
    expect(errorPasswordNueva('CenturyMold1')).toMatch(/fácil/);
    expect(errorPasswordNueva('Abcd1234x', { anteriores: ['Abcd1234x'] })).toMatch(/distinta/);
    expect(errorPasswordNueva('Abcd1234x', { anteriores: ['', undefined, 'otra'] })).toBeNull();
  });
  it('la usan el primer acceso y Mi cuenta', () => {
    for (const f of ['src/pages/CambiarPassword.jsx', 'src/pages/MiCuenta.jsx']) expect(leer(f), f).toContain('errorPasswordNueva');
  });
});

describe('cierre por inactividad', () => {
  const t0 = 1_000_000_000_000;
  it('30 minutos de límite y 1 minuto de aviso', () => {
    expect(LIMITE_INACTIVIDAD_MS).toBe(30 * 60 * 1000);
    expect(AVISO_INACTIVIDAD_MS).toBe(60 * 1000);
  });
  it('activa → aviso → vencida', () => {
    expect(estadoInactividad(t0 + 5 * 60_000, t0)).toMatchObject({ estado: 'activa' });
    expect(estadoInactividad(t0 + 20 * 60_000, t0)).toMatchObject({ estado: 'activa' }); // a los 20 min (pasado el límite anterior de 15) sigue activa
    expect(estadoInactividad(t0 + 29 * 60_000 + 1, t0)).toMatchObject({ estado: 'aviso' });
    expect(estadoInactividad(t0 + 29 * 60_000 + 30_000, t0).restanteMs).toBe(30_000);
    expect(estadoInactividad(t0 + 30 * 60_000, t0)).toEqual({ estado: 'vencida', restanteMs: 0 });
    expect(estadoInactividad(t0 + 3 * 3600_000, t0).estado).toBe('vencida');
  });
  it('cuenta la actividad más reciente entre pestañas y no se confunde con valores raros', () => {
    expect(ultimaActividad(10, 20)).toBe(20);
    expect(ultimaActividad(30, 20)).toBe(30);
    expect(ultimaActividad(30, 'basura')).toBe(30);
    expect(ultimaActividad(0, null)).toBe(0);
  });
  it('se monta en las rutas protegidas y AuthContext sabe cerrar por inactividad', () => {
    expect(leer('src/components/RutaProtegida.jsx')).toContain('CierrePorInactividad');
    expect(leer('src/context/AuthContext.jsx')).toContain('cerrarPorInactividad');
  });
});

describe('guardar el borrador antes de cerrar por inactividad', () => {
  it('el mensaje exacto y el aviso en el login solo cuando sí se guardó un borrador', () => {
    expect(MSG_BORRADOR_GUARDADO).toBe('Guardamos tu borrador antes de cerrar la sesión');
    expect(mensajeCierreInactividad('Tu sesión se cerró.', true)).toBe('Tu sesión se cerró. Guardamos tu borrador antes de cerrar la sesión.');
    expect(mensajeCierreInactividad('Tu sesión se cerró.', false)).toBe('Tu sesión se cerró.');
  });
  it('sin formulario abierto no guarda nada; con uno, lo llama y avisa que guardó', async () => {
    expect(await guardarBorradorAntesDeCerrar()).toBe(false);
    let llamadas = 0;
    const quitar = registrarGuardador(async () => { llamadas++; return true; });
    expect(await guardarBorradorAntesDeCerrar()).toBe(true);
    expect(llamadas).toBe(1);
    quitar();
    expect(await guardarBorradorAntesDeCerrar()).toBe(false);
  });
  it('si no había cambios que guardar responde que no; si falla, el cierre sigue (nunca lanza)', async () => {
    const q1 = registrarGuardador(async () => false);
    expect(await guardarBorradorAntesDeCerrar()).toBe(false);
    q1();
    const espia = vi.spyOn(console, 'error').mockImplementation(() => {});
    const q2 = registrarGuardador(async () => { throw new Error('sin red'); });
    expect(await guardarBorradorAntesDeCerrar()).toBe(false);
    q2();
    espia.mockRestore();
  });
  it('el formulario se registra, el cierre guarda antes de salir y AuthContext arma el mensaje', () => {
    expect(leer('src/pages/te/EditorTE.jsx')).toContain('registrarGuardador');
    const cierre = leer('src/components/CierrePorInactividad.jsx');
    expect(cierre.indexOf('guardarBorradorAntesDeCerrar()')).toBeGreaterThan(-1);
    expect(cierre.indexOf('guardarBorradorAntesDeCerrar()')).toBeLessThan(cierre.indexOf('await cerrarPorInactividad({ borradorGuardado })'));
    expect(leer('src/context/AuthContext.jsx')).toContain('MSG_BORRADOR_GUARDADO');
  });
});

describe('encabezados de seguridad del hosting (firebase.json)', () => {
  const cfgCompleta = JSON.parse(leer('firebase.json'));
  // El hosting es una lista de sitios (portal nuevo y sitio anterior): se revisa el del portal
  const cfg = { ...cfgCompleta, hosting: Array.isArray(cfgCompleta.hosting) ? cfgCompleta.hosting.find(h => h.target === 'portal') : cfgCompleta.hosting };
  const todos = Object.fromEntries(cfg.hosting.headers.find(h => h.source === '**').headers.map(h => [h.key.toLowerCase(), h.value]));
  const csp = Object.fromEntries((todos['content-security-policy'] ?? '').split(';').map(d => d.trim()).filter(Boolean).map(d => [d.split(' ')[0], d.split(' ').slice(1)]));

  it('trae todos los encabezados', () => {
    for (const k of ['content-security-policy', 'strict-transport-security', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy', 'cross-origin-opener-policy', 'cache-control']) {
      expect(todos[k], k).toBeTruthy();
    }
    expect(todos['x-content-type-options']).toBe('nosniff');
    expect(todos['x-frame-options']).toBe('DENY');
    expect(todos['strict-transport-security']).toMatch(/max-age=\d{7,}/);
  });
  it('la CSP no permite scripts en línea ni eval, ni que otros incrusten la app', () => {
    expect(csp['script-src']).toEqual(["'self'"]);
    expect(JSON.stringify(csp)).not.toContain('unsafe-eval');
    expect(csp['object-src']).toEqual(["'none'"]);
    expect(csp['frame-ancestors']).toEqual(["'none'"]);
    expect(csp['base-uri']).toEqual(["'self'"]);
    expect(csp['default-src']).toEqual(["'self'"]);
  });
  it('connect-src permite solo lo que la app usa (Firestore y Autenticación)', () => {
    expect(csp['connect-src'].sort()).toEqual(["'self'", 'https://firestore.googleapis.com', 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com'].sort());
  });
  it('los archivos con hash siguen cacheándose', () => {
    expect(cfg.hosting.headers.some(h => h.source === '/assets/**')).toBe(true);
  });
  it('index.html no tiene scripts en línea (la CSP no los dejaría correr)', () => {
    const scripts = [...leer('index.html').matchAll(/<script\b[^>]*>/g)].map(m => m[0]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const s of scripts) expect(s, s).toMatch(/\bsrc=/);
    expect(leer('public/tema-inicial.js')).toContain('cm_theme');
  });
});

describe('revisión del código del cliente', () => {
  const fuentes = archivos('src');
  it('sin HTML sin escapar, eval ni new Function', () => {
    const malos = fuentes.filter(f => /dangerouslySetInnerHTML|\.innerHTML\s*=|\binsertAdjacentHTML\b|\beval\s*\(|new Function\s*\(|document\.write\s*\(/.test(leer(f)));
    expect(malos).toEqual([]);
  });
  it('todo enlace que abre otra pestaña lleva rel="noopener noreferrer"', () => {
    for (const f of fuentes) {
      for (const m of leer(f).matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) expect(m[0], f).toMatch(/rel="[^"]*noopener[^"]*noreferrer[^"]*"/);
      expect(leer(f), f).not.toMatch(/window\.open\(/);
    }
  });
  it('sin console.log ni datos sensibles en el almacenamiento del navegador', () => {
    expect(fuentes.filter(f => /console\.log\(/.test(leer(f)))).toEqual([]);
    // Solo se guardan el tema, la hora de la última actividad y la marca de recarga: nada de contraseñas, tokens ni datos de personas
    const usos = fuentes.flatMap(f => [...leer(f).matchAll(/(?:localStorage|sessionStorage)\.(?:setItem|getItem)\(\s*([A-Za-z_'"][\w'"]*)/g)].map(m => m[1]));
    for (const clave of usos) expect(['STORAGE_KEY', 'RECARGA_KEY', 'CLAVE_ULTIMA_ACTIVIDAD', "'cm_theme'"]).toContain(clave);
  });
  it('la API key y otros secretos no están escritos en el código (solo variables de entorno)', () => {
    const texto = [...fuentes, ...archivos('tests', /\.js$/), ...archivos('scripts', /\.mjs$/), 'firebase.json', 'index.html'].filter(f => !f.endsWith('seguridad.test.js'));
    for (const f of texto) {
      const c = leer(f);
      expect(c, f).not.toMatch(/AIza[0-9A-Za-z_-]{35}/);
      expect(c, f).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY-----/);
      expect(c, f).not.toMatch(/"private_key"|client_secret|ghp_[0-9A-Za-z]{30,}/);
    }
  });
  it('.env está ignorado por git y no hay archivos de credenciales versionados', () => {
    expect(leer('.gitignore')).toMatch(/^\.env$/m);
    let versionados = [];
    try { versionados = execSync('git ls-files', { encoding: 'utf8' }).split('\n'); } catch { return; }
    expect(versionados.filter(f => /(^|\/)\.env(\.local|\.production)?$|serviceAccount|credentials\.json|\.pem$|\.p12$/i.test(f))).toEqual([]);
  });
});

describe('reglas: tope de expresiones', () => {
  it('las reglas de tiempo extra se mantienen compactas (una petición admite 1000 expresiones; ver docs/seguridad.md)', () => {
    const r = leer('firestore.rules');
    expect(r).toContain('function contenidoValido()');
    expect(r).toContain('let r = d.get(\'resumen\', {});');
  });
});

import { COLECCIONES_RESPALDO, aJson, construirRespaldo, nombreRespaldoCompleto } from '../src/utils/respaldoCompleto.js';

describe('respaldo completo (JSON)', () => {
  it('convierte fechas de Firestore a texto y quita undefined', () => {
    const fecha = new Date('2026-10-19T12:00:00Z');
    expect(aJson({ a: { toDate: () => fecha }, b: [fecha, undefined, 3], c: undefined, d: { e: 'x' } })).toEqual({ a: fecha.toISOString(), b: [fecha.toISOString(), null, 3], d: { e: 'x' } });
  });
  it('arma el archivo con conteos, subcolecciones y quién lo exportó', () => {
    const r = construirRespaldo({
      colecciones: { areas: [{ id: 'a1', data: { nombre: 'Producción' } }], tiempoExtra: [{ id: 'T1', data: { folio: 'TE-1' }, sub: { empleados: [{ id: '600', data: { nombre: 'X' } }], historial: [] } }] },
      exportadoPor: 'Admin', fecha: new Date('2026-10-19T12:00:00Z'),
    });
    expect(r.formato).toBe('century-mold-respaldo-v1');
    expect(r.conteo).toEqual({ areas: 1, tiempoExtra: 1 });
    expect(r.colecciones.areas[0]).toEqual({ id: 'a1', nombre: 'Producción' });
    expect(r.colecciones.tiempoExtra[0]._sub.empleados[0]).toEqual({ id: '600', nombre: 'X' });
    expect(r.exportadoPor).toBe('Admin');
  });
  it('incluye las colecciones importantes y el nombre del archivo lleva fecha y hora', () => {
    for (const c of ['usuarios', 'asignaciones', 'empleados', 'bitacora', 'tiempoExtra']) expect(COLECCIONES_RESPALDO).toContain(c);
    expect(nombreRespaldoCompleto(new Date(2026, 9, 19, 8, 5))).toBe('Respaldo_Completo_2026-10-19_0805.json');
  });
  it('solo el admin lo ve en Herramientas', () => {
    expect(leer('src/pages/rh/RespaldoDatos.jsx')).toContain("usuario?.rol !== 'admin'");
  });
});
