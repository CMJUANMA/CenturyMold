/**
 * VistaPreviaRol.jsx — Herramientas (solo admin): "Vista previa por rol".
 * Elige un rol del sistema y los roles operativos y muestra el menú, el Inicio y las pantallas a las que tendría acceso esa combinación.
 * Es solo un dibujo: sale de la matriz de permisos (utils/permisos.js), no cambia la sesión ni los permisos reales de nadie y no lee
 * ningún dato de Firestore (esta pantalla no importa Firebase).
 */
import { useMemo, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import Insignia from '../../components/ui/Insignia';
import { Tarjeta } from '../../components/ui/Tarjeta';
import { Campo, Casilla, Selector } from '../../components/ui/Campo';
import { ICONOS, IconoInicio } from '../../components/iconosMenu';
import { ROL_LABELS } from '../../utils/constantes';
import { COLUMNAS, COMBINACIONES, MATRIZ, accesosDePerfil, bloquesDeInicio, menuDePerfil, perfilDe } from '../../utils/permisos';

const PRESETS = [...COLUMNAS, ...COMBINACIONES];
const INICIAL = { rol: 'usuario', aut2: false, aut1: false, solicitante: false };

/** El perfil de un preset en la forma del formulario */
const formDe = (preset) => ({
  rol: preset.perfil.rol, aut2: preset.perfil.esAut2, aut1: preset.perfil.areasAut1.length > 0, solicitante: preset.perfil.areasSolicitante.length > 0,
});

export default function VistaPreviaRol() {
  const [form, setForm] = useState(INICIAL);
  const perfil = useMemo(() => perfilDe(form), [form]);
  const accesos = useMemo(() => accesosDePerfil(perfil), [perfil]);
  const menu = useMemo(() => menuDePerfil(perfil), [perfil]);
  const inicio = useMemo(() => bloquesDeInicio(perfil), [perfil]);
  const pantallas = MATRIZ.filter(f => f.tipo === 'pantalla');

  const presetActivo = PRESETS.find(p => {
    const f = formDe(p);
    return f.rol === form.rol && f.aut2 === form.aut2 && f.aut1 === form.aut1 && f.solicitante === form.solicitante;
  });
  const cambiar = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <section aria-labelledby="titulo-vista-previa" className="space-y-4">
      <div>
        <h2 id="titulo-vista-previa" className="text-lg font-semibold text-[var(--text-main)]">Vista previa por rol</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Elige un rol del sistema y los roles operativos para ver qué menú, qué Inicio y qué pantallas tendría esa combinación.
        </p>
      </div>
      <Aviso tono="info">
        Es solo un dibujo: no cambia tu sesión ni tus permisos, y no lee datos de nadie. Para probar de verdad, entra con una cuenta de ese rol.
      </Aviso>

      <Tarjeta>
        <div className="grid gap-4 md:grid-cols-2">
          <Campo etiqueta="Combinaciones frecuentes">
            <Selector value={presetActivo?.id ?? ''} onChange={(e) => { const p = PRESETS.find(x => x.id === e.target.value); if (p) setForm(formDe(p)); }}>
              <option value="" disabled>Personalizada</option>
              {PRESETS.map(p => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
            </Selector>
          </Campo>
          <Campo etiqueta="Rol del sistema" ayuda="Da acceso a las pantallas de administración y RH.">
            <Selector value={form.rol} onChange={cambiar('rol')}>
              {['usuario', 'rh', 'nomina', 'admin'].map(r => <option key={r} value={r}>{ROL_LABELS[r]}</option>)}
            </Selector>
          </Campo>
        </div>
        <fieldset className="mt-4">
          <legend className="text-xs font-medium text-[var(--text-secondary)]">Roles operativos (se dan en Asignaciones)</legend>
          <div className="mt-1 flex flex-wrap gap-x-6">
            <Casilla etiqueta="Aut. 2" checked={form.aut2} onChange={cambiar('aut2')} />
            <Casilla etiqueta="Aut. 1 (de un área)" checked={form.aut1} onChange={cambiar('aut1')} />
            <Casilla etiqueta="Solicitante (de un área)" checked={form.solicitante} onChange={cambiar('solicitante')} />
          </div>
        </fieldset>
        <div className="mt-3"><Boton tamano="sm" variante="fantasma" onClick={() => setForm(INICIAL)}>Restablecer vista</Boton></div>
      </Tarjeta>

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <Tarjeta titulo="Menú" cuerpoClassName="p-3">
          <ul aria-label="Menú de la vista previa" className="space-y-0.5">
            {menu.map((it, i) => {
              if (it.section) return <li key={`s-${i}`} className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{it.section}</li>;
              const Icono = ICONOS[it.icono] ?? IconoInicio;
              return (
                <li key={it.path} className="flex min-h-9 items-center gap-3 rounded-md px-3 text-sm text-[var(--text-secondary)]">
                  <Icono className="h-[18px] w-[18px] shrink-0" aria-hidden="true" /><span className="truncate">{it.label}</span>
                </li>
              );
            })}
          </ul>
        </Tarjeta>

        <div className="space-y-4">
          <Tarjeta titulo="Inicio">
            <p className="text-sm text-[var(--text-main)]"><b>{inicio.tipo}</b></p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Botón principal: {inicio.accion}</p>
            {inicio.bloques.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
                {inicio.bloques.map(b => <li key={b}>{b}</li>)}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta titulo="Pantallas">
            <ul aria-label="Pantallas de la vista previa" className="divide-y divide-[var(--border-subtle)]">
              {pantallas.map(f => {
                const ve = f.quien(accesos);
                return (
                  <li key={f.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <span className={ve ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}>{f.nombre}</span>
                    {ve
                      ? <Insignia tono="exito" icono={Check}>Accede</Insignia>
                      : <Insignia tono="neutro" icono={Lock}>No accede</Insignia>}
                  </li>
                );
              })}
            </ul>
          </Tarjeta>
        </div>
      </div>
    </section>
  );
}
