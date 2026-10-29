import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Rol } from '../types';

// Concepto · Este componente funciona como guard de navegación (a veces llamado
// "middleware" en el frontend): envuelve rutas anidadas y decide si se muestran.
// Mejora la experiencia, pero NO es seguridad: se puede omitir desde el navegador.
// Las políticas RLS de Supabase son la barrera real para proteger los datos.
export function ProtectedRoute({ allowedRoles }: { allowedRoles?: Rol[] }) {
  const { user, role, loading, authError } = useAuth();
  const location = useLocation();

  if (loading) return <p className="centro">Verificando credenciales…</p>;
  if (authError) return <p className="centro error" role="alert">{authError}</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
