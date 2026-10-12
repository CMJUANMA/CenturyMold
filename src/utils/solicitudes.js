import { ymd } from './fechas';
import { canonizarPuesto } from './puestos';

/** Máximo de pasajeros por solicitud (el batch/transacción de Firestore admite 500 operaciones). */
export const MAX_PASAJEROS = 150;
export const MSG_MAX_PASAJEROS = `Máximo ${MAX_PASAJEROS} pasajeros por solicitud; divídela en dos.`;

/**
 * Resumen que se guarda en el documento de la solicitud para no leer la subcolección
 * pasajeros al listar: total, total con alimentos y conteo por turno y por puesto.
 */
export function resumenPasajeros(pasajeros) {
  const conteoTurnos = {};
  const conteoPuestos = {};
  let totalAlimentos = 0;
  for (const p of pasajeros) {
    if (p.alimentos) totalAlimentos++;
    const turno = String(p.turno ?? '').trim();
    if (turno) conteoTurnos[turno] = (conteoTurnos[turno] || 0) + 1;
    const puesto = String(p.puesto ?? '').trim();
    if (puesto) conteoPuestos[puesto] = (conteoPuestos[puesto] || 0) + 1;
  }
  return { totalPasajeros: pasajeros.length, totalAlimentos, conteoTurnos, conteoPuestos };
}

/** {"1": 12, "2": 8} → "1, 2"; '—' si no hay resumen (solicitudes viejas) */
export function textoConteo(conteo) {
  const claves = conteo && typeof conteo === 'object' ? Object.keys(conteo) : [];
  return claves.length ? claves.sort((a, b) => a.localeCompare(b, 'es', { numeric: true })).join(', ') : '—';
}

// ── Formulario de solicitud (compartido por Nueva y Editar) ─────────────────

export const HORAS_ENTRADA = ['7:00AM', '4:00PM', '7:00PM', '12:00AM'];
export const HORAS_SALIDA  = ['4:00PM', '7:00PM', '12:00AM', '7:00AM'];
export const TURNOS = [
  { value: '1', label: 'Turno 1' },
  { value: '2', label: 'Turno 2' },
  { value: '3', label: 'Turno 3' },
  { value: 'TE', label: 'Tiempo Extra' },
];

/** Fecha mínima de servicio = hoy (YYYY-MM-DD, local, sin desfase de zona horaria) */
export const fechaMinima = () => ymd();

/** Pasajero en blanco del formulario */
export const pasajeroVacio = () => ({
  id: Date.now() + Math.random(),
  searchQuery: '',
  showResults: false,
  empleadoSeleccionado: null,
  puesto: '',
  turno: '',
  horaEntrada: '',
  horaSalida: '',
  alimentos: false,
  rutaId: '',
  comunidadId: '',
  puntoReunionId: '',
  needsConfirmation: false,
  isConfirmed: false,
});

/** Mensaje del primer problema de validación del formulario, o null si todo está bien */
export function validarSolicitud({ fechaServicio, pasajeros, comentario = '', comentarioObligatorio = false }) {
  if (!fechaServicio) return 'Selecciona la fecha del servicio.';
  if (comentarioObligatorio && !comentario.trim()) return 'Debes ingresar un comentario sobre la edición.';
  const incompleto = pasajeros.some(p =>
    !p.empleadoSeleccionado || !p.puesto || !p.turno || !p.horaEntrada || !p.horaSalida ||
    !p.rutaId || !p.comunidadId || !p.puntoReunionId || (p.needsConfirmation && !p.isConfirmed)
  );
  if (incompleto) return 'Completa todos los campos de cada pasajero.';
  if (pasajeros.length > MAX_PASAJEROS) return MSG_MAX_PASAJEROS;
  return null;
}

/** Documento de pasajero (subcolección) a partir de un pasajero del formulario */
export function armarPasajeroDoc(p, puestos) {
  return {
    nomina:         p.empleadoSeleccionado.nomina,
    nombre:         p.empleadoSeleccionado.nombre,
    puesto:         canonizarPuesto(p.puesto, puestos),
    turno:          p.turno          || '',
    horaEntrada:    p.horaEntrada    || '',
    horaSalida:     p.horaSalida     || '',
    alimentos:      !!p.alimentos,
    rutaId:         p.rutaId         || '',
    comunidadId:    p.comunidadId    || '',
    puntoReunionId: p.puntoReunionId || '',
  };
}

/** Resumen (totales y conteos) de los pasajeros del formulario, con los puestos ya canonizados */
export function resumenDeFormulario(pasajeros, puestos) {
  return resumenPasajeros(pasajeros.map(p => ({ turno: p.turno, puesto: canonizarPuesto(p.puesto, puestos), alimentos: p.alimentos })));
}

/**
 * Empleados cuya ruta confirmada cambió respecto al padrón: { [empleadoId]: { rutaId, comunidadId, puntoReunionId } }
 * Se guarda en el empleado para precargarla la próxima vez.
 */
export function cambiosPadron(pasajeros) {
  const cambios = {};
  for (const p of pasajeros) {
    const emp = p.empleadoSeleccionado;
    if (emp?.id && (emp.rutaId !== p.rutaId || emp.comunidadId !== p.comunidadId || emp.puntoReunionId !== p.puntoReunionId)) {
      cambios[emp.id] = { rutaId: p.rutaId || '', comunidadId: p.comunidadId || '', puntoReunionId: p.puntoReunionId || '' };
    }
  }
  return cambios;
}
