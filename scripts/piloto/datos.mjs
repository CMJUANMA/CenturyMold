// Datos FICTICIOS de la prueba de punta a punta: el estado de «antes de arrancar» (usuarios y catálogos de prueba mezclados con la
// configuración real: padrón, áreas, puestos, turnos, motivos y asignaciones). Todo se carga en el EMULADOR.
import { MOTIVOS_INICIALES } from '../../src/utils/motivosTE.js';
import { crearCuenta, guardar, vaciarEmuladores } from './infra.mjs';

export const PASSWORD_PRUEBA = 'Prueba12345'; // la de los usuarios de prueba sembrados (los que la limpieza borra)
export const PASSWORD_ADMIN = 'Admin12345';
export const PASSWORD_NUEVA = 'ClaveNueva2026';

export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const enDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };

export const ADMIN = { nomina: '7000', nombre: 'ADMIN PILOTO' };
/** Quién es quién (nómina, nombre, rol del sistema que debe quedar al crear la cuenta) */
export const PERSONAS = {
  aut1: { nomina: '6010', nombre: 'HERRERA LUNA HÉCTOR', rol: 'usuario', puesto: 'jefe-de-almacen', area: 'almacen' },
  solicitante: { nomina: '6020', nombre: 'IBARRA CRUZ IRENE', rol: 'usuario', puesto: 'almacenista', area: 'almacen' },
  aut2: { nomina: '6030', nombre: 'JUÁREZ KURI JAVIER', rol: 'usuario', puesto: 'gerente', area: 'administrativo' },
  rh: { nomina: '6040', nombre: 'LÓPEZ MENA LAURA', rol: 'rh', puesto: 'analista-rh', area: 'administrativo' },
  nomina: { nomina: '6050', nombre: 'MÁRQUEZ NAVA MARIO', rol: 'nomina', puesto: 'analista-nomina', area: 'administrativo' },
};
/** Empleados elegibles de Almacén (los que se capturan en tiempo extra). La ruta de cada uno la trae la importación. */
export const ALMACEN = [
  { nomina: '6001', nombre: 'AGUILAR RÍOS ANA', telefono: '4421110001' },
  { nomina: '6002', nombre: 'BRAVO LEAL CARLOS', telefono: '4421110002' },
  { nomina: '6003', nombre: 'CASTRO MORA DIANA', telefono: '4421110003' },
  { nomina: '6004', nombre: 'DOMÍNGUEZ SOTO ERIC', telefono: '4421110004' },
  { nomina: '6005', nombre: 'ESTRADA PAZ FABIOLA', telefono: '4421110005' },
  { nomina: '6006', nombre: 'FUENTES VEGA GABRIEL', telefono: '4421110006' },
];
export const PUESTOS = [
  ['almacenista', 'ALMACENISTA', 'almacen', null], ['jefe-de-almacen', 'JEFE DE ALMACÉN', 'almacen', 3], ['gerente', 'GERENTE DE OPERACIONES', 'administrativo', 1],
  ['analista-rh', 'ANALISTA DE RH', 'administrativo', 4], ['analista-nomina', 'ANALISTA DE NÓMINA', 'administrativo', 4], ['sistemas', 'SISTEMAS', 'administrativo', 4],
];
/** Directorio de rutas de ejemplo (el que se carga con «Importar directorio») */
export const DIRECTORIO = [
  ['RUTA NORTE', 'COLONIA SAN PEDRO', 'PARQUE CENTRAL', 'SN01'], ['RUTA NORTE', 'COLONIA SAN PEDRO', 'FARMACIA DEL AHORRO', 'SN02'],
  ['RUTA SUR', 'COLONIA VISTA HERMOSA', 'PLAZA COMERCIAL', 'SU01'], ['RUTA ORIENTE', 'LOMAS DEL SOL', 'CAPILLA', 'OR01'],
];
/** Ruta de cada empleado de Almacén que se carga por importación: [nómina, CLAVE PARADA, RUTA, COMUNIDAD, PUNTO]. 6006 queda SIN ruta a propósito. */
export const RUTAS_POR_IMPORTACION = {
  6001: ['SN01', '', '', ''],
  6002: ['', 'RUTA NORTE', 'COLONIA SAN PEDRO', 'FARMACIA DEL AHORRO'],
  6003: ['SU01', '', '', ''],
  6004: ['', 'RUTA SUR', 'COLONIA VISTA HERMOSA', 'PLAZA COMERCIAL'],
  6005: ['OR01', '', '', ''],
  6006: ['', '', '', ''],
};
export const NOMBRE_RUTA = { SN01: 'RUTA NORTE', SN02: 'RUTA NORTE', SU01: 'RUTA SUR', OR01: 'RUTA ORIENTE' };

