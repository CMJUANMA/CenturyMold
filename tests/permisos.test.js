// Matriz de permisos por rol y por combinación: menú, rutas y acciones. Datos ficticios, sin Firebase.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CAPACIDADES, COLUMNAS, COMBINACIONES, GRUPOS_DE_RUTAS, MATRIZ, RUTAS_PROTEGIDAS, accesosDePerfil, bloquesDeInicio, matrizEnMarkdown,
  menuDePerfil, pestanasAccesos, perfilDe, puedeEntrar, sugiereRolRH,
} from '../src/utils/permisos.js';
import { RUTAS, rutaAccesos } from '../src/rutas.js';

const TODOS = [...COLUMNAS, ...COMBINACIONES];
const col = (id) => COLUMNAS.find(c => c.id === id);
const filas = (perfil) => MATRIZ.filter(f => f.quien(accesosDePerfil(perfil))).map(f => f.id);
const rutasDelMenu = (perfil) => menuDePerfil(perfil).filter(i => !i.section).map(i => i.path);

// Lo que cada columna debe ver, escrito A MANO (no sale de la matriz): si alguien cambia un permiso, esta prueba lo avisa.
const ESPERADO = {
  admin: ['inicio', 'miCuenta', 'teNueva', 'teMisSolicitudes', 'teAutorizar', 'teConsulta', 'teRecepcion', 'transporteSolicitudes', 'transporteCatalogos',
    'padron', 'estructura', 'accesos', 'accesosUsuarios', 'accesosAsignaciones', 'organigrama', 'herramientas', 'vistaPrevia', 'respaldoCompleto', 'guiaEstilo',
    'capturarSinTE', 'firmarNivel2', 'confirmarRH', 'cancelarRH', 'formatoRutas', 'exportarConsulta', 'editarPadron', 'editarEstructura', 'estructuraInicial',
    'nuevoUsuario', 'editarUsuario', 'darRolRH', 'darRolAdmin', 'restablecerPassword', 'asignarAut1', 'asignarAut2', 'historialPersona', 'cargaAsignaciones', 'cambiarPassword'],
  rh: ['inicio', 'miCuenta', 'teNueva', 'teMisSolicitudes', 'teAutorizar', 'teConsulta', 'teRecepcion', 'transporteSolicitudes', 'transporteCatalogos',
    'padron', 'estructura', 'accesos', 'accesosUsuarios', 'accesosAsignaciones', 'organigrama',
    'capturarSinTE', 'firmarNivel2', 'confirmarRH', 'cancelarRH', 'formatoRutas', 'exportarConsulta', 'editarPadron', 'editarEstructura',
    'nuevoUsuario', 'editarUsuario', 'darRolRH', 'restablecerPassword', 'asignarAut1', 'historialPersona', 'cambiarPassword'],
  aut2: ['inicio', 'miCuenta', 'teNueva', 'teMisSolicitudes', 'teAutorizar', 'teConsulta', 'accesos', 'accesosUsuarios', 'accesosAsignaciones', 'organigrama',
    'capturarSinTE', 'autorizarLoPropio', 'firmarNivel2', 'exportarConsulta', 'nuevoUsuario', 'editarUsuario', 'darRolRH', 'restablecerPassword', 'asignarAut1',
    'historialPersona', 'cambiarPassword'],
  aut1: ['inicio', 'miCuenta', 'teNueva', 'teMisSolicitudes', 'teAutorizar', 'accesos', 'organigrama', 'capturarArea', 'firmarNivel1', 'cambiarPassword'],
  solicitante: ['inicio', 'miCuenta', 'teNueva', 'teMisSolicitudes', 'capturarArea', 'cambiarPassword'],
  sinRol: ['inicio', 'miCuenta', 'cambiarPassword'],
};

describe('matriz: lo que ve cada rol', () => {
  for (const c of COLUMNAS) {
    it(`${c.etiqueta}: exactamente lo acordado`, () => {
      expect(filas(c.perfil).sort()).toEqual([...ESPERADO[c.id]].sort());
    });
  }
  it('cada fila tiene un id único y las pantallas traen su ruta', () => {
    const ids = MATRIZ.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of MATRIZ.filter(x => x.tipo === 'pantalla')) expect(f.ruta, f.id).toMatch(/^\//);
  });
});

