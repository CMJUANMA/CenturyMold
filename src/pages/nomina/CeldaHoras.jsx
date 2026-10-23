/**
 * CeldaHoras.jsx — Una celda de día de la hoja de revisión de nómina: un campo numérico que se edita directo, como en Excel.
 * Acepta medios y cuartos (0.5, 7.25; también con coma); vacío = sin horas. El valor se confirma al salir de la celda o con Enter / flechas / Tab.
 * Enter baja (Mayús+Enter sube), ↑ ↓ cambian de renglón y ← → de día (← → solo al llegar al borde del texto, para poder corregir lo escrito).
 * Esc deja el valor como estaba. Una celda cambiada se pinta con color suave y, al pasar el mouse, dice lo autorizado.
 */
import { memo, useState } from 'react';
import { horasValidas } from '../../utils/formatoNomina';
import { moverFoco } from '../../utils/hojaNomina';

const texto = (h) => (h > 0 ? String(h) : '');

function CeldaHorasBase({ valor, clave, dia, f, c, etiqueta, titulo, cambiada, deshabilitada, onCambiar, onInvalida }) {
  const [escrito, setEscrito] = useState(null); // lo que se está escribiendo (null = se muestra el valor)

  const confirmar = (crudo) => {
    const t = crudo.trim().replace(',', '.');
    setEscrito(null);
    if (t === '') { if ((valor ?? 0) !== 0) onCambiar(clave, dia, 0); return; }
    if (!horasValidas(t)) { onInvalida(); return; }
    if (Number(t) !== (valor ?? 0)) onCambiar(clave, dia, Number(t));
  };
  const ir = (e, df, dc) => { e.preventDefault(); confirmar(e.currentTarget.value); moverFoco(e.currentTarget, df, dc); };
  const alBorde = (e, fin) => {
    const { selectionStart: a, selectionEnd: b, value } = e.currentTarget;
    return a === b ? a === (fin ? value.length : 0) : a === 0 && b === value.length;
  };
  const teclas = (e) => {
    if (e.key === 'Enter') ir(e, e.shiftKey ? -1 : 1, 0);
    else if (e.key === 'ArrowDown') ir(e, 1, 0);
    else if (e.key === 'ArrowUp') ir(e, -1, 0);
    else if (e.key === 'ArrowLeft' && alBorde(e, false)) ir(e, 0, -1);
    else if (e.key === 'ArrowRight' && alBorde(e, true)) ir(e, 0, 1);
    else if (e.key === 'Escape') { e.preventDefault(); setEscrito(null); }
  };

  return (
    <input type="text" inputMode="decimal" autoComplete="off" spellCheck={false}
      value={escrito ?? texto(valor)} disabled={deshabilitada} data-f={f} data-c={c} aria-label={etiqueta} title={titulo}
      onChange={e => setEscrito(e.target.value.slice(0, 6))} onFocus={e => e.target.select()} onBlur={e => confirmar(e.target.value)} onKeyDown={teclas}
      className={`h-8 w-full cursor-text rounded-none border border-transparent px-1.5 text-right font-mono text-xs tabular-nums text-[var(--text-main)] outline-none
        hover:border-[var(--border-color)] focus:border-[var(--accent-text)] focus:bg-[var(--bg-surface)] disabled:cursor-default disabled:opacity-60 disabled:hover:border-transparent
        ${cambiada ? 'bg-[var(--status-info-bg)] font-semibold' : 'bg-transparent'}`} />
  );
}

export default memo(CeldaHorasBase);
