// Reglas de las solicitudes VENCIDAS: pasado el día de su fecha (hora de México) ya no se autorizan ni se devuelven, y una autorizada que no se envió al proveedor
// se puede «cerrar sin transporte» solo si su fecha ya pasó. Contra el emulador de Firestore (npm run test:rules).
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, collection, doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { hoyMexico } from '../src/utils/tiempoExtra.js';

let env;
const ts = serverTimestamp;
const ahora = () => Timestamp.now();
const ayerTs = () => Timestamp.fromDate(new Date(Date.now() - 24 * 3600 * 1000));
const HOY = hoyMexico();
const AYER = hoyMexico(Date.now() - 86400000);
const MANANA = hoyMexico(Date.now() + 86400000);
const HACE_UN_MES = hoyMexico(Date.now() - 30 * 86400000);

const N = { rh: '90001', nom: '70001', solP: '50532', aut1P: '50610', aut2: '11' };
const firmaSemilla = (nomina) => ({ nomina, nombre: `Usuario ${nomina}`, fecha: ahora(), comentario: '' });
const te = (estatus, fechaTE, extra = {}) => ({
  folio: 'TE-2026-0001', areaId: 'produccion', areaNombre: 'Producción', creadoPor: 'solP', creadoPorNomina: N.solP, creadoPorNombre: 'solP', fechaTE, motivo: 'Producción', estatus,
  resumen: { totalEmpleados: 2, totalHoras: 17, totalTransporte: 1, totalAlimentos: 1 }, aut1: firmaSemilla(N.aut1P), aut2: firmaSemilla(N.aut2),
  fechaCreacion: ahora(), fechaActualizacion: ahora(), ...extra,
});

async function sembrar(solicitudes) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, rol, nomina] of [['rh', 'rh', N.rh], ['nom', 'nomina', N.nom], ['solP', 'usuario', N.solP], ['aut1P', 'usuario', N.aut1P], ['aut2', 'usuario', N.aut2]]) {
      await setDoc(doc(db, 'usuarios', uid), { nombre: uid, email: `${nomina}@rutas.app`, rol, nomina, activo: true });
    }
    await setDoc(doc(db, 'areas', 'produccion'), { nombre: 'Producción', participaTE: true, activa: true, orden: 1 });
    const asig = (nomina, rol, areaId) => setDoc(doc(db, 'asignaciones', `${nomina}_${rol}_${rol === 'aut2' ? 'planta' : areaId}`), {
      nomina, nombre: `Usuario ${nomina}`, rol, areaId: rol === 'aut2' ? null : areaId, desde: ayerTs(), hasta: null, motivo: '', activo: true,
      asignadoPor: { uid: 'rh', nombre: 'rh' }, fechaAsignacion: ahora(),
    });
    await asig(N.solP, 'solicitante', 'produccion'); await asig(N.aut1P, 'aut1', 'produccion'); await asig(N.aut2, 'aut2', null);
    for (const [id, datos] of Object.entries(solicitudes)) await setDoc(doc(db, 'tiempoExtra', id), datos);
  });
}

const dbDe = (uid) => env.authenticatedContext(uid).firestore();
const entradaH = (uid, accion, nivel) => ({ accion, nivel, porUid: uid, porNomina: N[uid], porNombre: uid, comentario: '', fecha: ts() });

/** Lo que manda la app al autorizar o devolver: la solicitud y su renglón de historial en el mismo lote */
function responder(uid, id, que, nivel) {
  const db = dbDe(uid);
  const b = writeBatch(db);
  const firma = { nomina: N[uid], nombre: uid, fecha: ts(), comentario: '', comoRH: false };
  const cambios = que === 'autorizar'
    ? (nivel === 1 ? { estatus: 'pendiente_aut2', aut1: firma } : { estatus: 'autorizada', aut2: firma })
    : { estatus: 'devuelta', devolucion: { nivel, nomina: N[uid], nombre: uid, motivo: 'Falta indicar el motivo exacto', fecha: ts() } };
  b.update(doc(db, 'tiempoExtra', id), { ...cambios, fechaActualizacion: ts() });
  b.set(doc(collection(db, 'tiempoExtra', id, 'historial')), entradaH(uid, que === 'autorizar' ? `autorizada_${nivel}` : 'devuelta', nivel));
  return b.commit();
}

function cerrarSinTransporte(uid, id, extra = {}) {
  const db = dbDe(uid);
  const b = writeBatch(db);
  b.update(doc(db, 'tiempoExtra', id), {
    estatus: 'procesada', recibidaPor: { nomina: N[uid], nombre: uid, fecha: ts() }, fechaRecepcion: ts(), cerradaSinTransporte: true, fechaActualizacion: ts(), ...extra,
  });
  b.set(doc(collection(db, 'tiempoExtra', id, 'historial')), entradaH(uid, 'recibida_rh', 0));
  b.set(doc(collection(db, 'bitacora')), { accion: 'cerrar_sin_transporte', entidad: 'tiempoExtra', antes: { estatus: 'autorizada' }, despues: { estatus: 'procesada' }, porUid: uid, porNombre: uid, fecha: ts() });
  return b.commit();
}

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-solicitud-rutas', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => { await env?.cleanup(); });

