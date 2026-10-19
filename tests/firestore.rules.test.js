// Pruebas de firestore.rules contra el emulador de Firestore.
// Ejecutar con: npm run test:rules  (requiere Java 11+; levanta el emulador por sí solo)
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc, updateDoc } from 'firebase/firestore';

let env;

// UIDs de prueba: cada uno tiene su perfil en /usuarios (ver semilla)
const U = {
  admin: 'admin1',
  rh: 'rh1',
  sup: 'sup1',
  sup2: 'sup2',
  inactivo: 'inactivo1',
  rhInactivo: 'rhInactivo1',
  primerAcceso: 'primer1',
};

const perfil = (rol, extra = {}) => ({ nombre: rol, email: `${rol}@test.com`, rol, nomina: `n-${rol}`, activo: true, ...extra });
// Rol del sistema: 'usuario'. Quien solicita rutas lo hace por una asignación vigente de solicitante en un área (nomina_rol_area)
const NOMINA = { sup1: '5001', sup2: '5002', inactivo1: '5003', primer1: '5004' };
const asignacion = (nomina, areaId) => ({
  nomina, nombre: nomina, rol: 'solicitante', areaId, desde: new Date(Date.now() - 86400000), hasta: null, motivo: '',
  activo: true, asignadoPor: { uid: 'admin1', nombre: 'Admin' }, fechaAsignacion: new Date(),
});

const solicitudBase = (creadoPor, extra = {}) => ({
  creadoPor,
  solicitanteNombre: 'Solicitante',
  fechaServicio: '2026-11-01',
  estatus: 'pendiente',
  totalPasajeros: 2,
  totalAlimentos: 2,
  conteoTurnos: {},
  conteoPuestos: {},
  historial: [],
  areaId: 'a1',
  ...extra,
});

async function sembrar() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios', U.admin), perfil('admin'));
    await setDoc(doc(db, 'usuarios', U.rh), perfil('rh'));
    await setDoc(doc(db, 'usuarios', U.sup), perfil('usuario', { nomina: NOMINA.sup1 }));
    await setDoc(doc(db, 'usuarios', U.sup2), perfil('usuario', { nomina: NOMINA.sup2 }));
    await setDoc(doc(db, 'usuarios', U.inactivo), perfil('usuario', { nomina: NOMINA.inactivo1, activo: false }));
    for (const n of [NOMINA.sup1, NOMINA.sup2, NOMINA.inactivo1]) await setDoc(doc(db, 'asignaciones', `${n}_solicitante_a1`), asignacion(n, 'a1'));
    await setDoc(doc(db, 'usuarios', U.rhInactivo), perfil('rh', { activo: false }));
    await setDoc(doc(db, 'usuarios', U.primerAcceso), perfil('usuario', { nomina: NOMINA.primer1, debeCambiarPassword: true }));

    await setDoc(doc(db, 'areas', 'a1'), { nombre: 'Área 1' });
    await setDoc(doc(db, 'rutas', 'r1'), { nombre: 'Ruta 1' });
    await setDoc(doc(db, 'comunidades', 'c1'), { nombre: 'Comunidad 1' });
    await setDoc(doc(db, 'puntosReunion', 'p1'), { nombre: 'Punto 1' });
    await setDoc(doc(db, 'empleados', 'e1'), { nombre: 'Empleado 1', rutaId: 'r1', areaId: 'a1' });

    await setDoc(doc(db, 'solicitudes', 'sol-sup'), solicitudBase(U.sup));
    await setDoc(doc(db, 'solicitudes', 'sol-sup-aprobada'), solicitudBase(U.sup, { estatus: 'aprobada' }));
    await setDoc(doc(db, 'solicitudes', 'sol-sup2'), solicitudBase(U.sup2));
  });
}

const dbDe = (uid) => env.authenticatedContext(uid).firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-solicitud-rutas',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await sembrar();
});

