// Reglas de la estructura Áreas → Puestos → Empleados y de la bitácora, contra el emulador de Firestore.
// Ejecutar con: npm run test:rules
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch, collection, getDocs } from 'firebase/firestore';

let env;
const perfil = (rol, extra = {}) => ({ nombre: rol, rol, nomina: `n-${rol}`, activo: true, ...extra });

async function sembrar() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios', 'admin'), perfil('admin'));
    await setDoc(doc(db, 'usuarios', 'rh'), perfil('rh'));
    // Un solicitante y un Aut. 1 de Producción (por asignaciones vigentes), ambos con rol de sistema "usuario"
    await setDoc(doc(db, 'usuarios', 'sup'), perfil('usuario', { nomina: 'n-sup' }));
    await setDoc(doc(db, 'usuarios', 'aut'), perfil('usuario', { nomina: 'n-aut' }));
    for (const [nomina, rol] of [['n-sup', 'solicitante'], ['n-aut', 'aut1']]) {
      await setDoc(doc(db, 'asignaciones', `${nomina}_${rol}_produccion`), {
        nomina, nombre: nomina, rol, areaId: 'produccion', desde: new Date(Date.now() - 86400000), hasta: null, motivo: '',
        activo: true, asignadoPor: { uid: 'admin', nombre: 'Admin' }, fechaAsignacion: new Date(),
      });
    }
    await setDoc(doc(db, 'usuarios', 'inactivo'), perfil('rh', { activo: false }));
    await setDoc(doc(db, 'areas', 'produccion'), { nombre: 'Producción', participaTE: true, activa: true, orden: 1 });
    await setDoc(doc(db, 'puestos', 'resiner'), {
      nombre: 'RESINER', areaId: 'produccion', activo: true, alias: [], creadoPor: 'rh', fechaCreacion: new Date(),
    });
    await setDoc(doc(db, 'empleados', '100'), {
      nomina: '100', nombre: 'ANA', puesto: 'RESINER', puestoId: 'resiner', areaId: 'produccion',
      areaExcepcion: null, areaExcepcionMotivo: '', rutaId: '', comunidadId: '', puntoReunionId: '', activo: true,
    });
    await setDoc(doc(db, 'bitacora', 'b1'), {
      accion: 'x', entidad: 'puesto', antes: null, despues: null, porUid: 'rh', porNombre: 'rh', fecha: new Date(),
    });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-solicitud-rutas-estructura',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await sembrar(); });

const dbDe = (uid) => env.authenticatedContext(uid).firestore();
const puestoNuevo = (uid, extra = {}) => ({
  nombre: 'QUALITY INSPECTOR', areaId: 'calidad', activo: true, alias: [],
  creadoPor: uid, fechaCreacion: serverTimestamp(), ...extra,
});

describe('areas', () => {
  it('cualquier usuario activo las lee; el inactivo no', async () => {
    for (const u of ['sup', 'aut', 'rh', 'admin']) await assertSucceeds(getDoc(doc(dbDe(u), 'areas', 'produccion')));
    await assertFails(getDoc(doc(dbDe('inactivo'), 'areas', 'produccion')));
  });
  it('admin y RH las crean y editan; solicitante y Aut. 1 no', async () => {
    const nueva = { nombre: 'Calidad', participaTE: true, activa: true, orden: 3 };
    await assertSucceeds(setDoc(doc(dbDe('rh'), 'areas', 'calidad'), nueva));
    await assertSucceeds(updateDoc(doc(dbDe('admin'), 'areas', 'calidad'), { activa: false }));
    await assertFails(setDoc(doc(dbDe('sup'), 'areas', 'otra'), nueva));
    await assertFails(setDoc(doc(dbDe('aut'), 'areas', 'otra'), nueva));
    await assertFails(updateDoc(doc(dbDe('sup'), 'areas', 'produccion'), { activa: false }));
  });
  it('valida tipos y nunca se borran (baja lógica)', async () => {
    await assertFails(setDoc(doc(dbDe('rh'), 'areas', 'mala'), { nombre: 'X', participaTE: 'si', activa: true, orden: 1 }));
    await assertFails(setDoc(doc(dbDe('rh'), 'areas', 'mala'), { nombre: '', participaTE: true, activa: true, orden: 1 }));
    await assertFails(deleteDoc(doc(dbDe('admin'), 'areas', 'produccion')));
  });
});

