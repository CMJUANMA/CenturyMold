/**
 * SelectorEmpleadosTE.jsx — "Agregar empleados": todos los empleados activos del área, con buscador, filtros por puesto y por
 * turno de nómina (A/B/C) y casillas para elegir varios a la vez (así se agregan 30 o más de un golpe).
 * Props: empleados (los del área), yaAgregados (Set de nóminas), onAgregar(lista), onClose
 */
import { useMemo, useState } from 'react';
import { CheckCircle2, Search } from 'lucide-react';
import Modal from '../../components/Modal';
import { TURNOS_NOMINA } from '../../utils/tiempoExtra';

const sinAcentos = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const sel = 'rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--cm-red)]';

export default function SelectorEmpleadosTE({ empleados, yaAgregados, onAgregar, onClose }) {
  const [busqueda, setBusqueda] = useState('');
  const [puesto, setPuesto] = useState('');
  const [turno, setTurno] = useState('');
  const [marcados, setMarcados] = useState(() => new Set());

  const puestos = useMemo(() => [...new Set(empleados.map(e => e.puesto).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')), [empleados]);
  const visibles = useMemo(() => {
    const q = sinAcentos(busqueda).trim();
    return empleados
      .filter(e => (!puesto || e.puesto === puesto) && (!turno || String(e.turnoNomina ?? '').toUpperCase() === turno)
        && (!q || String(e.nomina).startsWith(q) || sinAcentos(e.nombre).includes(q)))
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
  }, [empleados, busqueda, puesto, turno]);
  const disponibles = visibles.filter(e => !yaAgregados.has(String(e.nomina)));
  const todosMarcados = disponibles.length > 0 && disponibles.every(e => marcados.has(String(e.nomina)));

  const alternar = (n) => setMarcados(prev => { const s = new Set(prev); if (s.has(n)) s.delete(n); else s.add(n); return s; });
  const alternarTodos = () => setMarcados(prev => {
    const s = new Set(prev);
    for (const e of disponibles) { if (todosMarcados) s.delete(String(e.nomina)); else s.add(String(e.nomina)); }
    return s;
  });
  const elegidos = empleados.filter(e => marcados.has(String(e.nomina)) && !yaAgregados.has(String(e.nomina)));

  return (
    <Modal isOpen onClose={onClose} title="Agregar empleados" maxWidth="max-w-3xl">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
            <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre o nómina…" aria-label="Buscar empleado" autoFocus
              className={`${sel} w-full pl-8`} />
          </div>
          <select aria-label="Filtrar por puesto" value={puesto} onChange={e => setPuesto(e.target.value)} className={`${sel} max-w-[14rem]`}>
            <option value="">Todos los puestos</option>
            {puestos.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select aria-label="Filtrar por turno de nómina" value={turno} onChange={e => setTurno(e.target.value)} className={sel}>
            <option value="">Todos los turnos</option>
            {TURNOS_NOMINA.map(t => <option key={t} value={t}>Turno {t}</option>)}
          </select>
        </div>

        <div className="overflow-hidden rounded-lg border border-[var(--border-color)]">
          <label className="flex cursor-pointer items-center gap-3 border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
            <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} disabled={disponibles.length === 0} className="h-3.5 w-3.5 accent-[var(--cm-red)]" />
            Seleccionar los {disponibles.length} visibles
          </label>
          <ul className="max-h-[50vh] divide-y divide-[var(--border-subtle)] overflow-y-auto">
            {visibles.length === 0 && <li className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">No hay empleados con esos filtros.</li>}
            {visibles.map(e => {
              const n = String(e.nomina);
              const ya = yaAgregados.has(n);
              return (
                <li key={n}>
                  <label className={`flex items-center gap-3 px-3 py-2 text-xs ${ya ? 'opacity-50' : 'cursor-pointer hover:bg-[var(--bg-surface-hover)]'}`}>
                    <input type="checkbox" disabled={ya} checked={ya || marcados.has(n)} onChange={() => alternar(n)} className="h-3.5 w-3.5 accent-[var(--cm-red)]" />
                    <span className="font-mono font-bold text-[var(--text-main)]">{n}</span>
                    <span className="min-w-0 flex-1 truncate text-[var(--text-main)]">{e.nombre}</span>
                    <span className="hidden truncate text-[10px] text-[var(--text-muted)] sm:block sm:max-w-[12rem]">{e.puesto}</span>
                    {e.turnoNomina && <span className="rounded border border-[var(--border-color)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">{e.turnoNomina}</span>}
                    {ya && <span className="text-[10px] font-semibold text-[var(--status-success-text)]">Ya agregado</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-[var(--text-muted)]">{elegidos.length} seleccionados · {empleados.length} empleados en el área</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="cursor-pointer rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]">Cancelar</button>
            <button type="button" disabled={elegidos.length === 0} onClick={() => onAgregar(elegidos)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[var(--cm-red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--cm-red-hover)] disabled:opacity-50">
              <CheckCircle2 className="h-3.5 w-3.5" />Agregar {elegidos.length || ''}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