describe('solicitante: usuarios', () => {
  it('puede leer su propio perfil pero no el de otros', async () => {
    const db = dbDe(U.sup);
    await assertSucceeds(getDoc(doc(db, 'usuarios', U.sup)));
    await assertFails(getDoc(doc(db, 'usuarios', U.sup2)));
  });

  it('no puede cambiarse el rol (ni a admin ni a rh)', async () => {
    const db = dbDe(U.sup);
    await assertFails(updateDoc(doc(db, 'usuarios', U.sup), { rol: 'admin' }));
    await assertFails(updateDoc(doc(db, 'usuarios', U.sup), { rol: 'rh' }));
  });

  it('no puede reactivarse ni editar otros campos de su perfil', async () => {
    const db = dbDe(U.sup);
    await assertFails(updateDoc(doc(db, 'usuarios', U.sup), { nombre: 'Otro nombre' }));
    await assertFails(updateDoc(doc(db, 'usuarios', U.sup), { activo: false }));
  });

  it('no puede crear ni borrar usuarios', async () => {
    const db = dbDe(U.sup);
    await assertFails(setDoc(doc(db, 'usuarios', 'nuevo'), perfil('usuario')));
    await assertFails(deleteDoc(doc(db, 'usuarios', U.sup2)));
  });
});

describe('solicitante: catálogos y empleados', () => {
  const catalogos = [['areas', 'a1'], ['rutas', 'r1'], ['comunidades', 'c1'], ['puntosReunion', 'p1']];

  for (const [col, id] of catalogos) {
    it(`puede leer ${col} pero no crear, editar ni borrar`, async () => {
      const db = dbDe(U.sup);
      await assertSucceeds(getDoc(doc(db, col, id)));
      await assertFails(setDoc(doc(db, col, 'nuevo'), { nombre: 'X' }));
      await assertFails(updateDoc(doc(db, col, id), { nombre: 'Cambiado' }));
      await assertFails(deleteDoc(doc(db, col, id)));
    });
  }

  it('no puede leer la colección heredada PuntosReunion', async () => {
    await assertFails(getDoc(doc(dbDe(U.sup), 'PuntosReunion', 'x')));
  });

  it('empleados: solo puede cambiar rutaId/comunidadId/puntoReunionId de su área', async () => {
    const db = dbDe(U.sup);
    await assertSucceeds(getDoc(doc(db, 'empleados', 'e1')));
    await assertSucceeds(updateDoc(doc(db, 'empleados', 'e1'), { rutaId: 'r2', comunidadId: 'c1', puntoReunionId: 'p1' }));
    await assertFails(updateDoc(doc(db, 'empleados', 'e1'), { nombre: 'Otro' }));
    await assertFails(setDoc(doc(db, 'empleados', 'e2'), { nombre: 'Nuevo' }));
    await assertFails(deleteDoc(doc(db, 'empleados', 'e1')));
  });
});

