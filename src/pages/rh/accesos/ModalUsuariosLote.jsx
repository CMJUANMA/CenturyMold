/**
 * ModalUsuariosLote.jsx — "Crear usuarios en lote" (RH y admin).
 * Selecciona a las personas con asignación vigente y sin cuenta (más otras del padrón si hace falta), genera una contraseña
 * temporal por persona, crea las cuentas una por una (rol de sistema siempre "usuario", debeCambiarPassword: true) y entrega
 * un Excel con los accesos. Las contraseñas solo existen en memoria mientras este modal siga abierto: no se guardan en
 * Firestore ni en la bitácora.
 */
import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Loader2, ShieldAlert, UserPlus, X } from 'lucide-react';
import Modal from '../../../components/Modal';
import BuscadorEmpleado from '../../../components/BuscadorEmpleado';
import { useConfirmar } from '../../../hooks/useConfirmar';
import { useToast } from '../../../hooks/useToast';
import { crearCuentaUsuario, mensajeErrorAlta } from '../../../utils/usuariosDb';
import { ejecutarEnLotes, opBitacora } from '../../../utils/estructuraDb';
import { candidatosSinCuenta, descargarLibroAccesos, generarPassword } from '../../../utils/accesosIniciales';
import { btnPrimary, btnSecondary, btnIcon } from './ui';

const PAUSA_MS = 400; // entre cuenta y cuenta, para no topar los límites de Firebase Auth
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

export default function ModalUsuariosLote({ abierto, ...resto }) {
  // Se monta solo mientras está abierto: al cerrar se pierden las contraseñas, como debe ser
  return abierto ? <Contenido {...resto} /> : null;
}

