/**
 * Navbar.jsx — Barra lateral corporativa Century Mold.
 * rh y admin tienen acceso completo al panel de gestión.
 */
import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home, FilePlus, ClipboardList, Layers, Users, Database,
  ShieldCheck, User, LogOut, Menu, X, Sun, Moon,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { ROLES_RH } from '../utils/roles';
import { ROLES, ESTATUS_SOLICITUD, ROL_LABELS_CORTOS } from '../utils/constantes';

const NAV_ITEMS = [
  { path: '/', label: 'Inicio', icon: Home, roles: [ROLES.ADMIN, ROLES.RH, ROLES.SUPERINTENDENTE], end: true },
  { path: '/solicitud/nueva', label: 'Nueva solicitud', icon: FilePlus, roles: [ROLES.ADMIN, ROLES.RH, ROLES.SUPERINTENDENTE] },
  { path: '/mis-solicitudes', label: 'Mis solicitudes', icon: ClipboardList, roles: [ROLES.ADMIN, ROLES.RH, ROLES.SUPERINTENDENTE] },
  { section: 'Gestión y control', roles: ROLES_RH },
  { path: '/rh/solicitudes', label: 'Todas las solicitudes', icon: Layers, roles: ROLES_RH },
  { path: '/rh/empleados', label: 'Padrón de empleados', icon: Users, roles: ROLES_RH },
  { path: '/rh/catalogos', label: 'Catálogos del sistema', icon: Database, roles: ROLES_RH },
  { path: '/rh/usuarios', label: 'Usuarios y accesos', icon: ShieldCheck, roles: ROLES_RH },
];

export default function Navbar() {
  const { usuario, cerrarSesion } = useAuth();
  const { esOscuro, alternarTema } = useTheme();
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [pendientesRh, setPendientesRh] = useState(0);
  const [novedadesUser, setNovedadesUser] = useState(0);

  useEffect(() => {
    if (!usuario) return;
    let unsub1, unsub2;
    if (ROLES_RH.includes(usuario.rol)) {
      unsub1 = onSnapshot(query(collection(db, 'solicitudes'), where('estatus', '==', ESTATUS_SOLICITUD.PENDIENTE)), snap => {
        setPendientesRh(snap.size);
      });
    }
    if (usuario.uid) {
      unsub2 = onSnapshot(query(collection(db, 'solicitudes'), where('creadoPor', '==', usuario.uid), where('vistoPorSolicitante', '==', false)), snap => {
        setNovedadesUser(snap.size);
      }, err => console.error('Navbar novedades:', err));
    }
    return () => { if (unsub1) unsub1(); if (unsub2) unsub2(); };
  }, [usuario]);

  const handleCerrarSesion = async () => {
    await cerrarSesion();
    navigate('/login', { replace: true });
  };

  const cerrarMenu = () => setMenuAbierto(false);
  const rol = usuario?.rol ?? '';

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-4 lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="h-4 w-1 bg-[var(--cm-red)] rounded-full" />
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">Century Mold</span>
          <span className="text-xs text-[var(--text-muted)]">|</span>
          <span className="text-xs text-[var(--text-secondary)]">Transporte</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={alternarTema}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] transition-colors active:scale-95"
            title={esOscuro ? 'Modo claro' : 'Modo oscuro'} aria-label="Cambiar tema">
            {esOscuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
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
          <button type="button" onClick={alternarTema}
            className="hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] transition-colors active:scale-95"
            title={esOscuro ? 'Modo claro' : 'Modo oscuro'} aria-label="Cambiar tema">
            {esOscuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        <div className="px-5 py-2.5 bg-[var(--bg-surface-secondary)] border-b border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] font-medium">
          Control de Transporte
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {NAV_ITEMS.filter(item => item.roles?.includes(rol)).map((item, idx) => {
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
                {item.path === '/rh/solicitudes' && pendientesRh > 0 && (
                  <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-[var(--status-warning-bg)] text-[9px] font-bold text-[var(--status-warning-text)] border border-[var(--status-warning-border)] shrink-0 shadow-sm">
                    {pendientesRh}
                  </span>
                )}
                {item.path === '/mis-solicitudes' && novedadesUser > 0 && (
                  <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-[var(--status-success-bg)] text-[9px] font-bold text-[var(--status-success-text)] border border-[var(--status-success-border)] shrink-0 shadow-sm">
                    {novedadesUser}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-[var(--border-color)] p-3 space-y-1 bg-[var(--bg-surface-secondary)]">
          <NavLink to="/perfil" onClick={cerrarMenu}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-md p-2 text-xs transition-colors ${isActive ? 'bg-[var(--bg-surface-hover)] border border-[var(--border-color)]' : 'hover:bg-[var(--bg-surface-hover)]'}`
            }>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] font-semibold text-xs">
              <User className="h-4 w-4 text-[var(--text-secondary)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-[var(--text-main)] leading-tight text-xs">{usuario?.nombre ?? 'Usuario'}</p>
              <p className="truncate text-[10px] text-[var(--text-secondary)]">{ROL_LABELS_CORTOS[rol] ?? rol}</p>
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
