import { Campo, CampoSelect } from '../../components/Campo';
import { PROVINCIAS } from '../../types';
import type { DatosEnvio, Errores } from './validacion';

export function PasoEntrega({
  envio, errores, onCambio, guardarDomicilio, onGuardarDomicilio, tieneGuardado,
}: {
  envio: DatosEnvio;
  errores: Errores;
  onCambio: (campo: keyof DatosEnvio, valor: string) => void;
  guardarDomicilio: boolean;
  onGuardarDomicilio: (v: boolean) => void;
  tieneGuardado: boolean;
}) {
  const campo = (c: keyof DatosEnvio) => ({
    value: envio[c],
    error: errores[c],
    onChange: (e: { target: { value: string } }) => onCambio(c, e.target.value),
  });
  return (
    <div className="grilla-campos">
      {tieneGuardado && (
        <p className="alerta info completo">Completamos con el domicilio guardado en <strong>Mi cuenta</strong>. Podés cambiarlo para este pedido.</p>
      )}
      <Campo nombre="nombre" etiqueta="Nombre y apellido de quien recibe" autoComplete="name" required {...campo('nombre')} />
      <Campo nombre="calle" etiqueta="Calle y número" autoComplete="address-line1" required {...campo('calle')} ancho="medio" />
      <Campo nombre="piso_depto" etiqueta="Piso / depto (opcional)" autoComplete="address-line2" {...campo('piso_depto')} ancho="medio" />
      <Campo nombre="ciudad" etiqueta="Localidad" autoComplete="address-level2" required {...campo('ciudad')} ancho="medio" />
      <CampoSelect nombre="provincia" etiqueta="Provincia" autoComplete="address-level1" required {...campo('provincia')} ancho="medio">
        <option value="">Elegí…</option>
        {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
      </CampoSelect>
      <Campo nombre="cp" etiqueta="Código postal" autoComplete="postal-code" inputMode="text" maxLength={8}
        ayuda="Ej.: 1406 o C1406ABC" required {...campo('cp')} ancho="medio" />
      <Campo nombre="telefono" etiqueta="Teléfono (opcional)" type="tel" autoComplete="tel"
        ayuda="Para coordinar la entrega." {...campo('telefono')} ancho="medio" />
      <Campo nombre="notas" etiqueta="Indicaciones para la entrega (opcional)" maxLength={200}
        ayuda="Ej.: timbre 3B, dejar en portería." {...campo('notas')} />
      <label className="check completo">
        <input type="checkbox" checked={guardarDomicilio} onChange={(e) => onGuardarDomicilio(e.target.checked)} />
        Guardar este domicilio en Mi cuenta para próximas compras
      </label>
    </div>
  );
}