function Contenido({ actor, usuarios, empleados, asignaciones, nombresArea, ahora, onClose, onCreados }) {
  const confirmar = useConfirmar();
  const toast = useToast();
  const candidatos = useMemo(
    () => candidatosSinCuenta({ asignaciones, usuarios, empleados, nombresArea, ahora }),
    [asignaciones, usuarios, empleados, nombresArea, ahora],
  );
  const [extras, setExtras] = useState([]); // empleados sin asignación agregados a mano
  const [marcadas, setMarcadas] = useState(() => new Set(candidatos.map(c => c.nomina)));
  const [otros, setOtros] = useState(false);
  const [fase, setFase] = useState('seleccion'); // seleccion | creando | resultado
  const [avance, setAvance] = useState({ hechas: 0, total: 0 });
  const [resultados, setResultados] = useState([]);
  const [errorDescarga, setErrorDescarga] = useState('');
  const cuentas = useRef([]); // { nomina, nombre, area, roles, password }: solo en memoria

  const filas = [...candidatos, ...extras];
  const seleccion = filas.filter(f => marcadas.has(f.nomina));
  const yaEnLista = new Set([...filas.map(f => f.nomina), ...usuarios.map(u => String(u.nomina))]);
  const nombreArea = (id) => nombresArea.get(id) ?? id ?? '';

  const alternar = (n) => setMarcadas(prev => { const s = new Set(prev); if (s.has(n)) s.delete(n); else s.add(n); return s; });
  const agregarExtra = (e) => {
    const nomina = String(e.nomina);
    setExtras(prev => [...prev, { nomina, nombre: e.nombre ?? '', puesto: e.puesto ?? '', areaId: e.areaId ?? '', roles: [] }]);
    setMarcadas(prev => new Set(prev).add(nomina));
  };

  const descargar = async () => {
    setErrorDescarga('');
    try { await descargarLibroAccesos(cuentas.current); } catch (err) { setErrorDescarga('No se pudo generar el archivo: ' + err.message); }
  };

  const crear = async () => {
    const lista = seleccion.map(f => ({ ...f, password: generarPassword() }));
    setFase('creando');
    setAvance({ hechas: 0, total: lista.length });
    cuentas.current = [];
    const salida = [];
    const perfiles = [];
    for (let i = 0; i < lista.length; i++) {
      const f = lista[i];
      try {
        const { uid, perfil } = await crearCuentaUsuario({ nomina: f.nomina, nombre: f.nombre, rol: 'usuario', password: f.password });
        perfiles.push({ uid, ...perfil });
        cuentas.current.push({ nomina: f.nomina, nombre: f.nombre, area: nombreArea(f.areaId), roles: f.roles.join(' · '), password: f.password });
        salida.push({ nomina: f.nomina, nombre: f.nombre, ok: true });
      } catch (err) {
        salida.push({ nomina: f.nomina, nombre: f.nombre, ok: false, error: mensajeErrorAlta(err, f.nomina, usuarios) });
      }
      setAvance({ hechas: i + 1, total: lista.length });
      if (i < lista.length - 1) await esperar(PAUSA_MS);
    }
    setResultados(salida);
    if (perfiles.length) {
      onCreados(perfiles);
      // Quién creó cuántas cuentas; nunca contraseñas
      ejecutarEnLotes([opBitacora({
        accion: 'crear_usuarios_lote', entidad: 'usuarios',
        despues: { creadas: perfiles.length, fallidas: salida.length - perfiles.length, nominas: perfiles.map(p => p.nomina) },
      }, actor)]).catch(err => toast.error('Las cuentas se crearon, pero no se pudo registrar en la bitácora: ' + err.message, 8000));
      descargar();
    }
    setFase('resultado');
  };

  const cerrar = async () => {
    if (fase === 'creando') return;
    if (fase === 'resultado' && cuentas.current.length > 0) {
      const ok = await confirmar({
        titulo: 'Cerrar sin conservar las contraseñas', mensaje: '¿Ya descargaste el archivo? Las contraseñas no se podrán recuperar.',
        textoConfirmar: 'Ya lo descargué, cerrar', peligroso: true,
      });
      if (!ok) return;
    }
    onClose();
  };

  const fallidas = resultados.filter(r => !r.ok);
  const creadas = resultados.length - fallidas.length;

  return (
    <Modal isOpen onClose={cerrar} title="Crear usuarios en lote" maxWidth="max-w-4xl" preventCloseOnBackdrop={fase !== 'seleccion'}>
      {fase === 'seleccion' && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-secondary)]">
            Personas con rol operativo vigente que todavía no tienen cuenta. Se crean con rol de sistema <b>Usuario</b> (Recursos Humanos y Administrador
            los da solo un administrador, aparte) y una contraseña temporal propia que deberán cambiar al entrar.
          </p>
          <div className="overflow-x-auto rounded-lg border border-[var(--border-color)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2" /><th className="px-3 py-2">Nómina</th><th className="px-3 py-2">Nombre (padrón)</th>
                  <th className="px-3 py-2">Puesto</th><th className="px-3 py-2">Área</th><th className="px-3 py-2">Roles operativos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filas.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-[var(--text-muted)]">Todas las personas con asignación ya tienen cuenta.</td></tr>}
                {filas.map(f => (
                  <tr key={f.nomina}>
                    <td className="px-3 py-2"><input type="checkbox" checked={marcadas.has(f.nomina)} onChange={() => alternar(f.nomina)}
                      aria-label={`Crear cuenta de ${f.nombre}`} className="h-3.5 w-3.5 accent-[var(--cm-red)]" /></td>
                    <td className="px-3 py-2 font-mono font-bold">{f.nomina}</td>
                    <td className="px-3 py-2">{f.nombre}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{f.puesto || '—'}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{nombreArea(f.areaId) || '—'}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{f.roles.length ? f.roles.join(' · ') : <i>sin asignación</i>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {otros ? (
            <div className="space-y-1">
              <BuscadorEmpleado empleados={empleados} excluir={[...yaEnLista]} onSelect={agregarExtra} placeholder="Buscar en el padrón a quien no tiene asignación…" />
              <button type="button" onClick={() => setOtros(false)} className="text-[11px] font-semibold text-[var(--accent-text)] hover:underline cursor-pointer">Listo</button>
            </div>
          ) : (
            <button type="button" onClick={() => setOtros(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-text)] hover:underline cursor-pointer">
              <UserPlus className="h-3.5 w-3.5" />Agregar otros empleados
            </button>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-[var(--border-color)] pt-3">
            <span className="text-xs text-[var(--text-muted)]">{seleccion.length} cuentas por crear</span>
            <div className="flex gap-2">
              <button type="button" onClick={cerrar} className={btnSecondary}>Cancelar</button>
              <button type="button" id="btn-crear-lote" onClick={crear} disabled={seleccion.length === 0} className={btnPrimary}>
                <UserPlus className="h-3.5 w-3.5" />Crear {seleccion.length} cuentas
              </button>
            </div>
          </div>
        </div>
      )}

      {fase === 'creando' && (
        <div className="space-y-3 py-6" role="status">
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
            <Loader2 className="h-4 w-4 animate-spin" />Creando {Math.min(avance.hechas + 1, avance.total)} de {avance.total}…
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-surface-secondary)]">
            <div className="h-full bg-[var(--cm-red)] transition-all" style={{ width: `${avance.total ? (avance.hechas / avance.total) * 100 : 0}%` }} />
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">No cierres esta ventana: las contraseñas solo existen aquí.</p>
        </div>
      )}

      {fase === 'resultado' && (
        <div className="space-y-4">
          {creadas > 0 && (
            <div role="alert" className="rounded-lg border-2 border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4 text-[var(--status-warning-text)]">
              <p className="flex items-center gap-2 text-base font-bold"><ShieldAlert className="h-5 w-5 shrink-0" />Este archivo contiene contraseñas</p>
              <p className="mt-1 text-sm font-semibold">
                Entrégalo en persona o en sobre cerrado y bórralo después. No se puede volver a descargar.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" id="btn-descargar-accesos" onClick={descargar} className={btnPrimary}><Download className="h-3.5 w-3.5" />Descargar de nuevo</button>
                <span className="text-xs">Solo está disponible mientras esta ventana siga abierta.</span>
              </div>
              {errorDescarga && <p className="mt-2 text-xs font-semibold text-[var(--status-error-text)]">{errorDescarga}</p>}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
            <CheckCircle2 className="h-4 w-4 text-[var(--status-success-text)]" />{creadas} de {resultados.length} cuentas creadas.
          </div>
          {fallidas.length > 0 && (
            <div className="space-y-2 rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] p-3 text-xs text-[var(--status-error-text)]">
              <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" />{fallidas.length} no se pudieron crear</p>
              <ul className="space-y-1">
                {fallidas.map(f => <li key={f.nomina}><b>{f.nomina} {f.nombre}:</b> {f.error}</li>)}
              </ul>
              <p>Corrige el motivo y vuelve a abrir "Crear usuarios en lote": las cuentas ya creadas no se repiten.</p>
            </div>
          )}
          <div className="flex justify-end border-t border-[var(--border-color)] pt-3">
            <button type="button" onClick={cerrar} className={btnSecondary}><X className={`${btnIcon} !p-0 h-3.5 w-3.5`} />Cerrar</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
