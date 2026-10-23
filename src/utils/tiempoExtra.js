/**
 * tiempoExtra.js — Reglas de la captura de tiempo extra (sin dependencias del navegador; se prueba en Node).
 * Empleado del editor ↔ documento tiempoExtra/{id}/empleados/{nómina}, horas, validaciones, resumen y lotes.
 */
import { MAX_PASAJEROS, resumenPasajeros } from './solicitudes.js';
import { fechaConDia, fechaCorta, rangoMes, rangoSemana, sumarDias } from './fechas.js';
import { formatoHora12 } from './horas.js';
import { motivoTexto, motivosParaGuardar, problemasDeMotivos, tieneMotivo } from './motivosTE.js';

// Los motivos (catálogo, varios por solicitud, P.O./TB) viven en motivosTE.js; motivoTexto se reexporta para los Excel y las pantallas
export { motivoTexto };

/** Estatus que pueden leer los autorizadores y RH (todos menos borrador: ese solo lo ve su creador) */
export const ESTATUS_TE_VISIBLES = ['pendiente_aut1', 'pendiente_aut2', 'autorizada', 'devuelta', 'procesada', 'cancelada'];

export const MIN_COMENTARIO_TE = 10;
/** Empleados por lote de escritura (las reglas validan cada uno contra el padrón; el límite de lecturas por lote es 20) */
export const LOTE_EMPLEADOS = 10;

/** Bloques de horario de las rutas (24 h) */
export const HORAS_ENTRADA_TE = ['7:00', '16:00', '19:00', '0:00'];
export const HORAS_SALIDA_TE = ['16:00', '19:00', '0:00', '7:00'];

const minutos = (hora) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hora ?? '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Duración máxima razonable de un tiempo extra (de la hora de inicio a la de fin, aunque cruce la medianoche) */
export const MAX_HORAS_TE = 16;

const redondeoH = (min) => Math.round((min / 60) * 100) / 100;

/**
 * Horas entre entrada y salida, siempre positivas. Si la salida es menor o IGUAL a la entrada, el tiempo extra termina al día siguiente
 * (22:00 → 7:00 = 9 h; 16:00 → 0:00 = 8 h; 7:00 → 7:00 = 24 h, que la captura rechaza por pasar de MAX_HORAS_TE). 0 si falta alguna hora.
 */
export function calcularHoras(entrada, salida) {
  const a = minutos(entrada), b = minutos(salida);
  if (a === null || b === null) return 0;
  return redondeoH(b > a ? b - a : b + 24 * 60 - a);
}

/** ¿Termina al día siguiente? (la hora de fin es menor o igual a la de inicio) */
export function terminaDiaSiguiente(entrada, salida) {
  const a = minutos(entrada), b = minutos(salida);
  return a !== null && b !== null && b <= a;
}

/** Fecha real (AAAA-MM-DD) en que termina el tiempo extra que empieza el `fechaTE` */
export const fechaDeFin = (fechaTE, entrada, salida) => (terminaDiaSiguiente(entrada, salida) ? sumarDias(fechaTE, 1) : fechaTE);

/**
 * "Termina: miércoles 22 oct, 7:00 a. m. (día siguiente)" ('' si falta la fecha o una hora). Con `soloSiCruza` solo lo dice si termina otro día;
 * `prefijo: false` quita el "Termina: " (para las celdas de un Excel).
 */
export function textoTermina(fechaTE, entrada, salida, { soloSiCruza = false, prefijo = true } = {}) {
  if (!fechaTE || minutos(entrada) === null || minutos(salida) === null) return '';
  const cruza = terminaDiaSiguiente(entrada, salida);
  if (soloSiCruza && !cruza) return '';
  return `${prefijo ? 'Termina: ' : ''}${fechaCorta(fechaDeFin(fechaTE, entrada, salida))}, ${formatoHora12(salida)}${cruza ? ' (día siguiente)' : ''}`;
}

/**
 * Las horas repartidas por día calendario: [{ fecha, horas }]. 22:00 → 7:00 del martes = 2 h del martes y 7 h del miércoles.
 * Un fin justo a medianoche (16:00 → 0:00) no deja horas en el día siguiente.
 */
