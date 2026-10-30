import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export function LoginForm() {
  const { user } = useAuth();
  const destino = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Concepto · /login es una ruta aparte. Con sesión, redirige: el formulario
  // nunca se pinta debajo de la tienda.
  if (user) return <Navigate to={destino} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError('Email o contraseña incorrectos.');
    setEnviando(false);
  };

  return (
    <form className="tarjeta formulario" onSubmit={onSubmit}>
      <h1>Ingresar</h1>
      <label>Email <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
      <label>Contraseña <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" disabled={enviando}>{enviando ? 'Ingresando…' : 'Ingresar'}</button>
      <p>¿No tenés cuenta? <Link to="/registro">Registrate</Link></p>
    </form>
  );
}
