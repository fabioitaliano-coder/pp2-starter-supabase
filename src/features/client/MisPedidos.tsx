import { Fragment, useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PaginationControls } from '../../components/PaginationControls';
import { EstadoBadge } from '../../components/EstadoBadge';
import { ListaArticulos } from '../../components/ListaArticulos';
import { dinero, fecha } from '../../lib/formato';
import type { Pedido } from '../../types';

const POR_PAGINA = 10;

export function MisPedidos() {
  const creado = (useLocation().state as { creado?: boolean } | null)?.creado;
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    // Concepto · Acá NO hay .eq('user_id', ...): RLS ya devuelve solo los pedidos del usuario.
    const desde = (pagina - 1) * POR_PAGINA;
    const { data, count, error } = await supabase
      .from('pedidos')
      .select('*, pedido_detalles(id, pedido_id, producto_id, producto_nombre, cantidad, precio_unitario)', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(desde, desde + POR_PAGINA - 1);
    if (error) setError('No se pudieron cargar los pedidos.');
    else { setPedidos((data as Pedido[]) ?? []); setTotal(count ?? 0); }
  }, [pagina]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <section>
      <h1>Mis pedidos</h1>
      {creado && <p role="status" className="exito">¡Compra realizada! Tu pedido quedó registrado.</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Total</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <Fragment key={p.id}>
                <tr>
                  <td>{fecha(p.created_at)}</td>
                  <td><strong>{dinero(p.total)}</strong></td>
                  <td><EstadoBadge estado={p.estado} /></td>
                  <td>
                    <button
                      type="button"
                      className="secundario"
                      onClick={() => setAbierto(abierto === p.id ? null : p.id)}
                    >
                      {abierto === p.id ? 'Ocultar' : 'Detalle'}
                    </button>
                  </td>
                </tr>
                {abierto === p.id && (
                  <tr>
                    <td colSpan={4}><ListaArticulos items={p.pedido_detalles} /></td>
                  </tr>
                )}
              </Fragment>
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
