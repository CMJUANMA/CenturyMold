// Etapa 3 — Autorización: Aut. 1 devuelve la solicitud A, la solicitante la corrige y reenvía; Aut. 1 autoriza A y B; Aut. 2 las autoriza.
import { PERSONAS, PASSWORD_NUEVA } from './datos.mjs';
import { esperar, igual, leerColeccion, leerDoc, paso, verificar } from './infra.mjs';
import { cuadro, entrar, ir } from './ui.mjs';
import { FECHA_A } from './etapa-captura.mjs';

const MOTIVO_DEVOLUCION = 'Faltan detalles de los horarios del turno. Corrígelos y reenvía.';

/** Espera a que la solicitud llegue a cierto estatus (mira Firestore) */
async function esperarEstatus(id, estatus, que) {
  for (let i = 0; i < 40; i++) {
    const t = await leerDoc(`tiempoExtra/${id}`);
    if (t?.estatus === estatus) return t;
    await esperar(500);
  }
  const t = await leerDoc(`tiempoExtra/${id}`);
  throw new Error(`${que}: se esperaba el estatus «${estatus}» y sigue en «${t?.estatus}».`);
}

/** Abre «Revisar» de la solicitud con ese folio en la bandeja de Por autorizar */
async function abrirRevision(page, folio) {
  await ir(page, '/tiempo-extra/autorizar', 2500);
  const fila = page.locator('tr', { hasText: folio }).first();
  await fila.waitFor({ timeout: 15000 }).catch(() => { throw new Error(`El folio ${folio} no aparece en «Por autorizar».`); });
  await fila.getByRole('button', { name: /Revisar/ }).click();
  await page.locator('#btn-autorizar').waitFor({ timeout: 15000 });
}

export async function etapaAutorizacion({ nueva, contexto }) {
  console.log('\nEtapa 3 · Autorización');
  const A = contexto.solicitudes.A;
  const B = contexto.solicitudes.B;
  const aut1 = await nueva();
  const p1 = { page: aut1 };

  await paso('Aut. 1 de Almacén entra y ve las dos solicitudes por autorizar', async () => {
    igual(await entrar(aut1, PERSONAS.aut1.nomina, PASSWORD_NUEVA), 'inicio', 'adónde lo manda el login');
    await ir(aut1, '/tiempo-extra/autorizar', 3000);
    for (const s of [A, B]) verificar(await aut1.locator('tr', { hasText: s.folio }).count(), `Aut. 1 no ve el folio ${s.folio} en «Por autorizar».`);
  }, p1);

  await paso('Aut. 1 revisa la solicitud A y la DEVUELVE con un motivo (sin motivo no deja)', async () => {
    await abrirRevision(aut1, A.folio);
    verificar(await aut1.locator('#btn-devolver').isDisabled(), '«Devolver» debería estar deshabilitado sin motivo.');
    await aut1.locator('#comentario-firma').fill(MOTIVO_DEVOLUCION);
    await aut1.locator('#btn-devolver').click();
    const t = await esperarEstatus(A.id, 'devuelta', 'Devolución de A');
    verificar(JSON.stringify(t).includes('Faltan detalles'), 'El motivo de la devolución no quedó guardado.');
  }, p1);

  const solicitante = await nueva();
  const ps = { page: solicitante };
  await paso('La solicitante ve la devolución con su motivo, corrige y reenvía (vuelve a empezar en Aut. 1)', async () => {
    igual(await entrar(solicitante, PERSONAS.solicitante.nomina, PASSWORD_NUEVA), 'inicio', 'adónde la manda el login');
    await ir(solicitante, '/tiempo-extra/mis-solicitudes', 2500);
    await solicitante.getByRole('tab', { name: /Devueltas/ }).click();
    await esperar(600);
    const fila = solicitante.locator('tr', { hasText: A.folio }).first();
    verificar(await fila.count(), `La solicitud ${A.folio} no aparece en «Devueltas».`);
    await fila.getByRole('button', { name: /Corregir y reenviar/ }).click();
    await solicitante.locator('#te-comentario').waitFor({ timeout: 15000 });
    const aviso = await solicitante.getByText(/Devuelta por/).first().innerText().catch(() => '');
    verificar(/Devuelta por/.test(aviso), 'La pantalla de corrección no dice quién la devolvió.');
    verificar((await solicitante.locator('body').innerText()).includes('Faltan detalles'), 'La pantalla de corrección no muestra el motivo de la devolución.');
    await solicitante.locator('#te-comentario').fill('Inventario de cierre y carga de un pedido con P.O. (horarios revisados).');
    await solicitante.locator('#btn-enviar-autorizacion').click();
    await cuadro(solicitante).getByRole('button', { name: /^(Reenviar|Enviar)$/ }).click();
    await solicitante.waitForURL(u => u.pathname.includes('/mis-solicitudes'), { timeout: 30000 });
    const t = await esperarEstatus(A.id, 'pendiente_aut1', 'Reenvío de A');
    verificar(t.comentario?.includes('horarios revisados') || JSON.stringify(t).includes('horarios revisados'), 'El comentario corregido no se guardó.');
    return `${A.folio} reenviada, otra vez en Aut. 1`;
  }, ps);
  await solicitante.context().close();

  await paso('Aut. 1 autoriza A (reenviada) y B: pasan al nivel 2', async () => {
    for (const s of [A, B]) {
      await abrirRevision(aut1, s.folio);
      await aut1.locator('#btn-autorizar').click();
      await esperarEstatus(s.id, 'pendiente_aut2', `Autorización 1 de ${s.folio}`);
    }
    return 'A y B en autorización de nivel 2';
  }, p1);
  await aut1.context().close();

  const aut2 = await nueva();
  const p2 = { page: aut2 };
  await paso('Aut. 2 (Gerente) entra, ve las dos y las autoriza', async () => {
    igual(await entrar(aut2, PERSONAS.aut2.nomina, PASSWORD_NUEVA), 'inicio', 'adónde lo manda el login');
    for (const s of [A, B]) {
      await abrirRevision(aut2, s.folio);
      await aut2.locator('#btn-autorizar').click();
      const t = await esperarEstatus(s.id, 'autorizada', `Autorización 2 de ${s.folio}`);
      verificar(t.aut1 && t.aut2, `${s.folio} no trae las dos firmas.`);
    }
    return 'A y B autorizadas con las dos firmas';
  }, p2);

  await paso('Quedan solo A y B (la de prueba se borró en la limpieza) y los folios no se repiten', async () => {
    const todas = await leerColeccion('tiempoExtra');
    igual(todas.map(t => t.folio).sort(), [A.folio, B.folio].sort(), 'folios existentes');
    verificar(A.folio !== B.folio && /^TE-\d{4}-\d{4}$/.test(A.folio), `Folio raro: ${A.folio}`);
    igual(todas.find(t => t.id === A.id).fechaTE, FECHA_A, 'fecha de A');
  }, p2);
  await aut2.context().close();
}
