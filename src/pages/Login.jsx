/**
 * Login.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Pantalla de inicio de sesión con diseño corporativo Century Mold.
 * Pide: Número de nómina y Contraseña.
 * Internamente mapea nomina a `${nomina}@rutas.app`.
 */
import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Sun, Moon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';

// Mismo mensaje para nómina inexistente y contraseña incorrecta (no revela qué nóminas existen)
const MSG_CREDENCIALES = 'Nómina o contraseña incorrecta';
const ERRORES = {
  'auth/invalid-credential': MSG_CREDENCIALES,
  'auth/user-not-found': MSG_CREDENCIALES,
  'auth/wrong-password': MSG_CREDENCIALES,
  'auth/invalid-email': MSG_CREDENCIALES,
  'app/inactivo':
    'Tu usuario está desactivado. Contacta a RH',
  'auth/too-many-requests':
    'Demasiados intentos fallidos. Espere unos minutos antes de reintentar.',
  'auth/user-disabled':
    'Esta cuenta ha sido inhabilitada. Contacte al departamento de Recursos Humanos.',
  'auth/network-request-failed':
    'Sin conexión al servidor. Verifique su red local e intente de nuevo.',
  'app/sin-acceso':
    'Usuario sin acceso. Comuníquese con el administrador del sistema.',
};

function traducirError(code) {
  return ERRORES[code] ?? 'Error al iniciar sesión. Verifique sus credenciales.';
}

export default function Login() {
  const { login, usuario, cargando, mensajeSesion } = useAuth();
  const { esOscuro, alternarTema } = useTheme();
  const navigate = useNavigate();

  const [nomina, setNomina] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mostrarPass, setMostrarPass] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Redirigir si ya existe sesión activa
  if (!cargando && usuario) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const nominaLimpia = nomina.trim();
    if (!nominaLimpia) {
      setError('Ingrese su número de nómina.');
      return;
    }
    if (!password) {
      setError('Ingrese su contraseña.');
      return;
    }

    setEnviando(true);
    try {
      await login(nominaLimpia, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(traducirError(err.code));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--bg-app)] px-4 py-8 text-[var(--text-main)]">
      {/* Selector de modo claro / oscuro en esquina superior derecha */}
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={alternarTema}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] transition-colors"
          title={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {esOscuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      <div className="w-full max-w-sm">
        {/* Cabecera institucional y espacio para logotipo */}
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">
            {!logoError ? (
              <img
                src="/logo.png"
                alt="Century Mold"
                onError={() => setLogoError(true)}
                className="h-12 w-auto object-contain max-w-[200px]"
              />
            ) : null}
          </div>

          <div className="space-y-1">
            <div className="inline-block border-b-2 border-[var(--cm-red)] pb-1 font-semibold tracking-wider text-xs uppercase text-[var(--text-secondary)]">
              Century Mold
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-main)]">
              Solicitud de Transporte de Personal
            </h1>
            <p className="text-xs text-[var(--text-secondary)]">
              Ingrese su número de nómina y contraseña para acceder al sistema
            </p>
          </div>
        </div>

        {/* Tarjeta de autenticación */}
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-sm">
          <form id="form-login" onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Mensaje de error sobrio */}
            {!error && mensajeSesion && (
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 text-xs text-[var(--status-warning-text)] leading-relaxed"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{mensajeSesion}</span>
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] p-3 text-xs text-[var(--status-error-text)] leading-relaxed"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Número de nómina */}
            <div>
              <label
                htmlFor="login-nomina"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
              >
                Número de nómina
              </label>
              <input
                id="login-nomina"
                type="text"
                inputMode="numeric"
                autoComplete="username"
                required
                value={nomina}
                onChange={(e) => setNomina(e.target.value)}
                placeholder="Ejemplo: 12345"
                className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--cm-red)] focus:ring-1 focus:ring-[var(--cm-red)]"
              />
            </div>

            {/* Contraseña */}
            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={mostrarPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingrese su contraseña"
                  className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 pr-10 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--cm-red)] focus:ring-1 focus:ring-[var(--cm-red)]"
                />
                <button
                  type="button"
                  id="btn-toggle-password"
                  onClick={() => setMostrarPass((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors p-1"
                  aria-label={mostrarPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {mostrarPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Botón de acceso */}
            <div className="pt-2">
              <button
                id="btn-ingresar"
                type="submit"
                disabled={enviando}
                className="w-full rounded-md bg-[var(--cm-red)] py-2.5 px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--cm-red-hover)] active:bg-[var(--cm-red-dark)] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {enviando ? 'Verificando información...' : 'Iniciar sesión'}
              </button>
            </div>
          </form>
        </div>

        {/* Pie institucional */}
        <div className="mt-6 text-center text-xs text-[var(--text-muted)]">
          <p>Century Mold México · Sistema interno de control de transporte</p>
        </div>
      </div>
    </div>
  );
}
