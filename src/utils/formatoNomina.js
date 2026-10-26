/**
 * formatoNomina.js — «Reportes de nómina»: la lógica pura (se prueba en Node) del FORMATO DE AUTORIZACIÓN DE TIEMPO EXTRA semanal por área.
 *   · Semana ISO 8601 (lunes a domingo): "Semana 43 · 19–25 oct 2026", la última semana completa, semana anterior/siguiente y rango libre.
 *   · Solo cuenta el tiempo extra AUTORIZADO por Aut. 2 (autorizada o procesada); las pendientes y devueltas de esa semana solo se avisan.
 *   · La tabla por empleado (horas por día, subtotal y motivo) sale de las solicitudes y NO las modifica: los ajustes de Nóminas (quitar,
 *     reemplazar, corregir horas) viven aparte, como una lista de cambios que se aplica sobre lo autorizado (ajustesNomina/{semana}_{areaId}).
 * Motivos: cada empleado lleva el motivo de SU solicitud (motivoIndex) con su detalle; el número de P.O./TB va en su propia columna. Nóminas también puede corregir el motivo de un renglón (tipo de cambio «motivo»).
 * Sin Firebase ni navegador. El Excel está en exportarFormatoNomina.js; lo que habla con Firestore, en ajustesNominaDb.js.
 */
import { fechaLocal, rangoSemana, sumarDias, ymd } from './fechas.js';
import { horasNominaPor } from '../funciones.js';
import { ESTATUS_DESCARGA, calcularHoras, esAutorizadaFueraDeTiempo, esVencida, tramosPorDia } from './tiempoExtra.js';
import { etiquetaMotivo, motivoDeEmpleado, textoNumero } from './motivosTE.js';

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
/**
 * Con `modo` 'dividir' también entra lo que empezó el día anterior al periodo (su parte después de la medianoche cae en este); por defecto, horasNominaPor
 * (funciones.js): 'inicio' cuenta todo el día en que empieza.
 */
export const autorizadasDelPeriodo = (planta, periodo, modo = horasNominaPor) => planta.filter(t => ESTATUS_DESCARGA.includes(t.estatus)
  && (enPeriodo(t, periodo) || (modo === 'dividir' && !!t.fechaTE && periodo.dias.includes(sumarDias(t.fechaTE, 1)))));

const PENDIENTES = ['pendiente_aut1', 'pendiente_aut2', 'devuelta'];

/**
 * Lo que aún no está autorizado en ese periodo (pendientes y devueltas, con su fecha todavía por llegar): cuántas solicitudes y de qué áreas, para avisar.
 * Las VENCIDAS (su fecha ya pasó sin autorizarse, esVencida) NO cuentan en el formato ni aquí: van aparte en `vencidas` ({ total, porArea: [{ areaId, nombre, cantidad }] })
 * para que Nóminas decida si agrega a alguien a mano.
 * @returns {{ total:number, porArea: {areaId, nombre, pendientes, devueltas}[], vencidas: { total:number, porArea: {areaId, nombre, cantidad}[] } }}
 */
