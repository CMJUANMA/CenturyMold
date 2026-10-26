// El ADMIN tiene TODOS los permisos de todos los roles, siempre: sin modo especial y sin marcas (su uid y su nombre, como cualquiera). Ningún otro rol gana permisos.
// Contra el emulador de Firestore (npm run test:rules).
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, collection, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { hoyMexico } from '../src/utils/tiempoExtra.js';

let env;
const ts = serverTimestamp;
const ahora = () => Timestamp.now();
const ayerTs = () => Timestamp.fromDate(new Date(Date.now() - 24 * 3600 * 1000));
const HOY = hoyMexico();
const AYER = hoyMexico(Date.now() - 86400000);
const MANANA = hoyMexico(Date.now() + 86400000);
const MOTIVO = 'Sí se trabajó; el jefe no autorizó a tiempo';
const SIN_AUT1 = 'Autorizada por Aut. 2 sin Aut. 1, fuera de tiempo';

const N = { adm: '99001', rh: '90001', nom: '70001', solP: '50532', aut1P: '50610', aut2: '11' };
const firmaSemilla = (nomina) => ({ nomina, nombre: `Usuario ${nomina}`, fecha: ahora(), comentario: '' });
const te = (estatus, fechaTE, extra = {}) => ({
  folio: 'TE-2026-0001', areaId: 'produccion', areaNombre: 'Producción', creadoPor: 'solP', creadoPorNomina: N.solP, creadoPorNombre: 'solP', fechaTE, motivo: 'Producción', estatus,
  resumen: { totalEmpleados: 2, totalHoras: 17, totalTransporte: 0, totalAlimentos: 1 }, aut1: estatus === 'pendiente_aut1' ? null : firmaSemilla(N.aut1P), aut2: null,
  fechaCreacion: ahora(), fechaActualizacion: ahora(), ...extra,
});
const borrador = (uid, areaId, extra = {}) => ({
  areaId, areaNombre: areaId === 'produccion' ? 'Producción' : 'Administrativo', creadoPor: uid, creadoPorNomina: N[uid], creadoPorNombre: uid, fechaTE: MANANA, motivo: 'Producción', estatus: 'borrador',
  fechaCreacion: ts(), fechaActualizacion: ts(), ...extra,
});

async function sembrar(solicitudes) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, rol] of [['adm', 'admin'], ['rh', 'rh'], ['nom', 'nomina'], ['solP', 'usuario'], ['aut1P', 'usuario'], ['aut2', 'usuario']]) {
      await setDoc(doc(db, 'usuarios', uid), { nombre: uid, email: `${N[uid]}@rutas.app`, rol, nomina: N[uid], activo: true });
    }
    await setDoc(doc(db, 'usuarios', 'admOff'), { nombre: 'admOff', email: 'off@rutas.app', rol: 'admin', nomina: '99002', activo: false });
    await setDoc(doc(db, 'areas', 'produccion'), { nombre: 'Producción', participaTE: true, activa: true, orden: 1 });
    await setDoc(doc(db, 'areas', 'administrativo'), { nombre: 'Administrativo', participaTE: false, activa: true, orden: 2 });
    const asig = (nomina, rol, areaId) => setDoc(doc(db, 'asignaciones', `${nomina}_${rol}_${rol === 'aut2' ? 'planta' : areaId}`), {
      nomina, nombre: `Usuario ${nomina}`, rol, areaId: rol === 'aut2' ? null : areaId, desde: ayerTs(), hasta: null, motivo: '', activo: true,
      asignadoPor: { uid: 'rh', nombre: 'rh' }, fechaAsignacion: ahora(),
    });
    await asig(N.solP, 'solicitante', 'produccion'); await asig(N.aut1P, 'aut1', 'produccion'); await asig(N.aut2, 'aut2', null);
    await setDoc(doc(db, 'ajustesNomina', '2026-01_produccion'), { semana: '2026-01', areaId: 'produccion', desde: '2026-01-01', hasta: '2026-01-07', cambios: [], renglones: [], firmada: true, actualizadoPor: { uid: 'rh' }, fechaActualizacion: ahora() });
    for (const [id, datos] of Object.entries(solicitudes)) await setDoc(doc(db, 'tiempoExtra', id), datos);
  });
}
const dbDe = (uid) => env.authenticatedContext(uid).firestore();
const quien = (uid) => ({ nomina: N[uid], nombre: uid, fecha: ts() });
const entrada = (uid, accion, nivel) => ({ accion, nivel, porUid: uid, porNomina: N[uid], porNombre: uid, comentario: '', fecha: ts() });

