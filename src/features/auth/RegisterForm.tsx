import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { MIN_CLAVE, ESPERA_REENVIO_S } from '../../lib/auth';
import { mensajeErrorAuth, urlConfirmacion } from '../../lib/retornoAuth';
import { Campo, CampoClave, enfocarPrimerError } from '../../components/Campo';
import { ReenviarConfirmacion } from '../../components/ReenviarConfirmacion';

type Errores = Partial<Record<'nombre' | 'email' | 'password' | 'confirmacion', string>>;

// Concepto · Validación en el cliente = experiencia (avisar antes de mandar).
// La regla real de longitud la aplica Supabase Auth (Minimum password length del proyecto).
function validar(nombre: string, email: string, password: string, confirmacion: string): Errores {
  const e: Errores = {};
  if (!nombre.trim()) e.nombre = 'Escribí tu nombre.';
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Escribí un email válido, por ejemplo nombre@gmail.com.';
  if (!password) e.password = 'Escribí una contraseña.';
  else if (password.length < MIN_CLAVE) e.password = `Tiene que tener al menos ${MIN_CLAVE} caracteres (te faltan ${MIN_CLAVE - password.length}).`;
  if (!confirmacion) e.confirmacion = 'Repetí la contraseña.';
  else if (confirmacion !== password) e.confirmacion = 'Las contraseñas no coinciden.';
  return e;
}

export function RegisterForm() {
  const { user } = useAuth();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [tocados, setTocados] = useState<Record<string, boolean>>({});
  const [intento, setIntento] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrado, setRegistrado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Con sesión (por ejemplo, si el proyecto no pide confirmar el email) no hay nada que registrar.
  if (user) return <Navigate to="/" replace />;
  if (registrado) return <RevisaTuCorreo email={registrado} onCorregir={() => setRegistrado(null)} />;

  const errores = validar(nombre, email, password, confirmacion);
  // Concepto · Validación "en vivo" sin retar de entrada: un campo muestra su error recién
  // cuando lo dejaste (blur) o intentaste enviar. La confirmación se valida mientras tipeás.
  const ver = (campo: keyof Errores) =>
    intento || tocados[campo] || (campo === 'confirmacion' && confirmacion.length > 0) ? errores[campo] : undefined;
  const tocar = (campo: string) => () => setTocados((t) => ({ ...t, [campo]: true }));
  const coinciden = confirmacion.length > 0 && confirmacion === password && password.length >= MIN_CLAVE;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setIntento(true);
    if (Object.keys(errores).length) {
      enfocarPrimerError(errores);
      return;
    }
    setEnviando(true);
    setError(null);
    // Concepto · Solo se manda el nombre. El rol NO se manda ni se lee de acá: el trigger
    // handle_new_user() crea el perfil como 'cliente' sin importar lo que envíe el cliente.
    // Concepto · emailRedirectTo: el enlace del mail vuelve a ESTE sitio (demo o localhost).
    // Tiene que estar permitido en Supabase → Authentication → URL Configuration → Redirect URLs.
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: nombre.trim() }, emailRedirectTo: urlConfirmacion() },
    });
    setEnviando(false);
    if (err) {
      setError(mensajeErrorAuth(err));
      return;
    }
    // Concepto · Si el email ya tenía cuenta confirmada, Supabase NO lo dice con un error
    // (para no revelar qué emails existen): devuelve un usuario sin identidades.
    if (data.user && data.user.identities?.length === 0) {
      setError('Ya hay una cuenta con ese email. Ingresá con tu contraseña.');
      return;
    }
    if (!data.session) setRegistrado(email.trim());
    // Si hay sesión, AuthContext la toma y el <Navigate> de arriba lleva a la tienda.
  };

  return (
    <form className="tarjeta formulario auth-tarjeta" onSubmit={onSubmit} noValidate>
      <div>
        <h1>Crear cuenta</h1>
        <p className="nota">Te vamos a mandar un mail para confirmar que el email es tuyo.</p>
      </div>
      <Campo
        nombre="nombre" etiqueta="Nombre" autoComplete="name"
        value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={tocar('nombre')}
        error={ver('nombre')}
      />
      <Campo
        nombre="email" etiqueta="Email" type="email" autoComplete="email" inputMode="email"
        value={email} onChange={(e) => setEmail(e.target.value)} onBlur={tocar('email')}
        error={ver('email')}
      />
      <CampoClave
        nombre="password" etiqueta="Contraseña" autoComplete="new-password"
        value={password} onChange={(e) => setPassword(e.target.value)} onBlur={tocar('password')}
        error={ver('password')}
        ayuda={ver('password') ? undefined : `Mínimo ${MIN_CLAVE} caracteres.`}
      />
      <CampoClave
        nombre="confirmacion" etiqueta="Confirmar contraseña" autoComplete="new-password"
        value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} onBlur={tocar('confirmacion')}
        error={ver('confirmacion')}
        ayuda={coinciden ? <span className="ok-campo">✓ Las contraseñas coinciden</span> : undefined}
      />
      {error && (
        <p role="alert" className="alerta">
          {error}{' '}
          {error.startsWith('Ya hay una cuenta') && <Link to="/login">Ir a ingresar</Link>}
        </p>
      )}
      <button type="submit" disabled={enviando}>{enviando ? 'Creando cuenta…' : 'Registrarme'}</button>
      <p className="nota centro-texto">¿Ya tenés cuenta? <Link to="/login">Ingresá</Link></p>
    </form>
  );
}

// Concepto · Pantalla de "siguiente paso": después del alta la cuenta existe pero no está
// confirmada. Explicamos qué hacer en vez de dejar un cartelito que se pierde.
function RevisaTuCorreo({ email, onCorregir }: { email: string; onCorregir: () => void }) {
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => titulo.current?.focus(), []);
  return (
    <section className="tarjeta auth-tarjeta" aria-labelledby="titulo-correo">
      <div className="icono-aviso" aria-hidden="true">✉</div>
      <h1 id="titulo-correo" ref={titulo} tabIndex={-1} className="centro-texto">Revisá tu correo</h1>
      <p className="centro-texto">
        Te mandamos un enlace de confirmación a <strong>{email}</strong>.
      </p>
      <ol className="pasos-correo">
        <li>Buscá el mail de confirmación (puede tardar un minuto). Si no aparece, mirá en <strong>spam</strong> o <strong>promociones</strong>.</li>
        <li>Tocá el enlace <strong>una sola vez</strong>. Te trae de vuelta a <strong>{window.location.host}</strong>, este mismo sitio, con la sesión iniciada.</li>
        <li>Podés abrirlo desde otro dispositivo: la sesión se inicia en el navegador donde lo abras.</li>
      </ol>
      <ReenviarConfirmacion email={email} esperaInicial={ESPERA_REENVIO_S} />
      <p className="nota centro-texto">
        ¿Te equivocaste de email?{' '}
        <button type="button" className="enlace-azul" onClick={onCorregir}>Registrarme con otro</button>
        {' · '}<Link to="/login">Ir a ingresar</Link>
      </p>
    </section>
  );
}
