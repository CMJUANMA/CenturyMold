// Reglas del MODO ADMIN: el admin hace cualquier acción de tiempo extra y de nómina con su propia cuenta, siempre marcada (accionAdmin / admin); nadie más gana permisos.
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
const entrada = (uid, accion, nivel, extra = {}) => ({ accion, nivel, porUid: uid, porNomina: N[uid], porNombre: uid, comentario: '', fecha: ts(), ...extra });

/**
 * Una acción de tiempo extra como la manda la app: el cambio de la solicitud y su entrada del historial en el mismo lote.
 * `marca`: lleva accionAdmin (en la solicitud) y admin (en el historial).
 */
function accion(uid, id, tipo, { marca = true, cambios = {}, historial = true } = {}) {
  const db = dbDe(uid);
  const b = writeBatch(db);
  const m = marca ? { accionAdmin: true } : {};
  const h = (a, nivel) => { if (historial) b.set(doc(collection(db, 'tiempoExtra', id, 'historial')), entrada(uid, a, nivel, marca ? { admin: true } : {})); };
  const dev = (nivel) => ({ estatus: 'devuelta', devolucion: { nivel, nomina: N[uid], nombre: uid, motivo: 'Faltan datos del turno', fecha: ts() } });
  const cambiosDe = {
    aut1: () => { h('autorizada_1', 1); return { estatus: 'pendiente_aut2', aut1: { ...quien(uid), comentario: '', comoRH: false } }; },
    dev1: () => { h('devuelta', 1); return dev(1); },
    aut2: () => { h('autorizada_2', 2); return { estatus: 'autorizada', aut2: { ...quien(uid), comentario: '', comoRH: true } }; },
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
    cancelar: () => { h('cancelada', 0); return { estatus: 'cancelada', motivoCancelacion: 'Se canceló el turno extra', canceladaPor: { ...quien(uid), comoRH: true } }; },
  }[tipo]();
  b.update(doc(db, 'tiempoExtra', id), { ...cambiosDe, ...m, fechaActualizacion: ts(), ...cambios });
  return b.commit();
}

/** Enviar un borrador propio: el contador del año sube 1 en el mismo lote */
function enviar(uid, id, estatus, { marca = true } = {}) {
  const db = dbDe(uid);
  const b = writeBatch(db);
  const anio = String(new Date().getFullYear());
  b.set(doc(db, 'contadores', `te-${anio}`), { ultimo: 1, solicitudId: id });
  b.update(doc(db, 'tiempoExtra', id), {
    estatus, folio: `TE-${anio}-0001`, resumen: { totalEmpleados: 1, totalHoras: 8, totalTransporte: 0, totalAlimentos: 0 }, ...(marca ? { accionAdmin: true } : {}), fechaActualizacion: ts(),
  });
  b.set(doc(collection(db, 'tiempoExtra', id, 'historial')), entrada(uid, 'enviada', 0, marca ? { admin: true } : {}));
  return b.commit();
}

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-solicitud-rutas', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => { await env?.cleanup(); });

describe('modo admin: capturar y enviar', () => {
  beforeEach(() => sembrar({ brAdm: borrador('adm', 'produccion', { accionAdmin: true }), brAdmAdm: borrador('adm', 'administrativo', { accionAdmin: true }), brSin: borrador('adm', 'produccion') }));

  it('el admin crea un borrador marcado en cualquier área activa, sin asignaciones', async () => {
    await assertSucceeds(setDoc(doc(dbDe('adm'), 'tiempoExtra', 'BR-nuevoAdminTE1'), borrador('adm', 'produccion', { accionAdmin: true })));
    await assertSucceeds(setDoc(doc(dbDe('adm'), 'tiempoExtra', 'BR-nuevoAdminTE2'), borrador('adm', 'administrativo', { accionAdmin: true })));
  });
  it('...pero sin la marca no (en un área donde no tiene asignación)', async () => {
    await assertFails(setDoc(doc(dbDe('adm'), 'tiempoExtra', 'BR-sinMarcaAdmin1'), borrador('adm', 'produccion')));
  });
  it('nadie más puede marcar un borrador como acción de admin', async () => {
    for (const uid of ['rh', 'solP', 'aut1P', 'aut2', 'nom']) await assertFails(setDoc(doc(dbDe(uid), 'tiempoExtra', `BR-marca${uid}ABCDE`), borrador(uid, 'produccion', { accionAdmin: true })));
  });
  it('el admin envía su borrador: nivel 1 si el área participa, nivel 2 si no; nunca autorizada', async () => {
    await assertSucceeds(enviar('adm', 'brAdm', 'pendiente_aut1'));
  });
  it('...en un área que no participa, a nivel 2', async () => {
    await assertSucceeds(enviar('adm', 'brAdmAdm', 'pendiente_aut2'));
  });
  it('...y no se autoriza solo al enviar, ni salta de nivel', async () => {
    await assertFails(enviar('adm', 'brAdm', 'autorizada'));
    await assertFails(enviar('adm', 'brAdm', 'pendiente_aut2'));
    await assertFails(enviar('adm', 'brAdmAdm', 'pendiente_aut1'));
  });
  it('sin la marca, un admin sin asignación no envía', async () => {
    await assertFails(enviar('adm', 'brSin', 'pendiente_aut1', { marca: false }));
  });
});

