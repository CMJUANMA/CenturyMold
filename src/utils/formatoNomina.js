/**
 * formatoNomina.js — «Reportes de nómina»: la lógica pura (se prueba en Node) del FORMATO DE AUTORIZACIÓN DE TIEMPO EXTRA semanal por área.
 *   · Semana ISO 8601 (lunes a domingo): "Semana 43 · 19–25 oct 2026", la última semana completa, semana anterior/siguiente y rango libre.
 *   · Solo cuenta el tiempo extra AUTORIZADO por Aut. 2 (autorizada o procesada); las pendientes y devueltas de esa semana solo se avisan.
 *   · La tabla por empleado (horas por día, subtotal y motivo) sale de las solicitudes y NO las modifica: los ajustes de Nóminas (quitar,
 *     reemplazar, corregir horas) viven aparte, como una lista de cambios que se aplica sobre lo autorizado (ajustesNomina/{semana}_{areaId}).
 * Sin Firebase ni navegador. El Excel está en exportarFormatoNomina.js; lo que habla con Firestore, en ajustesNominaDb.js.
 */
import { fechaLocal, rangoSemana, sumarDias, ymd } from './fechas.js';
import { ESTATUS_DESCARGA, calcularHoras, motivoTexto } from './tiempoExtra.js';

// ── Constantes del formato en papel (editables aquí) ───────────────────────────────────────────

/** Las casillas de Área/Depto del formato, en su orden */
export const CASILLAS_AREA = ['Producción/Manufactura', 'Taller Moldes', 'Mantenimiento', 'Materiales/Logística', 'Calidad', 'Ingeniería', 'Recursos Humanos', 'Otro'];

/** Área de la app (id) → casilla del formato. Lo que no esté aquí se marca como «Otro» */
export const CASILLA_POR_AREA = {
  produccion: 'Producción/Manufactura',
  moldes: 'Taller Moldes',
  mantenimiento: 'Mantenimiento',
  almacen: 'Materiales/Logística',
  calidad: 'Calidad',
  administrativo: 'Otro',
};
export const casillaDeArea = (areaId) => CASILLA_POR_AREA[areaId] ?? 'Otro';

/** Pie del formato en papel (código, revisión y fecha de revisión): constantes editables */
export const PIE_FORMATO = { codigo: 'CM-FRH-??', revision: 'REV-00', fechaRev: 'Fecha de Rev: 28 Oct 2021' };

export const TITULO_FORMATO = 'FORMATO DE AUTORIZACIÓN DE TIEMPO EXTRA';

/** Firmas al pie, en orden. La línea y la etiqueta se dibujan en el Excel */
export const FIRMAS_FORMATO = [
  '(1) Supervisor / Gte. Área',
  '(2) Nombre & Firma de Program Manager**  (si aplica)',
  '(3) Gerente de Planta / Operaciones',
  '(4) Gte Administrativo / RRHH*',
];
export const NOTAS_FORMATO = [
  '* El área de RRHH y/o Gerencia Administrativa deberá asegurarse que en el llenado del presente formato cumpla con todo lo requerido antes de firmar, de lo contrario deberá rechazarse para su correcto llenado y cumplimiento de todas las firmas según el orden.',
  '** En caso de que el tiempo extra mencione hacer cargo referenciado a un número de PO o TB, DEBE tener la firma de autorización del Program Manager responsable de la cuenta de cargo.',
];

/** Empleados por hoja impresa: con hasta esta cantidad el formato cabe en una sola hoja carta */
export const FILAS_POR_PAGINA = 15;

export const MIN_MOTIVO_AJUSTE = 3;
export const MAX_MOTIVO_AJUSTE = 120;

export const DIAS_LARGO = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const redondeo = (n) => Math.round(n * 100) / 100;

// ── Semana ISO 8601 ────────────────────────────────────────────────────────────────────────────

