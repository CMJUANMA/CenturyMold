// Auxiliares de los guiones de captura de los manuales (todos los roles). Solo datos ficticios del emulador.
import { PASSWORD, USUARIOS } from '../datos-demo-usuarios.mjs';

export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const enDias = (n) => ymd(new Date(Date.now() + n * 86400000));
/** Un paso que falla no detiene el resto: se anota y sigue (el manual se revisa con las capturas que sí salieron) */
export const intentar = async (nombre, fn) => { try { await fn(); } catch (e) { console.log(`  ✗ ${nombre}: ${String(e.message).split('\n')[0]}`); } };

// Recortes (px de la ventana de 1366 × 820): se quita el menú lateral para que lo importante salga más grande
export const LADO = { x: 288, y: 0, width: 1078, height: 820 };
export const DETALLE = { x: 225, y: 8, width: 916, height: 804 };
export const DIALOGO = { x: 380, y: 130, width: 606, height: 560 };
export const DIALOGO_ANCHO = { x: 280, y: 30, width: 806, height: 760 };
// Ventana ancha (1600 × 900) para las pantallas con tablas grandes (las bandejas de autorización): que no se corte ninguna columna
export const VENTANA_ANCHA = { width: 1600, height: 900 };
export const LADO_A = { x: 288, y: 0, width: 1312, height: 900 };
export const DETALLE_A = { x: 342, y: 8, width: 916, height: 884 };
export const DIALOGO_A = { x: 497, y: 150, width: 606, height: 560 };
/** Baja el contenido del cuadro abierto hasta el final (para anotar lo de abajo sin que se mueva lo demás) */
export const alFinalDelCuadro = (page) => page.locator('[role=dialog]').evaluate(d => { const c = d.querySelector('.overflow-y-auto') ?? d; c.scrollTop = c.scrollHeight; });

/** Entra con una persona del demo y espera a que cargue el inicio */
export async function entrarComo(page, BASE, clave) {
  await page.goto(BASE + '/login'); await page.waitForTimeout(1000);
  await page.fill('#login-nomina', USUARIOS[clave][0]);
  await page.fill('#login-password', PASSWORD);
  await page.click('#btn-ingresar');
  await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 15000 });
  await page.waitForTimeout(2500);
}

/** Clave ISO de la semana de una fecha ("2026-46"), como la usa la pantalla de Nóminas */
export function claveSemana(fecha = new Date()) {
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  const inicioAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d - inicioAnio) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-${String(semana).padStart(2, '0')}`;
}
