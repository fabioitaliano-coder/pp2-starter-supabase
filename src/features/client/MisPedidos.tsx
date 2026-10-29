import { Fragment, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useConsulta } from '../../hooks/useConsulta';
import { CLAVES, pedirMisPedidos } from '../../lib/consultas';
import { PaginationControls } from '../../components/PaginationControls';
import { EstadoBadge } from '../../components/EstadoBadge';
import { ListaArticulos } from '../../components/ListaArticulos';
import { EsqueletoFilas } from '../../components/Esqueleto';
import { dinero, fecha } from '../../lib/formato';

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
      <PaginationControls currentPage={pagina} hayMas={hayMas} onPageChange={setPagina} />
    </section>
  );
}
