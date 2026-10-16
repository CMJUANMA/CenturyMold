/**
 * Login.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Pantalla de inicio de sesión con diseño corporativo Century Mold.
 * Pide: Número de nómina y Contraseña.
 * Internamente mapea nomina a `${nomina}@rutas.app`.
 */
import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Eye, EyeOff, Sun, Moon } from 'lucide-react';
import Boton from '../components/ui/Boton';
import { Campo, Entrada } from '../components/ui/Campo';
import Aviso from '../components/ui/Aviso';
import Logo from '../components/Logo';
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
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--bg-app)] px-4 py-10 text-[var(--text-main)]">
      {/* Cambio de tema, esquina superior derecha */}
      <div className="absolute right-4 top-4">
        <button
          type="button"
          onClick={alternarTema}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]"
          title={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {esOscuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      <main className="anim-pagina w-full max-w-md">
        {/* Marca: el logotipo es el protagonista */}
        <div className="mb-10 text-center">
          <div className="mb-8 flex justify-center">
            <Logo className="w-80" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)]">Portal de procesos</h1>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">Century Mold Querétaro · Tiempo extra y transporte</p>
        </div>

        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 sm:p-8">
          <form id="form-login" onSubmit={handleSubmit} noValidate className="space-y-5">
            {!error && mensajeSesion && <Aviso tono="aviso">{mensajeSesion}</Aviso>}
            {error && <Aviso tono="error">{error}</Aviso>}

            <Campo etiqueta="Número de nómina" ayuda="Escríbalo tal como aparece en su gafete.">
              <Entrada
                id="login-nomina"
                type="text"
                inputMode="numeric"
                autoComplete="username"
                required
                value={nomina}
                onChange={(e) => setNomina(e.target.value)}
                placeholder="Ejemplo: 12345"
              />
            </Campo>

            <Campo etiqueta="Contraseña">
              <EntradaClave
                id="login-password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Su contraseña"
                visible={mostrarPass}
                onAlternar={() => setMostrarPass((v) => !v)}
              />
            </Campo>

            <Boton id="btn-ingresar" type="submit" variante="primario" estado={enviando ? 'cargando' : undefined} className="w-full">
              {enviando ? 'Verificando…' : 'Iniciar sesión'}
            </Boton>
          </form>
        </div>

        <p className="mt-8 text-center text-xs text-[var(--text-muted)]">© {new Date().getFullYear()} Century Mold</p>
      </main>
    </div>
  );
}

/** Contraseña con botón para mostrarla u ocultarla (el botón mide 44 px para que se pueda tocar bien en el celular) */
function EntradaClave({ visible, onAlternar, invalido, ...resto }) {
  return (
    <div className="relative">
      <Entrada type={visible ? 'text' : 'password'} className="pr-12" invalido={invalido} {...resto} />
      <button
        type="button"
        id="btn-toggle-password"
        onClick={onAlternar}
        className="absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--text-main)] md:h-10 md:w-10"
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