export function tramosPorDia(fechaTE, entrada, salida) {
  const a = minutos(entrada), b = minutos(salida);
  if (!fechaTE || a === null || b === null) return [];
  if (b > a) return [{ fecha: fechaTE, horas: redondeoH(b - a) }];
  return [{ fecha: fechaTE, horas: redondeoH(24 * 60 - a) }, ...(b > 0 ? [{ fecha: sumarDias(fechaTE, 1), horas: redondeoH(b) }] : [])];
}

/**
 * Día de la SALIDA en el transporte. Termina el día siguiente si cruza la medianoche, salvo el fin justo a las 12:00 a. m. (16:00 → 0:00, el turno 2
 * normal): esa salida es el cierre del servicio del día de inicio y sigue en su hoja, igual que siempre.
 */
export function fechaSalidaTransporte(fechaTE, entrada, salida) {
  return minutos(salida) === 0 ? fechaTE : fechaDeFin(fechaTE, entrada, salida);
}

// ── Tipo de tiempo extra: turno extra (viene a la planta) o extensión de turno (ya está en la planta) ──

export const TIPOS_TE = { TURNO_EXTRA: 'turno_extra', EXTENSION: 'extension' };
export const TIPOS_TE_INFO = [
  { value: TIPOS_TE.TURNO_EXTRA, label: 'Turno extra / día extra' },
  { value: TIPOS_TE.EXTENSION, label: 'Extensión de turno' },
];
export const MIN_JUSTIFICACION_RUTAS = 15;
export const esExtension = (t) => t?.tipo === TIPOS_TE.EXTENSION;
export const normalizarTipo = (tipo) => (tipo === TIPOS_TE.EXTENSION ? TIPOS_TE.EXTENSION : TIPOS_TE.TURNO_EXTRA);

/** Horas en que terminan los bloques de horario, en orden (el último, 7:00, es el de la mañana siguiente) */
const SECUENCIA_BLOQUES = ['7:00', '16:00', '19:00', '0:00', '7:00'];

/**
 * Horas de salida posibles de una extensión que EMPIEZA a la hora en que termina el turno normal del empleado: los bloques de salida
 * posteriores que no pasen de MAX_HORAS_TE. 16:00 → 19:00, 0:00, 7:00 · 19:00 → 0:00, 7:00 · 0:00 → 7:00 · 7:00 → 16:00, 19:00 (a 0:00 serían 17 h).
 */