describe('solicitante: solicitudes', () => {
  it('NO puede crear transporte suelto: lo crean solo RH y admin (el solicitante lo pide dentro del tiempo extra)', async () => {
    await assertFails(setDoc(doc(dbDe(U.sup), 'solicitudes', 'nueva'), solicitudBase(U.sup)));
    await assertSucceeds(setDoc(doc(dbDe(U.rh), 'solicitudes', 'de-rh'), solicitudBase(U.rh)));
    await assertSucceeds(setDoc(doc(dbDe(U.admin), 'solicitudes', 'de-admin'), solicitudBase(U.admin)));
  });


  it('RH no puede crear solicitudes aprobadas, canceladas ni rechazadas', async () => {
    const db = dbDe(U.rh);
    for (const estatus of ['aprobada', 'cancelada', 'rechazada']) {
      await assertFails(setDoc(doc(db, 'solicitudes', `x-${estatus}`), solicitudBase(U.rh, { estatus })));
    }
  });
  it('no puede crear solicitudes a nombre de otro', async () => {
    await assertFails(setDoc(doc(dbDe(U.rh), 'solicitudes', 'ajena'), solicitudBase(U.sup2)));
  });
  it('lee las suyas pero no las ajenas', async () => {
    const db = dbDe(U.sup);
    await assertSucceeds(getDoc(doc(db, 'solicitudes', 'sol-sup')));
    await assertFails(getDoc(doc(db, 'solicitudes', 'sol-sup2')));
  });

  it('no puede listar toda la colección, solo con filtro por creadoPor', async () => {
    const db = dbDe(U.sup);
    await assertFails(getDocs(collection(db, 'solicitudes')));
  });

  it('no puede editar solicitudes ajenas ni cancelarlas', async () => {
    const db = dbDe(U.sup);
    await assertFails(updateDoc(doc(db, 'solicitudes', 'sol-sup2'), { estatus: 'cancelada' }));
    await assertFails(updateDoc(doc(db, 'solicitudes', 'sol-sup2'), { vistoPorSolicitante: true }));
  });

  it('puede editar campos de la lista blanca de la suya', async () => {
    const db = dbDe(U.sup);
    await assertSucceeds(updateDoc(doc(db, 'solicitudes', 'sol-sup'), { fechaServicio: '2026-11-05', totalPasajeros: 3, modificada: true }));
  });

  it('puede cancelar la suya', async () => {
    await assertSucceeds(updateDoc(doc(dbDe(U.sup), 'solicitudes', 'sol-sup'), { estatus: 'cancelada' }));
  });

  it('editar una aprobada la regresa a pendiente', async () => {
    await assertSucceeds(updateDoc(doc(dbDe(U.sup), 'solicitudes', 'sol-sup-aprobada'), { estatus: 'pendiente', modificada: true }));
  });

  it('no puede autoaprobar ni rechazar', async () => {
    const db = dbDe(U.sup);
    await assertFails(updateDoc(doc(db, 'solicitudes', 'sol-sup'), { estatus: 'aprobada' }));
    await assertFails(updateDoc(doc(db, 'solicitudes', 'sol-sup'), { estatus: 'rechazada' }));
  });

  it('no puede editar campos fuera de la lista blanca', async () => {
    const db = dbDe(U.sup);
    const ref = doc(db, 'solicitudes', 'sol-sup');
    await assertFails(updateDoc(ref, { creadoPor: U.sup2 }));
    await assertFails(updateDoc(ref, { fechaSolicitud: '2020-01-01' }));
    await assertFails(updateDoc(ref, { revisadoPor: U.sup }));
    await assertFails(updateDoc(ref, { comentarioRH: 'ok' }));
    // mezclar un campo permitido con uno prohibido tampoco pasa
    await assertFails(updateDoc(ref, { fechaServicio: '2026-12-01', creadoPor: U.sup2 }));
  });

  it('no puede cambiar el estatus de una solicitud ya cancelada', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'solicitudes', 'sol-cancelada'), solicitudBase(U.sup, { estatus: 'cancelada' }));
    });
    await assertFails(updateDoc(doc(dbDe(U.sup), 'solicitudes', 'sol-cancelada'), { estatus: 'pendiente' }));
  });

  it('puede marcar vista (vistoPorSolicitante + historial) en cualquier estatus', async () => {
    await assertSucceeds(updateDoc(doc(dbDe(U.sup), 'solicitudes', 'sol-sup-aprobada'), { vistoPorSolicitante: true, historial: [{ accion: 'vista' }] }));
  });

  it('no puede borrar solicitudes', async () => {
    await assertFails(deleteDoc(doc(dbDe(U.sup), 'solicitudes', 'sol-sup')));
  });

  it('pasajeros: puede escribir en su solicitud pendiente, no en una aprobada ni ajena', async () => {
    const db = dbDe(U.sup);
    await assertSucceeds(setDoc(doc(db, 'solicitudes', 'sol-sup', 'pasajeros', 'p1'), { nombre: 'Pasajero' }));
    await assertFails(setDoc(doc(db, 'solicitudes', 'sol-sup-aprobada', 'pasajeros', 'p1'), { nombre: 'Pasajero' }));
    await assertFails(setDoc(doc(db, 'solicitudes', 'sol-sup2', 'pasajeros', 'p1'), { nombre: 'Pasajero' }));
    await assertFails(getDoc(doc(db, 'solicitudes', 'sol-sup2', 'pasajeros', 'p1')));
  });
});

