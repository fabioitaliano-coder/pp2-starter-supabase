import { prefetchAdmin, prefetchCatalogo, prefetchMiCuenta, prefetchMisPedidos } from './consultas';
import { conRecarga } from './recargaChunk';

// Concepto · Las funciones de import() viven acá para que el Layout pueda
// pedir el chunk al pasar el mouse, sin un import circular con App.tsx.
// conRecarga(): si el chunk ya no existe (deploy nuevo), recarga la pestaña una vez.
export const cargarMisPedidos = conRecarga(() =>
  import('../features/client/MisPedidos').then((m) => ({ default: m.MisPedidos })));
export const cargarPanelAdmin = conRecarga(() =>
  import('../features/admin/PanelAdmin').then((m) => ({ default: m.PanelAdmin })));
export const cargarCheckout = conRecarga(() =>
  import('../features/checkout/Checkout').then((m) => ({ default: m.Checkout })));
export const cargarCompraConfirmada = conRecarga(() =>
  import('../features/checkout/CompraConfirmada').then((m) => ({ default: m.CompraConfirmada })));
export const cargarSeguimiento = conRecarga(() =>
  import('../features/client/SeguimientoPedido').then((m) => ({ default: m.SeguimientoPedido })));
export const cargarBuscarPedido = conRecarga(() =>
  import('../features/client/BuscarPedido').then((m) => ({ default: m.BuscarPedido })));
export const cargarFactura = conRecarga(() =>
  import('../features/client/Factura').then((m) => ({ default: m.Factura })));
export const cargarMiCuenta = conRecarga(() =>
  import('../features/client/MiCuenta').then((m) => ({ default: m.MiCuenta })));

export function prefetchRutaTienda() {
  prefetchCatalogo();
}

export function prefetchRutaMisPedidos() {
  void cargarMisPedidos();
  prefetchMisPedidos();
}

export function prefetchRutaMiCuenta(uid: string | undefined) {
  void cargarMiCuenta();
  prefetchMisPedidos();
  if (uid) prefetchMiCuenta(uid);
}

export function prefetchRutaCheckout(uid: string | undefined) {
  void cargarCheckout();
  if (uid) prefetchMiCuenta(uid);
}

export function prefetchRutaAdmin() {
  void cargarPanelAdmin();
  prefetchAdmin();
}
