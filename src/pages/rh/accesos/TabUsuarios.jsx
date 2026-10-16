/**
 * TabUsuarios.jsx — Tabla de usuarios del sistema (rol del sistema + roles operativos vigentes) y su alta/edición.
 * Acceso: RH y admin. Solo un admin toca a rh/admin.
 */
import { Suspense, lazy, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { UserPlus, Users, Search, Pencil, ToggleLeft, ToggleRight, ShieldCheck, Info } from 'lucide-react';
import { db } from '../../../firebase';
import { ROLES, ROL_LABELS } from '../../../utils/constantes';
import { esVigente, etiquetaAsignacion, ROLES_OP } from '../../../utils/asignaciones';
import { useConfirmar } from '../../../hooks/useConfirmar';
import { useToast } from '../../../hooks/useToast';
import { useAuth } from '../../../hooks/useAuth';
import ModalUsuario from './ModalUsuario';
// Trae exceljs (el Excel de accesos) solo cuando se abre el modal
const ModalUsuariosLote = lazy(() => import('./ModalUsuariosLote'));
import { btnPrimary, btnSecondary, btnIcon, selectCls, etiquetaCls } from './ui';

const rolLabel = (r) => ROL_LABELS[r] ?? `${r} (rol anterior: edítalo para pasarlo a Usuario)`;

export default function TabUsuarios({ usuarios, setUsuarios, asignaciones, nombresArea, empleados, esAdmin, ahora, precarga = null }) {
  const confirmar = useConfirmar();
  const { usuario: yo } = useAuth();
  const toast = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [lote, setLote] = useState(false);
  const [modal, setModal] = useState(precarga ? { usuario: null, precarga } : null);

  // Un RH que no es admin no puede tocar a otros rh/admin (las reglas lo rechazan)
  const puedeEditar = (u) => esAdmin || ![ROLES.RH, ROLES.ADMIN].includes(u.rol);

  const toggleActivo = async (u) => {
    const desactivar = u.activo !== false;
    if (!await confirmar({
      titulo: desactivar ? 'Desactivar usuario' : 'Activar usuario',
      mensaje: `¿Deseas ${desactivar ? 'desactivar' : 'activar'} a ${u.nombre}?`,
      textoConfirmar: desactivar ? 'Desactivar' : 'Activar', peligroso: desactivar,
    })) return;
    try {
      await updateDoc(doc(db, 'usuarios', u.uid), { activo: u.activo === false });
      setUsuarios(prev => prev.map(x => x.uid === u.uid ? { ...x, activo: x.activo === false } : x));
    } catch (err) {
      toast.error('No se pudo actualizar el usuario: ' + err.message);
    }
  };

  const vigentesDe = (nomina) => asignaciones
    .filter(a => String(a.nomina) === String(nomina) && esVigente(a, ahora))
    .sort((a, b) => ROLES_OP.indexOf(a.rol) - ROLES_OP.indexOf(b.rol));

  const filtrados = usuarios.filter(u => {
    const q = busqueda.toLowerCase();
    return (!q || String(u.nomina).toLowerCase().includes(q) || String(u.nombre).toLowerCase().includes(q))
      && (!filtroRol || u.rol === filtroRol)
      && (!filtroEstado || (filtroEstado === 'activo') === (u.activo !== false));
  });

  const guardado = (u, { nuevo }) => setUsuarios(prev => (nuevo ? [...prev, u] : prev.map(x => (x.uid === u.uid ? u : x))));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-3 py-2 text-[11px] text-[var(--text-secondary)] max-w-2xl">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[var(--text-muted)]" />
          <span>
            El rol del sistema solo puede ser Usuario, Recursos Humanos o Administrador. Lo que cada quien puede hacer en tiempo extra y
            en solicitudes de ruta sale de sus <b>roles operativos</b> (pestaña Asignaciones). El cambio de contraseña de otra persona no está
            disponible desde la app; cada usuario puede cambiar la suya en Mi cuenta.
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" id="btn-usuarios-lote" onClick={() => setLote(true)} className={btnSecondary}>
            <Users className="h-4 w-4" />Crear usuarios en lote
          </button>
          <button type="button" onClick={() => setModal({ usuario: null, precarga: null })} className={btnPrimary}>
            <UserPlus className="h-4 w-4" />Nuevo usuario
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nómina o nombre..."
            className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] pl-8 pr-3 py-1.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--cm-red)]" />
        </div>
        <select aria-label="Filtrar por rol" value={filtroRol} onChange={e => setFiltroRol(e.target.value)} className={selectCls}>
          <option value="">Todos los roles</option>
          {[ROLES.USUARIO, ROLES.RH, ROLES.ADMIN].map(r => <option key={r} value={r}>{ROL_LABELS[r]}</option>)}
        </select>
        <select aria-label="Filtrar por estado" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className={selectCls}>
          <option value="">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
        <div className="text-xs text-[var(--text-muted)]">{filtrados.length} de {usuarios.length}</div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Nómina</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Rol del sistema</th>
                <th className="px-4 py-3">Roles operativos</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filtrados.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
                    <ShieldCheck className="h-8 w-8" />
                    <p className="text-xs font-medium text-[var(--text-secondary)]">No se encontraron usuarios</p>
                  </div>
                </td></tr>
              ) : filtrados.map(u => (
                <tr key={u.uid} className="hover:bg-[var(--bg-surface-secondary)] transition-colors">
                  <td className="px-4 py-2.5 font-mono font-bold text-[var(--text-main)]">{u.nomina}</td>
                  <td className="px-4 py-2.5 text-[var(--text-main)]">{u.nombre}</td>
                  <td className="px-4 py-2.5"><span className={etiquetaCls}>{rolLabel(u.rol)}</span></td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {vigentesDe(u.nomina).map(a => (
                        <span key={a.id} className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold border border-[var(--status-info-border,var(--border-color))] bg-[var(--status-info-bg,var(--bg-surface-secondary))] text-[var(--status-info-text,var(--text-main))]">
                          {etiquetaAsignacion(a, nombresArea)}
                        </span>
                      ))}
                      {vigentesDe(u.nomina).length === 0 && <span className="text-[var(--text-muted)]">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${u.activo !== false ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]' : 'bg-[var(--status-error-bg)] text-[var(--status-error-text)]'}`}>
                      {u.activo !== false ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {puedeEditar(u) && (
                      <div className="inline-flex items-center gap-1">
                        <button type="button" onClick={() => setModal({ usuario: u, precarga: null })} className={btnIcon} title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => toggleActivo(u)} className={btnIcon} title={u.activo !== false ? 'Desactivar' : 'Activar'}>
                          {u.activo !== false ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4" />}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {lote && (
        <Suspense fallback={null}>
          <ModalUsuariosLote abierto actor={{ uid: yo?.uid, nombre: yo?.nombre ?? '' }} usuarios={usuarios} empleados={empleados}
            asignaciones={asignaciones} nombresArea={nombresArea} ahora={ahora} onClose={() => setLote(false)}
            onCreados={(perfiles) => setUsuarios(prev => [...prev, ...perfiles])} />
        </Suspense>
      )}

      <ModalUsuario abierto={!!modal} onClose={() => setModal(null)} usuario={modal?.usuario} precarga={modal?.precarga}
        usuarios={usuarios} empleados={empleados} esAdmin={esAdmin} onGuardado={guardado} />
    </div>
  );
}
