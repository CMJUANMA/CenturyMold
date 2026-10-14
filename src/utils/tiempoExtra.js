/**
 * tiempoExtra.js — Reglas de la captura de tiempo extra (sin dependencias del navegador; se prueba en Node).
 * Empleado del editor ↔ documento tiempoExtra/{id}/empleados/{nómina}, horas, validaciones, resumen y lotes.
 */
import { MAX_PASAJEROS, resumenPasajeros } from './solicitudes.js';

/** Estatus que pueden leer los autorizadores y RH (todos menos borrador: ese solo lo ve su creador) */
export const ESTATUS_TE_VISIBLES = ['pendiente_aut1', 'pendiente_aut2', 'autorizada', 'devuelta', 'procesada', 'cancelada'];

export const MOTIVOS_TE = ['Producción', 'Mantenimiento', 'Calidad', 'Inventario', 'Embarques', 'Otro'];
export const MIN_COMENTARIO_TE = 10;
/** Empleados por lote de escritura (las reglas validan cada uno contra el padrón; el límite de lecturas por lote es 20) */
export const LOTE_EMPLEADOS = 10;

/** Bloques de horario de las rutas (24 h) */
export const HORAS_ENTRADA_TE = ['7:00', '16:00', '19:00', '0:00'];
export const HORAS_SALIDA_TE = ['16:00', '19:00', '0:00', '7:00'];
export const TURNOS_NOMINA = ['A', 'B', 'C'];

const minutos = (hora) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hora ?? '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Horas entre entrada y salida; si la salida es "menor" cruza la medianoche. 0 si falta alguna o son iguales */
export function calcularHoras(entrada, salida) {
  const a = minutos(entrada), b = minutos(salida);
  if (a === null || b === null || a === b) return 0;
  const diff = b > a ? b - a : b + 24 * 60 - a;
  return Math.round((diff / 60) * 100) / 100;
}

export const etiquetaBloque = (e) => (e?.horaEntrada && e?.horaSalida ? `${e.horaEntrada} → ${e.horaSalida}` : 'Sin horario');

/** Id de un borrador nuevo (BR- + 12 caracteres): lo piden las reglas; el folio se asigna hasta enviarlo */
export function nuevoIdBorrador(azar = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))) {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return `BR-${Array.from(azar(12), b => alfabeto[b % alfabeto.length]).join('')}`;
}

export const folioDe = (anio, numero) => `TE-${anio}-${String(numero).padStart(4, '0')}`;

/** Trozos de `n` elementos */
export function trozos(lista, n = LOTE_EMPLEADOS) {
  const salida = [];
  for (let i = 0; i < lista.length; i += n) salida.push(lista.slice(i, i + n));
  return salida;
}

/** Empleado del editor a partir de un registro del padrón. Si el padrón trae ruta completa y vigente, pide confirmarla */
export function empleadoDesdePadron(emp, ruta) {
  const completa = !!(ruta?.rutaId && ruta?.comunidadId && ruta?.puntoReunionId);
  return {
    nomina: String(emp.nomina), nombre: emp.nombre ?? '', puesto: emp.puesto ?? '', turnoNomina: emp.turnoNomina ?? '',
    horaEntrada: '', horaSalida: '', alimentos: false, transporte: true,
    rutaId: ruta?.rutaId ?? '', comunidadId: ruta?.comunidadId ?? '', puntoReunionId: ruta?.puntoReunionId ?? '',
    necesitaConfirmar: completa, confirmada: false,
  };
}

/** Documento tiempoExtra/{id}/empleados/{nómina} (solo los campos que permiten las reglas) */
export function empleadoADoc(e) {
  const transporte = !!e.transporte;
  return {
    nombre: e.nombre, puesto: e.puesto ?? '', turnoNomina: e.turnoNomina ?? '', horaEntrada: e.horaEntrada ?? '', horaSalida: e.horaSalida ?? '',
    horas: calcularHoras(e.horaEntrada, e.horaSalida), requiereAlimentos: !!e.alimentos, requiereTransporte: transporte,
    rutaId: transporte ? (e.rutaId ?? '') : '', comunidadId: transporte ? (e.comunidadId ?? '') : '', puntoReunionId: transporte ? (e.puntoReunionId ?? '') : '',
  };
}

