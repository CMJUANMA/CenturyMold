// Datos ADICIONALES para la prueba de usabilidad con "usuarios IA". Solo EMULADOR (127.0.0.1, proyecto demo-…); todo inventado.
// NO borra nada: solo agrega documentos nuevos (nóminas 81xx) encima de lo que dejó datos-demo.mjs. No toca los datos de los manuales ni el contador de folios.
// Uso (con los emuladores arriba y datos-demo.mjs ya cargado): node scripts/manuales/datos-demo-ux.mjs
// Contraseña: la misma de los manuales (Demo12345).
import { PASSWORD } from './datos-demo-usuarios.mjs';

const PROYECTO = 'demo-solicitud-rutas';
const FS = `http://127.0.0.1:8080/v1/projects/${PROYECTO}/databases/(default)/documents`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake';

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
const minutos = (h) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(h ?? '').trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const calcularHoras = (a, b) => { const x = minutos(a), y = minutos(b); return x === null || y === null ? 0 : Math.round(((y > x ? y - x : y + 1440 - x) / 60) * 100) / 100; };

// Seguridad: el emulador de Firestore debe estar vivo y ser el de demo (si no, aborta)
await http(`http://127.0.0.1:8080/`);
const hoy = new Date();
const dia = (n) => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + n, 12);
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const TODOS_LOS_RECORRIDOS = ['solicitar', 'autorizar', 'recepcion', 'nomina', 'consulta', 'inicio', 'usuarios'];

export const USUARIOS_UX = {
  aut1Alm: ['8120', 'TORRES BELTRÁN MARCOS', 'JEFE DE ALMACÉN'],
  solicitanteAlm: ['8130', 'VALDÉS ORTEGA KARLA', 'ALMACENISTA'],
};
const RUTA = { rutaId: 'norte', comunidadId: 'la-loma', puntoReunionId: 'plaza' };

await guardar('puestos/jefe-de-almacen', { nombre: 'JEFE DE ALMACÉN', areaId: 'almacen', activo: true, alias: [], creadoPor: 'demo', fechaCreacion: hoy, nivelJerarquico: 3 });

const uids = {}, admin = { uid: 'demo', nombre: 'SISTEMAS DEMO' };
for (const [clave, [nomina, nombre, puesto]] of Object.entries(USUARIOS_UX)) {
  uids[clave] = await cuenta(nomina);
  await guardar(`usuarios/${uids[clave]}`, { nomina, nombre, rol: 'usuario', activo: true, debeCambiarPassword: false,
    preferencias: { ayudas: true, tamanoLetra: 'normal', tema: 'claro', recorridosVistos: TODOS_LOS_RECORRIDOS } });
  await guardar(`empleados/${nomina}`, { nomina, nombre, areaId: 'almacen', puestoId: puesto === 'JEFE DE ALMACÉN' ? 'jefe-de-almacen' : 'almacenista', puesto, activo: true, elegibleTE: puesto !== 'JEFE DE ALMACÉN', ...RUTA }); // el jefe no es elegible; la solicitante sí (la lista la excluye por tener rol)
}
const asignacion = (nomina, nombre, puesto, rol) => guardar(`asignaciones/${nomina}_${rol}_almacen`, {
  nomina, nombre, puesto, rol, areaId: 'almacen', desde: dia(-60), hasta: null, motivo: '', activo: true, asignadoPor: admin, fechaAsignacion: dia(-60),
});
await asignacion('8120', USUARIOS_UX.aut1Alm[1], 'JEFE DE ALMACÉN', 'aut1');
await asignacion('8130', USUARIOS_UX.solicitanteAlm[1], 'ALMACENISTA', 'solicitante');

// Solicitud VENCIDA (fecha ya pasada) de Almacén, ya con Aut. 1, pendiente de Aut. 2
const lista = [['8060', 'NÚÑEZ BARRERA GUSTAVO'], ['8061', 'OCAMPO SILVA BERTHA']].map(([nomina, nombre]) => ({ nomina, nombre, puesto: 'ALMACENISTA', horaEntrada: '7:00', horaSalida: '16:00' }));
const id = 'ux-vencida-alm';
await guardar(`tiempoExtra/${id}`, {
  areaId: 'almacen', areaNombre: 'Almacén', creadoPor: uids.solicitanteAlm, creadoPorNomina: '8130', creadoPorNombre: USUARIOS_UX.solicitanteAlm[1],
  fechaTE: ymd(dia(-3)), motivo: 'Inventario físico', tipo: 'turno_extra', estatus: 'pendiente_aut2', folio: `TE-${hoy.getFullYear()}-0901`,
  motivos: [{ motivoId: 'inventario-fisico', nombre: 'Inventario físico', numero: '', comentario: '', detalle: 'conteo de almacén', tipoNumero: '' }],
  comentario: 'Inventario de almacén (la fecha ya pasó sin autorizarse)', rutasDistintas: 0, desgloseRutas: [], justificacionRutas: '',
  resumen: { totalEmpleados: 2, totalHoras: 18, totalTransporte: 0, totalAlimentos: 2, porBloque: { '7:00 → 16:00': 2 } },
  aut1: { nomina: '8120', nombre: USUARIOS_UX.aut1Alm[1], fecha: dia(-5), comentario: '', comoRH: false },
  fechaCreacion: dia(-6), fechaActualizacion: dia(-5),
});
for (const e of lista) await guardar(`tiempoExtra/${id}/empleados/${e.nomina}`, {
  nombre: e.nombre, puesto: e.puesto, horaEntrada: e.horaEntrada, horaSalida: e.horaSalida, horas: calcularHoras(e.horaEntrada, e.horaSalida), requiereAlimentos: true,
  requiereTransporte: false, transporteLlegada: false, transporteSalida: false, rutaId: '', comunidadId: '', puntoReunionId: '', motivoIndex: 0,
});

console.log(`Datos UX cargados (solo agregados). Contraseña: ${PASSWORD}\n  8130 ${USUARIOS_UX.solicitanteAlm[1]} (solicitante Almacén)\n  8120 ${USUARIOS_UX.aut1Alm[1]} (Aut. 1 Almacén)\n  Solicitud vencida: tiempoExtra/${id} (pendiente de Aut. 2)`);
