/**
 * navegacion.js — Qué ve cada quien en el menú y cómo se le habla, según su ROL (no según el módulo). Sin dependencias del navegador.
 * Una persona con varios roles ve la unión de lo que le toca a cada uno. RH y admin conservan el menú por secciones.
 */

/** Rutas de tiempo extra que todavía no tienen pantalla (muestran "Próximamente") */
export const RUTAS_TE = {
  nueva: '/tiempo-extra/nueva',
  misSolicitudes: '/tiempo-extra/mis-solicitudes',
  autorizar: '/tiempo-extra/autorizar',
  consulta: '/tiempo-extra/consulta',
};

/**
 * Elementos del menú de quien NO es RH/admin.
 * @param {{ esAut2: boolean, areasAut1: string[], areasSolicitante: string[], transporteAnterior: boolean }} p
 * @returns {{ id, path, label, icono, contador?: 'autorizar', end?: boolean }[]}  icono = nombre de ícono de lucide-react
 */
export function itemsMenuPorRol({ esAut2, areasAut1, areasSolicitante, transporteAnterior }) {
  const esAut1 = areasAut1.length > 0;
  const esSolicitante = areasSolicitante.length > 0;
  const items = [{ id: 'inicio', path: '/', label: 'Inicio', icono: 'Home', end: true }];
  if (esSolicitante || esAut1) {
    items.push({ id: 'solicitar', path: RUTAS_TE.nueva, label: 'Solicitar tiempo extra', icono: 'FilePlus' });
    items.push({ id: 'mis', path: RUTAS_TE.misSolicitudes, label: 'Mis solicitudes', icono: 'ClipboardList' });
  }
  if (esAut1 || esAut2) items.push({ id: 'autorizar', path: RUTAS_TE.autorizar, label: 'Por autorizar', icono: 'BadgeCheck', contador: 'autorizar' });
  if (esAut2) {
    items.push({ id: 'consulta', path: RUTAS_TE.consulta, label: 'Consulta de solicitudes', icono: 'Layers' });
    items.push({ id: 'organigrama', path: '/accesos/organigrama', label: 'Organigrama', icono: 'GitBranch' });
    items.push({ id: 'asignar', path: '/accesos/asignaciones', label: 'Asignar roles', icono: 'ShieldCheck' });
  } else if (esAut1) {
    items.push({ id: 'area', path: '/accesos/organigrama', label: 'Mi área', icono: 'GitBranch' });
  }
  if (transporteAnterior) items.push({ id: 'transporte', path: '/rutas/mis-solicitudes', label: 'Transporte (consulta)', icono: 'Bus' });
  return items;
}

/** Quién puede ver el organigrama: Aut. 2, RH y admin completo; el Aut. 1, solo su área; el solicitante, no */
export function veOrganigrama({ esRH, esAut2, areasAut1 }) {
  return !!esRH || !!esAut2 || areasAut1.length > 0;
}

/**
 * "Solicitante · Mantenimiento", "Autorización 1 · Mantenimiento", "Solicitante y Autorización 1 · Mantenimiento".
 * Con varias áreas se separan con " | ". RH y admin se describen por su rol del sistema.
 */
export function descripcionRoles({ esRH, esAdmin, esAut2, areasAut1, areasSolicitante }, nombresArea = new Map()) {
  const partes = [];
  if (esAdmin) partes.push('Administrador');
  else if (esRH) partes.push('Recursos Humanos');
  if (esAut2) partes.push('Autorización 2');
  const areas = [...new Set([...areasSolicitante, ...areasAut1])];
  areas.sort((a, b) => String(nombresArea.get(a) ?? a).localeCompare(String(nombresArea.get(b) ?? b), 'es'));
  for (const a of areas) {
    const roles = [areasSolicitante.includes(a) && 'Solicitante', areasAut1.includes(a) && 'Autorización 1'].filter(Boolean);
    partes.push(`${roles.join(' y ')} · ${nombresArea.get(a) ?? a}`);
  }
  return partes.join(' | ');
}

/**
 * Nombre de pila para el saludo ("Oscar"), con el formateador de nombres del organigrama. Si no se puede separar con
 * seguridad el nombre de los apellidos no se adivina: devuelve '' y el saludo va sin nombre.
 */
export function nombreDePila(nombreCompleto, formato) {
  const p = formato.partir(nombreCompleto);
  return p.separado ? p.nombre.split(' ')[0] : '';
}

/** "Buenos días" / "Buenas tardes" / "Buenas noches" según la hora (0-23) */
export const saludoDeHora = (hora) => (hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches');
