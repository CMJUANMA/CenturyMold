/**
 * cargaInicial.js — Propuesta de asignaciones de la hoja "Niveles de autorización" (botón "Cargar asignaciones iniciales").
 * Solo calcula: cada fila se revisa en pantalla y nada se guarda sin que el admin la marque. Sin dependencias del navegador.
 */
import { ROL_OP, idAsignacion, estadoAsignacion } from './asignaciones.js';

export const MOTIVO_CARGA_INICIAL = 'Carga inicial: hoja Niveles de autorización';

const aut1 = (areaId, nomina, nombre) => ({ rol: ROL_OP.AUT1, areaId, nomina, nombre });
const sol = (areaId, nomina, nombre) => ({ rol: ROL_OP.SOLICITANTE, areaId, nomina, nombre });

/** Lo que dice la hoja (el nombre de aquí solo sirve para detectar un número de nómina equivocado) */
export const PROPUESTAS_INICIALES = [
  { rol: ROL_OP.AUT2, areaId: null, nomina: '11', nombre: 'Salvador Maldonado' },
  { rol: ROL_OP.AUT2, areaId: null, nomina: '50296', nombre: 'Marco Espinosa' },
  aut1('produccion', '50610', 'Ismael Gómez'),
  aut1('almacen', '50988', 'Lezli Medrano'),
  aut1('calidad', '50712', 'Nora Fernández'),
  aut1('mantenimiento', '50440', 'Anselmo Mendoza'),
  aut1('moldes', '50874', 'Noé Cabrera'),
  sol('produccion', '50532', 'Marcos Acosta'),
  sol('produccion', '50009', 'Eduardo Argumedo'),
  sol('produccion', '50628', 'Filomeno Guzmán'),
  sol('produccion', '50947', 'Joel Carrera'),
  sol('almacen', '50901', 'Remedios Lizardi'),
  sol('calidad', '50941', 'Jesús Sánchez'),
  sol('mantenimiento', '50875', 'Oscar Romero'),
  sol('moldes', '50272', 'Luis Rodolfo Pérez'),
  sol('moldes', '51070', 'José Juan González'),
];

const palabras = (t) => String(t ?? '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^A-Z\s]/g, ' ').split(/\s+/).filter(p => p.length > 1);

/**
 * ¿El nombre del padrón coincide razonablemente con el de la hoja? Cuenta cuántas palabras de la hoja aparecen en el nombre
 * del padrón (sin importar el orden, que en el padrón es apellidos primero) y exige al menos el 60 % (redondeado hacia arriba).
 */
export function nombreCoincide(deLaHoja, delPadron) {
  const buscadas = palabras(deLaHoja);
  const reales = new Set(palabras(delPadron));
  if (!buscadas.length) return false;
  const halladas = buscadas.filter(p => reales.has(p)).length;
  return halladas >= Math.ceil(buscadas.length * 0.6);
}

export const ESTADO_FILA = {
  LISTO: 'listo', YA_EXISTE: 'ya-existe', NO_PADRON: 'no-padron', AREA_DISTINTA: 'area-distinta', SIN_USUARIO: 'sin-usuario', REVISAR_NOMBRE: 'revisar-nombre',
};

/**
 * Una fila por asignación propuesta.
 *   estado:   'ya-existe' | 'no-padron' (sin casilla) o 'listo'
 *   avisos:   ['area-distinta', 'sin-usuario', 'revisar-nombre']  (la fila se puede crear, salvo "revisar nombre" que viene desmarcada)
 *   marcada:  valor inicial de la casilla
 * El nombre que se muestra y se guarda sale del PADRÓN.
 */
export function evaluarPropuestas({ propuestas = PROPUESTAS_INICIALES, empleados, usuarios, asignaciones, ahora = new Date() }) {
  const porNomina = new Map(empleados.map(e => [String(e.nomina), e]));
  const nominasConUsuario = usuarios ? new Set(usuarios.map(u => String(u.nomina))) : null;
  const existentes = new Map(asignaciones.map(a => [a.id, a]));

  return propuestas.map((p) => {
    const id = idAsignacion(p.nomina, p.rol, p.areaId);
    const emp = porNomina.get(p.nomina) ?? null;
    const base = { ...p, id, nombreHoja: p.nombre, empleado: emp, nombre: emp?.nombre ?? '', puesto: emp?.puesto ?? '', areaPadron: emp?.areaId ?? '' };
    const previa = existentes.get(id);
    if (previa && ['vigente', 'programada'].includes(estadoAsignacion(previa, ahora))) {
      return { ...base, estado: ESTADO_FILA.YA_EXISTE, avisos: [], marcada: false, seleccionable: false, previa };
    }
    if (!emp) return { ...base, estado: ESTADO_FILA.NO_PADRON, avisos: [], marcada: false, seleccionable: false, previa: previa ?? null };
    const avisos = [];
    const nombreOk = nombreCoincide(p.nombre, emp.nombre);
    if (!nombreOk) avisos.push(ESTADO_FILA.REVISAR_NOMBRE);
    if (p.areaId && emp.areaId !== p.areaId) avisos.push(ESTADO_FILA.AREA_DISTINTA);
    if (nominasConUsuario && !nominasConUsuario.has(p.nomina)) avisos.push(ESTADO_FILA.SIN_USUARIO);
    return { ...base, estado: ESTADO_FILA.LISTO, avisos, marcada: nombreOk, seleccionable: true, previa: previa ?? null };
  });
}
