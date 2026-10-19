/**
 * permisos.js — La MATRIZ de permisos: qué pantalla, acción y botón ve cada rol. Sin dependencias del navegador.
 *
 * Es la fuente única de dos cosas:
 *   - los guardias de ruta (App.jsx arma sus rutas desde RUTAS_PROTEGIDAS; RutaPuede usa CAPACIDADES), y
 *   - docs/permisos.md (la tabla se genera con `npm run docs:permisos` y una prueba revisa que no se desfase).
 * También la usan las pruebas (menú y rutas por rol y por combinación) y la "Vista previa por rol" de Herramientas.
 *
 * Un PERFIL es { rol: 'admin'|'rh'|'usuario', esAut2, areasAut1, areasSolicitante }. Una persona con varios roles tiene la UNIÓN de lo
 * que le toca a cada uno (RH + Aut. 2 ve lo de RH y lo de Aut. 2). Cada permiso es una función de ese perfil, por eso la unión sale sola.
 *
 * Las reglas de Firestore (firestore.rules) son la barrera real; esto describe lo que la pantalla enseña y deja hacer, y las pruebas
 * de reglas comprueban que ambas coincidan.
 */
import { RUTAS, rutaAccesos } from '../rutas.js';
import { puedeAsignarAlgo } from './asignaciones.js';
import { itemsMenuPorRol, itemsMenuRH, veOrganigrama } from './navegacion.js';
import { FUNCIONES } from '../funciones.js';

/** Áreas de ejemplo para armar perfiles sin leer datos reales */
export const AREA_EJEMPLO = 'area-ejemplo';

/** Perfil → la misma forma que devuelve useAccesos() (lo que usan los guardias y el menú) */
export function accesosDePerfil({ rol = 'usuario', esAut2 = false, areasAut1 = [], areasSolicitante = [] } = {}) {
  const esRH = rol === 'rh' || rol === 'admin';
  return {
    esAdmin: rol === 'admin',
    esRH,
    esAut2: !!esAut2,
    areasAut1,
    areasSolicitante,
    tieneAcceso: esRH || !!esAut2 || areasAut1.length > 0 || areasSolicitante.length > 0,
  };
}

/** Atajo para pruebas y vista previa: perfil con las banderas simples (Aut. 1 y solicitante en un área de ejemplo) */
export const perfilDe = ({ rol = 'usuario', aut2 = false, aut1 = false, solicitante = false } = {}) => ({
  rol, esAut2: aut2, areasAut1: aut1 ? [AREA_EJEMPLO] : [], areasSolicitante: solicitante ? [AREA_EJEMPLO] : [],
});

// ── Capacidades: lo que decide cada guardia de ruta y cada pestaña ────────────────────────────

export const CAPACIDADES = {
  /** Cualquier persona con sesión */
  todos: () => true,
  /** Rol del sistema RH o admin */
  rh: (a) => a.esRH,
  /** Rol del sistema admin */
  admin: (a) => a.esAdmin,
  /** Capturar tiempo extra: solicitante o Aut. 1 de un área; RH y Aut. 2 (áreas que no participan, como Administrativo) */
  solicitar: (a) => a.esRH || a.esAut2 || a.areasSolicitante.length > 0 || a.areasAut1.length > 0,
  /** Autorizar: Aut. 1, Aut. 2 y RH (RH solo firma el nivel 2) */
  autorizar: (a) => a.esRH || a.esAut2 || a.areasAut1.length > 0,
  /** Ver todas las solicitudes de la planta */
  consultar: (a) => a.esRH || a.esAut2,
  /** Confirmar y mandar al proveedor */
  recibir: (a) => a.esRH,
  /** Organigrama: completo (Aut. 2, RH, admin) o de su área (Aut. 1) */
  organigrama: (a) => veOrganigrama(a),
  /** Pestaña Asignaciones: quien puede dar o quitar algún rol operativo */
  asignar: (a) => puedeAsignarAlgo(a),
  /** Pestaña Usuarios */
  usuarios: (a) => a.esRH,
  /** Usuarios y accesos: al menos una de sus pestañas */
  accesos: (a) => a.esRH || puedeAsignarAlgo(a) || veOrganigrama(a),
};

