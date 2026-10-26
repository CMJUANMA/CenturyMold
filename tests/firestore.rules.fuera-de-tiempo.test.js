// Reglas de la autorización FUERA DE TIEMPO: solo un Aut. 2 vigente pasa una VENCIDA (pendiente_aut1 / pendiente_aut2) a autorizada, con motivo, quién y cuándo.
// Contra el emulador de Firestore (npm run test:rules).
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { hoyMexico } from '../src/utils/tiempoExtra.js';

let env;
const ts = serverTimestamp;
const ahora = () => Timestamp.now();
const ayerTs = () => Timestamp.fromDate(new Date(Date.now() - 24 * 3600 * 1000));
const HOY = hoyMexico();
const AYER = hoyMexico(Date.now() - 86400000);
const MANANA = hoyMexico(Date.now() + 86400000);

const N = { rh: '90001', rhAut2: '90002', nom: '70001', solP: '50532', aut1P: '50610', aut2: '11', aut2Venc: '12' };
const MOTIVO = 'Sí se trabajó; el jefe no autorizó a tiempo';
const SIN_AUT1 = 'Autorizada por Aut. 2 sin Aut. 1, fuera de tiempo';
const firmaSemilla = (nomina) => ({ nomina, nombre: `Usuario ${nomina}`, fecha: ahora(), comentario: '' });
const te = (estatus, fechaTE, extra = {}) => ({
  folio: 'TE-2026-0001', areaId: 'produccion', areaNombre: 'Producción', creadoPor: 'solP', creadoPorNomina: N.solP, creadoPorNombre: 'solP', fechaTE, motivo: 'Producción', estatus,
  resumen: { totalEmpleados: 2, totalHoras: 17, totalTransporte: 1, totalAlimentos: 1 }, aut1: estatus === 'pendiente_aut1' ? null : firmaSemilla(N.aut1P), aut2: null,
  fechaCreacion: ahora(), fechaActualizacion: ahora(), ...extra,
});

async function sembrar(solicitudes) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, rol, nomina] of [['rh', 'rh', N.rh], ['rhAut2', 'rh', N.rhAut2], ['nom', 'nomina', N.nom], ['solP', 'usuario', N.solP], ['aut1P', 'usuario', N.aut1P], ['aut2', 'usuario', N.aut2], ['aut2Venc', 'usuario', N.aut2Venc]]) {
      await setDoc(doc(db, 'usuarios', uid), { nombre: uid, email: `${nomina}@rutas.app`, rol, nomina, activo: true });
    }
    await setDoc(doc(db, 'areas', 'produccion'), { nombre: 'Producción', participaTE: true, activa: true, orden: 1 });
    const asig = (nomina, rol, areaId, hasta = null) => setDoc(doc(db, 'asignaciones', `${nomina}_${rol}_${rol === 'aut2' ? 'planta' : areaId}`), {
      nomina, nombre: `Usuario ${nomina}`, rol, areaId: rol === 'aut2' ? null : areaId, desde: ayerTs(), hasta, motivo: '', activo: true,
      asignadoPor: { uid: 'rh', nombre: 'rh' }, fechaAsignacion: ahora(),
    });
    await asig(N.solP, 'solicitante', 'produccion'); await asig(N.aut1P, 'aut1', 'produccion'); await asig(N.aut2, 'aut2', null); await asig(N.rhAut2, 'aut2', null);
    await asig(N.aut2Venc, 'aut2', null, Timestamp.fromDate(new Date(Date.now() - 3600 * 1000))); // su asignación ya venció
    await setDoc(doc(db, 'ajustesNomina', '2026-01_produccion'), { semana: '2026-01', areaId: 'produccion', firmada: true });
    for (const [id, datos] of Object.entries(solicitudes)) await setDoc(doc(db, 'tiempoExtra', id), datos);
  });
}

const dbDe = (uid) => env.authenticatedContext(uid).firestore();

/**
 * Lo que manda la app al autorizar fuera de tiempo: la solicitud y su renglón de historial en el mismo lote (y el de bitácora).
 * `cambios` y `fuera` permiten romper una parte a propósito.
 */