/** Semana ISO de una fecha: { clave:'2026-43', anio, semana, desde (lunes), hasta (domingo), dias:[7 fechas] } */
export function semanaDe(fecha) {
  const { desde, hasta } = rangoSemana(fecha);
  const [y, m, d] = desde.split('-').map(Number);
  // El jueves de la semana decide a qué año ISO pertenece
  const jueves = new Date(Date.UTC(y, m - 1, d + 3));
  const anio = jueves.getUTCFullYear();
  const diasDelAnio = Math.round((jueves - Date.UTC(anio, 0, 1)) / 86400000);
  const semana = Math.floor(diasDelAnio / 7) + 1;
  return { clave: `${anio}-${String(semana).padStart(2, '0')}`, anio, semana, desde, hasta, dias: Array.from({ length: 7 }, (_, i) => sumarDias(desde, i)), tipo: 'semana' };
}

/** "2026-43" → su semana (null si no es una clave válida) */
export function semanaDeClave(clave) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(clave ?? ''));
  if (!m) return null;
  const anio = Number(m[1]), n = Number(m[2]);
  if (n < 1 || n > 53) return null;
  // La semana 1 es la que trae el 4 de enero
  const lunes1 = rangoSemana(`${anio}-01-04`).desde;
  const s = semanaDe(sumarDias(lunes1, (n - 1) * 7));
  return s.clave === clave ? s : null;
}

export const moverSemana = (semana, delta) => semanaDe(sumarDias(semana.desde, 7 * delta));

/** La última semana COMPLETA: la anterior a la de `hoy` (la de hoy todavía no termina) */
export const ultimaSemanaCompleta = (hoy = ymd()) => moverSemana(semanaDe(hoy), -1);

/** "19–25 oct 2026", "28 sep–4 oct 2026" o "29 dic 2025–4 ene 2026" */
export function textoDias(desde, hasta) {
  const a = fechaLocal(desde), b = fechaLocal(hasta);
  if (!a || !b) return '';
  const mes = (d) => MESES_CORTO[d.getMonth()];
  if (desde === hasta) return `${a.getDate()} ${mes(a)} ${a.getFullYear()}`;
  if (a.getFullYear() !== b.getFullYear()) return `${a.getDate()} ${mes(a)} ${a.getFullYear()}–${b.getDate()} ${mes(b)} ${b.getFullYear()}`;
  if (a.getMonth() !== b.getMonth()) return `${a.getDate()} ${mes(a)}–${b.getDate()} ${mes(b)} ${b.getFullYear()}`;
  return `${a.getDate()}–${b.getDate()} ${mes(b)} ${b.getFullYear()}`;
}

/** "Semana 43 · 19–25 oct 2026" (un rango libre: "19–23 oct 2026") */
export const etiquetaPeriodo = (p) => (p.tipo === 'semana' ? `Semana ${p.semana} · ${textoDias(p.desde, p.hasta)}` : textoDias(p.desde, p.hasta));

/**
 * Rango libre: hasta 7 días dentro de una misma semana ISO o a caballo entre dos. Las 7 columnas son los días de la semana
 * (Lun…Dom) y cada una trae la fecha del rango que le toca (o null). Devuelve null si el rango no sirve.
 */
export function periodoLibre(desde, hasta) {
  if (!desde || !hasta || desde > hasta) return null;
  const dias = Array(7).fill(null);
  for (let d = desde, n = 0; d <= hasta; d = sumarDias(d, 1), n++) {
    if (n > 6) return null;
    dias[(fechaLocal(d).getDay() + 6) % 7] = d;
  }
  return { clave: `r${desde.replaceAll('-', '')}-${hasta.replaceAll('-', '')}`, desde, hasta, dias, tipo: 'rango', anio: Number(desde.slice(0, 4)), semana: null };
}

/** Nombre del documento de ajustes: "2026-43_moldes" */
export const idAjuste = (periodo, areaId) => `${periodo.clave}_${areaId}`;

// ── Qué solicitudes cuentan ────────────────────────────────────────────────────────────────────

const enPeriodo = (t, p) => !!t.fechaTE && t.fechaTE >= p.desde && t.fechaTE <= p.hasta && p.dias.includes(t.fechaTE);