describe('puestos', () => {
  it('cualquier usuario activo los lee', async () => {
    for (const u of ['sup', 'aut', 'rh', 'admin']) await assertSucceeds(getDoc(doc(dbDe(u), 'puestos', 'resiner')));
    await assertFails(getDoc(doc(dbDe('inactivo'), 'puestos', 'resiner')));
  });
  it('admin y RH crean puestos; los demás no', async () => {
    await assertSucceeds(setDoc(doc(dbDe('rh'), 'puestos', 'quality-inspector'), puestoNuevo('rh')));
    await assertSucceeds(setDoc(doc(dbDe('admin'), 'puestos', 'otro'), puestoNuevo('admin', { nombre: 'OTRO' })));
    await assertFails(setDoc(doc(dbDe('sup'), 'puestos', 'x'), puestoNuevo('sup')));
    await assertFails(setDoc(doc(dbDe('aut'), 'puestos', 'x'), puestoNuevo('aut')));
  });
  it('el nombre va en mayúsculas, creadoPor es quien lo crea y la fecha la pone el servidor', async () => {
    await assertFails(setDoc(doc(dbDe('rh'), 'puestos', 'a'), puestoNuevo('rh', { nombre: 'Quality Inspector' })));
    await assertFails(setDoc(doc(dbDe('rh'), 'puestos', 'b'), puestoNuevo('admin')));
    await assertFails(setDoc(doc(dbDe('rh'), 'puestos', 'c'), puestoNuevo('rh', { fechaCreacion: new Date() })));
    await assertFails(setDoc(doc(dbDe('rh'), 'puestos', 'd'), puestoNuevo('rh', { alias: 'no-es-lista' })));
  });
  it('RH cambia área y alias, pero no creadoPor ni fechaCreacion; nadie los borra', async () => {
    const ref = doc(dbDe('rh'), 'puestos', 'resiner');
    await assertSucceeds(updateDoc(ref, { areaId: 'almacen' }));
    await assertSucceeds(updateDoc(ref, { alias: ['RESINERO'] }));
    await assertFails(updateDoc(ref, { creadoPor: 'otro' }));
    await assertFails(updateDoc(ref, { fechaCreacion: serverTimestamp() }));
    await assertFails(updateDoc(doc(dbDe('sup'), 'puestos', 'resiner'), { areaId: 'almacen' }));
    await assertFails(deleteDoc(doc(dbDe('admin'), 'puestos', 'resiner')));
  });
});

describe('bitácora', () => {
  const entrada = (uid, extra = {}) => ({
    accion: 'cambio_area_puesto', entidad: 'puesto/resiner', antes: { areaId: 'produccion' }, despues: { areaId: 'almacen' },
    porUid: uid, porNombre: uid, fecha: serverTimestamp(), ...extra,
  });
  it('admin y RH crean y leen; los demás ni una cosa ni la otra', async () => {
    await assertSucceeds(setDoc(doc(collection(dbDe('rh'), 'bitacora')), entrada('rh')));
    await assertSucceeds(setDoc(doc(collection(dbDe('admin'), 'bitacora')), entrada('admin')));
    await assertSucceeds(getDocs(collection(dbDe('rh'), 'bitacora')));
    await assertSucceeds(getDoc(doc(dbDe('admin'), 'bitacora', 'b1')));
    await assertFails(setDoc(doc(collection(dbDe('sup'), 'bitacora')), entrada('sup')));
    await assertFails(getDoc(doc(dbDe('sup'), 'bitacora', 'b1')));
    await assertFails(getDoc(doc(dbDe('aut'), 'bitacora', 'b1')));
  });
  it('no se puede firmar como otro, ni poner fecha propia ni campos extra', async () => {
    await assertFails(setDoc(doc(collection(dbDe('rh'), 'bitacora')), entrada('admin')));
    await assertFails(setDoc(doc(collection(dbDe('rh'), 'bitacora')), entrada('rh', { fecha: new Date() })));
    await assertFails(setDoc(doc(collection(dbDe('rh'), 'bitacora')), entrada('rh', { extra: 1 })));
  });
  it('nadie la edita ni la borra, ni siquiera admin', async () => {
    await assertFails(updateDoc(doc(dbDe('admin'), 'bitacora', 'b1'), { accion: 'otra' }));
    await assertFails(updateDoc(doc(dbDe('rh'), 'bitacora', 'b1'), { accion: 'otra' }));
    await assertFails(deleteDoc(doc(dbDe('admin'), 'bitacora', 'b1')));
  });
  it('un lote con el cambio y su bitácora se guarda junto', async () => {
    const db = dbDe('rh');
    const batch = writeBatch(db);
    batch.update(doc(db, 'puestos', 'resiner'), { areaId: 'almacen' });
    batch.set(doc(collection(db, 'bitacora')), entrada('rh'));
    await assertSucceeds(batch.commit());
  });
});

describe('empleados: puestoId, areaId y excepción', () => {
  const ref = (uid) => doc(dbDe(uid), 'empleados', '100');
  it('admin y RH los cambian', async () => {
    await assertSucceeds(updateDoc(ref('rh'), { puestoId: 'otro', areaId: 'almacen' }));
    await assertSucceeds(updateDoc(ref('admin'), { areaExcepcion: 'moldes', areaExcepcionMotivo: 'Prestado', areaId: 'moldes' }));
  });
  it('solicitante y Aut. 1 no pueden cambiar ninguno', async () => {
    for (const campos of [{ puestoId: 'otro' }, { areaId: 'moldes' }, { areaExcepcion: 'moldes' }, { areaExcepcionMotivo: 'x' }]) {
      await assertFails(updateDoc(ref('sup'), campos));
      await assertFails(updateDoc(ref('aut'), campos));
    }
  });
  it('el solicitante del área sigue pudiendo cambiar solo ruta, comunidad y punto', async () => {
    await assertSucceeds(updateDoc(ref('sup'), { rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1' }));
    await assertFails(updateDoc(ref('sup'), { rutaId: 'r1', areaId: 'moldes' }));
  });
  it('solo RH/admin crean empleados con área', async () => {
    const e = { nomina: '200', nombre: 'LUIS', puestoId: 'resiner', areaId: 'produccion', activo: true };
    await assertSucceeds(setDoc(doc(dbDe('rh'), 'empleados', '200'), e));
    await assertFails(setDoc(doc(dbDe('sup'), 'empleados', '201'), e));
  });
});
