/**
 * ModalElegiblesTE.jsx — «Cargar elegibles TE»: carga el archivo del padrón de elegibles (NOMINA, AREA TE, ELEGIBLE TE).
 * Primero SIMULA: muestra cuántos quedan elegibles por área, cuántos no, los empleados del padrón que no vienen en el archivo (quedan como no
 * elegibles y NO se desactivan: pueden ser bajas) y los problemas del archivo. Solo escribe al pulsar «Aplicar». Lógica en utils/elegibles.js.
 */
import { useMemo, useRef, useState } from 'react';
import { doc } from 'firebase/firestore';
import { Download, FileSpreadsheet } from 'lucide-react';
import { db } from '../../firebase';
import Modal from '../../components/Modal';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import { Fila, Tabla, Td, Th } from '../../components/ui/Tabla';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { ejecutarEnLotes, opBitacora } from '../../utils/estructuraDb';
import { planElegiblesTE } from '../../utils/elegibles';
import { agregarHojaReporte, leerElegiblesArchivo, nuevoLibro } from '../../utils/formatosImportacion';
import { bufferSeguro, motivoArchivoNoValido } from '../../utils/excelSeguro';

const TOPE_BITACORA = 500;

async function descargarLista(plan, nombreArea) {
  const wb = nuevoLibro();
  agregarHojaReporte(wb, 'No vienen en el archivo', ['Nómina', 'Nombre', 'Puesto', 'Área', 'Activo'],
    plan.noEnArchivo.map(e => [e.nomina, e.nombre, e.puesto, nombreArea(e.areaId), e.activo ? 'Sí' : 'No']));
  if (plan.noEnPadron.length) agregarHojaReporte(wb, 'No están en el padrón', ['Nómina', 'AREA TE', 'ELEGIBLE TE'], plan.noEnPadron.map(e => [e.nomina, e.areaTE, e.elegible ? 'SI' : 'NO']));
  const buffer = await bufferSeguro(wb);
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'Elegibles_TE_pendientes.xlsx'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ModalElegiblesTE({ empleados, areas, puestos, onClose, onAplicado }) {
  const toast = useToast();
  const { usuario } = useAuth();
  const entrada = useRef(null);
  const [archivo, setArchivo] = useState('');
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState('');
  const [aplicando, setAplicando] = useState(false);

  const nombreArea = (id) => areas.find(a => a.id === id)?.nombre ?? (id || '—');
  const plan = useMemo(() => (filas ? planElegiblesTE({ filas, empleados, areas, puestos }) : null), [filas, empleados, areas, puestos]);
  const porArea = useMemo(() => (plan ? [...plan.porArea].map(([id, n]) => ({ id, n })).sort((a, b) => nombreArea(a.id).localeCompare(nombreArea(b.id), 'es')) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan]);
  const cambian = plan ? plan.cambios.filter(c => c.cambia) : [];

  const alElegir = async (ev) => {
    const f = ev.target.files?.[0];
    ev.target.value = '';
    if (!f) return;
    setError(''); setFilas(null); setArchivo(f.name);
    const noValido = motivoArchivoNoValido(f.size);
    if (noValido) { setError(noValido); return; }
    try {
      setFilas((await leerElegiblesArchivo(await f.arrayBuffer())).filas);
    } catch (err) { setError(err.message); }
  };

  const aplicar = async () => {
    if (!plan || cambian.length === 0) return;
    setAplicando(true);
    try {
      const ops = cambian.map(c => (b) => b.update(doc(db, 'empleados', c.id), c.datos));
      ops.push(opBitacora({
        accion: 'elegibles_te_cargados', entidad: 'empleados',
        despues: {
          archivo, elegibles: plan.conteo.elegibles, noElegibles: plan.conteo.noElegibles, sinArchivo: plan.conteo.sinArchivo,
          cambiaron: cambian.length, porArea: Object.fromEntries(plan.porArea),
          sinArchivoNominas: plan.noEnArchivo.slice(0, TOPE_BITACORA).map(e => e.nomina), noEnPadron: plan.noEnPadron.slice(0, TOPE_BITACORA).map(e => e.nomina),
          cambiosDeArea: cambian.filter(c => c.areaAntes !== c.areaDespues).slice(0, TOPE_BITACORA).map(c => ({ nomina: c.nomina, de: c.areaAntes, a: c.areaDespues })),
        },
      }, usuario));
      await ejecutarEnLotes(ops);
      toast.success(`Listo: ${cambian.length} empleados actualizados (${plan.conteo.elegibles} elegibles).`);
      onAplicado();
    } catch (err) {
      console.error('Elegibles TE:', err);
      toast.error(`No se pudo guardar: ${err.message}`, 9000);
    } finally { setAplicando(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title="Cargar elegibles de tiempo extra" maxWidth="max-w-3xl">
      <div className="space-y-5">
        <p className="text-sm text-[var(--text-secondary)]">
          Sube el archivo del padrón de elegibles (columnas <b className="font-medium">NOMINA</b>, <b className="font-medium">AREA TE</b> y <b className="font-medium">ELEGIBLE TE</b>).
          Primero se muestra lo que cambiaría; no se guarda nada hasta que pulses «Aplicar».
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={entrada} type="file" accept=".xlsx" className="sr-only" aria-label="Archivo de elegibles" onChange={alElegir} />
          <Boton icono={FileSpreadsheet} onClick={() => entrada.current?.click()}>{archivo ? 'Elegir otro archivo' : 'Elegir archivo (.xlsx)'}</Boton>
          {archivo && <span className="text-sm text-[var(--text-secondary)]">{archivo}</span>}
        </div>
        {error && <Aviso tono="error">{error}</Aviso>}

        {plan && (
          <div className="space-y-5">
            <section aria-label="Elegibles por área" className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--text-main)]">Quedarían {plan.conteo.elegibles} elegibles y {plan.conteo.noElegibles + plan.conteo.sinArchivo} no elegibles</h3>
              <Tabla etiqueta="Elegibles por área">
                <thead><tr><Th>Área</Th><Th derecha>Elegibles</Th></tr></thead>
                <tbody>
                  {porArea.map(a => <Fila key={a.id}><Td>{nombreArea(a.id)}</Td><Td derecha>{a.n}</Td></Fila>)}
                  <Fila><Td className="font-medium">No elegibles en el archivo</Td><Td derecha>{plan.conteo.noElegibles}</Td></Fila>
                  <Fila><Td className="font-medium">Del padrón y no vienen en el archivo (quedan no elegibles)</Td><Td derecha>{plan.conteo.sinArchivo}</Td></Fila>
                </tbody>
              </Tabla>
              <p className="text-xs text-[var(--text-muted)]">{cambian.length} empleados cambian; {plan.conteo.sinCambios} ya estaban así. No se desactiva a nadie.</p>
            </section>

            {plan.problemas.length > 0 && (
              <Aviso tono="aviso" titulo={`${plan.problemas.length} filas con problemas (no se aplican)`}>
                <ul className="mt-1 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs">
                  {plan.problemas.slice(0, 30).map((p, i) => <li key={i}>Fila {p.filaExcel ?? '—'} · nómina {p.nomina || '—'}: {p.mensaje}</li>)}
                </ul>
              </Aviso>
            )}
            {plan.noEnPadron.length > 0 && (
              <Aviso tono="aviso" titulo={`${plan.noEnPadron.length} nóminas del archivo no están en el padrón (se ignoran)`}>
                <p className="text-xs">{plan.noEnPadron.slice(0, 30).map(e => e.nomina).join(', ')}{plan.noEnPadron.length > 30 ? '…' : ''}</p>
              </Aviso>
            )}
            {plan.noEnArchivo.length > 0 && (
              <section aria-label="Del padrón y no vienen en el archivo" className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[var(--text-main)]">Del padrón y no vienen en el archivo ({plan.noEnArchivo.length})</h3>
                  <Boton tamano="sm" icono={Download} onClick={() => descargarLista(plan, nombreArea)}>Descargar lista</Boton>
                </div>
                <Tabla etiqueta="Empleados que no vienen en el archivo" alto="max-h-64">
                  <thead><tr><Th>Nómina</Th><Th>Nombre</Th><Th>Puesto</Th><Th>Área</Th><Th>Estado</Th></tr></thead>
                  <tbody>
                    {plan.noEnArchivo.map(e => (
                      <Fila key={e.nomina}>
                        <Td mono>{e.nomina}</Td><Td>{e.nombre}</Td><Td className="text-[var(--text-secondary)]">{e.puesto || '—'}</Td>
                        <Td className="text-[var(--text-secondary)]">{nombreArea(e.areaId)}</Td><Td>{e.activo ? 'Activo' : 'Inactivo'}</Td>
                      </Fila>
                    ))}
                  </tbody>
                </Tabla>
              </section>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-color)] pt-4 sm:flex-row sm:justify-end">
          <Boton onClick={onClose} disabled={aplicando}>Cancelar</Boton>
          <Boton variante="primario" disabled={!plan || cambian.length === 0} estado={aplicando ? 'cargando' : undefined} onClick={aplicar}>
            Aplicar{plan ? ` (${cambian.length} cambios)` : ''}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
