/**
 * Estructura.jsx — ÁREAS → PUESTOS → EMPLEADOS (solo admin y RH). Pestañas: Áreas, Puestos, Excepciones y pendientes y Turnos
 * (horario normal de los turnos de nómina A, B y C). Cada colección se lee por separado y, si falla, se dice cuál y con qué código.
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { ejecutarEnLotes, leerColeccion } from '../../utils/estructuraDb';
import TabAreas from './estructura/TabAreas';
import TabPuestos from './estructura/TabPuestos';
import TabPendientes from './estructura/TabPendientes';
import TabTurnos from './estructura/TabTurnos';

const PESTANAS = [
  { id: 'areas', label: 'Áreas' },
  { id: 'puestos', label: 'Puestos' },
  { id: 'pendientes', label: 'Excepciones y pendientes' },
  { id: 'turnos', label: 'Turnos' },
];

export default function Estructura() {
  const { usuario } = useAuth();
  const toast = useToast();
  const [pestana, setPestana] = useState('areas');
  const [datos, setDatos] = useState({ areas: [], puestos: [], empleados: [] });
  const [fallos, setFallos] = useState([]);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    const nombres = ['areas', 'puestos', 'empleados'];
    const res = await Promise.all(nombres.map(n => leerColeccion(n, toast)));
    setDatos({ areas: res[0].datos, puestos: res[1].datos, empleados: res[2].datos });
    setFallos(res.map((r, i) => (r.error ? `${nombres[i]} (${r.error})` : null)).filter(Boolean));
    setCargando(false);
  }, [toast]);

  useEffect(() => { recargar(); }, [recargar]);

  /** Ejecuta las operaciones y recarga; devuelve true si todo se guardó (los errores se muestran, nunca se ocultan) */
  const guardar = useCallback(async (ops, mensajeOk) => {
    try {
      await ejecutarEnLotes(ops);
      toast.success(mensajeOk);
      await recargar();
      return true;
    } catch (e) {
      toast.error(`No se pudo guardar: ${e.message}`, 9000);
      return false;
    }
  }, [toast, recargar]);

  const props = { ...datos, usuario, toast, guardar, recargar };

  return (
    <div className="space-y-5">
      <div className="border-b border-[var(--border-color)] pb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Recursos Humanos</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">Estructura</h1>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Áreas → puestos → empleados: el área de cada empleado sale de su puesto.</p>
      </div>

      {fallos.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2.5 text-xs text-[var(--status-error-text)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>No se pudo leer: {fallos.join(', ')}. Los datos de esas colecciones aparecen vacíos; no guarde cambios hasta resolverlo (¿están desplegadas las reglas?).</p>
        </div>
      )}

      <div className="flex gap-1 border-b border-[var(--border-color)]" role="tablist">
        {PESTANAS.map(p => (
          <button key={p.id} type="button" role="tab" aria-selected={pestana === p.id} onClick={() => setPestana(p.id)}
            className={`-mb-px cursor-pointer border-b-2 px-4 py-2 text-xs font-semibold transition-colors ${pestana === p.id ? 'border-[var(--cm-red)] text-[var(--cm-red)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="flex items-center gap-2 py-10 text-xs text-[var(--text-secondary)]"><Loader2 className="h-4 w-4 animate-spin" />Cargando...</div>
      ) : (
        <>
          {pestana === 'areas' && <TabAreas {...props} />}
          {pestana === 'puestos' && <TabPuestos {...props} />}
          {pestana === 'pendientes' && <TabPendientes {...props} />}
          {pestana === 'turnos' && <TabTurnos />}
        </>
      )}
    </div>
  );
}