export function pendientesDelPeriodo(planta, periodo, nombres = new Map(), ahora = new Date()) {
  const grupos = new Map();
  const venc = new Map();
  for (const t of planta) {
    if (!PENDIENTES.includes(t.estatus) || !enPeriodo(t, periodo)) continue;
    if (esVencida(t, ahora)) {
      const v = venc.get(t.areaId) ?? { areaId: t.areaId, nombre: nombres.get(t.areaId) ?? t.areaNombre ?? t.areaId, cantidad: 0 };
      v.cantidad++; venc.set(t.areaId, v);
      continue;
    }
    const g = grupos.get(t.areaId) ?? { areaId: t.areaId, nombre: nombres.get(t.areaId) ?? t.areaNombre ?? t.areaId, pendientes: 0, devueltas: 0 };
    if (t.estatus === 'devuelta') g.devueltas++; else g.pendientes++;
    grupos.set(t.areaId, g);
  }
  const porArea = [...grupos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const vencidas = [...venc.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return { total: porArea.reduce((n, g) => n + g.pendientes + g.devueltas, 0), porArea, vencidas: { total: vencidas.reduce((n, g) => n + g.cantidad, 0), porArea: vencidas } };
}

// ── La tabla por empleado ──────────────────────────────────────────────────────────────────────

/**
 * Lo autorizado, un renglón por empleado: horas por día (suma si tiene varias solicitudes el mismo día) y los motivos de cada día.
 * @param {object[]} solicitudes  de UN área, con `empleados` (docAEmpleado)
 * @param {{dias: (string|null)[]}} periodo
 * @param {'inicio'|'dividir'} [modo]  cómo cuentan las horas que cruzan la medianoche (por defecto horasNominaPor, funciones.js)
 */
export function filasAutorizadas(solicitudes, periodo, modo = horasNominaPor) {
  const filas = new Map();
  for (const t of solicitudes) {
    for (const e of t.empleados ?? []) {
      // Las horas de este empleado por día: todas el día en que empieza, o repartidas por día calendario; solo cuentan los días del periodo
      const h = calcularHoras(e.horaEntrada, e.horaSalida);
      const tramos = (modo === 'dividir' ? tramosPorDia(t.fechaTE, e.horaEntrada, e.horaSalida) : [{ fecha: t.fechaTE, horas: h }])
        .filter(x => periodo.dias.includes(x.fecha) && x.horas > 0);
      if (!tramos.length) continue;
      const clave = String(e.nomina);
      const f = filas.get(clave) ?? { clave, nomina: clave, nombre: e.nombre ?? '', puesto: e.puesto ?? '', horas: {}, motivos: {}, numeros: {}, detalle: {} };
      // El motivo de ESTE empleado (el de su motivoIndex) con su detalle; el número de P.O./TB va aparte
      const m = motivoDeEmpleado(t, e);
      for (const { fecha: dia, horas: hd } of tramos) {
        f.horas[dia] = redondeo((f.horas[dia] ?? 0) + hd);
        if (m?.nombre) {
          const texto = etiquetaMotivo(m, { conNumero: false });
          if (!(f.motivos[dia] ?? []).includes(texto)) f.motivos[dia] = [...(f.motivos[dia] ?? []), texto];
          if (m.numero && !(f.numeros[dia] ?? []).includes(m.numero)) f.numeros[dia] = [...(f.numeros[dia] ?? []), m.numero];
          f.detalle[dia] = [...(f.detalle[dia] ?? []), { nombre: m.nombre, numero: m.numero, tipo: m.numero ? (m.tipoNumero || 'po') : '', horas: hd }];
        }
      }
      filas.set(clave, f);
    }
  }
  return [...filas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.nomina.localeCompare(b.nomina));
}

export const sumaHoras = (horas) => redondeo(Object.values(horas ?? {}).reduce((a, h) => a + (Number(h) || 0), 0));

// ── Ajustes de Nóminas ─────────────────────────────────────────────────────────────────────────

export const TIPOS_CAMBIO = { QUITAR: 'quitar', REEMPLAZAR: 'reemplazar', HORAS: 'horas', MOTIVO: 'motivo', AGREGAR: 'agregar' };

/** Un cambio del historial de ajustes. `clave` = la nómina del renglón tal como venía autorizada (no cambia aunque se reemplace) */
export const cambioQuitar = (fila, motivo) => ({ tipo: TIPOS_CAMBIO.QUITAR, clave: fila.clave, nomina: fila.nomina, nombre: fila.nombre, motivo: String(motivo).trim() });
export const cambioReemplazar = (fila, por, motivo) => ({
  tipo: TIPOS_CAMBIO.REEMPLAZAR, clave: fila.clave, de: { nomina: fila.nomina, nombre: fila.nombre },
  por: { nomina: String(por.nomina), nombre: por.nombre ?? '', puesto: por.puesto ?? '' }, motivo: String(motivo).trim(),
});
export const cambioHoras = (fila, dia, horas, motivo) => ({
  tipo: TIPOS_CAMBIO.HORAS, clave: fila.clave, nomina: fila.nomina, nombre: fila.nombre, dia, antes: Number(fila.horas?.[dia] ?? 0), horas: redondeo(Number(horas)), motivo: String(motivo).trim(),
});

/**
 * Corrige el motivo de un renglón (todo el periodo). `nuevo` = el motivo ya limpio ({ nombre, numero, tipoNumero, comentario, detalle }, como se guarda en una solicitud);
 * `motivo` es la razón del cambio, como en los demás.
 */
export const cambioMotivo = (fila, nuevo, motivo) => ({
  tipo: TIPOS_CAMBIO.MOTIVO, clave: fila.clave, nomina: fila.nomina, nombre: fila.nombre, antes: fila.motivo ?? '', antesNumero: fila.numero ?? '',
  motivoNuevo: {
    nombre: nuevo.nombre ?? '', numero: nuevo.numero ?? '', tipoNumero: nuevo.tipoNumero ?? '', comentario: nuevo.comentario ?? '', detalle: nuevo.detalle ?? '',
  },
  motivo: String(motivo).trim(),
});

/**
 * Agrega a alguien que no venía en las solicitudes. El renglón nace sin horas (se capturan después con cambios de horas) y con el motivo dado.
 * `clave` lleva un "+" para no chocar con la de un renglón autorizado de la misma nómina. `enPadron` = false si se capturó a mano.
 * `motivo` (la razón del ajuste) se queda vacío hasta que se guardan los cambios.
 */
export const cambioAgregar = (empleado, nuevo, { enPadron = true, areaOrigen = '' } = {}) => ({
  tipo: TIPOS_CAMBIO.AGREGAR, clave: `+${String(empleado.nomina)}`, nomina: String(empleado.nomina), nombre: empleado.nombre ?? '', puesto: empleado.puesto ?? '',
  enPadron: enPadron !== false, areaOrigen: areaOrigen ?? '',
  motivoNuevo: {
    nombre: nuevo.nombre ?? '', numero: nuevo.numero ?? '', tipoNumero: nuevo.tipoNumero ?? '', comentario: nuevo.comentario ?? '', detalle: nuevo.detalle ?? '',
  },
  motivo: '',
});

/** Nómina escrita a mano de alguien que no está en el padrón: solo dígitos, hasta 10 */
export const NOMINA_MANUAL = /^\d{1,10}$/;
export const MIN_NOMBRE_MANUAL = 5;
export const MAX_NOMBRE_MANUAL = 80;

/** ¿Qué falta para agregar a alguien capturado a mano? (null = está bien) */
export function problemaEmpleadoManual({ nomina, nombre }) {
  if (!NOMINA_MANUAL.test(String(nomina ?? '').trim())) return 'La nómina son solo números (hasta 10 dígitos).';
  const n = String(nombre ?? '').trim();
  if (n.length < MIN_NOMBRE_MANUAL) return `Escribe el nombre completo (mínimo ${MIN_NOMBRE_MANUAL} letras).`;
  if (n.length > MAX_NOMBRE_MANUAL) return `El nombre es muy largo (máximo ${MAX_NOMBRE_MANUAL} letras).`;
  return null;
}

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
    ...f, horas: { ...f.horas }, original: { ...f.horas }, quitado: false, reemplazoDe: null, editados: [], motivoCorregido: null,
  }));
  for (const c of cambios ?? []) {
    if (c.tipo === TIPOS_CAMBIO.AGREGAR) {
      if (filas.some(x => x.clave === c.clave)) continue;
      filas.push({
        clave: c.clave, nomina: String(c.nomina), nombre: c.nombre ?? '', puesto: c.puesto ?? '', horas: {}, motivos: {}, numeros: {}, detalle: {}, original: {},
        quitado: false, reemplazoDe: null, editados: [], motivoCorregido: c.motivoNuevo ?? null, agregado: true, enPadron: c.enPadron !== false, areaOrigen: c.areaOrigen ?? '',
      });
      continue;
    }
    const f = filas.find(x => x.clave === c.clave);
    if (!f) continue;
    if (c.tipo === TIPOS_CAMBIO.QUITAR) f.quitado = true;
    else if (c.tipo === TIPOS_CAMBIO.REEMPLAZAR) {
      f.reemplazoDe = f.reemplazoDe ?? { nomina: f.nomina, nombre: f.nombre };
      f.nomina = String(c.por.nomina); f.nombre = c.por.nombre ?? ''; f.puesto = c.por.puesto ?? '';
    } else if (c.tipo === TIPOS_CAMBIO.HORAS) {
      if (Number(c.horas) > 0) f.horas[c.dia] = redondeo(Number(c.horas)); else delete f.horas[c.dia];
      if (!f.editados.includes(c.dia)) f.editados.push(c.dia);
    } else if (c.tipo === TIPOS_CAMBIO.MOTIVO) f.motivoCorregido = c.motivoNuevo;
  }
  return filas.map(f => ({
    ...f, editados: f.agregado ? [] : f.editados.filter(d => (f.horas[d] ?? 0) !== (f.original[d] ?? 0)), subtotal: sumaHoras(f.horas), subtotalOriginal: sumaHoras(f.original), motivo: motivoDeFila(f, periodo), numero: numeroDeFila(f, periodo),
  }));
}

