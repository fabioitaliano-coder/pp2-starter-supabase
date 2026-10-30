import type { MetodoPago } from '../../types';
import { luhnValido, marcaDe, soloDigitos, vencimientoValido } from '../../lib/tarjetaSimulada';

// Concepto · Validar en el formulario es para la EXPERIENCIA (mensajes al toque).
// La SEGURIDAD es crear_pedido(): la base vuelve a validar todo lo que llega.

export interface DatosEnvio {
  nombre: string;
  calle: string;
  piso_depto: string;
  ciudad: string;
  provincia: string;
  cp: string;
  telefono: string;
  notas: string;
}

export interface DatosPago {
  metodo: MetodoPago;
  tarjeta_numero: string;
  tarjeta_nombre: string;
  tarjeta_vto: string;
  tarjeta_cvv: string;
  factura_nombre: string;
  factura_documento: string;
  factura_igual_envio: boolean;
  factura_domicilio: string;
}

export type Errores = Partial<Record<string, string>>;

export const ENVIO_VACIO: DatosEnvio = {
  nombre: '', calle: '', piso_depto: '', ciudad: '', provincia: '', cp: '', telefono: '', notas: '',
};

export const PAGO_VACIO: DatosPago = {
  metodo: 'tarjeta', tarjeta_numero: '', tarjeta_nombre: '', tarjeta_vto: '', tarjeta_cvv: '',
  factura_nombre: '', factura_documento: '', factura_igual_envio: true, factura_domicilio: '',
};

export const CP_VALIDO = /^[A-Za-z]?\d{4}[A-Za-z]{0,3}$/;
export const TELEFONO_VALIDO = /^[0-9 +()-]{6,25}$/;

export function validarEnvio(e: DatosEnvio): Errores {
  const err: Errores = {};
  if (e.nombre.trim().length < 3) err.nombre = 'Escribí nombre y apellido de quien recibe.';
  if (e.calle.trim().length < 3) err.calle = 'Indicá calle y número.';
  else if (!/\d/.test(e.calle)) err.calle = 'Falta la altura (número) de la calle.';
  if (e.piso_depto.length > 40) err.piso_depto = 'Máximo 40 caracteres.';
  if (e.ciudad.trim().length < 2) err.ciudad = 'Indicá la localidad.';
  if (!e.provincia) err.provincia = 'Elegí la provincia.';
  if (!CP_VALIDO.test(e.cp.trim())) err.cp = 'Código postal de 4 números (1406) o CPA (C1406ABC).';
  if (e.telefono.trim() && !TELEFONO_VALIDO.test(e.telefono.trim())) err.telefono = 'Solo números, espacios, +, ( ) y guiones.';
  if (e.notas.length > 200) err.notas = 'Máximo 200 caracteres.';
  return err;
}

export function validarPago(p: DatosPago): Errores {
  const err: Errores = {};
  if (p.metodo === 'tarjeta') {
    const digitos = soloDigitos(p.tarjeta_numero);
    if (!luhnValido(digitos)) err.tarjeta_numero = 'El número no es válido. Usá una tarjeta de prueba.';
    else if (!marcaDe(digitos)) err.tarjeta_numero = 'Aceptamos Visa, Mastercard o American Express (de prueba).';
    if (p.tarjeta_nombre.trim().length < 3) err.tarjeta_nombre = 'Como figura en la tarjeta.';
    if (!vencimientoValido(p.tarjeta_vto)) err.tarjeta_vto = 'Formato MM/AA y que no esté vencida.';
    const largoCvv = marcaDe(digitos) === 'American Express' ? 4 : 3;
    if (soloDigitos(p.tarjeta_cvv).length !== largoCvv) err.tarjeta_cvv = `${largoCvv} números del dorso.`;
  }
  const doc = soloDigitos(p.factura_documento);
  if (doc && (doc.length < 7 || doc.length > 11)) err.factura_documento = 'DNI (7-8) o CUIT (11), solo números.';
  if (p.factura_nombre.length > 80) err.factura_nombre = 'Máximo 80 caracteres.';
  if (!p.factura_igual_envio && p.factura_domicilio.trim().length < 5) {
    err.factura_domicilio = 'Indicá el domicilio de facturación.';
  }
  return err;
}

export const domicilioTexto = (e: DatosEnvio) =>
  [e.calle, e.piso_depto, e.ciudad, e.provincia, e.cp.toUpperCase()].map((s) => s.trim()).filter(Boolean).join(', ');
