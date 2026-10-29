import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export function RegisterForm() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError(null);
    // Concepto · Solo se manda el nombre. El rol NO se manda ni se lee de acá: el trigger
    // handle_new_user() crea el perfil como 'cliente' sin importar lo que envíe el cliente.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: nombre } },
    });
    if (error) setError(error.message);
    else if (!data.session) setAviso('Te enviamos un email para confirmar la cuenta.');
    setEnviando(false);
  };

  return (
    <form className="tarjeta formulario" onSubmit={onSubmit}>
      <h1>Crear cuenta</h1>
      <label>Nombre <input value={nombre} onChange={(e) => setNombre(e.target.value)} required /></label>
      <label>Email <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
      <label>Contraseña (mínimo 8) <input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" /></label>
      {error && <p role="alert" className="error">{error}</p>}
      {aviso && <p role="status" className="exito">{aviso}</p>}
      <button type="submit" disabled={enviando}>{enviando ? 'Creando…' : 'Registrarme'}</button>
      <p>¿Ya tenés cuenta? <Link to="/login">Ingresá</Link></p>
    </form>
  );
}
