/**
 * TabTurnos.jsx — Estructura > Turnos: horario normal de los turnos de nómina A, B y C (entrada y salida, en los bloques 7:00, 16:00,
 * 19:00 y 0:00). Empiezan vacíos y RH los captura. Con ellos, una extensión de turno sabe a qué hora empieza el tiempo extra de cada empleado.
 */
import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import { useTurnosNomina } from '../../../hooks/useTurnosNomina';
import AyudaPantalla from '../../../components/AyudaPantalla';
import { HORAS_ENTRADA_TE, HORAS_SALIDA_TE } from '../../../utils/tiempoExtra';
import { TURNOS_NOMINA_IDS, guardarTurnosNomina } from '../../../utils/turnosNominaDb';

const sel = 'rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-2 text-sm text-[var(--text-main)] outline-none focus:border-[var(--cm-red)]';

export default function TabTurnos() {
  const { usuario } = useAuth();
  const toast = useToast();
  const { turnos, cargando, recargar } = useTurnosNomina();
  const [form, setForm] = useState(turnos);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { setForm(turnos); }, [turnos]);

  const cambiar = (t, campo, valor) => setForm(f => ({ ...f, [t]: { ...f[t], [campo]: valor } }));
  const incompletos = TURNOS_NOMINA_IDS.filter(t => !!form[t].entrada !== !!form[t].salida);
  const sinCambios = TURNOS_NOMINA_IDS.every(t => form[t].entrada === turnos[t].entrada && form[t].salida === turnos[t].salida);

  const guardar = async () => {
    setGuardando(true);
    try { await guardarTurnosNomina(usuario, form); toast.success('Turnos guardados.'); recargar(); }
    catch (err) { toast.error('No se pudieron guardar los turnos: ' + err.message, 8000); } finally { setGuardando(false); }
  };

  if (cargando) return <div className="flex items-center gap-2 py-10 text-xs text-[var(--text-secondary)]"><Loader2 className="h-4 w-4 animate-spin" />Cargando...</div>;
  return (
    <section className="space-y-4" aria-label="Turnos de nómina">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-[var(--text-main)]">Horario normal de cada turno</h2>
        <AyudaPantalla id="turnos" />
      </div>
      <p className="text-xs text-[var(--text-secondary)]">
        Las extensiones de turno empiezan cuando termina el turno normal del empleado. Mientras un turno esté vacío, quien captura la extensión tendrá que escribir a mano la hora en que termina el turno de cada empleado.
      </p>
      <div className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-xs font-semibold text-[var(--text-secondary)]">
            <tr><th className="px-4 py-3">Turno</th><th className="px-4 py-3">Entrada</th><th className="px-4 py-3">Salida (fin del turno)</th></tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {TURNOS_NOMINA_IDS.map(t => (
              <tr key={t}>
                <th scope="row" className="px-4 py-3 font-semibold text-[var(--text-main)]">Turno {t}</th>
                <td className="px-4 py-3">
                  <select aria-label={`Entrada del turno ${t}`} value={form[t].entrada} onChange={e => cambiar(t, 'entrada', e.target.value)} className={sel}>
                    <option value="">Sin configurar</option>{HORAS_ENTRADA_TE.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select aria-label={`Salida del turno ${t}`} value={form[t].salida} onChange={e => cambiar(t, 'salida', e.target.value)} className={sel}>
                    <option value="">Sin configurar</option>{HORAS_SALIDA_TE.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {incompletos.length > 0 && <p className="text-xs font-semibold text-[var(--status-warning-text)]">Turno {incompletos.join(', ')}: captura la entrada y la salida, o deja las dos vacías.</p>}
      <div className="flex justify-end">
        <button type="button" onClick={guardar} disabled={guardando || sinCambios || incompletos.length > 0}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[var(--cm-red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--cm-red-hover)] disabled:opacity-50">
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Guardar turnos
        </button>
      </div>
    </section>
  );
}
