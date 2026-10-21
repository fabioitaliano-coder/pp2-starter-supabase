// Pruebas de seguridad contra TU proyecto de Supabase. Corré antes: npm run seed
import assert from 'node:assert/strict';
import { admin, nuevoClientePublico, asegurarUsuario, USUARIOS_DEMO, PASSWORD_DEMO } from './_clientes.mjs';

let fallos = 0;
async function caso(nombre, fn) {
  try {
    const r = await fn();
    console.log(r?.omitida ? `  omitida ${nombre}\n        ${r.omitida}` : `  ok   ${nombre}`);
  }
  catch (e) { fallos++; console.log(`  FALLA ${nombre}\n        ${e.message}`); }
}
async function conSesion(email) {
  const c = nuevoClientePublico();
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD_DEMO });
  assert.ifError(error);
  return c;
}

const ids = {};
for (const u of USUARIOS_DEMO) ids[u.email] = await asegurarUsuario(u);
const [A, B] = [ids['cliente1@demo.test'], ids['cliente2@demo.test']];
const cliente1 = await conSesion('cliente1@demo.test');
const adminSes = await conSesion('admin@demo.test');
const anonimo = nuevoClientePublico();

console.log('Pruebas RLS');

await caso('sin sesión no se ve ningún pedido', async () => {
  const { data } = await anonimo.from('pedidos').select('id');
  assert.equal((data ?? []).length, 0);
});
await caso('cliente1 ve solo pedidos propios', async () => {
  const { data, error } = await cliente1.from('pedidos').select('user_id');
  assert.ifError(error);
  assert.ok(data.length > 0);
  assert.ok(data.every((p) => p.user_id === A));
});
await caso('IDOR: cliente1 no puede leer un pedido de cliente2 por id', async () => {
  const { data: ajeno } = await admin.from('pedidos').select('id').eq('user_id', B).limit(1).single();
  const { data } = await cliente1.from('pedidos').select('id').eq('id', ajeno.id);
  assert.equal(data.length, 0);
});
await caso('cliente1 no puede crear un pedido a nombre de cliente2', async () => {
  const { error } = await cliente1.from('pedidos').insert({ user_id: B, total: 1 });
  assert.ok(error, 'debía fallar');
});
await caso('cliente1 no puede crear un pedido ya "entregado"', async () => {
  const { error } = await cliente1.from('pedidos').insert({ user_id: A, total: 1, estado: 'entregado' });
  assert.ok(error, 'debía fallar');
});
await caso('cliente1 no puede cambiar el estado de un pedido', async () => {
  const { data: mio } = await cliente1.from('pedidos').select('id, estado').limit(1).single();
  await cliente1.from('pedidos').update({ estado: 'entregado' }).eq('id', mio.id);
  const { data: despues } = await admin.from('pedidos').select('estado').eq('id', mio.id).single();
  assert.equal(despues.estado, mio.estado);
});
await caso('cliente1 no puede ascenderse a admin', async () => {
  await cliente1.from('profiles').update({ role: 'admin' }).eq('id', A);
  const { data } = await admin.from('profiles').select('role').eq('id', A).single();
  assert.equal(data.role, 'cliente');
});
await caso('registrarse con role=admin en el metadata crea un cliente', async () => {
  const email = `intruso-${Date.now()}@demo.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD_DEMO, email_confirm: true,
    user_metadata: { full_name: 'Intruso', role: 'admin' },
  });
  assert.ifError(error);
  const { data: perfil } = await admin.from('profiles').select('role').eq('id', data.user.id).single();
  await admin.auth.admin.deleteUser(data.user.id);
  assert.equal(perfil.role, 'cliente');
});
await caso('signUp PÚBLICO con role=admin en el metadata crea un cliente', async () => {
  // Es el camino real de un atacante: clave publishable, sin privilegios.
  // Supabase rechaza dominios inventados (.test). Definí TEST_SIGNUP_EMAIL en .env con un
  // email tuyo con alias (ej: nombre+rls@gmail.com); te llegará un mail de confirmación.
  const base = process.env.TEST_SIGNUP_EMAIL;
  if (!base) return { omitida: 'definí TEST_SIGNUP_EMAIL en .env para probar el alta pública.' };
  const email = base.replace('@', `+${Date.now()}@`);
  const { data, error } = await nuevoClientePublico().auth.signUp({
    email, password: PASSWORD_DEMO, options: { data: { full_name: 'Intruso', role: 'admin' } },
  });
  if (error) return { omitida: `el proyecto rechazó el alta pública: ${error.message}` };
  const id = data.user.id;
  const { data: perfil } = await admin.from('profiles').select('role').eq('id', id).single();
  await admin.auth.admin.deleteUser(id);
  assert.equal(perfil.role, 'cliente');
});
await caso('el admin ve pedidos de varios clientes', async () => {
  const { data } = await adminSes.from('pedidos').select('user_id').limit(100);
  assert.ok(new Set(data.map((p) => p.user_id)).size >= 2);
});
await caso('el admin puede cambiar un estado', async () => {
  const { data: p } = await adminSes.from('pedidos').select('id, estado').limit(1).single();
  const { error } = await adminSes.from('pedidos').update({ estado: p.estado }).eq('id', p.id);
  assert.ifError(error);
});
await caso('la vista resumen respeta RLS (cliente1 no cuenta pedidos ajenos)', async () => {
  const { data } = await cliente1.from('resumen_pedidos_por_estado').select('cantidad');
  const suma = data.reduce((n, r) => n + r.cantidad, 0);
  const { count } = await admin.from('pedidos').select('*', { count: 'exact', head: true }).eq('user_id', A);
  assert.equal(suma, count);
});

console.log(fallos ? `\n${fallos} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(fallos ? 1 : 0);
