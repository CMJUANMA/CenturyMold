/**
 * BuscadorEmpleado.jsx — Campo para buscar en el padrón por nombre o nómina y elegir a una persona. Se maneja con el teclado: flechas para moverse, Enter para elegir.
 * Props:
 *   empleados:   [{ nomina, nombre, puesto, areaId, activo }] — se ofrecen solo los activos
 *   onSelect:    (empleado) => void
 *   excluir:     nóminas que no se ofrecen (ya elegidas)
 *   placeholder: texto del campo
 *   sugeridos:   (empleado) => boolean — opcional. Con el campo vacío se ofrecen primero estas personas (ordenadas por
 *                puesto) y al escribir salen antes que el resto; se puede elegir a cualquiera
 *   etiquetaSugeridos: título del grupo de sugeridos ("Empleados de <área>")
 *   etiquetaOtros: título del grupo del resto cuando hay sugeridos ("Otras áreas"); en él se muestra el área de cada persona
 *   nombreArea:  (areaId) => texto — si se da, cada resultado dice su área
 *   modo:        'desplegable' (lista flotante bajo el campo) o 'panel' (lista fija bajo el campo, alta, para ventanas dedicadas a elegir a alguien)
 * Cada resultado muestra el nombre completo (sin cortar) y debajo, más chico, el puesto y el área.
 */
import { useMemo, useRef, useState } from 'react';
import { CONTROL, CONTROL_OK } from './ui/estilos';
import { Search } from 'lucide-react';
import { esActivo } from '../utils/activo';

const sinAcentos = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const MAX_RESULTADOS = 8;
const MAX_RESULTADOS_PANEL = 60;
const MAX_SUGERIDOS = 40;
const porPuesto = (a, b) => String(a.puesto ?? '').localeCompare(String(b.puesto ?? ''), 'es')
  || String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''), 'es');

export default function BuscadorEmpleado({
  empleados, onSelect, excluir = [], placeholder = 'Buscar por nombre o nomina...', autoFocus = false,
  sugeridos = null, etiquetaSugeridos = 'Sugeridos', etiquetaOtros = 'Otras áreas', nombreArea = null, modo = 'desplegable',
}) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const lista = useRef(null);
  const panel = modo === 'panel';
  const q = sinAcentos(texto).trim();

  // Resultados en dos grupos: los sugeridos (por ejemplo, los del área) y el resto. Sin sugeridos todo va en un solo grupo sin título.
  const { propios, otros } = useMemo(() => {
    const fuera = new Set(excluir.map(String));
    const disponibles = (e) => esActivo(e) && !fuera.has(String(e.nomina));
    const tope = panel ? MAX_RESULTADOS_PANEL : MAX_RESULTADOS;
    if (!q) {
      if (!sugeridos) return { propios: [], otros: [] };
      return { propios: empleados.filter(e => disponibles(e) && sugeridos(e)).sort(porPuesto).slice(0, MAX_SUGERIDOS), otros: [] };
    }
    const coinciden = empleados.filter(e => disponibles(e) && (String(e.nomina).startsWith(q) || sinAcentos(e.nombre).includes(q)));
    if (!sugeridos) return { propios: coinciden.slice(0, tope), otros: [] };
    if (!panel) { coinciden.sort((a, b) => Number(sugeridos(b)) - Number(sugeridos(a)) || porPuesto(a, b)); return { propios: coinciden.slice(0, tope), otros: [] }; }
    return {
      propios: coinciden.filter(sugeridos).sort(porPuesto).slice(0, tope),
      otros: coinciden.filter(e => !sugeridos(e)).sort(porPuesto).slice(0, tope),
    };
  }, [q, empleados, excluir, sugeridos, panel]);

  const planos = useMemo(() => [...propios, ...otros], [propios, otros]);
  const hayLista = panel || q || sugeridos;
  const visible = panel || abierto;
  const indice = Math.min(activo, Math.max(planos.length - 1, 0));

  const elegir = (e) => { onSelect(e); setTexto(''); setAbierto(false); setActivo(0); };
  const mover = (nuevo) => {
    setActivo(nuevo);
    requestAnimationFrame(() => lista.current?.querySelector(`[data-indice="${nuevo}"]`)?.scrollIntoView({ block: 'nearest' }));
  };
  const alTeclear = (ev) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setAbierto(true); mover(Math.min(indice + 1, planos.length - 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); mover(Math.max(indice - 1, 0)); }
    else if (ev.key === 'Enter' && visible && planos[indice]) { ev.preventDefault(); elegir(planos[indice]); }
  };

  const fila = (e, i, conArea) => {
    const area = nombreArea && (conArea || !sugeridos) ? nombreArea(e.areaId) : '';
    const detalle = [e.puesto, area].filter(Boolean).join(' · ');
    return (
      <li key={e.nomina} role="option" aria-selected={i === indice} data-indice={i}>
        <button type="button" tabIndex={-1} onMouseDown={ev => ev.preventDefault()} onMouseEnter={() => setActivo(i)} onClick={() => elegir(e)}
          className={`block w-full cursor-pointer px-3 py-1.5 text-left hover:bg-[var(--bg-surface-hover)] ${i === indice ? 'bg-[var(--bg-surface-hover)]' : ''}`}>
          <span className="flex items-baseline gap-2 text-sm">
            <span className="shrink-0 font-mono font-semibold text-[var(--text-main)]">{e.nomina}</span>
            <span className="min-w-0 break-words text-[var(--text-main)]">{e.nombre}</span>
          </span>
          {detalle && <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{detalle}</span>}
        </button>
      </li>
    );
  };

  const titulo = (t) => <li role="presentation" className="sticky top-0 z-10 border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)]">{t}</li>;
  const vacio = <li className="px-3 py-3 text-xs text-[var(--text-muted)]">{q ? 'Sin coincidencias en el padrón.' : 'Escribe para buscar en el padrón.'}</li>;
  const cajaLista = panel
    ? 'mt-2 h-[min(34rem,56dvh)] overflow-y-auto rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)]'
    : 'absolute left-0 right-0 top-full z-30 mt-1 max-h-[min(24rem,50dvh)] overflow-y-auto rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-lg';

  return (
    <div className={panel ? '' : 'relative'}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
        <input type="search" value={texto} autoFocus={autoFocus} placeholder={placeholder} role="combobox" aria-expanded={visible && !!hayLista} aria-autocomplete="list"
          onChange={e => { setTexto(e.target.value); setAbierto(true); setActivo(0); }}
          onKeyDown={alTeclear}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          className={`${CONTROL} ${CONTROL_OK} pl-8`} />
      </div>
      {visible && hayLista && (
        <ul ref={lista} role="listbox" className={cajaLista}>
          {planos.length === 0 ? vacio : (
            <>
              {sugeridos && propios.length > 0 && titulo(etiquetaSugeridos)}
              {propios.map((e, i) => fila(e, i, false))}
              {otros.length > 0 && titulo(etiquetaOtros)}
              {otros.map((e, i) => fila(e, propios.length + i, true))}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