/**
 * Siembra el estado de «antes de arrancar». Devuelve lo que la limpieza debe borrar y lo que debe conservar, para comprobarlo después.
 */
export async function sembrarEstadoDePrueba() {
  await vaciarEmuladores();
  const hoy = new Date();
  const uids = {};
  const usuarios = [
    [ADMIN.nomina, ADMIN.nombre, 'admin', PASSWORD_ADMIN],
    ...Object.values(PERSONAS).map(p => [p.nomina, p.nombre, p.rol, PASSWORD_PRUEBA]),
    ['9901', 'USUARIO DE PRUEBA UNO', 'usuario', PASSWORD_PRUEBA],
  ];
  for (const [nomina, nombre, rol, password] of usuarios) {
    // Un usuario al que ya le restablecieron la contraseña dos veces: cuentas 9901, 9901.v2 y 9901.v3 (la vigente es la v3)
    if (nomina === '9901') { await crearCuenta('9901@rutas.app', password); await crearCuenta('9901.v2@rutas.app', password); uids[nomina] = await crearCuenta('9901.v3@rutas.app', password); }
    else uids[nomina] = await crearCuenta(`${nomina}@rutas.app`, password);
    await guardar(`usuarios/${uids[nomina]}`, { nomina, nombre, rol, activo: true, debeCambiarPassword: false });
  }
  await guardar('accesos/9901', { version: 3, uid: uids['9901'] });
  // Un administrador que ya restableció su contraseña una vez: su cuenta vigente es la v2 (la v1 es una versión vieja)
  await crearCuenta('7001@rutas.app', PASSWORD_ADMIN);
  const uidAdmin2 = await crearCuenta('7001.v2@rutas.app', PASSWORD_ADMIN);
  await guardar(`usuarios/${uidAdmin2}`, { nomina: '7001', nombre: 'OTRO ADMIN', rol: 'admin', activo: true, debeCambiarPassword: false });
  await guardar('accesos/7001', { version: 2, uid: uidAdmin2 });

  // Configuración real (se conserva)
  await guardar('areas/almacen', { nombre: 'Almacén', orden: 1, participaTE: true, activa: true });
  await guardar('areas/administrativo', { nombre: 'Administrativo', orden: 9, participaTE: false, activa: true });
  for (const [id, nombre, areaId, nivel] of PUESTOS) await guardar(`puestos/${id}`, { nombre, areaId, activo: true, alias: [], creadoPor: 'semilla', fechaCreacion: hoy, ...(nivel ? { nivelJerarquico: nivel } : {}) });
  for (const { id, ...campos } of MOTIVOS_INICIALES) await guardar(`motivosTE/${id}`, campos);
  for (const t of ['A', 'B', 'C']) await guardar(`turnosNomina/${t}`, { entrada: t === 'A' ? '7:00' : t === 'B' ? '16:00' : '0:00', salida: t === 'A' ? '16:00' : t === 'B' ? '0:00' : '7:00' });
  const puestoNombre = Object.fromEntries(PUESTOS.map(p => [p[0], p[1]]));
  const personal = [...Object.values(PERSONAS), ...ALMACEN.map(a => ({ ...a, puesto: 'almacenista', area: 'almacen' })), { nomina: ADMIN.nomina, nombre: ADMIN.nombre, puesto: 'sistemas', area: 'administrativo' }];
  for (const p of personal) {
    const esAlmacenista = ALMACEN.some(a => a.nomina === p.nomina);
    await guardar(`empleados/${p.nomina}`, {
      nomina: p.nomina, nombre: p.nombre, areaId: p.area, puestoId: p.puesto, puesto: puestoNombre[p.puesto], activo: true, elegibleTE: esAlmacenista,
      // Las rutas de PRUEBA que la limpieza de catálogos debe vaciar (los almacenistas 6001 a 6003 las traen)
      ...(['6001', '6002', '6003'].includes(p.nomina) ? { rutaId: 'ruta-prueba', comunidadId: 'comunidad-prueba', puntoReunionId: 'PRU01' } : { rutaId: '', comunidadId: '', puntoReunionId: '' }),
    });
  }
  // Teléfonos sembrados de 6001 a 6003 (los de 6004 a 6006 se cargan por importación)
  for (const a of ALMACEN.slice(0, 3)) await guardar(`empleadosContacto/${a.nomina}`, { telefono: a.telefono });
  // Catálogos de transporte de PRUEBA (se borran con la casilla)
  await guardar('rutas/ruta-prueba', { nombre: 'RUTA DE PRUEBA', activo: true });
  await guardar('comunidades/comunidad-prueba', { nombre: 'COMUNIDAD DE PRUEBA', rutaId: 'ruta-prueba', activo: true });
  await guardar('puntosReunion/PRU01', { clave: 'PRU01', nombre: 'PUNTO DE PRUEBA', comunidadId: 'comunidad-prueba', rutaId: 'ruta-prueba', activo: true });
  // Asignaciones: son la configuración real (por nómina) y deben sobrevivir a la limpieza de usuarios
  const asig = (p, rol, areaId) => guardar(`asignaciones/${p.nomina}_${rol}_${rol === 'aut2' ? 'planta' : areaId}`, {
    nomina: p.nomina, nombre: p.nombre, puesto: puestoNombre[p.puesto], rol, areaId: rol === 'aut2' ? null : areaId, desde: new Date(hoy.getTime() - 30 * 86400000), hasta: null, motivo: '', activo: true,
    asignadoPor: { uid: uids[ADMIN.nomina], nombre: ADMIN.nombre }, fechaAsignacion: new Date(hoy.getTime() - 30 * 86400000),
  });
  await asig(PERSONAS.aut1, 'aut1', 'almacen'); await asig(PERSONAS.solicitante, 'solicitante', 'almacen'); await asig(PERSONAS.aut2, 'aut2', 'planta');
  // Datos de prueba de tiempo extra, bitácora y folio (se borran)
  await guardar('tiempoExtra/TEPRUEBA1', {
    estatus: 'autorizada', folio: 'TE-2026-0001', areaId: 'almacen', areaNombre: 'Almacén', creadoPor: uids[PERSONAS.solicitante.nomina], creadoPorNomina: PERSONAS.solicitante.nomina,
    creadoPorNombre: PERSONAS.solicitante.nombre, fechaTE: enDias(2), motivo: 'prueba', resumen: {}, fechaCreacion: hoy, fechaActualizacion: hoy,
  });
  await guardar('tiempoExtra/TEPRUEBA1/empleados/6001', { nombre: 'AGUILAR RÍOS ANA', horas: 3 });
  await guardar('contadores/te-2026', { ultimo: 1, solicitudId: 'TEPRUEBA1' });
  await guardar('bitacora/b-prueba-1', { accion: 'prueba', entidad: 'sistema', antes: null, despues: null, porUid: uids[ADMIN.nomina], porNombre: ADMIN.nombre, fecha: hoy });
  return { uids };
}
