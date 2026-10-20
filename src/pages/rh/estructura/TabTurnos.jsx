/**
 * TabTurnos.jsx — Estructura > Turnos: horario normal de los turnos de nómina A, B y C (entrada y salida, en los bloques 7:00, 16:00,
 * 19:00 y 0:00). Empiezan vacíos y RH los captura. Con ellos, una extensión de turno sabe a qué hora empieza el tiempo extra de cada empleado.
 */
import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import { useTurnosNomina } from '../../../hooks/useTurnosNomina';
import AyudaPantalla from '../../../components/AyudaPantalla';
import Aviso from '../../../components/ui/Aviso';
import Boton from '../../../components/ui/Boton';
import { Selector } from '../../../components/ui/Campo';
import { EsqueletoTabla } from '../../../components/ui/Esqueleto';
import { Fila, Tabla, Td, Th } from '../../../components/ui/Tabla';
import { HORAS_ENTRADA_TE, HORAS_SALIDA_TE } from '../../../utils/tiempoExtra';
import { formatoHora12 } from '../../../utils/horas';
import { TURNOS_NOMINA_IDS, guardarTurnosNomina } from '../../../utils/turnosNominaDb';

export default function TabTurnos() {
  const { usuario } = useAuth();
  const toast = useToast();
  const { turnos, cargando, recargar } = useTurnosNomina();
  const [form, setForm] = useState(turnos);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { setForm(turnos); }, [turnos]);

  const cambiar = (t, campo, valor) => setForm(f => ({ ...f, [t]: { ...f[t], [campo]: valor } }));
  const incompletos = TURNOS_NOMINA_IDS.filter(t => !!form[t].entrada !== !!form[t].salida);
  const sinCambios = TURNOS_NOMINA_IDS.every(t => form[t].entrada === turnos[t].entrada && form[t].salida === turnos[t].salida);

  const guardar = async () => {
    setGuardando(true);
    try { await guardarTurnosNomina(usuario, form); toast.success('Turnos guardados.'); recargar(); }
    catch (err) { toast.error('No se pudieron guardar los turnos: ' + err.message, 8000); } finally { setGuardando(false); }
  };

  if (cargando) return <EsqueletoTabla filas={3} columnas={3} />;
  return (
    <section className="space-y-4" aria-label="Turnos de nómina">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-[var(--text-main)]">Horario normal de cada turno</h2>
        <AyudaPantalla id="turnos" />
      </div>
      <p className="text-sm text-[var(--text-secondary)]">
        Las extensiones de turno empiezan cuando termina el turno normal del empleado. Mientras un turno esté vacío, quien captura la extensión tendrá que escribir a mano la hora en que termina el turno de cada empleado.
      </p>
      <Tabla etiqueta="Horario normal de cada turno">
        <thead>
          <tr><Th>Turno</Th><Th>Entrada</Th><Th>Salida (fin del turno)</Th></tr>
        </thead>
        <tbody>
          {TURNOS_NOMINA_IDS.map(t => (
            <Fila key={t}>
              <Td className="font-medium">Turno {t}</Td>
              <Td>
                <Selector aria-label={`Entrada del turno ${t}`} value={form[t].entrada} onChange={e => cambiar(t, 'entrada', e.target.value)} className="max-w-[12rem]">
                  <option value="">Sin configurar</option>{HORAS_ENTRADA_TE.map(h => <option key={h} value={h}>{formatoHora12(h)}</option>)}
                </Selector>
              </Td>
              <Td>
                <Selector aria-label={`Salida del turno ${t}`} value={form[t].salida} onChange={e => cambiar(t, 'salida', e.target.value)} className="max-w-[12rem]">
                  <option value="">Sin configurar</option>{HORAS_SALIDA_TE.map(h => <option key={h} value={h}>{formatoHora12(h)}</option>)}
                </Selector>
              </Td>
            </Fila>
          ))}
        </tbody>
      </Tabla>
      {incompletos.length > 0 && <Aviso tono="aviso">Turno {incompletos.join(', ')}: captura la entrada y la salida, o deja las dos vacías.</Aviso>}
      <div className="flex justify-end">
        <Boton variante="primario" icono={Save} estado={guardando ? 'cargando' : undefined} onClick={guardar} disabled={guardando || sinCambios || incompletos.length > 0}>Guardar turnos</Boton>
      </div>
    </section>
  );
}
