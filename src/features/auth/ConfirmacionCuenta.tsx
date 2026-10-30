import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { consumirRetornoAuth, mensajeErrorEnlace } from '../../lib/retornoAuth';
import { ReenviarConfirmacion } from '../../components/ReenviarConfirmacion';

// Concepto · Destino del enlace del mail (/auth/confirmado). supabase-js ya leyó el token
// del #hash y creó la sesión (detectSessionInUrl). Acá solo decidimos qué mostrar:
//   - sesión lista → a la tienda con el aviso "Cuenta confirmada"
//   - el enlace trajo un error (vencido, ya usado) → explicación + reenviar
//   - sin sesión ni error (entraron a mano) → cómo seguir
export function ConfirmacionCuenta() {
  const { user, loading } = useAuth();
  const [retorno] = useState(consumirRetornoAuth);

  useEffect(() => {
    document.title = retorno.error ? 'Enlace no válido · PP2' : 'Confirmando cuenta · PP2';
  }, [retorno.error]);

  if (!retorno.error && loading) {
    return <p className="centro" role="status">Confirmando tu cuenta…</p>;
  }

  if (!retorno.error && user) {
    return <Navigate to="/" replace state={{ aviso: 'cuenta-confirmada' }} />;
  }

  if (retorno.error) {
    return (
      <section className="tarjeta auth-tarjeta" aria-labelledby="titulo-enlace">
        <div className="icono-aviso icono-error" aria-hidden="true">!</div>
        <h1 id="titulo-enlace" className="centro-texto">No pudimos confirmar con ese enlace</h1>
        <p className="centro-texto">{mensajeErrorEnlace(retorno.error.codigo)}</p>
        <p className="nota">
          Si ya habías tocado el enlace antes (o tu correo institucional lo «revisa» solo), es posible que la
          cuenta ya esté confirmada: probá <Link to="/login">ingresar</Link>. Si no, pedí un enlace nuevo.
        </p>
        <ReenviarConfirmacion />
        <p className="nota">Si estabas cambiando tu email desde Mi cuenta, volvé a pedir el cambio ahí.</p>
      </section>
    );
  }

  return (
    <section className="tarjeta auth-tarjeta" aria-labelledby="titulo-sin-sesion">
      <div className="icono-aviso" aria-hidden="true">✉</div>
      <h1 id="titulo-sin-sesion" className="centro-texto">Confirmación de cuenta</h1>
      <p>
        Esta página se abre desde el enlace del mail de registro. Si ya confirmaste tu cuenta,{' '}
        <Link to="/login">ingresá con tu email y contraseña</Link>.
      </p>
      <ReenviarConfirmacion />
    </section>
  );
}
