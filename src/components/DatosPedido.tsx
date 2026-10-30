import { Link } from 'react-router-dom';
import { domicilioEnvio, facturaDe, numeroFactura, fechaCorta } from '../lib/formato';
import { METODO_PAGO_ETIQUETA, type Pedido } from '../types';

// Entrega, pago y factura de un pedido: confirmación y seguimiento usan el mismo bloque.
export function DatosPedido({ pedido }: { pedido: Pedido }) {
  const domicilio = domicilioEnvio(pedido);
  const factura = facturaDe(pedido);
  return (
    <section className="tarjeta datos-pedido" aria-label="Datos del pedido">
      <div>
        <h2>Entrega</h2>
        {domicilio ? (
          <p>
            <strong>{pedido.envio_nombre}</strong><br />{domicilio}
            {pedido.envio_telefono && <><br /><span className="nota">Tel.: {pedido.envio_telefono}</span></>}
            {pedido.envio_notas && <><br /><span className="nota">Indicaciones: {pedido.envio_notas}</span></>}
          </p>
        ) : (
          <p className="nota">Pedido de demostración sin domicilio cargado.</p>
        )}
      </div>
      <div>
        <h2>Pago</h2>
        <p>
          {pedido.pago_metodo ? METODO_PAGO_ETIQUETA[pedido.pago_metodo] : '—'}
          {pedido.pago_detalle && <><br /><span className="nota">{pedido.pago_detalle}</span></>}
        </p>
      </div>
      <div>
        <h2>Factura</h2>
        {factura ? (
          <p>
            Factura {factura.tipo} N.º {numeroFactura(factura)}<br />
            <span className="nota">Emitida el {fechaCorta(factura.emitida_at)}</span><br />
            <Link to={`/pedidos/${pedido.id}/factura`}>Ver e imprimir factura</Link>
          </p>
        ) : pedido.estado === 'cancelado' ? (
          <p className="nota">Pedido cancelado: no se factura.</p>
        ) : (
          <p className="nota">Se emite automáticamente cuando el pedido se confirma y se despacha.</p>
        )}
      </div>
    </section>
  );
}
