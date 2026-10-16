/**
 * PreferenciasPanel.jsx — Cómo quiere ver la aplicación cada persona (se muestra dentro de "Mi cuenta"):
 *   Mostrar ayudas (sí/no) · Tamaño de letra (Normal/Grande) · Tema (Claro/Oscuro/Automático).
 * Se guarda en usuarios/{uid}.preferencias en cuanto se cambia, y se aplica al momento. Opciones grandes, pensadas para quien no está
 * acostumbrado a la tecnología. La opción elegida se marca con borde fuerte y un check (no con rojo).
 */
import { useState } from 'react';
import { Check, CircleHelp, Monitor, Moon, Sun, Type } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { usePreferencias } from '../hooks/usePreferencias';
import { useTheme } from '../context/ThemeContext';

function Opcion({ activa, onClick, icono: Icono, titulo, detalle }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activa}
      className={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-lg border p-4 text-left text-[var(--text-main)] transition-colors duration-150 ${activa
        ? 'border-[var(--text-main)] bg-[var(--bg-surface-hover)]'
        : 'border-[var(--border-color)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)]'}`}>
      {Icono && <Icono className="h-5 w-5 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />}
      <span className="min-w-0">
        <span className="block text-sm font-medium">{titulo}</span>
        {detalle && <span className="block text-xs text-[var(--text-secondary)]">{detalle}</span>}
      </span>
      {activa && <Check className="ml-auto h-4 w-4 shrink-0 text-[var(--text-main)]" aria-hidden="true" />}
    </button>
  );
}

function Seccion({ titulo, ayuda, children }) {
  return (
    <section className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
      <h2 className="text-lg font-semibold text-[var(--text-main)]">{titulo}</h2>
      {ayuda && <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{ayuda}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export default function PreferenciasPanel() {
  const { preferencias, guardar } = usePreferencias();
  const { setModo } = useTheme();
  const toast = useToast();
  const [guardando, setGuardando] = useState(false);

  const cambiar = async (parche, aplicar) => {
    aplicar?.(); // se ve al instante; si no se pudo guardar, se avisa
    setGuardando(true);
    try { await guardar(parche); } catch (err) { console.error(err); toast.error('Se aplicó en este equipo, pero no se pudo guardar en tu cuenta: ' + err.message, 8000); } finally { setGuardando(false); }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--text-secondary)]" aria-live="polite">Elige cómo quieres ver el sistema. Los cambios se guardan solos{guardando ? ' (guardando…)' : ''}.</p>

      <Seccion titulo="Mostrar ayudas" ayuda="Explicaciones cortas debajo de los campos, el signo de interrogación (?) junto a los títulos y el recorrido guiado.">
        <Opcion activa={preferencias.ayudas} icono={CircleHelp} titulo="Sí, mostrar ayudas" detalle="Recomendado si estás empezando" onClick={() => cambiar({ ayudas: true })} />
        <Opcion activa={!preferencias.ayudas} icono={CircleHelp} titulo="No, pantalla limpia" detalle="Sin textos de ayuda" onClick={() => cambiar({ ayudas: false })} />
      </Seccion>

      <Seccion titulo="Tamaño de letra" ayuda="Si te cuesta leer, elige Grande: todo el sistema se ve más grande.">
        <Opcion activa={preferencias.tamanoLetra === 'normal'} icono={Type} titulo="Normal" onClick={() => cambiar({ tamanoLetra: 'normal' })} />
        <Opcion activa={preferencias.tamanoLetra === 'grande'} icono={Type} titulo="Grande" detalle="Letra más grande" onClick={() => cambiar({ tamanoLetra: 'grande' })} />
      </Seccion>

      <Seccion titulo="Tema" ayuda="Los colores de la pantalla. Automático sigue lo que tenga tu equipo o tu celular.">
        <Opcion activa={preferencias.tema === 'claro'} icono={Sun} titulo="Claro" onClick={() => cambiar({ tema: 'claro' }, () => setModo('claro'))} />
        <Opcion activa={preferencias.tema === 'oscuro'} icono={Moon} titulo="Oscuro" onClick={() => cambiar({ tema: 'oscuro' }, () => setModo('oscuro'))} />
        <Opcion activa={preferencias.tema === 'auto'} icono={Monitor} titulo="Automático" detalle="Igual que tu equipo" onClick={() => cambiar({ tema: 'auto' }, () => setModo('auto'))} />
      </Seccion>
    </div>
  );
}
