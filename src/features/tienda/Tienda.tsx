import { memo } from 'react';
import { Link } from 'react-router-dom';
import { useConsulta } from '../../hooks/useConsulta';
import { CLAVES, pedirCatalogo } from '../../lib/consultas';
import { useAuth } from '../../context/AuthContext';
import { useCartActions, useCartItems, useCartMeta } from '../../context/CartContext';
import { CartPanel } from '../../components/CartPanel';
import { EsqueletoCatalogo } from '../../components/Esqueleto';
import { dinero } from '../../lib/formato';
import type { Producto } from '../../types';

export function Tienda() {
  const { user, role } = useAuth();
  const { cantidadTotal } = useCartMeta();
  const { data: productos, cargando, refrescando, error } = useConsulta(
    CLAVES.catalogo,
    pedirCatalogo,
    { persistir: true },
  );
  const lista = productos ?? [];

  return (
    <div className="tienda-layout">
      <section>
        <div className="titulo-con-insignias">
          <h1>Productos</h1>
          <div className="insignias" aria-label="Estado de la tienda">
            <span className="insignia-estado">
              {cargando ? 'Cargando…' : `${lista.length} productos`}
            </span>
            {refrescando && <span className="insignia-estado">Actualizando…</span>}
            <span className="insignia-estado oscura">Sesión: {user ? (role ?? '…') : 'invitado'}</span>
            <span className="insignia-estado oscura">
              Carrito local: {cantidadTotal === 0 ? 'vacío' : `${cantidadTotal} ítem${cantidadTotal === 1 ? '' : 's'}`}
            </span>
          </div>
        </div>

        {error && <p role="alert" className="error">{error}</p>}
        {!cargando && !error && lista.length === 0 && <p>No hay productos para mostrar.</p>}

        <div className="grilla" aria-busy={cargando || refrescando}>
          {cargando && <EsqueletoCatalogo />}
          <GrillaProductos productos={lista} />
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

function GrillaProductos({ productos }: { productos: Producto[] }) {
  const items = useCartItems();
  const { agregar } = useCartActions();
  return (
    <>
      {productos.map((p) => (
        <TarjetaProducto
          key={p.id}
          producto={p}
          enCarrito={items.find((it) => it.producto_id === p.id)?.cantidad ?? 0}
          onAgregar={agregar}
        />
      ))}
    </>
  );
}

const TarjetaProducto = memo(function TarjetaProducto({
  producto: p,
  enCarrito,
  onAgregar,
}: {
  producto: Producto;
  enCarrito: number;
  onAgregar: (p: Producto) => void;
}) {
  const agotado = p.stock <= 0;
  const maximo = !agotado && enCarrito >= p.stock;
  return (
    <article className="tarjeta producto">
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
      <button className="comprar" onClick={() => onAgregar(p)} disabled={agotado || maximo}>
        {agotado ? 'Sin stock' : maximo ? 'Máximo en carrito' : 'Agregar al carrito'}
      </button>
    </article>
  );
});
