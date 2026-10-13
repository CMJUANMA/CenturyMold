/**
 * AsignarPuestos.jsx — «Asignar puestos y áreas»: toma el texto de puesto de los empleados que aún no tienen
 * puestoId, lo resuelve contra el catálogo (los mismos 3 niveles que la importación) y muestra una SIMULACIÓN.
 * Solo escribe al pulsar «Aplicar»; los puestos sin resolver se resuelven o se omiten (esos empleados no se tocan).
 */
import { useMemo, useState } from 'react';
import { doc } from 'firebase/firestore';
import { db } from '../../../firebase';
import Modal from '../../../components/Modal';
import ResolucionPuestos from '../../../components/ResolucionPuestos';
import { construirResolucion } from '../../../utils/resolucionPuestos';
import { normalizarPuesto, clavePuesto } from '../../../utils/puestos';
import { ejecutarEnLotes, opBitacora, opsDeResolucion } from '../../../utils/estructuraDb';
import { useToast } from '../../../hooks/useToast';
import { btnPrimary, btnSecondary, chip } from './ui';

export default function AsignarPuestos({ areas, puestos, empleados, usuario, onClose, onHecho }) {
  const toast = useToast();
  const [decisiones, setDecisiones] = useState(() => new Map());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const catalogo = useMemo(() => puestos.filter(p => p.activo !== false), [puestos]);
  const areasActivas = useMemo(() => areas.filter(a => a.activa !== false).sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99)), [areas]);
  const nombreArea = (id) => areas.find(a => a.id === id)?.nombre ?? id;

  // Empleados a procesar: sin puestoId y con algún texto de puesto
  const pendientesEmp = useMemo(() => empleados.filter(e => !e.puestoId && normalizarPuesto(e.puesto)), [empleados]);
  const sinTexto = empleados.filter(e => !e.puestoId && !normalizarPuesto(e.puesto)).length;
  const filas = useMemo(() => pendientesEmp.map(e => ({
    estado: 'valido', filaExcel: 0, puestoCrudo: e.puesto ?? '',
    datos: { NOMINA: String(e.nomina ?? e.id), NOMBRE: e.nombre ?? '', PUESTO: normalizarPuesto(e.puesto) },
  })), [pendientesEmp]);

  const resolucion = useMemo(() => construirResolucion(filas, catalogo, decisiones), [filas, catalogo, decisiones]);
  const decidir = (clave, d) => setDecisiones(prev => { const m = new Map(prev); if (d) m.set(clave, d); else m.delete(clave); return m; });

  // Simulación: qué recibiría cada empleado
  const cambios = useMemo(() => pendientesEmp.flatMap(e => {
    const res = resolucion.porClave.get(clavePuesto(normalizarPuesto(e.puesto)));
    if (!res || res.estado === 'pendiente' || res.estado === 'omitir') return [];
    const data = { puestoId: res.puestoId, puesto: res.nombre, areaId: e.areaExcepcion || res.areaId };
    if (e.areaExcepcion === undefined) Object.assign(data, { areaExcepcion: null, areaExcepcionMotivo: '' });
    return [{ e, data }];
  }), [pendientesEmp, resolucion]);
  const porArea = cambios.reduce((acc, { data }) => ({ ...acc, [data.areaId]: (acc[data.areaId] ?? 0) + 1 }), {});
  const omitidos = pendientesEmp.length - cambios.length - resolucion.pendientes.reduce((n, g) => n + g.empleados.length, 0);

  const aplicar = async () => {
    setGuardando(true); setError('');
    try {
      const ops = [
        ...opsDeResolucion(resolucion, usuario, 'asignacion'),
        ...cambios.map(({ e, data }) => (b) => b.update(doc(db, 'empleados', String(e.id)), data)),
        opBitacora({
          accion: 'asignacion_puestos_areas', entidad: 'empleados',
          despues: { empleados: cambios.length, puestosNuevos: resolucion.puestosNuevos.length, alias: resolucion.aliasNuevos.length, omitidos },
        }, usuario),
      ];
      await ejecutarEnLotes(ops);
      toast.success(`Puestos y áreas asignados a ${cambios.length} empleados.`);
      onHecho();
    } catch (e) {
      setError(`No se pudo guardar: ${e.message}`);
      toast.error(`No se pudo asignar (${e.code ?? e.message}).`, 8000);
    } finally { setGuardando(false); }
  };

  return (
    <Modal isOpen onClose={() => !guardando && onClose()} title="Asignar puestos y áreas" maxWidth="max-w-3xl" preventCloseOnBackdrop={guardando}>
      <div className="space-y-3 text-xs">
        {pendientesEmp.length === 0 ? (
          <p className="py-4 text-[var(--text-secondary)]">
            Todos los empleados con puesto ya tienen puestoId.{sinTexto > 0 && ` (${sinTexto} no tienen texto de puesto.)`}
          </p>
        ) : (
          <>
            <p className="text-[var(--text-secondary)]">
              <strong>Simulación:</strong> no se escribe nada hasta pulsar «Aplicar». Se procesan {pendientesEmp.length} empleado(s) sin puestoId
              ({[...new Set(pendientesEmp.map(e => clavePuesto(e.puesto)))].length} puestos distintos).
              {sinTexto > 0 && ` ${sinTexto} sin texto de puesto no se pueden asignar.`}
            </p>
            <ResolucionPuestos resolucion={resolucion} catalogo={catalogo} areas={areasActivas} decisiones={decisiones} onDecidir={decidir} />
            <div className="space-y-1.5 rounded-lg border border-[var(--border-color)] p-3">
              <p className="font-semibold text-[var(--text-main)]">Resultado: {cambios.length} empleado(s) recibirían puesto y área</p>
              <ul className="flex flex-wrap gap-1.5">
                {Object.entries(porArea).map(([id, n]) => <li key={id} className={chip}>{nombreArea(id)} · {n}</li>)}
              </ul>
              <p className="text-[var(--text-muted)]">
                Se crearán {resolucion.puestosNuevos.length} puesto(s) nuevo(s) y se guardarán {resolucion.aliasNuevos.length} alias.
                {omitidos > 0 && ` ${omitidos} empleado(s) omitidos no se tocan.`}
              </p>
            </div>
          </>
        )}
        {error && <p className="text-[var(--status-error-text)]">{error}</p>}
        <div className="flex items-center justify-end gap-2 pt-1">
          {resolucion.pendientes.length > 0 && <span className="text-[var(--status-warning-text)]">Resuelva u omita {resolucion.pendientes.length} puesto(s) para aplicar.</span>}
          <button type="button" className={btnSecondary} disabled={guardando} onClick={onClose}>Cerrar</button>
          <button type="button" className={btnPrimary} disabled={guardando || cambios.length === 0 || resolucion.pendientes.length > 0} onClick={aplicar}>
            {guardando ? 'Aplicando...' : `Aplicar a ${cambios.length} empleados`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