describe('vencida: no se autoriza ni se devuelve', () => {
  beforeEach(() => sembrar({
    n1Ayer: te('pendiente_aut1', AYER, { aut1: null, aut2: null }), n1Hoy: te('pendiente_aut1', HOY, { aut1: null, aut2: null }), n1Manana: te('pendiente_aut1', MANANA, { aut1: null, aut2: null }),
    n2Ayer: te('pendiente_aut2', AYER, { aut2: null }), n2Hoy: te('pendiente_aut2', HOY, { aut2: null }), n2Mes: te('pendiente_aut2', HACE_UN_MES, { aut2: null }),
  }));

  it('el Aut. 1 autoriza y devuelve lo que vence hoy o más adelante, no lo de ayer', async () => {
    await assertFails(responder('aut1P', 'n1Ayer', 'autorizar', 1));
    await assertFails(responder('aut1P', 'n1Ayer', 'devolver', 1));
    await assertSucceeds(responder('aut1P', 'n1Hoy', 'autorizar', 1));
    await assertSucceeds(responder('aut1P', 'n1Manana', 'devolver', 1));
  });
  it('la Aut. 2 y RH igual: lo de ayer o de hace un mes ya no se autoriza ni se devuelve; lo de hoy sí', async () => {
    await assertFails(responder('aut2', 'n2Ayer', 'autorizar', 2));
    await assertFails(responder('aut2', 'n2Ayer', 'devolver', 2));
    await assertFails(responder('aut2', 'n2Mes', 'autorizar', 2));
    await assertFails(responder('rh', 'n2Ayer', 'autorizar', 2));
    await assertFails(responder('rh', 'n2Mes', 'devolver', 2));
    await assertSucceeds(responder('aut2', 'n2Hoy', 'autorizar', 2));
  });
  it('lo que vence hoy también se puede devolver', async () => {
    await assertSucceeds(responder('rh', 'n2Hoy', 'devolver', 2));
  });
});

describe('cerrar sin transporte', () => {
  beforeEach(() => sembrar({
    pasada: te('autorizada', AYER), hoy: te('autorizada', HOY), futura: te('autorizada', MANANA), sinTransporte: te('autorizada', AYER, { resumen: { totalEmpleados: 1, totalHoras: 9, totalTransporte: 0, totalAlimentos: 0 } }),
    pendiente: te('pendiente_aut2', AYER, { aut2: null }),
  }));

  it('RH y Nóminas cierran sin transporte una autorizada de fecha pasada, aunque tuviera empleados con transporte', async () => {
    await assertSucceeds(cerrarSinTransporte('rh', 'pasada'));
    await assertSucceeds(cerrarSinTransporte('nom', 'sinTransporte'));
  });
  it('no si la fecha es hoy o futura (todavía puede salir el transporte)', async () => {
    await assertFails(cerrarSinTransporte('rh', 'hoy'));
    await assertFails(cerrarSinTransporte('rh', 'futura'));
  });
  it('no lo hacen la Aut. 2, el Aut. 1 ni el solicitante', async () => {
    for (const uid of ['aut2', 'aut1P', 'solP']) await assertFails(cerrarSinTransporte(uid, 'pasada'));
  });
  it('solo desde autorizada: una pendiente vencida no se cierra así', async () => {
    await assertFails(cerrarSinTransporte('rh', 'pendiente'));
  });
  it('exige la marca cerradaSinTransporte y los campos de siempre, sin colar otros', async () => {
    await assertFails(cerrarSinTransporte('rh', 'pasada', { cerradaSinTransporte: false }));
    await assertFails(cerrarSinTransporte('rh', 'pasada', { aut2: null }));
    await assertFails(cerrarSinTransporte('rh', 'pasada', { fechaTE: HOY }));
    await assertFails(cerrarSinTransporte('rh', 'pasada', { recibidaPor: { nomina: N.nom, nombre: 'rh', fecha: ts() } }));
  });
  it('queda en la bitácora: Nóminas puede escribir cerrar_sin_transporte, pero solo sobre tiempoExtra y con su uid', async () => {
    const fila = (extra = {}) => ({ accion: 'cerrar_sin_transporte', entidad: 'tiempoExtra', antes: null, despues: null, porUid: 'nom', porNombre: 'nom', fecha: ts(), ...extra });
    await assertSucceeds(setDoc(doc(collection(dbDe('nom'), 'bitacora')), fila()));
    await assertFails(setDoc(doc(collection(dbDe('nom'), 'bitacora')), fila({ entidad: 'descarga' })));
    await assertFails(setDoc(doc(collection(dbDe('nom'), 'bitacora')), fila({ porUid: 'rh' })));
  });
  it('el camino de siempre (recibir sin transporte cuando nadie lo pidió) no cambia', async () => {
    await assertFails(cerrarSinTransporte('rh', 'hoy'));
    const db = dbDe('rh');
    const b = writeBatch(db);
    b.update(doc(db, 'tiempoExtra', 'sinTransporte'), { estatus: 'procesada', recibidaPor: { nomina: N.rh, nombre: 'rh', fecha: ts() }, fechaRecepcion: ts(), fechaActualizacion: ts() });
    b.set(doc(collection(db, 'tiempoExtra', 'sinTransporte', 'historial')), entradaH('rh', 'recibida_rh', 0));
    await assertSucceeds(b.commit());
  });
});