describe('modo admin: autorizar, devolver y cancelar', () => {
  beforeEach(() => sembrar({
    n1: te('pendiente_aut1', HOY), n2: te('pendiente_aut2', HOY), aut: te('autorizada', AYER, { aut2: firmaSemilla(N.aut2) }),
    n1v: te('pendiente_aut1', AYER), n2v: te('pendiente_aut2', AYER), devueltaV: te('devuelta', AYER),
    propia: te('pendiente_aut1', HOY, { creadoPor: 'adm', creadoPorNomina: N.adm, creadoPorNombre: 'adm' }),
    propia2: te('pendiente_aut2', HOY, { creadoPor: 'adm', creadoPorNomina: N.adm, creadoPorNombre: 'adm' }),
  }));

  it('el admin autoriza como Aut. 1 y como Aut. 2, con la marca', async () => {
    await assertSucceeds(accion('adm', 'n1', 'aut1'));
    await assertSucceeds(accion('adm', 'n2', 'aut2'));
  });
  it('...y devuelve en nivel 1, nivel 2 y nivel 3', async () => {
    await assertSucceeds(accion('adm', 'n1', 'dev1'));
    await assertSucceeds(accion('adm', 'n2', 'dev2'));
    await assertSucceeds(accion('adm', 'aut', 'dev3'));
  });
  it('autoriza también lo que él mismo capturó (para probar el flujo completo)', async () => {
    await assertSucceeds(accion('adm', 'propia', 'aut1'));
    await assertSucceeds(accion('adm', 'propia2', 'aut2'));
  });
  it('autorizar como Aut. 1 sin la marca no se puede (no es Aut. 1 de verdad)', async () => {
    await assertFails(accion('adm', 'n1', 'aut1', { marca: false }));
    await assertFails(accion('adm', 'n1', 'dev1', { marca: false }));
  });
  it('el admin cancela con la marca', async () => {
    await assertSucceeds(accion('adm', 'n2', 'cancelar'));
    await assertSucceeds(accion('adm', 'aut', 'cancelar'));
  });
  it('nadie más gana permisos con la marca: RH, Aut. 1, Aut. 2, solicitante y Nóminas', async () => {
    for (const uid of ['rh', 'aut1P', 'aut2', 'solP', 'nom']) {
      await assertFails(accion(uid, 'n1', 'aut1'));
      await assertFails(accion(uid, 'n2', 'dev2'));
    }
  });
  it('un Aut. 1 de verdad sigue autorizando sin marca y no puede ponérsela', async () => {
    await assertSucceeds(accion('aut1P', 'n1', 'aut1', { marca: false }));
    await assertFails(accion('aut1P', 'n1', 'dev1', { marca: true }));
  });
  it('la marca de la solicitud no se quita', async () => {
    await assertSucceeds(accion('adm', 'n2', 'aut2'));
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'tiempoExtra', 'n2'), { accionAdmin: true }));
    await assertFails(updateDoc(doc(dbDe('rh'), 'tiempoExtra', 'n2'), { accionAdmin: false, fechaActualizacion: ts() }));
  });
});

