// accesos/{nomina} (qué cuenta usa cada nómina), "Restablecer contraseña" con la app y quién da el rol RH. Ejecutar con npm run test:rules.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

let env;
const dbDe = (uid) => env.authenticatedContext(uid).firestore();
const sinSesion = () => env.unauthenticatedContext().firestore();
const perfil = (rol, nomina, extra = {}) => ({ nombre: `Persona ${nomina}`, rol, nomina, activo: true, debeCambiarPassword: false, ...extra });
const NOMINA = { admin: '1', rh: '2', rh2: '3', marco: '5001', otro: '5002', aut2sinvigencia: '5003', solicitante: '5004' };

const hace = (dias) => new Date(Date.now() - dias * 86400000);
async function sembrar() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios', 'admin'), perfil('admin', '1'));
    await setDoc(doc(db, 'usuarios', 'rh'), perfil('rh', '2'));
    await setDoc(doc(db, 'usuarios', 'rh2'), perfil('rh', '3'));
    await setDoc(doc(db, 'usuarios', 'marco'), perfil('usuario', '5001')); // Aut. 2 vigente
    await setDoc(doc(db, 'usuarios', 'otro'), perfil('usuario', '5002'));
    await setDoc(doc(db, 'usuarios', 'aut2sinvigencia'), perfil('usuario', '5003'));
    await setDoc(doc(db, 'usuarios', 'solicitante'), perfil('usuario', '5004'));
    const asig = (nomina, desde, hasta, activo = true) => ({
      nomina, nombre: 'x', rol: 'aut2', areaId: null, desde, hasta, motivo: '', activo, asignadoPor: { uid: 'admin', nombre: 'Admin' }, fechaAsignacion: new Date(),
    });
    await setDoc(doc(db, 'asignaciones', '5001_aut2_planta'), asig('5001', hace(10), null));
    await setDoc(doc(db, 'asignaciones', '5003_aut2_planta'), asig('5003', hace(10), hace(2))); // vencida
  });
}

/** Restablecer contraseña como lo hace la app: perfil nuevo + borrar el viejo + bitácora + accesos (versión siguiente) */
async function restablecer(uid, uidViejo, { acceso = {}, omitirAcceso = false, uidNuevo = `nuevo-${uidViejo}`, rolNuevo } = {}) {
  const db = dbDe(uid);
  let viejo; let prev;
  await env.withSecurityRulesDisabled(async (ctx) => {
    viejo = (await getDoc(doc(ctx.firestore(), 'usuarios', uidViejo))).data();
    prev = (await getDoc(doc(ctx.firestore(), 'accesos', viejo.nomina))).data();
  });
  const lote = writeBatch(db);
  lote.set(doc(db, 'usuarios', uidNuevo), perfil(rolNuevo ?? viejo.rol, viejo.nomina, { debeCambiarPassword: true }));
  lote.delete(doc(db, 'usuarios', uidViejo));
  lote.set(doc(db, 'bitacora', `restablecer-${uidViejo}`), {
    accion: 'restablecer_acceso', entidad: `usuarios/${uidNuevo}`, antes: { uid: uidViejo }, despues: { uid: uidNuevo, nomina: viejo.nomina, nombre: viejo.nombre },
    porUid: uid, porNombre: `Persona ${NOMINA[uid]}`, fecha: serverTimestamp(),
  });
  if (!omitirAcceso) lote.set(doc(db, 'accesos', viejo.nomina), { version: (prev?.version ?? 1) + 1, uid: uidNuevo, ...acceso });
  return lote.commit();
}

beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-solicitud-rutas', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }); });
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await sembrar(); });

describe('accesos: lectura', () => {
  it('el login lee un documento SIN sesión (get), pero nunca la lista', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'accesos', '5002'), { version: 2, uid: 'otro' }); });
    await assertSucceeds(getDoc(doc(sinSesion(), 'accesos', '5002')));
    await assertSucceeds(getDoc(doc(sinSesion(), 'accesos', '9999'))); // no existe = versión 1
    await assertFails(getDocs(collection(sinSesion(), 'accesos')));
    await assertFails(getDocs(query(collection(sinSesion(), 'accesos'), limit(1))));
    await assertFails(getDocs(collection(dbDe('rh'), 'accesos')));
    await assertFails(getDocs(collection(dbDe('admin'), 'accesos')));
  });
});