/** Las capacidades que dependen de las asignaciones: sus guardias esperan a que lleguen */
export const DEPENDE_DE_ASIGNACIONES = new Set(['solicitar', 'autorizar', 'consultar', 'organigrama', 'asignar', 'accesos']);

export const puede = (capacidad, accesos) => CAPACIDADES[capacidad]?.(accesos) === true;

/** Pestañas de Usuarios y accesos que ve alguien, en orden (las usa la pantalla y la matriz) */
export function pestanasAccesos(accesos) {
  return [
    CAPACIDADES.usuarios(accesos) && 'usuarios',
    CAPACIDADES.asignar(accesos) && 'asignaciones',
    CAPACIDADES.organigrama(accesos) && 'organigrama',
  ].filter(Boolean);
}

/**
 * ¿Hay que avisar que alguien con Aut. 2 vigente tiene rol del sistema "usuario"? (probablemente también es de RH)
 * @param {{ rol?: string, nomina?: string|number }} usuario
 * @param {{ nomina, rol, activo?, desde?, hasta? }[]} asignacionesVigentes  ya filtradas a las vigentes
 */
export function sugiereRolRH(usuario, asignacionesVigentes) {
  return usuario?.rol === 'usuario'
    && (asignacionesVigentes ?? []).some(a => a.rol === 'aut2' && String(a.nomina) === String(usuario.nomina));
}

// ── Rutas ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Cada ruta registrada en App.jsx y la capacidad que la protege. App.jsx NO decide permisos: arma sus rutas con esta lista.
 * `puede: 'todos'` = solo exige sesión. (Las pestañas de Usuarios y accesos cuelgan de `accesos` y se filtran dentro de la pantalla.)
 */
export const RUTAS_PROTEGIDAS = [
  { id: 'inicio', ruta: RUTAS.inicio, puede: 'todos' },
  { id: 'miCuenta', ruta: RUTAS.miCuenta, puede: 'todos' },

  { id: 'teNueva', ruta: RUTAS.teNueva, puede: 'solicitar' },
  { id: 'teEditar', ruta: RUTAS.teEditar, puede: 'solicitar' },
  { id: 'teMisSolicitudes', ruta: RUTAS.teMisSolicitudes, puede: 'solicitar' },
  { id: 'teAutorizar', ruta: RUTAS.teAutorizar, puede: 'autorizar' },
  { id: 'teConsulta', ruta: RUTAS.teConsulta, puede: 'consultar' },
  { id: 'teRecepcion', ruta: RUTAS.teRecepcion, puede: 'recibir' },

  { id: 'transporteSolicitudes', ruta: RUTAS.transporteSolicitudes, puede: 'rh' },
  { id: 'transporteCatalogos', ruta: RUTAS.transporteCatalogos, puede: 'rh' },
  { id: 'padron', ruta: RUTAS.padron, puede: 'rh' },
  { id: 'estructura', ruta: RUTAS.estructura, puede: 'rh' },

  { id: 'accesos', ruta: RUTAS.accesos, puede: 'accesos' },
  { id: 'accesosTab', ruta: `${RUTAS.accesos}/:tab`, puede: 'accesos' },

  { id: 'herramientas', ruta: RUTAS.herramientas, puede: 'admin' },
  { id: 'guiaEstilo', ruta: RUTAS.guiaEstilo, puede: 'admin' },
];

/** Capacidades que protegen alguna ruta, en orden de aparición */
export const GRUPOS_DE_RUTAS = [...new Set(RUTAS_PROTEGIDAS.map(r => r.puede))];
export const rutasDe = (capacidad) => RUTAS_PROTEGIDAS.filter(r => r.puede === capacidad);

/** ¿Puede esta persona entrar a esta URL registrada? (la URL puede traer el :parámetro tal como está en RUTAS_PROTEGIDAS) */
export const puedeEntrar = (ruta, accesos) => {
  const r = RUTAS_PROTEGIDAS.find(x => x.ruta === ruta);
  return !!r && puede(r.puede, accesos);
};

// ── Menú ──────────────────────────────────────────────────────────────────────────────────────