describe('combinaciones: la unión de lo que le toca a cada rol', () => {
  const miembros = {
    'rh+aut2': ['rh', 'aut2'], 'admin+aut1': ['admin', 'aut1'], 'admin+aut2': ['admin', 'aut2'], 'rh+solicitante': ['rh', 'solicitante'],
    'aut2+aut1': ['aut2', 'aut1'], 'aut2+solicitante': ['aut2', 'solicitante'], 'aut1+solicitante': ['aut1', 'solicitante'],
    'aut2+aut1+solicitante': ['aut2', 'aut1', 'solicitante'], 'rh+aut2+aut1+solicitante': ['rh', 'aut2', 'aut1', 'solicitante'],
  };
  for (const c of COMBINACIONES) {
    it(`${c.etiqueta}: ve la unión, ni más ni menos`, () => {
      const union = new Set(miembros[c.id].flatMap(m => ESPERADO[m]));
      expect(new Set(filas(c.perfil))).toEqual(union);
    });
  }
  it('RH + Aut. 2 conserva todo RH y suma firmar como Aut. 2 sin ganar Herramientas ni dar Administrador/Aut. 2', () => {
    const f = filas(COMBINACIONES.find(c => c.id === 'rh+aut2').perfil);
    expect(f).toEqual(expect.arrayContaining(ESPERADO.rh));
    for (const no of ['herramientas', 'vistaPrevia', 'darRolAdmin', 'asignarAut2', 'cargaAsignaciones']) expect(f).not.toContain(no);
  });
  it('Admin + Aut. 1 ve el menú de admin (que ya incluye Mi área/Organigrama) y firma nivel 1 y 2', () => {
    const f = filas(COMBINACIONES.find(c => c.id === 'admin+aut1').perfil);
    expect(f).toEqual(expect.arrayContaining(['herramientas', 'firmarNivel1', 'firmarNivel2', 'capturarArea', 'asignarAut2']));
  });
});

describe('menú: cada ítem aparece si y solo si la matriz lo permite', () => {
  for (const c of TODOS) {
    it(`${c.etiqueta}`, () => {
      const a = accesosDePerfil(c.perfil);
      const menu = rutasDelMenu(c.perfil);
      for (const f of MATRIZ.filter(x => x.tipo === 'pantalla')) {
        // La vista previa comparte URL con Herramientas: se revisa con la fila de Herramientas
        if (f.id === 'vistaPrevia') continue;
        const enEseMenu = f.menu === 'ambos' || f.menu === (a.esRH ? 'rh' : 'otros');
        expect(menu.includes(f.ruta), `${c.etiqueta} › ${f.id} (${f.ruta})`).toBe(enEseMenu && f.quien(a));
      }
    });
    it(`${c.etiqueta}: el menú no trae nada que la matriz no conozca`, () => {
      const conocidas = new Set(MATRIZ.filter(f => f.tipo === 'pantalla').map(f => f.ruta));
      for (const ruta of rutasDelMenu(c.perfil)) expect(conocidas.has(ruta), ruta).toBe(true);
    });
  }
  it('sin rol solo ve Inicio', () => { expect(rutasDelMenu(col('sinRol').perfil)).toEqual(['/']); });
});

describe('rutas permitidas', () => {
  const pantallas = MATRIZ.filter(f => f.tipo === 'pantalla' && RUTAS_PROTEGIDAS.some(r => r.ruta === f.ruta));
  for (const c of TODOS) {
    it(`${c.etiqueta}: entra a una ruta si y solo si la matriz dice que ve esa pantalla`, () => {
      const a = accesosDePerfil(c.perfil);
      for (const f of pantallas) expect(puedeEntrar(f.ruta, a), `${c.etiqueta} › ${f.ruta}`).toBe(f.quien(a));
    });
  }
  it('la edición de tiempo extra y las pestañas de accesos siguen a sus pantallas', () => {
    for (const c of TODOS) {
      const a = accesosDePerfil(c.perfil);
      expect(puedeEntrar(RUTAS.teEditar, a)).toBe(puedeEntrar(RUTAS.teNueva, a));
      expect(puedeEntrar(`${RUTAS.accesos}/:tab`, a)).toBe(puedeEntrar(RUTAS.accesos, a));
    }
  });
  it('las pestañas de Usuarios y accesos salen de la matriz', () => {
    const ver = (id) => pestanasAccesos(accesosDePerfil(col(id).perfil));
    expect(ver('admin')).toEqual(['usuarios', 'asignaciones', 'organigrama']);
    expect(ver('rh')).toEqual(['usuarios', 'asignaciones', 'organigrama']);
    expect(ver('aut2')).toEqual(['usuarios', 'asignaciones', 'organigrama']);
    expect(ver('aut1')).toEqual(['organigrama']);
    expect(ver('solicitante')).toEqual([]);
    expect(ver('sinRol')).toEqual([]);
    const f = (id) => MATRIZ.find(x => x.id === id);
    for (const c of TODOS) {
      const a = accesosDePerfil(c.perfil);
      expect(f('accesosUsuarios').quien(a)).toBe(pestanasAccesos(a).includes('usuarios'));
      expect(f('accesosAsignaciones').quien(a)).toBe(pestanasAccesos(a).includes('asignaciones'));
      expect(f('organigrama').quien(a)).toBe(pestanasAccesos(a).includes('organigrama'));
    }
  });
  it('Herramientas y la Guía de estilo son solo del rol admin', () => {
    for (const c of TODOS) {
      const a = accesosDePerfil(c.perfil);
      expect(puedeEntrar(RUTAS.herramientas, a)).toBe(c.perfil.rol === 'admin');
      expect(puedeEntrar(RUTAS.guiaEstilo, a)).toBe(c.perfil.rol === 'admin');
    }
  });
});

