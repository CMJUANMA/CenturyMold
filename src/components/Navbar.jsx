/**
 * Navbar.jsx — Barra lateral corporativa Century Mold.
 * RH y admin: menú por secciones (Tiempo extra, Transporte, Personal y estructura).
 * Todos los demás: un menú plano según los roles que tienen hoy (solicitante, Aut. 1, Aut. 2), con la unión de lo que le toca
 * a cada rol (utils/navegacion.js). No hay "portal de procesos" para ellos: su Inicio es su panel.
 */
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home, FilePlus, ClipboardList, Layers, Users, Database, LayoutGrid,
  ShieldCheck, User, LogOut, Menu, X, Settings, Clock, Network, GitBranch, BadgeCheck, Bus, Inbox, Wrench,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAccesos } from '../hooks/useAccesos';
import { usePendientesRutas, usePorAutorizar, usePorRecibir } from '../hooks/usePendientes';
import { useTransporteAnterior } from '../hooks/useTransporteAnterior';
import { useAreas } from '../hooks/useAreas';
import { ROLES_RH } from '../utils/roles';
import { FUNCIONES, RUTAS_TRANSPORTE_SUELTO } from '../funciones';
import { RUTAS } from '../rutas';
import { descripcionRoles, itemsMenuPorRol, itemsMenuRH } from '../utils/navegacion';

const ICONOS = { Home, FilePlus, ClipboardList, BadgeCheck, Layers, GitBranch, ShieldCheck, Bus, LayoutGrid, Database, Clock, Inbox, Users, Network, Wrench };

export default function Navbar() {
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const accesos = useAccesos();
  const { pendientesRh, novedades: novedadesUser } = usePendientesRutas(usuario, accesos);

  const esRH = ROLES_RH.includes(usuario?.rol);
  const { nombres: nombresArea } = useAreas();
  const transporteAnterior = useTransporteAnterior(usuario?.uid, !esRH && FUNCIONES.transporteSuelto);
  const porAutorizar = usePorAutorizar(usuario, accesos, true).total;
  const porRecibir = usePorRecibir(usuario, true);
  const subtitulo = 'Century Mold Querétaro';
  const descripcion = descripcionRoles(accesos, nombresArea);

  // RH/admin: por secciones (utils/navegacion.js); los demás: menú plano por rol
  const lista = esRH ? itemsMenuRH({ esRH, esAdmin: accesos.esAdmin }) : itemsMenuPorRol({ ...accesos, transporteAnterior });
  const items = lista.map(it => ({ ...it, icon: ICONOS[it.icono] ?? Home }));

  const handleCerrarSesion = async () => {
    await cerrarSesion();
    navigate('/login', { replace: true });
  };

  const cerrarMenu = () => setMenuAbierto(false);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-4 lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="h-4 w-1 bg-[var(--cm-red)] rounded-full" />
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">Century Mold</span>
          <span className="text-xs text-[var(--text-muted)]">|</span>
          <span className="text-xs text-[var(--text-secondary)]">{subtitulo}</span>
        </div>
        <div className="flex items-center gap-1">
          <NavLink to={RUTAS.miCuenta} aria-label="Mi cuenta" title="Mi cuenta"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] transition-colors active:scale-95">
            <Settings className="h-4 w-4" />
          </NavLink>
          <button type="button" id="btn-menu-movil" onClick={() => setMenuAbierto(v => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] transition-colors active:scale-95"
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}>
            {menuAbierto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {menuAbierto && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={cerrarMenu} />}

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--border-color)] bg-[var(--bg-sidebar)] transition-transform duration-200 ease-in-out ${menuAbierto ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border-color)] px-5">
          <div className="flex items-center gap-3">
            {!logoError ? (
              <img src="/logo.png" alt="Century Mold" onError={() => setLogoError(true)} className="h-7 w-auto object-contain max-w-[110px]" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="h-6 w-1.5 bg-[var(--cm-red)] rounded-full" />
                <span className="font-bold text-sm tracking-tight text-[var(--text-main)]">CENTURY MOLD</span>
              </div>
            )}
          </div>
          
        </div>

        <div className="px-5 py-2.5 bg-[var(--bg-surface-secondary)] border-b border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] font-medium">
          {subtitulo}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {items.map((item, idx) => {
            if (item.section) return (
              <div key={`sec-${idx}`} className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {item.section}
              </div>
            );
            const Icono = item.icon;
            return (
              <NavLink key={item.path} to={item.path} end={item.end} onClick={cerrarMenu}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-colors border-l-4 ${isActive
                    ? 'bg-[var(--cm-red-light)] text-[var(--cm-red)] border-[var(--cm-red)] dark:bg-[var(--cm-red)]/15  font-semibold'
                    : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]'}`
                }>
                <Icono className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.contador === 'autorizar' && porAutorizar > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-1 text-[9px] font-bold text-[var(--status-warning-text)] shrink-0 shadow-sm">
                    {porAutorizar}
                  </span>
                )}
                {item.contador === 'recepcion' && porRecibir > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-1 text-[9px] font-bold text-[var(--status-warning-text)] shrink-0 shadow-sm">
                    {porRecibir}
                  </span>
                )}
                {item.path === RUTAS.transporteSolicitudes && FUNCIONES.transporteSuelto && pendientesRh > 0 && (
                  <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-[var(--status-warning-bg)] text-[9px] font-bold text-[var(--status-warning-text)] border border-[var(--status-warning-border)] shrink-0 shadow-sm">
                    {pendientesRh}
                  </span>
                )}
                {item.path === RUTAS_TRANSPORTE_SUELTO.misSolicitudes && novedadesUser > 0 && (
                  <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-[var(--status-success-bg)] text-[9px] font-bold text-[var(--status-success-text)] border border-[var(--status-success-border)] shrink-0 shadow-sm">
                    {novedadesUser}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-[var(--border-color)] p-3 space-y-1 bg-[var(--bg-surface-secondary)]">
          <NavLink to={RUTAS.miCuenta} onClick={cerrarMenu} title="Mi cuenta"
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-md p-2 text-xs transition-colors ${isActive ? 'bg-[var(--bg-surface-hover)] border border-[var(--border-color)]' : 'hover:bg-[var(--bg-surface-hover)]'}`
            }>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] font-semibold text-xs">
              <User className="h-4 w-4 text-[var(--text-secondary)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-[var(--text-main)] leading-tight text-xs">{usuario?.nombre ?? 'Usuario'}</p>
              <p className="truncate text-[10px] text-[var(--text-secondary)]" title={descripcion}>{descripcion || 'Usuario'}</p>
              <p className="text-[10px] font-semibold text-[var(--cm-red)]">Mi cuenta</p>
            </div>
          </NavLink>
          <button type="button" id="btn-cerrar-sesion" onClick={handleCerrarSesion}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--cm-red-dark)] hover:bg-[var(--status-error-bg)] transition-colors active:scale-95 cursor-pointer">
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}
