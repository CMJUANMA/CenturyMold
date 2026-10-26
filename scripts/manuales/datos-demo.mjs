// Datos de EJEMPLO para los manuales de usuario. Carga en el EMULADOR (auth 9099 y firestore 8080, proyecto demo-solicitud-rutas) y NUNCA en producción:
// las direcciones están fijas a 127.0.0.1 y el proyecto es "demo-…". Todo es INVENTADO: personas, nóminas, teléfonos y solicitudes. No hay ningún dato del padrón real.
// Uso: npx firebase emulators:start --only auth,firestore --project demo-solicitud-rutas   y, en otra terminal: node scripts/manuales/datos-demo.mjs
// Contraseña de todos los usuarios: Demo12345   ·   Usuarios: ver USUARIOS abajo.
import { MOTIVOS_INICIALES } from '../../src/utils/motivosTE.js';

// (Las utilidades de la app importan sin extensión y Node no las abre: aquí van las dos cuentas que se necesitan, iguales a utils/tiempoExtra.js)
const minutos = (h) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(h ?? '').trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const calcularHoras = (a, b) => { const x = minutos(a), y = minutos(b); if (x === null || y === null) return 0; return Math.round(((y > x ? y - x : y + 1440 - x) / 60) * 100) / 100; };
const empleadoADoc = (e) => ({
  nombre: e.nombre, puesto: e.puesto ?? '', horaEntrada: e.horaEntrada, horaSalida: e.horaSalida, horas: calcularHoras(e.horaEntrada, e.horaSalida), requiereAlimentos: !!e.alimentos,
  requiereTransporte: e.transporte, transporteLlegada: e.transporte && e.transporteLlegada, transporteSalida: e.transporte && e.transporteSalida,
  rutaId: e.transporte ? e.rutaId : '', comunidadId: e.transporte ? e.comunidadId : '', puntoReunionId: e.transporte ? e.puntoReunionId : '', motivoIndex: e.motivoIndex > 0 ? e.motivoIndex : 0,
});
const resumenTE = (lista) => {
  const porBloque = {};
  for (const e of lista) { const b = `${e.horaEntrada} → ${e.horaSalida}`; porBloque[b] = (porBloque[b] ?? 0) + 1; }
  return {
    totalEmpleados: lista.length, totalHoras: Math.round(lista.reduce((t, e) => t + calcularHoras(e.horaEntrada, e.horaSalida), 0) * 100) / 100,
    totalTransporte: lista.filter(e => e.transporte).length, totalAlimentos: lista.filter(e => e.alimentos).length, porBloque,
  };
};

const PROYECTO = 'demo-solicitud-rutas';
const FS = `http://127.0.0.1:8080/v1/projects/${PROYECTO}/databases/(default)/documents`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake';
import { PASSWORD, USUARIOS } from './datos-demo-usuarios.mjs';

