import { Fragment, useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PaginationControls } from '../../components/PaginationControls';
import { EstadoBadge } from '../../components/EstadoBadge';
import { ListaArticulos } from '../../components/ListaArticulos';
import { EsqueletoFilas } from '../../components/Esqueleto';
import { dinero, fecha } from '../../lib/formato';
import type { Pedido } from '../../types';

const POR_PAGINA = 10;
const COLUMNAS_PEDIDO =
  'id, user_id, total, estado, created_at, pedido_detalles(id, pedido_id, producto_id, producto_nombre, cantidad, precio_unitario)';

export function MisPedidos() {
  const creado = (useLocation().state as { creado?: boolean } | null)?.creado;
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    // Concepto · Acá NO hay .eq('user_id', ...): RLS ya devuelve solo los pedidos del usuario.
    // Se piden solo las columnas que pinta la tabla, no select('*').
    const desde = (pagina - 1) * POR_PAGINA;
    const { data, count, error } = await supabase
      .from('pedidos')
      .select(COLUMNAS_PEDIDO, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(desde, desde + POR_PAGINA - 1);
    if (error) setError('No se pudieron cargar los pedidos.');
    else { setPedidos((data as unknown as Pedido[]) ?? []); setTotal(count ?? 0); setError(null); }
    setCargando(false);
  }, [pagina]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <section>
      <h1>Mis pedidos</h1>
      {creado && <p role="status" className="exito">¡Compra realizada! Tu pedido quedó registrado.</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="tabla-scroll">
        <table aria-busy={cargando}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Total</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cargando && <EsqueletoFilas columnas={4} />}
            {!cargando && pedidos.map((p) => (
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
            {!cargando && pedidos.length === 0 && (
              <tr><td colSpan={4}>Todavía no tenés pedidos.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls currentPage={pagina} totalItems={total} pageSize={POR_PAGINA} onPageChange={setPagina} />
    </section>
  );
}
