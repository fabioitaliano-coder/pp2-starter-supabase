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
import { LimiteError } from './components/LimiteError';
import {
  cargarBuscarPedido, cargarCheckout, cargarCompraConfirmada, cargarFactura,
  cargarMiCuenta, cargarMisPedidos, cargarPanelAdmin, cargarSeguimiento,
} from './lib/cargarRutas';

// Concepto · React.lazy: Administración (y Mis pedidos) no viajan en el JS inicial.
// El chunk se baja al entrar a la ruta, o antes si el Layout hace prefetch al pasar el mouse.
const MisPedidos = lazy(cargarMisPedidos);
const PanelAdmin = lazy(cargarPanelAdmin);
const Checkout = lazy(cargarCheckout);
const CompraConfirmada = lazy(cargarCompraConfirmada);
const SeguimientoPedido = lazy(cargarSeguimiento);
const BuscarPedido = lazy(cargarBuscarPedido);
const Factura = lazy(cargarFactura);
const MiCuenta = lazy(cargarMiCuenta);

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          {/* Si un chunk viejo falla (deploy nuevo), LimiteError ofrece recargar en vez de pantalla en blanco. */}
          <LimiteError>
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
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/checkout/listo/:id" element={<CompraConfirmada />} />
                  <Route path="/seguimiento" element={<BuscarPedido />} />
                  <Route path="/pedidos/:id" element={<SeguimientoPedido />} />
                  <Route path="/pedidos/:id/factura" element={<Factura />} />
                  <Route path="/cuenta" element={<MiCuenta />} />
                </Route>
                <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                  <Route path="/admin" element={<PanelAdmin />} />
                </Route>
                <Route path="*" element={<p className="centro">Página no encontrada.</p>} />
              </Route>
            </Routes>
          </Suspense>
          </LimiteError>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
