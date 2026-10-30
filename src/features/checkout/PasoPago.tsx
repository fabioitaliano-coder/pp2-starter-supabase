import { Campo } from '../../components/Campo';
import { METODO_PAGO_ETIQUETA, type MetodoPago } from '../../types';
import {
  TARJETAS_PRUEBA, formatearNumero, formatearVencimiento, marcaDe, soloDigitos,
} from '../../lib/tarjetaSimulada';
import type { DatosPago, Errores } from './validacion';

const DESCRIPCION: Record<MetodoPago, string> = {
  tarjeta: 'Crédito o débito. Aprobación inmediata (simulada).',
  transferencia: 'Te mostramos un alias ficticio. Se confirma al acreditarse.',
  efectivo: 'Pagás cuando recibís el pedido.',
};
const ICONO: Record<MetodoPago, string> = { tarjeta: '💳', transferencia: '🏦', efectivo: '💵' };

export function PasoPago({
  pago, errores, onCambio, domicilioEnvio,
}: {
  pago: DatosPago;
  errores: Errores;
  onCambio: <K extends keyof DatosPago>(campo: K, valor: DatosPago[K]) => void;
  domicilioEnvio: string;
}) {
  const marca = marcaDe(pago.tarjeta_numero);
  return (
    <div className="grilla-campos">
      <p className="aviso-simulacion completo" role="note">
        <strong>Simulación:</strong> no se cobra nada y no hay pasarela real. No escribas datos de una tarjeta
        verdadera; usá las de prueba. A la base solo viajan la marca y los últimos 4 números.
      </p>

      <fieldset className="opciones-pago completo">
        <legend>Forma de pago</legend>
        {(Object.keys(METODO_PAGO_ETIQUETA) as MetodoPago[]).map((m) => (
          <label key={m} className={`opcion-pago ${pago.metodo === m ? 'elegida' : ''}`}>
            <input type="radio" name="metodo" value={m} checked={pago.metodo === m}
              onChange={() => onCambio('metodo', m)} />
            <span className="icono" aria-hidden="true">{ICONO[m]}</span>
            <span>
              <strong>{METODO_PAGO_ETIQUETA[m]}</strong>
              <small className="nota">{DESCRIPCION[m]}</small>
            </span>
          </label>
        ))}
      </fieldset>

      {pago.metodo === 'tarjeta' && (
        <>
          <div className="tarjetas-prueba completo">
            <span className="nota">Tarjetas de prueba:</span>
            {TARJETAS_PRUEBA.map((t) => (
              <button key={t.numero} type="button" className="secundario chico"
                onClick={() => {
                  onCambio('tarjeta_numero', t.numero);
                  if (!pago.tarjeta_vto) onCambio('tarjeta_vto', '12/30');
                  if (!pago.tarjeta_cvv) onCambio('tarjeta_cvv', '123');
                  if (!pago.tarjeta_nombre) onCambio('tarjeta_nombre', 'TITULAR DE PRUEBA');
                }}>
                {t.marca} ···· {t.numero.slice(-4)} {t.resultado === 'rechazada' ? '(rechaza)' : ''}
              </button>
            ))}
          </div>
          {/* autoComplete="off": que el navegador no ofrezca tarjetas reales guardadas. */}
          <Campo nombre="tarjeta_numero" etiqueta={`Número de tarjeta${marca ? ` · ${marca}` : ''}`}
            inputMode="numeric" autoComplete="off" maxLength={23} value={pago.tarjeta_numero}
            error={errores.tarjeta_numero}
            onChange={(e) => onCambio('tarjeta_numero', formatearNumero(e.target.value))} />
          <Campo nombre="tarjeta_nombre" etiqueta="Nombre como figura en la tarjeta" autoComplete="off"
            value={pago.tarjeta_nombre} error={errores.tarjeta_nombre}
            onChange={(e) => onCambio('tarjeta_nombre', e.target.value.toUpperCase())} />
          <Campo nombre="tarjeta_vto" etiqueta="Vencimiento (MM/AA)" inputMode="numeric" autoComplete="off"
            maxLength={5} value={pago.tarjeta_vto} error={errores.tarjeta_vto} ancho="medio"
            onChange={(e) => onCambio('tarjeta_vto', formatearVencimiento(e.target.value))} />
          <Campo nombre="tarjeta_cvv" etiqueta="Código de seguridad" inputMode="numeric" autoComplete="off"
            maxLength={4} value={pago.tarjeta_cvv} error={errores.tarjeta_cvv} ancho="medio"
            ayuda="No se guarda ni se envía."
            onChange={(e) => onCambio('tarjeta_cvv', soloDigitos(e.target.value).slice(0, 4))} />
        </>
      )}

      {pago.metodo === 'transferencia' && (
        <dl className="datos-transferencia completo">
          <dt>Alias</dt><dd><code>PP2.STARTER.DEMO</code></dd>
          <dt>Titular</dt><dd>Tienda Demo PP2 (ficticia)</dd>
          <dt>Cuándo</dt><dd>Tenés 48 h. Confirmamos el pedido cuando se acredita.</dd>
        </dl>
      )}

      {pago.metodo === 'efectivo' && (
        <p className="alerta info completo">Pagás en efectivo al recibir. Tené el importe justo si podés.</p>
      )}

      <fieldset className="completo grupo-facturacion">
        <legend>Datos de facturación</legend>
        <div className="grilla-campos">
          <Campo nombre="factura_nombre" etiqueta="Nombre o razón social" autoComplete="name"
            ayuda="Si lo dejás vacío, usamos el de quien recibe." value={pago.factura_nombre}
            error={errores.factura_nombre} ancho="medio"
            onChange={(e) => onCambio('factura_nombre', e.target.value)} />
          <Campo nombre="factura_documento" etiqueta="DNI o CUIT (opcional)" inputMode="numeric"
            value={pago.factura_documento} error={errores.factura_documento} ancho="medio"
            onChange={(e) => onCambio('factura_documento', soloDigitos(e.target.value).slice(0, 11))} />
          <label className="check completo">
            <input type="checkbox" checked={pago.factura_igual_envio}
              onChange={(e) => onCambio('factura_igual_envio', e.target.checked)} />
            Domicilio de facturación igual al de entrega
            {pago.factura_igual_envio && domicilioEnvio && <small className="nota"> ({domicilioEnvio})</small>}
          </label>
          {!pago.factura_igual_envio && (
            <Campo nombre="factura_domicilio" etiqueta="Domicilio de facturación" autoComplete="street-address"
              value={pago.factura_domicilio} error={errores.factura_domicilio}
              onChange={(e) => onCambio('factura_domicilio', e.target.value)} />
          )}
        </div>
      </fieldset>
    </div>
  );
}
