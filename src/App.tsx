import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginForm } from './features/auth/LoginForm';
import { RegisterForm } from './features/auth/RegisterForm';
import { Tienda } from './features/tienda/Tienda';
import { Carrito } from './features/tienda/Carrito';

const MisPedidos = lazy(() =>
  import('./features/client/MisPedidos').then((module) => ({ default: module.MisPedidos })),
);
const PanelAdmin = lazy(() =>
  import('./features/admin/PanelAdmin').then((module) => ({ default: module.PanelAdmin })),
);

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Suspense fallback={<p className="centro" role="status">Cargando pantalla…</p>}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Tienda />} />
                <Route path="/carrito" element={<Carrito />} />
                <Route path="/login" element={<LoginForm />} />
                <Route path="/registro" element={<RegisterForm />} />
                <Route path="/unauthorized" element={<p className="centro">No tenés permiso para ver esta página.</p>} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/mis-pedidos" element={<MisPedidos />} />
                </Route>
                <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                  <Route path="/admin" element={<PanelAdmin />} />
                </Route>
                <Route path="*" element={<p className="centro">Página no encontrada.</p>} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
