/**
 * LimpiezaEstructura.jsx — RH > Catálogos > Diagnóstico (solo admin): "Limpiar estructura vieja".
 * Quita areaTE y areaTEManual del padrón, con respaldo JSON antes y confirmación escribiendo LIMPIAR.
 */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import {
  descargarJson, leerCamposViejos, limpiarCamposViejos, nombreRespaldoLimpieza, respaldoCamposViejosJson,
} from '../../utils/limpiezaEstructura';

const btn = 'inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold active:scale-95 transition-all disabled:opacity-50 cursor-pointer';

export default function LimpiezaEstructura() {
  const { usuario } = useAuth();
  const toast = useToast();
  const [ocupado, setOcupado] = useState('');
  const [pendientes, setPendientes] = useState(null);
  const [palabra, setPalabra] = useState('');
  const [error, setError] = useState('');

  if (usuario?.rol !== 'admin') return null;

  const revisar = async () => {
    setOcupado('revisar'); setError(''); setPalabra('');
    try { setPendientes(await leerCamposViejos()); } catch (err) { setError('No se pudo leer el padrón: ' + err.message); } finally { setOcupado(''); }
  };
  const limpiar = async () => {
    setOcupado('limpiar'); setError('');
    try {
      descargarJson(respaldoCamposViejosJson(pendientes), nombreRespaldoLimpieza());
      await limpiarCamposViejos(pendientes, { uid: usuario.uid, nombre: usuario.nombre });
      toast.success(`Campos viejos quitados de ${pendientes.length} empleados.`, 8000);
      setPendientes([]); setPalabra('');
    } catch (err) { setError(err.message); } finally { setOcupado(''); }
  };

  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4" id="limpieza-estructura">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-main)]">Limpiar estructura vieja</h3>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
          Quita del padrón los campos <b>areaTE</b> y <b>areaTEManual</b>, que ya nada usa (descarga un respaldo antes). Las colecciones anteriores
          (areasTE, config/areasTE, config/tiempoExtra, accesosTE) ya no tienen reglas: si existieran, se borran desde la consola de Firebase.
        </p>
      </div>
      <button type="button" onClick={revisar} disabled={!!ocupado}
        className={`${btn} border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]`}>
        {ocupado === 'revisar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Revisar el padrón
      </button>
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-xs text-[var(--status-error-text)]">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}
      {pendientes && (pendientes.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-2 text-xs text-[var(--status-success-text)]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />Ningún empleado tiene campos viejos.
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-main)]">{pendientes.length} empleados tienen campos viejos.</p>
          <div className="flex flex-wrap gap-2">
            <input aria-label="Escribe LIMPIAR" placeholder="Escribe LIMPIAR" value={palabra} onChange={e => setPalabra(e.target.value)} autoComplete="off"
              className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs" />
            <button type="button" id="btn-limpiar-estructura" onClick={limpiar} disabled={palabra !== 'LIMPIAR' || !!ocupado}
              className={`${btn} bg-[var(--cm-red)] text-white hover:bg-[var(--cm-red-hover)]`}>
              {ocupado === 'limpiar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Limpiar estructura vieja
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
