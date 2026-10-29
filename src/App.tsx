import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginForm } from './features/auth/LoginForm';
import { RegisterForm } from './features/auth/RegisterForm';

const MisPedidos = lazy(() =>
  import('./features/client/MisPedidos').then((module) => ({ default: module.MisPedidos })),
);
const PanelAdmin = lazy(() =>
  import('./features/admin/PanelAdmin').then((module) => ({ default: module.PanelAdmin })),
);

function Inicio() {
  const { user, role, loading } = useAuth();
  if (loading) return <p className="centro">Cargando…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={role === 'admin' ? '/admin' : '/cliente'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<p className="centro" role="status">Cargando pantalla…</p>}>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/login" element={<LoginForm />} />
            <Route path="/registro" element={<RegisterForm />} />
            <Route path="/unauthorized" element={<p className="centro">No tenés permiso para ver esta página.</p>} />
            {/* Este guard exterior exige sesión; sus rutas hijas quedan protegidas. */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                {/* Estos guards interiores agregan autorización por rol a cada sección. */}
                <Route element={<ProtectedRoute allowedRoles={['cliente']} />}>
                  <Route path="/cliente" element={<MisPedidos />} />
                </Route>
                <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                  <Route path="/admin" element={<PanelAdmin />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<p className="centro">Página no encontrada.</p>} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
