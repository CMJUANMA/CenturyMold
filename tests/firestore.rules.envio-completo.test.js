// Regresión del error «maximum of 1000 expressions to evaluate has been reached» al enviar a autorización (prueba de usabilidad con Diana, Producción):
// el envío real de la app (guardar el borrador con 2 motivos, 2 rutas y justificación y enviarlo) y los caminos grandes y pesados, contra las reglas reales.
// Ejecutar con: npm run test:rules  (requiere Java 11+)
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { collection, doc, getDoc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ANIO, ESCENARIOS, USUARIOS, comoUsuario, extrasTE, listaEmpleados, montar, sembrarBase, sembrarTE } from './helpers/envio-te.js';

let env;
beforeAll(async () => { env = await montar(readFileSync('firestore.rules', 'utf8')); });
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await sembrarBase(env); });

const datosEnvio = () => ({ id: 'BR-AAAAAAAAAA', devuelta: false, usuario: USUARIOS.solP, estatus: 'pendiente_aut1', extras: extrasTE(listaEmpleados(4, 2), 2) });
const guardarYEnviar = async (uid, usuario, estatus, n, nMotivos) => {
  const { db, m } = await comoUsuario(env, uid);
  const lista = listaEmpleados(n, nMotivos);
  const extras = extrasTE(lista, nMotivos);
  const comun = { fechaTE: '2099-12-01', motivo: extras.motivo, comentario: 'Se requiere apoyo para embarques y pedido urgente' };
  await m.guardarBorrador({
    id: 'BR-AAAAAAAAAA', existe: false, usuario, area: { id: 'produccion', nombre: 'Producción' }, ...comun, empleados: lista, sucios: new Set(lista.map(e => e.nomina)), eliminados: new Set(), extras,
  });
  const folio = await m.enviarSolicitud({ id: 'BR-AAAAAAAAAA', devuelta: false, usuario, estatus, ...comun, empleados: lista, extras });
  return { db, m, folio };
};

