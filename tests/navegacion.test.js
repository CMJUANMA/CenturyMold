// Menú, saludo y descripción por rol. Datos ficticios.
import { describe, expect, it } from 'vitest';
import { descripcionRoles, itemsMenuPorRol, itemsMenuRH, nombreDePila, saludoDeHora, veOrganigrama } from '../src/utils/navegacion.js';
import { calcularAccesos } from '../src/utils/asignaciones.js';
import { ROLES_RH } from '../src/utils/constantes.js';
import { crearFormateadorNombres } from '../src/utils/nombresPersona.js';

const nombres = new Map([['mantenimiento', 'Mantenimiento'], ['moldes', 'Moldes']]);
const base = { esAut2: false, areasAut1: [], areasSolicitante: [], transporteAnterior: false };
const ids = (p) => itemsMenuPorRol({ ...base, ...p }).map(i => i.id);

describe('menú por rol', () => {
  it('solicitante: Inicio · Solicitar tiempo extra · Mis solicitudes', () => {
    const items = itemsMenuPorRol({ ...base, areasSolicitante: ['mantenimiento'] });
    expect(items.map(i => i.label)).toEqual(['Inicio', 'Solicitar tiempo extra', 'Mis solicitudes']);
    expect(items[1].path).toBe('/tiempo-extra/nueva');
    expect(items[2].path).toBe('/tiempo-extra/mis-solicitudes');
  });
  it('Aut. 1: lo del solicitante + Por autorizar (con contador) + Mi área', () => {
    const items = itemsMenuPorRol({ ...base, areasAut1: ['mantenimiento'] });
    expect(items.map(i => i.label)).toEqual(['Inicio', 'Solicitar tiempo extra', 'Mis solicitudes', 'Por autorizar', 'Mi área']);
    expect(items.find(i => i.id === 'autorizar')).toMatchObject({ path: '/tiempo-extra/autorizar', contador: 'autorizar' });
  });
  it('Aut. 2: Inicio · Por autorizar · Consulta · Organigrama (y Asignar roles); sin captura propia', () => {
    expect(ids({ esAut2: true })).toEqual(['inicio', 'autorizar', 'consulta', 'organigrama', 'asignar']);
  });
  it('varios roles: la unión, sin repetir', () => {
    const r = ids({ esAut2: true, areasAut1: ['moldes'], areasSolicitante: ['moldes', 'mantenimiento'] });
    expect(r).toEqual(['inicio', 'solicitar', 'mis', 'autorizar', 'consulta', 'organigrama', 'asignar']);
    expect(new Set(r).size).toBe(r.length);
  });
  it('el solicitante no ve organigrama; el Aut. 1 sí (su área); Aut. 2, RH y admin, completo', () => {
    expect(veOrganigrama({ esRH: false, esAut2: false, areasAut1: [] })).toBe(false);
    expect(veOrganigrama({ esRH: false, esAut2: false, areasAut1: ['moldes'] })).toBe(true);
    expect(veOrganigrama({ esRH: false, esAut2: true, areasAut1: [] })).toBe(true);
    expect(veOrganigrama({ esRH: true, esAut2: false, areasAut1: [] })).toBe(true);
    expect(ids({ areasSolicitante: ['moldes'] })).not.toContain('organigrama');
    expect(ids({ areasSolicitante: ['moldes'] })).not.toContain('area');
  });
  it('quien tiene transporte anterior ve "Transporte (consulta)" solo si el interruptor está encendido; los demás no', () => {
    expect(ids({ areasSolicitante: ['moldes'], transporteAnterior: true })).not.toContain('transporte');
    expect(ids({ areasSolicitante: ['moldes'], transporteAnterior: true, funciones: { transporteSuelto: true } })).toContain('transporte');
    expect(ids({ areasSolicitante: ['moldes'] })).not.toContain('transporte');
  });
  it('sin ningún rol solo hay Inicio', () => { expect(ids({})).toEqual(['inicio']); });
});

