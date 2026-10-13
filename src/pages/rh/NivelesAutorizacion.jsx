/**
 * NivelesAutorizacion.jsx — Tiempo extra: matriz de niveles de autorización y reglas de área.
 * Acceso: rh y admin.
 *
 * Pestaña "Niveles": igual a la hoja de Excel de RH. Columnas = áreas; "Autorización 2" y "Por ausencia"
 * ocupan todo el ancho; "Autorización 1" y "Solicitantes" tienen una celda por área. Todo por NÓMINA
 * (no por puesto, que cambia). Se guarda en areasTE/{areaId} y config/tiempoExtra.
 * Pestaña "Reglas de área": departamento + puesto → área de TE de cada empleado (config/areasTE).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import {
  AlertTriangle, ArrowDown, ArrowUp, Loader2, Plus, RotateCcw, Save, Trash2, UserPlus, X, Wand2,
} from 'lucide-react';
import { db } from '../../firebase';
import { useToast } from '../../hooks/useToast';
import { useConfirmar } from '../../hooks/useConfirmar';
import BuscadorEmpleado from '../../components/BuscadorEmpleado';
import { invalidarMatrizTE } from '../../utils/matrizTE';
import { slugify } from '../../utils/comparacionImportacion';
import { normalizarPuesto } from '../../utils/puestos';
import {
  AREAS_TE_INICIALES, MATRIZ_TE_INICIAL, REGLAS_AREA_TE_INICIALES, calcularAreaTE,
} from '../../utils/areasTE';

const btnPrimary = 'inline-flex items-center gap-1.5 rounded-md bg-[var(--cm-red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--cm-red-hover)] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
const btnSecondary = 'inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] active:scale-95 transition-all disabled:opacity-50 cursor-pointer';
const btnIcon = 'rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-secondary)] hover:text-[var(--text-main)] active:scale-95 transition-all disabled:opacity-30 cursor-pointer';
const inputCls = 'w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--cm-red)]';

const CONFIG_VACIA = { autorizador2Nomina: '', suplente2Nomina: '' };
const areaNueva = (id, nombre) => ({ id, nombre, activa: true, autorizador1Nomina: '', suplente1Nomina: '', solicitantesNominas: [] });

// ── Una persona en una celda ──────────────────────────────────────────────
function Persona({ nomina, empleados, usuarios, onQuitar, onCrearUsuario }) {
  const emp = empleados.get(String(nomina));
  const usuario = usuarios.get(String(nomina));
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-2 py-1.5">
      <div className="min-w-0 text-xs">
        <p className="truncate font-semibold text-[var(--text-main)]">{emp?.nombre ?? 'No esta en el padron'}</p>
        <p className="font-mono text-[10px] text-[var(--text-muted)]">{nomina}</p>
        {!usuario ? (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--status-warning-text)]">Sin usuario</span>
            <button type="button" onClick={() => onCrearUsuario(nomina, emp?.nombre ?? '')}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--cm-red)] hover:underline cursor-pointer">
              <UserPlus className="h-3 w-3" />Crear usuario
            </button>
          </div>
        ) : usuario.activo === false && (
          <span className="mt-1 inline-block rounded border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--status-error-text)]">Usuario inactivo</span>
        )}
      </div>
      <button type="button" onClick={onQuitar} className={btnIcon} title="Quitar"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}

/** Celda de una sola persona (o el buscador si está vacía) */
function CeldaUna({ valor, onChange, ...resto }) {
  return valor
    ? <Persona nomina={valor} onQuitar={() => onChange('')} {...resto} />
    : <BuscadorEmpleado empleados={resto.listaEmpleados} onSelect={e => onChange(String(e.nomina))} />;
}

/** Celda de varias personas */
function CeldaVarias({ valores, onChange, ...resto }) {
  return (
    <div className="space-y-1.5">
      {valores.map(n => (
        <Persona key={n} nomina={n} onQuitar={() => onChange(valores.filter(x => x !== n))} {...resto} />
      ))}
      <BuscadorEmpleado empleados={resto.listaEmpleados} excluir={valores} placeholder="Agregar solicitante..."
        onSelect={e => onChange([...valores, String(e.nomina)])} />
    </div>
  );
}