function autorizarFuera(uid, id, { desde = 'pendiente_aut2', cambios = {}, fuera = {}, historial = true, bitacora = true } = {}) {
  const db = dbDe(uid);
  const b = writeBatch(db);
  const quien = { nomina: N[uid], nombre: uid, fecha: ts() };
  b.update(doc(db, 'tiempoExtra', id), {
    estatus: 'autorizada',
    ...(desde === 'pendiente_aut1' ? { aut1: { ...quien, comentario: SIN_AUT1, comoRH: false } } : {}),
    aut2: { ...quien, comentario: MOTIVO, comoRH: false },
    autorizadaFueraDeTiempo: true,
    fueraDeTiempo: { ...quien, motivo: MOTIVO, estatusAnterior: desde, ...fuera },
    fechaActualizacion: ts(), ...cambios,
  });
  if (historial) b.set(doc(collection(db, 'tiempoExtra', id, 'historial')), { accion: 'autorizada_fuera_de_tiempo', nivel: 2, porUid: uid, porNomina: N[uid], porNombre: uid, comentario: MOTIVO, fecha: ts() });
  if (bitacora) b.set(doc(collection(db, 'bitacora')), { accion: 'autorizar_fuera_de_tiempo', entidad: 'tiempoExtra', antes: { estatus: desde }, despues: { estatus: 'autorizada' }, porUid: uid, porNombre: uid, fecha: ts() });
  return b.commit();
}

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-solicitud-rutas', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => { await env?.cleanup(); });

describe('fuera de tiempo: quién puede', () => {
  beforeEach(() => sembrar({
    n2Ayer: te('pendiente_aut2', AYER), n1Ayer: te('pendiente_aut1', AYER), n2Hoy: te('pendiente_aut2', HOY), n1Manana: te('pendiente_aut1', MANANA),
    devueltaAyer: te('devuelta', AYER), borradorAyer: te('borrador', AYER), autorizadaAyer: te('autorizada', AYER, { aut2: firmaSemilla(N.aut2) }),
    propia: te('pendiente_aut2', AYER, { creadoPor: 'aut2', creadoPorNomina: N.aut2 }),
  }));

  it('un Aut. 2 vigente autoriza fuera de tiempo una vencida de nivel 2', async () => {
    await assertSucceeds(autorizarFuera('aut2', 'n2Ayer'));
  });
  it('...y una de nivel 1: también queda la firma de nivel 1 «sin Aut. 1», todo en el mismo paso', async () => {
    await assertSucceeds(autorizarFuera('aut2', 'n1Ayer', { desde: 'pendiente_aut1' }));
  });
  it('desde nivel 1 es obligatorio dejar la firma de nivel 1 con el texto exacto', async () => {
    await assertFails(autorizarFuera('aut2', 'n1Ayer', { desde: 'pendiente_aut2' })); // sin aut1 y con el estatus anterior equivocado
    const db = dbDe('aut2');
    const b = writeBatch(db);
    b.update(doc(db, 'tiempoExtra', 'n1Ayer'), {
      estatus: 'autorizada', aut1: { nomina: N.aut2, nombre: 'aut2', fecha: ts(), comentario: 'otra cosa', comoRH: false },
      aut2: { nomina: N.aut2, nombre: 'aut2', fecha: ts(), comentario: MOTIVO, comoRH: false }, autorizadaFueraDeTiempo: true,
      fueraDeTiempo: { nomina: N.aut2, nombre: 'aut2', fecha: ts(), motivo: MOTIVO, estatusAnterior: 'pendiente_aut1' }, fechaActualizacion: ts(),
    });
    await assertFails(b.commit());
  });
  it('NO puede el Aut. 1, el solicitante, Nóminas ni RH sin Aut. 2', async () => {
    for (const uid of ['aut1P', 'solP', 'nom', 'rh']) await assertFails(autorizarFuera(uid, 'n2Ayer'));
    for (const uid of ['aut1P', 'solP', 'nom', 'rh']) await assertFails(autorizarFuera(uid, 'n1Ayer', { desde: 'pendiente_aut1' }));
  });
  it('un Aut. 2 cuya asignación ya venció tampoco', async () => {
    await assertFails(autorizarFuera('aut2Venc', 'n2Ayer'));
  });
  it('RH con asignación de Aut. 2 vigente sí', async () => {
    await assertSucceeds(autorizarFuera('rhAut2', 'n2Ayer'));
  });
  it('no si todavía está a tiempo (hoy o después): eso se autoriza de la forma normal', async () => {
    await assertFails(autorizarFuera('aut2', 'n2Hoy'));
    await assertFails(autorizarFuera('aut2', 'n1Manana', { desde: 'pendiente_aut1' }));
  });
  it('no desde borrador, devuelta ni autorizada', async () => {
    for (const id of ['borradorAyer', 'devueltaAyer', 'autorizadaAyer']) await assertFails(autorizarFuera('aut2', id));
  });
  it('nadie autoriza lo que creó', async () => {
    await assertFails(autorizarFuera('aut2', 'propia'));
  });
});