describe('RH', () => {
  it('puede leer todas las solicitudes y aprobarlas', async () => {
    const db = dbDe(U.rh);
    await assertSucceeds(getDoc(doc(db, 'solicitudes', 'sol-sup2')));
    await assertSucceeds(updateDoc(doc(db, 'solicitudes', 'sol-sup'), { estatus: 'aprobada', revisadoPor: U.rh }));
    await assertSucceeds(updateDoc(doc(db, 'solicitudes', 'sol-sup2'), { estatus: 'rechazada', revisadoPor: U.rh }));
  });

  it('puede editar catálogos', async () => {
    const db = dbDe(U.rh);
    await assertSucceeds(updateDoc(doc(db, 'rutas', 'r1'), { nombre: 'Ruta editada' }));
    await assertSucceeds(setDoc(doc(db, 'areas', 'a2'), { nombre: 'Área 2' }));
  });

  it('no puede borrar solicitudes (solo admin)', async () => {
    await assertFails(deleteDoc(doc(dbDe(U.rh), 'solicitudes', 'sol-sup')));
  });

  it('puede crear y editar usuarios normales', async () => {
    const db = dbDe(U.rh);
    await assertSucceeds(setDoc(doc(db, 'usuarios', 'nuevo'), perfil('usuario')));
    await assertSucceeds(updateDoc(doc(db, 'usuarios', U.sup), { nombre: 'Nuevo nombre', activo: false }));
    await assertSucceeds(updateDoc(doc(db, 'usuarios', U.sup), { rol: 'usuario' }));
  });

  it('no puede dar rh ni admin (crear ni promover): solo el admin', async () => {
    const db = dbDe(U.rh);
    await assertFails(setDoc(doc(db, 'usuarios', 'nuevoRH'), perfil('rh')));
    await assertFails(setDoc(doc(db, 'usuarios', 'nuevoAdmin'), perfil('admin')));
    await assertFails(updateDoc(doc(db, 'usuarios', U.sup), { rol: 'rh' }));
    await assertFails(updateDoc(doc(db, 'usuarios', U.sup), { rol: 'admin' }));
  });

  it('no puede quitar el rol rh a otro RH ni tocar a un admin', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'usuarios', 'rh2'), perfil('rh'));
    });
    await assertFails(updateDoc(doc(dbDe(U.rh), 'usuarios', 'rh2'), { rol: 'usuario' }));
    await assertFails(updateDoc(doc(dbDe(U.rh), 'usuarios', 'rh2'), { activo: false }));
  });

  it('el admin sí da y quita rh', async () => {
    const db = dbDe(U.admin);
    await assertSucceeds(updateDoc(doc(db, 'usuarios', U.sup), { rol: 'rh' }));
    await assertSucceeds(updateDoc(doc(db, 'usuarios', U.sup), { rol: 'usuario' }));
  });

  it('no puede hacerse admin a sí mismo', async () => {
    await assertFails(updateDoc(doc(dbDe(U.rh), 'usuarios', U.rh), { rol: 'admin' }));
  });

  it('no puede editar ni borrar a un admin', async () => {
    const db = dbDe(U.rh);
    await assertFails(updateDoc(doc(db, 'usuarios', U.admin), { activo: false }));
    await assertFails(updateDoc(doc(db, 'usuarios', U.admin), { rol: 'usuario' }));
    await assertFails(deleteDoc(doc(db, 'usuarios', U.admin)));
  });

  it('no puede borrar usuarios', async () => {
    await assertFails(deleteDoc(doc(dbDe(U.rh), 'usuarios', U.sup)));
  });
});

describe('admin', () => {
  it('puede crear admins, promover y borrar usuarios y solicitudes', async () => {
    const db = dbDe(U.admin);
    await assertSucceeds(setDoc(doc(db, 'usuarios', 'otroAdmin'), perfil('admin')));
    await assertSucceeds(updateDoc(doc(db, 'usuarios', U.sup), { rol: 'admin' }));
    await assertSucceeds(deleteDoc(doc(db, 'usuarios', U.sup2)));
    await assertSucceeds(deleteDoc(doc(db, 'solicitudes', 'sol-sup')));
  });
});

