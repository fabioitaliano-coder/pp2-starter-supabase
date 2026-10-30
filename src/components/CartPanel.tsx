import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { prefetchRutaCheckout } from '../lib/cargarRutas';
import { dinero } from '../lib/formato';

export function CartPanel() {
  const { user } = useAuth();
  const { items, setCantidad, quitar, vaciar, subtotal, cantidadTotal } = useCart();
  const navigate = useNavigate();

  // Concepto · El carrito ya no crea el pedido: lleva al checkout por pasos (entrega,
  // pago simulado, revisión). Al pasar el mouse precargamos esa pantalla y tus datos.
  const irAPagar = () => {
    if (!user) { navigate('/login', { state: { from: '/checkout' } }); return; }
    navigate('/checkout');
  };
  const precargar = () => prefetchRutaCheckout(user?.id);

  return (
    <section className="tarjeta panel-carrito" aria-label="Carrito de compras">
      <div className="encabezado-panel">
        <div>
          <h2>Carrito</h2>
          <p className="nota">El carrito vive en este navegador. El pedido se guarda en Supabase al confirmar el checkout.</p>
        </div>
        <button type="button" className="secundario chico peligro" onClick={vaciar} disabled={items.length === 0}>
          Vaciar
        </button>
      </div>

      {items.length === 0 ? (
        <p className="vacio">Todavía no hay productos en el carrito.</p>
      ) : (
        <ul className="lineas">
          {items.map((i) => (
            <li key={i.producto_id}>
              <div>
                <strong>{i.emoji} {i.nombre}</strong>
                <span className="nota">{dinero(i.precio)} × {i.cantidad}</span>
                {/* Concepto · +/− tocan el estado local: no hay spinner ni espera de red. */}
                <div className="stepper" role="group" aria-label={`Cantidad de ${i.nombre}`}>
                  <button
                    type="button"
                    className="secundario chico"
                    aria-label="Quitar uno"
                    onClick={() => (i.cantidad > 1 ? setCantidad(i.producto_id, i.cantidad - 1) : quitar(i.producto_id))}
                  >
                    −
                  </button>
                  <span aria-live="polite">{i.cantidad}</span>
                  <button
                    type="button"
                    className="secundario chico"
                    aria-label="Agregar uno"
                    disabled={i.cantidad >= i.stock}
                    onClick={() => setCantidad(i.producto_id, i.cantidad + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="derecha">
                <strong>{dinero(i.precio * i.cantidad)}</strong>
                <button type="button" className="enlace peligro" onClick={() => quitar(i.producto_id)}>
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <dl className="totales">
        <dt>Ítems</dt><dd>{cantidadTotal}</dd>
        <dt>Subtotal</dt><dd>{dinero(subtotal)}</dd>
        <dt><strong>Total estimado</strong></dt><dd><strong>{dinero(subtotal)}</strong></dd>
      </dl>
      <p className="nota">El total final lo calcula el servidor al confirmar.</p>

      <button
        type="button"
        className="comprar-grande"
        onClick={irAPagar}
        onMouseEnter={precargar}
        onFocus={precargar}
        disabled={items.length === 0}
      >
        {user ? 'Ir a pagar' : 'Ingresar para comprar'}
      </button>
    </section>
  );
}