describe('restablecer contraseña con la app', () => {
  it('RH, Aut. 2 vigente y admin restablecen a un usuario y dejan accesos en versión 2 (el doc no existía = versión 1)', async () => {
    await assertSucceeds(restablecer('rh', 'otro'));
    await env.withSecurityRulesDisabled(async (ctx) => {
      const a = (await getDoc(doc(ctx.firestore(), 'accesos', '5002'))).data();
      if (a.version !== 2 || a.uid !== 'nuevo-otro') throw new Error(JSON.stringify(a));
    });
    await assertSucceeds(restablecer('marco', 'solicitante'));
    await assertSucceeds(restablecer('admin', 'aut2sinvigencia'));
  });
  it('la segunda vez sube a versión 3, nunca salta', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'accesos', '5002'), { version: 2, uid: 'otro' }); });
    await assertFails(restablecer('rh', 'otro', { acceso: { version: 5 } }));
    await assertFails(restablecer('rh', 'otro', { acceso: { version: 2 } }));
    await assertSucceeds(restablecer('rh', 'otro', { acceso: { version: 3 } }));
  });
  it('no pasan: Aut. 2 vencida, usuario común, a sí mismo, a un RH (salvo admin), accesos sin el perfil nuevo o con otro uid', async () => {
    await assertFails(restablecer('aut2sinvigencia', 'otro'));
    await assertFails(restablecer('solicitante', 'otro'));
    await assertFails(restablecer('rh', 'rh'));
    await assertFails(restablecer('marco', 'marco'));
    await assertFails(restablecer('rh', 'rh2'));
    await assertSucceeds(restablecer('admin', 'rh2'));
    await assertFails(restablecer('rh', 'otro', { acceso: { uid: 'otro' } })); // el uid del perfil que ya existe
    await assertFails(restablecer('rh', 'otro', { acceso: { uid: 'otro-uid-que-no-se-crea' } }));
    await assertFails(restablecer('rh', 'otro', { acceso: { extra: 1 } }));
    await assertFails(restablecer('rh', 'otro', { acceso: { version: '2' } }));
  });
  it('un restablecimiento sin su documento de accesos lo permiten las reglas de usuarios (la app siempre lo manda)', async () => {
    await assertSucceeds(restablecer('rh', 'otro', { omitirAcceso: true }));
  });
  it('accesos no se escribe suelto: ni subir la versión de quien no se restablece, ni borrar, ni usuarios comunes', async () => {
    const dbRh = dbDe('rh');
    await assertFails(setDoc(doc(dbRh, 'accesos', '5002'), { version: 2, uid: 'otro' })); // el perfil ya existe, no es nuevo
    await assertFails(setDoc(doc(dbRh, 'accesos', '5002'), { version: 9, uid: 'x' }));
    await assertFails(setDoc(doc(dbDe('otro'), 'accesos', '5002'), { version: 2, uid: 'otro-nuevo' }));
    await assertFails(setDoc(doc(sinSesion(), 'accesos', '5002'), { version: 2, uid: 'otro-nuevo' }));
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'accesos', '5002'), { version: 2, uid: 'otro' }); });
    await assertFails(deleteDoc(doc(dbRh, 'accesos', '5002')));
  });
  it('la cuenta vieja queda sin perfil: no lee ni escribe nada', async () => {
    await assertSucceeds(restablecer('rh', 'otro'));
    const viejo = dbDe('otro');
    await assertFails(getDoc(doc(viejo, 'areas', 'x')));
    await assertFails(getDocs(collection(viejo, 'usuarios')));
    await assertFails(getDocs(collection(viejo, 'solicitudes')));
    await assertFails(getDocs(collection(viejo, 'tiempoExtra')));
    await assertFails(getDocs(collection(viejo, 'asignaciones')));
    await assertFails(setDoc(doc(viejo, 'usuarios', 'otro'), perfil('admin', '5002')));
    await assertFails(setDoc(doc(viejo, 'solicitudes', 's1'), { x: 1 }));
    await assertFails(setDoc(doc(viejo, 'accesos', '5002'), { version: 3, uid: 'otro-otra' }));
    await assertFails(setDoc(doc(viejo, 'bitacora', 'b'), { accion: 'x' }));
  });
});

describe('alta de usuarios deja su documento de accesos (versión 1)', () => {
  const alta = (uid, nomina, uidNuevo, version = 1) => {
    const db = dbDe(uid); const lote = writeBatch(db);
    lote.set(doc(db, 'usuarios', uidNuevo), perfil('usuario', nomina, { debeCambiarPassword: true }));
    lote.set(doc(db, 'accesos', nomina), { version, uid: uidNuevo });
    return lote.commit();
  };
  it('RH, Aut. 2 y admin crean usuario + accesos en el mismo lote', async () => {
    await assertSucceeds(alta('rh', '7001', 'u7001'));
    await assertSucceeds(alta('marco', '7002', 'u7002'));
    await assertSucceeds(alta('admin', '7003', 'u7003'));
  });
  it('no pasa: versión 3, usuario común, Aut. 2 vencida, accesos de otra nómina', async () => {
    await assertFails(alta('rh', '7001', 'u7001', 3));
    await assertFails(alta('solicitante', '7004', 'u7004'));
    await assertFails(alta('aut2sinvigencia', '7005', 'u7005'));
    const db = dbDe('rh'); const lote = writeBatch(db);
    lote.set(doc(db, 'usuarios', 'u7006'), perfil('usuario', '7006', { debeCambiarPassword: true }));
    lote.set(doc(db, 'accesos', '7999'), { version: 1, uid: 'u7006' });
    await assertFails(lote.commit());
  });
  it('Aut. 2 crea usuarios solo con rol usuario', async () => {
    const db = dbDe('marco');
    await assertFails(setDoc(doc(db, 'usuarios', 'z'), perfil('rh', '7100', { debeCambiarPassword: true })));
    await assertSucceeds(setDoc(doc(db, 'usuarios', 'z'), perfil('usuario', '7100', { debeCambiarPassword: true })));
  });
});

