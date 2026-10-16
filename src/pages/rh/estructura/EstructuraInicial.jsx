/**
 * EstructuraInicial.jsx — «Crear estructura inicial». Primero SOLO muestra lo que encuentra (áreas viejas,
 * usuarios con areaIds) y lo que propone; no escribe nada hasta confirmar. Nunca sobrescribe lo existente.
 */
import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../../../components/Modal';
import { proponerEstructuraInicial } from '../../../utils/estructura';
import { ejecutarEnLotes, leerColeccion, opsEstructuraInicial } from '../../../utils/estructuraDb';
import { btnPrimary, btnSecondary, chip, chipWarn } from './ui';

export default function EstructuraInicial({ areas, puestos, usuario, toast, onClose, onHecho }) {
  const [usuarios, setUsuarios] = useState(null);
  const [aplicarEquiv, setAplicarEquiv] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    leerColeccion('usuarios', toast).then(r => { if (vivo) setUsuarios(r.datos.map(u => ({ uid: u.id, ...u }))); });
    return () => { vivo = false; };
  }, [toast]);

  const propuesta = useMemo(() => (usuarios ? proponerEstructuraInicial({ areas, puestos }, usuarios) : null), [areas, puestos, usuarios]);
  const esAdmin = usuario?.rol === 'admin';
  // RH no puede editar a un administrador (reglas): esos usuarios se dejan fuera y se avisa
  const rolDe = (uid) => usuarios?.find(u => u.uid === uid)?.rol;
  const editables = propuesta?.usuariosAfectados.filter(u => esAdmin || rolDe(u.uid) !== 'admin') ?? [];
  const bloqueados = (propuesta?.usuariosAfectados.length ?? 0) - editables.length;

  const confirmar = async () => {
    setGuardando(true); setError('');
    try {
      await ejecutarEnLotes(opsEstructuraInicial(propuesta, { equivalencias: aplicarEquiv ? editables : null, usuario }));
      toast.success('Estructura inicial creada.');
      onHecho();
    } catch (e) {
      setError(`No se pudo guardar: ${e.message}`);
      toast.error(`No se pudo crear la estructura (${e.code ?? e.message}).`, 8000);
    } finally { setGuardando(false); }
  };

  const crear = propuesta?.areasNuevas.filter(a => a.accion === 'crear') ?? [];
  const completar = propuesta?.areasNuevas.filter(a => a.accion === 'completar') ?? [];
  const puestosCrear = propuesta?.puestosNuevos.filter(p => p.accion === 'crear') ?? [];
  const nada = propuesta && crear.length === 0 && completar.length === 0 && puestosCrear.length === 0 && editables.length === 0;

  return (
    <Modal isOpen onClose={() => !guardando && onClose()} title="Crear estructura inicial" maxWidth="max-w-2xl" preventCloseOnBackdrop={guardando}>
      {!propuesta ? (
        <div className="flex items-center gap-2 py-6 text-xs text-[var(--text-secondary)]"><Loader2 className="h-4 w-4 animate-spin" />Leyendo lo que ya existe...</div>
      ) : (
        <div className="space-y-4 text-xs">
          <p className="text-[var(--text-secondary)]">
            Esto es solo una vista previa. Al confirmar se crea lo que falta; <strong>no se modifica ni se borra nada de lo que ya existe</strong>.
          </p>

          <section className="space-y-1">
            <h3 className="font-semibold text-[var(--text-main)]">Lo que hay hoy en la colección «areas» ({areas.length})</h3>
            {areas.length === 0 ? <p className="text-[var(--text-muted)]">Está vacía.</p> : (
              <ul className="flex flex-wrap gap-1.5">
                {areas.map(a => <li key={a.id} className={chip}>{a.nombre ?? '(sin nombre)'} · <span className="ml-1 font-mono">{a.id}</span></li>)}
              </ul>
            )}
          </section>

          <section className="space-y-1">
            <h3 className="font-semibold text-[var(--text-main)]">Áreas</h3>
            <ul className="space-y-0.5">
              {propuesta.areasNuevas.map(a => (
                <li key={a.id}>
                  <span className="font-semibold">{a.nombre}</span> <span className="font-mono text-[var(--text-muted)]">{a.id}</span> ·{' '}
                  {a.accion === 'crear' && <span className="text-[var(--status-success-text)]">se crea</span>}
                  {a.accion === 'completar' && <span className="text-[var(--status-warning-text)]">ya existe; se le agregan solo los campos que faltan ({a.faltan.join(', ')})</span>}
                  {a.accion === 'existe' && <span className="text-[var(--text-muted)]">ya existe, no se toca</span>}
                  {' '}· {a.participaTE ? 'participa en TE' : 'no participa en TE'}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-[var(--text-main)]">Puestos</h3>
            <p>{puestosCrear.length} se crean · {propuesta.puestosNuevos.length - puestosCrear.length} ya existen (no se tocan).</p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold text-[var(--text-main)]">Áreas anteriores y equivalencias para los usuarios</h3>
            {propuesta.heredadas.length === 0 ? <p className="text-[var(--text-muted)]">No hay áreas anteriores con otro id.</p> : (
              <ul className="space-y-0.5">
                {propuesta.heredadas.map(h => (
                  <li key={h.id}>
                    «{h.nombre}» <span className="font-mono text-[var(--text-muted)]">{h.id}</span> →{' '}
                    {h.equivale ? <span className="font-semibold">{h.equivaleNombre}</span> : <span className={chipWarn}>sin equivalencia</span>}
                  </li>
                ))}
              </ul>
            )}
            {editables.length > 0 && (
              <>
                <label className="flex cursor-pointer items-center gap-2 font-semibold">
                  <input type="checkbox" checked={aplicarEquiv} onChange={e => setAplicarEquiv(e.target.checked)} className="accent-[var(--accent)]" />
                  Actualizar los areaIds de {editables.length} usuario(s) con estas equivalencias
                </label>
                <ul className="max-h-32 divide-y divide-[var(--border-subtle)] overflow-y-auto rounded border border-[var(--border-subtle)]">
                  {editables.map(u => (
                    <li key={u.uid} className="px-2 py-1">
                      <span className="font-semibold">{u.nombre}</span>: <span className="font-mono text-[var(--text-muted)]">{u.antes.join(', ')}</span> → <span className="font-mono">{u.despues.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {bloqueados > 0 && <p className="text-[var(--status-warning-text)]">{bloqueados} usuario(s) administrador no se pueden actualizar con rol RH; hágalo un administrador.</p>}
            {propuesta.sinEquivalencia.length > 0 && (
              <p className="text-[var(--status-warning-text)]">
                Hay usuarios con areaIds sin equivalencia ({propuesta.sinEquivalencia.join(', ')}): no se tocan; revíselos en Usuarios y accesos.
              </p>
            )}
          </section>

          {error && <p className="text-[var(--status-error-text)]">{error}</p>}
          {nada && <p className="font-semibold text-[var(--status-success-text)]">La estructura inicial ya está completa; no hay nada que crear.</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={btnSecondary} onClick={onClose} disabled={guardando}>Cancelar</button>
            <button type="button" className={btnPrimary} onClick={confirmar} disabled={guardando || nada}>
              {guardando ? 'Creando...' : 'Confirmar y crear'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
