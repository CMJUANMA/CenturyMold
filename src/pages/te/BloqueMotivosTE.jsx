/**
 * BloqueMotivosTE.jsx — El bloque «Motivos» de la solicitud de tiempo extra: un primer motivo obligatorio (del catálogo) y hasta cuatro más
 * con «+ Agregar otro motivo». Según el motivo pide el número de P.O. (solo dígitos, 6 a 15), el número de TB (letras y números, hasta 20)
 * o la descripción ("Otro", mínimo 10 caracteres); todos llevan un «Detalle» opcional. No deja repetir el mismo motivo con el mismo número.
 * Los motivos dados de baja siguen apareciendo en las solicitudes que ya los tenían (se muestran con su nombre guardado).
 */
import { Plus, Trash2 } from 'lucide-react';
import Ayuda from '../../components/Ayuda';
import Boton from '../../components/ui/Boton';
import { Campo, Entrada, Selector } from '../../components/ui/Campo';
import { esActivo } from '../../utils/activo';
import {
  MAX_COMENTARIO_MOTIVO, MAX_DETALLE_MOTIVO, MAX_MOTIVOS_TE, MAX_NUMERO_TB, MIN_COMENTARIO_MOTIVO, NUMERO_PO, limpiarNumero, motivoVacio, reglasDeMotivo,
} from '../../utils/motivosTE';

/** `unico`: un solo motivo sin lista (la corrección de un renglón en Reportes de nómina): sin «Agregar otro motivo» ni «Quitar» */
export default function BloqueMotivosTE({ motivos, catalogo, onChange, problemas = [], deshabilitado = false, unico = false, ...resto }) {
  const cambiar = (i, parche) => onChange(motivos.map((m, k) => (k === i ? { ...m, ...parche } : m)));
  const elegir = (i, motivoId) => {
    // Al cambiar de motivo se limpia lo que ya no aplica (número y descripción), no el detalle
    const nuevo = reglasDeMotivo({ motivoId }, catalogo);
    cambiar(i, { motivoId, nombre: nuevo.nombre, tipoNumero: nuevo.requiereNumero ?? '', numero: '', comentario: '' });
  };
  const quitar = (i) => onChange(motivos.filter((_, k) => k !== i), i);

  return (
    <fieldset className={unico ? '' : 'mt-6'} disabled={deshabilitado} {...resto}>
      <legend className={unico ? 'sr-only' : 'mb-2 text-xs font-medium text-[var(--text-secondary)]'}>Motivos <span className="text-[var(--accent-text)]" aria-hidden="true">*</span></legend>
      <div className="space-y-3">
        {motivos.map((m, i) => {
          const r = reglasDeMotivo(m, catalogo);
          const opciones = catalogo.filter(c => esActivo(c) || c.id === m.motivoId);
          const propios = problemas.filter(p => p.indice === i);
          const faltaEnCatalogo = m.motivoId && !catalogo.some(c => c.id === m.motivoId);
          return (
            <div key={m.clave} data-motivo={i} className={`rounded-lg border bg-[var(--bg-surface)] p-4 ${propios.length ? 'border-[var(--status-error-text)]' : 'border-[var(--border-color)]'}`}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo etiqueta={motivos.length > 1 ? `Motivo ${i + 1}` : 'Motivo'} obligatorio={i === 0}>
                  <Selector id={`te-motivo-${i}`} value={m.motivoId} onChange={e => elegir(i, e.target.value)}>
                    <option value="">Elige el motivo…</option>
                    {faltaEnCatalogo && <option value={m.motivoId}>{r.nombre}</option>}
                    {opciones.map(c => <option key={c.id} value={c.id}>{c.nombre}{esActivo(c) ? '' : ' (dado de baja)'}</option>)}
                  </Selector>
                </Campo>
                {r.requiereNumero === 'po' && (
                  <Campo etiqueta="Número de P.O." obligatorio ayuda={`Solo dígitos, de ${NUMERO_PO.min} a ${NUMERO_PO.max}.`}>
                    <Entrada id={`te-motivo-numero-${i}`} inputMode="numeric" autoComplete="off" maxLength={NUMERO_PO.max} value={m.numero}
                      onChange={e => cambiar(i, { numero: limpiarNumero(e.target.value, 'po') })} placeholder="Ej. 4551099797" />
                  </Campo>
                )}
                {r.requiereNumero === 'tb' && (
                  <Campo etiqueta="Número de TB" obligatorio ayuda={`Letras y números, hasta ${MAX_NUMERO_TB} caracteres.`}>
                    <Entrada id={`te-motivo-numero-${i}`} autoComplete="off" maxLength={MAX_NUMERO_TB} value={m.numero}
                      onChange={e => cambiar(i, { numero: limpiarNumero(e.target.value, 'tb') })} placeholder="Ej. TB2045" />
                  </Campo>
                )}
                {r.requiereComentario && (
                  <Campo etiqueta="Describe el motivo" obligatorio ayuda={`Al menos ${MIN_COMENTARIO_MOTIVO} caracteres (llevas ${m.comentario.trim().length}).`}>
                    <Entrada id={`te-motivo-comentario-${i}`} maxLength={MAX_COMENTARIO_MOTIVO} value={m.comentario}
                      onChange={e => cambiar(i, { comentario: e.target.value })} placeholder="Escribe el motivo" />
                  </Campo>
                )}
                <Campo className={r.requiereNumero || r.requiereComentario ? 'sm:col-span-2' : ''} etiqueta="Detalle (opcional)">
                  <Entrada id={`te-motivo-detalle-${i}`} maxLength={MAX_DETALLE_MOTIVO} value={m.detalle}
                    onChange={e => cambiar(i, { detalle: e.target.value })} placeholder="Ej. apoyo a inventario, movimiento de máquina Krauss Maffei 750" />
                </Campo>
              </div>
              {(propios.length > 0 || (i > 0 && !unico)) && (
                <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                  <ul className="min-w-0 flex-1 space-y-1" aria-live="polite">
                    {propios.map((p, k) => <li key={k} role="alert" className="text-xs font-medium text-[var(--status-error-text)]">{p.mensaje}</li>)}
                  </ul>
                  {i > 0 && !unico && (
                    <Boton id={`btn-quitar-motivo-${i}`} tamano="sm" variante="fantasma" icono={Trash2} onClick={() => quitar(i)} aria-label={`Quitar el motivo ${i + 1}`}>Quitar</Boton>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!unico && <div className="mt-3 flex flex-wrap items-center gap-3">
        <Boton id="btn-agregar-motivo" tamano="sm" icono={Plus} disabled={motivos.length >= MAX_MOTIVOS_TE} onClick={() => onChange([...motivos, motivoVacio()])}>Agregar otro motivo</Boton>
        <span className="text-xs text-[var(--text-muted)]">{motivos.length} de {MAX_MOTIVOS_TE}</span>
      </div>}
      {!unico && <Ayuda clave="solicitar.motivo" />}
    </fieldset>
  );
}
