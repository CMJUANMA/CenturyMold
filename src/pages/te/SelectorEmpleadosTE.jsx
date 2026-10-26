/**
 * SelectorEmpleadosTE.jsx — "Agregar empleados": todos los empleados activos del área, con buscador, filtros por puesto, por
 * ruta (la del padrón; sirve para juntar gente de la misma ruta y no usar rutas de más), una columna
 * Ruta y casillas para elegir varios a la vez (así se agregan 30 o más de un golpe).
 * Props: empleados (los del área), yaAgregados (Set de nóminas), rutas (catálogo), onAgregar(lista), onClose
 */
import { useMemo, useState } from 'react';
import { CheckCircle2, Search } from 'lucide-react';
import Modal from '../../components/Modal';
import Ayuda from '../../components/Ayuda';
import Boton from '../../components/ui/Boton';
import { Entrada, Selector } from '../../components/ui/Campo';
import { CASILLA } from '../../components/ui/estilos';
import Insignia from '../../components/ui/Insignia';

const sinAcentos = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function SelectorEmpleadosTE({ empleados, yaAgregados, rutas = [], onAgregar, onClose }) {
  const [busqueda, setBusqueda] = useState('');
  const [puesto, setPuesto] = useState('');
  const [ruta, setRuta] = useState(''); // '' = todas · 'sin' = sin ruta en el padrón · id de ruta
  const [marcados, setMarcados] = useState(() => new Set());

  const nombreRuta = (id) => rutas.find(r => r.id === id)?.nombre ?? '';
  // Solo las rutas que usan los empleados de esta área, con cuántos hay en cada una
  const rutasDelArea = useMemo(() => {
    const cuenta = new Map();
    for (const e of empleados) if (e.rutaId) cuenta.set(e.rutaId, (cuenta.get(e.rutaId) ?? 0) + 1);
    return [...cuenta].map(([id, n]) => ({ id, nombre: rutas.find(r => r.id === id)?.nombre ?? id, n })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [empleados, rutas]);
  const puestos = useMemo(() => [...new Set(empleados.map(e => e.puesto).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')), [empleados]);
  const visibles = useMemo(() => {
    const q = sinAcentos(busqueda).trim();
    return empleados
      .filter(e => (!puesto || e.puesto === puesto)
        && (!ruta || (ruta === 'sin' ? !e.rutaId : e.rutaId === ruta))
        && (!q || String(e.nomina).startsWith(q) || sinAcentos(e.nombre).includes(q)))
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
  }, [empleados, busqueda, puesto, ruta]);
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
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
            <Entrada type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Nombre o nómina" aria-label="Buscar empleado" autoFocus className="pl-9" />
          </div>
          <Selector aria-label="Filtrar por puesto" value={puesto} onChange={e => setPuesto(e.target.value)}>
            <option value="">Todos los puestos</option>
            {puestos.map(p => <option key={p} value={p}>{p}</option>)}
          </Selector>
          <Selector aria-label="Filtrar por ruta" value={ruta} onChange={e => setRuta(e.target.value)}>
            <option value="">Todas las rutas</option>
            {rutasDelArea.map(r => <option key={r.id} value={r.id}>{r.nombre} ({r.n})</option>)}
            <option value="sin">Sin ruta guardada</option>
          </Selector>
        </div>
        <Ayuda clave="selector.ruta" />

        <div className="overflow-hidden rounded-lg border border-[var(--border-color)]">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-4 text-sm font-medium text-[var(--text-secondary)]">
            <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} disabled={disponibles.length === 0} className={CASILLA} />
            Seleccionar los {disponibles.length} visibles
          </label>
          <ul className="max-h-[50vh] divide-y divide-[var(--border-subtle)] overflow-y-auto">
            {visibles.length === 0 && <li className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No hay empleados con esos filtros. Prueba quitando un filtro.</li>}
            {visibles.map(e => {
              const n = String(e.nomina);
              const ya = yaAgregados.has(n);
              return (
                <li key={n}>
                  <label className={`flex min-h-11 items-center gap-3 px-4 py-2 text-sm ${ya ? 'opacity-50' : 'cursor-pointer transition-colors duration-150 hover:bg-[var(--bg-surface-hover)]'}`}>
                    <input type="checkbox" disabled={ya} checked={ya || marcados.has(n)} onChange={() => alternar(n)} className={CASILLA} />
                    <span className="w-14 shrink-0 font-mono text-[var(--text-secondary)]">{n}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-[var(--text-main)]">{e.nombre}</span>
                      <span className="block text-xs text-[var(--text-muted)]">{[e.puesto, nombreRuta(e.rutaId) || 'Sin ruta'].filter(Boolean).join(' · ')}</span>
                    </span>
                    {ya && <Insignia tono="exito">Ya agregado</Insignia>}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col-reverse items-stretch justify-between gap-3 pt-1 sm:flex-row sm:items-center">
          <span className="text-xs text-[var(--text-muted)]">{elegidos.length} seleccionados · {empleados.length} empleados en el área</span>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <Boton onClick={onClose}>Cancelar</Boton>
            <Boton variante="primario" icono={CheckCircle2} disabled={elegidos.length === 0} onClick={() => onAgregar(elegidos)}>Agregar {elegidos.length || ''}</Boton>
          </div>
        </div>
      </div>
    </Modal>
  );
}