export function salidasPosteriores(inicio) {
  const m = minutos(inicio);
  if (m === null) return [];
  const i = SECUENCIA_BLOQUES.slice(0, 4).findIndex(h => minutos(h) === m);
  return i < 0 ? [] : SECUENCIA_BLOQUES.slice(i + 1).filter(h => calcularHoras(inicio, h) <= MAX_HORAS_TE);
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

/** ¿Lleva transporte de llegada o de salida? */
export const llevaTransporte = (e) => !!(e.transporteLlegada || e.transporteSalida);
/** 'ambos' | 'llegada' | 'salida' | '' */
export const sentidoDe = (e) => (e.transporteLlegada && e.transporteSalida ? 'ambos' : e.transporteLlegada ? 'llegada' : e.transporteSalida ? 'salida' : '');
export const TEXTO_SENTIDO = { ambos: 'llegada y salida', llegada: 'solo llegada', salida: 'solo salida', '': 'sin transporte' };
/** Recalcula `transporte` (el derivado) después de cambiar alguno de los dos sentidos */
export const conTransporte = (e) => ({ ...e, transporte: llevaTransporte(e) });

/**
 * Empleado del editor a partir de un registro del padrón. Si el padrón trae ruta completa y vigente, pide confirmarla.
 * Turno extra: transporte de llegada y de salida marcados. Extensión: solo salida, y la hora en que empieza (fin de su turno normal)
 * se elige a mano (el empleado ya no tiene turno fijo en el padrón).
 */
export function empleadoDesdePadron(emp, ruta, { tipo = TIPOS_TE.TURNO_EXTRA } = {}) {
  const completa = !!(ruta?.rutaId && ruta?.comunidadId && ruta?.puntoReunionId);
  const extension = tipo === TIPOS_TE.EXTENSION;
  return {
    nomina: String(emp.nomina), nombre: emp.nombre ?? '', puesto: emp.puesto ?? '',
    horaEntrada: '', horaSalida: '', alimentos: false, motivoIndex: 0,
    transporteLlegada: !extension, transporteSalida: true, transporte: true,
    rutaId: ruta?.rutaId ?? '', comunidadId: ruta?.comunidadId ?? '', puntoReunionId: ruta?.puntoReunionId ?? '',
    necesitaConfirmar: completa, confirmada: false,
  };
}

/** Documento tiempoExtra/{id}/empleados/{nómina} (solo los campos que permiten las reglas) */
export function empleadoADoc(e) {
  const transporteLlegada = !!(e.transporteLlegada ?? e.transporte);
  const transporteSalida = !!(e.transporteSalida ?? e.transporte);
  const transporte = transporteLlegada || transporteSalida;
  return {
    nombre: e.nombre, puesto: e.puesto ?? '', horaEntrada: e.horaEntrada ?? '', horaSalida: e.horaSalida ?? '',
    horas: calcularHoras(e.horaEntrada, e.horaSalida), requiereAlimentos: !!e.alimentos, requiereTransporte: transporte,
    transporteLlegada: transporte && transporteLlegada, transporteSalida: transporte && transporteSalida,
    rutaId: transporte ? (e.rutaId ?? '') : '', comunidadId: transporte ? (e.comunidadId ?? '') : '', puntoReunionId: transporte ? (e.puntoReunionId ?? '') : '',
    motivoIndex: Number.isInteger(e.motivoIndex) && e.motivoIndex > 0 ? e.motivoIndex : 0,
  };
}

/** Empleado del editor a partir de su documento guardado (la ruta guardada ya se confirmó) */
export function docAEmpleado(nomina, d) {
  // Los documentos anteriores solo traen requiereTransporte: valía para llegada y salida
  const antiguo = d.requiereTransporte !== false;
  const transporteLlegada = d.transporteLlegada ?? antiguo;
  const transporteSalida = d.transporteSalida ?? antiguo;
  return {
    nomina: String(nomina), nombre: d.nombre ?? '', puesto: d.puesto ?? '',
    horaEntrada: d.horaEntrada ?? '', horaSalida: d.horaSalida ?? '', alimentos: !!d.requiereAlimentos,
    transporteLlegada, transporteSalida, transporte: transporteLlegada || transporteSalida,
    rutaId: d.rutaId ?? '', comunidadId: d.comunidadId ?? '', puntoReunionId: d.puntoReunionId ?? '', necesitaConfirmar: false, confirmada: true,
    motivoIndex: Number.isInteger(d.motivoIndex) ? d.motivoIndex : 0,
  };
}

/** ¿La ruta del empleado ya está lista? (no pide transporte, o tiene ruta/comunidad/punto y, si venía del padrón, se confirmó) */
export const transporteCompleto = (e) => !e.transporte || (!!e.rutaId && !!e.comunidadId && !!e.puntoReunionId && (!e.necesitaConfirmar || e.confirmada));

/** Totales de la solicitud (el "resumen" que se guarda en la solicitud) */
/**
 * Rutas distintas de los empleados que llevan transporte (llegada o salida) y su desglose: por cada ruta, cuántos empleados y cuántos
 * de llegada y de salida. Cada ruta adicional representa un costo extra para la planta. `nombreRuta`: id → nombre.
 * @returns {{ rutasDistintas: number, desglose: {rutaId, nombre, empleados, llegada, salida}[] }}
 */
export function resumenRutas(empleados, nombreRuta = (id) => id) {
  const mapa = new Map();
  for (const e of empleados) {
    if (!e.transporte || !e.rutaId) continue;
    const g = mapa.get(e.rutaId) ?? { rutaId: e.rutaId, nombre: nombreRuta(e.rutaId) || e.rutaId, empleados: 0, llegada: 0, salida: 0 };
    g.empleados++;
    if (e.transporteLlegada ?? e.transporte) g.llegada++;
    if (e.transporteSalida ?? e.transporte) g.salida++;
    mapa.set(e.rutaId, g);
  }
  const desglose = [...mapa.values()].sort((a, b) => b.empleados - a.empleados || String(a.nombre).localeCompare(String(b.nombre), 'es'));
  return { rutasDistintas: desglose.length, desglose };
}

/** "Esta solicitud usa 3 rutas: LA LIRA (2), LOS HÉROES (1), SAN CLEMENTE (1)" ('' si ninguna lleva transporte) */
export function textoRutas(desglose = []) {
  if (!desglose.length) return '';
  return `Esta solicitud usa ${desglose.length} ${desglose.length === 1 ? 'ruta' : 'rutas'}: ${desglose.map(g => `${g.nombre} (${g.empleados})`).join(', ')}`;
}

/**
 * Campos que se guardan en la solicitud: motivos (con el nombre copiado) y motivo (el nombre del primero, para lo que lee solo el texto),
 * tipo, rutasDistintas, desgloseRutas y la justificación (solo si hay más de una ruta)
 */
export function datosTE({ tipo, empleados, justificacionRutas = '', nombreRuta, motivos = [], catalogoMotivos = [] }) {
  const { rutasDistintas, desglose } = resumenRutas(empleados, nombreRuta);
  const guardados = motivosParaGuardar(motivos, catalogoMotivos);
  return {
    motivo: guardados[0]?.nombre ?? '', motivos: guardados,
    tipo: normalizarTipo(tipo), rutasDistintas, desgloseRutas: desglose, justificacionRutas: rutasDistintas > 1 ? String(justificacionRutas).trim() : '',
  };
}

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
 * @param {object} p { fechaTE, motivos (los del editor), catalogoMotivos, comentario, empleados, hoy ('AAAA-MM-DD'), ocupados: Map nómina → { folio, estatus } }
 */
export function problemasDeEnvio({ areaId, fechaTE, motivos = [], catalogoMotivos = [], comentario, empleados, hoy, ocupados = new Map(), tipo = TIPOS_TE.TURNO_EXTRA, justificacionRutas = '' }) {
  const p = [];
  const error = (mensaje, nomina) => p.push({ nivel: 'error', mensaje, nomina });
  if (!areaId) error('Elige el área.');
  if (!fechaTE) error('Elige la fecha del tiempo extra.');
  else if (fechaTE < hoy) error('La fecha debe ser hoy o futura.');
  for (const m of problemasDeMotivos(motivos, catalogoMotivos)) error(m.mensaje);
  if (String(comentario ?? '').trim().length < MIN_COMENTARIO_TE) error(`El comentario es obligatorio (al menos ${MIN_COMENTARIO_TE} caracteres).`);
  if (empleados.length === 0) error('Agrega al menos un empleado.');
  if (empleados.length > MAX_PASAJEROS) error(`Máximo ${MAX_PASAJEROS} empleados por solicitud; divídela en dos.`);
  const vistos = new Set();
  for (const e of empleados) {
    if (vistos.has(e.nomina)) error(`${e.nombre} está repetido.`, e.nomina);
    vistos.add(e.nomina);
    if (tipo === TIPOS_TE.EXTENSION) {
      // La extensión empieza al terminar su turno normal y se queda hasta un bloque de salida posterior
      if (!e.horaEntrada) error(`${e.nombre}: falta la hora en que termina su turno.`, e.nomina);
      else if (!e.horaSalida) error(`${e.nombre}: elige hasta qué hora se queda.`, e.nomina);
      else if (!salidasPosteriores(e.horaEntrada).some(h => minutos(h) === minutos(e.horaSalida))) error(`${e.nombre}: la salida debe ser posterior al fin de su turno.`, e.nomina);
    } else if (!e.horaEntrada || !e.horaSalida) error(`${e.nombre}: falta el horario.`, e.nomina);
    else if (calcularHoras(e.horaEntrada, e.horaSalida) > MAX_HORAS_TE) {
      error(`${e.nombre}: el tiempo extra duraría ${calcularHoras(e.horaEntrada, e.horaSalida)} h${terminaDiaSiguiente(e.horaEntrada, e.horaSalida) ? ' (termina al día siguiente)' : ''}; el máximo es ${MAX_HORAS_TE} h.`, e.nomina);
    }
    if (!transporteCompleto(e)) {
      error(e.transporte && e.rutaId && e.comunidadId && e.puntoReunionId
        ? `${e.nombre}: confirma la ruta precargada.` : `${e.nombre}: completa ruta, comunidad y punto de reunión.`, e.nomina);
    }
  }
  if (resumenRutas(empleados).rutasDistintas > 1 && String(justificacionRutas).trim().length < MIN_JUSTIFICACION_RUTAS) {
    error(`Explica por qué se necesita más de una ruta (al menos ${MIN_JUSTIFICACION_RUTAS} caracteres).`);
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
    // Compatibilidad: { transporte: true|false } marca o quita los dos sentidos
    if (typeof cambios.transporte === 'boolean' && cambios.transporteLlegada === undefined && cambios.transporteSalida === undefined) {
      nuevo.transporteLlegada = cambios.transporte; nuevo.transporteSalida = cambios.transporte;
    }
    if ('transporteLlegada' in cambios || 'transporteSalida' in cambios || 'transporte' in cambios) nuevo.transporte = llevaTransporte(nuevo);
    if (!nuevo.transporte) Object.assign(nuevo, { necesitaConfirmar: false, confirmada: false });
    return nuevo;
  });
}