async function http(url, opciones) {
  const r = await fetch(url, opciones);
  if (!r.ok) throw new Error(`${opciones?.method ?? 'GET'} ${url}: ${r.status} ${await r.text()}`);
  return r;
}
const valor = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valor) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, valor(x)])) } };
};
const guardar = (ruta, datos) => http(`${FS}/${ruta}`, {
  method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
  body: JSON.stringify({ fields: Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, valor(v)])) }),
});
async function cuenta(nomina) {
  const j = await (await http(AUTH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${nomina}@rutas.app`, password: PASSWORD, returnSecureToken: true }) })).json();
  return j.localId;
}

// Empezar de cero (solo el emulador)
await http(`http://127.0.0.1:8080/emulator/v1/projects/${PROYECTO}/databases/(default)/documents`, { method: 'DELETE' });
await http(`http://127.0.0.1:9099/emulator/v1/projects/${PROYECTO}/accounts`, { method: 'DELETE' });

const hoy = new Date();
const dia = (n) => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + n, 12);
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Usuarios: tema claro (se imprime mejor), sin recorridos guiados encima de las capturas
const TODOS_LOS_RECORRIDOS = ['solicitar', 'autorizar', 'recepcion', 'nomina', 'consulta', 'inicio', 'usuarios'];
const uids = {};
for (const [clave, [nomina, nombre, rol]] of Object.entries(USUARIOS)) {
  uids[clave] = await cuenta(nomina);
  await guardar(`usuarios/${uids[clave]}`, {
    nomina, nombre, rol, activo: true, debeCambiarPassword: clave === 'nuevo',
    preferencias: { ayudas: true, tamanoLetra: 'normal', tema: 'claro', recorridosVistos: TODOS_LOS_RECORRIDOS },
  });
}

// Áreas (las reales), puestos y empleados inventados
const AREAS = [['produccion', 'Producción', 1, true], ['almacen', 'Almacén', 2, true], ['calidad', 'Calidad', 3, true], ['mantenimiento', 'Mantenimiento', 4, true], ['moldes', 'Moldes', 5, true], ['administrativo', 'Administrativo', 6, false]];
for (const [id, nombre, orden, participaTE] of AREAS) await guardar(`areas/${id}`, { nombre, orden, participaTE, activa: true });
const nombreArea = Object.fromEntries(AREAS.map(a => [a[0], a[1]]));

const PUESTOS = [
  ['jefe-de-moldes', 'JEFE DE MOLDES', 'moldes', 3], ['moldeador', 'MOLDEADOR', 'moldes', null], ['jefe-de-produccion', 'JEFE DE PRODUCCIÓN', 'produccion', 3], ['operador', 'OPERADOR', 'produccion', null],
  ['almacenista', 'ALMACENISTA', 'almacen', null], ['inspector', 'INSPECTOR DE CALIDAD', 'calidad', null], ['tecnico', 'TÉCNICO DE MANTENIMIENTO', 'mantenimiento', null],
  ['gerente-de-operaciones', 'GERENTE DE OPERACIONES', 'administrativo', 1], ['analista-rh', 'ANALISTA DE RH', 'administrativo', 4], ['analista-nomina', 'ANALISTA DE NÓMINA', 'administrativo', 4],
  ['sistemas', 'SISTEMAS', 'administrativo', 4],
];
for (const [id, nombre, areaId, nivel] of PUESTOS) await guardar(`puestos/${id}`, { nombre, areaId, activo: true, alias: [], creadoPor: 'demo', fechaCreacion: hoy, ...(nivel ? { nivelJerarquico: nivel } : {}) });
const puestoNombre = Object.fromEntries(PUESTOS.map(p => [p[0], p[1]]));

// Rutas, comunidades y puntos de reunión inventados
await guardar('rutas/norte', { nombre: 'Ruta Norte', activo: true });
await guardar('rutas/sur', { nombre: 'Ruta Sur', activo: true });
await guardar('comunidades/la-loma', { nombre: 'La Loma', rutaId: 'norte', activo: true });
await guardar('comunidades/los-sauces', { nombre: 'Los Sauces', rutaId: 'sur', activo: true });
await guardar('puntosReunion/plaza', { clave: 'PLAZA', nombre: 'Plaza de La Loma', comunidadId: 'la-loma', rutaId: 'norte', activo: true });
await guardar('puntosReunion/capilla', { clave: 'CAPILLA', nombre: 'Capilla de Los Sauces', comunidadId: 'los-sauces', rutaId: 'sur', activo: true });
const RUTAS = { norte: { rutaId: 'norte', comunidadId: 'la-loma', puntoReunionId: 'plaza' }, sur: { rutaId: 'sur', comunidadId: 'los-sauces', puntoReunionId: 'capilla' } };
for (const { id, ...campos } of MOTIVOS_INICIALES) await guardar(`motivosTE/${id}`, campos);
for (const t of ['A', 'B', 'C']) await guardar(`turnosNomina/${t}`, { entrada: t === 'A' ? '7:00' : t === 'B' ? '16:00' : '0:00', salida: t === 'A' ? '16:00' : t === 'B' ? '0:00' : '7:00' });

// Empleados: [nómina, nombre, área, puesto, ruta]
const EMPLEADOS = [
  ['8020', USUARIOS.aut1[1], 'moldes', 'jefe-de-moldes', 'norte'], ['8030', USUARIOS.solicitante[1], 'moldes', 'moldeador', 'norte'],
  ['8040', 'ÁLVAREZ CAMPOS JORGE', 'moldes', 'moldeador', 'norte'], ['8041', 'BENÍTEZ ROMERO ALMA', 'moldes', 'moldeador', 'norte'], ['8042', 'CARRILLO NIETO SAÚL', 'moldes', 'moldeador', 'sur'],
  ['8043', 'DELGADO FUENTES IRMA', 'moldes', 'moldeador', 'sur'], ['8044', 'ESPARZA MONTES RAÚL', 'moldes', 'moldeador', 'norte'], ['8045', 'FIGUEROA LEAL PAOLA', 'moldes', 'moldeador', 'norte'],
  ['8046', 'GUZMÁN SERRANO ÓSCAR', 'moldes', 'moldeador', 'sur'], ['8047', 'HURTADO VEGA MIRIAM', 'moldes', 'moldeador', 'norte'],
  ['8021', USUARIOS.aut1Prod[1], 'produccion', 'jefe-de-produccion', 'sur'], ['8031', USUARIOS.solicitanteProd[1], 'produccion', 'operador', 'sur'],
  ['8050', 'IBÁÑEZ CORONA ELÍAS', 'produccion', 'operador', 'sur'], ['8051', 'JUÁREZ PINEDA NORMA', 'produccion', 'operador', 'norte'], ['8052', 'LEÓN ARROYO VÍCTOR', 'produccion', 'operador', 'sur'],
  ['8053', 'MENDOZA ÁVILA TERESA', 'produccion', 'operador', 'norte'], ['8060', 'NÚÑEZ BARRERA GUSTAVO', 'almacen', 'almacenista', 'norte'], ['8061', 'OCAMPO SILVA BERTHA', 'almacen', 'almacenista', 'sur'],
  ['8070', 'PALACIOS RUIZ ALDO', 'calidad', 'inspector', 'norte'], ['8071', 'QUINTERO DÍAZ FERNANDA', 'calidad', 'inspector', 'sur'],
  ['8080', 'ROSALES MEJÍA IVÁN', 'mantenimiento', 'tecnico', 'norte'], ['8081', 'SANDOVAL CRUZ LILIANA', 'mantenimiento', 'tecnico', 'sur'],
  ['8010', USUARIOS.aut2[1], 'administrativo', 'gerente-de-operaciones', 'norte'], ['8001', USUARIOS.rh[1], 'administrativo', 'analista-rh', 'norte'],
  ['8002', USUARIOS.nomina[1], 'administrativo', 'analista-nomina', 'norte'], ['8000', USUARIOS.admin[1], 'administrativo', 'sistemas', 'norte'], ['8099', USUARIOS.nuevo[1], 'administrativo', 'analista-rh', 'sur'],
];
const empleado = Object.fromEntries(EMPLEADOS.map(([nomina, nombre, areaId, puestoId, ruta]) => [nomina, { nomina, nombre, puesto: puestoNombre[puestoId], ruta }]));
for (const [nomina, nombre, areaId, puestoId, ruta] of EMPLEADOS) {
  await guardar(`empleados/${nomina}`, { nomina, nombre, areaId, puestoId, puesto: puestoNombre[puestoId], activo: true, ...RUTAS[ruta] });
}

// Roles operativos
const asignacion = (nomina, rol, areaId) => guardar(`asignaciones/${nomina}_${rol}_${rol === 'aut2' ? 'planta' : areaId}`, {
  nomina, nombre: empleado[nomina].nombre, puesto: empleado[nomina].puesto, rol, areaId: rol === 'aut2' ? null : areaId, desde: dia(-60), hasta: null, motivo: '', activo: true,
  asignadoPor: { uid: uids.admin, nombre: USUARIOS.admin[1] }, fechaAsignacion: dia(-60),
});
await asignacion('8010', 'aut2', null);
await asignacion('8020', 'aut1', 'moldes'); await asignacion('8021', 'aut1', 'produccion');
await asignacion('8030', 'solicitante', 'moldes'); await asignacion('8031', 'solicitante', 'produccion');

// Solicitudes de tiempo extra en todos los estados
const MOT = {
  inventario: { motivoId: 'inventario-fisico', nombre: 'Inventario físico', numero: '', comentario: '', detalle: 'apoyo a inventario de fin de mes', tipoNumero: '' },
  po: { motivoId: 'cargo-po', nombre: 'Cargo a P.O.', numero: '4551099797', comentario: '', detalle: 'cambio de molde urgente', tipoNumero: 'po' },
  vacante: { motivoId: 'cubrir-vacante', nombre: 'Cubrir vacante / falta de personal', numero: '', comentario: '', detalle: '', tipoNumero: '' },
  embarques: { motivoId: 'embarques-fin-de-semana', nombre: 'Embarques fin de semana', numero: '', comentario: '', detalle: 'pedido de exportación', tipoNumero: '' },
};
/** Un empleado de la solicitud: [nómina, entrada, salida, alimentos, transporte (llegada y salida), índice de motivo] */
const emp = ([nomina, entrada, salida, alimentos = true, transporte = true, motivoIndex = 0]) => ({
  ...empleado[nomina], horaEntrada: entrada, horaSalida: salida, alimentos, transporteLlegada: transporte, transporteSalida: transporte, transporte, motivoIndex,
  rutaId: RUTAS[empleado[nomina].ruta].rutaId, comunidadId: RUTAS[empleado[nomina].ruta].comunidadId, puntoReunionId: RUTAS[empleado[nomina].ruta].puntoReunionId,
});
const firma = (nomina, f, comentario = '', comoRH = false) => ({ nomina, nombre: empleado[nomina].nombre, fecha: f, comentario, comoRH });

let numero = 0;
async function solicitud({ id, estatus, areaId = 'moldes', creador = 'solicitante', offset, motivos, tipo = 'turno_extra', comentario, empleados, extra = {} }) {
  numero++;
  const lista = empleados.map(emp);
  const nominaCreador = USUARIOS[creador][0];
  const borrador = estatus === 'borrador';
  const docId = id ?? (borrador ? `BR-DEMO${numero}ABCDE` : `demo${numero}`);
  const doc = {
    areaId, areaNombre: nombreArea[areaId], creadoPor: uids[creador], creadoPorNomina: nominaCreador, creadoPorNombre: USUARIOS[creador][1],
    fechaTE: ymd(dia(offset)), motivo: motivos[0].nombre, motivos, tipo, comentario, estatus,
    rutasDistintas: new Set(lista.filter(e => e.transporte).map(e => e.rutaId)).size, desgloseRutas: [], justificacionRutas: '',
    resumen: resumenTE(lista), fechaCreacion: dia(-4), fechaActualizacion: dia(-3), ...extra,
  };
  if (!borrador) doc.folio = `TE-${hoy.getFullYear()}-${String(numero).padStart(4, '0')}`;
  if (['pendiente_aut2', 'autorizada', 'procesada'].includes(estatus)) doc.aut1 = firma('8020', dia(-3));
  if (['autorizada', 'procesada'].includes(estatus)) doc.aut2 = firma('8010', dia(-2));
  if (estatus === 'procesada') { doc.recibidaPor = { nomina: '8001', nombre: USUARIOS.rh[1], fecha: dia(-1) }; doc.fechaRecepcion = dia(-1); }
  await guardar(`tiempoExtra/${docId}`, doc);
  for (const e of lista) await guardar(`tiempoExtra/${docId}/empleados/${e.nomina}`, empleadoADoc(e));
  return docId;
}

// De la solicitante de Moldes (la persona del manual)
await solicitud({ estatus: 'borrador', offset: 3, motivos: [MOT.inventario], comentario: 'Inventario físico de fin de mes en el almacén de moldes', empleados: [['8040', '7:00', '16:00'], ['8041', '7:00', '16:00'], ['8044', '7:00', '16:00', true, false]] });
await solicitud({ estatus: 'pendiente_aut1', offset: 1, motivos: [MOT.po], comentario: 'Cambio de molde urgente para entregar el pedido del cliente', empleados: [['8040', '16:00', '0:00'], ['8042', '16:00', '0:00'], ['8043', '16:00', '0:00'], ['8046', '16:00', '0:00']] });
await solicitud({ estatus: 'pendiente_aut1', offset: 0, motivos: [MOT.vacante], comentario: 'Falta de personal por incapacidades en el turno', empleados: [['8044', '16:00', '0:00'], ['8045', '16:00', '0:00']] });
await solicitud({ estatus: 'pendiente_aut2', offset: 2, motivos: [MOT.inventario, MOT.po], comentario: 'Inventario y cambio de molde en el mismo día', empleados: [['8040', '7:00', '16:00', true, true, 0], ['8041', '7:00', '16:00', true, true, 1], ['8047', '7:00', '16:00', true, false, 0]] });
await solicitud({ estatus: 'devuelta', offset: 4, motivos: [MOT.embarques], comentario: 'Embarque de exportación del sábado', empleados: [['8043', '7:00', '16:00'], ['8046', '7:00', '16:00']],
  extra: { devolucion: { nivel: 1, nomina: '8020', nombre: USUARIOS.aut1[1], motivo: 'Falta indicar quién va en la ruta sur y quién necesita transporte', fecha: dia(-1) } } });
await solicitud({ estatus: 'autorizada', offset: 1, motivos: [MOT.embarques], comentario: 'Embarque de exportación del jueves', empleados: [['8040', '7:00', '16:00'], ['8041', '7:00', '16:00'], ['8042', '7:00', '16:00'], ['8043', '7:00', '16:00'], ['8047', '7:00', '16:00']] });
await solicitud({ estatus: 'pendiente_aut1', offset: -2, motivos: [MOT.vacante], comentario: 'Cobertura de una vacante (no se alcanzó a autorizar)', empleados: [['8045', '16:00', '0:00'], ['8046', '16:00', '0:00']] });
await solicitud({ estatus: 'procesada', offset: -1, motivos: [MOT.inventario], comentario: 'Inventario cíclico del turno de noche', empleados: [['8040', '16:00', '0:00'], ['8041', '16:00', '0:00'], ['8042', '16:00', '0:00'], ['8044', '16:00', '0:00']] });
await solicitud({ estatus: 'cancelada', offset: -5, motivos: [MOT.vacante], comentario: 'Se canceló: ya no hizo falta cubrir ese turno', empleados: [['8047', '7:00', '16:00']],
  extra: { motivoCancelacion: 'Ya no hizo falta cubrir ese turno', canceladaPor: { nomina: '8030', nombre: USUARIOS.solicitante[1], fecha: dia(-6), comoRH: false } } });
await solicitud({ estatus: 'pendiente_aut1', offset: 2, tipo: 'extension', motivos: [MOT.po], comentario: 'Extensión de turno para terminar un molde', empleados: [['8044', '16:00', '19:00', true, false], ['8045', '16:00', '19:00', true, false]] });
// De otras áreas (para los demás manuales)
await solicitud({ estatus: 'pendiente_aut1', areaId: 'produccion', creador: 'solicitanteProd', offset: 1, motivos: [MOT.vacante], comentario: 'Falta de personal en la línea 2', empleados: [['8050', '7:00', '16:00'], ['8051', '7:00', '16:00'], ['8052', '7:00', '16:00']] });
await solicitud({ estatus: 'pendiente_aut2', areaId: 'produccion', creador: 'solicitanteProd', offset: 2, motivos: [MOT.embarques], comentario: 'Embarque especial', empleados: [['8050', '7:00', '16:00'], ['8053', '7:00', '16:00']] });
await solicitud({ estatus: 'autorizada', areaId: 'produccion', creador: 'solicitanteProd', offset: 3, motivos: [MOT.po], comentario: 'Pedido urgente con cargo a P.O.', empleados: [['8051', '16:00', '0:00'], ['8052', '16:00', '0:00']] });
await guardar(`contadores/te-${hoy.getFullYear()}`, { ultimo: numero });

console.log(`Datos de ejemplo cargados en el emulador. Contraseña de todos: ${PASSWORD}\n` + Object.values(USUARIOS).map(([n, nombre, rol]) => `  ${n}  ${nombre}  (${rol})`).join('\n'));