describe('App.jsx arma sus rutas desde la matriz', () => {
  const app = readFileSync('src/App.jsx', 'utf8');
  it('cada ruta protegida tiene su pantalla y no quedan guardias a mano', () => {
    for (const r of RUTAS_PROTEGIDAS) expect(app, r.id).toMatch(new RegExp(`\\b${r.id}: <`));
    expect(app).not.toMatch(/RutaRol|RutaCapacidad|RutaAcceso/);
    expect(app).toContain('GRUPOS_DE_RUTAS');
  });
  it('toda capacidad usada por una ruta existe', () => {
    for (const g of GRUPOS_DE_RUTAS) expect(CAPACIDADES[g], g).toBeTypeOf('function');
  });
  it('las rutas del tiempo extra, transporte, personal y herramientas están todas protegidas', () => {
    const registradas = RUTAS_PROTEGIDAS.map(r => r.ruta);
    for (const k of ['teNueva', 'teEditar', 'teMisSolicitudes', 'teAutorizar', 'teConsulta', 'teRecepcion', 'transporteSolicitudes', 'transporteCatalogos',
      'padron', 'estructura', 'accesos', 'herramientas', 'guiaEstilo', 'miCuenta']) expect(registradas).toContain(RUTAS[k]);
    expect(registradas).toContain(`${RUTAS.accesos}/:tab`);
    expect(rutaAccesos('usuarios').startsWith(RUTAS.accesos)).toBe(true);
  });
});

describe('Inicio por perfil (vista previa)', () => {
  it('RH y admin ven indicadores; los demás, su panel', () => {
    expect(bloquesDeInicio(col('rh').perfil).tipo).toMatch(/RH/);
    expect(bloquesDeInicio(col('admin').perfil).tipo).toMatch(/RH/);
    expect(bloquesDeInicio(col('aut1').perfil).tipo).toBe('Panel por rol');
  });
  it('sin rol: aviso de que no tiene acceso; Aut. 2: bloque de planta; solicitante: botón de solicitar', () => {
    expect(bloquesDeInicio(col('sinRol').perfil).bloques.join(' ')).toMatch(/Aún no tienes acceso/);
    expect(bloquesDeInicio(col('aut2').perfil).bloques.join(' ')).toMatch(/Planta/);
    expect(bloquesDeInicio(col('solicitante').perfil).accion).toMatch(/Solicitar tiempo extra/);
  });
});

describe('aviso: Aut. 2 con rol del sistema «usuario»', () => {
  const aut2 = (nomina) => ({ nomina, rol: 'aut2', areaId: null });
  it('avisa solo si es «usuario» y tiene Aut. 2 vigente propia', () => {
    expect(sugiereRolRH({ rol: 'usuario', nomina: '10' }, [aut2('10')])).toBe(true);
    expect(sugiereRolRH({ rol: 'usuario', nomina: 10 }, [aut2('10')])).toBe(true);
    expect(sugiereRolRH({ rol: 'rh', nomina: '10' }, [aut2('10')])).toBe(false);
    expect(sugiereRolRH({ rol: 'admin', nomina: '10' }, [aut2('10')])).toBe(false);
    expect(sugiereRolRH({ rol: 'usuario', nomina: '11' }, [aut2('10')])).toBe(false);
    expect(sugiereRolRH({ rol: 'usuario', nomina: '10' }, [{ nomina: '10', rol: 'aut1', areaId: 'x' }])).toBe(false);
    expect(sugiereRolRH({ rol: 'usuario', nomina: '10' }, [])).toBe(false);
  });
});

describe('docs/permisos.md', () => {
  it('la tabla del documento es la que genera la matriz (corre npm run docs:permisos si falla)', () => {
    const doc = readFileSync('docs/permisos.md', 'utf8');
    const m = doc.match(/<!-- MATRIZ:INICIO -->\n([\s\S]*?)\n<!-- MATRIZ:FIN -->/);
    expect(m, 'faltan los marcadores MATRIZ:INICIO / MATRIZ:FIN').not.toBeNull();
    expect(m[1]).toBe(matrizEnMarkdown());
  });
});

describe('perfiles', () => {
  it('RH no es admin; admin sí cuenta como RH', () => {
    expect(perfilDe({ aut1: true, solicitante: true }).areasAut1).toHaveLength(1);
    expect(accesosDePerfil(perfilDe({ rol: 'rh' })).esRH).toBe(true);
    expect(accesosDePerfil(perfilDe({ rol: 'rh' })).esAdmin).toBe(false);
    expect(accesosDePerfil(perfilDe({ rol: 'admin' })).esRH).toBe(true);
  });
});
