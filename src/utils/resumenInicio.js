/**
 * resumenInicio.js — Números y listas del Inicio por rol, a partir de las solicitudes de tiempo extra que el usuario puede ver.
 * Sin dependencias del navegador. Con listas vacías todo da 0 / [] (aún no hay solicitudes de tiempo extra).
 */
import { aFecha } from './asignaciones.js';
import { esperaDesde } from './tiempoExtra.js';

const EN_AUTORIZACION = ['pendiente_aut1', 'pendiente_aut2'];
const AUTORIZADAS = ['autorizada', 'procesada'];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const cuando = (s) => aFecha(s.fechaCreacion)?.getTime() ?? 0;

/** Inicio del mes (para "autorizadas este mes") */
export const inicioDeMes = (ahora) => new Date(ahora.getFullYear(), ahora.getMonth(), 1);
/** Lunes de la semana de `ahora`, a las 00:00 */
export function inicioDeSemana(ahora) {
  const d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** { borrador, enAutorizacion, devueltas, autorizadasMes } de las solicitudes propias */
export function contarMisSolicitudes(propias, ahora = new Date()) {
  const mes = inicioDeMes(ahora).getTime();
  const n = (f) => propias.filter(f).length;
  return {
    borrador: n(s => s.estatus === 'borrador'),
    enAutorizacion: n(s => EN_AUTORIZACION.includes(s.estatus)),
    devueltas: n(s => s.estatus === 'devuelta'),
    autorizadasMes: n(s => AUTORIZADAS.includes(s.estatus) && (aFecha(s.aut2?.fecha ?? s.fechaActualizacion)?.getTime() ?? 0) >= mes),
  };
}

/** Estado del transporte de una solicitud autorizada o ya confirmada por RH (lo que ve el solicitante) */
export function estadoTransporte(sol) {
  const conTransporte = (sol.resumen?.totalTransporte ?? 0) > 0;
  if (sol.estatus === 'procesada') return conTransporte ? 'Confirmada por RH · transporte solicitado' : 'Confirmada por RH · sin transporte';
  return conTransporte ? 'Por enviar al proveedor' : 'Sin transporte';
}

/** Autorizadas (o ya recibidas) con fecha de hoy en adelante, la más próxima primero */
export function proximosAutorizados(propias, ahora = new Date(), max = 8) {
  const hoy = iso(ahora);
  return propias
    .filter(s => AUTORIZADAS.includes(s.estatus) && String(s.fechaTE ?? '') >= hoy)
    .sort((a, b) => String(a.fechaTE).localeCompare(String(b.fechaTE)) || String(a.folio).localeCompare(String(b.folio)))
    .slice(0, max)
    .map(s => ({
      folio: s.folio ?? s.id, fecha: s.fechaTE, empleados: s.resumen?.totalEmpleados ?? 0, horas: s.resumen?.totalHoras ?? 0, transporte: estadoTransporte(s), estatus: s.estatus,
    }));
}

/** Las más recientes del área (sin borradores) */
export function ultimasDelArea(delArea, max = 8) {
  return delArea.filter(s => s.estatus !== 'borrador').sort((a, b) => cuando(b) - cuando(a)).slice(0, max);
}

/** Solicitudes creadas desde el lunes, por área (todas las áreas con al menos una, y las áreas dadas aunque tengan 0) */
export function semanaPorArea(planta, areas, ahora = new Date()) {
  const desde = inicioDeSemana(ahora).getTime();
  const cuenta = new Map(areas.map(a => [a.id, 0]));
  for (const s of planta) {
    if (s.estatus === 'borrador' || cuando(s) < desde) continue;
    cuenta.set(s.areaId, (cuenta.get(s.areaId) ?? 0) + 1);
  }
  const nombres = new Map(areas.map(a => [a.id, a.nombre]));
  return [...cuenta].map(([areaId, total]) => ({ areaId, nombre: nombres.get(areaId) ?? areaId, total }));
}

export const contarPorEstatus = (lista, estatus) => lista.filter(s => s.estatus === estatus).length;

// ── Inicio de RH y admin ──────────────────────────────────────────────────

const sumarDiasIso = (fechaIso, n) => {
  const [a, m, d] = fechaIso.split('-').map(Number);
  return iso(new Date(a, m - 1, d + n));
};
const redondear = (n) => Math.round(n * 100) / 100;

/**
 * Los 8 indicadores del Inicio de RH y admin, de las solicitudes de toda la planta (sin borradores).
 *   atencion: por enviar al proveedor · fechas vencidas sin confirmar · por autorizar nivel 1 y nivel 2 (con la más antigua, en días) · devueltas
 *   semana:   horas autorizadas de la semana y del mes · empleados con tiempo extra esta semana · con transporte en los próximos 7 días
 * "Autorizadas" = autorizada o procesada (ya confirmada por RH). La semana va de lunes a domingo, por la fecha del tiempo extra.
 */
export function indicadoresRH(planta, ahora = new Date()) {
  const hoy = iso(ahora);
  const lunes = iso(inicioDeSemana(ahora));
  const domingo = sumarDiasIso(lunes, 6);
  const mes = iso(inicioDeMes(ahora));
  const finMes = iso(new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0));
  const en7 = sumarDiasIso(hoy, 7);
  const de = (estatus) => planta.filter(s => s.estatus === estatus);
  const fecha = (s) => String(s.fechaTE ?? '');
  const autorizadas = planta.filter(s => AUTORIZADAS.includes(s.estatus));
  const suma = (lista, campo) => lista.reduce((a, s) => a + (s.resumen?.[campo] ?? 0), 0);
  const entre = (desde, hasta) => autorizadas.filter(s => fecha(s) >= desde && fecha(s) <= hasta);

  const antigua = (lista) => {
    const desde = lista.map(esperaDesde).filter(Boolean);
    return desde.length ? Math.floor(Math.max(0, ahora.getTime() - Math.min(...desde)) / 86400000) : null;
  };
  const pend1 = de('pendiente_aut1');
  const pend2 = de('pendiente_aut2');
  const porEnviar = de('autorizada');
  const delaSemana = entre(lunes, domingo);

  return {
    atencion: {
      porEnviar: porEnviar.length,
      vencidas: porEnviar.filter(s => fecha(s) < hoy).length,
      nivel1: pend1.length,
      nivel2: pend2.length,
      masAntiguaNivel1: antigua(pend1),
      masAntiguaNivel2: antigua(pend2),
      devueltas: de('devuelta').length,
    },
    semana: {
      horasSemana: redondear(suma(delaSemana, 'totalHoras')),
      horasMes: redondear(suma(entre(mes, finMes), 'totalHoras')),
      empleadosSemana: suma(delaSemana, 'totalEmpleados'),
      transporte7: suma(entre(hoy, en7), 'totalTransporte'),
    },
  };
}

/** Tiempos extra autorizados (o confirmados) de hoy a 7 días, el más próximo primero */
export function proximos7Dias(planta, ahora = new Date(), max = 10) {
  const hoy = iso(ahora);
  const en7 = sumarDiasIso(hoy, 7);
  return planta
    .filter(s => AUTORIZADAS.includes(s.estatus) && String(s.fechaTE ?? '') >= hoy && String(s.fechaTE ?? '') <= en7)
    .sort((a, b) => String(a.fechaTE).localeCompare(String(b.fechaTE)) || String(a.folio).localeCompare(String(b.folio)))
    .slice(0, max)
    .map(s => ({
      id: s.id, folio: s.folio ?? s.id, areaId: s.areaId, fecha: s.fechaTE, estatus: s.estatus,
      empleados: s.resumen?.totalEmpleados ?? 0, horas: s.resumen?.totalHoras ?? 0, transporte: s.resumen?.totalTransporte ?? 0,
    }));
}
