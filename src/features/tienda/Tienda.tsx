import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { leerCatalogo, guardarCatalogo } from '../../lib/catalogoCache';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { CartPanel } from '../../components/CartPanel';
import { EsqueletoCatalogo } from '../../components/Esqueleto';
import { dinero } from '../../lib/formato';
import type { Producto } from '../../types';

const COLUMNAS_CATALOGO = 'id, nombre, descripcion, precio, stock, emoji, activo';

export function Tienda() {
  const { user, role } = useAuth();
  const { items, agregar, cantidadTotal } = useCart();
  const cache = leerCatalogo();
  const [productos, setProductos] = useState<Producto[]>(cache ?? []);
  const [cargando, setCargando] = useState(cache === null);
  const [refrescando, setRefrescando] = useState(cache !== null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    // Concepto · Si hay caché se muestran ya las tarjetas; el SELECT corre igual
    // y reemplaza los datos cuando llega (stale-while-revalidate).
    supabase
      .from('productos')
      .select(COLUMNAS_CATALOGO)
      .eq('activo', true)
      .order('nombre')
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) {
          if (!leerCatalogo()) {
            setError('No se pudieron cargar los productos. Probá de nuevo en unos segundos.');
          }
        } else {
          const lista = (data as Producto[]) ?? [];
          setProductos(lista);
          guardarCatalogo(lista);
          setError(null);
        }
        setCargando(false);
        setRefrescando(false);
      });
    return () => { vivo = false; };
  }, []);

  return (
    <div className="tienda-layout">
      <section>
        <div className="titulo-con-insignias">
          <h1>Productos</h1>
          <div className="insignias" aria-label="Estado de la tienda">
            {/* La insignia usa productos.length: siempre coincide con las tarjetas visibles. */}
            <span className="insignia-estado">
              {cargando ? 'Cargando…' : `${productos.length} productos`}
            </span>
            {refrescando && <span className="insignia-estado">Actualizando…</span>}
            <span className="insignia-estado oscura">Sesión: {user ? (role ?? '…') : 'invitado'}</span>
            <span className="insignia-estado oscura">
              Carrito local: {cantidadTotal === 0 ? 'vacío' : `${cantidadTotal} ítem${cantidadTotal === 1 ? '' : 's'}`}
            </span>
          </div>
        </div>

        {error && <p role="alert" className="error">{error}</p>}
        {!cargando && !error && productos.length === 0 && <p>No hay productos para mostrar.</p>}

        <div className="grilla" aria-busy={cargando || refrescando}>
          {cargando && <EsqueletoCatalogo />}
          {productos.map((p) => {
            const enCarrito = items.find((it) => it.producto_id === p.id)?.cantidad ?? 0;
            const agotado = p.stock <= 0;
            const maximo = !agotado && enCarrito >= p.stock;
            return (
              <article key={p.id} className="tarjeta producto">
                <div className="marco">
                  <div className="ilustracion" aria-hidden="true">{p.emoji}</div>
                  {enCarrito > 0 && <span className="en-carrito">{enCarrito} en carrito</span>}
                </div>
                <div className="insignias-tarjeta">
                  <span className={`insignia-stock ${agotado ? 'agotado' : p.stock <= 5 ? 'poco' : 'ok'}`}>
                    {agotado ? 'Sin stock' : p.stock <= 5 ? `Últimas ${p.stock}` : `Stock: ${p.stock}`}
                  </span>
                </div>
                <h2>{p.nombre}</h2>
                {p.descripcion && <p className="descripcion">{p.descripcion}</p>}
                <p className="precio">{dinero(p.precio)}</p>
                {/* Concepto · agregar() es local: el botón responde al toque, sin esperar a la red. */}
                <button className="comprar" onClick={() => agregar(p)} disabled={agotado || maximo}>
                  {agotado ? 'Sin stock' : maximo ? 'Máximo en carrito' : 'Agregar al carrito'}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <aside className="carrito-lateral"><CartPanel /></aside>
      {cantidadTotal > 0 && (
        <Link to="/carrito" className="barra-carrito">
          Ver carrito · {cantidadTotal} ítem{cantidadTotal === 1 ? '' : 's'}
        </Link>
      )}
    </div>
  );
}
