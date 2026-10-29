import { Fragment, useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PaginationControls } from '../../components/PaginationControls';
import { EstadoBadge } from '../../components/EstadoBadge';
import { ListaArticulos } from '../../components/ListaArticulos';
import { EsqueletoFilas, EsqueletoResumen } from '../../components/Esqueleto';
import { ESTADOS, ESTADO_ETIQUETA, type Estado, type Pedido, type ResumenEstado } from '../../types';
import { dinero, fecha } from '../../lib/formato';

const POR_PAGINA = 10;
const COLUMNAS_PEDIDO =
  'id, user_id, total, estado, created_at, profiles(email, full_name), pedido_detalles(id, pedido_id, producto_id, producto_nombre, cantidad, precio_unitario)';

export function PanelAdmin() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [resumen, setResumen] = useState<ResumenEstado[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [filtro, setFiltro] = useState<'' | Estado>('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [actualizandoId, setActualizandoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const desde = (pagina - 1) * POR_PAGINA;
    let consulta = supabase
      .from('pedidos')
      .select(COLUMNAS_PEDIDO, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(desde, desde + POR_PAGINA - 1);
    if (filtro) consulta = consulta.eq('estado', filtro);

    // Concepto · Promise.all: lista y resumen viajan juntos, no en cascada.
    const [lista, vista] = await Promise.all([
      consulta,
      supabase.from('resumen_pedidos_por_estado').select('estado, cantidad, total'),
    ]);
    if (lista.error) setError('No se pudieron cargar los pedidos.');
    else { setPedidos((lista.data as unknown as Pedido[]) ?? []); setTotal(lista.count ?? 0); setError(null); }
    setResumen((vista.data as ResumenEstado[]) ?? []);
    setCargando(false);
  }, [pagina, filtro]);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiarEstado = async (id: string, estado: Estado) => {
    const anterior = pedidos.find((p) => p.id === id)?.estado;
    if (!anterior || anterior === estado || actualizandoId) return;
    setError(null);
    setActualizandoId(id);
    // Concepto · UI optimista: el badge cambia ya. Si el UPDATE falla, se revierte.
    setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, estado } : p)));
    const { error } = await supabase.from('pedidos').update({ estado }).eq('id', id);
    if (error) {
      setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, estado: anterior } : p)));
      setError('No se pudo cambiar el estado. Se restauró el valor anterior.');
    } else {
      const { data } = await supabase.from('resumen_pedidos_por_estado').select('estado, cantidad, total');
      setResumen((data as ResumenEstado[]) ?? []);
    }
    setActualizandoId(null);
  };

  return (
    <section>
      <h1>Administración</h1>
      {cargando && resumen.length === 0 ? (
        <EsqueletoResumen />
      ) : (
        <ul className="resumen">
          {resumen.map((r) => (
            <li key={r.estado}>
              <EstadoBadge estado={r.estado} />
              <strong> {r.cantidad}</strong>
              <small>{dinero(r.total)}</small>
            </li>
          ))}
        </ul>
      )}
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
        <table aria-busy={cargando}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cargando && <EsqueletoFilas columnas={5} />}
            {!cargando && pedidos.map((p) => (
              <Fragment key={p.id}>
                <tr>
                  <td>{fecha(p.created_at)}</td>
                  <td>
                    {p.profiles?.full_name ?? '—'}
                    <br />
                    <small>{p.profiles?.email}</small>
                  </td>
                  <td>{dinero(p.total)}</td>
                  <td>
                    <div className="celda-estado">
                      <EstadoBadge estado={p.estado} />
                      <select
                        aria-label={`Cambiar estado del pedido ${p.id.slice(0, 8)}`}
                        value={p.estado}
                        disabled={actualizandoId === p.id}
                        onChange={(e) => cambiarEstado(p.id, e.target.value as Estado)}
                      >
                        {ESTADOS.map((s) => (
                          <option key={s} value={s}>{ESTADO_ETIQUETA[s]}</option>
                        ))}
                      </select>
                    </div>
                  </td>
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
                    <td colSpan={5}><ListaArticulos items={p.pedido_detalles} /></td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!cargando && pedidos.length === 0 && <tr><td colSpan={5}>Sin pedidos.</td></tr>}
          </tbody>
        </table>
      </div>
      <PaginationControls currentPage={pagina} totalItems={total} pageSize={POR_PAGINA} onPageChange={setPagina} />
    </section>
  );
}
