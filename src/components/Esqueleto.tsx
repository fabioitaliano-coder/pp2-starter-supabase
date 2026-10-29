// Concepto · Un esqueleto ocupa el lugar del contenido real: la página no queda
// en blanco con "Cargando…" y se percibe más rápida aunque la red tarde.

export function EsqueletoCatalogo({ cantidad = 8 }: { cantidad?: number }) {
  return (
    <>
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i} className="tarjeta producto esqueleto" aria-hidden="true">
          <div className="foto bloque" />
          <div className="bloque corto" />
          <div className="bloque" />
          <div className="bloque boton" />
        </div>
      ))}
    </>
  );
}

export function EsqueletoFilas({ columnas, filas = 6 }: { columnas: number; filas?: number }) {
  return (
    <>
      {Array.from({ length: filas }, (_, i) => (
        <tr key={i} className="esqueleto" aria-hidden="true">
          {Array.from({ length: columnas }, (_, j) => (
            <td key={j}><div className="bloque" /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function EsqueletoResumen({ cantidad = 4 }: { cantidad?: number }) {
  return (
    <ul className="resumen" aria-hidden="true">
      {Array.from({ length: cantidad }, (_, i) => (
        <li key={i} className="esqueleto">
          <div className="bloque corto" />
          <div className="bloque" />
        </li>
      ))}
    </ul>
  );
}
