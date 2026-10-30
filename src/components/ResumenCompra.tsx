import type { ReactNode } from 'react';
import { dinero } from '../lib/formato';

export interface LineaResumen {
  clave: string;
  nombre: string;
  cantidad: number;
  precio: number;
  emoji?: string;
}

// Resumen del pedido: el mismo componente en el checkout (desde el carrito local)
// y en la confirmación / seguimiento (desde pedido_detalles guardados en la base).
export function ResumenCompra({
  lineas, total, titulo = 'Resumen del pedido', notaTotal, children,
}: {
  lineas: LineaResumen[];
  total: number;
  titulo?: string;
  notaTotal?: string;
  children?: ReactNode;
}) {
  const unidades = lineas.reduce((n, l) => n + l.cantidad, 0);
  return (
    <section className="tarjeta resumen-compra" aria-label={titulo}>
      <h2>{titulo}</h2>
      <ul className="resumen-lineas">
        {lineas.map((l) => (
          <li key={l.clave}>
            <span className="miniatura" aria-hidden="true">{l.emoji ?? '📦'}</span>
            <span className="resumen-nombre">
              {l.nombre}
              <small className="nota">{l.cantidad} × {dinero(l.precio)}</small>
            </span>
            <strong>{dinero(l.precio * l.cantidad)}</strong>
          </li>
        ))}
      </ul>
      <dl className="totales">
        <dt>Subtotal ({unidades} {unidades === 1 ? 'unidad' : 'unidades'})</dt><dd>{dinero(total)}</dd>
        <dt>Envío</dt><dd className="gratis">Gratis</dd>
        <dt className="total-final">Total</dt><dd className="total-final">{dinero(total)}</dd>
      </dl>
      {notaTotal && <p className="nota">{notaTotal}</p>}
      {children}
    </section>
  );
}
