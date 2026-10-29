import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PaginationControls } from '../../components/PaginationControls';
import { EstadoBadge } from '../../components/EstadoBadge';
import { ListaArticulos } from '../../components/ListaArticulos';
import { Catalogo } from './Catalogo';
import { formatoFecha, formatoPesos, type Pedido } from '../../types';

const POR_PAGINA = 10;

export function MisPedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    // Concepto · Acá NO hay .eq('user_id', ...): RLS ya devuelve solo los pedidos del usuario.
    // Paginación: .range() es inclusivo en ambos extremos y { count: 'exact' } trae el total.
    const desde = (pagina - 1) * POR_PAGINA;
    const { data, count, error } = await supabase
      .from('pedidos')
      .select('*, pedido_detalles(id, pedido_id, producto_id, nombre, cantidad, precio_unitario)', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(desde, desde + POR_PAGINA - 1);
    if (error) setError('No se pudieron cargar los pedidos.');
    else { setPedidos((data as Pedido[]) ?? []); setTotal(count ?? 0); }
  }, [pagina]);

  useEffect(() => { cargar(); }, [cargar]);

  const onPedidoCreado = async () => {
    setError(null);
    if (pagina === 1) await cargar();
    else setPagina(1);
  };

  return (
    <section>
      <h1>Mis pedidos</h1>
      <Catalogo onPedidoCreado={onPedidoCreado} />
      {error && <p role="alert" className="error">{error}</p>}
      <h2>Historial</h2>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Artículos</th>
              <th>Total</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id}>
                <td>{formatoFecha(p.created_at)}</td>
                <td><ListaArticulos items={p.pedido_detalles} /></td>
                <td>{formatoPesos(Number(p.total))}</td>
                <td><EstadoBadge estado={p.estado} /></td>
              </tr>
            ))}
            {pedidos.length === 0 && (
              <tr><td colSpan={4}>Todavía no tenés pedidos.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls currentPage={pagina} totalItems={total} pageSize={POR_PAGINA} onPageChange={setPagina} />
    </section>
  );
}
