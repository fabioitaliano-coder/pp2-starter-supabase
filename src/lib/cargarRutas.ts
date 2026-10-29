import { prefetchAdmin, prefetchCatalogo, prefetchMisPedidos } from './consultas';

// Concepto · Las funciones de import() viven acá para que el Layout pueda
// pedir el chunk al pasar el mouse, sin un import circular con App.tsx.
export const cargarMisPedidos = () =>
  import('../features/client/MisPedidos').then((module) => ({ default: module.MisPedidos }));
export const cargarPanelAdmin = () =>
  import('../features/admin/PanelAdmin').then((module) => ({ default: module.PanelAdmin }));

export function prefetchRutaTienda() {
  prefetchCatalogo();
}

export function prefetchRutaMisPedidos() {
  void cargarMisPedidos();
  prefetchMisPedidos();
}

export function prefetchRutaAdmin() {
  void cargarPanelAdmin();
  prefetchAdmin();
}