export default function NivelesAutorizacion() {
  const toast = useToast();
  const confirmar = useConfirmar();
  const navigate = useNavigate();

  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [pestana, setPestana] = useState('niveles');
  const [listaEmpleados, setListaEmpleados] = useState([]);
  const [usuarios, setUsuarios] = useState(new Map());
  const [areas, setAreas] = useState([]);
  const [config, setConfig] = useState(CONFIG_VACIA);
  const [reglas, setReglas] = useState(REGLAS_AREA_TE_INICIALES);
  const [sucioNiveles, setSucioNiveles] = useState(false);
  const [sucioReglas, setSucioReglas] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [nombreNueva, setNombreNueva] = useState('');
  const [prueba, setPrueba] = useState({ depto: '', puesto: '' });

  const empleados = useMemo(() => new Map(listaEmpleados.map(e => [String(e.nomina), e])), [listaEmpleados]);

  useEffect(() => {
    let vigente = true;
    (async () => {
    try {
      const [emp, usr, are, cfg, reg] = await Promise.all([
        getDocs(collection(db, 'empleados')),
        getDocs(collection(db, 'usuarios')),
        getDocs(collection(db, 'areasTE')),
        getDoc(doc(db, 'config', 'tiempoExtra')),
        getDoc(doc(db, 'config', 'areasTE')),
      ]);
      if (!vigente) return;
      setListaEmpleados(emp.docs.map(d => ({ nomina: d.id, ...d.data() })));
      setUsuarios(new Map(usr.docs.map(d => [String(d.data().nomina), { uid: d.id, ...d.data() }])));
      setAreas(are.docs.map(d => ({
        id: d.id, nombre: d.data().nombre ?? d.id, activa: d.data().activa !== false,
        autorizador1Nomina: d.data().autorizador1Nomina ?? '', suplente1Nomina: d.data().suplente1Nomina ?? '',
        solicitantesNominas: d.data().solicitantesNominas ?? [],
      })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
      setConfig(cfg.exists() ? { ...CONFIG_VACIA, ...cfg.data() } : CONFIG_VACIA);
      setReglas(reg.exists() && Array.isArray(reg.data().reglas) ? reg.data().reglas : REGLAS_AREA_TE_INICIALES);
      setSucioNiveles(false); setSucioReglas(false); setErrorCarga('');
    } catch (err) {
      setErrorCarga('No se pudo cargar la informacion: ' + err.message);
    } finally {
      setCargando(false);
    }
    })();
    return () => { vigente = false; };
  }, [recarga]);


  // ── Edición de la matriz ──
  const cambiarArea = (id, cambios) => { setAreas(a => a.map(x => x.id === id ? { ...x, ...cambios } : x)); setSucioNiveles(true); };
  const cambiarConfig = (cambios) => { setConfig(c => ({ ...c, ...cambios })); setSucioNiveles(true); };

  const agregarArea = () => {
    const nombre = nombreNueva.trim().replace(/\s+/g, ' ');
    const id = slugify(nombre);
    if (!id) return;
    if (areas.some(a => a.id === id)) { toast.error('Ya existe un area con ese nombre.'); return; }
    setAreas(a => [...a, areaNueva(id, nombre)]);
    setNombreNueva(''); setSucioNiveles(true);
  };

  const cargarInicial = async () => {
    if (!await confirmar({
      titulo: 'Cargar configuracion inicial',
      mensaje: 'Se llenara la matriz con la configuracion de prueba (areas, Aut. 1, solicitantes, Aut. 2 y por ausencia). No se guarda hasta que presiones Guardar.',
      textoConfirmar: 'Cargar',
    })) return;
    const porId = new Map(areas.map(a => [a.id, a]));
    setAreas(AREAS_TE_INICIALES.map(({ id, nombre }) => ({
      ...areaNueva(id, nombre), ...(porId.get(id) ?? {}),
      autorizador1Nomina: MATRIZ_TE_INICIAL.areas[id].autorizador1Nomina,
      suplente1Nomina: '',
      solicitantesNominas: [...MATRIZ_TE_INICIAL.areas[id].solicitantesNominas],
      activa: true,
    })));
    setConfig({ autorizador2Nomina: MATRIZ_TE_INICIAL.autorizador2Nomina, suplente2Nomina: MATRIZ_TE_INICIAL.suplente2Nomina });
    setSucioNiveles(true);
  };

  const crearUsuario = async (nomina, nombre) => {
    if ((sucioNiveles || sucioReglas) && !await confirmar({
      titulo: 'Cambios sin guardar',
      mensaje: 'Tienes cambios sin guardar en esta pantalla; si sales de aqui se perderan. ¿Continuar?',
      textoConfirmar: 'Continuar',
    })) return;
    navigate('/rutas/rh/usuarios', { state: { nuevo: { nomina: String(nomina), nombre } } });
  };

  const guardarNiveles = async () => {
    setGuardando(true);
    try {
      const batch = writeBatch(db);
      for (const a of areas) {
        const data = {
          nombre: a.nombre, activa: a.activa !== false,
          autorizador1Nomina: a.autorizador1Nomina, solicitantesNominas: a.solicitantesNominas,
        };
        if (a.suplente1Nomina) data.suplente1Nomina = a.suplente1Nomina;
        batch.set(doc(db, 'areasTE', a.id), data);
      }
      batch.set(doc(db, 'config', 'tiempoExtra'), {
        autorizador2Nomina: config.autorizador2Nomina, suplente2Nomina: config.suplente2Nomina,
      });
      await batch.commit();
      invalidarMatrizTE();
      setSucioNiveles(false);
      toast.success('Niveles de autorizacion guardados.');
    } catch (err) {
      toast.error('No se pudo guardar: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  // ── Reglas de área ──
  const cambiarRegla = (i, cambios) => { setReglas(r => r.map((x, j) => j === i ? { ...x, ...cambios } : x)); setSucioReglas(true); };
  const moverRegla = (i, d) => {
    setReglas(r => {
      const j = i + d;
      if (j < 0 || j >= r.length) return r;
      const copia = [...r];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });
    setSucioReglas(true);
  };
  const guardarReglas = async () => {
    const limpias = reglas.filter(r => String(r.depto).trim()).map(r => {
      const puestos = (r.puestos ?? []).map(normalizarPuesto).filter(Boolean);
      return { depto: String(r.depto).trim(), ...(puestos.length ? { puestos } : {}), area: r.area ?? '' };
    });
    setGuardando(true);
    try {
      await setDoc(doc(db, 'config', 'areasTE'), { reglas: limpias });
      setReglas(limpias); setSucioReglas(false);
      toast.success('Reglas de area guardadas. Se aplican en la proxima importacion de nomina.');
    } catch (err) {
      toast.error('No se pudo guardar: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const resultadoPrueba = prueba.depto.trim() ? calcularAreaTE(prueba.depto, prueba.puesto, reglas) : null;
  const nombreArea = (id) => areas.find(a => a.id === id)?.nombre ?? id;
  const comunes = { empleados, usuarios, listaEmpleados, onCrearUsuario: crearUsuario };
  const n = Math.max(areas.length, 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-[var(--border-color)] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Tiempo extra · Recursos Humanos</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">Niveles de autorizacion</h1>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Quien solicita y quien autoriza el tiempo extra de cada area, por numero de nomina.</p>
        </div>
        <div className="flex gap-2">
          {pestana === 'niveles' ? (
            <>
              <button type="button" onClick={cargarInicial} className={btnSecondary}><Wand2 className="h-3.5 w-3.5" />Cargar configuracion inicial</button>
              <button type="button" onClick={() => setRecarga(n => n + 1)} disabled={!sucioNiveles || guardando} className={btnSecondary}><RotateCcw className="h-3.5 w-3.5" />Descartar</button>
              <button type="button" onClick={guardarNiveles} disabled={!sucioNiveles || guardando} className={btnPrimary}>
                {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Guardar
              </button>
            </>
          ) : (
            <button type="button" onClick={guardarReglas} disabled={!sucioReglas || guardando} className={btnPrimary}>
              {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Guardar reglas
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-[var(--border-color)]">
        {[['niveles', 'Niveles', sucioNiveles], ['reglas', 'Reglas de area', sucioReglas]].map(([id, label, sucio]) => (
          <button key={id} type="button" onClick={() => setPestana(id)}
            className={`-mb-px border-b-2 px-4 py-2 text-xs font-semibold cursor-pointer ${pestana === id ? 'border-[var(--cm-red)] text-[var(--cm-red)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}`}>
            {label}{sucio && ' •'}
          </button>
        ))}
      </div>

      {errorCarga && (
        <div className="flex items-start gap-2 rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-xs text-[var(--status-error-text)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{errorCarga}</span>
        </div>
      )}

      {cargando ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" /></div>
      ) : pestana === 'niveles' ? (
        <>
          {listaEmpleados.length === 0 && (
            <div className="rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-xs text-[var(--status-warning-text)]">
              El padron esta vacio: importa primero los empleados (Padron de empleados &gt; Importar) para poder buscar personas.
            </div>
          )}
          <div className="overflow-x-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm">
            <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-xs">
              <thead className="bg-[var(--bg-surface-secondary)]">
                <tr>
                  <th className="w-36 border-b border-r border-[var(--border-color)] px-3 py-2.5" />
                  {areas.map(a => (
                    <th key={a.id} className="border-b border-r border-[var(--border-color)] px-3 py-2.5 align-top last:border-r-0">
                      <div className="font-bold uppercase tracking-wider text-[var(--text-main)]">{a.nombre}</div>
                      <label className="mt-1 flex cursor-pointer items-center gap-1.5 text-[10px] font-medium normal-case text-[var(--text-secondary)]">
                        <input type="checkbox" checked={a.activa !== false} onChange={e => cambiarArea(a.id, { activa: e.target.checked })} className="accent-[var(--cm-red)]" />
                        Activa
                      </label>
                    </th>
                  ))}
                  {areas.length === 0 && <th className="border-b px-3 py-2.5 font-normal text-[var(--text-muted)]">Sin areas: agrega una o carga la configuracion inicial.</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                <tr>
                  <th scope="row" className="border-r border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-3 py-3 align-top font-bold uppercase tracking-wider text-[var(--text-secondary)]">Autorizacion 2</th>
                  <td colSpan={n} className="px-3 py-3 align-top">
                    <div className="max-w-sm"><CeldaUna valor={config.autorizador2Nomina} onChange={v => cambiarConfig({ autorizador2Nomina: v })} {...comunes} /></div>
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="border-r border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-3 py-3 align-top font-bold uppercase tracking-wider text-[var(--text-secondary)]">Por ausencia</th>
                  <td colSpan={n} className="px-3 py-3 align-top">
                    <div className="max-w-sm"><CeldaUna valor={config.suplente2Nomina} onChange={v => cambiarConfig({ suplente2Nomina: v })} {...comunes} /></div>
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="border-r border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-3 py-3 align-top font-bold uppercase tracking-wider text-[var(--text-secondary)]">Autorizacion 1</th>
                  {areas.map(a => (
                    <td key={a.id} className="border-r border-[var(--border-subtle)] px-3 py-3 align-top last:border-r-0">
                      <CeldaUna valor={a.autorizador1Nomina} onChange={v => cambiarArea(a.id, { autorizador1Nomina: v })} {...comunes} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className="border-r border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-3 py-3 align-top font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    Aut. 1 por ausencia <span className="block text-[9px] font-normal normal-case">(opcional)</span>
                  </th>
                  {areas.map(a => (
                    <td key={a.id} className="border-r border-[var(--border-subtle)] px-3 py-3 align-top last:border-r-0">
                      <CeldaUna valor={a.suplente1Nomina} onChange={v => cambiarArea(a.id, { suplente1Nomina: v })} {...comunes} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className="border-r border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-3 py-3 align-top font-bold uppercase tracking-wider text-[var(--text-secondary)]">Solicitantes</th>
                  {areas.map(a => (
                    <td key={a.id} className="border-r border-[var(--border-subtle)] px-3 py-3 align-top last:border-r-0">
                      <CeldaVarias valores={a.solicitantesNominas} onChange={v => cambiarArea(a.id, { solicitantesNominas: v })} {...comunes} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input value={nombreNueva} onChange={e => setNombreNueva(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') agregarArea(); }}
              placeholder="Nombre de la nueva area" className={`${inputCls} max-w-xs`} />
            <button type="button" onClick={agregarArea} disabled={!slugify(nombreNueva)} className={btnSecondary}><Plus className="h-3.5 w-3.5" />Agregar area</button>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            Cuando quien captura es el Aut. 1 del area, su solicitud salta directo a Aut. 2. Nadie autoriza una solicitud que creo.
            Aut. 2 puede firmarlo el titular, quien esta por ausencia o cualquier usuario de RH.
          </p>
        </>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-[var(--text-secondary)]">
            Cada empleado recibe su area de tiempo extra al importar el reporte de nomina. Las reglas se evaluan <strong>en orden</strong>:
            gana la primera donde coincidan el departamento y, si se indican, el puesto. Una regla con &quot;Sin area&quot; excluye al departamento de tiempo extra.
          </p>
          <div className="overflow-x-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                <tr>
                  <th className="w-10 px-3 py-2">#</th><th className="w-28 px-3 py-2">Depto</th>
                  <th className="px-3 py-2">Puestos <span className="font-normal normal-case text-[var(--text-muted)]">(separados por coma; vacio = todos)</span></th>
                  <th className="w-48 px-3 py-2">Area</th><th className="w-28 px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {reglas.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 font-mono text-[var(--text-muted)]">{i + 1}</td>
                    <td className="px-3 py-1.5"><input value={r.depto} onChange={e => cambiarRegla(i, { depto: e.target.value })} className={inputCls} /></td>
                    <td className="px-3 py-1.5">
                      <input value={(r.puestos ?? []).join(', ')} placeholder="Todos los puestos"
                        onChange={e => cambiarRegla(i, { puestos: e.target.value.split(',').map(p => p.trimStart()) })} className={inputCls} />
                    </td>
                    <td className="px-3 py-1.5">
                      <select value={r.area ?? ''} onChange={e => cambiarRegla(i, { area: e.target.value })} className={inputCls}>
                        <option value="">Sin area (no participa)</option>
                        {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                        {r.area && !areas.some(a => a.id === r.area) && <option value={r.area}>{r.area} (no existe)</option>}
                      </select>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <div className="inline-flex">
                        <button type="button" onClick={() => moverRegla(i, -1)} disabled={i === 0} className={btnIcon} title="Subir"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => moverRegla(i, 1)} disabled={i === reglas.length - 1} className={btnIcon} title="Bajar"><ArrowDown className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => { setReglas(x => x.filter((_, j) => j !== i)); setSucioReglas(true); }} className={`${btnIcon} hover:text-[var(--status-error-text)]`} title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setReglas(r => [...r, { depto: '', area: '' }]); setSucioReglas(true); }} className={btnSecondary}><Plus className="h-3.5 w-3.5" />Agregar regla</button>
            <button type="button" onClick={() => { setReglas(REGLAS_AREA_TE_INICIALES); setSucioReglas(true); }} className={btnSecondary}><RotateCcw className="h-3.5 w-3.5" />Restablecer reglas iniciales</button>
          </div>
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] p-3">
            <p className="mb-2 text-xs font-semibold text-[var(--text-main)]">Probar una combinacion</p>
            <div className="flex flex-wrap items-center gap-2">
              <input value={prueba.depto} onChange={e => setPrueba(p => ({ ...p, depto: e.target.value }))} placeholder="Depto (ej. 323)" className={`${inputCls} w-32`} />
              <input value={prueba.puesto} onChange={e => setPrueba(p => ({ ...p, puesto: e.target.value }))} placeholder="Puesto (ej. RESINER)" className={`${inputCls} w-56`} />
              {resultadoPrueba && (
                <span className="text-xs text-[var(--text-main)]">
                  → {!resultadoPrueba.regla ? <em className="text-[var(--status-warning-text)]">sin regla (queda sin area)</em>
                    : resultadoPrueba.areaId ? <strong>{nombreArea(resultadoPrueba.areaId)}</strong> : <strong>Sin area (excluido)</strong>}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
