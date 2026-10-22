// Rol Nóminas: etiqueta, accesos, menú propio, filtro de turno y los números de su Inicio. Datos ficticios, sin Firebase.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROLES, ROLES_ENVIAN_PROVEEDOR, ROL_LABELS } from '../src/utils/constantes.js';
import { calcularAccesos } from '../src/utils/asignaciones.js';
import { ITEMS_MENU_NOMINA, descripcionRoles, itemsMenuNomina } from '../src/utils/navegacion.js';
import { filtrarSolicitudes, turnosDeTE } from '../src/utils/tiempoExtra.js';
import { resumenNomina } from '../src/utils/resumenInicio.js';
import { RUTAS } from '../src/rutas.js';

const labels = (items) => items.filter(i => !i.section).map(i => i.label);

describe('el rol Nóminas', () => {
  it('se llama «Nóminas» y es un rol del sistema junto a admin, rh y usuario', () => {
    expect(ROLES.NOMINA).toBe('nomina');
    expect(ROL_LABELS.nomina).toBe('Nóminas');
    expect(Object.values(ROLES).sort()).toEqual(['admin', 'nomina', 'rh', 'usuario']);
  });
  it('confirma lo que va al proveedor junto con RH y admin, pero no es RH', () => {
    expect(ROLES_ENVIAN_PROVEEDOR).toEqual(['rh', 'admin', 'nomina']);
    const a = calcularAccesos([], { rol: 'nomina' });
    expect([a.esNomina, a.esRH, a.esAdmin, a.esAut2]).toEqual([true, false, false, false]);
    expect(calcularAccesos([], { rol: 'rh' }).esNomina).toBe(false);
    expect(calcularAccesos([], { rol: 'usuario' }).esNomina).toBe(false);
  });
  it('se describe como «Nóminas», y con una asignación suma su rol de área', () => {
    const nombres = new Map([['moldes', 'Moldes']]);
    expect(descripcionRoles({ esNomina: true, areasSolicitante: [], areasAut1: [] }, nombres)).toBe('Nóminas');
    expect(descripcionRoles({ esNomina: true, areasSolicitante: ['moldes'], areasAut1: [] }, nombres)).toBe('Nóminas | Solicitante · Moldes');
  });
});

describe('menú de Nóminas', () => {
  it('Inicio · Tiempo extra · Por enviar al proveedor · Solicitudes de transporte · Formato de rutas · Personal · Estructura', () => {
    expect(labels(itemsMenuNomina())).toEqual(['Inicio', 'Tiempo extra', 'Por enviar al proveedor', 'Solicitudes de transporte', 'Formato de rutas', 'Personal', 'Estructura']);
  });
  it('lleva sus URLs y el contador de lo que falta por enviar', () => {
    const items = itemsMenuNomina();
    expect(items.filter(i => !i.section).map(i => i.path)).toEqual([
      RUTAS.inicio, RUTAS.teConsulta, RUTAS.teRecepcion, RUTAS.transporteSolicitudes, RUTAS.formatoRutas, RUTAS.padron, RUTAS.estructura,
    ]);
    expect(items.find(i => i.path === RUTAS.teRecepcion).contador).toBe('recepcion');
  });
  it('no trae nada de administración: ni usuarios, ni catálogos de rutas, ni herramientas, ni capturar o autorizar', () => {
    const rutas = itemsMenuNomina().map(i => i.path);
    for (const no of [RUTAS.accesos, RUTAS.asignaciones, RUTAS.organigrama, RUTAS.transporteCatalogos, RUTAS.herramientas, RUTAS.teNueva, RUTAS.teMisSolicitudes, RUTAS.teAutorizar]) {
      expect(rutas).not.toContain(no);
    }
  });
  it('con una asignación conserva sus ítems, sin repetir pantallas, justo debajo de Inicio', () => {
    expect(labels(itemsMenuNomina({ areasSolicitante: ['moldes'] })).slice(0, 4)).toEqual(['Inicio', 'Solicitar tiempo extra', 'Mis solicitudes', 'Tiempo extra']);
    const aut2 = itemsMenuNomina({ esAut2: true });
    const rutas = aut2.filter(i => !i.section).map(i => i.path);
    expect(new Set(rutas).size).toBe(rutas.length);
    expect(labels(aut2)).toEqual(expect.arrayContaining(['Por autorizar', 'Organigrama', 'Asignar roles', 'Tiempo extra']));
    expect(labels(aut2)).not.toContain('Todas las solicitudes');
  });
  it('deja el lugar de «Reportes de nómina» sin construirlo todavía', () => {
    expect(ITEMS_MENU_NOMINA.some(i => i.section === 'Reportes de nómina')).toBe(false);
    expect(readFileSync('src/utils/navegacion.js', 'utf8')).toContain('Reportes de nómina');
  });
});

