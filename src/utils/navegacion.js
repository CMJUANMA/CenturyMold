/**
 * navegacion.js — Qué ve cada quien en el menú y cómo se le habla, según su ROL. Sin dependencias del navegador.
 * Una persona con varios roles ve la unión de lo que le toca a cada uno. RH y admin ven el menú por secciones.
 * Todas las URLs salen de rutas.js (y las del transporte suelto, de funciones.js).
 */

import { FUNCIONES, RUTAS_TRANSPORTE_SUELTO, funcionActiva } from '../funciones.js';
import { RUTAS } from '../rutas.js';

/**
 * Elementos del menú de quien NO es RH/admin.
 * @param {{ esAut2: boolean, areasAut1: string[], areasSolicitante: string[], transporteAnterior: boolean }} p
 * @returns {{ id, path, label, icono, contador?: 'autorizar', end?: boolean }[]}  icono = nombre de ícono de lucide-react
 */
export function itemsMenuPorRol({ esAut2, areasAut1, areasSolicitante, transporteAnterior, funciones = FUNCIONES }) {
  const esAut1 = areasAut1.length > 0;
  const esSolicitante = areasSolicitante.length > 0;
  const items = [{ id: 'inicio', path: RUTAS.inicio, label: 'Inicio', icono: 'Home', end: true }];
  if (esSolicitante || esAut1) {
    items.push({ id: 'solicitar', path: RUTAS.teNueva, label: 'Solicitar tiempo extra', icono: 'FilePlus' });
    items.push({ id: 'mis', path: RUTAS.teMisSolicitudes, label: 'Mis solicitudes', icono: 'ClipboardList' });
  }
  if (esAut1 || esAut2) items.push({ id: 'autorizar', path: RUTAS.teAutorizar, label: 'Por autorizar', icono: 'BadgeCheck', contador: 'autorizar' });
  if (esAut2) {
    items.push({ id: 'consulta', path: RUTAS.teConsulta, label: 'Todas las solicitudes', icono: 'Layers' });
    items.push({ id: 'organigrama', path: RUTAS.organigrama, label: 'Organigrama', icono: 'GitBranch' });
    items.push({ id: 'asignar', path: RUTAS.asignaciones, label: 'Asignar roles', icono: 'ShieldCheck' });
  } else if (esAut1) {
    items.push({ id: 'area', path: RUTAS.organigrama, label: 'Mi área', icono: 'GitBranch' });
  }
  if (transporteAnterior && funcionActiva('transporteSuelto', funciones)) items.push({ id: 'transporte', path: RUTAS_TRANSPORTE_SUELTO.misSolicitudes, label: 'Transporte (consulta)', icono: 'Bus' });
  return items;
}

/**
 * Menú de RH y admin, por secciones. `admin`: solo el rol admin. `funcion`: solo si ese interruptor de funciones.js está encendido.
 * `icono` = nombre de ícono de lucide-react. Admin y RH ven el mismo menú; el admin suma "Herramientas".
 */
export const ITEMS_MENU_RH = [
  { path: RUTAS.inicio, label: 'Inicio', icono: 'Home', end: true },

  { section: 'Tiempo extra' },
  { path: RUTAS.teNueva, label: 'Solicitar tiempo extra', icono: 'FilePlus' },
  { path: RUTAS.teMisSolicitudes, label: 'Mis solicitudes', icono: 'ClipboardList' },
  { path: RUTAS.teAutorizar, label: 'Por autorizar', icono: 'BadgeCheck', contador: 'autorizar' },
  { path: RUTAS.teRecepcion, label: 'Por enviar al proveedor', icono: 'Inbox', contador: 'recepcion' },
  { path: RUTAS.teConsulta, label: 'Todas las solicitudes', icono: 'Layers' },

  { section: 'Transporte' },
  { path: RUTAS.transporteSolicitudes, label: 'Solicitudes de transporte', icono: 'Bus' },
  { path: RUTAS_TRANSPORTE_SUELTO.nueva, label: 'Nueva solicitud de transporte', icono: 'FilePlus', funcion: 'transporteSuelto' },
  { path: RUTAS_TRANSPORTE_SUELTO.misSolicitudes, label: 'Mis solicitudes de transporte', icono: 'ClipboardList', funcion: 'transporteSuelto' },
  { path: RUTAS.transporteCatalogos, label: 'Rutas y puntos de reunión', icono: 'Database' },

  { section: 'Personal y estructura' },
  { path: RUTAS.padron, label: 'Padrón de empleados', icono: 'Users' },
  { path: RUTAS.estructura, label: 'Estructura', icono: 'Network' },
  { path: RUTAS.accesos, label: 'Usuarios y accesos', icono: 'ShieldCheck', end: true },
  { path: RUTAS.organigrama, label: 'Organigrama', icono: 'GitBranch' },

  { section: 'Herramientas', admin: true },
  { path: RUTAS.herramientas, label: 'Diagnóstico y limpieza', icono: 'Wrench', admin: true },
];

/**
 * Menú de RH/admin: los ítems visibles según rol y funciones encendidas; una sección solo aparece si le queda al menos un ítem.
 * @param {{ esRH: boolean, esAdmin?: boolean, funciones?: object }} p
 */
export function itemsMenuRH({ esRH, esAdmin = false, funciones = FUNCIONES }) {
  if (!esRH) return ITEMS_MENU_RH.slice(0, 1);
  const visible = (it) => (!it.admin || esAdmin) && (!it.funcion || funcionActiva(it.funcion, funciones));
  return ITEMS_MENU_RH.filter(visible).filter((it, i, lista) => !it.section || (!!lista[i + 1] && !lista[i + 1].section));
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
