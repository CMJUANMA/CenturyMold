// Modales, paneles y menús flotantes: reglas de construcción que evitan que se salgan de la pantalla. (El comportamiento real, en cada medida de pantalla,
// zoom y «Letra grande», lo revisa scripts/modales.mjs con Playwright.)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const archivos = (dir) => readdirSync(dir).flatMap(n => {
  const f = join(dir, n);
  return statSync(f).isDirectory() ? archivos(f) : /\.(jsx|js)$/.test(f) ? [f] : [];
});
const fuentes = archivos('src').map(f => ({ f: f.replace(/\\/g, '/'), c: readFileSync(f, 'utf8') }));
const css = readFileSync('src/index.css', 'utf8');
const leer = (f) => readFileSync(f, 'utf8');

describe('Modal compartido', () => {
  const m = leer('src/components/Modal.jsx');
  it('se dibuja en un portal sobre <body> (ningún ancestro con transform lo descoloca)', () => {
    expect(m).toContain('createPortal');
    expect(m).toContain('document.body');
  });
  it('alto máximo = alto visible (dvh) con respaldo en vh, encabezado fijo y contenido con scroll interno', () => {
    expect(css).toMatch(/\.modal-panel\s*\{[^}]*max-height:\s*calc\(100vh[^}]*max-height:\s*calc\(100dvh/);
    expect(m).toContain('modal-panel');
    expect(m).toContain('overflow-y-auto');
    expect(m).toContain('shrink-0'); // encabezado y pie no se encogen ni se desplazan
    expect(m).toContain('min-h-0');
  });
  it('en celular es una hoja de todo el ancho pegada abajo; desde 640 px, centrada con su ancho máximo', () => {
    expect(m).toContain('items-end');
    expect(m).toContain('sm:items-center');
    expect(m).toContain('rounded-t-xl');
    expect(m).toMatch(/'max-w-4xl': 'sm:max-w-4xl'/);
  });
  it('tiene pie fijo opcional, botón de cerrar de 44 px y bloquea el scroll del fondo', () => {
    expect(m).toContain('pie');
    expect(m).toContain('h-11 w-11');
    expect(m).toContain('useBloqueoScroll');
    expect(leer('src/hooks/useBloqueoScroll.js')).toContain("el.style.overflow = 'hidden'");
  });
  it('Escape cierra solo la de encima, el foco se queda dentro y regresa al cerrar', () => {
    expect(m).toContain('abiertas');
    expect(m).toContain("e.key === 'Tab'");
    expect(m).toContain('previo.focus');
  });
});

describe('nada más pinta su propio fondo de modal', () => {
  const PERMITIDOS = ['src/components/Modal.jsx', 'src/components/Recorrido.jsx', 'src/components/Navbar.jsx', 'src/pages/rh/accesos/PanelPersona.jsx'];
  it('los overlays «fixed inset-0» solo existen en el Modal, el recorrido, el menú lateral y el panel de personas', () => {
    const fuera = fuentes.filter(({ f, c }) => /fixed inset-0/.test(c) && !PERMITIDOS.includes(f)).map(x => x.f);
    expect(fuera).toEqual([]);
  });
  it('los paneles y el recorrido también van en un portal', () => {
    expect(leer('src/pages/rh/accesos/PanelPersona.jsx')).toContain('createPortal');
    expect(leer('src/components/Recorrido.jsx')).toContain('createPortal');
  });
  it('el panel de personas y el menú lateral bloquean el scroll del fondo', () => {
    expect(leer('src/pages/rh/accesos/PanelPersona.jsx')).toContain('useBloqueoScroll');
    expect(leer('src/components/Navbar.jsx')).toContain('useBloqueoScroll');
  });
  it('la importación y el cambio de área de «Confirmar áreas» usan el Modal compartido', () => {
    expect(leer('src/pages/rh/ModalImportacion.jsx')).toContain('<Modal');
    expect(leer('src/pages/rh/ConfirmarAreas.jsx')).toContain('<Modal');
  });
});

describe('las animaciones de entrada no dejan un transform puesto', () => {
  it('.anim-pagina y .anim-panel usan fill-mode backwards (con «both» quedaba transform: matrix(1,0,0,1,0,0) y los position: fixed de adentro se descolocaban)', () => {
    expect(css).toMatch(/\.anim-pagina\s*\{[^}]*backwards/);
    expect(css).toMatch(/\.anim-panel\s*\{[^}]*backwards/);
    expect(css).not.toMatch(/\.anim-pagina\s*\{[^}]*\bboth\b/);
  });
});
