import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCartMeta } from '../context/CartContext';
import { hayRetornoPendiente, RUTA_CONFIRMACION } from '../lib/retornoAuth';
import { prefetchRutaAdmin, prefetchRutaMiCuenta, prefetchRutaMisPedidos, prefetchRutaTienda } from '../lib/cargarRutas';

export function Layout() {
  const { user, role, signOut } = useAuth();
  const { cantidadTotal } = useCartMeta();
  const location = useLocation();
  const navigate = useNavigate();
  const aviso = (location.state as { aviso?: string } | null)?.aviso;

  // Concepto · Si el enlace del mail volvió a otra ruta (por ejemplo a la Site URL "/",
  // porque /auth/confirmado no estaba en Redirect URLs), igual lo llevamos a la pantalla
  // de confirmación. Se evalúa una sola vez, al montar.
  useEffect(() => {
    if (hayRetornoPendiente() && location.pathname !== RUTA_CONFIRMACION) {
      navigate(RUTA_CONFIRMACION, { replace: true });
    }
  }, []);

  const cerrarAviso = () => navigate(location.pathname, { replace: true, state: null });

  return (
    <>
      <header className="barra">
        <Link to="/" className="marca" onMouseEnter={prefetchRutaTienda} onFocus={prefetchRutaTienda}>
          E-Commerce PP2
        </Link>
        <nav aria-label="Principal">
          <NavLink to="/" end onMouseEnter={prefetchRutaTienda} onFocus={prefetchRutaTienda}>Tienda</NavLink>
          <NavLink to="/carrito">
            Carrito{cantidadTotal > 0 && <span className="insignia">{cantidadTotal}</span>}
          </NavLink>
          {user && (
            <NavLink to="/mis-pedidos" onMouseEnter={prefetchRutaMisPedidos} onFocus={prefetchRutaMisPedidos}>
              Mis pedidos
            </NavLink>
          )}
          {user && (
            <NavLink to="/cuenta" onMouseEnter={() => prefetchRutaMiCuenta(user.id)} onFocus={() => prefetchRutaMiCuenta(user.id)}>
              Mi cuenta
            </NavLink>
          )}
          {role === 'admin' && (
            <NavLink to="/admin" onMouseEnter={prefetchRutaAdmin} onFocus={prefetchRutaAdmin}>
              Administración
            </NavLink>
          )}
        </nav>
        <div className="sesion">
          {user ? (
            <>
              <small className="sesion-email">{user.email}{role ? ` · ${role}` : ''}</small>
              <button type="button" className="secundario" onClick={signOut}>Salir</button>
            </>
          ) : (
            <Link to="/login" className="boton secundario">Ingresar</Link>
          )}
        </div>
      </header>
      <main>
        {aviso === 'cuenta-confirmada' && user && (
          <div className="aviso-banda" role="status">
            <span><strong>✓ Cuenta confirmada.</strong> Ya ingresaste como {user.email}.</span>
            <button type="button" className="enlace-azul" onClick={cerrarAviso}>Cerrar</button>
          </div>
        )}
        <Outlet />
      </main>
    </>
  );
}
