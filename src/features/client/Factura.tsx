import { Link, useParams } from 'react-router-dom';
import { useConsulta } from '../../hooks/useConsulta';
import { CLAVES, pedirPedido } from '../../lib/consultas';
import { EsqueletoPedido } from '../../components/Esqueleto';
import { dinero, facturaDe, numeroFactura, numeroPedido, soloFecha } from '../../lib/formato';
import { METODO_PAGO_ETIQUETA } from '../../types';

// Comprobante SIMULADO para imprimir (Ctrl/Cmd + P o el botón). Los datos vienen de la
// fila de public.facturas, que solo la base puede crear (trigger al despachar).
export function Factura() {
  const { id = '' } = useParams();
  const { data: pedido, cargando, error } = useConsulta(CLAVES.pedido(id), () => pedirPedido(id));

  if (cargando) return <EsqueletoPedido />;
  const factura = pedido ? facturaDe(pedido) : null;
  if (error || !pedido || !factura) {
    return (
      <section className="tarjeta centro" role="alert">
        <p>{error ?? 'Este pedido todavía no tiene factura. Se emite al confirmarlo y despacharlo.'}</p>
        <Link to={`/pedidos/${id}`} className="boton secundario">Volver al seguimiento</Link>
      </section>
    );
  }

  return (
    <div className="factura-pagina">
      <div className="acciones no-imprimir">
        <Link to={`/pedidos/${pedido.id}`} className="enlace-azul">← Volver al pedido</Link>
        <button type="button" onClick={() => window.print()}>Imprimir / guardar PDF</button>
      </div>

      <article className="factura" aria-label={`Factura ${numeroFactura(factura)}`}>
        <p className="marca-agua" aria-hidden="true">SIMULADA</p>
        <header className="factura-cabecera">
          <div>
            <h1>Tienda Demo PP2</h1>
            <p className="nota">Razón social ficticia · CUIT 30-00000000-0 (ficticio)<br />IVA Responsable Inscripto (ficticio)</p>
          </div>
          <div className="factura-tipo" aria-label={`Factura tipo ${factura.tipo}`}>{factura.tipo}</div>
          <div className="factura-datos">
            <h2>Factura</h2>
            <p>N.º <strong>{numeroFactura(factura)}</strong></p>
            <p>Fecha: {soloFecha(factura.emitida_at)}</p>
            <p>Pedido: {numeroPedido(pedido.numero)}</p>
          </div>
        </header>

        <section className="factura-cliente">
          <p><strong>Cliente:</strong> {factura.cliente_nombre}</p>
          {factura.cliente_documento && <p><strong>DNI/CUIT:</strong> {factura.cliente_documento}</p>}
          <p><strong>Condición frente al IVA:</strong> Consumidor final</p>
          {factura.cliente_domicilio && <p><strong>Domicilio:</strong> {factura.cliente_domicilio}</p>}
          {factura.cliente_email && <p><strong>Email:</strong> {factura.cliente_email}</p>}
          <p><strong>Forma de pago:</strong> {pedido.pago_metodo ? METODO_PAGO_ETIQUETA[pedido.pago_metodo] : '—'}</p>
        </section>

        <table className="factura-items">
          <thead>
            <tr><th>Cant.</th><th>Descripción</th><th className="num">P. unitario</th><th className="num">Importe</th></tr>
          </thead>
          <tbody>
            {(pedido.pedido_detalles ?? []).map((d) => (
              <tr key={d.id}>
                <td>{d.cantidad}</td>
                <td>{d.producto_nombre}</td>
                <td className="num">{dinero(d.precio_unitario)}</td>
                <td className="num">{dinero(Number(d.precio_unitario) * d.cantidad)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="totales factura-totales">
          <dt>Envío</dt><dd>{dinero(0)}</dd>
          <dt className="total-final">Total</dt><dd className="total-final">{dinero(factura.total ?? pedido.total)}</dd>
          <dt>IVA contenido (21 %)</dt><dd>{dinero(factura.iva_contenido ?? 0)}</dd>
        </dl>

        <footer className="factura-pie">
          Comprobante <strong>simulado</strong> con fines educativos (PP2 · IFTS 16). No tiene validez fiscal,
          no tiene CAE y no se informa a ARCA. Emitido automáticamente por la base de datos al despachar el pedido.
        </footer>
      </article>
    </div>
  );
}
