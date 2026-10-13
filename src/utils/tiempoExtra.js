/**
 * tiempoExtra.js — Reglas de la captura de tiempo extra (sin dependencias del navegador; se prueba en Node).
 * Empleado del editor ↔ documento tiempoExtra/{id}/empleados/{nómina}, horas, validaciones, resumen y lotes.
 */
import { MAX_PASAJEROS } from './solicitudes.js';

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
