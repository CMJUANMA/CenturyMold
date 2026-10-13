/**
 * TabAsignaciones.jsx — Tabla de asignaciones (roles operativos) con filtros, y las acciones Asignar, Revocar, Extender
 * y Ver historial. Cada quien solo ve las acciones de los roles que puede dar (admin: todos; RH y Aut. 2: aut1 y solicitante).
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarPlus, CheckCircle2, History, Loader2, Plus, Search, ShieldOff } from 'lucide-react';
import Modal from '../../../components/Modal';
import { useConfirmar } from '../../../hooks/useConfirmar';
import { useToast } from '../../../hooks/useToast';
import {
  ESTADO_LABELS, ROLES_OP, ROL_OP_LABELS, aFecha, aIsoLocal, estadoAsignacion, formatoFecha, inicioDelDia, finDelDia, rolesAsignables,
} from '../../../utils/asignaciones';
import { extenderAsignacion, leerHistorialAsignacion, revocarAsignacion } from '../../../utils/asignacionesDb';
import { ESTADO_CLS, inputCls, labelCls, selectCls, btnPrimary, btnSecondary, btnIcon } from './ui';

const ESTADOS = ['vigente', 'programada', 'vencida', 'revocada'];
const sinAcentos = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function TabAsignaciones({ asignaciones, nombresArea, actor, ahora, onAsignar, onCambio }) {
  const confirmar = useConfirmar();
  const toast = useToast();
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroArea, setFiltroArea] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('vigente');
  const [busqueda, setBusqueda] = useState('');
  const [extender, setExtender] = useState(null);
  const [historial, setHistorial] = useState(null);

  const asignables = rolesAsignables(actor);
  const puedeActuar = (a) => asignables.includes(a.rol) && (actor.esAdmin || String(a.nomina) !== String(actor.nomina));

  const filas = useMemo(() => {
    const q = sinAcentos(busqueda).trim();
    return asignaciones
      .map(a => ({ ...a, estado: estadoAsignacion(a, ahora) }))
      .filter(a => (!filtroRol || a.rol === filtroRol) && (!filtroArea || a.areaId === filtroArea)
        && (!filtroEstado || a.estado === filtroEstado)
        && (!q || String(a.nomina).startsWith(q) || sinAcentos(a.nombre).includes(q)))
      .sort((x, y) => ROLES_OP.indexOf(x.rol) - ROLES_OP.indexOf(y.rol)
        || String(nombresArea.get(x.areaId) ?? '').localeCompare(String(nombresArea.get(y.areaId) ?? ''), 'es')
        || String(x.nombre).localeCompare(String(y.nombre), 'es'));
  }, [asignaciones, ahora, filtroRol, filtroArea, filtroEstado, busqueda, nombresArea]);

  const revocar = async (a) => {
    if (!await confirmar({
      titulo: 'Revocar rol',
      mensaje: `¿Revocar ${ROL_OP_LABELS[a.rol]}${a.areaId ? ` · ${nombresArea.get(a.areaId) ?? a.areaId}` : ''} a ${a.nombre}? Deja de tener el permiso de inmediato; el registro se conserva.`,
      textoConfirmar: 'Revocar', peligroso: true,
    })) return;
    try {
      await revocarAsignacion(actor, a);
      toast.success('Rol revocado.');
      onCambio?.();
    } catch (err) { toast.error('No se pudo revocar: ' + err.message); }
  };

  const verHistorial = async (a) => {
    setHistorial({ asignacion: a, cargando: true, filas: [], error: '' });
    try {
      setHistorial({ asignacion: a, cargando: false, filas: await leerHistorialAsignacion(a.id), error: '' });
    } catch (err) {
      setHistorial({ asignacion: a, cargando: false, filas: [], error: err.message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nómina o nombre..."
            className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] pl-8 pr-3 py-1.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--cm-red)]" />
        </div>
        <select aria-label="Filtrar por rol" value={filtroRol} onChange={e => setFiltroRol(e.target.value)} className={selectCls}>
          <option value="">Todos los roles</option>
          {ROLES_OP.map(r => <option key={r} value={r}>{ROL_OP_LABELS[r]}</option>)}
        </select>
        <select aria-label="Filtrar por área" value={filtroArea} onChange={e => setFiltroArea(e.target.value)} className={selectCls}>
          <option value="">Todas las áreas</option>
          {[...nombresArea].map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
        </select>
        <select aria-label="Filtrar por estado" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className={selectCls}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(s => <option key={s} value={s}>{ESTADO_LABELS[s]}s</option>)}
        </select>
        <div className="text-xs text-[var(--text-muted)]">{filas.length} de {asignaciones.length}</div>
        {asignables.length > 0 && (
          <button type="button" id="btn-asignar-rol" onClick={() => onAsignar({})} className={`${btnPrimary} ml-auto`}>
            <Plus className="h-4 w-4" />Asignar rol
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Persona</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Área</th>
                <th className="px-4 py-3">Vigencia</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filas.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-xs text-[var(--text-muted)]">No hay asignaciones con esos filtros.</td></tr>
              ) : filas.map(a => (
                <tr key={a.id} className="hover:bg-[var(--bg-surface-secondary)] transition-colors">
                  <td className="px-4 py-2.5">
                    <span className="font-mono font-bold text-[var(--text-main)]">{a.nomina}</span>{' '}
                    <span className="text-[var(--text-main)]">{a.nombre}</span>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text-main)]">{ROL_OP_LABELS[a.rol]}</td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)]">{a.areaId ? (nombresArea.get(a.areaId) ?? a.areaId) : 'Toda la planta'}</td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)] whitespace-nowrap">
                    {formatoFecha(a.desde)} → {aFecha(a.hasta) ? formatoFecha(a.hasta) : 'permanente'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${ESTADO_CLS[a.estado]}`}>{ESTADO_LABELS[a.estado]}</span>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)] max-w-[220px] truncate" title={a.motivo}>{a.motivo || '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      {puedeActuar(a) && a.estado !== 'revocada' && (
                        <>
                          <button type="button" onClick={() => setExtender(a)} className={btnIcon} title="Extender (cambiar fecha final)" aria-label="Extender"><CalendarPlus className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => revocar(a)} className={btnIcon} title="Revocar" aria-label="Revocar"><ShieldOff className="h-3.5 w-3.5" /></button>
                        </>
                      )}
                      <button type="button" onClick={() => verHistorial(a)} className={btnIcon} title="Ver historial" aria-label="Ver historial"><History className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {extender && (
        <ModalExtender asignacion={extender} actor={actor} onClose={() => setExtender(null)}
          onGuardado={() => { toast.success('Vigencia actualizada.'); onCambio?.(); }} />
      )}
      {historial && <ModalHistorial datos={historial} nombresArea={nombresArea} onClose={() => setHistorial(null)} />}
    </div>
  );
}

function ModalExtender({ asignacion, actor, onClose, onGuardado }) {
  const [hasta, setHasta] = useState(() => aIsoLocal(asignacion.hasta));
  const [motivo, setMotivo] = useState(asignacion.motivo ?? '');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    if (hasta && finDelDia(hasta) < inicioDelDia(aIsoLocal(asignacion.desde))) return setError('"Hasta" no puede ser anterior a "Desde".');
    if (hasta && !motivo.trim()) return setError('El motivo es obligatorio cuando la asignación es temporal.');
    setGuardando(true);
    try {
      await extenderAsignacion(actor, asignacion, { hasta, motivo });
      onGuardado();
      onClose();
    } catch (err) { setError('No se pudo guardar: ' + err.message); } finally { setGuardando(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title="Extender asignación" maxWidth="max-w-sm">
      <form onSubmit={guardar} className="space-y-4">
        <p className="text-xs text-[var(--text-secondary)]">
          {asignacion.nombre} · {ROL_OP_LABELS[asignacion.rol]}. Desde {formatoFecha(asignacion.desde)}.
        </p>
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-xs text-[var(--status-error-text)]">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}
        <div>
          <label htmlFor="ext-hasta" className={labelCls}>Nueva fecha final <span className="text-[var(--text-muted)]">(vacío = permanente)</span></label>
          <input id="ext-hasta" type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="ext-motivo" className={labelCls}>Motivo</label>
          <input id="ext-motivo" value={motivo} onChange={e => setMotivo(e.target.value)} className={inputCls} />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
          <button type="submit" disabled={guardando} className={btnPrimary}>
            {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}

const ACCION_LABELS = { asignar: 'Asignó', reasignar: 'Volvió a asignar', revocar: 'Revocó', extender: 'Cambió la vigencia', migracion_asignacion: 'Migrado del modelo anterior' };

function ModalHistorial({ datos, nombresArea, onClose }) {
  const { asignacion: a, cargando, filas, error } = datos;
  const fecha = (f) => (f?.toDate ? f.toDate().toLocaleString('es-MX') : '');
  const detalle = (d) => d && `${d.activo ? 'activa' : 'revocada'} · ${d.desde ? formatoFecha(d.desde) : '?'} → ${d.hasta ? formatoFecha(d.hasta) : 'permanente'}${d.motivo ? ` · ${d.motivo}` : ''}`;
  return (
    <Modal isOpen onClose={onClose} title="Historial de la asignación" maxWidth="max-w-lg">
      <p className="mb-3 text-xs text-[var(--text-secondary)]">
        {a.nombre} · {ROL_OP_LABELS[a.rol]}{a.areaId ? ` · ${nombresArea.get(a.areaId) ?? a.areaId}` : ''}
      </p>
      {cargando ? (
        <div className="flex items-center gap-2 py-6 text-xs text-[var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Cargando…</div>
      ) : error ? (
        <p className="text-xs text-[var(--status-error-text)]">{error}</p>
      ) : filas.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">Sin movimientos registrados.</p>
      ) : (
        <ul className="space-y-2">
          {filas.map(f => (
            <li key={f.id} className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-3 py-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="font-semibold text-[var(--text-main)]">{ACCION_LABELS[f.accion] ?? f.accion}</span>
                <span className="text-[var(--text-muted)]">{fecha(f.fecha)}</span>
              </div>
              <div className="text-[var(--text-secondary)]">por {f.porNombre || f.porUid}</div>
              {f.antes && <div className="text-[10px] text-[var(--text-muted)]">Antes: {detalle(f.antes)}</div>}
              <div className="text-[10px] text-[var(--text-muted)]">Después: {detalle(f.despues)}</div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
