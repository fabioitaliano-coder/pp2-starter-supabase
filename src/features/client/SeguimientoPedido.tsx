import { Link, useParams } from 'react-router-dom';
import { useConsulta } from '../../hooks/useConsulta';
import { CLAVES, pedirPedido } from '../../lib/consultas';
import { EstadoBadge } from '../../components/EstadoBadge';
import { LineaTiempo } from '../../components/LineaTiempo';
import { DatosPedido } from '../../components/DatosPedido';
import { ResumenCompra } from '../../components/ResumenCompra';
import { EsqueletoPedido } from '../../components/Esqueleto';
import { fecha, numeroPedido } from '../../lib/formato';

export function SeguimientoPedido() {
  const { id = '' } = useParams();
  const { data: pedido, cargando, refrescando, error, recargar } = useConsulta(
    CLAVES.pedido(id),
    () => pedirPedido(id),
  );

  if (cargando) return <EsqueletoPedido />;
  if (error || !pedido) {
    return (
      <section className="tarjeta centro" role="alert">
        <p>{error ?? 'No encontramos el pedido.'}</p>
        <Link to="/seguimiento" className="boton secundario">Buscar otro pedido</Link>
      </section>
    );
  }

  const lineas = (pedido.pedido_detalles ?? []).map((d) => ({
    clave: d.id, nombre: d.producto_nombre, cantidad: d.cantidad, precio: Number(d.precio_unitario),
  }));

  return (
    <div className="seguimiento">
      <nav className="migas" aria-label="Ubicación">
        <Link to="/mis-pedidos">Mis pedidos</Link> <span aria-hidden="true">›</span> Pedido {numeroPedido(pedido.numero)}
      </nav>
      <header className="seguimiento-encabezado">
        <div>
          <h1>Pedido {numeroPedido(pedido.numero)} <EstadoBadge estado={pedido.estado} /></h1>
          <p className="nota">Realizado el {fecha(pedido.created_at)}</p>
        </div>
        <div className="acciones">
          <button type="button" className="secundario" onClick={() => recargar(true)} disabled={refrescando} aria-busy={refrescando}>
            {refrescando ? 'Actualizando…' : 'Actualizar estado'}
          </button>
          <Link to="/" className="boton">Seguir comprando</Link>
        </div>
      </header>

      <div className="seguimiento-grilla">
        <section className="tarjeta" aria-labelledby="titulo-estado">
          <h2 id="titulo-estado">Estado del envío</h2>
          <LineaTiempo pedido={pedido} />
        </section>
        <ResumenCompra lineas={lineas} total={Number(pedido.total)} titulo="Artículos" />
      </div>
      <DatosPedido pedido={pedido} />
    </div>
  );
}
