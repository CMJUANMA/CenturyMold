// Etapa 1 — El día del arranque: limpieza → directorio de rutas → ruta de Almacén por importación → usuarios → primer ingreso → «Olvidé mi contraseña».
import { readFileSync } from 'node:fs';
import {
  ADMIN, ALMACEN, DIRECTORIO, NOMBRE_RUTA, PASSWORD_ADMIN, PASSWORD_NUEVA, PASSWORD_PRUEBA, PERSONAS, RUTAS_POR_IMPORTACION, sembrarEstadoDePrueba,
} from './datos.mjs';
import { borrarCuentaAuth, cuentasAuth, esperar, igual, leerColeccion, leerDoc, paso, verificar } from './infra.mjs';
import { cambiarPasswordObligatorio, cerrarSesion, cuadro, descargar, entrar, entrarFallido, escribirExcel, ir, leerExcel } from './ui.mjs';

const CORREOS_ESPERADOS_A_BORRAR = [
  '6010@rutas.app', '6020@rutas.app', '6030@rutas.app', '6040@rutas.app', '6050@rutas.app', '9901@rutas.app', '9901.v2@rutas.app', '9901.v3@rutas.app', '7001@rutas.app',
];
const CORREOS_QUE_SE_CONSERVAN = ['7000@rutas.app', '7001.v2@rutas.app'];

