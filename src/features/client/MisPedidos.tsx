import { Fragment, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useConsulta } from '../../hooks/useConsulta';
import { CLAVES, pedirMisPedidos, prefetchPedido } from '../../lib/consultas';
import { PaginationControls } from '../../components/PaginationControls';
import { EstadoBadge } from '../../components/EstadoBadge';
import { ListaArticulos } from '../../components/ListaArticulos';
import { EsqueletoFilas } from '../../components/Esqueleto';
import { FormSeguimiento } from '../../components/FormSeguimiento';
import { dinero, facturaDe, fecha, numeroPedido } from '../../lib/formato';

export function MisPedidos() {
  const creado = (useLocation().state as { creado?: boolean } | null)?.creado;
  const [pagina, setPagina] = useState(1);
  const [abierto, setAbierto] = useState<string | null>(null);
  const { data, cargando, error } = useConsulta(
    CLAVES.misPedidos(pagina),
    () => pedirMisPedidos(pagina),
  );
  const pedidos = data?.pedidos ?? [];
  const hayMas = data?.hayMas ?? false;

  return (
    <section>
      <div className="titulo-con-insignias">
        <h1>Mis pedidos</h1>
        <FormSeguimiento compacto />
      </div>
      {creado && <p role="status" className="exito">¡Compra realizada! Tu pedido quedó registrado.</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="tabla-scroll">
        <table aria-busy={cargando}>
          <thead>
            <tr>
              <th>N.º</th>
              <th>Fecha</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando && <EsqueletoFilas columnas={5} />}
            {!cargando && pedidos.map((p) => {
              const factura = facturaDe(p);
              return (
                <Fragment key={p.id}>
                  <tr>
                    <td><strong>{numeroPedido(p.numero)}</strong></td>
                    <td>{fecha(p.created_at)}</td>
                    <td><strong>{dinero(p.total)}</strong></td>
                    <td><EstadoBadge estado={p.estado} /></td>
                    <td>
                      <div className="acciones-fila">
                        {/* Prefetch al pasar el mouse: el seguimiento abre con datos. */}
                        <Link to={`/pedidos/${p.id}`} className="boton chico"
                          onMouseEnter={() => prefetchPedido(p.id)} onFocus={() => prefetchPedido(p.id)}>
                          Seguimiento
                        </Link>
                        {factura && <Link to={`/pedidos/${p.id}/factura`} className="boton secundario chico">Factura</Link>}
                        <button type="button" className="secundario chico"
                          aria-expanded={abierto === p.id}
                          onClick={() => setAbierto(abierto === p.id ? null : p.id)}>
                          {abierto === p.id ? 'Ocultar' : 'Artículos'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {abierto === p.id && (
                    <tr>
                      <td colSpan={5}><ListaArticulos items={p.pedido_detalles} /></td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!cargando && pedidos.length === 0 && (
              <tr><td colSpan={5}>Todavía no tenés pedidos. <Link to="/">Ir a la tienda</Link></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls currentPage={pagina} hayMas={hayMas} onPageChange={setPagina} />
    </section>
  );
}