describe('filtro de turno del tiempo extra', () => {
  const te = (id, porBloque, extra = {}) => ({ id, estatus: 'autorizada', areaId: 'moldes', fechaTE: '2026-10-22', resumen: { porBloque }, ...extra });
  const lista = [
    te('t1', { '7:00 → 16:00': 3 }),
    te('t2', { '16:00 → 0:00': 2 }),
    te('t3', { '0:00 → 7:00': 1 }),
    te('t4', { '7:00 → 16:00': 1, '16:00 → 0:00': 1 }),
    te('t5', { '19:00 → 7:00': 2 }),
    te('t6', {}),
  ];
  it('el turno sale de la hora de entrada de cada bloque (7:00 → 1 · 16:00 y 19:00 → 2 · 0:00 → 3)', () => {
    expect(turnosDeTE(lista[0])).toEqual(['1']);
    expect(turnosDeTE(lista[1])).toEqual(['2']);
    expect(turnosDeTE(lista[2])).toEqual(['3']);
    expect(turnosDeTE(lista[3])).toEqual(['1', '2']);
    expect(turnosDeTE(lista[4])).toEqual(['2']);
    expect(turnosDeTE(lista[5])).toEqual([]);
    expect(turnosDeTE({})).toEqual([]);
  });
  it('filtra por turno y se combina con área, estatus y fechas', () => {
    expect(filtrarSolicitudes(lista, { turno: '1' }).map(t => t.id)).toEqual(['t1', 't4']);
    expect(filtrarSolicitudes(lista, { turno: '2' }).map(t => t.id)).toEqual(['t2', 't4', 't5']);
    expect(filtrarSolicitudes(lista, { turno: '3' }).map(t => t.id)).toEqual(['t3']);
    expect(filtrarSolicitudes(lista, { turno: '' })).toHaveLength(6);
    expect(filtrarSolicitudes(lista, { turno: '1', areaId: 'otra' })).toHaveLength(0);
    expect(filtrarSolicitudes(lista, { turno: '2', estatus: 'cancelada' })).toHaveLength(0);
    expect(filtrarSolicitudes(lista, { turno: '2', desde: '2026-10-22', hasta: '2026-10-22' }).map(t => t.id)).toEqual(['t2', 't4', 't5']);
  });
});