/** ¿El renglón cambió respecto a lo autorizado? */
export const fueAjustada = (f) => !!f.agregado || f.quitado || !!f.reemplazoDe || f.editados.length > 0 || !!f.motivoCorregido;

/**
 * Texto del renglón para el formato a partir de lo de cada día (motivos o números): el mismo de toda la semana, o, si son distintos, "Sáb: …; Dom: …".
 * Solo cuentan los días con horas.
 */
function textoPorDia(porDia, f, periodo) {
  const dias = [];
  (periodo?.dias ?? []).forEach((d, i) => {
    if (!d || !(f.horas?.[d] > 0)) return;
    dias.push([i, (porDia?.[d] ?? []).join(' / ')]);
  });
  const conTexto = dias.filter(([, m]) => m);
  const distintos = [...new Set(conTexto.map(([, m]) => m))];
  if (distintos.length === 0) return '';
  if (distintos.length === 1) return distintos[0];
  return conTexto.map(([i, m]) => `${DIAS_CORTO[i]}: ${m}`).join('; ');
}

/** Motivo del renglón («Descripción Motivo / Razón»): el de cada empleado con su detalle; el que corrigió Nóminas manda sobre el de las solicitudes */
export function motivoDeFila(f, periodo) {
  return f.motivoCorregido ? etiquetaMotivo(f.motivoCorregido, { conNumero: false }) : textoPorDia(f.motivos, f, periodo);
}

