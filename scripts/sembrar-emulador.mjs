// Siembra los emuladores de Firebase (auth 9099 y firestore 8080) con datos FICTICIOS para tomar capturas de la app.
// Uso: npx firebase emulators:start --only auth,firestore --project demo-solicitud-rutas   y, en otra terminal: node scripts/sembrar-emulador.mjs
// Usuarios (contraseña "Prueba123"): 90001 admin · 90002 RH · 11 Aut. 2 · 50610 Aut. 1 de Moldes · 50532 solicitante de Moldes · 50999 sin rol
const PROYECTO = 'demo-solicitud-rutas';
const FS = `http://127.0.0.1:8080/v1/projects/${PROYECTO}/databases/(default)/documents`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake';
export const PASSWORD = 'Prueba123';

const valor = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valor) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, valor(x)])) } };
};
async function guardar(ruta, datos) {
  const r = await fetch(`${FS}/${ruta}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, valor(v)])) }),
  });
  if (!r.ok) throw new Error(`${ruta}: ${r.status} ${await r.text()}`);
}
async function cuenta(nomina) {
  const r = await fetch(AUTH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${nomina}@rutas.app`, password: PASSWORD, returnSecureToken: true }) });
  const j = await r.json();
  if (!j.localId) throw new Error('Auth ' + nomina + ': ' + JSON.stringify(j));
  return j.localId;
}

const ahora = new Date();
const dia = (n) => new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + n, 12);
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const personas = [
  ['90001', 'ESPINOSA MARCO', 'admin'], ['90002', 'LUNA PATRICIA', 'rh'], ['11', 'MALDONADO SALVADOR', 'usuario'],
  ['50610', 'MENDOZA ANSELMO', 'usuario'], ['50532', 'ACOSTA OSCAR', 'usuario'], ['50999', 'PEREZ JUAN', 'usuario'],
];
const uids = {};
for (const [nomina, nombre, rol] of personas) {
  uids[nomina] = await cuenta(nomina);
  await guardar(`usuarios/${uids[nomina]}`, { nomina, nombre, rol, activo: true, debeCambiarPassword: false, preferencias: { ayudas: true, tamanoLetra: 'normal', tema: 'auto', recorridosVistos: ['solicitar', 'autorizar'] } });
}

const areas = [['moldes', 'Moldes', 1], ['produccion', 'Producción', 2], ['calidad', 'Calidad', 3], ['mantenimiento', 'Mantenimiento', 4], ['administrativo', 'Administrativo', 9]];
for (const [id, nombre, orden] of areas) await guardar(`areas/${id}`, { nombre, orden, participaTE: id !== 'administrativo', activa: true });

const puestos = [
  ['operations-director', 'OPERATIONS DIRECTOR', 'administrativo', 1], ['administrative-manager', 'ADMINISTRATIVE MANAGER', 'administrativo', 2],
  ['jefe-de-moldes', 'JEFE DE MOLDES', 'moldes', 3], ['moldeador', 'MOLDEADOR', 'moldes', null], ['operador', 'OPERADOR', 'produccion', null],
  ['inspector', 'INSPECTOR DE CALIDAD', 'calidad', null], ['tecnico', 'TÉCNICO DE MANTENIMIENTO', 'mantenimiento', null],
];
for (const [id, nombre, areaId, nivel] of puestos) {
  await guardar(`puestos/${id}`, { nombre, areaId, activo: true, alias: [], creadoPor: 'semilla', fechaCreacion: ahora, ...(nivel ? { nivelJerarquico: nivel } : {}) });
}

await guardar('rutas/norte', { nombre: 'Ruta Norte', activo: true });
await guardar('rutas/sur', { nombre: 'Ruta Sur', activo: true });
await guardar('comunidades/pueblito', { nombre: 'El Pueblito', rutaId: 'norte', activo: true });
await guardar('comunidades/colon', { nombre: 'Colón', rutaId: 'sur', activo: true });
await guardar('puntosReunion/plaza', { clave: 'PLAZA', nombre: 'Plaza principal', comunidadId: 'pueblito', rutaId: 'norte', activo: true });
await guardar('puntosReunion/iglesia', { clave: 'IGLESIA', nombre: 'Templo', comunidadId: 'colon', rutaId: 'sur', activo: true });
for (const t of ['A', 'B', 'C']) await guardar(`turnosNomina/${t}`, { entrada: t === 'A' ? '7:00' : t === 'B' ? '16:00' : '0:00', salida: t === 'A' ? '16:00' : t === 'B' ? '0:00' : '7:00' });