describe('fuera de tiempo: el motivo y lo que se firma', () => {
  beforeEach(() => sembrar({ n2Ayer: te('pendiente_aut2', AYER) }));

  it('el motivo es obligatorio: mínimo 10 caracteres, máximo 500, y no solo espacios', async () => {
    await assertFails(autorizarFuera('aut2', 'n2Ayer', { fuera: { motivo: '' } }));
    await assertFails(autorizarFuera('aut2', 'n2Ayer', { fuera: { motivo: 'corto' } }));
    await assertFails(autorizarFuera('aut2', 'n2Ayer', { fuera: { motivo: '          x' } }));
    await assertFails(autorizarFuera('aut2', 'n2Ayer', { fuera: { motivo: 'x'.repeat(501) } }));
    await assertSucceeds(autorizarFuera('aut2', 'n2Ayer', { fuera: { motivo: 'x'.repeat(500) } }));
  });
  it('exige la marca autorizadaFueraDeTiempo en true', async () => {
    await assertFails(autorizarFuera('aut2', 'n2Ayer', { cambios: { autorizadaFueraDeTiempo: false } }));
  });
  it('quién y cuándo: no se firma a nombre de otro ni con otra hora, ni con el estatus anterior cambiado', async () => {
    await assertFails(autorizarFuera('aut2', 'n2Ayer', { fuera: { nomina: N.rh } }));
    await assertFails(autorizarFuera('aut2', 'n2Ayer', { fuera: { nombre: 'otro' } }));
    await assertFails(autorizarFuera('aut2', 'n2Ayer', { fuera: { fecha: ahora() } }));
    await assertFails(autorizarFuera('aut2', 'n2Ayer', { fuera: { estatusAnterior: 'pendiente_aut1' } }));
    await assertFails(autorizarFuera('aut2', 'n2Ayer', { cambios: { aut2: { nomina: N.rh, nombre: 'aut2', fecha: ts(), comentario: MOTIVO, comoRH: false } } }));
  });
  it('no se cuelan otros campos ni se cambia la fecha o el área', async () => {
    await assertFails(autorizarFuera('aut2', 'n2Ayer', { cambios: { fechaTE: HOY } }));
    await assertFails(autorizarFuera('aut2', 'n2Ayer', { cambios: { areaId: 'moldes' } }));
    await assertFails(autorizarFuera('aut2', 'n2Ayer', { fuera: { extra: 1 } }));
    await assertFails(autorizarFuera('aut2', 'n2Ayer', { cambios: { cerradaSinTransporte: true } }));
  });
  it('desde nivel 2 no se firma de nuevo el nivel 1', async () => {
    await assertFails(autorizarFuera('aut2', 'n2Ayer', { cambios: { aut1: { nomina: N.aut2, nombre: 'aut2', fecha: ts(), comentario: SIN_AUT1, comoRH: false } } }));
  });
  it('el historial de esta acción solo lo escribe un Aut. 2', async () => {
    const db = dbDe('rh');
    const b = writeBatch(db);
    b.update(doc(db, 'tiempoExtra', 'n2Ayer'), { estatus: 'autorizada', autorizadaFueraDeTiempo: true, fechaActualizacion: ts() });
    b.set(doc(collection(db, 'tiempoExtra', 'n2Ayer', 'historial')), { accion: 'autorizada_fuera_de_tiempo', nivel: 2, porUid: 'rh', porNomina: N.rh, porNombre: 'rh', comentario: '', fecha: ts() });
    await assertFails(b.commit());
  });
});

