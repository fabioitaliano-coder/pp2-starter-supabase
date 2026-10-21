// Concepto · Estos scripts corren en TU máquina, nunca en el navegador ni en Render.
// Usan la clave SECRET (saltea RLS) para preparar datos; por eso viven fuera de src/.
import { createClient } from '@supabase/supabase-js';

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: publishable, SUPABASE_SECRET_KEY: secret } = process.env;
if (!url || !publishable || !secret) {
  console.error('Faltan variables en .env (ver .env.example).');
  process.exit(1);
}
if (secret.startsWith('sb_publishable_')) {
  console.error('SUPABASE_SECRET_KEY contiene una clave publishable. Copiá la clave "secret".');
  process.exit(1);
}

const opciones = { auth: { persistSession: false, autoRefreshToken: false } };
export const admin = createClient(url, secret, opciones);                 // saltea RLS
export const nuevoClientePublico = () => createClient(url, publishable, opciones); // como el navegador

export const PASSWORD_DEMO = 'demo1234'; // datos ficticios, solo para la demo
export const USUARIOS_DEMO = [
  { email: 'admin@demo.test', nombre: 'Admin Demo', rol: 'admin' },
  { email: 'cliente1@demo.test', nombre: 'Cliente Uno', rol: 'cliente' },
  { email: 'cliente2@demo.test', nombre: 'Cliente Dos', rol: 'cliente' },
];

// Crea el usuario (ya confirmado) o devuelve el existente; deja el rol pedido.
export async function asegurarUsuario({ email, nombre, rol }) {
  let { data: perfil } = await admin.from('profiles').select('id, role').eq('email', email).maybeSingle();
  if (!perfil) {
    const { error } = await admin.auth.admin.createUser({
      email, password: PASSWORD_DEMO, email_confirm: true, user_metadata: { full_name: nombre },
    });
    if (error) throw error;
    ({ data: perfil } = await admin.from('profiles').select('id, role').eq('email', email).single());
  }
  if (perfil.role !== rol) {
    const { error } = await admin.from('profiles').update({ role: rol }).eq('id', perfil.id);
    if (error) throw error;
  }
  return perfil.id;
}