/** P.O./TB del renglón: el número que corresponde a ese empleado ("Sáb: …; Dom: …" si cambia en la semana) */
export function numeroDeFila(f, periodo) {
  return f.motivoCorregido ? (f.motivoCorregido.numero ?? '') : textoPorDia(f.numeros, f, periodo);
}

/**
 * Las horas del renglón repartidas por motivo y número: [{ nombre, numero, tipo, horas }]. Cada día reparte sus horas (ya ajustadas por Nóminas)
 * en proporción a lo que traía cada solicitud; un día sin motivo cuenta como «Sin motivo». Un motivo corregido cubre todo el renglón.
 * Las copias firmadas antes de los motivos nuevos solo traen el texto del motivo del día.
 */
export function desgloseFila(f, periodo) {
  const salida = [];
  for (const d of periodo?.dias ?? []) {
    const h = d ? Number(f.horas?.[d] ?? 0) : 0;
    if (!(h > 0)) continue;
    if (f.motivoCorregido) {
      salida.push({ nombre: f.motivoCorregido.nombre || 'Sin motivo', numero: f.motivoCorregido.numero ?? '', tipo: f.motivoCorregido.numero ? (f.motivoCorregido.tipoNumero || 'po') : '', horas: h });
      continue;
    }
    const partes = f.detalle?.[d] ?? [];
    if (partes.length) {
      const suma = partes.reduce((n, x) => n + (Number(x.horas) || 0), 0);
      for (const x of partes) salida.push({ nombre: x.nombre, numero: x.numero ?? '', tipo: x.tipo ?? '', horas: redondeo(suma > 0 ? (h * (Number(x.horas) || 0)) / suma : h / partes.length) });
    } else {
      salida.push({ nombre: (f.motivos?.[d] ?? [])[0] || 'Sin motivo', numero: (f.numeros?.[d] ?? [])[0] ?? '', tipo: '', horas: h });
    }
  }
  return salida;
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
  numeros: f.numeros ?? {}, detalle: f.detalle ?? {}, motivoCorregido: f.motivoCorregido ?? null,
  quitado: !!f.quitado, reemplazoDe: f.reemplazoDe ?? null, editados: f.editados ?? [], agregado: !!f.agregado, enPadron: f.enPadron !== false, subtotal: f.subtotal, motivo: f.motivo ?? '', numero: f.numero ?? '',
});

/** ¿Ese empleado ya está en la tabla (sin contar a los quitados)? Un reemplazo no puede repetir a alguien */
export const yaEstaEnTabla = (filas, nomina) => filasVigentes(filas).some(f => String(f.nomina) === String(nomina));

// ── Borrador de cambios (la pantalla de revisión acumula y guarda todo junto) ──────────────────────

/** Un cambio aún sin guardar no tiene la razón del ajuste (`motivo`): se la pone «sellarCambios» al guardar */
export const esCambioNuevo = (c) => !String(c?.motivo ?? '').trim();

