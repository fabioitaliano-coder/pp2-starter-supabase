import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginForm } from './features/auth/LoginForm';
import { RegisterForm } from './features/auth/RegisterForm';
import { MisPedidos } from './features/client/MisPedidos';
import { PanelAdmin } from './features/admin/PanelAdmin';

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
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/login" element={<LoginForm />} />
          <Route path="/registro" element={<RegisterForm />} />
          <Route path="/unauthorized" element={<p className="centro">No tenés permiso para ver esta página.</p>} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
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
      </BrowserRouter>
    </AuthProvider>
  );
}
