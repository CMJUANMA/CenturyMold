// Prueba de extremo a extremo de «Restablecer contraseña» (sin consola de Firebase) y del rol RH, contra los emuladores sembrados:
//   admin restablece a Oscar (50532) → la contraseña vieja ya no sirve → entra con la temporal → cambia su contraseña → queda dentro;
//   se restablece otra vez (versión 3); RH da y quita el rol RH con confirmación.
// Necesita lo mismo que scripts/modales.mjs: emuladores sembrados (scripts/sembrar-emulador.mjs), `npm run capturas:build` y
//   npx vite preview --outDir .tmp/dist-emulador --port 4174
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:4174';
const VIEJA = 'Prueba123';
const falla = []; const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falla.push(m); };
const b = await chromium.launch({ channel: 'chrome' });

async function sesion(nomina, password) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`);
  await p.fill('#login-nomina', nomina); await p.fill('#login-password', password); await p.click('#btn-ingresar');
  return { ctx, p };
}
const dentro = (p) => !new URL(p.url()).pathname.startsWith('/login');

async function restablecer(adminNomina, nombreFila) {
  const { ctx, p } = await sesion(adminNomina, VIEJA);
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
  await p.goto(`${BASE}/personal/accesos/usuarios`);
  await p.getByRole('button', { name: `Restablecer contraseña de ${nombreFila}` }).click();
  await p.locator('#btn-restablecer-password').click();
  await p.locator('#btn-copiar-password').waitFor({ timeout: 30000 });
  const password = (await p.locator('p.select-all').first().innerText()).trim();
  await p.keyboard.press('Escape'); // pide confirmar el cierre sin copiar
  await ctx.close();
  return password;
}

// ── 1. Restablecer a Oscar con el admin
const temporal = await restablecer('90001', 'ACOSTA OSCAR');
ok(/^CM-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(temporal), `la contraseña temporal tiene el formato CM-XXXX-XXXX (${temporal.slice(0, 3)}…)`);

// ── 2. La contraseña vieja ya no sirve
{
  const { ctx, p } = await sesion('50532', VIEJA);
  await p.waitForTimeout(3000);
  ok(!dentro(p) && await p.getByText('Nómina o contraseña incorrecta').isVisible(), 'la contraseña anterior ya no entra');
  await ctx.close();
}
// ── 3. La temporal entra y obliga a cambiarla
{
  const { ctx, p } = await sesion('50532', temporal);
  await p.waitForURL((u) => u.pathname === '/cambiar-password', { timeout: 15000 });
  ok(true, 'con la temporal entra y lo manda a cambiar la contraseña');
  const campos = p.locator('input[type=password]');
  await campos.nth(0).fill('Nueva-Clave-2026!'); await campos.nth(1).fill('Nueva-Clave-2026!');
  await p.getByRole('button', { name: /Guardar y continuar/ }).click();
  await p.waitForURL((u) => u.pathname !== '/cambiar-password', { timeout: 15000 });
  ok(dentro(p), 'cambia su contraseña y queda dentro');
  await p.waitForTimeout(1500);
  ok(await p.getByText('ACOSTA OSCAR').first().isVisible(), 'conserva su perfil (nombre y rol)');
  await ctx.close();
}
// ── 4. Con la contraseña nueva vuelve a entrar sin problema
{
  const { ctx, p } = await sesion('50532', 'Nueva-Clave-2026!');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
  ok(dentro(p), 'vuelve a entrar con su contraseña nueva');
  await ctx.close();
}
// ── 5. Segundo restablecimiento (versión 3) con RH
{
  const { ctx, p } = await sesion('90002', VIEJA);
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
  await p.goto(`${BASE}/personal/accesos/usuarios`);
  await p.getByRole('button', { name: 'Restablecer contraseña de ACOSTA OSCAR' }).click();
  await p.locator('#btn-restablecer-password').click();
  await p.locator('#btn-copiar-password').waitFor({ timeout: 30000 });
  const t2 = (await p.locator('p.select-all').first().innerText()).trim();
  ok(t2 !== temporal && /^CM-/.test(t2), 'RH restablece de nuevo (versión 3) y sale otra contraseña temporal');
  await p.keyboard.press('Escape');
  await ctx.close();
  const { ctx: c2, p: p2 } = await sesion('50532', t2);
  await p2.waitForURL((u) => u.pathname === '/cambiar-password', { timeout: 15000 });
  ok(true, 'la versión 3 entra con su temporal');
  await c2.close();
}
// ── 6. Dar y quitar el rol RH (con confirmación)
{
  const { ctx, p } = await sesion('90002', VIEJA);
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
  await p.goto(`${BASE}/personal/accesos/usuarios`);
  const fila = p.locator('tr', { hasText: 'MENDOZA ANSELMO' });
  await fila.locator('button[title="Editar"]').click();
  await p.locator('select').last().selectOption('rh');
  await p.getByRole('button', { name: 'Guardar cambios' }).click();
  ok(await p.getByText('¿Dar acceso de Recursos Humanos a MENDOZA ANSELMO?', { exact: false }).isVisible(), 'pide confirmar «¿Dar acceso de Recursos Humanos a …?»');
  await p.getByRole('button', { name: 'Dar acceso' }).click();
  await p.waitForTimeout(1800);
  ok(await p.locator('tr', { hasText: 'MENDOZA ANSELMO' }).getByText('Recursos Humanos').isVisible(), 'queda con el rol Recursos Humanos');
  // Quitar
  await p.locator('tr', { hasText: 'MENDOZA ANSELMO' }).locator('button[title="Editar"]').click();
  await p.locator('select').last().selectOption('usuario');
  await p.getByRole('button', { name: 'Guardar cambios' }).click();
  ok(await p.getByText('¿Quitar el acceso de Recursos Humanos a MENDOZA ANSELMO?', { exact: false }).isVisible(), 'pide confirmar al quitar RH');
  await p.getByRole('button', { name: 'Quitar acceso' }).click();
  await p.waitForTimeout(1800);
  // Nadie cambia su propio rol: la fila propia de RH no tiene botón de editar
  ok(await p.locator('tr', { hasText: 'LUNA PATRICIA' }).locator('button[title="Editar"]').count() === 0, 'sin botón de editar en la propia fila de RH');
  await ctx.close();
}
await b.close();
console.log(falla.length ? `\n${falla.length} fallas` : '\nTodo bien');
process.exit(falla.length ? 1 : 0);
