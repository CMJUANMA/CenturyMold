/**
 * Perfil.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Vista de perfil de usuario corporativo Century Mold.
 * Datos de la cuenta, selector de tema claro/oscuro y cambio de contraseña
 * mediante reautenticación segura con Firebase Auth.
 */
import { useState } from 'react';
import {
  User,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const ROL_LABELS = {
  admin: 'Administrador del sistema',
  rh: 'Recursos Humanos',
  superintendente: 'Superintendente de área',
};

const ERRORES_PASS = {
  'auth/wrong-password':
    'La contraseña actual ingresada es incorrecta.',
  'auth/invalid-credential':
    'La contraseña actual ingresada es incorrecta.',
  'auth/too-many-requests':
    'Demasiados intentos consecutivos. Espere unos minutos antes de reintentar.',
  'auth/requires-recent-login':
    'Por seguridad, su sesión ha expirado para esta operación. Inicie sesión nuevamente.',
  'auth/weak-password':
    'La nueva contraseña debe contener al menos 8 caracteres.',
  'auth/network-request-failed':
    'Sin conexión al servidor. Compruebe su conexión a Internet.',
};

function traducirError(code) {
  return ERRORES_PASS[code] ?? 'Error al actualizar la contraseña. Intente nuevamente.';
}

export default function Perfil() {
  const { usuario, cambiarPassword } = useAuth();
  const { tema, setTema } = useTheme();

  const [passActual, setPassActual] = useState('');
  const [passNueva, setPassNueva] = useState('');
  const [passConfirm, setPassConfirm] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState('');
  const [erroresCampos, setErroresCampos] = useState({});
  const [mensajeExito, setMensajeExito] = useState('');

  const [verActual, setVerActual] = useState(false);
  const [verNueva, setVerNueva] = useState(false);
  const [verConfirm, setVerConfirm] = useState(false);

  const resetFormulario = () => {
    setPassActual('');
    setPassNueva('');
    setPassConfirm('');
    setErrorGeneral('');
    setErroresCampos({});
    setVerActual(false);
    setVerNueva(false);
    setVerConfirm(false);
  };

  const handleCambiarPassword = async (e) => {
    e.preventDefault();
    setErrorGeneral('');
    setMensajeExito('');
    const nuevosErrores = {};

    if (!passActual) {
      nuevosErrores.actual = 'Ingrese su contraseña actual.';
    }
    if (!passNueva) {
      nuevosErrores.nueva = 'Ingrese la nueva contraseña.';
    } else if (passNueva.length < 8) {
      nuevosErrores.nueva = 'La contraseña debe tener un mínimo de 8 caracteres.';
    }
    if (!passConfirm) {
      nuevosErrores.confirm = 'Confirme la nueva contraseña.';
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
      setMensajeExito('La contraseña ha sido actualizada correctamente.');
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

  return (
    <div className="space-y-6 max-w-2xl">
      {/* ── Encabezado ───────────────────────────────────────────────────── */}
      <div className="border-b border-[var(--border-color)] pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
          Perfil de usuario
        </h1>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Información general de la cuenta y configuración de seguridad
        </p>
      </div>

      {/* ── Datos de la cuenta ───────────────────────────────────────────── */}
      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-sm">
        <div className="flex items-center gap-3.5 pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)]">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--text-main)] leading-tight">
              {usuario.nombre}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {ROL_LABELS[usuario.rol] ?? usuario.rol}
            </p>
          </div>
        </div>

        <div className="divide-y divide-[var(--border-subtle)] text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 py-3 gap-1">
            <span className="font-semibold text-[var(--text-secondary)] uppercase tracking-wider text-[11px]">
              Número de nómina
            </span>
            <span className="sm:col-span-2 font-mono text-[var(--text-main)]">
              {usuario.nomina ?? 'Sin asignar'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 py-3 gap-1">
            <span className="font-semibold text-[var(--text-secondary)] uppercase tracking-wider text-[11px]">
              Rol operativo
            </span>
            <span className="sm:col-span-2 text-[var(--text-main)]">
              {ROL_LABELS[usuario.rol] ?? usuario.rol}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 py-3 gap-1">
            <span className="font-semibold text-[var(--text-secondary)] uppercase tracking-wider text-[11px]">
              Estado de la cuenta
            </span>
            <div className="sm:col-span-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--status-success-text)]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Activo</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Selector de tema (Modo claro / oscuro) ───────────────────────── */}
      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-sm">
        <div className="flex items-center gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)]">
            {tema === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-main)]">
              Apariencia del sistema
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Seleccione el modo visual que prefiera para trabajar en el sistema
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTema('light')}
            className={`flex items-center justify-center gap-2 rounded-md border p-3 text-xs font-semibold transition-colors ${
              tema === 'light'
                ? 'border-[var(--cm-red)] bg-[var(--cm-red-light)] text-[var(--cm-red)]'
                : 'border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
            }`}
          >
            <Sun className="h-4 w-4" />
            <span>Modo claro</span>
          </button>

          <button
            type="button"
            onClick={() => setTema('dark')}
            className={`flex items-center justify-center gap-2 rounded-md border p-3 text-xs font-semibold transition-colors ${
              tema === 'dark'
                ? 'border-[var(--cm-red)] bg-[var(--cm-red)]/15 text-[var(--status-error-text)]'
                : 'border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
            }`}
          >
            <Moon className="h-4 w-4" />
            <span>Modo oscuro</span>
          </button>
        </div>
      </div>

      {/* ── Seguridad y cambio de contraseña ─────────────────────────────── */}
      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)]">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-main)]">
                Seguridad de acceso
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Actualice periódicamente su contraseña para proteger su cuenta
              </p>
            </div>
          </div>

          {!mostrarFormulario && (
            <button
              type="button"
              id="btn-abrir-cambio-password"
              onClick={() => {
                setMensajeExito('');
                setErrorGeneral('');
                setMostrarFormulario(true);
              }}
              className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] hover:border-[var(--cm-red)] transition-colors"
            >
              Cambiar mi contraseña
            </button>
          )}
        </div>

        {/* Mensaje de confirmación exitosa */}
        {mensajeExito && !mostrarFormulario && (
          <div className="mt-4 flex items-center gap-2.5 rounded-md border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-3 text-xs text-[var(--status-success-text)]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{mensajeExito}</span>
          </div>
        )}

        {/* Formulario de actualización */}
        {mostrarFormulario && (
          <form onSubmit={handleCambiarPassword} noValidate className="mt-4 space-y-4">
            {errorGeneral && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] p-3 text-xs text-[var(--status-error-text)]"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorGeneral}</span>
              </div>
            )}

            {/* Contraseña actual */}
            <div>
              <label
                htmlFor="pass-actual"
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
              >
                Contraseña actual
              </label>
              <div className="relative">
                <input
                  id="pass-actual"
                  type={verActual ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={passActual}
                  onChange={(e) => setPassActual(e.target.value)}
                  placeholder="Ingrese su contraseña actual"
                  className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 pr-10 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--cm-red)] focus:ring-1 focus:ring-[var(--cm-red)]"
                />
                <button
                  type="button"
                  onClick={() => setVerActual((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors p-1"
                  aria-label={verActual ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {verActual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {erroresCampos.actual && (
                <p className="mt-1 text-[11px] text-[var(--status-error-text)]">
                  {erroresCampos.actual}
                </p>
              )}
            </div>

            {/* Nueva contraseña */}
            <div>
              <label
                htmlFor="pass-nueva"
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
              >
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  id="pass-nueva"
                  type={verNueva ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={passNueva}
                  onChange={(e) => setPassNueva(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 pr-10 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--cm-red)] focus:ring-1 focus:ring-[var(--cm-red)]"
                />
                <button
                  type="button"
                  onClick={() => setVerNueva((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors p-1"
                  aria-label={verNueva ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {verNueva ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {erroresCampos.nueva && (
                <p className="mt-1 text-[11px] text-[var(--status-error-text)]">
                  {erroresCampos.nueva}
                </p>
              )}
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label
                htmlFor="pass-confirmar"
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
              >
                Confirmar nueva contraseña
              </label>
              <div className="relative">
                <input
                  id="pass-confirmar"
                  type={verConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={passConfirm}
                  onChange={(e) => setPassConfirm(e.target.value)}
                  placeholder="Repita la nueva contraseña"
                  className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 pr-10 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--cm-red)] focus:ring-1 focus:ring-[var(--cm-red)]"
                />
                <button
                  type="button"
                  onClick={() => setVerConfirm((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors p-1"
                  aria-label={verConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {verConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {erroresCampos.confirm && (
                <p className="mt-1 text-[11px] text-[var(--status-error-text)]">
                  {erroresCampos.confirm}
                </p>
              )}
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                id="btn-guardar-password"
                disabled={enviando}
                className="rounded-md bg-[var(--cm-red)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--cm-red-hover)] active:bg-[var(--cm-red-dark)] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {enviando ? 'Guardando cambios...' : 'Guardar nueva contraseña'}
              </button>
              <button
                type="button"
                id="btn-cancelar-password"
                onClick={() => {
                  setMostrarFormulario(false);
                  resetFormulario();
                }}
                className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)] transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
