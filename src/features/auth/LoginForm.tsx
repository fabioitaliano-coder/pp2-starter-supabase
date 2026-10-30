import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { mensajeErrorAuth } from '../../lib/retornoAuth';
import { Campo, CampoClave } from '../../components/Campo';
import { ReenviarConfirmacion } from '../../components/ReenviarConfirmacion';

export function LoginForm() {
  const { user } = useAuth();
  const destino = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sinConfirmar, setSinConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Concepto · /login es una ruta aparte. Con sesión, redirige: el formulario
  // nunca se pinta debajo de la tienda.
  if (user) return <Navigate to={destino} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError(null);
    setSinConfirmar(false);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      // Concepto · "Email not confirmed" no es "contraseña incorrecta": la cuenta existe,
      // falta tocar el enlace del mail. Lo decimos claro y ofrecemos reenviarlo.
      const noConfirmado = err.code === 'email_not_confirmed' || /email not confirmed/i.test(err.message);
      setSinConfirmar(noConfirmado);
      setError(noConfirmado ? mensajeErrorAuth({ message: err.message, code: 'email_not_confirmed' }) : mensajeErrorAuth(err));
    }
    setEnviando(false);
  };

  return (
    <div className="auth-columna">
      <form className="tarjeta formulario auth-tarjeta" onSubmit={onSubmit}>
        <h1>Ingresar</h1>
        <Campo
          nombre="email" etiqueta="Email" type="email" autoComplete="email" inputMode="email" required
          value={email} onChange={(e) => setEmail(e.target.value)}
        />
        <CampoClave
          nombre="password" etiqueta="Contraseña" autoComplete="current-password" required
          value={password} onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p role="alert" className="alerta">{error}</p>}
        <button type="submit" disabled={enviando}>{enviando ? 'Ingresando…' : 'Ingresar'}</button>
        <p className="nota centro-texto">¿No tenés cuenta? <Link to="/registro">Registrate</Link></p>
      </form>
      {sinConfirmar && (
        <div className="auth-tarjeta auth-tarjeta-suelta">
          <ReenviarConfirmacion email={email.trim()} />
        </div>
      )}
    </div>
  );
}
