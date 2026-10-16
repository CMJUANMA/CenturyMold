/**
 * LimpiezaEstructura.jsx — RH > Catálogos > Diagnóstico (solo admin): "Limpiar estructura vieja".
 * Quita areaTE y areaTEManual del padrón, con respaldo JSON antes y confirmación escribiendo LIMPIAR.
 * Acción destructiva: el botón final va en contorno de error, nunca en rojo sólido.
 */
import { useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import { Campo, Entrada } from '../../components/ui/Campo';
import {
  descargarJson, leerCamposViejos, limpiarCamposViejos, nombreRespaldoLimpieza, respaldoCamposViejosJson,
} from '../../utils/limpiezaEstructura';

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
    <section className="space-y-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5" id="limpieza-estructura" aria-label="Limpiar estructura vieja">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-main)]">Limpiar estructura vieja</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Quita del padrón los campos <b className="font-medium text-[var(--text-main)]">areaTE</b> y <b className="font-medium text-[var(--text-main)]">areaTEManual</b>, que ya nada usa (descarga un respaldo antes). Las colecciones anteriores
          (areasTE, config/areasTE, config/tiempoExtra, accesosTE) ya no tienen reglas: si existieran, se borran desde la consola de Firebase.
        </p>
      </div>
      <Boton icono={Search} estado={ocupado === 'revisar' ? 'cargando' : undefined} onClick={revisar} disabled={!!ocupado}>Revisar el padrón</Boton>
      {error && <Aviso tono="error">{error}</Aviso>}
      {pendientes && (pendientes.length === 0 ? (
        <Aviso tono="exito">Ningún empleado tiene campos viejos.</Aviso>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-main)]">{pendientes.length} empleados tienen campos viejos.</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Campo etiqueta="Escribe LIMPIAR para confirmar" className="sm:w-64">
              <Entrada placeholder="LIMPIAR" value={palabra} onChange={e => setPalabra(e.target.value)} autoComplete="off" />
            </Campo>
            <Boton id="btn-limpiar-estructura" variante="peligro" icono={Trash2} estado={ocupado === 'limpiar' ? 'cargando' : undefined} onClick={limpiar} disabled={palabra !== 'LIMPIAR' || !!ocupado}>Limpiar estructura vieja</Boton>
          </div>
        </div>
      ))}
    </section>
  );
}
