// Concepto · Cliente singleton: se crea UNA vez y todo el proyecto importa este objeto.
// Concepto · Clave publishable: viaja en el bundle del navegador y NO es un secreto.
// La seguridad la ponen las políticas RLS de la base, no esta clave.
// La clave "secret" (sb_secret_...) no se usa jamás acá: solo en scripts/ locales.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY. Copiá .env.example a .env.');
}

export const supabase = createClient(url, publishableKey);