describe('Inicio de Nóminas: autorizado de hoy y de la semana, por área', () => {
  // Jueves 22 de octubre de 2026 (la semana va del lunes 19 al domingo 25)
  const ahora = new Date(2026, 9, 22, 10, 0, 0);
  const nombres = new Map([['moldes', 'Moldes'], ['calidad', 'Calidad']]);
  const s = (id, areaId, fechaTE, estatus, empleados, horas) => ({ id, areaId, fechaTE, estatus, resumen: { totalEmpleados: empleados, totalHoras: horas } });
  const planta = [
    s('a', 'moldes', '2026-10-22', 'autorizada', 3, 24),
    s('b', 'moldes', '2026-10-22', 'procesada', 2, 16.5),
    s('c', 'calidad', '2026-10-22', 'autorizada', 1, 8),
    s('d', 'calidad', '2026-10-20', 'procesada', 4, 32),
    s('e', 'moldes', '2026-10-25', 'autorizada', 1, 4),
    s('f', 'moldes', '2026-10-26', 'autorizada', 9, 99), // la semana que entra
    s('g', 'moldes', '2026-10-18', 'procesada', 9, 99), // la semana anterior
    s('h', 'moldes', '2026-10-22', 'pendiente_aut2', 7, 70), // aún no autorizada
    s('i', 'moldes', '2026-10-22', 'cancelada', 7, 70),
    s('j', 'moldes', '2026-10-22', 'devuelta', 7, 70),
  ];
  const r = resumenNomina(planta, nombres, ahora);

  it('hoy: solo lo autorizado (autorizada o confirmada) del día, por área y en total', () => {
    expect(r.hoy.filas).toEqual([
      { areaId: 'calidad', nombre: 'Calidad', solicitudes: 1, empleados: 1, horas: 8 },
      { areaId: 'moldes', nombre: 'Moldes', solicitudes: 2, empleados: 5, horas: 40.5 },
    ]);
    expect(r.hoy.total).toEqual({ solicitudes: 3, empleados: 6, horas: 48.5 });
  });
  it('la semana va de lunes a domingo, por la fecha del tiempo extra', () => {
    expect(r.semana.total).toEqual({ solicitudes: 5, empleados: 11, horas: 84.5 });
    expect(r.semana.filas.map(f => [f.nombre, f.solicitudes, f.empleados, f.horas])).toEqual([['Calidad', 2, 5, 40], ['Moldes', 3, 6, 44.5]]);
  });
  it('lo pendiente de enviar al proveedor son las autorizadas sin confirmar, con las de fecha vencida aparte', () => {
    expect(r.porEnviar).toEqual({ total: 4, vencidas: 0, empleados: 14 });
    const viejo = resumenNomina([s('v', 'moldes', '2026-10-01', 'autorizada', 2, 8)], nombres, ahora);
    expect(viejo.porEnviar).toEqual({ total: 1, vencidas: 1, empleados: 2 });
  });
  it('sin solicitudes todo es 0', () => {
    const vacio = resumenNomina([], nombres, ahora);
    expect(vacio.hoy).toEqual({ filas: [], total: { solicitudes: 0, empleados: 0, horas: 0 } });
    expect(vacio.porEnviar.total).toBe(0);
  });
  it('un área sin nombre en el catálogo se muestra con su id', () => {
    expect(resumenNomina([s('z', 'nueva', '2026-10-22', 'autorizada', 1, 8)], new Map(), ahora).hoy.filas[0].nombre).toBe('nueva');
  });
});

describe('las pantallas de Nóminas no ofrecen lo que no puede hacer', () => {
  const lee = (f) => readFileSync(f, 'utf8');
  it('«Por enviar al proveedor» le deja solo confirmar (RH además devuelve y cancela)', () => {
    expect(lee('src/pages/te/RecepcionTE.jsx')).toContain("acciones={esRH ? ['cancelar', 'devolver', 'recibir'] : ['recibir']}");
  });
  it('Padrón y Estructura son de solo lectura para quien no es RH; Transporte no revisa', () => {
    expect(lee('src/pages/rh/RhEmpleados.jsx')).toContain('const soloLectura = !useAccesos().esRH;');
    expect(lee('src/pages/rh/Estructura.jsx')).toContain('const soloLectura = !useAccesos().esRH;');
    expect(lee('src/pages/rh/RhSolicitudes.jsx')).toContain('REVISION_ACTIVA && esRH');
  });
  it('en la consulta no cancela', () => {
    expect(lee('src/pages/te/ConsultaTE.jsx')).toContain('soloNomina ? null : cancelar');
  });
});
