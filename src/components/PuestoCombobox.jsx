/**
 * PuestoCombobox.jsx
 * Combobox reutilizable para capturar puestos de trabajo.
 *
 * Props:
 *   puestosExistentes  string[]   Lista de puestos ya registrados.
 *   value              string     Valor actual del campo.
 *   onChange           fn         Callback cuando el valor cambia.
 *   disabled           boolean    Deshabilita el control.
 *   required           boolean    Marca el campo como requerido.
 *   inputCls           string     Clases extra para el input.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Check } from 'lucide-react';

// ── Helpers de normalizacion ────────────────────────────────────────────────
export function normalizarTexto(s) {
  return String(s).trim().replace(/\s+/g, ' ').toUpperCase();
}

function sinAcentos(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function buscarCoincidencias(texto, puestosExistentes) {
  const norm = sinAcentos(texto);
  let exacto = null;
  const similares = [];
  for (const p of puestosExistentes) {
    const pNorm = sinAcentos(p);
    if (pNorm === norm) {
      exacto = p;
    } else if (levenshtein(pNorm, norm) <= 2 && pNorm !== norm) {
      similares.push(p);
    }
  }
  return { exacto, similares };
}

const OTRO = '__OTRO__';

const baseInputCls =
  'w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--cm-red)] disabled:bg-[var(--bg-surface-secondary)] disabled:opacity-60';

export default function PuestoCombobox({
  puestosExistentes = [],
  value = '',
  onChange,
  disabled = false,
  required = false,
  inputCls = '',
}) {
  const [query, setQuery]     = useState('');
  const [abierto, setAbierto] = useState(false);
  const [modoOtro, setModoOtro] = useState(false);
  const [textOtro, setTextOtro] = useState('');
  const [aviso, setAviso]     = useState(null);
  const [activo, setActivo]   = useState(-1);

  const wrapRef  = useRef(null);
  const inputRef = useRef(null);

  // Inicializar display desde value externo
  useEffect(() => {
    if (!value) {
      setQuery(''); setModoOtro(false); setTextOtro(''); return;
    }
    const existe = puestosExistentes.includes(value);
    if (existe) {
      setQuery(value); setModoOtro(false);
    } else {
      setModoOtro(true); setTextOtro(value);
      setQuery('Otro (escribir uno nuevo)');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Cerrar al click fuera
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const listaFiltrada = puestosExistentes.filter(p =>
    sinAcentos(p).includes(sinAcentos(query))
  );
  const opciones = [...listaFiltrada, OTRO];

  const seleccionar = useCallback((puesto) => {
    if (puesto === OTRO) {
      setModoOtro(true); setTextOtro('');
      setQuery('Otro (escribir uno nuevo)');
      setAbierto(false); onChange(''); setAviso(null);
      setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
      return;
    }
    setModoOtro(false); setTextOtro('');
    setQuery(puesto); setAbierto(false); setAviso(null);
    onChange(puesto);
  }, [onChange]);

  const confirmarOtro = useCallback(() => {
    const normalizado = normalizarTexto(textOtro);
    if (!normalizado) return;
    const { exacto, similares } = buscarCoincidencias(normalizado, puestosExistentes);
    if (exacto) {
      setAviso({ tipo: 'exacto', exacto });
      onChange(exacto); setQuery(exacto); setModoOtro(false); setTextOtro('');
    } else if (similares.length > 0) {
      setAviso({ tipo: 'similares', similares });
      onChange(normalizado);
    } else {
      onChange(normalizado); setAviso(null); setModoOtro(false); setQuery(normalizado);
    }
  }, [textOtro, puestosExistentes, onChange]);

  const usarSugerido = (sug) => {
    onChange(sug); setQuery(sug); setModoOtro(false); setTextOtro(''); setAviso(null);
  };

  const esDistinto = () => {
    setAviso(null); setModoOtro(false); setQuery(value);
  };

  const handleKeyDown = (e) => {
    if (!abierto) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') setAbierto(true);
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo(a => Math.min(a + 1, opciones.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && activo >= 0) { e.preventDefault(); seleccionar(opciones[activo]); }
    else if (e.key === 'Escape') setAbierto(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      {!modoOtro && (
        <div className="relative">
          <input
            type="text"
            autoComplete="off"
            disabled={disabled}
            required={required && !value}
            value={query}
            placeholder="Buscar puesto..."
            className={`${baseInputCls} ${inputCls} pr-8`}
            onFocus={() => setAbierto(true)}
            onChange={e => { setQuery(e.target.value); setAbierto(true); setActivo(-1); }}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button" tabIndex={-1} disabled={disabled}
            onClick={() => setAbierto(o => !o)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          >
            {abierto ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {abierto && (
            <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xl">
              {opciones.map((op, i) => (
                <button
                  key={op} type="button"
                  onMouseDown={() => seleccionar(op)}
                  onMouseEnter={() => setActivo(i)}
                  className={[
                    'flex w-full items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2 text-left text-xs last:border-0 hover:bg-[var(--bg-surface-secondary)] transition-colors',
                    activo === i ? 'bg-[var(--bg-surface-secondary)]' : '',
                    op === OTRO ? 'italic text-[var(--text-secondary)]' : 'text-[var(--text-main)]',
                  ].join(' ')}
                >
                  {value === op && op !== OTRO && <Check className="h-3 w-3 text-[var(--cm-red)] shrink-0" />}
                  {op === OTRO ? 'Otro (escribir uno nuevo)' : op}
                </button>
              ))}
              {listaFiltrada.length === 0 && query && (
                <div className="px-3 py-2 text-xs text-[var(--text-muted)] italic">
                  Sin coincidencias — elige "Otro" para escribir uno nuevo.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {modoOtro && (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <input
              ref={inputRef} type="text" autoComplete="off"
              disabled={disabled} required={required && !value}
              value={textOtro} placeholder="Escribe el nuevo puesto..."
              className={`${baseInputCls} ${inputCls} flex-1`}
              onChange={e => setTextOtro(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); confirmarOtro(); }
                if (e.key === 'Escape') { setModoOtro(false); setQuery(''); onChange(''); }
              }}
            />
            <button type="button" onClick={confirmarOtro}
              className="rounded-md bg-[var(--cm-red)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--cm-red-hover)] transition-colors shrink-0">
              OK
            </button>
            <button type="button"
              onClick={() => { setModoOtro(false); setQuery(''); onChange(''); setAviso(null); }}
              className="rounded-md border border-[var(--border-color)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-secondary)] transition-colors shrink-0">
              X
            </button>
          </div>
          <p className="text-[10px] text-[var(--text-muted)]">Se normalizara: trim, espacios dobles y mayusculas.</p>
        </div>
      )}

      {aviso && aviso.tipo === 'exacto' && (
        <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-[var(--status-success-bg)] border border-[var(--status-success-border)] px-2.5 py-2 text-[10px] text-[var(--status-success-text)]">
          <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Coincide con puesto existente &quot;<strong>{aviso.exacto}</strong>&quot;. Se usara ese para evitar duplicados.</span>
        </div>
      )}

      {aviso && aviso.tipo === 'similares' && (
        <div className="mt-1.5 rounded-md bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] px-2.5 py-2 space-y-1.5">
          <div className="flex items-start gap-1.5 text-[10px] text-[var(--status-warning-text)]">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Quisiste decir uno de estos?</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {aviso.similares.map(sug => (
              <button key={sug} type="button" onClick={() => usarSugerido(sug)}
                className="rounded border border-[var(--status-warning-border)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--status-warning-text)] hover:bg-[var(--status-warning-bg)] transition-colors">
                Usar &quot;{sug}&quot;
              </button>
            ))}
            <button type="button" onClick={esDistinto}
              className="rounded border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-secondary)] transition-colors">
              Es distinto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
