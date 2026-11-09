/**
 * ModalElegiblesTE.jsx — «Cargar elegibles TE»: carga el archivo del padrón de elegibles (NOMINA, NOMBRE, PUESTO, DEPTO NOMINA, AREA TE, ELEGIBLE TE).
 * Primero SIMULA: cuántos quedan elegibles por área, quiénes se DARÁN DE ALTA (las nóminas del archivo que no están en el padrón; con puesto y área
 * editables), quiénes del padrón no vienen en el archivo (casilla «Dar de baja», desmarcada: solo los marcados se desactivan; el resto queda no
 * elegible) y los problemas del archivo. Solo escribe al pulsar «Aplicar», en lotes con progreso y con UN renglón de resumen en la bitácora.
 * Lógica en utils/elegibles.js.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, getDocs, serverTimestamp } from 'firebase/firestore';
import { Download, FileSpreadsheet } from 'lucide-react';
import { db } from '../../firebase';
import Modal from '../../components/Modal';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import { Selector } from '../../components/ui/Campo';
import Insignia from '../../components/ui/Insignia';
import { Fila, Tabla, Td, Th } from '../../components/ui/Tabla';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { ejecutarEnLotes, opBitacora } from '../../utils/estructuraDb';
import { CREAR_PUESTO, construirAltas, eleccionInicial, planElegiblesTE } from '../../utils/elegibles';
import { agregarHojaReporte, leerElegiblesArchivo, nuevoLibro } from '../../utils/formatosImportacion';
import { bufferSeguro, motivoArchivoNoValido } from '../../utils/excelSeguro';
import { ultimaSemanaCompleta } from '../../utils/formatoNomina';
import { ymd } from '../../utils/fechas';

const TOPE_BITACORA = 500;

async function descargarLista(plan, nombreArea) {
  const wb = nuevoLibro();
  agregarHojaReporte(wb, 'No vienen en el archivo', ['Nómina', 'Nombre', 'Puesto', 'Área', 'Activo'],
    plan.noEnArchivo.map(e => [e.nomina, e.nombre, e.puesto, nombreArea(e.areaId), e.activo ? 'Sí' : 'No']));
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
  const [avance, setAvance] = useState(null);
  const [elecciones, setElecciones] = useState({}); // nómina → { areaId, puestoSel } (lo que RH cambió; lo demás sale de eleccionInicial)
  const [bajas, setBajas] = useState(() => new Set());
  const [semana, setSemana] = useState(() => String(ultimaSemanaCompleta(ymd(new Date())).semana));
  const [conUsuario, setConUsuario] = useState(() => new Set()); // nóminas que ya tienen usuario

  useEffect(() => {
    let vigente = true;
    getDocs(collection(db, 'usuarios'))
      .then(s => { if (vigente) setConUsuario(new Set(s.docs.map(d => String(d.data().nomina)))); })
      .catch(err => console.error('Usuarios:', err));
    return () => { vigente = false; };
  }, []);

  const areasOrdenadas = useMemo(() => [...areas].filter(a => a.activa !== false).sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99)), [areas]);
  const puestosOrdenados = useMemo(() => [...puestos].filter(p => p.activo !== false && p.nombre).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [puestos]);
  const nombreArea = (id) => areas.find(a => a.id === id)?.nombre ?? (id || '—');
  const plan = useMemo(() => (filas ? planElegiblesTE({ filas, empleados, areas, puestos }) : null), [filas, empleados, areas, puestos]);
  const porArea = useMemo(() => (plan ? [...plan.porArea].map(([id, n]) => ({ id, n })).sort((a, b) => nombreArea(a.id).localeCompare(nombreArea(b.id), 'es')) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan]);
  const eleccionDe = (n) => ({ ...eleccionInicial(n), ...elecciones[n.nomina] });
  const cambiarEleccion = (nomina, cambio) => setElecciones(prev => ({ ...prev, [nomina]: { ...eleccionInicial(plan.noEnPadron.find(n => n.nomina === nomina)), ...prev[nomina], ...cambio } }));

  const altas = useMemo(() => (plan ? construirAltas({ nuevos: plan.noEnPadron, elecciones, puestos, areas }) : null), [plan, elecciones, puestos, areas]);
  const cambian = plan ? plan.cambios.filter(c => c.cambia && !bajas.has(c.id)) : [];
  const bajables = plan ? plan.noEnArchivo.filter(e => e.activo) : [];
  const alternarBaja = (id) => setBajas(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  const total = plan ? cambian.length + bajas.size + (altas?.altas.length ?? 0) : 0;

  const alElegir = async (ev) => {
    const f = ev.target.files?.[0];
    ev.target.value = '';
    if (!f) return;
    setError(''); setFilas(null); setArchivo(f.name); setElecciones({}); setBajas(new Set());
    const noValido = motivoArchivoNoValido(f.size);
    if (noValido) { setError(noValido); return; }
    try {
      setFilas((await leerElegiblesArchivo(await f.arrayBuffer())).filas);
    } catch (err) { setError(err.message); }
  };

  const aplicar = async () => {
    if (!plan || total === 0 || altas.errores.length > 0) return;
    const motivoBaja = `No viene en la nómina semana ${semana.trim() || '?'}`;
    setAplicando(true); setAvance({ hechas: 0, total: 0 });
    try {
      const ops = [];
      for (const p of altas.puestosNuevos) {
        ops.push(b => b.set(doc(db, 'puestos', p.id), { nombre: p.nombre, areaId: p.areaId, activo: true, alias: [], creadoPor: usuario?.uid ?? '', fechaCreacion: serverTimestamp() }));
      }
      for (const a of altas.altas) ops.push(b => b.set(doc(db, 'empleados', a.id), a.datos));
      for (const c of cambian) ops.push(b => b.update(doc(db, 'empleados', c.id), c.datos));
      for (const id of bajas) {
        ops.push(b => b.update(doc(db, 'empleados', id), {
          elegibleTE: false, activo: false, fechaBaja: serverTimestamp(), bajaPor: { uid: usuario?.uid ?? '', nombre: usuario?.nombre ?? '' }, motivoBaja,
        }));
      }
      ops.push(opBitacora({
        accion: 'elegibles_te_cargados', entidad: 'empleados',
        despues: {
          archivo, actualizados: cambian.length, altas: altas.altas.length, bajas: bajas.size, elegibles: plan.conteo.elegibles, noElegibles: plan.conteo.noElegibles,
          sinArchivo: plan.conteo.sinArchivo, porArea: Object.fromEntries(plan.porArea), puestosCreados: altas.puestosNuevos.map(p => p.nombre),
          nominasAlta: altas.altas.slice(0, TOPE_BITACORA).map(a => a.id), nominasBaja: [...bajas].slice(0, TOPE_BITACORA), motivoBaja: bajas.size ? motivoBaja : '',
          cambiosDeArea: cambian.filter(c => c.areaAntes !== c.areaDespues).slice(0, TOPE_BITACORA).map(c => ({ nomina: c.nomina, de: c.areaAntes, a: c.areaDespues })),
        },
      }, usuario));
      await ejecutarEnLotes(ops, (hechas, tot) => setAvance({ hechas, total: tot }));
      toast.success(`Listo: ${cambian.length} actualizados, ${altas.altas.length} dados de alta, ${bajas.size} dados de baja.`);
      onAplicado();
    } catch (err) {
      console.error('Elegibles TE:', err);
      toast.error(`No se pudo guardar: ${err.message}`, 9000);
    } finally { setAplicando(false); setAvance(null); }
  };

  return (
    <Modal isOpen onClose={() => !aplicando && onClose()} title="Cargar elegibles de tiempo extra" maxWidth="max-w-5xl" preventCloseOnBackdrop={aplicando}>
      <div className="space-y-5">
        <p className="text-sm text-[var(--text-secondary)]">
          Sube el archivo del padrón de elegibles (columnas <b className="font-medium">NOMINA</b>, <b className="font-medium">NOMBRE</b>, <b className="font-medium">PUESTO</b>,{' '}
          <b className="font-medium">DEPTO NOMINA</b>, <b className="font-medium">AREA TE</b> y <b className="font-medium">ELEGIBLE TE</b>). Primero se muestra lo que cambiaría; no se guarda nada hasta que pulses «Aplicar».
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={entrada} type="file" accept=".xlsx" className="sr-only" aria-label="Archivo de elegibles" onChange={alElegir} />
          <Boton icono={FileSpreadsheet} onClick={() => entrada.current?.click()} disabled={aplicando}>{archivo ? 'Elegir otro archivo' : 'Elegir archivo (.xlsx)'}</Boton>
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
              <p className="text-xs text-[var(--text-muted)]">
                Los conteos incluyen a los {plan.noEnPadron.length} que se darán de alta. {cambian.length} empleados del padrón cambian; {plan.conteo.sinCambios} ya estaban así.
              </p>
            </section>

            {plan.problemas.length > 0 && (
              <Aviso tono="aviso" titulo={`${plan.problemas.length} filas con problemas (no se aplican)`}>
                <ul className="mt-1 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs">
                  {plan.problemas.slice(0, 30).map((p, i) => <li key={i}>Fila {p.filaExcel ?? '—'} · nómina {p.nomina || '—'}: {p.mensaje}</li>)}
                </ul>
              </Aviso>
            )}

            {plan.noEnPadron.length > 0 && (
              <section aria-label="Nuevos en el padrón" className="space-y-2">
                <h3 className="text-sm font-semibold text-[var(--text-main)]">Nuevos en el padrón (se darán de alta) ({plan.noEnPadron.length})</h3>
                <Tabla etiqueta="Nuevos en el padrón" alto="max-h-80">
                  <thead><tr><Th>Nómina</Th><Th>Nombre</Th><Th>Puesto</Th><Th>Área</Th><Th>Elegible</Th></tr></thead>
                  <tbody>
                    {plan.noEnPadron.map(n => {
                      const el = eleccionDe(n);
                      const nivel = n.puestoRes?.nivel;
                      return (
                        <Fila key={n.nomina}>
                          <Td mono>{n.nomina}</Td>
                          <Td>
                            {n.nombre}
                            {conUsuario.has(n.nomina) && <p className="mt-1 text-xs text-[var(--status-info-text)]">Ya tiene usuario: se vincula por nómina; no se tocan sus asignaciones.</p>}
                            {altas.errores.filter(e => e.nomina === n.nomina).map((e, i) => <p key={i} className="mt-1 text-xs text-[var(--status-error-text)]">{e.mensaje}</p>)}
                          </Td>
                          <Td>
                            <Selector aria-label={`Puesto de ${n.nombre}`} value={el.puestoSel} onChange={e => cambiarEleccion(n.nomina, { puestoSel: e.target.value })}>
                              <option value="">Elige el puesto…</option>
                              {n.puestoTexto && <option value={CREAR_PUESTO}>Crear puesto «{n.puestoTexto.toUpperCase()}» en esa área</option>}
                              {puestosOrdenados.map(p => <option key={p.id} value={p.id}>{p.nombre} · {nombreArea(p.areaId)}</option>)}
                            </Selector>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                              {n.puestoTexto ? `Archivo: ${n.puestoTexto}` : 'El archivo no trae puesto'}{' '}
                              {nivel === 'b' && <Insignia tono="aviso">Corregido: parece «{n.puestoRes.puesto.nombre}»</Insignia>}
                              {(nivel === 'c' || nivel === 'vacio') && <Insignia tono="aviso">No existe en el catálogo</Insignia>}
                            </p>
                          </Td>
                          <Td>
                            <Selector aria-label={`Área de ${n.nombre}`} value={el.areaId} disabled={n.areaFija} onChange={e => cambiarEleccion(n.nomina, { areaId: e.target.value })}>
                              <option value="">Elige el área…</option>
                              {areasOrdenadas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                            </Selector>
                            {!n.areaFija && <p className="mt-1 text-xs text-[var(--text-muted)]">{n.areaTE ? 'Del archivo' : n.depto ? `Propuesta por el departamento «${n.depto}»` : 'Sin departamento: elígela'}</p>}
                          </Td>
                          <Td>{n.elegible ? <Insignia tono="exito">SI</Insignia> : <Insignia>NO</Insignia>}</Td>
                        </Fila>
                      );
                    })}
                  </tbody>
                </Tabla>
                {altas.puestosNuevos.length > 0 && <p className="text-xs text-[var(--text-muted)]">Se crearán {altas.puestosNuevos.length} puestos: {altas.puestosNuevos.map(p => `${p.nombre} (${nombreArea(p.areaId)})`).join(', ')}.</p>}
              </section>
            )}

            {plan.noEnArchivo.length > 0 && (
              <section aria-label="Del padrón y no vienen en el archivo" className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[var(--text-main)]">Del padrón y no vienen en el archivo ({plan.noEnArchivo.length})</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <Boton tamano="sm" onClick={() => setBajas(bajas.size === bajables.length ? new Set() : new Set(bajables.map(e => e.id)))}>
                      {bajas.size === bajables.length && bajables.length > 0 ? 'Desmarcar todos' : 'Marcar todos'}
                    </Boton>
                    <Boton tamano="sm" icono={Download} onClick={() => descargarLista(plan, nombreArea)}>Descargar lista</Boton>
                  </div>
                </div>
                <label className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                  Los marcados se desactivan con el motivo «No viene en la nómina semana
                  <input value={semana} onChange={e => setSemana(e.target.value)} aria-label="Semana de la nómina" className="w-14 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1 text-center" />».
                  Los no marcados solo quedan como no elegibles.
                </label>
                <Tabla etiqueta="Empleados que no vienen en el archivo" alto="max-h-72">
                  <thead><tr><Th>Dar de baja</Th><Th>Nómina</Th><Th>Nombre</Th><Th>Puesto</Th><Th>Área</Th><Th>Estado</Th></tr></thead>
                  <tbody>
                    {plan.noEnArchivo.map(e => (
                      <Fila key={e.nomina}>
                        <Td><input type="checkbox" aria-label={`Dar de baja a ${e.nombre}`} checked={bajas.has(e.id)} disabled={!e.activo} onChange={() => alternarBaja(e.id)} className="h-4 w-4 accent-[var(--accent)]" /></Td>
                        <Td mono>{e.nomina}</Td><Td>{e.nombre}</Td><Td className="text-[var(--text-secondary)]">{e.puesto || '—'}</Td>
                        <Td className="text-[var(--text-secondary)]">{nombreArea(e.areaId)}</Td><Td>{e.activo ? 'Activo' : 'Ya inactivo'}</Td>
                      </Fila>
                    ))}
                  </tbody>
                </Tabla>
              </section>
            )}
          </div>
        )}

        {aplicando && avance && (
          <div role="status" className="space-y-1">
            <p className="text-sm text-[var(--text-main)]">Guardando… {avance.total ? `${avance.hechas} de ${avance.total} operaciones` : ''}</p>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-surface-secondary)]"><div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${avance.total ? (avance.hechas / avance.total) * 100 : 0}%` }} /></div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-color)] pt-4 sm:flex-row sm:justify-end">
          <Boton onClick={onClose} disabled={aplicando}>Cancelar</Boton>
          <Boton variante="primario" disabled={!plan || total === 0 || altas?.errores.length > 0} estado={aplicando ? 'cargando' : undefined} onClick={aplicar}>
            Aplicar{plan ? ` (${cambian.length} cambios, ${altas.altas.length} altas, ${bajas.size} bajas)` : ''}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
