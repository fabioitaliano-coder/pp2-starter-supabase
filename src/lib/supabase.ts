// Concepto · Cliente singleton: se crea UNA vez y todo el proyecto importa este objeto.
// Concepto · Clave publishable: viaja en el bundle del navegador y NO es un secreto.
// La seguridad la ponen las políticas RLS de la base, no esta clave.
// La clave "secret" (sb_secret_...) no se usa jamás acá: solo en scripts/ locales.
// Este import va primero: guarda la URL de retorno del mail antes de que supabase-js la limpie.
import './retornoAuth';
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY. Copiá .env.example a .env.');
}

export const supabase = createClient(url, publishableKey, {
  auth: {
    // Concepto · Flujo implícito (el default de supabase-js, lo dejamos explícito):
    // el enlace de confirmación trae la sesión en el #hash y funciona en CUALQUIER
    // navegador, por ejemplo si te registrás en la compu y abrís el mail en el celular.
    // Con 'pkce' el enlace solo funcionaría en el mismo navegador donde te registraste.
    flowType: 'implicit',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});
