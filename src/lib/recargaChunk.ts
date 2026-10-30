// Concepto · Después de un deploy, una pestaña abierta todavía conoce los nombres de
// los chunks viejos (index-abc123.js). Esos archivos ya no existen: al navegar a una
// ruta lazy, el import() falla. Recargamos UNA vez para bajar el index.html nuevo.
// El guard en sessionStorage evita un bucle si el problema es otro (sin red, etc.).
const CLAVE = 'pp2-recarga-chunk';
const VENTANA_MS = 10_000;

export function recargarUnaVez(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE) ?? 0);
    if (Date.now() - ultima < VENTANA_MS) return false;
    sessionStorage.setItem(CLAVE, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

// Envuelve un import() dinámico: si falla, intenta recargar; si no puede, propaga el error
// (lo atrapa LimiteError y muestra un mensaje con botón para recargar).
export function conRecarga<T>(importar: () => Promise<T>): () => Promise<T> {
  return () =>
    importar().catch((error: unknown) => {
      if (recargarUnaVez()) return new Promise<T>(() => {});
      throw error;
    });
}
