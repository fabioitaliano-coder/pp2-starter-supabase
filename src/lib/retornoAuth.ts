// Concepto · Retorno del enlace de confirmación. Cuando alguien toca el link del mail,
// Supabase verifica el token en SU servidor y redirige a `emailRedirectTo` con datos en la URL:
//   - éxito (flujo implícito): #access_token=…&refresh_token=…&type=signup
//   - error:                   #error=access_denied&error_code=otp_expired&error_description=…
// supabase-js lee ese hash al iniciar (detectSessionInUrl), guarda la sesión y BORRA el hash.
// Por eso sacamos una "foto" de la URL antes de crear el cliente: supabase.ts importa este
// módulo primero, y los imports se evalúan antes que el cuerpo del archivo que los importa.
import type { AuthError } from '@supabase/supabase-js';

export const RUTA_CONFIRMACION = '/auth/confirmado';

// Concepto · El enlace vuelve al MISMO sitio donde la persona se registró (la demo en
// Vercel o http://localhost:5173). Supabase solo lo respeta si la URL está en
// Authentication → URL Configuration → Redirect URLs; si no, usa la Site URL.
export function urlConfirmacion() {
  return `${window.location.origin}${RUTA_CONFIRMACION}`;
}

export interface RetornoAuth {
  tipo: string | null; // signup | email_change | recovery | magiclink | invite
  error: { codigo: string; descripcion: string } | null;
}

function leerUrl(): RetornoAuth {
  if (typeof window === 'undefined') return { tipo: null, error: null };
  const p = new URLSearchParams(window.location.search);
  new URLSearchParams(window.location.hash.replace(/^#/, '')).forEach((v, k) => p.set(k, v));
  const hayError = p.has('error') || p.has('error_code');
  return {
    tipo: p.has('access_token') ? p.get('type') : null,
    error: hayError
      ? { codigo: p.get('error_code') ?? p.get('error') ?? '', descripcion: p.get('error_description') ?? '' }
      : null,
  };
}

const foto: RetornoAuth = leerUrl();
let pendiente = foto.tipo === 'signup' || foto.error !== null;

// ¿Hay que mostrar la pantalla de confirmación? (alta confirmada o enlace con error).
// El cambio de email de Mi cuenta (type=email_change) vuelve a /cuenta y se maneja ahí.
export function hayRetornoPendiente() {
  return pendiente;
}

// Devuelve la foto y limpia el error de la barra de direcciones: si la persona recarga,
// el módulo se vuelve a evaluar con la URL limpia y no se repite el aviso. Es idempotente
// (React en modo estricto llama dos veces al inicializador de useState).
export function consumirRetornoAuth(): RetornoAuth {
  pendiente = false;
  if (foto.error && (window.location.hash || window.location.search)) {
    window.history.replaceState(window.history.state, '', window.location.pathname);
  }
  return foto;
}

// Concepto · Mensajes de Auth en castellano. Supabase manda `code` estable (en inglés);
// mostramos un texto que explique qué hacer, no el error crudo.
export function mensajeErrorAuth(error: Pick<AuthError, 'message'> & { code?: string; status?: number }): string {
  const espera = /after (\d+) seconds?/i.exec(error.message)?.[1];
  if (espera) return `Por seguridad, Supabase pide esperar ${espera} segundos antes de mandar otro mail.`;
  switch (error.code) {
    case 'invalid_credentials':
      return 'Email o contraseña incorrectos.';
    case 'email_not_confirmed':
      return 'Todavía no confirmaste tu email. Abrí el enlace que te mandamos o pedí uno nuevo.';
    case 'over_email_send_rate_limit':
      return 'Se alcanzó el límite de mails por hora del proyecto. Esperá unos minutos y probá de nuevo.';
    case 'over_request_rate_limit':
      return 'Demasiados intentos seguidos. Esperá un minuto y probá de nuevo.';
    case 'user_already_exists':
    case 'email_exists':
      return 'Ya hay una cuenta con ese email. Ingresá con tu contraseña.';
    case 'weak_password':
      return 'La contraseña es demasiado débil para la configuración del proyecto. Probá con una más larga.';
    case 'email_address_invalid':
      return 'Supabase no acepta ese email. Usá una dirección real (los dominios inventados, como .test, se rechazan).';
    case 'signup_disabled':
    case 'email_provider_disabled':
      return 'El registro con email está desactivado en este proyecto.';
  }
  if (error.status === 429) return 'Demasiados intentos seguidos. Esperá un minuto y probá de nuevo.';
  return `No se pudo completar la operación: ${error.message}`;
}

// Mensaje para los errores que trae el enlace del mail.
export function mensajeErrorEnlace(codigo: string): string {
  if (codigo === 'otp_expired') {
    return 'El enlace venció o ya se usó. Cada enlace sirve una sola vez y por tiempo limitado.';
  }
  return 'No pudimos confirmar la cuenta con ese enlace.';
}
