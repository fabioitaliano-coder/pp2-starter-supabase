import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { invalidarTrasCompra } from '../lib/consultas';
import { dinero } from '../lib/formato';

export function CartPanel() {
  const { user } = useAuth();
  const { items, setCantidad, quitar, vaciar, subtotal, cantidadTotal } = useCart();
  const navigate = useNavigate();
  const [aviso, setAviso] = useState<{ tipo: 'error' | 'info'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    if (enviando) return;
    if (!user) { navigate('/login', { state: { from: '/carrito' } }); return; }
    setEnviando(true);
    setAviso(null);
    // Concepto · Solo viajan producto_id y cantidad. Precio y stock los calcula crear_pedido().
    const { error } = await supabase.rpc('crear_pedido', {
      p_items: items.map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
    });
    if (error) {
      setAviso({
        tipo: 'error',
        texto: error.code === 'P0002'
          ? 'Algún producto de tu carrito ya no está disponible. Quitalo o vaciá el carrito y volvé a elegir.'
          : error.message || 'No se pudo completar la compra.',
      });
      setEnviando(false);
      return;
    }
    invalidarTrasCompra();
    vaciar();
    // Feedback al terminar: Mis pedidos muestra el aviso de compra realizada.
    navigate('/mis-pedidos', { state: { creado: true } });
  };

  return (
    <section className="tarjeta panel-carrito" aria-label="Carrito de compras">
      <div className="encabezado-panel">
        <div>
          <h2>Carrito</h2>
          <p className="nota">El carrito vive en este navegador. El pedido se guarda en Supabase al confirmar.</p>
        </div>
        <button type="button" className="secundario chico peligro" onClick={vaciar} disabled={items.length === 0 || enviando}>
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
                    disabled={enviando}
                    onClick={() => (i.cantidad > 1 ? setCantidad(i.producto_id, i.cantidad - 1) : quitar(i.producto_id))}
                  >
                    −
                  </button>
                  <span aria-live="polite">{i.cantidad}</span>
                  <button
                    type="button"
                    className="secundario chico"
                    aria-label="Agregar uno"
                    disabled={enviando || i.cantidad >= i.stock}
                    onClick={() => setCantidad(i.producto_id, i.cantidad + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="derecha">
                <strong>{dinero(i.precio * i.cantidad)}</strong>
                <button type="button" className="enlace peligro" onClick={() => quitar(i.producto_id)} disabled={enviando}>
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

      {aviso && <p role="alert" className={`alerta ${aviso.tipo}`}>{aviso.texto}</p>}
      {/* Concepto · Durante el RPC el botón se bloquea con spinner: evita doble envío y muestra que hay espera real. */}
      <button
        type="button"
        className="comprar-grande"
        onClick={confirmar}
        disabled={enviando || items.length === 0}
        aria-busy={enviando}
      >
        {enviando ? (
          <>
            <span className="giro" aria-hidden="true" />
            Enviando…
          </>
        ) : user ? 'Confirmar compra' : 'Ingresar para comprar'}
      </button>
    </section>
  );
}
