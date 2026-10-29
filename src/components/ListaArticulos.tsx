import { formatoPesos, type PedidoDetalle } from '../types';

export function ListaArticulos({ items }: { items: PedidoDetalle[] | undefined }) {
  if (!items || items.length === 0) {
    return <span className="muted">Sin artículos</span>;
  }

  return (
    <ul className="articulos">
      {items.map((item) => (
        <li key={item.id}>
          <span className="nombre">{item.nombre} × {item.cantidad}</span>
          <span className="importe">{formatoPesos(Number(item.precio_unitario) * item.cantidad)}</span>
        </li>
      ))}
    </ul>
  );
}