/** Una acción de tiempo extra como la manda la app: el cambio de la solicitud y su renglón del historial en el mismo lote. Igual para todos los roles: sin marcas. */
function accion(uid, id, tipo) {
  const db = dbDe(uid);
  const b = writeBatch(db);
  const h = (a, nivel) => b.set(doc(collection(db, 'tiempoExtra', id, 'historial')), entrada(uid, a, nivel));
  const dev = (nivel) => ({ estatus: 'devuelta', devolucion: { nivel, nomina: N[uid], nombre: uid, motivo: 'Faltan datos del turno', fecha: ts() } });
  const cambios = {
    aut1: () => { h('autorizada_1', 1); return { estatus: 'pendiente_aut2', aut1: { ...quien(uid), comentario: '', comoRH: false } }; },
    dev1: () => { h('devuelta', 1); return dev(1); },
    aut2: () => { h('autorizada_2', 2); return { estatus: 'autorizada', aut2: { ...quien(uid), comentario: '', comoRH: uid !== 'adm' && uid !== 'aut2' } }; },
    dev2: () => { h('devuelta', 2); return dev(2); },
    dev3: () => { h('devuelta', 3); return dev(3); },
    fuera2: () => { h('autorizada_fuera_de_tiempo', 2); return { estatus: 'autorizada', aut2: { ...quien(uid), comentario: MOTIVO, comoRH: false }, autorizadaFueraDeTiempo: true, fueraDeTiempo: { ...quien(uid), motivo: MOTIVO, estatusAnterior: 'pendiente_aut2' } }; },
    fuera1: () => {
      h('autorizada_fuera_de_tiempo', 2);
      return {
        estatus: 'autorizada', aut1: { ...quien(uid), comentario: SIN_AUT1, comoRH: false }, aut2: { ...quien(uid), comentario: MOTIVO, comoRH: false },
        autorizadaFueraDeTiempo: true, fueraDeTiempo: { ...quien(uid), motivo: MOTIVO, estatusAnterior: 'pendiente_aut1' },
      };
    },
    recibir: () => { h('recibida_rh', 0); return { estatus: 'procesada', recibidaPor: quien(uid), fechaRecepcion: ts() }; },
    cerrar: () => { h('recibida_rh', 0); return { estatus: 'procesada', recibidaPor: quien(uid), fechaRecepcion: ts(), cerradaSinTransporte: true }; },
    cancelar: () => { h('cancelada', 0); return { estatus: 'cancelada', motivoCancelacion: 'Se canceló el turno extra', canceladaPor: { ...quien(uid), comoRH: uid === 'rh' } }; },
  }[tipo]();
  b.update(doc(db, 'tiempoExtra', id), { ...cambios, fechaActualizacion: ts() });
  return b.commit();
}

/** Enviar un borrador propio: el contador del año sube 1 en el mismo lote. Un Aut. 2 (y el admin) lo deja autorizado con su firma; el resto, a nivel 1 o 2 */
function enviar(uid, id, estatus) {
  const db = dbDe(uid);
  const b = writeBatch(db);
  const anio = String(new Date().getFullYear());
  const propia = estatus === 'autorizada';
  b.set(doc(db, 'contadores', `te-${anio}`), { ultimo: 1, solicitudId: id });
  b.update(doc(db, 'tiempoExtra', id), {
    estatus, folio: `TE-${anio}-0001`, resumen: { totalEmpleados: 1, totalHoras: 8, totalTransporte: 0, totalAlimentos: 0 },
    ...(propia ? { aut2: { ...quien(uid), comentario: 'Capturada y autorizada por Aut. 2', comoRH: false } } : {}), fechaActualizacion: ts(),
  });
  b.set(doc(collection(db, 'tiempoExtra', id, 'historial')), propia ? entrada(uid, 'enviada_autorizada', 2) : entrada(uid, 'enviada', 0));
  return b.commit();
}

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-solicitud-rutas', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => { await env?.cleanup(); });