describe('saludo y descripción', () => {
  const formato = crearFormateadorNombres([]);
  it('nombre de pila, no el apellido', () => {
    expect(nombreDePila('ROMERO OSCAR', formato)).toBe('Oscar');
    expect(nombreDePila('MENDOZA ANSELMO', formato)).toBe('Anselmo');
    expect(nombreDePila('GOMEZ HERNANDEZ ISMAEL', formato)).toBe('Ismael');
  });
  it('si no se puede separar con seguridad, no adivina', () => {
    expect(nombreDePila('XXX YYY ZZZ', formato)).toBe('');
    expect(nombreDePila('', formato)).toBe('');
  });
  it('saludo por hora', () => {
    expect([saludoDeHora(9), saludoDeHora(15), saludoDeHora(21)]).toEqual(['Buenos días', 'Buenas tardes', 'Buenas noches']);
  });
  it('subtítulo según el rol', () => {
    expect(descripcionRoles({ areasSolicitante: ['mantenimiento'], areasAut1: [] }, nombres)).toBe('Solicitante · Mantenimiento');
    expect(descripcionRoles({ areasSolicitante: [], areasAut1: ['mantenimiento'] }, nombres)).toBe('Autorización 1 · Mantenimiento');
    expect(descripcionRoles({ areasSolicitante: ['mantenimiento'], areasAut1: ['mantenimiento'] }, nombres)).toBe('Solicitante y Autorización 1 · Mantenimiento');
    expect(descripcionRoles({ esAut2: true, areasSolicitante: [], areasAut1: [] }, nombres)).toBe('Autorización 2');
    expect(descripcionRoles({ esRH: true, esAdmin: true, areasSolicitante: [], areasAut1: [] }, nombres)).toBe('Administrador');
    expect(descripcionRoles({ esRH: true, areasSolicitante: [], areasAut1: [] }, nombres)).toBe('Recursos Humanos');
  });
});

// REGLA: admin y RH ven TODO lo que veían antes (más lo nuevo). Si esta prueba falla, se quitó un acceso.
describe('menú de admin y RH: no se les quita nada', () => {
  const PATHS_OBLIGATORIOS = [
    '/', '/rutas', '/rutas/rh/solicitudes', '/rutas/rh/catalogos',
    '/tiempo-extra', '/tiempo-extra/nueva', '/tiempo-extra/mis-solicitudes', '/tiempo-extra/autorizar',
    '/tiempo-extra/recepcion', '/tiempo-extra/consulta', '/accesos/organigrama',
    '/rutas/rh/empleados', '/rutas/rh/estructura', '/accesos',
  ];
  const SECCIONES = ['Transporte (rutas)', 'Tiempo extra', 'Administración'];
  // Mismos criterios que modulos.js: transporte = rol RH/admin; tiempo extra = accesos.tieneAcceso (RH lo trae por su rol)
  const menuDe = (rol) => {
    const a = calcularAccesos([], { rol });
    const idsModulos = new Set([ROLES_RH.includes(rol) && 'rutas', (a.esRH || a.esAut2) && 'tiempo-extra'].filter(Boolean));
    return itemsMenuRH({ esRH: a.esRH, idsModulos });
  };

  for (const rol of ['admin', 'rh']) {
    it(`${rol}: portal, Transporte, Tiempo extra completo, Estructura, Catálogos, Usuarios y accesos, Recepción y Consulta`, () => {
      const items = menuDe(rol);
      expect(items.filter(i => !i.section).map(i => i.path)).toEqual(PATHS_OBLIGATORIOS);
      expect(items.filter(i => i.section).map(i => i.section)).toEqual(SECCIONES);
    });
  }
  it('un usuario común (sin RH ni Aut. 2) no recibe el menú de RH', () => {
    expect(itemsMenuRH({ esRH: false, idsModulos: new Set() }).map(i => i.path)).toEqual(['/']);
  });
  it('admin y RH tienen el mismo menú', () => { expect(menuDe('admin')).toEqual(menuDe('rh')); });
});
