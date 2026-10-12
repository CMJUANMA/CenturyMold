/**
 * ModalImportacion.jsx — Importación de empleados o del directorio con vista previa
 * comparativa contra la base (nuevos, sin cambios, con cambios, reactivados, bajas).
 * Las bajas son siempre lógicas (activo: false); nunca se borran documentos.
 */
import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Upload, Loader2, CheckCircle2, AlertTriangle, X, Download, FileSpreadsheet,
  Info, ChevronDown, ChevronUp, Plus, Search, UserMinus, ShieldAlert,
} from 'lucide-react';
import {
  collection, doc, writeBatch, getDocs, serverTimestamp, deleteField,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { derivarPuestos } from '../../utils/puestos';
import {
  construirFormatoDirectorio, construirFormatoEmpleados, construirReporteImportacion,
  leerDirectorio, leerEmpleados,
} from '../../utils/formatosImportacion';
import {
  MODOS, UMBRAL_BAJAS, compararDirectorio, compararEmpleados, fechaCorta, motivoBaja,
} from '../../utils/comparacionImportacion';

// ── Esquema de columnas (vista de instrucciones en pantalla) ──────────────
const DIR_COLS_INFO = [
  { letra: 'A', nombre: 'RUTA',             obligatorio: true,  ejemplo: 'RUTA NORTE' },
  { letra: 'B', nombre: 'COMUNIDAD',        obligatorio: true,  ejemplo: 'COLONIA SAN PEDRO' },
  { letra: 'C', nombre: 'PUNTO DE REUNION', obligatorio: true,  ejemplo: 'PARQUE CENTRAL' },
  { letra: 'D', nombre: 'CLAVE',            obligatorio: true,  ejemplo: 'SN01' },
];
const EMP_COLS_INFO = [
  { letra: 'A', nombre: 'NOMINA',       obligatorio: true,  ejemplo: '12345' },
  { letra: 'B', nombre: 'NOMBRE',       obligatorio: true,  ejemplo: 'GARCIA LOPEZ JUAN' },
  { letra: 'C', nombre: 'PUESTO',       obligatorio: true,  ejemplo: 'OPERADOR DE PRODUCCION' },
  { letra: 'D', nombre: 'CLAVE PARADA', obligatorio: false, ejemplo: 'SN01' },
];

const btnPrimary = 'inline-flex items-center gap-1.5 rounded-md bg-[var(--cm-red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--cm-red-hover)] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
const btnSecondary = 'inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] active:scale-95 transition-all disabled:opacity-50 cursor-pointer';
const btnIcon = 'rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-secondary)] hover:text-[var(--text-main)] active:scale-95 transition-all cursor-pointer';

const LIMITE_FILAS = 200; // filas visibles por pestaña (el buscador filtra sobre todas)
const ARTICULO = { Ruta: 'Esta ruta', Comunidad: 'Esta comunidad', Punto: 'Este punto' };
const SUJETO = { Ruta: 'la ruta', Comunidad: 'la comunidad', Punto: 'el punto' };
const PLURAL = { Empleado: 'empleados', Ruta: 'rutas', Comunidad: 'comunidades', Punto: 'puntos' };

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// ── Utilidades del navegador ──────────────────────────────────────────────
async function descargarLibro(workbook, nombre) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const docsDe = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));

// ── Guardado ──────────────────────────────────────────────────────────────
/**
 * Aplica el plan en lotes de 500 (set con merge para altas/cambios; update para bajas).
 * Si un lote falla, el error indica cuántas operaciones ya se guardaron.
 */
