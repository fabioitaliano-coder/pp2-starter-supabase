// Concepto · Pago SIMULADO. Nada de esto sale del navegador salvo marca y últimos 4.
// En un sistema real, la pasarela de pagos (Mercado Pago, Stripe…) recibe la tarjeta
// en su propio formulario y la tienda solo guarda un token y el resultado.

export type Marca = 'Visa' | 'Mastercard' | 'American Express';

export const TARJETAS_PRUEBA: { numero: string; marca: Marca; resultado: 'aprobada' | 'rechazada' }[] = [
  { numero: '4242 4242 4242 4242', marca: 'Visa', resultado: 'aprobada' },
  { numero: '5555 5555 5555 4444', marca: 'Mastercard', resultado: 'aprobada' },
  { numero: '4000 0000 0000 0002', marca: 'Visa', resultado: 'rechazada' },
];

export const soloDigitos = (v: string) => v.replace(/\D/g, '');

// Algoritmo de Luhn: el dígito verificador que traen todas las tarjetas.
export function luhnValido(numero: string): boolean {
  const d = soloDigitos(numero);
  if (d.length < 13 || d.length > 19) return false;
  let suma = 0;
  for (let i = 0; i < d.length; i += 1) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    suma += n;
  }
  return suma % 10 === 0;
}

export function marcaDe(numero: string): Marca | null {
  const d = soloDigitos(numero);
  if (/^4/.test(d)) return 'Visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(d)) return 'Mastercard';
  if (/^3[47]/.test(d)) return 'American Express';
  return null;
}

export const formatearNumero = (v: string) =>
  soloDigitos(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');

export function formatearVencimiento(v: string) {
  const d = soloDigitos(v).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

export function vencimientoValido(mmaa: string, hoy = new Date()): boolean {
  const m = /^(\d{2})\/(\d{2})$/.exec(mmaa);
  if (!m) return false;
  const mes = Number(m[1]);
  const anio = 2000 + Number(m[2]);
  if (mes < 1 || mes > 12) return false;
  // Vence el último día del mes indicado.
  return new Date(anio, mes, 1) > hoy;
}

export const esRechazada = (numero: string) => soloDigitos(numero) === '4000000000000002';