describe('modo admin: autorizar fuera de tiempo', () => {
  beforeEach(() => sembrar({ n1v: te('pendiente_aut1', AYER), n2v: te('pendiente_aut2', AYER), n2Hoy: te('pendiente_aut2', HOY), devueltaV: te('devuelta', AYER) }));

  it('el admin autoriza una vencida de nivel 2 y una de nivel 1 (con la firma «sin Aut. 1»)', async () => {
    await assertSucceeds(accion('adm', 'n2v', 'fuera2'));
    await assertSucceeds(accion('adm', 'n1v', 'fuera1'));
  });
  it('...sin la marca no, y no si todavía está a tiempo ni si es una devuelta', async () => {
    await assertFails(accion('adm', 'n2v', 'fuera2', { marca: false }));
    await assertFails(accion('adm', 'n2Hoy', 'fuera2'));
    await assertFails(accion('adm', 'devueltaV', 'fuera2'));
  });
  it('RH, Nóminas, Aut. 1 y solicitante no pueden, ni con la marca', async () => {
    for (const uid of ['rh', 'nom', 'aut1P', 'solP']) await assertFails(accion(uid, 'n2v', 'fuera2'));
  });
});

describe('modo admin: enviar al proveedor y cerrar sin transporte', () => {
  beforeEach(() => sembrar({ aut: te('autorizada', AYER, { aut2: firmaSemilla(N.aut2) }), aut2: te('autorizada', HOY, { aut2: firmaSemilla(N.aut2) }) }));

  it('el admin confirma el envío y cierra sin transporte, con la marca', async () => {
    await assertSucceeds(accion('adm', 'aut2', 'recibir'));
    await assertSucceeds(accion('adm', 'aut', 'cerrar'));
  });
  it('quien no es RH ni Nóminas no puede aunque ponga la marca', async () => {
    for (const uid of ['solP', 'aut1P', 'aut2']) { await assertFails(accion(uid, 'aut2', 'recibir')); await assertFails(accion(uid, 'aut', 'cerrar')); }
  });
  it('el historial no puede decir «admin» si quien lo escribe no es admin', async () => {
    const db = dbDe('rh');
    const b = writeBatch(db);
    b.update(doc(db, 'tiempoExtra', 'aut2'), { estatus: 'procesada', recibidaPor: quien('rh'), fechaRecepcion: ts(), fechaActualizacion: ts() });
    b.set(doc(collection(db, 'tiempoExtra', 'aut2', 'historial')), entrada('rh', 'recibida_rh', 0, { admin: true }));
    await assertFails(b.commit());
  });
});

describe('modo admin: bitácora y ajustes de nómina', () => {
  beforeEach(() => sembrar({}));
  const renglon = (uid, extra = {}) => ({ accion: 'ajustar_nomina', entidad: 'ajustesNomina/2026-02_produccion', antes: null, despues: null, porUid: uid, porNombre: uid, fecha: ts(), ...extra });
  const ajuste = (uid, extra = {}) => ({
    semana: '2026-02', areaId: 'produccion', desde: '2026-01-05', hasta: '2026-01-11', cambios: [], renglones: [], firmada: false, actualizadoPor: { uid }, fechaActualizacion: ts(), ...extra,
  });

  it('la bitácora lleva accionAdmin solo si la escribe el admin', async () => {
    await assertSucceeds(setDoc(doc(collection(dbDe('adm'), 'bitacora')), renglon('adm', { accionAdmin: true })));
    for (const uid of ['rh', 'nom']) await assertFails(setDoc(doc(collection(dbDe(uid), 'bitacora')), renglon(uid, { accionAdmin: true })));
  });
  it('el admin guarda ajustes de nómina marcados; RH y Nóminas no pueden marcarlos', async () => {
    await assertSucceeds(setDoc(doc(dbDe('adm'), 'ajustesNomina', '2026-02_produccion'), ajuste('adm', { accionAdmin: true })));
    await assertSucceeds(setDoc(doc(dbDe('adm'), 'ajustesNomina', '2026-03_produccion'), ajuste('adm', { semana: '2026-03', accionAdmin: true, firmada: true, firmadaPor: { uid: 'adm' } })));
    for (const uid of ['rh', 'nom']) await assertFails(setDoc(doc(dbDe(uid), 'ajustesNomina', '2026-02_produccion'), ajuste(uid, { accionAdmin: true })));
  });
  it('el admin reabre una semana firmada, marcada; RH no puede marcarla', async () => {
    const reabrir = (uid, extra = {}) => updateDoc(doc(dbDe(uid), 'ajustesNomina', '2026-01_produccion'), { firmada: false, firmadaPor: null, reabiertaPor: { uid }, actualizadoPor: { uid }, fechaActualizacion: ts(), ...extra });
    await assertFails(reabrir('rh', { accionAdmin: true }));
    await assertSucceeds(reabrir('adm', { accionAdmin: true }));
  });
});