async function aplicarPlan(plan, idsBaja, usuario) {
  const ops = [];
  const resumen = {
    creados: 0, actualizados: 0, sinCambios: 0, reactivados: 0, bajas: 0, mantenidos: 0,
    omitidos: plan.conteos.errores,
  };
  const CONTADOR = { crear: 'creados', actualizar: 'actualizados', reactivar: 'reactivados' };

  for (const it of plan.items) {
    if (it.accion === 'sinCambios') { resumen.sinCambios++; continue; }
    const data = { ...it.datos };
    if (it.accion === 'reactivar') {
      Object.assign(data, {
        activo: true, activa: deleteField(), fechaBaja: deleteField(), bajaPor: deleteField(), motivoBaja: deleteField(),
      });
    }
    ops.push(b => b.set(doc(db, it.coleccion, it.id), data, { merge: true }));
    resumen[CONTADOR[it.accion]]++;
  }

  const datosBaja = {
    activo: false,
    fechaBaja: serverTimestamp(),
    bajaPor: { uid: usuario?.uid ?? '', nombre: usuario?.nombre ?? '' },
    motivoBaja: motivoBaja(),
  };
  for (const b of plan.bajas) {
    if (!idsBaja.has(b.key)) { resumen.mantenidos++; continue; }
    ops.push(batch => batch.update(doc(db, b.coleccion, b.id), datosBaja));
    resumen.bajas++;
  }

  let guardadas = 0;
  try {
    for (let i = 0; i < ops.length; i += 500) {
      const batch = writeBatch(db);
      ops.slice(i, i + 500).forEach(op => op(batch));
      await batch.commit();
      guardadas = Math.min(i + 500, ops.length);
    }
  } catch (err) {
    err.message = guardadas
      ? `Se guardaron ${guardadas} de ${ops.length} cambios antes del error: ${err.message}. Puede volver a importar el mismo archivo para completar.`
      : err.message;
    throw err;
  }
  return resumen;
}

// ── Piezas de interfaz ────────────────────────────────────────────────────
function Aviso({ tono = 'info', icon: Icon = Info, children }) {
  const tonos = {
    info: 'border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)]',
    warning: 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]',
    error: 'border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-text)]',
    success: 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]',
  };
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${tonos[tono]}`}>
      <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" /><div className="space-y-1">{children}</div>
    </div>
  );
}

function Insignia({ children, tono = 'neutro', title }) {
  const tonos = {
    neutro: 'bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]',
    warning: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]',
    error: 'bg-[var(--status-error-bg)] text-[var(--status-error-text)] border-[var(--status-error-border)]',
    success: 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]',
  };
  return (
    <span title={title} className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase whitespace-nowrap ${tonos[tono]}`}>
      {children}
    </span>
  );
}

function FilaItem({ it, mostrarEntidad }) {
  return (
    <li className="px-3 py-2 text-xs hover:bg-[var(--bg-surface-secondary)]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {it.filaExcel && <span className="font-mono text-[10px] text-[var(--text-muted)]">Fila {it.filaExcel}</span>}
        {mostrarEntidad && <Insignia>{it.entidad}</Insignia>}
        <span className="font-mono font-bold text-[var(--text-main)]">{it.clave}</span>
        <span className="font-semibold text-[var(--text-main)]">{it.nombre}</span>
        {it.detalle && <span className="text-[var(--text-muted)]">· {it.detalle}</span>}
        {it.puestoNuevo && (
          <Insignia tono={it.puestoSimilar ? 'warning' : 'neutro'} title={it.puestoSimilar ? `Posible variante de ${it.puestoSimilar}` : undefined}>
            {it.puestoSimilar ? `Puesto nuevo · ~${it.puestoSimilar}` : 'Puesto nuevo'}
          </Insignia>
        )}
      </div>
      {it.cambios?.length > 0 && (
        <ul className="mt-1 space-y-0.5 pl-1">
          {it.cambios.map(c => (
            <li key={c.campo} className="text-[11px]">
              <span className="font-semibold text-[var(--text-secondary)]">{c.campo}:</span>{' '}
              <span className="text-[var(--text-muted)] line-through">{c.antes}</span>{' '}
              <span className="text-[var(--text-muted)]">-&gt;</span>{' '}
              <span className="font-semibold text-[var(--text-main)]">{c.despues}</span>
            </li>
          ))}
        </ul>
      )}
      {it.mensaje && <p className="mt-1 text-[11px] text-[var(--status-warning-text)]">{it.mensaje}</p>}
    </li>
  );
}

