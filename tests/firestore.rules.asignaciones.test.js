// Reglas de asignaciones (roles operativos) y de usuarios/bitácora que dependen de ellas, contra el emulador de Firestore.
// Ejecutar con: npm run test:rules  (requiere Java 11+; levanta el emulador por sí solo)
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  Timestamp, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';

let env;

const N = {
  admin: '90000', rh: '90001', aut2: '11', aut1P: '50610', solP: '50532', nuevo: '50700', otro: '50701', ajeno: '50999',
};
const perfil = (rol, nomina, extra = {}) => ({ nombre: `Usuario ${nomina}`, rol, nomina, activo: true, ...extra });
const dia = 24 * 3600 * 1000;
const hace = (ms) => Timestamp.fromDate(new Date(Date.now() - ms));
const en = (ms) => Timestamp.fromDate(new Date(Date.now() + ms));
const idDe = (nomina, rol, area) => `${nomina}_${rol}_${rol === 'aut2' ? 'planta' : area}`;

const guardada = (nomina, rol, areaId, extra = {}) => ({
  nomina, nombre: `Usuario ${nomina}`, rol, areaId: rol === 'aut2' ? null : areaId,
  desde: hace(dia), hasta: null, motivo: '', activo: true, asignadoPor: { uid: 'admin', nombre: 'Admin' }, fechaAsignacion: Timestamp.now(), ...extra,
});

/** Lo que manda la app al asignar: asignadoPor del que actúa y fechaAsignacion del servidor */
const nueva = (uid, nomina, rol, areaId, extra = {}) => ({
  nomina, nombre: `Usuario ${nomina}`, rol, areaId: rol === 'aut2' ? null : areaId,
  desde: hace(1000), hasta: null, motivo: '', activo: true, asignadoPor: { uid, nombre: uid }, fechaAsignacion: serverTimestamp(), ...extra,
});

async function sembrar() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, rol, nomina] of [
      ['admin', 'admin', N.admin], ['rh', 'rh', N.rh], ['aut2', 'usuario', N.aut2], ['aut1P', 'usuario', N.aut1P],
      ['solP', 'usuario', N.solP], ['ajeno', 'usuario', N.ajeno],
    ]) await setDoc(doc(db, 'usuarios', uid), perfil(rol, nomina));
    for (const [id, nombre, participaTE] of [['produccion', 'Producción', true], ['calidad', 'Calidad', true], ['administrativo', 'Administrativo', false]]) {
      await setDoc(doc(db, 'areas', id), { nombre, participaTE, activa: true, orden: 1 });
    }
    for (const [nomina, rol, area] of [[N.aut2, 'aut2', null], [N.aut1P, 'aut1', 'produccion'], [N.solP, 'solicitante', 'produccion']]) {
      await setDoc(doc(db, 'asignaciones', idDe(nomina, rol, area)), guardada(nomina, rol, area));
    }
  });
}

const dbDe = (uid) => env.authenticatedContext(uid).firestore();
const asignar = (uid, nomina, rol, area, extra) => setDoc(doc(dbDe(uid), 'asignaciones', idDe(nomina, rol, area)), nueva(uid, nomina, rol, area, extra));

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-solicitud-rutas-asignaciones',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await sembrar();
});

describe('lectura', () => {
  it('cada quien lee las suyas (y las consulta por su nómina)', async () => {
    for (const [uid, nomina] of [['solP', N.solP], ['aut1P', N.aut1P], ['aut2', N.aut2]]) {
      await assertSucceeds(getDocs(query(collection(dbDe(uid), 'asignaciones'), where('nomina', '==', nomina))));
    }
    await assertFails(getDocs(query(collection(dbDe('solP'), 'asignaciones'), where('nomina', '==', N.aut1P))));
  });
  it('el Aut. 1 lee las de su área y las de Aut. 2; no las de otra área', async () => {
    const col = collection(dbDe('aut1P'), 'asignaciones');
    await assertSucceeds(getDoc(doc(dbDe('aut1P'), 'asignaciones', idDe(N.solP, 'solicitante', 'produccion'))));
    await assertSucceeds(getDocs(query(col, where('areaId', '==', 'produccion'))));
    await assertSucceeds(getDocs(query(col, where('rol', '==', 'aut2'))));
    await assertFails(getDocs(query(col, where('areaId', '==', 'calidad'))));
    await assertFails(getDocs(col));
  });
  it('un solicitante no lee las de otros compañeros de su área', async () => {
    await assertFails(getDoc(doc(dbDe('solP'), 'asignaciones', idDe(N.aut1P, 'aut1', 'produccion'))));
  });
  it('Aut. 2, RH y admin leen todas', async () => {
    for (const uid of ['aut2', 'rh', 'admin']) await assertSucceeds(getDocs(collection(dbDe(uid), 'asignaciones')));
  });
  it('un usuario inactivo no las lee', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), 'usuarios', 'ajeno'), { activo: false }); });
    await assertFails(getDoc(doc(dbDe('ajeno'), 'asignaciones', idDe(N.solP, 'solicitante', 'produccion'))));
  });
});

