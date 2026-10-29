import type { Producto } from '../types';

const CLAVE = 'catalogo-pp2-starter';

let memoria: Producto[] | null = null;

function esCatalogo(valor: unknown): valor is Producto[] {
  return Array.isArray(valor) && valor.every((p) => p && typeof p === 'object' && 'id' in p && 'nombre' in p);
}

// Concepto · Caché stale-while-revalidate: se muestra lo último conocido (memoria o
// sessionStorage) y se pide el catálogo fresco en segundo plano. Sin React Query.
export function leerCatalogo(): Producto[] | null {
  if (memoria) return memoria;
  try {
    const crudo = sessionStorage.getItem(CLAVE);
    if (!crudo) return null;
    const data: unknown = JSON.parse(crudo);
    if (!esCatalogo(data)) return null;
    memoria = data;
    return data;
  } catch {
    return null;
  }
}

export function guardarCatalogo(productos: Producto[]) {
  memoria = productos;
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(productos));
  } catch {
    /* modo privado: alcanza con el caché en memoria */
  }
}