function FilaProblema({ f }) {
  return (
    <li className="px-3 py-2 text-xs hover:bg-[var(--bg-surface-secondary)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] text-[var(--text-muted)]">Fila {f.filaExcel}</span>
        <Insignia tono={f.estado === 'error' ? 'error' : 'warning'}>{f.estado === 'error' ? 'Error · se omite' : 'Advertencia'}</Insignia>
        <span className="text-[var(--text-main)]">{Object.values(f.datos).filter(Boolean).join(' · ') || '(fila sin datos)'}</span>
      </div>
      <p className={`mt-1 text-[11px] ${f.estado === 'error' ? 'text-[var(--status-error-text)]' : 'text-[var(--status-warning-text)]'}`}>{f.mensaje}</p>
    </li>
  );
}

/** Texto en el que busca el buscador de cada pestaña */
const textoBusqueda = (x) => [
  x.filaExcel, x.clave, x.nombre, x.detalle, x.entidad, x.mensaje,
  ...(x.cambios ?? []).flatMap(c => [c.campo, c.antes, c.despues]),
  ...Object.values(x.datos && !x.accion ? x.datos : {}),
].filter(v => v !== undefined && v !== null).join(' ').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '');

// ── Modal ─────────────────────────────────────────────────────────────────
export default function ModalImportacion({ tipo, onClose, onImportado }) {
  const { usuario } = useAuth();
  const esDir = tipo === 'directorio';
  const titulo = esDir ? 'Importar directorio de transporte' : 'Importar empleados';
  const descripcion = esDir
    ? 'Carga masiva de rutas, comunidades y puntos desde un .xlsx con formato fijo.'
    : 'Carga masiva del padron de empleados desde un .xlsx con formato fijo.';
  const colsInfo = esDir ? DIR_COLS_INFO : EMP_COLS_INFO;
  const nombreHoja = esDir ? 'Directorio' : 'Empleados';

  const fileRef = useRef(null);
  const [base, setBase] = useState(null); // { empleados, rutas, comunidades, puntos }
  const [errorBase, setErrorBase] = useState('');
  const [modo, setModo] = useState(MODOS.AGREGAR);
  const [paso, setPaso] = useState('inicio'); // inicio | previa | guardando | resultado
  const [parseando, setParseando] = useState(false);
  const [errorParse, setErrorParse] = useState('');
  const [filas, setFilas] = useState([]);
  const [expandirInstr, setExpandirInstr] = useState(false);
  const [pestana, setPestana] = useState('nuevos');
  const [busqueda, setBusqueda] = useState('');
  const [desmarcadas, setDesmarcadas] = useState(() => new Set()); // bajas que NO se aplicarán
  const [decisionBajas, setDecisionBajas] = useState(null); // null | 'baja' | 'mantener'
  const [textoConfirmar, setTextoConfirmar] = useState('');
  const [resultado, setResultado] = useState(null); // { resumen, idsBaja, fecha }

  // Estado actual de la base (para comparar, contar asignados y resolver paradas)
  useEffect(() => {
    let cancelado = false;
    Promise.all(['empleados', 'rutas', 'comunidades', 'puntosReunion'].map(c => getDocs(collection(db, c))))
      .then(([emp, rut, com, pts]) => {
        if (!cancelado) setBase({ empleados: docsDe(emp), rutas: docsDe(rut), comunidades: docsDe(com), puntos: docsDe(pts) });
      })
      .catch(err => { if (!cancelado) setErrorBase(`No se pudo leer la base para comparar: ${err.message}`); });
    return () => { cancelado = true; };
  }, []);

  const puestosExistentes = useMemo(() => derivarPuestos(base?.empleados ?? []), [base]);

  const plan = useMemo(() => {
    if (!base || filas.length === 0) return null;
    return esDir
      ? compararDirectorio(filas, base, { modo })
      : compararEmpleados(filas, base.empleados, { modo });
  }, [base, filas, modo, esDir]);

  const reiniciarDecision = () => { setDesmarcadas(new Set()); setDecisionBajas(null); setTextoConfirmar(''); };

  const cambiarModo = (m) => {
    setModo(m); reiniciarDecision();
    if (m === MODOS.AGREGAR && pestana === 'bajas') setPestana('nuevos');
  };

  const handleFile = async (file) => {
    if (!file || !base) return;
    setErrorParse(''); setParseando(true);
    try {
      const buffer = await file.arrayBuffer();
      const puntosMap = new Map(base.puntos.map(p => [p.id, { clave: p.id, ...p }]));
      const leidas = esDir ? leerDirectorio(buffer) : leerEmpleados(buffer, puntosMap, puestosExistentes);
      if (leidas.length === 0) {
        setFilas([]); setPaso('inicio');
        setErrorParse(`El archivo no tiene registros: capture los datos en la hoja "${nombreHoja}" a partir de la fila 2.`);
        return;
      }
      setFilas(leidas); setPaso('previa'); setBusqueda(''); reiniciarDecision();
      setPestana('nuevos');
    } catch (err) { setErrorParse(err.message); }
    finally { setParseando(false); }
  };

  // ── Bajas ──
  const bajas = plan?.bajas ?? [];
  const seleccionadas = bajas.filter(b => !desmarcadas.has(b.key));
  const requiereConfirmacion = decisionBajas === 'baja' && plan?.excedeUmbral && seleccionadas.length > 0;
  const confirmacionOk = !requiereConfirmacion || textoConfirmar.trim().toUpperCase() === 'CONFIRMAR';
  const bajasResueltas = bajas.length === 0 || decisionBajas === 'mantener' || (decisionBajas === 'baja' && confirmacionOk);
  const idsBaja = new Set(decisionBajas === 'baja' ? seleccionadas.map(b => b.key) : []);

  const toggleBaja = (key) => setDesmarcadas(prev => {
    const s = new Set(prev);
    if (s.has(key)) s.delete(key); else s.add(key);
    return s;
  });

  const handleConfirmar = async () => {
    setPaso('guardando'); setErrorParse('');
    try {
      const resumen = await aplicarPlan(plan, idsBaja, usuario);
      setResultado({ resumen, idsBaja, fecha: new Date() });
      setPaso('resultado');
      onImportado?.();
    } catch (err) {
      setErrorParse(`Error al guardar: ${err.message}`);
      setPaso('previa');
    }
  };

  const descargarReporte = () => {
    const { resumen, fecha } = resultado;
    const wb = construirReporteImportacion({
      tipo: esDir ? 'Directorio' : 'Empleados',
      modo: modo === MODOS.SINCRONIZAR ? 'Sincronizar con la lista completa' : 'Agregar y actualizar',
      fecha: `${fechaCorta(fecha)} ${fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`,
      usuario: usuario?.nombre ?? '',
      plan, resumen, idsBaja: resultado.idsBaja,
    });
    const iso = fecha.toISOString().slice(0, 10);
    descargarLibro(wb, `Reporte_Importacion_${esDir ? 'Directorio' : 'Empleados'}_${iso}.xlsx`);
  };

  // ── Pestañas ──
  const porAccion = (a) => (plan?.items ?? []).filter(i => i.accion === a);
  const pestanas = plan ? [
    { id: 'nuevos',      label: 'Nuevos',           lista: porAccion('crear') },
    { id: 'conCambios',  label: 'Con cambios',      lista: porAccion('actualizar') },
    { id: 'reactivados', label: 'Reactivados',      lista: porAccion('reactivar') },
    { id: 'sinCambios',  label: 'Sin cambios',      lista: porAccion('sinCambios') },
    ...(modo === MODOS.SINCRONIZAR ? [{ id: 'bajas', label: 'Ya no aparecen', lista: bajas, tono: 'error' }] : []),
    { id: 'problemas',   label: 'Errores y advertencias', lista: plan.problemas, tono: plan.conteos.errores ? 'error' : 'warning' },
  ] : [];
  const actual = pestanas.find(p => p.id === pestana) ?? pestanas[0];
  const q = busqueda.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const visibles = actual ? actual.lista.filter(x => !q || textoBusqueda(x).includes(q)) : [];

  const puestosNuevos = esDir || !plan ? [] : Object.entries(
    plan.items.filter(i => i.puestoNuevo)
      .reduce((acc, i) => { acc[i.detalle] = (acc[i.detalle] ?? 0) + 1; return acc; }, {})
  ).sort((a, b) => a[0].localeCompare(b[0], 'es'));

  const mensajeBajas = esDir
    ? `${plural(bajas.length, 'elemento activo del directorio no aparece', 'elementos activos del directorio no aparecen')} en el archivo` +
      ` (${['Ruta', 'Comunidad', 'Punto'].map(e => `${bajas.filter(b => b.entidad === e).length} ${PLURAL[e]}`).join(', ')}). ¿Es correcto que ya no estan vigentes?`
    : `${plural(bajas.length, 'empleado activo no aparece', 'empleados activos no aparecen')} en el archivo. ¿Es correcto que ya no estan en la nomina?`;

  const bloqueado = paso === 'guardando' || paso === 'resultado';
  const puedeConfirmar = paso === 'previa' && !!plan && bajasResueltas;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget && paso !== 'guardando') onClose(); }}>
      <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] rounded-xl bg-[var(--bg-surface)] shadow-2xl overflow-hidden text-[var(--text-main)]">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-color)] px-6 py-4 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--cm-red-light)] flex-shrink-0 mt-0.5">
              <FileSpreadsheet className="h-5 w-5 text-[var(--cm-red)]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-main)]">{titulo}</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 max-w-xl">{descripcion}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={paso === 'guardando'} className={btnIcon}><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {errorBase && <Aviso tono="error" icon={AlertTriangle}>{errorBase}</Aviso>}
          {!esDir && base && base.puntos.length === 0 && (
            <Aviso tono="warning" icon={AlertTriangle}>
              <strong>Directorio vacio.</strong> Se recomienda importar primero el directorio. Los empleados con CLAVE PARADA se importaran sin parada.
            </Aviso>
          )}

          {/* Modo de importación */}
          <fieldset disabled={bloqueado} className="space-y-2">
            <legend className="mb-2 text-xs font-semibold text-[var(--text-main)]">Modo de importacion</legend>
            {[
              { valor: MODOS.AGREGAR, label: 'Agregar y actualizar', ayuda: 'Crea los nuevos y actualiza los existentes. No da de baja a nadie.' },
              { valor: MODOS.SINCRONIZAR, label: 'Sincronizar con la lista completa', ayuda: `Ademas propone dar de baja a los ${esDir ? 'elementos' : 'empleados'} activos que no aparezcan en el archivo.` },
            ].map(op => (
              <label key={op.valor}
                className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs transition-colors ${modo === op.valor ? 'border-[var(--cm-red)] bg-[var(--cm-red-light)]' : 'border-[var(--border-color)] hover:bg-[var(--bg-surface-secondary)]'}`}>
                <input type="radio" name="modo-importacion" value={op.valor} checked={modo === op.valor}
                  onChange={() => cambiarModo(op.valor)} className="mt-0.5 accent-[var(--cm-red)]" />
                <span>
                  <span className="block font-semibold text-[var(--text-main)]">{op.label}</span>
                  <span className="block text-[var(--text-secondary)]">{op.ayuda}</span>
                </span>
              </label>
            ))}
            {modo === MODOS.SINCRONIZAR && (
              <Aviso tono="warning" icon={AlertTriangle}>
                Use esta opcion solo si el archivo contiene a TODOS los empleados (o todo el directorio) actuales.
              </Aviso>
            )}
          </fieldset>

          {/* Instrucciones y columnas (solo antes de cargar) */}
          {paso === 'inicio' && (
            <>
              <div className="rounded-lg border border-[var(--border-color)] overflow-hidden">
                <button type="button" onClick={() => setExpandirInstr(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-surface-secondary)] text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer">
                  <span className="flex items-center gap-2"><Info className="h-3.5 w-3.5 text-[var(--text-muted)]" />Instrucciones de uso</span>
                  {expandirInstr ? <ChevronUp className="h-3.5 w-3.5 text-[var(--text-muted)]" /> : <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
                </button>
                {expandirInstr && (
                  <div className="px-4 py-3 text-xs text-[var(--text-secondary)] border-t border-[var(--border-subtle)]">
                    <ol className="list-decimal list-inside space-y-1.5">
                      <li>Descargue el formato en blanco.</li>
                      <li>Llene la hoja <strong>{nombreHoja}</strong> a partir de la fila 2 sin modificar encabezados.</li>
                      <li>Guarde como <strong>.xlsx</strong>.</li>
                      <li>Elija el modo, seleccione el archivo y revise la comparacion antes de confirmar.</li>
                    </ol>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto rounded-lg border border-[var(--border-color)]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
                    <tr><th className="px-3 py-2 w-8">Col.</th><th className="px-3 py-2">Nombre</th><th className="px-3 py-2 w-24">Requerido</th><th className="px-3 py-2">Ejemplo</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {colsInfo.map(col => (
                      <tr key={col.letra}>
                        <td className="px-3 py-2 font-mono font-bold text-[var(--cm-red)]">{col.letra}</td>
                        <td className="px-3 py-2 font-semibold text-[var(--text-main)]">{col.nombre}</td>
                        <td className="px-3 py-2"><Insignia tono={col.obligatorio ? 'error' : 'neutro'}>{col.obligatorio ? 'Obligatoria' : 'Opcional'}</Insignia></td>
                        <td className="px-3 py-2 font-mono text-[var(--text-muted)]">{col.ejemplo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!esDir && (
                <Aviso>Si CLAVE PARADA viene vacia, se conserva la ruta, comunidad y punto que el empleado ya tenga.</Aviso>
              )}
            </>
          )}

          {errorParse && <Aviso tono="error" icon={AlertTriangle}>{errorParse}</Aviso>}

          {/* Vista previa comparativa */}
          {paso === 'previa' && plan && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {pestanas.map(p => (
                  <button key={p.id} type="button" onClick={() => { setPestana(p.id); setBusqueda(''); }}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${actual?.id === p.id ? 'border-[var(--cm-red)] bg-[var(--cm-red-light)]' : 'border-[var(--border-color)] hover:bg-[var(--bg-surface-secondary)]'}`}>
                    <span className={`block text-lg font-bold leading-tight ${p.lista.length && p.tono === 'error' ? 'text-[var(--status-error-text)]' : p.lista.length && p.tono === 'warning' ? 'text-[var(--status-warning-text)]' : 'text-[var(--text-main)]'}`}>
                      {p.lista.length}
                    </span>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{p.label}</span>
                  </button>
                ))}
              </div>

              {puestosNuevos.length > 0 && (
                <Aviso icon={Plus}>
                  <p className="font-semibold text-[var(--text-main)]">{plural(puestosNuevos.length, 'puesto nuevo se agregara', 'puestos nuevos se agregaran')} a la lista:</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {puestosNuevos.map(([puesto, n]) => (
                      <li key={puesto} className="rounded border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10px]">
                        <span className="font-semibold text-[var(--text-main)]">{puesto}</span>
                        <span className="text-[var(--text-muted)]"> · {plural(n, 'empleado', 'empleados')}</span>
                      </li>
                    ))}
                  </ul>
                </Aviso>
              )}

              {bajas.length > 0 && decisionBajas === null && actual?.id !== 'bajas' && (
                <Aviso tono="warning" icon={UserMinus}>
                  <p>{mensajeBajas}</p>
                  <button type="button" onClick={() => setPestana('bajas')} className="font-semibold underline cursor-pointer">Revisar y decidir</button>
                </Aviso>
              )}

              {/* Detalle de la pestaña */}
              <div className="rounded-lg border border-[var(--border-color)]">
                <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-3 py-2">
                  <span className="text-xs font-semibold text-[var(--text-main)]">{actual?.label}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {q ? `${visibles.length} de ${actual?.lista.length}` : actual?.lista.length}
                  </span>
                  <div className="relative ml-auto w-full sm:w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
                    <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                      placeholder={esDir ? 'Buscar clave, nombre, fila...' : 'Buscar nomina, nombre, puesto, fila...'}
                      className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] pl-8 pr-3 py-1.5 text-xs outline-none focus:border-[var(--cm-red)]" />
                  </div>
                </div>

                {actual?.id === 'bajas' && bajas.length > 0 && (
                  <div className="space-y-2 border-b border-[var(--border-color)] p-3">
                    <p className="text-xs font-semibold text-[var(--text-main)]">{mensajeBajas}</p>
                    {plan.excedeUmbral && (
                      <Aviso tono="error" icon={ShieldAlert}>
                        <p className="font-bold">Cantidad inusual de bajas.</p>
                        <p>
                          {plan.umbral.filter(u => u.fraccion > UMBRAL_BAJAS).map(u =>
                            `${u.bajas} de ${u.activos} ${PLURAL[u.entidad]} activos (${Math.round(u.fraccion * 100)} %)`).join('; ')}
                          {' '}no aparecen en el archivo; el limite de seguridad es {Math.round(UMBRAL_BAJAS * 100)} %.
                          Verifique que el archivo este completo antes de continuar.
                        </p>
                      </Aviso>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => setDecisionBajas('baja')} disabled={seleccionadas.length === 0}
                        className={decisionBajas === 'baja' ? btnPrimary : btnSecondary}>
                        <UserMinus className="h-3.5 w-3.5" />Dar de baja a los seleccionados ({seleccionadas.length})
                      </button>
                      <button type="button" onClick={() => { setDecisionBajas('mantener'); setTextoConfirmar(''); }}
                        className={decisionBajas === 'mantener' ? btnPrimary : btnSecondary}>
                        <CheckCircle2 className="h-3.5 w-3.5" />Dejarlos activos
                      </button>
                      <button type="button" className="ml-auto text-[11px] font-semibold text-[var(--text-secondary)] underline cursor-pointer"
                        onClick={() => setDesmarcadas(seleccionadas.length ? new Set(bajas.map(b => b.key)) : new Set())}>
                        {seleccionadas.length ? 'Desmarcar todos' : 'Marcar todos'}
                      </button>
                    </div>
                    {decisionBajas === 'baja' && (
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Baja logica: quedan inactivos con fecha, usuario y motivo &quot;{motivoBaja()}&quot;. No se borra nada
                        {!esDir && ' y las solicitudes pasadas conservan el nombre y puesto de sus pasajeros'}.
                      </p>
                    )}
                    {requiereConfirmacion && (
                      <label className="block text-xs">
                        <span className="font-semibold text-[var(--status-error-text)]">Escriba CONFIRMAR para dar de baja a {seleccionadas.length}:</span>
                        <input value={textoConfirmar} onChange={e => setTextoConfirmar(e.target.value)} autoComplete="off"
                          className="mt-1 block w-48 rounded-md border border-[var(--status-error-border)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-mono uppercase outline-none focus:border-[var(--status-error-text)]" />
                      </label>
                    )}
                  </div>
                )}

                <ul className="max-h-80 divide-y divide-[var(--border-subtle)] overflow-y-auto">
                  {visibles.length === 0 && (
                    <li className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">
                      {q ? 'Sin coincidencias.' : 'Nada en esta categoria.'}
                    </li>
                  )}
                  {visibles.slice(0, LIMITE_FILAS).map(x => {
                    if (actual.id === 'problemas') return <FilaProblema key={x.filaExcel} f={x} />;
                    if (actual.id !== 'bajas') return <FilaItem key={x.key} it={x} mostrarEntidad={esDir} />;
                    return (
                      <li key={x.key} className="px-3 py-2 text-xs hover:bg-[var(--bg-surface-secondary)]">
                        <label className="flex cursor-pointer items-start gap-2.5">
                          <input type="checkbox" checked={!desmarcadas.has(x.key)} onChange={() => toggleBaja(x.key)}
                            className="mt-0.5 accent-[var(--cm-red)]" />
                          <span className="space-y-0.5">
                            <span className="flex flex-wrap items-center gap-2">
                              {esDir && <Insignia>{x.entidad}</Insignia>}
                              <span className="font-mono font-bold text-[var(--text-main)]">{x.clave}</span>
                              <span className="font-semibold text-[var(--text-main)]">{x.nombre}</span>
                              {x.detalle && <span className="text-[var(--text-muted)]">· {x.detalle}</span>}
                            </span>
                            {esDir && x.asignados > 0 && (
                              <span className="block text-[11px] text-[var(--status-warning-text)]">
                                {ARTICULO[x.entidad]} tiene {plural(x.asignados, 'empleado asignado', 'empleados asignados')}; si la desactiva,
                                esos empleados conservaran el dato pero {SUJETO[x.entidad]} no aparecera en nuevas solicitudes.
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                  {visibles.length > LIMITE_FILAS && (
                    <li className="px-3 py-2 text-center text-[11px] text-[var(--text-muted)]">
                      Mostrando {LIMITE_FILAS} de {visibles.length}. Use el buscador para encontrar un registro.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {paso === 'guardando' && (
            <div className="flex flex-col items-center justify-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--cm-red)]" />
              <p className="text-sm text-[var(--text-secondary)]">Guardando en la base de datos...</p>
            </div>
          )}

          {paso === 'resultado' && resultado && (
            <div className="space-y-4">
              <Aviso tono="success" icon={CheckCircle2}>
                <p className="text-sm font-bold">Importacion completada</p>
                <p>{modo === MODOS.SINCRONIZAR ? 'Modo: Sincronizar con la lista completa.' : 'Modo: Agregar y actualizar.'}</p>
              </Aviso>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  ['Creados', resultado.resumen.creados],
                  ['Actualizados', resultado.resumen.actualizados],
                  ['Sin cambios', resultado.resumen.sinCambios],
                  ['Reactivados', resultado.resumen.reactivados],
                  ['Dados de baja', resultado.resumen.bajas],
                  ['Omitidos por error', resultado.resumen.omitidos],
                ].map(([label, n]) => (
                  <div key={label} className="rounded-lg border border-[var(--border-color)] px-3 py-2">
                    <span className="block text-lg font-bold text-[var(--text-main)]">{n}</span>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{label}</span>
                  </div>
                ))}
              </div>
              {resultado.resumen.mantenidos > 0 && (
                <Aviso>{plural(resultado.resumen.mantenidos, 'registro no aparece', 'registros no aparecen')} en el archivo y se dejaron activos.</Aviso>
              )}
              <button type="button" onClick={descargarReporte} className={btnSecondary}>
                <Download className="h-4 w-4" />Descargar reporte (.xlsx)
              </button>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-color)] px-6 py-4 flex-shrink-0 bg-[var(--bg-surface-secondary)]">
          <div className="flex flex-wrap gap-2">
            <button type="button"
              onClick={() => descargarLibro(esDir ? construirFormatoDirectorio() : construirFormatoEmpleados(puestosExistentes), esDir ? 'Formato_Directorio.xlsx' : 'Formato_Empleados.xlsx')}
              className={btnSecondary}>
              <Download className="h-3.5 w-3.5 text-[var(--text-secondary)]" />Descargar formato en blanco
            </button>
            {!bloqueado && (
              <>
                <input ref={fileRef} type="file" accept=".xlsx" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={parseando || !base}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--cm-red)] bg-[var(--cm-red-light)] px-3 py-2 text-xs font-semibold text-[var(--cm-red)] hover:bg-[var(--cm-red)] hover:text-white active:scale-95 transition-all disabled:opacity-50 cursor-pointer">
                  {parseando || !base ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {!base ? 'Leyendo base...' : parseando ? 'Leyendo...' : paso === 'previa' ? 'Elegir otro archivo' : 'Seleccionar archivo (.xlsx)'}
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {paso === 'previa' && plan && !bajasResueltas && (
              <span className="text-[11px] text-[var(--status-warning-text)]">
                {decisionBajas === 'baja' ? 'Escriba CONFIRMAR para continuar.' : 'Decida que hacer con los que ya no aparecen.'}
              </span>
            )}
            {paso === 'previa' && plan && (
              <button type="button" onClick={handleConfirmar} disabled={!puedeConfirmar} className={btnPrimary}>
                <CheckCircle2 className="h-3.5 w-3.5" />Confirmar importacion
              </button>
            )}
            <button type="button" onClick={onClose} disabled={paso === 'guardando'} className={btnSecondary}>
              {paso === 'resultado' ? 'Cerrar' : 'Cancelar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
