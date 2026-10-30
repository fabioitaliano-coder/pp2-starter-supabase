import type { Factura, Pedido } from '../types';

const moneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const ZONA = 'America/Argentina/Buenos_Aires';

export const dinero = (n: number | string) => moneda.format(Number(n));
export const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { timeZone: ZONA });
export const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', {
    timeZone: ZONA, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
export const soloFecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { timeZone: ZONA });

export const numeroPedido = (n: number | null | undefined) => (n ? `#${n}` : '—');

// Formato de comprobante argentino: punto de venta (4) - número (8).
export const numeroFactura = (f: Pick<Factura, 'punto_venta' | 'numero'>) =>
  `${String(f.punto_venta).padStart(4, '0')}-${String(f.numero).padStart(8, '0')}`;

export function facturaDe(p: Pick<Pedido, 'facturas'>): Factura | null {
  const f = p.facturas;
  if (!f) return null;
  return Array.isArray(f) ? f[0] ?? null : f;
}

export function domicilioEnvio(p: Pedido): string | null {
  const partes = [p.envio_calle, p.envio_piso_depto, p.envio_ciudad, p.envio_provincia, p.envio_cp]
    .filter(Boolean);
  return partes.length ? partes.join(', ') : null;
}
