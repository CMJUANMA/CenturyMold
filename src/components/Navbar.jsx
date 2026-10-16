/**
 * Navbar.jsx — Menú lateral de Century Mold.
 * RH y admin: menú por secciones (Tiempo extra, Transporte, Personal y estructura, y Herramientas para el admin).
 * Todos los demás: un menú plano según los roles que tienen hoy (solicitante, Aut. 1, Aut. 2), con la unión de lo que le toca
 * a cada rol (utils/navegacion.js). Su Inicio es su propio panel.
 *
 * Diseño: logo con su espacio, secciones con títulos pequeños, el ítem activo marcado con el acento de la marca, contadores discretos.
 * En celular es un cajón: barra superior con el botón de menú y cada opción mide 44 px de alto para tocarse bien.
 */
import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, FilePlus, ClipboardList, Layers, Users, Database, LayoutGrid, ShieldCheck, User, LogOut, Menu, X, Clock, Network,
  GitBranch, BadgeCheck, Bus, Inbox, Wrench, Palette,
} from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../hooks/useAuth';
import { useAccesos } from '../hooks/useAccesos';
import { usePendientesRutas, usePorAutorizar, usePorRecibir } from '../hooks/usePendientes';
import { useTransporteAnterior } from '../hooks/useTransporteAnterior';
import { useAreas } from '../hooks/useAreas';
import { ROLES_RH } from '../utils/roles';
import { FUNCIONES, RUTAS_TRANSPORTE_SUELTO } from '../funciones';
import { RUTAS } from '../rutas';
import { descripcionRoles, itemsMenuPorRol, itemsMenuRH } from '../utils/navegacion';

const ICONOS = { Home, FilePlus, ClipboardList, BadgeCheck, Layers, GitBranch, ShieldCheck, Bus, LayoutGrid, Database, Clock, Inbox, Users, Network, Wrench, Palette };

/** Contador discreto: gris; con pendientes, tono de aviso. Lleva texto para lectores de pantalla ("3 pendientes"). */
function Contador({ n, aviso = true }) {
  if (!(n > 0)) return null;
  return (
    <span aria-label={`${n} pendientes`}
      className={`ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md px-1.5 text-xs font-medium tabular-nums ${aviso
        ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
        : 'bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]'}`}>
      {n}
    </span>
  );
}

export default function Navbar() {
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const accesos = useAccesos();
  const { pendientesRh, novedades: novedadesUser } = usePendientesRutas(usuario, accesos);

  const esRH = ROLES_RH.includes(usuario?.rol);
  const { nombres: nombresArea } = useAreas();
  const transporteAnterior = useTransporteAnterior(usuario?.uid, !esRH && FUNCIONES.transporteSuelto);
  const porAutorizar = usePorAutorizar(usuario, accesos, true).total;
  const porRecibir = usePorRecibir(usuario, true);
  const descripcion = descripcionRoles(accesos, nombresArea);

  // RH/admin: por secciones (utils/navegacion.js); los demás: menú plano por rol
  const lista = esRH ? itemsMenuRH({ esRH, esAdmin: accesos.esAdmin }) : itemsMenuPorRol({ ...accesos, transporteAnterior });
  const items = lista.map(it => ({ ...it, icon: ICONOS[it.icono] ?? Home }));

  const handleCerrarSesion = async () => {
    await cerrarSesion();
    navigate('/login', { replace: true });
  };

  const cerrarMenu = () => setMenuAbierto(false);

  // El cajón se cierra al navegar y con Escape
  useEffect(() => { setMenuAbierto(false); }, [pathname]);
  useEffect(() => {
    if (!menuAbierto) return;
    const tecla = (e) => { if (e.key === 'Escape') setMenuAbierto(false); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [menuAbierto]);

  return (
    <>
      {/* Barra superior (celular y tableta) */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between gap-2 border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-3 lg:hidden">
        <button type="button" id="btn-menu-movil" onClick={() => setMenuAbierto(v => !v)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]"
          aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuAbierto} aria-controls="menu-lateral">
          {menuAbierto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <NavLink to={RUTAS.inicio} aria-label="Century Mold, ir al inicio" className="rounded-md"><Logo className="w-32" /></NavLink>
        <NavLink to={RUTAS.miCuenta} aria-label="Mi cuenta" title="Mi cuenta"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]">
          <User className="h-5 w-5" />
        </NavLink>
      </header>

      {menuAbierto && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={cerrarMenu} aria-hidden="true" />}

      <aside id="menu-lateral" aria-label="Menú principal"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[var(--border-color)] bg-[var(--bg-sidebar)] transition-transform duration-200 ease-out lg:z-40 lg:w-72 ${menuAbierto ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* Logo con su espacio */}
        <div className="flex h-14 shrink-0 items-center px-6">
          <NavLink to={RUTAS.inicio} aria-label="Century Mold, ir al inicio" className="rounded-md"><Logo className="w-40" /></NavLink>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-2" aria-label="Secciones">
          {items.map((item, idx) => {
            if (item.section) return (
              <div key={`sec-${idx}`} className="px-3 pb-1 pt-3 text-xs font-semibold uppercase leading-4 tracking-wider text-[var(--text-muted)]">
                {item.section}
              </div>
            );
            const Icono = item.icon;
            return (
              <NavLink key={item.path} to={item.path} end={item.end} onClick={cerrarMenu}
                className={({ isActive }) =>
                  `group relative flex min-h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-150 lg:min-h-9 ${isActive
                    ? 'bg-[var(--accent-soft)] font-medium text-[var(--accent-text)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]'}`
                }>
                {({ isActive }) => (
                  <>
                    {isActive && <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-[var(--accent)]" />}
                    <Icono className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                    {item.contador === 'autorizar' && <Contador n={porAutorizar} />}
                    {item.contador === 'recepcion' && <Contador n={porRecibir} />}
                    {item.path === RUTAS.transporteSolicitudes && FUNCIONES.transporteSuelto && <Contador n={pendientesRh} />}
                    {item.path === RUTAS_TRANSPORTE_SUELTO.misSolicitudes && <Contador n={novedadesUser} aviso={false} />}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Pie compacto: nombre en una línea, rol pequeño, y cerrar sesión al lado */}
        <div className="flex shrink-0 items-center gap-1 border-t border-[var(--border-color)] p-2">
          <NavLink to={RUTAS.miCuenta} onClick={cerrarMenu} title="Mi cuenta"
            className={({ isActive }) =>
              `flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 transition-colors duration-150 lg:min-h-10 ${isActive ? 'bg-[var(--bg-surface-hover)]' : 'hover:bg-[var(--bg-surface-hover)]'}`
            }>
            <User className="h-[18px] w-[18px] shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium text-[var(--text-main)]">{usuario?.nombre ?? 'Usuario'}</span>
              <span className="block truncate text-xs text-[var(--text-muted)]" title={descripcion}>{descripcion || 'Mi cuenta'}</span>
            </span>
          </NavLink>
          <button type="button" id="btn-cerrar-sesion" onClick={handleCerrarSesion} title="Cerrar sesión" aria-label="Cerrar sesión"
            className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)] lg:h-10 lg:w-10">
            <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>
      </aside>
    </>
  );
}