/** Empleado del editor a partir de su documento guardado (la ruta guardada ya se confirmó) */
export function docAEmpleado(nomina, d) {
  return {
    nomina: String(nomina), nombre: d.nombre ?? '', puesto: d.puesto ?? '', turnoNomina: d.turnoNomina ?? '',
    horaEntrada: d.horaEntrada ?? '', horaSalida: d.horaSalida ?? '', alimentos: !!d.requiereAlimentos, transporte: d.requiereTransporte !== false,
    rutaId: d.rutaId ?? '', comunidadId: d.comunidadId ?? '', puntoReunionId: d.puntoReunionId ?? '', necesitaConfirmar: false, confirmada: true,
  };
}

/** ¿La ruta del empleado ya está lista? (no pide transporte, o tiene ruta/comunidad/punto y, si venía del padrón, se confirmó) */
export const transporteCompleto = (e) => !e.transporte || (!!e.rutaId && !!e.comunidadId && !!e.puntoReunionId && (!e.necesitaConfirmar || e.confirmada));

/** Totales de la solicitud (el "resumen" que se guarda en la solicitud) */
export function resumenTE(empleados) {
  const porBloque = {};
  let horas = 0, transporte = 0, alimentos = 0;
  for (const e of empleados) {
    horas += calcularHoras(e.horaEntrada, e.horaSalida);
    if (e.transporte) transporte++;
    if (e.alimentos) alimentos++;
    const b = etiquetaBloque(e);
    porBloque[b] = (porBloque[b] ?? 0) + 1;
  }
  return { totalEmpleados: empleados.length, totalHoras: Math.round(horas * 100) / 100, totalTransporte: transporte, totalAlimentos: alimentos, porBloque };
}

/**
 * Problemas de una solicitud lista para enviar. Cada uno: { nivel: 'error'|'aviso', mensaje, nomina? }.
 * Los errores bloquean el envío; los avisos (otro tiempo extra el mismo día) no.
 * @param {object} p { fechaTE, motivo, comentario, empleados, hoy ('AAAA-MM-DD'), ocupados: Map nómina → { folio, estatus } }
 */
export function problemasDeEnvio({ areaId, fechaTE, motivo, comentario, empleados, hoy, ocupados = new Map() }) {
  const p = [];
  const error = (mensaje, nomina) => p.push({ nivel: 'error', mensaje, nomina });
  if (!areaId) error('Elige el área.');
  if (!fechaTE) error('Elige la fecha del tiempo extra.');
  else if (fechaTE < hoy) error('La fecha debe ser hoy o futura.');
  if (!MOTIVOS_TE.includes(motivo)) error('Elige el motivo.');
  if (String(comentario ?? '').trim().length < MIN_COMENTARIO_TE) error(`El comentario es obligatorio (al menos ${MIN_COMENTARIO_TE} caracteres).`);
  if (empleados.length === 0) error('Agrega al menos un empleado.');
  if (empleados.length > MAX_PASAJEROS) error(`Máximo ${MAX_PASAJEROS} empleados por solicitud; divídela en dos.`);
  const vistos = new Set();
  for (const e of empleados) {
    if (vistos.has(e.nomina)) error(`${e.nombre} está repetido.`, e.nomina);
    vistos.add(e.nomina);
    if (!e.horaEntrada || !e.horaSalida) error(`${e.nombre}: falta el horario.`, e.nomina);
    else if (e.horaEntrada === e.horaSalida) error(`${e.nombre}: la entrada y la salida no pueden ser iguales.`, e.nomina);
    if (!transporteCompleto(e)) {
      error(e.transporte && e.rutaId && e.comunidadId && e.puntoReunionId
        ? `${e.nombre}: confirma la ruta precargada.` : `${e.nombre}: completa ruta, comunidad y punto de reunión.`, e.nomina);
    }
  }
  for (const e of empleados) {
    const otra = ocupados.get(e.nomina);
    if (otra) p.push({ nivel: 'aviso', mensaje: `${e.nombre} ya tiene otro tiempo extra ese día (${otra.folio ?? 'borrador'}).`, nomina: e.nomina });
  }
  return p;
}

/** Aplica cambios (horario, alimentos, transporte) a los empleados cuya nómina está en `seleccion` (o a todos si es null) */
export function aplicarA(empleados, seleccion, cambios) {
  return empleados.map(e => {
    if (seleccion && !seleccion.has(e.nomina)) return e;
    const nuevo = { ...e, ...cambios };
    if (cambios.transporte === false) Object.assign(nuevo, { necesitaConfirmar: false, confirmada: false });
    return nuevo;
  });
}

/** Estatus con el que se envía: Aut. 1 vigente de esa área (o área sin participaTE) va directo a nivel 2 */
export const estatusAlEnviar = ({ esAut1DeLaArea, areaParticipa }) => (!areaParticipa || esAut1DeLaArea ? 'pendiente_aut2' : 'pendiente_aut1');