const nombresEmp = ['GARCÍA LÓPEZ JOSÉ', 'HERNÁNDEZ RUIZ MARÍA', 'MARTÍNEZ SOTO LUIS', 'RAMÍREZ CRUZ ANA', 'TORRES VEGA PEDRO', 'FLORES MORA CARLOS', 'RIVERA DÍAZ ELENA', 'GÓMEZ PAZ JORGE', 'CASTILLO REYES ROSA', 'ORTIZ LUNA DIEGO', 'MORALES JUÁREZ SOFÍA', 'MEDINA ROJAS ARTURO'];
const emp = [];
nombresEmp.forEach((nombre, i) => {
  const areaId = ['moldes', 'produccion', 'calidad', 'mantenimiento'][i % 4];
  const puestoId = { moldes: 'moldeador', produccion: 'operador', calidad: 'inspector', mantenimiento: 'tecnico' }[areaId];
  emp.push([String(700 + i), nombre, areaId, puestoId, puestos.find(p => p[0] === puestoId)[1]]);
});
emp.push(['11', 'MALDONADO SALVADOR', 'administrativo', 'operations-director', 'OPERATIONS DIRECTOR'], ['50610', 'MENDOZA ANSELMO', 'moldes', 'jefe-de-moldes', 'JEFE DE MOLDES'],
  ['50532', 'ACOSTA OSCAR', 'moldes', 'moldeador', 'MOLDEADOR'], ['90001', 'ESPINOSA MARCO', 'administrativo', 'administrative-manager', 'ADMINISTRATIVE MANAGER']);
for (const [nomina, nombre, areaId, puestoId, puesto] of emp) {
  await guardar(`empleados/${nomina}`, { nomina, nombre, areaId, puestoId, puesto, turnoNomina: 'A', activo: true, rutaId: 'norte', comunidadId: 'pueblito', puntoReunionId: 'plaza' });
}

const asignacion = (nomina, rol, areaId, nombre, puesto, puestoId) => guardar(`asignaciones/${nomina}_${rol}_${rol === 'aut2' ? 'planta' : areaId}`, {
  nomina, nombre, puesto, puestoId, rol, areaId: rol === 'aut2' ? null : areaId, desde: dia(-30), hasta: null, motivo: '', activo: true,
  asignadoPor: { uid: uids['90001'], nombre: 'ESPINOSA MARCO' }, fechaAsignacion: dia(-30),
});
await asignacion('11', 'aut2', null, 'MALDONADO SALVADOR', 'OPERATIONS DIRECTOR', 'operations-director');
await asignacion('90001', 'aut2', null, 'ESPINOSA MARCO', 'ADMINISTRATIVE MANAGER', 'administrative-manager');
await asignacion('50610', 'aut1', 'moldes', 'MENDOZA ANSELMO', 'JEFE DE MOLDES', 'jefe-de-moldes');
await asignacion('50532', 'solicitante', 'moldes', 'ACOSTA OSCAR', 'MOLDEADOR', 'moldeador');
await asignacion('700', 'solicitante', 'moldes', 'GARCÍA LÓPEZ JOSÉ', 'MOLDEADOR', 'moldeador');

const area = Object.fromEntries(areas.map(a => [a[0], a[1]]));
const solicitudes = [
  ['pendiente_aut1', 'moldes', 0, 4, 32, 3], ['pendiente_aut2', 'produccion', 2, 6, 48, 5], ['pendiente_aut2', 'calidad', 3, 2, 16, 2],
  ['autorizada', 'moldes', 1, 8, 64, 6], ['autorizada', 'mantenimiento', -2, 3, 24, 0], ['autorizada', 'produccion', 4, 10, 80, 8],
  ['procesada', 'moldes', 3, 5, 40, 4], ['procesada', 'calidad', 6, 4, 32, 3], ['devuelta', 'produccion', 5, 3, 24, 2], ['borrador', 'moldes', 7, 2, 16, 1],
];
let n = 0;
for (const [estatus, areaId, offset, totalEmpleados, totalHoras, totalTransporte] of solicitudes) {
  n++;
  const id = estatus === 'borrador' ? `BR-SEMILLA${n}XYZ` : `semilla${n}`;
  const doc = {
    areaId, areaNombre: area[areaId], creadoPor: uids['50532'], creadoPorNomina: '50532', creadoPorNombre: 'ACOSTA OSCAR',
    fechaTE: ymd(dia(offset)), motivo: n % 3 === 0 ? 'Otro' : 'Producción', ...(n % 3 === 0 ? { motivoOtro: 'Entrega urgente de molde' } : {}),
    comentario: 'Pedido urgente del cliente', estatus, tipo: 'turno_extra', rutasDistintas: 1, desgloseRutas: [], justificacionRutas: '',
    resumen: { totalEmpleados, totalHoras, totalTransporte, totalAlimentos: totalEmpleados, porBloque: {} },
    fechaCreacion: dia(-3 + (n % 3)), fechaActualizacion: dia(-2 + (n % 2)),
  };
  if (estatus !== 'borrador') doc.folio = `TE-2026-${String(n).padStart(4, '0')}`;
  if (['pendiente_aut2', 'autorizada', 'procesada'].includes(estatus)) doc.aut1 = { nomina: '50610', nombre: 'MENDOZA ANSELMO', fecha: dia(-2), comoRH: false };
  if (['autorizada', 'procesada'].includes(estatus)) doc.aut2 = { nomina: '11', nombre: 'MALDONADO SALVADOR', fecha: dia(-1), comoRH: false };
  if (estatus === 'devuelta') doc.devolucion = { nivel: 1, nomina: '50610', nombre: 'MENDOZA ANSELMO', motivo: 'Falta indicar la ruta de dos empleados', fecha: dia(-1) };
  await guardar(`tiempoExtra/${id}`, doc);
}
await guardar(`contadores/te-${ahora.getFullYear()}`, { ultimo: n });
console.log('Emuladores sembrados. Usuarios: ' + personas.map(p => `${p[0]} ${p[1]}`).join(' · ') + ` · contraseña ${PASSWORD}`);