describe('admin: capturar y enviar en cualquier área', () => {
  beforeEach(() => sembrar({ brAdm: borrador('adm', 'produccion'), brAdmAdm: borrador('adm', 'administrativo') }));

  it('crea borradores en cualquier área activa, sin asignaciones', async () => {
    await assertSucceeds(setDoc(doc(dbDe('adm'), 'tiempoExtra', 'BR-nuevoAdminTE1'), borrador('adm', 'produccion')));
    await assertSucceeds(setDoc(doc(dbDe('adm'), 'tiempoExtra', 'BR-nuevoAdminTE2'), borrador('adm', 'administrativo')));
  });
  it('lo que envía queda autorizado con su firma de Aut. 2, como cualquier Aut. 2', async () => {
    await assertSucceeds(enviar('adm', 'brAdm', 'autorizada'));
  });
  it('...también en un área que no participa', async () => {
    await assertSucceeds(enviar('adm', 'brAdmAdm', 'autorizada'));
  });
  it('un admin desactivado no hace nada', async () => {
    await assertFails(setDoc(doc(dbDe('admOff'), 'tiempoExtra', 'BR-adminApagado1'), { ...borrador('adm', 'produccion'), creadoPor: 'admOff', creadoPorNomina: '99002', creadoPorNombre: 'admOff' }));
  });
  it('quien no es admin sigue sin crear borradores en áreas ajenas', async () => {
    for (const uid of ['rh', 'solP', 'aut1P', 'nom']) await assertFails(setDoc(doc(dbDe(uid), 'tiempoExtra', `BR-ajena${uid}ABCDE`), borrador(uid, uid === 'rh' ? 'produccion' : 'administrativo')));
  });
});

describe('admin: autorizar, devolver y cancelar en cualquier nivel', () => {
  beforeEach(() => sembrar({
    n1: te('pendiente_aut1', HOY), n2: te('pendiente_aut2', HOY), aut: te('autorizada', AYER, { aut2: firmaSemilla(N.aut2) }),
    propia: te('pendiente_aut1', HOY, { creadoPor: 'adm', creadoPorNomina: N.adm, creadoPorNombre: 'adm' }),
    propia2: te('pendiente_aut2', HOY, { creadoPor: 'adm', creadoPorNomina: N.adm, creadoPorNombre: 'adm' }),
  }));

  it('autoriza como Aut. 1 y como Aut. 2', async () => {
    await assertSucceeds(accion('adm', 'n1', 'aut1'));
    await assertSucceeds(accion('adm', 'n2', 'aut2'));
  });
  it('devuelve en nivel 1, nivel 2 y nivel 3', async () => {
    await assertSucceeds(accion('adm', 'n1', 'dev1'));
    await assertSucceeds(accion('adm', 'n2', 'dev2'));
    await assertSucceeds(accion('adm', 'aut', 'dev3'));
  });
  it('se autoriza a sí mismo lo que capturó', async () => {
    await assertSucceeds(accion('adm', 'propia', 'aut1'));
    await assertSucceeds(accion('adm', 'propia2', 'aut2'));
  });
  it('cancela solicitudes en cualquier estatus', async () => {
    await assertSucceeds(accion('adm', 'n2', 'cancelar'));
    await assertSucceeds(accion('adm', 'aut', 'cancelar'));
  });
  it('ningún otro rol gana permisos: RH no autoriza como Aut. 1, el Aut. 1 no firma el nivel 2, el solicitante y Nóminas nada', async () => {
    await assertFails(accion('rh', 'n1', 'aut1'));
    await assertFails(accion('rh', 'n1', 'dev1'));
    await assertFails(accion('aut1P', 'n2', 'aut2'));
    for (const uid of ['solP', 'nom']) { await assertFails(accion(uid, 'n1', 'aut1')); await assertFails(accion(uid, 'n2', 'aut2')); await assertFails(accion(uid, 'n2', 'dev2')); }
  });
  it('y nadie más se autoriza lo propio', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'tiempoExtra', 'propiaAut1'), te('pendiente_aut1', HOY, { creadoPor: 'aut1P', creadoPorNomina: N.aut1P, creadoPorNombre: 'aut1P' })));
    await assertFails(accion('aut1P', 'propiaAut1', 'aut1'));
  });
});

