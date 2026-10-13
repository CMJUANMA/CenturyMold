/**
 * BuscadorEmpleado.jsx — Campo para buscar en el padrón por nombre o nómina y elegir a una persona.
 * Props:
 *   empleados:   [{ nomina, nombre, puesto, activo }] — se ofrecen solo los activos
 *   onSelect:    (empleado) => void
 *   excluir:     nóminas que no se ofrecen (ya elegidas)
 *   placeholder: texto del campo
 */
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { esActivo } from '../utils/activo';

const sinAcentos = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const MAX_RESULTADOS = 8;

export default function BuscadorEmpleado({ empleados, onSelect, excluir = [], placeholder = 'Buscar por nombre o nomina...', autoFocus = false }) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const q = sinAcentos(texto).trim();

  const resultados = useMemo(() => {
    if (!q) return [];
    const fuera = new Set(excluir.map(String));
    const out = [];
    for (const e of empleados) {
      if (!esActivo(e) || fuera.has(String(e.nomina))) continue;
      if (String(e.nomina).startsWith(q) || sinAcentos(e.nombre).includes(q)) {
        out.push(e);
        if (out.length >= MAX_RESULTADOS) break;
      }
    }
    return out;
  }, [q, empleados, excluir]);

  const elegir = (e) => { onSelect(e); setTexto(''); setAbierto(false); };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
      <input type="search" value={texto} autoFocus={autoFocus} placeholder={placeholder}
        onChange={e => { setTexto(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] py-1.5 pl-7 pr-2 text-xs text-[var(--text-main)] outline-none focus:border-[var(--cm-red)]" />
      {abierto && q && (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-lg">
          {resultados.length === 0 ? (
            <li className="px-3 py-2 text-xs text-[var(--text-muted)]">Sin coincidencias en el padron.</li>
          ) : resultados.map(e => (
            <li key={e.nomina}>
              <button type="button" onMouseDown={ev => ev.preventDefault()} onClick={() => elegir(e)}
                className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-xs hover:bg-[var(--bg-surface-hover)] cursor-pointer">
                <span className="font-mono font-bold text-[var(--text-main)]">{e.nomina}</span>
                <span className="truncate text-[var(--text-main)]">{e.nombre}</span>
                {e.puesto && <span className="ml-auto shrink-0 text-[10px] text-[var(--text-muted)]">{e.puesto}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
