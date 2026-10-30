// Concepto · Reenvío del mail de confirmación. Usa la clave publishable: cualquiera puede
// pedirlo para un email, pero el enlace solo llega a esa casilla. Supabase limita la
// frecuencia (60 s por email y un tope de mails por hora en el SMTP de prueba).
import { supabase } from './supabase';
import { urlConfirmacion } from './retornoAuth';

export const ESPERA_REENVIO_S = 60;
export const MIN_CLAVE = 8;

export function reenviarConfirmacion(email: string) {
  return supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: urlConfirmacion() },
  });
}