/** Cuántas cosas cambiaron respecto a lo guardado: los cambios nuevos y los guardados que se quitaron del borrador */
export const contarSinGuardar = (trabajo, guardados = []) => {
  if (!trabajo) return 0;
  const siguen = new Set(trabajo);
  return trabajo.filter(esCambioNuevo).length + guardados.filter(c => !siguen.has(c)).length;
};

/** Pone las horas de un día. Reemplaza el cambio de horas aún sin guardar de esa celda; si queda igual que antes, no deja ningún cambio */
export function conHoras(base, trabajo, periodo, clave, dia, horas) {
  const sinPendiente = trabajo.filter(c => !(esCambioNuevo(c) && c.tipo === TIPOS_CAMBIO.HORAS && c.clave === clave && c.dia === dia));
  const fila = aplicarCambios(base, sinPendiente, periodo).find(f => f.clave === clave);
  if (!fila) return trabajo;
  const nuevo = redondeo(Number(horas) || 0);
  if (nuevo === (fila.horas[dia] ?? 0)) return sinPendiente;
  return [...sinPendiente, cambioHoras(fila, dia, nuevo, '')];
}

/** Quita el renglón: marca como quitado un renglón autorizado; uno agregado se borra por completo junto con sus cambios */
export function conRenglonQuitado(trabajo, fila) {
  if (fila.agregado) return trabajo.filter(c => c.clave !== fila.clave);
  return [...trabajo.filter(c => !(esCambioNuevo(c) && c.tipo === TIPOS_CAMBIO.QUITAR && c.clave === fila.clave)), cambioQuitar(fila, '')];
}

/** «Restaurar lo autorizado»: borra todos los cambios del renglón (los guardados también; se registra al guardar) */
export const conRenglonRestaurado = (trabajo, clave) => trabajo.filter(c => c.clave !== clave);

/** Los nombres/nóminas que aparecen dos veces entre los renglones vigentes (no se permite el mismo empleado dos veces) */
export function nominasRepetidas(filas) {
  const vistas = new Set(), repetidas = new Set();
  for (const f of filasVigentes(filas)) { if (vistas.has(String(f.nomina))) repetidas.add(String(f.nomina)); vistas.add(String(f.nomina)); }
  return [...repetidas];
}

/** Los renglones agregados vigentes que siguen sin horas */
export const agregadosSinHoras = (filas) => filasVigentes(filas).filter(f => f.agregado && !(f.subtotal > 0));

/** Pone la razón del ajuste a los cambios nuevos (la misma para todos); los ya guardados conservan la suya */
export const sellarCambios = (trabajo, motivo) => trabajo.map(c => (esCambioNuevo(c) ? { ...c, motivo: String(motivo).trim() } : c));

const MAX_RESUMEN = 80;

/** Resumen corto de lo que se guarda, para la bitácora: [{ tipo, nomina, dia?, antes?, horas? }] (hasta 80) y cuántos hay en total */
export function resumenDeGuardado(trabajo, guardados = []) {
  const siguen = new Set(trabajo);
  const lineas = [
    ...trabajo.filter(esCambioNuevo).map(c => {
      const base = { tipo: c.tipo, nomina: String(c.nomina ?? c.de?.nomina ?? '') };
      if (c.tipo === TIPOS_CAMBIO.HORAS) return { ...base, dia: c.dia, antes: c.antes, horas: c.horas };
      if (c.tipo === TIPOS_CAMBIO.REEMPLAZAR) return { ...base, por: c.por.nomina };
      if (c.tipo === TIPOS_CAMBIO.MOTIVO || c.tipo === TIPOS_CAMBIO.AGREGAR) return { ...base, motivoNuevo: etiquetaMotivo(c.motivoNuevo) };
      return base;
    }),
    ...guardados.filter(c => !siguen.has(c)).map(c => ({ tipo: 'restaurar', nomina: String(c.nomina ?? c.de?.nomina ?? ''), deshace: c.tipo })),
  ];
  return { total: lineas.length, cambios: lineas.slice(0, MAX_RESUMEN) };
}

// ── Periodo en la URL ──────────────────────────────────────────────────────────────────────────

