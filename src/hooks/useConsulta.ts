import { useCallback, useEffect, useRef, useState } from 'react';
import { consultar, esFresco, peek } from '../lib/consultaCache';

// Concepto · Muestra lo cacheado al toque y refresca atrás si el dato ya no es fresco.
// Al volver el foco a la pestaña, solo refetch si pasó el TTL.
export function useConsulta<T>(
  clave: string | null,
  fetcher: () => Promise<T>,
  opciones?: { persistir?: boolean },
) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const persistir = opciones?.persistir ?? false;

  const inicial = clave ? peek<T>(clave)?.data ?? null : null;
  const [data, setData] = useState<T | null>(inicial);
  const [cargando, setCargando] = useState(clave !== null && inicial === null);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback((forzar = false) => {
    if (!clave) return Promise.resolve();
    const caja = peek<T>(clave);
    if (caja && !forzar && esFresco(clave)) {
      setData(caja.data);
      setCargando(false);
      setRefrescando(false);
      return Promise.resolve();
    }
    if (caja) {
      setData(caja.data);
      setCargando(false);
      setRefrescando(true);
    } else {
      setData(null);
      setCargando(true);
    }
    return consultar(clave, () => fetcherRef.current(), persistir)
      .then((fresco) => {
        setData(fresco);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!peek(clave)) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar.');
        }
      })
      .finally(() => {
        setCargando(false);
        setRefrescando(false);
      });
  }, [clave, persistir]);

  useEffect(() => {
    recargar(false);
  }, [recargar]);

  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState !== 'visible' || !clave) return;
      if (!esFresco(clave)) recargar(false);
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [clave, recargar]);

  return { data, cargando, refrescando, error, recargar };
}