/** El menú que vería ese perfil (RH y admin, por secciones; los demás, plano), sin tocar nada real */
export function menuDePerfil(perfil, { funciones = FUNCIONES } = {}) {
  const a = accesosDePerfil(perfil);
  return a.esRH
    ? itemsMenuRH({ esRH: true, esAdmin: a.esAdmin, funciones })
    : itemsMenuPorRol({ ...a, transporteAnterior: false, funciones });
}

// ── La matriz ─────────────────────────────────────────────────────────────────────────────────

/** Columnas de la matriz: cada una es un perfil base (las combinaciones son la unión de varias) */
export const COLUMNAS = [
  { id: 'admin', etiqueta: 'Admin', perfil: perfilDe({ rol: 'admin' }) },
  { id: 'rh', etiqueta: 'RH', perfil: perfilDe({ rol: 'rh' }) },
  { id: 'aut2', etiqueta: 'Aut. 2', perfil: perfilDe({ aut2: true }) },
  { id: 'aut1', etiqueta: 'Aut. 1', perfil: perfilDe({ aut1: true }) },
  { id: 'solicitante', etiqueta: 'Solicitante', perfil: perfilDe({ solicitante: true }) },
  { id: 'sinRol', etiqueta: 'Sin rol', perfil: perfilDe({}) },
];

/** Combinaciones que se prueban además de las columnas (rol del sistema + roles operativos) */
export const COMBINACIONES = [
  { id: 'rh+aut2', etiqueta: 'RH + Aut. 2', perfil: perfilDe({ rol: 'rh', aut2: true }) },
  { id: 'admin+aut1', etiqueta: 'Admin + Aut. 1', perfil: perfilDe({ rol: 'admin', aut1: true }) },
  { id: 'admin+aut2', etiqueta: 'Admin + Aut. 2', perfil: perfilDe({ rol: 'admin', aut2: true }) },
  { id: 'rh+solicitante', etiqueta: 'RH + Solicitante', perfil: perfilDe({ rol: 'rh', solicitante: true }) },
  { id: 'aut2+aut1', etiqueta: 'Aut. 2 + Aut. 1', perfil: perfilDe({ aut2: true, aut1: true }) },
  { id: 'aut2+solicitante', etiqueta: 'Aut. 2 + Solicitante', perfil: perfilDe({ aut2: true, solicitante: true }) },
  { id: 'aut1+solicitante', etiqueta: 'Aut. 1 + Solicitante', perfil: perfilDe({ aut1: true, solicitante: true }) },
  { id: 'aut2+aut1+solicitante', etiqueta: 'Aut. 2 + Aut. 1 + Solicitante', perfil: perfilDe({ aut2: true, aut1: true, solicitante: true }) },
  { id: 'rh+aut2+aut1+solicitante', etiqueta: 'RH + Aut. 2 + Aut. 1 + Solicitante', perfil: perfilDe({ rol: 'rh', aut2: true, aut1: true, solicitante: true }) },
];

const por = (capacidad) => (a) => CAPACIDADES[capacidad](a);
const soloAdmin = (a) => a.esAdmin;
const rh = (a) => a.esRH;
const nivel2 = (a) => a.esRH || a.esAut2;

/**
 * Filas de la matriz. `quien(accesos)` dice si ese perfil ve la pantalla o puede hacer la acción.
 *   tipo: 'pantalla' (tiene `ruta`) · 'accion' · 'boton'
 *   menu: en qué menú aparece su `ruta` como ítem: 'rh' (menú de RH/admin) · 'otros' (menú de los demás) · 'ambos' · null (no es ítem del menú)
 */