describe('admin: autorizar fuera de tiempo', () => {
  beforeEach(() => sembrar({ n1v: te('pendiente_aut1', AYER), n2v: te('pendiente_aut2', AYER), n2Hoy: te('pendiente_aut2', HOY), devueltaV: te('devuelta', AYER) }));

  it('autoriza una vencida de nivel 2 y una de nivel 1 (con la firma «sin Aut. 1»)', async () => {
    await assertSucceeds(accion('adm', 'n2v', 'fuera2'));
    await assertSucceeds(accion('adm', 'n1v', 'fuera1'));
  });
  it('no si todavía está a tiempo ni si es una devuelta', async () => {
    await assertFails(accion('adm', 'n2Hoy', 'fuera2'));
    await assertFails(accion('adm', 'devueltaV', 'fuera2'));
  });
  it('RH sin Aut. 2, Nóminas, Aut. 1 y solicitante siguen sin poder', async () => {
    for (const uid of ['rh', 'nom', 'aut1P', 'solP']) await assertFails(accion(uid, 'n2v', 'fuera2'));
  });
});

describe('admin: enviar al proveedor y cerrar sin transporte', () => {
  beforeEach(() => sembrar({ aut: te('autorizada', AYER, { aut2: firmaSemilla(N.aut2) }), aut2: te('autorizada', HOY, { aut2: firmaSemilla(N.aut2) }) }));

  it('confirma el envío y cierra sin transporte', async () => {
    await assertSucceeds(accion('adm', 'aut2', 'recibir'));
    await assertSucceeds(accion('adm', 'aut', 'cerrar'));
  });
  it('quien no es RH ni Nóminas no puede', async () => {
    for (const uid of ['solP', 'aut1P', 'aut2']) { await assertFails(accion(uid, 'aut2', 'recibir')); await assertFails(accion(uid, 'aut', 'cerrar')); }
  });
});

describe('admin: ajustes, firmado y reapertura de nómina', () => {
  beforeEach(() => sembrar({}));
  const ajuste = (uid, extra = {}) => ({
    semana: '2026-02', areaId: 'produccion', desde: '2026-01-05', hasta: '2026-01-11', cambios: [], renglones: [], firmada: false, actualizadoPor: { uid }, fechaActualizacion: ts(), ...extra,
  });

  it('guarda ajustes, firma y reabre una semana firmada', async () => {
    await assertSucceeds(setDoc(doc(dbDe('adm'), 'ajustesNomina', '2026-02_produccion'), ajuste('adm')));
    await assertSucceeds(setDoc(doc(dbDe('adm'), 'ajustesNomina', '2026-03_produccion'), ajuste('adm', { semana: '2026-03', firmada: true, firmadaPor: { uid: 'adm' } })));
    await assertSucceeds(updateDoc(doc(dbDe('adm'), 'ajustesNomina', '2026-01_produccion'), { firmada: false, firmadaPor: null, reabiertaPor: { uid: 'adm' }, actualizadoPor: { uid: 'adm' }, fechaActualizacion: ts() }));
  });
  it('la bitácora lo registra con su uid y su nombre, sin nada extra', async () => {
    await assertSucceeds(setDoc(doc(collection(dbDe('adm'), 'bitacora')), { accion: 'ajustar_nomina', entidad: 'ajustesNomina/2026-02_produccion', antes: null, despues: null, porUid: 'adm', porNombre: 'adm', fecha: ts() }));
    await assertFails(setDoc(doc(collection(dbDe('adm'), 'bitacora')), { accion: 'ajustar_nomina', entidad: 'ajustesNomina/x', antes: null, despues: null, porUid: 'rh', porNombre: 'rh', fecha: ts() }));
  });
  it('la Aut. 2 y el solicitante siguen sin tocar los ajustes', async () => {
    for (const uid of ['aut2', 'solP', 'aut1P']) await assertFails(setDoc(doc(dbDe(uid), 'ajustesNomina', '2026-02_produccion'), ajuste(uid)));
  });
});