/** Solo lo autorizado por Aut. 2 (autorizada o procesada) cuya fecha de tiempo extra cae en el periodo */
export const autorizadasDelPeriodo = (planta, periodo) => planta.filter(t => ESTATUS_DESCARGA.includes(t.estatus) && enPeriodo(t, periodo));

const PENDIENTES = ['pendiente_aut1', 'pendiente_aut2', 'devuelta'];

/**
 * Lo que aún no está autorizado en ese periodo (pendientes y devueltas): cuántas solicitudes y de qué áreas, para avisar.
 * @returns {{ total:number, porArea: {areaId, nombre, pendientes, devueltas}[] }}
 */
export function pendientesDelPeriodo(planta, periodo, nombres = new Map()) {
  const grupos = new Map();
  for (const t of planta) {
    if (!PENDIENTES.includes(t.estatus) || !enPeriodo(t, periodo)) continue;
    const g = grupos.get(t.areaId) ?? { areaId: t.areaId, nombre: nombres.get(t.areaId) ?? t.areaNombre ?? t.areaId, pendientes: 0, devueltas: 0 };
    if (t.estatus === 'devuelta') g.devueltas++; else g.pendientes++;
    grupos.set(t.areaId, g);
  }
  const porArea = [...grupos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return { total: porArea.reduce((n, g) => n + g.pendientes + g.devueltas, 0), porArea };
}

// ── La tabla por empleado ──────────────────────────────────────────────────────────────────────

/**
 * Lo autorizado, un renglón por empleado: horas por día (suma si tiene varias solicitudes el mismo día) y los motivos de cada día.
 * @param {object[]} solicitudes  de UN área, con `empleados` (docAEmpleado)
 * @param {{dias: (string|null)[]}} periodo
 */
export function filasAutorizadas(solicitudes, periodo) {
  const filas = new Map();
  for (const t of solicitudes) {
    if (!periodo.dias.includes(t.fechaTE)) continue;
    const motivo = motivoTexto(t);
    for (const e of t.empleados ?? []) {
      const clave = String(e.nomina);
      const f = filas.get(clave) ?? { clave, nomina: clave, nombre: e.nombre ?? '', puesto: e.puesto ?? '', horas: {}, motivos: {} };
      const h = calcularHoras(e.horaEntrada, e.horaSalida);
      f.horas[t.fechaTE] = redondeo((f.horas[t.fechaTE] ?? 0) + h);
      if (motivo && !(f.motivos[t.fechaTE] ?? []).includes(motivo)) f.motivos[t.fechaTE] = [...(f.motivos[t.fechaTE] ?? []), motivo];
      filas.set(clave, f);
    }
  }
  return [...filas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.nomina.localeCompare(b.nomina));
}

export const sumaHoras = (horas) => redondeo(Object.values(horas ?? {}).reduce((a, h) => a + (Number(h) || 0), 0));

// ── Ajustes de Nóminas ─────────────────────────────────────────────────────────────────────────

export const TIPOS_CAMBIO = { QUITAR: 'quitar', REEMPLAZAR: 'reemplazar', HORAS: 'horas' };

/** Un cambio del historial de ajustes. `clave` = la nómina del renglón tal como venía autorizada (no cambia aunque se reemplace) */
export const cambioQuitar = (fila, motivo) => ({ tipo: TIPOS_CAMBIO.QUITAR, clave: fila.clave, nomina: fila.nomina, nombre: fila.nombre, motivo: String(motivo).trim() });
export const cambioReemplazar = (fila, por, motivo) => ({
  tipo: TIPOS_CAMBIO.REEMPLAZAR, clave: fila.clave, de: { nomina: fila.nomina, nombre: fila.nombre },
  por: { nomina: String(por.nomina), nombre: por.nombre ?? '', puesto: por.puesto ?? '' }, motivo: String(motivo).trim(),
});
export const cambioHoras = (fila, dia, horas, motivo) => ({
  tipo: TIPOS_CAMBIO.HORAS, clave: fila.clave, nomina: fila.nomina, nombre: fila.nombre, dia, antes: Number(fila.horas?.[dia] ?? 0), horas: redondeo(Number(horas)), motivo: String(motivo).trim(),
});

/** ¿Qué falta para aceptar este motivo corto? (null = está bien) */
export function problemaMotivo(motivo) {
  const t = String(motivo ?? '').trim();
  if (t.length < MIN_MOTIVO_AJUSTE) return `Escribe el motivo del cambio (mínimo ${MIN_MOTIVO_AJUSTE} letras).`;
  if (t.length > MAX_MOTIVO_AJUSTE) return `El motivo es muy largo (máximo ${MAX_MOTIVO_AJUSTE} letras).`;
  return null;
}

/** Horas válidas para un día: 0 a 24, con a lo más dos decimales */
export const horasValidas = (h) => Number.isFinite(Number(h)) && h !== '' && Number(h) >= 0 && Number(h) <= 24 && Math.abs(Number(h) * 100 - Math.round(Number(h) * 100)) < 1e-6;

/**
 * Aplica los cambios (en orden) sobre lo autorizado. Cada renglón conserva lo autorizado en `original`, trae `horas` ya ajustadas,
 * y marca `quitado`, `reemplazoDe` y los `editados` (días corregidos). El subtotal y el motivo del renglón salen ya calculados.
 */
export function aplicarCambios(base, cambios = [], periodo) {
  const filas = base.map(f => ({
    ...f, horas: { ...f.horas }, original: { ...f.horas }, quitado: false, reemplazoDe: null, editados: [],
  }));
  for (const c of cambios ?? []) {
    const f = filas.find(x => x.clave === c.clave);
    if (!f) continue;
    if (c.tipo === TIPOS_CAMBIO.QUITAR) f.quitado = true;
    else if (c.tipo === TIPOS_CAMBIO.REEMPLAZAR) {
      f.reemplazoDe = f.reemplazoDe ?? { nomina: f.nomina, nombre: f.nombre };
      f.nomina = String(c.por.nomina); f.nombre = c.por.nombre ?? ''; f.puesto = c.por.puesto ?? '';
    } else if (c.tipo === TIPOS_CAMBIO.HORAS) {
      if (Number(c.horas) > 0) f.horas[c.dia] = redondeo(Number(c.horas)); else delete f.horas[c.dia];
      if (!f.editados.includes(c.dia)) f.editados.push(c.dia);
    }
  }
  return filas.map(f => ({ ...f, subtotal: sumaHoras(f.horas), subtotalOriginal: sumaHoras(f.original), motivo: motivoDeFila(f, periodo) }));
}

/** ¿El renglón cambió respecto a lo autorizado? */
export const fueAjustada = (f) => f.quitado || !!f.reemplazoDe || f.editados.length > 0;

/**
 * Motivo del renglón para el formato: el de la solicitud; si en la semana son distintos, "Sáb: …; Dom: …".
 * Un día corregido sin solicitud ese día usa el motivo de cualquiera de los otros días.
 */
export function motivoDeFila(f, periodo) {
  const porDia = [];
  (periodo?.dias ?? []).forEach((d, i) => {
    if (!d || !(f.horas?.[d] > 0)) return;
    porDia.push([i, (f.motivos?.[d] ?? []).join(' / ')]);
  });
  const conMotivo = porDia.filter(([, m]) => m);
  const distintos = [...new Set(conMotivo.map(([, m]) => m))];
  if (distintos.length === 0) return '';
  if (distintos.length === 1) return distintos[0];
  return conMotivo.map(([i, m]) => `${DIAS_CORTO[i]}: ${m}`).join('; ');
}

/** Los renglones que van al formato: sin los quitados */
export const filasVigentes = (filas) => filas.filter(f => !f.quitado);

export function totalesDeFilas(filas, periodo) {
  const vigentes = filasVigentes(filas);
  const porDia = (periodo?.dias ?? Array(7).fill(null)).map(d => (d ? redondeo(vigentes.reduce((a, f) => a + (f.horas[d] ?? 0), 0)) : 0));
  return { empleados: vigentes.length, horas: redondeo(vigentes.reduce((a, f) => a + f.subtotal, 0)), porDia };
}

/** Lo que se guarda de cada renglón en el documento de ajustes (también sirve de copia cuando se firma) */
export const renglonParaGuardar = (f) => ({
  clave: f.clave, nomina: f.nomina, nombre: f.nombre, puesto: f.puesto ?? '', horas: f.horas, original: f.original, motivos: f.motivos ?? {},
  quitado: !!f.quitado, reemplazoDe: f.reemplazoDe ?? null, editados: f.editados ?? [], subtotal: f.subtotal, motivo: f.motivo ?? '',
});

/** ¿Ese empleado ya está en la tabla (sin contar a los quitados)? Un reemplazo no puede repetir a alguien */
export const yaEstaEnTabla = (filas, nomina) => filasVigentes(filas).some(f => String(f.nomina) === String(nomina));

/** Estado de un área: 'firmada' · 'ajustada' (hay cambios) · 'sin_revisar' */
export const ESTADOS_AREA = { sin_revisar: 'Sin revisar', ajustada: 'Ajustada', firmada: 'Firmada' };
export function estadoDeArea(ajuste) {
  if (ajuste?.firmada) return 'firmada';
  return (ajuste?.cambios ?? []).length > 0 ? 'ajustada' : 'sin_revisar';
}

/** Las filas que se imprimen: si el área está firmada, la copia guardada al firmar; si no, lo autorizado con los cambios al día */
export function filasDelArea({ solicitudes, periodo, ajuste }) {
  if (ajuste?.firmada && Array.isArray(ajuste.renglones)) return ajuste.renglones.map(r => ({ ...r, editados: r.editados ?? [] }));
  return aplicarCambios(filasAutorizadas(solicitudes, periodo), ajuste?.cambios ?? [], periodo);
}

// ── Resumen (primera hoja de «todas las áreas») ────────────────────────────────────────────────

/**
 * @param {{areaId, nombre, filas}[]} areas  con las filas ya ajustadas
 * @returns {{ porArea:[nombre, empleados, horas][], porEmpleado:[area, nomina, nombre, horas][], porMotivo:[motivo, horas, porcentaje][], total:{empleados, horas} }}
 */
export function resumenDelPeriodo(areas, periodo) {
  const porArea = [], porEmpleado = [], motivos = new Map();
  let empleados = 0, horas = 0;
  for (const a of areas) {
    const vigentes = filasVigentes(a.filas);
    const h = redondeo(vigentes.reduce((n, f) => n + f.subtotal, 0));
    porArea.push([a.nombre, vigentes.length, h]);
    empleados += vigentes.length; horas += h;
    for (const f of vigentes) {
      porEmpleado.push([a.nombre, f.nomina, f.nombre, f.subtotal]);
      for (const d of periodo.dias) {
        if (!d || !(f.horas[d] > 0)) continue;
        const m = (f.motivos?.[d] ?? [])[0] || 'Sin motivo';
        motivos.set(m, redondeo((motivos.get(m) ?? 0) + f.horas[d]));
      }
    }
  }
  horas = redondeo(horas);
  const porMotivo = [...motivos.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'es'))
    .map(([m, h]) => [m, h, horas > 0 ? Math.round((h / horas) * 1000) / 10 : 0]);
  return { porArea, porEmpleado, porMotivo, total: { empleados, horas } };
}

export const nombreArchivoFormato = (periodo, areaNombre = '') => {
  const quien = areaNombre ? `_${areaNombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '')}` : '_TodasLasAreas';
  const cuando = periodo.tipo === 'semana' ? `Semana${periodo.semana}_${periodo.anio}` : `${periodo.desde}_a_${periodo.hasta}`;
  return `FormatoTE_${cuando}${quien}.xlsx`;
};
