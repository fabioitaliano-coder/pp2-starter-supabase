import { dinero } from '../lib/formato';
import type { PedidoDetalle } from '../types';

export function ListaArticulos({ items }: { items: PedidoDetalle[] | undefined }) {
  if (!items || items.length === 0) {
    return <span className="nota">Sin artículos</span>;
  }

  return (
    <ul className="detalle">
      {items.map((item) => (
        <li key={item.id}>
          {item.cantidad} × {item.producto_nombre} — {dinero(item.precio_unitario)} c/u
        </li>
      ))}
    </ul>
  );
}
