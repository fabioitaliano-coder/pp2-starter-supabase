import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Rol } from '../types';

// Concepto · Este componente funciona como guard de navegación (a veces llamado
// "middleware" en el frontend): envuelve rutas anidadas y decide si se muestran.
// Mejora la experiencia, pero NO es seguridad: se puede omitir desde el navegador.
// Las políticas RLS de Supabase son la barrera real para proteger los datos.
export function ProtectedRoute({ allowedRoles }: { allowedRoles?: Rol[] }) {
  const { user, role, loading, authError } = useAuth();

  // El contexto todavía está leyendo la sesión o el perfil: no redirigir antes de tiempo.
  if (loading) return <p className="centro">Verificando credenciales…</p>;
  if (authError) return <p className="centro error" role="alert">{authError}</p>;
  // Sin sesión, se pide iniciar sesión; "replace" evita volver a la ruta privada con Atrás.
  if (!user) return <Navigate to="/login" replace />;

  // allowedRoles es opcional: si no se indica, cualquier usuario autenticado puede pasar.
  // Si se indica, un rol ausente o que no está en la lista no debe acceder.
  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Outlet renderiza aquí la ruta hija que se declaró dentro de este guard en App.tsx.
  return <Outlet />;
}
