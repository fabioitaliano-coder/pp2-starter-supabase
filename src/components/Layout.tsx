import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Layout() {
  const { user, role, signOut } = useAuth();
  return (
    <>
      <header className="barra">
        <div>
          <strong>PP2 · Starter Supabase</strong>
          <small>{user?.email} · rol: {role}</small>
        </div>
        <button onClick={signOut}>Cerrar sesión</button>
      </header>
      <main><Outlet /></main>
    </>
  );
}