describe('fuera de tiempo: la bitácora y la nómina firmada', () => {
  beforeEach(() => sembrar({ n2Ayer: te('pendiente_aut2', AYER) }));
  const fila = (uid, extra = {}) => ({ accion: 'autorizar_fuera_de_tiempo', entidad: 'tiempoExtra', antes: null, despues: null, porUid: uid, porNombre: uid, fecha: ts(), ...extra });

  it('la Aut. 2 deja su renglón en la bitácora, pero solo ese tipo sobre tiempo extra y con su uid', async () => {
    await assertSucceeds(setDoc(doc(collection(dbDe('aut2'), 'bitacora')), fila('aut2')));
    await assertFails(setDoc(doc(collection(dbDe('aut2'), 'bitacora')), fila('aut2', { accion: 'recibir' })));
    await assertFails(setDoc(doc(collection(dbDe('aut2'), 'bitacora')), fila('aut2', { accion: 'cancelar_autorizada' })));
    await assertFails(setDoc(doc(collection(dbDe('aut2'), 'bitacora')), fila('aut2', { porUid: 'rh' })));
  });
  it('el Aut. 1, el solicitante y Nóminas no escriben ese renglón', async () => {
    for (const uid of ['aut1P', 'solP', 'nom']) await assertFails(setDoc(doc(collection(dbDe(uid), 'bitacora')), fila(uid)));
  });
  it('la Aut. 2 sigue sin LEER la bitácora de tiempo extra', async () => {
    await assertFails(getDocs(query(collection(dbDe('aut2'), 'bitacora'), where('entidad', '==', 'tiempoExtra'))));
  });
  it('la Aut. 2 lee UN documento de ajustesNomina por su id (para avisar que la nómina está firmada), pero no lista', async () => {
    await assertSucceeds(getDoc(doc(dbDe('aut2'), 'ajustesNomina', '2026-01_produccion')));
    await assertSucceeds(getDoc(doc(dbDe('aut2'), 'ajustesNomina', '2026-02_produccion'))); // aún no existe: igual se puede preguntar
    await assertFails(getDocs(query(collection(dbDe('aut2'), 'ajustesNomina'), where('semana', '==', '2026-01'))));
  });
  it('la Aut. 2 no escribe ajustesNomina', async () => {
    await assertFails(setDoc(doc(dbDe('aut2'), 'ajustesNomina', '2026-03_produccion'), { semana: '2026-03' }));
  });
  it('Aut. 1 y solicitante no leen ajustesNomina; Nóminas y RH siguen listando', async () => {
    for (const uid of ['aut1P', 'solP']) await assertFails(getDoc(doc(dbDe(uid), 'ajustesNomina', '2026-01_produccion')));
    for (const uid of ['nom', 'rh']) await assertSucceeds(getDocs(query(collection(dbDe(uid), 'ajustesNomina'), where('semana', '==', '2026-01'))));
  });
});

describe('después de autorizarla fuera de tiempo', () => {
  beforeEach(() => sembrar({ n2Ayer: te('pendiente_aut2', AYER) }));
  it('queda autorizada con fecha pasada: RH la cierra sin transporte', async () => {
    await assertSucceeds(autorizarFuera('aut2', 'n2Ayer'));
    const db = dbDe('rh');
    const b = writeBatch(db);
    b.update(doc(db, 'tiempoExtra', 'n2Ayer'), { estatus: 'procesada', recibidaPor: { nomina: N.rh, nombre: 'rh', fecha: ts() }, fechaRecepcion: ts(), cerradaSinTransporte: true, fechaActualizacion: ts() });
    b.set(doc(collection(db, 'tiempoExtra', 'n2Ayer', 'historial')), { accion: 'recibida_rh', nivel: 0, porUid: 'rh', porNomina: N.rh, porNombre: 'rh', comentario: '', fecha: ts() });
    await assertSucceeds(b.commit());
  });
  it('no se puede volver a autorizar fuera de tiempo (ya no está pendiente)', async () => {
    await assertSucceeds(autorizarFuera('aut2', 'n2Ayer'));
    await assertFails(autorizarFuera('aut2', 'n2Ayer'));
  });
});