export const MATRIZ = [
  // ── Pantallas
  { grupo: 'Inicio y cuenta', tipo: 'pantalla', id: 'inicio', nombre: 'Inicio (RH y admin: indicadores; los demás: su panel por rol)', ruta: RUTAS.inicio, quien: por('todos'), menu: 'ambos' },
  { grupo: 'Inicio y cuenta', tipo: 'pantalla', id: 'miCuenta', nombre: 'Mi cuenta (datos, ayudas, letra, tema, contraseña)', ruta: RUTAS.miCuenta, quien: por('todos'), menu: null, nota: 'Se entra por el pie del menú' },

  { grupo: 'Tiempo extra', tipo: 'pantalla', id: 'teNueva', nombre: 'Solicitar tiempo extra', ruta: RUTAS.teNueva, quien: por('solicitar'), menu: 'ambos' },
  { grupo: 'Tiempo extra', tipo: 'pantalla', id: 'teMisSolicitudes', nombre: 'Mis solicitudes', ruta: RUTAS.teMisSolicitudes, quien: por('solicitar'), menu: 'ambos' },
  { grupo: 'Tiempo extra', tipo: 'pantalla', id: 'teAutorizar', nombre: 'Por autorizar', ruta: RUTAS.teAutorizar, quien: por('autorizar'), menu: 'ambos' },
  { grupo: 'Tiempo extra', tipo: 'pantalla', id: 'teConsulta', nombre: 'Todas las solicitudes (solo lectura; RH además cancela)', ruta: RUTAS.teConsulta, quien: por('consultar'), menu: 'ambos' },
  { grupo: 'Tiempo extra', tipo: 'pantalla', id: 'teRecepcion', nombre: 'Por enviar al proveedor', ruta: RUTAS.teRecepcion, quien: por('recibir'), menu: 'rh' },

  { grupo: 'Transporte', tipo: 'pantalla', id: 'transporteSolicitudes', nombre: 'Solicitudes de transporte', ruta: RUTAS.transporteSolicitudes, quien: por('rh'), menu: 'rh' },
  { grupo: 'Transporte', tipo: 'pantalla', id: 'transporteCatalogos', nombre: 'Rutas y puntos de reunión', ruta: RUTAS.transporteCatalogos, quien: por('rh'), menu: 'rh' },

  { grupo: 'Personal y estructura', tipo: 'pantalla', id: 'padron', nombre: 'Padrón de empleados', ruta: RUTAS.padron, quien: por('rh'), menu: 'rh' },
  { grupo: 'Personal y estructura', tipo: 'pantalla', id: 'estructura', nombre: 'Estructura (áreas, puestos, turnos)', ruta: RUTAS.estructura, quien: por('rh'), menu: 'rh' },
  { grupo: 'Personal y estructura', tipo: 'pantalla', id: 'accesos', nombre: 'Usuarios y accesos (cada quien ve solo las pestañas que le tocan)', ruta: RUTAS.accesos, quien: por('accesos'), menu: 'rh', nota: 'En el menú de RH es un ítem; los demás entran por su pestaña' },
  { grupo: 'Personal y estructura', tipo: 'pantalla', id: 'accesosUsuarios', nombre: 'Usuarios y accesos › Usuarios', ruta: rutaAccesos('usuarios'), quien: por('usuarios'), menu: null },
  { grupo: 'Personal y estructura', tipo: 'pantalla', id: 'accesosAsignaciones', nombre: 'Usuarios y accesos › Asignaciones («Asignar roles» en el menú de Aut. 2)', ruta: RUTAS.asignaciones, quien: por('asignar'), menu: 'otros' },
  { grupo: 'Personal y estructura', tipo: 'pantalla', id: 'organigrama', nombre: 'Organigrama («Mi área» para Aut. 1: solo su área)', ruta: RUTAS.organigrama, quien: por('organigrama'), menu: 'ambos' },

  { grupo: 'Herramientas (admin)', tipo: 'pantalla', id: 'herramientas', nombre: 'Herramientas › Diagnóstico y limpieza', ruta: RUTAS.herramientas, quien: por('admin'), menu: 'rh' },
  { grupo: 'Herramientas (admin)', tipo: 'pantalla', id: 'vistaPrevia', nombre: 'Herramientas › Vista previa por rol', ruta: RUTAS.herramientas, quien: por('admin'), menu: null, nota: 'Dentro de Herramientas' },
  { grupo: 'Herramientas (admin)', tipo: 'boton', id: 'respaldoCompleto', nombre: 'Herramientas › Respaldo completo (JSON)', quien: soloAdmin },
  { grupo: 'Herramientas (admin)', tipo: 'pantalla', id: 'guiaEstilo', nombre: 'Guía de estilo', ruta: RUTAS.guiaEstilo, quien: por('admin'), menu: 'rh' },

  // ── Acciones y botones: tiempo extra
  { grupo: 'Tiempo extra', tipo: 'accion', id: 'capturarArea', nombre: 'Capturar y enviar tiempo extra de un área que participa', quien: (a) => a.areasSolicitante.length > 0 || a.areasAut1.length > 0, nota: 'Solo en sus áreas. RH no captura en áreas que participan' },
  { grupo: 'Tiempo extra', tipo: 'accion', id: 'capturarSinTE', nombre: 'Capturar tiempo extra de un área que no participa (Administrativo)', quien: nivel2, nota: 'RH la deja en nivel 2 (la firma un Aut. 2 u otra persona de RH); la Aut. 2 la deja autorizada al enviarla' },
  { grupo: 'Tiempo extra', tipo: 'accion', id: 'autorizarLoPropio', nombre: 'Lo que captura y envía queda autorizado al enviarlo (firma de nivel 2 «Capturada y autorizada por Aut. 2»)', quien: (a) => a.esAut2, nota: 'Solo la Aut. 2 vigente, en cualquier área donde pueda capturar. El Aut. 1 y RH no autorizan lo suyo' },
  { grupo: 'Tiempo extra', tipo: 'accion', id: 'firmarNivel1', nombre: 'Autorizar o devolver, nivel 1', quien: (a) => a.areasAut1.length > 0, nota: 'Solo lo de su área; no lo que él mismo creó' },
  { grupo: 'Tiempo extra', tipo: 'accion', id: 'firmarNivel2', nombre: 'Autorizar o devolver, nivel 2', quien: nivel2, nota: 'RH firma «como RH»; no lo que él mismo creó' },
  { grupo: 'Tiempo extra', tipo: 'boton', id: 'confirmarRH', nombre: 'Confirmar y generar transporte / Devolver (nivel 3)', quien: por('recibir') },
  { grupo: 'Tiempo extra', tipo: 'boton', id: 'cancelarRH', nombre: 'Cancelar un tiempo extra autorizado o confirmado', quien: rh },
  { grupo: 'Tiempo extra', tipo: 'boton', id: 'formatoRutas', nombre: 'Descargar Formato de rutas y resumen de horas extra', quien: rh },
  { grupo: 'Tiempo extra', tipo: 'boton', id: 'exportarConsulta', nombre: 'Exportar «Todas las solicitudes» a Excel', quien: por('consultar') },

  // ── Acciones y botones: personal
  { grupo: 'Personal y estructura', tipo: 'accion', id: 'editarPadron', nombre: 'Padrón: alta, edición, baja, importación y respaldo', quien: rh },
  { grupo: 'Personal y estructura', tipo: 'accion', id: 'editarEstructura', nombre: 'Estructura y catálogos: crear y editar áreas, puestos, turnos, rutas y puntos', quien: rh },
  { grupo: 'Personal y estructura', tipo: 'boton', id: 'estructuraInicial', nombre: 'Estructura inicial y limpieza de estructura vieja', quien: soloAdmin },

  // ── Acciones y botones: usuarios y asignaciones
  { grupo: 'Usuarios y accesos', tipo: 'boton', id: 'nuevoUsuario', nombre: 'Nuevo usuario / Crear usuarios en lote (rol «usuario»)', quien: rh },
  { grupo: 'Usuarios y accesos', tipo: 'boton', id: 'editarUsuario', nombre: 'Editar, activar o desactivar usuarios con rol «usuario»', quien: rh },
  { grupo: 'Usuarios y accesos', tipo: 'boton', id: 'darRolRH', nombre: 'Dar o quitar el rol del sistema RH o Administrador, y tocar a quien ya lo tiene', quien: soloAdmin },
  { grupo: 'Usuarios y accesos', tipo: 'boton', id: 'restablecerAcceso', nombre: 'Restablecer acceso (RH: a usuarios con rol «usuario»; admin: a cualquiera menos a sí mismo)', quien: rh },
  { grupo: 'Usuarios y accesos', tipo: 'boton', id: 'asignarAut1', nombre: 'Asignar, extender o revocar Aut. 1 y Solicitante', quien: (a) => a.esAdmin || a.esRH || a.esAut2, nota: 'Nadie, salvo admin, se asigna a sí mismo. Solo en áreas que participan' },
  { grupo: 'Usuarios y accesos', tipo: 'boton', id: 'asignarAut2', nombre: 'Asignar, extender o revocar Aut. 2', quien: soloAdmin },
  { grupo: 'Usuarios y accesos', tipo: 'boton', id: 'historialPersona', nombre: 'Ver el historial de una persona en el organigrama', quien: nivel2 },
  { grupo: 'Usuarios y accesos', tipo: 'boton', id: 'cargaAsignaciones', nombre: 'Cargar asignaciones iniciales / Actualizar nombres y puestos', quien: soloAdmin },

  // ── Cuenta
  { grupo: 'Inicio y cuenta', tipo: 'boton', id: 'cambiarPassword', nombre: 'Cambiar su propia contraseña y sus preferencias', quien: por('todos') },
];