describe('quién puede asignar qué', () => {
  it('admin asigna todo: aut2, aut1 y solicitante', async () => {
    await assertSucceeds(asignar('admin', N.nuevo, 'aut2'));
    await assertSucceeds(asignar('admin', N.nuevo, 'aut1', 'calidad'));
    await assertSucceeds(asignar('admin', N.nuevo, 'solicitante', 'produccion'));
  });

  it('RH asigna aut1 y solicitante (sí) pero aut2 no', async () => {
    await assertSucceeds(asignar('rh', N.nuevo, 'aut1', 'calidad'));
    await assertSucceeds(asignar('rh', N.nuevo, 'solicitante', 'calidad'));
    await assertFails(asignar('rh', N.nuevo, 'aut2'));
  });

  it('una Aut. 2 vigente asigna un solicitante y un Aut. 1 en cualquier área, pero no otra Aut. 2', async () => {
    await assertSucceeds(asignar('aut2', N.nuevo, 'solicitante', 'calidad'));
    await assertSucceeds(asignar('aut2', N.nuevo, 'aut1', 'produccion'));
    await assertFails(asignar('aut2', N.nuevo, 'aut2'));
  });

  it('un Aut. 1 no asigna a nadie; tampoco un solicitante ni un ajeno', async () => {
    for (const uid of ['aut1P', 'solP', 'ajeno']) {
      await assertFails(asignar(uid, N.nuevo, 'solicitante', 'produccion'));
      await assertFails(asignar(uid, N.nuevo, 'aut1', 'produccion'));
    }
  });

  it('una Aut. 2 vencida, revocada o programada deja de poder asignar', async () => {
    const id = idDe(N.aut2, 'aut2');
    for (const cambios of [{ hasta: hace(1000) }, { activo: false }, { desde: en(dia) }]) {
      await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'asignaciones', id), guardada(N.aut2, 'aut2', null, cambios)); });
      await assertFails(asignar('aut2', N.nuevo, 'solicitante', 'calidad'));
    }
  });

  it('nadie, salvo admin, crea ni cambia sus propias asignaciones', async () => {
    await assertFails(asignar('rh', N.rh, 'aut1', 'calidad'));
    await assertFails(asignar('aut2', N.aut2, 'solicitante', 'calidad'));
    await assertFails(asignar('aut2', N.aut2, 'aut1', 'produccion'));
    await assertFails(asignar('aut1P', N.aut1P, 'solicitante', 'produccion'));
    await assertFails(asignar('solP', N.solP, 'aut1', 'produccion'));
    await assertSucceeds(asignar('admin', N.admin, 'aut1', 'calidad')); // el admin sí
  });

  it('aut1 y solicitante solo en áreas con participaTE', async () => {
    await assertFails(asignar('rh', N.nuevo, 'aut1', 'administrativo'));
    await assertFails(asignar('aut2', N.nuevo, 'solicitante', 'administrativo'));
    await assertFails(asignar('rh', N.nuevo, 'solicitante', 'fantasma'));
  });

  it('el id debe ser nomina_rol_area y la forma del documento válida', async () => {
    const db = dbDe('rh');
    await assertFails(setDoc(doc(db, 'asignaciones', 'cualquier-id'), nueva('rh', N.nuevo, 'aut1', 'calidad')));
    await assertFails(setDoc(doc(db, 'asignaciones', idDe(N.nuevo, 'aut1', 'produccion')), nueva('rh', N.nuevo, 'aut1', 'calidad')));
    await assertFails(asignar('rh', N.nuevo, 'aut1', 'calidad', { rol: 'director' }));
    await assertFails(asignar('rh', N.nuevo, 'aut1', 'calidad', { extra: 1 }));
    await assertFails(asignar('rh', N.nuevo, 'aut1', 'calidad', { activo: false }));
    await assertFails(asignar('rh', N.nuevo, 'aut1', 'calidad', { fechaAsignacion: Timestamp.fromDate(new Date(2020, 0, 1)) }));
    await assertFails(asignar('rh', N.nuevo, 'aut1', 'calidad', { asignadoPor: { uid: 'otro', nombre: 'x' } }));
  });

  it('una asignación temporal exige motivo y hasta >= desde', async () => {
    await assertFails(asignar('rh', N.nuevo, 'aut1', 'calidad', { hasta: en(2 * dia), motivo: '' }));
    await assertFails(asignar('rh', N.nuevo, 'aut1', 'calidad', { hasta: hace(5 * dia), motivo: 'Vacaciones' }));
    await assertSucceeds(asignar('rh', N.nuevo, 'aut1', 'calidad', { hasta: en(2 * dia), motivo: 'Cubre vacaciones' }));
  });

  it('un Aut. 1 temporal de 2 días queda vigente y luego vencido sin intervención', async () => {
    await assertSucceeds(asignar('rh', N.nuevo, 'aut1', 'calidad', { hasta: en(2 * dia), motivo: 'Cubre vacaciones' }));
    // El emulador no mueve el reloj: simula "pasaron 3 días" corriendo el hasta al pasado
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'asignaciones', idDe(N.nuevo, 'aut1', 'calidad')), { hasta: hace(dia) });
    });
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'usuarios', 'nuevo'), perfil('usuario', N.nuevo));
      await setDoc(doc(ctx.firestore(), 'tiempoExtra', 'TE-2026-0001'), { areaId: 'calidad', creadoPor: 'ajeno', estatus: 'pendiente_aut1' });
    });
    await assertFails(getDoc(doc(dbDe('nuevo'), 'tiempoExtra', 'TE-2026-0001')));
  });
});

