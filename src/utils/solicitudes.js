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