/**
 * Estatus con el que se envía: un Aut. 2 vigente autoriza lo que él mismo captura (es el nivel más alto) y queda 'autorizada' con su firma de
 * nivel 2; el Aut. 1 vigente de esa área (o un área sin participaTE) va directo a nivel 2 (el Aut. 1 no autoriza lo suyo); el resto, a nivel 1.
 */
export const estatusAlEnviar = ({ esAut1DeLaArea, areaParticipa, esAut2 = false }) =>
  (esAut2 ? 'autorizada' : !areaParticipa || esAut1DeLaArea ? 'pendiente_aut2' : 'pendiente_aut1');

/** Comentario de la firma de nivel 2 cuando un Aut. 2 captura y envía su propia solicitud (las reglas lo exigen tal cual) */
export const COMENTARIO_AUT2_PROPIA = 'Capturada y autorizada por Aut. 2';

/** Nivel en el que va una solicitud, en texto */
export function nivelEnTexto(estatus) {
  return { borrador: 'Sin enviar', pendiente_aut1: 'Autorización 1', pendiente_aut2: 'Autorización 2', autorizada: 'Autorizada', devuelta: 'Devuelta', procesada: 'Confirmada por RH', cancelada: 'Cancelada' }[estatus] ?? estatus;
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

/**
 * Turnos de las rutas ('1' | '2' | '3') que tiene un tiempo extra, según la hora de ENTRADA de cada bloque de su resumen
 * (resumen.porBloque: { "7:00 → 16:00": 3, … }). Sin resumen o sin horarios devuelve [].
 */
export function turnosDeTE(t) {
  const bloques = Object.keys(t?.resumen?.porBloque ?? {});
  return [...new Set(bloques.map(b => turnoPorEntrada(String(b).split('→')[0].trim())).filter(Boolean))].sort();
}

/** Filtros de la bandeja y de la consulta: área, estatus, rango de fecha del TE, turno ('1' | '2' | '3'), motivo (id del catálogo) y texto del solicitante */
export function filtrarSolicitudes(lista, { areaId = '', estatus = '', desde = '', hasta = '', solicitante = '', turno = '', motivoId = '' } = {}, catalogoMotivos = []) {
  const q = String(solicitante).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  return lista.filter(t => (!areaId || t.areaId === areaId) && (!estatus || t.estatus === estatus) && (!turno || turnosDeTE(t).includes(turno)) && tieneMotivo(t, motivoId, catalogoMotivos)
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
  const ruta = [n(rutas, e.rutaId), n(comunidades, e.comunidadId), n(puntos, e.puntoReunionId)].filter(Boolean).join(' · ') || 'Sin ruta';
  const sentido = sentidoDe(e);
  return sentido && sentido !== 'ambos' ? `${ruta} (${TEXTO_SENTIDO[sentido]})` : ruta;
}

// ── Recepción de RH y transporte ──────────────────────────────────────────

/** Nivel con el que RH devuelve desde "Por enviar al proveedor" (los niveles 1 y 2 son de los autorizadores) */
export const NIVEL_RECEPCION = 3;
export const MIN_MOTIVO_CANCELACION_RH = 10;
/** Estatus que RH descarga en el Excel de tiempo extra: lo autorizado y lo ya confirmado por RH ("procesada") */
export const ESTATUS_DESCARGA = ['autorizada', 'procesada'];
/** "Incluir" de la descarga: todas las autorizadas (por defecto) o solo las que RH ya confirmó */
export const INCLUIR_DESCARGA = [
  { id: 'autorizadas', label: 'Todas las autorizadas', estatus: ESTATUS_DESCARGA },
  { id: 'confirmadas', label: 'Solo confirmadas por RH', estatus: ['procesada'] },
];
export const estatusDeIncluir = (id) => (INCLUIR_DESCARGA.find(i => i.id === id) ?? INCLUIR_DESCARGA[0]).estatus;
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

export const YA_EN_PLANTA = 'YA EN PLANTA';
export const SIN_SALIDA = 'NO REQUIERE';

/** Turno de las rutas al que pertenece un fin de turno (el turno que termina a esa hora): 16:00 → 1, 0:00 y 19:00 → 2, 7:00 → 3 */
export function turnoPorFin(hora) {
  const m = minutos(hora);
  if (m === null) return '';
  if (m > 0 && m <= 7 * 60) return '3';
  if (m > 7 * 60 && m <= 16 * 60) return '1';
  return '2';
}

/**
 * Pasajero del transporte (solicitudes/{id}/pasajeros/{nómina}) a partir de un empleado del tiempo extra con transporte.
 * Extensión de turno (ya está en la planta): va en la hoja de su turno normal, con ENTRADA "YA EN PLANTA" si solo pide salida y SALIDA su
 * hora extendida. Turno extra con solo llegada: SALIDA "NO REQUIERE".
 * Fechas: la LLEGADA es el día de inicio (fechaLlegada = fechaTE) y la SALIDA, el día en que termina (fechaSalida: el siguiente si cruza la medianoche);
 * turnoSalida es el turno de esa salida (el que termina a esa hora). El Formato de rutas pone cada viaje en su día (fechasDePasajero).
 */
export function pasajeroDeEmpleado(e, te) {
  const sentido = sentidoDe(e) || 'ambos';
  return {
    nomina: String(e.nomina), nombre: e.nombre, puesto: e.puesto ?? '',
    areaId: te.areaId ?? '', areaNombre: te.areaNombre ?? '', sentido,
    turno: esExtension(te) ? turnoPorFin(e.horaEntrada) : turnoPorEntrada(e.horaEntrada),
    fechaLlegada: te.fechaTE ?? '', fechaSalida: te.fechaTE ? fechaSalidaTransporte(te.fechaTE, e.horaEntrada, e.horaSalida) : '', turnoSalida: turnoPorFin(e.horaSalida),
    horaEntrada: sentido === 'salida' ? YA_EN_PLANTA : horaFormatoRutas(e.horaEntrada),
    horaSalida: sentido === 'llegada' ? SIN_SALIDA : horaFormatoRutas(e.horaSalida),
    alimentos: !!e.alimentos, rutaId: e.rutaId ?? '', comunidadId: e.comunidadId ?? '', puntoReunionId: e.puntoReunionId ?? '',
  };
}

/**
 * Los viajes de un pasajero y el día de cada uno: [{ fecha, viaje: 'llegada'|'salida'|'ambos', turno }]. Normalmente es uno solo (el día del servicio);
 * si la salida cae otro día (cruza la medianoche) y también viene a la planta, son dos: la llegada ese día y la salida al siguiente.
 * Los pasajeros anteriores (sin fechaSalida) y los que no cruzan quedan en el día del servicio, como siempre.
 */
export function fechasDePasajero(p, fechaServicio) {
  const sentido = p.sentido ?? 'ambos';
  const salida = p.fechaSalida;
  if (!salida || salida === fechaServicio || sentido === 'llegada') return [{ fecha: fechaServicio, viaje: sentido, turno: p.turno }];
  if (sentido === 'salida') return [{ fecha: salida, viaje: 'salida', turno: p.turnoSalida || p.turno }];
  return [{ fecha: fechaServicio, viaje: 'llegada', turno: p.turno }, { fecha: salida, viaje: 'salida', turno: p.turnoSalida || p.turno }];
}

/** Cuántos viajes hay cada día: { '2026-10-21': 3, '2026-10-22': 2 } (se guarda en la solicitud de transporte para encontrarla por cualquiera de sus días) */
export function conteoFechas(pasajeros, fechaServicio) {
  const conteo = {};
  for (const p of pasajeros) for (const v of fechasDePasajero(p, fechaServicio)) conteo[v.fecha] = (conteo[v.fecha] ?? 0) + 1;
  return conteo;
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
    ...resumenPasajeros(pasajeros), conteoFechas: conteoFechas(pasajeros, te.fechaTE),
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

/** Lo que ve el solicitante de una solicitud ya confirmada por RH */
export function textoRecibida(t) {
  return (t.resumen?.totalTransporte ?? 0) > 0 ? 'Confirmada por RH · transporte solicitado' : 'Confirmada por RH · sin transporte';
}

/** Nombre de la pantalla y del paso donde RH confirma lo autorizado y se genera el transporte (antes "Recepción") */
export const NOMBRE_POR_ENVIAR = 'Por enviar al proveedor';

/**
 * Mensaje al confirmar: dónde quedó el transporte (o que no hay nada que enviar). `fecha` es la del tiempo extra (AAAA-MM-DD); `fechas` (opcional) son los
 * días con viajes (conteoFechas): si hay salidas otro día, lo dice.
 */
export function mensajeConfirmada({ fecha, pasajeros, fechas = [] }) {
  if (!(pasajeros > 0)) return 'Listo. Se confirmó sin transporte: no hay nada que enviar al proveedor.';
  const otros = [...new Set(fechas)].filter(f => f !== fecha).sort();
  const aparte = otros.length ? ` Las salidas del ${otros.map(f => fechaConDia(f)).join(' y del ')} van en el formato de ese día.` : '';
  return `Listo. El transporte de ${fechaConDia(fecha)} ya aparece en Solicitudes de transporte y se incluirá en el Formato de rutas.${aparte}`;
}

/** Texto del botón de confirmar: si nadie lleva transporte, lo dice */
export const textoConfirmar = (t) => ((t.resumen?.totalTransporte ?? 0) > 0 ? 'Confirmar y generar transporte' : 'Confirmar (sin transporte)');

/** "Autorización 2" / "Recursos Humanos (recepción)" */
export const quienDevolvio = (nivel) => (Number(nivel) === NIVEL_RECEPCION ? 'Recursos Humanos (recepción)' : `Autorización ${nivel}`);

// ── Periodos de la descarga de tiempo extra ───────────────────────────────

export const PERIODOS_DESCARGA = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'ayer', label: 'Ayer' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'anterior', label: 'Semana anterior' },
  { id: 'mes', label: 'Este mes' },
  { id: 'rango', label: 'Personalizado' },
];

/**
 * Rango { desde, hasta } ('AAAA-MM-DD') de un periodo de la descarga. `rango` (personalizado) devuelve null: se captura a mano.
 * La semana va de lunes a domingo; el mes, del día 1 al último.
 */
export function rangoDePeriodo(periodo, hoy) {
  if (periodo === 'hoy') return { desde: hoy, hasta: hoy };
  if (periodo === 'ayer') { const ayer = sumarDias(hoy, -1); return { desde: ayer, hasta: ayer }; }
  if (periodo === 'semana') return rangoSemana(hoy, 0);
  if (periodo === 'anterior') return rangoSemana(hoy, -1);
  if (periodo === 'mes') return rangoMes(hoy);
  return null;
}