/** La clave de un periodo (la de la URL) → su periodo: "2026-43" (semana) o "r20261019-20261023" (rango libre). null si no sirve */
export function periodoDeClave(clave) {
  const semana = semanaDeClave(clave);
  if (semana) return semana;
  const m = /^r(\d{4})(\d{2})(\d{2})-(\d{4})(\d{2})(\d{2})$/.exec(String(clave ?? ''));
  return m ? periodoLibre(`${m[1]}-${m[2]}-${m[3]}`, `${m[4]}-${m[5]}-${m[6]}`) : null;
}

/** Milisegundos de una fecha de Firestore (Timestamp), ISO o Date; Infinity si aún no tiene hora (la escritura del servidor está en camino) */
const msDe = (f) => {
  if (f?.toMillis) return f.toMillis();
  const ms = f instanceof Date ? f.getTime() : Date.parse(f ?? '');
  return Number.isNaN(ms) ? Infinity : ms;
};

/**
 * Lo que Aut. 2 autorizó FUERA DE TIEMPO en un área y periodo (cuenta normal en la semana de su fecha), para avisar a Nóminas.
 * `trasFirma`: las que se autorizaron DESPUÉS de que el área se firmó (si no, ya venían en lo que se firmó): sus empleados no están en el formato firmado hasta que RH
 * lo reabra y Nóminas lo revise otra vez.
 * @param {object[]} solicitudes  autorizadas de UN área (las de autorizadasDelPeriodo)
 * @param {object|null} ajuste  ajustesNomina del área
 * @returns {{ total:number, folios:string[], trasFirma:string[] }}
 */
export function fueraDeTiempoDelArea(solicitudes, ajuste) {
  const lista = solicitudes.filter(esAutorizadaFueraDeTiempo);
  const firmadaEn = ajuste?.firmada ? msDe(ajuste.firmadaPor?.fecha) : null;
  const trasFirma = firmadaEn === null ? [] : lista.filter(t => msDe(t.fueraDeTiempo?.fecha) > (firmadaEn === Infinity ? -Infinity : firmadaEn));
  const folio = (t) => t.folio ?? t.id;
  return { total: lista.length, folios: lista.map(folio), trasFirma: trasFirma.map(folio) };
}

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
 * @returns {{ porArea:[nombre, empleados, horas][], porEmpleado:[area, nomina, nombre, horas][], porMotivo:[motivo, horas, porcentaje][],
 *   porNumero:[etiqueta ("P.O. 4551099797"), horas, empleados, áreas][], total:{empleados, horas} }}
 */
export function resumenDelPeriodo(areas, periodo) {
  const porArea = [], porEmpleado = [], motivos = new Map(), numeros = new Map();
  let empleados = 0, horas = 0;
  for (const a of areas) {
    const vigentes = filasVigentes(a.filas);
    const h = redondeo(vigentes.reduce((n, f) => n + f.subtotal, 0));
    porArea.push([a.nombre, vigentes.length, h]);
    empleados += vigentes.length; horas += h;
    for (const f of vigentes) {
      porEmpleado.push([a.nombre, f.nomina, f.nombre, f.subtotal]);
      for (const x of desgloseFila(f, periodo)) {
        motivos.set(x.nombre, redondeo((motivos.get(x.nombre) ?? 0) + x.horas));
        if (!x.numero) continue;
        const k = `${x.tipo || 'po'}|${x.numero}`;
        const g = numeros.get(k) ?? { tipo: x.tipo || 'po', numero: x.numero, horas: 0, personas: new Set(), areas: new Set() };
        g.horas = redondeo(g.horas + x.horas); g.personas.add(f.clave); g.areas.add(a.nombre);
        numeros.set(k, g);
      }
    }
  }
  horas = redondeo(horas);
  const porMotivo = [...motivos.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'es'))
    .map(([m, h]) => [m, h, horas > 0 ? Math.round((h / horas) * 1000) / 10 : 0]);
  const porNumero = [...numeros.values()].sort((x, y) => y.horas - x.horas || x.numero.localeCompare(y.numero, 'es'))
    .map(g => [textoNumero(g), g.horas, g.personas.size, [...g.areas].join(', ')]);
  return { porArea, porEmpleado, porMotivo, porNumero, total: { empleados, horas } };
}

export const nombreArchivoFormato = (periodo, areaNombre = '') => {
  const quien = areaNombre ? `_${areaNombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '')}` : '_TodasLasAreas';
  const cuando = periodo.tipo === 'semana' ? `Semana${periodo.semana}_${periodo.anio}` : `${periodo.desde}_a_${periodo.hasta}`;
  return `FormatoTE_${cuando}${quien}.xlsx`;
};
