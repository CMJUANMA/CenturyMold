/**
 * ModalCargaInicial.jsx — "Cargar asignaciones iniciales" (solo admin): lista de revisión con la configuración de la hoja
 * "Niveles de autorización". No guarda nada sin que se revise: cada fila tiene su casilla, y lo ya existente no se toca.
 * Crea con asignarRol (las mismas reglas y bitácora que "Asignar rol"); es idempotente.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import Modal from '../../../components/Modal';
import { ROL_OP_CORTOS, aIsoLocal } from '../../../utils/asignaciones';
import { asignarRol } from '../../../utils/asignacionesDb';
import { ESTADO_FILA, MOTIVO_CARGA_INICIAL, evaluarPropuestas } from '../../../utils/cargaInicial';
import { btnPrimary, btnSecondary, etiquetaCls } from './ui';

const AVISO_CLS = 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]';
const ETIQUETAS = {
  [ESTADO_FILA.LISTO]: ['Listo', 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]'],
  [ESTADO_FILA.YA_EXISTE]: ['Ya existe', ''],
  [ESTADO_FILA.NO_PADRON]: ['No está en el padrón', 'border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-text)]'],
  [ESTADO_FILA.AREA_DISTINTA]: ['Área distinta', AVISO_CLS],
  [ESTADO_FILA.SIN_USUARIO]: ['Sin usuario', AVISO_CLS],
  [ESTADO_FILA.REVISAR_NOMBRE]: ['Revisar nombre', 'border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-text)]'],
};

export default function ModalCargaInicial({ abierto, ...resto }) {
  return abierto ? <Contenido {...resto} /> : null;
}

function Contenido({ actor, empleados, usuarios, asignaciones, nombresArea, onClose, onTerminado }) {
  const filas = useMemo(() => evaluarPropuestas({ empleados, usuarios, asignaciones }), [empleados, usuarios, asignaciones]);
  const [marcadas, setMarcadas] = useState(() => new Set(filas.filter(f => f.marcada).map(f => f.id)));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const alternar = (id) => setMarcadas(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const seleccionadas = filas.filter(f => f.seleccionable && marcadas.has(f.id));

  const crear = async () => {
    setGuardando(true); setError('');
    const fallidas = [];
    let creadas = 0;
    const desde = aIsoLocal(new Date());
    for (const f of seleccionadas) {
      try {
        await asignarRol(actor, {
          nomina: f.empleado.nomina, nombre: f.empleado.nombre, rol: f.rol, areaId: f.areaId, desde, hasta: '', motivo: MOTIVO_CARGA_INICIAL,
        }, f.previa);
        creadas++;
      } catch (err) { fallidas.push(`${f.nomina}: ${err.message}`); }
    }
    setGuardando(false);
    if (fallidas.length) { setError(`Se crearon ${creadas}; fallaron ${fallidas.length}: ${fallidas.join(' · ')}`); return; }
    onTerminado(creadas);
  };

  return (
    <Modal isOpen onClose={onClose} title="Cargar asignaciones iniciales" maxWidth="max-w-5xl">
      <div className="space-y-3">
        <p className="text-xs text-[var(--text-secondary)]">
          Configuración de la hoja <b>Niveles de autorización</b>. Revisa cada fila: no se guarda nada hasta que pulses el botón, y solo las marcadas.
          Todas serán permanentes. El nombre que se guarda sale del padrón.
        </p>
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-xs text-[var(--status-error-text)]">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}
        <div className="overflow-x-auto rounded-lg border border-[var(--border-color)]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2" />
                <th className="px-3 py-2">Rol</th>
                <th className="px-3 py-2">Área</th>
                <th className="px-3 py-2">Nómina</th>
                <th className="px-3 py-2">Nombre (padrón)</th>
                <th className="px-3 py-2">Puesto</th>
                <th className="px-3 py-2">Área en el padrón</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filas.map(f => {
                const etiquetas = f.estado === ESTADO_FILA.LISTO && f.avisos.length === 0 ? [ESTADO_FILA.LISTO] : f.estado === ESTADO_FILA.LISTO ? f.avisos : [f.estado];
                return (
                  <tr key={f.id} className={f.seleccionable ? '' : 'opacity-60'}>
                    <td className="px-3 py-2">
                      {f.seleccionable && (
                        <input type="checkbox" checked={marcadas.has(f.id)} onChange={() => alternar(f.id)}
                          aria-label={`Crear ${ROL_OP_CORTOS[f.rol]} ${f.nomina}`} className="h-3.5 w-3.5 accent-[var(--cm-red)]" />
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{ROL_OP_CORTOS[f.rol]}</td>
                    <td className="px-3 py-2">{f.areaId ? (nombresArea.get(f.areaId) ?? f.areaId) : 'Planta'}</td>
                    <td className="px-3 py-2 font-mono font-bold">{f.nomina}</td>
                    <td className="px-3 py-2">
                      {f.empleado ? f.nombre : <span className="text-[var(--text-muted)]">{f.nombreHoja} (hoja)</span>}
                      {f.avisos.includes(ESTADO_FILA.REVISAR_NOMBRE) && <div className="text-[10px] text-[var(--text-muted)]">La hoja dice: {f.nombreHoja}</div>}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{f.puesto || '—'}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{f.areaPadron ? (nombresArea.get(f.areaPadron) ?? f.areaPadron) : '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {etiquetas.map(e => <span key={e} className={`${etiquetaCls} ${ETIQUETAS[e][1]}`}>{ETIQUETAS[e][0]}</span>)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-[var(--text-muted)]">{seleccionadas.length} seleccionadas de {filas.filter(f => f.seleccionable).length} disponibles</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
            <button type="button" id="btn-crear-asignaciones-iniciales" onClick={crear} disabled={guardando || seleccionadas.length === 0} className={btnPrimary}>
              {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Crear {seleccionadas.length} asignaciones seleccionadas
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
