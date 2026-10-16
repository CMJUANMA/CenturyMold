// Menú, saludo y descripción por rol. Datos ficticios.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RUTAS } from '../src/rutas.js';
import { descripcionRoles, itemsMenuPorRol, itemsMenuRH, nombreDePila, saludoDeHora, veOrganigrama } from '../src/utils/navegacion.js';
import { calcularAccesos } from '../src/utils/asignaciones.js';
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

// REGLA: admin y RH ven todo su menú (el menú nuevo: Tiempo extra · Transporte · Personal y estructura). Si esta prueba falla, se quitó un acceso.
describe('menú de admin y RH: ven todo su menú', () => {
  const PATHS_OBLIGATORIOS = [
    '/',
    '/tiempo-extra/nueva', '/tiempo-extra/mis-solicitudes', '/tiempo-extra/autorizar', '/tiempo-extra/recepcion', '/tiempo-extra/consulta',
    '/transporte/solicitudes', '/transporte/catalogos',
    '/personal/padron', '/personal/estructura', '/personal/accesos', '/personal/accesos/organigrama',
  ];
  const SECCIONES = ['Tiempo extra', 'Transporte', 'Personal y estructura'];
  const menuDe = (rol) => {
    const a = calcularAccesos([], { rol });
    return itemsMenuRH({ esRH: a.esRH, esAdmin: a.esAdmin });
  };

  for (const rol of ['admin', 'rh']) {
    it(`${rol}: Inicio, Tiempo extra completo, Solicitudes de transporte, Rutas y puntos, Padrón, Estructura, Usuarios y accesos y Organigrama`, () => {
      const items = menuDe(rol);
      // el admin suma Herramientas (/herramientas); RH ve exactamente el resto
      const esperadas = rol === 'admin' ? [...PATHS_OBLIGATORIOS, '/herramientas', '/herramientas/guia-de-estilo'] : PATHS_OBLIGATORIOS;
      expect(items.filter(i => !i.section).map(i => i.path)).toEqual(esperadas);
      expect(items.filter(i => i.section).map(i => i.section)).toEqual(rol === 'admin' ? [...SECCIONES, 'Herramientas'] : SECCIONES);
    });
  }
  it('los nombres son los acordados', () => {
    expect(menuDe('rh').filter(i => !i.section).map(i => i.label)).toEqual([
      'Inicio', 'Solicitar tiempo extra', 'Mis solicitudes', 'Por autorizar', 'Por enviar al proveedor', 'Todas las solicitudes',
      'Solicitudes de transporte', 'Rutas y puntos de reunión', 'Padrón de empleados', 'Estructura', 'Usuarios y accesos', 'Organigrama',
    ]);
  });
  it('ya no hay dos "Resumen" ni etiquetas repetidas', () => {
    const etiquetas = menuDe('rh').filter(i => !i.section).map(i => i.label);
    expect(etiquetas).not.toContain('Resumen');
    expect(new Set(etiquetas).size).toBe(etiquetas.length);
  });
  it('un usuario común (sin RH ni Aut. 2) no recibe el menú de RH', () => {
    expect(itemsMenuRH({ esRH: false }).map(i => i.path)).toEqual(['/']);
  });
});

describe('menú nuevo por rol y rutas', () => {
  it('Aut. 2: Inicio · Por autorizar · Todas las solicitudes · Organigrama · Asignar roles', () => {
    expect(itemsMenuPorRol({ ...base, esAut2: true }).map(i => i.label)).toEqual(['Inicio', 'Por autorizar', 'Todas las solicitudes', 'Organigrama', 'Asignar roles']);
  });
  it('Aut. 1: Inicio · Solicitar · Mis solicitudes · Por autorizar · Mi área; solicitante: Inicio · Solicitar · Mis solicitudes', () => {
    expect(itemsMenuPorRol({ ...base, areasAut1: ['moldes'] }).map(i => i.label)).toEqual(['Inicio', 'Solicitar tiempo extra', 'Mis solicitudes', 'Por autorizar', 'Mi área']);
    expect(itemsMenuPorRol({ ...base, areasSolicitante: ['moldes'] }).map(i => i.label)).toEqual(['Inicio', 'Solicitar tiempo extra', 'Mis solicitudes']);
  });
  it('sin rol: solo Inicio', () => {
    expect(itemsMenuPorRol(base).map(i => i.label)).toEqual(['Inicio']);
  });
  it('las URLs viejas /rutas/rh/*, /accesos, /perfil de transporte ya no existen en rutas.js', () => {
    for (const url of Object.values(RUTAS)) expect(url).not.toMatch(/^\/rutas\/|^\/accesos/);
  });
  it('cada URL del menú está registrada en App.jsx (por su nombre en RUTAS) y las pestañas cuelgan de /personal/accesos', () => {
    const app = readFileSync('src/App.jsx', 'utf8');
    for (const k of ['transporteSolicitudes', 'transporteCatalogos', 'padron', 'estructura', 'accesos', 'teNueva', 'teMisSolicitudes', 'teAutorizar', 'teConsulta', 'teRecepcion']) {
      expect(app, k).toContain(`RUTAS.${k}`);
    }
    expect(RUTAS.organigrama.startsWith(`${RUTAS.accesos}/`)).toBe(true);
    expect(RUTAS.asignaciones.startsWith(`${RUTAS.accesos}/`)).toBe(true);
    expect(app).toContain("path: '*'");
  });
  it('no quedan las 9 redirecciones de URLs anteriores', () => {
    expect(readFileSync('src/App.jsx', 'utf8')).not.toContain('Redirigir');
  });
});

describe('Herramientas y Mi cuenta', () => {
  it('"Herramientas" (Diagnóstico y limpieza) solo para admin; RH no la ve', () => {
    const admin = itemsMenuRH({ esRH: true, esAdmin: true });
    const rh = itemsMenuRH({ esRH: true, esAdmin: false });
    expect(admin.filter(i => i.section).map(i => i.section)).toEqual(['Tiempo extra', 'Transporte', 'Personal y estructura', 'Herramientas']);
    expect(admin.map(i => i.path)).toContain(RUTAS.herramientas);
    expect(rh.map(i => i.path)).not.toContain(RUTAS.herramientas);
    expect(rh.filter(i => i.section).map(i => i.section)).not.toContain('Herramientas');
  });
  it('Mi cuenta es una sola URL y ya no existen /perfil ni /configuracion', () => {
    expect(RUTAS.miCuenta).toBe('/mi-cuenta');
    const app = readFileSync('src/App.jsx', 'utf8');
    expect(app).toContain('RUTAS.miCuenta');
    expect(app).not.toMatch(/['"]\/(perfil|configuracion)['"]/);
  });
  it('Herramientas está registrada solo para el rol admin', () => {
    const app = readFileSync('src/App.jsx', 'utf8');
    expect(app).toMatch(/RutaRol roles=\{\['admin'\]\}[\s\S]*RUTAS\.herramientas/);
  });
});