describe('revocar, extender y volver a asignar', () => {
  const id = idDe(N.solP, 'solicitante', 'produccion');
  it('revocar es activo:false; RH y Aut. 2 revocan solicitantes y Aut. 1', async () => {
    await assertSucceeds(updateDoc(doc(dbDe('rh'), 'asignaciones', id), { activo: false }));
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'asignaciones', id), guardada(N.solP, 'solicitante', 'produccion')); });
    await assertSucceeds(updateDoc(doc(dbDe('aut2'), 'asignaciones', id), { activo: false }));
    await assertSucceeds(updateDoc(doc(dbDe('aut2'), 'asignaciones', idDe(N.aut1P, 'aut1', 'produccion')), { activo: false }));
  });
  it('extender cambia hasta y motivo', async () => {
    await assertSucceeds(updateDoc(doc(dbDe('rh'), 'asignaciones', id), { hasta: en(5 * dia), motivo: 'Proyecto' }));
    await assertFails(updateDoc(doc(dbDe('rh'), 'asignaciones', id), { hasta: en(5 * dia), motivo: '' }));
  });
  it('un Aut. 1, un solicitante o un ajeno no revocan ni extienden', async () => {
    for (const uid of ['aut1P', 'solP', 'ajeno']) {
      await assertFails(updateDoc(doc(dbDe(uid), 'asignaciones', id), { activo: false }));
      await assertFails(updateDoc(doc(dbDe(uid), 'asignaciones', id), { hasta: en(dia), motivo: 'x' }));
    }
  });
  it('RH y la Aut. 2 no tocan una Aut. 2; solo el admin', async () => {
    const aut2 = idDe(N.aut2, 'aut2');
    await assertFails(updateDoc(doc(dbDe('rh'), 'asignaciones', aut2), { activo: false }));
    await assertFails(updateDoc(doc(dbDe('aut2'), 'asignaciones', aut2), { hasta: en(dia), motivo: 'x' })); // ni la propia
    await assertSucceeds(updateDoc(doc(dbDe('admin'), 'asignaciones', aut2), { activo: false }));
  });
  it('no cambia persona, rol ni área; no se borra nunca', async () => {
    await assertFails(updateDoc(doc(dbDe('rh'), 'asignaciones', id), { areaId: 'calidad' }));
    await assertFails(updateDoc(doc(dbDe('rh'), 'asignaciones', id), { nomina: N.otro }));
    await assertFails(deleteDoc(doc(dbDe('rh'), 'asignaciones', id)));
    await assertFails(deleteDoc(doc(dbDe('admin'), 'asignaciones', id)));
  });
  it('volver a asignar a quien estaba revocado reescribe el documento con la fecha y el autor nuevos', async () => {
    await assertSucceeds(updateDoc(doc(dbDe('rh'), 'asignaciones', id), { activo: false }));
    await assertSucceeds(asignar('rh', N.solP, 'solicitante', 'produccion'));
    const db = dbDe('rh');
    const b = writeBatch(db);
    b.set(doc(db, 'asignaciones', id), nueva('rh', N.solP, 'solicitante', 'produccion', { fechaAsignacion: Timestamp.fromDate(new Date(2020, 0, 1)) }));
    await assertFails(b.commit()); // la fecha debe ser la del servidor
  });
});

