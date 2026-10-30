import { Link, useParams } from 'react-router-dom';
import { useConsulta } from '../../hooks/useConsulta';
import { CLAVES, pedirPedido } from '../../lib/consultas';
import { ResumenCompra } from '../../components/ResumenCompra';
import { DatosPedido } from '../../components/DatosPedido';
import { EsqueletoPedido } from '../../components/Esqueleto';
import { numeroPedido } from '../../lib/formato';

export function CompraConfirmada() {
  const { id = '' } = useParams();
  const { data: pedido, cargando, error } = useConsulta(CLAVES.pedido(id), () => pedirPedido(id));

  if (cargando) return <EsqueletoPedido />;
  if (error || !pedido) {
    return (
      <section className="tarjeta centro" role="alert">
        <p>{error ?? 'No encontramos el pedido.'}</p>
        <Link to="/mis-pedidos" className="boton secundario">Ir a Mis pedidos</Link>
      </section>
    );
  }

  const lineas = (pedido.pedido_detalles ?? []).map((d) => ({
    clave: d.id, nombre: d.producto_nombre, cantidad: d.cantidad, precio: Number(d.precio_unitario),
  }));
  const nombre = pedido.envio_nombre?.split(' ')[0];

  return (
    <div className="confirmacion">
      <section className="tarjeta exito-hero" role="status">
        <span className="check-grande" aria-hidden="true">✓</span>
        <h1>¡Gracias{nombre ? `, ${nombre}` : ''}! Recibimos tu pedido</h1>
        <p className="numero-pedido">Pedido <strong>{numeroPedido(pedido.numero)}</strong></p>
        <p className="vacio">
          Guardá este número para seguirlo. Te avisamos cada cambio de estado en la página de seguimiento.
          La factura se emite cuando confirmamos el pago y despachamos el paquete.
        </p>
        <div className="acciones">
          <Link to="/" className="boton">Seguir comprando</Link>
          <Link to={`/pedidos/${pedido.id}`} className="boton secundario">Seguir mi pedido</Link>
        </div>
      </section>

      <div className="confirmacion-grilla">
        <DatosPedido pedido={pedido} />
        <ResumenCompra lineas={lineas} total={Number(pedido.total)} titulo="Lo que compraste"
          notaTotal="Importe calculado por el servidor (crear_pedido)." />
      </div>
    </div>
  );
}
