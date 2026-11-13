/**
 * ModalAplicaMotivo.jsx — Al agregar un motivo a la solicitud pregunta «¿A quiénes aplica?», con casillas de los empleados, para no asignarlo
 * fila por fila. Los empleados que no se marquen se quedan con el motivo que ya tenían.
 * Props: indice (posición del motivo nuevo), empleados ({ nomina, nombre, motivoIndex }[]), etiquetas (nombre de cada motivo, para mostrar el que ya llevan),
 *        onAplicar(nominas: string[]), onClose
 */
import { useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import Boton from '../../components/ui/Boton';
import { Entrada } from '../../components/ui/Campo';
import { CASILLA } from '../../components/ui/estilos';

const sinAcentos = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function ModalAplicaMotivo({ indice, empleados, etiquetas = [], onAplicar, onClose }) {
  const [marcados, setMarcados] = useState(() => new Set());
  const [busqueda, setBusqueda] = useState('');
  const visibles = useMemo(() => {
    const q = sinAcentos(busqueda).trim();
    return empleados.filter(e => !q || String(e.nomina).startsWith(q) || sinAcentos(e.nombre).includes(q));
  }, [empleados, busqueda]);
  const alternar = (n) => setMarcados(prev => { const s = new Set(prev); if (s.has(n)) s.delete(n); else s.add(n); return s; });
  const marcarVisibles = (marcar) => setMarcados(prev => { const s = new Set(prev); visibles.forEach(e => (marcar ? s.add(e.nomina) : s.delete(e.nomina))); return s; });

  return (
    <Modal isOpen onClose={onClose} title={`¿A quiénes aplica el motivo ${indice + 1}?`} maxWidth="max-w-xl"
      subtitulo="Marca a los empleados que llevan este motivo. Los demás se quedan con el que ya tenían. Elige el motivo en su tarjeta."
      pie={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton id="btn-motivo-ahora-no" onClick={onClose}>Ahora no</Boton>
          <Boton id="btn-motivo-aplicar" variante="primario" disabled={marcados.size === 0} onClick={() => onAplicar([...marcados])}>
            {marcados.size ? `Aplicar a ${marcados.size} ${marcados.size === 1 ? 'empleado' : 'empleados'}` : 'Marca a quien aplica'}
          </Boton>
        </div>
      )}>
      <div className="space-y-3">
        {empleados.length > 8 && <Entrada type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Nombre o nómina" aria-label="Buscar empleado" autoFocus />}
        <div className="flex flex-wrap gap-2">
          <Boton tamano="sm" onClick={() => marcarVisibles(true)}>Marcar a todos</Boton>
          <Boton tamano="sm" variante="fantasma" onClick={() => marcarVisibles(false)}>Quitar todas</Boton>
        </div>
        <ul className="max-h-72 divide-y divide-[var(--border-subtle)] overflow-auto rounded-lg border border-[var(--border-color)]">
          {visibles.map(e => (
            <li key={e.nomina}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-[var(--bg-surface-hover)]">
                <input type="checkbox" checked={marcados.has(e.nomina)} onChange={() => alternar(e.nomina)} className={CASILLA} aria-label={`Aplicar el motivo ${indice + 1} a ${e.nombre}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--text-main)]">{e.nombre}</span>
                  <span className="block truncate text-xs text-[var(--text-secondary)]"><span className="font-mono">{e.nomina}</span> · ahora: {etiquetas[Math.min(e.motivoIndex ?? 0, etiquetas.length - 1)] ?? 'Motivo 1'}</span>
                </span>
              </label>
            </li>
          ))}
          {visibles.length === 0 && <li className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">Nadie coincide.</li>}
        </ul>
      </div>
    </Modal>
  );
}
