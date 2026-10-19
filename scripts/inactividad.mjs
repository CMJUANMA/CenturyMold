// Prueba de extremo a extremo del cierre por inactividad: sesión que expira → volver a entrar con la MISMA cuenta y con OTRA → ambas entran y se quedan.
// Para que no tarde 30 minutos, compila antes con el límite reducido (LIMITE_INACTIVIDAD_MS = 60 * 1000 y AVISO_INACTIVIDAD_MS = 10 * 1000 en utils/inactividad.js, solo para esta prueba)
// y sirve con `npx vite preview --outDir .tmp/dist-emulador --port 4174` con los emuladores sembrados. Después REGRESA el límite a 30 min.
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:4174';
const falla = []; const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falla.push(m); };
const b = await chromium.launch({ channel: 'chrome' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
const entrar = async (nomina) => {
  await p.goto(`${BASE}/login`); await p.fill('#login-nomina', nomina); await p.fill('#login-password', 'Prueba123'); await p.click('#btn-ingresar');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
};
const marca = () => p.evaluate(() => localStorage.getItem('cm_ultima_actividad'));

await entrar('50532');
ok(!!(await marca()), 'al entrar queda la marca de actividad de la cuenta');
// Sin tocar nada: aviso y cierre por inactividad
await p.waitForURL((u) => u.pathname.startsWith('/login'), { timeout: 120000 });
ok(await p.getByText('Tu sesión se cerró por inactividad').isVisible(), 'sale el aviso de «sesión cerrada por inactividad» en el login');
ok((await marca()) === null, 'al cerrar se borra la marca de actividad');
// Recargar: no hay temporizador ni marca; el aviso ya no se repite
await p.reload(); await p.waitForTimeout(1500);
ok(!(await p.getByText('Tu sesión se cerró por inactividad').isVisible()), 'el aviso se muestra una sola vez (no sobrevive a recargar)');

// Misma cuenta
await entrar('50532'); await p.waitForTimeout(25000);
ok(!new URL(p.url()).pathname.startsWith('/login'), 'misma cuenta: entra y permanece dentro');
// Otra cuenta (la marca de la sesión anterior no debe contar): se vence de nuevo, así que primero se cierra a mano y se prueba con marca vieja plantada
await p.evaluate(() => localStorage.setItem('cm_ultima_actividad', 'otro-uid|' + (Date.now() - 3 * 3600_000)));
await p.getByRole('button', { name: /Cerrar sesión/ }).first().click().catch(() => {});
await p.waitForURL((u) => u.pathname.startsWith('/login'), { timeout: 15000 });
await p.evaluate(() => localStorage.setItem('cm_ultima_actividad', 'otro-uid|' + (Date.now() - 3 * 3600_000))); // marca vencida de otra sesión plantada a propósito
await entrar('90002'); await p.waitForTimeout(25000);
ok(!new URL(p.url()).pathname.startsWith('/login'), 'otra cuenta (con una marca vencida ajena en el navegador): entra y permanece dentro');
// La marca vencida de la MISMA cuenta tampoco debe expulsarla al entrar de nuevo
const uid = await p.evaluate(() => (localStorage.getItem('cm_ultima_actividad') ?? '').split('|')[0]);
await p.getByRole('button', { name: /Cerrar sesión/ }).first().click().catch(() => {});
await p.waitForURL((u) => u.pathname.startsWith('/login'), { timeout: 15000 });
await p.evaluate((u) => localStorage.setItem('cm_ultima_actividad', u + '|' + (Date.now() - 3 * 3600_000)), uid);
await entrar('90002'); await p.waitForTimeout(25000);
ok(!new URL(p.url()).pathname.startsWith('/login'), 'misma cuenta con marca vencida propia plantada: entra y permanece dentro');
await b.close();
console.log(falla.length ? `\n${falla.length} fallas` : '\nTodo bien');
process.exit(falla.length ? 1 : 0);