describe('usuarios: solo admin da o quita rh y admin', () => {
  it('RH crea usuarios con rol usuario, no rh ni admin', async () => {
    await assertSucceeds(setDoc(doc(dbDe('rh'), 'usuarios', 'u1'), perfil('usuario', N.nuevo)));
    await assertFails(setDoc(doc(dbDe('rh'), 'usuarios', 'u2'), perfil('rh', N.otro)));
    await assertFails(setDoc(doc(dbDe('rh'), 'usuarios', 'u3'), perfil('admin', N.otro)));
    await assertSucceeds(setDoc(doc(dbDe('admin'), 'usuarios', 'u4'), perfil('rh', N.otro)));
  });
  it('RH no se promueve ni degrada; el admin sí cambia roles', async () => {
    await assertFails(updateDoc(doc(dbDe('rh'), 'usuarios', 'rh'), { rol: 'admin' }));
    await assertFails(updateDoc(doc(dbDe('rh'), 'usuarios', 'solP'), { rol: 'rh' }));
    await assertSucceeds(updateDoc(doc(dbDe('admin'), 'usuarios', 'solP'), { rol: 'rh' }));
  });
  it('la Aut. 2 vigente lee usuarios (para ver quién no tiene usuario); un Aut. 1 no', async () => {
    await assertSucceeds(getDocs(collection(dbDe('aut2'), 'usuarios')));
    await assertFails(getDocs(collection(dbDe('aut1P'), 'usuarios')));
    await assertFails(getDoc(doc(dbDe('aut1P'), 'usuarios', 'solP')));
  });
});

describe('bitácora de asignaciones', () => {
  const renglon = (uid, entidad = 'asignacion', extra = {}) => ({
    accion: 'asignar', entidad, antes: null, despues: { id: idDe(N.nuevo, 'aut1', 'calidad') }, porUid: uid, porNombre: uid, fecha: serverTimestamp(), ...extra,
  });
  it('la Aut. 2 deja constancia de sus asignaciones y las consulta; no otra entidad', async () => {
    await assertSucceeds(setDoc(doc(collection(dbDe('aut2'), 'bitacora')), renglon('aut2')));
    await assertFails(setDoc(doc(collection(dbDe('aut2'), 'bitacora')), renglon('aut2', 'puestos/x')));
    await assertSucceeds(getDocs(query(collection(dbDe('aut2'), 'bitacora'), where('entidad', '==', 'asignacion'))));
    await assertFails(getDocs(collection(dbDe('aut2'), 'bitacora')));
  });
  it('RH la lee y escribe; un Aut. 1 no; nadie la edita ni borra', async () => {
    await assertSucceeds(setDoc(doc(dbDe('rh'), 'bitacora', 'b1'), renglon('rh')));
    await assertFails(setDoc(doc(dbDe('aut1P'), 'bitacora', 'b2'), renglon('aut1P')));
    await assertFails(updateDoc(doc(dbDe('rh'), 'bitacora', 'b1'), { accion: 'x' }));
    await assertFails(deleteDoc(doc(dbDe('admin'), 'bitacora', 'b1')));
  });
  it('asignar y dejar la bitácora en el mismo lote funciona para la Aut. 2', async () => {
    const db = dbDe('aut2');
    const b = writeBatch(db);
    b.set(doc(db, 'asignaciones', idDe(N.nuevo, 'solicitante', 'calidad')), nueva('aut2', N.nuevo, 'solicitante', 'calidad'));
    b.set(doc(collection(db, 'bitacora')), renglon('aut2'));
    await assertSucceeds(b.commit());
  });
});
