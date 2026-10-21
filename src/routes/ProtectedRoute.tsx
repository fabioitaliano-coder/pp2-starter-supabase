import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Rol } from '../types';

// Concepto · Capa 1 de "middleware": guarda de navegación. Mejora la experiencia,
// pero NO es seguridad: quien manipule el navegador la saltea. La barrera real es RLS.
export function ProtectedRoute({ allowedRoles }: { allowedRoles?: Rol[] }) {
  const { user, role, loading } = useAuth();

  if (loading) return <p className="centro">Verificando credenciales…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && role && !allowedRoles.includes(role)) return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
}
