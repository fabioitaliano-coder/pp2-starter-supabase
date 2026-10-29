import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PaginationControls } from '../../components/PaginationControls';
import { EstadoBadge } from '../../components/EstadoBadge';
import { ListaArticulos } from '../../components/ListaArticulos';
import { ESTADOS, ESTADO_ETIQUETA, formatoFecha, formatoPesos, type Estado, type Pedido, type ResumenEstado } from '../../types';

const POR_PAGINA = 10;

export function PanelAdmin() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [resumen, setResumen] = useState<ResumenEstado[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [filtro, setFiltro] = useState<'' | Estado>('');
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const desde = (pagina - 1) * POR_PAGINA;
    let consulta = supabase
      .from('pedidos')
      .select('*, pedido_detalles(id, pedido_id, producto_id, nombre, cantidad, precio_unitario)', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(desde, desde + POR_PAGINA - 1);
    if (filtro) consulta = consulta.eq('estado', filtro);

    const [lista, vista] = await Promise.all([
      consulta,
      supabase.from('resumen_pedidos_por_estado').select('*'), // vista SQL con security_invoker
    ]);
    if (lista.error) setError('No se pudieron cargar los pedidos.');
    else { setPedidos((lista.data as Pedido[]) ?? []); setTotal(lista.count ?? 0); }
    setResumen((vista.data as ResumenEstado[]) ?? []);
  }, [pagina, filtro]);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiarEstado = async (id: string, estado: Estado) => {
    setError(null);
    // Si un cliente intentara esto, la política pedidos_update_admin lo rechaza en la base.
    const { error } = await supabase.from('pedidos').update({ estado }).eq('id', id);
    if (error) setError('No se pudo cambiar el estado.');
    else await cargar();
  };

  return (
    <section>
      <h1>Panel de administración</h1>
      <ul className="resumen">
        {resumen.map((r) => (
          <li key={r.estado}>
            <EstadoBadge estado={r.estado} />
            <strong>{r.cantidad}</strong>
            <small>{formatoPesos(Number(r.total))}</small>
          </li>
        ))}
      </ul>
      <label className="filtro">
        Filtrar por estado
        <select
          value={filtro}
          onChange={(e) => { setPagina(1); setFiltro(e.target.value as '' | Estado); }}
        >
          <option value="">Todos</option>
          {ESTADOS.map((s) => (
            <option key={s} value={s}>{ESTADO_ETIQUETA[s]}</option>
          ))}
        </select>
      </label>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente (id)</th>
              <th>Artículos</th>
              <th>Total</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id}>
                <td>{formatoFecha(p.created_at)}</td>
                <td><code>{p.user_id.slice(0, 8)}</code></td>
                <td><ListaArticulos items={p.pedido_detalles} /></td>
                <td>{formatoPesos(Number(p.total))}</td>
                <td>
                  <div className="celda-estado">
                    <EstadoBadge estado={p.estado} />
                    <select
                      aria-label={`Cambiar estado del pedido ${p.id.slice(0, 8)}`}
                      value={p.estado}
                      onChange={(e) => cambiarEstado(p.id, e.target.value as Estado)}
                    >
                      {ESTADOS.map((s) => (
                        <option key={s} value={s}>{ESTADO_ETIQUETA[s]}</option>
                      ))}
                    </select>
                  </div>
                </td>
              </tr>
            ))}
            {pedidos.length === 0 && <tr><td colSpan={5}>Sin pedidos.</td></tr>}
          </tbody>
        </table>
      </div>
      <PaginationControls currentPage={pagina} totalItems={total} pageSize={POR_PAGINA} onPageChange={setPagina} />
    </section>
  );
}
