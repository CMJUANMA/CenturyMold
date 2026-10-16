/**
 * BuscadorEmpleado.jsx — Campo para buscar en el padrón por nombre o nómina y elegir a una persona.
 * Props:
 *   empleados:   [{ nomina, nombre, puesto, activo }] — se ofrecen solo los activos
 *   onSelect:    (empleado) => void
 *   excluir:     nóminas que no se ofrecen (ya elegidas)
 *   placeholder: texto del campo
 *   sugeridos:   (empleado) => boolean — opcional. Con el campo vacío se ofrecen primero estas personas (ordenadas por
 *                puesto) y al escribir salen antes que el resto; se puede elegir a cualquiera
 *   etiquetaSugeridos: título de la lista de sugeridos (campo vacío)
 */
import { useMemo, useState } from 'react';
import { CONTROL, CONTROL_OK } from './ui/estilos';
import { Search } from 'lucide-react';
import { esActivo } from '../utils/activo';

const sinAcentos = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const MAX_RESULTADOS = 8;
const MAX_SUGERIDOS = 40;
const porPuesto = (a, b) => String(a.puesto ?? '').localeCompare(String(b.puesto ?? ''), 'es')
  || String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''), 'es');

export default function BuscadorEmpleado({
  empleados, onSelect, excluir = [], placeholder = 'Buscar por nombre o nomina...', autoFocus = false,
  sugeridos = null, etiquetaSugeridos = 'Sugeridos',
}) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const q = sinAcentos(texto).trim();

  const resultados = useMemo(() => {
    const fuera = new Set(excluir.map(String));
    const disponibles = (e) => esActivo(e) && !fuera.has(String(e.nomina));
    if (!q) {
      if (!sugeridos) return [];
      return empleados.filter(e => disponibles(e) && sugeridos(e)).sort(porPuesto).slice(0, MAX_SUGERIDOS);
    }
    const coinciden = empleados.filter(e => disponibles(e) && (String(e.nomina).startsWith(q) || sinAcentos(e.nombre).includes(q)));
    if (sugeridos) coinciden.sort((a, b) => Number(sugeridos(b)) - Number(sugeridos(a)) || porPuesto(a, b));
    return coinciden.slice(0, MAX_RESULTADOS);
  }, [q, empleados, excluir, sugeridos]);

  const elegir = (e) => { onSelect(e); setTexto(''); setAbierto(false); };
  const hayLista = q || sugeridos;

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
      <input type="search" value={texto} autoFocus={autoFocus} placeholder={placeholder}
        onChange={e => { setTexto(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        className={`${CONTROL} ${CONTROL_OK} pl-8`} />
      {abierto && hayLista && (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-lg">
          {!q && sugeridos && resultados.length > 0 && (
            <li className="px-3 pt-1.5 pb-1 text-xs font-semibold text-[var(--text-muted)]">{etiquetaSugeridos}</li>
          )}
          {resultados.length === 0 ? (
            <li className="px-3 py-2 text-xs text-[var(--text-muted)]">{q ? 'Sin coincidencias en el padron.' : 'Escribe para buscar en el padron.'}</li>
          ) : resultados.map(e => (
            <li key={e.nomina}>
              <button type="button" onMouseDown={ev => ev.preventDefault()} onClick={() => elegir(e)}
                className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-xs hover:bg-[var(--bg-surface-hover)] cursor-pointer">
                <span className="font-mono font-semibold text-[var(--text-main)]">{e.nomina}</span>
                <span className="truncate text-[var(--text-main)]">{e.nombre}</span>
                {e.puesto && <span className="ml-auto shrink-0 text-xs text-[var(--text-muted)]">{e.puesto}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
