import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useConsulta } from '../../hooks/useConsulta';
import {
  CLAVES, invalidarTrasCambioEstado, pedirAdminPedidos, pedirAdminResumen,
} from '../../lib/consultas';
import { supabase } from '../../lib/supabase';
import { PaginationControls } from '../../components/PaginationControls';
import { EstadoBadge } from '../../components/EstadoBadge';
import { ListaArticulos } from '../../components/ListaArticulos';
import { EsqueletoFilas, EsqueletoResumen } from '../../components/Esqueleto';
import { ESTADOS, ESTADO_ETIQUETA, METODO_PAGO_ETIQUETA, TRANSICIONES, type Estado, type Pedido } from '../../types';
import { dinero, domicilioEnvio, facturaDe, fecha, fechaCorta, numeroFactura, numeroPedido } from '../../lib/formato';

export function PanelAdmin() {
  const [pagina, setPagina] = useState(1);
  const [filtro, setFiltro] = useState<'' | Estado>('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [avisoAccion, setAvisoAccion] = useState<string | null>(null);
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
    setAvisoAccion(null);
    setActualizandoId(id);
    // Concepto · UI optimista: el badge cambia ya. Si el UPDATE falla, se revierte.
    setPedidosLocal(pedidos.map((p) => (p.id === id ? { ...p, estado } : p)));
    const { error } = await supabase.from('pedidos').update({ estado }).eq('id', id);
    if (error) {
      setPedidosLocal(null);
      // Concepto · Las reglas de negocio (qué transición vale, factura al despachar) viven
      // en un trigger de la base. Acá solo mostramos su mensaje y su pista (hint).
      const pista = (error as { hint?: string }).hint;
      setErrorAccion(`No se pudo cambiar el estado: ${error.message}${pista ? ` ${pista}` : ''} Se restauró el valor anterior.`);
    } else {
      invalidarTrasCambioEstado();
      await Promise.all([lista.recargar(true), resumen.recargar(true)]);
      setPedidosLocal(null);
      if (estado === 'despachado') {
        // La factura la emitió el trigger; la leemos para confirmar número y hora.
        const { data: f } = await supabase
          .from('facturas').select('numero, punto_venta, emitida_at').eq('pedido_id', id).maybeSingle();
        setAvisoAccion(f
          ? `Pedido despachado. Factura B N.º ${numeroFactura(f)} emitida el ${fechaCorta(f.emitida_at)}.`
          : 'Pedido despachado.');
      }
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
      {avisoAccion && <p role="status" className="exito">{avisoAccion}</p>}
      {(errorAccion || lista.error || resumen.error) && (
        <p role="alert" className="error">{errorAccion ?? lista.error ?? resumen.error}</p>
      )}
      <div className="tabla-scroll">
        <table aria-busy={cargandoLista}>
          <thead>
            <tr>
              <th>N.º</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Factura</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cargandoLista && <EsqueletoFilas columnas={7} />}
            {!cargandoLista && pedidos.map((p) => {
              const factura = facturaDe(p);
              const permitidos = TRANSICIONES[p.estado];
              return (
              <Fragment key={p.id}>
                <tr>
                  <td><strong>{numeroPedido(p.numero)}</strong></td>
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
                        aria-label={`Cambiar estado del pedido ${numeroPedido(p.numero)}`}
                        value={p.estado}
                        disabled={actualizandoId === p.id || permitidos.length === 0}
                        onChange={(e) => cambiarEstado(p.id, e.target.value as Estado)}
                      >
                        {/* Solo se habilitan las transiciones válidas; igual la base vuelve a validarlas. */}
                        {ESTADOS.map((s) => (
                          <option key={s} value={s} disabled={s !== p.estado && !permitidos.includes(s)}>
                            {ESTADO_ETIQUETA[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td>
                    {factura ? (
                      <small>
                        <Link to={`/pedidos/${p.id}/factura`}>{numeroFactura(factura)}</Link>
                        <br />{fechaCorta(factura.emitida_at)}
                      </small>
                    ) : (
                      <small className="nota">{p.estado === 'cancelado' ? 'No corresponde' : 'Al despachar'}</small>
                    )}
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
                    <td colSpan={7}>
                      <div className="detalle-admin">
                        <ListaArticulos items={p.pedido_detalles} />
                        <p className="nota">
                          Entrega: {domicilioEnvio(p) || 'sin domicilio (pedido demo)'}
                          {p.pago_metodo && <> · Pago: {METODO_PAGO_ETIQUETA[p.pago_metodo]}{p.pago_detalle ? ` (${p.pago_detalle})` : ''}</>}
                          {' · '}<Link to={`/pedidos/${p.id}`}>Ver seguimiento</Link>
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
              );
            })}
            {!cargandoLista && pedidos.length === 0 && <tr><td colSpan={7}>Sin pedidos.</td></tr>}
          </tbody>
        </table>
      </div>
      <PaginationControls currentPage={pagina} hayMas={hayMas} onPageChange={(p) => { setPedidosLocal(null); setPagina(p); }} />
    </section>
  );
}
