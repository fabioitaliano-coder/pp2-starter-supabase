import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { formatoPesos, type Producto } from '../../types';

interface LineaCarrito {
  producto: Producto;
  cantidad: number;
}

interface Props {
  onPedidoCreado: () => Promise<void> | void;
}

export function Catalogo({ onPedidoCreado }: Props) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [cargando, setCargando] = useState(true);

  const cargarProductos = async () => {
    const { data, error } = await supabase
      .from('productos')
      .select('id, nombre, descripcion, precio, stock, emoji, activo')
      .eq('activo', true)
      .order('nombre');
    if (error) setError('No se pudo cargar el catálogo.');
    else setProductos((data as Producto[]) ?? []);
    setCargando(false);
  };

  useEffect(() => { cargarProductos(); }, []);

  const total = useMemo(
    () => carrito.reduce((suma, linea) => suma + Number(linea.producto.precio) * linea.cantidad, 0),
    [carrito],
  );

  const agregar = (producto: Producto) => {
    const pedidas = cantidades[producto.id] ?? 1;
    if (!Number.isInteger(pedidas) || pedidas <= 0) {
      setError('Elegí una cantidad válida.');
      return;
    }
    const enCarrito = carrito.find((linea) => linea.producto.id === producto.id)?.cantidad ?? 0;
    if (enCarrito + pedidas > producto.stock) {
      setError(`Solo hay ${producto.stock} u. de ${producto.nombre}.`);
      return;
    }
    setError(null);
    setAviso(null);
    setCarrito((previas) => {
      const existente = previas.find((linea) => linea.producto.id === producto.id);
      if (!existente) return [...previas, { producto, cantidad: pedidas }];
      return previas.map((linea) =>
        linea.producto.id === producto.id
          ? { ...linea, cantidad: linea.cantidad + pedidas }
          : linea,
      );
    });
  };

  const cambiarCantidad = (id: string, cantidad: number) => {
    const producto = carrito.find((linea) => linea.producto.id === id)?.producto;
    if (!producto) return;
    if (cantidad <= 0) {
      setCarrito((previas) => previas.filter((linea) => linea.producto.id !== id));
      return;
    }
    if (cantidad > producto.stock) {
      setError(`Solo hay ${producto.stock} u. de ${producto.nombre}.`);
      return;
    }
    setError(null);
    setCarrito((previas) =>
      previas.map((linea) => (linea.producto.id === id ? { ...linea, cantidad } : linea)),
    );
  };

  const confirmar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando || carrito.length === 0) return;
    setEnviando(true);
    setError(null);
    setAviso(null);
    // Concepto · Mandamos solo producto y cantidad. El precio y el total los
    // calcula la base (trigger + crear_pedido); un total inventado en el cliente no cuenta.
    const { error } = await supabase.rpc('crear_pedido', {
      p_items: carrito.map((linea) => ({
        producto_id: linea.producto.id,
        cantidad: linea.cantidad,
      })),
    });
    if (error) {
      setError(error.message.includes('stock')
        ? error.message
        : 'No se pudo confirmar el pedido. Revisá el stock y volvé a intentar.');
    } else {
      setCarrito([]);
      setAviso('Pedido confirmado. Lo ves más abajo en tu historial.');
      await cargarProductos();
      await onPedidoCreado();
    }
    setEnviando(false);
  };

  return (
    <section className="compra" aria-labelledby="titulo-catalogo">
      <div>
        <h2 id="titulo-catalogo">Catálogo</h2>
        <p className="muted">Elegí artículos, armá el carrito y confirmá el pedido.</p>
        {cargando ? (
          <p className="muted" role="status">Cargando catálogo…</p>
        ) : productos.length === 0 ? (
          <p className="muted" role="status">No hay artículos en el catálogo.</p>
        ) : (
          <ul className="catalogo">
            {productos.map((producto) => {
              const sinStock = producto.stock <= 0;
              return (
                <li key={producto.id} className="producto">
                  <span className="emoji" aria-hidden="true">{producto.emoji}</span>
                  <div>
                    <strong>{producto.nombre}</strong>
                    {producto.descripcion && <p>{producto.descripcion}</p>}
                  </div>
                  <span className="precio">{formatoPesos(Number(producto.precio))}</span>
                  <span className="muted">{sinStock ? 'Sin stock' : `Stock: ${producto.stock}`}</span>
                  <footer>
                    <label>
                      Cantidad
                      <input
                        type="number"
                        min={1}
                        max={Math.max(producto.stock, 1)}
                        step={1}
                        value={cantidades[producto.id] ?? 1}
                        disabled={sinStock}
                        onChange={(e) => setCantidades((previas) => ({
                          ...previas,
                          [producto.id]: Number(e.target.value),
                        }))}
                      />
                    </label>
                    <button type="button" disabled={sinStock} onClick={() => agregar(producto)}>
                      Agregar
                    </button>
                  </footer>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <aside className="carrito" aria-labelledby="titulo-carrito">
        <h2 id="titulo-carrito">Carrito</h2>
        <form onSubmit={confirmar}>
          {carrito.length === 0 ? (
            <p className="muted">Todavía no agregaste nada.</p>
          ) : (
            <ol>
              {carrito.map((linea) => (
                <li key={linea.producto.id} className="carrito-linea">
                  <div>
                    <strong>{linea.producto.emoji} {linea.producto.nombre}</strong>
                    <p className="muted">{formatoPesos(Number(linea.producto.precio))} c/u</p>
                  </div>
                  <div className="cantidad">
                    <button
                      type="button"
                      className="secundario"
                      aria-label={`Quitar una unidad de ${linea.producto.nombre}`}
                      onClick={() => cambiarCantidad(linea.producto.id, linea.cantidad - 1)}
                    >
                      −
                    </button>
                    <span>{linea.cantidad}</span>
                    <button
                      type="button"
                      className="secundario"
                      aria-label={`Agregar una unidad de ${linea.producto.nombre}`}
                      onClick={() => cambiarCantidad(linea.producto.id, linea.cantidad + 1)}
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className="carrito-total">
            <span>Total</span>
            <span>{formatoPesos(total)}</span>
          </p>
          {error && <p role="alert" className="error">{error}</p>}
          {aviso && <p role="status" className="ok">{aviso}</p>}
          <button type="submit" disabled={enviando || carrito.length === 0}>
            {enviando ? 'Confirmando…' : 'Confirmar pedido'}
          </button>
        </form>
      </aside>
    </section>
  );
}
