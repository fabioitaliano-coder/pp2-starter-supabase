import { Fragment, useState } from 'react';
import { useConsulta } from '../../hooks/useConsulta';
import {
  CLAVES, invalidarTrasCambioEstado, pedirAdminPedidos, pedirAdminResumen,
} from '../../lib/consultas';
import { supabase } from '../../lib/supabase';
import { PaginationControls } from '../../components/PaginationControls';
import { EstadoBadge } from '../../components/EstadoBadge';
import { ListaArticulos } from '../../components/ListaArticulos';
import { EsqueletoFilas, EsqueletoResumen } from '../../components/Esqueleto';
import { ESTADOS, ESTADO_ETIQUETA, type Estado, type Pedido } from '../../types';
import { dinero, fecha } from '../../lib/formato';

export function PanelAdmin() {
  const [pagina, setPagina] = useState(1);
  const [filtro, setFiltro] = useState<'' | Estado>('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [actualizandoId, setActualizandoId] = useState<string | null>(null);
  const [pedidosLocal, setPedidosLocal] = useState<Pedido[] | null>(null);

  const lista = useConsulta(
    CLAVES.adminPedidos(pagina, filtro),
    () => pedirAdminPedidos(pagina, filtro),
  );
  const resumen = useConsulta(CLAVES.adminResumen, pedirAdminResumen);

  const pedidos = pedidosLocal ?? lista.data?.pedidos ?? [];
  const hayMas = lista.data?.hayMas ?? false;
  const cargandoLista = lista.cargando && pedidos.length === 0;
  const cargandoResumen = resumen.cargando && (resumen.data?.length ?? 0) === 0;

  const cambiarEstado = async (id: string, estado: Estado) => {
    const anterior = pedidos.find((p) => p.id === id)?.estado;
    if (!anterior || anterior === estado || actualizandoId) return;
    setErrorAccion(null);
    setActualizandoId(id);
    // Concepto · UI optimista: el badge cambia ya. Si el UPDATE falla, se revierte.
    setPedidosLocal(pedidos.map((p) => (p.id === id ? { ...p, estado } : p)));
    const { error } = await supabase.from('pedidos').update({ estado }).eq('id', id);
    if (error) {
      setPedidosLocal(null);
      setErrorAccion('No se pudo cambiar el estado. Se restauró el valor anterior.');
    } else {
      invalidarTrasCambioEstado();
      await Promise.all([lista.recargar(true), resumen.recargar(true)]);
      setPedidosLocal(null);
    }
    setActualizandoId(null);
  };

  return (
    <section>
      <h1>Administración</h1>
      {cargandoResumen ? (
        <EsqueletoResumen />
      ) : (
        <ul className="resumen">
          {(resumen.data ?? []).map((r) => (
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
          onChange={(e) => {
            setPagina(1);
            setFiltro(e.target.value as '' | Estado);
            setPedidosLocal(null);
          }}
        >
          <option value="">Todos</option>
          {ESTADOS.map((s) => (
            <option key={s} value={s}>{ESTADO_ETIQUETA[s]}</option>
          ))}
        </select>
      </label>
      {(errorAccion || lista.error || resumen.error) && (
        <p role="alert" className="error">{errorAccion ?? lista.error ?? resumen.error}</p>
      )}
      <div className="tabla-scroll">
        <table aria-busy={cargandoLista}>
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
            {cargandoLista && <EsqueletoFilas columnas={5} />}
            {!cargandoLista && pedidos.map((p) => (
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
            {!cargandoLista && pedidos.length === 0 && <tr><td colSpan={5}>Sin pedidos.</td></tr>}
          </tbody>
        </table>
      </div>
      <PaginationControls currentPage={pagina} hayMas={hayMas} onPageChange={(p) => { setPedidosLocal(null); setPagina(p); }} />
    </section>
  );
}