/** Nivel en el que va una solicitud, en texto */
export function nivelEnTexto(estatus) {
  return { borrador: 'Sin enviar', pendiente_aut1: 'Autorización 1', pendiente_aut2: 'Autorización 2', autorizada: 'Autorizada', devuelta: 'Devuelta', procesada: 'Recibida por RH', cancelada: 'Cancelada' }[estatus] ?? estatus;
}

/** Pestañas de "Mis solicitudes" */
export const PESTANAS_TE = [
  { id: 'borrador', label: 'Borradores', estatus: ['borrador'] },
  { id: 'autorizacion', label: 'En autorización', estatus: ['pendiente_aut1', 'pendiente_aut2'] },
  { id: 'devuelta', label: 'Devueltas', estatus: ['devuelta'] },
  { id: 'autorizada', label: 'Autorizadas', estatus: ['autorizada', 'procesada'] },
  { id: 'cancelada', label: 'Canceladas', estatus: ['cancelada'] },
];

// ── Bandejas de autorización ──────────────────────────────────────────────

export const MIN_MOTIVO_DEVOLUCION = 10;
export const MSG_YA_RESPONDIDA = 'Alguien más ya respondió esta solicitud';

const aMillis = (f) => (typeof f?.toMillis === 'function' ? f.toMillis() : f instanceof Date ? f.getTime() : typeof f === 'number' ? f : 0);

/** Desde cuándo espera en su nivel: la última vez que cambió de estatus (al enviarla, o al pasar de nivel 1 a 2) */
export const esperaDesde = (t) => aMillis(t.fechaActualizacion) || aMillis(t.fechaCreacion);

/** "hace 5 min", "hace 3 h", "hace 2 días" */
export function haceTiempo(desde, ahora = Date.now()) {
  const ms = Math.max(0, ahora - (typeof desde === 'number' ? desde : aMillis(desde)));
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}

/** La fecha del tiempo extra ya pasó ('AAAA-MM-DD' contra hoy) */
export const fechaVencida = (fechaTE, hoy) => !!fechaTE && fechaTE < hoy;

/** Las más antiguas primero (por el tiempo que llevan esperando en su nivel) */
export const masAntiguasPrimero = (lista) => [...lista].sort((a, b) => esperaDesde(a) - esperaDesde(b));

/** ¿Es una solicitud propia? (nadie autoriza lo que creó) */
export const esPropia = (t, uid) => t.creadoPor === uid;

/** Texto de una firma: "Salvador Maldonado" o "Marco E. (RH)" cuando firmó por su rol RH */
export const firmaTexto = (f, nombre = (x) => x) => (f ? `${nombre(f.nombre ?? f.nomina)}${f.comoRH ? ' (RH)' : ''}` : '');

