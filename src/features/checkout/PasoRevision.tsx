import { METODO_PAGO_ETIQUETA } from '../../types';
import { marcaDe, soloDigitos } from '../../lib/tarjetaSimulada';
import { domicilioTexto, type DatosEnvio, type DatosPago } from './validacion';

export function PasoRevision({
  envio, pago, onEditar,
}: {
  envio: DatosEnvio;
  pago: DatosPago;
  onEditar: (paso: 0 | 1) => void;
}) {
  const ultimos = soloDigitos(pago.tarjeta_numero).slice(-4);
  return (
    <div className="revision">
      <section className="bloque-revision">
        <header>
          <h3>Entrega</h3>
          <button type="button" className="enlace-azul" onClick={() => onEditar(0)}>Editar</button>
        </header>
        <p><strong>{envio.nombre}</strong><br />{domicilioTexto(envio)}</p>
        {envio.telefono && <p className="nota">Tel.: {envio.telefono}</p>}
        {envio.notas && <p className="nota">Indicaciones: {envio.notas}</p>}
        <p className="nota">Envío estándar gratis · llega en 2 a 5 días hábiles (simulado).</p>
      </section>
      <section className="bloque-revision">
        <header>
          <h3>Pago</h3>
          <button type="button" className="enlace-azul" onClick={() => onEditar(1)}>Editar</button>
        </header>
        <p>
          {pago.metodo === 'tarjeta'
            ? <>{marcaDe(pago.tarjeta_numero) ?? 'Tarjeta'} terminada en <strong>{ultimos}</strong></>
            : METODO_PAGO_ETIQUETA[pago.metodo]}
        </p>
      </section>
      <section className="bloque-revision">
        <header>
          <h3>Facturación</h3>
          <button type="button" className="enlace-azul" onClick={() => onEditar(1)}>Editar</button>
        </header>
        <p>
          {pago.factura_nombre.trim() || envio.nombre}
          {pago.factura_documento && <> · Doc. {pago.factura_documento}</>}
          <br />
          <span className="nota">{pago.factura_igual_envio ? domicilioTexto(envio) : pago.factura_domicilio}</span>
        </p>
        <p className="nota">La factura (simulada) se emite cuando confirmamos y despachamos el pedido.</p>
      </section>
    </div>
  );
}