/** Perfil de una columna o combinación → lo que ve/puede en cada fila (ids de filas) */
export function filasPermitidas(perfil) {
  const a = accesosDePerfil(perfil);
  return MATRIZ.filter(f => f.quien(a)).map(f => f.id);
}

const MARCA = { si: '✔', no: '—' };

/** Tabla de la matriz en Markdown (la que va en docs/permisos.md) */
export function matrizEnMarkdown() {
  const encabezado = `| Pantalla / acción | ${COLUMNAS.map(c => c.etiqueta).join(' | ')} |`;
  const separador = `|---|${COLUMNAS.map(() => ':-:').join('|')}|`;
  const lineas = [];
  // Las filas de un mismo grupo van juntas, en el orden en que aparece cada grupo
  for (const grupo of [...new Set(MATRIZ.map(f => f.grupo))]) {
    lineas.push(`| **${grupo}** |${COLUMNAS.map(() => '').join('|')}|`);
    for (const fila of MATRIZ.filter(f => f.grupo === grupo)) {
      const marcas = COLUMNAS.map(c => (fila.quien(accesosDePerfil(c.perfil)) ? MARCA.si : MARCA.no));
      const etiqueta = fila.tipo === 'pantalla' ? 'Pantalla' : fila.tipo === 'boton' ? 'Botón' : 'Acción';
      lineas.push(`| ${etiqueta}: ${fila.nombre}${fila.nota ? ` _(${fila.nota})_` : ''} | ${marcas.join(' | ')} |`);
    }
  }
  return [encabezado, separador, ...lineas].join('\n');
}

