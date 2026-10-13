/**
 * MigracionAsignaciones.jsx — RH > Herramientas (solo admin): pasa al modelo de asignaciones y limpia la estructura vieja.
 *   1. "Simular": descarga un respaldo JSON y muestra TODO lo que pasaría (no escribe nada).
 *   2. "Ejecutar": solo después de escribir MIGRAR.
 *   3. "Limpiar estructura vieja": paso aparte, solo cuando ya no queda nada por migrar; pide escribir LIMPIAR.
 */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Loader2, PlayCircle, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useAreas, invalidarAreas } from '../../hooks/useAreas';
import { ROL_OP_LABELS } from '../../utils/asignaciones';
import {
  descargarJson, ejecutarMigracion, leerDatosMigracion, limpiarEstructuraVieja, nombreRespaldoMigracion,
  planDeDatos, respaldoMigracionJson, resumenLimpieza,
} from '../../utils/migracionDb';

const caja = 'rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4';
const btn = 'inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold active:scale-95 transition-all disabled:opacity-50 cursor-pointer';
const btnRojo = `${btn} bg-[var(--cm-red)] text-white hover:bg-[var(--cm-red-hover)]`;
const btnGris = `${btn} border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]`;

function Lista({ titulo, filas, vacio }) {
  return (
    <div>
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">{titulo} ({filas.length})</h4>
      {filas.length === 0 ? <p className="text-xs text-[var(--text-muted)]">{vacio}</p> : (
        <ul className="mt-1 max-h-56 overflow-y-auto rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-2 text-xs space-y-0.5">
          {filas.map((f, i) => <li key={i} className="text-[var(--text-main)]">{f}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function MigracionAsignaciones() {
  const { usuario } = useAuth();
  const toast = useToast();
  const { nombres } = useAreas();
  const [ocupado, setOcupado] = useState('');
  const [datos, setDatos] = useState(null);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [palabra, setPalabra] = useState('');
  const [palabraLimpiar, setPalabraLimpiar] = useState('');

  if (usuario?.rol !== 'admin') return null;
  const actor = { uid: usuario.uid, nombre: usuario.nombre };
  const area = (id) => (id ? (nombres.get(id) ?? id) : 'toda la planta');

  const simular = async ({ respaldo }) => {
    setOcupado('simular'); setError(''); setPalabra(''); setPalabraLimpiar('');
    try {
      const d = await leerDatosMigracion();
      if (respaldo) descargarJson(respaldoMigracionJson(d), nombreRespaldoMigracion('Respaldo_Antes_Migracion'));
      setDatos(d);
      setPlan(planDeDatos(d));
    } catch (err) { setError('No se pudo leer: ' + err.message); } finally { setOcupado(''); }
  };

  const ejecutar = async () => {
    setOcupado('ejecutar'); setError('');
    try {
      const n = await ejecutarMigracion(plan, actor);
      toast.success(`Migración ejecutada (${n} operaciones). Vuelve a simular para verificar que no queda nada pendiente.`, 8000);
      invalidarAreas();
      await simular({ respaldo: false });
    } catch (err) { setError(err.message); setOcupado(''); }
  };

  const limpiar = async () => {
    setOcupado('limpiar'); setError('');
    try {
      const d = await leerDatosMigracion();
      descargarJson(respaldoMigracionJson(d), nombreRespaldoMigracion('Respaldo_Antes_Limpieza'));
      const n = await limpiarEstructuraVieja(d, actor);
      toast.success(`Estructura vieja eliminada (${n} operaciones).`, 8000);
      await simular({ respaldo: false });
    } catch (err) { setError(err.message); setOcupado(''); }
  };

  const sinPendiente = plan && !plan.pendiente;
  const limpieza = datos ? resumenLimpieza(datos) : null;
  const nadaQueLimpiar = limpieza && Object.values(limpieza).every(n => n === 0);
  const puedeLimpiar = sinPendiente && datos.asignaciones.length > 0 && !nadaQueLimpiar;

  return (
    <div className={caja} id="migracion-asignaciones">
      <div>
        <h3 className="text-sm font-bold text-[var(--text-main)]">Migrar al modelo de asignaciones</h3>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
          Convierte la matriz anterior (áreas de tiempo extra, Aut. 2, accesos temporales y roles superintendente/autorizador) en asignaciones.
          Primero descarga un respaldo JSON y muestra la simulación; no escribe nada hasta que escribas MIGRAR.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" id="btn-simular-migracion" onClick={() => simular({ respaldo: true })} disabled={!!ocupado} className={btnGris}>
          {ocupado === 'simular' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Respaldar y simular
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-xs text-[var(--status-error-text)]">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {plan && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Aut. 2', plan.resumen.aut2], ['Aut. 1', plan.resumen.aut1], ['Solicitantes', plan.resumen.solicitantes],
              ['Usuarios → "usuario"', plan.resumen.usuariosAUsuario], ['Por decidir', plan.resumen.porDecidir],
              ['Excepciones de área', plan.resumen.excepciones], ['Advertencias', plan.resumen.advertencias], ['Ya migradas', plan.resumen.yaMigradas],
            ].map(([t, n]) => (
              <div key={t} className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] p-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t}</div>
                <div className="text-lg font-bold text-[var(--text-main)]">{n}</div>
              </div>
            ))}
          </div>

          <Lista titulo="Asignaciones que se crearán" vacio="Ninguna."
            filas={plan.asignaciones.map(a => `${ROL_OP_LABELS[a.rol]} · ${area(a.areaId)} — ${a.nomina} ${a.nombre}${a.hasta ? ' (temporal)' : ''}  [${a.origen}]`)} />
          <Lista titulo="Usuarios cuyo rol cambia a «usuario»" vacio="Ninguno."
            filas={plan.usuariosCambios.map(u => `${u.nomina} ${u.nombre}: ${u.rolAntes} → usuario`)} />
          <Lista titulo="Por decidir (superintendentes sin área o en un área que no participa; su rol NO cambia)" vacio="Ninguno."
            filas={plan.porDecidir.map(u => `${u.nomina} ${u.nombre}: ${u.motivo}`)} />
          <Lista titulo="Excepciones de área (areaTEManual → areaExcepcion)" vacio="Ninguna."
            filas={plan.excepciones.map(e => `${e.nomina} ${e.nombre}: ${e.areaAntes || 'sin área'} → ${e.areaExcepcion}`)} />
          <Lista titulo="Personas con asignación que aún no tienen usuario" vacio="Todas tienen usuario."
            filas={plan.sinUsuario.map(s => `${s.nomina} ${s.nombre} (${ROL_OP_LABELS[s.rol]} · ${area(s.areaId)})`)} />
          <Lista titulo="Advertencias" vacio="Ninguna." filas={plan.advertencias} />

          {plan.pendiente ? (
            <div className="space-y-2 rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3">
              <label htmlFor="palabra-migrar" className="block text-xs font-semibold text-[var(--status-warning-text)]">
                Para ejecutar la migración escribe MIGRAR
              </label>
              <div className="flex flex-wrap gap-2">
                <input id="palabra-migrar" value={palabra} onChange={e => setPalabra(e.target.value)} autoComplete="off"
                  className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs" />
                <button type="button" id="btn-ejecutar-migracion" onClick={ejecutar} disabled={palabra !== 'MIGRAR' || !!ocupado} className={btnRojo}>
                  {ocupado === 'ejecutar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}Ejecutar migración
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-2 text-xs text-[var(--status-success-text)]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />Nada pendiente por migrar.
            </div>
          )}

          {sinPendiente && (
            <div className="space-y-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] p-3">
              <h4 className="text-xs font-bold text-[var(--text-main)]">Limpiar estructura vieja (paso aparte)</h4>
              <p className="text-xs text-[var(--text-secondary)]">
                Borra la colección areasTE ({limpieza.areasTE}), config/areasTE ({limpieza.configAreasTE}) y accesosTE ({limpieza.accesosTE}), y los campos
                areaTE / areaTEManual de {limpieza.empleadosConCamposViejos} empleados. Antes descarga otro respaldo. Hazlo después de verificar el organigrama.
              </p>
              {nadaQueLimpiar ? (
                <p className="text-xs text-[var(--text-muted)]">Ya no queda estructura vieja.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <input aria-label="Escribe LIMPIAR" placeholder="Escribe LIMPIAR" value={palabraLimpiar} onChange={e => setPalabraLimpiar(e.target.value)} autoComplete="off"
                    className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs" />
                  <button type="button" id="btn-limpiar-estructura" onClick={limpiar} disabled={!puedeLimpiar || palabraLimpiar !== 'LIMPIAR' || !!ocupado} className={btnRojo}>
                    {ocupado === 'limpiar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Limpiar estructura vieja
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
