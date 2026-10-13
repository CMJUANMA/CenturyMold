/**
 * TabOrganigrama.jsx — Organigrama de autorización, generado SOLO con las asignaciones vigentes.
 * Forma de la hoja "Niveles de autorización": arriba Autorización 2 a todo lo ancho; debajo una columna por área con
 * participaTE (en orden) con su Aut. 1 (amarillo) y sus solicitantes (rosa). Quien puede asignar ve "+ Aut. 1" / "+ Solicitante"
 * en cada columna y puede revocar desde la tarjeta; los demás lo ven en solo lectura.
 */
import { useMemo } from 'react';
import { AlertTriangle, Plus, X } from 'lucide-react';
import { ROL_OP, construirOrganigrama, formatoCorto, rolesAsignables } from '../../../utils/asignaciones';
import { revocarAsignacion } from '../../../utils/asignacionesDb';
import { useConfirmar } from '../../../hooks/useConfirmar';
import { useToast } from '../../../hooks/useToast';

const COLORES = {
  [ROL_OP.AUT2]: 'bg-[var(--org-aut2-bg)] border-[var(--org-aut2-border)]',
  [ROL_OP.AUT1]: 'bg-[var(--org-aut1-bg)] border-[var(--org-aut1-border)]',
  [ROL_OP.SOLICITANTE]: 'bg-[var(--org-sol-bg)] border-[var(--org-sol-border)]',
};

function Tarjeta({ t, puedeRevocar, onRevocar }) {
  return (
    <div data-rol={t.rol} className={`relative rounded-md border px-3 py-2 text-[var(--org-text)] ${COLORES[t.rol]}`}>
      {puedeRevocar && (
        <button type="button" onClick={() => onRevocar(t)} title="Revocar" aria-label={`Revocar a ${t.nombre}`}
          className="absolute right-1 top-1 rounded p-0.5 opacity-60 hover:bg-black/10 hover:opacity-100 cursor-pointer">
          <X className="h-3 w-3" />
        </button>
      )}
      <div className="pr-4 text-xs font-bold leading-tight">{t.nombre}</div>
      {t.puesto && <div className="text-[11px] leading-tight opacity-80">{t.puesto}</div>}
      <div className="font-mono text-[10px] opacity-70">{t.nomina}</div>
      {(t.temporalHasta || t.sinUsuario) && (
        <div className="mt-1 flex flex-wrap gap-1">
          {t.temporalHasta && (
            <span className="rounded bg-black/10 px-1 py-0.5 text-[9px] font-semibold">Temporal hasta {formatoCorto(t.temporalHasta)}</span>
          )}
          {t.sinUsuario && <span className="rounded bg-[var(--status-error-bg)] px-1 py-0.5 text-[9px] font-semibold text-[var(--status-error-text)]">Sin usuario</span>}
        </div>
      )}
    </div>
  );
}

export default function TabOrganigrama({ asignaciones, areas, empleados, usuarios, actor, ahora, onAsignar, onCambio }) {
  const confirmar = useConfirmar();
  const toast = useToast();
  const asignables = rolesAsignables(actor);
  const puedeAsignar = asignables.length > 0;

  const empleadosPorNomina = useMemo(() => new Map(empleados.map(e => [String(e.nomina), e])), [empleados]);
  // "Sin usuario" solo se puede saber si quien ve puede leer usuarios (RH, admin, Aut. 2)
  const nominasConUsuario = useMemo(() => (usuarios ? new Set(usuarios.map(u => String(u.nomina))) : null), [usuarios]);
  const org = useMemo(
    () => construirOrganigrama({ asignaciones, areas, empleados: empleadosPorNomina, nominasConUsuario, ahora }),
    [asignaciones, areas, empleadosPorNomina, nominasConUsuario, ahora],
  );

  const puedeRevocar = (t) => asignables.includes(t.rol) && (actor.esAdmin || t.nomina !== String(actor.nomina));
  const revocar = async (t) => {
    const original = asignaciones.find(a => a.id === t.id);
    if (!original) return;
    if (!await confirmar({
      titulo: 'Revocar rol', mensaje: `¿Revocar el rol a ${t.nombre}? Deja de tener el permiso de inmediato; el registro se conserva.`,
      textoConfirmar: 'Revocar', peligroso: true,
    })) return;
    try {
      await revocarAsignacion(actor, original);
      toast.success('Rol revocado.');
      onCambio?.();
    } catch (err) { toast.error('No se pudo revocar: ' + err.message); }
  };

  return (
    <div className="space-y-4" id="organigrama">
      <div className={`rounded-lg border p-3 ${COLORES[ROL_OP.AUT2]}`}>
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--org-text)]">Autorización 2</div>
        {org.aut2.length === 0 ? (
          <p className="text-xs text-[var(--org-text)]">Nadie tiene Autorización 2 vigente: ninguna solicitud podrá autorizarse (solo RH puede firmar este nivel).</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {org.aut2.map(t => <Tarjeta key={t.id} t={t} puedeRevocar={puedeRevocar(t)} onRevocar={revocar} />)}
          </div>
        )}
        {asignables.includes(ROL_OP.AUT2) && (
          <button type="button" onClick={() => onAsignar({ rol: ROL_OP.AUT2 })}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--org-text)] hover:underline cursor-pointer">
            <Plus className="h-3 w-3" />Aut. 2
          </button>
        )}
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[640px] gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(org.columnas.length, 1)}, minmax(170px, 1fr))` }}>
          {org.columnas.map(({ area, aut1, solicitantes, sinAut1 }) => (
            <section key={area.id} aria-label={area.nombre} className="space-y-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-2.5">
              <h3 className="text-center text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">{area.nombre}</h3>
              {sinAut1 && (
                <div role="alert" className="flex items-start gap-1.5 rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-2 py-1.5 text-[10px] font-semibold text-[var(--status-error-text)]">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>Sin Autorización 1: las solicitudes de esta área no podrán avanzar</span>
                </div>
              )}
              {aut1.map(t => <Tarjeta key={t.id} t={t} puedeRevocar={puedeRevocar(t)} onRevocar={revocar} />)}
              {solicitantes.map(t => <Tarjeta key={t.id} t={t} puedeRevocar={puedeRevocar(t)} onRevocar={revocar} />)}
              {solicitantes.length === 0 && <p className="text-center text-[10px] text-[var(--text-muted)]">Sin solicitantes</p>}
              {puedeAsignar && (
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 pt-1">
                  <button type="button" onClick={() => onAsignar({ rol: ROL_OP.AUT1, areaId: area.id })}
                    className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[var(--cm-red)] hover:underline cursor-pointer">
                    <Plus className="h-3 w-3" />Aut. 1
                  </button>
                  <button type="button" onClick={() => onAsignar({ rol: ROL_OP.SOLICITANTE, areaId: area.id })}
                    className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[var(--cm-red)] hover:underline cursor-pointer">
                    <Plus className="h-3 w-3" />Solicitante
                  </button>
                </div>
              )}
            </section>
          ))}
        </div>
        {org.columnas.length === 0 && (
          <p className="text-xs text-[var(--text-muted)]">No hay áreas que participen en tiempo extra. Márcalas en Estructura.</p>
        )}
      </div>

      <p className="text-[10px] text-[var(--text-muted)]">
        Solo muestra asignaciones vigentes hoy. Las temporales dejan de aparecer solas al llegar su fecha final.
      </p>
    </div>
  );
}