describe('quién da y quita el rol rh', () => {
  const cambiar = (quien, uid, datos) => updateDoc(doc(dbDe(quien), 'usuarios', uid), datos);
  it('RH, Aut. 2 vigente y admin dan el rol rh a un usuario', async () => {
    await assertSucceeds(cambiar('rh', 'otro', { rol: 'rh' }));
    await assertSucceeds(cambiar('marco', 'solicitante', { rol: 'rh' }));
    await assertSucceeds(cambiar('admin', 'aut2sinvigencia', { rol: 'rh' }));
  });
  it('RH, Aut. 2 vigente y admin quitan el rol rh', async () => {
    await assertSucceeds(cambiar('rh', 'rh2', { rol: 'usuario' }));
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'usuarios', 'rh2'), perfil('rh', '3')); });
    await assertSucceeds(cambiar('marco', 'rh2', { rol: 'usuario' }));
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'usuarios', 'rh2'), perfil('rh', '3')); });
    await assertSucceeds(cambiar('admin', 'rh2', { rol: 'usuario' }));
  });
  it('nadie cambia su propio rol (ni quitárselo ni dárselo)', async () => {
    await assertFails(cambiar('rh', 'rh', { rol: 'usuario' }));
    await assertFails(cambiar('marco', 'marco', { rol: 'rh' }));
    await assertFails(cambiar('rh', 'rh', { nombre: 'Yo mismo' }));
  });
  it('admin solo lo da y lo quita un admin', async () => {
    await assertFails(cambiar('rh', 'otro', { rol: 'admin' }));
    await assertFails(cambiar('marco', 'otro', { rol: 'admin' }));
    await assertFails(cambiar('rh', 'admin', { rol: 'usuario' }));
    await assertFails(cambiar('marco', 'admin', { rol: 'rh' }));
    await assertSucceeds(cambiar('admin', 'otro', { rol: 'admin' }));
  });
  it('quien no es gestor (usuario común, Aut. 2 vencida) no cambia roles', async () => {
    await assertFails(cambiar('otro', 'solicitante', { rol: 'rh' }));
    await assertFails(cambiar('solicitante', 'otro', { rol: 'rh' }));
    await assertFails(cambiar('aut2sinvigencia', 'otro', { rol: 'rh' }));
  });
  it('a quien ya es rh solo se le cambia el rol: nombre y activo no (salvo admin)', async () => {
    await assertFails(cambiar('rh', 'rh2', { nombre: 'Otro nombre' }));
    await assertFails(cambiar('marco', 'rh2', { activo: false }));
    await assertFails(cambiar('rh', 'rh2', { rol: 'usuario', activo: false }));
    await assertSucceeds(cambiar('admin', 'rh2', { activo: false }));
  });
  it('a un usuario se le puede cambiar nombre, rol y activo juntos, pero no nómina ni otros campos', async () => {
    await assertSucceeds(cambiar('rh', 'otro', { nombre: 'Nuevo nombre', rol: 'rh', activo: true }));
    await assertFails(cambiar('rh', 'solicitante', { nomina: '1234' }));
    await assertFails(cambiar('rh', 'solicitante', { rol: 'rh', debeCambiarPassword: true }));
    await assertFails(cambiar('rh', 'solicitante', { rol: 'superintendente' }));
  });
});

describe('bitácora de quién restableció y quién dio el rol', () => {
  const asiento = (uid, accion, entidad) => setDoc(doc(dbDe(uid), 'bitacora', `${accion}-${uid}`), {
    accion, entidad, antes: null, despues: { rol: 'rh' }, porUid: uid, porNombre: `Persona ${NOMINA[uid]}`, fecha: serverTimestamp(),
  });
  it('RH y la Aut. 2 vigente registran cambios de usuarios; un usuario común no', async () => {
    await assertSucceeds(asiento('rh', 'dar_rol_rh', 'usuarios/otro'));
    await assertSucceeds(asiento('marco', 'dar_rol_rh', 'usuarios/otro'));
    await assertFails(asiento('solicitante', 'dar_rol_rh', 'usuarios/otro'));
    await assertFails(asiento('marco', 'otra_cosa', 'areas/x'));
  });
});