export async function etapaArranque({ nueva, contexto }) {
  console.log('Etapa 1 · Arranque');
  const page = await nueva();
  const p = { page };

  await paso('Estado de «antes de arrancar»: usuarios y catálogos de prueba mezclados con la configuración real', async () => {
    await sembrarEstadoDePrueba();
    const usuarios = await leerColeccion('usuarios');
    igual(usuarios.length, 8, 'usuarios sembrados');
    return `${usuarios.length} usuarios, 3 asignaciones, 1 solicitud de prueba, 1 ruta de prueba`;
  }, p);

  await paso('El administrador entra (sin recorrido guiado encima)', async () => {
    igual(await entrar(page, ADMIN.nomina, PASSWORD_ADMIN), 'inicio', 'adónde lo manda el login');
    verificar(!(await page.locator('[aria-label="Recorrido guiado"]').count()), 'Salió un recorrido guiado y debe estar apagado.');
    await ir(page, '/mi-cuenta', 1200);
    verificar(!(await page.getByText('Volver a ver los recorridos').count()), '«Volver a ver los recorridos» sigue en Mi cuenta.');
    await ir(page, '/tiempo-extra/nueva', 2500);
    verificar(!(await page.locator('[aria-label="Recorrido guiado"]').count()), 'Salió un recorrido guiado en Solicitar tiempo extra.');
  }, p);

  let correosDeLaLista = [];
  await paso('Preparar para producción · paso 1: respaldo JSON completo y lista de lo que se borraría', async () => {
    await ir(page, '/herramientas', 1500);
    const ruta = await descargar(page, () => page.locator('#btn-preparar-produccion').click(), 'respaldo-completo.json');
    const json = JSON.parse(readFileSync(ruta, 'utf8'));
    for (const c of ['usuarios', 'accesos', 'asignaciones', 'empleados', 'rutas', 'comunidades', 'puntosReunion', 'tiempoExtra', 'bitacora', 'contadores']) verificar(c in json.colecciones, `El respaldo no trae «${c}».`);
    igual(json.colecciones.usuarios.length, 8, 'usuarios en el respaldo');
    igual(json.colecciones.rutas.length, 1, 'rutas en el respaldo');
    await page.locator('#chk-todos-no-admin').waitFor();
    return `respaldo con ${Object.values(json.colecciones).reduce((n, l) => n + l.length, 0)} documentos`;
  }, p);

  await paso('Marcar «todos los usuarios excepto los administradores» y «catálogos de transporte de prueba»', async () => {
    await page.locator('#chk-todos-no-admin').check();
    await page.locator('#chk-catalogos-transporte').check();
    const marcadas = await page.locator('tbody input[type=checkbox]:checked').count();
    igual(marcadas, 6, 'usuarios marcados (Aut. 1, solicitante, Aut. 2, RH, Nóminas y el de prueba)');
    const admin = page.locator('tr', { hasText: ADMIN.nombre }).locator('input[type=checkbox]');
    verificar(!(await admin.isChecked()), 'El administrador quedó marcado para borrarse.');
    verificar(!(await page.locator('tr', { hasText: 'OTRO ADMIN' }).locator('input[type=checkbox]').isChecked()), 'El otro administrador quedó marcado para borrarse.');
    return `${marcadas} usuarios marcados; los 2 administradores no`;
  }, p);

  await paso('La lista de cuentas de Authentication por borrar es exacta (con las versiones viejas) y no incluye a los administradores', async () => {
    const seccion = page.locator('section[aria-label="Cuentas de Authentication"]');
    const texto = await seccion.innerText();
    correosDeLaLista = [...new Set(texto.match(/[\w.]+@rutas\.app/g) ?? [])];
    const borrar = correosDeLaLista.filter(c => !CORREOS_QUE_SE_CONSERVAN.includes(c));
    igual([...borrar].sort(), [...CORREOS_ESPERADOS_A_BORRAR].sort(), 'cuentas por borrar');
    // Las vigentes de los administradores salen como «NO borres», no en la tabla
    const tabla = (await seccion.locator('tbody').innerText());
    for (const c of CORREOS_QUE_SE_CONSERVAN) verificar(!tabla.includes(c), `La tabla de cuentas por borrar incluye a un administrador (${c}).`);
    verificar(/NO borres/.test(texto), 'Falta el aviso de qué cuentas de administrador no se borran.');
    verificar(/Delete accounts/.test(texto), 'Faltan las instrucciones para borrar varias cuentas a la vez en la consola.');
    return `${CORREOS_ESPERADOS_A_BORRAR.length} cuentas`;
  }, p);

  await paso('Paso 2: escribir BORRAR y limpiar (usuarios, accesos y catálogos)', async () => {
    await page.getByPlaceholder('BORRAR').fill('BORRAR');
    await page.locator('#btn-borrar-produccion').click();
    await page.getByText('Limpieza terminada.').first().waitFor({ timeout: 60000 });
    const resumen = await page.locator('ul[aria-label="Resumen de lo borrado"]').innerText();
    verificar(/Usuarios borrados: 6/.test(resumen) && /registros de acceso borrados: 6/.test(resumen), `Resumen sin los conteos de usuarios: ${resumen}`);
    verificar(/1 rutas, 1 comunidades, 1 puntos de reunión/.test(resumen) && /ruta vaciada en 3 empleados/.test(resumen), `Resumen sin los conteos de catálogos: ${resumen}`);
    return resumen.replace(/\s+/g, ' ').slice(0, 220);
  }, p);

  await paso('Lo que debía borrarse se borró y lo que debía conservarse se conservó (Firestore)', async () => {
    igual((await leerColeccion('usuarios')).map(u => u.nomina).sort(), ['7000', '7001'], 'usuarios que quedan (solo los administradores)');
    igual((await leerColeccion('accesos')).map(a => a.id).sort(), ['7001'], 'accesos que quedan');
    igual((await leerColeccion('asignaciones')).length, 3, 'asignaciones (deben conservarse)');
    for (const c of ['rutas', 'comunidades', 'puntosReunion', 'tiempoExtra', 'contadores']) igual((await leerColeccion(c)).length, 0, `${c} que quedan`);
    igual((await leerColeccion('bitacora')).length, 1, 'renglones de bitácora (solo el de la limpieza)');
    const padron = await leerColeccion('empleados');
    igual(padron.length, 6 + 5 + 1, 'empleados del padrón (no se borra ninguno)');
    for (const e of padron) igual([e.rutaId, e.comunidadId, e.puntoReunionId], ['', '', ''], `ruta de ${e.nomina}`);
    const e6001 = padron.find(e => e.nomina === '6001');
    igual([e6001.nombre, e6001.puesto, e6001.areaId, e6001.elegibleTE, e6001.activo], ['AGUILAR RÍOS ANA', 'ALMACENISTA', 'almacen', true, true], 'datos de 6001 (no deben cambiar)');
    igual((await leerDoc('empleadosContacto/6001')).telefono, '4421110001', 'teléfono de 6001');
    for (const c of ['areas', 'puestos', 'turnosNomina', 'motivosTE']) verificar((await leerColeccion(c)).length > 0, `Se borró «${c}» y debía conservarse.`);
    return 'usuarios 2 (admins) · asignaciones 3 · padrón 12 · rutas 0 · folios reiniciados';
  }, p);

  await paso('Borrar en «la consola» las cuentas de Authentication de la lista (todas menos las de los administradores)', async () => {
    const cuentas = await cuentasAuth();
    const aBorrar = cuentas.filter(c => correosDeLaLista.includes(c.correo) && !CORREOS_QUE_SE_CONSERVAN.includes(c.correo));
    igual(aBorrar.length, CORREOS_ESPERADOS_A_BORRAR.length, 'cuentas encontradas en Authentication');
    for (const c of aBorrar) await borrarCuentaAuth(c.uid);
    igual((await cuentasAuth()).map(c => c.correo).sort(), CORREOS_QUE_SE_CONSERVAN, 'cuentas que quedan en Authentication');
    return `${aBorrar.length} borradas; quedan ${CORREOS_QUE_SE_CONSERVAN.join(' y ')}`;
  }, p);

  await paso('Quien tenía usuario de prueba ya no puede entrar con su contraseña vieja', async () => {
    await cerrarSesion(page);
    const mensaje = await entrarFallido(page, PERSONAS.solicitante.nomina, PASSWORD_PRUEBA);
    verificar(mensaje.length > 0, 'No salió ningún mensaje al intentar entrar con una cuenta borrada.');
    return `mensaje: «${mensaje.slice(0, 90)}»`;
  }, p);

  // ── Directorio de rutas y ruta de Almacén por importación ───────────────────────────────────
  await paso('El administrador entra de nuevo', async () => { igual(await entrar(page, ADMIN.nomina, PASSWORD_ADMIN), 'inicio', 'adónde lo manda el login'); }, p);

  await paso('Sin rutas en el catálogo, la app funciona: el catálogo está vacío y al capturar con transporte avisa con claridad', async () => {
    await ir(page, '/transporte/catalogos', 1800);
    verificar(await page.getByText('No hay rutas').count(), 'El catálogo de rutas debería mostrar «No hay rutas».');
    contexto.sinRutasVerificado = true;
  }, p);

  await paso('Importar directorio: plantilla en blanco y carga del directorio de rutas de ejemplo', async () => {
    await page.locator('#btn-importar-directorio').click();
    const ruta = await descargar(page, () => cuadro(page).getByRole('button', { name: /Descargar formato en blanco/ }).click(), 'plantilla-directorio.xlsx');
    const hojas = await leerExcel(ruta);
    igual(hojas.Directorio[0], ['RUTA', 'COMUNIDAD', 'PUNTO DE REUNION', 'CLAVE'], 'encabezados de la plantilla del directorio');
    const archivo = await escribirExcel('directorio.xlsx', 'Directorio', [['RUTA', 'COMUNIDAD', 'PUNTO DE REUNION', 'CLAVE'], ...DIRECTORIO]);
    await cuadro(page).locator('input[type=file]').setInputFiles(archivo);
    await page.getByRole('button', { name: 'Confirmar importación' }).click();
    await page.getByText('Importacion completada').waitFor({ timeout: 30000 });
    await cuadro(page).getByRole('button', { name: 'Cerrar', exact: true }).last().click();
    igual((await leerColeccion('rutas')).map(r => r.nombre).sort(), ['RUTA NORTE', 'RUTA ORIENTE', 'RUTA SUR'], 'rutas del catálogo');
    igual((await leerColeccion('puntosReunion')).length, 4, 'puntos de reunión');
    return '3 rutas, 3 comunidades, 4 puntos';
  }, p);

  await paso('Importar Personal: plantilla en blanco con RUTA, COMUNIDAD y PUNTO, y ruta por nómina a los de Almacén', async () => {
    await ir(page, '/personal/padron', 1800);
    await page.getByRole('button', { name: /Importar empleados/ }).click();
    const ruta = await descargar(page, () => cuadro(page).getByRole('button', { name: /Descargar formato en blanco/ }).click(), 'plantilla-personal.xlsx');
    const hojas = await leerExcel(ruta);
    igual(hojas.Empleados[0].slice(-3), ['RUTA', 'COMUNIDAD', 'PUNTO'], 'últimas columnas de la plantilla de Personal');
    const filas = [['NOMINA', 'NOMBRE', 'PUESTO', 'CLAVE PARADA', 'TELÉFONO', 'ELEGIBLE TE', 'RUTA', 'COMUNIDAD', 'PUNTO']];
    for (const a of ALMACEN) {
      const [clave, r, c, pu] = RUTAS_POR_IMPORTACION[a.nomina];
      filas.push([Number(a.nomina), a.nombre, 'ALMACENISTA', clave, a.telefono, 'SI', r, c, pu]);
    }
    const archivo = await escribirExcel('personal.xlsx', 'Empleados', filas);
    await cuadro(page).locator('input[type=file]').setInputFiles(archivo);
    await esperar(2500);
    // Si la importación pide confirmar áreas o puestos, se confirma lo que propone
    const confirmarAreas = cuadro(page).getByRole('button', { name: /Confirmo todas las áreas/ });
    if (await confirmarAreas.count()) { await confirmarAreas.first().click(); await esperar(800); }
    const confirmar = page.getByRole('button', { name: 'Confirmar importación' });
    verificar(await confirmar.isEnabled(), `El botón «Confirmar importación» está deshabilitado: ${(await cuadro(page).innerText()).slice(0, 300)}`);
    await confirmar.click();
    await page.getByText('Importacion completada').waitFor({ timeout: 30000 });
    await cuadro(page).getByRole('button', { name: 'Cerrar', exact: true }).last().click();
    const padron = await leerColeccion('empleados');
    const puntos = new Map((await leerColeccion('puntosReunion')).map(x => [x.id, x]));
    for (const a of ALMACEN) {
      const e = padron.find(x => x.nomina === a.nomina);
      const clave = RUTAS_POR_IMPORTACION[a.nomina][0] || { 6002: 'SN02', 6004: 'SU01' }[a.nomina] || '';
      igual(e.puntoReunionId, clave, `punto de reunión de ${a.nomina}`);
      if (clave) igual(puntos.get(clave).rutaId, e.rutaId, `ruta de ${a.nomina}`);
      igual((await leerDoc(`empleadosContacto/${a.nomina}`))?.telefono, a.telefono, `teléfono de ${a.nomina}`);
    }
    return 'rutas por CLAVE PARADA en 3 y por RUTA/COMUNIDAD/PUNTO en 2; 6006 sin ruta a propósito';
  }, p);
  contexto.NOMBRE_RUTA = NOMBRE_RUTA;

  // ── Usuarios ────────────────────────────────────────────────────────────────────────────────
  await paso('Crear usuarios: Aut. 1, solicitante y Aut. 2 salen del lote (sus asignaciones siguen vigentes) y se descarga su Excel de accesos', async () => {
    await ir(page, '/personal/accesos/usuarios', 1800);
    await page.locator('#btn-usuarios-lote').click();
    await cuadro(page).getByText(/3 cuentas por crear/).waitFor();
    const ruta = await descargar(page, () => page.locator('#btn-crear-lote').click(), 'accesos-iniciales.xlsx');
    await cuadro(page).getByText(/3 de 3 cuentas creadas/).waitFor({ timeout: 60000 });
    const hojas = await leerExcel(ruta);
    const filas = hojas.Accesos.slice(1);
    for (const [clave, persona] of Object.entries(PERSONAS)) {
      if (!['aut1', 'solicitante', 'aut2'].includes(clave)) continue;
      const f = filas.find(x => x[0] === persona.nomina);
      verificar(f && f[5], `El Excel de accesos no trae la contraseña de ${persona.nombre}.`);
      contexto.claves[clave] = f[5];
    }
    await cuadro(page).getByRole('button', { name: 'Cerrar', exact: true }).last().click();
    await page.getByRole('button', { name: /Ya lo descargué, cerrar/ }).click();
    return '3 cuentas creadas con contraseña temporal';
  }, p);

  for (const clave of ['rh', 'nomina']) {
    await paso(`Crear usuario de ${clave === 'rh' ? 'Recursos Humanos' : 'Nóminas'} (Nuevo usuario con su rol del sistema)`, async () => {
      const persona = PERSONAS[clave];
      await ir(page, '/personal/accesos/usuarios', 1500);
      await page.getByRole('button', { name: /Nuevo usuario/ }).click();
      await cuadro(page).getByPlaceholder(/nómina|nombre|Buscar/i).first().fill(persona.nomina);
      await cuadro(page).getByText(persona.nombre).first().click();
      await cuadro(page).locator('select').first().selectOption(persona.rol);
      await cuadro(page).getByRole('button', { name: /Crear usuario/ }).click();
      await page.locator('#btn-cerrar-usuario-creado').waitFor({ timeout: 30000 });
      contexto.claves[clave] = (await page.locator('[role=dialog] .font-mono').first().innerText()).trim();
      verificar(contexto.claves[clave].length >= 8, `Contraseña temporal rara: «${contexto.claves[clave]}»`);
      await page.locator('#btn-cerrar-usuario-creado').click();
    }, p);
  }

  await paso('Volver a crear con la misma nómina funciona normal: versión 1 de acceso, cambio de contraseña obligatorio y asignaciones intactas', async () => {
    const usuarios = await leerColeccion('usuarios');
    for (const persona of Object.values(PERSONAS)) {
      const u = usuarios.find(x => x.nomina === persona.nomina);
      verificar(u, `No se creó el usuario ${persona.nomina}.`);
      igual([u.rol, u.activo, u.debeCambiarPassword], [persona.rol, true, true], `perfil de ${persona.nomina}`);
      const acc = await leerDoc(`accesos/${persona.nomina}`);
      igual(acc.version, 1, `versión de acceso de ${persona.nomina}`);
      igual(acc.uid, u.id, `uid de acceso de ${persona.nomina}`);
    }
    igual((await leerColeccion('asignaciones')).length, 3, 'asignaciones');
    const auth = (await cuentasAuth()).map(c => c.correo);
    for (const persona of Object.values(PERSONAS)) verificar(auth.includes(`${persona.nomina}@rutas.app`), `Falta la cuenta ${persona.nomina}@rutas.app en Authentication.`);
    verificar(!auth.some(c => c.includes('.v2@rutas.app') && c.startsWith('60')), 'Se creó una versión 2 que no debía existir.');
  }, p);
  await cerrarSesion(page);

  // ── Primer ingreso de cada uno ──────────────────────────────────────────────────────────────
  await paso('Primer ingreso de cada usuario: la contraseña temporal obliga a crear una propia, y con la nueva entran', async () => {
    for (const [clave, persona] of Object.entries(PERSONAS)) {
      const ctx = await nueva();
      igual(await entrar(ctx, persona.nomina, contexto.claves[clave]), 'cambiar-password', `primer ingreso de ${persona.nomina}`);
      await cambiarPasswordObligatorio(ctx, contexto.claves[clave], PASSWORD_NUEVA);
      verificar(!ctx.url().includes('/cambiar-password'), `${persona.nomina} sigue en el cambio de contraseña.`);
      await cerrarSesion(ctx);
      igual(await entrar(ctx, persona.nomina, PASSWORD_NUEVA), 'inicio', `segundo ingreso de ${persona.nomina} con la contraseña nueva`);
      await ctx.context().close();
    }
    for (const [clave, u] of Object.entries(PERSONAS)) contexto.claves[clave] = PASSWORD_NUEVA;
    const usuarios = await leerColeccion('usuarios');
    for (const persona of Object.values(PERSONAS)) igual(usuarios.find(x => x.nomina === persona.nomina).debeCambiarPassword, false, `debeCambiarPassword de ${persona.nomina}`);
    return '5 personas entraron, cambiaron su contraseña y volvieron a entrar';
  }, p);

  await paso('«Olvidé mi contraseña» explica qué hacer sin revelar nada', async () => {
    const ctx = await nueva();
    await ctx.goto((await import('./infra.mjs')).BASE + '/login');
    await ctx.locator('#btn-olvide-password').click();
    const dialogo = cuadro(ctx);
    await dialogo.waitFor();
    const texto = (await dialogo.innerText()).replace(/\s+/g, ' ');
    verificar(/Recursos Humanos|RH|Autorización 2|administrador|supervisor/i.test(texto), `El aviso de «Olvidé mi contraseña» no dice con quién ir: ${texto}`);
    await ctx.locator('#btn-entendido-password').click();
    await dialogo.waitFor({ state: 'hidden' });
    await ctx.context().close();
    return `«${texto.slice(0, 110)}…»`;
  }, p);

  await page.context().close();
}