// ── Contenido del Inicio (para la vista previa; sin leer datos) ──────────────────────────────────

/** Qué bloques tiene el Inicio de un perfil (refleja pages/Home.jsx, InicioRH.jsx e InicioRol.jsx) */
export function bloquesDeInicio(perfil) {
  const a = accesosDePerfil(perfil);
  if (a.esRH) {
    return {
      tipo: 'Indicadores de RH y admin',
      accion: 'Accesos rápidos',
      bloques: ['Requieren atención (por autorizar, por enviar al proveedor, devueltas)', 'Esta semana: solicitudes por día', 'Accesos rápidos a las pantallas de RH'],
    };
  }
  const solicita = a.areasSolicitante.length > 0 || a.areasAut1.length > 0 || a.esAut2;
  const tieneArea = a.areasSolicitante.length > 0 || a.areasAut1.length > 0;
  const autoriza = a.areasAut1.length > 0 || a.esAut2;
  const bloques = [];
  if (!a.tieneAcceso) bloques.push('Aviso «Aún no tienes acceso»: pide al área de Sistemas o, en su caso, a Recursos Humanos que te asignen un rol');
  if (autoriza) bloques.push('Aviso «Por autorizar» con enlace a la bandeja');
  if (tieneArea) bloques.push('Mi área: empleados, borradores, en autorización, devueltas, autorizadas del mes y próximos tiempos extra');
  if (a.areasAut1.length > 0) bloques.push('Últimas solicitudes de mi área');
  if (a.esAut2) bloques.push('Planta: por autorizar nivel 2, empleados de planta y solicitudes de la semana por área');
  return {
    tipo: 'Panel por rol',
    accion: solicita ? 'Botón «Solicitar tiempo extra»' : 'Ninguna',
    bloques,
  };
}