/** Filtros de la bandeja y de la consulta: área, estatus, rango de fecha del TE y texto del solicitante */
export function filtrarSolicitudes(lista, { areaId = '', estatus = '', desde = '', hasta = '', solicitante = '' } = {}) {
  const q = String(solicitante).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  return lista.filter(t => (!areaId || t.areaId === areaId) && (!estatus || t.estatus === estatus)
    && (!desde || String(t.fechaTE ?? '') >= desde) && (!hasta || String(t.fechaTE ?? '') <= hasta)
    && (!q || `${t.creadoPorNombre ?? ''} ${t.creadoPorNomina ?? ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)));
}

/** Totales de varias solicitudes (para confirmar una autorización masiva) */
export const totalesDe = (lista) => ({
  solicitudes: lista.length,
  empleados: lista.reduce((a, t) => a + (t.resumen?.totalEmpleados ?? 0), 0),
  horas: Math.round(lista.reduce((a, t) => a + (t.resumen?.totalHoras ?? 0), 0) * 100) / 100,
});

/** "Ruta · Comunidad · Punto" de un empleado a partir de los ids y los catálogos */
export function textoRuta(e, { rutas = [], comunidades = [], puntos = [] } = {}) {
  if (!e.transporte) return 'Sin transporte';
  const n = (lista, id) => lista.find(x => x.id === id)?.nombre ?? '';
  return [n(rutas, e.rutaId), n(comunidades, e.comunidadId), n(puntos, e.puntoReunionId)].filter(Boolean).join(' · ') || 'Sin ruta';
}

// ── Recepción de RH y transporte ──────────────────────────────────────────

/** Nivel con el que RH devuelve en la recepción (los niveles 1 y 2 son de los autorizadores) */
export const NIVEL_RECEPCION = 3;
export const MIN_MOTIVO_CANCELACION_RH = 10;
/** Estatus que RH descarga en el Excel de tiempo extra: lo autorizado y lo ya recibido */
export const ESTATUS_DESCARGA = ['autorizada', 'procesada'];
export const ORIGEN_TIEMPO_EXTRA = 'tiempo_extra';

/**
 * Turno de las rutas ('1' | '2' | '3') al que pertenece una hora de ENTRADA: el turno que la contiene.
 *   Turno 1: 7:00 a 15:59 · Turno 2: 16:00 a 23:59 · Turno 3: 0:00 a 6:59
 * Así 7:00 → 1, 16:00 → 2, 0:00 → 3 y 19:00 (que no inicia turno) cae en el 2, el turno en que entra. '' si la hora no es válida.
 */
export function turnoPorEntrada(hora) {
  const m = minutos(hora);
  if (m === null) return '';
  if (m >= 16 * 60) return '2';
  if (m >= 7 * 60) return '1';
  return '3';
}

/** "16:00" → "4:00PM", "0:00" → "12:00AM": el formato de horas que ya usa el formulario de rutas. Si no es una hora, se devuelve igual */
export function horaFormatoRutas(hora) {
  const m = minutos(hora);
  if (m === null) return String(hora ?? '');
  const h = Math.floor(m / 60), mm = m % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(mm).padStart(2, '0')}${h < 12 ? 'AM' : 'PM'}`;
}

/** Pasajero del transporte (solicitudes/{id}/pasajeros/{nómina}) a partir de un empleado del tiempo extra con transporte */
export function pasajeroDeEmpleado(e, te) {
  return {
    nomina: String(e.nomina), nombre: e.nombre, puesto: e.puesto ?? '',
    areaId: te.areaId ?? '', areaNombre: te.areaNombre ?? '',
    turno: turnoPorEntrada(e.horaEntrada), horaEntrada: horaFormatoRutas(e.horaEntrada), horaSalida: horaFormatoRutas(e.horaSalida),
    alimentos: !!e.alimentos, rutaId: e.rutaId ?? '', comunidadId: e.comunidadId ?? '', puntoReunionId: e.puntoReunionId ?? '',
  };
}

/** Solo los empleados con transporte pasan a la solicitud de transporte; cada uno con su propio horario */
export function pasajerosDeTE(empleados, te) {
  return empleados.filter(e => e.transporte).map(e => pasajeroDeEmpleado(e, te));
}

/** Documento de la solicitud de transporte de un tiempo extra recibido (sin fechas del servidor: las pone quien escribe) */
export function datosSolicitudTransporte(te, pasajeros, rh) {
  return {
    fechaServicio: te.fechaTE,
    solicitanteNombre: te.creadoPorNombre ?? '', solicitanteNomina: String(te.creadoPorNomina ?? ''),
    creadoPor: rh.uid, creadoPorNombre: rh.nombre ?? '',
    areaId: te.areaId, estatus: 'aprobada',
    origen: ORIGEN_TIEMPO_EXTRA, tiempoExtraId: te.id, folioTE: te.folio ?? '',
    ...resumenPasajeros(pasajeros),
  };
}

/** Texto del solicitante en el bloque del Excel del proveedor: en tiempo extra, el solicitante original y el folio (no el nombre de RH) */
export const solicitanteDeTransporte = (sol) =>
  (sol.origen === ORIGEN_TIEMPO_EXTRA ? `${sol.solicitanteNombre || 'Desconocido'} · Tiempo extra ${sol.folioTE || ''}`.trim() : sol.solicitanteNombre);

/** Agrupa por fecha del tiempo extra, la más próxima primero (y por folio dentro de cada fecha) */
export function agruparPorFecha(lista) {
  const grupos = new Map();
  for (const t of [...lista].sort((a, b) => String(a.fechaTE).localeCompare(String(b.fechaTE)) || String(a.folio).localeCompare(String(b.folio)))) {
    const f = t.fechaTE ?? '';
    if (!grupos.has(f)) grupos.set(f, []);
    grupos.get(f).push(t);
  }
  return [...grupos].map(([fecha, items]) => ({ fecha, items }));
}

/** Lo que ve el solicitante de una solicitud ya recibida por RH */
export function textoRecibida(t) {
  return (t.resumen?.totalTransporte ?? 0) > 0 ? 'Recibida por RH · transporte solicitado' : 'Recibida por RH · sin transporte';
}

/** "Autorización 2" / "Recursos Humanos (recepción)" */
export const quienDevolvio = (nivel) => (Number(nivel) === NIVEL_RECEPCION ? 'Recursos Humanos (recepción)' : `Autorización ${nivel}`);