describe('enviar a autorización (el borrador se guarda con la app y luego se envía)', () => {
  it('Diana: 4 empleados con transporte, 2 motivos (uno con P.O.) y 2 rutas con justificación', async () => {
    const { db, folio } = await guardarYEnviar('solP', USUARIOS.solP, 'pendiente_aut1', 4, 2);
    expect(folio).toBe(`TE-${ANIO}-0013`);
    const t = (await getDoc(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data();
    expect(t).toMatchObject({ estatus: 'pendiente_aut1', rutasDistintas: 2 });
    expect(t.motivos.map(x => x.numero)).toEqual(['', '4551099797']);
    expect((await getDocs(collection(db, 'tiempoExtra', 'BR-AAAAAAAAAA', 'empleados'))).size).toBe(4);
  });
  it('sus teléfonos se guardan aparte (empleadosContacto, otra escritura: la app los guarda antes de enviar y no van en el lote del envío)', async () => {
    const { db } = await comoUsuario(env, 'solP');
    const { guardarTelefonosEnPadron } = await import('../src/utils/contactosDb.js');
    await guardarTelefonosEnPadron({ 700: '4421000001', 701: '4421000002', 702: '4421000003', 703: '4421000004' });
    expect((await getDoc(doc(db, 'empleadosContacto', '700'))).data()).toMatchObject({ telefono: '4421000001' });
    const { folio } = await guardarYEnviar('solP', USUARIOS.solP, 'pendiente_aut1', 4, 2);
    expect(folio).toBe(`TE-${ANIO}-0013`);
  });
  it('40 empleados con 5 motivos', async () => { expect((await guardarYEnviar('solP', USUARIOS.solP, 'pendiente_aut1', 40, 5)).folio).toBe(`TE-${ANIO}-0013`); });
  it('150 empleados con 5 motivos (el máximo)', async () => { expect((await guardarYEnviar('solP', USUARIOS.solP, 'pendiente_aut1', 150, 5)).folio).toBe(`TE-${ANIO}-0013`); });
  it('el Aut. 1 del área: va directo a Aut. 2', async () => {
    const { db } = await guardarYEnviar('aut1P', USUARIOS.aut1P, 'pendiente_aut2', 4, 2);
    expect((await getDoc(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data().estatus).toBe('pendiente_aut2');
  });
  it('una Aut. 2 que captura su propia solicitud: queda autorizada (4 y 150 empleados, 5 motivos)', async () => {
    const { db } = await guardarYEnviar('aut2s', USUARIOS.aut2s, 'autorizada', 4, 2);
    expect((await getDoc(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data().estatus).toBe('autorizada');
    await sembrarBase(env);
    expect((await guardarYEnviar('aut2s', USUARIOS.aut2s, 'autorizada', 150, 5)).folio).toBe(`TE-${ANIO}-0013`);
  });
  it('el admin que captura su propia solicitud: queda autorizada (4 y 150 empleados, 5 motivos)', async () => {
    const { db } = await guardarYEnviar('adm', USUARIOS.adm, 'autorizada', 4, 2);
    expect((await getDoc(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data().estatus).toBe('autorizada');
    await sembrarBase(env);
    expect((await guardarYEnviar('adm', USUARIOS.adm, 'autorizada', 150, 5)).folio).toBe(`TE-${ANIO}-0013`);
  });
});

describe('los demás caminos pesados (solicitudes grandes ya sembradas)', () => {
  for (const e of ESCENARIOS.filter(x => !x.id.startsWith('enviar'))) {
    it(e.nombre, async () => { await e.preparar(env); await e.ejecutar(env); });
  }
});

describe('la seguridad sigue en pie', () => {
  it('quien no es el Aut. 1 no se salta su nivel, aunque mande todo bien formado', async () => {
    await ESCENARIOS[0].preparar(env);
    const { m } = await comoUsuario(env, 'solP');
    const lista = listaEmpleados(4, 2);
    await expect(m.enviarSolicitud({ id: 'BR-AAAAAAAAAA', devuelta: false, usuario: USUARIOS.solP, estatus: 'pendiente_aut2', fechaTE: '2099-12-01', motivo: 'x', comentario: 'Se requiere apoyo', empleados: lista, extras: extrasTE(lista, 2) })).rejects.toThrow();
  });
  it('con 2 rutas y sin justificación guardada no se envía; tampoco se puede agregar al enviar', async () => {
    await sembrarTE(env, { id: 'BR-AAAAAAAAAA', estatus: 'borrador', extra: { justificacionRutas: '' } });
    const { db, m } = await comoUsuario(env, 'solP');
    await expect(m.enviarSolicitud(datosEnvio())).rejects.toThrow();
    await expect(updateDoc(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA'), { estatus: 'pendiente_aut1', folio: `TE-${ANIO}-0013`, justificacionRutas: 'Ahora sí hay una justificación larga', fechaActualizacion: serverTimestamp() })).rejects.toThrow();
  });
  it('el contenido se valida al GUARDAR el borrador: motivos con campos de más, nombres enormes o de 6 en adelante se rechazan', async () => {
    await sembrarTE(env, { id: 'BR-AAAAAAAAAA', estatus: 'borrador' });
    const { m } = await comoUsuario(env, 'solP');
    const lista = listaEmpleados(4, 2);
    const extras = extrasTE(lista, 2);
    const guardar = (motivos) => m.guardarBorrador({ id: 'BR-AAAAAAAAAA', existe: true, usuario: USUARIOS.solP, area: { id: 'produccion', nombre: 'Producción' }, fechaTE: '2099-12-01', comentario: 'Se requiere apoyo', empleados: lista, sucios: new Set(), eliminados: new Set(), extras: { ...extras, motivos } });
    await expect(guardar([{ ...extras.motivos[0], nombre: 'A'.repeat(61) }, extras.motivos[1]])).rejects.toThrow();
    await expect(guardar([{ ...extras.motivos[0], extra: 1 }, extras.motivos[1]])).rejects.toThrow();
    await expect(guardar(Array.from({ length: 6 }, () => extras.motivos[0]))).rejects.toThrow();
    await guardar(extras.motivos);
  });
  it('nadie ajeno sube el contador de folios por su cuenta', async () => {
    await ESCENARIOS[0].preparar(env);
    const { db } = await comoUsuario(env, 'solP');
    const { setDoc } = await import('firebase/firestore');
    await expect(setDoc(doc(db, 'contadores', `te-${ANIO}`), { ultimo: 13, solicitudId: 'BR-AAAAAAAAAA' })).rejects.toThrow();
  });
});