describe('usuario inactivo', () => {
  it('no puede leer catálogos, empleados ni solicitudes (ni las propias)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'solicitudes', 'sol-inactivo'), solicitudBase(U.inactivo));
    });
    const db = dbDe(U.inactivo);
    for (const [col, id] of [['areas', 'a1'], ['rutas', 'r1'], ['comunidades', 'c1'], ['puntosReunion', 'p1'], ['empleados', 'e1'], ['solicitudes', 'sol-inactivo'], ['solicitudes', 'sol-sup']]) {
      await assertFails(getDoc(doc(db, col, id)));
    }
  });

  it('no puede leer perfiles ajenos', async () => {
    await assertFails(getDoc(doc(dbDe(U.inactivo), 'usuarios', U.sup)));
  });

  it('no puede crear solicitudes ni editar nada', async () => {
    const db = dbDe(U.inactivo);
    await assertFails(setDoc(doc(db, 'solicitudes', 'nueva'), solicitudBase(U.inactivo)));
    await assertFails(updateDoc(doc(db, 'empleados', 'e1'), { rutaId: 'r2' }));
  });

  it('un RH inactivo pierde todos sus privilegios', async () => {
    const db = dbDe(U.rhInactivo);
    await assertFails(getDoc(doc(db, 'solicitudes', 'sol-sup')));
    await assertFails(getDoc(doc(db, 'usuarios', U.sup)));
    await assertFails(updateDoc(doc(db, 'solicitudes', 'sol-sup'), { estatus: 'aprobada' }));
    await assertFails(setDoc(doc(db, 'areas', 'a2'), { nombre: 'X' }));
  });

  it('un usuario inactivo no puede reactivarse', async () => {
    await assertFails(updateDoc(doc(dbDe(U.inactivo), 'usuarios', U.inactivo), { activo: true }));
  });

  it('un usuario sin perfil en /usuarios no puede leer nada', async () => {
    const db = dbDe('fantasma');
    await assertFails(getDoc(doc(db, 'areas', 'a1')));
    await assertFails(getDoc(doc(db, 'solicitudes', 'sol-sup')));
  });

  it('un usuario sin autenticar no puede leer nada', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'areas', 'a1')));
    await assertFails(getDoc(doc(db, 'usuarios', U.sup)));
  });
});

describe('debeCambiarPassword', () => {
  it('el propio usuario puede bajarlo de true a false', async () => {
    await assertSucceeds(updateDoc(doc(dbDe(U.primerAcceso), 'usuarios', U.primerAcceso), { debeCambiarPassword: false }));
  });

  it('no puede volver a subirlo de false a true', async () => {
    const ref = doc(dbDe(U.primerAcceso), 'usuarios', U.primerAcceso);
    await updateDoc(ref, { debeCambiarPassword: false });
    await assertFails(updateDoc(ref, { debeCambiarPassword: true }));
  });

  it('no sirve si ya estaba en false o no existía el campo', async () => {
    await assertFails(updateDoc(doc(dbDe(U.sup), 'usuarios', U.sup), { debeCambiarPassword: false }));
    await assertFails(updateDoc(doc(dbDe(U.sup), 'usuarios', U.sup), { debeCambiarPassword: true }));
  });

  it('no permite colar otros campos junto con el cambio', async () => {
    const ref = doc(dbDe(U.primerAcceso), 'usuarios', U.primerAcceso);
    await assertFails(updateDoc(ref, { debeCambiarPassword: false, rol: 'admin' }));
    await assertFails(updateDoc(ref, { debeCambiarPassword: false, activo: true, nombre: 'X' }));
  });

  it('otro usuario no puede cambiarlo', async () => {
    await assertFails(updateDoc(doc(dbDe(U.sup2), 'usuarios', U.primerAcceso), { debeCambiarPassword: false }));
  });

  it('un usuario inactivo no puede cambiarlo', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'usuarios', U.inactivo), { debeCambiarPassword: true });
    });
    await assertFails(updateDoc(doc(dbDe(U.inactivo), 'usuarios', U.inactivo), { debeCambiarPassword: false }));
  });
});
