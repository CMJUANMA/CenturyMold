/**
 * MiCuenta.jsx — /mi-cuenta (todos los usuarios): los datos de la cuenta, cómo ver el sistema (ayudas, tamaño de letra y tema)
 * y el cambio de contraseña, con reautenticación segura de Firebase Auth. Antes eran dos pantallas: Perfil y Configuración.
 */
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import PreferenciasPanel from '../components/PreferenciasPanel';
import Aviso from '../components/ui/Aviso';
import Boton from '../components/ui/Boton';
import { Campo, Entrada } from '../components/ui/Campo';
import EncabezadoPagina from '../components/ui/EncabezadoPagina';
import Insignia from '../components/ui/Insignia';
import { ROL_LABELS } from '../utils/constantes';

const ERRORES_PASS = {
  'auth/wrong-password': 'La contraseña actual es incorrecta.',
  'auth/invalid-credential': 'La contraseña actual es incorrecta.',
  'auth/too-many-requests': 'Demasiados intentos seguidos. Espera unos minutos antes de volver a intentar.',
  'auth/requires-recent-login': 'Por seguridad, tu sesión expiró para esta operación. Inicia sesión de nuevo.',
  'auth/weak-password': 'La nueva contraseña debe tener al menos 8 caracteres.',
  'auth/network-request-failed': 'Sin conexión al servidor. Revisa tu conexión a Internet.',
};

function traducirError(code) {
  return ERRORES_PASS[code] ?? 'No se pudo actualizar la contraseña. Inténtalo de nuevo.';
}

/** Campo de contraseña con botón para mostrarla u ocultarla (lo usa Campo, que le pasa id y aria-*) */
function Clave(props) {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative">
      <Entrada type={ver ? 'text' : 'password'} className="pr-12" {...props} />
      <button type="button" onClick={() => setVer(v => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={ver}
        className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--text-main)]">
        {ver ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

function Seccion({ titulo, descripcion, accion, children }) {
  return (
    <section className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-main)]">{titulo}</h2>
          {descripcion && <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{descripcion}</p>}
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}

export default function MiCuenta() {
  const { usuario, cambiarPassword } = useAuth();

  const [passActual, setPassActual] = useState('');
  const [passNueva, setPassNueva] = useState('');
  const [passConfirm, setPassConfirm] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState('');
  const [erroresCampos, setErroresCampos] = useState({});
  const [mensajeExito, setMensajeExito] = useState('');

  const resetFormulario = () => {
    setPassActual('');
    setPassNueva('');
    setPassConfirm('');
    setErrorGeneral('');
    setErroresCampos({});
  };

  const handleCambiarPassword = async (e) => {
    e.preventDefault();
    setErrorGeneral('');
    setMensajeExito('');
    const nuevosErrores = {};

    if (!passActual) {
      nuevosErrores.actual = 'Escribe tu contraseña actual.';
    }
    if (!passNueva) {
      nuevosErrores.nueva = 'Escribe la nueva contraseña.';
    } else if (passNueva.length < 8) {
      nuevosErrores.nueva = 'La contraseña debe tener un mínimo de 8 caracteres.';
    }
    if (!passConfirm) {
      nuevosErrores.confirm = 'Confirma la nueva contraseña.';
    } else if (passNueva && passNueva !== passConfirm) {
      nuevosErrores.confirm = 'Las contraseñas no coinciden.';
    }
    if (passActual && passNueva && passActual === passNueva) {
      nuevosErrores.nueva = 'La nueva contraseña debe ser distinta a la actual.';
    }

    if (Object.keys(nuevosErrores).length > 0) {
      setErroresCampos(nuevosErrores);
      return;
    }

    setErroresCampos({});
    setEnviando(true);

    try {
      await cambiarPassword(passActual, passNueva);
      setMensajeExito('La contraseña se actualizó correctamente.');
      resetFormulario();
      setMostrarFormulario(false);
    } catch (err) {
      setErrorGeneral(traducirError(err.code));
    } finally {
      setEnviando(false);
    }
  };

  if (!usuario) {
    return null;
  }

  const fila = 'grid grid-cols-1 gap-1 py-3 sm:grid-cols-3';

  return (
    <div className="max-w-2xl space-y-8">
      <EncabezadoPagina titulo="Mi cuenta" descripcion="Tus datos, cómo ver el sistema y tu contraseña." />

      {/* ── Datos de la cuenta ───────────────────────────────────────────── */}
      <Seccion titulo={usuario.nombre} descripcion={ROL_LABELS[usuario.rol] ?? usuario.rol}>
        <dl className="mt-4 divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)] text-sm">
          <div className={fila}>
            <dt className="text-[var(--text-secondary)]">Número de nómina</dt>
            <dd className="font-mono text-[var(--text-main)] sm:col-span-2">{usuario.nomina ?? 'Sin asignar'}</dd>
          </div>
          <div className={fila}>
            <dt className="text-[var(--text-secondary)]">Rol</dt>
            <dd className="text-[var(--text-main)] sm:col-span-2">{ROL_LABELS[usuario.rol] ?? usuario.rol}</dd>
          </div>
          <div className={fila}>
            <dt className="text-[var(--text-secondary)]">Estado de la cuenta</dt>
            <dd className="sm:col-span-2"><Insignia tono="exito">Activa</Insignia></dd>
          </div>
        </dl>
      </Seccion>

      {/* ── Cómo ver el sistema: ayudas, letra y tema ───────────────────── */}
      <PreferenciasPanel />

      {/* ── Seguridad y cambio de contraseña ─────────────────────────────── */}
      <Seccion titulo="Seguridad de acceso" descripcion="Cambia tu contraseña de vez en cuando para proteger tu cuenta."
        accion={!mostrarFormulario && (
          <Boton id="btn-abrir-cambio-password" onClick={() => { setMensajeExito(''); setErrorGeneral(''); setMostrarFormulario(true); }}>Cambiar mi contraseña</Boton>
        )}>
        {mensajeExito && !mostrarFormulario && <Aviso tono="exito" className="mt-4">{mensajeExito}</Aviso>}

        {mostrarFormulario && (
          <form onSubmit={handleCambiarPassword} noValidate className="mt-5 space-y-4">
            {errorGeneral && <Aviso tono="error">{errorGeneral}</Aviso>}

            <Campo etiqueta="Contraseña actual" error={erroresCampos.actual}>
              <Clave id="pass-actual" autoComplete="current-password" required value={passActual} onChange={(e) => setPassActual(e.target.value)} />
            </Campo>
            <Campo etiqueta="Nueva contraseña" ayuda="Mínimo 8 caracteres." error={erroresCampos.nueva}>
              <Clave id="pass-nueva" autoComplete="new-password" required value={passNueva} onChange={(e) => setPassNueva(e.target.value)} />
            </Campo>
            <Campo etiqueta="Confirmar nueva contraseña" error={erroresCampos.confirm}>
              <Clave id="pass-confirmar" autoComplete="new-password" required value={passConfirm} onChange={(e) => setPassConfirm(e.target.value)} />
            </Campo>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Boton id="btn-cancelar-password" onClick={() => { setMostrarFormulario(false); resetFormulario(); }}>Cancelar</Boton>
              <Boton type="submit" id="btn-guardar-password" variante="primario" estado={enviando ? 'cargando' : undefined}>{enviando ? 'Guardando…' : 'Guardar nueva contraseña'}</Boton>
            </div>
          </form>
        )}
      </Seccion>
    </div>
  );
}
