import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCartMeta } from '../context/CartContext';
import { prefetchRutaAdmin, prefetchRutaMiCuenta, prefetchRutaMisPedidos, prefetchRutaTienda } from '../lib/cargarRutas';

export function Layout() {
  const { user, role, signOut } = useAuth();
  const { cantidadTotal } = useCartMeta();
  return (
    <>
      <header className="barra">
        <Link to="/" className="marca" onMouseEnter={prefetchRutaTienda} onFocus={prefetchRutaTienda}>
          PP2 · Starter Supabase
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
      <main><Outlet /></main>
    </>
  );
}
