import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { cargarMisPedidos, cargarPanelAdmin } from '../lib/cargarRutas';

export function Layout() {
  const { user, role, signOut } = useAuth();
  const { cantidadTotal } = useCart();
  return (
    <>
      <header className="barra">
        <Link to="/" className="marca">PP2 · Starter Supabase</Link>
        <nav aria-label="Principal">
          <NavLink to="/" end>Tienda</NavLink>
          <NavLink to="/carrito">
            Carrito{cantidadTotal > 0 && <span className="insignia">{cantidadTotal}</span>}
          </NavLink>
          {user && (
            <NavLink to="/mis-pedidos" onMouseEnter={() => { void cargarMisPedidos(); }} onFocus={() => { void cargarMisPedidos(); }}>
              Mis pedidos
            </NavLink>
          )}
          {role === 'admin' && (
            <NavLink to="/admin" onMouseEnter={() => { void cargarPanelAdmin(); }} onFocus={() => { void cargarPanelAdmin(); }}>
              Administración
            </NavLink>
          )}
        </nav>
        <div className="sesion">
          {user ? (
            <>
              <small>{user.email}{role ? ` · ${role}` : ''}</small>
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
