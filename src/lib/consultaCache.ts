// Concepto · Caché por clave, sin React Query: TTL, stale-while-revalidate,
// deduplicación de requests en vuelo e invalidación explícita. Tres lecturas
// (catálogo, Mis pedidos, admin) no justifican una librería extra.

export const FRESCO_MS = 30_000;

type Caja<T> = { data: T; at: number; persistir: boolean };

const memoria = new Map<string, Caja<unknown>>();
const vuelo = new Map<string, Promise<unknown>>();

function claveStorage(clave: string) {
  return `pp2-cache:${clave}`;
}

function hidratar<T>(clave: string): Caja<T> | null {
  const enMemoria = memoria.get(clave);
  if (enMemoria) return enMemoria as Caja<T>;
  try {
    const crudo = sessionStorage.getItem(claveStorage(clave));
    if (!crudo) return null;
    const caja = JSON.parse(crudo) as Caja<T>;
    if (!caja || typeof caja.at !== 'number') return null;
    memoria.set(clave, caja);
    return caja;
  } catch {
    return null;
  }
}

export function peek<T>(clave: string): Caja<T> | null {
  return hidratar<T>(clave);
}

export function esFresco(clave: string, ttl = FRESCO_MS): boolean {
  const caja = hidratar(clave);
  return !!caja && Date.now() - caja.at < ttl;
}

export function setCache<T>(clave: string, data: T, persistir = false) {
  const caja: Caja<T> = { data, at: Date.now(), persistir };
  memoria.set(clave, caja);
  if (!persistir) return;
  try {
    sessionStorage.setItem(claveStorage(clave), JSON.stringify(caja));
  } catch {
    /* modo privado */
  }
}

export function invalidar(clave: string) {
  memoria.delete(clave);
  vuelo.delete(clave);
  try { sessionStorage.removeItem(claveStorage(clave)); } catch { /* noop */ }
}

export function invalidarPrefijo(prefijo: string) {
  for (const clave of [...memoria.keys()]) {
    if (clave === prefijo || clave.startsWith(prefijo)) invalidar(clave);
  }
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(`pp2-cache:${prefijo}`)) sessionStorage.removeItem(k);
    }
  } catch { /* noop */ }
}

// Concepto · Si dos componentes piden la misma clave a la vez, sale 1 fetch.
export function consultar<T>(
  clave: string,
  fetcher: () => Promise<T>,
  persistir = false,
): Promise<T> {
  const pendiente = vuelo.get(clave);
  if (pendiente) return pendiente as Promise<T>;

  const promesa = fetcher()
    .then((data) => {
      setCache(clave, data, persistir);
      return data;
    })
    .finally(() => { vuelo.delete(clave); });

  vuelo.set(clave, promesa);
  return promesa;
}

export function prefetch<T>(clave: string, fetcher: () => Promise<T>, persistir = false) {
  if (esFresco(clave)) return;
  void consultar(clave, fetcher, persistir);
}
